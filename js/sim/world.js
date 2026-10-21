/* KYTHERA · Weltlage: Regionen, Ereignisse, Krisen, Nachrichten */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const W = KY.wsim = {};

  W.rname = id => (KY.data.regions[id] ? KY.data.regions[id].name : id);
  W.covered = function (rid) { return KY.S.infra.sats.some(s => s.focus === rid); };
  W.neighbor = function (rid) {
    const D = KY.data, k = D.regions[rid].kont;
    const same = D.regionOrder.filter(x => x !== rid && D.regions[x].kont === k);
    return same.length && Math.random() < 0.6 ? U.pick(same) : U.pick(D.regionOrder.filter(x => x !== rid));
  };
  W.score = function (rid) {
    const m = KY.S.regions[rid].m;
    return (m.stab * 0.35 + m.wohl * 0.25 + m.ener * 0.15 + m.infra * 0.15 + (100 - m.span) * 0.1);
  };
  W.status = function (rid) {
    const m = KY.S.regions[rid].m;
    if (m.stab < 35 || m.span > 65) return { t: 'KRITISCH', c: 'crit' };
    if (m.stab < 50 || m.span > 45) return { t: 'ANGESPANNT', c: 'warn' };
    return { t: 'STABIL', c: 'ok' };
  };
  W.globalStab = () => U.avg(KY.data.regionOrder.map(id => KY.S.regions[id].m.stab));

  W.news = function (rid, head, tone, extra) {
    const S = KY.S, D = KY.data;
    const n = Object.assign({ id: U.uid('nw'), ts: Date.now(), t: S.t, outlet: D.outlets[rid] || D.outlets.GLOBAL, rid, head, tone: tone || 'neutral' }, extra || {});
    S.news.unshift(n);
    if (S.news.length > 160) S.news.length = 160;
    KY.bus.emit('news', n);
    return n;
  };
  W.fillHead = function (tpl, rid, rid2) {
    const D = KY.data;
    return U.fill(tpl, {
      reg: D.regions[rid] ? D.regions[rid].name : 'der Region', cap: D.regions[rid] ? D.regions[rid].cap : '', reg2: rid2 ? D.regions[rid2].name : '',
      mag: U.n(U.rf(6.1, 7.6), 1), n: U.ri(30, 140),
    });
  };

  /* ---------- Regionen ---------- */
  W.tickRegions = function (dt) {
    const S = KY.S, D = KY.data;
    const sample = (S.t % 10) < dt;
    for (const id of D.regionOrder) {
      const R = S.regions[id], m = R.m, b = R.base;
      for (const k in m) {
        m[k] += (b[k] - m[k]) * 0.0009 * dt + U.gauss() * 0.06 * Math.sqrt(dt);
      }
      // Kopplungen
      if (m.ener < 40) m.wohl -= 0.006 * dt;
      if (m.span > 50) m.stab -= 0.008 * dt;
      if (m.stab < 40) m.span += 0.006 * dt;
      if (m.wohl > 70 && m.stab > 65) m.span -= 0.003 * dt;
      // Präsenz verfestigt sich langsam
      if (m.praes > b.praes) b.praes += (m.praes - b.praes) * 0.0015 * dt;
      if (m.vert > b.vert) b.vert += (m.vert - b.vert) * 0.001 * dt;
      if (m.infra > b.infra) b.infra += (m.infra - b.infra) * 0.002 * dt;
      if (m.ener > b.ener) b.ener += (m.ener - b.ener) * 0.002 * dt;
      for (const k in m) m[k] = U.clamp(m[k], 0, 100);
      if (R.mora > 0) R.mora = Math.max(0, R.mora - dt);
      if (R.warn && R.warn.until < S.t) R.warn = null;
      if (sample) for (const k in m) U.push(R.h[k], +m[k].toFixed(2), 90);
    }
    // Lagestufe
    const span = U.avg(D.regionOrder.map(id => S.regions[id].m.span));
    const crit = D.regionOrder.filter(id => W.status(id).c === 'crit').length;
    const warn = D.regionOrder.filter(id => W.status(id).c === 'warn').length;
    let ls = 1 + (span > 22 ? 1 : 0) + (span > 34 ? 1 : 0) + (crit > 0 ? 1 : 0) + (crit > 2 || warn > 6 ? 1 : 0);
    if (S.crisis && S.crisis.kind === 'welt') ls = Math.max(ls, 3);
    ls = U.clamp(ls, 1, 5);
    if (ls !== S.lagestufe) {
      const up = ls > S.lagestufe;
      S.lagestufe = ls;
      KY.log('welt', 'Lagestufe ' + (up ? 'erhöht' : 'gesenkt') + ' auf ' + ls);
      if (up && ls >= 4) KY.notify({ cat: 'welt', lvl: 'warn', title: 'Lagestufe ' + ls, text: 'Die globale Lage hat sich verschärft.', link: { mod: 'lage' } });
      KY.bus.emit('lagestufe');
    }
  };

  /* ---------- Ereignisse ---------- */
  W.tickEvents = function () {
    const S = KY.S, T = S.timers;
    if (T.event <= S.t) {
      T.event = S.t + U.ri(32, 58) - Math.min(10, S.lagestufe * 2);
      W.randomEvent();
    }
    if (T.news <= S.t) {
      T.news = S.t + U.ri(16, 30);
      const rid = U.pick(KY.data.regionOrder);
      W.news(rid, W.fillHead(U.pick(KY.data.ambientHeads), rid), 'neutral');
    }
    if (T.internal <= S.t) {
      T.internal = S.t + U.ri(230, 380);
      if (!S.crisis) W.internalEvent();
    }
  };

  W.randomEvent = function (forceId, forceRid, forceSev) {
    const S = KY.S, D = KY.data;
    let pick;
    if (forceId) {
      pick = { e: D.events.find(e => e.id === forceId), rid: forceRid };
    } else {
      const cands = [];
      for (const e of D.events) {
        for (const rid of (e.regions || D.regionOrder)) {
          const R = S.regions[rid];
          let w = e.w(R.m);
          if (R.warn && R.warn.type === e.crisis) w *= 9;
          if (e.natur && R.res > 0) w *= 1 - R.res * 0.5;
          cands.push({ e, rid, w });
        }
      }
      pick = U.weighted(cands, c => c.w);
    }
    if (!pick || !pick.e) return;
    const e = pick.e, rid = pick.rid, R = S.regions[rid];
    let sev = forceSev || (Math.random() < 0.62 ? 1 : Math.random() < 0.78 ? 2 : 3);
    if (R.warn && R.warn.type === e.crisis && !forceSev) { sev = Math.max(sev, 2); R.warn = null; }
    let damp = 1;
    if (e.natur) {
      damp *= 1 - R.res * 0.6;
      if (KY.hasRes('I3')) damp *= 0.7;
      if (KY.hasRes('O3') && W.covered(rid)) damp *= 0.75;
    }
    const rid2 = e.dual ? W.neighbor(rid) : null;
    if (e.flip) {
      const d = U.pick([-1, 1]);
      KY.regAdj(rid, { vert: d * U.ri(3, 8), span: -d * U.ri(1, 4) });
    } else {
      const mult = e.good ? sev : sev * damp;
      KY.regAdj(rid, e.fx, mult);
      if (rid2) KY.regAdj(rid2, e.fx, mult * 0.8);
    }
    if (e.com) for (const k in e.com) KY.market.comShock(k, e.com[k] * sev * U.rf(0.7, 1.2));
    if (e.sec) for (const k in e.sec) KY.market.sectorShock(k, e.sec[k] * sev * (e.good ? 1 : damp), rid);
    if (e.market) KY.market.marketShock(e.market * sev * 0.6);
    if (!e.good && !e.flip) KY.market.regionShock(rid, -0.6 * sev * damp);
    const head = W.fillHead(U.pick(e.head), rid, rid2);
    W.news(rid, head, e.good ? 'good' : e.flip ? 'neutral' : 'bad', { ev: e.id, sev });
    if (sev >= 3) W.news('GLOBAL', head.replace(/^/, '+++ ') + ' +++', 'bad', { ev: e.id, sev, rid });
    KY.log('welt', e.name + ' in ' + W.rname(rid) + (rid2 ? ' / ' + W.rname(rid2) : '') + ' · Schwere ' + sev + (damp < 0.99 ? ' · gedämpft ' + Math.round((1 - damp) * 100) + ' %' : ''));
    if (sev >= 2 || R.m.praes > 55) {
      KY.notify({ cat: 'welt', lvl: sev >= 3 ? 'warn' : 'info', title: e.name + ': ' + W.rname(rid), text: head, link: { mod: 'atlas', arg: rid } });
    }
    if (e.crisis && D.crises[e.crisis] && sev >= 2 && !S.crisis && S.t > 120 && S.t - (S.lastCrisisT || -999) > 90 && S.user.sworn) {
      KY.crisis.open('welt', e.crisis, rid, sev);
    }
    KY.bus.emit('event', { e, rid, sev });
  };

  W.internalEvent = function () {
    const S = KY.S, D = KY.data;
    S.usedInternal = S.usedInternal || [];
    let pool = D.internal.filter(x => S.usedInternal.indexOf(x.id) < 0);
    if (!pool.length) { S.usedInternal = []; pool = D.internal.slice(); }
    const it = U.pick(pool);
    S.usedInternal.push(it.id);
    KY.crisis.open('intern', it.id, null, 1);
  };

  /* ---------- Krisenentscheidungen ---------- */
  const C = KY.crisis = {};
  C.open = function (kind, key, rid, sev) {
    const S = KY.S, D = KY.data;
    let tpl, title, text;
    if (kind === 'welt') {
      tpl = D.crises[key];
      title = W.fillHead(tpl.title, rid); text = W.fillHead(tpl.text, rid);
    } else {
      tpl = D.internal.find(x => x.id === key);
      title = tpl.title; text = tpl.text;
    }
    const scale = kind === 'welt' ? (sev >= 3 ? 1.5 : 1) : 1;
    const opts = tpl.opts.map(o => {
      const cost = {};
      for (const k in o.cost) cost[k] = +(o.cost[k] * scale).toFixed(2);
      if (cost.kap && KY.buffs('krisenfonds').length) cost.kap = +(cost.kap * 0.7).toFixed(2);
      return Object.assign({}, o, { cost });
    });
    let dur = kind === 'welt' ? 55 : 90;
    if (kind === 'welt' && KY.hasRes('O3') && W.covered(rid)) dur += 30;
    const cr = { id: U.uid('k'), kind, key, rid, sev, title, text, opts, t0: S.t, dur, py: C.pythiaPick(opts) };
    S.crisis = cr;
    S.lastCrisisT = S.t;
    KY.log('kri', 'Entscheidungsvorlage: ' + title + ' · Frist ' + dur + ' s');
    KY.notify({ cat: 'kri', lvl: 'crit', title: 'Entscheidung erforderlich', text: title, link: { mod: 'krise' } });
    KY.bus.emit('crisis', cr);
    return cr;
  };
  C.pythiaPick = function (opts) {
    let best = 0, bs = -1e9;
    opts.forEach((o, i) => {
      const s = o.py - (KY.canPay(o.cost) ? 0 : 50);
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  };
  C.tick = function () {
    const S = KY.S;
    if (!S.crisis) return;
    if (S.t - S.crisis.t0 >= S.crisis.dur) C.choose(null, true);
  };
  C.remaining = () => KY.S.crisis ? Math.max(0, KY.S.crisis.dur - (KY.S.t - KY.S.crisis.t0)) : 0;
  C.choose = function (idx, auto) {
    const S = KY.S, D = KY.data, cr = S.crisis;
    if (!cr) return false;
    const regel7 = auto && S.story.ending !== 'frei';
    if (auto) idx = regel7 ? C.pythiaPick(cr.opts) : cr.opts.length - 1;
    if (S.story.ending === 'archon' && auto && S.archonDefault != null && cr.opts[S.archonDefault]) idx = S.archonDefault;
    let o = cr.opts[idx];
    if (!KY.canPay(o.cost)) {
      if (!auto) return false;
      idx = cr.opts.findIndex(x => KY.canPay(x.cost));
      o = cr.opts[idx];
    }
    KY.pay(o.cost);
    const sevMult = cr.kind === 'welt' ? (cr.sev >= 3 ? 1.3 : 1) : 1;
    if (o.fx && cr.rid) KY.regAdj(cr.rid, o.fx, sevMult);
    if (o.g) { if (o.g.disk) KY.adj('disk', o.g.disk); if (o.g.ans) KY.adj('ans', o.g.ans); }
    if (o.person) KY.trustAdj(o.person[0], o.person[1]);
    if (o.seat) KY.seatAdj(o.seat[0], o.seat[1]);
    if (o.region) KY.regAdj(o.region[0], o.region[1]);
    if (o.com) for (const k in o.com) KY.market.comShock(k, o.com[k]);
    if (o.sec) for (const k in o.sec) {
      if (KY.data.sectors[k]) KY.market.sectorShock(k, o.sec[k], cr.rid); else KY.market.shock(k, o.sec[k]);
    }
    if (o.market) KY.market.marketShock(o.market);
    if (o.buyDip) {
      const tops = D.companies.slice().sort((a, b) => b.mc - a.mc).slice(0, 4);
      tops.forEach(c => { const m = S.market.c[c.t]; const amt = o.buyDip / 4; m.u += amt / m.p; m.cost += amt; });
      KY.log('kap', 'Antizyklischer Kauf: ' + U.money(o.buyDip) + ' verteilt auf ' + tops.map(c => c.t).join(', '));
    }
    if (o.loan) { S.loans = S.loans || []; S.loans.push({ amt: o.loan.amt, at: S.t + o.loan.t, from: 'CORVUS' }); }
    if (o.computeThrottle) KY.addBuff({ kind: 'throttle', ttl: o.computeThrottle, mult: 0.7 });
    if (o.risk === 'dc') S.dcRisk = S.t + 45;
    if (o.research) KY.research.addPts(o.research);
    if (cr.kind === 'welt') {
      S.stats.crises++;
      if (o.py >= 2) KY.adj('ans', 1);
      const rel = o.fx && (o.fx.stab > 0 || o.fx.span < 0);
      if (rel && Math.random() < 0.5) W.news(cr.rid, W.fillHead(U.pick(KY.data.projectHeads.done.HUM), cr.rid), 'good');
    }
    if (auto) S.stats.crisesAuto++;
    KY.log('kri', (auto ? (regel7 ? 'Fristablauf · Betriebsregel 7: PYTHIA setzt um: ' : 'Fristablauf · keine Maßnahme: ') : 'Entscheidung: ') + o.t + ' · ' + cr.title);
    if (auto) KY.notify({ cat: 'kri', lvl: 'warn', title: regel7 ? 'Frist abgelaufen · Betriebsregel 7' : 'Frist abgelaufen', text: (regel7 ? 'PYTHIA hat umgesetzt: ' : 'Keine Maßnahme: ') + o.t, link: { mod: 'protokoll' } });
    S.crisis = null;
    if (KY.audio && !KY.silent) KY.audio.play(auto ? 'deny' : 'ok');
    KY.bus.emit('crisis', null);
    KY.bus.emit('res');
    return true;
  };
})();
