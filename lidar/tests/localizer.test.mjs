// Tests der Positionsbestimmung: Punkt-zu-Ebene-Registrierung gegen die Voxelkarte findet eine bekannte Fehlpose,
// das Driftmodell der Rad-Odometrie wächst mit der Strecke, Referenz bleibt exakt. node lidar/tests/localizer.test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./three-hook.mjs', import.meta.url);
const THREE = await import('three');
const { VoxelMap, alignToMap, Localizer } = await import('../js/cloud/localizer.js');

let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// Raum 10 × 3 × 7 m mit Kiste und Säule als Flächenmodell; Strahlen aus einem Sensorort (wie ein Scan)
const boxes = [[-5, 0, -3.5, 5, 3, 3.5, true], [1, 0, -1.4, 2.2, 0.9, -0.6, false], [-2, 0, 0.8, -1.6, 3, 1.2, false]];
function cast(o, d) {
  let best = Infinity;
  for (const [x0, y0, z0, x1, y1, z1, inside] of boxes) {
    const t0 = [(x0 - o[0]) / d[0], (y0 - o[1]) / d[1], (z0 - o[2]) / d[2]], t1 = [(x1 - o[0]) / d[0], (y1 - o[1]) / d[1], (z1 - o[2]) / d[2]];
    const tmin = Math.max(...t0.map((a, i) => Math.min(a, t1[i]))), tmax = Math.min(...t0.map((a, i) => Math.max(a, t1[i])));
    const t = inside ? tmax : tmin <= tmax && tmin > 0 ? tmin : Infinity;
    if (t > 0.05 && t < best) best = t;
  }
  return best;
}
// Scan im Sensorsystem (Ringe gleichmäßig über ±fov/2, 0,4° Spalten) von der Pose M aus
function scan(M, noise = 0.01, rings = 16, fov = 30) {
  const R = new THREE.Matrix4().extractRotation(M), o = new THREE.Vector3().setFromMatrixPosition(M);
  const out = [];
  for (let r = 0; r < rings; r++) for (let c = 0; c < 900; c++) {
    const el = (-fov / 2 + r * fov / (rings - 1)) * Math.PI / 180, az = c * 0.4 * Math.PI / 180;
    const dl = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const dw = dl.clone().applyMatrix4(R);
    const t = cast([o.x, o.y, o.z], [dw.x || 1e-9, dw.y || 1e-9, dw.z || 1e-9]);
    if (!isFinite(t)) continue;
    const tt = t + gauss() * noise;
    out.push(dl.x * tt, dl.y * tt, dl.z * tt);
  }
  return new Float32Array(out);
}
const pose = (x, y, z, yaw) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
const transform = (pts, M) => { const v = new THREE.Vector3(), out = new Float32Array(pts.length); for (let i = 0; i < pts.length; i += 3) { v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(M); out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z; } return out; };

// 1) Karte aus zwei Standpunkten, dritter Scan mit 25 cm / 4° Fehlstart wird zurückgeholt.
//    64 Kanäle über 45°: Millimeter. 16 Kanäle über 30°: Boden kaum im Blick, Höhe nur auf etwa 1 cm bestimmt.
for (const [rings, fov, tolP, tolA] of [[64, 45, 0.004, 0.05], [16, 30, 0.025, 0.4]]) {
  const map = new VoxelMap(0.2);
  for (const M of [pose(0, 1, 0, 0), pose(-2.5, 1, -1.5, 0.6)]) { const w = transform(scan(M, 0.01, rings, fov), M); for (let i = 0; i < w.length; i += 3) map.insert(w[i], w[i + 1], w[i + 2]); }
  const truth = pose(1.2, 1.05, 1.5, 1.1);
  const src = scan(truth, 0.01, rings, fov);
  const sub = []; for (let i = 0; i < src.length / 3; i += 7) sub.push(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]);
  const T = pose(1.2 + 0.18, 1.05 - 0.05, 1.5 - 0.17, 1.1 + 4 * Math.PI / 180);
  const t0 = performance.now();
  const res = alignToMap(map, new Float32Array(sub), T, { iters: 16 });
  const ms = performance.now() - t0;
  const dp = new THREE.Vector3().setFromMatrixPosition(T).distanceTo(new THREE.Vector3().setFromMatrixPosition(truth));
  const q1 = new THREE.Quaternion().setFromRotationMatrix(T), q2 = new THREE.Quaternion().setFromRotationMatrix(truth);
  const dA = q1.angleTo(q2) * 180 / Math.PI;
  console.log(`Scan-zu-Karte ${rings} Kanäle: ${map.size} Voxel, ${sub.length / 3} Punkte, RMS ${(res.rms * 1000).toFixed(1)} mm, Rest ${(dp * 1000).toFixed(1)} mm / ${dA.toFixed(3)}°, ${ms.toFixed(0)} ms`);
  assert.ok(res.ok, 'Registrierung erfolgreich');
  assert.ok(dp < tolP, `Position auf ${tolP * 100} cm`);
  assert.ok(dA < tolA, `Kurs auf ${tolA}°`);
}

// 2) Driftmodelle: Referenz exakt, Rad-Odometrie wächst mit der Strecke (Quadrat 4 × 4 m, zwei Runden)
{
  const mk = (mode, drift) => {
    const dev = { kind: 'stream', set: {}, pattern: { period: 0.1 }, spec: {}, onPoints: [], t: 0, P: [0, 1, 0, 0, 0, 0, 1], pose() { return this.P; } };
    const scanObj = { cloud: { add() {} } };
    return { dev, loc: new Localizer({}, dev, scanObj, { mode, drift, seed: 99 }) };
  };
  const runs = { ideal: mk('ideal', 'wheel'), odo: mk('odo', 'wheel') };
  const corners = [[0, 0], [4, 0], [4, 4], [0, 4]];
  let t = 0;
  const errAt = {};
  for (const [name, { dev, loc }] of Object.entries(runs)) {
    t = 0;
    const q = new THREE.Quaternion();
    for (let lap = 0; lap < 2; lap++) for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
      const yaw = Math.atan2(bx - ax, bz - az);
      for (let s = 0; s <= 1; s += 0.01) {
        t += 0.04;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        dev.P = [ax + (bx - ax) * s, 1, az + (bz - az) * s, q.x, q.y, q.z, q.w];
        dev.t = t;
        loc.update(t);
      }
    }
    errAt[name] = loc.stats.errP;
  }
  console.log(`Driftmodell nach ${runs.odo.loc.stats.dist.toFixed(0)} m: Referenz ${(errAt.ideal * 100).toFixed(2)} cm, Rad-Odometrie ${(errAt.odo * 100).toFixed(1)} cm`);
  assert.ok(errAt.ideal < 1e-6, 'Referenz exakt');
  assert.ok(errAt.odo > 0.03 && errAt.odo < 3, 'Odometrie driftet im typischen Rahmen');
}
console.log('localizer: alle Tests bestanden');
