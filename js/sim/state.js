/* KYTHERA · MANDAT · Spielstand: neues Mandat anlegen, speichern, laden */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = (KY.sim = KY.sim || {});

  SIM.VERSION = 2;
  SIM.START_CAPITAL = 1200;
  SIM.STRAT = { kons: { mu: 0.035, sd: 0.05, beta: 0.45 }, bal: { mu: 0.055, sd: 0.1, beta: 0.8 }, off: { mu: 0.075, sd: 0.18, beta: 1.3 } };
  SIM.JUR = { aurelio: { fee: 0.004, trace: 0.72, n: 'Port Aurelio' }, holmvik: { fee: 0.002, trace: 1, n: 'Holmvik' }, lirani: { fee: 0.0005, trace: 1.35, n: 'Lirani-Inseln' } };
  SIM.TRUSTEE = { halvorsen: { fee: 0.001, trace: 1, strict: 1.6 }, castellan: { fee: 0.003, trace: 0.8, strict: 0.8 }, mensah: { fee: 0.0015, trace: 1, strict: 1, dev: 10 } };

  const NAT_KEYS = ['happy', 'unrest', 'stab', 'health', 'edu', 'infra', 'energy', 'clean', 'env', 'tech', 'corrupt', 'press', 'unemp', 'poverty'];
  SIM.NAT_KEYS = NAT_KEYS;

  function leanPick(r, dev) {
    return U.weighted(['left', 'green', 'center', 'right', 'pop'], k => ({ left: 3, green: 1 + dev * 2, center: 3 + dev * 2, right: 3, pop: 1 }[k]), r);
  }
  SIM.leanPick = leanPick;

  function makeGov(r, n, culture, day, lean) {
    lean = lean || leanPick(r, n.dev);
    const L = D.PARTY_LEAN[lean];
    return {
      leader: KY.names.person(r, culture), lean, party: U.pick(D.PARTIES[lean], r),
      approval: U.clamp(42 + U.gauss(r) * 9, 18, 72), openness: U.clamp(50 + L.open + (n.dev - 0.5) * 20 + U.gauss(r) * 8, 5, 95),
      since: day, next: day + Math.round(240 + r() * 1400), term: Math.round(1460 + r() * 365),
    };
  }
  SIM.makeGov = makeGov;

  /* Startwerte eines Staates aus dem Weltgenerator */
  function initNation(wn, r) {
    const dev = wn.dev;
    const urbanW = 0.18 + dev * 0.28, landW = 0.34 - dev * 0.24;
    const milW = [urbanW, 0.24, Math.max(0.06, landW), 0.17 + (1 - dev) * 0.05, 0.16 + dev * 0.1];
    const ws = U.sum(milW);
    const n = {
      id: wn.id, pop: wn.pop, gdpPc: wn.gdpPc, gdp: wn.pop * wn.gdpPc / 1000, dev,
      growth0: U.clamp(1 + (1 - dev) * 3.6 + U.gauss(r) * 0.7, -0.5, 6), growth: 0,
      happy: U.clamp(34 + dev * 38 + U.gauss(r) * 7, 10, 90), unrest: U.clamp(36 - dev * 24 + U.gauss(r) * 8, 4, 80),
      stab: U.clamp(36 + dev * 42 + U.gauss(r) * 8, 10, 95), health: U.clamp(30 + dev * 58 + U.gauss(r) * 4, 15, 97),
      edu: U.clamp(26 + dev * 64 + U.gauss(r) * 5, 10, 98), infra: U.clamp(20 + dev * 62 + U.gauss(r) * 6, 8, 96),
      energy: U.clamp(42 + dev * 42 + U.gauss(r) * 8, 15, 98), clean: U.clamp(8 + r() * 30 + dev * 10, 3, 70),
      env: U.clamp(56 + U.gauss(r) * 10 - dev * 12 + wn.share.forest * 20, 15, 92), tech: U.clamp(1 + dev * 7 + U.gauss(r) * 0.4, 0.5, 9.5),
      corrupt: U.clamp(74 - dev * 60 + U.gauss(r) * 9, 5, 92), press: U.clamp(22 + dev * 66 + U.gauss(r) * 10, 5, 96),
      unemp: U.clamp(4 + (1 - dev) * 13 + U.gauss(r) * 2.4, 2, 34), poverty: U.clamp(Math.pow(1 - dev, 1.6) * 62 + U.gauss(r) * 3, 0.5, 75),
      debt: U.clamp(30 + r() * 70 + (1 - dev) * 20, 10, 160),
      milW: milW.map(w => w / ws), milOp: [0, 0, 0, 0, 0], op: 0, aware: 0,
      access: U.clamp(10 + r() * 14, 0, 100), fx: {}, eq: {}, fear: {}, habit: {}, invest: 0, investHist: [],
      shield: { epi: 0, drought: 0 }, shock: [], crisis: null, hist: { happy: [], gdp: [], op: [], unrest: [], approval: [] },
      lastPoll: null, events: 0, elections: [],
    };
    n.base = {};
    NAT_KEYS.forEach(k => { n.base[k] = n[k]; });
    n.gov = makeGov(r, n, wn.culture, 0);
    if (n.gov.lean === 'pop') n.press = n.base.press = U.clamp(n.press - 14, 5, 96);
    return n;
  }

  function initCity(wc, nat, r) {
    return {
      id: wc.id, pop: wc.pop, prosperity: U.clamp(nat.dev * 70 + 15 + U.gauss(r) * 8 + (wc.capital ? 8 : 0), 5, 98),
      unrest: U.clamp(nat.unrest + U.gauss(r) * 8, 0, 100), sent: 0, fac: {}, dmg: 0, protest: null, fx: {},
    };
  }

  function frontName(r, kind, used) {
    const K = D.FRONT_KINDS.find(k => k.id === kind);
    for (let t = 0; t < 30; t++) {
      const root = U.pick(D.FRONT_ROOTS, r);
      const suf = U.pick(K.suf, r);
      const name = kind === 'kanzlei' ? root + ' ' + suf : root + ' ' + suf;
      if (!used.has(name)) { used.add(name); return name; }
    }
    return 'Struktur ' + Math.floor(r() * 900 + 100);
  }
  SIM.frontName = frontName;
  SIM.makeFront = function (S, kind, seat, name) {
    const used = new Set(S.fronts.map(f => f.name));
    const r = Math.random;
    const f = {
      id: 'f' + (++S.seq.front), name: name || frontName(r, kind, used), kind, seat: seat || U.pick(D.SEATS, r),
      trace: 0, heat: 0, exposed: false, projects: [], created: S.day, inv: null, spent: 0,
      hue: Math.floor(r() * 360),
    };
    S.fronts.push(f);
    return f;
  };

  /* Neues Mandat aus Welt + Vertragswerten */
  SIM.newGame = function (world, vals, opts) {
    opts = opts || {};
    const r = U.rng(world.seed ^ 0x5bd1e995);
    const S = {
      v: SIM.VERSION, seed: world.seed, created: Date.now(), realSaved: 0,
      codename: (vals.codename || 'N. N.').trim() || 'N. N.',
      contracts: { vals: Object.assign({}, vals), signedAt: opts.signedAt || Date.now(), sig: opts.sig || null, initials: opts.initials || {} },
      day: 0, speed: 1, paused: true,
      seq: { proj: 0, inc: 0, ev: 0, news: 0, post: 0, msg: 0, chron: 0, front: 0 },
      nations: [], cities: [], rel: {},
      projects: [], fronts: [], incidents: [], events: [], news: [], social: [], inbox: [], chron: [], polls: [],
      res: { done: {}, active: [] },
      fin: { cash: 0, fund: 0, idx: 100, hist: [], frozen: 0, frozenUntil: -1, y: { ret: 0, inc: 0, spent: 0, fees: 0, comp: 0 }, ly: null, peak: 0, commit: 0 },
      g: {
        pressure: 6, trust: 70, exposure: 0, exposed: false, face: null, chainUntil: -1, warn: 0, fear: {}, techFx: {},
        lives: 0, livesRelief: 0, deaths: 0, injured: 0, displaced: 0, jobs: 0, co2: 0, power: 0, homes: 0, trees: 0, students: 0, patients: 0, fed: 0, water: 0, sea: 0,
        spent: 0, versaeumt: 0, breaks: [], hearings: [], lastHearing: -9999, auflagen: null, highSince: -1, ky: 0,
        mood: 0, pressHist: [], milestones: {},
      },
      ui: { layer: 'pol', view: null, tvChannel: 'krf', autoPause: true, sound: true, vol: 0.5, seenHelp: false },
      year: { start: 0, n: 1 },
    };
    // Staaten und Städte
    world.nations.forEach(wn => S.nations.push(initNation(wn, r)));
    world.cities.forEach(wc => S.cities.push(initCity(wc, S.nations[wc.nation], r)));
    // Beziehungen
    const N = world.nations.length;
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
      const A = world.nations[a], B = world.nations[b];
      const nb = A.neighbors.includes(b);
      let v = nb ? U.gauss(r) * 30 - 2 : U.gauss(r) * 16 + 12;
      if (A.culture === B.culture) v += 14;
      S.rel[a + ':' + b] = { v: U.clamp(v, -88, 92), base: U.clamp(v, -60, 80), state: 'normal', since: 0, trade: false };
    }
    // Mindestens zwei angespannte Nachbarschaften
    const pairs = Object.keys(S.rel).filter(k => { const [a, b] = k.split(':').map(Number); return world.nations[a].neighbors.includes(b); });
    U.shuffle(pairs, r).slice(0, 2).forEach(k => { S.rel[k].v = -56 - r() * 14; S.rel[k].base = -40; });
    Object.keys(S.rel).forEach(k => { const R = S.rel[k]; R.state = R.v < -80 ? 'eiszeit' : R.v < -60 ? 'krise' : R.v < -40 ? 'angespannt' : 'normal'; });
    // Finanzen
    const fundPct = +(vals.fund || 0) / 100;
    S.fin.fund = SIM.START_CAPITAL * fundPct;
    S.fin.cash = SIM.START_CAPITAL - S.fin.fund;
    S.fin.peak = SIM.START_CAPITAL;
    // Drei Tarnstrukturen zum Start
    [['stiftung'], ['holding'], ['fonds']].forEach(([k]) => SIM.makeFront(S, k));
    S.fronts.forEach(f => { f.trace = 2 + Math.random() * 4; });
    // Erste Ansicht: größter Kontinent
    S.ui.view = null;
    return S;
  };

  /* ---------- Speichern / Laden ---------- */
  const KEY = 'kythera.mandat.slot.';
  SIM.slots = ['auto', '1', '2', '3'];
  SIM.save = function (S, slot) {
    S.realSaved = Date.now();
    const data = JSON.stringify(S);
    const ok = U.store.set(KEY + slot, data);
    if (ok) U.store.set(KEY + slot + '.meta', JSON.stringify({ codename: S.codename, day: S.day, seed: S.seed, saved: S.realSaved, cash: S.fin.cash, projects: S.projects.length, exposed: S.g.exposed, size: data.length }));
    return ok;
  };
  SIM.meta = function (slot) {
    try { return JSON.parse(U.store.get(KEY + slot + '.meta') || 'null'); } catch (e) { return null; }
  };
  SIM.load = function (slot) {
    try {
      const S = JSON.parse(U.store.get(KEY + slot) || 'null');
      if (!S || S.v !== SIM.VERSION) return null;
      return S;
    } catch (e) { return null; }
  };
  SIM.del = function (slot) { U.store.del(KEY + slot); U.store.del(KEY + slot + '.meta'); };
  SIM.exportSave = S => btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  SIM.importSave = function (txt) {
    try { const S = JSON.parse(decodeURIComponent(escape(atob(txt.trim())))); return S && S.v === SIM.VERSION ? S : null; } catch (e) { return null; }
  };
})();
