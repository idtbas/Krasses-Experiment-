/* VistoOS · os/rim.js — der Rand des Displays als Anzeige
 *
 *  Winkel immer als Uhrwinkel in Grad: 0° = oben, im Uhrzeigersinn.
 *
 *  V.rim.arc(id, {value 0…1, from 0, color, width 9, r 488, glow 1, track false, head false, smooth true})
 *  V.rim.remove(id)
 *  const l = V.rim.loading({color, colors}); l.done(); l.fail()     Ladekreis: Linie fährt am Rand entlang
 *  V.rim.pulse({color, at 0, spread 70, duration 1.4})               Lichtimpuls (Benachrichtigung)
 *  V.rim.aurora(stärke 0…1)                                           Visto-Leuchten rundherum
 *  V.rim.level('Lautstärke', 0.6, {icon, color, side:'right'})        kurzzeitige Pegelanzeige
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const arcs = new Map();
  const loaders = new Set();
  const pulses = [];
  let auroraTarget = 0, aurora = 0, auroraT = 0;
  let level = null;
  let coverS = 1;
  const hasConic = typeof CanvasRenderingContext2D !== 'undefined' && 'createConicGradient' in CanvasRenderingContext2D.prototype;

  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const accent = () => V.store.get('settings.accent', '#FF9A4D');
  const VCOLS = ['#46E6FF', '#6F7BFF', '#B46BFF', '#FF6FB5', '#FFB86B'];

  /** Bogen mit Verlauf von Transparenz (Schwanz) zu voller Farbe (Kopf) */
  function tail(c, cx, cy, r, a0, a1, color, width, alphaHead = 1, alphaTail = 0) {
    const span = a1 - a0;
    if (span <= 0.2) return;
    if (hasConic && span < 359.5) {
      const g = c.createConicGradient(rad(a0), cx, cy);
      const f = Math.min(0.9999, span / 360);
      g.addColorStop(0, U.rgba(color, alphaTail));
      g.addColorStop(f, U.rgba(color, alphaHead));
      g.addColorStop(Math.min(1, f + 0.0001), U.rgba(color, 0));
      g.addColorStop(1, U.rgba(color, 0));
      c.strokeStyle = g;
      c.lineWidth = width;
      c.beginPath();
      c.arc(cx, cy, r, rad(a0), rad(a1));
      c.stroke();
    } else {
      const n = Math.max(6, Math.ceil(span / 4));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        c.strokeStyle = U.rgba(color, U.lerp(alphaTail, alphaHead, t1));
        c.lineWidth = width;
        c.beginPath();
        c.arc(cx, cy, r, rad(a0 + span * t0), rad(a0 + span * t1 + 0.3));
        c.stroke();
      }
    }
  }

  function drawArc(ctx, g, a) {
    const v = a.smooth ? a.shown : a.value;
    const r = a.r, w = a.width;
    ctx.lineCap = 'round';
    if (a.track) {
      ctx.strokeStyle = U.rgba(a.trackColor || a.color, a.trackAlpha || 0.16);
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(500, 500, r, 0, TAU); ctx.stroke();
    }
    if (v <= 0.0005) return;
    const a0 = a.from, a1 = a.from + Math.min(1, v) * 360 * (a.dir || 1);
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    ctx.globalAlpha = a.alpha;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = w;
    ctx.beginPath();
    if (v >= 0.9995) ctx.arc(500, 500, r, 0, TAU);
    else ctx.arc(500, 500, r, rad(lo), rad(hi));
    ctx.stroke();
    if (a.glow > 0) {
      g.globalAlpha = 0.4 * a.glow * a.alpha;
      g.strokeStyle = a.color;
      g.lineCap = 'round';
      g.lineWidth = w * 2.4;
      g.beginPath();
      if (v >= 0.9995) g.arc(500, 500, r, 0, TAU); else g.arc(500, 500, r, rad(lo), rad(hi));
      g.stroke();
    }
    if (a.head && v < 0.9995) {
      const p = V.display.pt(a1, r);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, w * 0.32, 0, TAU); ctx.fill();
      g.globalAlpha = a.alpha * 0.8;
      g.fillStyle = a.color;
      g.beginPath(); g.arc(p.x, p.y, w * 1.7, 0, TAU); g.fill();
    }
    ctx.globalAlpha = 1; g.globalAlpha = 1;
  }

  function drawLoader(ctx, g, L, dt) {
    L.t += dt;
    const fadeIn = U.clamp(L.t / 0.35, 0, 1);
    const r = L.r;
    let alpha = fadeIn * L.alpha;
    let head, len;
    if (L.state === 'run') {
      // Kopf läuft gleichmäßig, Länge atmet zwischen 28° und 140°
      L.head += dt * L.speed * (1 + 0.35 * Math.sin(L.t * 2.1));
      len = 28 + 112 * (0.5 - 0.5 * Math.cos(L.t * 2.1));
      head = L.head;
    } else {
      // Abschluss: Linie schließt sich zum vollen Kreis, blitzt, verblasst
      L.dt2 += dt;
      const k = V.ease.outCubic(U.clamp(L.dt2 / 0.55, 0, 1));
      head = L.head + L.dt2 * L.speed * 0.6;
      len = U.lerp(L.lenAtDone, 360, k);
      const fade = U.clamp((L.dt2 - 0.6) / 0.5, 0, 1);
      alpha *= 1 - fade;
      if (L.dt2 > 1.15) { loaders.delete(L); if (L.resolve) L.resolve(); return; }
      if (L.state === 'fail') { len = U.lerp(L.lenAtDone, 0, k); }
    }
    L.len = len;
    const cols = L.colors;
    const col = cols ? cols[Math.floor(L.t * 0.8) % cols.length] : L.color;
    const nextCol = cols ? cols[(Math.floor(L.t * 0.8) + 1) % cols.length] : L.color;
    const blendCol = cols ? U.mix(col, nextCol, U.smoothstep(0, 1, (L.t * 0.8) % 1)) : col;
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha;
    if (len >= 359.5) {
      ctx.strokeStyle = blendCol; ctx.lineWidth = L.width;
      ctx.beginPath(); ctx.arc(500, 500, r, 0, TAU); ctx.stroke();
      g.globalAlpha = alpha * 0.8; g.strokeStyle = blendCol; g.lineWidth = L.width * 4;
      g.beginPath(); g.arc(500, 500, r, 0, TAU); g.stroke();
    } else {
      tail(ctx, 500, 500, r, head - len, head, blendCol, L.width, 1, 0);
      // heller Kopf
      const p = V.display.pt(head, r);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, L.width * 0.42, 0, TAU); ctx.fill();
      g.globalAlpha = alpha;
      g.lineCap = 'round';
      tail(g, 500, 500, r, head - len * 0.6, head, blendCol, L.width * 4, 0.9, 0);
      g.fillStyle = blendCol;
      g.beginPath(); g.arc(p.x, p.y, L.width * 2.6, 0, TAU); g.fill();
    }
    ctx.globalAlpha = 1; g.globalAlpha = 1;
  }

  function drawPulse(ctx, g, P, dt) {
    P.t += dt;
    const k = P.t / P.duration;
    if (k >= 1) return false;
    const spread = P.spread * V.ease.outCubic(Math.min(1, k * 1.4));
    const a = (1 - k) * (1 - k);
    const r = 488;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      const a0 = dir > 0 ? P.at : P.at - spread, a1 = dir > 0 ? P.at + spread : P.at;
      if (dir > 0) tail(ctx, 500, 500, r, a0, a1, P.color, 8, 0, a);
      else tail(ctx, 500, 500, r, a0, a1, P.color, 8, a, 0);
    }
    g.globalAlpha = a;
    g.strokeStyle = P.color; g.lineWidth = 46; g.lineCap = 'round';
    g.beginPath(); g.arc(500, 500, 480, rad(P.at - spread * 0.6), rad(P.at + spread * 0.6)); g.stroke();
    g.globalAlpha = 1;
    return true;
  }

  function drawAurora(ctx, g, dt) {
    aurora += (auroraTarget - aurora) * Math.min(1, dt * 5);
    if (aurora < 0.003) { aurora = 0; return; }
    auroraT += dt;
    const lvl = aurora;
    const r = 494;
    const rot = auroraT * 40;
    if (hasConic) {
      const mk = (c, alpha) => {
        const gr = c.createConicGradient(rad(rot), 500, 500);
        const n = VCOLS.length;
        for (let i = 0; i <= n; i++) gr.addColorStop(i / n, U.rgba(VCOLS[i % n], alpha));
        return gr;
      };
      ctx.lineWidth = 6 + 6 * lvl;
      ctx.strokeStyle = mk(ctx, 0.75 * Math.min(1, lvl * 1.4));
      ctx.beginPath(); ctx.arc(500, 500, r, 0, TAU); ctx.stroke();
      g.lineWidth = 34 + 46 * lvl;
      g.strokeStyle = mk(g, 0.5 * Math.min(1, lvl * 1.2));
      g.beginPath(); g.arc(500, 500, 486, 0, TAU); g.stroke();
    } else {
      const n = 60;
      for (let i = 0; i < n; i++) {
        const c = VCOLS[Math.floor(((i / n) * VCOLS.length + auroraT * 0.6) % VCOLS.length)];
        ctx.strokeStyle = U.rgba(c, 0.7 * lvl); ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(500, 500, r, rad((i / n) * 360), rad(((i + 1) / n) * 360 + 0.5)); ctx.stroke();
      }
    }
  }

  function drawLevel(ctx, g, dt) {
    if (!level) return;
    level.t += dt;
    level.shown += (level.value - level.shown) * Math.min(1, dt * 14);
    const vis = level.t < 0.25 ? V.ease.outCubic(level.t / 0.25) : level.t > level.hold ? 1 - U.clamp((level.t - level.hold) / 0.4, 0, 1) : 1;
    if (vis <= 0) { level = null; return; }
    const side = level.side === 'left' ? -1 : 1;
    const span = 100;                                           // Grad
    const start = side > 0 ? 90 + span / 2 : 270 - span / 2;   // unten
    const end = side > 0 ? 90 - span / 2 : 270 + span / 2;     // oben
    const r = 470;
    ctx.globalAlpha = vis;
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    if (side > 0) ctx.arc(500, 500, r, rad(end), rad(start)); else ctx.arc(500, 500, r, rad(start), rad(end));
    ctx.stroke();
    const cur = U.lerp(start, end, U.clamp(level.shown, 0, 1));
    if (level.shown > 0.005) {
      ctx.strokeStyle = level.color;
      ctx.beginPath();
      if (side > 0) ctx.arc(500, 500, r, rad(cur), rad(start)); else ctx.arc(500, 500, r, rad(start), rad(cur));
      ctx.stroke();
      g.globalAlpha = vis * 0.5; g.strokeStyle = level.color; g.lineWidth = 40; g.lineCap = 'round';
      g.beginPath();
      if (side > 0) g.arc(500, 500, r, rad(cur), rad(start)); else g.arc(500, 500, r, rad(start), rad(cur));
      g.stroke(); g.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  const rim = (V.rim = {
    arc(id, o) {
      let a = arcs.get(id);
      if (!a) {
        a = { id, value: 0, shown: 0, from: 0, color: accent(), width: 9, r: 488, glow: 1, alpha: 1, track: false, head: false, smooth: true, z: 0, alive: 1 };
        arcs.set(id, a);
      }
      Object.assign(a, o);
      if (!a.smooth) a.shown = a.value;
      return a;
    },
    remove(id) { arcs.delete(id); },
    has(id) { return arcs.has(id); },
    clearAll() { arcs.clear(); },

    loading(o = {}) {
      const L = {
        t: 0, head: o.from !== undefined ? o.from : -30, speed: o.speed || 300, r: o.r || 489, width: o.width || 9,
        color: o.color || accent(), colors: o.colors === true ? VCOLS : o.colors || null, alpha: o.alpha !== undefined ? o.alpha : 1,
        state: 'run', dt2: 0, len: 30, lenAtDone: 30, resolve: null,
      };
      loaders.add(L);
      const finish = (state) => new Promise((res) => {
        if (L.state !== 'run') return res();
        L.state = state; L.lenAtDone = L.len; L.dt2 = 0; L.resolve = res;
      });
      return {
        done: () => finish('done'),
        fail: () => finish('fail'),
        cancel: () => { loaders.delete(L); },
        set color(c) { L.color = c; },
      };
    },

    pulse(o = {}) {
      pulses.push({ t: 0, at: o.at || 0, spread: o.spread || 70, duration: o.duration || 1.4, color: o.color || accent() });
    },

    aurora(v) { auroraTarget = U.clamp(v, 0, 1); },

    level(label, value, o = {}) {
      if (level && level.label === label) { level.value = value; level.t = Math.min(level.t, 0.25); if (o.color) level.color = o.color; return; }
      level = { label, value, shown: level ? level.shown : value, t: 0, hold: o.hold || 1.3, side: o.side || 'right', color: o.color || '#ffffff' };
    },

    VCOLS,
    tail,
  });

  V.on('boot:fx', () => {
    V.fx.add({
      z: 10,
      active: () => arcs.size > 0 || loaders.size > 0 || pulses.length > 0 || aurora > 0 || auroraTarget > 0 || !!level,
      draw(ctx, g, t, dt) {
        // App-Bögen treten zurück, solange eine Systemebene darüber offen ist
        const cover = (V.control && V.control.isOpen) || (V.faceEditor && V.faceEditor.isOpen) || (V.convo && V.convo.active);
        coverS += ((cover ? 0.12 : 1) - coverS) * Math.min(1, dt * 8);
        for (const a of arcs.values()) {
          if (a.smooth) a.shown += (a.value - a.shown) * Math.min(1, dt * 9);
          const keep = a.id === 'alert';
          const al = a.alpha;
          if (!keep) a.alpha = al * coverS;
          drawArc(ctx, g, a);
          a.alpha = al;
        }
        drawAurora(ctx, g, dt);
        for (const L of Array.from(loaders)) drawLoader(ctx, g, L, dt);
        for (let i = pulses.length - 1; i >= 0; i--) if (!drawPulse(ctx, g, pulses[i], dt)) pulses.splice(i, 1);
        drawLevel(ctx, g, dt);
      },
    });
  });
  void rim;
})();
