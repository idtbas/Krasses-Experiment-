// Klartext · Formatierer
// Syntaxbaum → Text. Liefert zusätzlich, in welcher Zeile jeder Knoten steht,
// damit beim Ausführen die richtige Zeile leuchten kann.

import { CMD_BY_ID, REP_BY_ID } from './commands.js';

const PREC = { oder: 1, und: 2, '==': 4, '!=': 4, '<': 4, '>': 4, '<=': 4, '>=': 4, '=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 7 };

export function quote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

export function fmtNumber(v) {
  if (!isFinite(v)) return '0';
  const r = Math.round(v * 1e6) / 1e6;
  return String(Object.is(r, -0) ? 0 : r);
}

export function formatExpr(e, parentPrec = 0, right = false) {
  if (!e) return '';
  let s;
  let prec = 9;
  switch (e.type) {
    case 'num': s = (e.raw != null && parseFloat(e.raw) === e.v ? e.raw : fmtNumber(e.v)) + (e.unit ? (e.unit === '°' || e.unit === '%' ? e.unit : ' ' + e.unit) : ''); break;
    case 'str': s = quote(e.v); break;
    case 'const': case 'color': s = e.v; break;
    case 'var': s = e.name; break;
    case 'list': s = '[' + e.items.map((x) => formatExpr(x)).join(', ') + ']'; break;
    case 'index': s = formatExpr(e.a, 9) + '[' + formatExpr(e.i) + ']'; break;
    case 'call': s = e.name + '(' + e.args.map((x) => formatExpr(x)).join(', ') + ')'; break;
    case 'rep': s = formatPattern(REP_BY_ID[e.rep], e.args, true); break;
    case 'un':
      prec = e.op === 'nicht' ? 3 : 8;
      s = e.op === 'nicht' ? 'nicht ' + formatExpr(e.a, 3) : '-' + formatExpr(e.a, 8);
      break;
    case 'bin': {
      prec = PREC[e.op];
      const rightAssoc = e.op === '^';
      const l = formatExpr(e.a, rightAssoc ? prec + 1 : prec, false);
      const r = formatExpr(e.b, rightAssoc ? prec : prec + 1, true);
      s = `${l} ${e.op} ${r}`;
      break;
    }
    case 'hole': s = '…'; break;
    default: s = '?';
  }
  if (e.p || prec < parentPrec) return '(' + s + ')';
  return s;
}

function formatSlotValue(part, v, inReporter) {
  if (typeof v === 'string') return v;
  if (v == null) return '…';
  // In Meldern werden Ausdrücke mit Operatoren geklammert
  return formatExpr(v, inReporter ? 9 : 0);
}

export function formatPattern(def, args, inReporter = false) {
  if (!def) return '?';
  let out = '';
  def.parts.forEach((part, k) => {
    if (part.word) out += (out && !out.endsWith(' ') ? ' ' : '') + part.word;
    else if (part.punct) out += part.punct;
    else {
      let v = formatSlotValue(part, args[part.slot], inReporter);
      // „sende x und warte“: ein Ausdruck mit „und“ braucht hier Klammern
      const nextWord = def.parts[k + 1] && def.parts[k + 1].word;
      const a = args[part.slot];
      if (nextWord && a && typeof a === 'object' && a.type === 'bin' && a.op === nextWord && !a.p) v = '(' + v + ')';
      out += (out && !out.endsWith(' ') ? ' ' : '') + v;
    }
  });
  return out;
}

export function format(program) {
  const lines = [];
  const lineOf = new Map();
  const emit = (text, depth, node) => {
    lines.push('  '.repeat(depth) + text);
    if (node && node.id && !lineOf.has(node.id)) lineOf.set(node.id, lines.length);
  };
  const note = (n) => (n.note != null ? '  # ' + n.note : '');

  const block = (list, depth) => {
    for (const s of list) {
      if (s.blank) lines.push('');
      stmt(s, depth);
    }
  };

  const stmt = (s, d) => {
    switch (s.type) {
      case 'comment': emit('# ' + s.text, d, s); break;
      case 'cmd': emit(formatPattern(CMD_BY_ID[s.cmd], s.args) + note(s), d, s); break;
      case 'set':
        if (s.style === 'setze') emit(`setze ${s.name} auf ${formatExpr(s.expr)}` + note(s), d, s);
        else emit(`${s.name}${s.index ? '[' + formatExpr(s.index) + ']' : ''} = ${formatExpr(s.expr)}` + note(s), d, s);
        break;
      case 'change': emit(`ändere ${s.name} um ${formatExpr(s.expr)}` + note(s), d, s); break;
      case 'return': emit(`gib ${s.expr ? formatExpr(s.expr) + ' ' : ''}zurück` + note(s), d, s); break;
      case 'callstmt': emit(`${s.name}(${s.args.map((a) => formatExpr(a)).join(', ')})` + note(s), d, s); break;
      case 'if':
        s.branches.forEach((b, i) => {
          emit(`${i === 0 ? 'wenn' : 'sonst wenn'} ${formatExpr(b.cond)}${b.dann === false ? '' : ' dann'}` + (i === 0 ? note(s) : ''), d, s);
          block(b.body, d + 1);
        });
        if (s.els) { emit('sonst', d); block(s.els, d + 1); }
        emit('ende', d);
        break;
      case 'while': emit(`solange ${formatExpr(s.cond)}` + note(s), d, s); block(s.body, d + 1); emit('ende', d); break;
      case 'repeat': emit(`wiederhole ${formatExpr(s.count)} mal` + note(s), d, s); block(s.body, d + 1); emit('ende', d); break;
      case 'forever': emit('wiederhole immer' + note(s), d, s); block(s.body, d + 1); emit('ende', d); break;
      case 'until': emit(`wiederhole bis ${formatExpr(s.cond)}` + note(s), d, s); block(s.body, d + 1); emit('ende', d); break;
      case 'for':
        emit(`für ${s.var} von ${formatExpr(s.from)} bis ${formatExpr(s.to)}${s.step ? ' schritt ' + formatExpr(s.step) : ''}` + note(s), d, s);
        block(s.body, d + 1); emit('ende', d);
        break;
      case 'foreach': emit(`für jedes ${s.var} in ${formatExpr(s.list)}` + note(s), d, s); block(s.body, d + 1); emit('ende', d); break;
      case 'parallel': emit('gleichzeitig' + note(s), d, s); block(s.body, d + 1); emit('ende', d); break;
      default: emit('# ?', d, s);
    }
  };

  const items = program.items || [];
  items.forEach((it, idx) => {
    if (idx > 0) lines.push('');
    if (it.notes) for (const n of it.notes) lines.push('# ' + n);
    switch (it.type) {
      case 'main': block(it.body, 0); if (it.body[0]) lineOf.set(it.id, lineOf.get(it.body[0].id)); break;
      case 'event': {
        let head;
        if (it.ev === 'start') head = 'beim start';
        else if (it.ev === 'sobald') head = 'sobald ' + formatExpr(it.arg);
        else if (it.ev === 'taste') head = 'bei taste ' + quote(it.arg);
        else if (it.ev === 'nachricht') head = 'bei nachricht ' + quote(it.arg);
        else head = 'bei ' + it.ev;
        emit(head + note(it), 0, it);
        block(it.body, 1);
        emit('ende', 0);
        break;
      }
      case 'func':
        emit(`funktion ${it.name}(${it.params.join(', ')})` + note(it), 0, it);
        block(it.body, 1);
        emit('ende', 0);
        break;
      case 'ablage':
        emit('ablage' + note(it), 0, it);
        block(it.body, 1);
        emit('ende', 0);
        break;
      default: break;
    }
  });
  if (program.tail) { if (lines.length) lines.push(''); for (const n of program.tail) lines.push('# ' + n); }
  return { text: lines.join('\n') + (lines.length ? '\n' : ''), lineOf };
}

export const formatProgram = (p) => format(p).text;
