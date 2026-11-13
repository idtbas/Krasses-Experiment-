/* VistoOS · apps/music.js — Musik: generatives Radio mit fünf Sendern
 *
 *  Klang   Alles wird live mit Web Audio erzeugt (keine Dateien). Jeder Sender hat einen eigenen
 *          Charakter; jeder „Titel“ ist ein aus einem Startwert komponiertes Stück mit Form
 *          (Intro · Thema · Variation · Brücke · Ausklang). Weil jeder Schritt deterministisch ist,
 *          kann man darin spulen. Scheduler mit Vorlauf (unabhängig von der Oberfläche) → die Musik
 *          läuft weiter, wenn die App geschlossen ist. Ohne freigegebenen Ton läuft eine stille Uhr.
 *          Ausgabe über V.sound.out() (folgt settings.volume), Visto-Gespräche ducken die Musik.
 *  Bild    Sich drehende Scheibe mit generativer Cover-Kunst je Titel, Strahlenkranz aus einem
 *          AnalyserNode, Fortschritt am Rand (Kopf ziehen = spulen), Titel und Sender am Bogen,
 *          Sender per Wischen links/rechts oder Drehen am Rand.
 *  Daten   V.info.music() → {title, artist, playing, color, progress, station} · Ereignis 'music:changed'
 *          V.music.play(station?) · pause() · toggle() · next() · previous() · info()
 *  Aktionen music.play {station?} · music.pause · music.next · music.previous · music.status
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const APP_COLOR = '#FF375F';
  const RD = 290;                      // Scheibenradius (logisch)
  const MIX = 0.85;                    // Musikpegel vor dem Hauptausgang
  const SECTION = { I: 'Intro', A: 'Thema', B: 'Variation', C: 'Brücke', O: 'Ausklang' };
  const ENERGY = { I: 0.4, A: 0.75, B: 1, C: 0.55, O: 0.35 };

  /* =============================================================== Hilfen */
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  /** deterministischer Zufall 0…1 aus drei Ganzzahlen (für Spulen: gleiche Stelle = gleiche Noten) */
  function hr(a, b, c) {
    let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }

  const Q = {
    maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
    dom9: [0, 4, 7, 10, 14], m6: [0, 3, 7, 9], sus: [0, 5, 7, 10, 14], add9: [0, 4, 7, 14],
    madd9: [0, 3, 7, 14], six9: [0, 4, 7, 9, 14],
  };
  const PENTA = [0, 2, 4, 7, 9];
  const MPENTA = [0, 3, 5, 7, 10];
  const ARPS = [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 5], [0, 3, 1, 4, 2, 5, 3, 6], [0, 4, 2, 5, 1, 6, 3, 7]];
  const PROG = {
    lofi: [
      [[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [9, 'm9']],
      [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
      [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'dom9']],
      [[9, 'm9'], [2, 'm9'], [7, 'dom9'], [0, 'maj9']],
    ],
    fokus: [
      [[0, 'madd9'], [8, 'maj7'], [3, 'add9'], [10, 'six9']],
      [[0, 'm9'], [5, 'm7'], [8, 'maj9'], [7, 'm7']],
      [[0, 'madd9'], [10, 'add9'], [8, 'maj7'], [5, 'm9']],
    ],
    regen: [
      [[0, 'add9'], [9, 'm7'], [5, 'maj7'], [7, 'sus']],
      [[0, 'maj7'], [4, 'm7'], [9, 'm9'], [5, 'add9']],
      [[5, 'maj9'], [0, 'add9'], [9, 'm7'], [7, 'sus']],
    ],
    abend: [
      [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [5, 'm6']],
      [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'sus']],
      [[0, 'six9'], [7, 'sus'], [9, 'm9'], [5, 'maj7']],
    ],
    meer: [
      [[0, 'sus'], [5, 'add9'], [9, 'm7'], [7, 'sus']],
      [[0, 'add9'], [7, 'sus'], [5, 'maj7'], [0, 'sus']],
    ],
  };

  /** Form eines Stücks: Intro 4 · (Thema 8 · Variation 8 · Brücke 4)… · Ausklang 4 Takte */
  function form(n) {
    const out = [];
    let idx = 0;
    const push = (name, len) => { for (let k = 0; k < len; k++) out.push({ name, k, n: len, idx, e: ENERGY[name] }); idx++; };
    push('I', 4);
    const seq = ['A', 'B', 'C'];
    let mid = n - 8, j = 0;
    while (mid > 0) {
      const nm = seq[j % 3];
      let len = Math.min(nm === 'C' ? 4 : 8, mid);
      if (mid - len > 0 && mid - len < 4) len = mid;
      push(nm, len);
      mid -= len; j++;
    }
    push('O', 4);
    return out;
  }

  /** kurzes Motiv (2 Takte), das sich wiederholt – klingt musikalischer als Zufallsnoten */
  function motif(seed, salt, density) {
    const rnd = U.rng((seed ^ Math.imul(salt, 2654435761)) >>> 0);
    const map = new Map();
    let d = 3 + Math.floor(rnd() * 4);
    for (let s = 0; s < 32; s += 2) {
      const strong = s % 8 === 0;
      if (rnd() < density * (strong ? 1.6 : 0.85)) {
        d = U.clamp(d + [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(rnd() * 8)], 0, 9);
        map.set(s, { d, l: [2, 2, 3, 4, 4, 6, 8][Math.floor(rnd() * 7)], v: 0.55 + rnd() * 0.45 });
      }
    }
    return map;
  }

  /* ========================================================== Klangbasis */
  function noiseBuffer(ac, sec, kind) {
    const len = Math.floor(ac.sampleRate * sec);
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function crackleBuffer(ac, sec) {
    const len = Math.floor(ac.sampleRate * sec);
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    let tail = 0;
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.00055) tail = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.75);
      d[i] = tail + (Math.random() * 2 - 1) * 0.012;
      tail *= 0.62;
    }
    return b;
  }
  function impulse(ac, sec) {
    const rate = ac.sampleRate, len = Math.floor(rate * sec);
    const b = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.1 + 0.78 * t;                       // Nachhall wird dunkler
        lp += (Math.random() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - t, 2.6) * (i < rate * 0.015 ? i / (rate * 0.015) : 1);
      }
    }
    return b;
  }
  function wave(ac, amps) {
    const n = amps.length + 1;
    const re = new Float32Array(n), im = new Float32Array(n);
    amps.forEach((a, i) => { im[i + 1] = a; });
    return ac.createPeriodicWave(re, im);
  }

  /** gemeinsamer Klangweg: Mischpult → Ducking → Ausgang, Hall und Echo als Sends, Analyse */
  function buildGraph(ac, dest) {
    const G = { ac };
    G.mix = ac.createGain(); G.mix.gain.value = MIX;
    G.duck = ac.createGain();
    G.mix.connect(G.duck); G.duck.connect(dest);
    G.an = ac.createAnalyser();
    G.an.fftSize = 512; G.an.smoothingTimeConstant = 0.7; G.an.minDecibels = -92; G.an.maxDecibels = -22;
    G.mix.connect(G.an);
    G.revIn = ac.createGain();
    const conv = ac.createConvolver(); conv.buffer = impulse(ac, 2.6);
    const revRet = ac.createGain(); revRet.gain.value = 0.8;
    G.revIn.connect(conv); conv.connect(revRet); revRet.connect(G.mix);
    G.dlyIn = ac.createGain();
    G.dly = ac.createDelay(2.5); G.dly.delayTime.value = 0.45;
    const fb = ac.createGain(); fb.gain.value = 0.36;
    const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2500;
    const dret = ac.createGain(); dret.gain.value = 0.5;
    const d2r = ac.createGain(); d2r.gain.value = 0.3;
    G.dlyIn.connect(G.dly); G.dly.connect(dlp); dlp.connect(fb); fb.connect(G.dly);
    dlp.connect(dret); dret.connect(G.mix); dlp.connect(d2r); d2r.connect(G.revIn);
    G.white = noiseBuffer(ac, 2, 'white');
    G.pink = noiseBuffer(ac, 6, 'pink');
    G.crackle = crackleBuffer(ac, 5);
    G.W = {
      ep: wave(ac, [1, 0.36, 0.1, 0.14, 0.03, 0.05, 0.015]),
      piano: wave(ac, [1, 0.62, 0.34, 0.2, 0.12, 0.08, 0.05, 0.035, 0.02]),
      pluck: wave(ac, [1, 0.5, 0.3, 0.18, 0.1, 0.06]),
      bass: wave(ac, [1, 0.28, 0.08, 0.03]),
      warm: wave(ac, [1, 0.5, 0.32, 0.24, 0.18, 0.14, 0.11, 0.09, 0.07, 0.05]),
      soft: wave(ac, [1, 0.12, 0.04]),
      glass: wave(ac, [1, 0, 0.2, 0, 0.07, 0, 0.03]),
    };
    return G;
  }

  /* ============================================================ Sitzung
   *  Eine Sitzung spielt einen Titel ab einem Schritt (16tel). Eigene Ein-/Ausblend-Gains für
   *  Trocken-, Hall- und Echoweg erlauben saubere Überblendungen zwischen Titeln und Sendern.
   */
  function Session(G, st, track, startStep, when) {
    this.G = G; this.ac = G ? G.ac : null;
    this.st = st; this.track = track;
    this.song = songOf(st, track);
    this.sd = this.song.sd; this.seed = this.song.seed;
    this.startStep = startStep; this.step = startStep;
    this.nextTime = when; this.t0 = when - startStep * this.sd;
    this.alive = true; this.nodes = []; this.srcs = []; this.busMap = {}; this.arpCache = {};
    this.visual = false;
    if (this.ac) {
      const ac = this.ac;
      this.dry = ac.createGain(); this.rev = ac.createGain(); this.dl = ac.createGain();
      for (const n of [this.dry, this.rev, this.dl]) n.gain.value = 0;
      this.dry.connect(G.mix); this.rev.connect(G.revIn); this.dl.connect(G.dlyIn);
      this.nodes.push(this.dry, this.rev, this.dl);
      if (st.setup) { try { st.setup(this, when); } catch (e) { console.error('[Musik] setup', e); } }
    }
  }
  const SP = Session.prototype;
  SP.now = function () { return this.ac ? this.ac.currentTime : performance.now() / 1000; };
  SP.posSteps = function () { return U.clamp((this.now() - this.t0) / this.sd, this.startStep, this.song.total); };
  SP.fade = function (to, t, d) {
    if (!this.ac) return;
    for (const n of [this.dry, this.rev, this.dl]) {
      const g = n.gain;
      if (to > 0) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); }
      else if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
      g.linearRampToValueAtTime(to, t + d);
    }
  };
  SP.dispose = function () {
    if (!this.alive) return;
    this.alive = false;
    for (const s of this.srcs) { try { s.stop(); } catch (e) { /* schon aus */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* egal */ } }
    this.srcs.length = 0; this.nodes.length = 0; this.busMap = {};
  };
  /** Instrumentenbus mit Filtern und Sends, nach Bedarf angelegt */
  SP.bus = function (name) {
    let b = this.busMap[name];
    if (b) return b;
    const o = (this.st.buses && this.st.buses[name]) || {};
    const ac = this.ac;
    const inp = ac.createGain();
    inp.gain.value = o.gain !== undefined ? o.gain : 1;
    if (this.solo && this.solo.indexOf(name) < 0) inp.gain.value = 0;   // nur Test-Rendering
    this.nodes.push(inp);
    let tail = inp, lp = null;
    const filt = (type, f, q) => {
      const x = ac.createBiquadFilter();
      x.type = type; x.frequency.value = f; x.Q.value = q;
      tail.connect(x); tail = x; this.nodes.push(x);
      return x;
    };
    if (o.hp) filt('highpass', o.hp, 0.6);
    if (o.bp) filt('bandpass', o.bp, o.bq || 0.8);
    if (o.lp) lp = filt('lowpass', o.lp, o.lq || 0.6);
    tail.connect(this.dry);
    if (o.rev) { const s = ac.createGain(); s.gain.value = o.rev; tail.connect(s); s.connect(this.rev); this.nodes.push(s); }
    if (o.dly) { const s = ac.createGain(); s.gain.value = o.dly; tail.connect(s); s.connect(this.dl); this.nodes.push(s); }
    b = this.busMap[name] = { in: inp, lp };
    return b;
  };
  SP.lp = function (name, f, t, tau) { if (!this.ac) return; const b = this.bus(name); if (b.lp) b.lp.frequency.setTargetAtTime(f, t, tau || 0.6); };
  /** „Sidechain“-Pumpen eines Busses im Takt */
  SP.pump = function (name, t, depth) {
    if (!this.ac || (this.solo && this.solo.indexOf(name) < 0)) return;
    const g = this.bus(name).in.gain;
    g.setTargetAtTime(1 - depth, t, 0.012);
    g.setTargetAtTime(1, t + 0.05, 0.12);
  };
  SP.vis = function (t, k, v, m) {
    if (!this.visual || !E.visOn) return;
    E.ev.push({ t, k, v, m });
    if (E.ev.length > 320) E.ev.splice(0, 80);
  };
  SP.r = function (i, salt) { return hr(this.seed, i, salt); };
  SP.bar = function (i) { const b = this.song.bars; return b[Math.min(b.length - 1, i >> 4)]; };
  SP.isStart = function (i) { return i === this.startStep; };
  SP.chord = function (idx) { const p = this.song.prog; return p[U.wrap(idx, p.length)]; };
  SP.voice = function (c, lo, hi) {
    const root = this.song.key + c[0];
    const out = [];
    for (const iv of Q[c[1]]) {
      let n = root + iv;
      while (n < lo) n += 12;
      while (n >= hi) n -= 12;
      if (out.indexOf(n) < 0) out.push(n);
    }
    return out.sort((a, b) => a - b);
  };
  SP.root = function (c, lo) { lo = lo || 36; let n = this.song.key + c[0]; while (n < lo) n += 12; while (n >= lo + 12) n -= 12; return n; };
  SP.deg = function (d) {
    const sc = this.song.scale || PENTA;
    return this.song.key + (this.song.melOct || 24) + Math.floor(d / sc.length) * 12 + sc[U.wrap(d, sc.length)];
  };
  SP.mel = function (i, letter) {
    const mot = this.song.mot[letter];
    const n = mot && mot.get(i & 31);
    return n ? { m: this.deg(n.d), l: n.l, v: n.v } : null;
  };
  SP.arpNotes = function (ci, c) {
    const key = U.wrap(ci, this.song.prog.length);
    if (this.arpCache[key]) return this.arpCache[key];
    const out = [];
    for (let o = 0; o < 4; o++) for (const iv of Q[c[1]]) { const n = this.song.key + c[0] + iv + o * 12; if (n >= 57 && n < 86 && out.indexOf(n) < 0) out.push(n); }
    out.sort((a, b) => a - b);
    return (this.arpCache[key] = out.slice(0, 8));
  };
  SP.noise = function (t, buf, dur) {
    const s = this.ac.createBufferSource();
    s.buffer = buf;
    s.start(t, Math.random() * Math.max(0, buf.duration - dur - 0.1), dur + 0.05);
    return s;
  };
  SP.loop = function (buf, t) {
    const s = this.ac.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(t, Math.random() * buf.duration * 0.9);
    this.srcs.push(s); this.nodes.push(s);
    return s;
  };

  /* ------------------------------------------------------- Instrumente */
  SP.keys = function (t, m, dur, vel, bus) {
    this.vis(t, 'note', vel * 0.8, m);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.setPeriodicWave(this.G.W.ep);
    o.frequency.value = mtof(m);
    if (this.song.wobble) {          // Bandschwankung (Lo-Fi)
      const w = (x) => Math.sin(x * 2.3) * 6 + Math.sin(x * 0.61) * 5;
      o.detune.setValueAtTime(w(t), t);
      o.detune.linearRampToValueAtTime(w(t + dur), t + dur);
    }
    const pk = 0.12 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.006);
    g.gain.setTargetAtTime(pk * 0.4, t + 0.012, 0.42);
    g.gain.setTargetAtTime(0, t + dur, 0.15);
    o.connect(g); g.connect(this.bus(bus || 'keys').in);
    o.start(t); o.stop(t + dur + 1);
  };
  SP.pad = function (t, m, dur, vel, att, rel, bus) {
    this.vis(t, 'pad', vel * 0.5, m);
    if (!this.ac) return;
    att = att || 1.2; rel = rel || 1.8;
    const ac = this.ac, g = ac.createGain(), f = mtof(m), hold = Math.max(att, dur);
    const pk = 0.04 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + att);
    g.gain.setValueAtTime(pk, t + hold);
    g.gain.setTargetAtTime(0, t + hold, rel / 3);
    const wv = this.G.W[this.song.padWave || 'warm'];
    for (const d of [-7, 7]) {
      const o = ac.createOscillator();
      o.setPeriodicWave(wv); o.frequency.value = f; o.detune.value = d;
      o.connect(g); o.start(t); o.stop(t + hold + rel * 1.7);
    }
    g.connect(this.bus(bus || 'pad').in);
  };
  SP.pluck = function (t, m, vel, dec, bus) {
    this.vis(t, 'note', vel * 0.6, m);
    if (!this.ac) return;
    dec = dec || 0.16;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.setPeriodicWave(this.G.W.pluck); o.frequency.value = mtof(m);
    const pk = 0.07 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.006, dec);
    o.connect(g); g.connect(this.bus(bus || 'arp').in);
    o.start(t); o.stop(t + dec * 6 + 0.05);
  };
  SP.piano = function (t, m, vel, dur, bus) {
    this.vis(t, 'piano', vel, m);
    if (!this.ac) return;
    dur = dur || 2.4;
    const ac = this.ac, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.setPeriodicWave(this.G.W.piano); o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.Q.value = 0.3;
    f.frequency.setValueAtTime(1500 + 4200 * vel, t);
    f.frequency.setTargetAtTime(600 + mtof(m) * 1.6, t + 0.01, 0.45);
    const pk = 0.11 * vel, tau = U.clamp(1.7 - (m - 48) * 0.025, 0.55, 1.9);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.005);
    g.gain.setTargetAtTime(0, t + 0.01, tau);
    g.gain.setTargetAtTime(0, t + dur, 0.25);
    o.connect(f); f.connect(g); g.connect(this.bus(bus || 'piano').in);
    o.start(t); o.stop(t + Math.min(dur + 1.5, tau * 5 + 0.2));
  };
  SP.bass = function (t, m, dur, vel, bus, att) {
    this.vis(t, 'bass', vel, m);
    if (!this.ac) return;
    att = att || 0.012;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.setPeriodicWave(this.G.W.bass); o.frequency.value = mtof(m);
    const pk = 0.2 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + att);
    g.gain.setTargetAtTime(pk * 0.72, t + att + 0.01, 0.2);
    g.gain.setTargetAtTime(0, t + Math.max(dur, att), 0.08);
    o.connect(g); g.connect(this.bus(bus || 'bass').in);
    o.start(t); o.stop(t + Math.max(dur, att) + 0.6);
  };
  SP.lead = function (t, m, dur, vel, bus) {
    this.vis(t, 'note', vel, m);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.setPeriodicWave(this.G.W.soft); o.frequency.value = mtof(m);
    o.detune.setValueAtTime(-8, t);
    o.detune.linearRampToValueAtTime(0, t + 0.07);
    const pk = 0.055 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.03);
    g.gain.setTargetAtTime(pk * 0.6, t + 0.05, 0.3);
    g.gain.setTargetAtTime(0, t + dur, 0.2);
    o.connect(g); g.connect(this.bus(bus || 'lead').in);
    o.start(t); o.stop(t + dur + 1.2);
  };
  SP.kick = function (t, vel) {
    this.vis(t, 'kick', vel);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(128, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4 * vel, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.02, 0.1);
    o.connect(g); g.connect(this.bus('drums').in);
    o.start(t); o.stop(t + 0.7);
  };
  SP.hat = function (t, vel, open) {
    this.vis(t, 'hat', vel);
    if (!this.ac) return;
    const s = this.noise(t, this.G.white, open ? 0.4 : 0.1), g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.055 * vel, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.004, open ? 0.07 : 0.018);
    s.connect(g); g.connect(this.bus('hat').in);
  };
  SP.snare = function (t, vel) {
    this.vis(t, 'snare', vel);
    if (!this.ac) return;
    const ac = this.ac, s = this.noise(t, this.G.white, 0.3), g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42 * vel, t + 0.003);
    g.gain.setTargetAtTime(0, t + 0.01, 0.055);
    s.connect(g); g.connect(this.bus('snare').in);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.07 * vel, t + 0.002);
    og.gain.setTargetAtTime(0, t + 0.005, 0.03);
    o.connect(og); og.connect(this.bus('drums').in);
    o.start(t); o.stop(t + 0.25);
  };
  SP.shaker = function (t, vel) {
    this.vis(t, 'hat', vel * 0.6);
    if (!this.ac) return;
    const s = this.noise(t, this.G.white, 0.12), g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045 * vel, t + 0.014);
    g.gain.setTargetAtTime(0, t + 0.016, 0.03);
    s.connect(g); g.connect(this.bus('shaker').in);
  };
  SP.drop = function (t, f, vel, pan) {
    this.vis(t, 'drop', vel, 80 + (f - 1700) / 250);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.03);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045 * vel, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.004, 0.018);
    let tail = g;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    o.connect(g); tail.connect(this.bus('drops').in);
    o.start(t); o.stop(t + 0.15);
  };
  SP.chime = function (t, m, vel) {
    this.vis(t, 'chime', vel, m);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.setPeriodicWave(this.G.W.glass); o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.01);
    g.gain.setTargetAtTime(0, t + 0.02, 1.3);
    o.connect(g); g.connect(this.bus('chime').in);
    o.start(t); o.stop(t + 7);
  };
  SP.glide = function (t, m1, m2, dur, vel) {
    this.vis(t, 'chime', vel * 0.6, m2);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(mtof(m1), t);
    o.frequency.exponentialRampToValueAtTime(mtof(m2), t + dur * 0.7);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.03 * vel, t + dur * 0.35);
    g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.2);
    o.connect(g); g.connect(this.bus('chime').in);
    o.start(t); o.stop(t + dur * 1.8 + 0.5);
  };
  SP.rumble = function (t, vel) {
    this.vis(t, 'wave', vel * 0.8);
    if (!this.ac) return;
    const ac = this.ac, s = this.noise(t, this.G.pink, 5.8), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(90, t);
    f.frequency.linearRampToValueAtTime(190, t + 1.2);
    f.frequency.setTargetAtTime(70, t + 1.5, 2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.4 * vel, t + 1.1);
    g.gain.setTargetAtTime(0, t + 1.6, 1.2);
    s.connect(f); f.connect(g); g.connect(this.bus('amb').in);
  };
  SP.crickets = function (t, vel) {
    this.vis(t, 'hat', vel * 0.4);
    if (!this.ac) return;
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = 4300 + Math.random() * 600;
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 3; k++) {
      const s = t + k * 0.075;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.01 * vel, s + 0.006);
      g.gain.linearRampToValueAtTime(0, s + 0.04);
    }
    o.connect(g); g.connect(this.bus('amb').in);
    o.start(t); o.stop(t + 0.3);
  };
  /** Meereswelle: Rauschen schwillt an, bricht (Gischt), zieht sich zurück */
  SP.wave = function (t, L, v) {
    this.vis(t, 'wave', v);
    const w = this.sea;
    if (!this.ac || !w) return;
    const rise = L * 0.42, crest = t + rise;
    w.lp.frequency.setTargetAtTime(480 + 1100 * v, t, rise / 2.6);
    w.g.gain.setTargetAtTime(0.25 + 0.75 * v, t, rise / 2.6);
    w.fg.gain.setTargetAtTime(0.11 * v, crest - 0.35, 0.22);
    w.fg.gain.setTargetAtTime(0, crest + 0.45, L * 0.11);
    w.lp.frequency.setTargetAtTime(260, crest + 0.2, L * 0.18);
    w.g.gain.setTargetAtTime(0.1, crest + 0.2, L * 0.2);
    if (w.pan) w.pan.pan.setTargetAtTime(this.r(Math.round(t * 10), 9) * 1.1 - 0.55, t, L * 0.3);
  };

  /* ============================================================ Sender */
  const STATIONS = [
    {
      id: 'lofi', name: 'Lo-Fi Morgen', c1: '#FFA36C', c2: '#FF6FA8',
      titles: ['Kaffee am Fenster', 'Erste Sonne', 'Halb acht', 'Milchschaum', 'Zeitung und Toast', 'Stille Straße', 'Morgenmantel', 'Noch fünf Minuten', 'Frühstücksradio', 'Tau am Balkon', 'Hafermilch', 'Die Stadt erwacht'],
      compose: (r) => ({
        bpm: 72 + Math.floor(r() * 12), swing: 0.18 + r() * 0.1, key: 48 + pick(r, [0, 2, 3, 5, 7, 8, 10]), prog: pick(r, PROG.lofi),
        comp: pick(r, [[0, 10], [0, 7, 12], [0, 6, 11], [0, 3, 10]]), mel: 0.2 + r() * 0.14, scale: PENTA, melOct: 24, wobble: true, kick7: r() < 0.5,
      }),
      buses: {
        keys: { lp: 2000, lq: 0.8, rev: 0.26, dly: 0.08 },
        mel: { lp: 3400, rev: 0.32, dly: 0.34, gain: 0.85 },
        bass: { lp: 480, gain: 0.85 }, drums: { lp: 4200 },
        hat: { hp: 6500, lp: 9500, gain: 3.6 },
        snare: { bp: 1700, bq: 0.6, lp: 5200, rev: 0.12, gain: 1.1 },
        crack: { hp: 1100, lp: 7000, gain: 0.45 },
      },
      setup(S, t) { S.loop(S.G.crackle, t).connect(S.bus('crack').in); },
      step(S, i, t) {
        const b = S.bar(i), s = i & 15, sec = b.name, bi = i >> 4;
        const ch = S.chord(bi);
        if (s === 0) S.lp('keys', sec === 'I' ? 620 + 300 * b.k : sec === 'O' ? 1700 - 260 * b.k : sec === 'C' ? 1350 : 2100, t, 0.8);
        const comp = S.song.comp, ci = comp.indexOf(s);
        if (ci >= 0) {
          const nxt = ci + 1 < comp.length ? comp[ci + 1] : 16;
          const dur = (nxt - s) * S.sd * 0.94;
          const vel = (ci === 0 ? 0.92 : 0.6) * (0.85 + 0.15 * S.r(i, 1)) * (sec === 'O' ? 0.8 : 1);
          S.voice(ch, 55, 72).forEach((m, k) => S.keys(t + k * 0.016 + S.r(i, 10 + k) * 0.008, m, dur, vel * (k ? 0.82 : 1)));
        }
        const groove = sec === 'A' || sec === 'B' || (sec === 'O' && b.k < 2);
        if (groove) {
          const dv = sec === 'O' ? 0.55 : 1;
          if (s === 0 || s === 10 || (S.song.kick7 && s === 7 && (bi & 1))) S.kick(t, (s === 0 ? 1 : 0.72) * dv);
          if (s === 4 || s === 12) S.snare(t + 0.01, 0.75 * dv);
          if (!(s & 1)) S.hat(t, (s & 3 ? 0.95 : 0.6) * (0.75 + 0.25 * S.r(i, 4)) * dv, s === 14 && S.r(i, 5) < 0.25);
          else if (sec === 'B' && S.r(i, 6) < 0.35) S.hat(t, 0.32 * dv);
          if (s === 0) S.bass(t, S.root(ch), S.sd * 7, 0.95 * dv);
          if (s === 10) S.bass(t, S.root(ch) + (S.r(bi, 7) < 0.5 ? 7 : 12), S.sd * 4.5, 0.7 * dv);
        } else if (sec === 'C' && (s & 3) === 2) S.hat(t, 0.38);
        if (sec === 'B' || sec === 'C') { const n = S.mel(i, sec); if (n) S.keys(t, n.m, n.l * S.sd, n.v * 0.75, 'mel'); }
      },
      art(g, N, r) {
        const sky = g.createLinearGradient(0, 0, N * 0.25, N);
        sky.addColorStop(0, '#22163F'); sky.addColorStop(0.42, '#8E3B6E'); sky.addColorStop(0.7, '#F07A63'); sky.addColorStop(1, '#FFC98B');
        g.fillStyle = sky; g.fillRect(0, 0, N, N);
        for (let k = 0; k < 70; k++) {
          g.fillStyle = `rgba(255,240,220,${(0.15 + r() * 0.5).toFixed(2)})`;
          g.beginPath(); g.arc(r() * N, r() * N * 0.42, 0.6 + r() * 1.5, 0, TAU); g.fill();
        }
        for (let k = 0; k < 4; k++) {
          const y = N * (0.25 + r() * 0.3), x = r() * N, w = N * (0.25 + r() * 0.3);
          const cg = g.createLinearGradient(x - w, 0, x + w, 0);
          cg.addColorStop(0, 'rgba(255,200,190,0)'); cg.addColorStop(0.5, `rgba(255,205,195,${(0.12 + r() * 0.14).toFixed(2)})`); cg.addColorStop(1, 'rgba(255,200,190,0)');
          g.fillStyle = cg; g.fillRect(x - w, y, 2 * w, N * (0.008 + r() * 0.014));
        }
        const sx = N * (0.36 + r() * 0.28), sy = N * (0.56 + r() * 0.06), sr = N * (0.17 + r() * 0.04);
        const halo = g.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 2.6);
        halo.addColorStop(0, 'rgba(255,190,140,.45)'); halo.addColorStop(1, 'rgba(255,190,140,0)');
        g.fillStyle = halo; g.fillRect(0, 0, N, N);
        const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr);
        sg.addColorStop(0, '#FFF0B5'); sg.addColorStop(0.6, '#FFB07A'); sg.addColorStop(1, '#FF6F7D');
        g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
        g.fillStyle = sky;
        for (let k = 0; k < 6; k++) g.fillRect(sx - sr - 2, sy + sr * (0.05 + k * 0.17), sr * 2 + 4, sr * (0.025 + k * 0.022));
        ['#5B2A5E', '#3E1E4A', '#24122F'].forEach((c, k) => {
          const base = N * (0.66 + k * 0.1), amp = N * (0.05 + r() * 0.04), ph = r() * TAU, fr = 1.2 + r() * 1.6;
          g.fillStyle = c; g.beginPath(); g.moveTo(0, N);
          for (let x = 0; x <= N; x += 8) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(ph + (x / N) * fr * TAU)));
          g.lineTo(N, N); g.closePath(); g.fill();
        });
      },
    },
    {
      id: 'fokus', name: 'Tiefe Konzentration', c1: '#7C83FF', c2: '#46E6FF',
      titles: ['Klarer Raum', 'Tiefenschärfe', 'Gedankenfluss', 'Satz für Satz', 'Ruhepuls', 'Gitterlicht', 'Schritt für Schritt', 'Stille Arbeit', 'Kompass', 'Lange Linie', 'Präzision', 'Leuchtraster'],
      compose: (r) => ({
        bpm: 98 + Math.floor(r() * 10), swing: 0, key: 45 + pick(r, [0, 2, 4, 5, 7]), prog: pick(r, PROG.fokus),
        arp: pick(r, ARPS), mel: 0.18, scale: MPENTA, melOct: 24,
      }),
      buses: {
        pad: { lp: 1100, lq: 0.4, rev: 0.45, gain: 1.4 },
        arp: { lp: 1600, lq: 2.2, rev: 0.25, dly: 0.38, gain: 2.5 },
        sub: { lp: 240, gain: 0.5 }, drums: { lp: 900 },
        hat: { hp: 8000, gain: 1.4 },
        lead: { lp: 2600, rev: 0.4, dly: 0.3 },
      },
      step(S, i, t) {
        const b = S.bar(i), sec = b.name, s = i & 15, s32 = i & 31, ci = i >> 5;
        const ch = S.chord(ci);
        if (s32 === 0 || S.isStart(i)) {
          const left = (32 - s32) * S.sd;
          const pv = sec === 'I' ? 0.75 : sec === 'O' ? 0.6 : 0.9;
          S.voice(ch, 50, 67).forEach((m) => S.pad(t, m, left + 0.3, pv, 1.4, 2.6));
          if (sec !== 'I') S.bass(t, S.root(ch, 33), left * 0.95, 0.75, 'sub', 0.4);
        }
        if (s === 0) {
          const sw = 0.5 + 0.5 * Math.sin((i >> 4) * 0.55);
          S.lp('arp', sec === 'I' ? 900 + 300 * b.k : sec === 'O' ? 1400 - 200 * b.k : 1200 + (sec === 'B' ? 2600 : 1600) * sw, t, 0.9);
        }
        const dens = sec === 'I' || sec === 'C' ? 2 : 1;
        if (i % dens === 0 && !(sec === 'O' && S.r(i, 2) < b.k / 4)) {
          const notes = S.arpNotes(ci, ch);
          const m = notes[S.song.arp[((i / dens) | 0) % S.song.arp.length] % notes.length];
          const acc = s % 4 === 0 ? 1 : s % 2 === 0 ? 0.72 : 0.55;
          S.pluck(t, m, acc * (0.85 + 0.15 * S.r(i, 3)) * (sec === 'I' ? 0.7 : 1), sec === 'C' ? 0.24 : 0.14);
        }
        if (sec === 'B') {
          if (s === 0 || s === 8) S.kick(t, 0.4);
          if ((s & 3) === 2) S.hat(t, 0.3 * (0.7 + 0.3 * S.r(i, 5)));
        }
        if (sec === 'C') { const n = S.mel(i, 'C'); if (n) S.lead(t, n.m, n.l * S.sd, n.v * 0.7); }
      },
      art(g, N, r) {
        const c = N / 2;
        const bg = g.createRadialGradient(c * (0.75 + r() * 0.5), c * (0.75 + r() * 0.5), 0, c, c, c * 1.05);
        bg.addColorStop(0, '#2C3290'); bg.addColorStop(0.55, '#141748'); bg.addColorStop(1, '#06071A');
        g.fillStyle = bg; g.fillRect(0, 0, N, N);
        g.lineWidth = 1.2;
        for (let k = 1; k <= 16; k++) {
          g.strokeStyle = `rgba(120,160,255,${k % 4 === 0 ? 0.2 : 0.07})`;
          g.beginPath(); g.arc(c, c, (k / 16) * c, 0, TAU); g.stroke();
        }
        g.strokeStyle = 'rgba(110,140,255,.08)';
        for (let k = 0; k < 36; k++) {
          const a = (k / 36) * TAU;
          g.beginPath(); g.moveTo(c + Math.sin(a) * c * 0.3, c - Math.cos(a) * c * 0.3); g.lineTo(c + Math.sin(a) * c, c - Math.cos(a) * c); g.stroke();
        }
        const pts = [];
        for (let k = 0; k < 16; k++) { const a = r() * TAU, rr = c * (0.4 + r() * 0.52); pts.push([c + Math.sin(a) * rr, c - Math.cos(a) * rr]); }
        g.strokeStyle = 'rgba(70,230,255,.38)'; g.lineWidth = 1.8;
        pts.forEach((p, k) => {
          let best = null, bd = 1e9;
          pts.forEach((q, j) => { if (j === k) return; const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < bd) { bd = d; best = q; } });
          g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(best[0], best[1]); g.stroke();
        });
        pts.forEach((p) => {
          const s = 3 + r() * 5;
          const gg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], s * 4);
          gg.addColorStop(0, 'rgba(170,245,255,.95)'); gg.addColorStop(0.25, 'rgba(110,150,255,.45)'); gg.addColorStop(1, 'rgba(110,150,255,0)');
          g.fillStyle = gg; g.beginPath(); g.arc(p[0], p[1], s * 4, 0, TAU); g.fill();
        });
        const a0 = r() * TAU;
        g.lineCap = 'round';
        for (const [w, al] of [[18, 0.14], [6, 0.95]]) { g.strokeStyle = `rgba(124,131,255,${al})`; g.lineWidth = w; g.beginPath(); g.arc(c, c, c * 0.74, a0, a0 + 1.4); g.stroke(); }
        g.strokeStyle = 'rgba(70,230,255,.85)'; g.lineWidth = 3.5; g.beginPath(); g.arc(c, c, c * 0.87, a0 + 2.5, a0 + 3.4); g.stroke();
      },
    },
    {
      id: 'regen', name: 'Regenzimmer', c1: '#64C8FF', c2: '#A9B8FF',
      titles: ['Tropfen am Glas', 'Graue Stunde', 'Leise Pfützen', 'Dachrinne', 'Nasser Asphalt', 'Regenschirmklavier', 'Fensterbank', 'Wolkendecke', 'Tee und Gewitter', 'Nebelweg', 'Nach dem Regen', 'Murmelnde Rinnen'],
      compose: (r) => ({ bpm: 62 + Math.floor(r() * 8), swing: 0.06, key: 53 + pick(r, [0, 2, -3, -7]), prog: pick(r, PROG.regen), mel: 0.2 + r() * 0.08, scale: PENTA, melOct: 12 }),
      buses: { piano: { lp: 6000, rev: 0.42, dly: 0.06, gain: 3.4 }, rain: { lp: 7000, gain: 0.35 }, drops: { rev: 0.3, gain: 2.5 }, amb: { rev: 0.2 } },
      setup(S, t) {
        const ac = S.ac;
        const src = S.loop(S.G.pink, t);
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 2.5);
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(S.bus('rain').in);
        const src2 = S.loop(S.G.white, t);
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.5;
        const g2 = ac.createGain(); g2.gain.value = 0.025;
        src2.connect(bp); bp.connect(g2); g2.connect(S.bus('rain').in);
        S.nodes.push(hp, lp, g, bp, g2);
        S.rainG = g; S.rainLP = lp;
      },
      step(S, i, t) {
        const b = S.bar(i), sec = b.name, s = i & 15, s32 = i & 31, ci = i >> 5, bi = i >> 4;
        const ch = S.chord(ci);
        if (s === 0 && S.rainG) {
          const gust = (U.noise(bi * 0.37, S.seed % 97) + 1) / 2;
          S.rainG.gain.setTargetAtTime((sec === 'C' ? 1.15 : sec === 'I' || sec === 'O' ? 0.8 : 0.9) + 0.35 * gust, t, 1.4);
          S.rainLP.frequency.setTargetAtTime(3600 + 2400 * gust, t, 1.6);
        }
        if (S.r(i, 1) < (sec === 'C' ? 0.34 : 0.22)) S.drop(t + S.r(i, 2) * S.sd * 0.8, 1700 + S.r(i, 3) * 2800, 0.35 + 0.65 * S.r(i, 4), S.r(i, 5) * 1.6 - 0.8);
        if ((s32 === 0 || S.isStart(i)) && (sec !== 'I' || b.k >= 2)) {
          const r0 = S.root(ch, 38);
          [r0, r0 + 7, r0 + Q[ch[1]][1] + 12].forEach((m, k) => S.piano(t + k * 0.09, m, (0.42 - k * 0.06) * (sec === 'O' ? 0.8 : 1), (32 - s32) * S.sd));
        }
        if (sec === 'A' || sec === 'B') { const n = S.mel(i, sec); if (n) S.piano(t, n.m, n.v * 0.62, n.l * S.sd + 0.6); }
        else if (s === 8 && S.r(bi, 6) < 0.5) S.piano(t, S.deg(Math.floor(S.r(bi, 7) * 8)), 0.4, 2.5);
        if (sec === 'C' && b.k === 0 && s === 4) S.rumble(t, 0.9);
      },
      art(g, N, r) {
        const bg = g.createLinearGradient(0, 0, N, N);
        bg.addColorStop(0, '#0D1B2E'); bg.addColorStop(0.5, '#1D3A57'); bg.addColorStop(1, '#3D6585');
        g.fillStyle = bg; g.fillRect(0, 0, N, N);
        const cols = ['100,210,255', '255,190,120', '160,180,255', '255,140,170'];
        for (let k = 0; k < 34; k++) {
          const x = r() * N, y = r() * N, s = N * (0.03 + r() * 0.09), c = cols[(r() * cols.length) | 0];
          const gg = g.createRadialGradient(x, y, 0, x, y, s);
          gg.addColorStop(0, `rgba(${c},${(0.18 + r() * 0.28).toFixed(2)})`); gg.addColorStop(0.7, `rgba(${c},.06)`); gg.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = gg; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
        }
        g.lineCap = 'round';
        for (let k = 0; k < 120; k++) {
          const x = r() * N * 1.2 - N * 0.1, y = r() * N, l = N * (0.03 + r() * 0.1);
          g.strokeStyle = `rgba(200,230,255,${(0.06 + r() * 0.2).toFixed(2)})`; g.lineWidth = 0.8 + r() * 1.4;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - l * 0.18, y + l); g.stroke();
        }
        for (let k = 0; k < 26; k++) {
          const x = r() * N, y = r() * N, s = 3 + r() * 9;
          const gg = g.createRadialGradient(x - s * 0.3, y - s * 0.35, s * 0.1, x, y, s);
          gg.addColorStop(0, 'rgba(255,255,255,.55)'); gg.addColorStop(0.5, 'rgba(180,220,255,.12)'); gg.addColorStop(1, 'rgba(10,30,50,.35)');
          g.fillStyle = gg; g.beginPath(); g.ellipse(x, y, s * 0.85, s, 0, 0, TAU); g.fill();
        }
      },
    },
    {
      id: 'abend', name: 'Abendglühen', c1: '#FF5E7A', c2: '#FFB86B',
      titles: ['Goldene Stunde', 'Lange Schatten', 'Pfirsichhimmel', 'Balkonlicht', 'Letzte Fähre', 'Warmer Asphalt', 'Dämmerung', 'Sommerabend', 'Glühwürmchen', 'Über den Dächern', 'Rosé und Ruhe', 'Laternen gehen an'],
      compose: (r) => ({ bpm: 86 + Math.floor(r() * 8), swing: 0.1, key: 49 + pick(r, [0, 3, 7, -2]), prog: pick(r, PROG.abend), mel: 0.24 + r() * 0.1, scale: PENTA, melOct: 12 }),
      buses: {
        pad: { lp: 1500, lq: 0.5, rev: 0.4 }, bass: { lp: 420 }, drums: { lp: 2600 },
        shaker: { bp: 6800, bq: 1.1, gain: 0.9 }, snare: { bp: 2200, bq: 0.7, rev: 0.25 },
        lead: { lp: 3800, rev: 0.4, dly: 0.42 }, amb: { rev: 0.4 },
      },
      step(S, i, t) {
        const b = S.bar(i), sec = b.name, s = i & 15, bi = i >> 4;
        const ch = S.chord(bi);
        const groove = sec === 'A' || sec === 'B';
        if (s === 0) {
          const pv = sec === 'I' ? 0.55 + 0.1 * b.k : sec === 'O' ? 0.8 - 0.12 * b.k : sec === 'C' ? 0.75 : 0.9;
          S.voice(ch, 53, 70).forEach((m) => S.pad(t, m, 16 * S.sd + 0.05, pv, 0.35, 1.1));
        }
        if (groove && (s & 3) === 0) S.pump('pad', t, 0.55);
        if (groove || (sec === 'O' && b.k < 2)) {
          if (s === 0 || s === 8) S.kick(t, s === 0 ? 0.9 : 0.75);
          if (sec === 'B' && s === 11) S.kick(t, 0.4);
          S.shaker(t, [0.35, 0.55, 1, 0.55][s & 3] * (0.8 + 0.2 * S.r(i, 2)) * (sec === 'O' ? 0.6 : 1));
          if (sec === 'B' && (s === 4 || s === 12)) S.snare(t, 0.45);
          const rt = S.root(ch, 36);
          if (sec !== 'B') { if (s === 0 || s === 8) S.bass(t, rt, S.sd * 6.5, 0.9); }
          else if (!(s & 1)) S.bass(t, rt + ((s >> 1) & 1 ? 12 : 0), S.sd * 1.6, 0.8);
        }
        if (sec === 'B' || sec === 'C') { const n = S.mel(i, sec); if (n) S.lead(t, n.m, n.l * S.sd, n.v * 0.8); }
        if ((sec === 'I' || sec === 'O' || sec === 'C') && S.r(i, 9) < 0.05) S.crickets(t, 0.6 + 0.4 * S.r(i, 8));
      },
      art(g, N, r) {
        const sky = g.createLinearGradient(0, 0, 0, N);
        sky.addColorStop(0, '#1E0B33'); sky.addColorStop(0.35, '#6A1D5C'); sky.addColorStop(0.62, '#F0566B'); sky.addColorStop(0.8, '#FFA563'); sky.addColorStop(1, '#FFD27A');
        g.fillStyle = sky; g.fillRect(0, 0, N, N);
        const sx = N * (0.4 + r() * 0.2), sy = N * 0.64, sr = N * 0.2;
        const halo = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
        halo.addColorStop(0, 'rgba(255,215,150,.6)'); halo.addColorStop(1, 'rgba(255,215,150,0)');
        g.fillStyle = halo; g.fillRect(0, 0, N, N);
        g.fillStyle = 'rgba(255,238,195,.96)'; g.beginPath(); g.arc(sx, sy, sr * 0.6, 0, TAU); g.fill();
        ['#E04A6A', '#B5325F', '#7E2352', '#4C1640', '#2A0D2C'].forEach((c, k) => {
          const base = N * (0.64 + k * 0.075), amp = N * (0.025 + r() * 0.03), ph = r() * TAU, fr = 0.8 + r() * 1.5;
          g.fillStyle = c; g.beginPath(); g.moveTo(0, N);
          for (let x = 0; x <= N; x += 8) g.lineTo(x, base + amp * Math.sin(ph + (x / N) * fr * TAU));
          g.lineTo(N, N); g.closePath(); g.fill();
        });
        g.strokeStyle = 'rgba(40,10,40,.55)'; g.lineWidth = 2.4; g.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const x = N * (0.3 + r() * 0.4), y = N * (0.26 + r() * 0.2), s = 7 + r() * 7;
          g.beginPath(); g.moveTo(x - s, y - s * 0.4); g.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y); g.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y - s * 0.4); g.stroke();
        }
      },
    },
    {
      id: 'meer', name: 'Meeresrauschen', c1: '#2EE6C8', c2: '#3A8DFF',
      titles: ['Ebbe', 'Salzluft', 'Dünenwind', 'Brandung bei Nacht', 'Leuchtturm', 'Gezeiten', 'Muschelsammler', 'Weiter Horizont', 'Flut', 'Strandgut', 'Seegang', 'Treibholz'],
      compose: (r) => ({ bpm: 60, swing: 0, key: 50 + pick(r, [0, 2, -2, 5]), prog: pick(r, PROG.meer), mel: 0.1, scale: PENTA, melOct: 24, padWave: 'soft', wave0: 32 + Math.floor(r() * 10) }),
      buses: { sea: { rev: 0.08, gain: 1.6 }, pad: { lp: 900, lq: 0.3, rev: 0.55, gain: 1.3 }, chime: { rev: 0.7, dly: 0.25, gain: 1.2 }, amb: { rev: 0.3 } },
      setup(S, t) {
        const ac = S.ac;
        const src = S.loop(S.G.pink, t);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.3;
        const g = ac.createGain(); g.gain.value = 0.15;
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
        const fg = ac.createGain(); fg.gain.value = 0;
        const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
        src.connect(lp); lp.connect(g); src.connect(hp); hp.connect(fg);
        const out = S.bus('sea').in;
        if (pan) { g.connect(pan); fg.connect(pan); pan.connect(out); } else { g.connect(out); fg.connect(out); }
        S.nodes.push(lp, g, hp, fg);
        if (pan) S.nodes.push(pan);
        S.sea = { lp, g, fg, pan };
      },
      step(S, i, t) {
        const b = S.bar(i), sec = b.name, s = i & 15, c64 = i & 63, ci = i >> 6;
        const ch = S.chord(ci);
        if (S.waveAt === undefined || i >= S.waveAt) {
          const L = S.song.wave0 + Math.floor(S.r(i, 1) * 14) - 4;
          S.wave(t, L * S.sd, (0.55 + 0.45 * S.r(i, 2)) * (sec === 'I' || sec === 'O' ? 0.7 : sec === 'B' ? 1 : 0.88));
          S.waveAt = i + L;
        }
        if (c64 === 0 || S.isStart(i)) {
          const left = (64 - c64) * S.sd;
          S.pad(t, S.root(ch, 38), left + 3, 0.8, 3.5, 4);
          S.voice(ch, 55, 70).slice(0, 3).forEach((m) => S.pad(t + 0.3, m, left + 3, sec === 'I' ? 0.4 : 0.55, 4, 4.5));
        }
        if ((sec === 'A' || sec === 'B') && !(s & 1) && S.r(i, 3) < (sec === 'B' ? 0.08 : 0.05)) S.chime(t, S.deg(Math.floor(S.r(i, 4) * 10)), 0.5 + 0.5 * S.r(i, 5));
        if (sec === 'C' && b.k === 1 && s === 0) { const m = S.deg(4); S.glide(t, m - 5, m + 2, 5, 0.8); }
      },
      art(g, N, r) {
        const bg = g.createLinearGradient(0, 0, 0, N);
        bg.addColorStop(0, '#020B1F'); bg.addColorStop(0.4, '#06304A'); bg.addColorStop(0.75, '#0B6475'); bg.addColorStop(1, '#2BB7A8');
        g.fillStyle = bg; g.fillRect(0, 0, N, N);
        const mx = N * (0.3 + r() * 0.4), my = N * (0.17 + r() * 0.1);
        const halo = g.createRadialGradient(mx, my, 0, mx, my, N * 0.14);
        halo.addColorStop(0, 'rgba(200,255,250,.4)'); halo.addColorStop(1, 'rgba(200,255,250,0)');
        g.fillStyle = halo; g.fillRect(0, 0, N, N);
        g.fillStyle = '#E8FFF9'; g.beginPath(); g.arc(mx, my, N * 0.03, 0, TAU); g.fill();
        g.lineCap = 'round';
        for (let k = 0; k < 30; k++) {
          const y0 = N * (0.38 + k * 0.021), amp = N * (0.006 + r() * 0.02 + k * 0.0006), fr = 1.5 + r() * 3, ph = r() * TAU;
          g.strokeStyle = `rgba(${k % 3 ? '120,240,230' : '220,255,250'},${(0.1 + r() * 0.3).toFixed(2)})`; g.lineWidth = 1 + r() * 2.2;
          g.beginPath();
          for (let x = -10; x <= N + 10; x += 6) {
            const y = y0 + amp * Math.sin(ph + (x / N) * fr * TAU) + amp * 0.4 * Math.sin(ph * 2 + (x / N) * fr * 2.3 * TAU);
            if (x === -10) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
        for (let k = 0; k < 40; k++) {
          g.fillStyle = `rgba(230,255,250,${(0.2 + r() * 0.4).toFixed(2)})`;
          g.fillRect(mx + (r() - 0.5) * N * 0.2, N * (0.42 + r() * 0.3), 4 + r() * 16, 1.6);
        }
      },
    },
  ];
  const byId = (id) => STATIONS.find((s) => s.id === id) || null;

  /* ========================================================= Komposition */
  const songCache = new Map();
  function songOf(st, track) {
    const key = st.id + ':' + track;
    let s = songCache.get(key);
    if (s) return s;
    const seed = U.hash('visto-musik:' + key);
    const r = U.rng(seed);
    const p = st.compose(r);
    const sd = 60 / p.bpm / 4;
    const nBars = Math.max(20, Math.round((150 + r() * 75) / (16 * sd)));
    const bars = form(nBars);
    const off = U.hash(st.id) % st.titles.length;
    s = Object.assign(p, {
      seed, sd, nBars, bars, total: nBars * 16, dur: nBars * 16 * sd, track,
      title: st.titles[(off + track * 5) % st.titles.length],
      mot: { A: motif(seed, 1, p.mel), B: motif(seed, 2, p.mel * 1.3), C: motif(seed, 3, p.mel * 0.8) },
      marks: bars.map((b, k) => (b.k === 0 && k > 0 ? k / nBars : -1)).filter((f) => f > 0),
    });
    if (songCache.size > 40) songCache.clear();
    songCache.set(key, s);
    return s;
  }

  /* ============================================================ Abspieler */
  const E = { G: null, ev: [], visOn: false };
  let D = null;                         // gespeicherter Zustand
  const M = { stIdx: 0, playing: false, started: false, session: null };
  let schedT = 0, swT = 0, lastSave = 0;

  function data() {
    if (!D) {
      D = V.store.app('music', { station: 'lofi', st: {} });
      M.stIdx = Math.max(0, STATIONS.findIndex((s) => s.id === D.station));
    }
    return D;
  }
  function rec(id) { const d = data(); if (!d.st[id] || typeof d.st[id] !== 'object') d.st[id] = { track: 0, step: 0 }; return d.st[id]; }
  const cur = () => { data(); return STATIONS[M.stIdx]; };
  const curSong = () => songOf(cur(), rec(cur().id).track);

  function ensureGraph() {
    let ac = null;
    try { ac = V.sound.ctx(); } catch (e) { ac = null; }
    if (!ac) return null;
    if (E.G && E.G.ac === ac) return E.G;
    try { E.G = buildGraph(ac, V.sound.out()); } catch (e) { console.error('[Musik] Klangweg', e); E.G = null; }
    return E.G;
  }

  function emit(o) { V.emit('music:changed', Object.assign({ playing: M.playing, station: cur().id }, o)); }

  function retire(s, dur, at) {
    if (!s) return;
    if (!s.ac) { s.dispose(); return; }
    const now = s.ac.currentTime, t = Math.max(now, at || now);
    s.fade(0, t, dur);
    setTimeout(() => s.dispose(), (t - now + dur + 0.4) * 1000);
  }

  /** Sitzung (neu) beginnen: aktueller Sender, gespeicherter Titel und Takt, mit Überblendung */
  function begin(xf) {
    const st = cur(), r = rec(st.id);
    const G = ensureGraph();
    const audio = !!(G && G.ac.state === 'running');
    const now = audio ? G.ac.currentTime : performance.now() / 1000;
    const when = now + 0.06;
    const song = songOf(st, r.track);
    r.step = U.clamp(Math.floor(r.step / 16) * 16, 0, song.total - 16);
    const old = M.session;
    const s = new Session(audio ? G : null, st, r.track, r.step, when);
    s.visual = true;
    if (s.ac) { s.fade(1, when, xf); G.dly.delayTime.setTargetAtTime(s.sd * 3, now, 0.05); }
    E.ev.length = 0;
    M.session = s;
    if (old) retire(old, Math.max(0.25, xf));
    if (!schedT) schedT = setInterval(tick, 45);
    tick();
  }

  function tick() {
    const s = M.session;
    if (!s || !M.playing) return;
    if (!s.ac && E.G && E.G.ac.state === 'running') { saveStep(); begin(0.5); return; }   // Ton wurde freigegeben
    const now = s.now();
    if (s.nextTime < now - 0.5) {     // nach langem Schlaf: Lücke überspringen statt nachholen
      const miss = Math.floor((now - s.nextTime) / s.sd);
      s.step += miss; s.nextTime += miss * s.sd;
    }
    const ahead = document.hidden ? 1.6 : 0.3;
    let guard = 0;
    while (s.nextTime < now + ahead && guard++ < 400) {
      if (s.step >= s.song.total) { autoNext(s); return; }
      let t = s.nextTime;
      if (s.step & 1) t += s.song.swing * s.sd;
      try { s.st.step(s, s.step, Math.max(t, now)); } catch (e) { console.error('[Musik]', e); }
      s.step++;
      s.nextTime += s.sd;
    }
    const ms = performance.now();
    if (ms - lastSave > 4000) { lastSave = ms; saveStep(); }
  }

  /** Titel zu Ende: nahtlos den nächsten komponieren */
  function autoNext(s) {
    const st = s.st, r = rec(st.id);
    r.track += 1; r.step = 0;
    const ns = new Session(s.ac ? s.G : null, st, r.track, 0, s.nextTime);
    ns.visual = true;
    if (ns.ac) { ns.fade(1, s.nextTime, 0.05); s.G.dly.delayTime.setTargetAtTime(ns.sd * 3, s.nextTime, 0.3); }
    retire(s, 3.5, s.nextTime);
    M.session = ns;
    V.store.save();
    emit({ why: 'track', dir: 1, auto: true });
  }

  function saveStep() {
    const s = M.session;
    if (!s) return;
    const r = rec(s.st.id);
    if (r.track === s.track) r.step = Math.floor(s.posSteps() / 16) * 16;
    V.store.save();
  }

  function position() {
    const st = cur(), r = rec(st.id), song = songOf(st, r.track);
    const s = M.session;
    const step = s && M.playing && s.st === st && s.track === r.track ? s.posSteps() : r.step;
    const k = U.clamp(step / song.total, 0, 1);
    return { sec: step * song.sd, dur: song.dur, frac: k, bar: song.bars[Math.min(song.bars.length - 1, Math.floor(step / 16))], song };
  }

  async function play(stId) {
    data();
    let changed = false;
    if (stId) {
      const i = STATIONS.findIndex((s) => s.id === stId);
      if (i >= 0 && i !== M.stIdx) { saveStep(); const dir = U.wrap(i - M.stIdx, STATIONS.length) <= 2 ? 1 : -1; M.stIdx = i; D.station = STATIONS[i].id; changed = true; emit({ why: 'station', dir }); }
    }
    if (M.playing && !changed) return;
    const wasPlaying = M.playing;
    M.playing = true; M.started = true;
    if (!wasPlaying) emit({ why: 'play' });
    V.store.save();
    const G = ensureGraph();
    if (G && G.ac.state !== 'running') { try { await Promise.race([G.ac.resume(), U.sleep(350)]); } catch (e) { /* stumm weiter */ } }
    if (!M.playing) return;
    begin(changed && wasPlaying ? 0.8 : 0.6);
  }
  function pause() {
    if (!M.playing) return;
    saveStep();
    M.playing = false;
    clearTimeout(swT);
    const s = M.session; M.session = null;
    retire(s, 0.45);
    clearInterval(schedT); schedT = 0;
    emit({ why: 'pause' });
  }
  function toggle() { if (M.playing) pause(); else play(); }
  function skip(dir) {
    const st = cur(), r = rec(st.id);
    if (dir < 0 && (position().sec > 6 || r.track === 0)) r.step = 0;
    else { r.track = Math.max(0, r.track + dir); r.step = 0; }
    V.store.save();
    emit({ why: 'track', dir });
    if (M.playing) begin(0.35);
  }
  function station(idx, dir) {
    data();
    saveStep();
    M.stIdx = U.wrap(idx, STATIONS.length);
    D.station = cur().id;
    V.store.save();
    emit({ why: 'station', dir: dir || 1 });
    if (M.playing) { clearTimeout(swT); swT = setTimeout(() => { if (M.playing) begin(0.8); }, 240); }
  }
  function seek(f) {
    const song = curSong(), r = rec(cur().id);
    r.step = U.clamp(Math.floor(f * song.nBars), 0, song.nBars - 1) * 16;
    V.store.save();
    emit({ why: 'seek' });
    if (M.playing) begin(0.3);
  }
  function info() {
    const st = cur(), p = position();
    return { title: p.song.title, artist: st.name, station: st.id, playing: M.playing, color: st.c1, progress: p.frac, position: p.sec, duration: p.dur };
  }
  function duck(v) {
    const G = E.G;
    if (!G) return;
    const t = G.ac.currentTime;
    G.duck.gain.cancelScheduledValues(t);
    G.duck.gain.setTargetAtTime(v, t, v < 1 ? 0.15 : 0.5);
  }

  /** nur für Tests: einen Sender offline rendern und den Pegel messen */
  async function render(stId, sec, track, step, solo) {
    const st = byId(stId) || STATIONS[0];
    sec = sec || 8;
    const sr = 44100, oac = new OfflineAudioContext(2, Math.ceil(sr * sec), sr);
    const G = buildGraph(oac, oac.destination);
    SP.solo = solo || null;
    const s = new Session(G, st, track || 0, step || 0, 0.05);
    s.fade(1, 0.05, 0.01);
    while (s.nextTime < sec && s.step < s.song.total) {
      let t = s.nextTime;
      if (s.step & 1) t += s.song.swing * s.sd;
      st.step(s, s.step, t);
      s.step++; s.nextTime += s.sd;
    }
    SP.solo = null;
    const buf = await oac.startRendering();
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; n++; }
    }
    const rms = Math.sqrt(sum / n);
    return { station: st.id, section: s.bar(s.step - 1).name, peak: +peak.toFixed(3), rms: +rms.toFixed(4), db: +(20 * Math.log10(rms || 1e-9)).toFixed(1) };
  }

  /* ========================================================== Cover-Kunst */
  const artCache = new Map();
  function drawArt(st, track) {
    const N = 640;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const r = U.rng(U.hash('cover:' + st.id + ':' + track));
    try { st.art(g, N, r); } catch (e) { console.error('[Musik] Cover', e); }
    // Körnung
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)';
      g.fillRect(r() * N, r() * N, 1.5, 1.5);
    }
    return c;
  }
  function artFor(st, track) {
    const key = st.id + ':' + track;
    let c = artCache.get(key);
    if (!c) {
      c = drawArt(st, track);
      artCache.set(key, c);
      if (artCache.size > 10) artCache.delete(artCache.keys().next().value);
    }
    if (c.isConnected) {
      const d = document.createElement('canvas');
      d.width = c.width; d.height = c.height;
      d.getContext('2d').drawImage(c, 0, 0);
      return d;
    }
    return c;
  }

  /* ========================================================== Oberfläche */
  const CSS = `
    .mu-root { position: absolute; inset: 0; overflow: hidden; background: #000; }
    .mu-viz { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .mu-stage { position: absolute; inset: 0; pointer-events: none; }
    .mu-disc { position: absolute; left: 21cqw; top: 21cqw; width: 58cqw; height: 58cqw; border-radius: 50%;
      will-change: transform; transform-origin: 50% 50%; transition: filter .9s ease;
      box-shadow: 0 0 0 .22cqw rgba(255,255,255,.08), 0 2.4cqw 7cqw rgba(0,0,0,.75); }
    .mu-disc.paused { filter: saturate(.72) brightness(.66); }
    .mu-root.scrubbing .mu-disc { filter: saturate(.6) brightness(.32); transition-duration: .3s; }
    .mu-spin { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; will-change: transform; }
    .mu-spin canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .mu-groove { position: absolute; inset: 0; border-radius: 50%;
      background:
        radial-gradient(circle closest-side, rgba(0,0,0,0) 0 40%, rgba(0,0,0,.3) 100%),
        repeating-radial-gradient(circle closest-side, rgba(255,255,255,0) 0 .3cqw, rgba(0,0,0,.14) .36cqw .44cqw); }
    .mu-sheen { position: absolute; inset: 0; border-radius: 50%; mix-blend-mode: screen; opacity: .85;
      background: conic-gradient(from -24deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,.17) 22deg, rgba(255,255,255,0) 50deg,
        rgba(255,255,255,0) 180deg, rgba(255,255,255,.12) 206deg, rgba(255,255,255,0) 234deg);
      -webkit-mask: radial-gradient(circle closest-side, transparent 0 37%, #000 43% 100%); mask: radial-gradient(circle closest-side, transparent 0 37%, #000 43% 100%); }
    .mu-hub { position: absolute; left: 50%; top: 50%; width: 24.5cqw; height: 24.5cqw; margin: -12.25cqw 0 0 -12.25cqw; border-radius: 50%;
      background: radial-gradient(circle closest-side, rgba(0,0,0,.5) 0 80%, rgba(255,255,255,.2) 83%, rgba(0,0,0,.35) 88%, rgba(0,0,0,0) 100%); }
    .mu-arc { transform-origin: 50% 50%; will-change: transform, opacity; pointer-events: none; }
    .mu-time text { font-variant-numeric: tabular-nums; }
    .mu-btn { position: absolute; padding: 0; margin: 0; border: 0; border-radius: 50%; display: block; color: #fff; cursor: pointer; z-index: 4;
      background: rgba(14,14,18,.46); -webkit-backdrop-filter: blur(1.4cqw) saturate(1.4); backdrop-filter: blur(1.4cqw) saturate(1.4);
      box-shadow: inset 0 0 0 .22cqw rgba(255,255,255,.17), 0 1.2cqw 4cqw rgba(0,0,0,.4);
      transition: transform .32s var(--spring), opacity .3s ease, background .2s; }
    .mu-btn:active { transform: scale(.88); background: rgba(40,40,46,.6); }
    .mu-play { left: 40.5cqw; top: 40.5cqw; width: 19cqw; height: 19cqw; }
    .mu-prev, .mu-next { top: 43.6cqw; width: 12.8cqw; height: 12.8cqw; }
    .mu-prev { left: 25.8cqw; } .mu-next { left: 61.4cqw; }
    .mu-ic { position: absolute; inset: 0; display: grid; place-items: center; transition: opacity .25s ease, transform .5s var(--spring); }
    .mu-play svg { width: 8.2cqw; height: 8.2cqw; }
    .mu-play .mu-ic-play svg { transform: translateX(.45cqw); }
    .mu-prev svg, .mu-next svg { width: 4.6cqw; height: 4.6cqw; }
    .mu-play .mu-ic-pause { opacity: 0; transform: scale(.4) rotate(-90deg); }
    .mu-play.on .mu-ic-play { opacity: 0; transform: scale(.4) rotate(90deg); }
    .mu-play.on .mu-ic-pause { opacity: 1; transform: none; }
    .mu-root.scrubbing .mu-btn { opacity: 0; pointer-events: none; transform: scale(.8); }
    .mu-scrub { position: absolute; left: 50%; top: 50%; z-index: 5; text-align: center; pointer-events: none; opacity: 0;
      transform: translate(-50%, -50%) scale(.86); transition: opacity .25s ease, transform .45s var(--spring); }
    .mu-scrub.on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .mu-scrub b { display: block; font-size: 13cqw; font-weight: 220; letter-spacing: -.045em; line-height: 1; font-variant-numeric: tabular-nums; }
    .mu-scrub span { display: block; margin-top: 1.8cqw; }
  `;

  /** Text am Bogen, der beim Wechsel entlang des Bogens hinaus- bzw. hereindreht */
  function arcSwap(parent, o) {
    let cur = null;
    return {
      set(text, color, dir) {
        if (cur && cur.text === text && cur.color === color) return;
        const a = V.ui.arcText(Object.assign({}, o, { text, color }));
        a.el.classList.add('mu-arc');
        if (o.cls) a.el.classList.add(o.cls);
        parent.appendChild(a.el);
        a.text = text; a.color = color;
        const old = cur; cur = a;
        if (!old) return;
        if (!dir) { old.el.remove(); return; }
        const side = o.side === 'bottom' ? -1 : 1, deg = o.swing || 16;
        a.el.style.opacity = '0';
        const sp = V.spring(0, { response: 0.6, bounce: 0.1 });
        sp.onUpdate((t) => {
          old.el.style.transform = `rotate(${(-dir * side * deg * t).toFixed(2)}deg)`;
          old.el.style.opacity = U.clamp(1 - t * 1.5, 0, 1).toFixed(3);
          a.el.style.transform = `rotate(${(dir * side * deg * (1 - t)).toFixed(2)}deg)`;
          a.el.style.opacity = U.clamp(t * 1.3, 0, 1).toFixed(3);
        });
        sp.to(1).then(() => old.el.remove());
      },
    };
  }

  let hinted = false;

  function createUI(ctx) {
    V.css('music', CSS);
    data();
    E.visOn = true; E.ev.length = 0;
    ctx.cleanup(() => { E.visOn = false; E.ev.length = 0; });
    const root = ctx.root;
    root.classList.add('mu-root');
    root.setAttribute('data-nogesture', 'all');

    /* ---------- Aufbau */
    const cv = U.el('canvas', { class: 'mu-viz', attrs: { 'aria-hidden': 'true' } });
    const g = cv.getContext('2d');
    const stage = U.el('div', { class: 'mu-stage' });
    const arcs = U.el('div', { class: 'vos-fill', style: { pointerEvents: 'none' } });
    const scrubTime = U.el('b', { text: '0:00' });
    const scrubSec = U.el('span', { class: 'vos-label' });
    const scrubEl = U.el('div', { class: 'mu-scrub' }, scrubTime, scrubSec);
    const mkBtn = (cls, label, html) => U.el('button', { class: 'mu-btn ' + cls, attrs: { type: 'button', 'aria-label': label }, html });
    const btnPlay = mkBtn('mu-play', 'Wiedergabe', `<span class="mu-ic mu-ic-play">${V.icon('play')}</span><span class="mu-ic mu-ic-pause">${V.icon('pause')}</span>`);
    const btnPrev = mkBtn('mu-prev', 'Zurück', `<span class="mu-ic">${V.icon('prev')}</span>`);
    const btnNext = mkBtn('mu-next', 'Weiter', `<span class="mu-ic">${V.icon('next')}</span>`);
    root.append(cv, stage, arcs, scrubEl, btnPrev, btnPlay, btnNext);

    const stLabel = arcSwap(arcs, { r: 452, size: 23, weight: 700, spacing: 4.6, swing: 20 });
    const titleArc = arcSwap(arcs, { r: 405, size: 40, weight: 620, spacing: 0.3, upper: false, swing: 16 });
    const tEl = V.ui.arcText({ text: '0:00', r: 440, side: 'bottom', at: 222, size: 24, weight: 600, spacing: 1, color: 'rgba(255,255,255,.5)' });
    const tRem = V.ui.arcText({ text: '-0:00', r: 440, side: 'bottom', at: 138, size: 24, weight: 600, spacing: 1, color: 'rgba(255,255,255,.5)' });
    tEl.el.classList.add('mu-time'); tRem.el.classList.add('mu-time');
    arcs.append(tEl.el, tRem.el);

    /* ---------- Farben */
    let c1 = cur().c1, c2 = cur().c2, colFrom = [c1, c2], colTo = [c1, c2], colT = 1;
    const NR = 64;
    let rayCols = [];
    function rebuildCols() { rayCols = []; for (let i = 0; i < NR; i++) rayCols.push(U.mix(c1, c2, i / (NR - 1))); }
    rebuildCols();
    function colorTo(st) { colFrom = [c1, c2]; colTo = [st.c1, st.c2]; colT = 0; }

    /* ---------- Scheiben */
    const W = 690;                            // Abstand zur Nachbarscheibe (logisch)
    function makeDisc(idx) {
      const st = STATIONS[idx], track = rec(st.id).track;
      const el = U.el('div', { class: 'mu-disc' + (M.playing ? '' : ' paused') });
      const spin = U.el('div', { class: 'mu-spin' });
      spin.appendChild(artFor(st, track));
      el.append(spin, U.el('div', { class: 'mu-groove' }), U.el('div', { class: 'mu-sheen' }), U.el('div', { class: 'mu-hub' }));
      stage.appendChild(el);
      return { el, spin, idx, track };
    }
    function setArt(d, st, track) {
      if (d.track === track) return;
      d.track = track;
      const nu = artFor(st, track);
      nu.style.opacity = '0';
      d.spin.appendChild(nu);
      const olds = Array.from(d.spin.children).filter((c) => c !== nu);
      V.tween({ duration: 0.9, ease: V.ease.inOutSine, onUpdate: (v) => { nu.style.opacity = v.toFixed(3); } }).promise.then(() => olds.forEach((o) => o.remove()));
    }
    let main = makeDisc(M.stIdx), side = null, discX = 0, sliding = false, pop = 0;
    function layout() {
      const sc = (x) => 1 - 0.16 * Math.min(1, Math.abs(x) / W);
      main.el.style.transform = `translateX(${(discX / 10).toFixed(2)}cqw) scale(${(sc(discX) * (1 + 0.016 * pop)).toFixed(4)})`;
      if (side) {
        const x = discX + side.dir * W;
        side.d.el.style.transform = `translateX(${(x / 10).toFixed(2)}cqw) scale(${sc(x).toFixed(4)})`;
      }
    }
    function ensureSide(dir) {
      if (side && side.dir === dir) return;
      if (side) side.d.el.remove();
      side = { dir, d: makeDisc(U.wrap(main.idx + dir, STATIONS.length)) };
    }
    function finishSlide() {
      if (side) { main.el.remove(); main = side.d; side = null; }
      discX = 0; layout();
      sliding = false;
      if (main.idx !== M.stIdx) slideTo(M.stIdx, 1);
    }
    /** Scheibe zur Nachbarstation gleiten lassen (Feder) */
    function slideTo(idx, dir, fromX) {
      if (sliding || idx === main.idx) return;
      const n = STATIONS.length;
      dir = U.wrap(idx - main.idx, n) === 1 ? 1 : U.wrap(main.idx - idx, n) === 1 ? -1 : dir || 1;
      sliding = true;
      if (!side || side.dir !== dir || side.d.idx !== idx) {
        if (side) side.d.el.remove();
        side = { dir, d: makeDisc(idx) };
      }
      const sp = V.spring(fromX !== undefined ? fromX : 0, { response: 0.55, bounce: 0.08 });
      sp.onUpdate((x) => { discX = x; layout(); });
      sp.to(-dir * W).then(finishSlide);
    }
    function springBack() {
      sliding = true;
      const sp = V.spring(discX, { response: 0.45, bounce: 0.15 });
      sp.onUpdate((x) => { discX = x; layout(); });
      sp.to(0).then(() => { if (side) { side.d.el.remove(); side = null; } sliding = false; if (main.idx !== M.stIdx) slideTo(M.stIdx, 1); });
    }

    /* ---------- Anzeige aktualisieren */
    function showTexts(dir) {
      const st = cur(), song = curSong();
      stLabel.set(st.name, st.c1, dir);
      titleArc.set(song.title, 'rgba(255,255,255,.93)', dir);
    }
    function showPlay() {
      btnPlay.classList.toggle('on', M.playing);
      btnPlay.setAttribute('aria-label', M.playing ? 'Pause' : 'Wiedergabe');
      for (const d of [main, side && side.d]) if (d) d.el.classList.toggle('paused', !M.playing);
    }
    showTexts(0);
    showPlay();

    ctx.on('music:changed', (ev) => {
      const st = cur();
      if (ev.why === 'station') {
        showTexts(ev.dir || 1);
        colorTo(st);
        if (!sliding && main.idx !== M.stIdx) slideTo(M.stIdx, ev.dir || 1);
      } else if (ev.why === 'track') {
        showTexts(ev.dir || 1);
        if (main.idx === M.stIdx) setArt(main, st, rec(st.id).track);
        if (ev.dir) w += ev.dir * 220;
      } else showTexts(0);
      showPlay();
    });

    /* ---------- Knöpfe */
    V.ui.tap(btnPlay, () => toggle());
    V.ui.tap(btnNext, () => skip(1));
    V.ui.tap(btnPrev, () => skip(-1));

    /* ---------- Gesten: Scheibe wischen · Rand drehen · Fortschrittskopf ziehen */
    let gm = null, dialBase = 0, scrub = null;
    function goStation(dir) {
      V.sound.play('tick'); V.haptic(6);
      station(M.stIdx + dir, dir);
    }
    function scrubAt(p) {
      const f = U.clamp((scrub.a0 + p.dA) / 360, 0, 0.9999);
      const song = scrub.song;
      const bar = Math.min(song.nBars - 1, Math.floor(f * song.nBars));
      const b = song.bars[bar];
      if (b.idx !== scrub.secIdx) { scrub.secIdx = b.idx; V.sound.play('tick'); V.haptic(4); }
      scrub.f = f;
      scrub.bar = bar;
      scrubTime.textContent = V.fmt.duration(bar * 16 * song.sd, { ceil: false });
      scrubSec.textContent = SECTION[b.name];
    }
    const gest = V.gesture(root, {
      start(p, e) {
        gm = null;
        if (e.target && e.target.closest && e.target.closest('button')) return;
        if (sliding) return;
        if (p.r0 >= 418) {
          const head = position().frac * 360;
          if (Math.abs(U.angDiff(head, p.a0)) < 28) {
            gm = 'scrub';
            const P = position();
            scrub = { a0: head + U.angDiff(head, p.a0), song: P.song, secIdx: P.bar.idx, f: P.frac, bar: 0 };
            scrubAt(p);
            root.classList.add('scrubbing');
            scrubEl.classList.add('on');
            V.haptic(6);
          } else { gm = 'dial'; dialBase = 0; }
        } else gm = 'disc';
      },
      move(p) {
        if (gm === 'scrub') scrubAt(p);
        else if (gm === 'dial') {
          while (p.dA - dialBase >= 46) { dialBase += 46; goStation(1); }
          while (p.dA - dialBase <= -46) { dialBase -= 46; goStation(-1); }
        } else if (gm === 'disc' && p.moved) {
          if (Math.abs(p.dx) > Math.abs(p.dy) * 1.1) gm = 'swipe'; else { gm = null; return; }
        }
        if (gm === 'swipe') {
          ensureSide(p.dx < 0 ? 1 : -1);
          discX = p.dx;
          layout();
        }
      },
      end(p) {
        if (gm === 'scrub') {
          root.classList.remove('scrubbing');
          scrubEl.classList.remove('on');
          if (!p.cancelled && scrub) { seek(scrub.f); V.sound.play('tap'); }
          scrub = null;
        } else if (gm === 'swipe') {
          const dir = discX < 0 ? 1 : -1;
          const fling = Math.abs(p.vx) > 650 && Math.sign(p.vx) === -dir;
          if (!p.cancelled && (Math.abs(discX) > 170 || fling)) {
            const target = U.wrap(main.idx + dir, STATIONS.length);
            ensureSide(dir);
            const x0 = discX;
            sliding = true;            // Ereignis von goStation soll nicht selbst animieren
            goStation(dir);
            sliding = false;
            slideTo(target, dir, x0);
          } else springBack();
        }
        gm = null;
      },
      tap(p, e) {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        if (p.r0 < RD - 10) toggle();
      },
    }, { slop: 8 });
    ctx.cleanup(() => gest.destroy());

    /* ---------- Zeichenfläche */
    let cw = 0;
    function size() {
      const dpr = Math.min(V.display.dpr || 1, 2);
      const px = Math.max(64, Math.round(V.display.size * dpr));
      if (px !== cw) { cw = px; cv.width = cv.height = px; }
    }
    size();
    ctx.on('display:resize', size);

    const shown = new Float32Array(NR), sim = new Float32Array(NR), an = new Float32Array(NR);
    const SIN = [], COS = [];
    for (let i = 0; i < NR; i++) { const a = U.rad(180 - (i + 0.5) * (180 / NR)); SIN.push(Math.sin(a)); COS.push(Math.cos(a)); }
    let fbuf = null, bassE = 0;
    const pulses = [], sparks = [];

    function bump(c, wdt, amp) {
      for (let j = Math.max(0, Math.floor(c - wdt * 2)); j < Math.min(NR, Math.ceil(c + wdt * 2)); j++) {
        const z = (j - c) / wdt;
        sim[j] = Math.min(1.15, sim[j] + amp * Math.exp(-z * z));
      }
    }
    const idxOf = (m) => U.clamp(Math.round(((m || 60) - 30) / 70 * NR), 0, NR - 1);
    function spark(m, v, big) {
      if (sparks.length > 48) return;
      const i = idxOf(m) + (Math.random() - 0.5) * 4;
      const a = (Math.random() < 0.5 ? 1 : -1) * (180 - (i + 0.5) * (180 / NR));
      sparks.push({ a, r: RD + 20, vr: 50 + Math.random() * 60 * (big ? 1.4 : 1), life: 0, max: 1.1 + Math.random() * 0.8, s: (big ? 5 : 3.2) * (0.6 + v * 0.6), col: Math.random() < 0.5 ? 0 : 1 });
    }
    function applyEv(ev) {
      switch (ev.k) {
        case 'kick': bump(1, 5, ev.v * 0.95); pop = Math.max(pop, ev.v); if (pulses.length < 6) pulses.push({ t: 0, v: ev.v, d: 0.85, w: 3 }); break;
        case 'bass': bump(3, 5, ev.v * 0.55); break;
        case 'snare': bump(30, 8, ev.v * 0.55); break;
        case 'hat': bump(52, 8, ev.v * 0.45); break;
        case 'drop': bump(idxOf(ev.m), 3, ev.v * 0.5); if (Math.random() < 0.6) spark(ev.m, ev.v * 0.6, false); break;
        case 'wave': bump(8, 18, ev.v * 0.6); if (pulses.length < 6) pulses.push({ t: 0, v: ev.v * 0.7, d: 3.4, w: 16 }); break;
        case 'pad': bump(idxOf(ev.m), 7, ev.v * 0.45); break;
        default:
          bump(idxOf(ev.m), 3, ev.v * 0.7);
          if (ev.k !== 'note' || Math.random() < 0.35) spark(ev.m, ev.v, ev.k === 'chime' || ev.k === 'piano');
      }
    }
    function readSpectrum(dt, T) {
      const s = M.session;
      let have = false;
      if (s && s.ac && E.G && E.G.an) {
        if (!fbuf) fbuf = new Uint8Array(E.G.an.frequencyBinCount);
        E.G.an.getByteFrequencyData(fbuf);
        have = true;
      }
      // fällige Ereignisse
      if (s) {
        const now = s.now();
        let n = 0;
        while (n < E.ev.length && E.ev[n].t <= now) { applyEv(E.ev[n]); n++; }
        if (n) E.ev.splice(0, n);
      }
      const dec = Math.exp(-dt * 3.2);
      let bass = 0;
      for (let i = 0; i < NR; i++) {
        sim[i] *= dec;
        let v = 0;
        if (have) {
          const lo = 2 * Math.pow(75, i / NR), hi = 2 * Math.pow(75, (i + 1) / NR);
          let acc = 0, c = 0;
          for (let j = Math.floor(lo); j <= Math.max(Math.floor(lo), Math.floor(hi) - 1); j++) { acc += fbuf[j]; c++; }
          v = Math.pow(acc / c / 255, 1.7) * (1 + (i / NR) * 0.9);
        }
        an[i] = v;
        let target = Math.max(v, sim[i] * (have ? 0.55 : 1));
        if (!M.playing) target = Math.max(target, 0.035 + 0.025 * Math.sin(T * 1.4 + i * 0.35));
        shown[i] = target > shown[i] ? shown[i] + (target - shown[i]) * Math.min(1, dt * 22) : Math.max(target, shown[i] - dt * 1.5);
        if (i < 8) bass += shown[i] / 8;
      }
      bassE += (bass - bassE) * Math.min(1, dt * 10);
    }

    function draw(dt, T, f, song) {
      const k = cw / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, cw, cw);
      g.setTransform(k, 0, 0, k, 0, 0);
      readSpectrum(dt, T);
      const cx = 500 + discX, cy = 500, vis = 1 - Math.min(1, Math.abs(discX) / 420);
      const play = M.playing ? 1 : 0.5;
      // Leuchten hinter der Scheibe
      const gr = g.createRadialGradient(cx, cy, RD * 0.75, cx, cy, RD * 1.75);
      gr.addColorStop(0, U.rgba(c1, (0.2 + 0.32 * bassE) * play));
      gr.addColorStop(0.4, U.rgba(c2, 0.07 * play));
      gr.addColorStop(1, U.rgba(c2, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 1000, 1000);
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      // Pulsringe
      for (let j = pulses.length - 1; j >= 0; j--) {
        const p = pulses[j];
        p.t += dt;
        const q = p.t / p.d;
        if (q >= 1) { pulses.splice(j, 1); continue; }
        g.globalAlpha = (1 - q) * (1 - q) * 0.45 * p.v * vis;
        g.strokeStyle = c1; g.lineWidth = p.w;
        g.beginPath(); g.arc(cx, cy, RD + 14 + 96 * V.ease.outCubic(q), 0, TAU); g.stroke();
      }
      // Strahlenkranz
      const r0 = RD * (1 + 0.016 * pop) + 17;
      for (let pass = 0; pass < 2; pass++) {
        g.lineWidth = pass ? 4.6 : 13;
        for (let i = 0; i < NR; i++) {
          const v = shown[i];
          const L = 3 + v * 76;
          g.strokeStyle = rayCols[i];
          g.globalAlpha = (pass ? 0.32 + 0.68 * Math.min(1, v * 1.2) : 0.13 * v) * vis;
          const x0 = SIN[i] * r0, y0 = -COS[i] * r0, x1 = SIN[i] * (r0 + L), y1 = -COS[i] * (r0 + L);
          g.beginPath();
          g.moveTo(cx + x0, cy + y0); g.lineTo(cx + x1, cy + y1);
          g.moveTo(cx - x0, cy + y0); g.lineTo(cx - x1, cy + y1);
          g.stroke();
        }
      }
      // Funken
      for (let j = sparks.length - 1; j >= 0; j--) {
        const s = sparks[j];
        s.life += dt; s.r += s.vr * dt; s.vr *= Math.exp(-dt * 0.9);
        const q = s.life / s.max;
        if (q >= 1) { sparks.splice(j, 1); continue; }
        const a = U.rad(s.a), x = cx + Math.sin(a) * s.r, y = cy - Math.cos(a) * s.r;
        const al = Math.sin(Math.PI * Math.min(1, q * 1.4 + 0.05)) * vis;
        g.fillStyle = s.col ? c2 : c1;
        g.globalAlpha = al * 0.22; g.beginPath(); g.arc(x, y, s.s * 3, 0, TAU); g.fill();
        g.globalAlpha = al * 0.95; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s.s * 0.6, 0, TAU); g.fill();
      }
      // Abschnittsmarken am Rand und Halo um den Fortschrittskopf
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#fff';
      for (const m of song.marks) {
        const p = V.display.pt(m * 360, 484);
        g.globalAlpha = m <= f ? 0.0 : 0.38;
        g.beginPath(); g.arc(p.x, p.y, 3.4, 0, TAU); g.fill();
      }
      const hp = V.display.pt(f * 360, 484);
      const hr0 = scrub ? 30 : 17;
      const hg = g.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, hr0);
      hg.addColorStop(0, U.rgba(c1, scrub ? 0.75 : 0.5 * play + 0.15));
      hg.addColorStop(1, U.rgba(c1, 0));
      g.globalAlpha = 1;
      g.fillStyle = hg;
      g.beginPath(); g.arc(hp.x, hp.y, hr0, 0, TAU); g.fill();
    }

    /* ---------- Bildtakt */
    let angle = Math.random() * 360, w = 0, lastT1 = '', lastT2 = '';
    ctx.onFrame((dt, T) => {
      if (colT < 1) {
        colT = Math.min(1, colT + dt * 2);
        const q = V.ease.inOutSine(colT);
        c1 = U.mix(colFrom[0], colTo[0], q); c2 = U.mix(colFrom[1], colTo[1], q);
        rebuildCols();
      }
      const target = M.playing ? 38 : 0;
      w += (target - w) * (1 - Math.exp(-dt * (M.playing ? 1.5 : 2.2)));
      angle = (angle + w * dt) % 360;
      const rot = `rotate(${angle.toFixed(2)}deg)`;
      main.spin.style.transform = rot;
      if (side) side.d.spin.style.transform = rot;
      pop *= Math.exp(-dt * 7);
      if (!sliding && !side) layout();

      const P = position();
      const f = scrub ? scrub.f : P.frac;
      ctx.rim.arc('prog', { value: f, from: 0, color: c1, width: 9, r: 484, glow: 0.85, track: true, trackAlpha: 0.15, head: true, smooth: false, alpha: M.playing || scrub ? 1 : 0.6 });
      const sec = scrub ? scrub.bar * 16 * P.song.sd : P.sec;
      const s1 = V.fmt.duration(sec, { ceil: false }), s2 = '−' + V.fmt.duration(Math.max(0, P.dur - sec), { ceil: false });
      if (s1 !== lastT1) { tEl.set(s1); lastT1 = s1; }
      if (s2 !== lastT2) { tRem.set(s2); lastT2 = s2; }
      draw(dt, T, f, P.song);
    });

    /* ---------- Hinweis: Nachbarsender kurz zeigen */
    function peek() {
      if (sliding || gm || side) return;
      ensureSide(1);
      sliding = true;
      V.tween({ duration: 1.25, ease: V.ease.linear, onUpdate: (t) => { discX = -120 * Math.sin(Math.PI * V.ease.inOutSine(t)); layout(); } }).promise
        .then(() => { discX = 0; if (side) { side.d.el.remove(); side = null; } layout(); sliding = false; });
    }

    let crownAcc = 0;
    return {
      shown() { if (!hinted) { hinted = true; ctx.timeout(peek, 700); } },
      crown(dA) {
        crownAcc += dA;
        if (Math.abs(crownAcc) >= 46) { const d = Math.sign(crownAcc); crownAcc = 0; goStation(d); }
      },
      params(p) { if (p && p.station && byId(p.station)) play(p.station); },
      destroy() { if (side) side.d.el.remove(); },
    };
  }

  /* ======================================================= Sprache & Aktionen */
  const KW = [
    ['lofi', /lo-?fi|lo fi|kaffee|frühstück|hip-?hop|chill/],
    ['fokus', /konzentr|fokus|focus|arbeiten|lernen|studier|deep work/],
    ['regen', /regen|rain|gewitter|ruhig|klavier|piano/],
    ['meer', /meer|ozean|wellen|strand|brandung|rauschen|schlaf|natur/],
    ['abend', /abend|sonnenuntergang|glühen|sunset|entspann|relax|gemütlich|warm/],
  ];
  function stationFrom(t) {
    const s = String(t || '').toLowerCase();
    if (!s) return null;
    const direct = STATIONS.find((x) => x.id === s || x.name.toLowerCase() === s);
    if (direct) return direct.id;
    for (const [id, re] of KW) if (re.test(s)) return id;
    return null;
  }
  function card() { const i = info(); return { type: 'icon', icon: 'music', color: i.color, title: i.title, sub: i.artist }; }
  const muted = () => V.store.get('settings.volume', 0.6) < 0.02;

  const API = {
    play(station) {
      const id = station ? stationFrom(station) : null;
      play(id || undefined);
      const i = info();
      const say = `Ich spiele ${i.artist}: „${i.title}“.` + (muted() ? ' Der Ton ist allerdings stumm.' : '');
      return { say, card: card(), emotion: 'happy', open: V.shell.mode === 'home' ? 'music' : undefined };
    },
    pause() {
      if (!M.playing) return { say: 'Es läuft gerade keine Musik.', emotion: 'neutral' };
      pause();
      return { say: 'Musik pausiert.', card: { type: 'icon', icon: 'pause', color: cur().c1, title: 'Pausiert', sub: info().title } };
    },
    next() {
      skip(1);
      if (!M.playing) play();
      return { say: `Weiter mit „${info().title}“.`, card: card() };
    },
    previous() {
      const before = rec(cur().id).track;
      skip(-1);
      if (!M.playing) play();
      const t = info().title;
      return { say: rec(cur().id).track === before ? `Noch einmal von vorn: „${t}“.` : `Zurück zu „${t}“.`, card: card() };
    },
    status() {
      const i = info();
      if (!M.started) return { say: 'Gerade läuft keine Musik. Sag einfach „Spiel Musik“.', emotion: 'neutral' };
      if (!i.playing) return { say: `Pausiert: „${i.title}“ auf ${i.artist}.`, card: card() };
      return { say: `Das ist „${i.title}“ auf ${i.artist}.`, card: card(), emotion: 'happy' };
    },
    nextStation(dir) {
      station(M.stIdx + (dir || 1), dir || 1);
      if (!M.playing) play();
      return { say: `Jetzt läuft ${cur().name}.`, card: card(), emotion: 'happy' };
    },
  };

  V.apps.register({
    id: 'music',
    name: 'Musik',
    icon: 'music',
    color: APP_COLOR,
    order: 30,
    keywords: ['musik', 'radio', 'lied', 'song', 'sender', 'lo-fi', 'lofi'],
    keepAwake: () => M.playing,

    init() {
      data();
      V.music = {
        play: (st) => play(st ? stationFrom(st) || undefined : undefined),
        pause, toggle,
        next: () => skip(1), previous: () => skip(-1),
        info, stations: () => STATIONS.map((s) => ({ id: s.id, name: s.name, color: s.c1 })),
        get playing() { return M.playing; },
        _render: render,
      };
      V.info = V.info || {};
      V.info.music = () => {
        if (!M.started) return null;
        const i = info();
        return { title: i.title, artist: i.artist, playing: i.playing, color: i.color, progress: i.progress, station: i.station };
      };
      V.on('convo:open', () => { if (M.playing) duck(0.28); });
      V.on('convo:close', () => duck(1));
      window.addEventListener('pagehide', () => saveStep());

      const ids = STATIONS.map((s) => s.id);
      const stDesc = STATIONS.map((s) => `${s.id} (${s.name})`).join(', ');
      V.actions.register('music.play', {
        desc: 'Spielt generative Musik ab bzw. setzt sie fort. Optional station: ' + stDesc + '. lofi = entspannte Beats, fokus = zum Arbeiten, regen = Klavier und Regen, abend = warm und ruhig, meer = Wellen zum Einschlafen.',
        params: { station: { type: 'string', enum: ids, description: 'Sender-ID (optional)' } },
        required: [],
        run(a) { return API.play(a && a.station); },
      });
      V.actions.register('music.pause', { desc: 'Pausiert die Musik.', run: () => API.pause() });
      V.actions.register('music.next', { desc: 'Springt zum nächsten Titel des aktuellen Senders.', run: () => API.next() });
      V.actions.register('music.previous', { desc: 'Springt zum vorherigen Titel bzw. an den Anfang des aktuellen Titels.', run: () => API.previous() });
      V.actions.register('music.status', { desc: 'Sagt, welcher Titel und Sender gerade läuft.', run: () => API.status() });

      const I = V.brain.intent;
      const MUS = /musik|(?<![a-zäöüß])(lied|song|radio|sender|beats|klänge|playlist|titel)(?![a-zäöüß])/;
      I({
        id: 'music-what', priority: 10,
        match: [/(?<![a-zäöüß])was (läuft|spielt|hör\w* (ich|wir))(?![a-zäöüß])/, /welche[snrm]? (lied|song|titel|stück|musik|sender)/, /wie heißt (das|dieses|der|die) (lied|stück|song|titel|sender)/, /was ist das für (ein |eine )?(lied|musik|song|stück)/],
        run() { return API.status(); },
      });
      I({
        id: 'music-pause', priority: 10,
        match: (t) => {
          const stop = /(?<![a-zäöüß])(pause|pausier\w*|stopp\w*|stop|anhalten|halt|aus|ausmachen|ausschalten|abschalten|beende\w*|ruhe)(?![a-zäöüß])/.test(t);
          if (stop && MUS.test(t)) return true;
          if (/^(pause|stopp|stop|halt|anhalten|pausieren|pausiere|ruhe|ruhe bitte)$/.test(t) && M.playing) return true;
          return null;
        },
        run() { return API.pause(); },
      });
      I({
        id: 'music-station', priority: 10,
        match: [/(?<![a-zäöüß])(nächste[nr]?|andere[nr]?|neue[nr]?) sender/, /sender wechseln|wechsl?e?\w* (den |zum )?sender/],
        run() { return API.nextStation(1); },
      });
      I({
        id: 'music-next', priority: 10,
        match: (t) => {
          if (/(?<![a-zäöüß])(nächste[snrm]?|andere[snrm]?|neue[snrm]?) (lied|song|titel|stück|track)/.test(t)) return true;
          if (/(?<![a-zäöüß])(überspring\w*|skip)(?![a-zäöüß])/.test(t)) return true;
          if (/^(weiter|nächstes|next)$/.test(t) && M.playing) return true;
          return null;
        },
        run() { return API.next(); },
      });
      I({
        id: 'music-prev', priority: 10,
        match: [/(?<![a-zäöüß])(vorherige[snrm]?|letzte[snrm]?|vorige[snrm]?) (lied|song|titel|stück|track)/, /(noch ?mal|nochmal|wiederhol\w*) (das |den |dieses |diesen )?(lied|song|titel|stück)/],
        run() { return API.previous(); },
      });
      I({
        id: 'music-play', priority: 9,
        match: (t) => {
          if (/(?<![a-zäöüß])(aus|pause|stopp?|leiser|lauter)(?![a-zäöüß])/.test(t)) return null;
          const st = stationFrom(t);
          const mus = MUS.test(t);
          const strong = /(?<![a-zäöüß])(spiel|spiele|spielen|spiel mir|leg|lege|hör|höre|hören|abspielen)(?![a-zäöüß])/.test(t);
          const weak = /(?<![a-zäöüß])(starte?|mach|mache|schalte?|an|ein|bitte|fortsetzen|weiterspielen|weiter)(?![a-zäöüß])/.test(t);
          if (/^(musik|radio)( an| ein| bitte)?$/.test(t)) return { st: null };
          if (mus && (strong || weak)) return { st };
          if (strong && st) return { st };
          if (/^(weiter|weiterspielen|fortsetzen|play)$/.test(t) && M.started && !M.playing) return { st: null };
          return null;
        },
        run(m) { return API.play(m.st); },
      });
    },

    create(ctx) { return createUI(ctx); },
  });
})();
