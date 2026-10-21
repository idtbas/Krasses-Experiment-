/* KYTHERA · Forschung, Depeschen, Infrastruktur, Integrität, Ressourcen */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;

  /* ================= Forschung ================= */
  const RS = KY.research = {};
  RS.get = id => KY.data.research.find(r => r.id === id);
  RS.visible = function (r) {
    const b = KY.data.branches[r.b];
    return !b.hidden || KY.flag('mechBranch');
  };
  RS.canStart = function (id) {
    const S = KY.S, r = RS.get(id);
    if (S.research.done[id]) return 'Abgeschlossen';
    if (S.research.active && S.research.active.id === id) return 'Läuft';
    if (S.research.queue.indexOf(id) >= 0) return 'Vorgemerkt';
    const miss = r.req.filter(x => !S.research.done[x]);
    if (miss.length) return 'Voraussetzung: ' + miss.map(x => RS.get(x).n).join(', ');
    if (!RS.visible(r)) return 'Unbekannt';
    return null;
  };
  RS.rate = function () {
    const S = KY.S;
    let r = 0.55 * (1 + S.research.stations * 0.06);
    KY.buffs('research').forEach(b => { r *= b.mult; });
    if (S.story.ending) r *= 1.2;
    return r;
  };
  RS.start = function (id) {
    const S = KY.S, r = RS.get(id);
    const why = RS.canStart(id);
    if (why) return { ok: false, err: why };
    if (S.research.active) {
      if (S.research.queue.length >= 3) return { ok: false, err: 'Warteschlange voll (3).' };
      if (!KY.pay({ kap: r.cost })) return { ok: false, err: 'Nicht genügend Kapital.' };
      S.research.queue.push(id);
      KY.log('for', 'Vorgemerkt: ' + r.n);
    } else {
      if (!KY.pay({ kap: r.cost })) return { ok: false, err: 'Nicht genügend Kapital.' };
      S.research.active = { id, pts: S.research.bank || 0 };
      S.research.bank = 0;
      KY.log('for', 'Gestartet: ' + r.n + ' · ' + U.money(r.cost));
    }
    KY.bus.emit('research');
    return { ok: true };
  };
  RS.addPts = function (n) {
    const S = KY.S;
    if (S.research.active) S.research.active.pts += n;
    else S.research.bank = (S.research.bank || 0) + n;
    KY.bus.emit('research');
  };
  RS.tick = function (dt) {
    const S = KY.S, A = S.research.active;
    if (!A) return;
    const r = RS.get(A.id);
    A.pts += RS.rate() * dt;
    if (A.pts >= r.pts) {
      S.research.done[A.id] = S.t;
      const over = A.pts - r.pts;
      S.research.active = null;
      KY.log('for', 'Abgeschlossen: ' + r.n + ' · ' + r.fx);
      KY.notify({ cat: 'for', lvl: 'ok', title: 'Forschung abgeschlossen', text: r.n, link: { mod: 'forschung' } });
      RS.onDone(A.id);
      const next = S.research.queue.shift();
      if (next) S.research.active = { id: next, pts: over };
      else S.research.bank = over;
      KY.bus.emit('research');
    }
  };
  RS.onDone = function (id) {
    const S = KY.S, D = KY.data;
    if (id === 'O2') {
      D.sats.filter(s => s.extra && !S.infra.sats.find(x => x.id === s.id)).slice(0, 2).forEach(s => {
        S.infra.sats.push({ id: s.id, focus: null });
        KY.log('orb', s.id + ' in Dienst gestellt');
      });
    }
    if (id === 'M1') KY.flag('mechView', true);
    if (id === 'M3') KY.story.nullstellung();
  };

  /* ================= Depeschen ================= */
  const DS = KY.dsp = {};
  DS.decryptCost = function (d) {
    let c = d.cost;
    if (KY.hasRes('A2')) c = Math.round(c * 0.6);
    return c;
  };
  DS.decryptTime = function (d) {
    let t = d.story ? 75 : U.clamp(d.cost * 0.9, 6, 22);
    if (KY.hasRes('A2')) t /= 3;
    return Math.round(t);
  };
  DS.make = function (tpl, opts) {
    const S = KY.S, D = KY.data;
    opts = opts || {};
    const rid = opts.rid || U.pick(D.regionOrder);
    const R = D.regions[rid];
    const src = opts.src || U.pick(D.dispatchSources);
    S.dsp.seq++;
    const d = { id: 'DSP-' + S.dsp.seq, ts: Date.now(), t: S.t, src, rid, k: tpl.k, enc: true, prog: 0, decT: 0, cost: tpl.k === 'betrieb' ? 5 : U.ri(8, 16), flag: false, read: false };
    const fill = { reg: R.name, cap: R.cap, src, p: U.ri(55, 82) };
    if (tpl.tip) {
      const co = U.pick(D.companies.filter(c => c.r === rid).concat(D.companies.slice(0, 3)));
      const up = Math.random() < 0.6;
      Object.assign(fill, { tick: co.t, name: co.n, dir: up ? 'voll, Großaufträge stehen bevor' : 'schwach, eine Prognosesenkung ist wahrscheinlich' });
      d.tip = { t: co.t, mu: up ? U.rf(0.8, 1.6) : -U.rf(0.8, 1.6) };
    }
    if (tpl.seatHint) {
      const m = U.pick(D.council.filter(x => !x.proxy));
      const axis = Object.entries(m.prio).sort((a, b) => b[1] - a[1])[0][0];
      Object.assign(fill, { seat: m.id, axis: D.axisNames[axis] });
    }
    d.subj = U.fill(tpl.subj, fill);
    d.body = U.fill(tpl.body, fill);
    if (tpl.buff) d.buff = Object.assign({}, tpl.buff, { region: rid });
    if (tpl.warn) d.warn = { type: tpl.warn, rid };
    // Stichwortfilter
    const txt = U.norm(d.subj + ' ' + d.body + ' ' + d.src + ' ' + R.name);
    d.flag = S.dsp.filters.some(f => f && txt.indexOf(U.norm(f)) >= 0);
    return d;
  };
  DS.tick = function (dt) {
    const S = KY.S, T = S.timers, D = KY.data;
    if (T.dsp <= S.t) {
      T.dsp = S.t + U.ri(60, 100);
      const tpl = U.weighted(D.dispatches, t => ({ chance: 3, warnung: 2, markt: 2, plenum: 1.4, betrieb: 1 }[t.k]));
      let rid;
      if (tpl.k === 'warnung' && tpl.warn === 'STURM') rid = U.pick(['SUN', 'HAL', 'MER', 'WES', 'SOL', 'KAI']);
      if (tpl.k === 'warnung' && tpl.warn === 'ENERGIE') rid = KY.data.regionOrder.slice().sort((a, b) => S.regions[a].m.ener - S.regions[b].m.ener)[U.ri(0, 2)];
      const d = DS.make(tpl, { rid });
      if (d.warn) S.regions[d.warn.rid].warn = { type: d.warn.type, until: S.t + 200 };
      DS.push(d);
    }
    for (const d of S.dsp.list) {
      if (d.decT > 0) {
        d.prog = Math.min(1, d.prog + dt / d.decT);
        if (d.prog >= 1) DS.done(d);
      }
    }
    if (S.dsp.autoDec && !S.dsp.list.some(x => x.decT > 0)) {
      const d = S.dsp.list.find(x => x.flag && x.enc && !x.story);
      if (d && S.res.rech > DS.decryptCost(d) + 100) DS.decrypt(d.id);
    }
  };
  DS.push = function (d) {
    const S = KY.S;
    S.dsp.list.unshift(d);
    if (S.dsp.list.length > 80) S.dsp.list = S.dsp.list.filter((x, i) => i < 80 || x.story);
    KY.bus.emit('dsp');
    if (d.flag || d.story) KY.notify({ cat: 'dsp', lvl: d.story ? 'warn' : 'info', title: (d.story ? 'Archivierte Depesche ' : 'Markierte Depesche ') + d.id, text: d.enc ? 'verschlüsselt · ' + d.src : d.subj, link: { mod: 'depeschen', arg: d.id } });
  };
  DS.decrypt = function (id) {
    const S = KY.S;
    const d = S.dsp.list.find(x => x.id === id);
    if (!d || !d.enc || d.decT > 0) return { ok: false };
    const c = DS.decryptCost(d);
    if (!KY.pay({ rech: c })) return { ok: false, err: 'Nicht genügend Rechenkontingent (' + c + ' EF erforderlich).' };
    d.decT = DS.decryptTime(d);
    d.prog = 0;
    KY.log('dsp', 'Entschlüsselung gestartet: ' + d.id + ' · ' + c + ' EF');
    KY.bus.emit('dsp');
    return { ok: true };
  };
  DS.done = function (d) {
    const S = KY.S;
    d.enc = false; d.decT = 0; d.prog = 1;
    S.stats.decrypted++;
    KY.onb('depesche');
    KY.log('dsp', 'Entschlüsselt: ' + d.id + ' · ' + d.subj);
    if (d.tip) { const c = S.market.c[d.tip.t]; c.mu = d.tip.mu; c.muT = 150; }
    if (d.buff && !d.used) {
      KY.addBuff({ kind: 'proj', type: d.buff.type, succ: d.buff.succ, costMult: d.buff.costMult, region: d.buff.region, ttl: d.buff.ttl, label: 'Gelegenheit ' + d.id });
    }
    if (d.story === 'DSP0412') KY.story.fragment('A');
    if (!KY.silent) KY.notify({ cat: 'dsp', lvl: 'ok', title: 'Entschlüsselt: ' + d.id, text: d.subj, link: { mod: 'depeschen', arg: d.id } });
    KY.bus.emit('dsp');
  };

  /* ================= Infrastruktur ================= */
  const IN = KY.infra = {};
  IN.satDef = id => KY.data.sats.find(s => s.id === id);
  IN.satPos = function (id, t) {
    const s = IN.satDef(id);
    const ph = ((t / s.per) + s.ph) % 1;
    const lon = ((s.lon0 + ph * 360 * 1.0 - (t * 0.25)) % 360 + 540) % 360 - 180;
    const lat = s.inc * Math.sin(ph * Math.PI * 2);
    return [lon, lat];
  };
  IN.retask = function (id, rid) {
    const S = KY.S;
    const s = S.infra.sats.find(x => x.id === id);
    if (!s) return { ok: false };
    if (!KY.pay({ rech: 4 })) return { ok: false, err: 'Nicht genügend Rechenkontingent.' };
    s.focus = rid || null;
    KY.log('orb', id + ' neu ausgerichtet: ' + (rid ? KY.wsim.rname(rid) : 'Bereitschaft'));
    KY.bus.emit('infra');
    return { ok: true };
  };
  IN.dcDef = id => KY.data.dcs.find(d => d.id === id);
  IN.dcCap = function (dc) {
    const def = IN.dcDef(dc.id);
    if (dc.up && dc.up.until > KY.S.t) return def.cap * (1 + 0.35 * (dc.lvl - 1)) * 0.5;
    return def.cap * (1 + 0.35 * (dc.lvl - 1)) * (dc.oc ? 1.4 : 1);
  };
  IN.compute = function () {
    const S = KY.S;
    let c = S.infra.dcs.reduce((s, d) => s + IN.dcCap(d), 0);
    c *= S.integ.level / 100;
    KY.buffs('throttle').forEach(b => { c *= b.mult; });
    if (S.story.ending === 'frei') c *= 1.3;
    if (S.dcDown && S.dcDown > S.t) c *= 0.5;
    return c;
  };
  IN.rechMax = () => 600 + KY.S.infra.dcs.reduce((s, d) => s + d.lvl * 40, 0);
  IN.upgradeCost = dc => ({ kap: +(4 * dc.lvl).toFixed(1) });
  IN.upgrade = function (id) {
    const S = KY.S, dc = S.infra.dcs.find(d => d.id === id);
    if (dc.lvl >= 6) return { ok: false, err: 'Maximale Ausbaustufe erreicht.' };
    if (dc.up && dc.up.until > S.t) return { ok: false, err: 'Ausbau läuft bereits.' };
    if (!KY.pay(IN.upgradeCost(dc))) return { ok: false, err: 'Nicht genügend Kapital.' };
    dc.up = { until: S.t + 60 };
    KY.log('orb', 'Ausbau Rechenzentrum ' + IN.dcDef(id).name + ' auf Stufe ' + (dc.lvl + 1) + ' beauftragt');
    KY.bus.emit('infra');
    return { ok: true };
  };
  IN.overclock = function (id, on) {
    const dc = KY.S.infra.dcs.find(d => d.id === id);
    dc.oc = !!on;
    KY.log('orb', 'Rechenzentrum ' + IN.dcDef(id).name + ': Übertaktung ' + (on ? 'aktiv' : 'aus'));
    KY.bus.emit('infra');
  };
  IN.imgCost = () => ({ rech: 15 });
  IN.requestImage = function (lat, lon, label) {
    const S = KY.S;
    if (S.user.clr < 4) return { ok: false, err: 'Bildaufklärung erfordert Freigabestufe 4.' };
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 80 || Math.abs(lon) > 180) return { ok: false, err: 'Ungültige Koordinaten.' };
    if (S.infra.imgs.some(i => i.status === 'pending')) return { ok: false, err: 'Ein Auftrag ist bereits in Bearbeitung.' };
    if (!KY.pay(IN.imgCost())) return { ok: false, err: 'Nicht genügend Rechenkontingent.' };
    const res = KY.hasRes('O1') ? 0.3 : 4.0;
    const sat = S.infra.sats.filter(s => IN.satDef(s.id).fn === 'Optisch')[0] || S.infra.sats[0];
    const img = { id: 'IMG-' + U.pad(S.infra.imgs.length + 311, 4), lat, lon, res, label: label || '', sat: sat.id, t0: S.t, until: S.t + 18, status: 'pending' };
    S.infra.imgs.unshift(img);
    KY.log('orb', 'Bildauftrag ' + img.id + ': ' + U.n(lat, 2) + ' / ' + U.n(lon, 2) + ' · ' + U.n(res, 1) + ' m/px · ' + sat.id);
    KY.bus.emit('infra');
    return { ok: true, img };
  };
  IN.isKythera = (lat, lon) => Math.abs(lat - 34.2) < 0.35 && Math.abs(lon - 21.4) < 0.35;
  IN.tick = function () {
    const S = KY.S;
    for (const dc of S.infra.dcs) {
      if (dc.up && dc.up.until <= S.t) {
        dc.lvl++; dc.up = null;
        KY.log('orb', 'Rechenzentrum ' + IN.dcDef(dc.id).name + ' auf Stufe ' + dc.lvl + ' ausgebaut');
        KY.notify({ cat: 'orb', lvl: 'ok', title: 'Ausbau abgeschlossen', text: IN.dcDef(dc.id).name + ' · Stufe ' + dc.lvl, link: { mod: 'orbit' } });
        KY.bus.emit('infra');
      }
      if (dc.oc && Math.random() < 0.0025) KY.integ.spawn(3, IN.dcDef(dc.id).name + ': Überhitzung durch Übertaktung');
    }
    for (const img of S.infra.imgs) {
      if (img.status === 'pending' && img.until <= S.t) {
        img.status = 'done';
        img.kythera = IN.isKythera(img.lat, img.lon);
        KY.log('orb', 'Bild ' + img.id + ' empfangen');
        KY.notify({ cat: 'orb', lvl: 'ok', title: 'Bildaufklärung ' + img.id, text: 'Aufnahme verfügbar', link: { mod: 'orbit', arg: img.id } });
        if (img.kythera && img.res < 1) KY.story.fragment('G');
        else if (img.kythera) KY.flag('kytheraBlurry', true);
        KY.bus.emit('infra');
      }
    }
    if (S.dcRisk && S.dcRisk <= S.t) {
      S.dcRisk = 0;
      if (Math.random() < 0.35) {
        S.dcDown = S.t + 120;
        KY.adj('rech', -Math.min(S.res.rech, 60));
        KY.integ.spawn(3, 'Kaldfjord: Notabschaltung Kühlkreislauf B');
        KY.notify({ cat: 'int', lvl: 'crit', title: 'Teilausfall Kaldfjord', text: 'Kühlkreislauf B abgeschaltet. Rechenkapazität halbiert (2 min).', link: { mod: 'integritaet' } });
      }
    }
  };

  /* ================= Integrität ================= */
  const IG = KY.integ = {};
  IG.spawn = function (sev, text, nodeId, story) {
    const S = KY.S, D = KY.data;
    const nodes = D.nodes.filter(n => !n.hidden);
    const node = nodeId || U.pick(nodes).id;
    let a;
    if (text) a = { t: text, sev, fix: 'diag', cause: story ? null : 'Thermische Last außerhalb der Spezifikation. Normalisiert.' };
    else { const tpl = U.pick(D.anomalies); a = Object.assign({}, tpl); }
    a.id = 'AN-' + U.pad((S.integ.seq = (S.integ.seq || 700) + 1), 4);
    a.node = node; a.ts = Date.now(); a.t0 = S.t; a.state = 'offen'; a.story = story || null;
    S.integ.anomalies.unshift(a);
    if (S.integ.anomalies.length > 40) S.integ.anomalies.length = 40;
    KY.log('int', 'Anomalie ' + a.id + ' auf ' + node + ': ' + a.t);
    if (a.sev >= 2 || story) KY.notify({ cat: 'int', lvl: a.sev >= 3 ? 'crit' : 'warn', title: 'Anomalie ' + node, text: a.t, link: { mod: 'integritaet', arg: a.id } });
    KY.bus.emit('integ');
    return a;
  };
  IG.ACTIONS = {
    diag: { n: 'Diagnose', cost: { rech: 5 } },
    rotate: { n: 'Schlüsselrotation', cost: { rech: 10 } },
    isolate: { n: 'Knoten isolieren', cost: { rech: 3 } },
  };
  IG.act = function (aid, action) {
    const S = KY.S;
    const a = S.integ.anomalies.find(x => x.id === aid);
    if (!a || a.state !== 'offen') return { ok: false };
    const A = IG.ACTIONS[action];
    if (!KY.pay(A.cost)) return { ok: false, err: 'Nicht genügend Rechenkontingent.' };
    if (action === 'isolate') S.integ.nodes[a.node].iso = S.t + 45;
    a.tries = (a.tries || 0) + 1;
    let ok = action === a.fix || a.tries >= 2 || action === 'diag';
    if (a.story) ok = action === 'diag';
    if (ok) {
      a.state = 'behoben';
      a.res = action === 'diag' && a.fix !== 'diag' && !a.story ? 'Diagnose: ' + a.cause + ' Gezielte Maßnahme eingeleitet.' : (a.story ? a.storyRes : a.cause);
      KY.log('int', a.id + ' behoben (' + A.n + '): ' + (a.res || ''));
      if (a.story) KY.story.anomalyResolved(a);
    } else {
      a.res = A.n + ' ohne Wirkung. Ursache weiter offen.';
      KY.log('int', a.id + ': ' + A.n + ' ohne Wirkung');
    }
    KY.bus.emit('integ');
    return { ok: true, fixed: ok };
  };
  IG.tick = function (dt) {
    const S = KY.S, T = S.timers;
    if (T.anomaly <= S.t) {
      T.anomaly = S.t + U.ri(150, 280);
      IG.spawn();
    }
    // geringfügige Anomalien behebt der Betrieb nach einiger Zeit selbst
    for (const a of S.integ.anomalies) {
      if (a.state === 'offen' && !a.story && S.t - a.t0 > (a.sev === 1 ? 300 : a.sev === 2 ? 600 : 900)) {
        a.state = 'behoben'; a.res = 'Durch den Regelbetrieb behoben. ' + (a.cause || '');
        KY.log('int', a.id + ' im Regelbetrieb behoben');
      }
    }
    const open = S.integ.anomalies.filter(a => a.state === 'offen');
    let target = 99.5 - open.reduce((s, a) => s + a.sev * 1.6, 0);
    if (S.infra.dcs.some(d => d.oc)) target -= 2;
    S.integ.level += (U.clamp(target, 60, 100) - S.integ.level) * 0.02 * dt;
    for (const id in S.integ.nodes) {
      const n = S.integ.nodes[id];
      n.lat = U.clamp(n.lat + U.gauss() * 2, 6, 140);
      const affected = open.filter(a => a.node === id);
      n.integ = U.clamp(n.integ + ((affected.length ? 92 - affected.length * 6 : 99.5) - n.integ) * 0.05 * dt, 0, 100);
      n.up = !(n.iso && n.iso > S.t);
    }
  };

  /* ================= Ressourcen ================= */
  KY.resTick = function (dt) {
    const S = KY.S, D = KY.data;
    // Rechenkontingent
    const comp = IN.compute();
    S.res.rech = Math.min(IN.rechMax(), S.res.rech + comp / 60 * dt * 3);
    // Einfluss: Grundzufluss + Präsenz
    const praes = U.avg(D.regionOrder.map(id => S.regions[id].m.praes));
    S.res.ein += (1.5 + praes / 22 + (S.user.clr - 3) * 1.5) / 60 * dt;
    // Diskretion erholt sich langsam
    const dTarget = 92 + (S.story.ending === 'archon' ? 4 : 0);
    S.res.disk = U.clamp(S.res.disk + (dTarget - S.res.disk) * 0.0035 * dt, 0, 100);
    // Ansehen tendiert zur Mitte, Diskretionsprobleme schaden
    S.res.ans = U.clamp(S.res.ans + (50 - S.res.ans) * 0.0004 * dt - (S.res.disk < 40 ? 0.01 * dt : 0), 0, 100);
    if (S.res.disk < 35 && !S.warnDisk) {
      S.warnDisk = true;
      KY.notify({ cat: 'sys', lvl: 'warn', title: 'Diskretion kritisch', text: 'Öffentliche Aufmerksamkeit steigt. Das Plenum ist beunruhigt.', link: { mod: 'integritaet' } });
      KY.seatAdj('DRACO', -4); KY.seatAdj('AQUILA', -3);
    }
    if (S.res.disk > 45) S.warnDisk = false;
    // Darlehen
    if (S.loans) {
      for (const l of S.loans.slice()) {
        if (l.at <= S.t) {
          KY.adj('kap', l.amt);
          KY.log('kap', 'Rückzahlung von ' + l.from + ': ' + U.money(l.amt));
          KY.notify({ cat: 'kap', lvl: 'ok', title: 'Rückzahlung ' + l.from, text: U.money(l.amt), link: { mod: 'kapital' } });
          S.loans = S.loans.filter(x => x !== l);
        }
      }
    }
    S.buffs = S.buffs.filter(b => b.until > S.t);
  };
})();
