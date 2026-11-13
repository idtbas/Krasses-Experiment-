// Navigation mit LiDAR: Belegungskarte (Raster) aus den Scans, aufgeblasen um den Fahrzeugradius,
// A*-Pfadsuche zum Ziel und Glättung. So arbeiten auch reale AMR (globaler Planer + lokale Regelung).

const CELL = 0.05;

export class GridMap {
  constructor(x0, z0, x1, z1) {
    this.x0 = Math.min(x0, x1); this.z0 = Math.min(z0, z1);
    this.w = Math.ceil((Math.max(x0, x1) - this.x0) / CELL) + 1;
    this.h = Math.ceil((Math.max(z0, z1) - this.z0) / CELL) + 1;
    this.occ = new Uint8Array(this.w * this.h);   // 1 = Hindernis gesehen
    this.cost = new Float32Array(this.w * this.h); // 0 frei … Infinity gesperrt
    this.dirty = true;
  }
  idx(x, z) {
    const i = Math.floor((x - this.x0) / CELL), j = Math.floor((z - this.z0) / CELL);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }
  cx(i) { return this.x0 + (i + 0.5) * CELL; }
  cz(j) { return this.z0 + (j + 0.5) * CELL; }

  // Trefferpunkte eines Scans eintragen (Weltkoordinaten), nur relevante Höhen
  addScan(lidar) {
    const pts = lidar.pts, valid = lidar.valid;
    let changed = false;
    for (let k = 0; k < valid.length; k++) {
      if (!valid[k]) continue;
      const y = pts[k * 3 + 1];
      if (y < 0.04 || y > 1.2) continue;
      const id = this.idx(pts[k * 3], pts[k * 3 + 2]);
      if (id >= 0 && !this.occ[id]) { this.occ[id] = 1; changed = true; }
    }
    if (changed) this.dirty = true;
    return changed;
  }

  // Sperr- und Kostenfeld um Hindernisse (Radius r: gesperrt, bis r+soft: teuer)
  inflate(r, soft) {
    if (!this.dirty) return;
    this.dirty = false;
    const R = Math.ceil((r + soft) / CELL);
    this.cost.fill(0);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      if (!this.occ[j * this.w + i]) continue;
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h) continue;
        const d = Math.hypot(di, dj) * CELL;
        const id = jj * this.w + ii;
        if (d <= r) this.cost[id] = Infinity;
        else if (d <= r + soft) this.cost[id] = Math.max(this.cost[id], 4 * (1 - (d - r) / soft));
      }
    }
  }

  blockedAt(x, z) { const id = this.idx(x, z); return id < 0 || this.cost[id] === Infinity; }

  // A* (8er-Nachbarschaft). Liefert Wegpunkte in Weltkoordinaten oder null.
  plan(sx, sz, gx, gz) {
    const W = this.w, H = this.h;
    let s = this.idx(sx, sz), g = this.idx(gx, gz);
    if (s < 0 || g < 0) return null;
    // Start oder Ziel im Sperrbereich: auf die nächste freie Zelle ausweichen
    const nearestFree = (id) => {
      if (this.cost[id] !== Infinity) return id;
      const i0 = id % W, j0 = (id / W) | 0;
      for (let rr = 1; rr < 12; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== rr) continue;
        const ii = i0 + di, jj = j0 + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const k = jj * W + ii;
        if (this.cost[k] !== Infinity) return k;
      }
      return -1;
    };
    s = nearestFree(s); g = nearestFree(g);
    if (s < 0 || g < 0) return null;
    const gi = g % W, gj = (g / W) | 0;
    const hfun = (id) => { const i = id % W, j = (id / W) | 0; const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)); };
    const gs = new Float32Array(W * H).fill(Infinity);
    const from = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    // binärer Heap
    const heap = [], key = [];
    const push = (id, f) => { heap.push(id); key.push(f); let n = heap.length - 1; while (n > 0) { const p = (n - 1) >> 1; if (key[p] <= key[n]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; [key[p], key[n]] = [key[n], key[p]]; n = p; } };
    const pop = () => { const top = heap[0]; const lh = heap.pop(), lk = key.pop(); if (heap.length) { heap[0] = lh; key[0] = lk; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heap.length && key[l] < key[m]) m = l; if (r < heap.length && key[r] < key[m]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; [key[m], key[n]] = [key[n], key[m]]; n = m; } } return top; };
    gs[s] = 0;
    push(s, hfun(s));
    const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, iter = 0;
    while (heap.length && iter++ < 60000) {
      const cur = pop();
      if (closed[cur]) continue;
      if (cur === g) { found = true; break; }
      closed[cur] = 1;
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj, c] of N) {
        const ii = ci + di, jj = cj + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const n = jj * W + ii;
        if (closed[n] || this.cost[n] === Infinity) continue;
        const ng = gs[cur] + c * (1 + this.cost[n]);
        if (ng < gs[n]) { gs[n] = ng; from[n] = cur; push(n, ng + hfun(n)); }
      }
    }
    if (!found) return null;
    const path = [];
    for (let id = g; id !== -1; id = from[id]) path.push({ x: this.cx(id % W), z: this.cz((id / W) | 0) });
    path.reverse();
    return this.smooth(path);
  }

  // Sichtlinien-Glättung: überflüssige Zwischenpunkte entfernen
  smooth(path) {
    if (path.length < 3) return path;
    const out = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      for (; j > i + 1; j--) if (this.lineFree(path[i], path[j])) break;
      out.push(path[j]);
      i = j;
    }
    return out;
  }
  lineFree(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / (CELL * 0.5));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const id = this.idx(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (id < 0 || this.cost[id] > 1.2) return false;
    }
    return true;
  }
}
