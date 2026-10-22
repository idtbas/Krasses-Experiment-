// Baustein-Modell: Wie jeder Knoten des Syntaxbaums als Baustein aussieht,
// welche Lücken er hat und welche Vorlagen die Palette anbietet.
import { CMD, REP, CMD_BY_ID, REP_BY_ID, CAT, CATEGORIES, BUILTINS, ENUMS, COLOR_NAMES, defaultFor, missingNeed } from '../lang/commands.js';
import { nid } from '../lang/parser.js';

export const OP_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷', '%': 'Rest', '^': 'hoch', '==': '=', '=': '=', '!=': '≠', '<': '<', '>': '>', '<=': '≤', '>=': '≥', und: 'und', oder: 'oder' };
const BOOL_OPS = new Set(['==', '=', '!=', '<', '>', '<=', '>=', 'und', 'oder']);

export const w = (t) => ({ w: t });
export const slot = (obj, key, type, extra = {}) => ({ slot: { obj, key, type, ...extra } });

/* ---------- Kategorie eines Knotens ---------- */

export function catOf(n) {
  switch (n.type) {
    case 'cmd': return CMD_BY_ID[n.cmd].cat;
    case 'rep': return REP_BY_ID[n.rep].cat;
    case 'event': return 'ereignis';
    case 'func': case 'callstmt': case 'return': return 'funktion';
    case 'call': return BUILTINS[n.name] ? 'rechnen' : 'funktion';
    case 'set': case 'change': case 'var': case 'list': case 'index': return 'variable';
    case 'bin': case 'un': return 'rechnen';
    case 'main': return 'ereignis';
    default: return 'steuerung';
  }
}

export function returnsBool(e) {
  if (!e) return false;
  if (e.type === 'bin') return BOOL_OPS.has(e.op);
  if (e.type === 'un') return e.op === 'nicht';
  if (e.type === 'rep') return REP_BY_ID[e.rep].type === 'bool';
  if (e.type === 'const') return e.v === 'wahr' || e.v === 'falsch' || e.v === 'ja' || e.v === 'nein';
  return false;
}

/* ---------- Aufbau eines Bausteins (Zeilen mit Wörtern, Lücken, Körpern) ---------- */

function patternParts(def, args) {
  const parts = [];
  for (const p of def.parts) {
    if (p.word) parts.push(w(p.word));
    else if (p.punct) parts.push(w(','));
    else parts.push(slot(args, p.slot, p.type, { unit: def.unit && def.unit[p.slot], def, name: p.slot }));
  }
  return parts;
}

// Liefert { shape: 'stmt'|'c'|'hat'|'note', rows: [{ parts, body }] }
export function layoutOf(n) {
  switch (n.type) {
    case 'cmd': return { shape: 'stmt', rows: [{ parts: patternParts(CMD_BY_ID[n.cmd], n.args) }] };
    case 'set': return { shape: 'stmt', rows: [{ parts: [w('setze'), slot(n, 'name', 'var'), n.index ? w('Nr.') : null, n.index ? slot(n, 'index', 'num') : null, w('auf'), slot(n, 'expr', 'any')].filter(Boolean) }] };
    case 'change': return { shape: 'stmt', rows: [{ parts: [w('ändere'), slot(n, 'name', 'var'), w('um'), slot(n, 'expr', 'num')] }] };
    case 'return': return { shape: 'stmt', rows: [{ parts: [w('gib'), slot(n, 'expr', 'any'), w('zurück')] }] };
    case 'callstmt': return { shape: 'stmt', rows: [{ parts: [w(n.name), ...n.args.map((_, i) => slot(n.args, i, 'any'))] }], call: true };
    case 'comment': return { shape: 'note', rows: [{ parts: [slot(n, 'text', 'note')] }] };
    case 'if': {
      const rows = n.branches.map((b, i) => ({ parts: [w(i === 0 ? 'wenn' : 'sonst wenn'), slot(b, 'cond', 'bool'), w('dann')], body: b.body }));
      if (n.els) rows.push({ parts: [w('sonst')], body: n.els });
      return { shape: 'c', rows };
    }
    case 'while': return { shape: 'c', rows: [{ parts: [w('solange'), slot(n, 'cond', 'bool')], body: n.body }] };
    case 'until': return { shape: 'c', rows: [{ parts: [w('wiederhole bis'), slot(n, 'cond', 'bool')], body: n.body }] };
    case 'repeat': return { shape: 'c', rows: [{ parts: [w('wiederhole'), slot(n, 'count', 'num'), w('mal')], body: n.body }] };
    case 'forever': return { shape: 'c', rows: [{ parts: [w('wiederhole immer')], body: n.body }], loop: true };
    case 'for': return { shape: 'c', rows: [{ parts: [w('für'), slot(n, 'var', 'var'), w('von'), slot(n, 'from', 'num'), w('bis'), slot(n, 'to', 'num'), n.step ? w('schritt') : null, n.step ? slot(n, 'step', 'num') : null].filter(Boolean), body: n.body }] };
    case 'foreach': return { shape: 'c', rows: [{ parts: [w('für jedes'), slot(n, 'var', 'var'), w('in'), slot(n, 'list', 'any')], body: n.body }] };
    case 'parallel': return { shape: 'c', rows: [{ parts: [w('gleichzeitig')], body: n.body }] };
    // Kopfbausteine
    case 'event': {
      if (n.ev === 'start') return { shape: 'hat', rows: [{ parts: [{ icon: 'flag' }, w('beim start')], body: n.body }] };
      if (n.ev === 'sobald') return { shape: 'hat', rows: [{ parts: [w('sobald'), slot(n, 'arg', 'bool')], body: n.body }] };
      if (n.ev === 'taste') return { shape: 'hat', rows: [{ parts: [w('bei taste'), slot(n, 'arg', 'key')], body: n.body }] };
      if (n.ev === 'nachricht') return { shape: 'hat', rows: [{ parts: [w('bei nachricht'), slot(n, 'arg', 'msg')], body: n.body }] };
      return { shape: 'hat', rows: [{ parts: [{ icon: 'hand' }, w('bei antippen')], body: n.body }] };
    }
    case 'func': return { shape: 'hat', rows: [{ parts: [w('funktion'), { fname: n }, ...n.params.map((p, i) => slot(n.params, i, 'param'))], body: n.body }], func: true };
    case 'main': return { shape: 'hat', rows: [{ parts: [{ icon: 'play' }, w('Programm')], body: n.body }], main: true };
    case 'ablage': return { shape: 'loose', rows: [{ body: n.body }] };
    default: return { shape: 'stmt', rows: [{ parts: [w('?')] }] };
  }
}

// Aufbau eines Melders (Ausdruck mit eigenem Block)
export function exprLayout(e) {
  switch (e.type) {
    case 'rep': return { bool: REP_BY_ID[e.rep].type === 'bool', parts: patternParts(REP_BY_ID[e.rep], e.args) };
    case 'bin': return { bool: BOOL_OPS.has(e.op), parts: [slot(e, 'a', e.op === 'und' || e.op === 'oder' ? 'bool' : 'any'), { op: e }, slot(e, 'b', e.op === 'und' || e.op === 'oder' ? 'bool' : 'any')] };
    case 'un': return e.op === 'nicht' ? { bool: true, parts: [w('nicht'), slot(e, 'a', 'bool')] } : { parts: [w('−'), slot(e, 'a', 'num')] };
    case 'call': {
      const b = BUILTINS[e.name];
      if (b) {
        const parts = [];
        const re = /\{(\w)\}|([^{}\s]+)/g;
        let m;
        while ((m = re.exec(b.label))) {
          if (m[1]) parts.push(slot(e.args, m[1] === 'a' ? 0 : 1, 'num'));
          else parts.push(w(m[2]));
        }
        return { parts };
      }
      return { parts: [w(e.name), ...e.args.map((_, i) => slot(e.args, i, 'any'))] };
    }
    case 'var': return { parts: [w(e.name)], variable: true };
    case 'list': return { parts: [w('liste'), ...e.items.map((_, i) => slot(e.items, i, 'any')), { listPlus: e }] };
    case 'index': return { parts: [w('element'), slot(e, 'i', 'num'), w('von'), slot(e, 'a', 'any')] };
    default: return null;
  }
}

// Werte, die direkt in eine Lücke getippt werden (ohne eigenen Block)
export const isLiteral = (e) => !e || ['num', 'str', 'color', 'const', 'hole'].includes(e.type);

/* ---------- Vorlagen für die Palette ---------- */

const num = (v) => ({ type: 'num', id: nid(), v, raw: String(v) });
const str = (v) => ({ type: 'str', id: nid(), v });
const hole = () => ({ type: 'hole', id: nid() });
const color = (v) => ({ type: 'color', id: nid(), v });

function defaultSlot(def, p, robotType) {
  const d = defaultFor(def, p.slot, robotType);
  switch (p.type) {
    case 'joint': return d || null;
    case 'dir': case 'hand': case 'side': case 'axis': return d || ENUMS[p.type][0];
    case 'var': return d || 'liste';
    case 'bool': return hole();
    case 'color': return color(d || 'rot');
    case 'num': return num(d ?? 0);
    case 'str': return str(d ?? '');
    default: return typeof d === 'number' ? num(d) : d != null ? (COLOR_NAMES.includes(d) ? color(d) : str(d)) : hole();
  }
}

export function cmdNode(def, robotType) {
  const args = {};
  for (const p of def.slots) args[p.slot] = defaultSlot(def, p, robotType);
  return { type: 'cmd', id: nid(), cmd: def.id, args };
}
export function repNode(def, robotType) {
  const args = {};
  for (const p of def.slots) args[p.slot] = defaultSlot(def, p, robotType);
  return { type: 'rep', id: nid(), rep: def.id, args };
}

const S = (type, extra) => ({ type, id: nid(), ...extra });

// Palette: Liste von { cat, items: [{ kind: 'stmt'|'hat'|'expr', make: () => Knoten }] }
export function paletteFor(robotType, vars = [], funcs = [], caps = null) {
  const out = [];
  const byCat = {};
  for (const c of CATEGORIES) byCat[c.id] = [];
  const ok = (d) => !d.hidden && (!d.robots || d.robots.includes(robotType)) && !missingNeed(d, caps);
  // Ereignisse
  byCat.ereignis.push(
    { kind: 'hat', make: () => S('event', { ev: 'start', arg: null, body: [] }) },
    { kind: 'hat', make: () => S('event', { ev: 'taste', arg: 'leertaste', body: [] }) },
    { kind: 'hat', make: () => S('event', { ev: 'nachricht', arg: 'los', body: [] }) },
    { kind: 'hat', make: () => S('event', { ev: 'sobald', arg: caps && !caps.has('abstand') ? { type: 'bin', id: nid(), op: '>', a: repNode(REP_BY_ID.r_zeit, robotType), b: num(10) } : { type: 'bin', id: nid(), op: '<', a: repNode(REP_BY_ID.r_abstand, robotType), b: num(10) }, body: [] }) },
    { kind: 'hat', make: () => S('event', { ev: 'antippen', arg: null, body: [] }) },
  );
  for (const def of CMD) {
    if (!ok(def)) continue;
    if (def.cat === 'variable') continue;
    byCat[def.cat].push({ kind: 'stmt', make: () => cmdNode(def, robotType) });
  }
  for (const def of REP) {
    if (!ok(def)) continue;
    byCat[def.cat].push({ kind: 'expr', make: () => repNode(def, robotType) });
  }
  // Steuerung
  const st = byCat.steuerung;
  const warte = st.findIndex((x) => x.make().cmd === 'warte');
  const ctl = [
    { kind: 'stmt', make: () => S('repeat', { count: num(3), body: [] }) },
    { kind: 'stmt', make: () => S('forever', { body: [] }) },
    { kind: 'stmt', make: () => S('if', { branches: [{ cond: hole(), body: [], dann: true }], els: null }) },
    { kind: 'stmt', make: () => S('if', { branches: [{ cond: hole(), body: [], dann: true }], els: [] }) },
    { kind: 'stmt', make: () => S('until', { cond: hole(), body: [] }) },
    { kind: 'stmt', make: () => S('while', { cond: hole(), body: [] }) },
    { kind: 'stmt', make: () => S('for', { var: 'i', from: num(1), to: num(10), step: null, body: [] }) },
    { kind: 'stmt', make: () => S('foreach', { var: 'f', list: { type: 'list', id: nid(), items: [color('rot'), color('blau')] }, body: [] }) },
    { kind: 'stmt', make: () => S('parallel', { body: [] }) },
  ];
  st.splice(Math.max(0, warte) + 2, 0, ...ctl);
  st.push({ kind: 'stmt', make: () => S('comment', { text: 'Notiz' }) });
  // Rechnen
  const R = byCat.rechnen;
  const bin = (op, a, b) => () => ({ type: 'bin', id: nid(), op, a: a(), b: b() });
  R.unshift(
    { kind: 'expr', make: bin('+', () => num(0), () => num(0)) },
    { kind: 'expr', make: bin('-', () => num(0), () => num(0)) },
    { kind: 'expr', make: bin('*', () => num(0), () => num(0)) },
    { kind: 'expr', make: bin('/', () => num(0), () => num(1)) },
    { kind: 'expr', make: bin('<', () => hole(), () => num(10)) },
    { kind: 'expr', make: bin('>', () => hole(), () => num(10)) },
    { kind: 'expr', make: bin('==', () => hole(), () => num(0)) },
    { kind: 'expr', make: bin('und', () => hole(), () => hole()) },
    { kind: 'expr', make: bin('oder', () => hole(), () => hole()) },
    { kind: 'expr', make: () => ({ type: 'un', id: nid(), op: 'nicht', a: hole() }) },
  );
  R.push(
    { kind: 'expr', make: bin('%', () => num(10), () => num(3)) },
    ...['runde', 'abs', 'wurzel', 'min', 'max'].map((n) => ({ kind: 'expr', make: () => ({ type: 'call', id: nid(), name: n, args: BUILTINS[n].n === 1 ? [num(0)] : [num(0), num(0)] }) })),
    { kind: 'expr', make: () => ({ type: 'const', id: nid(), v: 'wahr' }), literal: true },
  );
  // Variablen
  const V = byCat.variable;
  const v0 = vars[0] || 'x';
  V.push(
    { kind: 'stmt', make: () => S('set', { name: v0, expr: num(0), style: 'setze' }) },
    { kind: 'stmt', make: () => S('change', { name: v0, expr: num(1) }) },
  );
  for (const v of vars) V.push({ kind: 'expr', make: () => ({ type: 'var', id: nid(), name: v }) });
  V.push(
    { kind: 'expr', make: () => ({ type: 'list', id: nid(), items: [num(1), num(2), num(3)] }) },
    { kind: 'expr', make: () => ({ type: 'index', id: nid(), i: num(1), a: { type: 'var', id: nid(), name: 'liste' } }) },
    { kind: 'expr', make: () => ({ type: 'call', id: nid(), name: 'länge', args: [{ type: 'var', id: nid(), name: 'liste' }] }) },
  );
  for (const def of CMD) if (def.cat === 'variable') V.push({ kind: 'stmt', make: () => cmdNode(def, robotType) });
  // Funktionen
  const F = byCat.funktion;
  for (const f of funcs) {
    F.push({ kind: 'stmt', make: () => S('callstmt', { name: f.name, args: f.params.map(() => num(0)) }) });
    F.push({ kind: 'expr', make: () => ({ type: 'call', id: nid(), name: f.name, args: f.params.map(() => num(0)) }) });
  }
  F.push({ kind: 'stmt', make: () => S('return', { expr: num(0) }) });

  for (const c of CATEGORIES) if (byCat[c.id].length || c.id === 'variable' || c.id === 'funktion') out.push({ cat: c, items: byCat[c.id] });
  return out;
}

/* ---------- Hilfen für den Baum ---------- */

// Tiefe Kopie mit neuen IDs
export function cloneNode(n) {
  if (Array.isArray(n)) return n.map(cloneNode);
  if (n && typeof n === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(n)) o[k] = k === 'id' ? nid() : k === 'line' ? undefined : cloneNode(v);
    return o;
  }
  return n;
}

// Alle Variablennamen im Programm
export function collectVars(ast) {
  const set = new Set();
  const ex = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'var') set.add(e.name);
    for (const v of Object.values(e)) if (v && typeof v === 'object') ex(v);
  };
  const st = (list) => {
    for (const s of list || []) {
      if (s.type === 'set' || s.type === 'change') set.add(s.name);
      if (s.type === 'for' || s.type === 'foreach') set.add(s.var);
      if (s.type === 'cmd' && CMD_BY_ID[s.cmd].cat === 'variable' && s.args.liste) set.add(s.args.liste);
      ex(s);
      if (s.body) st(s.body);
      if (s.branches) for (const b of s.branches) st(b.body);
      if (s.els) st(s.els);
    }
  };
  for (const it of ast.items) { st(it.body); if (it.type === 'func') for (const p of it.params) set.add(p); if (it.arg && typeof it.arg === 'object') ex(it.arg); }
  return [...set];
}

export { CAT, num, str, hole, color };
