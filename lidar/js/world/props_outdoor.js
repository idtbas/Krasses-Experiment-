// Außenobjekte: Pkw, Bäume, Sträucher, Wohnhaus, Straßenmöblierung, Fahrrad. Maße in Metern.
import * as THREE from 'three';
import { lm, lmTint } from './lidarmat.js';
import { G, mesh, rod, pipe, fbm, displace, bake } from './geo.js';
import { wheel } from './props_industry.js';

/* ---------------- Pkw (Kombi, ≈ 4,7 × 1,8 × 1,47 m), Fahrtrichtung +x ---------------- */

export function car(paint = 'lack_weiss') {
  const g = new THREE.Group();
  const body = typeof paint === 'string' ? lm(paint) : paint;
  const L = 4.7, W = 1.8, wr = 0.33, wb = 2.8; // Radradius, Radstand
  const fx = wb / 2, rx = -wb / 2;
  // Seitenriss des Unterbaus mit Radausschnitten
  const s = new THREE.Shape();
  s.moveTo(-L / 2, 0.32);
  s.lineTo(rx - 0.46, 0.32);
  s.absarc(rx, wr, 0.41, Math.PI, 0, true);
  s.lineTo(fx - 0.41, 0.3);
  s.absarc(fx, wr, 0.41, Math.PI, 0, true);
  s.lineTo(L / 2, 0.32);
  s.bezierCurveTo(L / 2 + 0.06, 0.5, L / 2 + 0.03, 0.7, L / 2 - 0.08, 0.78);
  s.lineTo(1.05, 0.98); // Motorhaube
  s.lineTo(-L / 2 + 0.25, 1.0);
  s.bezierCurveTo(-L / 2 + 0.05, 0.98, -L / 2 - 0.02, 0.7, -L / 2, 0.32);
  const lower = new THREE.ExtrudeGeometry(s, { depth: W - 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 16 });
  lower.translate(0, 0, -(W - 0.12) / 2);
  g.add(mesh(lower, body));
  // Kabine: Glas mit Säulen und Dach
  const cab = new THREE.Shape();
  cab.moveTo(0.98, 1.0); cab.lineTo(0.15, 1.44); cab.lineTo(-1.75, 1.46); cab.lineTo(-2.25, 1.02); cab.lineTo(0.98, 1.0);
  const cabG = new THREE.ExtrudeGeometry(cab, { depth: W - 0.36, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 });
  cabG.translate(0, 0, -(W - 0.36) / 2);
  // Kabine nach oben einziehen (Tumblehome)
  const p = cabG.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 - (y - 1.0) * 0.3)); }
  cabG.computeVertexNormals();
  g.add(mesh(cabG, lm('glas_getoent')));
  // Dach und Säulen in Wagenfarbe
  g.add(mesh(G.rbox(1.85, 0.05, W - 0.5, 0.025), body, -0.8, 1.475, 0));
  for (const z of [-1, 1]) {
    const zz = z * (W - 0.43) / 2;
    const a = mesh(G.box(0.07, 0.52, 0.06), body, 0.58, 1.22, zz); a.rotation.z = 1.05; g.add(a);
    g.add(mesh(G.box(0.08, 0.46, 0.06), body, -0.62, 1.23, zz * 0.98));
    const c = mesh(G.box(0.12, 0.55, 0.06), body, -2.02, 1.22, zz * 0.96); c.rotation.z = -0.75; g.add(c);
    // Außenspiegel
    const mir = new THREE.Group(); mir.position.set(0.82, 1.06, z * (W / 2 + 0.06)); g.add(mir);
    mir.add(mesh(G.rbox(0.12, 0.1, 0.18, 0.03), body));
    mir.add(mesh(G.box(0.005, 0.08, 0.15), lm('spiegel'), -0.062, 0, 0));
    // Türgriffe und Schweller
    for (const x of [0.2, -0.9]) g.add(mesh(G.rbox(0.16, 0.03, 0.03, 0.01), lm('chrom'), x, 0.92, z * (W / 2 + 0.005)));
    g.add(mesh(G.box(2.0, 0.08, 0.04), lm('kunststoff_schwarz'), -0.05, 0.36, z * (W / 2 - 0.01)));
  }
  // Innenraum (durch die Scheiben sichtbar)
  for (const x of [0.0, -1.0]) for (const z of [-0.4, 0.4]) {
    g.add(mesh(G.rbox(0.5, 0.15, 0.5, 0.04), lm('textil_dunkel'), x, 0.72, z));
    g.add(mesh(G.rbox(0.12, 0.6, 0.5, 0.04), lm('textil_dunkel'), x - 0.3, 1.0, z));
  }
  g.add(mesh(G.rbox(0.4, 0.25, W - 0.4, 0.05), lm('kunststoff_schwarz'), 0.75, 0.9, 0));
  g.add(mesh(G.torus(0.18, 0.02, 6, 20), lm('kunststoff_schwarz'), 0.55, 1.05, 0.38, 0, Math.PI / 2 - 0.3, 0));
  // Stoßfänger, Kennzeichen, Leuchten
  g.add(mesh(G.rbox(0.14, 0.24, W - 0.05, 0.05), lm('kunststoff_schwarz'), L / 2 + 0.02, 0.42, 0));
  g.add(mesh(G.rbox(0.14, 0.24, W - 0.05, 0.05), lm('kunststoff_schwarz'), -L / 2 - 0.02, 0.45, 0));
  g.add(mesh(G.box(0.01, 0.11, 0.52), lm('kennzeichen'), L / 2 + 0.095, 0.45, 0));
  g.add(mesh(G.box(0.01, 0.11, 0.52), lm('kennzeichen'), -L / 2 - 0.095, 0.62, 0));
  for (const z of [-1, 1]) {
    const hl = mesh(G.rbox(0.08, 0.1, 0.32, 0.03), lm('glas'), L / 2 - 0.05, 0.7, z * 0.66); g.add(hl);
    g.add(mesh(G.cyl(0.04, 0.04, 0.05, 16), lm('chrom'), L / 2 - 0.07, 0.7, z * 0.62, 0, 0, Math.PI / 2));
    g.add(mesh(G.rbox(0.06, 0.12, 0.3, 0.02), lm('retro_rot'), -L / 2 + 0.01, 0.82, z * 0.68));
  }
  // Räder (Leichtmetall, 5 Speichen)
  for (const x of [fx, rx]) for (const z of [-1, 1]) {
    const wg = wheel(wr, 0.22, 'lack_silber');
    wg.rotation.y = Math.PI / 2;
    wg.position.set(x, wr, z * (W / 2 - 0.12));
    g.add(wg);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; g.add(mesh(G.box(0.03, wr * 0.95, 0.02), lm('lack_silber'), x + Math.cos(a) * wr * 0.32, wr + Math.sin(a) * wr * 0.32, z * (W / 2 - 0.01), 0, 0, a + Math.PI / 2)); }
    g.add(mesh(G.torus(0.42, 0.04, 6, 24, Math.PI), lm('kunststoff_schwarz'), x, wr, z * (W / 2 - 0.05), 0, 0, 0));
  }
  return bake(g);
}

/* ---------------- Bäume und Sträucher ---------------- */

let leafGeo = null;
function leafGeometry() {
  if (leafGeo) return leafGeo;
  // Blatt: leicht gewölbtes Viereck 7 × 4,5 cm
  const g = new THREE.PlaneGeometry(0.07, 0.045, 2, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.15);
  g.computeVertexNormals();
  leafGeo = g;
  return g;
}

export function tree(height = 8, seed = 1, opts = {}) {
  const g = new THREE.Group();
  let s = seed * 9973;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bark = lm('rinde');
  const trunkH = height * 0.42, r0 = height * 0.028;
  const tg = G.lathe([[r0 * 1.5, 0], [r0 * 1.1, 0.25], [r0, 0.7], [r0 * 0.75, trunkH], [r0 * 0.4, trunkH + 1.2], [0.01, trunkH + 1.6]], 20).clone();
  g.add(mesh(displace(tg, (x, y, z) => fbm(x * 9, y * 3, z * 9) * 0.02), bark));
  // Äste (zwei Ebenen) und Blattwolken an den Enden
  const ends = [];
  const branch = (o, dir, len, r, depth) => {
    const e = new THREE.Vector3().copy(o).addScaledVector(dir, len);
    const mid = new THREE.Vector3().lerpVectors(o, e, 0.5).add(new THREE.Vector3((rnd() - 0.5) * len * 0.15, rnd() * len * 0.1, (rnd() - 0.5) * len * 0.15));
    g.add(mesh(pipe([o.toArray(), mid.toArray(), e.toArray()], r, 8, 6), bark));
    if (depth > 0) {
      const n = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const d = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.3, rnd() * 0.5, (rnd() - 0.5) * 1.3)).normalize();
        branch(e, d, len * (0.55 + rnd() * 0.2), r * 0.55, depth - 1);
      }
    } else ends.push(e);
  };
  const nb = 5 + Math.floor(rnd() * 3);
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * Math.PI * 2 + rnd() * 0.5;
    const y = trunkH * (0.75 + rnd() * 0.35);
    const dir = new THREE.Vector3(Math.cos(a), 0.6 + rnd() * 0.5, Math.sin(a)).normalize();
    branch(new THREE.Vector3(0, y, 0), dir, height * (0.22 + rnd() * 0.08), r0 * 0.45, 2);
  }
  const leaves = opts.leaves ?? 18000;
  const im = new THREE.InstancedMesh(leafGeometry(), lm(opts.autumn ? 'laub_herbst' : 'laub'), leaves);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < leaves; i++) {
    const c = ends[Math.floor(rnd() * ends.length)];
    // Blattwolke um das Astende (Kugel mit dichterem Rand)
    const u = Math.pow(rnd(), 0.4), th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 2 - 1);
    const R = height * 0.12 * u;
    p.set(c.x + R * Math.sin(ph) * Math.cos(th), c.y + R * Math.cos(ph) * 0.8, c.z + R * Math.sin(ph) * Math.sin(th));
    e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    q.setFromEuler(e);
    const k = 0.7 + rnd() * 0.6;
    sc.set(k, k, k);
    m4.compose(p, q, sc);
    im.setMatrixAt(i, m4);
  }
  im.castShadow = true; im.receiveShadow = true;
  bake(g); // Stamm und alle Äste: ein Zeichenaufruf statt Dutzender
  g.add(im);
  return g;
}

export function bush(size = 1.2, seed = 3) {
  const g = new THREE.Group();
  let s = seed * 7919;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 6; k++) g.add(rod([0, 0, 0], [(rnd() - 0.5) * size * 0.8, size * (0.5 + rnd() * 0.4), (rnd() - 0.5) * size * 0.8], 0.012, lm('rinde'), 5));
  const n = Math.round(4000 * size * size);
  const im = new THREE.InstancedMesh(leafGeometry(), lm('laub'), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const u = Math.pow(rnd(), 0.35), th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 2 - 1);
    p.set(u * size * 0.55 * Math.sin(ph) * Math.cos(th), size * 0.5 + u * size * 0.45 * Math.cos(ph), u * size * 0.55 * Math.sin(ph) * Math.sin(th));
    if (p.y < 0.05) p.y = 0.05 + rnd() * 0.1;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    m4.compose(p, q, sc); im.setMatrixAt(i, m4);
  }
  im.castShadow = true;
  g.add(im);
  return g;
}

/* ---------------- Wohnhaus mit Fensteröffnungen (Blick in die Räume) ---------------- */

export function house(w = 12, d = 8, floors = 2) {
  const g = new THREE.Group();
  const fh = 2.9, H = floors * fh;
  const wall = lm('putz'), frame = lm('kunststoff_weiss'), glass = lm('glas');
  const t = 0.36;
  // Fassade vorn (z = +d/2) mit Fenstern; Öffnungsraster
  const cols = [-4.5, -1.5, 1.5, 4.5], winW = 1.3, winH = 1.45, sill = 0.95;
  const front = (zf, sgn) => {
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh;
      // waagerechte Streifen unter und über den Fenstern
      g.add(mesh(G.box(w, sill, t), wall, 0, y0 + sill / 2, zf));
      g.add(mesh(G.box(w, fh - sill - winH, t), wall, 0, y0 + sill + winH + (fh - sill - winH) / 2, zf));
      // Pfeiler zwischen den Fenstern
      const xs = [-w / 2, ...cols.flatMap((c) => [c - winW / 2, c + winW / 2]), w / 2];
      for (let k = 0; k < xs.length; k += 2) {
        const a = xs[k], b = xs[k + 1];
        if (b - a > 0.01) g.add(mesh(G.box(b - a, winH, t), wall, (a + b) / 2, y0 + sill + winH / 2, zf));
      }
      for (const c of cols) {
        const isDoor = f === 0 && c === 1.5 && sgn > 0;
        if (isDoor) continue;
        // Fensterrahmen, Kreuz, Glas, Fensterbank
        const fy = y0 + sill + winH / 2;
        for (const dx of [-winW / 2 + 0.03, winW / 2 - 0.03]) g.add(mesh(G.box(0.06, winH, 0.07), frame, c + dx, fy, zf + sgn * 0.08));
        for (const dy of [-winH / 2 + 0.03, winH / 2 - 0.03]) g.add(mesh(G.box(winW, 0.06, 0.07), frame, c, fy + dy, zf + sgn * 0.08));
        g.add(mesh(G.box(0.05, winH, 0.06), frame, c, fy, zf + sgn * 0.08));
        g.add(mesh(G.box(winW - 0.1, winH - 0.1, 0.008), glass, c, fy, zf + sgn * 0.08));
        g.add(mesh(G.box(winW + 0.08, 0.04, 0.22), lm('alu_blech'), c, y0 + sill - 0.02, zf + sgn * (t / 2 + 0.06)));
        // Rollladenkasten
        g.add(mesh(G.box(winW + 0.1, 0.2, 0.08), lm('kunststoff_grau'), c, y0 + sill + winH + 0.12, zf + sgn * 0.02));
      }
    }
  };
  front(d / 2, 1);
  front(-d / 2, -1);
  for (const sx of [-1, 1]) g.add(mesh(G.box(t, H, d), wall, sx * (w / 2 - t / 2), H / 2, 0));
  // Haustür, Stufen, Vordach
  g.add(mesh(G.box(1.05, 2.15, 0.06), lm('holz_dunkel'), 1.5, 0.32 + 1.075, d / 2 - 0.05));
  g.add(mesh(G.box(0.04, 0.3, 0.04), lm('edelstahl'), 1.88, 1.4, d / 2 + 0.02));
  for (let k = 0; k < 2; k++) g.add(mesh(G.box(1.8 - k * 0.3, 0.16, 0.6 - k * 0.25), lm('beton_hell'), 1.5, 0.08 + k * 0.16, d / 2 + 0.3 - k * 0.12));
  g.add(mesh(G.box(1.8, 0.06, 1.0), lm('glas'), 1.5, 2.75, d / 2 + 0.5));
  for (const x of [0.65, 2.35]) g.add(rod([x, 2.72, d / 2 + 0.95], [x, 2.72, d / 2], 0.012, lm('edelstahl'), 6));
  // Innenräume: Decken, Rückwände, Möblierung schemenhaft
  for (let f = 0; f < floors; f++) {
    g.add(mesh(G.box(w - 2 * t, 0.22, d - 2 * t), lm('beton_hell'), 0, f * fh + (f ? 0 : 0.11), 0));
    g.add(mesh(G.box(w - 2 * t, fh - 0.3, 0.12), lm('gipskarton'), 0, f * fh + fh / 2, 0.3));
    g.add(mesh(G.box(1.8, 0.8, 0.6), lm('holz_hell'), -4.2, f * fh + 0.62, d / 2 - 1.2));
    g.add(mesh(G.box(0.9, 1.9, 0.45), lm('holz_dunkel'), 4.4, f * fh + 1.17, d / 2 - 1.0));
  }
  g.add(mesh(G.box(w - 2 * t, 0.25, d - 2 * t), lm('beton_hell'), 0, H, 0));
  // Satteldach mit Ziegeln (Rippen) und Dachrinne
  const rh = 2.6, half = d / 2 + 0.5;
  const slope = Math.hypot(half, rh), ang = Math.atan2(rh, half);
  for (const sz of [-1, 1]) {
    const roof = mesh(G.box(w + 0.8, 0.06, slope), lmTint('ziegel', '#7c3a2a'), 0, H + rh / 2 + 0.15, sz * half / 2);
    roof.rotation.x = sz * ang;
    g.add(roof);
    for (let k = 0; k < 18; k++) {
      const u = (k + 0.5) / 18;
      const rib = mesh(G.box(w + 0.8, 0.05, 0.05), lmTint('ziegel', '#6e3325'), 0, H + 0.15 + rh * (1 - u) + 0.04, sz * half * u);
      g.add(rib);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, w + 0.8, 16, 1, true, 0, Math.PI), lm('alu_blech'), 0, H + 0.1, sz * (half + 0.05), 0, 0, Math.PI / 2));
  }
  for (const sx of [-1, 1]) {
    const gable = new THREE.Shape([new THREE.Vector2(-half + 0.5, 0), new THREE.Vector2(half - 0.5, 0), new THREE.Vector2(0, rh)]);
    const gg = new THREE.ExtrudeGeometry(gable, { depth: t, bevelEnabled: false });
    const gm = mesh(gg, wall, sx * (w / 2) - (sx > 0 ? t : 0), H + 0.12, 0);
    gm.rotation.y = Math.PI / 2;
    g.add(gm);
  }
  // Fallrohr
  g.add(mesh(G.cyl(0.05, 0.05, H + 0.2, 12), lm('alu_blech'), w / 2 - 0.25, (H + 0.2) / 2, d / 2 + 0.55));
  g.add(mesh(G.cyl(0.06, 0.06, 0.6, 12), lm('alu_blech'), w / 2 - 0.25, 0.3, d / 2 + 0.6));
  // Sockel (Klinker)
  g.add(mesh(G.box(w + 0.02, 0.4, d + 0.02), lm('ziegel'), 0, 0.2, 0));
  // Schornstein
  g.add(mesh(G.box(0.6, 1.4, 0.6), lm('ziegel'), -3, H + rh - 0.2, -0.8));
  // Balkon (Obergeschoss, mittig)
  const by = fh + 0.0;
  g.add(mesh(G.box(3.2, 0.18, 1.3), lm('beton_hell'), -1.5, by - 0.05, d / 2 + 0.65));
  for (let k = 0; k <= 26; k++) g.add(mesh(G.box(0.02, 1.0, 0.02), lm('edelstahl'), -3.05 + k * 0.12, by + 0.55, d / 2 + 1.26));
  g.add(mesh(G.box(3.2, 0.05, 0.05), lm('edelstahl'), -1.5, by + 1.05, d / 2 + 1.26));
  return g;
}

/* ---------------- Straßenmöblierung ---------------- */

export function streetLamp(h = 5.5) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.06, 0.09, h, 16), lm('ral7035'), 0, h / 2, 0));
  g.add(mesh(G.cyl(0.13, 0.15, 0.3, 16), lm('ral7035'), 0, 0.15, 0));
  g.add(mesh(pipe([[0, h - 0.2, 0], [0.4, h + 0.1, 0], [1.0, h + 0.15, 0]], 0.04, 12, 8), lm('ral7035')));
  g.add(mesh(G.rbox(0.55, 0.1, 0.25, 0.04), lm('ral7035'), 1.15, h + 0.1, 0));
  g.add(mesh(G.box(0.45, 0.01, 0.2), lm('glas'), 1.15, h + 0.045, 0));
  return g;
}

// Verkehrszeichen: 'stop' (Achteck), 'vorfahrt' (Dreieck), 'parken' (Quadrat), 'tempo30' (rund)
export function sign(kind = 'stop', h = 2.2) {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.03, 0.03, h + 0.35, 12), lm('stahl_verzinkt'), 0, (h + 0.35) / 2, 0));
  const plate = new THREE.Group(); plate.position.set(0, h, 0.04); g.add(plate);
  if (kind === 'stop') {
    const oct = G.cyl(0.32, 0.32, 0.01, 8); const m = mesh(oct, lm('retro_rot'), 0, 0, 0, Math.PI / 2, 0, Math.PI / 8); plate.add(m);
    plate.add(mesh(G.box(0.4, 0.09, 0.004), lm('retro_weiss'), 0, 0, 0.008));
  } else if (kind === 'vorfahrt') {
    const tri = new THREE.Shape([new THREE.Vector2(-0.45, 0.26), new THREE.Vector2(0.45, 0.26), new THREE.Vector2(0, -0.52)]);
    plate.add(mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.01, bevelEnabled: false }), lm('retro_rot')));
    const inn = new THREE.Shape([new THREE.Vector2(-0.3, 0.18), new THREE.Vector2(0.3, 0.18), new THREE.Vector2(0, -0.34)]);
    plate.add(mesh(new THREE.ExtrudeGeometry(inn, { depth: 0.004, bevelEnabled: false }), lm('retro_weiss'), 0, 0, 0.011));
  } else if (kind === 'parken') {
    plate.add(mesh(G.box(0.6, 0.6, 0.01), lm('retro_blau')));
    plate.add(mesh(G.box(0.08, 0.36, 0.004), lm('retro_weiss'), -0.06, 0, 0.008));
    plate.add(mesh(G.box(0.18, 0.06, 0.004), lm('retro_weiss'), 0.02, 0.15, 0.008));
    plate.add(mesh(G.box(0.18, 0.06, 0.004), lm('retro_weiss'), 0.02, 0.03, 0.008));
    plate.add(mesh(G.box(0.06, 0.16, 0.004), lm('retro_weiss'), 0.1, 0.09, 0.008));
  } else {
    plate.add(mesh(G.cyl(0.3, 0.3, 0.01, 40), lm('retro_rot'), 0, 0, 0, Math.PI / 2, 0, 0));
    plate.add(mesh(G.cyl(0.235, 0.235, 0.004, 40), lm('retro_weiss'), 0, 0, 0.008, Math.PI / 2, 0, 0));
  }
  g.add(mesh(G.box(0.12, 0.05, 0.05), lm('stahl_verzinkt'), 0, h, 0.01));
  return g;
}

export function bollard() {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.07, 0.07, 0.95, 20), lm('ral7035'), 0, 0.475, 0));
  for (const y of [0.72, 0.82]) g.add(mesh(G.cyl(0.072, 0.072, 0.05, 20), lm('retro_weiss'), 0, y, 0));
  g.add(mesh(G.sphere(0.07, 16, 8), lm('ral7035'), 0, 0.95, 0));
  return g;
}

export function bench() {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) g.add(mesh(G.rbox(1.8, 0.04, 0.09, 0.01), lm('holz_hell'), 0, 0.45, -0.18 + k * 0.11));
  for (let k = 0; k < 3; k++) { const b = mesh(G.rbox(1.8, 0.09, 0.035, 0.01), lm('holz_hell'), 0, 0.62 + k * 0.11, -0.26 - k * 0.025); b.rotation.x = -0.18; g.add(b); }
  for (const x of [-0.75, 0.75]) {
    g.add(mesh(G.box(0.05, 0.45, 0.05), lm('ral9005'), x, 0.225, 0.15));
    g.add(mesh(G.box(0.05, 0.85, 0.05), lm('ral9005'), x, 0.425, -0.22));
    g.add(mesh(G.box(0.05, 0.04, 0.45), lm('ral9005'), x, 0.43, -0.04));
  }
  return bake(g);
}

export function trashBin() {
  const g = new THREE.Group();
  g.add(mesh(G.cyl(0.24, 0.22, 0.85, 24), lm('ral6011'), 0, 0.5, 0));
  g.add(mesh(G.cyl(0.255, 0.255, 0.06, 24), lm('ral6011'), 0, 0.95, 0));
  g.add(mesh(G.cyl(0.05, 0.05, 1.0, 12), lm('ral7035'), 0, 0.5, -0.3));
  return g;
}

// Fahrrad: dünne Rohre und Speichen (2 mm) – Prüfstein für Auflösung und Strahldivergenz
export function bicycle() {
  const g = new THREE.Group();
  const fr = lm('lack_blau'), st = lm('edelstahl');
  const R = 0.34, wb = 1.05;
  const rear = [-wb / 2, R, 0], front = [wb / 2, R, 0];
  const bb = [-0.08, 0.3, 0], seat = [-0.22, 0.85, 0], head = [0.36, 0.82, 0], headLow = [0.39, 0.68, 0];
  for (const [a, b] of [[bb, seat], [bb, headLow], [seat, head], [seat, rear], [bb, rear], [headLow, front], [head, headLow]]) g.add(rod(a, b, 0.016, fr, 10));
  g.add(rod([head[0], head[1], 0], [0.33, 0.98, 0], 0.012, st));
  g.add(rod([0.33, 0.98, -0.28], [0.33, 0.98, 0.28], 0.011, st));
  g.add(rod([seat[0], seat[1], 0], [-0.24, 0.95, 0], 0.012, st));
  g.add(mesh(G.rbox(0.24, 0.05, 0.12, 0.02), lm('kunststoff_schwarz'), -0.25, 0.98, 0));
  for (const c of [rear, front]) {
    g.add(mesh(G.torus(R - 0.02, 0.018, 8, 48), lm('gummi'), c[0], c[1], c[2]));
    g.add(mesh(G.torus(R - 0.045, 0.008, 6, 48), st, c[0], c[1], c[2]));
    g.add(mesh(G.cyl(0.025, 0.025, 0.1, 12), st, c[0], c[1], 0, Math.PI / 2, 0, 0));
    for (let k = 0; k < 32; k++) { const a = k * Math.PI * 2 / 32; g.add(rod([c[0], c[1], (k % 2 ? 0.03 : -0.03)], [c[0] + Math.cos(a) * (R - 0.05), c[1] + Math.sin(a) * (R - 0.05), 0], 0.001, st, 4)); }
  }
  g.add(mesh(G.cyl(0.09, 0.09, 0.01, 20), st, bb[0], bb[1], 0.04, Math.PI / 2, 0, 0));
  bake(g);
  g.rotation.x = 0.04;
  return g;
}

// Holz-Gartenzaun
export function picketFence(len = 6) {
  const g = new THREE.Group();
  const m = lmTint('holz_hell', '#d8cbb5');
  for (let x = -len / 2; x <= len / 2; x += 0.12) g.add(mesh(G.box(0.08, 1.0, 0.02), m, x, 0.5, 0));
  for (const y of [0.25, 0.75]) g.add(mesh(G.box(len, 0.07, 0.03), m, 0, y, -0.025));
  for (let x = -len / 2; x <= len / 2; x += 2) g.add(mesh(G.box(0.08, 1.1, 0.08), m, x, 0.55, -0.06));
  return bake(g);
}

