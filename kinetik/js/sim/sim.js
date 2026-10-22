// Simulation: verwaltet Physikwelt, alle Dinge in der Welt und den festen Zeittakt.
import * as THREE from 'three';
import { Physics } from '../physics/physics.js';

export class Entity {
  constructor(sim) {
    this.sim = sim;
    this.links = [];
    this.bodies = [];
    this.root = new THREE.Group();
    sim.renderer.world.add(this.root);
    this.alive = true;
  }
  get R() { return this.sim.physics.R; }
  get world() { return this.sim.physics.world; }

  addBody(desc) {
    const b = this.world.createRigidBody(desc);
    this.bodies.push(b);
    return b;
  }
  collider(desc, body, data) {
    const c = this.world.createCollider(desc, body);
    this.sim.physics.tag(c, { entity: this, ...(data || {}) });
    return c;
  }
  link(body, obj) {
    this.root.add(obj);
    this.links.push([body, obj]);
    this.syncOne(body, obj);
    return obj;
  }
  syncOne(b, o) {
    const t = b.translation(), r = b.rotation();
    o.position.set(t.x, t.y, t.z);
    o.quaternion.set(r.x, r.y, r.z, r.w);
  }
  sync() { for (const [b, o] of this.links) this.syncOne(b, o); }
  dispose() {
    this.alive = false;
    for (const b of this.bodies) this.sim.physics.removeBody(b);
    this.bodies = [];
    this.links = [];
    this.root.removeFromParent();
  }
}

export class Sim {
  constructor(R, renderer) {
    this.renderer = renderer;
    this.physics = new Physics(R);
    this.entities = [];
    this.time = 0;
    this.acc = 0;
    this.running = false;
    this.speed = 1;
    this.hooks = [];       // vor jedem Physikschritt
    this.postHooks = [];   // nach jedem Physikschritt
    this.robotSeq = 0;
    this.stepCount = 0;
  }

  get dt() { return this.physics.dt; }

  add(e) { this.entities.push(e); return e; }
  remove(e) {
    const i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
    e.dispose();
  }

  clear() {
    for (const e of this.entities) e.dispose();
    this.entities = [];
    this.physics.reset();
    this.time = 0;
    this.acc = 0;
    this.robotSeq = 0;
    this.stepCount = 0;
    this.renderer.helpers.clear();
  }

  get robots() { return this.entities.filter((e) => e.isRobot); }
  get objects() { return this.entities.filter((e) => e.isObject); }
  ofKind(kind) { return this.entities.filter((e) => e.kind === kind); }

  advance(frameDt) {
    if (!this.running) return 0;
    this.acc += Math.min(frameDt, 0.1) * this.speed;
    let n = 0;
    while (this.acc >= this.dt && n < 8) {
      this.substep();
      this.acc -= this.dt;
      n++;
    }
    if (n === 8) this.acc = 0;
    return n;
  }

  substep() {
    const dt = this.dt;
    for (const h of this.hooks) h(dt);
    for (const e of this.entities) if (e.update) e.update(dt);
    this.physics.step();
    for (const e of this.entities) if (e.post) e.post(dt);
    for (const h of this.postHooks) h(dt);
    this.time += dt;
    this.stepCount++;
  }

  sync() {
    for (const e of this.entities) e.sync();
  }

  // Bodenfarbe an einer Stelle (für Linien- und Farbsensoren)
  floorAt(x, z, y = 0) {
    let best = null;
    for (const e of this.entities) {
      if (e.floorColorAt) {
        const c = e.floorColorAt(x, z, y);
        if (c && (!best || c.priority > best.priority)) best = c;
      }
    }
    return best || { color: 'weiß', light: 92, priority: 0 };
  }

  // Strahl aus der Kamera: welches Ding liegt unter dem Finger?
  pickRay(origin, dir, maxDist = 50) {
    const hit = this.physics.ray(origin, dir, maxDist, 0xffffffff);
    return hit;
  }
}
