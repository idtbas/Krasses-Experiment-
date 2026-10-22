/* KYTHERA · MANDAT · Grundfunktionen */
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
    s = String(s);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.R = Math.random;
  U.ri = (a, b, r) => Math.floor(a + (r || Math.random)() * (b - a + 1));
  U.rf = (a, b, r) => a + (r || Math.random)() * (b - a);
  U.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
  U.chance = p => Math.random() < p;
  U.gauss = function (r) {
    r = r || Math.random;
    let u = 0, v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  U.shuffle = function (arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((r || Math.random)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  U.weighted = function (items, wf, r) {
    let tot = 0;
    const ws = items.map(it => { const w = Math.max(0, wf(it)); tot += w; return w; });
    if (tot <= 0) return null;
    let x = (r || Math.random)() * tot;
    for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  };

  /* ---------- Mathematik ---------- */
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = t => t * t * (3 - 2 * t);
  U.sum = arr => arr.reduce((s, x) => s + x, 0);
  U.avg = arr => arr.length ? U.sum(arr) / arr.length : 0;
  U.push = function (arr, v, max) { arr.push(v); if (arr.length > max) arr.splice(0, arr.length - max); return arr; };
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  /* Großkreisentfernung in km zwischen zwei Punkten (Grad) */
  U.km = function (lon1, lat1, lon2, lat2) {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* ---------- Formatierung (de-DE) ---------- */
  const NF = {};
  const nf = d => NF[d] || (NF[d] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }));
  U.n = (v, d) => nf(d || 0).format(v);
  U.money = function (mrd, d) {
    const a = Math.abs(mrd);
    if (a >= 1000) return '¤ ' + nf(2).format(mrd / 1000) + ' Bio.';
    if (a < 1 && a > 0) return '¤ ' + nf(0).format(mrd * 1000) + ' Mio.';
    return '¤ ' + nf(d === undefined ? (a >= 100 ? 1 : 2) : d).format(mrd) + ' Mrd.';
  };
  U.people = function (mio) {
    const a = Math.abs(mio);
    if (a >= 1000) return nf(2).format(mio / 1000) + ' Mrd.';
    if (a >= 1) return nf(a >= 100 ? 0 : 1).format(mio) + ' Mio.';
    if (a >= 0.001) return nf(0).format(mio * 1000) + ' Tsd.';
    return nf(0).format(mio * 1e6);
  };
  U.count = function (n) {
    const a = Math.abs(n);
    if (a >= 1e6) return nf(a >= 1e8 ? 0 : 1).format(n / 1e6) + ' Mio.';
    if (a >= 1e4) return nf(0).format(n / 1e3) + ' Tsd.';
    return nf(0).format(n);
  };
  U.pct = (v, d) => nf(d === undefined ? 1 : d).format(v) + ' %';
  U.sgn = (v, d, suf) => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf(d === undefined ? 1 : d).format(Math.abs(v)) + (suf || '');
  U.pad = (v, n) => String(v).padStart(n || 2, '0');
  U.clock = function (d) { d = d || new Date(); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };

  /* ---------- Spielkalender: Tag 0 = 1. März 2027 ---------- */
  const BASE = Date.UTC(2027, 2, 1);
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  U.MON = MON;
  U.dayDate = day => new Date(BASE + Math.floor(day) * 86400000);
  U.dateStr = function (day, short) {
    const d = U.dayDate(day);
    return short ? d.getUTCDate() + '. ' + MONS[d.getUTCMonth()] + ' ' + d.getUTCFullYear()
      : WD[d.getUTCDay()] + ', ' + d.getUTCDate() + '. ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  };
  U.monthStr = day => { const d = U.dayDate(day); return MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  U.year = day => U.dayDate(day).getUTCFullYear();
  U.month = day => U.dayDate(day).getUTCMonth();
  U.mday = day => U.dayDate(day).getUTCDate();
  U.days = function (n) {
    n = Math.round(n);
    if (n >= 730) return U.n(n / 365, 1) + ' Jahre';
    if (n >= 60) return Math.round(n / 30.4) + ' Monate';
    return n + (n === 1 ? ' Tag' : ' Tage');
  };
  U.realDate = function (d) { d = d || new Date(); return U.pad(d.getDate()) + '.' + U.pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  U.longDate = d => d.getDate() + '. ' + MON[d.getMonth()] + ' ' + d.getFullYear();

  /* ---------- Text ---------- */
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (m, k) => (o[k] !== undefined ? o[k] : m));
  U.norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  U.cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  let seq = 0;
  U.uid = p => (p || 'x') + (Date.now() % 1e7).toString(36) + (++seq).toString(36);

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
      const t = e.target.closest ? e.target.closest(sel) : null;
      if (t && root.contains(t)) fn(e, t);
    });
  };
  U.setText = function (el, txt) { if (el && el.textContent !== txt) el.textContent = txt; };
  U.setHTML = function (el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
  U.copy = function (text) {
    try { return navigator.clipboard.writeText(text).then(() => true, () => false); }
    catch (e) { return Promise.resolve(false); }
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
