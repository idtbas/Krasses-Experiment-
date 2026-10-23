// Modellier-Werkzeuge für detailreiche, LiDAR-taugliche Objekte (echte Geometrie statt Texturen).
import * as THREE from 'three';
import { mergeGeometries, RoundedBoxGeometry } from 'three';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const cache = new Map();
const key = (...a) => a.map((v) => (typeof v === 'number' ? v.toFixed(4) : String(v))).join(',');
function memo(k, f) { let g = cache.get(k); if (!g) { g = f(); cache.set(k, g); } return g; }

export const G = {
  box: (w, h, d) => memo(key('b', w, h, d), () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r, seg = 2) => memo(key('rb', w, h, d, r, seg), () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4))),
  cyl: (rt, rb, h, seg = 24, open = false) => memo(key('c', rt, rb, h, seg, open), () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  sphere: (r, ws = 24, hs = 16) => memo(key('s', r, ws, hs), () => new THREE.SphereGeometry(r, ws, hs)),
  torus: (r, t, rs = 10, ts = 32, arc = Math.PI * 2) => memo(key('t', r, t, rs, ts, arc), () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  plane: (w, h) => memo(key('p', w, h), () => new THREE.PlaneGeometry(w, h)),
  lathe: (prof, seg = 32) => memo('l' + JSON.stringify(prof) + seg, () => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg)),
  cone: (r, h, seg = 24) => memo(key('co', r, h, seg), () => new THREE.ConeGeometry(r, h, seg)),
};

// Profil (2D-Punkte in x/y) entlang z extrudieren, Mitte bei z = 0
export function extrude(points, depth, opts = {}) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  if (opts.holes) for (const h of opts.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !!opts.bevel, bevelSize: opts.bevel || 0, bevelThickness: opts.bevel || 0, bevelSegments: 2, curveSegments: opts.curve || 12 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Doppel-T-Träger (HEB/IPE): Höhe h, Breite b, Stegdicke tw, Flanschdicke tf, Länge entlang y
export function iBeam(h, b, tw, tf, len) {
  return memo(key('ib', h, b, tw, tf, len), () => {
    const hw = b / 2, hh = h / 2, t = tw / 2;
    const pts = [[-hw, -hh], [hw, -hh], [hw, -hh + tf], [t, -hh + tf], [t, hh - tf], [hw, hh - tf], [hw, hh], [-hw, hh], [-hw, hh - tf], [-t, hh - tf], [-t, -hh + tf], [-hw, -hh + tf]];
    const g = extrude(pts, len);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

// Wellblech-Wandfeld (Sinusprofil): Breite w (x), Höhe h (y), Wellenhöhe a, Teilung p; Vorderseite +z
export function corrugated(w, h, a = 0.018, p = 0.076, rows = 2) {
  return memo(key('cor', w, h, a, p), () => {
    const nx = Math.max(8, Math.round(w / p * 8));
    const g = new THREE.PlaneGeometry(w, h, nx, rows);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin((x / p) * Math.PI * 2) * a * 0.5);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Trapezblech (Dach/Wand): Breite w, Länge h
export function trapezSheet(w, h, a = 0.04, p = 0.2) {
  return memo(key('tz', w, h, a, p), () => {
    const pts = [];
    const n = Math.round(w / p);
    for (let i = 0; i <= n; i++) {
      const x0 = -w / 2 + i * p;
      pts.push([x0, 0], [x0 + p * 0.2, 0], [x0 + p * 0.3, a], [x0 + p * 0.7, a], [x0 + p * 0.8, 0]);
    }
    const shape = [];
    for (const q of pts) shape.push(q);
    for (let i = pts.length - 1; i >= 0; i--) shape.push([pts[i][0], pts[i][1] - 0.0008]);
    const g = extrude(shape, h);
    return g;
  });
}

// Drahtgitter (Schutzzaun): Feld w × h, Maschenweite m, Drahtdicke d (als dünne Quader)
export function wireMesh(w, h, m = 0.05, d = 0.004) {
  return memo(key('wm', w, h, m, d), () => {
    const geos = [];
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += m) { const g = new THREE.BoxGeometry(d, h, d); g.translate(x, 0, 0); geos.push(g); }
    for (let y = -h / 2; y <= h / 2 + 1e-6; y += m * 2) { const g = new THREE.BoxGeometry(w, d, d); g.translate(0, y, d); geos.push(g); }
    return mergeGeometries(geos);
  });
}

// Rohr entlang Punkten (Kurve) mit Radius r
export function pipe(points, r, seg = 48, radial = 16) {
  const curve = points.length > 2 ? new THREE.CatmullRomCurve3(points.map((p) => V3(...p)), false, 'catmullrom', 0.02) : new THREE.LineCurve3(V3(...points[0]), V3(...points[1]));
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

// gerades Rohr zwischen zwei Punkten
export function rod(a, b, r, mat, seg = 16) {
  const A = V3(...a), B = V3(...b);
  const d = new THREE.Vector3().subVectors(B, A);
  const m = mesh(G.cyl(r, r, d.length(), seg), mat);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  return m;
}

// Fachwerkbinder in der x/y-Ebene: Spannweite span, Höhe h, Feldanzahl n, Profildicke t
export function truss(span, h, n, t, mat) {
  const g = new THREE.Group();
  const top = [-span / 2, h], bot = [-span / 2, 0];
  void top; void bot;
  g.add(mesh(G.box(span, t, t * 1.2), mat, 0, h, 0));
  g.add(mesh(G.box(span, t, t * 1.2), mat, 0, 0, 0));
  for (let i = 0; i <= n; i++) {
    const x = -span / 2 + (i / n) * span;
    g.add(mesh(G.box(t * 0.8, h, t * 0.8), mat, x, h / 2, 0));
    if (i < n) {
      const x2 = -span / 2 + ((i + 1) / n) * span;
      const dx = x2 - x, len = Math.hypot(dx, h);
      const diag = mesh(G.box(t * 0.6, len, t * 0.6), mat, (x + x2) / 2, h / 2, 0);
      diag.rotation.z = (i % 2 ? 1 : -1) * Math.atan2(dx, h);
      g.add(diag);
    }
  }
  return g;
}

// Netz verformen: f(x, y, z) → Verschiebung entlang der Normalen
export function displace(geo, f) {
  const g = geo.clone();
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = f(x, y, z);
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

// einfaches Wertrauschen (für Gelände, Felsen, Rinde)
function h3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(fx), v = s(fy), w = s(fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}
export function fbm(x, y, z, oct = 4) { let a = 0, f = 1, s = 0.5; for (let i = 0; i < oct; i++) { a += noise3(x * f, y * f, z * f) * s; f *= 2.03; s *= 0.5; } return a; }

export function merge(geos) { return mergeGeometries(geos.filter(Boolean)); }

// Gruppe nach Material zusammenfassen (weniger Draw-Calls, gleiche Geometrie für LiDAR)
export function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const drop = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.keep || p.userData.lidarBody) return;
    const g = o.geometry;
    const k = o.material.uuid + (g.index ? 'i' : 'n');
    if (!buckets.has(k)) buckets.set(k, { mat: o.material, list: [] });
    buckets.get(k).list.push({ g, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), o });
  });
  for (const b of buckets.values()) {
    if (b.list.length < 2) continue;
    const geos = [];
    for (const { g, m } of b.list) {
      const c = (g.index ? g.toNonIndexed() : g.clone());
      for (const n of Object.keys(c.attributes)) if (n !== 'position' && n !== 'normal') c.deleteAttribute(n);
      c.applyMatrix4(m);
      geos.push(c);
    }
    let merged = null;
    try { merged = mergeGeometries(geos); } catch { merged = null; }
    if (!merged) continue;
    for (const { o } of b.list) drop.push(o);
    const mm = new THREE.Mesh(merged, b.mat);
    mm.castShadow = true; mm.receiveShadow = true;
    group.add(mm);
  }
  for (const o of drop) o.removeFromParent();
  return group;
}
