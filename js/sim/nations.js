/* KYTHERA · MANDAT · Staaten und Städte: Wirtschaft, Gesellschaft, Politik, Beziehungen */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const NS = (KY.nations = {});

  const SLOPE = { happy: 38, unrest: -24, stab: 42, health: 58, edu: 64, infra: 62, energy: 42, tech: 7, corrupt: -60, press: 30, unemp: -13 };
  const RATE = { happy: 1 / 40, unrest: 1 / 30, stab: 1 / 90, health: 1 / 260, edu: 1 / 420, infra: 1 / 200, energy: 1 / 90, clean: 1 / 160, env: 1 / 220, tech: 1 / 500, corrupt: 1 / 300, press: 1 / 200, unemp: 1 / 120, poverty: 1 / 360 };
  const LIM = { tech: [0.2, 12], unemp: [1, 45], poverty: [0.2, 85] };

  function shockSum(n, day) {
    const out = {};
    if (!n.shock.length) return out;
    n.shock = n.shock.filter(s => s.until > day);
    for (const s of n.shock) {
      const left = (s.until - day) / s.d;
      out[s.k] = (out[s.k] || 0) + s.v * Math.min(1, left * 1.4);
    }
    return out;
  }

  /* Gleichgewichtswerte: wohin sich ein Staat ohne neue Einflüsse entwickelt */
  function equilibrium(n, day) {
    const fx = n.fx, sh = shockSum(n, day), b = n.base, dd = n.dev - n.dev0;
    const f = k => (fx[k] || 0) + (sh[k] || 0);
    const st = k => b[k] + dd * (SLOPE[k] || 0);
    const E = n.eq;
    const g = SIM.S.g;
    E.health = st('health') + f('health');
    E.edu = st('edu') + f('edu');
    E.infra = st('infra') + f('infra');
    E.energy = st('energy') + f('energy') - Math.max(0, n.gdp / n.gdp0 - 1) * 16;
    E.clean = b.clean + f('clean') + (g.summit || 0);
    E.env = b.env + f('env') - Math.max(0, n.gdp / n.gdp0 - 1) * 5 * (1 - E.clean / 140) + (g.techFx.co2Global ? 4 : 0) + (g.summit || 0) * 0.5;
    E.tech = st('tech') + f('tech') + (g.globalTech || 0);
    E.press = b.press + f('press') + (n.gov.lean === 'pop' ? -10 : 0);
    E.corrupt = st('corrupt') + f('corrupt') - (n.press - b.press) * 0.15;
    E.unemp = st('unemp') + f('unemp') - (n.growth - n.growth0) * 0.9;
    E.poverty = 62 * Math.pow(Math.max(0, 1 - n.dev), 1.6) + f('poverty') - (fx.happy || 0) * 0.4 + Math.max(0, n.unemp - b.unemp) * 0.5;
    E.happy = st('happy') + f('happy') + (n.health - b.health) * 0.25 + (n.edu - b.edu) * 0.08 + (n.infra - b.infra) * 0.1 +
      (n.energy - b.energy) * 0.15 + (n.growth - n.growth0) * 2.4 - (n.unemp - b.unemp) * 0.9 + (n.env - b.env) * 0.06 - (n.tensionPen || 0) * 2;
    E.unrest = st('unrest') + f('unrest') - (n.happy - b.happy) * 0.7 + (n.corrupt - b.corrupt) * 0.12 + (n.tensionPen || 0) * 3 + (n.sovereign || 0) * 1.2;
    E.stab = st('stab') + f('stab') - (n.unrest - b.unrest) * 0.35 + (n.gov.approval - 45) * 0.1;
    for (const k in E) {
      const lim = LIM[k] || [0, 100];
      E[k] = U.clamp(E[k], lim[0], lim[1]);
    }
    n.growthNow = n.growth0 * (0.55 + 0.45 * Math.max(0.2, 1 - n.dev)) / (0.55 + 0.45 * Math.max(0.2, 1 - n.dev0)) + f('growth') +
      (n.infra - b.infra) * 0.015 + (n.energy - b.energy) * 0.012 + (n.edu - b.edu) * 0.01 + (n.tech - b.tech) * 0.08 + (g.market || 0) - (n.tensionPen || 0) * 0.45 +
      (n.energy < 30 ? -(30 - n.energy) * 0.04 : 0);
  }

  NS.init = function () {
    const S = SIM.S;
    S.nations.forEach(n => {
      if (n.gdp0 === undefined) { n.gdp0 = n.gdp; n.dev0 = n.dev; n.pop0 = n.pop; }
      equilibrium(n, S.day);
      n.growth = n.growthNow;
    });
    S.cities.forEach(c => { if (c.p0 === undefined) { c.p0 = c.prosperity; c.u0 = c.unrest; c.pop0 = c.pop; } });
  };

  NS.daily = function () {
    const S = SIM.S, day = S.day;
    for (const n of S.nations) {
      equilibrium(n, day);
      for (const k in RATE) n[k] += (n.eq[k] - n[k]) * RATE[k];
      n.growth += (n.growthNow - n.growth) * 0.05;
      n.gdp *= 1 + n.growth / 36500;
      const pg = 0.12 + Math.max(0, 1 - n.dev) * 2.3 + (n.health - n.base.health) * 0.004;
      n.pop *= 1 + pg / 36500;
      n.gdpPc = n.gdp * 1000 / n.pop;
      // Meinung verblasst langsam, Bekanntheit ebenso (nicht nach der Enttarnung)
      for (let m = 0; m < 5; m++) n.milOp[m] *= 0.99925;
      n.aware = Math.max(S.g.exposed ? 70 : 0, n.aware - 0.006);
      SIM.recalcOp(n);
    }
    for (const c of S.cities) {
      const n = S.nations[SIM.W.cities[c.id].nation];
      const pe = U.clamp(c.p0 + (n.dev - n.dev0) * 70 + (c.fx.prosperity || 0) - c.dmg * 40, 2, 99);
      c.prosperity += (pe - c.prosperity) / 120;
      const ue = U.clamp(n.unrest + (c.u0 - n.base.unrest) * 0.6 + (c.fx.unrest || 0) + (c.protest ? c.protest.stage * 9 : 0) + c.dmg * 22 - (c.prosperity - c.p0) * 0.2, 0, 100);
      c.unrest += (ue - c.unrest) / 30;
      c.sent *= 0.9992;
      if (c.dmg > 0) c.dmg = Math.max(0, c.dmg - (c.rebuild > day ? 0.012 : 0.003));
      c.pop = c.pop0 * n.pop / n.pop0;
    }
  };

  NS.monthly = function () {
    const S = SIM.S, W = SIM.W, day = S.day;
    S.nations.forEach((n, id) => {
      // Entwicklung folgt dem Wohlstand
      n.dev = U.clamp((Math.log(n.gdpPc) - Math.log(1800)) / (Math.log(72000) - Math.log(1800)), 0.03, 0.99);
      // Regierungszustimmung
      const ae = U.clamp(30 + (n.happy - 50) * 0.7 + (n.growth - 1.5) * 3 - (n.unrest - 30) * 0.35 + (n.govBonus || 0) + U.gauss() * 2, 4, 92);
      n.gov.approval += (ae - n.gov.approval) * 0.25;
      n.govBonus = (n.govBonus || 0) * 0.85;
      // Abhängigkeit vom Geldgeber: Souveränitätsbedenken
      n.investHist.push(n.investM || 0); n.investM = 0;
      if (n.investHist.length > 60) n.investHist.shift();
      const inv5 = U.sum(n.investHist);
      n.dep = inv5 / Math.max(1, n.gdp) * 100;
      n.sovereign = U.clamp((n.dep - 2.5) * 1.6, 0, 30) * (0.4 + n.aware / 160);
      if (n.sovereign > 2) {
        SIM.opImpulse(id, [-0.2, -0.3, -0.6, -0.1, -0.8], n.sovereign * 0.12);
        n.access = Math.max(0, n.access - n.sovereign * 0.05);
        if (Math.random() < 0.08 && n.aware > 25) KY.media.story('donor_critic', { n: id }, { tone: -0.5, heat: 30, about: true, tag: 'sovereign' });
      }
      // Zugang verfällt ohne Kontakt langsam
      n.access = Math.max(0, n.access * 0.997);
      // Geschichte
      const H = n.hist;
      U.push(H.happy, Math.round(n.happy * 10) / 10, 240); U.push(H.gdp, Math.round(n.gdp), 240); U.push(H.op, Math.round(n.op * 10) / 10, 240);
      U.push(H.unrest, Math.round(n.unrest * 10) / 10, 240); U.push(H.approval, Math.round(n.gov.approval), 240);
      // Wahlen
      if (day >= n.gov.next) NS.election(id);
      crises(id);
      // Umfragen
      if (n.aware > 12 && (!n.lastPoll || day - n.lastPoll.day >= 90)) {
        const pct = U.clamp(50 + n.op * 0.46 + U.gauss() * 2.5, 2, 98);
        const prev = n.lastPoll ? n.lastPoll.pct : null;
        n.lastPoll = { day, pct, prev };
        U.push(S.polls, { day, n: id, pct }, 600);
        if (W.nations[id].pop > 25 && Math.random() < 0.35 || (prev !== null && Math.abs(pct - prev) > 9)) {
          KY.media.story('poll', { n: id, extra: { pct: U.pct(pct, 0) } }, { tone: (pct - 50) / 60, heat: 18, about: true });
        }
      }
    });
    relations();
    // Weltkonjunktur
    const g = S.g;
    g.market = (g.market || 0) * 0.9;
    g.summit = (g.summit || 0);
    S.cities.forEach(c => {
      if (c.protest) NS.protestMonthly(c);
    });
  };

  /* ---------- Wahlen ---------- */
  NS.election = function (id) {
    const S = SIM.S, n = S.nations[id], wn = SIM.W.nations[id];
    const old = n.gov;
    const score = old.approval + U.gauss() * 8;
    let lean, re = false;
    if (score > 44) { lean = old.lean; re = true; }
    else {
      const w = {
        left: 2 + (n.unemp - 8) * 0.18 + n.milW[1] * 4, green: 0.8 + n.milW[3] * 5 + (55 - n.env) * 0.04,
        center: 2.6 + n.growth * 0.25 + n.milW[0] * 4, right: 2 + (n.unrest - 30) * 0.05 + n.milW[4] * 4,
        pop: 0.7 + Math.max(0, -n.op) * 0.07 + (n.sovereign || 0) * 0.25 + Math.max(0, n.unrest - 45) * 0.05,
      };
      w[old.lean] *= 0.25;
      lean = U.weighted(Object.keys(w), k => w[k]);
    }
    const r = Math.random;
    const g = SIM.makeGov(r, n, wn.culture, S.day, lean);
    if (re && r() < 0.6) { g.leader = old.leader; g.party = old.party; }
    g.approval = U.clamp(50 + U.gauss() * 6, 35, 68);
    const pct = U.clamp((re ? 41 : 37) + r() * 20, 33, 64);
    n.gov = g;
    n.access *= re ? 0.95 : 0.45;
    n.elections.push({ day: S.day, lean, party: g.party, leader: g.leader, pct, re });
    if (n.elections.length > 12) n.elections.shift();
    KY.media.story('election', { n: id, extra: { leader: g.leader, party: g.party, pct: U.pct(pct, 1) } }, { tone: 0, heat: 22 + wn.pop / 10 });
    SIM.chron('politik', 'Wahl in ' + wn.short + ': ' + g.party + ' (' + D.PARTY_NAME[lean] + ') gewinnt mit ' + U.pct(pct, 1) + '. ' + (re ? 'Die Regierung bleibt im Amt.' : 'Regierungswechsel: ' + g.leader + ' übernimmt.'), { n: id });
    if (!re && lean === 'pop') {
      wn.neighbors.forEach(b => SIM.relAdd(id, b, -8, 'wahl'));
      if (n.aware > 20 || n.access > 20) SIM.msg('envoy', 'Machtwechsel in ' + wn.short, ['Die neue Regierung unter ' + g.leader + ' hat im Wahlkampf gegen „Schattengeld aus dem Ausland“ mobilisiert.', 'Rechnen Sie mit schwierigeren Genehmigungen. Unser Zugang zur Regierung ist weitgehend verloren.'], { kind: 'warn', ref: { n: id } });
    } else if (!re && n.access > 25) {
      SIM.msg('envoy', 'Regierungswechsel in ' + wn.short, ['Mit ' + g.leader + ' (' + g.party + ') übernimmt eine neue Regierung. Wir müssen unsere Kontakte neu aufbauen.'], { ref: { n: id } });
    }
    KY.bus.emit('election', { n: id });
  };

  /* ---------- Krisen aus der Gesellschaft heraus ---------- */
  function crises(id) {
    const S = SIM.S, n = S.nations[id], wn = SIM.W.nations[id], r = Math.random;
    if (n.crisis && S.day > n.crisis.until) n.crisis = null;
    const cap = SIM.capitalOf(id);
    const start = (k, days) => { n.crisis = { k, start: S.day, until: S.day + days }; };
    if (!n.crisis) {
      if (n.debt > 105 && n.growth < 1.2 && r() < 0.018) {
        start('debt', 420); SIM.shock(id, 'growth', -2.6, 420); SIM.shock(id, 'happy', -7, 300); SIM.shock(id, 'unrest', 9, 300);
        KY.media.story('econ_debt', { n: id }, { tone: -0.4, heat: 40 + wn.pop / 8 });
        SIM.chron('krise', 'Staatsschuldenkrise in ' + wn.short + '.', { n: id });
        KY.projects.bondDefault(id);
        n.debt *= 0.8;
      } else if (n.energy < 36 && r() < 0.03 + (36 - n.energy) * 0.006) {
        start('blackout', 20); SIM.shock(id, 'happy', -5, 40); SIM.shock(id, 'growth', -0.4, 60);
        KY.media.story('blackout', { n: id, c: cap.id }, { tone: -0.3, heat: 30 });
        SIM.chron('krise', 'Großflächiger Stromausfall in ' + wn.short + '.', { n: id });
      } else if (n.unrest > 66 && r() < 0.14) {
        start('unrest', 60); n.gov.approval -= 7;
        KY.media.story('unrest', { n: id, c: cap.id }, { tone: -0.3, heat: 34 });
        SIM.chron('politik', 'Massenproteste gegen die Regierung in ' + wn.short + '.', { n: id });
        if (n.gov.approval < 26 && n.gov.next - S.day > 120) {
          n.gov.next = S.day + 60 + Math.floor(r() * 40);
          KY.media.story('gov_fall', { n: id, extra: { leader: n.gov.leader } }, { tone: -0.2, heat: 32 });
          SIM.chron('politik', 'Regierungskrise in ' + wn.short + ': Neuwahlen angesetzt.', { n: id });
        }
      } else if (n.unemp > 14 && r() < 0.012) {
        start('strike', 30); SIM.shock(id, 'growth', -0.5, 45); SIM.shock(id, 'unrest', 6, 45);
        KY.media.story('strike', { n: id, c: cap.id }, { tone: -0.2, heat: 22 });
      } else if (n.corrupt > 55 && r() < 0.012) {
        start('scandal', 90); n.gov.approval -= 13;
        KY.media.story('scandal', { n: id, extra: { leader: n.gov.leader } }, { tone: -0.2, heat: 26 });
        SIM.chron('politik', 'Korruptionsskandal erschüttert die Regierung von ' + wn.short + '.', { n: id });
      } else if (n.growth > 5.4 && r() < 0.03) {
        start('boom', 180); S.g.crashRisk = (S.g.crashRisk || 0) + 0.02;
        KY.media.story('econ_boom', { n: id }, { tone: 0.4, heat: 18 });
      }
    }
    // Schuldenstand driftet
    n.debt = U.clamp(n.debt + (2.4 - n.growth) * 0.08 + U.gauss() * 0.3, 5, 220);
  }

  NS.globalCrash = function () {
    const S = SIM.S;
    const depth = 0.12 + Math.random() * 0.18;
    S.g.market = -1.8 - Math.random() * 1.6;
    S.g.crashRisk = 0;
    S.g.lastCrash = S.day;
    S.nations.forEach((n, id) => { SIM.shock(id, 'growth', -1.4 - Math.random() * 1.8, 360 + Math.floor(Math.random() * 200)); SIM.shock(id, 'unemp', 2.5, 420); });
    KY.finance.crash(depth);
    KY.media.story('econ_crash', { n: -1 }, { tone: -0.5, heat: 70, global: true });
    SIM.chron('krise', 'Weltweite Finanzkrise: Der KX 500 verliert ' + U.pct(depth * 100, 0) + '.', null);
  };

  /* ---------- Beziehungen und Spannungen ---------- */
  function relations() {
    const S = SIM.S, W = SIM.W;
    S.nations.forEach(n => { n.tensionPen = 0; });
    for (const key in S.rel) {
      const R = S.rel[key];
      const [a, b] = key.split(':').map(Number);
      const nb = W.nations[a].neighbors.indexOf(b) >= 0;
      let dv = U.gauss() * (nb ? 2.2 : 1) + (R.base - R.v) * 0.025;
      const ga = S.nations[a].gov.lean, gb = S.nations[b].gov.lean;
      if (nb && (ga === 'pop' || gb === 'pop')) dv -= 0.6;
      if (R.trade) dv += 0.25;
      SIM.relAdd(a, b, dv, 'drift');
      if (R.state === 'krise' || R.state === 'eiszeit') {
        const pen = R.state === 'eiszeit' ? 2 : 1;
        S.nations[a].tensionPen += pen * (nb ? 1 : 0.5);
        S.nations[b].tensionPen += pen * (nb ? 1 : 0.5);
      }
    }
    S.nations.forEach(n => { n.tensionPen = Math.min(4, n.tensionPen); });
  }

  KY.bus.on('relchange', e => {
    const S = SIM.S;
    if (!S || e.why === 'init') return;
    const order = { partner: 4, normal: 3, angespannt: 2, krise: 1, eiszeit: 0 };
    const worse = order[e.to] < order[e.from];
    const W = SIM.W;
    const big = W.nations[e.a].pop + W.nations[e.b].pop;
    if (worse && e.to === 'angespannt') KY.media.story('tension_up', { n: e.a, n2: e.b }, { tone: -0.2, heat: 16 + big / 20 });
    else if (worse && (e.to === 'krise' || e.to === 'eiszeit')) {
      KY.media.story('tension_crisis', { n: e.a, n2: e.b }, { tone: -0.4, heat: 34 + big / 12 });
      SIM.chron('diplomatie', (e.to === 'eiszeit' ? 'Eiszeit' : 'Diplomatische Krise') + ' zwischen ' + SIM.nName(e.a) + ' und ' + SIM.nName(e.b) + '.', { n: e.a, n2: e.b });
      if (!S.g.tensionMsg || S.day - S.g.tensionMsg > 60) {
        S.g.tensionMsg = S.day;
        SIM.msg('envoy', 'Spannungen zwischen ' + SIM.nName(e.a) + ' und ' + SIM.nName(e.b), ['Botschafter wurden zurückgerufen' + (e.to === 'eiszeit' ? ', die Grenze ist geschlossen' : '') + '. Beide Volkswirtschaften leiden.', 'Eine verdeckte Vermittlung könnte die Lage entschärfen. Ich stehe bereit.'], { kind: 'suggest', acts: [{ l: 'Vermittlung vorbereiten', a: 'act', p: { id: 'VERMITTLUNG', n: e.a, n2: e.b } }], ref: { n: e.a, n2: e.b } });
      }
    } else if (!worse && e.from !== 'normal' && e.to === 'normal') KY.media.story('tension_down', { n: e.a, n2: e.b }, { tone: 0.2, heat: 14 });
  });

  /* ---------- Proteste gegen Vorhaben ---------- */
  NS.PROTEST_STAGES = ['Unterschriftensammlung', 'Kundgebungen', 'Großdemonstrationen', 'Blockade der Baustelle'];
  NS.startProtest = function (cid, p, strength) {
    const S = SIM.S, c = S.cities[cid];
    if (c.protest) { c.protest.str = Math.max(c.protest.str, strength); return; }
    c.protest = { proj: p.id, stage: 0, str: strength, since: S.day, size: Math.round(400 + strength * 4000 * (0.5 + Math.random())), talks: 0 };
    p.protest = true;
    KY.media.story('protest_small', { c: cid, n: p.n, extra: { proj: KY.projects.typeName(p) } }, { tone: -0.2, heat: 10 + strength * 10, about: true, proj: p.id });
    SIM.chron('protest', 'Protest gegen ' + p.name + ' in ' + SIM.cName(cid) + '.', { proj: p.id, c: cid });
    KY.bus.emit('protest', { c: cid, p: p.id });
  };
  NS.protestMonthly = function (c) {
    const S = SIM.S, P = c.protest;
    const p = S.projects.find(x => x.id === P.proj);
    if (!p || p.phase === 'stillgelegt' || p.phase === 'aufgegeben' || p.phase === 'abgelehnt') { NS.endProtest(c, 'gone'); return; }
    const n = S.nations[p.n];
    const esc = P.str * 0.32 * (1 + c.unrest / 120) * (p.phase === 'betrieb' ? 0.4 : 1);
    const fade = 0.16 + P.talks * 0.2 + Math.max(0, n.op) / 300 + (p.phase === 'betrieb' ? 0.2 : 0);
    const r = Math.random();
    if (r < esc && P.stage < 3) {
      P.stage++;
      P.size = Math.round(P.size * (1.8 + Math.random()));
      const key = P.stage === 3 ? 'protest_block' : 'protest_big';
      KY.media.story(key, { c: c.id, n: p.n, extra: { proj: KY.projects.typeName(p), n: U.count(P.size) } }, { tone: -0.35, heat: 14 + P.stage * 9, about: true, proj: p.id });
      SIM.opImpulse(p.n, [-0.3, -0.3, -0.4, -0.3, -0.3], 0.8 + P.stage * 0.6);
      c.sent = U.clamp(c.sent - 4 * P.stage, -100, 100);
      if (P.stage === 3) {
        SIM.msg('haddad', 'Blockade in ' + SIM.cName(c.id), ['Demonstrierende blockieren die Baustelle ' + p.name + '. Der Bau steht still, jeder Tag kostet Geld.', 'Wir können das Gespräch suchen, die Planung ändern oder Entschädigungen anbieten. Zwangsmittel stehen uns nach dem Mandat nicht zu.'], { kind: 'warn', acts: [{ l: 'Vorhaben öffnen', a: 'proj', p: { id: p.id } }], ref: { proj: p.id } });
      }
    } else if (r > 1 - fade) {
      P.stage--;
      if (P.stage < 0) NS.endProtest(c, 'fade');
    }
  };
  NS.endProtest = function (c, why) {
    const S = SIM.S;
    if (!c.protest) return;
    const p = S.projects.find(x => x.id === c.protest.proj);
    if (p) p.protest = false;
    if (why !== 'gone' && c.protest.stage >= 1) KY.media.story('protest_end', { c: c.id }, { tone: 0.1, heat: 8, about: true });
    c.protest = null;
  };
  /* Antwort auf Proteste: Dialog, Planänderung, Entschädigung */
  NS.protestAction = function (cid, kind) {
    const S = SIM.S, c = S.cities[cid], P = c.protest;
    if (!P) return { ok: false };
    const p = S.projects.find(x => x.id === P.proj);
    let cost = 0, msg = '';
    if (kind === 'talk') { cost = 0.02; P.talks++; P.stage = Math.max(-1, P.stage - 1); P.str *= 0.75; msg = 'Gesprächsrunden mit der Bürgerinitiative haben begonnen.'; SIM.opImpulse(p.n, [0.2, 0.2, 0.3, 0.2, 0.2], 1); }
    else if (kind === 'redesign') {
      const left = p.cost - p.paid;
      cost = Math.max(0.01, left * 0.05);
      p.o.part = 'codet'; p.cost += cost; p.days = Math.round(p.days + (1 - p.prog) * p.days * 0.15);
      P.stage = -1; msg = 'Die Planung wird geändert: Anwohner entscheiden künftig mit.';
      SIM.opImpulse(p.n, [0.3, 0.3, 0.5, 0.3, 0.3], 1.6);
    } else if (kind === 'comp') { cost = Math.max(0.02, p.cost * 0.006); P.stage = Math.max(-1, P.stage - 2); P.str *= 0.6; msg = 'Anwohner erhalten Entschädigungsangebote.'; SIM.opImpulse(p.n, [0.1, 0.2, 0.3, 0.1, 0.2], 0.8); }
    if (cost > S.fin.cash) return { ok: false, err: 'Nicht genügend liquide Mittel.' };
    KY.finance.spend(cost, 'Protest ' + SIM.cName(cid));
    c.sent = U.clamp(c.sent + 6, -100, 100);
    SIM.chron('protest', msg + ' (' + SIM.cName(cid) + ')', { proj: p.id, c: cid });
    if (P.stage < 0) NS.endProtest(c, 'resolved');
    return { ok: true, msg, cost };
  };
})();
