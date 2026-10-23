// Szenen: Werkhalle, Außengelände, Wohnung, Prüfstrecke, Messraum.
// Jede Szene baut ihren Inhalt in world.content auf und registriert scanbare Objekte.
import * as THREE from 'three';
import { lm, lmTint } from './lidarmat.js';
import { G, mesh, iBeam, corrugated, trapezSheet, truss, rod, bake } from './geo.js';
import * as P from './props_industry.js';

function place(world, obj, x, y, z, ry = 0, info = {}) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  world.content.add(obj);
  obj.updateMatrixWorld(true);
  return world.register(obj, info);
}

// Bodenmarkierung (dünne Farbschicht 1,5 mm über dem Boden)
function stripe(group, x0, z0, x1, z1, w, mat) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = mesh(G.box(len, 0.0015, w), mat, (x0 + x1) / 2, 0.00075, (z0 + z1) / 2);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.receiveShadow = true; m.castShadow = false;
  group.add(m);
}

/* ======================= Werkhalle ======================= */

function buildHalle(world) {
  const X = 12, Z = 8, H = 7.4;
  const shell = new THREE.Group(); shell.name = 'Hallenhülle';
  // Boden
  shell.add(mesh(G.box(2 * X + 0.5, 0.2, 2 * Z + 0.5), lm('beton'), 0, -0.1, 0));
  shell.add(mesh(G.box(9.5, 0.002, 6.5), lm('epoxid'), -6.75, 0.001, 4.25));
  const ym = lm('markierung_gelb'), wm = lm('markierung');
  stripe(shell, -X + 0.3, -1.6, X - 0.3, -1.6, 0.1, ym);
  stripe(shell, -X + 0.3, 1.6, X - 0.3, 1.6, 0.1, ym);
  stripe(shell, -1.6, -Z + 0.4, -1.6, -1.6, 0.1, ym);
  stripe(shell, 1.6, 1.6, 1.6, Z - 0.4, 0.1, ym);
  for (let k = 0; k < 9; k++) stripe(shell, 3.4 + k * 0.45, -4.6, 3.75 + k * 0.45, -4.0, 0.08, ym); // Schraffur
  stripe(shell, 3.2, -4.0, 7.6, -4.0, 0.06, ym); stripe(shell, 3.2, -4.6, 7.6, -4.6, 0.06, ym);
  for (let k = -3; k <= 3; k++) stripe(shell, k * 2.4 - 0.4, 0, k * 2.4 + 0.4, 0, 0.12, wm); // Mittellinie gestrichelt
  // Wände: Betonsockel 2,4 m, darüber Wellblech mit Fensterband
  const wallM = lm('beton_hell'), cor = lm('wellblech');
  for (const sz of [-1, 1]) {
    shell.add(mesh(G.box(2 * X, 2.4, 0.25), wallM, 0, 1.2, sz * (Z + 0.125)));
    for (let bx = -X; bx < X; bx += 6) {
      const cx = bx + 3;
      const lower = mesh(corrugated(6, 1.7), cor, cx, 2.4 + 0.85, sz * Z); lower.rotation.y = sz > 0 ? Math.PI : 0; shell.add(lower);
      const upper = mesh(corrugated(6, 2.0), cor, cx, 5.4 + 1.0, sz * Z); upper.rotation.y = sz > 0 ? Math.PI : 0; shell.add(upper);
      // Fensterband 4,1 … 5,4 m
      shell.add(mesh(G.box(5.9, 1.3, 0.012), lm('glas'), cx, 4.75, sz * (Z + 0.04)));
      for (let k = 0; k <= 4; k++) shell.add(mesh(G.box(0.06, 1.3, 0.1), lm('alu_blech'), bx + k * 1.5, 4.75, sz * (Z + 0.02)));
      shell.add(mesh(G.box(6, 0.08, 0.14), lm('alu_blech'), cx, 4.1, sz * (Z + 0.02)));
      shell.add(mesh(G.box(6, 0.08, 0.14), lm('alu_blech'), cx, 5.4, sz * (Z + 0.02)));
    }
  }
  for (const sx of [-1, 1]) {
    if (sx < 0) shell.add(mesh(G.box(0.25, 2.4, 2 * Z), wallM, sx * (X + 0.125), 1.2, 0));
    for (let bz = -Z; bz < Z; bz += 4) {
      if (sx > 0 && bz >= -2 && bz < 2) continue; // Tor
      const p = mesh(corrugated(4, H - 2.4), cor, sx * X, 2.4 + (H - 2.4) / 2, bz + 2); p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; shell.add(p);
    }
  }
  // Wandsockel rechts neben dem Tor
  shell.add(mesh(G.box(0.25, 2.4, 6), wallM, X + 0.125, 1.2, 5));
  // Sektionaltor 4 × 4,6 m an x = +X
  for (let k = 0; k < 8; k++) {
    shell.add(mesh(G.box(0.05, 0.56, 4.0), lmTint('lack_silber', '#8c9196'), X - 0.02, 0.29 + k * 0.575, 0));
    shell.add(mesh(G.box(0.06, 0.02, 4.0), lm('stahl_grau'), X - 0.04, 0.575 * (k + 1), 0));
  }
  shell.add(mesh(G.box(0.05, 0.9, 4.0), cor, X - 0.02, 5.1, 0));
  for (const z of [-2.05, 2.05]) shell.add(mesh(G.box(0.12, 5.0, 0.08), lm('stahl_verzinkt'), X - 0.1, 2.5, z));
  shell.add(mesh(G.box(0.25, 2.4, 6), wallM, X + 0.125, 1.2, -5));
  // Stützen HEB 300 mit Warnband
  for (let x = -X; x <= X; x += 6) for (const sz of [-1, 1]) {
    const cx = Math.max(-X + 0.15, Math.min(X - 0.15, x)), cz = sz * (Z - 0.15);
    shell.add(mesh(iBeam(0.3, 0.3, 0.011, 0.019, H), lm('stahl_grau'), cx, H / 2, cz));
    shell.add(mesh(G.box(0.32, 0.12, 0.31), lm('retro_band'), cx, 1.05, cz));
  }
  // Fachwerkbinder, Pfetten, Trapezdach, Lichtband
  for (let x = -X + 6; x <= X - 6; x += 6) { const t = truss(2 * Z - 0.3, 0.8, 12, 0.08, lm('stahl_grau')); t.rotation.y = Math.PI / 2; t.position.set(x, H - 0.85, 0); shell.add(t); }
  for (const z of [-6, -3, 3, 6]) shell.add(mesh(iBeam(0.16, 0.08, 0.005, 0.007, 2 * X), lm('stahl_grau'), 0, H, z, 0, 0, Math.PI / 2));
  for (const sz of [-1, 1]) for (let bx = -X; bx < X; bx += 6) {
    const r = mesh(trapezSheet(6, Z - 1.0), lm('stahl_verzinkt'), bx + 3, H + 0.09, sz * (1.0 + (Z - 1.0) / 2));
    r.rotation.x = -Math.PI / 2; r.rotation.z = 0; r.scale.y = -1;
    shell.add(r);
  }
  shell.add(mesh(G.box(2 * X, 0.02, 2.0), lm('glas'), 0, H + 0.12, 0));
  // Lüftungskanal (Wickelfalzrohr) mit Abhängungen
  shell.add(mesh(G.cyl(0.32, 0.32, 2 * X - 1, 36), lm('alu_blech'), 0, 6.0, 3.0, 0, 0, Math.PI / 2));
  for (let x = -X + 1.5; x < X; x += 3) { shell.add(rod([x, 6.32, 3.0], [x, H, 3.0], 0.008, lm('stahl_verzinkt'), 6)); shell.add(mesh(G.torus(0.33, 0.012, 6, 36), lm('stahl_verzinkt'), x, 6.0, 3.0, 0, Math.PI / 2, 0)); }
  // Hallenstrahler
  for (let x = -9; x <= 9; x += 6) for (const z of [-4.5, 0, 4.5]) {
    shell.add(rod([x, 6.6, z], [x, H - 0.85, z], 0.006, lm('stahl_verzinkt'), 6));
    shell.add(mesh(G.lathe([[0.06, 0], [0.24, -0.32], [0.26, -0.34], [0.06, -0.02]], 32), lm('alu_blech'), x, 6.6, z));
    shell.add(mesh(G.cyl(0.09, 0.11, 0.14, 20), lm('ral9005'), x, 6.67, z));
  }
  // Kabeltrasse an der Rückwand
  shell.add(mesh(G.box(2 * X - 1, 0.06, 0.3), lm('stahl_verzinkt'), 0, 3.6, -Z + 0.35));
  for (let x = -X + 1; x < X; x += 1.5) shell.add(mesh(G.box(0.04, 0.3, 0.32), lm('stahl_verzinkt'), x, 3.75, -Z + 0.35));
  bake(shell);
  world.content.add(shell);
  world.register(shell, { name: 'Halle', kind: 'gebäude', static: true, target: false });

  // ---------- Einrichtung ----------
  place(world, P.rack(3), -6.2, 0, -6.6, 0, { name: 'Hochregal', kind: 'regal', solid: true, blasKey: 'rack3' });
  place(world, P.forklift(), -3.4, 0, -3.2, Math.PI * 0.9, { name: 'Gabelstapler', kind: 'fahrzeug', solid: true });
  for (const [x, z, s] of [[1.2, -6.6, 11], [2.6, -6.6, 12], [1.2, -5.2, 13]]) place(world, P.palletLoad(3, s), x, 0, z, 0, { name: 'Palette mit Kartons', kind: 'palette', solid: true });
  place(world, P.pallet(), 4.0, 0, -6.6, 0, { name: 'Leere Europalette', kind: 'palette', blasKey: 'pallet' });
  place(world, P.pallet(), 4.0, 0.144, -6.6, 0.03, { name: 'Leere Europalette', kind: 'palette', blasKey: 'pallet' });
  place(world, P.pipeRack(9), 6.8, 0, 6.3, 0, { name: 'Rohrbrücke', kind: 'anlage', solid: true });
  place(world, P.pumpSkid(), 5.0, 0, 3.9, 0, { name: 'Pumpe mit Motor', kind: 'anlage', solid: true });
  place(world, P.cabinets(4), -11.5, 0, 1.6, Math.PI / 2, { name: 'Schaltschränke', kind: 'anlage', solid: true });
  place(world, P.workbench(), -8.6, 0, 7.2, Math.PI, { name: 'Werkbank', kind: 'möbel', solid: true });
  place(world, P.klt('kunststoff_blau'), -9.3, 0.9, 7.25, 0, { name: 'KLT-Behälter', kind: 'behälter', blasKey: 'klt_b' });
  place(world, P.klt('kunststoff_grau'), -9.3, 1.18, 7.25, 0, { name: 'KLT-Behälter', kind: 'behälter', blasKey: 'klt_g' });
  place(world, P.fence(6), 6.5, 0, -1.2, 0, { name: 'Schutzzaun', kind: 'zaun', solid: true });
  place(world, P.fence(3.2), 9.5, 0, -2.8, Math.PI / 2, { name: 'Schutzzaun', kind: 'zaun', solid: true });
  for (const [x, z, k] of [[9.8, -6.9, 'stahl'], [10.45, -6.9, 'stahl'], [9.8, -6.25, 'blau'], [10.45, -6.25, 'weiss']]) place(world, P.barrel(k), x, 0, z, 0, { name: k === 'stahl' ? 'Stahlfass 200 l' : 'Kunststofffass', kind: 'behälter', solid: true });
  for (let k = 0; k < 4; k++) place(world, P.gasCylinder(['#7a7f86', '#3a6ea5', '#2e8b57', '#8d8d8d'][k]), 11.3, 0, -4.8 + k * 0.3, 0, { name: 'Gasflasche', kind: 'behälter' });
  place(world, P.ladder(3.2), -11.55, 0, -3.0, Math.PI / 2, { name: 'Leiter', kind: 'werkzeug' });
  place(world, P.extinguisher(), -6.0, 0.5, -7.62, 0, { name: 'Feuerlöscher', kind: 'sicherheit' });
  place(world, P.convexMirror(0.3, 2.4), 2.0, 0, 1.85, -Math.PI * 0.75, { name: 'Verkehrsspiegel (konvex)', kind: 'spiegel' });
  place(world, P.person('arbeit', 0.15), 1.2, 0, 3.3, -0.6, { name: 'Person mit Warnweste', kind: 'person' });
  place(world, P.checkerTarget(), 3.4, 0, 0.9, -Math.PI / 2 + 0.3, { name: 'Schachbrett-Zielmarke', kind: 'prüfmittel' });
  for (const [x, z] of [[2.8, 2.6], [-2.4, 2.9], [-0.6, -2.7]]) place(world, P.sphereTarget(1.1), x, 0, z, 0, { name: 'Referenzkugel Ø 145 mm', kind: 'prüfmittel', blasKey: 'sphere' });
  place(world, P.reflectanceBoard(), 8.2, 0, 0.4, -Math.PI / 2, { name: 'Reflektivitätstafel 5/10/50/90 %', kind: 'prüfmittel' });
  // Glasscheibe (Trennwand Meisterbüro) und Spiegel – typische LiDAR-Fallen
  const office = new THREE.Group();
  office.add(mesh(G.box(3.0, 2.6, 0.1), lm('gipskarton'), 0, 1.3, -1.25));
  office.add(mesh(G.box(0.1, 2.6, 2.5), lm('gipskarton'), -1.5, 1.3, 0));
  office.add(mesh(G.box(0.08, 0.9, 2.5), lm('gipskarton'), 1.5, 0.45, 0));
  office.add(mesh(G.box(0.02, 1.6, 2.4), lm('glas'), 1.5, 1.7, 0));
  office.add(mesh(G.box(0.06, 0.06, 2.5), lm('alu_blech'), 1.5, 2.55, 0));
  office.add(mesh(G.box(3.0, 0.08, 2.5), lm('gipskarton'), 0, 2.64, 0));
  office.add(mesh(G.box(1.4, 0.75, 0.7), lm('holz_hell'), -0.4, 0.375, 0.2));
  office.add(mesh(G.box(0.5, 0.95, 0.5), lm('textil_dunkel'), -0.4, 0.47, 0.85));
  office.add(mesh(G.box(0.55, 0.35, 0.04), lm('bildschirm'), -0.4, 0.98, 0.0));
  bake(office);
  place(world, office, -6.2, 0, 2.4, 0, { name: 'Meisterbüro mit Glaswand', kind: 'gebäude', static: true });
  const mir = new THREE.Group();
  mir.add(mesh(G.box(1.2, 1.8, 0.02), lm('spiegel'), 0, 1.3, 0.01));
  mir.add(mesh(G.box(1.26, 1.86, 0.03), lm('alu_blech'), 0, 1.3, -0.01));
  place(world, mir, -11.85, 0, 5.6, Math.PI / 2, { name: 'Wandspiegel', kind: 'spiegel', static: true });
}

/* ======================= Registrierung ======================= */

export const SCENES = {
  halle: {
    id: 'halle', name: 'Werkhalle', sub: 'Industrie · 24 × 16 × 7,5 m', lighting: 'indoor', bg: '#1b1f24',
    desc: 'Stahlbau, Wellblech, Regale, Rohrbrücke, Stapler, Glaswand und Spiegel – plus Prüfmittel.',
    build: buildHalle,
    start: { scanner: [0, 0, 0.2], cam: { target: [-1, 1.0, 0], dist: 9.5, yaw: 1.4, pitch: 0.5 } },
  },
};
