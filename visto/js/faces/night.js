/* VistoOS · faces/night.js — „Nacht“: minimale, gedimmte Uhr für den Nachttisch
 *
 *  Wenige, dünne, rote Ziffern; sonst bleibt das Display schwarz. Zum Schutz vor Einbrennen wandert
 *  die Uhrzeit jede Minute ein kleines Stück (weich überblendet). Ein einzelner Punkt am Rand zeigt
 *  die Minute, darunter auf Wunsch der nächste Wecker.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const TONES = { red: '#FF2D1A', amber: '#FF8A1F', moon: '#9FB4FF' };
  const LEVELS = { glow: 0.34, dusk: 0.52, clear: 0.78 };

  V.css('fnt', `
    .fnt-wrap { position: absolute; left: 0; right: 0; top: 50%; display: flex; flex-direction: column; align-items: center;
      pointer-events: none; transition: opacity 1.1s ease, transform 2.4s cubic-bezier(.4,0,.2,1); }
    .fnt-time { display: flex; align-items: baseline; font-size: 18cqw; font-weight: 180; letter-spacing: -.03em; line-height: 1;
      font-variant-numeric: tabular-nums; white-space: nowrap; }
    .fnt-colon { display: inline-block; width: .3em; text-align: center; transform: translateY(-.06em); }
    .fnt-sub { margin-top: 2.6cqw; display: flex; align-items: center; gap: 1.4cqw; font-size: 3.3cqw; font-weight: 500; letter-spacing: .04em; }
    .fnt-sub svg { width: 3.6cqw; height: 3.6cqw; }
    .fnt-dot { position: absolute; width: 1.3cqw; height: 1.3cqw; margin: -.65cqw 0 0 -.65cqw; border-radius: 50%;
      transition: left 1.2s ease, top 1.2s ease, opacity .8s ease; }
  `);

  /** nächster Wecker, falls eine App ihn bereitstellt (verschiedene Formen werden akzeptiert) */
  function nextAlarm() {
    const src = V.info.nextAlarm || V.info.alarm;
    if (typeof src !== 'function') return null;
    const a = V.safe(() => src());
    if (!a) return null;
    const d = a instanceof Date ? a : a.date || a.at || a.time || a.start || null;
    return d instanceof Date ? d : null;
  }

  V.faces.register({
    id: 'night',
    name: 'Nacht',
    order: 8,
    options: [
      { key: 'tone', label: 'Lichtfarbe', type: 'choice', default: 'red', values: [{ v: 'red', label: 'Rot' }, { v: 'amber', label: 'Bernstein' }, { v: 'moon', label: 'Mond' }] },
      { key: 'level', label: 'Helligkeit', type: 'choice', default: 'dusk', values: [{ v: 'glow', label: 'Glimmen' }, { v: 'dusk', label: 'Dämmer' }, { v: 'clear', label: 'Klar' }] },
      { key: 'dot', label: 'Minutenpunkt', type: 'toggle', default: true },
      { key: 'alarm', label: 'Nächster Wecker', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      let amb = false;
      const wrap = U.el('div', { class: 'fnt-wrap' });
      const time = U.el('div', { class: 'fnt-time' });
      const sub = U.el('div', { class: 'fnt-sub' });
      wrap.append(time, sub);
      const dot = U.el('div', { class: 'fnt-dot' });
      root.append(wrap, dot);
      let colonEl = null;
      let shift = { x: 0, y: 0 };
      const rnd = U.rng(Math.floor(V.time.ms() / 60000));

      function color() { return TONES[o.tone] || TONES.red; }
      function alpha() { return (LEVELS[o.level] || 0.52) * (amb ? 0.7 : 1); }

      function render(now) {
        const p = V.fmt.parts(now);
        time.innerHTML = '';
        time.append(U.el('span', { text: p.hh }));
        colonEl = U.el('span', { class: 'fnt-colon', text: ':' });
        time.append(colonEl, U.el('span', { text: p.mm }));
        const al = o.alarm ? nextAlarm() : null;
        if (al && al - now < 24 * 3600e3 && al > now) {
          sub.innerHTML = V.icon('alarm') + '<span>' + U.esc(V.fmt.time(al)) + '</span>';
        } else {
          sub.textContent = V.fmt.WD[now.getDay()];
        }
        const a = now.getMinutes() * 6 + now.getSeconds() * 0.1;
        const dp = V.display.pt(a, 474);
        dot.style.left = dp.x / 10 + 'cqw';
        dot.style.top = dp.y / 10 + 'cqw';
      }
      function paint() {
        o = ctx.opts;
        const c = color(), a = alpha();
        time.style.color = U.rgba(c, a);
        sub.style.color = U.rgba(c, a * 0.55);
        dot.style.background = U.rgba(c, a * 0.9);
        dot.style.display = o.dot ? '' : 'none';
        wrap.style.transform = `translate(${shift.x / 10}cqw, calc(-50% + ${shift.y / 10}cqw))`;
      }
      function drift() {
        // Einbrennschutz: kleine, zufällige Wanderung (±3,5 % des Durchmessers)
        if (ctx.preview) return;
        shift = { x: Math.round((rnd() - 0.5) * 70), y: Math.round((rnd() - 0.5) * 60) };
      }

      let busy = 0;
      function minute(now) {
        if (!colonEl || ctx.preview) { render(now); paint(); return; }
        // weich aus- und an neuer Stelle wieder einblenden
        clearTimeout(busy);
        wrap.style.opacity = '0';
        busy = setTimeout(() => { drift(); render(V.time.now()); paint(); wrap.style.opacity = '1'; }, 1150);
      }
      render(V.time.now());
      paint();

      return {
        minute,
        frame(dt, now) {
          // der Doppelpunkt atmet ganz langsam – das einzige, was sich bewegt
          if (!colonEl) return;
          const t = (now.getTime() / 1000) % 6;
          colonEl.style.opacity = amb ? '0.6' : (0.45 + 0.55 * (0.5 + 0.5 * Math.cos((t / 6) * Math.PI * 2))).toFixed(3);
        },
        setOptions() { render(V.time.now()); paint(); },
        ambient(on) { amb = on; paint(); },
        destroy() { clearTimeout(busy); },
      };
    },
  });
})();
