// Darstellung der Modelle im Feldrechner: glattes Netz (Farbe, Höhe, Ton), Raummodell aus Wänden mit Türen und
// Fenstern, Grundriss als SVG mit Bemaßung. Alles auf der Netz-Ebene (nur im Viewer sichtbar).
import * as THREE from 'three';
import { MESH_LAYER } from './cloud.js';

const onLayer = (o) => { o.traverse((x) => x.layers.set(MESH_LAYER)); return o; };

/* ---------------- Netz ---------------- */
export const LOOKS = { orig: 'Farbe', height: 'Höhe', clay: 'Ton' };

export function meshObject(d, look = 'orig') {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  geo.setIndex(new THREE.BufferAttribute(d.index, 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  // nur die gescannte Seite zeigen: von außen blickt man in einen Raum hinein (Puppenhaus), Gegenstände bleiben zu
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0, side: THREE.FrontSide });
  const m = new THREE.Mesh(geo, mat);
  m.userData.data = d;
  setLook(m, look);
  return onLayer(m);
}

// Färbung wechseln, ohne neu zu vernetzen. Umgebungsverdeckung (d.ao) dunkelt Ecken und Fugen ab;
// sehr dunkle Scanfarben werden behutsam aufgehellt (Belichtungsausgleich wie bei einer Kamera-App).
export function setLook(m, look, wire = false) {
  const d = m.userData.data, geo = m.geometry, mat = m.material;
  const nv = d.pos.length / 3;
  const ao = d.ao && d.ao.length === nv ? d.ao : null;
  const shade = (i) => (ao ? 0.28 + 0.72 * Math.pow(Math.max(0, Math.min(1, ao[i])), 1.8) : 1);
  const c = new Float32Array(nv * 3);
  if (look === 'clay') {
    for (let i = 0; i < nv; i++) { const k = shade(i); c[i * 3] = 0.78 * k; c[i * 3 + 1] = 0.74 * k; c[i * 3 + 2] = 0.69 * k; }
    mat.roughness = 0.9;
  } else if (look === 'height') {
    const bb = geo.boundingBox, y0 = bb.min.y, span = Math.max(0.05, bb.max.y - y0);
    const tmp = new THREE.Color();
    for (let i = 0; i < nv; i++) { tmp.setHSL(0.66 - 0.66 * (d.pos[i * 3 + 1] - y0) / span, 0.72, 0.52); const k = shade(i); c[i * 3] = tmp.r * k; c[i * 3 + 1] = tmp.g * k; c[i * 3 + 2] = tmp.b * k; }
    mat.roughness = 0.82;
  } else if (d.rgb && d.rgb.length) {
    // Median der Helligkeit (Stichprobe) → Verstärkung, damit dunkle Scans nicht absaufen
    const L = [];
    for (let i = 0; i < nv; i += Math.max(1, Math.floor(nv / 4000))) L.push(0.3 * d.rgb[i * 3] + 0.59 * d.rgb[i * 3 + 1] + 0.11 * d.rgb[i * 3 + 2]);
    L.sort((a, b) => a - b);
    const gain = Math.min(2.2, Math.max(1, 110 / Math.max(1, L[L.length >> 1] || 110)));
    for (let i = 0; i < nv; i++) { const k = shade(i); for (let q = 0; q < 3; q++) c[i * 3 + q] = Math.pow(Math.min(255, d.rgb[i * 3 + q] * gain) / 255, 2.2) * k; }
    mat.roughness = 0.82;
  } else for (let i = 0; i < nv; i++) { const k = 0.7 * shade(i); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  mat.vertexColors = true; mat.color.set('#ffffff');
  mat.wireframe = wire;
  mat.needsUpdate = true;
}

// Studio im Viewer: heller Boden mit Raster und weichem Kontaktschatten unter dem Modell
let STUDIO = null;
export function studio(world) {
  if (STUDIO) return STUDIO;
  const g = new THREE.Group();
  g.name = 'Studio';
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  const rg = x.createRadialGradient(128, 128, 8, 128, 128, 128);
  rg.addColorStop(0, 'rgba(0,0,0,0.55)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1;
  const grid = new THREE.GridHelper(1, 20, '#5a6878', '#3a4450');
  grid.material.transparent = true; grid.material.opacity = 0.45; grid.material.depthWrite = false;
  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), new THREE.MeshStandardMaterial({ color: '#3a424c', roughness: 1, transparent: true, opacity: 0.95, depthWrite: false }));
  disk.rotation.x = -Math.PI / 2;
  g.add(disk, grid, shadow);
  g.userData = { shadow, grid, disk };
  g.visible = false;
  world.clouds.add(onLayer(g));
  return (STUDIO = g);
}
// Studio unter einen Hüllquader legen
export function placeStudio(g, box) {
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const R = Math.max(s.x, s.z), y = box.min.y - 0.004;
  const { shadow, grid, disk } = g.userData;
  disk.scale.setScalar(R * 2.4); disk.position.set(c.x, y - 0.002, c.z);
  grid.scale.setScalar(R * 1.65); grid.position.set(c.x, y, c.z);
  shadow.scale.set(s.x * 1.5 + 0.1, s.z * 1.5 + 0.1, 1); shadow.position.set(c.x, y + 0.002, c.z);
}

// Parkett als Textur (Dielen mit leicht wechselndem Ton), 1 Wiederholung je 1,2 m
let PARQUET = null;
function parquet() {
  if (PARQUET) return PARQUET;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const x = cv.getContext('2d');
  let seed = 3; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rows = 14, h = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let px = -rnd() * 300;
    while (px < 512) {
      const w = 260 + rnd() * 200, t = 0.94 + rnd() * 0.1;
      x.fillStyle = `rgb(${Math.round(188 * t)},${Math.round(156 * t)},${Math.round(119 * t)})`;
      x.fillRect(px, r * h, w, h);
      x.strokeStyle = 'rgba(70,45,20,0.10)';
      for (let k = 0; k < 4; k++) { x.beginPath(); const yy = r * h + 4 + rnd() * (h - 8); x.moveTo(px, yy); x.bezierCurveTo(px + w * 0.3, yy + 3, px + w * 0.7, yy - 3, px + w, yy); x.stroke(); }
      x.fillStyle = 'rgba(60,40,20,0.22)'; x.fillRect(px, r * h, 1.5, h);
      px += w;
    }
    x.fillStyle = 'rgba(60,40,20,0.2)'; x.fillRect(0, r * h, 512, 1.5);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(1 / 2.0, 1 / 2.0); // 14 Dielen auf 2 m: je ≈ 14 cm breit
  return (PARQUET = t);
}

/* ---------------- Raum ---------------- */
const WALL_T = 0.1;

// Quader aus Eckpunkten in eine gemeinsame Geometrie (ein Zeichenaufruf je Material)
class Boxes {
  constructor(shade = null) { this.pos = []; this.nor = []; this.idx = []; this.col = []; this.shade = shade; }
  // Mittelpunkt c (Vector3), Richtung entlang der Wand d (Vector3, waagrecht), Maße: Länge, Höhe, Dicke
  add(c, d, len, hgt, thk) {
    const n = new THREE.Vector3(-d.z, 0, d.x), u = new THREE.Vector3(0, 1, 0);
    const faces = [[d, n, u], [d.clone().negate(), n.clone().negate(), u], [n, d.clone().negate(), u], [n.clone().negate(), d, u], [u, d, n.clone().negate()], [u.clone().negate(), d, n]];
    const half = { d: len / 2, n: thk / 2, u: hgt / 2 };
    const ext = (v) => (Math.abs(v.dot(d)) > 0.5 ? half.d : Math.abs(v.dot(n)) > 0.5 ? half.n : half.u);
    for (let [N, A, B] of faces) {
      if (new THREE.Vector3().crossVectors(A, B).dot(N) < 0) [A, B] = [B, A]; // gegen den Uhrzeigersinn von außen
      const o = c.clone().addScaledVector(N, ext(N)), ea = ext(A), eb = ext(B), base = this.pos.length / 3;
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = o.clone().addScaledVector(A, sa * ea).addScaledVector(B, sb * eb);
        this.pos.push(p.x, p.y, p.z); this.nor.push(N.x, N.y, N.z);
        if (this.shade) { const k = this.shade(p, N); this.col.push(k[0], k[1], k[2]); }
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

export function roomObject(room, o = {}) {
  const g = new THREE.Group();
  g.name = 'Raummodell';
  const F = room.floor, T = room.top, Hh = T - F;
  // Boden
  const shape = new THREE.Shape(room.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const fg = new THREE.ShapeGeometry(shape);
  fg.rotateX(-Math.PI / 2); fg.translate(0, F, 0);
  g.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: parquet(), roughness: 0.62, side: THREE.DoubleSide })));
  if (o.ceiling) {
    const cg = fg.clone(); cg.translate(0, Hh, 0);
    g.add(new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false })));
  }
  // Wände: Schnittkante oben dunkel (Puppenhaus-Blick), zum Boden hin leicht abgedunkelt
  const walls = new Boxes((p, n) => (n.y > 0.5 ? [0.36, 0.4, 0.45] : (() => { const k = 0.8 + 0.2 * Math.min(1, (p.y - F) / 0.6); return [k, k, k]; })()));
  const trims = new Boxes(), glass = new Boxes(), base = new Boxes(), leaf = new Boxes(), sill = new Boxes();
  const N = room.walls.length;
  const dirOf = (w) => new THREE.Vector3(w.b[0] - w.a[0], 0, w.b[1] - w.a[1]).normalize();
  // Polygon gegen den Uhrzeigersinn in (x, z): Linksknick = konvexe Ecke, dort die Wand um ihre Dicke verlängern
  const convex = (w, next) => { const a = dirOf(w), b = dirOf(next); return a.x * b.z - a.z * b.x > 0; };
  room.walls.forEach((w, k) => {
    const d = dirOf(w), inward = new THREE.Vector3(-d.z, 0, d.x);
    const prev = room.walls[(k - 1 + N) % N], next = room.walls[(k + 1) % N];
    const e0 = convex(prev, w) ? WALL_T : 0, e1 = convex(w, next) ? WALL_T : 0;
    const org = new THREE.Vector3(w.a[0], F, w.a[1]).addScaledVector(inward, -WALL_T / 2);
    const at = (s, y) => org.clone().addScaledVector(d, s).setY(y);
    const piece = (s0, s1, y0, y1, B = walls, thk = WALL_T, off = 0) => {
      if (s1 - s0 < 0.005 || y1 - y0 < 0.005) return;
      B.add(at((s0 + s1) / 2, (y0 + y1) / 2).addScaledVector(inward, off), d, s1 - s0, y1 - y0, thk);
    };
    const ops = [...w.openings].sort((p, q) => p.s0 - q.s0);
    let s = -e0;
    for (const q of ops) {
      piece(s, q.s0, F, T);
      piece(q.s0, q.s1, F, q.y0);
      piece(q.s0, q.s1, q.y1, T);
      // Rahmen: Leibung und Sturz, beim Fenster eine Scheibe
      const fw = 0.05;
      piece(q.s0, q.s0 + fw, q.y0, q.y1, trims, WALL_T + 0.03);
      piece(q.s1 - fw, q.s1, q.y0, q.y1, trims, WALL_T + 0.03);
      piece(q.s0, q.s1, q.y1 - fw, q.y1, trims, WALL_T + 0.03);
      if (q.kind === 'fenster') {
        piece(q.s0 + fw, q.s1 - fw, q.y0 + fw, q.y1 - fw, glass, 0.012);
        piece(q.s0 + fw, q.s1 - fw, (q.y0 + q.y1) / 2 - 0.02, (q.y0 + q.y1) / 2 + 0.02, trims, 0.05); // Kämpfer
        piece(q.s0 - 0.04, q.s1 + 0.04, q.y0 - 0.03, q.y0, sill, 0.2, 0.08); // Fensterbank innen
      } else {
        // Türblatt, nach innen geöffnet (≈ 100°), Band an der Seite s0, mit Griff
        const wd = q.s1 - q.s0 - 0.06, hg = q.y1 - q.y0 - 0.02, ang = 1.75;
        const hinge = at(q.s0 + 0.03, F).addScaledVector(inward, WALL_T / 2);
        const dir = d.clone().multiplyScalar(Math.cos(ang)).addScaledVector(inward, Math.sin(ang));
        leaf.add(hinge.clone().addScaledVector(dir, wd / 2).setY(q.y0 + hg / 2), dir, wd, hg, 0.04);
        trims.add(hinge.clone().addScaledVector(dir, wd - 0.07).setY(q.y0 + 1.02).addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), 0.035), dir, 0.12, 0.022, 0.03);
      }
      s = q.s1;
    }
    piece(s, w.len + e1, F, T);
    // Sockelleiste innen, an Türen unterbrochen
    const doors = ops.filter((q) => q.kind === 'tür');
    let t0 = 0;
    for (const q of [...doors, { s0: w.len, s1: w.len }]) {
      const a0 = t0, a1 = q.s0;
      if (a1 - a0 > 0.02) base.add(at((a0 + a1) / 2, F + 0.035).addScaledVector(inward, WALL_T / 2 + 0.008), d, a1 - a0, 0.07, 0.016);
      t0 = q.s1;
    }
  });
  g.add(new THREE.Mesh(walls.geometry(), new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: 0.92, vertexColors: true })));
  if (trims.idx.length) g.add(new THREE.Mesh(trims.geometry(), new THREE.MeshStandardMaterial({ color: '#5d4c3e', roughness: 0.6 })));
  if (base.idx.length) g.add(new THREE.Mesh(base.geometry(), new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.5 })));
  if (leaf.idx.length) g.add(new THREE.Mesh(leaf.geometry(), new THREE.MeshStandardMaterial({ color: '#b48a5a', roughness: 0.55 })));
  if (sill.idx.length) g.add(new THREE.Mesh(sill.geometry(), new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.4 })));
  if (glass.idx.length) g.add(new THREE.Mesh(glass.geometry(), new THREE.MeshStandardMaterial({ color: '#9cc6e6', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false })));
  // Kanten oben und unten für einen klaren Grundriss-Eindruck
  const lp = [];
  for (const w of room.walls) for (const y of [F + 0.002, T]) lp.push(w.a[0], y, w.a[1], w.b[0], y, w.b[1]);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#3a4552' })));
  return onLayer(g);
}

/* ---------------- Grundriss (SVG, Maße in Metern) ---------------- */
export function floorPlanSVG(room, o = {}) {
  const c = Math.cos(room.theta), s = Math.sin(room.theta);
  // ins Wandsystem drehen, damit die Wände waagrecht/senkrecht liegen
  const P = (x, z) => [c * x + s * z, -s * x + c * z];
  const pts = room.poly.map(([x, z]) => P(x, z));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = 0.9, vb = [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const fmt = (v) => v.toFixed(2).replace('.', ',');
  const ink = o.ink || '#dfe6ee', dim = o.dim || '#8b98a6', acc = o.acc || '#5fd3ff';
  let body = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${o.fill || 'rgba(95,211,255,.07)'}" stroke="none"/>`;
  for (const w of room.walls) {
    const A = P(w.a[0], w.a[1]), B = P(w.b[0], w.b[1]);
    const dx = (B[0] - A[0]) / w.len, dy = (B[1] - A[1]) / w.len;
    const at = (t) => [A[0] + dx * t, A[1] + dy * t];
    // Wand in Stücken zwischen den Öffnungen
    const ops = [...w.openings].sort((p, q) => p.s0 - q.s0);
    let t = 0;
    for (const q of ops) {
      const a = at(t), b = at(q.s0);
      body += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ink}" stroke-width="0.1" stroke-linecap="square"/>`;
      const p0 = at(q.s0), p1 = at(q.s1);
      if (q.kind === 'tür') {
        // Türblatt mit Schwenkbogen nach innen (links der Laufrichtung)
        const nx = -dy, ny = dx, wdt = q.s1 - q.s0;
        const tip = [p0[0] + nx * wdt, p0[1] + ny * wdt];
        body += `<line x1="${p0[0]}" y1="${p0[1]}" x2="${tip[0]}" y2="${tip[1]}" stroke="${acc}" stroke-width="0.03"/>`;
        body += `<path d="M ${tip[0]} ${tip[1]} A ${wdt} ${wdt} 0 0 ${dx * ny - dy * nx > 0 ? 0 : 1} ${p1[0]} ${p1[1]}" fill="none" stroke="${acc}" stroke-width="0.015" stroke-dasharray="0.06 0.04"/>`;
      } else {
        const nx = -dy * 0.035, ny = dx * 0.035;
        for (const k of [-1, 1]) body += `<line x1="${p0[0] + nx * k}" y1="${p0[1] + ny * k}" x2="${p1[0] + nx * k}" y2="${p1[1] + ny * k}" stroke="${acc}" stroke-width="0.022"/>`;
        body += `<line x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}" stroke="${acc}" stroke-width="0.012"/>`;
      }
      t = q.s1;
    }
    const a = at(t), b = at(w.len);
    body += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ink}" stroke-width="0.1" stroke-linecap="square"/>`;
    // Maßkette außen
    const nx = dy, ny = -dx, off = 0.42;
    const q0 = [A[0] + nx * off, A[1] + ny * off], q1 = [B[0] + nx * off, B[1] + ny * off];
    body += `<line x1="${q0[0]}" y1="${q0[1]}" x2="${q1[0]}" y2="${q1[1]}" stroke="${dim}" stroke-width="0.012"/>`;
    for (const q of [q0, q1]) body += `<line x1="${q[0] - nx * 0.08}" y1="${q[1] - ny * 0.08}" x2="${q[0] + nx * 0.08}" y2="${q[1] + ny * 0.08}" stroke="${dim}" stroke-width="0.012"/>`;
    const mx = (q0[0] + q1[0]) / 2 + nx * 0.16, my = (q0[1] + q1[1]) / 2 + ny * 0.16;
    const rot = Math.abs(dx) > Math.abs(dy) ? 0 : 90;
    body += `<text x="${mx}" y="${my}" fill="${dim}" font-size="0.2" font-family="ui-monospace,monospace" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${mx} ${my})">${fmt(w.len)} m</text>`;
  }
  body += `<text x="${cx}" y="${cy - 0.12}" fill="${ink}" font-size="0.34" font-weight="600" font-family="system-ui,sans-serif" text-anchor="middle">${fmt(room.area)} m²</text>`;
  body += `<text x="${cx}" y="${cy + 0.28}" fill="${dim}" font-size="0.2" font-family="system-ui,sans-serif" text-anchor="middle">Höhe ${fmt(room.height)} m · ${fmt(room.volume)} m³</text>`;
  const bg = o.bg ? `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${o.bg}"/>` : '';
  const size = o.px ? ` width="${o.px}" height="${Math.round(o.px * vb[3] / vb[2])}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"${size}>${bg}${body}</svg>`;
}

// Grundriss + Wände als JSON (zum Weiterverarbeiten)
export function roomJSON(room) {
  return JSON.stringify({
    generator: 'ECHO LiDAR-Studio', units: 'm', floor: room.floor, ceiling: room.ceiling, height: room.height, area: room.area, perimeter: room.perimeter, volume: room.volume,
    polygon: room.poly, walls: room.walls.map((w) => ({ start: w.a, end: w.b, length: w.len, openings: w.openings.map((q) => ({ type: q.kind === 'tür' ? 'door' : 'window', from: q.s0, to: q.s1, bottom: q.y0 - room.floor, top: q.y1 - room.floor })) })),
  }, null, 2);
}

// Raummodell als Netz (für OBJ/STL): alle Dreiecke der Gruppe in Weltkoordinaten
export function groupMeshData(g) {
  const pos = [], idx = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry, P = geo.attributes.position, base = pos.length / 3, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos.push(v.x, v.y, v.z); }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(base + geo.index.getX(i));
    else for (let i = 0; i < P.count; i++) idx.push(base + i);
  });
  return { pos: new Float32Array(pos), index: new Uint32Array(idx) };
}
