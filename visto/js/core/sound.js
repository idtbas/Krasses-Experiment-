/* VistoOS · core/sound.js — leise, synthetische Systemklänge (Web Audio) und Haptik
 *
 *  V.sound.play('tap' | 'tick' | 'open' | 'close' | 'wake' | 'sleep' | 'success' | 'notify' | 'error' | 'lock' | 'boot')
 *  const stop = V.sound.alarm('chime' | 'marimba' | 'pulse')   → stop()
 *  V.sound.ctx()  AudioContext (für Apps wie Musik), V.sound.out() Hauptausgang
 *  V.haptic(ms | muster)
 */
'use strict';
(function () {
  const V = window.V;
  let ctx = null, master = null, comp = null;
  let forcing = false;   // Wecker/Alarme klingen auch bei ausgeschalteten Systemtönen

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3;
      master = ctx.createGain();
      master.gain.value = vol();
      master.connect(comp).connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function vol() { return Math.pow(V.store.get('settings.volume', 0.6), 1.6); }
  V.on('store:settings.volume', () => { if (master) master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.05); });

  // Audio erst nach einer Berührung erlaubt
  const unlock = () => { ensure(); };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });

  function tone(o) {
    if (!o.force && !forcing && !V.store.get('settings.sounds', true)) return;
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (o.at || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || o.d || 0.1));
    const peak = (o.g || 0.1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.a || 0.004) + (o.d || 0.12));
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g).connect(o.dest || master);
    osc.start(t0);
    osc.stop(t0 + (o.a || 0.004) + (o.d || 0.12) + 0.05);
  }
  function bell(f, at, g = 0.05, d = 0.9) {
    tone({ f, at, g, d, type: 'sine' });
    tone({ f: f * 2.76, at, g: g * 0.25, d: d * 0.45, type: 'sine' });
    tone({ f: f * 5.4, at, g: g * 0.08, d: d * 0.2, type: 'sine' });
  }

  const SOUNDS = {
    tap() { tone({ f: 1500, f2: 1100, d: 0.035, g: 0.035, type: 'triangle', lp: 4000 }); },
    tick() { tone({ f: 2600, d: 0.012, g: 0.022, type: 'square', lp: 3200 }); },
    open() { tone({ f: 620, f2: 880, d: 0.16, g: 0.04 }); tone({ f: 1240, at: 0.03, d: 0.18, g: 0.018 }); },
    close() { tone({ f: 880, f2: 560, d: 0.16, g: 0.035 }); },
    wake() { bell(523.25, 0, 0.045, 0.8); bell(783.99, 0.07, 0.04, 0.9); bell(1046.5, 0.14, 0.03, 1.1); },
    sleep() { bell(987.77, 0, 0.03, 0.5); bell(659.25, 0.08, 0.03, 0.7); },
    think() { tone({ f: 1318.5, d: 0.25, g: 0.012 }); },
    success() { bell(1318.5, 0, 0.04, 0.5); bell(1975.5, 0.09, 0.035, 0.7); },
    notify() { bell(1174.7, 0, 0.05, 0.7); bell(1568, 0.12, 0.045, 0.9); },
    error() { tone({ f: 220, d: 0.12, g: 0.06, type: 'triangle' }); tone({ f: 196, at: 0.14, d: 0.16, g: 0.06, type: 'triangle' }); },
    lock() { tone({ f: 700, f2: 300, d: 0.09, g: 0.04, type: 'triangle' }); },
    boot() {
      const notes = [261.63, 392, 523.25, 659.25, 783.99];
      notes.forEach((f, i) => bell(f, i * 0.11, 0.035, 1.6));
    },
  };

  V.sound = {
    ctx: ensure,
    out() { ensure(); return master; },
    enabled() { return V.store.get('settings.sounds', true); },
    play(name) {
      if (!V.sound.enabled()) return;
      const ua = navigator.userActivation;
      if (ua && !ua.hasBeenActive) return;   // Browser erlauben Ton erst nach einer Berührung
      const fn = SOUNDS[name];
      if (fn) try { fn(); } catch (e) { /* stumm */ }
    },
    tone, bell,
    /** wiederholter Weckton bis stop() */
    alarm(kind = 'chime') {
      let alive = true, i = 0;
      const pattern = {
        chime: () => { bell(1046.5, 0, 0.06, 0.6); bell(1318.5, 0.18, 0.06, 0.6); bell(1568, 0.36, 0.06, 0.9); },
        marimba: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone({ f, at: k * 0.12, d: 0.35, g: 0.07, type: 'sine' })); },
        pulse: () => { tone({ f: 880, d: 0.12, g: 0.06, type: 'triangle' }); tone({ f: 880, at: 0.2, d: 0.12, g: 0.06, type: 'triangle' }); },
        sunrise: () => { const b = [392, 493.88, 587.33, 739.99]; b.forEach((f, k) => bell(f * (1 + (i % 3) * 0.122), k * 0.2, 0.025 + Math.min(i, 8) * 0.006, 1.4)); },
      }[kind] || (() => {});
      const run = () => { if (!alive) return; i++; forcing = true; try { pattern(); } catch (e) { /* */ } forcing = false; V.haptic([60, 80, 60]); setTimeout(run, kind === 'sunrise' ? 1600 : 1400); };
      run();
      return () => { alive = false; };
    },
  };

  V.haptic = function (p) {
    if (!V.store.get('settings.haptics', true)) return;
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive) return;
    try { if (navigator.vibrate) navigator.vibrate(p || 8); } catch (e) { /* */ }
  };
})();
