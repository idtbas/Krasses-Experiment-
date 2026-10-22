/* KYTHERA · MANDAT · Akustische Signale (synthetisch, ohne Audiodateien) */
(function () {
  'use strict';
  const KY = window.KY;
  let ctx = null, master = null, last = {};

  function init() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(f, t0, dur, type, vol, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, vol, hp, lp, swell) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // swell: Lautstärke schwillt erst an und klingt dann ab
    for (let i = 0; i < len; i++) { const x = i / len; d[i] = (Math.random() * 2 - 1) * (swell ? Math.sin(Math.PI * Math.pow(x, swell)) : 1 - x); }
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = lp ? 'lowpass' : 'highpass'; f.frequency.value = lp || hp || 2000;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0);
  }

  const SOUNDS = {
    click(t) { tone(2400, t, 0.03, 'sine', 0.05); },
    key(t) { noise(t, 0.02, 0.05, 3500); },
    nav(t) { tone(1320, t, 0.05, 'sine', 0.05); tone(1760, t + 0.03, 0.05, 'sine', 0.04); },
    note(t) { tone(880, t, 0.12, 'sine', 0.07); tone(1320, t + 0.09, 0.16, 'sine', 0.06); },
    ok(t) { tone(660, t, 0.12, 'triangle', 0.07); tone(990, t + 0.08, 0.14, 'triangle', 0.07); tone(1320, t + 0.16, 0.22, 'triangle', 0.06); },
    err(t) { tone(220, t, 0.16, 'square', 0.04); tone(180, t + 0.12, 0.2, 'square', 0.04); },
    alert(t) { for (let i = 0; i < 3; i++) { tone(988, t + i * 0.22, 0.12, 'square', 0.035); tone(740, t + i * 0.22 + 0.11, 0.1, 'square', 0.03); } },
    vote(t) { tone(523, t, 0.25, 'sine', 0.06); tone(784, t + 0.05, 0.3, 'sine', 0.04); },
    gavel(t) { noise(t, 0.08, 0.2, 400); tone(140, t, 0.2, 'sine', 0.12, 80); },
    boot(t) { tone(55, t, 1.6, 'sine', 0.12, 110); tone(220, t + 0.4, 1.2, 'sine', 0.03, 440); },
    scan(t) { tone(400, t, 0.9, 'sawtooth', 0.015, 1600); },
    grant(t) { tone(392, t, 0.4, 'sine', 0.07); tone(523, t + 0.12, 0.4, 'sine', 0.06); tone(784, t + 0.26, 0.7, 'sine', 0.06); },
    deny(t) { tone(160, t, 0.35, 'sawtooth', 0.05); },
    glitch(t) { for (let i = 0; i < 6; i++) tone(200 + Math.random() * 2000, t + i * 0.04, 0.04, 'square', 0.03); noise(t, 0.3, 0.06, 800); },
    deep(t) { tone(41, t, 3.2, 'sine', 0.18, 38); tone(82, t + 0.2, 2.8, 'triangle', 0.04, 80); },
    type(t) { tone(1900 + Math.random() * 300, t, 0.015, 'square', 0.012); },
    heart(t) { tone(62, t, 0.16, 'sine', 0.22, 44); tone(58, t + 0.24, 0.18, 'sine', 0.16, 40); },
    whoosh(t) { noise(t, 1.1, 0.16, 0, 1800, 0.35); tone(900, t, 1.1, 'sine', 0.012, 160); },
    impact(t) { noise(t, 2.6, 0.5, 0, 220); tone(48, t, 2.4, 'sine', 0.3, 26); noise(t, 0.25, 0.18, 1200); },
    rumble(t) { noise(t, 2.8, 0.42, 0, 140, 0.6); tone(34, t, 2.8, 'sine', 0.2, 30); },
    wave(t) { noise(t, 3.4, 0.34, 0, 520, 0.8); tone(70, t + 0.6, 2.6, 'sine', 0.08, 52); },
    erupt(t) { noise(t, 0.5, 0.4, 0, 320); noise(t + 0.3, 3, 0.22, 0, 600, 0.5); tone(55, t, 2.2, 'sawtooth', 0.04, 40); },
    gust(t) { noise(t, 2.4, 0.2, 0, 900, 0.5); noise(t + 0.4, 1.8, 0.08, 2400); },
    crash(t) { [880, 740, 587, 440, 330].forEach((f, i) => tone(f, t + i * 0.13, 0.22, 'triangle', 0.05)); tone(110, t + 0.6, 0.9, 'sawtooth', 0.03, 70); },
    chime(t) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.6, 'sine', 0.05)); },
    pops(t) { for (let i = 0; i < 7; i++) { const d = i * 0.17 + Math.random() * 0.1; noise(t + d, 0.12, 0.16, 300); tone(300 + Math.random() * 500, t + d, 0.3, 'sine', 0.02, 120); } },
    ice(t) { [2093, 1760, 2637].forEach((f, i) => tone(f, t + i * 0.07, 0.4, 'sine', 0.03)); noise(t + 0.2, 0.3, 0.08, 4000); },
    hum(t) { tone(110, t, 1.6, 'sine', 0.05, 220); tone(165, t + 0.1, 1.5, 'sine', 0.03, 330); },
  };

  let on = true, vol = 0.5;
  KY.audio = {
    unlock() { if (init() && ctx.state === 'suspended') ctx.resume(); },
    setOn(v) { on = !!v; },
    setVol(v) { vol = v; },
    play(name) {
      const S = KY.sim && KY.sim.S;
      if (S && S.ui && S.ui.sound === false) return;
      if (!on || !init() || !SOUNDS[name]) return;
      const now = ctx.currentTime;
      if (last[name] && now - last[name] < 0.06) return;
      last[name] = now;
      master.gain.value = vol;
      try { SOUNDS[name](now + 0.01); } catch (e) { /* stumm */ }
    },
  };
})();
