// Ein Scanner in der Welt: Modell, Halterung, Einstellungen, Live-Datenstrom, Abstandsbild, Stationsscan.
import * as THREE from 'three';
import { buildScannerModel, buildTripod } from './models3d.js';
import { makePattern } from './patterns.js';
import { PointCloud } from '../cloud/cloud.js';

let SEQ = 0;

export function deviceKind(spec) {
  const t = spec.pattern.type;
  if (t === 'tls') return 'tls';
  if (t === 'phone') return 'phone';
  if (t === 'flash') return 'depth';
  return 'stream';
}

export function defaultSettings(spec) {
  const p = spec.pattern;
  const s = {
    hz: p.hz || p.fps || 10,
    returns: spec.returns[0],
    subrays: spec.phys.subrays ?? 5,
    fov: null,
    color: !!spec.camera,
    shadow: spec.cls === 'tls',
    persistence: p.type === 'dome' ? 2.5 : p.type === 'rosette' ? 1.5 : 0, // Linienmuster: länger nachleuchten, sonst nur Streifen
    budget: 3e6,
    quality: 1,
  };
  if (Array.isArray(p.cols)) s.cols = p.cols.includes(1024) ? 1024 : p.cols[p.cols.length - 1];
  if (p.resolutions) s.resolution = p.resolutions[p.resDefault ?? 1];
  if (p.type === 'flash') { s.decimate = 4; s.hz = 5; }
  return s;
}

// typische Bytes je Punkt im Datenstrom (für die Datenrate)
function bytesPerPoint(spec) {
  if (spec.maker === 'Ouster') return 12;
  if (spec.maker === 'Livox') return 14;
  if (spec.cls === 'line') return 4;
  if (spec.cls === 'depth') return 2;
  return 3.25; // Velodyne-Pakete: 1206 Byte je 384 Messungen (inkl. Kopf, Azimut, Zeitstempel)
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class ScannerDevice {
  constructor(app, spec) {
    this.app = app;
    this.id = 'dev' + (++SEQ);
    this.spec = spec;
    this.kind = deviceKind(spec);
    this.set = defaultSettings(spec);
    this.root = new THREE.Group();
    this.root.name = spec.model;
    this.holder = new THREE.Group();
    this.model = buildScannerModel(spec);
    this.holder.add(this.model.group);
    this.root.add(this.holder);
    this.mount = null;
    this.mountKind = 'stativ';
    this.state = 'idle';
    this.t = 0;                // Sensorzeit (s)
    this.pending = 0;          // noch zu rechnende Zeit
    this.inflight = 0;
    this.open = new Set();     // Startzeiten noch laufender Fenster
    this.poses = [];           // Verlauf [t, pose7]
    this.stats = { pts: 0, shots: 0, rate: 0, srate: 0, bytes: bytesPerPoint(spec), lastN: 0, frames: 0 };
    this.live = null;
    this.recording = null;
    this.onPoints = [];        // Abonnenten (Aufnahme, Viewer)
    this.headAngle = 0;
    this.makePattern();
  }

  get name() { return this.spec.model; }

  makePattern() {
    this.pattern = makePattern(this.spec, this.set);
    const p = this.pattern;
    this.rows = p.rows || 0; this.cols = p.cols || 0;
    if (this.kind === 'stream' && this.rows && this.cols && this.rows * this.cols < 600000) {
      this.rimg = { r: new Float32Array(this.rows * this.cols), i: new Uint8Array(this.rows * this.cols), dirty: true };
    } else this.rimg = null;
    // Live-Puffer: eine Umdrehung bzw. Nachleuchtdauer
    const per = Math.max(p.period || 0.1, this.set.persistence || 0);
    const cap = Math.min(2.5e6, Math.max(20000, Math.ceil((p.rate || 100000) * per * 1.15)));
    if (this.live) { this.live.group.removeFromParent(); this.live.dispose(); }
    this.live = new PointCloud({ ring: true, limit: cap, chunk: Math.min(131072, Math.max(16384, 1 << Math.ceil(Math.log2(cap / 4)))), name: 'Live ' + this.spec.model });
    this.live.isLive = true;
    if (this.app.world) this.app.world.clouds.add(this.live.group);
  }

  // Einstellungen ändern (Drehzahl, Spalten, Echos, Sichtfeld, Auflösung …)
  configure(patch) {
    Object.assign(this.set, patch);
    const running = this.state === 'stream';
    this.makePattern();
    this.app.engine.addSensor(this.id, this.spec, this.set);
    if (running) this.t = this.app.clock.t;
  }

  /* ---------- Pose ---------- */
  pose() {
    const s = this.model.sensor;
    s.updateWorldMatrix(true, false);
    s.matrixWorld.decompose(_p, _q, _s);
    return [_p.x, _p.y, _p.z, _q.x, _q.y, _q.z, _q.w];
  }
  recordPose(t) {
    const P = this.pose();
    this.poses.push([t, P]);
    while (this.poses.length > 2 && this.poses[1][0] < t - 3) this.poses.shift();
  }
  poseAt(t) {
    const L = this.poses;
    if (!L.length) return this.pose();
    if (t <= L[0][0]) return L[0][1];
    for (let k = 1; k < L.length; k++) {
      if (L[k][0] >= t) {
        const [ta, A] = L[k - 1], [tb, B] = L[k];
        const u = tb > ta ? (t - ta) / (tb - ta) : 1;
        const out = A.map((v, i) => v + (B[i] - v) * u);
        if (A[3] * B[3] + A[4] * B[4] + A[5] * B[5] + A[6] * B[6] < 0) for (let i = 3; i < 7; i++) out[i] = A[i] + (-B[i] - A[i]) * u;
        const l = Math.hypot(out[3], out[4], out[5], out[6]);
        for (let i = 3; i < 7; i++) out[i] /= l;
        return out;
      }
    }
    return L[L.length - 1][1];
  }

  /* ---------- Datenstrom ---------- */
  start() {
    if (this.kind === 'tls') return;
    this.app.engine.addSensor(this.id, this.spec, this.set);
    this.state = 'stream';
    this.t = this.app.clock.t;
    this.pending = 0;
    this.poses = [];
    this.open.clear();
    this.stats.win = [];
    this.recordPose(this.t);
  }
  stop() { this.state = 'idle'; this.pending = 0; }

  // bis zu diesem Zeitpunkt liegen alle Messungen vor (ältestes noch offenes Fenster)
  get doneUntil() {
    let m = this.t;
    for (const t of this.open) if (t < m) m = t;
    return m;
  }

  // pro Bild: Zeit fortschreiben und Fenster an die Engine geben
  tick(dt, simT) {
    this.animate(dt);
    if (this.state !== 'stream') return;
    this.recordPose(simT);
    this.pending = Math.max(0, simT - this.t);
    const eng = this.app.engine;
    const maxIn = eng.n * 2;
    const win = this.kind === 'depth' ? 1 / this.set.hz : this.kind === 'phone' ? this.pattern.period : Math.min(0.05, Math.max(0.01, this.pattern.period / 2));
    let guard = 0;
    while (this.pending >= win * 0.999 && this.inflight < maxIn && guard++ < 8) {
      const t0 = this.t, t1 = t0 + win;
      this.t = t1;
      this.pending -= win;
      if (this.kind === 'depth' || this.kind === 'phone') this.requestDepth(t0);
      else this.requestWindow(t0, t1);
    }
  }

  requestWindow(t0, t1) {
    const A = this.poseAt(t0), B = this.poseAt(t1);
    const est = (this.pattern.rate || 1e5) * (t1 - t0);
    this.inflight++;
    this.open.add(t0);
    this.app.engine.scan(this.id, t0, t1, A, B, est).then((parts) => {
      this.inflight--;
      for (const m of parts) this.ingest(m.data, m.shots);
      this.open.delete(t0);
    }).catch((e) => { this.inflight--; this.open.delete(t0); console.error(e); });
  }

  requestDepth(t) {
    const P = this.poseAt(t);
    this.inflight++;
    this.open.add(t);
    const opts = this.kind === 'phone' ? { w: 256, h: 192 } : { decimate: this.set.decimate || 4 };
    this.app.engine.depth(this.id, t, P, opts).then((m) => {
      this.inflight--;
      this.lastDepth = m;
      m.t = t; m.P = P;
      if (m.data) this.ingest(m.data, m.w * m.h);
      if (m.dots) this.ingest(m.dots, 576); // Rohdaten des dToF-Sensors
      if (this.onDepth) this.onDepth(m, this);
      this.open.delete(t);
    }).catch((e) => { this.inflight--; this.open.delete(t); console.error(e); });
  }

  ingest(data, shots) {
    if (!data || !data.n) { this.stats.shots += shots || 0; return; }
    this.live.add(data);
    this.stats.pts += data.n;
    this.stats.shots += shots || 0;
    this.stats.lastN = data.n;
    if (this.rimg) {
      const R = this.rimg, C = this.cols;
      for (let k = 0; k < data.n; k++) {
        if ((data.ret[k] & 15) !== 1) continue;
        const id = data.ring[k] * C + data.col[k];
        if (id < 0 || id >= R.r.length) continue;
        R.r[id] = Math.hypot(data.ls[k * 3], data.ls[k * 3 + 1], data.ls[k * 3 + 2]);
        R.i[id] = data.i[k];
      }
      R.dirty = true;
    }
    for (const f of this.onPoints) f(data, this);
  }

  // Punktrate glätten (für Anzeige)
  // Raten über ein gleitendes Fenster von einer Sekunde Simulationszeit
  measure() {
    const s = this.stats, now = this.t;
    const W = s.win || (s.win = []);
    W.push([now, s.pts, s.shots]);
    while (W.length > 2 && W[0][0] < now - 1) W.shift();
    const a = W[0], b = W[W.length - 1], dt = b[0] - a[0];
    if (this.state !== 'stream' || dt <= 0) { if (this.state !== 'stream') { s.rate *= 0.9; s.srate *= 0.9; } return; }
    s.rate = (b[1] - a[1]) / dt;
    s.srate = (b[2] - a[2]) / dt;
  }

  /* ---------- Darstellung des Geräts ---------- */
  animate(dt) {
    const m = this.model;
    if (this.state === 'stream') {
      const hz = this.pattern.hz || this.set.hz || 10;
      // sichtbare Rotoren laufen langsam (Stroboskop-Effekt vermeiden)
      if (m.rotor) m.rotor.rotation.y -= dt * (m.rotorSpins ? Math.min(hz, 3) : hz) * Math.PI * 2 * (m.rotorSpins ? 1 : 0.02);
      if (m.headRotor && this.spec.pattern.rotor) m.headRotor.rotation.z += dt * this.spec.pattern.rotor.hz * Math.PI * 2;
    }
    if (this.state === 'tls' && m.mirror) m.mirror.rotation[m.mirrorAxis] += dt * 40;
  }

  /* ---------- Halterung ---------- */
  mountOn(kind, opts = {}) {
    this.unmount();
    this.mountKind = kind;
    const w = this.app.world;
    if (kind === 'stativ' && opts.tripod) {
      // auf ein eigenständiges Stativ in der Welt (Spielfigur stellt es auf)
      opts.tripod.top.add(this.root);
      this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0);
      this.holder.position.set(0, 0, 0);
      this.mount = { kind, tripod: opts.tripod };
      opts.tripod.device = this;
    } else if (kind === 'stativ') {
      const h = opts.height ?? (this.spec.cls === 'tls' ? 1.45 : 1.5);
      const t = buildTripod(h);
      this.root.add(t.group);
      this.holder.position.copy(t.top.position);
      this.mount = { kind, obj: t.group, height: h };
      w.content.add(this.root);
      if (!this.regObj) this.regObj = w.register(this.root, { name: 'Stativ · ' + this.spec.model, kind: 'scanner', target: false });
    } else if (opts.parent) {
      opts.parent.add(this.root);
      this.root.position.set(...(opts.offset || [0, 0, 0]));
      this.root.rotation.set(0, 0, 0);
      this.holder.position.set(0, 0, 0);
      this.mount = { kind, obj: opts.parent };
    }
    this.holder.rotation.set(opts.pitch || 0, 0, 0);
    return this;
  }
  unmount() {
    if (this.mount && this.mount.tripod) { if (this.mount.tripod.device === this) this.mount.tripod.device = null; }
    else if (this.mount && this.mount.kind === 'stativ') this.root.remove(this.mount.obj);
    this.root.removeFromParent();
    this.mount = null;
    this.holder.rotation.set(0, 0, 0);
  }

  setPosition(x, z, ry) {
    this.root.position.set(x, 0, z);
    if (ry != null) this.root.rotation.y = ry;
    this.root.updateMatrixWorld(true);
  }

  dispose() {
    this.stop();
    this.unmount();
    if (this.live) { this.live.group.removeFromParent(); this.live.dispose(); }
    this.app.engine.dropSensor(this.id);
  }
}
