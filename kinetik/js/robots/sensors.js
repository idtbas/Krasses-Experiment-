// Sensorik: Abstand (Ultraschall/ToF), Farbe, Linie, Kontakt, Kamera, LiDAR (2D/3D/Sicherheit),
// Radar (FMCW mit Doppler), Wärmebild, RFID, Code-Scanner und Kraft-Momenten-Sensor.
// Alle Messungen laufen über die Physik (Strahlen, Kontakte), nicht über Abkürzungen.
import * as THREE from 'three';
import { qrot, vnorm, RAD, DEG, clamp } from '../core/util.js';
import { COLORS } from '../lang/commands.js';

export function worldPose(part, lp, ld) {
  const b = part.body;
  const p = b.translation(), q = b.rotation();
  const o = qrot(q, lp);
  return { o: { x: p.x + o.x, y: p.y + o.y, z: p.z + o.z }, d: vnorm(qrot(q, ld)), q };
}

// Senkrechte zu d (für Fächer und Messflecken)
function basis(d) {
  const a = Math.abs(d.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = vnorm({ x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x });
  const v = { x: d.y * u.z - d.z * u.y, y: d.z * u.x - d.x * u.z, z: d.x * u.y - d.y * u.x };
  return { u, v };
}

// Turbo-Farbskala (0..1) für Entfernungen
export function turbo(t, out = [0, 0, 0]) {
  t = clamp(t, 0, 1);
  out[0] = clamp(0.1357 + t * (4.5974 - t * (42.3277 - t * (130.5887 - t * (150.5666 - t * 58.1375)))), 0, 1);
  out[1] = clamp(0.0914 + t * (2.1856 + t * (4.8052 - t * (14.0195 - t * (4.2109 + t * 2.7747)))), 0, 1);
  out[2] = clamp(0.1067 + t * (12.5925 - t * (60.1097 - t * (109.0745 - t * (88.5066 - t * 26.8183)))), 0, 1);
  return out;
}

const beamMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.55, depthWrite: false });
const coneMat = new THREE.MeshBasicMaterial({ color: '#4fd1ff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
const dotMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
const beamGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2);
const coneGeo = new THREE.ConeGeometry(Math.tan(7.5 * DEG), 1, 24, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
const dotGeo = new THREE.SphereGeometry(0.008, 10, 8);

// Sichtweite in Metern bei Nebel (∞ ohne Nebel)
export function visibility(sim) { const f = sim.env ? sim.env.fog : 0; return f > 0 ? 1.2 + 14 * (1 - f) * (1 - f) : Infinity; }

/* ---------------- Abstand ---------------- */

export class DistanceSensor {
  constructor(robot, part, pos, dir, range = 2, kind = 'ultraschall') {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir; this.range = range; this.kind = kind;
    this.value = range * 100;
    this.beam = new THREE.Mesh(kind === 'tof' ? beamGeo : coneGeo, kind === 'tof' ? beamMat : coneMat);
    this.dot = new THREE.Mesh(dotGeo, dotMat);
    this.beam.visible = this.dot.visible = false;
    robot.sim.renderer.helpers.add(this.beam, this.dot);
    this.hitPoint = null;
  }
  measure() {
    const { o, d } = worldPose(this.part, this.pos, this.dir);
    const ph = this.robot.sim.physics;
    let range = this.range;
    // Licht (ToF) leidet unter Nebel, Schall nicht
    if (this.kind === 'tof') range = Math.min(range, visibility(this.robot.sim));
    let best = ph.ray(o, d, range, this.robot.rayGroups);
    if (this.kind === 'ultraschall') {
      // Schallkeule: fünf Strahlen, der kürzeste gewinnt
      const { u, v } = basis(d);
      const k = Math.tan(7 * DEG);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const dd = vnorm({ x: d.x + (u.x * a + v.x * b) * k, y: d.y + (u.y * a + v.y * b) * k, z: d.z + (u.z * a + v.z * b) * k });
        const h = ph.ray(o, dd, range, this.robot.rayGroups);
        if (h && (!best || h.dist < best.dist)) best = h;
      }
    }
    this.origin = o; this.direction = d;
    this.hitPoint = best ? best.point : null;
    this.value = best ? Math.round(Math.max(this.kind === 'ultraschall' ? 0.02 : 0, best.dist) * 1000) / 10 : this.range * 100;
    return this.value;
  }
  read() { return this.measure(); }
  update() { this.measure(); }
  show(on) {
    if (!on || !this.origin) { this.beam.visible = this.dot.visible = false; return; }
    const len = (this.value / 100);
    this.beam.visible = true;
    this.beam.position.set(this.origin.x, this.origin.y, this.origin.z);
    this.beam.lookAt(this.origin.x + this.direction.x, this.origin.y + this.direction.y, this.origin.z + this.direction.z);
    this.beam.scale.set(this.kind === 'tof' ? 1 : len, this.kind === 'tof' ? 1 : len, Math.max(0.001, len));
    this.dot.visible = !!this.hitPoint && this.kind === 'tof';
    if (this.hitPoint) this.dot.position.set(this.hitPoint.x, this.hitPoint.y, this.hitPoint.z);
  }
  dispose() { this.beam.removeFromParent(); this.dot.removeFromParent(); }
}

/* ---------------- Farbe, Linie, Kontakt ---------------- */

function colorLight(name) {
  const hex = COLORS[name];
  if (!hex) return 50;
  const c = new THREE.Color(hex);
  return Math.round((0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 100);
}

export class ColorSensor {
  constructor(robot, part, pos, dir, range = 0.09) {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir; this.range = range;
  }
  sample() {
    const { o, d } = worldPose(this.part, this.pos, this.dir);
    const ph = this.robot.sim.physics;
    let hit = ph.ray(o, d, this.range, this.robot.rayGroups);
    // Messfleck statt Nadelstrich: trifft der Mittelstrahl nichts Buntes, die Ränder prüfen
    if (!hit || !(hit.info && hit.info.entity && hit.info.entity.isObject)) {
      const { u, v } = basis(d);
      for (const [k1, k2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r = 0.014;
        const oo = { x: o.x + (u.x * k1 + v.x * k2) * r, y: o.y + (u.y * k1 + v.y * k2) * r, z: o.z + (u.z * k1 + v.z * k2) * r };
        const hh = ph.ray(oo, d, this.range, this.robot.rayGroups);
        if (hh && hh.info && hh.info.entity && hh.info.entity.isObject) { hit = hh; break; }
      }
    }
    if (!hit) return { color: 'keine', light: 0 };
    const info = hit.info || {};
    if (info.entity && info.entity.isObject) {
      const color = info.entity.color || 'grau';
      return { color, light: colorLight(color) };
    }
    const f = this.robot.sim.floorAt(hit.point.x, hit.point.z, hit.point.y);
    if (f.priority > 0 || info.kind === 'floor') return { color: f.color, light: f.light };
    const color = info.color || (info.entity && info.entity.color) || 'grau';
    return { color, light: colorLight(color) };
  }
  read() { return this.sample().color; }
  light() { return this.sample().light; }
}

export class LineSensors {
  constructor(robot, part, points) {
    this.robot = robot; this.part = part; this.points = points; // { links: {x,y,z}, rechts: {...} }
  }
  at(side) {
    const { o, d } = worldPose(this.part, this.points[side], { x: 0, y: -1, z: 0 });
    const hit = this.robot.sim.physics.ray(o, d, 0.25, this.robot.rayGroups);
    if (!hit) return { color: 'keine', light: 0 };
    if (hit.info && hit.info.entity && hit.info.entity.isObject) return { color: hit.info.entity.color, light: 50 };
    return this.robot.sim.floorAt(hit.point.x, hit.point.z, hit.point.y);
  }
  read(side) { return this.at(side).light < 35; }
  light() { return Math.round((this.at('links').light + this.at('rechts').light) / 2); }
}

export class TouchSensor {
  constructor(robot, colliders) { this.robot = robot; this.colliders = colliders; }
  read() {
    const ph = this.robot.sim.physics;
    let hit = false;
    for (const c of this.colliders) {
      ph.contacts(c, (other) => {
        const info = ph.infoOf(other);
        if (info && info.robot === this.robot) return;
        if (info && info.kind === 'floor' && this.ignoreFloor) return;
        hit = true;
      });
      if (hit) return true;
    }
    return false;
  }
}

/* ---------------- Kamera ---------------- */

export class Camera {
  constructor(robot, part, pos, dir, fov = 75, range = 3.5, opts = {}) {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir;
    this.fov = fov * Math.PI / 180; this.range = range;
    this.depth = !!opts.depth;
    this.feedFov = opts.feedFov || 62;
    this.model = opts.model || 'RGB';
    this.lastWarn = -10;
  }
  pose() { return worldPose(this.part, this.pos, this.dir); }

  // Beleuchtung am Ziel prüfen (Farbkameras brauchen Licht)
  litEnough(p) { return this.robot.sim.illumination(p) >= 0.22; }

  // nächster sichtbarer Gegenstand dieser Farbe
  find(color, opts = {}) {
    color = String(color || '').toLowerCase();
    const { o, d } = this.pose();
    const sim = this.robot.sim;
    const range = Math.min(this.range, visibility(sim));
    let best = null, dark = false;
    for (const e of sim.entities) {
      if (!e.color || e.color !== color || e === this.robot) continue;
      if (!(e.isObject || e.kind === 'zone' || e.kind === 'kiste' || e.kind === 'ziel' || e.kind === 'lampe')) continue;
      if (opts.objectsOnly && !e.isObject) continue;
      if (opts.exclude && opts.exclude(e)) continue;
      // schon einsortiert (liegt in Zone/Kiste der eigenen Farbe)? Dann nicht noch einmal nehmen
      if (opts.skipSorted && e.isObject && sim.entities.some((z) => (z.kind === 'zone' || z.kind === 'kiste') && z.color === e.color && z.contains(e.body.translation()))) continue;
      if (opts.skipBinned && e.isObject && sim.entities.some((z) => z.kind === 'kiste' && z.contains(e.body.translation()))) continue;
      if (opts.placesFirst && e.isObject && sim.entities.some((z) => (z.kind === 'zone' || z.kind === 'kiste' || z.kind === 'ziel') && z.color === color)) continue;
      if (e.heldBy === this.robot && !opts.includeHeld) continue;
      const p = e.isObject ? e.body.translation() : e.center || { x: e.spec.x || 0, y: 0, z: e.spec.z || 0 };
      const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      if (dist > range || dist < 1e-3) continue;
      const cos = (v.x * d.x + v.y * d.y + v.z * d.z) / dist;
      const hcos = (v.x * d.x + v.z * d.z) / (Math.hypot(v.x, v.z) * Math.hypot(d.x, d.z) || 1);
      const fov = opts.fov ? Math.min(Math.PI * 2, opts.fov * Math.PI / 180) : this.fov;
      const inView = cos > Math.cos(fov / 2) || ((opts.wide || opts.fov) && hcos > Math.cos(fov / 2));
      if (!inView) continue;
      // Sichtlinie prüfen (nur bei Gegenständen mit Körper)
      if (e.isObject) {
        const hit = sim.physics.ray(o, { x: v.x / dist, y: v.y / dist, z: v.z / dist }, dist + 0.05, this.robot.rayGroups);
        if (hit && hit.info && hit.info.entity !== e && hit.dist < dist - 0.06 && !(hit.info.entity && hit.info.entity.heldBy === this.robot)) continue;
      }
      if (!this.litEnough(p)) { dark = true; continue; }
      const yawTo = Math.atan2(v.x, v.z), yawCam = Math.atan2(d.x, d.z);
      let bearing = -(yawTo - yawCam) * RAD;
      bearing = ((bearing + 540) % 360) - 180;
      const flat = Math.hypot(p.x - o.x, p.z - o.z);
      if (!best || flat < best.dist) best = { entity: e, dist: flat, bearing, pos: p };
    }
    if (!best && dark && sim.time - this.lastWarn > 4) {
      this.lastWarn = sim.time;
      this.robot.warn('Kamera: Beleuchtung zu gering für die Farberkennung. Scheinwerfer einschalten oder Wärmebild/LiDAR nutzen.');
    }
    return best;
  }

  // Alle erkannten Gegenstände im Bild (für die Geräteansicht)
  detections(maxN = 8) {
    const { o, d } = this.pose();
    const sim = this.robot.sim;
    const range = Math.min(this.range, visibility(sim));
    const out = [];
    for (const e of sim.objects) {
      if (e.heldBy === this.robot) continue;
      const p = e.body.translation();
      const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      if (dist > range || dist < 0.05) continue;
      if ((v.x * d.x + v.y * d.y + v.z * d.z) / dist < Math.cos(this.feedFov * DEG * 0.75)) continue;
      if (!this.litEnough(p)) continue;
      const hit = sim.physics.ray(o, { x: v.x / dist, y: v.y / dist, z: v.z / dist }, dist + 0.05, this.robot.rayGroups);
      if (hit && hit.info && hit.info.entity !== e && hit.dist < dist - 0.06) continue;
      out.push({ entity: e, dist });
      if (out.length >= maxN) break;
    }
    return out;
  }
}

/* ---------------- LiDAR ---------------- */

const lidarMat = new THREE.PointsMaterial({ size: 0.022, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
export const LIDAR_LAYER = 1;

/*
 * Rotierender Laserscanner. Tastet fortlaufend ab (ein Umlauf je 1/rate s), damit die Last
 * gleichmäßig verteilt ist. Winkel az: 0 = vorn, positiv = nach links (mathematisch positiv von oben).
 */
export class Lidar {
  constructor(robot, part, pos, opts = {}) {
    this.robot = robot; this.part = part; this.pos = pos;
    this.kind = opts.kind || '2d';
    this.hfov = (opts.hfov || 360) * DEG;
    this.channels = opts.channels || 1;
    this.vfov = (opts.vfov || 0) * DEG;
    this.range = opts.range || 12;
    this.minRange = opts.minRange || 0.05;
    this.rate = opts.rate || 10;
    this.steps = opts.steps || 360;
    this.safety = opts.safety || null; // { radius, sector }
    this.ranges = new Float32Array(this.steps).fill(this.range);
    this.refRanges = null;
    this.col = 0;
    this.acc = 0;
    this.scans = 0;
    const n = this.steps * this.channels;
    this.pts = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.valid = new Uint8Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pts, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.cloud = new THREE.Points(g, lidarMat);
    this.cloud.frustumCulled = false;
    this.cloud.visible = false;
    this.cloud.layers.enable(LIDAR_LAYER);
    robot.sim.renderer.helpers.add(this.cloud);
    this.violated = false;
    this.freeFor = 0;
    this.rgb = [0, 0, 0];
  }

  az(i) { return this.hfov >= Math.PI * 2 - 1e-6 ? (i / this.steps) * Math.PI * 2 : -this.hfov / 2 + (i / (this.steps - 1)) * this.hfov; }
  el(c) { return this.channels === 1 ? 0 : -this.vfov / 2 + (c / (this.channels - 1)) * this.vfov; }
  horizontalChannel() { return this.channels === 1 ? 0 : Math.round((this.channels - 1) / 2); }

  update(dt) {
    const rate = this.rate * (this.robot.computeScale || 1);
    this.acc += dt * rate * this.steps;
    let n = Math.floor(this.acc);
    if (!n) return;
    this.acc -= n;
    n = Math.min(n, this.steps);
    const b = this.part.body;
    const p = b.translation(), q = b.rotation();
    const lo = qrot(q, this.pos);
    const o = { x: p.x + lo.x, y: p.y + lo.y, z: p.z + lo.z };
    const ph = this.robot.sim.physics;
    const vis = visibility(this.robot.sim);
    const range = Math.min(this.range, vis * 1.4);
    const fogged = isFinite(vis);
    const hc = this.horizontalChannel();
    for (let k = 0; k < n; k++) {
      const i = this.col;
      const a = this.az(i);
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let c = 0; c < this.channels; c++) {
        const e = this.el(c);
        const ce = Math.cos(e), se = Math.sin(e);
        const d = qrot(q, { x: sa * ce, y: se, z: ca * ce });
        let hit = ph.ray(o, d, range, this.robot.rayGroups);
        // Nebel: einzelne Rückstreuungen und Ausfälle
        if (fogged && hit && Math.random() < clamp((hit.dist - vis * 0.6) / vis, 0, 0.8)) hit = null;
        const idx = i * this.channels + c;
        if (hit && hit.dist >= this.minRange) {
          this.pts[idx * 3] = hit.point.x; this.pts[idx * 3 + 1] = hit.point.y; this.pts[idx * 3 + 2] = hit.point.z;
          turbo(1 - hit.dist / Math.min(this.range, 8), this.rgb);
          this.colors[idx * 3] = this.rgb[0]; this.colors[idx * 3 + 1] = this.rgb[1]; this.colors[idx * 3 + 2] = this.rgb[2];
          this.valid[idx] = 1;
          if (c === hc) this.ranges[i] = hit.dist;
        } else {
          this.pts[idx * 3] = o.x; this.pts[idx * 3 + 1] = -100; this.pts[idx * 3 + 2] = o.z;
          this.valid[idx] = 0;
          if (c === hc) this.ranges[i] = this.range;
        }
      }
      this.col++;
      if (this.col >= this.steps) { this.col = 0; this.scans++; this.onScan(); }
    }
    this.dirty = true;
  }

  // Nach jedem vollen Umlauf: Schutzfeld auswerten
  onScan() {
    if (!this.safety) return;
    if (!this.refRanges && this.scans >= 1) this.refRanges = Float32Array.from(this.ranges);
    if (!this.refRanges) return;
    const R = this.safety.radius;
    let hit = false;
    for (let i = 0; i < this.steps; i++) {
      const a = Math.abs(this.az(i));
      if (this.safety.sector && a > this.safety.sector * DEG) continue;
      const lim = this.safety.contour ? Math.min(R, this.refRanges[i] - 0.06) : R;
      if (this.ranges[i] < lim && this.ranges[i] >= this.minRange) { hit = true; break; }
    }
    if (this.safety.onlyMoving && !this.safety.onlyMoving()) hit = false;
    const dtScan = 1 / this.rate;
    if (hit) { this.freeFor = 0; if (!this.violated) { this.violated = true; this.robot.safetyTrip(true); } }
    else if (this.violated) {
      this.freeFor += dtScan;
      if (this.freeFor >= (this.safety.restart ?? 0.5)) { this.violated = false; this.robot.safetyTrip(false); }
    }
  }
  resetReference() { this.refRanges = null; this.scans = 0; this.violated = false; this.freeFor = 0; }

  // Entfernung in Richtung (Grad, + = rechts) in m
  rangeAt(deg) {
    const a = -deg * DEG;
    let best = Infinity, bi = 0;
    for (let i = 0; i < this.steps; i++) {
      let d = Math.abs(((this.az(i) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < best) { best = d; bi = i; }
    }
    if (best > 4 * DEG) return this.range;
    let m = this.ranges[bi];
    for (const j of [bi - 1, bi + 1]) { const k = (j + this.steps) % this.steps; if (this.ranges[k] < m) m = this.ranges[k]; }
    return m;
  }
  nearest(sectorDeg = 180) {
    let best = { dist: this.range, bearing: 0 };
    for (let i = 0; i < this.steps; i++) {
      const a = this.az(i);
      const w = Math.abs(((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (w > sectorDeg * DEG) continue;
      const r = this.ranges[i];
      if (r >= this.minRange && r < best.dist) best = { dist: r, bearing: -(((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * RAD };
    }
    return best;
  }
  // Ist der Korridor vor dem Gerät (Breite w in m) auf Länge len frei?
  corridorFree(len, w = 0.36, headingDeg = 0) {
    const h = -headingDeg * DEG;
    for (let i = 0; i < this.steps; i++) {
      const a = this.az(i) - h;
      const r = this.ranges[i];
      if (r >= this.range - 1e-3 || r < this.minRange) continue;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (z > 0 && z < len && Math.abs(x) < w / 2) return false;
    }
    return true;
  }
  show(on) {
    this.cloud.visible = !!on;
    if (on && this.dirty) {
      this.cloud.geometry.attributes.position.needsUpdate = true;
      this.cloud.geometry.attributes.color.needsUpdate = true;
      this.dirty = false;
    }
  }
  dispose() { this.cloud.removeFromParent(); this.cloud.geometry.dispose(); }
}

/* ---------------- Radar ---------------- */

const radarFanMat = new THREE.MeshBasicMaterial({ color: '#3fd07a', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });

export class Radar {
  constructor(robot, part, pos, dir, opts = {}) {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir;
    this.fov = (opts.fov || 120) * DEG;
    this.range = opts.range || 20;
    this.rate = opts.rate || 15;
    this.t = 0;
    this.targets = [];
    this.clutter = [];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, 1, Math.PI / 2 - this.fov / 2, Math.PI / 2 + this.fov / 2, false);
    shape.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(shape, 24).rotateX(-Math.PI / 2);
    this.fan = new THREE.Mesh(g, radarFanMat);
    this.fan.visible = false;
    robot.sim.renderer.helpers.add(this.fan);
    this.lastPos = new Map();
  }

  pose() { return worldPose(this.part, this.pos, this.dir); }

  update(dt) {
    this.t += dt;
    if (this.t < 1 / this.rate) return;
    const T = this.t;
    this.t = 0;
    const { o, d } = this.pose();
    const sim = this.robot.sim;
    const yaw0 = Math.atan2(d.x, d.z);
    const selfV = this.robot.baseBody().linvel();
    const out = [];
    for (const e of sim.entities) {
      if (e === this.robot || !e.alive) continue;
      const body = e.isObject ? e.body : e.isRobot ? e.baseBody() : e.radarBody ? e.radarBody() : null;
      if (!body) continue;
      if (e.heldBy) continue;
      const p = body.translation();
      const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
      const dist = Math.hypot(v.x, v.z);
      if (dist < 0.2 || dist > this.range) continue;
      let az = Math.atan2(v.x, v.z) - yaw0;
      az = ((az + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(az) > this.fov / 2) continue;
      if (Math.abs(Math.atan2(v.y, dist)) > 18 * DEG && dist > 0.6) continue;
      // Radarquerschnitt: Metall reflektiert stark, kleine Kunststoff-/Holzteile schwach
      const rcs = e.rcs ? e.rcs() : 1;
      if (dist > this.range * Math.pow(rcs, 0.25)) continue;
      // Wände schirmen ab
      const dir = { x: v.x / Math.hypot(v.x, v.y, v.z), y: v.y / Math.hypot(v.x, v.y, v.z), z: v.z / Math.hypot(v.x, v.y, v.z) };
      const hit = sim.physics.ray(o, dir, Math.hypot(v.x, v.y, v.z), this.robot.rayGroups);
      if (hit && hit.info && (hit.info.kind === 'wand' || hit.info.kind === 'halle' || hit.info.kind === 'floor' || hit.info.kind === 'zaun') && hit.dist < Math.hypot(v.x, v.y, v.z) - 0.1) continue;
      const lv = body.isKinematic && body.isKinematic() && e.velocity ? e.velocity() : body.linvel();
      const los = { x: v.x / dist, z: v.z / dist };
      const vr = (lv.x - selfV.x) * los.x + (lv.z - selfV.z) * los.z;
      out.push({ entity: e, dist, az: -az * RAD, vr, rcs, x: p.x, z: p.z });
    }
    out.sort((a, b) => a.dist - b.dist);
    this.targets = out;
    // Umgebungsechos (für die Anzeige)
    const cl = [];
    const n = 25;
    for (let i = 0; i < n; i++) {
      const a = yaw0 - this.fov / 2 + (i / (n - 1)) * this.fov;
      const hit = sim.physics.ray(o, { x: Math.sin(a), y: 0, z: Math.cos(a) }, this.range, this.robot.rayGroups);
      if (hit) cl.push({ az: -(a - yaw0) * RAD, dist: hit.dist });
    }
    this.clutter = cl;
    void T;
  }
  nearest() { return this.targets[0] || null; }
  approaching(maxDist = 6, minSpeed = 0.1) { return this.targets.some((t) => t.dist < maxDist && t.vr < -minSpeed); }
  show(on) {
    if (!on) { this.fan.visible = false; return; }
    const { o, d } = this.pose();
    this.fan.visible = true;
    this.fan.position.set(o.x, o.y, o.z);
    this.fan.rotation.set(0, Math.atan2(d.x, d.z), 0);
    this.fan.scale.setScalar(Math.min(this.range, 4));
  }
  dispose() { this.fan.removeFromParent(); }
}

/* ---------------- Wärmebild ---------------- */

export class ThermalCam {
  constructor(robot, part, pos, dir, opts = {}) {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir;
    this.fov = (opts.fov || 56) * DEG;
    this.wide = opts.wide || 0;
    this.range = opts.range || 6;
    this.feedFov = opts.feedFov || 44;
  }
  pose() { return worldPose(this.part, this.pos, this.dir); }
  // heißester Gegenstand im Bild
  hottest(opts = {}) {
    const { o, d } = this.pose();
    const sim = this.robot.sim;
    let best = null;
    for (const e of sim.objects) {
      if (e.heldBy === this.robot) continue;
      if (opts.skipBinned && sim.entities.some((z) => z.kind === 'kiste' && z.contains(e.body.translation()))) continue;
      const p = e.body.translation();
      const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      if (dist > this.range || dist < 0.03) continue;
      const cos = (v.x * d.x + v.y * d.y + v.z * d.z) / dist;
      const hcos = (v.x * d.x + v.z * d.z) / (Math.hypot(v.x, v.z) * Math.hypot(d.x, d.z) || 1);
      if (!(cos > Math.cos(this.fov / 2) || (this.wide && hcos > Math.cos(this.wide * DEG / 2)))) continue;
      const hit = sim.physics.ray(o, { x: v.x / dist, y: v.y / dist, z: v.z / dist }, dist + 0.05, this.robot.rayGroups);
      if (hit && hit.info && hit.info.entity !== e && hit.dist < dist - 0.06) continue;
      const t = e.temperature ? e.temperature() : sim.ambient();
      if (!best || t > best.temp) {
        const yawTo = Math.atan2(v.x, v.z), yawCam = Math.atan2(d.x, d.z);
        let bearing = -(yawTo - yawCam) * RAD;
        bearing = ((bearing + 540) % 360) - 180;
        best = { entity: e, temp: t, dist: Math.hypot(v.x, v.z), bearing, pos: p };
      }
    }
    return best;
  }
  maxTemp() {
    const h = this.hottest();
    let t = this.robot.sim.ambient();
    if (h) t = Math.max(t, h.temp);
    // auch heiße Anlagenteile und andere Roboter im Blick
    const { o, d } = this.pose();
    for (const e of this.robot.sim.entities) {
      if (!e.temperature || e.isObject || e === this.robot) continue;
      const c = e.isRobot ? e.baseBody().translation() : e.center || { x: e.spec?.x || 0, y: 0.2, z: e.spec?.z || 0 };
      const v = { x: c.x - o.x, y: c.y - o.y, z: c.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      if (dist > this.range || dist < 0.05) continue;
      if ((v.x * d.x + v.y * d.y + v.z * d.z) / dist < Math.cos(this.fov / 2)) continue;
      t = Math.max(t, e.temperature());
    }
    return Math.round(t * 10) / 10;
  }
}

/* ---------------- RFID und Codes ---------------- */

export class RfidReader {
  constructor(robot, part, pos, dir, range = 0.1) { this.robot = robot; this.part = part; this.pos = pos; this.dir = dir; this.range = range; this.last = null; }
  read() {
    const { o } = worldPose(this.part, this.pos, this.dir);
    let best = null, bd = this.range;
    for (const e of this.robot.sim.entities) {
      const code = e.code || (e.spec && e.spec.rfid);
      if (!code) continue;
      const p = e.isObject ? e.body.translation() : e.center || { x: e.spec.x || 0, y: e.baseY || 0, z: e.spec.z || 0 };
      const dd = Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z) - (e.isObject ? e.halfHeight : 0);
      if (dd < bd) { bd = dd; best = String(code); }
    }
    if (best) this.last = best;
    return best || 'keiner';
  }
}

export class CodeScanner {
  constructor(robot, part, pos, dir, range = 0.6) { this.robot = robot; this.part = part; this.pos = pos; this.dir = dir; this.range = range; this.last = null; }
  read() {
    const { o, d } = worldPose(this.part, this.pos, this.dir);
    const sim = this.robot.sim;
    let best = null, bd = Infinity;
    for (const e of sim.objects) {
      if (!e.code) continue;
      const p = e.body.translation();
      const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      if (dist > this.range || dist < 0.01) continue;
      if ((v.x * d.x + v.y * d.y + v.z * d.z) / dist < Math.cos(22 * DEG)) continue;
      if (sim.illumination(p) < 0.12) continue;
      const hit = sim.physics.ray(o, { x: v.x / dist, y: v.y / dist, z: v.z / dist }, dist + 0.05, this.robot.rayGroups);
      if (hit && hit.info && hit.info.entity !== e && hit.dist < dist - 0.05) continue;
      if (dist < bd) { bd = dist; best = String(e.code); }
    }
    if (best) this.last = best;
    return best || 'keiner';
  }
}

/* ---------------- Kraft-Momenten-Sensor ---------------- */

export class ForceTorque {
  constructor(robot, gripper) { this.robot = robot; this.gripper = gripper; this.fz = 0; }
  update(dt) {
    const g = this.gripper;
    let f = 0;
    if (g && g.held) {
      const v = g.held.body.linvel();
      f = g.held.mass * 9.81 + Math.hypot(v.x, v.y, v.z) * g.held.mass * 2;
    }
    this.fz += (f - this.fz) * Math.min(1, dt * 20);
  }
  read() { return Math.round(this.fz * 10) / 10; }
}

export { clamp };
