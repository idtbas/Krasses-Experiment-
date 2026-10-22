// Servo: ein motorisiertes Gelenk mit Bahnplanung (Trapezprofil), Drehmomentgrenze, Lastmessung
// und Wärmemodell (Verlustleistung je nach Wirkungsgrad, Derating bei Übertemperatur).
import { qconj, qmul, qrot, twistAngle, vsub, vdot, clamp, DEG, RAD } from '../core/util.js';

const T_LIMIT = 90, T_RESUME = 75;

export class Servo {
  constructor(robot, o) {
    this.robot = robot;
    this.name = o.name;
    this.label = o.label || o.name;
    this.joint = o.joint;
    this.b1 = o.b1;
    this.b2 = o.b2;
    this.axis = o.axis;
    this.anchor1 = o.anchor1 || { x: 0, y: 0, z: 0 };
    this.kind = o.kind || 'rev';
    this.min = o.min ?? -Math.PI;
    this.max = o.max ?? Math.PI;
    this.maxSpeed = o.speed ?? 1.5;
    this.speedFactor = o.speedFactor ?? 1;
    this.accel = o.accel ?? this.maxSpeed * 4;
    this.maxForce = o.force ?? 20;
    this.baseForce = this.maxForce;
    this.k = o.stiffness ?? 2000;
    this.d = o.damping ?? 80;
    this.eff = o.eff ?? 0.85;
    this.group = o.group;
    this.hidden = !!o.hidden;
    this.home = o.home ?? 0;
    this.setpoint = o.init ?? 0;
    this.target = this.setpoint;
    this.vel = 0;
    this.speedScale = 1;
    this.limp = false;
    this.softness = 1;
    this.load = 0;
    this.overloadTime = 0;
    this.lastValue = this.setpoint;
    this.omega = 0;
    this.torque = 0;
    this.temp = robot.sim.ambient ? robot.sim.ambient() : 22;
    this.derated = false;
    this.apply();
  }

  // Messwert in Rad bzw. Meter
  value() {
    if (this.kind === 'rev') {
      const q = qmul(qconj(this.b1.rotation()), this.b2.rotation());
      return twistAngle(q, this.axis);
    }
    const p1 = this.b1.translation(), q1 = this.b1.rotation();
    const a = qrot(q1, this.anchor1);
    const w = { x: p1.x + a.x, y: p1.y + a.y, z: p1.z + a.z };
    return vdot(vsub(this.b2.translation(), w), qrot(q1, this.axis));
  }
  get display() { return this.kind === 'rev' ? this.value() * RAD : this.value() * 100; }
  get targetDisplay() { return this.kind === 'rev' ? this.target * RAD : this.target * 100; }

  set(target, speedScale = 1) {
    const t = clamp(target, this.min, this.max);
    this.target = t;
    this.speedScale = clamp(speedScale, 0.02, 2);
    this.limp = false;
    return t !== target;
  }
  setDeg(deg, s) { return this.set(this.kind === 'rev' ? deg * DEG : deg / 100, s); }

  hold() { this.target = this.setpoint; this.vel = 0; }
  freeze() { const v = this.value(); this.setpoint = this.target = clamp(v, this.min, this.max); this.vel = 0; }
  // Sicherer Halt: an der aktuellen Stelle stehen bleiben, Ziel behalten
  pause() { const v = this.value(); this.setpoint = clamp(v, this.min, this.max); this.vel = 0; }

  get moving() { return Math.abs(this.target - this.setpoint) > 1e-4; }
  reached(tol) {
    const t = tol ?? (this.kind === 'rev' ? 2.5 * DEG : 0.004);
    return !this.moving && Math.abs(this.value() - this.target) < t;
  }

  update(dt) {
    const paused = this.robot.paused && !this.hidden;
    if (!paused) {
      const vmax = this.maxSpeed * this.speedScale * this.speedFactor;
      const amax = this.accel * Math.max(0.3, this.speedScale) * Math.min(1.6, this.speedFactor);
      const err = this.target - this.setpoint;
      const vWant = Math.sign(err) * Math.min(vmax, Math.sqrt(2 * amax * Math.abs(err)));
      const dv = clamp(vWant - this.vel, -amax * dt, amax * dt);
      this.vel += dv;
      let step = this.vel * dt;
      if (Math.abs(step) > Math.abs(err)) { step = err; this.vel = 0; }
      this.setpoint += step;
    } else this.vel = 0;
    const v = this.value();
    this.omega = (v - this.lastValue) / dt;
    this.lastValue = v;
    const tau = clamp(this.k * (this.setpoint - v), -this.maxForce, this.maxForce);
    this.torque = tau;
    this.load += (Math.abs(tau) / this.maxForce - this.load) * Math.min(1, dt * 6);
    this.overloadTime = this.load > 0.97 ? this.overloadTime + dt : 0;
    if (!this.hidden) this.heat(dt);
    this.apply();
  }

  // Erwärmung: Verlustleistung steigt mit dem Quadrat der Last, je schlechter der Wirkungsgrad desto mehr
  heat(dt) {
    const amb = this.robot.sim.ambient ? this.robot.sim.ambient() : 22;
    const loss = 2 + 55 * this.load * this.load * (1 - this.eff) / 0.45;
    this.temp += ((loss - 0.75 * (this.temp - amb)) / 12) * dt;
    if (!this.derated && this.temp > T_LIMIT) {
      this.derated = true;
      this.setMaxForce(this.baseForce * 0.7);
      this.robot.warn(`${this.label}: Übertemperatur ${Math.round(this.temp)} °C – Drehmoment auf 70 % begrenzt.`);
    } else if (this.derated && this.temp < T_RESUME) {
      this.derated = false;
      this.setMaxForce(this.baseForce);
    }
  }

  apply() {
    if (this.limp) {
      this.joint.configureMotor(this.setpoint, 0, 0, this.d * 0.15);
      return;
    }
    const s = this.softness;
    this.joint.configureMotor(this.setpoint, this.robot.paused && !this.hidden ? 0 : this.vel, this.k * s, this.d * Math.sqrt(s));
  }

  setMaxForce(f) { this.maxForce = f; this.joint.setMotorMaxForce(f); }

  // Mechanische Leistung für den Akku
  get power() { return Math.abs(this.omega * this.torque); }
}
