/* VistoOS · faces/monolith.js — „Monolith“: große Uhrzeit, Datum am Bogen, Sekundenpunkt am Rand */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const FONTS = {
    sans: { family: "'Inter Tight', system-ui, sans-serif", size: 28, digitW: '0.6em', colonW: '0.3em', track: '-0.04em' },
    round: { family: "'Nunito', 'Inter Tight', sans-serif", size: 27, digitW: '0.6em', colonW: '0.3em', track: '-0.03em' },
    serif: { family: "'Instrument Serif', Georgia, serif", size: 36, digitW: '0.5em', colonW: '0.22em', track: '-0.01em', fixedWeight: 400 },
    mono: { family: "'JetBrains Mono', ui-monospace, monospace", size: 23, digitW: '0.62em', colonW: '0.5em', track: '0' },
  };

  V.faces.register({
    id: 'monolith',
    name: 'Monolith',
    order: 1,
    options: [
      { key: 'color', label: 'Farbe', type: 'color', default: '#FFFFFF' },
      { key: 'font', label: 'Schriftart', type: 'choice', default: 'sans', values: [{ v: 'sans', label: 'Grotesk' }, { v: 'round', label: 'Rund' }, { v: 'serif', label: 'Serif' }, { v: 'mono', label: 'Mono' }] },
      { key: 'weight', label: 'Stärke', type: 'choice', default: '200', values: [{ v: '100', label: 'Hauch' }, { v: '200', label: 'Fein' }, { v: '420', label: 'Klar' }, { v: '780', label: 'Kräftig' }] },
      { key: 'seconds', label: 'Sekundenpunkt', type: 'toggle', default: true },
      { key: 'date', label: 'Datum', type: 'toggle', default: true },
      { key: 'info', label: 'Infos', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      const timeEl = U.el('div', { class: 'mono-time', style: {
        position: 'absolute', left: 0, right: 0, top: '50%', textAlign: 'center', whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1, transform: 'translateY(-54%)',
        display: 'flex', justifyContent: 'center',
      } });
      const cx = U.el('div', { class: 'mono-cx', style: {
        position: 'absolute', left: '18%', right: '18%', top: '66%', textAlign: 'center', fontSize: '3.9cqw', fontWeight: 560,
        color: 'rgba(255,255,255,.62)', letterSpacing: '-.005em', transition: 'opacity .6s', whiteSpace: 'nowrap',
      } });
      const date = V.ui.arcText({ text: '', r: 418, size: 30, weight: 650, spacing: 5.5, color: 'rgba(255,255,255,.58)' });
      // Sekundenpunkt
      const sec = U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000' });
      const secG = U.svg('g');
      const halo = U.svg('circle', { cx: 500, cy: 22, r: 15, fill: '#fff', opacity: 0.18 });
      const dot = U.svg('circle', { cx: 500, cy: 22, r: 7, fill: '#fff' });
      const trail = U.svg('path', { d: V.ui.arcPath(500, 500, 478, -26, 0), fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.22 });
      secG.append(trail, halo, dot);
      sec.appendChild(secG);
      root.append(date.el, sec, timeEl, cx);

      let digits = V.faces.rollDigits(timeEl, {});
      function style() {
        o = ctx.opts;
        const f = FONTS[o.font] || FONTS.sans;
        const col = ctx.color();
        timeEl.style.fontFamily = f.family;
        timeEl.style.fontWeight = f.fixedWeight || o.weight;
        timeEl.style.fontSize = f.size + 'cqw';
        timeEl.style.letterSpacing = f.track;
        timeEl.style.color = col;
        timeEl.querySelectorAll('.rd-slot').forEach((s) => { s.style.width = /[:]/.test(s.textContent) ? f.colonW : f.digitW; });
        const sc = col.toUpperCase() === '#FFFFFF' ? ctx.accent() : col;
        dot.setAttribute('fill', sc); halo.setAttribute('fill', sc); trail.setAttribute('stroke', sc);
        sec.style.display = o.seconds && !ctx.preview ? '' : 'none';
        date.el.style.display = o.date ? '' : 'none';
        cx.style.display = o.info ? '' : 'none';
      }
      let lastStr = '';
      function minute(now) {
        const f = FONTS[o.font] || FONTS.sans;
        const str = V.fmt.time(now);
        if (str !== lastStr) {
          // Breiten je Zeichen
          digits.set(str);
          timeEl.querySelectorAll('.rd-slot').forEach((s, i) => { s.style.width = str[i] === ':' ? f.colonW : f.digitW; });
          lastStr = str;
        }
        date.set(V.fmt.dateLong(now));
        V.faces.renderComplications(cx, { place: true });
      }
      style();
      let cxT = 0;
      return {
        minute,
        frame(dt, now) {
          if (!o.seconds || ctx.preview) return;
          const s = now.getSeconds() + now.getMilliseconds() / 1000;
          secG.setAttribute('transform', `rotate(${(s * 6).toFixed(3)} 500 500)`);
          cxT += dt;
          if (cxT > 1) { cxT = 0; if (o.info) V.faces.renderComplications(cx, { place: true }); }
        },
        setOptions() { timeEl.innerHTML = ''; digits = V.faces.rollDigits(timeEl, {}); lastStr = ''; style(); minute(V.time.now()); },
        ambient(on) {
          cx.style.opacity = on ? '0.45' : '1';
          sec.style.opacity = on ? '0' : '1';
          timeEl.style.transition = 'opacity .8s';
          timeEl.style.opacity = on ? '0.8' : '1';
        },
      };
    },
  });
})();
