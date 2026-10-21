/* KYTHERA · Modul Atlas */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.atlas = {
    mount(el, arg) {
      const S = KY.S;
      this.el = el;
      this.n = 0;
      this.sel = (arg && KY.data.regions[arg]) ? arg : (S.atlasSel || 'MER');
      this.metric = 'stab';
      this.layers = S.atlasLayers || { projects: true, sats: true, ships: true, pois: true, labels: true };
      el.innerHTML = KY.ui.head({
        crumb: 'Lage', code: 'AT-02', title: 'Atlas',
        sub: 'Zwölf Regionen, ihre Lage und Ihre Präsenz. Wählen Sie eine Region für das Dossier. Mausrad oder Doppelklick zoomt.',
        act: '<div class="seg" id="atLayers">' + [['projects', 'Vorhaben'], ['sats', 'Satelliten'], ['ships', 'Flotte'], ['pois', 'Orte']].map(([k, n]) => '<button data-l="' + k + '"' + (this.layers[k] ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div>',
      }) +
        '<div class="g g-main"><div class="col gap12"><section class="pn tick"><div class="pn-b flush" id="atMap"></div></section>' +
        '<section class="pn"><div class="pn-h"><h3 id="atHistT">Verlauf</h3><div class="tools"><select class="inp" id="atMetric" style="height:26px;width:auto">' + Object.keys(KY.data.metricInfo).map(k => '<option value="' + k + '">' + KY.data.metricInfo[k].name + '</option>').join('') + '</select></div></div><div class="pn-b" id="atHist"></div></section></div>' +
        '<aside class="col gap12" id="atDos"></aside></div>';
      this.map = new KY.Map(el.querySelector('#atMap'), {
        height: Math.max(420, Math.min(620, window.innerHeight - 330)), overlay: S.atlasOv || 'lage', select: this.sel,
        layers: this.layers,
        onSelect: rid => this.select(rid),
        onPoi: id => this.poi(id),
      });
      const origSet = this.map.setOverlay.bind(this.map);
      this.map.setOverlay = k => { origSet(k); S.atlasOv = k; };
      el.querySelector('#atMetric').onchange = e => { this.metric = e.target.value; this.rHist(); };
      U.on(el, 'click', '[data-l]', (e, b) => {
        const k = b.dataset.l;
        this.layers[k] = !this.layers[k];
        b.classList.toggle('on', this.layers[k]);
        S.atlasLayers = this.layers;
        this.map.dirty = true;
      });
      U.on(el, 'click', '[data-plan]', (e, b) => KY.ui.go('vorhaben', { plan: { type: b.dataset.plan, rid: this.sel } }));
      U.on(el, 'click', '[data-go]', (e, b) => KY.ui.go(b.dataset.go, b.dataset.arg));
      U.on(el, 'click', '#atAsk', () => KY.ui.go('pythia', { ask: 'Wie steht es um ' + KY.data.regions[this.sel].name + '?' }));
      U.on(el, 'click', '#atSat', () => this.satDialog());
      U.on(el, 'click', '#atImg', () => KY.ui.go('orbit', { img: [34.2, 21.4] }));
      this.subs = ['regions', 'projects', 'infra'].map(ev => KY.bus.on(ev, () => { this.dirty = true; }));
      this.select(this.sel);
    },
    arg(a) { if (a && KY.data.regions[a]) this.select(a); },
    unmount() { this.map.destroy(); this.subs.forEach(f => f()); },
    tick() {
      this.n++;
      if (this.n % 3 === 0 || this.dirty) { this.dirty = false; if (this.poiMode) return; this.rDos(); }
      if (this.n % 10 === 0 && !this.poiMode) this.rHist();
    },
    select(rid) {
      this.sel = rid;
      this.poiMode = null;
      KY.S.atlasSel = rid;
      this.map.select(rid);
      KY.onb('atlas');
      this.rDos(true);
      this.rHist();
    },
    poi(id) {
      const S = KY.S, p = KY.data.pois.find(x => x.id === id);
      this.poiMode = id;
      this.map.select(null);
      const known = S.user.clr >= 4 || KY.flag('history');
      U.setHTML(this.el.querySelector('#atDos'), '<section class="pn tick"><div class="pn-h"><h3>Ort · Sperrgebiet</h3></div><div class="pn-b"><div class="serif" style="font-size:28px;line-height:1.1">Kythera</div><div class="mono xs mut mt4">34,20° N · 21,40° O</div>' +
        '<p class="fg2 mt12">' + U.esc(p.text) + '</p>' +
        '<dl class="kv mt12"><dt>Status</dt><dd>Sperrgebiet, Zugang nur mit Genehmigung des Vorsitzes</dd><dt>Bauwerke</dt><dd>Leuchtturm Nordspitze (1912, außer Betrieb seit 1988)</dd><dt>Letzter Besuch</dt><dd>' + (known ? '10.09.2026 · FS HALVORSEN' : '<span class="redact">██.██.████ · ██ ██████████</span>') + '</dd></dl>' +
        (S.user.clr >= 4 ? '<button class="btn pri block mt16" id="atImg">' + KY.I('sat') + 'Bildaufklärung anfordern</button>' : '<p class="xs mut mt16">Bildaufklärung erfordert Freigabestufe 4.</p>') +
        '</div></section>');
      U.setHTML(this.el.querySelector('#atHist'), '<div class="empty">Für Sperrgebiete werden keine Lagedaten geführt.</div>');
      U.setText(this.el.querySelector('#atHistT'), 'Verlauf');
      if (KY.audio) KY.audio.play('click');
    },
    rDos(force) {
      const S = KY.S, D = KY.data, id = this.sel, R = S.regions[id], info = D.regions[id], m = R.m;
      const st = KY.wsim.status(id);
      const projs = S.projects.active.filter(p => p.rid === id || p.rid2 === id);
      const sats = S.infra.sats.filter(s => s.focus === id);
      const cos = D.companies.filter(c => c.r === id);
      const ppl = D.people.filter(p => p.r === id);
      const tr = k => U.slope(R.h[k], 15) * 10;
      const metrics = Object.keys(D.metricInfo).map(k => {
        const mi = D.metricInfo[k];
        return '<div class="mrow" data-tip="<b>' + mi.name + '</b>' + U.esc(mi.text) + '"><span class="k">' + mi.name + '</span>' + C.meter(m[k], 100, C.lvlCls(m[k], mi.good === 'lo')) + '<span class="v">' + U.n(m[k]) + ' <span class="xs">' + C.delta(tr(k), 0, '', mi.good === 'lo') + '</span></span></div>';
      }).join('');
      const html =
        '<section class="pn tick"><div class="pn-h"><h3>Regionsdossier</h3><div class="tools">' + C.pill(st.t, st.c, st.c === 'crit') + '</div></div><div class="pn-b">' +
        '<div class="row" style="align-items:flex-start"><div style="min-width:0;flex:1"><div class="serif" style="font-size:28px;line-height:1.05">' + U.esc(info.name) + '</div><div class="mono xs mut mt4">' + id + ' · ' + U.esc(info.kont) + ' · ' + info.pop + ' Mio. Einw.</div></div></div>' +
        '<p class="fg2 small mt8" style="line-height:1.5">' + U.esc(info.text) + '</p>' +
        '<dl class="kv mt12"><dt>Hauptstadt</dt><dd>' + U.esc(info.cap) + '</dd><dt>Branchen</dt><dd>' + info.branchen.join(', ') + '</dd><dt>Klima</dt><dd>' + info.klima + '</dd><dt>Risiken</dt><dd>' + info.risiken.join(', ') + '</dd>' +
        '<dt>Resilienz</dt><dd>' + U.n(R.res * 100) + ' %</dd><dt>Abdeckung</dt><dd>' + (sats.length ? sats.map(s => s.id).join(', ') : '<span class="mut">keine</span> <button class="lnk small" id="atSat">ausrichten</button>') + '</dd></dl>' +
        (R.warn ? '<div class="pill warn mt12" style="white-space:normal">' + (R.warn.type === 'STURM' ? 'Sturmwarnung aktiv' : 'Energieengpass droht') + '</div>' : '') +
        (R.mora > 0 ? '<div class="pill info mt12">Moratorium für Großvorhaben · ' + U.dur(R.mora) + '</div>' : '') +
        '</div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Profil</h3><div class="tools"><span class="meta">— Ausgangslage</span></div></div><div class="pn-b">' + C.radar(m, R.base) + '<div class="mt8">' + metrics + '</div></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Handeln</h3></div><div class="pn-b"><div class="g g2" style="gap:6px">' +
        ['INF', 'ENE', 'HUM', 'VER', 'BIL', 'KLI', 'GES', 'INV'].map(t => '<button class="btn sm ghost" data-plan="' + t + '">' + D.projectTypes[t].name + '</button>').join('') +
        '</div><div class="row mt8"><button class="btn sm block" id="atAsk">' + KY.I('pythia') + 'PYTHIA-Analyse</button></div></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Vor Ort</h3></div><div class="pn-b flush">' +
        (projs.length ? projs.map(p => '<div class="li" data-go="vorhaben" data-arg="' + p.id + '"><div class="body"><div class="t">' + p.code + ' · ' + D.projectTypes[p.type].name + '</div><div class="mt4">' + C.meter(KY.proj.progress(p) * 100, 100, 'prog') + '</div></div></div>').join('') : '') +
        cos.map(c => { const ch = KY.market.change(c.t, 60); return '<div class="li" data-go="kapital" data-arg="' + c.t + '"><div class="ic mono">' + c.t + '</div><div class="body"><div class="t">' + U.esc(c.n) + '</div><div class="m">' + D.sectors[c.s] + ' · ' + U.n(S.market.c[c.t].p, 2) + ' ¤ · ' + C.delta(ch, 1, ' %') + '</div></div></div>'; }).join('') +
        ppl.map(p => '<div class="li" data-go="netzwerk" data-arg="' + p.id + '">' + C.avatar(p.id, 28) + '<div class="body"><div class="t">' + U.esc(p.n) + '</div><div class="m ell">' + U.esc(p.role) + '</div></div></div>').join('') +
        '</div></section>';
      U.setHTML(this.el.querySelector('#atDos'), html);
    },
    rHist() {
      const S = KY.S, D = KY.data, R = S.regions[this.sel];
      if (!R) return;
      const mi = D.metricInfo[this.metric];
      U.setText(this.el.querySelector('#atHistT'), mi.name + ' · ' + D.regions[this.sel].name + ' · letzte 15 min');
      const vals = R.h[this.metric];
      C.line(this.el.querySelector('#atHist'), {
        vals, h: 180, ref: R.base[this.metric], fmt: v => U.n(v, 1),
        label: i => 'vor ' + U.dur((vals.length - 1 - i) * 10),
        xlabels: [[0, '−' + Math.round((vals.length - 1) * 10 / 60) + ' min'], [vals.length - 1, 'jetzt']],
      });
    },
    satDialog() {
      const S = KY.S, D = KY.data, rid = this.sel;
      KY.ui.modal({
        lbl: 'Flotte & Orbit', title: 'Satellit auf ' + D.regions[rid].name + ' ausrichten',
        body: '<p class="fg2 small">Abgedeckte Regionen erhalten +3 Punkte Erfolg für Vorhaben und mit dem Frühwarnsystem mehr Zeit bei Krisen. Ausrichtung kostet 4 EF Rechenzeit.</p><div class="col mt12" id="satList">' +
          S.infra.sats.map(s => '<button class="opt" data-s="' + s.id + '"><span class="on">' + KY.I('sat') + '</span><span><span class="t">' + s.id + '</span> <span class="tag">' + KY.infra.satDef(s.id).fn + '</span><div class="d">Aktuell: ' + (s.focus ? D.regions[s.focus].name : 'Bereitschaft') + '</div></span></button>').join('') + '</div>',
        actions: [{ label: 'Abbrechen', cls: 'ghost' }],
      });
      U.on(document.getElementById('satList'), 'click', '[data-s]', (e, b) => {
        const r = KY.infra.retask(b.dataset.s, rid);
        if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return; }
        KY.ui.closeTop();
        KY.ui.flashMsg(b.dataset.s + ' auf ' + D.regions[rid].name + ' ausgerichtet', 'ok');
        this.rDos();
      });
    },
  };
})();
