/* VistoOS · apps/timer.js — Timer (Referenz-App)
 *
 *  Einstellen: am Rand entlangdrehen wie bei einer Küchenuhr (eine Umdrehung = 60 Minuten)
 *              oder Schnellwahl antippen. Läuft: der Rand leert sich gegen den Uhrzeigersinn.
 *  Im Hintergrund: dünner Bogen am Displayrand, Hinweis bei Ablauf.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#FF9F0A';
  let S = null;   // gespeicherter Zustand {timers:[{id,label,total,end,paused,left}], last}

  function st() {
    if (!S) S = V.store.app('timer', { timers: [], last: 300 });
    return S;
  }
  function now() { return V.time.ms(); }
  function leftOf(t) { return t.paused ? t.left : Math.max(0, (t.end - now()) / 1000); }
  function active() { return st().timers.slice().sort((a, b) => leftOf(a) - leftOf(b))[0] || null; }

  function start(seconds, label) {
    seconds = Math.round(U.clamp(seconds, 1, 24 * 3600));
    const t = { id: U.uid('t'), label: label || 'Timer', total: seconds, end: now() + seconds * 1000, paused: false, left: seconds };
    st().timers.push(t);
    st().last = seconds;
    V.store.save();
    V.emit('timer:changed');
    return t;
  }
  function stop(id) {
    const s = st();
    s.timers = id ? s.timers.filter((t) => t.id !== id) : [];
    V.store.save();
    V.emit('timer:changed');
  }
  function pause(t) { if (t.paused) return; t.left = leftOf(t); t.paused = true; V.store.save(); V.emit('timer:changed'); }
  function resume(t) { if (!t.paused) return; t.end = now() + t.left * 1000; t.paused = false; V.store.save(); V.emit('timer:changed'); }
  function add(t, sec) {
    if (t.paused) t.left += sec; else t.end += sec * 1000;
    t.total += sec; V.store.save(); V.emit('timer:changed');
  }

  async function ring(t) {
    stop(t.id);
    const v = await V.notify.alert({
      title: t.label === 'Timer' ? 'Timer abgelaufen' : t.label,
      body: t.label === 'Timer' ? V.fmt.durationWords(t.total) + ' sind um.' : 'Timer · ' + V.fmt.durationWords(t.total),
      icon: 'timer', color: COLOR, alarm: 'chime',
      buttons: [{ label: '+1 Min', value: 'plus' }, { label: 'Stopp', kind: 'white', value: 'stop' }],
    });
    if (v === 'plus') start(60, t.label);
  }

  function bgTick() {
    const s = st();
    for (const t of s.timers.slice()) if (!t.paused && leftOf(t) <= 0) ring(t);
    // dünner Bogen am Rand, solange die App nicht offen ist
    const a = active();
    const appOpen = V.shell.app && V.shell.app.def.id === 'timer';
    if (a && !appOpen && V.shell.mode !== 'setup') {
      V.rim.arc('timer:bg', { value: leftOf(a) / a.total, from: 0, color: COLOR, width: 6, r: 492, glow: 0.7, alpha: a.paused ? 0.45 : 0.95, smooth: false });
    } else V.rim.remove('timer:bg');
  }

  V.apps.register({
    id: 'timer',
    name: 'Timer',
    icon: 'timer',
    color: COLOR,
    order: 10,
    keywords: ['timer', 'countdown', 'eieruhr'],
    keepAwake: () => !!active(),

    init() {
      setInterval(bgTick, 250);
      V.info.timer = () => { const a = active(); return a ? { left: leftOf(a), total: a.total, label: a.label, paused: a.paused } : null; };

      V.actions.register('timer.start', {
        desc: 'Startet einen Timer. seconds = Dauer in Sekunden, label = optionaler Name (z. B. „Pizza“).',
        params: { seconds: { type: 'number', description: 'Dauer in Sekunden' }, label: { type: 'string' } },
        required: ['seconds'],
        run(a) {
          const t = start(Number(a.seconds), a.label ? String(a.label) : undefined);
          return { say: `Timer für ${V.fmt.durationWords(t.total)} läuft.`, card: { type: 'icon', icon: 'timer', color: COLOR, title: V.fmt.duration(t.total), sub: t.label } };
        },
      });
      V.actions.register('timer.stop', { desc: 'Stoppt alle laufenden Timer.', run() { const n = st().timers.length; stop(); return n ? 'Timer gestoppt.' : 'Es läuft kein Timer.'; } });
      V.actions.register('timer.status', {
        desc: 'Liefert die Restzeit des nächsten Timers.',
        run() { const a = active(); return a ? `Noch ${V.fmt.durationWords(leftOf(a))}${a.paused ? ' (pausiert)' : ''}.` : 'Es läuft kein Timer.'; },
      });

      V.brain.intent({
        id: 'timer-stop', priority: 9,
        match: [/\btimer\b.*\b(stopp|stop|stoppen|aus|abbrechen|beenden|löschen)\b/, /\b(stopp|stoppe|beende|lösche)\b.*\btimer\b/],
        run() { return V.actions.run('timer.stop'); },
      });
      V.brain.intent({
        id: 'timer-status', priority: 9,
        match: [/\bwie (lange|viel zeit)\b.*\b(noch|timer)\b/, /\btimer\b.*\b(noch|restzeit|status)\b/],
        run() {
          const a = active();
          if (!a) return { say: 'Gerade läuft kein Timer.', emotion: 'neutral' };
          return { say: `Noch ${V.fmt.durationWords(leftOf(a))}.`, card: { type: 'big', text: V.fmt.duration(leftOf(a)), sub: a.label } };
        },
      });
      V.brain.intent({
        id: 'timer-start', priority: 8,
        match: (t) => {
          if (!/\b(timer|countdown|eieruhr|stoppe? die zeit|erinnere mich nach|zähl)\b/.test(t) && !/^\d+(?:\.\d+)? ?(min|minuten|sek|sekunden|stunden?)$/.test(t)) return null;
          const s = V.brain.parseDuration(t);
          return s ? { s, t } : null;
        },
        run(m, t, original) {
          const lm = original.match(/\bfür (?:die |den |das )?([A-ZÄÖÜ][\wäöüß]+)/) || original.match(/\b([A-ZÄÖÜ][\wäöüß]+)-?timer\b/i);
          const label = lm && !/^(Timer|Minuten?|Sekunden?|Stunden?)$/i.test(lm[1]) ? lm[1] : undefined;
          return V.actions.run('timer.start', { seconds: m.s, label });
        },
      });
    },

    create(ctx) {
      const root = ctx.root;
      ctx.title('Timer', { color: U.rgba(COLOR, 0.8) });
      let setSec = st().last || 300;
      let mode = active() ? 'run' : 'set';

      const center = U.el('div', { class: 'vos-center', style: { position: 'absolute', inset: '0' } });
      const big = U.el('div', { class: 'vos-num', style: { fontSize: '22cqw', fontWeight: 200, letterSpacing: '-.045em', lineHeight: 1, display: 'flex', marginTop: '-4cqw' } });
      const sub = U.el('div', { class: 'vos-label', style: { marginTop: '2.4cqw', color: U.rgba(COLOR, 0.85) } });
      const row = U.el('div', { style: { display: 'flex', gap: '4cqw', marginTop: '6cqw', alignItems: 'center' } });
      center.append(big, sub, row);
      const presets = U.el('div', { style: { position: 'absolute', left: 0, right: 0, top: '17cqw', display: 'flex', justifyContent: 'center', gap: '1.6cqw' } });
      root.append(presets, center);
      const digits = V.faces.rollDigits(big, { digitW: '0.58em', colonW: '0.28em' });

      function knobVal() { return U.clamp(setSec / 3600, 0, 1); }
      function render() {
        const a = active();
        mode = a ? 'run' : 'set';
        row.innerHTML = '';
        presets.innerHTML = '';
        if (mode === 'set') {
          digits.set(V.fmt.duration(setSec));
          sub.textContent = 'Am Rand drehen';
          for (const m of [1, 3, 5, 10, 25]) {
            const c = U.el('button', { class: 'vos-chip' + (setSec === m * 60 ? ' on' : ''), text: m + ' Min', attrs: { type: 'button' }, style: setSec === m * 60 ? { background: COLOR, color: '#1a0d00' } : null });
            V.ui.tap(c, () => { setSec = m * 60; render(); });
            presets.appendChild(c);
          }
          row.appendChild(V.ui.roundButton('play', { kind: 'lg', label: 'Start', style: { background: COLOR, color: '#1a0d00' }, onClick: () => { start(setSec); V.sound.play('success'); render(); } }));
          ctx.rim.arc('main', { value: knobVal(), from: 0, color: COLOR, width: 16, r: 462, glow: 1.1, track: true, head: true, smooth: true });
        } else {
          const t = a;
          sub.textContent = t.paused ? 'Pausiert' : t.label === 'Timer' ? 'Endet um ' + V.fmt.time(new Date(t.end)) : t.label;
          row.appendChild(V.ui.roundButton('close', { label: 'Abbrechen', onClick: () => { stop(t.id); render(); } }));
          row.appendChild(V.ui.roundButton(t.paused ? 'play' : 'pause', { kind: 'lg', label: 'Pause', style: { background: U.rgba(COLOR, 0.22), color: COLOR }, onClick: () => { t.paused ? resume(t) : pause(t); render(); } }));
          row.appendChild(V.ui.roundButton('plus', { label: '+1 Minute', onClick: () => { add(t, 60); render(); } }));
          const pl = U.el('div', { class: 'vos-small', style: { position: 'absolute', left: 0, right: 0, top: '20cqw', textAlign: 'center' }, text: V.fmt.durationWords(t.total) });
          presets.appendChild(pl);
        }
      }
      render();
      ctx.on('timer:changed', render);

      // Am Rand drehen = einstellen
      let acc = 0;
      V.ui.rimDrag(root, {
        start() { acc = 0; },
        drag(p, dA) {
          if (mode !== 'set') return;
          const d = dA - acc; acc = dA;
          const before = Math.round(setSec / 60);
          setSec = U.clamp(setSec + d * 10, 10, 3600 * 3);
          // auf volle Minuten einrasten ab 1 Minute
          const snapped = setSec >= 60 ? Math.round(setSec / 60) * 60 : Math.round(setSec / 10) * 10;
          if (Math.round(snapped / 60) !== before) { V.sound.play('tick'); V.haptic(3); }
          digits.set(V.fmt.duration(snapped));
          ctx.rim.arc('main', { value: U.clamp(snapped / 3600, 0, 1) });
          this._snap = snapped;
        },
        end() { if (mode === 'set' && this._snap) { setSec = this._snap; render(); } },
      }, { minR: 330 });

      ctx.onFrame(() => {
        if (mode !== 'run') return;
        const a = active();
        if (!a) { render(); return; }
        const l = leftOf(a);
        digits.set(V.fmt.duration(l));
        ctx.rim.arc('main', { value: l / a.total, from: 0, color: COLOR, width: 16, r: 462, glow: 1.2, track: true, head: true, smooth: false, alpha: a.paused ? 0.5 : 1 });
      });
      return {
        crown(dA) {
          if (mode !== 'set') return;
          setSec = U.clamp(Math.round((setSec + Math.sign(dA) * 60) / 60) * 60, 60, 3600 * 3);
          render();
        },
      };
    },
  });
})();
