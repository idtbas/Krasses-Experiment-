// Tests der Punktwolken-Verarbeitung: ICP findet eine bekannte Verschiebung, TSDF vernetzt eine Kugel, Filter. node lidar/tests/proc.test.mjs
import assert from 'node:assert/strict';
import { icp, tsdfMesh, voxelKeep, sorKeep, groundMask, c2m } from '../js/cloud/procworker.js';

let seed = 3; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
// Raum 8 × 3 × 6 m mit Kiste und Säule: Punkte auf Flächen
function room(n, noise = 0.003) {
  const out = [];
  const add = (x, y, z) => out.push(x + gauss() * noise, y + gauss() * noise, z + gauss() * noise);
  for (let i = 0; i < n; i++) {
    const f = rnd() * 7.2;
    if (f < 1) add(rnd() * 8 - 4, 0, rnd() * 6 - 3);
    else if (f < 2) add(rnd() * 8 - 4, rnd() * 3, -3);
    else if (f < 3) add(-4, rnd() * 3, rnd() * 6 - 3);
    else if (f < 4) add(4, rnd() * 3, rnd() * 6 - 3);
    else if (f < 5) add(rnd() * 8 - 4, rnd() * 3, 3);
    else if (f < 6) { const s = rnd(); if (s < 0.33) add(1 + rnd(), 0.8, -1 + rnd() * 0.6); else if (s < 0.66) add(1, rnd() * 0.8, -1 + rnd() * 0.6); else add(1 + rnd(), rnd() * 0.8, -1); }
    else { const a = rnd() * Math.PI * 2; add(-1.5 + Math.cos(a) * 0.2, rnd() * 3, 1 + Math.sin(a) * 0.2); }
  }
  return new Float32Array(out);
}
{
  const tgt = room(60000);
  const src = room(20000, 0.004);
  // bekannte Fehlausrichtung: 9 cm / −6 cm / 2 cm und 1,8° um die Hochachse
  const ang = 1.8 * Math.PI / 180, c = Math.cos(ang), s = Math.sin(ang);
  const init = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0.09, 0.02, -0.06, 1];
  const t0 = performance.now();
  const r = icp(src, tgt, init, {});
  const T = r.T;
  const err = Math.hypot(T[12], T[13], T[14]);
  const rot = Math.atan2(T[8], T[0]) * 180 / Math.PI;
  console.log(`ICP: ${r.iters} Iterationen, RMS ${(r.rms * 1000).toFixed(2)} mm, Überlappung ${(r.overlap * 100).toFixed(0)} %, Restversatz ${(err * 1000).toFixed(1)} mm, Restdrehung ${rot.toFixed(3)}°, ${(performance.now() - t0).toFixed(0)} ms`);
  assert.ok(err < 0.004 && Math.abs(rot) < 0.05, 'ICP konvergiert nicht');
  console.log('✓ ICP findet die Ausrichtung');
}
{
  // Kugel r = 0,3 m, Scanner bei (2, 0, 0)
  const pts = [], rgb = [];
  for (let i = 0; i < 80000; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    const x = rr * Math.cos(a) * 0.3, y = u * 0.3, z = rr * Math.sin(a) * 0.3;
    pts.push(x, y, z); rgb.push(200, 200, 200);
  }
  // Ursprünge: sechs Richtungen
  const origins = new Float32Array([2, 0, 0, -2, 0, 0, 0, 2, 0, 0, -2, 0, 0, 0, 2, 0, 0, -2]);
  const oIndex = new Uint8Array(pts.length / 3);
  for (let i = 0; i < oIndex.length; i++) { const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2]; const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z); oIndex[i] = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5); }
  const t0 = performance.now();
  const m = tsdfMesh(new Float32Array(pts), new Uint8Array(rgb), origins, oIndex, 0.02, 0.06, null);
  let maxErr = 0, se = 0;
  for (let i = 0; i < m.pos.length; i += 3) { const e = Math.abs(Math.hypot(m.pos[i], m.pos[i + 1], m.pos[i + 2]) - 0.3); maxErr = Math.max(maxErr, e); se += e * e; }
  const rmsE = Math.sqrt(se / (m.pos.length / 3));
  console.log(`TSDF: ${m.pos.length / 3} Ecken, ${m.index.length / 3} Dreiecke, RMS ${(rmsE * 1000).toFixed(1)} mm, max. ${(maxErr * 1000).toFixed(1)} mm, ${(performance.now() - t0).toFixed(0)} ms`);
  assert.ok(m.index.length > 1000 && rmsE < 0.006 && maxErr < 0.02);
  console.log('✓ Surface Nets vernetzt die Kugel');
  // Soll-Ist gegen das eigene Netz: Abstand nahe 0
  const tris = new Float32Array(m.index.length * 3);
  for (let k = 0; k < m.index.length; k++) { tris[k * 3] = m.pos[m.index[k] * 3]; tris[k * 3 + 1] = m.pos[m.index[k] * 3 + 1]; tris[k * 3 + 2] = m.pos[m.index[k] * 3 + 2]; }
  const d = c2m(new Float32Array(pts.slice(0, 3000)), tris, 0.1);
  let mean = 0; for (const v of d) mean += Math.abs(v); mean /= d.length;
  console.log(`C2M: mittlerer Abstand ${(mean * 1000).toFixed(2)} mm`);
  assert.ok(mean < 0.006);
  console.log('✓ Abstand zum Netz');
}
{
  const p = room(40000);
  const k = voxelKeep(p, 0.1); let n = 0; for (const v of k) n += v;
  console.log(`Voxel 10 cm: ${n} von ${p.length / 3} behalten`);
  // Ausreißer hinzufügen
  const q = new Float32Array(p.length + 600);
  q.set(p); for (let i = 0; i < 200; i++) { q[p.length + i * 3] = rnd() * 8 - 4; q[p.length + i * 3 + 1] = 0.5 + rnd() * 2; q[p.length + i * 3 + 2] = rnd() * 6 - 3; }
  const s = sorKeep(q, 8, 2);
  let outl = 0; for (let i = p.length / 3; i < q.length / 3; i++) if (!s.keep[i]) outl++;
  console.log(`SOR: ${s.removed} entfernt, davon ${outl} von 200 echten Ausreißern`);
  assert.ok(outl > 150);
  const g = groundMask(p, 0.03);
  console.log(`Boden: ${g.count} Punkte, Ebene y = ${(-g.plane[3] / g.plane[1]).toFixed(3)} m`);
  assert.ok(Math.abs(g.plane[3]) < 0.02);
  console.log('✓ Filter und Bodenerkennung');
}
