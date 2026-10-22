/* KYTHERA · MANDAT · Vermögen, Rendite, Gebühren, Sperrkonto */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U;
  const SIM = KY.sim;
  const F = (KY.finance = {});

  F.avail = () => Math.max(0, SIM.S.fin.cash - (SIM.S.day < SIM.S.fin.frozenUntil ? SIM.S.fin.frozen : 0));
  F.spend = function (amount, label, silent) {
    const S = SIM.S, f = S.fin;
    if (!(amount > 0)) return;
    f.cash -= amount; f.y.spent += amount; S.g.spent += amount;
    if (label && !silent) { f.log = f.log || []; f.log.unshift({ day: S.day, t: label, v: -amount }); if (f.log.length > 240) f.log.length = 240; }
  };
  F.income = function (amount, label) {
    const S = SIM.S, f = S.fin;
    if (!(amount > 0)) return;
    f.cash += amount; f.y.inc += amount;
    if (label) { f.log = f.log || []; f.log.unshift({ day: S.day, t: label, v: amount }); if (f.log.length > 240) f.log.length = 240; }
  };
  F.freeze = function (frac, days) {
    const S = SIM.S, f = S.fin;
    f.frozen = f.cash * frac; f.frozenUntil = S.day + days;
    SIM.chron('finanzen', U.money(f.frozen) + ' auf dem Sperrkonto des Kuratoriums (' + U.days(days) + ').', null);
  };
  F.strategy = () => SIM.STRAT[SIM.contract('strategy')] || SIM.STRAT.bal;
  F.fees = () => (SIM.JUR[SIM.contract('jurisdiction')] || SIM.JUR.holmvik).fee + (SIM.TRUSTEE[SIM.contract('trustee')] || SIM.TRUSTEE.halvorsen).fee;

  F.daily = function () {
    const S = SIM.S, f = S.fin;
    const st = F.strategy();
    const r = st.mu / 365 + st.sd / Math.sqrt(365) * U.gauss() + (S.g.market || 0) / 100 / 365 * st.beta * 3;
    const invested = Math.max(0, f.cash * 0.9);
    const ret = invested * r;
    f.cash += ret; f.y.ret += ret;
    f.idx *= 1 + r;
    const fee = Math.max(0, f.cash) * F.fees() / 365;
    f.cash -= fee; f.y.fees += fee;
    if (S.res && S.res.lic) F.income(S.res.lic / 365);
    f.peak = Math.max(f.peak, f.cash);
    if (S.day >= f.frozenUntil && f.frozen > 0) {
      f.frozen = 0;
      SIM.chron('finanzen', 'Das Sperrkonto des Kuratoriums ist wieder freigegeben.', null);
    }
    if (f.cash < 20 && !f.lowWarn) {
      f.lowWarn = true;
      SIM.msg('trustee', 'Liquidität knapp', ['Das liquide Vermögen ist unter ' + U.money(20) + ' gefallen. Laufende Bauvorhaben könnten ins Stocken geraten.'], { kind: 'warn' });
    }
    if (f.cash > 60) f.lowWarn = false;
  };
  F.monthly = function () {
    const S = SIM.S, f = S.fin;
    U.push(f.hist, { d: S.day, c: Math.round(f.cash * 10) / 10, i: Math.round(f.idx * 100) / 100 }, 360);
  };
  F.yearly = function () {
    const f = SIM.S.fin;
    f.ly = f.y;
    f.y = { ret: 0, inc: 0, spent: 0, fees: 0, comp: 0 };
  };
  F.crash = function (depth) {
    const S = SIM.S, f = S.fin;
    const st = F.strategy();
    const loss = f.cash * 0.9 * depth * st.beta;
    f.cash -= loss; f.y.ret -= loss; f.idx *= 1 - depth * st.beta;
    SIM.msg('trustee', 'Kurssturz an den Weltbörsen', ['Der KX 500 ist eingebrochen. Ihr Portfolio hat ' + U.money(loss) + ' an Wert verloren.', 'Wir empfehlen, nicht zu verkaufen. Märkte haben sich bislang immer erholt, aber wann, kann niemand sagen.'], { kind: 'warn' });
  };
  /* Zugesagte, noch nicht bezahlte Summen laufender Vorhaben */
  F.commitments = function () {
    return SIM.S.projects.reduce((s, p) => s + (KY.projects.ACTIVE[p.phase] && p.phase !== 'betrieb' ? Math.max(0, p.cost - p.paid) : 0), 0);
  };
})();
