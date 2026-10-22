// Roboterarm mit fünf Achsen (Basis, Schulter, Ellbogen, Handgelenk, Handdrehung) und Greifer.
import * as THREE from 'three';
import { Robot, friendly } from './robot.js';
import { Gripper } from './gripper.js';
import { DistanceSensor, ColorSensor, TouchSensor, Camera } from './sensors.js';
import { Mat, Geo, mesh } from '../render/materials.js';
import { ARM_LENGTHS, GRIPPERS } from './parts.js';
import { qrot, vadd, wrapAngle, clamp, smooth, DEG, RAD, yawOf } from '../core/util.js';

const BASE_H = 0.10;   // Sockelhöhe
const SHOULDER = 0.16; // Schulter über dem Drehturm
const LW = 0.09;       // Handgelenk bis Handfläche

export class Arm extends Robot {
  constructor(sim, config, spawn) {
    super(sim, config, spawn);
    const L = ARM_LENGTHS[this.config.laenge] || ARM_LENGTHS.mittel;
    this.L1 = L.l1; this.L2 = L.l2;
    this.gtype = GRIPPERS[this.config.greifer] ? this.config.greifer : 'zange';
    this.home = { basis: 0, schulter: 5, ellbogen: 85, handgelenk: 90, handdrehung: 0 };
    this.build();
  }

  L(x, y, z) { return vadd(this.spawn, qrot(this.q0, { x, y, z })); }

  build() {
    const shell = this.shell, accent = this.accent, dark = Mat.graphite(), joint = Mat.joint();
    const L1 = this.L1, L2 = this.L2;
    const ms = this.motor.mass;
    const h = this.home;

    // Sockel (fest verschraubt)
    const sockel = this.makePart('sockel', this.L(0, 0, 0), this.q0, { fixed: true, colliders: [{ shape: 'cyl', size: [BASE_H / 2, 0.15], pos: [0, BASE_H / 2, 0] }] });
    this.add(sockel, mesh(Geo.cyl(0.155, 0.165, 0.035, 48), dark), 0, 0.0175, 0);
    this.add(sockel, mesh(Geo.cyl(0.14, 0.15, BASE_H - 0.035, 48), shell), 0, 0.035 + (BASE_H - 0.035) / 2, 0);
    this.addLed(sockel, new THREE.Mesh(Geo.torus(0.148, 0.006, 64), Mat.glow(this.config.accent)), 0, 0.04, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      this.add(sockel, mesh(Geo.cyl(0.008, 0.008, 0.012, 10), Mat.steel()), Math.cos(a) * 0.13, 0.041, Math.sin(a) * 0.13);
    }

    // Drehturm
    const turm = this.chain('turm', sockel, 'basis', { anchor: [0, BASE_H, 0], axis: [0, 1, 0], init: h.basis * DEG, min: -170 * DEG, max: 170 * DEG, force: 45, speed: 1.6, stiffness: 4000, damping: 140, label: 'Basis', home: 0 },
      { colliders: [{ shape: 'cyl', size: [0.06, 0.105], pos: [0, 0.06, 0] }] });
    this.fixMass(turm, 2.4 * ms);
    this.add(turm, mesh(Geo.cyl(0.11, 0.12, 0.12, 48), shell), 0, 0.06, 0);
    this.add(turm, mesh(Geo.cyl(0.07, 0.07, 0.24, 40), joint), 0, SHOULDER, 0).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      this.add(turm, mesh(Geo.box(0.035, 0.15, 0.11, 0.02), shell), s * 0.1, 0.13, 0);
      this.add(turm, mesh(Geo.cyl(0.045, 0.045, 0.01, 32), accent), s * 0.122, SHOULDER, 0).rotation.z = Math.PI / 2;
    }

    // Oberarm
    const ober = this.chain('oberarm', turm, 'schulter', { anchor: [0, SHOULDER, 0], axis: [1, 0, 0], init: h.schulter * DEG, min: -100 * DEG, max: 100 * DEG, force: 75 * (L1 / 0.4), speed: 1.4, stiffness: 4500, damping: 160, label: 'Schulter' },
      { colliders: [{ shape: 'box', size: [0.045, L1 / 2 - 0.03, 0.045], pos: [0, L1 / 2, 0] }] });
    this.fixMass(ober, 1.3 * (L1 / 0.4) * ms);
    this.add(ober, mesh(Geo.box(0.1, L1 - 0.06, 0.1, 0.03), shell), 0, L1 / 2, 0);
    this.add(ober, mesh(Geo.box(0.104, L1 * 0.45, 0.02, 0.008), accent), 0, L1 / 2, 0.045);
    this.add(ober, mesh(Geo.cyl(0.058, 0.058, 0.13, 36), joint), 0, L1, 0).rotation.z = Math.PI / 2;

    // Unterarm
    const unter = this.chain('unterarm', ober, 'ellbogen', { anchor: [0, L1, 0], axis: [1, 0, 0], init: h.ellbogen * DEG, min: -145 * DEG, max: 145 * DEG, force: 42 * (L2 / 0.36), speed: 1.7, stiffness: 3500, damping: 120, label: 'Ellbogen' },
      { colliders: [{ shape: 'box', size: [0.038, L2 / 2 - 0.02, 0.038], pos: [0, L2 / 2, 0] }] });
    this.fixMass(unter, 0.85 * (L2 / 0.36) * ms);
    this.add(unter, mesh(Geo.box(0.082, L2 - 0.03, 0.082, 0.026), shell), 0, L2 / 2, 0);
    this.add(unter, mesh(Geo.cyl(0.044, 0.044, 0.1, 32), joint), 0, L2, 0).rotation.z = Math.PI / 2;

    // Handgelenk
    const gelenk = this.chain('handgelenk', unter, 'handgelenk', { anchor: [0, L2, 0], axis: [1, 0, 0], init: h.handgelenk * DEG, min: -125 * DEG, max: 125 * DEG, force: 16, speed: 2.2, stiffness: 1800, damping: 50, label: 'Handgelenk' },
      { colliders: [{ shape: 'box', size: [0.03, LW / 2 - 0.01, 0.03], pos: [0, LW / 2, 0] }] });
    this.fixMass(gelenk, 0.35 * ms);
    this.add(gelenk, mesh(Geo.cyl(0.034, 0.038, LW, 32), dark), 0, LW / 2, 0);
    this.add(gelenk, mesh(Geo.cyl(0.04, 0.04, 0.012, 32), accent), 0, LW - 0.006, 0);

    // Hand (dreht um die Werkzeugachse)
    const hand = this.chain('hand', gelenk, 'handdrehung', { anchor: [0, LW, 0], axis: [0, 1, 0], init: h.handdrehung * DEG, min: -180 * DEG, max: 180 * DEG, force: 8, speed: 3, stiffness: 600, damping: 18, label: 'Handdrehung' },
      { colliders: [{ shape: 'box', size: [0.08, 0.015, 0.032], pos: [0, 0.015, 0] }] });
    this.fixMass(hand, 0.3);
    this.add(hand, mesh(Geo.box(0.17, 0.03, 0.065, 0.01), dark), 0, 0.015, 0);
    this.buildGripper(hand);

    // Sensoren
    const cfg = this.config.sensoren;
    if (cfg.includes('abstand')) {
      this.sensors.abstand = new DistanceSensor(this, hand, { x: 0, y: 0.03, z: 0.04 }, { x: 0, y: 1, z: 0 }, 2);
      for (const sx of [-0.016, 0.016]) this.add(hand, mesh(Geo.cyl(0.011, 0.011, 0.012, 16), Mat.steel()), sx, 0.034, 0.04);
    }
    if (cfg.includes('farbe')) {
      this.sensors.farbe = new ColorSensor(this, hand, { x: 0, y: 0.031, z: 0 }, { x: 0, y: 1, z: 0 }, 0.3);
      this.add(hand, mesh(Geo.box(0.022, 0.006, 0.022, 0.002), Mat.glow('#ffffff')), 0, 0.033, -0.012);
    }
    if (cfg.includes('kamera')) {
      this.sensors.kamera = new Camera(this, sockel, { x: 0, y: 0.5, z: -0.12 }, { x: 0, y: -0.4, z: 1 }, 360, 2.5);
      const mast = mesh(Geo.cyl(0.012, 0.012, 0.4, 12), dark);
      this.add(sockel, mast, 0, BASE_H + 0.2, -0.17);
      this.add(sockel, mesh(Geo.box(0.06, 0.04, 0.05, 0.01), dark), 0, BASE_H + 0.42, -0.15);
      this.add(sockel, mesh(Geo.cyl(0.014, 0.014, 0.012, 20), Mat.visor()), 0, BASE_H + 0.42, -0.122).rotation.x = Math.PI / 2;
      this.addLed(sockel, mesh(Geo.sphere(0.004, 8), Mat.glow('#ff3b3b')), 0.02, BASE_H + 0.435, -0.124);
    }
    if (cfg.includes('beruehrung')) {
      const cols = this.gtype === 'zange' ? this.fingerParts.map((p) => p.colliders[0]) : [this.cupCollider];
      this.sensors.beruehrung = new TouchSensor(this, cols);
    }
    this.setLed(null);
    this.ledsOn();
  }

  ledsOn() { this.setLed(this.config.accent); this.ledColor = null; }

  buildGripper(hand) {
    const type = this.gtype;
    const info = GRIPPERS[type];
    if (type === 'zange') {
      const fingers = [];
      this.fingerParts = [];
      for (const side of [1, -1]) {
        const x0 = side * 0.068;
        const part = this.chain('finger' + (side > 0 ? 'L' : 'R'), hand, 'finger' + (side > 0 ? '_l' : '_r'),
          { kind: 'pri', anchor: [x0, 0.03, 0], axis: [side, 0, 0], init: 0, min: -0.062, max: 0.0, force: info.force, speed: 0.12, accel: 0.6, stiffness: 2500, damping: 60, hidden: true, motorScaled: false },
          { colliders: [{ shape: 'box', size: [0.008, 0.04, 0.022], pos: [0, 0.04, 0], friction: 1.15 }], angDamp: 1, iters: 6 });
        this.fixMass(part, 0.08);
        this.add(part, mesh(Geo.box(0.018, 0.085, 0.046, 0.005), Mat.graphite()), 0, 0.04, 0);
        this.add(part, mesh(Geo.box(0.004, 0.06, 0.038, 0.002), Mat.rubber()), -side * 0.0095, 0.05, 0);
        this.add(part, mesh(Geo.box(0.02, 0.012, 0.048, 0.004), this.accent), 0, 0.006, 0);
        fingers.push({ servo: this.servos.get('finger' + (side > 0 ? '_l' : '_r')), part });
        this.fingerParts.push(part);
      }
      this.grippers.main = new Gripper(this, { type, palm: hand, fingers, tip: { x: 0, y: 0.085, z: 0 }, force: info.force, closed: -0.062 });
      this.tipLen = 0.085;
    } else if (type === 'sauger') {
      this.cupCollider = this.addCollider(hand, { shape: 'cyl', size: [0.016, 0.026], pos: [0, 0.046, 0], friction: 0.9 });
      this.add(hand, mesh(Geo.cyl(0.012, 0.012, 0.03, 16), Mat.steel()), 0, 0.045, 0);
      const cup = mesh(Geo.cyl(0.028, 0.016, 0.02, 32), Mat.rubber());
      this.add(hand, cup, 0, 0.068, 0);
      this.grippers.main = new Gripper(this, { type, palm: hand, tip: { x: 0, y: 0.078, z: 0 }, force: info.force, cup: this.cupCollider });
      this.tipLen = 0.078;
    } else {
      this.cupCollider = this.addCollider(hand, { shape: 'cyl', size: [0.012, 0.036], pos: [0, 0.042, 0], friction: 0.6 });
      this.add(hand, mesh(Geo.cyl(0.038, 0.038, 0.024, 32), Mat.accent('#b91c1c')), 0, 0.042, 0);
      this.add(hand, mesh(Geo.cyl(0.038, 0.038, 0.006, 32), Mat.steel()), 0, 0.057, 0);
      this.grippers.main = new Gripper(this, { type: 'magnet', palm: hand, tip: { x: 0, y: 0.06, z: 0 }, force: info.force, cup: this.cupCollider });
      this.tipLen = 0.06;
    }
    this.grippers.main.onChange = (what) => { if (this.config.sensoren && what === 'greift') this.setLedTemp && this.setLedTemp(); };
  }

  userOriginY() { return this.spawn.y; }
  frame() { return { p: { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z }, yaw: this.spawn.yaw }; }

  /* ---------------- Kinematik ---------------- */

  // Vorwärtskinematik aus Gelenkwinkeln (rad) → Greifpunkt lokal (m)
  fk(a) {
    const s = a.schulter, e = a.ellbogen, w = a.handgelenk;
    const tool = LW + this.tipLen;
    const r = this.L1 * Math.sin(s) + this.L2 * Math.sin(s + e) + tool * Math.sin(s + e + w);
    const hgt = BASE_H + SHOULDER + this.L1 * Math.cos(s) + this.L2 * Math.cos(s + e) + tool * Math.cos(s + e + w);
    return { x: r * Math.sin(a.basis), y: hgt, z: r * Math.cos(a.basis) };
  }
  currentAngles(useTargets = true) {
    const o = {};
    for (const n of ['basis', 'schulter', 'ellbogen', 'handgelenk', 'handdrehung']) {
      const s = this.servos.get(n);
      o[n] = useTargets ? s.target : s.value();
    }
    return o;
  }

  // Inverse Kinematik: Werkzeug senkrecht nach unten. lokal (m) → Winkel (rad) oder null
  ik(p, prevBasis = 0) {
    const tool = LW + this.tipLen;
    let basis = Math.atan2(p.x, p.z);
    let r = Math.hypot(p.x, p.z);
    // Sehr nah an der Mitte: Basis beibehalten
    if (r < 0.02) basis = prevBasis;
    // auf kürzestem Weg drehen
    if (Math.abs(wrapAngle(basis - prevBasis)) > Math.PI * 0.75 && r < 0.25) { basis = wrapAngle(basis + Math.PI); r = -r; }
    if (Math.abs(basis) > 170 * DEG) {
      basis = wrapAngle(basis + Math.PI); r = -r;
      if (Math.abs(basis) > 170 * DEG) return null;
    }
    const wr = r, wh = p.y + tool - (BASE_H + SHOULDER);
    const d = Math.hypot(wr, wh);
    const L1 = this.L1, L2 = this.L2;
    if (d > L1 + L2 - 0.002 || d < Math.abs(L1 - L2) + 0.01) return null;
    const c = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const phi = Math.atan2(wr, wh);
    const sols = [];
    for (const sgn of [1, -1]) {
      const e = sgn * Math.acos(c);
      const beta = Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e));
      const s = phi - beta;
      const w = wrapAngle(Math.PI - s - e);
      sols.push({ basis, schulter: s, ellbogen: e, handgelenk: w });
    }
    const lim = (n, v) => { const sv = this.servos.get(n); return v >= sv.min - 1e-6 && v <= sv.max + 1e-6; };
    const ok = sols.filter((q) => lim('schulter', q.schulter) && lim('ellbogen', q.ellbogen) && lim('handgelenk', q.handgelenk));
    if (!ok.length) return null;
    const cur = this.currentAngles();
    ok.sort((a, b) => (Math.abs(a.schulter - cur.schulter) + Math.abs(a.ellbogen - cur.ellbogen)) - (Math.abs(b.schulter - cur.schulter) + Math.abs(b.ellbogen - cur.ellbogen)));
    return ok[0];
  }

  reach() { return this.L1 + this.L2 + LW + this.tipLen; }

  userToLocal(u) { return { x: -u.x / 100, y: u.y / 100, z: u.z / 100 }; }
  localToWorld(l) { return this.L(l.x, l.y, l.z); }
  worldToLocal(w) {
    const dx = w.x - this.spawn.x, dz = w.z - this.spawn.z;
    const c = Math.cos(-this.spawn.yaw), s = Math.sin(-this.spawn.yaw);
    return { x: dx * c + dz * s, y: w.y - this.spawn.y, z: -dx * s + dz * c };
  }

  unreachable(p) {
    const r = Math.round(Math.hypot(p.x, p.z) * 100), hcm = Math.round(p.y * 100);
    return friendly(`Den Punkt (${Math.round(-p.x * 100)}, ${hcm}, ${Math.round(p.z * 100)}) erreicht der Greifer nicht – er ist ${r} cm von der Mitte entfernt. Mit dem Greifer senkrecht nach unten schafft dieser Arm etwa ${Math.round((this.L1 + this.L2) * 100 - 5)} cm. Probier einen näheren Punkt oder baue längere Arme.`);
  }

  // Gerade Bahn im Raum (wie eine LIN-Bewegung in der Industrie)
  *linear(to, opts = {}) {
    const from = this.fk(this.currentAngles());
    const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const v = 0.08 + 0.5 * this.speed * (opts.speedFactor || 1);
    const T = Math.max(0.25, dist / v);
    const endQ = this.ik(to, this.servos.get('basis').target);
    if (!endQ) throw this.unreachable(to);
    const roll = opts.roll;
    const rollFrom = this.servos.get('handdrehung').target;
    let t = 0, prevBasis = this.servos.get('basis').target;
    let fallback = false;
    while (t < T) {
      t += yield;
      const k = smooth(clamp(t / T, 0, 1));
      const p = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k };
      const q = this.ik(p, prevBasis);
      if (!q) { fallback = true; break; }
      prevBasis = q.basis;
      for (const n of ['basis', 'schulter', 'ellbogen', 'handgelenk']) this.servos.get(n).set(q[n], 2);
      if (roll != null) this.servos.get('handdrehung').set(rollFrom + (roll - rollFrom) * k, 2);
    }
    if (fallback) {
      const sc = this.syncSpeeds(endQ);
      for (const n of ['basis', 'schulter', 'ellbogen', 'handgelenk']) this.servos.get(n).set(endQ[n], sc[n]);
      if (roll != null) this.servos.get('handdrehung').set(roll, this.speed);
    }
    return yield* this.waitServos(['basis', 'schulter', 'ellbogen', 'handgelenk', 'handdrehung'], 8);
  }

  // Gelenkgeschwindigkeiten so abstimmen, dass alle gleichzeitig ankommen
  syncSpeeds(q) {
    let T = 0;
    const out = {};
    for (const n of Object.keys(q)) {
      const s = this.servos.get(n);
      T = Math.max(T, Math.abs(q[n] - s.target) / (s.maxSpeed * this.speed));
    }
    for (const n of Object.keys(q)) {
      const s = this.servos.get(n);
      const d = Math.abs(q[n] - s.target);
      out[n] = T > 0 ? Math.max(0.05, d / (s.maxSpeed * T)) : this.speed;
    }
    return out;
  }

  /* ---------------- Befehle ---------------- */

  servoOrFail(name) {
    const s = this.servos.get(name);
    if (!s || s.hidden) throw friendly(`Ein Gelenk „${name}“ hat der Arm nicht. Es gibt: ${this.jointNames().join(', ')}.`);
    return s;
  }

  cmd_drehe_auf({ gelenk, winkel }) {
    const s = this.servoOrFail(gelenk);
    if (s.setDeg(winkel, this.speed)) this.warn(`${s.label}: ${Math.round(winkel)}° geht nicht – erlaubt sind ${Math.round(s.min * RAD)}° bis ${Math.round(s.max * RAD)}°.`);
    return this.run(function* () { yield* this.waitServos([gelenk]); }, 'gelenk:' + gelenk);
  }
  cmd_drehe_um({ gelenk, winkel }) {
    const s = this.servoOrFail(gelenk);
    return this.cmd_drehe_auf({ gelenk, winkel: s.target * RAD + winkel });
  }
  cmd_grundstellung() {
    const t = {};
    for (const [n, v] of Object.entries(this.home)) t[n] = v;
    return this.run(function* () { yield* this.moveTo(t, this.speed); }, 'arm');
  }
  cmd_bewege_greifer({ x, y, z }) {
    const p = this.userToLocal({ x, y, z });
    if (!this.ik(p, this.servos.get('basis').target)) throw this.unreachable(p);
    return this.run(function* () { yield* this.linear(p); }, 'arm');
  }
  cmd_bewege_greifer_um({ x, y, z }) {
    const cur = this.fk(this.currentAngles());
    const p = { x: cur.x - x / 100, y: cur.y + y / 100, z: cur.z + z / 100 };
    if (!this.ik(p, this.servos.get('basis').target)) throw this.unreachable(p);
    return this.run(function* () { yield* this.linear(p); }, 'arm');
  }

  // Handdrehung so wählen, dass die Finger an den Würfelseiten anliegen
  rollFor(thing, basis) {
    const qy = yawOf(thing.body.rotation()) - this.spawn.yaw;
    let rho = wrapAngle(basis - qy);
    const quarter = Math.PI / 2;
    rho = rho - Math.round(rho / quarter) * quarter;
    return rho;
  }

  graspHeight(thing) {
    const p = this.worldToLocal(thing.body.translation());
    if (this.gtype === 'zange') return Math.max(p.y, 0.028);
    return p.y + thing.halfHeight;
  }

  cmd_nimm({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.needGripper();
    const hit = cam.find(farbe, { objectsOnly: true, skipSorted: true });
    if (!hit) throw friendly(`Ich sehe nichts in ${String(farbe)}. Liegt es im Blickfeld der Kamera und innerhalb der Reichweite?`);
    const thing = hit.entity;
    const self = this;
    return this.run(function* () {
      if (g.held) { yield* this.placeAt(this.fk(this.currentAngles())); }
      yield* this.until(() => true, 0);
      const act = g.release(); yield* this.until(() => act.done(), 2);
      let p = this.worldToLocal(thing.body.translation());
      const above = { x: p.x, y: p.y + thing.halfHeight + 0.12, z: p.z };
      if (!this.ik(above, this.servos.get('basis').target) && !this.ik({ ...above, y: p.y + 0.06 }, 0)) throw this.unreachable(p);
      const basisAt = Math.atan2(p.x, p.z);
      const roll = this.gtype === 'zange' ? this.rollFor(thing, basisAt) : this.servos.get('handdrehung').target;
      yield* this.linear(this.ik(above, this.servos.get('basis').target) ? above : { ...above, y: p.y + 0.06 }, { roll });
      // Position nachführen (könnte gerollt sein)
      p = this.worldToLocal(thing.body.translation());
      yield* this.linear({ x: p.x, y: this.graspHeight(thing), z: p.z }, { speedFactor: 0.6 });
      const ga = g.grip(); yield* this.until(() => ga.done(), 3);
      if (!g.held) self.warn('Daneben gegriffen – ich habe nichts zu fassen bekommen.');
      const up = this.fk(this.currentAngles());
      yield* this.linear({ x: up.x, y: Math.max(up.y + 0.12, thing.halfHeight * 2 + 0.1), z: up.z }, { speedFactor: 0.7 });
    }, 'arm');
  }

  *placeAt(p, release = true) {
    const g = this.grippers.main;
    const held = g.held;
    const half = held ? held.halfHeight : 0.03;
    const above = { x: p.x, y: p.y + half + 0.12, z: p.z };
    if (!this.ik(above, this.servos.get('basis').target)) throw this.unreachable(above);
    yield* this.linear(above);
    const target = { x: p.x, y: (this.gtype === 'zange' ? p.y + half : p.y + half * 2) + 0.006, z: p.z };
    if (!this.ik(target, this.servos.get('basis').target)) throw this.unreachable(target);
    yield* this.linear(target, { speedFactor: 0.5 });
    if (release) {
      const a = g.release(); yield* this.until(() => a.done(), 2);
      yield* this.wait(0.1);
      yield* this.linear(above, { speedFactor: 0.7 });
    }
  }

  surfaceBelow(local) {
    const w = this.localToWorld({ x: local.x, y: 0, z: local.z });
    let top = 0;
    for (const e of this.sim.entities) {
      if (e.surfaceAt) { const s = e.surfaceAt(w.x, w.z); if (s != null) top = Math.max(top, s); }
      if (e.kind === 'band' && e.toLocal) { const l = e.toLocal(w.x, w.z); if (Math.abs(l.x) <= e.L / 2 && Math.abs(l.z) <= e.W / 2) top = Math.max(top, e.H); }
    }
    return top - this.spawn.y;
  }

  cmd_lege_bei({ x, y, z }) {
    this.needGripper();
    const p = this.userToLocal({ x, y, z });
    return this.run(function* () { yield* this.placeAt(p); }, 'arm');
  }
  cmd_lege_auf({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.needGripper();
    const hit = cam.find(farbe, { exclude: (e) => e === g.held, placesFirst: true });
    if (!hit) throw friendly(`Ich finde keine Ablage in ${String(farbe)}.`);
    const e = hit.entity;
    const c = e.isObject ? e.body.translation() : (e.freeSpot && e.freeSpot(g.held)) || e.center;
    const l = this.worldToLocal(c);
    let y;
    if (e.isObject) y = l.y + e.halfHeight;
    else if (e.kind === 'kiste') y = this.surfaceBelow(l) + 0.012 + 0.02;
    else y = this.surfaceBelow(l);
    return this.run(function* () { yield* this.placeAt({ x: l.x, y, z: l.z }); }, 'arm');
  }
  cmd_lege() {
    this.needGripper();
    const cur = this.fk(this.currentAngles());
    const y = this.surfaceBelow(cur);
    return this.run(function* () { yield* this.placeAt({ x: cur.x, y, z: cur.z }); }, 'arm');
  }
  cmd_wirf() {
    const g = this.needGripper();
    return this.run(function* () {
      yield* this.moveTo({ schulter: -35, ellbogen: 40, handgelenk: 40 }, 0.6);
      const sh = this.servos.get('schulter'), el = this.servos.get('ellbogen');
      sh.set(60 * DEG, 2); el.set(10 * DEG, 2);
      yield* this.until(() => sh.value() > 5 * DEG, 2);
      g.release();
      yield* this.waitServos(['schulter', 'ellbogen']);
    }, 'arm');
  }
}
