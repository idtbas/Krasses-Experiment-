/* VistoOS · faces/rings.js — „Ringe“: drei leuchtende Bögen wie Aktivitätsringe
 *
 *  außen Stunde, Mitte Minute, innen Sekunde (fließend mit jedem Bild, 90 Hz).
 *  Der Sekundenring „jagt“ sich selbst: in geraden Minuten wächst er, in ungeraden zieht das Ende nach –
 *  so gibt es nie einen harten Sprung. Uhrzeit digital in der Mitte.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const RAD = (a) => ((a - 90) * Math.PI) / 180;   // Uhrwinkel → Canvas

  V.css('frg', `
    .frg-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
    .frg-mid { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; transition: opacity .8s ease; }
    .frg-time { display: flex; justify-content: center; font-size: 15.5cqw; font-weight: 250; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; color: #fff; }
    .frg-date { margin-top: 1.6cqw; font-size: 2.9cqw; font-weight: 650; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.5); transition: color .5s ease; }
  `);

  // je Ring [Anfangsfarbe, Kopffarbe]; Reihenfolge Stunde, Minute, Sekunde
  const PALETTES = {
    activity: [['#E3003D', '#FF4F8B'], ['#6DD400', '#D4FF3A'], ['#00B7D9', '#6AF5FF']],
    aurora: [['#5B5CFF', '#46E6FF'], ['#9B4DFF', '#FF6FB5'], ['#FF5E9C', '#FFC07A']],
    mono: [['#4A4A50', '#FFFFFF'], ['#3C3C42', '#D6D6DC'], ['#323238', '#A9A9B2']],
  };
  function palette(name, accent) {
    if (name === 'accent') {
      return [
        [U.darken(accent, 0.45), U.lighten(accent, 0.12)],
        [U.darken(U.mix(accent, '#FF5E9C', 0.35), 0.45), U.lighten(U.mix(accent, '#FF5E9C', 0.35), 0.18)],
        [U.darken(U.mix(accent, '#FFFFFF', 0.25), 0.5), U.lighten(accent, 0.55)],
      ];
    }
    return PALETTES[name] || PALETTES.activity;
  }

  V.faces.register({
    id: 'rings',
    name: 'Ringe',
    order: 4,
    options: [
      { key: 'palette', label: 'Farben', type: 'choice', default: 'activity', values: [{ v: 'activity', label: 'Aktiv' }, { v: 'aurora', label: 'Aurora' }, { v: 'accent', label: 'Akzent' }, { v: 'mono', label: 'Graphit' }] },
      { key: 'seconds', label: 'Sekundenring', type: 'toggle', default: true },
      { key: 'marks', label: 'Kennbuchstaben', type: 'toggle', default: true },
      { key: 'date', label: 'Datum', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      let amb = false;
      const cv = U.el('canvas', { class: 'frg-cv' });
      const g = cv.getContext('2d');
      const mid = U.el('div', { class: 'frg-mid' });
      const timeEl = U.el('div', { class: 'frg-time' });
      const dateEl = U.el('div', { class: 'frg-date' });
      mid.append(timeEl, dateEl);
      root.append(cv, mid);
      const digits = V.faces.rollDigits(timeEl, { digitW: '0.58em', colonW: '0.27em' });

      let px = 0;
      function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        px = Math.max(200, Math.round((V.display.size || 360) * dpr));
        if (cv.width !== px) { cv.width = px; cv.height = px; }
      }
      size();

      const W = 60, RADII = [450, 384, 318];
      let pal = palette(o.palette, ctx.accent());
      // weiches Einfahren der Ringe beim Erscheinen
      const intro = V.spring(ctx.preview ? 1 : 0, { response: 0.9, bounce: 0.08 });
      if (!ctx.preview) intro.to(1);

      function ringPath(r, a0, a1) { g.beginPath(); g.arc(500, 500, r, RAD(a0), RAD(a1)); }

      function drawRing(i, v0, v1, cols) {
        const r = RADII[i];
        const [c0, c1] = cols;
        const w = amb ? 7 : W;
        // Spur
        g.lineCap = 'round';
        g.strokeStyle = U.rgba(c1, amb ? 0.1 : 0.15);
        g.lineWidth = w;
        g.beginPath(); g.arc(500, 500, r, 0, TAU); g.stroke();
        const span = Math.max(0, v1 - v0);
        if (span <= 0.0004) { drawCap(r, v0, c0, w); return; }
        const a0 = v0 * 360, a1 = v1 * 360;
        // Verlauf entlang des Rings: Anfang dunkler, Kopf hell
        const gr = g.createConicGradient ? g.createConicGradient(RAD(0), 500, 500) : null;
        let style = c1;
        if (gr) {
          const capF = (w / 2) / (TAU * r) * 1.4;
          gr.addColorStop(0, c0);
          gr.addColorStop(U.clamp(v0, 0, 1), c0);
          gr.addColorStop(U.clamp(v1, 0, 1), c1);
          gr.addColorStop(U.clamp(v1 + capF, 0, 1), c1);
          if (v1 + capF < 1) gr.addColorStop(1, c0);
          style = gr;
        }
        if (!amb) {
          // Leuchten: zwei weiche Lagen unter dem Ring
          g.globalAlpha = 0.13; g.strokeStyle = style; g.lineWidth = w + 34; ringPath(r, a0, a1); g.stroke();
          g.globalAlpha = 0.2; g.lineWidth = w + 14; ringPath(r, a0, a1); g.stroke();
          g.globalAlpha = 1;
        }
        g.strokeStyle = style;
        g.lineWidth = w;
        g.globalAlpha = amb ? 0.75 : 1;
        ringPath(r, a0, a1); g.stroke();
        g.globalAlpha = 1;
        // Kopf mit Schatten (überlappt den Anfang bei fast vollem Ring)
        if (!amb && span > 0.02) {
          const p = V.display.pt(a1, r);
          g.save();
          g.shadowColor = 'rgba(0,0,0,.65)';
          g.shadowBlur = 14;
          g.fillStyle = c1;
          g.beginPath(); g.arc(p.x, p.y, w / 2, RAD(a1) - Math.PI / 2, RAD(a1) + Math.PI / 2); g.fill();
          g.restore();
        }
      }
      function drawCap(r, v, c, w) {
        const p = V.display.pt(v * 360, r);
        g.fillStyle = c; g.globalAlpha = amb ? 0.7 : 1;
        g.beginPath(); g.arc(p.x, p.y, w / 2, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      function drawMark(i, ch) {
        // kleiner Kennbuchstabe am Ringanfang (12 Uhr), dunkel auf dem Ring
        const r = RADII[i];
        g.fillStyle = 'rgba(0,0,0,.62)';
        g.font = `800 ${Math.round(W * 0.42)}px 'Inter Tight', system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ch, 500 + 1, 500 - r + 1.5);
      }

      function draw(now) {
        const k = px / 1000;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, px, px);
        g.setTransform(k, 0, 0, k, 0, 0);
        const ms = now.getMilliseconds();
        const s = now.getSeconds() + ms / 1000;
        const m = now.getMinutes() + s / 60;
        const h = (now.getHours() % 12) + m / 60;
        const t = U.clamp(intro.value, 0, 1.2);
        const vals = [h / 12, m / 60, s / 60];
        // Stunde & Minute
        drawRing(0, 0, vals[0] * t, pal[0]);
        drawRing(1, 0, vals[1] * t, pal[1]);
        if (o.seconds && !amb) {
          // Jagd: gerade Minute wächst, ungerade läuft das Ende hinterher
          const odd = now.getMinutes() % 2 === 1;
          if (odd) drawRing(2, vals[2], 1, pal[2]); else drawRing(2, 0, vals[2] * t, pal[2]);
        }
        if (o.marks && !amb) { drawMark(0, 'H'); drawMark(1, 'M'); if (o.seconds) drawMark(2, 'S'); }
      }

      function style() {
        o = ctx.opts;
        pal = palette(o.palette, ctx.accent());
        dateEl.style.display = o.date ? '' : 'none';
        dateEl.style.color = U.rgba(pal[1][1], 0.85);
      }
      function minute(now) {
        digits.set(V.fmt.time(now));
        dateEl.textContent = V.fmt.WD_S[now.getDay()] + ' ' + now.getDate() + '. ' + V.fmt.MON_S[now.getMonth()].replace('.', '');
      }
      style();
      draw(V.time.now());
      const offR = V.on('display:resize', () => { size(); draw(V.time.now()); });

      return {
        minute,
        frame(dt, now) { draw(now); },
        setOptions() { style(); },
        ambient(on) { amb = on; mid.style.opacity = on ? '0.7' : '1'; draw(V.time.now()); },
        destroy() { offR(); intro.stop(); },
      };
    },
  });
})();
