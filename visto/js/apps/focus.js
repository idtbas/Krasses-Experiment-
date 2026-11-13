/* VistoOS · apps/focus.js — Fokus (Pomodoro)
 *
 *  Zyklus: 4 Fokusrunden (15, 25 oder 50 Min.) mit kurzen Pausen, nach der vierten Runde eine lange Pause.
 *  Mitte:  langsam wabernde Lichtkugel; ihre Farbe wandert mit der Zeit
 *          (Fokus: Indigo → Violett, Pause: Minze → Türkis) und fließt beim Phasenwechsel weich hinüber.
 *  Rand:   Fortschritt der laufenden Phase. Oben am Bogen: vier Sitzungspunkte.
 *  „Nicht stören“ ist während des Fokus automatisch an und wird danach auf den alten Wert zurückgesetzt.
 *  Läuft im Hintergrund weiter (Zeitstempel im Speicher); auf dem Zifferblatt ein dünner Bogen am Rand.
 *
 *  Aktionen: focus.start {minutes}, focus.stop, focus.pause, focus.status
 *  Datenquelle: V.info.focus() → {phase, left, total, round, rounds, paused, color} | null
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const COLOR = '#5E5CE6';
  const BREAK_COLOR = '#3FD6A8';
  const ROUNDS = 4;
  const CHOICES = [15, 25, 50];
  const BREAKS = { 15: [3, 10], 25: [5, 15], 50: [10, 20] };   // [kurze, lange] Pause in Minuten
  let S = null;

  /* ------------------------------------------------------------ Zustand */
  function st() {
    if (!S) S = V.store.app('focus', { minutes: 25, session: null, stats: null, last: null });
    return S;
  }
  const now = () => V.time.ms();
  function breaksFor(min) {
    if (BREAKS[min]) return BREAKS[min];
    return min <= 20 ? [3, 10] : min <= 35 ? [5, 15] : [10, 20];
  }
  const isBreak = (ph) => ph === 'break' || ph === 'long';
  function phaseMin(s, ph) { ph = ph || s.phase; return ph === 'focus' ? s.focusMin : ph === 'long' ? s.longMin : s.breakMin; }
  function totalOf(s) { return phaseMin(s) * 60; }
  function leftOf(s) { return s.paused ? s.left : Math.max(0, (s.end - now()) / 1000); }
  function progOf(s) { return U.clamp(1 - leftOf(s) / totalOf(s), 0, 1); }

  function dayKey() { const d = V.time.now(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function today() {
    const s = st();
    if (!s.stats || s.stats.day !== dayKey()) s.stats = { day: dayKey(), rounds: 0, sec: 0 };
    return s.stats;
  }
  function addFocus(s, sec, round) {
    s.focusSec = (s.focusSec || 0) + sec;
    const d = today();
    d.sec += sec;
    if (round) d.rounds++;
  }
  function minWords(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return m + (m === 1 ? ' Minute' : ' Minuten');
    const h = Math.floor(m / 60), r = m % 60;
    return h + (h === 1 ? ' Stunde' : ' Stunden') + (r ? ' und ' + r + (r === 1 ? ' Minute' : ' Minuten') : '');
  }
  function minShort(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return m + ' Min.';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' Std.' + (r ? ' ' + r + ' Min.' : '');
  }
  const rundenWort = (n) => n + (n === 1 ? ' Runde' : ' Runden');

  /* -------------------------------------------------------------- Farben */
  // Fokus wandert von Indigo (App-Farbe) nach Violett, Pause von Minze nach Türkis.
  function hue(ph, p, t) {
    return isBreak(ph) ? 162 + 32 * p + 7 * Math.sin(t * 0.06) : 241 + 46 * p + 9 * Math.sin(t * 0.06);
  }
  function tone(ph, p, t) { return isBreak(ph) ? U.hsl(hue(ph, p, t || 0), 66, 58) : U.hsl(hue(ph, p, t || 0), 74, 64); }
  function palette(ph, p, t) {
    const h = hue(ph, p, t);
    return isBreak(ph)
      ? [U.hsl(h, 70, 54), U.hsl(h + 28, 82, 58), U.hsl(h - 24, 64, 50), U.hsl(h + 52, 86, 64)]
      : [U.hsl(h, 78, 60), U.hsl(h + 36, 80, 60), U.hsl(h - 30, 88, 58), U.hsl(h + 64, 72, 62)];
  }

  /* ------------------------------------------------- „Nicht stören“ */
  function dndOn(s) {
    if (!s.dnd) s.dnd = { prev: !!V.store.get('settings.dnd', false) };
    if (!V.store.get('settings.dnd')) V.store.set('settings.dnd', true);
  }
  function dndOff(s) {
    if (!s || !s.dnd) return;
    const prev = s.dnd.prev;
    s.dnd = null;
    if (!!V.store.get('settings.dnd') !== prev) V.store.set('settings.dnd', prev);
  }

  /* --------------------------------------------------------------- Töne */
  function chime(kind) {
    if (!V.sound.enabled()) return;
    const b = V.sound.bell;
    try {
      if (kind === 'break' || kind === 'long') { b(783.99, 0, 0.03, 1.4); b(659.25, 0.26, 0.028, 1.6); b(523.25, 0.54, 0.03, 2.4); }
      else if (kind === 'focus') { b(523.25, 0, 0.026, 1.2); b(659.25, 0.22, 0.027, 1.4); b(783.99, 0.44, 0.032, 2); }
      else if (kind === 'complete') { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => b(f, i * 0.17, 0.03, 2)); }
      else if (kind === 'start') { b(659.25, 0, 0.024, 1.1); b(987.77, 0.16, 0.022, 1.6); }
    } catch (e) { /* stumm */ }
  }

  /* -------------------------------------------------------- Abläufe */
  function start(min) {
    const s0 = st();
    min = Math.round(U.clamp(Number(min) || s0.minutes || 25, 1, 180));
    if (s0.session) dndOff(s0.session);
    const [brk, long] = breaksFor(min);
    const t = now();
    const s = {
      focusMin: min, breakMin: brk, longMin: long, rounds: ROUNDS, round: 1, done: 0,
      phase: 'focus', start: t, end: t + min * 60000, paused: false, left: min * 60, focusSec: 0, dnd: null,
    };
    s0.session = s;
    if (CHOICES.includes(min)) s0.minutes = min;
    if (s0.last) s0.last.seen = true;
    dndOn(s);
    V.store.save();
    V.emit('focus:changed', { type: 'start' });
    return s;
  }

  /** Phase abschließen. natural = Zeit regulär abgelaufen, sonst übersprungen. → neue Phase | 'complete' */
  function advance(s, at, natural) {
    if (s.phase === 'focus') {
      const sec = natural ? totalOf(s) : Math.max(0, totalOf(s) - leftOf(s));
      addFocus(s, sec, natural || sec >= totalOf(s) * 0.5);
      s.done++;
      s.phase = s.done >= s.rounds ? 'long' : 'break';
      dndOff(s);
    } else if (s.phase === 'break') {
      s.round++;
      s.phase = 'focus';
      dndOn(s);
    } else return 'complete';
    s.start = at;
    s.end = at + totalOf(s) * 1000;
    s.left = totalOf(s);
    s.paused = false;
    return s.phase;
  }

  function finish(s, kind) {
    const s0 = st();
    if (kind === 'stop' && s.phase === 'focus') addFocus(s, Math.max(0, totalOf(s) - leftOf(s)), false);
    dndOff(s);
    s0.session = null;
    s0.last = { ts: now(), rounds: s.done, sec: Math.round(s.focusSec || 0), complete: kind === 'complete', seen: false };
    V.store.save();
  }

  function pause(s) { if (!s || s.paused) return; s.left = leftOf(s); s.paused = true; V.store.save(); V.emit('focus:changed', { type: 'pause' }); }
  function resume(s) { if (!s || !s.paused) return; s.end = now() + s.left * 1000; s.paused = false; V.store.save(); V.emit('focus:changed', { type: 'resume' }); }
  function skip(s) {
    if (!s) return;
    const r = advance(s, now(), false);
    if (r === 'complete') finish(s, 'complete');
    V.store.save();
    chime(r);
    V.haptic([12, 50, 12]);
    V.emit('focus:changed', { type: r });
  }

  function isOpen() { return !!(V.shell.app && V.shell.app.def.id === 'focus'); }

  function announce(kind, s) {
    if (!kind) return;
    chime(kind);
    V.haptic([18, 70, 18]);
    const col = kind === 'focus' ? COLOR : kind === 'complete' ? '#A77BFF' : BREAK_COLOR;
    if (isOpen()) { V.rim.pulse({ at: 0, color: col, spread: 150, duration: 2.2 }); return; }
    const L = st().last;
    const msg = {
      break: ['Zeit für eine Pause', `${s.breakMin} Minuten durchatmen · Runde ${s.done} von ${s.rounds} geschafft`],
      long: ['Lange Pause', `Alle ${s.rounds} Runden geschafft · ${s.longMin} Minuten Pause`],
      focus: ['Weiter geht’s', `Runde ${s.round} von ${s.rounds} · ${s.focusMin} Minuten Fokus`],
      complete: ['Fokus-Zyklus geschafft', L ? `${rundenWort(L.rounds)} · ${minWords(L.sec)} konzentriert` : 'Gut gemacht!'],
    }[kind];
    if (msg) V.notify.banner({ title: msg[0], body: msg[1], icon: 'focus', color: col, sound: 'none', onClick: () => V.shell.open('focus') });
  }

  function bgTick() {
    const s0 = st();
    const s = s0.session;
    if (s && !s.paused && now() >= s.end) {
      let kind = null, guard = 0;
      while (s0.session && !s.paused && now() >= s.end && guard++ < 64) {
        const r = advance(s, s.end, true);
        if (r === 'complete') { finish(s, 'complete'); kind = 'complete'; break; }
        kind = r;
      }
      V.store.save();
      announce(kind, s);
      V.emit('focus:changed', { type: kind });
    }
    // dünner Bogen am Rand, solange die App nicht offen ist
    const cur = s0.session;
    if (cur && !isOpen() && V.shell.mode !== 'setup' && V.shell.mode !== 'boot') {
      const p = progOf(cur);
      const tm = V.info.timer && V.safe(() => V.info.timer());
      V.rim.arc('focus:bg', { value: p, from: 0, color: tone(cur.phase, p), width: 6, r: tm ? 479 : 492, glow: 0.7, alpha: cur.paused ? 0.45 : 0.95, smooth: false });
    } else V.rim.remove('focus:bg');
  }

  /* ---------------------------------------------------------- Lichtkugel */
  function drawOrb(c, t, o) {
    const { cx, cy, R, cols, a } = o;
    if (a <= 0.004) return;
    // 1) Inneres: wabernde Lichtkerne, die einander umkreisen (additiv)
    c.globalCompositeOperation = 'lighter';
    let g;
    for (let i = 0; i < 6; i++) {
      const s = i * 2.39;
      const ang = t * (0.13 + i * 0.031) * (i % 2 ? -1 : 1) + s;
      const rad = R * (0.12 + 0.36 * (0.5 + 0.5 * U.noise(t * 0.17 + s, i + 1)));
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.9;
      const rr = R * (0.58 + 0.2 * (0.5 + 0.5 * U.noise(t * 0.23 + s * 3, i + 7)));
      const col = cols[i % cols.length];
      g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, U.rgba(col, 0.5 * a));
      g.addColorStop(0.5, U.rgba(col, 0.2 * a));
      g.addColorStop(1, U.rgba(col, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
    }
    // 2) weiche Kugelform: nach außen ausblenden
    c.globalCompositeOperation = 'destination-in';
    g = c.createRadialGradient(cx, cy, R * 0.42, cx, cy, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.7, 'rgba(0,0,0,.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 1000, 1000);
    // 3) Hof hinter der Kugel
    c.globalCompositeOperation = 'destination-over';
    const hr = R * 2.1;
    g = c.createRadialGradient(cx, cy, R * 0.3, cx, cy, hr);
    g.addColorStop(0, U.rgba(cols[0], 0.2 * a));
    g.addColorStop(0.4, U.rgba(cols[1], 0.08 * a));
    g.addColorStop(1, U.rgba(cols[1], 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, hr, 0, TAU); c.fill();
    // 4) feiner Lichtsaum, der langsam um die Kugel wandert
    c.globalCompositeOperation = 'lighter';
    const la = t * 0.21;
    const lx = cx + Math.cos(la) * R * 0.22, ly = cy + Math.sin(la) * R * 0.22;
    g = c.createRadialGradient(lx, ly, R * 0.78, lx, ly, R * 1.04);
    g.addColorStop(0, U.rgba(cols[3], 0));
    g.addColorStop(0.7, U.rgba(cols[3], 0.13 * a));
    g.addColorStop(1, U.rgba(cols[3], 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(lx, ly, R * 1.04, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  /* --------------------------------------------------------------- Stile */
  const CSS = `
  .fo-cv { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .fo-view { position: absolute; inset: 0; pointer-events: none; will-change: opacity, transform; }
  .fo-view.on .vos-btn, .fo-view.on .fo-chip { pointer-events: auto; }
  .fo-time { position: absolute; left: 0; right: 0; top: 32.5cqw; height: 20cqw; display: flex; justify-content: center;
    font-size: 20cqw; font-weight: 200; letter-spacing: -.045em; line-height: 1; color: #fff; pointer-events: none;
    text-shadow: 0 0 5cqw rgba(0,0,0,.35); will-change: opacity, transform; }
  .fo-lab { position: absolute; left: 12cqw; right: 12cqw; text-align: center; white-space: nowrap; }
  .fo-sub { position: absolute; left: 14cqw; right: 14cqw; text-align: center; white-space: nowrap; font-size: 3.4cqw;
    font-weight: 520; color: rgba(255,255,255,.5); letter-spacing: -.003em; display: flex; justify-content: center; align-items: center; gap: 1.2cqw; }
  .fo-sub svg { width: 3.4cqw; height: 3.4cqw; flex: none; opacity: .9; }
  .fo-row { position: absolute; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 4cqw; }
  .fo-chip { position: absolute; width: 13.4cqw; height: 13.4cqw; margin: -6.7cqw 0 0 -6.7cqw; border-radius: 50%; border: 0; padding: 0;
    background: rgba(255,255,255,.085); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; font: 600 5cqw/1 var(--font); font-variant-numeric: tabular-nums; letter-spacing: -.03em;
    box-shadow: inset 0 0 0 .25cqw rgba(255,255,255,.06);
    transition: background .35s ease, box-shadow .45s ease, transform .35s var(--spring), color .3s; }
  .fo-chip small { display: block; font-size: 1.95cqw; font-weight: 700; letter-spacing: .16em; margin-top: .7cqw; opacity: .55; }
  .fo-chip.on { background: #5E5CE6; box-shadow: 0 0 6cqw rgba(94,92,230,.6), inset 0 0 0 .25cqw rgba(255,255,255,.18); }
  .fo-chip.on small { opacity: .8; }
  .fo-chip:active { transform: scale(.9); }
  .fo-h { position: absolute; left: 0; right: 0; text-align: center; font-size: 8.6cqw; font-weight: 300; letter-spacing: -.03em; line-height: 1; }
  `;

  /* ---------------------------------------------------------------- App */
  V.apps.register({
    id: 'focus',
    name: 'Fokus',
    icon: 'focus',
    color: COLOR,
    order: 70,
    keywords: ['fokus', 'pomodoro', 'konzentration', 'konzentrieren'],
    keepAwake: () => !!st().session,

    init() {
      setInterval(bgTick, 250);
      V.info.focus = () => {
        const s = st().session;
        if (!s) return null;
        const p = progOf(s);
        return { phase: s.phase, left: leftOf(s), total: totalOf(s), round: s.round, rounds: s.rounds, paused: s.paused, color: tone(s.phase, p) };
      };

      V.actions.register('focus.start', {
        desc: 'Startet eine Fokus-Sitzung (Pomodoro: 4 Runden mit kurzen Pausen, „Nicht stören“ automatisch an). minutes = Länge einer Fokusrunde in Minuten (üblich 15, 25 oder 50; Standard 25).',
        params: { minutes: { type: 'number', description: 'Minuten pro Fokusrunde' } },
        required: [],
        run(a) {
          const s = start(a && a.minutes);
          return {
            say: `Fokus läuft: ${s.focusMin} Minuten, danach ${s.breakMin} Minuten Pause. Ich halte dir den Rücken frei.`,
            card: { type: 'icon', icon: 'focus', color: COLOR, title: s.focusMin + ' Min.', sub: 'Fokus · Nicht stören an' },
            emotion: 'happy',
            open: 'focus',
          };
        },
      });
      V.actions.register('focus.stop', {
        desc: 'Beendet die laufende Fokus-Sitzung und schaltet „Nicht stören“ wieder zurück.',
        run() {
          const s = st().session;
          if (!s) return { say: 'Gerade läuft keine Fokus-Sitzung.' };
          finish(s, 'stop');
          V.emit('focus:changed', { type: 'stop' });
          const L = st().last;
          return {
            say: L.sec >= 60 ? `Fokus beendet. Du warst ${minWords(L.sec)} konzentriert.` : 'Fokus beendet.',
            card: { type: 'icon', icon: 'focus', color: COLOR, title: minShort(L.sec), sub: rundenWort(L.rounds) + ' geschafft' },
            emotion: 'happy',
          };
        },
      });
      V.actions.register('focus.pause', {
        desc: 'Pausiert die Fokus-Sitzung (resume = true setzt sie fort).',
        params: { resume: { type: 'boolean' } },
        run(a) {
          const s = st().session;
          if (!s) return 'Gerade läuft keine Fokus-Sitzung.';
          if (a && a.resume) { resume(s); return 'Weiter geht’s.'; }
          pause(s);
          return 'Fokus pausiert.';
        },
      });
      V.actions.register('focus.status', {
        desc: 'Liefert Phase, Runde und Restzeit der Fokus-Sitzung.',
        run() {
          const s = st().session;
          if (!s) return 'Gerade läuft keine Fokus-Sitzung.';
          const what = s.phase === 'focus' ? `Runde ${s.round} von ${s.rounds}` : s.phase === 'long' ? 'Lange Pause' : 'Pause';
          return { say: `${what}: noch ${V.fmt.durationWords(leftOf(s))}${s.paused ? ', pausiert' : ''}.`, card: { type: 'big', text: V.fmt.duration(leftOf(s)), sub: what } };
        },
      });

      const FW = /\b(fokus\w*|pomodoro|konzentr\w*|fokussier\w*|deep work)\b/;
      V.brain.intent({
        id: 'focus-stop', priority: 10,
        match: [/\b(fokus\w*|pomodoro|konzentration)\b.*\b(beenden|beende|stopp|stoppen|stop|aus|abbrechen|ende)\b/, /\b(beende|stoppe|stopp|stop|brich|beenden)\b.*\b(fokus|pomodoro|konzentration)/],
        run() { return V.actions.run('focus.stop'); },
      });
      V.brain.intent({
        id: 'focus-pause', priority: 10,
        match: (t) => (FW.test(t) && /\b(pausier\w*|anhalten|fortsetzen|weitermachen|weiter)\b/.test(t) ? true : null),
        run(m, t) { return V.actions.run('focus.pause', { resume: /fortsetz|weiter/.test(t) }); },
      });
      V.brain.intent({
        id: 'focus-status', priority: 10,
        match: (t) => (FW.test(t) && /\b(noch|status|restzeit|wie lange|welche runde)\b/.test(t) ? true : null),
        run() { return V.actions.run('focus.status'); },
      });
      V.brain.intent({
        id: 'focus-start', priority: 9,
        match: (t) => {
          if (!FW.test(t)) return null;
          if (/^(öffne|zeig)/.test(t)) return null;
          return { s: V.brain.parseDuration(t) };
        },
        run(m) { return V.actions.run('focus.start', { minutes: m.s ? Math.round(m.s / 60) : undefined }); },
      });
    },

    create(ctx) {
      V.css('focus', CSS);
      const root = ctx.root;
      const s0 = st();
      let sel = CHOICES.includes(s0.minutes) ? s0.minutes : 25;
      const title = ctx.title('Fokus');

      /* Leinwand für die Lichtkugel */
      const cv = U.el('canvas', { class: 'fo-cv', attrs: { 'aria-hidden': 'true' } });
      root.appendChild(cv);
      const c2 = cv.getContext('2d');
      let W = 0;
      function resize() {
        const dpr = Math.min(V.display.dpr || window.devicePixelRatio || 1, 2);
        W = Math.max(64, Math.round((V.display.size || 360) * dpr));
        cv.width = cv.height = W;
      }
      resize();
      ctx.on('display:resize', resize);

      /* große Restzeit (geteilt von Einstellen und Laufen) */
      const timeEl = U.el('div', { class: 'fo-time vos-num' });
      const digits = V.faces.rollDigits(timeEl, { digitW: '0.58em', colonW: '0.28em' });

      /* Ansichten */
      const views = { setup: U.el('div', { class: 'fo-view' }), run: U.el('div', { class: 'fo-view' }), done: U.el('div', { class: 'fo-view' }) };
      root.append(views.setup, views.run, views.done, timeEl);

      // — Einstellen: drei Längen am oberen Bogen
      const chips = CHOICES.map((m, i) => {
        const p = V.display.pt((i - 1) * 34, 318);
        const b = U.el('button', { class: 'fo-chip', attrs: { type: 'button', 'aria-label': m + ' Minuten' }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw' } },
          U.el('span', { text: String(m) }), U.el('small', { text: 'MIN' }));
        V.ui.tap(b, () => choose(m));
        views.setup.appendChild(b);
        return b;
      });
      const setLab = U.el('div', { class: 'fo-lab vos-label', style: { top: '55cqw', color: U.rgba('#9C9BFF', 0.95) } });
      const setSub = U.el('div', { class: 'fo-sub', style: { top: '59.4cqw' } });
      const startBtn = V.ui.roundButton('play', { kind: 'lg', label: 'Fokus starten', style: { width: '19cqw', height: '19cqw', background: COLOR, color: '#fff', boxShadow: '0 0 7cqw rgba(94,92,230,.55)' }, onClick: () => { start(sel); chime('start'); V.haptic(10); } });
      const setRow = U.el('div', { class: 'fo-row', style: { top: '66cqw', height: '19cqw' } }, startBtn);
      views.setup.append(setLab, setSub, setRow);

      // — Laufen: Sitzungspunkte am Bogen, Phase, Bedienung
      const dotsSvg = U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      const dots = [];
      for (let i = 0; i < ROUNDS; i++) {
        const p = V.display.pt((i - (ROUNDS - 1) / 2) * 9.2, 384);
        const halo = U.svg('circle', { cx: p.x, cy: p.y, r: 19, fill: '#fff', opacity: 0 });
        const dot = U.svg('circle', { cx: p.x, cy: p.y, r: 8.5, fill: 'none', stroke: 'rgba(255,255,255,.3)', 'stroke-width': 2.6 });
        dotsSvg.append(halo, dot);
        dots.push({ halo, dot });
      }
      const runLab = U.el('div', { class: 'fo-lab vos-label', style: { top: '55cqw' } });
      const runSub = U.el('div', { class: 'fo-sub', style: { top: '59.4cqw' } });
      const stopBtn = V.ui.roundButton('close', { label: 'Fokus beenden', style: { width: '14.5cqw', height: '14.5cqw' }, onClick: () => {
        const s = st().session; if (!s) return;
        finish(s, 'stop');
        showDone = st().last.sec >= 60;
        V.emit('focus:changed', { type: 'stop' });
      } });
      const pauseBtn = V.ui.roundButton('pause', { kind: 'lg', label: 'Pause', style: { width: '19cqw', height: '19cqw' }, onClick: () => {
        const s = st().session; if (!s) return;
        if (s.paused) resume(s); else pause(s);
      } });
      const skipBtn = V.ui.roundButton('next', { label: 'Phase überspringen', style: { width: '14.5cqw', height: '14.5cqw' }, onClick: () => skip(st().session) });
      const runRow = U.el('div', { class: 'fo-row', style: { top: '66cqw', height: '19cqw', gap: '5cqw' } }, stopBtn, pauseBtn, skipBtn);
      views.run.append(dotsSvg, runLab, runSub, runRow);

      // — Geschafft
      const doneH = U.el('div', { class: 'fo-h', style: { top: '33cqw' } });
      const doneSub = U.el('div', { class: 'fo-sub', style: { top: '45cqw', fontSize: '4.2cqw', color: 'rgba(255,255,255,.72)' } });
      const doneLab = U.el('div', { class: 'fo-lab vos-label', style: { top: '52cqw', color: U.rgba('#B9A8FF', 0.9) } });
      const againBtn = V.ui.button('Nochmal', { icon: 'reset', onClick: () => { st().last && (st().last.seen = true); start(sel); chime('start'); } });
      const okBtn = V.ui.button('Fertig', { kind: 'white', onClick: () => { st().last && (st().last.seen = true); showDone = false; V.store.save(); render(); } });
      const doneRow = U.el('div', { class: 'fo-row', style: { top: '69.5cqw', height: '11.5cqw', gap: '3cqw' } }, againBtn, okBtn);
      views.done.append(doneH, doneSub, doneLab, doneRow);

      /* Federn für die Übergänge */
      const vs = {};
      for (const k in views) {
        const el = views[k];
        const sp = V.spring(0, { response: 0.55, bounce: 0.12 });
        sp.onUpdate((v) => {
          el.style.opacity = U.clamp(v, 0, 1).toFixed(3);
          el.style.transform = `scale(${(0.93 + 0.07 * v).toFixed(4)})`;
          el.style.visibility = v < 0.004 ? 'hidden' : '';
        });
        vs[k] = sp;
      }
      const timeSp = V.spring(1, { response: 0.5, bounce: 0.1 });
      timeSp.onUpdate((v) => {
        timeEl.style.opacity = U.clamp(v, 0, 1).toFixed(3);
        timeEl.style.transform = `scale(${(0.9 + 0.1 * v).toFixed(4)})`;
      });
      const mixSp = V.spring(0, { response: 1.6, bounce: 0 });          // 0 = Fokus, 1 = Pause
      const alphaSp = V.spring(0, { response: 1.1, bounce: 0 });        // Helligkeit der Kugel
      const sizeSp = V.spring(0.8, { response: 0.9, bounce: 0.18 });    // Größe der Kugel
      const speedSp = V.spring(1, { response: 0.9, bounce: 0 });        // Tempo des Waberns

      let showDone = !!(s0.last && s0.last.complete && !s0.last.seen && now() - s0.last.ts < 15 * 60000);
      let mode = null;
      function want() { return st().session ? 'run' : showDone && st().last ? 'done' : 'setup'; }

      function choose(m) {
        if (sel === m) return;
        sel = m;
        st().minutes = m;
        V.store.save();
        render();
      }

      function render() {
        const s = st().session;
        const m = want();
        if (m !== mode) {
          for (const k in views) {
            views[k].classList.toggle('on', k === m);
            vs[k].to(k === m ? 1 : 0);
          }
          timeSp.to(m === 'done' ? 0 : 1);
          mode = m;
        }
        if (m === 'setup') {
          chips.forEach((b, i) => b.classList.toggle('on', CHOICES[i] === sel));
          const [brk] = breaksFor(sel);
          setLab.textContent = `${ROUNDS} Runden · ${brk} Min. Pause`;
          const d = today();
          setSub.innerHTML = d.sec >= 60
            ? `${V.icon('check')}<span>Heute ${U.esc(rundenWort(d.rounds))} · ${U.esc(minShort(d.sec))}</span>`
            : `${V.icon('moon')}<span>„Nicht stören“ schaltet sich ein</span>`;
          digits.set(V.fmt.duration(sel * 60));
          title.set('Fokus');
          mixSp.to(0);
          alphaSp.to(0.62);
          sizeSp.to(0.86);
          speedSp.to(0.7);
          ctx.rim.arc('main', { value: sel / 60, from: 0, color: COLOR, width: 12, r: 478, glow: 0.9, track: true, head: true, smooth: true, alpha: 1 });
        } else if (m === 'run') {
          const brk = isBreak(s.phase);
          title.set(brk ? (s.phase === 'long' ? 'Lange Pause' : 'Pause') : 'Fokus');
          pauseBtn.innerHTML = V.icon(s.paused ? 'play' : 'pause');
          pauseBtn.setAttribute('aria-label', s.paused ? 'Fortsetzen' : 'Pause');
          skipBtn.setAttribute('aria-label', brk ? 'Pause überspringen' : 'Runde abschließen');
          mixSp.to(brk ? 1 : 0);
          alphaSp.to(s.paused ? 0.36 : 1);
          sizeSp.to(s.paused ? 0.9 : 1);
          speedSp.to(s.paused ? 0.18 : brk ? 0.8 : 1);
          texts(s);
        } else {
          const L = st().last;
          doneH.textContent = L.complete ? 'Geschafft.' : 'Gut gemacht.';
          doneSub.textContent = `${rundenWort(L.rounds)} · ${minWords(L.sec)} konzentriert`;
          const d = today();
          doneLab.textContent = `Heute insgesamt ${minShort(d.sec)}`;
          title.set(L.complete ? 'Zyklus geschafft' : 'Fokus');
          alphaSp.to(1.1);
          sizeSp.to(1.12);
          speedSp.to(0.55);
          ctx.rim.remove('main');
        }
      }

      let lastTexts = '';
      function texts(s) {
        const brk = isBreak(s.phase);
        const end = new Date(V.time.now().getTime() + leftOf(s) * 1000);
        let lab, sub, icon;
        if (s.paused) {
          lab = 'Pausiert';
          sub = brk ? 'Pause angehalten' : `Runde ${s.round} von ${s.rounds}`;
          icon = 'pause';
        } else if (!brk) {
          lab = `Runde ${s.round} von ${s.rounds}`;
          sub = `Nicht stören · bis ${V.fmt.time(end)}`;
          icon = 'moon';
        } else if (s.phase === 'long') {
          lab = 'Alle Runden geschafft';
          sub = `Lange Pause bis ${V.fmt.time(end)}`;
          icon = 'coffee';
        } else {
          lab = `Runde ${s.done} geschafft`;
          sub = `Weiter um ${V.fmt.time(end)}`;
          icon = 'coffee';
        }
        const key = lab + '|' + sub + '|' + icon;
        if (key === lastTexts) return;
        lastTexts = key;
        runLab.textContent = lab;
        runSub.innerHTML = `${V.icon(icon)}<span>${U.esc(sub)}</span>`;
      }

      ctx.on('focus:changed', (e) => {
        if (e && e.type === 'complete') showDone = true;
        render();
      });
      ctx.on('time:minute', () => { lastTexts = ''; });

      /* Anfangszustand ohne Übergang */
      for (const k in vs) vs[k].set(0);
      render();
      for (const k in vs) vs[k].set(k === mode ? 1 : 0);
      timeSp.set(mode === 'done' ? 0 : 1);
      { const s = st().session; mixSp.set(s && isBreak(s.phase) ? 1 : 0); }
      alphaSp.set(0);
      alphaSp.to(mode === 'setup' ? 0.62 : mode === 'done' ? 1.1 : (st().session && st().session.paused ? 0.36 : 1));

      /* Bild für Bild */
      let T = Math.random() * 200, RT = 0;
      ctx.onFrame((dt) => {
        RT += dt;
        T += dt * speedSp.value;
        const s = st().session;
        const k = U.clamp(mixSp.value, 0, 1);
        let pF = 0, pB = 0, p = 0;
        if (s) {
          p = progOf(s);
          pF = s.phase === 'focus' ? p : 1;
          pB = isBreak(s.phase) ? p : 1;
        } else if (mode === 'done') pF = 1;
        const fc = palette('focus', pF, T), bc = palette('break', pB, T);
        const cols = fc.map((c, i) => (k <= 0.001 ? c : k >= 0.999 ? bc[i] : U.mix(c, bc[i], k)));
        const col = U.mix(tone('focus', pF, T), tone('break', pB, T), k);

        // Kugel
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, W, W);
        c2.setTransform(W / 1000, 0, 0, W / 1000, 0, 0);
        const breath = 1 + 0.028 * Math.sin(T * 0.85) + 0.012 * Math.sin(T * 2.1 + 1);
        drawOrb(c2, T, { cx: 500, cy: mode === 'done' ? 400 : 428, R: 238 * sizeSp.value * breath, cols, a: Math.max(0, alphaSp.value) });

        if (mode === 'run' && s) {
          digits.set(V.fmt.duration(leftOf(s)));
          timeEl.style.opacity = s.paused ? (0.5 + 0.4 * (0.5 + 0.5 * Math.cos(RT * 2.6))).toFixed(3) : U.clamp(timeSp.value, 0, 1).toFixed(3);
          ctx.rim.arc('main', { value: p, from: 0, color: col, width: 12, r: 478, glow: 0.9, track: true, head: true, smooth: false, alpha: s.paused ? 0.5 : 1 });
          runLab.style.color = U.rgba(U.lighten(col, 0.25), 0.95);
          // Sitzungspunkte
          const fcol = tone('focus', 0.55, T);
          for (let i = 0; i < dots.length; i++) {
            const d = dots[i];
            const isDone = i < s.done;
            const isCur = i === s.done && s.phase === 'focus';
            const isNext = i === s.done && s.phase === 'break';
            if (isDone) {
              d.dot.setAttribute('fill', fcol); d.dot.setAttribute('stroke', 'none'); d.dot.setAttribute('r', 8.5);
              d.halo.setAttribute('opacity', '0');
            } else if (isCur) {
              const pu = 0.5 + 0.5 * Math.sin(RT * (s.paused ? 1.2 : 2.4));
              d.dot.setAttribute('fill', '#fff'); d.dot.setAttribute('stroke', 'none'); d.dot.setAttribute('r', (8.5 + pu * 1.5).toFixed(2));
              d.halo.setAttribute('fill', col);
              d.halo.setAttribute('opacity', (0.18 + 0.22 * pu).toFixed(3));
            } else {
              d.dot.setAttribute('fill', 'none'); d.dot.setAttribute('r', 8.5);
              d.dot.setAttribute('stroke', isNext ? U.rgba('#ffffff', 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(RT * 1.6))) : 'rgba(255,255,255,.26)');
              d.halo.setAttribute('opacity', '0');
            }
          }
          texts(s);
        } else if (mode === 'setup') {
          timeEl.style.opacity = U.clamp(timeSp.value, 0, 1).toFixed(3);
        }
      });

      return {
        crown(dA) {
          if (mode !== 'setup') return;
          const i = CHOICES.indexOf(sel);
          choose(CHOICES[U.clamp(i + Math.sign(dA), 0, CHOICES.length - 1)]);
        },
        destroy() {
          if (mode === 'done' && st().last) { st().last.seen = true; V.store.save(); }
        },
      };
    },
  });
})();
