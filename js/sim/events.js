/* KYTHERA · MANDAT · Naturereignisse und Katastrophenhilfe */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const E = (KY.events = {});

  E.active = () => SIM.S.events.filter(e => e.phase !== 'vorbei');
  E.byId = id => SIM.S.events.find(e => e.id === id);
  const SCALE = 0.8;

  /* Gebirgsnähe je Stadt (einmalig) */
  let mtn = null;
  function mountains() {
    if (mtn) return mtn;
    const W = SIM.W;
    mtn = W.cities.map(c => {
      let m = 0;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
        const j = c.j + dj; if (j < 0 || j >= W.GH) continue;
        const k = j * W.GW + ((c.i + di + W.GW) % W.GW);
        m = Math.max(m, W.elev[k]);
      }
      return m;
    });
    return mtn;
  }
  E.reset = function () { mtn = null; };

  function pickCity(f) {
    const W = SIM.W;
    return U.weighted(W.cities, f);
  }
  function pickNation(f) {
    const W = SIM.W;
    return U.weighted(W.nations, f);
  }
  function locate(T) {
    const W = SIM.W, S = SIM.S;
    const M = mountains();
    const temp = c => W.temp[c.cell];
    switch (T.where) {
      case 'fault': return pickCity(c => (M[c.id] > 2200 ? 4 : M[c.id] > 1300 ? 1.6 : M[c.id] > 700 ? 0.4 : 0.03) * Math.sqrt(c.pop + 0.3));
      case 'tropic-coast': return pickCity(c => (c.coastal && Math.abs(c.lat) > 6 && Math.abs(c.lat) < 32 ? 1 : 0) * Math.sqrt(c.pop + 0.2));
      case 'river': return pickCity(c => (c.river ? 1 : 0.05) * Math.sqrt(c.pop + 0.2) * (W.moist[c.cell] + 0.3));
      case 'forest-hot': return pickCity(c => ([5, 10, 8, 4].indexOf(c.biome) >= 0 ? 1 : 0.05) * U.clamp((temp(c) - 4) / 20, 0.05, 1.4) * (1.2 - W.moist[c.cell]));
      case 'ridge': return pickCity(c => (M[c.id] > 2400 ? 1 : 0));
      case 'dry': { const n = pickNation(w => (w.share.desert + w.share.grass * 0.6 + w.share.jungle * 0.1 + 0.05) * (Math.abs(w.lat) < 42 ? 1 : 0.15) * Math.sqrt(w.pop)); return n ? W.cities[n.capital] : null; }
      case 'dense': { const n = pickNation(w => w.pop * (100 - S.nations[w.id].health) / 50); return n ? W.cities[n.capital] : null; }
      case 'hot': { const n = pickNation(w => (Math.abs(w.lat) < 38 ? 1 : 0.05) * Math.sqrt(w.pop)); return n ? W.cities[n.capital] : null; }
      case 'cold': { const n = pickNation(w => (Math.abs(w.lat) > 40 ? 1 : 0) * Math.sqrt(w.pop)); return n ? W.cities[n.capital] : null; }
    }
    return null;
  }

  /* ---------- Neues Ereignis ---------- */
  E.spawn = function (type, opts) {
    const S = SIM.S, W = SIM.W, T = D.EVENTS[type];
    opts = opts || {};
    const city = opts.city !== undefined ? W.cities[opts.city] : locate(T);
    if (!city) return null;
    const nid = city.nation, n = S.nations[nid];
    const sev = opts.sev || 1 + U.weighted([0, 1, 2, 3, 4], i => T.sev[i]);
    let k = 1;
    if (T.devFactor !== false) k *= 1.7 - n.dev * 1.1;
    k *= 1.3 - n.health / 200;
    if (S.g.warn && ['storm', 'fire', 'flood', 'heat', 'drought', 'volcano'].indexOf(type) >= 0) k *= 0.72;
    const tm = { quake: 'quakeMult', storm: 'stormMult', fire: 'stormMult', heat: 'stormMult', epidemic: 'epiMult', drought: 'droughtMult' }[type];
    if (tm) k *= SIM.techFx(tm);
    if (type === 'epidemic') k *= 1 - 0.4 * Math.min(1, (n.fx.epiShield || 0));
    if (type === 'drought') k *= 1 - 0.4 * Math.min(1.5, (n.fx.droughtShield || 0));
    const sc = S.cities[city.id];
    let deich = null;
    if ((type === 'storm' || type === 'flood') && sc.fac.flood) {
      k *= 0.25;
      deich = S.projects.find(p => p.act === 'DEICH' && p.c === city.id && p.phase === 'betrieb');
    }
    if (T.energyFactor) k *= 1.4 - n.energy / 160;
    const dead = Math.round(SIM.rangeRoll(T.dead[sev - 1], 1.25) * k * (opts.k || 1));
    const displaced = Math.round(SIM.rangeRoll(T.displaced[sev - 1], 1.2) * (sc.fac.flood && type === 'storm' ? 0.3 : 1));
    const dur = Math.round(T.dur[0] + Math.random() * (T.dur[1] - T.dur[0]));
    const jitter = T.nationwide ? 0 : 1;
    const ev = {
      id: 'e' + (++S.seq.ev), type, name: T.n + (T.nationwide ? ' in ' + W.nations[nid].short : ' bei ' + city.name), n: nid, c: city.id,
      lon: city.lon + (Math.random() - 0.5) * 2 * jitter, lat: city.lat + (Math.random() - 0.5) * 1.6 * jitter, sev, start: S.day, dur, end: S.day + dur,
      dead, deadNow: 0, displaced, phase: 'akut', helped: {}, saved: 0, radius: T.radius ? T.radius[0] + (T.radius[1] - T.radius[0]) * (sev - 1) / 4 : 0,
      dmg: T.dmg[sev - 1] * (1.4 - n.dev * 0.5), nationwide: !!T.nationwide, relNone: false, breakChecked: false,
      text: U.fill(U.pick(T.text), { city: city.name, nation: W.nations[nid].short, mag: T.mag ? U.n(T.mag[sev - 1] + Math.random() * 0.6, 1) : '', cat: T.cat ? T.cat[sev - 1] : '' }),
    };
    if (T.track) { const a = Math.random() * Math.PI * 2; ev.from = { lon: ev.lon + Math.cos(a) * 9, lat: ev.lat + Math.sin(a) * 4 }; }
    S.events.unshift(ev);
    if (S.events.length > 160) S.events.length = 160;
    // Folgen
    n.gdp *= 1 - ev.dmg / 100;
    SIM.shock(nid, 'happy', -sev * 1.8, 150); SIM.shock(nid, 'unrest', sev * 1.6, 150); SIM.shock(nid, 'infra', -sev * 0.9, 365);
    SIM.shock(nid, 'growth', -ev.dmg * 0.35, 220);
    if (type === 'epidemic') SIM.shock(nid, 'health', -sev * 2.2, ev.dur + 60);
    if (type === 'drought') SIM.shock(nid, 'poverty', sev * 1.6, ev.dur + 200);
    if (!T.nationwide) sc.dmg = U.clamp(sc.dmg + sev * 0.11, 0, 1);
    else SIM.citiesOf(nid).forEach(c => { S.cities[c.id].dmg = U.clamp(S.cities[c.id].dmg + sev * 0.03, 0, 1); });
    n.events++;
    // Medien und Krisenstab
    KY.media.story('disaster', { n: nid, c: city.id, extra: { kind: T.n } }, { tone: -0.5, heat: 12 + sev * sev * 3 + W.nations[nid].pop / 20, ev: ev.id, sub: ev.text });
    SIM.chron('katastrophe', ev.name + ': ' + ev.text, { ev: ev.id });
    if (sev >= 3 || dead > 200) {
      SIM.msg('haddad', T.n + ' · ' + W.nations[nid].short, [ev.text, 'Schätzungen gehen von ' + (dead > 0 ? 'bis zu ' + U.n(dead) + ' Toten' : 'großen Schäden') + (displaced ? ' und ' + U.count(displaced) + ' Obdachlosen' : '') + ' aus. Je früher Hilfe ankommt, desto mehr Menschen können wir retten.'],
        { kind: 'suggest', prio: sev - 1, acts: [{ l: 'Luftbrücke vorbereiten', a: 'act', p: { id: 'LUFTBRUECKE', ev: ev.id } }, { l: 'Zur Karte', a: 'focus', p: { lon: ev.lon, lat: ev.lat } }], ref: { ev: ev.id } });
    }
    // Deich hält oder bricht
    if (deich && sev >= 4 && Math.random() < 0.18 * KY.projects.riskMult(D.ACT.DEICH, deich.o, 'deichbruch', KY.projects.liteCtx(deich))) {
      KY.incidents.create(deich, { id: 'deichbruch', sev: [sev - 2, sev] });
    } else if (deich && sev >= 3) {
      KY.media.story(null, { c: city.id, n: nid }, { h: 'Der neue Deich hält: ' + city.name + ' bleibt verschont', tone: 0.5, heat: 18, about: true, proj: deich.id });
      SIM.opImpulse(nid, D.REACT.DEICH, 2.5, { aware: 4 });
      S.g.lives += dead * 2; deich.acc.lives = (deich.acc.lives || 0) + dead * 2;
    }
    KY.bus.emit('event', ev);
    return ev;
  };

  /* Verlauf: Opfer pro Tag nach Ereignistyp */
  function curve(type, t) {
    if (type === 'quake' || type === 'volcano') return 1 - Math.exp(-t * 2.2);
    if (type === 'storm' || type === 'flood' || type === 'fire' || type === 'heat' || type === 'cold') return 1 - Math.exp(-t * 0.5);
    return U.smooth(Math.min(1, t / 1));
  }

  E.daily = function () {
    const S = SIM.S;
    // Neue Ereignisse
    for (const type in D.EVENTS) {
      const T = D.EVENTS[type];
      if (Math.random() < T.rate / 365 * SCALE) {
        if (S.g.warn && ['storm', 'drought', 'fire', 'heat'].indexOf(type) >= 0 && Math.random() < 0.85) forecast(type);
        else E.spawn(type);
      }
    }
    // Vorhersagen werden Wirklichkeit
    (S.forecasts || []).filter(f => f.day <= S.day).forEach(f => { E.spawn(f.type, { city: f.city, sev: f.sev, k: f.prepared ? 0.75 : 1 }); });
    if (S.forecasts) S.forecasts = S.forecasts.filter(f => f.day > S.day);
    // Weltweite Finanzkrise als seltene Systemkrise
    if (Math.random() < (0.12 + (S.g.crashRisk || 0)) / 365 && (!S.g.lastCrash || S.day - S.g.lastCrash > 900)) KY.nations.globalCrash();
    // Laufende Ereignisse
    for (const ev of S.events) {
      if (ev.phase === 'vorbei') continue;
      const t = (S.day - ev.start) / Math.max(1, ev.dur);
      const want = Math.round(ev.dead * curve(ev.type, t * (ev.type === 'quake' ? 4 : 1.6)));
      if (want > ev.deadNow) {
        const d = want - ev.deadNow;
        ev.deadNow = want;
        const n = S.nations[ev.n];
        n.pop = Math.max(0.01, n.pop - d / 1e6);
        if (ev.deadNow >= 50 && !ev.deathNews) {
          ev.deathNews = true;
          KY.media.story('disaster_deaths', { n: ev.n, extra: { kind: D.EVENTS[ev.type].n, dead: U.n(ev.deadNow) } }, { tone: -0.6, heat: 20 + Math.sqrt(ev.deadNow) * 0.8, ev: ev.id });
        }
      }
      const age = S.day - ev.start;
      if (age === 10 && ev.sev >= 3 && !Object.keys(ev.helped).length && !ev.relNone && Math.random() < 0.6) {
        ev.relNone = true;
        KY.media.story('relief_none', { n: ev.n }, { tone: -0.4, heat: 22, ev: ev.id });
      }
      // Grundsatz „Hilfe bei jeder Katastrophe mit Todesopfern“
      if (!ev.breakChecked && age >= 14) {
        ev.breakChecked = true;
        if (SIM.hasPrinciple('relief') && ev.deadNow >= 25 && ev.sev >= 2 && !Object.keys(ev.helped).length) KY.incidents.principleBreak({ id: 'relief', n: 'Hilfe bei jeder Katastrophe mit Todesopfern' }, null);
      }
      // Epidemien können übergreifen
      if (ev.type === 'epidemic' && age === 30 && !ev.helped.LAZARETT && ev.sev >= 3 && Math.random() < 0.35) {
        const nb = SIM.W.nations[ev.n].neighbors;
        if (nb.length) { const b = U.pick(nb); E.spawn('epidemic', { city: SIM.W.nations[b].capital, sev: ev.sev - 1 }); }
      }
      // Dürre kann zur Missernte führen
      if (ev.type === 'drought' && age === Math.round(ev.dur * 0.7) && ev.sev >= 3 && Math.random() < 0.5 - Math.min(0.4, (S.nations[ev.n].fx.droughtShield || 0) * 0.3)) {
        SIM.shock(ev.n, 'poverty', ev.sev * 2, 300); SIM.shock(ev.n, 'happy', -ev.sev * 1.5, 240);
        KY.media.story('crop_fail', { n: ev.n }, { tone: -0.5, heat: 24, ev: ev.id });
      }
      if (S.day >= ev.end) {
        ev.phase = 'vorbei';
        ev.deadNow = ev.dead;
        SIM.chron('katastrophe', ev.name + ' vorüber: ' + U.n(ev.dead) + ' Tote' + (ev.saved > 0 ? ', durch Ihre Hilfe schätzungsweise ' + U.n(Math.round(ev.saved)) + ' gerettet' : '') + '.', { ev: ev.id });
      }
    }
  };

  function forecast(type) {
    const S = SIM.S, T = D.EVENTS[type];
    const city = locate(T);
    if (!city) return;
    const sev = 1 + U.weighted([0, 1, 2, 3, 4], i => T.sev[i]);
    const lead = 4 + Math.floor(Math.random() * 9);
    S.forecasts = S.forecasts || [];
    const f = { type, city: city.id, sev, day: S.day + lead, made: S.day, prepared: false };
    S.forecasts.push(f);
    if (sev >= 3) SIM.msg('haddad', 'Satellitenwarnung · ' + T.n + ' ' + (T.nationwide ? 'in ' + SIM.nName(city.nation) : 'bei ' + city.name), ['Unser Satellitennetz meldet: Ein Ereignis der Stufe ' + sev + ' trifft voraussichtlich in ' + lead + ' Tagen ein.', 'Die Behörden vor Ort sind gewarnt. Wenn Sie Hilfe vorab bereitstellen, wird sie sofort wirksam.'], { kind: 'suggest', acts: [{ l: 'Hilfe vorab bereitstellen', a: 'prepare', p: { day: f.day, city: f.city } }] });
  }
  E.prepare = function (city, day) {
    const S = SIM.S;
    const f = (S.forecasts || []).find(z => z.city === city && z.day === day);
    if (!f || f.prepared) return false;
    const cost = 0.15 + f.sev * 0.08;
    if (KY.finance.avail() < cost) return false;
    KY.finance.spend(cost, 'Vorsorge vor ' + D.EVENTS[f.type].n);
    f.prepared = true;
    SIM.chron('hilfe', 'Hilfsgüter vorsorglich bereitgestellt (' + D.EVENTS[f.type].n + ' bei ' + SIM.cName(city) + ').', null);
    SIM.opImpulse(SIM.W.cities[city].nation, D.REACT.LUFTBRUECKE, 1.2, { aware: 2 });
    return true;
  };

  /* ---------- Hilfe ---------- */
  E.relief = function (p) {
    const S = SIM.S, A = D.ACT[p.act];
    const ev = E.byId(p.ev);
    if (!ev) return;
    const R = A.relief || {};
    const eff = (SIM.contract('envoy') === 'okonkwo' ? 1.3 : 1) * (ev.phase === 'vorbei' ? 0.2 : 1);
    ev.helped[A.id] = S.day;
    const rem = Math.max(0, ev.dead - ev.deadNow);
    let saved = 0;
    if (R.lives) {
      saved = Math.round(rem * Math.min(0.85, R.lives * eff));
      ev.dead -= saved; ev.saved += saved;
      S.g.lives += saved; S.g.livesRelief += saved;
      p.acc.lives = saved;
    }
    const sc = S.cities[ev.c];
    if (R.damage) {
      sc.dmg = Math.max(0, sc.dmg * (1 - R.damage));
      sc.rebuild = S.day + 365;
      SIM.citiesOf(ev.n).forEach(c => { S.cities[c.id].dmg *= 1 - R.damage * 0.5; });
    }
    if (R.health) SIM.shock(ev.n, 'health', R.health * 2, 200);
    if (R.infra) { const n = S.nations[ev.n]; n.fx.infra = (n.fx.infra || 0) + R.infra; }
    const n = S.nations[ev.n];
    n.access = U.clamp(n.access + 5, 0, 100);
    SIM.opImpulse(ev.n, D.REACT[A.id] || 0.8, 1.6 + ev.sev * 1.1, { aware: 6 });
    sc.sent = U.clamp(sc.sent + 10 + ev.sev * 3, -100, 100);
    SIM.g_trust(1.5);
    const h = A.news && A.news.done && A.news.done.length ? U.pick(A.news.done) : null;
    KY.media.story(h ? null : 'relief_arrive', { n: ev.n, c: ev.c }, { h: h ? U.fill(h, SIM.vars({ n: ev.n, c: ev.c })) : null, tone: 0.6, heat: 14 + ev.sev * 4, about: true, proj: p.id, key: 'relief_arrive', ev: ev.id });
    SIM.chron('hilfe', A.name + ' für „' + ev.name + '“' + (saved ? ': schätzungsweise ' + U.n(saved) + ' Menschen gerettet.' : '.'), { ev: ev.id, proj: p.id });
  };
})();
