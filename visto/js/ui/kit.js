/* VistoOS · ui/kit.js — Bausteine für eine runde Oberfläche
 *
 *  V.ui.arcText({text, r, side:'top'|'bottom', at, size, weight, color, spacing, font, cls})  → {el, set(text)}
 *  V.ui.arcPath(cx, cy, r, a0, a1)                         SVG-Pfad eines Bogens (Uhrwinkel)
 *  V.ui.fitText(container, text, {top, bottom, size, minSize, weight, lh, margin, cls, words})
 *        Text so umbrechen, dass jede Zeile die Kreisbreite auf ihrer Höhe nutzt
 *  V.ui.roundList({items:[{icon, color, title, sub, end, onClick}], header, onCrown}) → {el, scroller, refresh(), setItems()}
 *  V.ui.wheel({items, index, onChange, rows: 5, itemH: 14, size: 9}) → {el, get(), set(i), crown(d)}
 *  V.ui.button(text, {icon, kind:'primary'|'white'|'danger'|'ghost', size:'sm', onClick}) → Element
 *  V.ui.roundButton(icon, {kind, size:'lg'|'sm', onClick, label})
 *  V.ui.tap(el, fn)                                       Antippen mit Klang, Haptik und Druckeffekt
 *  V.ui.title(root, 'TIMER')                               geschwungener App-Titel oben
 *  V.ui.rimDrag(el, {start(p), drag(p, dA), end(p), minR: 300})   Drehen am Rand
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const ui = (V.ui = {});

  /* ------------------------------------------------------- Text am Bogen */
  ui.arcPath = function (cx, cy, r, a0, a1) {
    const p0 = { x: cx + Math.sin(U.rad(a0)) * r, y: cy - Math.cos(U.rad(a0)) * r };
    const p1 = { x: cx + Math.sin(U.rad(a1)) * r, y: cy - Math.cos(U.rad(a1)) * r };
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  };

  ui.arcText = function (o) {
    const side = o.side || 'top';
    const size = o.size || 30;
    const at = o.at !== undefined ? o.at : side === 'top' ? 0 : 180;
    const rc = o.r || 430;
    // Grundlinie so legen, dass die Schrift mittig auf rc sitzt
    const r = side === 'top' ? rc - size * 0.36 : rc + size * 0.36;
    const id = U.uid('arc');
    const d = side === 'top' ? ui.arcPath(500, 500, r, at - 175, at + 175) : ui.arcPath(500, 500, r, at + 175, at - 175);
    const svg = U.svg('svg', { class: 'vos-svg ' + (o.cls || ''), viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    const path = U.svg('path', { id, d, fill: 'none', stroke: 'none' });
    const text = U.svg('text', {
      'font-size': size,
      'font-weight': o.weight || 650,
      'letter-spacing': o.spacing !== undefined ? o.spacing : size * 0.14,
      fill: o.color || 'rgba(255,255,255,.62)',
      'font-family': o.font || "'Inter Tight', system-ui, sans-serif",
    });
    const tp = U.svg('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' });
    tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
    tp.textContent = o.upper === false ? o.text || '' : String(o.text || '').toUpperCase();
    text.appendChild(tp);
    svg.append(path, text);
    return {
      el: svg, text, tp,
      set(t) { tp.textContent = o.upper === false ? t : String(t).toUpperCase(); },
    };
  };

  ui.title = function (root, title, o = {}) {
    const t = ui.arcText(Object.assign({ text: title, r: 446, size: 27, weight: 700, spacing: 5, color: 'rgba(255,255,255,.55)' }, o));
    t.el.classList.add('vos-apptitle');
    root.appendChild(t.el);
    return t;
  };

  /* ------------------------------------------- Text in den Kreis setzen */
  const mcv = document.createElement('canvas').getContext('2d');
  function measure(str, size, weight, family) {
    mcv.font = `${weight} ${size}px ${family}`;
    return mcv.measureText(str).width;
  }

  /** Zeilenumbruch nach Kreisbreite. Liefert {lines:[{text, y, w}], size, height} in logischen Einheiten */
  ui.layoutCircle = function (text, o = {}) {
    const top = o.top !== undefined ? o.top : 380, bottom = o.bottom !== undefined ? o.bottom : 820;
    const weight = o.weight || 520, family = o.family || "'Inter Tight', system-ui, sans-serif";
    const margin = o.margin !== undefined ? o.margin : 70;
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    let size = o.size || 46;
    const minSize = o.minSize || 30;
    const lhK = o.lh || 1.24;
    let best = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const lh = size * lhK;
      let y0 = top;
      let lines = [];
      for (let pass = 0; pass < 3; pass++) {
        lines = [];
        let cur = '', y = y0;
        const avail = (yy) => Math.max(120, Math.min(V.display.chord(yy - lh * 0.45), V.display.chord(yy + lh * 0.45)) - margin * 2);
        let i = 0;
        while (i < words.length) {
          const yc = y + lh / 2;
          const maxW = avail(yc);
          const trial = cur ? cur + ' ' + words[i] : words[i];
          if (measure(trial, size, weight, family) <= maxW || !cur) {
            cur = trial; i++;
            if (i === words.length) { lines.push({ text: cur, y: yc }); }
          } else {
            lines.push({ text: cur, y: yc });
            cur = ''; y += lh;
          }
        }
        const H = lines.length * lh;
        const ny0 = top + Math.max(0, (bottom - top - H) / 2);
        if (Math.abs(ny0 - y0) < 2) break;
        y0 = ny0;
      }
      const H = lines.length * lh;
      best = { lines, size, lh, height: H, fits: H <= bottom - top + 1 };
      if (best.fits || size <= minSize) break;
      size = Math.max(minSize, size * 0.9);
    }
    if (!best.fits) {
      // kürzen: so viele Zeilen wie passen, letzte mit …
      const maxLines = Math.max(1, Math.floor((bottom - top) / best.lh));
      if (best.lines.length > maxLines) {
        best.lines = best.lines.slice(0, maxLines);
        const last = best.lines[maxLines - 1];
        last.text = last.text.replace(/\s*\S*$/, '') + ' …';
        best.height = maxLines * best.lh;
      }
    }
    return best;
  };

  /** Text in einen Container setzen (Zeilen absolut, Wörter einzeln animierbar) */
  ui.fitText = function (container, text, o = {}) {
    const L = ui.layoutCircle(text, o);
    container.innerHTML = '';
    const wordEls = [];
    for (const line of L.lines) {
      const div = U.el('div', { class: 'cv-line ' + (o.cls || ''), style: { top: (line.y - L.lh / 2) / 10 + 'cqw', fontSize: L.size / 10 + 'cqw', lineHeight: L.lh / 10 + 'cqw', fontWeight: o.weight || 520 } });
      if (o.words) {
        line.text.split(' ').forEach((w, i) => {
          if (i) div.appendChild(document.createTextNode(' '));
          const s = U.el('span', { class: 'cv-word', text: w });
          div.appendChild(s); wordEls.push(s);
        });
      } else div.textContent = line.text;
      container.appendChild(div);
    }
    return { layout: L, words: wordEls };
  };

  /* ---------------------------------------------------------- Antippen */
  ui.tap = function (el, fn, o = {}) {
    el.addEventListener('click', (e) => {
      if (V.shell && V.shell.swallowClick) return;
      if (o.sound !== false) V.sound.play(o.sound || 'tap');
      V.haptic(6);
      fn(e);
    });
    return el;
  };

  ui.button = function (text, o = {}) {
    const b = U.el('button', { class: 'vos-btn ' + (o.kind || '') + (o.size ? ' ' + o.size : '') + (o.cls ? ' ' + o.cls : ''), attrs: { type: 'button' } });
    if (o.icon) b.insertAdjacentHTML('beforeend', V.icon(o.icon));
    if (text) b.appendChild(U.el('span', { text }));
    if (o.onClick) ui.tap(b, o.onClick, o);
    if (o.style) Object.assign(b.style, o.style);
    return b;
  };
  ui.roundButton = function (icon, o = {}) {
    const b = U.el('button', { class: 'vos-btn vos-round ' + (o.kind || '') + (o.size ? ' ' + o.size : '') + (o.cls ? ' ' + o.cls : ''), attrs: { type: 'button', 'aria-label': o.label || icon } });
    b.innerHTML = V.icon(icon);
    if (o.onClick) ui.tap(b, o.onClick, o);
    if (o.style) Object.assign(b.style, o.style);
    return b;
  };
  ui.icon = function (app, size = '17cqw') {
    const d = U.el('div', { class: 'vos-icon', style: { '--ic': app.color || '#555', width: size, height: size } });
    d.innerHTML = V.icon(app.icon || 'info');
    return d;
  };

  /* ------------------------------------------------------- Runde Liste */
  ui.roundList = function (o = {}) {
    const scroller = U.el('div', { class: 'vos-rlist' });
    const inner = U.el('div');
    scroller.appendChild(inner);
    let rows = [];
    function build(items) {
      inner.innerHTML = '';
      rows = [];
      if (o.header) inner.appendChild(typeof o.header === 'string' ? U.el('div', { class: 'vos-rhead vos-label', text: o.header }) : o.header);
      for (const it of items) {
        if (it.section) { inner.appendChild(U.el('div', { class: 'vos-rhead vos-label', style: { marginTop: '5cqw' }, text: it.section })); continue; }
        if (it.el) { inner.appendChild(it.el); rows.push(it.el); continue; }
        const row = U.el('div', { class: 'vos-rrow' + (it.cls ? ' ' + it.cls : '') });
        if (it.icon) {
          const ic = U.el('div', { class: 'ic', style: it.color ? { background: it.color, color: it.iconColor || '#fff' } : null, html: V.icon(it.icon) });
          row.appendChild(ic);
        }
        const tx = U.el('div', { class: 'tx' }, U.el('b', { text: it.title || '' }), it.sub ? U.el('small', { text: it.sub }) : null);
        row.appendChild(tx);
        if (it.end !== undefined && it.end !== null) {
          const end = typeof it.end === 'object' ? it.end : U.el('div', { class: 'end', text: it.end });
          row.appendChild(end);
        }
        if (it.onClick) ui.tap(row, () => it.onClick(row, it));
        inner.appendChild(row);
        rows.push(row);
      }
      if (o.footer) inner.appendChild(o.footer);
      requestAnimationFrame(refresh);
    }
    let pending = false;
    function refresh() {
      pending = false;
      if (!V.display.el || !scroller.isConnected) return;
      const R = V.display.rect();
      const k = 1000 / R.width;
      for (const r of rows) {
        const b = r.getBoundingClientRect();
        const yc = (b.top + b.height / 2 - R.top) * k;
        const dy = Math.abs(yc - 500);
        const chord = V.display.chord(yc);
        const need = (r.offsetWidth * k) + 40;
        let s = U.clamp(chord / need, 0.45, 1);
        s = s * s * (3 - 2 * s) * 0.15 + s * 0.85;
        const op = 1 - U.smoothstep(380, 500, dy) * 0.9;
        r.style.transform = `scale(${s.toFixed(3)})`;
        if (!o.keepOpacity) r.style.opacity = op.toFixed(3);
      }
    }
    scroller.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(refresh); } }, { passive: true });
    scroller.setAttribute('data-nogesture', 'y');
    build(o.items || []);
    return {
      el: scroller, scroller, inner,
      setItems: build,
      refresh,
      crown(dA) { scroller.scrollTop += dA * 3.2; },
      scrollTo(y) { scroller.scrollTop = y; },
    };
  };

  /* --------------------------------------------------- Auswahlrad */
  ui.wheel = function (o) {
    const items = o.items.slice();
    const rowsVis = o.rows || 5;
    const itemH = o.itemH || 14;      // cqw
    const size = o.size || 9;          // cqw
    const el = U.el('div', { class: 'vos-wheel', style: { position: 'relative', height: itemH * rowsVis + 'cqw', width: o.width || '30cqw', overflow: 'hidden', touchAction: 'none', cursor: 'grab' }, attrs: { 'data-nogesture': 'y' } });
    const strip = U.el('div', { style: { position: 'absolute', left: 0, right: 0, top: 0 } });
    el.appendChild(strip);
    const cells = items.map((t) => {
      const c = U.el('div', { style: { height: itemH + 'cqw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size + 'cqw', fontWeight: o.weight || 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', willChange: 'transform, opacity' }, text: String(t) });
      strip.appendChild(c);
      return c;
    });
    let idx = U.clamp(o.index || 0, 0, items.length - 1);
    const pos = V.spring(idx, { response: 0.35, bounce: 0.05 });
    const loopMode = !!o.loop;
    function render(v) {
      const off = (rowsVis - 1) / 2;
      strip.style.transform = `translateY(${(off - v) * itemH}cqw)`;
      for (let i = 0; i < cells.length; i++) {
        const d = Math.abs(i - v);
        if (d > rowsVis) { cells[i].style.opacity = 0; continue; }
        const s = 1 - Math.min(1, d / (rowsVis / 2 + 0.5)) * 0.42;
        cells[i].style.opacity = (1 - Math.min(1, d / (rowsVis / 2 + 0.3)) * 0.85).toFixed(3);
        cells[i].style.transform = `scale(${s.toFixed(3)})`;
        cells[i].style.color = d < 0.5 ? (o.activeColor || '#fff') : 'rgba(255,255,255,.9)';
      }
    }
    pos.onUpdate(render);
    render(idx);
    function settle(target) {
      target = loopMode ? U.wrap(Math.round(target), items.length) : U.clamp(Math.round(target), 0, items.length - 1);
      if (target !== idx) { idx = target; V.sound.play('tick'); V.haptic(4); if (o.onChange) o.onChange(idx, items[idx]); }
      pos.to(idx);
    }
    let startV = 0, lastTick = idx;
    V.gesture(el, {
      start() { startV = pos.value; pos.stop(); lastTick = Math.round(pos.value); },
      move(p) {
        const pxPerItem = itemH * 10;
        let v = startV - p.dy / pxPerItem;
        if (!loopMode) v = v < 0 ? v * 0.3 : v > items.length - 1 ? items.length - 1 + (v - items.length + 1) * 0.3 : v;
        pos.set(v);
        const r = Math.round(v);
        if (r !== lastTick) { lastTick = r; V.sound.play('tick'); }
      },
      end(p) {
        const pxPerItem = itemH * 10;
        const proj = pos.value - (p.vy / pxPerItem) * 0.18;
        settle(proj);
      },
    }, { slop: 4 });
    return {
      el,
      get: () => idx,
      value: () => items[idx],
      set(i, animate = true) { idx = U.clamp(i, 0, items.length - 1); if (animate) pos.to(idx); else pos.set(idx); },
      crown(dA) { settle(idx + Math.sign(dA)); },
    };
  };

  /* ------------------------------------------------- Drehen am Rand */
  ui.rimDrag = function (el, h, o = {}) {
    const minR = o.minR !== undefined ? o.minR : 300;
    let on = false;
    el.setAttribute('data-nogesture', 'all');
    return V.gesture(el, {
      start(p) { on = p.r0 >= minR; if (on && h.start) h.start(p); },
      move(p) { if (on && h.drag) h.drag(p, p.dA); },
      end(p) { if (on && h.end) h.end(p); on = false; },
      tap(p) { if (h.tap) h.tap(p); },
    }, { slop: 2 });
  };
})();
