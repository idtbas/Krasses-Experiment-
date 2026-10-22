/* KYTHERA · MANDAT · Gemeinsame Simulationsfunktionen: Zugriff, Chronik, Kanal, Meinung, Wirkungen */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;

  SIM.bind = function (S, W) { SIM.S = S; SIM.W = W; KY.geo.bind(W); };
  SIM.wn = id => SIM.W.nations[id];
  SIM.sn = id => SIM.S.nations[id];
  SIM.wc = id => SIM.W.cities[id];
  SIM.sc = id => SIM.S.cities[id];
  SIM.nName = id => (id >= 0 && SIM.W.nations[id] ? SIM.W.nations[id].short : 'Internationale Gewässer');
  SIM.cName = id => (id >= 0 && SIM.W.cities[id] ? SIM.W.cities[id].name : '—');
  SIM.citiesOf = nid => SIM.W.cities.filter(c => c.nation === nid);
  SIM.capitalOf = nid => SIM.W.cities[SIM.W.nations[nid].capital];
  SIM.adv = function (id) {
    const S = SIM.S, v = S.contracts.vals;
    if (id === 'trustee') id = v.trustee || 'halvorsen';
    if (id === 'envoy') id = v.envoy || 'vidal';
    return D.ADVISORS[id] || D.ADVISORS.haddad;
  };
  SIM.hasPrinciple = p => (SIM.S.contracts.vals.principles || []).indexOf(p) >= 0;
  SIM.contract = k => SIM.S.contracts.vals[k];

  /* ---------- Chronik und Kanal ---------- */
  SIM.chron = function (type, text, ref) {
    const S = SIM.S;
    const e = { id: ++S.seq.chron, day: S.day, type, text, ref: ref || null };
    U.push(S.chron, e, 2500);
    KY.bus.emit('chron', e);
    return e;
  };
  /* Nachricht im verschlüsselten Kanal. opts: { kind, acts:[{l, a, p}], prio } */
  SIM.msg = function (from, subj, body, opts) {
    const S = SIM.S;
    opts = opts || {};
    const a = SIM.adv(from);
    const m = { id: ++S.seq.msg, day: S.day, from: a.id, subj, body: Array.isArray(body) ? body : [body], kind: opts.kind || 'info', acts: opts.acts || [], read: false, prio: opts.prio || 0, ref: opts.ref || null };
    S.inbox.unshift(m);
    if (S.inbox.length > 260) S.inbox.length = 260;
    KY.bus.emit('msg', m);
    return m;
  };

  /* ---------- Beziehungen ---------- */
  SIM.relKey = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
  SIM.rel = (a, b) => SIM.S.rel[SIM.relKey(a, b)];
  SIM.relState = v => (v < -80 ? 'eiszeit' : v < -60 ? 'krise' : v < -40 ? 'angespannt' : v > 55 ? 'partner' : 'normal');
  SIM.REL_NAMES = { eiszeit: 'Eiszeit', krise: 'Diplomatische Krise', angespannt: 'Angespannt', normal: 'Normal', partner: 'Enge Partner' };
  SIM.relAdd = function (a, b, dv, why) {
    if (a === b || a < 0 || b < 0) return;
    const R = SIM.rel(a, b);
    if (!R) return;
    const before = R.state;
    R.v = U.clamp(R.v + dv, -100, 100);
    R.state = SIM.relState(R.v);
    if (R.state !== before) { R.since = SIM.S.day; KY.bus.emit('relchange', { a, b, from: before, to: R.state, why }); }
  };

  /* ---------- Meinung der Bevölkerung ---------- */
  /* vec: [urb, arb, land, jung, kons] oder Zahl; amt: Stärke in Meinungspunkten; opts.aware: Bekanntheit erhöhen */
  SIM.opImpulse = function (nid, vec, amt, opts) {
    const n = SIM.S.nations[nid];
    if (!n) return;
    opts = opts || {};
    if (opts.aware) n.aware = U.clamp(n.aware + opts.aware, 0, 100);
    const know = opts.direct ? 1 : 0.35 + n.aware * 0.0065;
    for (let m = 0; m < 5; m++) {
      const v = typeof vec === 'number' ? vec : vec[m];
      // Sättigung: Extreme bewegen sich schwerer
      const cur = n.milOp[m];
      let d = v * amt * know * SIM.OPK;
      if (d > 0 && cur > 0) d *= 1 - cur / 130;
      if (d < 0 && cur < 0) d *= 1 + cur / 130;
      n.milOp[m] = U.clamp(cur + d, -100, 100);
    }
    SIM.recalcOp(n);
  };
  SIM.OPK = 4;
  SIM.recalcOp = function (n) {
    let s = 0;
    for (let m = 0; m < 5; m++) s += n.milOp[m] * n.milW[m];
    n.op = s;
  };
  /* Weltweite Haltung: nach Bevölkerung und Bekanntheit gewichtet */
  SIM.worldOp = function () {
    let s = 0, w = 0;
    SIM.S.nations.forEach(n => { const k = n.pop * (0.2 + n.aware / 100); s += n.op * k; w += k; });
    return w ? s / w : 0;
  };
  SIM.worldAware = function () {
    let s = 0, w = 0;
    SIM.S.nations.forEach(n => { s += n.aware * n.pop; w += n.pop; });
    return w ? s / w : 0;
  };

  /* ---------- Dauerhafte Wirkungen von Vorhaben ---------- */
  /* Fügt Wirkungen zu fx-Summen hinzu (sign = +1 / −1 beim Zurücknehmen) */
  SIM.applyMods = function (p, mods, sign) {
    if (!mods) return;
    const S = SIM.S;
    const addTo = (obj, m, k) => { for (const key in m) { obj[key] = (obj[key] || 0) + m[key] * sign * k; } };
    const k = p.scale || 1;
    if (mods.nation && p.n >= 0) addTo(S.nations[p.n].fx, mods.nation, k);
    if (mods.nation2 && p.n2 >= 0) addTo(S.nations[p.n2].fx, mods.nation2, k);
    if (mods.city && p.c >= 0) addTo(S.cities[p.c].fx, mods.city, k);
    if (mods.city2 && p.c2 >= 0) addTo(S.cities[p.c2].fx, mods.city2, k);
    if (mods.rel && p.n >= 0 && p.n2 >= 0 && p.n !== p.n2 && sign > 0) SIM.relAdd(p.n, p.n2, mods.rel, p.act);
    if (mods.relDown && p.down >= 0 && sign > 0) SIM.relAdd(p.n, p.down, mods.relDown, p.act);
  };

  /* Lokaler Schock (zeitlich abklingend) auf einen Staatswert */
  SIM.shock = function (nid, key, amount, days) {
    const n = SIM.S.nations[nid];
    if (!n) return;
    n.shock.push({ k: key, v: amount, until: SIM.S.day + days, d: days });
  };

  /* Text-Füllung mit Weltbezug */
  SIM.vars = function (o) {
    const v = {};
    if (o.n !== undefined && o.n >= 0) v.nation = SIM.nName(o.n);
    if (o.n2 !== undefined && o.n2 >= 0) v.nation2 = SIM.nName(o.n2);
    if (o.c !== undefined && o.c >= 0) v.city = SIM.cName(o.c);
    if (o.c2 !== undefined && o.c2 >= 0) v.city2 = SIM.cName(o.c2);
    return Object.assign(v, o.extra || {});
  };

  /* Kleine Zufallshilfe mit Gewichtung zu niedrigen Werten */
  SIM.rangeRoll = function (rg, skew) {
    const t = Math.pow(Math.random(), skew || 1.4);
    return Math.round(rg[0] + (rg[1] - rg[0]) * t);
  };
  SIM.techFx = function (key, def) {
    const v = SIM.S.g.techFx[key];
    return v === undefined ? (def === undefined ? 1 : def) : v;
  };
})();
