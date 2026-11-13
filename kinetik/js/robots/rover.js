// Autonome mobile Plattform AMR-1: Differentialantrieb mit zwei Rädern und Stützrolle,
// Sensorik an der Front, optional Frontgreifer und LiDAR-Navigation mit Hindernisvermeidung.
import * as THREE from 'three';
import { Robot, friendly } from './robot.js';
import { Gripper } from './gripper.js';
import { LineSensors, TouchSensor } from './sensors.js';
import { Dev } from './devices3d.js';
import { GridMap } from './navigation.js';
import { Mat, Geo, mesh, boltCircle, plate } from '../render/materials.js';
import { WHEELS } from './parts.js';
import { qrot, qconj, qmul, qaxis, vadd, twistAngle, wrapAngle, clamp, DEG, RAD } from '../core/util.js';

const TRACK = 0.31;   // Spurweite (Abstand der Räder)
const VMAX = 0.55;    // m/s bei 100 %
const VISION = ['kamera', 'tiefenkamera', 'waermebild', 'barcode'];

export class Rover extends Robot {
  constructor(sim, config, spawn) {
    super(sim, config, spawn);
    this.defaultGroup = 'fahr';
    this.wheelCfg = WHEELS[this.config.raeder] || WHEELS.standard;
    this.R_W = this.wheelCfg.r;
    this.wheels = {};
    this.drive = { l: 0, r: 0 }; // Soll-Radgeschwindigkeit in m/s
    this.odo = { l: 0, r: 0 };
    this.vmax = VMAX * this.rel('fahr').speed;
    this.build();
  }

  L(x, y, z) { return vadd(this.spawn, qrot(this.q0, { x, y, z })); }

  build() {
    const r = this.R_W;
    const h0 = r + 0.012;
    const paint = this.shell, dark = Mat.anodized();
    const rel = this.rel('fahr');
    const ch = this.makePart('chassis', this.L(0, h0, 0), this.q0, {
      colliders: [
        { shape: 'box', size: [0.12, 0.035, 0.165], pos: [0, 0.02, 0], r: 0.015 },
        { shape: 'ball', size: [0.022], pos: [0, 0.022 - h0, -0.13], friction: 0.02 },
      ],
      iters: 6,
    });
    this.fixMass(ch, 2.3 * (0.7 + 0.3 * rel.mass));
    this.chassis = ch;
    // Unterbau, Deck, Lichtband, Warnstreifen
    this.add(ch, mesh(Geo.box(0.24, 0.056, 0.33, 0.012), dark), 0, 0.0, 0);
    this.add(ch, mesh(Geo.box(0.36, 0.03, 0.37, 0.014), paint), 0, 0.057, 0);
    this.add(ch, mesh(Geo.box(0.34, 0.004, 0.35, 0.002), Mat.rubber()), 0, 0.0735, 0);
    for (const z of [0.1855, -0.1855]) this.add(ch, mesh(Geo.box(0.33, 0.014, 0.003, 0), Mat.hazard()), 0, 0.057, z);
    for (const x of [0.1205, -0.1205]) this.addLed(ch, mesh(Geo.box(0.003, 0.006, 0.26, 0.001), Mat.glow(this.config.akzent)), x, 0.022, 0);
    this.addLed(ch, mesh(Geo.box(0.18, 0.006, 0.003, 0.001), Mat.glow(this.config.akzent)), 0, 0.022, -0.1655);
    this.add(ch, mesh(Geo.box(0.2, 0.022, 0.003, 0.002), Mat.visor()), 0, -0.004, 0.1655);
    // Not-Halt, Anzeige, Ladekontakte, Stützrolle
    this.add(ch, mesh(Geo.cyl(0.02, 0.02, 0.006, 24), Mat.paint('#e2a312')), -0.13, 0.075, -0.15);
    this.add(ch, mesh(Geo.lathe([[0, 0], [0.008, 0], [0.008, 0.012], [0.017, 0.014], [0.018, 0.02], [0, 0.024]], 24), Mat.paint('#c9312b')), -0.13, 0.078, -0.15);
    const disp = plate(this.name, 0.07, 0.022, { bg: '#0d1013', color: '#7fe0a8', size: 34, border: '#2a3036' });
    disp.rotation.x = -Math.PI / 2;
    this.add(ch, disp, 0.05, 0.0742, -0.1);
    for (const x of [-0.03, 0.03]) this.add(ch, mesh(Geo.box(0.03, 0.008, 0.003, 0.001), Mat.plain('#c58b45', 0.3, 0.9)), x, -0.01, -0.1655);
    this.add(ch, mesh(Geo.cyl(0.03, 0.03, 0.024, 20), dark), 0, 0.03 - h0 + 0.012, -0.13);
    this.add(ch, mesh(Geo.sphere(0.022, 16), Mat.steel()), 0, 0.022 - h0, -0.13);

    const R = this.R;
    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const x = sx * TRACK / 2;
      const part = this.makePart('rad' + side, this.L(x, r, 0.04), this.q0, {
        colliders: [{ shape: 'cyl', size: [0.018, r], rot: qaxis({ x: 0, y: 0, z: 1 }, Math.PI / 2), friction: this.wheelCfg.friction }],
        angDamp: 0.05, iters: 6,
      });
      this.fixMass(part, 0.18);
      const jd = R.JointData.revolute({ x, y: r - h0, z: 0.04 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      const j = this.world.createImpulseJoint(jd, ch.body, part.body, true);
      j.setContactsEnabled(false);
      j.configureMotorModel(R.MotorModel.ForceBased);
      j.setMotorMaxForce(1.6 * rel.torque);
      const wheel = new THREE.Group();
      wheel.add(mesh(Geo.lathe([[r * 0.62, -0.017], [r - 0.006, -0.017], [r, -0.012], [r, 0.012], [r - 0.006, 0.017], [r * 0.62, 0.017]], 40), Mat.rubber()));
      wheel.add(mesh(Geo.cyl(r * 0.63, r * 0.63, 0.03, 32), dark));
      wheel.add(mesh(Geo.cyl(r * 0.25, r * 0.25, 0.034, 20), Mat.cast()));
      wheel.add(boltCircle(r * 0.42, 5, 0.003, 0.002).translateY(0.015 * sx));
      wheel.rotation.z = Math.PI / 2;
      this.add(part, wheel);
      this.wheels[side] = { part, joint: j, last: 0, angle: 0 };
    }

    // Frontgreifer
    if (this.tool.gtype === 'zange') {
      const info = this.tool;
      this.add(ch, mesh(Geo.box(0.17, 0.025, 0.03, 0.008), dark), 0, 0.01, 0.185);
      this.add(ch, mesh(Geo.box(0.05, 0.02, 0.03, 0.004), Mat.cast()), 0, 0.03, 0.18);
      const fingers = [];
      for (const fs of [1, -1]) {
        const part = this.chain('kralle' + (fs > 0 ? 'a' : 'b'), ch, 'kralle_' + (fs > 0 ? 'a' : 'b'),
          { kind: 'pri', anchor: [fs * 0.075, 0.01, 0.19], axis: [fs, 0, 0], init: 0, min: -0.05, max: 0, force: info.force, speed: 0.12, accel: 0.6, stiffness: 1500, damping: 40, hidden: true, motorScaled: false },
          { colliders: [{ shape: 'box', size: [0.007, 0.026, 0.035], pos: [0, -0.04, 0.03], friction: 1.15 }], angDamp: 1, iters: 6 });
        this.fixMass(part, 0.06);
        this.add(part, mesh(Geo.box(0.014, 0.062, 0.074, 0.004), Mat.alu()), 0, -0.036, 0.03);
        this.add(part, mesh(Geo.box(0.004, 0.044, 0.06, 0.002), Mat.rubber()), -fs * 0.008, -0.04, 0.032);
        fingers.push({ servo: this.servos.get('kralle_' + (fs > 0 ? 'a' : 'b')), part });
      }
      this.grippers.main = new Gripper(this, { type: 'zange', palm: ch, fingers, tip: { x: 0, y: -0.03, z: 0.22 }, axis: { x: 0, y: 0, z: 1 }, force: info.force, closed: -0.05 });
      this.clawFingers = fingers;
    }

    // Module
    if (this.config.module.some((m) => VISION.includes(m))) {
      this.add(ch, Dev.mast(0.115, 0.009), 0, 0.075, 0.03);
      this.add(ch, mesh(Geo.box(0.15, 0.01, 0.03, 0.003), dark), 0, 0.185, 0.03);
    }
    this.buildModules();
    const cfg = this.config.module;
    if (cfg.includes('linie')) {
      this.sensors.linie = new LineSensors(this, ch, { links: { x: 0.028, y: 0, z: 0.155 }, rechts: { x: -0.028, y: 0, z: 0.155 } });
      for (const sx of [0.028, -0.028]) this.add(ch, mesh(Geo.box(0.014, 0.006, 0.014, 0.002), Mat.glow('#ff4d4d', 1.2)), sx, -0.03, 0.155);
    }
    if (cfg.includes('kontakt')) {
      const bumper = this.addCollider(ch, { shape: 'box', size: [0.13, 0.016, 0.008], pos: [0, 0.0, 0.178], role: 'bumper' });
      this.add(ch, mesh(Geo.box(0.26, 0.032, 0.016, 0.007), Mat.rubber()), 0, -0.002, 0.176);
      this.sensors.beruehrung = new TouchSensor(this, [bumper, ...(this.clawFingers || []).map((f) => f.part.colliders[0])]);
      this.sensors.beruehrung.ignoreFloor = true;
    }
    this.setLed(null);
    this.optimize();
  }

  mounts() {
    return {
      lidar2d: { part: 'chassis', pos: [0, 0.0755, 0.105] },
      lidar3d: { part: 'chassis', pos: [0, 0.0755, 0.095] },
      sicherheitsscanner: { part: 'chassis', pos: [0, 0.0755, 0.115] },
      ultraschall: { part: 'chassis', pos: [0.068, -0.016, 0.1665] },
      tof: { part: 'chassis', pos: [0.068, -0.012, 0.1665] },
      radar: { part: 'chassis', pos: [-0.062, -0.034, 0.168] },
      kamera: { part: 'chassis', pos: [0, 0.19, 0.035], rot: [0.29, 0, 0], camera: { pos: [0, 0.2, 0.05], dir: [0, -0.3, 1], fov: 90, range: 4, feedFov: 64 } },
      tiefenkamera: { part: 'chassis', pos: [0, 0.192, 0.035], rot: [0.29, 0, 0], camera: { pos: [0, 0.2, 0.05], dir: [0, -0.3, 1], fov: 90, range: 4, feedFov: 64 } },
      waermebild: { part: 'chassis', pos: [0.055, 0.19, 0.03], rot: [0.3, 0, 0], camera: { pos: [0.055, 0.21, 0.06], dir: [0, -0.3, 1], thermalFov: 60, range: 6 } },
      barcode: { part: 'chassis', pos: [-0.055, 0.19, 0.03] },
      farbsensor: { part: 'chassis', pos: [0, -0.025, 0.13], rot: [Math.PI, 0, 0], range: 0.12 },
      rfid: { part: 'chassis', pos: [0, -0.028, 0.07], rot: [Math.PI, 0, 0] },
      signalsaeule: { part: 'chassis', pos: [0.13, 0.0755, -0.15] },
      rundumleuchte: { part: 'chassis', pos: [-0.02, 0.0755, -0.155] },
      scheinwerfer: { part: 'chassis', pos: [0.12, 0.0755, 0.15], rot: [0.12, 0, 0] },
      hupe: { part: 'chassis', pos: [-0.14, 0.0, 0.15] },
      antenne: { part: 'chassis', pos: [-0.13, 0.0755, -0.05] },
    };
  }

  safetyField() {
    return { radius: 0.3, sector: 50, contour: false, restart: 0.4, onlyMoving: () => this.drive.l + this.drive.r > 0.04 };
  }

  corridorWidth() { return 0.42; }

  frame() {
    const b = this.chassis.body;
    const q = b.rotation();
    const fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    return { p: b.translation(), yaw: Math.atan2(fx, fz) };
  }
  baseBody() { return this.chassis.body; }
  userOriginY() { return 0; }

  /* ---------------- Antrieb ---------------- */

  control() {
    const ch = this.chassis.body;
    const tq = this.rel('fahr').torque;
    for (const side of ['l', 'r']) {
      const w = this.wheels[side];
      const q = qmul(qconj(ch.rotation()), w.part.body.rotation());
      const a = twistAngle(q, { x: 1, y: 0, z: 0 });
      const d = wrapAngle(a - w.last);
      w.last = a;
      w.angle += d;
      this.odo[side] += d * this.R_W;
      const omega = this.paused ? 0 : this.drive[side] / this.R_W;
      w.joint.configureMotorVelocity(omega, 3.5 * tq);
      this.extraPower = (this.extraPower || 0) * 0.9 + Math.abs(omega) * 0.5;
    }
  }

  setWheels(l, r) { this.drive.l = l; this.drive.r = r; }
  get odoDist() { return (this.odo.l + this.odo.r) / 2; }

  stopMotion() {
    super.stopMotion();
    this.setWheels(0, 0);
  }

  isMoving() { return Math.abs(this.drive.l) + Math.abs(this.drive.r) > 0.01 || super.isMoving(); }

  *driveDist(dist) {
    const start = this.odoDist;
    const yaw0 = this.frame().yaw;
    const dir = Math.sign(dist) || 1;
    const vmax = (0.06 + this.vmax * this.speed) * dir;
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
    const wmax = (0.6 + 3.2 * this.speed) * Math.min(1.3, this.rel('fahr').speed);
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
      // nah dran und das Ziel liegt hinter uns: gut genug, sonst kreist man um den Punkt
      if (dist < 0.15 && Math.abs(err) > 80 * DEG) break;
      if (Math.abs(err) > 35 * DEG && dist > 0.15) { yield* this.turnBy(err); continue; }
      const v = (0.06 + this.vmax * this.speed) * clamp(dist / 0.1, 0.2, 1) * Math.max(0.2, Math.cos(err));
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

  /*
   * LiDAR-Navigation: Belegungskarte aus den Scans, A*-Pfad mit Sicherheitsabstand, Bahnfolge mit
   * Vorausschaupunkt. Vor jedem Fahrbefehl wird die Fahrzeugkontur gegen den aktuellen Scan geprüft.
   */
  *navigate(gx, gz) {
    const lidar = this.sensors.lidar;
    const HX = 0.2, HZ = 0.21;   // halbe Fahrzeugkontur inkl. Reserve
    const lidarOff = 0.105;
    const vTop = 0.06 + this.vmax * this.speed;
    const f0 = this.frame();
    const map = new GridMap(Math.min(f0.p.x, gx) - 2.2, Math.min(f0.p.z, gz) - 2.2, Math.max(f0.p.x, gx) + 2.2, Math.max(f0.p.z, gz) + 2.2);
    this.navMap = map;
    const local = () => {
      const pts = [];
      for (let i = 0; i < lidar.steps; i++) {
        const r = lidar.ranges[i];
        if (r >= lidar.range - 1e-3 || r < lidar.minRange || r > 1.5) continue;
        const a = lidar.az(i);
        pts.push(Math.sin(a) * r, Math.cos(a) * r + lidarOff);
      }
      return pts;
    };
    const hits = (pts, x, z, th) => {
      const c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < pts.length; k += 2) {
        const dx = pts[k] - x, dz = pts[k + 1] - z;
        if (Math.abs(dx * c - dz * s) < HX && Math.abs(dx * s + dz * c) < HZ) return true;
      }
      return false;
    };
    // Bewegung (v, w) für 0,4 s vorausrechnen und auf Kontakt prüfen
    const safe = (pts, v, w, T = 0.45) => {
      let x = 0, z = 0, th = 0;
      for (let tt = 0.05; tt <= T + 1e-6; tt += 0.05) {
        th += w * 0.05; x += Math.sin(th) * v * 0.05; z += Math.cos(th) * v * 0.05;
        if (hits(pts, x, z, th)) return false;
      }
      return true;
    };
    let t = 0, path = null, replanAt = -9, lastScan = -1, lastP = f0.p, lastCheck = 0, stuck = 0, spin = 0;
    const s0 = lidar.scans;
    while (lidar.scans < s0 + 1 && t < 1) t += yield;
    for (;;) {
      const f = this.frame();
      const dx = gx - f.p.x, dz = gz - f.p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) break;
      let changed = false;
      if (lidar.scans !== lastScan) { lastScan = lidar.scans; changed = map.addScan(lidar); }
      if (!path || changed && t - replanAt > 0.25 || t - replanAt > 1.5) {
        map.inflate(0.22, 0.22);
        path = map.plan(f.p.x, f.p.z, gx, gz) || path;
        replanAt = t;
        if (!path) { this.warn('Navigation: kein Weg zum Ziel in der Belegungskarte.'); break; }
      }
      // Vorausschaupunkt auf dem Pfad
      let best = 0, bd = Infinity;
      for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i].x - f.p.x, path[i].z - f.p.z); if (d < bd) { bd = d; best = i; } }
      let tx = gx, tz = gz, look = 0.35;
      for (let i = best; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const seg = Math.hypot(b.x - a.x, b.z - a.z);
        const da = Math.hypot(a.x - f.p.x, a.z - f.p.z);
        if (da + seg >= look || i === path.length - 2) {
          const k = Math.min(1, Math.max(0, (look - Math.min(look, da)) / Math.max(seg, 1e-3)));
          tx = a.x + (b.x - a.x) * Math.max(k, i === best ? 0.5 : k); tz = a.z + (b.z - a.z) * Math.max(k, i === best ? 0.5 : k);
          if (Math.hypot(tx - f.p.x, tz - f.p.z) < 0.2) { tx = b.x; tz = b.z; }
          break;
        }
      }
      if (dist < 0.4) { tx = gx; tz = gz; }
      const err = wrapAngle(Math.atan2(tx - f.p.x, tz - f.p.z) - f.yaw);
      const pts = local();
      let v, w;
      if (Math.abs(err) > 0.85 && dist > 0.12) { v = 0; w = Math.sign(err) * Math.min(1.6, 0.6 + Math.abs(err)); }
      else {
        v = vTop * clamp(1 - Math.abs(err) / 1.1, 0.25, 1) * clamp(dist / 0.35, 0.3, 1);
        w = clamp(err * 2.8, -1.8, 1.8);
      }
      if (!safe(pts, v, w)) {
        // langsamer und enger probieren, sonst auf der Stelle drehen bzw. zurücksetzen
        if (safe(pts, v * 0.4, w)) v *= 0.4;
        else if (safe(pts, 0, Math.sign(err || 1) * 1.2, 0.5)) { v = 0; w = Math.sign(err || 1) * 1.2; }
        else if (safe(pts, 0, -Math.sign(err || 1) * 1.2, 0.5)) { v = 0; w = -Math.sign(err || 1) * 1.2; }
        else { v = -0.12; w = 0; }
        spin++;
        if (spin > 40) { path = null; spin = 0; }
      } else spin = Math.max(0, spin - 1);
      const turn = w * TRACK / 2;
      this.setWheels(v - turn, v + turn);
      const dt = yield;
      t += dt;
      if (t - lastCheck > 3) {
        const p = this.frame().p;
        stuck = Math.hypot(p.x - lastP.x, p.z - lastP.z) < 0.05 ? stuck + 1 : 0;
        lastP = p; lastCheck = t;
        if (stuck >= 4) { this.warn('Navigation: Fahrzeug kommt nicht voran.'); break; }
      }
      if (t > 120) break;
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
  cmd_navigiere({ x, z }) {
    this.needSensor('lidar');
    return this.run(function* () { yield* this.navigate(-x / 100, z / 100); }, 'fahren');
  }
  cmd_fahre_los() {
    for (const t of this.tasks) if (t.channel === 'fahren') this.cancelTask(t);
    const v = 0.06 + this.vmax * this.speed;
    this.setWheels(v, v);
    return null;
  }
  cmd_fahre_tempo({ prozent }) {
    for (const t of this.tasks) if (t.channel === 'fahren') this.cancelTask(t);
    const v = this.vmax * clamp(prozent, -100, 100) / 100;
    this.setWheels(v, v);
    return null;
  }
  cmd_motoren({ links, rechts }) {
    for (const t of this.tasks) if (t.channel === 'fahren') this.cancelTask(t);
    this.setWheels(this.vmax * clamp(links, -100, 100) / 100, this.vmax * clamp(rechts, -100, 100) / 100);
    return null;
  }
  cmd_folge_pfad() {
    const path = this.sim.path;
    if (!path || path.length < 2) throw friendly('Kein Pfad vorhanden. Mit dem Pfadwerkzeug (Apple Pencil) einen Pfad auf den Boden zeichnen.');
    return this.run(function* () { for (const p of path) yield* this.driveTo(p.x, p.z, 0.04); }, 'fahren');
  }

  rep_linie({ seite }) { return this.needSensor('linie').read(seite); }

  /* ---------------- Greifen mit dem Frontgreifer ---------------- */

  clawPoint() {
    const f = this.frame();
    return { x: f.p.x + Math.sin(f.yaw) * 0.22, z: f.p.z + Math.cos(f.yaw) * 0.22 };
  }

  cmd_nimm({ farbe }) {
    const cam = this.needSensor('kamera');
    const g = this.needGripper();
    const opts = { objectsOnly: true, skipSorted: true, skipBinned: true };
    return this.run(function* () {
      let hit = cam.find(farbe, opts);
      for (let i = 0; !hit && i < 4; i++) {
        if (i === 0) this.log('Kamera: Suche durch Drehen …', 'sys');
        yield* this.turnBy(80 * DEG);
        hit = cam.find(farbe, opts);
      }
      if (!hit) throw friendly(`Kamera: kein Objekt der Farbe „${String(farbe)}“ gefunden.`);
      yield* this.grabThing(hit.entity, g);
    }, 'fahren');
  }

  *grabThing(thing, g) {
    const ra = g.release(); yield* this.until(() => ra.done(), 2);
    // Anfahrt: erst auf 30 cm heran, dann ausrichten und langsam einfahren
    let p = thing.body.translation();
    let f = this.frame();
    let d = Math.hypot(p.x - f.p.x, p.z - f.p.z);
    if (d > 0.4) yield* this.driveTo(p.x - (p.x - f.p.x) / d * 0.32, p.z - (p.z - f.p.z) / d * 0.32, 0.05);
    p = thing.body.translation(); f = this.frame();
    yield* this.turnBy(wrapAngle(Math.atan2(p.x - f.p.x, p.z - f.p.z) - f.yaw));
    p = thing.body.translation(); f = this.frame();
    d = Math.hypot(p.x - f.p.x, p.z - f.p.z);
    const sp = this.speed; this.speed = Math.min(sp, 0.35);
    yield* this.driveDist(d - 0.215);
    this.speed = sp;
    const ga = g.grip(); yield* this.until(() => ga.done(), 3);
    if (!g.held) this.warn('Greifen fehlgeschlagen – kein Objekt im Frontgreifer.');
  }

  cmd_nimm_waermstes() {
    const cam = this.needSensor('waerme');
    const g = this.needGripper();
    return this.run(function* () {
      const hit = cam.hottest({ skipBinned: true });
      if (!hit) throw friendly('Wärmebild: kein Objekt im Erfassungsbereich.');
      yield* this.grabThing(hit.entity, g);
    }, 'fahren');
  }

  *dropAt(c) {
    const g = this.grippers.main;
    const f = this.frame();
    const d = Math.hypot(c.x - f.p.x, c.z - f.p.z);
    if (d > 0.35) yield* this.driveTo(c.x - (c.x - f.p.x) / d * 0.3, c.z - (c.z - f.p.z) / d * 0.3, 0.05);
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
      let hit = cam.find(farbe, { exclude: (e) => e === g.held, placesFirst: true });
      for (let i = 0; !hit && i < 4; i++) { yield* this.turnBy(80 * DEG); hit = cam.find(farbe, { exclude: (e) => e === g.held, placesFirst: true }); }
      if (!hit) throw friendly(`Kamera: keine Ablage der Farbe „${String(farbe)}“ gefunden.`);
      const e = hit.entity;
      yield* this.dropAt(e.isObject ? e.body.translation() : (e.freeSpot && e.freeSpot(g.held, 0.1)) || e.center);
    }, 'fahren');
  }
  cmd_lege() {
    const g = this.needGripper();
    return this.run(function* () { const a = g.release(); yield* this.until(() => a.done(), 2); yield* this.driveDist(-0.12); }, 'fahren');
  }
}

export { RAD };
