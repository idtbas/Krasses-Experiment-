/* KYTHERA · Grundfunktionen */
(function () {
  'use strict';
  const KY = window.KY = window.KY || {};
  const U = KY.U = {};

  /* ---------- Zufall ---------- */
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.rf = (a, b) => a + Math.random() * (b - a);
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.chance = p => Math.random() < p;
  U.gauss = function () {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  U.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  U.weighted = function (items, wf) {
    let tot = 0;
    const ws = items.map(it => { const w = Math.max(0, wf(it)); tot += w; return w; });
    if (tot <= 0) return null;
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };

  /* ---------- Mathematik ---------- */
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sum = arr => arr.reduce((s, x) => s + x, 0);
  U.avg = arr => arr.length ? U.sum(arr) / arr.length : 0;
  U.slope = function (arr, n) {
    const a = arr.slice(-(n || arr.length));
    if (a.length < 2) return 0;
    const m = a.length, xm = (m - 1) / 2, ym = U.avg(a);
    let num = 0, den = 0;
    for (let i = 0; i < m; i++) { num += (i - xm) * (a[i] - ym); den += (i - xm) * (i - xm); }
    return den ? num / den : 0;
  };
  U.push = function (arr, v, max) { arr.push(v); if (arr.length > max) arr.splice(0, arr.length - max); return arr; };

  /* ---------- Formatierung (de-DE) ---------- */
  const NF = {};
  function nf(d) {
    return NF[d] || (NF[d] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }));
  }
  U.n = (v, d) => nf(d || 0).format(v);
  U.money = function (mrd, d) {
    const a = Math.abs(mrd);
    if (a < 1 && a > 0) return '¤ ' + nf(0).format(mrd * 1000) + ' Mio.';
    return '¤ ' + nf(d === undefined ? (a >= 100 ? 1 : 2) : d).format(mrd) + ' Mrd.';
  };
  U.moneyShort = function (mrd) {
    const a = Math.abs(mrd);
    if (a < 1) return nf(0).format(mrd * 1000) + ' M';
    if (a >= 1000) return nf(2).format(mrd / 1000) + ' Bio';
    return nf(a >= 100 ? 1 : 2).format(mrd) + ' Mrd';
  };
  U.pct = (v, d) => nf(d === undefined ? 1 : d).format(v) + ' %';
  U.sgn = (v, d, suf) => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf(d === undefined ? 1 : d).format(Math.abs(v)) + (suf || '');
  U.pad = (v, n) => String(v).padStart(n || 2, '0');
  U.clock = function (d, utc) {
    d = d || new Date();
    return utc
      ? U.pad(d.getUTCHours()) + ':' + U.pad(d.getUTCMinutes()) + ':' + U.pad(d.getUTCSeconds())
      : U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + ':' + U.pad(d.getSeconds());
  };
  U.hm = d => U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  U.date = function (d) {
    d = d || new Date();
    return U.pad(d.getDate()) + '.' + U.pad(d.getMonth() + 1) + '.' + d.getFullYear();
  };
  U.stamp = function (ts) {
    const d = new Date(ts);
    return U.date(d) + ' ' + U.clock(d);
  };
  U.dur = function (sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + U.pad(m) : U.pad(m)) + ':' + U.pad(s);
  };
  U.ago = function (ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 5) return 'gerade eben';
    if (s < 60) return 'vor ' + s + ' s';
    if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'vor ' + Math.floor(s / 3600) + ' h';
    return 'vor ' + Math.floor(s / 86400) + ' T';
  };
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  U.longDate = d => d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear();
  U.roman = function (n) {
    const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [v, s] of m) while (n >= v) { r += s; n -= v; }
    return r || '0';
  };

  /* ---------- Text ---------- */
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (m, k) => (o[k] !== undefined ? o[k] : m));
  U.norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

  let seq = 0;
  U.uid = p => (p || 'x') + '-' + Date.now().toString(36).slice(-4) + (++seq).toString(36);
  U.serial = (p, n) => p + '-' + U.pad(n, 4);

  const CN_A = ['SILBER', 'GLAS', 'EISEN', 'STILL', 'NORD', 'GRAU', 'KALT', 'HELL', 'TIEF', 'WEISS', 'KUPFER', 'STERN', 'SALZ', 'ASCHE', 'FERN', 'SCHNEE', 'MORGEN', 'BERNSTEIN', 'BLEI', 'QUARZ'];
  const CN_B = ['ANKER', 'FALKE', 'HAFEN', 'MÜHLE', 'FLUSS', 'TURM', 'SPIEGEL', 'BRÜCKE', 'LAUB', 'KRANICH', 'GARTEN', 'FEUER', 'WERFT', 'NADEL', 'LICHT', 'TOR', 'SEGEL', 'PFAD', 'QUELLE', 'BOGEN'];
  U.codename = function (used) {
    for (let i = 0; i < 40; i++) {
      const c = U.pick(CN_A) + U.pick(CN_B);
      if (!used || !used.has(c)) return c;
    }
    return U.pick(CN_A) + U.pick(CN_B) + '-' + U.ri(2, 9);
  };

  /* ---------- DOM ---------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.el = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  U.on = function (root, ev, sel, fn) {
    root.addEventListener(ev, e => {
      const t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  };
  U.setText = function (el, txt) { if (el && el.textContent !== txt) el.textContent = txt; };
  U.setHTML = function (el, html) { if (el && el._html !== html) { el.innerHTML = html; el._html = html; } };

  U.copy = function (text, fallbackEl) {
    try {
      return navigator.clipboard.writeText(text).then(() => true, () => sel());
    } catch (e) { return Promise.resolve(sel()); }
    function sel() {
      if (!fallbackEl) return false;
      const r = document.createRange(); r.selectNodeContents(fallbackEl);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      return false;
    }
  };

  /* ---------- Speicher ---------- */
  U.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nicht verfügbar */ } },
  };

  /* ---------- Ereignisbus ---------- */
  const subs = {};
  KY.bus = {
    on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return () => KY.bus.off(ev, fn); },
    off(ev, fn) { if (subs[ev]) subs[ev] = subs[ev].filter(f => f !== fn); },
    emit(ev, data) { (subs[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); },
  };
})();
