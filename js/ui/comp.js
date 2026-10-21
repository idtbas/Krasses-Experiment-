/* KYTHERA · Bausteine: Symbole, Diagramme, Kennzeichen */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;

  /* ---------- Symbole (24er Raster, Strichstärke 1.6) ---------- */
  const P = {
    lage: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    atlas: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
    news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>',
    vorhaben: '<path d="M4 20V8l8-4 8 4v12"/><path d="M4 20h16M9 20v-6h6v6"/><path d="M12 4v4"/>',
    kapital: '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/>',
    orbit: '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)"/><circle cx="12" cy="12" r="3"/><circle cx="20" cy="8" r="1.4" fill="currentColor"/>',
    forschung: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/>',
    kuratorium: '<path d="M3 9l9-5 9 5"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
    netzwerk: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="7" r="2.2"/><circle cx="12" cy="17" r="2.2"/><circle cx="19" cy="18" r="1.6"/><path d="M8 7l8 .5M7 8l4 7M17 9l-4 6.5M14 17.3l3.5.5"/>',
    komm: '<rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/>',
    pythia: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M12 9v6"/>',
    depeschen: '<rect x="4" y="3" width="13" height="18"/><path d="M7 7h7M7 10h7M7 13h4"/><rect x="13" y="13" width="8" height="7" fill="var(--s1)"/><path d="M15 13v-2a2 2 0 0 1 4 0v2"/>',
    archiv: '<rect x="3" y="4" width="18" height="5"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/>',
    integritaet: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    terminal: '<rect x="3" y="4" width="18" height="16"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    protokoll: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
    system: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    mechanismus: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
    sitz0: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="6"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    pause: '<path d="M7 5v14M17 5v14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.6V14M12 17v.5"/>',
    sat: '<path d="M8 8l8 8M5 11l6-6 2 2-6 6zM11 17l6-6 2 2-6 6z"/><path d="M15 9l2-2"/><circle cx="18" cy="6" r="1.5"/>',
    ship: '<path d="M3 16l2 4h14l2-4H3z"/><path d="M6 16V9h12v7M12 9V4M9 6h6"/>',
    server: '<rect x="4" y="4" width="16" height="7"/><rect x="4" y="13" width="16" height="7"/><path d="M8 7.5h.5M8 16.5h.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  KY.I = function (name, cls) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + (P[name] || P.help) + '</svg>';
  };

  /* Siegel des Kuratoriums */
  KY.seal = function (size, spin) {
    const R = 46, ticks = [];
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2, r1 = i % 5 === 0 ? 39 : 41;
      ticks.push('<line x1="' + (50 + Math.cos(a) * r1).toFixed(2) + '" y1="' + (50 + Math.sin(a) * r1).toFixed(2) + '" x2="' + (50 + Math.cos(a) * 43).toFixed(2) + '" y2="' + (50 + Math.sin(a) * 43).toFixed(2) + '"/>');
    }
    const teeth = [];
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2;
      teeth.push('<rect x="48.6" y="1.5" width="2.8" height="3.5" transform="rotate(' + (a * 180 / Math.PI).toFixed(1) + ' 50 50)"/>');
    }
    const seats = [];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + i / 9 * Math.PI * 2;
      seats.push('<circle cx="' + (50 + Math.cos(a) * 20).toFixed(2) + '" cy="' + (50 + Math.sin(a) * 20).toFixed(2) + '" r="2.3" fill="currentColor"/>');
    }
    return '<svg class="seal' + (spin ? ' spin' : '') + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width=".8" aria-hidden="true">' +
      '<g class="ring"><circle cx="50" cy="50" r="' + R + '"/>' + '<g fill="currentColor" stroke="none">' + teeth.join('') + '</g>' + ticks.join('') +
      '<path id="sealArc" d="M50 50 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" stroke="none"/>' +
      '<text font-family="Cormorant Garamond, Georgia, serif" font-size="7.2" letter-spacing="2.4" fill="currentColor" stroke="none"><textPath href="#sealArc">ΚΥΘΗΡΑ · MCMI · CVSTODES · MCMII ·</textPath></text></g>' +
      '<circle cx="50" cy="50" r="27"/><circle cx="50" cy="50" r="13" stroke-dasharray="1.5 2"/>' + seats.join('') +
      '<circle cx="50" cy="50" r="3.2"/><line x1="50" y1="50" x2="50" y2="33" stroke-width="1.2"/></svg>';
  };

  /* ---------- Kennzeichen ---------- */
  const C = KY.C = {};
  C.pill = (txt, cls, live) => '<span class="pill ' + (cls || '') + (live ? ' live' : '') + '">' + U.esc(txt) + '</span>';
  C.lvlCls = function (v, inv) {
    if (inv) v = 100 - v;
    return v >= 60 ? 'ok' : v >= 45 ? 'warn' : v >= 30 ? 'ser' : 'crit';
  };
  C.meter = function (v, max, cls, extra) {
    const w = U.clamp(v / (max || 100) * 100, 0, 100);
    return '<div class="meter ' + (cls || '') + ' ' + (extra || '') + '"><i style="width:' + w.toFixed(1) + '%"></i></div>';
  };
  C.mrow = function (k, v, inv, tip) {
    return '<div class="mrow"' + (tip ? ' data-tip="' + U.esc(tip) + '"' : '') + '><span class="k">' + U.esc(k) + '</span>' + C.meter(v, 100, C.lvlCls(v, inv)) + '<span class="v">' + U.n(v) + '</span></div>';
  };
  C.delta = function (v, d, suf, invert) {
    const good = invert ? v < 0 : v > 0;
    const cls = Math.abs(v) < 0.005 ? 'mut' : good ? 'up' : 'dn';
    return '<span class="' + cls + '">' + (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + U.n(Math.abs(v), d === undefined ? 1 : d) + (suf || '') + '</span>';
  };

  /* ---------- Sparkline (eine Serie, Fläche, Endpunkt) ---------- */
  C.spark = function (vals, opt) {
    opt = opt || {};
    const w = opt.w || 120, h = opt.h || 28, pad = 3;
    if (!vals || vals.length < 2) return '<svg viewBox="0 0 ' + w + ' ' + h + '"></svg>';
    let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (opt.min !== undefined) mn = Math.min(mn, opt.min);
    if (mx - mn < 1e-9) { mx += 1; mn -= 1; }
    const xs = i => pad + i / (vals.length - 1) * (w - pad * 2 - 4);
    const ys = v => pad + (1 - (v - mn) / (mx - mn)) * (h - pad * 2);
    let d = '';
    vals.forEach((v, i) => { d += (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1); });
    const col = opt.color || 'var(--acc)';
    const lx = xs(vals.length - 1), ly = ys(vals[vals.length - 1]);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + 'L' + lx.toFixed(1) + ' ' + h + 'L' + xs(0).toFixed(1) + ' ' + h + 'Z" fill="' + col + '" fill-opacity=".1" stroke="none"/>' +
      '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="2.6" fill="' + col + '" stroke="var(--s1)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
  };

  /* ---------- Liniendiagramm mit Fadenkreuz und Tooltip ---------- */
  C.line = function (el, opt) {
    const vals = opt.vals || [];
    const W = Math.max(200, el.clientWidth || 600), H = opt.h || 220;
    const pl = 8, pr = 58, pt = 12, pb = opt.xlabels ? 24 : 10;
    if (vals.length < 2) { el.innerHTML = '<div class="empty">Keine Daten</div>'; return; }
    let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (opt.ref !== undefined) { mn = Math.min(mn, opt.ref); mx = Math.max(mx, opt.ref); }
    const span = mx - mn || Math.abs(mx) * 0.01 || 1;
    mn -= span * 0.08; mx += span * 0.08;
    const step = niceStep((mx - mn) / 4);
    const t0 = Math.ceil(mn / step) * step;
    const xs = i => pl + i / (vals.length - 1) * (W - pl - pr);
    const ys = v => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
    const fmt = opt.fmt || (v => U.n(v, 2));
    let grid = '';
    for (let v = t0; v <= mx; v += step) {
      const y = ys(v).toFixed(1);
      grid += '<line x1="' + pl + '" x2="' + (W - pr + 4) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="' + (W - pr + 8) + '" y="' + (+y + 3.5) + '" fill="var(--mut)" font-size="10" font-family="IBM Plex Mono, monospace">' + U.esc((opt.tick || fmt)(v)) + '</text>';
    }
    let xl = '';
    if (opt.xlabels) {
      opt.xlabels.forEach(([i, txt]) => { xl += '<text x="' + xs(i).toFixed(1) + '" y="' + (H - 6) + '" fill="var(--mut)" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">' + U.esc(txt) + '</text>'; });
    }
    let d = '';
    vals.forEach((v, i) => { d += (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1); });
    const col = opt.color || 'var(--acc)';
    const last = vals.length - 1;
    const ref = opt.ref !== undefined ? '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + ys(opt.ref).toFixed(1) + '" y2="' + ys(opt.ref).toFixed(1) + '" stroke="var(--line3)" stroke-width="1"/>' : '';
    let band = '';
    if (opt.band) {
      const [lo, hi] = opt.band;
      const x1 = xs(last), x2 = W - pr;
      band = '<path d="M' + x1 + ' ' + ys(vals[last]) + 'L' + x2 + ' ' + ys(hi) + 'L' + x2 + ' ' + ys(lo) + 'Z" fill="' + col + '" fill-opacity=".14"/>' +
        '<line x1="' + x1 + '" y1="' + ys(vals[last]) + '" x2="' + x2 + '" y2="' + ys((lo + hi) / 2) + '" stroke="' + col + '" stroke-width="1.5" stroke-dasharray="3 3"/>';
    }
    el.style.position = 'relative';
    el.innerHTML = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block">' + grid + xl + ref +
      '<path d="' + d + 'L' + xs(last) + ' ' + (H - pb) + 'L' + xs(0) + ' ' + (H - pb) + 'Z" fill="' + col + '" fill-opacity=".1"/>' +
      '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + band +
      '<circle cx="' + xs(last) + '" cy="' + ys(vals[last]) + '" r="4" fill="' + col + '" stroke="var(--s1)" stroke-width="2"/>' +
      '<g class="xh" style="display:none"><line y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--line3)" stroke-width="1"/><circle r="4" fill="' + col + '" stroke="var(--s1)" stroke-width="2"/></g>' +
      '<rect x="' + pl + '" y="0" width="' + (W - pl - pr) + '" height="' + H + '" fill="transparent"/></svg><div class="chart-tip" style="display:none"></div>';
    const svg = el.firstChild, xh = svg.querySelector('.xh'), tip = el.lastChild;
    const move = e => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) * W / r.width;
      const i = U.clamp(Math.round((x - pl) / (W - pl - pr) * last), 0, last);
      const cx = xs(i), cy = ys(vals[i]);
      xh.style.display = '';
      xh.firstChild.setAttribute('x1', cx); xh.firstChild.setAttribute('x2', cx);
      xh.lastChild.setAttribute('cx', cx); xh.lastChild.setAttribute('cy', cy);
      tip.style.display = '';
      tip.innerHTML = (opt.label ? U.esc(opt.label(i)) + '<br>' : '') + '<b style="color:var(--fg)">' + U.esc(fmt(vals[i])) + '</b>';
      const px = cx * r.width / W, py = cy * r.height / H;
      tip.style.left = Math.min(px + 12, r.width - tip.offsetWidth - 4) + 'px';
      tip.style.top = Math.max(0, py - 40) + 'px';
    };
    svg.addEventListener('mousemove', move);
    svg.addEventListener('mouseleave', () => { xh.style.display = 'none'; tip.style.display = 'none'; });
  };
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  /* ---------- Halbkreis-Anzeige ---------- */
  C.gauge = function (v, opt) {
    opt = opt || {};
    const cls = opt.cls || C.lvlCls(v);
    const colMap = { ok: 'var(--ok)', warn: 'var(--warn)', ser: 'var(--ser)', crit: 'var(--crit)', acc: 'var(--acc)' };
    const a = Math.PI * (1 - U.clamp(v, 0, 100) / 100);
    const x = 60 + Math.cos(a) * 46, y = 58 - Math.sin(a) * 46;
    const large = 0;
    return '<svg viewBox="0 0 120 70" width="100%" style="max-width:' + (opt.max || 180) + 'px;display:block;margin:0 auto">' +
      '<path d="M14 58 A46 46 0 0 1 106 58" fill="none" stroke="var(--line2)" stroke-width="7"/>' +
      '<path d="M14 58 A46 46 0 ' + large + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + '" fill="none" stroke="' + colMap[cls] + '" stroke-width="7"/>' +
      '<text x="60" y="54" text-anchor="middle" fill="var(--fg)" font-size="19" font-family="IBM Plex Sans, sans-serif" font-weight="500">' + U.n(v, opt.d || 0) + '</text>' +
      '<text x="60" y="67" text-anchor="middle" fill="var(--mut)" font-size="7" letter-spacing=".6" font-family="IBM Plex Sans Condensed, sans-serif">' + U.esc((opt.label || '').toUpperCase()) + '</text></svg>';
  };

  /* ---------- Netzdiagramm (Regionsprofil) ---------- */
  C.radar = function (m, base) {
    const keys = ['stab', 'wohl', 'vert', 'praes', 'ener', 'infra'];
    const n = keys.length, cx = 110, cy = 100, R = 70;
    const pt = (i, v) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100]; };
    let g = '';
    [25, 50, 75, 100].forEach(l => {
      g += '<polygon points="' + keys.map((k, i) => pt(i, l).map(x => x.toFixed(1)).join(',')).join(' ') + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
    });
    keys.forEach((k, i) => {
      const [x, y] = pt(i, 100), [lx, ly] = pt(i, 120);
      g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)"/>';
      g += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="middle" fill="var(--mut)" font-size="9" letter-spacing=".8" font-family="IBM Plex Sans Condensed, sans-serif">' + KY.data.metricInfo[k].short + '</text>';
    });
    const poly = vals => keys.map((k, i) => pt(i, vals[k]).map(x => x.toFixed(1)).join(',')).join(' ');
    let b = '';
    if (base) b = '<polygon points="' + poly(base) + '" fill="none" stroke="var(--fg2)" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>';
    return '<svg viewBox="0 0 220 200" width="100%" style="max-width:260px;display:block;margin:0 auto">' + g + b +
      '<polygon points="' + poly(m) + '" fill="var(--acc)" fill-opacity=".14" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round"/>' +
      keys.map((k, i) => { const [x, y] = pt(i, m[k]); return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="var(--acc)" stroke="var(--s1)" stroke-width="1.5"/>'; }).join('') + '</svg>';
  };

  /* ---------- Ringdiagramm mit 2px-Fugen ---------- */
  C.donut = function (segs, center) {
    const tot = U.sum(segs.map(s => s.v)) || 1;
    const R = 52, r = 34, cx = 60, cy = 60;
    let a0 = -Math.PI / 2, out = '';
    const gap = 0.02;
    segs.forEach(s => {
      const a1 = a0 + s.v / tot * Math.PI * 2;
      const s0 = a0 + gap / 2, s1 = Math.max(s0 + 0.001, a1 - gap / 2);
      const large = s1 - s0 > Math.PI ? 1 : 0;
      const p = (rad, a) => (cx + Math.cos(a) * rad).toFixed(2) + ' ' + (cy + Math.sin(a) * rad).toFixed(2);
      out += '<path d="M' + p(R, s0) + 'A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + p(R, s1) + 'L' + p(r, s1) + 'A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + p(r, s0) + 'Z" fill="' + s.c + '"><title>' + U.esc(s.l + ': ' + U.pct(s.v / tot * 100)) + '</title></path>';
      a0 = a1;
    });
    return '<svg viewBox="0 0 120 120" width="100%" style="max-width:150px;display:block">' + out +
      (center ? '<text x="60" y="58" text-anchor="middle" fill="var(--fg)" font-size="13" font-family="IBM Plex Sans, sans-serif" font-weight="500">' + U.esc(center[0]) + '</text><text x="60" y="72" text-anchor="middle" fill="var(--mut)" font-size="7.5" letter-spacing="1" font-family="IBM Plex Sans Condensed, sans-serif">' + U.esc(center[1]) + '</text>' : '') + '</svg>';
  };
  C.legend = function (segs, tot) {
    tot = tot || U.sum(segs.map(s => s.v)) || 1;
    return '<div class="col gap4" style="font-size:12px">' + segs.map(s => '<div class="row"><i style="width:10px;height:10px;background:' + s.c + ';flex:none"></i><span class="fg2 ell" style="flex:1">' + U.esc(s.l) + '</span><span class="mono mut">' + U.n(s.v / tot * 100, 1) + ' %</span></div>').join('') + '</div>';
  };
  C.CAT = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

  /* ---------- Plenum: neun Sitze im Halbrund ---------- */
  C.seats = function (votes, opt) {
    opt = opt || {};
    const D = KY.data;
    const ids = D.council.map(m => m.id).concat(['IX']);
    const n = ids.length;
    let out = '';
    const colors = { JA: 'var(--ok)', NEIN: 'var(--crit)', ENTH: 'var(--mut)' };
    ids.forEach((id, i) => {
      const a = Math.PI - (i + 0.5) / n * Math.PI;
      const x = 150 + Math.cos(a) * 112, y = 132 - Math.sin(a) * 112;
      const v = votes ? votes[id] : null;
      const m = D.council.find(x => x.id === id);
      const gone = m && m.proxy && KY.S.story.ending === 'frei';
      const seat = id === 'IX' ? 'IX' : m.seat;
      const fill = gone ? 'transparent' : v ? colors[v] : 'var(--s3)';
      const ring = id === 'IX' ? 'var(--acc)' : m && m.proxy ? 'var(--dim)' : 'var(--line3)';
      out += '<g><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="17" fill="' + fill + '" fill-opacity="' + (v ? 0.9 : 1) + '" stroke="' + ring + '" stroke-width="' + (id === 'IX' ? 2 : 1) + '"' + (m && m.proxy ? ' stroke-dasharray="3 3"' : '') + '/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 4.5).toFixed(1) + '" text-anchor="middle" font-size="12" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" fill="' + (v && v !== 'ENTH' ? '#0b0b0b' : 'var(--fg2)') + '">' + seat + '</text>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y + 30).toFixed(1) + '" text-anchor="middle" font-size="8" letter-spacing=".8" font-family="IBM Plex Sans Condensed, sans-serif" fill="var(--mut)">' + (id === 'IX' ? 'SIE' : id) + '</text>' +
        (gone ? '<line x1="' + (x - 12) + '" y1="' + (y - 12) + '" x2="' + (x + 12) + '" y2="' + (y + 12) + '" stroke="var(--dim)"/>' : '') + '</g>';
    });
    const mid = opt.center || '';
    return '<svg viewBox="0 0 300 170" width="100%">' +
      '<path d="M22 140 A128 128 0 0 1 278 140" fill="none" stroke="var(--line)" stroke-width="1"/>' + out +
      '<text x="150" y="124" text-anchor="middle" font-size="22" font-family="IBM Plex Mono, monospace" fill="var(--fg)">' + U.esc(mid) + '</text>' +
      (opt.sub ? '<text x="150" y="140" text-anchor="middle" font-size="8" letter-spacing="1.4" font-family="IBM Plex Sans Condensed, sans-serif" fill="var(--mut)">' + U.esc(opt.sub) + '</text>' : '') + '</svg>';
  };

  /* ---------- Porträt-Platzhalter (prozedural, keine Fotos) ---------- */
  C.avatar = function (pid, size) {
    const h = U.hash(pid + 'k');
    const rnd = U.rng(h);
    const hue = [36, 200, 160, 12, 260, 90][h % 6];
    let cells = '';
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
      if (rnd() > 0.48) {
        const op = (0.25 + rnd() * 0.6).toFixed(2);
        cells += '<rect x="' + (8 + x * 9) + '" y="' + (8 + y * 9) + '" width="8" height="8" fill="hsl(' + hue + ',35%,62%)" fill-opacity="' + op + '"/>';
        if (x < 2) cells += '<rect x="' + (8 + (4 - x) * 9) + '" y="' + (8 + y * 9) + '" width="8" height="8" fill="hsl(' + hue + ',35%,62%)" fill-opacity="' + op + '"/>';
      }
    }
    return '<svg class="avatar" viewBox="0 0 61 61" width="' + (size || 64) + '" height="' + (size || 64) + '"><rect width="61" height="61" fill="var(--s2)"/>' + cells + '</svg>';
  };

  /* ---------- Gleitende Zahlen ---------- */
  C.countUp = function (el, to, fmt, ms) {
    const from = el._v === undefined ? to : el._v;
    el._v = to;
    if (Math.abs(from - to) < 1e-9 || (KY.S && !KY.S.user.prefs.motion)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = ms || 600;
    cancelAnimationFrame(el._raf);
    const stepf = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(stepf);
    };
    el._raf = requestAnimationFrame(stepf);
  };
})();
