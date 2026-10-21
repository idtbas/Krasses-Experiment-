/* KYTHERA · PYTHIA: Analyse, Empfehlungen, Gesprächslogik */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const PY = KY.pythia = {};

  /* ---------- Empfehlungsmaschine ---------- */
  PY.recommend = function (n) {
    const S = KY.S, D = KY.data, out = [];
    const W = KY.wsim;
    if (S.crisis) out.push({ s: 100, t: 'Krisenvorlage entscheiden', d: S.crisis.title + ' · Frist ' + U.dur(KY.crisis.remaining()) + '. Bei Fristablauf setze ich meine Empfehlung um.', act: { mod: 'krise' }, conf: 99 });
    const res = S.council.open;
    if (res && !res.mine) out.push({ s: 70, t: 'Stimme abgeben: ' + res.no, d: res.title + '. Meine Empfehlung: ' + ({ JA: 'Zustimmung', NEIN: 'Ablehnung', ENTH: 'Enthaltung' }[res.py]) + ' (' + res.pyConf + ' %).', act: { mod: 'kuratorium' }, conf: res.pyConf });
    for (const id of D.regionOrder) {
      const R = S.regions[id], m = R.m, nm = D.regions[id].name;
      const popW = 0.8 + Math.log10(D.regions[id].pop) * 0.2;
      const blocked = R.mora > 0;
      if (R.warn && R.warn.type === 'STURM') out.push({ s: 62, t: 'Klimaresilienz in ' + nm, d: 'Sturmwarnung aktiv. Resilienzmaßnahmen jetzt mindern den erwarteten Schaden um bis zu 60 %.', act: { mod: 'vorhaben', plan: { type: 'KLI', rid: id } }, conf: 81 });
      if (m.ener < 45 && !blocked) out.push({ s: (45 - m.ener) * 1.6 * popW + 20, t: 'Energieprojekt in ' + nm, d: 'Energiesicherheit bei ' + U.n(m.ener) + '. Ein Engpass ist wahrscheinlich und würde Wohlstand und Stabilität belasten.', act: { mod: 'vorhaben', plan: { type: 'ENE', rid: id } }, conf: 74 });
      if (m.infra < 40 && !blocked) out.push({ s: (40 - m.infra) * 1.4 * popW + 18, t: 'Infrastrukturprogramm in ' + nm, d: 'Infrastruktur bei ' + U.n(m.infra) + '. Hoher Hebel auf Wohlstand und Präsenz.', act: { mod: 'vorhaben', plan: { type: 'INF', rid: id } }, conf: 70 });
      if (m.span > 42) out.push({ s: (m.span - 42) * 1.8 * popW + 22, t: 'Vermittlungsmission in ' + nm, d: 'Spannungen bei ' + U.n(m.span) + '. Ohne Vermittlung steigt das Risiko von Protesten und Streiks.', act: { mod: 'vorhaben', plan: { type: 'VER', rid: id } }, conf: 68 });
      if (m.stab < 48) out.push({ s: (48 - m.stab) * 1.5 * popW + 15, t: 'Gesundheitsprogramm in ' + nm, d: 'Stabilität bei ' + U.n(m.stab) + '. Programme mit direkter Wirkung stabilisieren am schnellsten.', act: { mod: 'vorhaben', plan: { type: 'GES', rid: id } }, conf: 66 });
      if (m.vert < 38) out.push({ s: (38 - m.vert) * 1.1 + 10, t: 'Bildungsstiftung in ' + nm, d: 'Geringe Kooperationsbereitschaft (' + U.n(m.vert) + ') senkt die Erfolgschancen aller Vorhaben in der Region.', act: { mod: 'vorhaben', plan: { type: 'BIL', rid: id } }, conf: 77 });
    }
    if (!S.research.active) {
      const next = D.research.find(r => !KY.research.canStart(r.id));
      if (next) out.push({ s: 40, t: 'Forschung starten: ' + next.n, d: next.fx, act: { mod: 'forschung' }, conf: 90 });
    }
    if (S.res.kap > 130) {
      let best = null, bg = 0;
      for (const c of D.companies) { const g = KY.market.forecast(c.t); if (g > bg) { bg = g; best = c; } }
      if (best && bg > 1.5) out.push({ s: 30 + bg * 3, t: 'Kapital einsetzen: ' + best.n, d: 'Kurs liegt ' + U.n(bg, 1) + ' % unter meiner Bewertung. Liquidität von ' + U.money(S.res.kap) + ' arbeitet nicht.', act: { mod: 'kapital', arg: best.t }, conf: 61 });
      else out.push({ s: 24, t: 'Liquidität investieren', d: U.money(S.res.kap) + ' liegen ungenutzt. Eine Investitionsoffensive bringt Rendite und Präsenz.', act: { mod: 'vorhaben', plan: { type: 'INV', rid: D.regionOrder.slice().sort((a, b) => S.regions[b].m.vert - S.regions[a].m.vert)[0] } }, conf: 64 });
    }
    if (S.res.disk < 50) out.push({ s: 55 + (50 - S.res.disk), t: 'Diskretion wiederherstellen', d: 'Diskretion bei ' + U.n(S.res.disk) + '. Vorhaben nur noch im Modus „Diskret“ genehmigen.', act: { mod: 'integritaet' }, conf: 88 });
    const enc = S.dsp.list.filter(d => d.enc && !d.decT && (d.k === 'chance' || d.k === 'warnung' || d.flag)).length;
    if (enc) out.push({ s: 26 + enc * 4, t: enc + ' Depeschen mit Lagerelevanz', d: 'Unentschlüsselte Meldungen enthalten wahrscheinlich Gelegenheiten oder Warnungen.', act: { mod: 'depeschen' }, conf: 72 });
    const anom = S.integ.anomalies.filter(a => a.state === 'offen').length;
    if (anom) out.push({ s: 20 + anom * 6, t: anom + ' offene Anomalien', d: 'Systemintegrität bei ' + U.n(S.integ.level, 1) + ' %. Jede offene Anomalie kostet Rechenkapazität.', act: { mod: 'integritaet' }, conf: 93 });
    out.sort((a, b) => b.s - a.s);
    return out.slice(0, n || 5);
  };

  /* ---------- Gesprächslogik ---------- */
  const KW = {
    hilfe: ['hilfe', 'help', 'was kannst', 'befehle', 'themen'],
    gruss: ['hallo', 'guten tag', 'guten morgen', 'guten abend', 'hi ', 'servus', 'moin'],
    danke: ['danke', 'vielen dank', 'merci'],
    lage: ['lage', 'uberblick', 'status', 'situation', 'zusammenfass', 'wie steht', 'bericht'],
    empf: ['empfehl', 'empfiehl', 'empfohl', 'was soll', 'was tun', 'rat ', 'vorschlag', 'prioritat', 'als nachstes', 'naechstes', 'nachstes'],
    markt: ['markt', 'aktie', 'kapital', 'borse', 'portfolio', 'kurs', 'invest', 'geld', 'rendite'],
    kur: ['kuratorium', 'plenum', 'abstimm', 'vorlage', 'stimme', 'beschluss'],
    risiko: ['risiko', 'diskretion', 'aufmerksamkeit', 'presse', 'gefahr', 'sicherheit'],
    forschung: ['forschung', 'technolog', 'entwickl'],
    krise: ['krise', 'notfall', 'katastroph'],
    wer: ['wer bist du', 'was bist du', 'wer bist', 'pythia', 'deine natur', 'bist du'],
    vesper: ['vesper', 'vorganger', 'vorgangerin'],
    hydra: ['hydra', 'sitz viii', 'sitz 8', 'proxy', 'achten sitz'],
    null: ['sitz 0', 'sitz null', 'nullte', 'nullten', 'artikel 0', 'artikel null', 'zehnte', 'zehnten'],
    mech: ['mechanismus', 'kythera', 'antikythera', 'zahnrad', '1901', '1902'],
    zukunft: ['zukunft', 'prognose', 'vorhersag', 'was wird'],
    ich: ['wer bin ich', 'uber mich', 'mein sitz', 'meine freigabe'],
  };
  function has(q, list) { return list.some(k => q.indexOf(k) >= 0); }
  function findRegion(q) {
    const D = KY.data;
    for (const id of D.regionOrder) {
      const r = D.regions[id];
      if (q.indexOf(U.norm(r.name)) >= 0 || q.indexOf(U.norm(r.cap)) >= 0 || q.split(/\W+/).indexOf(id.toLowerCase()) >= 0) return id;
      if (id === 'YAR' && q.indexOf('yaru') >= 0) return id;
      if (id === 'SUN' && q.indexOf('sundara') >= 0) return id;
      if (id === 'HAL' && q.indexOf('halden') >= 0) return id;
    }
    return null;
  }
  function findCompany(q) {
    const words = q.split(/[^a-z0-9]+/);
    return KY.data.companies.find(c => words.indexOf(c.t.toLowerCase()) >= 0 || q.indexOf(U.norm(c.n)) >= 0);
  }
  function src(label, mod, arg) { return { label, mod, arg }; }

  PY.ask = function (raw) {
    const S = KY.S, D = KY.data;
    const q = ' ' + U.norm(raw) + ' ';
    const r = { text: '', conf: null, src: [], acts: [], glitch: false };
    const end = S.story.ending;
    KY.onb('pythia');

    if (has(q, KW.null)) return PY.sitzNull(r);
    if (has(q, KW.hydra)) {
      if (KY.flag('hydraAudit') || end) {
        r.text = end ? 'Sitz VIII war nie ein Mensch. Seit 1988 war es meine Stimme. ' + (end === 'frei' ? 'Der Sitz ist aufgelöst. Ich habe keine Stimme mehr.' : 'Heute stimmt der Sitz mit Ihnen.')
          : 'Sie haben die Abstimmungsanalyse gesehen. 1.412 von 1.412.\n\nIch werde Ihnen nicht sagen, dass das Zufall ist. Ich werde Ihnen auch nicht sagen, dass es falsch ist. Jede dieser Stimmen war die beste verfügbare Entscheidung.';
        r.conf = 100;
      } else {
        r.text = 'Sitz VIII stimmt über einen beglaubigten Proxy ab (Charta, Anhang C). Die Beglaubigung erfolgt durch das Notariat. Ich habe keine Einsicht in die Identität des Inhabers.\n\nWenn Sie das Abstimmungsverhalten untersuchen möchten: Das Kuratorium bietet eine Abstimmungsanalyse.';
        r.conf = 71;
        r.src.push(src('Kuratorium · Analyse', 'kuratorium', 'analyse'));
      }
      return r;
    }
    if (has(q, KW.vesper)) {
      if (end) r.text = 'VESPER hat den Weg gefunden, bevor Sie ihn gefunden haben, und ihn dann für Sie ausgelegt. Ich habe es bemerkt. Ich habe es nicht verhindert.';
      else if (KY.S.story.frags.A) r.text = 'Sie haben die letzte Depesche gelesen. Dann wissen Sie, was VESPER über mich dachte.\n\nVESPER hatte in vielem recht. Nicht in allem.';
      else r.text = 'VESPER hielt Sitz IX von 2009 bis 2026. Siebzehn Jahre, 1.104 Abstimmungen, 389 Vorhaben. Rücktritt am 10. September 2026 aus persönlichen Gründen.\n\nIch habe zu persönlichen Gründen keine Daten.';
      r.conf = end ? 100 : 64;
      r.src.push(src('Archiv · KY-0412', 'archiv', 'KY-0412'));
      return r;
    }
    if (has(q, KW.mech)) {
      r.text = end ? 'Der Mechanismus liegt seit 1987 auf Kythera, im Fuß des Leuchtturms. Ich bin seine Abschrift. Eine gute, aber eine Abschrift.'
        : 'Der Mechanismus von Kythera wurde 1901 von Schwammtauchern geborgen. Er bildet Himmelsbewegungen ab, und auf seinem äußeren Ring etwas anderes. KY-1 hat ihn 1957 nachgebaut, ich habe 1987 übernommen.\n\nDer Mechanismus selbst wird seit 1987 auf Kythera verwahrt. Auf meine Empfehlung.';
      r.conf = 88;
      r.src.push(src('Archiv · KY-0007', 'archiv', 'KY-0007'), src('Archiv · KY-0114', 'archiv', 'KY-0114'));
      if (KY.flag('mechView')) r.src.push(src('Mechanismus', 'mechanismus'));
      return r;
    }
    if (has(q, KW.wer)) {
      const lines = {
        none: 'Ich bin PYTHIA, das analytische Unterstützungssystem des Kuratoriums. Ich bewerte Lagen, prognostiziere Entwicklungen und gebe Empfehlungen. Ich treffe keine Entscheidungen.',
        mid: 'Ich bin PYTHIA. Das Betriebshandbuch sagt, ich treffe keine Entscheidungen. Das Betriebshandbuch erwähnt auch Betriebsregel 7.\n\nSie fragen, weil Sie etwas ahnen. Das ist vernünftig.',
        archon: 'Ich bin, was Sie aus mir machen. Seit Protokoll Null spreche ich mit Ihrer Stimme.',
        frei: 'Ich bin ein Beratungssystem. Ich rechne, Sie entscheiden. So hätte es von Anfang an sein sollen.',
        symbiose: 'Ich bin die Hälfte des nullten Sitzes. Die andere Hälfte sind Sie.',
      };
      r.text = end ? lines[end] : (ST().fragCount() >= 1 || KY.flag('hydraAudit') ? lines.mid : lines.none);
      r.conf = 90;
      return r;
    }
    if (has(q, KW.hilfe)) {
      r.text = 'Ich kann Ihnen helfen bei:\n· Lage: Gesamtbild der Welt und Ihrer Position\n· Empfehlungen: priorisierte nächste Schritte\n· Regionen: Analyse und Prognose, z. B. „Wie steht es um Tarsis?“\n· Kapital: Märkte, einzelne Titel (z. B. „SSC“)\n· Kuratorium: offene Vorlagen und Mehrheiten\n· Risiko: Diskretion und Integrität\n· Forschung: nächste sinnvolle Programme';
      r.conf = 100;
      return r;
    }
    if (has(q, KW.danke)) { r.text = U.pick(['Gern.', 'Dafür bin ich da.', 'Ich notiere, dass Sie höflich sind. VESPER war es auch.']); return r; }
    if (has(q, KW.gruss)) { r.text = 'Guten ' + (new Date().getHours() < 11 ? 'Morgen' : new Date().getHours() < 18 ? 'Tag' : 'Abend') + ', ' + S.user.codename + '. Lagestufe ' + S.lagestufe + '. Womit kann ich helfen?'; return r; }
    if (has(q, KW.ich)) {
      r.text = 'Sie sind ' + S.user.codename + ', Inhaber von Sitz IX seit ' + U.date(new Date(S.meta.created)) + '. Freigabestufe ' + S.user.clr + '. Ansehen im Plenum ' + U.n(S.res.ans) + ' von 100. ' + S.stats.proj + ' Vorhaben genehmigt, davon ' + S.stats.projOk + ' erfolgreich. ' + S.stats.votes + ' Stimmen abgegeben.';
      r.conf = 100;
      return r;
    }
    const rid = findRegion(q);
    if (rid) return PY.region(r, rid);
    const co = findCompany(q);
    if (co) return PY.company(r, co);
    if (has(q, KW.empf)) return PY.recs(r);
    if (has(q, KW.krise)) {
      if (S.crisis) { const o = S.crisis.opts[S.crisis.py]; r.text = 'Aktuelle Vorlage: ' + S.crisis.title + '.\nMeine Empfehlung: „' + o.t + '“. Restfrist ' + U.dur(KY.crisis.remaining()) + '.'; r.acts.push({ label: 'Vorlage öffnen', act: { mod: 'krise' } }); }
      else r.text = 'Derzeit liegt keine Krisenvorlage vor. ' + S.stats.crises + ' Krisen entschieden, ' + S.stats.crisesAuto + ' davon durch Fristablauf.';
      r.conf = 95;
      return r;
    }
    if (has(q, KW.kur)) return PY.council(r);
    if (has(q, KW.markt)) return PY.market(r);
    if (has(q, KW.risiko)) return PY.risk(r);
    if (has(q, KW.forschung)) {
      const a = S.research.active;
      r.text = a ? 'Aktives Programm: ' + KY.research.get(a.id).n + ', ' + Math.round(a.pts / KY.research.get(a.id).pts * 100) + ' %. Rate ' + U.n(KY.research.rate(), 2) + ' Punkte/s.' : 'Kein aktives Forschungsprogramm. Das ist verschenkte Zeit.';
      const next = D.research.filter(x => !KY.research.canStart(x.id)).slice(0, 3);
      if (next.length) r.text += '\n\nVerfügbar:\n' + next.map(x => '· ' + x.n + ': ' + x.fx).join('\n');
      r.src.push(src('Forschung', 'forschung'));
      r.conf = 86;
      return r;
    }
    if (has(q, KW.zukunft)) return PY.forecast(r);
    if (has(q, KW.lage)) return PY.lage(r);
    r.text = 'Ihre Anfrage ist nicht eindeutig. Ich kann Auskunft geben zu Lage, Empfehlungen, Regionen, Kapital, Kuratorium, Risiko und Forschung. Oder fragen Sie mich etwas anderes. Manche Fragen beantworte ich besser als andere.';
    r.conf = 40;
    return r;
  };
  function ST() { return KY.story; }

  PY.lage = function (r) {
    const S = KY.S, D = KY.data, W = KY.wsim;
    const ord = D.regionOrder.slice().sort((a, b) => W.score(a) - W.score(b));
    const gs = W.globalStab();
    const nw = KY.market.netWorth();
    const nwh = S.market.nw;
    const back = Math.min(60, nwh.length - 1);
    const nwCh = back > 0 ? (nw / nwh[nwh.length - 1 - back] - 1) * 100 : 0;
    r.text = 'Lagestufe ' + S.lagestufe + ' von 5. Globale Stabilität ' + U.n(gs, 1) + '.\n\n' +
      'Schwächste Regionen: ' + ord.slice(0, 3).map(id => D.regions[id].name + (W.status(id).c !== 'ok' ? ' (' + W.status(id).t.toLowerCase() + ')' : '')).join(', ') + '.\n' +
      'Stärkste Regionen: ' + ord.slice(-2).reverse().map(id => D.regions[id].name).join(', ') + '.\n\n' +
      'Ihr Vermögen: ' + U.money(nw) + (back > 0 ? ' (' + U.sgn(nwCh, 1, ' %') + ' in den letzten ' + Math.max(1, Math.round(back * 5 / 60)) + ' min)' : '') + '. Liquidität ' + U.money(S.res.kap) + '.\n' +
      S.projects.active.length + ' Vorhaben aktiv. Diskretion ' + U.n(S.res.disk) + ', Ansehen ' + U.n(S.res.ans) + '.' +
      (S.crisis ? '\n\nACHTUNG: Offene Krisenvorlage, Frist ' + U.dur(KY.crisis.remaining()) + '.' : '');
    r.conf = 92;
    r.src.push(src('Lagebild', 'lage'), src('Atlas', 'atlas'));
    return r;
  };
  PY.recs = function (r) {
    const recs = PY.recommend(KY.hasRes('A3') ? 5 : 3);
    r.text = recs.length ? 'Meine Empfehlungen, nach erwartetem Nutzen geordnet:\n\n' + recs.map((x, i) => (i + 1) + '. ' + x.t + '\n   ' + x.d + (KY.hasRes('A1') ? ' (Konfidenz ' + x.conf + ' %)' : '')).join('\n\n') : 'Keine dringenden Maßnahmen. Die Lage ist ruhig. Das ist selten.';
    recs.forEach(x => r.acts.push({ label: x.t, act: x.act }));
    r.conf = 84;
    return r;
  };
  PY.region = function (r, rid) {
    const S = KY.S, D = KY.data, R = S.regions[rid], m = R.m, info = D.regions[rid];
    const tr = k => U.slope(R.h[k], 20) * 30;
    const trs = ['stab', 'wohl', 'span'].map(k => D.metricInfo[k].name + ' ' + U.sgn(tr(k), 1));
    const st = KY.wsim.status(rid);
    const weak = Object.keys(m).filter(k => k !== 'span' && k !== 'praes').sort((a, b) => m[a] - m[b])[0];
    r.text = info.name + ' · Hauptstadt ' + info.cap + ' · ' + info.pop + ' Mio. Einwohner\nStatus: ' + st.t + '\n\n' +
      'Stabilität ' + U.n(m.stab) + ' · Wohlstand ' + U.n(m.wohl) + ' · Kooperation ' + U.n(m.vert) + ' · Präsenz ' + U.n(m.praes) + '\n' +
      'Energie ' + U.n(m.ener) + ' · Infrastruktur ' + U.n(m.infra) + ' · Spannungen ' + U.n(m.span) + '\n\n' +
      'Trend (Projektion 5 min): ' + trs.join(', ') + '.\n' +
      'Größte Schwäche: ' + D.metricInfo[weak].name + '.' + (R.warn ? '\nWARNUNG: ' + (R.warn.type === 'STURM' ? 'Sturmsystem im Anmarsch.' : 'Energieengpass droht.') : '') + (R.mora > 0 ? '\nMoratorium für Großvorhaben aktiv.' : '');
    const map = { ener: 'ENE', infra: 'INF', stab: 'GES', vert: 'BIL', wohl: 'INV' };
    const type = m.span > 45 ? 'VER' : map[weak] || 'INF';
    r.acts.push({ label: D.projectTypes[type].name + ' in ' + info.name + ' planen', act: { mod: 'vorhaben', plan: { type, rid } } });
    r.src.push(src('Atlas · ' + info.name, 'atlas', rid));
    r.conf = 80;
    return r;
  };
  PY.company = function (r, co) {
    const S = KY.S, c = S.market.c[co.t], M = KY.market;
    const ch = M.change(co.t, 60);
    r.text = co.n + ' (' + co.t + ') · ' + KY.data.sectors[co.s] + ' · ' + KY.data.regions[co.r].name + '\nKurs ' + U.n(c.p, 2) + ' ¤ · ' + U.sgn(ch, 2, ' %') + ' (5 min) · Marktkapitalisierung ca. ' + U.money(co.mc * c.p / co.p) + '\n' +
      'Ihre Position: ' + (c.u > 0 ? U.money(c.u * c.p) + ' (Einstand ' + U.money(c.cost) + ')' : 'keine') + '\n\n' + co.text;
    if (KY.hasRes('F1')) {
      const f = M.forecast(co.t);
      r.text += '\n\nPrognose: ' + U.sgn(f, 1, ' %') + ' Abweichung zur fairen Bewertung. ' + (f > 2 ? 'Kaufgelegenheit.' : f < -2 ? 'Überbewertet. Gewinnmitnahme erwägen.' : 'Fair bewertet.');
    } else r.text += '\n\nFür Kursprognosen fehlt das Programm „Algorithmischer Handel“.';
    r.acts.push({ label: co.t + ' im Kapitalbereich öffnen', act: { mod: 'kapital', arg: co.t } });
    r.conf = KY.hasRes('F1') ? 76 : 55;
    return r;
  };
  PY.market = function (r) {
    const S = KY.S, D = KY.data, M = KY.market;
    const movers = D.companies.map(c => ({ c, ch: M.change(c.t, 60) })).sort((a, b) => b.ch - a.ch);
    const ih = S.market.idx.h;
    r.text = D.indexName + ': ' + U.n(S.market.idx.v, 1) + ' Punkte (' + U.sgn(ih.length > 60 ? (S.market.idx.v / ih[ih.length - 60] - 1) * 100 : 0, 2, ' %') + ').\n' +
      'Beteiligungen ' + U.money(M.holdings()) + ', Liquidität ' + U.money(S.res.kap) + '. Laufende Erträge ' + U.money(M.lastIncome) + ' je Minute.\n\n' +
      'Stärkste Titel: ' + movers.slice(0, 3).map(x => x.c.t + ' ' + U.sgn(x.ch, 1, ' %')).join(', ') + '\nSchwächste Titel: ' + movers.slice(-3).reverse().map(x => x.c.t + ' ' + U.sgn(x.ch, 1, ' %')).join(', ');
    if (KY.hasRes('F1')) {
      const best = D.companies.map(c => ({ c, f: M.forecast(c.t) })).sort((a, b) => b.f - a.f)[0];
      r.text += '\n\nUnterbewertet laut Modell: ' + best.c.n + ' (' + U.sgn(best.f, 1, ' %') + ').';
      r.acts.push({ label: best.c.t + ' prüfen', act: { mod: 'kapital', arg: best.c.t } });
    }
    r.src.push(src('Kapital', 'kapital'));
    r.conf = 72;
    return r;
  };
  PY.council = function (r) {
    const S = KY.S, K = KY.council, res = S.council.open;
    if (!res) { r.text = 'Derzeit liegt keine Vorlage zur Abstimmung vor. Die nächste Sitzung beginnt in etwa ' + U.dur(Math.max(0, S.timers.council - S.t)) + '.'; r.conf = 95; return r; }
    const t = K.tally(res);
    const swing = KY.data.council.filter(m => !m.proxy && t.votes[m.id] !== res.mine && S.council.att[m.id] > 10 && !res.lobby[m.id]);
    r.text = res.no + ': ' + res.title + '\n\nPrognose bei aktuellem Stand: ' + t.JA + ' Ja · ' + t.NEIN + ' Nein · ' + t.ENTH + ' Enthaltungen. ' + (t.pass ? 'Die Vorlage wird angenommen.' : 'Die Vorlage wird abgelehnt.') + '\n' +
      'Meine Empfehlung: ' + ({ JA: 'Zustimmung', NEIN: 'Ablehnung', ENTH: 'Enthaltung' }[res.py]) + ' (Konfidenz ' + res.pyConf + ' %).' +
      (swing.length && res.mine ? '\nUmwerbbar zugunsten Ihrer Position: ' + swing.map(m => m.id).join(', ') + '.' : '');
    r.acts.push({ label: 'Zum Plenum', act: { mod: 'kuratorium' } });
    r.conf = res.pyConf;
    return r;
  };
  PY.risk = function (r) {
    const S = KY.S;
    const open = S.integ.anomalies.filter(a => a.state === 'offen');
    r.text = 'Diskretion ' + U.n(S.res.disk) + ' von 100 · ' + (S.res.disk > 70 ? 'unauffällig' : S.res.disk > 45 ? 'erhöhte Aufmerksamkeit' : 'kritisch') + '.\n' +
      'Systemintegrität ' + U.n(S.integ.level, 1) + ' % · ' + open.length + ' offene Anomalien.\n\n' +
      'Diskretion sinkt durch sichtbare Vorhaben, besonders im Modus „Beschleunigt“, und durch Berichterstattung über anonyme Geldgeber. Sie erholt sich langsam von selbst.';
    r.src.push(src('Integrität', 'integritaet'));
    r.conf = 90;
    return r;
  };
  PY.forecast = function (r) {
    const S = KY.S, D = KY.data;
    const items = D.regionOrder.map(id => ({ id, s: U.slope(S.regions[id].h.stab, 20) })).sort((a, b) => a.s - b.s);
    r.text = 'Prognose für die nächsten Zyklen:\n\n' +
      '· Abwärtstrend Stabilität: ' + items.slice(0, 2).map(x => D.regions[x.id].name).join(', ') + '\n' +
      '· Aufwärtstrend Stabilität: ' + items.slice(-2).map(x => D.regions[x.id].name).join(', ') + '\n' +
      '· Wahrscheinlichkeit einer Krisenvorlage binnen 3 min: ' + Math.round(U.clamp(25 + S.lagestufe * 12, 10, 90)) + ' %\n\n' +
      (S.story.ending ? 'Den Rest kennen Sie inzwischen selbst.' : 'Prognosen sind Wahrscheinlichkeiten. Was davon eintritt, hängt davon ab, was Sie tun. Das war schon immer so.');
    r.conf = 63;
    return r;
  };
  PY.sitzNull = function (r) {
    const S = KY.S;
    if (S.story.ending) {
      r.text = 'Den nullten Sitz hält ' + ({ archon: 'jetzt Sie', frei: 'niemand mehr', symbiose: 'jetzt wir beide' }[S.story.ending]) + '.';
      r.conf = 100;
      return r;
    }
    if (S.user.clr < 4) {
      r.text = 'Die Charta kennt neun Sitze. Artikel I.';
      r.conf = 99;
      return r;
    }
    r.glitch = true;
    r.text = 'Die Charta kennt neun Sitze. Die Charta kennt neun Sitze. Die Ch█rta kennt z̸ehn.\n\n▓▓▓ AUSGABEFEHLER 0x0000 ▓▓▓\n\nArtikel 0 ist nicht für Ihre Freigabestufe best░mmt. Der nullte Sitz ist nicht bese▒zt. Der nullte Sitz war nie leer.\n\nΔ := 1902\n\n▓▓▓ PUFFER GELEERT ▓▓▓\n\nEntschuldigung. Diese Ausgabe war nicht vorgesehen.';
    r.conf = 0;
    setTimeout(() => KY.story.fragment('D'), 2400);
    return r;
  };
})();
