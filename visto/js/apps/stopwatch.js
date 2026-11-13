/* VistoOS · apps/stopwatch.js — Stoppuhr
 *
 *  Hundertstelgenau, rechnet nur mit Zeitstempeln: läuft im Hintergrund (und über Neustarts) weiter.
 *  Rand:  60 feine Sekundenstriche; ein leuchtender Punkt umrundet sie einmal pro Minute,
 *         überstrichene Striche glimmen gelb nach, jede volle Minute blitzt der Kranz kurz auf.
 *         Runden erscheinen als farbige Marken (grün = schnellste, rot = langsamste),
 *         die laufende Runde als feiner Bogen von der letzten Marke bis zum Punkt.
 *  Mitte: rollende Minuten/Sekunden, Hundertstel klein in Gelb.
 *  Runden-Liste: nach oben wischen oder Listen-Knopf – die Zeit wandert als Kopfzeile nach oben.
 *  Ohne offene App: kleiner gelber Lichtpunkt am Displayrand, solange die Stoppuhr läuft.
 *  Stimme: „Starte die Stoppuhr“, „Stopp die Stoppuhr“, „Runde“, „Stoppuhr zurücksetzen“, „Wie lange läuft die Stoppuhr?“
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#FFD60A', INK = '#1d1600', GREEN = '#32D74B', RED = '#FF453A';
  const TAU = Math.PI * 2;
  const R_TICK = 484;     // Außenkante der Sekundenstriche
  const R_DOT = 470;      // Bahn des Lichtpunkts
  const R_LAP = 428;      // Rundenmarken und Rundenbogen
  const YRGB = '255,214,10';

  /* ------------------------------------------------------------ Zustand */
  let S = null;
  function st() {
    if (!S) S = V.store.app('stopwatch', { running: false, start: 0, acc: 0, laps: [] });
    return S;
  }
  V.on('store:reset', () => { S = null; syncBg(); });

  const clock = () => Date.now();          // echte Zeit: unabhängig vom manuell gestellten Uhrzeit-Versatz
  function elapsed() { const s = st(); return Math.max(0, s.acc + (s.running ? clock() - s.start : 0)); }
  function changed() { V.store.save(); V.emit('stopwatch:changed'); syncBg(); }
  function start() { const s = st(); if (s.running) return false; s.start = clock(); s.running = true; changed(); return true; }
  function stop() { const s = st(); if (!s.running) return false; s.acc = elapsed(); s.running = false; changed(); return true; }
  function reset() { const s = st(); s.running = false; s.start = 0; s.acc = 0; s.laps = []; changed(); }
  function lap() {
    const s = st();
    if (!s.running || s.laps.length >= 999) return null;
    const e = elapsed();
    s.laps.push(e);
    changed();
    return e;
  }

  /** Rundendauern, schnellste/langsamste (ab zwei Runden), laufende Runde */
  function lapInfo(e) {
    const laps = st().laps;
    const d = laps.map((v, i) => v - (i ? laps[i - 1] : 0));
    let best = -1, worst = -1;
    if (d.length >= 2) {
      best = 0; worst = 0;
      d.forEach((v, i) => { if (v < d[best]) best = i; if (v > d[worst]) worst = i; });
      if (d[best] === d[worst]) best = worst = -1;
    }
    const cur = e - (laps.length ? laps[laps.length - 1] : 0);
    const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    return { d, best, worst, cur, avg };
  }

  /* ------------------------------------------------------------ Formate */
  function parts(ms) {
    const t = Math.floor(ms / 1000);
    return { h: Math.floor(t / 3600), m: Math.floor(t / 60) % 60, s: t % 60, cs: Math.floor(ms / 10) % 100 };
  }
  /** '00:12' bzw. '1:02:03' */
  function fmtMain(ms) { const p = parts(ms); return p.h ? p.h + ':' + U.pad(p.m) + ':' + U.pad(p.s) : U.pad(p.m) + ':' + U.pad(p.s); }
  /** '0:12,45' */
  function fmtShort(ms) { const p = parts(ms); return (p.h ? p.h + ':' + U.pad(p.m) : p.m) + ':' + U.pad(p.s) + ',' + U.pad(p.cs); }
  /** gesprochen: '12,4 Sekunden' / '3 Minuten und 12 Sekunden' */
  function words(ms) {
    if (ms < 60000) return V.fmt.num(Math.floor(ms / 100) / 10, 1) + ' Sekunden';
    return V.fmt.durationWords(Math.floor(ms / 1000));
  }

  /* --------------------------------------------- Hintergrund (Rand) */
  let bgOff = null;
  function appOpen() { return !!(V.shell && V.shell.app && V.shell.app.def.id === 'stopwatch'); }
  function syncBg() {
    const mode = V.shell && V.shell.mode;
    const want = st().running && !appOpen() && mode !== 'setup' && mode !== 'boot';
    if (want && !bgOff) bgOff = V.loop.add(bgFrame, 6);
    else if (!want && bgOff) { bgOff(); bgOff = null; V.rim.remove('stopwatch:bg'); }
  }
  function bgFrame() {
    const a = ((elapsed() / 1000) % 60) * 6;
    V.rim.arc('stopwatch:bg', { from: a - 14, value: 14 / 360, color: COLOR, width: 5, r: 478, glow: 0.8, alpha: 0.85, head: true, smooth: false });
  }

  /* ------------------------------------------------------- Befehle */
  function control(cmd) {
    const s = st();
    const e = elapsed();
    if (cmd === 'start') {
      if (s.running) return { say: `Die Stoppuhr läuft schon – ${words(e)}.`, card: { type: 'big', text: fmtShort(e), sub: 'Stoppuhr läuft' } };
      const resumed = e > 0;
      start();
      return { say: resumed ? 'Die Stoppuhr läuft weiter.' : 'Die Stoppuhr läuft.', card: { type: 'icon', icon: 'stopwatch', color: COLOR, title: resumed ? fmtShort(e) : 'Los geht’s', sub: 'Stoppuhr' }, emotion: 'happy', open: appOpen() ? undefined : 'stopwatch' };
    }
    if (cmd === 'stop') {
      if (!s.running) return e > 0 ? { say: `Die Stoppuhr ist schon angehalten – bei ${words(e)}.`, card: { type: 'big', text: fmtShort(e), sub: 'Angehalten' } } : 'Die Stoppuhr läuft gerade nicht.';
      stop();
      const f = elapsed();
      return { say: `Angehalten bei ${words(f)}.`, card: { type: 'big', text: fmtShort(f), sub: 'Stoppuhr angehalten' } };
    }
    if (cmd === 'lap') {
      if (!s.running) return 'Die Stoppuhr läuft gerade nicht.';
      const before = lapInfo(e).cur;
      lap();
      const n = st().laps.length;
      return { say: `Runde ${n}: ${words(before)}.`, card: { type: 'big', text: fmtShort(before), sub: 'Runde ' + n } };
    }
    if (cmd === 'reset') {
      if (e === 0 && !s.running) return 'Die Stoppuhr steht schon auf null.';
      reset();
      return { say: 'Die Stoppuhr steht wieder auf null.', card: { type: 'icon', icon: 'reset', color: COLOR, title: '00:00,00', sub: 'Zurückgesetzt' } };
    }
    // status
    if (e === 0 && !s.running) return { say: 'Die Stoppuhr steht auf null.', emotion: 'neutral' };
    const n = s.laps.length;
    return {
      say: `${s.running ? 'Die Stoppuhr läuft seit' : 'Angehalten bei'} ${words(e)}.${n ? ` Bisher ${n === 1 ? 'eine Runde' : n + ' Runden'}.` : ''}`,
      card: { type: 'big', text: fmtShort(e), sub: s.running ? 'Stoppuhr läuft' : 'Angehalten' },
    };
  }

  /* ------------------------------------------------------------ Stile */
  const CSS = `
.sw-cv { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.sw-main { position: absolute; left: 0; right: 0; top: 28.5cqw; display: flex; flex-direction: column; align-items: center;
  transform-origin: 50% 0; will-change: transform; pointer-events: none; z-index: 3; }
.sw-time { display: flex; align-items: baseline; justify-content: center; font-size: 19cqw; font-weight: 200; letter-spacing: -.045em;
  line-height: 1; font-variant-numeric: tabular-nums; color: #fff; white-space: nowrap; pointer-events: auto; cursor: pointer;
  transition: font-size .5s var(--spring); }
.sw-dig { display: flex; }
.sw-cs { font-size: .36em; font-weight: 300; letter-spacing: -.01em; color: ${COLOR}; width: 1.62em; margin-left: .05em; text-align: left;
  transition: color .4s; }
.sw[data-state="pause"] .sw-cs { color: rgba(255,255,255,.55); }
.sw[data-state="idle"] .sw-cs { color: rgba(255,255,255,.35); }
.sw-sub { height: 5cqw; margin-top: 2.6cqw; display: flex; align-items: center; justify-content: center; gap: 2.2cqw;
  font-size: 4cqw; font-weight: 500; color: rgba(255,255,255,.66); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sw-sub .vos-label { color: ${U.rgba(COLOR, 0.9)}; font-size: 2.9cqw; }
.sw-sub .vos-label.dim { color: rgba(255,255,255,.4); }
.sw-btns { position: absolute; inset: 0; pointer-events: none; z-index: 2; transform-origin: 50% 70%; }
.sw-btns > * { pointer-events: auto; }
.sw-btns.off > * { pointer-events: none; }
.sw-slot { position: absolute; transform: translate(-50%, -50%); }
.sw-slot.l { left: 26.5cqw; top: 69.5cqw; }
.sw-slot.c { left: 50cqw; top: 74cqw; }
.sw-slot.r { left: 73.5cqw; top: 69.5cqw; }
.sw-b { position: relative; transition: transform .28s var(--spring), background .35s, color .35s, opacity .35s, box-shadow .45s; }
.sw-b svg { transition: none; }
.sw-pri { width: 21cqw; height: 21cqw; background: ${COLOR}; color: ${INK}; box-shadow: 0 0 7cqw ${U.rgba(COLOR, 0.3)}; }
.sw-pri svg { width: 8.6cqw; height: 8.6cqw; }
.sw-pri.run { background: rgba(255,69,58,.2); color: #FF6B62; box-shadow: 0 0 0 rgba(0,0,0,0); }
.sw-side { width: 15cqw; height: 15cqw; background: rgba(255,255,255,.12); color: #fff; }
.sw-side svg { width: 6.2cqw; height: 6.2cqw; }
.sw-side.off { opacity: .3; pointer-events: none; }
.sw-badge { position: absolute; top: -.4cqw; right: -.4cqw; min-width: 5.6cqw; height: 5.6cqw; padding: 0 1.3cqw; border-radius: 99cqw;
  background: ${COLOR}; color: ${INK}; font: 750 3cqw/5.6cqw var(--font); font-variant-numeric: tabular-nums; text-align: center;
  transform: scale(0); transition: transform .45s var(--spring); box-shadow: 0 0 0 .7cqw #000; }
.sw-badge.on { transform: scale(1); }
.sw .sw-list.vos-rlist { padding: 29.5cqw 0 36cqw; opacity: 0; pointer-events: none; z-index: 1;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, transparent 24.5%, #000 30%, #000 80%, transparent 89%);
  mask-image: linear-gradient(to bottom, transparent 0, transparent 24.5%, #000 30%, #000 80%, transparent 89%); }
.sw .sw-list.vos-rlist.on { pointer-events: auto; }
.sw-lhead { text-align: center; margin: 0 auto 3.4cqw; font-size: 2.9cqw; font-weight: 650; letter-spacing: .16em; text-transform: uppercase;
  color: rgba(255,255,255,.42); white-space: nowrap; }
.sw-lhead b { color: ${U.rgba(COLOR, 0.9)}; font-weight: 650; }
.sw-row { position: relative; width: 72cqw; min-height: 12.6cqw; margin: 0 auto 1.9cqw; display: flex; align-items: center; gap: 2cqw;
  padding: 0 5.6cqw; border-radius: 99cqw; background: rgba(255,255,255,.07); transform-origin: 50% 50%; will-change: transform, opacity; }
.sw-row .n { font-size: 3.9cqw; font-weight: 600; color: rgba(255,255,255,.62); white-space: nowrap; }
.sw-row .tg { font-size: 2.4cqw; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
.sw-row .t { margin-left: auto; font-size: 5.4cqw; font-weight: 350; letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sw-row.cur { background: ${U.rgba(COLOR, 0.13)}; box-shadow: inset 0 0 0 .25cqw ${U.rgba(COLOR, 0.28)}; }
.sw-row.cur .n { color: ${COLOR}; }
.sw-row.best .tg, .sw-row.best .t { color: ${GREEN}; }
.sw-row.worst .tg, .sw-row.worst .t { color: #FF6B62; }
`;

  /* ------------------------------------------------------------- App */
  V.apps.register({
    id: 'stopwatch',
    name: 'Stoppuhr',
    icon: 'stopwatch',
    color: COLOR,
    order: 12,
    keywords: ['stoppuhr', 'stopuhr', 'stoppen', 'zeit messen', 'rundenzeit'],
    keepAwake: () => st().running,

    init() {
      V.info.stopwatch = () => {
        const s = st(), e = elapsed();
        return e > 0 || s.running ? { elapsed: e / 1000, running: s.running, laps: s.laps.length, text: fmtShort(e) } : null;
      };
      ['app:open', 'app:close', 'shell:mode'].forEach((ev) => V.on(ev, syncBg));
      syncBg();

      V.actions.register('stopwatch.control', {
        desc: 'Bedient die Stoppuhr. command: start (starten oder fortsetzen), stop (anhalten), lap (Rundenzeit nehmen), reset (auf null zurücksetzen), status (aktuelle Zeit abfragen).',
        params: { command: { type: 'string', enum: ['start', 'stop', 'lap', 'reset', 'status'], description: 'start | stop | lap | reset | status' } },
        required: ['command'],
        run(a) {
          const c = String(a.command || 'status').toLowerCase();
          return control(['start', 'stop', 'lap', 'reset', 'status'].includes(c) ? c : 'status');
        },
      });

      const SW = '(?:stoppuhr|stopuhr|stopp-uhr|stopp uhr|stop uhr)';
      const NB = '(?![a-zäöüß])';
      V.brain.intent({
        id: 'stopwatch-reset', priority: 9,
        match: [new RegExp(SW + '.*(?:zurücksetzen|zurück|reset|auf null|auf 0|nullen|löschen)'), new RegExp('(?:setz|setze|stell|stelle|lösch|lösche)' + NB + '.*' + SW + '.*(?:zurück|null)')],
        run: () => control('reset'),
      });
      V.brain.intent({
        id: 'stopwatch-stop', priority: 9,
        match: [new RegExp('^(?:bitte )?(?:stopp|stoppe|stop|halt|halte|pausiere|beende)' + NB + '.*' + SW), new RegExp(SW + '.*(?<![a-zäöüß])(?:stopp|stoppen|stop|anhalten|halt|pause|pausieren|aus|beenden)' + NB)],
        run: () => control('stop'),
      });
      V.brain.intent({
        id: 'stopwatch-lap', priority: 9,
        match: (t) => {
          if (new RegExp('(?:runde|zwischenzeit).*' + SW + '|' + SW + '.*(?:runde|zwischenzeit)').test(t)) return true;
          if (/^(?:neue |nächste )?(?:runde|zwischenzeit)$/.test(t) && st().running) return true;
          return null;
        },
        run: () => control('lap'),
      });
      V.brain.intent({
        id: 'stopwatch-status', priority: 9,
        match: [new RegExp('wie (?:lange|viel zeit).*' + SW), new RegExp(SW + '.*(?:stand|status|wie lange|wie viel)')],
        run: () => control('status'),
      });
      V.brain.intent({
        id: 'stopwatch-start', priority: 8,
        match: [new RegExp('(?<![a-zäöüß])(?:start|starte|starten|los|beginn|beginne|aktivier|aktiviere)' + NB + '.*' + SW), new RegExp(SW + '.*(?<![a-zäöüß])(?:start|starten|los|an|weiter|fortsetzen|laufen)' + NB)],
        run: () => control('start'),
      });
    },

    create(ctx) {
      V.css('stopwatch', CSS);
      const root = ctx.root;
      root.classList.add('sw');

      /* Leinwand für den Rand (scharf, max. 2× Pixeldichte) */
      const cv = U.el('canvas', { class: 'sw-cv', attrs: { 'aria-hidden': 'true' } });
      root.appendChild(cv);
      const g = cv.getContext('2d');
      let W = 0, K = 1;
      function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(64, Math.round((V.display.size || 360) * dpr));
        cv.width = cv.height = W;
        K = W / 1000;
      }
      size();
      ctx.on('display:resize', size);

      ctx.title('Stoppuhr', { color: U.rgba(COLOR, 0.78), r: 424, size: 25 });

      /* Runden-Liste (liegt unter der Zeit) */
      const lhead = U.el('div', { class: 'sw-lhead' });
      const list = V.ui.roundList({ items: [], header: lhead });
      list.el.classList.add('sw-list');
      root.appendChild(list.el);

      /* Zeit */
      const main = U.el('div', { class: 'sw-main' });
      const time = U.el('div', { class: 'sw-time', attrs: { role: 'timer', 'aria-label': 'Gemessene Zeit' } });
      const dig = U.el('div', { class: 'sw-dig' });
      const csEl = U.el('div', { class: 'sw-cs', text: ',00' });
      time.append(dig, csEl);
      const sub = U.el('div', { class: 'sw-sub' });
      const subL = U.el('span', { class: 'vos-label' });
      const subV = U.el('span');
      sub.append(subL, subV);
      main.append(time, sub);
      root.appendChild(main);
      const digits = V.faces.rollDigits(dig, { digitW: '0.585em', colonW: '0.29em' });

      /* Knöpfe – leicht gebogen angeordnet, folgen der Kreisform */
      const btns = U.el('div', { class: 'sw-btns' });
      const left = V.ui.roundButton('flag', { label: 'Runde', cls: 'sw-b sw-side', onClick: onLeft });
      const primary = V.ui.roundButton('play', { label: 'Start', cls: 'sw-b sw-pri', onClick: onPrimary });
      const right = V.ui.roundButton('list', { label: 'Runden anzeigen', cls: 'sw-b sw-side', onClick: () => showLaps(true) });
      const badge = U.el('span', { class: 'sw-badge' });
      right.appendChild(badge);
      btns.append(U.el('div', { class: 'sw-slot l' }, left), U.el('div', { class: 'sw-slot c' }, primary), U.el('div', { class: 'sw-slot r' }, right));
      root.appendChild(btns);

      function setIcon(b, name, label) {
        if (b._ic === name) return;
        const first = !b._ic;
        b._ic = name;
        b.setAttribute('aria-label', label);
        const old = b.querySelector('svg');
        const nu = U.frag(V.icon(name));
        if (old) old.replaceWith(nu); else b.insertBefore(nu, b.firstChild);
        if (first) return;
        const sp = V.spring(0, { response: 0.42, bounce: 0.32 });
        sp.onUpdate((v) => {
          nu.style.transform = `scale(${(0.3 + 0.7 * v).toFixed(3)}) rotate(${((1 - v) * -50).toFixed(1)}deg)`;
          nu.style.opacity = U.clamp(v * 1.7, 0, 1).toFixed(3);
        });
        sp.to(1);
      }

      /* ---------------------------------------------- Zustand → Oberfläche */
      let lapsOpen = false;
      function render() {
        const s = st(), e = elapsed();
        const state = s.running ? 'run' : e > 0 ? 'pause' : 'idle';
        root.dataset.state = state;
        setIcon(primary, s.running ? 'pause' : 'play', s.running ? 'Stopp' : 'Start');
        primary.classList.toggle('run', s.running);
        if (state === 'pause') setIcon(left, 'reset', 'Zurücksetzen'); else setIcon(left, 'flag', 'Runde');
        left.classList.toggle('off', state === 'idle');
        const n = s.laps.length;
        if (n) badge.textContent = String(n);
        badge.classList.toggle('on', n > 0);
        right.classList.toggle('off', n === 0);
        if (lapsOpen) { if (!n && e === 0) showLaps(false); else buildList(); }
      }

      let lastSubL = null, lastSubV = null, lastMain = '', lastCs = '';
      function setSub(l, v, dim) {
        if (l !== lastSubL) { subL.textContent = l; lastSubL = l; }
        subL.classList.toggle('dim', !!dim);
        if (v !== lastSubV) { subV.textContent = v; lastSubV = v; }
      }
      function updateText(e) {
        const m = fmtMain(e);
        if (m !== lastMain) {
          if (m.length !== lastMain.length) time.style.fontSize = m.length > 5 ? '14.6cqw' : '';
          digits.set(m);
          lastMain = m;
        }
        const c = ',' + U.pad(parts(e).cs);
        if (c !== lastCs) { csEl.textContent = c; lastCs = c; }
        const s = st();
        const info = lapInfo(e);
        if (s.laps.length) setSub('Runde ' + (s.laps.length + 1), fmtShort(info.cur));
        else if (s.running) setSub('', '');
        else if (e > 0) setSub('Angehalten', '');
        else setSub('Bereit', '', true);
        if (lapsOpen && curRowT) {
          const tx = fmtShort(info.cur);
          if (curRowT.textContent !== tx) curRowT.textContent = tx;
        }
      }

      /* ------------------------------------------------ Runden-Liste */
      let curRowT = null;
      function row(label, t, cls, tag) {
        return U.el('div', { class: 'sw-row' + (cls ? ' ' + cls : '') },
          U.el('span', { class: 'n', text: label }),
          tag ? U.el('span', { class: 'tg', text: tag }) : null,
          U.el('span', { class: 't', text: t }));
      }
      function buildList() {
        const s = st(), e = elapsed(), info = lapInfo(e);
        const n = s.laps.length;
        lhead.innerHTML = n
          ? `<b>${n}</b> ${n === 1 ? 'Runde' : 'Runden'} · Ø ${U.esc(fmtShort(info.avg))}`
          : 'Noch keine Runde';
        const items = [];
        const cur = row('Runde ' + (n + 1), fmtShort(info.cur), 'cur', s.running ? '' : 'Angehalten');
        curRowT = cur.querySelector('.t');
        items.push({ el: cur });
        for (let i = info.d.length - 1; i >= 0; i--) {
          const best = i === info.best, worst = i === info.worst;
          items.push({ el: row('Runde ' + (i + 1), fmtShort(info.d[i]), best ? 'best' : worst ? 'worst' : '', best ? 'Schnellste' : worst ? 'Langsamste' : '') });
        }
        list.setItems(items);
      }
      const page = V.spring(0, { response: 0.55, bounce: 0.1 });
      page.onUpdate((p) => {
        const q = U.clamp(p, 0, 1.2);
        main.style.transform = `translateY(${(-q * 16.5).toFixed(3)}cqw) scale(${(1 - 0.5 * q).toFixed(4)})`;
        sub.style.opacity = U.clamp(1 - q * 2.2, 0, 1).toFixed(3);
        btns.style.opacity = U.clamp(1 - q * 1.8, 0, 1).toFixed(3);
        btns.style.transform = `translateY(${(q * 9).toFixed(2)}cqw) scale(${(1 - 0.14 * q).toFixed(4)})`;
        list.el.style.opacity = U.clamp((q - 0.12) / 0.88, 0, 1).toFixed(3);
        list.el.style.transform = `translateY(${((1 - q) * 16).toFixed(2)}cqw)`;
      });
      function showLaps(on) {
        if (on === lapsOpen) return;
        if (on && !st().laps.length) return;
        lapsOpen = on;
        if (on) { buildList(); list.scrollTo(0); }
        list.el.classList.toggle('on', on);
        btns.classList.toggle('off', on);
        V.sound.play(on ? 'open' : 'close');
        page.to(on ? 1 : 0).then(() => { if (lapsOpen) list.refresh(); });
      }
      V.ui.tap(time, () => { if (lapsOpen) showLaps(false); else if (st().laps.length) showLaps(true); }, { sound: false });

      // nach oben wischen → Runden, nach unten → zurück
      V.gesture(root, {
        end(p) {
          if (!p.moved || p.cancelled || p.r0 > 400 || (p.y0 > 850 && Math.abs(p.x0 - 500) < 190)) return;
          if (Math.abs(p.dy) < Math.abs(p.dx) * 1.3) return;
          if (!lapsOpen && (p.dy < -70 || p.vy < -600)) showLaps(true);
          else if (lapsOpen && (p.dy > 70 || p.vy > 600) && list.scroller.scrollTop <= 2) showLaps(false);
        },
      }, { slop: 10 });

      /* ------------------------------------------------------ Bedienung */
      let rewinding = false, popT = 9;
      const rew = V.spring(0, { response: 0.8, bounce: 0.1 });
      function onPrimary() {
        const s = st();
        if (s.running) { stop(); V.haptic(12); } else { start(); V.haptic([6, 30, 6]); }
        render();
      }
      function onLeft() {
        const s = st(), e = elapsed();
        if (s.running) {
          const v = lap();
          if (v !== null) {
            popT = 0;
            V.rim.pulse({ at: ((v / 1000) % 60) * 6, color: COLOR, spread: 46, duration: 1.1 });
          }
        } else if (e > 0) {
          beginRewind();
          reset();
        }
        render();
      }

      /* ------------------------------------------------- Zeichnen (90 Hz) */
      let dispA = 0, lastE = 0, lastMin = -1, flash = 0;
      function beginRewind() {
        if (dispA < 0.5) return;
        rew.set(dispA);
        rewinding = true;
        rew.to(0).then(() => { rewinding = false; });
      }
      const ya = (a) => `rgba(${YRGB},${a.toFixed(3)})`;
      const wa = (a) => `rgba(255,255,255,${a.toFixed(3)})`;
      function pt(a, r) { const t = U.rad(a); return { x: 500 + Math.sin(t) * r, y: 500 - Math.cos(t) * r }; }

      function draw(dt, t, e) {
        const s = st();
        if (!rewinding && e === 0 && lastE > 0) beginRewind();     // z. B. per Stimme zurückgesetzt
        lastE = e;
        dispA = rewinding ? Math.max(0, rew.value) : ((e / 1000) % 60) * 6;
        const minute = Math.floor(e / 60000);
        if (lastMin >= 0 && minute > lastMin && s.running) flash = 1;
        lastMin = minute;
        flash *= Math.exp(-dt * 2.4);
        popT += dt;
        const active = e > 0 || rewinding;

        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, W, W);
        g.setTransform(K, 0, 0, K, 0, 0);
        g.lineCap = 'round';

        // Sekundenstriche
        for (let i = 0; i < 60; i++) {
          const a = i * 6;
          const major = i % 5 === 0;
          const behind = dispA - a;
          const lit = active && behind >= -0.001;
          const d = Math.abs(U.angDiff(dispA, a));
          const near = Math.exp(-(d * d) / 55);
          const len = (major ? 27 : 15) * (1 + 0.5 * near * (active ? 1 : 0.4));
          let alpha;
          if (lit) alpha = (major ? 0.7 : 0.46) + 0.5 * Math.exp(-behind / 30);
          else alpha = (major ? 0.5 : 0.2) + 0.4 * near * (active ? 1 : 0.45);
          alpha = Math.min(1, alpha + flash * 0.5);
          // Visto-Zone unten: Striche treten zurück
          alpha *= 1 - 0.68 * Math.exp(-Math.pow((a - 180) / 13, 2));
          const sn = Math.sin(U.rad(a)), cn = Math.cos(U.rad(a));
          g.strokeStyle = lit ? ya(alpha) : wa(alpha);
          g.lineWidth = major ? 4.4 : 2.5;
          g.beginPath();
          g.moveTo(500 + sn * (R_TICK - len), 500 - cn * (R_TICK - len));
          g.lineTo(500 + sn * R_TICK, 500 - cn * R_TICK);
          g.stroke();
        }
        if (flash > 0.02) {
          g.strokeStyle = ya(0.22 * flash);
          g.lineWidth = 30;
          g.beginPath(); g.arc(500, 500, R_TICK - 14, 0, TAU); g.stroke();
        }

        // laufende Runde: Bogen von der letzten Marke bis zum Punkt
        const n = s.laps.length;
        const info = n ? lapInfo(e) : null;
        if (n && active && !rewinding) {
          const la = ((s.laps[n - 1] / 1000) % 60) * 6;
          if (info.cur >= 60000) {
            g.strokeStyle = ya(0.16); g.lineWidth = 3;
            g.beginPath(); g.arc(500, 500, R_LAP, 0, TAU); g.stroke();
          } else {
            const span = (info.cur / 1000) * 6;
            if (span > 0.3) V.rim.tail(g, 500, 500, R_LAP, la, la + span, COLOR, 3.2, 0.75, 0.08);
          }
        }
        // Rundenmarken
        if (n && !rewinding) {
          for (let i = Math.max(0, n - 60); i < n; i++) {
            const a = ((s.laps[i] / 1000) % 60) * 6;
            const col = i === info.best ? GREEN : i === info.worst ? RED : '#ffffff';
            const isNew = i === n - 1;
            const k = isNew ? V.ease.outBack(U.clamp(popT / 0.45, 0, 1)) : 1;
            const sn = Math.sin(U.rad(a)), cn = Math.cos(U.rad(a));
            const r0 = R_LAP - 9 * k, r1 = R_LAP + 9 * k;
            g.globalAlpha = (col === '#ffffff' ? 0.75 : 1) * (isNew ? 1 : 0.92);
            g.strokeStyle = col; g.lineWidth = 6;
            g.beginPath(); g.moveTo(500 + sn * r0, 500 - cn * r0); g.lineTo(500 + sn * r1, 500 - cn * r1); g.stroke();
            if (col !== '#ffffff') {
              g.globalAlpha = 0.28; g.lineWidth = 16;
              g.beginPath(); g.moveTo(500 + sn * r0, 500 - cn * r0); g.lineTo(500 + sn * r1, 500 - cn * r1); g.stroke();
            }
            g.globalAlpha = 1;
            if (isNew && popT < 0.6) {
              const q = popT / 0.6;
              const p = pt(a, R_LAP);
              g.fillStyle = (col === '#ffffff' ? ya : (x) => U.rgba(col, x))((1 - q) * (1 - q) * 0.55);
              g.beginPath(); g.arc(p.x, p.y, 8 + 26 * V.ease.outCubic(q), 0, TAU); g.fill();
            }
          }
        }

        // Lichtpunkt mit Schweif
        const p = pt(dispA, R_DOT);
        if (active && dispA > 0.5) V.rim.tail(g, 500, 500, R_DOT, rewinding ? dispA : Math.max(dispA - 54, e < 60000 ? 0 : -400), dispA, COLOR, 5, 0.85, 0);
        const breathe = s.running || rewinding ? 1 : active ? 0.62 + 0.38 * Math.sin(t * 2.8) : 0.5 + 0.2 * Math.sin(t * 1.6);
        const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 46);
        halo.addColorStop(0, ya(0.6 * breathe));
        halo.addColorStop(0.35, ya(0.22 * breathe));
        halo.addColorStop(1, ya(0));
        g.fillStyle = halo;
        g.beginPath(); g.arc(p.x, p.y, 46, 0, TAU); g.fill();
        g.fillStyle = active ? '#fff' : 'rgba(255,248,214,.9)';
        g.beginPath(); g.arc(p.x, p.y, 8.5, 0, TAU); g.fill();
        g.strokeStyle = ya(0.9 * breathe); g.lineWidth = 2.5;
        g.beginPath(); g.arc(p.x, p.y, 11, 0, TAU); g.stroke();
      }

      ctx.onFrame((dt, t) => {
        const e = elapsed();
        updateText(e);
        draw(dt, t, e);
      });
      ctx.on('stopwatch:changed', render);
      render();
      updateText(elapsed());

      return {
        crown(dA) { if (lapsOpen) list.crown(dA); },
        back() { if (lapsOpen) { showLaps(false); return true; } return false; },
        params(p) { if (p && p.laps) showLaps(true); },
      };
    },
  });
})();
