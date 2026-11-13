/* VistoOS · os/control.js — Kontrollzentrum und Leuchte
 *
 *  V.control.open() · close() · isOpen · crown(dA)          Kontrollzentrum
 *  V.control.lamp(on, {level 0…1, from:{x,y}}) · lampOn       Leuchte (Display als Schreibtischlampe)
 *
 *  Öffnet sich wie ein Vorhang: eine Kreisfläche wächst vom oberen Rand herab, die Inhalte
 *  fallen gestaffelt und federnd herein.
 *    · links am Rand ein dicker Bogen für die Helligkeit, rechts für die Lautstärke (ziehen oder antippen)
 *    · in der Mitte eine Blüte aus runden Schaltern, die Leuchte im Zentrum
 *    · oben Uhrzeit und Datum am Bogen (dort erscheinen auch kurze Rückmeldungen)
 *    · unten ein geschwungener Mini-Player, wenn Musik läuft (V.info.music)
 *  Schließen: nach oben wischen, auf eine freie Fläche tippen, V.shell.back(), Sockeltaste.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const FONT = "'Inter Tight', system-ui, sans-serif";
  const XLINK = 'http://www.w3.org/1999/xlink';

  /* ------------------------------------------------------------ Geometrie */
  const ARC_R = 436, ARC_W = 60, HIT_R = 372;   // Regler am Rand (logisch)
  const FL_R = 196;                              // Radius der Schalter-Blüte
  const SLIDERS = {
    bright: { key: 'settings.brightness', def: 0.9, a0: 218, a1: 322, min: 0.05, label: 'Helligkeit', icon: 'brightness', c0: '#FF9F0A', c1: '#FFE68A', ink: '#3B2500' },
    vol: { key: 'settings.volume', def: 0.6, a0: 142, a1: 38, min: 0, label: 'Lautstärke', icon: 'volume', c0: '#7DB2FF', c1: '#FFFFFF', ink: '#0A1A33' },
  };
  const BTNS = [
    { id: 'lamp', icon: 'bulb', label: 'Leuchte', color: '#FFD9A3', ink: '#3A2300', center: true },
    { id: 'dnd', icon: 'belloff', label: 'Nicht stören', color: '#5E5CE6', ink: '#FFFFFF', at: 0 },
    { id: 'night', icon: 'cc-night', label: 'Nachtmodus', color: '#FF7A45', ink: '#2A0E00', at: 60 },
    { id: 'wifi', icon: 'wifi', label: 'WLAN', color: '#0A84FF', ink: '#FFFFFF', at: 120 },
    { id: 'settings', icon: 'settings', label: 'Einstellungen', color: '#8E8E93', ink: '#FFFFFF', at: 180 },
    { id: 'mic', icon: 'mic', label: 'Mikrofon', color: '#FF453A', ink: '#FFFFFF', at: 240 },
    { id: 'voice', icon: 'cc-voice', label: 'Visto-Stimme', color: '#B46BFF', ink: '#FFFFFF', at: 300 },
  ];
  // Mini-Player: geschwungenes Band unten (Uhrwinkel, gegen den Uhrzeigersinn = links → rechts)
  const PL = { r: 318, w: 104, a0: 236, a1: 124, play: 151, next: 130, textA0: 229, textA1: 163 };

  V.icon.add('cc-night', '<path d="M18.6 15.4A7.4 7.4 0 0 1 8.6 5.4a7.4 7.4 0 1 0 10 10z"/><path d="M16.6 2.8v3.4M14.9 4.5h3.4M20.4 8.4v2.2M19.3 9.5h2.2"/>');
  V.icon.add('cc-voice', '<circle cx="9.2" cy="12" r="5.6"/><path d="M7.6 10.9v2.2M10.8 10.9v2.2"/><path d="M17.2 8.6a4.8 4.8 0 0 1 0 6.8M19.9 6a8.6 8.6 0 0 1 0 12"/>');

  const CSS = `
.cc-root{position:absolute;inset:0;border-radius:50%;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
.cc-root.off,.cc-lamp.off{visibility:hidden;pointer-events:none!important}
.cc-back,.cc-wrap{position:absolute;inset:0;clip-path:circle(0% at 50% -8%)}
.cc-back{background:radial-gradient(120% 80% at 50% 0%,#17181e 0%,#050507 46%,#000 100%)}
.cc-edge{position:absolute;border-radius:50%;pointer-events:none;opacity:0;
  box-shadow:0 0 0 .3cqw rgba(255,255,255,.5),0 0 5cqw .8cqw rgba(150,180,255,.32),inset 0 0 5cqw rgba(150,180,255,.2)}
.cc-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.cc-svg text{font-family:${FONT}}
.cc-flower{position:absolute;inset:0;pointer-events:none;transform-origin:50% 50%}
.cc-btn{position:absolute;border:0;padding:0;margin:0;background:none;color:#fff;pointer-events:auto;cursor:pointer;border-radius:50%;outline:none}
.cc-in{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;
  background:rgba(255,255,255,.115);box-shadow:inset 0 0 0 .18cqw rgba(255,255,255,.06);
  transition:transform .42s var(--spring),background .35s ease,color .35s ease,box-shadow .5s ease}
.cc-in svg{width:42%;height:42%}
.cc-btn.on .cc-in{background:var(--c);color:var(--ink);box-shadow:0 0 6cqw -.4cqw var(--glow),inset 0 0 0 .2cqw rgba(255,255,255,.25)}
.cc-btn.auto .cc-in{background:rgba(255,255,255,.07);color:var(--c);box-shadow:inset 0 0 0 .55cqw var(--c),0 0 5cqw -1.6cqw var(--glow)}
.cc-btn.press .cc-in{transform:scale(.86)}
.cc-btn.hero .cc-in{background:radial-gradient(circle at 50% 30%,rgba(255,226,180,.3),rgba(255,200,140,.09) 70%);color:#FFD9A3;
  box-shadow:inset 0 0 0 .22cqw rgba(255,214,160,.28),0 0 7cqw -2cqw rgba(255,190,110,.45)}
.cc-btn.hero.on .cc-in{background:#FFE7C4;color:#3A2300}
.cc-auto{position:absolute;left:50%;bottom:13%;transform:translateX(-50%);font:750 1.75cqw/1 ${FONT};letter-spacing:.14em;color:var(--c);opacity:0;transition:opacity .3s}
.cc-btn.auto .cc-auto{opacity:1}
.cc-ring{position:absolute;inset:0;border-radius:50%;border:.5cqw solid var(--c);pointer-events:none;animation:ccRing .75s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes ccRing{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}
.cc-player{position:absolute;inset:0;pointer-events:none}
.cc-pbtn{position:absolute;width:11.2cqw;height:11.2cqw;margin:-5.6cqw 0 0 -5.6cqw;border-radius:50%;border:0;padding:0;display:grid;place-items:center;
  background:rgba(255,255,255,.16);color:#fff;pointer-events:auto;cursor:pointer;outline:none;transition:transform .38s var(--spring),background .25s}
.cc-pbtn svg{width:4.8cqw;height:4.8cqw}
.cc-pbtn.press{transform:scale(.84);background:rgba(255,255,255,.28)}
.cc-lamp{position:absolute;inset:0;border-radius:50%;overflow:hidden;touch-action:none;clip-path:circle(0% at 50% 50%)}
.cc-lamp .cc-svg text{font-family:${FONT}}
`;

  /* -------------------------------------------------------------- Zustand */
  let built = false, opened = false;
  let root, back, wrap, edge, svg, flower, player, timeTx, dateTx, statusTx, lampEl;
  const items = [];                 // gestaffelte Elemente {el, y}
  const sl = {};                    // Regler-Elemente
  const prog = V.spring(0, { response: 0.55, bounce: 0.16 });
  const lay = V.spring(0, { response: 0.55, bounce: 0.1 });   // 1 = Platz für Mini-Player
  let offs = [];
  let statusT = 0, musicT = 0, musicShown = false;
  let drag = null;

  const get = (k, d) => V.store.get(k, d);
  const pt = (a, r) => V.display.pt(a, r);
  const arcD = (r, a0, a1) => V.ui.arcPath(500, 500, r, a0, a1);

  /* -------------------------------------------------------- Bogentext */
  function arcText(parent, o) {
    const cw = o.a1 > o.a0;                      // im Uhrzeigersinn: Schrift zeigt nach außen
    const base = cw ? o.r - o.size * 0.36 : o.r + o.size * 0.36;
    const id = U.uid('ccp');
    const path = U.svg('path', { id, d: arcD(base, o.a0, o.a1), fill: 'none', stroke: 'none' });
    const text = U.svg('text', { 'font-size': o.size, 'font-weight': o.weight || 650, 'letter-spacing': o.spacing !== undefined ? o.spacing : o.size * 0.14, fill: o.color || 'rgba(255,255,255,.6)' });
    const tp = U.svg('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' });
    tp.setAttributeNS(XLINK, 'xlink:href', '#' + id);
    text.appendChild(tp);
    parent.append(path, text);
    let last = '';
    return {
      text, tp,
      /** parts: String oder [{t, fill, weight, size}] */
      set(parts) {
        const key = JSON.stringify(parts);
        if (key === last) return;
        last = key;
        tp.textContent = '';
        for (const p of typeof parts === 'string' ? [{ t: parts }] : parts) {
          const s = U.svg('tspan', { fill: p.fill, 'font-weight': p.weight, 'font-size': p.size });
          s.textContent = o.upper === false ? p.t : String(p.t).toUpperCase();
          tp.appendChild(s);
        }
      },
    };
  }
  function iconIn(parent, name, x, y, size, color) {
    const g = U.svg('g', { color });
    g.innerHTML = V.icon(name);
    const s = g.firstElementChild;
    s.setAttribute('x', x - size / 2); s.setAttribute('y', y - size / 2);
    s.setAttribute('width', size); s.setAttribute('height', size);
    parent.appendChild(g);
    return { g, set(n) { if (n === g._n) return; g._n = n; g.innerHTML = V.icon(n); const t = g.firstElementChild; t.setAttribute('x', x - size / 2); t.setAttribute('y', y - size / 2); t.setAttribute('width', size); t.setAttribute('height', size); } };
  }

  /* ------------------------------------------------------------- Aufbau */
  function build() {
    if (built) return;
    built = true;
    V.css('control', CSS);
    root = U.el('div', { class: 'cc-root off', attrs: { 'data-nogesture': 'all', role: 'dialog', 'aria-label': 'Kontrollzentrum' } });
    back = U.el('div', { class: 'cc-back' });
    edge = U.el('div', { class: 'cc-edge' });
    svg = U.svg('svg', { class: 'cc-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    const defs = U.svg('defs');
    const glowId = U.uid('ccg');
    const f = U.svg('filter', { id: glowId, x: '-40%', y: '-40%', width: '180%', height: '180%' });
    f.appendChild(U.svg('feGaussianBlur', { stdDeviation: 15 }));
    defs.appendChild(f);
    svg.appendChild(defs);

    // Regler am Rand
    for (const k of Object.keys(SLIDERS)) {
      const s = SLIDERS[k];
      const gid = U.uid('ccl');
      const p0 = pt(s.a0, ARC_R), p1 = pt(s.a1, ARC_R);
      const lg = U.svg('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
      lg.append(U.svg('stop', { offset: 0, 'stop-color': s.c0 }), U.svg('stop', { offset: 1, 'stop-color': s.c1 }));
      defs.appendChild(lg);
      const g = U.svg('g');
      const track = U.svg('path', { d: arcD(ARC_R, s.a0, s.a1), fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': ARC_W, 'stroke-linecap': 'round' });
      const glow = U.svg('path', { fill: 'none', stroke: `url(#${gid})`, 'stroke-width': ARC_W * 1.05, 'stroke-linecap': 'round', opacity: 0.5, filter: `url(#${glowId})` });
      const fill = U.svg('path', { fill: 'none', stroke: `url(#${gid})`, 'stroke-width': ARC_W, 'stroke-linecap': 'round' });
      const head = U.svg('circle', { r: 7, fill: '#fff', opacity: 0.95 });
      g.append(track, glow, fill, head);
      svg.appendChild(g);
      const ic = iconIn(svg, s.icon, p0.x, p0.y, 32, s.ink);
      const label = arcText(svg, { r: 372, a0: s.a0 < s.a1 ? s.a0 : s.a1, a1: s.a0 < s.a1 ? s.a1 : s.a0, size: 23, weight: 680, spacing: 3.6, color: 'rgba(255,255,255,.5)' });
      const shown = V.spring(get(s.key, s.def), { response: 0.32, bounce: 0 });
      const width = V.spring(1, { response: 0.3, bounce: 0.3 });
      sl[k] = { def: s, g, track, glow, fill, head, ic, label, shown, width, active: false, lastTick: -1 };
      shown.onUpdate(() => drawSlider(k));
      width.onUpdate(() => drawSlider(k));
      items.push({ el: g, y: 500, svg: true }, { el: ic.g, y: 500, svg: true }, { el: label.text, y: 520, svg: true });
    }

    // Uhrzeit, Datum, Rückmeldung (oben am Bogen)
    const gTime = U.svg('g'), gDate = U.svg('g');
    svg.append(gTime, gDate);
    timeTx = arcText(gTime, { r: 450, a0: -70, a1: 70, size: 31, weight: 640, spacing: 2.5, color: 'rgba(255,255,255,.92)' });
    dateTx = arcText(gDate, { r: 408, a0: -70, a1: 70, size: 21.5, weight: 680, spacing: 4.2, color: 'rgba(255,255,255,.46)' });
    statusTx = arcText(gDate, { r: 408, a0: -70, a1: 70, size: 22, weight: 720, spacing: 4.2, color: '#fff' });
    statusTx.text.style.transition = 'opacity .35s ease';
    dateTx.text.style.transition = 'opacity .35s ease';
    statusTx.text.style.opacity = '0';
    items.push({ el: gTime, y: 40, svg: true }, { el: gDate, y: 90, svg: true });

    // Schalter-Blüte
    flower = U.el('div', { class: 'cc-flower' });
    for (const b of BTNS) {
      const size = b.center ? 17.6 : 15;
      const p = b.center ? { x: 500, y: 500 } : pt(b.at, FL_R);
      const el = U.el('button', {
        class: 'cc-btn' + (b.center ? ' hero' : ''),
        attrs: { type: 'button', 'aria-label': b.label, 'data-id': b.id },
        style: { left: (p.x / 10 - size / 2) + 'cqw', top: (p.y / 10 - size / 2) + 'cqw', width: size + 'cqw', height: size + 'cqw', '--c': b.color, '--ink': b.ink, '--glow': U.rgba(b.color, 0.6) },
      });
      const inner = U.el('div', { class: 'cc-in', html: V.icon(b.icon) });
      el.appendChild(inner);
      if (b.id === 'night') el.appendChild(U.el('span', { class: 'cc-auto', text: 'Auto' }));
      el.addEventListener('click', (e) => { if (e.detail === 0) activate(b.id, el); });   // Tastatur
      flower.appendChild(el);
      b.el = el; b.inner = inner;
      items.push({ el, y: p.y });
    }

    // Mini-Player
    player = U.el('div', { class: 'cc-player' });
    const psvg = U.svg('svg', { class: 'cc-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    const band = U.svg('path', { d: arcD(PL.r, PL.a0, PL.a1), fill: 'none', stroke: 'rgba(255,255,255,.09)', 'stroke-width': PL.w, 'stroke-linecap': 'round' });
    const bandGlow = U.svg('path', { d: arcD(PL.r, PL.a0, PL.a1), fill: 'none', stroke: '#fff', 'stroke-width': PL.w * 0.9, 'stroke-linecap': 'round', opacity: 0.16, filter: `url(#${glowId})` });
    psvg.append(bandGlow, band);
    player.appendChild(psvg);
    const title = arcText(psvg, { r: 338, a0: PL.textA0, a1: PL.textA1, size: 27, weight: 650, spacing: 0.2, color: '#fff', upper: false });
    const artist = arcText(psvg, { r: 297, a0: PL.textA0, a1: PL.textA1, size: 21, weight: 600, spacing: 0.4, color: 'rgba(255,255,255,.55)', upper: false });
    const mk = (a, icon, label, cmd) => {
      const p = pt(a, PL.r);
      const b = U.el('button', { class: 'cc-pbtn', attrs: { type: 'button', 'aria-label': label, 'data-cmd': cmd }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw' }, html: V.icon(icon) });
      b.addEventListener('click', (e) => { if (e.detail === 0) musicCmd(cmd); });
      player.appendChild(b);
      return b;
    };
    const playBtn = mk(PL.play, 'play', 'Wiedergabe', 'toggle');
    const nextBtn = mk(PL.next, 'next', 'Nächster Titel', 'next');
    player._ = { band, bandGlow, title, artist, playBtn, nextBtn };

    wrap = U.el('div', { class: 'cc-wrap' }, svg, flower, player);
    root.append(back, wrap, edge);
    V.display.overlay.appendChild(root);

    prog.onUpdate(render);
    lay.onUpdate(renderLayout);
    attachGestures();
    buildLamp();
  }

  /* ----------------------------------------------------------- Zeichnen */
  function drawSlider(k) {
    const S = sl[k], s = S.def;
    const t = U.smoothstep(0.12, 0.95, prog.value);
    const v = U.clamp(S.shown.value, 0, 1) * t;
    const span = s.a1 - s.a0;
    const aHead = s.a0 + span * Math.max(v, 0.004);
    const w = ARC_W * (0.94 + 0.12 * S.width.value);
    const d = arcD(ARC_R, s.a0, aHead);
    S.fill.setAttribute('d', d);
    S.glow.setAttribute('d', d);
    S.fill.setAttribute('stroke-width', w.toFixed(1));
    S.track.setAttribute('stroke-width', w.toFixed(1));
    S.glow.setAttribute('opacity', (0.32 + 0.4 * v + (S.active ? 0.2 : 0)).toFixed(3));
    const h = pt(aHead, ARC_R);
    S.head.setAttribute('cx', h.x.toFixed(1)); S.head.setAttribute('cy', h.y.toFixed(1));
    S.head.setAttribute('opacity', U.smoothstep(0.1, 0.22, v * 1.4 + (S.active ? 1 : 0)).toFixed(3));
    const pct = Math.round(U.clamp(S.shown.value, 0, 1) * 100);
    S.label.set([{ t: s.label + '  ', fill: S.active ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.42)' }, { t: pct + ' %', fill: S.active ? '#fff' : 'rgba(255,255,255,.7)' }]);
    if (k === 'vol') S.ic.set(get(s.key, s.def) < 0.01 ? 'mute' : 'volume');
  }

  function render() {
    const t = prog.value;
    const R = Math.max(0, t) * 112;
    back.style.clipPath = wrap.style.clipPath = `circle(${R.toFixed(2)}% at 50% -8%)`;
    const eo = U.smoothstep(0, 0.06, t) * (1 - U.smoothstep(0.5, 0.97, t));
    edge.style.opacity = eo.toFixed(3);
    if (eo > 0.002) {
      edge.style.left = (50 - R) + 'cqw'; edge.style.top = (-8 - R) + 'cqw';
      edge.style.width = edge.style.height = (2 * R) + 'cqw';
    }
    for (const it of items) {
      const d = 0.04 + (it.y / 1000) * 0.34;
      const k = (t - d) / (1 - d);
      const kc = U.clamp(k, 0, 1.25);
      const o = U.smoothstep(0, 0.5, k);
      it.el.style.opacity = o.toFixed(3);
      if (it.svg) {
        it.el.style.transformOrigin = '500px 500px';
        it.el.style.transform = `translateY(${((1 - kc) * -60).toFixed(1)}px) scale(${(0.9 + 0.1 * kc).toFixed(4)})`;
      } else {
        it.el.style.transform = `translateY(${((1 - kc) * -9).toFixed(2)}cqw) scale(${(0.6 + 0.4 * kc).toFixed(4)})`;
      }
    }
    drawSlider('bright'); drawSlider('vol');
    const po = U.smoothstep(0.45, 1, t) * U.clamp(lay.value, 0, 1);
    player.style.opacity = po.toFixed(3);
    player.style.visibility = po < 0.01 ? 'hidden' : '';
  }

  function renderLayout() {
    const k = lay.value;
    flower.style.transform = `translateY(${(-5.6 * k).toFixed(3)}cqw) scale(${(1 - 0.14 * k).toFixed(4)})`;
    const po = U.smoothstep(0.45, 1, prog.value) * U.clamp(k, 0, 1);
    player.style.opacity = po.toFixed(3);
    player.style.visibility = po < 0.01 ? 'hidden' : '';
    player.style.transform = `translateY(${((1 - U.clamp(k, 0, 1.2)) * 6).toFixed(2)}cqw)`;
  }

  /* ------------------------------------------------------- Inhalte */
  function updateTime() {
    const now = V.time.now();
    timeTx.set(V.fmt.time(now));
    dateTx.set(V.fmt.dateLong(now));
  }
  function status(name, value) {
    clearTimeout(statusT);
    const parts = [{ t: name, fill: '#fff' }];
    if (value) parts.push({ t: '  ·  ' + value, fill: 'rgba(255,255,255,.62)' });
    statusTx.set(parts);
    statusTx.text.style.opacity = '1';
    dateTx.text.style.opacity = '0';
    statusT = setTimeout(() => { statusTx.text.style.opacity = '0'; dateTx.text.style.opacity = ''; }, 1900);
  }
  function nightText(m) {
    if (m === 'on') return 'An';
    if (m === 'off') return 'Aus';
    const f = get('settings.nightFrom', 22), t = get('settings.nightTo', 7);
    return `Automatisch ${f}–${t} Uhr`;
  }
  function stateOf(id) {
    switch (id) {
      case 'dnd': return get('settings.dnd') ? 'on' : '';
      case 'night': { const m = get('settings.night', 'auto'); return m === 'on' ? 'on' : m === 'auto' ? 'auto' : ''; }
      case 'wifi': return get('settings.wifi') ? 'on' : '';
      case 'mic': return get('settings.micMuted') ? 'on' : '';
      case 'voice': return get('settings.voice', true) ? 'on' : '';
      case 'lamp': return V.control.lampOn ? 'on' : '';
      default: return '';
    }
  }
  function sync() {
    if (!built) return;
    for (const b of BTNS) {
      const s = stateOf(b.id);
      b.el.classList.toggle('on', s === 'on');
      b.el.classList.toggle('auto', s === 'auto');
      if (b.id === 'mic') {
        const n = s ? 'micoff' : 'mic';
        if (b._icon !== n) { b._icon = n; b.inner.innerHTML = V.icon(n); }
      }
      b.el.setAttribute('aria-pressed', s ? 'true' : 'false');
    }
    for (const k of Object.keys(sl)) {
      const S = sl[k];
      if (!S.active) { const v = get(S.def.key, S.def.def); if (Math.abs(S.shown.target - v) > 0.001) S.shown.to(v); }
      drawSlider(k);
    }
  }
  function ripple(el) {
    const r = U.el('div', { class: 'cc-ring' });
    el.appendChild(r);
    setTimeout(() => r.remove(), 800);
  }

  function activate(id, el) {
    V.emit('activity');
    const b = BTNS.find((x) => x.id === id);
    switch (id) {
      case 'dnd': {
        const on = !get('settings.dnd');
        V.store.set('settings.dnd', on);
        status('Nicht stören', on ? 'An' : 'Aus');
        break;
      }
      case 'night': {
        const m = get('settings.night', 'auto');
        const n = m === 'on' ? 'auto' : 'on';
        V.store.set('settings.night', n);
        status('Nachtmodus', nightText(n));
        break;
      }
      case 'wifi': {
        const w = get('settings.wifi');
        status('WLAN', w || 'Nicht verbunden');
        const c = V.display.centerOf(el);
        setTimeout(() => V.shell.open('settings', { page: 'wifi' }, { x: c.x, y: c.y, r: 75 }), 260);
        break;
      }
      case 'mic': {
        const on = !get('settings.micMuted');
        V.store.set('settings.micMuted', on);
        status('Mikrofon', on ? 'Stumm' : 'An');
        break;
      }
      case 'voice': {
        const on = !get('settings.voice', true);
        V.store.set('settings.voice', on);
        status('Visto-Stimme', on ? 'An' : 'Aus');
        break;
      }
      case 'lamp': {
        const c = V.display.centerOf(el);
        lamp(true, { from: c });
        break;
      }
      case 'settings': {
        const c = V.display.centerOf(el);
        V.shell.open('settings', {}, { x: c.x, y: c.y, r: 75 });
        break;
      }
    }
    sync();
    if (b && b.el && stateOf(id)) ripple(b.el);
    V.haptic(stateOf(id) ? [6, 30, 6] : 6);
  }

  /* --------------------------------------------------------- Musik */
  function musicInfo() {
    if (!V.info || typeof V.info.music !== 'function') return null;
    return V.safe(() => V.info.music(), 'control music') || null;
  }
  function updatePlayer() {
    const m = musicInfo();
    const P = player._;
    if (!m) return;
    P.title.set(m.title || 'Musik');
    P.artist.set(m.artist || '');
    const c = m.color && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#FF375F';
    P.band.setAttribute('stroke', U.rgba(c, 0.2));
    P.bandGlow.setAttribute('stroke', c);
    P.playBtn.innerHTML = V.icon(m.playing ? 'pause' : 'play');
    P.playBtn.setAttribute('aria-label', m.playing ? 'Pause' : 'Wiedergabe');
  }
  async function musicCmd(cmd) {
    V.sound.play('tap'); V.haptic(6);
    const m = musicInfo();
    try {
      if (m && typeof m[cmd] === 'function') await m[cmd]();
      else {
        const names = cmd === 'next' ? ['music.next', 'music.skip']
          : m && m.playing ? ['music.toggle', 'music.pause', 'music.playpause'] : ['music.toggle', 'music.play', 'music.resume', 'music.playpause'];
        const n = names.find((x) => V.actions.has(x));
        if (n) await V.actions.run(n, {});
        else V.emit('music:' + cmd);
      }
    } catch (e) { console.warn('[VistoOS] Musiksteuerung', e); }
    setTimeout(updatePlayer, 120);
  }

  /* --------------------------------------------------------- Gesten */
  function inArc(a, s, margin = 9) {
    const lo = Math.min(s.a0, s.a1) - margin, hi = Math.max(s.a0, s.a1) + margin;
    return a >= lo && a <= hi;
  }
  function sliderAt(p) {
    if (p.r0 < HIT_R) return null;
    if (inArc(p.a0, SLIDERS.bright)) return 'bright';
    if (inArc(p.a0, SLIDERS.vol)) return 'vol';
    return null;
  }
  function setSlider(k, v, fromDrag) {
    const S = sl[k], s = S.def;
    v = U.clamp(v, s.min, 1);
    V.store.set(s.key, v);
    if (fromDrag) S.shown.set(v); else S.shown.to(v);
    const step = Math.round(v * 10);
    if (step !== S.lastTick) { if (S.lastTick >= 0) { V.sound.play('tick'); V.haptic(3); } S.lastTick = step; }
  }

  function attachGestures() {
    root.addEventListener('pointerdown', (e) => { e.stopPropagation(); V.emit('activity'); });
    V.gesture(root, {
      start(p, e) {
        drag = null;
        if (!opened) return;
        const tgt = e.target;
        const btn = tgt && tgt.closest ? tgt.closest('.cc-btn, .cc-pbtn') : null;
        const k = btn ? null : sliderAt(p);
        if (k) {
          const S = sl[k];
          S.active = true; S.lastTick = Math.round(get(S.def.key, S.def.def) * 10);
          S.width.to(1.6);
          drag = { mode: 'slide', k, v0: get(S.def.key, S.def.def) };
          drawSlider(k);
          return;
        }
        if (btn) {
          btn.classList.add('press');
          const b = BTNS.find((x) => x.el === btn);
          if (b) status(b.label, '');
        }
        drag = { mode: btn ? 'btn' : 'bg', btn, t0: prog.value };
      },
      move(p) {
        if (!drag) return;
        if (drag.mode === 'slide') {
          const s = SLIDERS[drag.k];
          const span = Math.abs(s.a1 - s.a0);
          const dir = s.a1 > s.a0 ? 1 : -1;
          setSlider(drag.k, drag.v0 + (dir * p.dA) / span, true);
          return;
        }
        if ((drag.mode === 'btn' || drag.mode === 'bg') && p.moved) {
          if (drag.btn) drag.btn.classList.remove('press');
          if (Math.abs(p.dy) > Math.abs(p.dx) * 1.05) { drag.mode = 'pull'; drag.t0 = prog.value; prog.stop(); }
          else drag.mode = 'none';
        }
        if (drag.mode === 'pull') {
          const dy = p.dy;
          const t = dy < 0 ? drag.t0 + dy / 620 : drag.t0 + (1 - Math.exp(-dy / 260)) * 0.07;
          prog.set(U.clamp(t, 0, 1.08));
        }
      },
      tap(p, e) {
        if (!drag) return;
        if (drag.mode === 'btn' && drag.btn) {
          const id = drag.btn.getAttribute('data-id');
          const cmd = drag.btn.getAttribute('data-cmd');
          if (cmd) musicCmd(cmd); else { V.sound.play('tap'); activate(id, drag.btn); }
        } else if (drag.mode === 'slide') {
          // Antippen auf dem Bogen setzt den Wert an diese Stelle
          const s = SLIDERS[drag.k];
          const rel = U.clamp(U.angDiff(s.a0, p.a) / (s.a1 - s.a0), 0, 1);
          setSlider(drag.k, rel, false);
        } else if (drag.mode === 'bg') {
          close();
        }
        void e;
      },
      end(p) {
        const d = drag; drag = null;
        if (!d) return;
        if (d.btn) d.btn.classList.remove('press');
        if (d.mode === 'slide') {
          const S = sl[d.k];
          S.active = false;
          S.width.to(1);
          drawSlider(d.k);
          if (d.k === 'vol' && p.moved) V.sound.play('tap');
          const v = get(S.def.key, S.def.def);
          status(S.def.label, Math.round(v * 100) + ' %');
        } else if (d.mode === 'pull') {
          if (p.dy < -80 || p.vy < -650) close({ velocity: p.vy / 620 });
          else prog.to(1, { response: 0.45, bounce: 0.18, velocity: p.vy / 620 });
        }
      },
    }, { slop: 9 });
  }

  /* ------------------------------------------------------- Öffnen/Schließen */
  function open() {
    if (opened) return;
    if (!V.shell || V.shell.mode === 'boot' || V.shell.mode === 'setup') return;
    if (V.notify && V.notify.alertOpen) return;
    if (V.convo && V.convo.active) V.convo.close();
    build();
    opened = true;
    root.classList.remove('off');
    root.setAttribute('aria-hidden', 'false');
    const m = musicInfo();
    musicShown = !!(m && m.playing);
    lay.set(musicShown ? 1 : 0);
    renderLayout();
    if (musicShown) updatePlayer();
    for (const k of Object.keys(sl)) { const S = sl[k]; S.shown.set(get(S.def.key, S.def.def)); S.active = false; S.width.set(1); }
    updateTime();
    sync();
    statusTx.text.style.opacity = '0'; dateTx.text.style.opacity = '';
    offs.push(V.on('store', (e) => { if (/^settings\.(brightness|volume|dnd|night|wifi|micMuted|voice|nightFrom|nightTo)$/.test(e.path)) sync(); }));
    offs.push(V.on('time:minute', updateTime));
    offs.push(V.on('store:settings.use24h', updateTime));
    clearInterval(musicT);
    musicT = setInterval(() => {
      const mi = musicInfo();
      if (mi && mi.playing && !musicShown) { musicShown = true; lay.to(1); }
      if (musicShown) updatePlayer();
    }, 1000);
    V.emit('activity');
    V.sound.play('open');
    V.haptic(8);
    prog.to(1, { response: 0.56, bounce: 0.16 });
    V.emit('control:open');
  }

  function close(o = {}) {
    if (lampOn) lamp(false, { all: true });
    if (!opened) return;
    opened = false;
    drag = null;
    for (const f of offs.splice(0)) f();
    clearInterval(musicT);
    clearTimeout(statusT);
    root.setAttribute('aria-hidden', 'true');
    V.sound.play('close');
    prog.to(0, { response: 0.42, bounce: 0, velocity: o.velocity || 0 }).then(() => {
      if (!opened) root.classList.add('off');
    });
    V.emit('control:close');
  }

  /* --------------------------------------------------------------- Leuchte */
  let lampOn = false, lampFromPanel = false, lampOrigin = { x: 500, y: 500 }, savedBright = null, keepAlive = 0, hintT = 0;
  let lampLevel = U.clamp(get('settings.lampLevel', 0.85), 0.05, 1);
  const lampP = V.spring(0, { response: 0.62, bounce: 0.04 });
  const lampShown = V.spring(lampLevel, { response: 0.3, bounce: 0 });
  let L = null;   // Leuchten-Elemente

  function buildLamp() {
    lampEl = U.el('div', { class: 'cc-lamp off', attrs: { role: 'button', 'aria-label': 'Leuchte – antippen zum Beenden' } });
    const glow = U.el('div', { style: { position: 'absolute', inset: '0', borderRadius: '50%' } });
    const lsvg = U.svg('svg', { class: 'cc-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    const track = U.svg('circle', { cx: 500, cy: 500, r: 474, fill: 'none', stroke: 'rgba(120,64,8,.16)', 'stroke-width': 9 });
    const arc = U.svg('path', { fill: 'none', stroke: 'rgba(130,70,8,.5)', 'stroke-width': 9, 'stroke-linecap': 'round' });
    const knob = U.svg('circle', { r: 11, fill: 'rgba(120,62,6,.72)' });
    lsvg.append(track, arc, knob);
    const label = arcText(lsvg, { r: 428, a0: -70, a1: 70, size: 25, weight: 700, spacing: 4.5, color: 'rgba(110,58,8,.62)' });
    const hint = arcText(lsvg, { r: 396, a0: 250, a1: 110, size: 21, weight: 680, spacing: 3.6, color: 'rgba(110,58,8,.5)' });
    hint.set('Am Rand drehen · Tippen beendet');
    hint.text.style.transition = 'opacity .8s ease';
    lampEl.append(glow, lsvg);
    V.display.overlay.appendChild(lampEl);
    L = { glow, arc, knob, label, hint, track };
    lampP.onUpdate(renderLamp);
    lampShown.onUpdate(paintLamp);
    attachLampGestures();
  }
  function paintLamp() {
    if (!L) return;
    const k = U.clamp(lampShown.value, 0.05, 1);
    const warm = U.mix('#FF9C45', '#FFF3E2', Math.pow(k, 0.55));
    const center = U.mix(warm, '#FFFFFF', 0.45);
    const edgeC = U.mix(warm, '#E2752A', 0.28);
    L.glow.style.background = `radial-gradient(circle at 50% 44%, ${center} 0%, ${warm} 56%, ${edgeC} 100%)`;
    const a1 = 360 * k;
    L.arc.setAttribute('d', k >= 0.999 ? 'M 500 26 A 474 474 0 1 1 499.9 26' : arcD(474, 0, Math.max(0.5, a1)));
    const h = pt(a1, 474);
    L.knob.setAttribute('cx', h.x.toFixed(1)); L.knob.setAttribute('cy', h.y.toFixed(1));
    L.label.set([{ t: 'Leuchte  ' }, { t: Math.round(k * 100) + ' %', fill: 'rgba(110,58,8,.85)' }]);
  }
  function renderLamp() {
    const t = lampP.value;
    const o = lampOrigin;
    const far = Math.max(Math.hypot(o.x - 0, o.y - 0), Math.hypot(o.x - 1000, o.y), Math.hypot(o.x, o.y - 1000), Math.hypot(o.x - 1000, o.y - 1000)) / 10;
    const r0 = 8.8;
    const R = U.lerp(r0, far, U.clamp(t, 0, 1.2));
    lampEl.style.clipPath = `circle(${Math.max(0, R).toFixed(2)}% at ${o.x / 10}% ${o.y / 10}%)`;
    lampEl.style.opacity = U.smoothstep(0, 0.12, t).toFixed(3);
  }
  function showLampHint() {
    if (!L) return;
    L.hint.text.style.opacity = '1';
    clearTimeout(hintT);
    hintT = setTimeout(() => { if (L) L.hint.text.style.opacity = '0'; }, 3200);
  }
  function setLampLevel(v, fromDrag) {
    v = U.clamp(v, 0.05, 1);
    const before = Math.round(lampLevel * 10);
    lampLevel = v;
    if (fromDrag) lampShown.set(v); else lampShown.to(v);
    if (lampOn) V.store.set('settings.brightness', v);
    if (Math.round(v * 10) !== before) { V.sound.play('tick'); V.haptic(3); }
  }
  function lamp(on, o = {}) {
    if (on) {
      if (o.level !== undefined && o.level !== null) setLampLevel(o.level);
      if (lampOn) return;
      if (!V.shell || V.shell.mode === 'boot' || V.shell.mode === 'setup') return;
      if (V.convo && V.convo.active) V.convo.close();
      build();
      lampOn = true;
      lampFromPanel = opened;
      lampOrigin = o.from || { x: 500, y: 500 };
      savedBright = get('settings.brightness', 0.9);
      lampShown.set(lampLevel);
      paintLamp();
      V.store.set('settings.brightness', lampLevel);
      lampEl.classList.remove('off');
      V.visto && V.visto.setLine(0);
      clearInterval(keepAlive);
      keepAlive = setInterval(() => V.emit('activity'), 15000);
      showLampHint();
      V.sound.play('wake');
      V.haptic([8, 40, 8]);
      lampP.to(1, { response: 0.7, bounce: 0.04 });
      sync();
      V.emit('control:lamp', true);
    } else {
      if (!lampOn) return;
      lampOn = false;
      clearInterval(keepAlive);
      clearTimeout(hintT);
      V.store.set('settings.lampLevel', lampLevel);
      if (savedBright !== null) V.store.set('settings.brightness', savedBright);
      savedBright = null;
      V.visto && V.visto.setLine(1);
      V.sound.play('sleep');
      const backToPanel = lampFromPanel && opened && !o.all;
      if (!backToPanel) lampOrigin = { x: 500, y: 500 };
      lampP.to(0, { response: 0.48, bounce: 0 }).then(() => { if (!lampOn) lampEl.classList.add('off'); });
      sync();
      if (!backToPanel && opened && !o.all) close();
      V.emit('control:lamp', false);
    }
  }
  function attachLampGestures() {
    lampEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); V.emit('activity'); });
    let mode = null, v0 = 0;
    V.gesture(lampEl, {
      start(p) { mode = p.r0 > 300 ? 'rim' : 'mid'; v0 = lampLevel; showLampHint(); },
      move(p) {
        if (!lampOn || !p.moved) return;
        if (mode === 'rim') setLampLevel(v0 + p.dA / 320, true);
        else setLampLevel(v0 - p.dy / 700, true);
      },
      tap() { if (lampOn) lamp(false); },
      end() { mode = null; },
    }, { slop: 10 });
  }

  /* ------------------------------------------------------------ Schnittstelle */
  V.control = {
    open,
    close,
    get isOpen() { return opened || lampOn; },
    get panelOpen() { return opened; },
    get lampOn() { return lampOn; },
    lamp,
    /** Drehen am Rand bzw. Drehkrone: Helligkeit (in der Leuchte: deren Stärke) */
    crown(dA) {
      if (lampOn) { setLampLevel(lampLevel + dA / 320); return; }
      if (!opened) return;
      const v = get('settings.brightness', 0.9) + dA / 300;
      setSlider('bright', v, false);
    },
  };

  /* ------------------------------------------------- Aktionen & Absichten */
  /** nach einer Visto-Antwort erst das Gespräch schließen, dann handeln */
  function afterConvo(fn) {
    if (V.convo && V.convo.active) setTimeout(() => { if (V.convo.active) V.convo.close(); setTimeout(fn, 420); }, 1500);
    else fn();
  }

  V.actions.register('control.open', {
    desc: 'Öffnet das Kontrollzentrum (Helligkeit, Lautstärke, Nicht stören, Nachtmodus, WLAN, Mikrofon, Leuchte).',
    run() { afterConvo(open); return { say: 'Hier ist dein Kontrollzentrum.', emotion: 'happy' }; },
  });
  V.actions.register('control.lamp', {
    desc: 'Schaltet die Leuchte an oder aus: Das ganze runde Display leuchtet als warmweiße Schreibtischlampe. on = an/aus, percent = Stärke 5–100.',
    params: { on: { type: 'boolean' }, percent: { type: 'number', description: 'Stärke in Prozent' } },
    required: ['on'],
    run(a) {
      const level = a.percent !== undefined && a.percent !== null && a.percent !== '' ? U.clamp(Number(a.percent) / 100, 0.05, 1) : undefined;
      if (a.on === false || a.on === 'false') {
        if (!lampOn) return 'Die Leuchte ist schon aus.';
        afterConvo(() => lamp(false, { all: true }));
        return { say: 'Leuchte aus.', emotion: 'happy' };
      }
      if (lampOn && level !== undefined) { setLampLevel(level); return `Leuchte auf ${Math.round(level * 100)} Prozent.`; }
      afterConvo(() => lamp(true, { level }));
      return { say: level !== undefined ? `Die Leuchte geht an – ${Math.round(level * 100)} Prozent.` : 'Die Leuchte geht an. Tippe, wenn du fertig bist.', card: { type: 'icon', icon: 'bulb', color: '#FFB86B', title: 'Leuchte', sub: Math.round((level !== undefined ? level : lampLevel) * 100) + ' % · warmweiß' }, emotion: 'happy' };
    },
  });

  V.on('boot:ready', () => {
    if (!V.brain || !V.brain.intent) return;
    const NB = '(?<![a-zäöüß])', NA = '(?![a-zäöüß])';
    V.brain.intent({
      id: 'control-center', priority: 7,
      match: [new RegExp(NB + '(kontrollzentrum|kontrollcenter|control ?center|schnelleinstellungen|schnellschalter)' + NA)],
      run(m, t) {
        if (/schließ|beende|weg(?![a-zäöüß])|zu(?![a-zäöüß])/.test(t)) { afterConvo(close); return 'Ich schließe das Kontrollzentrum.'; }
        return V.actions.run('control.open');
      },
    });
    V.brain.intent({
      id: 'control-lamp', priority: 8,
      match: [new RegExp(NB + '(leuchte|schreibtischlampe|leselicht|lampenmodus|nachtlicht)' + NA), /(display|bildschirm) (als|zur|zu einer) (lampe|leuchte|licht)/],
      run(m, t) {
        if (/(?<![a-zäöüß])(aus|beende|beenden|stopp|ausschalten|ab)(?![a-zäöüß])/.test(t)) return V.actions.run('control.lamp', { on: false });
        const n = t.match(/(\d{1,3}) ?(%|prozent)/);
        let pct = n ? +n[1] : undefined;
        if (pct === undefined && /heller/.test(t)) pct = Math.round(Math.min(1, lampLevel + 0.25) * 100);
        if (pct === undefined && /dunkler|gedimmt|schwach|sanft/.test(t)) pct = Math.round(Math.max(0.1, lampLevel - 0.3) * 100);
        return V.actions.run('control.lamp', { on: true, percent: pct });
      },
    });
  });
})();
