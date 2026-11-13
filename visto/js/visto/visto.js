/* VistoOS · visto/visto.js — Visto, die Figur
 *
 *  Ruhe:   eine feine Lichtlinie unten am Rand, die atmet und gelegentlich schimmert.
 *  Aufruf: die Enden der Linie heben sich, rollen sich ein und schließen sich zu einem
 *          lebendigen, hohlen Lichtring; darin springen zwei Augen auf.
 *
 *  V.visto.open() / close()                     → Promise
 *  V.visto.setState('idle'|'listening'|'thinking'|'speaking')
 *  V.visto.emote('happy'|'neutral'|'sleepy'|'surprised'|'thinking'|'wink'|'sad'|'confused'|'love', ms?)
 *  V.visto.place({x, y, r})                      Lage und Größe des Rings
 *  V.visto.setLevel(0…1)   V.visto.pulse(0…1)    Mikrofonpegel / Sprechimpuls
 *  V.visto.lookAt(x, y)    V.visto.setLine(alpha)    V.visto.hop()
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const N = 132;
  const LINE_R = 452, LINE_SPAN = 23;
  const HOME = { x: 500, y: 455, r: 150 };
  const PALETTES = {
    aurora: ['#46E6FF', '#6F7BFF', '#B46BFF', '#FF6FB5', '#FFB86B'],
    mono: ['#FFFFFF', '#CFD6E6', '#FFFFFF', '#AEB8CC', '#FFFFFF'],
  };

  // Federn
  const morph = V.spring(0, { response: 0.78, bounce: 0.2 });
  const cxS = V.spring(HOME.x, { response: 0.6, bounce: 0.12 });
  const cyS = V.spring(HOME.y, { response: 0.6, bounce: 0.12 });
  const rS = V.spring(HOME.r, { response: 0.6, bounce: 0.18 });
  const eyeL = V.spring(0, { response: 0.42, bounce: 0.42 });
  const eyeR = V.spring(0, { response: 0.42, bounce: 0.42 });
  const lineA = V.spring(1, { response: 0.6 });
  const hover = V.spring(0, { response: 0.35, bounce: 0.2 });
  const energy = V.spring(0.25, { response: 0.6 });
  const lookX = V.spring(0, { response: 0.32, bounce: 0.12 });
  const lookY = V.spring(0, { response: 0.32, bounce: 0.12 });
  const smileL = V.spring(0, { response: 0.35, bounce: 0.15 });
  const smileR = V.spring(0, { response: 0.35, bounce: 0.15 });
  const openL = V.spring(1, { response: 0.3, bounce: 0.1 });
  const openR = V.spring(1, { response: 0.3, bounce: 0.1 });
  const wide = V.spring(1, { response: 0.3, bounce: 0.3 });
  const hopS = V.spring(0, { response: 0.45, bounce: 0.5 });
  const tintS = V.spring(0, { response: 0.6 });   // 1 = Herz-Rosa

  let state = 'idle', isOpen = false;
  let level = 0, levelS = 0, speak = 0;
  let flow = 0, spin = 0, spinV = 0, time = 0;
  let blink = 0, blinkT = 2.5, blinkDouble = false;
  let shimmer = -1, shimmerT = 5;
  let sacc = 2, emoteTimer = 0, emotion = 'neutral';
  let lineTarget = 1;

  // Puffer
  const px = new Float32Array(N), py = new Float32Array(N), pw = new Float32Array(N);
  const nx = new Float32Array(N), ny = new Float32Array(N);

  function palette() {
    const st = V.store.get('settings.vistoStyle', 'aurora');
    if (st === 'accent') {
      const a = V.store.get('settings.accent', '#FF9A4D');
      return [U.lighten(a, 0.35), a, U.mix(a, '#B46BFF', 0.35), a, U.lighten(a, 0.2)];
    }
    return PALETTES[st] || PALETTES.aurora;
  }
  function palAt(pal, f) {
    f = U.wrap(f, 1) * pal.length;
    const i = Math.floor(f), k = f - i;
    return U.mix(pal[i % pal.length], pal[(i + 1) % pal.length], k);
  }

  /** Mittellinie für Strang j berechnen. Liefert {cx, cy, R, span, closed} */
  function shape(j, sep) {
    const m = U.clamp(morph.value, -0.3, 1.35);
    const me = U.clamp(m, 0, 1);
    const span = U.lerp(LINE_SPAN + hover.value * 5, 360, U.smoothstep(0.06, 0.93, me));
    const ringR = rS.value * (m > 1 ? 1 + (m - 1) * 0.55 : 1);
    const kk = U.lerp(1 / LINE_R, 1 / ringR, V.ease.inOutSine(me));
    const R = 1 / kk;
    const eb = U.smoothstep(0, 0.88, me);
    const hop = hopS.value * 26 * (1 - me);
    const bx = U.lerp(500, cxS.value, eb);
    const by = U.lerp(500 + LINE_R - hop, cyS.value + ringR, eb);
    const cx = bx, cy = by - R;
    const closed = span >= 359.6;
    const taper = 1 - U.smoothstep(0.88, 1, me);
    const amp = energy.value;
    const lv = levelS, sp = speak;
    const ph = j * 2.1;
    const off = (j - 1) * sep;
    const rot = rotE(me);
    const W = U.lerp(6.2, 8.4, me) * (j === 1 ? 1 : 0.62);
    for (let i = 0; i < N; i++) {
      const s = closed ? i / N : i / (N - 1);
      const th2 = U.rad(90 + (s - 0.5) * span);
      const th = th2 + rot;
      // lebendige Verformung
      let w = amp * (5.2 * Math.sin(2 * th2 + time * 1.3 + ph) + 3.4 * Math.sin(3 * th2 - time * 0.9 + 1 + ph) + 2.1 * Math.sin(5 * th2 + time * 2.1 + 2 - ph));
      w += lv * (9 * Math.sin(7 * th2 + time * 7.5 + ph) + 6 * Math.sin(11 * th2 - time * 9.3 + ph * 1.7));
      w += sp * 12 * Math.sin(4 * th2 + time * 11 + ph);
      w *= U.lerp(0.35, 1, me);
      const rr = R + w + off;
      px[i] = cx + Math.cos(th) * rr;
      py[i] = cy + Math.sin(th) * rr;
      let ww = W * (1 + 0.25 * Math.sin(th2 * 3 + time * 2 + ph));
      if (!closed) ww *= U.lerp(1, Math.pow(Math.sin(Math.PI * s), 0.55), taper);
      pw[i] = ww;
    }
    // Normalen
    for (let i = 0; i < N; i++) {
      const a = closed ? (i - 1 + N) % N : Math.max(0, i - 1);
      const b = closed ? (i + 1) % N : Math.min(N - 1, i + 1);
      let tx = px[b] - px[a], ty = py[b] - py[a];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      nx[i] = -ty; ny[i] = tx;
    }
    return { cx, cy, R, span, closed, me, rot };
  }
  /** Drehung des Rings (stetig modulo 360°, beim Ausrollen weich auf 0) */
  function rotE(me) {
    return U.rad(U.angDiff(0, U.wrap(spin, 360))) * U.smoothstep(0.8, 1, me);
  }

  function grad(c, sh, pal, phase, alpha) {
    const start = U.rad(90 - sh.span / 2);
    let gr;
    if (c.createConicGradient) {
      gr = c.createConicGradient(start + sh.rot, sh.cx, sh.cy);
      const f = sh.closed ? 1 : Math.min(0.999, sh.span / 360);
      const n = 10;
      for (let i = 0; i <= n; i++) {
        gr.addColorStop((i / n) * f, U.rgba(palAt(pal, i / n + phase), alpha));
      }
      if (!sh.closed) gr.addColorStop(Math.min(1, f + 0.001), U.rgba(palAt(pal, phase), alpha));
    } else {
      gr = c.createLinearGradient(sh.cx - sh.R, sh.cy, sh.cx + sh.R, sh.cy);
      for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, U.rgba(palAt(pal, i / 4 + phase), alpha));
    }
    return gr;
  }

  function ribbon(c, closed) {
    c.beginPath();
    if (closed) {
      for (let i = 0; i <= N; i++) { const k = i % N; const x = px[k] + nx[k] * pw[k] / 2, y = py[k] + ny[k] * pw[k] / 2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.closePath();
      for (let i = N; i >= 0; i--) { const k = i % N; const x = px[k] - nx[k] * pw[k] / 2, y = py[k] - ny[k] * pw[k] / 2; i === N ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.closePath();
    } else {
      for (let i = 0; i < N; i++) { const x = px[i] + nx[i] * pw[i] / 2, y = py[i] + ny[i] * pw[i] / 2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      for (let i = N - 1; i >= 0; i--) c.lineTo(px[i] - nx[i] * pw[i] / 2, py[i] - ny[i] * pw[i] / 2);
      c.closePath();
    }
  }
  function centerline(c, closed) {
    c.beginPath();
    for (let i = 0; i < N; i++) i ? c.lineTo(px[i], py[i]) : c.moveTo(px[i], py[i]);
    if (closed) c.closePath();
  }

  function drawEyes(ctx, g, sh) {
    const sL = eyeL.value, sR = eyeR.value;
    if (sL < 0.01 && sR < 0.01) return;
    const R = sh.R;
    const k = U.clamp(sh.me, 0, 1);
    const bl = blink <= 0 ? 0 : blink <= 1 ? blink : 2 - blink;
    const b = 1 - bl;
    const tint = tintS.value;
    const fill = tint > 0.01 ? U.mix('#F4F7FF', '#FF8FC8', tint) : '#F4F7FF';
    for (const side of [-1, 1]) {
      const pop = side < 0 ? sL : sR;
      if (pop < 0.01) continue;
      const sm = side < 0 ? smileL.value : smileR.value;
      const op = side < 0 ? openL.value : openR.value;
      const ex = sh.cx + side * R * 0.29 + lookX.value * R * 0.13;
      const ey = sh.cy - R * 0.02 + lookY.value * R * 0.11;
      const w = R * 0.15 * wide.value * pop;
      const h = R * 0.34 * op * b * pop * (1 - 0.65 * sm) * wide.value;
      ctx.globalAlpha = k * (1 - sm);
      // Pille
      if (1 - sm > 0.01) {
        const hh = Math.max(h, w * 0.22);
        ctx.fillStyle = fill;
        ctx.beginPath();
        roundRect(ctx, ex - w / 2, ey - hh / 2, w, hh, Math.min(w, hh) / 2);
        ctx.fill();
        g.globalAlpha = k * 0.55 * (1 - sm);
        g.fillStyle = U.mix(fill, '#9FB5FF', 0.35);
        g.beginPath();
        roundRect(g, ex - w * 1.1, ey - hh * 0.75, w * 2.2, hh * 1.5, w);
        g.fill();
      }
      // fröhlicher Bogen ^
      if (sm > 0.01) {
        ctx.globalAlpha = k * sm * pop;
        ctx.strokeStyle = fill;
        ctx.lineCap = 'round';
        ctx.lineWidth = R * 0.105 * wide.value;
        const rr = R * 0.115 * wide.value;
        ctx.beginPath();
        ctx.arc(ex, ey + rr * 0.55 * b + rr * 0.2, rr, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        g.globalAlpha = k * 0.5 * sm;
        g.strokeStyle = fill; g.lineWidth = R * 0.3; g.lineCap = 'round';
        g.beginPath(); g.arc(ex, ey + rr * 0.7, rr, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      }
    }
    ctx.globalAlpha = 1; g.globalAlpha = 1;
  }
  function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function update(dt) {
    time += dt;
    // Pegel glätten
    levelS += (level - levelS) * Math.min(1, dt * (level > levelS ? 18 : 6));
    speak *= Math.pow(0.02, dt);
    // Fließen der Farben
    const flowSpeed = state === 'thinking' ? 0.55 : state === 'listening' ? 0.18 : state === 'speaking' ? 0.22 : 0.06;
    flow += dt * flowSpeed;
    const spinTarget = state === 'thinking' ? 260 : state === 'listening' ? 24 : isOpen ? 12 : 0;
    spinV += (spinTarget - spinV) * Math.min(1, dt * 3);
    spin += spinV * dt;
    // Blinzeln
    if (isOpen) {
      blinkT -= dt;
      if (blinkT <= 0) {
        if (blink === 0) blink = 0.0001;
      }
      if (blink > 0) {
        blink += dt / 0.075;
        const bb = blink;
        if (bb >= 2) {
          blink = 0;
          if (blinkDouble) { blinkDouble = false; blinkT = 0.12; }
          else { blinkT = 2.2 + Math.random() * 4; blinkDouble = Math.random() < 0.18; }
        }
      }
    }
    // Augen wandern
    if (isOpen && state !== 'thinking' && !dragLook) {
      sacc -= dt;
      if (sacc <= 0) {
        sacc = 1.4 + Math.random() * 2.6;
        if (Math.random() < 0.55) { lookX.to(0); lookY.to(0); }
        else { lookX.to((Math.random() - 0.5) * 0.8); lookY.to((Math.random() - 0.5) * 0.5); }
      }
    }
    if (emoteTimer > 0) { emoteTimer -= dt; if (emoteTimer <= 0) V.visto.emote('neutral'); }
    // Schimmern der Ruhelinie
    if (!isOpen) {
      shimmerT -= dt;
      if (shimmerT <= 0 && shimmer < 0) { shimmer = 0; shimmerT = 8 + Math.random() * 9; }
    }
    if (shimmer >= 0) { shimmer += dt / 1.3; if (shimmer > 1) shimmer = -1; }
  }
  let dragLook = false;

  function draw(ctx, g, t, dt) {
    update(dt);
    const la = lineA.value * (1 - 0.15 * (0.5 + 0.5 * Math.sin(time * 1.25)) * (1 - U.clamp(morph.value, 0, 1)));
    const me = U.clamp(morph.value, 0, 1);
    const alpha = U.lerp(la, 1, me);
    if (alpha < 0.01) return;
    const pal = palette();
    const sep = U.lerp(0, 5.5, me) + energy.value * 2 + levelS * 6;
    ctx.globalCompositeOperation = 'lighter';
    g.globalCompositeOperation = 'lighter';
    let sh = null;
    for (let j = 0; j < 3; j++) {
      const s = shape(j, sep);
      if (j === 1) sh = s;
      const phase = flow + j * 0.21;
      const a = alpha * (j === 1 ? 0.95 : 0.55);
      // Leuchten
      g.globalAlpha = 1;
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = grad(g, s, pal, phase, a * (0.32 + 0.38 * me + levelS * 0.3));
      g.lineWidth = U.lerp(16, 34, me) + levelS * 24;
      centerline(g, s.closed);
      g.stroke();
      // scharfer Strang
      ctx.fillStyle = grad(ctx, s, pal, phase, a);
      ribbon(ctx, s.closed);
      ctx.fill(s.closed ? 'evenodd' : 'nonzero');
    }
    // heller Kern
    ctx.globalAlpha = alpha * (0.35 + 0.25 * me);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    centerline(ctx, sh.closed);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Schimmer läuft über die Ruhelinie
    if (shimmer >= 0 && me < 0.2) {
      const pos = V.ease.inOutSine(shimmer);
      const i0 = Math.floor(U.clamp(pos * 1.3 - 0.15, 0, 1) * (N - 1));
      const span = 18;
      ctx.globalAlpha = alpha * Math.sin(Math.PI * shimmer) * 0.9;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = Math.max(0, i0 - span); i <= Math.min(N - 1, i0 + span); i++) (i === Math.max(0, i0 - span) ? ctx.moveTo(px[i], py[i]) : ctx.lineTo(px[i], py[i]));
      ctx.stroke();
      g.globalAlpha = ctx.globalAlpha; g.strokeStyle = '#ffffff'; g.lineWidth = 30;
      g.beginPath(); g.moveTo(px[Math.max(0, i0 - 6)], py[Math.max(0, i0 - 6)]); g.lineTo(px[Math.min(N - 1, i0 + 6)], py[Math.min(N - 1, i0 + 6)]); g.stroke();
      ctx.globalAlpha = 1; g.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    g.globalCompositeOperation = 'source-over';
    drawEyes(ctx, g, sh);
  }

  const EMOTIONS = {
    neutral: { sl: 0, sr: 0, ol: 1, or: 1, w: 1, lx: 0, ly: 0, tint: 0 },
    happy: { sl: 1, sr: 1, ol: 1, or: 1, w: 1.05, tint: 0 },
    love: { sl: 1, sr: 1, ol: 1, or: 1, w: 1.1, tint: 1 },
    wink: { sl: 0, sr: 1, ol: 1, or: 1, w: 1 },
    sleepy: { sl: 0, sr: 0, ol: 0.14, or: 0.14, w: 1, ly: 0.35 },
    surprised: { sl: 0, sr: 0, ol: 1.15, or: 1.15, w: 1.22 },
    thinking: { sl: 0, sr: 0, ol: 0.82, or: 0.82, w: 1, lx: 0.65, ly: -0.7 },
    sad: { sl: 0, sr: 0, ol: 0.72, or: 0.72, w: 0.95, lx: 0, ly: 0.6 },
    confused: { sl: 0, sr: 0, ol: 1.05, or: 0.6, w: 1, lx: -0.3, ly: -0.2 },
  };

  const visto = (V.visto = {
    get state() { return state; },
    get isOpen() { return isOpen; },
    get emotion() { return emotion; },
    HOME,

    open() {
      if (isOpen) return Promise.resolve();
      isOpen = true;
      V.emit('visto:state', 'open');
      energy.to(0.55);
      lineA.to(1);
      V.sound.play('wake');
      V.haptic([8, 30, 12]);
      const p = morph.to(1);
      setTimeout(() => { if (isOpen) eyeL.to(1); }, 330);
      setTimeout(() => { if (isOpen) eyeR.to(1); }, 400);
      blinkT = 1.6;
      return new Promise((r) => setTimeout(r, 520)).then(() => p && undefined);
    },
    close() {
      if (!isOpen) return Promise.resolve();
      isOpen = false;
      state = 'idle';
      level = 0;
      V.emit('visto:state', 'idle');
      eyeL.to(0, { response: 0.22, bounce: 0 }); eyeR.to(0, { response: 0.22, bounce: 0 });
      energy.to(0.25);
      visto.emote('neutral');
      V.sound.play('sleep');
      return U.sleep(110).then(() => {
        cxS.to(HOME.x); cyS.to(HOME.y); rS.to(HOME.r);
        lineA.to(lineTarget);
        return morph.to(0, { response: 0.7, bounce: 0.08 });
      });
    },
    setState(s) {
      if (s === state) return;
      state = s;
      V.emit('visto:state', s);
      if (s === 'thinking') { energy.to(0.45); visto.emote('thinking'); V.sound.play('think'); }
      else if (s === 'listening') { energy.to(0.7); if (emotion === 'thinking') visto.emote('neutral'); }
      else if (s === 'speaking') { energy.to(0.5); if (emotion === 'thinking') visto.emote('neutral'); }
      else { energy.to(isOpen ? 0.5 : 0.25); }
    },
    emote(name, ms) {
      const e = EMOTIONS[name] || EMOTIONS.neutral;
      emotion = EMOTIONS[name] ? name : 'neutral';
      smileL.to(e.sl || 0); smileR.to(e.sr || 0);
      openL.to(e.ol !== undefined ? e.ol : 1); openR.to(e.or !== undefined ? e.or : 1);
      wide.to(e.w || 1);
      tintS.to(e.tint || 0);
      if (e.lx !== undefined || e.ly !== undefined) { lookX.to(e.lx || 0); lookY.to(e.ly || 0); sacc = 2.5; }
      emoteTimer = ms ? ms / 1000 : 0;
    },
    place(o) {
      if (o.x !== undefined) cxS.to(o.x);
      if (o.y !== undefined) cyS.to(o.y);
      if (o.r !== undefined) rS.to(o.r);
    },
    setLevel(v) { level = U.clamp(v, 0, 1); },
    pulse(v) { speak = Math.max(speak, U.clamp(v, 0, 1)); },
    lookAt(x, y) {
      const dx = x - cxS.value, dy = y - cyS.value;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300);
      lookX.to((dx / d) * k); lookY.to((dy / d) * k * 0.8);
      sacc = 2.2;
    },
    setLine(a) { lineTarget = a; if (!isOpen) lineA.to(a); },
    hover(on) { hover.to(on ? 1 : 0); },
    hop() { hopS.impulse(-9); energy.impulse(2); },
    /** Augen kurz zum Finger schauen lassen */
    follow(on) { dragLook = on; },
  });

  V.on('boot:fx', () => {
    V.fx.add({ z: 20, active: () => lineA.value > 0.01 || morph.value > 0.01, draw });
  });
  V.on('notify', () => { if (!isOpen) visto.hop(); });
  // Linie je nach Bildschirm
  V.on('shell:mode', (m) => {
    const a = m === 'setup' || m === 'boot' ? 0 : m === 'app' ? 0.6 : m === 'launcher' ? 0.7 : 1;
    visto.setLine(a);
  });
  V.on('ambient', (on) => visto.setLine(on ? 0.35 : V.shell.mode === 'app' ? 0.6 : 1));
})();
