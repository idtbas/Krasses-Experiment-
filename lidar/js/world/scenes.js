// Szenen: Werkhalle, Außengelände, Wohnung, Prüfstrecke, Messraum.
// Jede Szene baut ihren Inhalt in world.content auf und registriert scanbare Objekte.
import * as THREE from 'three';
import { lm, lmTint } from './lidarmat.js';
import { G, mesh, iBeam, corrugated, trapezSheet, truss, rod, bake } from './geo.js';
import * as P from './props_industry.js';
import * as O from './props_outdoor.js';
import * as H from './props_home.js';
import * as T from './props_test.js';
import { fbm } from './geo.js';

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

// Raumhülle aus nach innen zeigenden Flächen: von außen durchsichtig (Puppenhaus-Ansicht), für LiDAR beidseitig
function roomShell(group, X, Z, H, wallMat, ceilMat, skip = {}) {
  const pl = (w, h, mat, x, y, z, rx, ry) => { const m = mesh(G.plane(w, h), mat, x, y, z, rx, ry, 0); m.castShadow = false; group.add(m); return m; };
  pl(2 * X, 2 * Z, ceilMat, 0, H, 0, Math.PI / 2, 0);
  if (!skip.back) pl(2 * X, H, wallMat, 0, H / 2, -Z, 0, 0);
  if (!skip.front) pl(2 * X, H, wallMat, 0, H / 2, Z, 0, Math.PI);
  if (!skip.left) pl(2 * Z, H, wallMat, -X, H / 2, 0, 0, Math.PI / 2);
  if (!skip.right) pl(2 * Z, H, wallMat, X, H / 2, 0, 0, -Math.PI / 2);
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
  place(world, P.forklift(), -3.4, 0, -1.9, Math.PI * 0.9, { name: 'Gabelstapler', kind: 'fahrzeug', solid: true });
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
  place(world, P.person('arbeit', 0.15), -1.5, 0, -3.5, -0.88, { name: 'Person mit Warnweste', kind: 'person' });
  place(world, P.checkerTarget(), 3.4, 0, 0.9, -Math.PI / 2 + 0.3, { name: 'Schachbrett-Zielmarke', kind: 'prüfmittel' });
  for (const [x, z] of [[2.8, 2.6], [-2.4, 2.9], [0.4, -3.6]]) place(world, P.sphereTarget(1.1), x, 0, z, 0, { name: 'Referenzkugel Ø 145 mm', kind: 'prüfmittel', blasKey: 'sphere' });
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
  place(world, office, -6.2, 0, 2.4, 0, { name: 'Meisterbüro mit Glaswand', kind: 'gebäude', static: true, solid: true });
  const mir = new THREE.Group();
  mir.add(mesh(G.box(1.2, 1.8, 0.02), lm('spiegel'), 0, 1.3, 0.01));
  mir.add(mesh(G.box(1.26, 1.86, 0.03), lm('alu_blech'), 0, 1.3, -0.01));
  place(world, mir, -11.85, 0, 5.6, Math.PI / 2, { name: 'Wandspiegel', kind: 'spiegel', static: true });
}

/* ======================= Außengelände ======================= */

function terrain(w, d, seg, mat, amp, y0 = 0, mask = null) {
  const g = new THREE.PlaneGeometry(w, d, seg, Math.round(seg * d / w));
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const k = mask ? mask(x, z) : 1;
    p.setY(i, y0 + fbm(x * 0.35, 0, z * 0.35, 3) * amp * k + fbm(x * 3, 1, z * 3, 2) * amp * 0.25 * k);
  }
  g.computeVertexNormals();
  const m = mesh(g, mat);
  m.castShadow = false;
  return m;
}

// Fußgänger, der auf einer Strecke hin und her geht (Beine und Arme pendeln)
function walker(world, person, x0, x1, z, speed = 1.35, phase = 0) {
  const span = Math.abs(x1 - x0);
  world.animate((dt, t) => {
    const u = ((t * speed + phase) % (2 * span)) / span;
    const fwd = u < 1;
    const x = fwd ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * (u - 1);
    person.position.set(x, 0, z);
    person.rotation.y = (fwd ? 1 : -1) * Math.sign(x1 - x0) * Math.PI / 2;
    P.walkPose(person, t * speed * 5.4, 1);
  });
}

function buildAussen(world) {
  const c = world.content;
  const env = new THREE.Group();
  // Straße 7 m, Bordsteine, Gehwege, Rasen mit leichtem Relief
  env.add(mesh(G.box(70, 0.1, 7), lm('asphalt'), 0, -0.05, 0));
  for (const s of [-1, 1]) {
    env.add(mesh(G.box(70, 0.15, 0.16), lm('beton_hell'), 0, 0.075 - 0.02, s * 3.58));
    env.add(mesh(G.box(70, 0.12, 2.5), lm('pflaster'), 0, 0.06, s * 4.9));
  }
  env.add(terrain(70, 22, 140, lm('gras'), 0.06, 0.1, (x, z) => 1).translateZ(17.2));
  env.add(terrain(70, 22, 140, lm('gras'), 0.06, 0.1, () => 1).translateZ(-17.2));
  // Fahrbahnmarkierung: Leitlinie, Fußgängerüberweg, Haltelinie
  for (let x = -33; x < 33; x += 9) stripe(env, x, 0, x + 3, 0, 0.12, lm('markierung'));
  for (let k = 0; k < 7; k++) stripe(env, -6, -3 + k * 1.0, -2.5, -3 + k * 1.0, 0.5, lm('markierung'));
  stripe(env, 5.5, 0.1, 5.5, 3.4, 0.3, lm('markierung'));
  // Parkbucht
  for (let k = 0; k < 4; k++) stripe(env, 9 + k * 5.5, -3.4, 9 + k * 5.5, -1.3, 0.1, lm('markierung'));
  bake(env);
  c.add(env);
  world.register(env, { name: 'Straße und Gelände', kind: 'gelände', static: true, target: false });
  // Wohnhaus (Front zur Straße), Garten, Zaun
  place(world, O.house(12, 8, 2), 0, 0.1, 14.2, Math.PI, { name: 'Wohnhaus', kind: 'gebäude', static: true, solid: true });
  place(world, O.picketFence(14), 0, 0.12, 6.45, 0, { name: 'Gartenzaun', kind: 'zaun', static: true });
  place(world, O.tree(8.5, 2), -9, 0.1, 9, 0, { name: 'Laubbaum', kind: 'vegetation', static: true });
  place(world, O.tree(6.5, 7, { autumn: true, leaves: 12000 }), 12, 0.1, -9.5, 0, { name: 'Laubbaum (Herbst)', kind: 'vegetation', static: true });
  for (const [x, z, sz, sd] of [[-4.5, 9.4, 1.3, 3], [4.8, 9.6, 1.0, 5], [7.0, 9.2, 1.5, 8]]) place(world, O.bush(sz, sd), x, 0.1, z, 0, { name: 'Strauch', kind: 'vegetation', static: true });
  // Fahrzeuge
  place(world, O.car('lack_schwarz'), 11.8, 0, -2.2, 0, { name: 'Pkw schwarz (geparkt)', kind: 'fahrzeug', solid: true });
  place(world, O.car('lack_weiss'), 17.4, 0, -2.2, 0, { name: 'Pkw weiß (geparkt)', kind: 'fahrzeug', solid: true });
  const moving = O.car('lack_rot');
  place(world, moving, -30, 0, 1.75, 0, { name: 'Pkw rot (fährt)', kind: 'fahrzeug' });
  world.animate((dt, t) => { const x = -32 + ((t * 7.5) % 64); moving.position.x = x; });
  // Straßenmöblierung
  place(world, O.streetLamp(5.5), -7, 0.12, -5.6, Math.PI / 2, { name: 'Straßenleuchte', kind: 'mobiliar' });
  place(world, O.streetLamp(5.5), 14, 0.12, 5.6, -Math.PI / 2, { name: 'Straßenleuchte', kind: 'mobiliar' });
  place(world, O.sign('stop'), 5.0, 0.12, 4.0, Math.PI, { name: 'Stoppschild (Retrofolie)', kind: 'schild' });
  place(world, O.sign('parken'), 8.6, 0.12, -4.1, 0, { name: 'Parkplatzschild', kind: 'schild' });
  place(world, O.sign('vorfahrt'), -12, 0.12, -4.1, 0, { name: 'Vorfahrt gewähren', kind: 'schild' });
  place(world, O.sign('tempo30'), -15, 0.12, 4.1, Math.PI, { name: 'Tempo 30', kind: 'schild' });
  for (const x of [-2.2, -1.2, 2.0, 3.0]) place(world, O.bollard(), x, 0.12, 3.95, 0, { name: 'Poller', kind: 'mobiliar', blasKey: 'bollard' });
  place(world, O.bench(), -3.5, 0.12, -5.7, 0, { name: 'Sitzbank', kind: 'mobiliar' });
  place(world, O.trashBin(), -1.8, 0.12, -5.8, 0, { name: 'Papierkorb', kind: 'mobiliar' });
  place(world, O.bicycle(), 2.6, 0.12, 6.0, 0, { name: 'Fahrrad', kind: 'fahrzeug' });
  const walkerP = P.person('alltag');
  place(world, walkerP, -14, 0.12, 4.6, 0, { name: 'Fußgänger', kind: 'person' });
  walker(world, walkerP, -14, 14, 4.55, 1.35);
  const dark = P.person('dunkel');
  place(world, dark, 6, 0.12, -5.0, 0, { name: 'Person (dunkel gekleidet)', kind: 'person' });
  walker(world, dark, 6, -10, -5.0, 1.1, 3);
}

/* ======================= Wohnung ======================= */

function buildWohnung(world) {
  const X = 3.2, Z = 2.4, Hh = 2.6;
  const shell = new THREE.Group();
  shell.add(mesh(G.box(2 * X + 0.4, 0.1, 2 * Z + 0.4), lm('beton_hell'), 0, -0.05, 0));
  shell.add(mesh(G.box(2 * X, 0.012, 2 * Z), lm('parkett'), 0, 0.006, 0));
  // Decke, Rückwand und rechte Wand als Innenflächen; linke Wand mit Türöffnung; Fensterwand (z = +Z) aus Bauteilen
  roomShell(shell, X, Z, Hh, lm('gipskarton'), lm('gipskarton'), { front: true, left: true });
  const wl = (w, h, x, y, z) => { const m = mesh(G.plane(w, h), lm('gipskarton'), x, y, z, 0, Math.PI / 2, 0); m.castShadow = false; shell.add(m); };
  wl(2 * Z - 1.0, Hh, -X, Hh / 2, 0.5);
  wl(1.0, 0.5, -X, Hh - 0.25, -Z + 0.5);
  // Flur hinter der Tür
  shell.add(mesh(G.box(0.1, Hh, 2.0), lm('gipskarton'), -X - 1.4, Hh / 2, -Z + 0.5));
  const wins = [[-1.5, 1.3], [1.5, 1.3]];
  const wz = Z + 0.06;
  let x = -X;
  for (const [cx, w] of wins) { const a = cx - w / 2; shell.add(mesh(G.box(a - x, Hh, 0.12), lm('gipskarton'), (x + a) / 2, Hh / 2, wz)); x = cx + w / 2; }
  shell.add(mesh(G.box(X - x, Hh, 0.12), lm('gipskarton'), (x + X) / 2, Hh / 2, wz));
  for (const [cx, w] of wins) {
    shell.add(mesh(G.box(w, 0.85, 0.12), lm('gipskarton'), cx, 0.425, wz));
    shell.add(mesh(G.box(w, 0.35, 0.12), lm('gipskarton'), cx, Hh - 0.175, wz));
    shell.add(mesh(G.box(w - 0.1, 1.3, 0.008), lm('glas'), cx, 1.5, wz));
    for (const dx of [-w / 2 + 0.03, w / 2 - 0.03, 0]) shell.add(mesh(G.box(0.06, 1.4, 0.07), lm('kunststoff_weiss'), cx + dx, 1.5, wz));
    shell.add(mesh(G.box(w + 0.1, 0.03, 0.2), lm('kunststoff_weiss'), cx, 0.86, wz - 0.1));
  }
  // Außen: Balkongeländer und gegenüberliegende Fassade (durch das Fenster sichtbar)
  shell.add(mesh(G.box(8, 0.1, 1.6), lm('beton_hell'), 0, -0.05, Z + 0.9));
  for (let k = 0; k <= 50; k++) shell.add(mesh(G.box(0.015, 1.0, 0.015), lm('edelstahl'), -3.9 + k * 0.156, 0.5, Z + 1.65));
  shell.add(mesh(G.box(8, 6, 0.3), lm('ziegel'), 0, 0.5, Z + 14));
  // Sockelleiste
  shell.add(mesh(G.box(2 * X, 0.06, 0.015), lm('kunststoff_weiss'), 0, 0.03, -Z + 0.008));
  bake(shell);
  world.content.add(shell);
  world.register(shell, { name: 'Wohnraum', kind: 'gebäude', static: true, target: false });
  place(world, H.sofa(2.2), -0.6, 0, -1.75, 0, { name: 'Sofa', kind: 'möbel' });
  place(world, H.rug(), -0.6, 0, -0.6, 0, { name: 'Teppich', kind: 'möbel' });
  place(world, H.glassTable(), -0.6, 0, -0.65, 0, { name: 'Couchtisch (Glas)', kind: 'möbel' });
  place(world, H.armchair(), 1.25, 0, -1.2, -0.7, { name: 'Sessel', kind: 'möbel' });
  place(world, H.tvSideboard(), -0.6, 0, 2.05, Math.PI, { name: 'Fernseher auf Lowboard', kind: 'möbel' });
  place(world, H.bookshelf(1.6, 2.0), -3.0, 0, -0.9, Math.PI / 2, { name: 'Bücherregal', kind: 'möbel' });
  place(world, H.diningTable(), 2.1, 0, 0.9, Math.PI / 2, { name: 'Esstisch', kind: 'möbel' });
  for (const [cx, cz, r] of [[1.6, 0.4, Math.PI / 2], [1.6, 1.4, Math.PI / 2], [2.6, 0.4, -Math.PI / 2], [2.6, 1.4, -Math.PI / 2]]) place(world, H.chair(), cx, 0, cz, r, { name: 'Stuhl', kind: 'möbel', blasKey: 'chair' });
  place(world, H.floorLamp(), -2.2, 0, -2.0, 0, { name: 'Stehlampe', kind: 'möbel' });
  place(world, H.plant(), 2.75, 0, -1.9, 0, { name: 'Zimmerpflanze', kind: 'pflanze' });
  for (const cx of [-1.5, 1.5]) place(world, H.radiator(1.1), cx, 0, Z - 0.08, Math.PI, { name: 'Heizkörper', kind: 'möbel', blasKey: 'rad' });
  place(world, H.wardrobe(), 3.05 - 0.3, 0, -1.3 + 0.4, -Math.PI / 2, { name: 'Kleiderschrank mit Spiegel', kind: 'möbel' });
  place(world, H.pictureFrame(), 0.8, 1.6, -Z + 0.015, 0, { name: 'Bild (verglast)', kind: 'möbel' });
  place(world, H.ceilingLamp(), -0.6, Hh, -0.6, 0, { name: 'Deckenleuchte', kind: 'möbel' });
}

/* ======================= Prüfstrecke ======================= */

function buildPruef(world) {
  const env = new THREE.Group();
  env.add(mesh(G.box(24, 0.1, 230), lm('asphalt'), 0, -0.05, 105));
  env.add(terrain(120, 240, 120, lm('gras'), 0.08, -0.02, (x) => Math.min(1, Math.max(0, (Math.abs(x) - 12) / 2))).translateZ(105));
  for (let z = 0; z <= 210; z += 10) stripe(env, -11.8, z, -10.6, z, 0.12, lm('markierung'));
  stripe(env, 0, -1, 0, 212, 0.1, lm('markierung_gelb'));
  bake(env);
  world.content.add(env);
  world.register(env, { name: 'Prüfgelände', kind: 'gelände', static: true, target: false });
  // Reichweitentafeln 10 % | 90 % in einem Fächer, damit keine die andere verdeckt
  const dists = [5, 10, 20, 30, 40, 60, 80, 100, 120, 150, 180, 210];
  dists.forEach((d, i) => {
    const x = (i % 2 ? 1 : -1) * (1.2 + (i % 4) * 0.9);
    place(world, P.rangeTarget('kal10', 'kal90', d > 60 ? 1.5 : 1.0), x, 0, d, Math.PI, { name: `Zieltafel ${d} m (10 % | 90 %)`, kind: 'prüfmittel', info: String(d) });
  });
  place(world, P.reflectanceBoard(1.2, 1.0, 0.5), 3.2, 0, 8, Math.PI, { name: 'Reflektivitätstafel 5/10/50/90 % (8 m)', kind: 'prüfmittel' });
  place(world, T.rodForest(), -3.5, 0, 12, Math.PI, { name: 'Stangenwald Ø 2–50 mm (12 m)', kind: 'prüfmittel' });
  place(world, T.edgeTest(), 4.2, 0, 15, Math.PI, { name: 'Kantenprüfung (15 m)', kind: 'prüfmittel' });
  place(world, T.glassPane(), -4.5, 0, 18, Math.PI, { name: 'Glasscheibe (18 m)', kind: 'prüfmittel' });
  place(world, P.rangeTarget('kal50', 'kal90', 1.0), -4.5, 0, 19.6, Math.PI, { name: 'Tafel hinter Glas (19,6 m)', kind: 'prüfmittel' });
  place(world, T.retroPanel(), 5.5, 0, 50, Math.PI, { name: 'Retroreflektor (50 m)', kind: 'prüfmittel' });
  place(world, O.car('lack_schwarz'), -6.5, 0, 35, Math.PI / 2, { name: 'Pkw schwarz (35 m)', kind: 'fahrzeug' });
  place(world, P.person('dunkel'), 6.5, 0, 25, Math.PI, { name: 'Person dunkel (25 m)', kind: 'person' });
  place(world, P.person('arbeit'), 7.5, 0, 25, Math.PI, { name: 'Person Warnweste (25 m)', kind: 'person' });
  for (const d of [30, 60, 90]) place(world, P.pallet(), 9, 0, d, 0, { name: `Palette (${d} m)`, kind: 'hindernis', blasKey: 'pallet' });
}

/* ======================= Messraum mit Drehteller ======================= */

export const STUDIO_OBJECTS = {
  bust: ['Büste (Stein)', () => T.bust()],
  engine: ['Motorblock', () => T.engine()],
  vase: ['Vase (glasiert)', () => T.vase()],
  sculpture: ['Skulptur (Aluminium)', () => T.sculpture()],
  artifact: ['Stufen-Prüfkörper', () => T.stepArtifact()],
  chair: ['Stuhl', () => { const g = new THREE.Group(); const c = H.chair(); c.position.y = 0.2; g.add(c); g.add(mesh(G.cyl(0.38, 0.38, 0.2, 32), lm('beton_hell'), 0, 0.1, 0)); return g; }],
};

function buildMessraum(world, opts = {}) {
  const X = 4.5, Z = 3.5, Hh = 3.2;
  const shell = new THREE.Group();
  shell.add(mesh(G.box(2 * X, 0.1, 2 * Z), lm('epoxid'), 0, -0.05, 0));
  roomShell(shell, X, Z, Hh, lm('putz_grau'), lm('gipskarton'));
  for (let x = -X + 1; x < X; x += 2) { const m = mesh(G.plane(0.6, 0.6), lm('kunststoff_weiss'), x, Hh - 0.01, 0, Math.PI / 2, 0, 0); shell.add(m); }
  for (let k = 0; k < 6; k++) stripe(shell, -X + 0.3, -Z + 0.3 + k * 0.2, -X + 2.0, -Z + 0.3 + k * 0.2, 0.05, lm('markierung_gelb'));
  bake(shell);
  world.content.add(shell);
  world.register(shell, { name: 'Messraum', kind: 'gebäude', static: true, target: false });
  // Drehteller mit Objekt
  const tt = P.turntable(0.8);
  place(world, tt, 0, 0, 0, 0, { name: 'Drehteller', kind: 'anlage', target: false, solid: true });
  const plate = tt.userData.plate;
  plate.userData.lidarBody = true;
  const key = opts.object || 'bust';
  const objG = STUDIO_OBJECTS[key][1]();
  objG.position.y = -0.9 + 0.025; // Sockel verschwindet im Drehteller, das Objekt steht auf der Platte
  const holder = new THREE.Group(); holder.add(objG);
  plate.add(holder);
  world.register(holder, { name: STUDIO_OBJECTS[key][0], kind: 'messobjekt', movable: false });
  world.turntable = { plate, speed: 0, angle: 0 };
  world.animate((dt) => { const T2 = world.turntable; if (T2.speed) { T2.angle += T2.speed * dt; plate.rotation.y = T2.angle; } });
  place(world, P.sphereTarget(1.0), 2.6, 0, -2.2, 0, { name: 'Referenzkugel', kind: 'prüfmittel', blasKey: 'sphere' });
  place(world, P.sphereTarget(1.4), -2.8, 0, 1.8, 0, { name: 'Referenzkugel', kind: 'prüfmittel', blasKey: 'sphere' });
  place(world, P.checkerTarget(), -3.6, 0, -2.4, 0.6, { name: 'Schachbrett-Zielmarke', kind: 'prüfmittel' });
  place(world, P.workbench(), 3.2, 0, 2.9, Math.PI, { name: 'Werkbank', kind: 'möbel', solid: true });
}

/* ======================= Registrierung ======================= */

export const SCENES = {
  halle: {
    id: 'halle', name: 'Werkhalle', sub: 'Industrie · 24 × 16 × 7,5 m', lighting: 'indoor', bg: '#1b1f24',
    desc: 'Stahlbau, Wellblech, Regale, Rohrbrücke, Stapler, Glaswand und Spiegel – plus Prüfmittel.',
    build: buildHalle, bounds: [-11.75, 11.75, -7.7, 7.7],
    start: { scanner: [0, 0, 0.2], cam: { target: [-1, 1.0, 0], dist: 9.5, yaw: 1.4, pitch: 0.5 }, player: [0.8, 2.3, -2.76], station: [0.7, 6.55, Math.PI] },
    park: { rover: [-2.1, 5.9, Math.PI], drohne: [-4.3, 5.3, 0] },
  },
  aussen: {
    id: 'aussen', name: 'Außengelände', sub: 'Straße · Wohnhaus · Bäume', lighting: 'outdoor', light: { sunAz: 2.4, sunEl: 0.8, shadowSize: 30 },
    desc: 'Sonne, Wetter und Nacht. Bäume mit Mehrfachechos, Fenster, schwarzer Lack, Retroschilder, Fußgänger und Verkehr.',
    build: buildAussen, bounds: [-34, 34, -27, 27],
    start: { scanner: [-1, 0, -4.7, 0], cam: { target: [0, 1.5, 2], dist: 22, yaw: -2.6, pitch: 0.42 }, player: [-2.6, -5.6, 0.5], station: [-9.6, -5.2, 0] },
    park: { rover: [-12.2, -4.6, Math.PI / 2], drohne: [-5.2, -8.4, 0] },
  },
  wohnung: {
    id: 'wohnung', name: 'Wohnung', sub: 'Innenraum · 6,4 × 4,8 m', lighting: 'indoor', bg: '#20242a',
    desc: 'Möbel, Bücherregal, Glastisch, Fernseher (schwarzer Hochglanz), Spiegelschrank – ideal für den Smartphone-Vergleich.',
    build: buildWohnung, bounds: [-3.15, 3.15, -2.35, 2.35],
    start: { scanner: [0.6, 0, 0.3], cam: { target: [0, 0.8, 0], dist: 7.5, yaw: Math.PI + 0.55, pitch: 0.72 }, player: [-1.4, 0.9, 1.9], station: [-2.55, 1.75, Math.PI / 2] },
    park: {},
  },
  pruef: {
    id: 'pruef', name: 'Prüfstrecke', sub: 'Reichweite · Auflösung · Kanten', lighting: 'outdoor', light: { sunAz: 0.4, sunEl: 0.9, shadowSize: 40 },
    desc: 'Zieltafeln mit 10 % und 90 % Reflektivität von 5 bis 210 m, Stangenwald, Kantenprüfung, Glas, Retroreflektor.',
    build: buildPruef, bounds: [-16, 16, -8, 216],
    start: { scanner: [0, 0, 0, 0], cam: { target: [0, 1, 18], dist: 26, yaw: Math.PI + 0.5, pitch: 0.35 }, player: [-1.2, -2.6, 0.3], station: [-3.6, -3.4, 0] },
    park: { rover: [3.0, -3.0, 0], drohne: [6.0, -3.2, 0] },
  },
  messraum: {
    id: 'messraum', name: 'Messraum', sub: 'Drehteller · Objekte', lighting: 'indoor', bg: '#23272c',
    desc: 'Objekt auf dem Drehteller: Büste, Motorblock, Vase, Skulptur, Prüfkörper. Mit Roboterarm und Fahrroboter scannbar.',
    build: buildMessraum, bounds: [-4.45, 4.45, -3.45, 3.45],
    start: { scanner: [-1.7, 0, 1.2, 2.2], cam: { target: [0, 1.0, 0], dist: 5.2, yaw: 0.6, pitch: 0.35 }, player: [-1.2, 2.6, 2.6], station: [2.0, 3.0, Math.PI] },
    park: { arm: true, rover: [-3.3, -0.6, Math.PI / 2] },
  },
};
