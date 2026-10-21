/* KYTHERA · Modul Plenum des Kuratoriums */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;
  const VN = { JA: 'Ja', NEIN: 'Nein', ENTH: 'Enthaltung' };

  KY.mod.kuratorium = {
    mount(el, arg) {
      this.el = el;
      this.tab = arg === 'analyse' ? 'analyse' : 'past';
      el.innerHTML = KY.ui.head({
        crumb: 'Kuratorium', code: 'KU-08', title: 'Plenum',
        sub: 'Neun Sitze, eine Stimme je Sitz. Beschlüsse brauchen die Mehrheit der abgegebenen Stimmen. Seit 1902 tagt das Plenum ohne Unterbrechung.',
        act: '<button class="btn" id="kuProp">' + KY.I('plus') + 'Antrag stellen</button>',
      }) +
        '<div class="g g-main"><section class="pn tick" id="kuOpen"></section><aside class="pn"><div class="pn-h"><h3>Sitze</h3><div class="tools"><span class="meta">Haltung zu Sitz IX</span></div></div><div class="pn-b flush" id="kuSeats"></div></aside></div>' +
        '<div class="tabs mt12" id="kuTabs"></div><div id="kuTab"></div>';
      el.querySelector('#kuProp').onclick = () => this.propose();
      U.on(el, 'click', '[data-vote]', (e, b) => { KY.council.vote(b.dataset.vote); this.rOpen(true); });
      U.on(el, 'click', '[data-lobby]', (e, b) => {
        const r = KY.council.lobby(b.dataset.lobby);
        if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return; }
        KY.ui.flashMsg(b.dataset.lobby + (r.success ? ' folgt Ihrer Position' : ' lehnt ab'), r.success ? 'ok' : 'crit');
        this.rOpen(true); this.rSeats();
      });
      U.on(el, 'click', '[data-member]', (e, b) => this.member(b.dataset.member));
      U.on(el, 'click', '[data-ktab]', (e, b) => { this.tab = b.dataset.ktab; this.rTab(); });
      U.on(el, 'click', '#kuAnalyse', () => this.analyse());
      this.subs = ['council', 'res', 'clearance'].map(ev => KY.bus.on(ev, () => { this.dirty = true; }));
      this.render();
      if (arg && KY.data.council.find(m => m.id === arg)) setTimeout(() => this.member(arg), 60);
    },
    arg(a) { if (a === 'analyse') { this.tab = 'analyse'; this.rTab(); } else if (a && KY.data.council.find(m => m.id === a)) this.member(a); },
    unmount() { this.subs.forEach(f => f()); },
    tick() {
      if (this.dirty) { this.dirty = false; this.render(); return; }
      this.rOpen(false);
    },
    render() { this.rOpen(true); this.rSeats(); this.rTab(); const b = this.el.querySelector('#kuProp'); b.disabled = !KY.council.canPropose(); b.dataset.tip = KY.council.canPropose() ? 'Eigene Beschlussvorlage einbringen (20 Einfluss)' : 'Antragsrecht ab Freigabestufe 4'; },
    rOpen(full) {
      const S = KY.S, K = KY.council, D = KY.data, res = S.council.open;
      const box = this.el.querySelector('#kuOpen');
      if (!res) {
        const last = S.council.past[0];
        U.setHTML(box, '<div class="pn-h"><h3>Plenum</h3><div class="tools">' + C.pill('Sitzungspause', 'plain') + '</div></div><div class="pn-b"><div class="empty" style="padding:20px 0"><b>Keine Vorlage zur Abstimmung</b>Nächste Vorlage in <span class="mono" id="kuNext">' + U.dur(Math.max(0, S.timers.council - S.t)) + '</span></div>' +
          (last ? '<div class="lbl mt12">Letzter Beschluss</div><div class="row mt8" style="align-items:flex-start;gap:16px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div class="mono xs mut">' + last.no + '</div><div class="serif" style="font-size:20px;line-height:1.25">' + U.esc(last.title) + '</div><div class="mt8">' + C.pill(last.result.pass ? 'angenommen' : 'abgelehnt', last.result.pass ? 'ok' : 'crit') + ' <span class="mono small">' + last.result.JA + ' : ' + last.result.NEIN + ' : ' + last.result.ENTH + '</span></div></div><div style="width:260px;max-width:100%">' + C.seats(last.result.votes, { center: last.result.JA + ':' + last.result.NEIN, sub: 'JA : NEIN' }) + '</div></div>' : '') + '</div>');
        return;
      }
      const rem = Math.max(0, res.until - S.t);
      if (!full && box.querySelector('#kuRem')) {
        U.setText(box.querySelector('#kuRem'), U.dur(rem));
        return;
      }
      const t = K.tally(res);
      const prop = res.proposer === 'IX' ? 'Sitz IX (Sie)' : D.council.find(m => m.id === res.proposer).id + ' · Sitz ' + D.council.find(m => m.id === res.proposer).seat;
      const mine = res.mine;
      const members = K.members();
      U.setHTML(box, '<div class="pn-h"><h3>Vorlage ' + res.no + '</h3><div class="tools">' + C.pill('Abstimmung läuft', 'warn', true) + '<span class="mono small" id="kuRem">' + U.dur(rem) + '</span></div></div><div class="pn-b">' +
        '<div class="g g2" style="align-items:start"><div><div class="lbl">Antrag von ' + prop + '</div><div class="serif" style="font-size:25px;line-height:1.2;margin-top:6px">' + U.esc(res.title) + '</div><p class="fg2 small mt8" style="line-height:1.55">' + U.esc(res.text) + '</p>' +
        '<dl class="kv mt12"><dt>Wirkung</dt><dd>' + U.esc(res.effect) + '</dd><dt>Achsen</dt><dd>' + Object.entries(res.imp).filter(([, v]) => v).map(([k, v]) => '<span class="tag">' + D.axisNames[k] + ' ' + U.sgn(v * 10, 0) + '</span>').join(' ') + '</dd></dl>' +
        '<div class="row mt12" style="border:1px solid var(--acc3);background:var(--acc-bg);padding:9px 11px;gap:10px">' + KY.I('pythia') + '<div class="small"><span class="acc bold">PYTHIA empfiehlt: ' + VN[res.py] + '</span> <span class="mut">· Konfidenz ' + res.pyConf + ' %</span></div></div></div>' +
        '<div>' + C.seats(t.votes, { center: t.JA + ':' + t.NEIN, sub: 'PROGNOSE JA : NEIN' }) + '<p class="xs mut c">Prognose von PYTHIA auf Grundlage der bekannten Haltungen. Sitz VIII stimmt per Proxy.</p></div></div>' +
        '<div class="lbl mt16" style="margin-bottom:8px">Ihre Stimme' + (mine ? ' · abgegeben: ' + VN[mine] : '') + '</div><div class="vote-btns"><button class="btn ja' + (mine === 'JA' ? ' on' : '') + '" data-vote="JA">Ja</button><button class="btn nein' + (mine === 'NEIN' ? ' on' : '') + '" data-vote="NEIN">Nein</button><button class="btn enth' + (mine === 'ENTH' ? ' on' : '') + '" data-vote="ENTH">Enthaltung</button></div>' +
        '<div class="lbl mt16" style="margin-bottom:6px">Um Stimmen werben · ' + K.lobbyCost() + ' Einfluss je Versuch</div><div class="tbl-w"><table class="tbl"><thead><tr><th>Sitz</th><th>Prognose</th><th class="num">Haltung</th><th class="num">Chance</th><th></th></tr></thead><tbody>' +
        members.map(m => {
          const v = t.votes[m.id];
          const att = S.council.att[m.id];
          const ch = U.clamp(0.48 + att / 180 + (KY.hasRes('D2') ? 0.15 : 0) + (S.story.ending === 'archon' ? 0.2 : 0), 0.1, 0.95);
          const done = res.lobbied && res.lobbied[m.id] !== undefined;
          const same = mine && v === mine;
          return '<tr><td><span class="serif acc" style="font-size:15px">' + m.seat + '</span> ' + m.id + '</td><td>' + C.pill(VN[v], v === 'JA' ? 'ok' : v === 'NEIN' ? 'crit' : 'plain') + (res.lobby[m.id] ? ' <span class="tag acc">umworben</span>' : '') + '</td><td class="num">' + U.sgn(att, 0) + '</td><td class="num">' + (m.proxy ? '–' : U.pct(ch * 100, 0)) + '</td>' +
            '<td class="r">' + (m.proxy && S.story.ending ? '<span class="xs mut">folgt Ihnen</span>' : done ? '<span class="xs ' + (res.lobbied[m.id] ? 'up' : 'dn') + '">' + (res.lobbied[m.id] ? 'zugesagt' : 'abgelehnt') + '</span>' : same ? '<span class="xs mut">einig</span>' : '<button class="btn sm ghost" data-lobby="' + m.id + '"' + (!mine || mine === 'ENTH' ? ' disabled' : '') + '>Werben</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (!mine ? '<p class="xs mut mt8">Geben Sie zuerst Ihre Stimme ab, um für Ihre Position zu werben. Sitze mit guter Haltung folgen einer früh abgegebenen Stimme eher.</p>' : '') +
        '</div>');
    },
    rSeats() {
      const S = KY.S, D = KY.data;
      U.setHTML(this.el.querySelector('#kuSeats'), D.council.map(m => {
        const att = S.council.att[m.id];
        const gone = m.proxy && S.story.ending === 'frei';
        return '<div class="member' + (m.proxy ? ' proxy' : '') + '" data-member="' + m.id + '" style="cursor:pointer' + (gone ? ';opacity:.4' : '') + '"><div class="sn">' + m.seat + '</div><div style="min-width:0"><div class="bold small" style="letter-spacing:.08em">' + m.id + (gone ? ' · aufgelöst' : '') + '</div><div class="xs mut ell">' + U.esc(m.role) + '</div>' + (m.proxy ? '' : '<div class="mt4" style="width:120px">' + C.meter(att + 100, 200, att > 20 ? 'ok' : att < -10 ? 'crit' : 'warn') + '</div>') + '</div><div class="mono small ' + (att > 0 ? 'up' : att < 0 ? 'dn' : 'mut') + '">' + (m.proxy ? '—' : U.sgn(att, 0)) + '</div></div>';
      }).join('') + '<div class="member" style="background:var(--acc-bg)"><div class="sn" style="border-color:var(--acc)">IX</div><div><div class="bold small" style="letter-spacing:.08em">' + U.esc(S.user.codename) + '</div><div class="xs mut">Sie · Ansehen ' + U.n(S.res.ans) + '</div></div><div></div></div>');
    },
    rTab() {
      const S = KY.S, D = KY.data;
      U.setHTML(this.el.querySelector('#kuTabs'), [['past', 'Beschlüsse', S.council.past.length], ['analyse', 'Abstimmungsanalyse'], ['charta', 'Charta']].map(([k, n, c]) => '<button data-ktab="' + k + '"' + (k === this.tab ? ' class="on"' : '') + '>' + n + (c !== undefined ? '<span class="n">' + c + '</span>' : '') + '</button>').join(''));
      const box = this.el.querySelector('#kuTab');
      if (this.tab === 'past') {
        U.setHTML(box, '<section class="pn"><div class="pn-b flush tbl-w">' + (S.council.past.length ? '<table class="tbl"><thead><tr><th>Nr.</th><th>Vorlage</th><th>Antrag</th><th>PYTHIA</th><th>Ihre Stimme</th><th>Ergebnis</th><th class="num">J : N : E</th></tr></thead><tbody>' +
          S.council.past.map(r => '<tr><td class="mono small">' + r.no + '</td><td>' + U.esc(r.title) + '</td><td class="small">' + (r.proposer === 'IX' ? 'Sie' : r.proposer) + '</td><td>' + VN[r.py] + '</td><td>' + (r.mine ? VN[r.mine] : '<span class="mut">keine</span>') + '</td><td>' + C.pill(r.result.pass ? 'angenommen' : 'abgelehnt', r.result.pass ? 'ok' : 'crit') + '</td><td class="num">' + r.result.JA + ' : ' + r.result.NEIN + ' : ' + r.result.ENTH + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty"><b>Noch keine Beschlüsse in Ihrer Amtszeit</b>Die erste Vorlage folgt in Kürze.</div>') + '</div></section>');
      } else if (this.tab === 'analyse') {
        const done = KY.flag('hydraAudit');
        if (!done) {
          U.setHTML(box, '<section class="pn"><div class="pn-b"><div class="empty"><b>Abstimmungsanalyse</b>Vergleicht das Stimmverhalten aller Sitze seit 1988 mit den Empfehlungen von PYTHIA. Die Analyse wird protokolliert und dem Sitz IV gemeldet.<div class="mt16"><button class="btn pri" id="kuAnalyse">Analyse anfordern · 12 EF</button></div></div></div></section>');
          return;
        }
        const rows = KY.council.analysis();
        const order = D.council.map(m => m.id).concat(['IX']);
        U.setHTML(box, '<section class="pn tick"><div class="pn-h"><h3>Übereinstimmung mit PYTHIA · 1988 bis heute</h3><div class="tools"><span class="meta">1.412 Abstimmungen</span></div></div><div class="pn-b">' +
          order.map(id => {
            const r = rows[id];
            if (!r || !r.n) return '';
            const pct = r.same / r.n * 100;
            const m = D.council.find(x => x.id === id);
            return '<div class="mrow" style="grid-template-columns:130px minmax(0,1fr) 70px"><span class="k">' + (m ? 'Sitz ' + m.seat + ' · ' + id : 'Sitz IX · Sie') + '</span>' + C.meter(pct, 100, pct > 99.9 ? 'crit' : 'prog') + '<span class="v">' + U.n(pct, 1) + ' %</span></div>';
          }).join('') +
          '<p class="small fg2 mt12" style="line-height:1.6">Sitz VIII hat in keiner einzigen Abstimmung seit Februar 1988 von der Empfehlung von PYTHIA abgewichen. Die statistische Wahrscheinlichkeit dafür bei unabhängiger Entscheidung liegt unter 10<sup>−200</sup>.</p></div></section>');
      } else {
        const doc = D.archive.find(a => a.id === 'KY-0001');
        U.setHTML(box, '<section class="pn"><div class="pn-b"><p class="fg2">Die Charta von 1902 regelt Sitze, Stimmen und Verschwiegenheit. Der vollständige Text liegt im Archiv.</p><button class="btn mt12" data-go-arc="1">Charta im Archiv öffnen</button></div></section>');
        box.querySelector('[data-go-arc]').onclick = () => KY.ui.go('archiv', doc.id);
      }
    },
    analyse() {
      if (!KY.pay({ rech: 12 })) { KY.ui.flashMsg('Nicht genügend Rechenkontingent.', 'crit'); return; }
      KY.story.hydraAudit();
      if (KY.audio) KY.audio.play('deep');
      this.tab = 'analyse';
      this.rTab();
    },
    member(id) {
      const S = KY.S, D = KY.data, m = D.council.find(x => x.id === id);
      const att = S.council.att[id];
      const past = S.council.past.filter(r => r.mine && r.result.votes[id]);
      const agree = past.filter(r => r.result.votes[id] === r.mine).length;
      KY.ui.modal({
        lbl: 'Sitz ' + m.seat + ' · seit ' + m.since, title: m.id,
        body: '<div class="row" style="align-items:flex-start;gap:16px"><div class="member' + (m.proxy ? ' proxy' : '') + '" style="border:0;padding:0;grid-template-columns:56px"><div class="sn" style="width:56px;height:56px;font-size:22px">' + m.seat + '</div></div><div style="min-width:0;flex:1"><div class="fg2">' + U.esc(m.role) + '</div><p class="mt8" style="line-height:1.6">' + U.esc(m.bio) + '</p></div></div>' +
          (m.prio ? '<div class="lbl mt16" style="margin-bottom:6px">Prioritäten (geschätzt)</div>' + Object.entries(m.prio).sort((a, b) => b[1] - a[1]).map(([k, v]) => '<div class="mrow"><span class="k">' + D.axisNames[k] + '</span>' + C.meter(v * 100, 60, 'prog') + '<span class="v">' + Math.round(v * 100) + '</span></div>').join('') : '<p class="mono small mut mt16">KEINE DATEN · STIMMABGABE ÜBER PROXY (ANHANG C)</p>') +
          '<dl class="kv mt16"><dt>Haltung zu Ihnen</dt><dd class="mono">' + (m.proxy ? '—' : U.sgn(att, 0)) + '</dd><dt>Übereinstimmung</dt><dd class="mono">' + (past.length ? agree + ' von ' + past.length + ' gemeinsamen Abstimmungen' : 'noch keine Daten') + '</dd><dt>Stil</dt><dd>' + m.style + '</dd></dl>',
        actions: [{ label: 'Schließen', cls: 'ghost' }],
      });
    },
    propose() {
      const S = KY.S, D = KY.data, K = KY.council;
      if (!K.canPropose()) { KY.ui.flashMsg('Antragsrecht erst ab Freigabestufe 4.', 'crit'); return; }
      const tpls = D.resolutions;
      const body = document.createElement('div');
      body.innerHTML = '<p class="fg2 small">Eigene Vorlagen kommen in der nächsten Sitzung zur Abstimmung. Wird Ihr Antrag angenommen, steigt Ihr Ansehen deutlich.</p>' +
        '<div class="fld mt12"><label for="prT">Vorlage</label><select class="inp" id="prT">' + tpls.map(t => '<option value="' + t.id + '">' + U.esc(t.title.replace(/\{\w+\}/g, '…')) + '</option>').join('') + '</select></div>' +
        '<div class="fld mt12" id="prPW"><label for="prP">Parameter</label><select class="inp" id="prP"></select></div><p class="small fg2 mt12" id="prText"></p><div id="prPred" class="mt12"></div>';
      const upd = () => {
        const t = tpls.find(x => x.id === body.querySelector('#prT').value);
        const pw = body.querySelector('#prPW'), ps = body.querySelector('#prP');
        pw.style.display = t.param ? '' : 'none';
        if (t.param && ps.dataset.kind !== t.param) {
          ps.dataset.kind = t.param;
          ps.innerHTML = t.param === 'region' ? D.regionOrder.map(id => '<option value="' + id + '">' + D.regions[id].name + '</option>').join('') : t.param === 'sector' ? Object.keys(D.sectors).map(k => '<option value="' + k + '">' + D.sectors[k] + '</option>').join('') : D.researchTopics.map(x => '<option>' + x + '</option>').join('');
        }
        body.querySelector('#prText').textContent = t.text;
        const fake = K.create(t.id, t.param ? ps.value : null, 'IX');
        S.council.seq--;
        fake.mine = 'JA';
        const tl = K.tally(fake);
        body.querySelector('#prPred').innerHTML = '<div class="row small" style="border:1px solid var(--acc3);background:var(--acc-bg);padding:8px 10px">' + KY.I('pythia') + '<span>PYTHIA-Prognose bei heutiger Lage: <b>' + tl.JA + ' Ja · ' + tl.NEIN + ' Nein · ' + tl.ENTH + ' Enthaltungen</b> · ' + (tl.pass ? 'Annahme wahrscheinlich' : 'Ablehnung wahrscheinlich') + '</span></div>';
      };
      body.querySelector('#prT').onchange = upd;
      body.querySelector('#prP').onchange = upd;
      upd();
      KY.ui.modal({
        lbl: 'Antrag Sitz IX', title: 'Beschlussvorlage einbringen', body,
        actions: [{ label: 'Abbrechen', cls: 'ghost' }, { label: 'Einreichen · ' + K.proposalCost + ' Einfluss', cls: 'pri', fn: () => {
          const t = body.querySelector('#prT').value, p = body.querySelector('#prP').value;
          const tpl = tpls.find(x => x.id === t);
          const r = K.propose(t, tpl.param ? p : null);
          if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return false; }
          KY.ui.flashMsg('Antrag eingereicht', 'ok');
          this.render();
        } }],
      });
    },
  };
})();
