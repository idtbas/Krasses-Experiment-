/* KYTHERA · Weltmodell
   Deterministische Erzeugung der Landmassen und Regionszuordnung.
   Läuft im Browser (KY.world) und in Node (module.exports) für Werkzeuge. */
(function (root) {
  'use strict';

  const SEED = 1902;
  const W = 360, H = 160;           // 1°-Raster, Breite 80°N … 80°S
  const LAT0 = 80;

  function hash2(ix, iy, s) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function vnoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s);
    const c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  function fbm(x, y, s, oct) {
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      v += amp * vnoise(x * f, y * f, s + i * 31);
      norm += amp; f *= 2.03; amp *= 0.5;
    }
    return v / norm;
  }

  // Kontinentalkerne: [lon, lat, rx, ry, rot°, gewicht, kontinent]
  const BLOBS = [
    // Aurelien (Nordwest)
    [-112, 50, 22, 12, -15, 1.05, 'AUR'], [-92, 44, 20, 13, 10, 1.1, 'AUR'], [-74, 60, 24, 9, -8, 1.0, 'AUR'],
    [-58, 48, 16, 11, 25, 1.0, 'AUR'], [-98, 66, 22, 7, 5, 0.95, 'AUR'], [-44, 40, 10, 8, 0, 0.9, 'AUR'],
    [-120, 36, 9, 8, 30, 0.85, 'AUR'], [-80, 32, 8, 7, 0, 0.8, 'AUR'],
    // Solenne (Südwest)
    [-66, -2, 15, 13, 20, 1.1, 'SOL'], [-56, -14, 13, 12, -10, 1.0, 'SOL'], [-63, -32, 9, 13, 15, 1.0, 'SOL'],
    [-67, -46, 5, 8, 10, 0.9, 'SOL'], [-76, 8, 7, 6, 0, 0.85, 'SOL'],
    // Mittland mit Binnenmeer
    [-2, 50, 15, 10, 10, 1.0, 'MIT'], [16, 54, 16, 8, 0, 1.0, 'MIT'], [38, 50, 14, 10, -10, 1.0, 'MIT'],
    [4, 40, 9, 6, 0, 0.85, 'MIT'], [44, 38, 10, 9, 0, 0.9, 'MIT'], [10, 22, 22, 9, 0, 1.05, 'MIT'],
    [34, 20, 18, 10, 10, 1.1, 'MIT'], [52, 26, 10, 9, 0, 0.95, 'MIT'], [-8, 26, 9, 9, 0, 0.9, 'MIT'],
    // Zambra (Süd)
    [20, -2, 16, 10, 0, 1.0, 'ZAM'], [28, -16, 17, 13, -10, 1.1, 'ZAM'], [36, -30, 11, 10, 15, 1.0, 'ZAM'],
    [14, -24, 9, 9, 0, 0.9, 'ZAM'], [44, -10, 7, 9, 0, 0.85, 'ZAM'],
    // Ostkontinent
    [86, 46, 22, 12, 0, 1.1, 'OST'], [110, 52, 20, 12, 5, 1.05, 'OST'], [130, 40, 14, 14, -20, 1.1, 'OST'],
    [72, 58, 16, 8, 0, 0.95, 'OST'], [98, 32, 16, 9, 10, 1.0, 'OST'], [118, 26, 10, 8, 30, 0.9, 'OST'],
    [140, 56, 9, 8, 0, 0.85, 'OST'], [70, 36, 10, 8, 0, 0.9, 'OST'],
    // Sundara-Archipel
    [106, 2, 6, 3, 30, 0.95, 'SUN'], [118, -4, 7, 3, -10, 0.95, 'SUN'], [131, 1, 5, 4, 0, 0.9, 'SUN'],
    [126, -10, 8, 2.5, 5, 0.95, 'SUN'], [141, -5, 6, 3, 20, 0.9, 'SUN'], [112, -9, 4, 3, 0, 0.85, 'SUN'],
    // Halden-Union
    [140, -30, 14, 9, 0, 1.1, 'HAL'], [152, -38, 8, 7, 20, 1.0, 'HAL'], [128, -26, 8, 7, 0, 0.95, 'HAL'],
    // Kythera (Insel im Binnenmeer)
    [21.4, 34.2, 1.3, 0.9, 0, 0.95, 'KYT'],
  ];
  // Senken: Binnenmeer und Buchten
  const SINKS = [
    [22, 36, 14, 5.5, 0, 1.35], [8, 33, 7, 4, 0, 1.0], [36, 34, 6, 4, 0, 0.9],
    [-86, 54, 6, 5, 0, 0.9], [100, 40, 4, 3, 0, 0.5], [-60, 58, 5, 3, 20, 0.7],
  ];

  const PREP = BLOBS.map(b => {
    const r = b[4] * Math.PI / 180;
    return { lon: b[0], lat: b[1], rx: b[2], ry: b[3], c: Math.cos(r), s: Math.sin(r), w: b[5], k: b[6] };
  });
  const PSINK = SINKS.map(b => {
    const r = b[4] * Math.PI / 180;
    return { lon: b[0], lat: b[1], rx: b[2], ry: b[3], c: Math.cos(r), s: Math.sin(r), w: b[5] };
  });

  function bump(p, lon, lat) {
    const dx = lon - p.lon, dy = lat - p.lat;
    const u = (dx * p.c + dy * p.s) / p.rx, v = (-dx * p.s + dy * p.c) / p.ry;
    return Math.exp(-(u * u + v * v));
  }

  /* Höhenfeld: > 0 ist Land. Liefert auch den dominierenden Kontinent. */
  function field(lon, lat, detail) {
    // Domänenverzerrung für organische Küstenlinien
    const wl = lon + (fbm(lon / 26 + 3, lat / 26 + 9, SEED + 3, 3) - 0.5) * 26;
    const wb = lat + (fbm(lon / 26 + 21, lat / 26 + 5, SEED + 4, 3) - 0.5) * 18;
    let v = 0, best = 0, k = null;
    for (let i = 0; i < PREP.length; i++) {
      const p = PREP[i];
      if (p.k === 'KYT') continue;
      const b = bump(p, wl, wb) * p.w;
      v += b;
      if (b > best) { best = b; k = p.k; }
    }
    for (let i = 0; i < PSINK.length; i++) v -= bump(PSINK[i], wl, wb) * PSINK[i].w;
    const oct = detail ? 8 : 5;
    const n = fbm(lon / 15 + 100, lat / 15 + 100, SEED, oct) - 0.5;
    const n2 = fbm(lon / 5 + 50, lat / 5 + 50, SEED + 7, detail ? 5 : 3) - 0.5;
    v += n * 1.4 + n2 * 0.45;
    // Südpolarland (Vertragsgebiet)
    if (lat < -63) v += (-63 - lat) * 0.16;
    if (lat > 74) v += (lat - 74) * 0.05;
    // Kythera: kleine Insel, unabhängig von Verzerrung
    const ky = PREP[PREP.length - 1];
    const kb = bump(ky, lon, lat) * 2.2;
    if (kb > 0.25) { v = Math.max(v, kb - 0.1 + n2 * 0.6); k = 'KYT'; best = 1; }
    return { h: v - 0.45, k: best > 0.12 ? k : null };
  }

  // Regionen: Saatpunkt (Grenzbildung) und Hauptstadt
  const REGION_SEEDS = {
    WES: { k: 'AUR', seed: [-108, 46] }, KAL: { k: 'AUR', seed: [-82, 64] }, OSM: { k: 'AUR', seed: [-60, 46] },
    SOL: { k: 'SOL', seed: [-64, -4] }, PAM: { k: 'SOL', seed: [-62, -34] },
    MER: { k: 'MIT', seed: [14, 48] }, TAR: { k: 'MIT', seed: [26, 18] },
    ZAM: { k: 'ZAM', seed: [27, -16] },
    YAR: { k: 'OST', seed: [84, 46] }, KAI: { k: 'OST', seed: [124, 42] },
    SUN: { k: 'SUN', seed: [122, -3] }, HAL: { k: 'HAL', seed: [140, -32] },
  };
  const KONT_REGIONS = {};
  for (const id in REGION_SEEDS) {
    const r = REGION_SEEDS[id];
    (KONT_REGIONS[r.k] = KONT_REGIONS[r.k] || []).push(id);
  }

  let cache = null;
  function build() {
    if (cache) return cache;
    const land = new Uint8Array(W * H);
    const height = new Float32Array(W * H);
    const region = new Array(W * H).fill(null);
    const ids = Object.keys(REGION_SEEDS);
    for (let j = 0; j < H; j++) {
      const lat = LAT0 - j - 0.5;
      for (let i = 0; i < W; i++) {
        const lon = -180 + i + 0.5;
        const f = field(lon, lat, false);
        const idx = j * W + i;
        height[idx] = f.h;
        if (f.h > 0) {
          land[idx] = 1;
          let cands = f.k && KONT_REGIONS[f.k] ? KONT_REGIONS[f.k] : null;
          if (f.k === 'KYT') { region[idx] = 'KYT'; continue; }
          if (!cands) cands = ids;
          // verzerrte Distanz für organische Grenzen
          const wx = lon + (fbm(lon / 9, lat / 9, 77, 3) - 0.5) * 18;
          const wy = lat + (fbm(lon / 9 + 40, lat / 9 + 40, 78, 3) - 0.5) * 14;
          let bd = 1e9, br = null;
          for (const id of cands) {
            const s = REGION_SEEDS[id].seed;
            const dx = wx - s[0], dy = wy - s[1];
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; br = id; }
          }
          region[idx] = f.k ? br : null;
        }
      }
    }
    cache = { W, H, LAT0, land, height, region };
    return cache;
  }

  function cellAt(lon, lat) {
    const c = build();
    const i = Math.floor(lon + 180), j = Math.floor(LAT0 - lat);
    if (i < 0 || i >= W || j < 0 || j >= H) return -1;
    return j * W + i;
  }
  function regionAt(lon, lat) {
    const idx = cellAt(lon, lat);
    if (idx < 0) return null;
    return build().region[idx];
  }

  const api = { W, H, LAT0, field, build, regionAt, cellAt, fbm, hash2, REGION_SEEDS, SEED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.KY = root.KY || {}; root.KY.world = api; }
})(typeof window !== 'undefined' ? window : globalThis);
