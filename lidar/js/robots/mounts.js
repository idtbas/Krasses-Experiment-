// Halterungen und Autoscan. Der Scanner sitzt auf dem Fahrroboter AMR-1 (KINETIK-Physik, Differentialantrieb),
// am Sensorflansch des Roboterarms KX-5 L neben dem Drehteller, unter einer Drohne oder in der Hand einer Person.
// Der Autoscan fährt, schwenkt, fliegt oder geht eine Bahn um das gewählte Objekt und nimmt dabei mit der
// eingestellten Positionsbestimmung auf (Referenz, Koppelnavigation mit Drift, LiDAR-SLAM).
import * as THREE from 'three';
import { createRobot } from '../../../kinetik/js/robots/index.js';
import { lm, lmTint } from '../world/lidarmat.js';
import { G, mesh, rod } from '../world/geo.js';
import { person } from '../world/props_industry.js';
import { toast } from '../ui/dom.js';

const DEG = Math.PI / 180;
const TRACK = 0.31;                                // Spurweite AMR-1
const BASE_H = 0.10, SHOULDER = 0.16, LW = 0.09;   // Kinematik KX-5 (wie in KINETIK)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const PLATFORMS = {
  rover: { name: 'Fahrroboter AMR-1', short: 'AMR-1', payload: 8000, drift: 'wheel', odoName: 'Rad-Odometrie' },
  arm: { name: 'Roboterarm KX-5 L', short: 'KX-5', payload: 2500, drift: 'fixed', odoName: 'Encoder' },
  drohne: { name: 'Drohne X8-L', short: 'Drohne', payload: 2700, drift: 'gnss', odoName: 'GNSS ohne RTK' },
  hand: { name: 'Handgeführt', short: 'Hand', payload: 2000, drift: 'imu', odoName: 'nur IMU' },
};

/* ---------------- Geometrie-Hilfen ---------------- */

// Grundriss eines Objekts in seinem eigenen Drehsystem (Mitte, halbe Kantenlängen, Kurswinkel, Höhe)
export function footprint(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3(), tmp = new THREE.Box3(), M = new THREE.Matrix4();
  const wbox = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.userData.noLidar) return;
    if (o.isInstancedMesh) { tmp.setFromObject(o); wbox.union(tmp); tmp.applyMatrix4(inv); box.union(tmp); return; }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    M.multiplyMatrices(inv, o.matrixWorld);
    tmp.copy(o.geometry.boundingBox).applyMatrix4(M);
    box.union(tmp);
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    wbox.union(tmp);
  });
  const e = root.matrixWorld.elements;
  const yaw = Math.atan2(-e[2], e[0]);
  const c = box.getCenter(new THREE.Vector3()).applyMatrix4(root.matrixWorld);
  const sx = Math.hypot(e[0], e[1], e[2]), sz = Math.hypot(e[8], e[9], e[10]);
  return { cx: c.x, cy: c.y, cz: c.z, hx: (box.max.x - box.min.x) / 2 * sx, hz: (box.max.z - box.min.z) / 2 * sz, yaw, top: wbox.max.y, bottom: wbox.min.y, box: wbox };
}

// geschlossene Bahn: Rechteck um den Grundriss mit Abstand R (Ecken als Viertelkreise)
export function orbitPath(fp, R, step = 0.08) {
  const { hx, hz } = fp, pts = [];
  const line = (x0, z0, x1, z1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step)); for (let k = 0; k < n; k++) pts.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]); };
  const arc = (cx, cz, a0) => { const n = Math.max(2, Math.ceil(R * Math.PI / 2 / step)); for (let k = 0; k < n; k++) { const a = a0 + (Math.PI / 2) * k / n; pts.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]); } };
  line(hx + R, -hz, hx + R, hz); arc(hx, hz, 0);
  line(hx, hz + R, -hx, hz + R); arc(-hx, hz, Math.PI / 2);
  line(-hx - R, hz, -hx - R, -hz); arc(-hx, -hz, Math.PI);
  line(-hx, -hz - R, hx, -hz - R); arc(hx, -hz, Math.PI * 1.5);
  const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
  const P = pts.map(([x, z]) => new THREE.Vector2(fp.cx + c * x + s * z, fp.cz - s * x + c * z));
  const S = [0];
  for (let k = 1; k <= P.length; k++) S.push(S[k - 1] + P[k - 1].distanceTo(P[k % P.length]));
  return { P, S, L: S[S.length - 1] };
}
// Punkt auf der geschlossenen Bahn bei Bogenlänge s
function pathAt(path, s) {
  const { P, S, L } = path;
  s = ((s % L) + L) % L;
  let lo = 0, hi = P.length;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  const a = P[lo], b = P[(lo + 1) % P.length], u = (s - S[lo]) / Math.max(1e-9, S[lo + 1] - S[lo]);
  return new THREE.Vector2(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
}
// Bogenlänge des nächsten Bahnpunkts nahe einer Schätzung (vorwärts gesucht)
function pathProject(path, x, z, sGuess, back = 0.2, fwd = 1.0) {
  let best = sGuess, bd = Infinity;
  for (let s = sGuess - back; s <= sGuess + fwd; s += 0.02) { const p = pathAt(path, s); const d = (p.x - x) ** 2 + (p.y - z) ** 2; if (d < bd) { bd = d; best = s; } }
  return best;
}
function pathNearest(path, x, z) {
  let best = 0, bd = Infinity;
  path.P.forEach((p, k) => { const d = (p.x - x) ** 2 + (p.y - z) ** 2; if (d < bd) { bd = d; best = path.S[k]; } });
  return best;
}

/* ---------------- Drohne (kinematisch) ---------------- */
function buildDrone() {
  const g = new THREE.Group();
  g.name = 'Drohne X8-L';
  const carbon = lmTint('kunststoff_schwarz', '#1b1d20'), grey = lm('kunststoff_grau');
  const body = new THREE.Group(); body.position.y = 0.34; g.add(body);
  body.add(mesh(G.rbox(0.3, 0.1, 0.38, 0.035), carbon));
  body.add(mesh(G.rbox(0.24, 0.05, 0.3, 0.02), grey, 0, 0.07, -0.01));
  body.add(mesh(G.cyl(0.045, 0.05, 0.03, 20), lm('kunststoff_weiss'), 0, 0.11, -0.08));       // GNSS-Antenne
  body.add(mesh(G.cyl(0.03, 0.035, 0.025, 16), lm('kunststoff_weiss'), 0, 0.105, 0.09));
  for (const sx of [-1, 1]) body.add(mesh(G.rbox(0.07, 0.06, 0.22, 0.012), lmTint('kunststoff_grau', '#3c4046'), sx * 0.12, 0.05, 0)); // Akkus
  const props = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, x = Math.sin(a) * 0.45, z = Math.cos(a) * 0.45;
    body.add(rod([Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12], [x, 0.02, z], 0.017, carbon, 10));
    body.add(mesh(G.cyl(0.036, 0.036, 0.05, 20), lm('ral9005'), x, 0.05, z));
    const prop = new THREE.Group(); prop.position.set(x, 0.085, z); prop.userData.noLidar = true; body.add(prop);
    const disc = new THREE.Mesh(G.cyl(0.27, 0.27, 0.003, 36), new THREE.MeshStandardMaterial({ color: '#222', transparent: true, opacity: 0.18, depthWrite: false }));
    prop.add(disc);
    for (const s of [0, Math.PI]) prop.add(mesh(G.box(0.26, 0.004, 0.03), carbon, Math.cos(s) * 0.13, 0.004, Math.sin(s) * 0.13, 0, s, 0));
    props.push(prop);
  }
  // Landegestell
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) body.add(rod([sx * 0.1, -0.04, sz * 0.12], [sx * 0.27, -0.33, sz * 0.15], 0.011, carbon, 8));
    body.add(rod([sx * 0.27, -0.335, -0.26], [sx * 0.27, -0.335, 0.26], 0.012, carbon, 8));
  }
  // Nutzlastaufnahme unter dem Rumpf
  body.add(mesh(G.box(0.1, 0.03, 0.1), lm('alu_blech'), 0, -0.065, 0.05));
  body.add(mesh(G.box(0.012, 0.08, 0.08), lm('alu_blech'), 0, -0.11, 0.05));
  const mountPt = new THREE.Object3D(); mountPt.position.set(0, -0.16, 0.05); body.add(mountPt);
  g.userData.lidarBody = true;
  return { group: g, body, props, mountPt };
}

/* ---------------- Klasse ---------------- */
export class Mounts {
  constructor(app) {
    this.app = app;
    this.cur = null;     // aktuelle Halterung
    this.job = null;     // laufender Autoscan
    this.opts = {
      pos: 'slam', deskew: true, target: null,
      rover: { dist: 1.2, speed: 0.35, laps: 1.1, tilt: 0, stations: 4 },
      arm: { rings: 3, rev: 20 },
      drohne: { pattern: 'raster', alt: 0, speed: 3, overlap: 0.5 },
      hand: { dist: 1.4, speed: 0.8, laps: 1.1, phoneMode: 'objekt', phoneDist: 0.9 },
    };
  }
  get world() { return this.app.world; }

  // passt der Scanner auf die Plattform? (Nutzlast, Bauart)
  allowed(kind, d) { return !this.whyNot(kind, d); }
  whyNot(kind, d) {
    const P = PLATFORMS[kind];
    if (!P) return 'unbekannt';
    const w = (d.spec.data && d.spec.data.weight) || 1000;
    if (d.kind === 'phone') return kind === 'hand' ? null : 'Smartphone nur in der Hand';
    if (d.kind === 'tls' && kind !== 'rover') return 'Laserscanner messen nur im Stillstand (Stop-and-Go mit dem Fahrroboter)';
    if (w > P.payload) return `${(w / 1000).toFixed(1).replace('.', ',')} kg – Nutzlast nur ${(P.payload / 1000).toFixed(1).replace('.', ',')} kg`;
    if (kind === 'arm' && !this.world.turntable) return 'Nur im Messraum mit Drehteller';
    return null;
  }

  reset() { this.stopJob(null); this.cur = null; }

  // Halterung entfernen (Scanner bleibt ohne Halterung zurück)
  detach() {
    this.stopJob(null);
    const c = this.cur, w = this.world;
    if (!c) return;
    if (c.robot) w.sim.remove(c.robot);
    for (const g of c.groups || []) g.removeFromParent();
    if (c.reg) { const i = w.objects.indexOf(c.reg); if (i >= 0) w.objects.splice(i, 1); }
    if (w.turntable) { w.turntable.speed = 0; }
    this.cur = null;
  }

  async attach(kind, dev) {
    const why = this.whyNot(kind, dev);
    if (why) { toast(why, 'warn'); return false; }
    const at = dev.root.getWorldPosition(new THREE.Vector3());
    const wasOn = dev.state === 'stream';
    if (wasOn) dev.stop();
    this.detach();
    dev.unmount();
    if (kind === 'rover') this.buildRover(dev, at);
    else if (kind === 'arm') this.buildArm(dev);
    else if (kind === 'drohne') this.buildDrone(dev, at);
    else if (kind === 'hand') this.buildHand(dev, at);
    this.world.content.updateMatrixWorld(true);
    await this.app.rebuildLidar();
    if (wasOn) dev.start();
    this.app.fpc.render();
    toast(`${dev.spec.model} auf ${PLATFORMS[kind].name} montiert – Autoscan im Feldrechner unter „Live“`, 'ok');
    return true;
  }

  // Scanner zurück aufs Stativ, an die Stelle der Plattform
  toTripod(dev) {
    const p = dev.root.getWorldPosition(new THREE.Vector3());
    this.detach();
    dev.mountOn('stativ');
    dev.setPosition(p.x, p.z, 0);
  }

  /* ---------- Fahrroboter AMR-1 mit Sensormast ---------- */
  buildRover(dev, at) {
    const w = this.world;
    const fp = this.defaultTarget() ? footprint(this.defaultTarget().root) : null;
    const yaw = fp ? Math.atan2(fp.cx - at.x, fp.cz - at.z) : 0;
    const rb = createRobot(w.sim, { type: 'rover', name: 'AMR-1', module: [], werkzeug: 'keins', funk: 'keins', akku: 'lifepo4', antrieb: { fahr: 'bldc' }, lack: '#d8dbd5', akzent: '#35d0ff' }, { x: at.x, y: 0, z: at.z, yaw });
    for (const p of rb.parts.values()) p.group.userData.lidarBody = true;
    const reg = w.register(rb.root, { name: 'Fahrroboter AMR-1', kind: 'roboter', target: false, movable: false });
    const k = dev.kind, cls = dev.spec.cls;
    const H = k === 'tls' ? 1.0 : cls === 'line' ? 0.1 : k === 'depth' ? 0.42 : 0.78;
    const alu = lm('alu_blech'), dark = lm('kunststoff_schwarz');
    const mast = new THREE.Group(); mast.position.set(0, 0.0755, 0.03);
    mast.add(mesh(G.box(0.14, 0.008, 0.14), alu, 0, 0.004, 0));
    mast.add(mesh(G.box(0.03, H, 0.03), alu, 0, 0.008 + H / 2, 0));
    if (H > 0.3) for (const s of [-1, 1]) mast.add(rod([s * 0.06, 0.008, 0], [s * 0.012, 0.008 + H * 0.32, 0], 0.005, alu, 8));
    mast.add(mesh(G.box(0.09, 0.008, 0.09), alu, 0, 0.012 + H, 0));
    mast.add(mesh(G.rbox(0.15, 0.05, 0.1, 0.006), dark, 0, 0.033, -0.12));                   // Rechner
    mast.add(mesh(G.box(0.02, 0.012, 0.004), lmTint('kunststoff_gruen', '#38d27a'), 0.05, 0.045, -0.0705));
    mast.add(rod([0.02, 0.058, -0.08], [0.02, 0.01 + H, 0.017], 0.0035, lm('kabel'), 6));
    rb.chassis.group.add(mast);
    const top = new THREE.Object3D(); top.position.set(0, 0.016 + H, 0); mast.add(top);
    dev.mountOn('rover', { parent: top, pitch: (this.opts.rover.tilt || 0) * DEG });
    this.cur = { kind: 'rover', robot: rb, reg, top, groups: [] };
  }

  /* ---------- Roboterarm KX-5 L mit Sensorflansch neben dem Drehteller ---------- */
  buildArm(dev) {
    const w = this.world, T = w.turntable;
    const obj = this.studioObject();
    const fp = obj ? footprint(obj.root) : { cx: 0, cy: 0.35, cz: 0, hx: 0.15, hz: 0.15, top: 0.6, bottom: 0.1 };
    const plate = T.plate.getWorldPosition(new THREE.Vector3());
    const R = Math.max(fp.hx, fp.hz, 0.08) * 1.15;
    const rmin = dev.spec.phys.rangeMin || 0.3;
    const s0 = Math.max(R + 1.15 * rmin, R + 0.3, 0.45);
    const cy = (fp.top + Math.max(fp.bottom, plate.y + 0.02)) / 2;
    // Sensor auf der Werkzeugachse: Sensorsystem +Z = Flanschachse (Hand +Y); Lage aus dem Gehäusemodell
    const mg = dev.model.group, par = mg.parent;
    mg.removeFromParent(); mg.updateMatrixWorld(true);
    const mb = new THREE.Box3().setFromObject(mg);
    const sp = dev.model.sensor.getWorldPosition(new THREE.Vector3());
    par.add(mg);
    const off = new THREE.Vector3(-sp.x, 0.024 - mb.min.z, sp.y);
    const Ys = off.y + sp.z;
    const tipLen = 0.008 + Ys;
    // Aufstellung (Abstand zum Drehteller, Podesthöhe) so wählen, dass möglichst alle Bahnen erreichbar sind
    let best = null;
    for (const podH of [0, 0.15, 0.3, 0.45, 0.6]) {
      for (let Db = 0.72; Db <= 1.9; Db += 0.04) {
        const L = { Db, podH, cy, s0, tipLen, L1: 0.5, L2: 0.45 };
        let score = 0;
        for (const n of [2, 3, 4]) score += this.armRings(n, L).length;
        const cost = score * 10 - Math.abs(Db - (0.45 + 0.94 * s0)) - podH * 0.5;
        if (!best || cost > best.cost) best = { cost, Db, podH };
      }
    }
    const { Db, podH } = best;
    const groups = [];
    const base = new THREE.Vector3(plate.x, 0, plate.z + Db);
    if (podH > 0.04) {
      // Podest aus Stahl mit Fußplatte
      const pod = new THREE.Group(); pod.position.copy(base);
      pod.add(mesh(G.box(0.46, 0.015, 0.46), lm('stahl_grau'), 0, 0.0075, 0));
      pod.add(mesh(G.box(0.32, podH - 0.035, 0.32), lmTint('lack_weiss', '#d9dad5'), 0, 0.015 + (podH - 0.035) / 2, 0));
      pod.add(mesh(G.box(0.4, 0.02, 0.4), lm('stahl_grau'), 0, podH - 0.01, 0));
      w.content.add(pod);
      w.register(pod, { name: 'Roboterpodest', kind: 'anlage', target: false, movable: false, static: true });
      groups.push(pod);
    }
    const arm = createRobot(w.sim, { type: 'arm', name: 'KX-5', laenge: 'lang', werkzeug: 'flansch', module: [], funk: 'keins', akku: 'netz', antrieb: { achsen: 'harmonic', hand: 'harmonic' }, lack: '#e4e5e1', akzent: '#35d0ff' }, { x: base.x, y: podH, z: base.z, yaw: Math.PI });
    for (const p of arm.parts.values()) p.group.userData.lidarBody = true;
    const reg = w.register(arm.root, { name: 'Roboterarm KX-5 L', kind: 'roboter', target: false, movable: false });
    const fl = new THREE.Group(); fl.position.y = 0.008;
    const alu = lm('alu_blech');
    fl.add(mesh(G.cyl(0.034, 0.034, 0.012, 32), alu, 0, 0.006, 0));
    const plateZ = sp.y - mb.min.y + 0.004;
    const yTop = off.y + mb.max.z;
    fl.add(mesh(G.box(Math.max(0.05, mb.max.x - mb.min.x), Math.max(0.02, yTop - 0.012), 0.006), alu, (mb.min.x + mb.max.x) / 2 - sp.x, 0.012 + (yTop - 0.012) / 2, plateZ));
    fl.add(mesh(G.box(0.05, 0.012, Math.abs(plateZ) + 0.02), alu, 0, 0.018, plateZ / 2));
    arm.handPart.group.add(fl);
    arm.tipLen = tipLen;
    dev.mountOn('arm', { parent: fl, offset: [off.x, off.y, off.z], pitch: -Math.PI / 2 });
    const roll = dev.spec.cls === 'line' || dev.spec.cls === 'spin' || dev.spec.cls === 'slam' ? 90 : 0;
    this.cur = { kind: 'arm', robot: arm, reg, groups, base, plate, fp, roll, obj, L: { Db, podH, cy, s0, tipLen, L1: arm.L1, L2: arm.L2 } };
    // Grundstellung: Sensor blickt aus der ersten erreichbaren Bahn auf das Objekt
    const r0 = this.armRings(3)[1] || this.armRings(3)[0];
    if (r0) {
      for (const [n, v] of Object.entries(r0.q)) { const sv = arm.servos.get(n); if (sv) sv.setDeg(v / DEG, 1); }
      const sv = arm.servos.get('handdrehung'); if (sv) sv.setDeg(roll, 1);
    }
  }

  // Gelenkwinkel, damit der Sensor aus Abstand s und Höhenwinkel e auf die Objektmitte blickt (L: Aufstellung)
  armAim(s, e, L) {
    const r = L.Db - s * Math.cos(e), hgt = L.cy - L.podH + s * Math.sin(e);
    const phi = Math.PI / 2 + e;
    const tool = LW + L.tipLen;
    const wr = r - tool * Math.sin(phi), wh = hgt - tool * Math.cos(phi) - (BASE_H + SHOULDER);
    const d = Math.hypot(wr, wh), L1 = L.L1, L2 = L.L2;
    if (d > L1 + L2 - 0.01 || d < Math.abs(L1 - L2) + 0.02 || r < 0.15) return null;
    const cc = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const sols = [];
    for (const sg of [1, -1]) {
      const el = sg * Math.acos(cc);
      const sh = Math.atan2(wr, wh) - Math.atan2(L2 * Math.sin(el), L1 + L2 * Math.cos(el));
      const wr2 = wrap(phi - sh - el);
      // Ellbogen über der Schulter und nicht hinter dem Sockel
      const elbowH = L1 * Math.cos(sh);
      if (Math.abs(sh) <= 95 * DEG && Math.abs(el) <= 140 * DEG && Math.abs(wr2) <= 120 * DEG && elbowH > -0.05) sols.push({ basis: 0, schulter: sh, ellbogen: el, handgelenk: wr2 });
    }
    if (!sols.length) return null;
    sols.sort((a, b) => Math.abs(a.schulter) - Math.abs(b.schulter));
    return sols[0];
  }

  // Bahnen (Höhenwinkel) für den Drehteller-Scan
  armRings(n, L = this.cur.L) {
    const E = { 1: [15], 2: [0, 35], 3: [-10, 20, 48], 4: [-15, 8, 30, 55] }[n] || [-10, 20, 48];
    const out = [];
    for (const e of E) {
      for (let s = L.s0; s <= L.s0 + 0.5; s += 0.02) {
        const q = this.armAim(s, e * DEG, L);
        if (q) { out.push({ e, s, q }); break; }
      }
    }
    return out;
  }

  /* ---------- Drohne ---------- */
  buildDrone(dev, at) {
    const w = this.world;
    const D = buildDrone();
    D.group.position.set(at.x, 0, at.z);
    w.content.add(D.group);
    const reg = w.register(D.group, { name: 'Drohne X8-L', kind: 'drohne', target: false, movable: false });
    dev.mountOn('drohne', { parent: D.mountPt, pitch: Math.PI / 2 });
    this.cur = { kind: 'drohne', drone: D, reg, groups: [D.group], st: { p: new THREE.Vector3(at.x, 0, at.z), v: new THREE.Vector3(), yaw: 0, a: new THREE.Vector3(), t: 0 } };
  }

  /* ---------- Handgeführt ---------- */
  buildHand(dev, at) {
    const w = this.world;
    const pr = person('arbeit', 0);
    pr.position.set(at.x, 0, at.z);
    pr.name = 'Bediener';
    w.content.add(pr);
    const reg = w.register(pr, { name: 'Bediener mit Scanner', kind: 'person', target: false, movable: false });
    const L = pr.userData.limbs;
    L.arms[0].rotation.x = -1.2; // rechter Arm nach vorn (Person blickt in +Z, rechts ist −X)
    const grip = new THREE.Object3D(); grip.position.set(-0.2, 1.2, 0.6); pr.add(grip);
    dev.mountOn('hand', { parent: grip });
    if (dev.kind === 'phone') dev.holder.rotation.z = -Math.PI / 2; // Telefon im Querformat
    this.cur = { kind: 'hand', person: pr, grip, reg, groups: [pr], st: { s: 0, t: 0 } };
  }

  /* ---------- Ziele ---------- */
  targets() {
    return this.world.objects.filter((o) => o.target !== false && !['scanner', 'roboter', 'drohne'].includes(o.kind) && o.root.parent);
  }
  studioObject() { return this.world.objects.find((o) => o.kind === 'messobjekt') || null; }
  defaultTarget() {
    const L = this.targets();
    const sel = this.app.selected && L.includes(this.app.selected) ? this.app.selected : null;
    if (this.opts.target) { const t = L.find((o) => o.id === this.opts.target); if (t) return t; }
    if (sel) return sel;
    const pref = { halle: 'Gabelstapler', aussen: 'Wohnhaus', wohnung: 'Sofa', pruef: 'Pkw schwarz (35 m)', messraum: null };
    const name = pref[this.app.sceneId];
    return (name && L.find((o) => o.name === name)) || this.studioObject() || L[0] || null;
  }

  // Positionsbestimmung für eine Aufnahme
  recordOptions(d, o = {}) {
    const kind = d.mountKind;
    if (kind === 'stativ' || !PLATFORMS[kind]) return { mode: 'ideal', drift: 'fixed', deskew: true, ...o };
    const P = PLATFORMS[kind];
    return { mode: kind === 'arm' ? 'ideal' : this.opts.pos, drift: P.drift, deskew: this.opts.deskew, voxel: this.app.sceneId === 'aussen' || this.app.sceneId === 'pruef' ? 0.35 : 0.2, ...o };
  }

  // Kollisionsprüfung: Hindernisse (Hüllquader anderer Objekte) und Szenengrenzen; liefert eine Prüffunktion je Punkt
  obstacles(radius, ignore) {
    const w = this.world, b = w.bounds;
    const boxes = [];
    for (const o of w.objects) {
      if (o === ignore || !o.root.parent || o === (this.cur && this.cur.reg) || o.kind === 'scanner') continue;
      if (o.static && !o.root.userData.collider) continue;
      if (!o.root.userData.collider && !o.solid && o.kind !== 'person' && o.kind !== 'möbel' && o.kind !== 'prüfmittel' && o.kind !== 'fahrzeug') continue;
      const bx = new THREE.Box3().setFromObject(o.root);
      if (bx.max.y < 0.06 || bx.min.y > 1.6) continue;
      boxes.push([bx, o]);
    }
    return (p) => {
      if (b && (p.x < b[0] + radius || p.x > b[1] - radius || p.y < b[2] + radius || p.y > b[3] - radius)) return 'Raumgrenze';
      for (const [bx, o] of boxes) if (p.x > bx.min.x - radius && p.x < bx.max.x + radius && p.y > bx.min.z - radius && p.y < bx.max.z + radius) return o.name;
      return null;
    };
  }
  pathBlocked(path, radius, ignore) {
    const hit = this.obstacles(radius, ignore);
    for (let k = 0; k < path.P.length; k += 2) { const w = hit(path.P[k]); if (w) return { what: w, p: path.P[k] }; }
    return null;
  }
  // freie Bahn um das Ziel: Wunschabstand, sonst schrittweise weiter bzw. näher. Mit arc: ist keine Runde frei,
  // reicht auch der längste freie Bogen (mindestens ein Viertel des Umfangs) – zu Fuß geht man dann hin und zurück.
  findPath(target, want, radius, arc = false) {
    const fp = footprint(target.root);
    const tries = [want];
    for (let k = 1; k <= 10; k++) { tries.push(want + k * 0.25); if (want - k * 0.15 >= 0.5) tries.push(want - k * 0.15); }
    let last = null;
    for (const R of tries) {
      const path = orbitPath(fp, R);
      const bl = this.pathBlocked(path, radius, target);
      if (!bl) return { path, R, fp };
      last = bl;
    }
    if (arc) {
      let best = null;
      for (const R of tries.slice().sort((x, y) => Math.abs(x - want) - Math.abs(y - want))) {
        const path = orbitPath(fp, R), hit = this.obstacles(radius, target), N = path.P.length;
        const free = path.P.map((p) => !hit(p));
        if (free.every(Boolean)) return { path, R, fp };
        // längster freier Lauf auf dem geschlossenen Ring
        let run = 0, bestRun = 0, bestEnd = -1;
        for (let k = 0; k < 2 * N; k++) { if (free[k % N]) { run++; if (run > bestRun && run <= N) { bestRun = run; bestEnd = k; } } else run = 0; }
        if (bestRun >= N * 0.15 && (!best || bestRun / N > best.frac + 0.05)) {
          const k0 = bestEnd - bestRun + 1;
          const s0 = path.S[((k0 % N) + N) % N] + 0.15, s1 = s0 + (path.S[1] - path.S[0]) * (bestRun - 1) - 0.3;
          best = { path, R, fp, arc: [s0, s1], frac: bestRun / N };
        }
        if (best && best.frac > 0.45) break;
      }
      if (best) return best;
    }
    return { error: `Keine freie Bahn um „${target.name}“ – Hindernis: ${last ? last.what : '?'}` };
  }

  /* ---------- Autoscan ---------- */
  get running() { return !!this.job; }

  start() {
    const a = this.app, d = a.dev, c = this.cur;
    if (this.job) { this.stopJob('Autoscan abgebrochen'); return; }
    if (!d || !c) { toast('Erst eine Plattform wählen (Halterung).', 'warn'); return; }
    if (a.fpc.recording) a.fpc.toggleRecord();
    const target = c.kind === 'arm' ? this.studioObject() : this.defaultTarget();
    if (!target) { toast('Kein Zielobjekt in der Szene.', 'warn'); return; }
    const job = { kind: c.kind, target, phase: 'Vorbereitung', progress: 0, t0: a.clock.t, status: '' };
    this.job = job;
    try {
      if (c.kind === 'rover') this.startRover(job);
      else if (c.kind === 'arm') this.startArm(job);
      else if (c.kind === 'drohne') this.startDrone(job);
      else if (c.kind === 'hand') this.startHand(job);
    } catch (e) {
      console.error(e);
      this.job = null;
      toast(e.message || String(e), 'warn');
    }
    a.fpc.render();
  }

  beginRecording(job, extra = {}) {
    const a = this.app, d = a.dev;
    if (d.kind === 'tls') return;
    if (d.kind === 'phone') { a.phone.begin(job); job.phone = true; return; }
    if (d.state !== 'stream') d.start();
    const P = PLATFORMS[job.kind];
    const mode = job.kind === 'arm' ? 'Drehteller' : { ideal: 'Referenz', odo: P.odoName, slam: 'SLAM' }[this.opts.pos];
    job.scan = a.fpc.toggleRecord({ name: `${P.short} · ${job.target.name} · ${mode}`, ...extra });
    job.recording = true;
    a.top.render();
  }

  stopJob(msg, ok = false) {
    const j = this.job, a = this.app;
    if (!j) return;
    this.job = null;
    if (j.task) j.task.cancel();
    const c = this.cur;
    if (c && c.robot && c.kind === 'rover') c.robot.setWheels(0, 0);
    if (this.world.turntable) this.world.turntable.speed = 0;
    if (j.recording && a.fpc.recording) a.fpc.toggleRecord();
    if (j.phone && a.phone.session) a.phone.finish();
    if (j.kind === 'rover' && a.dev && a.dev.state === 'tls') a.fpc.stationScan();
    if (msg) toast(msg, ok ? 'ok' : 'warn');
    a.fpc.render();
    a.top.render();
  }

  finish(job, msg) {
    if (this.job !== job) return;
    const a = this.app;
    if (job.recording && a.fpc.recording) a.fpc.toggleRecord();
    job.recording = false;
    if (job.phone && a.phone.session) { a.phone.finish(); msg = null; }
    this.job = null;
    if (this.world.turntable) this.world.turntable.speed = 0;
    if (msg) toast(msg, 'ok');
    if (job.scan && a.fpc.tab === 'live') { a.fpc.fit && a.fpc.fit(); }
    a.fpc.render();
    a.top.render();
  }

  // AMR-1: Bahn um das Objekt fahren (Pure-Pursuit-Regler), bei Laserscannern Stop-and-Go mit Stationsscans
  startRover(job) {
    const c = this.cur, rb = c.robot, o = this.opts.rover, a = this.app, self = this;
    const fp0 = footprint(job.target.root);
    const want = Math.max(o.dist, 0.6);
    const fnd = this.findPath(job.target, want, 0.3);
    if (fnd.error) { this.job = null; throw new Error(fnd.error); }
    const { path } = fnd;
    job.path = path; job.R = fnd.R;
    if (Math.abs(fnd.R - want) > 0.01) toast(`Abstand auf ${fnd.R.toFixed(2).replace('.', ',')} m angepasst (freie Bahn)`, 'warn');
    const tls = a.dev.kind === 'tls';
    rb.speed = 0.5;
    job.task = rb.run(function* () {
      job.phase = 'Fahrt zur Bahn';
      const f = rb.frame();
      let s0 = pathNearest(path, f.p.x, f.p.z);
      const p0 = pathAt(path, s0);
      if (Math.hypot(p0.x - f.p.x, p0.y - f.p.z) > 0.15) yield* rb.driveTo(p0.x, p0.y, 0.06);
      const p1 = pathAt(path, s0 + 0.3);
      yield* rb.turnBy(wrap(Math.atan2(p1.x - p0.x, p1.y - p0.y) - rb.frame().yaw));
      yield* rb.wait(0.4);
      s0 = pathProject(path, rb.frame().p.x, rb.frame().p.z, s0, 0.3, 0.6);
      const laps = tls ? 1 : o.laps;
      const sEnd = s0 + path.L * laps;
      const stops = tls ? Array.from({ length: o.stations }, (_, k) => s0 + path.L * k / o.stations) : [];
      let si = 0;
      if (!tls) { self.beginRecording(job); job.phase = 'Umrundung'; }
      let s = s0, t = 0, lastS = s0, stuck = 0, v = 0;
      for (;;) {
        // Stop-and-Go: an der nächsten Station anhalten und einen Stationsscan auslösen
        if (tls && si < stops.length && s >= stops[si] - 0.03) {
          rb.setWheels(0, 0);
          job.phase = `Station ${si + 1}/${stops.length}: Stillstand, Stationsscan`;
          yield* rb.wait(1.2);
          let done = false;
          a.fpc.stationScan().then(() => { done = true; }, () => { done = true; });
          while (!done) yield;
          si++;
          if (si >= stops.length) break;
          job.phase = `Fahrt zu Station ${si + 1}`;
          v = 0;
        }
        const dt = yield;
        t += dt;
        const fr = rb.frame();
        s = pathProject(path, fr.p.x, fr.p.z, s, 0.1, 0.6);
        if (!tls && s >= sEnd) break;
        const LA = 0.45;
        const look = pathAt(path, s + LA);
        const dx = look.x - fr.p.x, dz = look.y - fr.p.z, ld = Math.hypot(dx, dz);
        const err = wrap(Math.atan2(dx, dz) - fr.yaw);
        const kappa = 2 * Math.sin(err) / Math.max(0.25, ld);
        const rest = tls ? stops[si] - s : sEnd - s;
        let vWant = o.speed * clamp(1 - Math.abs(err) / 1.2, 0.25, 1);
        vWant = Math.min(vWant, 0.1 + Math.max(0, rest) * 0.9);
        v += clamp(vWant - v, -0.6 * dt, 0.4 * dt);
        const om = clamp(v * kappa, -1.4, 1.4);
        rb.setWheels(v - om * TRACK / 2, v + om * TRACK / 2);
        job.progress = tls ? (si + clamp(1 - rest / (path.L / stops.length), 0, 1)) / stops.length : clamp((s - s0) / (sEnd - s0), 0, 1);
        if (s - lastS > 0.05) { lastS = s; stuck = 0; } else if ((stuck += dt) > 5) throw Object.assign(new Error(`Fahrweg blockiert bei ${fr.p.x.toFixed(1)} / ${fr.p.z.toFixed(1)} m`), { friendly: true });
      }
      rb.setWheels(0, 0);
      yield* rb.wait(0.6);
    });
    job.poll = () => {
      if (!job.task.done()) return;
      if (job.task.error) { this.stopJob('Autoscan gestoppt: ' + job.task.error); return; }
      const sc = job.scan;
      this.finish(job, tls ? `Stop-and-Go fertig: ${o.stations} Stationen um „${job.target.name}“ – jetzt unter „Ausrichten“ registrieren` : `Umrundung fertig: ${sc ? sc.points.toLocaleString('de-DE') : 0} Punkte, ${path.L.toFixed(1).replace('.', ',')} m Bahn`);
    };
    job.fp = fp0;
  }

  // KX-5 + Drehteller: je Bahn Arm positionieren, Drehteller 360° drehen; Punkte in Drehteller-Koordinaten
  startArm(job) {
    const c = this.cur, arm = c.robot, w = this.world, T = w.turntable, o = this.opts.arm, self = this;
    const rings = this.armRings(o.rings);
    if (!rings.length) { this.job = null; throw new Error('Arbeitsraum zu klein: keine Bahn für diesen Scanner erreichbar (Mindestabstand).'); }
    if (rings.length < Math.min(o.rings, 3)) toast(`Nur ${rings.length} von ${o.rings} Bahnen erreichbar (Arbeitsraum/Mindestabstand)`, 'warn');
    const fp = c.fp, pl = c.plate;
    const crop = { r: 0.4, y0: pl.y + 0.03, y1: fp.top + 0.25 };
    job.rings = rings;
    job.task = arm.run(function* () {
      for (let i = 0; i < rings.length; i++) {
        const R = rings[i];
        job.phase = `Bahn ${i + 1}/${rings.length}: Arm fährt auf ${R.e > 0 ? '+' : ''}${R.e}°`;
        const deg = (v) => v / DEG;
        yield* arm.moveTo({ basis: 0, schulter: deg(R.q.schulter), ellbogen: deg(R.q.ellbogen), handgelenk: deg(R.q.handgelenk), handdrehung: c.roll }, 0.45, true, true);
        yield* arm.wait(0.8);
        if (!job.recording) self.beginRecording(job, { turntable: { plate: T.plate, cx: pl.x, cz: pl.z, crop } });
        job.phase = `Bahn ${i + 1}/${rings.length}: Drehteller 360°`;
        const a0 = T.angle;
        T.speed = 2 * Math.PI / o.rev;
        while (T.angle - a0 < 2 * Math.PI) { yield; job.progress = (i + (T.angle - a0) / (2 * Math.PI)) / rings.length; }
        T.speed = 0;
        T.angle = a0 + 2 * Math.PI;
        T.plate.rotation.y = T.angle;
        yield* arm.wait(0.3);
      }
      job.phase = 'Arm fährt zurück';
      job.progress = 1;
    });
    job.poll = () => {
      if (!job.task.done()) return;
      if (job.task.error) { this.stopJob('Autoscan gestoppt: ' + job.task.error); return; }
      const sc = job.scan;
      this.finish(job, `Drehteller-Scan fertig: ${rings.length} ${rings.length === 1 ? 'Bahn' : 'Bahnen'}, ${sc ? sc.points.toLocaleString('de-DE') : 0} Punkte von „${job.target.name}“`);
    };
  }

  // Drohne: Rasterflug (Rasenmäher) oder Umrundung; kinematisch mit Beschleunigungsgrenzen, Neigung und Böen
  startDrone(job) {
    const c = this.cur, o = this.opts.drohne, st = c.st;
    const fp = footprint(job.target.root);
    const indoor = !!this.world.bounds;
    const ceil = indoor ? (this.app.sceneId === 'halle' ? 6.6 : this.app.sceneId === 'wohnung' ? 2.2 : 2.8) : 120;
    const alt = clamp(o.alt || (indoor ? Math.min(ceil, fp.top + 1.3) : Math.max(fp.top + 6, 14)), fp.top + 0.8, ceil);
    const agl = Math.max(1, alt - Math.max(0, fp.bottom));
    const speed = Math.min(o.speed, indoor ? 1.0 : 8);
    const wps = [];
    const home = st.p.clone();
    wps.push(new THREE.Vector3(home.x, alt, home.z));
    const cy = Math.cos(fp.yaw), sy = Math.sin(fp.yaw);
    const W = (x, z, y = alt) => new THREE.Vector3(fp.cx + cy * x + sy * z, y, fp.cz - sy * x + cy * z);
    if (o.pattern === 'orbit') {
      const R = Math.max(fp.hx, fp.hz) + (indoor ? 1.2 : 6);
      const yo = indoor ? alt : Math.max(fp.top * 0.6, alt * 0.55);
      for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2; wps.push(W(Math.cos(a) * R, Math.sin(a) * R, yo)); }
    } else {
      const fov = typeof this.app.dev.spec.data.fovH === 'number' && this.app.dev.spec.data.fovH < 200 ? this.app.dev.spec.data.fovH : 90;
      const swath = 2 * agl * Math.tan(Math.min(60, fov / 2) * DEG);
      const sp = Math.max(0.8, swath * (1 - o.overlap));
      const mx = fp.hx + agl * 0.5, mz = fp.hz + agl * 0.5;
      const long = mx >= mz;
      const A = long ? mx : mz, B = long ? mz : mx;
      const n = Math.max(2, Math.ceil(2 * B / sp) + 1);
      for (let k = 0; k < n; k++) {
        const u = -B + 2 * B * k / (n - 1);
        const a0 = k % 2 ? A : -A, a1 = -a0;
        if (long) { wps.push(W(a0, u)); wps.push(W(a1, u)); } else { wps.push(W(u, a0)); wps.push(W(u, a1)); }
      }
    }
    wps.push(new THREE.Vector3(home.x, alt, home.z));
    wps.push(new THREE.Vector3(home.x, 0, home.z));
    job.wps = wps;
    let i = 0, recStarted = false;
    const total = wps.length;
    job.gen = (function* (self) {
      job.phase = 'Start und Steigflug';
      for (;;) {
        const dt = yield;
        const tgt = wps[i];
        const d = tgt.clone().sub(st.p);
        const dist = d.length();
        const last = i === total - 1;
        if (dist < (last ? 0.03 : 0.25)) {
          i++;
          if (i === 2 && !recStarted) { recStarted = true; self.beginRecording(job); job.phase = o.pattern === 'orbit' ? 'Umrundung' : 'Rasterflug'; }
          if (i === total - 2 && job.recording) { self.app.fpc.toggleRecord(); job.recording = false; job.phase = 'Rückflug und Landung'; }
          if (i >= total) break;
          continue;
        }
        const vmax = i === 0 || last ? 1.2 : speed;
        // Wunschgeschwindigkeit mit Bremsweg zum Wegpunkt (an Wendepunkten abbremsen)
        const vStop = Math.sqrt(2 * 1.5 * Math.max(0, dist - 0.1)) + 0.15;
        const vw = d.normalize().multiplyScalar(Math.min(vmax, vStop));
        const dv = vw.sub(st.v);
        const amax = 2.0 * dt;
        if (dv.length() > amax) dv.setLength(amax);
        st.a.copy(dv).divideScalar(Math.max(dt, 1e-3));
        st.v.add(dv);
        st.p.addScaledVector(st.v, dt);
        // Kurs folgt der Flugrichtung (max. 50°/s), beim Steigen/Sinken bleibt er
        const hv = Math.hypot(st.v.x, st.v.z);
        if (hv > 0.3) { const want = Math.atan2(st.v.x, st.v.z); st.yaw += clamp(wrap(want - st.yaw), -50 * DEG * dt, 50 * DEG * dt); }
        job.progress = clamp(i / total, 0, 1);
      }
      job.progress = 1;
    })(this);
    job.gen.next();
    job.poll = () => { if (job.genDone) this.finish(job, `Flug beendet: ${job.scan ? job.scan.points.toLocaleString('de-DE') : 0} Punkte`); };
  }

  // Handgeführt: Rundgang um das Objekt mit natürlichem Gang (Schritte, Wiegen, Handzittern).
  // Mit dem Smartphone zielt die Hand auf das Objekt (und wandert dabei auf und ab) oder erfasst den Raum
  // durch Drehen auf der Stelle.
  startHand(job) {
    const c = this.cur, o = this.opts.hand, st = c.st, self = this;
    const phone = this.app.dev.kind === 'phone';
    const room = phone && o.phoneMode === 'raum';
    const pr = c.person;
    c.aim = null;
    if (room) {
      const turns = 2, T = 28 / Math.max(0.3, o.speed);
      job.gen = (function* () {
        self.beginRecording(job);
        job.phase = 'Raum rundum erfassen';
        const y0 = pr.rotation.y;
        let t = 0;
        while (t < T * turns) {
          const dt = yield;
          t += dt;
          const u = t / T;
          pr.rotation.y = y0 + u * Math.PI * 2;
          const pitch = (Math.floor(u) % 2 ? 14 : -22) * DEG;
          const hd = pr.rotation.y;
          const g = c.grip.getWorldPosition(new THREE.Vector3());
          c.aim = new THREE.Vector3(g.x + Math.sin(hd) * 3 * Math.cos(pitch), g.y + Math.sin(pitch) * 3, g.z + Math.cos(hd) * 3 * Math.cos(pitch));
          self.gait(dt, false);
          job.progress = Math.min(1, t / (T * turns));
        }
      })();
      job.gen.next();
      job.poll = () => { if (job.genDone) this.finish(job, 'Raum erfasst'); };
      return;
    }
    const fpT = footprint(job.target.root);
    const want = phone ? Math.max(0.8, 0.55 + (o.phoneDist || 0.9)) : Math.max(0.8, o.dist);
    const fnd = this.findPath(job.target, want, 0.28, true);
    if (fnd.error) { this.job = null; throw new Error(fnd.error); }
    const path = fnd.path;
    job.path = path;
    // Abschnitte: geschlossene Runde(n) oder freier Bogen hin und zurück
    let legs;
    if (fnd.arc) legs = [[fnd.arc[0], fnd.arc[1]], [fnd.arc[1], fnd.arc[0]]];
    else { const s0 = pathNearest(path, pr.position.x, pr.position.z); legs = [[s0, s0 + path.L * (phone ? Math.max(1.05, o.laps) : o.laps)]]; }
    if (fnd.arc) toast(`Rundum nicht frei – Bogen über ${Math.round(fnd.frac * 100)} % des Umfangs, hin und zurück`, 'warn');
    const total = legs.reduce((a2, l) => a2 + Math.abs(l[1] - l[0]), 0);
    const speed = phone ? Math.min(o.speed, 0.6) : o.speed;
    const ctr = new THREE.Vector3(fpT.cx, (fpT.top + Math.max(0, fpT.bottom)) / 2, fpT.cz);
    job.gen = (function* () {
      job.phase = 'Gang zum Startpunkt';
      const p0 = pathAt(path, legs[0][0]);
      for (;;) {
        const dt = yield;
        const dx = p0.x - pr.position.x, dz = p0.y - pr.position.z, dd = Math.hypot(dx, dz);
        if (dd < 0.05) break;
        const step = Math.min(dd, speed * dt);
        pr.position.x += dx / dd * step; pr.position.z += dz / dd * step;
        pr.rotation.y += clamp(wrap(Math.atan2(dx, dz) - pr.rotation.y), -2 * dt, 2 * dt);
        if (phone) c.aim = ctr;
        self.gait(dt, true);
      }
      self.beginRecording(job);
      job.phase = fnd.arc ? 'Bogen (hin)' : 'Rundgang';
      let done = 0;
      for (let li = 0; li < legs.length; li++) {
        const [a0, a1] = legs[li], dir = Math.sign(a1 - a0) || 1, len = Math.abs(a1 - a0);
        if (li === 1) job.phase = 'Bogen (zurück)';
        let s = a0, v = 0, turned = false;
        // am Wendepunkt erst umdrehen (mit dem Smartphone: zum Objekt drehen)
        while (!turned) {
          const dt = yield;
          const q = pathAt(path, s + 0.35 * dir), p = pathAt(path, s);
          const err = wrap((phone ? Math.atan2(ctr.x - p.x, ctr.z - p.y) : Math.atan2(q.x - p.x, q.y - p.y)) - pr.rotation.y);
          pr.rotation.y += clamp(err, -0.8 * dt, 0.8 * dt);
          self.gait(dt, false);
          if (phone) c.aim = ctr;
          turned = Math.abs(err) < 0.1;
        }
        while ((s - a0) * dir < len) {
          const dt = yield;
          v = Math.min(speed, v + 0.8 * dt);
          s += v * dt * dir;
          const p = pathAt(path, s), q = pathAt(path, s + 0.35 * dir);
          pr.position.set(p.x, 0, p.y);
          // zu Fuß in Laufrichtung; mit dem Smartphone seitwärts gehen und dabei zum Objekt schauen
          const face = phone ? Math.atan2(ctr.x - p.x, ctr.z - p.y) : Math.atan2(q.x - p.x, q.y - p.y);
          pr.rotation.y += clamp(wrap(face - pr.rotation.y), -1.5 * dt, 1.5 * dt);
          const u = (done + Math.abs(s - a0)) / total;
          // Smartphone: auf das Objekt zielen, Hand wandert zwischen hoch und tief (Ober- und Unterseiten)
          const lift = phone ? (fnd.arc ? (li === 0 ? 0.18 : -0.2) : 0.22 * Math.sin(u * Math.PI * 4)) : 0;
          if (phone) c.aim = ctr.clone().setY(ctr.y + (fpT.top - fpT.bottom) * 0.25 * Math.sign(lift || 1) * Math.min(1, Math.abs(lift) / 0.18));
          self.gait(dt, true, lift);
          job.progress = clamp(u, 0, 1);
        }
        done += len;
      }
      for (let t = 0; t < 0.6;) { t += yield; self.gait(0, false); }
    })();
    job.gen.next();
    job.poll = () => { if (job.genDone) this.finish(job, `Rundgang fertig: ${job.scan ? job.scan.points.toLocaleString('de-DE') : 0} Punkte, ${path.L.toFixed(1).replace('.', ',')} m`); };
  }

  // Gangbild: Schrittfrequenz 1,8 Hz, Auf und Ab ±2 cm, seitliches Wiegen, Arm- und Beinschwung, Handzittern
  gait(dt, walking, lift = 0) {
    const c = this.cur, st = c.st;
    st.t += dt;
    const t = st.t, w = walking ? 1 : 0;
    const ph = t * 1.8 * Math.PI;
    const L = c.person.userData.limbs;
    L.legs[0].rotation.x = Math.sin(ph) * 0.42 * w; L.legs[1].rotation.x = -Math.sin(ph) * 0.42 * w;
    L.arms[1].rotation.x = Math.sin(ph) * 0.3 * w;
    L.arms[0].rotation.x = -1.2 - lift * 1.6;
    c.person.position.y = w * 0.02 * Math.abs(Math.sin(ph));
    const g = c.grip;
    g.position.set(-0.2 + 0.018 * Math.sin(ph / 2) * w, 1.2 + lift - 0.012 * Math.cos(ph * 2) * w, 0.6 - Math.abs(lift) * 0.2);
    if (c.aim) {
      // Hand richtet das Gerät auf den Zielpunkt, dazu leichtes Zittern
      c.person.updateMatrixWorld(true);
      g.lookAt(c.aim);
      g.rotateX(0.012 * Math.sin(ph / 2 + 0.7) * w + 0.003 * Math.sin(t * 23));
      g.rotateY(0.015 * Math.sin(ph / 2) * w + 0.003 * Math.sin(t * 17));
    } else {
      g.rotation.set(0.03 * Math.sin(ph / 2 + 0.7) * w + 0.004 * Math.sin(t * 23), 0.04 * Math.sin(ph / 2) * w + 0.003 * Math.sin(t * 17), 0.025 * Math.sin(ph / 2 + 1.3) * w);
    }
  }

  /* ---------- je Bild ---------- */
  update(dt) {
    const c = this.cur, j = this.job;
    if (c && c.kind === 'drohne') this.updateDrone(dt);
    if (!j) return;
    if (j.gen && dt > 0 && !j.genDone) {
      try { if (j.gen.next(dt).done) j.genDone = true; } catch (e) { console.error(e); this.stopJob('Autoscan gestoppt: ' + (e.message || e)); return; }
    }
    if (j.poll) j.poll();
  }

  updateDrone(dt) {
    const c = this.cur, st = c.st, D = c.drone;
    st.t += dt;
    const flying = st.p.y > 0.02;
    // Neigung aus Beschleunigung und Luftwiderstand, Böen als Überlagerung mehrerer Frequenzen
    const t = st.t;
    const fwd = new THREE.Vector3(Math.sin(st.yaw), 0, Math.cos(st.yaw)), right = new THREE.Vector3(-Math.cos(st.yaw), 0, Math.sin(st.yaw));
    const ah = st.a.clone().add(st.v.clone().multiplyScalar(0.25));
    const pitch = flying ? Math.atan2(ah.dot(fwd), 9.81) + 0.006 * Math.sin(t * 2.3) + 0.004 * Math.sin(t * 5.1 + 1) : 0;
    const roll = flying ? Math.atan2(ah.dot(right), 9.81) + 0.006 * Math.sin(t * 1.7 + 2) + 0.004 * Math.sin(t * 4.3) : 0;
    const gust = flying ? new THREE.Vector3(0.02 * Math.sin(t * 0.9), 0.015 * Math.sin(t * 1.3 + 1), 0.02 * Math.sin(t * 0.7 + 2)) : new THREE.Vector3();
    D.group.position.copy(st.p).add(gust);
    D.group.rotation.set(pitch, st.yaw, roll, 'YXZ');
    for (const p of D.props) p.rotation.y += dt * (flying ? 90 : 0);
  }
}
