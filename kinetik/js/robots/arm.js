// Knickarmroboter KX-5 mit fünf Achsen (A1 Basis, A2 Schulter, A3 Ellbogen, A4 Handgelenk,
// A5 Handdrehung), Werkzeugflansch und wechselbarem Werkzeug.
import * as THREE from 'three';
import { Robot, friendly } from './robot.js';
import { Gripper } from './gripper.js';
import { TouchSensor } from './sensors.js';
import { Dev } from './devices3d.js';
import { Mat, Geo, mesh, boltCircle, fins, plate } from '../render/materials.js';
import { ARM_LENGTHS } from './parts.js';
import { qrot, vadd, wrapAngle, clamp, smooth, DEG, RAD, yawOf } from '../core/util.js';

const BASE_H = 0.10;   // Sockelhöhe
const SHOULDER = 0.16; // Schulter über dem Drehturm
const LW = 0.09;       // Handgelenk bis Handfläche
const MAST_MODULES = ['kamera', 'tiefenkamera', 'waermebild', 'lidar3d', 'radar', 'scheinwerfer'];

export class Arm extends Robot {
  constructor(sim, config, spawn) {
    super(sim, config, spawn);
    const L = ARM_LENGTHS[this.config.laenge] || ARM_LENGTHS.mittel;
    this.L1 = L.l1; this.L2 = L.l2;
    this.defaultGroup = 'achsen';
    this.gtype = this.tool.gtype || 'zange';
    this.home = { basis: 0, schulter: 5, ellbogen: 85, handgelenk: 90, handdrehung: 0 };
    this.build();
  }

  L(x, y, z) { return vadd(this.spawn, qrot(this.q0, { x, y, z })); }

  build() {
    const paint = this.shell, dark = Mat.anodized(), cast = Mat.cast();
    const L1 = this.L1, L2 = this.L2;
    const mA = this.rel('achsen').mass, mH = this.rel('hand').mass;
    const h = this.home;
    const lbl = (t) => plate(t, 0.026, 0.013, { bg: '#16191d', color: '#d9dde2', size: 40 });

    // Sockel (fest verschraubt)
    const sockel = this.makePart('sockel', this.L(0, 0, 0), this.q0, { fixed: true, colliders: [{ shape: 'cyl', size: [BASE_H / 2, 0.15], pos: [0, BASE_H / 2, 0] }] });
    this.add(sockel, mesh(Geo.box(0.32, 0.022, 0.32, 0.008), cast), 0, 0.011, 0);
    const bolts = boltCircle(0.184, 4, 0.009, 0.008, Mat.steel());
    bolts.rotation.y = Math.PI / 4;
    this.add(sockel, bolts, 0, 0.022, 0);
    this.add(sockel, mesh(Geo.lathe([[0, 0.022], [0.152, 0.022], [0.152, 0.03], [0.143, 0.038], [0.143, 0.084], [0.134, 0.093], [0.127, 0.1], [0, 0.1]], 56), paint));
    this.addLed(sockel, new THREE.Mesh(Geo.torus(0.1438, 0.0032, 72), Mat.glow(this.config.akzent)), 0, 0.062, 0).rotation.x = Math.PI / 2;
    this.add(sockel, mesh(Geo.cyl(0.128, 0.128, 0.006, 56), dark), 0, 0.097, 0);
    const tp = plate(this.name || 'KX-5', 0.05, 0.016, { bg: '#16191d', color: '#e6e8eb', size: 36 });
    this.add(sockel, tp, 0, 0.074, 0.1445);
    // Anschlusskasten hinten
    this.add(sockel, mesh(Geo.box(0.09, 0.05, 0.04, 0.006), dark), 0, 0.05, -0.155);
    for (const x of [-0.022, 0.022]) this.add(sockel, mesh(Geo.cyl(0.011, 0.011, 0.02, 18), Mat.steel()), x, 0.052, -0.18).rotation.x = Math.PI / 2;
    this.add(sockel, mesh(Geo.tube([[0.022, 0.052, -0.19], [0.03, 0.04, -0.24], [0.06, 0.01, -0.3]], 0.008, 16), Mat.cable()));

    // Drehturm (A1)
    const turm = this.chain('turm', sockel, 'basis', { group: 'achsen', anchor: [0, BASE_H, 0], axis: [0, 1, 0], init: h.basis * DEG, min: -170 * DEG, max: 170 * DEG, force: 45, speed: 1.6, stiffness: 4000, damping: 140, label: 'A1 Basis', home: 0 },
      { colliders: [{ shape: 'cyl', size: [0.06, 0.105], pos: [0, 0.06, 0] }] });
    this.fixMass(turm, 2.4 * mA);
    this.add(turm, mesh(Geo.lathe([[0, 0], [0.126, 0], [0.126, 0.01], [0.118, 0.02], [0.104, 0.07], [0.092, 0.104], [0, 0.108]], 56), paint));
    for (const s of [-1, 1]) {
      // Schwinge: Seitenwange mit Lagerauge
      this.add(turm, mesh(Geo.box(0.05, 0.12, 0.13, 0.02), paint), s * 0.085, 0.1, 0);
      this.add(turm, mesh(Geo.chamferCyl(0.074, 0.07, 0.006), paint), s * 0.085, SHOULDER, 0).rotation.z = Math.PI / 2;
    }
    // A2-Motor außen links, A1-Motor hinten
    const m2 = new THREE.Group();
    m2.add(mesh(Geo.chamferCyl(0.046, 0.085, 0.004), dark));
    m2.add(fins(0.046, 0.06, 5, 0.004));
    m2.add(mesh(Geo.chamferCyl(0.04, 0.01, 0.002), Mat.cast(), 0, 0.047, 0));
    m2.add(boltCircle(0.03, 4, 0.003, 0.003).translateY(0.052));
    m2.rotation.z = -Math.PI / 2;
    this.add(turm, m2, 0.165, SHOULDER, 0);
    const m1 = new THREE.Group();
    m1.add(mesh(Geo.chamferCyl(0.034, 0.09, 0.004), dark));
    m1.add(fins(0.034, 0.06, 4, 0.004));
    this.add(turm, m1, 0, 0.06, -0.112);
    const a1 = lbl('A1'); a1.position.set(0, 0.045, 0.121); a1.rotation.x = -0.12; this.add(turm, a1);
    const a2 = lbl('A2'); a2.position.set(-0.1201, SHOULDER, 0); a2.rotation.y = -Math.PI / 2; this.add(turm, a2);

    // Oberarm (A2)
    const ober = this.chain('oberarm', turm, 'schulter', { group: 'achsen', anchor: [0, SHOULDER, 0], axis: [1, 0, 0], init: h.schulter * DEG, min: -100 * DEG, max: 100 * DEG, force: 75 * (L1 / 0.4), speed: 1.4, stiffness: 4500, damping: 160, label: 'A2 Schulter' },
      { colliders: [{ shape: 'box', size: [0.045, L1 / 2 - 0.03, 0.045], pos: [0, L1 / 2, 0] }] });
    this.fixMass(ober, 1.3 * (L1 / 0.4) * mA);
    this.add(ober, mesh(Geo.chamferCyl(0.064, 0.1, 0.006), paint), 0, 0, 0).rotation.z = Math.PI / 2;
    this.add(ober, mesh(Geo.taper(0.096, 0.122, 0.08, 0.088, L1 - 0.06, 0.02), paint), 0, L1 / 2, 0);
    for (const s of [-1, 1]) {
      this.add(ober, mesh(Geo.box(0.004, L1 * 0.5, 0.05, 0.002), dark), s * 0.0455, L1 * 0.5, 0);
      this.add(ober, mesh(Geo.cyl(0.042, 0.042, 0.004, 40), dark), s * 0.051, 0, 0).rotation.z = Math.PI / 2;
    }
    this.add(ober, mesh(Geo.chamferCyl(0.052, 0.094, 0.006), paint), 0, L1, 0).rotation.z = Math.PI / 2;
    this.add(ober, mesh(Geo.conduit([[0, 0.05, -0.07], [0, L1 * 0.5, -0.088], [0, L1 - 0.05, -0.066]], 0.011, 40), Mat.cable()));
    for (const yy of [0.06, L1 - 0.06]) this.add(ober, mesh(Geo.box(0.03, 0.012, 0.028, 0.003), dark), 0, yy, -0.066);

    // Unterarm (A3)
    const unter = this.chain('unterarm', ober, 'ellbogen', { group: 'achsen', anchor: [0, L1, 0], axis: [1, 0, 0], init: h.ellbogen * DEG, min: -145 * DEG, max: 145 * DEG, force: 42 * (L2 / 0.36), speed: 1.7, stiffness: 3500, damping: 120, label: 'A3 Ellbogen' },
      { colliders: [{ shape: 'box', size: [0.038, L2 / 2 - 0.02, 0.038], pos: [0, L2 / 2, 0] }] });
    this.fixMass(unter, 0.85 * (L2 / 0.36) * mA);
    this.add(unter, mesh(Geo.box(0.1, 0.13, 0.098, 0.026), paint), 0, -0.005, 0);
    const m3 = new THREE.Group();
    m3.add(mesh(Geo.chamferCyl(0.034, 0.07, 0.004), dark));
    m3.add(fins(0.034, 0.05, 4, 0.003));
    m3.add(mesh(Geo.chamferCyl(0.028, 0.008, 0.002), Mat.cast(), 0, -0.039, 0));
    this.add(unter, m3, 0, -0.1, 0);
    this.add(unter, mesh(Geo.taper(0.074, 0.074, 0.06, 0.06, L2 - 0.09, 0.024), paint), 0, 0.06 + (L2 - 0.09) / 2, 0);
    this.add(unter, mesh(Geo.chamferCyl(0.042, 0.086, 0.005), paint), 0, L2, 0).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) this.add(unter, mesh(Geo.cyl(0.03, 0.03, 0.004, 32), dark), s * 0.044, L2, 0).rotation.z = Math.PI / 2;
    const a3 = lbl('A3'); a3.position.set(0.0505, 0.0, 0); a3.rotation.y = Math.PI / 2; this.add(unter, a3);

    // Handgelenk (A4)
    const gelenk = this.chain('handgelenk', unter, 'handgelenk', { group: 'hand', anchor: [0, L2, 0], axis: [1, 0, 0], init: h.handgelenk * DEG, min: -125 * DEG, max: 125 * DEG, force: 16, speed: 2.2, stiffness: 1800, damping: 50, label: 'A4 Handgelenk' },
      { colliders: [{ shape: 'box', size: [0.03, LW / 2 - 0.01, 0.03], pos: [0, LW / 2, 0] }] });
    this.fixMass(gelenk, 0.35 * mH);
    this.add(gelenk, mesh(Geo.lathe([[0, 0.0], [0.03, 0.0], [0.034, 0.02], [0.035, LW - 0.016], [0.031, LW - 0.008], [0, LW - 0.008]], 40), dark));
    this.add(gelenk, mesh(Geo.cyl(0.036, 0.036, 0.008, 40), Mat.steel()), 0, LW - 0.004, 0);

    // Werkzeugflansch (A5)
    const hand = this.chain('hand', gelenk, 'handdrehung', { group: 'hand', anchor: [0, LW, 0], axis: [0, 1, 0], init: h.handdrehung * DEG, min: -180 * DEG, max: 180 * DEG, force: 8, speed: 3, stiffness: 600, damping: 18, label: 'A5 Handdrehung' },
      { colliders: [{ shape: 'box', size: [0.08, 0.015, 0.032], pos: [0, 0.015, 0] }] });
    this.fixMass(hand, 0.3 + (this.tool.mass || 0.35) - 0.35);
    this.add(hand, mesh(Geo.chamferCyl(0.032, 0.008, 0.0015), Mat.steel()), 0, 0.004, 0);
    this.add(hand, boltCircle(0.025, 4, 0.003, 0.002, Mat.anodized()), 0, 0.008, 0);
    this.handPart = hand;
    this.buildTool(hand);
    if (this.tipLen == null) this.tipLen = 0.012; // Sensorflansch ohne Greifer

    // Module
    if (this.config.module.some((m) => MAST_MODULES.includes(m))) {
      this.add(sockel, mesh(Geo.box(0.05, 0.012, 0.06, 0.003), dark), 0, 0.028, -0.17);
      this.add(sockel, Dev.mast(0.55, 0.013), 0, 0.022, -0.185);
      this.add(sockel, mesh(Geo.box(0.16, 0.014, 0.05, 0.003), dark), 0, 0.485, -0.17);
    }
    this.buildModules();
    if (this.config.module.includes('kontakt')) {
      const cols = this.gtype === 'zange' ? this.fingerParts.map((p) => p.colliders[0]) : this.cupCollider ? [this.cupCollider] : [];
      this.sensors.beruehrung = new TouchSensor(this, cols);
    }
    this.setLed(null);
    this.optimize();
  }

  mounts() {
    return {
      ultraschall: { part: 'hand', pos: [0, 0.035, 0.07], rot: [-Math.PI / 2, 0, 0] },
      tof: { part: 'hand', pos: [0, 0.035, 0.06], rot: [-Math.PI / 2, 0, 0] },
      farbsensor: { part: 'hand', pos: [0, 0.022, 0], hidden: true, range: 0.3 },
      kamera: { part: 'sockel', pos: [0, 0.49, -0.15], rot: [0.38, 0, 0], camera: { pos: [0, 0.5, -0.12], dir: [0, -0.4, 1], fov: 360, range: 2.5, feedFov: 70 } },
      tiefenkamera: { part: 'sockel', pos: [0, 0.495, -0.15], rot: [0.38, 0, 0], camera: { pos: [0, 0.5, -0.12], dir: [0, -0.4, 1], fov: 360, range: 2.5, feedFov: 70 } },
      waermebild: { part: 'sockel', pos: [0.06, 0.492, -0.15], rot: [0.6, 0, 0], camera: { pos: [0.06, 0.5, -0.12], dir: [0, -0.7, 1], thermalFov: 80, wide: 330, range: 2.5, feedFov: 66 } },
      lidar3d: { part: 'sockel', pos: [0, 0.572, -0.185] },
      radar: { part: 'sockel', pos: [-0.06, 0.4, -0.16] },
      scheinwerfer: { part: 'sockel', pos: [-0.065, 0.492, -0.15], rot: [0.62, 0, 0] },
      sicherheitsscanner: { part: 'sockel', pos: [0, 0.0, 0.205] },
      rfid: { part: 'hand', pos: [0, 0.02, -0.062] },
      barcode: { part: 'hand', pos: [0, 0.018, 0.052], rot: [-Math.PI / 2, 0, 0] },
      kraftmoment: { part: 'hand', pos: [0, -0.012, 0], scale: 1.06 },
      signalsaeule: { part: 'sockel', pos: [0.125, 0.022, -0.125] },
      rundumleuchte: { part: 'sockel', pos: [-0.125, 0.022, -0.125] },
      hupe: { part: 'sockel', pos: [0.125, 0.022, 0.125], rot: [0, 0.6, 0] },
      antenne: { part: 'sockel', pos: [0.04, 0.075, -0.168] },
    };
  }

  safetyField() { return { radius: 1.0, contour: true, restart: 0.6 }; }

  buildTool(hand) {
    const type = this.gtype;
    const info = this.tool;
    const dark = Mat.anodized();
    if (type === 'zange') {
      const hd = this.config.werkzeug === 'parallel_hd';
      this.add(hand, mesh(Geo.box(hd ? 0.15 : 0.13, 0.03, hd ? 0.08 : 0.068, 0.006), dark), 0, 0.023, 0);
      for (const z of [-0.022, 0.022]) this.add(hand, mesh(Geo.box(0.17, 0.006, 0.012, 0.002), Mat.steel()), 0, 0.034, z);
      this.add(hand, mesh(Geo.box(0.03, 0.02, 0.02, 0.004), Mat.cast()), 0, 0.022, hd ? -0.048 : -0.042);
      const fingers = [];
      this.fingerParts = [];
      for (const side of [1, -1]) {
        const x0 = side * 0.068;
        const part = this.chain('finger' + (side > 0 ? 'L' : 'R'), hand, 'finger' + (side > 0 ? '_l' : '_r'),
          { kind: 'pri', anchor: [x0, 0.03, 0], axis: [side, 0, 0], init: 0, min: -0.062, max: 0.0, force: info.force, speed: 0.12, accel: 0.6, stiffness: 2500, damping: 60, hidden: true, motorScaled: false },
          { colliders: [{ shape: 'box', size: [0.008, 0.04, 0.022], pos: [0, 0.04, 0], friction: hd ? 1.35 : 1.15 }], angDamp: 1, iters: 6 });
        this.fixMass(part, 0.08);
        this.add(part, mesh(Geo.box(0.03, 0.014, 0.05, 0.003), dark), 0, 0.007, 0);
        this.add(part, mesh(Geo.taper(0.018, 0.044, 0.014, 0.036, 0.074, 0.004), Mat.alu()), 0, 0.048, 0);
        this.add(part, mesh(Geo.box(0.004, 0.056, 0.034, 0.0015), Mat.rubber()), -side * 0.0085, 0.052, 0);
        fingers.push({ servo: this.servos.get('finger' + (side > 0 ? '_l' : '_r')), part });
        this.fingerParts.push(part);
      }
      this.grippers.main = new Gripper(this, { type, palm: hand, fingers, tip: { x: 0, y: 0.085, z: 0 }, force: info.force, closed: -0.062 });
      this.tipLen = 0.085;
    } else if (type === 'sauger') {
      this.cupCollider = this.addCollider(hand, { shape: 'cyl', size: [0.016, 0.026], pos: [0, 0.046, 0], friction: 0.9 });
      this.add(hand, mesh(Geo.cyl(0.018, 0.018, 0.02, 24), dark), 0, 0.018, 0);
      this.add(hand, mesh(Geo.cyl(0.009, 0.009, 0.03, 16), Mat.steel()), 0, 0.042, 0);
      this.add(hand, mesh(Geo.lathe([[0.008, 0], [0.016, 0.002], [0.019, 0.006], [0.017, 0.009], [0.022, 0.013], [0.02, 0.016], [0.029, 0.021], [0.028, 0.024], [0.008, 0.02]], 32), Mat.rubber()), 0, 0.054, 0);
      this.add(hand, mesh(Geo.box(0.05, 0.022, 0.03, 0.004), Mat.cast()), 0.05, 0.02, 0);
      this.add(hand, mesh(Geo.tube([[0.05, 0.032, 0], [0.05, 0.06, -0.02], [0.02, 0.09, -0.06]], 0.004, 12), Mat.plain('#2b6cb0', 0.5)));
      this.grippers.main = new Gripper(this, { type, palm: hand, tip: { x: 0, y: 0.078, z: 0 }, force: info.force, cup: this.cupCollider });
      this.tipLen = 0.078;
    } else if (type === 'magnet') {
      this.cupCollider = this.addCollider(hand, { shape: 'cyl', size: [0.012, 0.036], pos: [0, 0.042, 0], friction: 0.6 });
      this.add(hand, mesh(Geo.chamferCyl(0.038, 0.026, 0.003), Mat.paint('#c9312b')), 0, 0.03, 0);
      this.add(hand, mesh(Geo.chamferCyl(0.039, 0.008, 0.002), Mat.steel()), 0, 0.054, 0);
      this.add(hand, mesh(Geo.cyl(0.012, 0.012, 0.0085, 24), Mat.anodized()), 0, 0.054, 0);
      const pl = plate('24 V', 0.03, 0.012, { bg: '#e2a312', color: '#16191d', size: 38 });
      this.add(hand, pl, 0, 0.03, 0.0385);
      this.grippers.main = new Gripper(this, { type: 'magnet', palm: hand, tip: { x: 0, y: 0.06, z: 0 }, force: info.force, cup: this.cupCollider });
      this.tipLen = 0.06;
    } else if (type === 'lackier') {
      this.add(hand, mesh(Geo.box(0.05, 0.045, 0.06, 0.008), Mat.paint('#3a4045')), 0, 0.03, 0);
      this.add(hand, mesh(Geo.cyl(0.008, 0.012, 0.04, 20), Mat.steel()), 0, 0.072, 0);
      this.add(hand, mesh(Geo.cyl(0.004, 0.004, 0.006, 12), Mat.anodized()), 0, 0.095, 0);
      this.add(hand, mesh(Geo.cyl(0.02, 0.018, 0.05, 24), Mat.glass('#c9d1db', 0.6)), 0.042, 0.03, 0).rotation.z = Math.PI / 2;
      this.add(hand, mesh(Geo.tube([[0, 0.03, -0.03], [0, 0.05, -0.07], [0, 0.09, -0.08]], 0.004, 12), Mat.cable()));
      this.tipLen = 0.098;
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 20, 1, true).translate(0, -0.08, 0).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false }));
      spray.position.y = 0.1;
      spray.userData.keep = true;
      this.add(hand, spray);
      this.sprayCone = spray;
    }
    if (this.grippers.main) this.grippers.main.onChange = () => {};
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
    return friendly(`Zielpunkt (${Math.round(-p.x * 100)}, ${hcm}, ${Math.round(p.z * 100)}) liegt außerhalb des Arbeitsraums: ${r} cm von Achse A1, erreichbar sind mit senkrechtem Werkzeug ca. ${Math.round((this.L1 + this.L2) * 100 - 5)} cm. Näheren Punkt wählen oder größere Baugröße konfigurieren.`);
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
    if (!s || s.hidden) throw friendly(`Achse „${name}“ existiert nicht. Verfügbar: ${this.jointNames().join(', ')}.`);
    return s;
  }

  cmd_drehe_auf({ gelenk, winkel }) {
    const s = this.servoOrFail(gelenk);
    if (s.setDeg(winkel, this.speed)) this.warn(`${s.label}: ${Math.round(winkel)}° außerhalb des Verfahrbereichs (${Math.round(s.min * RAD)}° … ${Math.round(s.max * RAD)}°), begrenzt.`);
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
    this.needGripper();
    const hit = cam.find(farbe, { objectsOnly: true, skipSorted: true, skipBinned: true });
    if (!hit) throw friendly(`Kamera: kein Objekt der Farbe „${String(farbe)}“ im Erfassungsbereich.`);
    return this.pick(hit.entity);
  }
  cmd_nimm_waermstes() {
    const cam = this.needSensor('waerme');
    this.needGripper();
    const hit = cam.hottest({ skipBinned: true });
    if (!hit) throw friendly('Wärmebild: kein Objekt im Erfassungsbereich.');
    this.log(`Wärmebild: wärmstes Objekt ${hit.temp.toFixed(1)} °C`, 'sys');
    return this.pick(hit.entity);
  }

  pick(thing) {
    const g = this.needGripper();
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
      if (!g.held) self.warn('Greifen fehlgeschlagen – kein Objekt zwischen den Backen.');
      const up = this.fk(this.currentAngles());
      yield* this.linear({ x: up.x, y: Math.max(up.y + 0.12, thing.halfHeight * 2 + 0.1), z: up.z }, { speedFactor: 0.7 });
    }, 'arm');
  }

  // Lackierpistole: Werkstück unter der Düse beschichten
  cmd_lackiere({ farbe }) {
    if (this.gtype !== 'lackier') throw friendly('Dafür muss die Lackierpistole als Werkzeug montiert sein.');
    const color = String(farbe).toLowerCase();
    return this.run(function* () {
      const hand = this.handPart;
      const q = hand.body.rotation(), p = hand.body.translation();
      const o = qrot(q, { x: 0, y: 0.1, z: 0 });
      const d = qrot(q, { x: 0, y: 1, z: 0 });
      const origin = { x: p.x + o.x, y: p.y + o.y, z: p.z + o.z };
      const hit = this.sim.physics.ray(origin, d, 0.3, this.rayGroups);
      const target = hit && hit.info && hit.info.entity && hit.info.entity.isObject ? hit.info.entity : null;
      this.extraPower = 60;
      let t = 0;
      while (t < 1.2) {
        t += yield;
        if (this.sprayCone) this.sprayCone.material.opacity = 0.18 + 0.08 * Math.sin(t * 40);
        if (target && t > 0.5 && target.color !== color) target.setColor(color);
      }
      if (this.sprayCone) this.sprayCone.material.opacity = 0;
      this.extraPower = 0;
      if (!target) this.warn('Lackieren: kein Werkstück unter der Düse (Abstand max. 30 cm).');
    }, 'werkzeug');
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
    if (!hit) throw friendly(`Kamera: keine Ablage der Farbe „${String(farbe)}“ im Erfassungsbereich.`);
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
