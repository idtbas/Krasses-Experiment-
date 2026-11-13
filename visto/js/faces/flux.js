/* VistoOS · faces/flux.js — „Flux“: große Ziffern, in denen leuchtende Farbe langsam fließt
 *
 *  Canvas: ein Farbfeld aus weichen, wandernden Lichtflecken wird mit der Schrift maskiert
 *  (destination-in) und mit einem weichgezeichneten Leuchten (¼ Auflösung) hinterlegt.
 *  Ziffern wechseln mit einem sanften Auf-/Abgleiten; das Leuchten atmet kaum merklich.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const FAMILY = "'Inter Tight', system-ui, sans-serif";

  V.css('ffx', `
    .ffx-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
    .ffx-date { transition: opacity .6s ease; }
    .ffx-cx { position: absolute; left: 20%; right: 20%; top: 67.5%; text-align: center; font-size: 3.6cqw; font-weight: 560;
      color: rgba(255,255,255,.55); white-space: nowrap; transition: opacity .6s ease; }
  `);

  const PALETTES = {
    aurora: ['#46E6FF', '#6F7BFF', '#B46BFF', '#FF6FB5', '#FFB86B'],
    sunset: ['#FFC46B', '#FF7A59', '#FF3D7F', '#9D5CFF', '#FF9A4D'],
    ocean: ['#3DF5FF', '#1E7BFF', '#5EE6B0', '#4D4DFF', '#8FE3FF'],
    ember: ['#FFE07A', '#FF9A2E', '#FF453A', '#C2185B', '#FFB347'],
  };
  function palette(name, accent) {
    if (name === 'accent') return [accent, U.lighten(accent, 0.45), U.mix(accent, '#FF6FB5', 0.45), U.darken(accent, 0.25), U.mix(accent, '#46E6FF', 0.35)];
    return PALETTES[name] || PALETTES.aurora;
  }
  const WEIGHTS = { '300': 300, '600': 600, '860': 860 };

  V.faces.register({
    id: 'flux',
    name: 'Flux',
    order: 7,
    options: [
      { key: 'palette', label: 'Farbfluss', type: 'choice', default: 'aurora', values: [{ v: 'aurora', label: 'Aurora' }, { v: 'sunset', label: 'Abendrot' }, { v: 'ocean', label: 'Ozean' }, { v: 'ember', label: 'Glut' }, { v: 'accent', label: 'Akzent' }] },
      { key: 'weight', label: 'Stärke', type: 'choice', default: '600', values: [{ v: '300', label: 'Fein' }, { v: '600', label: 'Kräftig' }, { v: '860', label: 'Schwer' }] },
      { key: 'glow', label: 'Leuchten', type: 'toggle', default: true },
      { key: 'date', label: 'Datum', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      let amb = false;
      const cv = U.el('canvas', { class: 'ffx-cv' });
      const g = cv.getContext('2d');
      const date = V.ui.arcText({ text: '', r: 432, size: 26, weight: 650, spacing: 5.5, color: 'rgba(255,255,255,.5)' });
      date.el.classList.add('ffx-date');
      const cx = U.el('div', { class: 'ffx-cx' });
      root.append(cv, date.el, cx);

      // Arbeitsflächen: Farbfeld (= Ergebnis), Maske, Leuchten
      const field = document.createElement('canvas'), f = field.getContext('2d');
      const mask = document.createElement('canvas'), mk = mask.getContext('2d');
      const glow = document.createElement('canvas'), gl = glow.getContext('2d');
      let canBlur = false;
      try { gl.filter = 'blur(2px)'; canBlur = gl.filter === 'blur(2px)'; gl.filter = 'none'; } catch (e) { canBlur = false; }

      // Textbox in logischen Einheiten
      const BOX = { x: 40, y: 330, w: 920, h: 340 };
      let px = 0, k = 1;
      function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        px = Math.max(200, Math.round((V.display.size || 360) * dpr));
        k = px / 1000;
        if (cv.width !== px) { cv.width = px; cv.height = px; }
        const bw = Math.round(BOX.w * k), bh = Math.round(BOX.h * k);
        if (field.width !== bw || field.height !== bh) { field.width = mask.width = bw; field.height = mask.height = bh; }
        const gw = Math.max(40, Math.round(bw / 4)), gh = Math.max(16, Math.round(bh / 4));
        if (glow.width !== gw || glow.height !== gh) { glow.width = gw; glow.height = gh; }
      }
      size();

      // Satz: tabellarische Ziffernzellen
      let L = null;
      function layout() {
        const w = WEIGHTS[o.weight] || 600;
        mk.font = `${w} 100px ${FAMILY}`;
        let dw = 0;
        for (let d = 0; d <= 9; d++) dw = Math.max(dw, mk.measureText(String(d)).width);
        const colon = mk.measureText(':').width;
        const m0 = mk.measureText('0');
        const cap = (m0.actualBoundingBoxAscent || 72) / 100;
        const track = -0.03;
        const cell = dw / 100 + track, colW = colon / 100 + 0.04;
        const total = 4 * cell + colW;                       // em
        const size = Math.min(320, 860 / total);
        L = { w, size, cell, colW, cap, total };
      }

      // Zeichen mit Übergang: {ch, prev, t (0…1), sp}
      const chars = [];
      function setText(str, instant) {
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (!chars[i]) chars[i] = { ch, prev: null, t: 1 };
          const c = chars[i];
          if (c.ch === ch) continue;
          c.prev = c.ch; c.ch = ch;
          if (instant || ctx.preview) { c.t = 1; c.prev = null; continue; }
          c.t = 0;
          const sp = V.spring(0, { response: 0.8, bounce: 0.1 });
          sp.onUpdate((v) => { c.t = v; });
          const delay = (str.length - 1 - i) * 90;
          setTimeout(() => sp.to(1).then(() => { c.prev = null; c.t = 1; }), delay);
        }
        chars.length = str.length;
      }

      function drawMask() {
        const s = k;   // Pixel je logische Einheit
        mk.setTransform(1, 0, 0, 1, 0, 0);
        mk.clearRect(0, 0, mask.width, mask.height);
        mk.setTransform(s, 0, 0, s, -BOX.x * s, -BOX.y * s);
        mk.font = `${L.w} ${L.size}px ${FAMILY}`;
        mk.textAlign = 'center';
        mk.textBaseline = 'alphabetic';
        mk.fillStyle = '#fff';
        const base = 500 + (L.cap * L.size) / 2;
        let x = 500 - (L.total * L.size) / 2;
        for (const c of chars) {
          const cw = (c.ch === ':' ? L.colW : L.cell) * L.size;
          const mx = x + cw / 2;
          const t = c.t;
          if (c.prev !== null && t < 1) {
            const e = U.clamp(t, 0, 1.2);
            mk.globalAlpha = U.clamp(1 - e * 1.4, 0, 1);
            mk.fillText(c.prev, mx, base - e * L.size * 0.32);
            mk.globalAlpha = U.clamp(e * 1.25, 0, 1);
            mk.fillText(c.ch, mx, base + (1 - e) * L.size * 0.32);
          } else {
            mk.globalAlpha = 1;
            mk.fillText(c.ch, mx, base);
          }
          x += cw;
        }
        mk.globalAlpha = 1;
      }

      let T = Math.random() * 100;
      function drawField(cols) {
        const s = k;
        f.globalCompositeOperation = 'source-over';
        f.setTransform(1, 0, 0, 1, 0, 0);
        f.clearRect(0, 0, field.width, field.height);
        f.setTransform(s, 0, 0, s, -BOX.x * s, -BOX.y * s);
        // Grundton
        f.fillStyle = U.mix(cols[1], '#000000', 0.3);
        f.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
        // wandernde Lichtflecken
        const n = cols.length;
        for (let i = 0; i < n; i++) {
          const sp = 0.045 + i * 0.011;
          const x = 500 + Math.sin(T * sp * TAU + i * 1.7) * 330 + U.noise(T * 0.07, i) * 90;
          const y = 500 + Math.cos(T * sp * 0.8 * TAU + i * 2.3) * 120 + U.noise(T * 0.05, i + 9) * 50;
          const r = 260 + 70 * Math.sin(T * 0.11 + i);
          const gr = f.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, U.rgba(cols[i], 0.95));
          gr.addColorStop(0.55, U.rgba(cols[i], 0.4));
          gr.addColorStop(1, U.rgba(cols[i], 0));
          f.fillStyle = gr;
          f.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
        }
        // feiner heller Glanz, der langsam durch die Ziffern zieht
        const sx = 500 + Math.sin(T * 0.09) * 520;
        const sh = f.createLinearGradient(sx - 160, 300, sx + 160, 700);
        sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.13)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        f.fillStyle = sh;
        f.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
        // mit der Schrift ausstanzen
        f.setTransform(1, 0, 0, 1, 0, 0);
        f.globalCompositeOperation = 'destination-in';
        f.drawImage(mask, 0, 0);
        f.globalCompositeOperation = 'source-over';
      }

      function draw(dt) {
        T += dt * (amb ? 0 : 1);
        const cols = amb ? ['#8a8a90', '#6c6c72', '#9a9aa0', '#7a7a80', '#8a8a90'] : palette(o.palette, ctx.accent());
        drawMask();
        drawField(cols);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, px, px);
        const bx = Math.round(BOX.x * k), by = Math.round(BOX.y * k);
        if (o.glow && !amb) {
          gl.setTransform(1, 0, 0, 1, 0, 0);
          gl.clearRect(0, 0, glow.width, glow.height);
          if (canBlur) gl.filter = 'blur(' + Math.max(2, glow.width / 70).toFixed(1) + 'px)';
          gl.drawImage(field, 0, 0, glow.width, glow.height);
          gl.filter = 'none';
          const breathe = 0.5 + 0.08 * Math.sin(T * 0.7);
          g.globalAlpha = breathe;
          g.globalCompositeOperation = 'lighter';
          // etwas größer aufziehen, damit das Leuchten über die Ränder der Ziffern quillt
          const pad = 0.04;
          g.drawImage(glow, bx - field.width * pad, by - field.height * pad, field.width * (1 + 2 * pad), field.height * (1 + 2 * pad));
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 1;
        }
        g.globalAlpha = amb ? 0.42 : 1;
        g.drawImage(field, bx, by);
        g.globalAlpha = 1;
      }

      function style() {
        o = ctx.opts;
        layout();
        date.el.style.display = o.date ? '' : 'none';
        cx.style.display = o.date ? '' : 'none';
      }
      function minute(now, instant) {
        setText(V.fmt.time(now), instant);
        date.set(V.fmt.dateLong(now));
        V.faces.renderComplications(cx, { max: 2 });
      }
      style();
      minute(V.time.now(), true);
      draw(0);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (root.isConnected) { layout(); draw(0); } });
      const offR = V.on('display:resize', () => { size(); draw(0); });
      let cxT = 0;

      return {
        minute(now) { minute(now); },
        frame(dt) {
          if (!amb || chars.some((c) => c.prev !== null)) draw(dt);
          cxT += dt;
          if (cxT > 2) { cxT = 0; if (o.date) V.faces.renderComplications(cx, { max: 2 }); }
        },
        setOptions() { style(); draw(0); },
        ambient(on) { amb = on; date.el.style.opacity = on ? '0.4' : '1'; cx.style.opacity = on ? '0' : '1'; draw(0); },
        destroy() { offR(); },
      };
    },
  });
})();
