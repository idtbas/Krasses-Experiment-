/* KYTHERA · Modul Vorhaben */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.vorhaben = {
    mount(el, arg) {
      this.el = el;
      this.tab = 'aktiv';
      this.sel = null;
      this.plan = { type: 'INF', rid: KY.S.atlasSel || 'ZAM', rid2: null, budget: 1, ap: 'STD', partners: [], code: U.codename() };
      el.innerHTML = KY.ui.head({
        crumb: 'Steuerung', code: 'VH-04', title: 'Vorhaben',
        sub: 'Planen, genehmigen und überwachen Sie Projekte in den Regionen. Jedes Vorhaben verändert die Lage messbar.',
        act: '<button class="btn pri" id="vhNew">' + KY.I('plus') + 'Neues Vorhaben</button>',
      }) + '<div class="tabs" id="vhTabs"></div><div id="vhBody"></div>';
      el.querySelector('#vhNew').onclick = () => this.setTab('plan');
      U.on(el, 'click', '[data-tab]', (e, b) => this.setTab(b.dataset.tab));
      this.subs = ['projects', 'res', 'people'].map(ev => KY.bus.on(ev, () => { this.dirty = true; }));
      this.arg(arg);
    },
    unmount() { this.subs.forEach(f => f()); },
    arg(a) {
      const S = KY.S;
      if (a && a.plan) {
        Object.assign(this.plan, a.plan);
        if (a.plan.type && KY.data.projectTypes[a.plan.type].dual && !this.plan.rid2) this.plan.rid2 = KY.wsim.neighbor(this.plan.rid);
        this.setTab('plan');
      } else if (typeof a === 'string') {
        this.sel = a;
        this.setTab(S.projects.active.find(p => p.id === a) ? 'aktiv' : 'done');
      } else {
        this.setTab(S.projects.active.length ? 'aktiv' : 'plan');
      }
    },
    setTab(t) {
      this.tab = t;
      const S = KY.S;
      U.setHTML(this.el.querySelector('#vhTabs'), [['aktiv', 'Laufend', S.projects.active.length], ['plan', 'Planung'], ['done', 'Abgeschlossen', S.projects.done.length]].map(([k, n, c]) => '<button data-tab="' + k + '"' + (k === t ? ' class="on"' : '') + '>' + n + (c !== undefined ? '<span class="n">' + c + '</span>' : '') + '</button>').join(''));
      this.render(true);
    },
    tick() {
      if (this.tab === 'aktiv') this.rActive(this.dirty);
      else if (this.tab === 'plan' && this.dirty) this.rPlanSide();
      else if (this.tab === 'done' && this.dirty) this.render(true);
      if (this.dirty) { this.dirty = false; this.setTabsOnly(); }
    },
    setTabsOnly() {
      const S = KY.S;
      const n = this.el.querySelectorAll('#vhTabs .n');
      if (n[0]) n[0].textContent = S.projects.active.length;
      if (n[1]) n[1].textContent = S.projects.done.length;
    },
    render(full) {
      if (this.tab === 'plan') { this.rPlan(); return; }
      const b = this.fresh();
      if (this.tab === 'done') { this.rDone(); return; }
      if (full) b.innerHTML = '<div class="g g-main2"><section class="pn"><div class="pn-h"><h3>Laufende Vorhaben</h3></div><div class="pn-b flush" id="vhList"></div></section><section class="pn tick" id="vhDet"></section></div>';
      this.rActive(true);
    },

    /* ---------- Laufende ---------- */
    rActive(full) {
      const S = KY.S, D = KY.data;
      const list = this.el.querySelector('#vhList');
      if (!list) return;
      if (!S.projects.active.length) {
        U.setHTML(list, '<div class="empty"><b>Keine laufenden Vorhaben</b>Starten Sie ein Vorhaben über „Neues Vorhaben“ oder folgen Sie einer Empfehlung von PYTHIA.</div>');
        U.setHTML(this.el.querySelector('#vhDet'), '<div class="pn-b"><div class="empty">Kein Vorhaben ausgewählt.</div></div>');
        return;
      }
      if (!this.sel || !S.projects.active.find(p => p.id === this.sel)) this.sel = S.projects.active[0].id;
      U.setHTML(list, S.projects.active.map(pr => {
        const T = D.projectTypes[pr.type];
        return '<div class="li' + (pr.id === this.sel ? ' on' : '') + '" data-sel="' + pr.id + '"><div class="ic mono" style="width:44px">' + T.short.slice(0, 5) + '</div><div class="body"><div class="row"><span class="t bold" style="color:var(--fg)">' + pr.code + '</span><span class="mono xs mut">' + pr.id + '</span><span class="sp"></span><span class="mono small">' + U.dur(KY.proj.remaining(pr)) + '</span></div>' +
          '<div class="m">' + T.name + ' · ' + D.regions[pr.rid].name + (pr.rid2 ? ' ↔ ' + D.regions[pr.rid2].name : '') + ' · ' + D.approaches[pr.ap].name + '</div><div class="mt8">' + C.meter(KY.proj.progress(pr) * 100, 100, 'prog stripes') + '</div></div></div>';
      }).join(''));
      if (!this._bound) {
        this._bound = true;
        U.on(this.el, 'click', '[data-sel]', (e, b) => { this.sel = b.dataset.sel; this.rActive(true); });
        U.on(this.el, 'click', '[data-pact]', (e, b) => this.pAct(b.dataset.pact));
      }
      this.rDet();
    },
    rDet() {
      const S = KY.S, D = KY.data;
      const pr = S.projects.active.find(p => p.id === this.sel);
      const box = this.el.querySelector('#vhDet');
      if (!pr || !box) return;
      const T = D.projectTypes[pr.type], k = KY.proj.progress(pr);
      const fx = Object.entries(T.fx).map(([m, v]) => '<span class="tag">' + D.metricInfo[m].short + ' ' + U.sgn(v * pr.fxMult, 0) + '</span>').join(' ');
      U.setHTML(box, '<div class="pn-h"><h3>' + pr.id + ' · ' + T.name + '</h3><div class="tools">' + C.pill('aktiv', 'acc', true) + '</div></div><div class="pn-b">' +
        '<div class="row" style="align-items:flex-end"><div><div class="lbl">Deckname</div><div style="font:600 26px/1.1 var(--font-cond);letter-spacing:.12em">' + pr.code + '</div></div><span class="sp"></span><div class="r"><div class="lbl">Restlaufzeit</div><div class="mono" style="font-size:22px">' + U.dur(KY.proj.remaining(pr)) + '</div></div></div>' +
        '<div class="mt12">' + C.meter(k * 100, 100, 'prog tall stripes') + '</div>' +
        '<div class="row mt8 wrap" style="gap:4px">' + T.phases.map((p, i) => '<span class="tag' + (i <= pr.phase ? ' acc' : '') + '">' + (i + 1) + ' ' + p + '</span>').join('') + '</div>' +
        '<dl class="kv mt16"><dt>Region</dt><dd>' + D.regions[pr.rid].name + (pr.rid2 ? ' ↔ ' + D.regions[pr.rid2].name : '') + '</dd><dt>Erfolgsprognose</dt><dd class="mono">' + pr.p + ' %</dd><dt>Vorgehen</dt><dd>' + D.approaches[pr.ap].name + ' · Budget ' + Math.round(pr.budget * 100) + ' %</dd><dt>Mittel</dt><dd class="mono">' + KY.costText(pr.cost) + '</dd>' +
        '<dt>Partner</dt><dd>' + (pr.partners.length ? pr.partners.map(id => U.esc(D.people.find(p => p.id === id).n)).join(', ') : '<span class="mut">keine</span>') + '</dd>' + (pr.ship ? '<dt>Schiff</dt><dd>FS ' + pr.ship + '</dd>' : '') + '<dt>Erwartete Wirkung</dt><dd>' + fx + '</dd></dl>' +
        '<div class="lbl mt16">Einsatzprotokoll</div><div class="mono small mt8" style="line-height:1.65;max-height:220px;overflow-y:auto">' + pr.log.slice().reverse().map(l => '<div><span class="mut">' + U.clock(new Date(l.ts)) + '</span> ' + U.esc(l.text) + '</div>').join('') + '</div>' +
        '</div><div class="pn-f"><button class="btn sm" data-pact="acc" data-tip="Restlaufzeit −40 %. Kosten: 25 % des Budgets und 8 Einfluss. Erfolgsprognose −3 Punkte.">' + KY.I('play') + 'Beschleunigen</button><button class="btn sm ghost" data-pact="map">Im Atlas</button><span class="sp"></span><button class="btn sm dan" data-pact="abort">Abbrechen</button></div>');
    },
    pAct(a) {
      const id = this.sel;
      if (a === 'map') { const pr = KY.S.projects.active.find(p => p.id === id); if (pr) KY.ui.go('atlas', pr.rid); return; }
      if (a === 'acc') { const r = KY.proj.accelerate(id); if (!r.ok) KY.ui.flashMsg(r.err || 'Nicht möglich', 'crit'); else KY.ui.flashMsg('Vorhaben beschleunigt', 'ok'); this.rActive(true); return; }
      if (a === 'abort') KY.ui.confirm('Vorhaben abbrechen?', 'Die Hälfte der nicht verbrauchten Mittel fließt zurück. Ihr Ansehen im Plenum sinkt leicht.', 'Abbrechen', () => { KY.proj.abort(id); this.rActive(true); }, true);
    },

    /* ---------- Planung ---------- */
    fresh() {
      const old = this.el.querySelector('#vhBody'), b = old.cloneNode(false);
      old.replaceWith(b);
      return b;
    },
    rPlan() {
      const S = KY.S, D = KY.data, P = this.plan;
      const b = this.fresh();
      const types = Object.keys(D.projectTypes);
      const regOpts = sel => D.regionOrder.map(id => '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + D.regions[id].name + '</option>').join('');
      b.innerHTML = '<div class="g g-main"><div class="col gap12">' +
        '<section class="pn"><div class="pn-h"><h3>1 · Typ</h3></div><div class="pn-b"><div class="g g4" style="gap:6px" id="vpTypes">' + types.map(t => {
          const T = D.projectTypes[t], av = KY.proj.available(t);
          return '<button class="opt' + (P.type === t ? ' py' : '') + (av ? '' : ' dis') + '" data-type="' + t + '" style="flex-direction:column;gap:4px;padding:10px"' + (av ? '' : ' data-tip="Erfordert Forschung: ' + U.esc(KY.research.get(T.requires).n) + '"') + '><span class="t" style="font-size:12.5px">' + T.name + '</span><span class="mono xs mut">' + U.money(T.cost, 1) + ' · ' + U.dur(T.dur) + '</span></button>';
        }).join('') + '</div><p class="small fg2 mt12" id="vpTypeText"></p></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>2 · Region</h3></div><div class="pn-b"><div class="g g2"><div class="fld"><label for="vpRid">Zielregion</label><select class="inp" id="vpRid">' + regOpts(P.rid) + '</select></div>' +
        '<div class="fld" id="vpRid2W"><label for="vpRid2">Partnerregion</label><select class="inp" id="vpRid2"><option value="">— wählen —</option>' + regOpts(P.rid2) + '</select></div></div><div id="vpRegInfo" class="mt12"></div></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>3 · Budget und Vorgehen</h3></div><div class="pn-b"><div class="g g2"><div class="fld"><span class="lbl">Budgetrahmen</span><div class="seg" id="vpBud">' + [0.75, 1, 1.25, 1.5].map(v => '<button data-bud="' + v + '"' + (P.budget === v ? ' class="on"' : '') + '>' + Math.round(v * 100) + ' %</button>').join('') + '</div><span class="xs mut">Mehr Budget erhöht Erfolg und Wirkung.</span></div>' +
        '<div class="fld"><span class="lbl">Vorgehen</span><div class="seg" id="vpAp">' + Object.keys(D.approaches).map(k => '<button data-ap="' + k + '"' + (P.ap === k ? ' class="on"' : '') + '>' + D.approaches[k].name + '</button>').join('') + '</div><span class="xs mut" id="vpApT"></span></div></div></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>4 · Partner aus dem Netzwerk</h3><div class="tools"><span class="meta" id="vpPN"></span></div></div><div class="pn-b flush tbl-w" id="vpPeople" style="max-height:300px;overflow:auto"></div></section>' +
        '</div><aside class="col gap12" id="vpSide"></aside></div>';
      U.on(b, 'click', '[data-type]', (e, x) => {
        if (x.classList.contains('dis')) { KY.ui.flashMsg('Dieser Typ erfordert ein Forschungsprogramm.', 'crit'); return; }
        P.type = x.dataset.type;
        if (D.projectTypes[P.type].dual && !P.rid2) P.rid2 = KY.wsim.neighbor(P.rid);
        P.partners = P.partners.filter(pid => KY.S.people[pid] && !KY.S.people[pid].busy);
        this.rPlan();
      });
      b.querySelector('#vpRid').onchange = e => { P.rid = e.target.value; if (P.rid2 === P.rid) P.rid2 = null; this.rPlanSide(); this.rPlanBits(); };
      b.querySelector('#vpRid2').onchange = e => { P.rid2 = e.target.value || null; this.rPlanSide(); };
      U.on(b, 'click', '[data-bud]', (e, x) => { P.budget = +x.dataset.bud; U.$$('[data-bud]', b).forEach(y => y.classList.toggle('on', y === x)); this.rPlanSide(); });
      U.on(b, 'click', '[data-ap]', (e, x) => { P.ap = x.dataset.ap; U.$$('[data-ap]', b).forEach(y => y.classList.toggle('on', y === x)); this.rPlanBits(); this.rPlanSide(); });
      U.on(b, 'change', '[data-pp]', (e, x) => {
        const id = x.dataset.pp;
        if (x.checked) { if (P.partners.length >= 3) { x.checked = false; KY.ui.flashMsg('Höchstens drei Partner je Vorhaben.', 'crit'); return; } P.partners.push(id); }
        else P.partners = P.partners.filter(p => p !== id);
        U.setText(b.querySelector('#vpPN'), P.partners.length + ' / 3 gewählt');
        this.rPlanSide();
      });
      this.rPlanBits();
      this.rPlanSide();
    },
    rPlanBits() {
      const S = KY.S, D = KY.data, P = this.plan, T = D.projectTypes[P.type], b = this.el.querySelector('#vhBody');
      U.setText(b.querySelector('#vpTypeText'), T.text);
      b.querySelector('#vpRid2W').style.display = T.dual ? '' : 'none';
      U.setText(b.querySelector('#vpApT'), D.approaches[P.ap].text);
      const R = S.regions[P.rid];
      U.setHTML(b.querySelector('#vpRegInfo'), '<div class="g g4" style="gap:6px">' + ['vert', 'praes', 'span', 'stab'].map(k => '<div class="kpi" style="padding:8px 10px"><span class="lbl">' + D.metricInfo[k].name + '</span><span class="mono">' + U.n(R.m[k]) + '</span>' + C.meter(R.m[k], 100, C.lvlCls(R.m[k], k === 'span')) + '</div>').join('') + '</div>' +
        (R.mora > 0 && T.big ? '<p class="pill crit mt8" style="white-space:normal">Moratorium für Großvorhaben aktiv (' + U.dur(R.mora) + ')</p>' : ''));
      // Partnerliste: passende zuerst
      const ppl = D.people.map(p => ({ p, st: S.people[p.id], match: p.tags.filter(t => T.tags.indexOf(t) >= 0).length })).sort((a, b2) => (b2.match - a.match) || (b2.st.trust - a.st.trust));
      U.setText(b.querySelector('#vpPN'), P.partners.length + ' / 3 gewählt');
      U.setHTML(b.querySelector('#vpPeople'), '<table class="tbl"><thead><tr><th></th><th>Person</th><th>Fachgebiete</th><th class="num">Vertrauen</th><th>Status</th></tr></thead><tbody>' + ppl.map(({ p, st, match }) => {
        const busy = st.busy && P.partners.indexOf(p.id) < 0;
        return '<tr><td style="width:30px"><input type="checkbox" data-pp="' + p.id + '"' + (P.partners.indexOf(p.id) >= 0 ? ' checked' : '') + (busy ? ' disabled' : '') + ' aria-label="' + U.esc(p.n) + ' als Partner"></td><td><div class="small">' + U.esc(p.n) + '</div><div class="xs mut ell" style="max-width:240px">' + U.esc(p.role) + '</div></td><td>' + p.tags.map(t => '<span class="tag' + (T.tags.indexOf(t) >= 0 ? ' acc' : '') + '">' + KY.data.tagNames[t] + '</span>').join(' ') + '</td><td class="num">' + U.n(st.trust) + '</td><td>' + (busy ? C.pill('gebunden', 'plain') : match ? C.pill('passend', 'ok') : '<span class="xs mut">verfügbar</span>') + '</td></tr>';
      }).join('') + '</tbody></table>');
    },
    rPlanSide() {
      const S = KY.S, D = KY.data, P = this.plan, T = D.projectTypes[P.type];
      const side = this.el.querySelector('#vpSide');
      if (!side) return;
      const pl = KY.proj.plan(P);
      const can = !pl.blocked && KY.canPay(pl.cost);
      const fx = Object.entries(T.fx).map(([m, v]) => '<div class="row small"><span class="fg2" style="flex:1">' + D.metricInfo[m].name + '</span><span class="mono">' + U.sgn(v * pl.fxMult, 1) + '</span></div>').join('');
      const pyCom = pl.p >= 75 ? 'Hohe Erfolgswahrscheinlichkeit. Ich empfehle die Genehmigung.' : pl.p >= 55 ? 'Vertretbares Risiko. Partner mit passender Fachrichtung würden die Prognose verbessern.' : 'Erhebliches Risiko. Erwägen Sie mehr Budget, Partner oder zuerst eine Bildungsstiftung zur Stärkung der Kooperation.';
      U.setHTML(side, '<section class="pn tick"><div class="pn-h"><h3>Prognose</h3><div class="tools"><span class="meta">PYTHIA · Modell 31</span></div></div><div class="pn-b">' +
        C.gauge(pl.p, { label: 'Erfolgsprognose', cls: pl.p >= 70 ? 'ok' : pl.p >= 50 ? 'warn' : 'crit', max: 220 }) +
        '<div class="col gap4 mt12">' + pl.parts.map(p => '<div class="row small"><span class="fg2 ell" style="flex:1">' + U.esc(p.label) + '</span><span class="mono ' + (p.base ? '' : p.v > 0 ? 'up' : 'dn') + '">' + (p.base ? p.v : U.sgn(p.v, 0)) + '</span></div>').join('') + '<div class="row small" style="border-top:1px solid var(--line2);padding-top:5px;margin-top:3px"><span class="bold" style="flex:1">Gesamt</span><span class="mono bold">' + pl.p + ' %</span></div></div>' +
        '<p class="small mt12" style="color:var(--acc2);font-style:italic">„' + pyCom + '“</p></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Einsatz und Wirkung</h3></div><div class="pn-b"><dl class="kv"><dt>Kosten</dt><dd class="mono">' + KY.costText(pl.cost) + '</dd><dt>Laufzeit</dt><dd class="mono">' + U.dur(pl.dur) + '</dd><dt>Diskretion</dt><dd class="mono">−' + U.n(pl.disk, 1) + '</dd></dl>' +
        '<div class="lbl mt12" style="margin-bottom:6px">Wirkung bei Erfolg · ' + D.regions[P.rid].name + '</div>' + fx +
        (T.returns ? '<p class="xs acc mt8">Kapital fließt nach Abschluss mit Rendite zurück.</p>' : '') + (T.research ? '<p class="xs acc mt8">Erhöht dauerhaft Ihre Forschungsgeschwindigkeit.</p>' : '') + (T.expedition ? '<p class="xs acc mt8">Benötigt ein freies Schiff. Mögliche Funde.</p>' : '') + (T.resilience ? '<p class="xs acc mt8">Senkt Schäden künftiger Naturereignisse.</p>' : '') +
        '</div></section>' +
        '<section class="pn"><div class="pn-b"><div class="fld"><label for="vpCode">Deckname</label><div class="row"><input class="inp mono" id="vpCode" value="' + U.esc(P.code) + '" maxlength="24" style="letter-spacing:.14em;text-transform:uppercase"><button class="btn ghost" id="vpReCode" aria-label="Neuer Deckname">↻</button></div></div>' +
        (pl.blocked ? '<p class="pill crit mt12" style="white-space:normal">' + U.esc(pl.blocked) + '</p>' : !KY.canPay(pl.cost) ? '<p class="pill crit mt12">Nicht ausreichend: ' + KY.missing(pl.cost).join(', ') + '</p>' : '') +
        '<button class="btn pri lg block mt12" id="vpGo"' + (can ? '' : ' disabled') + '>' + KY.I('check') + 'Vorhaben genehmigen</button></div></section>');
      side.querySelector('#vpCode').oninput = e => { P.code = e.target.value.toUpperCase().replace(/[^A-ZÄÖÜ0-9-]/g, ''); };
      side.querySelector('#vpReCode').onclick = () => { P.code = U.codename(); side.querySelector('#vpCode').value = P.code; };
      side.querySelector('#vpGo').onclick = () => {
        const r = KY.proj.launch(Object.assign({}, P, { code: P.code || undefined }));
        if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return; }
        KY.ui.flashMsg('Vorhaben ' + r.pr.code + ' genehmigt', 'ok');
        this.plan.code = U.codename();
        this.plan.partners = [];
        this.sel = r.pr.id;
        this.setTab('aktiv');
      };
    },

    /* ---------- Abgeschlossen ---------- */
    rDone() {
      const S = KY.S, D = KY.data;
      const b = this.fresh();
      const ok = S.projects.done.filter(p => p.status === 'VOLL' || p.status === 'ERF').length;
      b.innerHTML = '<div class="g g4"><div class="kpi"><span class="lbl">Abgeschlossen</span><span class="v">' + S.projects.done.length + '</span></div><div class="kpi"><span class="lbl">Erfolgreich</span><span class="v">' + ok + '</span></div><div class="kpi"><span class="lbl">Erfolgsquote</span><span class="v">' + (S.projects.done.length ? U.n(ok / S.projects.done.length * 100) : '–') + '<small>%</small></span></div><div class="kpi"><span class="lbl">Eingesetztes Kapital</span><span class="v">' + U.n(U.sum(S.projects.done.map(p => p.cost.kap)), 1) + '<small>Mrd ¤</small></span></div></div>' +
        '<section class="pn mt12"><div class="pn-h"><h3>Archiv der Vorhaben</h3></div><div class="pn-b flush tbl-w">' + (S.projects.done.length ? '<table class="tbl"><thead><tr><th>Kennung</th><th>Deckname</th><th>Typ</th><th>Region</th><th class="num">Prognose</th><th>Ergebnis</th><th></th></tr></thead><tbody>' +
        S.projects.done.map(p => {
          const O = D.outcomes[p.status];
          return '<tr class="click' + (p.id === this.sel ? ' on' : '') + '" data-rep="' + p.id + '"><td class="mono small">' + p.id + '</td><td class="bold">' + p.code + '</td><td>' + D.projectTypes[p.type].name + '</td><td>' + D.regions[p.rid].name + (p.rid2 ? ' ↔ ' + D.regions[p.rid2].name : '') + '</td><td class="num">' + p.p + ' %</td><td>' + (O ? C.pill(O.name, O.cls) : C.pill('Abgebrochen', 'plain')) + '</td><td class="r"><button class="btn sm ghost">Bericht</button></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty"><b>Noch keine abgeschlossenen Vorhaben</b>Ergebnisse und Nachberichte erscheinen hier.</div>') + '</div></section>';
      U.on(b, 'click', '[data-rep]', (e, r) => this.report(r.dataset.rep));
      if (this.sel && S.projects.done.find(p => p.id === this.sel)) { const id = this.sel; this.sel = null; setTimeout(() => this.report(id), 50); }
    },
    report(id) {
      const p = KY.S.projects.done.find(x => x.id === id);
      if (!p) return;
      KY.ui.modal({
        lbl: 'Nachbericht', title: p.code + ' · ' + KY.data.projectTypes[p.type].name, cls: 'wide',
        body: '<pre class="mono small" style="white-space:pre-wrap;line-height:1.7;margin:0;color:var(--fg)">' + U.esc(p.report || 'Vorhaben vorzeitig abgebrochen.') + '</pre><div class="lbl mt16">Einsatzprotokoll</div><div class="mono xs fg2 mt8" style="line-height:1.7">' + p.log.map(l => '<div><span class="mut">' + U.clock(new Date(l.ts)) + '</span> ' + U.esc(l.text) + '</div>').join('') + '</div>',
        actions: [{ label: 'Schließen', cls: 'ghost' }, { label: 'Ähnliches Vorhaben planen', cls: 'pri', fn: () => { KY.ui.go('vorhaben', { plan: { type: p.type, rid: p.rid, rid2: p.rid2 } }); } }],
      });
    },
  };
})();
