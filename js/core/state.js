/* KYTHERA · Zustand, Speicherung, Protokoll, Benachrichtigungen */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U;
  const SAVE_KEY = 'kythera.sitz9.v3';

  KY.newState = function () {
    const D = KY.data;
    const now = Date.now();
    const S = {
      v: 3,
      meta: { created: now, saved: now, lastSeen: now, sessions: 0, boots: 0 },
      user: {
        codename: null, clr: 3, sworn: false,
        prefs: { sound: true, vol: 0.45, motion: true, accent: 'messing', density: 'normal', scan: true, hints: true },
      },
      res: { kap: 184.6, ein: 120, rech: 260, disk: 86, ans: 46 },
      regions: {},
      lagestufe: 2,
      market: { c: {}, com: {}, idx: { v: 1000, h: [] }, nw: [], fees: 0 },
      projects: { active: [], done: [], seq: 0 },
      research: { done: {}, active: null, queue: [], stations: 0 },
      council: { att: {}, open: null, past: [], seq: 114, hydraAudit: false, freigabeTries: 0, proposalQueue: [], promises: [] },
      people: {},
      infra: { sats: [], ships: [], dcs: [], imgs: [], extraSats: 0 },
      dsp: { list: [], seq: 1300, filters: ['Kythera', 'Sturm'], autoFlag: true },
      archive: { rev: {}, unlocked: {}, read: {}, analysing: null },
      msgs: [],
      news: [],
      log: [],
      notifs: [],
      integ: { nodes: {}, anomalies: [], level: 97 },
      story: { flags: {}, frags: {}, ending: null, shownMsgs: {} },
      pythia: [],
      term: { hist: [] },
      onb: { tasks: {}, done: false, hidden: false },
      crisis: null,
      buffs: [],
      timers: {},
      t: 0,
      stats: { proj: 0, projOk: 0, trades: 0, votes: 0, crises: 0, crisesAuto: 0, profit: 0, decrypted: 0 },
    };
    for (const id of D.regionOrder) {
      const r = D.regions[id];
      const m = Object.assign({}, r.m);
      const h = {};
      for (const k in m) h[k] = Array.from({ length: 40 }, (_, i) => U.clamp(m[k] + Math.sin(i / 5 + id.charCodeAt(0)) * 1.5 + (Math.random() - 0.5) * 2, 0, 100));
      S.regions[id] = { m, base: Object.assign({}, r.m), h, res: 0, mora: 0, warn: null, crisisT: 0 };
    }
    for (const c of D.companies) {
      const hist = [];
      let p = c.p * (1 + (Math.random() - 0.5) * 0.08);
      for (let i = 0; i < 180; i++) { p *= 1 + U.gauss() * c.v * 0.0035 + (c.p - p) / c.p * 0.02; hist.push(+p.toFixed(4)); }
      S.market.c[c.t] = { p: c.p, f: c.p, h: hist, u: c.hold / c.p, cost: c.hold, mu: 0, muT: 0 };
    }
    for (const c of D.commodities) {
      const hist = [];
      let p = c.p;
      for (let i = 0; i < 120; i++) { p *= 1 + U.gauss() * c.v * 0.003 + (c.p - p) / c.p * 0.03; hist.push(+p.toFixed(3)); }
      S.market.com[c.id] = { p: c.p, h: hist };
    }
    for (const m of D.council) S.council.att[m.id] = m.att;
    for (const p of D.people) S.people[p.id] = { trust: p.trust, busy: null, last: -999, brief: 0 };
    for (const s of D.sats) if (!s.extra) S.infra.sats.push({ id: s.id, focus: s.focus });
    for (const s of D.ships) S.infra.ships.push({ id: s.id, task: null });
    for (const d of D.dcs) S.infra.dcs.push({ id: d.id, lvl: d.lvl, oc: false, up: null });
    for (const n of D.nodes) S.integ.nodes[n.id] = { up: true, integ: n.hidden ? 100 : U.ri(96, 100), lat: U.ri(8, 60), iso: 0 };
    S.timers = { event: 40, news: 8, dsp: 25, council: 70, internal: 260, anomaly: 140, msgCheck: 0, cycle: 180 };
    return S;
  };

  KY.save = function () {
    const S = KY.S;
    if (!S || !S.user.sworn) return false;
    S.meta.saved = Date.now();
    S.meta.lastSeen = Date.now();
    return U.store.set(SAVE_KEY, JSON.stringify(S));
  };
  KY.load = function () {
    const raw = U.store.get(SAVE_KEY);
    if (!raw) return null;
    try {
      const S = JSON.parse(raw);
      if (!S || S.v !== 3) return null;
      return S;
    } catch (e) { return null; }
  };
  KY.wipe = function () { U.store.del(SAVE_KEY); };
  KY.exportState = () => JSON.stringify(KY.S);
  KY.importState = function (txt) {
    const S = JSON.parse(txt);
    if (!S || S.v !== 3 || !S.regions) throw new Error('Kein gültiger KYTHERA-Sitzungsstand.');
    U.store.set(SAVE_KEY, JSON.stringify(S));
    return true;
  };

  /* ---------- Protokoll ---------- */
  KY.CATS = {
    sys: 'System', vor: 'Vorhaben', kap: 'Kapital', kur: 'Kuratorium', net: 'Netzwerk', for: 'Forschung',
    orb: 'Flotte & Orbit', dsp: 'Depeschen', arc: 'Archiv', kri: 'Krise', int: 'Integrität', py: 'PYTHIA', welt: 'Weltlage', msg: 'Kommunikation',
  };
  KY.log = function (cat, text, extra) {
    const S = KY.S;
    const e = { ts: Date.now(), t: S.t, cat, text };
    if (extra) e.x = extra;
    S.log.push(e);
    if (S.log.length > 600) S.log.splice(0, S.log.length - 600);
    KY.bus.emit('log', e);
    return e;
  };

  /* ---------- Benachrichtigungen ---------- */
  KY.silent = false;
  KY.notify = function (o) {
    const S = KY.S;
    const n = { id: U.uid('n'), ts: Date.now(), cat: o.cat || 'sys', lvl: o.lvl || 'info', title: o.title, text: o.text || '', link: o.link || null, read: false };
    S.notifs.unshift(n);
    if (S.notifs.length > 80) S.notifs.length = 80;
    if (!KY.silent) {
      KY.bus.emit('notify', n);
      if (KY.audio) KY.audio.play(n.lvl === 'crit' ? 'alert' : n.lvl === 'ok' ? 'ok' : 'note');
    }
    KY.bus.emit('notifs');
    return n;
  };

  /* ---------- Ressourcen ---------- */
  KY.canPay = function (c) {
    const r = KY.S.res;
    return (!c.kap || r.kap >= c.kap - 1e-9) && (!c.ein || r.ein >= c.ein - 1e-9) && (!c.rech || r.rech >= c.rech - 1e-9);
  };
  KY.pay = function (c) {
    if (!KY.canPay(c)) return false;
    const r = KY.S.res;
    if (c.kap) r.kap -= c.kap;
    if (c.ein) r.ein -= c.ein;
    if (c.rech) r.rech -= c.rech;
    KY.bus.emit('res');
    return true;
  };
  KY.missing = function (c) {
    const r = KY.S.res, out = [];
    if (c.kap && r.kap < c.kap) out.push('Kapital');
    if (c.ein && r.ein < c.ein) out.push('Einfluss');
    if (c.rech && r.rech < c.rech) out.push('Rechenkontingent');
    return out;
  };
  KY.costText = function (c) {
    const p = [];
    if (c.kap) p.push(U.money(c.kap));
    if (c.ein) p.push(U.n(c.ein) + ' Einfluss');
    if (c.rech) p.push(U.n(c.rech) + ' EF Rechenzeit');
    return p.length ? p.join(' · ') : 'kostenfrei';
  };
  KY.adj = function (key, d) {
    const r = KY.S.res;
    r[key] += d;
    if (key === 'disk' || key === 'ans') r[key] = U.clamp(r[key], 0, 100);
    if (key === 'ein') r.ein = Math.max(0, r.ein);
    KY.bus.emit('res');
  };
  KY.regAdj = function (rid, fx, mult) {
    const R = KY.S.regions[rid];
    if (!R) return;
    mult = mult === undefined ? 1 : mult;
    for (const k in fx) {
      if (R.m[k] === undefined) continue;
      R.m[k] = U.clamp(R.m[k] + fx[k] * mult, 0, 100);
    }
    KY.bus.emit('regions');
  };
  KY.seatAdj = function (seat, d) {
    const A = KY.S.council.att;
    if (A[seat] === undefined) return;
    A[seat] = U.clamp(A[seat] + d, -100, 100);
    KY.bus.emit('council');
  };
  KY.trustAdj = function (pid, d) {
    const P = KY.S.people[pid];
    if (!P) return;
    P.trust = U.clamp(P.trust + d, 0, 100);
    KY.bus.emit('people');
  };

  /* ---------- Zeitlich begrenzte Effekte ---------- */
  KY.addBuff = function (b) {
    b.until = KY.S.t + (b.ttl || 300);
    b.id = U.uid('b');
    KY.S.buffs.push(b);
    KY.bus.emit('buffs');
    return b;
  };
  KY.buffs = function (kind) { return KY.S.buffs.filter(b => b.kind === kind && b.until > KY.S.t); };
  KY.hasRes = id => !!KY.S.research.done[id];
  KY.flag = function (f, v) {
    if (v === undefined) return KY.S.story.flags[f];
    KY.S.story.flags[f] = v;
    KY.bus.emit('story', f);
    return v;
  };

  /* ---------- Einweisung ---------- */
  KY.ONB = [
    { id: 'atlas', t: 'Lagebild verstehen', d: 'Öffnen Sie den Atlas und wählen Sie eine Region aus.' },
    { id: 'projekt', t: 'Erstes Vorhaben genehmigen', d: 'Planen und genehmigen Sie unter „Vorhaben“ ein Projekt.' },
    { id: 'pythia', t: 'PYTHIA befragen', d: 'Stellen Sie dem Analysesystem eine Frage.' },
    { id: 'handel', t: 'Kapital bewegen', d: 'Kaufen oder verkaufen Sie eine Beteiligung.' },
    { id: 'stimme', t: 'Im Plenum abstimmen', d: 'Geben Sie im Kuratorium Ihre Stimme zu einer Vorlage ab.' },
    { id: 'depesche', t: 'Eine Depesche entschlüsseln', d: 'Entschlüsseln Sie eine interne Meldung.' },
    { id: 'post', t: 'Post des Sekretariats lesen', d: 'Lesen Sie Ihre Nachrichten unter „Kommunikation“.' },
  ];
  KY.onb = function (id) {
    const S = KY.S;
    if (!S || S.onb.tasks[id]) return;
    S.onb.tasks[id] = Date.now();
    KY.bus.emit('onb');
    if (!S.onb.done && KY.ONB.every(t => S.onb.tasks[t.id])) {
      S.onb.done = true;
      KY.adj('ein', 30);
      if (KY.story) KY.story.send('SEK_EINW');
      KY.notify({ cat: 'sys', lvl: 'ok', title: 'Einweisung abgeschlossen', text: '+30 Einfluss', link: { mod: 'komm' } });
    }
  };
})();
