/* VistoOS · os/boot.js — Startanimation
 *
 *  V.boot.run() → Promise
 *    Schwarz → ein winziger Lichtpunkt atmet in der Mitte → er dehnt sich zu einem Ring bis an den Rand,
 *    eine leuchtende Linie fährt einmal am Rand entlang → „visto“ erscheint (Buchstaben aus der Unschärfe,
 *    Sperrung zieht sich zusammen) → der Ring schließt sich, blitzt auf, der Schriftzug löst sich auf.
 *  Erster Start ≈ 4 s, spätere Starts (setupDone) ≈ 2 s. Antippen beschleunigt.
 *  Eigene Ebene in V.display.top, wird am Ende entfernt.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const COLS = ['#46E6FF', '#6F7BFF', '#B46BFF', '#FF6FB5', '#FFB86B'];
  const R = 489;                                   // Radius der Randlinie (logisch)
  const hasConic = typeof CanvasRenderingContext2D !== 'undefined' && 'createConicGradient' in CanvasRenderingContext2D.prototype;
  const rad = (a) => ((a - 90) * Math.PI) / 180;   // Uhrwinkel → Canvas

  V.css('boot', `
.bt-root{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#000;touch-action:none;cursor:pointer;z-index:5}
.bt-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.bt-word{position:absolute;left:0;right:0;top:50%;height:16cqw;margin-top:-8.6cqw;display:flex;justify-content:center;align-items:center;
  font-family:var(--font);font-weight:200;font-size:14.5cqw;line-height:1;color:#fff;pointer-events:none;white-space:nowrap}
.bt-l{display:inline-block;opacity:0;will-change:transform,opacity,filter}
`);

  /* Zeitplan in Sekunden: [Anfang, Ende] */
  const PLANS = {
    first: {
      dot: [0.3, 0.75], breathe: [0.55, 1.62], burst: [1.5, 2.25], run: [1.98, 3.28],
      word: [2.08, 2.95], wordStep: 0.085, wordDur: 0.78, flash: [3.22, 3.72], out: [3.36, 3.96], end: 4.0,
    },
    fast: {
      dot: [0.04, 0.24], breathe: [0.16, 0.56], burst: [0.5, 0.9], run: [0.76, 1.46],
      word: [0.8, 1.28], wordStep: 0.045, wordDur: 0.46, flash: [1.42, 1.72], out: [1.5, 1.95], end: 2.0,
    },
  };

  const ph = (t, r) => U.clamp((t - r[0]) / (r[1] - r[0]), 0, 1);
  function palAt(f) {
    f = U.wrap(f, 1) * COLS.length;
    const i = Math.floor(f);
    return U.mix(COLS[i % COLS.length], COLS[(i + 1) % COLS.length], f - i);
  }

  /** voller Ring mit umlaufendem Farbverlauf */
  function ring(c, r, w, alpha, rot) {
    if (alpha <= 0.002) return;
    c.lineWidth = w;
    if (hasConic) {
      const g = c.createConicGradient(rad(rot), 500, 500);
      for (let i = 0; i <= 10; i++) g.addColorStop(i / 10, U.rgba(palAt(i / 10), alpha));
      c.strokeStyle = g;
      c.beginPath(); c.arc(500, 500, r, 0, TAU); c.stroke();
    } else {
      const n = 48;
      for (let i = 0; i < n; i++) {
        c.strokeStyle = U.rgba(palAt(i / n + rot / 360), alpha);
        c.beginPath(); c.arc(500, 500, r, rad((i / n) * 360), rad(((i + 1) / n) * 360 + 0.6)); c.stroke();
      }
    }
  }

  /** Bogen 0…a1 mit Schweif: hinten fast durchsichtig, vorne volle Farbe */
  function trail(c, a1, w, alpha, phase) {
    const span = a1 / 360;
    if (span <= 0.002 || alpha <= 0.002) return;
    c.lineWidth = w;
    if (hasConic) {
      const g = c.createConicGradient(rad(0), 500, 500);
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        g.addColorStop(Math.min(0.9999, f * span), U.rgba(palAt(f * 0.9 + phase), alpha * (0.1 + 0.9 * Math.pow(f, 1.7))));
      }
      if (span < 0.9999) { g.addColorStop(Math.min(1, span + 0.0002), 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
      c.strokeStyle = g;
      c.beginPath(); c.arc(500, 500, R, rad(0), rad(a1)); c.stroke();
    } else {
      const n = Math.max(6, Math.ceil(a1 / 5));
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        c.strokeStyle = U.rgba(palAt(f * 0.9 + phase), alpha * (0.1 + 0.9 * Math.pow(f, 1.7)));
        c.beginPath(); c.arc(500, 500, R, rad((a1 * i) / n), rad((a1 * (i + 1)) / n + 0.4)); c.stroke();
      }
    }
  }

  function glowDot(c, x, y, r, color, alpha) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(color, alpha));
    g.addColorStop(0.35, U.rgba(color, alpha * 0.35));
    g.addColorStop(1, U.rgba(color, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }

  let running = null;

  function run(opts = {}) {
    if (running) return running.promise;
    const top = V.display && V.display.top;
    if (!top) return Promise.resolve();
    const plan = opts.fast !== undefined ? (opts.fast ? PLANS.fast : PLANS.first) : V.store.get('setupDone') ? PLANS.fast : PLANS.first;

    const root = U.el('div', { class: 'bt-root', attrs: { 'aria-label': 'Visto startet' } });
    const cv = U.el('canvas', { class: 'bt-cv' });
    const word = U.el('div', { class: 'bt-word', attrs: { 'aria-hidden': 'true' } });
    const letters = 'visto'.split('').map((ch) => U.el('span', { class: 'bt-l', text: ch }));
    word.append(...letters);
    root.append(cv, word);
    top.appendChild(root);
    const c = cv.getContext('2d');
    let W = 0;
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(64, Math.round(V.display.size * dpr));
      cv.width = cv.height = W;
    }
    size();
    const offResize = V.on('display:resize', size);

    let t = 0, speed = 1, target = 1, soundDone = false, resolveFn;
    const promise = new Promise((r) => (resolveFn = r));
    // Antippen beschleunigt (und hält den Rest des Systems fern)
    root.addEventListener('pointerdown', (e) => { e.stopPropagation(); target = 3.4; V.haptic(6); });

    function drawFrame() {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.clearRect(0, 0, W, W);
      const s = W / 1000;
      c.setTransform(s, 0, 0, s, 0, 0);
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';

      const din = ph(t, plan.dot), br = ph(t, plan.breathe), bu = ph(t, plan.burst);
      const rp = ph(t, plan.run), fl = ph(t, plan.flash), out = ph(t, plan.out);
      const rot = t * 40;

      // 1) Lichtpunkt: erscheint, atmet anderthalb Mal, holt kurz Luft und platzt auf
      if (din > 0 && bu < 0.4) {
        const breath = 0.5 - 0.5 * Math.cos(br * Math.PI * 3);
        const inhale = 1 - 0.45 * Math.sin(U.clamp(bu / 0.18, 0, 1) * Math.PI * 0.5);
        const rd = 5.2 * V.ease.outBack(din) * (1 + 0.55 * breath * (0.6 + 0.4 * br)) * inhale;
        const a = U.clamp(din * 1.4, 0, 1) * (1 - U.smoothstep(0.05, 0.4, bu));
        glowDot(c, 500, 500, rd * 12, palAt(0.15 + br * 0.4), 0.55 * a * (0.7 + 0.3 * breath));
        glowDot(c, 500, 500, rd * 4.2, '#bfefff', 0.6 * a);
        c.globalAlpha = a;
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(500, 500, Math.max(0.5, rd), 0, TAU); c.fill();
        c.globalAlpha = 1;
      }

      // 2) Ring dehnt sich bis an den Rand
      const fadeAll = 1 - V.ease.inOutSine(out);
      if (bu > 0) {
        const e = V.ease.outExpo(bu);
        const rr = U.lerp(5, R, e);
        const travel = 1 - U.smoothstep(0.62, 1, bu);
        if (travel > 0.005) {
          ring(c, rr, U.lerp(10, 3.2, e), 0.95 * travel, rot);
          ring(c, rr, U.lerp(36, 14, e), 0.16 * travel, rot);
        }
        // feine Spur am Rand, auf der die Linie läuft
        ring(c, R, 2.2, 0.16 * U.smoothstep(0.55, 1, bu) * fadeAll, rot);
      }

      // 3) Leuchtende Linie fährt einmal am Rand entlang
      if (rp > 0) {
        const head = 360 * V.ease.inOutCubic(rp);
        const closed = rp >= 1;
        const flash = Math.sin(fl * Math.PI);
        const ph0 = t * 0.12;
        if (!closed) {
          trail(c, head, 26, 0.12 * fadeAll, ph0);
          trail(c, head, 9, 0.28 * fadeAll, ph0);
          trail(c, head, 4.2, 1 * fadeAll, ph0);
          const p = V.display.pt(head, R);
          glowDot(c, p.x, p.y, 38, palAt(0.9 + ph0), 0.75 * fadeAll);
          c.fillStyle = '#ffffff';
          c.beginPath(); c.arc(p.x, p.y, 3.4, 0, TAU); c.fill();
        } else {
          // geschlossen: voller Ring, Blitz, Ausblenden
          const a = fadeAll;
          ring(c, R, 4.2 + 3 * flash, a, rot);
          ring(c, R - 4, 22 + 40 * flash, (0.14 + 0.3 * flash) * a, rot);
          ring(c, R - 30, 90 * flash + 1, 0.12 * flash * a, rot);
          if (flash > 0.01) {
            c.globalAlpha = 0.5 * flash * a;
            c.strokeStyle = '#ffffff';
            c.lineWidth = 2.4;
            c.beginPath(); c.arc(500, 500, R, 0, TAU); c.stroke();
            c.globalAlpha = 1;
          }
        }
      }

      // 4) Schriftzug
      const n = letters.length;
      const sp = V.ease.smooth(ph(t, [plan.word[0], plan.word[1] + 0.25]));
      word.style.letterSpacing = (U.lerp(0.46, 0.035, sp) + 0.16 * V.ease.inCubic(out)).toFixed(4) + 'em';
      word.style.paddingLeft = word.style.letterSpacing;   // optische Mitte trotz Sperrung
      for (let i = 0; i < n; i++) {
        const t0 = plan.word[0] + i * plan.wordStep;
        const k = V.ease.smooth(ph(t, [t0, t0 + plan.wordDur]));
        const o0 = plan.out[0] + (n - 1 - i) * 0.035;
        const o = V.ease.inOutSine(ph(t, [o0, o0 + (plan.out[1] - plan.out[0]) * 0.75]));
        const L = letters[i];
        L.style.opacity = (k * (1 - o)).toFixed(3);
        const blur = (1 - k) * 2.6 + o * 2.2;
        L.style.filter = blur > 0.02 ? `blur(${blur.toFixed(2)}cqw)` : 'none';
        L.style.transform = `translateY(${((1 - k) * 1.8 - o * 0.6).toFixed(3)}cqw) scale(${(0.94 + 0.06 * k + 0.08 * o).toFixed(4)})`;
      }
    }

    const off = V.loop.add((dt) => {
      speed += (target - speed) * Math.min(1, dt * 7);
      t += dt * speed;
      if (!soundDone && t >= plan.dot[0]) { soundDone = true; V.sound.play('boot'); }
      drawFrame();
      if (t >= plan.end) finish();
    }, 30);

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      off();
      offResize();
      running = null;
      resolveFn();
      // Ebene sanft wegnehmen, während dahinter schon Einrichtung oder Zifferblatt erscheinen
      root.style.pointerEvents = 'none';
      V.tween({ duration: 0.4, ease: V.ease.outCubic, onUpdate: (v) => { root.style.opacity = (1 - v).toFixed(3); } })
        .promise.then(() => root.remove());
    }

    running = { promise, skip() { target = 6; } };
    return promise;
  }

  V.boot = {
    run,
    get running() { return !!running; },
    /** Animation abkürzen (z. B. Tests) */
    skip() { if (running) running.skip(); },
  };

  /* ------------------------------------------- Visto: „Starte neu“ */
  function restart() {
    if (running || !V.shell || V.shell.mode === 'setup' || V.shell.mode === 'boot') return;
    const go = async () => {
      if (V.convo && V.convo.active) V.convo.close();
      if (V.control && V.control.isOpen) V.control.close();
      if (V.shell.mode === 'app') await V.shell.closeApp({ to: 'home' });
      else if (V.shell.mode === 'launcher') await V.shell.home();
      V.shell.setMode('boot');
      await run({ fast: true });
      V.shell.enterHome();
      V.emit('boot:home');
    };
    go();
  }
  V.boot.restart = restart;

  if (V.actions) {
    V.actions.register('system.restart', {
      desc: 'Startet Visto neu (zeigt die Startanimation, danach das Zifferblatt). Nur auf ausdrücklichen Wunsch.',
      run() { setTimeout(restart, 1900); return { say: 'Bis gleich! Ich starte neu.', emotion: 'wink' }; },
    });
  }
  if (V.brain && V.brain.intent) {
    V.brain.intent({
      id: 'boot-restart', priority: 7,
      match: [/^(?:bitte )?(?:starte?|start) (?:dich |visto |das gerät )?neu(?: bitte)?$/, /^(?:neustart|neu starten|neu booten|reboot|restart)(?: bitte)?$/, /(?<![a-zäöüß])(?:mach|führe?) (?:einen |bitte einen )?neustart(?![a-zäöüß])/],
      run() { return V.actions.run('system.restart'); },
    });
  }
})();
