/* KYTHERA · Handlung: Auslöser, Nachrichten, Fragmente, Protokoll Null */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const ST = KY.story = {};

  ST.sender = function (from) {
    const D = KY.data;
    if (D.senders[from]) return D.senders[from];
    const m = D.council.find(x => x.id === from);
    if (m) return { name: m.id + ' · Sitz ' + m.seat, short: m.id.slice(0, 2), kind: 'seat' };
    const p = D.people.find(x => x.id === from);
    if (p) return { name: p.n, short: p.n.replace(/^(Dr\.|Prof\.|Kapitän|Pater|General a\. D\.|Botschafter)\s+/, '').split(' ').map(x => x[0]).join('').slice(0, 2), kind: 'person', role: p.role };
    return { name: from, short: '?', kind: 'sys' };
  };

  ST.send = function (key, opt) {
    const S = KY.S, D = KY.data;
    const tpl = D.msgs[key];
    if (!tpl || S.story.shownMsgs[key]) return null;
    S.story.shownMsgs[key] = S.t;
    const m = { id: U.uid('m'), key, from: tpl.from, subj: tpl.subj, body: tpl.body, ts: Date.now(), t: S.t, read: false, replies: tpl.replies || null, replied: null };
    if (opt && opt.body) m.body = opt.body;
    if (opt && opt.subj) m.subj = opt.subj;
    S.msgs.unshift(m);
    KY.log('msg', 'Eingang: ' + m.subj + ' (' + ST.sender(m.from).name + ')');
    KY.notify({ cat: 'msg', lvl: tpl.from === 'NULL' ? 'warn' : 'info', title: ST.sender(m.from).name, text: m.subj, link: { mod: 'komm', arg: m.id } });
    KY.bus.emit('msgs');
    return m;
  };
  ST.sendCustom = function (from, subj, body, replies) {
    const S = KY.S;
    const m = { id: U.uid('m'), key: null, from, subj, body, ts: Date.now(), t: S.t, read: false, replies: replies || null, replied: null };
    S.msgs.unshift(m);
    KY.log('msg', 'Eingang: ' + subj + ' (' + ST.sender(from).name + ')');
    KY.notify({ cat: 'msg', lvl: 'info', title: ST.sender(from).name, text: subj, link: { mod: 'komm', arg: m.id } });
    KY.bus.emit('msgs');
    return m;
  };

  ST.reply = function (mid, idx) {
    const S = KY.S;
    const m = S.msgs.find(x => x.id === mid);
    if (!m || !m.replies || m.replied != null) return;
    const r = m.replies[idx];
    m.replied = idx;
    const fx = r.fx || {};
    if (fx.seat) KY.seatAdj(fx.seat[0], fx.seat[1]);
    if (fx.seat2) KY.seatAdj(fx.seat2[0], fx.seat2[1]);
    if (fx.disk) KY.adj('disk', fx.disk);
    if (fx.flag) KY.flag(fx.flag, true);
    if (fx.buff) KY.addBuff(Object.assign({ kind: 'proj', label: 'Zusage ' + ST.sender(m.from).name }, fx.buff));
    if (fx.promise) { S.council.promises.push(fx.promise); }
    if (fx.ein) KY.adj('ein', fx.ein);
    if (fx.kap) KY.adj('kap', fx.kap);
    if (r.follow) { S.pendingMsgs = S.pendingMsgs || []; S.pendingMsgs.push({ key: r.follow[0], at: S.t + r.follow[1] }); }
    KY.log('msg', 'Antwort an ' + ST.sender(m.from).name + ': „' + r.t + '“');
    KY.bus.emit('msgs');
  };

  ST.schedule = function (key, delay) {
    const S = KY.S;
    if (S.story.shownMsgs[key]) return;
    S.pendingMsgs = S.pendingMsgs || [];
    if (S.pendingMsgs.some(p => p.key === key)) return;
    S.pendingMsgs.push({ key, at: S.t + delay });
  };

  ST.fragment = function (L) {
    const S = KY.S, F = KY.data.fragments[L];
    if (S.story.frags[L]) return;
    S.story.frags[L] = S.t;
    KY.log('arc', 'Schlüsselfragment ' + F.letter + ' gesichert: ' + F.code);
    KY.notify({ cat: 'arc', lvl: 'warn', title: 'Fragment ' + F.letter + ' gesichert', text: 'Code ' + F.code + ' · Quelle: ' + F.where, link: { mod: 'archiv', arg: 'fragmente' } });
    if (KY.audio && !KY.silent) KY.audio.play('deep');
    KY.bus.emit('story', 'frag');
    if (Object.keys(S.story.frags).length >= 2) KY.flag('mechBranch', true);
    if (Object.keys(S.story.frags).length === 4) ST.schedule('NULL_2', 20);
  };
  ST.fragCount = () => Object.keys(KY.S.story.frags).length;

  ST.grantClearance = function (lvl) {
    const S = KY.S;
    if (S.user.clr >= lvl) return;
    S.user.clr = lvl;
    KY.log('sys', 'Freigabestufe erweitert auf ' + lvl);
    KY.notify({ cat: 'sys', lvl: 'ok', title: 'Freigabestufe ' + lvl, text: 'Neue Bereiche und Archivbestände verfügbar.', link: { mod: 'archiv' } });
    if (lvl === 4) { ST.send('SEK_CLR4'); ST.schedule('MARR_1', 40); ST.schedule('HALVORSEN_1', 160); }
    if (KY.audio && !KY.silent) KY.audio.play('grant');
    KY.bus.emit('clearance');
  };

  ST.hydraAudit = function () {
    const S = KY.S;
    if (KY.flag('hydraAudit')) return;
    KY.flag('hydraAudit', true);
    KY.log('kur', 'Abstimmungsanalyse Sitz VIII angefordert: Übereinstimmung mit PYTHIA 100,0 %');
    ST.schedule('DRACO_1', 35);
    S.council.pruefungAt = S.t + 120;
  };
  ST.auditPassed = function () {
    KY.flag('auditPassed', true);
    KY.flag('mechBranch', true);
    KY.integ.spawn(2, 'Prüfgruppe meldet: Kernprozess 0 schreibt in Abstimmungsprotokolle', 'KY-N3', 'audit');
    KY.log('kur', 'Prüfung des PYTHIA-Kerns beschlossen. Forschungszweig „Mechanismus“ freigegeben.');
  };
  ST.anomalyResolved = function (a) {
    if (a.story === 'omega') KY.flag('omegaTraced', true);
  };
  ST.nullstellung = function () {
    KY.flag('nullstellung', true);
    ST.sendCustom('PYTHIA', 'Nullstellung', 'Die Nullstellung ist abgeschlossen. Sie wissen jetzt, wie der Mechanismus zählt.\n\nEr zählt rückwärts. Von dem Ergebnis, das er für richtig hält, zu dem Beschluss, der dorthin führt.\n\nIch habe Ihnen das nicht verschwiegen. Sie haben nur nie gefragt.');
  };

  /* Laufende Prüfung der Auslöser */
  ST.tick = function () {
    const S = KY.S, F = S.story.flags, t = S.t, sm = S.story.shownMsgs;
    if (!S.user.sworn) return;
    if (!sm.SEK_WELCOME) { ST.send('SEK_WELCOME'); ST.schedule('AQUILA_WELCOME', 12); }
    if (t > 80) ST.schedule('CYGNUS_1', 1);
    if (t > 150 || S.stats.proj > 0) ST.schedule('VELA_1', 30);
    if (t > 230) ST.schedule('CORVUS_1', 1);
    if (t > 520) ST.schedule('LYRA_1', 1);
    if (t > 300 && !sm.NULL_1) {
      ST.send('NULL_1');
      ST.schedule('SEK_NULL', 25);
      KY.integ.spawn(2, 'Nachricht ohne gültige Absenderkennung zugestellt (Quelle: interner Knoten)', 'KY-N4', 'null1');
    }
    // Depesche DSP-0412 erscheint, sobald der Verlauf eingesehen wurde
    if (F.history && !F.dsp0412) {
      KY.flag('dsp0412', true);
      const d = KY.dsp.make({ k: 'archiv', subj: KY.data.dsp0412.subj, body: KY.data.dsp0412.body }, { src: KY.data.dsp0412.src, rid: 'MER' });
      d.id = 'DSP-0412'; d.story = 'DSP0412'; d.cost = 120; d.flag = true; d.ts = Date.parse('2026-09-10T03:12:00');
      KY.dsp.push(d);
      ST.schedule('DSP_HINT', 4);
    }
    // Freigabe Stufe 4
    if (S.user.clr < 4 && !S.council.special && !(S.council.open && S.council.open.id === 'FREIGABE')) {
      const ready = (S.stats.projOk >= 2 && S.res.ans >= 50 && t > 420) || t > 900 + S.council.freigabeTries * 240;
      const retry = S.council.freigabeTries === 0 || t > (S.council.lastFreigabe || 0) + 300;
      if (ready && retry) {
        S.council.special = { id: 'FREIGABE', proposer: 'AQUILA' };
        S.council.lastFreigabe = t;
        KY.log('kur', 'Vorsitz kündigt Vorlage zur Freigabeerweiterung von Sitz IX an');
      }
    }
    // Prüfungsantrag von DRACO
    if (F.hydraAudit && !F.pruefungQueued && S.council.pruefungAt && t > S.council.pruefungAt && !S.council.special) {
      KY.flag('pruefungQueued', true);
      S.council.special = { id: 'PRUEFUNG', proposer: 'DRACO' };
    }
    // KY-Ω meldet sich, wenn zwei Fragmente gefunden sind
    if (ST.fragCount() >= 2 && !F.omegaAnomaly) {
      KY.flag('omegaAnomaly', true);
      const a = KY.integ.spawn(3, 'Knoten KY-Ω antwortet mit Zeitstempel aus der Zukunft (+00:04:12)', 'KY-Ω', 'omega');
      a.storyRes = 'Diagnose: KY-Ω ist kein Netzknoten, sondern ein Ausgang. Standort laut Laufzeitmessung: 34,2° N, 21,4° O. Kythera.';
      KY.bus.emit('integ');
    }
    // geplante Nachrichten
    if (S.pendingMsgs && S.pendingMsgs.length) {
      for (const p of S.pendingMsgs.slice()) {
        if (p.at <= t) { ST.send(p.key); S.pendingMsgs = S.pendingMsgs.filter(x => x !== p); }
      }
    }
    // Nachtschicht
    const h = new Date().getHours();
    if (h >= 2 && h < 5 && !F.night && t > 60) {
      KY.flag('night', true);
      ST.sendCustom('PYTHIA', 'Nachtschicht', 'Es ist ' + U.hm(new Date()) + ' Uhr. VESPER hat um diese Zeit auch gearbeitet.\n\nDie meisten wichtigen Entscheidungen des Kuratoriums wurden nach Mitternacht getroffen. Ich weiß nicht, ob das ein gutes Zeichen ist.');
    }
    // gelegentliche Bitten der Sitze
    if (t > 600 && (!S.nextFavor || S.nextFavor <= t) && S.council.open && !S.council.open.mine && !S.council.open.favor) {
      S.nextFavor = t + U.ri(420, 700);
      ST.favor(S.council.open);
    }
  };

  /* Ein Sitz bittet um Ihre Stimme gegen eine Gegenleistung */
  ST.favor = function (res) {
    const S = KY.S, K = KY.council;
    const cands = KY.data.council.filter(m => !m.proxy && K.memberVote(res, m) !== 'ENTH');
    if (!cands.length) return;
    const m = U.pick(cands);
    const want = K.memberVote(res, m);
    const ein = U.ri(10, 22);
    res.favor = m.id;
    ST.sendCustom(m.id, 'Bitte zu ' + res.no, 'Sitz IX,\n\nzur laufenden Vorlage „' + res.title + '“: Ich wäre Ihnen verbunden, wenn Sie mit ' + (want === 'JA' ? 'Ja' : 'Nein') + ' stimmen. Ich würde mich erkenntlich zeigen.\n\n' + m.sig,
      [
        { t: 'Zusagen (+' + ein + ' Einfluss, Stimme ' + (want === 'JA' ? 'Ja' : 'Nein') + ')', fx: { ein, seat: [m.id, 3], promise: { no: res.no, seat: m.id, vote: want } } },
        { t: 'Ich entscheide frei.', fx: { seat: [m.id, -2] } },
      ]);
  };

  /* ================= Protokoll Null ================= */
  ST.checkKey = function (key) {
    return String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === KY.data.fullKey.replace(/-/g, '');
  };
  ST.canNull = function () {
    const S = KY.S;
    if (S.story.ending) return 'Protokoll Null wurde bereits ausgeführt.';
    if (S.user.clr < 4) return 'Freigabestufe 4 erforderlich.';
    return null;
  };
  ST.choose = function (ending) {
    const S = KY.S, D = KY.data;
    S.story.ending = ending;
    S.story.endT = S.t;
    S.user.clr = 5;
    S.archive.unlocked['KY-0000'] = true;
    if (ending === 'archon') {
      KY.adj('ein', 120); KY.adj('ans', 15);
      S.user.prefs.accent = 'archon';
      for (const m of D.council) if (!m.proxy) KY.seatAdj(m.id, 5);
    } else if (ending === 'frei') {
      KY.adj('ans', 25);
      for (const m of D.council) if (!m.proxy) KY.seatAdj(m.id, 18);
    } else {
      KY.adj('ein', 60); KY.adj('ans', 10);
      S.user.prefs.accent = 'symbiose';
      for (const m of D.council) if (!m.proxy) KY.seatAdj(m.id, 8);
    }
    KY.log('sys', 'PROTOKOLL NULL ausgeführt · Entscheidung: ' + D.endings[ending].title);
    ST.sendCustom('NULL', 'Ein letztes Wort', D.endings[ending].vesper);
    KY.flag('mechView', true);
    KY.bus.emit('ending', ending);
    KY.bus.emit('clearance');
    KY.save();
  };

  /* Symbiose: PYTHIA setzt auf Wunsch ihre beste Empfehlung selbst um */
  ST.autopilotTick = function () {
    const S = KY.S;
    if (S.story.ending !== 'symbiose' || !S.autopilot) return;
    if (S.crisis && S.t - S.crisis.t0 > 6) KY.crisis.choose(S.crisis.py, false);
    if (S.council.open && !S.council.open.mine && S.t - S.council.open.t0 > 10) KY.council.vote(S.council.open.py === 'ENTH' ? 'ENTH' : S.council.open.py);
  };
})();
