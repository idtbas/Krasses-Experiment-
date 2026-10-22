// Humanoider Roboter: zwei Beine mit je fünf Gelenken, Taille, Kopf und zwei Armen mit Greifhänden.
// Er läuft physikalisch: Die Füße drücken sich vom Boden ab, ein Kreisel-Modul (Gyro) im Becken
// und die Fußgelenke halten das Gleichgewicht. Zu starke Stöße werfen ihn um.
import * as THREE from 'three';
import { Robot, friendly } from './robot.js';
import { Gripper } from './gripper.js';
import { DistanceSensor, ColorSensor, TouchSensor, Camera } from './sensors.js';
import { Mat, Geo, mesh } from '../render/materials.js';
import { BALANCE, GRIPPERS, HEADS } from './parts.js';
import { qrot, qconj, qmul, qaxis, vadd, upOf, yawOf, wrapAngle, clamp, smooth, DEG, RAD } from '../core/util.js';

const FOOT_H = 0.05, SHIN = 0.30, THIGH = 0.30, HIP_X = 0.09, HIP_DROP = 0.05;
const STAND_H = 0.565;
const WAIST_Y = 0.07, SH_X = 0.205, SH_Y = 0.33, NECK_Y = 0.405;
const UA = 0.25, FA = 0.22, HAND = 0.085;

// Bein-IK: Fuß relativ zum Hüftgelenk (fz vor, h Höhe der Hüfte über dem Knöchel, lat seitlich nach links)
export function legIK(fz, h, lat = 0) {
  const d = Math.min(THIGH + SHIN - 1e-4, Math.hypot(fz, h));
  const kneeInner = Math.acos(clamp((THIGH * THIGH + SHIN * SHIN - d * d) / (2 * THIGH * SHIN), -1, 1));
  const knee = Math.PI - kneeInner;
  const alpha = Math.atan2(fz, h);
  const beta = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
  const hip = alpha + beta;
  const ankle = knee - hip;
  const roll = Math.atan2(lat, h);
  return { hip, knee, ankle, roll };
}

export class Humanoid extends Robot {
  constructor(sim, config, spawn) {
    super(sim, config, spawn);
    this.gyro = BALANCE[this.config.gyro] || BALANCE.standard;
    this.loco = { mode: 'stand', vx: 0, phase: 0, height: STAND_H, yaw: this.spawn.yaw, turning: false, stopping: false, stepT: 0.5 };
    this.legsManual = false;
    this.armIdle = { l: true, r: true };
    this.fallTime = 0;
    this.saturated = 0;
    this.build();
  }

  L(x, y, z) { return vadd(this.spawn, qrot(this.q0, { x, y, z })); }

  build() {
    const shell = this.shell, accent = this.accent, dark = Mat.graphite(), jm = Mat.joint();
    const ms = this.motor.mass;
    const ik0 = legIK(0, STAND_H, 0);
    const pelvisY = FOOT_H + STAND_H + HIP_DROP;

    // Becken
    const becken = this.makePart('becken', this.L(0, pelvisY, 0), this.q0, { colliders: [{ shape: 'box', size: [0.13, 0.06, 0.085], r: 0.02 }], iters: 8 });
    this.fixMass(becken, 5.5 * (0.6 + 0.4 * ms));
    this.add(becken, mesh(Geo.box(0.25, 0.11, 0.16, 0.04), dark), 0, 0, 0);
    this.add(becken, mesh(Geo.box(0.2, 0.07, 0.17, 0.03), shell), 0, 0.02, 0);
    this.beckenPart = becken;

    // Oberkörper
    const torso = this.chain('oberkoerper', becken, 'taille', { anchor: [0, WAIST_Y, 0], axis: [1, 0, 0], init: 0, min: -25 * DEG, max: 80 * DEG, force: 170, speed: 1.2, stiffness: 1400, damping: 70, label: 'Taille' },
      { colliders: [{ shape: 'box', size: [0.16, 0.16, 0.095], pos: [0, 0.2, 0], r: 0.04 }], iters: 6 });
    this.fixMass(torso, 7 * ms);
    this.add(torso, mesh(Geo.cyl(0.07, 0.08, 0.09, 24), jm), 0, 0.03, 0);
    this.add(torso, mesh(Geo.box(0.33, 0.32, 0.19, 0.07), shell), 0, 0.22, 0);
    this.add(torso, mesh(Geo.box(0.22, 0.14, 0.02, 0.02), dark), 0, 0.25, 0.092);
    this.addLed(torso, mesh(Geo.torus(0.035, 0.006, 32), Mat.glow(this.config.accent)), 0, 0.25, 0.103);
    this.add(torso, mesh(Geo.box(0.34, 0.035, 0.2, 0.012), accent), 0, 0.1, 0);
    this.torso = torso;

    // Kopf
    const head = this.chain('kopf', torso, 'kopf', { anchor: [0, NECK_Y, 0], axis: [0, 1, 0], init: 0, min: -100 * DEG, max: 100 * DEG, force: 10, speed: 2.4, stiffness: 160, damping: 6, label: 'Kopf' },
      { colliders: [{ shape: 'box', size: [0.1, 0.105, 0.1], pos: [0, 0.135, 0.005], r: 0.05 }] });
    this.fixMass(head, 1.6);
    this.headPart = head;
    this.buildHead(head);

    // Arme
    this.hands = {};
    for (const side of ['l', 'r']) this.buildArm(torso, side);

    // Beine
    this.feet = {};
    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? HIP_X : -HIP_X;
      const out = side === 'l' ? 1 : -1;
      const blk = this.chain('huefteSeit' + side, becken, 'hüfte_seit_' + side, { anchor: [sx, -HIP_DROP, 0], axis: [0, 0, out], init: 0, min: -0.6, max: 0.6, force: 190, speed: 3, stiffness: 1100, damping: 50, hidden: true },
        { colliders: [{ shape: 'box', size: [0.05, 0.04, 0.06] }], iters: 10 });
      this.fixMass(blk, 0.8);
      this.setInertia(blk, 0.8, 0.006);
      const thigh = this.chain('oberschenkel' + side, blk, 'hüfte_' + side, { anchor: [0, 0, 0], axis: [-1, 0, 0], init: ik0.hip, min: -100 * DEG, max: 100 * DEG, force: 220, speed: 4, stiffness: 950, damping: 42, label: (side === 'l' ? 'linke' : 'rechte') + ' Hüfte' },
        { colliders: [{ shape: 'box', size: [0.05, THIGH / 2 - 0.03, 0.055], pos: [0, -THIGH / 2, 0], r: 0.02 }] });
      this.fixMass(thigh, 2.6 * ms);
      this.add(thigh, mesh(Geo.cyl(0.05, 0.05, 0.12, 24), jm), 0, 0, 0).rotation.z = Math.PI / 2;
      this.add(thigh, mesh(Geo.box(0.1, THIGH - 0.06, 0.11, 0.04), shell), 0, -THIGH / 2, 0);
      this.add(thigh, mesh(Geo.box(0.102, 0.05, 0.112, 0.02), accent), 0, -0.07, 0);
      const shin = this.chain('unterschenkel' + side, thigh, 'knie_' + side, { anchor: [0, -THIGH, 0], axis: [1, 0, 0], init: ik0.knee, min: -2 * DEG, max: 140 * DEG, force: 220, speed: 4, stiffness: 950, damping: 42, label: (side === 'l' ? 'linkes' : 'rechtes') + ' Knie' },
        { colliders: [{ shape: 'box', size: [0.045, SHIN / 2 - 0.03, 0.05], pos: [0, -SHIN / 2, 0], r: 0.02 }] });
      this.fixMass(shin, 1.9 * ms);
      this.add(shin, mesh(Geo.cyl(0.045, 0.045, 0.11, 24), jm), 0, 0, 0).rotation.z = Math.PI / 2;
      this.add(shin, mesh(Geo.box(0.088, SHIN - 0.05, 0.096, 0.035), shell), 0, -SHIN / 2, 0);
      this.add(shin, mesh(Geo.box(0.05, 0.12, 0.012, 0.005), dark), 0, -SHIN / 2, 0.05);
      const foot = this.chain('fuss' + side, shin, 'fuß_' + side, { anchor: [0, -SHIN, 0], axis: [-1, 0, 0], init: ik0.ankle, min: -50 * DEG, max: 50 * DEG, force: 130, speed: 4, stiffness: 800, damping: 30, label: (side === 'l' ? 'linker' : 'rechter') + ' Fuß' },
        { colliders: [{ shape: 'box', size: [0.058, FOOT_H / 2, 0.112], pos: [0, -FOOT_H / 2, 0.035], friction: 1.6, r: 0.008, role: 'fuss' }], iters: 12 });
      this.fixMass(foot, 0.9);
      this.add(foot, mesh(Geo.cyl(0.035, 0.035, 0.09, 20), jm), 0, 0, 0).rotation.z = Math.PI / 2;
      this.add(foot, mesh(Geo.box(0.116, 0.032, 0.224, 0.012), dark), 0, -0.034, 0.035);
      this.add(foot, mesh(Geo.box(0.106, 0.03, 0.17, 0.014), shell), 0, -0.006, 0.045);
      this.feet[side] = foot;
    }
    this.legSide = (n) => n.slice(-1);

    // Sensoren
    const cfg = this.config.sensoren;
    if (cfg.includes('abstand')) {
      this.sensors.abstand = new DistanceSensor(this, torso, { x: 0, y: 0.17, z: 0.1 }, { x: 0, y: -0.08, z: 1 }, 2);
      for (const sx of [-0.035, 0.035]) this.add(torso, mesh(Geo.cyl(0.016, 0.016, 0.014, 18), Mat.steel()), sx, 0.17, 0.097).rotation.x = Math.PI / 2;
    }
    if (cfg.includes('kamera')) this.sensors.kamera = new Camera(this, head, { x: 0, y: 0.14, z: 0.1 }, { x: 0, y: -0.3, z: 1 }, 110, 4);
    if (cfg.includes('farbe')) this.sensors.farbe = new ColorSensor(this, this.hands.r.part, { x: 0, y: -0.03, z: 0 }, { x: 0, y: -1, z: 0 }, 0.14);
    if (cfg.includes('beruehrung')) this.sensors.beruehrung = new TouchSensor(this, [...(this.hands.r.fingers || []).map((f) => f.part.colliders[0]), ...(this.hands.l.fingers || []).map((f) => f.part.colliders[0]), torso.colliders[0]]);
    this.setLed(null);
    this.idleLed();
  }

  idleLed() { for (const m of this.leds) m.material = Mat.glow(this.config.accent); }

  buildHead(head) {
    const kind = HEADS[this.config.kopf] ? this.config.kopf : 'visier';
    const shell = this.shell, dark = Mat.graphite();
    this.add(head, mesh(Geo.cyl(0.035, 0.04, 0.05, 20), Mat.joint()), 0, 0.02, 0);
    this.add(head, mesh(Geo.box(0.2, 0.21, 0.2, 0.08), shell), 0, 0.135, 0);
    this.add(head, mesh(Geo.box(0.21, 0.03, 0.18, 0.012), this.accent), 0, 0.07, -0.005);
    if (kind === 'kamera') {
      this.add(head, mesh(Geo.box(0.17, 0.11, 0.03, 0.03), Mat.visor()), 0, 0.14, 0.092);
      this.add(head, mesh(Geo.cyl(0.035, 0.038, 0.03, 32), dark), 0, 0.14, 0.11).rotation.x = Math.PI / 2;
      this.add(head, mesh(Geo.cyl(0.022, 0.022, 0.012, 32), Mat.visor()), 0, 0.14, 0.126).rotation.x = Math.PI / 2;
      this.addLed(head, mesh(Geo.torus(0.04, 0.004, 40), Mat.glow(this.config.accent)), 0, 0.14, 0.108);
    } else {
      this.add(head, mesh(Geo.box(0.18, 0.09, 0.03, 0.03), Mat.visor()), 0, 0.15, 0.092);
      for (const sx of [-0.042, 0.042]) {
        const eye = this.addLed(head, mesh(Geo.box(0.04, 0.016, 0.006, 0.006), Mat.glow(this.config.accent)), sx, 0.152, 0.108);
        eye.castShadow = false;
      }
    }
    if (kind === 'lidar') {
      this.add(head, mesh(Geo.cyl(0.045, 0.05, 0.03, 32), dark), 0, 0.255, 0);
      this.lidar = this.add(head, mesh(Geo.cyl(0.035, 0.035, 0.035, 24), Mat.accent('#ef4444')), 0, 0.285, 0);
    }
    // Antennen-Ohren
    for (const sx of [-1, 1]) this.add(head, mesh(Geo.cyl(0.03, 0.03, 0.02, 24), Mat.joint()), sx * 0.104, 0.135, 0).rotation.z = Math.PI / 2;
  }

  buildArm(torso, side) {
    const sgn = side === 'l' ? 1 : -1;
    const shell = this.shell, jm = Mat.joint(), dark = Mat.graphite();
    const ms = this.motor.mass;
    const lab = side === 'l' ? 'linke' : 'rechte';
    const ball = this.chain('schulterkugel' + side, torso, 'schulter_' + side, { anchor: [sgn * SH_X, SH_Y, 0], axis: [-1, 0, 0], init: 0, min: -60 * DEG, max: 180 * DEG, force: 55, speed: 2.4, stiffness: 480, damping: 22, label: lab + ' Schulter' },
      { colliders: [{ shape: 'ball', size: [0.05] }] });
    this.fixMass(ball, 0.4);
    this.add(ball, mesh(Geo.sphere(0.055, 24), jm), 0, 0, 0);
    const up = this.chain('oberarm' + side, ball, 'arm_' + side, { anchor: [0, 0, 0], axis: [0, 0, sgn], init: 4 * DEG, min: -10 * DEG, max: 150 * DEG, force: 45, speed: 2.4, stiffness: 420, damping: 18, label: lab + 'r Arm (seitlich)' },
      { colliders: [{ shape: 'box', size: [0.038, UA / 2 - 0.03, 0.038], pos: [0, -UA / 2 - 0.01, 0], r: 0.015 }] });
    this.fixMass(up, 1.1 * ms);
    this.add(up, mesh(Geo.box(0.082, UA - 0.06, 0.082, 0.035), shell), 0, -UA / 2 - 0.01, 0);
    this.add(up, mesh(Geo.box(0.084, 0.03, 0.084, 0.012), this.accent), 0, -0.07, 0);
    const fore = this.chain('unterarm' + side, up, 'ellbogen_' + side, { anchor: [0, -UA, 0], axis: [-1, 0, 0], init: 12 * DEG, min: -5 * DEG, max: 145 * DEG, force: 35, speed: 2.6, stiffness: 380, damping: 15, label: lab + 'r Ellbogen' },
      { colliders: [{ shape: 'box', size: [0.034, FA / 2 - 0.025, 0.034], pos: [0, -FA / 2, 0], r: 0.014 }] });
    this.fixMass(fore, 0.8 * ms);
    this.add(fore, mesh(Geo.cyl(0.04, 0.04, 0.09, 20), jm), 0, 0, 0).rotation.z = Math.PI / 2;
    this.add(fore, mesh(Geo.box(0.072, FA - 0.04, 0.072, 0.03), shell), 0, -FA / 2, 0);
    const hand = this.chain('hand' + side, fore, 'hand_' + side, { anchor: [0, -FA, 0], axis: [-1, 0, 0], init: 0, min: -90 * DEG, max: 90 * DEG, force: 12, speed: 3, stiffness: 150, damping: 6, label: lab + ' Hand' },
      { colliders: [{ shape: 'box', size: [0.05, 0.014, 0.03], pos: [0, -0.016, 0] }] });
    this.fixMass(hand, 0.3);
    this.add(hand, mesh(Geo.cyl(0.03, 0.03, 0.07, 18), jm), 0, 0, 0).rotation.z = Math.PI / 2;
    this.add(hand, mesh(Geo.box(0.11, 0.03, 0.062, 0.01), dark), 0, -0.016, 0);
    const gtype = this.config.greifer === 'sauger' ? 'sauger' : 'zange';
    const info = GRIPPERS[gtype];
    let g;
    if (gtype === 'zange') {
      const fingers = [];
      for (const fs of [1, -1]) {
        const fname = 'finger' + side + (fs > 0 ? 'a' : 'b');
        const part = this.chain(fname, hand, 'finger_' + side + (fs > 0 ? 'a' : 'b'),
          { kind: 'pri', anchor: [fs * 0.055, -0.03, 0], axis: [fs, 0, 0], init: 0, min: -0.05, max: 0, force: info.force * 0.8, speed: 0.12, accel: 0.6, stiffness: 2000, damping: 50, hidden: true, motorScaled: false },
          { colliders: [{ shape: 'box', size: [0.008, 0.035, 0.02], pos: [0, -0.035, 0], friction: 1.15 }], angDamp: 1, iters: 6 });
        this.fixMass(part, 0.07);
        this.add(part, mesh(Geo.box(0.016, 0.075, 0.042, 0.005), dark), 0, -0.035, 0);
        this.add(part, mesh(Geo.box(0.004, 0.05, 0.034, 0.002), Mat.rubber()), -fs * 0.0085, -0.04, 0);
        fingers.push({ servo: this.servos.get('finger_' + side + (fs > 0 ? 'a' : 'b')), part });
      }
      g = new Gripper(this, { type: 'zange', palm: hand, fingers, tip: { x: 0, y: -0.075, z: 0 }, axis: { x: 0, y: -1, z: 0 }, force: info.force * 0.8, closed: -0.05, name: 'hand_' + side });
      this.hands[side] = { part: hand, fingers, gripper: g };
    } else {
      const cup = this.addCollider(hand, { shape: 'cyl', size: [0.014, 0.024], pos: [0, -0.045, 0], friction: 0.9 });
      this.add(hand, mesh(Geo.cyl(0.01, 0.01, 0.03, 12), Mat.steel()), 0, -0.04, 0);
      this.add(hand, mesh(Geo.cyl(0.016, 0.026, 0.018, 24), Mat.rubber()), 0, -0.062, 0);
      g = new Gripper(this, { type: 'sauger', palm: hand, tip: { x: 0, y: -0.072, z: 0 }, axis: { x: 0, y: -1, z: 0 }, force: info.force, cup, name: 'hand_' + side });
      this.hands[side] = { part: hand, gripper: g };
    }
    this.grippers[side === 'l' ? 'links' : 'rechts'] = g;
  }

  frame() {
    const b = this.beckenPart.body;
    return { p: b.translation(), yaw: yawOf(b.rotation()) };
  }
  // Nullpunkt für „bewege hand zu“: Boden unter dem Becken
  userOriginY() { return 0; }
  baseBody() { return this.beckenPart.body; }

  /* ---------------- Gleichgewicht und Gang ---------------- */

  tilt() {
    const up = upOf(this.beckenPart.body.rotation());
    return Math.acos(clamp(up.y, -1, 1));
  }

  control(dt) {
    const becken = this.beckenPart.body;
    const q = becken.rotation();
    const up = upOf(q);
    const tilt = Math.acos(clamp(up.y, -1, 1));
    // Umgefallen?
    if (this.status !== 'umgefallen' && !this.gettingUp) {
      if (tilt > 50 * DEG || (this.saturated > 0.7 && tilt > 22 * DEG)) this.fall();
    }
    if (this.lidar) this.lidar.rotation.y += dt * 9;
    if (this.status === 'umgefallen' && !this.gettingUp) return;

    // Gyro: hält den Körper aufrecht und dreht ihn auf den Soll-Gierwinkel.
    // Das Moment wird wie bei einem starren Körper auf alle Glieder verteilt (Kräfte + Momente),
    // so entsteht keine innere Schwingung zwischen leichtem Becken und schweren Beinen.
    const sys = this.rigidState();
    const w = sys.omega;
    const yaw = yawOf(q);
    const yawErr = wrapAngle(this.loco.yaw - yaw);
    const maxT = this.gettingUp ? 2500 : this.gyro.torque;
    const tq = { x: 0, y: 0, z: 0 };
    if (maxT > 0) {
      const K = this.gettingUp ? 3000 : 1100, D = this.gettingUp ? 320 : 120;
      tq.x = K * -up.z - D * w.x; tq.y = 380 * yawErr - 70 * w.y; tq.z = K * up.x - D * w.z;
      const n = Math.hypot(tq.x, tq.y, tq.z);
      this.saturated = n > maxT * 0.98 ? this.saturated + dt : Math.max(0, this.saturated - dt * 2);
      if (n > maxT) { tq.x *= maxT / n; tq.y *= maxT / n; tq.z *= maxT / n; }
      this.extraPower = Math.min(maxT, n) * 0.05;
    } else {
      tq.y = (160 * yawErr - 30 * w.y) * 0.25;
    }
    this.applyRigidTorque(sys, tq, this.gettingUp ? this.liftForce : null);
    if (this.gettingUp) return;
    if (!this.legsManual) this.gait(dt, up, q);
  }

  gait(dt, up, q) {
    const lo = this.loco;
    const moving = lo.mode === 'walk';
    const T = lo.stepT;
    if (moving || lo.phase % 1 > 1e-3) {
      const before = lo.phase;
      lo.phase += dt / T;
      if (!moving || lo.stopping) {
        // nur bis zum nächsten Fußaufsetzen weiterlaufen
        if (Math.floor(lo.phase) !== Math.floor(before)) { lo.phase = Math.floor(lo.phase); if (lo.stopping) { lo.mode = 'stand'; lo.stopping = false; lo.vx = 0; } }
      }
    }
    const walking = lo.mode === 'walk' || lo.phase % 1 > 1e-3;
    const stepLen = clamp(lo.vx * T, -0.16, 0.24);
    // Neigung des Beckens im eigenen Rahmen (für die Fußgelenk-Balance)
    const invQ = qconj(q);
    const upL = qrot(invQ, { x: 0, y: 1, z: 0 });
    const pitch = Math.atan2(upL.z, upL.y); // vorgebeugt < 0
    const roll = Math.atan2(upL.x, upL.y);  // nach rechts geneigt > 0
    for (const side of ['l', 'r']) {
      let p = (lo.phase + (side === 'l' ? 0 : 1)) % 2;
      let fz = 0, lift = 0;
      if (walking) {
        if (p < 1) fz = stepLen * (0.5 - p);
        else { const s = p - 1; fz = stepLen * (-0.5 + smooth(s)); lift = 0.055 * Math.sin(Math.PI * s); }
      }
      const sway = walking ? 0.03 * Math.sin(Math.PI * lo.phase) : 0;
      const ik = legIK(fz, lo.height - lift, sway);
      const sgn = side === 'l' ? 1 : -1;
      const s = this.speedFactorLegs();
      this.servos.get('hüfte_' + side).set(ik.hip, s);
      this.servos.get('knie_' + side).set(ik.knee, s);
      this.servos.get('fuß_' + side).set(ik.ankle + 0.6 * pitch, s);
      this.servos.get('hüfte_seit_' + side).set(-sgn * ik.roll, s);
      void roll;
    }
    // Arme pendeln beim Gehen mit
    if (walking) {
      const swing = Math.sin(Math.PI * lo.phase) * 0.22 * Math.sign(stepLen || 1) * Math.min(1, Math.abs(stepLen) / 0.12);
      if (this.armIdle.l) this.servos.get('schulter_l').set(-swing + 0.05, 1);
      if (this.armIdle.r) this.servos.get('schulter_r').set(swing + 0.05, 1);
    }
  }
  speedFactorLegs() { return 2; }

  // Schwerpunkt, Trägheit und Drehgeschwindigkeit des ganzen Roboters (als wäre er starr)
  rigidState() {
    if (!this.allBodies) this.allBodies = [...this.parts.values()].filter((p) => !/^fuss/.test(p.name)).map((p) => p.body);
    const bs = this.allBodies;
    let M = 0; const c = { x: 0, y: 0, z: 0 }, vc = { x: 0, y: 0, z: 0 };
    const data = [];
    for (const b of bs) {
      const m = b.mass(), p = b.worldCom(), v = b.linvel(), I = b.principalInertia();
      const Im = (I.x + I.y + I.z) / 3;
      data.push({ b, m, p, v, Im, w: b.angvel() });
      M += m; c.x += p.x * m; c.y += p.y * m; c.z += p.z * m; vc.x += v.x * m; vc.y += v.y * m; vc.z += v.z * m;
    }
    c.x /= M; c.y /= M; c.z /= M; vc.x /= M; vc.y /= M; vc.z /= M;
    const I = { x: 0, y: 0, z: 0 }, L = { x: 0, y: 0, z: 0 };
    for (const d of data) {
      const dx = d.p.x - c.x, dy = d.p.y - c.y, dz = d.p.z - c.z;
      d.d = { x: dx, y: dy, z: dz };
      I.x += d.m * (dy * dy + dz * dz) + d.Im; I.y += d.m * (dx * dx + dz * dz) + d.Im; I.z += d.m * (dx * dx + dy * dy) + d.Im;
      const rv = { x: d.v.x - vc.x, y: d.v.y - vc.y, z: d.v.z - vc.z };
      L.x += d.m * (dy * rv.z - dz * rv.y) + d.Im * d.w.x;
      L.y += d.m * (dz * rv.x - dx * rv.z) + d.Im * d.w.y;
      L.z += d.m * (dx * rv.y - dy * rv.x) + d.Im * d.w.z;
    }
    return { data, M, c, I, omega: { x: L.x / I.x, y: L.y / I.y, z: L.z / I.z } };
  }

  applyRigidTorque(sys, tq, extraForce = null) {
    const a = { x: tq.x / sys.I.x, y: tq.y / sys.I.y, z: tq.z / sys.I.z };
    for (const d of sys.data) {
      const f = { x: d.m * (a.y * d.d.z - a.z * d.d.y), y: d.m * (a.z * d.d.x - a.x * d.d.z), z: d.m * (a.x * d.d.y - a.y * d.d.x) };
      if (extraForce) { const k = d.m / sys.M; f.x += extraForce.x * k; f.y += extraForce.y * k; f.z += extraForce.z * k; }
      const t = { x: d.Im * a.x, y: d.Im * a.y, z: d.Im * a.z };
      // nur die Änderung anlegen – fremde Kräfte (z. B. Anschubsen) bleiben erhalten
      const of = d.b.gyroF || { x: 0, y: 0, z: 0 }, ot = d.b.gyroT || { x: 0, y: 0, z: 0 };
      d.b.addForce({ x: f.x - of.x, y: f.y - of.y, z: f.z - of.z }, true);
      d.b.addTorque({ x: t.x - ot.x, y: t.y - ot.y, z: t.z - ot.z }, true);
      d.b.gyroF = f; d.b.gyroT = t;
    }
  }

  clearForces() {
    for (const b of this.allBodies || []) {
      const of = b.gyroF, ot = b.gyroT;
      if (of) b.addForce({ x: -of.x, y: -of.y, z: -of.z }, true);
      if (ot) b.addTorque({ x: -ot.x, y: -ot.y, z: -ot.z }, true);
      b.gyroF = null; b.gyroT = null;
    }
  }

  fall() {
    this.status = 'umgefallen';
    this.clearForces();
    this.loco.mode = 'stand'; this.loco.vx = 0;
    for (const t of this.tasks) this.cancelTask(t);
    for (const s of this.servos.values()) s.softness = 0.12;
    this.say('Hoppla!');
    this.warn('Der Roboter ist umgefallen. Mit „steh auf“ richtet er sich wieder auf.');
    this.setLed('rot');
  }

  *getUp() {
    this.gettingUp = true;
    const b = this.beckenPart.body;
    const yaw = yawOf(b.rotation());
    this.loco.yaw = yaw;
    for (const s of this.servos.values()) s.softness = 1;
    this.legsManual = false;
    this.loco.height = 0.36;
    this.gait(0, { x: 0, y: 1, z: 0 }, b.rotation());
    for (const side of ['l', 'r']) { this.servos.get('schulter_' + side).set(0.1, 1); this.servos.get('ellbogen_' + side).set(0.3, 1); }
    this.servos.get('taille').set(0, 1);
    let t = 0;
    while (t < 2.6) {
      const dt = yield;
      t += dt;
      const k = smooth(clamp(t / 2.2, 0, 1));
      const p = b.translation();
      const targetY = FOOT_H + (0.36 + (STAND_H - 0.36) * k) + HIP_DROP;
      const m = this.totalMass();
      const vy = b.linvel().y;
      const f = clamp((targetY - p.y) * 900 - vy * 120 + m * 9.81 * 0.85, 0, m * 30);
      this.liftForce = { x: -b.linvel().x * 40, y: f, z: -b.linvel().z * 40 };
      this.loco.height = 0.36 + (STAND_H - 0.36) * k;
      this.gait(dt, upOf(b.rotation()), b.rotation());
      if (t > 1.8 && this.tilt() < 5 * DEG && Math.abs(p.y - targetY) < 0.03) break;
    }
    this.liftForce = null;
    this.clearForces();
    this.gettingUp = false;
    this.status = 'bereit';
    this.loco.height = STAND_H;
    this.idleLed();
    yield* this.wait(0.4);
  }

  totalMass() {
    if (this._mass) return this._mass;
    let m = 0;
    for (const p of this.parts.values()) m += p.body.mass();
    return (this._mass = m);
  }

  stopMotion() {
    super.stopMotion();
    if (this.loco.mode === 'walk') this.loco.stopping = true;
    this.loco.vx = 0;
    this.loco.yaw = this.frame().yaw;
  }

  resetRuntime() {
    super.resetRuntime();
    this.loco.yaw = this.frame().yaw;
    this.armIdle = { l: true, r: true };
  }

  /* ---------------- Fortbewegung ---------------- */

  checkUp() {
    if (this.status === 'umgefallen') throw friendly('Der Roboter liegt am Boden. Zuerst „steh auf“!');
  }

  *walkFor(dist) {
    this.checkUp();
    this.legsManual = false;
    const f0 = this.frame();
    const dir = Math.sign(dist) || 1;
    const lo = this.loco;
    lo.yaw = f0.yaw;
    lo.mode = 'walk'; lo.stopping = false;
    const v = (0.12 + 0.24 * this.speed) * dir;
    lo.stepT = 0.56 - 0.14 * this.speed;
    const target = Math.abs(dist);
    let t = 0;
    for (;;) {
      const dt = yield;
      t += dt;
      if (this.status === 'umgefallen') throw friendly('Umgefallen – der Weg wurde abgebrochen.');
      const p = this.frame().p;
      const done = ((p.x - f0.p.x) * Math.sin(f0.yaw) + (p.z - f0.p.z) * Math.cos(f0.yaw)) * dir;
      const rest = target - done;
      lo.vx = rest < 0.12 ? v * clamp(rest / 0.12 + 0.25, 0.25, 1) : v;
      // der letzte Schritt läuft noch aus – etwas früher bremsen
      if (rest <= 0.012 + Math.abs(lo.vx) * lo.stepT * 0.45 || t > 8 + target * 12) break;
    }
    lo.stopping = true;
    yield* this.until(() => lo.mode === 'stand', 3);
    yield* this.wait(0.2);
  }

  *turnBy(angle) {
    this.checkUp();
    this.legsManual = false;
    const lo = this.loco;
    const start = this.frame().yaw;
    const goal = start + angle;
    lo.mode = 'walk'; lo.stopping = false; lo.vx = 0;
    lo.stepT = 0.5;
    let t = 0;
    const rate = (60 + 120 * this.speed) * DEG;
    let cur = start;
    for (;;) {
      const dt = yield;
      t += dt;
      const step = rate * dt * Math.sign(goal - cur);
      cur = Math.abs(goal - cur) < Math.abs(step) ? goal : cur + step;
      lo.yaw = cur;
      const err = wrapAngle(goal - this.frame().yaw);
      if ((cur === goal && Math.abs(err) < 3 * DEG) || t > 6 + Math.abs(angle) * 2) break;
    }
    lo.yaw = goal;
    lo.stopping = true;
    yield* this.until(() => lo.mode === 'stand', 3);
    yield* this.wait(0.15);
  }

  *walkTo(x, z, stopDist = 0.04) {
    this.checkUp();
    this.legsManual = false;
    const lo = this.loco;
    let t = 0;
    for (;;) {
      const f = this.frame();
      const dx = x - f.p.x, dz = z - f.p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < stopDist) break;
      const bearing = Math.atan2(dx, dz);
      const err = wrapAngle(bearing - f.yaw);
      if (Math.abs(err) > 30 * DEG && dist > 0.15) {
        yield* this.turnBy(err);
        continue;
      }
      lo.mode = 'walk'; lo.stopping = false;
      lo.yaw = f.yaw + clamp(err, -0.6, 0.6);
      const v = 0.12 + 0.24 * this.speed;
      lo.vx = dist < 0.15 ? v * clamp(dist / 0.15 + 0.3, 0.3, 1) : v;
      lo.stepT = 0.56 - 0.14 * this.speed;
      t += yield;
      if (this.status === 'umgefallen') throw friendly('Umgefallen – der Weg wurde abgebrochen.');
      if (t > 40) break;
      // vorbeigelaufen?
      const f2 = this.frame();
      if (Math.cos(Math.atan2(x - f2.p.x, z - f2.p.z) - f2.yaw) < 0 && Math.hypot(x - f2.p.x, z - f2.p.z) < 0.15) break;
    }
    lo.stopping = true;
    lo.yaw = this.frame().yaw;
    yield* this.until(() => lo.mode === 'stand', 3);
    yield* this.wait(0.15);
  }

  *faceYaw(yaw) {
    const err = wrapAngle(yaw - this.frame().yaw);
    if (Math.abs(err) > 4 * DEG) yield* this.turnBy(err);
  }

  cmd_gehe_vor({ strecke }) { return this.run(function* () { yield* this.walkFor(strecke / 100); }, 'beine'); }
  cmd_gehe_zurueck({ strecke }) { return this.run(function* () { yield* this.walkFor(-strecke / 100); }, 'beine'); }
  cmd_drehe_dich({ winkel, richtung }) {
    const a = winkel * DEG * (richtung === 'rechts' ? -1 : 1);
    return this.run(function* () { yield* this.turnBy(a); }, 'beine');
  }
  cmd_gehe_zu({ x, z }) { return this.run(function* () { yield* this.walkTo(-x / 100, z / 100); }, 'beine'); }
  cmd_gehe_los() {
    this.checkUp();
    this.legsManual = false;
    const lo = this.loco;
    lo.yaw = this.frame().yaw;
    lo.mode = 'walk'; lo.stopping = false;
    lo.vx = 0.12 + 0.24 * this.speed;
    lo.stepT = 0.56 - 0.14 * this.speed;
    return null;
  }
  cmd_folge_pfad() {
    const path = this.sim.path;
    if (!path || path.length < 2) throw friendly('Es ist noch kein Pfad gezeichnet. Zeichne mit dem Apple Pencil (oder dem Pfad-Werkzeug) eine Linie auf den Boden.');
    return this.run(function* () {
      for (const pt of path) yield* this.walkTo(pt.x, pt.z, 0.08);
    }, 'beine');
  }
  cmd_hocke() { this.checkUp(); this.legsManual = false; this.loco.height = 0.38; return this.run(function* () { yield* this.wait(0.8); }, 'haltung'); }
  cmd_steh_auf() {
    if (this.status === 'umgefallen') return this.run(function* () { yield* this.getUp(); }, 'beine');
    this.legsManual = false;
    this.loco.height = STAND_H;
    this.servos.get('taille').set(0, this.speed);
    return this.run(function* () { yield* this.wait(0.7); }, 'haltung');
  }

  /* ---------------- Gelenke und Arme ---------------- */

  servoOrFail(name) {
    const s = this.servos.get(name);
    if (!s || s.hidden) throw friendly(`Ein Gelenk „${name}“ hat der Humanoid nicht. Es gibt: ${this.jointNames().join(', ')}.`);
    return s;
  }
  markJoint(name) {
    if (/^(hüfte|knie|fuß)_/.test(name)) { this.legsManual = true; this.loco.mode = 'stand'; }
    if (/_l$/.test(name) && /^(schulter|arm|ellbogen|hand)/.test(name)) this.armIdle.l = false;
    if (/_r$/.test(name) && /^(schulter|arm|ellbogen|hand)/.test(name)) this.armIdle.r = false;
  }
  cmd_drehe_auf({ gelenk, winkel }) {
    const s = this.servoOrFail(gelenk);
    this.markJoint(gelenk);
    if (s.setDeg(winkel, this.speed)) this.warn(`${s.label}: ${Math.round(winkel)}° geht nicht – erlaubt sind ${Math.round(s.min * RAD)}° bis ${Math.round(s.max * RAD)}°.`);
    return this.run(function* () { yield* this.waitServos([gelenk]); }, 'gelenk:' + gelenk);
  }
  cmd_drehe_um({ gelenk, winkel }) {
    const s = this.servoOrFail(gelenk);
    return this.cmd_drehe_auf({ gelenk, winkel: s.target * RAD + winkel });
  }
  cmd_grundstellung() {
    this.armIdle = { l: true, r: true };
    this.legsManual = false;
    this.loco.height = STAND_H;
    return this.run(function* () {
      yield* this.moveTo({ kopf: 0, taille: 0, schulter_l: 3, schulter_r: 3, arm_l: 4, arm_r: 4, ellbogen_l: 12, ellbogen_r: 12, hand_l: 0, hand_r: 0 }, this.speed);
    }, 'arme');
  }

  // Wo liegt die Schulter (im Roboterrahmen, m), wenn das Becken bei der Höhe h steht und die Taille um lean geneigt ist?
  shoulderLocal(side, h, lean) {
    const sgn = side === 'l' ? 1 : -1;
    const py = FOOT_H + h + HIP_DROP + WAIST_Y;
    return { x: sgn * SH_X, y: py + SH_Y * Math.cos(lean), z: SH_Y * Math.sin(lean) };
  }

  // Vorwärtskinematik des Arms im Oberkörper-Rahmen (Ursprung Schulter): Handgelenk-Position
  armFK(side, sh, ab, el) {
    const sgn = side === 'l' ? 1 : -1;
    const r1 = qaxis({ x: -1, y: 0, z: 0 }, sh);
    const r2 = qmul(r1, qaxis({ x: 0, y: 0, z: sgn }, ab));
    const elbow = qrot(r2, { x: 0, y: -UA, z: 0 });
    const r3 = qmul(r2, qaxis({ x: -1, y: 0, z: 0 }, el));
    const f = qrot(r3, { x: 0, y: -FA, z: 0 });
    return { p: { x: elbow.x + f.x, y: elbow.y + f.y, z: elbow.z + f.z }, r3 };
  }

  /*
   * Arm-IK. target: Robotersicht in m (x links, y vom Boden, z vor). Die Hand zeigt nach unten.
   * Liefert Gelenkwinkel (rad) inkl. Hocke (height) und Vorbeugen (lean) oder null.
   */
  armIK(side, target, pose = {}) {
    const sgn = side === 'l' ? 1 : -1;
    const wristY = target.y + HAND;
    let h = pose.height ?? STAND_H, lean = pose.lean ?? 0;
    if (pose.height == null) {
      // Haltung suchen: möglichst aufrecht, aber so, dass der Arm nicht ganz gestreckt sein muss
      let best = null;
      for (let li = 0; li <= 14; li++) {
        const L = li * 5 * DEG;
        for (let hi = 0; hi <= 8; hi++) {
          const H = STAND_H - hi * (STAND_H - 0.28) / 8;
          const shp = this.shoulderLocal(side, H, L);
          const d = Math.hypot(target.x - shp.x, wristY - shp.y, target.z - shp.z);
          if (d > (UA + FA) * 0.93) continue;
          const cost = L * 1.2 + (STAND_H - H) * 4 + Math.max(0, 0.25 - d) * 2;
          if (!best || cost < best.cost) best = { cost, L, H };
        }
      }
      if (!best) return null;
      h = best.H; lean = best.L;
    }
    const sh = this.shoulderLocal(side, h, lean);
    let v = { x: target.x - sh.x, y: wristY - sh.y, z: target.z - sh.z };
    const c = Math.cos(-lean), s = Math.sin(-lean);
    v = { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
    const len = Math.hypot(v.x, v.y, v.z);
    if (len > UA + FA - 0.004) return null;
    // Startwert analytisch, dann Gauß-Newton auf (Schulter, Abspreizen, Ellbogen)
    const out = v.x * sgn, dn = -v.y, fwd = v.z;
    const e0 = Math.acos(clamp((len * len - UA * UA - FA * FA) / (2 * UA * FA), -1, 1));
    let q = [Math.atan2(fwd, Math.hypot(dn, out)) - Math.atan2(FA * Math.sin(e0), UA + FA * Math.cos(e0)), clamp(Math.atan2(out, Math.max(0.05, dn)), -0.15, 1.3), e0];
    const lim = [[-60 * DEG, 180 * DEG], [-10 * DEG, 150 * DEG], [-5 * DEG, 145 * DEG]];
    for (let it = 0; it < 14; it++) {
      const p0 = this.armFK(side, q[0], q[1], q[2]).p;
      const err = [v.x - p0.x, v.y - p0.y, v.z - p0.z];
      if (Math.hypot(...err) < 0.002) break;
      const J = [];
      for (let k = 0; k < 3; k++) {
        const qq = q.slice(); qq[k] += 1e-4;
        const p1 = this.armFK(side, qq[0], qq[1], qq[2]).p;
        J.push([(p1.x - p0.x) / 1e-4, (p1.y - p0.y) / 1e-4, (p1.z - p0.z) / 1e-4]);
      }
      // gedämpfte kleinste Quadrate: dq = Jᵀ (J Jᵀ + λI)⁻¹ err  (3×3)
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let sum = 0; for (let k = 0; k < 3; k++) sum += J[k][i] * J[k][j]; A[i][j] = sum + (i === j ? 0.002 : 0); }
      const y = solve3(A, err);
      for (let k = 0; k < 3; k++) {
        const dq = J[k][0] * y[0] + J[k][1] * y[1] + J[k][2] * y[2];
        q[k] = clamp(q[k] + clamp(dq, -0.4, 0.4), lim[k][0], lim[k][1]);
      }
    }
    const fk = this.armFK(side, q[0], q[1], q[2]);
    if (Math.hypot(v.x - fk.p.x, v.y - fk.p.y, v.z - fk.p.z) > 0.02) return null;
    // Handgelenk so, dass die Hand senkrecht nach unten zeigt
    const d = { x: 0, y: -Math.cos(lean), z: Math.sin(lean) };
    const dl = qrot(qconj(fk.r3), d);
    const hand = clamp(Math.atan2(dl.z, -dl.y), -90 * DEG, 90 * DEG);
    return { height: h, lean, schulter: q[0], arm: q[1], ellbogen: q[2], hand };
  }

  handTipLocal(side) {
    const g = this.hands[side].gripper;
    const w = g.tipWorld();
    return this.worldToLocal(w);
  }
  worldToLocal(w) {
    const f = this.frame();
    const dx = w.x - f.p.x, dz = w.z - f.p.z;
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    return { x: dx * c + dz * s, y: w.y, z: -dx * s + dz * c };
  }
  localToWorld(l) {
    const f = this.frame();
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return { x: f.p.x + l.x * c + l.z * s, y: l.y, z: f.p.z - l.x * s + l.z * c };
  }

  *reach(side, target, opts = {}) {
    const sol0 = this.armIK(side, target);
    if (!sol0) throw friendly(`Da kommt die ${side === 'l' ? 'linke' : 'rechte'} Hand nicht hin – der Punkt ist zu weit weg. Geh näher heran.`);
    this.armIdle[side] = false;
    this.legsManual = false;
    let goal = { ...target };
    const sp = opts.speed ?? this.speed;
    for (let iter = 0; iter < (opts.iterations ?? 3); iter++) {
      const sol = this.armIK(side, goal, iter ? { height: sol0.height, lean: sol0.lean } : {}) || sol0;
      this.loco.height = sol.height;
      this.servos.get('taille').set(sol.lean, sp);
      this.servos.get('schulter_' + side).set(sol.schulter, sp);
      this.servos.get('arm_' + side).set(sol.arm, sp);
      this.servos.get('ellbogen_' + side).set(sol.ellbogen, sp);
      this.servos.get('hand_' + side).set(sol.hand, sp);
      yield* this.waitServos(['taille', 'schulter_' + side, 'arm_' + side, 'ellbogen_' + side], 6, true);
      yield* this.wait(0.15);
      // nachregeln: tatsächliche Handposition messen
      const tip = this.handTipLocal(side);
      const err = { x: target.x - tip.x, y: target.y - tip.y, z: target.z - tip.z };
      if (Math.hypot(err.x, err.y, err.z) < 0.012) break;
      goal = { x: goal.x + err.x * 0.9, y: goal.y + err.y * 0.9, z: goal.z + err.z * 0.9 };
    }
  }

  cmd_bewege_hand({ seite, x, y, z }) {
    const side = seite === 'linke' ? 'l' : 'r';
    const t = { x: -x / 100, y: y / 100, z: z / 100 };
    if (!this.armIK(side, t)) throw friendly(`Den Punkt (${x}, ${y}, ${z}) erreicht die Hand nicht. Der Arm ist etwa ${Math.round((UA + FA + HAND) * 100)} cm lang.`);
    return this.run(function* () { this.checkUp(); yield* this.reach(side, t); }, 'arm_' + side);
  }

  cmd_greife() { return this.hands.r.gripper.grip(); }
  cmd_greife_mit({ hand }) { return this.hands[hand === 'links' ? 'l' : 'r'].gripper.grip(); }

  *carryPose(side) {
    const sp = this.speed;
    this.servos.get('taille').set(0, sp);
    this.loco.height = STAND_H;
    yield* this.moveTo({ ['schulter_' + side]: 45, ['arm_' + side]: 6, ['ellbogen_' + side]: 70, ['hand_' + side]: -20 }, sp);
  }

  surfaceBelowWorld(x, z) {
    let top = 0;
    for (const e of this.sim.entities) {
      if (e.surfaceAt) { const s = e.surfaceAt(x, z); if (s != null) top = Math.max(top, s); }
      if (e.kind === 'band' && e.toLocal) { const l = e.toLocal(x, z); if (Math.abs(l.x) <= e.L / 2 && Math.abs(l.z) <= e.W / 2) top = Math.max(top, e.H); }
    }
    return top;
  }

  // Standpunkt so wählen, dass der Gegenstand vor der rechten Hand liegt
  *approach(worldPos, dist = 0.3) {
    const f = this.frame();
    const dx = worldPos.x - f.p.x, dz = worldPos.z - f.p.z;
    let yaw = Math.atan2(dx, dz);
    const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const left = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const sx = worldPos.x - fwd.x * dist + left.x * SH_X;
    const sz = worldPos.z - fwd.z * dist + left.z * SH_X;
    if (Math.hypot(sx - f.p.x, sz - f.p.z) > 0.06) yield* this.walkTo(sx, sz, 0.04);
    // genau ausrichten
    const f2 = this.frame();
    yaw = Math.atan2(worldPos.x - (f2.p.x - left.x * SH_X), worldPos.z - (f2.p.z - left.z * SH_X));
    yield* this.faceYaw(yaw);
  }

  cmd_nimm({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.hands.r.gripper;
    const self = this;
    return this.run(function* () {
      this.checkUp();
      let hit = cam.find(farbe, { objectsOnly: true });
      // umsehen
      for (let i = 0; !hit && i < 7; i++) {
        if (i === 0) self.say('Ich schaue mich um …');
        yield* this.turnBy(50 * DEG);
        hit = cam.find(farbe, { objectsOnly: true });
      }
      if (!hit) throw friendly(`Ich finde nichts in ${String(farbe)}.`);
      const thing = hit.entity;
      if (g.held) { const a = g.release(); yield* this.until(() => a.done(), 2); }
      const ra = g.release(); yield* this.until(() => ra.done(), 2);
      yield* this.approach(thing.body.translation(), 0.3);
      let p = this.worldToLocal(thing.body.translation());
      const gy = g.type === 'zange' ? Math.max(p.y, 0.03) : p.y + thing.halfHeight;
      yield* this.reach('r', { x: p.x, y: gy + 0.12, z: p.z });
      p = this.worldToLocal(thing.body.translation());
      yield* this.reach('r', { x: p.x, y: gy, z: p.z }, { speed: this.speed * 0.6 });
      const ga = g.grip(); yield* this.until(() => ga.done(), 3);
      if (!g.held) self.warn('Daneben gegriffen – die Hand hat nichts zu fassen bekommen.');
      const tip = this.handTipLocal('r');
      yield* this.reach('r', { x: tip.x, y: tip.y + 0.15, z: tip.z - 0.02 }, { iterations: 1 });
      yield* this.carryPose('r');
    }, 'arm_r');
  }

  *placeOn(worldPos, topY, drop = false) {
    const g = this.hands.r.gripper;
    yield* this.approach(worldPos, 0.3);
    const p = this.worldToLocal(worldPos);
    const half = g.held ? g.held.halfHeight : 0.03;
    const y = (g.type === 'zange' ? topY + half : topY + half * 2) + 0.01;
    if (drop) {
      // In Zonen und Kisten darf der Gegenstand die letzten Zentimeter fallen
      yield* this.reach('r', { x: p.x, y: y + 0.1, z: p.z });
    } else {
      yield* this.reach('r', { x: p.x, y: y + 0.12, z: p.z });
      yield* this.reach('r', { x: p.x, y, z: p.z }, { speed: this.speed * 0.6 });
    }
    const a = g.release(); yield* this.until(() => a.done(), 2);
    yield* this.wait(0.15);
    const tip = this.handTipLocal('r');
    yield* this.reach('r', { x: tip.x, y: tip.y + 0.12, z: tip.z - 0.03 }, { iterations: 1 });
    yield* this.carryPose('r');
    yield* this.moveTo({ schulter_r: 3, arm_r: 4, ellbogen_r: 12, hand_r: 0 }, this.speed);
    this.armIdle.r = true;
  }

  cmd_lege_auf({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.hands.r.gripper;
    if (!g.held) this.warn('Die rechte Hand hält gerade nichts.');
    const self = this;
    return this.run(function* () {
      this.checkUp();
      let hit = cam.find(farbe, { exclude: (e) => e === g.held });
      for (let i = 0; !hit && i < 7; i++) {
        yield* this.turnBy(50 * DEG);
        hit = cam.find(farbe, { exclude: (e) => e === g.held });
      }
      if (!hit) throw friendly(`Ich finde keine Ablage in ${String(farbe)}.`);
      const e = hit.entity;
      const c = e.isObject ? e.body.translation() : e.center;
      let top;
      if (e.isObject) top = c.y + e.halfHeight;
      else if (e.kind === 'kiste') top = c.y + 0.02;
      else top = Math.max(c.y, self.surfaceBelowWorld(c.x, c.z));
      yield* this.placeOn(c, top, !e.isObject);
    }, 'arm_r');
  }

  cmd_lege() {
    const g = this.hands.r.gripper;
    return this.run(function* () {
      this.checkUp();
      const f = this.frame();
      const p = { x: f.p.x + Math.sin(f.yaw) * 0.3 - Math.cos(f.yaw) * SH_X, y: 0, z: f.p.z + Math.cos(f.yaw) * 0.3 + Math.sin(f.yaw) * SH_X };
      const top = this.surfaceBelowWorld(p.x, p.z);
      const l = this.worldToLocal(p);
      const half = g.held ? g.held.halfHeight : 0.03;
      yield* this.reach('r', { x: l.x, y: top + half + 0.02, z: l.z });
      const a = g.release(); yield* this.until(() => a.done(), 2);
      yield* this.carryPose('r');
      yield* this.moveTo({ schulter_r: 3, arm_r: 4, ellbogen_r: 12, hand_r: 0 }, this.speed);
      this.armIdle.r = true;
    }, 'arm_r');
  }

  cmd_wirf() {
    const g = this.hands.r.gripper;
    return this.run(function* () {
      this.checkUp();
      this.armIdle.r = false;
      yield* this.moveTo({ schulter_r: -40, ellbogen_r: 60, hand_r: 0, arm_r: 8 }, 0.7);
      const sh = this.servos.get('schulter_r'), el = this.servos.get('ellbogen_r');
      sh.set(150 * DEG, 2); el.set(10 * DEG, 2);
      yield* this.until(() => sh.value() > 70 * DEG, 2);
      g.release();
      yield* this.waitServos(['schulter_r', 'ellbogen_r']);
      yield* this.moveTo({ schulter_r: 3, arm_r: 4, ellbogen_r: 12, hand_r: 0 }, this.speed);
      this.armIdle.r = true;
    }, 'arm_r');
  }

  cmd_winke() {
    return this.run(function* () {
      this.checkUp();
      this.armIdle.r = false;
      yield* this.moveTo({ schulter_r: 20, arm_r: 140, ellbogen_r: 50, hand_r: 0 }, 0.7);
      for (let i = 0; i < 3; i++) {
        yield* this.moveTo({ ellbogen_r: 20 }, 0.9);
        yield* this.moveTo({ ellbogen_r: 75 }, 0.9);
      }
      yield* this.moveTo({ schulter_r: 3, arm_r: 4, ellbogen_r: 12 }, 0.6);
      this.armIdle.r = true;
    }, 'arm_r');
  }

  cmd_verbeuge() {
    return this.run(function* () {
      this.checkUp();
      yield* this.moveTo({ taille: 40, kopf: 0 }, 0.4);
      yield* this.wait(0.6);
      yield* this.moveTo({ taille: 0 }, 0.4);
    }, 'haltung');
  }

  cmd_tanze() {
    return this.run(function* () {
      this.checkUp();
      this.armIdle = { l: false, r: false };
      for (let i = 0; i < 4; i++) {
        const s = i % 2 ? 1 : -1;
        yield* this.moveTo({ arm_l: 70 + s * 40, arm_r: 70 - s * 40, ellbogen_l: 60, ellbogen_r: 60, kopf: s * 25, schulter_l: 30, schulter_r: 30 }, 0.9);
        this.loco.height = i % 2 ? STAND_H : STAND_H - 0.08;
      }
      yield* this.turnBy(Math.PI);
      yield* this.moveTo({ arm_l: 130, arm_r: 130, ellbogen_l: 20, ellbogen_r: 20, kopf: 0 }, 0.8);
      yield* this.wait(0.3);
      this.loco.height = STAND_H;
      yield* this.moveTo({ arm_l: 4, arm_r: 4, ellbogen_l: 12, ellbogen_r: 12, schulter_l: 3, schulter_r: 3 }, 0.7);
      this.armIdle = { l: true, r: true };
    }, 'arme');
  }

  cmd_schaue_zu({ farbe }) {
    const cam = this.needSensor('kamera');
    const hit = cam.find(farbe, { wide: true });
    if (!hit) throw friendly(`Ich sehe nichts in ${String(farbe)}.`);
    const head = this.servos.get('kopf');
    head.set(clamp(head.target - hit.bearing * DEG, head.min, head.max), this.speed);
    return this.run(function* () { yield* this.waitServos(['kopf']); }, 'gelenk:kopf');
  }

  rep_umgefallen() { return this.status === 'umgefallen'; }
}

function solve3(A, b) {
  const [a, bb, c] = A[0], [d, e, f] = A[1], [g, h, i] = A[2];
  const det = a * (e * i - f * h) - bb * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return [0, 0, 0];
  const inv = [
    [(e * i - f * h) / det, (c * h - bb * i) / det, (bb * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (bb * g - a * h) / det, (a * e - bb * d) / det],
  ];
  return [0, 1, 2].map((r) => inv[r][0] * b[0] + inv[r][1] * b[1] + inv[r][2] * b[2]);
}
