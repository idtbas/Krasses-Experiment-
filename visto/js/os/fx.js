/* VistoOS · os/fx.js — Leuchtebene über allem (Visto, Randlicht)
 *
 *  Zeichnet in logischen Koordinaten (0…1000). Jeder Renderer bekommt zwei Zeichenflächen:
 *    ctx   – scharf, volle Auflösung
 *    g     – Leuchtpuffer in 1/3 Auflösung; wird weich hochskaliert und additiv unter ctx gelegt
 *  Stellschraube des Leistungsreglers (V.perf.level): Stufe 1 und 0 rechnen den Leuchtpuffer kleiner,
 *  Stufe 0 begrenzt zusätzlich die Pixeldichte der scharfen Ebene. V.fx.scale() → { glowDiv, dprCap }
 *
 *  const off = V.fx.add({ z: 0, active() → bool, draw(ctx, g, t, dt), bounds() → [x0, y0, x1, y1] | null })
 *  bounds (optional, logisch, inkl. Leuchten): nur dieser Bereich wird neu zusammengesetzt; null = ganze Fläche
 */
'use strict';
(function () {
  const V = window.V;
  const renderers = [];
  let cv, ctx, gl, gctx, bl, bctx, W = 0, GW = 0, drewLast = true, canBlur = false;
  // je Stufe des Leistungsreglers (0 · 1 · 2): Teiler des Leuchtpuffers, Obergrenze der Pixeldichte
  const SCALE = [{ glowDiv: 4.5, dprCap: 1.5 }, { glowDiv: 3.75, dprCap: 2 }, { glowDiv: 3, dprCap: 2 }];
  let scale = SCALE[2];

  function setup() {
    cv = V.display.fx;
    ctx = cv.getContext('2d');
    gl = document.createElement('canvas');
    gctx = gl.getContext('2d');
    // weiches Leuchten: wenn der Browser Zeichenfilter kann, den kleinen Puffer zusätzlich weichzeichnen
    bl = document.createElement('canvas');
    bctx = bl.getContext('2d');
    try { bctx.filter = 'blur(2px)'; canBlur = bctx.filter === 'blur(2px)'; bctx.filter = 'none'; } catch (e) { canBlur = false; }
    resize();
    V.on('display:resize', resize);
    V.on('perf:level', resize);
    V.loop.add(frame, 100);
  }
  function resize() {
    scale = SCALE[V.perf ? V.perf.level : 2] || SCALE[2];
    const dpr = Math.min(V.display.dpr, scale.dprCap);
    W = Math.max(64, Math.round(V.display.size * dpr));
    cv.width = cv.height = W;
    GW = Math.max(32, Math.round(W / scale.glowDiv));
    gl.width = gl.height = GW;
    bl.width = bl.height = GW;
    drewLast = true;
    lastBox = null;
  }

  // Teilbereich (logisch [x0, y0, x1, y1]) des letzten Bildes; null = ganze Fläche
  let lastBox = null;
  const FULL = [0, 0, 1000, 1000];
  function frame(dt, t) {
    if (!ctx) return;
    let any = false;
    // Renderer mit bounds() melden, wo sie zeichnen (inkl. Leuchten) → nur dieser Bereich wird
    // gelöscht und zusammengesetzt (z. B. die ruhende Visto-Linie: ~5 % statt der ganzen Fläche)
    let box = null, full = !!V.fx.alwaysFull;   // alwaysFull: Vergleichsmessung ohne Teilbereiche
    for (const r of renderers) {
      if (r.active && !r.active()) continue;
      any = true;
      const b = !full && r.bounds ? r.bounds() : null;
      if (!b) { full = true; continue; }
      box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b.slice();
    }
    if (!any && !drewLast) return;
    if (full || !box) box = any ? FULL : null;
    // Bereich dieses Bildes ∪ letzter Bereich (dort muss Altes weg) – in ganzen Pixeln des Leuchtpuffers
    let u = box && lastBox ? [Math.min(box[0], lastBox[0]), Math.min(box[1], lastBox[1]), Math.max(box[2], lastBox[2]), Math.max(box[3], lastBox[3])] : box || lastBox || FULL;
    if (!drewLast && box) u = box;
    lastBox = box;
    const gs = GW / 1000, k = W / GW;
    const gx0 = Math.max(0, Math.floor(u[0] * gs) - 1), gy0 = Math.max(0, Math.floor(u[1] * gs) - 1);
    const gx1 = Math.min(GW, Math.ceil(u[2] * gs) + 1), gy1 = Math.min(GW, Math.ceil(u[3] * gs) + 1);
    const gw = gx1 - gx0, gh = gy1 - gy0;
    const cx0 = Math.floor(gx0 * k), cy0 = Math.floor(gy0 * k);
    const cw = Math.min(W, Math.ceil(gx1 * k)) - cx0, ch = Math.min(W, Math.ceil(gy1 * k)) - cy0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(cx0, cy0, cw, ch);
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.globalCompositeOperation = 'source-over';
    gctx.globalAlpha = 1;
    gctx.clearRect(gx0, gy0, gw, gh);
    drewLast = any;
    if (!any || gw <= 0 || gh <= 0) return;
    const s = W / 1000;
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
    let src = gl;
    if (canBlur) {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(gx0, gy0, gw, gh);
      bctx.filter = 'blur(' + Math.max(4.5 / scale.glowDiv, GW / 260).toFixed(1) + 'px)';   // gleiche Weichheit bei kleinerem Puffer
      bctx.drawImage(gl, gx0, gy0, gw, gh, gx0, gy0, gw, gh);
      bctx.filter = 'none';
      bctx.globalCompositeOperation = 'lighter';
      bctx.globalAlpha = 0.55;
      bctx.drawImage(gl, gx0, gy0, gw, gh, gx0, gy0, gw, gh);
      bctx.globalAlpha = 1;
      bctx.globalCompositeOperation = 'source-over';
      src = bl;
    }
    ctx.drawImage(src, gx0, gy0, gw, gh, gx0 * k, gy0 * k, gw * k, gh * k);
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
    scale: () => scale,
    /** Zeichenhilfe: Kreisbogen im Uhrwinkel (Grad) */
    arc(c, cx, cy, r, a0, a1) {
      c.arc(cx, cy, r, ((a0 - 90) * Math.PI) / 180, ((a1 - 90) * Math.PI) / 180, a1 < a0);
    },
  };
})();
