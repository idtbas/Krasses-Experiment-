/* VistoOS · faces/words.js — „Wortuhr“: deutsche Wortuhr als runde Buchstabenmatrix
 *
 *  „ES IST VIERTEL NACH SECHS“ in Fünf-Minuten-Schritten. Jede Zeile ist so lang, wie der Kreis auf
 *  ihrer Höhe breit ist – die Matrix ist selbst rund. Aktive Wörter leuchten (mit Lauflicht beim
 *  Wechsel), alle anderen Buchstaben bleiben als zarte Struktur. Die übrigen 1–4 Minuten zeigen
 *  vier Punkte oben am Rand.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  // Zeilen: Wörter in Lesereihenfolge, ' ' = Füllbuchstabe. Schlüssel je Wort für die Logik.
  const ROWS = [
    [['ES', 'es'], ' ', ['IST', 'ist']],
    [['FÜNF', 'm5'], ' ', ['ZEHN', 'm10']],
    [['ZWANZIG', 'm20']],
    [['VIERTEL', 'm15'], ' ', ['NACH', 'nach']],
    [['VOR', 'vor'], ' ', ['HALB', 'halb'], ' ', ['ELF', 'h11']],
    [['EINS', 'h1'], ' ', ['ZWEI', 'h2'], ' ', ['DREI', 'h3']],
    [['VIER', 'h4'], ' ', ['FÜNF', 'h5'], ' ', ['ACHT', 'h8']],
    [['SECHS', 'h6'], ' ', ['SIEBEN', 'h7']],
    [['NEUN', 'h9'], ' ', ['ZWÖLF', 'h0']],
    [['ZEHN', 'h10'], ' ', ['UHR', 'uhr']],
  ];
  const FILL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';

  const FONTS = {
    sans: { family: "'Inter Tight', system-ui, sans-serif", weight: 560, k: 0.62 },
    mono: { family: "'JetBrains Mono', ui-monospace, monospace", weight: 500, k: 0.6 },
    serif: { family: "'Instrument Serif', Georgia, serif", weight: 400, k: 0.78 },
  };
  const DIM = { soft: 0.15, faint: 0.075, off: 0 };

  V.css('fwd', `
    .fwd-l { position: absolute; transform: translate(-50%, -50%); line-height: 1; text-align: center; pointer-events: none;
      transition: color .5s ease, text-shadow .7s ease, opacity .6s ease; }
    .fwd-dot { position: absolute; width: 2cqw; height: 2cqw; margin: -1cqw 0 0 -1cqw; border-radius: 50%;
      transition: background .5s ease, box-shadow .6s ease, transform .5s var(--spring); }
  `);

  /** Wörter, die zu einer Uhrzeit leuchten */
  function activeKeys(d) {
    const m = d.getMinutes();
    const m5 = Math.floor(m / 5) * 5;
    let h = d.getHours();
    const keys = ['es', 'ist'];
    const next = m5 >= 25;
    if (next) h += 1;
    const h12 = h % 12;
    switch (m5) {
      case 0: keys.push('uhr'); break;
      case 5: keys.push('m5', 'nach'); break;
      case 10: keys.push('m10', 'nach'); break;
      case 15: keys.push('m15', 'nach'); break;
      case 20: keys.push('m20', 'nach'); break;
      case 25: keys.push('m5', 'vor', 'halb'); break;
      case 30: keys.push('halb'); break;
      case 35: keys.push('m5', 'nach', 'halb'); break;
      case 40: keys.push('m20', 'vor'); break;
      case 45: keys.push('m15', 'vor'); break;
      case 50: keys.push('m10', 'vor'); break;
      case 55: keys.push('m5', 'vor'); break;
    }
    // „ES IST EIN UHR“, aber „FÜNF NACH EINS“
    keys.push(h12 === 1 && m5 === 0 ? 'h1:ein' : 'h' + h12);
    return { keys, extra: m % 5 };
  }
  /** gesprochene Form (für Visto) */
  function sentence(d) {
    const { keys } = activeKeys(d);
    const words = [];
    for (const row of ROWS) for (const it of row) {
      if (typeof it === 'string') continue;
      if (keys.includes(it[1])) words.push(it[0]);
      else if (it[1] === 'h1' && keys.includes('h1:ein')) words.push('EIN');
    }
    return words.join(' ');
  }

  V.faces.register({
    id: 'words',
    name: 'Wortuhr',
    order: 5,
    horizon: 'travel', horizonR: 488, horizonCapsule: { y: 9.8, compact: true },   // die Buchstaben füllen den Kreis: Horizont nur bei Zeitreise, ganz außen
    options: [
      { key: 'color', label: 'Farbe', type: 'color', default: '#FFFFFF' },
      { key: 'font', label: 'Schrift', type: 'choice', default: 'sans', values: [{ v: 'sans', label: 'Grotesk' }, { v: 'mono', label: 'Mono' }, { v: 'serif', label: 'Serif' }] },
      { key: 'dim', label: 'Hintergrund', type: 'choice', default: 'soft', values: [{ v: 'soft', label: 'Zart' }, { v: 'faint', label: 'Hauch' }, { v: 'off', label: 'Aus' }] },
      { key: 'dots', label: 'Minutenpunkte', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      let amb = false;
      const grid = U.el('div', { class: 'fwd-grid', style: { position: 'absolute', inset: 0 } });
      const dotsEl = U.el('div', { style: { position: 'absolute', inset: 0 } });
      root.append(grid, dotsEl);
      let letters = [];     // {el, key, order}
      let dots = [];
      let lastKeys = '';
      let lastExtra = -1;

      function build() {
        grid.innerHTML = '';
        letters = [];
        const f = FONTS[o.font] || FONTS.sans;
        // Zellgröße so wählen, dass jede Zeile in den Kreis passt
        const n = ROWS.length;
        const need = ROWS.map((r) => r.reduce((a, it) => a + (typeof it === 'string' ? 1 : it[0].length), 0));
        let cw = 84, layout = null;
        for (; cw > 40; cw -= 1) {
          const ph = Math.min(cw * 1.12, 335 * 2 / (n - 1));
          const caps = [];
          let ok = true;
          for (let i = 0; i < n; i++) {
            const y = 500 + (i - (n - 1) / 2) * ph;
            const edge = Math.min(V.display.chord(y - ph * 0.3), V.display.chord(y + ph * 0.3));
            const cap = Math.floor((edge - 48) / cw);
            if (cap < need[i]) { ok = false; break; }
            caps.push({ y, cap });
          }
          if (ok) { layout = { cw, ph, caps }; break; }
        }
        if (!layout) return;
        const rnd = U.rng('wortuhr-visto');
        let order = 0;
        ROWS.forEach((row, i) => {
          const { y, cap } = layout.caps[i];
          // Wörter mittig, Rest mit Füllbuchstaben
          const cells = [];
          for (const it of row) {
            if (typeof it === 'string') cells.push({ ch: null, key: null });
            else for (let k = 0; k < it[0].length; k++) cells.push({ ch: it[0][k], key: it[1], idx: k });
          }
          const padL = Math.floor((cap - cells.length) / 2), padR = cap - cells.length - padL;
          const all = [];
          for (let k = 0; k < padL; k++) all.push({ ch: null, key: null });
          all.push(...cells);
          for (let k = 0; k < padR; k++) all.push({ ch: null, key: null });
          all.forEach((c, j) => {
            const ch = c.ch || FILL[Math.floor(rnd() * FILL.length)];
            const x = 500 + (j - (cap - 1) / 2) * layout.cw;
            const el = U.el('span', { class: 'fwd-l', text: ch, style: {
              left: x / 10 + 'cqw', top: y / 10 + 'cqw', fontSize: (layout.cw * f.k) / 10 + 'cqw',
              fontFamily: f.family, fontWeight: f.weight,
            } });
            grid.appendChild(el);
            letters.push({ el, key: c.key, idx: c.idx, order: order++ });
          });
        });
        // Minutenpunkte: eine kleine Krone aus vier Punkten oben am Rand
        dotsEl.innerHTML = '';
        dots = [-10.5, -3.5, 3.5, 10.5].map((a) => {
          const p = V.display.pt(a, 456);
          const d = U.el('div', { class: 'fwd-dot', style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw' } });
          dotsEl.appendChild(d);
          return d;
        });
        lastKeys = ''; lastExtra = -1;
      }

      function paint(now, instant) {
        const { keys, extra } = activeKeys(now);
        const sig = keys.join(',') + '|' + amb + '|' + o.color + '|' + o.dim;
        const col = ctx.color();
        const glow = U.rgba(col, 0.55), glow2 = U.rgba(col, 0.22);
        const dimA = amb ? 0 : DIM[o.dim] !== undefined ? DIM[o.dim] : 0.15;
        if (sig !== lastKeys) {
          // Lauflicht: neue Wörter leuchten in Lesereihenfolge auf
          let k = 0;
          for (const L of letters) {
            const on = !!L.key && (keys.includes(L.key) || (L.key === 'h1' && keys.includes('h1:ein') && L.idx < 3));
            const was = L.el.dataset.on === '1';
            L.el.dataset.on = on ? '1' : '';
            L.el.style.transitionDelay = !instant && on && !was ? (k++ * 0.045).toFixed(3) + 's' : '0s';
            L.el.style.color = on ? (amb ? U.rgba(col, 0.7) : col) : `rgba(255,255,255,${dimA})`;
            L.el.style.textShadow = on && !amb ? `0 0 .35em ${glow}, 0 0 1.2em ${glow2}` : 'none';
          }
          lastKeys = sig;
        }
        if (extra !== lastExtra || instant) {
          dots.forEach((d, i) => {
            const on = i < extra;
            d.style.display = o.dots ? '' : 'none';
            d.style.background = on ? col : 'transparent';
            d.style.border = on ? '0' : '.25cqw solid rgba(255,255,255,.2)';
            d.style.boxShadow = on && !amb ? `0 0 1.6cqw ${glow}` : 'none';
            d.style.transform = on ? 'scale(1)' : 'scale(.62)';
            d.style.opacity = amb && !on ? '0' : '1';
          });
          lastExtra = extra;
        }
      }

      build();
      paint(V.time.now(), true);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (root.isConnected) { build(); paint(V.time.now(), true); } });

      return {
        minute(now) { paint(now); },
        setOptions(opts) {
          const fontChanged = opts.font !== o.font;
          o = opts;
          if (fontChanged) build();
          lastKeys = ''; lastExtra = -1;
          paint(V.time.now(), true);
        },
        ambient(on) { amb = on; lastKeys = ''; lastExtra = -1; paint(V.time.now(), true); },
      };
    },
  });

  // Visto: „Wie spät ist es in Worten?“
  function speak() {
    const s = sentence(V.time.now()).toLowerCase().replace(/\bviertel\b/, 'Viertel').replace(/\buhr\b/, 'Uhr');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function registerVoice() {
    if (!V.brain || !V.actions) return;
    V.actions.register('face.words_time', {
      desc: 'Sagt die aktuelle Uhrzeit so, wie die Wortuhr sie anzeigt (z. B. „Es ist Viertel nach sechs“).',
      run() { const t = speak(); return { say: t + '.', card: { type: 'big', text: V.fmt.time(V.time.now()), sub: t } }; },
    });
    V.brain.intent({
      id: 'face-words-time', priority: 6,
      match: [/\b(uhrzeit|zeit|wie spät)\b.*\bin worten\b/, /\bwortuhr\b.*\b(zeit|spät|sag)/, /\bsag (mir )?die (uhr)?zeit in worten\b/],
      run() { return V.actions.run('face.words_time'); },
    });
  }
  if (V.brain) registerVoice(); else V.once('boot:ready', registerVoice);
})();
