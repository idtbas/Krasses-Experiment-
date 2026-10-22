/* KYTHERA · MANDAT · Geländetextur (natürliche Farben, Reliefschattierung, fraktale Küsten)
   Koordinaten der Farbfunktion in Basiseinheiten (2048 × 1024), damit Übersicht und Detailansicht zusammenpassen. */
(function (root) {
  'use strict';
  const N = (typeof module !== 'undefined' && module.exports) ? require('./noise.js') : root.KY.noise;
  const { vnoise, hash2 } = N;
  const UW = 2048, UH = 1024;

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const P = {
    sand: hex('#cbb487'), dry: hex('#b3a672'), grass: hex('#86965a'), forest: hex('#4d683b'), dense: hex('#33552f'),
    jungle: hex('#2c5629'), savanna: hex('#a89c5e'), taiga: hex('#465d47'), tundra: hex('#8d8f7e'), ice: hex('#e4ebee'),
    rock: hex('#857a6d'), snow: hex('#eef1f2'), shallow: hex('#3d7088'), mid: hex('#1f4560'), deep: hex('#10233a'), seaice: hex('#c9d6dd'),
  };
  function ramp(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
    }
    return stops[stops.length - 1][1];
  }
  const TEMPERATE = [[0, P.sand], [0.28, P.dry], [0.44, P.grass], [0.6, P.forest], [0.82, P.dense]];
  const HOT = [[0, P.sand], [0.3, P.savanna], [0.5, P.savanna], [0.64, P.forest], [0.8, P.jungle]];
  const COLD = [[0, P.tundra], [0.4, P.tundra], [0.55, P.taiga], [1, P.taiga]];

  function landColor(T, m, e) {
    let c;
    if (T > 22) c = ramp(HOT, m);
    else if (T > 16) c = mix(ramp(TEMPERATE, m), ramp(HOT, m), (T - 16) / 6);
    else if (T > 6) c = ramp(TEMPERATE, m);
    else if (T > 0) c = mix(ramp(COLD, m), ramp(TEMPERATE, m), T / 6);
    else c = ramp(COLD, m);
    if (T < -3) c = mix(c, P.ice, cl((-3 - T) / 5, 0, 1));
    if (T < -12) return mix(c, P.ice, 1);
    if (e > 1400) c = mix(c, P.rock, cl((e - 1400) / 1300, 0, 1));
    if (e > 2900) c = mix(c, P.snow, cl((e - 2900) / 700, 0, 1));
    return c;
  }

  function cub(p0, p1, p2, p3, t) { return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0))); }
  function bicubic(a, GW, GH, gx, gy) {
    const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    let r0 = 0, r1 = 0, r2 = 0, r3 = 0;
    for (let r = 0; r < 4; r++) {
      const j = Math.max(0, Math.min(GH - 1, iy - 1 + r)) * GW;
      const v = cub(a[j + ((ix - 1) % GW + GW) % GW], a[j + (ix % GW + GW) % GW], a[j + ((ix + 1) % GW + GW) % GW], a[j + ((ix + 2) % GW + GW) % GW], fx);
      if (r === 0) r0 = v; else if (r === 1) r1 = v; else if (r === 2) r2 = v; else r3 = v;
    }
    return cub(r0, r1, r2, r3, fy);
  }

  /* Reliefschattierung auf Rasterebene (Licht aus Nordwest), einmal je Welt */
  function shadeOf(world) {
    if (world._shade) return world._shade;
    const { GW, GH, elev } = world;
    const shade = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const idx = j * GW + i;
      const e = Math.max(0, elev[idx]);
      const ex = Math.max(0, elev[j * GW + ((i + 1) % GW)]) - Math.max(0, elev[j * GW + ((i - 1 + GW) % GW)]);
      const ey = Math.max(0, elev[Math.min(GH - 1, j + 1) * GW + i]) - Math.max(0, elev[Math.max(0, j - 1) * GW + i]);
      shade[idx] = cl((-ex - ey) / 900, -1, 1) * (e > 0 ? 1 : 0);
    }
    Object.defineProperty(world, '_shade', { value: shade, enumerable: false });
    return shade;
  }

  /* Farbe an einer Stelle (u, v in Basiseinheiten). fine: zusätzliche Feinstruktur für die Detailansicht */
  function sample(world, shade, u, v, fine, o, px) {
    const { GW, GH, elev, temp, moist } = world;
    const gx = u / UW * GW - 0.5, gy = v / UH * GH - 0.5;
    const fx0 = Math.floor(gx);
    const j0 = Math.max(0, Math.min(GH - 1, Math.floor(gy))), j1 = Math.min(GH - 1, j0 + 1);
    const fy = cl(gy - j0, 0, 1);
    const i0 = ((fx0 % GW) + GW) % GW, i1 = (i0 + 1) % GW;
    const fx = gx - fx0;
    const a = j0 * GW + i0, b = j0 * GW + i1, c = j1 * GW + i0, d = j1 * GW + i1;
    const bil = arr => (arr[a] * (1 - fx) + arr[b] * fx) * (1 - fy) + (arr[c] * (1 - fx) + arr[d] * fx) * fy;
    let e = bil(elev);
    if (e > -700 && e < 700) e = bicubic(elev, GW, GH, gx, gy);
    let nz = vnoise(u / 3.1, v / 3.1, 71) - 0.5;
    const nz2 = vnoise(u / 9, v / 9, 73) - 0.5;
    if (fine) nz = nz * 0.75 + (vnoise(u * 1.15, v * 1.15, 79) - 0.5) * 0.45;
    // Fraktale Küste nur an echten Küsten, nicht in Tiefebenen im Landesinneren
    if (e > -400 && e < 300) { const k = cl(1.6 - bil(world.coastDist) * 0.55, 0, 1); e += (nz * 120 + nz2 * 160) * k; }
    const grain = fine ? (vnoise(u * 2.3, v * 2.3, 5) - 0.5) * 0.05 : (hash2(Math.floor(u), Math.floor(v), 5) - 0.5) * 0.04;
    const lat = 90 - v / UH * 180;
    let col;
    if (e > 0) {
      col = landColor(bil(temp), bil(moist), e);
      let lit = 0.84 + bil(shade) * 0.42 + nz * 0.07 + grain;
      if (fine) {
        // Feines Relief: kleinräumige Hügel und Täler werden sichtbar
        const r1 = vnoise(u * 0.55, v * 0.55, 83), r2 = vnoise(u * 1.3, v * 1.3, 89), r3 = vnoise(u * 3.1, v * 3.1, 97);
        const rough = cl((e - 150) / 1400, 0.25, 1);
        lit += ((r1 - 0.5) * 0.12 + (r2 - 0.5) * 0.07 + (r3 - 0.5) * 0.035) * rough;
        const veg = vnoise(u * 0.8 + 31, v * 0.8 + 17, 101) - 0.5;
        col = [col[0] * (1 - veg * 0.06), col[1] * (1 + veg * 0.05), col[2] * (1 - veg * 0.04)];
      }
      col = [col[0] * lit, col[1] * lit, col[2] * lit];
      if (e < 25) col = mix(col, P.sand, 0.25);
    } else {
      const dep = cl(-e / 4200, 0, 1);
      col = dep < 0.08 ? mix(P.shallow, P.mid, dep / 0.08) : mix(P.mid, P.deep, Math.pow((dep - 0.08) / 0.92, 0.6));
      const wn = (vnoise(u / 14, v / 14, 77) - 0.5) * 0.06 + grain * 0.35;
      col = [col[0] * (1 + wn), col[1] * (1 + wn), col[2] * (1 + wn)];
      if (Math.abs(lat) > 76) { const t = cl((Math.abs(lat) - 76) / 5 + nz2 * 0.8, 0, 1); col = mix(col, P.seaice, t * 0.9); }
    }
    o[px] = col[0]; o[px + 1] = col[1]; o[px + 2] = col[2]; o[px + 3] = 255;
  }

  /* Ganze Welt in ein RGBA-Feld der Größe W×H */
  function paint(world, W, H, out) {
    const px = out || new Uint8ClampedArray(W * H * 4);
    const shade = shadeOf(world);
    const sx = UW / W, sy = UH / H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sample(world, shade, (x + 0.5) * sx, (y + 0.5) * sy, false, px, (y * W + x) * 4);
    return px;
  }

  /* Ausschnitt (u0, v0, uw, vh in Basiseinheiten) in W×H, zeilenweise von y0 bis y1 */
  function paintRegion(world, u0, v0, uw, vh, W, H, out, y0, y1) {
    const shade = shadeOf(world);
    for (let y = y0; y < y1; y++) {
      const v = Math.max(0.01, Math.min(UH - 0.01, v0 + (y + 0.5) / H * vh));
      for (let x = 0; x < W; x++) sample(world, shade, u0 + (x + 0.5) / W * uw, v, true, out, (y * W + x) * 4);
    }
  }

  const api = { paint, paintRegion, landColor, UW, UH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.KY = root.KY || {}; root.KY.paint = api; }
})(typeof window !== 'undefined' ? window : globalThis);
