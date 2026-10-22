// Szenario: baut eine Welt aus einer Projektbeschreibung und lässt die Programme laufen.
import { createObject, resetNames } from '../world/objects.js';
import { createRobot } from '../robots/index.js';
import { RobotHost } from '../robots/host.js';
import { Runtime, checkProgram } from '../lang/interp.js';

export class Scenario {
  constructor(sim, hooks = {}) {
    this.sim = sim;
    this.hooks = hooks; // onLog(robot, text, kind), onError(robotDef, err), onFinish(), onSay, onWarn, audio
    this.slots = []; // { def, robot, runtime }
    this.running = false;
    this.startTime = 0;
    sim.hooks.unshift((dt) => this.tick(dt));
  }

  build(project) {
    this.stop(true);
    this.sim.clear();
    resetNames();
    this.project = project;
    (project.objects || []).forEach((o, i) => {
      try { createObject(this.sim, o).specIndex = i; } catch (e) { console.warn(e); }
    });
    this.slots = [];
    for (const def of project.robots || []) this.addRobot(def);
    this.sim.path = project.path ? project.path.slice() : null;
    if (project.onBuild) project.onBuild(this.sim, this);
    return this;
  }

  addRobot(def) {
    const robot = createRobot(this.sim, def.config, def.spawn || {});
    robot.defId = def.id;
    robot.onSay = (r, t) => this.hooks.onSay && this.hooks.onSay(r, t);
    robot.onWarn = (r, t) => this.hooks.onWarn && this.hooks.onWarn(r, t);
    for (const g of Object.values(robot.grippers)) {
      const prev = g.onChange;
      g.onChange = (what, thing) => { prev && prev(what, thing); this.hooks.onGrip && this.hooks.onGrip(robot, what, thing); };
    }
    const slot = { def, robot, runtime: null };
    this.slots.push(slot);
    return slot;
  }

  slotOf(defId) { return this.slots.find((s) => s.def.id === defId); }

  // Programme prüfen; liefert Fehlerliste [{ def, err }]
  check(docs) {
    const out = [];
    for (const s of this.slots) {
      const doc = docs(s.def);
      if (!doc) continue;
      if (doc.error) { out.push({ def: s.def, err: doc.error, kind: 'syntax' }); continue; }
      for (const err of checkProgram(doc.ast, s.robot.type, s.robot.jointNames())) out.push({ def: s.def, err, kind: 'check' });
    }
    return out;
  }

  start(docs) {
    this.stop(true);
    this.running = true;
    this.startTime = this.sim.time;
    this.finished = false;
    for (const s of this.slots) {
      const doc = docs(s.def);
      s.robot.resetRuntime();
      if (!doc || !doc.ast) continue;
      // Der Baum des Editors wird direkt ausgeführt – so passen Knoten-IDs (Bausteine) und Zeilen (Text)
      const ast = doc.error ? null : doc.ast;
      if (!ast) continue;
      s.ast = ast;
      s.doc = doc;
      const host = new RobotHost(s.robot, {
        sim: this.sim,
        audio: this.hooks.audio,
        broadcast: (msg) => this.broadcast(msg),
        log: (robot, text, kind) => this.hooks.onLog && this.hooks.onLog(robot, text, kind),
        onCommand: (robot, id, args) => this.hooks.onCommand && this.hooks.onCommand(robot, id, args),
      });
      s.runtime = new Runtime(ast, host, {
        seed: 1234 + this.slots.indexOf(s),
        onError: (err) => { this.hooks.onError && this.hooks.onError(s, err); this.stopAll('error'); },
        onFinish: () => this.checkFinished(),
        onStop: (reason) => { this.hooks.onLog && this.hooks.onLog(s.robot, reason, 'sys'); this.stopAll('silent'); this.finished = true; this.hooks.onFinish && this.hooks.onFinish(); },
      });
    }
    for (const s of this.slots) if (s.runtime) s.runtime.start();
  }

  checkFinished() {
    if (!this.running) return;
    if (this.slots.every((s) => !s.runtime || !s.runtime.running)) {
      this.running = false;
      this.finished = true;
      this.hooks.onFinish && this.hooks.onFinish();
    }
  }

  stopAll(reason) {
    for (const s of this.slots) if (s.runtime) s.runtime.stop();
    const was = this.running;
    this.running = false;
    if (was && reason !== 'silent') this.hooks.onStop && this.hooks.onStop(reason);
  }

  stop(silent) {
    for (const s of this.slots) if (s.runtime) { s.runtime.stop(); s.runtime = null; }
    this.running = false;
    if (!silent) for (const s of this.slots) s.robot.stopMotion();
  }

  // Einen einzelnen Stapel ausprobieren (Antippen im Baustein-Editor)
  tryStack(def, doc, item) {
    const s = this.slotOf(def.id);
    if (!s || !doc.ast) return null;
    if (!s.runtime || !s.runtime.running) {
      const host = new RobotHost(s.robot, { sim: this.sim, audio: this.hooks.audio, broadcast: (m) => this.broadcast(m), log: (r, t, k) => this.hooks.onLog && this.hooks.onLog(r, t, k) });
      s.runtime = new Runtime(doc.ast, host, { onError: (err) => { this.hooks.onError && this.hooks.onError(s, err); s.runtime && s.runtime.stop(); }, onFinish: () => {} });
      s.runtime.running = true;
      s.ast = doc.ast;
    }
    return s.runtime.runStack(item);
  }

  broadcast(msg) {
    const threads = [];
    for (const s of this.slots) if (s.runtime) threads.push(...s.runtime.receive(msg));
    this.hooks.onLog && this.hooks.onLog(null, `Nachricht „${msg}“ gesendet`, 'sys');
    return threads;
  }

  keyDown(k) { for (const s of this.slots) if (s.runtime) s.runtime.keyDown(k); }
  keyUp(k) { for (const s of this.slots) if (s.runtime) s.runtime.keyUp(k); }
  tap(robot) { const s = this.slots.find((x) => x.robot === robot); if (s && s.runtime) s.runtime.tapped(); }

  tick(dt) {
    for (const s of this.slots) if (s.runtime && s.runtime.running) s.runtime.tick(dt);
  }

  get elapsed() { return this.sim.time - this.startTime; }
}

export { createObject };
