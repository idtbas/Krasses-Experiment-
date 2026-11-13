/* VistoOS · apps/settings.js — Einstellungen
 *
 *  Runde Liste (V.ui.roundList) mit Unterseiten. Unterseiten gleiten von rechts herein,
 *  „zurück“ per Wischen vom linken Rand, Antippen des Titels oder Sockeltaste.
 *    Anzeige · Zifferblatt · Farbe · Datum & Uhrzeit · Visto · Töne & Haptik · WLAN · Ort · Über Visto · Zurücksetzen
 *  Bedienelemente sind rund gedacht: Regler als Bogen (Skala mit 270°), geschwungene Schieberegler,
 *  Farbring am Displayrand, Zifferblatt-Karussell mit Live-Vorschau, Speicher als Ring.
 *  V.shell.open('settings', {page: 'wifi'|'display'|'face'|'color'|'time'|'visto'|'sound'|'location'|'about'|'reset'})
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#8E8E93';
  const FONT = "'Inter Tight', system-ui, sans-serif";
  const NB = '(?<![a-zäöüß])', NA = '(?![a-zäöüß])';
  const get = (k, d) => V.store.get(k, d);
  const set = (k, v) => V.store.set(k, v);
  const pct = (v) => Math.round(U.clamp(v, 0, 1) * 100) + ' %';
  let pendingPage = null;
  let aiSeen = false;
  V.on('brain:ai', () => { aiSeen = true; });

  const CITIES = ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dresden', 'Hannover', 'Nürnberg', 'Bremen', 'Freiburg', 'Wien', 'Zürich'];
  const NETWORKS = [
    { name: 'Zuhause', sec: true, s: 3 },
    { name: 'Zuhause 5G', sec: true, s: 3 },
    { name: 'Café Lumen', sec: false, s: 2 },
    { name: 'FRITZ!Box 7590 KL', sec: true, s: 2 },
    { name: 'Nachbarschaft', sec: true, s: 1 },
    { name: 'Telekom_FON', sec: false, s: 1 },
  ];
  const IDLE = [{ v: 15, label: '15 s' }, { v: 30, label: '30 s' }, { v: 60, label: '1 Min' }, { v: 120, label: '2 Min' }, { v: 300, label: '5 Min' }];
  const STYLES = [{ v: 'aurora', label: 'Aurora' }, { v: 'mono', label: 'Mono' }, { v: 'accent', label: 'Akzent' }];
  const PRESETS = () => (V.faces.COLORS || []).filter((c) => c.v !== 'accent' && c.v.toUpperCase() !== '#FFFFFF');
  const STORAGE = [
    { label: 'System', gb: 4.6, color: '#8E8E93' },
    { label: 'Apps', gb: 2.4, color: '#0A84FF' },
    { label: 'Fotos', gb: 3.1, color: '#FFD60A' },
    { label: 'Musik', gb: 1.7, color: '#FF375F' },
  ];
  const STORAGE_TOTAL = 32;

  /* ------------------------------------------------------------------ Stile */
  const CSS = `
.st-host{position:absolute;inset:0}
.st-page{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#000;transform-origin:50% 50%}
.st-back{position:absolute;left:28cqw;right:28cqw;top:0;height:12.5cqw;z-index:6;border:0;background:none;padding:0;cursor:pointer;border-radius:0 0 50% 50%}
.st-back:active{background:radial-gradient(60% 80% at 50% 0%,rgba(255,255,255,.08),transparent)}
.st-me{display:flex;flex-direction:column;align-items:center;text-align:center;margin:0 auto 4.2cqw;cursor:pointer}
.st-me .st-mark{width:12cqw;height:12cqw;margin-bottom:1.6cqw;transition:transform .35s var(--spring)}
.st-me:active .st-mark{transform:scale(.92)}
.st-me b{font-size:5.4cqw;font-weight:650;letter-spacing:-.015em}
.st-me small{font-size:3.2cqw;color:var(--fg3);margin-top:.5cqw;font-weight:550}
.vos-rrow.st-danger .tx b{color:#FF6B62}
.st-chev{width:4.4cqw;height:4.4cqw;color:var(--fg4);flex:none}
.st-chev svg{width:100%;height:100%}
.st-card{position:relative;margin:0 auto 2.2cqw;width:76cqw;border-radius:7cqw;background:var(--card);padding:3.2cqw 3.6cqw;transform-origin:50% 50%;will-change:transform,opacity}
.st-card .st-ct{display:flex;align-items:baseline;justify-content:space-between;padding:0 1.6cqw;margin-bottom:1.6cqw}
.st-card .st-ct b{font-size:4cqw;font-weight:600}
.st-card .st-ct span{font-size:3.6cqw;font-weight:600;color:var(--fg2);font-variant-numeric:tabular-nums}
.st-note{font-size:3.1cqw;color:var(--fg3);line-height:1.35;text-align:center;padding:1.6cqw 3cqw 0}
/* Schalter */
.st-sw{position:relative;width:14cqw;height:8.4cqw;flex:none;border-radius:99cqw;background:rgba(255,255,255,.17);transition:background .3s ease,box-shadow .45s ease}
.st-sw i{position:absolute;top:.9cqw;left:.9cqw;width:6.6cqw;height:6.6cqw;border-radius:99cqw;background:#fff;box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.4);transition:transform .5s var(--spring),width .28s var(--ease)}
.st-sw.on{background:#32D74B;box-shadow:0 0 4cqw -.6cqw rgba(50,215,75,.6)}
.st-sw.on i{transform:translateX(5.6cqw)}
.st-trow.press .st-sw i{width:8.2cqw}
.st-trow.press .st-sw.on i{transform:translateX(4cqw)}
/* Segmente */
.st-seg{position:relative;display:flex;height:11cqw;padding:.8cqw;border-radius:99cqw;background:rgba(255,255,255,.08)}
.st-seg .st-th{position:absolute;top:.8cqw;bottom:.8cqw;left:.8cqw;border-radius:99cqw;background:rgba(255,255,255,.22);box-shadow:0 .6cqw 2cqw rgba(0,0,0,.35),inset 0 0 0 .15cqw rgba(255,255,255,.1)}
.st-seg button{position:relative;flex:1;min-width:0;border:0;background:none;padding:0;color:rgba(255,255,255,.55);font:600 3.5cqw/1 ${FONT};white-space:nowrap;cursor:pointer;transition:color .25s}
.st-seg button.on{color:#fff}
/* Bogenregler */
.st-gauge{position:relative;width:62cqw;height:56cqw;margin:0 auto 1cqw;touch-action:none;transform-origin:50% 50%;will-change:transform,opacity}
.st-gauge svg{position:absolute;left:0;top:0;width:62cqw;height:62cqw;overflow:visible}
.st-gval{position:absolute;left:0;right:0;top:16cqw;text-align:center;pointer-events:none}
.st-gval .vos-label{display:block;margin-bottom:1.2cqw}
.st-gnum{font-size:15cqw;font-weight:200;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums}
.st-gnum small{font-size:5cqw;font-weight:300;letter-spacing:0;margin-left:.6cqw;color:var(--fg2)}
.st-gic{position:absolute;top:47cqw;width:5.4cqw;height:5.4cqw;color:var(--fg3);pointer-events:none}
.st-gic svg{width:100%;height:100%}
/* geschwungener Schieberegler */
.st-curve svg{display:block;width:68.8cqw;height:12.6cqw;margin:0 auto;touch-action:none;overflow:visible;cursor:pointer}
/* Zeitpillen */
.st-pills{display:flex;gap:2.4cqw;justify-content:center}
.st-pill{flex:1;height:15cqw;border-radius:99cqw;border:0;background:rgba(255,255,255,.1);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:transform .3s var(--spring),background .2s}
.st-pill:active{transform:scale(.94);background:rgba(255,255,255,.16)}
.st-pill small{font-size:2.6cqw;font-weight:700;letter-spacing:.16em;color:var(--fg3);text-transform:uppercase}
.st-pill b{font-size:6cqw;font-weight:300;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.1}
/* Hero-Bereiche */
.st-hero{display:flex;flex-direction:column;align-items:center;text-align:center;margin:0 auto 4cqw;width:70cqw;transform-origin:50% 50%}
.st-hero .vos-label{margin-top:1.2cqw}
.st-big{font-size:17cqw;font-weight:200;letter-spacing:-.045em;line-height:.95;font-variant-numeric:tabular-nums}
.st-big small{font-size:6cqw;font-weight:300;color:var(--fg3);letter-spacing:0;margin-left:.8cqw}
/* Zifferblatt-Karussell */
.st-fstage{position:absolute;inset:0;touch-action:none}
.st-fslot{position:absolute;left:28cqw;top:15cqw;width:44cqw;height:44cqw;border-radius:50%;overflow:hidden;container-type:size;background:#000;cursor:pointer;
  box-shadow:0 0 0 .35cqw rgba(255,255,255,.14),0 2cqw 6cqw rgba(0,0,0,.6);will-change:transform,opacity;transition:box-shadow .4s}
.st-fslot.cur{box-shadow:0 0 0 .55cqw var(--accent),0 0 6cqw -1cqw rgba(var(--accent-rgb),.6)}
.st-fslot .st-fname0{position:absolute;inset:0;display:grid;place-items:center;font-size:9cqw;font-weight:600;color:var(--fg3)}
.st-finfo{position:absolute;left:0;right:0;top:62.5cqw;text-align:center;pointer-events:none}
.st-finfo .vos-h2{white-space:nowrap}
.st-fbtn{position:absolute;left:50%;top:75cqw;transform:translateX(-50%);height:11cqw}
/* Farbring */
.st-hue{position:absolute;inset:0;border-radius:50%;pointer-events:none;
  -webkit-mask:radial-gradient(circle at 50% 50%,transparent 0 39.4cqw,#000 39.7cqw 46.4cqw,transparent 46.7cqw);
  mask:radial-gradient(circle at 50% 50%,transparent 0 39.4cqw,#000 39.7cqw 46.4cqw,transparent 46.7cqw)}
.st-knob{position:absolute;width:10.6cqw;height:10.6cqw;margin:-5.3cqw 0 0 -5.3cqw;border-radius:50%;border:.9cqw solid #fff;pointer-events:none;
  box-shadow:0 .8cqw 2.4cqw rgba(0,0,0,.5),0 0 5cqw -.4cqw var(--k);transition:width .3s var(--spring),height .3s var(--spring),margin .3s var(--spring)}
.st-knob.big{width:13cqw;height:13cqw;margin:-6.5cqw 0 0 -6.5cqw}
.st-orb{position:absolute;left:50%;top:41cqw;width:24cqw;height:24cqw;margin:-12cqw 0 0 -12cqw;border-radius:50%;pointer-events:none;transition:box-shadow .3s}
.st-cinfo{position:absolute;left:0;right:0;top:57.5cqw;text-align:center;pointer-events:none}
.st-cinfo .vos-small{margin-top:.8cqw;font-variant-numeric:tabular-nums;letter-spacing:.06em}
/* Visto-Ring */
.st-vring{position:relative;width:26cqw;height:26cqw;margin:0 auto 1cqw}
.st-vring i{position:absolute;inset:0;border-radius:50%;animation:stSpin 7s linear infinite;
  -webkit-mask:radial-gradient(circle,transparent 0 10.4cqw,#000 10.7cqw 12.6cqw,transparent 12.9cqw);mask:radial-gradient(circle,transparent 0 10.4cqw,#000 10.7cqw 12.6cqw,transparent 12.9cqw)}
.st-vring i.g{filter:blur(2.2cqw);opacity:.75}
.st-vring em{position:absolute;top:10.2cqw;width:2.2cqw;height:5.4cqw;border-radius:2cqw;background:#fff;animation:stBlink 5s infinite}
@keyframes stSpin{to{transform:rotate(360deg)}}
@keyframes stBlink{0%,46%,50%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}
.st-styles{display:flex;justify-content:center;gap:5cqw;margin:0 auto 3cqw}
.st-style{display:flex;flex-direction:column;align-items:center;gap:1.6cqw;border:0;background:none;color:var(--fg2);font:600 3.2cqw ${FONT};cursor:pointer;padding:0}
.st-style i{position:relative;width:13cqw;height:13cqw;border-radius:50%;transition:transform .35s var(--spring),box-shadow .3s}
.st-style i::after{content:'';position:absolute;inset:3cqw;border-radius:50%;background:#000}
.st-style.on{color:#fff}
.st-style.on i{box-shadow:0 0 0 .6cqw #000,0 0 0 1.1cqw #fff}
.st-style:active i{transform:scale(.9)}
/* WLAN, Ort */
.st-waves{width:30cqw;height:22cqw;margin:0 auto 1cqw;display:block}
.st-waves path,.st-waves circle{transition:stroke .4s,fill .4s}
.st-waves .w{animation:stWave 2.4s ease-in-out infinite}
@keyframes stWave{0%,100%{opacity:.35}40%{opacity:1}}
.st-pin{position:relative;width:20cqw;height:20cqw;margin:0 auto 2cqw;display:grid;place-items:center}
.st-pin b{position:absolute;inset:0;border-radius:50%;border:.4cqw solid #32D74B;animation:stPing 2.6s cubic-bezier(.2,.8,.2,1) infinite;opacity:0}
.st-pin b:nth-child(2){animation-delay:1.3s}
.st-pin .vos-icon{width:13cqw;height:13cqw}
@keyframes stPing{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.5);opacity:0}}
.st-sig{display:flex;align-items:center;gap:1.4cqw;color:var(--fg2)}
.st-sig svg{width:5cqw;height:5cqw}
/* Über */
.st-donut{position:relative;width:40cqw;height:40cqw;margin:0 auto 2cqw}
.st-donut svg{width:100%;height:100%;overflow:visible}
.st-donut div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.st-donut b{font-size:7cqw;font-weight:300;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.st-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:1.2cqw 3cqw;width:62cqw;margin:0 auto 4cqw;font-size:3cqw;color:var(--fg2);font-weight:550}
.st-legend span{display:inline-flex;align-items:center;gap:1.2cqw}
.st-legend i{width:2.2cqw;height:2.2cqw;border-radius:50%}
/* Rad (Uhrzeit) */
.st-wheels{display:flex;align-items:center;justify-content:center;gap:1cqw}
.st-wheels .vos-wheel{border-radius:6cqw;background:rgba(255,255,255,.04)}
.st-colon{font-size:9cqw;font-weight:200;color:var(--fg3);margin-top:-1.4cqw}
.st-pick{position:absolute;left:0;right:0;top:20cqw;display:flex;flex-direction:column;align-items:center}
.st-pick .vos-wheel{background:radial-gradient(closest-side,rgba(255,255,255,.07),transparent)}
`;

  /* -------------------------------------------------------------- Bausteine */
  function vistoMark(size) {
    const id = U.uid('stm');
    const s = U.svg('svg', { class: 'st-mark', viewBox: '0 0 32 32', style: { width: size, height: size } });
    const d = U.svg('defs');
    const lg = U.svg('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 });
    lg.append(U.svg('stop', { offset: 0, 'stop-color': '#46E6FF' }), U.svg('stop', { offset: 0.5, 'stop-color': '#A26BFF' }), U.svg('stop', { offset: 1, 'stop-color': '#FF7AB8' }));
    d.appendChild(lg);
    s.append(d,
      U.svg('circle', { cx: 16, cy: 16, r: 15, fill: '#0b0b0e' }),
      U.svg('circle', { cx: 16, cy: 16, r: 9.5, fill: 'none', stroke: `url(#${id})`, 'stroke-width': 2.6 }),
      U.svg('rect', { x: 12, y: 13, width: 2.4, height: 5.4, rx: 1.2, fill: '#fff' }),
      U.svg('rect', { x: 17.6, y: 13, width: 2.4, height: 5.4, rx: 1.2, fill: '#fff' }));
    return s;
  }
  function chev() { return U.el('div', { class: 'st-chev', html: V.icon('chevron') }); }

  function toggleRow(o) {
    const sw = U.el('div', { class: 'st-sw' }, U.el('i'));
    const small = o.sub || o.subFn ? U.el('small') : null;
    const row = U.el('div', { class: 'vos-rrow st-trow', attrs: { role: 'switch', tabindex: '0' } },
      o.icon ? U.el('div', { class: 'ic', style: { background: o.color || 'var(--card2)', color: '#fff' }, html: V.icon(o.icon) }) : null,
      U.el('div', { class: 'tx' }, U.el('b', { text: o.title }), small),
      sw);
    const refresh = () => {
      const on = !!o.get();
      sw.classList.toggle('on', on);
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      if (small) small.textContent = o.subFn ? o.subFn(on) : o.sub;
    };
    V.ui.tap(row, () => { o.set(!o.get()); refresh(); V.haptic(o.get() ? [5, 30, 5] : 5); });
    row.addEventListener('pointerdown', () => row.classList.add('press'));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) row.addEventListener(ev, () => row.classList.remove('press'));
    refresh();
    row._refresh = refresh;
    return row;
  }

  function seg(opts, value, onChange) {
    const el = U.el('div', { class: 'st-seg', attrs: { role: 'radiogroup', 'data-nogesture': 'x' } });
    const th = U.el('div', { class: 'st-th' });
    el.appendChild(th);
    th.style.width = `calc((100% - 1.6cqw) / ${opts.length})`;
    let idx = Math.max(0, opts.findIndex((o) => o.v === value));
    const btns = opts.map((op, i) => {
      const b = U.el('button', { attrs: { type: 'button', role: 'radio' }, text: op.label });
      V.ui.tap(b, () => select(i, true));
      el.appendChild(b);
      return b;
    });
    const pos = V.spring(idx, { response: 0.42, bounce: 0.2 });
    pos.onUpdate((v, s) => {
      const st = 1 + Math.min(0.22, Math.abs(s.velocity) * 0.045);
      th.style.transform = `translateX(${(v * 100).toFixed(2)}%) scaleX(${st.toFixed(3)})`;
    });
    function paint() { btns.forEach((b, i) => { b.classList.toggle('on', i === idx); b.setAttribute('aria-checked', i === idx ? 'true' : 'false'); }); }
    function select(i, user) {
      if (i === idx && user) return;
      idx = i; paint(); pos.to(i);
      if (user && onChange) onChange(opts[i].v, i);
    }
    pos.set(idx); paint();
    return { el, set(v) { const i = opts.findIndex((o) => o.v === v); if (i >= 0) select(i, false); }, get: () => opts[idx].v };
  }

  function card(title, value, ...kids) {
    const head = title ? U.el('div', { class: 'st-ct' }, U.el('b', { text: title }), value !== undefined ? U.el('span', { text: value }) : null) : null;
    const c = U.el('div', { class: 'st-card' }, head, ...kids);
    c._value = head && head.querySelector('span');
    return c;
  }

  /** Bogenregler: 270°-Skala mit großer Zahl in der Mitte */
  function gauge(o) {
    const A0 = 225, SPAN = 270, R = 41, W = 7.4;
    const min = o.min || 0;
    let v = U.clamp(o.value, min, 1);
    const el = U.el('div', { class: 'st-gauge', attrs: { 'data-nogesture': 'all', role: 'slider', 'aria-label': o.label, 'aria-valuemin': Math.round(min * 100), 'aria-valuemax': 100 } });
    const svg = U.svg('svg', { viewBox: '0 0 100 100' });
    const gid = U.uid('stg'), fid = U.uid('stf');
    const defs = U.svg('defs');
    const p0 = { x: 50 + Math.sin(U.rad(A0)) * R, y: 50 - Math.cos(U.rad(A0)) * R };
    const lg = U.svg('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: p0.x, y1: 92, x2: 100 - p0.x, y2: 8 });
    lg.append(U.svg('stop', { offset: 0, 'stop-color': o.c0 }), U.svg('stop', { offset: 1, 'stop-color': o.c1 }));
    const f = U.svg('filter', { id: fid, x: '-50%', y: '-50%', width: '200%', height: '200%' });
    f.appendChild(U.svg('feGaussianBlur', { stdDeviation: 2.6 }));
    defs.append(lg, f);
    const track = U.svg('path', { d: V.ui.arcPath(50, 50, R, A0, A0 + SPAN), fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': W, 'stroke-linecap': 'round' });
    const glow = U.svg('path', { fill: 'none', stroke: `url(#${gid})`, 'stroke-width': W, 'stroke-linecap': 'round', opacity: 0.6, filter: `url(#${fid})` });
    const fill = U.svg('path', { fill: 'none', stroke: `url(#${gid})`, 'stroke-width': W, 'stroke-linecap': 'round' });
    const ticks = U.svg('g', { opacity: 0.5 });
    for (let i = 0; i <= 10; i++) {
      const a = A0 + (SPAN * i) / 10;
      const r0 = R + W / 2 + 2.2, r1 = r0 + (i % 5 === 0 ? 2.6 : 1.4);
      ticks.appendChild(U.svg('line', { x1: 50 + Math.sin(U.rad(a)) * r0, y1: 50 - Math.cos(U.rad(a)) * r0, x2: 50 + Math.sin(U.rad(a)) * r1, y2: 50 - Math.cos(U.rad(a)) * r1, stroke: '#fff', 'stroke-width': 0.5, 'stroke-linecap': 'round' }));
    }
    const thumbG = U.svg('circle', { r: 6, fill: o.c1, opacity: 0.6, filter: `url(#${fid})` });
    const thumb = U.svg('circle', { r: 4.6, fill: '#fff' });
    svg.append(defs, ticks, track, glow, fill, thumbG, thumb);
    const num = U.el('div', { class: 'st-gnum' });
    const val = U.el('div', { class: 'st-gval' }, U.el('span', { class: 'vos-label', text: o.label }), num);
    const icL = U.el('div', { class: 'st-gic', style: { left: '18.4cqw' }, html: V.icon(o.iconMin || o.icon) });
    const icR = U.el('div', { class: 'st-gic', style: { right: '18.4cqw', color: o.c1 }, html: V.icon(o.icon) });
    el.append(svg, val, icL, icR);
    const shown = V.spring(v, { response: 0.28, bounce: 0 });
    function paint() {
      const s = U.clamp(shown.value, 0, 1);
      const a = A0 + SPAN * Math.max(0.002, s);
      const d = V.ui.arcPath(50, 50, R, A0, a);
      fill.setAttribute('d', d); glow.setAttribute('d', d);
      const x = 50 + Math.sin(U.rad(a)) * R, y = 50 - Math.cos(U.rad(a)) * R;
      thumb.setAttribute('cx', x); thumb.setAttribute('cy', y); thumbG.setAttribute('cx', x); thumbG.setAttribute('cy', y);
      num.innerHTML = Math.round(s * 100) + '<small>%</small>';
      el.setAttribute('aria-valuenow', Math.round(s * 100));
    }
    shown.onUpdate(paint);
    paint();
    let lastTick = Math.round(v * 20), center = null, prev = v;
    function setV(nv, animate, commit) {
      nv = U.clamp(nv, min, 1);
      v = nv;
      if (animate) shown.to(nv); else shown.set(nv);
      const t = Math.round(nv * 20);
      if (t !== lastTick) { lastTick = t; V.sound.play('tick'); V.haptic(3); }
      if (o.onInput) o.onInput(nv);
      if (commit && o.onCommit) o.onCommit(nv);
    }
    function fromPoint(p) {
      const a = U.wrap(U.deg(Math.atan2(p.x - center.x, -(p.y - center.y))), 360);
      let rel = U.wrap(a - A0, 360);
      if (rel > SPAN) rel = rel > SPAN + (360 - SPAN) / 2 ? 0 : SPAN;
      let nv = rel / SPAN;
      if (prev < 0.2 && nv > 0.8) nv = 0;
      if (prev > 0.8 && nv < 0.2) nv = 1;
      prev = nv;
      return nv;
    }
    V.gesture(el, {
      start() { center = V.display.centerOf(svg); prev = v; },
      move(p) { if (p.moved) setV(fromPoint(p), false, false); },
      tap(p) { setV(fromPoint(p), true, true); },
      end(p) { if (p.moved && o.onCommit) o.onCommit(v); },
    }, { slop: 4 });
    return { el, get: () => v, set(nv) { setV(nv, true, false); }, crown(dA) { setV(v + dA / 300, false, true); } };
  }

  /** geschwungener Schieberegler (flacher Bogen, folgt der Kreisform) */
  function curveSlider(o) {
    const P0 = { x: 40, y: 34 }, P1 = { x: 344, y: 118 }, P2 = { x: 648, y: 34 };
    const svgW = 688, svgH = 126;
    let v = U.clamp((o.value - o.min) / (o.max - o.min), 0, 1);
    const svg = U.svg('svg', { viewBox: `0 0 ${svgW} ${svgH}`, 'data-nogesture': 'all', role: 'slider', 'aria-label': o.title });
    const track = U.svg('path', { d: `M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`, fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 15, 'stroke-linecap': 'round' });
    const fill = U.svg('path', { fill: 'none', stroke: o.color || '#fff', 'stroke-width': 15, 'stroke-linecap': 'round' });
    const knob = U.svg('circle', { r: 24, fill: '#fff' });
    const knobS = U.svg('circle', { r: 30, fill: o.color || '#fff', opacity: 0.25 });
    const marks = U.svg('g');
    for (const m of o.marks || []) {
      const s = (m - o.min) / (o.max - o.min);
      const b = bez(s);
      marks.appendChild(U.svg('circle', { cx: b.x, cy: b.y + 26, r: 3.4, fill: 'rgba(255,255,255,.3)' }));
    }
    svg.append(marks, track, fill, knobS, knob);
    const c = card(o.title, '', svg);
    function bez(s) {
      const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, d = s * s;
      return { x: a * P0.x + b * P1.x + d * P2.x, y: a * P0.y + b * P1.y + d * P2.y };
    }
    function paint() {
      const e = bez(v);
      const q = { x: P0.x + (P1.x - P0.x) * v, y: P0.y + (P1.y - P0.y) * v };
      fill.setAttribute('d', `M${P0.x} ${P0.y} Q${q.x.toFixed(1)} ${q.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`);
      knob.setAttribute('cx', e.x); knob.setAttribute('cy', e.y);
      knobS.setAttribute('cx', e.x); knobS.setAttribute('cy', e.y);
      if (c._value) c._value.textContent = o.fmt(value());
    }
    const value = () => {
      const raw = o.min + v * (o.max - o.min);
      return o.step ? Math.round(raw / o.step) * o.step : raw;
    };
    let last = value();
    function fromEvent(e) {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * svgW;
      v = U.clamp((x - P0.x) / (P2.x - P0.x), 0, 1);
      paint();
      const nv = value();
      if (nv !== last) { last = nv; V.sound.play('tick'); V.haptic(3); if (o.onChange) o.onChange(nv); }
    }
    V.gesture(svg, {
      start(p, e) { knob.setAttribute('r', 28); fromEvent(e); },
      move(p, e) { fromEvent(e); },
      end() { knob.setAttribute('r', 24); if (o.onCommit) o.onCommit(value()); },
    }, { slop: 2 });
    paint();
    return { el: c, crown(dA) { v = U.clamp(v + dA / 400, 0, 1); paint(); const nv = value(); if (nv !== last) { last = nv; if (o.onChange) o.onChange(nv); } } };
  }

  /* ----------------------------------------------------------- Farben */
  function hexToHsl(hex) {
    const [r, g, b] = U.hexToRgb(hex).map((x) => x / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }
  const hueHex = (h) => U.hsl(h, 100, 64);
  function hueName(h) {
    h = U.wrap(h, 360);
    return h < 12 ? 'Rot' : h < 40 ? 'Orange' : h < 62 ? 'Gelb' : h < 82 ? 'Limette' : h < 160 ? 'Grün' : h < 186 ? 'Türkis' : h < 214 ? 'Himmelblau' : h < 248 ? 'Blau' : h < 285 ? 'Violett' : h < 318 ? 'Magenta' : h < 346 ? 'Pink' : 'Rot';
  }
  function colorName(hex) {
    const p = PRESETS().find((c) => c.v.toUpperCase() === String(hex).toUpperCase());
    return p ? p.label : hueName(hexToHsl(hex).h);
  }
  function faceName() { const f = V.faces.get(V.faces.current || get('settings.face', 'monolith')); return f ? f.name : '—'; }
  function styleName(v) { const s = STYLES.find((x) => x.v === v); return s ? s.label : 'Aurora'; }
  function stylePalette(v) {
    if (v === 'mono') return ['#FFFFFF', '#CFD6E6', '#FFFFFF', '#AEB8CC', '#FFFFFF'];
    if (v === 'accent') { const a = get('settings.accent', '#FF9A4D'); return [U.lighten(a, 0.35), a, U.mix(a, '#B46BFF', 0.35), a, U.lighten(a, 0.2)]; }
    return ['#46E6FF', '#6F7BFF', '#B46BFF', '#FF6FB5', '#FFB86B'];
  }
  const conic = (cols) => `conic-gradient(from 0deg, ${cols.concat(cols[0]).join(', ')})`;
  function idleLabel(s) { const o = IDLE.find((x) => x.v === s); return o ? o.label : s + ' s'; }
  const h2 = (h) => U.pad(Math.round(h) % 24) + ':00';
  function nightSub() {
    const m = get('settings.night', 'auto');
    return m === 'on' ? 'Nachtmodus an' : m === 'off' ? 'Nachtmodus aus' : `Nachts ${get('settings.nightFrom', 22)}–${get('settings.nightTo', 7)} Uhr`;
  }

  /* ------------------------------------------------------------- Seiten */
  const PAGES = {};

  PAGES.main = {
    title: 'Einstellungen',
    build(P, nav) {
      const me = U.el('div', { class: 'st-me', attrs: { role: 'button', tabindex: '0' } });
      const meName = U.el('b'), meSub = U.el('small');
      me.append(vistoMark('12cqw'), meName, meSub);
      V.ui.tap(me, () => nav.push('about'));
      const items = () => {
        const name = get('user.name', '');
        meName.textContent = name ? name + (/[sxzß]$/i.test(name) ? '’' : 's') + ' Visto' : 'Visto';
        meSub.textContent = 'VistoOS ' + V.version + ' · ' + (V.device.model || 'V1');
        const go = (id) => () => nav.push(id);
        return [
          { icon: 'brightness', color: '#FF9F0A', title: 'Anzeige', sub: `Helligkeit ${pct(get('settings.brightness', 0.9))} · ${get('settings.alwaysOn', true) ? 'Always-On' : 'Ruhe aus'}`, end: chev(), onClick: go('display') },
          { icon: 'face', color: '#5E5CE6', title: 'Zifferblatt', sub: faceName(), end: chev(), onClick: go('face') },
          { icon: 'palette', color: get('settings.accent', '#FF9A4D'), iconColor: U.luma(get('settings.accent', '#FF9A4D')) > 0.6 ? '#1a0d02' : '#fff', title: 'Farbe', sub: colorName(get('settings.accent', '#FF9A4D')), end: chev(), onClick: go('color') },
          { icon: 'clock', color: '#0A84FF', title: 'Datum & Uhrzeit', sub: (V.time.isManual() ? 'Manuell' : 'Automatisch') + ' · ' + (get('settings.use24h', true) ? '24 Std.' : '12 Std.'), end: chev(), onClick: go('time') },
          { icon: 'visto', color: '#7A5CFF', title: 'Visto', sub: (get('settings.voice', true) ? 'Stimme an' : 'Stimme aus') + ' · ' + styleName(get('settings.vistoStyle', 'aurora')), end: chev(), onClick: go('visto') },
          { icon: 'volume', color: '#FF375F', title: 'Töne & Haptik', sub: 'Lautstärke ' + pct(get('settings.volume', 0.6)), end: chev(), onClick: go('sound') },
          { icon: 'wifi', color: '#0A84FF', title: 'WLAN', sub: get('settings.wifi') || 'Nicht verbunden', end: chev(), onClick: go('wifi') },
          { icon: 'location', color: '#32D74B', title: 'Ort', sub: get('settings.location', 'Berlin'), end: chev(), onClick: go('location') },
          { icon: 'info', color: '#636366', title: 'Über Visto', sub: 'VistoOS ' + V.version + ' (' + V.build + ')', end: chev(), onClick: go('about') },
          { icon: 'reset', color: '#FF453A', title: 'Zurücksetzen', sub: 'Alle Daten löschen', cls: 'st-danger', onClick: () => confirmReset() },
        ];
      };
      const list = V.ui.roundList({ items: items(), header: me });
      list.el.style.paddingTop = '19cqw';
      P.el.appendChild(list.el);
      return { list, refresh() { list.setItems(items()); } };
    },
  };

  PAGES.display = {
    title: 'Anzeige',
    build(P, nav) {
      let list;
      const g = gauge({
        label: 'Helligkeit', value: get('settings.brightness', 0.9), min: 0.05, c0: '#FF9F0A', c1: '#FFE68A', icon: 'brightness', iconMin: 'moon',
        onInput: (v) => set('settings.brightness', v),
      });
      const items = () => {
        const night = get('settings.night', 'auto');
        const out = [
          { el: g.el },
          { el: toggleRow({ icon: 'sparkle', color: '#FF9F0A', title: 'Auto-Helligkeit', subFn: (on) => on ? 'Passt sich dem Raumlicht an' : 'Feste Helligkeit', get: () => get('settings.autoBrightness', true), set: (v) => set('settings.autoBrightness', v) }) },
          { el: toggleRow({ icon: 'clock', color: '#5E5CE6', title: 'Always-On', subFn: (on) => on ? 'Uhr bleibt gedimmt sichtbar' : 'Display geht ganz aus', get: () => get('settings.alwaysOn', true), set: (v) => set('settings.alwaysOn', v) }) },
          { section: 'Ruhezeit' },
          { el: card(null, undefined, seg(IDLE, get('settings.idleSec', 60), (v) => set('settings.idleSec', v)).el, U.el('div', { class: 'st-note', text: 'Danach wechselt Visto in den Ruhemodus.' })) },
          { section: 'Nachtmodus' },
        ];
        const nightSeg = seg([{ v: 'auto', label: 'Auto' }, { v: 'on', label: 'An' }, { v: 'off', label: 'Aus' }], night, (v) => { set('settings.night', v); setTimeout(() => list.setItems(items()), 260); });
        const kids = [nightSeg.el];
        if (night === 'auto') {
          const pill = (which, label) => {
            const b = U.el('button', { class: 'st-pill', attrs: { type: 'button' } }, U.el('small', { text: label }), U.el('b', { text: h2(get(which === 'from' ? 'settings.nightFrom' : 'settings.nightTo', which === 'from' ? 22 : 7)) }));
            V.ui.tap(b, () => nav.push('nightpick', which));
            return b;
          };
          kids.push(U.el('div', { class: 'st-pills', style: { marginTop: '2.4cqw' } }, pill('from', 'Ab'), pill('to', 'Bis')));
        }
        kids.push(U.el('div', { class: 'st-note', text: night === 'off' ? 'Das Display bleibt immer neutral.' : 'Warmes Rotlicht und weniger Helligkeit – schont die Augen.' }));
        out.push({ el: card(null, undefined, ...kids) });
        return out;
      };
      list = V.ui.roundList({ items: items() });
      list.el.style.paddingTop = '17cqw';
      P.el.appendChild(list.el);
      P.on('store:settings.brightness', (v) => { if (Math.abs(v - g.get()) > 0.004) g.set(v); });
      return { list, crown: (dA) => list.crown(dA), refresh() { list.setItems(items()); } };
    },
  };

  PAGES.nightpick = {
    title: 'Nachtmodus',
    build(P, nav, which) {
      const key = which === 'to' ? 'settings.nightTo' : 'settings.nightFrom';
      const cur = get(key, which === 'to' ? 7 : 22);
      const hours = Array.from({ length: 24 }, (_, i) => h2(i));
      const box = U.el('div', { class: 'st-pick' });
      const w = V.ui.wheel({ items: hours, index: cur, rows: 5, itemH: 11, size: 8.4, width: '44cqw', onChange: (i) => set(key, i) });
      box.append(U.el('div', { class: 'vos-label', style: { marginBottom: '1cqw' }, text: which === 'to' ? 'Nachtmodus endet' : 'Nachtmodus beginnt' }), w.el,
        V.ui.button('Fertig', { kind: 'white', style: { marginTop: '2.6cqw', minWidth: '32cqw', height: '11cqw' }, onClick: () => nav.pop() }));
      P.el.appendChild(box);
      return { crown: (dA) => w.crown(dA) };
    },
  };

  PAGES.face = {
    title: 'Zifferblatt',
    build(P, nav) {
      const list = V.faces.list();
      let idx = Math.max(0, list.findIndex((f) => f.id === V.faces.current));
      const stage = U.el('div', { class: 'st-fstage', attrs: { 'data-nogesture': 'all' } });
      const slots = list.map((f) => {
        const s = U.el('div', { class: 'st-fslot', attrs: { 'aria-label': f.name } }, U.el('div', { class: 'st-fname0', text: f.name.charAt(0) }));
        stage.appendChild(s);
        return { f, el: s, pv: null };
      });
      const dots = U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      const dotEls = list.map((f, i) => {
        const a = (i - (list.length - 1) / 2) * 4.2;
        const p = V.display.pt(a, 402);
        const c = U.svg('circle', { cx: p.x, cy: p.y, r: 6, fill: '#fff' });
        dots.appendChild(c);
        return c;
      });
      const name = U.el('div', { class: 'vos-h2' });
      const sub = U.el('div', { class: 'vos-label', style: { marginTop: '1.2cqw' } });
      const info = U.el('div', { class: 'st-finfo' }, name, sub);
      const btnBox = U.el('div', { class: 'st-fbtn' });
      P.el.append(dots, stage, info, btnBox);
      const pos = V.spring(idx, { response: 0.46, bounce: 0.12 });
      function live() {
        slots.forEach((s, i) => {
          const near = Math.abs(i - idx) <= 1;
          if (near && !s.pv) { s.pv = V.faces.preview(s.f.id, s.el); }
          else if (!near && s.pv) { s.pv.destroy(); s.pv = null; }
        });
      }
      function render(v) {
        slots.forEach((s, i) => {
          const d = i - v, ad = Math.abs(d);
          if (ad > 2.2) { s.el.style.visibility = 'hidden'; return; }
          s.el.style.visibility = '';
          const sc = 1 - Math.min(1.5, ad) * 0.38;
          s.el.style.transform = `translate(${(d * 39).toFixed(2)}cqw, ${(Math.min(ad, 1.5) * 7).toFixed(2)}cqw) scale(${sc.toFixed(4)})`;
          s.el.style.opacity = (1 - Math.min(1, ad) * 0.62).toFixed(3);
          s.el.style.zIndex = String(10 - Math.round(ad * 3));
        });
        dotEls.forEach((c, i) => {
          const k = Math.max(0, 1 - Math.abs(i - v));
          c.setAttribute('r', (5 + 4 * k).toFixed(2));
          c.setAttribute('opacity', (0.28 + 0.72 * k).toFixed(3));
        });
      }
      function paintInfo() {
        const f = list[idx];
        const isCur = f && f.id === V.faces.current;
        name.textContent = f ? f.name : '';
        sub.textContent = isCur ? 'Aktiv' : (idx + 1) + ' von ' + list.length;
        sub.style.color = isCur ? 'var(--accent)' : '';
        slots.forEach((s) => s.el.classList.toggle('cur', s.f.id === V.faces.current));
        btnBox.innerHTML = '';
        btnBox.appendChild(isCur
          ? V.ui.button('Anpassen', { icon: 'edit', kind: 'white', style: { height: '11cqw' }, onClick: customize })
          : V.ui.button('Wählen', { icon: 'check', kind: 'primary', style: { height: '11cqw' }, onClick: choose }));
      }
      function go(i) {
        i = U.clamp(i, 0, list.length - 1);
        if (i !== idx) { idx = i; V.sound.play('tick'); V.haptic(4); }
        live(); paintInfo();
        pos.to(idx);
      }
      function choose() {
        const f = list[idx];
        if (!f) return;
        V.faces.show(f.id);
        V.sound.play('success');
        paintInfo();
      }
      function customize() {
        const f = list[idx];
        if (f && f.id !== V.faces.current) V.faces.show(f.id);
        V.shell.home();
        setTimeout(() => { if (V.faceEditor && V.faceEditor.open) V.faceEditor.open(); }, 620);
      }
      pos.onUpdate(render);
      let v0 = 0;
      V.gesture(stage, {
        start() { v0 = pos.value; pos.stop(); },
        move(p) { if (p.moved) { let v = v0 - p.dx / 390; if (v < 0) v *= 0.3; if (v > list.length - 1) v = list.length - 1 + (v - list.length + 1) * 0.3; pos.set(v); } },
        end(p) {
          if (!p.moved) return;
          let target = Math.round(pos.value - (p.vx / 390) * 0.16);
          target = U.clamp(target, idx - 2, idx + 2);
          go(target);
          pos.to(idx, { velocity: -p.vx / 390 });
        },
        tap(p, e) {
          const el = e.target.closest && e.target.closest('.st-fslot');
          const i = slots.findIndex((s) => s.el === el);
          if (i < 0) return;
          V.sound.play('tap');
          if (i === idx) choose(); else go(i);
        },
      }, { slop: 8 });
      live(); paintInfo(); render(idx);
      let acc = 0;
      P.onDestroy = () => slots.forEach((s) => { if (s.pv) s.pv.destroy(); s.pv = null; });
      P.on('face:changed', () => paintInfo());
      return { crown(dA) { acc += dA; if (Math.abs(acc) > 22) { go(idx + Math.sign(acc)); acc = 0; } } };
    },
  };

  PAGES.color = {
    title: 'Farbe',
    build(P) {
      P.el.setAttribute('data-nogesture', 'all');
      let hex = get('settings.accent', '#FF9A4D');
      let hue = hexToHsl(hex).h;
      const stops = [];
      for (let h = 0; h <= 360; h += 15) stops.push(`${hueHex(h)} ${h}deg`);
      const ring = U.el('div', { class: 'st-hue', style: { background: `conic-gradient(from 0deg, ${stops.join(', ')})` } });
      const marks = U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      for (const p of PRESETS()) {
        const pp = V.display.pt(hexToHsl(p.v).h, 380);
        marks.appendChild(U.svg('circle', { cx: pp.x, cy: pp.y, r: 6, fill: p.v, opacity: 0.95 }));
      }
      const knob = U.el('div', { class: 'st-knob' });
      const orb = U.el('div', { class: 'st-orb' });
      const nm = U.el('div', { class: 'vos-h1' });
      const hx = U.el('div', { class: 'vos-small' });
      const info = U.el('div', { class: 'st-cinfo' }, nm, hx);
      const hint = U.el('div', { class: 'vos-label', style: { position: 'absolute', left: 0, right: 0, top: '71cqw', textAlign: 'center', pointerEvents: 'none' }, text: 'Am Ring drehen' });
      P.el.append(ring, marks, orb, info, hint, knob);
      function paint() {
        const p = V.display.pt(hue, 430);
        knob.style.left = p.x / 10 + 'cqw'; knob.style.top = p.y / 10 + 'cqw';
        knob.style.background = hex;
        knob.style.setProperty('--k', U.rgba(hex, 0.9));
        orb.style.background = `radial-gradient(circle at 38% 30%, ${U.lighten(hex, 0.45)} 0%, ${hex} 48%, ${U.darken(hex, 0.25)} 100%)`;
        orb.style.boxShadow = `0 0 9cqw 1cqw ${U.rgba(hex, 0.5)}, 0 0 22cqw 4cqw ${U.rgba(hex, 0.2)}, inset 0 -1.4cqw 3cqw rgba(0,0,0,.25)`;
        nm.textContent = colorName(hex);
        hx.textContent = hex.toUpperCase();
        P.titleEl.style.setProperty('--fg2', U.rgba(hex, 0.85));
      }
      let snapped = null;
      function fromAngle(a) {
        hue = U.wrap(a, 360);
        let snap = null;
        for (const p of PRESETS()) { const ph = hexToHsl(p.v).h; if (Math.abs(U.angDiff(ph, hue)) < 4.5) { snap = p; hue = ph; break; } }
        hex = snap ? snap.v : hueHex(hue);
        if ((snap && snap.v) !== snapped) { snapped = snap && snap.v; if (snap) { V.sound.play('tick'); V.haptic(6); } }
        paint();
      }
      const commit = () => { if (get('settings.accent') !== hex) { set('settings.accent', hex); } };
      let on = false;
      V.gesture(P.el, {
        start(p, e) { on = p.r0 > 320 && !(e.target.closest && e.target.closest('.st-back')); if (on) { knob.classList.add('big'); fromAngle(p.a); } },
        move(p) { if (on) fromAngle(p.a); },
        end() { if (on) { knob.classList.remove('big'); commit(); } on = false; },
      }, { slop: 3 });
      paint();
      return { crown(dA) { fromAngle(hue + dA * 0.6); clearTimeout(P._ct); P._ct = setTimeout(commit, 400); } };
    },
  };

  PAGES.time = {
    title: 'Datum & Uhrzeit',
    build(P) {
      const big = U.el('div', { class: 'st-big' });
      const date = U.el('div', { class: 'vos-label' });
      const hero = U.el('div', { class: 'st-hero' }, big, date);
      const tick = () => {
        const n = V.time.now();
        const p = V.fmt.parts(n);
        big.innerHTML = U.esc(p.hh + ':' + p.mm) + '<small>' + (V.fmt.h24() ? U.esc(p.ss) : p.ampm) + '</small>';
        date.textContent = V.fmt.dateLong(n) + ' ' + n.getFullYear();
      };
      tick();
      P.on('time:second', tick);
      P.on('store:settings.use24h', tick);
      let list;
      const items = () => {
        const manual = V.time.isManual();
        const out = [{ el: hero }];
        const modeSeg = seg([{ v: 'auto', label: 'Automatisch' }, { v: 'manual', label: 'Manuell' }], manual ? 'manual' : 'auto', (v) => {
          if (v === 'manual') { const d = V.time.now(); d.setSeconds(0, 0); V.time.setManual(d); } else V.time.setAuto();
          tick();
          setTimeout(() => list.setItems(items()), 240);
        });
        const kids = [modeSeg.el];
        if (manual) {
          const n = V.time.now();
          let hw = null, mw = null;
          const apply = () => { if (!hw || !mw) return; const d = V.time.now(); d.setHours(hw.get(), mw.get(), 0, 0); V.time.setManual(d); tick(); };
          hw = V.ui.wheel({ items: Array.from({ length: 24 }, (_, i) => U.pad(i)), index: n.getHours(), rows: 3, itemH: 10.5, size: 7.6, width: '19cqw', onChange: apply });
          mw = V.ui.wheel({ items: Array.from({ length: 60 }, (_, i) => U.pad(i)), index: n.getMinutes(), rows: 3, itemH: 10.5, size: 7.6, width: '19cqw', onChange: apply });
          kids.push(U.el('div', { class: 'st-wheels', style: { marginTop: '2.4cqw' } }, hw.el, U.el('div', { class: 'st-colon', text: ':' }), mw.el));
          kids.push(U.el('div', { class: 'st-note', text: 'Drehen zum Stellen – gilt sofort.' }));
          P.wheels = [hw, mw];
        } else {
          kids.push(U.el('div', { class: 'st-note', text: 'Zeit und Datum kommen aus dem Netz.' }));
          P.wheels = null;
        }
        out.push({ el: card(null, undefined, ...kids) });
        out.push({ el: toggleRow({ icon: 'clock', color: '#0A84FF', title: '24-Stunden-Format', subFn: (on) => on ? '18:30' : '6:30 PM', get: () => get('settings.use24h', true), set: (v) => set('settings.use24h', v) }) });
        out.push({ el: toggleRow({ icon: 'stopwatch', color: '#FF9F0A', title: 'Sekunden zeigen', sub: 'Auf passenden Zifferblättern', get: () => get('settings.showSeconds', false), set: (v) => set('settings.showSeconds', v) }) });
        return out;
      };
      list = V.ui.roundList({ items: items() });
      list.el.style.paddingTop = '19cqw';
      P.el.appendChild(list.el);
      return { list, crown: (dA) => list.crown(dA) };
    },
  };

  PAGES.visto = {
    title: 'Visto',
    build(P) {
      const ring = U.el('div', { class: 'st-vring' });
      const gI = U.el('i', { class: 'g' }), rI = U.el('i');
      const eyeL = U.el('em', { style: { left: '9.4cqw' } }), eyeR = U.el('em', { style: { left: '14.4cqw' } });
      ring.append(gI, rI, eyeL, eyeR);
      const paintRing = () => { const c = conic(stylePalette(get('settings.vistoStyle', 'aurora'))); gI.style.background = c; rI.style.background = c; };
      paintRing();
      const styles = U.el('div', { class: 'st-styles', attrs: { role: 'radiogroup' } });
      const sBtns = STYLES.map((s) => {
        const b = U.el('button', { class: 'st-style', attrs: { type: 'button', role: 'radio' } }, U.el('i', { style: { background: conic(stylePalette(s.v)) } }), U.el('span', { text: s.label }));
        V.ui.tap(b, () => { set('settings.vistoStyle', s.v); paintStyles(); paintRing(); });
        styles.appendChild(b);
        return b;
      });
      function paintStyles() { const cur = get('settings.vistoStyle', 'aurora'); STYLES.forEach((s, i) => { sBtns[i].classList.toggle('on', s.v === cur); sBtns[i].setAttribute('aria-checked', s.v === cur ? 'true' : 'false'); }); }
      paintStyles();
      const hero = U.el('div', { class: 'st-hero', style: { marginBottom: '2cqw' } }, ring);
      const aiAvail = () => aiSeen || !!(V.brain && V.brain.claudeReady);
      const rate = curveSlider({
        title: 'Sprechtempo', value: get('settings.voiceRate', 1.04), min: 0.7, max: 1.5, step: 0.05, marks: [1],
        color: '#B46BFF', fmt: (v) => V.fmt.num(v, 2).replace(/0$/, '') + '×',
        onChange: (v) => set('settings.voiceRate', v),
        onCommit: () => { if (V.voice && V.voice.canSpeak && get('settings.voice', true)) { V.voice.stop(); V.voice.speak('So klinge ich.'); } },
      });
      const items = [
        { el: hero },
        { el: styles },
        { el: toggleRow({ icon: 'cc-voice', color: '#B46BFF', title: 'Stimme', subFn: (on) => on ? 'Visto spricht Antworten' : 'Nur Text', get: () => get('settings.voice', true), set: (v) => set('settings.voice', v) }) },
        { el: rate.el },
        { el: toggleRow({ icon: 'sparkle', color: '#FF9F0A', title: 'KI-Antworten', subFn: () => aiAvail() ? (get('settings.vistoAI', true) ? 'Claude ist verbunden' : 'Claude verfügbar') : 'Gerade nicht verfügbar', get: () => get('settings.vistoAI', true), set: (v) => set('settings.vistoAI', v) }) },
        { el: toggleRow({ icon: 'mic', color: '#FF453A', title: 'Mikrofon', subFn: (on) => on ? 'Antippen der Linie hört zu' : 'Stumm · nur Texteingabe', get: () => !get('settings.micMuted', false), set: (v) => set('settings.micMuted', !v) }) },
        { el: U.el('div', { class: 'st-note', style: { width: '60cqw', margin: '1cqw auto 0' }, text: aiAvail() ? 'Eingebaute Absichten antworten sofort, alles andere beantwortet Claude.' : 'Ohne KI beantwortet Visto alles, was es selbst kann – Timer, Wetter, Rechnen …' }) },
      ];
      const list = V.ui.roundList({ items });
      list.el.style.paddingTop = '17cqw';
      P.el.appendChild(list.el);
      P.on('store:settings.accent', paintRing);
      return { list, crown: (dA) => list.crown(dA) };
    },
  };

  PAGES.sound = {
    title: 'Töne & Haptik',
    build(P) {
      const g = gauge({
        label: 'Lautstärke', value: get('settings.volume', 0.6), min: 0, c0: '#5E8BFF', c1: '#FFFFFF', icon: 'volume', iconMin: 'mute',
        onInput: (v) => set('settings.volume', v),
        onCommit: () => V.sound.play('notify'),
      });
      const items = [
        { el: g.el },
        { el: toggleRow({ icon: 'bell', color: '#FF375F', title: 'Systemtöne', subFn: (on) => on ? 'Klicks, Hinweise, Timer' : 'Still – Wecker klingen trotzdem', get: () => get('settings.sounds', true), set: (v) => { set('settings.sounds', v); if (v) V.sound.play('success'); } }) },
        { el: toggleRow({ icon: 'heartbeat', color: '#FF9F0A', title: 'Haptik', subFn: (on) => on ? 'Feines Rastgefühl beim Drehen' : 'Aus', get: () => get('settings.haptics', true), set: (v) => set('settings.haptics', v) }) },
        { el: toggleRow({ icon: 'belloff', color: '#5E5CE6', title: 'Nicht stören', subFn: (on) => on ? 'Hinweise kommen lautlos' : 'Aus', get: () => get('settings.dnd', false), set: (v) => set('settings.dnd', v) }) },
      ];
      const list = V.ui.roundList({ items });
      list.el.style.paddingTop = '17cqw';
      P.el.appendChild(list.el);
      P.on('store:settings.volume', (v) => { if (Math.abs(v - g.get()) > 0.004) g.set(v); });
      return { list, crown: (dA) => list.crown(dA) };
    },
  };

  function sigIcon(n) {
    const s = U.svg('svg', { viewBox: '0 0 24 24', fill: 'none', 'stroke-linecap': 'round', 'stroke-width': 2.4 });
    const arcs = ['M5 10.5a10 10 0 0 1 14 0', 'M8 14a5.6 5.6 0 0 1 8 0'];
    arcs.forEach((d, i) => s.appendChild(U.svg('path', { d, stroke: n >= 3 - i ? 'currentColor' : 'rgba(255,255,255,.22)' })));
    s.appendChild(U.svg('circle', { cx: 12, cy: 17.6, r: 1.6, fill: 'currentColor' }));
    return s;
  }

  PAGES.wifi = {
    title: 'WLAN',
    build(P) {
      const waves = U.svg('svg', { class: 'st-waves', viewBox: '0 0 120 88' });
      const wPaths = ['M14 40a66 66 0 0 1 92 0', 'M30 56a42 42 0 0 1 60 0', 'M46 71a19 19 0 0 1 28 0'].map((d, i) => {
        const p = U.svg('path', { d, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round' });
        p.style.animationDelay = (0.5 - i * 0.25) + 's';
        waves.appendChild(p);
        return p;
      });
      const dot = U.svg('circle', { cx: 60, cy: 82, r: 5.5 });
      waves.appendChild(dot);
      const hl = U.el('div', { class: 'vos-label' });
      const hn = U.el('div', { class: 'vos-h2', style: { marginTop: '1cqw' } });
      const hero = U.el('div', { class: 'st-hero' }, waves, hl, hn);
      let connecting = null, list;
      function paintHero() {
        const w = get('settings.wifi');
        const c = connecting ? '#64D2FF' : w ? '#0A84FF' : 'rgba(255,255,255,.25)';
        wPaths.forEach((p) => { p.setAttribute('stroke', c); p.classList.toggle('w', !!(w || connecting)); });
        dot.setAttribute('fill', c);
        hl.textContent = connecting ? 'Verbinde mit' : w ? 'Verbunden mit' : 'WLAN';
        hn.textContent = connecting || w || 'Nicht verbunden';
      }
      function connect(n) {
        if (connecting) return;
        if (get('settings.wifi') === n.name) { V.notify.toast('Bereits verbunden', 'check'); return; }
        connecting = n.name;
        paintHero(); list.setItems(items());
        const l = V.rim.loading({ color: '#0A84FF' });
        P.timeout(async () => {
          await l.done();
          if (!connecting) return;
          set('settings.wifi', n.name);
          set('settings.wifiLast', n.name);
          connecting = null;
          V.sound.play('success');
          V.notify.toast('Verbunden mit ' + n.name, 'wifi');
          paintHero(); list.setItems(items());
        }, 1300);
        P.offs.push(() => l.cancel());
      }
      const items = () => {
        const w = get('settings.wifi');
        const out = [
          { el: hero },
          { el: toggleRow({ icon: 'wifi', color: '#0A84FF', title: 'WLAN', subFn: (on) => on ? 'An' : 'Aus – Visto ist offline', get: () => !!(get('settings.wifi') || connecting), set: (v) => { if (v) connect(NETWORKS.find((n) => n.name === get('settings.wifiLast')) || NETWORKS[0]); else { connecting = null; set('settings.wifi', ''); paintHero(); setTimeout(() => list.setItems(items()), 200); } } }) },
        ];
        if (w || connecting) {
          out.push({ section: 'Netzwerke in der Nähe' });
          for (const n of NETWORKS) {
            const isOn = w === n.name, isC = connecting === n.name;
            out.push({
              icon: isOn ? 'check' : n.sec ? 'lock' : 'wifi', color: isOn ? '#0A84FF' : 'rgba(255,255,255,.1)',
              title: n.name,
              sub: isC ? 'Verbinde …' : isOn ? 'Verbunden' : n.sec ? 'Gesichert' : 'Offen',
              end: U.el('div', { class: 'st-sig', style: { color: isOn ? '#fff' : '' } }, sigIcon(n.s)),
              onClick: () => connect(n),
            });
          }
        }
        return out;
      };
      paintHero();
      list = V.ui.roundList({ items: items() });
      list.el.style.paddingTop = '17cqw';
      P.el.appendChild(list.el);
      return { list, crown: (dA) => list.crown(dA) };
    },
  };

  PAGES.location = {
    title: 'Ort',
    build(P) {
      const city = U.el('div', { class: 'vos-h1' });
      const pin = U.el('div', { class: 'st-pin' }, U.el('b'), U.el('b'), U.el('div', { class: 'vos-icon', style: { '--ic': '#32D74B' }, html: V.icon('location') }));
      const hero = U.el('div', { class: 'st-hero' }, pin, city, U.el('div', { class: 'vos-small', style: { marginTop: '1cqw' }, text: 'Für Wetter, Sonnenzeiten und Weltuhr' }));
      let list;
      const items = () => {
        const cur = get('settings.location', 'Berlin');
        city.textContent = cur;
        return [{ el: hero }, { section: 'Städte' }].concat(CITIES.map((c) => ({
          title: c, icon: c === cur ? 'check' : 'location', color: c === cur ? '#32D74B' : 'rgba(255,255,255,.1)',
          onClick: () => { if (c === cur) return; set('settings.location', c); V.sound.play('success'); list.setItems(items()); },
        })));
      };
      list = V.ui.roundList({ items: items() });
      list.el.style.paddingTop = '17cqw';
      P.el.appendChild(list.el);
      return { list, crown: (dA) => list.crown(dA) };
    },
  };

  PAGES.about = {
    title: 'Über Visto',
    build(P) {
      const name = get('user.name', '');
      const hero = U.el('div', { class: 'st-hero' },
        vistoMark('22cqw'),
        U.el('div', { class: 'vos-h1', style: { marginTop: '2cqw' }, text: V.device.name || 'Visto' }),
        U.el('div', { class: 'vos-small', style: { marginTop: '.8cqw' }, text: (name ? name + (/[sxzß]$/i.test(name) ? '’' : 's') + ' Schreibtisch-Assistent' : 'Schreibtisch-Assistent') }));
      // Speicher als Ring
      const used = STORAGE.reduce((s, x) => s + x.gb, 0);
      const donut = U.el('div', { class: 'st-donut' });
      const ds = U.svg('svg', { viewBox: '0 0 100 100' });
      ds.appendChild(U.svg('circle', { cx: 50, cy: 50, r: 42, fill: 'none', stroke: 'rgba(255,255,255,.09)', 'stroke-width': 7 }));
      let a = 0;
      const segs = STORAGE.map((s) => {
        const span = (s.gb / STORAGE_TOTAL) * 360;
        const pth = U.svg('path', { d: V.ui.arcPath(50, 50, 42, a + 1.6, a + span - 1.6), fill: 'none', stroke: s.color, 'stroke-width': 7, 'stroke-linecap': 'round' });
        pth._a = a; pth._span = span;
        a += span;
        ds.appendChild(pth);
        return pth;
      });
      donut.append(ds, U.el('div', null, U.el('b', { text: V.fmt.num(used, 1) + ' GB' }), U.el('span', { class: 'vos-label', style: { marginTop: '.8cqw' }, text: 'von ' + STORAGE_TOTAL + ' GB' })));
      const legend = U.el('div', { class: 'st-legend' }, ...STORAGE.map((s) => U.el('span', null, U.el('i', { style: { background: s.color } }), s.label)), U.el('span', null, U.el('i', { style: { background: 'rgba(255,255,255,.18)' } }), 'Frei'));
      // Ring wächst beim Öffnen
      const grow = V.spring(0, { response: 0.9, bounce: 0 });
      grow.onUpdate((k) => segs.forEach((p) => { const e = Math.max(p._a + 1.7, p._a + 1.6 + (p._span - 3.2) * U.clamp(k * 1.4 - p._a / 360 * 0.4, 0, 1)); p.setAttribute('d', V.ui.arcPath(50, 50, 42, p._a + 1.6, e)); }));
      P.timeout(() => grow.to(1), 260);
      const disp = String(V.device.display || '').split('·').map((s) => s.trim());
      const serial = 'V1' + U.hash('visto' + (name || 'x')).toString(36).toUpperCase().padStart(7, '0').slice(0, 7) + 'DE';
      const mac = Array.from({ length: 6 }, (_, i) => U.pad(((U.hash('mac' + i + name) >>> 3) % 256).toString(16).toUpperCase())).join(':');
      const up = () => { const s = Math.round(performance.now() / 1000); return s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' Min.' : (s / 3600).toFixed(1).replace('.', ',') + ' Std.'; };
      const row = (title, value) => ({ title, end: value });
      const items = [
        { el: hero },
        row('Software', 'VistoOS ' + V.version),
        row('Build', V.build),
        row('Modell', (V.device.name || 'Visto') + ' ' + (V.device.model || 'V1')),
        { section: 'Display' },
        row('Größe', '7″ OLED · rund'),
        row('Auflösung', disp[2] || '1080 × 1080'),
        row('Bildrate', disp[3] || '90 Hz'),
        { section: 'Speicher' },
        { el: donut }, { el: legend },
        row('Arbeitsspeicher', '4 GB'),
        row('Chip', 'Visto N1 · 6 Kerne'),
        { section: 'Netz & Gerät' },
        row('WLAN', get('settings.wifi') || '–'),
        row('WLAN-Adresse', mac),
        row('Seriennummer', serial),
        row('Laufzeit', up()),
      ];
      const list = V.ui.roundList({ items });
      list.el.style.paddingTop = '17cqw';
      P.el.appendChild(list.el);
      return { list, crown: (dA) => list.crown(dA) };
    },
  };

  /* ---------------------------------------------------------- Zurücksetzen */
  let resetting = false;
  async function confirmReset() {
    if (resetting) return;
    const v = await V.notify.alert({
      title: 'Zurücksetzen?', body: 'Alle Einstellungen, Wecker und Daten werden gelöscht. Visto startet neu.',
      icon: 'reset', color: '#FF453A',
      buttons: [{ label: 'Abbrechen', kind: '', value: false }, { label: 'Löschen', kind: 'danger', value: true }],
    });
    if (!v) return;
    resetting = true;
    const l = V.rim.loading({ color: '#FF453A' });
    setTimeout(async () => {
      await l.done();
      V.store.reset();
      try { localStorage.removeItem('vistoos.v1'); } catch (e) { /* egal */ }
      location.reload();
    }, 900);
  }

  /* ------------------------------------------------------------ Navigation */
  function createNav(ctx) {
    const host = U.el('div', { class: 'st-host' });
    ctx.root.appendChild(host);
    const stack = [];
    let anim = null;
    function makePage(id, arg) {
      const def = PAGES[id];
      const el = U.el('div', { class: 'st-page', data: { page: id } });
      const offs = [];
      const P = {
        id, el, offs,
        on(evt, fn) { offs.push(V.on(evt, fn)); },
        timeout(fn, ms) { const t = setTimeout(fn, ms); offs.push(() => clearTimeout(t)); return t; },
        destroy() { for (const f of offs.splice(0)) V.safe(f); if (P.onDestroy) V.safe(P.onDestroy); el.remove(); },
      };
      const sub = id !== 'main';
      const t = V.ui.arcText({ text: (sub ? '‹  ' : '') + def.title, r: 446, size: 27, weight: 700, spacing: 5, color: 'rgba(255,255,255,.55)' });
      t.el.classList.add('vos-apptitle');
      P.titleEl = t.el;
      el.appendChild(t.el);
      if (sub) {
        const b = U.el('button', { class: 'st-back', attrs: { type: 'button', 'aria-label': 'Zurück' } });
        V.ui.tap(b, () => nav.pop());
        el.appendChild(b);
      }
      host.appendChild(el);
      P.inst = def.build(P, nav, arg) || {};
      return P;
    }
    function animate(inP, outP, dir, instant) {
      if (anim) anim.stop();
      const sp = V.spring(0, { response: 0.5, bounce: 0.06 });
      anim = sp;
      const apply = (t) => {
        if (inP) {
          inP.el.style.transform = `translateX(${((1 - t) * dir * 42).toFixed(2)}cqw) scale(${(0.9 + 0.1 * t).toFixed(4)})`;
          inP.el.style.opacity = U.smoothstep(0.05, 0.75, t).toFixed(3);
        }
        if (outP) {
          outP.el.style.transform = `translateX(${(-t * dir * 30).toFixed(2)}cqw) scale(${(1 - 0.1 * t).toFixed(4)})`;
          outP.el.style.opacity = (1 - U.smoothstep(0, 0.6, t)).toFixed(3);
        }
      };
      sp.onUpdate(apply);
      const fin = () => {
        if (inP) { inP.el.style.transform = ''; inP.el.style.opacity = ''; inP.el.style.visibility = ''; }
        if (outP) { outP.el.style.transform = ''; outP.el.style.opacity = ''; }
      };
      if (instant) { apply(1); fin(); return Promise.resolve(true); }
      return sp.to(1).then((done) => { if (anim === sp) anim = null; fin(); return done; });
    }
    const nav = {
      ctx,
      get top() { return stack[stack.length - 1]; },
      get depth() { return stack.length; },
      push(id, arg, o = {}) {
        if (!PAGES[id]) return;
        const prev = nav.top;
        const P = makePage(id, arg);
        stack.push(P);
        V.emit('activity');
        animate(P, prev, 1, o.instant).then(() => { if (prev && nav.top === P) prev.el.style.visibility = 'hidden'; });
        if (prev && !o.instant) V.sound.play('tap');
      },
      pop() {
        if (stack.length < 2) return false;
        const P = stack.pop();
        const prev = nav.top;
        prev.el.style.visibility = '';
        if (prev.inst.refresh) V.safe(() => prev.inst.refresh());
        animate(prev, P, -1).then(() => P.destroy());
        return true;
      },
      goto(id, arg) {
        while (stack.length > 1) stack.pop().destroy();
        const m = nav.top;
        if (m) { m.el.style.visibility = ''; if (m.inst.refresh) m.inst.refresh(); }
        if (id === 'reset') { confirmReset(); return; }
        if (id && id !== 'main' && PAGES[id]) nav.push(id, arg, { instant: true });
      },
      destroy() { while (stack.length) stack.pop().destroy(); },
    };
    return nav;
  }

  /* ---------------------------------------------------------------- App */
  V.apps.register({
    id: 'settings',
    name: 'Einstellungen',
    icon: 'settings',
    color: COLOR,
    order: 90,
    keywords: ['einstellungen', 'einstellung', 'settings', 'optionen', 'system'],

    init() {
      V.css('settings', CSS);
      const PAGE_WORDS = [
        ['wifi', /wlan|wifi|wi-fi|netzwerk|internet/], ['display', /anzeige|display|bildschirm|helligkeit|ruhezeit|always[- ]?on|nachtmodus/],
        ['face', /zifferbl|uhrdesign|watchface/], ['color', /farbe|akzent/], ['time', /uhrzeit|datum|zeitformat|24|12|zeit/],
        ['visto', /visto|stimme|sprache|ki|claude|mikro/], ['sound', /ton|töne|laut|haptik|vibration/], ['location', /ort|standort|stadt/],
        ['about', /über|info|version|gerät/], ['reset', /zurücksetzen|werkseinstellung/],
      ];
      const pageOf = (t) => { const hit = PAGE_WORDS.find(([, re]) => re.test(t)); return hit ? hit[0] : null; };
      const LABEL = { wifi: 'die WLAN-Einstellungen', display: 'die Anzeige-Einstellungen', face: 'die Zifferblätter', color: 'die Farbauswahl', time: 'Datum & Uhrzeit', visto: 'meine Einstellungen', sound: 'Töne & Haptik', location: 'die Ortswahl', about: 'die Infos über mich', reset: 'das Zurücksetzen' };
      const openPage = (page) => {
        const go = () => {
          const a = V.shell.app;
          if (a && a.def.id === 'settings') { if (a.inst.params) a.inst.params({ page }); }
          else { pendingPage = page || null; V.shell.open('settings', { page }); }
        };
        if (V.convo && V.convo.active) setTimeout(() => { if (V.convo.active) V.convo.close(); setTimeout(go, 400); }, 1500);
        else go();
      };
      const say = (txt, extra) => Object.assign({ say: txt, emotion: 'happy' }, extra || {});
      const capCity = (raw) => {
        const s = String(raw).trim().replace(/\s+/g, ' ');
        const known = CITIES.find((c) => c.toLowerCase() === s.toLowerCase() || c.toLowerCase().startsWith(s.toLowerCase() + ' '));
        return known || s.split(/([ -])/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      };
      const info = () => `Ich bin ${V.device.name} ${V.device.model} mit VistoOS ${V.version}, Build ${V.build} – ein rundes 7-Zoll-OLED mit 1080 × 1080 Pixeln und 90 Hertz.`;

      /* Aktionen (auch für Claude) */
      V.actions.register('settings.open', {
        desc: 'Öffnet die Einstellungen, optional direkt eine Seite: display, face, color, time, visto, sound, wifi, location, about.',
        params: { page: { type: 'string', enum: ['main', 'display', 'face', 'color', 'time', 'visto', 'sound', 'wifi', 'location', 'about'] } },
        run(a) { const p = PAGES[a.page] && a.page !== 'main' ? a.page : null; openPage(p); return say(p ? `Ich öffne ${LABEL[p]}.` : 'Ich öffne die Einstellungen.'); },
      });
      V.actions.register('settings.info', {
        desc: 'Liefert Geräte- und Versionsinfos von Visto (Modell, VistoOS-Version, Build, Display).',
        run() { return say(info(), { card: { type: 'icon', icon: 'info', color: '#636366', title: 'VistoOS ' + V.version, sub: 'Build ' + V.build + ' · ' + V.device.name + ' ' + V.device.model } }); },
      });
      V.actions.register('settings.time_format', {
        desc: 'Stellt das Uhrzeitformat um: h24 = true für 24-Stunden, false für 12-Stunden (AM/PM).',
        params: { h24: { type: 'boolean' } }, required: ['h24'],
        run(a) { const on = a.h24 !== false && a.h24 !== 'false'; set('settings.use24h', on); return say(on ? 'Die Uhr zeigt jetzt das 24-Stunden-Format.' : 'Die Uhr zeigt jetzt das 12-Stunden-Format.', { card: { type: 'big', text: V.fmt.time(V.time.now()) + (on ? '' : ' ' + V.fmt.parts().ampm), sub: on ? '24 Stunden' : '12 Stunden' } }); },
      });
      V.actions.register('settings.location', {
        desc: 'Setzt den Ort (Stadt) für Wetter und Sonnenzeiten.',
        params: { city: { type: 'string', description: 'Stadtname, z. B. Hamburg' } }, required: ['city'],
        run(a) { const c = capCity(a.city || ''); if (!c) return 'Welche Stadt meinst du?'; set('settings.location', c); return say(`Alles klar, dein Ort ist jetzt ${c}.`, { card: { type: 'icon', icon: 'location', color: '#32D74B', title: c, sub: 'Ort' } }); },
      });
      V.actions.register('settings.wifi', {
        desc: 'WLAN steuern: network = Name zum Verbinden, on = false trennt. Ohne Angaben: Status.',
        params: { network: { type: 'string' }, on: { type: 'boolean' } },
        run(a) {
          if (a.on === false || a.on === 'false') { set('settings.wifi', ''); return say('WLAN ist aus.', { emotion: 'neutral' }); }
          if (a.network) {
            const n = NETWORKS.find((x) => x.name.toLowerCase() === String(a.network).toLowerCase()) || NETWORKS.find((x) => x.name.toLowerCase().startsWith(String(a.network).toLowerCase()));
            if (!n) return say(`Das Netz „${a.network}“ sehe ich gerade nicht.`, { emotion: 'confused' });
            set('settings.wifi', n.name); set('settings.wifiLast', n.name);
            return say(`Verbunden mit ${n.name}.`, { card: { type: 'icon', icon: 'wifi', color: '#0A84FF', title: n.name, sub: 'Verbunden' } });
          }
          if (a.on === true || a.on === 'true') { const n = NETWORKS.find((x) => x.name === get('settings.wifiLast')) || NETWORKS[0]; set('settings.wifi', n.name); return say(`WLAN ist an, verbunden mit ${n.name}.`); }
          const w = get('settings.wifi');
          return say(w ? `Ich bin mit „${w}“ verbunden.` : 'Ich bin gerade mit keinem WLAN verbunden.', { card: { type: 'icon', icon: 'wifi', color: w ? '#0A84FF' : '#636366', title: w || 'Kein WLAN', sub: w ? 'Verbunden' : 'Offline' } });
        },
      });
      V.actions.register('settings.voice', {
        desc: 'Visto-Stimme: on = Sprachausgabe an/aus, rate = Sprechtempo 0.7–1.5, style = aurora | mono | accent (Aussehen von Visto).',
        params: { on: { type: 'boolean' }, rate: { type: 'number' }, style: { type: 'string', enum: ['aurora', 'mono', 'accent'] } },
        run(a) {
          const out = [];
          if (a.on !== undefined) { const on = a.on !== false && a.on !== 'false'; set('settings.voice', on); out.push(on ? 'Ich spreche wieder mit dir.' : 'Ich antworte jetzt nur noch als Text.'); }
          if (a.rate !== undefined) { const r = U.clamp(Number(a.rate) || 1, 0.7, 1.5); set('settings.voiceRate', r); out.push(r > 1.1 ? 'Ich spreche jetzt schneller.' : r < 0.95 ? 'Ich spreche jetzt langsamer.' : 'Ich spreche in normalem Tempo.'); }
          if (a.style && STYLES.some((s) => s.v === a.style)) { set('settings.vistoStyle', a.style); out.push(`Mein Stil ist jetzt ${styleName(a.style)}.`); }
          return out.length ? say(out.join(' ')) : say('Was soll ich an meiner Stimme ändern?', { emotion: 'confused' });
        },
      });
      V.actions.register('settings.microphone', {
        desc: 'Mikrofon stummschalten (muted = true) oder wieder einschalten (false).',
        params: { muted: { type: 'boolean' } }, required: ['muted'],
        run(a) { const m = a.muted !== false && a.muted !== 'false'; set('settings.micMuted', m); return say(m ? 'Mikrofon ist stumm. Du kannst mir weiter schreiben.' : 'Mikrofon ist wieder an.', { card: { type: 'icon', icon: m ? 'micoff' : 'mic', color: '#FF453A', title: m ? 'Stumm' : 'An', sub: 'Mikrofon' } }); },
      });
      V.actions.register('settings.feedback', {
        desc: 'Systemtöne (sounds) und Haptik (haptics) an- oder ausschalten.',
        params: { sounds: { type: 'boolean' }, haptics: { type: 'boolean' } },
        run(a) {
          const out = [];
          if (a.sounds !== undefined) { const on = a.sounds !== false && a.sounds !== 'false'; set('settings.sounds', on); out.push('Systemtöne ' + (on ? 'an' : 'aus')); }
          if (a.haptics !== undefined) { const on = a.haptics !== false && a.haptics !== 'false'; set('settings.haptics', on); out.push('Haptik ' + (on ? 'an' : 'aus')); }
          return out.length ? say(out.join(', ') + '.') : 'Was soll ich ändern?';
        },
      });
      V.actions.register('settings.display', {
        desc: 'Anzeige: always_on (gedimmte Uhr im Ruhemodus), auto_brightness (Lichtsensor), idle_seconds (Ruhezeit 15–300).',
        params: { always_on: { type: 'boolean' }, auto_brightness: { type: 'boolean' }, idle_seconds: { type: 'number' } },
        run(a) {
          const out = [];
          if (a.always_on !== undefined) { const on = a.always_on !== false && a.always_on !== 'false'; set('settings.alwaysOn', on); out.push('Always-On ' + (on ? 'an' : 'aus')); }
          if (a.auto_brightness !== undefined) { const on = a.auto_brightness !== false && a.auto_brightness !== 'false'; set('settings.autoBrightness', on); out.push('Auto-Helligkeit ' + (on ? 'an' : 'aus')); }
          if (a.idle_seconds !== undefined) { const s = U.clamp(Math.round(Number(a.idle_seconds) || 60), 10, 900); set('settings.idleSec', s); out.push('Ruhezeit ' + V.fmt.durationWords(s)); }
          return out.length ? say(out.join(', ') + '.') : 'Was soll ich an der Anzeige ändern?';
        },
      });
      V.actions.register('settings.ai', {
        desc: 'KI-Antworten (Claude) an- oder ausschalten.',
        params: { on: { type: 'boolean' } }, required: ['on'],
        run(a) { const on = a.on !== false && a.on !== 'false'; set('settings.vistoAI', on); return say(on ? (aiSeen || V.brain.claudeReady ? 'KI-Antworten sind an.' : 'KI-Antworten sind an, sobald Claude verfügbar ist.') : 'KI-Antworten sind aus. Ich nutze nur mein eingebautes Wissen.'); },
      });

      /* Absichten */
      const B = V.brain;
      const onOff = (t) => /(?<![a-zäöüß])(aus|ab|deaktivier\w*|ausschalten|abschalten|stumm|stummschalten)(?![a-zäöüß])/.test(t) ? false : /(?<![a-zäöüß])(an|ein|aktivier\w*|einschalten|anschalten|wieder)(?![a-zäöüß])/.test(t) ? true : null;
      B.intent({
        id: 'settings-24h', priority: 9,
        match: [/(?<!\d)(24|12)[ -]?(stunden|std\.?|h)(?![a-zäöüß])(?:[ -]?(format|anzeige|modus|uhr))?/],
        run(m, t) {
          if (/timer|wecker|erinner|countdown|alarm|in (12|24)/.test(t)) return null;
          if (!/(format|anzeige|modus|(?<![a-zäöüß])uhr(?![a-zäöüß])|uhrzeit|zeitformat)/.test(t)) return null;
          return V.actions.run('settings.time_format', { h24: m[1] === '24' });
        },
      });
      B.intent({
        id: 'settings-about', priority: 7,
        match: [/(infos?|informationen|details)( mal)? (über|zu|von) (dir|dich)(?![a-zäöüß])/, /(infos?|informationen) (über|zum gerät)$/, /welche (version|softwareversion|systemversion|software)/, /(deine|die) (version|softwareversion|build|systemversion)/, /über visto/, /(was für ein|welches) gerät bist du/, /(zeig|öffne).*(geräteinfo|systeminfo|über visto)/],
        async run(m, t) {
          const r = await V.actions.run('settings.info');
          if (/(zeig|öffne)/.test(t)) openPage('about');
          return r;
        },
      });
      B.intent({
        id: 'settings-open', priority: 6,
        match: [new RegExp(NB + '(einstellungen|einstellung|settings|systemeinstellungen)' + NA)],
        run(m, t) {
          if (/zurücksetzen|werkseinstellung/.test(t)) { openPage('reset'); return say('Das musst du kurz bestätigen.', { emotion: 'thinking' }); }
          const p = pageOf(t.replace(/einstellungen?|settings/g, ''));
          return V.actions.run('settings.open', { page: p || 'main' });
        },
      });
      B.intent({
        id: 'settings-location', priority: 6,
        match: [/(?:mein (?:ort|standort|wohnort) ist|ich wohne (?:jetzt )?in|(?:setze?|stell|stelle|ändere?) (?:den |meinen )?(?:ort|standort|wohnort) (?:auf|nach|zu)|(?:ort|standort) (?:auf|nach|ist))\s+([a-zäöüß][a-zäöüß .-]{1,28})$/],
        run(m) { return V.actions.run('settings.location', { city: m[1].replace(/\s+(bitte|danke)$/, '') }); },
      });
      B.intent({
        id: 'settings-wifi', priority: 6,
        match: [new RegExp(NB + '(wlan|wifi|wi-fi|wlan-netz)' + NA)],
        run(m, t, original) {
          if (/welche|status|bin ich|sind wir|bist du/.test(t)) return V.actions.run('settings.wifi', {});
          const mm = original.match(/(?:mit|zu)\s+(?:dem\s+)?(?:wlan|wifi|netz(?:werk)?)?\s*[„"]?([^„"“]+?)[“"]?\s*(?:verbinden)?[.!?]?$/i);
          if (/verbind/.test(t) && mm && !/^(dem|einem)?\s*(wlan|wifi|netz)$/i.test(mm[1].trim())) return V.actions.run('settings.wifi', { network: mm[1].trim() });
          const on = onOff(t);
          if (on !== null && !/welche|status|verbunden\?/.test(t)) return V.actions.run('settings.wifi', { on });
          if (/(öffne|zeig|einstellung)/.test(t)) return V.actions.run('settings.open', { page: 'wifi' });
          return V.actions.run('settings.wifi', {});
        },
      });
      B.intent({
        id: 'settings-mic', priority: 8,
        match: [new RegExp(NB + 'mikro(?:fon|phon)?' + NA)],
        run(m, t) {
          const muted = /stumm|aus(?![a-zäöüß])|lautlos|deaktiv/.test(t) ? true : /(an|ein|wieder|aktiv)(?![a-zäöüß])/.test(t) ? false : null;
          if (muted === null) return say(get('settings.micMuted') ? 'Mein Mikrofon ist stumm.' : 'Mein Mikrofon ist an.');
          return V.actions.run('settings.microphone', { muted });
        },
      });
      B.intent({
        id: 'settings-voice', priority: 7,
        match: [/(?:^|[\s-])(stimme|sprachausgabe|vorlesen)(?![a-zäöüß])/, /sprich (schneller|langsamer|normal|nicht mehr|wieder)/, /sprechtempo/, /rede (schneller|langsamer|nicht mehr)/],
        run(m, t) {
          if (/schneller/.test(t)) return V.actions.run('settings.voice', { rate: Math.min(1.5, get('settings.voiceRate', 1.04) + 0.15) });
          if (/langsamer/.test(t)) return V.actions.run('settings.voice', { rate: Math.max(0.7, get('settings.voiceRate', 1.04) - 0.15) });
          if (/normal/.test(t)) return V.actions.run('settings.voice', { rate: 1.04 });
          if (/nicht mehr|aus(?![a-zäöüß])|stumm|deaktiv/.test(t)) return V.actions.run('settings.voice', { on: false });
          if (/(an|ein|wieder|aktiv)(?![a-zäöüß])/.test(t)) return V.actions.run('settings.voice', { on: true });
          return null;
        },
      });
      B.intent({
        id: 'settings-style', priority: 6,
        match: [/(stil|aussehen|look|design|erscheinungsbild)\b.*\b(aurora|mono|monochrom|schlicht|akzent|akzentfarbe|bunt|regenbogen)(?![a-zäöüß])/, /(?:mach|sei) dich (bunt|mono|schlicht|einfarbig)/],
        run(m, t) {
          const s = /mono|schlicht|einfarbig/.test(t) ? 'mono' : /akzent/.test(t) ? 'accent' : 'aurora';
          return V.actions.run('settings.voice', { style: s });
        },
      });
      B.intent({
        id: 'settings-feedback', priority: 6,
        match: [/(systemtöne|tastentöne|klicktöne|klicks|töne)(?![a-zäöüß]).*(an|aus|ein)(?![a-zäöüß])/, /(haptik|vibration|vibrieren)(?![a-zäöüß]).*(an|aus|ein)(?![a-zäöüß])/],
        run(m, t) {
          const on = onOff(t);
          if (on === null) return null;
          const a = {};
          if (/haptik|vibr/.test(t)) a.haptics = on;
          if (/töne|klick/.test(t)) a.sounds = on;
          return V.actions.run('settings.feedback', a);
        },
      });
      B.intent({
        id: 'settings-display', priority: 7,
        match: [/always[- ]?on/, /(auto(matische)?[- ]?helligkeit|helligkeit automatisch|lichtsensor)/, /ruhezeit|bildschirmzeit|display[- ]?timeout/],
        run(m, t) {
          if (/ruhezeit|timeout|bildschirmzeit/.test(t)) {
            const s = V.brain.parseDuration(t);
            if (!s) return V.actions.run('settings.open', { page: 'display' });
            return V.actions.run('settings.display', { idle_seconds: s });
          }
          const on = onOff(t);
          if (on === null) return V.actions.run('settings.open', { page: 'display' });
          return V.actions.run('settings.display', /always/.test(t) ? { always_on: on } : { auto_brightness: on });
        },
      });
      B.intent({
        id: 'settings-ai', priority: 6,
        match: [new RegExp(NB + '(ki|ki-antworten|claude|künstliche intelligenz)' + NA + '.*' + NB + '(an|aus|ein|ausschalten|einschalten)' + NA)],
        run(m, t) { const on = onOff(t); return on === null ? null : V.actions.run('settings.ai', { on }); },
      });
    },

    create(ctx) {
      V.css('settings', CSS);
      const nav = createNav(ctx);
      nav.push('main', null, { instant: true });
      const start = (ctx.params && ctx.params.page) || pendingPage;
      pendingPage = null;
      if (start) nav.goto(start);
      ctx.on('store:settings.accent', () => { const t = nav.top; if (t && t.id === 'main' && t.inst.refresh) t.inst.refresh(); });
      return {
        back() { return nav.pop(); },
        crown(dA) { const t = nav.top; if (!t) return; if (t.inst.crown) t.inst.crown(dA); else if (t.inst.list) t.inst.list.crown(dA); },
        params(p) { if (p && p.page) nav.goto(p.page); },
        destroy() { nav.destroy(); },
      };
    },
  });
})();
