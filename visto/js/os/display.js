/* VistoOS · os/display.js — das runde Display mit seinen Ebenen
 *
 *  Ebenen (von unten): stage (Bildschirme) · scrim (Abdunklung) · convo (Visto-Text)
 *                      · overlay (Kontrollzentrum, Hinweise) · fx (Leinwand: Visto, Rand) · top · night · dim
 *  Koordinaten: logisch 0…1000, Mitte (500, 500), Radius 500. 10 Einheiten = 1cqw.
 *
 *  V.display.toLogical(clientX, clientY) → {x, y}
 *  V.display.polar(x, y) → {r, a}   (a: Uhrwinkel 0° oben, im Uhrzeigersinn)
 *  V.display.pt(a, r) → {x, y}
 *  V.display.px(logisch) → CSS-Pixel
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const D = (V.display = {
    el: null, stage: null, scrim: null, convo: null, overlay: null, top: null, fx: null, dim: null, night: null,
    size: 360,
    dpr: 1,
    _rect: null,

    mount(host) {
      const el = U.el('div', { class: 'vos-display', attrs: { role: 'application', 'aria-label': 'Visto-Display' } });
      D.stage = U.el('div', { class: 'vos-stage' });
      D.scrim = U.el('div', { class: 'vos-scrim' });
      D.convo = U.el('div', { class: 'vos-convo' });
      D.overlay = U.el('div', { class: 'vos-overlay' });
      D.fx = U.el('canvas', { class: 'vos-fx' });
      D.top = U.el('div', { class: 'vos-top' });
      D.night = U.el('div', { class: 'vos-night' });
      D.dim = U.el('div', { class: 'vos-dim' });
      el.append(D.stage, D.scrim, D.convo, D.overlay, D.fx, D.top, D.night, D.dim);
      host.appendChild(el);
      D.el = el;
      // Kontextmenü / Doppeltipp-Zoom unterdrücken
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('dblclick', (e) => e.preventDefault());
      el.addEventListener('gesturestart', (e) => e.preventDefault());
      return el;
    },

    resize(px) {
      D.size = px;
      D.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      D._rect = null;
      V.emit('display:resize', { size: px, dpr: D.dpr });
    },

    rect() {
      if (!D._rect) D._rect = D.el.getBoundingClientRect();
      return D._rect;
    },
    invalidate() { D._rect = null; },

    toLogical(cx, cy) {
      const r = D.rect();
      return { x: ((cx - r.left) / r.width) * 1000, y: ((cy - r.top) / r.height) * 1000 };
    },
    toClient(x, y) {
      const r = D.rect();
      return { x: r.left + (x / 1000) * r.width, y: r.top + (y / 1000) * r.height };
    },
    /** Element-Mittelpunkt in logischen Koordinaten */
    centerOf(elm) {
      const b = elm.getBoundingClientRect();
      return D.toLogical(b.left + b.width / 2, b.top + b.height / 2);
    },
    polar(x, y) {
      const dx = x - 500, dy = y - 500;
      return { r: Math.hypot(dx, dy), a: U.wrap(U.deg(Math.atan2(dx, -dy)), 360) };
    },
    pt(a, r) {
      const t = U.rad(a);
      return { x: 500 + Math.sin(t) * r, y: 500 - Math.cos(t) * r };
    },
    /** Breite der Kreissehne auf Höhe y (logisch) */
    chord(y, inset = 0) {
      const R = 500 - inset;
      const d = y - 500;
      return d * d >= R * R ? 0 : 2 * Math.sqrt(R * R - d * d);
    },
    px(logical) { return (logical / 1000) * D.size; },

    /** Abdunklung (0 = hell, 1 = schwarz) */
    setDim(v) { if (D.dim) D.dim.style.opacity = U.clamp(v, 0, 0.97).toFixed(3); },
    setNightTint(v) { if (D.night) D.night.style.opacity = U.clamp(v, 0, 1).toFixed(3); },
    /** Pixelverschiebung gegen Einbrennen (logische Einheiten) */
    shift(dx, dy) { if (D.stage) D.stage.style.transform = dx || dy ? `translate(${dx / 10}cqw, ${dy / 10}cqw)` : ''; },
  });

  window.addEventListener('resize', () => D.invalidate());
  window.addEventListener('scroll', () => D.invalidate(), { passive: true, capture: true });
})();
