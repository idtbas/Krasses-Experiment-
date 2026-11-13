/* VistoOS · faces/analog.js — „Chronos“: Analoguhr mit fließendem Sekundenzeiger (90 Hz) */
'use strict';
(function () {
  const V = window.V, U = V.util;

  V.faces.register({
    id: 'analog',
    name: 'Chronos',
    order: 2,
    options: [
      { key: 'color', label: 'Sekundenzeiger', type: 'color', default: 'accent' },
      { key: 'numerals', label: 'Ziffern', type: 'choice', default: 'quarters', values: [{ v: 'none', label: 'Keine' }, { v: 'quarters', label: 'Viertel' }, { v: 'all', label: 'Alle' }] },
      { key: 'dial', label: 'Zifferblatt', type: 'choice', default: 'black', values: [{ v: 'black', label: 'Schwarz' }, { v: 'tint', label: 'Getönt' }] },
      { key: 'date', label: 'Datum', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      const S = (t, a, ...k) => U.svg(t, a, ...k);
      const svg = S('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000' });
      const defs = S('defs');
      const gid = U.uid('dial');
      const grad = S('radialGradient', { id: gid, cx: '50%', cy: '42%', r: '62%' });
      const st1 = S('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.14 });
      const st2 = S('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 });
      grad.append(st1, st2); defs.appendChild(grad);
      const dialBg = S('circle', { cx: 500, cy: 500, r: 500, fill: `url(#${gid})` });
      const ticks = S('g');
      for (let i = 0; i < 60; i++) {
        const big = i % 5 === 0;
        const a = i * 6;
        const r1 = 486, r2 = big ? 446 : 470;
        const p1 = V.display.pt(a, r1), p2 = V.display.pt(a, r2);
        ticks.appendChild(S('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: big ? '#fff' : 'rgba(255,255,255,.38)', 'stroke-width': big ? 7 : 3, 'stroke-linecap': 'round' }));
      }
      const nums = S('g', { 'font-family': "'Inter Tight', sans-serif", 'font-weight': 600, fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      const dateG = S('g');
      const dateBox = S('rect', { x: 452, y: 664, width: 96, height: 58, rx: 16, fill: 'rgba(255,255,255,.09)' });
      const dateTx = S('text', { x: 500, y: 702, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 650, fill: '#fff', 'font-family': "'Inter Tight', sans-serif" });
      const dayTx = S('text', { x: 500, y: 650, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, 'letter-spacing': 4, fill: 'rgba(255,255,255,.5)', 'font-family': "'Inter Tight', sans-serif" });
      dateG.append(dayTx, dateBox, dateTx);
      const shadow = (w, len, tail = 0) => S('rect', { x: 500 - w / 2, y: 500 - len, width: w, height: len + tail, rx: w / 2, fill: 'rgba(0,0,0,.55)', transform: 'translate(4 7)' });
      const hourG = S('g'); hourG.append(shadow(26, 250, 34), S('rect', { x: 487, y: 250, width: 26, height: 284, rx: 13, fill: '#fff' }), S('rect', { x: 494, y: 266, width: 12, height: 150, rx: 6, fill: 'rgba(0,0,0,.28)' }));
      const minG = S('g'); minG.append(shadow(18, 380, 34), S('rect', { x: 491, y: 120, width: 18, height: 414, rx: 9, fill: '#fff' }), S('rect', { x: 496, y: 136, width: 8, height: 250, rx: 4, fill: 'rgba(0,0,0,.24)' }));
      const secG = S('g');
      const secHand = S('rect', { x: 497, y: 80, width: 6, height: 500, rx: 3 });
      const secTail = S('circle', { cx: 500, cy: 560, r: 13 });
      secG.append(secHand, secTail);
      const cap = S('circle', { cx: 500, cy: 500, r: 16 });
      const capIn = S('circle', { cx: 500, cy: 500, r: 6, fill: '#000' });
      svg.append(defs, dialBg, ticks, nums, dateG, hourG, minG, secG, cap, capIn);
      root.appendChild(svg);

      function style() {
        const o = ctx.opts;
        const c = ctx.color();
        secHand.setAttribute('fill', c); secTail.setAttribute('fill', c); cap.setAttribute('fill', c);
        dialBg.style.display = o.dial === 'tint' ? '' : 'none';
        st1.setAttribute('stop-color', c);
        st1.setAttribute('stop-opacity', 0.2);
        nums.innerHTML = '';
        if (o.numerals !== 'none') {
          for (let h = 1; h <= 12; h++) {
            if (o.numerals === 'quarters' && h % 3) continue;
            const p = V.display.pt(h * 30, o.numerals === 'all' ? 378 : 372);
            nums.appendChild(S('text', { x: p.x, y: p.y, 'font-size': o.numerals === 'all' ? 64 : 88, 'font-weight': o.numerals === 'all' ? 500 : 300, text: String(h) }));
          }
        }
        dateG.style.display = o.date ? '' : 'none';
      }
      function minute(now) {
        dayTx.textContent = V.fmt.WD_S[now.getDay()].toUpperCase();
        dateTx.textContent = String(now.getDate());
      }
      style();
      let amb = false;
      return {
        minute,
        frame(dt, now) {
          const ms = now.getMilliseconds();
          const s = now.getSeconds() + ms / 1000;
          const m = now.getMinutes() + s / 60;
          const h = (now.getHours() % 12) + m / 60;
          hourG.setAttribute('transform', `rotate(${(h * 30).toFixed(3)} 500 500)`);
          minG.setAttribute('transform', `rotate(${(m * 6).toFixed(3)} 500 500)`);
          if (!amb) secG.setAttribute('transform', `rotate(${(s * 6).toFixed(3)} 500 500)`);
        },
        setOptions() { style(); },
        ambient(on) { amb = on; secG.style.display = on ? 'none' : ''; ticks.style.opacity = on ? 0.5 : 1; },
      };
    },
  });
})();
