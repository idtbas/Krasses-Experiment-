/* KYTHERA · MANDAT · Forschungsprogramme */
(function () {
  'use strict';
  const KY = window.KY;
  const D = KY.data;
  const SIM = KY.sim;
  const R = (KY.research = {});
  R.MAX = 3;

  R.state = function (id) {
    const res = SIM.S.res;
    if (res.done[id]) return 'done';
    if (res.active.some(a => a.id === id)) return 'active';
    const T = D.TECH_BY[id];
    if (T.req.some(r => !res.done[r])) return 'locked';
    return 'open';
  };
  R.start = function (id, mode) {
    const S = SIM.S, T = D.TECH_BY[id];
    if (R.state(id) !== 'open') return { ok: false, err: 'Nicht verfügbar.' };
    if (S.res.active.length >= R.MAX) return { ok: false, err: 'Es laufen bereits ' + R.MAX + ' Programme.' };
    const down = T.cost * 0.25;
    if (KY.finance.avail() < down) return { ok: false, err: 'Nicht genügend liquide Mittel.' };
    KY.finance.spend(down, 'Forschung: ' + T.n);
    S.res.active.push({ id, prog: 0, start: S.day, mode: mode === 'excl' ? 'excl' : 'open', paid: down });
    SIM.chron('forschung', 'Forschungsprogramm gestartet: ' + T.n + (mode === 'excl' ? ' (exklusiv)' : ' (offen für alle)') + '.', null);
    return { ok: true };
  };
  R.daily = function () {
    const S = SIM.S;
    for (const a of S.res.active.slice()) {
      const T = D.TECH_BY[a.id];
      const pay = T.cost * 0.75 / T.days;
      if (KY.finance.avail() < pay) continue;
      KY.finance.spend(pay, null, true); a.paid += pay;
      a.prog += (S.g.resBoost || 1) / T.days;
      if (a.prog >= 1) finish(a);
    }
  };
  function finish(a) {
    const S = SIM.S, T = D.TECH_BY[a.id];
    S.res.active = S.res.active.filter(x => x !== a);
    S.res.done[a.id] = { day: S.day, mode: a.mode };
    const fx = T.fx;
    for (const k in fx) {
      if (k === 'unlock') { S.g.unlock = S.g.unlock || {}; S.g.unlock[fx.unlock] = true; }
      else S.g.techFx[k] = fx[k];
    }
    if (a.mode === 'open') {
      S.g.globalTech = (S.g.globalTech || 0) + 0.08;
      S.nations.forEach((n, id) => SIM.opImpulse(id, [0.5, 0.2, 0.1, 0.6, 0.1], 0.6, { aware: 0.5 }));
      SIM.g_trust(2);
    } else {
      S.res.lic = (S.res.lic || 0) + T.cost * 0.04;
    }
    KY.media.story('research_done', { extra: { tech: T.n } }, { tone: 0.4, heat: 18 + T.cost, global: true });
    SIM.chron('forschung', 'Durchbruch: ' + T.n + '. ' + T.text, null);
    SIM.msg('brennan', 'Forschungsdurchbruch: ' + T.n, [T.text, a.mode === 'open' ? 'Die Ergebnisse stehen allen Staaten frei zur Verfügung. Die Resonanz ist enorm.' : 'Die Lizenzrechte liegen exklusiv bei Ihren Strukturen und bringen laufende Einnahmen.'], { kind: 'info' });
  }
})();
