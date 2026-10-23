// Modellbildung im Verarbeitungs-Worker (wie Polycam: „Objekt“ und „Raum“).
// meshPost: Netz aus der TSDF aufräumen (schwebende Kleinteile entfernen) und glätten (Taubin, volumenerhaltend).
// roomModel: rechtwinkliger Raum aus einem Innenraumscan – Boden, Decke, Hauptrichtung, Wandlinien, Grundriss über
// Freiraum entlang der Laserstrahlen, Türen und Fenster dort, wo Strahlen die Wandebene durchquert haben.

/* ---------------- Netz aufräumen und glätten ---------------- */
// pos Float32 (xyz), rgb Float32 (0…255, optional), index Uint32
// o: { minPart: Anteil der Dreiecke, ab dem ein Teil bleibt (0.02), smooth: Durchgänge (0 = aus), lambda, mu }
export function meshPost(pos, rgb, index, o = {}) {
  const nv = pos.length / 3, nt = index.length / 3;
  // zusammenhängende Teile (Union-Find über die Dreiecke)
  const par = new Int32Array(nv);
  for (let i = 0; i < nv; i++) par[i] = i;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < nt; t++) { unite(index[t * 3], index[t * 3 + 1]); unite(index[t * 3], index[t * 3 + 2]); }
  const triCount = new Map();
  for (let t = 0; t < nt; t++) { const r = find(index[t * 3]); triCount.set(r, (triCount.get(r) || 0) + 1); }
  let biggest = 0;
  for (const c of triCount.values()) biggest = Math.max(biggest, c);
  const minTris = Math.max(o.minTris ?? 24, Math.floor((o.minPart ?? 0.02) * nt), o.largest ? biggest : 0);
  const keepT = new Uint8Array(nt);
  let kept = 0, parts = 0, dropped = 0;
  for (const c of triCount.values()) if (c >= minTris) parts++; else dropped++;
  for (let t = 0; t < nt; t++) if (triCount.get(find(index[t * 3])) >= minTris) { keepT[t] = 1; kept++; }
  // Eckpunkte neu nummerieren
  const remap = new Int32Array(nv).fill(-1);
  let m = 0;
  for (let t = 0; t < nt; t++) if (keepT[t]) for (let k = 0; k < 3; k++) { const v = index[t * 3 + k]; if (remap[v] < 0) remap[v] = m++; }
  const P = new Float32Array(m * 3), C = rgb ? new Float32Array(m * 3) : null, I = new Uint32Array(kept * 3);
  for (let v = 0; v < nv; v++) {
    const w = remap[v];
    if (w < 0) continue;
    P[w * 3] = pos[v * 3]; P[w * 3 + 1] = pos[v * 3 + 1]; P[w * 3 + 2] = pos[v * 3 + 2];
    if (C) { C[w * 3] = rgb[v * 3]; C[w * 3 + 1] = rgb[v * 3 + 1]; C[w * 3 + 2] = rgb[v * 3 + 2]; }
  }
  let q = 0;
  for (let t = 0; t < nt; t++) if (keepT[t]) { I[q++] = remap[index[t * 3]]; I[q++] = remap[index[t * 3 + 1]]; I[q++] = remap[index[t * 3 + 2]]; }
  if (o.smooth > 0 && m) taubin(P, C, I, o.smooth, o.lambda ?? 0.5, o.mu ?? -0.53);
  return { pos: P, rgb: C || new Float32Array(0), index: I, parts, dropped, removedTris: nt - kept };
}

// Taubin-Glättung: abwechselnd glätten (λ) und aufblähen (μ) – rundet ab, ohne zu schrumpfen.
// Nachbarn als CSR aus den Dreieckskanten (Kanten innerer Flächen zählen doppelt, das stört nicht).
function taubin(P, C, I, iters, lambda, mu) {
  const nv = P.length / 3, nt = I.length / 3;
  const deg = new Int32Array(nv + 1);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) deg[I[t * 3 + k] + 1] += 2;
  for (let i = 0; i < nv; i++) deg[i + 1] += deg[i];
  const nb = new Int32Array(deg[nv]), fill = deg.slice(0, nv);
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    nb[fill[a]++] = b; nb[fill[a]++] = c; nb[fill[b]++] = a; nb[fill[b]++] = c; nb[fill[c]++] = a; nb[fill[c]++] = b;
  }
  const T = new Float32Array(P.length);
  const pass = (f, arr) => {
    for (let i = 0; i < nv; i++) {
      const s = deg[i], e = deg[i + 1];
      if (e === s) { T[i * 3] = arr[i * 3]; T[i * 3 + 1] = arr[i * 3 + 1]; T[i * 3 + 2] = arr[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (let k = s; k < e; k++) { const j = nb[k] * 3; x += arr[j]; y += arr[j + 1]; z += arr[j + 2]; }
      const inv = 1 / (e - s);
      T[i * 3] = arr[i * 3] + f * (x * inv - arr[i * 3]);
      T[i * 3 + 1] = arr[i * 3 + 1] + f * (y * inv - arr[i * 3 + 1]);
      T[i * 3 + 2] = arr[i * 3 + 2] + f * (z * inv - arr[i * 3 + 2]);
    }
    arr.set(T);
  };
  for (let it = 0; it < iters; it++) { pass(lambda, P); pass(mu, P); }
  // Farben nur leicht angleichen (Rauschen der Reflektivität), Kanten bleiben erkennbar
  if (C && C.length) pass(0.5, C);
}

/* ---------------- Raum ---------------- */
// pos: Punkte (Welt, y nach oben), oIndex: Ursprung je Punkt, origins: Scannerpositionen (xyz)
export function roomModel(pos, oIndex, origins, o = {}) {
  const n = pos.length / 3;
  if (n < 2000) return { error: 'Zu wenige Punkte für ein Raummodell.' };
  const cell = o.cell || 0.05;
  const step = Math.max(1, Math.floor(n / (o.maxPoints || 400000)));
  const ox = (p) => origins[oIndex[p] * 3], oy = (p) => origins[oIndex[p] * 3 + 1], oz = (p) => origins[oIndex[p] * 3 + 2];

  // 1. Boden und Decke aus dem Höhenhistogramm (2 cm)
  let ymin = Infinity, ymax = -Infinity;
  for (let p = 0; p < n; p += step) { const y = pos[p * 3 + 1]; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  const HB = 0.02, nb = Math.max(2, Math.ceil((ymax - ymin) / HB) + 1), hist = new Float64Array(nb);
  for (let p = 0; p < n; p += step) hist[Math.floor((pos[p * 3 + 1] - ymin) / HB)]++;
  const peak = (lo, hi) => { let b = -1, best = 0; for (let i = Math.max(0, lo); i < Math.min(nb, hi); i++) { const v = hist[i] + (hist[i - 1] || 0) * 0.5 + (hist[i + 1] || 0) * 0.5; if (v > best) { best = v; b = i; } } return [b, best]; };
  const refine = (b) => { let s = 0, w = 0; const c = ymin + (b + 0.5) * HB; for (let p = 0; p < n; p += step) { const y = pos[p * 3 + 1]; if (Math.abs(y - c) < 0.035) { s += y; w++; } } return w ? s / w : c; };
  const [fb, fv] = peak(0, Math.ceil(nb * 0.5));
  if (fb < 0) return { error: 'Kein Boden gefunden.' };
  const floor = refine(fb);
  const [cb, cv] = peak(Math.ceil((floor + 1.9 - ymin) / HB), nb);
  const ceiling = cb >= 0 && cv > fv * 0.08 ? refine(cb) : null;
  const top = ceiling ?? Math.min(ymax, floor + 2.6);
  if (top - floor < 1.6) return { error: 'Kein Innenraum erkannt (zu niedrig).' };

  // 2. Wandschnitt weit oben: über Möbeln, unter der Decke
  const s0 = Math.max(floor + 1.5, top - 0.8), s1 = top - (ceiling ? 0.12 : 0.05);
  const sl = [];
  for (let p = 0; p < n; p += step) { const y = pos[p * 3 + 1]; if (y > s0 && y < s1) sl.push(p); }
  if (sl.length < 500) return { error: 'Zu wenige Wandpunkte – Wände im oberen Bereich scannen.' };

  // 3. Hauptrichtung (rechtwinklige Wände): Winkel, bei dem die Projektion auf beide Achsen am schärfsten ist
  let cx = 0, cz = 0;
  for (const p of sl) { cx += pos[p * 3]; cz += pos[p * 3 + 2]; }
  cx /= sl.length; cz /= sl.length;
  let R = 0;
  for (const p of sl) R = Math.max(R, Math.hypot(pos[p * 3] - cx, pos[p * 3 + 2] - cz));
  const OB = 0.04, nob = Math.ceil((2 * R) / OB) + 2, hu = new Float64Array(nob), hv = new Float64Array(nob);
  const sub = sl.length > 40000 ? sl.filter((_, k) => k % Math.ceil(sl.length / 40000) === 0) : sl;
  const score = (th) => {
    const c = Math.cos(th), s = Math.sin(th);
    hu.fill(0); hv.fill(0);
    for (const p of sub) {
      const x = pos[p * 3] - cx, z = pos[p * 3 + 2] - cz;
      hu[Math.floor((c * x + s * z + R) / OB)]++; hv[Math.floor((-s * x + c * z + R) / OB)]++;
    }
    let e = 0;
    for (let i = 0; i < nob; i++) e += hu[i] * hu[i] + hv[i] * hv[i];
    return e;
  };
  let th = 0, best = -1;
  for (let d = 0; d < 90; d++) { const e = score(d * Math.PI / 180); if (e > best) { best = e; th = d * Math.PI / 180; } }
  const th0 = th;
  for (let d = -10; d <= 10; d++) { const t2 = th0 + d * 0.1 * Math.PI / 180; const e = score(t2); if (e > best) { best = e; th = t2; } }
  const C = Math.cos(th), S = Math.sin(th);
  const toU = (x, z) => C * x + S * z, toV = (x, z) => -S * x + C * z;
  const toX = (u, v) => C * u - S * v, toZ = (u, v) => S * u + C * v;

  // 4. Raster im gedrehten System: Belegung (Wandpunkte) und Freiraum (Strahlen bis kurz vor den Treffer)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of sl) {
    const u = toU(pos[p * 3], pos[p * 3 + 2]), v = toV(pos[p * 3], pos[p * 3 + 2]);
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  u0 -= 0.5; v0 -= 0.5; u1 += 0.5; v1 += 0.5;
  const W = Math.ceil((u1 - u0) / cell), H = Math.ceil((v1 - v0) / cell);
  if (W * H > 9e6) return { error: 'Scan zu ausgedehnt für das Raummodell (bitte auf einen Raum zuschneiden).' };
  const occ = new Uint16Array(W * H), free = new Uint8Array(W * H);
  const gi = (u) => Math.floor((u - u0) / cell), gj = (v) => Math.floor((v - v0) / cell);
  const rays = sl.length > 160000 ? Math.ceil(sl.length / 160000) : 1;
  for (let k = 0; k < sl.length; k++) {
    const p = sl[k];
    const pu = toU(pos[p * 3], pos[p * 3 + 2]), pv = toV(pos[p * 3], pos[p * 3 + 2]);
    const ii = gi(pu), jj = gj(pv);
    if (ii >= 0 && jj >= 0 && ii < W && jj < H) occ[jj * W + ii]++;
    if (k % rays) continue;
    // Strahl im Raster (Amanatides & Woo) vom Ursprung bis vor die Trefferzelle
    const qu = toU(ox(p), oz(p)), qv = toV(ox(p), oz(p));
    let ci = gi(qu), cj = gj(qv);
    const du = pu - qu, dv = pv - qv;
    const si = du > 0 ? 1 : -1, sj = dv > 0 ? 1 : -1;
    const tdu = du !== 0 ? Math.abs(cell / du) : Infinity, tdv = dv !== 0 ? Math.abs(cell / dv) : Infinity;
    let tu = du !== 0 ? ((si > 0 ? (u0 + (ci + 1) * cell) - qu : qu - (u0 + ci * cell)) / Math.abs(du)) : Infinity;
    let tv = dv !== 0 ? ((sj > 0 ? (v0 + (cj + 1) * cell) - qv : qv - (v0 + cj * cell)) / Math.abs(dv)) : Infinity;
    for (let guard = 0; guard < 4000; guard++) {
      if (ci === ii && cj === jj) break;
      if (ci >= 0 && cj >= 0 && ci < W && cj < H && free[cj * W + ci] < 255) free[cj * W + ci]++;
      if (tu < tv) { tu += tdu; ci += si; } else { tv += tdv; cj += sj; }
      if (Math.min(tu, tv) > 1) break;
    }
  }
  // Summentabelle des Freiraums (für Rechteckanteile in O(1))
  const SA = new Float64Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) {
    let row = 0;
    for (let i = 0; i < W; i++) { row += free[j * W + i] > 0 && occ[j * W + i] < 2 ? 1 : 0; SA[(j + 1) * (W + 1) + i + 1] = SA[j * (W + 1) + i + 1] + row; }
  }
  const freeIn = (ia, ib, ja, jb) => SA[jb * (W + 1) + ib] - SA[ja * (W + 1) + ib] - SA[jb * (W + 1) + ia] + SA[ja * (W + 1) + ia];

  // 5. Wandlinien: Spitzen der Belegung entlang u und v (Wandflächen sammeln viele Punkte auf einer Linie)
  const lines = (axis) => {
    const L = axis === 0 ? W : H, prof = new Float64Array(L);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const c = occ[j * W + i]; if (c) prof[axis === 0 ? i : j] += Math.min(c, 6); }
    let mx = 0;
    for (const v of prof) mx = Math.max(mx, v);
    const out = [], minSep = Math.round(0.25 / cell);
    const cand = [];
    for (let i = 1; i < L - 1; i++) if (prof[i] >= prof[i - 1] && prof[i] >= prof[i + 1] && prof[i] > mx * 0.12 && prof[i] > 12) cand.push([prof[i], i]);
    cand.sort((a, b) => b[0] - a[0]);
    for (const [, i] of cand) if (out.every((q) => Math.abs(q - i) >= minSep)) out.push(i);
    out.sort((a, b) => a - b);
    // genaue Lage: Mittel der Wandpunkte in ±6 cm um die Spitze
    return out.map((i) => {
      const c = (axis === 0 ? u0 : v0) + (i + 0.5) * cell;
      let s = 0, w = 0;
      for (const p of sl) { const t = axis === 0 ? toU(pos[p * 3], pos[p * 3 + 2]) : toV(pos[p * 3], pos[p * 3 + 2]); if (Math.abs(t - c) < 0.06) { s += t; w++; } }
      return { c: w ? s / w : c, i };
    });
  };
  const LU = lines(0), LV = lines(1);
  if (LU.length < 2 || LV.length < 2) return { error: 'Keine rechtwinkligen Wände gefunden.' };
  // Zellen der Anordnung (Rechtecke zwischen benachbarten Linien), Freiraumanteil je Rechteck
  const nu = LU.length - 1, nvv = LV.length - 1;
  const inR = new Uint8Array(nu * nvv);
  for (let a = 0; a < nu; a++) for (let b = 0; b < nvv; b++) {
    const ia = gi(LU[a].c) + 1, ib = gi(LU[a + 1].c), ja = gj(LV[b].c) + 1, jb = gj(LV[b + 1].c);
    if (ib <= ia || jb <= ja) continue;
    const frac = freeIn(ia, ib, ja, jb) / ((ib - ia) * (jb - ja));
    inR[b * nu + a] = frac > (o.minFree ?? 0.42) ? 1 : 0;
  }
  // Wandanteil einer Grenze zwischen zwei Rechtecken: belegte Rasterzellen entlang der Linie (±1 Zelle).
  // Oben im Raum laufen Wände über Tür- und Fensterstürze durch – dort wächst der Raum nicht hinaus.
  const support = (axis, c, lo, hi) => {
    const ic = axis === 0 ? gi(c) : gj(c);
    const k0 = (axis === 0 ? gj(lo) : gi(lo)) + 1, k1 = (axis === 0 ? gj(hi) : gi(hi)) - 1;
    let tot = 0, hit = 0;
    for (let k = k0; k <= k1; k++) {
      tot++;
      for (let d = -1; d <= 1; d++) {
        const a = ic + d;
        const idx = axis === 0 ? k * W + a : a * W + k;
        if (a >= 0 && (axis === 0 ? a < W && k >= 0 && k < H : a < H && k >= 0 && k < W) && occ[idx] > 0) { hit++; break; }
      }
    }
    return tot ? hit / tot : 1;
  };
  const passable = (a, b, a2, b2) => a2 !== a
    ? support(0, LU[Math.max(a, a2)].c, LV[b].c, LV[b + 1].c) < 0.5
    : support(1, LV[Math.max(b, b2)].c, LU[a].c, LU[a + 1].c) < 0.5;
  // zusammenhängend mit einem Scannerstandort (sonst größter Teil)
  const comp = new Int32Array(nu * nvv).fill(-1);
  let nc = 0;
  const sizes = [];
  for (let k = 0; k < nu * nvv; k++) {
    if (!inR[k] || comp[k] >= 0) continue;
    const st = [k]; comp[k] = nc; let area = 0;
    while (st.length) {
      const x = st.pop(), a = x % nu, b = (x / nu) | 0;
      area += (LU[a + 1].c - LU[a].c) * (LV[b + 1].c - LV[b].c);
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a2 = a + da, b2 = b + db;
        if (a2 < 0 || b2 < 0 || a2 >= nu || b2 >= nvv) continue;
        const y = b2 * nu + a2;
        if (inR[y] && comp[y] < 0 && passable(a, b, a2, b2)) { comp[y] = nc; st.push(y); }
      }
    }
    sizes.push(area); nc++;
  }
  if (!nc) return { error: 'Kein geschlossener Raum erkannt.' };
  const votes = new Float64Array(nc);
  const cellOf = (u, v) => { let a = -1, b = -1; for (let q = 0; q < nu; q++) if (u >= LU[q].c && u < LU[q + 1].c) a = q; for (let q = 0; q < nvv; q++) if (v >= LV[q].c && v < LV[q + 1].c) b = q; return a < 0 || b < 0 ? -1 : b * nu + a; };
  for (let k = 0; k < origins.length / 3; k++) { const c = cellOf(toU(origins[k * 3], origins[k * 3 + 2]), toV(origins[k * 3], origins[k * 3 + 2])); if (c >= 0 && comp[c] >= 0) votes[comp[c]]++; }
  let pick = 0;
  for (let k = 1; k < nc; k++) if (votes[k] > votes[pick] || (votes[k] === votes[pick] && sizes[k] > sizes[pick])) pick = k;
  const inside = (a, b) => a >= 0 && b >= 0 && a < nu && b < nvv && comp[b * nu + a] === pick;

  // 6. Umriss: Randkanten zwischen Innen- und Außenzellen, zu einer Schleife verkettet (gegen den Uhrzeigersinn in u/v)
  const edges = new Map(); // Start-Ecke (a,b) → [End-Ecke]
  const key = (a, b) => a * 4096 + b;
  const addE = (a0, b0, a1, b1) => { const k = key(a0, b0); if (!edges.has(k)) edges.set(k, []); edges.get(k).push([a1, b1]); };
  for (let b = 0; b < nvv; b++) for (let a = 0; a < nu; a++) {
    if (!inside(a, b)) continue;
    if (!inside(a, b - 1)) addE(a, b, a + 1, b);
    if (!inside(a + 1, b)) addE(a + 1, b, a + 1, b + 1);
    if (!inside(a, b + 1)) addE(a + 1, b + 1, a, b + 1);
    if (!inside(a - 1, b)) addE(a, b + 1, a, b);
  }
  const loops = [];
  while (edges.size) {
    const [k0, list] = edges.entries().next().value;
    let cur = [Math.floor(k0 / 4096), k0 % 4096];
    const loop = [];
    for (let guard = 0; guard < 100000; guard++) {
      const k = key(cur[0], cur[1]), L = edges.get(k);
      if (!L || !L.length) break;
      const nx = L.shift();
      if (!L.length) edges.delete(k);
      loop.push(cur);
      cur = nx;
      if (cur[0] === loop[0][0] && cur[1] === loop[0][1]) break;
    }
    if (loop.length >= 4) loops.push(loop);
    if (list === undefined) break;
  }
  const lw = (L) => { let s = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; s += (LU[p[0]].c * LV[q[1]].c - LU[q[0]].c * LV[p[1]].c); } return s / 2; };
  loops.sort((A, B) => Math.abs(lw(B)) - Math.abs(lw(A)));
  if (!loops.length) return { error: 'Umriss nicht bestimmbar.' };
  let loop = loops[0];
  // gerade Durchgänge zusammenfassen (nur Ecken behalten)
  const corner = (L) => L.filter((p, i) => { const a = L[(i - 1 + L.length) % L.length], b = L[(i + 1) % L.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
  loop = corner(loop);
  const polyUV = loop.map(([a, b]) => [LU[a].c, LV[b].c]);
  if (lw(loop) < 0) polyUV.reverse();

  // 7. Wände mit Türen und Fenstern: Strahlen, die die Wandebene von innen nach außen durchquert haben
  const pts = [];
  for (let p = 0; p < n; p += Math.max(1, Math.floor(n / 900000))) pts.push(p);
  // Tiefenkarten je Stationsscan (Richtung → nächster Rückläufer). Nur für Standorte mit vielen Punkten –
  // bei einer Bahn (Handscanner, Roboter) hat jeder Ursprung zu wenige Punkte für eine dichte Karte.
  const perOrigin = new Map();
  for (const p of pts) perOrigin.set(oIndex[p], (perOrigin.get(oIndex[p]) || 0) + 1);
  const maps = [];
  for (const [oi, cnt] of perOrigin) {
    if (cnt < 60000 || cnt < pts.length * 0.15) continue;
    const step = Math.sqrt(4 * Math.PI * 0.8 / cnt), B = Math.max(0.0026, step * 1.6);
    const NA = Math.ceil(2 * Math.PI / B), NE = Math.ceil(Math.PI / B);
    if (NA * NE > 6e6) continue;
    const D = new Float32Array(NA * NE).fill(Infinity), O = [origins[oi * 3], origins[oi * 3 + 1], origins[oi * 3 + 2]];
    for (const p of pts) {
      if (oIndex[p] !== oi) continue;
      const dx = pos[p * 3] - O[0], dy = pos[p * 3 + 1] - O[1], dz = pos[p * 3 + 2] - O[2], r = Math.hypot(dx, dy, dz);
      const k = Math.min(NE - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, dy / r))) + Math.PI / 2) / B)) * NA + Math.min(NA - 1, Math.floor((Math.atan2(dz, dx) + Math.PI) / B));
      if (r < D[k]) D[k] = r;
    }
    maps.push({ O, B, NA, NE, D });
  }
  const look = (M, x, y, z) => {
    const dx = x - M.O[0], dy = y - M.O[1], dz = z - M.O[2], r = Math.hypot(dx, dy, dz);
    const k = Math.min(M.NE - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, dy / r))) + Math.PI / 2) / M.B)) * M.NA + Math.min(M.NA - 1, Math.floor((Math.atan2(dz, dx) + Math.PI) / M.B));
    return [M.D[k], r];
  };
  const walls = [];
  const HC = 0.05;
  const nh = Math.max(1, Math.ceil((top - floor) / HC));
  for (let w = 0; w < polyUV.length; w++) {
    const A = polyUV[w], B = polyUV[(w + 1) % polyUV.length];
    const horiz = Math.abs(A[1] - B[1]) < 1e-6; // entlang u
    const c = horiz ? A[1] : A[0];
    const a0 = Math.min(horiz ? A[0] : A[1], horiz ? B[0] : B[1]), a1 = Math.max(horiz ? A[0] : A[1], horiz ? B[0] : B[1]);
    const len = a1 - a0;
    // Innenseite: Polygon gegen den Uhrzeigersinn → links der Laufrichtung
    const dirA = horiz ? Math.sign(B[0] - A[0]) : Math.sign(B[1] - A[1]);
    const inSign = horiz ? dirA : -dirA; // Vorzeichen (perp − c) auf der Innenseite
    const na = Math.max(1, Math.ceil(len / HC));
    const open = new Uint8Array(na * nh);
    // Abdeckung der Wandebene (10-cm-Zellen): jeder Punkt steht für die Fläche r²/cos θ (gleichmäßige Winkelschritte).
    // Glas liefert nur einen Bruchteil der Rückläufer einer Wand – deutlich weniger, aber nicht null (null = verdeckt).
    const nA2 = Math.ceil(na / 2), nH2 = Math.ceil(nh / 2), cov = new Float32Array(nA2 * nH2);
    for (const p of pts) {
      const pu = toU(pos[p * 3], pos[p * 3 + 2]), pv = toV(pos[p * 3], pos[p * 3 + 2]);
      const qu = toU(ox(p), oz(p)), qv = toV(ox(p), oz(p));
      const pp = horiz ? pv : pu, qp = horiz ? qv : qu;
      if (Math.abs(pp - c) < 0.06) {
        const along = horiz ? pu : pv, y = pos[p * 3 + 1];
        if (along > a0 && along < a1 && y > floor && y < top) {
          const r2 = (pu - qu) ** 2 + (pv - qv) ** 2 + (y - oy(p)) ** 2, cs = Math.max(0.15, Math.abs(qp - c) / Math.sqrt(r2));
          cov[Math.min(nH2 - 1, Math.floor((y - floor) / (2 * HC))) * nA2 + Math.min(nA2 - 1, Math.floor((along - a0) / (2 * HC)))] += r2 / cs;
        }
      }
      if (Math.sign(qp - c) !== inSign || Math.sign(pp - c) !== -inSign || Math.abs(pp - c) < 0.12) continue;
      const t = (c - qp) / (pp - qp);
      const along = horiz ? qu + t * (pu - qu) : qv + t * (pv - qv);
      if (along < a0 + 0.04 || along > a1 - 0.04) continue;
      const y = oy(p) + t * (pos[p * 3 + 1] - oy(p));
      if (y < floor || y > top) continue;
      open[Math.min(nh - 1, Math.floor((y - floor) / HC)) * na + Math.min(na - 1, Math.floor((along - a0) / HC))] = 1;
    }
    // Bezug: typische Abdeckung der Wand (oberes Quartil der gesehenen Zellen); „glasartig“ unter 25 % davon
    const seen = Array.from(cov).filter((x) => x > 0).sort((x, y) => x - y);
    if (seen.length > 20) {
      const ref = seen[Math.floor(seen.length * 0.75)];
      for (let j = 0; j < nH2; j++) for (let i = 0; i < nA2; i++) {
        const v = cov[j * nA2 + i];
        if (!(v > 0 && v < ref * 0.25)) continue;
        // nur innerhalb gesehener Wand (Nachbarn haben Abdeckung) – Ränder von Schatten zählen nicht
        let around = 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < nA2 && y < nH2 && cov[y * nA2 + x] > 0) around++; }
        if (around < 3) continue;
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = 2 * i + di, y = 2 * j + dj; if (x < na && y < nh) open[y * na + x] = 1; }
      }
    }
    // Tiefenkarte: kein Echo in Richtung der Wandzelle (Glas spiegelt weg, offener Himmel) oder Echo dahinter → offen;
    // Echo davor → nur verdeckt. Gilt nur, wenn die Karte die Wand dicht abdeckt (sonst wären Zeilenlücken „Fenster“).
    for (const M of maps) {
      const vote = new Int8Array(na * nh);
      let filled = 0, total = 0;
      for (let j = 0; j < nh; j++) for (let i = 0; i < na; i++) {
        const al = a0 + (i + 0.5) * HC, y = floor + (j + 0.5) * HC;
        const uu = horiz ? al : c, vv = horiz ? c : al;
        const [d, r] = look(M, toX(uu, vv), y, toZ(uu, vv));
        total++;
        if (d === Infinity) { vote[j * na + i] = 1; continue; }
        filled++;
        if (d > r + 0.12) vote[j * na + i] = 1;
        else if (d < r - 0.15) vote[j * na + i] = -1;
      }
      if (filled < total * 0.7) continue;
      for (let k = 0; k < vote.length; k++) if (vote[k] > 0) open[k] = 1;
    }
    const openings = findOpenings(open, na, nh, HC, a0, floor, top);
    // Weltkoordinaten der Wand
    const wa = horiz ? [a0, c] : [c, a0], wb = horiz ? [a1, c] : [c, a1];
    const ordered = dirA > 0;
    const P0 = ordered ? wa : wb, P1 = ordered ? wb : wa;
    walls.push({
      a: [toX(P0[0], P0[1]), toZ(P0[0], P0[1])], b: [toX(P1[0], P1[1]), toZ(P1[0], P1[1])], len,
      openings: openings.map((q) => ({ ...q, s0: ordered ? q.s0 - a0 : a1 - q.s1, s1: ordered ? q.s1 - a0 : a1 - q.s0 })),
    });
  }
  const poly = polyUV.map(([u, v]) => [toX(u, v), toZ(u, v)]);
  let area = 0, per = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); }
  area = Math.abs(area) / 2;
  return {
    floor, ceiling, top, height: top - floor, theta: th, poly, walls, area, perimeter: per, volume: area * (top - floor),
    stats: { slice: sl.length, linesU: LU.length, linesV: LV.length, cells: W * H },
  };
}

// offene Bereiche einer Wand: zusammenhängende Flächen im Raster (Spalten entlang der Wand × Höhe)
function findOpenings(open, na, nh, hc, a0, floor, top) {
  // kleine Lücken schließen (1 Zelle)
  const g = new Uint8Array(open.length);
  for (let j = 0; j < nh; j++) for (let i = 0; i < na; i++) {
    let any = 0;
    for (let dj = -1; dj <= 1 && !any; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < na && y < nh && open[y * na + x]) { any = 1; break; } }
    g[j * na + i] = any;
  }
  const seen = new Uint8Array(g.length), out = [];
  for (let k = 0; k < g.length; k++) {
    if (!g[k] || seen[k]) continue;
    const st = [k]; seen[k] = 1;
    let i0 = na, i1 = -1, j0 = nh, j1 = -1, cnt = 0;
    while (st.length) {
      const x = st.pop(), i = x % na, j = (x / na) | 0;
      // Ausdehnung nur aus echten Durchgangszellen (das Schließen verbindet nur)
      if (open[x]) { cnt++; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= na || b >= nh) continue;
        const y = b * na + a;
        if (g[y] && !seen[y]) { seen[y] = 1; st.push(y); }
      }
    }
    if (i1 < 0) continue;
    // Ausdehnung über dicht offene Spalten und Zeilen (ein schmaler Spalt mit breitem Rand ist keine Öffnung)
    const colOpen = (i) => { let c = 0; for (let j = j0; j <= j1; j++) c += open[j * na + i]; return c >= (j1 - j0 + 1) * 0.5; };
    let a = i0, b = i1;
    while (a <= b && !colOpen(a)) a++;
    while (b >= a && !colOpen(b)) b--;
    if (b < a) continue;
    i0 = a; i1 = b;
    const rowOpen = (j) => { let c = 0; for (let i = i0; i <= i1; i++) c += open[j * na + i]; return c >= (i1 - i0 + 1) * 0.5; };
    a = j0; b = j1;
    while (a <= b && !rowOpen(a)) a++;
    while (b >= a && !rowOpen(b)) b--;
    if (b < a) continue;
    j0 = a; j1 = b;
    let fill = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fill += open[j * na + i];
    const w = (i1 - i0 + 1) * hc, hh = (j1 - j0 + 1) * hc;
    if (w < 0.45 || hh < 0.45 || fill < (i1 - i0 + 1) * (j1 - j0 + 1) * 0.4) continue;
    const y0 = floor + j0 * hc, y1 = Math.min(top, floor + (j1 + 1) * hc);
    const door = y0 < floor + 0.2 && y1 - y0 > 1.5;
    if (door && w < 0.6) continue; // schmaler als jede Tür: Spalt in der Ecke
    out.push({ kind: door ? 'tür' : 'fenster', s0: a0 + i0 * hc, s1: a0 + (i1 + 1) * hc, y0: door ? floor : y0, y1 });
  }
  return out;
}
