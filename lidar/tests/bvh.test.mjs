// Tests für die BVH: Treffer müssen exakt der Brute-Force-Suche entsprechen. node lidar/tests/bvh.test.mjs
import assert from 'node:assert/strict';
import { TriBVH, LidarScene } from '../js/engine/bvh.js';

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// Kugel aus Dreiecken
function sphere(cx, cy, cz, r, seg = 24) {
  const out = [];
  const P = (i, j) => { const th = (i / seg) * Math.PI, ph = (j / seg) * Math.PI * 2; return [cx + r * Math.sin(th) * Math.cos(ph), cy + r * Math.cos(th), cz + r * Math.sin(th) * Math.sin(ph)]; };
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return out;
}
const tris = [];
for (let k = 0; k < 120; k++) tris.push(...sphere(rnd() * 20 - 10, rnd() * 4, rnd() * 20 - 10, 0.2 + rnd() * 0.8));
// Boden
tris.push(-30, 0, -30, 30, 0, -30, 30, 0, 30, -30, 0, -30, 30, 0, 30, -30, 0, 30);
const T = new Float32Array(tris);
const n = T.length / 9;
const mat = new Uint16Array(n).map((_, i) => i % 7);
let t0 = performance.now();
const blas = TriBVH.build(T, mat, null);
console.log(`Dreiecke: ${n}, Knoten: ${blas.nodeCount}, Aufbau ${(performance.now() - t0).toFixed(0)} ms`);

function brute(o, d) {
  let best = Infinity, bi = -1;
  for (let i = 0; i < n; i++) {
    const p = i * 9;
    const v0 = [T[p], T[p + 1], T[p + 2]], e1 = [T[p + 3] - v0[0], T[p + 4] - v0[1], T[p + 5] - v0[2]], e2 = [T[p + 6] - v0[0], T[p + 7] - v0[1], T[p + 8] - v0[2]];
    const px = d[1] * e2[2] - d[2] * e2[1], py = d[2] * e2[0] - d[0] * e2[2], pz = d[0] * e2[1] - d[1] * e2[0];
    const det = e1[0] * px + e1[1] * py + e1[2] * pz;
    if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det, tx = o[0] - v0[0], ty = o[1] - v0[1], tz = o[2] - v0[2];
    const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
    const qx = ty * e1[2] - tz * e1[1], qy = tz * e1[0] - tx * e1[2], qz = tx * e1[1] - ty * e1[0];
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * qx + e2[1] * qy + e2[2] * qz) * inv;
    if (t > 1e-6 && t < best) { best = t; bi = i; }
  }
  return { t: best, i: bi };
}

const sc = new LidarScene();
sc.addInstance(sc.addBlas(blas), null);
// zweite Instanz: gleiche Geometrie verschoben und gedreht (90° um y)
sc.addInstance(0, [0, 0, 1, 50, 0, 1, 0, 0, -1, 0, 0, 0]);
let bad = 0;
for (let k = 0; k < 3000; k++) {
  const o = [rnd() * 6 - 3, 1 + rnd() * 2, rnd() * 6 - 3];
  let d = [rnd() * 2 - 1, rnd() * 2 - 1.2, rnd() * 2 - 1]; const l = Math.hypot(...d); d = d.map((x) => x / l);
  const b = brute(o, d);
  const hit = sc.cast(o[0], o[1], o[2], d[0], d[1], d[2], 1e-6, 1e9);
  const t = hit ? sc.hit.t : Infinity;
  if (Math.abs(t - b.t) > 1e-4 && !(t === Infinity && b.t === Infinity)) { if (!(t < b.t && sc.hit.inst === 1)) { bad++; console.log("Abweichung", t, b.t, sc.hit.inst, o, d); } }
}
assert.equal(bad, 0, 'BVH weicht von Brute-Force ab: ' + bad);
console.log('✓ 3000 Strahlen stimmen mit Brute-Force überein');

// Instanz-Test: Strahl auf die gedrehte Kopie trifft dieselbe Kugel
{
  const o = [0, 1.5, 0], d = [0.3, -0.1, 0.9]; const l = Math.hypot(...d);
  const a = sc.cast(...o, ...d.map((x) => x / l), 1e-6, 1e9) ? sc.hit.t : Infinity;
  // Kopie: Welt = R·lokal + (50,0,0), R: x' = z, z' = -x. Lokaler Strahl o_l = R^-1(o - t)
  const ow = [50 + o[2], o[1], -o[0]], dw = [d[2] / l, d[1] / l, -d[0] / l];
  const b = sc.cast(...ow, ...dw, 1e-6, 1e9) ? sc.hit.t : Infinity;
  assert.ok(Math.abs(a - b) < 1e-4, `Instanz ${a} vs ${b}`);
  console.log('✓ Instanz-Transformation korrekt');
}

// Durchsatz
const N = 400000;
const dirs = new Float32Array(N * 3);
for (let k = 0; k < N; k++) { const th = rnd() * Math.PI * 2, el = (rnd() - 0.6) * 1.2; dirs[k * 3] = Math.cos(el) * Math.cos(th); dirs[k * 3 + 1] = Math.sin(el); dirs[k * 3 + 2] = Math.cos(el) * Math.sin(th); }
t0 = performance.now();
let hits = 0;
for (let k = 0; k < N; k++) if (sc.cast(0, 1.5, 0, dirs[k * 3], dirs[k * 3 + 1], dirs[k * 3 + 2], 1e-4, 200)) hits++;
const ms = performance.now() - t0;
console.log(`Durchsatz: ${(N / ms * 1000 / 1e6).toFixed(2)} M Strahlen/s (${hits} Treffer)`);

// Kohärente Strahlen wie bei einem rotierenden LiDAR (16 Kanäle, 0,2°-Schritte)
{
  const el = [-15, 1, -13, 3, -11, 5, -9, 7, -7, 9, -5, 11, -3, 13, -1, 15].map((d) => d * Math.PI / 180);
  const cols = 1800 * 14;
  let h2 = 0;
  const t1 = performance.now();
  for (let c = 0; c < cols; c++) {
    const az = (c % 1800) / 1800 * Math.PI * 2;
    for (let k = 0; k < 16; k++) {
      const ce = Math.cos(el[k]);
      if (sc.cast(0.3, 1.2, 0.2, ce * Math.cos(az), Math.sin(el[k]), ce * Math.sin(az), 1e-4, 100)) h2++;
    }
  }
  const ms2 = performance.now() - t1;
  console.log(`Durchsatz kohärent: ${(cols * 16 / ms2 * 1000 / 1e6).toFixed(2)} M Strahlen/s`);
}
