// Fahrroboter mit Differentialantrieb: zwei angetriebene Räder, ein Gleitkufen-Stützrad,
// Sensoren vorne und optional eine Frontzange zum Einsammeln von Würfeln.
import * as THREE from 'three';
import { Robot, friendly } from './robot.js';
import { Gripper } from './gripper.js';
import { DistanceSensor, ColorSensor, LineSensors, TouchSensor, Camera } from './sensors.js';
import { Mat, Geo, mesh } from '../render/materials.js';
import { WHEELS, GRIPPERS } from './parts.js';
import { qrot, qconj, qmul, qaxis, vadd, twistAngle, wrapAngle, clamp, DEG, RAD } from '../core/util.js';

const TRACK = 0.31;   // Spurweite (Abstand der Räder)
const VMAX = 0.55;    // m/s bei 100 %

export class Rover extends Robot {
  constructor(sim, config, spawn) {
    super(sim, config, spawn);
    this.wheelCfg = WHEELS[this.config.raeder] || WHEELS.standard;
    this.R_W = this.wheelCfg.r;
    this.wheels = {};
    this.drive = { l: 0, r: 0 }; // Soll-Radgeschwindigkeit in m/s
    this.odo = { l: 0, r: 0 };
    this.build();
  }

  L(x, y, z) { return vadd(this.spawn, qrot(this.q0, { x, y, z })); }

  build() {
    const r = this.R_W;
    const h0 = r + 0.012;
    const shell = this.shell, accent = this.accent, dark = Mat.graphite();
    const ch = this.makePart('chassis', this.L(0, h0, 0), this.q0, {
      colliders: [
        { shape: 'box', size: [0.12, 0.035, 0.165], pos: [0, 0.02, 0], r: 0.015 },
        { shape: 'ball', size: [0.022], pos: [0, 0.022 - h0, -0.13], friction: 0.02 },
      ],
      iters: 6,
    });
    this.fixMass(ch, 2.3 * (0.7 + 0.3 * this.motor.mass));
    this.chassis = ch;
    // Grafik Karosserie
    this.add(ch, mesh(Geo.box(0.25, 0.07, 0.34, 0.03), shell), 0, 0.022, 0);
    this.add(ch, mesh(Geo.box(0.2, 0.035, 0.22, 0.015), dark), 0, 0.068, -0.02);
    this.add(ch, mesh(Geo.box(0.252, 0.016, 0.24, 0.006), accent), 0, 0.012, -0.03);
    this.addLed(ch, mesh(Geo.box(0.16, 0.008, 0.006, 0.003), Mat.glow(this.config.accent)), 0, 0.045, -0.171);
    this.add(ch, mesh(Geo.sphere(0.022, 16), Mat.steel()), 0, 0.022 - h0, -0.13);
    // Antenne
    this.add(ch, mesh(Geo.cyl(0.003, 0.003, 0.16, 6), dark), -0.08, 0.16, -0.12);
    this.addLed(ch, mesh(Geo.sphere(0.008, 10), Mat.glow(this.config.accent)), -0.08, 0.245, -0.12);

    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const x = sx * TRACK / 2;
      const wheelQ = qmul(this.q0, qaxis({ x: 0, y: 0, z: 1 }, Math.PI / 2));
      const part = this.makePart('rad' + side, this.L(x, r, 0.04), this.q0, {
        colliders: [{ shape: 'cyl', size: [0.018, r], rot: qaxis({ x: 0, y: 0, z: 1 }, Math.PI / 2), friction: this.wheelCfg.friction }],
        angDamp: 0.05, iters: 6,
      });
      void wheelQ;
      this.fixMass(part, 0.18);
      const R = this.R;
      const jd = R.JointData.revolute({ x, y: r - h0, z: 0.04 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      const j = this.world.createImpulseJoint(jd, ch.body, part.body, true);
      j.setContactsEnabled(false);
      j.configureMotorModel(R.MotorModel.ForceBased);
      j.setMotorMaxForce(1.6 * this.motor.torque);
      const tire = mesh(Geo.cyl(r, r, 0.034, 36), Mat.rubber());
      tire.rotation.z = Math.PI / 2;
      this.add(part, tire);
      const hub = mesh(Geo.cyl(r * 0.6, r * 0.6, 0.036, 24), accent);
      hub.rotation.z = Math.PI / 2;
      this.add(part, hub);
      for (let k = 0; k < 5; k++) {
        const spoke = mesh(Geo.box(0.038, r * 0.9, 0.008, 0.002), dark);
        spoke.rotation.x = k / 5 * Math.PI;
        this.add(part, spoke);
      }
      this.wheels[side] = { part, joint: j, last: 0, angle: 0 };
    }

    // Frontzange
    const gtype = this.config.greifer;
    if (gtype === 'zange') {
      const info = GRIPPERS.zange;
      this.add(ch, mesh(Geo.box(0.17, 0.025, 0.03, 0.008), dark), 0, 0.01, 0.185);
      const fingers = [];
      for (const fs of [1, -1]) {
        const part = this.chain('kralle' + (fs > 0 ? 'a' : 'b'), ch, 'kralle_' + (fs > 0 ? 'a' : 'b'),
          { kind: 'pri', anchor: [fs * 0.075, 0.01, 0.19], axis: [fs, 0, 0], init: 0, min: -0.05, max: 0, force: info.force * 0.6, speed: 0.12, accel: 0.6, stiffness: 1500, damping: 40, hidden: true, motorScaled: false },
          { colliders: [{ shape: 'box', size: [0.007, 0.026, 0.035], pos: [0, -0.04, 0.03], friction: 1.15 }], angDamp: 1, iters: 6 });
        this.fixMass(part, 0.06);
        this.add(part, mesh(Geo.box(0.014, 0.062, 0.074, 0.004), dark), 0, -0.036, 0.03);
        this.add(part, mesh(Geo.box(0.004, 0.044, 0.06, 0.002), Mat.rubber()), -fs * 0.008, -0.04, 0.032);
        fingers.push({ servo: this.servos.get('kralle_' + (fs > 0 ? 'a' : 'b')), part });
      }
      this.grippers.main = new Gripper(this, { type: 'zange', palm: ch, fingers, tip: { x: 0, y: -0.03, z: 0.22 }, axis: { x: 0, y: 0, z: 1 }, force: info.force * 0.6, closed: -0.05 });
      this.clawFingers = fingers;
    }

    // Sensoren
    const cfg = this.config.sensoren;
    if (cfg.includes('abstand')) {
      this.sensors.abstand = new DistanceSensor(this, ch, { x: 0, y: 0.03, z: gtype === 'zange' ? 0.21 : 0.172 }, { x: 0, y: 0, z: 1 }, 2);
      const board = mesh(Geo.box(0.07, 0.03, 0.006, 0.002), Mat.accent('#1d4ed8'));
      this.add(ch, board, 0, 0.065, 0.168);
      for (const sx of [-0.019, 0.019]) this.add(ch, mesh(Geo.cyl(0.0125, 0.0125, 0.014, 20), Mat.steel()), sx, 0.065, 0.176).rotation.x = Math.PI / 2;
    }
    if (cfg.includes('farbe')) {
      this.sensors.farbe = new ColorSensor(this, ch, { x: 0, y: 0.0, z: 0.13 }, { x: 0, y: -1, z: 0 }, 0.12);
      this.add(ch, mesh(Geo.box(0.03, 0.006, 0.03, 0.003), Mat.glow('#ffffff')), 0, -0.016, 0.13);
    }
    if (cfg.includes('linie')) {
      this.sensors.linie = new LineSensors(this, ch, { links: { x: 0.028, y: 0, z: 0.155 }, rechts: { x: -0.028, y: 0, z: 0.155 } });
      for (const sx of [0.028, -0.028]) this.add(ch, mesh(Geo.box(0.014, 0.006, 0.014, 0.002), Mat.glow('#ff4d4d')), sx, -0.016, 0.155);
    }
    if (cfg.includes('beruehrung')) {
      const bumper = this.addCollider(ch, { shape: 'box', size: [0.13, 0.016, 0.008], pos: [0, 0.0, 0.178], role: 'bumper' });
      this.add(ch, mesh(Geo.box(0.26, 0.03, 0.014, 0.006), Mat.rubber()), 0, 0.0, 0.178);
      this.sensors.beruehrung = new TouchSensor(this, [bumper, ...(this.clawFingers || []).map((f) => f.part.colliders[0])]);
      this.sensors.beruehrung.ignoreFloor = true;
    }
    if (cfg.includes('kamera')) {
      this.sensors.kamera = new Camera(this, ch, { x: 0, y: 0.2, z: 0.05 }, { x: 0, y: -0.3, z: 1 }, 90, 4);
      this.add(ch, mesh(Geo.cyl(0.008, 0.008, 0.13, 10), dark), 0, 0.13, 0.03);
      this.add(ch, mesh(Geo.box(0.05, 0.035, 0.04, 0.008), dark), 0, 0.2, 0.04);
      this.add(ch, mesh(Geo.cyl(0.012, 0.012, 0.01, 18), Mat.visor()), 0, 0.2, 0.062).rotation.x = Math.PI / 2;
    }
    this.setLed(null);
    for (const m of this.leds) m.material = Mat.glow(this.config.accent);
  }

  frame() {
    const b = this.chassis.body;
    const q = b.rotation();
    const fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    return { p: b.translation(), yaw: Math.atan2(fx, fz) };
  }
  baseBody() { return this.chassis.body; }
  userOriginY() { return 0; }

  /* ---------------- Antrieb ---------------- */

  control(dt) {
    const ch = this.chassis.body;
    for (const side of ['l', 'r']) {
      const w = this.wheels[side];
      const q = qmul(qconj(ch.rotation()), w.part.body.rotation());
      const a = twistAngle(q, { x: 1, y: 0, z: 0 });
      const d = wrapAngle(a - w.last);
      w.last = a;
      w.angle += d;
      this.odo[side] += d * this.R_W;
      const omega = this.drive[side] / this.R_W;
      w.joint.configureMotorVelocity(omega, 3.5 * this.motor.torque);
      this.extraPower = (this.extraPower || 0) * 0.9 + Math.abs(omega) * 0.5;
    }
  }

  setWheels(l, r) { this.drive.l = l; this.drive.r = r; }
  get odoDist() { return (this.odo.l + this.odo.r) / 2; }

  stopMotion() {
    super.stopMotion();
    this.setWheels(0, 0);
  }

  *driveDist(dist) {
    const start = this.odoDist;
    const yaw0 = this.frame().yaw;
    const dir = Math.sign(dist) || 1;
    const vmax = (0.06 + VMAX * this.speed) * dir;
    let v = 0, t = 0;
    for (;;) {
      const dt = yield;
      t += dt;
      const done = (this.odoDist - start) * dir;
      const rest = Math.abs(dist) - done;
      if (rest <= 0.003 || t > 4 + Math.abs(dist) * 12) break;
      const vWant = vmax * clamp(rest / 0.08, 0.15, 1);
      v += clamp(vWant - v, -1.5 * dt, 1.5 * dt);
      const err = wrapAngle(yaw0 - this.frame().yaw);
      const turn = clamp(err * 2.5, -0.4, 0.4) * TRACK / 2;
      this.setWheels(v - turn, v + turn);
    }
    this.setWheels(0, 0);
    yield* this.wait(0.15);
  }

  *turnBy(angle) {
    const f0 = this.frame();
    let turned = 0, last = f0.yaw, t = 0;
    const wmax = (0.6 + 3.2 * this.speed);
    for (;;) {
      const dt = yield;
      t += dt;
      const y = this.frame().yaw;
      turned += wrapAngle(y - last);
      last = y;
      const rest = angle - turned;
      if (Math.abs(rest) < 1.2 * DEG || t > 8) break;
      const w = Math.sign(rest) * Math.min(wmax, Math.max(0.35, Math.abs(rest) * 3.2));
      const v = w * TRACK / 2;
      this.setWheels(-v, v);
    }
    this.setWheels(0, 0);
    yield* this.wait(0.15);
  }

  *driveTo(x, z, stop = 0.02) {
    let t = 0;
    for (;;) {
      const f = this.frame();
      const dx = x - f.p.x, dz = z - f.p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < stop) break;
      const err = wrapAngle(Math.atan2(dx, dz) - f.yaw);
      if (Math.abs(err) > 35 * DEG && dist > 0.05) { yield* this.turnBy(err); continue; }
      const v = (0.06 + VMAX * this.speed) * clamp(dist / 0.1, 0.2, 1) * Math.max(0.2, Math.cos(err));
      const turn = clamp(err * 3, -1.2, 1.2) * TRACK / 2;
      this.setWheels(v - turn, v + turn);
      t += yield;
      if (t > 60) break;
      const f2 = this.frame();
      if (Math.cos(Math.atan2(x - f2.p.x, z - f2.p.z) - f2.yaw) < 0 && Math.hypot(x - f2.p.x, z - f2.p.z) < 0.06) break;
    }
    this.setWheels(0, 0);
    yield* this.wait(0.15);
  }

  cmd_fahre_vor({ strecke }) { return this.run(function* () { yield* this.driveDist(strecke / 100); }, 'fahren'); }
  cmd_fahre_zurueck({ strecke }) { return this.run(function* () { yield* this.driveDist(-strecke / 100); }, 'fahren'); }
  cmd_drehe_dich({ winkel, richtung }) {
    const a = winkel * DEG * (richtung === 'rechts' ? -1 : 1);
    return this.run(function* () { yield* this.turnBy(a); }, 'fahren');
  }
  cmd_fahre_zu({ x, z }) { return this.run(function* () { yield* this.driveTo(-x / 100, z / 100); }, 'fahren'); }
  cmd_fahre_los() {
    for (const t of this.tasks) if (t.channel === 'fahren') this.cancelTask(t);
    const v = 0.06 + VMAX * this.speed;
    this.setWheels(v, v);
    return null;
  }
  cmd_fahre_tempo({ prozent }) {
    for (const t of this.tasks) if (t.channel === 'fahren') this.cancelTask(t);
    const v = VMAX * clamp(prozent, -100, 100) / 100;
    this.setWheels(v, v);
    return null;
  }
  cmd_motoren({ links, rechts }) {
    for (const t of this.tasks) if (t.channel === 'fahren') this.cancelTask(t);
    this.setWheels(VMAX * clamp(links, -100, 100) / 100, VMAX * clamp(rechts, -100, 100) / 100);
    return null;
  }
  cmd_folge_pfad() {
    const path = this.sim.path;
    if (!path || path.length < 2) throw friendly('Es ist noch kein Pfad gezeichnet. Zeichne mit dem Apple Pencil (oder dem Pfad-Werkzeug) eine Linie auf den Boden.');
    return this.run(function* () { for (const p of path) yield* this.driveTo(p.x, p.z, 0.04); }, 'fahren');
  }

  rep_linie({ seite }) { return this.needSensor('linie').read(seite); }

  /* ---------------- Greifen mit der Frontzange ---------------- */

  clawPoint() {
    const f = this.frame();
    return { x: f.p.x + Math.sin(f.yaw) * 0.22, z: f.p.z + Math.cos(f.yaw) * 0.22 };
  }

  cmd_nimm({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.needGripper();
    const self = this;
    return this.run(function* () {
      let hit = cam.find(farbe, { objectsOnly: true });
      for (let i = 0; !hit && i < 7; i++) {
        if (i === 0) self.say('Ich schaue mich um …');
        yield* this.turnBy(50 * DEG);
        hit = cam.find(farbe, { objectsOnly: true });
      }
      if (!hit) throw friendly(`Ich finde nichts in ${String(farbe)}.`);
      const thing = hit.entity;
      const ra = g.release(); yield* this.until(() => ra.done(), 2);
      // Anfahrt: erst auf 30 cm heran, dann ausrichten und langsam einfahren
      let p = thing.body.translation();
      let f = this.frame();
      let d = Math.hypot(p.x - f.p.x, p.z - f.p.z);
      if (d > 0.4) yield* this.driveTo(p.x - (p.x - f.p.x) / d * 0.32, p.z - (p.z - f.p.z) / d * 0.32, 0.03);
      p = thing.body.translation(); f = this.frame();
      yield* this.turnBy(wrapAngle(Math.atan2(p.x - f.p.x, p.z - f.p.z) - f.yaw));
      p = thing.body.translation(); f = this.frame();
      d = Math.hypot(p.x - f.p.x, p.z - f.p.z);
      const sp = this.speed; this.speed = Math.min(sp, 0.35);
      yield* this.driveDist(d - 0.215);
      this.speed = sp;
      const ga = g.grip(); yield* this.until(() => ga.done(), 3);
      if (!g.held) self.warn('Daneben – die Zange hat nichts zu fassen bekommen.');
    }, 'fahren');
  }

  *dropAt(c) {
    const g = this.grippers.main;
    const f = this.frame();
    const d = Math.hypot(c.x - f.p.x, c.z - f.p.z);
    if (d > 0.35) yield* this.driveTo(c.x - (c.x - f.p.x) / d * 0.3, c.z - (c.z - f.p.z) / d * 0.3, 0.03);
    const f2 = this.frame();
    yield* this.turnBy(wrapAngle(Math.atan2(c.x - f2.p.x, c.z - f2.p.z) - f2.yaw));
    const f3 = this.frame();
    yield* this.driveDist(Math.hypot(c.x - f3.p.x, c.z - f3.p.z) - 0.22);
    const a = g.release(); yield* this.until(() => a.done(), 2);
    yield* this.driveDist(-0.15);
  }

  cmd_lege_auf({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.needGripper();
    return this.run(function* () {
      let hit = cam.find(farbe, { exclude: (e) => e === g.held });
      for (let i = 0; !hit && i < 7; i++) { yield* this.turnBy(50 * DEG); hit = cam.find(farbe, { exclude: (e) => e === g.held }); }
      if (!hit) throw friendly(`Ich finde keine Ablage in ${String(farbe)}.`);
      const e = hit.entity;
      yield* this.dropAt(e.isObject ? e.body.translation() : e.center);
    }, 'fahren');
  }
  cmd_lege() {
    const g = this.needGripper();
    return this.run(function* () { const a = g.release(); yield* this.until(() => a.done(), 2); yield* this.driveDist(-0.12); }, 'fahren');
  }
}
