// Grundklasse aller Roboter: baut Gliederketten aus Starrkörpern und Gelenken, verwaltet Antriebe
// (je Achsgruppe), Werkzeuge, Module an Steckplätzen, Energie, Temperaturen, Sicherheitsfunktionen,
// Signalgeber, Meldungen und laufende Bewegungsaufgaben.
import * as THREE from 'three';
import { Entity } from '../sim/sim.js';
import { Servo } from './servo.js';
import { Mat, optimizeGroup } from '../render/materials.js';
import { COLORS, NEED_TEXT } from '../lang/commands.js';
import { DRIVES, DRIVE_GROUPS, BATTERIES, CONTROLLERS, RADIOS, ANTENNAS, MODULES, TOOLS, withDefaults, computeLoad, idlePower } from './parts.js';
import { Dev, setLit } from './devices3d.js';
import { DistanceSensor, ColorSensor, Camera, Lidar, Radar, ThermalCam, RfidReader, CodeScanner, ForceTorque, worldPose } from './sensors.js';
import { qmul, qaxis, qrot, qyaw, qconj, yawOf, upOf, vadd, clamp, DEG, RAD, fmtNum } from '../core/util.js';

export const friendly = (msg) => Object.assign(new Error(msg), { friendly: true });

let robotNames = 0;

const STACK_COLORS = { rot: 'rot', gelb: 'gelb', orange: 'gelb', grün: 'grün', blau: 'blau', türkis: 'blau', weiß: 'grün' };
export const needText = (k) => NEED_TEXT[k] || k;

export class Robot extends Entity {
  constructor(sim, config, spawn = {}) {
    super(sim);
    this.isRobot = true;
    this.config = withDefaults(config);
    const c = this.config;
    this.type = c.type;
    this.name = c.name || 'Roboter ' + (++robotNames);
    this.spawn = { x: spawn.x || 0, y: spawn.y || 0, z: spawn.z || 0, yaw: spawn.yaw || 0 };
    this.index = sim.robotSeq++;
    this.groups = sim.physics.groupsRobot(this.index);
    this.rayGroups = sim.physics.rayGroupsFor(this.index);
    this.servos = new Map();
    this.parts = new Map(); // Gliedname → { body, q0 }
    this.sensors = {};
    this.grippers = {};
    this.devices = {};
    this.leds = [];
    this.tasks = [];
    this.speed = 0.6;
    this.drives = {};
    for (const g of Object.keys(DRIVE_GROUPS[this.type])) this.drives[g] = DRIVES[c.antrieb[g]];
    this.tool = TOOLS[c.werkzeug];
    this.battery = BATTERIES[c.akku];
    this.controller = CONTROLLERS[c.steuerung];
    this.radio = RADIOS[c.funk];
    this.antenna = ANTENNAS[c.antenne];
    const load = computeLoad(c);
    this.computeScale = load.ratio > 1 ? 1 / load.ratio : 1;
    this.idleW = idlePower(c);
    this.energy = 0;
    this.status = 'bereit';
    this.speech = null;
    this.ledColor = null;
    this.warnings = [];
    this.selected = false;
    this.holds = new Set();
    this.stack = null;
    this.floodOn = false;
    this.q0 = qyaw(this.spawn.yaw);
  }

  get shell() { return Mat.paint(this.config.lack); }
  get accent() { return Mat.anodized(); }
  get paused() { return this.holds.size > 0; }

  // Faktoren eines Antriebs relativ zum Referenzantrieb seiner Achsgruppe
  rel(group) {
    const info = DRIVE_GROUPS[this.type][group];
    if (!info) return { torque: 1, speed: 1, mass: 1, stiff: 1, eff: 0.85 };
    const d = this.drives[group], r = DRIVES[info.ref];
    return { torque: d.torque / r.torque, speed: d.speed / r.speed, mass: d.mass / r.mass, stiff: d.stiff / r.stiff, eff: d.eff };
  }

  /* ---------------- Aufbau ---------------- */

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

  fixMass(part, mass) {
    const cols = part.colliders;
    if (!cols.length) { part.body.setAdditionalMass(mass, true); return; }
    let total = 0;
    for (const c of cols) total += c.mass();
    const k = total > 0 ? mass / total : 1;
    for (const c of cols) c.setMass(Math.max(0.001, c.mass() * k));
  }

  setInertia(part, mass, inertia) {
    for (const c of part.colliders) c.setMass(0.001);
    part.body.setAdditionalMassProperties(mass, { x: 0, y: 0, z: 0 }, { x: inertia, y: inertia, z: inertia }, { x: 0, y: 0, z: 0, w: 1 }, true);
  }

  /*
   * Gelenk zwischen zwei Gliedern. anchor: Gelenkpunkt im Rahmen von parent.
   * o.group: Achsgruppe des Antriebs (bestimmt Moment, Tempo, Steifigkeit, Wirkungsgrad).
   */
  joint(name, parent, child, o) {
    const R = this.R;
    let jd;
    const a1 = { x: o.anchor[0], y: o.anchor[1], z: o.anchor[2] };
    const axis = { x: o.axis[0], y: o.axis[1], z: o.axis[2] };
    if (o.kind === 'pri') jd = R.JointData.prismatic(a1, { x: 0, y: 0, z: 0 }, axis);
    else jd = R.JointData.revolute(a1, { x: 0, y: 0, z: 0 }, axis);
    if (o.min != null) { jd.limitsEnabled = true; jd.limits = [o.min, o.max]; }
    const j = this.world.createImpulseJoint(jd, parent.body, child.body, true);
    j.setContactsEnabled(false);
    j.configureMotorModel(R.MotorModel.ForceBased);
    const scaled = o.motorScaled !== false;
    const rel = scaled ? this.rel(o.group || this.defaultGroup) : { torque: 1, speed: 1, stiff: 1, eff: 0.85 };
    const force = (o.force ?? 20) * rel.torque;
    j.setMotorMaxForce(force);
    const k = (o.stiffness ?? 2000) * clamp(Math.sqrt(rel.stiff), 0.75, 1.45);
    const s = new Servo(this, { ...o, name, joint: j, b1: parent.body, b2: child.body, axis, anchor1: a1, force, stiffness: k, init: o.init ?? 0, speedFactor: rel.speed, eff: rel.eff, group: o.group || this.defaultGroup });
    s.label = o.label || name;
    this.servos.set(name, s);
    child.servo = s;
    return s;
  }

  childPose(parentPart, anchor, axis, angle) {
    const p = vadd(parentPart.pos, qrot(parentPart.rot, { x: anchor[0], y: anchor[1], z: anchor[2] }));
    const r = qmul(parentPart.rot, qaxis({ x: axis[0], y: axis[1], z: axis[2] }, angle));
    return { pos: p, rot: r };
  }

  chain(name, parent, jointName, jo, partOpts) {
    const pose = jo.kind === 'pri'
      ? { pos: vadd(parent.pos, qrot(parent.rot, { x: jo.anchor[0] + jo.axis[0] * (jo.init || 0), y: jo.anchor[1] + jo.axis[1] * (jo.init || 0), z: jo.anchor[2] + jo.axis[2] * (jo.init || 0) })), rot: parent.rot }
      : this.childPose(parent, jo.anchor, jo.axis, jo.init || 0);
    const part = this.makePart(name, pose.pos, pose.rot, partOpts);
    this.joint(jointName, parent, part, jo);
    return part;
  }

  add(part, obj, x, y, z) {
    if (x != null) obj.position.set(x, y, z);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    part.group.add(obj);
    return obj;
  }

  addLed(part, obj, x, y, z) {
    this.add(part, obj, x, y, z);
    obj.userData.keep = true;
    this.leds.push(obj);
    obj.material = Mat.glow(this.config.akzent);
    return obj;
  }

  // Alle Glieder zusammenfassen (weniger Draw-Calls)
  optimize() { for (const p of this.parts.values()) optimizeGroup(p.group); }

  /* ---------------- Module an Steckplätzen ---------------- */

  // von Unterklassen: { modulId|schlüssel|'antenne': { part, pos: [x,y,z], rot: [rx,ry,rz] } }
  mounts() { return {}; }

  buildModules() {
    const M = this.mounts();
    for (const id of this.config.module) {
      const info = MODULES[id];
      const m = M[id] || M[info.key];
      if (!m) continue;
      this.installModule(id, info, m);
    }
    if (this.radio.tech && this.antenna && M.antenne) {
      const m = M.antenne;
      const part = this.parts.get(m.part);
      const vis = Dev.antenna(this.config.antenne);
      this.place(part, vis, m);
      this.antennaMount = { part, pos: m.pos, dir: this.dirOf(m, [0, 0, 1]) };
    }
  }

  dirOf(m, v) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(m.rot || [0, 0, 0])));
    const d = new THREE.Vector3(...v).applyQuaternion(q);
    return { x: d.x, y: d.y, z: d.z };
  }
  ptOf(m, v) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(m.rot || [0, 0, 0])));
    const d = new THREE.Vector3(...v).applyQuaternion(q);
    return { x: d.x + m.pos[0], y: d.y + m.pos[1], z: d.z + m.pos[2] };
  }
  place(part, vis, m) {
    vis.position.set(...m.pos);
    if (m.rot) vis.rotation.set(...m.rot);
    if (m.scale) vis.scale.setScalar(m.scale);
    this.add(part, vis);
    return vis;
  }

  installModule(id, info, m) {
    const part = this.parts.get(m.part);
    if (!part) return;
    const builders = {
      ultraschall: Dev.ultrasonic, tof: Dev.tof, farbsensor: Dev.colorSensor, kamera: Dev.camera, tiefenkamera: Dev.depthCamera, waermebild: Dev.thermalCamera,
      lidar2d: Dev.lidar2d, lidar3d: Dev.lidar3d, sicherheitsscanner: Dev.safetyScanner, radar: Dev.radar, rfid: Dev.rfid, barcode: Dev.barcode, kraftmoment: Dev.forceTorque,
      signalsaeule: Dev.stackLight, rundumleuchte: Dev.beacon, scheinwerfer: Dev.floodlight, hupe: Dev.horn,
    };
    let vis = null;
    if (builders[id] && !m.hidden) vis = this.place(part, builders[id](), m);
    this.devices[id] = { vis, part, mount: m, info };
    const P = (v) => this.ptOf(m, v), D = (v) => this.dirOf(m, v);
    switch (id) {
      case 'ultraschall': this.sensors.abstand = new DistanceSensor(this, part, P([0, 0.015, 0.016]), D([0, 0, 1]), 2, 'ultraschall'); break;
      case 'tof': this.sensors.abstand = new DistanceSensor(this, part, P([0, 0.011, 0.01]), D([0, 0, 1]), 4, 'tof'); break;
      case 'farbsensor': this.sensors.farbe = new ColorSensor(this, part, P([0, 0.009, 0]), D([0, 1, 0]), m.range || 0.14); break;
      case 'kamera': case 'tiefenkamera': {
        const off = id === 'kamera' ? [0, 0.02, 0.05] : [0, 0.013, 0.016];
        const c = m.camera || {};
        this.sensors.kamera = new Camera(this, part, c.pos ? { x: c.pos[0], y: c.pos[1], z: c.pos[2] } : P(off), c.dir ? { x: c.dir[0], y: c.dir[1], z: c.dir[2] } : D([0, 0, 1]), c.fov || 90, (c.range || 4) * (id === 'tiefenkamera' ? 1.3 : 1), { depth: id === 'tiefenkamera', model: info.model, feedFov: c.feedFov });
        break;
      }
      case 'waermebild': {
        const c = m.camera || {};
        this.sensors.waerme = new ThermalCam(this, part, c.pos ? { x: c.pos[0], y: c.pos[1], z: c.pos[2] } : P([0, 0.023, 0.042]), c.dir ? { x: c.dir[0], y: c.dir[1], z: c.dir[2] } : D([0, 0, 1]), { fov: c.thermalFov || 56, wide: c.wide || 0, range: c.range || 6 });
        break;
      }
      case 'lidar2d': this.sensors.lidar = new Lidar(this, part, P([0, 0.035, 0]), { kind: '2d', hfov: 360, range: 12, rate: 10, steps: 360, yaw: m.rot ? m.rot[1] : 0 }); break;
      case 'lidar3d': this.sensors.lidar = new Lidar(this, part, P([0, 0.058, 0]), { kind: '3d', hfov: 360, channels: 16, vfov: 30, range: 30, rate: 5, steps: 180 }); break;
      case 'sicherheitsscanner': this.sensors.lidar = new Lidar(this, part, P([0, 0.045, 0.015]), { kind: 'safety', hfov: 270, range: 5, rate: 20, steps: 270, safety: this.safetyField() }); break;
      case 'radar': this.sensors.radar = new Radar(this, part, P([0, 0.035, 0.02]), D([0, 0, 1]), { fov: 120, range: 20, rate: 15 }); break;
      case 'rfid': this.sensors.rfid = new RfidReader(this, part, P([0, 0.012, 0]), D([0, 1, 0]), 0.1); break;
      case 'barcode': this.sensors.barcode = new CodeScanner(this, part, P([0, 0.015, 0.023]), D([0, 0, 1]), 0.6); break;
      case 'kraftmoment': this.sensors.kraft = new ForceTorque(this, this.grippers.main || null); break;
      case 'scheinwerfer': {
        const light = new THREE.SpotLight('#fff3dc', 0, 6, 34 * DEG, 0.45, 1.6);
        light.castShadow = false;
        const lp = P([0, 0.04, 0.03]), ld = D([0, 0, 1]);
        light.position.set(lp.x, lp.y, lp.z);
        light.target.position.set(lp.x + ld.x, lp.y + ld.y, lp.z + ld.z);
        part.group.add(light, light.target);
        this.flood = { light, part, pos: lp, dir: ld };
        break;
      }
      default: break;
    }
  }

  safetyField() { return { radius: 1.0, contour: true }; }

  // Fähigkeiten (für Prüfung und Bausteinpalette)
  caps() {
    const s = new Set(Object.keys(this.sensors));
    for (const id of this.config.module) s.add(MODULES[id].key);
    if (this.sensors.lidar && this.sensors.lidar.safety) s.add('schutzfeld');
    if (Object.keys(this.grippers).length) s.add('greifer');
    if (this.tool && this.tool.gtype === 'lackier') s.add('lackier');
    if (this.radio.tech) s.add('funk');
    return s;
  }

  /* ---------------- Ablauf ---------------- */

  update(dt) {
    if (this.status === 'akku leer') { for (const s of this.servos.values()) { s.limp = true; s.apply(); } return; }
    if (!this.paused) {
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
    }
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

  sync() {
    super.sync();
    const dt = 1 / 60;
    const moving = this.isMoving();
    for (const [id, d] of Object.entries(this.devices)) {
      const rotor = d.vis && d.vis.userData.rotor;
      if (id === 'rundumleuchte' && d.vis) { setLit(d.vis.userData.dome, moving); if (rotor) rotor.rotation.y += moving ? dt * 14 : 0; }
      else if (rotor && rotor.userData.spin) rotor.rotation.y += dt * rotor.userData.spin * (this.computeScale || 1);
      if (id === 'sicherheitsscanner' && d.vis && this.sensors.lidar) d.vis.userData.statusLed.material = Mat.glow(this.sensors.lidar.violated ? '#ff3030' : '#3fd07a', 1.4);
    }
  }

  isMoving() {
    for (const s of this.servos.values()) if (!s.hidden && Math.abs(s.vel) > 0.02) return true;
    const v = this.baseBody().linvel();
    return Math.hypot(v.x, v.z) > 0.03;
  }

  drainBattery(dt) {
    let p = this.idleW;
    for (const s of this.servos.values()) p += s.power / Math.max(0.3, s.eff);
    p += this.extraPower || 0;
    if (this.floodOn) p += 20;
    this.power = p;
    if (!isFinite(this.battery.wh)) return;
    this.energy += p * dt;
    if (this.energy >= this.battery.wh * 3600) {
      this.energy = this.battery.wh * 3600;
      if (this.status !== 'akku leer') { this.status = 'akku leer'; this.warn('Akku entladen – alle Antriebe stromlos.'); }
    }
  }
  get batteryPct() { return isFinite(this.battery.wh) ? clamp(100 * (1 - this.energy / (this.battery.wh * 3600)), 0, 100) : 100; }

  // Sicherheitsfunktion: Halt bei verletztem Schutzfeld, automatischer Wiederanlauf
  safetyTrip(on) {
    if (on) {
      if (!this.holds.has('safety')) {
        this.holds.add('safety');
        for (const s of this.servos.values()) if (!s.hidden) s.pause();
        this.onSafetyHalt && this.onSafetyHalt(true);
        this.log('Schutzfeld verletzt – sicherer Halt (SS1).', 'warn');
      }
    } else if (this.holds.delete('safety')) {
      this.onSafetyHalt && this.onSafetyHalt(false);
      this.log('Schutzfeld frei – automatischer Wiederanlauf.', 'sys');
    }
  }
  log(text, kind) { if (this.onLog) this.onLog(this, text, kind); }

  // Temperatur eines Glieds (für das Wärmebild)
  partTemp(part) {
    const amb = this.sim.ambient();
    if (part.servo) return part.servo.temp;
    return amb + (part === this.parts.values().next().value ? 6 : 1.5);
  }
  temperature() { let t = this.sim.ambient(); for (const s of this.servos.values()) if (!s.hidden) t = Math.max(t, s.temp); return t; }

  // Licht des Scheinwerfers an einem Punkt (0 … ca. 1,2)
  lightAt(p) {
    if (!this.floodOn || !this.flood) return 0;
    const { o, d } = worldPose(this.flood.part, this.flood.pos, this.flood.dir);
    const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
    const dist = Math.hypot(v.x, v.y, v.z);
    if (dist > 6 || dist < 1e-3) return 0;
    const cos = (v.x * d.x + v.y * d.y + v.z * d.z) / dist;
    if (cos < Math.cos(36 * DEG)) return 0;
    return 1.3 * (1 - dist / 6.5);
  }

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
        if (stuck.length && !quiet) this.warn(`${stuck.join(', ')}: Sollposition nicht erreicht – Last zu hoch, blockiert oder Antrieb zu schwach.`);
        return false;
      }
    }
  }
  *moveTo(targets, speed = this.speed, wait = true, quiet = false) {
    for (const [n, deg] of Object.entries(targets)) {
      const s = this.servos.get(n);
      if (s) s.setDeg(deg, speed);
    }
    if (wait) return yield* this.waitServos(Object.keys(targets), 12, quiet);
    return true;
  }

  stopMotion() {
    for (const t of this.tasks) this.cancelTask(t);
    this.tasks = [];
    for (const s of this.servos.values()) if (!s.hidden || s.holdOnStop) s.freeze();
    this.onStop && this.onStop();
  }

  resetRuntime() {
    this.stopMotion();
    this.speed = 0.6;
    this.speech = null;
    this.setLed(null);
    this.setStack(null);
    this.setFlood(false);
    this.warnings = [];
    this.energy = 0;
    this.holds.clear();
    if (this.sensors.lidar && this.sensors.lidar.resetReference) this.sensors.lidar.resetReference();
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
    const hex = color ? COLORS[color] || color : this.config.akzent;
    for (const m of this.leds) m.material = Mat.glow(hex, color ? 2.6 : 1.6);
  }
  setStack(color) {
    this.stack = color;
    const d = this.devices.signalsaeule;
    if (!d || !d.vis) return;
    for (const [n, seg] of Object.entries(d.vis.userData.segments)) setLit(seg, n === color);
  }
  setFlood(on) {
    this.floodOn = !!on;
    const d = this.devices.scheinwerfer;
    if (d && d.vis) setLit(d.vis.userData.lens, this.floodOn);
    if (this.flood) this.flood.light.intensity = this.floodOn ? 9 : 0;
  }

  /* ---------------- Koordinaten ---------------- */

  frame() {
    const b = this.baseBody();
    const p = b.translation();
    return { p, yaw: yawOf(b.rotation()) };
  }
  baseBody() { return this.parts.values().next().value.body; }

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

  // Position und Ausrichtung der Antenne (Welt)
  antennaPose() {
    if (this.antennaMount) {
      const { o, d } = worldPose(this.antennaMount.part, { x: this.antennaMount.pos[0], y: this.antennaMount.pos[1] + 0.06, z: this.antennaMount.pos[2] }, this.antennaMount.dir);
      return { p: o, d };
    }
    const b = this.baseBody();
    const p = b.translation();
    const f = qrot(b.rotation(), { x: 0, y: 0, z: 1 });
    return { p: { x: p.x, y: p.y + 0.2, z: p.z }, d: f };
  }

  /* ---------------- Gemeinsame Befehle ---------------- */

  needGripper(side) {
    const g = side ? this.grippers[side] : this.grippers.main || this.grippers.rechts || Object.values(this.grippers)[0];
    if (!g) throw friendly(this.tool && this.tool.gtype === 'lackier' ? 'Das Werkzeug Lackierpistole kann nicht greifen. Werkzeug in der Konfiguration tauschen.' : 'Kein Greifwerkzeug montiert. In der Konfiguration ein Werkzeug wählen.');
    return g;
  }
  needSensor(kind) {
    const s = this.sensors[kind];
    if (!s) throw friendly(`Dafür fehlt ${needText(kind)}. In der Konfiguration nachrüsten.`);
    return s;
  }
  needDevice(key) {
    const id = Object.keys(this.devices).find((k) => MODULES[k].key === key);
    if (!id) throw friendly(`Dafür fehlt ${needText(key)}. In der Konfiguration nachrüsten.`);
    return this.devices[id];
  }

  cmd_tempo({ prozent }) { this.speed = clamp(prozent / 100, 0.01, 1); }
  cmd_greifkraft({ prozent }) { for (const g of Object.values(this.grippers)) g.strength = clamp(prozent / 100, 0.01, 1); }
  cmd_greife() { const g = this.needGripper(); return g.grip(); }
  cmd_lass_los() {
    const gs = Object.values(this.grippers);
    if (!gs.length) this.needGripper();
    const acts = gs.map((g) => g.release());
    return { done: () => acts.every((a) => !a || a.done()), cancel: () => {} };
  }
  cmd_sage({ text }, show) { this.say(show ? show(text) : String(text)); }
  cmd_leuchte({ farbe }) { this.setLed(String(farbe).toLowerCase()); }
  cmd_leuchte_aus() { this.setLed(null); }
  cmd_stopp() { this.stopMotion(); }
  cmd_signalsaeule({ farbe }) {
    this.needDevice('signalsaeule');
    const c = STACK_COLORS[String(farbe).toLowerCase()];
    if (!c) throw friendly('Die Signalsäule hat die Segmente rot, gelb, grün und blau.');
    this.setStack(c);
  }
  cmd_signalsaeule_aus() { this.needDevice('signalsaeule'); this.setStack(null); }
  cmd_scheinwerfer_an() { this.needDevice('scheinwerfer'); this.setFlood(true); }
  cmd_scheinwerfer_aus() { this.needDevice('scheinwerfer'); this.setFlood(false); }

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
    if (!s || s.hidden) throw friendly(`Achse „${gelenk}“ existiert an diesem Roboter nicht.`);
    return Math.round(s.display * 10) / 10;
  }
  rep_sieht({ farbe }) { return !!this.needSensor('kamera').find(farbe); }
  rep_richtung_zu({ farbe }) { const h = this.needSensor('kamera').find(farbe); return h ? Math.round(h.bearing * 10) / 10 : 0; }
  rep_entfernung_zu({ farbe }) { const h = this.needSensor('kamera').find(farbe); return h ? Math.round(h.dist * 1000) / 10 : 999; }
  rep_akku() { return Math.round(this.batteryPct); }
  rep_umgefallen() { return this.status === 'umgefallen'; }
  // LiDAR
  rep_lidar_abstand({ winkel }) { return Math.round(this.needSensor('lidar').rangeAt(Number(winkel) || 0) * 1000) / 10; }
  rep_lidar_naechstes() { return Math.round(this.needSensor('lidar').nearest().dist * 1000) / 10; }
  rep_lidar_richtung() { return Math.round(this.needSensor('lidar').nearest().bearing * 10) / 10; }
  rep_weg_frei({ strecke }) { return this.needSensor('lidar').corridorFree(Math.max(0.05, Number(strecke) / 100), this.corridorWidth ? this.corridorWidth() : 0.36); }
  rep_schutzfeld() { const l = this.needSensor('lidar'); if (!l.safety) throw friendly(`Dafür fehlt ${needText('schutzfeld')}.`); return !!l.violated; }
  // Radar
  rep_radar_anzahl() { return this.needSensor('radar').targets.length; }
  rep_radar_abstand() { const t = this.needSensor('radar').nearest(); return t ? Math.round(t.dist * 1000) / 10 : 2000; }
  rep_radar_geschwindigkeit() { const t = this.needSensor('radar').nearest(); return t ? Math.round(t.vr * 1000) / 10 : 0; }
  rep_radar_annaeherung() { return this.needSensor('radar').approaching(); }
  // Wärme und Antriebe
  rep_temperatur() { return this.needSensor('waerme').maxTemp(); }
  rep_motortemperatur() { return Math.round(this.temperature() * 10) / 10; }
  // Identifikation
  rep_rfid() { return this.needSensor('rfid').read(); }
  rep_barcode() { return this.needSensor('barcode').read(); }
  rep_kraft_werkzeug() { return this.needSensor('kraft').read(); }
  rep_signalstaerke() {
    if (!this.radio.tech) throw friendly(`Dafür fehlt ${needText('funk')}.`);
    return this.sim.radio ? this.sim.radio.bestRssi(this) : -120;
  }

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
