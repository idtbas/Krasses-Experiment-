/* VistoOS · faces/orbit.js — „Orbit“: die Zeit als kleines Sonnensystem
 *
 *  Stunde = Planet auf seiner Umlaufbahn (12 Uhr oben), Minute = Mond, der den Planeten umkreist
 *  (sein Winkel ist der Minutenwinkel), Sekunde = Satellit auf der äußeren Bahn mit Leuchtspur.
 *  Licht kommt aus der Mitte: Planet und Mond sind auf der zugewandten Seite beleuchtet.
 *  Dazu ein zarter, funkelnder Sternenhimmel mit gelegentlicher Sternschnuppe.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const RAD = (a) => ((a - 90) * Math.PI) / 180;

  V.css('fob', `
    .fob-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
    .fob-mid { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; transition: opacity .8s ease; }
    .fob-time { display: flex; justify-content: center; font-size: 7.4cqw; font-weight: 300; letter-spacing: -.02em; line-height: 1; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.92); }
    .fob-date { margin-top: 1.2cqw; font-size: 2.4cqw; font-weight: 650; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.42); }
  `);

  const R_PLANET = 282, R_MOON = 96, R_SAT = 442;

  V.faces.register({
    id: 'orbit',
    name: 'Orbit',
    order: 6,
    options: [
      { key: 'color', label: 'Planet', type: 'color', default: '#7CC8FF' },
      { key: 'ring', label: 'Planetenring', type: 'toggle', default: true },
      { key: 'stars', label: 'Sternenhimmel', type: 'toggle', default: true },
      { key: 'digital', label: 'Digitalzeit', type: 'toggle', default: true },
    ],
    create(root, ctx) {
      let o = ctx.opts;
      let amb = false;
      const cv = U.el('canvas', { class: 'fob-cv' });
      const g = cv.getContext('2d');
      const mid = U.el('div', { class: 'fob-mid' });
      const timeEl = U.el('div', { class: 'fob-time' });
      const dateEl = U.el('div', { class: 'fob-date' });
      mid.append(timeEl, dateEl);
      root.append(cv, mid);
      const digits = V.faces.rollDigits(timeEl, { digitW: '0.6em', colonW: '0.28em' });

      let px = 0;
      function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        px = Math.max(200, Math.round((V.display.size || 360) * dpr));
        if (cv.width !== px) { cv.width = px; cv.height = px; }
      }
      size();

      // Sterne (fest verteilt, damit das Blatt immer gleich aussieht)
      const rnd = U.rng('visto-orbit');
      const stars = [];
      while (stars.length < 150) {
        const x = rnd() * 1000, y = rnd() * 1000;
        const d = Math.hypot(x - 500, y - 500);
        if (d > 488 || d < 70) continue;
        const big = rnd() < 0.08;
        stars.push({
          x, y, r: big ? 1.9 + rnd() * 1.2 : 0.8 + rnd() * 1.1,
          a: big ? 0.55 + rnd() * 0.35 : 0.14 + rnd() * 0.4,
          sp: 0.4 + rnd() * 1.4, ph: rnd() * TAU,
          c: rnd() < 0.15 ? '#BFD4FF' : rnd() < 0.1 ? '#FFE2C2' : '#FFFFFF',
        });
      }
      let t = 0;
      let shoot = null, nextShoot = 6 + rnd() * 10;

      function sphere(x, y, r, col, dark) {
        // Licht aus der Mitte des Displays
        const dx = 500 - x, dy = 500 - y, d = Math.hypot(dx, dy) || 1;
        const lx = x + (dx / d) * r * 0.5, ly = y + (dy / d) * r * 0.5;
        const gr = g.createRadialGradient(lx, ly, r * 0.05, x, y, r * 1.05);
        gr.addColorStop(0, U.lighten(col, 0.55));
        gr.addColorStop(0.35, col);
        gr.addColorStop(0.8, U.darken(col, dark));
        gr.addColorStop(1, U.darken(col, Math.min(0.95, dark + 0.1)));
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      function halo(x, y, r, col, a) {
        const gr = g.createRadialGradient(x, y, r * 0.7, x, y, r * 2.4);
        gr.addColorStop(0, U.rgba(col, a)); gr.addColorStop(0.35, U.rgba(col, a * 0.3)); gr.addColorStop(1, U.rgba(col, 0));
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r * 2.4, 0, TAU); g.fill();
      }
      function ringArc(x, y, r, tilt, front, col, alpha) {
        // Planetenring als Ellipse; vordere bzw. hintere Hälfte getrennt zeichnen
        g.save();
        g.translate(x, y); g.rotate(tilt);
        g.scale(1, 0.32);
        g.strokeStyle = U.rgba(col, alpha);
        g.lineWidth = 7;
        g.beginPath();
        if (front) g.arc(0, 0, r, 0, Math.PI); else g.arc(0, 0, r, Math.PI, TAU);
        g.stroke();
        g.strokeStyle = U.rgba('#ffffff', alpha * 0.35);
        g.lineWidth = 2.2;
        g.beginPath();
        if (front) g.arc(0, 0, r * 1.18, 0, Math.PI); else g.arc(0, 0, r * 1.18, Math.PI, TAU);
        g.stroke();
        g.restore();
      }

      function draw(dt, now) {
        t += dt;
        const k = px / 1000;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, px, px);
        g.setTransform(k, 0, 0, k, 0, 0);
        const col = ctx.color();
        const s = now.getSeconds() + now.getMilliseconds() / 1000;
        const m = now.getMinutes() + s / 60;
        const h = (now.getHours() % 12) + m / 60;

        // Himmel
        if (o.stars && !amb) {
          const neb = g.createRadialGradient(340, 330, 10, 340, 330, 420);
          neb.addColorStop(0, 'rgba(120,110,255,.075)'); neb.addColorStop(0.5, 'rgba(90,60,200,.03)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = neb; g.fillRect(0, 0, 1000, 1000);
          for (const st of stars) {
            const tw = 0.62 + 0.38 * Math.sin(t * st.sp + st.ph);
            g.globalAlpha = st.a * tw;
            g.fillStyle = st.c;
            g.beginPath(); g.arc(st.x, st.y, st.r, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
          // Sternschnuppe
          if (!ctx.preview) {
            nextShoot -= dt;
            if (!shoot && nextShoot <= 0) {
              const a0 = rnd() * 360;
              const p = V.display.pt(a0, 300 + rnd() * 140);
              const dir = U.rad(a0 + 90 + (rnd() - 0.5) * 50);
              shoot = { x: p.x, y: p.y, vx: Math.sin(dir) * 520, vy: -Math.cos(dir) * 520, life: 0 };
              nextShoot = 14 + rnd() * 18;
            }
            if (shoot) {
              shoot.life += dt;
              const L = shoot.life / 0.9;
              if (L >= 1) shoot = null;
              else {
                const hx = shoot.x + shoot.vx * shoot.life, hy = shoot.y + shoot.vy * shoot.life;
                const tx = hx - shoot.vx * 0.16, ty = hy - shoot.vy * 0.16;
                const gr = g.createLinearGradient(tx, ty, hx, hy);
                const a = Math.sin(L * Math.PI) * 0.8;
                gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
                g.strokeStyle = gr; g.lineWidth = 2.2; g.lineCap = 'round';
                g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
              }
            }
          }
        }

        // warmes Licht in der Mitte (die „Sonne“ hinter der Uhrzeit)
        if (!amb) {
          const sun = g.createRadialGradient(500, 500, 0, 500, 500, 200);
          sun.addColorStop(0, 'rgba(255,190,120,.10)'); sun.addColorStop(0.5, 'rgba(255,150,90,.035)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sun; g.beginPath(); g.arc(500, 500, 200, 0, TAU); g.fill();
        }

        // Umlaufbahnen
        const orbitA = amb ? 0.07 : 0.11;
        g.lineWidth = 1.6;
        g.strokeStyle = `rgba(255,255,255,${orbitA})`;
        g.beginPath(); g.arc(500, 500, R_PLANET, 0, TAU); g.stroke();
        if (!amb) {
          g.setLineDash([2, 9]);
          g.beginPath(); g.arc(500, 500, R_SAT, 0, TAU); g.stroke();
          g.setLineDash([]);
          // Stundenmarken auf der Planetenbahn
          for (let i = 0; i < 12; i++) {
            const p = V.display.pt(i * 30, R_PLANET);
            g.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.22)';
            g.beginPath(); g.arc(p.x, p.y, i % 3 === 0 ? 3.6 : 2.4, 0, TAU); g.fill();
          }
        }

        // Spur des Planeten (zurückgelegter Teil der Stunde, verblassend)
        const ah = h * 30;
        if (!amb) {
          g.lineCap = 'round';
          V.rim.tail(g, 500, 500, R_PLANET, ah - 64, ah, col, 5, 0.75, 0);
        }

        // Planet
        const P = V.display.pt(ah, R_PLANET);
        const pr = 44;
        const tilt = -0.42;
        if (!amb) halo(P.x, P.y, pr, col, 0.16);
        if (o.ring && !amb) ringArc(P.x, P.y, pr * 1.75, tilt, false, U.lighten(col, 0.35), 0.55);
        if (amb) {
          g.strokeStyle = U.rgba(col, 0.6); g.lineWidth = 3;
          g.beginPath(); g.arc(P.x, P.y, pr, 0, TAU); g.stroke();
        } else sphere(P.x, P.y, pr, col, 0.82);
        if (o.ring && !amb) ringArc(P.x, P.y, pr * 1.75, tilt, true, U.lighten(col, 0.35), 0.75);

        // Mond: Minutenwinkel um den Planeten
        const am = m * 6;
        if (!amb) {
          g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1.4;
          g.beginPath(); g.arc(P.x, P.y, R_MOON, 0, TAU); g.stroke();
          V.rim.tail(g, P.x, P.y, R_MOON, am - 80, am, '#ffffff', 3.2, 0.55, 0);
        }
        const Mo = { x: P.x + Math.sin(U.rad(am)) * R_MOON, y: P.y - Math.cos(U.rad(am)) * R_MOON };
        if (amb) {
          g.fillStyle = 'rgba(220,220,230,.5)';
          g.beginPath(); g.arc(Mo.x, Mo.y, 8, 0, TAU); g.fill();
        } else {
          halo(Mo.x, Mo.y, 16, '#ffffff', 0.12);
          sphere(Mo.x, Mo.y, 16, '#E9E7EF', 0.78);
        }

        // Satellit mit Leuchtspur (Sekunde, fließend)
        if (!amb) {
          const as = s * 6;
          const satCol = U.mix(col, '#ffffff', 0.55);
          V.rim.tail(g, 500, 500, R_SAT, as - 54, as, satCol, 3, 0.85, 0);
          const S = V.display.pt(as, R_SAT);
          halo(S.x, S.y, 6, satCol, 0.5);
          g.save();
          g.translate(S.x, S.y); g.rotate(U.rad(as));
          g.fillStyle = '#ffffff';
          g.fillRect(-3.2, -3.2, 6.4, 6.4);
          g.fillStyle = U.rgba(satCol, 0.95);
          g.fillRect(-14, -1.6, 8.5, 3.2); g.fillRect(5.5, -1.6, 8.5, 3.2);
          g.restore();
        }
      }

      function style() {
        o = ctx.opts;
        mid.style.display = o.digital ? '' : 'none';
      }
      function minute(now) {
        digits.set(V.fmt.time(now));
        dateEl.textContent = V.fmt.WD_S[now.getDay()] + ' ' + now.getDate() + '. ' + V.fmt.MON_S[now.getMonth()].replace('.', '');
      }
      style();
      draw(0, V.time.now());
      const offR = V.on('display:resize', () => { size(); draw(0, V.time.now()); });

      return {
        minute,
        frame(dt, now) { draw(dt, now); },
        setOptions() { style(); },
        ambient(on) { amb = on; mid.style.opacity = on ? '0.6' : '1'; draw(0, V.time.now()); },
        destroy() { offR(); },
      };
    },
  });
})();
