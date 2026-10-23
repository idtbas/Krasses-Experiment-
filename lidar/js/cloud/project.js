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
