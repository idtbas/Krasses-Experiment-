// Kamerasteuerung für iPad: Finger, Apple Pencil, Trackpad (Magic Keyboard) und Maus.
//  1 Finger / Pencil / Klick ziehen  → drehen
//  2 Finger ziehen                   → verschieben, zusammenziehen → zoomen, drehen → schwenken
//  Trackpad: zwei Finger scrollen    → drehen, ⇧ + scrollen → verschieben, Pinch → zoomen
import * as THREE from 'three';
import { clamp } from '../core/util.js';

export class OrbitCam {
  constructor(camera, el) {
    this.cam = camera;
    this.el = el;
    this.target = new THREE.Vector3(0, 0.5, 0);
    this.goalTarget = this.target.clone();
    this.yaw = 0.7; this.pitch = 0.42; this.dist = 3.2;
    this.goal = { yaw: this.yaw, pitch: this.pitch, dist: this.dist };
    this.minDist = 0.35; this.maxDist = 14;
    this.pointers = new Map();
    this.follow = null; // Funktion → Vector3
    this.interceptor = null; // (event, info) → Handler oder null
    this.onTap = null;
    this.onHover = null;
    this.enabled = true;
    this.gesture = null;
    this.bind();
  }

  bind() {
    const el = this.el;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('lostpointercapture', (e) => { if (this.pointers.has(e.pointerId)) this.up(e, true); });
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Safari: Pinch auf dem Trackpad
    el.addEventListener('gesturestart', (e) => { e.preventDefault(); if (this.touchCount() === 0) this.gesture = { dist: this.goal.dist, yaw: this.goal.yaw, rot: e.rotation || 0 }; });
    el.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      if (!this.gesture || this.touchCount() > 0) return;
      this.goal.dist = clamp(this.gesture.dist / (e.scale || 1), this.minDist, this.maxDist);
      this.goal.yaw = this.gesture.yaw - ((e.rotation || 0) - this.gesture.rot) * Math.PI / 180;
    });
    el.addEventListener('gestureend', (e) => { e.preventDefault(); this.gesture = null; });
  }

  touchCount() { let n = 0; for (const p of this.pointers.values()) if (p.type === 'touch') n++; return n; }

  local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  down(e) {
    if (!this.enabled) return;
    const l = this.local(e);
    const info = { x: l.x, y: l.y, nx: (l.x / l.w) * 2 - 1, ny: -(l.y / l.h) * 2 + 1, type: e.pointerType, button: e.button, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };
    // Erst fragen, ob ein Gegenstand gegriffen wird
    if (this.interceptor && this.pointers.size === 0 && e.button === 0) {
      const handler = this.interceptor(e, info);
      if (handler) {
        this.pointers.set(e.pointerId, { x: l.x, y: l.y, sx: l.x, sy: l.y, type: e.pointerType, handler, t: performance.now() });
        try { this.el.setPointerCapture(e.pointerId); } catch { /* egal */ }
        return;
      }
    }
    // ein laufender Gegenstands-Griff wird nicht von einem zweiten Finger gestört
    for (const p of this.pointers.values()) if (p.handler) return;
    this.pointers.set(e.pointerId, { x: l.x, y: l.y, sx: l.x, sy: l.y, type: e.pointerType, button: e.button, shift: e.shiftKey, t: performance.now(), moved: 0 });
    try { this.el.setPointerCapture(e.pointerId); } catch { /* egal */ }
    if (this.pointers.size === 2) this.startPinch();
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinch = {
      d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      ang: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
      dist: this.goal.dist, yaw: this.goal.yaw,
    };
  }

  move(e) {
    const l = this.local(e);
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (this.onHover && (e.pointerType === 'mouse' || e.pointerType === 'pen')) {
        this.onHover({ x: l.x, y: l.y, nx: (l.x / l.w) * 2 - 1, ny: -(l.y / l.h) * 2 + 1, type: e.pointerType });
      }
      return;
    }
    const dx = l.x - p.x, dy = l.y - p.y;
    p.moved = Math.max(p.moved || 0, Math.hypot(l.x - p.sx, l.y - p.sy));
    p.x = l.x; p.y = l.y;
    if (p.handler) {
      p.handler.move && p.handler.move({ x: l.x, y: l.y, nx: (l.x / l.w) * 2 - 1, ny: -(l.y / l.h) * 2 + 1, pressure: e.pressure });
      return;
    }
    if (this.pointers.size === 1) {
      const pan = p.button === 2 || p.button === 1 || e.shiftKey;
      if (pan) this.pan(dx, dy);
      else {
        this.goal.yaw -= dx * 0.0085;
        this.goal.pitch = clamp(this.goal.pitch + dy * 0.0065, -0.05, 1.45);
      }
    } else if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.goal.dist = clamp(this.pinch.dist * (this.pinch.d / d), this.minDist, this.maxDist);
      this.goal.yaw = this.pinch.yaw - (ang - this.pinch.ang);
      this.pan(mx - this.pinch.mx, my - this.pinch.my);
      this.pinch.mx = mx; this.pinch.my = my;
    }
  }

  up(e, cancel) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.handler) { p.handler.end && p.handler.end(cancel); return; }
    if (!cancel && (p.moved || 0) < 6 && performance.now() - p.t < 450 && this.pointers.size === 0 && this.onTap) {
      const l = this.local(e);
      this.onTap({ x: l.x, y: l.y, nx: (l.x / l.w) * 2 - 1, ny: -(l.y / l.h) * 2 + 1, type: e.pointerType });
    }
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 1) {
      const q = [...this.pointers.values()][0];
      q.sx = q.x; q.sy = q.y; q.moved = 99;
    }
  }

  wheel(e) {
    e.preventDefault();
    if (!this.enabled) return;
    const lineMode = e.deltaMode === 1;
    const k = lineMode ? 16 : 1;
    const dx = e.deltaX * k, dy = e.deltaY * k;
    if (e.ctrlKey || e.metaKey) {
      this.goal.dist = clamp(this.goal.dist * Math.exp(dy * 0.01), this.minDist, this.maxDist);
    } else if (lineMode || (Math.abs(dy) >= 50 && dx === 0 && Number.isInteger(e.deltaY))) {
      // klassisches Mausrad → zoomen
      this.goal.dist = clamp(this.goal.dist * Math.exp(Math.sign(dy) * 0.12), this.minDist, this.maxDist);
    } else if (e.shiftKey) {
      this.pan(-dx, -dy);
    } else {
      this.goal.yaw += dx * 0.006;
      this.goal.pitch = clamp(this.goal.pitch - dy * 0.005, -0.05, 1.45);
    }
  }

  pan(dx, dy) {
    const s = this.goal.dist * 0.0016;
    const right = new THREE.Vector3(Math.cos(this.goal.yaw), 0, -Math.sin(this.goal.yaw));
    const fwd = new THREE.Vector3(Math.sin(this.goal.yaw), 0, Math.cos(this.goal.yaw));
    this.goalTarget.addScaledVector(right, -dx * s);
    this.goalTarget.addScaledVector(fwd, -dy * s);
    this.follow = null;
  }

  zoom(f) { this.goal.dist = clamp(this.goal.dist * f, this.minDist, this.maxDist); }

  lookAt(target, dist, yaw, pitch) {
    this.goalTarget.copy(target);
    if (dist != null) this.goal.dist = dist;
    if (yaw != null) this.goal.yaw = yaw;
    if (pitch != null) this.goal.pitch = pitch;
  }

  jump() {
    this.target.copy(this.goalTarget);
    this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = this.goal.dist;
  }

  update(dt) {
    if (this.follow) {
      const f = this.follow();
      if (f) this.goalTarget.lerp(f, 1 - Math.exp(-dt * 3));
    }
    const a = 1 - Math.exp(-dt * 14);
    this.yaw += (this.goal.yaw - this.yaw) * a;
    this.pitch += (this.goal.pitch - this.pitch) * a;
    this.dist += (this.goal.dist - this.dist) * a;
    this.target.lerp(this.goalTarget, a);
    const cp = Math.cos(this.pitch);
    this.cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    if (this.cam.position.y < 0.03) this.cam.position.y = 0.03;
    this.cam.lookAt(this.target);
  }
}
