// Sensoren: Abstand, Farbe, Linie, Berührung und Kamera
import * as THREE from 'three';
import { qrot, vnorm, RAD, clamp } from '../core/util.js';
import { COLORS } from '../lang/commands.js';

function worldPose(part, lp, ld) {
  const b = part.body;
  const p = b.translation(), q = b.rotation();
  const o = qrot(q, lp);
  return { o: { x: p.x + o.x, y: p.y + o.y, z: p.z + o.z }, d: vnorm(qrot(q, ld)) };
}

const beamMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.55, depthWrite: false });
const dotMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
const beamGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6).translate(0, 0.5, 0).rotateX(Math.PI / 2);
const dotGeo = new THREE.SphereGeometry(0.008, 10, 8);

export class DistanceSensor {
  constructor(robot, part, pos, dir, range = 2) {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir; this.range = range;
    this.value = range * 100;
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.dot = new THREE.Mesh(dotGeo, dotMat);
    this.beam.visible = this.dot.visible = false;
    robot.sim.renderer.helpers.add(this.beam, this.dot);
    this.hitPoint = null;
  }
  measure() {
    const { o, d } = worldPose(this.part, this.pos, this.dir);
    const hit = this.robot.sim.physics.ray(o, d, this.range, this.robot.rayGroups);
    this.origin = o; this.direction = d;
    this.hitPoint = hit ? hit.point : null;
    this.value = hit ? Math.round(hit.dist * 1000) / 10 : this.range * 100;
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
    this.beam.scale.set(1, 1, Math.max(0.001, len));
    this.dot.visible = !!this.hitPoint;
    if (this.hitPoint) this.dot.position.set(this.hitPoint.x, this.hitPoint.y, this.hitPoint.z);
  }
  dispose() { this.beam.removeFromParent(); this.dot.removeFromParent(); }
}

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
      const a = Math.abs(d.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const u = vnorm({ x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x });
      const v = { x: d.y * u.z - d.z * u.y, y: d.z * u.x - d.x * u.z, z: d.x * u.y - d.y * u.x };
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

export class Camera {
  constructor(robot, part, pos, dir, fov = 75, range = 3.5) {
    this.robot = robot; this.part = part; this.pos = pos; this.dir = dir;
    this.fov = fov * Math.PI / 180; this.range = range;
  }
  pose() { return worldPose(this.part, this.pos, this.dir); }

  // nächster sichtbarer Gegenstand dieser Farbe
  find(color, opts = {}) {
    color = String(color || '').toLowerCase();
    const { o, d } = this.pose();
    const sim = this.robot.sim;
    let best = null;
    for (const e of sim.entities) {
      if (!e.color || e.color !== color || e === this.robot) continue;
      if (!(e.isObject || e.kind === 'zone' || e.kind === 'kiste' || e.kind === 'ziel' || e.kind === 'lampe')) continue;
      if (opts.objectsOnly && !e.isObject) continue;
      if (opts.exclude && opts.exclude(e)) continue;
      // schon einsortiert (liegt in Zone/Kiste der eigenen Farbe)? Dann nicht noch einmal nehmen
      if (opts.skipSorted && e.isObject && sim.entities.some((z) => (z.kind === 'zone' || z.kind === 'kiste') && z.color === e.color && z.contains(e.body.translation()))) continue;
      if (opts.placesFirst && e.isObject && sim.entities.some((z) => (z.kind === 'zone' || z.kind === 'kiste' || z.kind === 'ziel') && z.color === color)) continue;
      if (e.heldBy === this.robot && !opts.includeHeld) continue;
      const p = e.isObject ? e.body.translation() : e.center || { x: e.spec.x || 0, y: 0, z: e.spec.z || 0 };
      const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
      const dist = Math.hypot(v.x, v.y, v.z);
      if (dist > this.range || dist < 1e-3) continue;
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
      const yawTo = Math.atan2(v.x, v.z), yawCam = Math.atan2(d.x, d.z);
      let bearing = -(yawTo - yawCam) * RAD;
      bearing = ((bearing + 540) % 360) - 180;
      const flat = Math.hypot(p.x - o.x, p.z - o.z);
      if (!best || flat < best.dist) best = { entity: e, dist: flat, bearing, pos: p };
    }
    return best;
  }
}

export { clamp };
