/* KYTHERA · Vorhaben: Planung, Ablauf, Ergebnis */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const P = KY.proj = {};
  const BUDGET = { 0.75: { succ: -8, fx: 0.8 }, 1: { succ: 0, fx: 1 }, 1.25: { succ: 5, fx: 1.12 }, 1.5: { succ: 9, fx: 1.25 } };
  P.BUDGET = BUDGET;

  P.available = function (type) {
    const T = KY.data.projectTypes[type];
    return !T.requires || KY.hasRes(T.requires);
  };

  /* Planung: liefert Kosten, Dauer, Wahrscheinlichkeit mit Aufschlüsselung */
  P.plan = function (o) {
    const S = KY.S, D = KY.data, T = D.projectTypes[o.type];
    const R = S.regions[o.rid];
    const ap = D.approaches[o.ap || 'STD'];
    const bm = o.budget || 1;
    const parts = [];
    const add = (label, v) => { if (Math.abs(v) >= 0.5) parts.push({ label, v: Math.round(v) }); return v; };
    let p = T.base;
    parts.push({ label: 'Grundwahrscheinlichkeit ' + T.short, v: T.base, base: true });
    p += add('Kooperation vor Ort', (R.m.vert - 50) * 0.25);
    p += add('Eigene Präsenz', (R.m.praes - 50) * 0.15);
    p += add('Spannungen in der Region', -Math.max(0, R.m.span - 30) * 0.35);
    if (T.dual && o.rid2) {
      const R2 = S.regions[o.rid2];
      p += add('Kooperation Zielregion', (R2.m.vert - 50) * 0.15);
      p += add('Spannungen Zielregion', -Math.max(0, R2.m.span - 30) * 0.2);
    }
    p += add('Budgetrahmen', BUDGET[bm].succ);
    p += add('Vorgehen: ' + ap.name, ap.succ);
    let pb = 0;
    (o.partners || []).forEach(pid => {
      const pp = D.people.find(x => x.id === pid), st = S.people[pid];
      const match = pp.tags.filter(t => T.tags.indexOf(t) >= 0).length;
      pb += match ? 3 + match * 1.5 + st.trust / 25 : 1;
    });
    p += add('Partner aus dem Netzwerk', pb);
    if (KY.hasRes('A1')) p += add('Prädiktive Modelle II', 4);
    if (KY.hasRes('D1') && (o.type === 'VER' || o.type === 'HAN')) p += add('Vermittlerkorps', 10);
    if (KY.wsim.covered(o.rid)) p += add('Orbitale Abdeckung', 3);
    if (T.crisisMult && S.crisis && S.crisis.rid === o.rid) p += add('Akute Krise vor Ort', 8);
    let costMult = 1;
    S.buffs.filter(b => b.until > S.t && b.kind === 'proj' && b.type.indexOf(o.type) >= 0 && (!b.region || b.region === o.rid)).forEach(b => {
      p += add(b.label || 'Gelegenheit (Depesche)', b.succ || 0);
      if (b.costMult) costMult *= b.costMult;
    });
    if (S.story.ending === 'frei') p += add('Menschliches Urteil', 3);
    if (S.story.ending === 'symbiose') p += add('Symbiose', 6);
    if (S.story.ending === 'archon') p += add('Nullter Sitz', 10);
    p = U.clamp(Math.round(p), 5, 97);

    let ein = T.ein;
    if (KY.hasRes('D1') && (o.type === 'VER' || o.type === 'HAN')) ein *= 0.75;
    const cost = { kap: +(T.cost * bm * ap.cost * costMult).toFixed(2), ein: Math.round(ein), rech: T.rech };
    let dur = T.dur * ap.dur;
    if (KY.hasRes('I1') && (o.type === 'INF' || o.type === 'ENE' || o.type === 'LOG' || o.type === 'FUS')) dur *= 0.75;
    if (KY.buffs('diskretion').length) dur *= 1.1;
    let disk = T.disk * ap.disk;
    if (KY.hasRes('F2')) disk *= 0.7;
    if (KY.buffs('diskretion').length) disk *= 0.8;
    const blocked = T.big && R.mora > 0 ? 'Moratorium des Kuratoriums für Großvorhaben in ' + D.regions[o.rid].name + ' (noch ' + U.dur(R.mora) + ')' : null;
    const need = T.dual && !o.rid2 ? 'Zielregion wählen' : null;
    const shipNeeded = T.expedition && !P.freeShip() ? 'Kein Schiff verfügbar' : null;
    return { p, parts, cost, dur: Math.round(dur), disk: +disk.toFixed(1), blocked: blocked || need || shipNeeded, fxMult: BUDGET[bm].fx };
  };

  P.freeShip = function () {
    return KY.S.infra.ships.find(s => !s.task);
  };

  P.launch = function (o) {
    const S = KY.S, D = KY.data, T = D.projectTypes[o.type];
    const pl = P.plan(o);
    if (pl.blocked) return { ok: false, err: pl.blocked };
    if (!KY.canPay(pl.cost)) return { ok: false, err: 'Nicht ausreichend: ' + KY.missing(pl.cost).join(', ') };
    KY.pay(pl.cost);
    KY.adj('disk', -pl.disk);
    S.projects.seq++;
    const used = new Set(S.projects.active.map(x => x.code).concat(S.projects.done.map(x => x.code)));
    const pr = {
      id: 'VH-' + U.pad(S.projects.seq + 2040, 4), code: o.code || U.codename(used), type: o.type, rid: o.rid, rid2: o.rid2 || null,
      budget: o.budget || 1, ap: o.ap || 'STD', partners: (o.partners || []).slice(), p: pl.p, dur: pl.dur, t0: S.t, cost: pl.cost,
      fxMult: pl.fxMult, phase: -1, log: [], status: 'aktiv',
    };
    pr.partners.forEach(pid => { S.people[pid].busy = pr.id; });
    if (T.expedition) { const sh = P.freeShip(); sh.task = { proj: pr.id, rid: o.rid }; pr.ship = sh.id; }
    S.projects.active.push(pr);
    S.stats.proj++;
    P.addLog(pr, 'Vorhaben genehmigt. Erfolgswahrscheinlichkeit ' + pl.p + ' %. Mittel freigegeben: ' + KY.costText(pl.cost) + '.');
    KY.log('vor', 'Genehmigt: ' + pr.code + ' (' + T.name + ', ' + KY.wsim.rname(o.rid) + (o.rid2 ? ' ↔ ' + KY.wsim.rname(o.rid2) : '') + ') · ' + pl.p + ' %');
    const newsP = { DIS: 0.08, STD: 0.3, SCH: 0.65 }[pr.ap];
    if (Math.random() < newsP) KY.wsim.news(o.rid, KY.wsim.fillHead(U.pick(D.projectHeads.start), o.rid), 'neutral', { proj: pr.id });
    KY.onb('projekt');
    KY.bus.emit('projects'); KY.bus.emit('people');
    if (KY.audio) KY.audio.play('grant');
    return { ok: true, pr };
  };

  P.addLog = function (pr, text) {
    pr.log.push({ t: KY.S.t, ts: Date.now(), text });
  };
  P.progress = pr => U.clamp((KY.S.t - pr.t0) / pr.dur, 0, 1);
  P.remaining = pr => Math.max(0, pr.dur - (KY.S.t - pr.t0));

  P.tick = function () {
    const S = KY.S, D = KY.data;
    for (const pr of S.projects.active.slice()) {
      const T = D.projectTypes[pr.type];
      const prog = P.progress(pr);
      const ph = Math.min(T.phases.length - 1, Math.floor(prog * T.phases.length));
      if (ph > pr.phase) {
        pr.phase = ph;
        const R = D.regions[pr.rid];
        const txt = U.fill(T.log[ph], {
          reg: R.name, cap: R.cap, reg2: pr.rid2 ? D.regions[pr.rid2].name : '', n: U.ri(3, 14), m: U.ri(20, 480), k: U.ri(4, 90) * 1000,
          topic: T.topics ? U.pick(T.topics) : '',
        });
        P.addLog(pr, 'Phase ' + (ph + 1) + ' · ' + T.phases[ph] + ': ' + txt);
        if (ph > 0 && Math.random() < 0.25 && pr.ap === 'SCH') { KY.adj('disk', -0.8); P.addLog(pr, 'Hinweis: Lokale Presse fragt nach dem Auftraggeber.'); }
        KY.bus.emit('projects');
      }
      if (prog >= 1) P.complete(pr);
    }
  };

  P.abort = function (id) {
    const S = KY.S;
    const pr = S.projects.active.find(x => x.id === id);
    if (!pr) return;
    const refund = pr.cost.kap * (1 - P.progress(pr)) * 0.5;
    KY.adj('kap', refund);
    P.finish(pr, 'ABBR', 0);
    P.addLog(pr, 'Vorhaben abgebrochen. Rückfluss ' + U.money(refund) + '.');
    KY.log('vor', 'Abgebrochen: ' + pr.code + ' · Rückfluss ' + U.money(refund));
    KY.adj('ans', -1);
    KY.bus.emit('projects');
  };

  P.accelerate = function (id) {
    const S = KY.S;
    const pr = S.projects.active.find(x => x.id === id);
    if (!pr) return { ok: false };
    const rem = P.remaining(pr);
    const cost = { kap: +(pr.cost.kap * 0.25).toFixed(2), ein: 8 };
    if (!KY.pay(cost)) return { ok: false, err: 'Nicht ausreichend: ' + KY.missing(cost).join(', ') };
    pr.t0 -= rem * 0.4;
    pr.p = Math.max(5, pr.p - 3);
    KY.adj('disk', -1.5);
    P.addLog(pr, 'Beschleunigung angeordnet: Restlaufzeit −40 %, zusätzliche Mittel ' + KY.costText(cost) + '.');
    KY.log('vor', 'Beschleunigt: ' + pr.code);
    KY.bus.emit('projects');
    return { ok: true };
  };

  P.finish = function (pr, outcome, mult) {
    const S = KY.S;
    pr.status = outcome;
    pr.tEnd = S.t;
    pr.mult = mult;
    pr.partners.forEach(pid => { if (S.people[pid].busy === pr.id) S.people[pid].busy = null; });
    if (pr.ship) { const sh = S.infra.ships.find(s => s.id === pr.ship); if (sh) sh.task = null; }
    S.projects.active = S.projects.active.filter(x => x !== pr);
    S.projects.done.unshift(pr);
    if (S.projects.done.length > 60) S.projects.done.length = 60;
    KY.bus.emit('people');
  };

  P.complete = function (pr) {
    const S = KY.S, D = KY.data, T = D.projectTypes[pr.type];
    const r = Math.random() * 100;
    let oc;
    if (r < pr.p) oc = r < pr.p * 0.3 ? 'VOLL' : 'ERF';
    else oc = r < pr.p + (100 - pr.p) * 0.55 ? 'TEIL' : 'FEHL';
    const O = D.outcomes[oc];
    const mult = O.mult * pr.fxMult;
    const R = S.regions[pr.rid];
    let fx = T.fx;
    if (T.crisisMult && R.m.stab < 45) fx = Object.fromEntries(Object.entries(fx).map(([k, v]) => [k, v * 1.5]));
    KY.regAdj(pr.rid, fx, mult);
    if (pr.rid2) KY.regAdj(pr.rid2, fx, mult * 0.8);
    const notes = [];
    if (mult > 0) {
      if (T.sector) KY.market.sectorShock(T.sector, 3 * mult, pr.rid);
      if (T.returns) {
        const back = pr.cost.kap * (1 + { VOLL: 0.38, ERF: 0.22, TEIL: 0.02 }[oc]);
        KY.adj('kap', back);
        KY.market.regionShock(pr.rid, 2.5 * mult);
        notes.push('Kapitalrückfluss ' + U.money(back));
      }
      if (T.research) { S.research.stations++; notes.push('Forschungskapazität dauerhaft +6 %'); }
      if (T.resilience) { R.res = U.clamp(R.res + T.resilience * mult, 0, 0.85); notes.push('Resilienz gegen Naturereignisse ' + Math.round(R.res * 100) + ' %'); }
      if (T.expedition) notes.push(P.expeditionFind(pr));
      if (pr.type === 'FUS') { R.base.ener = Math.min(95, R.base.ener + 15); notes.push('Grundlast dauerhaft gesichert'); }
      if (pr.type === 'HAN' || pr.type === 'VER') KY.adj('ein', 6 * mult);
    } else {
      KY.adj('kap', pr.cost.kap * 0.2);
      notes.push('Teilrückfluss ' + U.money(pr.cost.kap * 0.2));
    }
    pr.partners.forEach(pid => KY.trustAdj(pid, mult > 0 ? 4 : -3));
    KY.adj('ans', { VOLL: 2.5, ERF: 1.5, TEIL: 0, FEHL: -2 }[oc]);
    if (oc === 'VOLL' || oc === 'ERF') S.stats.projOk++;
    pr.notes = notes;
    pr.report = P.report(pr, oc, notes);
    P.addLog(pr, 'Abschluss: ' + O.name + '. ' + notes.join(' · '));
    P.finish(pr, oc, mult);
    const heads = mult > 0 ? D.projectHeads.done[pr.type] : D.projectHeads.fail;
    if (heads && Math.random() < (mult > 0 ? 0.75 : 0.5)) KY.wsim.news(pr.rid, KY.wsim.fillHead(U.pick(heads), pr.rid, pr.rid2), mult > 0 ? 'good' : 'bad', { proj: pr.id });
    KY.log('vor', 'Abgeschlossen: ' + pr.code + ' · ' + O.name);
    KY.notify({ cat: 'vor', lvl: O.cls === 'ok' ? 'ok' : O.cls === 'warn' ? 'warn' : 'crit', title: pr.code + ': ' + O.name, text: T.name + ' · ' + KY.wsim.rname(pr.rid), link: { mod: 'vorhaben', arg: pr.id } });
    KY.bus.emit('projects');
  };

  P.expeditionFind = function (pr) {
    const S = KY.S, D = KY.data;
    let f = U.pick(D.expeditionFinds);
    if (f.kap) KY.adj('kap', f.kap);
    if (f.wohl) KY.regAdj(pr.rid, { wohl: f.wohl });
    if (f.research) KY.research.addPts(f.research);
    if (f.ein) KY.adj('ein', f.ein);
    if (f.resilience) S.regions[pr.rid].res = Math.min(0.85, S.regions[pr.rid].res + 0.15);
    pr.find = f.t;
    return 'Fund: ' + f.t + '. ' + f.text;
  };

  P.report = function (pr, oc, notes) {
    const D = KY.data, T = D.projectTypes[pr.type], R = D.regions[pr.rid];
    const O = D.outcomes[oc];
    const fx = Object.entries(T.fx).map(([k, v]) => D.metricInfo[k].name + ' ' + U.sgn(v * pr.mult, 1)).join(', ');
    const lines = [
      'NACHBERICHT ' + pr.id + ' · ' + pr.code,
      'Typ: ' + T.name + ' · Region: ' + R.name + (pr.rid2 ? ' ↔ ' + D.regions[pr.rid2].name : ''),
      'Ergebnis: ' + O.name + ' (prognostiziert ' + pr.p + ' %)',
      'Wirkung: ' + (pr.mult > 0 ? fx : 'keine messbare Wirkung'),
    ];
    if (notes.length) lines.push('Anmerkungen: ' + notes.join(' · '));
    lines.push(oc === 'FEHL' ? 'Bewertung: Lokale Widerstände und Koordinationsprobleme. Empfehlung: Kooperation vor Ort stärken, bevor ein neuer Anlauf genommen wird.'
      : oc === 'TEIL' ? 'Bewertung: Ziele teilweise erreicht. Die Strukturen bestehen und können in einem Folgevorhaben genutzt werden.'
        : 'Bewertung: Planmäßige Umsetzung. Keine Zuordnung zum Kuratorium in öffentlichen Quellen festgestellt.');
    return lines.join('\n');
  };
})();
