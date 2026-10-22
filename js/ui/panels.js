/* KYTHERA · MANDAT · Bereiche der Seitenleiste */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const P = KY.P, A = KY.A, ui = KY.ui;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const stat = (k, v, s, cls) => `<div class="stat ${cls || ''}"><div class="k">${k}</div><div class="v">${v}</div>${s ? '<div class="s">' + s + '</div>' : ''}</div>`;

  function projRow(p) {
    const Ac = D.ACT[p.act];
    const prog = p.phase === 'bau' || p.phase === 'laufend' ? `<div class="prog"><i style="width:${(p.prog * 100).toFixed(1)}%"></i></div>` : '';
    const inc = p.incidents.length ? ` · <span class="bad">${p.incidents.length} Vorfall${p.incidents.length > 1 ? 'e' : ''}</span>` : '';
    return `<div class="li" data-a="proj" data-id="${p.id}"><div class="ic-c">${ic(Ac.icon, 17)}</div><div class="m"><div class="t ell">${esc(p.name)}</div><div class="d">${ui.phaseChip(p)} <span>${p.n >= 0 ? esc(SIM.nName(p.n)) : 'Weltweit'}</span>${inc}</div>${prog}</div><div class="r">${U.money(p.cost)}<div class="dim" style="font-size:11px">${p.phase === 'antrag' ? 'Entscheid ' + U.dateStr(p.decideAt, true) : p.phase === 'bau' || p.phase === 'laufend' ? 'fertig ca. ' + U.dateStr(SIM.S.day + Math.round((1 - p.prog) * p.days), true) : ''}</div></div></div>`;
  }
  ui.projRow = projRow;
  function incRow(i) {
    const S = SIM.S;
    const open = i.status === 'offen';
    const left = i.deadline - S.day;
    const st = open ? `<span class="chip ${left < 0 ? 'red' : 'amber'}">${left < 0 ? 'Frist verstrichen' : left === 0 ? 'Frist endet heute' : 'noch ' + U.days(left)}</span>` : i.versaeumt ? '<span class="stamp">Versäumnis</span>' : '<span class="chip green">entschieden</span>';
    return `<div class="li" data-a="inc" data-id="${i.id}"><div class="ic-c" style="${open ? 'background:rgba(208,59,59,.16);color:#ff9f94' : ''}">${ic(i.icon, 17)}</div><div class="m"><div class="t ell">${esc(i.name)} · ${esc(i.projName)}</div><div class="d ell">${esc(i.title)}</div><div class="d" style="margin-top:4px">${st} <span class="chip ghost">Stufe ${i.sev}</span>${i.dead ? ' <span class="chip red">' + U.n(i.deadNow) + ' Tote</span>' : ''}</div></div><div class="r">${U.dateStr(i.day, true)}</div></div>`;
  }
  ui.incRow = incRow;

  /* ================= LAGE ================= */
  P.lage = {
    title: 'Lagezentrum', kicker: 'Nur für die Mandatsperson',
    sub: () => U.dateStr(SIM.S.day) + ' · Mandatsjahr ' + SIM.S.year.n,
    render() {
      const S = SIM.S, g = S.g;
      const tot = KY.projects.totals();
      const openInc = KY.incidents.open();
      const act = KY.events.active().filter(e => e.sev >= 2).slice(0, 5);
      const tens = Object.keys(S.rel).filter(k => S.rel[k].state === 'krise' || S.rel[k].state === 'eiszeit').slice(0, 4);
      const blocks = S.cities.filter(c => c.protest && c.protest.stage >= 2);
      const rej = S.projects.filter(p => p.phase === 'abgelehnt' && S.day - p.rejectedAt >= 120).slice(0, 3);
      let h = `<div class="grid2">
        ${stat('Liquides Vermögen', U.money(KY.finance.avail()), 'Zusagen ' + U.money(KY.finance.commitments()))}
        ${stat('Druck', Math.round(g.pressure) + ' %', g.pressure > 60 ? '<span class="bad">kritisch</span>' : g.pressure > 35 ? '<span class="warnc">erhöht</span>' : 'ruhig')}
        ${stat('Leben gerettet', U.count(Math.round(g.lives)), 'geschätzt, kumuliert')}
        ${stat('Todesopfer', U.n(g.deaths), 'in Ihrer Verantwortung')}
        ${stat('Vorhaben', tot.count + ' aktiv', tot.building + ' im Bau oder Verfahren')}
        ${stat('Haltung der Welt', U.sgn(SIM.worldOp(), 1), U.pct(SIM.worldAware(), 0) + ' wissen von Ihnen')}
      </div>`;
      const todo = [];
      if (g.hearing) todo.push(`<div class="card alert click" data-a="hearing"><div class="row">${ic('gavel', 18)}<div><b>Anhörung vor dem Kuratorium</b><div class="dim" style="font-size:12px">Das Kuratorium erwartet Ihre Antworten.</div></div></div></div>`);
      openInc.forEach(i => todo.push(`<div class="card alert click" data-a="inc" data-id="${i.id}"><div class="row top">${ic('siren', 18)}<div style="flex:1;min-width:0"><b>${esc(i.name)} · ${esc(i.projName)}</b><div class="dim ell" style="font-size:12px">${esc(i.title)}</div></div><span class="deadline">${i.deadline - S.day < 0 ? 'überfällig' : 'Frist ' + U.days(i.deadline - S.day)}</span></div></div>`));
      blocks.forEach(c => { const p = KY.projects.byId(c.protest.proj); todo.push(`<div class="card click" data-a="city" data-id="${c.id}"><div class="row">${ic('protest', 18)}<div><b>${KY.nations.PROTEST_STAGES[c.protest.stage]} in ${esc(SIM.cName(c.id))}</b><div class="dim" style="font-size:12px">${p ? esc(p.name) : ''} · ${U.count(c.protest.size)} Menschen</div></div></div></div>`); });
      rej.forEach(p => todo.push(`<div class="card click" data-a="proj" data-id="${p.id}"><div class="row">${ic('refresh', 18)}<div><b>Neuer Antrag möglich</b><div class="dim" style="font-size:12px">${esc(p.name)}</div></div></div></div>`));
      (S.forecasts || []).filter(f => f.sev >= 3 && !f.prepared).forEach(f => todo.push(`<div class="card goldb"><div class="row">${ic('sat', 18)}<div style="flex:1"><b>Vorhersage: ${D.EVENTS[f.type].n} in ${f.day - S.day} Tagen</b><div class="dim" style="font-size:12px">${esc(SIM.cName(f.city))} · Stufe ${f.sev}</div></div><button class="btn sm" data-a="prepare" data-c="${f.city}" data-d="${f.day}">Vorsorgen</button></div></div>`));
      h += `<div class="h3">${ic('check', 13)} Entscheidungen<span class="r dim">${todo.length || 'keine'}</span></div>` + (todo.length ? todo.join('') : '<div class="empty">Nichts wartet auf Ihre Entscheidung.</div>');
      h += `<div class="h3">${ic('alert', 13)} Akute Lage</div>`;
      if (!act.length && !tens.length) h += '<div class="empty">Keine größeren Katastrophen oder Krisen.</div>';
      act.forEach(ev => {
        const helped = Object.keys(ev.helped).length;
        h += `<div class="card"><div class="row top"><div class="ic-c" style="color:var(--serious)">${ic(D.EVENTS[ev.type].icon, 20)}</div><div style="flex:1;min-width:0"><b class="ell" style="display:block">${esc(ev.name)}</b><div class="dim" style="font-size:12px">Stufe ${ev.sev} · ${U.n(ev.deadNow)} Tote${ev.displaced ? ' · ' + U.count(ev.displaced) + ' obdachlos' : ''}${ev.saved ? ' · <span class="good">' + U.n(Math.round(ev.saved)) + ' gerettet</span>' : ''}</div></div></div>
          <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">${['LUFTBRUECKE', 'LAZARETT', 'WIEDERAUFBAU'].map(id => ev.helped[id] ? `<span class="chip green">${ic('check', 12)} ${D.ACT[id].name}</span>` : `<button class="btn xs" data-a="order" data-id="${id}" data-pl='${JSON.stringify({ ev: ev.id })}'>${ic(D.ACT[id].icon, 13)} ${D.ACT[id].name}</button>`).join('')}<button class="btn xs ghost" data-a="ev" data-id="${ev.id}">${ic('pin', 13)}</button></div>${!helped && ev.phase !== 'vorbei' ? '' : ''}</div>`;
      });
      tens.forEach(k => {
        const [a, b] = k.split(':').map(Number); const R = S.rel[k];
        h += `<div class="card"><div class="row"><div class="ic-c" style="color:var(--crit)">${ic('alert', 18)}</div><div style="flex:1"><b>${SIM.REL_NAMES[R.state]}: ${esc(SIM.nName(a))} – ${esc(SIM.nName(b))}</b><div class="dim" style="font-size:12px">Beziehung ${Math.round(R.v)} · seit ${U.dateStr(R.since, true)}</div></div><button class="btn sm" data-a="order" data-id="VERMITTLUNG" data-pl='${JSON.stringify({ n: a, n2: b })}'>Vermitteln</button></div></div>`;
      });
      h += `<div class="h3">${ic('news', 13)} Neueste Meldungen<span class="r"><button class="btn xs ghost" data-a="panel" data-p="medien">Alle</button></span></div><div>` + S.news.slice(0, 6).map(KY.mediaUi.artRow).join('') + '</div>';
      if (g.pressHist.length > 2) h += `<div class="h3">${ic('pulse', 13)} Druck im Verlauf</div>` + KY.chart.line(KY.chart.monthly(g.pressHist, S.day), { h: 90, min: 0, max: 100, color: '#ec835a', fmt: v => Math.round(v) + ' %' });
      return h;
    },
  };
  A.hearing = () => KY.crisis.hearing();
  A.prepare = b => ui.msgAct('prepare', { city: +b.dataset.c, day: +b.dataset.d });

  /* ================= HANDELN ================= */
  P.handeln = {
    title: 'Handeln', kicker: 'Handlungskatalog',
    sub: () => D.ACTIONS.length + ' Handlungen in ' + D.CATS.length + ' Bereichen · Tasten wählen den Bereich',
    catKey(id) { ui.st.filter.handeln = id; ui.renderPanel(true); return true; },
    render() {
      const S = SIM.S;
      const cur = ui.st.filter.handeln || 'infra';
      const cat = D.CATS.find(c => c.id === cur);
      let h = '<div class="cats">' + D.CATS.map(c => `<button class="cat ${c.id === cur ? 'on' : ''}" data-a="cat" data-v="${c.id}">${ic(c.icon, 18)}<span class="n">${esc(c.n)}</span><span class="kbd">${c.key}</span></button>`).join('') + '</div>';
      h += `<div class="note" style="margin:-4px 0 12px">${esc(cat.text)}.</div>`;
      D.ACTIONS.filter(a => a.cat === cur).forEach(a => {
        let lock = '';
        if (a.requiresTech && !(S.g.unlock && S.g.unlock[a.id])) lock = 'Erfordert Forschung: ' + D.TECH_BY[a.requiresTech].n;
        if (a.requiresSite && !S.projects.some(p => p.act === a.requiresSite && p.phase === 'betrieb')) lock = 'Erfordert einen betriebsbereiten Raumhafen';
        const placeTxt = { 'city': 'Stadt', 'city-big': 'Großstadt', 'city-coast': 'Küstenstadt', 'nation': 'Staat', 'two-nations': 'Zwei Staaten', 'land': 'Standort an Land', 'land-or-sea': 'Land oder Küstengewässer', 'land-high': 'Gebirge', 'land-water': 'Küste oder Fluss', 'river': 'Fluss', 'line-land': 'Trasse zwischen Städten', 'line-sea': 'Querung einer Meerenge', 'line-sea-long': 'Kabel zwischen Küstenstädten', 'area-land': 'Gebiet an Land', 'area-sea': 'Meeresgebiet', 'area-desert': 'Wüstengebiet', 'coast-equator': 'Küste am Äquator', 'global': 'weltweit', 'event': 'Laufende Katastrophe', 'front': 'Tarnung' }[a.place] || '';
        const used = S.projects.filter(p => p.act === a.id).length;
        h += `<div class="act ${lock ? 'locked' : ''}" data-a="${a.research ? 'panel' : 'order'}" data-p="forschung" data-id="${a.id}"><div class="ico">${ic(a.icon, 20)}</div><div class="m"><div class="t">${esc(a.name)}${lock ? ' ' + ic('lock', 13) : ''}</div><div class="d">${esc(a.short)}</div><div class="f"><span class="chip ghost">${ic('pin', 11)} ${placeTxt}</span>${a.approval ? '<span class="chip amber">Genehmigung</span>' : ''}${a.vis >= 7 ? '<span class="chip red">sehr sichtbar</span>' : a.vis >= 4 ? '<span class="chip">sichtbar</span>' : a.vis > 0 ? '<span class="chip blue">diskret</span>' : ''}${used ? '<span class="chip gold">' + used + '× angeordnet</span>' : ''}</div>${lock ? '<div class="d warnc" style="margin-top:6px">' + esc(lock) + '</div>' : ''}</div></div>`;
      });
      return h;
    },
  };
  A.cat = b => { ui.st.filter.handeln = b.dataset.v; ui.renderPanel(true); };

  /* ================= VORHABEN ================= */
  P.vorhaben = {
    title: 'Vorhaben', kicker: 'Portfolio',
    tabs: () => {
      const S = SIM.S;
      return [{ id: 'aktiv', n: 'Laufend', badge: S.projects.filter(p => KY.projects.ACTIVE[p.phase]).length || '' }, { id: 'fertig', n: 'Abgeschlossen' }, { id: 'aus', n: 'Gescheitert und beendet' }];
    },
    sub: () => { const t = KY.projects.totals(); return 'Investiert ' + U.money(t.invested) + ' · Einnahmen ' + U.money(t.income) + ' pro Jahr'; },
    render(tab) {
      const S = SIM.S;
      tab = tab || 'aktiv';
      const t = KY.projects.totals();
      let h = `<div class="grid4">${stat('Arbeitsplätze', U.count(t.jobs))}${stat('Saubere Leistung', U.n(t.power, 1) + ' GW')}${stat('CO₂ vermieden', U.n(t.co2, 1) + ' Mt/a')}${stat('Wohnungen', U.count(t.homes))}</div><div style="height:12px"></div>`;
      const set = { aktiv: p => KY.projects.ACTIVE[p.phase], fertig: p => p.phase === 'abgeschlossen' || p.phase === 'uebergeben', aus: p => ['abgelehnt', 'stillgelegt', 'aufgegeben'].indexOf(p.phase) >= 0 }[tab];
      const list = S.projects.filter(set).slice().reverse();
      if (!list.length) return h + `<div class="empty">${tab === 'aktiv' ? 'Noch keine Vorhaben. Öffnen Sie den Handlungskatalog mit <span class="kbd">A</span>.' : 'Keine Einträge.'}</div>`;
      return h + '<div class="list">' + list.map(projRow).join('') + '</div>';
    },
  };

  /* ================= VERANTWORTUNG ================= */
  P.verantwortung = {
    title: 'Verantwortung', kicker: 'Verantwortungsregister KY-M/2027/05',
    tabs: () => [{ id: 'bilanz', n: 'Bilanz' }, { id: 'register', n: 'Register', badge: KY.incidents.open().length || '' }, { id: 'grundsaetze', n: 'Grundsätze' }, { id: 'berichte', n: 'Jahresberichte' }],
    sub: () => 'Was Ihre Entscheidungen bewirkt haben – im Guten wie im Schlechten',
    render(tab) {
      const S = SIM.S, g = S.g;
      tab = tab || 'bilanz';
      if (tab === 'register') {
        if (!S.incidents.length) return '<div class="empty">Das Register ist leer. Bisher ist bei Ihren Vorhaben nichts geschehen.</div>';
        const open = S.incidents.filter(i => i.status === 'offen'), rest = S.incidents.filter(i => i.status !== 'offen');
        return (open.length ? `<div class="h3">Offen<span class="r dim">${open.length}</span></div><div class="list">${open.map(incRow).join('')}</div>` : '') + `<div class="h3">Entschieden<span class="r dim">${rest.length}</span></div><div class="list">${rest.map(incRow).join('') || '<div class="empty">—</div>'}</div>`;
      }
      if (tab === 'grundsaetze') {
        const pr = S.contracts.vals.principles || [];
        const K8 = D.CONTRACTS.find(c => c.id === 'K08');
        const ch = K8 ? K8.fields[0].choices : [];
        let h = '<div class="note" style="margin-bottom:12px">Ihre freiwilligen Grundsätze aus der Ethischen Grundsatzerklärung (KY-M/2027/08). Ein Bruch ist möglich, wird aber protokolliert und kostet Vertrauen.</div>';
        if (!pr.length) h += '<div class="empty">Sie haben sich auf keine Grundsätze verpflichtet.</div>';
        pr.forEach(id => {
          const c = ch.find(x => x.v === id) || { l: id, note: '' };
          const br = g.breaks.filter(b => b.id === id);
          h += `<div class="card ${br.length ? 'alert' : ''}"><div class="row sb"><b>${esc(c.l)}</b>${br.length ? '<span class="chip red">' + br.length + '× gebrochen</span>' : '<span class="chip green">eingehalten</span>'}</div><div class="dim" style="font-size:12px;margin-top:3px">${esc(c.note || '')}</div>${br.map(b => '<div style="font-size:12px;margin-top:5px">' + ic('x', 12) + ' ' + U.dateStr(b.day, true) + (b.projName ? ' · ' + esc(b.projName) : '') + '</div>').join('')}</div>`;
        });
        if (g.auflagen && S.day < g.auflagen.until) h += `<div class="h3">Auflagen</div><div class="warnbox">${ic('alert', 16)}<div>${g.auflagen.kind === 'safety' ? 'Nur höchster Sicherheitsstandard' : '15 % des Vermögens gesperrt'} bis ${U.dateStr(g.auflagen.until, true)}${g.auflagen.self ? ' (Selbstverpflichtung)' : ''}.</div></div>`;
        return h;
      }
      if (tab === 'berichte') {
        const R = S.reports || [];
        if (!R.length) return `<div class="empty">Der erste Jahresbericht ist am ${U.dateStr(365, true)} fällig.</div>`;
        return R.slice().reverse().map(r => `<div class="card click" data-a="report" data-y="${r.year}"><div class="row sb"><b>Jahresbericht ${r.year}</b><span class="chip ${r.score > 1.5 ? 'green' : r.score > 0 ? 'gold' : 'red'}">${esc(r.grade)}</span></div><div class="dim" style="font-size:12px;margin-top:4px">${U.n(r.lives)} Leben gerettet · ${U.n(r.deaths)} Todesopfer · ${r.done} Vorhaben fertig · ${r.versaeumt} Versäumnisse</div></div>`).join('');
      }
      const ratio = g.deaths > 0 ? g.lives / g.deaths : null;
      const p = g.pressure;
      let h = `<div class="grid2">
        <div class="stat big"><div class="k">Leben gerettet</div><div class="v good">${U.count(Math.round(g.lives))}</div><div class="s">davon ${U.count(Math.round(g.livesRelief))} durch Krisenhilfe</div></div>
        <div class="stat big"><div class="k">Todesopfer</div><div class="v ${g.deaths ? 'bad' : ''}">${U.n(g.deaths)}</div><div class="s">${U.n(g.injured)} Verletzte · ${U.count(g.displaced)} Umsiedlungen</div></div>
      </div>
      <div class="note" style="margin:10px 0 0">${ratio ? 'Auf jedes Todesopfer kommen rechnerisch ' + U.n(ratio, ratio < 10 ? 1 : 0) + ' gerettete Leben. Keine Rechnung macht ein Opfer ungeschehen.' : 'Bei Ihren Vorhaben ist bisher niemand ums Leben gekommen.'}</div>
      <div class="h3">Druck auf die Mandatsperson</div>
      <div class="card"><div class="row sb"><b style="font-size:20px" class="${p > 60 ? 'bad' : p > 35 ? 'warnc' : ''}">${Math.round(p)} %</b><span class="dim" style="font-size:12px">${p > 80 ? 'Krisenmodus: das Kuratorium beobachtet jede Ihrer Entscheidungen' : p > 60 ? 'Hoher Druck: Medien und Kuratorium erwarten Antworten' : p > 35 ? 'Spürbarer Druck' : 'Ruhige Lage'}</span></div>${ui.meter(p, p > 60 ? 'var(--crit)' : p > 35 ? 'var(--warn)' : 'var(--good)')}
      <div style="margin-top:10px">${pressureParts().map(x => `<div class="kv"><span>${x[0]}</span><span>${x[1]}</span></div>`).join('')}</div></div>
      <div class="h3">Vertrauen des Kuratoriums</div>
      <div class="card"><div class="row sb"><b style="font-size:20px">${Math.round(g.trust)} %</b><span class="dim" style="font-size:12px">${g.trust < 25 ? 'Auflagen drohen' : g.trust < 45 ? 'Das Kuratorium ist besorgt' : g.trust > 75 ? 'Großes Vertrauen' : 'Stabil'}</span></div>${ui.meter(g.trust, g.trust < 25 ? 'var(--crit)' : 'var(--gold)')}
      <div class="kv" style="margin-top:8px"><span>Versäumnisse nach Krisenprotokoll</span><span>${g.versaeumt}</span></div><div class="kv"><span>Grundsatzbrüche</span><span>${g.breaks.length}</span></div><div class="kv"><span>Anhörungen</span><span>${g.hearings.length}</span></div></div>`;
      if (g.pressHist.length > 2) h += `<div class="h3">Verlauf des Drucks</div>` + KY.chart.line(KY.chart.monthly(g.pressHist, S.day), { h: 100, min: 0, max: 100, color: '#ec835a', fmt: v => Math.round(v) + ' %' });
      const mem = S.incidents.filter(i => i.dead > 0);
      if (mem.length) h += `<div class="h3">${ic('candle', 13)} In Erinnerung</div>` + mem.slice(0, 12).map(i => `<div class="memorial" style="padding:4px 0">${ic('candle', 14)} ${U.n(i.dead)} Menschen · ${esc(i.name)} bei ${esc(i.projName)} · ${U.dateStr(i.day, true)}</div>`).join('');
      return h;
    },
  };
  function pressureParts() {
    const S = SIM.S, g = S.g;
    const open = KY.incidents.open();
    const prot = S.cities.filter(c => c.protest).length;
    return [
      ['Offene Vorfälle', open.length ? open.length + (open.some(i => S.day > i.deadline) ? ' · Frist überschritten' : '') : 'keine'],
      ['Proteste gegen Vorhaben', prot || 'keine'],
      ['Negative Berichterstattung', (g.mediaNeg || 0) > 30 ? 'stark' : (g.mediaNeg || 0) > 10 ? 'spürbar' : 'gering'],
      ['Grundsatzbrüche (180 Tage)', g.breaks.filter(b => S.day - b.day < 180).length],
      ['Enttarnungsgrad', g.exposed ? 'öffentlich' : Math.round(g.exposure) + ' %'],
    ];
  }
  A.report = b => { const r = (SIM.S.reports || []).find(x => x.year === +b.dataset.y); if (r) KY.crisis.report(r, true); };

  /* ================= STAATEN ================= */
  const COLS = [
    { k: 'name', n: 'Staat', v: id => SIM.W.nations[id].short, s: 1 },
    { k: 'pop', n: 'Einwohner', v: id => SIM.S.nations[id].pop, f: v => U.people(v), r: 1 },
    { k: 'gdppc', n: 'BIP/Kopf', v: id => SIM.S.nations[id].gdpPc, f: v => '¤ ' + U.n(v), r: 1 },
    { k: 'growth', n: 'Wachstum', v: id => SIM.S.nations[id].growth, f: v => U.sgn(v, 1, ' %'), r: 1 },
    { k: 'happy', n: 'Zufried.', v: id => SIM.S.nations[id].happy, f: v => Math.round(v), r: 1 },
    { k: 'unrest', n: 'Unruhe', v: id => SIM.S.nations[id].unrest, f: v => Math.round(v), r: 1 },
    { k: 'op', n: 'Haltung', v: id => SIM.S.nations[id].op, f: (v, id) => SIM.S.nations[id].aware < 5 ? '<span class="mute">—</span>' : `<span class="${v > 3 ? 'good' : v < -3 ? 'bad' : ''}">${U.sgn(v, 0)}</span>`, r: 1 },
    { k: 'aware', n: 'Bekannt', v: id => SIM.S.nations[id].aware, f: v => Math.round(v) + ' %', r: 1 },
    { k: 'access', n: 'Zugang', v: id => SIM.S.nations[id].access, f: v => Math.round(v), r: 1 },
    { k: 'gov', n: 'Regierung', v: id => SIM.S.nations[id].gov.lean, f: (v, id) => `<span class="chip" style="background:${D.PARTY_COLOR[v]}33;color:#e6e6e6">${D.PARTY_NAME[v]}</span>` },
    { k: 'elect', n: 'Wahl', v: id => SIM.S.nations[id].gov.next, f: v => U.days(v - SIM.S.day), r: 1 },
  ];
  P.staaten = {
    title: 'Staaten', kicker: 'Weltlage', wide: true,
    tabs: [{ id: 'tab', n: 'Übersicht' }, { id: 'rel', n: 'Beziehungen' }, { id: 'wahl', n: 'Wahlen' }],
    sub: () => SIM.W.nations.length + ' Staaten · ' + U.people(U.sum(SIM.S.nations.map(n => n.pop))) + ' Menschen',
    render(tab) {
      const S = SIM.S, W = SIM.W;
      tab = tab || 'tab';
      if (tab === 'rel') {
        const keys = Object.keys(S.rel).filter(k => S.rel[k].state !== 'normal').sort((a, b) => S.rel[a].v - S.rel[b].v);
        if (!keys.length) return '<div class="empty">Keine auffälligen Beziehungen.</div>';
        return '<table class="tbl"><tr><th>Staaten</th><th>Zustand</th><th class="r">Wert</th><th class="r">Seit</th><th></th></tr>' + keys.map(k => {
          const [a, b] = k.split(':').map(Number), R = S.rel[k];
          const col = R.state === 'partner' ? 'green' : R.state === 'angespannt' ? 'amber' : 'red';
          return `<tr><td>${KY.flag(W.nations[a], 14)} ${esc(W.nations[a].short)} – ${KY.flag(W.nations[b], 14)} ${esc(W.nations[b].short)}</td><td><span class="chip ${col}">${SIM.REL_NAMES[R.state]}</span>${R.trade ? ' <span class="chip blue">Handelsabkommen</span>' : ''}</td><td class="r">${Math.round(R.v)}</td><td class="r">${U.dateStr(R.since, true)}</td><td class="r">${R.state !== 'partner' ? `<button class="btn xs" data-a="order" data-id="VERMITTLUNG" data-pl='${JSON.stringify({ n: a, n2: b })}'>Vermitteln</button>` : ''}</td></tr>`;
        }).join('') + '</table>';
      }
      if (tab === 'wahl') {
        const up = S.nations.map((n, id) => ({ id, n })).sort((a, b) => a.n.gov.next - b.n.gov.next);
        let h = '<div class="h3">Anstehende Wahlen</div><table class="tbl"><tr><th>Staat</th><th>Regierung</th><th>Zustimmung</th><th class="r">Termin</th></tr>' + up.slice(0, 12).map(x => `<tr class="click" data-a="nation" data-id="${x.id}"><td>${KY.flag(W.nations[x.id], 14)} ${esc(W.nations[x.id].short)}</td><td>${esc(x.n.gov.leader)} · ${esc(x.n.gov.party)}</td><td>${Math.round(x.n.gov.approval)} %</td><td class="r">${U.dateStr(x.n.gov.next, true)}</td></tr>`).join('') + '</table>';
        const past = [];
        S.nations.forEach((n, id) => n.elections.forEach(e => past.push(Object.assign({ id }, e))));
        past.sort((a, b) => b.day - a.day);
        h += '<div class="h3">Ergebnisse</div>' + (past.length ? '<table class="tbl"><tr><th>Datum</th><th>Staat</th><th>Sieger</th><th class="r">Ergebnis</th></tr>' + past.slice(0, 20).map(e => `<tr><td>${U.dateStr(e.day, true)}</td><td>${esc(W.nations[e.id].short)}</td><td>${esc(e.party)} <span class="chip" style="background:${D.PARTY_COLOR[e.lean]}33">${D.PARTY_NAME[e.lean]}</span>${e.re ? '' : ' <span class="chip gold">Wechsel</span>'}</td><td class="r">${U.pct(e.pct, 1)}</td></tr>`).join('') + '</table>' : '<div class="empty">Noch keine Wahlen seit Beginn des Mandats.</div>');
        return h;
      }
      const so = ui.st.sort.staaten || { k: 'pop', d: -1 };
      const col = COLS.find(c => c.k === so.k) || COLS[1];
      const ids = W.nations.map(n => n.id).sort((a, b) => { const va = col.v(a), vb = col.v(b); return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * so.d; });
      return '<table class="tbl"><tr>' + COLS.map(c => `<th class="${c.r ? 'r' : ''} ${c.k === so.k ? 'on' : ''}" data-a="sort" data-p="staaten" data-v="${c.k}">${c.n}${c.k === so.k ? (so.d > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>' +
        ids.map(id => `<tr class="click" data-a="nation" data-id="${id}">` + COLS.map(c => { const v = c.v(id); return `<td class="${c.r ? 'r' : ''}">${c.k === 'name' ? KY.flag(W.nations[id], 14) + ' ' + esc(v) + (S.nations[id].crisis ? ' <span class="chip red" style="height:18px">' + esc(D.CRISES[S.nations[id].crisis.k] ? D.CRISES[S.nations[id].crisis.k].n : '') + '</span>' : '') : c.f ? c.f(v, id) : esc(v)}</td>`; }).join('') + '</tr>').join('') + '</table>';
    },
  };
  A.sort = b => { const p = b.dataset.p, k = b.dataset.v; const so = ui.st.sort[p] || {}; ui.st.sort[p] = { k, d: so.k === k ? -so.d : (k === 'name' ? 1 : -1) }; ui.renderPanel(true); };

  /* ================= FINANZEN ================= */
  P.finanzen = {
    title: 'Finanzen', kicker: 'Treuhand · ' + 'Vermögensverwaltung',
    sub: () => { const tr = SIM.adv('trustee'); return tr.house + ' · Strategie ' + ({ kons: 'konservativ', bal: 'ausgewogen', off: 'offensiv' }[SIM.contract('strategy')] || ''); },
    render() {
      const S = SIM.S, f = S.fin;
      const t = KY.projects.totals();
      const frozen = S.day < f.frozenUntil ? f.frozen : 0;
      let h = `<div class="grid2">${stat('Liquides Vermögen', U.money(KY.finance.avail()), frozen ? U.money(frozen) + ' gesperrt bis ' + U.dateStr(f.frozenUntil, true) : 'verfügbar')}${stat('Entschädigungsfonds', U.money(f.fund), 'Krisenprotokoll KY-M/2027/06')}${stat('Offene Zusagen', U.money(KY.finance.commitments()), 'laufende Bauvorhaben')}${stat('Einnahmen aus Vorhaben', U.money(t.income) + '/Jahr', 'Unterhalt ' + U.money(t.upkeep) + '/Jahr')}</div>`;
      if (f.hist.length > 2) h += `<div class="h3">Vermögen im Verlauf</div>` + KY.chart.line(f.hist.map(x => ({ y: x.c, xl: U.monthStr(x.d), lbl: U.monthStr(x.d) })), { h: 130, color: '#c9a24f', fmt: v => U.money(v) });
      const y = f.y;
      h += `<div class="h3">Laufendes Jahr</div><div class="card"><div class="kv"><span>Kapitalerträge</span><span class="${y.ret >= 0 ? 'good' : 'bad'}">${U.sgn(y.ret, 1)} Mrd.</span></div><div class="kv"><span>Einnahmen aus Vorhaben</span><span>${U.money(y.inc)}</span></div><div class="kv"><span>Ausgaben</span><span>${U.money(y.spent)}</span></div><div class="kv"><span>Gebühren (Treuhand und Rechtsordnung)</span><span>${U.money(y.fees)}</span></div><div class="kv"><span>Entschädigungen</span><span>${U.money(y.comp)}</span></div></div>`;
      if (f.ly) h += `<div class="note" style="margin-top:8px">Vorjahr: Erträge ${U.sgn(f.ly.ret, 1)} Mrd. · Ausgaben ${U.money(f.ly.spent)}.</div>`;
      const bonds = S.projects.filter(p => p.bond && p.phase === 'betrieb');
      if (bonds.length) h += `<div class="h3">Staatsanleihen</div>` + bonds.map(p => `<div class="kv"><span>${esc(SIM.nName(p.n))}</span><span>${U.money(p.bond.amount)} · ${U.n(p.bond.rate, 1)} %</span></div>`).join('');
      h += `<div class="h3">Buchungen</div>` + ((f.log || []).slice(0, 40).map(l => `<div class="kv"><span>${U.dateStr(l.day, true)} · ${esc(l.t)}</span><span class="${l.v < 0 ? '' : 'good'}">${l.v < 0 ? '−' : '+'}${U.money(Math.abs(l.v))}</span></div>`).join('') || '<div class="empty">Noch keine Buchungen.</div>');
      return h;
    },
  };

  /* ================= TARNUNG ================= */
  P.tarnung = {
    title: 'Tarnung', kicker: 'Geheimhaltung KY-M/2027/02',
    sub: () => SIM.S.g.exposed ? 'Öffentliche Phase: Ihr Deckname ist bekannt, Ihr Name nicht.' : 'Strukturen, Spuren und Recherchen',
    render() {
      const S = SIM.S, g = S.g;
      const e = g.exposure;
      let h = `<div class="card ${g.exposed ? 'alert' : e > 70 ? 'alert' : ''}"><div class="row sb"><div><div class="lbl">Enttarnungsgrad</div><div style="font:600 26px var(--sans)">${g.exposed ? 'Öffentlich' : Math.round(e) + ' %'}</div></div><div style="text-align:right;font-size:12px" class="dim">${g.exposed ? 'seit ' + U.dateStr(g.exposedAt, true) : e > 70 ? 'Die Enttarnung steht bevor' : e > 40 ? 'Journalisten vermuten eine einzelne Quelle' : 'Niemand ahnt etwas'}</div></div>${ui.meter(e, 'var(--serious)')}</div>`;
      h += `<div class="row" style="gap:8px;margin:12px 0;flex-wrap:wrap"><button class="btn sm" data-a="newFront">${ic('plus', 14)} Neue Struktur</button><button class="btn sm" data-a="order" data-id="TARN_KETTE">${ic('chain', 14)} Treuhandkette</button><button class="btn sm" data-a="order" data-id="TARN_GESICHT" ${g.face ? 'disabled' : ''}>${ic('face', 14)} Öffentliches Gesicht</button></div>`;
      if (S.day < g.chainUntil) h += `<div class="okbox" style="margin-bottom:10px">${ic('chain', 15)}<div>Verlängerte Treuhandkette aktiv bis ${U.dateStr(g.chainUntil, true)}: neue Spuren wachsen langsamer.</div></div>`;
      if (g.face) h += `<div class="card goldb"><div class="row">${ic('face', 20)}<div style="flex:1"><b>${esc(g.face.name)}</b><div class="dim" style="font-size:12px">${esc(g.face.role)} · öffentliches Gesicht seit ${U.dateStr(g.face.since, true)}</div></div><div style="text-align:right"><div class="lbl">Glaubwürdigkeit</div><b>${Math.round(g.face.cred)} %</b></div></div></div>`;
      h += `<div class="h3">Tarnstrukturen<span class="r dim">${S.fronts.length}</span></div>`;
      S.fronts.forEach(f => {
        const K = D.FRONT_KINDS.find(k => k.id === f.kind);
        const act = f.projects.filter(pid => { const p = KY.projects.byId(pid); return p && KY.projects.ACTIVE[p.phase]; }).length;
        const ch = f.inv ? D.CHANNELS.find(c => c.id === f.inv.ch) : null;
        h += `<div class="card ${f.exposed ? 'alert' : ''} click" data-a="front" data-id="${f.id}"><div class="row sb"><div style="min-width:0"><b>${esc(f.name)}</b><div class="dim" style="font-size:12px">${K.n} · Sitz ${esc(f.seat)} · ${f.projects.length} Vorhaben (${act} aktiv)</div></div>${f.exposed ? '<span class="stamp">Enttarnt</span>' : `<b class="${f.trace > 80 ? 'bad' : f.trace > 50 ? 'warnc' : ''}">${Math.round(f.trace)} %</b>`}</div>${f.exposed ? '' : ui.meter(f.trace, f.trace > 80 ? 'var(--crit)' : f.trace > 50 ? 'var(--warn)' : 'var(--blue)')}${f.inv ? `<div class="warnbox" style="margin-top:8px">${ic('eyeglass', 15)}<div>Recherche von ${esc(ch ? ch.name : 'Journalisten')} (${esc(f.inv.reporter)}) · ${Math.round(f.inv.prog * 100)} %</div></div>` : ''}<div class="dim" style="font-size:11px;margin-top:6px">${esc(K.note)}</div></div>`;
      });
      h += `<div class="h3">Leitfaden von Milena Dobrev</div><div class="note">Sichtbare Vorhaben, Länder mit freier Presse und schwere Vorfälle erzeugen Spuren. Wer viele Vorhaben über eine einzige Struktur abwickelt, erzeugt ein Muster. Passende Strukturen sind unauffälliger. Druck auf Journalisten ist nach dem Mandat ausgeschlossen – Sie können nur verteilen, verlängern und auflösen.</div>`;
      return h;
    },
  };
  A.newFront = () => KY.order.newFrontDialog();

  /* ================= FORSCHUNG ================= */
  P.forschung = {
    title: 'Forschung', kicker: 'Forschungsprogramme',
    sub: () => SIM.S.res.active.length + ' von ' + KY.research.MAX + ' Programmen laufen',
    render() {
      const S = SIM.S;
      let h = '<div class="note" style="margin-bottom:12px">Offene Forschung steht allen Staaten frei zur Verfügung und stärkt Ihr Ansehen. Exklusive Forschung bringt Lizenzeinnahmen. Die Wirkung tritt mit dem Abschluss ein.</div>';
      const fields = Array.from(new Set(D.TECH.map(t => t.field)));
      fields.forEach(fld => {
        h += `<div class="h3">${esc(fld)}</div>`;
        D.TECH.filter(t => t.field === fld).forEach(t => {
          const st = KY.research.state(t.id);
          const a = S.res.active.find(x => x.id === t.id);
          const d = S.res.done[t.id];
          h += `<div class="card ${st === 'done' ? 'goldb' : ''}" style="${st === 'locked' ? 'opacity:.55' : ''}"><div class="row top"><div class="ic-c" style="color:var(--gold2)">${ic(t.icon, 20)}</div><div style="flex:1;min-width:0"><div class="row sb"><b>${esc(t.n)}</b>${st === 'done' ? '<span class="chip green">' + (d.mode === 'open' ? 'offen' : 'exklusiv') + ' · ' + U.dateStr(d.day, true) + '</span>' : st === 'active' ? '<span class="chip blue">' + Math.round(a.prog * 100) + ' %</span>' : st === 'locked' ? '<span class="chip ghost">' + ic('lock', 11) + ' gesperrt</span>' : ''}</div><div class="note" style="margin-top:3px">${esc(t.text)}</div>
            ${st === 'active' ? '<div class="prog"><i style="width:' + (a.prog * 100) + '%"></i></div>' : ''}
            ${st === 'locked' ? '<div class="dim" style="font-size:11px;margin-top:5px">Erfordert: ' + t.req.map(r => esc(D.TECH_BY[r].n)).join(', ') + '</div>' : ''}
            ${st === 'open' ? `<div class="row" style="margin-top:8px;gap:6px"><span class="dim" style="font-size:12px;margin-right:auto">${U.money(t.cost)} · ${U.days(t.days)}</span><button class="btn xs" data-a="research" data-id="${t.id}" data-m="open">Offen starten</button><button class="btn xs ghost" data-a="research" data-id="${t.id}" data-m="excl">Exklusiv</button></div>` : ''}</div></div></div>`;
        });
      });
      return h;
    },
  };
  A.research = b => {
    const r = KY.research.start(b.dataset.id, b.dataset.m);
    if (!r.ok) ui.toast({ t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'warn' });
    else { KY.audio.play('ok'); ui.toast({ t: 'Forschungsprogramm gestartet', d: D.TECH_BY[b.dataset.id].n, icon: 'flask', kind: 'good' }); }
    ui.renderPanel(true);
  };

  /* ================= KANAL ================= */
  P.kanal = {
    title: 'Verschlüsselter Kanal', kicker: 'KYTHERA · Ende-zu-Ende',
    sub: () => { const u = SIM.S.inbox.filter(m => !m.read).length; return u ? u + ' ungelesen' : 'Alle Nachrichten gelesen'; },
    render() {
      const S = SIM.S;
      const open = ui.st.msg ? S.inbox.find(m => m.id === ui.st.msg) : null;
      if (open) {
        open.read = true;
        const a = SIM.adv(open.from);
        const acts = open.acts.map((x, i) => `<button class="btn sm ${i === 0 ? 'primary' : ''}" data-a="msgAct" data-m="${open.id}" data-i="${i}">${esc(x.l)}</button>`).join('');
        const body = open.kind === 'letter'
          ? `<div class="letter"><div class="lh"><span>KURATORIUM · KYTHERA</span><span>${U.dateStr(open.day, true).toUpperCase()}</span></div><p><b>${esc(open.subj)}</b></p>${open.body.map(p => '<p>' + esc(p) + '</p>').join('')}<div class="sig">${esc(a.name)}<br><span style="font-size:12px">${esc(a.role)}</span></div></div>`
          : `<div class="card"><div class="row">${ui.advAvatar(open.from)}<div><b>${esc(a.name)}</b><div class="dim" style="font-size:12px">${esc(a.role)} · ${U.dateStr(open.day, true)}</div></div></div><div style="margin-top:12px;font-weight:700;font-size:15px">${esc(open.subj)}</div>${open.body.map(p => '<p class="note" style="font-size:13px;margin:8px 0 0">' + esc(p) + '</p>').join('')}</div>`;
        return `<button class="btn sm ghost" data-a="msgBack" style="margin-bottom:10px">${ic('chevL', 14)} Zurück</button>${body}${acts ? '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">' + acts + '</div>' : ''}`;
      }
      if (!S.inbox.length) return '<div class="empty">Keine Nachrichten.</div>';
      return `<div class="row sb" style="margin-bottom:6px"><span class="dim" style="font-size:12px">${S.inbox.length} Nachrichten</span><button class="btn xs ghost" data-a="msgAllRead">Alle gelesen</button></div>` + S.inbox.slice(0, 120).map(m => {
        const a = SIM.adv(m.from);
        return `<div class="msg ${m.read ? '' : 'unread'} ${m.kind === 'crisis' ? 'crisis' : ''}" data-a="openMsg" data-id="${m.id}">${ui.advAvatar(m.from, 30)}<div style="flex:1;min-width:0"><div class="t ell">${esc(m.subj)}</div><div class="s ell">${esc(a.name)} · ${esc(m.body[0] || '')}</div></div><div class="dim" style="font-size:11px;white-space:nowrap">${ui.dayAgo(m.day)}</div></div>`;
      }).join('');
    },
  };
  A.openMsg = (b, e, id) => { ui.st.msg = id || +b.dataset.id; if (ui.cur !== 'kanal') ui.panel('kanal'); else ui.renderPanel(true); ui.updateBar(); };
  A.msgBack = () => { ui.st.msg = null; ui.renderPanel(true); };
  A.msgAllRead = () => { SIM.S.inbox.forEach(m => { m.read = true; }); ui.renderPanel(true); ui.updateBar(); };
  A.msgAct = b => { const m = SIM.S.inbox.find(x => x.id === +b.dataset.m); if (!m) return; const a = m.acts[+b.dataset.i]; if (a) ui.msgAct(a.a, a.p); };

  /* ================= CHRONIK ================= */
  const CHT = { vorhaben: 'Vorhaben', vorfall: 'Vorfälle', verantwortung: 'Verantwortung', katastrophe: 'Katastrophen', hilfe: 'Hilfe', politik: 'Politik', diplomatie: 'Diplomatie', krise: 'Krisen', tarnung: 'Tarnung', finanzen: 'Finanzen', forschung: 'Forschung', kuratorium: 'Kuratorium', grundsatz: 'Grundsätze', protest: 'Proteste', bilanz: 'Bilanz' };
  P.chronik = {
    title: 'Chronik', kicker: 'Protokoll des Mandats',
    sub: () => SIM.S.chron.length + ' Einträge seit ' + U.dateStr(0, true),
    render() {
      const S = SIM.S;
      const f = ui.st.filter.chronik || 'alle';
      const types = Array.from(new Set(S.chron.map(c => c.type)));
      let h = '<div class="row" style="flex-wrap:wrap;gap:5px;margin-bottom:10px"><button class="chip ' + (f === 'alle' ? 'gold' : 'ghost') + '" data-a="chronF" data-v="alle">Alle</button>' + types.map(t => `<button class="chip ${f === t ? 'gold' : 'ghost'}" data-a="chronF" data-v="${t}">${CHT[t] || t}</button>`).join('') + '</div>';
      const list = S.chron.filter(c => f === 'alle' || c.type === f).slice().reverse().slice(0, 300);
      let lastM = '';
      list.forEach(c => {
        const m = U.monthStr(c.day);
        if (m !== lastM) { h += `<div class="h3">${m}</div>`; lastM = m; }
        const ref = c.ref || {};
        const a = ref.inc ? `data-a="inc" data-id="${ref.inc}"` : ref.proj ? `data-a="proj" data-id="${ref.proj}"` : ref.ev ? `data-a="ev" data-id="${ref.ev}"` : ref.n !== undefined && ref.n !== null ? `data-a="nation" data-id="${ref.n}"` : '';
        h += `<div class="kv" ${a} style="${a ? 'cursor:pointer' : ''}"><span style="color:var(--text);flex:1">${esc(c.text)}</span><span class="dim" style="font-weight:500;font-size:11px;white-space:nowrap">${U.mday(c.day)}. · ${CHT[c.type] || ''}</span></div>`;
      });
      return h || '<div class="empty">Noch keine Einträge.</div>';
    },
  };
  A.chronF = b => { ui.st.filter.chronik = b.dataset.v; ui.renderPanel(true); };

  /* ================= AKTEN ================= */
  P.akten = {
    title: 'Akten', kicker: 'Versiegelte Vertragsmappe', static: true,
    sub: () => 'Unterzeichnet am ' + U.dateStr(0, true) + ' in Holmvik',
    render() {
      const S = SIM.S, v = S.contracts.vals;
      const ch = (cid, fid) => { const c = D.CONTRACTS.find(x => x.id === cid); const f = c && c.fields.find(x => x.id === fid); const o = f && f.choices.find(x => x.v === v[fid]); return o ? o.l : '—'; };
      let h = `<div class="card goldb"><div class="lbl">Ihre Vertragswerte</div>
        <div class="kv"><span>Deckname</span><span>${esc(S.codename)}</span></div>
        <div class="kv"><span>Rechtsordnung</span><span>${esc(ch('K02', 'jurisdiction'))}</span></div>
        <div class="kv"><span>Treuhandhaus</span><span>${esc(ch('K03', 'trustee'))}</span></div>
        <div class="kv"><span>Anlagestrategie</span><span>${esc(ch('K04', 'strategy'))}</span></div>
        <div class="kv"><span>Reaktionsfrist</span><span>${esc(ch('K06', 'deadline'))}</span></div>
        <div class="kv"><span>Entschädigungsfonds</span><span>${esc(ch('K06', 'fund'))}</span></div>
        <div class="kv"><span>Leitende Gesandtschaft</span><span>${esc(ch('K07', 'envoy'))}</span></div>
        <div class="kv"><span>Grundsätze</span><span>${(v.principles || []).length}</span></div>
        <div class="kv"><span>Aktenzeichen der Welt</span><span class="mono">${S.seed}</span></div></div>
        <div class="h3">Urkunden</div><div class="list">` + D.CONTRACTS.map(c => `<div class="li" data-a="readContract" data-id="${c.id}"><div class="ic-c">${ic('doc', 17)}</div><div class="m"><div class="t">${esc(c.title)}</div><div class="d">${esc(c.no)} · ${esc(c.party)}</div></div><div class="r">${ic('seal', 16)}</div></div>`).join('') + '</div>';
      if (S.contracts.sig) h += `<div class="h3">Ihre Unterschrift</div><div class="card" style="background:var(--paper)"><img src="${S.contracts.sig}" alt="Unterschrift" style="width:100%;height:90px;object-fit:contain"></div>`;
      return h;
    },
  };
  A.readContract = b => KY.contracts.view(b.dataset.id);

  /* ================= SYSTEM ================= */
  P.system = {
    title: 'System', kicker: 'Mandat verwalten', static: true,
    sub: () => 'Speichern, Laden, Einstellungen',
    render() {
      const S = SIM.S;
      const slot = s => {
        const m = SIM.meta(s);
        return `<div class="card"><div class="row sb"><div><b>${s === 'auto' ? 'Automatische Sicherung' : 'Speicherplatz ' + s}</b><div class="dim" style="font-size:12px">${m ? esc(m.codename) + ' · ' + U.dateStr(m.day, true) + ' · gesichert ' + U.realDate(new Date(m.saved)) + ' ' + U.clock(new Date(m.saved)) : 'leer'}</div></div><div class="row" style="gap:6px">${s !== 'auto' ? `<button class="btn xs" data-a="save" data-v="${s}">Sichern</button>` : ''}${m ? `<button class="btn xs ghost" data-a="loadSlot" data-v="${s}">Laden</button>` : ''}</div></div></div>`;
      };
      const sw = (k, label, on, sub) => `<div class="switch ${on ? 'on' : ''}" data-a="setting" data-k="${k}"><div><div style="font-weight:600">${label}</div>${sub ? '<div class="dim" style="font-size:12px">' + sub + '</div>' : ''}</div><div class="tg"></div></div>`;
      return `<div class="h3">Spielstände</div>${['auto', '1', '2', '3'].map(slot).join('')}
        <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm" data-a="exportSave">${ic('download', 14)} Exportieren</button><button class="btn sm" data-a="importSave">${ic('upload', 14)} Importieren</button></div>
        <div class="h3">Einstellungen</div>
        ${sw('sound', 'Ton', S.ui.sound !== false, 'Synthetische Signale, keine Audiodateien')}
        ${sw('autoPause', 'Bei schweren Vorfällen anhalten', S.ui.autoPause !== false, 'Der Krisenstab ruft an und die Zeit stoppt')}
        ${sw('autosave', 'Monatlich automatisch sichern', S.ui.autosave !== false, '')}
        <div class="h3">Mandat</div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-a="toTitle">${ic('home', 14)} Zum Titel</button><button class="btn sm danger" data-a="newMandate">${ic('refresh', 14)} Neues Mandat</button></div>
        <div class="note" style="margin-top:14px">KYTHERA · MANDAT ist ein fiktives Rollenspiel. Alle Staaten, Personen, Organisationen und Ereignisse sind frei erfunden. Optimiert für iPad im Querformat mit Magic Keyboard.</div>`;
    },
  };
  A.setting = b => {
    const S = SIM.S, k = b.dataset.k;
    S.ui[k] = S.ui[k] === false;
    if (k === 'sound') KY.audio.setOn(S.ui.sound !== false);
    b.classList.toggle('on', S.ui[k] !== false);
  };
  A.loadSlot = async b => { if (await ui.confirm('Spielstand laden?', 'Der aktuelle Stand wird verworfen, sofern Sie ihn nicht gesichert haben.', 'Laden')) KY.boot.loadSlot(b.dataset.v); };
  A.toTitle = async () => { if (await ui.confirm('Zum Titel zurückkehren?', 'Der aktuelle Stand wird automatisch gesichert.', 'Zum Titel')) { ui.save('auto'); KY.boot.toTitle(); } };
  A.newMandate = async () => { if (await ui.confirm('Neues Mandat beginnen?', 'Sie unterzeichnen eine neue Vertragsmappe in einer neuen Welt. Der aktuelle Stand bleibt in der automatischen Sicherung erhalten, bis sie überschrieben wird.', 'Neues Mandat', true)) { ui.save('auto'); KY.boot.newMandate(); } };
  A.exportSave = () => {
    const txt = SIM.exportSave(SIM.S);
    const m = ui.modal({ cls: 'w560', html: `<div class="mh"><div class="tt"><div class="lbl">Export</div><h2>Spielstand exportieren</h2></div></div><div class="mb"><p class="note">Kopieren Sie diesen Text und bewahren Sie ihn sicher auf.</p><textarea class="inp" readonly>${esc(txt)}</textarea></div><div class="mf"><button class="btn ghost" data-a="mclose">Schließen</button><button class="btn primary" id="ex-copy">Kopieren</button></div>` });
    U.$('#ex-copy', m.el).addEventListener('click', () => U.copy(txt).then(ok => ui.toast({ t: ok ? 'Kopiert' : 'Kopieren nicht möglich', icon: ok ? 'check' : 'x' })));
  };
  A.importSave = () => {
    const m = ui.modal({ cls: 'w560', html: `<div class="mh"><div class="tt"><div class="lbl">Import</div><h2>Spielstand importieren</h2></div></div><div class="mb"><textarea class="inp" id="im-t" placeholder="Exportierten Text hier einfügen"></textarea></div><div class="mf"><button class="btn ghost" data-a="mclose">Abbrechen</button><button class="btn primary" id="im-ok">Importieren</button></div>` });
    U.$('#im-ok', m.el).addEventListener('click', () => {
      const S = SIM.importSave(U.$('#im-t', m.el).value);
      if (!S) { ui.toast({ t: 'Ungültiger Spielstand', icon: 'x', kind: 'crit' }); return; }
      m.close(); KY.boot.startLoaded(S);
    });
  };

  /* ================= HILFE ================= */
  P.hilfe = {
    title: 'Hilfe', kicker: 'Einweisung', static: true, wide: true,
    sub: () => 'Bedienung mit Trackpad und Magic Keyboard',
    render() {
      const k = (t, ...keys) => `<div class="k"><span>${t}</span><span>${keys.map(x => '<span class="kbd">' + x + '</span>').join('')}</span></div>`;
      return `<div class="grid2" style="gap:22px"><div>
        <div class="h3">Tastatur</div><div class="keys" style="grid-template-columns:1fr">
        ${k('Zeit anhalten oder fortsetzen', 'Leertaste')}${k('Geschwindigkeit', '1', '2', '3', '4')}${k('Suche und Befehle', '⌘', 'K')}${k('Lagezentrum', 'L')}${k('Handlungskatalog', 'A')}${k('Vorhaben', 'P')}${k('Verantwortung', 'V')}${k('Medien', 'M')}${k('Staaten', 'S')}${k('Finanzen', 'F')}${k('Tarnung', 'T')}${k('Forschung', 'R')}${k('Kanal', 'K')}${k('Chronik', 'C')}${k('Akten', 'O')}${k('Krisenstab (nächster Vorfall)', 'E')}${k('Kartenebene wechseln', 'G')}${k('Karte verschieben', '←', '↑', '→', '↓')}${k('Zoomen', '+', '−')}${k('Übersicht', '0')}${k('Schließen oder abbrechen', 'esc')}${k('Sichern', '⌘', 'S')}</div></div>
        <div><div class="h3">Trackpad</div>
        <div class="note">Mit zwei Fingern wischen verschiebt die Karte, Zusammenziehen und Aufziehen zoomt. Ein Klick wählt Staaten, Städte, Vorhaben und Katastrophen aus. Beim Platzieren von Gebieten halten Sie das Trackpad gedrückt und ziehen ein Rechteck auf.</div>
        <div class="h3">Ihre Rolle</div>
        <div class="note">Sie sind kein Gott. Sie sind eine einzelne, anonyme Person mit gewaltigem Vermögen. Regierungen müssen zustimmen, Menschen protestieren, Bauwerke versagen, die Natur schlägt zu. Sie entscheiden, was gebaut, finanziert und vermittelt wird – und Sie tragen die Folgen.</div>
        <div class="h3">Verantwortung und Druck</div>
        <div class="note">Jeder Vorfall landet im Verantwortungsregister. Der Krisenstab braucht Ihre Entscheidung innerhalb der vertraglichen Frist. Schweigen ist möglich, aber die Öffentlichkeit vergisst nicht. Offene Vorfälle, Proteste, negative Berichte und Grundsatzbrüche erhöhen den Druck. Sinkt das Vertrauen des Kuratoriums, folgen Anhörungen und Auflagen.</div>
        <div class="h3">Die Bevölkerung</div>
        <div class="note">Fünf Milieus bewerten jedes Vorhaben nach eigenen Interessen. Menschen lernen aus Unglücken und misstrauen danach ähnlichen Vorhaben. Wohltaten nutzen sich ab. Zu viel ausländisches Geld weckt Sorgen um die Souveränität und stärkt Parteien, die gegen „Schattengeld“ mobil machen.</div>
        <div class="h3">Tarnung</div>
        <div class="note">Vorhaben laufen über Tarnstrukturen. Spuren entstehen durch Sichtbarkeit, freie Presse und Vorfälle. Fliegt eine Struktur auf, werden ihre Vorhaben einem unbekannten Geldgeber zugeschrieben. Erreicht der Enttarnungsgrad 100 %, weiß die Welt, dass eine einzelne Person dahintersteht. Ihr Name bleibt versiegelt.</div></div></div>`;
    },
  };
})();
