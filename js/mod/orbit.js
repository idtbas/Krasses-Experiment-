/* KYTHERA · Modul Flotte & Orbit */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.orbit = {
    mount(el, arg) {
      this.el = el;
      this.n = 0;
      this.tab = 'sat';
      this.img = null;
      el.innerHTML = KY.ui.head({ crumb: 'Steuerung', code: 'OR-06', title: 'Flotte & Orbit', sub: 'ARGO-Satelliten, die Schiffe der Stiftung Serrano und die Rechenzentren, auf denen PYTHIA läuft.' }) +
        '<section class="pn tick"><div class="pn-b flush" id="orMap"></div></section>' +
        '<div class="tabs mt12" id="orTabs"></div><div id="orBody"></div>';
      this.map = new KY.Map(el.querySelector('#orMap'), { height: 300, overlay: 'praes', tools: false, zoom: true, layers: { sats: true, ships: true, pois: true, projects: false } });
      U.on(el, 'click', '[data-tab]', (e, b) => this.setTab(b.dataset.tab));
      this.subs = ['infra', 'res', 'clearance', 'research'].map(ev => KY.bus.on(ev, () => { this.dirty = true; }));
      this.arg(arg);
    },
    arg(a) {
      if (a && a.img) { this.pre = a.img; this.setTab('img'); return; }
      if (typeof a === 'string' && a.indexOf('IMG-') === 0) { this.img = a; this.setTab('img'); return; }
      this.setTab(this.tab);
    },
    unmount() { this.map.destroy(); this.subs.forEach(f => f()); },
    setTab(t) {
      this.tab = t;
      const S = KY.S;
      U.setHTML(this.el.querySelector('#orTabs'), [['sat', 'Satelliten', S.infra.sats.length], ['ship', 'Flotte', S.infra.ships.length], ['dc', 'Rechenzentren', S.infra.dcs.length], ['img', 'Bildaufklärung', S.infra.imgs.length]].map(([k, n, c]) => '<button data-tab="' + k + '"' + (k === t ? ' class="on"' : '') + '>' + n + '<span class="n">' + c + '</span></button>').join(''));
      const old = this.el.querySelector('#orBody'), b = old.cloneNode(false);
      old.replaceWith(b);
      this.body = b;
      this['r_' + t](true);
    },
    tick() {
      this.n++;
      if (this.tab === 'sat') this.r_sat(false);
      if (this.tab === 'ship' && this.n % 2 === 0) this.r_ship(false);
      if (this.tab === 'dc') this.r_dc(false);
      if (this.tab === 'img' && (this.dirty || KY.S.infra.imgs.some(i => i.status === 'pending'))) this.r_imgList();
      this.dirty = false;
    },

    r_sat(full) {
      const S = KY.S, D = KY.data, b = this.body;
      if (full) {
        b.innerHTML = '<div class="g g-main"><section class="pn"><div class="pn-h"><h3>ARGO-Konstellation</h3><div class="tools"><span class="meta" id="orCov"></span></div></div><div class="pn-b flush tbl-w" id="orSats"></div></section>' +
          '<aside class="pn"><div class="pn-h"><h3>Wirkung der Abdeckung</h3></div><div class="pn-b"><ul class="small fg2" style="margin:0;padding-left:16px;line-height:1.7"><li>+3 Punkte Erfolg für Vorhaben in abgedeckten Regionen</li><li>Mit Frühwarnsystem: +30 s Entscheidungszeit, −25 % Schaden bei Naturereignissen</li><li>Optische Satelliten führen Bildaufträge aus</li><li>Neuausrichtung kostet 4 EF Rechenzeit</li></ul>' +
          '<div class="lbl mt16">Abgedeckte Regionen</div><div class="row wrap mt8" id="orCovList" style="gap:4px"></div></div></aside></div>';
        U.on(b, 'change', '[data-focus]', (e, s) => {
          const r = KY.infra.retask(s.dataset.focus, s.value);
          if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); this.setTab('sat'); return; }
          KY.ui.flashMsg(s.dataset.focus + ' ausgerichtet: ' + (s.value ? D.regions[s.value].name : 'Bereitschaft'), 'ok');
          this.setTab('sat');
        });
      }
      const box = b.querySelector('#orSats');
      if (full || !box.querySelector('table')) {
        box.innerHTML = '<table class="tbl"><thead><tr><th>Kennung</th><th>Funktion</th><th class="num">Neigung</th><th class="num">Umlauf</th><th class="num">Position</th><th>Ausrichtung</th></tr></thead><tbody>' +
          S.infra.sats.map(s => {
            const def = KY.infra.satDef(s.id);
            return '<tr><td class="mono acc">' + s.id + '</td><td>' + def.fn + '</td><td class="num">' + def.inc + '°</td><td class="num">' + def.per + ' s</td><td class="num small" data-pos="' + s.id + '"></td><td><select class="inp" style="height:26px" data-focus="' + s.id + '"><option value="">Bereitschaft</option>' + D.regionOrder.map(id => '<option value="' + id + '"' + (s.focus === id ? ' selected' : '') + '>' + D.regions[id].name + '</option>').join('') + '</select></td></tr>';
          }).join('') + '</tbody></table>';
      }
      S.infra.sats.forEach(s => {
        const [lon, lat] = KY.infra.satPos(s.id, S.t);
        U.setText(box.querySelector('[data-pos="' + s.id + '"]'), U.n(Math.abs(lat), 1) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' + U.n(Math.abs(lon), 1) + '°' + (lon >= 0 ? 'O' : 'W'));
      });
      const cov = D.regionOrder.filter(id => KY.wsim.covered(id));
      U.setText(b.querySelector('#orCov'), cov.length + ' von 12 Regionen abgedeckt');
      U.setHTML(b.querySelector('#orCovList'), D.regionOrder.map(id => '<span class="tag' + (cov.indexOf(id) >= 0 ? ' acc' : '') + '">' + D.regions[id].name + '</span>').join(''));
    },

    r_ship(full) {
      const S = KY.S, D = KY.data, b = this.body;
      if (full) U.on(b, 'click', '[data-exp]', () => KY.ui.go('vorhaben', { plan: { type: 'EXP' } }));
      U.setHTML(b, '<div class="g g3">' + S.infra.ships.map(sh => {
        const def = D.ships.find(x => x.id === sh.id);
        const [lon, lat] = KY.Map.shipPos(sh.id, S.t);
        const pr = sh.task ? S.projects.active.find(p => p.id === sh.task.proj) : null;
        return '<section class="pn"><div class="pn-h"><h3>FS ' + sh.id + '</h3><div class="tools">' + (sh.task ? C.pill('im Einsatz', 'acc', true) : C.pill('verfügbar', 'ok')) + '</div></div><div class="pn-b"><dl class="kv"><dt>Klasse</dt><dd>' + def.cls + '</dd><dt>Besatzung</dt><dd>' + def.crew + '</dd><dt>Heimathafen</dt><dd>' + def.home + '</dd><dt>Fähigkeiten</dt><dd>' + def.cap + '</dd><dt>Position</dt><dd class="mono">' + U.n(Math.abs(lat), 2) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' + U.n(Math.abs(lon), 2) + '°' + (lon >= 0 ? 'O' : 'W') + '</dd>' +
          '<dt>Auftrag</dt><dd>' + (pr ? pr.code + ' · Expedition ' + D.regions[pr.rid].name : 'Patrouille') + '</dd></dl>' + (sh.task ? '' : '<button class="btn sm ghost mt12" data-exp="1">Expedition planen</button>') + '</div></section>';
      }).join('') + '</div>');
    },

    r_dc(full) {
      const S = KY.S, D = KY.data, I = KY.infra, b = this.body;
      if (full) {
        U.on(b, 'click', '[data-up]', (e, x) => { const r = I.upgrade(x.dataset.up); if (!r.ok) KY.ui.flashMsg(r.err, 'crit'); else KY.ui.flashMsg('Ausbau beauftragt', 'ok'); this.setTab('dc'); });
        U.on(b, 'change', '[data-oc]', (e, x) => { I.overclock(x.dataset.oc, x.checked); this.setTab('dc'); });
      }
      const comp = I.compute();
      const html = '<div class="g g4"><div class="kpi"><span class="lbl">Rechenleistung</span><span class="v">' + U.n(comp * 3, 1) + '<small>EF/min</small></span></div><div class="kpi"><span class="lbl">Kontingent</span><span class="v">' + U.n(S.res.rech) + '<small>/ ' + U.n(I.rechMax()) + ' EF</small></span>' + C.meter(S.res.rech, I.rechMax(), 'prog') + '</div><div class="kpi"><span class="lbl">Systemintegrität</span><span class="v">' + U.n(S.integ.level, 1) + '<small>%</small></span></div><div class="kpi"><span class="lbl">Unterhalt gesamt</span><span class="v">' + U.n(KY.market.upkeep(), 2) + '<small>Mrd ¤/min</small></span></div></div>' +
        '<div class="g g3 mt12">' + S.infra.dcs.map(dc => {
          const def = I.dcDef(dc.id);
          const upg = dc.up && dc.up.until > S.t;
          const load = U.clamp(62 + Math.sin(S.t / 9 + def.mw) * 14 + (dc.oc ? 18 : 0), 5, 99);
          const temp = 24 + load / 6 + (dc.oc ? 9 : 0);
          return '<section class="pn' + (def.core ? ' tick' : '') + '"><div class="pn-h"><h3>' + def.name + '</h3><div class="tools">' + (upg ? C.pill('Ausbau ' + U.dur(dc.up.until - S.t), 'warn', true) : def.core ? C.pill('PYTHIA-Kern', 'acc') : C.pill('Betrieb', 'ok')) + '</div></div><div class="pn-b">' +
            '<dl class="kv"><dt>Region</dt><dd>' + D.regions[def.r].name + '</dd><dt>Leistung</dt><dd class="mono">' + def.mw + ' MW</dd><dt>Ausbaustufe</dt><dd class="mono">' + dc.lvl + ' / 6</dd><dt>Kapazität</dt><dd class="mono">' + U.n(I.dcCap(dc) * 3, 1) + ' EF/min</dd><dt>Kühlmittel</dt><dd class="mono">' + U.n(temp, 1) + ' °C</dd></dl>' +
            '<div class="lbl mt12">Auslastung</div><div class="mt4">' + C.meter(load, 100, load > 90 ? 'ser' : 'prog') + '</div>' +
            '<div class="row mt12"><label class="chk small"><input type="checkbox" data-oc="' + dc.id + '"' + (dc.oc ? ' checked' : '') + '> Übertaktung</label><span class="sp"></span><button class="btn sm" data-up="' + dc.id + '"' + (upg || dc.lvl >= 6 ? ' disabled' : '') + ' data-tip="Ausbau um eine Stufe: +35 % Kapazität. Dauer 60 s, Kapazität währenddessen halbiert.">Ausbau · ' + U.money(I.upgradeCost(dc).kap, 1) + '</button></div></div></section>';
        }).join('') + '</div><p class="xs mut mt12">Übertaktung erhöht die Kapazität um 40 %, senkt die Systemintegrität und kann Überhitzungen auslösen.</p>';
      if (full || this.n % 3 === 0) U.setHTML(b, html);
    },

    /* ---------- Bildaufklärung ---------- */
    r_img(full) {
      const S = KY.S, D = KY.data, b = this.body;
      if (S.user.clr < 4) {
        b.innerHTML = '<section class="pn"><div class="pn-b"><div class="empty"><b>Freigabestufe 4 erforderlich</b>Die orbitale Bildaufklärung wird mit der Erweiterung Ihrer Freigabe durch das Plenum freigeschaltet.</div></div></section>';
        return;
      }
      const pre = this.pre || [D.regions.MER.capPos[1], D.regions.MER.capPos[0]];
      this.pre = null;
      const presets = D.regionOrder.map(id => ({ n: D.regions[id].cap, lat: D.regions[id].capPos[1], lon: D.regions[id].capPos[0] }))
        .concat(D.pois.filter(p => p.id !== 'KYT' || KY.flag('history') || S.user.clr >= 4).map(p => ({ n: p.name, lat: p.pos[1], lon: p.pos[0] })));
      b.innerHTML = '<div class="g g-side"><div class="col gap12"><section class="pn"><div class="pn-h"><h3>Neuer Bildauftrag</h3></div><div class="pn-b col">' +
        '<div class="g g2" style="gap:8px"><div class="fld"><label for="imLat">Breite (°N)</label><input class="inp mono" id="imLat" value="' + U.n(pre[0], 2).replace(',', '.') + '"></div><div class="fld"><label for="imLon">Länge (°O)</label><input class="inp mono" id="imLon" value="' + U.n(pre[1], 2).replace(',', '.') + '"></div></div>' +
        '<div class="fld"><label for="imPre">Vorlage</label><select class="inp" id="imPre"><option value="">— Ort wählen —</option>' + presets.map((p, i) => '<option value="' + i + '">' + U.esc(p.n) + '</option>').join('') + '</select></div>' +
        '<dl class="kv"><dt>Auflösung</dt><dd class="mono">' + (KY.hasRes('O1') ? '0,3 m/px' : '4,0 m/px <span class="mut">(Hochauflösende Optik nicht erforscht)</span>') + '</dd><dt>Kosten</dt><dd class="mono">15 EF</dd><dt>Dauer</dt><dd class="mono">18 s</dd></dl>' +
        '<button class="btn pri block" id="imGo">' + KY.I('sat') + 'Aufnahme anfordern</button></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Aufnahmen</h3></div><div class="pn-b flush" id="imList"></div></section></div>' +
        '<section class="pn tick"><div class="pn-h"><h3 id="imTitle">Bildanzeige</h3></div><div class="pn-b" id="imView"><div class="empty"><b>Keine Aufnahme gewählt</b>Fordern Sie eine Aufnahme an oder wählen Sie eine aus der Liste.</div></div></section></div>';
      b.querySelector('#imPre').onchange = e => { const p = presets[+e.target.value]; if (!p) return; b.querySelector('#imLat').value = p.lat.toFixed(2); b.querySelector('#imLon').value = p.lon.toFixed(2); };
      b.querySelector('#imGo').onclick = () => {
        const lat = parseFloat(b.querySelector('#imLat').value.replace(',', '.')), lon = parseFloat(b.querySelector('#imLon').value.replace(',', '.'));
        const r = KY.infra.requestImage(lat, lon);
        if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return; }
        KY.ui.flashMsg('Bildauftrag ' + r.img.id + ' an ' + r.img.sat + ' übermittelt', 'ok');
        this.img = r.img.id;
        this.r_imgList(); this.r_view();
      };
      U.on(b, 'click', '[data-img]', (e, x) => { this.img = x.dataset.img; this.r_imgList(); this.r_view(); });
      this.r_imgList();
      if (this.img) this.r_view();
    },
    r_imgList() {
      const S = KY.S, box = this.body && this.body.querySelector('#imList');
      if (!box) return;
      U.setHTML(box, S.infra.imgs.length ? S.infra.imgs.map(i => '<div class="li' + (i.id === this.img ? ' on' : '') + '" data-img="' + i.id + '"><div class="ic">' + KY.I('sat') + '</div><div class="body"><div class="t mono">' + i.id + '</div><div class="m">' + U.n(i.lat, 2) + ' / ' + U.n(i.lon, 2) + ' · ' + U.n(i.res, 1) + ' m/px · ' + (i.status === 'pending' ? 'Übertragung ' + U.dur(i.until - S.t) : 'verfügbar') + '</div></div></div>').join('') : '<div class="empty">Noch keine Aufnahmen.</div>');
      if (this.img) {
        const i = S.infra.imgs.find(x => x.id === this.img);
        if (i && i.status === 'done' && this.viewShown !== i.id) this.r_view();
        if (i && i.status === 'pending') this.r_view();
      }
    },
    r_view() {
      const S = KY.S, i = S.infra.imgs.find(x => x.id === this.img);
      const box = this.body && this.body.querySelector('#imView');
      if (!box || !i) return;
      U.setText(this.body.querySelector('#imTitle'), 'Bildanzeige · ' + i.id);
      if (i.status === 'pending') {
        this.viewShown = null;
        const k = 1 - (i.until - S.t) / 18;
        U.setHTML(box, '<div class="empty"><b>Übertragung von ' + i.sat + '</b><div class="mt12" style="max-width:320px;margin-inline:auto">' + C.meter(k * 100, 100, 'prog stripes') + '</div><div class="mono xs mt8">Downlink über Bodenstation Kap Orsa · ' + Math.round(k * 100) + ' %</div></div>');
        return;
      }
      this.viewShown = i.id;
      box.innerHTML = '<div class="sat-img"><canvas width="720" height="450"></canvas><div class="hud"><div class="row"><span>' + i.sat + ' · ' + i.id + '</span><span>KY-ORCON</span></div><div class="row"><span>' + U.n(i.lat, 4) + '° N · ' + U.n(i.lon, 4) + '° O</span><span>' + U.n(i.res, 1) + ' m/px · ' + U.stamp(Date.now() - (S.t - i.until) * 1000) + ' UTC</span></div></div><div class="cross"></div></div>' +
        '<p class="small fg2 mt12" id="imNote"></p>';
      const note = KY.mod.orbit.render(box.querySelector('canvas'), i);
      U.setText(box.querySelector('#imNote'), note);
    },

    /* Prozedurales Satellitenbild */
    render(cv, img) {
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const lowRes = img.res > 1;
      const f = lowRes ? 12 : 1;
      const w = Math.ceil(W / f), h = Math.ceil(H / f);
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const o = off.getContext('2d');
      const id = o.createImageData(w, h);
      const seed = U.hash(img.lat.toFixed(2) + ',' + img.lon.toFixed(2));
      const rnd = U.rng(seed);
      const kyt = KY.infra.isKythera(img.lat, img.lon);
      const fld = KY.world.field(img.lon, img.lat, true).h;
      const rid = KY.world.regionAt(img.lon, img.lat);
      const D = KY.data;
      let urban = 0;
      D.regionOrder.forEach(r => { const c = D.regions[r].capPos; const d = Math.hypot(c[0] - img.lon, c[1] - img.lat); if (d < 2.5) urban = Math.max(urban, 1 - d / 2.5); });
      const arid = ['TAR', 'PAM', 'YAR'].indexOf(rid) >= 0, cold = rid === 'KAL' || img.lat < -60, trop = ['SOL', 'ZAM', 'SUN'].indexOf(rid) >= 0;
      const landC = cold ? [196, 204, 208] : arid ? [176, 150, 104] : trop ? [52, 82, 46] : kyt ? [128, 118, 96] : [82, 92, 62];
      const base = kyt ? 0.05 : U.clamp(fld * 1.6, -0.9, 0.9);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const X = x * f, Y = y * f;
          let v = base + (KY.world.fbm(X / 170 + seed % 97, Y / 170, 11, 5) - 0.5) * 1.3;
          if (kyt) v += 0.45 - Math.hypot((X - W / 2) / 260, (Y - H / 2) / 170) * 0.9;
          const g = (KY.world.fbm(X / 18 + 3, Y / 18 + 7, 12, 3) - 0.5) * 30;
          const p = (y * w + x) * 4;
          let c;
          if (v < 0) {
            const dpt = U.clamp(-v * 2.4, 0, 1);
            c = [16 + (1 - dpt) * 26, 40 + (1 - dpt) * 46, 54 + (1 - dpt) * 40];
          } else {
            const sh = v < 0.05 ? 1.25 : 1;
            c = [landC[0] * sh + g, landC[1] * sh + g, landC[2] * sh + g * 0.8];
          }
          id.data[p] = c[0]; id.data[p + 1] = c[1]; id.data[p + 2] = c[2]; id.data[p + 3] = 255;
        }
      }
      o.putImageData(id, 0, 0);
      // Bebauung
      const sc = 1 / f;
      o.save(); o.scale(sc, sc);
      if (urban > 0.05 && !kyt) {
        o.strokeStyle = 'rgba(190,190,180,0.55)'; o.lineWidth = 3;
        for (let i = 0; i < 8; i++) { o.beginPath(); const yy = rnd() * H; o.moveTo(0, yy); o.lineTo(W, yy + (rnd() - 0.5) * 120); o.stroke(); }
        for (let i = 0; i < 7; i++) { o.beginPath(); const xx = rnd() * W; o.moveTo(xx, 0); o.lineTo(xx + (rnd() - 0.5) * 120, H); o.stroke(); }
        const n = Math.round(urban * 420);
        for (let i = 0; i < n; i++) {
          const bx = rnd() * W, by = rnd() * H, bw = 6 + rnd() * 22, bh = 6 + rnd() * 18;
          const gr = 120 + rnd() * 80;
          o.fillStyle = 'rgb(' + gr + ',' + gr + ',' + (gr - 8) + ')';
          o.fillRect(bx, by, bw, bh);
          o.fillStyle = 'rgba(0,0,0,0.35)'; o.fillRect(bx + bw, by + 2, 3, bh);
        }
      }
      if (kyt) {
        const cx = W / 2 + 18, cy = H / 2 - 6;
        o.fillStyle = 'rgba(0,0,0,0.4)'; o.beginPath(); o.ellipse(cx + 10, cy + 8, 22, 22, 0, 0, Math.PI * 2); o.fill();
        o.fillStyle = '#d8d2c2'; o.beginPath(); o.arc(cx, cy, 20, 0, Math.PI * 2); o.fill();
        o.strokeStyle = '#8c8574'; o.lineWidth = 2; o.beginPath(); o.arc(cx, cy, 20, 0, Math.PI * 2); o.stroke();
        o.fillStyle = '#4a463d'; o.beginPath(); o.arc(cx, cy, 7, 0, Math.PI * 2); o.fill();
        // Nebengebäude mit Flachdach
        o.fillStyle = 'rgba(0,0,0,0.4)'; o.fillRect(cx - 150 + 6, cy + 30 + 6, 120, 58);
        o.fillStyle = '#9b9584'; o.fillRect(cx - 150, cy + 30, 120, 58);
        o.save(); o.translate(cx - 90, cy + 59); o.rotate(-0.04);
        o.fillStyle = '#f4f1e8'; o.font = '700 30px Georgia, serif'; o.textAlign = 'center'; o.textBaseline = 'middle';
        o.fillText('Γ · NULL', 0, 1);
        o.restore();
        o.strokeStyle = 'rgba(200,190,170,0.5)'; o.lineWidth = 2; o.setLineDash([5, 6]);
        o.beginPath(); o.moveTo(cx - 30, cy + 60); o.quadraticCurveTo(cx + 80, cy + 120, cx + 160, cy + 160); o.stroke(); o.setLineDash([]);
      }
      o.restore();
      ctx.imageSmoothingEnabled = !lowRes;
      ctx.drawImage(off, 0, 0, W, H);
      // Körnung und Vignette
      const gi = ctx.getImageData(0, 0, W, H);
      for (let i = 0; i < gi.data.length; i += 4) { const n = (rnd() - 0.5) * 18; gi.data[i] += n; gi.data[i + 1] += n; gi.data[i + 2] += n; }
      ctx.putImageData(gi, 0, 0);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (kyt && lowRes) return 'Auffällige helle Struktur auf einem Flachdach nördlich des Leuchtturms. Bei 4,0 m/px nicht auflösbar. Empfehlung: Forschungsprogramm „Hochauflösende Optik“.';
      if (kyt) return 'Leuchtturm Kythera, Nordspitze. Auf dem Flachdach des Nebengebäudes eine großflächige Beschriftung in weißer Farbe. Alter der Farbe: geschätzt unter zwei Monaten.';
      if (urban > 0.3) return 'Dichte städtische Bebauung. Keine Auffälligkeiten.';
      if (base < -0.5) return 'Offene See. Keine Auffälligkeiten.';
      return 'Aufnahme ohne Auffälligkeiten. Geländeklassifikation: ' + (cold ? 'Eis und Tundra' : arid ? 'arid' : trop ? 'tropische Vegetation' : 'gemäßigt') + '.';
    },
  };
})();
