// 3D-Modelle der Scanner in echten Abmessungen (Meter), Ursprung unten mittig (Montagefläche).
// Jedes Modell liefert: group, sensor (optischer Mittelpunkt, +Z vorn, +Y Drehachse), rotor (drehendes Teil),
// mirror (TLS-Spiegel), height. Die Gehäuse sind für die eigenen Strahlen unsichtbar (userData.noLidar).
import * as THREE from 'three';
import { Geo, Mat, mesh, labelTexture } from '../../../kinetik/js/render/materials.js';

const M = {
  body: (c) => Mat.plain(c, 0.45, 0.55),
  paint: (c) => Mat.paint(c),
  window: () => Mat.visor(),
  lens: () => Mat.lens(),
  rubber: () => Mat.rubber(),
  dark: () => Mat.anodized(),
  steel: () => Mat.steel(),
  glow: (c) => Mat.glow(c, 1.6),
};

function ribs(r, h, n, depth, mat) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * (h / n);
    g.add(mesh(Geo.cyl(r + depth, r + depth, (h / n) * 0.45, 48), mat, 0, y, 0));
  }
  g.add(mesh(Geo.cyl(r, r, h, 48), mat, 0, h / 2, 0));
  return g;
}

function label(text, w, h, opts = {}) {
  const m = new THREE.Mesh(Geo.plane(w, h), new THREE.MeshStandardMaterial({ map: labelTexture(text, { w: 256, h: 64, bg: opts.bg || '#1a1c1f', color: opts.color || '#d9dde2', size: opts.size || 30 }), roughness: 0.6 }));
  return m;
}

function cable(group, pts, r = 0.0035) {
  group.add(mesh(Geo.tube(pts, r, 24), Mat.cable()));
}

// Velodyne-artiger „Puck“: gerippte Kappen, dunkles Fensterband
function puck(b) {
  const g = new THREE.Group(), d = b.d, h = b.h, r = d / 2;
  const body = M.body(b.color);
  const capH = h * 0.27, winH = h * 0.46;
  g.add(ribs(r * 0.96, capH, 4, r * 0.04, body));
  const win = mesh(Geo.cyl(r * 0.985, r * 0.985, winH, 64), M.window(), 0, capH + winH / 2, 0);
  g.add(win);
  const top = ribs(r * 0.96, capH, 4, r * 0.04, body); top.position.y = capH + winH; g.add(top);
  g.add(mesh(Geo.cyl(r * 0.6, r * 0.62, 0.003, 48), M.dark(), 0, h + 0.0015, 0));
  cable(g, [[0, 0.012, -r * 0.95], [0, 0.01, -r - 0.02], [0, 0.004, -r - 0.08]]);
  const lbl = label(b.model || '', r * 0.9, r * 0.22, {}); lbl.position.set(0, capH * 0.5, r * 1.001 + r * 0.04); g.add(lbl);
  const rotor = new THREE.Group(); rotor.position.y = capH + winH / 2; g.add(rotor);
  // innen: zwei Linsenblöcke (durch das Fenster schwach sichtbar)
  rotor.add(mesh(Geo.box(r * 0.5, winH * 0.7, r * 0.3, 0.002), M.lens(), 0, 0, r * 0.55));
  return { g, sensorY: capH + winH / 2, rotor, height: h };
}

function can(b) {
  const g = new THREE.Group(), d = b.d, h = b.h, r = d / 2;
  const body = M.body(b.color);
  g.add(mesh(Geo.cyl(r, r * 1.05, h * 0.18, 48), body, 0, h * 0.09, 0));
  g.add(mesh(Geo.cyl(r * 0.99, r * 0.99, h * 0.62, 64), M.window(), 0, h * 0.18 + h * 0.31, 0));
  g.add(mesh(Geo.cyl(r * 1.0, r, h * 0.2, 48), body, 0, h * 0.9, 0));
  g.add(mesh(Geo.cyl(r * 0.7, r * 0.75, 0.004, 48), M.dark(), 0, h + 0.002, 0));
  cable(g, [[0, 0.02, -r * 0.95], [0, 0.015, -r - 0.03], [0, 0.005, -r - 0.1]]);
  const rotor = new THREE.Group(); rotor.position.y = h * 0.5; g.add(rotor);
  rotor.add(mesh(Geo.box(r * 0.7, h * 0.4, r * 0.3, 0.003), M.lens(), 0, 0, r * 0.5));
  return { g, sensorY: h * 0.5, rotor, height: h };
}

// HDL-64: sichtbar drehender Kopf
function tower(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  const body = M.body(b.color);
  g.add(mesh(Geo.cyl(r * 0.92, r * 0.95, h * 0.16, 48), M.dark(), 0, h * 0.08, 0));
  const rotor = new THREE.Group(); rotor.position.y = h * 0.16; g.add(rotor);
  rotor.add(mesh(Geo.cyl(r, r, h * 0.72, 64), body, 0, h * 0.36, 0));
  // zwei Fensterfelder (oberer und unterer Laserblock) und Linsen
  const win = mesh(Geo.box(r * 1.3, h * 0.52, 0.01, 0.004), M.window(), 0, h * 0.36, r * 0.96);
  rotor.add(win);
  for (const [y, s] of [[h * 0.5, 1], [h * 0.24, 1]]) for (const x of [-r * 0.33, r * 0.33]) rotor.add(mesh(Geo.cyl(r * 0.2, r * 0.2, 0.012, 32), M.lens(), x, y, r * 0.99).rotateX(Math.PI / 2));
  rotor.add(mesh(Geo.cyl(r * 0.95, r, h * 0.12, 48), body, 0, h * 0.78, 0));
  return { g, sensorY: h * 0.5, rotor, rotorSpins: true, height: h };
}

function ouster(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  const body = M.body(b.color);
  g.add(mesh(Geo.cyl(r, r, h * 0.24, 6 * 8), body, 0, h * 0.12, 0));
  g.add(mesh(Geo.cyl(r * 0.995, r * 0.995, h * 0.38, 64), M.window(), 0, h * 0.24 + h * 0.19, 0));
  // Kühlkörper oben: radiale Rippen
  const top = new THREE.Group(); top.position.y = h * 0.62; g.add(top);
  top.add(mesh(Geo.cyl(r * 0.9, r, h * 0.12, 48), body, 0, h * 0.06, 0));
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    const fin = mesh(Geo.box(0.003, h * 0.26, r * 0.55, 0.0008), body, Math.sin(a) * r * 0.62, h * 0.12 + h * 0.13, Math.cos(a) * r * 0.62);
    fin.rotation.y = a;
    top.add(fin);
  }
  top.add(mesh(Geo.cyl(r * 0.36, r * 0.36, h * 0.26, 32), body, 0, h * 0.12 + h * 0.13, 0));
  cable(g, [[0, 0.01, -r * 0.95], [0, 0.009, -r - 0.03], [0, 0.004, -r - 0.09]], 0.004);
  const rotor = new THREE.Group(); rotor.position.y = h * 0.43; g.add(rotor);
  rotor.add(mesh(Geo.box(r * 0.6, h * 0.25, r * 0.2, 0.002), M.lens(), 0, 0, r * 0.6));
  return { g, sensorY: h * 0.43, rotor, height: h };
}

function hesai(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  const body = M.body(b.color);
  g.add(mesh(Geo.lathe([[0, 0], [r * 0.98, 0], [r, 0.004], [r, h * 0.26], [0, h * 0.26]], 64), body));
  g.add(mesh(Geo.cyl(r * 0.99, r * 0.99, h * 0.42, 64), M.window(), 0, h * 0.26 + h * 0.21, 0));
  g.add(mesh(Geo.lathe([[0, h * 0.68], [r, h * 0.68], [r, h * 0.92], [r * 0.9, h], [0, h]], 64), body));
  cable(g, [[0, 0.012, -r * 0.95], [0, 0.01, -r - 0.03], [0, 0.004, -r - 0.09]]);
  const rotor = new THREE.Group(); rotor.position.y = h * 0.47; g.add(rotor);
  rotor.add(mesh(Geo.box(r * 0.5, h * 0.3, r * 0.2, 0.002), M.lens(), 0, 0, r * 0.62));
  return { g, sensorY: h * 0.47, rotor, height: h };
}

// kompakter Würfel mit Kuppelfenster (Mid-360, Unitree L1)
function dome(b) {
  const g = new THREE.Group(), s = b.d, h = b.h;
  const body = M.body(b.color);
  g.add(mesh(Geo.box(s, h * 0.55, s, s * 0.12), body, 0, h * 0.275, 0));
  g.add(mesh(Geo.sphere(s * 0.38, 40), M.window(), 0, h * 0.55, 0));
  g.add(mesh(Geo.cyl(s * 0.4, s * 0.42, 0.004, 40), M.dark(), 0, h * 0.55, 0));
  cable(g, [[0, 0.008, -s / 2], [0, 0.006, -s / 2 - 0.03], [0, 0.003, -s / 2 - 0.08]], 0.003);
  const rotor = new THREE.Group(); rotor.position.y = h * 0.62; g.add(rotor);
  return { g, sensorY: h * 0.62, rotor, height: h };
}

// Livox Mid-40/70/Avia: Kasten mit rundem Frontfenster und Seitenrippen
function livox(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  const body = M.body(b.color);
  g.add(mesh(Geo.box(w, h, d, 0.008), body, 0, h / 2, 0));
  for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) g.add(mesh(Geo.box(0.004, h * 0.8, d * 0.75, 0.001), body, sx * (w / 2 + 0.002), h / 2, -d * 0.05 + (k - 2.5) * 0.0001));
  const win = mesh(Geo.cyl(Math.min(w, h) * 0.36, Math.min(w, h) * 0.36, 0.006, 48), M.window(), 0, h / 2, d / 2 + 0.002); win.rotation.x = Math.PI / 2; g.add(win);
  g.add(mesh(Geo.torus(Math.min(w, h) * 0.37, 0.003, 48), M.dark(), 0, h / 2, d / 2 + 0.003));
  cable(g, [[0, h * 0.3, -d / 2], [0, h * 0.25, -d / 2 - 0.04], [0, 0.005, -d / 2 - 0.08]], 0.003);
  return { g, sensorY: h / 2, rotor: null, height: h };
}

// Automotive-Festkörper: flach mit rechteckigem Fenster
function auto(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  g.add(mesh(Geo.box(w, h, d, 0.008), M.body(b.color), 0, h / 2, 0));
  g.add(mesh(Geo.box(w * 0.86, h * 0.62, 0.006, 0.004), M.window(), 0, h / 2, d / 2 + 0.002));
  for (let k = -2; k <= 2; k++) g.add(mesh(Geo.box(w * 0.9, 0.003, d * 0.6, 0.001), M.dark(), 0, h + 0.0015, k * 0.012));
  return { g, sensorY: h / 2, rotor: null, height: h };
}

// RPLIDAR: Sockel mit sichtbar drehendem Turm
function rplidar(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  g.add(mesh(Geo.box(b.d * 1.25, h * 0.35, b.d * 0.95, 0.006), M.body(b.band), 0, h * 0.175, -r * 0.1));
  const rotor = new THREE.Group(); rotor.position.y = h * 0.35; g.add(rotor);
  rotor.add(mesh(Geo.cyl(r * 0.92, r * 0.95, h * 0.55, 48), M.body(b.color), 0, h * 0.275, 0));
  rotor.add(mesh(Geo.box(r * 0.7, h * 0.22, 0.004, 0.001), M.window(), 0, h * 0.3, r * 0.93));
  rotor.add(mesh(Geo.cyl(r * 0.08, r * 0.08, 0.004, 16), M.lens(), -r * 0.2, h * 0.3, r * 0.94).rotateX(Math.PI / 2));
  rotor.add(mesh(Geo.cyl(r * 0.08, r * 0.08, 0.004, 16), M.lens(), r * 0.2, h * 0.3, r * 0.94).rotateX(Math.PI / 2));
  return { g, sensorY: h * 0.35 + h * 0.3, rotor, rotorSpins: true, height: h };
}

// Hokuyo: quadratischer Sockel, runder Kopf mit Fensterband
function hokuyo(b) {
  const g = new THREE.Group(), w = b.w, h = b.h;
  const body = M.body(b.color);
  g.add(mesh(Geo.box(w, h * 0.55, w, 0.004), body, 0, h * 0.275, 0));
  g.add(mesh(Geo.cyl(w * 0.42, w * 0.44, h * 0.1, 40), body, 0, h * 0.6, 0));
  g.add(mesh(Geo.cyl(w * 0.41, w * 0.41, h * 0.22, 48), M.window(), 0, h * 0.76, 0));
  g.add(mesh(Geo.cyl(w * 0.42, w * 0.41, h * 0.12, 40), body, 0, h * 0.93, 0));
  g.add(mesh(Geo.sphere(0.0025, 8), M.glow('#25d366'), w * 0.3, h * 0.45, w / 2 + 0.001));
  cable(g, [[0, 0.01, -w / 2], [0, 0.008, -w / 2 - 0.03], [0, 0.003, -w / 2 - 0.07]], 0.0028);
  return { g, sensorY: h * 0.76, rotor: null, height: h };
}

// SICK TiM / microScan: Sockel mit Kuppelkopf
function tim(b) {
  const g = new THREE.Group(), w = b.w, h = b.h;
  g.add(mesh(Geo.box(w, h * 0.55, w, 0.006), M.paint(b.color), 0, h * 0.275, 0));
  g.add(mesh(Geo.cyl(w * 0.45, w * 0.47, h * 0.08, 40), M.dark(), 0, h * 0.59, 0));
  g.add(mesh(Geo.lathe([[w * 0.45, 0], [w * 0.46, h * 0.18], [w * 0.4, h * 0.3], [w * 0.2, h * 0.37], [0, h * 0.38]], 48), M.window(), 0, h * 0.62, 0));
  g.add(mesh(Geo.box(w * 0.5, h * 0.06, 0.003, 0.001), M.dark(), 0, h * 0.42, w / 2 + 0.001));
  for (const [x, c] of [[-0.012, '#25d366'], [0, '#f2b705'], [0.012, '#3a3f45']]) g.add(mesh(Geo.sphere(0.0022, 8), M.glow(c), x, h * 0.48, w / 2 + 0.002));
  return { g, sensorY: h * 0.71, rotor: null, height: h };
}

// SICK LMS: großer Kasten mit gewölbtem Frontfenster
function lms(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  const body = M.paint(b.color);
  g.add(mesh(Geo.box(w, h * 0.48, d, 0.01), body, 0, h * 0.24, 0));
  g.add(mesh(Geo.box(w, h * 0.16, d, 0.01), body, 0, h * 0.92, 0));
  const win = mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.48, h * 0.36, 48, 1, true, -Math.PI * 0.6, Math.PI * 1.2), M.window(), 0, h * 0.66, 0);
  g.add(win);
  g.add(mesh(Geo.cyl(w * 0.3, w * 0.3, h * 0.36, 32), M.dark(), 0, h * 0.66, -d * 0.1));
  g.add(mesh(Geo.box(0.012, h * 0.36, d * 0.45, 0.002), body, -w / 2 + 0.006, h * 0.66, -d * 0.28));
  g.add(mesh(Geo.box(0.012, h * 0.36, d * 0.45, 0.002), body, w / 2 - 0.006, h * 0.66, -d * 0.28));
  return { g, sensorY: h * 0.66, rotor: null, height: h };
}

// BLK360-artig: schlanker Zylinder, Kopf dreht sich, Spiegelfenster
function blk(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  g.add(mesh(Geo.cyl(r * 0.85, r * 0.9, h * 0.08, 48), M.dark(), 0, h * 0.04, 0));
  const rotor = new THREE.Group(); rotor.position.y = h * 0.08; g.add(rotor);
  const body = M.paint(b.color);
  rotor.add(mesh(Geo.lathe([[0, 0], [r, 0], [r, h * 0.36], [0, h * 0.36]], 64), body));
  rotor.add(mesh(Geo.lathe([[0, h * 0.62], [r, h * 0.62], [r, h * 0.86], [r * 0.85, h * 0.92], [0, h * 0.92]], 64), body));
  // Spiegeleinheit sichtbar durch zwei Fenster (vorn/hinten)
  rotor.add(mesh(Geo.cyl(r * 0.92, r * 0.92, h * 0.26, 64), M.dark(), 0, h * 0.49, 0));
  for (const z of [1, -1]) rotor.add(mesh(Geo.box(r * 0.9, h * 0.22, 0.004, 0.002), M.window(), 0, h * 0.49, z * r * 0.93));
  const mirror = new THREE.Group(); mirror.position.y = h * 0.49; rotor.add(mirror);
  mirror.add(mesh(Geo.box(r * 0.5, r * 0.04, r * 0.6, 0.001), M.steel(), 0, 0, 0).rotateX(Math.PI / 4));
  // Kameras rund um den unteren Rand
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; rotor.add(mesh(Geo.cyl(0.006, 0.006, 0.004, 16), M.lens(), Math.sin(a) * r * 0.99, h * 0.26, Math.cos(a) * r * 0.99).rotateX(Math.PI / 2).rotateZ(a)); }
  rotor.add(mesh(Geo.sphere(0.004, 10), M.glow('#25d366'), 0, h * 0.89, r * 0.4));
  return { g, sensorY: h * 0.57, rotor, mirror, mirrorAxis: 'x', height: h };
}

// RTC360 / X7 / Z+F: Körper mit Griff, Spiegel zwischen zwei Seitenteilen
function tlsbox(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  g.add(mesh(Geo.cyl(d * 0.35, d * 0.38, h * 0.07, 48), M.dark(), 0, h * 0.035, 0));
  const rotor = new THREE.Group(); rotor.position.y = h * 0.07; g.add(rotor);
  const body = M.paint(b.color), acc = M.paint(b.accent || '#c8102e');
  const sideW = w * 0.32;
  for (const sx of [-1, 1]) {
    rotor.add(mesh(Geo.box(sideW, h * 0.72, d, 0.018), body, sx * (w / 2 - sideW / 2), h * 0.36, 0));
    rotor.add(mesh(Geo.box(sideW * 0.9, h * 0.05, d * 0.92, 0.008), acc, sx * (w / 2 - sideW / 2), h * 0.05, 0));
    // Kameras
    rotor.add(mesh(Geo.cyl(0.008, 0.008, 0.005, 16), M.lens(), sx * (w / 2 - sideW / 2), h * 0.58, d / 2 + 0.002).rotateX(Math.PI / 2));
  }
  rotor.add(mesh(Geo.box(w, h * 0.1, d, 0.012), body, 0, h * 0.05, 0));
  // Griff
  rotor.add(mesh(Geo.box(w * 0.92, h * 0.05, d * 0.18, 0.012), M.dark(), 0, h * 0.86, 0));
  for (const sx of [-1, 1]) rotor.add(mesh(Geo.box(w * 0.1, h * 0.14, d * 0.18, 0.01), M.dark(), sx * w * 0.38, h * 0.77, 0));
  // Spiegel (Drehachse x)
  const mirror = new THREE.Group(); mirror.position.y = h * 0.42; rotor.add(mirror);
  mirror.add(mesh(Geo.cyl(d * 0.28, d * 0.28, w - sideW * 2 - 0.004, 48), M.dark(), 0, 0, 0).rotateZ(Math.PI / 2));
  mirror.add(mesh(Geo.box(w - sideW * 2 - 0.01, 0.004, d * 0.42, 0.001), M.steel(), 0, 0, 0).rotateX(Math.PI / 4));
  // Display
  rotor.add(mesh(Geo.box(sideW * 0.8, h * 0.22, 0.004, 0.003), Mat.glow('#16324a', 0.8), w / 2 - sideW / 2, h * 0.36, -d / 2 - 0.002));
  return { g, sensorY: h * 0.49, rotor, mirror, mirrorAxis: 'x', height: h };
}

// FARO Focus / Matterport: flach, Spiegel mittig
function tlsflat(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  g.add(mesh(Geo.cyl(w * 0.4, w * 0.42, h * 0.06, 40), M.dark(), 0, h * 0.03, 0));
  const rotor = new THREE.Group(); rotor.position.y = h * 0.06; g.add(rotor);
  const body = M.paint(b.color);
  for (const sz of [-1, 1]) rotor.add(mesh(Geo.box(w, h * 0.86, d * 0.32, 0.012), body, 0, h * 0.43, sz * (d / 2 - d * 0.16)));
  rotor.add(mesh(Geo.box(w, h * 0.12, d, 0.012), body, 0, h * 0.06, 0));
  const mirror = new THREE.Group(); mirror.position.y = h * 0.52; rotor.add(mirror);
  mirror.add(mesh(Geo.cyl(w * 0.36, w * 0.36, d * 0.36 - 0.004, 40), M.dark(), 0, 0, 0).rotateX(Math.PI / 2));
  mirror.add(mesh(Geo.box(w * 0.5, 0.004, d * 0.3, 0.001), M.steel(), 0, 0, 0).rotateZ(Math.PI / 4));
  rotor.add(mesh(Geo.box(w * 0.85, h * 0.28, 0.003, 0.002), Mat.glow('#16324a', 0.8), 0, h * 0.4, -d / 2 - 0.002));
  rotor.add(mesh(Geo.box(w * 0.1, h * 0.06, 0.004, 0.002), Mat.paint(b.accent || '#1d6fd1'), 0, h * 0.86, d / 2 + 0.002));
  return { g, sensorY: h * 0.58, rotor, mirror, mirrorAxis: 'z', height: h };
}

// RIEGL: zylindrischer Körper, Kopf mit großem Fenster
function riegl(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  const body = M.paint(b.color);
  g.add(mesh(Geo.cyl(r, r, h * 0.45, 64), body, 0, h * 0.225, 0));
  g.add(mesh(Geo.cyl(r * 1.01, r * 1.01, h * 0.04, 64), M.paint(b.accent || '#1c3f8a'), 0, h * 0.44, 0));
  const rotor = new THREE.Group(); rotor.position.y = h * 0.46; g.add(rotor);
  rotor.add(mesh(Geo.box(r * 1.7, h * 0.42, r * 1.3, 0.02), body, 0, h * 0.21, 0));
  rotor.add(mesh(Geo.box(r * 0.9, h * 0.3, 0.006, 0.004), M.window(), 0, h * 0.22, r * 0.66));
  rotor.add(mesh(Geo.box(r * 1.5, h * 0.06, r * 0.4, 0.012), M.dark(), 0, h * 0.46, 0));
  const mirror = new THREE.Group(); mirror.position.y = h * 0.22; rotor.add(mirror);
  return { g, sensorY: h * 0.68, rotor, mirror, height: h };
}

// ZEB Horizon: Handgriff, drehender Kopf mit Puck
function zeb(b) {
  const g = new THREE.Group();
  g.add(mesh(Geo.cyl(0.02, 0.022, 0.2, 24), M.rubber(), 0, 0.1, 0));
  g.add(mesh(Geo.box(0.07, 0.05, 0.12, 0.01), M.dark(), 0, 0.225, 0));
  const rotor = new THREE.Group(); rotor.position.set(0, 0.25, 0.04); g.add(rotor);
  const p = puck({ ...b, model: '' });
  p.g.rotation.x = Math.PI / 2;
  p.g.position.set(0, 0.04, 0.0);
  rotor.add(p.g);
  return { g, sensorY: 0.29, sensorZ: 0.04, rotor: null, headRotor: rotor, height: 0.34 };
}

function stick(b) {
  const g = new THREE.Group(), r = b.d / 2, h = b.h;
  g.add(mesh(Geo.cyl(r * 0.45, r * 0.5, h * 0.55, 32), M.rubber(), 0, h * 0.275, 0));
  g.add(mesh(Geo.cyl(r * 0.9, r * 0.6, h * 0.12, 40), M.paint(b.color), 0, h * 0.61, 0));
  g.add(mesh(Geo.sphere(r * 0.95, 40), M.window(), 0, h * 0.8, 0));
  g.add(mesh(Geo.cyl(r, r, h * 0.05, 40), M.paint(b.color), 0, h * 0.68, 0));
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add(mesh(Geo.cyl(0.007, 0.007, 0.004, 16), M.lens(), Math.sin(a) * r, h * 0.64, Math.cos(a) * r).rotateX(Math.PI / 2).rotateZ(a)); }
  return { g, sensorY: h * 0.8, rotor: null, height: h };
}

function phone(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  // Telefon steht hochkant, Rückseite (Kameras) zeigt nach +Z
  g.add(mesh(Geo.box(w, h, d, 0.009), M.body(b.color), 0, h / 2, 0));
  g.add(mesh(Geo.box(w * 0.96, h * 0.97, 0.001, 0.008), Mat.glow('#0c1622', 0.5), 0, h / 2, -d / 2 - 0.0005));
  const bump = new THREE.Group(); bump.position.set(-w * 0.22, h * 0.86, d / 2); g.add(bump);
  bump.add(mesh(Geo.box(w * 0.46, w * 0.46, 0.003, 0.008), M.body(b.color), 0, 0, 0.0015));
  for (const [x, y] of [[-0.009, 0.009], [-0.009, -0.009], [0.009, 0]]) bump.add(mesh(Geo.cyl(0.0068, 0.0068, 0.0035, 24), M.lens(), x, y, 0.003).rotateX(Math.PI / 2));
  bump.add(mesh(Geo.cyl(0.0028, 0.0028, 0.003, 16), M.window(), 0.009, 0.0105, 0.003).rotateX(Math.PI / 2));
  bump.add(mesh(Geo.cyl(0.002, 0.002, 0.003, 12), Mat.glow('#fff4d6', 0.6), 0.009, -0.0105, 0.003).rotateX(Math.PI / 2));
  // Bildsensor und Tiefenbild liegen längs der Telefonlängsachse (Querformat = Breitbild)
  return { g, sensorY: h * 0.86 + 0.0105, sensorX: -w * 0.22 + 0.009, sensorZ: d / 2 + 0.004, sensorRoll: Math.PI / 2, rotor: null, height: h };
}

function l515(b) {
  const g = new THREE.Group(), r = b.d / 2, t = b.h;
  const body = new THREE.Group(); body.position.y = r; g.add(body);
  body.add(mesh(Geo.cyl(r, r, t, 48), M.body(b.color), 0, 0, 0).rotateX(Math.PI / 2));
  body.add(mesh(Geo.cyl(r * 0.92, r * 0.92, 0.002, 48), M.window(), 0, 0, t / 2 + 0.001).rotateX(Math.PI / 2));
  g.add(mesh(Geo.box(0.02, r * 0.5, 0.02, 0.003), M.dark(), 0, r * 0.25, 0));
  return { g, sensorY: r, sensorZ: t / 2, rotor: null, height: r * 2 };
}

function kinect(b) {
  const g = new THREE.Group(), w = b.w, h = b.h, d = b.dpt;
  g.add(mesh(Geo.box(w, h, d, 0.008), Mat.plain('#b9bec4', 0.35, 0.8), 0, h / 2, 0));
  g.add(mesh(Geo.box(w * 0.94, h * 0.8, 0.003, 0.004), M.window(), 0, h / 2, d / 2 + 0.0015));
  g.add(mesh(Geo.cyl(0.006, 0.006, 0.003, 16), M.lens(), w * 0.2, h / 2, d / 2 + 0.003).rotateX(Math.PI / 2));
  g.add(mesh(Geo.cyl(0.004, 0.004, 0.003, 16), M.lens(), -w * 0.12, h / 2, d / 2 + 0.003).rotateX(Math.PI / 2));
  return { g, sensorY: h / 2, sensorX: -w * 0.12, sensorZ: d / 2, rotor: null, height: h };
}

const SHAPES = { puck, can, tower, ouster, hesai, dome, livox, auto, rplidar, hokuyo, tim, lms, blk, tlsbox, tlsflat, riegl, zeb, stick, phone, l515, kinect };

export function buildScannerModel(spec) {
  const b = { ...spec.body, model: spec.model };
  const f = SHAPES[b.shape] || puck;
  const m = f(b);
  m.g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const sensor = new THREE.Object3D();
  sensor.name = 'Optisches Zentrum';
  if (m.headRotor) { sensor.position.set(0, 0.04, 0); m.headRotor.add(sensor); }
  else { sensor.position.set(m.sensorX || 0, m.sensorY, m.sensorZ || 0); if (m.sensorRoll) sensor.rotation.z = m.sensorRoll; m.g.add(sensor); }
  m.g.userData.noLidar = true;
  m.g.name = spec.model;
  return { group: m.g, sensor, rotor: m.rotor, rotorSpins: !!m.rotorSpins, mirror: m.mirror || null, mirrorAxis: m.mirrorAxis || 'x', headRotor: m.headRotor || null, height: m.height };
}

/* ---------------- Stativ (Vermessungsstativ mit Dreifuß) ---------------- */

export function buildTripod(height = 1.5, opts = {}) {
  const g = new THREE.Group();
  g.name = 'Stativ';
  const legMat = opts.wood ? Mat.plain('#c8a061', 0.7, 0) : Mat.plain('#d6a21e', 0.45, 0.2);
  const alu = Mat.alu(), dark = Mat.anodized(), rubber = Mat.rubber();
  const headH = height - 0.12;
  const spread = height * 0.36;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
    const foot = new THREE.Vector3(Math.cos(a) * spread, 0, Math.sin(a) * spread);
    const top = new THREE.Vector3(Math.cos(a) * 0.06, headH, Math.sin(a) * 0.06);
    const dir = new THREE.Vector3().subVectors(top, foot);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    // Oberes Rohr (breit, zweiholmig) und Auszug
    const upper = mesh(Geo.box(0.034, len * 0.6, 0.02, 0.004), legMat); upper.position.copy(top).addScaledVector(dir, -0.3); upper.quaternion.copy(q); g.add(upper);
    const lower = mesh(Geo.cyl(0.011, 0.011, len * 0.5, 16), alu); lower.position.copy(foot).addScaledVector(dir, 0.25); lower.quaternion.copy(q); g.add(lower);
    const clamp = mesh(Geo.box(0.04, 0.03, 0.03, 0.004), dark); clamp.position.copy(foot).addScaledVector(dir, 0.42); clamp.quaternion.copy(q); g.add(clamp);
    const shoe = mesh(Geo.cyl(0.004, 0.012, 0.06, 10), Mat.steel()); shoe.position.copy(foot).add(new THREE.Vector3(0, 0.03, 0)); g.add(shoe);
    const pad = mesh(Geo.box(0.05, 0.006, 0.02, 0.002), rubber); pad.position.copy(foot).addScaledVector(dir, 0.08); pad.quaternion.copy(q); g.add(pad);
  }
  // Stativteller und Dreifuß (Tribrach)
  g.add(mesh(Geo.cyl(0.09, 0.08, 0.035, 3 * 8), alu, 0, headH + 0.0175, 0));
  g.add(mesh(Geo.cyl(0.065, 0.07, 0.03, 32), dark, 0, headH + 0.05, 0));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; g.add(mesh(Geo.cyl(0.012, 0.012, 0.02, 16), dark, Math.cos(a) * 0.055, headH + 0.045, Math.sin(a) * 0.055)); }
  g.add(mesh(Geo.cyl(0.05, 0.05, 0.02, 32), Mat.steel(), 0, headH + 0.075, 0));
  // Dosenlibelle
  g.add(mesh(Geo.cyl(0.009, 0.009, 0.006, 16), Mat.glass('#9fe3a3', 0.8), 0.045, headH + 0.068, 0.0));
  const top = new THREE.Object3D(); top.position.y = headH + 0.085; g.add(top);
  return { group: g, top, height: headH + 0.085 };
}
