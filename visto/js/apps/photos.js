/* VistoOS · apps/photos.js — Fotos: digitaler Bilderrahmen
 *
 *  Eingebaute „Fotos“ werden prozedural auf Canvas gemalt (Alpenglühen, Meer bei Dämmerung,
 *  Polarlicht über Fichten, Wüstendünen, Nebelwald, Milchstraße) – rund komponiert, mit
 *  Verläufen, Rauschen, Schichten, Glanz und feinem Filmkorn.
 *  Diashow: Ken-Burns-Fahrt, Übergänge „Iris“ (Kreis-Enthüllung), „Weich“ und „Fächer“
 *  (öffnet sich von einem Randpunkt aus, zwei Lichtköpfe laufen am Rand). Antippen zeigt die
 *  Bedienung, waagerecht wischen (Foto gleitet als Scheibe weg) oder am Rand drehen blättert.
 *  Fortschritt der Diashow und des Imports läuft am Rand.
 *  Eigene Fotos: verstecktes <input type=file accept=image/*>, verkleinert (max. 1200 px),
 *  gespeichert in IndexedDB (Rückfall: Arbeitsspeicher).
 *
 *  V.photos = { add(files) → Promise, count(), list(), play(), pause(), next(), prev() }
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#FF6FB5';
  const TAU = Math.PI * 2;
  const S = 1024;               // Kantenlänge der gemalten Bilder
  const MAX_PX = 1200;          // eigene Fotos: längste Kante
  const SLIDE = 8.5;            // Sekunden je Bild
  const TRANS = 1.9;            // Dauer einer Überblendung
  const KB = SLIDE + TRANS + 0.6;
  const hasConic = typeof CanvasRenderingContext2D !== 'undefined' && 'createConicGradient' in CanvasRenderingContext2D.prototype;

  /* ===================================================== Malwerkzeug */

  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const s of stops) g.addColorStop(s[0], s[1]); return g; }
  function rg(c, x, y, r0, r1, stops) { const g = c.createRadialGradient(x, y, r0, x, y, r1); for (const s of stops) g.addColorStop(s[0], s[1]); return g; }
  const rgba = U.rgba;

  /** weiches Licht (additiv) */
  function glow(c, x, y, r, col, a, op) {
    c.save();
    c.globalCompositeOperation = op || 'lighter';
    c.fillStyle = rg(c, x, y, 0, r, [[0, rgba(col, a)], [0.18, rgba(col, a * 0.55)], [0.45, rgba(col, a * 0.18)], [1, rgba(col, 0)]]);
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  function disk(c, x, y, r, inner, outer) {
    c.fillStyle = rg(c, x, y, 0, r, [[0, inner], [0.82, inner], [1, outer || rgba('#ffffff', 0)]]);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }

  /** Wertrauschen 2D (0…1), deterministisch */
  function noise2(seed) {
    const R = U.rng(seed >>> 0);
    const perm = new Uint8Array(512), val = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = R(); }
    for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = val[perm[perm[X] + Y]], b = val[perm[perm[X + 1] + Y]];
      const c = val[perm[perm[X] + Y + 1]], d = val[perm[perm[X + 1] + Y + 1]];
      const ab = a + (b - a) * u, cd = c + (d - c) * u;
      return ab + (cd - ab) * v;
    };
  }
  function fbm(n, x, y, oct, gain) {
    let s = 0, a = 1, norm = 0, f = 1;
    const g = gain || 0.5;
    for (let i = 0; i < oct; i++) { s += a * n(x * f + i * 17.17, y * f + i * 31.7); norm += a; a *= g; f *= 2.03; }
    return s / norm;
  }
  /** kleines Bild aus einer Pixelfunktion fn(x, y, out[r,g,b,a]) */
  function field(w, h, fn) {
    const c = cv(w, h), x = c.getContext('2d');
    const id = x.createImageData(w, h), d = id.data, o = [0, 0, 0, 0];
    let i = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      fn(xx, yy, o);
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = o[3];
      i += 4;
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  let grainC = null;
  function grain(c, amt) {
    if (!grainC) {
      const R = U.rng(77);
      grainC = field(256, 256, (x, y, o) => { const v = 128 + (R() + R() + R() - 1.5) * 120; o[0] = o[1] = o[2] = v; o[3] = 255; });
    }
    c.save();
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = amt;
    c.fillStyle = c.createPattern(grainC, 'repeat');
    c.fillRect(0, 0, S, S);
    c.restore();
  }
  function stars(c, R, n, y0, y1, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const x = R() * S;
      const y = y0 + Math.pow(R(), o.bias || 1) * (y1 - y0);
      const m = Math.pow(R(), o.pow || 6);
      const r = 0.45 + m * (o.maxR || 1.7);
      let a = 0.25 + 0.75 * R();
      if (o.fade) a *= 1 - U.smoothstep(y0, y1, y) * o.fade;
      if (o.mask) a *= o.mask(x, y);
      if (a < 0.03) continue;
      const k = R();
      c.globalAlpha = a;
      c.fillStyle = k < 0.13 ? '#cfe0ff' : k < 0.22 ? '#ffe4c8' : '#ffffff';
      if (r < 1.05) c.fillRect(x, y, r * 1.5, r * 1.5);
      else { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  function brightStar(c, x, y, r, col, cross) {
    glow(c, x, y, r * 7, col, 0.5);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (cross) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        c.strokeStyle = lg(c, x - dx * r * 9, y - dy * r * 9, x + dx * r * 9, y + dy * r * 9, [[0, rgba(col, 0)], [0.5, rgba(col, 0.55)], [1, rgba(col, 0)]]);
        c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(x - dx * r * 9, y - dy * r * 9); c.lineTo(x + dx * r * 9, y + dy * r * 9); c.stroke();
      }
      c.restore();
    }
  }
  /** Gratlinie aus (gratigem) fbm; env(u) formt die Komposition */
  function ridge(n, o) {
    const pts = [];
    for (let x = -24; x <= S + 24; x += o.step || 3) {
      const u = x / S;
      let v = 0, a = 1, f = 1, norm = 0;
      for (let k = 0; k < (o.oct || 6); k++) {
        let nv = n(u * o.scale * f + (o.off || 0), k * 9.1 + (o.row || 0));
        if (o.sharp) nv = 1 - Math.abs(nv * 2 - 1);
        v += nv * a; norm += a; a *= o.gain || 0.5; f *= 2.1;
      }
      v /= norm;
      pts.push([x, o.base - o.amp * v * (o.env ? o.env(u) : 1)]);
    }
    return pts;
  }
  function below(c, pts, fill, bottom) {
    c.beginPath();
    c.moveTo(pts[0][0], bottom || S + 20);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.lineTo(pts[pts.length - 1][0], bottom || S + 20);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
  }
  function strokePts(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }

  /** Fichte als Silhouette mit hängenden Ästen */
  function spruce(c, x, y, h, R, wk) {
    const w = h * (0.25 + R() * 0.08) * (wk || 1);
    const tiers = Math.max(4, Math.min(16, Math.round(h / 9)));
    const pts = [];
    for (let i = 1; i <= tiers; i++) {
      const t = i / tiers;
      const yy = y - h + h * 0.985 * t;
      const half = w * 0.5 * Math.pow(t, 0.8) * (0.78 + R() * 0.44);
      const droop = (h / tiers) * (0.3 + R() * 0.2);
      pts.push({ yy, half, droop, lh: half * (0.78 + R() * 0.44) / (0.78 + 0.22) });
    }
    c.beginPath();
    c.moveTo(x, y - h - h * 0.04);
    for (const p of pts) { c.lineTo(x + p.half, p.yy + p.droop); c.lineTo(x + p.half * 0.22, p.yy + p.droop * 0.1); }
    c.lineTo(x + w * 0.035, y + 2); c.lineTo(x - w * 0.035, y + 2);
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; c.lineTo(x - p.half * 0.22, p.yy + p.droop * 0.1); c.lineTo(x - p.lh, p.yy + p.droop); }
    c.closePath();
    c.fill();
  }

  /* ===================================================== Die Motive */

  /** 1 · Alpenglühen: Sonne sinkt in ein V-Tal, gestaffelte Grate im Dunst */
  function sAlpen(c, R, n) {
    c.fillStyle = lg(c, 0, 0, 0, S * 0.7, [[0, '#060a24'], [0.2, '#141848'], [0.38, '#3a2768'], [0.55, '#8c447f'], [0.7, '#e06a72'], [0.84, '#ffa36e'], [1, '#ffd89c']]);
    c.fillRect(0, 0, S, S);
    stars(c, R, 240, 0, S * 0.32, { fade: 1, maxR: 1.1 });
    const sx = S * 0.5, sy = S * 0.535;
    glow(c, sx, sy, S * 0.95, '#ff6d5a', 0.26);
    glow(c, sx, sy, S * 0.42, '#ffb07a', 0.42);
    // Wolkenschleier, von unten angestrahlt
    const cl = field(256, 96, (x, y, o) => {
      const u = x / 256, v = y / 96;
      let d = fbm(n, u * 4.2 + 3, v * 8.5 + 1.3, 5);
      d = U.smoothstep(0.5, 0.72, d) * U.smoothstep(0, 0.3, v) * (1 - U.smoothstep(0.62, 1, v));
      const lit = U.clamp(1.25 - Math.hypot((u - 0.5) * 1.3, (v - 1.15) * 0.8) * 1.5, 0, 1);
      o[0] = 96 + 159 * lit; o[1] = 52 + 120 * lit; o[2] = 118 + 10 * lit; o[3] = d * 215;
    });
    c.drawImage(cl, -S * 0.06, S * 0.13, S * 1.12, S * 0.36);
    // Sonne
    glow(c, sx, sy, S * 0.12, '#fff1cf', 0.7);
    disk(c, sx, sy, S * 0.04, '#fffaf0', 'rgba(255,236,200,0)');
    // Grate: hinten hell im Dunst, vorn fast schwarz
    const tops = ['#d98293', '#b45f86', '#6e3a6c', '#33203f', '#120b18'];
    const hazes = ['#f2a0a0', '#d77a92', '#9a4f7c', '#4d2c52'];
    const L = 5;
    for (let k = 0; k < L; k++) {
      const t = k / (L - 1);
      const side = 1.3 - t * 0.45;
      const tilt = k % 2 ? 0.08 : -0.06;
      const env = (u) => { const d = Math.abs(u - 0.5 + tilt * (u - 0.5)) * 2; return 0.13 + 0.87 * Math.pow(d, side) + 0.07 * Math.sin(u * 8 + k * 2.3); };
      const base = S * (0.6 + t * 0.3), amp = S * (0.31 - t * 0.07);
      const pts = ridge(n, { base, amp, scale: 2.2 + k * 0.75, sharp: true, oct: 6, env, off: k * 3.1, row: 40 + k * 5 });
      const top = tops[k], bot = U.mix(top, '#05030a', 0.5);
      below(c, pts, lg(c, 0, base - amp, 0, base + S * 0.1, [[0, top], [1, bot]]));
      if (k < 3) {
        // Alpenglühen auf den Graten
        c.save(); c.globalCompositeOperation = 'lighter';
        c.strokeStyle = rgba('#ffb48a', 0.5 * (1 - t * 0.7)); c.lineWidth = 2.4 - t;
        strokePts(c, pts);
        c.restore();
      }
      if (k < L - 1) {
        const hz2 = hazes[k];
        c.fillStyle = lg(c, 0, base - amp * 0.45, 0, base + S * 0.1, [[0, rgba(hz2, 0)], [0.7, rgba(hz2, 0.38)], [1, rgba(hz2, 0.5)]]);
        c.fillRect(0, base - amp * 0.45, S, amp * 0.45 + S * 0.1);
      }
    }
    grain(c, 0.07);
  }

  /** 2 · Meer bei Dämmerung: halb versunkene Sonne, Glitzerpfad, feine Wellen */
  function sSea(c, R, n) {
    const hz = S * 0.56, sx = S * 0.5;
    c.fillStyle = lg(c, 0, 0, 0, hz, [[0, '#060f2c'], [0.3, '#1b2860'], [0.58, '#5a4a8c'], [0.78, '#d0808a'], [0.92, '#ffb88e'], [1, '#ffe1b4']]);
    c.fillRect(0, 0, S, hz + 2);
    stars(c, R, 260, 0, hz * 0.55, { fade: 1, maxR: 1 });
    glow(c, sx, hz, S * 0.85, '#ff8a6a', 0.3);
    glow(c, sx, hz, S * 0.3, '#ffd2a0', 0.5);
    // lange Wolkenstreifen am Horizont
    const cl = field(256, 48, (x, y, o) => {
      const u = x / 256, v = y / 48;
      let d = fbm(n, u * 3.2, v * 4.5 + 7, 5);
      d = U.smoothstep(0.52, 0.68, d) * Math.sin(v * Math.PI);
      const lit = U.clamp(1 - Math.abs(u - 0.5) * 1.6, 0, 1) * (0.4 + v * 0.6);
      o[0] = 70 + 185 * lit; o[1] = 46 + 120 * lit; o[2] = 96 + 40 * lit; o[3] = d * 230;
    });
    c.drawImage(cl, -S * 0.1, hz - S * 0.17, S * 1.2, S * 0.12);
    // Sonne, halb unter dem Horizont
    c.save(); c.beginPath(); c.rect(0, 0, S, hz); c.clip();
    glow(c, sx, hz, S * 0.11, '#fff0cc', 0.75);
    disk(c, sx, hz + S * 0.012, S * 0.052, '#fff8ea', 'rgba(255,230,190,0)');
    c.restore();
    // Wasser
    c.fillStyle = lg(c, 0, hz, 0, S, [[0, '#e9a68e'], [0.03, '#9a6688'], [0.18, '#3e3c70'], [0.5, '#171b3c'], [1, '#04060e']]);
    c.fillRect(0, hz, S, S - hz);
    // Wellen
    c.lineCap = 'round';
    for (let i = 0; i < 3200; i++) {
      const t = Math.pow(R(), 1.7);
      const y = hz + 2 + t * (S - hz);
      const len = (4 + 70 * t) * (0.4 + R());
      const x = R() * S;
      const light = R() < 0.55;
      c.strokeStyle = light ? rgba(U.mix('#ffd6b8', '#8f86c8', U.smoothstep(0, 0.5, t)), (0.05 + 0.16 * (1 - t)) * (0.5 + R())) : rgba('#05061a', 0.18 + 0.2 * t);
      c.lineWidth = 0.6 + 2.6 * t;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + (R() - 0.5) * t * 2); c.stroke();
    }
    // Glitzerpfad
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let y = hz + 1; y < S; y += 1.6) {
      const t = (y - hz) / (S - hz);
      const half = S * (0.022 + 0.2 * Math.pow(t, 0.9));
      const k = 3 + Math.round(t * 14);
      for (let j = 0; j < k; j++) {
        const off = (R() - 0.5) * 2;
        const x = sx + off * half * (0.6 + 0.4 * n(y * 0.05, j));
        const a = Math.pow(1 - t, 1.3) * (0.25 + 0.75 * R()) * (1 - Math.abs(off) * 0.7) * 0.75;
        if (a < 0.02) continue;
        c.fillStyle = rgba(t < 0.12 ? '#fff1d6' : '#ffc89a', a);
        c.fillRect(x, y, (2 + R() * 16) * (0.4 + t * 2), 0.8 + t * 2.2);
      }
    }
    c.restore();
    // Dunstlinie am Horizont
    c.fillStyle = lg(c, 0, hz - 6, 0, hz + 8, [[0, 'rgba(255,224,190,0)'], [0.5, 'rgba(255,224,190,.55)'], [1, 'rgba(255,224,190,0)']]);
    c.fillRect(0, hz - 6, S, 14);
    grain(c, 0.065);
  }

  /** 3 · Polarlicht über Fichten, gespiegelt im See */
  function sAurora(c, R, n) {
    const hz = S * 0.7;
    c.fillStyle = lg(c, 0, 0, 0, hz, [[0, '#010208'], [0.5, '#020a16'], [0.85, '#03141c'], [1, '#062028']]);
    c.fillRect(0, 0, S, S);
    stars(c, R, 1500, 0, hz, { fade: 0.6, maxR: 1.3 });
    for (let i = 0; i < 22; i++) brightStar(c, R() * S, R() * hz * 0.6, 0.9 + R() * 0.8, '#cfe2ff', false);
    // Vorhänge im kleinen Puffer (weich), dann fein darüber
    const Q = 4, A = cv(S / Q), a = A.getContext('2d');
    a.globalCompositeOperation = 'lighter';
    const curtains = [
      { y: 0.5, amp: 0.07, len: 0.34, f: 1.25, ph: 0.6, a: 1, tilt: -0.1 },
      { y: 0.36, amp: 0.05, len: 0.24, f: 2.2, ph: 4.1, a: 0.5, tilt: 0.06 },
    ];
    const baseOf = (cu, u) => S * (cu.y + cu.tilt * (u - 0.5) + cu.amp * (Math.sin(u * TAU * cu.f * 0.5 + cu.ph) * 0.7 + (n(u * 3 + cu.ph, 50) - 0.5) * 1.1));
    for (const cu of curtains) {
      for (let x = 0; x < S / Q; x++) {
        const u = x / (S / Q);
        const by = baseOf(cu, u) / Q;
        const I = cu.a * (0.25 + Math.pow(fbm(n, u * 12 + cu.ph, 3, 3), 2) * 2.4) * (0.45 + 0.55 * Math.sin(u * Math.PI));
        const H = (S * cu.len * (0.6 + 0.8 * n(u * 5 + 9, cu.ph))) / Q;
        a.fillStyle = lg(a, 0, by, 0, by - H, [[0, 'rgba(120,255,170,0)'], [0.05, `rgba(150,255,185,${0.85 * I})`], [0.24, `rgba(60,235,160,${0.55 * I})`], [0.6, `rgba(60,170,200,${0.22 * I})`], [0.86, `rgba(170,90,255,${0.15 * I})`], [1, 'rgba(170,90,255,0)']]);
        a.fillRect(x, by - H, 1.4, H + 3);
        // diffuser Schein unter der Kante
        a.fillStyle = lg(a, 0, by - 1, 0, by + H * 0.42, [[0, `rgba(90,255,170,${0.3 * I})`], [0.35, `rgba(70,220,170,${0.1 * I})`], [1, 'rgba(70,200,170,0)']]);
        a.fillRect(x, by - 1, 1.4, H * 0.42 + 1);
      }
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(A, 0, 0, S, S);
    c.drawImage(A, 0, 0, S, S);
    // feine Strahlen
    for (const cu of curtains) {
      for (let x = 0; x < S; x += 2) {
        const u = x / S;
        const I = cu.a * Math.pow(fbm(n, u * 40 + cu.ph, 7, 3), 3) * 1.8;
        if (I < 0.05) continue;
        const by = baseOf(cu, u);
        const H = S * cu.len * (0.5 + 0.7 * n(u * 5 + 9, cu.ph));
        c.fillStyle = lg(c, 0, by, 0, by - H, [[0, 'rgba(180,255,210,0)'], [0.05, `rgba(190,255,210,${0.35 * I})`], [0.5, `rgba(80,230,170,${0.12 * I})`], [1, 'rgba(120,120,255,0)']]);
        c.fillRect(x, by - H, 1, H);
      }
    }
    glow(c, S * 0.5, S * 0.52, S * 0.62, '#38e0a0', 0.13);
    c.restore();
    // ferne Hügel und Ufer
    const hill = ridge(n, { base: hz, amp: S * 0.055, scale: 2, oct: 5, off: 7, row: 20 });
    below(c, hill, '#030a10', hz + 6);
    c.fillStyle = '#020609';
    c.fillRect(0, hz - 1, S, 7);
    // Fichten am Ufer (am Rand größer: rahmt den Kreis)
    c.fillStyle = '#010407';
    for (let i = 0; i < 140; i++) {
      const u = R();
      const edge = Math.pow(Math.abs(u - 0.5) * 2, 2.2);
      const h = S * (0.025 + 0.05 * R() + 0.2 * edge * (0.6 + 0.4 * R()));
      spruce(c, u * S, hz + 2, h, R);
    }
    // Spiegelung im See
    const H = S - hz - 4;
    const T = cv(S, Math.ceil(H)); const tx = T.getContext('2d');
    tx.drawImage(c.canvas, 0, hz - H, S, H, 0, 0, S, H);
    for (let j = 0; j < H; j += 2) {
      const t = j / H;
      const dx = Math.sin(j * 0.31 + n(j * 0.05, 3) * 6) * (0.5 + 5 * t);
      c.globalAlpha = 0.62 - t * 0.25;
      c.drawImage(T, 0, H - j - 2, S, 2, dx, hz + 4 + j, S, 2);
    }
    c.globalAlpha = 1;
    c.fillStyle = lg(c, 0, hz, 0, S, [[0, 'rgba(0,4,10,.25)'], [1, 'rgba(0,3,8,.75)']]);
    c.fillRect(0, hz + 4, S, S - hz);
    c.fillStyle = 'rgba(160,255,210,.16)';
    c.fillRect(0, hz + 3, S, 1.2);
    grain(c, 0.08);
  }

  /** 4 · Wüstendünen im Abendlicht: scharfe Grate, Schattenseiten, Rippel, Mondsichel */
  function sDunes(c, R, n) {
    const hz = S * 0.6;
    c.fillStyle = lg(c, 0, 0, 0, hz, [[0, '#141c48'], [0.26, '#3a3c76'], [0.48, '#875683'], [0.68, '#dc8478'], [0.86, '#f7b27e'], [1, '#ffdcaa']]);
    c.fillRect(0, 0, S, S);
    stars(c, R, 120, 0, S * 0.26, { fade: 1, maxR: 0.9 });
    // Mondsichel
    const M = cv(80), mx = M.getContext('2d');
    mx.fillStyle = '#fff4de'; mx.beginPath(); mx.arc(40, 40, 18, 0, TAU); mx.fill();
    mx.globalCompositeOperation = 'destination-out'; mx.beginPath(); mx.arc(48, 34, 17, 0, TAU); mx.fill();
    glow(c, S * 0.69, S * 0.21, S * 0.07, '#fff4de', 0.18);
    c.drawImage(M, S * 0.69 - 40, S * 0.21 - 40);
    // Sonne
    const sx = S * 0.34, sy = S * 0.535;
    glow(c, sx, sy, S * 0.95, '#ff8c5e', 0.28);
    glow(c, sx, sy, S * 0.26, '#ffd7a4', 0.55);
    disk(c, sx, sy, S * 0.034, '#fff8ea', 'rgba(255,230,200,0)');
    c.fillStyle = lg(c, 0, hz - S * 0.09, 0, hz + S * 0.03, [[0, 'rgba(255,205,165,0)'], [1, 'rgba(255,205,165,.45)']]);
    c.fillRect(0, hz - S * 0.09, S, S * 0.12);
    const layers = [
      { base: 0.625, amp: 0.06, peaks: [[0.12, 0.8], [0.55, 1], [0.86, 0.7]], w: 0.16, d: 0, lit: '#efab8c', sh: '#b97a92' },
      { base: 0.69, amp: 0.1, peaks: [[0.3, 1], [0.8, 0.85]], w: 0.2, d: 0.25, lit: '#f6a878', sh: '#99566e' },
      { base: 0.78, amp: 0.13, peaks: [[0.06, 0.75], [0.6, 1]], w: 0.24, d: 0.5, lit: '#faa864', sh: '#7a3846' },
      { base: 0.9, amp: 0.16, peaks: [[0.34, 1], [0.97, 0.8]], w: 0.29, d: 0.75, lit: '#f79a4e', sh: '#5a2430' },
      { base: 1.04, amp: 0.19, peaks: [[0.74, 1]], w: 0.38, d: 1, lit: '#ee8a3e', sh: '#3e161c' },
    ];
    for (const L of layers) {
      const lit = L.lit, lit2 = U.mix(L.lit, '#7a2e22', 0.35 + 0.2 * L.d);
      const sh = L.sh;
      const base = S * L.base, amp = S * L.amp;
      const bump = (dx, w) => (dx < 0 ? Math.exp(-Math.pow(-dx / (w * 1.15), 1.25)) : Math.exp(-Math.pow(dx / (w * 0.52), 1.25)));
      const yAt = (x) => {
        let m = 0;
        for (const p of L.peaks) m = Math.max(m, p[1] * bump(x / S - p[0], L.w));
        return base - amp * m - S * 0.006 * (n(x * 0.004, L.base * 10) - 0.5);
      };
      const pts = [];
      for (let x = -20; x <= S + 20; x += 3) pts.push([x, yAt(x)]);
      c.save();
      below(c, pts, lg(c, 0, base - amp, 0, base + S * 0.12, [[0, lit], [1, lit2]]));
      c.clip();
      // Rippel
      c.lineWidth = 1.3;
      for (let j = 1; j < 26; j++) {
        c.strokeStyle = rgba(sh, 0.09 + 0.05 * L.d);
        c.beginPath();
        for (let x = -20; x <= S + 20; x += 6) {
          const y = yAt(x) + j * (5 + 7 * L.d) + Math.sin(x * 0.03 + j * 1.7) * (2 + 3 * L.d) + (n(x * 0.01, j) - 0.5) * 8;
          x === -20 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
      }
      // Schattenseiten
      for (const p of L.peaks) {
        const px = p[0] * S, py = yAt(px);
        const depth = S * 0.35;
        const crest = [];
        for (let t = 0; t <= 1.001; t += 0.05) {
          crest.push([px - S * L.w * 0.55 * Math.pow(t, 0.9) + S * L.w * 0.22 * Math.sin(t * Math.PI), py + t * depth]);
        }
        // Schattenhang endet im nächsten Tal
        let xr = px, prev = py;
        for (let x = px + 3; x < px + S * L.w * 2.6; x += 3) {
          const y = yAt(x);
          if (y < prev - 0.4) break;
          prev = y; xr = x;
        }
        const end = crest[crest.length - 1];
        c.beginPath();
        c.moveTo(crest[0][0], crest[0][1]);
        for (const q of crest) c.lineTo(q[0], q[1]);
        c.quadraticCurveTo(U.lerp(end[0], xr, 0.75), end[1], xr, yAt(xr) + S * 0.02);
        for (let x = xr; x >= px; x -= 3) c.lineTo(x, yAt(x));
        c.closePath();
        c.fillStyle = lg(c, px, py, px + S * L.w, py + depth * 0.6, [[0, U.mix(sh, lit, 0.12)], [0.5, sh], [1, U.mix(sh, '#000000', 0.3)]]);
        c.fill();
        // Messerkante im Licht
        c.strokeStyle = rgba('#ffe2c4', 0.45 * (1 - L.d * 0.4));
        c.lineWidth = 1.6;
        c.beginPath();
        crest.slice(0, 13).forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
        c.stroke();
      }
      c.restore();
      // Lichtsaum oben
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba('#ffd2a6', 0.28 * (1 - L.d * 0.6)); c.lineWidth = 1.5;
      strokePts(c, pts);
      c.restore();
    }
    grain(c, 0.065);
  }

  /** 5 · Nebelwald: Fichtenreihen verschwinden im Morgennebel, Lichtstrahlen */
  function sForest(c, R, n) {
    c.fillStyle = lg(c, 0, 0, 0, S, [[0, '#6f8c8e'], [0.3, '#a9bfba'], [0.52, '#d5e0d8'], [0.72, '#a4b7ae'], [1, '#3e524c']]);
    c.fillRect(0, 0, S, S);
    glow(c, S * 0.64, S * 0.22, S * 0.75, '#fff3d6', 0.5, 'screen');
    glow(c, S * 0.64, S * 0.22, S * 0.18, '#fffaf0', 0.6, 'screen');
    const fog = '#d3ddd6';
    const L = 6;
    for (let k = 0; k < L; k++) {
      const t = k / (L - 1);
      const col = U.mix('#b9c9c2', '#0d1916', Math.pow(t, 1.15));
      const gy = (x) => S * (0.47 + t * 0.33) + S * 0.025 * (n(x * 0.003 + k * 7, k) - 0.5) * 2;
      c.fillStyle = col;
      const count = 70 - k * 8;
      for (let i = 0; i < count; i++) {
        const u = (i + R() * 0.9) / count;
        const x = u * S * 1.08 - S * 0.04;
        const h = S * (0.09 + t * 0.26) * (0.55 + 0.7 * R());
        spruce(c, x, gy(x), h, R);
      }
      const pts = [];
      for (let x = -20; x <= S + 20; x += 8) pts.push([x, gy(x) - 1]);
      below(c, pts, col);
      if (k < L - 1) {
        // Nebel sammelt sich zwischen den Reihen
        const ft = S * (0.32 + t * 0.3), fb = gy(S / 2) + S * 0.04;
        c.fillStyle = lg(c, 0, ft, 0, fb, [[0, rgba(fog, 0)], [1, rgba(fog, 0.42 - t * 0.12)]]);
        c.fillRect(0, ft, S, S - ft);
        const mist = field(128, 64, (x, y, o) => {
          const v = fbm(n, x / 128 * 5 + k * 3, y / 64 * 3 + k, 4);
          o[0] = 222; o[1] = 230; o[2] = 224; o[3] = U.smoothstep(0.45, 0.75, v) * Math.sin((y / 64) * Math.PI) * 150;
        });
        c.drawImage(mist, -S * 0.1, gy(S / 2) - S * 0.12, S * 1.2, S * 0.2);
      }
    }
    // Lichtstrahlen
    const G = cv(256), gx = G.getContext('2d');
    gx.globalCompositeOperation = 'lighter';
    const ox = 256 * 0.66, oy = 256 * 0.12;
    for (let i = 0; i < 16; i++) {
      const ang = U.lerp(0.42, 0.95, R()) * Math.PI;
      const w = 0.01 + R() * 0.03;
      gx.fillStyle = rg(gx, ox, oy, 0, 300, [[0, 'rgba(255,248,226,0)'], [0.15, `rgba(255,248,226,${0.1 + R() * 0.12})`], [1, 'rgba(255,248,226,0)']]);
      gx.beginPath(); gx.moveTo(ox, oy);
      gx.lineTo(ox + Math.cos(ang - w) * 400, oy + Math.sin(ang - w) * 400);
      gx.lineTo(ox + Math.cos(ang + w) * 400, oy + Math.sin(ang + w) * 400);
      gx.closePath(); gx.fill();
    }
    c.save(); c.globalCompositeOperation = 'screen'; c.drawImage(G, 0, 0, S, S); c.restore();
    // Rahmen: dunkle Fichten vorn links und rechts
    c.fillStyle = '#060e0c';
    spruce(c, S * 0.12, S * 1.02, S * 0.8, R, 0.9);
    spruce(c, S * 0.88, S * 1.03, S * 0.72, R, 0.9);
    spruce(c, S * 0.02, S * 1.02, S * 0.6, R, 0.9);
    // Bodennebel vorn
    const low = field(128, 32, (x, y, o) => {
      const v = fbm(n, x / 128 * 6 + 40, y / 32 * 2, 4);
      o[0] = 200; o[1] = 214; o[2] = 208; o[3] = U.smoothstep(0.4, 0.7, v) * Math.sin((y / 32) * Math.PI) * 120;
    });
    c.drawImage(low, -S * 0.1, S * 0.74, S * 1.2, S * 0.14);
    c.fillStyle = lg(c, 0, S * 0.84, 0, S, [[0, 'rgba(6,14,12,0)'], [1, 'rgba(6,14,12,.92)']]);
    c.fillRect(0, S * 0.84, S, S * 0.16);
    grain(c, 0.07);
  }

  /** 6 · Sternenhimmel: Milchstraße mit Staubbändern, Hügel, Zelt mit Licht */
  function sStars(c, R, n) {
    c.fillStyle = lg(c, 0, 0, 0, S, [[0, '#020309'], [0.5, '#060a1c'], [0.78, '#12153a'], [0.88, '#291f40'], [1, '#3a2832']]);
    c.fillRect(0, 0, S, S);
    glow(c, S * 0.5, S * 0.88, S * 0.6, '#ff8a5a', 0.15);
    // Band von unten links nach oben rechts
    const ax = 0.12, ay = 0.98, bx = 0.92, by = 0.04;
    const dxL = bx - ax, dyL = by - ay, len = Math.hypot(dxL, dyL);
    const distTo = (u, v) => Math.abs((u - ax) * dyL - (v - ay) * dxL) / len;
    const along = (u, v) => ((u - ax) * dxL + (v - ay) * dyL) / (len * len);
    const N = 320;
    const sgn = (u, v) => ((u - ax) * dyL - (v - ay) * dxL) / len;
    const mw = field(N, N, (x, y, o) => {
      const u = x / N, v = y / N;
      const d = sgn(u, v), s = along(u, v);
      const wid = 0.1 + 0.05 * Math.exp(-Math.pow((s - 0.3) / 0.2, 2));
      const band = Math.exp(-Math.pow(d / wid, 2));
      if (band < 0.01) { o[3] = 0; return; }
      // Struktur entlang des Bandes gestreckt
      const cl = fbm(n, s * 9, d * 17, 5);
      const fine = fbm(n, s * 30 + 3, d * 48 + 9, 3);
      const rift = 0.018 * Math.sin(s * 10) + 0.03 * (fbm(n, s * 4 + 20, 1, 3) - 0.5);
      const dust = Math.exp(-Math.pow((d - rift) / (0.022 + 0.02 * fbm(n, s * 9, 7, 3)), 2)) * U.smoothstep(0.08, 0.3, s) * (0.55 + 0.45 * fine);
      const core = Math.exp(-Math.pow((s - 0.3) / 0.16, 2));
      let I = band * (0.2 + 0.85 * U.smoothstep(0.32, 0.72, cl) + 0.25 * U.smoothstep(0.4, 0.7, fine)) * (0.5 + 0.7 * core) * (1 - 0.9 * dust);
      I = U.clamp(I * 0.62, 0, 1);
      const warm = U.clamp(core * 0.9 + 0.1, 0, 1);
      const pink = U.smoothstep(0.66, 0.74, fbm(n, s * 18 + 40, d * 40, 3)) * band * 0.4;
      o[0] = U.lerp(U.lerp(150, 255, warm), 255, pink);
      o[1] = U.lerp(U.lerp(168, 224, warm), 136, pink);
      o[2] = U.lerp(U.lerp(255, 190, warm), 200, pink);
      o[3] = 255 * I;
    });
    c.save(); c.globalCompositeOperation = 'lighter';
    // Schein (Bloom) aus einer kleinen Kopie, dann das scharfe Band
    const bl = cv(64), bx2 = bl.getContext('2d');
    bx2.drawImage(mw, 0, 0, 64, 64);
    c.globalAlpha = 0.45;
    c.drawImage(bl, 0, 0, S, S);
    c.globalAlpha = 1;
    c.drawImage(mw, 0, 0, S, S);
    c.restore();
    // Sterne, im Band dichter
    const bandMask = (x, y) => 0.35 + 0.65 * Math.exp(-Math.pow(distTo(x / S, y / S) / 0.2, 2));
    stars(c, R, 2600, 0, S * 0.9, { maxR: 1.2, mask: bandMask, fade: 0.4 });
    for (let i = 0; i < 2200; i++) {
      const s = R(), off = (R() + R() + R() - 1.5) * 0.12;
      const u = ax + dxL * s - (dyL / len) * off, v = ay + dyL * s + (dxL / len) * off;
      c.globalAlpha = 0.25 + 0.6 * R();
      c.fillStyle = R() < 0.2 ? '#ffe8d0' : '#ffffff';
      c.fillRect(u * S, v * S, 1.1, 1.1);
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 26; i++) brightStar(c, R() * S, R() * S * 0.78, 0.9 + R(), R() < 0.3 ? '#ffd9b0' : '#d6e4ff', i < 5);
    // Hügel, Baum, Zelt
    const far = ridge(n, { base: S * 0.83, amp: S * 0.07, scale: 2.4, oct: 6, sharp: true, off: 13, row: 70 });
    below(c, far, lg(c, 0, S * 0.76, 0, S * 0.86, [[0, '#0b0b1c'], [1, '#07070f']]));
    const hill = ridge(n, { base: S * 0.86, amp: S * 0.13, scale: 1.3, oct: 5, off: 3, row: 60, env: (u) => 0.3 + 0.7 * Math.exp(-Math.pow((u - 0.68) / 0.26, 2)) });
    below(c, hill, '#020207');
    const hy = (x) => { const i = U.clamp(Math.round((x + 24) / 3), 0, hill.length - 1); return hill[i][1]; };
    c.fillStyle = '#020207';
    spruce(c, S * 0.69, hy(S * 0.69) + 4, S * 0.17, R, 0.85);
    spruce(c, S * 0.735, hy(S * 0.735) + 4, S * 0.11, R, 0.85);
    spruce(c, S * 0.765, hy(S * 0.765) + 4, S * 0.07, R, 0.85);
    const tx = S * 0.37, ty = hy(S * 0.37) + 3;
    glow(c, tx, ty - 12, S * 0.12, '#ff9a48', 0.32);
    c.fillStyle = lg(c, tx, ty - 34, tx, ty, [[0, '#ffd08a'], [1, '#ff8a3a']]);
    c.beginPath(); c.moveTo(tx - 30, ty); c.lineTo(tx, ty - 34); c.lineTo(tx + 30, ty); c.closePath(); c.fill();
    c.fillStyle = 'rgba(80,30,10,.6)';
    c.beginPath(); c.moveTo(tx - 5, ty); c.lineTo(tx, ty - 18); c.lineTo(tx + 5, ty); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,170,90,.22)';
    c.beginPath(); c.ellipse(tx, ty + 2, 60, 6, 0, 0, TAU); c.fill();
    grain(c, 0.08);
  }

  const SCENES = [
    { id: 'alpen', title: 'Alpenglühen', sub: 'Dolomiten · Abend', seed: 1201, draw: sAlpen },
    { id: 'meer', title: 'Meer bei Dämmerung', sub: 'Atlantik · Blaue Stunde', seed: 3307, draw: sSea },
    { id: 'polarlicht', title: 'Polarlicht', sub: 'Lappland · Nacht', seed: 5521, draw: sAurora },
    { id: 'duenen', title: 'Wüstendünen', sub: 'Erg Chebbi · Sonnenuntergang', seed: 7741, draw: sDunes },
    { id: 'nebelwald', title: 'Nebelwald', sub: 'Schwarzwald · Morgen', seed: 9103, draw: sForest },
    { id: 'sterne', title: 'Sternenhimmel', sub: 'Milchstraße · Neumond', seed: 4409, draw: sStars },
  ];

  function renderScene(sc) {
    const c = cv(S), x = c.getContext('2d');
    const t0 = performance.now();
    try { sc.draw(x, U.rng(sc.seed), noise2(sc.seed)); } catch (e) { console.error('[VistoOS] Fotos: Motiv', sc.id, e); }
    sc.ms = Math.round(performance.now() - t0);
    return c;
  }

  /* ===================================================== Speicher */

  const db = (function () {
    const mem = new Map();
    let dbP = null;
    function open() {
      if (dbP) return dbP;
      dbP = new Promise((res) => {
        let rq = null;
        try { rq = window.indexedDB ? indexedDB.open('vistoos-fotos', 1) : null; } catch (e) { rq = null; }
        if (!rq) { res(null); return; }
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore('fotos', { keyPath: 'id' }); } catch (e) { /* schon da */ } };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
        rq.onblocked = () => res(null);
        setTimeout(() => res(null), 3000);
      });
      return dbP;
    }
    function run(d, mode, fn) {
      return new Promise((res, rej) => {
        try {
          const tx = d.transaction('fotos', mode);
          const r = fn(tx.objectStore('fotos'));
          tx.oncomplete = () => res(r && r.result);
          tx.onerror = () => rej(tx.error);
          tx.onabort = () => rej(tx.error);
        } catch (e) { rej(e); }
      });
    }
    function revive(r) {
      if (r && !r.blob && r.buf) { try { r.blob = new Blob([r.buf], { type: r.type || 'image/jpeg' }); } catch (e) { /* */ } }
      return r;
    }
    const api = {
      persistent: null,
      async all() {
        const d = await open();
        if (d) {
          try {
            const list = await run(d, 'readonly', (st) => st.getAll());
            for (const r of list || []) if (r && r.id) mem.set(r.id, revive(r));
            api.persistent = true;
          } catch (e) { api.persistent = false; }
        } else api.persistent = false;
        return Array.from(mem.values());
      },
      async put(rec) {
        mem.set(rec.id, rec);
        const d = await open();
        if (!d) { api.persistent = false; return false; }
        try { await run(d, 'readwrite', (st) => st.put(rec)); return true; } catch (e) {
          // manche Browser speichern keine Blobs: als Bytes ablegen
          try {
            const buf = await rec.blob.arrayBuffer();
            const alt = { id: rec.id, w: rec.w, h: rec.h, added: rec.added, name: rec.name, buf, type: rec.blob.type };
            await run(d, 'readwrite', (st) => st.put(alt));
            return true;
          } catch (e2) { api.persistent = false; return false; }
        }
      },
      async del(id) {
        mem.delete(id);
        const d = await open();
        if (!d) return;
        try { await run(d, 'readwrite', (st) => st.delete(id)); } catch (e) { /* */ }
      },
    };
    return api;
  })();

  let userRecs = [];          // eigene Fotos, neueste zuerst
  let loadP = null;
  function loadUser() {
    if (!loadP) {
      loadP = db.all().then((list) => {
        userRecs = list.filter((r) => r && r.blob).sort((a, b) => (b.added || 0) - (a.added || 0));
        V.emit('photos:changed');
        return userRecs;
      }).catch(() => userRecs);
    }
    return loadP;
  }

  /* -------------------------------------------- Bilder dekodieren */
  const images = new Map();   // id → {img, w, h}
  const decoding = new Map();
  function decode(blob) {
    const viaImg = () => new Promise((res, rej) => {
      let url;
      try { url = URL.createObjectURL(blob); } catch (e) { rej(e); return; }
      const im = new Image();
      im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(url), 2000); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Bild nicht lesbar')); };
      im.src = url;
    });
    if (window.createImageBitmap) return createImageBitmap(blob).catch(viaImg);
    return viaImg();
  }
  function trim() {
    const own = Array.from(images.keys()).filter((k) => !SCENES.some((s) => s.id === k));
    while (own.length > 8) images.delete(own.shift());
  }
  function imageNow(item) {
    let im = images.get(item.id);
    if (!im && item.kind === 'scene') { im = { img: renderScene(item.scene), w: S, h: S }; images.set(item.id, im); }
    return im || null;
  }
  function imageLater(item) {
    const now = imageNow(item);
    if (now) return Promise.resolve(now);
    if (decoding.has(item.id)) return decoding.get(item.id);
    const p = decode(item.rec.blob).then((img) => {
      const im = { img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
      images.set(item.id, im); trim();
      return im;
    }).catch(() => null).finally(() => decoding.delete(item.id));
    decoding.set(item.id, p);
    return p;
  }

  /* -------------------------------------------- Fotos hinzufügen */
  async function shrink(file) {
    const src = await decode(file);
    const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
    if (!w0 || !h0) throw new Error('leeres Bild');
    const k = Math.min(1, MAX_PX / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = cv(w, h), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    const blob = await new Promise((res) => { try { c.toBlob((b) => res(b), 'image/jpeg', 0.88); } catch (e) { res(null); } });
    const rec = { id: U.uid('foto'), blob: blob || file, w, h, added: Date.now(), name: String(file.name || '').slice(0, 80) };
    images.set(rec.id, { img: c, w, h });
    return rec;
  }
  async function addFiles(files, onEach) {
    await loadUser();
    const added = [];
    for (const f of files) {
      try {
        if (f && f.type && !/^image\//.test(f.type)) throw new Error('kein Bild');
        const rec = await shrink(f);
        await db.put(rec);
        added.push(rec);
      } catch (e) { console.warn('[VistoOS] Foto übersprungen:', e && e.message); }
      if (onEach) onEach();
    }
    if (added.length) {
      userRecs = added.slice().reverse().concat(userRecs);
      trim();
      V.emit('photos:changed');
    }
    return added;
  }
  async function removePhoto(id) {
    userRecs = userRecs.filter((r) => r.id !== id);
    images.delete(id);
    await db.del(id);
    V.emit('photos:changed');
  }

  function items() {
    const own = userRecs.map((r) => ({ kind: 'user', id: r.id, rec: r, title: 'Eigenes Foto', sub: 'Hinzugefügt · ' + V.fmt.relDay(new Date(r.added || Date.now())) }));
    return own.concat(SCENES.map((s) => ({ kind: 'scene', id: s.id, scene: s, title: s.title, sub: s.sub })));
  }

  /* ===================================================== App */

  const live = { inst: null };
  let pending = null;          // Wunsch aus Sprache/Aktion, bevor die App offen ist

  function request(o) {
    pending = Object.assign(pending || {}, o);
    // während Visto spricht, erst nach dem Schließen ausführen (sonst geschieht es unsichtbar)
    if (live.inst && !(V.convo && V.convo.active)) live.inst.apply();
  }

  V.css('photos', `
    .ph-root { background: #000; }
    .ph-cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .ph-topshade { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .8s ease;
      background: radial-gradient(70% 30% at 50% 0%, rgba(0,0,0,.55), rgba(0,0,0,0) 100%); }
    .ph-title { opacity: 0; transition: opacity .8s ease; pointer-events: none; filter: drop-shadow(0 0 .7cqw rgba(0,0,0,.6)); }
    .ph-on { opacity: 1; }
    .ph-ctl { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
    .ph-ctl.ph-live { pointer-events: auto; }
    .ph-shade { position: absolute; inset: 0;
      background: radial-gradient(circle at 50% 50%, rgba(0,0,0,.22) 0%, rgba(0,0,0,.38) 55%, rgba(0,0,0,.72) 100%); }
    .ph-sub { position: absolute; left: 18cqw; right: 18cqw; top: 15.2cqw; text-align: center; color: rgba(255,255,255,.78);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 0 1.4cqw rgba(0,0,0,.6); }
    .ph-row { position: absolute; left: 0; right: 0; top: 50%; display: flex; align-items: center; justify-content: center; gap: 6.5cqw; }
    .ph-bottom { position: absolute; left: 0; right: 0; top: 68.5cqw; display: flex; align-items: center; justify-content: center; gap: 2.6cqw; }
    .ph-glass { background: rgba(255,255,255,.17); color: #fff;
      -webkit-backdrop-filter: blur(2.6cqw) saturate(1.6); backdrop-filter: blur(2.6cqw) saturate(1.6);
      box-shadow: inset 0 0 0 .2cqw rgba(255,255,255,.16), 0 1cqw 4cqw rgba(0,0,0,.25); }
    .ph-glass:active { background: rgba(255,255,255,.3); }
    .ph-play { background: #fff; color: #000; box-shadow: 0 1cqw 5cqw rgba(0,0,0,.35); }
    .ph-row .vos-round:not(.lg) { width: 15cqw; height: 15cqw; }
    .ph-row .vos-round:not(.lg) svg { width: 6cqw; height: 6cqw; }
    .ph-add { height: 11.5cqw; padding: 0 5.4cqw 0 4.4cqw; }
    .ph-del { width: 11.5cqw; height: 11.5cqw; }
    .ph-dots circle { transition: r .4s var(--spring), opacity .3s; }
    .ph-hint { position: absolute; left: 22cqw; right: 22cqw; top: 76cqw; text-align: center; color: rgba(255,255,255,.82);
      font-size: 3.3cqw; font-weight: 560; line-height: 1.35; white-space: pre-line; letter-spacing: .01em; text-shadow: 0 0 1.6cqw rgba(0,0,0,.8);
      opacity: 0; transform: translateY(1.5cqw); transition: opacity .7s ease, transform .9s var(--ease); pointer-events: none; }
    .ph-hint.ph-on { opacity: 1; transform: none; }
    .ph-paused { position: absolute; left: 0; right: 0; top: 33cqw; text-align: center; color: rgba(255,255,255,.7); opacity: 0; transition: opacity .4s; }
  `);

  V.apps.register({
    id: 'photos',
    name: 'Fotos',
    icon: 'photos',
    color: COLOR,
    order: 80,
    keywords: ['fotos', 'foto', 'bilder', 'bilderrahmen', 'diashow', 'galerie'],
    keepAwake: () => !!(live.inst && live.inst.playing),

    init() {
      V.photos = {
        add: (files) => (live.inst ? live.inst.importFiles(Array.from(files || [])) : addFiles(Array.from(files || []))),
        count: () => SCENES.length + userRecs.length,
        list: () => items().map((i) => ({ id: i.id, title: i.title, own: i.kind === 'user' })),
        play: () => request({ play: true }),
        pause: () => request({ play: false }),
        next: () => request({ step: 1 }),
        prev: () => request({ step: -1 }),
        show: (i, type) => live.inst && live.inst.go(i, type),
        scenes: () => SCENES.map((s) => ({ id: s.id, title: s.title, ms: s.ms })),
        render: (i) => renderScene(SCENES[U.clamp(i | 0, 0, SCENES.length - 1)]),
      };

      V.on('convo:close', () => setTimeout(() => { if (live.inst && pending) live.inst.apply(); }, 420));

      V.actions.register('photos.open', {
        desc: 'Öffnet die Fotos-App (digitaler Bilderrahmen). slideshow=true startet die Diashow.',
        params: { slideshow: { type: 'boolean', description: 'Diashow sofort starten' } },
        run(a) {
          request({ play: a.slideshow !== false });
          return { say: a.slideshow === false ? 'Hier sind deine Fotos.' : 'Ich starte die Diashow.', open: 'photos', emotion: 'happy' };
        },
      });
      V.actions.register('photos.control', {
        desc: 'Steuert die Diashow der Fotos-App: command = play, pause, next oder previous.',
        params: { command: { type: 'string', enum: ['play', 'pause', 'next', 'previous'] } },
        required: ['command'],
        run(a) {
          const cmd = String(a.command || 'play');
          if (cmd === 'pause') { request({ play: false }); return { say: 'Diashow angehalten.', open: 'photos' }; }
          if (cmd === 'next' || cmd === 'previous') { request({ step: cmd === 'next' ? 1 : -1 }); return { say: cmd === 'next' ? 'Nächstes Foto.' : 'Vorheriges Foto.', open: 'photos' }; }
          request({ play: true });
          return { say: 'Die Diashow läuft.', open: 'photos', emotion: 'happy' };
        },
      });

      V.brain.intent({
        id: 'photos-slideshow', priority: 8,
        match: [/(?<![a-zäöüß])(diashow|dia-show|slideshow|bilderrahmen)(?![a-zäöüß])/],
        run(m, t) {
          if (/(?<![a-zäöüß])(stopp\w*|stop|beende\w*|pausier\w*|anhalten|halt an|halte)(?![a-zäöüß])/.test(t)) {
            if (!live.inst) return { say: 'Gerade läuft keine Diashow.', emotion: 'confused' };
            return V.actions.run('photos.control', { command: 'pause' });
          }
          return V.actions.run('photos.open', { slideshow: true });
        },
      });
      V.brain.intent({
        id: 'photos-step', priority: 8,
        match: [/(?<![a-zäöüß])(nächste[sn]?|vorherige[sn]?|letzte[sn]?|vorige[sn]?|anderes?)\s+(foto|bild)(?![a-zäöüß])/],
        run(m) {
          const back = /^(vorherige|letzte|vorige)/.test(m[1]);
          return V.actions.run('photos.control', { command: back ? 'previous' : 'next' });
        },
      });
      V.brain.intent({
        id: 'photos-show', priority: 7,
        match: [/(?<![a-zäöüß])(zeig\w*|öffne\w*|sehen|anschauen|ansehen)(?![a-zäöüß]).*(?<![a-zäöüß])(fotos?|bilder|photos?|urlaubsbilder|galerie)(?![a-zäöüß])/, /^(meine |die )?(fotos|bilder|galerie)$/],
        run() {
          request({ play: true });
          return { say: 'Hier sind deine Fotos.', open: 'photos', emotion: 'happy' };
        },
      });
    },

    create(ctx) {
      const root = ctx.root;
      root.classList.add('ph-root');
      const data = ctx.store;
      if (typeof data.index !== 'number') data.index = 0;

      /* ---------- Leinwand */
      const cvs = U.el('canvas', { class: 'ph-cv', attrs: { 'aria-label': 'Foto' } });
      const g = cvs.getContext('2d', { alpha: false }) || cvs.getContext('2d');
      const buf = document.createElement('canvas');
      const bg = buf.getContext('2d');
      let W = 0, vig = null, dirty = true;
      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(64, Math.round((V.display.size || 360) * dpr));
        cvs.width = cvs.height = W;
        buf.width = buf.height = W;
        vig = g.createRadialGradient(W / 2, W / 2, W * 0.28, W / 2, W / 2, W * 0.5);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(0.72, 'rgba(0,0,0,.1)');
        vig.addColorStop(1, 'rgba(0,0,0,.5)');
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = 'high';
        dirty = true;
      }
      resize();
      ctx.on('display:resize', resize);

      /* ---------- Titel am Bogen, Bedienung */
      const topShade = U.el('div', { class: 'ph-topshade' });
      const title = V.ui.arcText({ text: '', r: 447, size: 30, weight: 700, spacing: 4.6, color: 'rgba(255,255,255,.95)', cls: 'ph-title' });
      const ctl = U.el('div', { class: 'ph-ctl' });
      const shade = U.el('div', { class: 'ph-shade' });
      const dots = U.svg('svg', { class: 'vos-svg ph-dots', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      const sub = U.el('div', { class: 'vos-label ph-sub' });
      const pausedL = U.el('div', { class: 'vos-label ph-paused', text: 'Pausiert' });
      const row = U.el('div', { class: 'ph-row' });
      const prevB = V.ui.roundButton('prev', { label: 'Vorheriges Foto', cls: 'ph-glass', onClick: () => { poke(); go(-1, { type: 'fan', manual: true }); } });
      const playB = V.ui.roundButton('pause', { kind: 'lg', label: 'Diashow anhalten', cls: 'ph-play', onClick: () => { poke(); setPlaying(!playing); } });
      const nextB = V.ui.roundButton('next', { label: 'Nächstes Foto', cls: 'ph-glass', onClick: () => { poke(); go(1, { type: 'fan', manual: true }); } });
      row.append(prevB, playB, nextB);
      const bottom = U.el('div', { class: 'ph-bottom' });
      const addB = V.ui.button('Hinzufügen', { icon: 'plus', cls: 'ph-glass ph-add', onClick: () => { poke(); pick(); } });
      const delB = V.ui.roundButton('trash', { label: 'Foto löschen', cls: 'ph-glass ph-del', onClick: () => { poke(); removeCurrent(); } });
      bottom.append(addB, delB);
      ctl.append(shade, dots, sub, pausedL, row, bottom);
      const input = U.el('input', { attrs: { type: 'file', accept: 'image/*', multiple: 'multiple', tabindex: '-1', 'aria-hidden': 'true' },
        style: { position: 'absolute', left: '50%', top: '50%', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' } });
      root.append(cvs, topShade, ctl, title.el, input);

      /* ---------- Zustand */
      let list = items();
      let idx = U.clamp(data.index | 0, 0, list.length - 1);
      let playing = true;
      if (pending && pending.play !== undefined) playing = !!pending.play;
      let cur = null, tr = null, going = false, alive = true, autoN = 0;
      let ctlOn = false, ctlT = 0, titleUntil = 0;
      const speed = V.spring(playing ? 1 : 0, { response: 0.9 });
      const ctlS = V.spring(0, { response: 0.42, bounce: 0.06 });
      const swipe = V.spring(0, { response: 0.46, bounce: 0.04 });
      let sw = null;           // {next, prev, dragging, target}

      function slide(item, i) {
        const r = Math.random, zoomIn = r() < 0.62, user = item.kind === 'user';
        const a = 1.045 + r() * 0.04, b = 1.15 + r() * 0.07;
        const yy = () => (user ? -0.25 + (r() - 0.5) * 0.5 : (r() - 0.5) * 0.9);
        return { item, i, img: null, w: 0, h: 0, age: 0, kb: { s0: zoomIn ? a : b, s1: zoomIn ? b : a, x0: (r() - 0.5) * 1.1, x1: (r() - 0.5) * 1.1, y0: yy(), y1: yy() } };
      }
      async function ready(sl) {
        const im = imageNow(sl.item) || (await imageLater(sl.item));
        if (im) { sl.img = im.img; sl.w = im.w; sl.h = im.h; }
        return !!im;
      }

      /* ---------- Zeichnen */
      function drawSlide(c, sl, zk) {
        if (!sl || !sl.img) return;
        const kb = sl.kb;
        const u = U.clamp(sl.age / KB, 0, 1);
        const s = U.lerp(kb.s0, kb.s1, u) * (zk || 1);
        const base = Math.min(sl.w, sl.h), win = base / s;
        const cx = sl.w / 2 + U.lerp(kb.x0, kb.x1, u) * (sl.w - win) / 2;
        const cy = sl.h / 2 + U.lerp(kb.y0, kb.y1, u) * (sl.h - win) / 2;
        c.drawImage(sl.img, cx - win / 2, cy - win / 2, win, win, 0, 0, W, W);
      }
      function drawTrans(c, t) {
        const e = V.ease.inOutCubic(U.clamp(t.t, 0, 1));
        if (t.type === 'fade') {
          c.globalAlpha = e;
          drawSlide(c, t.to, 1 + 0.05 * (1 - e));
          c.globalAlpha = 1;
          return;
        }
        bg.setTransform(1, 0, 0, 1, 0, 0);
        bg.globalAlpha = 1;
        bg.globalCompositeOperation = 'source-over';
        bg.clearRect(0, 0, W, W);
        drawSlide(bg, t.to, 1 + 0.07 * (1 - e));
        bg.globalCompositeOperation = 'destination-in';
        if (t.type === 'iris') {
          const F = W * 0.18;
          const reach = Math.hypot(Math.max(t.ox, W - t.ox), Math.max(t.oy, W - t.oy)) + F;
          const rOut = Math.max(0.5, reach * e), rIn = Math.max(0, rOut - F);
          bg.fillStyle = rg(bg, t.ox, t.oy, rIn, rOut, [[0, '#000'], [1, 'rgba(0,0,0,0)']]);
          bg.fillRect(0, 0, W, W);
          bg.globalCompositeOperation = 'source-over';
          c.drawImage(buf, 0, 0);
          const a = 0.26 * Math.sin(e * Math.PI);
          if (a > 0.01) {
            c.globalCompositeOperation = 'lighter';
            c.fillStyle = rg(c, t.ox, t.oy, rIn, rOut, [[0, 'rgba(255,240,235,0)'], [0.55, `rgba(255,236,228,${a})`], [1, 'rgba(255,240,235,0)']]);
            c.fillRect(0, 0, W, W);
            c.globalCompositeOperation = 'source-over';
          }
        } else {
          // Fächer: öffnet sich von t.start aus in beide Richtungen, zwei Lichtköpfe laufen am Rand
          const F = 30;
          const half = e * (180 + F);
          const a0 = U.rad(t.start - 90 - 180);
          if (hasConic) {
            const gr = bg.createConicGradient(a0, W / 2, W / 2);
            const h = U.clamp(half / 360, 0, 0.5), f = U.clamp((half - F) / 360, 0, 0.5);
            gr.addColorStop(0, 'rgba(0,0,0,0)');
            gr.addColorStop(0.5 - h, 'rgba(0,0,0,0)');
            gr.addColorStop(0.5 - f, '#000');
            gr.addColorStop(0.5 + f, '#000');
            gr.addColorStop(0.5 + h, 'rgba(0,0,0,0)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            bg.fillStyle = gr;
            bg.fillRect(0, 0, W, W);
          } else {
            const m = U.rad(t.start - 90), hw = U.rad(Math.min(180, half));
            bg.beginPath(); bg.moveTo(W / 2, W / 2);
            bg.arc(W / 2, W / 2, W, m - hw, m + hw);
            bg.closePath(); bg.fillStyle = '#000'; bg.fill();
          }
          bg.globalCompositeOperation = 'source-over';
          c.drawImage(buf, 0, 0);
          const tail = U.smoothstep(0.8, 1, e);
          if (tail > 0) { c.globalAlpha = tail; drawSlide(c, t.to, 1 + 0.07 * (1 - e)); c.globalAlpha = 1; }
          // Lichtköpfe am Rand
          const ha = 0.6 * Math.sin(Math.min(1, e * 1.08) * Math.PI);
          if (ha > 0.01) {
            c.globalCompositeOperation = 'lighter';
            const reach = Math.min(180, Math.max(0, half - F * 0.5));
            for (const sg of [-1, 1]) {
              const head = t.start + sg * reach;
              const hx = W / 2 + Math.sin(U.rad(head)) * W * 0.468, hy = W / 2 - Math.cos(U.rad(head)) * W * 0.468;
              c.fillStyle = rg(c, hx, hy, 0, W * 0.085, [[0, `rgba(255,250,240,${ha})`], [0.28, `rgba(255,228,240,${ha * 0.35})`], [1, 'rgba(255,220,240,0)']]);
              c.fillRect(hx - W * 0.085, hy - W * 0.085, W * 0.17, W * 0.17);
            }
            c.globalCompositeOperation = 'source-over';
          }
        }
      }
      function drawSwipe(off) {
        const k = U.clamp(Math.abs(off) / 1000, 0, 1);
        const nb = off < 0 ? sw && sw.next : sw && sw.prev;
        if (nb && nb.img) {
          g.save();
          const s = 0.8 + 0.2 * k;
          g.globalAlpha = 0.18 + 0.82 * k;
          g.translate(W / 2, W / 2); g.scale(s, s);
          g.beginPath(); g.arc(0, 0, W / 2, 0, TAU); g.clip();
          g.translate(-W / 2, -W / 2);
          drawSlide(g, nb, 1);
          g.restore();
        }
        g.save();
        const s2 = 1 - 0.16 * U.smoothstep(0, 0.35, k);
        g.translate(W / 2 + (off / 1000) * W, W / 2);
        g.scale(s2, s2);
        // weicher Schatten unter der Scheibe
        const sh = U.smoothstep(0, 0.25, k) * 0.6;
        if (sh > 0.01) {
          g.fillStyle = rg(g, 0, 0, W * 0.47, W * 0.56, [[0, `rgba(0,0,0,${sh})`], [1, 'rgba(0,0,0,0)']]);
          g.fillRect(-W * 0.56, -W * 0.56, W * 1.12, W * 1.12);
        }
        g.beginPath(); g.arc(0, 0, W / 2, 0, TAU); g.clip();
        g.translate(-W / 2, -W / 2);
        drawSlide(g, cur, 1);
        g.restore();
      }
      function render() {
        dirty = false;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, W);
        const off = swipe.value;
        if (sw && cur) drawSwipe(off);
        else {
          drawSlide(g, cur, 1);
          if (tr && tr.to.img) drawTrans(g, tr);
        }
        if (vig) { g.fillStyle = vig; g.fillRect(0, 0, W, W); }
      }

      /* ---------- Ablauf */
      const TYPES = ['iris', 'fade', 'fan'];
      async function go(dir, o = {}) {
        if (!alive || sw) return;
        list = items();
        if (o.to === undefined && list.length < 2) return;
        if (tr) commit();
        if (going) return;
        going = true;
        const ni = o.to !== undefined ? U.clamp(o.to, 0, list.length - 1) : U.wrap(idx + dir, list.length);
        const sl = slide(list[ni], ni);
        const ok = await ready(sl);
        going = false;
        if (!alive) return;
        if (!ok) {
          // unlesbares Bild überspringen, in einer Sekunde weiter
          idx = ni;
          if (cur) cur.age = Math.min(cur.age, SLIDE - 1);
          return;
        }
        if (tr) commit();
        const type = o.type || TYPES[autoN++ % TYPES.length];
        tr = {
          to: sl, t: 0, type, dir: dir < 0 ? -1 : 1,
          dur: o.dur || (o.manual ? 1.1 : TRANS),
          start: o.manual ? (dir < 0 ? 270 : 90) : [0, 90, 180, 270][Math.floor(Math.random() * 4)],
          ox: o.origin ? (o.origin[0] / 1000) * W : W / 2, oy: o.origin ? (o.origin[1] / 1000) * W : W / 2,
        };
        if (o.manual) V.haptic(4);
      }
      function commit() {
        if (!tr) return;
        cur = tr.to; idx = cur.i; tr = null;
        data.index = idx; ctx.save();
        dirty = true;
        announce();
        prefetch();
      }
      function prefetch() {
        ctx.timeout(() => {
          if (!alive) return;
          list = items();
          const nx = list[U.wrap(idx + 1, list.length)];
          if (nx) imageLater(nx);
        }, 900);
      }
      function setPlaying(p, quiet) {
        playing = !!p;
        speed.to(playing ? 1 : 0, { response: playing ? 0.7 : 1.1 });
        playB.innerHTML = V.icon(playing ? 'pause' : 'play');
        playB.setAttribute('aria-label', playing ? 'Diashow anhalten' : 'Diashow fortsetzen');
        pausedL.style.opacity = playing ? '0' : '1';
        if (!quiet) poke();
      }

      /* ---------- Titel, Punkte, Bedienung */
      function renderDots() {
        dots.innerHTML = '';
        const n = list.length;
        if (n <= 24) {
          // Punkte am Bogen unter dem Titel
          const step = Math.min(4.4, 52 / Math.max(1, n - 1));
          for (let i = 0; i < n; i++) {
            const a = (i - (n - 1) / 2) * step;
            const p = V.display.pt(a, 404);
            const on = i === idx;
            dots.appendChild(U.svg('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: on ? 7 : 4, fill: '#fff', opacity: on ? 1 : list[i].kind === 'user' ? 0.55 : 0.35 }));
          }
        } else {
          // viele Fotos: feiner Bogen mit leuchtender Position
          dots.appendChild(U.svg('path', { d: V.ui.arcPath(500, 500, 404, -26, 26), fill: 'none', stroke: 'rgba(255,255,255,.28)', 'stroke-width': 4, 'stroke-linecap': 'round' }));
          const a = -26 + (52 * idx) / (n - 1);
          dots.appendChild(U.svg('path', { d: V.ui.arcPath(500, 500, 404, Math.max(-26, a - 2.2), Math.min(26, a + 2.2)), fill: 'none', stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round' }));
        }
      }
      function announce() {
        if (!cur) return;
        const it = cur.item;
        title.set(it.title);
        sub.textContent = it.sub;
        delB.style.display = it.kind === 'user' ? '' : 'none';
        renderDots();
        titleUntil = performance.now() + 3600;
        titleVis(true);
      }
      function titleVis(on) {
        title.el.classList.toggle('ph-on', on);
        topShade.classList.toggle('ph-on', on);
      }
      ctlS.onUpdate((v) => {
        const k = U.clamp(v, 0, 1.2);
        ctl.style.opacity = U.clamp(v, 0, 1).toFixed(3);
        row.style.transform = `translateY(-50%) scale(${(0.88 + 0.12 * k).toFixed(4)})`;
        bottom.style.transform = `translateY(${((1 - k) * 4).toFixed(2)}cqw)`;
      });
      row.style.transform = 'translateY(-50%) scale(.88)';
      function showCtl(on) {
        ctlOn = on;
        ctlT = performance.now();
        ctl.classList.toggle('ph-live', on);
        ctlS.to(on ? 1 : 0, { response: on ? 0.42 : 0.5 });
        if (on) { renderDots(); titleVis(true); } else if (performance.now() > titleUntil) titleVis(false);
        ctx.line(on ? 0.6 : 0.3);
      }
      function poke() { ctlT = performance.now(); }

      /* ---------- Hinzufügen / Löschen */
      function pick() {
        try { input.click(); } catch (e) { V.notify.toast('Fotoauswahl nicht möglich', 'info'); }
      }
      input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        input.value = '';
        if (files.length) importFiles(files);
      });
      async function importFiles(files) {
        if (!files.length) return [];
        const total = files.length;
        let done = 0;
        const arc = (o) => { if (alive) ctx.rim.arc('import', o); };
        arc({ value: 0.03, from: 0, color: COLOR, width: 9, r: 486, glow: 1.2, head: true, smooth: true, alpha: 1 });
        const added = await addFiles(files, () => { done++; arc({ value: Math.max(0.03, done / total) }); });
        await U.sleep(520);
        if (alive) V.tween({ duration: 0.5, onUpdate: (v) => arc({ alpha: 1 - v }) }).promise.then(() => { if (alive) ctx.rim.remove('import'); });
        if (!alive) return added;
        if (added.length) {
          list = items();
          const ni = list.findIndex((x) => x.id === added[added.length - 1].id);
          go(0, { to: Math.max(0, ni), type: 'iris', manual: true, dur: 1.5, origin: [500, 740] });
          V.sound.play('success');
          V.notify.toast(added.length === 1 ? 'Foto hinzugefügt' : added.length + ' Fotos hinzugefügt', 'check');
          if (db.persistent === false) setTimeout(() => { if (alive) V.notify.toast('Nur bis zum Neustart gespeichert', 'info'); }, 2300);
        } else {
          V.sound.play('error');
          V.notify.toast('Foto konnte nicht geladen werden', 'info');
        }
        return added;
      }
      async function removeCurrent() {
        const it = cur && cur.item;
        if (!it || it.kind !== 'user') return;
        const ok = await V.notify.alert({
          title: 'Foto löschen?', body: 'Es wird von diesem Visto entfernt.', icon: 'trash', color: '#FF453A',
          buttons: [{ label: 'Abbrechen', kind: 'white', value: false }, { label: 'Löschen', kind: 'danger', value: true }],
        });
        if (!ok || !alive) return;
        await removePhoto(it.id);
        list = items();
        idx = Math.min(idx, list.length - 1);
        go(0, { to: idx, type: 'iris', manual: true });
        V.notify.toast('Foto gelöscht', 'trash');
      }

      /* ---------- Gesten: antippen, wischen */
      const gest = V.gesture(root, {
        move(p) {
          if (!sw) {
            if (!p.moved || tr || going) return;
            if (Math.abs(p.dx) < Math.abs(p.dy) * 1.2 || list.length < 2) return;
            list = items();
            sw = { next: slide(list[U.wrap(idx + 1, list.length)], U.wrap(idx + 1, list.length)), prev: slide(list[U.wrap(idx - 1, list.length)], U.wrap(idx - 1, list.length)), dragging: true };
            ready(sw.next).then(() => { dirty = true; });
            ready(sw.prev).then(() => { dirty = true; });
            swipe.set(0);
          }
          if (sw.dragging) { swipe.set(p.dx); dirty = true; poke(); }
        },
        end(p) {
          if (!sw || !sw.dragging) return;
          sw.dragging = false;
          const dir = p.dx < 0 ? 1 : -1;
          const fast = Math.abs(p.vx) > 900 && Math.sign(p.vx) === Math.sign(p.dx);
          const target = dir > 0 ? sw.next : sw.prev;
          const s = sw;
          if (!p.cancelled && (Math.abs(p.dx) > 200 || fast) && target.img) {
            V.sound.play('tick'); V.haptic(5);
            swipe.to(-dir * 1150, { velocity: p.vx }).then(() => {
              if (sw !== s) return;
              cur = target; idx = target.i; sw = null; swipe.set(0);
              data.index = idx; ctx.save();
              dirty = true; announce(); prefetch();
            });
          } else {
            swipe.to(0).then(() => { if (sw === s) { sw = null; dirty = true; } });
          }
        },
        tap(p, e) {
          if (e && e.target && e.target.closest && e.target.closest('button')) return;
          showCtl(!ctlOn);
        },
      }, { slop: 10 });

      /* ---------- Bildtakt */
      ctx.onFrame((dt) => {
        const sp = speed.value;
        if (cur) cur.age += dt * sp;
        if (tr) {
          tr.to.age += dt * sp;
          tr.t += dt / tr.dur;
          if (tr.t >= 1) commit();
          dirty = true;
        }
        if (playing && cur && !tr && !sw && !going && cur.age >= SLIDE) go(1);
        if (sp > 0.002 || dirty || swipe.moving || sw) render();
        // Fortschritt der Diashow am Rand
        const cv2 = ctlS.value;
        if (cv2 > 0.02 && cur) {
          ctx.rim.arc('prog', { value: U.clamp(cur.age / SLIDE, 0, 1), from: 0, color: '#FFFFFF', width: 5, r: 491, glow: 0.7, alpha: U.clamp(cv2, 0, 1) * (playing ? 0.85 : 0.35), smooth: false, head: playing });
        } else ctx.rim.remove('prog');
        const now = performance.now();
        if (ctlOn && playing && now - ctlT > 5200) showCtl(false);
        if (titleUntil && now > titleUntil) { titleUntil = 0; if (!ctlOn) titleVis(false); }
      });

      /* ---------- Wünsche aus Sprache / Aktionen */
      function apply() {
        const p = pending; pending = null;
        if (!p) return;
        if (p.play !== undefined) { setPlaying(p.play); if (p.play && ctlOn) showCtl(false); if (!p.play && !ctlOn) showCtl(true); }
        if (p.step) go(p.step, { type: 'fan', manual: true });
      }
      ctx.on('photos:changed', () => {
        const id = cur && cur.item.id;
        list = items();
        const i = list.findIndex((x) => x.id === id);
        if (i >= 0) { idx = i; cur.i = i; }
        if (ctlOn) renderDots();
      });

      /* ---------- Start */
      cur = slide(list[idx], idx);
      ready(cur).then((ok) => {
        if (!alive) return;
        if (!ok) { cur = slide(list[list.length - 1], list.length - 1); ready(cur).then(() => { dirty = true; announce(); }); return; }
        dirty = true; announce(); prefetch();
      });
      loadUser().then(() => {
        if (!alive) return;
        const before = list.length;
        list = items();
        if (list.length !== before) {
          const id = cur && cur.item.id;
          const i = list.findIndex((x) => x.id === id);
          if (i >= 0) { idx = i; cur.i = i; }
          if (ctlOn) renderDots();
        }
      });
      setPlaying(playing, true);
      ctx.line(0.3);
      pending = null;

      // einmaliger Hinweis beim ersten Öffnen
      if (!data.hinted) {
        data.hinted = true; ctx.save();
        const hint = U.el('div', { class: 'ph-hint', text: 'Antippen für Bedienung\nWischen zum Blättern' });
        root.appendChild(hint);
        ctx.timeout(() => hint.classList.add('ph-on'), 900);
        ctx.timeout(() => hint.classList.remove('ph-on'), 5200);
        ctx.timeout(() => hint.remove(), 6200);
      }

      let crownAcc = 0;
      const inst = {
        get playing() { return playing; },
        apply, importFiles,
        go: (to, type) => go(0, { to, type: type || 'fade', manual: true, dur: type ? TRANS : undefined }),
      };
      live.inst = inst;

      return {
        crown(d) {
          crownAcc += d;
          if (Math.abs(crownAcc) >= 34) {
            const dir = crownAcc > 0 ? 1 : -1;
            crownAcc = 0;
            go(dir, { type: 'fan', manual: true });
          }
        },
        params() { apply(); },
        back() { if (ctlOn) { showCtl(false); return true; } return false; },
        destroy() {
          alive = false;
          gest.destroy();
          speed.stop(); ctlS.stop(); swipe.stop();
          if (live.inst === inst) live.inst = null;
          // Speicher freigeben: nur das zuletzt gezeigte Bild bleibt für den nächsten Start
          const keep = cur && cur.item.id;
          for (const k of Array.from(images.keys())) if (k !== keep) images.delete(k);
          cvs.width = cvs.height = 1; buf.width = buf.height = 1;
        },
      };
    },
  });
})();
