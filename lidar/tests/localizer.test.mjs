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

// 2) Fahrt im Raum (Rechteck 6,5 × 5 m, an den Ecken drehen), VLP-16-artiger Sensor mit Zeitstempeln je Spalte:
//    Referenz exakt, Rad-Odometrie driftet deutlich, LiDAR-SLAM mit Entzerrung hält den Fehler bei wenigen Zentimetern.
function simulate(mode, deskew = true, drift = 'wheel', rings = 16, fov = 30, noise = 0.015, opts = {}) {
  const dev = { kind: 'stream', set: {}, pattern: { period: 0.1 }, spec: {}, onPoints: [], t: 0, doneUntil: 0, P: [0, 1, 0, 0, 0, 0, 1], pose() { return this.P; } };
  const scanObj = { cloud: { add() {} } };
  const loc = new Localizer({}, dev, scanObj, { mode, drift, seed: 99, deskew });
  const C = [[-3, -2.5], [3.5, -2.5], [3.5, 2.5], [-3, 2.5]];
  // Bahn als Funktion der Zeit: gerade Stücke 0,5 m/s, an Ecken 1 s Drehung
  const segs = [];
  for (let k = 0; k < 4; k++) { const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4]; segs.push({ ax, az, bx, bz, yaw: Math.atan2(bx - ax, bz - az), T: Math.hypot(bx - ax, bz - az) / 0.5 }); }
  const total = segs.reduce((a, s) => a + s.T + 1, 0);
  const poseAt = (t) => {
    t = t % total;
    for (let k = 0; k < 4; k++) {
      const s = segs[k], n = segs[(k + 1) % 4];
      if (t < s.T) { const u = t / s.T; return [s.ax + (s.bx - s.ax) * u, 1.0, s.az + (s.bz - s.az) * u, s.yaw]; }
      t -= s.T;
      if (t < 1) { let dy = n.yaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); return [s.bx, 1.0, s.bz, s.yaw + dy * t]; }
      t -= 1;
    }
    return [C[0][0], 1, C[0][1], segs[0].yaw];
  };
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), V1 = new THREE.Vector3(1, 1, 1);
  const set = (t) => { const [x, y, z, yaw] = poseAt(t); q.setFromAxisAngle(Y, yaw); dev.P = [x, y, z, q.x, q.y, q.z, q.w]; M.compose(v.set(x, y, z), q, V1); return M; };
  const end = opts.end || total * 1.05;
  let t = 0, nextFrame = 0.1;
  while (t < end) {
    t += 0.02;
    set(t);
    dev.t = t;
    if (t >= nextFrame - 1e-9) {
      const t0 = nextFrame - 0.1;
      const ls = [], w = [], T = [];
      for (let c = 0; c < 450; c++) {
        const tc = t0 + 0.1 * c / 450;
        const Mc = set(tc).clone();
        const R = new THREE.Matrix4().extractRotation(Mc), o = new THREE.Vector3().setFromMatrixPosition(Mc);
        for (let r = 0; r < rings; r++) {
          const el = (-fov / 2 + r * fov / (rings - 1)) * Math.PI / 180, az = c * 0.8 * Math.PI / 180;
          const dl = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
          const dw = dl.clone().applyMatrix4(R);
          const d = cast([o.x, o.y, o.z], [dw.x || 1e-9, dw.y || 1e-9, dw.z || 1e-9]);
          if (!isFinite(d)) continue;
          const dd = d + gauss() * noise;
          ls.push(dl.x * dd, dl.y * dd, dl.z * dd);
          const p = new THREE.Vector3(dl.x * dd, dl.y * dd, dl.z * dd).applyMatrix4(Mc);
          w.push(p.x, p.y, p.z); T.push(tc);
        }
      }
      set(t);
      const n = T.length;
      const b = { n, ls: new Float32Array(ls), w: new Float32Array(w), t: new Float32Array(T) };
      for (const f of dev.onPoints) f(b);
      dev.doneUntil = nextFrame;
      nextFrame += 0.1;
    }
    loc.update(t);
  }
  return { errP: loc.stats.errP, errYaw: loc.stats.errYaw, fails: loc.stats.fails, dist: loc.stats.dist };
}
{
  const end = 24;
  const r = { ideal: simulate('ideal', true, 'wheel', 16, 30, 0.015, { end }), odo: simulate('odo', true, 'wheel', 16, 30, 0.015, { end }), slam: simulate('slam', true, 'wheel', 16, 30, 0.015, { end }) };
  const f = (x) => `${(x.errP * 100).toFixed(1)} cm / ${x.errYaw.toFixed(2)}°`;
  console.log(`Fahrt ${r.odo.dist.toFixed(1)} m: Referenz ${f(r.ideal)}, Rad-Odometrie ${f(r.odo)}, SLAM ${f(r.slam)}`);
  assert.ok(r.ideal.errP < 1e-6, 'Referenz exakt');
  assert.ok(r.odo.errP > 0.1, 'Odometrie driftet');
  assert.ok(r.slam.errP < 0.06 && r.slam.errYaw < 0.5, 'SLAM hält die Bahn');
  assert.ok(r.slam.errP < r.odo.errP / 4, 'SLAM deutlich besser als Odometrie');
}
console.log('localizer: alle Tests bestanden');
