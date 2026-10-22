// Gegenstände, Anlagenteile und Testobjekte in der Halle
import * as THREE from 'three';
import { Entity } from '../sim/sim.js';
import { Mat, Geo, mesh, plate, boltCircle, stripeTexture } from '../render/materials.js';
import { COLORS } from '../lang/commands.js';
import { qyaw, qrot, clamp } from '../core/util.js';

export const MATERIALS = {
  holz: { name: 'Holz', density: 650, friction: 0.6, restitution: 0.1, rcs: 0.05 },
  kunststoff: { name: 'Kunststoff', density: 1100, friction: 0.5, restitution: 0.2, rcs: 0.04 },
  alu: { name: 'Aluminium', density: 2700, friction: 0.45, restitution: 0.1, rcs: 0.6 },
  stahl: { name: 'Stahl', density: 7850, friction: 0.42, restitution: 0.05, magnetic: true, rcs: 0.8 },
  schaum: { name: 'Schaumstoff', density: 60, friction: 0.95, restitution: 0.05, rcs: 0.01 },
  gummi: { name: 'Gummi', density: 1150, friction: 0.9, restitution: 0.65, rcs: 0.03 },
};

const hex = (c) => COLORS[c] || c || '#cccccc';

function visualMat(material, color) {
  const c = hex(color);
  switch (material) {
    case 'holz': return Mat.wood(c);
    case 'alu': return Mat.cubeMetal(c);
    case 'stahl': return Mat.cubeMetal(new THREE.Color(c).lerp(new THREE.Color('#6a7079'), 0.55).getStyle());
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

// Aufkleber mit 2D-Code (rein optisch, Inhalt = code)
function codeDecal(code, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#111';
  let h = 2166136261;
  for (const ch of String(code)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const finder = (x < 3 && y < 3) || (x > 4 && y < 3) || (x < 3 && y > 4);
    h = Math.imul(h ^ (x * 31 + y), 16777619);
    if (finder ? (x % 4 !== 1 || y % 4 !== 1) && !((x === 1 || x === 6) && (y === 1 || y === 6)) || (x === 1 && y === 1) || (x === 6 && y === 1) || (x === 1 && y === 6) : (h >>> 7) & 1) g.fillRect(4 + x * 7, 4 + y * 7, 7, 7);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/* ------------------------------------------------------------------ */
/* Bewegliche Gegenstände (Werkstücke)                                 */
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
    this.code = spec.code || null;
    this.heldBy = null;
    this.build();
    if (this.code && this.mesh) {
      const d = codeDecal(this.code, Math.min(0.04, this.gripWidth * 0.6));
      d.position.y = this.halfHeight + 0.0008;
      this.mesh.add(d);
    }
  }

  get pos() { return this.body.translation(); }
  get mass() { return this.body.mass(); }
  get magnetic() { return !!MATERIALS[this.material]?.magnetic; }
  temperature() { return this.spec.temp ?? this.sim.ambient(); }
  rcs() { return (MATERIALS[this.material] || MATERIALS.holz).rcs * (this.gripWidth / 0.06) ** 2; }

  setColor(color) {
    this.color = color;
    this.spec.color = color;
    if (this.mesh) this.mesh.material = visualMat(this.material === 'holz' ? 'kunststoff' : this.material, color);
    if (this.col) { const info = this.sim.physics.infoOf(this.col); if (info) info.color = color; }
  }

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

  get halfHeight() { return 0.03; }
  get gripWidth() { return 0.06; }

  sync() {
    super.sync();
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
    const m = mesh(Geo.box(s, s, s, s * 0.06), visualMat(this.material, this.color));
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
    const m = mesh(Geo.chamferCyl(r, h, 0.003, 32), visualMat(this.material, this.color));
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
    this.name = spec.name || autoName(spec.type, null);
    this.yaw = spec.yaw || 0;
    this.q = qyaw(this.yaw);
    this.baseY = spec.y || 0;
    this.fixedBody = this.addBody(this.R.RigidBodyDesc.fixed().setTranslation(spec.x || 0, this.baseY, spec.z || 0).setRotation(this.q));
    this.build();
  }
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
  get center() { return { x: this.spec.x || 0, y: this.baseY, z: this.spec.z || 0 }; }
}

// Arbeitstisch: Aluprofil-Gestell, graue Platte
export class Table extends Fixed {
  build() {
    const w = this.spec.w || 0.9, d = this.spec.d || 0.6, h = this.spec.h || 0.4;
    this.top = h;
    this.boxCollider(w / 2, 0.015, d / 2, 0, h - 0.015, 0, { color: 'weiß' });
    const top = mesh(Geo.box(w, 0.026, d, 0.004), Mat.plain('#b7bbbf', 0.62));
    top.position.y = h - 0.013;
    this.addVisual(top);
    const edge = mesh(Geo.box(w + 0.006, 0.006, d + 0.006, 0.002), Mat.anodized());
    edge.position.y = h - 0.029;
    this.addVisual(edge);
    const prof = Mat.alu();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = mesh(Geo.box(0.04, h - 0.03, 0.04, 0.003), prof);
      leg.position.set(sx * (w / 2 - 0.05), (h - 0.03) / 2, sz * (d / 2 - 0.05));
      this.addVisual(leg);
      const foot = mesh(Geo.cyl(0.024, 0.028, 0.012, 16), Mat.rubber());
      foot.position.set(sx * (w / 2 - 0.05), 0.006, sz * (d / 2 - 0.05));
      this.addVisual(foot);
      this.boxCollider(0.0175, (h - 0.03) / 2, 0.0175, sx * (w / 2 - 0.05), (h - 0.03) / 2, sz * (d / 2 - 0.05));
    }
    for (const sz of [-1, 1]) {
      const rail = mesh(Geo.box(w - 0.1, 0.04, 0.03, 0.003), prof);
      rail.position.set(0, h - 0.06, sz * (d / 2 - 0.05));
      this.addVisual(rail);
    }
    if (h > 0.25) for (const sz of [-1, 1]) {
      const low = mesh(Geo.box(w - 0.1, 0.03, 0.03, 0.003), prof);
      low.position.set(0, 0.09, sz * (d / 2 - 0.05));
      this.addVisual(low);
    }
  }
  surfaceAt(x, z) {
    const l = this.toLocal(x, z);
    const w = this.spec.w || 0.9, d = this.spec.d || 0.6;
    return Math.abs(l.x) <= w / 2 && Math.abs(l.z) <= d / 2 ? this.top + this.baseY : null;
  }
}

// Trennwand; Material bestimmt Aussehen und Funkdämpfung (trockenbau, beton, blech, holz, glas)
export class Wall extends Fixed {
  build() {
    const w = this.spec.w || 1, h = this.spec.h || 0.3, d = this.spec.d || 0.04;
    this.boxCollider(w / 2, h / 2, d / 2, 0, h / 2, 0, { color: this.color || 'grau' });
    const mat = this.spec.material === 'beton' || this.spec.material === 'stahlbeton' ? Mat.plain('#8f9295', 0.92)
      : this.spec.material === 'blech' ? Mat.plain('#9aa3ab', 0.45, 0.7)
        : this.spec.material === 'glas' ? Mat.glass('#9fb4c4', 0.35)
          : Mat.plain(hex(this.color || '#b9bdc2'), 0.75);
    const m = mesh(Geo.box(w, h, d, Math.min(0.006, d / 3)), mat);
    m.position.y = h / 2;
    this.addVisual(m);
    if (h > 0.1 && !this.spec.material) {
      const band = mesh(Geo.box(w + 0.002, 0.02, d + 0.002, 0.002), Mat.hazard());
      band.position.y = 0.012;
      this.addVisual(band);
    }
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
    const shape = new THREE.Shape();
    shape.moveTo(-l / 2, 0); shape.lineTo(l / 2, h); shape.lineTo(l / 2, 0); shape.lineTo(-l / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(-Math.PI / 2);
    this.addVisual(mesh(geo, Mat.plain('#8a8f95', 0.55, 0.5)));
    const stripe = mesh(Geo.box(w, 0.004, 0.05, 0), Mat.hazard());
    stripe.position.set(0, 0.003, -l / 2 + 0.03);
    this.addVisual(stripe);
    this.boxCollider(w / 2, h / 2 - 0.01, 0.01, 0, h / 2, l / 2 - 0.01);
  }
}

// Ablagefläche am Boden bzw. auf dem Tisch (Bodenmarkierung)
export class Zone extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.24, d = this.d = this.spec.d || 0.24;
    const c = hex(this.color || 'grün');
    const g = new THREE.Group();
    const fill = new THREE.Mesh(Geo.box(w, 0.002, d, 0), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.18, roughness: 0.9, depthWrite: false }));
    fill.position.y = 0.0015;
    fill.receiveShadow = true;
    g.add(fill);
    const edgeMat = Mat.line(c);
    const t = 0.01;
    for (const [ex, ez, ew, ed] of [[0, d / 2 - t / 2, w, t], [0, -d / 2 + t / 2, w, t], [w / 2 - t / 2, 0, t, d], [-w / 2 + t / 2, 0, t, d]]) {
      const e = new THREE.Mesh(Geo.box(ew, 0.003, ed, 0), edgeMat);
      e.position.set(ex, 0.002, ez);
      g.add(e);
    }
    // Eckwinkel
    const k = Math.min(w, d) * 0.22;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (const [ww, dd, ox, oz] of [[k, 0.004, sx * (w / 2 - k / 2), sz * (d / 2 + 0.012)], [0.004, k, sx * (w / 2 + 0.012), sz * (d / 2 - k / 2)]]) {
        const e = new THREE.Mesh(Geo.box(ww, 0.003, dd, 0), Mat.line('#e8eaec'));
        e.position.set(ox, 0.002, oz);
        g.add(e);
      }
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

// Kleinladungsträger (KLT) zum Hineinlegen
export class Bin extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.22, d = this.d = this.spec.d || 0.22, h = this.h = this.spec.h || 0.08;
    const t = 0.012;
    const c = hex(this.color || 'blau');
    const mat = Mat.plain(new THREE.Color(c).lerp(new THREE.Color('#4a5058'), 0.25).getStyle(), 0.68);
    const parts = [[0, t / 2, 0, w, t, d], [0, h / 2, d / 2 - t / 2, w, h, t], [0, h / 2, -d / 2 + t / 2, w, h, t], [w / 2 - t / 2, h / 2, 0, t, h, d], [-w / 2 + t / 2, h / 2, 0, t, h, d]];
    for (const [x, y, z, ww, hh, dd] of parts) {
      this.boxCollider(ww / 2, hh / 2, dd / 2, x, y, z, { color: this.color }, 0.6);
      const m = mesh(Geo.box(ww, hh, dd, 0.003), mat);
      m.position.set(x, y, z);
      this.addVisual(m);
    }
    // Rippen und Griffmulden
    for (const sz of [-1, 1]) {
      const rim = mesh(Geo.box(w + 0.006, 0.008, t + 0.006, 0.002), mat);
      rim.position.set(0, h - 0.004, sz * (d / 2 - t / 2));
      this.addVisual(rim);
      const grip = mesh(Geo.box(w * 0.35, h * 0.2, 0.002, 0.001), Mat.rubber());
      grip.position.set(0, h * 0.72, sz * (d / 2 + 0.0005));
      this.addVisual(grip);
    }
    for (const sx of [-1, 1]) {
      const rim = mesh(Geo.box(t + 0.006, 0.008, d + 0.006, 0.002), mat);
      rim.position.set(sx * (w / 2 - t / 2), h - 0.004, 0);
      this.addVisual(rim);
    }
  }
  contains(p) {
    const l = this.toLocal(p.x, p.z);
    return Math.abs(l.x) <= this.w / 2 && Math.abs(l.z) <= this.d / 2 && p.y - this.baseY < this.h + 0.1 && p.y > this.baseY - 0.02;
  }
  get center() { return { x: this.spec.x || 0, y: this.baseY + 0.012, z: this.spec.z || 0 }; }
  freeSpot(except, gap = 0.07) { const p = freeSpotIn(this, this.w - 0.03, this.d - 0.03, except, gap); if (p) p.y = this.baseY + 0.012; return p; }
}

// Spurlinie am Boden (schwarzes Band)
export class LineTrack extends Fixed {
  build() {
    this.pts = this.spec.points || [[0, 0], [1, 0]];
    this.width = this.spec.width || 0.025;
    const g = new THREE.Group();
    const mat = Mat.plain('#141517', 0.85);
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

// Zielmarke: Bodenring mit Markierungspfosten und Beschriftung
export class Flag extends Fixed {
  build() {
    const c = hex(this.color || 'orange');
    this.r = this.spec.r || 0.18;
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.r - 0.014, this.r, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002;
    this.addVisual(ring);
    const cross = new THREE.Group();
    for (const r of [0, Math.PI / 2]) {
      const b = new THREE.Mesh(Geo.box(this.r * 0.5, 0.002, 0.008, 0), Mat.line(c, 0.9));
      b.rotation.y = r;
      cross.add(b);
    }
    cross.position.y = 0.002;
    this.addVisual(cross);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(this.r - 0.014, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2; disk.position.y = 0.0018;
    this.addVisual(disk);
    const post = mesh(Geo.cyl(0.012, 0.016, 0.42, 14), Mat.plain('#25292e', 0.6));
    post.position.set(this.r + 0.03, 0.21, 0);
    this.addVisual(post);
    for (const yy of [0.3, 0.36]) {
      const band = mesh(Geo.cyl(0.0135, 0.0135, 0.03, 14), Mat.glow(c, 0.9));
      band.position.set(this.r + 0.03, yy, 0);
      this.addVisual(band);
    }
    if (this.spec.label) {
      const p = plate(this.spec.label, 0.16, 0.04, { bg: '#16191d', color: '#e6e8eb', size: 30 });
      p.position.set(this.r + 0.03, 0.46, 0);
      this.labelPlate = p;
      this.addVisual(p);
    }
  }
  contains(p) { return Math.hypot(p.x - (this.spec.x || 0), p.z - (this.spec.z || 0)) <= this.r; }
  sync() { super.sync(); if (this.labelPlate && this.sim.renderer.camera) this.labelPlate.lookAt(this.sim.renderer.camera.position); }
}

/* ------------------------------------------------------------------ */
/* Anlagenteile                                                        */
/* ------------------------------------------------------------------ */

export class Conveyor extends Fixed {
  build() {
    const L = this.L = this.spec.l || 1.4, W = this.W = this.spec.w || 0.2, H = this.H = this.spec.h || 0.12;
    this.on = this.spec.on ?? true;
    this.speedPct = this.spec.speed ?? 40;
    this.belt = this.collider(this.R.ColliderDesc.cuboid(L / 2, 0.01, W / 2).setTranslation(0, H - 0.01, 0).setFriction(0)
      .setFrictionCombineRule(this.R.CoefficientCombineRule.Min).setCollisionGroups(this.sim.physics.groupsEnv), this.fixedBody, { kind: 'band', color: 'schwarz' });
    this.boxCollider(L / 2, 0.02, 0.008, 0, H + 0.01, W / 2 + 0.008);
    this.boxCollider(L / 2, 0.02, 0.008, 0, H + 0.01, -W / 2 - 0.008);
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#1e2124'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2a2e33'; g.fillRect(0, 0, 10, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(L / 0.05, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tex = tex;
    const beltMesh = mesh(new THREE.BoxGeometry(L, 0.02, W), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    beltMesh.position.y = H - 0.01;
    this.addVisual(beltMesh);
    for (const s of [-1, 1]) {
      const rail = mesh(Geo.box(L, 0.04, 0.016, 0.003), Mat.alu());
      rail.position.set(0, H + 0.01, s * (W / 2 + 0.008));
      this.addVisual(rail);
    }
    const body = mesh(Geo.box(L - 0.02, 0.05, W + 0.02, 0.006), Mat.alu());
    body.position.y = H - 0.045;
    this.addVisual(body);
    for (const sx of [-1, 1]) {
      const roller = mesh(Geo.cyl(0.02, 0.02, W, 20), Mat.steel());
      roller.rotation.x = Math.PI / 2;
      roller.position.set(sx * L / 2, H - 0.012, 0);
      this.addVisual(roller);
      for (const sz of [-1, 1]) {
        const leg = mesh(Geo.box(0.03, H - 0.07, 0.03, 0.003), Mat.anodized());
        leg.position.set(sx * (L / 2 - 0.06), (H - 0.07) / 2, sz * (W / 2 - 0.01));
        this.addVisual(leg);
      }
    }
    const motor = mesh(Geo.chamferCyl(0.035, 0.09, 0.004), Mat.anodized());
    motor.rotation.x = Math.PI / 2;
    motor.position.set(L / 2 - 0.02, H - 0.04, W / 2 + 0.07);
    this.addVisual(motor);
    this.motorPos = this.toWorld(L / 2 - 0.02, H - 0.04, W / 2 + 0.07);
    this.led = mesh(Geo.box(0.03, 0.02, 0.02, 0.004), Mat.glow('#3fd07a'));
    this.led.position.set(-L / 2 + 0.05, H + 0.045, W / 2 + 0.02);
    this.addVisual(this.led);
  }
  get speed() { return this.on ? (this.speedPct / 100) * 0.35 : 0; }
  dir() { return qrot(this.q, { x: 1, y: 0, z: 0 }); }
  temperature() { return this.sim.ambient() + (this.on ? 24 : 8); }
  update() {
    const v = this.speed;
    const d = this.dir();
    const n = qrot(this.q, { x: 0, y: 0, z: 1 });
    this.sim.physics.contacts(this.belt, (other) => {
      const b = other.parent();
      if (!b || !b.isDynamic()) return;
      const lv = b.linvel();
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
    this.tex.offset.x = -(this.sim.time * this.speed) / 0.05;
    this.led.material = Mat.glow(this.on && this.speedPct ? '#3fd07a' : '#ff3030');
  }
  get top() { return this.H; }
}

// Taster in Industriegehäuse
export class Button extends Fixed {
  build() {
    const c = hex(this.color || 'rot');
    this.pressed = false;
    this.boxCollider(0.06, 0.02, 0.06, 0, 0.02, 0, { color: 'grau' });
    const base = mesh(Geo.box(0.12, 0.04, 0.12, 0.008), Mat.plain('#c8cbce', 0.6));
    base.position.y = 0.02;
    this.addVisual(base);
    const ring = mesh(Geo.cyl(0.042, 0.042, 0.006, 32), Mat.paint('#e2a312'));
    ring.position.y = 0.043;
    this.addVisual(ring);
    this.cap = mesh(Geo.cyl(0.032, 0.035, 0.02, 32), Mat.accent(c));
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
  sync() { super.sync(); this.cap.position.y = this.pressed ? 0.045 : 0.052; }
}

// Signalleuchte auf Ständer
export class Lamp extends Fixed {
  build() {
    this.lit = this.spec.lit || null;
    const pole = mesh(Geo.cyl(0.01, 0.012, 0.3, 16), Mat.steel());
    pole.position.y = 0.15;
    this.addVisual(pole);
    const foot = mesh(Geo.cyl(0.05, 0.06, 0.02, 24), Mat.anodized());
    foot.position.y = 0.01;
    this.addVisual(foot);
    this.boxCollider(0.02, 0.15, 0.02, 0, 0.15, 0);
    this.bulb = mesh(Geo.cyl(0.035, 0.035, 0.07, 28), Mat.glass('#e8eaec', 0.6));
    this.bulb.position.y = 0.34;
    this.addVisual(this.bulb);
    const cap = mesh(Geo.chamferCyl(0.036, 0.012, 0.003), Mat.anodized());
    cap.position.y = 0.38;
    this.addVisual(cap);
    this.light = new THREE.PointLight('#ffffff', 0, 1.8, 2);
    this.light.position.y = 0.34;
    this.addVisual(this.light);
    this.setColor(this.lit);
  }
  setColor(c) {
    this.lit = c;
    if (!c) { this.bulb.material = Mat.glass('#e8eaec', 0.6); this.light.intensity = 0; return; }
    this.bulb.material = Mat.glow(hex(c));
    this.light.color.set(hex(c));
    this.light.intensity = 3;
  }
  lightAt(p) {
    if (!this.lit) return 0;
    const d = Math.hypot(p.x - (this.spec.x || 0), p.y - 0.34, p.z - (this.spec.z || 0));
    return d < 1.4 ? 0.5 * (1 - d / 1.4) : 0;
  }
  temperature() { return this.sim.ambient() + (this.lit ? 30 : 0); }
}

// Einweg-Lichtschranke (Sender/Empfänger)
export class LightBarrier extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.3;
    this.h = this.spec.h ?? 0.16;
    this.broken = false;
    for (const s of [-1, 1]) {
      const post = mesh(Geo.box(0.03, this.h + 0.05, 0.03, 0.004), Mat.alu());
      post.position.set(s * w / 2, (this.h + 0.05) / 2, 0);
      this.addVisual(post);
      const head = mesh(Geo.box(0.036, 0.05, 0.036, 0.005), Mat.paint('#e2a312'));
      head.position.set(s * w / 2, this.h, 0);
      this.addVisual(head);
      this.boxCollider(0.015, (this.h + 0.05) / 2, 0.015, s * w / 2, (this.h + 0.05) / 2, 0);
    }
    this.beam = new THREE.Mesh(Geo.cyl(0.002, 0.002, w - 0.03, 8), new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.85 }));
    this.beam.rotation.z = Math.PI / 2;
    this.beam.position.y = this.h;
    this.addVisual(this.beam);
  }
  post() {
    const a = this.toWorld(-this.w / 2 + 0.02, this.h, 0);
    const b = this.toWorld(this.w / 2 - 0.02, this.h, 0);
    const dir = { x: b.x - a.x, y: 0, z: b.z - a.z };
    const len = Math.hypot(dir.x, dir.z);
    dir.x /= len; dir.z /= len;
    const hit = this.sim.physics.ray(a, dir, len, 0xffffffff, this.fixedBody);
    this.broken = !!hit;
  }
  sync() { super.sync(); this.beam.material.opacity = this.broken ? 0.25 : 0.9; }
}

// Teilezuführung: lässt Werkstücke auf ein Förderband fallen
export class Dispenser extends Fixed {
  build() {
    this.queue = (this.spec.colors || ['rot', 'blau', 'grün', 'gelb']).slice();
    this.temps = this.spec.temps || null;
    this.codes = this.spec.codes || null;
    this.seq = 0;
    this.interval = this.spec.interval ?? 0;
    this.max = this.spec.max ?? 20;
    this.count = 0;
    this.timer = 0.6;
    const h = this.spec.h || 0.45;
    this.dropY = h - 0.05;
    const frame = Mat.plain('#8f969d', 0.5, 0.6);
    for (const [x, z] of [[-0.06, 0], [0.06, 0], [0, -0.06], [0, 0.06]]) {
      const wall = mesh(Geo.box(x ? 0.008 : 0.128, 0.18, z ? 0.008 : 0.128, 0.002), z > 0 ? Mat.glass('#b5c3cf', 0.4) : frame);
      wall.position.set(x, h + 0.01, z);
      this.addVisual(wall);
    }
    for (const s of [-1, 1]) {
      const leg = mesh(Geo.box(0.025, h, 0.025, 0.003), Mat.alu());
      leg.position.set(0, h / 2 - 0.04, s * 0.16);
      this.addVisual(leg);
      this.boxCollider(0.01, h / 2, 0.01, 0, h / 2 - 0.04, s * 0.16);
    }
    const bridge = mesh(Geo.box(0.025, 0.025, 0.34, 0.003), Mat.alu());
    bridge.position.set(0, h - 0.08, 0);
    this.addVisual(bridge);
  }
  spawn() {
    if (this.count >= this.max) return null;
    const i = this.seq % this.queue.length;
    const color = this.queue[i];
    this.seq++;
    this.count++;
    const p = this.toWorld(0, this.dropY, 0);
    const cube = new Cube(this.sim, { type: 'würfel', x: p.x, y: p.y, z: p.z, color, material: this.spec.material || 'holz', yaw: this.yaw, temp: this.temps ? this.temps[i] : undefined, code: this.codes ? this.codes[i] : undefined });
    this.sim.add(cube);
    if (this.onSpawn) this.onSpawn(cube);
    return cube;
  }
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

/* ------------------------------------------------------------------ */
/* Testobjekte und Ausstattung der Halle                               */
/* ------------------------------------------------------------------ */

// Hindernis: karton | gitterbox | pylon | palette
export class Obstacle extends Fixed {
  build() {
    const v = this.spec.variant || 'karton';
    const dims = { karton: [0.4, 0.4, 0.34], gitterbox: [0.6, 0.5, 0.45], pylon: [0.3, 0.45, 0.3], palette: [0.8, 0.5, 0.6] }[v] || [0.4, 0.4, 0.4];
    const w = this.spec.w || dims[0], h = this.spec.h || dims[1], d = this.spec.d || dims[2];
    this.dims = { w, h, d };
    if (v === 'pylon') {
      this.collider(this.R.ColliderDesc.cone(h / 2, w / 2 * 0.8).setTranslation(0, h / 2, 0).setCollisionGroups(this.sim.physics.groupsEnv), this.fixedBody, { kind: 'hindernis' });
      const base = mesh(Geo.box(w, 0.03, w, 0.006), Mat.rubber());
      base.position.y = 0.015;
      this.addVisual(base);
      const cone = mesh(Geo.cyl(0.02, w / 2 * 0.8, h - 0.03, 28), Mat.paint('#e2601a'));
      cone.position.y = 0.015 + (h - 0.03) / 2;
      this.addVisual(cone);
      for (const t of [0.45, 0.68]) {
        const b = mesh(Geo.cyl(w / 2 * 0.8 * (1 - t) + 0.024, w / 2 * 0.8 * (1 - t + 0.08) + 0.02, h * 0.08, 28), Mat.plain('#f0f2f4', 0.3));
        b.position.y = h * t;
        this.addVisual(b);
      }
      return;
    }
    this.boxCollider(w / 2, h / 2, d / 2, 0, h / 2, 0);
    if (v === 'karton') {
      const box = mesh(Geo.box(w, h, d, 0.006), Mat.plain('#b88a55', 0.85));
      box.position.y = h / 2;
      this.addVisual(box);
      const tape = mesh(Geo.box(0.06, 0.002, d + 0.002, 0), Mat.plain('#d9c49a', 0.6));
      tape.position.y = h + 0.001;
      this.addVisual(tape);
      const lab = plate('FRAGILE  ↑', 0.14, 0.05, { bg: '#f2efe6', color: '#222', size: 26 });
      lab.position.set(0, h * 0.6, d / 2 + 0.001);
      this.addVisual(lab);
    } else if (v === 'gitterbox') {
      const steel = Mat.plain('#7b858f', 0.5, 0.8);
      const mesh2 = new THREE.MeshStandardMaterial({ map: gridTexture(), transparent: true, alphaTest: 0.4, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
      for (const [x, z, ww, dd] of [[0, d / 2, w, 0.004], [0, -d / 2, w, 0.004], [w / 2, 0, 0.004, d], [-w / 2, 0, 0.004, d]]) {
        const p = mesh(Geo.box(ww, h - 0.08, dd, 0), mesh2);
        p.position.set(x, 0.08 + (h - 0.08) / 2, z);
        this.addVisual(p);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const post = mesh(Geo.box(0.03, h, 0.03, 0.002), steel);
        post.position.set(sx * (w / 2 - 0.015), h / 2, sz * (d / 2 - 0.015));
        this.addVisual(post);
      }
      const floor = mesh(Geo.box(w, 0.08, d, 0.004), steel);
      floor.position.y = 0.04;
      this.addVisual(floor);
      const goods = mesh(Geo.box(w - 0.08, h * 0.5, d - 0.08, 0.01), Mat.plain('#b88a55', 0.85));
      goods.position.y = 0.08 + h * 0.25;
      this.addVisual(goods);
    } else if (v === 'palette') {
      const wood = Mat.plain('#c9a273', 0.85);
      for (const sz of [-1, 0, 1]) {
        const block = mesh(Geo.box(w, 0.1, 0.1, 0.003), wood);
        block.position.set(0, 0.05, sz * (d / 2 - 0.05));
        this.addVisual(block);
      }
      const deck = mesh(Geo.box(w, 0.022, d, 0.002), wood);
      deck.position.y = 0.111;
      this.addVisual(deck);
      const goods = mesh(Geo.box(w - 0.04, h - 0.12, d - 0.04, 0.01), Mat.plain('#c2c7cc', 0.35, 0.1));
      goods.position.y = 0.122 + (h - 0.122) / 2;
      this.addVisual(goods);
      const strap = mesh(Geo.box(0.03, h - 0.118, d - 0.035, 0), Mat.plain('#2c5aa0', 0.5));
      strap.position.y = 0.122 + (h - 0.122) / 2;
      this.addVisual(strap);
    }
  }
}

let gridTex = null;
function gridTexture() {
  if (gridTex) return gridTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  gridTex = new THREE.CanvasTexture(c);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(4, 3);
  return gridTex;
}

// Schutzzaun-Element (Gitterfeld mit Pfosten)
export class Fence extends Fixed {
  build() {
    const w = this.spec.w || 1.0, h = this.spec.h || 1.2;
    this.boxCollider(w / 2, h / 2, 0.01, 0, h / 2, 0, { color: 'gelb' });
    const mat = new THREE.MeshStandardMaterial({ map: gridTexture().clone(), transparent: true, alphaTest: 0.4, color: '#2a2e33', roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide });
    mat.map.repeat.set(w * 10, h * 10);
    mat.map.needsUpdate = true;
    const panel = mesh(Geo.box(w - 0.04, h - 0.1, 0.004, 0), mat);
    panel.position.y = 0.06 + (h - 0.1) / 2;
    this.addVisual(panel);
    for (const s of [-1, 1]) {
      const post = mesh(Geo.box(0.04, h, 0.04, 0.003), Mat.paint('#e2a312'));
      post.position.set(s * (w / 2 - 0.02), h / 2, 0);
      this.addVisual(post);
      const foot = mesh(Geo.box(0.1, 0.01, 0.1, 0.002), Mat.paint('#e2a312'));
      foot.position.set(s * (w / 2 - 0.02), 0.005, 0);
      this.addVisual(foot);
    }
    for (const yy of [0.06, h - 0.02]) {
      const rail = mesh(Geo.box(w, 0.02, 0.025, 0.002), Mat.anodized());
      rail.position.y = yy;
      this.addVisual(rail);
    }
  }
}

// Palettenregal
export class Rack extends Fixed {
  build() {
    const w = this.spec.w || 1.8, d = this.spec.d || 0.6, h = this.spec.h || 1.6, n = this.spec.levels || 3;
    const blue = Mat.paint('#2c5aa0'), orange = Mat.paint('#e2601a');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const up = mesh(Geo.box(0.05, h, 0.05, 0.003), blue);
      up.position.set(sx * (w / 2 - 0.025), h / 2, sz * (d / 2 - 0.025));
      this.addVisual(up);
      this.boxCollider(0.025, h / 2, 0.025, sx * (w / 2 - 0.025), h / 2, sz * (d / 2 - 0.025));
    }
    for (let i = 1; i <= n; i++) {
      const y = (h / n) * i - 0.05;
      for (const sz of [-1, 1]) {
        const beam = mesh(Geo.box(w, 0.07, 0.04, 0.003), orange);
        beam.position.set(0, y, sz * (d / 2 - 0.025));
        this.addVisual(beam);
      }
      this.boxCollider(w / 2, 0.035, d / 2, 0, y, 0);
      if (i < n || h < 1.4) for (let k = 0; k < 3; k++) {
        const bx = mesh(Geo.box(w / 3 - 0.08, (h / n) * 0.55, d - 0.1, 0.008), Mat.plain(['#b88a55', '#c2c7cc', '#a3794a'][(i + k) % 3], 0.8));
        bx.position.set((k - 1) * (w / 3), y + 0.035 + (h / n) * 0.275, 0);
        this.addVisual(bx);
      }
    }
    this.boxCollider(w / 2, (h / n) * 0.3, d / 2 - 0.05, 0, (h / n) * 0.3, 0);
  }
}

// Bodenmarkierung (Fahrweg, Sperrfläche)
export class Marking extends Fixed {
  build() {
    const w = this.spec.w || 1, d = this.spec.d || 1;
    const style = this.spec.style || 'rahmen';
    const c = hex(this.color || '#e2a312');
    if (style === 'schraffur') {
      const t = stripeTexture('#e2a312', '#17191c', 8).clone();
      t.repeat.set(w / 0.4, d / 0.4);
      t.needsUpdate = true;
      const m = new THREE.Mesh(Geo.box(w, 0.002, d, 0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
      m.position.y = 0.0012;
      m.receiveShadow = true;
      this.addVisual(m);
      return;
    }
    const t = this.spec.t || 0.05;
    for (const [x, z, ww, dd] of [[0, d / 2 - t / 2, w, t], [0, -d / 2 + t / 2, w, t], [w / 2 - t / 2, 0, t, d], [-w / 2 + t / 2, 0, t, d]]) {
      if (style === 'linien' && ww < dd) continue;
      const m = new THREE.Mesh(Geo.box(ww, 0.002, dd, 0), Mat.plain(c, 0.7));
      m.position.set(x, 0.0012, z);
      m.receiveShadow = true;
      this.addVisual(m);
    }
  }
}

// Ladestation (Andockpunkt) mit Ladekontakten und Statusleuchte
export class Charger extends Fixed {
  build() {
    const w = this.w = this.spec.w || 0.42, d = this.d = this.spec.d || 0.42;
    this.color = this.color || 'blau';
    const back = mesh(Geo.box(0.3, 0.16, 0.06, 0.01), Mat.plain('#3a4045', 0.6));
    back.position.set(0, 0.08, -d / 2 - 0.03);
    this.addVisual(back);
    this.boxCollider(0.15, 0.08, 0.03, 0, 0.08, -d / 2 - 0.03);
    for (const x of [-0.03, 0.03]) {
      const c = mesh(Geo.box(0.03, 0.012, 0.03, 0.002), Mat.plain('#c58b45', 0.3, 0.9));
      c.position.set(x, 0.055, -d / 2 + 0.005);
      this.addVisual(c);
    }
    this.led = mesh(Geo.box(0.08, 0.012, 0.004, 0.002), Mat.glow('#4c8dff', 1.6));
    this.led.position.set(0, 0.13, -d / 2 + 0.0005);
    this.addVisual(this.led);
    const p = plate('LADESTATION', 0.2, 0.03, { bg: '#3a4045', color: '#e6e8eb', size: 30 });
    p.position.set(0, 0.1, -d / 2 + 0.0006);
    this.addVisual(p);
  }
  contains(p) { const l = this.toLocal(p.x, p.z); return Math.abs(l.x) <= this.w / 2 && Math.abs(l.z) <= this.d / 2; }
  sync() {
    super.sync();
    const docked = this.sim.robots.some((r) => this.contains(r.frame().p));
    this.led.material = Mat.glow(docked ? '#3fd07a' : '#4c8dff', 1.6);
  }
}

// 5G-Kleinzelle auf Mast
export class BaseStation extends Fixed {
  build() {
    const h = this.spec.h || 2.2;
    this.radioSpec = { tech: '5g', ptx: 30, sens: -108, freq: 3700, latency: 0.012 };
    this.gain = 8;
    this.pos = this.toWorld(0, h, 0);
    const pole = mesh(Geo.cyl(0.03, 0.04, h, 16), Mat.steel());
    pole.position.y = h / 2;
    this.addVisual(pole);
    this.boxCollider(0.04, h / 2, 0.04, 0, h / 2, 0);
    const box = mesh(Geo.box(0.16, 0.3, 0.08, 0.02), Mat.plain('#e6e8ea', 0.5));
    box.position.set(0, h - 0.1, 0.06);
    this.addVisual(box);
    const led = mesh(Geo.box(0.02, 0.02, 0.004, 0.002), Mat.glow('#3fd07a', 1.4));
    led.position.set(0, h - 0.2, 0.101);
    this.addVisual(led);
    const p = plate('5G · n78', 0.1, 0.025, { bg: '#e6e8ea', color: '#333', size: 30 });
    p.position.set(0, h - 0.02, 0.1005);
    this.addVisual(p);
    const base = mesh(Geo.box(0.4, 0.04, 0.4, 0.006), Mat.plain('#8f9295', 0.9));
    base.position.y = 0.02;
    this.addVisual(base);
  }
  antennaPose() { return { p: this.pos, d: { x: 0, y: 0, z: 1 } }; }
  get radio() { return this.radioSpec; }
}

/* ---------------- Bewegte Testobjekte ---------------- */

class Mover extends Entity {
  constructor(sim, spec) {
    super(sim);
    this.spec = { ...spec };
    this.kind = spec.type;
    this.name = spec.name || autoName(spec.type, null);
    this.pos = { x: spec.x || 0, z: spec.z || 0 };
    this.heading = spec.yaw || 0;
    this.vel = { x: 0, y: 0, z: 0 };
    const R = this.R;
    this.body = this.addBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, 0, this.pos.z).setRotation(qyaw(this.heading)));
    this.build();
  }
  get t() { return this.sim.runStart != null ? this.sim.time - this.sim.runStart : -1; }
  radarBody() { return this.body; }
  velocity() { return this.vel; }
  moveTo(x, z, heading, dt) {
    this.vel = { x: (x - this.pos.x) / dt, y: 0, z: (z - this.pos.z) / dt };
    this.pos = { x, z };
    if (heading != null) this.heading = heading;
    this.body.setNextKinematicTranslation({ x, y: 0, z });
    this.body.setNextKinematicRotation(qyaw(this.heading));
  }
  get center() { return { x: this.pos.x, y: 0.4, z: this.pos.z }; }
}

/*
 * Routenzug-Dummy (fahrerloses Transportfahrzeug): pendelt auf einer Strecke und bremst selbst,
 * wenn etwas in seinem Fahrweg steht. braked = true merkt sich, ob es bremsen musste.
 */
export class Vehicle extends Mover {
  build() {
    const L = this.Lv = this.spec.l || 0.9, W = this.spec.w || 0.5, H = 0.5;
    this.path = this.spec.path || [[this.pos.x - 2, this.pos.z], [this.pos.x + 2, this.pos.z]];
    this.speed = this.spec.speed ?? 1.0;
    this.pauseT = this.spec.pause ?? 0.6;
    this.seg = 0; this.dirSign = 1; this.s = this.spec.s0 ?? 0; this.wait = 0; this.v = 0;
    this.braked = false; this.brakes = 0;
    this.collider(this.R.ColliderDesc.cuboid(W / 2, H / 2, L / 2).setTranslation(0, H / 2 + 0.03, 0).setCollisionGroups(this.sim.physics.groupsObj), this.body, { kind: 'fahrzeug' });
    const g = new THREE.Group();
    this.link(this.body, g);
    const body = mesh(Geo.box(W, 0.32, L, 0.03), Mat.paint('#e2601a'));
    body.position.y = 0.2;
    g.add(body);
    const top = mesh(Geo.box(W - 0.06, 0.16, L * 0.45, 0.03), Mat.anodized());
    top.position.set(0, 0.42, -L * 0.15);
    g.add(top);
    for (const z of [L / 2 + 0.002, -L / 2 - 0.002]) {
      const stripe = mesh(Geo.box(W - 0.04, 0.06, 0.004, 0), Mat.hazard());
      stripe.position.set(0, 0.12, z);
      g.add(stripe);
      const scanner = mesh(Geo.box(0.1, 0.06, 0.03, 0.006), Mat.paint('#e2a312'));
      scanner.position.set(0, 0.06, z * 1.01);
      g.add(scanner);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wheel = mesh(Geo.cyl(0.06, 0.06, 0.05, 20), Mat.rubber());
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (W / 2 - 0.02), 0.06, sz * (L / 2 - 0.15));
      g.add(wheel);
    }
    this.beacon = mesh(Geo.cyl(0.03, 0.03, 0.05, 16), Mat.glow('#ff8a1a', 2));
    this.beacon.position.set(0, 0.53, -L * 0.15);
    g.add(this.beacon);
    // „Blue Spot“: Warnprojektion auf den Boden in Fahrtrichtung
    this.spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: '#3a7bff', transparent: true, opacity: 0.55, depthWrite: false }));
    this.spot.rotation.x = -Math.PI / 2;
    this.spot.position.set(0, 0.003, L / 2 + 0.6);
    g.add(this.spot);
    const lab = plate('FTS · ROUTENZUG', 0.3, 0.05, { bg: '#e2601a', color: '#16191d', size: 28 });
    lab.position.set(W / 2 + 0.002, 0.25, 0);
    lab.rotation.y = Math.PI / 2;
    g.add(lab);
    this.visual = g;
    this.place(0);
  }
  pathLen() { const [a, b] = this.path; return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  place(dt) {
    const [a, b] = this.path;
    const len = this.pathLen();
    const k = clamp(this.s / len, 0, 1);
    const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
    const hd = Math.atan2((b[0] - a[0]) * this.dirSign, (b[1] - a[1]) * this.dirSign);
    if (dt) this.moveTo(x, z, hd, dt);
    else { this.pos = { x, z }; this.heading = hd; this.body.setTranslation({ x, y: 0, z }, true); this.body.setRotation(qyaw(hd), true); }
  }
  // Steht etwas im Fahrweg (vor dem Fahrzeug, in Fahrzeugbreite)?
  blocked() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (const e of this.sim.entities) {
      if (e === this || !(e.isRobot || e.isObject || e.kind === 'dummy')) continue;
      const p = e.isRobot ? e.frame().p : e.isObject ? e.body.translation() : e.pos;
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
      const fw = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
      if (fw > 0 && fw < this.Lv / 2 + 0.75 && Math.abs(lat) < 0.42) return true;
    }
    return false;
  }
  update(dt) {
    if (this.t < 0) { this.vel = { x: 0, y: 0, z: 0 }; return; }
    if (this.t < (this.spec.delay || 0)) { this.place(dt); return; }
    const len = this.pathLen();
    if (this.wait > 0) { this.wait -= dt; this.v = 0; this.place(dt); return; }
    const block = this.blocked();
    const vWant = block ? 0 : this.speed;
    if (block && this.v > 0.2 && !this.braked) { this.braked = true; this.brakes++; }
    this.v += clamp(vWant - this.v, -2.5 * dt, 1.2 * dt);
    this.s += this.v * dt * this.dirSign;
    if (this.s >= len) { this.s = len; this.dirSign = -1; this.wait = this.pauseT; }
    if (this.s <= 0) { this.s = 0; this.dirSign = 1; this.wait = this.pauseT; }
    this.place(dt);
  }
  sync() {
    super.sync();
    this.beacon.material = Mat.glow(Math.sin(this.sim.time * 9) > 0 ? '#ff8a1a' : '#5a2a00', 2);
    this.spot.visible = this.v > 0.05;
  }
  rcs() { return 12; }
  temperature() { return this.sim.ambient() + 14; }
}

/*
 * Personen-Testdummy (z. B. für Schutzfeldprüfungen): folgt einer Zeitliste [[t, x, z], …]
 * ab Programmstart. Körpertemperatur 34 °C – im Wärmebild deutlich sichtbar.
 */
export class Dummy extends Mover {
  build() {
    this.route = this.spec.route || [[0, this.pos.x, this.pos.z]];
    this.collider(this.R.ColliderDesc.capsule(0.55, 0.16).setTranslation(0, 0.72, 0).setCollisionGroups(this.sim.physics.groupsObj), this.body, { kind: 'dummy' });
    const g = new THREE.Group();
    this.link(this.body, g);
    const suit = Mat.plain('#3a4148', 0.8), vest = Mat.plain('#ff7a1a', 0.6), refl = Mat.plain('#d9dde2', 0.2, 0.8);
    for (const s of [-1, 1]) {
      const leg = mesh(Geo.capsule(0.055, 0.62), suit);
      leg.position.set(s * 0.08, 0.42, 0);
      g.add(leg);
      const shoe = mesh(Geo.box(0.1, 0.06, 0.2, 0.02), Mat.rubber());
      shoe.position.set(s * 0.08, 0.03, 0.03);
      g.add(shoe);
      const arm = mesh(Geo.capsule(0.045, 0.5), suit);
      arm.position.set(s * 0.22, 1.12, 0);
      g.add(arm);
    }
    const torso = mesh(Geo.box(0.36, 0.58, 0.22, 0.08), vest);
    torso.position.y = 1.12;
    g.add(torso);
    for (const yy of [0.98, 1.1]) {
      const band = mesh(Geo.box(0.365, 0.035, 0.225, 0.01), refl);
      band.position.y = yy;
      g.add(band);
    }
    const head = mesh(Geo.sphere(0.1, 24), Mat.plain('#c9ccd0', 0.6));
    head.position.y = 1.55;
    g.add(head);
    const helmet = mesh(Geo.sphere(0.112, 24), Mat.paint('#f4f4f2'));
    helmet.scale.set(1, 0.6, 1);
    helmet.position.y = 1.6;
    g.add(helmet);
    this.visual = g;
  }
  update(dt) {
    const t = this.t;
    if (t < 0) { this.vel = { x: 0, y: 0, z: 0 }; return; }
    const r = this.route;
    let x = r[0][1], z = r[0][2];
    for (let i = 0; i < r.length - 1; i++) {
      const [t0, x0, z0] = r[i], [t1, x1, z1] = r[i + 1];
      if (t >= t0 && t <= t1) { const k = (t - t0) / Math.max(1e-6, t1 - t0); x = x0 + (x1 - x0) * k; z = z0 + (z1 - z0) * k; break; }
      if (t > t1) { x = x1; z = z1; }
    }
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const hd = Math.hypot(dx, dz) > 1e-4 ? Math.atan2(dx, dz) : this.heading;
    this.moveTo(x, z, hd, dt);
  }
  rcs() { return 0.8; }
  temperature() { return 34; }
}

export const OBJECT_TYPES = {
  würfel: { cls: Cube, name: 'Werkstück (Würfel)', icon: 'cube' },
  kugel: { cls: Ball, name: 'Kugel', icon: 'ball' },
  zylinder: { cls: Cylinder, name: 'Rundteil', icon: 'cylinder' },
  tisch: { cls: Table, name: 'Arbeitstisch', icon: 'table' },
  wand: { cls: Wall, name: 'Trennwand', icon: 'wall' },
  zaun: { cls: Fence, name: 'Schutzzaun', icon: 'fence' },
  rampe: { cls: Ramp, name: 'Rampe', icon: 'ramp' },
  zone: { cls: Zone, name: 'Ablagefläche', icon: 'zone' },
  kiste: { cls: Bin, name: 'KLT-Behälter', icon: 'bin' },
  linie: { cls: LineTrack, name: 'Spurlinie', icon: 'line' },
  ziel: { cls: Flag, name: 'Zielmarke', icon: 'flag' },
  band: { cls: Conveyor, name: 'Förderband', icon: 'conveyor' },
  taster: { cls: Button, name: 'Taster', icon: 'button' },
  lampe: { cls: Lamp, name: 'Signalleuchte', icon: 'lamp' },
  lichtschranke: { cls: LightBarrier, name: 'Lichtschranke', icon: 'barrier' },
  spender: { cls: Dispenser, name: 'Teilezuführung', icon: 'dispenser' },
  hindernis: { cls: Obstacle, name: 'Hindernis', icon: 'box' },
  regal: { cls: Rack, name: 'Palettenregal', icon: 'rack' },
  markierung: { cls: Marking, name: 'Bodenmarkierung', icon: 'zone' },
  ladestation: { cls: Charger, name: 'Ladestation', icon: 'plug' },
  basisstation: { cls: BaseStation, name: '5G-Basisstation', icon: 'antenna' },
  fahrzeug: { cls: Vehicle, name: 'Routenzug (FTS)', icon: 'truck' },
  dummy: { cls: Dummy, name: 'Personen-Dummy', icon: 'person' },
};

export function createObject(sim, spec) {
  const t = OBJECT_TYPES[spec.type];
  if (!t) throw new Error('Unbekannter Gegenstand: ' + spec.type);
  const e = new t.cls(sim, spec);
  sim.add(e);
  return e;
}
