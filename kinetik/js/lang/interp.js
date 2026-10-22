// Klartext · Interpreter
// Jeder Ablauf (Ereignis, „gleichzeitig“-Zweig) ist ein Generator. Der Planer setzt ihn
// in jedem Physikschritt fort, sobald seine Wartebedingung erfüllt ist. Endlosschleifen
// geben nach einer festen Zahl von Schritten freiwillig ab – so friert nichts ein.

import { KlartextError } from './lexer.js';
import { UNITS, COLORS, CONSTANTS, BUILTINS, CMD_BY_ID, REP_BY_ID } from './commands.js';
import { fmtNum, closest, rng as makeRng } from '../core/util.js';

export class RuntimeError extends KlartextError {}

const TICK = { t: 'tick' };
const OPS_PER_TICK = 400;
const MAX_DEPTH = 200;

class ReturnSignal { constructor(v) { this.v = v; } }
class EndThread {}

export function show(v) {
  if (v === null || v === undefined) return 'nichts';
  if (v === true) return 'wahr';
  if (v === false) return 'falsch';
  if (typeof v === 'number') return fmtNum(v);
  if (Array.isArray(v)) return '[' + v.map((x) => (typeof x === 'string' ? '"' + x + '"' : show(x))).join(', ') + ']';
  return String(v);
}

const typeName = (v) => (v === null || v === undefined ? 'nichts' : Array.isArray(v) ? 'eine Liste' : typeof v === 'number' ? 'eine Zahl' : typeof v === 'string' ? 'ein Text' : typeof v === 'boolean' ? 'ein Wahrheitswert' : 'etwas Unbekanntes');

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function equal(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a.trim().toLowerCase() === b.trim().toLowerCase();
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '' && !isNaN(+b)) return Math.abs(a - +b) < 1e-9;
  if (typeof b === 'number' && typeof a === 'string' && a.trim() !== '' && !isNaN(+a)) return Math.abs(b - +a) < 1e-9;
  return a === b;
}

class Scope {
  constructor(parent = null) { this.vars = new Map(); this.parent = parent; }
  find(name) { for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s; return null; }
}

export class Runtime {
  /**
   * @param program Syntaxbaum
   * @param host    Verbindung zum Roboter: command(id,args,ctx) · reporter(id,args) · broadcast(msg) · stopMotion() · say(text)
   */
  constructor(program, host, opts = {}) {
    this.program = program;
    this.host = host;
    this.opts = opts;
    this.time = 0;
    this.tickCount = 0;
    this.threads = [];
    this.globals = new Scope();
    this.funcs = new Map();
    this.running = false;
    this.error = null;
    this.keys = new Set();
    this.sobaldState = new Map();
    this.rand = makeRng(opts.seed || 12345);
    this.threadSeq = 0;
    for (const it of program.items) if (it.type === 'func') this.funcs.set(it.name, it);
  }

  /* ---------------- Lebenszyklus ---------------- */

  start() {
    this.running = true;
    this.error = null;
    const mains = this.program.items.filter((i) => i.type === 'main' && i.body.length);
    if (mains.length) {
      const self = this;
      this.spawn(mains[0], function* (th) { for (const m of mains) { th.item = m; yield* self.block(m.body, th, self.globals); } });
    }
    for (const it of this.program.items) {
      if (it.type === 'event' && it.ev === 'start') this.spawnItem(it);
      if (it.type === 'event' && it.ev === 'sobald') this.sobaldState.set(it.id, false);
    }
  }

  // Einen einzelnen Stapel sofort ausführen (Antippen eines Bausteins)
  runStack(item) {
    this.running = true;
    this.error = null;
    if (item.type === 'func') return null;
    return this.spawnItem(item);
  }

  stop(reason) {
    for (const th of this.threads) this.cancelThread(th);
    this.threads = [];
    if (this.running && this.host.stopMotion) this.host.stopMotion();
    this.running = false;
    if (reason && this.opts.onStop) this.opts.onStop(reason);
  }

  cancelThread(th) {
    if (th.done) return;
    th.done = true;
    if (th.wait && th.wait.t === 'action' && th.wait.action.cancel) th.wait.action.cancel();
    if (th.children) for (const c of th.children) this.cancelThread(c);
    try { th.gen.return(); } catch { /* egal */ }
  }

  spawnItem(it) {
    const self = this;
    return this.spawn(it, function* (th) { yield* self.block(it.body, th, self.globals); });
  }

  spawn(item, genFn, parent = null) {
    const th = { id: ++this.threadSeq, item, node: null, wait: null, done: false, ops: 0, depth: 0, parent };
    th.gen = genFn(th);
    this.threads.push(th);
    return th;
  }

  hasLive(item) { return this.threads.some((t) => !t.done && t.item === item && !t.parent); }

  /* ---------------- Ereignisse von außen ---------------- */

  keyDown(key) {
    key = String(key).toLowerCase();
    this.keys.add(key);
    if (!this.running) return;
    for (const it of this.program.items) {
      if (it.type === 'event' && it.ev === 'taste' && it.arg === key && !this.hasLive(it)) this.spawnItem(it);
    }
  }
  keyUp(key) { this.keys.delete(String(key).toLowerCase()); }

  receive(msg) {
    const out = [];
    if (!this.running) return out;
    for (const it of this.program.items) {
      if (it.type === 'event' && it.ev === 'nachricht' && equal(it.arg, msg)) {
        if (!this.hasLive(it)) out.push(this.spawnItem(it));
      }
    }
    return out;
  }

  tapped() {
    if (!this.running) return;
    for (const it of this.program.items) if (it.type === 'event' && it.ev === 'antippen' && !this.hasLive(it)) this.spawnItem(it);
  }

  /* ---------------- Planer ---------------- */

  tick(dt) {
    if (!this.running) return;
    this.time += dt;
    this.tickCount++;
    try {
      for (const it of this.program.items) {
        if (it.type === 'event' && it.ev === 'sobald') {
          const fake = { node: it, ops: 0, depth: 0, item: it };
          const v = truthy(this.evalSync(it.arg, fake, this.globals));
          const prev = this.sobaldState.get(it.id);
          this.sobaldState.set(it.id, v);
          if (v && !prev && !this.hasLive(it)) this.spawnItem(it);
        }
      }
    } catch (e) { this.fail(e, { node: null }); return; }
    const list = this.threads.slice();
    for (const th of list) {
      if (th.done || !this.running) continue;
      this.resume(th);
    }
    this.threads = this.threads.filter((t) => !t.done);
    if (this.running && this.threads.length === 0 && !this.hasListeners()) {
      this.running = false;
      if (this.opts.onFinish) this.opts.onFinish();
    }
  }

  hasListeners() {
    return this.program.items.some((it) => it.type === 'event' && it.ev !== 'start');
  }

  ready(th) {
    const w = th.wait;
    if (!w) return true;
    switch (w.t) {
      case 'tick': return w.n !== this.tickCount;
      case 'time': return this.time >= w.until - 1e-9;
      case 'action': return w.action.done();
      case 'join': return w.threads.every((t) => t.done);
      case 'cond': return truthy(this.evalSync(w.expr, th, w.scope));
      default: return true;
    }
  }

  resume(th) {
    th.ops = 0;
    try {
      let guard = 0;
      while (!th.done && this.ready(th)) {
        if (th.wait && th.wait.t === 'action' && th.wait.action.error) {
          const err = th.wait.action.error;
          th.wait = null;
          throw new RuntimeError(err, th.node ? th.node.line : 0);
        }
        th.wait = null;
        const r = th.gen.next();
        if (r.done) { th.done = true; break; }
        const w = r.value;
        if (w === TICK) th.wait = { t: 'tick', n: this.tickCount };
        else th.wait = w;
        if (++guard > 10000) { th.wait = { t: 'tick', n: this.tickCount }; break; }
      }
    } catch (e) {
      if (e instanceof EndThread) { th.done = true; return; }
      this.fail(e, th);
    }
  }

  fail(e, th) {
    let err = e;
    if (!(e instanceof KlartextError)) {
      err = new RuntimeError(e && e.message ? e.message : String(e), th && th.node ? th.node.line : 0);
      if (!(e && e.friendly)) console.error(e);
    }
    if (!err.line && th && th.node) err.line = th.node.line;
    if (th && th.node && !err.nodeId) err.nodeId = th.node.id;
    this.error = err;
    this.stop();
    if (this.opts.onError) this.opts.onError(err);
  }

  activeNodes() {
    const set = new Set();
    for (const th of this.threads) {
      if (th.done) continue;
      if (th.node) set.add(th.node.id);
      if (th.item) set.add(th.item.id);
    }
    return set;
  }

  /* ---------------- Ausführen ---------------- */

  *block(list, th, scope) {
    for (const s of list) yield* this.stmt(s, th, scope);
  }

  *budget(th) {
    if (++th.ops > OPS_PER_TICK) { th.ops = 0; yield TICK; }
  }

  err(msg, node) { return new RuntimeError(msg, node ? node.line : 0, 0, { nodeId: node && node.id }); }

  *stmt(s, th, scope) {
    if (s.type === 'comment') return;
    th.node = s;
    th.ops++;
    switch (s.type) {
      case 'cmd': yield* this.command(s, th, scope); break;
      case 'set': {
        const v = yield* this.eval(s.expr, th, scope);
        if (s.index) {
          const sc = scope.find(s.name);
          const list = sc ? sc.vars.get(s.name) : undefined;
          if (!Array.isArray(list)) throw this.err(`„${s.name}“ ist keine Liste – „${s.name}[…] = …“ geht nur mit Listen.`, s);
          const i = yield* this.eval(s.index, th, scope);
          this.checkIndex(list, i, s, true);
          list[Math.round(i) - 1] = v;
        } else {
          this.assign(s.name, v, scope);
        }
        break;
      }
      case 'change': {
        const sc = scope.find(s.name);
        if (!sc) throw this.err(`Die Variable „${s.name}“ hat noch keinen Wert. Setze sie zuerst, z. B. „setze ${s.name} auf 0“.`, s);
        const cur = sc.vars.get(s.name);
        const d = yield* this.eval(s.expr, th, scope);
        sc.vars.set(s.name, this.arith('+', cur, d, s));
        break;
      }
      case 'if': {
        for (const b of s.branches) {
          th.node = s;
          if (truthy(yield* this.eval(b.cond, th, scope))) { yield* this.block(b.body, th, scope); return; }
        }
        if (s.els) yield* this.block(s.els, th, scope);
        break;
      }
      case 'while':
        for (;;) {
          th.node = s;
          if (!truthy(yield* this.eval(s.cond, th, scope))) break;
          yield* this.block(s.body, th, scope);
          yield* this.loopYield(th);
        }
        break;
      case 'until':
        for (;;) {
          th.node = s;
          if (truthy(yield* this.eval(s.cond, th, scope))) break;
          yield* this.block(s.body, th, scope);
          yield* this.loopYield(th);
        }
        break;
      case 'repeat': {
        const n = this.num(yield* this.eval(s.count, th, scope), s, 'Die Anzahl der Wiederholungen');
        for (let i = 0; i < Math.round(n); i++) {
          yield* this.block(s.body, th, scope);
          yield* this.loopYield(th);
        }
        break;
      }
      case 'forever':
        for (;;) {
          yield* this.block(s.body, th, scope);
          yield* this.loopYield(th);
        }
      case 'for': {
        const from = this.num(yield* this.eval(s.from, th, scope), s, 'Der Startwert');
        const to = this.num(yield* this.eval(s.to, th, scope), s, 'Der Endwert');
        let step = s.step ? this.num(yield* this.eval(s.step, th, scope), s, 'Die Schrittweite') : (to >= from ? 1 : -1);
        if (step === 0) throw this.err('Die Schrittweite darf nicht 0 sein – sonst käme die Schleife nie an.', s);
        for (let i = from; step > 0 ? i <= to + 1e-9 : i >= to - 1e-9; i += step) {
          this.assign(s.var, i, scope);
          yield* this.block(s.body, th, scope);
          yield* this.loopYield(th);
        }
        break;
      }
      case 'foreach': {
        const list = yield* this.eval(s.list, th, scope);
        if (!Array.isArray(list) && typeof list !== 'string') throw this.err(`„für jedes“ braucht eine Liste, aber hier ist ${typeName(list)}.`, s);
        for (const x of Array.from(list)) {
          this.assign(s.var, x, scope);
          yield* this.block(s.body, th, scope);
          yield* this.loopYield(th);
        }
        break;
      }
      case 'parallel': {
        const self = this;
        const kids = s.body.filter((x) => x.type !== 'comment').map((child) => this.spawn(th.item, function* (k) { k.depth = th.depth; yield* self.stmt(child, k, scope); }, th));
        th.children = kids;
        yield { t: 'join', threads: kids };
        th.children = null;
        th.node = s;
        break;
      }
      case 'return': {
        if (!th.depth) throw this.err('„gib … zurück“ geht nur innerhalb einer Funktion.', s);
        const v = s.expr ? yield* this.eval(s.expr, th, scope) : null;
        throw new ReturnSignal(v);
      }
      case 'callstmt': yield* this.callFunc(s.name, s.args, th, scope, s); break;
      default: throw this.err('Diese Anweisung kenne ich nicht.', s);
    }
  }

  *loopYield(th) {
    if (th.ops > OPS_PER_TICK) { th.ops = 0; yield TICK; }
  }

  assign(name, v, scope) {
    const sc = scope.find(name) || scope;
    sc.vars.set(name, v);
    if (this.opts.onVar && sc === this.globals) this.opts.onVar(name, v);
  }

  variables() {
    const out = [];
    for (const [k, v] of this.globals.vars) out.push([k, v]);
    return out;
  }

  *command(s, th, scope) {
    const def = CMD_BY_ID[s.cmd];
    const args = {};
    for (const sl of def.slots) {
      const a = s.args[sl.slot];
      if (typeof a === 'string' || a == null) args[sl.slot] = a;
      else args[sl.slot] = yield* this.eval(a, th, scope);
    }
    switch (s.cmd) {
      case 'warte': {
        const t = this.num(args.zeit, s, 'Die Wartezeit');
        if (t < 0) throw this.err('Eine negative Wartezeit gibt es nicht.', s);
        yield { t: 'time', until: this.time + t };
        return;
      }
      case 'warte_bis':
        yield { t: 'cond', expr: s.args.bedingung, scope };
        return;
      case 'stoppe_alles':
        this.stop('Programm mit „stoppe alles“ beendet.');
        throw new EndThread();
      case 'beende': throw new EndThread();
      case 'sende':
        if (this.host.broadcast) this.host.broadcast(show(args.nachricht));
        return;
      case 'sende_warte': {
        const ts = this.host.broadcast ? this.host.broadcast(show(args.nachricht)) : [];
        yield TICK;
        yield { t: 'join', threads: ts };
        return;
      }
      case 'liste_add': {
        const sc = scope.find(args.liste);
        if (!sc) { this.assign(args.liste, [args.wert], scope); return; }
        const list = sc.vars.get(args.liste);
        if (!Array.isArray(list)) throw this.err(`„${args.liste}“ ist keine Liste, sondern ${typeName(list)}.`, s);
        list.push(args.wert);
        return;
      }
      case 'liste_del': {
        const sc = scope.find(args.liste);
        const list = sc ? sc.vars.get(args.liste) : undefined;
        if (!Array.isArray(list)) throw this.err(`„${args.liste}“ ist keine Liste.`, s);
        this.checkIndex(list, args.index, s);
        list.splice(Math.round(args.index) - 1, 1);
        return;
      }
      default: break;
    }
    let res;
    try {
      res = this.host.command(s.cmd, args, { thread: th, node: s, runtime: this });
    } catch (e) {
      if (e && e.friendly) throw this.err(e.message, s);
      throw e;
    }
    if (res && typeof res.done === 'function') {
      yield { t: 'action', action: res };
      th.node = s;
    }
  }

  checkIndex(list, i, node, allowEnd = false) {
    if (typeof i !== 'number' || !isFinite(i)) throw this.err(`Die Nummer eines Elements muss eine Zahl sein, nicht ${typeName(i)}.`, node);
    const k = Math.round(i);
    const max = list.length + (allowEnd ? 1 : 0);
    if (k < 1 || k > max) {
      throw this.err(list.length ? `Die Liste hat ${list.length} Element${list.length === 1 ? '' : 'e'} – Nummer ${k} gibt es nicht (gezählt wird ab 1).` : 'Die Liste ist leer.', node);
    }
  }

  num(v, node, what = 'Der Wert') {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) return +v;
    throw this.err(`${what} muss eine Zahl sein, aber hier ist ${typeName(v)}${typeof v === 'string' ? ` („${v}“)` : ''}.`, node);
  }

  arith(op, a, b, node) {
    if (op === '+') {
      if (typeof a === 'string' || typeof b === 'string') return show(a) + show(b);
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    }
    const sym = { '+': 'addieren', '-': 'subtrahieren', '*': 'multiplizieren', '/': 'teilen', '%': 'den Rest berechnen', '^': 'potenzieren' }[op];
    if (typeof a !== 'number' || typeof b !== 'number') {
      const bad = typeof a !== 'number' ? a : b;
      throw this.err(`Ich kann nicht ${sym}: ${show(bad)} ist ${typeName(bad)}, keine Zahl.`, node);
    }
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': if (b === 0) throw this.err('Durch 0 kann man nicht teilen.', node); return a / b;
      case '%': if (b === 0) throw this.err('Rest bei Teilung durch 0 gibt es nicht.', node); return ((a % b) + b) % b;
      case '^': return Math.pow(a, b);
      default: return 0;
    }
  }

  evalSync(e, th, scope) {
    const g = this.eval(e, th, scope);
    const r = g.next();
    if (!r.done) throw this.err('In einer Bedingung kann nicht gewartet werden (z. B. keine Funktion mit „warte“ darin).', th.node);
    return r.value;
  }

  *eval(e, th, scope) {
    switch (e.type) {
      case 'num': return e.unit && UNITS[e.unit] ? e.v * UNITS[e.unit].f : e.v;
      case 'str': return e.v;
      case 'const': return CONSTANTS[e.v];
      case 'color': return e.v;
      case 'hole': throw this.err('In diesem Baustein ist noch eine Lücke leer.', th.node);
      case 'var': {
        const sc = scope.find(e.name);
        if (!sc) {
          const all = []; for (let s = scope; s; s = s.parent) all.push(...s.vars.keys());
          const guess = closest(e.name, all);
          throw this.err(`Die Variable „${e.name}“ hat noch keinen Wert.${guess ? ` Meintest du „${guess}“?` : ` Setze sie zuerst, z. B. „setze ${e.name} auf 0“.`}`, th.node);
        }
        return sc.vars.get(e.name);
      }
      case 'list': {
        const out = [];
        for (const x of e.items) out.push(yield* this.eval(x, th, scope));
        return out;
      }
      case 'index': {
        const a = yield* this.eval(e.a, th, scope);
        const i = yield* this.eval(e.i, th, scope);
        if (typeof a === 'string') { this.checkIndex(a.split(''), i, th.node); return a[Math.round(i) - 1]; }
        if (!Array.isArray(a)) throw this.err(`Nur Listen und Texte haben Elemente mit Nummern – hier ist ${typeName(a)}.`, th.node);
        this.checkIndex(a, i, th.node);
        return a[Math.round(i) - 1];
      }
      case 'un': {
        const a = yield* this.eval(e.a, th, scope);
        if (e.op === 'nicht') return !truthy(a);
        return -this.num(a, th.node);
      }
      case 'bin': {
        if (e.op === 'und') { const a = yield* this.eval(e.a, th, scope); return truthy(a) ? truthy(yield* this.eval(e.b, th, scope)) : false; }
        if (e.op === 'oder') { const a = yield* this.eval(e.a, th, scope); return truthy(a) ? true : truthy(yield* this.eval(e.b, th, scope)); }
        const a = yield* this.eval(e.a, th, scope);
        const b = yield* this.eval(e.b, th, scope);
        switch (e.op) {
          case '=': case '==': return equal(a, b);
          case '!=': return !equal(a, b);
          case '<': case '>': case '<=': case '>=': {
            let x = a, y = b;
            if (typeof x === 'string' && typeof y === 'string') { x = x.toLowerCase(); y = y.toLowerCase(); }
            else { x = this.num(a, th.node, 'Beim Vergleichen'); y = this.num(b, th.node, 'Beim Vergleichen'); }
            return e.op === '<' ? x < y : e.op === '>' ? x > y : e.op === '<=' ? x <= y : x >= y;
          }
          default: return this.arith(e.op, a, b, th.node);
        }
      }
      case 'rep': {
        const def = REP_BY_ID[e.rep];
        const args = {};
        for (const sl of def.slots) {
          const a = e.args[sl.slot];
          args[sl.slot] = typeof a === 'string' || a == null ? a : yield* this.eval(a, th, scope);
        }
        if (e.rep === 'r_zeit') return Math.round(this.time * 100) / 100;
        if (e.rep === 'r_taste') return this.keys.has(String(args.taste).toLowerCase());
        if (e.rep === 'r_zufall') return this.randInt(this.num(args.von, th.node), this.num(args.bis, th.node));
        try {
          return this.host.reporter(e.rep, args, { thread: th, runtime: this });
        } catch (err) {
          if (err && err.friendly) throw this.err(err.message, th.node);
          throw err;
        }
      }
      case 'call': {
        if (BUILTINS[e.name] && !this.funcs.has(e.name)) {
          const vals = [];
          for (const a of e.args) vals.push(yield* this.eval(a, th, scope));
          return this.builtin(e.name, vals, th.node);
        }
        return yield* this.callFunc(e.name, e.args, th, scope, th.node);
      }
      default: throw this.err('Diesen Ausdruck verstehe ich nicht.', th.node);
    }
  }

  randInt(a, b) {
    const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b));
    return lo + Math.floor(this.rand() * (hi - lo + 1));
  }

  builtin(name, v, node) {
    const def = BUILTINS[name];
    if (v.length !== def.n) throw this.err(`„${name}“ braucht ${def.n} Wert${def.n === 1 ? '' : 'e'} in Klammern, z. B. „${name}(${def.n === 1 ? 'x' : 'a, b'})“.`, node);
    const n = (x) => this.num(x, node, `Für „${name}“ der Wert`);
    switch (name) {
      case 'runde': return Math.round(n(v[0]));
      case 'abs': return Math.abs(n(v[0]));
      case 'wurzel': { const x = n(v[0]); if (x < 0) throw this.err('Aus einer negativen Zahl kann man keine Wurzel ziehen.', node); return Math.sqrt(x); }
      case 'sin': return Math.sin(n(v[0]) * Math.PI / 180);
      case 'cos': return Math.cos(n(v[0]) * Math.PI / 180);
      case 'min': return Math.min(n(v[0]), n(v[1]));
      case 'max': return Math.max(n(v[0]), n(v[1]));
      case 'zufall': return this.randInt(n(v[0]), n(v[1]));
      case 'länge': if (Array.isArray(v[0]) || typeof v[0] === 'string') return v[0].length; throw this.err(`„länge“ geht nur mit Listen und Texten, nicht mit ${typeName(v[0])}.`, node);
      case 'text': return show(v[0]);
      case 'zahl': { const x = parseFloat(String(v[0]).replace(',', '.')); if (isNaN(x)) throw this.err(`„${show(v[0])}“ ist keine Zahl.`, node); return x; }
      default: return null;
    }
  }

  *callFunc(name, argExprs, th, scope, node) {
    const f = this.funcs.get(name);
    if (!f) {
      const guess = closest(name, [...this.funcs.keys(), ...Object.keys(BUILTINS)]);
      throw this.err(`Eine Funktion „${name}“ gibt es nicht.${guess ? ` Meintest du „${guess}“?` : ''}`, node);
    }
    if (argExprs.length !== f.params.length) {
      throw this.err(`„${name}“ erwartet ${f.params.length} Wert${f.params.length === 1 ? '' : 'e'}, bekommt aber ${argExprs.length}.`, node);
    }
    const local = new Scope(this.globals);
    for (let i = 0; i < f.params.length; i++) local.vars.set(f.params[i], yield* this.eval(argExprs[i], th, scope));
    if (th.depth >= MAX_DEPTH) throw this.err('Zu viele verschachtelte Funktionsaufrufe – ruft sich eine Funktion endlos selbst auf?', node);
    th.depth++;
    const saved = th.node;
    try {
      yield* this.block(f.body, th, local);
      return null;
    } catch (sig) {
      if (sig instanceof ReturnSignal) return sig.v;
      throw sig;
    } finally {
      th.depth--;
      th.node = saved;
    }
  }
}

/* ---------------- Prüfen vor dem Start ---------------- */

const ROBOT_NAMES = { arm: 'Ein Roboterarm', humanoid: 'Ein Humanoid', rover: 'Ein Fahrroboter' };
const ALT_HINT = {
  gehe_vor: 'fahre … vor', gehe_zurueck: 'fahre … zurück', gehe_zu: 'fahre zu …', gehe_los: 'fahre los',
  fahre_vor: 'gehe … vor', fahre_zurueck: 'gehe … zurück', fahre_zu: 'gehe zu …', fahre_los: 'gehe los',
};

export function checkProgram(program, robotType, jointNames = []) {
  const errors = [];
  const funcs = new Map(program.items.filter((i) => i.type === 'func').map((f) => [f.name, f]));
  const add = (msg, node) => errors.push(new KlartextError(msg, node ? node.line : 0, 0, { nodeId: node && node.id }));
  const joints = new Set(jointNames);
  let inFunc = false;

  const expr = (e, node) => {
    if (!e || typeof e !== 'object') return;
    switch (e.type) {
      case 'bin': expr(e.a, node); expr(e.b, node); break;
      case 'un': expr(e.a, node); break;
      case 'list': e.items.forEach((x) => expr(x, node)); break;
      case 'index': expr(e.a, node); expr(e.i, node); break;
      case 'hole': add('In einem Baustein ist noch eine Lücke leer.', node); break;
      case 'call':
        e.args.forEach((x) => expr(x, node));
        if (funcs.has(e.name)) { if (funcs.get(e.name).params.length !== e.args.length) add(`„${e.name}“ erwartet ${funcs.get(e.name).params.length} Werte.`, node); }
        else if (!BUILTINS[e.name]) add(`Eine Funktion „${e.name}“ gibt es nicht.`, node);
        break;
      case 'rep': {
        const def = REP_BY_ID[e.rep];
        if (robotType && def.robots && !def.robots.includes(robotType)) add(`${ROBOT_NAMES[robotType]} hat keinen Sensor für „${def.p.replace(/\{\w+:\w+\}/g, '…')}“.`, node);
        for (const sl of def.slots) {
          const a = e.args[sl.slot];
          if (sl.type === 'joint' && joints.size && !joints.has(a)) add(`Ein Gelenk „${a}“ hat dieser Roboter nicht. Es gibt: ${[...joints].join(', ')}.`, node);
          expr(a, node);
        }
        break;
      }
      default: break;
    }
  };
  const stmts = (list) => list.forEach(stmt);
  const stmt = (s) => {
    switch (s.type) {
      case 'cmd': {
        const def = CMD_BY_ID[s.cmd];
        if (robotType && def.robots && !def.robots.includes(robotType)) {
          const alt = ALT_HINT[s.cmd];
          add(`${ROBOT_NAMES[robotType]} kann „${def.p.replace(/\{\w+:\w+\}/g, '…')}“ nicht.${alt ? ` Versuch es mit „${alt}“.` : ''}`, s);
        }
        for (const sl of def.slots) {
          const a = s.args[sl.slot];
          if (sl.type === 'joint' && joints.size && !joints.has(a)) add(`Ein Gelenk „${a}“ hat dieser Roboter nicht. Es gibt: ${[...joints].join(', ')}.`, s);
          if (a == null && sl.type !== 'var') add('In diesem Baustein ist noch eine Lücke leer.', s);
          expr(a, s);
        }
        break;
      }
      case 'set': case 'change': expr(s.expr, s); if (s.index) expr(s.index, s); break;
      case 'return': if (!inFunc) add('„gib … zurück“ geht nur innerhalb einer Funktion.', s); expr(s.expr, s); break;
      case 'callstmt':
        s.args.forEach((x) => expr(x, s));
        if (!funcs.has(s.name)) add(`Eine Funktion „${s.name}“ gibt es nicht.`, s);
        else if (funcs.get(s.name).params.length !== s.args.length) add(`„${s.name}“ erwartet ${funcs.get(s.name).params.length} Werte, bekommt aber ${s.args.length}.`, s);
        break;
      case 'if': s.branches.forEach((b) => { expr(b.cond, s); stmts(b.body); }); if (s.els) stmts(s.els); break;
      case 'while': case 'until': expr(s.cond, s); stmts(s.body); break;
      case 'repeat': expr(s.count, s); stmts(s.body); break;
      case 'forever': case 'parallel': stmts(s.body); break;
      case 'for': expr(s.from, s); expr(s.to, s); expr(s.step, s); stmts(s.body); break;
      case 'foreach': expr(s.list, s); stmts(s.body); break;
      default: break;
    }
  };
  for (const it of program.items) {
    if (it.type === 'ablage') continue;
    inFunc = it.type === 'func';
    if (it.type === 'event' && it.ev === 'sobald') expr(it.arg, it);
    stmts(it.body);
  }
  return errors;
}

export { COLORS };
