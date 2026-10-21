/* KYTHERA · Kapitalmarkt */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const M = KY.market = {};

  M.co = t => KY.data.companies.find(c => c.t === t);
  M.value = function (t) { const c = KY.S.market.c[t]; return c.u * c.p; };
  M.holdings = function () {
    let v = 0;
    for (const t in KY.S.market.c) v += M.value(t);
    return v;
  };
  M.netWorth = () => KY.S.res.kap + M.holdings();
  M.change = function (t, n) {
    const h = KY.S.market.c[t].h;
    const a = h[Math.max(0, h.length - 1 - (n || 60))], b = KY.S.market.c[t].p;
    return a ? (b / a - 1) * 100 : 0;
  };
  M.feeRate = () => KY.hasRes('F1') ? 0.0005 : 0.001;

  /* Kursimpuls in Prozent; fund: Anteil, der den fairen Wert mitbewegt */
  M.shock = function (t, pct, fund) {
    const c = KY.S.market.c[t];
    if (!c) return;
    c.p *= 1 + pct / 100;
    c.f *= 1 + (pct / 100) * (fund === undefined ? 0.6 : fund);
  };
  M.sectorShock = function (sec, pct, region) {
    for (const co of KY.data.companies) {
      if (co.s !== sec) continue;
      if (region && co.r !== region) continue;
      M.shock(co.t, pct * U.rf(0.7, 1.3));
    }
  };
  M.regionShock = function (region, pct) {
    for (const co of KY.data.companies) if (co.r === region) M.shock(co.t, pct * U.rf(0.6, 1.2));
  };
  M.marketShock = function (pct) {
    for (const co of KY.data.companies) M.shock(co.t, pct * U.rf(0.5, 1.5), 0.4);
  };
  M.comShock = function (id, pct) {
    const c = KY.S.market.com[id];
    if (c) c.p *= 1 + pct / 100;
  };

  /* Kauf/Verkauf. amount in Mrd ¤ (Verkauf: Marktwert) */
  M.preview = function (t, side, amount) {
    const co = M.co(t), c = KY.S.market.c[t];
    const impact = 0.55 * amount / co.mc * (side === 'buy' ? 1 : -1);
    const avg = c.p * (1 + impact / 2);
    const fee = amount * M.feeRate();
    return { impact: impact * 100, avg, fee, units: amount / avg };
  };
  M.trade = function (t, side, amount) {
    const S = KY.S, c = S.market.c[t], co = M.co(t);
    amount = Math.max(0, amount);
    if (amount < 0.01) return { ok: false, err: 'Ordervolumen zu klein.' };
    const pv = M.preview(t, side, amount);
    if (side === 'buy') {
      if (S.res.kap < amount + pv.fee) return { ok: false, err: 'Nicht genügend Kapital.' };
      S.res.kap -= amount + pv.fee;
      c.u += pv.units;
      c.cost += amount;
    } else {
      const val = c.u * c.p;
      if (amount > val + 1e-6) return { ok: false, err: 'Position kleiner als Ordervolumen.' };
      const frac = amount / val;
      const units = c.u * frac;
      const proceeds = units * pv.avg;
      const basis = c.cost * frac;
      c.u -= units; c.cost -= basis;
      if (c.u < 1e-9) { c.u = 0; c.cost = 0; }
      S.res.kap += proceeds - pv.fee;
      S.stats.profit += proceeds - basis;
    }
    c.p *= 1 + pv.impact / 100;
    S.market.fees += pv.fee;
    S.stats.trades++;
    KY.log('kap', (side === 'buy' ? 'Kauf ' : 'Verkauf ') + co.n + ' (' + t + '): ' + U.money(amount) + ' · Kursimpuls ' + U.sgn(pv.impact, 2, ' %'));
    KY.bus.emit('market'); KY.bus.emit('res');
    KY.onb('handel');
    return { ok: true, impact: pv.impact, fee: pv.fee };
  };

  M.tick = function (dt) {
    const S = KY.S, D = KY.data;
    const sample = (S.t % 5) < dt;
    let idx = 0, idxBase = 0;
    for (const co of D.companies) {
      const c = S.market.c[co.t];
      const R = S.regions[co.r];
      // fairer Wert folgt Wohlstand und Stabilität der Region
      const fund = co.p * (1 + (R.m.wohl - R.base.wohl) / 70 + (R.m.stab - R.base.stab) / 140);
      c.f += (fund - c.f) * 0.004 * dt;
      if (c.muT > 0) { c.muT -= dt; if (c.muT <= 0) c.mu = 0; }
      const sig = co.v * 0.0016;
      const rev = (c.f - c.p) / c.p * 0.012;
      const r = (rev + c.mu * 0.0009) * dt + U.gauss() * sig * Math.sqrt(dt);
      c.p = Math.max(0.05, c.p * (1 + r));
      if (sample) U.push(c.h, +c.p.toFixed(4), 240);
      idx += co.mc * (c.p / co.p);
      idxBase += co.mc;
    }
    S.market.idx.v = 1000 * idx / idxBase;
    for (const cm of D.commodities) {
      const c = S.market.com[cm.id];
      c.p *= 1 + ((cm.p - c.p) / cm.p * 0.004) * dt + U.gauss() * cm.v * 0.0012 * Math.sqrt(dt);
      if (sample) U.push(c.h, +c.p.toFixed(3), 160);
    }
    if (sample) {
      U.push(S.market.idx.h, +S.market.idx.v.toFixed(2), 240);
      U.push(S.market.nw, +M.netWorth().toFixed(3), 240);
    }
    // Erträge: Dividenden (Zeitraffer: 1 Minute ≈ 1 Quartal)
    let div = 0;
    const mult = KY.hasRes('F3') ? 1.25 : 1;
    for (const co of D.companies) div += S.market.c[co.t].u * S.market.c[co.t].p * co.div / 100 / 4 * mult;
    const base = 1.2; // Stiftungserträge je Minute
    S.res.kap += (div + base - M.upkeep()) / 60 * dt;
    M.lastIncome = div + base - M.upkeep();
    M.lastDiv = div;
  };
  M.upkeep = function () {
    const S = KY.S;
    return 0.02 * S.infra.sats.length + 0.015 * S.infra.ships.length + S.infra.dcs.reduce((s, d) => s + 0.01 * d.lvl, 0) + 0.01 * S.research.stations;
  };
  M.lastIncome = 0;
  M.lastDiv = 0;

  /* Prognose (nur mit Algorithmischem Handel sichtbar) */
  M.forecast = function (t) {
    const c = KY.S.market.c[t];
    const gap = (c.f - c.p) / c.p * 100;
    const drift = c.mu * 3;
    return gap * 0.6 + drift;
  };
})();
