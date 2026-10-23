// Gegenstände, mit denen die Spielfigur umgeht: tragbares Vermessungsstativ, Geräteausgabe (Tisch mit
// Transportkoffern), Feldrechner zum Mitnehmen. Alles ist echte Geometrie in der Szene und für die Laser sichtbar.
import * as THREE from 'three';
import { buildTripod } from '../scanners/models3d.js';
import { lm, lmTint } from '../world/lidarmat.js';
import { G, mesh, rod } from '../world/geo.js';

let SEQ = 0;

// Stativ als eigenständiges Objekt: kann leer herumstehen, getragen werden und trägt einen Scanner
export class TripodItem {
  constructor(app, height = 1.45) {
    this.app = app;
    this.id = ++SEQ;
    const t = buildTripod(height);
    this.group = new THREE.Group();
    this.group.name = 'Vermessungsstativ';
    this.group.add(t.group);
    this.top = t.top;
    this.height = t.height;
    this.device = null;
    this.carried = false;
    this.reg = app.world.register(this.group, { name: 'Vermessungsstativ', kind: 'stativ', target: false, movable: false });
  }
  place(x, z, yaw = 0) {
    const w = this.app.world;
    w.content.add(this.group);
    this.group.position.set(x, 0, z);
    this.group.rotation.set(0, yaw, 0);
    this.group.updateMatrixWorld(true);
    this.carried = false;
  }
  get pos() { return this.group.getWorldPosition(new THREE.Vector3()); }
}

// Feldrechner als Gegenstand: robustes Tablet mit orangen Ecken (auf dem Tisch, später am Gurt)
export function tabletModel() {
  const g = new THREE.Group();
  g.add(mesh(G.rbox(0.27, 0.018, 0.19, 0.006), lmTint('kunststoff_schwarz', '#1d2024')));
  g.add(mesh(G.box(0.235, 0.002, 0.155), lm('bildschirm'), 0, 0.0095, 0));
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(mesh(G.rbox(0.04, 0.022, 0.04, 0.008), lmTint('kunststoff_weiss', '#d4661a'), sx * 0.12, 0, sz * 0.08));
  return g;
}

// Geräteausgabe: Tisch mit Transportkoffern, Schild und dem Feldrechner
export class EquipmentStation {
  constructor(app, x, z, yaw = 0) {
    this.app = app;
    const g = new THREE.Group();
    g.name = 'Geräteausgabe';
    const steel = lm('stahl_grau'), top = lm('holz_hell');
    // Tisch 1,4 × 0,7 m
    g.add(mesh(G.box(1.4, 0.035, 0.7), top, 0, 0.8, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.box(0.04, 0.78, 0.04), steel, sx * 0.66, 0.39, sz * 0.31));
    g.add(mesh(G.box(1.3, 0.025, 0.6), steel, 0, 0.18, 0));
    // Transportkoffer (schwarz mit orangen Verschlüssen)
    const caseMat = lmTint('kunststoff_schwarz', '#232629'), latch = lmTint('kunststoff_weiss', '#e8901e');
    const addCase = (w, hh, d, x2, y2, z2, ry) => {
      const c = new THREE.Group(); c.position.set(x2, y2, z2); c.rotation.y = ry; g.add(c);
      c.add(mesh(G.rbox(w, hh, d, 0.025), caseMat, 0, hh / 2, 0));
      c.add(mesh(G.box(w * 0.98, 0.012, d * 1.01), lmTint('kunststoff_schwarz', '#121416'), 0, hh * 0.62, 0));
      for (const s of [-1, 1]) c.add(mesh(G.box(0.05, 0.035, 0.015), latch, s * w * 0.28, hh * 0.62, d / 2 + 0.006));
      c.add(rod([-w * 0.18, hh + 0.01, 0], [w * 0.18, hh + 0.01, 0], 0.012, caseMat, 8));
    };
    addCase(0.5, 0.22, 0.36, -0.36, 0.8175, -0.06, 0.05);
    addCase(0.42, 0.18, 0.32, 0.22, 0.8175, -0.12, -0.08);
    addCase(0.62, 0.32, 0.42, -0.2, 0.0, 0.05, 0.1);          // großer Koffer unter dem Tisch
    addCase(0.55, 0.26, 0.4, 0.95, 0.0, 0.1, -0.3);            // neben dem Tisch
    // Schild „Geräteausgabe“ auf einem Ständer (Farbfelder statt Schrift – auch der Laser sieht nur Geometrie)
    const sign = new THREE.Group(); sign.position.set(-0.62, 0.8, -0.3); g.add(sign);
    sign.add(rod([0, 0, 0], [0, 0.55, 0], 0.01, steel, 8));
    sign.add(mesh(G.box(0.36, 0.2, 0.01), lmTint('kunststoff_weiss', '#e8901e'), 0, 0.62, 0));
    sign.add(mesh(G.box(0.3, 0.05, 0.004), lmTint('kunststoff_schwarz', '#14171a'), 0, 0.64, 0.007));
    // Feldrechner liegt auf dem Tisch
    this.tablet = tabletModel();
    this.tablet.position.set(0.45, 0.827, 0.14); this.tablet.rotation.y = -0.25;
    g.add(this.tablet);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    app.world.content.add(g);
    this.group = g;
    this.reg = app.world.register(g, { name: 'Geräteausgabe', kind: 'möbel', target: false, movable: false, solid: true });
  }
  get pos() { return this.group.getWorldPosition(new THREE.Vector3()); }
  takeTablet() { if (this.tablet) { this.tablet.visible = false; } }
  get hasTablet() { return !!this.tablet && this.tablet.visible; }
}
