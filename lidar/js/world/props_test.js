// Prüf- und Messobjekte: SDF-Skulpturen, Vase, Motorblock, Stufen-Prüfkörper, Stangenwald, Kantenprüfung
import * as THREE from 'three';
import { lm, lmTint } from './lidarmat.js';
import { G, mesh, pipe, fbm } from './geo.js';

/* ---------------- Distanzfeld → Netz (Surface Nets auf dichtem Raster) ---------------- */

export function sdfMesh(f, min, max, res) {
  const nx = Math.ceil((max[0] - min[0]) / res) + 1, ny = Math.ceil((max[1] - min[1]) / res) + 1, nz = Math.ceil((max[2] - min[2]) / res) + 1;
  const V = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[(k * ny + j) * nx + i] = f(min[0] + i * res, min[1] + j * res, min[2] + k * res);
  const at = (i, j, k) => V[(k * ny + j) * nx + i];
  const vid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [];
    for (let q = 0; q < 8; q++) c.push(at(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1)));
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((c[a] < 0) === (c[b] < 0)) continue;
      const t = c[a] / (c[a] - c[b]);
      sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t; n++;
    }
    if (!n) continue;
    vid[(k * (ny - 1) + j) * (nx - 1) + i] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * res, min[1] + (j + sy / n) * res, min[2] + (k + sz / n) * res);
  }
  const idx = [];
  const cv = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1 ? -1 : vid[(k * (ny - 1) + j) * (nx - 1) + i]);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const d0 = at(i, j, k);
    for (let ax = 0; ax < 3; ax++) {
      if ((ax === 0 && i === nx - 1) || (ax === 1 && j === ny - 1) || (ax === 2 && k === nz - 1)) continue;
      const d1 = at(i + (ax === 0), j + (ax === 1), k + (ax === 2));
      if ((d0 < 0) === (d1 < 0)) continue;
      const q = ax === 0 ? [[i, j - 1, k - 1], [i, j, k - 1], [i, j, k], [i, j - 1, k]] : ax === 1 ? [[i - 1, j, k - 1], [i - 1, j, k], [i, j, k], [i, j, k - 1]] : [[i - 1, j - 1, k], [i, j - 1, k], [i, j, k], [i - 1, j, k]];
      const v = q.map(([a, b, c]) => cv(a, b, c));
      if (v.some((x) => x < 0)) continue;
      if (d0 < 0) idx.push(v[0], v[1], v[2], v[0], v[2], v[3]); else idx.push(v[0], v[2], v[1], v[0], v[3], v[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => { const k0 = Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz), k1 = Math.hypot((x - cx) / (rx * rx), (y - cy) / (ry * ry), (z - cz) / (rz * rz)); return k0 * (k0 - 1) / (k1 || 1e-9); };
const cap = (x, y, z, ax, ay, az, bx, by, bz, r) => { const px = x - ax, py = y - ay, pz = z - az, bxa = bx - ax, bya = by - ay, bza = bz - az; const h = Math.max(0, Math.min(1, (px * bxa + py * bya + pz * bza) / (bxa * bxa + bya * bya + bza * bza))); return Math.hypot(px - bxa * h, py - bya * h, pz - bza * h) - r; };

// Büste auf Sockel (Kopf, Hals, Schultern, Brust), ca. 0,62 m hoch
export function bust(res = 0.006) {
  const g = new THREE.Group();
  const f = (x, y, z) => {
    let d = ell(x, y, z, 0, 0.47, 0.0, 0.085, 0.112, 0.1);                       // Kopf
    d = smin(d, ell(x, y, z, 0, 0.405, 0.06, 0.05, 0.05, 0.05), 0.04);            // Kinn
    d = smin(d, ell(x, y, z, 0, 0.47, 0.085, 0.02, 0.035, 0.03), 0.02);           // Nase
    for (const s of [-1, 1]) d = smin(d, ell(x, y, z, s * 0.085, 0.47, -0.005, 0.016, 0.03, 0.02), 0.015); // Ohren
    d = smin(d, cap(x, y, z, 0, 0.3, 0, 0, 0.42, 0.01, 0.045), 0.04);             // Hals
    d = smin(d, ell(x, y, z, 0, 0.2, 0, 0.2, 0.1, 0.11), 0.07);                   // Schultern/Brust
    d = smin(d, ell(x, y, z, 0, 0.13, 0.02, 0.16, 0.12, 0.1), 0.06);
    d = Math.max(d, 0.06 - y);                                                    // unten gerade abschneiden
    d += fbm(x * 40, y * 40, z * 40, 2) * 0.0015;                                 // Steinstruktur
    return d;
  };
  const geo = sdfMesh(f, [-0.24, 0.05, -0.15], [0.24, 0.6, 0.2], res);
  g.add(mesh(geo, lmTint('kugel_matt', '#e9e4da'), 0, 0.9, 0));
  // Sockel
  g.add(mesh(G.box(0.36, 0.9, 0.36), lm('holz_dunkel'), 0, 0.45, 0));
  g.add(mesh(G.box(0.4, 0.04, 0.4), lm('holz_dunkel'), 0, 0.92, 0));
  return g;
}

// Abstrakte Skulptur (verdrehter Torus mit Kugeln)
export function sculpture(res = 0.008) {
  const g = new THREE.Group();
  const f = (x, y, z) => {
    const yy = y - 0.35;
    const a = Math.atan2(z, x) * 1.5;
    const c = Math.cos(a), s = Math.sin(a);
    const r = Math.hypot(x, z) - 0.22;
    const qx = c * r - s * yy, qy = s * r + c * yy;
    let d = Math.hypot(qx * 1.7, qy) / 1.7 - 0.055;
    d = smin(d, Math.hypot(x, y - 0.35, z) - 0.09, 0.05);
    d = smin(d, cap(x, y, z, 0, 0.0, 0, 0, 0.3, 0, 0.03), 0.04);
    return d;
  };
  g.add(mesh(sdfMesh(f, [-0.33, 0.0, -0.33], [0.33, 0.65, 0.33], res), lm('alu_blech'), 0, 0.92, 0));
  g.add(mesh(G.cyl(0.18, 0.2, 0.9, 32), lm('beton_hell'), 0, 0.45, 0));
  return g;
}

export function vase() {
  const g = new THREE.Group();
  const prof = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40, y = t * 0.42; const r = 0.06 + 0.075 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + (t > 0.85 ? (t - 0.85) * 0.25 : 0); prof.push([Math.max(0.02, r), y]); }
  prof.unshift([0, 0]);
  prof.push([0.05, 0.42], [0.048, 0.39]);
  g.add(mesh(G.lathe(prof, 48), lmTint('fliese', '#2b5d8a'), 0, 0.92, 0));
  g.add(mesh(G.cyl(0.2, 0.2, 0.9, 32), lm('beton_hell'), 0, 0.45, 0));
  return g;
}

// Vierzylinder-Motorblock mit Zylinderkopf, Ventildeckel, Riementrieb, Krümmer, Ölfilter
export function engine() {
  const g = new THREE.Group();
  const cast = lm('stahl_grau'), alu = lm('lack_silber');
  const e = new THREE.Group(); e.position.y = 0.9; g.add(e);
  e.add(mesh(G.box(0.55, 0.3, 0.32), cast, 0, 0.15, 0));
  e.add(mesh(G.box(0.6, 0.06, 0.38), lm('ral9005'), 0, -0.02, 0)); // Ölwanne
  for (let k = 0; k < 6; k++) e.add(mesh(G.box(0.012, 0.22, 0.34), cast, -0.25 + k * 0.1, 0.13, 0)); // Rippen
  e.add(mesh(G.box(0.56, 0.12, 0.3), alu, 0, 0.36, 0));
  const vc = mesh(G.rbox(0.52, 0.07, 0.22, 0.02), lm('lack_rot'), 0, 0.455, 0); e.add(vc);
  for (let k = 0; k < 4; k++) e.add(mesh(G.cyl(0.018, 0.018, 0.05, 12), lm('kunststoff_schwarz'), -0.18 + k * 0.12, 0.5, 0));
  // Riementrieb vorn (x = +0.29)
  for (const [y, z, r] of [[0.05, 0, 0.085], [0.36, -0.06, 0.06], [0.36, 0.06, 0.06], [0.2, 0.15, 0.045]]) e.add(mesh(G.cyl(r, r, 0.03, 32), lm('edelstahl'), 0.3, y, z, 0, 0, Math.PI / 2));
  e.add(mesh(pipe([[0.32, 0.05, -0.085], [0.32, 0.36, -0.12], [0.32, 0.42, 0], [0.32, 0.36, 0.12], [0.32, 0.2, 0.195], [0.32, 0.05, 0.085]], 0.006, 40, 6), lm('gummi')));
  // Abgaskrümmer (Seite −z)
  for (let k = 0; k < 4; k++) e.add(mesh(pipe([[-0.18 + k * 0.12, 0.36, -0.15], [-0.18 + k * 0.12, 0.33, -0.22], [-0.06 + k * 0.03, 0.2, -0.26]], 0.022, 12, 10), lm('edelstahl')));
  e.add(mesh(G.cyl(0.035, 0.035, 0.12, 16), lm('edelstahl'), 0.02, 0.12, -0.27));
  // Ansaugbrücke (Seite +z)
  e.add(mesh(G.rbox(0.5, 0.09, 0.1, 0.03), lm('kunststoff_schwarz'), 0, 0.37, 0.2));
  for (let k = 0; k < 4; k++) e.add(mesh(G.cyl(0.025, 0.025, 0.08, 12), lm('kunststoff_schwarz'), -0.18 + k * 0.12, 0.33, 0.17, Math.PI / 2, 0, 0));
  e.add(mesh(G.cyl(0.04, 0.04, 0.1, 20), lmTint('lack_blau', '#1f4f8f'), -0.12, 0.08, 0.2, Math.PI / 2, 0, 0)); // Ölfilter
  // Sockel
  g.add(mesh(G.box(0.7, 0.86, 0.5), lm('ral7035'), 0, 0.43, 0));
  return g;
}

// Stufen-Prüfkörper (Aluminium) mit Bohrung und Kugelkalotte – bekannte Maße für Soll-Ist
export function stepArtifact() {
  const g = new THREE.Group();
  const al = lm('alu_blech');
  const a = new THREE.Group(); a.position.y = 0.9; g.add(a);
  const steps = [0.02, 0.04, 0.06, 0.08, 0.1];
  steps.forEach((h, i) => a.add(mesh(G.box(0.06, h, 0.24), lmTint('ral7035', '#cfd2d4'), -0.15 + i * 0.06, h / 2, 0)));
  a.add(mesh(G.cyl(0.04, 0.04, 0.12, 40), lmTint('ral7035', '#cfd2d4'), 0.22, 0.06, -0.06));
  a.add(mesh(new THREE.SphereGeometry(0.05, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), lmTint('ral7035', '#cfd2d4'), 0.22, 0, 0.07));
  a.add(mesh(G.box(0.62, 0.012, 0.32), al, 0.03, -0.006, 0));
  g.add(mesh(G.box(0.7, 0.88, 0.45), lm('ral7035'), 0, 0.44, 0));
  return g;
}

// Stangenwald: Stäbe Ø 2, 5, 10, 20, 50 mm vor einer Wand – Auflösungsgrenze sichtbar machen
export function rodForest() {
  const g = new THREE.Group();
  const d = [0.002, 0.005, 0.01, 0.02, 0.05];
  d.forEach((dm, i) => g.add(mesh(G.cyl(dm / 2, dm / 2, 1.6, 16), lm('kal90'), -0.6 + i * 0.3, 0.8, 0)));
  g.add(mesh(G.box(1.6, 0.04, 0.3), lm('stahl_grau'), 0, 0.02, 0));
  g.add(mesh(G.box(1.8, 1.8, 0.05), lm('kal50'), 0, 0.9, -0.6));
  return g;
}

// Kantenprüfung: Platte 40 cm vor Wand (Mischpixel, Kometenschweife)
export function edgeTest() {
  const g = new THREE.Group();
  g.add(mesh(G.box(1.0, 1.2, 0.03), lm('kal90'), -0.3, 0.6, 0));
  g.add(mesh(G.box(2.0, 1.8, 0.05), lm('kal50'), 0, 0.9, -0.4));
  return g;
}

// Glasscheibe im Rahmen mit Zieltafel dahinter
export function glassPane() {
  const g = new THREE.Group();
  g.add(mesh(G.box(1.4, 1.6, 0.01), lm('glas'), 0, 1.0, 0));
  for (const x of [-0.72, 0.72]) g.add(mesh(G.box(0.05, 1.8, 0.05), lm('alu_blech'), x, 0.9, 0));
  g.add(mesh(G.box(1.5, 0.05, 0.05), lm('alu_blech'), 0, 1.82, 0));
  g.add(mesh(G.box(1.5, 0.05, 0.05), lm('alu_blech'), 0, 0.18, 0));
  return g;
}

export function retroPanel() {
  const g = new THREE.Group();
  g.add(mesh(G.box(0.6, 0.6, 0.01), lm('retro_weiss'), 0, 1.2, 0));
  g.add(mesh(G.cyl(0.025, 0.025, 1.0, 10), lm('stahl_verzinkt'), 0, 0.5, -0.02));
  return g;
}


