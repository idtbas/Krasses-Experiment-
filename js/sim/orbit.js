/* KYTHERA · MANDAT · Orbitale Leitstelle: Starts, Satelliten, Weltraumschrott, Wirkungen auf der Erde */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const O = (KY.orbit = {});

  O.state = function () {
    const S = SIM.S;
    if (!S.orbit) S.orbit = { sats: [], missions: [], debris: 0, launches: 0, fails: 0, seq: 0, cleanups: 0 };
    return S.orbit;
  };
  O.active = () => O.state().sats;
  O.count = type => O.state().sats.filter(s => s.type === type).length;
  O.stationModules = () => O.count('modul');
  O.coverage = () => Math.min(1, O.count('komm') / 24);

  /* Startplätze: eigene Raumhäfen oder gemietete Startplätze technologisch führender Staaten */
  O.sites = function () {
    const S = SIM.S, W = SIM.W;
    const own = S.projects.filter(p => p.act === 'RAUMHAFEN' && p.phase === 'betrieb').map(p => ({ id: p.id, own: true, n: 'Eigener Raumhafen bei ' + SIM.cName(p.c), nid: p.n, c: p.c, lon: p.lon, lat: p.lat, mult: 1, ok: p.retrofit ? 1.01 : 1 }));
    const best = S.nations.map((n, id) => ({ id, t: n.tech })).sort((a, b) => b.t - a.t).slice(0, 2);
    const rent = best.map(b => { const c = W.cities[W.nations[b.id].capital]; return { id: 'rent' + b.id, own: false, n: 'Startplatz in ' + W.nations[b.id].short + ' (gemietet)', nid: b.id, c: c.id, lon: c.lon, lat: c.lat, mult: 1.5, ok: 1 }; });
    return own.concat(rent);
  };

  O.quote = function (o) {
    const S = SIM.S;
    const R = D.ROCKET[o.rocket], T = D.SATS[o.type];
    const site = O.sites().find(s => s.id === o.site) || O.sites()[0];
    const errs = [];
    if (!R || !T || !site) errs.push('Unvollständige Missionsplanung.');
    if (R && R.tech && !(S.res.done[R.tech])) errs.push('Erfordert das Forschungsprogramm „Wiederverwendbare Raketenstufen“.');
    if (T && T.station && R && !R.station) errs.push('Ein Stationsmodul passt nur in eine Schwerlastrakete.');
    const n = T && T.station ? 1 : U.clamp(o.count || 1, 1, R ? R.cap : 1);
    const cost = R && T ? (R.cost + T.cost * n * (o.safe ? 1.2 : 1)) * (site ? site.mult : 1) : 0;
    const ok = R ? U.clamp(R.ok * (site ? site.ok : 1) * (1 - Math.min(0.08, O.state().debris / 1000)), 0.5, 0.995) : 0;
    if (cost > KY.finance.avail()) errs.push('Nicht genügend liquide Mittel.');
    return { R, T, site, n, cost, ok, days: R ? R.days : 0, errs, valid: !errs.length };
  };

  O.plan = function (o) {
    const S = SIM.S, st = O.state();
    const q = O.quote(o);
    if (!q.valid) return { ok: false, err: q.errs[0] };
    KY.finance.spend(q.cost, 'Raumfahrt: ' + q.R.n + ' mit ' + q.n + ' × ' + q.T.n);
    const m = { id: 'm' + (++st.seq), rocket: q.R.id, type: o.type, n: q.n, site: q.site.id, siteName: q.site.n, nid: q.site.nid, c: q.site.c, lon: q.site.lon, lat: q.site.lat, own: q.site.own, safe: !!o.safe, launch: S.day + q.days, status: 'geplant', cost: q.cost, ok: q.ok, planned: S.day };
    st.missions.unshift(m);
    if (st.missions.length > 80) st.missions.length = 80;
    SIM.chron('raumfahrt', 'Mission geplant: ' + q.R.n + ' mit ' + q.n + ' × ' + q.T.n + ' · Start am ' + U.dateStr(m.launch, true) + '.', null);
    return { ok: true, m };
  };

  function satName(type) {
    const st = O.state();
    st.names = st.names || {};
    st.names[type] = (st.names[type] || 0) + 1;
    return D.SAT_PREFIX[type] + '-' + st.names[type];
  }

  function launch(m) {
    const S = SIM.S, st = O.state();
    const R = D.ROCKET[m.rocket], T = D.SATS[m.type];
    st.launches++;
    const success = Math.random() < m.ok;
    m.status = success ? 'erfolg' : 'fehlschlag';
    const vars = { n: m.nid, c: m.c };
    const what = m.n > 1 ? m.n + ' ' + T.pl : T.n;
    if (success) {
      for (let i = 0; i < m.n; i++) {
        const life = T.life[0] + Math.random() * (T.life[1] - T.life[0]);
        st.sats.push({ id: 's' + (++st.seq), type: m.type, name: satName(m.type), inc: T.inc[0] + Math.random() * (T.inc[1] - T.inc[0]), phase: Math.random() * Math.PI * 2, raan: Math.random() * 360, period: 30 + Math.random() * 18, born: S.day, until: S.day + Math.round(life * 365), safe: m.safe, mission: m.id });
      }
      const big = m.type === 'modul' || m.n >= 6;
      KY.media.story(null, vars, { h: U.pick([R.n + ' bringt ' + what + ' ins All', 'Erfolgreicher Start in ' + SIM.nName(m.nid) + ': ' + what + ' im Orbit', 'Bilderbuchstart: ' + R.n + ' hebt ab']), tone: 0.35, heat: big ? 26 : 12, about: m.own, key: 'launch_ok' });
      if (m.nid >= 0) SIM.opImpulse(m.nid, [0.4, 0.2, 0, 0.6, 0.1], big ? 1.6 : 0.7, { aware: m.own ? 1.5 : 0.3 });
      SIM.chron('raumfahrt', 'Start geglückt: ' + R.n + ' mit ' + m.n + ' × ' + T.n + '.', null);
      if (m.type === 'modul' && O.stationModules() === 3) {
        KY.media.story(null, {}, { h: 'Die Raumstation Concordia ist bewohnt: Menschen leben dauerhaft im All', tone: 0.7, heat: 60, global: true, about: true, key: 'station' });
        S.nations.forEach((n, id) => SIM.opImpulse(id, [0.5, 0.3, 0.2, 0.7, 0.3], 1.2, { aware: 2 }));
        SIM.chron('raumfahrt', 'Die Raumstation Concordia ist dauerhaft bewohnt.', null);
      }
    } else {
      st.fails++;
      st.debris = Math.min(100, st.debris + 1.5);
      const own = m.own ? S.projects.find(p => p.id === m.site) : null;
      if (own) KY.incidents.create(own, { id: 'fehlstart', sev: [1, 3] });
      else {
        KY.media.story(null, vars, { h: U.pick([R.n + ' explodiert kurz nach dem Start', 'Fehlstart: ' + what + ' verloren', 'Rakete stürzt ins Meer – Ermittler suchen nach der Ursache']), tone: -0.4, heat: 20, about: false, key: 'launch_fail' });
        if (m.nid >= 0) SIM.opImpulse(m.nid, -0.3, 0.6);
      }
      SIM.chron('raumfahrt', 'Fehlstart: ' + R.n + ' mit ' + m.n + ' × ' + T.n + ' ist verloren.', null);
    }
    KY.bus.emit('launch', m);
  }

  O.cleanup = function () {
    const st = O.state();
    const cost = 1.5;
    if (KY.finance.avail() < cost) return { ok: false, err: 'Nicht genügend liquide Mittel.' };
    KY.finance.spend(cost, 'Aufräummission im Orbit');
    st.debris = Math.max(0, st.debris - 30); st.cleanups++;
    KY.media.story(null, {}, { h: 'Weltraum-Müllabfuhr: Mission sammelt Trümmer aus dem Orbit', tone: 0.4, heat: 16, about: true, key: 'cleanup' });
    SIM.chron('raumfahrt', 'Aufräummission: Weltraumschrott deutlich verringert.', null);
    return { ok: true, cost };
  };

  O.daily = function () {
    const S = SIM.S;
    if (!S.orbit) return;
    const st = S.orbit;
    st.missions.forEach(m => { if (m.status === 'geplant' && S.day >= m.launch) launch(m); });
  };

  O.monthly = function () {
    const S = SIM.S;
    if (!S.orbit) return;
    const st = S.orbit;
    // Lebensende
    const dead = st.sats.filter(s => S.day >= s.until);
    if (dead.length) {
      st.sats = st.sats.filter(s => S.day < s.until);
      dead.forEach(s => { if (!s.safe) st.debris = Math.min(100, st.debris + 1.2); });
      SIM.chron('raumfahrt', dead.length + ' Satellit' + (dead.length > 1 ? 'en haben' : ' hat') + ' das Lebensende erreicht' + (dead.some(s => !s.safe) ? '; ausgediente Satelliten bleiben als Schrott im Orbit.' : ' und verglühte kontrolliert.'), null);
    }
    // Kollisionen mit Schrott
    if (st.sats.length && Math.random() < st.debris / 100 * Math.min(1, st.sats.length / 20) * 0.12) {
      const v = U.pick(st.sats);
      st.sats = st.sats.filter(s => s !== v);
      st.debris = Math.min(100, st.debris + 4);
      KY.media.story(null, {}, { h: 'Kollision im Orbit: ' + v.name + ' von Trümmerteil zerstört', tone: -0.3, heat: 20, about: true, key: 'collision' });
      SIM.chron('raumfahrt', 'Kollision: ' + v.name + ' wurde von Weltraumschrott zerstört.', null);
      if (st.debris > 40 && !S.g.debrisMsg) { S.g.debrisMsg = S.day; SIM.msg('brennan', 'Debatte über Weltraumschrott', ['Astronomen und Raumfahrtbehörden kritisieren den wachsenden Trümmergürtel. Eine Aufräummission würde die Debatte beruhigen.'], { kind: 'warn', acts: [{ l: 'Leitstelle öffnen', a: 'panel', p: { id: 'orbit' } }] }); }
    }
    applyEffects();
  };

  /* Wirkungen der Satellitenflotte auf der Erde */
  function setFx(n, key, tag, v) {
    n.fxTags = n.fxTags || {};
    const prev = n.fxTags[tag + key] || 0;
    n.fx[key] = (n.fx[key] || 0) - prev + v;
    n.fxTags[tag + key] = v;
  }
  function applyEffects() {
    const S = SIM.S, g = S.g;
    const w = O.count('wetter'), b = O.count('beob'), v = O.count('navi'), t = O.count('wiss');
    const cov = O.coverage(), mods = O.stationModules();
    g.orbitWarn = w > 0;
    g.orbitMit = Math.min(0.25, w * 0.025 + b * 0.02);
    g.resBoost = 1 + Math.min(0.3, t * 0.1) + (mods >= 3 ? 0.1 : 0);
    S.nations.forEach(n => {
      setFx(n, 'growth', 'orbit', cov * 0.25 * Math.max(0.1, 1 - n.dev));
      setFx(n, 'tech', 'orbit', cov * 0.4 + Math.min(0.3, v * 0.05));
      setFx(n, 'infra', 'orbit', Math.min(3, v * 0.4));
      setFx(n, 'droughtShield', 'orbit', Math.min(0.6, b * 0.1));
    });
    // Wer Internet bekommt, merkt es
    if (cov > (g.covShown || 0) + 0.2) {
      g.covShown = cov;
      S.nations.forEach((n, id) => { if (n.dev < 0.5) SIM.opImpulse(id, [0.4, 0.3, 0.4, 0.7, 0.1], 1.4, { aware: 2 }); });
      KY.media.story(null, {}, { h: 'Internet aus dem All erreicht ' + U.pct(cov * 100, 0) + ' der Weltbevölkerung', tone: 0.5, heat: 24, about: true, global: true, key: 'coverage' });
    }
  }
  O.applyEffects = applyEffects;
})();
