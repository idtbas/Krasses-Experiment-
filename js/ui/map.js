/* KYTHERA · MANDAT · Weltkarte: Darstellung, Ebenen, Gesten (Trackpad, Touch, Tastatur), Platzierung */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const M = (KY.map = {});
  const WW = 2048, WH = 1024;
  M.WW = WW; M.WH = WH;

  let cv, ctx, W, dpr = 1, SW = 0, SH = 0;
  let tex = null, overlay = null, overlayKey = '', overlayDay = -999;
  let borderPath = null, riverPaths = [], natOutline = [];
  const view = { x: WW / 2, y: WH / 2, z: 1 };
  let anim = null, dirty = true, time = 0, lastDraw = 0, viewT = 0;
  let detail = null, djob = null;
  let hits = [];
  let hover = null, sel = null, hoverNation = -1;
  M.placing = null;

  M.LAYERS = [
    { id: 'terrain', n: 'Gelände', icon: 'mountain' },
    { id: 'pol', n: 'Staaten', icon: 'flag' },
    { id: 'op', n: 'Haltung', icon: 'users', legend: ['Ablehnung', 'neutral', 'Zustimmung'], div: true },
    { id: 'happy', n: 'Zufriedenheit', icon: 'face', legend: ['niedrig', 'hoch'] },
    { id: 'unrest', n: 'Unruhe', icon: 'megaphone', legend: ['ruhig', 'unruhig'], orange: true },
    { id: 'wealth', n: 'Wohlstand', icon: 'coins', legend: ['¤ 2.000', '¤ 70.000'] },
    { id: 'energy', n: 'Energie', icon: 'bolt', legend: ['knapp', 'gesichert'] },
    { id: 'health', n: 'Gesundheit', icon: 'hospital', legend: ['schwach', 'stark'] },
    { id: 'rel', n: 'Beziehungen', icon: 'hands' },
    { id: 'orbit', n: 'Orbit', icon: 'sat' },
  ];
  const BLUE = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6', '#cde2fb'];
  const ORANGE = ['#3a1d10', '#5a2a14', '#7a3716', '#9a4418', '#b9521c', '#d95926', '#ea7040', '#f08c62', '#f5aa88', '#f9c8ae'];
  const EVCOL = { quake: '#ec835a', storm: '#7b8cff', flood: '#3987e5', drought: '#c9a24f', fire: '#ff6a3d', epidemic: '#d55181', heat: '#ff7a45', cold: '#7fd3ff', volcano: '#ff4d3d', tsunami: '#4fb3ff', tornado: '#9a8f82', landslide: '#a07850', sandstorm: '#d9b46a', locusts: '#9a8a3a', solarstorm: '#ffb04a', aurora: '#5fe0a0', eclipse: '#b69cff', meteor: '#ff9a3c' };
  const PHCOL = { antrag: '#9aa4b1', bau: '#fab219', laufend: '#5aa7f0', betrieb: '#4fc46a', abgeschlossen: '#8fa0b3', abgelehnt: '#d03b3b', pausiert: '#c9a24f', stillgelegt: '#6b7280', aufgegeben: '#6b7280', uebergeben: '#8fa0b3' };
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rampColor = (ramp, t) => { const i = U.clamp(t, 0, 1) * (ramp.length - 1); const a = hexRgb(ramp[Math.floor(i)]), b = hexRgb(ramp[Math.min(ramp.length - 1, Math.floor(i) + 1)]); const f = i - Math.floor(i); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
  M.rampCss = (id) => { const L = M.LAYERS.find(l => l.id === id); if (!L) return ''; if (L.div) return 'linear-gradient(90deg,#e66767,#383835,#3987e5)'; const r = L.orange ? ORANGE : BLUE; return 'linear-gradient(90deg,' + r.join(',') + ')'; };

  const lonX = lon => (lon + 180) / 360 * WW;
  const latY = lat => (90 - lat) / 180 * WH;
  const xLon = x => x / WW * 360 - 180;
  const yLat = y => 90 - y / WH * 180;
  M.lonX = lonX; M.latY = latY;
  const kmUnits = km => km / 111.2 * (WW / 360);

  /* ---------- Vorbereitung (beim Laden der Welt) ---------- */
  M.prepare = async function (world, progress) {
    W = world;
    progress = progress || (() => {});
    progress(0.1, 'Relief wird schattiert');
    await new Promise(r => setTimeout(r, 20));
    const px = KY.paint.paint(world, WW, WH);
    tex = document.createElement('canvas');
    tex.width = WW; tex.height = WH;
    const tctx = tex.getContext('2d');
    tctx.putImageData(new ImageData(px, WW, WH), 0, 0);
    progress(0.6, 'Grenzen werden vermessen');
    await new Promise(r => setTimeout(r, 10));
    buildPaths();
    progress(0.9, 'Flussläufe werden eingezeichnet');
    buildRivers();
    progress(1, 'Karte bereit');
  };
  M.texture = () => tex;

  function chains(edgeTest) {
    const GW = W.GW, GH = W.GH, N = W.nation;
    const adj = new Map();
    const add = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
    const V = (i, j) => j * (GW + 1) + i;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const a = N[j * GW + i];
      if (i < GW - 1) { const b = N[j * GW + i + 1]; if (edgeTest(a, b)) add(V(i + 1, j), V(i + 1, j + 1)); }
      if (j < GH - 1) { const b = N[(j + 1) * GW + i]; if (edgeTest(a, b)) add(V(i, j + 1), V(i + 1, j + 1)); }
    }
    const used = new Set();
    const ek = (a, b) => a < b ? a + ',' + b : b + ',' + a;
    const out = [];
    const walk = start => {
      const pts = [start]; let cur = start;
      for (;;) {
        const nb = (adj.get(cur) || []).find(n => !used.has(ek(cur, n)));
        if (nb === undefined) break;
        used.add(ek(cur, nb)); pts.push(nb); cur = nb;
        if (cur === start) break;
      }
      return pts;
    };
    adj.forEach((nbs, v) => { if (nbs.length % 2 === 1) while ((adj.get(v) || []).some(n => !used.has(ek(v, n)))) { const p = walk(v); if (p.length > 1) out.push(p); } });
    adj.forEach((nbs, v) => { while (nbs.some(n => !used.has(ek(v, n)))) { const p = walk(v); if (p.length > 1) out.push(p); } });
    const cs = WW / GW;
    return out.map(p => p.map(v => [(v % (GW + 1)) * cs, Math.floor(v / (GW + 1)) * cs]));
  }
  function chaikin(pts, it, closed) {
    for (let k = 0; k < it; k++) {
      const o = closed ? [] : [pts[0]];
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      if (!closed) o.push(pts[n - 1]);
      pts = o;
    }
    return pts;
  }
  function toPath(list, path) {
    path = path || new Path2D();
    list.forEach(pts => {
      const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
      const s = chaikin(pts, 2, closed);
      path.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < s.length; i++) path.lineTo(s[i][0], s[i][1]);
      if (closed) path.closePath();
    });
    return path;
  }
  function buildPaths() {
    borderPath = toPath(chains((a, b) => a >= 0 && b >= 0 && a !== b));
    natOutline = W.nations.map(n => toPath(chains((a, b) => (a === n.id) !== (b === n.id))));
  }
  function buildRivers() {
    riverPaths = [new Path2D(), new Path2D(), new Path2D()];
    W.rivers.forEach(line => {
      if (line.length < 3) return;
      let cls = -1;
      const pts = [];
      line.forEach((p, i) => { if (p.f >= 2 && (i % 2 === 0 || i === line.length - 1)) { pts.push([lonX(p.lon), latY(p.lat)]); cls = Math.max(cls, p.f >= 9 ? 2 : p.f >= 4 ? 1 : 0); } });
      if (pts.length < 2 || cls < 0) return;
      // Sprünge über die Datumsgrenze trennen
      let seg = [pts[0]];
      const flush = () => { if (seg.length > 1) { const s = chaikin(seg, 3, false); riverPaths[cls].moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) riverPaths[cls].lineTo(s[i][0], s[i][1]); } };
      for (let i = 1; i < pts.length; i++) { if (Math.abs(pts[i][0] - pts[i - 1][0]) > WW / 2) { flush(); seg = []; } seg.push(pts[i]); }
      flush();
    });
  }

  /* ---------- Initialisierung ---------- */
  M.init = function (canvas, world) {
    cv = canvas; ctx = cv.getContext('2d'); W = world;
    sel = null; M.placing = null; overlayKey = ''; overlay = null; detail = null; djob = null;
    if (KY.fx) KY.fx.reset();
    resize();
    if (!M.bound) { M.bound = true; window.addEventListener('resize', () => { resize(); dirty = true; }); bindInput(); }
    M.home(true);
    const S = SIM.S;
    if (S.ui.view) { view.x = S.ui.view.x; view.y = S.ui.view.y; view.z = Math.max(zmin(), S.ui.view.z); clampView(); }
    M.layer = S.ui.layer || 'pol';
    buildLayerCtl();
  };
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    SW = cv.clientWidth; SH = cv.clientHeight;
    cv.width = Math.round(SW * dpr); cv.height = Math.round(SH * dpr);
    if (view.z < zmin()) view.z = zmin();
    clampView();
  }
  const zmin = () => Math.max(SW / WW, (SH - 60) / WH * 0.98);
  const zmax = () => zmin() * 16;
  M.zoomLevel = () => view.z / zmin();
  function clampView() {
    viewT = time;
    view.z = U.clamp(view.z, zmin(), zmax());
    const hh = SH / 2 / view.z;
    if (WH <= hh * 2) view.y = WH / 2;
    else view.y = U.clamp(view.y, hh - 30 / view.z, WH - hh + 40 / view.z);
    view.x = ((view.x % WW) + WW) % WW;
  }
  M.home = function (instant) {
    // Größte Landmasse mittig
    let best = null;
    if (SIM.S) SIM.W.nations.forEach(n => { if (!best || n.pop > best.pop) best = n; });
    const tgt = { x: best ? lonX(best.lon) : WW / 2, y: WH / 2 + 20, z: zmin() * 1.15 };
    if (instant) { Object.assign(view, tgt); clampView(); dirty = true; } else animateTo(tgt);
  };
  M.focus = function (lon, lat, zl) {
    const z = zl ? zmin() * zl : Math.max(view.z, zmin() * 2.2);
    let x = lonX(lon);
    if (x - view.x > WW / 2) x -= WW; else if (view.x - x > WW / 2) x += WW;
    const offX = (document.body.classList.contains('insp-open') ? 190 : 0) - (KY.ui.cur ? 220 : 0);
    animateTo({ x: x + offX / z, y: latY(lat), z });
  };
  function animateTo(t) {
    anim = { from: Object.assign({}, view), to: t, t: 0, d: 0.45 };
  }
  M.zoomBy = function (f, sx, sy) {
    sx = sx === undefined ? SW / 2 : sx; sy = sy === undefined ? SH / 2 : sy;
    const wx = (sx - SW / 2) / view.z + view.x, wy = (sy - SH / 2) / view.z + view.y;
    view.z = U.clamp(view.z * f, zmin(), zmax());
    view.x = wx - (sx - SW / 2) / view.z; view.y = wy - (sy - SH / 2) / view.z;
    clampView(); dirty = true; saveView();
  };
  M.panBy = function (dx, dy) { view.x += dx / view.z; view.y += dy / view.z; clampView(); dirty = true; saveView(); };
  let svT = 0;
  function saveView() { clearTimeout(svT); svT = setTimeout(() => { if (SIM.S) SIM.S.ui.view = { x: view.x, y: view.y, z: view.z }; }, 400); }
  M.toWorld = (sx, sy) => ({ x: (sx - SW / 2) / view.z + view.x, y: (sy - SH / 2) / view.z + view.y });
  M.toLonLat = (sx, sy) => { const w = M.toWorld(sx, sy); let lon = xLon(((w.x % WW) + WW) % WW); return { lon, lat: U.clamp(yLat(w.y), -89.9, 89.9) }; };
  function toScreen(wx, wy) {
    let dx = wx - view.x;
    if (dx > WW / 2) dx -= WW; else if (dx < -WW / 2) dx += WW;
    return [dx * view.z + SW / 2, (wy - view.y) * view.z + SH / 2];
  }
  const llScreen = (lon, lat) => toScreen(lonX(lon), latY(lat));
  M.llScreen = llScreen;

  /* ---------- Detailansicht: sichtbarer Ausschnitt in voller Auflösung ---------- */
  const DETAIL_ZL = 2.2;
  function viewRect() { return { u0: view.x - SW / 2 / view.z, v0: view.y - SH / 2 / view.z, uw: SW / view.z, vh: SH / view.z }; }
  const alignU = u => u + Math.round((view.x - u) / WW) * WW;
  function covers(d) {
    if (!d) return false;
    const r = viewRect();
    const du0 = alignU(d.u0 + d.uw / 2) - d.uw / 2;
    return r.u0 >= du0 - 0.5 && r.u0 + r.uw <= du0 + d.uw + 0.5 && r.v0 >= d.v0 - 0.5 && r.v0 + r.vh <= d.v0 + d.vh + 0.5 && d.W / d.uw >= view.z * 0.8;
  }
  function stepDetail() {
    if (!W || view.z / zmin() < DETAIL_ZL) { djob = null; return; }
    if (djob) {
      if (viewT > djob.t0 + 0.001) { djob = null; return; }
      const y1 = Math.min(djob.H, djob.y + 28);
      KY.paint.paintRegion(W, djob.u0, djob.v0, djob.uw, djob.vh, djob.W, djob.H, djob.img.data, djob.y, y1);
      djob.y = y1;
      if (djob.y >= djob.H) {
        const c = document.createElement('canvas');
        c.width = djob.W; c.height = djob.H;
        c.getContext('2d').putImageData(djob.img, 0, 0);
        detail = { cv: c, u0: djob.u0, v0: djob.v0, uw: djob.uw, vh: djob.vh, W: djob.W, H: djob.H };
        djob = null; dirty = true;
      }
      return;
    }
    if (time - viewT < 0.25 || covers(detail)) return;
    const r = viewRect(), m = 0.1;
    const Wd = Math.min(1700, Math.round(SW * (1 + 2 * m))), Hd = Math.min(1200, Math.round(SH * (1 + 2 * m)));
    const v0 = Math.max(0, r.v0 - r.vh * m), v1 = Math.min(WH, r.v0 + r.vh * (1 + m));
    djob = { u0: r.u0 - r.uw * m, v0, uw: r.uw * (1 + 2 * m), vh: v1 - v0, W: Wd, H: Math.max(8, Math.round(Hd * (v1 - v0) / (r.vh * (1 + 2 * m)))), y: 0, t0: viewT };
    djob.img = new ImageData(djob.W, djob.H);
  }
  M.resetDetail = () => { detail = null; djob = null; };

  /* ---------- Ebenen ---------- */
  M.setLayer = function (id) { M.layer = id; if (SIM.S) SIM.S.ui.layer = id; overlayKey = ''; dirty = true; buildLayerCtl(); };
  M.cycleLayer = function (d) { const i = M.LAYERS.findIndex(l => l.id === M.layer); M.setLayer(M.LAYERS[(i + d + M.LAYERS.length) % M.LAYERS.length].id); KY.ui.toast({ t: 'Kartenebene: ' + M.LAYERS.find(l => l.id === M.layer).n, icon: 'layers', ms: 1800 }); };
  M.invalidate = function () { overlayKey = ''; dirty = true; };
  M.dataChanged = function () { dirty = true; if (SIM.S && SIM.S.day - overlayDay >= 10) overlayKey = ''; };
  function buildLayerCtl() {
    const box = U.$('#mapctl');
    if (!box) return;
    const L = M.LAYERS.find(l => l.id === M.layer);
    const leg = L && L.legend ? `<div class="legend"><div class="lbl">${U.esc(L.n)}</div><div class="bar" style="background:${M.rampCss(L.id)}"></div><div class="ends">${L.legend.map(t => '<span>' + U.esc(t) + '</span>').join('')}</div>${L.id === 'op' ? '<div class="dim" style="font-size:10px;margin-top:4px">Blasse Flächen: Sie sind dort kaum bekannt.</div>' : ''}</div>` : '';
    box.innerHTML = leg + `<div class="ctlbox layers">${M.LAYERS.map(l => `<button class="${l.id === M.layer ? 'on' : ''}" data-a="layer" data-v="${l.id}" title="${l.n} (G wechselt)">${KY.icon(l.icon, 14)}${l.id === M.layer ? '<span>' + l.n + '</span>' : ''}</button>`).join('')}</div>
      <div class="ctlbox"><button class="iconbtn" data-a="zoomIn" title="Vergrößern (+)">${KY.icon('zoomIn', 17)}</button><button class="iconbtn" data-a="zoomOut" title="Verkleinern (−)">${KY.icon('zoomOut', 17)}</button><button class="iconbtn" data-a="home" title="Übersicht (0)">${KY.icon('compass', 17)}</button></div>`;
  }
  KY.A.layer = b => M.setLayer(b.dataset.v);
  KY.A.zoomIn = () => M.zoomBy(1.5);
  KY.A.zoomOut = () => M.zoomBy(1 / 1.5);
  KY.A.home = () => M.home();

  function natColor(id, layer) {
    const n = SIM.S.nations[id], w = SIM.W.nations[id];
    switch (layer) {
      case 'pol': case 'rel': { const h = w.hue; const c = hslRgb(h, 0.32, 0.5); return [c[0], c[1], c[2], 0.26]; }
      case 'op': {
        const t = U.clamp(n.op / 40, -1, 1);
        const mid = [56, 56, 53], pos = [57, 135, 229], neg = [230, 103, 103];
        const c = t >= 0 ? mid.map((m, i) => m + (pos[i] - m) * t) : mid.map((m, i) => m + (neg[i] - m) * -t);
        return [c[0], c[1], c[2], 0.18 + 0.55 * U.clamp(n.aware / 60, 0, 1)];
      }
      case 'happy': return rampColor(BLUE, (n.happy - 20) / 65).concat(0.62);
      case 'unrest': return rampColor(ORANGE, n.unrest / 75).concat(0.62);
      case 'wealth': return rampColor(BLUE, (Math.log(n.gdpPc) - Math.log(1800)) / (Math.log(72000) - Math.log(1800))).concat(0.62);
      case 'energy': return rampColor(BLUE, (n.energy - 20) / 80).concat(0.62);
      case 'health': return rampColor(BLUE, (n.health - 20) / 78).concat(0.62);
      case 'orbit': return [8, 12, 22, 0.42];
    }
    return null;
  }
  function hslRgb(h, s, l) {
    h /= 360;
    const f = n => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  function buildOverlay() {
    const L = M.layer;
    const key = L + ':' + SIM.S.day;
    if (L === 'terrain') { overlay = null; overlayKey = key; return; }
    const GW = W.GW, GH = W.GH;
    if (!overlay) { overlay = document.createElement('canvas'); overlay.width = GW; overlay.height = GH; }
    const o = overlay.getContext('2d');
    const img = o.createImageData(GW, GH);
    const cols = SIM.W.nations.map(n => natColor(n.id, L));
    const N = W.nation, d = img.data;
    for (let k = 0; k < GW * GH; k++) {
      const id = N[k];
      if (id < 0) continue;
      const c = cols[id];
      d[k * 4] = c[0]; d[k * 4 + 1] = c[1]; d[k * 4 + 2] = c[2]; d[k * 4 + 3] = c[3] * 255;
    }
    o.putImageData(img, 0, 0);
    overlayKey = key; overlayDay = SIM.S.day;
  }

  /* ---------- Zeichnen ---------- */
  M.frame = function (dt) {
    time += dt;
    stepDetail();
    if (anim) {
      anim.t += dt / anim.d;
      const e = U.smooth(Math.min(1, anim.t));
      view.x = anim.from.x + (anim.to.x - anim.from.x) * e;
      view.y = anim.from.y + (anim.to.y - anim.from.y) * e;
      view.z = anim.from.z + (anim.to.z - anim.from.z) * e;
      clampView(); dirty = true;
      if (anim.t >= 1) { anim = null; saveView(); }
    }
    if (KY.fx) KY.fx.update(dt);
    const animating = M.hasAnim();
    const fast = KY.fx && KY.fx.busy();
    if (!dirty && !(animating && (fast || time - lastDraw > 1 / 30))) return;
    dirty = false; lastDraw = time;
    draw();
  };
  M.hasAnim = () => SIM.S && (SIM.S.events.some(e => e.phase !== 'vorbei') || SIM.S.incidents.some(i => i.status === 'offen') || M.placing || SIM.S.cities.some(c => c.protest) || (SIM.S.orbit && SIM.S.orbit.sats.length) || launchFx.length || (KY.fx && KY.fx.busy()));
  M.redraw = () => { dirty = true; };

  function worldCopies() {
    const out = [];
    for (let k = -1; k <= 1; k++) {
      const x0 = (k * WW - view.x) * view.z + SW / 2, x1 = x0 + WW * view.z;
      if (x1 > 0 && x0 < SW) out.push(k * WW);
    }
    return out;
  }

  function draw() {
    if (!ctx || !tex) return;
    const S = SIM.S;
    if (overlayKey.split(':')[0] !== M.layer || !overlayKey) buildOverlay();
    const z = view.z;
    const zl = z / zmin();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1d31';
    ctx.fillRect(0, 0, SW, SH);
    const copies = worldCopies();
    const wt = off => ctx.setTransform(z * dpr, 0, 0, z * dpr, (off - view.x) * z * dpr + SW / 2 * dpr, (-view.y) * z * dpr + SH / 2 * dpr);
    const FX = KY.fx;
    if (FX) FX.begin({
      ctx, dpr, SW, SH, z, zl, WW, WH, ll: llScreen, km: km => kmUnits(km) * z, nat: natOutline, placing: M.placing, hoverNation,
      eachWorld: (g, s, fn) => { for (const off of copies) { g.setTransform(z * s, 0, 0, z * s, (off - view.x) * z * s + SW / 2 * s, (-view.y) * z * s + SH / 2 * s); fn(off); } },
    });
    for (const off of copies) {
      wt(off);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = zl > 4 ? 'high' : 'medium';
      ctx.drawImage(tex, 0, 0, WW, WH);
      if (detail && zl >= DETAIL_ZL) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WW, WH); ctx.clip();
        const du = alignU(detail.u0 + detail.uw / 2) - detail.uw / 2 - off;
        ctx.drawImage(detail.cv, du, detail.v0, detail.uw, detail.vh);
        ctx.restore();
      }
      if (overlay && M.layer !== 'terrain') ctx.drawImage(overlay, 0, 0, WW, WH);
      // Flüsse
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(92,146,190,0.62)';
      [0.5, 0.9, 1.5].forEach((w, i) => { if (i === 0 && zl < 1.6) return; ctx.lineWidth = Math.max(w * 0.9, w * Math.sqrt(zl) * 0.6) / z; ctx.stroke(riverPaths[i]); });
      // Grenzen
      ctx.strokeStyle = M.layer === 'terrain' ? 'rgba(20,16,10,0.55)' : 'rgba(18,14,10,0.7)';
      ctx.lineWidth = (zl > 3 ? 1.6 : 1.1) / z;
      ctx.setLineDash([]);
      ctx.stroke(borderPath);
      ctx.strokeStyle = 'rgba(255,240,210,0.22)';
      ctx.lineWidth = 0.6 / z;
      ctx.stroke(borderPath);
      // Ausgewählter oder überfahrener Staat
      const hl = sel && sel.type === 'nation' ? sel.id : -1;
      const hv = M.placing && (M.placing.kind === 'nation' || M.placing.kind === 'two') ? hoverNation : -1;
      [[hl, 'rgba(227,196,122,0.95)'], [hv, 'rgba(255,255,255,0.8)']].forEach(([id, col]) => {
        if (id < 0 || !natOutline[id]) return;
        ctx.strokeStyle = col; ctx.lineWidth = 2.2 / z; ctx.stroke(natOutline[id]);
      });
      if (M.placing && M.placing.kind === 'two' && M.placing.first >= 0) { ctx.strokeStyle = 'rgba(227,196,122,0.95)'; ctx.lineWidth = 2.2 / z; ctx.stroke(natOutline[M.placing.first]); }
      // Landesweite Ereignisse
      S.events.forEach(ev => {
        if (ev.phase === 'vorbei' || !ev.nationwide) return;
        const a = 0.45 + 0.35 * Math.sin(time * 3);
        ctx.strokeStyle = U.fill('rgba({r},{g},{b},' + a.toFixed(2) + ')', (c => ({ r: c[0], g: c[1], b: c[2] }))(hexRgb(EVCOL[ev.type] || '#ffffff')));
        ctx.lineWidth = 2.6 / z; ctx.stroke(natOutline[ev.n]);
      });
      if (FX) FX.world(ctx, z);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hits = [];
    drawRoads(zl);
    drawRelations();
    drawNationLabels(zl);
    drawProjectShapes(zl);
    if (FX) FX.under();
    drawEvents(zl);
    drawCities(zl);
    drawProjects(zl);
    drawOrbit(zl);
    drawPlacing();
    if (FX) FX.over();
  }

  /* ---------- Satelliten und Raketenstarts ---------- */
  const launchFx = [];
  KY.bus.on('launch', m => { launchFx.push({ lon: m.lon, lat: m.lat, t0: time, ok: m.status === 'erfolg' }); dirty = true; });
  function satPos(s, tt) {
    const R = Math.PI / 180;
    const th = s.phase + tt * 2 * Math.PI / s.period;
    const lat = Math.asin(Math.sin(s.inc * R) * Math.sin(th)) / R;
    const lo = Math.atan2(Math.cos(s.inc * R) * Math.sin(th), Math.cos(th)) / R;
    let lon = s.raan + lo - tt * 3.2;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lon, lat };
  }
  M.satPos = s => satPos(s, time);
  function drawOrbit(zl) {
    const S = SIM.S;
    const st = S.orbit;
    const full = M.layer === 'orbit';
    ctx.save();
    if (st && st.sats.length) {
      const sats = st.sats.length > 120 ? st.sats.slice(0, 120) : st.sats;
      if (full) {
        // Bodenspuren der letzten halben Umlaufbahn
        ctx.lineWidth = 1.2;
        sats.forEach(sat => {
          const col = D.SATS[sat.type].col;
          ctx.strokeStyle = col; ctx.globalAlpha = 0.28;
          ctx.beginPath();
          let last = null;
          for (let k = 0; k <= 40; k++) {
            const pp = satPos(sat, time - sat.period * 0.5 * (1 - k / 40));
            const q = llScreen(pp.lon, pp.lat);
            if (!last || Math.abs(q[0] - last[0]) > SW / 2) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
            last = q;
          }
          ctx.stroke();
          if (sat.type === 'komm') {
            const pp = satPos(sat, time), q = llScreen(pp.lon, pp.lat);
            ctx.globalAlpha = 0.06; ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(q[0], q[1], kmUnits(1600) * view.z, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
      ctx.globalAlpha = 1;
      sats.forEach(sat => {
        const pp = satPos(sat, time), q = llScreen(pp.lon, pp.lat);
        if (q[0] < -10 || q[0] > SW + 10 || q[1] < -10 || q[1] > SH + 10) return;
        if (KY.fx && KY.fx.satGlitch()) return;
        const col = D.SATS[sat.type].col;
        const r = full ? (sat.type === 'modul' ? 4.5 : 3) : 1.8;
        if (full) { ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(q[0], q[1], r * 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = full ? 1 : 0.7;
        ctx.fillStyle = full ? col : '#e8f4ff';
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
        if (full) hits.push({ x: q[0], y: q[1], r: 8, type: 'sat', id: sat.id, pri: 0 });
      });
    }
    // Geplante Starts
    if (st) st.missions.forEach(m => {
      if (m.status !== 'geplant') return;
      const q = llScreen(m.lon, m.lat);
      ctx.globalAlpha = 1;
      badge(q[0] + 16, q[1] - 16, 'rocket', '#e3c47a', 9);
      ctx.font = '700 10px Inter, sans-serif'; ctx.fillStyle = '#e3c47a';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,0.85)';
      const t = 'T−' + (m.launch - S.day);
      ctx.strokeText(t, q[0] + 28, q[1] - 13); ctx.fillText(t, q[0] + 28, q[1] - 13);
    });
    // Startanimation
    for (let i = launchFx.length - 1; i >= 0; i--) {
      const f = launchFx[i];
      const p = (time - f.t0) / 4;
      if (p > 1) { launchFx.splice(i, 1); continue; }
      const q = llScreen(f.lon, f.lat);
      const fail = !f.ok && p > 0.38;
      const pp = fail ? 0.38 : p;
      const x = q[0] + pp * 110, y = q[1] - pp * 230 + pp * pp * 70;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,230,190,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(q[0], q[1]);
      for (let k = 1; k <= 20; k++) { const t = pp * k / 20; ctx.lineTo(q[0] + t * 110, q[1] - t * 230 + t * t * 70); }
      ctx.stroke();
      if (fail) {
        const e = (p - 0.38) / 0.62;
        ctx.globalAlpha = 1 - e;
        ctx.fillStyle = '#ffb35a'; ctx.beginPath(); ctx.arc(x, y, 6 + e * 34, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,160,60,0.8)'; ctx.beginPath(); ctx.arc(x - 3, y + 6, 4 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRoads(zl) {
    if (zl < 2.2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(240,226,190,' + U.clamp((zl - 2.2) / 2, 0, 0.35).toFixed(2) + ')';
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    W.roads.forEach(r => {
      const a = W.cities[r.a], b = W.cities[r.b];
      const pa = llScreen(a.lon, a.lat), pb = llScreen(b.lon, b.lat);
      if (Math.abs(pa[0] - pb[0]) > SW) return;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    });
    ctx.restore();
  }
  function drawRelations() {
    const S = SIM.S;
    const all = M.layer === 'rel';
    ctx.save();
    for (const k in S.rel) {
      const R = S.rel[k];
      if (!all && R.state !== 'krise' && R.state !== 'eiszeit') continue;
      if (all && R.state === 'normal') continue;
      const [a, b] = k.split(':').map(Number);
      const A = SIM.W.nations[a], B = SIM.W.nations[b];
      const pa = llScreen(A.lon, A.lat), pb = llScreen(B.lon, B.lat);
      if (Math.abs(pa[0] - pb[0]) > SW * 0.9) continue;
      const col = R.state === 'eiszeit' ? '#d03b3b' : R.state === 'krise' ? '#ec835a' : R.state === 'angespannt' ? '#fab219' : '#4fc46a';
      ctx.strokeStyle = col; ctx.globalAlpha = R.state === 'partner' ? 0.5 : 0.85;
      ctx.lineWidth = R.state === 'eiszeit' ? 2.5 : 1.8;
      ctx.setLineDash(R.state === 'partner' ? [] : [6, 5]);
      ctx.lineDashOffset = -time * 12;
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2 - Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 0.18;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.quadraticCurveTo(mx, my, pb[0], pb[1]); ctx.stroke();
      if (R.state === 'krise' || R.state === 'eiszeit') {
        ctx.globalAlpha = 1; ctx.setLineDash([]);
        badge(mx * 0.5 + (pa[0] + pb[0]) / 4, my * 0.5 + (pa[1] + pb[1]) / 4, 'alert', col, 9);
        hits.push({ x: mx * 0.5 + (pa[0] + pb[0]) / 4, y: my * 0.5 + (pa[1] + pb[1]) / 4, r: 11, type: 'rel', a, b });
      }
    }
    ctx.restore();
  }
  function drawNationLabels(zl) {
    if (zl > 5.5) return;
    const S = SIM.S;
    const a = zl < 1.2 ? 0.75 : U.clamp(1 - (zl - 3) / 2.5, 0, 0.75);
    if (a <= 0.02) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.round(U.clamp(10 + zl * 1.6, 10, 16));
    ctx.font = '600 ' + fs + 'px Inter, -apple-system, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (fs * 0.22).toFixed(1) + 'px';
    SIM.W.nations.forEach(n => {
      if (n.cells < 120 && zl < 1.6) return;
      const p = llScreen(n.lon, n.lat);
      if (p[0] < -100 || p[0] > SW + 100) return;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,0.55)';
      const t = n.short.toUpperCase();
      ctx.strokeText(t, p[0], p[1]);
      ctx.fillStyle = S.g && S.nations[n.id].crisis ? '#ffd3a8' : 'rgba(244,236,218,0.95)';
      ctx.fillText(t, p[0], p[1]);
    });
    ctx.restore();
  }

  function drawProjectShapes(zl) {
    const S = SIM.S;
    ctx.save();
    for (const p of S.projects) {
      const A = D.ACT[p.act];
      const col = PHCOL[p.phase] || '#999';
      const dead = p.phase === 'stillgelegt' || p.phase === 'aufgegeben' || p.phase === 'abgelehnt';
      if (p.area) {
        const a = llScreen(p.area.lon0, p.area.lat0), b = llScreen(p.area.lon1, p.area.lat1);
        if (Math.abs(a[0] - b[0]) > SW) continue;
        const fill = p.act === 'MEER' ? 'rgba(57,135,229,' : p.act === 'WUESTE' ? 'rgba(201,162,79,' : 'rgba(79,196,106,';
        ctx.fillStyle = fill + (dead ? 0.05 : 0.14 + (p.phase === 'betrieb' ? 0.1 : 0)) + ')';
        ctx.strokeStyle = fill + (dead ? 0.3 : 0.75) + ')';
        ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3;
        const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      } else if (p.c2 >= 0 && (A.place.indexOf('line') === 0)) {
        const a = W.cities[p.c], b = W.cities[p.c2];
        const pa = llScreen(a.lon, a.lat), pb = llScreen(b.lon, b.lat);
        if (Math.abs(pa[0] - pb[0]) > SW) continue;
        ctx.globalAlpha = dead ? 0.35 : 1;
        ctx.setLineDash(p.act === 'SEEKABEL' ? [2, 5] : p.phase === 'bau' || p.phase === 'antrag' ? [7, 5] : []);
        ctx.lineDashOffset = p.phase === 'bau' ? -time * 10 : 0;
        if (p.act === 'HSR') { ctx.strokeStyle = 'rgba(10,12,16,0.8)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); }
        ctx.strokeStyle = p.act === 'SEEKABEL' ? '#7fd3ff' : p.act === 'HGUE' ? '#fab219' : col;
        ctx.lineWidth = p.act === 'HSR' ? 2.6 : p.act === 'BRUECKE' ? 3.4 : 1.8;
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function badge(x, y, icon, col, r, ring) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,11,16,0.92)'; ctx.fill();
    ctx.lineWidth = ring || 2; ctx.strokeStyle = col; ctx.stroke();
    const s = r * 1.15;
    ctx.translate(x - s / 2, y - s / 2); ctx.scale(s / 24, s / 24);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#eef2f6';
    KY.iconPaths(icon).forEach(p => ctx.stroke(p));
    ctx.restore();
  }
  M.badge = badge;

  function drawEvents(zl) {
    const S = SIM.S;
    for (const ev of S.events) {
      if (ev.phase === 'vorbei' && S.day - ev.end > 20) continue;
      const done = ev.phase === 'vorbei';
      let lon = ev.lon, lat = ev.lat;
      const age = S.day - ev.start;
      if (ev.from && age < 3) { const t = U.smooth(Math.min(1, (age + (time % 1) * 0) / 3)); lon = ev.from.lon + (ev.lon - ev.from.lon) * t; lat = ev.from.lat + (ev.lat - ev.from.lat) * t; }
      const p = llScreen(lon, lat);
      if (p[0] < -200 || p[0] > SW + 200) continue;
      const col = EVCOL[ev.type] || '#fff';
      const rgb = hexRgb(col).join(',');
      if (ev.radius && !ev.nationwide) {
        const r = kmUnits(ev.radius) * view.z;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rgb + ',' + (done ? 0.05 : 0.13) + ')'; ctx.fill();
        if (!done) {
          const ph = (time * 0.6) % 1;
          ctx.beginPath(); ctx.arc(p[0], p[1], r * (0.3 + ph * 0.7), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.6 * (1 - ph)).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      if (KY.fx) { ctx.save(); KY.fx.ambient(ctx, ev, p[0], p[1], ev.radius ? kmUnits(ev.radius) * view.z : 0, done); ctx.restore(); }
      if (ev.type === 'storm' && !done) {
        ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-time * 2.2);
        const s = 18 + ev.sev * 4;
        ctx.translate(-s / 2, -s / 2); ctx.scale(s / 24, s / 24);
        ctx.strokeStyle = 'rgba(' + rgb + ',0.95)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        KY.iconPaths('storm').forEach(pp => ctx.stroke(pp));
        ctx.restore();
      }
      const br = 10 + ev.sev;
      badge(p[0], p[1] - (ev.type === 'storm' && !done ? 22 : 0), D.EVENTS[ev.type].icon, done ? '#6b7280' : col, br);
      hits.push({ x: p[0], y: p[1] - (ev.type === 'storm' && !done ? 22 : 0), r: br + 3, type: 'ev', id: ev.id });
    }
  }

  function drawCities(zl) {
    const S = SIM.S;
    const cities = W.cities.slice().sort((a, b) => b.pop - a.pop);
    const placed = [];
    const pl = M.placing;
    ctx.save();
    ctx.textBaseline = 'middle';
    cities.forEach((c, rank) => {
      const p = llScreen(c.lon, c.lat);
      if (p[0] < -40 || p[0] > SW + 40 || p[1] < -40 || p[1] > SH + 40) return;
      const sc = S.cities[c.id];
      const r = U.clamp(1.8 + Math.sqrt(sc.pop) * 1.1, 2, 7) * U.clamp(0.75 + zl * 0.12, 0.8, 1.4);
      let valid = true;
      if (pl && pl.cityFilter) valid = pl.cityFilter(c);
      const dim = pl && pl.cityFilter && !valid;
      ctx.globalAlpha = dim ? 0.3 : 1;
      if (pl && pl.cityFilter && valid) {
        const ph = (time * 1.2) % 1;
        ctx.beginPath(); ctx.arc(p[0], p[1], r + 4 + ph * 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(227,196,122,' + (0.8 * (1 - ph)).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.stroke();
      }
      const dark = KY.fx ? KY.fx.cityDim(c.nation) : 0;
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fillStyle = dark > 0.5 ? '#34342f' : sc.dmg > 0.2 ? '#ec835a' : '#f4ecda'; ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(8,10,14,0.85)'; ctx.stroke();
      if (c.capital) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 2.6, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(244,236,218,0.8)'; ctx.lineWidth = 1.1; ctx.stroke(); }
      if (sel && sel.type === 'city' && sel.id === c.id) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 7, 0, Math.PI * 2); ctx.strokeStyle = '#e3c47a'; ctx.lineWidth = 2.2; ctx.stroke(); }
      hits.push({ x: p[0], y: p[1], r: Math.max(9, r + 4), type: 'city', id: c.id, pri: 1 });
      // Beschriftung
      const show = zl >= 1.5 ? (rank < 12 * zl * zl || c.capital) : c.capital && zl >= 1.05;
      if (show) {
        const fs = c.capital ? 12 : 11;
        ctx.font = (c.capital ? '700 ' : '600 ') + fs + 'px Inter, -apple-system, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        const w = ctx.measureText(c.name).width;
        const box = [p[0] + r + 5, p[1] - 8, w + 2, 16];
        if (!placed.some(b => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1])) {
          placed.push(box);
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,0.8)'; ctx.strokeText(c.name, box[0], p[1]);
          ctx.fillStyle = '#f4ecda'; ctx.fillText(c.name, box[0], p[1]);
        }
      }
      // Proteste
      if (sc.protest) {
        const st = sc.protest.stage;
        const col = st >= 3 ? '#d03b3b' : st >= 2 ? '#ec835a' : '#fab219';
        const bx = p[0] - r - 12, by = p[1] - r - 10;
        const pulse = st >= 2 ? 1 + 0.12 * Math.sin(time * 6) : 1;
        badge(bx, by, 'megaphone', col, 9 * pulse);
        hits.push({ x: bx, y: by, r: 11, type: 'city', id: c.id, pri: 3 });
      }
    });
    ctx.restore();
  }

  function drawProjects(zl) {
    const S = SIM.S;
    const perCity = {};
    const openInc = new Set(S.incidents.filter(i => i.status === 'offen').map(i => i.proj));
    for (const p of S.projects) {
      if (p.lon === undefined || p.n < 0 || p.lon === null) continue;
      const A = D.ACT[p.act];
      if (A.place === 'global' || A.place === 'front' || A.place === 'event') continue;
      if (p.phase === 'abgelehnt' && S.day - (p.rejectedAt || 0) > 200) continue;
      let lon = p.lon, lat = p.lat;
      if (A.place.indexOf('line') === 0 && p.c2 >= 0) { const a = W.cities[p.c], b = W.cities[p.c2]; lon = a.lon + KY.geo.dlon(a.lon, b.lon) / 2; lat = (a.lat + b.lat) / 2; }
      let pt = llScreen(lon, lat);
      if (pt[0] < -40 || pt[0] > SW + 40 || pt[1] < -40 || pt[1] > SH + 40) continue;
      // Mehrere Vorhaben am selben Ort im Kreis anordnen
      const key = Math.round(pt[0] / 14) + ':' + Math.round(pt[1] / 14);
      const k = perCity[key] = (perCity[key] || 0) + 1;
      if (k > 1 || (A.place.indexOf('city') === 0 || A.place === 'nation')) {
        const ang = -Math.PI / 2 + (k - 1) * 0.9 + (A.place === 'nation' ? 1.4 : 0.6);
        const rr = A.place === 'nation' ? 26 : 19;
        pt = [pt[0] + Math.cos(ang) * rr, pt[1] + Math.sin(ang) * rr];
      }
      const col = openInc.has(p.id) ? '#d03b3b' : PHCOL[p.phase] || '#999';
      const r = U.clamp(8 + zl * 0.6, 9, 12);
      if (openInc.has(p.id)) {
        const ph = (time * 1.4) % 1;
        ctx.beginPath(); ctx.arc(pt[0], pt[1], r + 3 + ph * 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(208,59,59,' + (0.9 * (1 - ph)).toFixed(2) + ')'; ctx.lineWidth = 2.4; ctx.stroke();
      }
      ctx.globalAlpha = p.phase === 'stillgelegt' || p.phase === 'aufgegeben' || p.phase === 'abgelehnt' ? 0.45 : 1;
      badge(pt[0], pt[1], A.icon, col, r, sel && sel.type === 'proj' && sel.id === p.id ? 3.2 : 2);
      if (p.phase === 'bau' || p.phase === 'laufend') {
        ctx.beginPath(); ctx.arc(pt[0], pt[1], r + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.prog);
        ctx.strokeStyle = '#e3c47a'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      hits.push({ x: pt[0], y: pt[1], r: r + 3, type: 'proj', id: p.id, pri: 2 });
    }
  }

  /* ---------- Platzierungsmodus ---------- */
  M.place = function (o) {
    M.placing = Object.assign({ first: -1, a: null, drag: null, mouse: null }, o);
    cv.classList.add('placing');
    dirty = true;
    KY.bus.emit('place', M.placing);
  };
  M.cancelPlace = function () { M.placing = null; cv.classList.remove('placing'); dirty = true; KY.bus.emit('place', null); };
  function drawPlacing() {
    const pl = M.placing;
    if (!pl) return;
    ctx.save();
    if (pl.kind === 'line' && pl.first >= 0 && pl.mouse) {
      const a = W.cities[pl.first];
      const pa = llScreen(a.lon, a.lat);
      ctx.strokeStyle = pl.valid === false ? '#ef6b5f' : '#e3c47a';
      ctx.setLineDash([8, 6]); ctx.lineDashOffset = -time * 20; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pl.mouse[0], pl.mouse[1]); ctx.stroke();
      ctx.setLineDash([]);
      if (pl.km) {
        ctx.font = '600 12px Inter, sans-serif';
        const t = U.n(pl.km) + ' km';
        const mx = (pa[0] + pl.mouse[0]) / 2, my = (pa[1] + pl.mouse[1]) / 2 - 12;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,0.9)'; ctx.strokeText(t, mx, my);
        ctx.fillStyle = '#f4ecda'; ctx.fillText(t, mx, my);
      }
    }
    if (pl.kind === 'point' && pl.mouse && !pl.sb) {
      const ok = pl.valid !== false;
      ctx.beginPath(); ctx.arc(pl.mouse[0], pl.mouse[1], 14, 0, Math.PI * 2);
      ctx.strokeStyle = ok ? '#4fc46a' : '#ef6b5f'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(pl.mouse[0], pl.mouse[1], 3, 0, Math.PI * 2); ctx.fillStyle = ok ? '#4fc46a' : '#ef6b5f'; ctx.fill();
    }
    if (pl.kind === 'area' && pl.drag) {
      const [x0, y0, x1, y1] = pl.drag;
      ctx.fillStyle = 'rgba(227,196,122,0.12)'; ctx.strokeStyle = pl.valid === false ? '#ef6b5f' : '#e3c47a';
      ctx.setLineDash([6, 4]); ctx.lineWidth = 1.8;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      if (pl.areaTxt) {
        ctx.setLineDash([]); ctx.font = '600 12px Inter, sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,0.9)'; ctx.strokeText(pl.areaTxt, Math.min(x0, x1) + 6, Math.min(y0, y1) - 8);
        ctx.fillStyle = '#f4ecda'; ctx.fillText(pl.areaTxt, Math.min(x0, x1) + 6, Math.min(y0, y1) - 8);
      }
    }
    ctx.restore();
  }

  /* ---------- Treffer ---------- */
  function hitTest(x, y) {
    let best = null, bd = Infinity;
    for (const h of hits) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= h.r) { const s = d - (h.pri || 0) * 3; if (s < bd) { bd = s; best = h; } }
    }
    if (best) return best;
    const ll = M.toLonLat(x, y);
    const nid = KY.geo.nationAt(ll.lon, ll.lat);
    if (nid >= 0) return { type: 'nation', id: nid, lon: ll.lon, lat: ll.lat };
    return { type: 'sea', lon: ll.lon, lat: ll.lat };
  }
  M.select = function (s) { sel = s; dirty = true; };

  /* ---------- Eingabe ---------- */
  function bindInput() {
    const ptrs = new Map();
    let down = null, pinch = null;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
      anim = null;
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
        down = null; return;
      }
      down = { x: e.offsetX, y: e.offsetY, moved: false, area: M.placing && M.placing.kind === 'area' };
      if (down.area) M.placing.drag = [e.offsetX, e.offsetY, e.offsetX, e.offsetY];
    });
    cv.addEventListener('pointermove', e => {
      const x = e.offsetX, y = e.offsetY;
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [x, y]);
      if (pinch && ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        M.panBy(pinch.x - mx, pinch.y - my);
        M.zoomBy(d / pinch.d, mx, my);
        pinch = { d, x: mx, y: my };
        return;
      }
      if (down) {
        if (down.area) {
          M.placing.drag[2] = x; M.placing.drag[3] = y;
          if (M.placing.onArea) M.placing.onArea(M.placing.drag, false);
          dirty = true; return;
        }
        const dx = x - down.x, dy = y - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5) { down.moved = true; cv.classList.add('dragging'); hideTip(); }
        if (down.moved) { M.panBy(-(x - (down.lx || down.x)), -(y - (down.ly || down.y))); down.lx = x; down.ly = y; }
        return;
      }
      onHover(x, y);
    });
    const up = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      cv.classList.remove('dragging');
      if (!down) return;
      const d = down; down = null;
      if (d.area && M.placing) {
        const dr = M.placing.drag;
        if (dr && Math.hypot(dr[2] - dr[0], dr[3] - dr[1]) > 10 && M.placing.onArea) M.placing.onArea(dr, true);
        else if (M.placing) M.placing.drag = null;
        dirty = true; return;
      }
      if (!d.moved) onClick(e.offsetX, e.offsetY);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (!down) hideTip(); });
    cv.addEventListener('dblclick', e => { if (!M.placing) M.zoomBy(2, e.offsetX, e.offsetY); });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      anim = null;
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? SH : 1;
      if (e.ctrlKey) M.zoomBy(Math.exp(-e.deltaY * k * 0.012), e.offsetX, e.offsetY);
      else M.panBy(e.deltaX * k, e.deltaY * k);
      hideTip();
    }, { passive: false });
    // Safari: Pinch-Geste auf dem Trackpad
    let gs = 1, gp = null;
    cv.addEventListener('gesturestart', e => { e.preventDefault(); gs = 1; const r = cv.getBoundingClientRect(); gp = [e.clientX - r.left, e.clientY - r.top]; });
    cv.addEventListener('gesturechange', e => { e.preventDefault(); const f = e.scale / gs; gs = e.scale; M.zoomBy(f, gp ? gp[0] : SW / 2, gp ? gp[1] : SH / 2); });
    cv.addEventListener('gestureend', e => { e.preventDefault(); });
    document.addEventListener('gesturestart', e => e.preventDefault());
  }

  function onHover(x, y) {
    const pl = M.placing;
    if (pl) {
      pl.mouse = [x, y];
      if (pl.onMove) pl.onMove(x, y);
      if (pl.kind === 'nation' || pl.kind === 'two') { const ll = M.toLonLat(x, y); const nid = KY.geo.nationAt(ll.lon, ll.lat); if (nid !== hoverNation) { hoverNation = nid; } }
      dirty = true;
    }
    const h = hitTest(x, y);
    hover = h;
    showTip(h, x, y);
  }
  function onClick(x, y) {
    const h = hitTest(x, y);
    const pl = M.placing;
    if (pl) { if (pl.onClick) pl.onClick(h, x, y); dirty = true; return; }
    hideTip();
    if (h.type === 'city') KY.ui.inspect('city', h.id);
    else if (h.type === 'proj') KY.ui.inspect('proj', h.id);
    else if (h.type === 'ev') KY.ui.inspect('ev', h.id);
    else if (h.type === 'nation') KY.ui.inspect('nation', h.id);
    else if (h.type === 'rel') KY.ui.inspect('nation', h.a);
    else if (h.type === 'sat') KY.ui.panel('orbit', { keep: true });
    else KY.ui.closeInsp();
  }

  const tipEl = () => U.$('#tip');
  function hideTip() { const t = tipEl(); if (t) t.style.display = 'none'; }
  function showTip(h, x, y) {
    const t = tipEl();
    if (!t) return;
    const S = SIM.S;
    let html = '';
    const row = (k, v) => `<div class="r"><span>${k}</span><b>${v}</b></div>`;
    if (h.type === 'city') {
      const c = W.cities[h.id], sc = S.cities[h.id];
      html = `<div class="h">${KY.icon('pin', 14)}${U.esc(c.name)}${c.capital ? ' <span class="chip ghost" style="height:18px">Hauptstadt</span>' : ''}</div>` + row('Staat', U.esc(W.nations[c.nation].short)) + row('Einwohner', U.people(sc.pop)) + row('Wohlstand', Math.round(sc.prosperity)) + row('Stimmung zu Ihnen', U.sgn(sc.sent, 0)) + (sc.protest ? row('Protest', KY.nations.PROTEST_STAGES[sc.protest.stage]) : '');
    } else if (h.type === 'proj') {
      const p = KY.projects.byId(h.id);
      html = `<div class="h">${KY.icon(D.ACT[p.act].icon, 14)}${U.esc(p.name)}</div>` + row('Status', KY.projects.PHASES[p.phase]) + (p.phase === 'bau' || p.phase === 'laufend' ? row('Fortschritt', U.pct(p.prog * 100, 0)) : '') + row('Träger', U.esc(KY.projects.frontName(p)));
    } else if (h.type === 'ev') {
      const ev = KY.events.byId(h.id);
      html = `<div class="h">${KY.icon(D.EVENTS[ev.type].icon, 14)}${U.esc(ev.name)}</div>` + row('Stufe', ev.sev + ' von 5') + row('Todesopfer', U.n(ev.deadNow)) + (ev.displaced ? row('Obdachlos', U.count(ev.displaced)) : '') + row('Lage', ev.phase === 'vorbei' ? 'vorüber' : 'akut');
    } else if (h.type === 'nation') {
      const n = S.nations[h.id], w = W.nations[h.id];
      html = `<div class="h">${KY.flag(w, 18)}${U.esc(w.short)}</div>` + row('Einwohner', U.people(n.pop)) + row('Regierung', U.esc(n.gov.leader)) + row('Haltung zu Ihnen', n.aware < 5 ? 'unbekannt' : U.sgn(n.op, 0)) + row('Zufriedenheit', Math.round(n.happy)) + row('Ihr Zugang', Math.round(n.access));
      if (M.placing && M.placing.kind === 'two' && M.placing.first >= 0 && M.placing.first !== h.id) { const R = SIM.rel(M.placing.first, h.id); html += row('Beziehung', SIM.REL_NAMES[R.state] + ' (' + Math.round(R.v) + ')'); }
    } else if (h.type === 'sat') {
      const sat = (S.orbit ? S.orbit.sats : []).find(x => x.id === h.id);
      if (!sat) { hideTip(); return; }
      const T = D.SATS[sat.type];
      html = `<div class="h">${KY.icon(T.icon, 14)}${U.esc(sat.name)}</div>` + row('Typ', T.n) + row('Bahnneigung', Math.round(sat.inc) + '°') + row('Gestartet', U.dateStr(sat.born, true)) + row('Restlaufzeit', U.days(sat.until - S.day));
    } else if (h.type === 'rel') {
      const R = SIM.rel(h.a, h.b);
      html = `<div class="h">${KY.icon('alert', 14)}${U.esc(W.nations[h.a].short)} – ${U.esc(W.nations[h.b].short)}</div>` + row('Beziehung', SIM.REL_NAMES[R.state]) + row('Wert', Math.round(R.v));
    } else { hideTip(); return; }
    if (M.placing && M.placing.tipExtra) html += M.placing.tipExtra(h);
    t.innerHTML = html;
    t.style.display = 'block';
    const tw = t.offsetWidth, th = t.offsetHeight;
    let tx = x + 16, ty = y + 16;
    if (tx + tw > SW - 10) tx = x - tw - 16;
    if (ty + th > SH - 40) ty = y - th - 16;
    t.style.left = tx + 'px'; t.style.top = ty + 'px';
  }

  /* Kartenausschnitt für das Fernsehbild */
  M.snapshot = function (lon, lat, w, h, zoomUnits, target) {
    const c = target || document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const z = w / zoomUnits;
    let cx = lonX(lon), cy = latY(lat);
    g.fillStyle = '#0d1d31'; g.fillRect(0, 0, w, h);
    g.imageSmoothingEnabled = true;
    for (const off of [-WW, 0, WW]) {
      g.setTransform(z, 0, 0, z, (off - cx) * z + w / 2, -cy * z + h / 2);
      if (tex) g.drawImage(tex, 0, 0, WW, WH);
      if (borderPath) { g.strokeStyle = 'rgba(255,240,210,0.4)'; g.lineWidth = 1.2 / z; g.stroke(borderPath); }
      riverPaths.forEach((rp, i) => { g.strokeStyle = 'rgba(96,150,196,0.8)'; g.lineWidth = (0.8 + i * 0.6) / z; g.stroke(rp); });
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  };
})();
