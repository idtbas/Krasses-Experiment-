// Projekt: alle Scans (Stationsscans, Aufnahmen mobiler Scanner, Smartphone, Importe).
import * as THREE from 'three';
import { PointCloud } from './cloud.js';

let SEQ = 0;
const COLORS = ['#35d0ff', '#ffb02e', '#7ee081', '#ff6b8b', '#b392f0', '#f5e35c', '#5ce1c7', '#ff8a4c'];

export class Scan {
  constructor(o) {
    this.id = ++SEQ;
    this.kind = o.kind;
    this.name = o.name || `Scan ${String(this.id).padStart(3, '0')}`;
    this.spec = o.spec || null;
    this.set = o.set ? { ...o.set } : {};
    this.created = new Date();
    this.color = COLORS[(this.id - 1) % COLORS.length];
    this.origin = o.origin ? o.origin.clone() : new THREE.Vector3();
    this.truePose = o.truePose ? o.truePose.clone() : new THREE.Matrix4();
    this.pose = o.pose ? o.pose.clone() : this.truePose.clone();
    this.local = !!o.local; // Punkte im Scannersystem (Stationsscan) oder in Weltkoordinaten
    this.cloud = new PointCloud({ useWorld: !this.local, limit: o.limit || 8e6, chunk: o.chunk || 131072, name: this.name });
    this.cloud.scan = this;
    this.cloud.visibleInScene = false;
    if (this.local) { this.cloud.group.matrixAutoUpdate = false; this.cloud.group.matrix.copy(this.pose); }
    this.visible = true;
    this.stats = { nominal: 0, duration: 0, decimate: 1, ms: 0 };
    this.registered = !this.local;
    this.reg = null;
  }
  setPose(m) {
    this.pose.copy(m);
    if (this.local) { this.cloud.group.matrix.copy(m); this.cloud.group.matrixWorldNeedsUpdate = true; }
  }
  get points() { return this.cloud.count; }
  get visible() { return this._vis; }
  set visible(v) { this._vis = v; if (this.cloud) this.cloud.visible = v; }
}

export class Project {
  constructor(app) {
    this.app = app;
    this.scans = [];
    this.name = 'Projekt ' + new Date().toLocaleDateString('de-DE');
    this.listeners = [];
  }
  add(scan) {
    this.scans.push(scan);
    this.app.world.clouds.add(scan.cloud.group);
    this.changed();
    return scan;
  }
  remove(scan) {
    const i = this.scans.indexOf(scan);
    if (i < 0) return;
    this.scans.splice(i, 1);
    scan.cloud.group.removeFromParent();
    scan.cloud.dispose();
    this.changed();
  }
  clear() { for (const s of [...this.scans]) this.remove(s); }
  get total() { return this.scans.reduce((a, s) => a + s.points, 0); }
  changed() { for (const f of this.listeners) f(); }
}

// Aus gesammelten Punkten (PointCloud.gather) eine neue, abgeleitete Wolke bauen; mask optional (1 = behalten)
export function derivedScan(src, g, mask, name, extra = {}) {
  let n = 0;
  for (let k = 0; k < g.n; k++) if (!mask || mask[k]) n++;
  const b = { n, w: new Float32Array(n * 3), ls: null, rgb: new Uint8Array(n * 3), i: new Uint8Array(n), ret: new Uint8Array(n), cls: new Uint8Array(n), ring: new Uint16Array(n), f: new Uint8Array(n), t: new Float64Array(n), obj: new Uint16Array(n) };
  let o = 0;
  for (let k = 0; k < g.n; k++) {
    if (mask && !mask[k]) continue;
    b.w[o * 3] = g.pos[k * 3]; b.w[o * 3 + 1] = g.pos[k * 3 + 1]; b.w[o * 3 + 2] = g.pos[k * 3 + 2];
    b.rgb[o * 3] = g.rgb[k * 3]; b.rgb[o * 3 + 1] = g.rgb[k * 3 + 1]; b.rgb[o * 3 + 2] = g.rgb[k * 3 + 2];
    b.i[o] = g.i[k]; b.ret[o] = g.meta[k * 4]; b.cls[o] = extra.cls ? extra.cls(k, g.meta[k * 4 + 1]) : g.meta[k * 4 + 1]; b.ring[o] = g.meta[k * 4 + 2]; b.f[o] = g.meta[k * 4 + 3];
    b.t[o] = g.t[k]; b.obj[o] = g.obj[k];
    o++;
  }
  const s = new Scan({ kind: 'derived', spec: src ? src.spec : null, set: src ? src.set : {}, name, origin: src ? src.origin : null, limit: n + 10 });
  s.cloud.add(b);
  s.parent = src || null;
  s.origins = src ? src.origins || null : null;
  if (src) { s.stats.duration = src.stats.duration; s.traj = src.traj || null; s.registered = true; }
  return s;
}
