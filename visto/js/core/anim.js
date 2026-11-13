/* VistoOS · core/anim.js — Bildtakt (90 Hz), Federn, Übergänge, Kurven
 *
 *  V.loop.add(fn(dt, t), z)      → entfernen()     fn läuft jedes Bild, dt in Sekunden
 *  V.spring(start, {response, bounce} | {stiffness, damping})
 *       .to(ziel) → Promise   .set(wert)   .value   .velocity   .onUpdate(fn)
 *  V.tween({from, to, duration, ease, delay, onUpdate}) → {promise, cancel}
 *  V.animate(dauer, fn(t), ease) → Promise
 *  V.ease.outCubic …   V.ease.bezier(x1, y1, x2, y2)
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  /* ------------------------------------------------------------- Kurven */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-5) break;
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      return sy(U.clamp(t, 0, 1));
    };
  }
  const ease = (V.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    outSine: (t) => Math.sin((t * Math.PI) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    bezier,
  });
  ease.apple = bezier(0.25, 0.1, 0.25, 1);
  ease.smooth = bezier(0.2, 0.8, 0.2, 1);
  ease.emph = bezier(0.05, 0.7, 0.1, 1);

  /* -------------------------------------------------------------- Takt */
  const subs = [];
  let raf = 0, lastRaw = 0, lastRender = 0;
  const loop = (V.loop = {
    t: 0,          // Sekunden seit Start (nur gerenderte Bilder)
    dt: 0,
    frame: 0,
    cap90: false,  // echte 90-Hz-Taktung nachbilden
    hz: 60,        // gemessene Bildwiederholrate des Handys
    fps: 60,       // tatsächlich gezeichnete Bilder pro Sekunde
    slow: 1,       // Zeitlupe für Tests
    add(fn, z = 0) {
      const s = { fn, z, dead: false };
      subs.push(s);
      subs.sort((a, b) => a.z - b.z);
      kick();
      return () => { s.dead = true; const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
    },
  });

  const rawIntervals = [];
  let fpsCount = 0, fpsAcc = 0;

  function kick() { if (!raf) { lastRaw = 0; raf = requestAnimationFrame(tick); } }

  function tick(now) {
    raf = 0;
    if (lastRaw) {
      const iv = now - lastRaw;
      if (iv > 0 && iv < 100) {
        rawIntervals.push(iv);
        if (rawIntervals.length > 40) rawIntervals.shift();
        if (loop.frame % 20 === 0) {
          const sorted = rawIntervals.slice().sort((a, b) => a - b);
          const med = sorted[sorted.length >> 1];
          loop.hz = Math.round(1000 / med);
        }
      }
    }
    lastRaw = now;
    // 90-Hz-Taktung: Bild auslassen, wenn das letzte zu kurz her ist
    if (loop.cap90 && lastRender && now - lastRender < 1000 / 90 - 1.2) {
      raf = requestAnimationFrame(tick);
      return;
    }
    let dt = lastRender ? (now - lastRender) / 1000 : 1 / 60;
    lastRender = now;
    if (dt > 0.1) dt = 0.1;
    dt *= loop.slow;
    loop.dt = dt;
    loop.t += dt;
    loop.frame++;
    fpsCount++; fpsAcc += dt / loop.slow;
    if (fpsAcc >= 0.5) { loop.fps = Math.round(fpsCount / fpsAcc); fpsCount = 0; fpsAcc = 0; }

    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (s.dead) continue;
      try { s.fn(dt, loop.t); } catch (e) { console.error('[VistoOS] Takt', e); }
    }
    if (subs.length) raf = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastRender = 0; kick(); } });

  /* ------------------------------------------------------------- Federn */
  function Spring(value, opts) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this._fns = [];
    this._resolve = [];
    this._off = null;
    this.configure(opts || {});
    if (opts && opts.onUpdate) this._fns.push(opts.onUpdate);
    this.onRest = opts && opts.onRest;
  }
  Spring.prototype.configure = function (o) {
    const m = (this.mass = o.mass || 1);
    if (o.stiffness !== undefined) {
      this.k = o.stiffness;
      this.c = o.damping !== undefined ? o.damping : 2 * Math.sqrt(this.k * m);
    } else {
      const response = o.response !== undefined ? o.response : this.response || 0.5;
      const bounce = o.bounce !== undefined ? o.bounce : this.bounce || 0;
      this.response = response; this.bounce = bounce;
      const zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
      const w = (2 * Math.PI) / response;
      this.k = w * w * m;
      this.c = 2 * zeta * w * m;
    }
    if (o.precision !== undefined) this.precision = o.precision;
    return this;
  };
  Spring.prototype.onUpdate = function (fn) { this._fns.push(fn); return this; };
  Spring.prototype.set = function (v) {
    this.value = this.target = v;
    this.velocity = 0;
    this._stop(true);
    this._emit();
    return this;
  };
  Spring.prototype.to = function (target, opts) {
    if (opts) this.configure(opts);
    if (opts && opts.velocity !== undefined) this.velocity = opts.velocity;
    this.target = target;
    const span = Math.abs(target - this.value);
    this._eps = this.precision !== undefined ? this.precision : Math.max(1e-4, span * 2e-4, Math.abs(target) * 1e-5);
    if (!this._off) this._off = loop.add((dt) => this._step(dt), -10);
    return new Promise((r) => this._resolve.push(r));
  };
  Spring.prototype.impulse = function (v) {
    this.velocity += v;
    if (!this._off) { this._eps = this._eps || 1e-3; this._off = loop.add((dt) => this._step(dt), -10); }
    return this;
  };
  Spring.prototype._step = function (dt) {
    const h = 1 / 240;
    let n = Math.ceil(dt / h);
    const sh = dt / n;
    while (n--) {
      const a = (-this.k * (this.value - this.target) - this.c * this.velocity) / this.mass;
      this.velocity += a * sh;
      this.value += this.velocity * sh;
    }
    const eps = this._eps || 1e-3;
    if (Math.abs(this.velocity) < eps * 12 && Math.abs(this.value - this.target) < eps) {
      this.value = this.target;
      this.velocity = 0;
      this._emit();
      this._stop(false);
      return;
    }
    this._emit();
  };
  Spring.prototype._emit = function () {
    for (const f of this._fns) f(this.value, this);
  };
  Spring.prototype._stop = function (cancelled) {
    if (this._off) { this._off(); this._off = null; }
    const rs = this._resolve; this._resolve = [];
    for (const r of rs) r(!cancelled);
    if (!cancelled && this.onRest) this.onRest(this.value);
  };
  Spring.prototype.stop = function () { this.target = this.value; this.velocity = 0; this._stop(true); };
  Object.defineProperty(Spring.prototype, 'moving', { get() { return !!this._off; } });

  V.spring = (value = 0, opts) => new Spring(value, opts);
  V.Spring = Spring;

  /* ---------------------------------------------------------- Übergänge */
  V.tween = function (o) {
    const from = o.from !== undefined ? o.from : 0;
    const to = o.to !== undefined ? o.to : 1;
    const dur = Math.max(0.001, o.duration !== undefined ? o.duration : 0.4);
    const ez = o.ease || ease.smooth;
    let elapsed = -(o.delay || 0), off = null, resolve;
    const promise = new Promise((r) => (resolve = r));
    off = loop.add((dt) => {
      elapsed += dt;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / dur);
      const v = from + (to - from) * ez(t);
      if (o.onUpdate) o.onUpdate(v, t);
      if (t >= 1) { off(); if (o.onDone) o.onDone(); resolve(true); }
    }, -5);
    return { promise, cancel() { off(); resolve(false); } };
  };
  V.animate = (duration, onUpdate, ez, delay) => V.tween({ duration, onUpdate, ease: ez, delay }).promise;

  /** wartet n Bilder */
  V.frames = (n = 1) => new Promise((r) => { const off = loop.add(() => { if (--n <= 0) { off(); r(); } }); });
})();
