/* VistoOS · core/base.js — Namensraum V, Hilfsfunktionen, Ereignisbus */
'use strict';
(function () {
  const V = (window.V = window.V || {});
  V.version = '2.0';
  V.build = '26.11';
  V.device = { name: 'Visto', model: 'V1', display: '7″ OLED · rund · 1080 × 1080 · 90 Hz' };

  const TAU = Math.PI * 2;
  const rgbCache = new Map();

  const U = (V.util = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    remap(v, a, b, c, d, clamp) {
      let t = (v - a) / (b - a);
      if (clamp) t = t < 0 ? 0 : t > 1 ? 1 : t;
      return c + (d - c) * t;
    },
    smoothstep(a, b, v) {
      const t = U.clamp((v - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    wrap: (v, m) => ((v % m) + m) % m,
    /** kürzeste Winkeldifferenz in Grad (b − a), −180…180 */
    angDiff(a, b) {
      let d = (b - a) % 360;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return d;
    },
    rad: (d) => (d * Math.PI) / 180,
    deg: (r) => (r * 180) / Math.PI,
    pad: (n, l = 2) => String(n).padStart(l, '0'),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    uid: (() => { let n = 0; return (p = 'v') => p + (++n).toString(36) + Math.random().toString(36).slice(2, 6); })(),

    /** deterministischer Zufall */
    rng(seed) {
      let a = typeof seed === 'string' ? U.hash(seed) : seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    },
    /** glattes 1D-Rauschen −1…1 */
    noise(x, seed = 0) {
      const i = Math.floor(x), f = x - i;
      const g = (n) => { const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
      const a = g(i), b = g(i + 1);
      const u = f * f * (3 - 2 * f);
      return a * (1 - u) + b * u;
    },

    /* Farben */
    hexToRgb(hex) {
      // Zwischenspeicher: wird pro Bild sehr oft mit denselben Farben aufgerufen (Verläufe, Leuchten)
      const hit = rgbCache.get(hex);
      if (hit) return hit;
      let h = String(hex).replace('#', '');
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      const n = parseInt(h, 16);
      const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      if (rgbCache.size > 600) rgbCache.clear();
      rgbCache.set(hex, out);
      return out;
    },
    rgbToHex: (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''),
    rgba(hex, a) { const [r, g, b] = U.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; },
    mix(h1, h2, t) {
      const a = U.hexToRgb(h1), b = U.hexToRgb(h2);
      return U.rgbToHex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
    },
    lighten: (hex, t) => U.mix(hex, '#ffffff', t),
    darken: (hex, t) => U.mix(hex, '#000000', t),
    /** relative Helligkeit 0…1 */
    luma(hex) { const [r, g, b] = U.hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; },
    hsl(h, s, l) {
      h = U.wrap(h, 360) / 360; s /= 100; l /= 100;
      const f = (n) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      return U.rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
    },

    /* DOM */
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
    /**
     * el('div', {class:'a b', style:{...}|'css', text, html, attrs:{}, data:{}, on:{click}}, ...kinder)
     */
    el(tag, props, ...children) {
      const n = document.createElement(tag);
      if (props) applyProps(n, props);
      appendKids(n, children);
      return n;
    },
    svg(tag, attrs, ...children) {
      const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
      if (attrs) for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') n.setAttribute('class', v);
        else if (k === 'text') n.textContent = v;
        else if (k === 'on') for (const e in v) n.addEventListener(e, v[e]);
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else n.setAttribute(k, v);
      }
      appendKids(n, children);
      return n;
    },
    /** SVG-Markup als Element (z. B. Symbole) */
    frag(html) {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    listen(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); return () => el.removeEventListener(ev, fn, opts); },
    debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; },
    clone: (o) => (o === undefined ? o : JSON.parse(JSON.stringify(o))),
  });

  function applyProps(n, p) {
    for (const k in p) {
      const v = p[k];
      if (v === undefined || v === null || v === false) continue;
      switch (k) {
        case 'class': n.className = v; break;
        case 'text': n.textContent = v; break;
        case 'html': n.innerHTML = v; break;
        case 'style': if (typeof v === 'string') n.style.cssText = v; else for (const s in v) { if (s.startsWith('--')) n.style.setProperty(s, v[s]); else n.style[s] = v[s]; } break;
        case 'attrs': for (const a in v) if (v[a] !== false && v[a] != null) n.setAttribute(a, v[a]); break;
        case 'data': for (const a in v) n.dataset[a] = v[a]; break;
        case 'on': for (const e in v) n.addEventListener(e, v[e]); break;
        default: n[k] = v;
      }
    }
  }
  function appendKids(n, kids) {
    for (const c of kids) {
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) appendKids(n, c);
      else n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
  }

  /* ---------------------------------------------------------- Ereignisbus */
  const bus = new Map();
  V.on = function (name, fn) {
    if (!bus.has(name)) bus.set(name, new Set());
    bus.get(name).add(fn);
    return () => { const s = bus.get(name); if (s) s.delete(fn); };
  };
  /** Anzahl aller Zuhörer (Leck-Suche) */
  V.on.count = () => { let n = 0; for (const s of bus.values()) n += s.size; return n; };
  V.once = function (name, fn) {
    const off = V.on(name, (d) => { off(); fn(d); });
    return off;
  };
  V.emit = function (name, data) {
    const s = bus.get(name);
    if (!s) return;
    for (const fn of Array.from(s)) {
      try { fn(data); } catch (e) { console.error('[VistoOS] Fehler in', name, e); }
    }
  };

  /** Stile einer Datei einmalig einhängen: V.css('wx', '.wx-temp{…}') */
  const cssDone = new Set();
  V.css = function (id, text) {
    if (cssDone.has(id)) return;
    cssDone.add(id);
    const s = document.createElement('style');
    s.setAttribute('data-vos', id);
    s.textContent = text;
    document.head.appendChild(s);
  };

  /** kleines Protokoll für Fehler, die die Oberfläche nicht stören sollen */
  V.safe = function (fn, label) {
    try { return fn(); } catch (e) { console.error('[VistoOS]', label || '', e); return undefined; }
  };
})();
