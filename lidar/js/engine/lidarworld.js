// Brücke zwischen sichtbarer Three.js-Welt und Scan-Kern.
// Feste Umgebung → eine statische BVH in Weltkoordinaten. Alles mit userData.lidarBody (Objekte, Roboterglieder,
// Personen) → eigene Instanz mit lokaler BVH; Bewegungen kosten dann nur eine neue Matrix.
import * as THREE from 'three';
import { TriBVH } from './bvh.js';
import { packMaterials } from './beam.js';
import { lidarProps } from '../world/lidarmat.js';

class Grow {
  constructor(n = 1 << 16, T = Float32Array) { this.a = new T(n); this.n = 0; this.T = T; }
  push3(x, y, z) { if (this.n + 3 > this.a.length) this.grow(); this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z; }
  push(v) { if (this.n + 1 > this.a.length) this.grow(); this.a[this.n++] = v; }
  grow() { const b = new this.T(this.a.length * 2); b.set(this.a); this.a = b; }
  done() { return this.a.slice(0, this.n); }
}

const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _inst = new THREE.Matrix4();

function to34(m, out, o = 0) {
  const e = m.elements;
  out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12];
  out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13];
  out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14];
  return out;
}

function hiddenOrExcluded(obj) {
  for (let o = obj; o; o = o.parent) { if (!o.visible || o.userData.noLidar) return true; }
  return false;
}
function bodyOf(obj, root) {
  for (let o = obj; o && o !== root; o = o.parent) if (o.userData.lidarBody) return o;
  return null;
}
function objIdOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.objId != null) return o.userData.objId;
  return 0;
}

export class LidarWorld {
  constructor(engine) {
    this.engine = engine;
    this.matIndex = new Map();
    this.matList = [];
    this.bodies = [];      // { obj, inst, last: Float32Array(12), enabled }
    this.tris = 0;
  }

  materialId(mat) {
    let id = this.matIndex.get(mat.uuid);
    if (id == null) {
      id = this.matList.length;
      this.matList.push(lidarProps(mat));
      this.matIndex.set(mat.uuid, id);
    }
    return id;
  }

  // Dreiecke eines Netzes anhängen. M: Matrix ins Zielsystem.
  appendMesh(mesh, M, tris, mats, objs, obj) {
    const g = mesh.geometry;
    const pos = g.attributes.position;
    if (!pos) return;
    const idx = g.index ? g.index.array : null;
    const multi = Array.isArray(mesh.material);
    const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.length : pos.count, materialIndex: 0 }];
    const isInst = mesh.isInstancedMesh;
    const count = isInst ? mesh.count : 1;
    const P = new THREE.Matrix4();
    for (let k = 0; k < count; k++) {
      if (isInst) { mesh.getMatrixAt(k, _inst); P.multiplyMatrices(M, _inst); } else P.copy(M);
      const e = P.elements;
      for (const gr of groups) {
        const mat = multi ? mesh.material[gr.materialIndex] : mesh.material;
        if (!mat || mat.userData?.noLidar) continue;
        const mid = this.materialId(mat);
        const end = Math.min(gr.start + gr.count, idx ? idx.length : pos.count);
        for (let i = gr.start; i + 2 < end; i += 3) {
          for (let q = 0; q < 3; q++) {
            const vi = idx ? idx[i + q] : i + q;
            const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
            tris.push3(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
          }
          mats.push(mid); objs.push(obj);
        }
      }
    }
  }

  // Ganze Welt aufbereiten und an die Worker schicken
  async build(root) {
    const t0 = performance.now();
    root.updateMatrixWorld(true);
    this.matIndex.clear(); this.matList = []; this.bodies = [];
    const sT = new Grow(1 << 18), sM = new Grow(1 << 16, Uint16Array), sO = new Grow(1 << 16, Uint16Array);
    const perBody = new Map(); // body → { tris, mats, objs }
    root.traverse((o) => {
      if (!o.isMesh || hiddenOrExcluded(o)) return;
      if (o.material && !Array.isArray(o.material) && (o.material.isLineBasicMaterial || o.material.isPointsMaterial || o.material.isShaderMaterial)) return;
      const body = bodyOf(o, root);
      const obj = objIdOf(o);
      if (!body) { this.appendMesh(o, o.matrixWorld, sT, sM, sO, obj); return; }
      let b = perBody.get(body);
      if (!b) { b = { tris: new Grow(1 << 12), mats: new Grow(1 << 10, Uint16Array), objs: new Grow(1 << 10, Uint16Array) }; perBody.set(body, b); }
      // in das Körpersystem: inv(body.matrixWorld) · mesh.matrixWorld
      _mi.copy(body.matrixWorld).invert();
      _m.multiplyMatrices(_mi, o.matrixWorld);
      this.appendMesh(o, _m, b.tris, b.mats, b.objs, obj);
    });
    const blas = [], inst = [];
    const st = TriBVH.build(sT.done(), sM.done(), sO.done());
    blas.push(st.serialize());
    inst.push({ blas: 0, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0] });
    this.tris = st.count;
    const shared = new Map(); // gleiche Geometrie (blasKey) teilen
    for (const [body, b] of perBody) {
      const key = body.userData.blasKey;
      let id = key ? shared.get(key) : undefined;
      if (id == null) {
        const bv = TriBVH.build(b.tris.done(), b.mats.done(), b.objs.done());
        if (bv.count === 0) continue;
        id = blas.length;
        blas.push(bv.serialize());
        this.tris += bv.count;
        if (key) shared.set(key, id);
      }
      const m = to34(body.matrixWorld, new Float32Array(12));
      inst.push({ blas: id, m: Array.from(m) });
      this.bodies.push({ obj: body, inst: inst.length - 1, last: m, enabled: true });
    }
    this.buildMs = performance.now() - t0;
    await this.engine.setScene(blas, inst, packMaterials(this.matList));
    this.readyMs = performance.now() - t0;
    return { tris: this.tris, bodies: this.bodies.length, materials: this.matList.length, ms: this.readyMs };
  }

  // Bewegte Körper an die Worker melden
  sync() {
    if (!this.bodies.length) return;
    const list = [];
    const tmp = new Float32Array(12);
    for (const b of this.bodies) {
      b.obj.updateWorldMatrix(true, false);
      to34(b.obj.matrixWorld, tmp);
      const en = !hiddenOrExcluded(b.obj);
      let changed = en !== b.enabled;
      if (!changed) for (let k = 0; k < 12; k++) if (Math.abs(tmp[k] - b.last[k]) > 1e-6) { changed = true; break; }
      if (!changed) continue;
      b.last.set(tmp); b.enabled = en;
      list.push(b.inst, en ? 1 : 0, ...tmp);
    }
    if (list.length) this.engine.updateMatrices(new Float32Array(list));
  }

  // Materialeigenschaften neu übertragen (z. B. nach Änderung im Inspektor)
  pushMaterials() { this.engine.setMaterials(packMaterials(this.matList)); }
}
