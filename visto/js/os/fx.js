/* VistoOS · os/fx.js — Leuchtebene über allem (Visto, Randlicht)
 *
 *  Zeichnet in logischen Koordinaten (0…1000). Jeder Renderer bekommt zwei Zeichenflächen:
 *    ctx   – scharf, volle Auflösung
 *    g     – Leuchtpuffer in 1/3 Auflösung; wird weich hochskaliert und additiv unter ctx gelegt
 *
 *  const off = V.fx.add({ z: 0, active() → bool, draw(ctx, g, t, dt) })
 */
'use strict';
(function () {
  const V = window.V;
  const renderers = [];
  let cv, ctx, gl, gctx, W = 0, GW = 0, drewLast = true;
  const GLOW_DIV = 3;

  function setup() {
    cv = V.display.fx;
    ctx = cv.getContext('2d');
    gl = document.createElement('canvas');
    gctx = gl.getContext('2d');
    resize();
    V.on('display:resize', resize);
    V.loop.add(frame, 100);
  }
  function resize() {
    const dpr = Math.min(V.display.dpr, 2);
    W = Math.max(64, Math.round(V.display.size * dpr));
    cv.width = cv.height = W;
    GW = Math.max(32, Math.round(W / GLOW_DIV));
    gl.width = gl.height = GW;
    drewLast = true;
  }

  function frame(dt, t) {
    if (!ctx) return;
    let any = false;
    for (const r of renderers) if (!r.active || r.active()) { any = true; break; }
    if (!any && !drewLast) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, W);
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.globalCompositeOperation = 'source-over';
    gctx.globalAlpha = 1;
    gctx.clearRect(0, 0, GW, GW);
    drewLast = any;
    if (!any) return;
    const s = W / 1000, gs = GW / 1000;
    for (const r of renderers) {
      if (r.active && !r.active()) continue;
      ctx.save(); gctx.save();
      ctx.setTransform(s, 0, 0, s, 0, 0);
      gctx.setTransform(gs, 0, 0, gs, 0, 0);
      try { r.draw(ctx, gctx, t, dt); } catch (e) { console.error('[VistoOS] fx', e); }
      ctx.restore(); gctx.restore();
    }
    // Leuchtpuffer weich unter die scharfe Ebene legen
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(gl, 0, 0, GW, GW, 0, 0, W, W);
    ctx.globalCompositeOperation = 'source-over';
  }

  V.fx = {
    setup,
    add(r) {
      r.z = r.z || 0;
      renderers.push(r);
      renderers.sort((a, b) => a.z - b.z);
      drewLast = true;
      return () => { const i = renderers.indexOf(r); if (i >= 0) renderers.splice(i, 1); drewLast = true; };
    },
    get width() { return W; },
    /** Zeichenhilfe: Kreisbogen im Uhrwinkel (Grad) */
    arc(c, cx, cy, r, a0, a1) {
      c.arc(cx, cy, r, ((a0 - 90) * Math.PI) / 180, ((a1 - 90) * Math.PI) / 180, a1 < a0);
    },
  };
})();
