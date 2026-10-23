// Industrie-Objekte in echten Maßen (Meter). Ursprung: Bodenmitte. Materialien mit NIR-Eigenschaften.
import * as THREE from 'three';
import { lm, lmTint } from './lidarmat.js';
import { G, mesh, extrude, iBeam, pipe, rod, wireMesh, bake } from './geo.js';

/* ---------------- Logistik ---------------- */

// Europalette 1200 × 800 × 144 mm
export function pallet() {
  const g = new THREE.Group();
  const w = lm('holz_palette');
  for (const z of [-0.345, 0, 0.345]) g.add(mesh(G.box(1.2, 0.022, 0.1), w, 0, 0.011, z));
  for (const x of [-0.55, 0, 0.55]) for (const z of [-0.345, 0, 0.345]) g.add(mesh(G.box(x === 0 ? 0.145 : 0.1, 0.078, z === 0 ? 0.145 : 0.1), lm('holz_hell'), x, 0.022 + 0.039, z));
  for (const x of [-0.55, 0, 0.55]) g.add(mesh(G.box(x === 0 ? 0.145 : 0.1, 0.022, 0.8), w, x, 0.111, 0));
  // Deckbretter längs (2 × 145, 1 × 145 mittig, 2 × 100)
  for (const [z, bw] of [[-0.3275, 0.145], [-0.17, 0.1], [0, 0.145], [0.17, 0.1], [0.3275, 0.145]]) g.add(mesh(G.box(1.2, 0.022, bw), w, 0, 0.133, z));
  return bake(g);
}

export function carton(w, h, d, tint) {
  const g = new THREE.Group();
  const m = tint ? lmTint('karton', tint) : lm('karton');
  g.add(mesh(G.rbox(w, h, d, 0.006), m, 0, h / 2, 0));
  // Klebeband oben
  g.add(mesh(G.box(0.05, 0.001, d + 0.002), lmTint('kunststoff_weiss', '#d9cdb5'), 0, h + 0.0006, 0));
  return g;
}

// Palette mit Kartonlage und Stretchfolie
export function palletLoad(layers = 3, seed = 1, film = true) {
  const g = new THREE.Group();
  g.add(pallet());
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bw = 0.4, bd = 0.39, bh = 0.27;
  let top = 0.144;
  for (let L = 0; L < layers; L++) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      if (L === layers - 1 && r() < 0.25) continue;
      const c = carton(bw - 0.004, bh, bd - 0.004, r() < 0.3 ? '#9c7a4e' : null);
      c.position.set(-0.4 + i * 0.4 + (r() - 0.5) * 0.008, top, -0.2 + j * 0.4 + (r() - 0.5) * 0.008);
      g.add(c);
    }
    top += bh;
  }
  if (film) {
    const f = mesh(G.rbox(1.215, top - 0.16, 0.815, 0.02), lm('stretchfolie'), 0, 0.16 + (top - 0.16) / 2, 0);
    g.add(f);
  }
  return g;
}

// Kleinladungsträger (VDA-KLT 600 × 400 × 280)
export function klt(color = 'kunststoff_blau', l = 0.6, w = 0.4, h = 0.28) {
  const g = new THREE.Group();
  const m = lm(color);
  const t = 0.004;
  g.add(mesh(G.box(l - 0.02, t, w - 0.02), m, 0, 0.01, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(G.box(l, h, t), m, 0, h / 2, s * (w / 2 - t / 2)));
    g.add(mesh(G.box(t, h, w), m, s * (l / 2 - t / 2), h / 2, 0));
    // Griffleiste und Rippen
    g.add(mesh(G.box(l + 0.01, 0.02, 0.012), m, 0, h - 0.01, s * (w / 2 + 0.002)));
    for (let k = -2; k <= 2; k++) g.add(mesh(G.box(0.012, h * 0.85, 0.008), m, k * 0.12, h * 0.45, s * (w / 2 + 0.003)));
  }
  g.add(mesh(G.box(0.09, 0.055, 0.003), lm('kunststoff_weiss'), 0.1, h * 0.55, w / 2 + 0.006));
  return bake(g);
}

// Fass: 200-l-Stahlfass oder Kunststofffass
export function barrel(kind = 'stahl') {
  const g = new THREE.Group();
  const r = 0.29, h = 0.88;
  if (kind === 'stahl') {
    const m = lm('lack_blau');
    g.add(mesh(G.lathe([[0, 0], [r - 0.01, 0], [r, 0.015], [r, h - 0.015], [r - 0.01, h], [0, h]], 40), m));
    for (const y of [0.29, 0.59]) g.add(mesh(G.torus(r + 0.004, 0.008, 6, 40), m, 0, y, 0, Math.PI / 2));
    g.add(mesh(G.cyl(0.025, 0.025, 0.012, 12), lm('stahl_verzinkt'), 0.16, h + 0.006, 0));
  } else {
    const m = lm(kind === 'blau' ? 'kunststoff_blau' : 'kunststoff_weiss');
    g.add(mesh(G.lathe([[0, 0], [r - 0.03, 0], [r, 0.05], [r + 0.01, h * 0.5], [r, h - 0.05], [r - 0.03, h], [0, h]], 40), m));
    for (const y of [0.22, 0.66]) g.add(mesh(G.torus(r + 0.013, 0.01, 6, 40), m, 0, y, 0, Math.PI / 2));
  }
  return g;
}

export function gasCylinder(color = '#7a7f86') {
  const g = new THREE.Group();
  const r = 0.115, h = 1.45;
  g.add(mesh(G.lathe([[0, 0], [r - 0.01, 0], [r, 0.03], [r, h - 0.18], [r * 0.5, h - 0.06], [0.03, h - 0.04], [0, h - 0.04]], 32), lmTint('lack_silber', color)));
  g.add(mesh(G.cyl(0.035, 0.035, 0.1, 16), lm('stahl_verzinkt'), 0, h + 0.01, 0));
  g.add(mesh(G.torus(0.035, 0.006, 6, 16), lm('stahl_verzinkt'), 0, h + 0.07, 0, Math.PI / 2));
  return g;
}

// Hochregal: Felder × Ebenen, Feldbreite 2,7 m, Tiefe 1,1 m
export function rack(bays = 3, levels = [0, 1.7, 3.4], height = 5.0, loads = true, seed = 3) {
  const g = new THREE.Group();
  const up = lm('ral5010'), beam = lmTint('lack_orange', '#d9541a');
  const bw = 2.7, depth = 1.1;
  for (let b = 0; b <= bays; b++) {
    const x = -bays * bw / 2 + b * bw;
    for (const z of [-depth / 2, depth / 2]) {
      g.add(mesh(G.box(0.1, height, 0.07), up, x, height / 2, z));
      g.add(mesh(G.box(0.16, 0.008, 0.14), lm('stahl_verzinkt'), x, 0.004, z));
    }
    // Rahmenaussteifung (Diagonalen)
    for (let y = 0.3; y < height - 0.6; y += 1.0) {
      g.add(rod([x, y, -depth / 2], [x, y + 1.0, depth / 2], 0.012, up, 8));
      g.add(mesh(G.box(0.03, 0.03, depth), up, x, y, 0));
    }
  }
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (const L of levels) {
    for (let b = 0; b < bays; b++) {
      const x0 = -bays * bw / 2 + b * bw + bw / 2;
      if (L > 0) for (const z of [-depth / 2, depth / 2]) g.add(mesh(G.box(bw - 0.1, 0.12, 0.05), beam, x0, L, z));
      if (!loads) continue;
      for (const dx of [-0.88, 0, 0.88]) {
        if (r() < 0.18) continue;
        const pl = palletLoad(1 + Math.floor(r() * 3), Math.floor(r() * 1000), r() < 0.7);
        pl.rotation.y = Math.PI / 2;
        pl.position.set(x0 + dx, L + (L > 0 ? 0.06 : 0), 0);
        g.add(pl);
      }
    }
  }
  return g;
}

/* ---------------- Fahrzeuge ---------------- */

export function wheel(r, w, rim = 'stahl_grau') {
  const g = new THREE.Group();
  g.add(mesh(G.lathe([[r * 0.62, -w / 2], [r * 0.92, -w / 2], [r, -w * 0.3], [r, w * 0.3], [r * 0.92, w / 2], [r * 0.62, w / 2]], 32), lm('gummi')));
  g.add(mesh(G.cyl(r * 0.62, r * 0.62, w * 0.8, 24), lm(rim)));
  g.add(mesh(G.cyl(r * 0.2, r * 0.2, w * 0.95, 12), lm('stahl_verzinkt')));
  g.children.forEach((m) => { m.rotation.z = Math.PI / 2; });
  return g;
}

// Frontstapler (≈ 2,5 t), Gabeln vorn (+z)
export function forklift() {
  const g = new THREE.Group();
  const body = lm('ral1003'), dark = lm('stahl_grau'), black = lm('kunststoff_schwarz');
  // Fahrgestell und Gegengewicht
  g.add(mesh(G.rbox(1.15, 0.55, 2.0, 0.06), body, 0, 0.55, -0.1));
  g.add(mesh(extrude([[-0.58, 0], [0.58, 0], [0.58, 0.75], [0.45, 0.95], [-0.45, 0.95], [-0.58, 0.75]], 0.6, { bevel: 0.02 }), dark, 0, 0.25, -1.05));
  g.add(mesh(G.rbox(1.05, 0.08, 1.3, 0.02), black, 0, 0.86, -0.2));
  // Sitz, Lenkrad, Armaturen
  g.add(mesh(G.rbox(0.48, 0.12, 0.48, 0.04), lm('textil_dunkel'), 0, 1.0, -0.45));
  g.add(mesh(G.rbox(0.48, 0.55, 0.12, 0.04), lm('textil_dunkel'), 0, 1.3, -0.7));
  g.add(mesh(G.torus(0.16, 0.015, 6, 24), black, 0, 1.38, 0.18, -0.9));
  g.add(rod([0, 1.05, 0.32], [0, 1.36, 0.2], 0.02, black));
  g.add(mesh(G.rbox(0.9, 0.35, 0.25, 0.04), body, 0, 1.0, 0.45));
  // Fahrerschutzdach
  for (const sx of [-0.5, 0.5]) {
    g.add(rod([sx, 0.86, 0.55], [sx * 0.95, 2.15, 0.3], 0.035, black));
    g.add(rod([sx, 0.86, -0.95], [sx, 2.15, -0.95], 0.035, black));
  }
  g.add(mesh(G.box(1.05, 0.04, 1.35), black, 0, 2.17, -0.33));
  for (let k = -4; k <= 4; k++) g.add(mesh(G.box(0.03, 0.03, 1.3), black, k * 0.11, 2.13, -0.33));
  // Hubgerüst
  const mast = new THREE.Group(); mast.position.set(0, 0, 0.95); g.add(mast);
  for (const sx of [-0.36, 0.36]) {
    mast.add(mesh(iBeam(0.12, 0.08, 0.012, 0.014, 2.3), dark, sx, 0.15 + 1.15, 0));
    mast.add(mesh(iBeam(0.1, 0.07, 0.01, 0.012, 2.2), dark, sx * 0.82, 0.2 + 1.1, 0.04));
  }
  for (const y of [0.4, 1.4, 2.4]) mast.add(mesh(G.box(0.8, 0.08, 0.06), dark, 0, y, -0.02));
  mast.add(mesh(G.cyl(0.045, 0.045, 1.6, 16), lm('edelstahl'), 0, 1.0, -0.05));
  // Gabelträger und Zinken
  mast.add(mesh(G.box(1.0, 0.4, 0.04), dark, 0, 0.3, 0.1));
  for (let k = 0; k < 4; k++) mast.add(mesh(G.box(0.02, 0.36, 0.02), dark, -0.4 + k * 0.27, 0.62, 0.1));
  for (const sx of [-0.3, 0.3]) {
    mast.add(mesh(G.box(0.12, 0.5, 0.045), dark, sx, 0.3, 0.15));
    mast.add(mesh(G.box(0.12, 0.045, 1.15), dark, sx, 0.07, 0.72));
  }
  // Räder
  for (const sx of [-0.52, 0.52]) {
    const fw = wheel(0.34, 0.24); fw.position.set(sx, 0.34, 0.6); g.add(fw);
    const rw = wheel(0.28, 0.2); rw.position.set(sx * 0.95, 0.28, -0.85); g.add(rw);
  }
  // Rundumleuchte und Rückspiegel
  g.add(mesh(G.cyl(0.05, 0.06, 0.08, 16), lmTint('kunststoff_weiss', '#ff8a00'), 0.35, 2.24, -0.9));
  g.add(mesh(G.rbox(0.14, 0.09, 0.02, 0.01), lm('spiegel'), -0.6, 1.95, 0.28));
  return g;
}

/* ---------------- Anlagenbau ---------------- */

function flange(r, t, mat) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(r * 1.55, r * 1.55, t, 28), mat));
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.add(mesh(G.cyl(r * 0.12, r * 0.12, t * 1.8, 6), lm('stahl_verzinkt'), Math.cos(a) * r * 1.3, 0, Math.sin(a) * r * 1.3)); }
  return g;
}

// Rohrbrücke mit Rohren, Flanschen, Schieber und isolierter Leitung (Alu-Ummantelung)
export function pipeRack(len = 10, h = 3.2) {
  const g = new THREE.Group();
  const steel = lm('stahl_grau'), pipeM = lm('ral6011'), hot = lm('alu_blech');
  for (let x = -len / 2; x <= len / 2 + 0.01; x += len / 3) {
    for (const z of [-0.6, 0.6]) g.add(mesh(iBeam(0.16, 0.16, 0.008, 0.013, h), steel, x, h / 2, z));
    g.add(mesh(iBeam(0.14, 0.14, 0.007, 0.012, 1.4), steel, x, h, 0, Math.PI / 2, 0, 0));
    g.add(rod([x, h - 0.9, -0.6], [x, h - 0.1, 0.5], 0.025, steel, 8));
  }
  g.add(mesh(G.box(len + 0.3, 0.12, 0.08), steel, 0, h + 0.07, -0.6));
  g.add(mesh(G.box(len + 0.3, 0.12, 0.08), steel, 0, h + 0.07, 0.6));
  const lines = [[-0.42, 0.11, pipeM], [-0.12, 0.08, lm('ral3000')], [0.15, 0.055, lm('stahl_verzinkt')], [0.38, 0.17, hot]];
  for (const [z, r, m] of lines) {
    const p = mesh(G.cyl(r, r, len + 0.6, 28), m, 0, h + 0.08 + r, z, 0, 0, Math.PI / 2);
    g.add(p);
    if (m !== hot) for (const fx of [-len / 4, len / 4]) { const f = flange(r, 0.025, m); f.rotation.z = Math.PI / 2; f.position.set(fx, h + 0.08 + r, z); g.add(f); }
    else for (let k = -6; k <= 6; k++) g.add(mesh(G.cyl(r + 0.004, r + 0.004, 0.012, 28), hot, k * (len / 13), h + 0.08 + r, z, 0, 0, Math.PI / 2));
  }
  // Abgang nach unten mit Schieber
  const r = 0.08, x = len * 0.18, z = -0.12;
  g.add(mesh(pipe([[x, h + 0.16, z], [x, h - 0.3, z], [x, 1.1, z]], r, 4, 20), lm('ral3000')));
  const v = new THREE.Group(); v.position.set(x, 1.6, z); g.add(v);
  v.add(mesh(G.rbox(0.26, 0.3, 0.22, 0.04), lm('ral3000')));
  v.add(mesh(G.cyl(0.03, 0.03, 0.5, 12), lm('edelstahl'), 0, 0.4, 0));
  v.add(mesh(G.torus(0.17, 0.014, 8, 32), lm('stahl_grau'), 0, 0.65, 0, Math.PI / 2));
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; v.add(rod([0, 0.65, 0], [Math.cos(a) * 0.17, 0.65, Math.sin(a) * 0.17], 0.01, lm('stahl_grau'), 6)); }
  for (const y of [-0.17, 0.17]) { const f = flange(r, 0.025, lm('ral3000')); f.position.y = y; v.add(f); }
  return g;
}

// Kreiselpumpe mit Motor auf Grundrahmen
export function pumpSkid() {
  const g = new THREE.Group();
  const frame = lm('stahl_grau'), motorM = lmTint('ral5010', '#2f5f8f'), pumpM = lm('ral3000');
  for (const z of [-0.3, 0.3]) g.add(mesh(extrude([[-0.05, 0], [0.05, 0], [0.05, 0.014], [0.006, 0.014], [0.006, 0.146], [0.05, 0.146], [0.05, 0.16], [-0.05, 0.16]], 2.0), frame, 0, 0, z, 0, Math.PI / 2, 0));
  g.add(mesh(G.box(2.0, 0.012, 0.7), frame, 0, 0.165, 0));
  // Motor mit Kühlrippen und Lüfterhaube
  const motor = new THREE.Group(); motor.position.set(-0.45, 0.48, 0); g.add(motor);
  motor.add(mesh(G.cyl(0.24, 0.24, 0.7, 40), motorM, 0, 0, 0, 0, 0, Math.PI / 2));
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; motor.add(mesh(G.box(0.68, 0.035, 0.006), motorM, 0, Math.cos(a) * 0.255, Math.sin(a) * 0.255, a, 0, 0)); }
  motor.add(mesh(G.lathe([[0, 0], [0.25, 0], [0.26, 0.05], [0.25, 0.16], [0, 0.18]], 32), motorM, -0.35, 0, 0, 0, 0, Math.PI / 2));
  motor.add(mesh(G.rbox(0.22, 0.14, 0.2, 0.02), motorM, 0, 0.3, 0));
  motor.add(mesh(G.box(0.5, 0.26, 0.06), frame, 0, -0.2, 0.2));
  motor.add(mesh(G.box(0.5, 0.26, 0.06), frame, 0, -0.2, -0.2));
  // Kupplungsschutz (Halbschale)
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 24, 1, false, 0, Math.PI), lm('lack_orange'), 0.12, 0.48, 0, 0, 0, Math.PI / 2));
  // Pumpe: Spiralgehäuse
  const p = new THREE.Group(); p.position.set(0.55, 0.48, 0); g.add(p);
  p.add(mesh(G.cyl(0.26, 0.26, 0.2, 32), pumpM, 0.1, 0, 0, 0, 0, Math.PI / 2));
  p.add(mesh(G.torus(0.22, 0.09, 12, 32, Math.PI * 1.6), pumpM, 0.1, 0, 0, 0, Math.PI / 2, 0));
  p.add(mesh(G.cyl(0.11, 0.11, 0.3, 24), pumpM, -0.12, 0, 0, 0, 0, Math.PI / 2));
  p.add(mesh(G.box(0.3, 0.3, 0.4), frame, -0.05, -0.2, 0));
  // Saug- und Druckstutzen
  const fs = flange(0.09, 0.03, pumpM); fs.rotation.z = Math.PI / 2; fs.position.set(0.32, 0, 0); p.add(fs);
  p.add(mesh(G.cyl(0.09, 0.09, 0.4, 24), pumpM, 0.1, 0.45, 0.0));
  const fd = flange(0.07, 0.03, pumpM); fd.position.set(0.1, 0.66, 0); p.add(fd);
  return g;
}

// Schaltschrankreihe RAL 7035
export function cabinets(n = 3) {
  const g = new THREE.Group();
  const m = lm('ral7035');
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.81;
    g.add(mesh(G.box(0.8, 0.1, 0.5), lm('ral9005'), x, 0.05, 0));
    g.add(mesh(G.rbox(0.8, 2.0, 0.5, 0.008), m, x, 1.1, 0));
    g.add(mesh(G.box(0.006, 1.96, 0.004), lm('ral9005'), x, 1.1, 0.252));
    g.add(mesh(G.rbox(0.03, 0.16, 0.03, 0.008), lm('kunststoff_schwarz'), x + 0.3, 1.2, 0.27));
    g.add(mesh(G.box(0.16, 0.1, 0.005), lm('kunststoff_weiss'), x, 1.75, 0.253));
    g.add(mesh(G.rbox(0.2, 0.2, 0.015, 0.004), lm('kunststoff_grau'), x - 0.15, 0.4, 0.257));
  }
  return bake(g);
}

export function workbench() {
  const g = new THREE.Group();
  const steel = lm('ral5010');
  g.add(mesh(G.box(2.0, 0.04, 0.8), lm('holz_hell'), 0, 0.88, 0));
  for (const x of [-0.95, 0.95]) for (const z of [-0.36, 0.36]) g.add(mesh(G.box(0.05, 0.86, 0.05), steel, x, 0.43, z));
  g.add(mesh(G.box(1.9, 0.04, 0.04), steel, 0, 0.15, -0.36));
  g.add(mesh(G.box(0.55, 0.65, 0.7), steel, 0.6, 0.5, 0));
  for (let k = 0; k < 4; k++) g.add(mesh(G.box(0.5, 0.012, 0.01), lm('stahl_verzinkt'), 0.6, 0.3 + k * 0.15, 0.356));
  // Schraubstock
  const v = new THREE.Group(); v.position.set(-0.7, 0.9, 0.3); g.add(v);
  v.add(mesh(G.box(0.14, 0.08, 0.3), lm('ral6011'), 0, 0.04, 0));
  v.add(mesh(G.box(0.16, 0.08, 0.04), lm('ral6011'), 0, 0.12, -0.05));
  v.add(mesh(G.box(0.16, 0.08, 0.04), lm('ral6011'), 0, 0.12, 0.08));
  v.add(rod([0, 0.1, 0.1], [0, 0.1, 0.26], 0.01, lm('edelstahl')));
  // Werkzeugkiste
  g.add(mesh(G.rbox(0.5, 0.2, 0.25, 0.015), lm('lack_rot'), 0.1, 1.0, -0.15));
  g.add(mesh(G.box(0.3, 0.02, 0.03), lm('kunststoff_schwarz'), 0.1, 1.12, -0.15));
  return g;
}

// Schutzzaun-Feld mit Pfosten und Drahtgitter
export function fence(len = 4, h = 2.0) {
  const g = new THREE.Group();
  const post = lm('ral1003');
  const n = Math.max(1, Math.round(len / 1.3));
  const pw = len / n;
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + i * pw;
    g.add(mesh(G.box(0.06, h + 0.1, 0.06), post, x, (h + 0.1) / 2, 0));
    g.add(mesh(G.box(0.14, 0.008, 0.14), post, x, 0.004, 0));
    if (i < n) {
      const cx = x + pw / 2;
      g.add(mesh(G.box(pw - 0.06, 0.03, 0.02), lm('ral9005'), cx, 0.12, 0));
      g.add(mesh(G.box(pw - 0.06, 0.03, 0.02), lm('ral9005'), cx, h, 0));
      g.add(mesh(G.box(0.02, h - 0.1, 0.02), lm('ral9005'), x + 0.04, h / 2 + 0.06, 0));
      g.add(mesh(wireMesh(pw - 0.1, h - 0.14, 0.05, 0.004), lm('ral9005'), cx, h / 2 + 0.06, 0));
    }
  }
  return g;
}

export function extinguisher() {
  const g = new THREE.Group();
  g.add(mesh(G.lathe([[0, 0], [0.075, 0], [0.08, 0.02], [0.08, 0.5], [0.06, 0.56], [0.02, 0.58], [0, 0.58]], 28), lm('lack_rot')));
  g.add(mesh(G.cyl(0.016, 0.016, 0.06, 10), lm('kunststoff_schwarz'), 0, 0.61, 0));
  g.add(mesh(G.box(0.12, 0.02, 0.03), lm('kunststoff_schwarz'), 0.04, 0.64, 0));
  g.add(mesh(pipe([[0.0, 0.6, 0.02], [0.06, 0.55, 0.09], [0.09, 0.3, 0.09]], 0.008, 12, 8), lm('kabel')));
  g.add(mesh(G.box(0.1, 0.12, 0.002), lm('kunststoff_weiss'), 0, 0.3, 0.081));
  return g;
}

// Verkehrsspiegel (konvex) an Pfosten – erzeugt verzerrte Geisterpunkte
export function convexMirror(r = 0.3, poleH = 2.4) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.03, 0.03, poleH, 12), lm('stahl_verzinkt'), 0, poleH / 2, 0));
  const head = new THREE.Group(); head.position.set(0, poleH, 0.06); head.rotation.x = 0.15; g.add(head);
  const cap = new THREE.SphereGeometry(r * 2.2, 40, 16, 0, Math.PI * 2, 0, Math.asin(1 / 2.2));
  cap.rotateX(Math.PI / 2);
  cap.translate(0, 0, -r * 2.2 * Math.cos(Math.asin(1 / 2.2)));
  head.add(mesh(cap, lm('spiegel')));
  head.add(mesh(G.torus(r, 0.025, 8, 40), lm('retro_rot'), 0, 0, 0));
  head.add(mesh(G.cyl(r * 1.02, r * 1.02, 0.04, 40), lm('kunststoff_schwarz'), 0, 0, -0.03, Math.PI / 2, 0, 0));
  return g;
}

export function ladder(h = 3.0) {
  const g = new THREE.Group();
  const m = lm('alu_blech');
  for (const x of [-0.22, 0.22]) g.add(mesh(G.box(0.025, h, 0.07), m, x, h / 2, 0));
  for (let y = 0.28; y < h; y += 0.28) g.add(mesh(G.box(0.44, 0.03, 0.04), m, 0, y, 0));
  g.rotation.x = -0.25;
  return g;
}

/* ---------------- Menschen ---------------- */

// Person (≈ 1,78 m) – Kleidung: 'arbeit' (Warnweste mit Retrostreifen), 'alltag', 'dunkel'
// Person (1,80 m): Kopf mit Gesicht und Haaren, Rumpf mit Kragen und Gürtel, Arme mit Ellbogen und Händen,
// Beine mit Knien und Schuhen. Stile: 'arbeit' (Warnweste, Arbeitshose, Sicherheitsschuhe, Bauhelm),
// 'alltag' (helles Oberteil, Jeans, Turnschuhe), 'dunkel' (dunkle Jacke). Gelenke sind eigene Körper im Scan-Kern.
// userData.limbs: { legs: [rechts, links], arms: [rechts, links] }, je mit userData.knee bzw. userData.elbow.
export function person(style = 'arbeit', pose = 0, o = {}) {
  const g = new THREE.Group();
  const work = style === 'arbeit';
  const skin = o.skin ? lmTint('haut', o.skin) : lm('haut');
  const hair = o.hair ? lmTint('haare', o.hair) : lm('haare');
  const shirt = work ? lmTint('textil', '#3c4656') : style === 'dunkel' ? lm('textil_dunkel') : o.top ? lmTint('baumwolle_hell', o.top) : lm('baumwolle_hell');
  const pants = work ? lmTint('textil', '#2f3644') : style === 'dunkel' ? lmTint('textil_dunkel', '#23262b') : lm('jeans');
  const shoe = work ? lmTint('leder', '#2b2420') : style === 'dunkel' ? lm('kunststoff_schwarz') : lmTint('kunststoff_weiss', '#e9eaec');
  const sole = work ? lm('gummi') : lmTint('gummi', style === 'dunkel' ? '#1a1a1b' : '#f4f4f2');
  const dark = lm('kunststoff_schwarz'), white = lmTint('kunststoff_weiss', '#f4f2ee'), lip = lmTint('haut', '#a8705c');
  const helmet = lmTint('kunststoff_weiss', '#f2f2f0'); // Farbe f2f2f0: die Spielfigur färbt ihren Helm um
  const retro = lm('retro_band');
  g.userData.limbs = { legs: [], arms: [] };
  const part = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); p.userData.lidarBody = true; parent.add(p); return p; };

  // ---------- Beine (Hüftgelenk 0,92 m, Knie 0,47 m) ----------
  for (const [sx, a] of [[-1, -pose * 0.4], [1, pose * 0.4]]) {
    const L = part(g, sx * 0.095, 0.92, 0); L.rotation.x = a;
    L.add(mesh(G.lathe([[0, 0.02], [0.084, 0.02], [0.083, -0.06], [0.074, -0.24], [0.06, -0.42], [0.056, -0.46], [0, -0.46]], 18), pants));
    if (work) L.add(mesh(G.rbox(0.05, 0.12, 0.03, 0.01), pants, sx * 0.07, -0.2, 0.0, 0, 0, 0)); // Seitentasche
    const K = part(L, 0, -0.45, 0); K.rotation.x = Math.max(0, -a) * 0.6;
    L.userData.knee = K;
    K.add(mesh(G.lathe([[0, 0.02], [0.057, 0.02], [0.06, -0.12], [0.05, -0.28], [0.043, -0.37], [0, -0.38]], 16), pants));
    if (work) {
      K.add(mesh(G.rbox(0.085, 0.11, 0.03, 0.012), dark, 0, -0.02, 0.05)); // Knieschoner
      K.add(mesh(G.cyl(0.054, 0.052, 0.035, 18, true), retro, 0, -0.24, 0));
    }
    // Schuh: Schaft, Fuß mit runder Kappe, Sohle
    K.add(mesh(G.cyl(0.05, 0.052, work ? 0.1 : 0.05, 16), shoe, 0, -0.39, 0.0));
    K.add(mesh(G.rbox(0.104, 0.07, 0.25, 0.032), shoe, 0, -0.44, 0.045));
    K.add(mesh(G.rbox(0.112, 0.024, 0.27, 0.01), sole, 0, -0.468, 0.048));
    g.userData.limbs.legs.push(L);
  }

  // ---------- Rumpf ----------
  const torso = mesh(G.lathe([[0, 0], [0.16, 0], [0.168, 0.05], [0.158, 0.2], [0.17, 0.32], [0.188, 0.44], [0.186, 0.52], [0.155, 0.58], [0.075, 0.625], [0, 0.63]], 28), shirt, 0, 0.86, 0);
  torso.scale.set(1, 1, 0.66); g.add(torso);
  for (const sx of [-1, 1]) g.add(mesh(G.sphere(0.064, 16, 12), shirt, sx * 0.192, 1.405, 0)); // Schultern
  const belt = mesh(G.cyl(0.166, 0.166, 0.045, 28, true), work ? lmTint('leder', '#2a2420') : lm('kunststoff_schwarz'), 0, 0.955, 0); belt.scale.set(1.02, 1, 0.68); g.add(belt);
  g.add(mesh(G.rbox(0.05, 0.035, 0.012, 0.004), lm('edelstahl'), 0, 0.955, 0.113)); // Schnalle
  g.add(mesh(G.torus(0.052, 0.016, 8, 20), shirt, 0, 1.495, 0, Math.PI / 2, 0, 0)); // Kragen
  if (work) {
    // Warnweste über dem Hemd: Hülle mit zwei Reflexstreifen und Trägern über die Schultern
    const vest = mesh(G.lathe([[0.176, 0], [0.166, 0.12], [0.178, 0.24], [0.196, 0.36], [0.19, 0.43], [0.15, 0.48]], 28), lm('warnweste'), 0, 0.98, 0);
    vest.scale.set(1.02, 1, 0.7); g.add(vest);
    for (const y of [1.07, 1.17]) { const b = mesh(G.cyl(0.18, 0.18, 0.04, 28, true), retro, 0, y, 0); b.scale.set(1.04, 1, 0.73); g.add(b); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.box(0.036, 0.2, 0.006), retro, sx * 0.085, 1.31, sz * 0.13, sz * -0.12, 0, 0));
    g.add(mesh(G.box(0.008, 0.42, 0.006), dark, 0, 1.2, 0.132)); // Reißverschluss
    g.add(mesh(G.rbox(0.07, 0.06, 0.012, 0.006), lm('warnweste'), -0.09, 1.27, 0.128)); // Brusttasche
  } else if (style === 'dunkel') {
    g.add(mesh(G.box(0.008, 0.5, 0.006), lm('stahl_grau'), 0, 1.16, 0.128)); // Jackenreißverschluss
  }

  // ---------- Hals und Kopf ----------
  g.add(mesh(G.cyl(0.05, 0.054, 0.1, 14), skin, 0, 1.535, 0));
  const H = new THREE.Group(); H.position.set(0, 1.665, 0.005); g.add(H);
  // Kopf aus einem Profil gedreht (Kinn bis Scheitel): eine glatte Fläche ohne Naht
  const skull = mesh(G.lathe([[0, -0.118], [0.03, -0.114], [0.052, -0.098], [0.068, -0.072], [0.079, -0.04], [0.086, -0.004], [0.088, 0.03], [0.083, 0.066], [0.068, 0.096], [0.043, 0.114], [0, 0.122]], 30), skin);
  skull.scale.set(0.98, 1, 1.12); H.add(skull);
  for (const sx of [-1, 1]) {
    const ear = mesh(G.sphere(0.024, 12, 10), skin, sx * 0.085, -0.008, -0.006); ear.scale.set(0.42, 1.05, 0.75); H.add(ear);
    const eye = mesh(G.sphere(0.0118, 14, 10), white, sx * 0.032, 0.008, 0.079); eye.scale.set(1.15, 0.8, 0.8); H.add(eye);
    H.add(mesh(G.sphere(0.0066, 12, 8), dark, sx * 0.032, 0.008, 0.0874));
    H.add(mesh(G.rbox(0.03, 0.0075, 0.008, 0.003), hair, sx * 0.034, 0.034, 0.091, 0, 0, -sx * 0.12));
  }
  const nose = mesh(G.sphere(0.0125, 12, 10), skin, 0, -0.017, 0.095); nose.scale.set(0.78, 1.25, 1.1); H.add(nose);
  H.add(mesh(G.rbox(0.032, 0.006, 0.006, 0.0028), lip, 0, -0.055, 0.086));
  // Haare: Kappe über Hinterkopf und Seiten (bei 'alltag' mit Pony)
  const cap = mesh(new THREE.SphereGeometry(0.104, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.49), hair, 0, 0.004, -0.008, -0.66, 0, 0);
  cap.scale.set(0.9, 1.05, 1.02); H.add(cap);
  if (!work) { const fringe = mesh(new THREE.SphereGeometry(0.103, 20, 8, -Math.PI * 0.32, Math.PI * 0.64, 0, Math.PI * 0.3), hair, 0, 0.006, 0.004); fringe.scale.set(0.9, 1.05, 1.0); H.add(fringe); }
  if (work) {
    // Bauhelm: Kuppel mit Mittelgrat, nach vorn gezogener Schirm, Kopfband
    const dome = mesh(new THREE.SphereGeometry(0.116, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, 0.03, -0.004); dome.scale.set(1, 0.86, 1.1); H.add(dome);
    const brim = mesh(G.cyl(0.124, 0.13, 0.012, 32), helmet, 0, 0.032, 0.022); brim.scale.set(1, 1, 1.2); H.add(brim);
    const ridge = mesh(G.torus(0.113, 0.012, 8, 24, Math.PI), helmet, 0, 0.03, -0.004, 0, Math.PI / 2, 0); ridge.scale.set(1.1, 0.86, 1); H.add(ridge);
    H.add(mesh(G.cyl(0.104, 0.104, 0.016, 28, true), dark, 0, 0.03, -0.004));
  }

  // ---------- Arme (Schulter 1,41 m, Ellbogen −0,29 m, Hand −0,27 m) ----------
  for (const sx of [-1, 1]) {
    const A = part(g, sx * 0.205, 1.41, 0); A.rotation.x = -sx * pose * 0.35; A.rotation.z = sx * 0.07;
    A.add(mesh(G.lathe([[0, 0.03], [0.054, 0.02], [0.052, -0.08], [0.046, -0.24], [0.042, -0.3], [0, -0.3]], 14), shirt));
    const E = part(A, 0, -0.29, 0); E.rotation.x = -0.18;
    A.userData.elbow = E;
    E.add(mesh(G.lathe([[0, 0.01], [0.043, 0.01], [0.042, -0.08], [0.036, -0.2], [0.034, -0.235], [0, -0.24]], 14), work || style === 'dunkel' ? shirt : skin));
    if (!work && style !== 'dunkel') E.add(mesh(G.cyl(0.045, 0.045, 0.06, 14, true), shirt, 0, -0.02, 0)); // kurzer Ärmel
    // Hand: Ballen, Finger leicht gekrümmt, Daumen nach innen
    E.add(mesh(G.rbox(0.032, 0.085, 0.07, 0.014), skin, 0, -0.285, 0.004));
    E.add(mesh(G.rbox(0.028, 0.06, 0.066, 0.012), skin, 0.002 * sx, -0.345, 0.016, 0.3, 0, 0));
    E.add(mesh(G.rbox(0.022, 0.05, 0.022, 0.01), skin, -sx * 0.012, -0.29, 0.04, 0.25, 0, -sx * 0.35));
    g.userData.limbs.arms.push(A);
  }
  // starre Teile je Material zusammenfassen (Rumpf mit Kopf, jedes Glied für sich): wenige Zeichenaufrufe
  bake(g);
  for (const L of g.userData.limbs.legs) { bake(L); bake(L.userData.knee); }
  for (const A of g.userData.limbs.arms) { bake(A); bake(A.userData.elbow); }
  return g;
}

// Gehbewegung für Figuren aus person(): phase in Radiant, amount 0 … 1 (Stehen … Gehen)
export function walkPose(g, phase, amount = 1, arm = [null, null]) {
  const L = g.userData.limbs;
  if (!L) return;
  const sw = Math.sin(phase) * 0.46 * amount;
  for (let k = 0; k < 2; k++) {
    const s = k ? -sw : sw, leg = L.legs[k];
    leg.rotation.x = s;
    // Knie beugt sich, wenn das Bein nach hinten schwingt und beim Vorziehen
    if (leg.userData.knee) leg.userData.knee.rotation.x = (Math.max(0, -Math.sin(phase + (k ? Math.PI : 0))) * 0.75 + 0.05) * amount;
    const A = L.arms[k];
    if (arm[k] == null) { A.rotation.x = -s * 0.75; if (A.userData.elbow) A.userData.elbow.rotation.x = -0.18 - Math.max(0, s) * 0.5; }
    else { A.rotation.x = arm[k]; if (A.userData.elbow) A.userData.elbow.rotation.x = -0.35; }
  }
}

/* ---------------- Prüfmittel ---------------- */

// Schachbrett-Zielmarke auf Stativ (4 × 4 Felder, 0,6 m)
export function checkerTarget(size = 0.6, n = 4) {
  const g = new THREE.Group();
  const board = new THREE.Group(); board.position.y = 1.45; g.add(board);
  const s = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) board.add(mesh(G.box(s, s, 0.006), lm((i + j) % 2 ? 'kal5' : 'kal90'), -size / 2 + s * (i + 0.5), -size / 2 + s * (j + 0.5), 0.012));
  board.add(mesh(G.box(size + 0.04, size + 0.04, 0.018), lm('kunststoff_schwarz')));
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add(rod([0, 1.12, -0.03], [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45 - 0.03], 0.012, lm('alu_blech'), 8)); }
  g.add(mesh(G.cyl(0.015, 0.015, 0.4, 10), lm('alu_blech'), 0, 1.2, -0.02));
  return g;
}

// Referenzkugel (Ø 145 mm, matt) auf Stab
export function sphereTarget(h = 1.2, r = 0.0725) {
  const g = new THREE.Group();
  g.add(mesh(G.sphere(r, 36, 24), lm('kugel_matt'), 0, h + r, 0));
  g.add(mesh(G.cyl(0.012, 0.012, h, 10), lm('stahl_grau'), 0, h / 2, 0));
  g.add(mesh(G.cyl(0.13, 0.15, 0.02, 20), lm('stahl_grau'), 0, 0.01, 0));
  return g;
}

// Reflektivitäts-Prüftafel: Streifen 5 / 10 / 50 / 90 %
export function reflectanceBoard(w = 1.0, h = 1.0, stand = 0.6) {
  const g = new THREE.Group();
  const board = new THREE.Group(); board.position.y = stand + h / 2; g.add(board);
  const names = ['kal5', 'kal10', 'kal50', 'kal90'];
  names.forEach((n, i) => board.add(mesh(G.box(w / 4, h, 0.01), lm(n), -w / 2 + (i + 0.5) * w / 4, 0, 0.01)));
  board.add(mesh(G.box(w + 0.03, h + 0.03, 0.015), lm('stahl_grau'), 0, 0, -0.005));
  for (const x of [-w * 0.35, w * 0.35]) { g.add(mesh(G.box(0.04, stand + 0.1, 0.04), lm('stahl_grau'), x, (stand + 0.1) / 2, -0.03)); g.add(mesh(G.box(0.06, 0.02, 0.5), lm('stahl_grau'), x, 0.01, -0.03)); }
  return g;
}

// Große Reichweiten-Zieltafel (z. B. 10 % / 90 % Hälften), 1 × 1 m
export function rangeTarget(left = 'kal10', right = 'kal90', size = 1.0) {
  const g = new THREE.Group();
  const b = new THREE.Group(); b.position.y = 0.4 + size / 2; g.add(b);
  b.add(mesh(G.box(size / 2, size, 0.012), lm(left), -size / 4, 0, 0.008));
  b.add(mesh(G.box(size / 2, size, 0.012), lm(right), size / 4, 0, 0.008));
  b.add(mesh(G.box(size + 0.04, size + 0.04, 0.012), lm('stahl_grau'), 0, 0, -0.006));
  for (const x of [-size * 0.4, size * 0.4]) g.add(mesh(G.box(0.05, 0.45, 0.05), lm('stahl_grau'), x, 0.225, -0.02));
  return g;
}

// Drehteller (Ø 0,8 m) – die Platte ist ein eigener beweglicher Körper
export function turntable(d = 0.8) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(d * 0.42, d * 0.46, 0.08, 40), lm('ral9005'), 0, 0.04, 0));
  const plate = new THREE.Group(); plate.position.y = 0.08; g.add(plate);
  plate.add(mesh(G.cyl(d / 2, d / 2, 0.025, 48), lm('kunststoff_grau'), 0, 0.0125, 0));
  for (let k = 0; k < 8; k++) plate.add(mesh(G.box(d * 0.46, 0.002, 0.008), lm('kunststoff_weiss'), Math.cos(k * Math.PI / 4) * d * 0.23, 0.026, Math.sin(k * Math.PI / 4) * d * 0.23, 0, -k * Math.PI / 4, 0));
  g.userData.plate = plate;
  return g;
}
