// Dialoge, Hinweise, Menüs und Popover
import { h, clear } from '../core/util.js';
import { icon } from '../core/icons.js';

export function toast(text, kind = '', ms = 2600) {
  const box = document.getElementById('toasts');
  const t = h('div.toast' + (kind ? '.' + kind : ''), text);
  box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms);
}

let openModal = null;
export function modal({ title, body, actions = [], wide = false, onClose, dismiss = true }) {
  closeModal();
  const back = h('div.modal-back');
  const box = h('div.modal' + (wide ? '.wide' : ''));
  if (title) box.appendChild(h('h2', title));
  if (body) box.appendChild(typeof body === 'string' ? h('p', { html: body }) : body);
  if (actions.length) {
    const row = h('div.acts');
    for (const a of actions) {
      const b = h('button.btn' + (a.primary ? '.primary' : '') + (a.ghost ? '.ghost' : ''), { html: (a.icon ? icon(a.icon) : '') + `<span>${a.label}</span>` });
      b.addEventListener('click', () => { if (a.keep) { a.run && a.run(); return; } closeModal(); a.run && a.run(); });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
  back.appendChild(box);
  if (dismiss) back.addEventListener('pointerdown', (e) => { if (e.target === back) closeModal(); });
  document.body.appendChild(back);
  openModal = { back, onClose };
  const first = box.querySelector('input');
  if (first) setTimeout(() => first.focus(), 60);
  return box;
}
export function closeModal() {
  if (!openModal) return;
  const m = openModal;
  openModal = null;
  m.back.remove();
  m.onClose && m.onClose();
}
export const modalOpen = () => !!openModal;

export function ask(title, label, value = '', ok = 'OK') {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'text', value, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': label });
    const body = h('div', h('p', label), inp);
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim(); closeModal(); finish(v || null); } });
    modal({ title, body, actions: [{ label: 'Abbrechen', ghost: true, run: () => finish(null) }, { label: ok, primary: true, run: () => finish(inp.value.trim() || null) }], onClose: () => finish(null) });
  });
}

export function confirmBox(title, text, ok = 'OK', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    modal({ title, body: text, actions: [{ label: 'Abbrechen', ghost: true, run: () => finish(false) }, { label: ok, primary: !danger, run: () => finish(true) }], onClose: () => finish(false) });
  });
}

/* ---------- Popover ---------- */

let openPop = null;
export function popover(anchor, content, { place = 'below', onClose, cls = '' } = {}) {
  closePop();
  const pop = h('div.pop' + (cls ? '.' + cls : ''));
  pop.appendChild(content);
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r.left + (r.width || 0) / 2 - pw / 2;
  let y = place === 'above' ? r.top - ph - 8 : (r.bottom ?? r.top) + 8;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
  if (y < 8) y = 8;
  x = Math.max(8, Math.min(innerWidth - pw - 8, x));
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  const away = (e) => { if (!pop.contains(e.target)) closePop(); };
  setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
  openPop = { pop, away, onClose };
  return pop;
}
export function closePop() {
  if (!openPop) return;
  const p = openPop;
  openPop = null;
  document.removeEventListener('pointerdown', p.away, true);
  p.pop.remove();
  p.onClose && p.onClose();
}
export const popOpen = () => !!openPop;

// Menü: items [{ label, icon, swatch, hint, run, danger, on }] oder '-'
export function menu(anchor, items, opts) {
  const m = h('div.menu');
  for (const it of items) {
    if (it === '-') { m.appendChild(h('hr')); continue; }
    const b = h('button' + (it.danger ? '.danger' : '') + (it.on ? '.on' : ''));
    if (it.swatch) b.appendChild(h('i.sw', { style: { background: it.swatch } }));
    if (it.icon) b.insertAdjacentHTML('beforeend', icon(it.icon));
    b.appendChild(h('span', it.label));
    if (it.hint) b.appendChild(h('small', it.hint));
    b.addEventListener('click', () => { closePop(); it.run && it.run(); });
    m.appendChild(b);
  }
  return popover(anchor, m, opts);
}

export { clear };
