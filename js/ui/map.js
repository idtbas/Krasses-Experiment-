/* KYTHERA · Kartenrenderer (Punktraster, Ebenen, Auswahl) */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;

  const OVL = {
    lage: { n: 'Lage', kind: 'status' },
    stab: { n: 'Stabilität', kind: 'seq' },
    wohl: { n: 'Wohlstand', kind: 'seq' },
    vert: { n: 'Kooperation', kind: 'seq' },
    praes: { n: 'Präsenz', kind: 'acc' },
    ener: { n: 'Energie', kind: 'seq' },
    infra: { n: 'Infrastruktur', kind: 'seq' },
    span: { n: 'Spannungen', kind: 'seqr' },
  };
  KY.MAP_OVL = OVL;
  // sequentielle Rampe (blau, dunkel → hell) und Akzentrampe
  const SEQ = [[13, 54, 107], [24, 79, 149], [42, 120, 214], [85, 152, 231], [134, 182, 239], [183, 211, 246]];
  const ACC = [[46, 38, 22], [90, 72, 38], [138, 113, 64], [201, 165, 92], [236, 208, 150]];
  const RED = [[40, 22, 22], [92, 34, 32], [150, 48, 44], [214, 72, 66], [246, 140, 120]];
  const STAT = { ok: [47, 179, 68], warn: [250, 178, 25], ser: [236, 131, 90], crit: [224, 72, 72] };
  function ramp(r, t) {
    t = U.clamp(t, 0, 1) * (r.length - 1);
    const i = Math.min(r.length - 2, Math.floor(t)), f = t - i;
    return [0, 1, 2].map(k => Math.round(r[i][k] + (r[i + 1][k] - r[i][k]) * f));
  }
  function regionColor(rid, ov) {
    const S = KY.S;
    if (!rid || !S.regions[rid]) return null;
    const m = S.regions[rid].m;
    const o = OVL[ov];
    if (o.kind === 'status') {
      const st = KY.wsim.status(rid).c;
      const c = STAT[st];
      const k = st === 'ok' ? 0.32 + (m.stab - 50) / 100 * 0.5 : 0.7;
      return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
    }
    if (o.kind === 'acc') return ramp(ACC, m[ov] / 100);
    if (o.kind === 'seqr') return ramp(RED, m[ov] / 80);
    return ramp(SEQ, (m[ov] - 15) / 80);
  }

  KY.Map = function (host, opt) {
    opt = opt || {};
    const self = this;
    const W0 = KY.world.build();
    this.opt = opt;
    this.ov = opt.overlay || 'lage';
    this.sel = opt.select || null;
    this.hover = null;
    this.z = 1; this.cLon = opt.center ? opt.center[0] : 0; this.cLat = opt.center ? opt.center[1] : 2;
    this.flashes = [];
    this.alive = true;
    const wrap = document.createElement('div');
    wrap.className = 'map-wrap';
    wrap.style.height = (opt.height || 420) + 'px';
    wrap.innerHTML = '<canvas></canvas>' +
      (opt.tools === false ? '' : '<div class="map-tools"><div class="seg" role="group" aria-label="Kartenebene">' + Object.keys(OVL).map(k => '<button data-ov="' + k + '"' + (k === this.ov ? ' class="on"' : '') + '>' + OVL[k].n + '</button>').join('') + '</div></div>') +
      (opt.zoom === false ? '' : '<div class="map-zoom"><button data-z="1" aria-label="Vergrößern">+</button><button data-z="-1" aria-label="Verkleinern">−</button><button data-z="0" aria-label="Ansicht zurücksetzen">⌂</button></div>') +
      (opt.legend === false ? '' : '<div class="map-legend"></div>') +
      '<div class="map-hover" style="display:none"></div>';
    host.appendChild(wrap);
    this.wrap = wrap;
    this.cv = wrap.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.base = document.createElement('canvas');
    this.hoverEl = wrap.querySelector('.map-hover');
    this.legendEl = wrap.querySelector('.map-legend');
    this.dirty = true;

    // Grenzzellen vorberechnen
    if (!KY.Map.border) {
      const b = new Uint8Array(W0.W * W0.H);
      for (let j = 0; j < W0.H; j++) for (let i = 0; i < W0.W; i++) {
        const idx = j * W0.W + i;
        if (!W0.land[idx]) continue;
        const r = W0.region[idx];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of nb) {
          const ii = (i + dx + W0.W) % W0.W, jj = j + dy;
          if (jj < 0 || jj >= W0.H) continue;
          const k = jj * W0.W + ii;
          if (W0.land[k] && W0.region[k] !== r) { b[idx] = 1; break; }
        }
      }
      KY.Map.border = b;
    }

    if (opt.tools !== false) U.on(wrap, 'click', '[data-ov]', (e, b) => { self.setOverlay(b.dataset.ov); });
    if (opt.zoom !== false) U.on(wrap, 'click', '[data-z]', (e, b) => {
      const d = +b.dataset.z;
      if (d === 0) { self.z = 1; self.cLon = 0; self.cLat = 2; } else self.zoomAt(d > 0 ? 1.5 : 1 / 1.5);
      self.dirty = true;
    });

    // Interaktion
    let drag = null;
    const toGeo = (cx, cy) => {
      const r = self.cv.getBoundingClientRect();
      const x = cx - r.left, y = cy - r.top;
      return [self.cLon + (x - r.width / 2) / self.scale, self.cLat - (y - r.height / 2) / self.scale, x, y];
    };
    this.cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lon: self.cLon, lat: self.cLat, moved: false }; this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved && self.z > 1.01) { self.cLon = drag.lon - dx / self.scale; self.cLat = drag.lat + dy / self.scale; self.clampView(); self.dirty = true; }
      }
      const [lon, lat, x, y] = toGeo(e.clientX, e.clientY);
      const rid = KY.world.regionAt(lon, lat);
      const valid = rid && KY.data.regions[rid] ? rid : rid === 'KYT' ? 'KYT' : null;
      if (valid !== self.hover) { self.hover = valid; self.dirty = true; }
      self.showHover(valid, x, y, lon, lat);
    });
    this.cv.addEventListener('pointerup', e => {
      if (drag && !drag.moved) {
        const [lon, lat] = toGeo(e.clientX, e.clientY);
        const rid = KY.world.regionAt(lon, lat);
        if (rid === 'KYT') { if (opt.onPoi) opt.onPoi('KYT'); }
        else if (rid && KY.data.regions[rid]) { self.select(rid); if (opt.onSelect) opt.onSelect(rid); }
        if (opt.onClickGeo) opt.onClickGeo(lat, lon);
      }
      drag = null;
    });
    this.cv.addEventListener('pointerleave', () => { self.hover = null; self.hoverEl.style.display = 'none'; self.dirty = true; });
    if (opt.zoom !== false) {
      this.cv.addEventListener('wheel', e => {
        e.preventDefault();
        const [lon, lat] = toGeo(e.clientX, e.clientY);
        const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        self.zoomAt(f, lon, lat);
      }, { passive: false });
      this.cv.addEventListener('dblclick', e => { const [lon, lat] = toGeo(e.clientX, e.clientY); self.zoomAt(1.8, lon, lat); });
    }

    this.ro = new ResizeObserver(() => { self.resize(); });
    this.ro.observe(wrap);
    this.unsubs = [
      KY.bus.on('event', ev => { self.flashes.push({ rid: ev.rid, t: performance.now(), sev: ev.sev, good: ev.e.good }); }),
      KY.bus.on('regions', () => { self.dirty = true; }),
      KY.bus.on('tick', () => { self.dirty = true; }),
    ];
    this.resize();
    this.legend();
    const loop = () => {
      if (!self.alive) return;
      if (!document.hidden && wrap.isConnected) self.draw();
      self.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };
  const MP = KY.Map.prototype;
  MP.destroy = function () { this.alive = false; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.unsubs.forEach(f => f()); };
  MP.setOverlay = function (k) {
    this.ov = k; this.dirty = true;
    U.$$('[data-ov]', this.wrap).forEach(b => b.classList.toggle('on', b.dataset.ov === k));
    this.legend();
  };
  MP.select = function (rid) { this.sel = rid; this.dirty = true; };
  MP.zoomAt = function (f, lon, lat) {
    const nz = U.clamp(this.z * f, 1, 7);
    if (lon !== undefined) {
      const k = 1 - this.z / nz;
      this.cLon += (lon - this.cLon) * k; this.cLat += (lat - this.cLat) * k;
    }
    this.z = nz; this.clampView(); this.dirty = true;
  };
  MP.focus = function (lon, lat, z) { this.cLon = lon; this.cLat = lat; this.z = z || 2.5; this.clampView(); this.dirty = true; };
  MP.clampView = function () {
    const r = this.cv.getBoundingClientRect();
    this.scale = (r.width / 360) * this.z;
    const halfW = r.width / 2 / this.scale, halfH = r.height / 2 / this.scale;
    this.cLon = U.clamp(this.cLon, -180 + halfW, 180 - halfW);
    if (halfH * 2 >= 160) this.cLat = 0; else this.cLat = U.clamp(this.cLat, -80 + halfH, 80 - halfH);
  };
  MP.resize = function () {
    const r = this.wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.cv.width = this.w * dpr; this.cv.height = this.h * dpr;
    this.base.width = this.cv.width; this.base.height = this.cv.height;
    this.clampView();
    this.dirty = true;
  };
  MP.proj = function (lon, lat) {
    return [this.w / 2 + (lon - this.cLon) * this.scale, this.h / 2 - (lat - this.cLat) * this.scale];
  };
  MP.legend = function () {
    if (!this.legendEl) return;
    const o = OVL[this.ov];
    if (o.kind === 'status') {
      this.legendEl.innerHTML = '<div class="lbl" style="margin-bottom:5px">Ebene: Lage</div>' +
        [['ok', 'Stabil'], ['warn', 'Angespannt'], ['crit', 'Kritisch']].map(([c, t]) => '<div class="row" style="gap:6px"><i style="width:9px;height:9px;background:var(--' + c + ')"></i>' + t + '</div>').join('');
    } else {
      const r = o.kind === 'acc' ? ACC : o.kind === 'seqr' ? RED : SEQ;
      const g = 'linear-gradient(90deg,' + r.map(c => 'rgb(' + c.join(',') + ')').join(',') + ')';
      this.legendEl.innerHTML = '<div class="lbl">Ebene: ' + o.n + '</div><div class="grad" style="background:' + g + '"></div><div class="row" style="justify-content:space-between"><span>niedrig</span><span>hoch</span></div>';
    }
  };
  MP.showHover = function (rid, x, y, lon, lat) {
    const el = this.hoverEl;
    if (!rid || this.opt.hover === false) { el.style.display = 'none'; return; }
    if (rid === 'KYT') {
      el.innerHTML = '<div class="n">Kythera</div><div class="mut small">Sperrgebiet · ' + U.n(lat, 2) + '° N, ' + U.n(lon, 2) + '° O</div>';
    } else {
      const S = KY.S, R = KY.data.regions[rid], m = S.regions[rid].m, st = KY.wsim.status(rid);
      const ov = this.ov === 'lage' ? 'stab' : this.ov;
      el.innerHTML = '<div class="n">' + U.esc(R.name) + '</div>' + KY.C.pill(st.t, st.c) +
        '<div class="kv mt8"><dt>' + KY.data.metricInfo[ov].name + '</dt><dd class="mono">' + U.n(m[ov], 1) + '</dd><dt>Präsenz</dt><dd class="mono">' + U.n(m.praes, 1) + '</dd><dt>Hauptstadt</dt><dd>' + U.esc(R.cap) + '</dd></div>';
    }
    el.style.display = '';
    const bw = el.offsetWidth, bh = el.offsetHeight;
    el.style.left = (x + 16 + bw > this.w ? x - bw - 12 : x + 16) + 'px';
    el.style.top = U.clamp(y - 10, 4, this.h - bh - 4) + 'px';
  };

  MP.drawBase = function () {
    const W0 = KY.world.build(), ctx = this.base.getContext('2d'), dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // Gradnetz
    ctx.strokeStyle = 'rgba(120,140,160,0.07)'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(140,150,160,0.35)'; ctx.font = '9px "IBM Plex Mono", monospace';
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = this.proj(lon, 0);
      ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, this.h); ctx.stroke();
      if (!this.opt.mini && x > 4 && x < this.w - 30) ctx.fillText(Math.abs(lon) + '°' + (lon < 0 ? 'W' : lon > 0 ? 'O' : ''), x + 3, this.h - 6);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const [, y] = this.proj(0, lat);
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(this.w, y + .5); ctx.stroke();
      if (!this.opt.mini && y > 10 && y < this.h - 14) ctx.fillText(Math.abs(lat) + '°' + (lat < 0 ? 'S' : lat > 0 ? 'N' : ''), 4, y - 3);
    }
    const s = this.scale;
    const size = Math.max(1.1, s * (s > 9 ? 0.78 : 0.56));
    const cache = {};
    for (let j = 0; j < W0.H; j++) {
      const lat = W0.LAT0 - j - 0.5;
      const y = this.h / 2 - (lat - this.cLat) * s;
      if (y < -s || y > this.h + s) continue;
      for (let i = 0; i < W0.W; i++) {
        const idx = j * W0.W + i;
        if (!W0.land[idx]) continue;
        const lon = -180 + i + 0.5;
        const x = this.w / 2 + (lon - this.cLon) * s;
        if (x < -s || x > this.w + s) continue;
        const rid = W0.region[idx];
        let c;
        if (rid === 'KYT') c = [236, 208, 150];
        else if (!rid) c = [52, 58, 64];
        else {
          c = cache[rid] || (cache[rid] = regionColor(rid, this.ov));
          if (KY.Map.border[idx]) c = [Math.min(255, c[0] + 40), Math.min(255, c[1] + 40), Math.min(255, c[2] + 40)];
          if (this.sel && rid === this.sel) c = [Math.min(255, c[0] * 0.5 + 236 * 0.5), Math.min(255, c[1] * 0.5 + 208 * 0.5), Math.min(255, c[2] * 0.5 + 150 * 0.5)];
          else if (this.hover && rid === this.hover) c = [Math.min(255, c[0] + 34), Math.min(255, c[1] + 34), Math.min(255, c[2] + 34)];
          else if (this.sel) c = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72];
        }
        ctx.fillStyle = 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  };

  MP.draw = function () {
    const S = KY.S, D = KY.data, now = performance.now();
    if (this.dirty) { this.drawBase(); this.dirty = false; }
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = this.opt.layers || {};
    const pulse = (Math.sin(now / 420) + 1) / 2;
    const mini = this.opt.mini;
    // Routen und Schiffe
    if (L.ships) {
      ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(143,188,208,0.22)'; ctx.lineWidth = 1;
      for (const k in D.routes) {
        const pts = D.routes[k];
        ctx.beginPath();
        pts.forEach((p, i) => { const [x, y] = this.proj(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const sh of S.infra.ships) {
        const [lon, lat] = KY.Map.shipPos(sh.id, S.t + (now % 1000) / 1000);
        const [x, y] = this.proj(lon, lat);
        ctx.fillStyle = sh.task ? '#ecd096' : '#8fbcd0';
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3.5, y + 3); ctx.lineTo(x - 3.5, y + 3); ctx.closePath(); ctx.fill();
        if (!mini && this.z > 1.2) { ctx.fillStyle = 'rgba(200,210,220,0.7)'; ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillText(sh.id, x + 6, y + 3); }
        if (sh.task && S.regions[sh.task.rid]) {
          const [tx, ty] = this.proj.apply(this, D.regions[sh.task.rid].capPos);
          ctx.strokeStyle = 'rgba(236,208,150,0.35)'; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    // Satelliten
    if (L.sats) {
      for (const st of S.infra.sats) {
        const t = S.t + (now % 1000) / 1000;
        ctx.strokeStyle = 'rgba(201,165,92,0.13)'; ctx.lineWidth = 1;
        ctx.beginPath();
        let prevX = null;
        for (let k = -40; k <= 0; k++) {
          const [lon, lat] = KY.infra.satPos(st.id, t + k * 1.2);
          const [x, y] = this.proj(lon, lat);
          if (prevX === null || Math.abs(x - prevX) > this.w / 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          prevX = x;
        }
        ctx.stroke();
        const [lon, lat] = KY.infra.satPos(st.id, t);
        const [x, y] = this.proj(lon, lat);
        ctx.fillStyle = '#ecd096';
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        ctx.strokeStyle = 'rgba(236,208,150,' + (0.25 + pulse * 0.3) + ')';
        ctx.beginPath(); ctx.arc(x, y, 7 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
        if (!mini) { ctx.fillStyle = 'rgba(236,208,150,0.75)'; ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillText(st.id, x + 8, y - 6); }
        if (st.focus && L.cover !== false) {
          const [fx, fy] = this.proj.apply(this, D.regions[st.focus].labelPos);
          ctx.strokeStyle = 'rgba(201,165,92,0.10)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(fx, fy); ctx.stroke();
        }
      }
    }
    // Netzknoten
    if (L.nodes) {
      ctx.lineWidth = 1;
      for (const [a, b] of D.nodeLinks) {
        const na = D.nodes.find(n => n.id === a), nb = D.nodes.find(n => n.id === b);
        if (nb.hidden && !KY.flag('omegaTraced') && !S.story.ending) continue;
        const [x1, y1] = this.proj(na.pos[0], na.pos[1]), [x2, y2] = this.proj(nb.pos[0], nb.pos[1]);
        ctx.strokeStyle = 'rgba(201,165,92,0.22)';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 30, x2, y2); ctx.stroke();
      }
      for (const n of D.nodes) {
        if (n.hidden && !KY.flag('omegaTraced') && !S.story.ending) continue;
        const st = S.integ.nodes[n.id];
        const [x, y] = this.proj(n.pos[0], n.pos[1]);
        const open = S.integ.anomalies.some(a => a.state === 'offen' && a.node === n.id);
        ctx.fillStyle = !st.up ? '#50565c' : open ? '#e04848' : '#2fb344';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0c0f12'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
        if (open) { ctx.strokeStyle = 'rgba(224,72,72,' + (0.6 - pulse * 0.4) + ')'; ctx.beginPath(); ctx.arc(x, y, 8 + pulse * 6, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(220,220,210,0.8)'; ctx.font = '9.5px "IBM Plex Mono", monospace'; ctx.fillText(n.id, x + 7, y + 3);
      }
    }
    // Regionsbeschriftung
    if (L.labels !== false && !mini) {
      ctx.textAlign = 'center';
      for (const id of D.regionOrder) {
        const R = D.regions[id];
        const [x, y] = this.proj(R.labelPos[0], R.labelPos[1]);
        if (x < -40 || x > this.w + 40) continue;
        const on = id === this.sel || id === this.hover;
        ctx.font = '600 ' + (on ? 11 : 10) + 'px "IBM Plex Sans Condensed", sans-serif';
        const txt = R.name.toUpperCase().split('').join(String.fromCharCode(8202));
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,8,10,0.85)'; ctx.strokeText(txt, x, y);
        ctx.fillStyle = on ? '#ecd096' : 'rgba(226,221,209,0.78)';
        ctx.fillText(txt, x, y);
        if (this.z > 1.6) {
          const [cx, cy] = this.proj(R.capPos[0], R.capPos[1]);
          ctx.fillStyle = 'rgba(226,221,209,0.9)';
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
          ctx.font = '9.5px "IBM Plex Sans", sans-serif'; ctx.fillStyle = 'rgba(200,200,190,0.75)'; ctx.textAlign = 'left';
          ctx.fillText(R.cap, cx + 6, cy + 3); ctx.textAlign = 'center';
        }
      }
      ctx.textAlign = 'left';
    }
    // Orte
    if (L.pois) {
      for (const p of D.pois) {
        if (p.id === 'KYT' && !KY.flag('history') && S.user.clr < 4 && this.z < 2) continue;
        const [x, y] = this.proj(p.pos[0], p.pos[1]);
        ctx.strokeStyle = p.id === 'KYT' ? 'rgba(236,208,150,' + (0.5 + pulse * 0.5) + ')' : 'rgba(226,221,209,0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 3, y - 3, 6, 6);
        if (!mini && (this.z > 1.4 || p.id === 'ORSA' || p.id === 'KYT')) {
          ctx.font = '9.5px "IBM Plex Sans Condensed", sans-serif'; ctx.fillStyle = 'rgba(226,221,209,0.65)';
          ctx.fillText(p.name, x + 6, y - 4);
        }
      }
    }
    // Vorhaben
    if (L.projects) {
      for (const pr of S.projects.active) {
        const [x, y] = this.proj.apply(this, D.regions[pr.rid].capPos);
        const k = KY.proj.progress(pr);
        ctx.strokeStyle = 'rgba(201,165,92,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(201,165,92,' + (0.5 - pulse * 0.4) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 12 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
        if (pr.rid2) {
          const [x2, y2] = this.proj.apply(this, D.regions[pr.rid2].capPos);
          ctx.strokeStyle = 'rgba(201,165,92,0.5)'; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2, Math.min(y, y2) - 40, x2, y2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      ctx.lineWidth = 1;
    }
    // Krise
    if (S.crisis && S.crisis.rid) {
      const [x, y] = this.proj.apply(this, D.regions[S.crisis.rid].capPos);
      for (let i = 0; i < 3; i++) {
        const ph = ((now / 1400) + i / 3) % 1;
        ctx.strokeStyle = 'rgba(224,72,72,' + (1 - ph) * 0.8 + ')';
        ctx.beginPath(); ctx.arc(x, y, 6 + ph * 26, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Ereignisblitze
    this.flashes = this.flashes.filter(f => now - f.t < 2600);
    for (const f of this.flashes) {
      if (!D.regions[f.rid]) continue;
      const [x, y] = this.proj.apply(this, D.regions[f.rid].capPos);
      const k = (now - f.t) / 2600;
      ctx.strokeStyle = f.good ? 'rgba(47,179,68,' + (1 - k) + ')' : 'rgba(250,178,25,' + (1 - k) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 4 + k * 30 * (f.sev || 1) / 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineWidth = 1;
    // Rahmen
    ctx.strokeStyle = 'rgba(201,165,92,0.35)';
    const cs = 10;
    [[0, 0, 1, 1], [this.w, 0, -1, 1], [0, this.h, 1, -1], [this.w, this.h, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(x + sx * 0.5, y + sy * cs); ctx.lineTo(x + sx * 0.5, y + sy * 0.5); ctx.lineTo(x + sx * cs, y + sy * 0.5); ctx.stroke();
    });
  };

  // Schiffsposition auf Route (Echtzeit-Takt)
  KY.Map.shipPos = function (id, t) {
    const def = KY.data.ships.find(s => s.id === id);
    const pts = KY.data.routes[def.route];
    let len = 0;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segs.push(d); len += d;
    }
    let pos = ((t * def.speed * 40) % len + len) % len;
    for (let i = 0; i < segs.length; i++) {
      if (pos <= segs[i]) {
        const f = pos / segs[i];
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
      }
      pos -= segs[i];
    }
    return pts[0];
  };
})();
