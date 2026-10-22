/* KYTHERA · MANDAT · Inspektor: Staaten, Städte, Vorhaben, Katastrophen, Tarnstrukturen */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const ui = KY.ui, A = KY.A, INS = KY.INS;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const bar = (label, v, max, col, fmt) => `<div class="b"><span>${label}</span>${ui.meter(v, col, max)}<span>${fmt ? fmt(v) : Math.round(v)}</span></div>`;
  const quick = (ids, pl) => '<div class="row" style="flex-wrap:wrap;gap:6px">' + ids.map(id => `<button class="btn xs" data-a="order" data-id="${id}" data-pl='${JSON.stringify(pl)}'>${ic(D.ACT[id].icon, 13)} ${esc(D.ACT[id].name)}</button>`).join('') + '</div>';

  /* ---------- Staat ---------- */
  INS.nation = function (id) {
    const S = SIM.S, W = SIM.W;
    const n = S.nations[id], w = W.nations[id];
    if (!n) return null;
    const cap = W.cities[w.capital];
    const head = `<div class="row">${KY.flag(w, 26)}<div style="min-width:0"><div class="lbl">${esc(w.gov)}</div><h2 class="ell">${esc(w.short)}</h2></div></div><div class="sub">${esc(w.name)} · Hauptstadt ${esc(cap.name)}</div>`;
    const g = n.gov;
    let b = '';
    if (n.crisis) b += `<div class="errbox" style="margin-bottom:10px">${ic(D.CRISES[n.crisis.k] ? D.CRISES[n.crisis.k].icon : 'alert', 16)}<div><b>${esc(D.CRISES[n.crisis.k] ? D.CRISES[n.crisis.k].n : 'Krise')}</b> seit ${U.dateStr(n.crisis.start, true)}</div></div>`;
    b += `<div class="grid2">${stat('Einwohner', U.people(n.pop))}${stat('Wirtschaft', U.money(n.gdp), '¤ ' + U.n(n.gdpPc) + ' je Kopf')}${stat('Wachstum', U.sgn(n.growth, 1, ' %'))}${stat('Ihr Zugang', Math.round(n.access) + ' / 100', 'zur Regierung')}</div>`;
    b += `<div class="h3">Regierung</div><div class="card"><div class="row sb"><div><b>${esc(g.leader)}</b><div class="dim" style="font-size:12px">${esc(g.party)} · seit ${U.dateStr(g.since, true)}</div></div><span class="chip" style="background:${D.PARTY_COLOR[g.lean]}44">${D.PARTY_NAME[g.lean]}</span></div>
      <div class="bars" style="margin-top:8px">${bar('Zustimmung', g.approval, 100, 'var(--blue)', v => Math.round(v) + ' %')}${bar('Offen für Investoren', g.openness, 100, 'var(--gold)')}</div>
      <div class="kv"><span>Nächste Wahl</span><span>${U.dateStr(g.next, true)} (${U.days(g.next - S.day)})</span></div></div>`;
    b += `<div class="h3">Haltung zu Ihnen<span class="r dim">${n.aware < 5 ? 'Sie sind hier unbekannt' : 'Bekanntheit ' + Math.round(n.aware) + ' %'}</span></div><div class="card"><div class="row sb"><b style="font-size:20px" class="${n.op > 3 ? 'good' : n.op < -3 ? 'bad' : ''}">${U.sgn(n.op, 1)}</b><span class="dim" style="font-size:12px">${n.lastPoll ? 'Umfrage ' + U.dateStr(n.lastPoll.day, true) + ': ' + U.pct(n.lastPoll.pct, 0) + ' Zustimmung' : 'Noch keine Umfrage'}</span></div>
      <div class="bars wide" style="margin-top:8px">${D.MILIEUS.map((m, i) => `<div class="b"><span title="${esc(m.text)}">${esc(m.n)} <span class="mute">${Math.round(n.milW[i] * 100)} %</span></span>${ui.dmeter(U.clamp(n.milOp[i], -100, 100))}<span>${U.sgn(n.milOp[i], 0)}</span></div>`).join('')}</div>
      ${(n.sovereign || 0) > 2 ? `<div class="warnbox" style="margin-top:8px">${ic('flag', 15)}<div>Sorge um Souveränität: Ihre Investitionen entsprechen ${U.pct(n.dep, 1)} der Wirtschaftsleistung der letzten fünf Jahre.</div></div>` : ''}</div>`;
    if (n.hist.op.length > 2 && n.aware > 5) b += KY.chart.line(KY.chart.monthly(n.hist.op, S.day), { h: 80, zero: true, color: '#3987e5', fmt: v => 'Haltung ' + U.sgn(v, 1) });
    b += `<div class="h3">Lage im Land</div><div class="bars">${bar('Zufriedenheit', n.happy, 100, 'var(--blue)')}${bar('Unruhe', n.unrest, 100, '#d95926')}${bar('Stabilität', n.stab, 100, 'var(--blue)')}${bar('Gesundheit', n.health, 100, 'var(--blue)')}${bar('Bildung', n.edu, 100, 'var(--blue)')}${bar('Infrastruktur', n.infra, 100, 'var(--blue)')}${bar('Energieversorgung', n.energy, 100, 'var(--blue)')}${bar('Saubere Energie', n.clean, 100, '#199e70', v => Math.round(v) + ' %')}${bar('Umwelt', n.env, 100, '#199e70')}${bar('Technologie', n.tech, 10, 'var(--blue)', v => U.n(v, 1))}${bar('Korruption', n.corrupt, 100, '#d95926')}${bar('Pressefreiheit', n.press, 100, 'var(--blue)')}${bar('Arbeitslosigkeit', n.unemp, 40, '#d95926', v => U.pct(v, 1))}${bar('Armut', n.poverty, 80, '#d95926', v => U.pct(v, 0))}</div>`;
    if (n.hist.happy.length > 2) b += `<div class="h3">Zufriedenheit im Verlauf</div>` + KY.chart.line(KY.chart.monthly(n.hist.happy, S.day), { h: 80, color: '#86b6ef', fmt: v => U.n(v, 1) });
    const rels = W.nations.filter(o => o.id !== id).map(o => ({ o, R: SIM.rel(id, o.id) })).filter(x => w.neighbors.indexOf(x.o.id) >= 0 || x.R.state !== 'normal').sort((a, b) => a.R.v - b.R.v);
    if (rels.length) b += `<div class="h3">Beziehungen</div>` + rels.slice(0, 8).map(x => `<div class="kv"><span>${KY.flag(x.o, 12)} ${esc(x.o.short)}</span><span><span class="chip ${x.R.state === 'partner' ? 'green' : x.R.state === 'normal' ? 'ghost' : x.R.state === 'angespannt' ? 'amber' : 'red'}">${SIM.REL_NAMES[x.R.state]} · ${Math.round(x.R.v)}</span>${x.R.state !== 'partner' && x.R.v < -20 ? ` <button class="btn xs" data-a="order" data-id="VERMITTLUNG" data-pl='${JSON.stringify({ n: id, n2: x.o.id })}'>Vermitteln</button>` : x.R.v > -40 && !x.R.trade ? ` <button class="btn xs ghost" data-a="order" data-id="HANDEL" data-pl='${JSON.stringify({ n: id, n2: x.o.id })}'>Handel</button>` : ''}</span></div>`).join('');
    const ps = S.projects.filter(p => p.n === id || p.n2 === id);
    b += `<div class="h3">Ihre Vorhaben<span class="r dim">${ps.length}</span></div>` + (ps.length ? '<div class="list">' + ps.slice().reverse().slice(0, 12).map(ui.projRow).join('') + '</div>' : '<div class="empty">Keine Vorhaben in diesem Staat.</div>');
    const evs = S.events.filter(e => e.n === id).slice(0, 4);
    if (evs.length) b += `<div class="h3">Katastrophen</div>` + evs.map(e => `<div class="kv" data-a="ev" data-id="${e.id}" style="cursor:pointer"><span>${ic(D.EVENTS[e.type].icon, 13)} ${esc(e.name)}</span><span>${U.dateStr(e.start, true)} · ${U.n(e.deadNow)} Tote</span></div>`).join('');
    b += `<div class="h3">Handeln in ${esc(w.short)}</div>` + quick(['SCHULEN', 'IMPF', 'WASSER', 'MIKRO', 'AGRAR', 'HILFSFONDS', 'PRESSE', 'ANLEIHE'], { n: id });
    return { head, body: b };
  };
  function stat(k, v, s) { return `<div class="stat"><div class="k">${k}</div><div class="v" style="font-size:16px">${v}</div>${s ? '<div class="s">' + s + '</div>' : ''}</div>`; }

  /* ---------- Stadt ---------- */
  const FAC = { port: ['anchor', 'Tiefwasserhafen'], airport: ['plane', 'Flughafen'], metro: ['metro', 'U-Bahn'], hospital: ['hospital', 'Klinikum'], uni: ['uni', 'Universität'], flood: ['wave', 'Küstenschutz'] };
  INS.city = function (id) {
    const S = SIM.S, W = SIM.W;
    const c = W.cities[id], sc = S.cities[id];
    if (!c) return null;
    const w = W.nations[c.nation];
    const head = `<div class="lbl">${c.capital ? 'Hauptstadt · ' : ''}${esc(w.short)}</div><h2>${esc(c.name)}</h2><div class="sub">${esc(KY.geo.biomeName(c.biome))} · ${U.n(c.elev)} m ü. M.${c.coastal ? ' · Küste' : ''}${c.river ? ' · Fluss' : ''}</div>`;
    let b = `<div class="grid2">${stat('Einwohner', U.people(sc.pop))}${stat('Stimmung zu Ihnen', `<span class="${sc.sent > 3 ? 'good' : sc.sent < -3 ? 'bad' : ''}">${U.sgn(sc.sent, 0)}</span>`)}</div>
      <div class="bars" style="margin-top:10px">${bar('Wohlstand', sc.prosperity, 100, 'var(--blue)')}${bar('Unruhe', sc.unrest, 100, '#d95926')}${sc.dmg > 0.02 ? bar('Zerstörung', sc.dmg * 100, 100, '#d03b3b', v => Math.round(v) + ' %') : ''}</div>`;
    const fac = Object.keys(sc.fac).filter(k => sc.fac[k] > 0 && FAC[k]);
    if (fac.length) b += '<div class="row" style="gap:5px;flex-wrap:wrap;margin-top:10px">' + fac.map(k => `<span class="chip blue">${ic(FAC[k][0], 12)} ${FAC[k][1]}</span>`).join('') + '</div>';
    if (sc.protest) {
      const P = sc.protest, p = KY.projects.byId(P.proj);
      b += `<div class="h3">${ic('protest', 13)} Protest</div><div class="card alert"><b>${KY.nations.PROTEST_STAGES[P.stage]}</b><div class="dim" style="font-size:12px">gegen ${p ? esc(p.name) : 'ein Vorhaben'} · seit ${U.dateStr(P.since, true)} · etwa ${U.count(P.size)} Menschen${P.talks ? ' · ' + P.talks + ' Gesprächsrunden' : ''}</div>
        <div class="note" style="margin:8px 0">${P.stage >= 3 ? 'Die Baustelle ist blockiert. Jeder Tag kostet Geld.' : 'Ohne Antwort kann der Protest wachsen.'} Zwangsmittel sind nach dem Mandat ausgeschlossen.</div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn xs" data-a="protest" data-c="${id}" data-k="talk">${ic('chat', 13)} Dialog anbieten · ¤ 20 Mio.</button>${p && p.o.part !== 'codet' && p.o.part !== undefined ? `<button class="btn xs" data-a="protest" data-c="${id}" data-k="redesign">${ic('users', 13)} Mitbestimmung einführen · ${U.money(Math.max(0.01, (p.cost - p.paid) * 0.05))}</button>` : ''}<button class="btn xs" data-a="protest" data-c="${id}" data-k="comp">${ic('coins', 13)} Entschädigung · ${U.money(Math.max(0.02, (p ? p.cost : 1) * 0.006))}</button></div></div>`;
    }
    const ps = S.projects.filter(p => p.c === id || p.c2 === id);
    b += `<div class="h3">Vorhaben hier<span class="r dim">${ps.length}</span></div>` + (ps.length ? '<div class="list">' + ps.slice().reverse().map(ui.projRow).join('') + '</div>' : '<div class="empty">Keine Vorhaben in dieser Stadt.</div>');
    const ids = ['KLINIK', 'UNI', 'WOHNEN', 'FIRMA', 'KULTUR', 'SPEICHER', 'SWZ'];
    if (sc.pop >= 1.2) ids.push('METRO', 'SPIELE');
    if (c.coastal) ids.push('HAFEN', 'DEICH');
    ids.push('FLUGHAFEN', 'GRUNDEINK', 'GIPFEL');
    b += `<div class="h3">Handeln in ${esc(c.name)}</div>` + quick(ids, { c: id });
    b += `<div class="row" style="margin-top:12px"><button class="btn sm ghost" data-a="nation" data-id="${c.nation}">${KY.flag(w, 12)} ${esc(w.short)} ansehen</button></div>`;
    return { head, body: b };
  };
  A.protest = b => {
    const r = KY.nations.protestAction(+b.dataset.c, b.dataset.k);
    if (!r.ok) ui.toast({ t: 'Nicht möglich', d: r.err || '', icon: 'x', kind: 'warn' });
    else { KY.audio.play('ok'); ui.toast({ t: 'Antwort auf den Protest', d: r.msg, icon: 'chat', kind: 'good' }); }
    ui.renderInsp(true); KY.map.redraw();
  };

  /* ---------- Vorhaben ---------- */
  INS.proj = function (id) {
    const S = SIM.S;
    const p = KY.projects.byId(id);
    if (!p) return null;
    const Ac = D.ACT[p.act];
    const f = S.fronts.find(z => z.id === p.front);
    const head = `<div class="row"><div class="ic-c" style="width:40px;height:40px;border-radius:10px;background:rgba(201,162,79,.12);color:var(--gold2);display:flex;align-items:center;justify-content:center">${ic(Ac.icon, 22)}</div><div style="min-width:0"><div class="lbl">${esc(D.CATS.find(c => c.id === Ac.cat).n)}</div><h2 style="font-size:18px">${esc(p.name)}</h2></div></div><div class="sub" style="margin-top:6px">${ui.phaseChip(p)} ${p.retrofit ? '<span class="chip blue">nachgerüstet</span>' : ''} ${p.destroyed ? '<span class="chip red">zerstört</span>' : ''}</div>`;
    let b = '';
    if (p.phase === 'bau' || p.phase === 'laufend') b += `<div class="card"><div class="row sb"><b>${U.pct(p.prog * 100, 0)} abgeschlossen</b><span class="dim" style="font-size:12px">fertig ca. ${U.dateStr(S.day + Math.round((1 - p.prog) * p.days), true)}</span></div><div class="prog" style="height:6px"><i style="width:${p.prog * 100}%"></i></div>${p.stall > 0 && S.cities[p.c] && S.cities[p.c].protest && S.cities[p.c].protest.stage >= 3 ? '<div class="errbox" style="margin-top:8px">' + ic('protest', 15) + '<div>Die Baustelle ist blockiert.</div></div>' : ''}</div>`;
    if (p.phase === 'antrag') b += `<div class="card"><div class="row sb"><b>Genehmigungsverfahren</b><span class="chip amber">Aussicht ${p.chance} %</span></div><div class="dim" style="font-size:12px;margin-top:4px">Entscheidung der Regierung von ${esc(SIM.nName(p.n))} erwartet am ${U.dateStr(p.decideAt, true)}.</div></div>`;
    if (p.phase === 'abgelehnt') b += `<div class="errbox">${ic('x', 15)}<div>Abgelehnt am ${U.dateStr(p.rejectedAt, true)}. ${S.day - p.rejectedAt >= 120 ? 'Ein neuer Antrag ist möglich.' : 'Neuer Antrag ab ' + U.dateStr(p.rejectedAt + 120, true) + '.'}</div></div>`;
    if (p.cond) b += `<div class="warnbox" style="margin-top:8px">${ic('doc', 15)}<div>${esc(p.cond)}</div></div>`;
    if (p.result) b += p.result === 'erfolg' ? `<div class="okbox">${ic('check', 15)}<div>Erfolgreich abgeschlossen.</div></div>` : `<div class="errbox">${ic('x', 15)}<div>Gescheitert.</div></div>`;
    b += `<div class="h3">Eckdaten</div>
      <div class="kv"><span>Ort</span><span>${p.n >= 0 ? esc(SIM.nName(p.n)) : 'weltweit'}${p.c >= 0 ? ' · ' + esc(SIM.cName(p.c)) : ''}</span></div>
      <div class="kv"><span>Träger (Tarnstruktur)</span><span data-a="front" data-id="${f ? f.id : ''}" style="cursor:pointer">${f ? esc(f.name) + (f.exposed ? ' · enttarnt' : '') : '—'}</span></div>
      <div class="kv"><span>Kosten</span><span>${U.money(p.cost)} (bezahlt ${U.money(p.paid)})</span></div>
      <div class="kv"><span>Angeordnet</span><span>${U.dateStr(p.start, true)}</span></div>
      ${p.doneAt >= 0 ? `<div class="kv"><span>Fertiggestellt</span><span>${U.dateStr(p.doneAt, true)}</span></div>` : ''}
      ${p.income ? `<div class="kv"><span>Einnahmen</span><span>${U.money(p.income)} pro Jahr</span></div>` : ''}
      ${p.bond ? `<div class="kv"><span>Anleihe</span><span>${U.money(p.bond.amount)} zu ${U.n(p.bond.rate, 1)} %</span></div>` : ''}
      ${p.displaced ? `<div class="kv"><span>Umgesiedelte Menschen</span><span>${U.count(p.displaced)}</span></div>` : ''}`;
    const opts = KY.projects.optionGroups(Ac).map(g => { const c = KY.projects.choice(Ac, g.id, p.o[g.id]); return c ? `<div class="kv"><span>${esc(g.label)}</span><span>${esc(c.l)}</span></div>` : ''; }).join('');
    if (opts) b += `<div class="h3">Ausführung</div>` + opts;
    let desc = [];
    try { desc = Ac.describe ? Ac.describe(KY.projects.liteCtx(p)) : []; } catch (e) { desc = []; }
    if (desc.length) b += `<div class="h3">Wirkung</div>` + desc.map(d => `<div style="font-size:12.5px;padding:3px 0">${ic('arrowR', 12)} ${esc(d)}</div>`).join('');
    const acc = p.acc || {};
    const accL = { lives: 'Leben gerettet', patients: 'Behandelte', students: 'Ausbildungsplätze', fed: 'Ernährt', water: 'Mit Wasser versorgt' };
    const accR = Object.keys(acc).filter(k => accL[k] && acc[k] >= 1);
    if (accR.length || p.bil) b += `<div class="h3">Bilanz</div>` + accR.map(k => `<div class="kv"><span>${accL[k]}</span><span class="${k === 'lives' ? 'good' : ''}">${U.count(Math.round(acc[k]))}</span></div>`).join('') + (p.bil ? Object.keys(p.bil).filter(k => p.bil[k]).map(k => `<div class="kv"><span>${{ jobs: 'Arbeitsplätze', co2: 'CO₂ vermieden (Mt/Jahr)', power: 'Saubere Leistung (GW)', homes: 'Wohnungen', trees: 'Bäume', sea: 'Geschützte See (km²)' }[k] || k}</span><span>${k === 'co2' || k === 'power' ? U.n(p.bil[k], 1) : U.count(p.bil[k])}</span></div>`).join('') : '');
    const risks = (Ac.risks || []).filter(r => r.p > 0);
    if (risks.length && KY.projects.ACTIVE[p.phase]) b += `<div class="h3">Risiken</div>` + risks.map(r => { const pm = r.p * KY.projects.RISK_K * KY.projects.riskMult(Ac, p.o, r.id, KY.projects.liteCtx(p)) * (p.retrofit ? 0.35 : 1); const py = 1 - Math.pow(1 - pm, 12); return `<div class="kv"><span>${esc(D.INCIDENTS[r.id].n)} <span class="mute">(${r.phase === 'bau' ? 'Bau' : 'Betrieb'})</span></span><span class="${py > 0.08 ? 'bad' : py > 0.03 ? 'warnc' : ''}">${U.pct(py * 100, 1)} pro Jahr</span></div>`; }).join('');
    if (p.incidents.length) b += `<div class="h3">Vorfälle</div><div class="list">` + p.incidents.map(iid => KY.incidents.byId(iid)).filter(Boolean).map(ui.incRow).join('') + '</div>';
    if (p.breaks && p.breaks.length) b += `<div class="errbox" style="margin-top:10px">${ic('scale', 15)}<div>Dieses Vorhaben verstößt gegen Ihre Grundsätze.</div></div>`;
    // Eingriffe
    const btns = [];
    const active = KY.projects.ACTIVE[p.phase];
    if (active && !p.retrofit && p.phase !== 'antrag' && (Ac.risks || []).some(r => r.p > 0)) btns.push(`<button class="btn sm" data-a="pRetro" data-id="${p.id}">${ic('wrench', 14)} Nachrüsten · ${U.money(Math.max(0.01, p.cost * 0.08))}</button>`);
    if (active && p.phase !== 'pausiert' && p.phase !== 'antrag' && !Ac.instant) btns.push(`<button class="btn sm" data-a="pPause" data-id="${p.id}">${ic('pause', 14)} 90 Tage ruhen lassen</button>`);
    if (p.phase === 'betrieb' && !p.bond && !Ac.program) btns.push(`<button class="btn sm" data-a="pHand" data-id="${p.id}">${ic('handshake', 14)} An den Staat übergeben</button>`);
    if (p.phase === 'abgelehnt' && S.day - p.rejectedAt >= 120) btns.push(`<button class="btn sm primary" data-a="pResub" data-id="${p.id}">${ic('refresh', 14)} Neuer Antrag</button>`);
    if (p.phase === 'antrag') btns.push(`<button class="btn sm danger" data-a="pStop" data-id="${p.id}">${ic('x', 14)} Antrag zurückziehen</button>`);
    else if (active) btns.push(`<button class="btn sm danger" data-a="pStop" data-id="${p.id}">${ic('power', 14)} Stilllegen</button>`);
    if (btns.length) b += `<div class="h3">Eingriffe</div><div class="row" style="gap:6px;flex-wrap:wrap">${btns.join('')}</div>`;
    if (p.n >= 0) b += `<div class="row" style="margin-top:12px;gap:6px"><button class="btn xs ghost" data-a="nation" data-id="${p.n}">${esc(SIM.nName(p.n))}</button>${p.c >= 0 ? `<button class="btn xs ghost" data-a="city" data-id="${p.c}">${esc(SIM.cName(p.c))}</button>` : ''}</div>`;
    return { head, body: b };
  };
  A.pRetro = b => { const p = KY.projects.byId(b.dataset.id); const r = KY.projects.retrofit(p); ui.toast(r.ok ? { t: 'Nachrüstung beauftragt', d: p.name, icon: 'wrench', kind: 'good' } : { t: 'Nicht möglich', d: r.err || '', icon: 'x', kind: 'warn' }); ui.renderInsp(true); };
  A.pPause = async b => { const p = KY.projects.byId(b.dataset.id); if (await ui.confirm('90 Tage ruhen lassen?', 'Während der Pause gibt es keine Wirkung und keine Einnahmen. Beim Bau steht der Fortschritt still.', 'Ruhen lassen')) { KY.projects.pause(p, 90); ui.renderInsp(true); KY.map.redraw(); } };
  A.pHand = async b => { const p = KY.projects.byId(b.dataset.id); if (await ui.confirm('An den Staat übergeben?', 'Die Anlage geht entschädigungslos an ' + esc(SIM.nName(p.n)) + ' über. Ihre Wirkung bleibt, Einnahmen und künftige Verantwortung enden. Ihr Zugang zur Regierung wächst.', 'Übergeben')) { KY.projects.handover(p); ui.renderInsp(true); KY.map.redraw(); } };
  A.pResub = b => { const p = KY.projects.byId(b.dataset.id); if (KY.projects.resubmit(p)) ui.toast({ t: 'Neuer Antrag gestellt', d: p.name, icon: 'doc', kind: 'good' }); ui.renderInsp(true); };
  A.pStop = async b => {
    const p = KY.projects.byId(b.dataset.id);
    const ant = p.phase === 'antrag';
    if (await ui.confirm(ant ? 'Antrag zurückziehen?' : 'Endgültig stilllegen?', ant ? 'Das Vorhaben wird nicht weiterverfolgt.' : 'Die bisherige Investition von ' + U.money(p.paid) + ' ist verloren. Wirkung und Einnahmen enden. Das lässt sich nicht rückgängig machen.', ant ? 'Zurückziehen' : 'Stilllegen', true)) { KY.projects.shutdown(p, 'auf Anordnung'); ui.renderInsp(true); KY.map.redraw(); }
  };

  /* ---------- Katastrophe ---------- */
  INS.ev = function (id) {
    const S = SIM.S;
    const ev = KY.events.byId(id);
    if (!ev) return null;
    const T = D.EVENTS[ev.type];
    const head = `<div class="row"><div class="ic-c" style="width:40px;height:40px;border-radius:10px;background:rgba(236,131,90,.15);color:var(--serious);display:flex;align-items:center;justify-content:center">${ic(T.icon, 22)}</div><div><div class="lbl">${esc(T.kind)} · Stufe ${ev.sev} von 5</div><h2 style="font-size:18px">${esc(ev.name)}</h2></div></div><div class="sub">${ev.phase === 'vorbei' ? 'Vorüber seit ' + U.dateStr(ev.end, true) : 'Seit ' + U.dateStr(ev.start, true) + ' · noch etwa ' + U.days(ev.end - S.day)}</div>`;
    let b = `<p class="note" style="font-size:13px;margin:0 0 12px">${esc(ev.text)}</p><div class="grid2">${stat('Todesopfer', U.n(ev.deadNow), ev.phase === 'vorbei' ? 'endgültig' : 'bisher')}${stat('Obdachlos', ev.displaced ? U.count(ev.displaced) : '—')}${stat('Durch Ihre Hilfe gerettet', ev.saved ? '<span class="good">' + U.n(Math.round(ev.saved)) + '</span>' : '—')}${stat('Wirtschaftsschaden', U.pct(ev.dmg, 1) + ' BIP')}</div>`;
    b += `<div class="h3">Krisenhilfe</div>` + ['LUFTBRUECKE', 'LAZARETT', 'WIEDERAUFBAU'].map(aid => {
      const Ac = D.ACT[aid];
      if (ev.helped[aid]) return `<div class="okbox" style="margin-bottom:6px">${ic('check', 15)}<div><b>${esc(Ac.name)}</b> angeordnet am ${U.dateStr(ev.helped[aid], true)}</div></div>`;
      const pend = S.projects.find(p => p.act === aid && p.ev === ev.id && KY.projects.ACTIVE[p.phase]);
      if (pend) return `<div class="warnbox" style="margin-bottom:6px">${ic('clock', 15)}<div><b>${esc(Ac.name)}</b> unterwegs</div></div>`;
      return `<div class="card click" data-a="order" data-id="${aid}" data-pl='${JSON.stringify({ ev: ev.id })}'><div class="row">${ic(Ac.icon, 18)}<div style="flex:1"><b>${esc(Ac.name)}</b><div class="dim" style="font-size:12px">${esc(Ac.short)}</div></div>${ic('chevR', 14)}</div></div>`;
    }).join('');
    if (ev.phase !== 'vorbei' && !Object.keys(ev.helped).length) b += `<div class="note" style="margin-top:8px">Je früher Hilfe eintrifft, desto mehr Menschen überleben. Bereits Verstorbene kann niemand retten.</div>`;
    b += `<div class="row" style="margin-top:12px"><button class="btn xs ghost" data-a="nation" data-id="${ev.n}">${esc(SIM.nName(ev.n))}</button></div>`;
    return { head, body: b };
  };

  /* ---------- Tarnstruktur ---------- */
  INS.front = function (id) {
    const S = SIM.S;
    const f = S.fronts.find(z => z.id === id);
    if (!f) return null;
    const K = D.FRONT_KINDS.find(k => k.id === f.kind);
    const head = `<div class="lbl">${esc(K.n)} · Sitz ${esc(f.seat)}</div><h2 style="font-size:19px">${esc(f.name)}</h2><div class="sub">gegründet ${U.dateStr(f.created, true)}${f.exposed ? ' · <span class="bad">enttarnt</span>' : ''}</div>`;
    let b = f.exposed ? '<div class="errbox">' + ic('eye', 15) + '<div>Diese Struktur ist enttarnt. Ihre Vorhaben werden öffentlich einem einzigen Geldgeber zugeschrieben.</div></div>' : `<div class="card"><div class="row sb"><b>Spuren</b><b>${Math.round(f.trace)} %</b></div>${ui.meter(f.trace, f.trace > 80 ? 'var(--crit)' : f.trace > 50 ? 'var(--warn)' : 'var(--blue)')}</div>`;
    b += `<div class="note" style="margin-top:8px">${esc(K.note)}. Passende Bereiche: ${(D.FRONT_FIT[f.kind] || []).map(c => D.CATS.find(x => x.id === c).n).join(', ')}.</div>`;
    b += `<div class="h3">Vorhaben<span class="r dim">${f.projects.length}</span></div>` + (f.projects.length ? '<div class="list">' + f.projects.map(pid => KY.projects.byId(pid)).filter(Boolean).reverse().map(ui.projRow).join('') + '</div>' : '<div class="empty">Keine Vorhaben.</div>');
    const others = S.fronts.filter(z => z.id !== f.id);
    if (others.length && !f.exposed) b += `<div class="h3">Auflösen</div><div class="note" style="margin-bottom:8px">Die Vorhaben gehen auf eine andere Struktur über, ein Teil der Spuren wandert mit.</div><div class="row" style="flex-wrap:wrap;gap:6px">${others.map(o => `<button class="btn xs" data-a="dissolve" data-f="${f.id}" data-t="${o.id}">→ ${esc(o.name)}</button>`).join('')}</div>`;
    return { head, body: b };
  };
  A.dissolve = async b => {
    if (!(await ui.confirm('Struktur auflösen?', 'Die Vorhaben werden übertragen. Laufende Recherchen können der Spur folgen.', 'Auflösen', true))) return;
    const r = KY.cover.dissolve(b.dataset.f, b.dataset.t);
    if (!r.ok) ui.toast({ t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'warn' });
    else { ui.toast({ t: 'Struktur aufgelöst', icon: 'trash', kind: 'good' }); ui.closeInsp(); ui.renderPanel(true); }
  };
})();
