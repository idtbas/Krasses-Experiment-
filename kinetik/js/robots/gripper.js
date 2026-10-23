// Greifer: Zweifinger-Zange, Saugnapf oder Elektromagnet.
// Gehalten wird über eine feste Verbindung, solange die nötige Haltekraft
// (Gewicht + Beschleunigung) kleiner ist als das, was Reibung bzw. Saugkraft hergeben.
// Sonst rutscht der Gegenstand heraus – wie in echt.
import { MATERIALS } from '../world/objects.js';
import { qconj, qmul, qrot, vsub, vlen } from '../core/util.js';

const G = 9.81;

export class Gripper {
  constructor(robot, o) {
    this.robot = robot;
    this.type = o.type;
    this.palm = o.palm;            // Glied, an dem gehalten wird
    this.fingers = o.fingers || []; // [{ servo, part }]
    this.tip = o.tip;               // Greifpunkt im Rahmen des Glieds
    this.axis = o.axis || { x: 0, y: 1, z: 0 };
    this.maxForce = o.force;
    this.closed = o.closed ?? -0.05;
    this.cup = o.cup || null;       // Collider des Saugnapfs/Magneten
    this.strength = 0.8;
    this.held = null;
    this.joint = null;
    this.on = false;
    this.closing = false;
    this.force = 0;
    this.prevV = null;
    this.acc = { x: 0, y: 0, z: 0 };
    this.slipTime = 0;
    this.name = o.name || 'Greifer';
    this.onChange = null;
  }

  get world() { return this.robot.world; }
  get physics() { return this.robot.sim.physics; }

  tipWorld() {
    const b = this.palm.body;
    const p = b.translation(), q = b.rotation();
    const t = qrot(q, this.tip);
    return { x: p.x + t.x, y: p.y + t.y, z: p.z + t.z };
  }
  toolDir() { return qrot(this.palm.body.rotation(), this.axis); }

  applyStrength() {
    for (const f of this.fingers) f.servo.setMaxForce(this.maxForce * this.strength);
  }

  // „greife“
  grip() {
    const self = this;
    if (this.type === 'zange') {
      this.closing = true;
      this.applyStrength();
      for (const f of this.fingers) f.servo.set(this.closed, 1.2);
      return this.robot.run(function* () {
        let t = 0, still = 0;
        for (;;) {
          const dt = yield;
          t += dt;
          if (self.held) { yield* this.wait(0.12); return; }
          const moving = self.fingers.some((f) => Math.abs(f.servo.omega) > 0.01);
          still = moving ? 0 : still + dt;
          if ((t > 0.15 && still > 0.12) || t > 2.5) return;
        }
      }, 'greifer:' + this.name);
    }
    this.on = true;
    this.tryAttach();
    return this.robot.run(function* () { yield* this.wait(0.25); }, 'greifer:' + this.name);
  }

  // „lass los“
  release() {
    this.closing = false;
    this.on = false;
    this.detach();
    if (this.type === 'zange') {
      for (const f of this.fingers) f.servo.set(0, 1.2);
      const self = this;
      return this.robot.run(function* () {
        yield* this.until(() => self.fingers.every((f) => f.servo.reached(0.006)), 1.5);
      }, 'greifer:' + this.name);
    }
    return this.robot.run(function* () { yield* this.wait(0.15); }, 'greifer:' + this.name);
  }

  attach(thing) {
    if (this.held || !thing || thing.heldBy) return false;
    const R = this.robot.R;
    const pb = this.palm.body, ob = thing.body;
    const pq = pb.rotation(), inv = qconj(pq);
    const rel = qrot(inv, vsub(ob.translation(), pb.translation()));
    const relq = qmul(inv, ob.rotation());
    const jd = R.JointData.fixed(rel, relq, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    this.joint = this.world.createImpulseJoint(jd, pb, ob, true);
    this.joint.setContactsEnabled(false);
    this.held = thing;
    thing.heldBy = this.robot;
    this.slipTime = 0;
    // Finger halten ihre Stellung, statt weiter zu drücken
    for (const f of this.fingers) f.servo.freeze();
    if (this.onChange) this.onChange('greift', thing);
    this.robot.sim.emit && this.robot.sim.emit('grip', { robot: this.robot, thing });
    return true;
  }

  detach(reason) {
    if (!this.held) return;
    const thing = this.held;
    if (this.joint && this.world.getImpulseJoint(this.joint.handle)) this.world.removeImpulseJoint(this.joint, true);
    this.joint = null;
    this.held = null;
    thing.heldBy = null;
    thing.body.wakeUp();
    if (reason === 'slip') {
      this.robot.warn(`${capital(thing.kind)} ist aus dem Greifer gerutscht: ${Math.round(thing.mass * 1000)} g sind zu viel für die Haltekraft. Tipp: „greifkraft 100“, langsameres „tempo“ oder ein anderer Greifer.`);
      this.closing = false;
    }
    if (this.onChange) this.onChange('los', thing);
  }

  // Was berührt die Greifflächen?
  touchedThings(collider) {
    const set = new Set();
    this.physics.contacts(collider, (other) => {
      const info = this.physics.infoOf(other);
      if (info && info.entity && info.entity.isObject) set.add(info.entity);
    });
    return set;
  }

  tryAttach() {
    if (this.held) return;
    if (this.type === 'zange') {
      if (!this.closing || this.fingers.length < 2) return;
      const a = this.touchedThings(this.fingers[0].part.colliders[0]);
      if (!a.size) return;
      const b = this.touchedThings(this.fingers[1].part.colliders[0]);
      for (const t of a) if (b.has(t)) { this.attach(t); return; }
      return;
    }
    if (!this.on) return;
    // Saugnapf/Magnet: Kontakt oder sehr nah vor der Fläche
    let cand = null;
    if (this.cup) for (const t of this.touchedThings(this.cup)) { cand = t; break; }
    if (!cand) {
      const o = this.tipWorld(), d = this.toolDir();
      const hit = this.physics.ray(o, d, this.type === 'magnet' ? 0.025 : 0.012, this.robot.rayGroups);
      if (hit && hit.info && hit.info.entity && hit.info.entity.isObject) cand = hit.info.entity;
    }
    if (!cand) return;
    if (this.type === 'magnet' && !cand.magnetic) {
      if (!this.warnedMagnet) { this.robot.warn(`Der Magnet zieht ${cand.kind === 'würfel' ? 'diesen Würfel' : 'das'} nicht an – nur Stahl ist magnetisch.`); this.warnedMagnet = true; }
      return;
    }
    this.attach(cand);
  }

  capacity(thing) {
    const m = MATERIALS[thing.material] || MATERIALS.holz;
    if (this.type === 'zange') {
      const mu = Math.sqrt(1.15 * m.friction);
      return 2 * mu * this.maxForce * this.strength;
    }
    if (this.type === 'sauger') {
      let f = this.maxForce * this.strength;
      if (thing.kind === 'kugel') f *= 0.25;
      if (thing.material === 'schaum') f *= 0.45;
      return f;
    }
    return thing.magnetic ? this.maxForce * this.strength : 0;
  }

  update(dt) {
    // Beschleunigung des Greifers schätzen (für die Haltekraft)
    const v = this.palm.body.linvel();
    if (this.prevV) {
      const k = Math.min(1, dt * 25);
      this.acc.x += ((v.x - this.prevV.x) / dt - this.acc.x) * k;
      this.acc.y += ((v.y - this.prevV.y) / dt - this.acc.y) * k;
      this.acc.z += ((v.z - this.prevV.z) / dt - this.acc.z) * k;
    }
    this.prevV = { x: v.x, y: v.y, z: v.z };
    if (this.held) {
      const need = this.held.mass * vlen({ x: this.acc.x, y: this.acc.y + G, z: this.acc.z });
      const cap = this.capacity(this.held);
      this.force = this.type === 'zange' ? this.maxForce * this.strength : need;
      this.slipTime = need > cap ? this.slipTime + dt : 0;
      if (this.slipTime > 0.06) this.detach('slip');
    } else {
      let f = 0;
      if (this.type === 'zange' && this.closing) {
        for (const fi of this.fingers) f = Math.max(f, Math.min(1, fi.servo.load) * fi.servo.maxForce);
      }
      this.force = f;
    }
  }

  post() { this.tryAttach(); }

  get isOpen() { return this.type === 'zange' ? this.fingers.every((f) => Math.abs(f.servo.value()) < 0.008) : !this.on; }
}

function capital(s) { return s ? s[0].toUpperCase() + s.slice(1) : 'Der Gegenstand'; }
