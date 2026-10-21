/* KYTHERA · Kuratorium: Vorlagen, Stimmen, Werben, Anträge */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const K = KY.council = {};
  const VOTE_WINDOW = 120;

  K.members = () => KY.data.council.filter(m => !(m.proxy && KY.S.story.ending === 'frei'));
  K.pyUtil = function (imp) {
    return (imp.stab || 0) * 0.45 + (imp.disk || 0) * 0.45 + (imp.fors || 0) * 0.25 + (imp.wachs || 0) * 0.15 + (imp.soli || 0) * 0.1;
  };
  K.pyRec = function (res) {
    if (res.id === 'PRUEFUNG') return 'NEIN';
    if (res.id === 'FREIGABE') return 'JA';
    const u = K.pyUtil(res.imp);
    return u > 0.04 ? 'JA' : u < -0.04 ? 'NEIN' : 'ENTH';
  };
  K.pyConf = function (res) {
    const u = Math.abs(K.pyUtil(res.imp));
    return Math.round(U.clamp(62 + u * 70, 55, 97));
  };

  K.create = function (tplId, param, proposer) {
    const S = KY.S, D = KY.data;
    const tpl = D.specialResolutions[tplId] || D.resolutions.find(r => r.id === tplId);
    const res = { id: tplId, imp: Object.assign({}, tpl.imp), text: tpl.text, special: !!tpl.special, proposer: proposer || tpl.proposer || U.pick(['AQUILA', 'LYRA', 'CORVUS', 'DRACO', 'CYGNUS', 'ORION', 'VELA']) };
    let p = param;
    if (tpl.param === 'region' && !p) p = U.pick(D.regionOrder);
    if (tpl.param === 'sector' && !p) p = U.pick(['ENE', 'HLB', 'LOG', 'ROH', 'PHA', 'FIN']);
    if (tpl.param === 'topic' && !p) p = U.pick(D.researchTopics);
    res.param = p || null;
    const n = U.ri(3, 8) * 10;
    res.n = n;
    const fill = { region: p && D.regions[p] ? D.regions[p].name : '', sector: p && D.sectors[p] ? D.sectors[p] : '', topic: p || '', n, share: U.n(n / 9, 1) };
    res.title = U.fill(tpl.title, fill);
    res.effect = U.fill(tpl.effect, fill);
    S.council.seq++;
    res.no = 'K-2026-' + S.council.seq;
    res.t0 = S.t; res.until = S.t + VOTE_WINDOW;
    res.noise = {};
    for (const m of D.council) res.noise[m.id] = U.gauss() * 0.1;
    res.lobby = {};
    res.mine = null;
    res.py = K.pyRec(res);
    res.pyConf = K.pyConf(res);
    return res;
  };

  K.memberVote = function (res, m) {
    const S = KY.S;
    if (m.proxy) {
      if (S.story.ending === 'archon' || S.story.ending === 'symbiose') return res.mine || res.py;
      return res.py;
    }
    if (res.lobby[m.id]) return res.lobby[m.id];
    const att = S.council.att[m.id];
    let u = 0;
    for (const k in m.prio) u += m.prio[k] * (res.imp[k] || 0);
    u += res.noise[m.id];
    if (res.proposer === 'IX') {
      u += att / 160;
      if (KY.hasRes('D3')) u += 0.08;
    }
    if (res.id === 'FREIGABE') u += 0.05 + att / 120 + (S.res.ans - 50) / 120 + S.council.freigabeTries * 0.08;
    if (res.id === 'PRUEFUNG' && m.id === 'DRACO') return 'JA';
    if (res.id === 'PRUEFUNG' && m.id === 'CYGNUS' && KY.flag('hydraAudit')) u += 0.3;
    // Gefolgschaft: wer Sitz IX schätzt, folgt einer früh abgegebenen Stimme
    if (res.mine && res.mine !== 'ENTH' && att > 25) u += (res.mine === 'JA' ? 1 : -1) * (att - 25) / 400;
    if (S.story.ending === 'archon') u += res.mine === 'JA' ? 0.12 : res.mine === 'NEIN' ? -0.12 : 0;
    return u > 0.035 ? 'JA' : u < -0.035 ? 'NEIN' : 'ENTH';
  };

  K.tally = function (res) {
    const out = { JA: 0, NEIN: 0, ENTH: 0, votes: {} };
    for (const m of K.members()) {
      const v = K.memberVote(res, m);
      out.votes[m.id] = v; out[v]++;
    }
    const mine = res.mine || 'ENTH';
    out.votes.IX = res.mine || null;
    out[mine]++;
    out.pass = out.JA > out.NEIN;
    return out;
  };

  K.vote = function (v) {
    const S = KY.S, res = S.council.open;
    if (!res || res.closed) return;
    const first = !res.mine;
    res.mine = v;
    KY.log('kur', 'Stimmabgabe ' + res.no + ': ' + (v === 'ENTH' ? 'Enthaltung' : v));
    if (first) S.stats.votes++;
    KY.onb('stimme');
    KY.bus.emit('council');
    if (KY.audio) KY.audio.play('vote');
  };

  K.lobbyCost = function () { return KY.hasRes('D2') ? 9 : 15; };
  K.lobby = function (seat) {
    const S = KY.S, res = S.council.open;
    if (!res || !res.mine || res.mine === 'ENTH') return { ok: false, err: 'Erst eine eigene Stimme (Ja/Nein) abgeben.' };
    const m = KY.data.council.find(x => x.id === seat);
    if (m.proxy) {
      KY.log('kur', 'Kontaktversuch Sitz VIII: kein Ansprechpartner erreichbar.');
      return { ok: false, err: 'Sitz VIII: Kein Ansprechpartner erreichbar. Stimmabgabe erfolgt ausschließlich über den beglaubigten Proxy.' };
    }
    if (res.lobby[seat]) return { ok: false, err: 'Bereits umworben.' };
    const cost = { ein: K.lobbyCost() };
    if (!KY.pay(cost)) return { ok: false, err: 'Nicht genügend Einfluss.' };
    const att = S.council.att[seat];
    const chance = U.clamp(0.48 + att / 180 + (KY.hasRes('D2') ? 0.15 : 0) + (S.story.ending === 'archon' ? 0.2 : 0), 0.1, 0.95);
    const ok = Math.random() < chance;
    if (ok) { res.lobby[seat] = res.mine; KY.seatAdj(seat, 2); }
    else { KY.seatAdj(seat, -3); res.lobby[seat] = null; }
    res.lobbied = res.lobbied || {};
    res.lobbied[seat] = ok;
    KY.log('kur', 'Werben um ' + seat + ' (' + res.no + '): ' + (ok ? 'erfolgreich' : 'abgelehnt'));
    KY.bus.emit('council');
    return { ok: true, success: ok, chance };
  };

  K.canPropose = () => KY.S.user.clr >= 4;
  K.proposalCost = 20;
  K.propose = function (tplId, param) {
    const S = KY.S;
    if (!K.canPropose()) return { ok: false, err: 'Antragsrecht erst ab Freigabestufe 4.' };
    if (S.council.proposalQueue.length >= 2) return { ok: false, err: 'Es liegen bereits zwei eigene Anträge vor.' };
    if (!KY.pay({ ein: K.proposalCost })) return { ok: false, err: 'Nicht genügend Einfluss.' };
    S.council.proposalQueue.push({ tplId, param });
    KY.log('kur', 'Antrag eingereicht: ' + tplId + (param ? ' (' + param + ')' : ''));
    if (!S.council.open) S.timers.council = Math.min(S.timers.council, S.t + 8);
    KY.bus.emit('council');
    return { ok: true };
  };

  K.tick = function () {
    const S = KY.S, T = S.timers;
    const res = S.council.open;
    if (res && !res.closed && S.t >= res.until) K.close(res);
    if (!S.council.open && T.council <= S.t && S.user.sworn) {
      let next;
      if (S.council.special) { next = K.create(S.council.special.id, null, S.council.special.proposer); S.council.special = null; }
      else if (S.council.proposalQueue.length) { const q = S.council.proposalQueue.shift(); next = K.create(q.tplId, q.param, 'IX'); }
      else {
        const pool = KY.data.resolutions.filter(r => r.id !== 'ORBIT' || KY.data.sats.some(s => s.extra && !S.infra.sats.find(x => x.id === s.id)));
        next = K.create(U.pick(pool).id);
      }
      S.council.open = next;
      KY.log('kur', 'Neue Vorlage ' + next.no + ': ' + next.title);
      KY.notify({ cat: 'kur', lvl: 'info', title: 'Vorlage ' + next.no, text: next.title, link: { mod: 'kuratorium' } });
      KY.bus.emit('council');
    }
  };

  K.close = function (res) {
    const S = KY.S, D = KY.data;
    const t = K.tally(res);
    res.closed = true;
    res.result = t;
    res.tClose = S.t;
    S.council.past.unshift(res);
    if (S.council.past.length > 60) S.council.past.length = 60;
    S.council.open = null;
    S.timers.council = S.t + U.ri(55, 85);
    // Folgen für Sitz IX
    if (res.mine && res.mine !== 'ENTH') {
      const won = (res.mine === 'JA') === t.pass;
      KY.adj('ans', won ? 1.5 : -0.5);
      for (const m of D.council) {
        if (m.proxy) continue;
        const v = t.votes[m.id];
        if (v === res.mine) KY.seatAdj(m.id, 1); else if (v !== 'ENTH') KY.seatAdj(m.id, -1);
      }
    }
    if (!res.mine) KY.adj('ans', -0.5);
    if (res.proposer === 'IX') KY.adj('ans', t.pass ? 4 : -3);
    // Versprechen prüfen
    (S.council.promises || []).filter(p => p.no === res.no).forEach(p => {
      const kept = res.mine === p.vote;
      KY.seatAdj(p.seat, kept ? 8 : -15);
      KY.log('kur', 'Zusage an ' + p.seat + (kept ? ' eingehalten' : ' gebrochen'));
    });
    if (t.pass) K.apply(res);
    KY.log('kur', res.no + ' ' + (t.pass ? 'angenommen' : 'abgelehnt') + ' · ' + t.JA + ' Ja, ' + t.NEIN + ' Nein, ' + t.ENTH + ' Enthaltungen');
    KY.notify({ cat: 'kur', lvl: t.pass ? 'ok' : 'info', title: res.no + ' ' + (t.pass ? 'angenommen' : 'abgelehnt'), text: res.title + ' · ' + t.JA + ':' + t.NEIN, link: { mod: 'kuratorium' } });
    if (KY.audio && !KY.silent) KY.audio.play('gavel');
    if (res.id === 'FREIGABE' && !t.pass) S.council.freigabeTries++;
    KY.bus.emit('council'); KY.bus.emit('council-closed', res);
  };

  K.apply = function (res) {
    const S = KY.S, D = KY.data, p = res.param;
    switch (res.id) {
      case 'KRISENFONDS': KY.adj('kap', -res.n / 9); KY.addBuff({ kind: 'krisenfonds', ttl: 600 }); D.regionOrder.forEach(r => KY.regAdj(r, { stab: 0.8 })); break;
      case 'MORATORIUM': S.regions[p].mora = 480; KY.adj('disk', 3); break;
      case 'FORSCHUNG': KY.adj('kap', -3); KY.addBuff({ kind: 'research', ttl: 600, mult: 1.25 }); break;
      case 'DISKRETION': KY.adj('disk', 8); KY.addBuff({ kind: 'diskretion', ttl: 600 }); break;
      case 'PORTFOLIO': KY.market.sectorShock(p, 6); break;
      case 'MANDAT': KY.regAdj(p, { span: -10, stab: 2 }); KY.adj('ein', 10); break;
      case 'EXPANSION': KY.regAdj(p, { praes: 8 }); KY.adj('disk', -3); break;
      case 'BILDUNG': KY.regAdj(p, { vert: 6, stab: 2 }); break;
      case 'ORBIT': {
        KY.adj('kap', -6);
        const extra = D.sats.filter(s => s.extra && !S.infra.sats.find(x => x.id === s.id));
        if (extra.length) { S.infra.sats.push({ id: extra[0].id, focus: null }); KY.log('orb', extra[0].id + ' in Dienst gestellt'); }
        break;
      }
      case 'ENERGIE': KY.regAdj(p, { ener: 7 }); break;
      case 'FREIGABE': KY.story.grantClearance(4); break;
      case 'PRUEFUNG': KY.story.auditPassed(); break;
    }
    KY.bus.emit('res');
  };

  /* Abstimmungsanalyse: Übereinstimmung jedes Sitzes mit PYTHIA */
  K.analysis = function () {
    const S = KY.S;
    const rows = {};
    for (const m of KY.data.council) rows[m.id] = { same: 0, n: 0 };
    rows.IX = { same: 0, n: 0 };
    for (const r of S.council.past) {
      if (!r.result) continue;
      for (const id in rows) {
        const v = r.result.votes[id];
        if (!v) continue;
        rows[id].n++;
        if (v === r.py) rows[id].same++;
      }
    }
    // historische Basis 1988–2026
    const hist = { AQUILA: [612, 748], LYRA: [301, 402], CORVUS: [790, 1011], DRACO: [688, 1012], CYGNUS: [430, 561], ORION: [298, 376], VELA: [377, 498], HYDRA: [1412, 1412] };
    for (const id in hist) { rows[id].same += hist[id][0]; rows[id].n += hist[id][1]; }
    return rows;
  };
})();
