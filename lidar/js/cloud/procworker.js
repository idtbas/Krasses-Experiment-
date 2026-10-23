// Verarbeitungs-Worker: Raster-Nachbarsuche, Normalen, Filter, Boden, Segmentierung, ICP, Abstände, Vernetzung.
import { TriBVH, closestPoint } from '../engine/bvh.js';

/* ---------------- Rasterindex (CSR) ---------------- */

const KX = 2 ** 34, KY = 2 ** 17, OFF = 65536;
class Grid {
  constructor(pos, cell) {
    const n = pos.length / 3;
    this.pos = pos; this.cell = cell; this.inv = 1 / cell;
    const map = new Map();
    const cid = new Int32Array(n);
    const counts = [];
    for (let i = 0; i < n; i++) {
      const k = this.key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      let c = map.get(k);
      if (c === undefined) { c = counts.length; map.set(k, c); counts.push(0); }
      cid[i] = c; counts[c]++;
    }
    const start = new Int32Array(counts.length + 1);
    for (let c = 0; c < counts.length; c++) start[c + 1] = start[c] + counts[c];
    const fill = start.slice(0, counts.length);
    const idx = new Int32Array(n);
    for (let i = 0; i < n; i++) idx[fill[cid[i]]++] = i;
    this.map = map; this.start = start; this.idx = idx; this.cid = cid; this.cells = counts.length;
  }
  key(x, y, z) { const i = Math.floor(x * this.inv) + OFF, j = Math.floor(y * this.inv) + OFF, k = Math.floor(z * this.inv) + OFF; return i * KX + j * KY + k; }
  cellOf(i, j, k) { return this.map.get((i + OFF) * KX + (j + OFF) * KY + (k + OFF)); }
  // alle Punkte im Würfel ±r um (x,y,z): cb(index, d2)
  near(x, y, z, r, cb) {
    const inv = this.inv, P = this.pos, r2 = r * r;
    const i0 = Math.floor((x - r) * inv), i1 = Math.floor((x + r) * inv), j0 = Math.floor((y - r) * inv), j1 = Math.floor((y + r) * inv), k0 = Math.floor((z - r) * inv), k1 = Math.floor((z + r) * inv);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      const c = this.cellOf(i, j, k);
      if (c === undefined) continue;
      for (let q = this.start[c]; q < this.start[c + 1]; q++) {
        const p = this.idx[q], dx = P[p * 3] - x, dy = P[p * 3 + 1] - y, dz = P[p * 3 + 2] - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= r2) cb(p, d2);
      }
    }
  }
  // nächster Nachbar: Zellschalen von innen nach außen, Abbruch sobald nichts Näheres mehr möglich ist
  nearest(x, y, z, r) {
    const inv = this.inv, P = this.pos, cell = this.cell;
    const ci = Math.floor(x * inv), cj = Math.floor(y * inv), ck = Math.floor(z * inv);
    let best = r * r, bi = -1;
    const smax = Math.ceil(r * inv);
    for (let s = 0; s <= smax; s++) {
      for (let i = ci - s; i <= ci + s; i++) for (let j = cj - s; j <= cj + s; j++) for (let k = ck - s; k <= ck + s; k++) {
        if (s > 0 && i > ci - s && i < ci + s && j > cj - s && j < cj + s && k > ck - s && k < ck + s) continue; // nur die Schale
        const c = this.cellOf(i, j, k);
        if (c === undefined) continue;
        for (let q = this.start[c]; q < this.start[c + 1]; q++) {
          const p = this.idx[q], dx = P[p * 3] - x, dy = P[p * 3 + 1] - y, dz = P[p * 3 + 2] - z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < best) { best = d2; bi = p; }
        }
      }
      if (bi >= 0 && best <= (s * cell) * (s * cell)) break;
    }
    return bi < 0 ? null : [bi, best];
  }
}

function spacing(pos) {
  // mittlerer Punktabstand aus Hüllquader und Anzahl (grobe Schätzung für die Rasterweite)
  const n = pos.length / 3;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i += Math.max(1, (n / 20000) | 0)) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
  const area = Math.max(1e-6, (x1 - x0) * (z1 - z0) + (x1 - x0) * (y1 - y0) + (y1 - y0) * (z1 - z0));
  return Math.sqrt(area / Math.max(1, n));
}

/* ---------------- Normalen (PCA) ---------------- */

function eigSym3(a) {
  // Jacobi für symmetrische 3×3: a = [xx, xy, xz, yy, yz, zz] → kleinster Eigenvektor
  const A = [[a[0], a[1], a[2]], [a[1], a[3], a[4]], [a[2], a[4], a[5]]];
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 12; it++) {
    let p = 0, q = 1, mx = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > mx) { p = 0; q = 2; mx = Math.abs(A[0][2]); }
    if (Math.abs(A[1][2]) > mx) { p = 1; q = 2; mx = Math.abs(A[1][2]); }
    if (mx < 1e-14) break;
    const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
  }
  const ev = [A[0][0], A[1][1], A[2][2]];
  let m = 0; if (ev[1] < ev[m]) m = 1; if (ev[2] < ev[m]) m = 2;
  const sum = Math.abs(ev[0]) + Math.abs(ev[1]) + Math.abs(ev[2]) || 1;
  return [V[0][m], V[1][m], V[2][m], Math.abs(ev[m]) / sum];
}

function normals(grid, pos, r, origin) {
  const n = pos.length / 3;
  const N = new Float32Array(n * 3), curv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let c = 0, sx = 0, sy = 0, sz = 0, xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
    grid.near(x, y, z, r, (p) => { const px = pos[p * 3], py = pos[p * 3 + 1], pz = pos[p * 3 + 2]; c++; sx += px; sy += py; sz += pz; xx += px * px; xy += px * py; xz += px * pz; yy += py * py; yz += py * pz; zz += pz * pz; });
    if (c < 4) { N[i * 3 + 1] = 1; curv[i] = 1; continue; }
    const mx = sx / c, my = sy / c, mz = sz / c;
    const e = eigSym3([xx / c - mx * mx, xy / c - mx * my, xz / c - mx * mz, yy / c - my * my, yz / c - my * mz, zz / c - mz * mz]);
    let nx = e[0], ny = e[1], nz = e[2];
    // zum Scanner hin ausrichten (wenn bekannt), sonst nach oben
    const ox = origin ? origin[0] - x : 0, oy = origin ? origin[1] - y : 1, oz = origin ? origin[2] - z : 0;
    if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz; curv[i] = e[3];
  }
  return { N, curv };
}

/* ---------------- Filter ---------------- */

function voxelKeep(pos, size) {
  const g = new Grid(pos, size);
  const keep = new Uint8Array(pos.length / 3);
  // je Zelle der Punkt, der dem Zellschwerpunkt am nächsten liegt
  for (let c = 0; c < g.cells; c++) {
    let sx = 0, sy = 0, sz = 0; const a = g.start[c], b = g.start[c + 1];
    for (let q = a; q < b; q++) { const p = g.idx[q]; sx += pos[p * 3]; sy += pos[p * 3 + 1]; sz += pos[p * 3 + 2]; }
    const m = b - a; sx /= m; sy /= m; sz /= m;
    let best = Infinity, bi = g.idx[a];
    for (let q = a; q < b; q++) { const p = g.idx[q]; const d = (pos[p * 3] - sx) ** 2 + (pos[p * 3 + 1] - sy) ** 2 + (pos[p * 3 + 2] - sz) ** 2; if (d < best) { best = d; bi = p; } }
    keep[bi] = 1;
  }
  return keep;
}

function sorKeep(pos, k, alpha, progress) {
  const n = pos.length / 3;
  const sp = spacing(pos);
  const r = sp * 4;
  const g = new Grid(pos, r);
  const md = new Float32Array(n);
  const best = new Float64Array(k);
  for (let i = 0; i < n; i++) {
    best.fill(Infinity);
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    g.near(x, y, z, r, (p, d2) => {
      if (p === i || d2 >= best[k - 1]) return;
      let j = k - 1; while (j > 0 && best[j - 1] > d2) { best[j] = best[j - 1]; j--; } best[j] = d2;
    });
    let s = 0, c = 0;
    for (let j = 0; j < k; j++) if (best[j] < Infinity) { s += Math.sqrt(best[j]); c++; }
    md[i] = c ? s / c : r * 2;
    if (progress && i % 200000 === 0) progress(i / n);
  }
  let mu = 0; for (let i = 0; i < n; i++) mu += md[i]; mu /= n;
  let v = 0; for (let i = 0; i < n; i++) v += (md[i] - mu) ** 2; const sd = Math.sqrt(v / n);
  const th = mu + alpha * sd;
  const keep = new Uint8Array(n);
  let removed = 0;
  for (let i = 0; i < n; i++) { if (md[i] <= th) keep[i] = 1; else removed++; }
  return { keep, removed, mu, sd };
}

// Boden: niedrigster Punkt je 0,5-m-Zelle, Ebene per RANSAC, dann alle Punkte nahe der Ebene
function groundMask(pos, tol = 0.04) {
  const n = pos.length / 3;
  const cell = 0.5, cand = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(pos[i * 3] / cell) * 100003 + Math.floor(pos[i * 3 + 2] / cell);
    const c = cand.get(k);
    if (c === undefined || pos[c * 3 + 1] > pos[i * 3 + 1]) cand.set(k, i);
  }
  const C = [...cand.values()];
  let best = null, bestIn = -1;
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let it = 0; it < 200 && C.length >= 3; it++) {
    const a = C[(rnd() * C.length) | 0], b = C[(rnd() * C.length) | 0], c = C[(rnd() * C.length) | 0];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az, vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue; nx /= l; ny /= l; nz /= l;
    if (Math.abs(ny) < 0.9) continue;
    const d = -(nx * ax + ny * ay + nz * az);
    let inl = 0; for (const p of C) if (Math.abs(nx * pos[p * 3] + ny * pos[p * 3 + 1] + nz * pos[p * 3 + 2] + d) < tol * 2) inl++;
    if (inl > bestIn) { bestIn = inl; best = [nx, ny, nz, d]; }
  }
  const mask = new Uint8Array(n);
  if (!best) return { mask, plane: null, count: 0 };
  let count = 0;
  const [nx, ny, nz, d] = best;
  for (let i = 0; i < n; i++) if (Math.abs(nx * pos[i * 3] + ny * pos[i * 3 + 1] + nz * pos[i * 3 + 2] + d) < tol) { mask[i] = 1; count++; }
  return { mask, plane: best, count };
}

// Region-Growing ab einem Startpunkt (Nachbarn im Abstand r), Bodenpunkte ausgeschlossen
function regionGrow(pos, seed, r, exclude) {
  const n = pos.length / 3;
  const g = new Grid(pos, r);
  const mask = new Uint8Array(n);
  const stack = [seed];
  mask[seed] = 1;
  let count = 1;
  while (stack.length && count < 4e6) {
    const i = stack.pop();
    g.near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], r, (p) => { if (!mask[p] && !(exclude && exclude[p])) { mask[p] = 1; count++; stack.push(p); } });
  }
  return { mask, count };
}

/* ---------------- ICP (Punkt-zu-Ebene) ---------------- */

function solve6(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 6; c++) {
    let p = c; for (let r = c + 1; r < 6; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 6; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 7; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[6] / row[i]);
}
// 4×4 spaltenweise (wie Three.js) multiplizieren
function mul4(a, b) { const o = new Array(16); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function apply4(m, x, y, z, out) { out[0] = m[0] * x + m[4] * y + m[8] * z + m[12]; out[1] = m[1] * x + m[5] * y + m[9] * z + m[13]; out[2] = m[2] * x + m[6] * y + m[10] * z + m[14]; }

function icp(src, tgt, init, opts) {
  const sp = spacing(tgt);
  const nr = Math.max(sp * 3, 0.04);
  const { N } = normals(new Grid(tgt, nr), tgt, nr, null);
  const tg = new Grid(tgt, Math.max(sp * 2.5, 0.02));
  let T = init.slice();
  const ns = src.length / 3;
  const P = [0, 0, 0];
  const hist = [];
  let rms = 0, inl = 0;
  const schedule = opts.schedule || [0.6, 0.35, 0.2, 0.1, 0.06, 0.04, 0.03, 0.02];
  let it = 0;
  for (const maxD of schedule) {
    for (let rep = 0; rep < (opts.iters || 5); rep++, it++) {
      const A = Array.from({ length: 6 }, () => new Array(6).fill(0)), b = new Array(6).fill(0);
      let se = 0; inl = 0;
      for (let i = 0; i < ns; i++) {
        apply4(T, src[i * 3], src[i * 3 + 1], src[i * 3 + 2], P);
        const nn = tg.nearest(P[0], P[1], P[2], maxD);
        if (!nn) continue;
        const q = nn[0];
        const nx = N[q * 3], ny = N[q * 3 + 1], nz = N[q * 3 + 2];
        const rr = (P[0] - tgt[q * 3]) * nx + (P[1] - tgt[q * 3 + 1]) * ny + (P[2] - tgt[q * 3 + 2]) * nz;
        const w = Math.abs(rr) < maxD * 0.5 ? 1 : (maxD * 0.5) / Math.abs(rr); // Huber
        const J = [P[1] * nz - P[2] * ny, P[2] * nx - P[0] * nz, P[0] * ny - P[1] * nx, nx, ny, nz];
        for (let r = 0; r < 6; r++) { b[r] -= w * J[r] * rr; for (let c = 0; c < 6; c++) A[r][c] += w * J[r] * J[c]; }
        se += rr * rr; inl++;
      }
      if (inl < 30) break;
      rms = Math.sqrt(se / inl);
      const x = solve6(A, b);
      if (!x) break;
      const [a, bb, g, tx, ty, tz] = x;
      // kleine Drehung (Rodrigues-Näherung, orthonormiert)
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(bb), sb = Math.sin(bb), cg = Math.cos(g), sg = Math.sin(g);
      const R = [cb * cg, cb * sg, -sb, 0, sa * sb * cg - ca * sg, sa * sb * sg + ca * cg, sa * cb, 0, ca * sb * cg + sa * sg, ca * sb * sg - sa * cg, ca * cb, 0, tx, ty, tz, 1];
      T = mul4(R, T);
      hist.push({ it, maxD, rms, inl });
      if (Math.abs(tx) + Math.abs(ty) + Math.abs(tz) < 1e-5 && Math.abs(a) + Math.abs(bb) + Math.abs(g) < 1e-6) break;
    }
  }
  return { T, rms, inliers: inl, overlap: inl / ns, hist, iters: it };
}

/* ---------------- Abstände ---------------- */

function c2c(a, b) {
  const g = new Grid(b, 0.05);
  const n = a.length / 3, d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0.05, nn = null;
    while (!nn && r < 1.7) { nn = g.nearest(a[i * 3], a[i * 3 + 1], a[i * 3 + 2], r); r *= 2.2; }
    d[i] = nn ? Math.sqrt(nn[1]) : 1e9;
  }
  return d;
}

function c2m(pts, tris, maxD) {
  const n = tris.length / 9;
  const bvh = TriBVH.build(tris, new Uint16Array(n), new Uint16Array(n));
  const res = {};
  const m = pts.length / 3, d = new Float32Array(m);
  const T = bvh.tri;
  for (let i = 0; i < m; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    if (!closestPoint(bvh, x, y, z, maxD * maxD, res)) { d[i] = 1e9; continue; }
    // Vorzeichen über die Dreiecksnormale (außen positiv)
    const p = res.tri * 9;
    const nx = T[p + 4] * T[p + 8] - T[p + 5] * T[p + 7], ny = T[p + 5] * T[p + 6] - T[p + 3] * T[p + 8], nz = T[p + 3] * T[p + 7] - T[p + 4] * T[p + 6];
    const s = (x - res.qx) * nx + (y - res.qy) * ny + (z - res.qz) * nz;
    d[i] = (s < 0 ? -1 : 1) * Math.sqrt(res.d2);
  }
  return d;
}

/* ---------------- Vernetzung: TSDF + Surface Nets ---------------- */

function tsdfMesh(pos, rgb, origins, oIndex, voxel, trunc, box) {
  const B = 8, inv = 1 / voxel;
  const blocks = new Map();
  const bkey = (i, j, k) => ((i + 8192) * 16384 + (j + 8192)) * 16384 + (k + 8192);
  const getBlock = (bi, bj, bk, make) => {
    const key = bkey(bi, bj, bk);
    let b = blocks.get(key);
    if (!b && make) { b = { D: new Float32Array(B * B * B).fill(1), W: new Float32Array(B * B * B), C: new Float32Array(B * B * B * 3), i: bi, j: bj, k: bk }; blocks.set(key, b); }
    return b;
  };
  const n = pos.length / 3;
  const step = voxel * 0.5;
  for (let p = 0; p < n; p++) {
    const x = pos[p * 3], y = pos[p * 3 + 1], z = pos[p * 3 + 2];
    if (box && (x < box[0] || y < box[1] || z < box[2] || x > box[3] || y > box[4] || z > box[5])) continue;
    const oi = oIndex ? oIndex[p] : 0;
    let dx = x - origins[oi * 3], dy = y - origins[oi * 3 + 1], dz = z - origins[oi * 3 + 2];
    const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
    const cr = rgb[p * 3], cg = rgb[p * 3 + 1], cb = rgb[p * 3 + 2];
    for (let t = -trunc; t <= trunc; t += step) {
      const sx = x + dx * t, sy = y + dy * t, sz = z + dz * t;
      const vi = Math.floor(sx * inv), vj = Math.floor(sy * inv), vk = Math.floor(sz * inv);
      const bi = Math.floor(vi / B), bj = Math.floor(vj / B), bk = Math.floor(vk / B);
      const blk = getBlock(bi, bj, bk, true);
      const li = vi - bi * B, lj = vj - bj * B, lk = vk - bk * B;
      const id = (lk * B + lj) * B + li;
      const sdf = Math.max(-1, Math.min(1, -t / trunc));
      const w = 1;
      const W = blk.W[id];
      blk.D[id] = (blk.D[id] * W + sdf * w) / (W + w);
      blk.C[id * 3] = (blk.C[id * 3] * W + cr * w) / (W + w); blk.C[id * 3 + 1] = (blk.C[id * 3 + 1] * W + cg * w) / (W + w); blk.C[id * 3 + 2] = (blk.C[id * 3 + 2] * W + cb * w) / (W + w);
      blk.W[id] = W + w;
    }
  }
  // Abfrage eines Voxels über Blockgrenzen
  const vox = (vi, vj, vk) => {
    const bi = Math.floor(vi / B), bj = Math.floor(vj / B), bk = Math.floor(vk / B);
    const b = getBlock(bi, bj, bk, false);
    if (!b) return null;
    const id = ((vk - bk * B) * B + (vj - bj * B)) * B + (vi - bi * B);
    return b.W[id] > 0 ? [b.D[id], id, b] : null;
  };
  // Surface Nets: ein Eckpunkt je Zelle mit Vorzeichenwechsel, Vierecke über die Kanten
  const verts = [], cols = [], vmap = new Map();
  const cellVert = (ci, cj, ck) => {
    const key = bkey(ci, cj, ck);
    if (vmap.has(key)) return vmap.get(key);
    const vals = [];
    for (let c = 0; c < 8; c++) { const v = vox(ci + (c & 1), cj + ((c >> 1) & 1), ck + ((c >> 2) & 1)); if (!v) { vmap.set(key, -1); return -1; } vals.push(v); }
    let cnt = 0, sx = 0, sy = 0, sz = 0, r = 0, g = 0, bl = 0;
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [a, b] of E) {
      const da = vals[a][0], db = vals[b][0];
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1, bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
      sx += ax + (bx - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; cnt++;
    }
    if (!cnt) { vmap.set(key, -1); return -1; }
    for (let c = 0; c < 8; c++) { const [, id, b] = vals[c]; r += b.C[id * 3]; g += b.C[id * 3 + 1]; bl += b.C[id * 3 + 2]; }
    const idx = verts.length / 3;
    verts.push((ci + 0.5 + sx / cnt) * voxel, (cj + 0.5 + sy / cnt) * voxel, (ck + 0.5 + sz / cnt) * voxel); // Voxelwerte liegen in den Voxelmitten
    cols.push(r / 8, g / 8, bl / 8);
    vmap.set(key, idx);
    return idx;
  };
  const faces = [];
  for (const b of blocks.values()) {
    for (let lk = 0; lk < B; lk++) for (let lj = 0; lj < B; lj++) for (let li = 0; li < B; li++) {
      const id = (lk * B + lj) * B + li;
      if (!b.W[id]) continue;
      const vi = b.i * B + li, vj = b.j * B + lj, vk = b.k * B + lk;
      const d0 = b.D[id];
      // drei Kanten in +x, +y, +z
      for (let ax = 0; ax < 3; ax++) {
        const n2 = vox(vi + (ax === 0), vj + (ax === 1), vk + (ax === 2));
        if (!n2 || (d0 < 0) === (n2[0] < 0)) continue;
        // die vier Zellen um diese Kante
        let q;
        if (ax === 0) q = [[vi, vj - 1, vk - 1], [vi, vj, vk - 1], [vi, vj, vk], [vi, vj - 1, vk]];
        else if (ax === 1) q = [[vi - 1, vj, vk - 1], [vi - 1, vj, vk], [vi, vj, vk], [vi, vj, vk - 1]];
        else q = [[vi - 1, vj - 1, vk], [vi, vj - 1, vk], [vi, vj, vk], [vi - 1, vj, vk]];
        const ids = q.map(([a, bq, c]) => cellVert(a, bq, c));
        if (ids.some((x) => x < 0)) continue;
        if (d0 < 0) faces.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
        else faces.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]);
      }
    }
  }
  return { pos: new Float32Array(verts), rgb: new Float32Array(cols), index: new Uint32Array(faces), blocks: blocks.size };
}

/* ---------------- Nachrichten ---------------- */

export { Grid, icp, c2c, c2m, tsdfMesh, voxelKeep, sorKeep, groundMask, regionGrow, spacing };

if (typeof self !== 'undefined') self.onmessage = (e) => {
  const m = e.data;
  const t0 = performance.now();
  const reply = (data, transfer = []) => self.postMessage({ job: m.job, ms: performance.now() - t0, ...data }, transfer);
  try {
    switch (m.op) {
      case 'voxel': { const keep = voxelKeep(m.pos, m.size); reply({ keep }, [keep.buffer]); break; }
      case 'sor': { const r = sorKeep(m.pos, m.k || 8, m.alpha ?? 2, (p) => self.postMessage({ job: m.job, progress: p })); reply(r, [r.keep.buffer]); break; }
      case 'ground': { const r = groundMask(m.pos, m.tol || 0.04); reply(r, [r.mask.buffer]); break; }
      case 'region': { const r = regionGrow(m.pos, m.seed, m.r || 0.04, m.exclude); reply(r, [r.mask.buffer]); break; }
      case 'icp': { const r = icp(m.src, m.tgt, m.init, m.opts || {}); reply(r); break; }
      case 'c2c': { const d = c2c(m.a, m.b); reply({ d }, [d.buffer]); break; }
      case 'c2m': { const d = c2m(m.pts, m.tris, m.maxD || 0.5); reply({ d }, [d.buffer]); break; }
      case 'mesh': { const r = tsdfMesh(m.pos, m.rgb, m.origins, m.oIndex, m.voxel, m.trunc, m.box); reply(r, [r.pos.buffer, r.rgb.buffer, r.index.buffer]); break; }
      case 'normals': { const g = new Grid(m.pos, m.r); const r = normals(g, m.pos, m.r, m.origin); reply({ N: r.N }, [r.N.buffer]); break; }
      default: reply({ error: 'unbekannte Operation ' + m.op });
    }
  } catch (err) { reply({ error: err.message, stack: err.stack }); }
};
