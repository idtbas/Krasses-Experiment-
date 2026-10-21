/* KYTHERA · Modul Nachrichtenlage */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  const PR = [
    { id: 'bericht', t: 'Jahresbericht der Stiftung Serrano vorziehen', d: 'Transparenz an der Oberfläche. Beruhigt Redaktionen, die nach anonymen Geldgebern fragen.', cost: { kap: 1.5 }, fx: { disk: 5 }, cd: 300 },
    { id: 'kultur', t: 'Kulturförderung öffentlich ankündigen', d: 'Ein Stipendienprogramm mit Namen und Gesichtern. Lenkt Aufmerksamkeit auf das Sichtbare.', cost: { kap: 3 }, fx: { disk: 3 }, cd: 420, news: true },
    { id: 'dialog', t: 'Hintergrundgespräch mit Chefredaktionen', d: 'Vertraulich, über die Stiftungsleitung. Kostet Einfluss, schafft Verständnis.', cost: { ein: 12 }, fx: { disk: 4 }, cd: 360, trust: ['P25', 4] },
  ];

  KY.mod.news = {
    mount(el) {
      this.el = el;
      this.f = { r: '', tone: '', q: '' };
      el.innerHTML = KY.ui.head({ crumb: 'Lage', code: 'NL-03', title: 'Nachrichtenlage', sub: 'Auswertung der Weltpresse in Echtzeit. Vorhaben des Kuratoriums erscheinen hier ohne Absender, solange die Diskretion hält.' }) +
        '<div class="g g4" id="nlKpi"></div>' +
        '<div class="g g-main mt12"><section class="pn"><div class="pn-h"><h3>Pressespiegel</h3><div class="tools">' +
        '<input class="inp" id="nlQ" placeholder="Suchen …" style="height:26px;width:150px">' +
        '<select class="inp" id="nlR" style="height:26px;width:auto"><option value="">Alle Regionen</option>' + KY.data.regionOrder.map(id => '<option value="' + id + '">' + KY.data.regions[id].name + '</option>').join('') + '<option value="GLOBAL">Weltweit</option></select>' +
        '<div class="seg" id="nlT"><button data-t="" class="on">Alle</button><button data-t="good">Positiv</button><button data-t="bad">Negativ</button><button data-t="proj">Eigene</button></div></div></div>' +
        '<div class="pn-b flush" id="nlFeed" style="max-height:calc(100vh - 330px);min-height:360px;overflow-y:auto"></div></section>' +
        '<aside class="col gap12"><section class="pn"><div class="pn-h"><h3>Tonlage nach Region</h3><div class="tools"><span class="meta">letzte 60 Meldungen</span></div></div><div class="pn-b" id="nlTone"></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Öffentlichkeitsarbeit</h3></div><div class="pn-b col" id="nlPr"></div></section></aside></div>';
      el.querySelector('#nlQ').oninput = e => { this.f.q = e.target.value; this.rFeed(); };
      el.querySelector('#nlR').onchange = e => { this.f.r = e.target.value; this.rFeed(); };
      U.on(el, 'click', '[data-t]', (e, b) => { this.f.tone = b.dataset.t; U.$$('[data-t]', el).forEach(x => x.classList.toggle('on', x === b)); this.rFeed(); });
      U.on(el, 'click', '[data-pr]', (e, b) => this.pr(b.dataset.pr));
      U.on(el, 'click', '[data-proj]', (e, b) => KY.ui.go('vorhaben', b.dataset.proj));
      this.sub = KY.bus.on('news', () => { this.dirty = true; });
      this.render();
    },
    unmount() { this.sub(); },
    tick() { if (this.dirty) { this.dirty = false; this.render(); } else this.rPr(); },
    render() { this.rKpi(); this.rFeed(); this.rTone(); this.rPr(); },
    rKpi() {
      const S = KY.S;
      const recent = S.news.filter(n => S.t - n.t < 600);
      const own = S.news.slice(0, 60).filter(n => n.proj).length;
      const bad = recent.filter(n => n.tone === 'bad').length, good = recent.filter(n => n.tone === 'good').length;
      const att = U.clamp(own * 6 + (100 - S.res.disk) * 0.6, 0, 100);
      U.setHTML(this.el.querySelector('#nlKpi'),
        '<div class="kpi"><span class="lbl">Meldungen · 10 min</span><span class="v">' + recent.length + '</span><span class="dl mut">' + good + ' positiv · ' + bad + ' negativ</span></div>' +
        '<div class="kpi" data-tip="<b>Eigene Vorhaben in der Presse</b>Meldungen der letzten Stunde, die auf Vorhaben des Kuratoriums zurückgehen. Die Redaktionen kennen den Absender nicht."><span class="lbl">Bezüge zu eigenen Vorhaben</span><span class="v">' + own + '</span><span class="dl mut">ohne Absenderzuordnung</span></div>' +
        '<div class="kpi" data-tip="<b>Aufmerksamkeit</b>Wie stark Redaktionen nach anonymen Großgeldgebern fragen. Abgeleitet aus Berichterstattung und Diskretion."><span class="lbl">Aufmerksamkeit</span><span class="v">' + U.n(att) + '<small>/100</small></span>' + C.meter(att, 100, C.lvlCls(att, true)) + '</div>' +
        '<div class="kpi"><span class="lbl">Diskretion</span><span class="v">' + U.n(S.res.disk) + '<small>/100</small></span>' + C.meter(S.res.disk, 100, C.lvlCls(S.res.disk)) + '</div>');
    },
    rFeed() {
      const S = KY.S, D = KY.data, f = this.f;
      const q = U.norm(f.q);
      const list = S.news.filter(n => (!f.r || n.rid === f.r || (f.r === 'GLOBAL' && n.outlet === D.outlets.GLOBAL)) && (!f.tone || (f.tone === 'proj' ? n.proj : n.tone === f.tone)) && (!q || U.norm(n.head + n.outlet).indexOf(q) >= 0)).slice(0, 80);
      U.setHTML(this.el.querySelector('#nlFeed'), list.length ? list.map(n => {
        const tone = n.tone === 'good' ? C.pill('positiv', 'ok') : n.tone === 'bad' ? C.pill('negativ', 'crit') : C.pill('neutral', 'plain');
        return '<article class="li" style="cursor:default"><div class="body"><div class="row wrap" style="gap:6px"><span class="lbl" style="color:var(--fg2)">' + U.esc(n.outlet) + '</span><span class="mono xs mut">' + U.clock(new Date(n.ts)) + '</span>' + (n.rid && D.regions[n.rid] ? '<span class="tag">' + D.regions[n.rid].name + '</span>' : '') + '<span class="sp"></span>' + tone + '</div>' +
          '<div class="serif" style="font-size:18px;line-height:1.3;margin-top:5px;color:var(--fg)">' + U.esc(n.head) + '</div>' +
          (n.proj ? '<div class="xs mt4"><span class="acc">◆ Intern: geht auf Vorhaben ' + n.proj + ' zurück</span> · <button class="lnk xs" data-proj="' + n.proj + '">öffnen</button></div>' : '') + '</div></article>';
      }).join('') : '<div class="empty"><b>Keine Meldungen</b>Filter anpassen oder abwarten.</div>');
    },
    rTone() {
      const S = KY.S, D = KY.data;
      const last = S.news.slice(0, 60);
      U.setHTML(this.el.querySelector('#nlTone'), D.regionOrder.map(id => {
        const ns = last.filter(n => n.rid === id);
        const g = ns.filter(n => n.tone === 'good').length, b = ns.filter(n => n.tone === 'bad').length;
        const net = ns.length ? (g - b) / ns.length : 0;
        const w = Math.abs(net) * 50;
        return '<div class="mrow" style="grid-template-columns:110px minmax(0,1fr) 44px" data-tip="' + U.esc(D.regions[id].name + ': ' + g + ' positiv, ' + b + ' negativ, ' + (ns.length - g - b) + ' neutral') + '"><span class="k">' + D.regions[id].name + '</span>' +
          '<div style="position:relative;height:8px;background:var(--line)"><i style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--line3)"></i><i style="position:absolute;top:0;bottom:0;' + (net >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w + '%;background:var(--' + (net >= 0 ? 'ok' : 'crit') + ')"></i></div>' +
          '<span class="v">' + ns.length + '</span></div>';
      }).join('') + '<div class="row xs mut mt8" style="justify-content:space-between"><span>◀ überwiegend negativ</span><span>positiv ▶</span></div>');
    },
    rPr() {
      const S = KY.S;
      S.prCool = S.prCool || {};
      U.setHTML(this.el.querySelector('#nlPr'), '<p class="xs mut">Maßnahmen laufen ausschließlich über öffentliche Stiftungen. Sie heben die Diskretion.</p>' + PR.map(p => {
        const cd = Math.max(0, (S.prCool[p.id] || 0) - S.t);
        const can = !cd && KY.canPay(p.cost);
        return '<div style="border:1px solid var(--line2);padding:10px"><div class="bold small">' + p.t + '</div><div class="xs fg2 mt4">' + p.d + '</div><div class="row mt8"><span class="mono xs mut">' + KY.costText(p.cost) + ' · Diskretion +' + p.fx.disk + '</span><span class="sp"></span><button class="btn sm' + (can ? ' pri' : '') + '" data-pr="' + p.id + '"' + (can ? '' : ' disabled') + '>' + (cd ? U.dur(cd) : 'Ausführen') + '</button></div></div>';
      }).join(''));
    },
    pr(id) {
      const S = KY.S, p = PR.find(x => x.id === id);
      if ((S.prCool[id] || 0) > S.t) return;
      if (!KY.pay(p.cost)) { KY.ui.flashMsg('Nicht genügend Mittel.', 'crit'); return; }
      KY.adj('disk', p.fx.disk);
      if (p.trust) KY.trustAdj(p.trust[0], p.trust[1]);
      if (p.news) {
        const rid = U.pick(KY.data.regionOrder);
        KY.regAdj(rid, { vert: 2 });
        KY.wsim.news(rid, 'Stiftung Serrano vergibt 400 Kulturstipendien in ' + KY.data.regions[rid].name, 'good');
      }
      S.prCool[id] = S.t + p.cd;
      KY.log('sys', 'Öffentlichkeitsarbeit: ' + p.t);
      KY.ui.flashMsg(p.t + ' · Diskretion +' + p.fx.disk, 'ok');
      this.render();
    },
  };
})();
