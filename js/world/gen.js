/* KYTHERA · MANDAT · Weltgenerator
   Deterministisch aus einem Seed: Relief, Klima, Biome, Flüsse, Staaten, Städte, Verkehrsachsen. */
(function (root) {
  'use strict';
  const N = (typeof module !== 'undefined' && module.exports) ? require('./noise.js') : root.KY.noise;
  const NM = (typeof module !== 'undefined' && module.exports) ? require('./names.js') : root.KY.names;
  const { fbm, ridged } = N;

  const GW = 640, GH = 320;
  const CELL = 360 / GW;
  const B = { DEEP: 0, ICE: 2, TUNDRA: 3, TAIGA: 4, FOREST: 5, GRASS: 6, DESERT: 7, SAVANNA: 8, JUNGLE: 9, MEDIT: 10, ROCK: 11, SNOW: 12 };
  const BIOME_NAMES = { 2: 'Eisschild', 3: 'Tundra', 4: 'Borealer Wald', 5: 'Mischwald', 6: 'Steppe und Grasland', 7: 'Wüste', 8: 'Savanne', 9: 'Tropischer Regenwald', 10: 'Mediterrane Macchie', 11: 'Hochgebirge', 12: 'Gletscher' };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lonOf = i => -180 + (i + 0.5) * CELL;
  const latOf = j => 90 - (j + 0.5) * CELL;
  const tick = () => new Promise(res => (typeof setTimeout !== 'undefined' ? setTimeout(res, 0) : res()));
  const wrapD = d => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
  /* Nahtlose Ost-West-Wiederholung: nahe 180° wird mit dem Wert bei −180° überblendet */
  const SEAM = 34;
  const per = (fn, lon, lat) => {
    if (lon <= 180 - SEAM) return fn(lon, lat);
    const t = (lon - (180 - SEAM)) / SEAM, w = t * t * (3 - 2 * t);
    return fn(lon, lat) * (1 - w) + fn(lon - 360, lat) * w;
  };

  /* Binärer Heap für Dijkstra */
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v; const top = v[0], tk = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    this.lastKey = tk;
    return top;
  };
  Heap.prototype.size = function () { return this.k.length; };

  async function generate(seed, progress) {
    progress = progress || (() => {});
    const r = rng(seed);
    const S = seed % 100000;
    const n = GW * GH;
    progress(0.02, 'Kontinentalplatten werden angeordnet');

    /* ---------- Kontinente ---------- */
    const blobs = [];
    const conts = [];
    const nC = 5 + Math.floor(r() * 3);
    for (let c = 0; c < nC; c++) {
      let cx = 0, cy = 0;
      for (let t = 0; t < 60; t++) {
        cx = -150 + r() * 300; cy = clamp(gauss(r) * 26 + 8, -52, 60);
        if (conts.every(o => Math.hypot(o.x - cx, (o.y - cy) * 1.4) > 62)) break;
      }
      const s = 0.65 + r() * 0.75;
      const cont = { x: cx, y: cy, s, ridges: [] };
      conts.push(cont);
      const nb = 3 + Math.floor(r() * 4);
      for (let b = 0; b < nb; b++) {
        blobs.push({ x: cx + gauss(r) * 13 * s, y: cy + gauss(r) * 8 * s, rx: (8 + r() * 13) * s, ry: (6 + r() * 9) * s, rot: r() * Math.PI, w: 0.85 + r() * 0.3, c });
      }
      const nr = 1 + Math.floor(r() * 2.6);
      for (let k = 0; k < nr; k++) {
        const a = r() * Math.PI, len = (14 + r() * 26) * s;
        const mx = cx + gauss(r) * 8 * s, my = cy + gauss(r) * 5 * s;
        cont.ridges.push({ x1: mx - Math.cos(a) * len / 2, y1: my - Math.sin(a) * len / 2, x2: mx + Math.cos(a) * len / 2, y2: my + Math.sin(a) * len / 2, w: 2.4 + r() * 2.6, h: 0.6 + r() * 0.6 });
      }
    }
    const nI = 7 + Math.floor(r() * 6);
    for (let k = 0; k < nI; k++) {
      blobs.push({ x: -165 + r() * 330, y: clamp(gauss(r) * 25, -50, 62), rx: 1.5 + r() * 4, ry: 1.2 + r() * 3, rot: r() * Math.PI, w: 0.9 + r() * 0.2, c: -1 });
    }
    blobs.forEach(b => { b.cs = Math.cos(b.rot); b.sn = Math.sin(b.rot); });
    await tick();

    /* ---------- Höhenfeld ---------- */
    progress(0.08, 'Relief wird berechnet');
    const raw = new Float32Array(n);
    const contOf = new Int8Array(n);
    for (let j = 0; j < GH; j++) {
      const lat = latOf(j);
      for (let i = 0; i < GW; i++) {
        const lon = lonOf(i);
        let bc = -1;
        const field = (lo, la) => {
          const wl = lo + (fbm(lo / 30 + 7, la / 30 + 3, S + 1, 3) - 0.5) * 26;
          const wb = la + (fbm(lo / 30 + 11, la / 30 + 17, S + 2, 3) - 0.5) * 18;
          let v = 0, best = 0;
          for (let k = 0; k < blobs.length; k++) {
            const b = blobs[k];
            const dx = wrapD(wl - b.x), dy = wb - b.y;
            const u = (dx * b.cs + dy * b.sn) / b.rx, w = (-dx * b.sn + dy * b.cs) / b.ry;
            const e = u * u + w * w;
            if (e > 12) continue;
            const val = Math.exp(-e) * b.w;
            v += val;
            if (val > best) { best = val; bc = b.c; }
          }
          v += (fbm(lo / 16 + 100, la / 16 + 100, S + 3, 5) - 0.5) * 1.15;
          v += (fbm(lo / 5.5 + 50, la / 5.5 + 50, S + 4, 3) - 0.5) * 0.38;
          return v;
        };
        const idx = j * GW + i;
        raw[idx] = per(field, lon, lat);
        contOf[idx] = bc;
      }
      if (j % 40 === 0) { progress(0.08 + 0.22 * j / GH, 'Relief wird berechnet'); await tick(); }
    }
    // Schwelle so wählen, dass etwa 30 % Landfläche entstehen (ohne Polarzonen)
    const sample = [];
    for (let j = Math.floor(GH * 0.12); j < GH * 0.86; j += 2) for (let i = 0; i < GW; i += 2) sample.push(raw[j * GW + i]);
    sample.sort((a, b) => a - b);
    const landFrac = 0.29 + r() * 0.05;
    const thr = sample[Math.floor(sample.length * (1 - landFrac))];
    const maxR = sample[sample.length - 1], minR = sample[0];

    const elev = new Float32Array(n);
    for (let idx = 0; idx < n; idx++) {
      const v = raw[idx];
      if (v >= thr) elev[idx] = 20 + Math.pow((v - thr) / (maxR - thr), 1.35) * 1500;
      else elev[idx] = -Math.pow((thr - v) / (thr - minR), 0.7) * 5200 - 30;
    }
    // Gebirgszüge
    progress(0.32, 'Gebirge falten sich auf');
    await tick();
    for (const c of conts) {
      for (const rg of c.ridges) {
        const minX = Math.min(rg.x1, rg.x2) - rg.w * 3, maxX = Math.max(rg.x1, rg.x2) + rg.w * 3;
        const minY = Math.min(rg.y1, rg.y2) - rg.w * 3, maxY = Math.max(rg.y1, rg.y2) + rg.w * 3;
        const i0 = Math.floor((minX + 180) / CELL), i1 = Math.ceil((maxX + 180) / CELL);
        const j0 = clamp(Math.floor((90 - maxY) / CELL), 0, GH - 1), j1 = clamp(Math.ceil((90 - minY) / CELL), 0, GH - 1);
        const dx = rg.x2 - rg.x1, dy = rg.y2 - rg.y1, L2 = dx * dx + dy * dy;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const idx = j * GW + ((i % GW) + GW) % GW;
          if (elev[idx] <= 0) continue;
          const px = lonOf(i), py = latOf(j);
          const t = clamp(((px - rg.x1) * dx + (py - rg.y1) * dy) / L2, 0, 1);
          const qx = rg.x1 + dx * t, qy = rg.y1 + dy * t;
          const d2 = ((px - qx) ** 2 + (py - qy) ** 2) / (rg.w * rg.w);
          if (d2 > 9) continue;
          const taper = Math.sin(Math.PI * clamp(t * 1.1 - 0.05, 0, 1));
          const m = per((lo, la) => ridged(lo / 7, la / 7, S + 9, 4), wrapD(px), py) * Math.exp(-d2) * taper * rg.h;
          elev[idx] += m * 4200;
        }
      }
    }
    // Südpolarschild
    for (let j = 0; j < GH; j++) {
      const lat = latOf(j);
      if (lat < -68) for (let i = 0; i < GW; i++) {
        const idx = j * GW + i;
        const edge = -68 - lat + (per((lo, la) => fbm(lo / 8, la / 8, S + 5, 3), lonOf(i), lat) - 0.5) * 8;
        if (edge > 0) elev[idx] = Math.max(elev[idx], 200 + edge * 120);
      }
    }
    await tick();

    /* ---------- Klima ---------- */
    progress(0.4, 'Klimazonen werden bestimmt');
    const temp = new Float32Array(n);
    const moist = new Float32Array(n);
    const coastDist = new Uint8Array(n).fill(255);
    // Entfernung zum Meer (BFS)
    let q = [];
    for (let idx = 0; idx < n; idx++) if (elev[idx] <= 0) { coastDist[idx] = 0; q.push(idx); }
    for (let d = 1; d < 60 && q.length; d++) {
      const nq = [];
      for (const idx of q) {
        const i = idx % GW, j = (idx / GW) | 0;
        const nb = [j * GW + ((i + 1) % GW), j * GW + ((i - 1 + GW) % GW), j > 0 ? idx - GW : -1, j < GH - 1 ? idx + GW : -1];
        for (const k of nb) if (k >= 0 && coastDist[k] === 255) { coastDist[k] = d; nq.push(k); }
      }
      q = nq;
    }
    const belt = a => a < 10 ? 0.88 : a < 20 ? 0.88 - (a - 10) * 0.055 : a < 31 ? 0.33 : a < 44 ? 0.33 + (a - 31) * 0.03 : a < 64 ? 0.72 : 0.5;
    for (let j = 0; j < GH; j++) {
      const lat = latOf(j), a = Math.abs(lat);
      for (let i = 0; i < GW; i++) {
        const idx = j * GW + i, lon = lonOf(i);
        const e = Math.max(0, elev[idx]);
        temp[idx] = 27 - 0.0086 * lat * lat - e * 0.0062 + (per((lo, la) => fbm(lo / 20, la / 20, S + 6, 3), lon, lat) - 0.5) * 6;
        const coast = Math.exp(-coastDist[idx] / 16);
        moist[idx] = clamp(belt(a) * 0.55 + coast * 0.38 + (per((lo, la) => fbm(lo / 12 + 3, la / 12 + 9, S + 7, 4), lon, lat) - 0.5) * 0.55 - Math.max(0, e - 1800) / 9000, 0, 1);
      }
    }
    const biome = new Uint8Array(n);
    for (let idx = 0; idx < n; idx++) {
      const e = elev[idx], T = temp[idx], m = moist[idx];
      if (e <= 0) { biome[idx] = B.DEEP; continue; }
      let b;
      if (T < -11) b = B.ICE;
      else if (e > 3300) b = B.SNOW;
      else if (e > 2300) b = B.ROCK;
      else if (T < -7) b = B.ICE;
      else if (T < -1) b = B.TUNDRA;
      else if (T < 5) b = m > 0.42 ? B.TAIGA : B.TUNDRA;
      else if (T < 16) b = m > 0.55 ? B.FOREST : m > 0.33 ? B.GRASS : B.DESERT;
      else if (T < 22) b = m > 0.62 ? B.FOREST : m > 0.46 ? B.MEDIT : m > 0.3 ? B.GRASS : B.DESERT;
      else b = m > 0.6 ? B.JUNGLE : m > 0.36 ? B.SAVANNA : B.DESERT;
      biome[idx] = b;
    }
    await tick();

    /* ---------- Flüsse ---------- */
    progress(0.5, 'Flüsse suchen ihren Weg');
    const river = new Uint16Array(n);
    const rivers = [];
    const cand = [];
    for (let idx = 0; idx < n; idx++) if (elev[idx] > 500 && moist[idx] > 0.42 && biome[idx] !== B.ICE) cand.push(idx);
    for (let k = cand.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [cand[k], cand[m]] = [cand[m], cand[k]]; }
    const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let made = 0;
    for (const src of cand) {
      if (made >= 150) break;
      if (river[src]) continue;
      const path = [src];
      const seen = new Set([src]);
      let cur = src, ok = false, pdx = 0, pdy = 0, climbs = 0;
      const si = src % GW, sj = (src / GW) | 0;
      for (let s = 0; s < 320; s++) {
        const i = cur % GW, j = (cur / GW) | 0;
        let best = -1, be = Infinity, bdx = 0, bdy = 0;
        for (const [dx, dy] of NB8) {
          const ni = (i + dx + GW) % GW, nj = j + dy;
          if (nj < 0 || nj >= GH) continue;
          const k = nj * GW + ni;
          if (seen.has(k)) continue;
          // Geradliniger Verlauf wird bevorzugt, scharfe Knicke kosten
          const turn = (pdx || pdy) ? (1 - (dx * pdx + dy * pdy) / (Math.hypot(dx, dy) * Math.hypot(pdx, pdy))) : 0;
          const ee = elev[k] + (dx && dy ? 4 : 0) + turn * 9;
          if (ee < be) { be = ee; best = k; bdx = dx; bdy = dy; }
        }
        if (best < 0) break;
        if (elev[best] > elev[cur] + 30) break;
        if (elev[best] > elev[cur]) climbs++;
        if (climbs > 14) break;
        path.push(best); seen.add(best);
        pdx = bdx; pdy = bdy;
        if (elev[best] <= 0) { ok = true; break; }
        if (river[best]) { ok = true; break; }
        cur = best;
      }
      // Mäandernde Pfade in flachen Becken verwerfen
      const ei = path[path.length - 1] % GW, ej = (path[path.length - 1] / GW) | 0;
      const straight = Math.hypot(Math.min(Math.abs(ei - si), GW - Math.abs(ei - si)), ej - sj);
      if (!ok || path.length < 12 || path.length > straight * 2.6 + 6) continue;
      made++;
      let flow = 1;
      for (const k of path) { if (elev[k] > 0) { river[k] = Math.min(65000, river[k] + flow); flow += 0.15; } }
      rivers.push(path);
    }
    // Abfluss entlang bestehender Flüsse aufsummieren (für Breiten)
    const riverLines = rivers.map(p => p.map(k => ({ k, lon: lonOf(k % GW), lat: latOf((k / GW) | 0), f: river[k] || 1 })));
    await tick();

    /* ---------- Bewohnbarkeit ---------- */
    progress(0.6, 'Siedlungsräume werden bewertet');
    const habMul = { 2: 0, 3: 0.12, 4: 0.4, 5: 1, 6: 0.85, 7: 0.18, 8: 0.7, 9: 0.55, 10: 1, 11: 0.12, 12: 0 };
    const hab = new Float32Array(n);
    for (let idx = 0; idx < n; idx++) {
      if (elev[idx] <= 0) continue;
      const T = temp[idx];
      const tc = clamp(1 - Math.abs(T - 17) / 18, 0, 1);
      hab[idx] = (habMul[biome[idx]] || 0) * (0.35 + tc * 0.65) * (elev[idx] < 1200 ? 1 : 0.5) * (1 + (river[idx] ? 0.6 : 0) + (coastDist[idx] <= 1 ? 0.45 : 0));
    }

    /* ---------- Landmassen ---------- */
    const comp = new Int32Array(n).fill(-1);
    const comps = [];
    for (let idx = 0; idx < n; idx++) {
      if (elev[idx] <= 0 || comp[idx] >= 0 || biome[idx] === B.ICE) continue;
      const id = comps.length;
      const cells = [];
      const st = [idx]; comp[idx] = id;
      while (st.length) {
        const c = st.pop(); cells.push(c);
        const i = c % GW, j = (c / GW) | 0;
        for (const [dx, dy] of NB8) {
          const ni = (i + dx + GW) % GW, nj = j + dy;
          if (nj < 0 || nj >= GH) continue;
          const k = nj * GW + ni;
          if (comp[k] < 0 && elev[k] > 0 && biome[k] !== B.ICE) { comp[k] = id; st.push(k); }
        }
      }
      let h = 0; for (const c of cells) h += hab[c];
      comps.push({ id, cells, size: cells.length, hab: h });
    }
    await tick();

    /* ---------- Staaten ---------- */
    progress(0.68, 'Grenzen werden gezogen');
    const nation = new Int16Array(n).fill(-1);
    const totalHab = comps.filter(c => c.size >= 700).reduce((s, c) => s + c.hab, 0);
    const target = 18 + Math.floor(r() * 7);
    const seeds = [];
    for (const c of comps) {
      let k = 0;
      if (c.size >= 700) k = Math.max(1, Math.round(c.hab / totalHab * target));
      else if (c.size >= 110 && c.hab > 25) k = 1;
      if (!k) continue;
      const pts = [];
      const sorted = c.cells.slice().sort((a, b) => hab[b] - hab[a]);
      for (let t = 0; t < k; t++) {
        let best = -1, bs = -1;
        for (let m = 0; m < 260; m++) {
          const cc = t === 0 ? sorted[Math.floor(r() * Math.min(40, sorted.length))] : c.cells[Math.floor(r() * c.cells.length)];
          if (hab[cc] < 0.15) continue;
          let md = 1e9;
          for (const p of pts) { const dx = Math.abs((cc % GW) - (p % GW)), d = Math.min(dx, GW - dx) ** 2 + (((cc / GW) | 0) - ((p / GW) | 0)) ** 2; md = Math.min(md, d); }
          const sc = (pts.length ? Math.sqrt(md) : 1) * Math.sqrt(hab[cc] + 0.05);
          if (sc > bs) { bs = sc; best = cc; }
        }
        if (best >= 0) pts.push(best);
      }
      pts.forEach(p => seeds.push({ cell: p, comp: c.id }));
    }
    const nNat = Math.min(seeds.length, 32);
    seeds.length = nNat;
    const cost = new Float32Array(n).fill(Infinity);
    const heap = new Heap();
    seeds.forEach((s, id) => { cost[s.cell] = 0; nation[s.cell] = id; heap.push(0, s.cell); });
    while (heap.size()) {
      const c = heap.pop(); const cc = heap.lastKey;
      if (cc > cost[c]) continue;
      const i = c % GW, j = (c / GW) | 0;
      for (const [dx, dy] of NB8) {
        const ni = (i + dx + GW) % GW, nj = j + dy;
        if (nj < 0 || nj >= GH) continue;
        const k = nj * GW + ni;
        if (elev[k] <= 0 || biome[k] === B.ICE) continue;
        const e = elev[k];
        let step = (dx && dy ? 1.41 : 1) * (1 + (e > 1500 ? 3 : 0) + (e > 2500 ? 7 : 0) + (biome[k] === B.DESERT ? 0.5 : 0) + (river[k] > 2 ? 2.6 : 0) + fbm(lonOf(ni) / 5, latOf(nj) / 5, S + 8, 2) * 1.6);
        const nc = cc + step;
        if (nc < cost[k]) { cost[k] = nc; nation[k] = nation[c]; heap.push(nc, k); }
      }
    }
    await tick();

    /* ---------- Staatsattribute ---------- */
    progress(0.76, 'Staaten, Regierungen und Kulturen entstehen');
    const used = new Set();
    const cultureOfCont = {};
    const nations = [];
    for (let id = 0; id < nNat; id++) {
      const cells = [];
      for (let idx = 0; idx < n; idx++) if (nation[idx] === id) cells.push(idx);
      let hsum = 0, cx = 0, cxs = 0, cy = 0, coast = 0, mtn = 0, desert = 0, forest = 0, grass = 0, cold = 0, jungle = 0, rivers_ = 0;
      for (const c of cells) {
        hsum += hab[c]; const lo = lonOf(c % GW) * Math.PI / 180; cx += Math.cos(lo); cxs += Math.sin(lo); cy += latOf((c / GW) | 0);
        if (coastDist[c] <= 1) coast++;
        const b = biome[c];
        if (b === B.ROCK || b === B.SNOW) mtn++; else if (b === B.DESERT) desert++; else if (b === B.FOREST || b === B.TAIGA) forest++; else if (b === B.GRASS || b === B.MEDIT || b === B.SAVANNA) grass++; else if (b === B.TUNDRA) cold++; else if (b === B.JUNGLE) jungle++;
        if (river[c]) rivers_++;
      }
      const sz = cells.length || 1;
      const cont = contOf[seeds[id].cell];
      let cultures = cultureOfCont[cont];
      if (!cultures) {
        const all = NM.CULTURES.slice();
        const c1 = all[Math.floor(r() * all.length)];
        let c2 = all[Math.floor(r() * all.length)];
        if (c2 === c1) c2 = all[(all.indexOf(c1) + 3) % all.length];
        cultures = cultureOfCont[cont] = [c1, c2];
      }
      const lat = cy / sz;
      let culture = cultures[r() < 0.62 ? 0 : 1];
      if (Math.abs(lat) > 52 && r() < 0.6) culture = 'nord';
      if (Math.abs(lat) < 14 && r() < 0.35) culture = r() < 0.5 ? 'afr' : 'poly';
      const short = NM.landName(r, culture, used);
      const g = NM.gov(r);
      const dev = clamp(0.25 + (hsum / sz) * 0.45 + (coast / sz) * 0.6 + gauss(r) * 0.16 - (desert / sz) * 0.15, 0.08, 0.95);
      const popDensity = 0.55 + r() * 1.6;
      const pop = clamp(hsum * popDensity * 0.085, 0.4, 640);
      const gdpPc = Math.round(Math.exp(Math.log(1800) + dev * (Math.log(72000) - Math.log(1800))));
      const hue = (id * 137.508 + seed % 360) % 360;
      nations.push({
        id, short, name: g.f(short), gov: g.t, culture, cells: sz, lon: Math.atan2(cxs, cx) * 180 / Math.PI, lat,
        coast: coast / sz, share: { mtn: mtn / sz, desert: desert / sz, forest: forest / sz, grass: grass / sz, cold: cold / sz, jungle: jungle / sz, river: rivers_ / sz },
        dev, pop: +pop.toFixed(2), gdpPc, color: 'hsl(' + hue.toFixed(0) + ',32%,46%)', hue,
        flag: { type: Math.floor(r() * 8), c: [Math.floor(r() * 12), Math.floor(r() * 12), Math.floor(r() * 12)], e: Math.floor(r() * 6) },
        neighbors: [],
      });
    }
    // Nachbarschaften
    const adj = new Map();
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const a = nation[j * GW + i];
      if (a < 0) continue;
      const rr = nation[j * GW + ((i + 1) % GW)], d = j < GH - 1 ? nation[(j + 1) * GW + i] : -1;
      for (const b of [rr, d]) if (b >= 0 && b !== a) { const key = Math.min(a, b) + ':' + Math.max(a, b); adj.set(key, (adj.get(key) || 0) + 1); }
    }
    adj.forEach((len, key) => {
      const [a, b] = key.split(':').map(Number);
      if (len < 3) return;
      nations[a].neighbors.push(b); nations[b].neighbors.push(a);
    });
    await tick();

    /* ---------- Städte ---------- */
    progress(0.84, 'Städte werden gegründet');
    const cities = [];
    const cityAt = new Int16Array(n).fill(-1);
    for (const nat of nations) {
      const cells = [];
      for (let idx = 0; idx < n; idx++) if (nation[idx] === nat.id && hab[idx] > 0.12) cells.push(idx);
      // Auch karge Staaten brauchen eine Hauptstadt
      if (!cells.length) for (let idx = 0; idx < n; idx++) if (nation[idx] === nat.id) cells.push(idx);
      if (!cells.length) continue;
      const want = clamp(Math.round(nat.cells / 620) + 1, 2, 9);
      const sc = cells.map(c => ({ c, s: hab[c] * (0.7 + r() * 0.6) * (coastDist[c] <= 1 ? 1.35 : 1) * (river[c] ? 1.4 : 1) }));
      sc.sort((a, b) => b.s - a.s);
      const chosen = [];
      for (const o of sc) {
        if (chosen.length >= want) break;
        const i = o.c % GW, j = (o.c / GW) | 0;
        if (chosen.some(x => { const dx = Math.abs((x % GW) - i); return Math.hypot(Math.min(dx, GW - dx), ((x / GW) | 0) - j) < 7.5; })) continue;
        if (cities.some(cc => Math.hypot(cc.i - i, cc.j - j) < 5)) continue;
        chosen.push(o.c);
      }
      if (!chosen.length) chosen.push(sc[0].c);
      const urban = 0.5 + nat.dev * 0.35;
      const zipf = chosen.map((_, k) => 1 / Math.pow(k + 1, 0.95));
      const zs = zipf.reduce((s, x) => s + x, 0);
      chosen.forEach((c, k) => {
        const id = cities.length;
        const i = c % GW, j = (c / GW) | 0;
        const usedC = used;
        const pop = +(nat.pop * urban * 0.55 * zipf[k] / zs * (0.75 + r() * 0.5)).toFixed(3);
        cities.push({
          id, nation: nat.id, name: NM.cityName(r, nat.culture, usedC), i, j, lon: lonOf(i), lat: latOf(j), cell: c,
          pop: Math.max(0.05, pop), capital: k === 0, coastal: coastDist[c] <= 1, river: river[c] > 0, elev: Math.round(elev[c]), biome: biome[c],
        });
        cityAt[c] = id;
      });
      nat.capital = cities.find(cc => cc.nation === nat.id && cc.capital).id;
    }
    await tick();

    /* ---------- Verkehrsachsen ---------- */
    progress(0.92, 'Verkehrsnetze werden verbunden');
    const roads = [];
    const linkKey = new Set();
    const addRoad = (a, b, type) => { const k = Math.min(a, b) + ':' + Math.max(a, b); if (linkKey.has(k)) return; linkKey.add(k); roads.push({ a, b, type }); };
    const geoD = (a, b) => { const dl = Math.abs(a.lon - b.lon); return Math.hypot(Math.min(dl, 360 - dl) * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180), a.lat - b.lat); };
    const overLand = (a, b) => {
      const steps = Math.max(4, Math.ceil(geoD(a, b) / 0.4));
      for (let s = 1; s < steps; s++) {
        const lon = a.lon + wrapD(b.lon - a.lon) * s / steps, lat = a.lat + (b.lat - a.lat) * s / steps;
        const i = ((Math.floor((lon + 180) / CELL) % GW) + GW) % GW, j = clamp(Math.floor((90 - lat) / CELL), 0, GH - 1);
        if (elev[j * GW + i] <= 0) return false;
      }
      return true;
    };
    for (const nat of nations) {
      const cs = cities.filter(c => c.nation === nat.id);
      const inT = [cs[0]], rest = cs.slice(1);
      while (rest.length) {
        let bd = Infinity, ba = null, bb = null;
        for (const a of inT) for (const b of rest) { const d = geoD(a, b); if (d < bd) { bd = d; ba = a; bb = b; } }
        if (overLand(ba, bb)) addRoad(ba.id, bb.id, 'road');
        inT.push(bb); rest.splice(rest.indexOf(bb), 1);
      }
    }
    for (const nat of nations) for (const nb of nat.neighbors) {
      if (nb < nat.id) continue;
      let bd = Infinity, pair = null;
      for (const a of cities.filter(c => c.nation === nat.id)) for (const b of cities.filter(c => c.nation === nb)) { const d = geoD(a, b); if (d < bd) { bd = d; pair = [a, b]; } }
      if (pair && bd < 18 && overLand(pair[0], pair[1])) addRoad(pair[0].id, pair[1].id, 'road');
    }
    progress(1, 'Welt bereit');
    return { seed, GW, GH, CELL, elev, temp, moist, biome, river, rivers: riverLines, nation, nations, cities, cityAt, roads, coastDist, hab, conts, B, BIOME_NAMES };
  }

  const api = { generate, GW, GH, CELL, B, BIOME_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.KY = root.KY || {}; root.KY.gen = api; }
})(typeof window !== 'undefined' ? window : globalThis);
