/* KYTHERA · MANDAT · Geodaten-Helfer: Zellen, Entfernungen, Trassen, Flächen, Flüsse */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U;
  const G = (KY.geo = {});
  let W = null;

  G.bind = function (world) {
    W = world;
    G.W = world;
    // Küstennahe Meereszellen kennen ihren nächsten Staat (für Offshore-Vorhaben)
    const { GW, GH, elev, nation } = world;
    const seaNat = new Int16Array(GW * GH).fill(-1);
    const seaDist = new Uint8Array(GW * GH).fill(255);
    const q = [];
    for (let k = 0; k < GW * GH; k++) if (elev[k] > 0 && nation[k] >= 0) { seaNat[k] = nation[k]; seaDist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], d = seaDist[k];
      if (d >= 14) continue;
      const i = k % GW, j = (k / GW) | 0;
      const nb = [((i + 1) % GW) + j * GW, ((i - 1 + GW) % GW) + j * GW, j > 0 ? k - GW : -1, j < GH - 1 ? k + GW : -1];
      for (const m of nb) {
        if (m < 0 || seaDist[m] <= d + 1) continue;
        seaDist[m] = d + 1; seaNat[m] = seaNat[k]; q.push(m);
      }
    }
    G.seaNat = seaNat; G.seaDist = seaDist;
    // Flussläufe: Zelle → Index im Flusslauf
    G.riverOf = new Map();
    world.rivers.forEach((line, li) => line.forEach((p, pi) => { if (!G.riverOf.has(p.k)) G.riverOf.set(p.k, [li, pi]); }));
  };

  G.lonOf = i => -180 + (i + 0.5) * W.CELL;
  G.latOf = j => 90 - (j + 0.5) * W.CELL;
  G.cell = function (lon, lat) {
    let i = Math.floor((((lon + 180) % 360 + 360) % 360) / W.CELL);
    const j = U.clamp(Math.floor((90 - lat) / W.CELL), 0, W.GH - 1);
    i = U.clamp(i, 0, W.GW - 1);
    return j * W.GW + i;
  };
  G.cellLonLat = k => [G.lonOf(k % W.GW), G.latOf((k / W.GW) | 0)];
  G.isLand = k => W.elev[k] > 0;
  G.nationAt = (lon, lat) => W.nation[G.cell(lon, lat)];
  G.cellKm2 = function (k) {
    const lat = G.latOf((k / W.GW) | 0);
    const s = W.CELL * 111.32;
    return s * s * Math.cos(lat * Math.PI / 180);
  };
  G.km = (a, b) => U.km(a.lon, a.lat, b.lon, b.lat);
  G.dlon = function (a, b) { let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  G.nearestCity = function (lon, lat, filter) {
    let best = null, bd = Infinity;
    for (const c of W.cities) {
      if (filter && !filter(c)) continue;
      const d = U.km(lon, lat, c.lon, c.lat);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { city: best, km: bd } : null;
  };

  /* Trasse zwischen zwei Punkten: Länge, Landanteil, längstes Meeresstück, berührte Staaten */
  G.route = function (a, b) {
    const km = U.km(a.lon, a.lat, b.lon, b.lat);
    const steps = Math.max(8, Math.ceil(km / 18));
    const dl = G.dlon(a.lon, b.lon);
    let land = 0, sea = 0, run = 0, maxRun = 0;
    const nats = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lon = a.lon + dl * t, lat = a.lat + (b.lat - a.lat) * t;
      const k = G.cell(lon, lat);
      if (W.elev[k] > 0) { land++; run = 0; if (W.nation[k] >= 0) nats.add(W.nation[k]); }
      else { sea++; run++; maxRun = Math.max(maxRun, run); }
    }
    const segKm = km / steps;
    return { km, landFrac: land / (steps + 1), seaKm: sea * segKm, maxSeaKm: maxRun * segKm, nations: Array.from(nats) };
  };

  /* Rechteckiges Gebiet (lon/lat): Fläche, Biome, Staaten */
  G.area = function (lon0, lat0, lon1, lat1) {
    const la = Math.min(lat0, lat1), lb = Math.max(lat0, lat1);
    const dl = G.dlon(lon0, lon1);
    const lo = dl >= 0 ? lon0 : lon1, span = Math.abs(dl);
    const out = { land: 0, sea: 0, biomes: {}, nats: {}, seaNats: {}, cells: 0, lonMid: lo + span / 2, latMid: (la + lb) / 2 };
    const j0 = U.clamp(Math.floor((90 - lb) / W.CELL), 0, W.GH - 1), j1 = U.clamp(Math.floor((90 - la) / W.CELL), 0, W.GH - 1);
    const ni = Math.max(1, Math.round(span / W.CELL));
    for (let j = j0; j <= j1; j++) {
      for (let s = 0; s <= ni; s++) {
        const k = G.cell(lo + s * W.CELL, G.latOf(j));
        const a = G.cellKm2(k);
        out.cells++;
        if (W.elev[k] > 0) {
          out.land += a;
          out.biomes[W.biome[k]] = (out.biomes[W.biome[k]] || 0) + a;
          if (W.nation[k] >= 0) out.nats[W.nation[k]] = (out.nats[W.nation[k]] || 0) + a;
        } else {
          out.sea += a;
          if (G.seaNat[k] >= 0 && G.seaDist[k] <= 10) out.seaNats[G.seaNat[k]] = (out.seaNats[G.seaNat[k]] || 0) + a;
        }
      }
    }
    const top = o => { let b = -1, bv = 0; for (const k in o) if (o[k] > bv) { bv = o[k]; b = +k; } return b; };
    out.nation = top(out.nats);
    out.seaNation = top(out.seaNats);
    return out;
  };

  /* Fluss an einer Stelle (Suche im Umkreis von einer Zelle) */
  G.riverNear = function (lon, lat) {
    const k0 = G.cell(lon, lat);
    const i0 = k0 % W.GW, j0 = (k0 / W.GW) | 0;
    let best = -1, bf = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const j = j0 + dj; if (j < 0 || j >= W.GH) continue;
      const k = j * W.GW + ((i0 + di + W.GW) % W.GW);
      if (W.river[k] > bf && W.elev[k] > 0) { bf = W.river[k]; best = k; }
    }
    if (best < 0) return null;
    const pos = G.riverOf.get(best);
    let down = -1;
    if (pos) {
      const line = W.rivers[pos[0]];
      const here = W.nation[best];
      for (let p = pos[1] + 1; p < line.length; p++) {
        const nn = W.nation[line[p].k];
        if (nn >= 0 && nn !== here) { down = nn; break; }
      }
    }
    return { k: best, flow: bf, nation: W.nation[best], down };
  };

  /* Standortgüte für Solar und Wind */
  G.sun = function (k) {
    const lat = G.latOf((k / W.GW) | 0);
    return U.clamp(1.08 - Math.abs(lat) / 72 - W.moist[k] * 0.32, 0.3, 1);
  };
  G.wind = function (k, sea) {
    const lat = Math.abs(G.latOf((k / W.GW) | 0));
    const coast = W.coastDist[k] <= 2 ? 0.14 : 0;
    return U.clamp(0.32 + lat / 90 * 0.55 + coast + (sea ? 0.28 : 0) + Math.max(0, W.elev[k]) / 7000, 0.3, 1);
  };
  G.biomeName = b => W.BIOME_NAMES[b] || (b === 0 ? 'Meer' : 'Unbekannt');
})();
