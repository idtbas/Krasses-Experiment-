// Grundklasse aller Roboter: baut Gliederketten aus Starrkörpern und Gelenken, verwaltet
// Servos, Greifer, Sensoren, Akku, Leuchten, Sprechblasen und laufende Aufgaben.
import * as THREE from 'three';
import { Entity } from '../sim/sim.js';
import { Servo } from './servo.js';
import { Mat } from '../render/materials.js';
import { COLORS } from '../lang/commands.js';
import { MOTORS, BATTERIES, withDefaults } from './parts.js';
import { qmul, qaxis, qrot, qyaw, qconj, yawOf, upOf, vadd, clamp, DEG, RAD, fmtNum } from '../core/util.js';

export const friendly = (msg) => Object.assign(new Error(msg), { friendly: true });

let robotNames = 0;

export class Robot extends Entity {
  constructor(sim, config, spawn = {}) {
    super(sim);
    this.isRobot = true;
    this.config = withDefaults(config);
    this.type = this.config.type;
    this.name = this.config.name || 'Roboter ' + (++robotNames);
    this.spawn = { x: spawn.x || 0, y: spawn.y || 0, z: spawn.z || 0, yaw: spawn.yaw || 0 };
    this.index = sim.robotSeq++;
    this.groups = sim.physics.groupsRobot(this.index);
    this.rayGroups = sim.physics.rayGroupsFor(this.index);
    this.servos = new Map();
    this.parts = new Map(); // Gliedname → { body, q0 }
    this.sensors = {};
    this.grippers = {};
    this.leds = [];
    this.tasks = [];
    this.speed = 0.6;
    this.motor = MOTORS[this.config.motor] || MOTORS.standard;
    this.motorScale = this.motor.speed;
    this.battery = BATTERIES[this.config.akku] || BATTERIES.standard;
    this.energy = 0;
    this.status = 'bereit';
    this.speech = null;
    this.ledColor = null;
    this.warnings = [];
    this.selected = false;
    this.q0 = qyaw(this.spawn.yaw);
  }

  get shell() { return Mat.shell(this.config.shell); }
  get accent() { return Mat.accent(this.config.accent); }

  /* ---------------- Aufbau ---------------- */

  // Ein Glied der Kette anlegen. pose: Weltposition und -rotation
  makePart(name, pos, rot, opts = {}) {
    const R = this.R;
    const desc = (opts.fixed ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic())
      .setTranslation(pos.x, pos.y, pos.z).setRotation(rot)
      .setCanSleep(false).setAngularDamping(opts.angDamp ?? 0.3).setLinearDamping(opts.linDamp ?? 0.02)
      .setAdditionalSolverIterations(opts.iters ?? 4);
    const body = this.addBody(desc);
    const group = new THREE.Group();
    this.link(body, group);
    const part = { name, body, group, pos, rot, colliders: [] };
    this.parts.set(name, part);
    if (opts.colliders) for (const c of opts.colliders) this.addCollider(part, c);
    if (opts.mass != null) this.fixMass(part, opts.mass);
    return part;
  }

  addCollider(part, c) {
    const R = this.R;
    let d;
    switch (c.shape) {
      case 'box': d = c.r ? R.ColliderDesc.roundCuboid(c.size[0] - c.r, c.size[1] - c.r, c.size[2] - c.r, c.r) : R.ColliderDesc.cuboid(...c.size); break;
      case 'cyl': d = R.ColliderDesc.cylinder(c.size[0], c.size[1]); break; // halbe Höhe, Radius
      case 'ball': d = R.ColliderDesc.ball(c.size[0]); break;
      case 'capsule': d = R.ColliderDesc.capsule(c.size[0], c.size[1]); break;
      default: throw new Error('Form ' + c.shape);
    }
    if (c.pos) d.setTranslation(...c.pos);
    if (c.rot) d.setRotation(c.rot);
    d.setFriction(c.friction ?? 0.7).setRestitution(0.05).setDensity(c.density ?? 400);
    d.setCollisionGroups(c.groups ?? this.groups);
    if (c.sensor) d.setSensor(true);
    const col = this.collider(d, part.body, { kind: 'robot', robot: this, part: part.name, role: c.role, color: c.color });
    part.colliders.push(col);
    return col;
  }

  // Masse eines Glieds festlegen (Trägheit aus der Form)
  fixMass(part, mass) {
    const cols = part.colliders;
    if (!cols.length) { part.body.setAdditionalMass(mass, true); return; }
    let total = 0;
    for (const c of cols) total += c.mass();
    const k = total > 0 ? mass / total : 1;
    for (const c of cols) c.setMass(Math.max(0.001, c.mass() * k));
  }

  // Kleine Zwischenglieder bekommen eine künstlich größere Trägheit – sonst kommt der Gelenklöser
  // bei sehr ungleichen Massen ins Schwimmen
  setInertia(part, mass, inertia) {
    for (const c of part.colliders) c.setMass(0.001);
    part.body.setAdditionalMassProperties(mass, { x: 0, y: 0, z: 0 }, { x: inertia, y: inertia, z: inertia }, { x: 0, y: 0, z: 0, w: 1 }, true);
  }

  /*
   * Gelenk zwischen zwei Gliedern. anchor: Gelenkpunkt im Rahmen von parent.
   * Das Kind liegt mit seinem Ursprung im Gelenkpunkt.
   */
  joint(name, parent, child, o) {
    const R = this.R;
    let jd;
    const a1 = { x: o.anchor[0], y: o.anchor[1], z: o.anchor[2] };
    const axis = { x: o.axis[0], y: o.axis[1], z: o.axis[2] };
    if (o.kind === 'pri') {
      jd = R.JointData.prismatic(a1, { x: 0, y: 0, z: 0 }, axis);
    } else {
      jd = R.JointData.revolute(a1, { x: 0, y: 0, z: 0 }, axis);
    }
    if (o.min != null) { jd.limitsEnabled = true; jd.limits = [o.min, o.max]; }
    const j = this.world.createImpulseJoint(jd, parent.body, child.body, true);
    j.setContactsEnabled(false);
    j.configureMotorModel(R.MotorModel.ForceBased);
    const force = (o.force ?? 20) * (o.motorScaled === false ? 1 : this.motor.torque);
    j.setMotorMaxForce(force);
    const s = new Servo(this, { ...o, name, joint: j, b1: parent.body, b2: child.body, axis, anchor1: a1, force, init: o.init ?? 0 });
    s.label = o.label || name;
    this.servos.set(name, s);
    return s;
  }

  // Pose eines Kindes aus Elternpose, Gelenkpunkt, Achse und Winkel
  childPose(parentPart, anchor, axis, angle) {
    const p = vadd(parentPart.pos, qrot(parentPart.rot, { x: anchor[0], y: anchor[1], z: anchor[2] }));
    const r = qmul(parentPart.rot, qaxis({ x: axis[0], y: axis[1], z: axis[2] }, angle));
    return { pos: p, rot: r };
  }

  // Kette in einem Schritt: Glied + Gelenk
  chain(name, parent, jointName, jo, partOpts) {
    const pose = jo.kind === 'pri'
      ? { pos: vadd(parent.pos, qrot(parent.rot, { x: jo.anchor[0] + jo.axis[0] * (jo.init || 0), y: jo.anchor[1] + jo.axis[1] * (jo.init || 0), z: jo.anchor[2] + jo.axis[2] * (jo.init || 0) })), rot: parent.rot }
      : this.childPose(parent, jo.anchor, jo.axis, jo.init || 0);
    const part = this.makePart(name, pose.pos, pose.rot, partOpts);
    this.joint(jointName, parent, part, jo);
    return part;
  }

  // sichtbares Teil an ein Glied hängen
  add(part, obj, x = 0, y = 0, z = 0) {
    obj.position.set(x, y, z);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.robot = this; } });
    part.group.add(obj);
    return obj;
  }

  addLed(part, obj, x, y, z) {
    this.add(part, obj, x, y, z);
    this.leds.push(obj);
    obj.material = Mat.glow(this.config.accent);
    return obj;
  }

  /* ---------------- Ablauf ---------------- */

  update(dt) {
    if (this.status === 'akku leer') { for (const s of this.servos.values()) { s.limp = true; s.apply(); } return; }
    // Aufgaben (Bewegungsabläufe) fortsetzen
    for (const t of this.tasks) {
      if (t.done) continue;
      try {
        const r = t.gen.next(dt);
        if (r.done) t.done = true;
      } catch (e) {
        t.done = true;
        t.error = e && e.friendly ? e.message : 'Fehler im Bewegungsablauf: ' + (e && e.message);
        if (!(e && e.friendly)) console.error(e);
      }
    }
    if (this.tasks.length > 16) this.tasks = this.tasks.filter((t) => !t.done);
    this.control(dt);
    for (const s of this.servos.values()) s.update(dt);
    for (const g of Object.values(this.grippers)) g.update(dt);
    this.drainBattery(dt);
  }

  control() { /* von Unterklassen überschrieben */ }

  post(dt) {
    for (const g of Object.values(this.grippers)) g.post(dt);
    for (const s of Object.values(this.sensors)) if (s.update) s.update(dt);
  }

  drainBattery(dt) {
    if (!isFinite(this.battery.wh)) return;
    let p = 3; // Grundverbrauch in Watt
    for (const s of this.servos.values()) p += s.power * 1.4;
    p += this.extraPower || 0;
    this.energy += p * dt;
    if (this.energy >= this.battery.wh * 3600) {
      this.energy = this.battery.wh * 3600;
      if (this.status !== 'akku leer') { this.status = 'akku leer'; this.warn('Der Akku ist leer – alle Motoren sind aus.'); this.say('Akku leer …'); }
    }
  }
  get batteryPct() { return isFinite(this.battery.wh) ? clamp(100 * (1 - this.energy / (this.battery.wh * 3600)), 0, 100) : 100; }

  // Aufgabe starten. channel: gleiche Kanäle verdrängen sich (z. B. „fahren“)
  run(genFn, channel) {
    if (channel) for (const t of this.tasks) if (!t.done && t.channel === channel) this.cancelTask(t);
    const task = { done: false, error: null, channel, gen: null };
    task.gen = genFn.call(this, task);
    this.tasks.push(task);
    return {
      done: () => task.done,
      cancel: () => this.cancelTask(task),
      get error() { return task.error; },
    };
  }
  cancelTask(t) {
    if (t.done) return;
    t.done = true;
    try { t.gen.return(); } catch { /* egal */ }
    if (t.onCancel) t.onCancel();
  }

  // Warte-Helfer für Aufgaben
  *wait(sec) { let t = 0; while (t < sec) t += yield; }
  *until(pred, timeout = 30) { let t = 0; while (!pred()) { t += yield; if (t > timeout) return false; } return true; }
  *waitServos(names, timeout = 12, quiet = false) {
    const list = names.map((n) => this.servos.get(n)).filter(Boolean);
    let t = 0, stall = 0;
    for (;;) {
      if (list.every((s) => s.reached())) return true;
      const dt = yield;
      t += dt;
      if (list.every((s) => !s.moving)) stall += dt;
      if (stall > 0.9 || t > timeout) {
        const stuck = list.filter((s) => !s.reached()).map((s) => s.label);
        if (stuck.length && !quiet) this.warn(`${stuck.join(', ')} ${stuck.length > 1 ? 'kommen' : 'kommt'} nicht ganz an – zu schwer, blockiert oder zu schwacher Motor?`);
        return false;
      }
    }
  }
  // mehrere Servos gleichzeitig auf Ziele (Grad) fahren
  *moveTo(targets, speed = this.speed, wait = true) {
    for (const [n, deg] of Object.entries(targets)) {
      const s = this.servos.get(n);
      if (s) s.setDeg(deg, speed);
    }
    if (wait) return yield* this.waitServos(Object.keys(targets));
    return true;
  }

  stopMotion() {
    for (const t of this.tasks) this.cancelTask(t);
    this.tasks = [];
    for (const s of this.servos.values()) if (!s.hidden || s.holdOnStop) s.freeze();
    this.onStop && this.onStop();
  }

  // Zurücksetzen der Laufzeitwerte (nicht der Physik)
  resetRuntime() {
    this.stopMotion();
    this.speed = 0.6;
    this.speech = null;
    this.setLed(null);
    this.warnings = [];
    this.energy = 0;
    if (this.status !== 'umgefallen') this.status = 'bereit';
    for (const g of Object.values(this.grippers)) g.strength = 0.8;
  }

  /* ---------------- Ausgaben ---------------- */

  say(text) {
    this.speech = { text: String(text), t: this.sim.time, until: this.sim.time + 2.2 + String(text).length * 0.06 };
    if (this.onSay) this.onSay(this, String(text));
  }
  warn(msg) {
    const last = this.warnings[this.warnings.length - 1];
    if (last && last.msg === msg && this.sim.time - last.t < 3) return;
    this.warnings.push({ msg, t: this.sim.time });
    if (this.onWarn) this.onWarn(this, msg);
  }
  setLed(color) {
    this.ledColor = color;
    const hex = color ? COLORS[color] || color : null;
    for (const m of this.leds) m.material = hex ? Mat.glow(hex) : Mat.plain('#1d2027', 0.5);
  }

  /* ---------------- Koordinaten ---------------- */

  // Bezugsrahmen des Roboters (Position + Gierwinkel)
  frame() {
    const b = this.baseBody();
    const p = b.translation();
    return { p, yaw: yawOf(b.rotation()) };
  }
  baseBody() { return this.parts.values().next().value.body; }

  // Welt (m) → Roboter-Sicht in cm (x rechts, y hoch, z vor)
  toUser(w, f = this.frame()) {
    const dx = w.x - f.p.x, dz = w.z - f.p.z;
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return { x: -lx * 100, y: (w.y - this.userOriginY(f)) * 100, z: lz * 100 };
  }
  fromUser(u, f = this.frame()) {
    const lx = -u.x / 100, lz = u.z / 100;
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return { x: f.p.x + lx * c + lz * s, y: this.userOriginY(f) + u.y / 100, z: f.p.z - lx * s + lz * c };
  }
  userOriginY() { return this.spawn.y; }

  /* ---------------- Gemeinsame Befehle ---------------- */

  needGripper(side) {
    const g = side ? this.grippers[side] : this.grippers.main || this.grippers.rechts || Object.values(this.grippers)[0];
    if (!g) throw friendly('Dieser Roboter hat keinen Greifer. Baue im Konfigurator einen an.');
    return g;
  }
  needSensor(kind) {
    const s = this.sensors[kind];
    if (!s) {
      const names = { abstand: 'Abstandssensor', farbe: 'Farbsensor', kamera: 'Kamera', beruehrung: 'Berührungssensor', linie: 'Liniensensoren' };
      throw friendly(`Dafür braucht dein Roboter einen ${names[kind] || kind}. Füge ihn im Konfigurator (Bauen) hinzu.`);
    }
    return s;
  }

  cmd_tempo({ prozent }) { this.speed = clamp(prozent / 100, 0.01, 1); }
  cmd_greifkraft({ prozent }) { for (const g of Object.values(this.grippers)) g.strength = clamp(prozent / 100, 0.01, 1); }
  cmd_greife() { const g = this.needGripper(); return g.grip(); }
  cmd_lass_los() {
    const gs = Object.values(this.grippers);
    if (!gs.length) throw friendly('Dieser Roboter hat keinen Greifer.');
    const acts = gs.map((g) => g.release());
    return { done: () => acts.every((a) => !a || a.done()), cancel: () => {} };
  }
  cmd_sage({ text }, show) { this.say(show ? show(text) : String(text)); }
  cmd_leuchte({ farbe }) { this.setLed(String(farbe).toLowerCase()); }
  cmd_leuchte_aus() { this.setLed(null); }
  cmd_stopp() { this.stopMotion(); }

  rep_abstand() { return this.needSensor('abstand').read(); }
  rep_farbe() { return this.needSensor('farbe').read(); }
  rep_helligkeit() { const s = this.sensors.linie || this.sensors.farbe; if (!s) this.needSensor('farbe'); return s.light(); }
  rep_beruehrt() { return this.needSensor('beruehrung').read(); }
  rep_haelt() { return Object.values(this.grippers).some((g) => !!g.held); }
  rep_kraft() { return Math.round(Object.values(this.grippers).reduce((m, g) => Math.max(m, g.force), 0) * 10) / 10; }
  rep_gewicht() { const g = Object.values(this.grippers).find((x) => x.held); return g ? Math.round(g.held.mass * 1000) : 0; }
  rep_neigung() { const up = upOf(this.baseBody().rotation()); return Math.round(Math.acos(clamp(up.y, -1, 1)) * RAD * 10) / 10; }
  rep_kompass() { let d = -this.frame().yaw * RAD; d = ((d % 360) + 360) % 360; return Math.round(d * 10) / 10; }
  rep_position({ achse }) {
    const p = this.baseBody().translation();
    if (achse === 'x') return Math.round(-p.x * 1000) / 10;
    if (achse === 'y') return Math.round(p.y * 1000) / 10;
    return Math.round(p.z * 1000) / 10;
  }
  rep_winkel({ gelenk }) {
    const s = this.servos.get(gelenk);
    if (!s || s.hidden) throw friendly(`Ein Gelenk „${gelenk}“ hat dieser Roboter nicht.`);
    return Math.round(s.display * 10) / 10;
  }
  rep_sieht({ farbe }) { return !!this.needSensor('kamera').find(farbe); }
  rep_richtung_zu({ farbe }) { const h = this.needSensor('kamera').find(farbe); return h ? Math.round(h.bearing * 10) / 10 : 0; }
  rep_entfernung_zu({ farbe }) { const h = this.needSensor('kamera').find(farbe); return h ? Math.round(h.dist * 1000) / 10 : 999; }
  rep_akku() { return Math.round(this.batteryPct); }
  rep_umgefallen() { return this.status === 'umgefallen'; }

  // Datenblatt
  specs() {
    let mass = 0;
    for (const p of this.parts.values()) if (p.body.isDynamic()) mass += p.body.mass();
    return { mass, joints: [...this.servos.values()].filter((s) => !s.hidden).length };
  }

  jointNames() { return [...this.servos.values()].filter((s) => !s.hidden).map((s) => s.name); }

  describeJoint(name) { const s = this.servos.get(name); return s ? `${s.label}: ${fmtNum(s.display, 0)}°` : ''; }
}

export { DEG, RAD, qyaw, qconj, qmul, qrot };
