// Szenario: baut eine Anlage aus einer Projektbeschreibung und lässt die Abläufe laufen.
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
    this.pending = [];
    this.proxies = [];
    sim.hooks.unshift((dt) => this.tick(dt));
  }

  build(project) {
    this.stop(true);
    this.sim.clear();
    this.sim.runStart = null;
    this.sim.setEnv(project.env || {});
    resetNames();
    this.project = project;
    (project.objects || []).forEach((o, i) => {
      try { createObject(this.sim, o).specIndex = i; } catch (e) { console.warn(e); }
    });
    this.slots = [];
    for (const def of project.robots || []) this.addRobot(def);
    this.sim.path = project.path ? project.path.slice() : null;
    if (project.onBuild) project.onBuild(this.sim, this);
    this.builtAt = this.sim.stepCount;
    return this;
  }

  addRobot(def) {
    const robot = createRobot(this.sim, def.config, def.spawn || {});
    robot.defId = def.id;
    robot.onSay = (r, t) => this.hooks.onSay && this.hooks.onSay(r, t);
    robot.onWarn = (r, t) => this.hooks.onWarn && this.hooks.onWarn(r, t);
    robot.onLog = (r, t, k) => this.hooks.onLog && this.hooks.onLog(r, t, k);
    robot.onSafetyHalt = (on) => this.hooks.onSafety && this.hooks.onSafety(robot, on);
    for (const g of Object.values(robot.grippers)) {
      const prev = g.onChange;
      g.onChange = (what, thing) => { prev && prev(what, thing); this.hooks.onGrip && this.hooks.onGrip(robot, what, thing); };
    }
    const slot = { def, robot, runtime: null };
    this.slots.push(slot);
    return slot;
  }

  slotOf(defId) { return this.slots.find((s) => s.def.id === defId); }

  // Abläufe prüfen; liefert Fehlerliste [{ def, err }]
  check(docs) {
    const out = [];
    for (const s of this.slots) {
      const doc = docs(s.def);
      if (!doc) continue;
      if (doc.error) { out.push({ def: s.def, err: doc.error, kind: 'syntax' }); continue; }
      for (const err of checkProgram(doc.ast, s.robot.type, s.robot.jointNames(), s.robot.caps())) out.push({ def: s.def, err, kind: 'check' });
    }
    return out;
  }

  start(docs) {
    this.stop(true);
    this.running = true;
    this.startTime = this.sim.time;
    this.sim.runStart = this.sim.time;
    this.finished = false;
    this.pending = [];
    this.proxies = [];
    for (const s of this.slots) {
      const doc = docs(s.def);
      s.robot.resetRuntime();
      if (!doc || !doc.ast) continue;
      // Der Baum des Editors wird direkt ausgeführt – so passen Knoten-IDs (Bausteine) und Zeilen (Text)
      const ast = doc.error ? null : doc.ast;
      if (!ast) continue;
      s.ast = ast;
      s.doc = doc;
      s.runtime = new Runtime(ast, this.hostFor(s.robot), {
        seed: 1234 + this.slots.indexOf(s),
        onError: (err) => { this.hooks.onError && this.hooks.onError(s, err); this.stopAll('error'); },
        onFinish: () => this.checkFinished(),
        onStop: (reason) => { this.hooks.onLog && this.hooks.onLog(s.robot, reason, 'sys'); this.stopAll('silent'); this.finished = true; this.hooks.onFinish && this.hooks.onFinish(); },
      });
    }
    for (const s of this.slots) if (s.runtime) s.runtime.start();
  }

  hostFor(robot) {
    return new RobotHost(robot, {
      sim: this.sim,
      audio: this.hooks.audio,
      broadcast: (msg, from) => this.broadcast(msg, from),
      log: (r, text, kind) => this.hooks.onLog && this.hooks.onLog(r, text, kind),
      onCommand: (r, id, args) => this.hooks.onCommand && this.hooks.onCommand(r, id, args),
    });
  }

  checkFinished() {
    if (!this.running) return;
    if (this.pending.length) return;
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
    this.pending = [];
    this.proxies = [];
    if (!silent) for (const s of this.slots) s.robot.stopMotion();
  }

  // Einen einzelnen Stapel ausprobieren (Antippen im Baustein-Editor)
  tryStack(def, doc, item) {
    const s = this.slotOf(def.id);
    if (!s || !doc.ast) return null;
    if (!s.runtime || !s.runtime.running) {
      s.runtime = new Runtime(doc.ast, this.hostFor(s.robot), { onError: (err) => { this.hooks.onError && this.hooks.onError(s, err); s.runtime && s.runtime.stop(); }, onFinish: () => {} });
      s.runtime.running = true;
      s.ast = doc.ast;
    }
    return s.runtime.runStack(item);
  }

  /*
   * Nachricht senden. Der Sender selbst empfängt immer; andere Geräte nur, wenn die Funkstrecke
   * steht. Träge Funktechniken (LoRa) liefern verzögert – „sende … und warte“ wartet trotzdem korrekt.
   */
  broadcast(msg, from) {
    const threads = [];
    const log = (t, k) => this.hooks.onLog && this.hooks.onLog(from || null, t, k);
    let reached = 0, others = 0;
    for (const s of this.slots) {
      if (!s.runtime) continue;
      if (!from || s.robot === from) { threads.push(...s.runtime.receive(msg)); continue; }
      others++;
      const link = this.sim.radio.route(from, s.robot);
      if (!link.ok) {
        const why = link.reason === 'kein Funk' ? 'kein Funkmodul' : link.reason === 'inkompatibel' ? 'Funktechnik inkompatibel' : `Pegel ${link.rssi} dBm unter Empfindlichkeit`;
        log(`Funk: „${msg}“ erreicht ${s.robot.name} nicht (${why}).`, 'warn');
        continue;
      }
      reached++;
      if (link.latency > 0.03) {
        const proxy = { done: false, real: null };
        this.pending.push({ at: this.sim.time + link.latency, s, msg, proxy });
        this.proxies.push(proxy);
        threads.push(proxy);
      } else threads.push(...s.runtime.receive(msg));
    }
    log(`Nachricht „${msg}“ gesendet${others ? ` · ${reached}/${others} Empfänger` : ''}`, 'sys');
    return threads;
  }

  keyDown(k) { for (const s of this.slots) if (s.runtime) s.runtime.keyDown(k); }
  keyUp(k) { for (const s of this.slots) if (s.runtime) s.runtime.keyUp(k); }
  tap(robot) { const s = this.slots.find((x) => x.robot === robot); if (s && s.runtime) s.runtime.tapped(); }

  tick(dt) {
    // Erst nach dem ersten Physikschritt rechnen: vorher kennen Strahlabfragen die neuen Körper noch nicht
    if (this.sim.stepCount === this.builtAt) return;
    if (this.pending.length) {
      const now = this.sim.time;
      this.pending = this.pending.filter((p) => {
        if (now < p.at) return true;
        p.proxy.real = p.s.runtime ? p.s.runtime.receive(p.msg) : [];
        return false;
      });
    }
    if (this.proxies.length) {
      for (const p of this.proxies) if (p.real) p.done = p.real.every((t) => t.done);
      this.proxies = this.proxies.filter((p) => !p.done);
    }
    for (const s of this.slots) if (s.runtime && s.runtime.running) s.runtime.tick(dt);
  }

  get elapsed() { return this.sim.time - this.startTime; }
}

export { createObject };
