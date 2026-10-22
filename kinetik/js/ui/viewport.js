// Die 3D-Ansicht: Anfassen und Werfen (physikalisch), Verschieben im Bau-Modus,
// Pfade zeichnen mit dem Apple Pencil, Sprechblasen und Auswahl.
import * as THREE from 'three';
import { h, clear, clamp } from '../core/util.js';

const _ray = new THREE.Raycaster();

export class Viewport {
  constructor(app) {
    this.app = app;
    this.tool = 'hand';
    this.overlay = h('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 4 } });
    this.bubbles = new Map();
    this.pathLine = null;
    this.grab = null;
    this.selRing = this.makeRing();
    app.renderer.helpers.add(this.selRing);
  }

  get sim() { return this.app.sim; }
  get renderer() { return this.app.renderer; }

  attach(viewEl, canvas) {
    this.viewEl = viewEl;
    this.canvas = canvas;
    viewEl.appendChild(this.overlay);
    const cam = this.app.cam;
    cam.interceptor = (e, info) => this.pointerDown(e, info);
    cam.onTap = (info) => this.tap(info);
    cam.onHover = (info) => this.hover(info);
  }

  makeRing() {
    const g = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.29, 64), new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.9, depthWrite: false }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = 0.003;
    g.visible = false;
    g.renderOrder = 2;
    return g;
  }

  rayFrom(info) {
    _ray.setFromCamera({ x: info.nx, y: info.ny }, this.renderer.camera);
    return _ray.ray;
  }

  pick(info) {
    const r = this.rayFrom(info);
    const hit = this.sim.physics.ray({ x: r.origin.x, y: r.origin.y, z: r.origin.z }, { x: r.direction.x, y: r.direction.y, z: r.direction.z }, 60, 0xffffffff);
    return hit ? { ...hit, ray: r } : { ray: r, info: null };
  }

  floorPoint(info, y = 0) {
    const r = this.rayFrom(info);
    if (Math.abs(r.direction.y) < 1e-4) return null;
    const t = (y - r.origin.y) / r.direction.y;
    if (t < 0) return null;
    return r.origin.clone().addScaledVector(r.direction, t);
  }

  /* ---------- Eingaben ---------- */

  pointerDown(e, info) {
    const app = this.app;
    // Pfad zeichnen: Werkzeug aktiv, oder Pencil im Pfad-Modus
    if (this.tool === 'path' && (info.type === 'pen' || info.type === 'mouse' || info.type === 'touch')) return this.startPath(info);
    const hit = this.pick(info);
    const ent = hit.info && hit.info.entity;
    if (!ent) return null;
    if (this.tool === 'move' && app.canEditWorld()) return this.startMove(ent, hit, info);
    if (this.tool === 'hand') {
      const body = this.bodyOf(hit);
      if (body && body.isDynamic()) return this.startGrab(ent, body, hit, info);
    }
    return null;
  }

  bodyOf(hit) {
    const c = hit.collider;
    return c ? c.parent() : null;
  }

  tap(info) {
    const hit = this.pick(info);
    const ent = hit.info && hit.info.entity;
    this.app.onViewTap(ent, hit);
  }

  hover(info) {
    if (this.tool === 'path' || this.grab) return;
    const hit = this.pick(info);
    const ent = hit.info && hit.info.entity;
    this.canvas.style.cursor = ent && (ent.isObject || ent.isRobot) ? (this.tool === 'move' ? 'move' : 'grab') : '';
  }

  // Physikalisch anfassen: eine Feder zieht den Körper zum Finger
  startGrab(ent, body, hit, info) {
    const R = this.sim.physics.R;
    const world = this.sim.physics.world;
    const p = hit.point;
    const cursor = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
    const bp = body.translation(), bq = body.rotation();
    const inv = { x: -bq.x, y: -bq.y, z: -bq.z, w: bq.w };
    const local = rotate(inv, { x: p.x - bp.x, y: p.y - bp.y, z: p.z - bp.z });
    const mass = ent.isRobot ? Math.min(40, ent.specs().mass) : body.mass();
    const k = Math.max(30, mass * 90);
    const d = 2 * Math.sqrt(k * Math.max(0.05, body.mass())) * 0.9;
    const jd = R.JointData.spring(0, k, d, { x: 0, y: 0, z: 0 }, local);
    const joint = world.createImpulseJoint(jd, cursor, body, true);
    body.wakeUp();
    // Ebene durch den Griffpunkt, senkrecht zur Blickrichtung (waagerecht projiziert)
    const camDir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(camDir);
    camDir.y = 0; camDir.normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(p.x, p.y, p.z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ff7a1a' }));
    this.renderer.helpers.add(line);
    this.grab = { ent, body, cursor, joint, plane, target: new THREE.Vector3(p.x, p.y, p.z), local, line };
    this.app.onGrab && this.app.onGrab(ent);
    const self = this;
    return {
      move(i) {
        const r = self.rayFrom(i);
        const pt = new THREE.Vector3();
        if (r.intersectPlane(self.grab.plane, pt)) {
          pt.y = Math.max(0.02, pt.y);
          self.grab.target.copy(pt);
        }
      },
      end() { self.endGrab(); },
    };
  }

  updateGrab() {
    const g = this.grab;
    if (!g) return;
    if (!g.body || !this.sim.physics.world.getRigidBody(g.body.handle)) { this.endGrab(); return; }
    // Ziel weich ansteuern (begrenzt die Kraft)
    const cur = g.cursor.translation();
    const t = g.target;
    const max = 0.06;
    const dx = clamp(t.x - cur.x, -max, max), dy = clamp(t.y - cur.y, -max, max), dz = clamp(t.z - cur.z, -max, max);
    g.cursor.setNextKinematicTranslation({ x: cur.x + dx, y: cur.y + dy, z: cur.z + dz });
    const bp = g.body.translation(), bq = g.body.rotation();
    const wp = rotate(bq, g.local);
    const pos = g.line.geometry.attributes.position;
    pos.setXYZ(0, cur.x, cur.y, cur.z);
    pos.setXYZ(1, bp.x + wp.x, bp.y + wp.y, bp.z + wp.z);
    pos.needsUpdate = true;
  }

  endGrab() {
    const g = this.grab;
    if (!g) return;
    this.grab = null;
    const world = this.sim.physics.world;
    try {
      if (world.getImpulseJoint(g.joint.handle)) world.removeImpulseJoint(g.joint, true);
      if (world.getRigidBody(g.cursor.handle)) world.removeRigidBody(g.cursor);
    } catch { /* Welt wurde inzwischen neu gebaut */ }
    g.line.removeFromParent();
  }

  // Bau-Modus: Gegenstände auf dem Boden verschieben
  startMove(ent, hit, info) {
    const app = this.app;
    const spec = ent.isRobot ? app.robotDefOf(ent).spawn : ent.spec;
    if (!spec) return null;
    const y = ent.isRobot ? (spec.y || 0) : (ent.isObject ? 0 : (ent.baseY || 0));
    const start = this.floorPoint(info, y) || new THREE.Vector3(hit.point.x, y, hit.point.z);
    const off = { x: (spec.x || 0) - start.x, z: (spec.z || 0) - start.z };
    this.app.select(ent);
    const self = this;
    let moved = false;
    return {
      move(i) {
        const p = self.floorPoint(i, y);
        if (!p) return;
        moved = true;
        const x = Math.round((p.x + off.x) * 100) / 100, z = Math.round((p.z + off.z) * 100) / 100;
        app.moveEntity(ent, x, z, false);
      },
      end() { if (moved) app.moveEntity(ent, null, null, true); },
    };
  }

  // Pfad zeichnen
  startPath(info) {
    const pts = [];
    const add = (i) => {
      const p = this.floorPoint(i, 0);
      if (!p) return;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.06) pts.push({ x: p.x, z: p.z });
      this.drawPath(pts);
    };
    add(info);
    const self = this;
    return {
      move(i) { add(i); },
      end() {
        if (pts.length >= 2) { self.app.setPath(pts); } else { self.app.setPath(null); }
      },
    };
  }

  drawPath(pts) {
    if (this.pathLine) { this.pathLine.removeFromParent(); this.pathLine = null; }
    if (!pts || pts.length < 2) return;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (i % 2 === 1) continue;
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.018, len), mat);
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = -Math.atan2(b.x - a.x, b.z - a.z);
      seg.position.set((a.x + b.x) / 2, 0.004, (a.z + b.z) / 2);
      g.add(seg);
    }
    const end = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), mat);
    end.rotation.x = -Math.PI / 2;
    const last = pts[pts.length - 1];
    end.position.set(last.x, 0.004, last.z);
    g.add(end);
    this.pathLine = g;
    this.renderer.scene.add(g);
  }

  /* ---------- Überlagerungen ---------- */

  update(dt) {
    this.updateGrab();
    // Auswahlring
    const sel = this.app.selected;
    if (sel && sel.alive) {
      let p, r = 0.28;
      if (sel.isRobot) { p = sel.frame().p; r = sel.type === 'humanoid' ? 0.32 : sel.type === 'rover' ? 0.26 : 0.24; }
      else if (sel.isObject) { p = sel.body.translation(); r = 0.08; }
      else { p = { x: sel.spec.x || 0, z: sel.spec.z || 0 }; r = 0.3; }
      this.selRing.visible = true;
      this.selRing.position.set(p.x, (sel.baseY || 0) + 0.004, p.z);
      this.selRing.scale.setScalar(r / 0.28);
      this.selRing.material.opacity = 0.55 + 0.35 * Math.sin(performance.now() / 300);
    } else this.selRing.visible = false;
    this.updateBubbles();
  }

  updateBubbles() {
    const now = this.sim.time;
    const alive = new Set();
    for (const r of this.sim.robots) {
      const s = r.speech;
      if (!s || now > s.until) continue;
      alive.add(r);
      let b = this.bubbles.get(r);
      if (!b || b.text !== s.text) {
        if (b) b.el.remove();
        const el = h('div.bubble', s.text);
        this.overlay.appendChild(el);
        b = { el, text: s.text };
        this.bubbles.set(r, b);
      }
      const head = this.headPos(r);
      const sp = this.renderer.project(head);
      b.el.style.display = sp.visible ? '' : 'none';
      b.el.style.left = sp.x + 'px';
      b.el.style.top = sp.y - 8 + 'px';
    }
    for (const [r, b] of this.bubbles) if (!alive.has(r)) { b.el.remove(); this.bubbles.delete(r); }
  }

  headPos(r) {
    if (r.type === 'humanoid') { const p = r.headPart.body.translation(); return new THREE.Vector3(p.x, p.y + 0.32, p.z); }
    if (r.type === 'rover') { const p = r.frame().p; return new THREE.Vector3(p.x, p.y + 0.3, p.z); }
    const t = r.parts.get('hand').body.translation();
    return new THREE.Vector3(t.x, t.y + 0.25, t.z);
  }

  clearOverlay() {
    for (const b of this.bubbles.values()) b.el.remove();
    this.bubbles.clear();
    this.endGrab();
    if (this.pathLine) { this.pathLine.removeFromParent(); this.pathLine = null; }
  }
}

function rotate(q, v) {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
}

export { clear };
