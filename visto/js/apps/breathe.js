/* VistoOS · apps/breathe.js — Atmen: geführte Atemübung
 *
 *  Rhythmus: 4 s einatmen · 4 s halten · 6 s ausatmen.
 *  Mitte:  Blüte aus überlagerten, halbtransparenten Kreisen (Canvas, additiv). Sie öffnet sich und
 *          dreht beim Einatmen, ruht beim Halten und schließt sich beim Ausatmen.
 *  Rand:   füllt sich als Taktgeber (ein: füllen · halten: voll · aus: leeren); feiner Gesamtfortschritt innen.
 *  Text am oberen Bogen: „Einatmen / Halten / Ausatmen“, weich überblendet. Haptik-Impulse im Takt.
 *  Dauer 1, 3 oder 5 Minuten. Antippen pausiert. Abschluss mit freundlicher Zusammenfassung.
 *
 *  Aktionen: breathe.start {minutes}, breathe.stop
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const COLOR = '#63E6BE';
  const PETALS = ['#63E6BE', '#4FC9F0', '#7CF2C8', '#5AA8FF', '#8FF0D6', '#3FD3C8'];
  const PATTERN = [
    { k: 'in', d: 4, text: 'Einatmen' },
    { k: 'hold', d: 4, text: 'Halten' },
    { k: 'out', d: 6, text: 'Ausatmen' },
  ];
  const CYCLE = PATTERN.reduce((a, p) => a + p.d, 0);
  const CHOICES = [1, 3, 5];
  const LEAD = 3.2;            // Sekunden Vorlauf
  const KIND = [
    'Nimm die Ruhe mit in deinen Tag.',
    'Ein kleiner Moment nur für dich.',
    'Dein Atem ist jetzt ganz ruhig.',
    'Schön, dass du dir Zeit genommen hast.',
  ];
  let S = null, running = false;

  function st() {
    if (!S) S = V.store.app('breathe', { minutes: 3, stats: null, pending: null });
    return S;
  }
  const cyclesFor = (min) => Math.max(2, Math.round((min * 60) / CYCLE));
  function dayKey() { const d = V.time.now(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function today() {
    const s = st();
    if (!s.stats || s.stats.day !== dayKey()) s.stats = { day: dayKey(), sec: 0, sessions: 0, breaths: 0 };
    return s.stats;
  }
  function phaseAt(el) {
    const c = Math.floor(el / CYCLE);
    let x = el - c * CYCLE;
    for (let i = 0; i < PATTERN.length; i++) {
      const p = PATTERN[i];
      if (x < p.d || i === PATTERN.length - 1) return { c, i, p, x, f: U.clamp(x / p.d, 0, 1) };
      x -= p.d;
    }
    return null;
  }
  function minShort(sec) {
    const m = Math.max(1, Math.round(sec / 60));
    if (m < 60) return m + ' Min.';
    const h = Math.floor(m / 60), r = m % 60;
    return h + ' Std.' + (r ? ' ' + r + ' Min.' : '');
  }
  const minWord = (m) => m + (m === 1 ? ' Minute' : ' Minuten');

  function softBell(f, g, d) {
    if (!V.sound.enabled()) return;
    try { V.sound.bell(f, 0, g, d); } catch (e) { /* stumm */ }
  }

  /* --------------------------------------------------------------- Blüte */
  function drawFlower(c, F) {
    const { cx, cy, open, rot, sc, a } = F;
    if (a <= 0.004) return;
    const o = U.clamp(open, 0, 1.05);
    const d = U.lerp(5, 110, o) * sc;           // Abstand der Blütenblätter zur Mitte
    const pr = U.lerp(46, 126, o) * sc;         // Radius eines Blütenblatts
    c.globalCompositeOperation = 'lighter';
    // Hof
    const hr = (d + pr) * 1.7;
    let g = c.createRadialGradient(cx, cy, 0, cx, cy, hr);
    g.addColorStop(0, U.rgba(COLOR, (0.1 + 0.1 * o) * a));
    g.addColorStop(0.45, U.rgba('#3FB8E0', 0.05 * a));
    g.addColorStop(1, U.rgba('#3FB8E0', 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, hr, 0, TAU); c.fill();
    // zwei Lagen: außen sechs große, innen sechs kleinere, versetzt und gegenläufig
    const dim = U.lerp(0.42, 1, U.smoothstep(0, 0.6, o));   // geschlossen nicht überstrahlen
    for (let L = 0; L < 2; L++) {
      const dd = L ? d * 0.56 : d;
      const rr = L ? pr * 0.72 : pr;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const ang = U.rad((L ? -rot * 0.55 + 30 : rot) + (i * 360) / n);
        const x = cx + Math.sin(ang) * dd, y = cy - Math.cos(ang) * dd;
        const col = PETALS[(i + L * 3) % PETALS.length];
        const A = (L ? 0.17 : 0.24) * a * dim;
        g = c.createRadialGradient(x, y, rr * 0.05, x, y, rr);
        g.addColorStop(0, U.rgba(col, A * 0.35));
        g.addColorStop(0.62, U.rgba(col, A * 0.85));
        g.addColorStop(0.93, U.rgba(col, A * 1.25));
        g.addColorStop(1, U.rgba(col, 0));
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
      }
    }
    // zarter Kern
    g = c.createRadialGradient(cx, cy, 0, cx, cy, pr * 0.55);
    g.addColorStop(0, U.rgba('#E9FFF7', 0.16 * a * (0.4 + 0.6 * o)));
    g.addColorStop(1, U.rgba('#E9FFF7', 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, pr * 0.55, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  /* --------------------------------------------------------------- Stile */
  const CSS = `
  .br-cv { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .br-view { position: absolute; inset: 0; pointer-events: none; will-change: opacity, transform; }
  .br-view.on .vos-btn, .br-view.on .br-chip { pointer-events: auto; }
  .br-phase { opacity: 0; filter: blur(1.4cqw); transform: scale(.965); transform-origin: 50% 50%;
    transition: opacity 1s ease, filter 1s ease, transform 1.3s cubic-bezier(.2,.8,.2,1); pointer-events: none; }
  .br-phase.on { opacity: 1; filter: blur(0); transform: none; }
  .br-chip { position: absolute; height: 11.6cqw; min-width: 19cqw; padding: 0 4.4cqw; margin: -5.8cqw 0 0 -9.5cqw; border: 0; border-radius: 99cqw;
    display: flex; align-items: baseline; justify-content: center; gap: 1cqw; cursor: pointer;
    background: rgba(255,255,255,.085); color: #fff; font: 600 5cqw/11.6cqw var(--font); letter-spacing: -.02em;
    box-shadow: inset 0 0 0 .25cqw rgba(255,255,255,.06);
    transition: background .35s ease, color .3s ease, box-shadow .45s ease, transform .35s var(--spring); }
  .br-chip small { font-size: 2.9cqw; font-weight: 650; opacity: .6; letter-spacing: 0; }
  .br-chip.on { background: #63E6BE; color: #032A1F; box-shadow: 0 0 6cqw rgba(99,230,190,.45); }
  .br-chip.on small { opacity: .75; }
  .br-chip:active { transform: scale(.92); }
  .br-row { position: absolute; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 4cqw; }
  .br-txt { position: absolute; left: 12cqw; right: 12cqw; text-align: center; white-space: nowrap; pointer-events: none; }
  .br-left { font-size: 3.5cqw; font-weight: 560; color: rgba(255,255,255,.46); font-variant-numeric: tabular-nums; letter-spacing: .01em; transition: opacity .6s ease; }
  .br-h { font-size: 8.4cqw; font-weight: 300; letter-spacing: -.03em; line-height: 1; color: #fff; }
  .br-body { font-size: 4.2cqw; font-weight: 450; color: rgba(255,255,255,.66); line-height: 1.3; white-space: normal; }
  `;

  /* ---------------------------------------------------------------- App */
  V.apps.register({
    id: 'breathe',
    name: 'Atmen',
    icon: 'breathe',
    color: COLOR,
    order: 75,
    keywords: ['atmen', 'atemübung', 'atem', 'entspannen', 'meditation'],
    keepAwake: () => running,

    init() {
      function begin(min) {
        min = Math.round(U.clamp(Number(min) || st().minutes || 3, 1, 10));
        const s = st();
        if (CHOICES.includes(min)) s.minutes = min;
        s.pending = { minutes: min, ts: V.time.ms() };
        V.store.save();
        if (V.shell.app && V.shell.app.def.id === 'breathe') V.emit('breathe:start', { minutes: min });
        return min;
      }
      V.actions.register('breathe.start', {
        desc: 'Startet eine geführte Atemübung (4 s ein, 4 s halten, 6 s aus) auf dem Display. minutes = Dauer in Minuten (1, 3 oder 5; Standard 3).',
        params: { minutes: { type: 'number', description: 'Dauer in Minuten' } },
        required: [],
        run(a) {
          const min = begin(a && a.minutes);
          return {
            say: `Gern. Atme ${minWord(min) === '1 Minute' ? 'eine Minute' : minWord(min)} mit mir, ganz in Ruhe.`,
            card: { type: 'icon', icon: 'breathe', color: COLOR, title: min + ' Min.', sub: 'Atemübung · 4 · 4 · 6' },
            emotion: 'love',
            open: 'breathe',
          };
        },
      });
      V.actions.register('breathe.stop', {
        desc: 'Beendet die laufende Atemübung.',
        run() {
          st().pending = null;
          if (!running) return 'Gerade läuft keine Atemübung.';
          V.emit('breathe:stop');
          return 'Atemübung beendet.';
        },
      });

      V.brain.intent({
        id: 'breathe-stop', priority: 10,
        match: [/\b(atem\w*|atmen)\b.*\b(beenden|stopp|stoppen|stop|aus|abbrechen)\b/, /\b(beende|stoppe|stopp|stop)\b.*\b(atem\w*|atmen)\b/],
        run() { return V.actions.run('breathe.stop'); },
      });
      V.brain.intent({
        id: 'breathe-start', priority: 8,
        match: (t) => {
          if (/^(öffne|zeig)/.test(t)) return null;
          const calm = /(beruhig|gestresst|stress(?![a-zäöüß])|stressig|angespannt|nervös|aufgeregt|panik|runterkommen|entspann)/.test(t);
          const breath = /(atemübung|atemübungen|(?<![a-zäöüß])atmen(?![a-zäöüß])|durchatmen|(?<![a-zäöüß])atme(?![a-zäöüß])|meditation|meditier)/.test(t);
          if (!calm && !breath) return null;
          return { calm, s: V.brain.parseDuration(t) };
        },
        async run(m) {
          const min = m.s ? Math.round(m.s / 60) : m.calm ? 1 : undefined;
          const r = await V.actions.run('breathe.start', { minutes: min });
          if (m.calm) {
            const n = Math.round(U.clamp(Number(min) || st().minutes, 1, 10));
            r.say = `Ich bin bei dir. Lass uns ${n === 1 ? 'eine Minute' : minWord(n)} lang ruhig atmen.`;
          }
          return r;
        },
      });
    },

    create(ctx) {
      V.css('breathe', CSS);
      const root = ctx.root;
      let sel = CHOICES.includes(st().minutes) ? st().minutes : 3;
      const title = ctx.title('Atmen');

      /* Leinwand */
      const cv = U.el('canvas', { class: 'br-cv', attrs: { 'aria-hidden': 'true' } });
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

      /* Text am oberen Bogen: Rhythmus (Einstellen) und Atemphase (Übung) */
      const rhythm = V.ui.arcText({ text: '4 s ein · 4 s halten · 6 s aus', upper: false, r: 393, size: 27, weight: 560, spacing: 1.5, color: U.rgba(COLOR, 0.8) });
      rhythm.el.style.transition = 'opacity .6s ease';
      const phaseEls = [0, 1].map(() => {
        const a = V.ui.arcText({ text: '', upper: false, r: 412, size: 60, weight: 330, spacing: 1.5, color: '#ffffff', cls: 'br-phase' });
        return a;
      });
      root.append(rhythm.el, phaseEls[0].el, phaseEls[1].el);
      let phI = 0, phText = '';
      function setPhase(text) {
        if (text === phText) return;
        phText = text;
        const a = phaseEls[phI], b = phaseEls[1 - phI];
        phI = 1 - phI;
        if (text) { b.set(text); b.el.classList.add('on'); }
        a.el.classList.remove('on');
      }

      /* Ansichten */
      const views = { setup: U.el('div', { class: 'br-view' }), run: U.el('div', { class: 'br-view' }), done: U.el('div', { class: 'br-view' }) };
      root.append(views.setup, views.run, views.done);

      // — Einstellen
      const chips = CHOICES.map((m, i) => {
        const x = 500 + (i - 1) * 232, y = i === 1 ? 652 : 632;
        const b = U.el('button', { class: 'br-chip', attrs: { type: 'button', 'aria-label': minWord(m) }, style: { left: x / 10 + 'cqw', top: y / 10 + 'cqw' } },
          U.el('span', { text: String(m) }), U.el('small', { text: 'Min.' }));
        V.ui.tap(b, () => choose(m));
        views.setup.appendChild(b);
        return b;
      });
      const startBtn = V.ui.button('Starten', { icon: 'play', onClick: () => begin(sel), style: { background: COLOR, color: '#032A1F', boxShadow: '0 0 6cqw rgba(99,230,190,.35)', minWidth: '34cqw' } });
      views.setup.appendChild(U.el('div', { class: 'br-row', style: { top: '73.6cqw', height: '11.5cqw' } }, startBtn));

      // — Übung
      const leftEl = U.el('div', { class: 'br-txt br-left', style: { top: '80.2cqw' } });
      const pausedRow = U.el('div', { class: 'br-row', style: { top: '40.5cqw', height: '19cqw', gap: '5cqw' } },
        V.ui.roundButton('close', { label: 'Beenden', style: { width: '15cqw', height: '15cqw', background: '#202224', boxShadow: '0 0 0 .3cqw rgba(255,255,255,.08), 0 1cqw 4cqw rgba(0,0,0,.6)' }, onClick: () => end(false) }),
        V.ui.roundButton('play', { kind: 'lg', label: 'Weiter', style: { width: '19cqw', height: '19cqw', background: COLOR, color: '#032A1F' }, onClick: () => togglePause() }));
      views.run.append(leftEl, pausedRow);

      // — Geschafft
      const doneH = U.el('div', { class: 'br-txt br-h', style: { top: '46cqw' } });
      const doneBody = U.el('div', { class: 'br-txt br-body', style: { top: '55.4cqw' } });
      const doneLab = U.el('div', { class: 'br-txt vos-label', style: { top: '62cqw', color: U.rgba(COLOR, 0.9) } });
      const doneRow = U.el('div', { class: 'br-row', style: { top: '70.5cqw', height: '11.5cqw', gap: '3cqw' } },
        V.ui.button('Nochmal', { icon: 'reset', onClick: () => begin(sel) }),
        V.ui.button('Fertig', { kind: 'white', onClick: () => ctx.close() }));
      views.done.append(doneH, doneBody, doneLab, doneRow);

      /* Federn */
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
      const pauseSp = V.spring(0, { response: 0.45, bounce: 0.18 });
      pauseSp.onUpdate((v) => {
        pausedRow.style.opacity = U.clamp(v, 0, 1).toFixed(3);
        pausedRow.style.transform = `scale(${(0.8 + 0.2 * v).toFixed(4)})`;
        pausedRow.style.visibility = v < 0.004 ? 'hidden' : '';
        pausedRow.style.pointerEvents = v > 0.5 ? '' : 'none';
        leftEl.style.opacity = (1 - U.clamp(v, 0, 1)).toFixed(3);
      });
      pauseSp.set(0);
      const fy = V.spring(392, { response: 0.8, bounce: 0.12 });     // Mitte der Blüte (y)
      const fs = V.spring(1, { response: 0.8, bounce: 0.12 });       // Größe
      const fa = V.spring(0, { response: 0.9, bounce: 0 });          // Helligkeit
      const titleSp = V.spring(1, { response: 0.6, bounce: 0 });
      titleSp.onUpdate((v) => { title.el.style.opacity = U.clamp(v, 0, 1).toFixed(3); rhythm.el.style.opacity = (U.clamp(v, 0, 1) * (mode === 'setup' ? 1 : 0)).toFixed(3); });

      /* Ablauf */
      let mode = 'setup';          // setup · lead · run · paused · done
      let el = 0, lead = 0, total = cyclesFor(sel) * CYCLE, cycles = cyclesFor(sel), minutes = sel;
      let lastKey = '', tickAcc = 0, pausedFrom = 'run', summary = null;
      let open = 0.4, rotBase = Math.random() * 60;

      function showView(k) {
        for (const n in views) { views[n].classList.toggle('on', n === k); vs[n].to(n === k ? 1 : 0); }
      }
      function choose(m) {
        if (sel === m || mode !== 'setup') return;
        sel = m;
        st().minutes = m;
        V.store.save();
        renderSetup();
      }
      function renderSetup() {
        chips.forEach((b, i) => b.classList.toggle('on', CHOICES[i] === sel));
      }

      function begin(min) {
        st().pending = null;
        V.store.save();
        minutes = Math.round(U.clamp(Number(min) || sel, 1, 10));
        if (CHOICES.includes(minutes)) { sel = minutes; renderSetup(); }
        cycles = cyclesFor(minutes);
        total = cycles * CYCLE;
        el = 0; lead = 0; lastKey = ''; tickAcc = 0; summary = null;
        mode = 'lead';
        running = true;
        title.set('Atmen');
        showView('run');
        pauseSp.to(0);
        titleSp.to(0);
        setPhase('Ganz ruhig …');
        leftEl.textContent = 'Antippen pausiert';
        fy.to(500); fs.to(1); fa.to(1);
        softBell(392, 0.014, 1.6);
        V.haptic(8);
      }

      function togglePause() {
        if (mode === 'run' || mode === 'lead') {
          pausedFrom = mode;
          mode = 'paused';
          pauseSp.to(1);
          fa.to(0.32);
          setPhase('Pausiert');
          V.haptic(6);
        } else if (mode === 'paused') {
          mode = pausedFrom;
          pauseSp.to(0);
          fa.to(1);
          lastKey = '';          // Phase neu anzeigen
          if (mode === 'lead') setPhase('Ganz ruhig …');
          V.haptic(6);
        }
      }

      function record(sec, breaths, complete) {
        const d = today();
        d.sec += sec;
        d.breaths += breaths;
        if (complete || sec >= 20) d.sessions++;
        V.store.save();
      }

      function end(complete) {
        if (mode === 'setup' || mode === 'done') return;
        const breaths = complete ? cycles : Math.floor(el / CYCLE);
        const sec = complete ? total : el;
        running = false;
        if (!complete && sec < 20) {
          // zu kurz für eine Zusammenfassung: zurück zur Auswahl
          mode = 'setup';
          setPhase('');
          showView('setup');
          titleSp.to(1);
          fy.to(392); fs.to(1); fa.to(1);
          ctx.rim.remove('total');
          return;
        }
        record(sec, breaths, complete);
        summary = { sec, breaths, complete };
        mode = 'done';
        setPhase('');
        const d = today();
        doneH.textContent = complete ? 'Schön gemacht.' : 'Gut gemacht.';
        doneBody.textContent = KIND[(d.sessions + breaths) % KIND.length];
        doneLab.textContent = `${complete ? minWord(minutes) : minShort(sec)} · ${breaths} ${breaths === 1 ? 'Atemzug' : 'Atemzüge'}` + (d.sec > sec + 30 ? ` · heute ${minShort(d.sec)}` : '');
        showView('done');
        titleSp.to(1);
        title.set(complete ? 'Geschafft' : 'Atmen');
        fy.to(300); fs.to(0.62); fa.to(0.95);
        ctx.rim.remove('total');
        if (complete) {
          V.rim.pulse({ at: 0, color: COLOR, spread: 180, duration: 2.4 });
          if (V.sound.enabled()) try { [523.25, 659.25, 783.99].forEach((f, i) => V.sound.bell(f, i * 0.2, 0.022, 2.2)); } catch (e) { /* */ }
          V.haptic([10, 60, 10, 60, 18]);
        }
      }

      // Antippen pausiert (nicht auf Knöpfen, nicht in der Visto-Zone)
      root.addEventListener('click', (e) => {
        if (V.shell.swallowClick) return;
        if (e.target.closest && e.target.closest('button')) return;
        if (mode !== 'run' && mode !== 'lead') return;
        const p = V.display.toLogical(e.clientX, e.clientY);
        if (p.y > 868 && Math.abs(p.x - 500) < 175) return;
        togglePause();
      });

      ctx.on('breathe:start', (e) => begin(e && e.minutes));
      ctx.on('breathe:stop', () => end(false));

      /* Anfangszustand */
      for (const k in vs) vs[k].set(0);
      showView('setup');
      vs.setup.set(1);
      renderSetup();
      fa.to(0.85);

      // Sprachstart: Übung wartet schon
      const pend = st().pending;
      if (pend && V.time.ms() - pend.ts < 25000) { sel = CHOICES.includes(pend.minutes) ? pend.minutes : sel; ctx.timeout(() => begin(pend.minutes), 700); }

      /* Bild für Bild */
      let RT = 0;
      ctx.onFrame((dt) => {
        RT += dt;
        let target = open, pace = 0, paceAlpha = 1;
        if (mode === 'setup' || mode === 'done') {
          target = (mode === 'done' ? 0.62 : 0.46) + 0.1 * Math.sin(RT * 0.75);
          open += (target - open) * Math.min(1, dt * 3);
          rotBase += dt * 4;
          ctx.rim.arc('pace', { value: mode === 'done' ? 1 : 0, from: 0, color: COLOR, width: 12, r: 478, glow: 0.8, track: true, smooth: true, alpha: mode === 'done' ? 0.55 : 1 });
        } else if (mode === 'lead') {
          lead += dt;
          open += (0.02 - open) * Math.min(1, dt * 2.4);
          rotBase += dt * 3;
          ctx.rim.arc('pace', { value: 0, from: 0, color: COLOR, width: 12, r: 478, glow: 1, track: true, smooth: true, alpha: 1 });
          if (lead >= LEAD) { mode = 'run'; el = 0; lastKey = ''; leftEl.textContent = ''; }
        } else if (mode === 'run') {
          el += dt;
          if (el >= total) { end(true); return; }
          const ph = phaseAt(el);
          const e = V.ease.inOutSine(ph.f);
          target = ph.p.k === 'in' ? e : ph.p.k === 'hold' ? 1 + 0.025 * Math.sin(ph.x * 2.4) : 1 - e;
          open = target;
          pace = ph.p.k === 'in' ? e : ph.p.k === 'hold' ? 1 : 1 - e;
          if (ph.p.k === 'hold') paceAlpha = 0.78 + 0.22 * Math.cos(ph.x * Math.PI * 1.5);
          rotBase += dt * 5;
          // Phasenwechsel
          const key = ph.c + ':' + ph.i;
          if (key !== lastKey) {
            lastKey = key;
            setPhase(ph.p.text);
            if (ph.p.k === 'in') { V.haptic(12); softBell(523.25, 0.012, 1.4); tickAcc = 0; }
            else if (ph.p.k === 'hold') V.haptic(6);
            else { V.haptic([8, 50, 8]); softBell(392, 0.011, 1.8); }
          }
          // Haptik-Impulse beim Einatmen
          if (ph.p.k === 'in') { tickAcc += dt; if (tickAcc >= 0.5) { tickAcc -= 0.5; V.haptic(4); } }
          // Restzeit
          const left = 'noch ' + V.fmt.duration(total - el);
          if (leftEl.textContent !== left) leftEl.textContent = left;
          ctx.rim.arc('pace', { value: pace, from: 0, color: COLOR, width: 12, r: 478, glow: 1, track: true, head: false, smooth: false, alpha: paceAlpha });
          ctx.rim.arc('total', { value: el / total, from: 0, color: '#ffffff', width: 3, r: 494, glow: 0, track: false, smooth: false, alpha: 0.4 });
        } else if (mode === 'paused') {
          rotBase += dt * 1;
          const ph = pausedFrom === 'run' ? phaseAt(el) : null;
          pace = ph ? (ph.p.k === 'in' ? V.ease.inOutSine(ph.f) : ph.p.k === 'hold' ? 1 : 1 - V.ease.inOutSine(ph.f)) : 0;
          ctx.rim.arc('pace', { value: pace, from: 0, color: COLOR, width: 12, r: 478, glow: 0.6, track: true, smooth: false, alpha: 0.4 });
        }

        // zeichnen
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.clearRect(0, 0, W, W);
        c2.setTransform(W / 1000, 0, 0, W / 1000, 0, 0);
        const rot = rotBase + open * 55;
        drawFlower(c2, { cx: 500, cy: fy.value, open, rot, sc: fs.value, a: Math.max(0, fa.value) });
      });

      return {
        crown(dA) {
          if (mode !== 'setup') return;
          const i = CHOICES.indexOf(sel);
          choose(CHOICES[U.clamp(i + Math.sign(dA), 0, CHOICES.length - 1)]);
        },
        back() {
          if (mode === 'run' || mode === 'lead') { togglePause(); return true; }
          return false;
        },
        destroy() {
          if ((mode === 'run' || mode === 'paused') && el >= 20) record(el, Math.floor(el / CYCLE), false);
          running = false;
        },
      };
    },
  });
})();
