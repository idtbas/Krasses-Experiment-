// Verarbeitung im Hintergrund (Promise-Schnittstelle zum Verarbeitungs-Worker)
import * as THREE from 'three';

export class Proc {
  constructor() {
    this.w = new Worker(new URL('./procworker.js', import.meta.url), { type: 'module' });
    this.jobs = new Map();
    this.seq = 0;
    this.w.onmessage = (e) => {
      const m = e.data, j = this.jobs.get(m.job);
      if (!j) return;
      if (m.progress != null && m.ms == null) { j.onProgress && j.onProgress(m.progress); return; }
      this.jobs.delete(m.job);
      if (m.error) j.reject(new Error(m.error)); else j.resolve(m);
    };
  }
  run(op, data, transfer = [], onProgress) {
    const job = ++this.seq;
    return new Promise((resolve, reject) => {
      this.jobs.set(job, { resolve, reject, onProgress });
      this.w.postMessage({ op, job, ...data }, transfer);
    });
  }
  get busy() { return this.jobs.size; }
}

// zufällige Teilmenge (für ICP und schnelle Statistik)
export function subsample(pos, max) {
  const n = pos.length / 3;
  if (n <= max) return pos.slice();
  const out = new Float32Array(max * 3);
  const step = n / max;
  for (let k = 0; k < max; k++) { const i = Math.floor(k * step + Math.random() * step * 0.999); out[k * 3] = pos[i * 3]; out[k * 3 + 1] = pos[i * 3 + 1]; out[k * 3 + 2] = pos[i * 3 + 2]; }
  return out;
}

// Dreiecke eines Szenenobjekts in Weltkoordinaten (Sollgeometrie für den Soll-Ist-Vergleich)
export function trianglesOf(root) {
  root.updateMatrixWorld(true);
  const out = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noLidar) return;
    for (let p = o; p; p = p.parent) if (p.userData.noLidar || !p.visible) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : pos.count;
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx[i] : i).applyMatrix4(o.matrixWorld); out.push(v.x, v.y, v.z); }
  });
  return new Float32Array(out);
}
