// Baustein-Editor: eigener Drag-&-Drop-Editor für Finger, Apple Pencil und Trackpad.
// Jeder Baustein ist ein Knoten im Syntaxbaum – Text und Bausteine bleiben deckungsgleich.
import { h, clear, clamp } from '../core/util.js';
import { icon } from '../core/icons.js';
import { CAT, COLORS, COLOR_NAMES, ENUMS, KEYS, CMD_BY_ID, REP_BY_ID } from '../lang/commands.js';
import { layoutOf, exprLayout, catOf, isLiteral, paletteFor, cloneNode, collectVars, OP_LABEL, num, hole } from './model.js';
import { nid } from '../lang/parser.js';
import { menu, popover, closePop, ask, toast } from '../ui/dialogs.js';
import { fmtNumber } from '../lang/format.js';

const SHAPE_CLASS = { stmt: 'stmt', c: 'stmt.c', hat: 'hat.c', note: 'stmt.note', loose: 'loose' };
const ENUM_LABEL = { links: 'links', rechts: 'rechts', linke: 'linke', rechte: 'rechte', x: 'x', y: 'y', z: 'z' };
const KEY_LABEL = { leertaste: 'Leertaste', oben: '↑ oben', unten: '↓ unten', links: '← links', rechts: '→ rechts', enter: '↩ Enter' };

export class BlockEditor {
  constructor(opts) {
    this.opts = opts; // { robot(), onChange(), onTry(item), audio }
    this.scale = 1;
    this.pan = { x: 20, y: 20 };
    this.pos = new Map();
    this.undoStack = [];
    this.extraVars = new Set();
    this.build();
  }

  build() {
    this.el = h('div.pane.blocks-pane');
    this.bx = h('div.bx');
    this.rail = h('div.bx-rail');
    this.fly = h('div.bx-fly');
    this.ws = h('div.bx-ws');
    this.canvas = h('div.canvas');
    this.ws.append(h('div.grid'), this.canvas);
    this.trash = h('div.bx-trash', { html: icon('trash') + '<span>Zum Löschen hier loslassen</span>' });
    this.empty = h('div.bx-empty', h('b', 'Noch leer'), 'Ziehe Bausteine aus der Palette hierher. Fang mit „beim start“ an.');
    this.tools = h('div.bx-tools',
      this.toolBtn('undo', 'Rückgängig', () => this.undo()),
      this.toolBtn('zoomOut', 'Kleiner', () => this.zoomBy(1 / 1.15)),
      this.toolBtn('zoomIn', 'Größer', () => this.zoomBy(1.15)),
      this.toolBtn('fit', 'Aufräumen', () => this.tidy()));
    this.bx.append(this.rail, this.ws, this.fly, this.trash, this.tools);
    this.el.appendChild(this.bx);
    this.ws.appendChild(this.empty);
    this.bindWorkspace();
    this.bindPalette();
  }

  toolBtn(ic, title, fn) {
    const b = h('button.btn.icon.small', { title, 'aria-label': title, html: icon(ic) });
    b.addEventListener('click', fn);
    return b;
  }

  get robot() { return this.opts.robot ? this.opts.robot() : null; }
  get robotType() { return this.robot ? this.robot.type : 'arm'; }

  /* ================= Dokument ================= */

  setDoc(doc) {
    this.doc = doc;
    this.ast = doc.ast || { type: 'program', items: [] };
    this.pos.clear();
    const lay = doc.layout || [];
    this.ast.items.forEach((it, i) => { if (lay[i]) this.pos.set(it.id, { ...lay[i] }); });
    this.undoStack = [];
    this.scale = 1;
    this.pan = { x: this.flyClosed ? 20 : 266, y: 20 };
    this.render();
    this.renderPalette();
  }

  // Nach einer Textänderung neu aufbauen, Positionen über die Reihenfolge erhalten
  refreshFromDoc() {
    if (!this.doc || this.doc.error) return;
    const old = this.ast.items.map((it) => this.pos.get(it.id));
    this.ast = this.doc.ast;
    this.pos.clear();
    this.ast.items.forEach((it, i) => { const p = old[i] || (this.doc.layout || [])[i]; if (p) this.pos.set(it.id, { ...p }); });
    this.render();
    this.renderPalette();
  }

  snapshot() {
    this.undoStack.push({ text: this.doc.text, layout: this.layoutArray() });
    if (this.undoStack.length > 60) this.undoStack.shift();
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s) { toast('Nichts zum Rückgängigmachen.'); return; }
    this.doc.layout = s.layout;
    this.doc.setText(s.text, 'undo');
    this.ast = this.doc.ast;
    this.pos.clear();
    this.ast.items.forEach((it, i) => { if (s.layout[i]) this.pos.set(it.id, { ...s.layout[i] }); });
    this.render();
    this.renderPalette();
    this.opts.onChange && this.opts.onChange('undo');
  }

  layoutArray() { return this.ast.items.map((it) => { const p = this.pos.get(it.id); return p ? { x: Math.round(p.x), y: Math.round(p.y) } : null; }); }

  commit() {
    // leere Hilfsstapel aufräumen
    this.ast.items = this.ast.items.filter((it) => !((it.type === 'ablage' || it.type === 'main') && it.body.length === 0));
    this.doc.layout = this.layoutArray();
    this.doc.commitAst(this.ast, 'blocks');
    this.render();
    this.renderPalette();
    this.opts.onChange && this.opts.onChange('blocks');
  }

  /* ================= Darstellung ================= */

  render() {
    clear(this.canvas);
    this.info = new Map();   // Element → { node, list, index, item, kind }
    this.slots = new Map();  // Element → Lücken-Bindung
    this.lists = [];         // { list, el, item }
    this.byId = new Map();
    const items = this.ast.items;
    this.empty.style.display = items.length ? 'none' : '';
    let y = 20;
    for (const it of items) {
      const p = this.pos.get(it.id);
      if (p) y = Math.max(y, p.y);
    }
    for (const it of items) {
      const st = h('div.stack');
      st.appendChild(this.itemEl(it));
      this.canvas.appendChild(st);
      let p = this.pos.get(it.id);
      if (!p) {
        p = { x: 24, y: this.nextFreeY() };
        this.pos.set(it.id, p);
      }
      st.style.left = p.x + 'px';
      st.style.top = p.y + 'px';
      st.dataset.item = it.id;
    }
    this.applyTransform();
    if (this.active) this.setActive(this.active, true);
  }

  nextFreeY() {
    let maxY = 20;
    for (const st of this.canvas.children) {
      const top = parseFloat(st.style.top) || 0;
      maxY = Math.max(maxY, top + st.offsetHeight / 1 + 28);
    }
    return maxY;
  }

  applyTransform() {
    this.canvas.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
    const g = this.ws.querySelector('.grid');
    g.style.transform = `translate(${this.pan.x % (24 * this.scale)}px, ${this.pan.y % (24 * this.scale)}px) scale(${this.scale})`;
  }

  color(el, cat) {
    const c = CAT[cat] || CAT.steuerung;
    el.style.setProperty('--c', c.color);
    el.style.setProperty('--ink', c.ink);
  }

  itemEl(it) {
    if (it.type === 'ablage') {
      const wrap = h('div.loose');
      this.renderList(it.body, wrap, it, true);
      return wrap;
    }
    return this.blockEl(it, null, -1, it);
  }

  blockEl(n, list, index, item, palette = false) {
    const lay = layoutOf(n);
    const el = h('div.blk.' + (SHAPE_CLASS[lay.shape] || 'stmt'));
    this.color(el, n.type === 'comment' ? 'steuerung' : catOf(n));
    if (!palette) {
      this.info.set(el, { node: n, list, index, item, kind: lay.shape === 'hat' ? 'hat' : 'stmt' });
      this.byId.set(n.id, el);
      if (item && item.type === 'ablage') el.classList.add('parked');
    }
    lay.rows.forEach((row, i) => {
      const r = h(i === 0 ? 'div.row' : 'div.mid');
      for (const part of row.parts || []) r.appendChild(this.partEl(part, palette, n));
      if (n.note != null && i === 0) r.appendChild(h('span.w', { style: { opacity: 0.7, fontWeight: 500 } }, '# ' + n.note));
      el.appendChild(r);
      if (row.body) {
        const body = h('div.body' + (row.body.length ? '' : '.empty'));
        if (!palette) this.renderList(row.body, body, item);
        el.appendChild(body);
      }
    });
    if (lay.shape === 'c' || lay.shape === 'hat') el.appendChild(h('div.foot'));
    return el;
  }

  renderList(list, container, item) {
    this.lists.push({ list, el: container, item });
    list.forEach((s, i) => container.appendChild(this.blockEl(s, list, i, item)));
  }

  partEl(p, palette, owner) {
    if (p.w) return h('span.w', p.w);
    if (p.icon) return h('span', { html: icon(p.icon, 'ico') });
    if (p.fname) {
      const el = h('span.w', { style: { textDecoration: 'underline dotted', textUnderlineOffset: '3px' } }, p.fname.name);
      if (!palette) this.slots.set(el, { kind: 'fname', node: p.fname });
      return el;
    }
    if (p.op) {
      const el = h('span.w', { style: { padding: '0 2px', cursor: 'pointer' } }, OP_LABEL[p.op.op] || p.op.op);
      if (!palette) this.slots.set(el, { kind: 'op', node: p.op });
      return el;
    }
    if (p.listPlus) {
      const box = h('span', { style: { display: 'inline-flex', gap: '3px' } });
      const plus = h('span.slot.dd', { style: { minWidth: '26px', padding: '0 8px' } }, '+');
      const minus = h('span.slot.dd', { style: { minWidth: '26px', padding: '0 8px' } }, '−');
      plus.style.paddingRight = '8px'; minus.style.paddingRight = '8px';
      plus.classList.add('nochev'); minus.classList.add('nochev');
      if (!palette) { this.slots.set(plus, { kind: 'listAdd', node: p.listPlus }); this.slots.set(minus, { kind: 'listDel', node: p.listPlus }); }
      box.append(plus, minus);
      return box;
    }
    const s = p.slot;
    const v = s.obj[s.key];
    let el;
    switch (s.type) {
      case 'joint': el = h('span.slot.dd', this.jointLabel(v)); break;
      case 'dir': case 'hand': case 'side': case 'axis': el = h('span.slot.dd', ENUM_LABEL[v] || v || '…'); break;
      case 'var': el = h('span.slot.dd', v || '…'); break;
      case 'param': el = h('span.slot.txt', v || ''); break;
      case 'key': el = h('span.slot.dd', KEY_LABEL[v] || (v ? v.toUpperCase() : '…')); break;
      case 'msg': el = h('span.slot.txt', v || ''); break;
      case 'note': el = h('span.w', { style: { cursor: 'text' } }, v || 'Notiz'); break;
      default: el = this.exprSlotEl(v, s, palette); break;
    }
    if (!palette && !el.classList.contains('rep')) this.slots.set(el, { kind: 'slot', ...s });
    if (s.unit && v && v.type === 'num' && !v.unit) {
      const box = h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '3px' } }, el, h('span.unit', s.unit === 's' ? 's' : s.unit));
      return box;
    }
    return el;
  }

  jointLabel(v) {
    if (!v) return '…';
    const r = this.robot;
    const sv = r && r.servos && r.servos.get(v);
    return sv ? `${v}` : v;
  }

  exprSlotEl(v, s, palette) {
    if (!v || v.type === 'hole') return h('span.slot.hole' + (s.type === 'bool' ? '.bool' : ''), '·');
    switch (v.type) {
      case 'num': return h('span.slot.num', formatNum(v));
      case 'str': return h('span.slot.txt', v.v);
      case 'color': return h('span.slot.col', h('i', { style: { background: COLORS[v.v] || '#999' } }), v.v);
      case 'const': return h('span.slot.dd', v.v);
      default: return this.exprEl(v, s, palette);
    }
  }

  exprEl(e, parentSlot, palette) {
    const lay = exprLayout(e);
    if (!lay) return h('span.slot', '?');
    const el = h('span.rep' + (lay.bool ? '.bool' : ''));
    this.color(el, catOf(e));
    for (const part of lay.parts) el.appendChild(this.partEl(part, palette, e));
    if (!palette) {
      this.info.set(el, { expr: e, slot: parentSlot, kind: 'expr' });
      this.byId.set(e.id, el);
    }
    return el;
  }

  /* ================= Palette ================= */

  renderPalette() {
    const vars = [...new Set([...collectVars(this.ast), ...this.extraVars])].sort();
    const funcs = this.ast.items.filter((i) => i.type === 'func');
    const groups = paletteFor(this.robotType, vars, funcs, this.robot ? this.robot.caps() : null);
    const keepScroll = this.fly.scrollTop;
    clear(this.rail); clear(this.fly);
    this.palInfo = new Map();
    this.headers = {};
    for (const g of groups) {
      const b = h('button', h('i', { style: { background: g.cat.color } }), g.cat.name.replace(' & ', ' &\n'));
      b.style.whiteSpace = 'pre-line';
      b.addEventListener('click', () => this.showCategory(g.cat.id));
      b.dataset.cat = g.cat.id;
      this.rail.appendChild(b);
      const hd = h('h4', h('i', { style: { width: '10px', height: '10px', borderRadius: '3px', background: g.cat.color, display: 'inline-block' } }), g.cat.name);
      this.headers[g.cat.id] = hd;
      this.fly.appendChild(hd);
      if (g.cat.id === 'variable') {
        const mk = h('button.btn.small.mk', { html: icon('plus') + '<span>Neue Variable</span>' });
        mk.addEventListener('click', async () => { const n = await ask('Neue Variable', 'Wie soll die Variable heißen? (ein Wort, z. B. „punkte“)'); if (n) { this.extraVars.add(n.toLowerCase().replace(/[^\wäöüß]/g, '_')); this.renderPalette(); } });
        this.fly.appendChild(mk);
      }
      if (g.cat.id === 'funktion') {
        const mk = h('button.btn.small.mk', { html: icon('plus') + '<span>Neue Funktion</span>' });
        mk.addEventListener('click', () => this.newFunction());
        this.fly.appendChild(mk);
      }
      for (const it of g.items) {
        const node = it.make();
        const wrap = h('div.pal');
        const el = it.kind === 'expr' ? this.exprEl(node, null, true) : this.blockEl(node, null, -1, null, true);
        wrap.appendChild(el);
        this.palInfo.set(el, it);
        el.title = this.helpFor(node);
        this.fly.appendChild(wrap);
      }
    }
    this.fly.scrollTop = keepScroll;
    if (this.flyClosed) this.fly.classList.add('closed');
  }

  helpFor(n) {
    if (n.type === 'cmd') return CMD_BY_ID[n.cmd].help || '';
    if (n.type === 'rep') return REP_BY_ID[n.rep].help || '';
    return '';
  }

  showCategory(id) {
    this.fly.classList.remove('closed');
    this.flyClosed = false;
    for (const b of this.rail.children) b.classList.toggle('on', b.dataset.cat === id);
    const hd = this.headers[id];
    if (hd) this.fly.scrollTop = hd.offsetTop - 8;
  }

  closeFly() { this.fly.classList.add('closed'); this.flyClosed = true; for (const b of this.rail.children) b.classList.remove('on'); }

  async newFunction() {
    const n = await ask('Neue Funktion', 'Name der Funktion (z. B. „tanzen“). Parameter kannst du später antippen und ergänzen.');
    if (!n) return;
    const name = n.toLowerCase().replace(/[^\wäöüß]/g, '_');
    this.snapshot();
    const f = { type: 'func', id: nid(), name, params: [], body: [] };
    this.ast.items.push(f);
    this.pos.set(f.id, { x: 40, y: this.nextFreeY() });
    this.commit();
    this.showCategory('funktion');
  }

  /* ================= Eingaben im Arbeitsbereich ================= */

  bindWorkspace() {
    const ws = this.ws;
    this.pointers = new Map();
    ws.addEventListener('pointerdown', (e) => this.wsDown(e));
    ws.addEventListener('pointermove', (e) => this.wsMove(e));
    ws.addEventListener('pointerup', (e) => this.wsUp(e));
    ws.addEventListener('pointercancel', (e) => this.wsUp(e, true));
    ws.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) this.zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      else { this.pan.x -= e.deltaX; this.pan.y -= e.deltaY; this.applyTransform(); }
    }, { passive: false });
    ws.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const t = this.targetOf(e.target);
      if (t) this.contextMenu(t, e);
    });
    ws.addEventListener('gesturestart', (e) => e.preventDefault());
    ws.addEventListener('gesturechange', (e) => e.preventDefault());
  }

  bindPalette() {
    this.fly.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.blk, .rep');
      if (!el || !this.palInfo) return;
      let top = el;
      while (top.parentElement && !top.parentElement.classList.contains('pal')) top = top.parentElement;
      const tpl = this.palInfo.get(top);
      if (!tpl) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY, t: performance.now() };
      const rect = top.getBoundingClientRect();
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (Math.hypot(dx, dy) > (e.pointerType === 'touch' ? 8 : 4) && Math.abs(dx) > Math.abs(dy) * 0.6) {
          cleanup();
          const node = tpl.make();
          this.beginDrag({ kind: tpl.kind, nodes: tpl.kind === 'expr' ? null : [node], expr: tpl.kind === 'expr' ? node : null, fromPalette: true }, ev, (start.x - rect.left) / 1, (start.y - rect.top) / 1, true);
        } else if (Math.hypot(dx, dy) > 12) cleanup();
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        cleanup();
        if (performance.now() - start.t < 400 && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) {
          // Antippen in der Palette: Hilfe anzeigen
          const help = this.helpFor(tpl.make());
          if (help) toast(help, '', 3800);
        }
      };
      const cleanup = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }

  targetOf(el) {
    const slotEl = el.closest('.slot, .w');
    const blockEl = el.closest('.rep, .blk');
    if (!blockEl) return null;
    return { slotEl: slotEl && this.slots.has(slotEl) ? slotEl : null, blockEl, info: this.info.get(blockEl) };
  }

  wsDown(e) {
    if (this.drag) return;
    const t = this.targetOf(e.target);
    if (t && t.info && this.pointers.size === 0) {
      e.preventDefault();
      this.ws.setPointerCapture(e.pointerId);
      const press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), target: t, type: e.pointerType };
      this.press = press;
      press.timer = setTimeout(() => {
        if (this.press === press && !this.drag) { this.press = null; this.contextMenu(t, e); }
      }, 550);
      return;
    }
    // Hintergrund: verschieben / zoomen
    this.ws.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.scale, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
    if (!this.flyClosed && this.pointers.size === 1) this.closeFly();
  }

  wsMove(e) {
    if (this.drag) return;
    const pr = this.press;
    if (pr && pr.id === e.pointerId) {
      const d = Math.hypot(e.clientX - pr.x, e.clientY - pr.y);
      if (d > (pr.type === 'touch' ? 8 : 4)) {
        clearTimeout(pr.timer);
        this.press = null;
        this.startDragFrom(pr.target, e, pr);
      }
      return;
    }
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (this.pointers.size === 1) {
      this.pan.x += e.clientX - p.x; this.pan.y += e.clientY - p.y;
      this.applyTransform();
    } else if (this.pinch) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.pan.x += mx - this.pinch.mx; this.pan.y += my - this.pinch.my;
      this.pinch.mx = mx; this.pinch.my = my;
      this.zoomAt((this.pinch.s * d / this.pinch.d) / this.scale, mx, my);
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
  }

  wsUp(e, cancel) {
    const pr = this.press;
    if (pr && pr.id === e.pointerId) {
      clearTimeout(pr.timer);
      this.press = null;
      if (!cancel && performance.now() - pr.t < 500) this.tap(pr.target, e);
      return;
    }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
  }

  zoomBy(f) {
    const r = this.ws.getBoundingClientRect();
    this.zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
  }
  zoomAt(f, cx, cy) {
    const r = this.ws.getBoundingClientRect();
    const ns = clamp(this.scale * f, 0.45, 1.8);
    const k = ns / this.scale;
    const lx = cx - r.left, ly = cy - r.top;
    this.pan.x = lx - (lx - this.pan.x) * k;
    this.pan.y = ly - (ly - this.pan.y) * k;
    this.scale = ns;
    this.applyTransform();
  }

  // Stapel ordentlich untereinander anordnen
  tidy() {
    let y = 20;
    const stacks = [...this.canvas.children];
    for (const st of stacks) {
      const id = st.dataset.item;
      this.pos.set(id, { x: 24, y });
      y += st.offsetHeight + 28;
    }
    this.pan = { x: 20, y: 20 };
    this.scale = 1;
    this.doc.layout = this.layoutArray();
    this.render();
    this.opts.onChange && this.opts.onChange('layout');
  }

  /* ================= Antippen ================= */

  tap(t, e) {
    const s = t.slotEl ? this.slots.get(t.slotEl) : null;
    if (s) { this.editSlot(t.slotEl, s); return; }
    // Baustein antippen → diesen Stapel ausprobieren
    const info = t.info;
    let item = info.item || (info.kind === 'hat' ? info.node : null);
    if (!item && info.kind === 'expr') {
      // Melder antippen: Wert anzeigen
      this.opts.onPeek && this.opts.onPeek(info.expr, t.blockEl);
      return;
    }
    if (item && this.opts.onTry) {
      this.opts.onTry(item);
      t.blockEl.animate([{ filter: 'brightness(1.6)' }, { filter: 'none' }], { duration: 400 });
    }
    void e;
  }

  /* ================= Ziehen ================= */

  startDragFrom(t, e, pr) {
    const info = t.info;
    const rect = t.blockEl.getBoundingClientRect();
    const offX = (pr.x - rect.left) / this.scale, offY = (pr.y - rect.top) / this.scale;
    this.snapshot();
    if (info.kind === 'hat') {
      // ganzen Stapel verschieben
      this.beginDrag({ kind: 'item', item: info.node }, e, offX, offY);
      return;
    }
    if (info.kind === 'expr') {
      const s = info.slot;
      // Lücke wieder mit einem Standardwert füllen
      s.obj[s.key] = s.type === 'num' ? num(0) : s.type === 'bool' ? hole() : hole();
      this.beginDrag({ kind: 'expr', expr: info.expr }, e, offX, offY);
      return;
    }
    // Anweisung: sie und alle darunter mitnehmen
    const list = info.list;
    const nodes = list.splice(info.index);
    this.beginDrag({ kind: 'stmt', nodes, fromItem: info.item }, e, offX, offY);
  }

  beginDrag(d, e, offX, offY, fromPalette = false) {
    closePop();
    this.drag = { ...d, offX, offY, fromPalette, pointerId: e.pointerId };
    if (d.kind === 'item') {
      this.render();
      const st = [...this.canvas.children].find((x) => x.dataset.item === d.item.id);
      if (st) st.style.visibility = 'hidden';
    } else this.render();
    // Geist-Element
    const layer = h('div.drag-layer');
    let ghost;
    if (d.kind === 'expr') ghost = this.exprEl(d.expr, null, true);
    else if (d.kind === 'item') ghost = this.itemGhost(d.item);
    else {
      ghost = h('div');
      for (const n of d.nodes) ghost.appendChild(this.blockEl(n, null, -1, null, true));
      // Körper der Kopie füllen
      ghost.querySelectorAll('.body').forEach((b) => b.classList.remove('empty'));
    }
    ghost.classList && ghost.classList.add('dragging');
    layer.appendChild(ghost);
    layer.style.transform = `scale(${this.scale})`;
    document.body.appendChild(layer);
    this.drag.layer = layer;
    this.drag.ghost = ghost;
    this.trash.classList.add('on');
    this.closeFly();
    this.marker = h('div.insert-line');
    this.marker.style.display = 'none';
    this.ws.appendChild(this.marker);
    this.collectTargets();
    const move = (ev) => { if (ev.pointerId === this.drag.pointerId) this.dragMove(ev); };
    const up = (ev) => {
      if (ev.pointerId !== this.drag.pointerId) return;
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      this.dragEnd(ev);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    this.dragMove(e);
  }

  itemGhost(item) {
    const g = this.itemEl(item);
    // Registrierungen der Kopie wieder entfernen
    return g;
  }

  collectTargets() {
    const d = this.drag;
    this.targets = [];
    if (d.kind === 'stmt' || (d.kind === 'item' && d.item.type === 'ablage')) {
      for (const L of this.lists) {
        const kids = [...L.el.children].filter((c) => c.classList.contains('blk'));
        if (d.kind === 'item' && L.item === d.item) continue;
        for (let i = 0; i <= kids.length; i++) {
          let x, y;
          if (i < kids.length) { const r = kids[i].getBoundingClientRect(); x = r.left; y = r.top; }
          else if (kids.length) { const r = kids[kids.length - 1].getBoundingClientRect(); x = r.left; y = r.bottom; }
          else { const r = L.el.getBoundingClientRect(); x = r.left; y = r.top + 2; }
          this.targets.push({ list: L.list, index: i, x, y, item: L.item });
        }
      }
    }
    this.slotTargets = [];
    if (d.kind === 'expr') {
      for (const [el, s] of this.slots) {
        if (s.kind !== 'slot' || ['joint', 'dir', 'hand', 'side', 'axis', 'var', 'param', 'key', 'msg', 'note'].includes(s.type)) continue;
        this.slotTargets.push({ el, s });
      }
    }
  }

  dragMove(e) {
    const d = this.drag;
    const gx = e.clientX - d.offX * this.scale, gy = e.clientY - d.offY * this.scale;
    d.layer.style.left = gx + 'px';
    d.layer.style.top = gy + 'px';
    d.gx = gx; d.gy = gy; d.cx = e.clientX; d.cy = e.clientY;
    // Mülleimer?
    const br = this.bx.getBoundingClientRect();
    const overTrash = e.clientX < br.left + 320 && e.clientX >= br.left && e.clientY > br.top && e.clientY < br.bottom && !d.fromPalette;
    const overPal = e.clientX < br.left + 70;
    d.trash = overTrash || (d.fromPalette && overPal);
    this.trash.classList.toggle('hot', d.trash);
    d.target = null;
    if (this.hotSlot) { this.hotSlot.classList.remove('hot'); this.hotSlot = null; }
    this.marker.style.display = 'none';
    if (d.trash) return;
    if (d.kind === 'expr') {
      let best = null, bestArea = Infinity;
      for (const t of this.slotTargets) {
        const r = t.el.getBoundingClientRect();
        if (e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 10 && e.clientY <= r.bottom + 10) {
          const a = r.width * r.height;
          if (a < bestArea) { bestArea = a; best = t; }
        }
      }
      if (best) { best.el.classList.add('hot'); this.hotSlot = best.el; d.target = best; }
      return;
    }
    if (this.targets && this.targets.length) {
      let best = null, bd = 56;
      for (const t of this.targets) {
        const dist = Math.hypot(t.x - gx, (t.y - gy) * 1.3);
        if (dist < bd) { bd = dist; best = t; }
      }
      if (best) {
        d.target = best;
        const wr = this.ws.getBoundingClientRect();
        this.marker.style.display = '';
        this.marker.style.left = best.x - wr.left + 'px';
        this.marker.style.top = best.y - wr.top - 3 + 'px';
        this.marker.style.width = 120 * this.scale + 'px';
      }
    }
  }

  dragEnd() {
    const d = this.drag;
    this.drag = null;
    d.layer.remove();
    this.trash.classList.remove('on', 'hot');
    if (this.marker) this.marker.remove();
    if (this.hotSlot) this.hotSlot.classList.remove('hot');
    const wr = this.ws.getBoundingClientRect();
    const toCanvas = (x, y) => ({ x: (x - wr.left - this.pan.x) / this.scale, y: (y - wr.top - this.pan.y) / this.scale });
    const insideWs = d.cx > wr.left && d.cx < wr.right && d.cy > wr.top && d.cy < wr.bottom;
    if (d.trash || (!insideWs && !d.target)) {
      if (d.kind === 'item') this.ast.items = this.ast.items.filter((x) => x !== d.item);
      if (!d.fromPalette) this.opts.audio && this.opts.audio.click();
      this.commit();
      return;
    }
    if (d.kind === 'expr') {
      if (d.target) { const s = d.target.s; s.obj[s.key] = d.expr; this.opts.audio && this.opts.audio.snap(); }
      else toast('Werte-Bausteine gehören in eine Lücke eines anderen Bausteins.');
      this.commit();
      return;
    }
    if (d.kind === 'item') {
      if (d.item.type === 'ablage' && d.target) {
        this.ast.items = this.ast.items.filter((x) => x !== d.item);
        d.target.list.splice(d.target.index, 0, ...d.item.body);
        this.opts.audio && this.opts.audio.snap();
      } else {
        this.pos.set(d.item.id, toCanvas(d.gx, d.gy));
        if (!this.ast.items.includes(d.item)) this.ast.items.push(d.item);
      }
      this.commit();
      return;
    }
    // Anweisungen
    const nodes = d.nodes;
    if (d.target) {
      d.target.list.splice(d.target.index, 0, ...nodes);
      this.opts.audio && this.opts.audio.snap();
    } else if (nodes.length === 1 && nodes[0].type === 'event') {
      const it = nodes[0];
      this.ast.items.push(it);
      this.pos.set(it.id, toCanvas(d.gx, d.gy));
    } else {
      const it = { type: 'ablage', id: nid(), body: nodes };
      this.ast.items.push(it);
      this.pos.set(it.id, toCanvas(d.gx, d.gy));
    }
    this.commit();
  }

  /* ================= Lücken bearbeiten ================= */

  editSlot(el, s) {
    const commit = () => { this.commit(); };
    if (s.kind === 'op') {
      const ops = ['+', '-', '*', '/', '%', '^'].includes(s.node.op) ? ['+', '-', '*', '/', '%', '^'] : ['und', 'oder'].includes(s.node.op) ? ['und', 'oder'] : ['<', '>', '<=', '>=', '==', '!='];
      menu(el, ops.map((o) => ({ label: OP_LABEL[o] + (o === '%' ? ' (Rest beim Teilen)' : ''), on: o === s.node.op, run: () => { this.snapshot(); s.node.op = o; commit(); } })));
      return;
    }
    if (s.kind === 'fname') {
      menu(el, [
        { label: 'Parameter hinzufügen', icon: 'plus', run: async () => { const n = await ask('Parameter', 'Name des neuen Parameters:'); if (n) { this.snapshot(); s.node.params.push(n.toLowerCase().replace(/[^\wäöüß]/g, '_')); this.fixCalls(s.node); commit(); } } },
        { label: 'Umbenennen', icon: 'pencil', run: async () => { const n = await ask('Funktion umbenennen', 'Neuer Name:', s.node.name); if (n) { this.snapshot(); this.renameFunc(s.node, n.toLowerCase().replace(/[^\wäöüß]/g, '_')); commit(); } } },
      ]);
      return;
    }
    if (s.kind === 'listAdd') { this.snapshot(); s.node.items.push(num(0)); commit(); return; }
    if (s.kind === 'listDel') { if (s.node.items.length) { this.snapshot(); s.node.items.pop(); commit(); } return; }
    const v = s.obj[s.key];
    switch (s.type) {
      case 'joint': {
        const r = this.robot;
        const names = r ? r.jointNames() : [];
        menu(el, names.map((n) => ({ label: n, hint: r.servos.get(n).label, on: n === v, run: () => { this.snapshot(); s.obj[s.key] = n; commit(); } })));
        return;
      }
      case 'dir': case 'hand': case 'side': case 'axis':
        menu(el, ENUMS[s.type].map((o) => ({ label: o, on: o === v, run: () => { this.snapshot(); s.obj[s.key] = o; commit(); } })));
        return;
      case 'var': {
        const vars = [...new Set([...collectVars(this.ast), ...this.extraVars])].sort();
        menu(el, [...vars.map((n) => ({ label: n, on: n === v, run: () => { this.snapshot(); s.obj[s.key] = n; commit(); } })), '-', { label: 'Neue Variable …', icon: 'plus', run: async () => { const n = await ask('Neue Variable', 'Name:'); if (n) { this.snapshot(); s.obj[s.key] = n.toLowerCase().replace(/[^\wäöüß]/g, '_'); commit(); } } }]);
        return;
      }
      case 'key':
        menu(el, KEYS.slice(0, 12).concat(['w', 'a', 's', 'd']).filter((k, i, a) => a.indexOf(k) === i).map((k) => ({ label: KEY_LABEL[k] || k.toUpperCase(), on: k === v, run: () => { this.snapshot(); s.obj[s.key] = k; commit(); } })));
        return;
      case 'msg': case 'param': case 'note':
        this.textInput(el, v || '', (t) => { this.snapshot(); s.obj[s.key] = s.type === 'param' ? t.toLowerCase().replace(/[^\wäöüß]/g, '_') : t; commit(); });
        return;
      default: break;
    }
    // Ausdrucks-Lücken
    if (!v || v.type === 'hole') {
      if (s.type === 'num') { this.snapshot(); s.obj[s.key] = num(0); this.commit(); return; }
      menu(el, [
        { label: 'Zahl', run: () => { this.snapshot(); s.obj[s.key] = num(0); commit(); } },
        { label: 'Text', run: () => { this.snapshot(); s.obj[s.key] = { type: 'str', id: nid(), v: '' }; commit(); } },
        { label: 'wahr', run: () => { this.snapshot(); s.obj[s.key] = { type: 'const', id: nid(), v: 'wahr' }; commit(); } },
        { label: 'falsch', run: () => { this.snapshot(); s.obj[s.key] = { type: 'const', id: nid(), v: 'falsch' }; commit(); } },
        '-', { label: 'Tipp: Ziehe einen Sensor- oder Rechen-Baustein hier hinein.', run: () => {} },
      ]);
      return;
    }
    if (v.type === 'num') { this.keypad(el, v, s); return; }
    if (v.type === 'str') {
      this.textInput(el, v.v, (t) => { this.snapshot(); v.v = t; commit(); });
      return;
    }
    if (v.type === 'color') {
      menu(el, [...COLOR_NAMES.map((c) => ({ label: c, swatch: COLORS[c], on: c === v.v, run: () => { this.snapshot(); v.v = c; commit(); } })), '-',
        { label: 'Text statt Farbe', run: () => { this.snapshot(); s.obj[s.key] = { type: 'str', id: nid(), v: v.v }; commit(); } }]);
      return;
    }
    if (v.type === 'const') {
      menu(el, ['wahr', 'falsch', 'nichts'].map((c) => ({ label: c, on: c === v.v, run: () => { this.snapshot(); v.v = c; commit(); } })));
    }
  }

  textInput(anchor, value, done) {
    const inp = h('input', { type: 'text', value, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', style: { width: '240px', height: '44px', borderRadius: '10px', border: '1px solid var(--line-2)', background: 'var(--bg-2)', padding: '0 12px', fontSize: '16px', userSelect: 'text', webkitUserSelect: 'text' } });
    const box = h('div', { style: { display: 'flex', gap: '6px' } }, inp);
    const ok = h('button.btn.primary', 'OK');
    box.appendChild(ok);
    let finished = false;
    const fin = () => { if (finished) return; finished = true; const v = inp.value; closePop(); done(v); };
    ok.addEventListener('click', fin);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fin(); } if (e.key === 'Escape') { finished = true; closePop(); } });
    popover(anchor, box);
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }

  keypad(anchor, node, s) {
    // Der erste Tastendruck ersetzt den alten Wert; OK ohne Eingabe lässt ihn stehen
    let text = '';
    const unit = s.unit || '';
    const ranges = { '°': [-180, 180, 1, [-90, -45, 0, 45, 90, 180]], '%': [0, 100, 1, [10, 25, 50, 75, 100]], cm: [0, 300, 1, [10, 20, 50, 100, 150]], s: [0, 10, 0.1, [0.2, 0.5, 1, 2, 5]] };
    const rg = ranges[unit];
    const box = h('div.keypad');
    const disp = h('div.disp');
    let slider = null;
    const render = () => {
      clear(disp);
      disp.append(h('span', { style: { opacity: text ? 1 : 0.45 } }, text || formatNum({ v: node.v })), unit ? h('span.u', unit) : null);
      if (slider && text && isFinite(parseFloat(text))) slider.value = parseFloat(text);
    };
    box.appendChild(disp);
    if (rg) {
      slider = h('input', { type: 'range', min: rg[0], max: rg[1], step: rg[2], value: node.v, 'aria-label': 'Wert' });
      slider.addEventListener('input', () => { text = String(slider.value); render(); });
      box.appendChild(slider);
      const pre = h('div.presets');
      for (const p of rg[3]) { const b = h('button', String(p)); b.addEventListener('click', () => { text = String(p); render(); }); pre.appendChild(b); }
      box.appendChild(pre);
    }
    const keys = h('div.keys');
    const finish = () => {
      removeEventListener('keydown', kb, true);
      closePop();
      if (!text) return;
      const v = parseFloat(text);
      if (isFinite(v)) { this.snapshot(); node.v = v; node.raw = fmtNumber(v); this.commit(); }
    };
    const press = (k) => {
      if (k === 'OK') { finish(); return; }
      if (k === '⌫') text = text.slice(0, -1);
      else if (k === '±') text = text.startsWith('-') ? text.slice(1) : '-' + (text || String(node.v).replace('-', ''));
      else if (k === '.') { if (!text.includes('.')) text = (text || '0') + '.'; }
      else text = text === '0' ? k : text + k;
      if (text.replace('-', '').length > 9) text = text.slice(0, 9);
      render();
    };
    for (const k of ['7', '8', '9', '⌫', '4', '5', '6', 'OK', '1', '2', '3', '0', '±', '.']) {
      const b = h('button' + (k === 'OK' ? '.ok' : k === '⌫' || k === '±' ? '.fn' : ''), k);
      b.addEventListener('click', () => press(k));
      keys.appendChild(b);
    }
    box.appendChild(keys);
    const kb = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === '.' || e.key === ',') press('.');
      else if (e.key === '-') press('±');
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') finish();
      else if (e.key === 'Escape') { removeEventListener('keydown', kb, true); closePop(); }
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    addEventListener('keydown', kb, true);
    popover(anchor, box, { onClose: () => removeEventListener('keydown', kb, true) });
    render();
  }

  /* ================= Kontextmenü ================= */

  contextMenu(t, e) {
    const info = t.info;
    if (!info) return;
    const anchor = { left: e.clientX, top: e.clientY, width: 0, height: 0, bottom: e.clientY };
    const items = [];
    if (info.kind === 'expr') {
      items.push({ label: 'Löschen', icon: 'trash', danger: true, run: () => { this.snapshot(); info.slot.obj[info.slot.key] = info.slot.type === 'num' ? num(0) : hole(); this.commit(); } });
    } else {
      items.push({ label: 'Duplizieren', icon: 'copy', run: () => this.duplicate(info) });
      if (info.kind === 'stmt' && info.item && info.item.type !== 'ablage') items.push({ label: 'Ablegen (nicht ausführen)', icon: 'pause', run: () => this.park(info) });
      items.push({ label: 'Löschen', icon: 'trash', danger: true, run: () => this.remove(info) });
      const help = info.node ? this.helpFor(info.node) : '';
      if (help) items.push('-', { label: 'Was macht das?', icon: 'help', run: () => toast(help, '', 5000) });
    }
    menu(anchor, items);
  }

  duplicate(info) {
    this.snapshot();
    if (info.kind === 'hat') {
      const c = cloneNode(info.node);
      this.ast.items.push(c);
      const p = this.pos.get(info.node.id) || { x: 20, y: 20 };
      this.pos.set(c.id, { x: p.x + 30, y: p.y + 30 });
    } else {
      const nodes = cloneNode(info.list.slice(info.index, info.index + 1));
      const it = { type: 'ablage', id: nid(), body: nodes };
      this.ast.items.push(it);
      const r = this.byId.get(info.node.id).getBoundingClientRect();
      const wr = this.ws.getBoundingClientRect();
      this.pos.set(it.id, { x: (r.left - wr.left - this.pan.x) / this.scale + 30, y: (r.top - wr.top - this.pan.y) / this.scale + 30 });
    }
    this.commit();
  }

  park(info) {
    this.snapshot();
    const nodes = info.list.splice(info.index);
    const it = { type: 'ablage', id: nid(), body: nodes };
    this.ast.items.push(it);
    const r = this.byId.get(info.node.id);
    const wr = this.ws.getBoundingClientRect();
    const rr = r ? r.getBoundingClientRect() : wr;
    this.pos.set(it.id, { x: (rr.left - wr.left - this.pan.x) / this.scale + 40, y: (rr.top - wr.top - this.pan.y) / this.scale + 10 });
    this.commit();
  }

  remove(info) {
    this.snapshot();
    if (info.kind === 'hat') this.ast.items = this.ast.items.filter((x) => x !== info.node);
    else info.list.splice(info.index, 1);
    this.commit();
  }

  fixCalls(f) {
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if ((o.type === 'call' || o.type === 'callstmt') && o.name === f.name) while (o.args.length < f.params.length) o.args.push(num(0));
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
    };
    walk(this.ast);
  }
  renameFunc(f, name) {
    const old = f.name;
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      if ((o.type === 'call' || o.type === 'callstmt') && o.name === old) o.name = name;
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
    };
    walk(this.ast);
    f.name = name;
  }

  /* ================= Ausführung sichtbar machen ================= */

  setActive(ids, force) {
    if (!force && this.active && sameSet(ids, this.active)) return;
    if (this.activeEls) for (const el of this.activeEls) el.classList.remove('running');
    this.active = ids;
    this.activeEls = [];
    if (!ids) return;
    for (const id of ids) {
      const el = this.byId && this.byId.get(id);
      if (el) { el.classList.add('running'); this.activeEls.push(el); }
    }
  }

  setError(nodeId) {
    if (this.errEl) this.errEl.classList.remove('error');
    this.errEl = null;
    if (!nodeId) return;
    const el = this.byId && this.byId.get(nodeId);
    if (el) {
      el.classList.add('error');
      this.errEl = el;
      // ins Bild holen
      const r = el.getBoundingClientRect(), wr = this.ws.getBoundingClientRect();
      if (r.top < wr.top || r.bottom > wr.bottom || r.left < wr.left || r.right > wr.right) {
        this.pan.x += wr.left + wr.width / 2 - (r.left + r.width / 2);
        this.pan.y += wr.top + wr.height / 3 - r.top;
        this.applyTransform();
      }
    }
  }
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function formatNum(n) {
  if (n.raw != null && parseFloat(n.raw) === n.v) return n.raw + (n.unit ? (n.unit === '°' || n.unit === '%' ? n.unit : ' ' + n.unit) : '');
  return fmtNumber(n.v) + (n.unit ? (n.unit === '°' || n.unit === '%' ? n.unit : ' ' + n.unit) : '');
}
