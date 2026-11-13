/* VistoOS · faces/stack.js — „Stapel“: Stunden über Minuten in riesigen Ziffern
 *
 *  Jede Zeile nutzt die Kreisbreite auf ihrer Höhe: Schriftgröße wird aus der Kreissehne an der
 *  Außenkante der Ziffern berechnet (gemessen mit der echten Schrift und Stärke).
 *  Ziffern rollen beim Wechsel wie ein Zählwerk (Einer zuerst, Feder mit leichter Bewegungsunschärfe).
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const FAMILY = "'Inter Tight', system-ui, sans-serif";

  V.css('fst', `
    .fst-row { position: absolute; left: 0; right: 0; overflow: hidden; display: flex; justify-content: center;
      font-family: ${FAMILY}; line-height: 1; white-space: nowrap; pointer-events: none;
      transition: color .5s ease, opacity .8s ease, -webkit-text-stroke-color .5s ease; }
    .fst-slot { position: relative; display: block; height: 100%; flex: none; }
    .fst-ch { position: absolute; left: 0; right: 0; text-align: center; will-change: transform, opacity, filter; }
    .fst-row.fst-outline { color: transparent !important; text-shadow: none !important; }
    .fst-date { transition: opacity .6s ease; }
  `);

  const mcv = document.createElement('canvas').getContext('2d');
  /** Maße der Ziffern bei 100 px: Zellenbreite, Ziffernhöhe, Grundlinie in der Zeilenbox (alles in em) */
  function metrics(weight) {
    mcv.font = `${weight} 100px ${FAMILY}`;
    let w = 0, asc = 0, desc = 0;
    for (let d = 0; d <= 9; d++) {
      const m = mcv.measureText(String(d));
      w = Math.max(w, m.width);
      asc = Math.max(asc, m.actualBoundingBoxAscent || 72);
      desc = Math.max(desc, m.actualBoundingBoxDescent || 1);
    }
    const m0 = mcv.measureText('0');
    const fa = m0.fontBoundingBoxAscent || 96.9, fd = m0.fontBoundingBoxDescent || 24.2;
    const base = (100 - (fa + fd)) / 2 + fa;    // Grundlinie in einer Zeilenbox mit line-height 1
    return { cell: w / 100, cap: asc / 100, desc: desc / 100, base: base / 100 };
  }

  /** größte Schrift, bei der zwei Ziffern oberhalb (bzw. unterhalb) der Mitte in den Kreis passen */
  function solve(M, gap, margin, track) {
    const W = (s) => (2 * M.cell + track) * s;
    let lo = 60, hi = 700;
    for (let i = 0; i < 30; i++) {
      const s = (lo + hi) / 2;
      const yTop = 500 - gap / 2 - M.cap * s;               // obere Kante der Stundenziffern
      const ok = yTop > 40 && V.display.chord(yTop) - 2 * margin >= W(s);
      if (ok) lo = s; else hi = s;
    }
    return lo;
  }

  const WEIGHTS = { '100': 100, '250': 250, '450': 450, '800': 800 };

  V.faces.register({
    id: 'stack',
    name: 'Stapel',
    order: 3,
    options: [
      { key: 'color', label: 'Farbe', type: 'color', default: 'accent' },
      { key: 'weight', label: 'Stärke', type: 'choice', default: '250', values: [{ v: '100', label: 'Hauch' }, { v: '250', label: 'Fein' }, { v: '450', label: 'Klar' }, { v: '800', label: 'Kräftig' }] },
      { key: 'mode', label: 'Darstellung', type: 'choice', default: 'duo', values: [{ v: 'duo', label: 'Zweiklang' }, { v: 'mono', label: 'Einfarbig' }, { v: 'outline', label: 'Kontur' }] },
      { key: 'date', label: 'Datum', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      let amb = false;
      const rows = [0, 1].map((i) => U.el('div', { class: 'fst-row fst-r' + i }));
      const date = V.ui.arcText({ text: '', r: 463, size: 25, weight: 650, spacing: 5, color: 'rgba(255,255,255,.5)' });
      date.el.classList.add('fst-date');
      root.append(rows[0], rows[1], date.el);

      let L = null;              // Layout {s, cell, cap, base, ...}
      const slots = [[], []];    // je Zeile zwei Ziffernplätze {el, ch, cur}
      let shown = ['', ''];

      function layout() {
        o = ctx.opts;
        const weight = WEIGHTS[o.weight] || 250;
        const M = metrics(weight);
        const track = -0.035;                       // em, enger Satz
        const gap = 26, margin = 30;
        const s = solve(M, gap, margin, track);
        const pad = 0.1 * s;                         // weicher Rand: hier ein- und ausrollende Ziffern verblassen
        L = { s, M, track, gap, pad, weight };
        rows.forEach((row, i) => {
          const digitTop = i === 0 ? 500 - gap / 2 - M.cap * s : 500 + gap / 2;
          row.style.top = (digitTop - pad) / 10 + 'cqw';
          row.style.height = (M.cap * s + pad * 2) / 10 + 'cqw';
          const pc = pad / 10 + 'cqw';
          const mask = `linear-gradient(to bottom, transparent 0, #000 ${pc}, #000 calc(100% - ${pc}), transparent 100%)`;
          row.style.webkitMaskImage = mask; row.style.maskImage = mask;
          row.style.fontSize = s / 10 + 'cqw';
          row.style.fontWeight = weight;
          row.style.webkitTextStroke = '';
          for (let k = 0; k < 2; k++) {
            if (!slots[i][k]) {
              const el = U.el('span', { class: 'fst-slot' });
              row.appendChild(el);
              slots[i][k] = { el, ch: null, cur: null };
            }
            const sl = slots[i][k];
            sl.el.style.width = M.cell + 'em';
            sl.el.style.marginRight = k === 0 ? track + 'em' : '0';     // enger Satz zwischen den Ziffern
            // Zeichen so verschieben, dass die Ziffernoberkante bei pad liegt
            const off = ((pad - (M.base - M.cap) * s) / 10) + 'cqw';
            sl.off = off;
            for (const c of sl.el.children) c.style.top = off;
          }
        });
        paint();
      }

      function paint() {
        const col = ctx.color();
        const glow = U.rgba(col.length === 7 ? col : '#ffffff', 0.32);
        const stroke = (0.28 + (L ? L.weight : 250) / 1600).toFixed(3) + 'cqw';
        const mode = amb ? 'outline' : o.mode;
        const setRow = (row, color, outline, glowOn) => {
          row.classList.toggle('fst-outline', outline);
          row.style.color = color;
          row.style.webkitTextStroke = outline ? `${stroke} ${color}` : '';
          row.style.textShadow = glowOn && !outline ? `0 0 .09em ${glow}` : 'none';
        };
        if (mode === 'duo') { setRow(rows[0], '#ffffff', false, false); setRow(rows[1], col, false, true); }
        else if (mode === 'mono') { setRow(rows[0], col, false, true); setRow(rows[1], col, false, true); }
        else { setRow(rows[0], '#ffffff', true, false); setRow(rows[1], col, amb, true); }
        rows.forEach((r) => (r.style.opacity = amb ? '0.62' : '1'));
        date.el.style.display = o.date ? '' : 'none';
        date.el.style.opacity = amb ? '0.4' : '1';
      }

      /** eine Ziffer rollen lassen */
      function roll(sl, ch, delay, instant) {
        if (sl.ch === ch) return;
        const prev = sl.cur;
        sl.ch = ch;
        const nu = U.el('span', { class: 'fst-ch', text: ch, style: { top: sl.off } });
        sl.el.appendChild(nu);
        sl.cur = nu;
        if (!prev || instant || ctx.preview) { if (prev) prev.remove(); return; }
        const run = () => {
          const sp = V.spring(0, { response: 0.7, bounce: 0.14 });
          sp.onUpdate((t, s) => {
            const blur = Math.min(0.03, Math.abs(s.velocity) * 0.006);
            nu.style.transform = `translateY(${((1 - t) * 1.04).toFixed(4)}em)`;
            nu.style.filter = blur > 0.002 ? `blur(${blur.toFixed(3)}em)` : '';
            prev.style.transform = `translateY(${(-t * 1.04).toFixed(4)}em)`;
            prev.style.opacity = U.clamp(1 - t * 1.1, 0, 1).toFixed(3);
            prev.style.filter = blur > 0.002 ? `blur(${blur.toFixed(3)}em)` : '';
          });
          nu.style.transform = 'translateY(1.04em)';
          sp.to(1).then(() => { prev.remove(); nu.style.filter = ''; nu.style.transform = ''; });
        };
        nu.style.transform = 'translateY(1.04em)';
        if (delay) setTimeout(run, delay); else run();
      }

      function setTime(now, instant) {
        const p = V.fmt.parts(now);
        const hh = V.fmt.h24() ? p.hh : U.pad(p.h);
        const strs = [hh, p.mm];
        strs.forEach((str, i) => {
          if (str === shown[i] && !instant) return;
          // Einer zuerst, dann Zehner – wie ein Zählwerk
          roll(slots[i][1], str[1], 0, instant);
          roll(slots[i][0], str[0], 110, instant);
          shown[i] = str;
        });
        const wd = V.fmt.WD[now.getDay()], mon = V.fmt.MON[now.getMonth()];
        date.set(`${wd} · ${now.getDate()}. ${mon}`);
      }

      layout();
      setTime(V.time.now(), true);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (root.isConnected) layout(); });
      const offR = V.on('display:resize', () => layout());

      return {
        minute(now) { setTime(now); },
        setOptions(opts) {
          const wChanged = !L || (WEIGHTS[opts.weight] || 250) !== L.weight;
          o = opts;
          if (wChanged) layout(); else paint();
        },
        ambient(on) { amb = on; paint(); },
        destroy() { offR(); },
      };
    },
  });
})();
