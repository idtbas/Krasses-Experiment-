// Gegenstände und Geräte in der Welt
import * as THREE from 'three';
import { Entity } from '../sim/sim.js';
import { Mat, Geo, mesh } from '../render/materials.js';
import { COLORS } from '../lang/commands.js';
import { qyaw, qrot, clamp } from '../core/util.js';

export const MATERIALS = {
  holz: { name: 'Holz', density: 650, friction: 0.6, restitution: 0.1 },
  kunststoff: { name: 'Kunststoff', density: 1100, friction: 0.5, restitution: 0.2 },
  alu: { name: 'Aluminium', density: 2700, friction: 0.45, restitution: 0.1 },
  stahl: { name: 'Stahl', density: 7850, friction: 0.42, restitution: 0.05, magnetic: true },
  schaum: { name: 'Schaumstoff', density: 60, friction: 0.95, restitution: 0.05 },
  gummi: { name: 'Gummi', density: 1150, friction: 0.9, restitution: 0.65 },
};

const hex = (c) => COLORS[c] || c || '#cccccc';

function visualMat(material, color) {
  const c = hex(color);
  switch (material) {
    case 'holz': return Mat.wood(c);
    case 'alu': return Mat.cubeMetal(c);
    case 'stahl': return Mat.cubeMetal(new THREE.Color(c).lerp(new THREE.Color('#707780'), 0.55).getStyle());
    case 'schaum': return Mat.foam(c);
    case 'gummi': return Mat.plain(c, 0.75, 0);
    default: return Mat.cubePlastic(c);
  }
}

let nameCounter = {};
export function resetNames() { nameCounter = {}; }
function autoName(kind, color) {
  const k = kind + (color ? '_' + color : '');
  nameCounter[k] = (nameCounter[k] || 0) + 1;
  return k + '_' + nameCounter[k];
}

/* ------------------------------------------------------------------ */
/* Bewegliche Gegenstände                                              */
/* ------------------------------------------------------------------ */

export class Thing extends Entity {
  constructor(sim, spec) {
    super(sim);
    this.isObject = true;
    this.spec = { ...spec };
    this.kind = spec.type;
    this.color = spec.color || 'rot';
    this.material = spec.material || 'holz';
    this.name = spec.name || autoName(this.kind, this.color);
    this.heldBy = null;
    this.build();
  }

  get pos() { return this.body.translation(); }
  get mass() { return this.body.mass(); }
  get magnetic() { return !!MATERIALS[this.material]?.magnetic; }

  makeBody() {
    const R = this.R, s = this.spec;
    const desc = R.RigidBodyDesc.dynamic().setTranslation(s.x || 0, s.y ?? 0.5, s.z || 0)
      .setRotation(qyaw(s.yaw || 0)).setLinearDamping(0.05).setAngularDamping(0.15).setCcdEnabled(true);
    this.body = this.addBody(desc);
    return this.body;
  }

  colliderDesc(desc) {
    const m = MATERIALS[this.material] || MATERIALS.holz;
    return desc.setDensity(m.density).setFriction(m.friction).setRestitution(m.restitution)
      .setCollisionGroups(this.sim.physics.groupsObj);
  }

  // halbe Höhe über dem Boden, wenn er aufrecht liegt
  get halfHeight() { return 0.03; }
  // Abmessung quer zum Greifer
  get gripWidth() { return 0.06; }

  sync() {
    super.sync();
    // aus der Welt gefallen? zurücklegen
    const p = this.body.translation();
    if (p.y < -2) {
      this.body.setTranslation({ x: this.spec.x || 0, y: 0.5, z: this.spec.z || 0 }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
}

export class Cube extends Thing {
  build() {
    const s = this.size = this.spec.size || 0.06;
    if (this.spec.y == null) this.spec.y = s / 2;
    const b = this.makeBody();
    this.col = this.collider(this.colliderDesc(this.R.ColliderDesc.roundCuboid(s / 2 - 0.002, s / 2 - 0.002, s / 2 - 0.002, 0.002)), b, { kind: 'object', color: this.color });
    const m = mesh(Geo.box(s, s, s, s * 0.08), visualMat(this.material, this.color));
    this.mesh = m;
    this.link(b, m);
  }
  get halfHeight() { return this.size / 2; }
  get gripWidth() { return this.size; }
}

export class Ball extends Thing {
  build() {
    const r = this.r = this.spec.r || 0.035;
    if (!this.spec.material) this.material = 'gummi';
    if (this.spec.y == null) this.spec.y = r;
    const b = this.makeBody();
    this.col = this.collider(this.colliderDesc(this.R.ColliderDesc.ball(r)), b, { kind: 'object', color: this.color });
    b.setAngularDamping(0.4);
    const m = mesh(Geo.sphere(r, 32), visualMat(this.material, this.color));
    this.mesh = m;
    this.link(b, m);
  }
  get halfHeight() { return this.r; }
  get gripWidth() { return this.r * 2; }
}

export class Cylinder extends Thing {
  build() {
    const r = this.r = this.spec.r || 0.03, h = this.h = this.spec.h || 0.08;
    if (this.spec.y == null) this.spec.y = h / 2;
    const b = this.makeBody();
    this.col = this.collider(this.colliderDesc(this.R.ColliderDesc.roundCylinder(h / 2 - 0.002, r - 0.002, 0.002)), b, { kind: 'object', color: this.color });
    const m = mesh(Geo.cyl(r, r, h, 32), visualMat(this.material, this.color));
    this.mesh = m;
    this.link(b, m);
  }
  get halfHeight() { return this.h / 2; }
  get gripWidth() { return this.r * 2; }
}

/* ------------------------------------------------------------------ */
/* Feste Bauteile                                                      */
/* ------------------------------------------------------------------ */

class Fixed extends Entity {
  constructor(sim, spec) {
    super(sim);
    this.spec = { ...spec };
    this.kind = spec.type;
    this.color = spec.color || null;
    this.yaw = spec.yaw || 0;
    this.q = qyaw(this.yaw);
    this.baseY = spec.y || 0;
    this.fixedBody = this.addBody(this.R.RigidBodyDesc.fixed().setTranslation(spec.x || 0, this.baseY, spec.z || 0).setRotation(this.q));
    this.build();
  }
  // lokale Koordinaten (Meter) → Welt
  toWorld(lx, ly, lz) {
    const v = qrot(this.q, { x: lx, y: ly, z: lz });
    return { x: v.x + (this.spec.x || 0), y: v.y + this.baseY, z: v.z + (this.spec.z || 0) };
  }
  toLocal(x, z) {
    const dx = x - (this.spec.x || 0), dz = z - (this.spec.z || 0);
    const c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    return { x: dx * c + dz * s, z: -dx * s + dz * c };
  }
  boxCollider(hx, hy, hz, x, y, z, data, friction = 0.7) {
    return this.collider(this.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(friction)
      .setCollisionGroups(this.sim.physics.groupsEnv), this.fixedBody, { kind: this.kind, ...(data || {}) });
  }
  addVisual(obj) { this.link(this.fixedBody, this.visual || (this.visual = new THREE.Group())); this.visual.add(obj); return obj; }
}

export class Table extends Fixed {
  build() {
    const w = this.spec.w || 0.9, d = this.spec.d || 0.6, h = this.spec.h || 0.4;
    this.top = h;
    this.boxCollider(w / 2, 0.015, d / 2, 0, h - 0.015, 0, { color: 'weiß' });
    const top = mesh(Geo.box(w, 0.03, d, 0.008), Mat.plain('#e8e4dc', 0.55));
    top.position.y = h - 0.015;
    this.addVisual(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = mesh(Geo.box(0.035, h - 0.03, 0.035, 0.005), Mat.graphite());
      leg.position.set(sx * (w / 2 - 0.05), (h - 0.03) / 2, sz * (d / 2 - 0.05));
      this.addVisual(leg);
      this.boxCollider(0.0175, (h - 0.03) / 2, 0.0175, sx * (w / 2 - 0.05), (h - 0.03) / 2, sz * (d / 2 - 0.05));
    }
  }
  surfaceAt(x, z) {
    const l = this.toLocal(x, z);
    const w = this.spec.w || 0.9, d = this.spec.d || 0.6;
    return Math.abs(l.x) <= w / 2 && Math.abs(l.z) <= d / 2 ? this.top + this.baseY : null;
  }
}

export class Wall extends Fixed {
  build() {
    const w = this.spec.w || 1, h = this.spec.h || 0.3, d = this.spec.d || 0.04;
    this.boxCollider(w / 2, h / 2, d / 2, 0, h / 2, 0, { color: this.color || 'grau' });
    const m = mesh(Geo.box(w, h, d, 0.006), Mat.plain(hex(this.color || '#c5cad3'), 0.7));
    m.position.y = h / 2;
    this.addVisual(m);
  }
}

export class Ramp extends Fixed {
  build() {
    const w = this.spec.w || 0.4, l = this.spec.l || 0.6, h = this.spec.h || 0.12;
    const ang = Math.atan2(h, l);
    const len = Math.hypot(l, h);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ang);
    const R = this.R;
    const c = this.collider(R.ColliderDesc.cuboid(w / 2, 0.01, len / 2).setTranslation(0, h / 2, 0)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.9).setCollisionGroups(this.sim.physics.groupsEnv), this.fixedBody, { kind: 'rampe' });
    this.col = c;
    // Keil als Grafik
    const shape = new THREE.Shape();
    shape.moveTo(-l / 2, 0); shape.lineTo(l / 2, h); shape.lineTo(l / 2, 0); shape.lineTo(-l / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(-Math.PI / 2);
    const m = mesh(geo, Mat.plain('#d7dbe2', 0.6));
    this.addVisual(m);
    this.boxCollider(w / 2, h / 2 - 0.01, 0.01, 0, h / 2, l / 2 - 0.01);
  }
}

// Farbige Fläche am Boden (Zielzone, Sortierfeld)
export class Zone extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.24, d = this.d = this.spec.d || 0.24;
    const c = hex(this.color || 'grün');
    const g = new THREE.Group();
    const fill = new THREE.Mesh(Geo.box(w, 0.002, d, 0), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.32, roughness: 0.9, depthWrite: false }));
    fill.position.y = 0.0015;
    fill.receiveShadow = true;
    g.add(fill);
    const edgeMat = Mat.line(c);
    const t = 0.008;
    for (const [ex, ez, ew, ed] of [[0, d / 2 - t / 2, w, t], [0, -d / 2 + t / 2, w, t], [w / 2 - t / 2, 0, t, d], [-w / 2 + t / 2, 0, t, d]]) {
      const e = new THREE.Mesh(Geo.box(ew, 0.003, ed, 0), edgeMat);
      e.position.set(ex, 0.002, ez);
      g.add(e);
    }
    this.addVisual(g);
  }
  contains(p, maxY = 0.5) {
    const l = this.toLocal(p.x, p.z);
    return Math.abs(l.x) <= this.w / 2 && Math.abs(l.z) <= this.d / 2 && p.y - this.baseY < maxY && p.y > this.baseY - 0.05;
  }
  floorColorAt(x, z, y = this.baseY) {
    return this.contains({ x, y: y + 0.001, z }, 0.03) ? { color: this.color, light: 55, priority: 2, y: this.baseY } : null;
  }
  get center() { return { x: this.spec.x || 0, y: this.baseY, z: this.spec.z || 0 }; }
  // freier Platz in der Zone für einen weiteren Gegenstand
  freeSpot(except, gap = 0.075) { return freeSpotIn(this, this.w, this.d, except, gap); }
}

function freeSpotIn(z, w, d, except, gap) {
  const others = z.sim.objects.filter((o) => o !== except && !o.heldBy).map((o) => o.body.translation());
  const cands = [[0, 0]];
  const sx = Math.max(0, w / 2 - 0.035), sz = Math.max(0, d / 2 - 0.035);
  for (const fz of [-1, 1, 0]) for (const fx of [-1, 1, 0]) if (fx || fz) cands.push([fx * sx, fz * sz]);
  for (const [lx, lz] of cands) {
    const p = z.toWorld(lx, 0, lz);
    if (others.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= gap)) return p;
  }
  return null;
}

// Offene Kiste zum Hineinwerfen
export class Bin extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.22, d = this.d = this.spec.d || 0.22, h = this.h = this.spec.h || 0.08;
    const t = 0.012;
    const c = hex(this.color || 'blau');
    const mat = Mat.accent(c);
    const parts = [[0, t / 2, 0, w, t, d], [0, h / 2, d / 2 - t / 2, w, h, t], [0, h / 2, -d / 2 + t / 2, w, h, t], [w / 2 - t / 2, h / 2, 0, t, h, d], [-w / 2 + t / 2, h / 2, 0, t, h, d]];
    for (const [x, y, z, ww, hh, dd] of parts) {
      this.boxCollider(ww / 2, hh / 2, dd / 2, x, y, z, { color: this.color }, 0.6);
      const m = mesh(Geo.box(ww, hh, dd, 0.003), mat);
      m.position.set(x, y, z);
      this.addVisual(m);
    }
  }
  contains(p) {
    const l = this.toLocal(p.x, p.z);
    return Math.abs(l.x) <= this.w / 2 && Math.abs(l.z) <= this.d / 2 && p.y - this.baseY < this.h + 0.1 && p.y > this.baseY - 0.02;
  }
  get center() { return { x: this.spec.x || 0, y: this.baseY + 0.012, z: this.spec.z || 0 }; }
  freeSpot(except, gap = 0.07) { const p = freeSpotIn(this, this.w - 0.03, this.d - 0.03, except, gap); if (p) p.y = this.baseY + 0.012; return p; }
}

// Schwarze Linie am Boden
export class LineTrack extends Fixed {
  build() {
    this.pts = this.spec.points || [[0, 0], [1, 0]];
    this.width = this.spec.width || 0.025;
    const g = new THREE.Group();
    const mat = Mat.plain('#16181d', 0.9);
    for (let i = 0; i < this.pts.length - 1; i++) {
      const [x1, z1] = this.pts[i], [x2, z2] = this.pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const seg = new THREE.Mesh(Geo.box(this.width, 0.001, len + this.width, 0), mat);
      seg.position.set((x1 + x2) / 2, 0.0012, (z1 + z2) / 2);
      seg.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      seg.receiveShadow = true;
      g.add(seg);
    }
    this.addVisual(g);
  }
  floorColorAt(x, z, y = 0) {
    if (Math.abs(y - this.baseY) > 0.03) return null;
    const l = this.toLocal(x, z);
    for (let i = 0; i < this.pts.length - 1; i++) {
      const [x1, z1] = this.pts[i], [x2, z2] = this.pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const t = clamp(((l.x - x1) * dx + (l.z - z1) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const d = Math.hypot(l.x - (x1 + t * dx), l.z - (z1 + t * dz));
      if (d <= this.width / 2) return { color: 'schwarz', light: 6, priority: 3 };
    }
    return null;
  }
}

// Ziel-Fähnchen
export class Flag extends Fixed {
  build() {
    const c = hex(this.color || 'orange');
    this.r = this.spec.r || 0.18;
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.r - 0.015, this.r, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002;
    this.addVisual(ring);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(this.r - 0.015, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2; disk.position.y = 0.0018;
    this.addVisual(disk);
    const pole = mesh(Geo.cyl(0.006, 0.006, 0.5, 12), Mat.graphite());
    pole.position.y = 0.25;
    this.addVisual(pole);
    const flag = mesh(Geo.box(0.12, 0.08, 0.004, 0), Mat.accent(c));
    flag.position.set(0.06, 0.45, 0);
    this.flagMesh = flag;
    this.addVisual(flag);
  }
  contains(p) { return Math.hypot(p.x - (this.spec.x || 0), p.z - (this.spec.z || 0)) <= this.r; }
  get center() { return { x: this.spec.x || 0, y: this.baseY, z: this.spec.z || 0 }; }
  sync() { super.sync(); if (this.flagMesh) this.flagMesh.rotation.y = Math.sin(this.sim.time * 2) * 0.15; }
}

/* ------------------------------------------------------------------ */
/* Geräte                                                              */
/* ------------------------------------------------------------------ */

export class Conveyor extends Fixed {
  build() {
    const L = this.L = this.spec.l || 1.4, W = this.W = this.spec.w || 0.2, H = this.H = this.spec.h || 0.12;
    this.on = this.spec.on ?? true;
    this.speedPct = this.spec.speed ?? 40;
    // Das Band selbst ist reibungsfrei – die Mitnahme (und das Bremsen) übernimmt update()
    this.belt = this.collider(this.R.ColliderDesc.cuboid(L / 2, 0.01, W / 2).setTranslation(0, H - 0.01, 0).setFriction(0)
      .setFrictionCombineRule(this.R.CoefficientCombineRule.Min).setCollisionGroups(this.sim.physics.groupsEnv), this.fixedBody, { kind: 'band', color: 'schwarz' });
    this.boxCollider(L / 2, 0.02, 0.008, 0, H + 0.01, W / 2 + 0.008);
    this.boxCollider(L / 2, 0.02, 0.008, 0, H + 0.01, -W / 2 - 0.008);
    // Grafik
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#23262c'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2f333b'; g.fillRect(0, 0, 16, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(L / 0.08, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tex = tex;
    const beltMesh = mesh(new THREE.BoxGeometry(L, 0.02, W), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    beltMesh.position.y = H - 0.01;
    this.addVisual(beltMesh);
    const frame = Mat.accent('#5b6472');
    for (const s of [-1, 1]) {
      const rail = mesh(Geo.box(L, 0.04, 0.016, 0.004), frame);
      rail.position.set(0, H + 0.01, s * (W / 2 + 0.008));
      this.addVisual(rail);
    }
    const body = mesh(Geo.box(L - 0.04, H - 0.03, W - 0.02, 0.01), Mat.graphite());
    body.position.y = (H - 0.03) / 2;
    this.addVisual(body);
    for (const sx of [-1, 1]) {
      const roller = mesh(Geo.cyl(0.02, 0.02, W, 20), Mat.steel());
      roller.rotation.x = Math.PI / 2;
      roller.position.set(sx * L / 2, H - 0.012, 0);
      this.addVisual(roller);
    }
    // Statusleuchte
    this.led = mesh(Geo.sphere(0.012, 12), Mat.glow('#22c55e'));
    this.led.position.set(-L / 2 + 0.04, H + 0.04, W / 2 + 0.02);
    this.addVisual(this.led);
  }
  get speed() { return this.on ? (this.speedPct / 100) * 0.35 : 0; } // m/s
  dir() { return qrot(this.q, { x: 1, y: 0, z: 0 }); }
  update() {
    const v = this.speed;
    const d = this.dir();
    const n = qrot(this.q, { x: 0, y: 0, z: 1 });
    this.sim.physics.contacts(this.belt, (other) => {
      const b = other.parent();
      if (!b || !b.isDynamic()) return;
      const lv = b.linvel();
      // Geschwindigkeit längs des Bandes an das Band angleichen, quer dazu abbremsen (wie Haftreibung)
      const along = lv.x * d.x + lv.z * d.z;
      const across = lv.x * n.x + lv.z * n.z;
      const k = 0.3;
      const dA = (v - along) * k, dC = -across * k;
      b.setLinvel({ x: lv.x + d.x * dA + n.x * dC, y: lv.y, z: lv.z + d.z * dA + n.z * dC }, true);
      const w = b.angvel();
      b.setAngvel({ x: w.x * 0.8, y: w.y * 0.8, z: w.z * 0.8 }, true);
    });
  }
  sync() {
    super.sync();
    this.tex.offset.x = -(this.sim.time * this.speed) / 0.08;
    this.led.material = Mat.glow(this.on && this.speedPct ? '#22c55e' : '#ef4444');
  }
  get top() { return this.H; }
}

export class Button extends Fixed {
  build() {
    const c = hex(this.color || 'rot');
    this.pressed = false;
    this.boxCollider(0.06, 0.02, 0.06, 0, 0.02, 0, { color: 'grau' });
    const base = mesh(Geo.box(0.12, 0.04, 0.12, 0.01), Mat.graphite());
    base.position.y = 0.02;
    this.addVisual(base);
    this.cap = mesh(Geo.cyl(0.035, 0.038, 0.025, 32), Mat.accent(c));
    this.cap.position.y = 0.052;
    this.addVisual(this.cap);
    this.shape = new this.R.Cuboid(0.036, 0.016, 0.036);
  }
  post() {
    const p = this.toWorld(0, 0.058, 0);
    let hit = false;
    this.world.intersectionsWithShape(p, this.q, this.shape, (col) => {
      if (col.parent() && col.parent().isDynamic()) { hit = true; return false; }
      return true;
    });
    this.pressed = hit;
  }
  sync() { super.sync(); this.cap.position.y = this.pressed ? 0.044 : 0.052; }
}

export class Lamp extends Fixed {
  build() {
    this.lit = this.spec.lit || null;
    const pole = mesh(Geo.cyl(0.012, 0.016, 0.3, 16), Mat.graphite());
    pole.position.y = 0.15;
    this.addVisual(pole);
    this.boxCollider(0.02, 0.15, 0.02, 0, 0.15, 0);
    this.bulb = mesh(Geo.sphere(0.05, 24), Mat.plain('#e5e7eb', 0.3));
    this.bulb.position.y = 0.34;
    this.addVisual(this.bulb);
    this.light = new THREE.PointLight('#ffffff', 0, 1.6, 2);
    this.light.position.y = 0.34;
    this.addVisual(this.light);
    this.setColor(this.lit);
  }
  setColor(c) {
    this.lit = c;
    if (!c) { this.bulb.material = Mat.plain('#d4d7dd', 0.3); this.light.intensity = 0; return; }
    this.bulb.material = Mat.glow(hex(c));
    this.light.color.set(hex(c));
    this.light.intensity = 3;
  }
}

export class LightBarrier extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.3;
    this.h = this.spec.h ?? 0.16;
    this.broken = false;
    for (const s of [-1, 1]) {
      const post = mesh(Geo.box(0.03, this.h + 0.05, 0.03, 0.005), Mat.accent('#334155'));
      post.position.set(s * w / 2, (this.h + 0.05) / 2, 0);
      this.addVisual(post);
      this.boxCollider(0.015, (this.h + 0.05) / 2, 0.015, s * w / 2, (this.h + 0.05) / 2, 0);
    }
    this.beam = new THREE.Mesh(Geo.cyl(0.0025, 0.0025, w - 0.03, 8), new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.85 }));
    this.beam.rotation.z = Math.PI / 2;
    this.beam.position.y = this.h;
    this.addVisual(this.beam);
  }
  post() {
    const a = this.toWorld(-this.w / 2 + 0.016, this.h, 0);
    const b = this.toWorld(this.w / 2 - 0.016, this.h, 0);
    const dir = { x: b.x - a.x, y: 0, z: b.z - a.z };
    const len = Math.hypot(dir.x, dir.z);
    dir.x /= len; dir.z /= len;
    const hit = this.sim.physics.ray(a, dir, len, 0xffffffff, this.fixedBody);
    this.broken = !!hit;
  }
  sync() { super.sync(); this.beam.material.opacity = this.broken ? 0.25 : 0.9; }
}

// Spender: lässt Würfel auf ein Förderband fallen
export class Dispenser extends Fixed {
  build() {
    this.queue = (this.spec.colors || ['rot', 'blau', 'grün', 'gelb']).slice();
    this.seq = 0;
    this.interval = this.spec.interval ?? 0;
    this.max = this.spec.max ?? 20;
    this.count = 0;
    this.timer = 0.6;
    const h = this.spec.h || 0.45;
    this.dropY = h - 0.05;
    const frame = Mat.accent('#475569');
    for (const [x, z] of [[-0.06, 0], [0.06, 0], [0, -0.06], [0, 0.06]]) {
      const wall = mesh(Geo.box(x ? 0.012 : 0.13, 0.16, z ? 0.012 : 0.13, 0.003), frame);
      wall.position.set(x, h, z);
      this.addVisual(wall);
    }
    for (const s of [-1, 1]) {
      const leg = mesh(Geo.box(0.02, h, 0.02, 0.004), Mat.graphite());
      leg.position.set(0, h / 2 - 0.04, s * 0.16);
      this.addVisual(leg);
      this.boxCollider(0.01, h / 2, 0.01, 0, h / 2 - 0.04, s * 0.16);
    }
    const bridge = mesh(Geo.box(0.02, 0.02, 0.34, 0.004), Mat.graphite());
    bridge.position.set(0, h - 0.08, 0);
    this.addVisual(bridge);
  }
  spawn() {
    if (this.count >= this.max) return null;
    const color = this.queue[this.seq % this.queue.length];
    this.seq++;
    this.count++;
    const p = this.toWorld(0, this.dropY, 0);
    const cube = new Cube(this.sim, { type: 'würfel', x: p.x, y: p.y, z: p.z, color, material: this.spec.material || 'holz', yaw: this.yaw });
    this.sim.add(cube);
    if (this.onSpawn) this.onSpawn(cube);
    return cube;
  }
  // Nur ausgeben, wenn unter dem Spender Platz ist (sonst stauen sich die Würfel)
  spotFree() {
    const p = this.toWorld(0, 0, 0);
    return !this.sim.objects.some((o) => { const q = o.body.translation(); return Math.hypot(q.x - p.x, q.z - p.z) < 0.12 && q.y < this.dropY + 0.05; });
  }
  update(dt) {
    if (!this.interval) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (!this.spotFree()) { this.timer = 0.3; return; }
      this.timer = this.interval;
      this.spawn();
    }
  }
}

export const OBJECT_TYPES = {
  würfel: { cls: Cube, name: 'Würfel', icon: 'cube' },
  kugel: { cls: Ball, name: 'Kugel', icon: 'ball' },
  zylinder: { cls: Cylinder, name: 'Zylinder', icon: 'cylinder' },
  tisch: { cls: Table, name: 'Tisch', icon: 'table' },
  wand: { cls: Wall, name: 'Wand', icon: 'wall' },
  rampe: { cls: Ramp, name: 'Rampe', icon: 'ramp' },
  zone: { cls: Zone, name: 'Zielzone', icon: 'zone' },
  kiste: { cls: Bin, name: 'Kiste', icon: 'bin' },
  linie: { cls: LineTrack, name: 'Linie', icon: 'line' },
  ziel: { cls: Flag, name: 'Ziel', icon: 'flag' },
  band: { cls: Conveyor, name: 'Förderband', icon: 'conveyor' },
  taster: { cls: Button, name: 'Taster', icon: 'button' },
  lampe: { cls: Lamp, name: 'Lampe', icon: 'lamp' },
  lichtschranke: { cls: LightBarrier, name: 'Lichtschranke', icon: 'barrier' },
  spender: { cls: Dispenser, name: 'Würfelspender', icon: 'dispenser' },
};

export function createObject(sim, spec) {
  const t = OBJECT_TYPES[spec.type];
  if (!t) throw new Error('Unbekannter Gegenstand: ' + spec.type);
  const e = new t.cls(sim, spec);
  sim.add(e);
  return e;
}
