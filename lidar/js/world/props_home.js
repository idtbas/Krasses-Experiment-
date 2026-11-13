// Wohnungsmöbel: Maße wie im Möbelhaus. Ursprung Bodenmitte.
import * as THREE from 'three';
import { lm, lmTint } from './lidarmat.js';
import { G, mesh, rod, pipe, bake } from './geo.js';

export function sofa(w = 2.2) {
  const g = new THREE.Group();
  const t = lmTint('textil', '#5c636c');
  g.add(mesh(G.rbox(w, 0.22, 0.95, 0.04), t, 0, 0.25, 0));
  for (let k = 0; k < 3; k++) g.add(mesh(G.rbox(w / 3 - 0.02, 0.16, 0.72, 0.06), t, -w / 3 + k * w / 3, 0.44, 0.08));
  g.add(mesh(G.rbox(w, 0.55, 0.22, 0.06), t, 0, 0.6, -0.37));
  for (let k = 0; k < 3; k++) g.add(mesh(G.rbox(w / 3 - 0.03, 0.42, 0.16, 0.07), t, -w / 3 + k * w / 3, 0.72, -0.22));
  for (const sx of [-1, 1]) g.add(mesh(G.rbox(0.2, 0.62, 0.95, 0.07), t, sx * (w / 2 - 0.1), 0.42, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.cyl(0.02, 0.015, 0.14, 10), lm('holz_dunkel'), sx * (w / 2 - 0.1), 0.07, sz * 0.38));
  g.add(mesh(G.rbox(0.42, 0.38, 0.14, 0.06), lmTint('textil', '#b88a4a'), w / 2 - 0.42, 0.66, -0.12)).rotation.z = 0.15;
  return bake(g);
}

export function armchair() {
  const g = new THREE.Group();
  const t = lm('leder');
  g.add(mesh(G.rbox(0.8, 0.2, 0.8, 0.05), t, 0, 0.32, 0));
  g.add(mesh(G.rbox(0.8, 0.6, 0.18, 0.06), t, 0, 0.7, -0.32)).rotation.x = -0.15;
  for (const sx of [-1, 1]) g.add(mesh(G.rbox(0.14, 0.32, 0.75, 0.05), t, sx * 0.36, 0.5, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(rod([sx * 0.33, 0, sz * 0.33], [sx * 0.3, 0.22, sz * 0.3], 0.015, lm('edelstahl'), 8));
  return bake(g);
}

// Couchtisch mit Glasplatte und Edelstahlgestell
export function glassTable() {
  const g = new THREE.Group();
  g.add(mesh(G.box(1.2, 0.012, 0.6), lm('glas'), 0, 0.42, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.box(0.025, 0.42, 0.025), lm('edelstahl'), sx * 0.56, 0.21, sz * 0.26));
  g.add(mesh(G.box(1.1, 0.012, 0.5), lm('holz_dunkel'), 0, 0.12, 0));
  g.add(mesh(G.rbox(0.25, 0.04, 0.18, 0.01), lmTint('karton', '#c43a2a'), -0.2, 0.448, 0.05));
  g.add(mesh(G.lathe([[0, 0], [0.05, 0], [0.055, 0.1], [0.045, 0.11], [0, 0.11]], 20), lm('kunststoff_weiss'), 0.3, 0.426, -0.05));
  return g;
}

// Fernseher (schwarzer Hochglanz: für LiDAR fast unsichtbar) auf Lowboard
export function tvSideboard() {
  const g = new THREE.Group();
  g.add(mesh(G.box(1.8, 0.45, 0.42), lm('kunststoff_weiss'), 0, 0.3, 0));
  for (const x of [-0.6, 0, 0.6]) g.add(mesh(G.box(0.58, 0.005, 0.002), lm('kunststoff_grau'), x, 0.3, 0.211));
  for (const x of [-0.8, 0.8]) g.add(mesh(G.box(0.04, 0.08, 0.3), lm('edelstahl'), x, 0.04, 0));
  const tv = new THREE.Group(); tv.position.set(0, 0.55, 0); g.add(tv);
  tv.add(mesh(G.box(0.3, 0.02, 0.2), lm('kunststoff_schwarz'), 0, 0.01, 0));
  tv.add(mesh(G.box(0.06, 0.14, 0.04), lm('kunststoff_schwarz'), 0, 0.08, 0));
  tv.add(mesh(G.box(1.45, 0.84, 0.03), lm('kunststoff_schwarz'), 0, 0.56, 0));
  tv.add(mesh(G.box(1.42, 0.81, 0.004), lm('bildschirm'), 0, 0.56, 0.017));
  return g;
}

// Bücherregal mit einzelnen Büchern (Höhen und Farben variieren)
export function bookshelf(w = 1.6, h = 2.0, seed = 5) {
  const g = new THREE.Group();
  const wood = lm('holz_hell');
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (const x of [-w / 2, w / 2]) g.add(mesh(G.box(0.02, h, 0.32), wood, x, h / 2, 0));
  g.add(mesh(G.box(w, h, 0.01), wood, 0, h / 2, -0.155));
  const shelves = 5;
  const colors = ['#7a2a24', '#2a4a6b', '#d9cdb5', '#2e5b3a', '#1c1c1e', '#c9a227', '#8c4b8c', '#e8e6e1', '#6b6f75'];
  for (let k = 0; k <= shelves; k++) {
    const y = 0.04 + k * (h - 0.06) / shelves;
    g.add(mesh(G.box(w - 0.02, 0.02, 0.31), wood, 0, y, 0));
    if (k === shelves) break;
    let x = -w / 2 + 0.03;
    while (x < w / 2 - 0.08) {
      if (r() < 0.08) { x += 0.12; continue; }
      const bw = 0.02 + r() * 0.035, bh = 0.18 + r() * 0.12, bd = 0.17 + r() * 0.07;
      const book = mesh(G.box(bw, bh, bd), lmTint('karton', colors[Math.floor(r() * colors.length)]), x + bw / 2, y + 0.01 + bh / 2, 0.14 - bd / 2);
      if (r() < 0.05) book.rotation.z = 0.25;
      g.add(book);
      x += bw + 0.002;
    }
  }
  return bake(g);
}

export function diningTable() {
  const g = new THREE.Group();
  g.add(mesh(G.rbox(1.6, 0.035, 0.9, 0.01), lm('holz_hell'), 0, 0.75, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.box(0.05, 0.73, 0.05), lm('holz_hell'), sx * 0.72, 0.365, sz * 0.38));
  return bake(g);
}

// Stuhl mit dünnen Stahlrohrbeinen (Ø 16 mm)
export function chair() {
  const g = new THREE.Group();
  const st = lm('ral9005');
  g.add(mesh(G.rbox(0.44, 0.04, 0.44, 0.015), lm('holz_dunkel'), 0, 0.46, 0));
  g.add(mesh(G.rbox(0.42, 0.24, 0.02, 0.01), lm('holz_dunkel'), 0, 0.78, -0.2)).rotation.x = -0.1;
  for (const sx of [-1, 1]) {
    g.add(rod([sx * 0.19, 0, 0.19], [sx * 0.19, 0.45, 0.19], 0.008, st, 8));
    g.add(rod([sx * 0.19, 0, -0.19], [sx * 0.19, 0.9, -0.21], 0.008, st, 8));
  }
  return g;
}

export function floorLamp() {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.15, 0.15, 0.02, 24), lm('edelstahl'), 0, 0.01, 0));
  g.add(mesh(G.cyl(0.012, 0.012, 1.55, 10), lm('edelstahl'), 0, 0.78, 0));
  g.add(mesh(G.cyl(0.14, 0.22, 0.28, 28, true), lmTint('textil', '#e9e2d0'), 0, 1.6, 0));
  return g;
}

// Zimmerpflanze: Topf, Erde, Blätter
export function plant(seed = 4) {
  const g = new THREE.Group();
  g.add(mesh(G.lathe([[0, 0], [0.13, 0], [0.17, 0.32], [0.16, 0.33], [0, 0.33]], 24), lmTint('kunststoff_weiss', '#c8c2b6'), 0, 0, 0));
  g.add(mesh(G.cyl(0.155, 0.155, 0.01, 20), lm('erde'), 0, 0.3, 0));
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const leaf = new THREE.PlaneGeometry(0.09, 0.32, 1, 4);
  const p = leaf.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.16; p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, y / 0.32))); p.setZ(i, -y * y * 0.8); p.setY(i, y); }
  leaf.computeVertexNormals();
  for (let k = 0; k < 22; k++) {
    const st = mesh(G.cyl(0.004, 0.005, 0.5, 5), lm('laub'), 0, 0.55, 0);
    const a = r() * Math.PI * 2, tilt = 0.2 + r() * 0.6;
    const stem = new THREE.Group(); stem.position.set(0, 0.3, 0); stem.rotation.set(Math.cos(a) * tilt, a, Math.sin(a) * tilt); g.add(stem);
    st.position.set(0, 0.25, 0); stem.add(st);
    const L = mesh(leaf, lm('laub'), 0, 0.48, 0); L.rotation.set(-0.6, 0, 0); stem.add(L);
  }
  return g;
}

export function rug() {
  const g = new THREE.Group();
  g.add(mesh(G.box(2.4, 0.012, 1.7), lmTint('teppich', '#7a6a5a'), 0, 0.006, 0));
  return g;
}

// Plattenheizkörper mit Rippen
export function radiator(w = 1.2) {
  const g = new THREE.Group();
  for (let x = -w / 2 + 0.025; x < w / 2; x += 0.05) g.add(mesh(G.box(0.035, 0.55, 0.06), lm('kunststoff_weiss'), x, 0.42, 0));
  g.add(mesh(G.box(w, 0.04, 0.07), lm('kunststoff_weiss'), 0, 0.71, 0));
  g.add(mesh(pipe([[w / 2 - 0.05, 0.15, 0], [w / 2 - 0.05, 0.02, 0.02], [w / 2 - 0.05, 0.0, 0.08]], 0.008, 6, 6), lm('edelstahl')));
  return bake(g);
}

// Kleiderschrank mit Spiegeltür
export function wardrobe() {
  const g = new THREE.Group();
  g.add(mesh(G.box(1.5, 2.2, 0.6), lm('kunststoff_weiss'), 0, 1.1, 0));
  g.add(mesh(G.box(0.7, 2.05, 0.01), lm('spiegel'), 0.37, 1.12, 0.305));
  g.add(mesh(G.box(0.005, 2.1, 0.004), lm('kunststoff_grau'), 0, 1.1, 0.302));
  g.add(mesh(G.box(0.02, 0.25, 0.02), lm('edelstahl'), -0.06, 1.1, 0.32));
  return g;
}

export function pictureFrame(w = 0.7, h = 0.5) {
  const g = new THREE.Group();
  g.add(mesh(G.box(w, h, 0.025), lm('holz_dunkel'), 0, 0, 0));
  g.add(mesh(G.box(w - 0.08, h - 0.08, 0.004), lmTint('karton', '#4c7a9e'), 0, 0, 0.013));
  g.add(mesh(G.box(w - 0.06, h - 0.06, 0.003), lm('glas'), 0, 0, 0.017));
  return g;
}

export function ceilingLamp() {
  const g = new THREE.Group();
  g.add(rod([0, 0, 0], [0, -0.6, 0], 0.003, lm('kabel'), 4));
  g.add(mesh(G.lathe([[0.02, 0], [0.18, -0.16], [0.19, -0.17], [0.03, -0.01]], 28), lm('kunststoff_weiss'), 0, -0.6, 0));
  return g;
}
