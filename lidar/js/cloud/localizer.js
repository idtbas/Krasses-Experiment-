// Positionsbestimmung bewegter Scanner und Aufnahme in einen Projekt-Scan.
// Referenz: exakte Bahn (wie RTK-GNSS/INS in der Nachbearbeitung oder Encoder einer Robotersteuerung).
// Koppelnavigation: Rad-Odometrie (Fahrroboter), GNSS ohne RTK (Drohne) oder reine IMU (handgeführt) – jeweils mit
// dem typischen Fehlerwachstum. LiDAR-SLAM: Scan-zu-Karte-Registrierung je Umdrehung (Punkt-zu-Ebene gegen eine
// Voxelkarte mit Ebenen je Voxel), stützt die Koppelnavigation laufend.
// Entzerrung (Deskew): jeder Punkt mit der Pose seines Zeitstempels statt einer Pose je Umdrehung.
// Drehteller: Punkte werden über den Encoderwinkel in Objektkoordinaten gedreht und auf den Messraum beschnitten.
import * as THREE from 'three';

export const POSITIONING = [
  ['ideal', 'Referenz', 'Exakte Bahn – wie RTK/INS-Nachbearbeitung'],
  ['odo', 'Koppelnavigation', 'Nur Odometrie/GNSS/IMU: Drift wird sichtbar'],
  ['slam', 'LiDAR-SLAM', 'Scan-zu-Karte je Umdrehung, korrigiert die Drift'],
];

export const DRIFT = {
  wheel: { name: 'Rad-Odometrie + Kreisel', sub: 'Fehler wächst mit Strecke und Drehwinkel' },
  gnss: { name: 'GNSS/INS ohne RTK', sub: 'Meterfehler, wandert langsam' },
  imu: { name: 'Nur IMU', sub: 'Ohne Stützung wächst der Fehler quadratisch' },
  vio: { name: 'Visuell-inertial (ARKit)', sub: 'Kamera + IMU: etwa 1 % der Wegstrecke' },
  fixed: { name: 'Encoder', sub: 'Achs- und Drehtellerencoder' },
};

const ONE = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _v = new THREE.Vector3();

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Kurswinkel: Drehung um die Hochachse (aus der Vorwärtsrichtung bzw. bei senkrechtem Blick aus der Hochachse des Sensors)
function yawOf(q) {
  _v.set(0, 0, 1).applyQuaternion(q);
  if (Math.hypot(_v.x, _v.z) < 0.3) _v.set(0, 1, 0).applyQuaternion(q);
  return Math.atan2(_v.x, _v.z);
}

/* ---------------- Posenverlauf ---------------- */
class PoseLog {
  constructor(keep = 8) { this.L = []; this.keep = keep; }
  push(t, p, q) {
    const L = this.L, last = L[L.length - 1];
    if (last && t <= last.t + 1e-9) { last.p.copy(p); last.q.copy(q); return; }
    L.push({ t, p: p.clone(), q: q.clone() });
    while (L.length > 2 && L[0].t < t - this.keep) L.shift();
  }
  get last() { return this.L[this.L.length - 1]; }
  at(t, M) {
    const L = this.L;
    if (!L.length) return M.identity();
    if (t <= L[0].t) return M.compose(L[0].p, L[0].q, ONE);
    const n = L.length;
    if (t >= L[n - 1].t) return M.compose(L[n - 1].p, L[n - 1].q, ONE);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid].t <= t) lo = mid; else hi = mid; }
    const a = L[lo], b = L[hi], u = (t - a.t) / (b.t - a.t);
    _p.lerpVectors(a.p, b.p, u);
    _q.slerpQuaternions(a.q, b.q, u);
    return M.compose(_p, _q, ONE);
  }
}

/* ---------------- Voxelkarte mit Ebene je Voxel (für SLAM) ---------------- */
const OFF = 65536, SPAN = 131072;
function eig3(a, b, c, d, e, f) {
  // symmetrische 3×3-Matrix [a b c; b d e; c e f] → Eigenwerte (aufsteigend) und Eigenvektor zum kleinsten (Jacobi)
  const A = [[a, b, c], [b, d, e], [c, e, f]], V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 10; sweep++) {
    const off = A[0][1] ** 2 + A[0][2] ** 2 + A[1][2] ** 2;
    if (off < 1e-18) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
      for (let k = 0; k < 3; k++) { const x = A[k][p], y = A[k][q]; A[k][p] = cs * x - sn * y; A[k][q] = sn * x + cs * y; }
      for (let k = 0; k < 3; k++) { const x = A[p][k], y = A[q][k]; A[p][k] = cs * x - sn * y; A[q][k] = sn * x + cs * y; }
      for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = cs * x - sn * y; V[k][q] = sn * x + cs * y; }
    }
  }
  const ev = [0, 1, 2].sort((i, j) => A[i][i] - A[j][j]);
  const k = ev[0];
  return { l: ev.map((i) => A[i][i]), n: [V[0][k], V[1][k], V[2][k]] };
}

// Raster leicht versetzt: Böden und Wände auf runden Koordinaten liegen sonst genau auf Voxelgrenzen,
// jede Seite sähe nur eine Hälfte des Rauschens und die Ebenen wären um ±σ verschoben.
const GX = 0.3719, GY = 0.4231, GZ = 0.2873;
export class VoxelMap {
  constructor(size = 0.2) { this.v = size; this.m = new Map(); }
  get size() { return this.m.size; }
  key(ix, iy, iz) { return ((ix + OFF) * SPAN + (iy + OFF)) * SPAN + (iz + OFF); }
  cell(x, y, z) { const v = this.v; return [Math.floor(x / v + GX), Math.floor(y / v + GY), Math.floor(z / v + GZ)]; }
  insert(x, y, z) {
    const [ix, iy, iz] = this.cell(x, y, z), k = this.key(ix, iy, iz);
    let c = this.m.get(k);
    if (!c) { c = { n: 0, s: new Float64Array(9), fit: 0, ok: false, c: [0, 0, 0], nr: [0, 1, 0] }; this.m.set(k, c); }
    if (c.n >= 120) return;
    const s = c.s;
    s[0] += x; s[1] += y; s[2] += z; s[3] += x * x; s[4] += x * y; s[5] += x * z; s[6] += y * y; s[7] += y * z; s[8] += z * z;
    c.n++;
  }
  plane(c) {
    if (c.n < 6) return false;
    if (c.fit && c.n < c.fit * 1.3) return c.ok;
    const s = c.s, n = c.n, mx = s[0] / n, my = s[1] / n, mz = s[2] / n;
    const r = eig3(s[3] / n - mx * mx, s[4] / n - mx * my, s[5] / n - mx * mz, s[6] / n - my * my, s[7] / n - my * mz, s[8] / n - mz * mz);
    c.fit = n; c.c = [mx, my, mz]; c.nr = r.n;
    c.ok = r.l[0] < 0.12 * r.l[1] && r.l[1] > 1e-6;
    return c.ok;
  }
  // nächste Ebene zu einem Punkt (eigener Voxel, sonst die sechs Nachbarn)
  query(x, y, z, gate) {
    const v = this.v, [ix, iy, iz] = this.cell(x, y, z);
    let best = null, bd = gate;
    const test = (c) => {
      if (!c || !this.plane(c)) return;
      const dx = x - c.c[0], dy = y - c.c[1], dz = z - c.c[2];
      if (dx * dx + dy * dy + dz * dz > (1.6 * v) ** 2 + gate * gate) return;
      const d = Math.abs(dx * c.nr[0] + dy * c.nr[1] + dz * c.nr[2]);
      if (d < bd) { bd = d; best = c; }
    };
    test(this.m.get(this.key(ix, iy, iz)));
    if (best && bd < v * 0.25) return best;
    test(this.m.get(this.key(ix + 1, iy, iz))); test(this.m.get(this.key(ix - 1, iy, iz)));
    test(this.m.get(this.key(ix, iy + 1, iz))); test(this.m.get(this.key(ix, iy - 1, iz)));
    test(this.m.get(this.key(ix, iy, iz + 1))); test(this.m.get(this.key(ix, iy, iz - 1)));
    return best;
  }
}

function solve6(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 6; c++) {
    let p = c;
    for (let r = c + 1; r < 6; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < 6; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < 7; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(6);
  for (let r = 5; r >= 0; r--) { let s = M[r][6]; for (let k = r + 1; k < 6; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

// Punkt-zu-Ebene-Registrierung: src (Sensorsystem) gegen Karte, Start T (Matrix4, wird verfeinert).
// opts.prior: Standardabweichungen der Vorhersage [rx, ry, rz, tx, ty, tz] (Drehung um Weltachsen in rad, Weg in m)
// – wie die IMU-/Odometrie-Stützung echter Systeme. Ohne sie rutscht die Lösung entlang schlecht bestimmter
// Richtungen weg (nur senkrechte Wände im Blick: Höhe frei, langer Flur: Längsrichtung frei).
export function alignToMap(map, src, T, opts = {}) {
  const n = src.length / 3, e = T.elements;
  const P = new Float64Array(3);
  let rms = 0, inl = 0;
  const iters = opts.iters || 12;
  const wPt = 1 / ((opts.sigma || 0.03) ** 2);           // Gewicht je Punkt (Messrauschen + Kartenfehler)
  const prior = opts.prior ? opts.prior.map((s) => 1 / (s * s)) : null;
  const acc = [0, 0, 0, 0, 0, 0];                        // aufsummierte Korrektur gegenüber der Vorhersage
  for (let it = 0; it < iters; it++) {
    // Zuordnungsgrenze schrumpft: grob einfangen, fein nur noch echte Partnerflächen
    const gate = Math.max(0.07, [Math.max(0.5, map.v * 3), map.v * 2, map.v * 1.2, map.v * 0.8, map.v * 0.5][Math.min(4, it)] || 0.07);
    const A = Array.from({ length: 6 }, () => new Array(6).fill(0)), b = new Array(6).fill(0);
    const ox = e[12], oy = e[13], oz = e[14];
    let se = 0; inl = 0;
    for (let i = 0; i < n; i++) {
      const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
      P[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const c = map.query(P[0], P[1], P[2], gate);
      if (!c) continue;
      const nx = c.nr[0], ny = c.nr[1], nz = c.nr[2];
      const r = (P[0] - c.c[0]) * nx + (P[1] - c.c[1]) * ny + (P[2] - c.c[2]) * nz;
      const hub = Math.min(0.04, gate * 0.3), w = Math.abs(r) < hub ? 1 : hub / Math.abs(r);
      const px = P[0] - ox, py = P[1] - oy, pz = P[2] - oz;
      const J = [py * nz - pz * ny, pz * nx - px * nz, px * ny - py * nx, nx, ny, nz];
      for (let a = 0; a < 6; a++) { b[a] -= w * J[a] * r; for (let k = a; k < 6; k++) A[a][k] += w * J[a] * J[k]; }
      se += r * r; inl++;
    }
    if (inl < 40) return { ok: false, rms: 0, inl };
    for (let a = 0; a < 6; a++) for (let k = 0; k < a; k++) A[a][k] = A[k][a];
    for (let a = 0; a < 6; a++) { b[a] *= wPt; for (let k = 0; k < 6; k++) A[a][k] *= wPt; }
    if (prior) for (let a = 0; a < 6; a++) { A[a][a] += prior[a]; b[a] -= prior[a] * acc[a]; }
    const tr = (A[0][0] + A[1][1] + A[2][2] + A[3][3] + A[4][4] + A[5][5]) / 6;
    for (let a = 0; a < 6; a++) A[a][a] += tr * 1e-6;
    rms = Math.sqrt(se / inl);
    const x = solve6(A, b);
    if (!x) return { ok: false, rms, inl };
    for (let a = 0; a < 6; a++) acc[a] += x[a];
    // kleine Drehung um den Sensorort, dann Verschiebung
    const ang = Math.hypot(x[0], x[1], x[2]);
    _q.identity();
    if (ang > 1e-12) _q.setFromAxisAngle(_v.set(x[0] / ang, x[1] / ang, x[2] / ang), ang);
    _m.makeRotationFromQuaternion(_q);
    _m2.makeTranslation(-ox, -oy, -oz);
    _m.multiply(_m2);
    _m2.makeTranslation(ox + x[3], oy + x[4], oz + x[5]);
    _m2.multiply(_m);
    T.premultiply(_m2);
    if (ang < 2e-6 && Math.hypot(x[3], x[4], x[5]) < 2e-5) break;
  }
  return { ok: true, rms, inl, overlap: inl / n, corr: acc };
}

/* ---------------- Lokalisierung + Aufnahme ---------------- */
export class Localizer {
  constructor(app, dev, scan, o = {}) {
    this.app = app; this.dev = dev; this.scan = scan;
    this.mode = o.mode || 'ideal';
    this.drift = o.drift || 'fixed';
    this.deskew = o.deskew !== false;
    this.tt = o.turntable || null; // { plate, cx, cz, crop: { r, y0, y1 } }
    this.period = Math.max(0.05, dev.kind === 'depth' ? 1 / (dev.set.hz || 5) : dev.pattern.period || 0.1);
    this.truth = new PoseLog();
    this.odo = new PoseLog();
    this.ttLog = [];
    this.E = new THREE.Matrix4();            // Fehler der Koppelnavigation: odo = E · wahr
    this.C = new THREE.Matrix4();            // SLAM-Korrektur: Schätzung = C · odo
    this.map = this.mode === 'slam' ? new VoxelMap(o.voxel || 0.2) : null;
    this.st = null;
    this.r = rng(o.seed || 20251);
    this.K = this.driftParams();
    this.batches = [];
    this.fStart = null;
    this.stats = { frames: 0, rms: 0, inl: 0, fails: 0, errP: 0, errYaw: 0, ms: 0, voxels: 0, dist: 0 };
    this.fn = (data) => this.ingest(data);
    if (o.listen !== false) dev.onPoints.push(this.fn);
    if (dev.spec.pcap) scan.raw = [];
    scan.traj = []; scan.trajTrue = [];
  }

  // typische Fehlerkennwerte je Quelle (eine Realisierung je Aufnahme: Maßstab und Biaswerte bleiben konstant)
  driftParams() {
    const g = () => gauss(this.r);
    switch (this.drift) {
      case 'wheel': return { scale: 0.01 * g(), turn: 0.02 * (0.6 + 0.4 * Math.abs(g())) * (this.r() < 0.5 ? -1 : 1), bias: 2e-4 * g(), nPos: 0.004, nYaw: 0.002 };
      case 'vio': return { scale: 0.008 * g(), turn: 0.006 * g(), bias: 4e-5 * g(), vert: 0.004 * g(), nPos: 0.0015, nYaw: 0.0008 };
      case 'gnss': return { sh: 0.7, sv: 1.1, tau: 25, syaw: 0.006, b: [g() * 0.7, g() * 1.1, g() * 0.7, g() * 0.006] };
      case 'imu': { const a = this.r() * Math.PI * 2; return { ab: [Math.cos(a) * 0.012, g() * 0.003, Math.sin(a) * 0.012], bg: 9e-4 * g(), v: [0, 0, 0] }; }
      default: return {};
    }
  }

  // je Bild: wahre Pose, Fehlerzustand, Odometriepose, Drehtellerwinkel fortschreiben; fertige Umdrehungen verarbeiten
  update(t) {
    const P = this.dev.pose();
    _p.set(P[0], P[1], P[2]); _q.set(P[3], P[4], P[5], P[6]);
    this.truth.push(t, _p, _q);
    this.propagate(t, _p.clone(), _q.clone());
    // Odometriepose = E · wahr
    _m.compose(_p.set(P[0], P[1], P[2]), _q.set(P[3], P[4], P[5], P[6]), ONE).premultiply(this.E);
    const po = new THREE.Vector3(), qo = new THREE.Quaternion();
    _m.decompose(po, qo, _v);
    this.odo.push(t, po, qo);
    if (this.tt) { const L = this.ttLog; if (!L.length || t > L[L.length - 1][0]) L.push([t, this.tt.plate.rotation.y]); else L[L.length - 1][1] = this.tt.plate.rotation.y; while (L.length > 2 && L[0][0] < t - 8) L.shift(); }
    // Abweichung der aktuellen Schätzung
    const est = this.estimateAt(t, _m2);
    const ep = new THREE.Vector3().setFromMatrixPosition(est), eq = new THREE.Quaternion().setFromRotationMatrix(est);
    this.stats.errP = ep.distanceTo(new THREE.Vector3(P[0], P[1], P[2]));
    this.stats.errYaw = Math.abs(wrap(yawOf(eq) - yawOf(new THREE.Quaternion(P[3], P[4], P[5], P[6])))) * 180 / Math.PI;
    this.flush(this.dev.doneUntil ?? this.dev.t);
  }

  propagate(t, p, q) {
    const st = this.st, K = this.K;
    if (!st) { this.st = { t, p, yaw: yawOf(q) }; return; }
    const dt = t - st.t;
    if (dt <= 0) return;
    const dp = p.clone().sub(st.p), ds = dp.length();
    const yaw = yawOf(q), dyaw = wrap(yaw - st.yaw);
    this.stats.dist += ds;
    const E = this.E;
    const rotAbout = (pt, a) => {
      _m.makeTranslation(-pt.x, -pt.y, -pt.z);
      _m2.makeRotationAxis(UP, a).multiply(_m);
      _m.makeTranslation(pt.x, pt.y, pt.z).multiply(_m2);
      E.premultiply(_m);
    };
    const RE = new THREE.Matrix4().extractRotation(E);
    if (this.drift === 'wheel') {
      // Maßstabsfehler der Radumfänge, Spurweitenfehler beim Drehen, Kreiseldrift, Schlupfrauschen
      const lat = new THREE.Vector3(-dp.z, 0, dp.x).normalize().multiplyScalar(K.nPos * Math.sqrt(ds) * gauss(this.r));
      if (!isFinite(lat.x)) lat.set(0, 0, 0);
      const err = dp.clone().multiplyScalar(K.scale).add(lat).applyMatrix4(RE);
      err.y = 0;
      E.premultiply(_m.makeTranslation(err.x, err.y, err.z));
      rotAbout(p.clone().applyMatrix4(E), K.turn * dyaw + K.bias * dt + K.nYaw * Math.sqrt(ds) * gauss(this.r));
    } else if (this.drift === 'vio') {
      // visuell-inertiale Odometrie: kleiner Maßstabsfehler in allen Achsen, Kursdrift beim Drehen, wenig Rauschen
      const err = dp.clone().multiplyScalar(K.scale).applyMatrix4(RE);
      err.y += K.vert * ds;
      err.x += K.nPos * Math.sqrt(ds) * gauss(this.r); err.z += K.nPos * Math.sqrt(ds) * gauss(this.r);
      E.premultiply(_m.makeTranslation(err.x, err.y, err.z));
      rotAbout(p.clone().applyMatrix4(E), K.turn * dyaw + K.bias * dt + K.nYaw * Math.sqrt(ds) * gauss(this.r));
    } else if (this.drift === 'gnss') {
      // Gauß-Markov-Prozess je Achse (keine Aufsummierung: GNSS stützt absolut, aber mit Meterfehler)
      const a = Math.exp(-dt / K.tau), s = Math.sqrt(1 - a * a);
      K.b[0] = K.b[0] * a + K.sh * s * gauss(this.r);
      K.b[1] = K.b[1] * a + K.sv * s * gauss(this.r);
      K.b[2] = K.b[2] * a + K.sh * s * gauss(this.r);
      K.b[3] = K.b[3] * a + K.syaw * s * gauss(this.r);
      E.identity();
      rotAbout(p, K.b[3]);
      E.premultiply(_m.makeTranslation(K.b[0], K.b[1], K.b[2]));
    } else if (this.drift === 'imu') {
      // Restbeschleunigung (Bias nach Schwerkraftabzug) doppelt integriert, Kreiseldrift einfach
      for (let k = 0; k < 3; k++) K.v[k] += K.ab[k] * dt;
      E.premultiply(_m.makeTranslation(K.v[0] * dt, K.v[1] * dt, K.v[2] * dt));
      rotAbout(p.clone().applyMatrix4(E), K.bg * dt + 0.004 * dyaw);
    }
    st.t = t; st.p = p; st.yaw = yaw;
  }

  // Vertrauen in die Vorhersage je Umdrehung: Neigung aus der IMU (Schwerkraft) sehr gut, Höhe beim Fahrzeug
  // nahezu fest, Kurs und Weg je nach Quelle
  prior() {
    const P = this.period / 0.1;
    switch (this.drift) {
      case 'wheel': return [0.0015, 0.01 * P, 0.0015, 0.03 * P, 0.004, 0.03 * P];
      case 'gnss': return [0.002, 0.01 * P, 0.002, 0.08 * P, 0.03 * P, 0.08 * P];
      case 'vio': return [0.002, 0.005 * P, 0.002, 0.02 * P, 0.02 * P, 0.02 * P];
      default: return [0.003, 0.02 * P, 0.003, 0.1 * P, 0.05 * P, 0.1 * P];
    }
  }

  estimateAt(t, M) {
    if (this.mode === 'ideal') return this.truth.at(t, M);
    this.odo.at(t, M);
    if (this.mode === 'slam') M.premultiply(this.C);
    return M;
  }

  ingest(data) {
    if (!data || !data.n) return;
    let tMin = Infinity, tMax = -Infinity;
    for (let k = 0; k < data.n; k++) { const t = data.t[k]; if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
    // cons: bis zu diesem Zeitpunkt sind die Punkte des Pakets verarbeitet (verspätete Punkte landen in der nächsten Umdrehung)
    this.batches.push({ b: data, tMin, tMax, cons: -Infinity });
    if (this.fStart == null) this.fStart = Math.floor(tMin / this.period) * this.period;
    const raw = this.scan.raw;
    if (raw && raw.length < 4000) raw.push({ n: data.n, ls: data.ls, ring: data.ring, t: data.t, i: data.i, ret: data.ret });
  }

  // alle Umdrehungen verarbeiten, deren Daten vollständig vorliegen
  flush(doneUntil, all = false) {
    let guard = 0;
    while (this.fStart != null && guard++ < 50) {
      const f0 = this.fStart, f1 = f0 + this.period;
      if (!all && f1 > doneUntil) break;
      if (all && !this.batches.length) break;
      this.processFrame(f0, f1);
      this.fStart = f1;
      this.batches = this.batches.filter((x) => x.tMax >= f1);
    }
  }

  processFrame(f0, f1) {
    const parts = [];
    for (const x of this.batches) {
      if (x.tMin >= f1 || x.tMax < x.cons) continue;
      const idx = [];
      const T = x.b.t;
      for (let k = 0; k < x.b.n; k++) if (T[k] >= x.cons && T[k] < f1) idx.push(k);
      x.cons = f1;
      if (idx.length) parts.push({ x, idx });
    }
    if (!parts.length) return;
    const t0 = performance.now();
    const tRef = f1;
    // Stützstellen der Pose alle 10 ms innerhalb der Umdrehung
    const nK = Math.max(2, Math.ceil((f1 - f0) / 0.01) + 1);
    const knotsT = new Float64Array(nK), knots = [];
    const src = this.mode === 'slam' ? 'odo' : this.mode === 'ideal' ? 'truth' : 'odo';
    const log = this[src];
    for (let k = 0; k < nK; k++) { knotsT[k] = f0 + (f1 - f0) * k / (nK - 1); knots.push(log.at(knotsT[k], new THREE.Matrix4()).elements.slice()); }
    const ref = log.at(tRef, new THREE.Matrix4());
    const refE = ref.elements.slice();
    const M = new Float64Array(16);
    const poseInto = (t) => {
      if (!this.deskew) { for (let i = 0; i < 16; i++) M[i] = refE[i]; return; }
      let u = (t - f0) / (f1 - f0) * (nK - 1);
      u = Math.max(0, Math.min(nK - 1 - 1e-9, u));
      const k = Math.floor(u), w = u - k, A = knots[k], B = knots[k + 1];
      for (let i = 0; i < 16; i++) M[i] = A[i] + (B[i] - A[i]) * w;
    };
    // Punkte je Teil: Weltkoordinaten nach der gewählten Positionsbestimmung
    let total = 0;
    for (const p of parts) total += p.idx.length;
    const out = new Float32Array(total * 3);
    let o = 0;
    const useW = this.mode === 'ideal' && this.deskew;
    const slam = this.mode === 'slam';
    let invRef = null;
    if (slam) invRef = new THREE.Matrix4().copy(ref).invert().elements;
    for (const p of parts) {
      const b = p.x.b, ls = b.ls, idx = p.idx;
      p.o = o;
      for (const k of idx) {
        if (useW) { out[o++] = b.w[k * 3]; out[o++] = b.w[k * 3 + 1]; out[o++] = b.w[k * 3 + 2]; continue; }
        poseInto(b.t[k]);
        const x = ls[k * 3], y = ls[k * 3 + 1], z = ls[k * 3 + 2];
        let X = M[0] * x + M[4] * y + M[8] * z + M[12], Y = M[1] * x + M[5] * y + M[9] * z + M[13], Z = M[2] * x + M[6] * y + M[10] * z + M[14];
        if (slam) { const e = invRef; const a = e[0] * X + e[4] * Y + e[8] * Z + e[12], bb = e[1] * X + e[5] * Y + e[9] * Z + e[13], c = e[2] * X + e[6] * Y + e[10] * Z + e[14]; X = a; Y = bb; Z = c; }
        out[o++] = X; out[o++] = Y; out[o++] = Z;
      }
    }
    // SLAM: Umdrehung (im Sensorsystem zum Referenzzeitpunkt) gegen die Karte registrieren
    if (slam) {
      const T = new THREE.Matrix4().copy(ref).premultiply(this.C);
      const n = out.length / 3;
      if (this.map.size > 300) {
        const want = 1000, sel = [];
        const step = Math.max(1, Math.floor(n / (want * 1.5)));
        for (let i = 0; i < n && sel.length < want * 3; i += step) {
          const x = out[i * 3], y = out[i * 3 + 1], z = out[i * 3 + 2], r2 = x * x + y * y + z * z;
          if (r2 < 0.36 || r2 > 3600) continue;
          sel.push(x, y, z);
        }
        const T0 = this.onAlign ? T.clone() : null;
        const res = alignToMap(this.map, new Float32Array(sel), T, { iters: 10, prior: this.prior() });
        if (this.onAlign) this.onAlign({ T0, T: T.clone(), res, tRef, n: sel.length / 3 });
        this.stats.rms = res.rms; this.stats.inl = res.inl;
        if (!res.ok || res.rms > 0.25) { this.stats.fails++; T.copy(ref).premultiply(this.C); }
        else this.C.copy(T).multiply(new THREE.Matrix4().copy(ref).invert());
      }
      const e = T.elements;
      for (let i = 0; i < n; i++) {
        const x = out[i * 3], y = out[i * 3 + 1], z = out[i * 3 + 2];
        out[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; out[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; out[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      for (let i = 0; i < n; i += 3) this.map.insert(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
      this.stats.voxels = this.map.size;
    }
    // Drehteller: in Objektkoordinaten drehen und auf den Messbereich beschneiden
    let keep = null;
    if (this.tt) {
      keep = new Uint8Array(total);
      const { cx, cz, crop } = this.tt;
      let q = 0;
      for (const p of parts) {
        const b = p.x.b;
        for (const k of p.idx) {
          const a = -this.ttAngle(b.t[k]);
          const x = out[q * 3] - cx, z = out[q * 3 + 2] - cz, c = Math.cos(a), s = Math.sin(a);
          const X = c * x + s * z, Z = -s * x + c * z;
          out[q * 3] = X + cx; out[q * 3 + 2] = Z + cz;
          const y = out[q * 3 + 1];
          keep[q] = X * X + Z * Z <= crop.r * crop.r && y >= crop.y0 && y <= crop.y1 ? 1 : 0;
          q++;
        }
      }
    }
    // in den Scan schreiben
    const cloud = this.scan.cloud;
    for (const p of parts) {
      const b = p.x.b, map = new Int32Array(b.n).fill(-1);
      p.idx.forEach((k, j) => { map[k] = p.o / 3 + j; });
      cloud.add(b, (bb, k, dst) => { const q = map[k]; dst[0] = out[q * 3]; dst[1] = out[q * 3 + 1]; dst[2] = out[q * 3 + 2]; }, (bb, k) => { const q = map[k]; return q >= 0 && (!keep || keep[q]); });
    }
    // Bahn (geschätzt und wahr)
    const est = this.estimateAt(tRef, new THREE.Matrix4());
    const tp = this.truth.at(tRef, new THREE.Matrix4());
    this.scan.traj.push([tRef, est.elements[12], est.elements[13], est.elements[14]]);
    this.scan.trajTrue.push([tRef, tp.elements[12], tp.elements[13], tp.elements[14]]);
    this.stats.frames++;
    this.stats.ms = this.stats.ms * 0.9 + (performance.now() - t0) * 0.1;
  }

  ttAngle(t) {
    const L = this.ttLog;
    if (!L.length) return 0;
    if (t <= L[0][0]) return L[0][1];
    for (let k = L.length - 1; k > 0; k--) {
      if (L[k - 1][0] <= t) { const [ta, a] = L[k - 1], [tb, b] = L[k]; return tb > ta ? a + (b - a) * Math.min(1, (t - ta) / (tb - ta)) : b; }
    }
    return L[L.length - 1][1];
  }

  finish() {
    this.flush(Infinity, true);
    const i = this.dev.onPoints.indexOf(this.fn);
    if (i >= 0) this.dev.onPoints.splice(i, 1);
    const tr = this.scan.traj, tt = this.scan.trajTrue;
    let end = 0, max = 0;
    for (let k = 0; k < tr.length; k++) {
      const d = Math.hypot(tr[k][1] - tt[k][1], tr[k][2] - tt[k][2], tr[k][3] - tt[k][3]);
      max = Math.max(max, d);
      if (k === tr.length - 1) end = d;
    }
    this.scan.loc = { mode: this.mode, drift: this.drift, deskew: this.deskew, endErr: end, maxErr: max, dist: this.stats.dist, fails: this.stats.fails, frames: this.stats.frames, turntable: !!this.tt };
    return this.scan.loc;
  }
}
