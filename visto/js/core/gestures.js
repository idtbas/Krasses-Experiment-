/* VistoOS · core/gestures.js — Berührungen auswerten (in Display-Koordinaten 0…1000)
 *
 *  const g = V.gesture(element, {
 *    start(p, e), move(p, e), end(p, e), tap(p, e), long(p, e), cancel(p)
 *  }, { longMs: 480, slop: 14, filter(e) → bool })
 *  g.destroy()
 *
 *  p = { x, y, x0, y0, dx, dy, vx, vy (Einheiten/s), ms, moved, long,
 *        r, a (Uhrwinkel, 0° = oben, im Uhrzeigersinn), r0, a0, dA (aufsummierte Drehung in Grad) }
 *
 *  Kreisrand als Drehkrone: dA ändert sich, wenn der Finger am Rand entlangfährt.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  V.gesture = function (el, h, opts = {}) {
    const longMs = opts.longMs !== undefined ? opts.longMs : 480;
    const slop = opts.slop !== undefined ? opts.slop : 14;
    let st = null, longT = 0;

    function logical(e) {
      return V.display ? V.display.toLogical(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
    }
    function info() {
      const s = st;
      const now = performance.now();
      // Geschwindigkeit aus den letzten ~90 ms
      let vx = 0, vy = 0;
      const sm = s.samples;
      for (let i = sm.length - 1; i >= 0; i--) {
        if (now - sm[i].t > 90 || i === 0) {
          const ref = sm[i];
          const dt = (sm[sm.length - 1].t - ref.t) / 1000;
          if (dt > 0.004) { vx = (s.x - ref.x) / dt; vy = (s.y - ref.y) / dt; }
          break;
        }
      }
      const pr = polar(s.x, s.y);
      return {
        x: s.x, y: s.y, x0: s.x0, y0: s.y0, dx: s.x - s.x0, dy: s.y - s.y0,
        vx, vy, ms: now - s.t0, moved: s.moved, long: s.long,
        r: pr.r, a: pr.a, r0: s.r0, a0: s.a0, dA: s.dA, target: s.target,
      };
    }
    function polar(x, y) {
      const dx = x - 500, dy = y - 500;
      return { r: Math.hypot(dx, dy), a: U.wrap(U.deg(Math.atan2(dx, -dy)), 360) };
    }

    function down(e) {
      if (st) return;
      if (e.button !== undefined && e.button > 0) return;
      if (opts.filter && !opts.filter(e)) return;
      const L = logical(e);
      const pr = polar(L.x, L.y);
      st = {
        id: e.pointerId, x0: L.x, y0: L.y, x: L.x, y: L.y, t0: performance.now(),
        samples: [{ x: L.x, y: L.y, t: performance.now() }], moved: false, long: false,
        r0: pr.r, a0: pr.a, lastA: pr.a, dA: 0, target: e.target,
      };
      clearTimeout(longT);
      if (h.long) {
        longT = setTimeout(() => {
          if (st && !st.moved) { st.long = true; h.long(info(), e); }
        }, longMs);
      }
      if (h.start) h.start(info(), e);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    }
    function move(e) {
      if (!st || e.pointerId !== st.id) return;
      const L = logical(e);
      st.x = L.x; st.y = L.y;
      const t = performance.now();
      st.samples.push({ x: L.x, y: L.y, t });
      if (st.samples.length > 12) st.samples.shift();
      const pr = polar(L.x, L.y);
      if (pr.r > 40) { st.dA += U.angDiff(st.lastA, pr.a); st.lastA = pr.a; }
      if (!st.moved && Math.hypot(L.x - st.x0, L.y - st.y0) > slop) {
        st.moved = true;
        clearTimeout(longT);
      }
      if (h.move) h.move(info(), e);
    }
    function finish() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      clearTimeout(longT);
    }
    function up(e) {
      if (!st || e.pointerId !== st.id) return;
      const p = info();
      finish();
      const s = st; st = null;
      if (!s.moved && !s.long && h.tap) h.tap(p, e);
      if (h.end) h.end(p, e);
    }
    function cancel(e) {
      if (!st || (e && e.pointerId !== st.id)) return;
      const p = info();
      finish();
      st = null;
      if (h.cancel) h.cancel(p); else if (h.end) h.end(Object.assign(p, { cancelled: true }));
    }

    el.addEventListener('pointerdown', down);
    const api = {
      el,
      owner: opts.owner || null,
      get active() { return !!st; },
      cancel() { if (st) cancel(); },
      destroy() { el.removeEventListener('pointerdown', down); finish(); st = null; all.delete(api); },
    };
    all.add(api);
    return api;
  };

  /** alle laufenden Gesten außer der des Besitzers abbrechen (z. B. Shell übernimmt Zurück-Wischen) */
  const all = new Set();
  V.gesture.claim = function (owner) {
    for (const g of Array.from(all)) {
      if (!g.el.isConnected) { if (!g.active) all.delete(g); continue; }
      if (g.owner !== owner && g.active) g.cancel();
    }
  };
})();
