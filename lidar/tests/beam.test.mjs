// Physikalische Plausibilitätstests des Strahlmodells. node lidar/tests/beam.test.mjs
import assert from 'node:assert/strict';
import { TriBVH, LidarScene } from '../js/engine/bvh.js';
import { BeamSim, PointSink, packMaterials } from '../js/engine/beam.js';
import { makePattern } from '../js/scanners/patterns.js';
import { BY_ID } from '../js/scanners/catalog.js';

// Materialien: 0 Boden (Beton 25 %), 1 Weiß 90 %, 2 Schwarz 5 %, 3 Glas, 4 Spiegel, 5 Retro
const MATS = packMaterials([
  { r: 0.25, cls: 2 }, { r: 0.9, cls: 6 }, { r: 0.05, cls: 6 }, { kind: 'glass', r: 0.0, spec: 6, specWidth: 0.012, trans: 0.92, cls: 6 },
  { kind: 'mirror', r: 0.01, trans: 0.92, cls: 6 }, { kind: 'retro', r: 0.3, retro: 400, cls: 6 },
]);
const tris = [], mat = [], obj = [];
const quad = (a, b, c, d, m, o) => { tris.push(...a, ...b, ...c, ...a, ...c, ...d); mat.push(m, m); obj.push(o, o); };
// Boden 120 × 120 m
quad([-60, 0, -60], [60, 0, -60], [60, 0, 60], [-60, 0, 60], 0, 1);
// Wand vorne (z = 10), weiß, x −3…3
quad([-3, 0, 10], [3, 0, 10], [3, 3, 10], [-3, 3, 10], 1, 2);
// davor eine Kiste-Kante: Platte z = 9.6 (40 cm vor der Wand) x 0…3 – Mischpixel an der Kante x = 0
quad([0, 0, 9.6], [3, 0, 9.6], [3, 2, 9.6], [0, 2, 9.6], 1, 3);
// Glasscheibe links (x = −10), dahinter Wand bei x = −14
quad([-10, 0, -3], [-10, 0, 3], [-10, 3, 3], [-10, 3, -3], 3, 4);
quad([-14, 0, -3], [-14, 0, 3], [-14, 3, 3], [-14, 3, -3], 1, 5);
// Spiegel rechts (x = +6), senkrecht → Geister bei x > 6
quad([6, 0, -2], [6, 0, 2], [6, 2.5, 2], [6, 2.5, -2], 4, 6);
// hinter dem Betrachter (z = −8): weiße Wand, über den Spiegel sichtbar? (Spiegel zeigt nach −x)
quad([-3, 0, -8], [3, 0, -8], [3, 3, -8], [-3, 3, -8], 1, 7);
// Retroreflektor (Schild) bei z = −5, x = 0
quad([-0.3, 0.8, -5], [0.3, 0.8, -5], [0.3, 1.4, -5], [-0.3, 1.4, -5], 5, 8);
// schwarze und weiße Tafel in 45 m Entfernung (x = 0, z = −45 … ) – VLP-16: r10 = 40 m
quad([-45, 0, 14], [-45, 0, 18], [-45, 4, 18], [-45, 4, 14], 2, 9);
quad([-45, 0, 20], [-45, 0, 24], [-45, 4, 24], [-45, 4, 20], 1, 10);

const blas = TriBVH.build(new Float32Array(tris), new Uint16Array(mat), new Uint16Array(obj));
const scene = new LidarScene();
scene.addInstance(scene.addBlas(blas), null);
scene.rebuild();

const spec = BY_ID.vlp16;
const beam = new BeamSim(scene, MATS, spec, { returns: 'dual', subrays: 5 });
beam.setEnv({});
const pat = makePattern(spec, { hz: 10 });
const sink = new PointSink();
const H = 1.0; // Sensorhöhe
let shots = 0;
pat.shots(0, 0.1, (t, x, y, z, ring, col) => { beam.shoot(t, 0, H, 0, x, y, z, x, y, z, ring, col, sink); shots++; });
const n = sink.n;
console.log(`Schüsse ${shots}, Punkte ${n} (${(n / shots * 100).toFixed(0)} %)`);

const P = (k) => [sink.w[k * 3], sink.w[k * 3 + 1], sink.w[k * 3 + 2]];
// 1) Ring −15° auf dem Boden: r = H / sin 15° = 3,86 m (horizontal 3,73 m)
{
  const ds = [];
  for (let k = 0; k < n; k++) if (sink.ring[k] === 0 && sink.obj[k] === 1) { const p = P(k); ds.push(Math.hypot(p[0], p[2])); }
  ds.sort((a, b) => a - b);
  const med = ds[ds.length >> 1];
  assert.ok(Math.abs(med - H / Math.tan(15 * Math.PI / 180)) < 0.05, 'Ring −15°: ' + med);
  console.log(`✓ Ring −15° am Boden bei ${med.toFixed(3)} m (Soll ${(H / Math.tan(15 * Math.PI / 180)).toFixed(3)} m)`);
}
// 2) Glas: Punkte auf der Wand hinter dem Glas (x ≈ −14)
{
  let behind = 0, onGlass = 0;
  for (let k = 0; k < n; k++) { const p = P(k); if (sink.obj[k] === 5) behind++; if (sink.obj[k] === 4) onGlass++; }
  assert.ok(behind > 50, 'hinter Glas: ' + behind);
  console.log(`✓ Glas: ${behind} Punkte auf der Wand dahinter, ${onGlass} auf der Scheibe (Reflex nur bei senkrechtem Auftreffen)`);
}
// 3) Spiegel: Geisterpunkte jenseits des Spiegels (x > 6.05)
{
  let ghosts = 0;
  for (let k = 0; k < n; k++) { const p = P(k); if (p[0] > 6.05 && (sink.f[k] & 8)) ghosts++; }
  assert.ok(ghosts > 20, 'Geister: ' + ghosts);
  console.log(`✓ Spiegel: ${ghosts} Geisterpunkte hinter der Spiegelfläche`);
}
// 4) Retroreflektor: gesättigt (Reflektivität > 100) und Blooming-Phantompunkte
{
  let sat = 0, bloom = 0;
  for (let k = 0; k < n; k++) { if (sink.obj[k] === 8 && sink.i[k] > 100) sat++; if (sink.f[k] & 64) bloom++; }
  assert.ok(sat > 0 && bloom > 0, `Retro ${sat} / Bloom ${bloom}`);
  console.log(`✓ Retroreflektor: ${sat} gesättigte Punkte, ${bloom} Blooming-Phantome`);
}
// 5) Reichweite: weiße Tafel in 45 m sichtbar, schwarze (5 %) nicht
{
  let white = 0, black = 0;
  for (let k = 0; k < n; k++) { if (sink.obj[k] === 10) white++; if (sink.obj[k] === 9) black++; }
  assert.ok(white > 10 && black < white * 0.1, `weiß ${white}, schwarz ${black}`);
  console.log(`✓ Reichweite 45 m: weiß ${white} Punkte, schwarz (5 %) ${black} Punkte`);
}
// 6) Mischpixel an der Kante x = 0 zwischen Platte (9,6 m) und Wand (10 m): Entfernungen dazwischen
{
  let mixed = 0;
  for (let k = 0; k < n; k++) { const p = P(k); if (p[2] > 9.65 && p[2] < 9.95 && Math.abs(p[0]) < 0.3 && p[1] > 0.1) mixed++; }
  console.log(`✓ Mischpixel an der Kante: ${mixed} Punkte zwischen Vorder- und Hintergrund`);
}
// 7) Nebel: Rückstreupunkte im Nahbereich, mit „letztem Echo“ weniger
{
  const fog = new BeamSim(scene, MATS, spec, { returns: 'strongest' }); fog.setEnv({ fogVis: 40 });
  const s2 = new PointSink(); let near = 0;
  pat.shots(0, 0.1, (t, x, y, z, ring, col) => fog.shoot(t, 0, H, 0, x, y, z, x, y, z, ring, col, s2));
  for (let k = 0; k < s2.n; k++) if (s2.f[k] & 16) near++;
  const fogL = new BeamSim(scene, MATS, spec, { returns: 'last' }); fogL.setEnv({ fogVis: 40 });
  const s3 = new PointSink(); let nearL = 0;
  pat.shots(0, 0.1, (t, x, y, z, ring, col) => fogL.shoot(t, 0, H, 0, x, y, z, x, y, z, ring, col, s3));
  for (let k = 0; k < s3.n; k++) if (s3.f[k] & 16) nearL++;
  assert.ok(near > nearL, 'Nebel letzte Echos');
  console.log(`✓ Nebel (Sicht 40 m): ${near} Nebelpunkte mit stärkstem Echo, ${nearL} mit letztem Echo`);
}
// Durchsatz
{
  const t0 = performance.now(); const s4 = new PointSink(); let sh = 0;
  pat.shots(0, 1.0, (t, x, y, z, ring, col) => { beam.shoot(t, 0, H, 0, x, y, z, x, y, z, ring, col, s4); sh++; });
  const ms = performance.now() - t0;
  console.log(`Durchsatz VLP-16, 5 Teilstrahlen: ${(sh / ms * 1000 / 1e3).toFixed(0)} Tsd. Schüsse/s (Echtzeit: 289 Tsd./s) → ${(sh / ms / 289).toFixed(2)}× Echtzeit je Kern`);
}
