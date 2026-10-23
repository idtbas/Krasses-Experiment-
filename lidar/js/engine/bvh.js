// Hüllkörper-Hierarchie (BVH) für schnelles Raycasting gegen Dreiecksnetze.
// Reines JavaScript ohne Abhängigkeiten: läuft im Haupt-Thread, im Web Worker und in Node.
//
// Aufbau: Binned-SAH über alle drei Achsen, Blätter mit bis zu 4 Dreiecken.
// Knoten liegen in Tiefensuche-Reihenfolge (linkes Kind = Knoten + 1), je Knoten 8 Worte:
//   [minX, minY, minZ, maxX, maxY, maxZ, a, n]  – Blatt: a = erstes Primitiv, n = Anzahl
//                                                 – innen: a = rechtes Kind,   n = 0
// Zweistufig: TriBVH je Netz (lokale Koordinaten), LidarScene als Instanzen mit Matrizen.

const BINS = 12;
const LEAF = 4;
const MAX_LEAF = 10;

// Allgemeiner Baumaufbau über Primitive mit Hüllquadern. Liefert Knoten und Primitiv-Reihenfolge.
export function buildTree(bmin, bmax, count) {
  const cen = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    cen[i * 3] = (bmin[i * 3] + bmax[i * 3]) * 0.5;
    cen[i * 3 + 1] = (bmin[i * 3 + 1] + bmax[i * 3 + 1]) * 0.5;
    cen[i * 3 + 2] = (bmin[i * 3 + 2] + bmax[i * 3 + 2]) * 0.5;
  }
  const idx = new Uint32Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  const cap = Math.max(1, count * 2);
  const buf = new ArrayBuffer(cap * 32);
  const nf = new Float32Array(buf), nu = new Uint32Array(buf);
  let used = 0;

  const binCnt = new Int32Array(BINS), binMin = new Float32Array(BINS * 3), binMax = new Float32Array(BINS * 3);
  const rCost = new Float64Array(BINS);

  const area = (x0, y0, z0, x1, y1, z1) => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    return dx < 0 ? 0 : dx * dy + dy * dz + dz * dx;
  };

  const build = (node, start, end) => {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
    for (let k = start; k < end; k++) {
      const i = idx[k], i3 = i * 3;
      if (bmin[i3] < x0) x0 = bmin[i3]; if (bmin[i3 + 1] < y0) y0 = bmin[i3 + 1]; if (bmin[i3 + 2] < z0) z0 = bmin[i3 + 2];
      if (bmax[i3] > x1) x1 = bmax[i3]; if (bmax[i3 + 1] > y1) y1 = bmax[i3 + 1]; if (bmax[i3 + 2] > z1) z1 = bmax[i3 + 2];
      const cx = cen[i3], cy = cen[i3 + 1], cz = cen[i3 + 2];
      if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx;
      if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy;
      if (cz < cz0) cz0 = cz; if (cz > cz1) cz1 = cz;
    }
    const o = node * 8;
    nf[o] = x0; nf[o + 1] = y0; nf[o + 2] = z0; nf[o + 3] = x1; nf[o + 4] = y1; nf[o + 5] = z1;
    const n = end - start;
    const leaf = () => { nu[o + 6] = start; nu[o + 7] = n; };
    if (n <= LEAF) return leaf();

    // bester Schnitt über alle Achsen
    let bestCost = Infinity, bestAxis = -1, bestBin = -1;
    const cmin = [cx0, cy0, cz0], cext = [cx1 - cx0, cy1 - cy0, cz1 - cz0];
    for (let ax = 0; ax < 3; ax++) {
      const ext = cext[ax];
      if (ext < 1e-9) continue;
      binCnt.fill(0); binMin.fill(Infinity); binMax.fill(-Infinity);
      const sc = BINS / ext, c0 = cmin[ax];
      for (let k = start; k < end; k++) {
        const i = idx[k], i3 = i * 3;
        let b = ((cen[i3 + ax] - c0) * sc) | 0;
        if (b >= BINS) b = BINS - 1;
        binCnt[b]++;
        const b3 = b * 3;
        for (let q = 0; q < 3; q++) {
          if (bmin[i3 + q] < binMin[b3 + q]) binMin[b3 + q] = bmin[i3 + q];
          if (bmax[i3 + q] > binMax[b3 + q]) binMax[b3 + q] = bmax[i3 + q];
        }
      }
      // von rechts aufsummieren
      let rx0 = Infinity, ry0 = Infinity, rz0 = Infinity, rx1 = -Infinity, ry1 = -Infinity, rz1 = -Infinity, rc = 0;
      for (let b = BINS - 1; b > 0; b--) {
        const b3 = b * 3;
        rc += binCnt[b];
        if (binMin[b3] < rx0) rx0 = binMin[b3]; if (binMin[b3 + 1] < ry0) ry0 = binMin[b3 + 1]; if (binMin[b3 + 2] < rz0) rz0 = binMin[b3 + 2];
        if (binMax[b3] > rx1) rx1 = binMax[b3]; if (binMax[b3 + 1] > ry1) ry1 = binMax[b3 + 1]; if (binMax[b3 + 2] > rz1) rz1 = binMax[b3 + 2];
        rCost[b] = rc * area(rx0, ry0, rz0, rx1, ry1, rz1);
      }
      let lx0 = Infinity, ly0 = Infinity, lz0 = Infinity, lx1 = -Infinity, ly1 = -Infinity, lz1 = -Infinity, lc = 0;
      for (let b = 0; b < BINS - 1; b++) {
        const b3 = b * 3;
        lc += binCnt[b];
        if (binMin[b3] < lx0) lx0 = binMin[b3]; if (binMin[b3 + 1] < ly0) ly0 = binMin[b3 + 1]; if (binMin[b3 + 2] < lz0) lz0 = binMin[b3 + 2];
        if (binMax[b3] > lx1) lx1 = binMax[b3]; if (binMax[b3 + 1] > ly1) ly1 = binMax[b3 + 1]; if (binMax[b3 + 2] > lz1) lz1 = binMax[b3 + 2];
        if (lc === 0 || lc === n) continue;
        const cost = lc * area(lx0, ly0, lz0, lx1, ly1, lz1) + rCost[b + 1];
        if (cost < bestCost) { bestCost = cost; bestAxis = ax; bestBin = b; }
      }
    }
    let mid;
    const parentCost = n * area(x0, y0, z0, x1, y1, z1);
    if (bestAxis < 0) {
      if (n <= MAX_LEAF) return leaf();
      mid = (start + end) >> 1; // alle Schwerpunkte gleich: hälftig teilen
    } else {
      if (bestCost >= parentCost && n <= MAX_LEAF) return leaf();
      const ax = bestAxis, c0 = cmin[ax], sc = BINS / cext[ax];
      let i = start, j = end - 1;
      while (i <= j) {
        let b = ((cen[idx[i] * 3 + ax] - c0) * sc) | 0;
        if (b >= BINS) b = BINS - 1;
        if (b <= bestBin) i++;
        else { const t = idx[i]; idx[i] = idx[j]; idx[j] = t; j--; }
      }
      mid = i;
      if (mid === start || mid === end) mid = (start + end) >> 1;
    }
    const left = used++;
    build(left, start, mid);
    const right = used++;
    nu[o + 6] = right; nu[o + 7] = 0;
    build(right, mid, end);
  };

  if (count === 0) {
    used = 1;
    nf.fill(0, 0, 6); nf[0] = nf[1] = nf[2] = 1; nf[3] = nf[4] = nf[5] = -1; nu[6] = 0; nu[7] = 0;
  } else {
    used = 1;
    build(0, 0, count);
  }
  const out = new ArrayBuffer(used * 32);
  new Uint32Array(out).set(new Uint32Array(buf, 0, used * 8));
  return { nodes: out, order: idx, nodeCount: used };
}

// Dreiecks-BVH. tris: 9 Werte je Dreieck (v0, v1, v2); mat/obj: optionale Uint16 je Dreieck.
export class TriBVH {
  constructor(data) { Object.assign(this, data); this.nf = new Float32Array(this.nodes); this.nu = new Uint32Array(this.nodes); }

  static build(tris, mat, obj) {
    const n = (tris.length / 9) | 0;
    const bmin = new Float32Array(n * 3), bmax = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = i * 9;
      for (let q = 0; q < 3; q++) {
        const a = tris[p + q], b = tris[p + 3 + q], c = tris[p + 6 + q];
        bmin[i * 3 + q] = Math.min(a, b, c);
        bmax[i * 3 + q] = Math.max(a, b, c);
      }
    }
    const { nodes, order, nodeCount } = buildTree(bmin, bmax, n);
    // Dreiecke in Blattreihenfolge, vorbereitet für Möller–Trumbore: v0, e1, e2
    const tri = new Float32Array(n * 9);
    const m2 = new Uint16Array(n), o2 = new Uint16Array(n);
    for (let k = 0; k < n; k++) {
      const i = order[k], p = i * 9, d = k * 9;
      const x0 = tris[p], y0 = tris[p + 1], z0 = tris[p + 2];
      tri[d] = x0; tri[d + 1] = y0; tri[d + 2] = z0;
      tri[d + 3] = tris[p + 3] - x0; tri[d + 4] = tris[p + 4] - y0; tri[d + 5] = tris[p + 5] - z0;
      tri[d + 6] = tris[p + 6] - x0; tri[d + 7] = tris[p + 7] - y0; tri[d + 8] = tris[p + 8] - z0;
      if (mat) m2[k] = mat[i];
      if (obj) o2[k] = obj[i];
    }
    return new TriBVH({ nodes, nodeCount, tri, mat: m2, obj: o2, count: n });
  }

  // Für die Übergabe an einen Worker
  serialize() { return { nodes: this.nodes, nodeCount: this.nodeCount, tri: this.tri, mat: this.mat, obj: this.obj, count: this.count }; }
  transferables() { return [this.nodes, this.tri.buffer, this.mat.buffer, this.obj.buffer]; }

  bounds() { const f = this.nf; return [f[0], f[1], f[2], f[3], f[4], f[5]]; }
}

// Ergebnis eines Strahltests (wird wiederverwendet, um Speicher zu sparen)
export class Hit {
  constructor() { this.t = Infinity; this.inst = -1; this.tri = -1; this.u = 0; this.v = 0; this.nx = 0; this.ny = 0; this.nz = 0; this.mat = 0; this.obj = 0; }
}

const STACK = new Int32Array(128);
const SDIST = new Float64Array(128);
const STACK2 = new Int32Array(128);

// Strahl gegen eine Dreiecks-BVH. Liefert true bei Treffer mit t < tmax und füllt hit.t/tri/u/v.
// Die Kinder werden im Elternknoten getestet: nur getroffene kommen auf den Stapel, das nähere zuletzt.
function intersectTri(b, ox, oy, oz, dx, dy, dz, tmin, tmax, hit) {
  const nf = b.nf, nu = b.nu, tri = b.tri;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  // Vorzeichen bestimmen, welche Quaderseite die nahe ist
  const sx = ix < 0 ? 3 : 0, sy = iy < 0 ? 4 : 1, sz = iz < 0 ? 5 : 2;
  const ex = 3 - sx, ey = 5 - sy, ez = 7 - sz;
  let best = tmax, bestTri = -1, bu = 0, bv = 0;
  // Wurzel testen
  {
    let t0 = (nf[sx] - ox) * ix, t1 = (nf[ex] - ox) * ix;
    const u0 = (nf[sy] - oy) * iy, u1 = (nf[ey] - oy) * iy;
    if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1;
    const w0 = (nf[sz] - oz) * iz, w1 = (nf[ez] - oz) * iz;
    if (w0 > t0) t0 = w0; if (w1 < t1) t1 = w1;
    if (t1 < t0 || t1 < tmin || t0 > best) return false;
  }
  let sp = 0;
  let node = 0;
  for (;;) {
    const o = node * 8;
    const cnt = nu[o + 7];
    if (cnt > 0) {
      const first = nu[o + 6];
      for (let k = first, e = first + cnt; k < e; k++) {
        const p = k * 9;
        const e1x = tri[p + 3], e1y = tri[p + 4], e1z = tri[p + 5];
        const e2x = tri[p + 6], e2y = tri[p + 7], e2z = tri[p + 8];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-14 && det < 1e-14) continue;
        const inv = 1 / det;
        const tx = ox - tri[p], ty = oy - tri[p + 1], tz = oz - tri[p + 2];
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > tmin && t < best) { best = t; bestTri = k; bu = u; bv = v; }
      }
    } else {
      const l = node + 1, r = nu[o + 6];
      const lo = l * 8, ro = r * 8;
      let a0 = (nf[lo + sx] - ox) * ix, a1 = (nf[lo + ex] - ox) * ix;
      let q0 = (nf[lo + sy] - oy) * iy, q1 = (nf[lo + ey] - oy) * iy;
      if (q0 > a0) a0 = q0; if (q1 < a1) a1 = q1;
      q0 = (nf[lo + sz] - oz) * iz; q1 = (nf[lo + ez] - oz) * iz;
      if (q0 > a0) a0 = q0; if (q1 < a1) a1 = q1;
      const hl = a1 >= a0 && a1 >= tmin && a0 <= best;
      let b0 = (nf[ro + sx] - ox) * ix, b1 = (nf[ro + ex] - ox) * ix;
      q0 = (nf[ro + sy] - oy) * iy; q1 = (nf[ro + ey] - oy) * iy;
      if (q0 > b0) b0 = q0; if (q1 < b1) b1 = q1;
      q0 = (nf[ro + sz] - oz) * iz; q1 = (nf[ro + ez] - oz) * iz;
      if (q0 > b0) b0 = q0; if (q1 < b1) b1 = q1;
      const hr = b1 >= b0 && b1 >= tmin && b0 <= best;
      if (hl && hr) {
        if (a0 <= b0) { STACK[sp] = r; SDIST[sp++] = b0; node = l; } else { STACK[sp] = l; SDIST[sp++] = a0; node = r; }
        continue;
      }
      if (hl) { node = l; continue; }
      if (hr) { node = r; continue; }
    }
    // nächsten Knoten vom Stapel, übersprungen wenn inzwischen weiter als der beste Treffer
    let found = false;
    while (sp > 0) {
      const d = SDIST[--sp];
      if (d <= best) { node = STACK[sp]; found = true; break; }
    }
    if (!found) break;
  }
  if (bestTri < 0) return false;
  hit.t = best; hit.tri = bestTri; hit.u = bu; hit.v = bv;
  return true;
}

/*
 * LiDAR-Szene: Instanzen (BLAS + Matrix) mit eigener BVH über die Instanz-Hüllquader (TLAS).
 * Matrix: 12 Werte, zeilenweise 3×4 (Welt ← lokal). Material und Objekt kommen je Dreieck aus der BLAS,
 * eine Instanz kann das Objekt überschreiben (objOverride ≥ 0).
 */
export class LidarScene {
  constructor() {
    this.blas = [];          // TriBVH
    this.inst = [];          // { blas, m: Float32Array(12), inv: Float32Array(12), ident, obj, box, enabled }
    this.tlas = null;
    this.order = null;
    this.dirty = true;
    this.hit = new Hit();
  }

  addBlas(b) { this.blas.push(b); return this.blas.length - 1; }

  addInstance(blasId, m, obj = -1) {
    const inst = { blas: blasId, m: new Float32Array(12), inv: new Float32Array(12), ident: false, obj, box: new Float32Array(6), enabled: true };
    this.inst.push(inst);
    this.setMatrix(this.inst.length - 1, m);
    return this.inst.length - 1;
  }

  setMatrix(i, m) {
    const it = this.inst[i];
    if (!m) m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    it.m.set(m);
    invertAffine(it.m, it.inv);
    it.ident = isIdentity(it.m);
    // Welt-Hüllquader aus den 8 Ecken des lokalen Quaders
    const b = this.blas[it.blas].bounds();
    const box = it.box;
    box[0] = box[1] = box[2] = Infinity; box[3] = box[4] = box[5] = -Infinity;
    for (let c = 0; c < 8; c++) {
      const x = c & 1 ? b[3] : b[0], y = c & 2 ? b[4] : b[1], z = c & 4 ? b[5] : b[2];
      const M = it.m;
      const wx = M[0] * x + M[1] * y + M[2] * z + M[3];
      const wy = M[4] * x + M[5] * y + M[6] * z + M[7];
      const wz = M[8] * x + M[9] * y + M[10] * z + M[11];
      if (wx < box[0]) box[0] = wx; if (wy < box[1]) box[1] = wy; if (wz < box[2]) box[2] = wz;
      if (wx > box[3]) box[3] = wx; if (wy > box[4]) box[4] = wy; if (wz > box[5]) box[5] = wz;
    }
    this.dirty = true;
  }

  rebuild() {
    const n = this.inst.length;
    const bmin = new Float32Array(n * 3), bmax = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const b = this.inst[i].box, en = this.inst[i].enabled && b[0] <= b[3];
      for (let q = 0; q < 3; q++) {
        bmin[i * 3 + q] = en ? b[q] : 1e9;
        bmax[i * 3 + q] = en ? b[3 + q] : -1e9;
      }
    }
    const t = buildTree(bmin, bmax, n);
    this.tlas = { nf: new Float32Array(t.nodes), nu: new Uint32Array(t.nodes) };
    this.order = t.order;
    this.dirty = false;
  }

  // Nächster Treffer entlang o + t·d (d muss nicht normiert sein, t bezieht sich auf d). Ergebnis in this.hit.
  cast(ox, oy, oz, dx, dy, dz, tmin, tmax) {
    if (this.dirty) this.rebuild();
    const hit = this.hit;
    hit.t = tmax; hit.inst = -1;
    const nf = this.tlas.nf, nu = this.tlas.nu, order = this.order;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    let best = tmax, bestInst = -1, bestTri = -1, bu = 0, bv = 0;
    let sp = 0;
    STACK2[sp++] = 0;
    const tmp = TMP_HIT;
    while (sp > 0) {
      const node = STACK2[--sp];
      const o = node * 8;
      let t0 = (nf[o] - ox) * ix, t1 = (nf[o + 3] - ox) * ix;
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      let u0 = (nf[o + 1] - oy) * iy, u1 = (nf[o + 4] - oy) * iy;
      if (u0 > u1) { const t = u0; u0 = u1; u1 = t; }
      if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1;
      let w0 = (nf[o + 2] - oz) * iz, w1 = (nf[o + 5] - oz) * iz;
      if (w0 > w1) { const t = w0; w0 = w1; w1 = t; }
      if (w0 > t0) t0 = w0; if (w1 < t1) t1 = w1;
      if (t1 < t0 || t1 < tmin || t0 > best) continue;
      const cnt = nu[o + 7];
      if (cnt > 0) {
        const first = nu[o + 6];
        for (let k = first, e = first + cnt; k < e; k++) {
          const ii = order[k];
          const it = this.inst[ii];
          if (!it.enabled) continue;
          const b = this.blas[it.blas];
          let lox = ox, loy = oy, loz = oz, ldx = dx, ldy = dy, ldz = dz;
          if (!it.ident) {
            const M = it.inv;
            lox = M[0] * ox + M[1] * oy + M[2] * oz + M[3];
            loy = M[4] * ox + M[5] * oy + M[6] * oz + M[7];
            loz = M[8] * ox + M[9] * oy + M[10] * oz + M[11];
            ldx = M[0] * dx + M[1] * dy + M[2] * dz;
            ldy = M[4] * dx + M[5] * dy + M[6] * dz;
            ldz = M[8] * dx + M[9] * dy + M[10] * dz;
          }
          if (intersectTri(b, lox, loy, loz, ldx, ldy, ldz, tmin, best, tmp)) {
            best = tmp.t; bestInst = ii; bestTri = tmp.tri; bu = tmp.u; bv = tmp.v;
          }
        }
      } else {
        const l = node + 1, r = nu[o + 6];
        const lo = l * 8, ro = r * 8;
        const dl = ((dx >= 0 ? nf[lo] : nf[lo + 3]) - ox) * ix;
        const dr = ((dx >= 0 ? nf[ro] : nf[ro + 3]) - ox) * ix;
        if (dl < dr) { STACK2[sp++] = r; STACK2[sp++] = l; } else { STACK2[sp++] = l; STACK2[sp++] = r; }
      }
    }
    if (bestInst < 0) return false;
    const it = this.inst[bestInst], b = this.blas[it.blas];
    const p = bestTri * 9, tri = b.tri;
    // Normale = e1 × e2 (lokal), in die Welt mit der transponierten Inversen
    let nx = tri[p + 4] * tri[p + 8] - tri[p + 5] * tri[p + 7];
    let ny = tri[p + 5] * tri[p + 6] - tri[p + 3] * tri[p + 8];
    let nz = tri[p + 3] * tri[p + 7] - tri[p + 4] * tri[p + 6];
    if (!it.ident) {
      const M = it.inv;
      const wx = M[0] * nx + M[4] * ny + M[8] * nz;
      const wy = M[1] * nx + M[5] * ny + M[9] * nz;
      const wz = M[2] * nx + M[6] * ny + M[10] * nz;
      nx = wx; ny = wy; nz = wz;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz; }
    hit.t = best; hit.inst = bestInst; hit.tri = bestTri; hit.u = bu; hit.v = bv;
    hit.nx = nx; hit.ny = ny; hit.nz = nz;
    hit.mat = b.mat[bestTri];
    hit.obj = it.obj >= 0 ? it.obj : b.obj[bestTri];
    return true;
  }
}

const TMP_HIT = new Hit();

export function invertAffine(m, out) {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  let det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-20) det = 1e-20;
  const id = 1 / det;
  const r00 = A * id, r01 = -(b * i - c * h) * id, r02 = (b * f - c * e) * id;
  const r10 = B * id, r11 = (a * i - c * g) * id, r12 = -(a * f - c * d) * id;
  const r20 = C * id, r21 = -(a * h - b * g) * id, r22 = (a * e - b * d) * id;
  const tx = m[3], ty = m[7], tz = m[11];
  out[0] = r00; out[1] = r01; out[2] = r02; out[3] = -(r00 * tx + r01 * ty + r02 * tz);
  out[4] = r10; out[5] = r11; out[6] = r12; out[7] = -(r10 * tx + r11 * ty + r12 * tz);
  out[8] = r20; out[9] = r21; out[10] = r22; out[11] = -(r20 * tx + r21 * ty + r22 * tz);
  return out;
}

function isIdentity(m) {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  for (let k = 0; k < 12; k++) if (Math.abs(m[k] - I[k]) > 1e-9) return false;
  return true;
}
