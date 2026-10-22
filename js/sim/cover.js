/* KYTHERA · MANDAT · Tarnung: Tarnstrukturen, Spuren, Recherchen, Enttarnung */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const C = (KY.cover = {});

  const jur = () => SIM.JUR[SIM.contract('jurisdiction')] || SIM.JUR.holmvik;
  const tru = () => SIM.TRUSTEE[SIM.contract('trustee')] || SIM.TRUSTEE.halvorsen;
  C.fit = (f, A) => (D.FRONT_FIT[f.kind] || []).indexOf(A.cat) >= 0;

  /* Erwarteter Spurenzuwachs für eine Tarnstruktur */
  C.traceGain = function (A, o, x, front, vis) {
    const S = SIM.S;
    if (S.g.exposed) return 0;
    front = front || S.fronts.find(f => !f.exposed);
    if (!front) return 0;
    const cost = A.cost ? 1 : 0;
    let g = (vis || 0) * 1.35 + cost * 0.4;
    g *= jur().trace * tru().trace;
    g *= C.fit(front, A) ? 0.72 : 1.3;
    g *= 1 + front.projects.length * 0.1;
    if (S.day < S.g.chainUntil) g *= 0.6;
    if (x && x.nid >= 0) g *= 0.6 + S.nations[x.nid].press / 120;
    return Math.round(g * 10) / 10;
  };

  C.onOrder = function (p, q) {
    const S = SIM.S;
    const f = S.fronts.find(z => z.id === p.front);
    if (!f || f.exposed) return;
    const g = C.traceGain(q.A, q.o, q.x, f, q.vis);
    f.trace = Math.min(100, f.trace + g);
    f.spent += q.cost;
    S.g.ky += g * 0.04;
  };
  C.addTrace = function (fid, v) {
    const f = SIM.S.fronts.find(z => z.id === fid);
    if (f && !f.exposed) f.trace = U.clamp(f.trace + v * jur().trace, 0, 100);
  };
  C.onIncident = function (inc, T) {
    const S = SIM.S;
    const f = S.fronts.find(z => z.id === inc.front);
    if (!f || f.exposed) return;
    const add = (T.trace || 0) + (inc.sev >= 3 ? 5 + inc.sev * 2 : inc.sev) + Math.sqrt(inc.dead) * 0.3;
    C.addTrace(f.id, add);
    if (inc.sev >= 3 && !f.inv) startInv(f, inc.n);
  };

  function startInv(f, nid) {
    const S = SIM.S;
    const ch = U.weighted(D.CHANNELS, c => c.bias.crit * c.bias.crit);
    f.inv = { ch: ch.id, start: S.day, prog: 0, n: nid >= 0 ? nid : -1, reporter: U.pick(ch.reporters || ['eine Reporterin']) };
    SIM.msg('dobrev', 'Recherche gegen ' + f.name, [ch.name + ' recherchiert zur Eigentümerstruktur von ' + f.name + '. Federführend: ' + f.inv.reporter + '.', 'Die Recherche wird Spuren freilegen. Wir können die Kette verlängern oder Vorhaben auf andere Strukturen verteilen. Druck auf Journalisten ist nach dem Mandat ausgeschlossen.'], { kind: 'warn', acts: [{ l: 'Tarnung öffnen', a: 'panel', p: { id: 'tarnung' } }] });
  }

  C.daily = function () {
    const S = SIM.S, g = S.g;
    if (g.exposed) return;
    const chain = S.day < g.chainUntil ? 0.6 : 1;
    let expo = 0;
    for (const f of S.fronts) {
      if (f.exposed) continue;
      let act = 0, press = 0;
      f.projects.forEach(pid => {
        const p = KY.projects.byId(pid);
        if (!p || !KY.projects.ACTIVE[p.phase]) return;
        act += p.vis || 0;
        press += p.n >= 0 ? S.nations[p.n].press : 50;
      });
      if (act > 0) {
        const pr = press / Math.max(1, f.projects.length) / 60;
        f.trace += act * 0.0026 * pr * jur().trace * tru().trace * chain;
      } else f.trace = Math.max(0, f.trace - 0.02);
      if (!f.inv && f.trace > 35 && Math.random() < 0.004 * (f.trace / 50)) startInv(f, -1);
      if (f.inv) {
        f.inv.prog += 0.006 * (1 + f.trace / 100) * chain;
        if (f.inv.prog >= 1) {
          f.trace = Math.min(100, f.trace + 18 + Math.random() * 10);
          const ch = D.CHANNELS.find(c => c.id === f.inv.ch);
          KY.media.story('trace_investigation', { n: f.inv.n, extra: { front: f.name } }, { tone: -0.3, heat: 26, about: true, ch: ch ? ch.id : null, front: f.id });
          if (f.inv.n >= 0) KY.media.story('trace_rumor', { n: f.inv.n, extra: { front: f.name } }, { tone: -0.2, heat: 14, about: true, front: f.id });
          SIM.chron('tarnung', 'Recherche von ' + (ch ? ch.name : 'Journalisten') + ' zu ' + f.name + ' veröffentlicht.', { front: f.id });
          f.inv = null;
        }
      }
      if (f.trace >= 50 && !f.warn50) { f.warn50 = true; SIM.msg('dobrev', f.name + ': Spuren über 50 %', ['Die Spuren zu ' + f.name + ' verdichten sich. Weitere Vorhaben über diese Struktur erhöhen das Risiko einer Enttarnung.'], { kind: 'warn' }); }
      if (f.trace >= 82 && !f.warn80) { f.warn80 = true; SIM.msg('dobrev', 'Akute Gefahr: ' + f.name, ['Die Enttarnung von ' + f.name + ' steht unmittelbar bevor. Empfehlung: Struktur auflösen oder Treuhandkette verlängern.'], { kind: 'crisis', acts: [{ l: 'Tarnung öffnen', a: 'panel', p: { id: 'tarnung' } }] }); }
      if (f.trace >= 100) C.expose(f);
      if (f.trace > 55) expo += (f.trace - 55) * 0.0007;
    }
    expo *= g.face ? 0.5 : 1;
    g.exposure = U.clamp(g.exposure + expo + g.ky * 0.0004, 0, 100);
    if (g.face) {
      g.face.cred = Math.min(95, g.face.cred + 0.01);
      if (g.face.cred < 22) faceQuits();
    }
    if (g.exposure >= 50 && !g.warnE50) { g.warnE50 = true; SIM.msg('dobrev', 'Enttarnungsgrad 50 %', ['Mehrere Redaktionen vermuten inzwischen einen einzelnen Geldgeber hinter den Vorhaben. Noch fehlt ihnen die Verbindung.'], { kind: 'warn' }); }
    if (g.exposure >= 85 && !g.warnE85) { g.warnE85 = true; SIM.msg('dobrev', 'Enttarnung steht bevor', ['Es ist nur noch eine Frage von Wochen. Bereiten Sie sich auf die öffentliche Phase vor: Ihre Bilanz wird dann alles sein, was zählt.'], { kind: 'crisis' }); }
    if (g.exposure >= 100) C.globalExposure();
  };

  C.expose = function (f) {
    const S = SIM.S, g = S.g;
    if (f.exposed) return;
    f.exposed = true; f.trace = 100; f.exposedAt = S.day; f.inv = null;
    const nats = new Set();
    f.projects.forEach(pid => { const p = KY.projects.byId(pid); if (p && p.n >= 0) nats.add(p.n); });
    nats.forEach(nid => SIM.opImpulse(nid, [-0.4, -0.3, -0.5, -0.2, -0.6], 3, { aware: 14 }));
    g.exposure = Math.min(100, g.exposure + 8 + f.projects.length * 0.8);
    if (g.face) g.face.cred -= 8;
    SIM.g_trust(-4);
    KY.media.story('front_exposed', { extra: { front: f.name } }, { tone: -0.5, heat: 46, about: true, global: true, front: f.id });
    SIM.chron('tarnung', f.name + ' ist als Tarnstruktur enttarnt. ' + f.projects.length + ' Vorhaben werden nun öffentlich einem unbekannten Geldgeber zugeschrieben.', { front: f.id });
    SIM.msg('dobrev', 'Enttarnt: ' + f.name, [f.name + ' ist aufgeflogen. Die Medien wissen jetzt, dass ' + f.projects.length + ' Vorhaben aus derselben Quelle finanziert werden.', 'Ihr Name ist weiterhin unbekannt. Neue Vorhaben sollten über andere Strukturen laufen.'], { kind: 'crisis' });
    KY.bus.emit('frontexposed', f);
  };

  /* Die große Enthüllung: die Welt weiß, dass eine einzelne Person dahintersteht. Der Name bleibt versiegelt. */
  C.globalExposure = function () {
    const S = SIM.S, g = S.g;
    if (g.exposed) return;
    g.exposed = true; g.exposure = 100; g.exposedAt = S.day;
    const net = (g.lives - g.deaths * 4) / (g.lives + g.deaths * 4 + 2000);
    S.nations.forEach((n, id) => {
      n.aware = Math.max(n.aware, 72);
      SIM.opImpulse(id, [0.8, 0.6, 0.5, 0.7, 0.3], net * 14, { direct: true });
      SIM.opImpulse(id, [-0.2, -0.3, -0.4, -0.1, -0.6], 4, { direct: true });
    });
    S.fronts.forEach(f => { f.exposed = true; });
    KY.finance.freeze(0.2, 365);
    SIM.g_trust(-10);
    KY.media.story('exposure_global', { extra: {} }, { tone: net > 0 ? 0.1 : -0.6, heat: 100, about: true, global: true, breaking: true });
    SIM.chron('tarnung', 'Enttarnung: Die Welt weiß nun, dass eine einzelne Person hinter allen Vorhaben steht. Bekannt ist nur der Deckname „' + S.codename + '“. Die Identität bleibt versiegelt.', null);
    SIM.msg('kuratorium', 'Eintritt der öffentlichen Phase', ['Gemäß § 6 der Geheimhaltungsvereinbarung (KY-M/2027/02) tritt das Mandat in die öffentliche Phase ein. Ihr Name bleibt versiegelt; bekannt ist allein der Deckname „' + S.codename + '“.', 'Das Kuratorium verwahrt 20 % des Vermögens für ein Jahr auf einem Sperrkonto, um rechtliche Risiken abzudecken.', 'Ab heute wird jede Ihrer Entscheidungen öffentlich Ihnen zugeschrieben.'], { kind: 'letter', prio: 3 });
    KY.bus.emit('exposed', null);
  };

  function faceQuits() {
    const S = SIM.S, g = S.g;
    const name = g.face.name;
    KY.media.story(null, {}, { h: name + ' legt das Amt als Gesicht der Stiftung nieder', tone: -0.3, heat: 28, about: true, global: true, key: 'face_quit' });
    SIM.chron('tarnung', name + ' tritt als öffentliches Gesicht zurück. Glaubwürdigkeit aufgebraucht.', null);
    SIM.msg('dobrev', 'Rücktritt: ' + name, [name + ' hat das Amt niedergelegt. Ohne Gesicht wächst die Spekulation über den eigentlichen Geldgeber wieder schneller.'], { kind: 'warn' });
    g.face = null;
  }

  /* ---------- Handlungen der Tarnung ---------- */
  C.newFront = function (kind, seat, name) {
    const S = SIM.S;
    const cost = 0.3;
    if (KY.finance.avail() < cost) return { ok: false, err: 'Nicht genügend liquide Mittel.' };
    KY.finance.spend(cost, 'Gründung Tarnstruktur');
    const f = SIM.makeFront(S, kind, seat, name);
    f.trace = S.g.exposed ? 100 : 1 + Math.random() * 3;
    if (S.g.exposed) f.exposed = true;
    SIM.chron('tarnung', 'Neue Tarnstruktur gegründet: ' + f.name + ' (' + f.seat + ').', { front: f.id });
    return { ok: true, f };
  };
  C.dissolve = function (fid, targetId) {
    const S = SIM.S;
    const f = S.fronts.find(z => z.id === fid), t = S.fronts.find(z => z.id === targetId);
    if (!f || !t || f === t) return { ok: false, err: 'Ungültige Auswahl.' };
    const alive = S.fronts.filter(z => !z.dissolved);
    if (alive.length <= 1) return { ok: false, err: 'Die letzte Struktur kann nicht aufgelöst werden.' };
    const cost = 0.1 + f.projects.length * 0.02;
    if (KY.finance.avail() < cost) return { ok: false, err: 'Nicht genügend liquide Mittel.' };
    KY.finance.spend(cost, 'Auflösung ' + f.name);
    f.projects.forEach(pid => { const p = KY.projects.byId(pid); if (p) p.front = t.id; t.projects.push(pid); });
    if (!t.exposed) t.trace = Math.min(100, t.trace + f.trace * 0.25 + (f.inv ? 10 : 0));
    f.projects = []; f.dissolved = true; f.trace = 0; f.inv = null;
    S.fronts = S.fronts.filter(z => z !== f);
    S.g.ky += 0.5;
    SIM.chron('tarnung', f.name + ' aufgelöst. Vorhaben gehen auf ' + t.name + ' über.', { front: t.id });
    return { ok: true, cost };
  };
  C.finish = function (p) {
    const S = SIM.S, A = D.ACT[p.act];
    if (A.cover === 'chain') {
      S.fronts.forEach(f => { if (!f.exposed) { f.trace = Math.max(0, f.trace - 22); f.warn50 = f.trace >= 50; f.warn80 = f.trace >= 82; } });
      S.g.exposure = Math.max(0, S.g.exposure - 6);
      S.g.chainUntil = S.day + 365;
      SIM.chron('tarnung', 'Treuhandkette verlängert: Spuren aller Strukturen deutlich gesenkt, neue Spuren gedämpft für ein Jahr.', null);
    } else if (A.cover === 'face') {
      const F = D.FACES.find(f => f.id === p.o.face) || D.FACES[0];
      S.g.face = { id: F.id, name: F.name, role: F.role, cred: F.cred, since: S.day };
      KY.media.story(null, {}, { h: F.name + ' wird Gesicht einer großen Stiftung: „Ich stehe für diese Projekte ein“', tone: 0.3, heat: 30, about: true, global: true, key: 'face_new' });
      SIM.chron('tarnung', F.name + ' tritt als öffentliches Gesicht Ihrer Vorhaben auf.', null);
    }
  };
  C.chainCost = () => 0.8;
})();
