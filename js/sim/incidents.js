/* KYTHERA · MANDAT · Vorfälle, Verantwortungsregister, Druck, Vertrauen des Kuratoriums, Grundsätze */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const I = (KY.incidents = {});

  const strict = () => (SIM.S && SIM.TRUSTEE[SIM.contract('trustee')] || { strict: 1 }).strict;
  const PHYSICAL = k => !(D.INCIDENTS[k] && D.INCIDENTS[k].noHarm);

  /* Vertrauen des Kuratoriums ändern (mit Schwellen-Briefen) */
  SIM.g_trust = function (dv) {
    const g = SIM.S.g;
    const before = g.trust;
    g.trust = U.clamp(g.trust + dv, 0, 100);
    [40, 25, 12].forEach(th => { if (before >= th && g.trust < th) KY.bus.emit('trustlow', th); });
  };

  I.byId = id => SIM.S.incidents.find(i => i.id === id);
  I.open = () => SIM.S.incidents.filter(i => i.status === 'offen');

  /* Kosten einer angemessenen Entschädigung (Mrd. ¤) */
  I.compCost = function (inc) {
    const n = inc.n >= 0 ? SIM.S.nations[inc.n] : { dev: 0.5 };
    const k = 0.35 + n.dev * 1.3;
    return Math.max(0.002, (inc.dead * 0.0016 + inc.injured * 0.00018 + inc.displaced * 0.000025) * k + inc.dmg * 0.15);
  };
  I.respCost = function (inc, rid) {
    const p = KY.projects.byId(inc.proj);
    switch (rid) {
      case 'comp': return Math.max(0, I.compCost(inc) - (inc.fundPaid || 0));
      case 'inquiry': return 0.02 + inc.sev * 0.015;
      case 'retrofit': return p && !p.retrofit ? Math.max(0.01, p.cost * 0.08) : 0;
      case 'statement': return 0.004;
      default: return 0;
    }
  };
  I.respAvailable = function (inc, rid) {
    const p = KY.projects.byId(inc.proj);
    const active = p && KY.projects.ACTIVE[p.phase];
    if (rid === 'retrofit') return active && !p.retrofit && PHYSICAL(inc.rid);
    if (rid === 'pause') return active && p.phase !== 'pausiert' && p.phase !== 'antrag';
    if (rid === 'shutdown') return active;
    if (rid === 'comp') return PHYSICAL(inc.rid) && (inc.dead + inc.injured + inc.displaced > 0);
    return true;
  };

  /* ---------- Neuer Vorfall ---------- */
  I.create = function (p, r, extra) {
    const S = SIM.S, A = D.ACT[p.act], T = D.INCIDENTS[r.id];
    if (!T) return null;
    extra = extra || {};
    const safety = p.o.safety || 'std';
    let sev = r.sev[0] + Math.floor(Math.pow(Math.random(), 1.8) * (r.sev[1] - r.sev[0] + 1));
    if (safety === 'max' && Math.random() < 0.5) sev = Math.max(r.sev[0], sev - 1);
    if (safety === 'min' && Math.random() < 0.3) sev = Math.min(r.sev[1], sev + 1);
    if (p.retrofit && Math.random() < 0.4) sev = Math.max(r.sev[0], sev - 1);
    sev = U.clamp(sev, 1, 5);
    const n = p.n >= 0 ? S.nations[p.n] : null;
    const devK = n ? 1.45 - n.dev * 0.7 : 1;
    const safK = safety === 'max' ? 0.7 : safety === 'min' ? 1.3 : 1;
    let popK = 1;
    if (T.scalePop) {
      const down = p.c >= 0 ? S.cities[p.c].pop : 1;
      popK = U.clamp(0.45 + down / 2.5, 0.5, 3);
    }
    const dead = PHYSICAL(r.id) ? Math.round(SIM.rangeRoll(T.dead[sev - 1], 1.5) * devK * safK * popK) : 0;
    const injured = PHYSICAL(r.id) ? Math.round(SIM.rangeRoll(T.inj[sev - 1], 1.3) * devK * popK) : 0;
    const displaced = T.disp ? Math.round(SIM.rangeRoll(T.disp[sev - 1], 1.3) * popK) : 0;
    const dmg = extra.loss !== undefined ? extra.loss : p.cost * T.dmg[sev - 1];
    const vars = SIM.vars({ n: p.n, c: p.c, c2: p.c2, extra: { proj: A.name, mag: U.n(3.2 + sev * 0.45, 1) } });
    const descIdx = T.nuclear ? Math.min(T.d.length - 1, Math.max(0, sev - 2)) : Math.floor(Math.random() * T.d.length);
    const inc = {
      id: 'i' + (++S.seq.inc), day: S.day, proj: p.id, act: p.act, projName: p.name, n: p.n, c: p.c, front: p.front, rid: r.id, kind: T.kind, name: T.n, icon: T.icon,
      sev, title: U.fill(T.d[descIdx], vars), cause: U.pick(T.cause), causeKnown: false, dead, deadNow: sev >= 3 ? Math.round(dead * 0.3) : dead,
      injured, displaced, dmg, heat: 0, status: 'offen', deadline: S.day + (+SIM.contract('deadline') || 7), responses: [], decidedAt: -1,
      versaeumt: false, fundPaid: 0, comp: 0, noHarm: !PHYSICAL(r.id), lon: p.lon, lat: p.lat, phase: p.phase, safety, lossFin: extra.loss || 0,
    };
    inc.heat = U.clamp((inc.noHarm ? sev * 4 : sev * sev * 3.4 + Math.sqrt(dead) * 1.7 + (displaced > 10000 ? 8 : 0)) * (T.nuclear ? 1.5 : 1) * Math.pow(Math.max(1, p.vis) / 5, 0.3), 2, 160);
    S.incidents.unshift(inc);
    p.incidents.push(inc.id);
    // Bilanz der Verantwortung
    S.g.deaths += inc.deadNow; S.g.injured += injured; S.g.displaced += displaced;
    // Folgen für das Vorhaben
    const T2 = T.delay[sev - 1];
    if (p.phase === 'bau' && T2 > 0) { p.prog = Math.max(0, p.prog - T2 / p.days); }
    if (!inc.noHarm || r.id === 'kostenexplosion') p.cost += r.id === 'kostenexplosion' ? dmg : dmg * 0.5;
    const destroys = (r.id === 'dammbruch' && sev >= 3) || (r.id === 'stoerfall' && sev >= 4) || (r.id === 'einsturz' && sev >= 4) || (r.id === 'deichbruch' && sev >= 4) || (r.id === 'hafenbrand' && sev >= 5);
    if (destroys && p.phase === 'betrieb') { KY.projects.shutdown(p, 'zerstört'); p.destroyed = true; }
    if (p.c >= 0 && !inc.noHarm) {
      const c = S.cities[p.c];
      c.sent = U.clamp(c.sent - inc.heat * 0.45, -100, 100);
      c.dmg = U.clamp(c.dmg + sev * 0.04 + (displaced > 50000 ? 0.2 : 0), 0, 1);
    }
    if (n) {
      SIM.opImpulse(p.n, [-1, -1, -1.1, -1, -1], inc.heat * 0.07, { aware: inc.heat * 0.15 });
      if (!inc.noHarm) { SIM.shock(p.n, 'happy', -(sev - 1) * 1.4, 120); SIM.shock(p.n, 'unrest', sev * 1.2, 120); }
      if (T.env) SIM.shock(p.n, 'env', -sev * 2.4, 720);
      if (dead > 0) n.pop = Math.max(0.01, n.pop - dead / 1e6);
      n.fear[p.act] = Math.min(2, (n.fear[p.act] || 0) + sev * 0.09 + (dead > 20 ? 0.2 : 0));
    }
    S.g.fear[p.act] = Math.min(1.5, (S.g.fear[p.act] || 0) + sev * 0.04 + (dead > 100 ? 0.25 : 0));
    // Nachbarstaaten bei Strahlung oder Dammbruch flussabwärts
    if (r.id === 'stoerfall' && sev >= 4 && p.n >= 0) SIM.W.nations[p.n].neighbors.forEach(b => { SIM.relAdd(p.n, b, -10, 'stoerfall'); SIM.opImpulse(b, -0.6, sev * 1.2, { aware: 6 }); });
    if (r.id === 'dammbruch' && p.down >= 0) SIM.relAdd(p.n, p.down, -15, 'dammbruch');
    // Vertrauen
    SIM.g_trust(-(inc.noHarm ? sev * 0.7 : sev * 1.5 + Math.sqrt(dead) * 0.22) * strict());
    // Spuren: große Vorfälle ziehen Recherchen nach sich
    KY.cover.onIncident(inc, T);
    // Entschädigungsfonds zahlt sofort Soforthilfe
    if (!inc.noHarm && S.fin.fund > 0 && (dead + injured + displaced) > 0) {
      const want = I.compCost(inc) * 0.5;
      const pay = Math.min(S.fin.fund, want);
      S.fin.fund -= pay; inc.fundPaid = pay; S.fin.y.comp += pay;
      inc.heat *= +SIM.contract('fund') >= 3 ? 0.62 : 0.8;
    }
    // Medien
    const key = inc.noHarm ? null : dead >= 40 || sev >= 4 ? 'incident_major' : dead > 0 ? 'incident_deaths' : 'incident_minor';
    const mv = { n: p.n, c: p.c, extra: { proj: A.name, dead: U.n(inc.deadNow), front: KY.projects.frontName(p) } };
    if (key) KY.media.story(key, mv, { tone: -0.8, heat: inc.heat, about: true, proj: p.id, inc: inc.id, sub: inc.title });
    else KY.media.story(null, mv, { h: inc.title, tone: -0.35, heat: inc.heat, about: true, proj: p.id, inc: inc.id, key: 'incident_fin' });
    SIM.chron('vorfall', inc.name + ': ' + inc.title + (dead ? ' ' + U.n(inc.deadNow) + ' Tote.' : ''), { inc: inc.id, proj: p.id });
    SIM.msg('haddad', (sev >= 3 ? 'DRINGEND · ' : '') + inc.name + ' · ' + p.name,
      [inc.title, dead ? 'Erste Meldungen sprechen von ' + U.n(inc.deadNow) + ' Toten und ' + U.n(injured) + ' Verletzten.' : injured ? U.n(injured) + ' Menschen wurden verletzt.' : 'Nach ersten Erkenntnissen gibt es keine Verletzten.',
        'Gemäß Krisenprotokoll brauche ich Ihre Entscheidung bis ' + U.dateStr(inc.deadline, true) + '.'],
      { kind: 'crisis', prio: sev, acts: [{ l: 'Krisenstab öffnen', a: 'inc', p: { id: inc.id } }], ref: { inc: inc.id } });
    KY.bus.emit('incident', inc);
    return inc;
  };

  /* ---------- Entscheidung des Krisenstabs ---------- */
  I.respond = function (incId, ids) {
    const S = SIM.S, inc = I.byId(incId);
    if (!inc || inc.status !== 'offen') return { ok: false, err: 'Vorfall bereits entschieden.' };
    ids = ids.filter(id => I.respAvailable(inc, id) || id === 'silence' || id === 'statement' || id === 'inquiry');
    if (!ids.length) ids = ['silence'];
    if (ids.indexOf('silence') >= 0 && ids.length > 1) ids = ids.filter(i => i !== 'silence');
    const cost = U.sum(ids.map(id => I.respCost(inc, id)));
    if (cost > KY.finance.avail()) return { ok: false, err: 'Nicht genügend liquide Mittel (' + U.money(cost) + ').' };
    const p = KY.projects.byId(inc.proj);
    const late = S.day > inc.deadline;
    const mv = { n: inc.n, c: inc.c, extra: { proj: D.ACT[inc.act].name, front: p ? KY.projects.frontName(p) : 'Betreiber' } };
    const strictK = strict();
    let heatK = 1;
    ids.forEach(id => {
      const R = D.RESPONSES.find(r => r.id === id);
      const c = I.respCost(inc, id);
      if (c > 0) KY.finance.spend(c, R.n + ' · ' + inc.projName);
      SIM.g_trust(R.trust * (late ? 0.5 : 1) * (R.trust < 0 ? strictK : 1));
      if (inc.n >= 0) SIM.opImpulse(inc.n, 1, R.op * (0.4 + inc.sev * 0.25));
      if (inc.c >= 0) S.cities[inc.c].sent = U.clamp(S.cities[inc.c].sent + R.op * 1.6, -100, 100);
      if (R.trace && p) KY.cover.addTrace(p.front, R.trace);
      switch (id) {
        case 'comp': inc.comp = c; S.fin.y.comp += c; heatK *= 0.55; KY.media.story('followup_comp', mv, { tone: 0.3, heat: inc.heat * 0.4, about: true, proj: inc.proj }); break;
        case 'inquiry': heatK *= 0.72; inc.inquiryAt = S.day + 60 + Math.floor(Math.random() * 60); KY.media.story('followup_inquiry', mv, { tone: 0.15, heat: inc.heat * 0.3, about: true, proj: inc.proj }); break;
        case 'retrofit': if (p) KY.projects.retrofit(p); heatK *= 0.8; KY.media.story('followup_retrofit', mv, { tone: 0.15, heat: inc.heat * 0.25, about: true, proj: inc.proj }); break;
        case 'pause': if (p) KY.projects.pause(p, 90); heatK *= 0.75; break;
        case 'shutdown': if (p) KY.projects.shutdown(p, 'nach Vorfall'); heatK *= 0.45; KY.media.story('followup_shutdown', mv, { tone: 0.2, heat: inc.heat * 0.35, about: true, proj: inc.proj }); break;
        case 'statement': {
          const face = S.g.face;
          heatK *= face ? 0.72 : 0.86;
          if (face) face.cred = Math.max(0, face.cred - inc.sev * 2);
          KY.media.story('followup_apology', mv, { tone: 0.15, heat: inc.heat * 0.3, about: true, proj: inc.proj });
          break;
        }
        case 'silence': inc.silent = true; inc.silentNews = S.day + 4; break;
      }
    });
    inc.heat *= heatK;
    inc.responses = ids; inc.status = 'bearbeitet'; inc.decidedAt = S.day; inc.late = late;
    SIM.chron('verantwortung', 'Entscheidung zu „' + inc.name + ' · ' + inc.projName + '“: ' + ids.map(id => D.RESPONSES.find(r => r.id === id).n).join(', ') + (late ? ' (nach Fristablauf)' : '') + '.', { inc: inc.id });
    KY.bus.emit('responded', inc);
    return { ok: true, cost };
  };

  /* ---------- Grundsätze ---------- */
  I.principleBreak = function (b, p) {
    const S = SIM.S;
    const e = { id: b.id, n: b.n, day: S.day, proj: p ? p.id : null, projName: p ? p.name : '' };
    S.g.breaks.push(e);
    SIM.g_trust(-7 * strict());
    SIM.chron('grundsatz', 'Grundsatzbruch: „' + b.n + '“' + (p ? ' durch ' + p.name : '') + '.', { proj: p ? p.id : null });
    SIM.msg('kuratorium', 'Grundsatzbruch · ' + b.n, ['Das Kuratorium hat zur Kenntnis genommen, dass Sie gegen Ihren eigenen Grundsatz „' + b.n + '“ gehandelt haben' + (p ? ' (' + p.name + ')' : '') + '.', 'Ihre Grundsätze waren freiwillig. Gerade deshalb wiegt ihr Bruch schwer. Der Vorgang wurde gemäß Grundsatzerklärung KY-M/2027/08 protokolliert.'], { kind: 'letter' });
    if (strict() > 1.2) SIM.msg('trustee', 'Bedenken der Treuhand', ['Wir führen Ihre Weisung aus. Erlauben Sie mir dennoch den Hinweis, dass unser Haus Grundsatzbrüche nicht leichtnimmt. Bei Wiederholung behalten wir uns vor, einzelne Zahlungen bis zu 30 Tage zurückzuhalten.'], { kind: 'warn' });
    const f = p ? S.fronts.find(z => z.id === p.front) : null;
    if (f && (f.trace > 55 || f.exposed || S.g.exposed)) KY.media.story('principle_break', { n: p.n, extra: { proj: D.ACT[p.act].name } }, { tone: -0.6, heat: 30, about: true, proj: p.id });
    KY.bus.emit('break', e);
  };

  /* ---------- Täglich: Opferzahlen, Fristen, Druck ---------- */
  I.daily = function () {
    const S = SIM.S, g = S.g;
    let P = 0;
    for (const inc of S.incidents) {
      if (inc.deadNow < inc.dead) {
        const add = Math.max(1, Math.round((inc.dead - inc.deadNow) * 0.42));
        const before = inc.deadNow;
        inc.deadNow = Math.min(inc.dead, inc.deadNow + add);
        g.deaths += inc.deadNow - before;
        if (inc.deadNow === inc.dead && inc.dead >= 10 && inc.dead > before * 1.25) {
          const A = D.ACT[inc.act];
          KY.media.story('incident_deaths', { n: inc.n, c: inc.c, extra: { proj: A.name, dead: U.n(inc.dead) } }, { tone: -0.7, heat: inc.heat * 0.6, about: true, proj: inc.proj, inc: inc.id });
        }
      }
      if (inc.status === 'offen') {
        const over = S.day > inc.deadline;
        if (S.day === inc.deadline - 1 && !inc.reminded) {
          inc.reminded = true;
          SIM.msg('haddad', 'Frist läuft ab · ' + inc.projName, ['Morgen endet die Frist für Ihre Entscheidung zum Vorfall „' + inc.name + '“. Die Öffentlichkeit wartet auf eine Reaktion.'], { kind: 'crisis', acts: [{ l: 'Krisenstab öffnen', a: 'inc', p: { id: inc.id } }], ref: { inc: inc.id } });
        }
        if (over && !inc.versaeumt) {
          inc.versaeumt = true; g.versaeumt++;
          SIM.g_trust(-7 * strict());
          inc.heat = Math.min(180, inc.heat * 1.35);
          const p = KY.projects.byId(inc.proj);
          KY.media.story('followup_silence', { n: inc.n, c: inc.c, extra: { proj: D.ACT[inc.act].name, front: p ? KY.projects.frontName(p) : 'Betreiber' } }, { tone: -0.6, heat: inc.heat * 0.5, about: true, proj: inc.proj });
          SIM.chron('verantwortung', 'Versäumnis: Frist zum Vorfall „' + inc.name + ' · ' + inc.projName + '“ verstrichen.', { inc: inc.id });
          SIM.msg('kuratorium', 'Versäumnis gemäß Krisenprotokoll', ['Die Frist zur Entscheidung über den Vorfall „' + inc.name + '“ (' + inc.projName + ') ist ohne Entscheidung verstrichen.', 'Das Kuratorium erinnert an Ihre Verpflichtung aus KY-M/2027/06. Das Versäumnis wurde im Verantwortungsregister vermerkt.'], { kind: 'letter', ref: { inc: inc.id } });
        }
        if (inc.heat > 20) inc.heat *= 1.002;
        P += inc.heat * (over ? 1.5 : 1);
      } else {
        inc.heat *= inc.silent ? 0.994 : 0.985;
        P += inc.heat * (inc.silent ? 0.7 : 0.35);
        if (inc.silent && inc.silentNews && S.day >= inc.silentNews) {
          inc.silentNews = 0;
          const p = KY.projects.byId(inc.proj);
          if (inc.sev >= 2) KY.media.story('followup_silence', { n: inc.n, c: inc.c, extra: { proj: D.ACT[inc.act].name, front: p ? KY.projects.frontName(p) : 'Betreiber' } }, { tone: -0.5, heat: inc.heat * 0.4, about: true, proj: inc.proj });
          if (inc.n >= 0) SIM.opImpulse(inc.n, -1, inc.sev * 0.9);
        }
        if (inc.inquiryAt && S.day >= inc.inquiryAt) inquiryResult(inc);
      }
    }
    // Proteste gegen eigene Vorhaben
    S.cities.forEach(c => { if (c.protest) P += (c.protest.stage + 1) * (c.protest.stage + 1) * 1.6; });
    // Medienklima, Vertrauen, Enttarnung, Grundsatzbrüche
    g.mediaNeg = (g.mediaNeg || 0) * 0.97;
    P += g.mediaNeg * 0.6;
    P += (100 - g.trust) * 0.14;
    if (g.exposure > 60) P += (g.exposure - 60) * 0.4;
    P += g.breaks.filter(b => S.day - b.day < 180).length * 4;
    const target = U.clamp(P * 0.55, 0, 100);
    g.pressure += (target - g.pressure) * 0.08;
    if (g.pressure > 78) { if (g.highSince < 0) g.highSince = S.day; } else g.highSince = -1;
    if (S.day - g.lastHearing > 240 && ((g.highSince >= 0 && S.day - g.highSince > 20) || g.trust < 25) && !g.hearing) I.callHearing();
    if (g.auflagen && S.day >= g.auflagen.until) {
      SIM.chron('kuratorium', 'Die Auflagen des Kuratoriums sind ausgelaufen.', null);
      SIM.msg('kuratorium', 'Auflagen aufgehoben', ['Die befristeten Auflagen sind ausgelaufen. Das Kuratorium vertraut darauf, dass Sie die Lehren daraus beherzigen.'], { kind: 'letter' });
      g.auflagen = null;
    }
  };

  function inquiryResult(inc) {
    const S = SIM.S;
    inc.inquiryAt = 0; inc.causeKnown = true;
    const p = KY.projects.byId(inc.proj);
    let verdict = 'Die Untersuchung nennt als Ursache ' + inc.cause + '.';
    if (inc.safety === 'min') { verdict += ' Die Kommission kritisiert ausdrücklich, dass beim Sicherheitsstandard gespart wurde.'; SIM.g_trust(-5 * strict()); if (inc.n >= 0) SIM.opImpulse(inc.n, -1, 3); }
    else if (inc.safety === 'max') { verdict += ' Die Kommission bescheinigt dem Betreiber vorbildliche Sicherheitsstandards.'; SIM.g_trust(3); }
    inc.verdict = verdict;
    SIM.chron('verantwortung', 'Untersuchungsbericht zu „' + inc.name + ' · ' + inc.projName + '“: ' + verdict, { inc: inc.id });
    SIM.msg('haddad', 'Untersuchungsbericht liegt vor · ' + inc.projName, [verdict], { kind: 'info', ref: { inc: inc.id } });
    if (p) KY.cover.addTrace(p.front, 4);
  }

  /* ---------- Anhörung vor dem Kuratorium ---------- */
  I.callHearing = function () {
    const S = SIM.S, g = S.g;
    const qs = [];
    const deadSum = g.deaths, lives = Math.round(g.lives);
    qs.push({
      q: 'In Ihrer Verantwortung sind bisher ' + U.n(deadSum) + ' Menschen ums Leben gekommen. Nach unseren Schätzungen haben Ihre Vorhaben ' + U.n(lives) + ' Leben gerettet. Wie bewerten Sie diese Bilanz?',
      a: [
        { t: 'Jedes einzelne Opfer ist eines zu viel. Ich lasse alle laufenden Anlagen auf den höchsten Standard prüfen.', trust: 7, fx: 'safety' },
        { t: 'Die Bilanz ist eindeutig positiv. Großprojekte bergen Risiken, das war allen bewusst.', trust: lives > deadSum * 20 ? 3 : -5 },
        { t: 'Die Partner vor Ort haben versagt. Wir ziehen Konsequenzen bei der Auswahl.', trust: -3, fx: 'access' },
      ],
    });
    const open = I.open().length;
    qs.push({
      q: open ? 'Es sind ' + open + ' Vorfälle ohne Entscheidung. Warum lassen Sie die Betroffenen warten?' : 'Die Öffentlichkeit fühlt sich von Ihnen nicht ausreichend informiert. Wie wollen Sie damit umgehen?',
      a: [
        { t: 'Ich werde jede offene Entscheidung binnen einer Woche treffen und Entschädigungen großzügig bemessen.', trust: 5, fx: 'fund' },
        { t: 'Gründlichkeit geht vor Schnelligkeit. Ich entscheide, wenn alle Fakten vorliegen.', trust: open ? -2 : 1 },
        { t: 'Das Mandat gibt mir freies Ermessen. Ich bitte um Ihr Vertrauen.', trust: -4 },
      ],
    });
    qs.push({
      q: 'Journalisten kommen Ihren Strukturen näher. Was geschieht, wenn Ihre Rolle bekannt wird?',
      a: [
        { t: 'Dann stehe ich über das öffentliche Gesicht zu jedem Vorhaben. Ich habe nichts zu verbergen außer meinem Namen.', trust: 4 },
        { t: 'Das wird nicht geschehen. Ich verstärke die Tarnung.', trust: -1, fx: 'trace' },
        { t: 'Ich würde das Mandat vorübergehend ruhen lassen.', trust: 1 },
      ],
    });
    g.hearing = { day: S.day, qs, answers: [] };
    g.lastHearing = S.day;
    SIM.chron('kuratorium', 'Das Kuratorium lädt zu einer Anhörung.', null);
    SIM.msg('kuratorium', 'Einladung zur Anhörung', ['Angesichts der jüngsten Entwicklungen bittet das Kuratorium Sie zu einer vertraulichen Anhörung. Die Sitzung findet über den verschlüsselten Kanal statt.', 'Bitte bereiten Sie sich auf Fragen zu Ihrer Verantwortung, zu offenen Vorfällen und zur Geheimhaltung vor.'], { kind: 'letter', prio: 3, acts: [{ l: 'Zur Anhörung', a: 'hearing', p: {} }] });
    KY.bus.emit('hearing', g.hearing);
  };
  I.answerHearing = function (answers) {
    const S = SIM.S, g = S.g, H = g.hearing;
    if (!H) return;
    let dt = 0;
    answers.forEach((ai, qi) => {
      const a = H.qs[qi].a[ai];
      dt += a.trust;
      if (a.fx === 'safety') { g.auflagen = { kind: 'safety', until: S.day + 180, self: true }; }
      if (a.fx === 'access') S.nations.forEach(n => { n.access *= 0.94; });
      if (a.fx === 'trace') S.fronts.forEach(f => { f.trace = Math.max(0, f.trace - 4); });
    });
    SIM.g_trust(dt);
    g.hearings.push({ day: H.day, answers, dt });
    g.hearing = null;
    SIM.chron('kuratorium', 'Anhörung vor dem Kuratorium beendet (Vertrauen ' + U.sgn(dt, 0) + ').', null);
    SIM.msg('kuratorium', 'Ergebnis der Anhörung', [dt >= 6 ? 'Das Kuratorium dankt Ihnen für Ihre offenen Worte. Wir sehen, dass Sie die Last dieses Mandats ernst nehmen.' : dt >= 0 ? 'Das Kuratorium hat Ihre Antworten zur Kenntnis genommen. Wir werden die Entwicklung aufmerksam verfolgen.' : 'Ihre Antworten haben das Kuratorium nicht überzeugt. Wir behalten uns weitere Schritte gemäß Mandatsvertrag vor.'].concat(g.auflagen && g.auflagen.self ? ['Ihre Selbstverpflichtung zum höchsten Sicherheitsstandard gilt für 180 Tage.'] : []), { kind: 'letter' });
  };

  KY.bus.on('trustlow', th => {
    const S = SIM.S;
    if (!S) return;
    if (th === 40) SIM.msg('kuratorium', 'Sorge des Kuratoriums', ['Das Vertrauen des Kuratoriums in Ihre Mandatsführung hat spürbar gelitten.', 'Wir bitten Sie, die Folgen Ihrer Entscheidungen sorgfältiger abzuwägen und offene Vorfälle zeitnah zu entscheiden.'], { kind: 'letter' });
    if (th === 25) SIM.msg('kuratorium', 'Ernste Bedenken', ['Das Kuratorium hat ernste Bedenken. Sollte sich die Lage nicht bessern, werden wir von unserem Recht auf Auflagen Gebrauch machen.'], { kind: 'letter', prio: 2 });
    if (th === 12 && !S.g.auflagen) {
      const kind = Math.random() < 0.5 ? 'safety' : 'freeze';
      S.g.auflagen = { kind, until: S.day + 180 };
      if (kind === 'freeze') KY.finance.freeze(0.15, 180);
      SIM.chron('kuratorium', 'Das Kuratorium verhängt Auflagen: ' + (kind === 'safety' ? 'nur höchster Sicherheitsstandard' : '15 % des Vermögens eingefroren') + ' für 180 Tage.', null);
      SIM.msg('kuratorium', 'Auflagen gemäß Mandatsvertrag', [kind === 'safety' ? 'Mit sofortiger Wirkung dürfen neue Vorhaben für 180 Tage nur noch mit dem höchsten Sicherheitsstandard angeordnet werden.' : 'Mit sofortiger Wirkung werden 15 % des Vermögens für 180 Tage auf einem Sperrkonto verwahrt.', 'Das Mandat bleibt bestehen. Das Kuratorium hofft, dass diese Maßnahme nur vorübergehend nötig ist.'], { kind: 'letter', prio: 3 });
    }
  });

  /* Meilensteine geretteter Leben */
  I.monthly = function () {
    const S = SIM.S, g = S.g;
    [1000, 10000, 100000, 1000000, 10000000].forEach(m => {
      if (g.lives >= m && !g.milestones['l' + m]) {
        g.milestones['l' + m] = S.day;
        SIM.g_trust(3);
        if (SIM.worldAware() > 15) KY.media.story('milestone_lives', { extra: { n: U.count(m) } }, { tone: 0.6, heat: 30, about: true, global: true });
        SIM.chron('bilanz', 'Meilenstein: Ihre Vorhaben haben schätzungsweise ' + U.count(m) + ' Menschenleben gerettet.', null);
        SIM.msg('kuratorium', 'Ein Meilenstein', ['Nach unseren Berechnungen haben Ihre Vorhaben inzwischen mehr als ' + U.count(m) + ' Menschen das Leben gerettet.', 'Das Kuratorium möchte Ihnen dafür ausdrücklich danken.'], { kind: 'letter' });
      }
    });
    // Vertrauen erholt sich langsam, Druck zehrt daran
    const target = 62;
    g.trust += (target - g.trust) * 0.02;
    if (g.pressure > 60) SIM.g_trust(-0.6);
    U.push(g.pressHist, Math.round(g.pressure), 240);
    // Angst vor Vorhabentypen verblasst
    for (const k in g.fear) g.fear[k] *= 0.97;
    S.nations.forEach(n => { for (const k in n.fear) n.fear[k] *= 0.975; });
  };
})();
