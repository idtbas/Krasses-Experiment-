// Klartext · Parser
// Liest Tokens und baut den Syntaxbaum, den Text- und Baustein-Editor gemeinsam nutzen.

import { lex, KlartextError } from './lexer.js';
import {
  CMD_HEADS, REP_HEADS, CMD, REP, KEYWORDS, UNITS, ENUMS, COLOR_NAMES, CONSTANTS, BUILTINS,
} from './commands.js';
import { closest } from '../core/util.js';

let idc = 0;
export const nid = () => 'k' + (++idc).toString(36);

const BLOCK_END = new Set(['ende', 'sonst']);
const EVENT_HEADS = new Set(['beim', 'bei', 'sobald']);

export function parse(src) {
  const p = new Parser(lex(src));
  return p.program();
}

// Einen einzelnen Ausdruck lesen (z. B. für Eingabefelder der Bausteine)
export function parseExpression(src) {
  const p = new Parser(lex(src));
  p.skipNl();
  const e = p.expr();
  p.skipNl();
  if (p.peek().t !== 'eof') p.fail(`Unerwartetes „${p.peek().raw ?? p.peek().v}“.`, p.peek());
  return e;
}

class Parser {
  constructor(toks) {
    this.toks = toks;
    this.i = 0;
    this.furthest = null;
  }

  peek(o = 0) { return this.toks[Math.min(this.i + o, this.toks.length - 1)]; }
  next() { return this.toks[this.i++]; }
  isWord(w, o = 0) { const t = this.peek(o); return t.t === 'id' && t.v === w; }
  isOp(op, o = 0) { const t = this.peek(o); return t.t === 'op' && t.v === op; }
  fail(msg, tok = this.peek(), extra) {
    throw new KlartextError(msg, tok.line, tok.col, extra);
  }
  expectWord(w) {
    if (!this.isWord(w)) this.fail(`Hier fehlt das Wort „${w}“${this.near()}.`);
    return this.next();
  }
  expectOp(op) {
    if (!this.isOp(op)) this.fail(`Hier fehlt „${op}“${this.near()}.`);
    return this.next();
  }
  near() {
    const t = this.peek();
    if (t.t === 'nl' || t.t === 'eof') return ' (die Zeile ist zu früh zu Ende)';
    return ` (statt „${t.raw ?? t.v}“)`;
  }
  skipNl() { let n = 0; while (this.peek().t === 'nl') { if (this.peek().v === '\n') n++; this.next(); } return n; }
  endOfStatement(node) {
    const t = this.peek();
    if (t.t === 'comment') { node.note = t.v; this.next(); }
    const e = this.peek();
    if (e.t !== 'nl' && e.t !== 'eof') this.fail(`Nach diesem Befehl ist noch etwas übrig: „${e.raw ?? e.v}“.`, e);
  }

  /* ---------------- Programm ---------------- */

  program() {
    const items = [];
    let notes = [];
    let main = null;
    let blank = false;
    for (;;) {
      const nl = this.skipNl();
      if (nl > 1) blank = true;
      const t = this.peek();
      if (t.t === 'eof') break;
      if (t.t === 'comment') { notes.push(t.v); this.next(); continue; }
      if (t.t === 'id' && (EVENT_HEADS.has(t.v) || t.v === 'funktion' || t.v === 'ablage')) {
        const item = t.v === 'funktion' ? this.func() : t.v === 'ablage' ? this.ablage() : this.event();
        if (notes.length) item.notes = notes;
        notes = [];
        items.push(item);
        main = null;
        blank = false;
        continue;
      }
      if (t.t === 'id' && t.v === 'ende') this.fail('Zu diesem „ende“ gehört kein Anfang (z. B. „wenn“ oder „beim start“).', t);
      if (t.t === 'id' && t.v === 'sonst') this.fail('„sonst“ steht hier ohne passendes „wenn“.', t);
      if (!main) { main = { type: 'main', id: nid(), line: t.line, body: [] }; items.push(main); blank = false; }
      for (const n of notes) main.body.push({ type: 'comment', id: nid(), text: n, line: t.line });
      notes = [];
      const s = this.statement();
      if (blank && main.body.length) s.blank = true;
      blank = false;
      main.body.push(s);
    }
    const prog = { type: 'program', items };
    if (notes.length) prog.tail = notes;
    return prog;
  }

  event() {
    const t = this.next();
    const node = { type: 'event', id: nid(), line: t.line, ev: null, arg: null, body: [] };
    if (t.v === 'beim') {
      this.expectWord('start');
      node.ev = 'start';
    } else if (t.v === 'sobald') {
      node.ev = 'sobald';
      node.arg = this.expr();
    } else {
      // bei taste / bei nachricht / bei antippen
      const w = this.peek();
      if (w.t === 'id' && w.v === 'taste') {
        this.next(); node.ev = 'taste';
        const k = this.next();
        if (k.t === 'str') node.arg = k.v.toLowerCase();
        else if (k.t === 'id' || k.t === 'num') node.arg = String(k.raw).toLowerCase();
        else this.fail('Nach „bei taste“ kommt die Taste, z. B. „bei taste "a"“.', k);
      } else if (w.t === 'id' && w.v === 'nachricht') {
        this.next(); node.ev = 'nachricht';
        const k = this.next();
        if (k.t !== 'str' && k.t !== 'id') this.fail('Nach „bei nachricht“ kommt der Name der Nachricht in Anführungszeichen.', k);
        node.arg = k.t === 'str' ? k.v : k.raw;
      } else if (w.t === 'id' && w.v === 'antippen') {
        this.next(); node.ev = 'antippen';
      } else {
        this.fail('Nach „bei“ erwarte ich „taste“, „nachricht“ oder „antippen“.', w);
      }
    }
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende');
    this.endOfStatement({});
    return node;
  }

  func() {
    const t = this.next();
    const name = this.next();
    if (name.t !== 'id') this.fail('Nach „funktion“ kommt ein Name, z. B. „funktion winken()“.', name);
    if (KEYWORDS.has(name.v) || CMD_HEADS.has(name.v)) this.fail(`„${name.raw}“ ist schon ein Befehl – nimm einen anderen Namen.`, name);
    const node = { type: 'func', id: nid(), line: t.line, name: name.v, params: [], body: [] };
    if (this.isOp('(')) {
      this.next();
      while (!this.isOp(')')) {
        const pn = this.next();
        if (pn.t !== 'id') this.fail('Hier erwarte ich den Namen eines Parameters.', pn);
        node.params.push(pn.v);
        if (this.isOp(',')) this.next(); else if (!this.isOp(')')) this.fail('Parameter werden mit Komma getrennt.');
      }
      this.next();
    }
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende');
    this.endOfStatement({});
    return node;
  }

  ablage() {
    const t = this.next();
    const node = { type: 'ablage', id: nid(), line: t.line, body: [] };
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende');
    this.endOfStatement({});
    return node;
  }

  // Liest Anweisungen bis „ende“ oder „sonst“
  body(opener) {
    const list = [];
    let blank = false;
    for (;;) {
      const nl = this.skipNl();
      if (nl > 1) blank = true;
      const t = this.peek();
      if (t.t === 'eof') {
        this.fail(`Zu „${this.describe(opener)}“ aus Zeile ${opener.line} fehlt das „ende“.`, t, { line: opener.line });
      }
      if (t.t === 'id' && BLOCK_END.has(t.v)) return list;
      if (t.t === 'comment') {
        const c = { type: 'comment', id: nid(), text: t.v, line: t.line };
        if (blank && list.length) c.blank = true;
        blank = false;
        list.push(c); this.next(); continue;
      }
      if (t.t === 'id' && (EVENT_HEADS.has(t.v) || t.v === 'funktion') && this.looksLikeItem()) {
        this.fail(`„${t.raw}“ darf nicht innerhalb eines anderen Blocks stehen. Fehlt vorher ein „ende“ (zu Zeile ${opener.line})?`, t);
      }
      const s = this.statement();
      if (blank && list.length) s.blank = true;
      blank = false;
      list.push(s);
    }
  }
  looksLikeItem() {
    const t = this.peek();
    if (t.v === 'beim') return this.isWord('start', 1);
    if (t.v === 'bei') return this.isWord('taste', 1) || this.isWord('nachricht', 1) || this.isWord('antippen', 1);
    return true;
  }
  describe(node) {
    switch (node.type) {
      case 'event': return node.ev === 'start' ? 'beim start' : node.ev === 'sobald' ? 'sobald' : 'bei ' + node.ev;
      case 'func': return 'funktion ' + node.name;
      case 'if': return 'wenn';
      case 'while': return 'solange';
      case 'repeat': case 'forever': case 'until': return 'wiederhole';
      case 'for': case 'foreach': return 'für';
      case 'parallel': return 'gleichzeitig';
      case 'ablage': return 'ablage';
      default: return node.type;
    }
  }

  /* ---------------- Anweisungen ---------------- */

  statement() {
    const t = this.peek();
    if (t.t !== 'id') this.fail(`Eine Anweisung beginnt mit einem Befehl, nicht mit „${t.raw ?? t.v}“.`, t);
    const nextTok = this.peek(1);
    const assignLike = nextTok.t === 'op' && (nextTok.v === '=' || nextTok.v === '(' || nextTok.v === '[');
    switch (t.v) {
      case 'wenn': return this.ifStmt();
      case 'solange': return this.whileStmt();
      case 'wiederhole': return this.repeatStmt();
      case 'für': return this.forStmt();
      case 'gleichzeitig': return this.parallelStmt();
      case 'ändere': return this.changeStmt();
      case 'gib': return this.returnStmt();
      default: break;
    }
    if (!assignLike && CMD_HEADS.has(t.v)) {
      const node = this.tryPatterns(CMD_HEADS.get(t.v), 'cmd');
      if (node) { this.endOfStatement(node); return node; }
      if (t.v !== 'setze') throw this.furthest;
    }
    if (t.v === 'setze') return this.setzeStmt();
    if (assignLike) return this.assignOrCall();
    // Unbekannt
    const heads = [...CMD_HEADS.keys(), 'wenn', 'solange', 'wiederhole', 'für', 'gleichzeitig', 'setze', 'ändere'];
    const guess = closest(t.v, heads);
    this.fail(`Den Befehl „${t.raw}“ kenne ich nicht.${guess ? ` Meintest du „${guess}“?` : ''}`, t, { word: t.v });
  }

  // Versucht alle Muster mit diesem Kopfwort; merkt sich den weitesten Fehler
  tryPatterns(list, kind) {
    const start = this.i;
    let best = null;
    for (const def of list) {
      this.i = start;
      try {
        const node = this.matchPattern(def, kind);
        if (kind === 'cmd') {
          const e = this.peek();
          if (e.t !== 'nl' && e.t !== 'eof' && e.t !== 'comment') {
            this.fail(`Nach „${def.p.replace(/\{(\w+):\w+\}/g, '…')}“ ist noch etwas übrig: „${e.raw ?? e.v}“.`, e);
          }
        }
        return node;
      } catch (err) {
        if (!(err instanceof KlartextError)) throw err;
        const pos = this.i;
        if (!best || pos > best.pos) best = { pos, err };
      }
    }
    this.i = start;
    this.furthest = best ? best.err : new KlartextError('Unbekannter Befehl.', this.peek().line, this.peek().col);
    return null;
  }

  matchPattern(def, kind) {
    const tok0 = this.peek();
    const node = kind === 'cmd'
      ? { type: 'cmd', id: nid(), line: tok0.line, cmd: def.id, args: {} }
      : { type: 'rep', id: nid(), line: tok0.line, rep: def.id, args: {} };
    const parts = def.parts;
    for (let k = 0; k < parts.length; k++) {
      const part = parts[k];
      if (part.word) {
        const t = this.peek();
        if (!(t.t === 'id' && t.v === part.word)) this.fail(`Hier erwarte ich „${part.word}“${this.near()}.`);
        this.next();
      } else if (part.punct) {
        this.expectOp(part.punct);
      } else {
        const after = parts[k + 1];
        const stop = after && after.word ? new Set([after.word]) : null;
        node.args[part.slot] = this.slot(part, def, kind === 'rep', stop);
      }
    }
    return node;
  }

  slot(part, def, inReporter, stop) {
    const t = this.peek();
    switch (part.type) {
      case 'joint': case 'var': {
        if (t.t !== 'id') this.fail(part.type === 'joint' ? `Hier gehört der Name eines Gelenks hin, z. B. „schulter“${this.near()}.` : `Hier gehört der Name einer Variablen hin${this.near()}.`);
        this.next();
        return t.v;
      }
      case 'dir': case 'hand': case 'side': case 'axis': {
        const opts = ENUMS[part.type];
        if (t.t !== 'id' || !opts.includes(t.v)) this.fail(`Hier passt nur ${opts.map((o) => '„' + o + '“').join(' oder ')}${this.near()}.`);
        this.next();
        return t.v;
      }
      default: {
        const e = inReporter ? this.unary(stop) : this.expr(stop);
        // Einheit prüfen
        if (e.type === 'num' && e.unit && def.unit && def.unit[part.slot]) {
          const want = UNITS[def.unit[part.slot]];
          const got = UNITS[e.unit];
          if (want && got && want.dim !== got.dim) {
            const ex = { zeit: 's oder ms', länge: 'cm, mm oder m', winkel: 'grad', prozent: '%' }[want.dim];
            this.fail(`Die Einheit „${e.unit}“ passt hier nicht – hier geht es um ${want.dim} (${ex}).`, t);
          }
        }
        return e;
      }
    }
  }

  ifStmt() {
    const t = this.next();
    const node = { type: 'if', id: nid(), line: t.line, branches: [], els: null };
    let cond = this.expr();
    let dann = this.isWord('dann'); if (dann) this.next();
    this.endOfStatement(node);
    node.branches.push({ cond, body: this.body(node), dann });
    for (;;) {
      if (this.isWord('sonst')) {
        const st = this.next();
        if (this.isWord('wenn')) {
          this.next();
          cond = this.expr();
          dann = this.isWord('dann'); if (dann) this.next();
          this.endOfStatement({});
          node.branches.push({ cond, body: this.body(node), dann, line: st.line });
          continue;
        }
        this.endOfStatement({});
        node.els = this.body(node);
        node.elsLine = st.line;
        this.expectWord('ende');
        break;
      }
      this.expectWord('ende');
      break;
    }
    this.endOfStatement({});
    return node;
  }

  whileStmt() {
    const t = this.next();
    const node = { type: 'while', id: nid(), line: t.line, cond: this.expr(), body: [] };
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende'); this.endOfStatement({});
    return node;
  }

  repeatStmt() {
    const t = this.next();
    let node;
    if (this.isWord('immer')) {
      this.next();
      node = { type: 'forever', id: nid(), line: t.line, body: [] };
    } else if (this.isWord('bis')) {
      this.next();
      node = { type: 'until', id: nid(), line: t.line, cond: this.expr(), body: [] };
    } else {
      const count = this.expr(new Set(['mal']));
      if (!this.isWord('mal')) this.fail('Nach „wiederhole 3“ fehlt „mal“ – oder meinst du „wiederhole immer“?');
      this.next();
      node = { type: 'repeat', id: nid(), line: t.line, count, body: [] };
    }
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende'); this.endOfStatement({});
    return node;
  }

  forStmt() {
    const t = this.next();
    let node;
    if (this.isWord('jedes') || this.isWord('jeden') || this.isWord('jede')) {
      this.next();
      const v = this.next();
      this.checkVarName(v);
      this.expectWord('in');
      node = { type: 'foreach', id: nid(), line: t.line, var: v.v, list: this.expr(), body: [] };
    } else {
      const v = this.next();
      if (v.t !== 'id') this.fail('Nach „für“ kommt ein Variablenname, z. B. „für i von 1 bis 10“.', v);
      this.checkVarName(v);
      this.expectWord('von');
      const from = this.expr(new Set(['bis']));
      this.expectWord('bis');
      const to = this.expr(new Set(['schritt']));
      let step = null;
      if (this.isWord('schritt')) { this.next(); step = this.expr(); }
      node = { type: 'for', id: nid(), line: t.line, var: v.v, from, to, step, body: [] };
    }
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende'); this.endOfStatement({});
    return node;
  }

  parallelStmt() {
    const t = this.next();
    const node = { type: 'parallel', id: nid(), line: t.line, body: [] };
    this.endOfStatement(node);
    node.body = this.body(node);
    this.expectWord('ende'); this.endOfStatement({});
    return node;
  }

  checkVarName(tok) {
    if (tok.t !== 'id') this.fail('Hier gehört ein Variablenname hin.', tok);
    if (KEYWORDS.has(tok.v)) this.fail(`„${tok.raw}“ ist ein reserviertes Wort und kann kein Variablenname sein.`, tok);
    if (COLOR_NAMES.includes(tok.v)) this.fail(`„${tok.raw}“ ist eine Farbe und kann kein Variablenname sein.`, tok);
    if (tok.v in CONSTANTS) this.fail(`„${tok.raw}“ ist ein fester Wert und kann kein Variablenname sein.`, tok);
    if (REP_HEADS.has(tok.v) && REP_HEADS.get(tok.v).some((r) => r.parts.length === 1)) {
      this.fail(`„${tok.raw}“ ist ein Sensorwert – wähle einen anderen Namen.`, tok);
    }
  }

  setzeStmt() {
    const t = this.next();
    const v = this.next();
    this.checkVarName(v);
    this.expectWord('auf');
    const node = { type: 'set', id: nid(), line: t.line, name: v.v, expr: this.expr(), style: 'setze' };
    this.endOfStatement(node);
    return node;
  }

  changeStmt() {
    const t = this.next();
    const v = this.next();
    this.checkVarName(v);
    this.expectWord('um');
    const node = { type: 'change', id: nid(), line: t.line, name: v.v, expr: this.expr() };
    this.endOfStatement(node);
    return node;
  }

  returnStmt() {
    const t = this.next();
    let expr = null;
    if (!this.isWord('zurück')) expr = this.expr(new Set(['zurück']));
    this.expectWord('zurück');
    const node = { type: 'return', id: nid(), line: t.line, expr };
    this.endOfStatement(node);
    return node;
  }

  assignOrCall() {
    const v = this.next();
    if (this.isOp('(')) {
      const args = this.callArgs();
      const node = { type: 'callstmt', id: nid(), line: v.line, name: v.v, args };
      this.endOfStatement(node);
      return node;
    }
    this.checkVarName(v);
    let index = null;
    if (this.isOp('[')) {
      this.next();
      index = this.expr();
      this.expectOp(']');
    }
    this.expectOp('=');
    const node = { type: 'set', id: nid(), line: v.line, name: v.v, expr: this.expr(), style: '=' };
    if (index) node.index = index;
    this.endOfStatement(node);
    return node;
  }

  callArgs() {
    this.expectOp('(');
    const args = [];
    this.skipNl();
    while (!this.isOp(')')) {
      args.push(this.expr());
      this.skipNl();
      if (this.isOp(',')) { this.next(); this.skipNl(); } else if (!this.isOp(')')) this.fail('Argumente werden mit Komma getrennt.');
    }
    this.next();
    return args;
  }

  /* ---------------- Ausdrücke ---------------- */

  expr(stop) { return this.orExpr(stop); }

  orExpr(stop) {
    let a = this.andExpr(stop);
    while (this.isWord('oder') && !(stop && stop.has('oder'))) {
      this.next();
      a = { type: 'bin', id: nid(), op: 'oder', a, b: this.andExpr(stop) };
    }
    return a;
  }
  andExpr(stop) {
    let a = this.notExpr(stop);
    while (this.isWord('und') && !(stop && stop.has('und'))) {
      this.next();
      a = { type: 'bin', id: nid(), op: 'und', a, b: this.notExpr(stop) };
    }
    return a;
  }
  notExpr(stop) {
    if (this.isWord('nicht')) {
      this.next();
      return { type: 'un', id: nid(), op: 'nicht', a: this.notExpr(stop) };
    }
    return this.cmpExpr(stop);
  }
  cmpExpr(stop) {
    let a = this.addExpr(stop);
    const ops = ['==', '!=', '<', '>', '<=', '>=', '='];
    while (this.peek().t === 'op' && ops.includes(this.peek().v)) {
      const op = this.next().v;
      a = { type: 'bin', id: nid(), op, a, b: this.addExpr(stop) };
    }
    return a;
  }
  addExpr(stop) {
    let a = this.mulExpr(stop);
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().v;
      a = { type: 'bin', id: nid(), op, a, b: this.mulExpr(stop) };
    }
    return a;
  }
  mulExpr(stop) {
    let a = this.powExpr(stop);
    while (this.isOp('*') || this.isOp('/') || (this.isOp('%') && this.startsOperand(1))) {
      const op = this.next().v;
      a = { type: 'bin', id: nid(), op, a, b: this.powExpr(stop) };
    }
    return a;
  }
  powExpr(stop) {
    const a = this.unary(stop);
    if (this.isOp('^')) {
      this.next();
      return { type: 'bin', id: nid(), op: '^', a, b: this.powExpr(stop) };
    }
    return a;
  }
  unary(stop) {
    if (this.isOp('-')) {
      this.next();
      const a = this.unary(stop);
      if (a.type === 'num' && !a.p) { a.v = -a.v; a.raw = '-' + a.raw; return a; }
      return { type: 'un', id: nid(), op: '-', a };
    }
    return this.postfix(stop);
  }
  postfix(stop) {
    let a = this.primary(stop);
    while (this.isOp('[')) {
      this.next();
      const i = this.expr();
      this.expectOp(']');
      a = { type: 'index', id: nid(), a, i };
    }
    return a;
  }
  startsOperand(o = 0) {
    const t = this.peek(o);
    if (t.t === 'num' || t.t === 'str') return true;
    if (t.t === 'op') return t.v === '(' || t.v === '[' || t.v === '-';
    if (t.t === 'id') return !KEYWORDS.has(t.v) || t.v === 'nicht';
    return false;
  }

  primary(stop) {
    const t = this.peek();
    if (t.t === 'num') {
      this.next();
      const node = { type: 'num', id: nid(), v: t.v, raw: t.raw };
      const u = this.peek();
      if (u.t === 'id' && UNITS[u.v] && !this.isOp('(', 1) && !(stop && stop.has(u.v))) { this.next(); node.unit = u.v; }
      else if (u.t === 'op' && (u.v === '°' || (u.v === '%' && !this.startsOperand(1)))) { this.next(); node.unit = u.v; }
      return node;
    }
    if (t.t === 'str') { this.next(); return { type: 'str', id: nid(), v: t.v }; }
    if (t.t === 'op' && t.v === '(') {
      this.next();
      this.skipNl();
      const e = this.expr();
      this.skipNl();
      this.expectOp(')');
      e.p = true;
      return e;
    }
    if (t.t === 'op' && t.v === '[') {
      this.next();
      const items = [];
      this.skipNl();
      while (!this.isOp(']')) {
        items.push(this.expr());
        this.skipNl();
        if (this.isOp(',')) { this.next(); this.skipNl(); } else if (!this.isOp(']')) this.fail('Listenelemente werden mit Komma getrennt.');
      }
      this.next();
      return { type: 'list', id: nid(), items };
    }
    if (t.t === 'id') {
      if (t.v in CONSTANTS) { this.next(); return { type: 'const', id: nid(), v: t.v }; }
      if (COLOR_NAMES.includes(t.v)) { this.next(); return { type: 'color', id: nid(), v: t.v }; }
      if (REP_HEADS.has(t.v) && !this.isOp('(', 1)) {
        const node = this.tryPatterns(REP_HEADS.get(t.v), 'rep');
        if (node) return node;
      }
      if (KEYWORDS.has(t.v)) this.fail(`An dieser Stelle erwarte ich einen Wert, aber „${t.raw}“ ist ein Schlüsselwort.`, t);
      this.next();
      if (this.isOp('(')) {
        const args = this.callArgs();
        return { type: 'call', id: nid(), name: t.v, args };
      }
      return { type: 'var', id: nid(), name: t.v };
    }
    if (t.t === 'nl' || t.t === 'eof') this.fail('Hier fehlt noch ein Wert – die Zeile ist zu früh zu Ende.', t);
    this.fail(`An dieser Stelle erwarte ich einen Wert, nicht „${t.raw ?? t.v}“.`, t);
  }
}

export { KlartextError, BUILTINS, CMD, REP };
