/* KYTHERA · MANDAT · Effekt-Engine der Karte
   Bewegte Bilder für Naturgewalten, Eingriffe der Weltregie und Reaktionen der Welt.
   Läuft in Echtzeit (Sekunden), unabhängig vom Spieltempo; die Simulation bleibt davon unberührt. */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const FX = (KY.fx = {});

  const TAU = Math.PI * 2;
  const MAXP = 2600;
  const fxs = [], floats = [], pops = [], labels = [], flashes = [], rings = [];
  let A = null, clock = 0, shake = null, glitchT = 0, pc = 0, fr = 0;

  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => cl((t - a) / (b - a), 0, 1);
  const eo = t => 1 - Math.pow(1 - t, 3);
  const bell = (t, a, b, c, d) => seg(t, a, b) * (1 - seg(t, c, d));
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + cl(a, 0, 1).toFixed(3) + ')'; };
  const R = Math.random;
  const rr = (a, b) => a + R() * (b - a);
  const pick = a => a[Math.floor(R() * a.length)];
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const on = () => !(SIM.S && SIM.S.ui && SIM.S.ui.fx === false);
  const calm = () => reducedMotion || !!(SIM.S && SIM.S.ui && SIM.S.ui.shake === false);
  const snd = n => KY.audio.play(n);
  const radKm = (type, sev) => { const T = D.EVENTS[type]; return T && T.radius ? T.radius[0] + (T.radius[1] - T.radius[0]) * (sev - 1) / 4 : 120; };
  const CATCOL = { natur: '#ff8a4a', himmel: '#b69cff', wirtschaft: '#e3c47a', politik: '#6db3f2', gesellschaft: '#5fd07a' };
  FX.CATCOL = CATCOL;
  const HOT = ['#fff6d8', '#ffe08a', '#ffc05a', '#ff9a3c', '#f57a2a', '#d9581f', '#b03f1a', '#863018', '#5e2716', '#3e2219', '#2e231f'];
  const hot = f => HOT[Math.min(HOT.length - 1, Math.floor(f * HOT.length))];
  const CONF = ['#e3c47a', '#5aa7f0', '#ef6b5f', '#4fc46a', '#f4ecda', '#b69cff', '#f08cc8'];
  const FIRE = ['#ffd27a', '#ff8a3a', '#7fd3ff', '#f08cc8', '#b69cff', '#5fd07a', '#ffffff', '#e3c47a'];

  /* ---------- Sprites ---------- */
  const SPR = {};
  function spr(col, hard) {
    const key = col + (hard ? '#' : '');
    let c = SPR[key];
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), k = hexRgb(col).join(',');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + k + ',1)');
    gr.addColorStop(hard ? 0.55 : 0.3, 'rgba(' + k + ',' + (hard ? 0.85 : 0.5) + ')');
    gr.addColorStop(1, 'rgba(' + k + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (SPR[key] = c);
  }
  function blob(g, col, x, y, r, a, hard) {
    if (r < 0.4 || a < 0.005) return;
    g.globalAlpha = a > 1 ? 1 : a;
    g.drawImage(spr(col, hard), x - r, y - r, r * 2, r * 2);
  }
  const CUR = {};
  function curtainSpr(kind) {
    if (CUR[kind]) return CUR[kind];
    const c = document.createElement('canvas'); c.width = 4; c.height = 96;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 96, 0, 0);
    const lo = kind === 'solar' ? '255,120,170' : '120,255,170', hi = '160,110,255';
    gr.addColorStop(0, 'rgba(' + lo + ',0)');
    gr.addColorStop(0.06, 'rgba(' + lo + ',0.95)');
    gr.addColorStop(0.35, 'rgba(' + (kind === 'solar' ? '120,255,170' : '70,230,150') + ',0.5)');
    gr.addColorStop(0.72, 'rgba(' + hi + ',0.28)');
    gr.addColorStop(1, 'rgba(' + hi + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 96);
    return (CUR[kind] = c);
  }
  function disc(g, x, y, r, stops) {
    if (r < 1) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(s => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function textOut(g, t, x, y, col, font, sw) {
    g.font = font; g.lineJoin = 'round';
    g.lineWidth = sw || 4; g.strokeStyle = 'rgba(6,8,12,0.85)'; g.strokeText(t, x, y);
    g.fillStyle = col; g.fillText(t, x, y);
  }
  function icon(g, name, x, y, s, col) {
    g.save(); g.translate(x - s / 2, y - s / 2); g.scale(s / 24, s / 24);
    g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col;
    KY.iconPaths(name).forEach(p => g.stroke(p));
    g.restore();
  }
  function plane(g, x, y, ang, col, s) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s / 10, s / 10);
    g.fillStyle = col; g.strokeStyle = 'rgba(6,8,12,0.7)'; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(10, 0); g.lineTo(-6, -1.5); g.lineTo(-9, -1.5); g.lineTo(-9, 1.5); g.lineTo(-6, 1.5); g.closePath();
    g.moveTo(3, -0.6); g.lineTo(-3, -8); g.lineTo(-5, -8); g.lineTo(-2, -0.6); g.lineTo(-2, 0.6); g.lineTo(-5, 8); g.lineTo(-3, 8); g.lineTo(3, 0.6); g.closePath();
    g.moveTo(-6, -0.6); g.lineTo(-9, -4); g.lineTo(-10.5, -4); g.lineTo(-9, 0); g.lineTo(-10.5, 4); g.lineTo(-9, 4); g.lineTo(-6, 0.6); g.closePath();
    g.stroke(); g.fill();
    g.restore();
  }

  /* ---------- Welt-Helfer ---------- */
  const cap = nid => SIM.W.cities[SIM.W.nations[nid].capital];
  const isLand = (lon, lat) => SIM.W.elev[KY.geo.cell(lon, lat)] > 0;
  const wrapLon = lon => ((lon + 180) % 360 + 360) % 360 - 180;
  let cacheW = null;
  const cellCache = new Map();
  function cells(nid) {
    const W = SIM.W;
    if (cacheW !== W) { cacheW = W; cellCache.clear(); }
    let s = cellCache.get(nid);
    if (s) return s;
    const all = [];
    for (let k = 0; k < W.nation.length; k++) if (W.nation[k] === nid) all.push(k);
    s = all;
    if (all.length > 500) { s = []; const st = all.length / 500; for (let i = 0; i < 500; i++) s.push(all[Math.floor(i * st)]); }
    cellCache.set(nid, s);
    return s;
  }
  // Zufälliger Punkt im Staat in Kartenkoordinaten
  function natPt(nid) {
    const W = SIM.W, s = cells(nid);
    if (!s.length) { const c = cap(nid); return [KY.map.lonX(c.lon), KY.map.latY(c.lat)]; }
    const k = s[Math.floor(R() * s.length)], cs = KY.map.WW / W.GW;
    return [((k % W.GW) + R()) * cs, (((k / W.GW) | 0) + R()) * cs];
  }
  function natBox(nid) {
    const W = SIM.W, w = W.nations[nid], s = cells(nid);
    let l0 = -2, l1 = 2, a0 = w.lat - 2, a1 = w.lat + 2;
    s.forEach(k => {
      const lon = KY.geo.lonOf(k % W.GW), lat = KY.geo.latOf((k / W.GW) | 0);
      let d = lon - w.lon; if (d > 180) d -= 360; if (d < -180) d += 360;
      if (d < l0) l0 = d; if (d > l1) l1 = d; if (lat < a0) a0 = lat; if (lat > a1) a1 = lat;
    });
    return { lon0: w.lon + l0, lon1: w.lon + l1, lat0: a0, lat1: a1 };
  }
  function seaward(lon, lat, deg) {
    const cosl = Math.max(0.3, Math.cos(lat * Math.PI / 180));
    let best = 0, bs = -1;
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU;
      let s = 0;
      for (let k = 1; k <= 8; k++) { const d = deg * k / 8; if (!isLand(wrapLon(lon + Math.cos(a) * d / cosl), cl(lat + Math.sin(a) * d, -85, 85))) s += 1 + (8 - k) * 0.1; }
      if (s > bs) { bs = s; best = a; }
    }
    return { lon: wrapLon(lon + Math.cos(best) * deg / cosl), lat: cl(lat + Math.sin(best) * deg, -80, 80) };
  }
  function evPos(ev) {
    const age = SIM.S.day - ev.start;
    if (ev.from && age < 3) { const t = U.smooth(Math.min(1, age / 3)); return { lon: ev.from.lon + (ev.lon - ev.from.lon) * t, lat: ev.from.lat + (ev.lat - ev.from.lat) * t }; }
    return { lon: ev.lon, lat: ev.lat };
  }

  /* ---------- Land- und Meeresmasken ---------- */
  let maskW = null, landM = null, seaM = null, bufA = null, bufB = null;
  function masks() {
    const W = SIM.W;
    if (maskW === W && landM) return;
    maskW = W;
    const mk = land => {
      const c = document.createElement('canvas'); c.width = W.GW; c.height = W.GH;
      const g = c.getContext('2d'), im = g.createImageData(W.GW, W.GH);
      for (let k = 0; k < W.GW * W.GH; k++) im.data[k * 4 + 3] = (W.elev[k] > 0) === land ? 255 : 0;
      g.putImageData(im, 0, 0);
      return c;
    };
    landM = mk(true); seaM = mk(false);
  }
  function maskedPass(which, fns) {
    if (!fns.length) return;
    masks();
    const w = Math.max(1, Math.round(A.SW)), h = Math.max(1, Math.round(A.SH));
    if (!bufA || bufA.width !== w || bufA.height !== h) { bufA = document.createElement('canvas'); bufB = document.createElement('canvas'); bufA.width = bufB.width = w; bufA.height = bufB.height = h; }
    const g = bufA.getContext('2d'), m = bufB.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h);
    fns.forEach(f => { g.save(); f(g); g.restore(); });
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.clearRect(0, 0, w, h); m.imageSmoothingEnabled = true;
    A.eachWorld(m, 1, () => m.drawImage(which === 'land' ? landM : seaM, 0, 0, A.WW, A.WH));
    m.setTransform(1, 0, 0, 1, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(bufB, 0, 0);
    g.globalCompositeOperation = 'source-over';
    const c = A.ctx; c.save(); c.globalAlpha = 1; c.drawImage(bufA, 0, 0, A.SW, A.SH); c.restore();
  }

  /* ---------- Effekte und Partikel ---------- */
  const K = {};
  function add(k, o) {
    const e = Object.assign({ k, t: 0, dur: 6, sev: 3, ps: [], wp: [], dir: false, hit: 0 }, o);
    fxs.push(e);
    while (fxs.length > 22) { const i = fxs.findIndex(f => !f.dir); fxs.splice(i >= 0 ? i : 0, 1); }
    if (K[k].init) K[k].init(e);
    return e;
  }
  const room = () => (calm() ? 0.6 : 1) * (pc > MAXP * 0.6 ? 0.5 : 1);
  function P(e, o) {
    if (pc >= MAXP) return null;
    pc++;
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, h: 0, vh: 0, age: 0, life: 1, s: 2, k: 'dot', c: '#ffffff', rot: 0 }, o);
    e.ps.push(p);
    return p;
  }
  function WP(e, o) {
    if (pc >= MAXP) return null;
    pc++;
    const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, s: 2, k: 'dot', c: '#ffffff' }, o);
    e.wp.push(p);
    return p;
  }
  const alphaP = p => { const f = p.age / p.life; return (p.a || 1) * Math.min(1, f / (p.fi || 0.08)) * Math.min(1, (1 - f) / (p.fo || 0.4)); };
  function stepP(ps, dt) {
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      if (p.dr) { const f = Math.max(0, 1 - p.dr * dt); p.vx *= f; p.vy *= f; }
      if (p.ax) p.vx += p.ax * dt;
      if (p.ay) p.vy += p.ay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.g) { p.vh -= p.g * dt; p.h += p.vh * dt; if (p.h < 0) { p.h = 0; p.vh = 0; p.vx *= 0.1; p.vy *= 0.1; p.g = 0; } }
      if (p.vr) p.rot += p.vr * dt;
    }
  }
  function stepW(ps, dt) {
    const z = A ? A.z : 1;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.x += p.vx * dt / z; p.y += p.vy * dt / z;
      if (p.wob) p.x += Math.cos(p.age * 3 + p.ph) * p.wob * dt / z;
    }
  }
  function drawP(g, e, ox, oy, Rp) {
    const ps = e.ps;
    if (!ps.length) return;
    let glow = false;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) { if (!glow) break; g.globalCompositeOperation = 'lighter'; }
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const isG = p.k === 'glow';
        if (isG) glow = true;
        if (isG !== (pass === 1)) continue;
        const a = alphaP(p);
        if (a < 0.01) continue;
        let x0 = ox, y0 = oy;
        if (p.an) { const an = p.an; if (an._f !== fr) { const q = A.ll(an.lon, an.lat); an._x = q[0]; an._y = q[1]; an._f = fr; } x0 = an._x; y0 = an._y; }
        const u = p.u ? Rp : 1;
        const x = x0 + p.x * u, y = y0 + (p.y - p.h) * u;
        if (x < -80 || y < -80 || x > A.SW + 80 || y > A.SH + 80) continue;
        const s = (p.su ? p.s * Rp : p.s) * (1 + (p.gr || 0) * p.age);
        switch (p.k) {
          case 'glow': case 'puff': blob(g, p.c, x, y, s, a); break;
          case 'deb': g.globalAlpha = a; g.fillStyle = hot(cl(p.age / (p.cool || 1), 0, 1)); g.fillRect(x - s / 2, y - s / 2, s, s); break;
          case 'conf': g.globalAlpha = a; g.save(); g.translate(x, y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-s, -s * 0.45, s * 2, s * 0.9); g.restore(); break;
          case 'txt': g.globalAlpha = a; textOut(g, p.txt, x, y, p.c, '800 ' + Math.round(s) + 'px Inter, -apple-system, sans-serif', 3); break;
          case 'line': { g.globalAlpha = a; g.strokeStyle = p.c; g.lineWidth = p.w || 1; const l = p.l || 8, vl = Math.hypot(p.vx, p.vy) || 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx / vl * l, y - p.vy / vl * l); g.stroke(); break; }
          default: g.globalAlpha = a; g.fillStyle = p.c; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
        }
      }
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  function drawW(g, ps, z) {
    if (!ps.length) return;
    for (const p of ps) {
      const a = alphaP(p);
      if (a < 0.01) continue;
      if (p.k === 'glow') { g.globalCompositeOperation = 'lighter'; blob(g, p.c, p.x, p.y, p.s / z * (1 + (p.gr || 0) * p.age), a); g.globalCompositeOperation = 'source-over'; continue; }
      if (p.k === 'puff') { blob(g, p.c, p.x, p.y, p.s / z * (1 + (p.gr || 0) * p.age), a); continue; }
      g.globalAlpha = a;
      if (p.k === 'line') { g.strokeStyle = p.c; g.lineWidth = (p.w || 1) / z; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03 / z, p.y - p.vy * 0.03 / z); g.stroke(); }
      else if (p.k === 'ring') { g.strokeStyle = p.c; g.lineWidth = 1.2 / z; g.beginPath(); g.arc(p.x, p.y, (2 + p.age * 14) / z, 0, TAU); g.stroke(); }
      else { g.fillStyle = p.c; const s = p.s / z; g.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
    }
    g.globalAlpha = 1;
  }
  const rpx = e => Math.max(A ? A.km(e.km) : 0, e.min || 40);
  const scr = e => A.ll(e.lon, e.lat);
  function fillNat(g, z, nid, col, a, line) {
    const path = A.nat[nid];
    if (!path || a <= 0.005) return;
    g.globalAlpha = cl(a, 0, 1); g.fillStyle = col; g.fill(path);
    if (line) { g.globalAlpha = cl(a * 2.4, 0, 1); g.strokeStyle = col; g.lineWidth = 2.4 / z; g.stroke(path); }
    g.globalAlpha = 1;
  }

  /* ---------- Narben: bleibende Spuren in der Landschaft ---------- */
  const SCAR_LIFE = { crater: 0, lava: 0, burn: 500, cracks: 220, track: 160, slide: 420 };
  function addScar(o) {
    const S = SIM.S;
    if (!S) return;
    S.scars = S.scars || [];
    S.scars.push(Object.assign({ day: S.day, seed: (R() * 4294967295) >>> 0 }, o));
    while (S.scars.length > 50) { const i = S.scars.findIndex(s => s.k !== 'crater'); S.scars.splice(i >= 0 ? i : 0, 1); }
  }
  function drawScars(g) {
    const S = SIM.S;
    if (!S.scars || !S.scars.length) return;
    for (let i = S.scars.length - 1; i >= 0; i--) {
      const s = S.scars[i];
      const life = SCAR_LIFE[s.k], age = Math.max(0, S.day - s.day);
      if (life && age > life) { S.scars.splice(i, 1); continue; }
      const fa = life ? 1 - age / life : Math.max(0.4, 1 - age / 1800);
      const [x, y] = A.ll(s.lon, s.lat);
      const r = Math.max(A.km(s.km), 2.5 + s.sev * 1.6);
      if (x < -r * 3 || x > A.SW + r * 3 || y < -r * 3 || y > A.SH + r * 3) continue;
      const rn = U.rng(s.seed);
      g.save();
      if (s.k === 'crater') {
        g.globalAlpha = 0.35 * fa; g.strokeStyle = '#c9b08a'; g.lineWidth = Math.max(0.8, r * 0.08);
        g.beginPath();
        for (let k = 0; k < 16; k++) { const a = rn() * TAU, l = r * (1.4 + rn() * 1.3); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.92); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.92); }
        g.stroke();
        disc(g, x, y, r * 1.5, [[0, 'rgba(70,52,38,0)'], [0.55, rgba('#4a3828', 0.35 * fa)], [1, 'rgba(70,52,38,0)']]);
        g.globalAlpha = 1;
        disc(g, x, y, r, [[0, rgba('#18120d', 0.85 * fa)], [0.7, rgba('#2a2018', 0.75 * fa)], [0.86, rgba('#9c8462', 0.7 * fa)], [1, 'rgba(60,45,30,0)']]);
        if (age < 40) { g.globalCompositeOperation = 'lighter'; blob(g, '#ff6a2a', x, y, r * 0.55, 0.5 * (1 - age / 40) * (0.7 + 0.3 * Math.sin(clock * 3 + s.seed))); }
      } else if (s.k === 'lava') {
        for (let k = 0; k < 7; k++) { const a = rn() * TAU, d = rn() * r * 0.6; blob(g, '#1d1512', x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.3 + rn() * 0.35), 0.55 * fa); }
        if (age < 60) {
          g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ff5a1f', 0.7 * (1 - age / 60)); g.lineWidth = Math.max(1, r * 0.06);
          for (let k = 0; k < 4; k++) { let px = x, py = y, a = rn() * TAU; g.beginPath(); g.moveTo(px, py); for (let j = 0; j < 6; j++) { a += (rn() - 0.5) * 0.8; px += Math.cos(a) * r * 0.14; py += Math.sin(a) * r * 0.14; g.lineTo(px, py); } g.stroke(); }
        }
      } else if (s.k === 'burn') {
        for (let k = 0; k < 8; k++) { const a = rn() * TAU, d = rn() * r * 0.7; blob(g, '#17110c', x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.25 + rn() * 0.3), 0.5 * fa); }
      } else if (s.k === 'cracks') {
        g.strokeStyle = rgba('#140c08', 0.7 * fa); g.lineWidth = 1.3; g.lineCap = 'round';
        crackPaths(rn, 4 + s.sev * 2, 0.5 + s.sev * 0.1).forEach(c => { g.beginPath(); c.pts.forEach((p, j) => (j ? g.lineTo(x + p[0] * r * 1.6, y + p[1] * r * 1.6) : g.moveTo(x + p[0] * r * 1.6, y + p[1] * r * 1.6))); g.stroke(); });
      } else if (s.k === 'track' && s.lon2 !== undefined) {
        const [x2, y2] = A.ll(s.lon2, s.lat2);
        if (Math.abs(x2 - x) < A.SW) { g.strokeStyle = rgba('#5a4430', 0.55 * fa); g.lineWidth = Math.max(2, r * 0.35); g.lineCap = 'round'; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x, y); g.stroke(); }
      } else if (s.k === 'slide') {
        const a = s.a || 0;
        for (let k = 0; k < 6; k++) { const d = k / 5 * r * 1.6; blob(g, '#5e4632', x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.35 - k * 0.03), 0.45 * fa); }
      }
      g.restore();
    }
  }
  function crackPaths(rn, n, len) {
    const out = [];
    const walk = (x, y, a, L, depth) => {
      const pts = [[x, y]], st = 9, sl = L / st;
      for (let i = 0; i < st; i++) {
        a += (rn() - 0.5) * 0.9; x += Math.cos(a) * sl; y += Math.sin(a) * sl * 0.85; pts.push([x, y]);
        if (depth < 2 && rn() < 0.16) walk(x, y, a + (rn() < 0.5 ? -1 : 1) * (0.5 + rn() * 0.6), L * (0.3 + rn() * 0.3), depth + 1);
      }
      out.push({ pts, d: depth, t0: depth * 0.18 + rn() * 0.1 });
    };
    for (let i = 0; i < n; i++) walk(0, 0, i / n * TAU + rn() * 0.6, len * (0.6 + rn() * 0.6), 0);
    return out;
  }

  /* =================== NATURGEWALTEN =================== */

  /* Meteorit: Leuchtspur, Einschlagblitz, Druckwellen, Trümmer, Staubwolke, Krater */
  K.meteor = {
    init(e) { e.hit = e.lite ? 0.9 : 1.3; const s = R() < 0.5 ? -1 : 1; e.ang = (-90 + s * rr(26, 58)) * Math.PI / 180; e.ring = []; for (let i = 0; i < 30; i++) e.ring.push(rr(-0.25, 0.25)); if (!e.lite) snd('whoosh'); },
    tick(e, dt) {
      if (e.t < e.hit) {
        if (!A) return;
        const Rp = rpx(e), L = cl(2.8 * Rp, 220, 640) / Rp;
        const p = Math.pow(e.t / e.hit, 1.7), ca = Math.cos(e.ang), sa = Math.sin(e.ang);
        const hx = ca * L * (1 - p), hy = sa * L * (1 - p);
        for (let i = 0; i < Math.ceil(dt * (40 + e.sev * 14)); i++) P(e, { k: 'glow', u: true, x: hx + rr(-0.02, 0.02), y: hy + rr(-0.02, 0.02), vx: ca * rr(0.05, 0.3) + rr(-0.08, 0.08), vy: sa * rr(0.05, 0.3) + rr(-0.08, 0.08), life: rr(0.25, 0.6), s: rr(1.5, 3.5), c: pick(['#ffd27a', '#ffb04a', '#ff8a3a']) });
        return;
      }
      if (!e.boom) { e.boom = true; meteorHit(e); }
      const th = e.t - e.hit;
      if (th < 6) for (let i = 0; i < Math.ceil(dt * 16 * (1 - th / 6)); i++) P(e, { k: 'glow', u: true, x: rr(-0.06, 0.06), y: rr(-0.05, 0.05), vy: rr(-0.12, -0.04), life: rr(0.6, 1.2), s: rr(2, 4), c: '#ff7a2a' });
    },
    draw(e, g) {
      const [x, y] = scr(e), Rp = rpx(e), t = e.t, th = t - e.hit;
      if (th < 0) {
        const p = t / e.hit, k = Math.pow(p, 1.7);
        g.strokeStyle = rgba('#ff5a3c', 0.25 + 0.55 * p); g.lineWidth = 1.5; g.setLineDash([4, 4]); g.lineDashOffset = -clock * 30;
        g.beginPath(); g.arc(x, y, Rp * (0.55 - 0.3 * p), 0, TAU); g.stroke(); g.setLineDash([]);
        blob(g, '#000000', x, y, Rp * 0.2 * p, 0.4 * p);
        const L = cl(2.8 * Rp, 220, 640), ca = Math.cos(e.ang), sa = Math.sin(e.ang);
        const hx = x + ca * L * (1 - k), hy = y + sa * L * (1 - k);
        const tl = Math.min(L * 0.6, 50 + L * k);
        const tx = hx + ca * tl, ty = hy + sa * tl;
        g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(hx, hy, tx, ty);
        gr.addColorStop(0, 'rgba(255,250,230,0.95)'); gr.addColorStop(0.18, 'rgba(255,190,90,0.75)'); gr.addColorStop(1, 'rgba(255,80,40,0)');
        g.strokeStyle = gr; g.lineCap = 'round';
        g.lineWidth = 4 + e.sev * 1.6; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
        g.lineWidth = 1.4; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + ca * tl * 0.5, hy + sa * tl * 0.5); g.stroke();
        blob(g, '#ffb04a', hx, hy, 14 + e.sev * 5 + R() * 3, 0.9);
        blob(g, '#ffffff', hx, hy, 4 + e.sev * 1.2, 1, true);
        g.globalCompositeOperation = 'source-over';
      } else {
        const f = seg(th, 0, 0.35), fade = 1 - seg(th, 0.6, 3.4);
        // Staubring am Boden
        const dp = seg(th, 0.1, 5);
        if (dp > 0 && dp < 1) for (let i = 0; i < e.ring.length; i++) { const a = i / e.ring.length * TAU + e.ring[i]; const rd = Rp * (0.15 + 0.85 * eo(dp)) * (1 + e.ring[i] * 0.3); blob(g, '#806a54', x + Math.cos(a) * rd, y + Math.sin(a) * rd * 0.9, Rp * 0.14 * (1 + dp), 0.42 * (1 - dp)); }
        g.globalCompositeOperation = 'lighter';
        blob(g, '#ff9a3c', x, y, Rp * (0.14 + 0.45 * eo(f)), 0.95 * fade);
        blob(g, '#ffe7b0', x, y, Rp * (0.07 + 0.2 * eo(f)), fade, true);
        for (let i = 0; i < 3; i++) {
          const p = seg(th, i * 0.16, 2.4 + i * 0.3);
          if (p <= 0 || p >= 1) continue;
          g.strokeStyle = i ? rgba('#ffc58a', 0.7 * (1 - p)) : rgba('#ffffff', 0.95 * (1 - p));
          g.lineWidth = (i ? 2 : 4) * (1 - p) + 0.8;
          g.beginPath(); g.arc(x, y, Rp * (0.1 + 1.4 * eo(p)), 0, TAU); g.stroke();
        }
        const gl = (1 - seg(th, 2, 10)) * (0.6 + 0.4 * Math.sin(clock * 9));
        blob(g, '#ff6a2a', x, y, Rp * 0.16, gl);
        g.globalCompositeOperation = 'source-over';
      }
      drawP(g, e, x, y, Rp);
    },
  };
  function meteorHit(e) {
    const sev = e.sev, lite = e.lite, k = room();
    snd('impact');
    if (!lite || sev >= 4) FX.shake(4 + sev * 3.4, 1 + sev * 0.35);
    flashes.push({ lon: e.lon, lat: e.lat, t: 0, dur: 0.45 + sev * 0.15, a: lite ? 0.35 : 0.45 + sev * 0.1, col: '#fff2d6' });
    for (let i = 0, n = Math.round((lite ? 25 : 45 + sev * 28) * k); i < n; i++) { const a = R() * TAU, sp = rr(0.35, 1.6); P(e, { k: 'deb', u: true, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85, vh: rr(0.4, 1.7), g: 2.6, life: rr(2.4, 4.4), s: rr(1.4, 3.4), cool: rr(0.5, 1.4), fo: 0.25 }); }
    for (let i = 0; i < 46 * k; i++) { const a = R() * TAU, sp = rr(1.2, 3.4); P(e, { k: 'glow', u: true, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85, dr: 2.6, life: rr(0.5, 1.1), s: rr(3, 7), c: pick(['#ffe7b0', '#ffc05a', '#ff9a3c']) }); }
    for (let i = 0, n = Math.round((lite ? 8 : 14 + sev * 5) * k); i < n; i++) { const a = R() * TAU, d = rr(0, 0.18), sp = rr(0.05, 0.3); P(e, { k: 'puff', u: true, su: true, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85 - 0.04, dr: 0.45, life: rr(5, 9), s: rr(0.1, 0.2), gr: 0.32, c: pick(['#5a4a3e', '#6b5a4b', '#4a3d33', '#7a6a5a']), a: 0.62, fi: 0.12, fo: 0.6 }); }
    addScar({ k: 'crater', lon: e.lon, lat: e.lat, km: e.km * 0.32, sev });
    if (e.dir) FX.label(sev >= 4 ? 'EINSCHLAG' : 'Einschlag', e.lon, e.lat, '#ffd9a8', 18 + sev * 3, 0.5, 2.8, -1);
  }

  /* Tsunami: Wellenringe über dem Meer, Front trifft die Küste, Überflutung an Land */
  K.tsunami = {
    init(e) {
      e.vkm = Math.max(e.dist / 2.3, 600 + e.sev * 120);
      e.kmMax = Math.max(e.dist * 2.4, 1400 + e.sev * 650);
      e.ta = e.dist / e.vkm; e.tm = e.kmMax / e.vkm;
      e.dur = Math.max(e.dur, e.ta + 8); e.hit = e.ta;
      if (!e.lite) { snd('wave'); FX.shake(2 + e.sev, 0.8); }
    },
    tick(e) {
      if (e.boom || e.t < e.ta) return;
      e.boom = true;
      if (!e.lite) { snd('rumble'); FX.shake(2 + e.sev * 1.5, 1.2); }
      const k = room();
      for (let i = 0; i < 60 * k; i++) { const a = R() * TAU, sp = rr(30, 140); P(e, { k: 'glow', an: e.cl, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 20, dr: 1.8, life: rr(0.7, 1.6), s: rr(2, 4.5), c: pick(['#e8f6ff', '#bfe9ff', '#ffffff']) }); }
      for (let i = 0; i < 18 * k; i++) { const a = R() * TAU, d = rr(0, 26); P(e, { k: 'puff', an: e.cl, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: Math.cos(a) * rr(5, 20), vy: Math.sin(a) * rr(5, 20), life: rr(2, 3.5), s: rr(6, 14), gr: 0.5, c: '#eaf6ff', a: 0.5 }); }
      if (e.dir) FX.label('Welle ' + U.n([3, 6, 11, 19, 34][e.sev - 1] + Math.round(R() * 4)) + ' m', e.cl.lon, e.cl.lat, '#d8f2ff', 20, 0.2, 3, -1);
    },
    sea(e, g) {
      const [x, y] = scr(e);
      const front = A.km(Math.min(e.kmMax, e.vkm * e.t));
      const fade = 1 - seg(e.t, e.tm * 0.85, e.tm + 1.5);
      if (fade <= 0) return;
      disc(g, x, y, Math.max(2, front), [[0, 'rgba(10,40,74,0)'], [0.72, rgba('#174a7a', 0.28 * fade)], [0.965, rgba('#bfe9ff', 0.6 * fade)], [1, 'rgba(191,233,255,0)']]);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const r = front - i * Math.max(6, front * 0.07);
        if (r <= 1) continue;
        g.strokeStyle = rgba(i ? '#7fc8ff' : '#eaf8ff', (i ? 0.35 : 0.9) * fade * (1 - i * 0.18));
        g.lineWidth = i ? 1.5 : 2.6 + e.sev * 0.4;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      const up = 1 - seg(e.t, 0, 1.2);
      if (up > 0) blob(g, '#dff4ff', x, y, 10 + e.sev * 5, 0.75 * up);
    },
    land(e, g) {
      if (e.t < e.ta) return;
      const [x, y] = A.ll(e.cl.lon, e.cl.lat);
      const Rm = Math.max(A.km(e.km * 0.3), 26 + e.sev * 12);
      const grow = eo(seg(e.t, e.ta, e.ta + 1.6)), rec = 1 - seg(e.t, e.dur - 3.5, e.dur);
      if (rec <= 0) return;
      const r = Rm * (0.15 + 0.85 * grow) * (0.7 + 0.3 * rec);
      disc(g, x, y, r, [[0, rgba('#2f7fd0', 0.6 * rec)], [0.74, rgba('#2f7fd0', 0.45 * rec)], [0.92, rgba('#d8f2ff', 0.6 * rec * (1 - grow * 0.4))], [1, 'rgba(216,242,255,0)']]);
    },
    draw(e, g) { const [x, y] = scr(e); drawP(g, e, x, y, rpx(e)); },
  };

  /* Erdbeben: seismische Ringe, Risse, Wackeln, Staub über Städten */
  K.quake = {
    init(e) {
      e.rn = U.rng((R() * 4294967295) >>> 0);
      e.cr = crackPaths(e.rn, 4 + e.sev * 2, 0.35 + e.sev * 0.12);
      e.cities = SIM.W.cities.map(c => ({ c, d: U.km(e.lon, e.lat, c.lon, c.lat) })).filter(x => x.d < e.km * 1.3).sort((a, b) => a.d - b.d).slice(0, 14).map(x => ({ lon: x.c.lon, lat: x.c.lat, dl: 0.25 + x.d / Math.max(50, e.km) * 1.1 }));
      if (!e.lite) { FX.shake(3 + e.sev * 3.2, 1.4 + e.sev * 0.45); snd('rumble'); }
      else if (e.sev >= 4) FX.shake(2 + e.sev, 1);
      if (e.mag) FX.label('M ' + e.mag, e.lon, e.lat, '#ffd2b0', 20 + e.sev * 2.5, 0.35, 3.6, -1);
      if (e.sev >= 3) addScar({ k: 'cracks', lon: e.lon, lat: e.lat, km: e.km * 0.3, sev: e.sev });
    },
    tick(e) {
      if (e.t > 3) return;
      e.cities.forEach(c => { if (!c.done && e.t >= c.dl) { c.done = true; for (let i = 0; i < 5 * room(); i++) P(e, { k: 'puff', an: c, x: rr(-8, 8), y: rr(-5, 5), vy: rr(-14, -4), vx: rr(-6, 6), life: rr(1.6, 2.6), s: rr(5, 9), gr: 0.6, c: '#8a7560', a: 0.55 }); } });
    },
    draw(e, g) {
      const [x, y] = scr(e), Rp = rpx(e), t = e.t;
      const fade = 1 - seg(t, e.dur - 2.5, e.dur);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const p = seg(t, i * 0.22, i * 0.22 + 1.7);
        if (p <= 0 || p >= 1) continue;
        g.strokeStyle = rgba(i % 2 ? '#ff6a3c' : '#ffc08a', 0.85 * (1 - p));
        g.lineWidth = 2.4 * (1 - p) + 0.6;
        g.beginPath(); g.ellipse(x, y, Rp * (0.05 + 1.5 * eo(p)), Rp * (0.05 + 1.5 * eo(p)) * 0.9, 0, 0, TAU); g.stroke();
      }
      blob(g, '#ff7a3c', x, y, Rp * 0.12 * (1 + 0.2 * Math.sin(clock * 12)), 0.8 * (1 - seg(t, 0.5, 4)));
      // Risse: glühende Kante, dunkler Kern
      e.cr.forEach(c => {
        const pr = seg(t, c.t0, c.t0 + 0.7), n = Math.ceil(pr * (c.pts.length - 1)) + 1;
        if (n < 2) return;
        for (let pass = 0; pass < 2; pass++) {
          g.globalCompositeOperation = pass ? 'source-over' : 'lighter';
          g.strokeStyle = pass ? rgba('#120a06', 0.9 * fade) : rgba('#ff7a3c', 0.55 * fade * (1 - seg(t, 1, 5)));
          g.lineWidth = pass ? Math.max(0.8, 2 - c.d * 0.6) : 4 - c.d;
          g.lineCap = 'round'; g.beginPath();
          for (let j = 0; j < n; j++) { const p = c.pts[j]; if (j) g.lineTo(x + p[0] * Rp, y + p[1] * Rp); else g.moveTo(x + p[0] * Rp, y + p[1] * Rp); }
          g.stroke();
        }
      });
      g.globalCompositeOperation = 'source-over';
      // Städte im Bebengebiet
      e.cities.forEach(c => {
        const p = seg(t, c.dl, c.dl + 1.2);
        if (p <= 0 || p >= 1) return;
        const q = A.ll(c.lon, c.lat);
        g.strokeStyle = rgba('#ef6b5f', 0.9 * (1 - p)); g.lineWidth = 2;
        g.beginPath(); g.arc(q[0], q[1], 5 + 14 * p, 0, TAU); g.stroke();
      });
      drawP(g, e, x, y, Rp);
    },
  };

  /* Vulkan: Aschesäule, Lavabomben, Blitze in der Wolke, Glut am Krater */
  K.volcano = {
    init(e) {
      e.wind = rr(0.04, 0.12) * (R() < 0.7 ? 1 : -1);
      e.flows = []; for (let i = 0; i < 3 + Math.min(3, e.sev); i++) { const pts = [[0, 0]]; let a = R() * TAU, px = 0, py = 0; for (let j = 0; j < 8; j++) { a += rr(-0.5, 0.5); px += Math.cos(a) * 0.05; py += Math.sin(a) * 0.05; pts.push([px, py]); } e.flows.push(pts); }
      e.bolt = null; e.nb = 0.6;
      snd('erupt');
      if (!e.lite) { FX.shake(2 + e.sev * 1.6, 1.3); flashes.push({ lon: e.lon, lat: e.lat, t: 0, dur: 0.6, a: 0.25 + e.sev * 0.05, col: '#ffcf9a' }); }
      addScar({ k: 'lava', lon: e.lon, lat: e.lat, km: e.km * 0.25, sev: e.sev });
    },
    tick(e, dt) {
      const k = room(), end = e.dur - 4;
      if (e.t < end) for (let i = 0; i < Math.ceil(dt * (e.lite ? 10 : 16 + e.sev * 4) * k); i++) P(e, { k: 'puff', u: true, su: true, x: rr(-0.04, 0.04), vx: rr(-0.07, 0.07), vy: -rr(0.3, 0.55), ay: 0.08, ax: e.wind * 0.7, dr: 0.2, life: rr(4.5, 7.5), s: rr(0.07, 0.13), gr: 0.45, c: pick(['#5d5752', '#6e6862', '#857d76', '#4a4440', '#9a928a']), a: 0.85, fi: 0.04, fo: 0.5 });
      if (e.t < 4) for (let i = 0; i < Math.ceil(dt * 16 * k); i++) P(e, { k: 'glow', u: true, vx: rr(-0.35, 0.35), vy: rr(-0.2, 0.2), vh: rr(0.4, 0.9), g: 1.6, life: rr(1.2, 1.8), s: rr(2, 3.6), c: pick(['#ff7a2a', '#ffb04a', '#ff5a1f']) });
      if (e.sev >= 2 && e.t < end && e.t > e.nb) { e.nb = e.t + rr(0.15, 0.7); const pts = []; let px = rr(-0.18, 0.18), py = rr(-0.75, -0.45); for (let j = 0; j < 7; j++) { pts.push([px, py]); px += rr(-0.06, 0.06); py += rr(0.03, 0.07); } e.bolt = { pts, t: e.t }; }
    },
    under(e, g) {
      const [x, y] = scr(e), Rp = rpx(e), f = seg(e.t, 0.5, 6), fade = 1 - seg(e.t, e.dur - 3, e.dur);
      for (let i = 0; i < 5; i++) blob(g, '#2a2622', x + e.wind / 0.12 * Rp * 0.25 * i * f, y + i * 2, Rp * (0.15 + 0.12 * i) * f, 0.18 * fade);
    },
    draw(e, g) {
      const [x, y] = scr(e), Rp = rpx(e), fade = 1 - seg(e.t, e.dur - 3, e.dur);
      g.globalCompositeOperation = 'lighter';
      const pr = seg(e.t, 0.2, 5);
      g.lineCap = 'round';
      e.flows.forEach(pts => {
        const n = Math.ceil(pr * (pts.length - 1)) + 1;
        if (n < 2) return;
        g.strokeStyle = rgba('#ff5a1f', 0.75 * fade); g.lineWidth = 2.6;
        g.beginPath(); for (let j = 0; j < n; j++) { const p = pts[j]; if (j) g.lineTo(x + p[0] * Rp, y + p[1] * Rp); else g.moveTo(x + p[0] * Rp, y + p[1] * Rp); } g.stroke();
      });
      blob(g, '#ff5a2a', x, y, Rp * 0.14 * (1 + 0.15 * Math.sin(clock * 7)), 0.95 * fade);
      blob(g, '#ffd27a', x, y, 4 + e.sev, fade, true);
      g.globalCompositeOperation = 'source-over';
      drawP(g, e, x, y, Rp);
      if (e.bolt && e.t - e.bolt.t < 0.14) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgba(225,215,255,0.95)'; g.lineWidth = 1.6;
        g.beginPath(); e.bolt.pts.forEach((p, j) => (j ? g.lineTo(x + p[0] * Rp, y + p[1] * Rp) : g.moveTo(x + p[0] * Rp, y + p[1] * Rp))); g.stroke();
        blob(g, '#c8b8ff', x + e.bolt.pts[0][0] * Rp, y + e.bolt.pts[0][1] * Rp, Rp * 0.22, 0.5);
        g.globalCompositeOperation = 'source-over';
      }
    },
  };

  /* Wirbelstürme: Entstehung mit Blitzen und Regen (die Wolkenspirale zeichnet FX.ambient) */
  K.cyclone = {
    init(e) { e.pos = { lon: e.lon, lat: e.lat }; e.nb = 0.4; snd('gust'); if (e.type === 'tornado' && !e.lite) FX.shake(2 + e.sev, 0.8); },
    tick(e, dt) {
      const ev = KY.events.byId(e.ev);
      if (ev) Object.assign(e.pos, evPos(ev));
      if (e.t > e.dur - 2) return;
      const k = room();
      if (e.type === 'storm') {
        for (let i = 0; i < Math.ceil(dt * 70 * k); i++) { const a = R() * TAU, d = rr(0.15, 1); P(e, { k: 'line', an: e.pos, u: true, x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9, vx: -0.25, vy: 0.9, life: rr(0.25, 0.45), c: '#cfe3ff', a: 0.5, l: 9 }); }
        if (e.t > e.nb) { e.nb = e.t + rr(0.12, 0.5); const a = R() * TAU, d = rr(0.1, 0.6); e.bolt = { x: Math.cos(a) * d, y: Math.sin(a) * d, t: e.t }; }
      } else if (e.type === 'tornado') {
        if (e.t < 4) for (let i = 0; i < Math.ceil(dt * 30 * k); i++) { const a = R() * TAU; P(e, { k: 'deb', an: e.pos, u: true, x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3, vx: -Math.sin(a) * 1.4, vy: Math.cos(a) * 1.4, vh: rr(0.2, 0.8), g: 1.2, life: rr(1, 2), s: rr(1.2, 2.4), cool: 0.01 }); }
      } else {
        for (let i = 0; i < Math.ceil(dt * 90 * k); i++) { P(e, { k: 'line', an: e.pos, u: true, x: rr(-1.2, 0.2), y: rr(-0.8, 0.8), vx: e.dx * 1.6, vy: e.dy * 1.6, life: rr(0.4, 0.8), c: pick(['#d9b46a', '#c9a24f', '#e8c98a']), a: 0.55, l: 14 }); }
      }
    },
    draw(e, g) {
      const q = A.ll(e.pos.lon, e.pos.lat), Rp = rpx(e);
      if (e.bolt && e.t - e.bolt.t < 0.1) { g.globalCompositeOperation = 'lighter'; blob(g, '#dfe6ff', q[0] + e.bolt.x * Rp, q[1] + e.bolt.y * Rp, Rp * 0.35, 0.6); g.globalCompositeOperation = 'source-over'; }
      drawP(g, e, q[0], q[1], Rp);
    },
  };

  /* Hochwasser: Wasser breitet sich über das Land aus, Wellenringe, Regen */
  K.flood = {
    init(e) { e.rip = []; for (let i = 0; i < 9; i++) e.rip.push({ x: rr(-0.7, 0.7), y: rr(-0.6, 0.6), t0: rr(0.4, e.dur - 2) }); snd('wave'); },
    tick(e, dt) { if (e.t < 4.5) for (let i = 0; i < Math.ceil(dt * 60 * room()); i++) { const a = R() * TAU, d = rr(0, 1.1); P(e, { k: 'line', u: true, x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9 - 0.2, vx: -0.12, vy: 0.75, life: rr(0.25, 0.45), c: '#cfe3ff', a: 0.45, l: 8 }); } },
    land(e, g) {
      const [x, y] = scr(e), Rp = rpx(e);
      const grow = eo(seg(e.t, 0, 2.2)), rec = 1 - seg(e.t, e.dur - 3, e.dur);
      if (rec <= 0) return;
      disc(g, x, y, Rp * (0.2 + 0.8 * grow), [[0, rgba('#3a86d6', 0.55 * rec)], [0.8, rgba('#3a86d6', 0.38 * rec)], [1, 'rgba(58,134,214,0)']]);
      g.globalCompositeOperation = 'lighter';
      e.rip.forEach(r => { const p = seg(e.t, r.t0, r.t0 + 1.4); if (p <= 0 || p >= 1) return; g.strokeStyle = rgba('#bfe9ff', 0.6 * (1 - p) * rec); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x + r.x * Rp * grow, y + r.y * Rp * grow, 3 + p * Rp * 0.18, (3 + p * Rp * 0.18) * 0.7, 0, 0, TAU); g.stroke(); });
      g.globalCompositeOperation = 'source-over';
    },
    draw(e, g) { const [x, y] = scr(e); drawP(g, e, x, y, rpx(e)); },
  };

  /* Waldbrand: flackernde Glut, Funkenflug, Rauchfahnen, Brandnarbe */
  K.fire = {
    init(e) { e.spots = []; for (let i = 0; i < 12; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 0.55; e.spots.push([Math.cos(a) * d, Math.sin(a) * d * 0.9, R() * 10]); } e.wind = rr(0.05, 0.12); snd('gust'); addScar({ k: 'burn', lon: e.lon, lat: e.lat, km: e.km * 0.5, sev: e.sev }); },
    tick(e, dt) {
      if (e.t > e.dur - 2.5) return;
      const k = room();
      for (let i = 0; i < Math.ceil(dt * 40 * k); i++) { const s = pick(e.spots); P(e, { k: 'glow', u: true, x: s[0] + rr(-0.05, 0.05), y: s[1], vx: e.wind * rr(0.5, 1.5), vy: -rr(0.08, 0.22), life: rr(0.8, 1.8), s: rr(1.4, 3), c: pick(['#ff8a3a', '#ffb347', '#ffd27a']) }); }
      for (let i = 0; i < Math.ceil(dt * 9 * k); i++) { const s = pick(e.spots); P(e, { k: 'puff', u: true, su: true, x: s[0], y: s[1], vx: e.wind, vy: -rr(0.06, 0.14), life: rr(3, 5), s: rr(0.06, 0.1), gr: 0.5, c: pick(['#3a3430', '#4a4440', '#5a524c']), a: 0.55, fo: 0.6 }); }
    },
    draw(e, g) {
      const [x, y] = scr(e), Rp = rpx(e), fade = bell(e.t, 0, 0.8, e.dur - 3, e.dur);
      g.globalCompositeOperation = 'lighter';
      e.spots.forEach(s => blob(g, '#ff5a1f', x + s[0] * Rp, y + s[1] * Rp, Rp * 0.16 * (0.7 + 0.3 * Math.sin(clock * 7 + s[2])), 0.55 * fade));
      g.globalCompositeOperation = 'source-over';
      drawP(g, e, x, y, Rp);
    },
  };

  /* Erdrutsch: Staubfächer in Hangrichtung, rutschendes Geröll */
  K.landslide = {
    init(e) { e.a = R() * TAU; if (!e.lite) FX.shake(2 + e.sev, 0.7); snd('rumble'); addScar({ k: 'slide', lon: e.lon, lat: e.lat, km: Math.max(8, e.km * 0.6), sev: e.sev, a: e.a }); },
    tick(e, dt) {
      if (e.t > 1.8) return;
      const ca = Math.cos(e.a), sa = Math.sin(e.a), k = room();
      for (let i = 0; i < Math.ceil(dt * 26 * k); i++) { const sp = rr(0.3, 0.9), sd = rr(-0.35, 0.35); P(e, { k: 'puff', u: true, su: true, vx: (ca + -sa * sd) * sp, vy: (sa + ca * sd) * sp, dr: 1.2, life: rr(2.5, 4), s: rr(0.08, 0.14), gr: 0.5, c: pick(['#7a6046', '#8a6e50', '#6a543e']), a: 0.6 }); }
      for (let i = 0; i < Math.ceil(dt * 30 * k); i++) { const sp = rr(0.4, 1.2), sd = rr(-0.3, 0.3); P(e, { k: 'deb', u: true, vx: (ca + -sa * sd) * sp, vy: (sa + ca * sd) * sp, dr: 1.4, life: rr(1.5, 2.5), s: rr(1.2, 2.4), cool: 0.01 }); }
    },
    draw(e, g) { const [x, y] = scr(e); drawP(g, e, x, y, rpx(e)); },
  };

  /* Landesweite Ereignisse: Fläche des Staates pulsiert, dazu je eigene Teilchen */
  const NATCOL = { drought: '#c9a24f', heat: '#ff6a3d', cold: '#8fd8ff', epidemic: '#e05aa0', locusts: '#c8b048' };
  const NATWORD = { drought: 'DÜRRE', heat: '46 °C', cold: '−40 °C', epidemic: 'EPIDEMIE', locusts: 'HEUSCHRECKEN' };
  K.natfx = {
    init(e) {
      const c = cap(e.n);
      e.cap = { lon: c.lon, lat: c.lat };
      FX.pop(c.lon, c.lat, D.EVENTS[e.type].icon, NATCOL[e.type], 0.2, true);
      if (e.dir) FX.label(NATWORD[e.type], c.lon, c.lat, NATCOL[e.type], 22, 0.5, 3.2, -1);
      snd(e.type === 'cold' ? 'ice' : e.type === 'epidemic' ? 'hum' : 'gust');
      if (e.type === 'epidemic') {
        const cx = KY.map.lonX(c.lon), cy = KY.map.latY(c.lat), ww = KY.map.WW;
        e.spots = [];
        for (let i = 0; i < 160; i++) { const p = natPt(e.n); let dx = p[0] - cx; if (dx > ww / 2) dx -= ww; if (dx < -ww / 2) dx += ww; e.spots.push({ x: p[0], y: p[1], d: Math.hypot(dx, p[1] - cy), ph: R() * TAU }); }
        e.spots.sort((a, b) => a.d - b.d);
      }
      if (e.type === 'locusts') {
        const cx = KY.map.lonX(c.lon), cy = KY.map.latY(c.lat);
        e.sw = []; for (let i = 0; i < 360; i++) e.sw.push({ x: cx + rr(-6, 6), y: cy + rr(-4, 4), vx: rr(-30, 30), vy: rr(-30, 30) });
      }
    },
    tick(e, dt) {
      if (e.t > e.dur - 1.5) return;
      const k = room(), ty = e.type;
      if (ty === 'cold') for (let i = 0; i < Math.ceil(dt * 120 * k); i++) { const p = natPt(e.n); WP(e, { k: 'dot', x: p[0], y: p[1], vy: rr(18, 34), wob: 12, ph: R() * TAU, life: rr(1.5, 2.5), s: rr(1.4, 2.4), c: '#ffffff', a: 0.9 }); }
      else if (ty === 'heat') for (let i = 0; i < Math.ceil(dt * 50 * k); i++) { const p = natPt(e.n); WP(e, { k: 'glow', x: p[0], y: p[1], vy: -rr(10, 24), life: rr(1.2, 2), s: rr(3, 6), c: pick(['#ff7a45', '#ffb04a', '#ff5a3c']), a: 0.6 }); }
      else if (ty === 'drought') for (let i = 0; i < Math.ceil(dt * 50 * k); i++) { const p = natPt(e.n); WP(e, { k: 'dot', x: p[0], y: p[1], vx: rr(10, 22), vy: rr(-4, 4), life: rr(1.4, 2.4), s: rr(1.2, 2), c: pick(['#e0c080', '#c9a24f']), a: 0.75 }); }
      if (e.sw) {
        if (!e.tg || e.t > e.tgT) { e.tg = natPt(e.n); e.tgT = e.t + rr(1.2, 2.2); }
        const z = A ? A.z : 1;
        e.sw.forEach(b => {
          const dx = e.tg[0] - b.x, dy = e.tg[1] - b.y, d = Math.hypot(dx, dy) || 1;
          b.vx += (dx / d * 70 + rr(-60, 60)) * dt * 3; b.vy += (dy / d * 70 + rr(-60, 60)) * dt * 3;
          const sp = Math.hypot(b.vx, b.vy); if (sp > 95) { b.vx *= 95 / sp; b.vy *= 95 / sp; }
          b.x += b.vx * dt / z; b.y += b.vy * dt / z;
        });
      }
    },
    world(e, g, z) {
      const fade = bell(e.t, 0, 0.6, e.dur - 1.6, e.dur), col = NATCOL[e.type];
      fillNat(g, z, e.n, col, (0.2 + 0.08 * Math.sin(clock * 3)) * fade, true);
      const path = A.nat[e.n];
      if (path && e.wp.length) { g.save(); g.clip(path); drawW(g, e.wp, z); g.restore(); }
      if (e.spots) {
        const vis = Math.floor(e.spots.length * eo(seg(e.t, 0.2, 5.5)));
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < vis; i++) { const s = e.spots[i]; blob(g, '#e05aa0', s.x, s.y, (3.5 + 1.5 * Math.sin(clock * 4 + s.ph)) / z, 0.75 * fade); }
        g.globalCompositeOperation = 'source-over';
      }
      if (e.sw) {
        for (let i = 0; i < e.sw.length; i += 8) blob(g, '#1a1408', e.sw[i].x, e.sw[i].y, 14 / z, 0.3 * fade);
        g.globalAlpha = 0.95 * fade; const s = 2.6 / z;
        e.sw.forEach((b, i) => { g.fillStyle = i % 3 ? '#1d180c' : '#6a5a24'; g.fillRect(b.x - s / 2, b.y - s / 2, s, s); });
        g.globalAlpha = 1;
      }
    },
  };

  /* Polarlicht: Lichtvorhänge über dem Staat */
  function curtains(g, x0, x1, yb, H, fade, seed, kind) {
    const sp = curtainSpr(kind);
    x0 = Math.max(-10, x0); x1 = Math.min(A.SW + 10, x1);
    const w = x1 - x0;
    if (w < 10 || fade <= 0) return;
    g.globalCompositeOperation = 'lighter';
    const step = 3;
    for (let b = 0; b < 2; b++) {
      for (let x = x0; x < x1; x += step) {
        const u = (x - x0) / w;
        const env = Math.sin(Math.PI * u);
        const yy = yb + Math.sin(u * 7 + clock * 0.5 + b * 2 + seed) * H * 0.18 + b * H * 0.12;
        const h = H * (0.55 + 0.45 * Math.sin(u * 13 + clock * 1.1 + b * 1.7 + seed));
        const a = fade * env * (0.38 + 0.25 * Math.sin(u * 40 + clock * 3 + b)) * (b ? 0.6 : 1);
        if (a < 0.02) continue;
        g.globalAlpha = a;
        g.drawImage(sp, x, yy - h, step + 0.6, h);
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  K.aurora = {
    init(e) { e.box = natBox(e.n); e.seed = R() * 10; snd('chime'); },
    world(e, g, z) { fillNat(g, z, e.n, '#5fe0a0', 0.07 * bell(e.t, 0, 1, e.dur - 1.5, e.dur), false); },
    draw(e, g) {
      const b = e.box, p0 = A.ll(b.lon0, b.lat1), p1 = A.ll(b.lon1, b.lat0);
      let x1 = p1[0]; const ww = A.WW * A.z; if (x1 < p0[0]) x1 += ww;
      const w = Math.max(320, (x1 - p0[0]) * 1.6), cx = (p0[0] + x1) / 2, hh = p1[1] - p0[1];
      const H = Math.max(110, hh * 1.1), fade = bell(e.t, 0, 1.2, e.dur - 1.5, e.dur);
      curtains(g, cx - w / 2, cx + w / 2, p0[1] + hh * 0.45, H, fade, e.seed, 'aurora');
      curtains(g, cx - w * 0.4, cx + w * 0.45, p0[1] + hh * 0.75, H * 0.75, fade * 0.7, e.seed + 2, 'aurora');
    },
  };

  /* Sonnensturm: Glut vom Rand, Polarlichter an beiden Polen, gestörte Satelliten */
  K.solar = {
    init(e) { glitchT = 1.5; snd('glitch'); setTimeout(() => snd('hum'), 500); e.seed = R() * 10; },
    draw(e, g) {
      const fade = bell(e.t, 0, 0.8, e.dur - 2, e.dur);
      g.globalCompositeOperation = 'lighter';
      blob(g, '#ff9a3c', -A.SW * 0.05, A.SH * 0.45, A.SH * 0.9, 0.5 * fade * (1 - seg(e.t, 1, 5) * 0.6));
      g.globalCompositeOperation = 'source-over';
      const yn = A.ll(0, 62)[1], ys = A.ll(0, -60)[1];
      curtains(g, 0, A.SW, yn, 80, fade, e.seed, 'solar');
      curtains(g, 0, A.SW, ys, 60, fade * 0.8, e.seed + 3, 'solar');
    },
  };
  FX.satGlitch = () => fxs.some(e => e.k === 'solar' && e.t < 6) && R() < 0.45;

  /* Sonnenfinsternis: Kernschatten zieht über das Land */
  K.eclipse = {
    init(e) { e.a = e.from || { lon: e.lon - 9, lat: e.lat - 3 }; e.b = { lon: e.lon + (e.lon - e.a.lon), lat: e.lat + (e.lat - e.a.lat) }; snd('hum'); },
    pos(e) { const p = seg(e.t, 0, e.dur); return { lon: e.a.lon + (e.b.lon - e.a.lon) * p, lat: e.a.lat + (e.b.lat - e.a.lat) * p }; },
    under(e, g) {
      const p = K.eclipse.pos(e), q = A.ll(p.lon, p.lat), fade = bell(e.t, 0, 1, e.dur - 1, e.dur);
      const um = Math.max(A.km(e.km * 0.4), 22 + e.sev * 4), pen = um * 3.2;
      disc(g, q[0], q[1], pen, [[0, rgba('#04060e', 0.8 * fade)], [um / pen, rgba('#04060e', 0.68 * fade)], [1, 'rgba(4,6,14,0)']]);
    },
    draw(e, g) {
      const p = K.eclipse.pos(e), q = A.ll(p.lon, p.lat), fade = bell(e.t, 0, 1, e.dur - 1, e.dur);
      const um = Math.max(A.km(e.km * 0.4), 22 + e.sev * 4);
      const rn = U.rng(7);
      for (let i = 0; i < 14; i++) { const a = rn() * TAU, d = rn() * um; g.globalAlpha = fade * (0.4 + 0.6 * Math.abs(Math.sin(clock * 2 + i))); g.fillStyle = '#ffffff'; g.fillRect(q[0] + Math.cos(a) * d, q[1] + Math.sin(a) * d, 1.4, 1.4); }
      g.globalCompositeOperation = 'lighter';
      blob(g, '#fff4dc', q[0], q[1] - um * 0.2, 22, 0.8 * fade);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = fade; g.fillStyle = '#05060a'; g.beginPath(); g.arc(q[0], q[1] - um * 0.2, 9, 0, TAU); g.fill();
      g.globalAlpha = 1;
    },
  };

  /* =================== EINGRIFFE DER WELTREGIE =================== */

  /* Staat im Aufwind oder in der Krise */
  const NATTOOL = {
    boom: { c: '#5fd07a', icon: 'trendUp', w: 'BOOM', up: true, s: 'chime' },
    techjump: { c: '#5ad1f0', icon: 'atom', w: 'DURCHBRUCH', up: true, s: 'hum' },
    tourism: { c: '#f08cc8', icon: 'plane', w: 'REISEFIEBER', up: true, s: 'chime' },
    harvest: { c: '#e3c47a', icon: 'wheat', w: 'REKORDERNTE', up: true, s: 'chime' },
    reform: { c: '#9ec5f4', icon: 'scale', w: 'REFORM', up: true, s: 'chime' },
    resource: { c: '#f0a640', icon: 'mountain', w: 'ROHSTOFFE', up: true, s: 'hum' },
    bankrun: { c: '#ef6b5f', icon: 'bank', w: 'BANKENKRISE', glyph: '¤', s: 'crash' },
    debt: { c: '#ef6b5f', icon: 'bank', w: 'ZAHLUNGSUNFÄHIG', glyph: '¤', s: 'crash' },
    cropfail: { c: '#c08a4a', icon: 'wheat', w: 'MISSERNTE', glyph: '▾', s: 'deny' },
  };
  K.natglow = {
    init(e) {
      const T = NATTOOL[e.tool], c = cap(e.n);
      e.T = T; e.cap = { lon: c.lon, lat: c.lat };
      e.cities = SIM.citiesOf(e.n).slice(0, 16).map(x => ({ lon: x.lon, lat: x.lat }));
      if (!e.cities.length) e.cities = [e.cap];
      FX.pop(c.lon, c.lat, T.icon, T.c, 0.15, true);
      FX.label(T.w, c.lon, c.lat, T.c, 22, 0.4, 3, -1);
      snd(T.s);
      if (e.tool === 'tourism') { const o = SIM.W.nations.filter(w => w.id !== e.n).sort(() => R() - 0.5).slice(0, 6); e.planes = o.map((w, i) => ({ a: { lon: cap(w.id).lon, lat: cap(w.id).lat }, t0: 0.2 + i * 0.35 })); }
      if (e.tool === 'techjump') e.links = e.cities.slice(1, 13).map((x, i) => ({ b: x, t0: 0.2 + i * 0.12 }));
    },
    tick(e, dt) {
      if (e.t > 3.8) return;
      const T = e.T, k = room();
      for (let i = 0; i < Math.ceil(dt * 46 * k); i++) {
        const c = pick(e.cities);
        if (T.up) P(e, { k: 'glow', an: c, x: rr(-9, 9), y: rr(-5, 5), vx: rr(-6, 6), vy: rr(-46, -20), life: rr(1, 1.8), s: rr(2, 4.2), c: T.c });
        else P(e, { k: 'txt', an: c, txt: T.glyph, x: rr(-10, 10), y: rr(-34, -12), vy: rr(20, 45), life: rr(1.2, 2), s: rr(11, 15), c: T.c, fo: 0.5 });
      }
      if ((e.tool === 'resource' || e.tool === 'harvest') && e.t < 3) for (let i = 0; i < Math.ceil(dt * 30 * k); i++) { const p = natPt(e.n); WP(e, { k: 'glow', x: p[0], y: p[1], life: rr(0.5, 1.1), s: rr(2.5, 5), c: e.tool === 'resource' ? '#ffd27a' : '#f4e2a0', fi: 0.3 }); }
    },
    world(e, g, z) {
      const fade = bell(e.t, 0, 0.5, e.dur - 1.5, e.dur);
      fillNat(g, z, e.n, e.T.c, (0.22 + 0.07 * Math.sin(clock * 4)) * fade, true);
      drawW(g, e.wp, z);
    },
    draw(e, g) {
      const q = A.ll(e.cap.lon, e.cap.lat), fade = bell(e.t, 0, 0.5, e.dur - 1.5, e.dur);
      if (e.tool === 'reform') {
        g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#dbe9ff', 0.5 * fade); g.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + clock * 0.3, l = 70 + 20 * Math.sin(clock * 2 + i); g.beginPath(); g.moveTo(q[0] + Math.cos(a) * 18, q[1] + Math.sin(a) * 18); g.lineTo(q[0] + Math.cos(a) * l, q[1] + Math.sin(a) * l); g.stroke(); }
        g.globalCompositeOperation = 'source-over';
      }
      if (e.links) {
        g.globalCompositeOperation = 'lighter';
        e.links.forEach(L => {
          const p = eo(seg(e.t, L.t0, L.t0 + 0.6)); if (p <= 0) return;
          const b = A.ll(L.b.lon, L.b.lat);
          if (Math.abs(b[0] - q[0]) > A.SW) return;
          g.strokeStyle = rgba('#5ad1f0', 0.75 * fade); g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + (b[0] - q[0]) * p, q[1] + (b[1] - q[1]) * p); g.stroke();
          const ph = (clock * 0.8 + L.t0) % 1;
          if (p >= 1) blob(g, '#bff4ff', q[0] + (b[0] - q[0]) * ph, q[1] + (b[1] - q[1]) * ph, 5, fade);
        });
        g.globalCompositeOperation = 'source-over';
      }
      if (e.planes) e.planes.forEach(pl => {
        const p = seg(e.t, pl.t0, pl.t0 + 2.4);
        if (p <= 0 || p >= 1) return;
        const G = arcGeom(pl.a, e.cap, 0.22);
        strokeArc(g, G, Math.max(0, p - 0.25), p, '#f08cc8', 1.4, 0.5);
        const pt = qpt(G, eo(p));
        plane(g, pt[0], pt[1], qang(G, eo(p)), '#ffe3f2', 11);
      });
      drawP(g, e, q[0], q[1], 1);
    },
  };

  /* Stromausfall: Staat wird dunkel, die Lichter flackern */
  K.blackout = {
    init(e) { snd('deny'); const c = cap(e.n); FX.label('BLACKOUT', c.lon, c.lat, '#cfd6e0', 22, 0.5, 3, -1); },
    world(e, g, z) {
      const t = e.t;
      const a = t < 1.6 ? (Math.sin(t * 38) > 0.2 ? 0.55 : 0.12) : 0.55 * (1 - seg(t, e.dur - 1.5, e.dur) * 0.4);
      fillNat(g, z, e.n, '#020306', a, false);
    },
  };
  FX.cityDim = function (nid) {
    for (const e of fxs) if (e.k === 'blackout' && e.n === nid) return e.t < 1.6 ? (Math.sin(e.t * 38) > 0.2 ? 1 : 0) : 0.9;
    const S = SIM.S, n = S && S.nations[nid];
    return n && n.crisis && n.crisis.k === 'blackout' && S.day < n.crisis.until ? 0.75 : 0;
  };

  /* Neuwahl: Konfetti über der Hauptstadt */
  K.election = {
    init(e) { const c = cap(e.n); e.cap = { lon: c.lon, lat: c.lat }; snd('pops'); FX.pop(c.lon, c.lat, 'ballot', '#e3c47a', 0.1, true); FX.label(e.txt || 'NEUWAHL', c.lon, c.lat, '#f4ecda', 18, 0.6, 3.4, -1); e.b = [0.05, 0.7, 1.4]; },
    tick(e) {
      while (e.b.length && e.t >= e.b[0]) {
        e.b.shift();
        for (let i = 0; i < 110 * room(); i++) P(e, { k: 'conf', an: e.cap, x: rr(-10, 10), vx: rr(-140, 140), vy: rr(-240, -80), ay: 170, dr: 0.9, vr: rr(-9, 9), rot: R() * TAU, life: rr(2.2, 3.2), s: rr(3, 5), c: pick(CONF) });
      }
    },
    draw(e, g) { drawP(g, e, 0, 0, 1); },
  };

  /* Bögen zwischen zwei Hauptstädten */
  function arcGeom(a, b, bulge) {
    const pa = A.ll(a.lon, a.lat), pb = A.ll(b.lon, b.lat).slice();
    const ww = A.WW * A.z;
    if (pb[0] - pa[0] > ww / 2) pb[0] -= ww; else if (pa[0] - pb[0] > ww / 2) pb[0] += ww;
    const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    return { a: pa, b: pb, c: [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 - d * (bulge === undefined ? 0.28 : bulge)], d };
  }
  const qpt = (G, t) => { const u = 1 - t; return [u * u * G.a[0] + 2 * u * t * G.c[0] + t * t * G.b[0], u * u * G.a[1] + 2 * u * t * G.c[1] + t * t * G.b[1]]; };
  const qang = (G, t) => { const u = 1 - t; return Math.atan2(2 * u * (G.c[1] - G.a[1]) + 2 * t * (G.b[1] - G.c[1]), 2 * u * (G.c[0] - G.a[0]) + 2 * t * (G.b[0] - G.c[0])); };
  function strokeArc(g, G, t0, t1, col, w, a, dash) {
    if (t1 <= t0 || a <= 0) return;
    g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = cl(a, 0, 1);
    if (dash) { g.setLineDash(dash); g.lineDashOffset = -clock * 30; }
    g.beginPath();
    for (let i = 0; i <= 36; i++) { const p = qpt(G, t0 + (t1 - t0) * i / 36); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
    g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  }
  const ARC = {
    statevisit: { c: '#e3c47a', icon: 'flag', s: 'chime', w: 'STAATSBESUCH' },
    detente: { c: '#5fd07a', icon: 'hands', s: 'chime', w: 'ANNÄHERUNG' },
    borderopen: { c: '#5fd07a', icon: 'route', s: 'chime', w: 'GRENZEN OFFEN' },
    trade: { c: '#e3c47a', icon: 'scales', s: 'ok', w: 'HANDELSABKOMMEN' },
    freeze: { c: '#8fd8ff', icon: 'snow', s: 'ice', w: 'EISZEIT' },
  };
  K.arc = {
    init(e) {
      const T = ARC[e.tool], a = cap(e.n), b = cap(e.n2);
      e.T = T; e.a = { lon: a.lon, lat: a.lat }; e.b = { lon: b.lon, lat: b.lat };
      e.m = { lon: a.lon + KY.geo.dlon(a.lon, b.lon) / 2, lat: (a.lat + b.lat) / 2 };
      snd(T.s);
      if (e.tool === 'statevisit') { FX.pop(b.lon, b.lat, 'hands', T.c, 2.1, true); FX.ring(b.lon, b.lat, T.c, 2.0, 70); }
      else if (e.tool === 'freeze') { FX.pop(a.lon, a.lat, 'snow', T.c, 0.3); FX.pop(b.lon, b.lat, 'snow', T.c, 0.5); }
      else { FX.pop(a.lon, a.lat, T.icon, T.c, 1.3); FX.pop(b.lon, b.lat, T.icon, T.c, 1.4); }
      FX.label(T.w, e.m.lon, e.m.lat, T.c, 18, 1.2, 3, -1);
    },
    tick(e) {
      if (e.tool === 'freeze' && !e.boom && e.t > 1.6) {
        e.boom = true; snd('ice');
        for (let i = 0; i < 50 * room(); i++) { const a = R() * TAU, sp = rr(40, 150); P(e, { k: i % 2 ? 'glow' : 'line', an: e.m, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dr: 1.6, life: rr(0.8, 1.6), s: rr(2, 4), l: 7, w: 1.5, c: pick(['#bfe6ff', '#e8f6ff', '#8fd8ff']) }); }
      }
      if (e.tool === 'detente' && e.t > 1.3 && e.t < 3.5) for (let i = 0; i < 2; i++) P(e, { k: 'glow', an: e.m, x: rr(-20, 20), y: rr(-10, 10), vx: rr(-15, 15), vy: rr(-40, -15), life: rr(1, 1.6), s: rr(2, 3.5), c: '#ffffff' });
    },
    world(e, g, z) {
      const fade = bell(e.t, 0, 0.6, e.dur - 1.5, e.dur);
      const a = e.tool === 'freeze' ? 0.2 : 0.12;
      fillNat(g, z, e.n, e.T.c, a * fade, true); fillNat(g, z, e.n2, e.T.c, a * fade, true);
    },
    draw(e, g) {
      const T = e.T, t = e.t, fade = bell(t, 0, 0.3, e.dur - 1.2, e.dur);
      const G = arcGeom(e.a, e.b), p = eo(seg(t, 0, 1.3));
      if (e.tool === 'freeze') {
        if (t < 1.6) { g.globalCompositeOperation = 'lighter'; strokeArc(g, G, 0, p, T.c, 6, 0.25); g.globalCompositeOperation = 'source-over'; strokeArc(g, G, 0, p, '#e8f6ff', 2.2, 0.95); }
        else { const k = 1 - seg(t, 1.6, 2.4); strokeArc(g, G, 0, 0.44, T.c, 2, k * 0.8, [3, 5]); strokeArc(g, G, 0.56, 1, T.c, 2, k * 0.8, [3, 5]); }
      } else if (e.tool === 'trade') {
        const G2 = arcGeom(e.a, e.b, -0.18);
        strokeArc(g, G, 0, p, T.c, 2, 0.8 * fade); strokeArc(g, G2, 0, p, '#5ad1f0', 2, 0.8 * fade);
        if (p >= 1) for (let i = 0; i < 6; i++) {
          const ph = (clock * 0.35 + i / 6) % 1, q1 = qpt(G, ph), q2 = qpt(G2, 1 - ph);
          g.globalAlpha = fade; g.fillStyle = T.c; g.fillRect(q1[0] - 3, q1[1] - 2.5, 6, 5); g.fillStyle = '#5ad1f0'; g.fillRect(q2[0] - 3, q2[1] - 2.5, 6, 5);
        }
        g.globalAlpha = 1;
      } else if (e.tool === 'borderopen') {
        strokeArc(g, G, 0, p, T.c, 2.4, 0.85 * fade, [8, 6]);
        if (p >= 1) for (let i = 0; i < 8; i++) { const ph = (clock * 0.4 + i / 8) % 1; const q1 = qpt(G, i % 2 ? ph : 1 - ph); blob(g, '#c8f5d2', q1[0], q1[1], 4, fade, true); }
      } else {
        g.globalCompositeOperation = 'lighter'; strokeArc(g, G, 0, p, T.c, 7, 0.22 * fade); g.globalCompositeOperation = 'source-over';
        strokeArc(g, G, 0, p, T.c, 2.4, 0.95 * fade);
        if (e.tool === 'detente') strokeArc(g, arcGeom(e.b, e.a, 0.14), 0, p, '#c8f5d2', 1.6, 0.8 * fade);
        if (e.tool === 'statevisit') { const pp = seg(t, 0.2, 2.0); if (pp > 0 && pp < 1) { const q = qpt(G, eo(pp)); blob(g, '#fff4dc', q[0], q[1], 12, 0.5); plane(g, q[0], q[1], qang(G, eo(pp)), '#fff4dc', 13); } }
      }
      drawP(g, e, 0, 0, 1);
    },
  };

  /* Weltgipfel: Linien aus allen Hauptstädten zum Gastgeber */
  K.summit = {
    init(e) {
      const W = SIM.W, host = W.nations.slice().sort((a, b) => b.pop - a.pop)[0];
      const h = cap(host.id);
      e.h = { lon: h.lon, lat: h.lat };
      e.from = W.nations.filter(w => w.id !== host.id).map(w => { const c = cap(w.id); return { lon: c.lon, lat: c.lat, d: U.km(c.lon, c.lat, h.lon, h.lat) }; }).sort((a, b) => a.d - b.d).map((x, i) => Object.assign(x, { t0: 0.1 + i * 0.05 }));
      snd('chime'); FX.pop(h.lon, h.lat, 'globe', '#e3c47a', 1.6, true); FX.ring(h.lon, h.lat, '#e3c47a', 1.5, 110); FX.label('WELTGIPFEL', h.lon, h.lat, '#f4e2a0', 22, 1.7, 3, -1);
    },
    draw(e, g) {
      const fade = bell(e.t, 0, 0.3, e.dur - 1.5, e.dur);
      g.globalCompositeOperation = 'lighter';
      e.from.forEach(f => {
        const p = eo(seg(e.t, f.t0, f.t0 + 0.9)); if (p <= 0) return;
        const G = arcGeom(f, e.h, 0.15);
        strokeArc(g, G, 0, p, '#e3c47a', 1.3, 0.55 * fade);
        if (p < 1) { const q = qpt(G, p); blob(g, '#fff0c0', q[0], q[1], 4, 0.9); }
      });
      g.globalCompositeOperation = 'source-over';
    },
  };

  /* Weltmeisterschaft: Feuerwerk über der Stadt */
  K.fireworks = {
    init(e) { e.c = { lon: e.lon, lat: e.lat }; e.bursts = []; for (let i = 0; i < 10; i++) e.bursts.push({ t: 0.2 + i * 0.5 + rr(0, 0.3), dx: rr(-70, 70), h: rr(70, 140), c: pick(FIRE), c2: pick(FIRE) }); snd('pops'); FX.pop(e.lon, e.lat, 'medal', '#e3c47a', 0.1, true); FX.label('WELTMEISTERSCHAFT', e.lon, e.lat, '#f4e2a0', 18, 0.4, 3.4, -1); },
    tick(e) {
      e.bursts.forEach(b => {
        if (!b.up && e.t >= b.t) { b.up = true; P(e, { k: 'glow', an: e.c, x: b.dx * 0.3, vx: b.dx * 0.7 / 0.55, vy: -b.h / 0.55, life: 0.55, s: 3, c: '#fff4dc', fo: 0.1 }); }
        if (!b.boom && e.t >= b.t + 0.55) {
          b.boom = true; if (R() < 0.4) snd('pops');
          for (let i = 0; i < 64 * room(); i++) { const a = R() * TAU, sp = rr(60, 160); P(e, { k: 'glow', an: e.c, x: b.dx, y: -b.h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 60, dr: 1.3, life: rr(1.1, 1.9), s: rr(2.4, 4.2), c: i % 3 ? b.c : b.c2 }); }
          P(e, { k: 'glow', an: e.c, x: b.dx, y: -b.h, life: 0.4, s: 46, c: b.c, a: 0.8 });
        }
      });
    },
    draw(e, g) {
      const q = A.ll(e.c.lon, e.c.lat), fade = bell(e.t, 0, 0.5, e.dur - 1, e.dur);
      g.globalCompositeOperation = 'lighter'; blob(g, '#ffe6a0', q[0], q[1], 26 + 4 * Math.sin(clock * 5), 0.45 * fade); g.globalCompositeOperation = 'source-over';
      drawP(g, e, q[0], q[1], 1);
    },
  };

  /* Heilung: sanfte Wellen und aufsteigende Kreuze */
  K.heal = {
    init(e) {
      e.pts = e.global ? SIM.W.nations.map((w, i) => { const c = cap(w.id); return { lon: c.lon, lat: c.lat, t0: i * 0.04 }; }) : [Object.assign({ t0: 0 }, (c => ({ lon: c.lon, lat: c.lat }))(cap(e.n)))];
      snd('chime');
      if (!e.global) { FX.pop(e.pts[0].lon, e.pts[0].lat, 'syringe', '#5fd07a', 0.1, true); FX.label('HEILMITTEL', e.pts[0].lon, e.pts[0].lat, '#bff0c8', 20, 0.4, 3, -1); }
    },
    tick(e) {
      e.pts.forEach(p => { if (!p.done && e.t >= p.t0) { p.done = true; for (let i = 0; i < (e.global ? 3 : 14); i++) P(e, { k: 'txt', an: p, txt: '+', x: rr(-14, 14), y: rr(-6, 6), vy: rr(-40, -18), life: rr(1.2, 2), s: rr(13, 19), c: pick(['#7fe0a0', '#5fd0c0', '#bff0c8']) }); } });
    },
    world(e, g, z) { if (!e.global) fillNat(g, z, e.n, '#5fd07a', 0.14 * bell(e.t, 0, 0.5, e.dur - 1.5, e.dur), true); },
    draw(e, g) {
      g.globalCompositeOperation = 'lighter';
      e.pts.forEach(pt => {
        const q = A.ll(pt.lon, pt.lat);
        for (let i = 0; i < (e.global ? 1 : 4); i++) {
          const p = seg(e.t, pt.t0 + i * 0.35, pt.t0 + i * 0.35 + 1.6);
          if (p <= 0 || p >= 1) continue;
          g.strokeStyle = rgba('#7fe0c0', 0.8 * (1 - p)); g.lineWidth = 2;
          g.beginPath(); g.arc(q[0], q[1], 6 + p * (e.global ? 26 : 70), 0, TAU); g.stroke();
        }
      });
      g.globalCompositeOperation = 'source-over';
      drawP(g, e, 0, 0, 1);
    },
  };

  /* Regen: Schauer über dem ganzen Staat */
  K.rain = {
    init(e) { snd('gust'); const c = cap(e.n); FX.pop(c.lon, c.lat, 'rain', '#9ec5f4', 0.1, true); },
    tick(e, dt) {
      if (e.t > e.dur - 1.2) return;
      const k = room();
      for (let i = 0; i < Math.ceil(dt * 220 * k); i++) { const p = natPt(e.n); WP(e, { k: 'line', x: p[0], y: p[1], vx: -50, vy: 420, life: rr(0.15, 0.3), c: '#d6e8ff', a: 0.55, w: 1 }); }
      for (let i = 0; i < Math.ceil(dt * 12 * k); i++) { const p = natPt(e.n); WP(e, { k: 'ring', x: p[0], y: p[1], life: rr(0.5, 0.9), c: '#bfe0ff', a: 0.6 }); }
    },
    world(e, g, z) {
      fillNat(g, z, e.n, '#6f8fb0', 0.2 * bell(e.t, 0, 0.6, e.dur - 1.5, e.dur), false);
      const path = A.nat[e.n];
      if (path) { g.save(); g.clip(path); drawW(g, e.wp, z); g.restore(); }
    },
  };

  /* Hilfswelle: Flugzeuge aus den reichsten Staaten zu allen Katastrophengebieten */
  K.aid = {
    init(e) {
      const S = SIM.S, W = SIM.W;
      const donors = S.nations.map((n, id) => ({ id, g: n.gdp })).sort((a, b) => b.g - a.g).slice(0, 5).map(d => { const c = cap(d.id); return { lon: c.lon, lat: c.lat }; });
      const dst = S.events.filter(v => v.phase !== 'vorbei' && !D.EVENTS[v.type].harmless).slice(0, 8).map(v => ({ lon: v.lon, lat: v.lat }));
      if (!dst.length) W.nations.slice().sort((a, b) => b.pop - a.pop).slice(0, 4).forEach(w => { const c = cap(w.id); dst.push({ lon: c.lon, lat: c.lat }); });
      e.fl = dst.map((d, i) => ({ a: donors[i % donors.length], b: d, t0: 0.2 + i * 0.25 }));
      e.dur = Math.max(e.dur, 0.2 + dst.length * 0.25 + 4);
      e.fl.forEach(f => { FX.pop(f.b.lon, f.b.lat, 'boxes', '#5fd07a', f.t0 + 2.4); FX.ring(f.b.lon, f.b.lat, '#5fd07a', f.t0 + 2.3, 40); });
      snd('chime');
    },
    draw(e, g) {
      e.fl.forEach(f => {
        const p = seg(e.t, f.t0, f.t0 + 2.4);
        if (p <= 0 || p >= 1) return;
        const G = arcGeom(f.a, f.b, 0.2);
        strokeArc(g, G, Math.max(0, p - 0.3), p, '#5fd07a', 1.4, 0.55);
        const q = qpt(G, eo(p));
        plane(g, q[0], q[1], qang(G, eo(p)), '#e8fbe8', 12);
      });
    },
  };

  /* Börsencrash und Ölpreisschock: Kurve, fallende Zahlen, Rand pulsiert */
  K.market = {
    init(e) {
      const S = SIM.S;
      const crash = e.tool === 'crash';
      e.col = crash ? '#ef6b5f' : '#f0a640';
      const ids = crash ? S.nations.map((n, id) => ({ id, v: n.gdp })).sort((a, b) => b.v - a.v).slice(0, 10) : S.nations.map((n, id) => ({ id, v: n.energy })).sort((a, b) => a.v - b.v).slice(0, 8);
      e.caps = ids.map(x => { const c = cap(x.id); return { lon: c.lon, lat: c.lat }; });
      const n = 64, cv = [];
      let v = crash ? 0.66 : 0.3;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        if (crash) v = f < 0.42 ? v + rr(-0.012, 0.016) : v - rr(0.004, 0.03) * (f < 0.8 ? 1.6 : 0.6);
        else v = f < 0.4 ? v + rr(-0.012, 0.012) : v + rr(0.004, 0.03) * (f < 0.8 ? 1.5 : 0.5);
        cv.push(cl(v, 0.04, 0.96));
      }
      e.cv = cv;
      snd('crash');
    },
    tick(e, dt) {
      if (e.t > 3) return;
      if (R() > dt * 10) return;
      const i = R() < 0.5 ? 0 : 1, c = pick(e.caps);
      if (e.tool === 'crash') P(e, { k: 'txt', an: c, txt: pick(['−' + U.n(rr(4, 14), 1) + ' %', '▼', '−' + U.n(rr(2, 9), 1) + ' %']), x: rr(-40, 40), y: rr(-40, -10), vy: rr(26, 54), life: rr(1.6, 2.4), s: rr(12, 16), c: '#ff8a80', fo: 0.5 });
      else P(e, { k: i % 2 ? 'dot' : 'txt', an: c, txt: '+' + Math.round(rr(30, 70)) + ' %', x: rr(-16, 16), y: rr(-30, -10), vy: rr(24, 50), life: rr(1.6, 2.4), s: i % 2 ? rr(2, 3.4) : rr(12, 15), c: i % 2 ? '#1a1208' : '#ffc070', fo: 0.5 });
    },
    draw(e, g) {
      const fade = bell(e.t, 0, 0.3, e.dur - 1, e.dur);
      // Rand pulsiert
      const pulse = (0.5 + 0.5 * Math.sin(e.t * 5)) * (1 - seg(e.t, 1, e.dur));
      const gr = g.createRadialGradient(A.SW / 2, A.SH / 2, Math.min(A.SW, A.SH) * 0.35, A.SW / 2, A.SH / 2, Math.max(A.SW, A.SH) * 0.75);
      gr.addColorStop(0, rgba(e.col, 0)); gr.addColorStop(1, rgba(e.col, 0.3 * pulse));
      g.fillStyle = gr; g.globalAlpha = 1; g.fillRect(0, 0, A.SW, A.SH);
      drawP(g, e, 0, 0, 1);
      // Kursverlauf
      const p = seg(e.t, 0.2, 2.6), w = 300, h = 118, x0 = A.SW / 2 - w / 2, y0 = Math.round(A.SH * 0.26);
      if (fade <= 0) return;
      g.globalAlpha = fade * 0.94; g.fillStyle = 'rgba(9,12,18,0.92)'; rrect(g, x0, y0, w, h, 10); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let i = 1; i < 4; i++) { const yy = y0 + 34 + (h - 48) * i / 4; g.beginPath(); g.moveTo(x0 + 14, yy); g.lineTo(x0 + w - 14, yy); g.stroke(); }
      const n = Math.max(2, Math.floor(e.cv.length * p));
      const X = i => x0 + 14 + (w - 28) * i / (e.cv.length - 1), Y = v => y0 + 34 + (h - 48) * (1 - v);
      g.globalAlpha = fade; g.strokeStyle = e.col; g.lineWidth = 2; g.lineJoin = 'round';
      g.beginPath(); for (let i = 0; i < n; i++) (i ? g.lineTo(X(i), Y(e.cv[i])) : g.moveTo(X(i), Y(e.cv[i]))); g.stroke();
      g.fillStyle = e.col; g.beginPath(); g.arc(X(n - 1), Y(e.cv[n - 1]), 4, 0, TAU); g.fill();
      const base = e.tool === 'crash' ? 4000 + 3000 * e.cv[0] : 60 + 90 * e.cv[0], cur = e.tool === 'crash' ? 4000 + 3000 * e.cv[n - 1] : 60 + 90 * e.cv[n - 1];
      g.font = '600 11px Inter, -apple-system, sans-serif'; g.fillStyle = '#9aa4b1'; g.textAlign = 'left';
      g.fillText(e.tool === 'crash' ? 'KX 500 · Weltleitindex' : 'Rohöl · ¤ je Barrel', x0 + 14, y0 + 21);
      g.textAlign = 'right'; g.font = '700 13px Inter, -apple-system, sans-serif'; g.fillStyle = '#eef2f6';
      g.fillText(U.sgn((cur / base - 1) * 100, 1, ' %'), x0 + w - 14, y0 + 21);
      g.textAlign = 'left'; g.globalAlpha = 1;
    },
  };

  /* =================== AUSLÖSER =================== */
  const EVFX = {
    meteor: o => add('meteor', Object.assign(o, { km: radKm('meteor', o.sev) * 0.9, min: 46 + o.sev * 26, dur: o.lite ? 7 : 11 })),
    tsunami: (o, ev) => {
      const c = SIM.W.cities[ev.c];
      const coast = { lon: c.lon, lat: c.lat };
      let epi = { lon: o.lon, lat: o.lat };
      if (isLand(epi.lon, epi.lat)) epi = seaward(coast.lon, coast.lat, 4 + o.sev);
      return add('tsunami', Object.assign(o, { lon: epi.lon, lat: epi.lat, cl: coast, dist: U.km(epi.lon, epi.lat, coast.lon, coast.lat), km: radKm('tsunami', o.sev), min: 46 + o.sev * 22, dur: o.lite ? 9 : 13 }));
    },
    quake: (o, ev) => { const m = /Magnitude ([\d,]+)/.exec(ev.text || ''); return add('quake', Object.assign(o, { km: radKm('quake', o.sev), min: 40 + o.sev * 22, dur: o.lite ? 6 : 9, mag: m ? m[1] : '' })); },
    volcano: o => add('volcano', Object.assign(o, { km: radKm('volcano', o.sev), min: 60 + o.sev * 24, dur: o.lite ? 9 : 16 })),
    storm: o => add('cyclone', Object.assign(o, { type: 'storm', km: radKm('storm', o.sev), min: 50 + o.sev * 14, dur: o.lite ? 4 : 7 })),
    tornado: o => add('cyclone', Object.assign(o, { type: 'tornado', km: radKm('tornado', o.sev), min: 16 + o.sev * 4, dur: o.lite ? 3 : 5 })),
    sandstorm: (o, ev) => { const f = ev.from || { lon: o.lon - 5, lat: o.lat }; const d = Math.hypot(o.lon - f.lon, o.lat - f.lat) || 1; return add('cyclone', Object.assign(o, { type: 'sandstorm', dx: (o.lon - f.lon) / d, dy: -(o.lat - f.lat) / d, km: radKm('sandstorm', o.sev), min: 40 + o.sev * 10, dur: o.lite ? 3 : 6 })); },
    flood: o => add('flood', Object.assign(o, { km: radKm('flood', o.sev), min: 30 + o.sev * 12, dur: o.lite ? 6 : 10 })),
    fire: o => add('fire', Object.assign(o, { km: radKm('fire', o.sev), min: 26 + o.sev * 10, dur: o.lite ? 6 : 11 })),
    landslide: o => add('landslide', Object.assign(o, { km: radKm('landslide', o.sev), min: 18 + o.sev * 6, dur: 6 })),
    drought: o => add('natfx', Object.assign(o, { type: 'drought', dur: o.lite ? 5 : 8 })),
    heat: o => add('natfx', Object.assign(o, { type: 'heat', dur: o.lite ? 5 : 8 })),
    cold: o => add('natfx', Object.assign(o, { type: 'cold', dur: o.lite ? 5 : 8 })),
    epidemic: o => add('natfx', Object.assign(o, { type: 'epidemic', dur: o.lite ? 6 : 9 })),
    locusts: o => add('natfx', Object.assign(o, { type: 'locusts', dur: o.lite ? 6 : 10 })),
    aurora: o => add('aurora', Object.assign(o, { dur: 9 })),
    solarstorm: o => add('solar', Object.assign(o, { dur: 9 })),
    eclipse: o => add('eclipse', Object.assign(o, { km: radKm('eclipse', o.sev), dur: 9 })),
  };
  FX.play = function (type, o, ev) { if (!on() || !EVFX[type] || !SIM.W) return null; return EVFX[type](Object.assign({ sev: 3 }, o), ev || {}); };

  KY.bus.on('event', ev => {
    if (!on() || !visible()) return;
    const T = D.EVENTS[ev.type];
    const dir = !!ev.byDirector;
    if (!dir && ev.sev < 3 && !T.harmless) return;
    if (!dir && fxs.filter(f => !f.dir).length >= 4) return;
    FX.play(ev.type, { lon: ev.lon, lat: ev.lat, sev: ev.sev, n: ev.n, c: ev.c, ev: ev.id, lite: !dir, dir, from: ev.from }, ev);
    if (dir || ev.sev >= 4) {
      const now = performance.now();
      if (dir || now - FX._lastBanner > 9000) {
        FX._lastBanner = now;
        FX.banner(T.harmless ? { tag: 'Himmelsschauspiel', kind: 'good', h: ev.name, sub: ev.text } : { tag: ev.type === 'tsunami' ? 'Tsunami-Warnung' : 'Eilmeldung', kind: 'crit', h: ev.name + ' · Stufe ' + ev.sev, sub: ev.text });
      }
    }
  });
  FX._lastBanner = 0;

  KY.bus.on('tool', d => {
    if (!on() || !visible()) return;
    const id = d.id, tg = d.tg || {}, r = d.r || {};
    const n = r.n !== undefined ? r.n : tg.n;
    const T = KY.sandbox.TOOL[id] || {};
    let banner = null;
    if (NATTOOL[id]) add('natglow', { tool: id, n, dur: 5, dir: true });
    else if (ARC[id]) { add('arc', { tool: id, n: tg.n, n2: tg.n2, dur: id === 'freeze' ? 5 : 6, dir: true }); banner = { kind: id === 'freeze' ? 'crit' : 'good' }; }
    else switch (id) {
      case 'blackout': add('blackout', { n, dur: 6, dir: true }); break;
      case 'election': add('election', { n, dur: 4, dir: true, txt: SIM.S.nations[n] ? SIM.S.nations[n].gov.party : '' }); banner = { kind: 'info' }; break;
      case 'summit': add('summit', { dur: 5.5, dir: true }); banner = { kind: 'good' }; break;
      case 'worldcup': { const c = SIM.W.cities[r.city]; if (c) add('fireworks', { lon: c.lon, lat: c.lat, dur: 7, dir: true }); banner = { kind: 'good' }; break; }
      case 'cure': add('heal', { n, dur: 4.5, dir: true }); break;
      case 'medbreak': add('heal', { global: true, dur: 5, dir: true }); banner = { kind: 'good' }; break;
      case 'rain': add('rain', { n, dur: 6, dir: true }); break;
      case 'aidwave': add('aid', { dur: 5, dir: true }); banner = { kind: 'good' }; break;
      case 'crash': case 'oilshock': add('market', { tool: id, dur: 5.5, dir: true }); banner = { kind: 'crit' }; break;
    }
    if (banner) FX.banner(Object.assign({ tag: banner.kind === 'crit' ? 'Eilmeldung' : 'Weltgeschehen', h: r.msg || T.n || 'Weltregie', sub: T.text }, banner));
  });

  const visible = () => { const g = document.getElementById('game'); return !!g && !g.classList.contains('hidden'); };

  /* ---------- Schwebende Hinweise, Symbole, Schriftzüge, Ringe ---------- */
  FX.float = function (o) {
    if (!on()) return;
    let delay = 0, slot = 0;
    const near = f => (o.lon === undefined && f.lon === undefined) || (o.lon !== undefined && f.lon !== undefined && Math.abs(f.lon - o.lon) < 4 && Math.abs(f.lat - o.lat) < 4);
    floats.forEach(f => { if (f.t < 2 && near(f)) slot++; });
    floats.push({ text: o.text, icon: o.icon || 'info', tone: o.tone || 0, lon: o.lon, lat: o.lat, t: -delay - slot * 0.6, dur: 5, slot: slot % 4, chk: false });
    while (floats.length > 10) floats.shift();
  };
  FX.pop = function (lon, lat, ic, col, delay, big) { pops.push({ lon, lat, icon: ic, col, t: -(delay || 0), dur: big ? 3.4 : 2.6, big }); while (pops.length > 30) pops.shift(); };
  FX.label = function (text, lon, lat, col, size, delay, dur, dy) { labels.push({ text, lon, lat, col: col || '#ffffff', size: size || 20, t: -(delay || 0), dur: dur || 3, dy: dy || 0 }); while (labels.length > 12) labels.shift(); };
  FX.ring = function (lon, lat, col, delay, max) { rings.push({ lon, lat, col, t: -(delay || 0), dur: 1.4, max: max || 60 }); };
  KY.bus.on('reaction', e => { if (visible()) FX.float(e); });

  /* Eilmeldung als Einblendung */
  FX.banner = function (o) {
    if (!on() || !visible()) return;
    let el = document.getElementById('fxbanner');
    if (!el) { el = document.createElement('div'); el.id = 'fxbanner'; document.getElementById('game').appendChild(el); }
    const ch = D.CHANNELS && D.CHANNELS.length ? pick(D.CHANNELS).short : 'KRF';
    el.className = 'k-' + (o.kind || 'crit');
    el.innerHTML = `<div class="bt">${U.esc(o.tag || 'Eilmeldung')}</div><div class="bx"><b>${U.esc(o.h)}</b>${o.sub ? '<span>' + U.esc(o.sub) + '</span>' : ''}</div><div class="bc">${U.esc(ch)} · LIVE</div>`;
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(FX._bt);
    FX._bt = setTimeout(() => el.classList.remove('on'), o.ms || 5600);
  };

  FX.shake = function (amp, dur) {
    if (calm()) return;
    if (!shake || amp > shake.amp * (1 - shake.t / shake.dur)) shake = { amp: Math.min(amp, 22), dur, t: 0 };
  };

  /* ---------- Ablauf je Bild ---------- */
  FX.busy = () => fxs.length > 0 || floats.length > 0 || pops.length > 0 || labels.length > 0 || flashes.length > 0 || rings.length > 0 || !!shake || glitchT > 0;
  FX.update = function (dt) {
    dt = Math.min(dt, 0.05);
    clock += dt;
    pc = 0;
    for (let i = fxs.length - 1; i >= 0; i--) {
      const e = fxs[i];
      e.t += dt;
      if ((e.t >= e.dur && !e.ps.length && !e.wp.length) || e.t > e.dur + 8) { fxs.splice(i, 1); continue; }
      if (e.t < e.dur && K[e.k].tick) K[e.k].tick(e, dt);
      stepP(e.ps, dt); stepW(e.wp, dt);
      pc += e.ps.length + e.wp.length;
    }
    floats.forEach(f => {
      if (f.chk) return;
      f.chk = true;
      if (f.lon !== undefined) fxs.forEach(e => { if (e.dir && e.t < (e.hit || 0) + 1 && Math.abs(e.lon - f.lon) < 6 && Math.abs(e.lat - f.lat) < 6) f.t = Math.min(f.t, -((e.hit || 0) + 1.2 - e.t)); });
    });
    [floats, pops, labels, flashes, rings].forEach(L => { for (let i = L.length - 1; i >= 0; i--) { L[i].t += dt; if (L[i].t >= L[i].dur) L.splice(i, 1); } });
    if (glitchT > 0) glitchT -= dt;
    const cv = document.getElementById('map');
    if (shake && cv) {
      shake.t += dt;
      if (shake.t >= shake.dur) { shake = null; cv.style.transform = ''; }
      else {
        const k = Math.pow(1 - shake.t / shake.dur, 2), t = shake.t;
        cv.style.transform = 'translate(' + ((Math.sin(t * 53) * 0.6 + Math.sin(t * 31 + 1) * 0.4) * shake.amp * k).toFixed(1) + 'px,' + ((Math.cos(t * 47) * 0.6 + Math.sin(t * 29 + 2) * 0.4) * shake.amp * k).toFixed(1) + 'px)';
      }
    }
  };
  FX.begin = function (api) { A = api; fr++; };
  FX.reset = function () { fxs.length = 0; floats.length = 0; pops.length = 0; labels.length = 0; flashes.length = 0; rings.length = 0; shake = null; const cv = document.getElementById('map'); if (cv) cv.style.transform = ''; };

  /* Im Weltkoordinatensystem (je Weltkopie): Flächen von Staaten */
  FX.world = function (g, z) {
    if (!A) return;
    for (const e of fxs) { const h = K[e.k]; if (h.world) { g.save(); h.world(e, g, z); g.restore(); } }
    // Andauernde Stromausfälle
    const S = SIM.S;
    S.nations.forEach((n, id) => { if (n.crisis && n.crisis.k === 'blackout' && S.day < n.crisis.until && !fxs.some(e => e.k === 'blackout' && e.n === id)) fillNat(g, z, id, '#020306', 0.32, false); });
    // Zielvorschau: Staat unter dem Zeiger einfärben
    const pl = A.placing;
    if (pl && pl.sb && A.hoverNation >= 0 && (pl.kind === 'nation' || pl.kind === 'two')) {
      const t = KY.sandbox.TOOL[pl.sb];
      if (t) fillNat(g, z, A.hoverNation, CATCOL[t.cat] || '#e3c47a', 0.16 + 0.06 * Math.sin(clock * 5), true);
    }
  };

  /* Unter Städten und Symbolen: Narben, Wasser, Schatten */
  FX.under = function () {
    if (!A) return;
    const g = A.ctx;
    g.save();
    drawScars(g);
    const land = [], sea = [];
    fxs.forEach(e => { const h = K[e.k]; if (h.land) land.push(gg => h.land(e, gg)); if (h.sea) sea.push(gg => h.sea(e, gg)); if (h.under) h.under(e, g); });
    // Andauerndes Hochwasser
    const S = SIM.S;
    let nf = 0;
    S.events.forEach(ev => {
      if (nf >= 6 || ev.phase === 'vorbei' || !(ev.type === 'flood' || ev.type === 'tsunami' || (ev.type === 'storm' && ev.sev >= 3))) return;
      if (fxs.some(e => e.ev === ev.id && (e.k === 'flood' || e.k === 'tsunami'))) return;
      const c = ev.type === 'tsunami' ? SIM.W.cities[ev.c] : ev;
      const q = A.ll(c.lon, c.lat), r = Math.max(A.km(ev.radius || 100) * 0.8, 14);
      if (q[0] < -r || q[0] > A.SW + r || q[1] < -r || q[1] > A.SH + r) return;
      nf++;
      const k = cl((ev.end - S.day) / 4, 0, 1);
      land.push(gg => disc(gg, q[0], q[1], r, [[0, rgba('#3a86d6', 0.4 * k)], [0.75, rgba('#3a86d6', 0.28 * k)], [1, 'rgba(58,134,214,0)']]));
    });
    g.restore();
    maskedPass('sea', sea);
    maskedPass('land', land);
  };

  /* Andauernde Darstellung laufender Ereignisse (aus drawEvents) */
  const SPIRAL = [];
  for (let a = 0; a < 3; a++) for (let j = 0; j < 17; j++) { const f = j / 16; SPIRAL.push({ a: a * TAU / 3 + f * 3.3, r: 0.14 + 0.86 * f, s: 0.27 - 0.13 * f, al: 0.6 - 0.3 * f }); }
  for (let j = 0; j < 10; j++) SPIRAL.push({ a: j / 10 * TAU, r: 0.13, s: 0.13, al: 0.85 });
  FX.form = function (evId) { for (const e of fxs) if (e.ev === evId && e.k === 'cyclone') return eo(seg(e.t, 0, 1.4)); return 1; };
  FX.ambient = function (g, ev, x, y, rpxEv, done) {
    if (!on() || done) return;
    const ty = ev.type;
    if (ty === 'storm' || ty === 'tornado') {
      const torn = ty === 'tornado';
      const k = FX.form(ev.id);
      const Rp = Math.max(rpxEv * (torn ? 1.2 : 1), torn ? 22 + ev.sev * 6 : 50 + ev.sev * 14) * (0.2 + 0.8 * k);
      const hs = ev.lat >= 0 ? 1 : -1;
      const rot = -hs * clock * (torn ? 5 : 0.9);
      const col = torn ? '#8d8478' : '#eef3f8';
      for (const s of SPIRAL) { const a = s.a * hs + rot; blob(g, col, x + Math.cos(a) * s.r * Rp, y + Math.sin(a) * s.r * Rp * 0.92, s.s * Rp, s.al * (torn ? 0.8 : 0.78) * k); }
      if (!torn) { g.globalAlpha = 0.55 * k; g.fillStyle = '#0d1d31'; g.beginPath(); g.arc(x, y, Rp * 0.06, 0, TAU); g.fill(); }
      if (torn) { g.fillStyle = 'rgba(40,32,24,0.85)'; for (let i = 0; i < 10; i++) { const a = clock * 6 + i * 0.63, r = Rp * (0.3 + (i % 4) * 0.18); g.fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r * 0.9 - 1, 2, 2); } }
      g.globalAlpha = 1;
    } else if (ty === 'sandstorm') {
      const f = ev.from || { lon: ev.lon - 5, lat: ev.lat };
      const d = Math.hypot(ev.lon - f.lon, ev.lat - f.lat) || 1, dx = (ev.lon - f.lon) / d, dy = -(ev.lat - f.lat) / d;
      const Rp = Math.max(rpxEv, 40 + ev.sev * 10);
      for (let i = 0; i < 24; i++) {
        const u = i / 23 * 2 - 1, along = -0.35 * u * u + 0.08 * Math.sin(clock * 1.5 + i);
        blob(g, i % 3 ? '#c9a24f' : '#b88a3e', x - dy * u * Rp + dx * along * Rp, y + dx * u * Rp + dy * along * Rp, Rp * 0.34, 0.32);
      }
      g.strokeStyle = 'rgba(232,201,138,0.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) { const ph = (clock * 0.8 + i * 0.137) % 1, u = ((i * 0.618) % 1) * 2 - 1, al = -1 + ph * 1.6; const px = x - dy * u * Rp * 0.9 + dx * al * Rp, py = y + dx * u * Rp * 0.9 + dy * al * Rp; g.globalAlpha = 0.6 * Math.sin(Math.PI * ph); g.beginPath(); g.moveTo(px, py); g.lineTo(px - dx * 14, py - dy * 14); g.stroke(); }
      g.globalAlpha = 1;
    } else if (ty === 'fire') {
      const Rp = Math.max(rpxEv, 18 + ev.sev * 5);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const a = i * 2.1 + ev.sev, d = (i % 3) * 0.22 * Rp; blob(g, '#ff5a1f', x + Math.cos(a) * d, y + Math.sin(a) * d, Rp * 0.22 * (0.7 + 0.3 * Math.sin(clock * 7 + i * 1.7)), 0.45); }
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) { const ph = (clock * 0.25 + i / 3) % 1; blob(g, '#3a3430', x + ph * Rp * 0.6, y - ph * Rp * 0.5, Rp * (0.15 + ph * 0.3), 0.35 * Math.sin(Math.PI * ph)); }
    } else if (ty === 'volcano') {
      const Rp = Math.max(rpxEv * 0.6, 16 + ev.sev * 4);
      g.globalCompositeOperation = 'lighter';
      blob(g, '#ff5a2a', x, y, Rp * 0.3 * (1 + 0.15 * Math.sin(clock * 5)), 0.6);
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 4; i++) { const ph = (clock * 0.2 + i / 4) % 1; blob(g, '#4a4440', x + ph * Rp * 0.5, y - ph * Rp * 1.1, Rp * (0.12 + ph * 0.35), 0.45 * Math.sin(Math.PI * ph)); }
    }
    g.globalAlpha = 1;
  };

  /* Über allem: Effekte, Symbole, Schriftzüge, Hinweise, Blitze, Zielvorschau */
  FX.over = function () {
    if (!A) return;
    const g = A.ctx;
    g.save();
    g.textBaseline = 'middle';
    for (const e of fxs) { const h = K[e.k]; if (h.draw) { g.save(); h.draw(e, g); g.restore(); } }
    rings.forEach(r => {
      if (r.t < 0) return;
      const q = A.ll(r.lon, r.lat), p = r.t / r.dur;
      g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(r.col, 0.9 * (1 - p)); g.lineWidth = 3 * (1 - p) + 1;
      g.beginPath(); g.arc(q[0], q[1], 8 + r.max * eo(p), 0, TAU); g.stroke();
      g.globalCompositeOperation = 'source-over';
    });
    pops.forEach(p => {
      if (p.t < 0) return;
      const q = A.ll(p.lon, p.lat), t = p.t;
      const s = t < 0.3 ? eo(t / 0.3) * 1.3 : 1.3 - 0.3 * seg(t, 0.3, 0.6);
      const a = 1 - seg(t, p.dur - 0.6, p.dur), y = q[1] - 26 - 10 * seg(t, 0, 0.6);
      g.globalCompositeOperation = 'lighter'; blob(g, p.col, q[0], y, (p.big ? 34 : 24) * s, 0.5 * a); g.globalCompositeOperation = 'source-over';
      g.globalAlpha = a; KY.map.badge(q[0], y, p.icon, p.col, (p.big ? 17 : 13) * s, 2.6); g.globalAlpha = 1;
    });
    labels.forEach(l => {
      if (l.t < 0) return;
      const q = l.lon === undefined ? [A.SW / 2, A.SH * 0.4] : A.ll(l.lon, l.lat), t = l.t;
      const a = bell(t, 0, 0.25, l.dur - 0.7, l.dur), s = 0.8 + 0.2 * eo(seg(t, 0, 0.3));
      g.globalAlpha = a; g.textAlign = 'center';
      if ('letterSpacing' in g) g.letterSpacing = '0.06em';
      textOut(g, l.text, q[0], q[1] + (l.dy < 0 ? -76 : 40) - 12 * eo(seg(t, 0, l.dur)), l.col, '800 ' + Math.round(l.size * s) + 'px Inter, -apple-system, sans-serif', 5);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.globalAlpha = 1;
    });
    drawFloats(g);
    flashes.forEach(f => {
      const q = A.ll(f.lon, f.lat), k = 1 - f.t / f.dur, a = f.a * k * k;
      if (a <= 0.01 || calm()) return;
      const r = Math.max(A.SW, A.SH) * 1.1;
      const gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      gr.addColorStop(0, rgba(f.col, a)); gr.addColorStop(0.25, rgba(f.col, a * 0.45)); gr.addColorStop(1, rgba(f.col, 0));
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, A.SW, A.SH);
    });
    if (glitchT > 0 && !calm()) {
      g.globalAlpha = 0.18 * Math.min(1, glitchT);
      for (let i = 0; i < 26; i++) { g.fillStyle = R() < 0.5 ? '#9fe0ff' : '#ffffff'; g.fillRect(0, R() * A.SH, A.SW, rr(1, 3)); }
      g.globalAlpha = 1;
    }
    drawAim(g);
    g.restore();
  };

  function drawFloats(g) {
    g.textAlign = 'left';
    floats.forEach(f => {
      if (f.t < 0) return;
      const glob = f.lon === undefined;
      const q = glob ? [A.SW / 2, 120] : A.ll(f.lon, f.lat);
      if (!glob && (q[0] < -200 || q[0] > A.SW + 200 || q[1] < -60 || q[1] > A.SH + 60)) return;
      const a = bell(f.t, 0, 0.3, f.dur - 0.8, f.dur);
      const col = f.tone > 0.15 ? '#4fc46a' : f.tone < -0.15 ? '#ef6b5f' : '#e3c47a';
      g.font = '600 12px Inter, -apple-system, sans-serif';
      const tw = Math.min(320, g.measureText(f.text).width), w = tw + 40, h = 26;
      const x = cl(q[0] - w / 2, 8, A.SW - w - 8), y = glob ? q[1] + f.slot * 31 - 14 * eo(seg(f.t, 0, f.dur)) - h / 2 : q[1] + 40 + f.slot * 31 - 16 * eo(seg(f.t, 0, f.dur));
      g.globalAlpha = a;
      g.fillStyle = 'rgba(10,13,19,0.92)'; rrect(g, x, y, w, h, 13); g.fill();
      g.strokeStyle = rgba(col, 0.7); g.lineWidth = 1; g.stroke();
      g.fillStyle = rgba(col, 0.2); g.beginPath(); g.arc(x + 13, y + h / 2, 9, 0, TAU); g.fill();
      icon(g, f.icon, x + 13, y + h / 2, 12, col);
      g.fillStyle = '#eef2f6';
      let t = f.text;
      if (g.measureText(t).width > 320) { while (t.length > 4 && g.measureText(t + '…').width > 320) t = t.slice(0, -1); t += '…'; }
      g.fillText(t, x + 28, y + h / 2 + 0.5);
      g.globalAlpha = 1;
    });
  }

  /* Zielvorschau beim Auslösen eines Werkzeugs */
  let aimCache = null;
  function drawAim(g) {
    const pl = A.placing;
    if (!pl || !pl.sb || !pl.mouse) return;
    const t = KY.sandbox.TOOL[pl.sb];
    if (!t) return;
    const sev = KY.ui.st.sev || 3, col = CATCOL[t.cat] || '#e3c47a';
    const [mx, my] = pl.mouse;
    g.textAlign = 'center';
    if (t.target === 'point') {
      const km = t.ev ? radKm(t.ev, sev) : 60;
      const r = Math.max(A.km(km), 16);
      const ok = pl.valid !== false;
      // Während ein eben ausgelöster Effekt läuft, tritt die Vorschau zurück
      if (fxs.some(e => e.dir && e.t < 2.4)) { g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1.2; g.setLineDash([4, 6]); g.beginPath(); g.arc(mx, my, r, 0, TAU); g.stroke(); g.setLineDash([]); g.textAlign = 'left'; return; }
      const c = ok ? col : '#ef6b5f';
      blob(g, c, mx, my, r, 0.12);
      g.strokeStyle = c; g.lineWidth = 1.6; g.setLineDash([6, 5]); g.lineDashOffset = -clock * 24;
      g.beginPath(); g.arc(mx, my, r, 0, TAU); g.stroke(); g.setLineDash([]);
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + clock * 0.6; g.beginPath(); g.moveTo(mx + Math.cos(a) * (r + 4), my + Math.sin(a) * (r + 4)); g.lineTo(mx + Math.cos(a) * (r + 12), my + Math.sin(a) * (r + 12)); g.stroke(); }
      g.beginPath(); g.moveTo(mx - 7, my); g.lineTo(mx + 7, my); g.moveTo(mx, my - 7); g.lineTo(mx, my + 7); g.stroke();
      if (t.id === 'meteor') { g.strokeStyle = rgba('#ffb04a', 0.6); g.setLineDash([3, 6]); g.beginPath(); g.moveTo(mx - 150, my - 230); g.lineTo(mx - r * 0.5, my - r * 0.75); g.stroke(); g.setLineDash([]); }
      if (t.coast) {
        if (!aimCache || Math.abs(aimCache.x - mx) > 4 || Math.abs(aimCache.y - my) > 4) { const ll = KY.map.toLonLat(mx, my); const rc = KY.geo.nearestCity(ll.lon, ll.lat, c2 => c2.coastal); aimCache = { x: mx, y: my, rc }; }
        const rc = aimCache.rc;
        if (rc && rc.km <= 900) { const q = A.ll(rc.city.lon, rc.city.lat); g.strokeStyle = rgba('#bfe9ff', 0.85); g.setLineDash([5, 5]); g.beginPath(); g.moveTo(mx, my); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(q[0], q[1], 9 + 3 * Math.sin(clock * 6), 0, TAU); g.stroke(); textOut(g, 'Welle trifft ' + rc.city.name, q[0], q[1] - 18, '#d8f2ff', '600 12px Inter, -apple-system, sans-serif', 3); }
        else textOut(g, 'Keine Küste in Reichweite', mx, my - r - 22, '#ffb0a8', '600 12px Inter, -apple-system, sans-serif', 3);
      }
      textOut(g, t.n + (t.sev ? ' · Stufe ' + sev : ''), mx, my + r + 20, '#f4ecda', '700 12px Inter, -apple-system, sans-serif', 3);
      if (t.ev && D.EVENTS[t.ev].radius) textOut(g, 'Wirkungskreis ' + U.n(km * 2) + ' km', mx, my + r + 36, '#aab3bf', '500 11px Inter, -apple-system, sans-serif', 3);
    } else if (t.target === 'two' && pl.first >= 0) {
      const a = cap(pl.first), ll = KY.map.toLonLat(mx, my);
      const G = arcGeom({ lon: a.lon, lat: a.lat }, ll);
      strokeArc(g, G, 0, 1, col, 2.2, 0.9, [8, 6]);
      textOut(g, t.n, mx, my - 22, '#f4ecda', '700 12px Inter, -apple-system, sans-serif', 3);
    } else if (t.target === 'nation' || t.target === 'two') {
      textOut(g, t.n, mx, my - 22, '#f4ecda', '700 12px Inter, -apple-system, sans-serif', 3);
    }
    g.textAlign = 'left';
  }
})();
