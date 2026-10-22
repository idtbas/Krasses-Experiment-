/* KYTHERA · MANDAT · Medien: Meldungen, Sender, soziale Netze, Märkte im Laufband */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const M = (KY.media = {});

  const CAT = k => {
    if (!k) return 'Welt';
    if (/^(disaster|relief|crop)/.test(k)) return 'Katastrophen';
    if (/^(econ|blackout|strike)/.test(k)) return 'Wirtschaft';
    if (/^(election|gov_|scandal|unrest)/.test(k)) return 'Politik';
    if (/^(tension|trade|mediation|summit)/.test(k)) return 'Diplomatie';
    if (/^research/.test(k)) return 'Wissenschaft';
    if (/^poll/.test(k)) return 'Umfragen';
    return 'Welt';
  };
  const DRAMA = /^(incident|disaster|protest|front_exposed|exposure|followup_silence|tension_crisis|econ_crash|blackout|unrest|scandal|gov_fall)/;
  const ECON = /^(econ|blackout|strike|crop|trade|approval|project)/;
  const SOCIALK = /^(protest|relief|project|poll|donor|milestone|incident|unrest)/;

  function fill(tpl, vars) {
    const S = SIM.S;
    let s = U.fill(tpl, vars);
    if (S && S.codename && S.codename !== 'N. N.') s = s.replace(/N\. N\./g, S.codename);
    return s;
  }
  const open = s => /\{\w+\}/.test(s);

  function pickTpl(arr, vars) {
    if (!arr || !arr.length) return null;
    const order = U.shuffle(arr);
    for (const t of order) { const s = fill(t, vars); if (!open(s)) return s; }
    return null;
  }

  function quotes(o, vars, nid) {
    const out = [];
    const cul = nid >= 0 ? SIM.W.nations[nid].culture : 'lat';
    const r = Math.random;
    const who = role => ({ name: KY.names.person(r, cul), role });
    const city = vars.city || vars.nation || 'der Region';
    const Q = D.QUOTES;
    const add = (key, role) => { const t = pickTpl(Q[key], vars); if (t) out.push(Object.assign(who(role), { text: t })); };
    if (o.inc) { add('victim', 'Angehörige eines Opfers'); add(Math.random() < 0.5 ? 'expert_neg' : 'resident_contra', Math.random() < 0.5 ? 'Institut für Anlagensicherheit' : 'lebt in ' + city); }
    else if (o.about && o.tone > 0.15) { add(Math.random() < 0.5 ? 'resident_pro' : 'official_pos', Math.random() < 0.5 ? 'lebt in ' + city : 'Regierung von ' + (vars.nation || 'der Region')); if (o.heat > 20) add('expert_pos', 'Zentrum für Entwicklungsforschung'); }
    else if (o.about && o.tone < -0.15) { add(Math.random() < 0.5 ? 'resident_contra' : 'expert_neg', Math.random() < 0.5 ? 'Bürgerinitiative ' + city : 'Institut für Governance-Studien'); if (o.heat > 20) add('official_neg', 'Opposition in ' + (vars.nation || 'der Region')); }
    return out;
  }

  /* Neue Meldung. key: Vorlagenschlüssel oder null (dann opts.h als Schlagzeile) */
  M.story = function (key, v, opts) {
    const S = SIM.S;
    if (!S) return null;
    opts = opts || {};
    v = v || {};
    const vars = SIM.vars(v);
    vars.codename = S.codename;
    let h = opts.h ? fill(opts.h, vars) : pickTpl(D.NEWS[key], vars);
    if (!h) return null;
    if (open(h)) h = h.replace(/\{\w+\}/g, '…');
    const leadArr = key && D.NEWS_LEADS && D.NEWS_LEADS[key];
    let lead = leadArr ? pickTpl(leadArr, vars) : null;
    if (opts.sub) lead = lead ? opts.sub + ' ' + lead : opts.sub;
    const tone = opts.tone || 0, heat = opts.heat || 10;
    const k = key || opts.key || 'misc';
    // Welche Sender greifen das Thema auf?
    const sc = D.CHANNELS.map(ch => {
      const b = ch.bias;
      let s = heat * (0.6 + (DRAMA.test(k) ? b.sens * 0.9 : 0) + (ECON.test(k) ? b.biz * 0.8 : 0) + (SOCIALK.test(k) ? b.social * 0.5 : 0) +
        (opts.about ? (tone < 0 ? b.crit * 1.1 : 0.2 + (1 - b.crit) * 0.4) : 0));
      s *= 0.7 + Math.random() * 0.6;
      if (opts.ch === ch.id) s += 40;
      return { id: ch.id, s };
    }).sort((a, b) => b.s - a.s);
    const chs = sc.filter((x, i) => i === 0 || x.s > 14).map(x => x.id);
    const a = {
      id: ++S.seq.news, day: S.day, key: k, h, lead, n: v.n !== undefined ? v.n : -1, n2: v.n2 !== undefined ? v.n2 : -1, c: v.c !== undefined ? v.c : -1,
      proj: opts.proj || null, inc: opts.inc || null, ev: opts.ev || null, front: opts.front || null, tone, heat, about: !!opts.about,
      cat: opts.about ? 'Mandat' : CAT(k), chs, ch: chs[0], breaking: !!opts.breaking || heat >= 55, global: !!opts.global,
      quotes: heat >= 12 ? quotes(opts, vars, v.n !== undefined ? v.n : -1) : [], read: false,
    };
    S.news.unshift(a);
    if (S.news.length > 420) S.news.length = 420;
    // Wirkung auf die öffentliche Meinung
    if (a.about) {
      const crit = D.CHANNELS.find(c => c.id === a.ch).bias.crit;
      S.g.mediaNeg = (S.g.mediaNeg || 0) + Math.max(0, -tone) * heat * 0.35;
      const amp = tone < 0 ? 0.8 + crit * 0.6 : 1.1 - crit * 0.4;
      if (a.n >= 0) { SIM.opImpulse(a.n, tone, heat * 0.02 * amp, { aware: heat * 0.04 }); }
      if (a.global || heat >= 40) S.nations.forEach((n, id) => { if (id !== a.n) SIM.opImpulse(id, tone, heat * 0.004 * amp, { aware: heat * 0.012 }); });
    }
    // Soziale Netze reagieren
    if (heat >= 9) {
      const cnt = Math.min(4, 1 + Math.floor(heat / 22));
      for (let i = 0; i < cnt; i++) M.post(socialKind(k, a), { n: a.n, c: a.c, proj: opts.proj, front: opts.front }, heat);
    }
    KY.bus.emit('news', a);
    return a;
  };

  function socialKind(k, a) {
    if (/^incident/.test(k)) return Math.random() < 0.55 ? 'incident' : 'grief';
    if (/^disaster/.test(k)) return Math.random() < 0.6 ? 'grief' : 'neutral';
    if (/^protest/.test(k)) return 'protest';
    if (/^relief/.test(k)) return 'relief';
    if (/^(front_exposed|exposure)/.test(k)) return Math.random() < 0.6 ? 'exposed' : 'speculation';
    if (/^(trace|donor_speculation)/.test(k)) return 'speculation';
    if (a.about && a.tone > 0.15) return Math.random() < 0.85 ? 'pos' : 'joke';
    if (a.about && a.tone < -0.15) return 'neg';
    return Math.random() < 0.8 ? 'neutral' : 'joke';
  }

  /* Ein Beitrag in den sozialen Netzen */
  M.post = function (kind, ctx, heat) {
    const S = SIM.S, W = SIM.W;
    const arr = D.SOCIAL[kind];
    if (!arr) return null;
    ctx = ctx || {};
    let nid = ctx.n !== undefined ? ctx.n : -1, cid = ctx.c !== undefined ? ctx.c : -1;
    if (nid < 0 && cid >= 0) nid = W.cities[cid].nation;
    if (nid < 0) nid = U.weighted(S.nations, n => n.pop * (0.1 + n.aware / 50)).id;
    if (cid < 0) { const cs = SIM.citiesOf(nid); cid = cs.length ? U.pick(cs).id : W.nations[nid].capital; }
    const p = ctx.proj ? KY.projects.byId(ctx.proj) : S.projects.find(z => z.n === nid && KY.projects.ACTIVE[z.phase]);
    const f = ctx.front ? S.fronts.find(z => z.id === ctx.front) : (p ? S.fronts.find(z => z.id === p.front) : S.fronts[0]);
    const vars = { city: W.cities[cid].name, nation: W.nations[nid].short, proj: p ? D.ACT[p.act].name : 'das neue Großprojekt', front: f ? f.name : 'die Stiftung' };
    const text = pickTpl(arr, vars);
    if (!text) return null;
    const i = Math.floor(Math.random() * D.SOCIAL_HANDLES.length);
    const base = Math.pow(10, 1 + Math.random() * 2.2) * (1 + (heat || 5) / 12);
    const tone = { pos: 0.6, relief: 0.7, neg: -0.6, incident: -0.8, grief: -0.4, protest: -0.5, exposed: -0.2, speculation: 0, neutral: 0, joke: 0.1 }[kind] || 0;
    const post = { id: ++S.seq.post, day: S.day, handle: D.SOCIAL_HANDLES[i], name: D.SOCIAL_NAMES[i % D.SOCIAL_NAMES.length], text, kind, tone, n: nid, likes: Math.round(base * (1.5 + Math.random() * 6)), shares: Math.round(base * (0.2 + Math.random())), replies: Math.round(base * 0.3 * Math.random()) };
    S.social.unshift(post);
    if (S.social.length > 300) S.social.length = 300;
    return post;
  };

  /* Trends der letzten zwei Wochen */
  M.trends = function () {
    const S = SIM.S;
    const t = {};
    S.social.filter(p => S.day - p.day <= 14).forEach(p => {
      const tags = p.text.match(/#[\wÄÖÜäöüß-]+/g) || [];
      tags.forEach(x => { t[x] = (t[x] || 0) + p.likes; });
      const key = '#' + SIM.nName(p.n).replace(/\s+/g, '');
      t[key] = (t[key] || 0) + p.likes * 0.4;
    });
    return Object.keys(t).map(k => ({ tag: k, v: t[k] })).sort((a, b) => b.v - a.v).slice(0, 8);
  };

  M.forChannel = function (chId, limit) {
    return SIM.S.news.filter(a => a.chs.indexOf(chId) >= 0).slice(0, limit || 30);
  };

  /* ---------- Märkte für das Laufband ---------- */
  M.initMarkets = function () {
    const S = SIM.S;
    if (S.mkt) return;
    S.mkt = { idx: {}, com: {} };
    D.TICKER.indices.forEach(x => { S.mkt.idx[x.id] = { v: x.base, prev: x.base }; });
    D.TICKER.commodities.forEach((x, i) => { S.mkt.com[i] = { v: x.base, prev: x.base }; });
  };
  M.daily = function () {
    const S = SIM.S;
    M.initMarkets();
    const mk = (S.g.market || 0) / 100 / 365 * 3;
    for (const id in S.mkt.idx) {
      const o = S.mkt.idx[id];
      o.prev = o.v;
      o.v *= 1 + 0.0002 + mk * 0.6 + U.gauss() * 0.009;
    }
    for (const i in S.mkt.com) {
      const o = S.mkt.com[i];
      o.prev = o.v;
      o.v *= 1 + U.gauss() * 0.012 - mk * 0.3;
      o.v = Math.max(D.TICKER.commodities[i].base * 0.3, Math.min(D.TICKER.commodities[i].base * 3, o.v));
    }
    // Hintergrundrauschen der sozialen Netze
    if (Math.random() < 0.32) {
      const aw = SIM.worldAware();
      const kind = aw > 12 && Math.random() < 0.35 ? (Math.random() < 0.6 ? 'speculation' : SIM.worldOp() > 5 ? 'pos' : SIM.worldOp() < -5 ? 'neg' : 'neutral') : Math.random() < 0.75 ? 'neutral' : 'joke';
      M.post(kind, {}, 4);
    }
    // Gelegentliche Einordnungen über den unbekannten Geldgeber
    if (Math.random() < 0.012 && SIM.worldAware() > 18) {
      const op = SIM.worldOp();
      const k = op > 8 ? 'donor_praise' : op < -8 ? 'donor_critic' : 'donor_speculation';
      const nid = U.weighted(S.nations, n => n.aware * n.pop).id;
      M.story(k, { n: nid }, { tone: op > 8 ? 0.4 : op < -8 ? -0.4 : 0, heat: 16, about: true });
    }
  };
})();
