/* KYTHERA · MANDAT · Beraterstab: Begrüßung, Lageberichte, Vorschläge, Jahresbericht */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const A = (KY.advisors = {});

  A.welcome = function () {
    const S = SIM.S, v = S.contracts.vals;
    const tr = SIM.adv('trustee'), en = SIM.adv('envoy');
    const fundTxt = S.fin.fund > 0 ? 'Gemäß Krisenprotokoll stehen ' + U.money(S.fin.fund) + ' im Entschädigungsfonds bereit.' : 'Einen Entschädigungsfonds haben Sie nicht eingerichtet; jede Entschädigung entscheiden Sie einzeln.';
    SIM.msg('kuratorium', 'Das Mandat beginnt', [
      'Sehr geehrte Mandatsperson „' + S.codename + '“,',
      'mit Ihrer Unterschrift ist das Kythera-Vermögen in Ihre Verantwortung übergegangen. Das Kuratorium wird Sie nicht bevormunden. Wir werden Sie aber an Ihren Taten messen.',
      'Wir erwarten Ihren ersten Jahresbericht am ' + U.dateStr(365, true) + '.',
    ], { kind: 'letter' });
    SIM.msg('trustee', 'Treuhand eingerichtet', [
      tr.house + ' hat die Treuhandstruktur in ' + (SIM.JUR[v.jurisdiction] || SIM.JUR.holmvik).n + ' eingerichtet. Liquide verfügbar sind ' + U.money(S.fin.cash) + '.',
      fundTxt,
      'Für Ihre Vorhaben stehen drei Tarnstrukturen bereit: ' + S.fronts.map(f => f.name).join(', ') + '.',
    ]);
    SIM.msg('haddad', 'Krisenstab einsatzbereit', [
      'Ich leite Ihren Krisenstab. Wenn bei einem Ihrer Vorhaben etwas passiert, melde ich mich sofort.',
      'Nach dem Krisenprotokoll haben Sie dann ' + U.days(+v.deadline || 7) + ' Zeit für eine Entscheidung. Was Sie entscheiden, liegt bei Ihnen. Dass Sie entscheiden, nicht.',
    ]);
    SIM.msg('dobrev', 'Zur Tarnung', [
      'Jedes Vorhaben hinterlässt Spuren. Sichtbare Großprojekte mehr als stille Programme, Länder mit freier Presse mehr als andere.',
      'Verteilen Sie Vorhaben auf passende Strukturen: Stiftungen für Soziales, Holdings für Infrastruktur, Fonds für Energie und Natur. Erreicht eine Struktur 100 % Spuren, fliegt sie auf.',
    ]);
    SIM.msg('brennan', 'Stimmungsanalyse', [
      'Noch weiß niemand, dass es Sie gibt. Mit jedem Vorhaben wächst die Bekanntheit des „anonymen Geldgebers“ in dem jeweiligen Land.',
      'Die Bevölkerung reagiert nicht einheitlich: Städter, Arbeiterschaft, Landbevölkerung, Jugend und Traditionelle bewerten Ihre Vorhaben nach eigenen Interessen. Sie lernen aus Unglücken und gewöhnen sich an Wohltaten.',
    ]);
    const tense = Object.keys(S.rel).filter(k => S.rel[k].v < -40).map(k => k.split(':').map(Number));
    SIM.msg('envoy', 'Gesandtschaft bereit', [
      en.name + ', zu Ihren Diensten. Ich vermittle, verhandle und öffne Türen, aber ich drohe nicht und ich kaufe niemanden.',
      tense.length ? 'Angespannte Beziehungen bestehen derzeit zwischen ' + tense.slice(0, 3).map(([a, b]) => SIM.nName(a) + ' und ' + SIM.nName(b)).join(', ') + '.' : 'Derzeit gibt es keine akuten Spannungen.',
    ], { acts: tense.length ? [{ l: 'Vermittlung vorbereiten', a: 'act', p: { id: 'VERMITTLUNG', n: tense[0][0], n2: tense[0][1] } }] : [] });
    A.snapYear();
  };

  A.snapYear = function () {
    const S = SIM.S, g = S.g;
    S.year.snap = { day: S.day, lives: g.lives, deaths: g.deaths, versaeumt: g.versaeumt, breaks: g.breaks.length, op: SIM.worldOp(), aware: SIM.worldAware(), cash: S.fin.cash, spent: g.spent, done: S.projects.filter(p => p.doneAt >= 0).length, inc: S.incidents.length, trust: g.trust, exposure: g.exposure };
  };

  A.monthly = function () {
    const S = SIM.S;
    const m = Math.round(S.day / 30);
    if (m % 2 === 0 && SIM.worldAware() > 4) {
      const ns = S.nations.map((n, id) => ({ id, op: n.op, aware: n.aware })).filter(x => x.aware > 8).sort((a, b) => b.op - a.op);
      if (ns.length) {
        const best = ns.slice(0, 2).map(x => SIM.nName(x.id) + ' (' + U.sgn(x.op, 0) + ')').join(', ');
        const worst = ns.slice(-2).reverse().filter(x => x.op < 0).map(x => SIM.nName(x.id) + ' (' + U.sgn(x.op, 0) + ')').join(', ');
        const prot = S.cities.filter(c => c.protest).length;
        SIM.msg('brennan', 'Stimmungsbericht ' + U.monthStr(S.day), [
          'Weltweite Haltung zum anonymen Geldgeber: ' + U.sgn(SIM.worldOp(), 1) + ' · Bekanntheit ' + U.pct(SIM.worldAware(), 0) + '.',
          'Am positivsten: ' + best + '.' + (worst ? ' Am kritischsten: ' + worst + '.' : ''),
          prot ? prot + ' Protestbewegung' + (prot > 1 ? 'en richten' : ' richtet') + ' sich derzeit gegen Ihre Vorhaben.' : 'Derzeit gibt es keine Proteste gegen Ihre Vorhaben.',
        ], { kind: 'info' });
      }
    }
    if (m % 3 === 0) {
      const f = S.fin;
      SIM.msg('trustee', 'Quartalsbericht der Treuhand', [
        'Liquides Vermögen: ' + U.money(f.cash) + (f.frozen > 0 && S.day < f.frozenUntil ? ' (davon ' + U.money(f.frozen) + ' gesperrt)' : '') + '.',
        'Kapitalerträge seit Jahresbeginn: ' + U.money(f.y.ret) + ' · Einnahmen aus Vorhaben: ' + U.money(f.y.inc) + ' · Ausgaben: ' + U.money(f.y.spent) + '.',
        'Zugesagte, noch offene Zahlungen laufender Vorhaben: ' + U.money(KY.finance.commitments()) + '.',
      ], { kind: 'info' });
    }
    suggest();
  };

  function suggest() {
    const S = SIM.S;
    if (S.g.lastSuggest && S.day - S.g.lastSuggest < 75) return;
    const r = Math.random();
    if (r > 0.55) return;
    const nat = S.nations.map((n, id) => ({ n, id }));
    const cands = [];
    nat.forEach(({ n, id }) => {
      if (n.energy < 38) cands.push({ w: 38 - n.energy, from: 'trustee', id, t: 'Energiemangel in ' + SIM.nName(id), b: ['Die Stromversorgung in ' + SIM.nName(id) + ' ist instabil (' + U.pct(n.energy, 0) + '). Stromausfälle drohen.', 'Ein Solar- oder Windpark könnte helfen und würde sich rechnen.'], act: 'SOLAR' });
      if (n.health < 40) cands.push({ w: 40 - n.health, from: 'haddad', id, t: 'Gesundheitsversorgung in ' + SIM.nName(id), b: ['Die Gesundheitsversorgung in ' + SIM.nName(id) + ' ist kritisch. Jedes Jahr sterben Menschen an vermeidbaren Krankheiten.', 'Eine Impfkampagne oder ein Wasserprogramm würde viele Leben retten.'], act: 'IMPF', pl: { n: id } });
      if (n.poverty > 40) cands.push({ w: (n.poverty - 40) * 0.8, from: 'envoy', id, t: 'Armut in ' + SIM.nName(id), b: ['Fast ' + U.pct(n.poverty, 0) + ' der Menschen in ' + SIM.nName(id) + ' leben in Armut.', 'Mikrokredite und Agrarprogramme wirken direkt bei den Ärmsten.'], act: 'MIKRO', pl: { n: id } });
    });
    S.g.sugg = S.g.sugg || {};
    const fresh = cands.filter(x => !S.g.sugg[x.act + ':' + x.id] || S.day - S.g.sugg[x.act + ':' + x.id] > 540);
    if (!fresh.length) return;
    const c = U.weighted(fresh, x => x.w);
    S.g.sugg[c.act + ':' + c.id] = S.day;
    S.g.lastSuggest = S.day;
    SIM.msg(c.from, c.t, c.b, { kind: 'suggest', acts: [{ l: D.ACT[c.act].name + ' prüfen', a: 'act', p: Object.assign({ id: c.act }, c.pl || {}) }, { l: 'Staat ansehen', a: 'nation', p: { id: c.id } }], ref: { n: c.id } });
  }

  /* ---------- Jahresbericht ---------- */
  A.yearly = function () {
    const S = SIM.S, g = S.g, sn = S.year.snap || {};
    const d = {
      year: S.year.n, day: S.day, lives: Math.round(g.lives - (sn.lives || 0)), deaths: g.deaths - (sn.deaths || 0), versaeumt: g.versaeumt - (sn.versaeumt || 0),
      breaks: g.breaks.length - (sn.breaks || 0), op: SIM.worldOp() - (sn.op || 0), spent: g.spent - (sn.spent || 0), done: S.projects.filter(p => p.doneAt >= 0).length - (sn.done || 0),
      inc: S.incidents.length - (sn.inc || 0), cash: S.fin.cash, trust: g.trust, exposure: g.exposure, ret: S.fin.y.ret,
    };
    let score = 0;
    score += Math.min(4, Math.log10(1 + d.lives) - 1.5);
    score -= Math.min(4, Math.log10(1 + d.deaths) * 0.9);
    score -= d.versaeumt * 0.8 + d.breaks * 0.7;
    score += d.op / 6 + Math.min(2, d.done * 0.2);
    const grade = score > 3 ? 'herausragend' : score > 1.5 ? 'überzeugend' : score > 0 ? 'solide' : score > -1.5 ? 'durchwachsen' : 'enttäuschend';
    d.score = score; d.grade = grade;
    S.reports = S.reports || [];
    S.reports.push(d);
    const dt = U.clamp(score * 1.5, -8, 8);
    SIM.g_trust(dt);
    const lines = [
      'Das Kuratorium hat Ihren ' + d.year + '. Jahresbericht geprüft und bewertet Ihr Mandatsjahr als ' + grade + '.',
      'Ihre Vorhaben haben in diesem Jahr schätzungsweise ' + U.n(d.lives) + ' Menschen das Leben gerettet. ' + (d.deaths ? U.n(d.deaths) + ' Menschen sind bei Vorfällen in Ihrer Verantwortung ums Leben gekommen.' : 'Kein Mensch ist bei Vorfällen in Ihrer Verantwortung ums Leben gekommen.'),
      'Fertiggestellt: ' + d.done + ' Vorhaben · Ausgaben ' + U.money(d.spent) + ' · Kapitalerträge ' + U.money(d.ret) + '.',
    ];
    if (d.versaeumt) lines.push('Mit Sorge stellen wir ' + d.versaeumt + ' Versäumnis' + (d.versaeumt > 1 ? 'se' : '') + ' gemäß Krisenprotokoll fest.');
    if (d.breaks) lines.push('Sie haben ' + d.breaks + '-mal gegen Ihre eigenen Grundsätze gehandelt.');
    lines.push(score > 0 ? 'Wir danken Ihnen für Ihre Arbeit und sehen dem kommenden Jahr mit Zuversicht entgegen.' : 'Wir erwarten im kommenden Jahr eine sorgfältigere Mandatsführung.');
    SIM.msg('kuratorium', 'Jahresbericht ' + d.year + ' · Bewertung: ' + grade, lines, { kind: 'letter', prio: 2, acts: [{ l: 'Bilanz öffnen', a: 'panel', p: { id: 'verantwortung' } }] });
    SIM.chron('kuratorium', 'Jahresbericht ' + d.year + ': Das Kuratorium bewertet das Mandatsjahr als ' + grade + '.', null);
    S.year.n++;
    A.snapYear();
    KY.bus.emit('report', d);
  };
})();
