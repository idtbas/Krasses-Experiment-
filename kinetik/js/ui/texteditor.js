// Text-Editor für Klartext: Hervorhebung, Zeilennummern, automatische Einrückung und Vorschläge.
import { h, esc, clear } from '../core/util.js';
import { CMD, REP, CAT, COLOR_NAMES, BUILTINS, UNITS, defaultFor, CONSTANTS } from '../lang/commands.js';
import { formatExpr } from '../lang/format.js';

const CTL = new Set(['wenn', 'dann', 'sonst', 'solange', 'wiederhole', 'mal', 'immer', 'bis', 'ende', 'für', 'von', 'jedes', 'in', 'schritt', 'gleichzeitig', 'funktion', 'gib', 'zurück', 'beim', 'bei', 'sobald', 'start', 'taste', 'nachricht', 'antippen', 'ablage', 'setze', 'auf', 'ändere', 'um', 'und', 'oder', 'nicht']);
const WORDS = new Set();
for (const c of [...CMD, ...REP]) for (const p of c.parts) if (p.word) WORDS.add(p.word);
const OPENERS = /^\s*(wenn|solange|wiederhole|für|gleichzeitig|funktion|beim|bei|sobald|ablage|sonst)\b/i;

export function highlight(src) {
  let out = '';
  const re = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|„[^“”\n]*[“”]?|“[^”\n]*”?)|(\d+(?:\.\d+)?)(\s*(?:ms|min|cm|mm|m|s|grad|°|%|schritte)\b|°|%)?|([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)|([^\w\s"„“#]+)|(\s+)/gu;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) out += `<span class="tk-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-num">${esc(m[3])}</span>` + (m[4] ? `<span class="tk-unit">${esc(m[4])}</span>` : '');
    else if (m[5]) {
      const w = m[5].toLowerCase();
      if (CTL.has(w)) out += `<span class="tk-ctl">${esc(m[5])}</span>`;
      else if (COLOR_NAMES.includes(w)) out += `<span class="tk-col">${esc(m[5])}</span>`;
      else if (w in CONSTANTS) out += `<span class="tk-col">${esc(m[5])}</span>`;
      else if (WORDS.has(w)) out += `<span class="tk-kw">${esc(m[5])}</span>`;
      else if (BUILTINS[w]) out += `<span class="tk-fn">${esc(m[5])}</span>`;
      else out += esc(m[5]);
    } else if (m[6]) out += `<span class="tk-op">${esc(m[6])}</span>`;
    else out += esc(m[7] || m[0]);
  }
  return out;
}

// Vorschlagsliste aus der Befehlstabelle
function snippetFor(def, robotType) {
  let s = '';
  for (const p of def.parts) {
    if (p.word) s += (s && !s.endsWith(' ') ? ' ' : '') + p.word;
    else if (p.punct) s += ',';
    else {
      const d = defaultFor(def, p.slot, robotType);
      let v;
      if (d == null) v = p.type === 'bool' ? '…' : '0';
      else if (typeof d === 'number') v = String(d);
      else if (p.type === 'str' || (p.type === 'any' && typeof d === 'string' && !COLOR_NAMES.includes(d))) v = '"' + d + '"';
      else v = String(d);
      if (p.type === 'bool' && d == null) v = 'abstand < 10';
      s += (s && !s.endsWith(' ') ? ' ' : '') + v;
    }
  }
  return s;
}

const STRUCT_SNIPPETS = [
  { label: 'beim start … ende', text: 'beim start\n  \nende', cat: 'ereignis', caret: 13 },
  { label: 'wenn … dann … ende', text: 'wenn abstand < 10 dann\n  \nende', cat: 'steuerung', caret: 25 },
  { label: 'wenn … dann … sonst … ende', text: 'wenn abstand < 10 dann\n  \nsonst\n  \nende', cat: 'steuerung', caret: 25 },
  { label: 'wiederhole 3 mal … ende', text: 'wiederhole 3 mal\n  \nende', cat: 'steuerung', caret: 19 },
  { label: 'wiederhole immer … ende', text: 'wiederhole immer\n  \nende', cat: 'steuerung', caret: 19 },
  { label: 'wiederhole bis … ende', text: 'wiederhole bis berührt\n  \nende', cat: 'steuerung', caret: 25 },
  { label: 'solange … ende', text: 'solange abstand > 20\n  \nende', cat: 'steuerung', caret: 23 },
  { label: 'für i von 1 bis 10 … ende', text: 'für i von 1 bis 10\n  \nende', cat: 'steuerung', caret: 21 },
  { label: 'für jedes x in liste … ende', text: 'für jedes x in liste\n  \nende', cat: 'steuerung', caret: 23 },
  { label: 'gleichzeitig … ende', text: 'gleichzeitig\n  \nende', cat: 'steuerung', caret: 15 },
  { label: 'sobald … ende', text: 'sobald abstand < 10\n  \nende', cat: 'ereignis', caret: 22 },
  { label: 'bei taste "a" … ende', text: 'bei taste "a"\n  \nende', cat: 'ereignis', caret: 16 },
  { label: 'bei nachricht "los" … ende', text: 'bei nachricht "los"\n  \nende', cat: 'ereignis', caret: 22 },
  { label: 'bei antippen … ende', text: 'bei antippen\n  \nende', cat: 'ereignis', caret: 15 },
  { label: 'funktion name() … ende', text: 'funktion meine_funktion()\n  \nende', cat: 'funktion', caret: 28 },
  { label: 'setze x auf 0', text: 'setze x auf 0', cat: 'variable' },
  { label: 'ändere x um 1', text: 'ändere x um 1', cat: 'variable' },
];

export class TextEditor {
  constructor(opts) {
    this.opts = opts; // { onChange(text), robotType(), variables(), onRun() }
    this.el = h('div.pane.text-pane');
    this.wrap = h('div.editor-wrap');
    this.gutter = h('div.editor-gutter');
    this.area = h('div.editor-area');
    this.pre = h('pre', { 'aria-hidden': 'true' });
    this.hlLayer = h('div');
    this.ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': 'Programmtext', wrap: 'off' });
    this.area.append(this.hlLayer, this.pre, this.ta);
    this.wrap.append(this.gutter, this.area);
    this.status = h('div.editor-status', 'Bereit.');
    this.el.append(this.wrap, this.status);
    this.ac = null;
    this.errLine = 0;
    this.runLines = new Set();
    this.bind();
  }

  bind() {
    const ta = this.ta;
    ta.addEventListener('input', () => { this.refresh(); this.opts.onChange && this.opts.onChange(ta.value); this.suggest(); });
    ta.addEventListener('keydown', (e) => this.key(e));
    ta.addEventListener('click', () => this.closeAc());
    ta.addEventListener('blur', () => setTimeout(() => this.closeAc(), 150));
    this.area.addEventListener('scroll', () => { this.gutter.scrollTop = this.area.scrollTop; if (this.ac) this.closeAc(); });
  }

  setValue(text) {
    this.ta.value = text;
    this.refresh();
  }
  get value() { return this.ta.value; }

  refresh() {
    const v = this.ta.value;
    this.pre.innerHTML = highlight(v) + '\n';
    const lines = v.split('\n');
    const n = lines.length;
    let g = '';
    for (let i = 1; i <= n; i++) g += `<div class="${i === this.errLine ? 'err' : ''}">${i}</div>`;
    this.gutter.innerHTML = g + '<div>&nbsp;</div>';
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    const cw = this.charW || (this.charW = this.measureChar());
    const w = Math.max(this.area.clientWidth, longest * cw + 60);
    const hgt = Math.max(this.area.clientHeight, n * 22 + 60);
    this.ta.style.width = w + 'px';
    this.ta.style.height = hgt + 'px';
    this.drawLines();
  }

  measureChar() {
    const s = h('span', { style: { font: '14px var(--mono)', position: 'absolute', visibility: 'hidden' } }, 'x'.repeat(40));
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width / 40;
    s.remove();
    return w || 8.4;
  }

  drawLines() {
    clear(this.hlLayer);
    const top = 14;
    if (this.errLine) this.hlLayer.appendChild(h('div.hl-line.err', { style: { top: top + (this.errLine - 1) * 22 + 'px' } }));
    for (const l of this.runLines) this.hlLayer.appendChild(h('div.hl-line.run', { style: { top: top + (l - 1) * 22 + 'px' } }));
  }

  setRunLines(lines) {
    const key = [...lines].sort().join(',');
    if (key === this.runKey) return;
    this.runKey = key;
    this.runLines = lines;
    this.drawLines();
  }

  setError(err) {
    if (!err) {
      this.errLine = 0;
      this.status.className = 'editor-status ok';
      this.status.innerHTML = '<b>✓</b> Programm verstanden.';
    } else {
      this.errLine = err.line || 0;
      this.status.className = 'editor-status err';
      this.status.textContent = (err.line ? `Zeile ${err.line}: ` : '') + err.message;
    }
    this.refresh();
  }

  setInfo(text) { this.status.className = 'editor-status'; this.status.textContent = text; }

  goToLine(line) {
    const lines = this.ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    this.ta.focus();
    this.ta.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
    this.area.scrollTop = Math.max(0, (line - 4) * 22);
  }

  /* ---------- Tastatur ---------- */

  key(e) {
    const ta = this.ta;
    if (this.ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.moveAc(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.moveAc(-1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.acceptAc(); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.closeAc(); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b, value } = ta;
      if (e.shiftKey || a !== b) {
        const ls = value.lastIndexOf('\n', a - 1) + 1;
        const block = value.slice(ls, b);
        const nb = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
        this.replace(ls, b, nb, ls, ls + nb.length);
      } else this.insert('  ');
      return;
    }
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const { selectionStart: a, value } = ta;
      const ls = value.lastIndexOf('\n', a - 1) + 1;
      const line = value.slice(ls, a);
      let ind = line.match(/^\s*/)[0];
      if (OPENERS.test(line) && !/\bende\s*$/.test(line)) ind += '  ';
      this.insert('\n' + ind);
      return;
    }
    // „ende“ / „sonst“ automatisch ausrücken
    if (e.key === ' ' || e.key.length === 1) {
      setTimeout(() => this.autoDedent(), 0);
    }
  }

  autoDedent() {
    const ta = this.ta;
    const a = ta.selectionStart;
    const v = ta.value;
    const ls = v.lastIndexOf('\n', a - 1) + 1;
    const line = v.slice(ls, a);
    const m = line.match(/^(\s+)(ende|sonst)$/);
    if (!m) return;
    // Einrückung der passenden Öffnung suchen
    const before = v.slice(0, ls).split('\n');
    let depth = 0;
    for (let i = before.length - 2; i >= 0; i--) {
      const l = before[i];
      if (/^\s*ende\b/.test(l)) depth++;
      else if (OPENERS.test(l) && !/^\s*sonst\b/.test(l)) {
        if (depth === 0) {
          const ind = l.match(/^\s*/)[0];
          if (ind !== m[1]) this.replace(ls, ls + m[1].length, ind, ls + ind.length + m[2].length, ls + ind.length + m[2].length);
          return;
        }
        depth--;
      }
    }
  }

  insert(text) {
    const ta = this.ta;
    const a = ta.selectionStart, b = ta.selectionEnd;
    this.replace(a, b, text, a + text.length, a + text.length);
  }

  replace(a, b, text, selA, selB) {
    const ta = this.ta;
    ta.focus();
    ta.setSelectionRange(a, b);
    // execCommand erhält die Rückgängig-Funktion von Safari
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
    if (!ok) { ta.setRangeText(text, a, b, 'end'); }
    ta.setSelectionRange(selA, selB);
    this.refresh();
    this.opts.onChange && this.opts.onChange(ta.value);
  }

  /* ---------- Vorschläge ---------- */

  suggest() {
    const ta = this.ta;
    const a = ta.selectionStart;
    if (a !== ta.selectionEnd) return this.closeAc();
    const v = ta.value;
    const ls = v.lastIndexOf('\n', a - 1) + 1;
    const line = v.slice(ls, a);
    const m = line.match(/^(\s*)([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)$/);
    if (!m || m[2].length < 2) return this.closeAc();
    const word = m[2].toLowerCase();
    const rt = this.opts.robotType ? this.opts.robotType() : null;
    const items = [];
    for (const s of STRUCT_SNIPPETS) if (s.label.startsWith(word)) items.push({ ...s, word: m[2] });
    for (const def of CMD) {
      if (!def.p.startsWith(word)) continue;
      if (rt && def.robots && !def.robots.includes(rt)) continue;
      items.push({ label: def.p.replace(/\{(\w+):\w+\}/g, '…'), text: snippetFor(def, rt), cat: def.cat, hint: CAT[def.cat].name, word: m[2] });
    }
    if (!items.length) return this.closeAc();
    this.showAc(items.slice(0, 8), ls + m[1].length, a);
  }

  showAc(items, from, to) {
    this.closeAc();
    const box = h('div.ac');
    items.forEach((it, i) => {
      const row = h('div' + (i === 0 ? '.on' : ''), h('i', { style: { background: CAT[it.cat] ? CAT[it.cat].color : '#888' } }), h('span', it.label), it.hint ? h('small', it.hint) : null);
      row.addEventListener('pointerdown', (e) => { e.preventDefault(); this.acIndex = i; this.acceptAc(); });
      box.appendChild(row);
    });
    // Position an der Schreibmarke
    const lines = this.ta.value.slice(0, from).split('\n');
    const line = lines.length, col = lines[lines.length - 1].length;
    const cw = this.charW || 8.4;
    box.style.left = Math.min(16 + col * cw - this.area.scrollLeft + 46, this.wrap.clientWidth - 280) + 'px';
    box.style.top = 14 + line * 22 - this.area.scrollTop + 4 + 'px';
    this.wrap.appendChild(box);
    this.ac = { box, items, from, to };
    this.acIndex = 0;
  }
  moveAc(d) {
    const n = this.ac.items.length;
    this.acIndex = (this.acIndex + d + n) % n;
    [...this.ac.box.children].forEach((c, i) => c.classList.toggle('on', i === this.acIndex));
  }
  acceptAc() {
    const it = this.ac.items[this.acIndex];
    const { from, to } = this.ac;
    this.closeAc();
    const v = this.ta.value;
    const ls = v.lastIndexOf('\n', from - 1) + 1;
    const ind = v.slice(ls, from);
    const text = it.text.replace(/\n/g, '\n' + ind);
    let caret = from + text.length;
    if (it.caret != null) {
      const before = it.text.slice(0, it.caret);
      caret = from + before.replace(/\n/g, '\n' + ind).length;
    }
    this.replace(from, to, text, caret, caret);
  }
  closeAc() { if (this.ac) { this.ac.box.remove(); this.ac = null; } }
}

export { formatExpr, UNITS };
