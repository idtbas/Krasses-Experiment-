// Scan-Worker: hält Szene (BVH), Materialtabelle und Sensoren und rechnet Schüsse in Zeitfenstern.
// Die Sensorpose wird je Schuss zwischen Fensteranfang und -ende interpoliert – so entsteht die
// echte Bewegungsverzerrung eines rotierenden Scanners auf einem fahrenden Roboter.
import { TriBVH, LidarScene } from './bvh.js';
import { BeamSim, PointSink } from './beam.js';
import { makePattern } from '../scanners/patterns.js';
import { postDepth } from './depthpost.js';

let scene = new LidarScene();
let mats = new Float32Array(16);
const sensors = new Map();
let env = { sun: 0, fogVis: 0, rain: 0, dust: 0, sunDir: [0.3, 0.8, 0.5], ambient: 0.45, sunI: 0.75 };

function hashSeed(a, b) {
  let h = 2166136261 ^ a;
  h = Math.imul(h ^ (b & 0xffffffff), 16777619);
  h = Math.imul(h ^ ((b / 4294967296) | 0), 16777619);
  return (h ^ (h >>> 13)) >>> 0;
}

function quatToMat(qx, qy, qz, qw, m) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  m[0] = 1 - (yy + zz); m[1] = xy - wz; m[2] = xz + wy;
  m[3] = xy + wz; m[4] = 1 - (xx + zz); m[5] = yz - wx;
  m[6] = xz - wy; m[7] = yz + wx; m[8] = 1 - (xx + yy);
}

// Pose zur Zeit u ∈ [0, 1] zwischen A und B: Position linear, Drehung normiert-linear (kurzer Weg)
function poseAt(A, B, u, out) {
  out.x = A[0] + (B[0] - A[0]) * u; out.y = A[1] + (B[1] - A[1]) * u; out.z = A[2] + (B[2] - A[2]) * u;
  let bx = B[3], by = B[4], bz = B[5], bw = B[6];
  if (A[3] * bx + A[4] * by + A[5] * bz + A[6] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let qx = A[3] + (bx - A[3]) * u, qy = A[4] + (by - A[4]) * u, qz = A[5] + (bz - A[5]) * u, qw = A[6] + (bw - A[6]) * u;
  const l = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  quatToMat(qx * l, qy * l, qz * l, qw * l, out.R);
}

function makeSensor(id, spec, set) {
  const prev = sensors.get(id) ? sensors.get(id).beam : null;
  const pattern = makePattern(spec, set);
  const beam = new BeamSim(scene, mats, spec, set);
  beam.setEnv(env);
  const s = { id, spec, set, pattern, beam, sink: new PointSink(1 << 15), pose: { x: 0, y: 0, z: 0, R: beam.R } };
  // Einzelgerät: wahre Strahlrichtung weicht je Kanal von der gemeldeten ab (Elevation, Azimut), dazu Entfernungs-
  // Offset und Intensitätsverstärkung je Kanal. Das Gerät meldet die Nennrichtung – genau so entstehen echte Fehler.
  const C = set.calib;
  if (C && C.dEl && C.dEl.length) {
    s.calib = { n: C.dEl.length, dEl: Float64Array.from(C.dEl), dAz: Float64Array.from(C.dAz), cE: new Float64Array(C.dEl.length), sE: new Float64Array(C.dEl.length), cA: Float64Array.from(C.dAz, Math.cos), sA: Float64Array.from(C.dAz, Math.sin) };
    beam.calR = Float64Array.from(C.dR); beam.calG = Float64Array.from(C.gain);
  }
  if (prev && prev.dyn) beam.dyn = prev.dyn;
  sensors.set(id, s);
  return s;
}

// wahre Richtung eines Kanals: Elevation um dEl anheben, um die Hochachse um dAz drehen
const TRUE_DIR = new Float64Array(3);
function trueDir(C, ring, x, y, z, out) {
  const k = ring % C.n;
  const de = C.dEl[k];
  if (de !== 0) {
    const hl = Math.sqrt(x * x + z * z), e = Math.atan2(y, hl) + de, ce = Math.cos(e);
    const f = hl > 1e-9 ? ce / hl : 0;
    x *= f; z *= f; y = Math.sin(e);
    if (hl <= 1e-9) x = ce;
  }
  const c = C.cA[k], sn = C.sA[k];
  out[0] = x * c + z * sn; out[1] = y; out[2] = -x * sn + z * c;
  return out;
}

// Schüsse eines Fensters rechnen
function runWindow(s, t0, t1, A, B) {
  const beam = s.beam, sink = s.sink, pose = s.pose;
  const span = t1 - t0 || 1;
  const fixed = A[0] === B[0] && A[1] === B[1] && A[2] === B[2] && A[3] === B[3] && A[4] === B[4] && A[5] === B[5] && A[6] === B[6];
  if (fixed) poseAt(A, B, 0, pose);
  let shots = 0;
  const R = pose.R;
  const C = s.calib;
  const tl = TRUE_DIR;
  s.pattern.shots(t0, t1, (t, lx, ly, lz, ring, col) => {
    if (!fixed) poseAt(A, B, (t - t0) / span, pose);
    let ax = lx, ay = ly, az = lz;
    if (C) { trueDir(C, ring, lx, ly, lz, tl); ax = tl[0]; ay = tl[1]; az = tl[2]; }
    const dx = R[0] * ax + R[1] * ay + R[2] * az, dy = R[3] * ax + R[4] * ay + R[5] * az, dz = R[6] * ax + R[7] * ay + R[8] * az;
    beam.shoot(t, pose.x, pose.y, pose.z, dx, dy, dz, lx, ly, lz, ring, col, sink);
    shots++;
  });
  return shots;
}

function runTls(s, c0, c1, P) {
  const beam = s.beam, sink = s.sink, pose = s.pose;
  poseAt(P, P, 0, pose);
  const R = pose.R;
  let shots = 0;
  const C = s.calib, tl = TRUE_DIR;
  s.pattern.columns(c0, c1, (t, lx, ly, lz, ring, col) => {
    let ax = lx, ay = ly, az = lz;
    if (C) { trueDir(C, ring, lx, ly, lz, tl); ax = tl[0]; ay = tl[1]; az = tl[2]; }
    const dx = R[0] * ax + R[1] * ay + R[2] * az, dy = R[3] * ax + R[4] * ay + R[5] * az, dz = R[6] * ax + R[7] * ay + R[8] * az;
    beam.shoot(t, pose.x, pose.y, pose.z, dx, dy, dz, lx, ly, lz, ring, col, sink);
    shots++;
  });
  return shots;
}

self.onmessage = (ev) => {
  const m = ev.data;
  try {
    switch (m.type) {
      case 'scene': {
        scene = new LidarScene();
        for (const b of m.blas) scene.addBlas(new TriBVH(b));
        for (const it of m.inst) scene.addInstance(it.blas, it.m, it.obj ?? -1);
        scene.rebuild();
        mats = m.mats;
        for (const s of sensors.values()) { s.beam.scene = scene; s.beam.mats = mats; }
        self.postMessage({ type: 'sceneReady', tris: m.blas.reduce((a, b) => a + b.count, 0) });
        break;
      }
      case 'matrices': {
        const L = m.list; // [idx, enabled, 12 Werte] …
        for (let k = 0; k < L.length; k += 14) {
          const i = L[k];
          scene.inst[i].enabled = L[k + 1] > 0;
          scene.setMatrix(i, L.subarray(k + 2, k + 14));
        }
        break;
      }
      case 'materials': mats = m.mats; for (const s of sensors.values()) s.beam.mats = mats; break;
      case 'env': {
        env = { ...env, ...m.env };
        for (const s of sensors.values()) s.beam.setEnv(env);
        break;
      }
      case 'sensor': {
        makeSensor(m.id, m.spec, m.set || {});
        break;
      }
      case 'drop': sensors.delete(m.id); break;
      case 'sstate': { const s = sensors.get(m.id); if (s) s.beam.dyn = { ...(s.beam.dyn || {}), ...m.st }; break; }
      case 'scan': {
        const s = sensors.get(m.id);
        if (!s) return;
        const tt = performance.now();
        s.beam.rng.seed(hashSeed(m.id.length * 131 + m.id.charCodeAt(0), Math.floor(m.t0 * 1e6)));
        const shots = runWindow(s, m.t0, m.t1, m.A, m.B);
        const data = s.sink.take();
        self.postMessage({ type: 'points', id: m.id, job: m.job, part: m.part, t0: m.t0, t1: m.t1, shots, data, ms: performance.now() - tt }, PointSink.transferables(data));
        break;
      }
      case 'tls': {
        const s = sensors.get(m.id);
        if (!s) return;
        const tt = performance.now();
        s.beam.rng.seed(hashSeed(77, m.c0 * 7919 + m.c1));
        const shots = runTls(s, m.c0, m.c1, m.P);
        const data = s.sink.take();
        self.postMessage({ type: 'points', id: m.id, job: m.job, part: m.part, c0: m.c0, c1: m.c1, shots, data, ms: performance.now() - tt }, PointSink.transferables(data));
        break;
      }
      case 'depth': {
        // Tiefenbild (Flash/iToF/Smartphone): ganze Bilder mit Nachverarbeitung
        const s = sensors.get(m.id);
        if (!s) return;
        const tt = performance.now();
        s.beam.rng.seed(hashSeed(99, Math.floor(m.t * 1e6)));
        const out = postDepth(s, m, scene, mats, poseAt);
        self.postMessage({ type: 'depth', id: m.id, job: m.job, t: m.t, ...out.msg, ms: performance.now() - tt }, out.transfer);
        break;
      }
      case 'cast': {
        // einzelner Strahl (Auswahl, Messen in der Szene)
        const hit = scene.cast(m.o[0], m.o[1], m.o[2], m.d[0], m.d[1], m.d[2], 0, m.max || 500);
        self.postMessage({ type: 'cast', job: m.job, hit: hit ? { t: scene.hit.t, obj: scene.hit.obj, mat: scene.hit.mat, n: [scene.hit.nx, scene.hit.ny, scene.hit.nz] } : null });
        break;
      }
    }
  } catch (e) {
    self.postMessage({ type: 'error', job: m.job, id: m.id, message: e.message, stack: e.stack });
  }
};
