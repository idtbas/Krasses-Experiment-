/* VistoOS · os/launcher.js — „Orbit“: App-Wabe mit Fischaugen-Wölbung
 *
 *  Symbole liegen in einem Sechseckgitter. Zum Rand hin werden sie kleiner und rücken zusammen,
 *  sodass der ganze Kreis genutzt wird. Ziehen verschiebt, Drehen am Rand dreht das Gitter.
 *  In der Mitte liegt die Uhr (zurück zum Zifferblatt).
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const S = 196;               // Gitterabstand (logisch)
  const ICON = 172;            // Symbolgröße bei Maßstab 1
  const R_IN = 205, R_OUT = 470;

  let el = null, items = [], nameArc = null, focused = null;
  let ox = 0, oy = 0, rot = 0, vx = 0, vy = 0, coasting = false;
  let reveal = 1;              // 0…1 Einblendung
  let dragging = false, pressed = null;
  let visible = false;

  function spiral(n) {
    // axiale Koordinaten spiralförmig von innen nach außen
    const out = [[0, 0]];
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (let ring = 1; out.length < n; ring++) {
      let q = -ring, r = ring; // Start unten links
      for (let side = 0; side < 6 && out.length < n; side++) {
        for (let k = 0; k < ring && out.length < n; k++) {
          out.push([q, r]);
          q += dirs[side][0]; r += dirs[side][1];
        }
      }
    }
    return out;
  }

  function build() {
    el.innerHTML = '';
    items = [];
    const apps = [{ id: '__home', name: 'Zifferblatt', icon: 'clock', color: '#2C2C2E', home: true }].concat(V.apps.list());
    const coords = spiral(apps.length);
    apps.forEach((app, i) => {
      const [q, r] = coords[i];
      const x = S * (q + r / 2), y = S * (r * Math.sqrt(3) / 2);
      const node = U.el('div', { class: 'vos-lic' });
      const ic = V.ui.icon(app, '100%');
      if (app.home) {
        ic.innerHTML = '';
        ic.style.background = 'radial-gradient(circle at 50% 35%, #3a3a3e, #121214)';
        const mini = U.el('div', { style: { fontSize: '4.3cqw', fontWeight: 300, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' } });
        ic.appendChild(mini);
        app._mini = mini;
      }
      node.appendChild(ic);
      el.appendChild(node);
      items.push({ app, x, y, node, d: Math.hypot(x, y) });
    });
    nameArc = V.ui.arcText({ text: '', r: 452, size: 30, weight: 650, spacing: 3, color: 'rgba(255,255,255,.75)', upper: false });
    nameArc.el.classList.add('vos-lname');
    el.appendChild(nameArc.el);
    updateMini();
  }
  function updateMini() {
    const h = items.find((i) => i.app.home);
    if (h) h.app._mini.textContent = V.fmt.time(V.time.now());
  }

  function bounds() {
    let m = 0;
    for (const it of items) m = Math.max(m, it.d);
    return Math.max(0, m - 130);
  }

  function layout(dt) {
    if (!visible) return;
    // Schwung
    if (coasting && !dragging) {
      ox += vx * dt; oy += vy * dt;
      const f = Math.pow(0.0035, dt);
      vx *= f; vy *= f;
      // Gummiband
      const B = bounds();
      const d = Math.hypot(ox, oy);
      if (d > B) {
        const k = (d - B) / d;
        ox -= ox * k * Math.min(1, dt * 9);
        oy -= oy * k * Math.min(1, dt * 9);
        vx *= 0.8; vy *= 0.8;
      }
      if (Math.abs(vx) + Math.abs(vy) < 4 && d <= B + 0.5) coasting = false;
    }
    const cr = Math.cos(U.rad(rot)), sr = Math.sin(U.rad(rot));
    let best = null, bestD = 1e9;
    for (const it of items) {
      let x = it.x + ox, y = it.y + oy;
      const rx = x * cr - y * sr, ry = x * sr + y * cr;
      x = rx; y = ry;
      const d = Math.hypot(x, y);
      // radiale Stauchung am Rand
      let dd = d;
      if (d > R_IN) dd = R_IN + (R_OUT - R_IN) * Math.tanh((d - R_IN) / (R_OUT - R_IN) * 1.05);
      const k = d > 0 ? dd / d : 1;
      const px = 500 + x * k, py = 500 + y * k;
      let s = 1 - 0.78 * U.smoothstep(R_IN - 40, R_IN + 340, d);
      // Einblendung: von innen nach außen gestaffelt
      const delay = d / 900;
      const rv = U.clamp((reveal - delay * 0.55) / 0.45, 0, 1.2);
      const rvE = rv >= 1 ? 1 : V.ease.outBack(U.clamp(rv, 0, 1), 1.4);
      s *= rvE;
      let op = (1 - U.smoothstep(R_OUT - 30, R_OUT + 60, dd + ICON * s * 0.25)) * U.clamp(rv * 1.6, 0, 1);
      if (it === pressed) s *= 0.9;
      it.node.style.transform = `translate(${(px / 10).toFixed(2)}cqw, ${(py / 10).toFixed(2)}cqw) scale(${Math.max(0.001, s).toFixed(3)})`;
      it.node.style.opacity = op.toFixed(3);
      it.node.style.zIndex = String(1000 - Math.round(d));
      it.sx = px; it.sy = py; it.ss = s;
      if (d < bestD) { bestD = d; best = it; }
    }
    if (best !== focused && reveal > 0.6) {
      focused = best;
      nameArc.set(best ? best.app.name : '');
    }
    nameArc.el.style.opacity = U.clamp((reveal - 0.5) * 2, 0, 1) * (bestD < 120 ? 1 : 0.35);
  }

  function hit(p) {
    let best = null, bd = 1e9;
    for (const it of items) {
      const d = Math.hypot(p.x - it.sx, p.y - it.sy);
      const rad = (ICON / 2) * it.ss + 10;
      if (d < rad && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  const launcher = (V.launcher = {
    mount(stage) {
      el = U.el('div', { class: 'vos-screen vos-launcher', attrs: { 'data-nogesture': 'all' }, style: { visibility: 'hidden' } });
      stage.appendChild(el);
      build();
      V.loop.add(layout, 6);
      V.on('time:minute', updateMini);
      V.gesture(el, {
        start(p) {
          dragging = true; coasting = false; vx = vy = 0;
          pressed = hit(p);
          this._ox = ox; this._oy = oy;
        },
        move(p) {
          if (p.moved) pressed = null;
          // Drehung zurück ins Gitter rechnen
          const cr = Math.cos(U.rad(-rot)), sr = Math.sin(U.rad(-rot));
          const dx = p.dx * cr - p.dy * sr, dy = p.dx * sr + p.dy * cr;
          let nx = this._ox + dx, ny = this._oy + dy;
          const B = bounds(), d = Math.hypot(nx, ny);
          if (d > B) { const over = d - B; const k = (B + over * 0.35) / d; nx *= k; ny *= k; }
          ox = nx; oy = ny;
        },
        end(p) {
          dragging = false;
          if (p.moved) {
            const cr = Math.cos(U.rad(-rot)), sr = Math.sin(U.rad(-rot));
            vx = (p.vx * cr - p.vy * sr) * 0.9; vy = (p.vx * sr + p.vy * cr) * 0.9;
            coasting = true;
          }
          pressed = null;
        },
        cancel() { dragging = false; pressed = null; coasting = true; },
        tap(p) {
          const it = hit(p);
          if (!it) return;
          V.sound.play('tap'); V.haptic(6);
          if (it.app.home) { V.shell.home(); return; }
          V.shell.open(it.app.id, {}, { x: it.sx, y: it.sy, r: (ICON / 2) * it.ss });
        },
      }, { slop: 10, owner: 'launcher' });
      return el;
    },
    get el() { return el; },
    rebuild: () => build(),
    show(o = {}) {
      visible = true;
      el.style.visibility = '';
      el.style.pointerEvents = '';
      updateMini();
      if (o.reset !== false) { ox = oy = 0; rot = 0; vx = vy = 0; coasting = false; }
      return V.tween({ from: reveal < 1 && o.instant !== true ? reveal : o.instant ? 1 : 0, to: 1, duration: o.instant ? 0.001 : 0.75, ease: V.ease.linear, onUpdate: (v) => (reveal = v) }).promise;
    },
    hide(o = {}) {
      el.style.pointerEvents = 'none';
      return V.tween({ from: reveal, to: 0, duration: o.instant ? 0.001 : 0.35, ease: V.ease.inQuad, onUpdate: (v) => (reveal = v) }).promise.then(() => {
        if (reveal <= 0.001) { visible = false; el.style.visibility = 'hidden'; }
      });
    },
    crown(dA) { rot += dA; },
    /** Mittelpunkt eines Symbols (für Schließen-Animation) */
    originOf(id) {
      const it = items.find((i) => i.app.id === id);
      return it && visible ? { x: it.sx, y: it.sy, r: (ICON / 2) * it.ss } : null;
    },
    get visible() { return visible; },
  });
  void launcher;
})();
