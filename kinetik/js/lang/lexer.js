// Klartext · Lexer
// Zerlegt Quelltext in Tokens. Versteht auch typografische Anführungszeichen („…“),
// die das iPad beim Tippen automatisch einsetzt, sowie ×, ÷, ≤, ≥, ≠ und °.

export class KlartextError extends Error {
  constructor(msg, line = 0, col = 0, extra = {}) {
    super(msg);
    this.line = line;
    this.col = col;
    Object.assign(this, extra);
  }
}

const ID_START = /[A-Za-zÄÖÜäöüß_]/;
const ID_PART = /[A-Za-z0-9ÄÖÜäöüß_]/;
const OPEN_QUOTES = '"„“”«»‚‘\'';
const CLOSE_FOR = { '"': '"“”', '„': '“”"', '“': '”“"', '”': '”"“', '«': '»', '»': '«', '‚': '‘’\'', '‘': '’‘\'', "'": "'’‘" };

const OPS = ['==', '!=', '<=', '>=', '=', '<', '>', '+', '-', '*', '/', '%', '^', '(', ')', '[', ']', ',', '°', ':'];
const OP_ALIAS = { '≤': '<=', '≥': '>=', '≠': '!=', '×': '*', '·': '*', '÷': '/', '−': '-', '–': '-' };

export function lex(src) {
  const toks = [];
  let i = 0, line = 1, col = 1;
  const n = src.length;
  const push = (t, v, raw, l, c) => toks.push({ t, v, raw, line: l, col: c });

  while (i < n) {
    const ch = src[i];
    // Zeilenumbruch
    if (ch === '\n' || ch === ';') {
      push('nl', ch === ';' ? ';' : '\n', ch, line, col);
      i++;
      if (ch === '\n') { line++; col = 1; } else col++;
      continue;
    }
    if (ch === '\r') { i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === ' ') { i++; col++; continue; }
    // Kommentar
    if (ch === '#' || (ch === '/' && src[i + 1] === '/')) {
      const start = i, c0 = col;
      while (i < n && src[i] !== '\n') { i++; col++; }
      const raw = src.slice(start, i);
      push('comment', raw.replace(/^(#|\/\/)\s?/, ''), raw, line, c0);
      continue;
    }
    // Zahl
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const start = i, c0 = col;
      while (i < n && /[0-9]/.test(src[i])) { i++; col++; }
      if (src[i] === '.' && /[0-9]/.test(src[i + 1] || '')) {
        i++; col++;
        while (i < n && /[0-9]/.test(src[i])) { i++; col++; }
      }
      const raw = src.slice(start, i);
      push('num', parseFloat(raw), raw, line, c0);
      continue;
    }
    // Text
    if (OPEN_QUOTES.includes(ch)) {
      const closers = CLOSE_FOR[ch];
      const c0 = col, l0 = line;
      i++; col++;
      let s = '';
      while (i < n && !closers.includes(src[i])) {
        if (src[i] === '\n') throw new KlartextError('Der Text wurde nicht geschlossen – es fehlt ein Anführungszeichen.', l0, c0);
        if (src[i] === '\\' && i + 1 < n) { s += src[i + 1] === 'n' ? '\n' : src[i + 1]; i += 2; col += 2; continue; }
        s += src[i]; i++; col++;
      }
      if (i >= n) throw new KlartextError('Der Text wurde nicht geschlossen – es fehlt ein Anführungszeichen.', l0, c0);
      i++; col++;
      push('str', s, null, l0, c0);
      continue;
    }
    // Name
    if (ID_START.test(ch)) {
      const start = i, c0 = col;
      while (i < n && ID_PART.test(src[i])) { i++; col++; }
      const raw = src.slice(start, i);
      push('id', raw.toLowerCase(), raw, line, c0);
      continue;
    }
    // Lücke aus einem Baustein: … oder ...
    if (ch === '…' || src.startsWith('...', i)) {
      const len = ch === '…' ? 1 : 3;
      push('hole', '…', src.slice(i, i + len), line, col);
      i += len; col += len;
      continue;
    }
    // Operator
    if (OP_ALIAS[ch]) { push('op', OP_ALIAS[ch], ch, line, col); i++; col++; continue; }
    const two = src.slice(i, i + 2);
    if (OPS.includes(two)) { push('op', two, two, line, col); i += 2; col += 2; continue; }
    if (OPS.includes(ch)) { push('op', ch, ch, line, col); i++; col++; continue; }
    if (ch === '%') { push('op', '%', ch, line, col); i++; col++; continue; }
    throw new KlartextError(`Das Zeichen „${ch}“ kenne ich nicht.`, line, col);
  }
  push('nl', '\n', '', line, col);
  push('eof', null, '', line, col);
  return toks;
}
