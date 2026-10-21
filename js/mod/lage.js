/* KYTHERA · Modul Lagebild */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.lage = {
    mount(el) {
      const S = KY.S;
      this.el = el;
      this.n = 0;
      el.innerHTML = KY.ui.head({
        crumb: 'Lage', code: 'LG-01', title: 'Lagebild',
        sub: '<span id="lgSub"></span>',
        act: '<button class="btn ghost" id="lgPy">' + KY.I('pythia') + 'Lagebericht anfordern</button><button class="btn pri" id="lgPlan">' + KY.I('plus') + 'Vorhaben planen</button>',
      }) +
        '<div class="g g5" id="lgKpi"></div>' +
        '<div class="g g-main mt12"><section class="pn tick"><div class="pn-h"><h3>Weltlage</h3><div class="tools"><span class="meta" id="lgMapMeta"></span><button class="btn sm ghost" data-go="atlas">Atlas öffnen</button></div></div><div class="pn-b flush" id="lgMap"></div></section>' +
        '<div class="col gap12" id="lgSide"></div></div>' +
        '<div class="g g3 mt12">' +
          '<section class="pn"><div class="pn-h"><h3>Regionen</h3><div class="tools"><span class="meta">nach Lage sortiert</span></div></div><div class="pn-b flush tbl-w" id="lgReg"></div></section>' +
          '<section class="pn"><div class="pn-h"><h3>Laufende Vorhaben</h3><div class="tools"><button class="btn sm ghost" data-go="vorhaben">Alle</button></div></div><div class="pn-b flush" id="lgProj"></div></section>' +
          '<section class="pn"><div class="pn-h"><h3>Lagemeldungen</h3><div class="tools"><span class="pill live ok plain" style="border:0;background:none">LIVE</span></div></div><div class="pn-b flush pn-b scroll" style="max-height:360px" id="lgFeed"></div></section>' +
        '</div>';
      this.map = new KY.Map(el.querySelector('#lgMap'), {
        height: 380, overlay: 'lage', tools: false, legend: true, zoom: false,
        layers: { projects: true, sats: true, ships: false, pois: true },
        onSelect: rid => KY.ui.go('atlas', rid),
      });
      el.querySelector('#lgPy').onclick = () => KY.ui.go('pythia', { ask: 'Lagebericht' });
      el.querySelector('#lgPlan').onclick = () => KY.ui.go('vorhaben', { plan: {} });
      U.on(el, 'click', '[data-go]', (e, b) => KY.ui.go(b.dataset.go, b.dataset.arg));
      U.on(el, 'click', '[data-act]', (e, b) => KY.ui.doAct(JSON.parse(b.dataset.act)));
      U.on(el, 'click', '[data-region]', (e, b) => KY.ui.go('atlas', b.dataset.region));
      U.on(el, 'click', '[data-proj]', (e, b) => KY.ui.go('vorhaben', b.dataset.proj));
      U.on(el, 'click', '#onbHide', () => { S.onb.hidden = true; this.rSide(); });
      this.subs = ['projects', 'council', 'crisis', 'msgs', 'dsp', 'onb', 'integ', 'news', 'log'].map(ev => KY.bus.on(ev, () => { this.dirty = true; }));
      this.render();
    },
    unmount() { this.map.destroy(); this.subs.forEach(f => f()); },
    tick() {
      this.n++;
      this.rKpi();
      this.rProj();
      this.rSub();
      if (this.dirty || this.n % 5 === 0) { this.dirty = false; this.rSide(); this.rFeed(); }
      if (this.n % 5 === 0) this.rReg();
    },
    render() { this.rSub(); this.rKpi(); this.rSide(); this.rReg(); this.rProj(); this.rFeed(); },
    rSub() {
      const S = KY.S;
      const st = ['', 'ruhig', 'beobachtet', 'angespannt', 'ernst', 'kritisch'][S.lagestufe];
      U.setHTML(this.el.querySelector('#lgSub'), 'Stand ' + U.hm(new Date()) + ' Uhr · Lagestufe ' + S.lagestufe + ' (' + st + ') · ' + S.projects.active.length + ' Vorhaben aktiv · Sitz IX, ' + U.esc(S.user.codename));
      U.setText(this.el.querySelector('#lgMapMeta'), 'ARGO ' + S.infra.sats.length + ' · ' + S.infra.sats.filter(s => s.focus).length + ' Regionen abgedeckt');
    },
    rKpi() {
      const S = KY.S, D = KY.data, M = KY.market;
      const nw = M.netWorth(), nwh = S.market.nw;
      const nwCh = nwh.length > 12 ? (nw / nwh[Math.max(0, nwh.length - 60)] - 1) * 100 : 0;
      const gs = KY.wsim.globalStab();
      const gsh = D.regionOrder.map(id => S.regions[id].h.stab);
      const avgH = gsh[0].map((_, i) => U.avg(gsh.map(a => a[i] !== undefined ? a[i] : a[a.length - 1])));
      const gsCh = avgH.length > 6 ? gs - avgH[Math.max(0, avgH.length - 30)] : 0;
      const nextP = S.projects.active.slice().sort((a, b) => KY.proj.remaining(a) - KY.proj.remaining(b))[0];
      const k = [
        { l: 'Gesamtvermögen', v: U.n(nw, 1), s: 'Mrd ¤', d: C.delta(nwCh, 2, ' %'), sp: nwh.slice(-60), tip: '<b>Gesamtvermögen</b>Liquidität ' + U.money(S.res.kap) + ' + Beteiligungen ' + U.money(M.holdings()) + '. Laufende Erträge ' + U.money(M.lastIncome) + ' je Minute.' },
        { l: 'Globale Stabilität', v: U.n(gs, 1), s: '/100', d: C.delta(gsCh, 1, ' Pkt.'), sp: avgH.slice(-40), tip: '<b>Globale Stabilität</b>Mittelwert der Stabilität aller zwölf Regionen.' },
        { l: 'Vorhaben aktiv', v: String(S.projects.active.length), s: '', d: nextP ? '<span class="mut">nächstes in ' + U.dur(KY.proj.remaining(nextP)) + '</span>' : '<span class="mut">keine laufenden</span>', tip: '<b>Vorhaben</b>' + S.stats.proj + ' genehmigt, ' + S.stats.projOk + ' erfolgreich abgeschlossen.' },
        { l: 'Diskretion', v: U.n(S.res.disk), s: '/100', d: C.pill(S.res.disk > 70 ? 'unauffällig' : S.res.disk > 45 ? 'beobachtet' : 'kritisch', C.lvlCls(S.res.disk)), tip: '<b>Diskretion</b>Wie unsichtbar das Kuratorium bleibt.' },
        { l: 'Ansehen im Plenum', v: U.n(S.res.ans), s: '/100', d: '<span class="mut">Freigabe ' + S.user.clr + '</span>', tip: '<b>Ansehen</b>Ihr Gewicht unter den Sitzen. Ab 50 und zwei erfolgreichen Vorhaben prüft der Vorsitz eine Erweiterung Ihrer Freigabe.' },
      ];
      const box = this.el.querySelector('#lgKpi');
      if (!box.children.length) {
        box.innerHTML = k.map((x, i) => '<div class="kpi" data-tip="' + U.esc(x.tip) + '"><span class="lbl">' + x.l + '</span><span class="v" data-k="' + i + '"></span><span class="dl" data-d="' + i + '"></span>' + (x.sp ? '<div class="sp-wrap" data-s="' + i + '"></div>' : '') + '</div>').join('');
      }
      k.forEach((x, i) => {
        U.setHTML(box.querySelector('[data-k="' + i + '"]'), x.v + (x.s ? '<small>' + x.s + '</small>' : ''));
        U.setHTML(box.querySelector('[data-d="' + i + '"]'), x.d);
        const sp = box.querySelector('[data-s="' + i + '"]');
        if (sp && this.n % 5 === 0 || (sp && !sp.innerHTML)) sp.innerHTML = C.spark(x.sp, { w: 160, h: 28 });
      });
    },
    rSide() {
      const S = KY.S;
      let h = '';
      if (!S.onb.done && !S.onb.hidden) {
        const done = KY.ONB.filter(t => S.onb.tasks[t.id]).length;
        h += '<section class="pn onb"><div class="pn-h"><h3>Einweisung Sitz IX</h3><div class="tools"><span class="meta">' + done + '/' + KY.ONB.length + '</span><button class="btn sm ghost" id="onbHide">Ausblenden</button></div></div><div class="pn-b">' +
          '<p class="small fg2" style="margin-bottom:8px">Sieben Schritte, um sich zurechtzufinden. Abschluss wird vom Plenum mit Einfluss honoriert.</p>' +
          KY.ONB.map(t => '<div class="step' + (S.onb.tasks[t.id] ? ' done' : '') + '"><span class="bx"></span><div><div class="tt small bold">' + t.t + '</div><div class="xs mut">' + t.d + '</div></div></div>').join('') + '</div></section>';
      }
      // Offene Vorgänge
      const items = [];
      if (S.crisis) items.push({ c: 'crit', t: S.crisis.title, m: 'Entscheidung · Frist ' + U.dur(KY.crisis.remaining()), act: { mod: 'krise' } });
      if (S.council.open && !S.council.open.mine) items.push({ c: 'warn', t: 'Abstimmung ' + S.council.open.no, m: S.council.open.title, act: { mod: 'kuratorium' } });
      const unread = S.msgs.filter(m => !m.read).length;
      if (unread) items.push({ c: 'info', t: unread + ' ungelesene Nachricht' + (unread > 1 ? 'en' : ''), m: S.msgs.find(m => !m.read).subj, act: { mod: 'komm' } });
      const fl = S.dsp.list.filter(d => d.enc && !d.decT && (d.flag || d.story)).length;
      if (fl) items.push({ c: 'acc', t: fl + ' markierte Depesche' + (fl > 1 ? 'n' : ''), m: 'verschlüsselt', act: { mod: 'depeschen' } });
      const an = S.integ.anomalies.filter(a => a.state === 'offen');
      if (an.length) items.push({ c: an.some(a => a.sev >= 3) ? 'crit' : 'ser', t: an.length + ' offene Anomalie' + (an.length > 1 ? 'n' : ''), m: an[0].t, act: { mod: 'integritaet' } });
      if (!S.research.active) items.push({ c: 'plain', t: 'Kein Forschungsprogramm aktiv', m: 'Forschung ruht', act: { mod: 'forschung' } });
      h += '<section class="pn"><div class="pn-h"><h3>Offene Vorgänge</h3><div class="tools"><span class="meta">' + items.length + '</span></div></div><div class="pn-b flush">' +
        (items.length ? items.map(i => '<div class="li" data-act=\'' + JSON.stringify(i.act) + '\'><span class="pill ' + i.c + '" style="margin-top:1px">&nbsp;</span><div class="body"><div class="t">' + U.esc(i.t) + '</div><div class="m ell">' + U.esc(i.m) + '</div></div></div>').join('') : '<div class="empty"><b>Keine offenen Vorgänge</b>Alles ist entschieden.</div>') + '</div></section>';
      // Empfehlungen
      const recs = KY.pythia.recommend(3);
      h += '<section class="pn"><div class="pn-h"><h3>PYTHIA · Empfehlungen</h3><div class="tools"><button class="btn sm ghost" data-go="pythia">Fragen</button></div></div><div class="pn-b flush">' +
        recs.map((r, i) => '<div class="li" data-act=\'' + JSON.stringify(r.act).replace(/'/g, '&#39;') + '\'><div class="ic mono">' + (i + 1) + '</div><div class="body"><div class="t">' + U.esc(r.t) + '</div><div class="small mut mt4" style="line-height:1.4">' + U.esc(r.d) + '</div></div></div>').join('') + '</div></section>';
      U.setHTML(this.el.querySelector('#lgSide'), h);
    },
    rReg() {
      const S = KY.S, D = KY.data, W = KY.wsim;
      const ord = D.regionOrder.slice().sort((a, b) => W.score(a) - W.score(b));
      U.setHTML(this.el.querySelector('#lgReg'), '<table class="tbl"><thead><tr><th>Region</th><th>Status</th><th class="num">Stab.</th><th class="num">Span.</th><th class="num">Trend</th></tr></thead><tbody>' +
        ord.map(id => {
          const R = S.regions[id], st = W.status(id), tr = U.slope(R.h.stab, 12) * 10;
          return '<tr class="click" data-region="' + id + '"><td>' + U.esc(D.regions[id].name) + (R.warn ? ' <span class="tag" style="color:var(--warn)">WARNUNG</span>' : '') + '</td><td>' + C.pill(st.t, st.c) + '</td><td class="num">' + U.n(R.m.stab) + '</td><td class="num">' + U.n(R.m.span) + '</td><td class="num">' + C.delta(tr, 1) + '</td></tr>';
        }).join('') + '</tbody></table>');
    },
    rProj() {
      const S = KY.S, D = KY.data;
      const box = this.el.querySelector('#lgProj');
      if (!S.projects.active.length) {
        U.setHTML(box, '<div class="empty"><b>Keine laufenden Vorhaben</b>PYTHIA empfiehlt, mit einer Bildungsstiftung oder einem Infrastrukturprogramm zu beginnen.</div>');
        return;
      }
      U.setHTML(box, S.projects.active.map(pr => {
        const T = D.projectTypes[pr.type], k = KY.proj.progress(pr);
        return '<div class="li" data-proj="' + pr.id + '"><div class="body"><div class="row"><span class="t bold ell" style="color:var(--fg)">' + pr.code + '</span><span class="sp"></span><span class="mono xs mut">' + U.dur(KY.proj.remaining(pr)) + '</span></div>' +
          '<div class="m">' + T.name + ' · ' + D.regions[pr.rid].name + ' · ' + pr.p + ' %</div><div class="mt8">' + C.meter(k * 100, 100, 'prog') + '</div><div class="xs mut mt4">Phase ' + (pr.phase + 1) + '/' + T.phases.length + ': ' + T.phases[Math.max(0, pr.phase)] + '</div></div></div>';
      }).join(''));
    },
    rFeed() {
      const S = KY.S;
      const items = S.log.filter(l => l.cat === 'welt' || l.cat === 'vor' || l.cat === 'kur' || l.cat === 'kri').slice(-18).reverse();
      U.setHTML(this.el.querySelector('#lgFeed'), items.map(l => '<div class="li" style="cursor:default"><div class="body"><div class="m" style="margin:0 0 3px">' + U.clock(new Date(l.ts)) + ' · ' + (KY.CATS[l.cat] || '').toUpperCase() + '</div><div class="small fg2">' + U.esc(l.text) + '</div></div></div>').join('') || '<div class="empty">Noch keine Meldungen.</div>');
    },
  };
})();
