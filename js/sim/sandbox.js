/* KYTHERA · MANDAT · Weltregie: freie Sandbox-Werkzeuge über Natur, Wirtschaft und Politik */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const SB = (KY.sandbox = {});

  SB.init = function (S, mode) {
    S.mode = S.mode || mode || 'mandat';
    if (!S.sb) S.sb = { on: S.mode === 'sandbox', money: S.mode === 'sandbox', approve: S.mode === 'sandbox', log: [] };
    if (!S.sb.log) S.sb.log = [];
  };
  SB.on = () => !!(SIM.S && SIM.S.sb && SIM.S.sb.on);
  SB.flag = k => !!(SIM.S && SIM.S.sb && SIM.S.sb.on && SIM.S.sb[k]);

  /* target: point (Ort auf der Karte), nation, two (zwei Staaten), global */
  SB.CATS = [
    { id: 'natur', n: 'Naturgewalten', icon: 'quake' },
    { id: 'wirtschaft', n: 'Wirtschaft', icon: 'chart' },
    { id: 'politik', n: 'Politik', icon: 'ballot' },
  ];
  SB.TOOLS = [
    { id: 'quake', cat: 'natur', ev: 'quake', target: 'point' },
    { id: 'tsunami', cat: 'natur', ev: 'tsunami', target: 'point', coast: true },
    { id: 'storm', cat: 'natur', ev: 'storm', target: 'point' },
    { id: 'flood', cat: 'natur', ev: 'flood', target: 'point' },
    { id: 'volcano', cat: 'natur', ev: 'volcano', target: 'point' },
    { id: 'meteor', cat: 'natur', ev: 'meteor', target: 'point' },
    { id: 'fire', cat: 'natur', ev: 'fire', target: 'point' },
    { id: 'drought', cat: 'natur', ev: 'drought', target: 'nation' },
    { id: 'heat', cat: 'natur', ev: 'heat', target: 'nation' },
    { id: 'cold', cat: 'natur', ev: 'cold', target: 'nation' },
    { id: 'epidemic', cat: 'natur', ev: 'epidemic', target: 'nation' },
    { id: 'crash', cat: 'wirtschaft', n: 'Weltweiter Börsencrash', icon: 'trendDown', target: 'global', text: 'Die Kurse stürzen ab, Wachstum bricht überall ein.' },
    { id: 'boom', cat: 'wirtschaft', n: 'Wirtschaftsboom', icon: 'trendUp', target: 'nation', text: 'Ein Jahr kräftiges Wachstum, mehr Zufriedenheit.' },
    { id: 'resource', cat: 'wirtschaft', n: 'Rohstofffund', icon: 'mountain', target: 'nation', text: 'Dauerhaft mehr Wachstum – aber auch mehr Korruption und Umweltschäden.' },
    { id: 'debt', cat: 'wirtschaft', n: 'Staatsschuldenkrise', icon: 'bank', target: 'nation', text: 'Der Staat kann seine Schulden kaum bedienen.' },
    { id: 'cropfail', cat: 'wirtschaft', n: 'Missernte', icon: 'wheat', target: 'nation', text: 'Lebensmittel werden knapp und teuer.' },
    { id: 'blackout', cat: 'wirtschaft', n: 'Stromausfall', icon: 'power', target: 'nation', text: 'Das Netz bricht zusammen.' },
    { id: 'election', cat: 'politik', n: 'Neuwahl ansetzen', icon: 'ballot', target: 'nation', text: 'Die Bevölkerung entscheidet sofort neu.' },
    { id: 'detente', cat: 'politik', n: 'Annäherung', icon: 'hands', target: 'two', text: 'Zwei Regierungen finden zueinander.' },
    { id: 'freeze', cat: 'politik', n: 'Diplomatische Eiszeit', icon: 'snow', target: 'two', text: 'Botschafter werden abgezogen, Grenzen geschlossen. Kein Krieg.' },
    { id: 'trade', cat: 'politik', n: 'Handelsabkommen', icon: 'scales', target: 'two', text: 'Zölle fallen, beide Volkswirtschaften wachsen.' },
    { id: 'summit', cat: 'politik', n: 'Weltgipfel', icon: 'globe', target: 'global', text: 'Alle Staaten rücken ein Stück zusammen.' },
  ];
  SB.TOOLS.forEach(t => {
    if (t.ev) { const E = D.EVENTS[t.ev]; t.n = E.n; t.icon = E.icon; t.text = t.text || E.text[0].replace(/\{\w+\}/g, '…'); t.sev = true; }
  });
  SB.TOOL = {};
  SB.TOOLS.forEach(t => { SB.TOOL[t.id] = t; });

  function log(t, txt) {
    const S = SIM.S;
    U.push(S.sb.log, { day: S.day, t: t.id, txt }, 60);
    SIM.chron('regie', 'Weltregie: ' + txt, null);
  }

  /* Werkzeug anwenden; tg: { lon, lat } | { n } | { n, n2 } | {} */
  SB.apply = function (id, tg, sev) {
    const S = SIM.S, W = SIM.W, t = SB.TOOL[id];
    if (!t) return { ok: false, err: 'Unbekanntes Werkzeug.' };
    sev = U.clamp(sev || 3, 1, 5);
    if (t.ev) {
      let at = tg.lon !== undefined ? { lon: tg.lon, lat: tg.lat } : null;
      let city;
      if (t.target === 'nation') { if (tg.n === undefined || tg.n < 0) return { ok: false, err: 'Kein Staat an dieser Stelle.' }; city = W.nations[tg.n].capital; at = null; }
      if (t.coast) {
        const r = KY.geo.nearestCity(tg.lon, tg.lat, c => c.coastal);
        if (!r || r.km > 900) return { ok: false, err: 'Ein Tsunami braucht eine Küste in der Nähe.' };
        city = r.city.id;
      }
      if (at && KY.geo.nationAt(at.lon, at.lat) < 0) {
        const r = KY.geo.nearestCity(at.lon, at.lat);
        if (!r || r.km > 1400) return { ok: false, err: 'Zu weit von bewohntem Land entfernt.' };
      }
      const ev = KY.events.spawn(t.ev, { at, city, sev, director: true });
      if (!ev) return { ok: false, err: 'Hier nicht möglich.' };
      log(t, ev.name + ' (Stufe ' + sev + ')');
      return { ok: true, msg: ev.name + ' · Stufe ' + sev, ev };
    }
    const n = tg.n, n2 = tg.n2;
    const N = n !== undefined && n >= 0 ? S.nations[n] : null;
    const name = n >= 0 ? SIM.nName(n) : '';
    switch (id) {
      case 'crash': KY.nations.globalCrash(); log(t, 'Weltweiter Börsencrash'); return { ok: true, msg: 'Die Börsen brechen ein.' };
      case 'boom':
        SIM.shock(n, 'growth', 2.6, 365); SIM.shock(n, 'happy', 4, 300); SIM.shock(n, 'unemp', -2.5, 365);
        N.crisis = { k: 'boom', start: S.day, until: S.day + 365 };
        KY.media.story('econ_boom', { n }, { tone: 0.4, heat: 24 });
        log(t, 'Wirtschaftsboom in ' + name); return { ok: true, msg: 'Boom in ' + name };
      case 'resource':
        N.growth0 += 0.7; N.gdp *= 1.02; N.fx.corrupt = (N.fx.corrupt || 0) + 3; N.fx.env = (N.fx.env || 0) - 2;
        SIM.shock(n, 'happy', 3, 400);
        KY.media.story(null, { n }, { h: U.pick(['Jahrhundertfund in ' + name + ': Riesige Rohstofflager entdeckt', name + ' im Rohstoffrausch', 'Geologen jubeln: ' + name + ' sitzt auf einem Schatz']), tone: 0.3, heat: 26, key: 'resource' });
        log(t, 'Rohstofffund in ' + name); return { ok: true, msg: 'Rohstoffe in ' + name };
      case 'debt':
        N.crisis = { k: 'debt', start: S.day, until: S.day + 420 };
        SIM.shock(n, 'growth', -2.6, 420); SIM.shock(n, 'happy', -7, 300); SIM.shock(n, 'unrest', 9, 300);
        KY.media.story('econ_debt', { n }, { tone: -0.4, heat: 34 });
        KY.projects.bondDefault(n);
        log(t, 'Staatsschuldenkrise in ' + name); return { ok: true, msg: 'Schuldenkrise in ' + name };
      case 'cropfail':
        SIM.shock(n, 'poverty', 6, 300); SIM.shock(n, 'happy', -5, 240); SIM.shock(n, 'unrest', 5, 240);
        KY.media.story('crop_fail', { n }, { tone: -0.5, heat: 26 });
        log(t, 'Missernte in ' + name); return { ok: true, msg: 'Missernte in ' + name };
      case 'blackout':
        N.crisis = { k: 'blackout', start: S.day, until: S.day + 20 };
        SIM.shock(n, 'happy', -5, 40); SIM.shock(n, 'growth', -0.4, 60);
        KY.media.story('blackout', { n, c: W.nations[n].capital }, { tone: -0.3, heat: 26 });
        log(t, 'Stromausfall in ' + name); return { ok: true, msg: 'Stromausfall in ' + name };
      case 'election':
        KY.nations.election(n);
        log(t, 'Neuwahl in ' + name); return { ok: true, msg: 'Neuwahl in ' + name + ': ' + S.nations[n].gov.party };
      case 'detente': case 'freeze': case 'trade': {
        if (n2 === undefined || n2 < 0 || n2 === n) return { ok: false, err: 'Zwei verschiedene Staaten wählen.' };
        const R = SIM.rel(n, n2);
        if (id === 'detente') { SIM.relAdd(n, n2, 35, 'regie'); R.base = Math.max(R.base, R.v - 15); KY.media.story('mediation_ok', { n, n2 }, { tone: 0.5, heat: 24 }); }
        if (id === 'freeze') { SIM.relAdd(n, n2, -(R.v + 88), 'regie'); R.base = Math.min(R.base, -55); }
        if (id === 'trade') { SIM.relAdd(n, n2, 12, 'regie'); R.trade = true; S.nations[n].fx.growth = (S.nations[n].fx.growth || 0) + 0.15; S.nations[n2].fx.growth = (S.nations[n2].fx.growth || 0) + 0.15; KY.media.story('trade_deal', { n, n2 }, { tone: 0.3, heat: 18 }); }
        const txt = t.n + ': ' + name + ' und ' + SIM.nName(n2);
        log(t, txt); return { ok: true, msg: txt };
      }
      case 'summit':
        for (const k in S.rel) SIM.relAdd(+k.split(':')[0], +k.split(':')[1], 8, 'regie');
        S.g.summit = (S.g.summit || 0) + 2;
        KY.media.story(null, {}, { h: 'Historischer Weltgipfel: Alle Staaten unterzeichnen gemeinsame Erklärung', tone: 0.5, heat: 40, global: true, key: 'summit_regie' });
        log(t, 'Weltgipfel'); return { ok: true, msg: 'Weltgipfel abgehalten' };
    }
    return { ok: false, err: 'Nicht möglich.' };
  };

  /* Staatswerte direkt verändern (Strukturwert verschiebt sich mit, damit die Änderung bleibt) */
  SB.EDIT = [
    { k: 'happy', n: 'Zufriedenheit' }, { k: 'unrest', n: 'Unruhe' }, { k: 'health', n: 'Gesundheit' }, { k: 'edu', n: 'Bildung' },
    { k: 'infra', n: 'Infrastruktur' }, { k: 'energy', n: 'Energie' }, { k: 'env', n: 'Umwelt' }, { k: 'press', n: 'Pressefreiheit' },
    { k: 'corrupt', n: 'Korruption' }, { k: 'openness', n: 'Offenheit der Regierung', gov: true }, { k: 'approval', n: 'Zustimmung zur Regierung', gov: true }, { k: 'op', n: 'Haltung zu Ihnen', op: true },
  ];
  SB.setValue = function (nid, k, v) {
    const n = SIM.S.nations[nid];
    const E = SB.EDIT.find(x => x.k === k);
    if (!n || !E) return;
    v = +v;
    if (E.gov) { n.gov[k] = U.clamp(v, 0, 100); return; }
    if (E.op) { for (let m = 0; m < 5; m++) n.milOp[m] = U.clamp(v, -100, 100); n.aware = Math.max(n.aware, 30); SIM.recalcOp(n); return; }
    const d = v - n[k];
    n[k] = U.clamp(v, 0, 100);
    n.base[k] = U.clamp((n.base[k] || 0) + d, 0, 100);
  };

  /* Laufende Wirkung der Sandbox-Schalter */
  SB.daily = function () {
    const S = SIM.S;
    if (!SB.flag('money')) return;
    if (S.fin.cash < 5000) S.fin.cash = 5000;
  };
})();
