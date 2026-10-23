// DOM-Helfer: h('div#id.klasse', {attr}, ...kinder), Meldungen, Auswahlmenüs
import { icon } from './icons.js';

export function h(sel, ...rest) {
  const m = sel.match(/^([a-z0-9]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  if (m[2]) el.id = m[2].slice(1);
  if (m[3]) el.className = m[3].split('.').filter(Boolean).join(' ');
  for (const r of rest) {
    if (r == null || r === false) continue;
    if (typeof r === 'string' || typeof r === 'number') el.appendChild(document.createTextNode(String(r)));
    else if (r instanceof Node) el.appendChild(r);
    else if (Array.isArray(r)) for (const c of r) { if (c != null && c !== false) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
    else for (const [k, v] of Object.entries(r)) {
      if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className += ' ' + v;
      else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function toast(text, kind = '') {
  const box = document.getElementById('toasts');
  const t = h('div.toast' + (kind ? '.' + kind : ''), { html: (kind === 'ok' ? icon('check') : kind === 'warn' ? icon('warn') : icon('info')) + `<span>${text}</span>` });
  box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 450); }, 3200);
}

// Aufklappmenü an einem Element: items [{label, sub, icon, on, run}] oder {head}
let openPop = null;
export function popover(anchor, items, opts = {}) {
  closePop();
  const pop = h('div.pop');
  for (const it of items) {
    if (it.head) { pop.appendChild(h('div.hd.cap', it.head)); continue; }
    const o = h('div.opt' + (it.on ? '.on' : '') + (it.disabled ? '.off' : ''), { html: (it.icon ? icon(it.icon) : '') + `<div><div>${it.label}</div>${it.sub ? `<small>${it.sub}</small>` : ''}</div>` });
    o.addEventListener('click', () => { closePop(); it.run && it.run(); });
    pop.appendChild(o);
  }
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  const pw = Math.max(opts.width || 240, pop.offsetWidth);
  pop.style.minWidth = (opts.width || 240) + 'px';
  pop.style.left = Math.min(W - pw - 8, Math.max(8, r.left)) + 'px';
  pop.style.top = Math.min(H - pop.offsetHeight - 8, r.bottom + 6) + 'px';
  openPop = pop;
  setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
  return pop;
}
function onDoc(e) { if (openPop && !openPop.contains(e.target)) closePop(); }
export function closePop() { if (openPop) { openPop.remove(); openPop = null; document.removeEventListener('pointerdown', onDoc, true); } }

// Segmentschalter
export function seg(options, value, onChange, cls = '') {
  const el = h('div.seg' + cls);
  for (const [v, label] of options) {
    const b = h('button' + (v === value ? '.on' : ''), label);
    b.addEventListener('click', () => { for (const x of el.children) x.classList.remove('on'); b.classList.add('on'); onChange(v); });
    el.appendChild(b);
  }
  return el;
}
export function select(options, value, onChange) {
  const s = h('select');
  for (const [v, label] of options) { const o = h('option', { value: String(v) }, label); if (String(v) === String(value)) o.selected = true; s.appendChild(o); }
  s.addEventListener('change', () => { const o = options.find(([v]) => String(v) === s.value); onChange(o ? o[0] : s.value); });
  return h('div.sel', s);
}
export function toggle(label, on, onChange) {
  const el = h('div.toggle' + (on ? '.on' : ''), h('i'), h('span', label));
  el.addEventListener('click', () => { const v = !el.classList.contains('on'); el.classList.toggle('on', v); onChange(v); });
  return el;
}
export function slider(min, max, step, value, fmt, onChange) {
  const inp = h('input', { type: 'range', min, max, step, value });
  const out = h('output', fmt(value));
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt(v); onChange(v); });
  return h('div.range', inp, out);
}
export function field(label, control) { return h('div.field', h('label', label), control); }
export function stat(label, value, small = '') { return h('div.stat', h('span', label), h('b', { html: value + (small ? ` <small>${small}</small>` : '') })); }

// nur schreiben, wenn sich etwas ändert (jede Zuweisung kostet Stil- und Layoutarbeit)
export function setHTML(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }
export function setText(el, text) { if (el._text !== text) { el._text = text; el.textContent = text; } }

export function fmtInt(v) { return Math.round(v).toLocaleString('de-DE'); }
export function fmtNum(v, d = 1) { return Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
export function fmtBytes(b) { return b > 1e9 ? fmtNum(b / 1e9, 2) + ' GB' : b > 1e6 ? fmtNum(b / 1e6, 1) + ' MB' : fmtNum(b / 1e3, 0) + ' kB'; }

export function modal(title, body, actions = [], opts = {}) {
  const ov = h('div.overlay');
  const sheet = h('div.sheet', { style: { width: opts.width || 'min(560px, 100%)', height: opts.height || 'auto' } });
  const close = () => ov.remove();
  const x = h('button.btn.icon.ghost', { html: icon('close') }); x.addEventListener('click', close);
  sheet.append(h('header', h('h2', title), h('div.grow'), x), h('div.body', body));
  if (actions.length) {
    const f = h('footer');
    for (const a of actions) { const b = h('button.btn' + (a.primary ? '.primary' : ''), a.label); b.addEventListener('click', () => { if (a.run && a.run() === false) return; close(); }); f.appendChild(b); }
    sheet.appendChild(f);
  }
  ov.appendChild(sheet);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov && !opts.sticky) close(); });
  document.body.appendChild(ov);
  return { ov, sheet, close };
}
