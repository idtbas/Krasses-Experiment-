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

      // Leuchtpuffer in ¼ Auflösung, weichgezeichnet und unter die Ringe gelegt
      const gl = document.createElement('canvas');
      const gg = gl.getContext('2d');
      let canBlur = false;
      try { gg.filter = 'blur(2px)'; canBlur = gg.filter === 'blur(2px)'; gg.filter = 'none'; } catch (e) { canBlur = false; }
      let px = 0;
      function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        px = Math.max(200, Math.round((V.display.size || 360) * dpr));
        if (cv.width !== px) { cv.width = px; cv.height = px; }
        const gw = Math.max(60, Math.round(px / 4));
        if (gl.width !== gw) { gl.width = gw; gl.height = gw; }
      }
      size();

      const W = 60, RADII = [450, 384, 318];
      let pal = palette(o.palette, ctx.accent());
      // weiches Einfahren der Ringe beim Erscheinen
      const intro = V.spring(ctx.preview ? 1 : 0, { response: 0.9, bounce: 0.08 });
      if (!ctx.preview) intro.to(1);

      function arcPath(c, r, a0, a1) { c.beginPath(); c.arc(500, 500, r, RAD(a0), RAD(a1)); }
      /** Verlauf entlang des Rings: Anfang dunkler, Kopf hell */
      function gradient(c, R) {
        const [c0, c1] = R.cols;
        if (!c.createConicGradient) return c1;
        const gr = c.createConicGradient(RAD(0), 500, 500);
        const capF = (R.w / 2) / (TAU * R.r) * 1.4;
        gr.addColorStop(0, c0);
        gr.addColorStop(U.clamp(R.v0, 0, 1), c0);
        gr.addColorStop(U.clamp(R.v1, 0, 1), c1);
        gr.addColorStop(U.clamp(R.v1 + capF, 0, 1), c1);
        if (R.v1 + capF < 1) gr.addColorStop(1, c0);
        return gr;
      }

      function drawTrack(R) {
        g.lineCap = 'round';
        g.strokeStyle = U.rgba(R.cols[1], amb ? 0.1 : 0.15);
        g.lineWidth = R.w;
        g.beginPath(); g.arc(500, 500, R.r, 0, TAU); g.stroke();
      }
      function drawGlow(list) {
        const gs = gl.width / 1000;
        gg.setTransform(1, 0, 0, 1, 0, 0);
        gg.clearRect(0, 0, gl.width, gl.width);
        gg.setTransform(gs, 0, 0, gs, 0, 0);
        if (canBlur) gg.filter = 'blur(' + (gl.width / 90).toFixed(1) + 'px)';
        gg.lineCap = 'round';
        for (const R of list) {
          if (R.v1 - R.v0 <= 0.0004) continue;
          gg.strokeStyle = gradient(gg, R);
          gg.lineWidth = R.w + 26;
          arcPath(gg, R.r, R.v0 * 360, R.v1 * 360); gg.stroke();
        }
        gg.filter = 'none';
        g.globalAlpha = 0.42;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(gl, 0, 0, 1000, 1000);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }
      function drawBody(R) {
        const span = R.v1 - R.v0;
        const [c0, c1] = R.cols;
        g.lineCap = 'round';
        if (span <= 0.0004) {
          const p = V.display.pt(R.v0 * 360, R.r);
          g.fillStyle = c0; g.globalAlpha = amb ? 0.7 : 1;
          g.beginPath(); g.arc(p.x, p.y, R.w / 2, 0, TAU); g.fill();
          g.globalAlpha = 1;
          return;
        }
        const a0 = R.v0 * 360, a1 = R.v1 * 360;
        const st = gradient(g, R);
        g.strokeStyle = st;
        g.lineWidth = R.w;
        g.globalAlpha = amb ? 0.75 : 1;
        arcPath(g, R.r, a0, a1); g.stroke();
        g.globalAlpha = 1;
        // fast voller Ring: der Kopf wirft einen weichen Schatten auf den Anfang
        if (!amb && R.v1 > 0.955 && span > 0.1) {
          const fwd = a1 + (R.w * 0.35 / (TAU * R.r)) * 360;
          const p = V.display.pt(fwd, R.r);
          const sh = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R.w * 0.85);
          sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sh;
          g.beginPath(); g.arc(p.x, p.y, R.w * 0.85, 0, TAU); g.fill();
          g.strokeStyle = c1;
          arcPath(g, R.r, a1 - 5, a1); g.stroke();
        }
      }
      function drawMark(R, ch) {
        // kleiner Kennbuchstabe am Ringanfang (12 Uhr), dunkel auf dem Ring
        g.fillStyle = 'rgba(0,0,0,.62)';
        g.font = `800 ${Math.round(W * 0.42)}px 'Inter Tight', system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ch, 500 + 1, 500 - R.r + 1.5);
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
        const w = amb ? 7 : W;
        const list = [
          { r: RADII[0], w, v0: 0, v1: (h / 12) * t, cols: pal[0], ch: 'H' },
          { r: RADII[1], w, v0: 0, v1: (m / 60) * t, cols: pal[1], ch: 'M' },
        ];
        if (o.seconds && !amb) {
          // Jagd: in geraden Minuten wächst der Ring, in ungeraden läuft das Ende hinterher
          const odd = now.getMinutes() % 2 === 1;
          list.push({ r: RADII[2], w, v0: odd ? s / 60 : 0, v1: odd ? 1 : (s / 60) * t, cols: pal[2], ch: 'S' });
        }
        for (const R of list) drawTrack(R);
        if (!amb) drawGlow(list);
        for (const R of list) drawBody(R);
        if (o.marks && !amb) for (const R of list) drawMark(R, R.ch);
      }

      let lastQ = -1;
      function style() {
        o = ctx.opts;
        lastQ = -1;
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
        frame(dt, now) {
          // ohne Sekundenring (oder im Ruhemodus) bewegen sich die Ringe kaum: 10× bzw. 1× je Sekunde reicht
          if ((amb || !o.seconds) && !intro.moving) {
            const q = Math.floor(now.getTime() / (amb ? 1000 : 100));
            if (q === lastQ) return;
            lastQ = q;
          }
          draw(now);
        },
        setOptions() { style(); },
        ambient(on) { amb = on; mid.style.opacity = on ? '0.7' : '1'; draw(V.time.now()); },
        destroy() { offR(); intro.stop(); },
      };
    },
  });
})();
