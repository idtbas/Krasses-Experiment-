// Vernetzen von Scans (TSDF + Surface Nets im Verarbeitungs-Worker) – für den Feldrechner und die Handy-App.
import * as THREE from 'three';
import { MESH_LAYER } from './cloud.js';

// Ursprung (Scannerposition) je Punkt für die TSDF-Integration
export function originsFor(scans) {
  const parts = [], origins = [];
  for (const s of scans) {
    const g = s.cloud.gather();
    const oi = new Uint16Array(g.n);
    if (s.traj && s.traj.length) {
      // mobile Aufnahme: Trajektorie (t, x, y, z) – nächster Zeitpunkt
      const base = origins.length / 3;
      const step = Math.max(1, Math.ceil(s.traj.length / 60000));
      const T = s.traj.filter((_, k) => k % step === 0);
      for (const q of T) origins.push(q[1], q[2], q[3]);
      let j = 0;
      const order = Array.from({ length: g.n }, (_, k) => k).sort((x, y) => g.t[x] - g.t[y]);
      for (const k of order) { while (j < T.length - 1 && T[j + 1][0] <= g.t[k]) j++; oi[k] = base + j; }
    } else {
      let root = s;
      while (root.parent && !root.local && !root.traj) root = root.parent;
      const o = new THREE.Vector3().setFromMatrixPosition(root.pose || new THREE.Matrix4());
      if (!root.local && root.origin) o.copy(root.origin);
      oi.fill(origins.length / 3);
      origins.push(o.x, o.y, o.z);
    }
    parts.push({ g, oi });
  }
  return { parts, origins: new Float32Array(origins) };
}

// zufällige Teilmenge mit passendem Ursprungsindex
function thin(g, oi, max) {
  if (g.n <= max) return { pos: g.pos.slice(0, g.n * 3), rgb: g.rgb.slice(0, g.n * 3), oi };
  const pos = new Float32Array(max * 3), rgb = new Uint8Array(max * 3), o2 = new Uint16Array(max);
  const step = g.n / max;
  for (let k = 0; k < max; k++) {
    const i = Math.min(g.n - 1, Math.floor(k * step + Math.random() * step));
    pos.set(g.pos.subarray(i * 3, i * 3 + 3), k * 3); rgb.set(g.rgb.subarray(i * 3, i * 3 + 3), k * 3); o2[k] = oi[i];
  }
  return { pos, rgb, oi: o2 };
}

// Netz aus einem Scan: Geometrie (und Rohdaten für den Export)
export async function meshScan(app, scan, voxel, o = {}) {
  const { parts, origins } = originsFor([scan]);
  const g = parts[0].g;
  if (!g.n) return null;
  const T = thin(g, parts[0].oi, o.maxPoints || 3e6);
  const r = await app.proc.run('mesh', { pos: T.pos, rgb: T.rgb, origins, oIndex: T.oi, voxel, trunc: voxel * (o.trunc || 3), box: o.box || null });
  if (!r.index.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
  const hasRGB = r.rgb.some((v) => v > 0);
  if (hasRGB) { const c = new Float32Array(r.rgb.length); for (let i = 0; i < c.length; i++) c[i] = Math.pow(r.rgb[i] / 255, 2.2); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  geo.setIndex(new THREE.BufferAttribute(r.index, 1));
  geo.computeVertexNormals();
  return { geo, r, hasRGB, points: g.n };
}

// Netz ins Projekt übernehmen (Viewer-Ebene, Export)
export function addMeshToProject(app, scan, res, voxel, name) {
  const m = new THREE.Mesh(res.geo, new THREE.MeshStandardMaterial({ color: res.hasRGB ? '#ffffff' : '#b8c4d0', vertexColors: res.hasRGB, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }));
  m.layers.set(MESH_LAYER);
  app.world.clouds.add(m);
  app.project.meshes = app.project.meshes || [];
  const item = { name: name || `Netz · ${scan.name}`, mesh: m, data: { pos: res.r.pos, rgb: res.r.rgb, index: res.r.index }, voxel, scan };
  app.project.meshes.push(item);
  app.project.changed();
  return item;
}
