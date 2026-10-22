/* KYTHERA · MANDAT · Grafik: Flaggen, Siegel, Diagramme */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U;

  /* ---------- Flaggen (aus dem Weltgenerator abgeleitet) ---------- */
  const FC = ['#1f3c88', '#c8102e', '#f4f1e8', '#0b6b3a', '#f2b705', '#16181d', '#5aa0d8', '#7a1f3d', '#e06c1f', '#2b7a78', '#6b4c9a', '#d9d2b6'];
  function emblem(e, cx, cy, r, col) {
    switch (e) {
      case 1: { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } return `<path d="${d}Z" fill="${col}"/>`; }
      case 2: return `<circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="${col}"/>`;
      case 3: return `<circle cx="${cx}" cy="${cy}" r="${r * 0.75}" fill="none" stroke="${col}" stroke-width="${r * 0.3}"/>`;
      case 4: return `<path d="M${cx} ${cy - r}L${cx + r * 0.75} ${cy}L${cx} ${cy + r}L${cx - r * 0.75} ${cy}Z" fill="${col}"/>`;
      case 5: return `<rect x="${cx - r}" y="${cy - r * 0.25}" width="${r * 2}" height="${r * 0.5}" fill="${col}"/>`;
    }
    return '';
  }
  KY.flag = function (wn, h) {
    h = h || 24;
    const w = Math.round(h * 1.5);
    const f = wn.flag || { type: 0, c: [0, 1, 2], e: 0 };
    let [a, b, c] = f.c.map(i => FC[i % FC.length]);
    if (a === b) b = FC[(f.c[1] + 4) % FC.length];
    if (c === a || c === b) c = FC[(f.c[2] + 7) % FC.length];
    const W = 36, H = 24;
    let s = '';
    switch (f.type) {
      case 0: s = `<rect width="36" height="8" fill="${a}"/><rect y="8" width="36" height="8" fill="${b}"/><rect y="16" width="36" height="8" fill="${c}"/>`; break;
      case 1: s = `<rect width="12" height="24" fill="${a}"/><rect x="12" width="12" height="24" fill="${b}"/><rect x="24" width="12" height="24" fill="${c}"/>`; break;
      case 2: s = `<rect width="36" height="24" fill="${a}"/><rect x="10" width="6" height="24" fill="${b}"/><rect y="9" width="36" height="6" fill="${b}"/><rect x="11.5" width="3" height="24" fill="${c}"/><rect y="10.5" width="36" height="3" fill="${c}"/>`; break;
      case 3: s = `<rect width="36" height="24" fill="${a}"/><path d="M0 24L36 0V24Z" fill="${b}"/><path d="M0 22L33 0H36V2L3 24H0Z" fill="${c}"/>`; break;
      case 4: s = `<rect width="36" height="24" fill="${a}"/><rect y="12" width="36" height="12" fill="${b}"/><rect width="15" height="12" fill="${c}"/>${emblem(f.e || 1, 7.5, 6, 3.6, a)}`; break;
      case 5: s = `<rect width="36" height="24" fill="${a}"/>${emblem(2, 18, 12, 7.5, b)}${emblem(f.e, 18, 12, 4, c)}`; break;
      case 6: s = `<rect width="36" height="12" fill="${a}"/><rect y="12" width="36" height="12" fill="${b}"/><path d="M0 0L15 12L0 24Z" fill="${c}"/>${emblem(f.e, 5, 12, 3, a)}`; break;
      default: s = `<rect width="36" height="24" fill="${a}"/><rect y="6" width="36" height="12" fill="${b}"/>${emblem(f.e || 1, 18, 12, 4.5, c)}`;
    }
    return `<span class="flag" style="width:${w}px;height:${h}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${s}</svg></span>`;
  };

  /* ---------- Markenzeichen ---------- */
  KY.sealSvg = function (size) {
    const ticks = Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; const r1 = 21, r2 = i % 6 === 0 ? 17.5 : 19.2; return `<line x1="${(24 + Math.cos(a) * r1).toFixed(2)}" y1="${(24 + Math.sin(a) * r1).toFixed(2)}" x2="${(24 + Math.cos(a) * r2).toFixed(2)}" y2="${(24 + Math.sin(a) * r2).toFixed(2)}"/>`; }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="24" cy="24" r="22.5"/><circle cx="24" cy="24" r="15.5" stroke-width="1"/>${ticks}<path d="M19 15.5v17M19 24.5l8.5-9M21.8 21.6l6.4 10.9" stroke-width="1.8"/><circle cx="31" cy="15.7" r="1.2" fill="currentColor" stroke="none"/></svg>`;
  };

  /* Wachssiegel für die Vertragsmappe */
  KY.waxSeal = function (text, mono, col) {
    col = col || '#8e1b1b';
    const id = 'ws' + Math.floor(Math.random() * 1e6);
    let blob = '';
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * Math.PI * 2;
      const r = 58 + Math.sin(i * 2.7) * 2.6 + Math.cos(i * 1.3) * 1.8;
      blob += (i ? 'L' : 'M') + (62 + Math.cos(a) * r).toFixed(1) + ' ' + (62 + Math.sin(a) * r).toFixed(1);
    }
    return `<svg viewBox="0 0 124 124" width="124" height="124" aria-hidden="true">
      <defs><radialGradient id="${id}g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#c0392b"/><stop offset="0.55" stop-color="${col}"/><stop offset="1" stop-color="#4a0d0d"/></radialGradient>
      <path id="${id}p" d="M62 62m-40 0a40 40 0 1 1 80 0a40 40 0 1 1 -80 0"/></defs>
      <path d="${blob}Z" fill="url(#${id}g)"/>
      <circle cx="62" cy="62" r="47" fill="none" stroke="rgba(255,220,200,0.35)" stroke-width="1.2"/>
      <circle cx="62" cy="62" r="31" fill="none" stroke="rgba(255,220,200,0.3)" stroke-width="1"/>
      <text font-family="Georgia, serif" font-size="8.6" letter-spacing="1.6" fill="rgba(255,225,205,0.75)"><textPath href="#${id}p">${U.esc(text)}</textPath></text>
      <text x="62" y="70" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="700" fill="rgba(255,225,205,0.82)">${U.esc(mono)}</text>
      <ellipse cx="46" cy="38" rx="16" ry="7" fill="rgba(255,255,255,0.12)" transform="rotate(-30 46 38)"/></svg>`;
  };

  /* ---------- Diagramme ---------- */
  const C = (KY.chart = {});
  let cid = 0;
  const store = {};
  /* Linie: pts = [{x, y, lbl}], o = {h, fmt, color, min, max, zero, xlab} */
  C.line = function (pts, o) {
    o = o || {};
    if (!pts || pts.length < 2) return '<div class="empty" style="padding:16px">Noch zu wenige Daten für einen Verlauf.</div>';
    const id = 'c' + (++cid);
    const W = 400, H = o.h || 120, pl = 4, pr = 4, pt = 10, pb = 18;
    const ys = pts.map(p => p.y);
    let lo = o.min !== undefined ? o.min : Math.min.apply(null, ys), hi = o.max !== undefined ? o.max : Math.max.apply(null, ys);
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; if (o.min === undefined) lo -= pad; if (o.max === undefined) hi += pad;
    const X = i => pl + i / (pts.length - 1) * (W - pl - pr);
    const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
    const col = o.color || 'var(--blue)';
    const grid = [0.25, 0.5, 0.75].map(f => `<line x1="${pl}" x2="${W - pr}" y1="${(pt + f * (H - pt - pb)).toFixed(1)}" y2="${(pt + f * (H - pt - pb)).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`).join('');
    const zl = o.zero && lo < 0 && hi > 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3 3"/>` : '';
    const fmt = o.fmt || (v => U.n(v, 1));
    const area = o.area !== false ? `<path d="${d}L${X(pts.length - 1).toFixed(1)} ${H - pb}L${X(0)} ${H - pb}Z" fill="${col}" opacity="0.08"/>` : '';
    const last = pts[pts.length - 1];
    store[id] = { pts, X, Y, W, H, fmt, pb, pt };
    if (Object.keys(store).length > 80) delete store[Object.keys(store)[0]];
    return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${grid}${zl}${area}<path d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(last.y).toFixed(1)}" r="3.5" fill="${col}" stroke="var(--panel2)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="rgba(255,255,255,0.35)" stroke-width="1" vector-effect="non-scaling-stroke" style="display:none"/>
      <text x="${pl}" y="${H - 4}" font-size="10" fill="var(--dim)" font-family="Inter, sans-serif">${U.esc(pts[0].xl || '')}</text>
      <text x="${W - pr}" y="${H - 4}" font-size="10" fill="var(--dim)" text-anchor="end" font-family="Inter, sans-serif">${U.esc(last.xl || '')}</text></svg><div class="ctip"></div></div>`;
  };
  C.bind = function (root) {
    root.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('.chart');
      if (!el) return;
      const s = store[el.dataset.chart];
      if (!s) return;
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const i = U.clamp(Math.round(fx * (s.pts.length - 1)), 0, s.pts.length - 1);
      const p = s.pts[i];
      const xh = el.querySelector('.xh');
      const vx = s.X(i);
      xh.setAttribute('x1', vx); xh.setAttribute('x2', vx); xh.style.display = '';
      const tip = el.querySelector('.ctip');
      tip.style.display = 'block';
      tip.innerHTML = `<b>${U.esc(s.fmt(p.y))}</b> <span class="dim">${U.esc(p.lbl || p.xl || '')}</span>`;
      tip.style.left = (vx / s.W * r.width) + 'px';
      tip.style.top = (s.Y(p.y) / s.H * r.height - 6) + 'px';
    });
    root.addEventListener('pointerout', e => {
      const el = e.target.closest && e.target.closest('.chart');
      if (!el || el.contains(e.relatedTarget)) return;
      const xh = el.querySelector('.xh'); if (xh) xh.style.display = 'none';
      const tip = el.querySelector('.ctip'); if (tip) tip.style.display = 'none';
    });
  };
  /* Monatsreihe → Punkte mit Datumsbeschriftung */
  C.monthly = function (arr, endDay, fmtv) {
    const n = arr.length;
    return arr.map((v, i) => { const day = endDay - (n - 1 - i) * 30; return { y: v, xl: U.monthStr(Math.max(0, day)), lbl: U.monthStr(Math.max(0, day)) }; });
  };
  /* Kleine Verlaufslinie ohne Achsen für Kennzahlen */
  C.spark = function (vals, col, w, h) {
    w = w || 80; h = h || 22;
    if (!vals || vals.length < 2) return '';
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals) || 1;
    const d = vals.map((v, i) => (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ' ' + (h - 2 - (v - lo) / ((hi - lo) || 1) * (h - 4)).toFixed(1)).join('');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><path d="${d}" fill="none" stroke="${col || 'var(--blue)'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  };
})();
