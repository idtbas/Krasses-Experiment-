// Scan-Engine: verteilt Rechenaufträge auf mehrere Web Worker.
// Szene, Materialien, Umgebung und Sensoren liegen in jedem Worker; ein Zeitfenster eines Sensors
// wird in Teilfenster zerlegt (die Muster hängen nur von der Zeit ab) und parallel gerechnet.

export function lerpPose(A, B, u) {
  const out = new Array(7);
  for (let i = 0; i < 3; i++) out[i] = A[i] + (B[i] - A[i]) * u;
  let s = A[3] * B[3] + A[4] * B[4] + A[5] * B[5] + A[6] * B[6] < 0 ? -1 : 1;
  let l = 0;
  for (let i = 3; i < 7; i++) { out[i] = A[i] + (s * B[i] - A[i]) * u; l += out[i] * out[i]; }
  l = 1 / Math.sqrt(l);
  for (let i = 3; i < 7; i++) out[i] *= l;
  return out;
}

export class ScanEngine {
  constructor(n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))) {
    this.n = n;
    this.workers = [];
    this.jobs = new Map();
    this.seq = 0;
    this.rr = 0;
    this.pendingParts = 0;
    this.stats = { shots: 0, points: 0, ms: 0 };
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./scanworker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this.onMessage(i, e.data);
      w.onerror = (e) => console.error('Scan-Worker', e.message || e);
      this.workers.push(w);
    }
  }

  // an alle Worker senden; Puffer werden für alle außer dem letzten kopiert
  broadcast(msg, buffers = []) {
    this.workers.forEach((w, i) => {
      if (i === this.workers.length - 1 || !buffers.length) w.postMessage(msg, i === this.workers.length - 1 ? buffers : []);
      else w.postMessage(structuredClone(msg));
    });
  }

  setScene(blas, inst, mats) {
    return new Promise((resolve) => {
      this.sceneLeft = this.n;
      this.sceneResolve = resolve;
      const msg = { type: 'scene', blas, inst, mats };
      const buffers = [];
      for (const b of blas) buffers.push(b.nodes, b.tri.buffer, b.mat.buffer, b.obj.buffer);
      buffers.push(mats.buffer);
      this.broadcast(msg, buffers);
    });
  }

  updateMatrices(list) { this.broadcast({ type: 'matrices', list }, [list.buffer]); }
  setMaterials(mats) { this.broadcast({ type: 'materials', mats }, [mats.buffer]); }
  setEnv(env) { this.broadcast({ type: 'env', env }); }
  addSensor(id, spec, set) { this.broadcast({ type: 'sensor', id, spec, set }); }
  dropSensor(id) { this.broadcast({ type: 'drop', id }); }
  // laufender Gerätezustand (Temperaturdrift der Entfernung)
  sensorState(id, st) { this.broadcast({ type: 'sstate', id, st }); }

  get busy() { return this.pendingParts; }

  // Zeitfenster [t0, t1) eines Sensors; Posen A (bei t0) und B (bei t1). Ergebnis: Teile in Zeitreihenfolge.
  scan(id, t0, t1, A, B, estShots = 0) {
    const parts = Math.max(1, Math.min(this.n, Math.ceil(estShots / 6000)));
    const job = ++this.seq;
    return new Promise((resolve, reject) => {
      this.jobs.set(job, { resolve, reject, left: parts, parts: new Array(parts) });
      for (let k = 0; k < parts; k++) {
        const a = t0 + (t1 - t0) * (k / parts), b = t0 + (t1 - t0) * ((k + 1) / parts);
        const PA = k === 0 ? A : lerpPose(A, B, k / parts), PB = k === parts - 1 ? B : lerpPose(A, B, (k + 1) / parts);
        const w = this.workers[(this.rr++) % this.n];
        this.pendingParts++;
        w.postMessage({ type: 'scan', id, job, part: k, t0: a, t1: b, A: PA, B: PB });
      }
    });
  }

  // TLS: Spaltenbereich [c0, c1) in Stücken, Fortschritt je Stück
  tls(id, P, c0, c1, chunk, onPart) {
    const job = ++this.seq;
    this.lastTlsJob = job;
    const ranges = [];
    for (let c = c0; c < c1; c += chunk) ranges.push([c, Math.min(c1, c + chunk)]);
    return new Promise((resolve, reject) => {
      const st = { resolve, reject, left: ranges.length, parts: null, onPart, tlsQueue: ranges.slice(), id, P, inflight: 0 };
      this.jobs.set(job, st);
      // höchstens zwei Stücke je Worker gleichzeitig, damit Fortschritt und Abbruch flüssig bleiben
      const inflight = Math.min(ranges.length, this.n * 2);
      for (let k = 0; k < inflight; k++) this.nextTls(job);
    });
  }
  nextTls(job) {
    const st = this.jobs.get(job);
    if (!st || st.cancelled || !st.tlsQueue.length) return;
    const [c0, c1] = st.tlsQueue.shift();
    const w = this.workers[(this.rr++) % this.n];
    this.pendingParts++;
    st.inflight++;
    w.postMessage({ type: 'tls', id: st.id, job, part: c0, c0, c1, P: st.P });
  }
  cancel(job) { const st = this.jobs.get(job); if (st) { st.cancelled = true; st.tlsQueue = []; if (st.inflight === 0) { this.jobs.delete(job); st.resolve(false); } } }

  depth(id, t, P, opts = {}) {
    const job = ++this.seq;
    return new Promise((resolve, reject) => {
      this.jobs.set(job, { resolve, reject, left: 1, parts: [null], single: true });
      const w = this.workers[(this.rr++) % this.n];
      this.pendingParts++;
      w.postMessage({ type: 'depth', id, job, t, P, ...opts });
    });
  }

  castRay(o, d, max) {
    const job = ++this.seq;
    return new Promise((resolve) => {
      this.jobs.set(job, { resolve, left: 1, parts: [null], single: true, cast: true });
      this.pendingParts++;
      this.workers[0].postMessage({ type: 'cast', job, o, d, max });
    });
  }

  onMessage(i, m) {
    if (m.type === 'sceneReady') {
      this.lastTris = m.tris;
      if (--this.sceneLeft === 0 && this.sceneResolve) { const r = this.sceneResolve; this.sceneResolve = null; r(); }
      return;
    }
    if (m.type === 'error') {
      console.error('Scan-Worker-Fehler:', m.message, m.stack);
      const st = this.jobs.get(m.job);
      if (st) { this.pendingParts--; this.jobs.delete(m.job); st.reject && st.reject(new Error(m.message)); }
      return;
    }
    const st = this.jobs.get(m.job);
    if (!st) return;
    this.pendingParts--;
    if (m.type === 'cast') { this.jobs.delete(m.job); st.resolve(m.hit); return; }
    if (m.ms) { this.stats.ms += m.ms; this.stats.shots += m.shots || 0; this.stats.points += m.data ? m.data.n : 0; }
    if (st.tlsQueue) {
      st.inflight--;
      st.left--;
      if (st.cancelled) { if (st.inflight === 0) { this.jobs.delete(m.job); st.resolve(false); } return; }
      if (st.onPart) st.onPart(m);
      this.nextTls(m.job);
      if (st.left === 0) { this.jobs.delete(m.job); st.resolve(true); }
      return;
    }
    st.parts[m.part || 0] = m;
    if (--st.left === 0) { this.jobs.delete(m.job); st.resolve(st.single ? st.parts[0] : st.parts); }
  }
}
