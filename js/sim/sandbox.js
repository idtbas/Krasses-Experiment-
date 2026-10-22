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
    { id: 'himmel', n: 'Himmel und All', icon: 'spark' },
    { id: 'wirtschaft', n: 'Wirtschaft', icon: 'chart' },
    { id: 'politik', n: 'Politik', icon: 'ballot' },
    { id: 'gesellschaft', n: 'Gesellschaft', icon: 'users' },
  ];
  SB.TOOLS = [
    { id: 'quake', cat: 'natur', ev: 'quake', target: 'point' },
    { id: 'tsunami', cat: 'natur', ev: 'tsunami', target: 'point', coast: true },
    { id: 'storm', cat: 'natur', ev: 'storm', target: 'point' },
    { id: 'flood', cat: 'natur', ev: 'flood', target: 'point' },
    { id: 'volcano', cat: 'natur', ev: 'volcano', target: 'point' },
    { id: 'meteor', cat: 'himmel', ev: 'meteor', target: 'point' },
    { id: 'solarstorm', cat: 'himmel', ev: 'solarstorm', target: 'global' },
    { id: 'aurora', cat: 'himmel', ev: 'aurora', target: 'nation' },
    { id: 'eclipse', cat: 'himmel', ev: 'eclipse', target: 'point' },
    { id: 'fire', cat: 'natur', ev: 'fire', target: 'point' },
    { id: 'tornado', cat: 'natur', ev: 'tornado', target: 'point' },
    { id: 'landslide', cat: 'natur', ev: 'landslide', target: 'point' },
    { id: 'sandstorm', cat: 'natur', ev: 'sandstorm', target: 'point' },
    { id: 'locusts', cat: 'natur', ev: 'locusts', target: 'nation' },
    { id: 'drought', cat: 'natur', ev: 'drought', target: 'nation' },
    { id: 'heat', cat: 'natur', ev: 'heat', target: 'nation' },
    { id: 'cold', cat: 'natur', ev: 'cold', target: 'nation' },
    { id: 'epidemic', cat: 'natur', ev: 'epidemic', target: 'nation' },
    { id: 'crash', cat: 'wirtschaft', n: 'Weltweiter Börsencrash', icon: 'trendDown', target: 'global', text: 'Die Kurse stürzen ab, Wachstum bricht überall ein.' },
    { id: 'oilshock', cat: 'wirtschaft', n: 'Ölpreisschock', icon: 'drop', target: 'global', text: 'Rohöl wird drastisch teurer. Energiearme Staaten leiden am meisten.' },
    { id: 'techjump', cat: 'wirtschaft', n: 'Technologiesprung', icon: 'atom', target: 'nation', text: 'Ein Durchbruch in Forschung und Industrie hebt das ganze Land.' },
    { id: 'tourism', cat: 'wirtschaft', n: 'Touristenansturm', icon: 'plane', target: 'nation', text: 'Das Land wird plötzlich zum Sehnsuchtsziel der Welt.' },
    { id: 'bankrun', cat: 'wirtschaft', n: 'Bankenkrise', icon: 'bank', target: 'nation', text: 'Kunden stürmen die Banken, Kredite frieren ein.' },
    { id: 'harvest', cat: 'wirtschaft', n: 'Rekordernte', icon: 'wheat', target: 'nation', text: 'Volle Speicher, sinkende Preise, weniger Hunger.' },
    { id: 'boom', cat: 'wirtschaft', n: 'Wirtschaftsboom', icon: 'trendUp', target: 'nation', text: 'Ein Jahr kräftiges Wachstum, mehr Zufriedenheit.' },
    { id: 'resource', cat: 'wirtschaft', n: 'Rohstofffund', icon: 'mountain', target: 'nation', text: 'Dauerhaft mehr Wachstum – aber auch mehr Korruption und Umweltschäden.' },
    { id: 'debt', cat: 'wirtschaft', n: 'Staatsschuldenkrise', icon: 'bank', target: 'nation', text: 'Der Staat kann seine Schulden kaum bedienen.' },
    { id: 'cropfail', cat: 'wirtschaft', n: 'Missernte', icon: 'wheat', target: 'nation', text: 'Lebensmittel werden knapp und teuer.' },
    { id: 'blackout', cat: 'wirtschaft', n: 'Stromausfall', icon: 'power', target: 'nation', text: 'Das Netz bricht zusammen.' },
    { id: 'election', cat: 'politik', n: 'Neuwahl ansetzen', icon: 'ballot', target: 'nation', text: 'Die Bevölkerung entscheidet sofort neu.' },
    { id: 'reform', cat: 'politik', n: 'Reformwelle', icon: 'scale', target: 'nation', text: 'Mehr Pressefreiheit, weniger Korruption – nicht alle Mächtigen sind begeistert.' },
    { id: 'statevisit', cat: 'politik', n: 'Staatsbesuch', icon: 'flag', target: 'two', text: 'Ein historischer Besuch mit Bildern, die um die Welt gehen.' },
    { id: 'borderopen', cat: 'politik', n: 'Grenzöffnung', icon: 'route', target: 'two', text: 'Offene Grenzen für Menschen und Waren.' },
    { id: 'detente', cat: 'politik', n: 'Annäherung', icon: 'hands', target: 'two', text: 'Zwei Regierungen finden zueinander.' },
    { id: 'freeze', cat: 'politik', n: 'Diplomatische Eiszeit', icon: 'snow', target: 'two', text: 'Botschafter werden abgezogen, Grenzen geschlossen. Kein Krieg.' },
    { id: 'trade', cat: 'politik', n: 'Handelsabkommen', icon: 'scales', target: 'two', text: 'Zölle fallen, beide Volkswirtschaften wachsen.' },
    { id: 'summit', cat: 'politik', n: 'Weltgipfel', icon: 'globe', target: 'global', text: 'Alle Staaten rücken ein Stück zusammen.' },
    { id: 'worldcup', cat: 'gesellschaft', n: 'Weltmeisterschaft', icon: 'medal', target: 'point', text: 'Ein Turnier, das ein ganzes Land in Feierlaune versetzt.' },
    { id: 'cure', cat: 'gesellschaft', n: 'Heilmittel', icon: 'syringe', target: 'nation', text: 'Ein Impfstoff beendet alle Seuchen im Land.' },
    { id: 'medbreak', cat: 'gesellschaft', n: 'Medizinischer Durchbruch', icon: 'stethoscope', target: 'global', text: 'Die Gesundheit der ganzen Welt verbessert sich.' },
    { id: 'rain', cat: 'gesellschaft', n: 'Ersehnter Regen', icon: 'rain', target: 'nation', text: 'Beendet Dürren und löscht Brände.' },
    { id: 'aidwave', cat: 'gesellschaft', n: 'Weltweite Hilfswelle', icon: 'boxes', target: 'global', text: 'Hilfe erreicht alle laufenden Katastrophen auf einmal.' },
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
      if (t.target === 'global') { at = null; city = undefined; }
      const ev = KY.events.spawn(t.ev, { at, city, sev, director: true });
      if (!ev) return { ok: false, err: 'Hier nicht möglich.' };
      log(t, ev.name + ' (Stufe ' + sev + ')');
      return { ok: true, msg: ev.name + ' · Stufe ' + sev, ev };
    }
    const r = applyOther(id, t, tg, sev);
    if (r.ok) {
      KY.reactions.onTool(id, Object.assign({}, tg, r.n !== undefined ? { n: r.n } : {}));
      KY.bus.emit('tool', { id, tg, r, sev });
    }
    return r;
  };

  function applyOther(id, t, tg, sev) {
    const S = SIM.S, W = SIM.W;
    const n = tg.n, n2 = tg.n2;
    const N = n !== undefined && n >= 0 ? S.nations[n] : null;
    const name = n >= 0 ? SIM.nName(n) : '';
    if (t.target === 'nation' && !N) return { ok: false, err: 'Kein Staat an dieser Stelle.' };
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
      case 'oilshock': {
        if (S.mkt && S.mkt.com[0]) S.mkt.com[0].v *= 1.4 + sev * 0.12;
        S.nations.forEach((m, i) => { SIM.shock(i, 'growth', -(0.2 + (60 - Math.min(60, m.energy)) * 0.02) * sev / 3, 300); });
        KY.media.story(null, {}, { h: U.pick(['Ölpreis auf Rekordhoch: Weltwirtschaft unter Schock', 'Barrel zum Rekordpreis – Tankstellen schließen, Flüge fallen aus']), tone: -0.4, heat: 40, global: true, key: 'oilshock' });
        log(t, 'Ölpreisschock'); return { ok: true, msg: 'Rohöl explodiert im Preis' };
      }
      case 'techjump':
        N.fx.tech = (N.fx.tech || 0) + 0.6 + sev * 0.3; N.growth0 += 0.2 + sev * 0.08;
        KY.media.story(null, { n }, { h: U.pick([name + ' gelingt technologischer Durchbruch', 'Hightech-Wunder ' + name + ': Industrie im Aufbruch']), tone: 0.4, heat: 24, key: 'techjump' });
        log(t, 'Technologiesprung in ' + name); return { ok: true, msg: 'Technologiesprung in ' + name };
      case 'tourism':
        SIM.shock(n, 'happy', 3, 300); SIM.shock(n, 'growth', 0.3 + sev * 0.1, 365); SIM.shock(n, 'unemp', -1.2, 365);
        KY.media.story(null, { n }, { h: U.pick(['Alle wollen nach ' + name + ': Tourismus auf Rekordniveau', 'Sehnsuchtsziel ' + name + ' – Hotels ausgebucht bis ins nächste Jahr']), tone: 0.4, heat: 18, key: 'tourism' });
        log(t, 'Touristenansturm in ' + name); return { ok: true, msg: 'Touristen strömen nach ' + name };
      case 'bankrun':
        SIM.shock(n, 'growth', -1.2 - sev * 0.3, 300); SIM.shock(n, 'unrest', 3 + sev, 200); SIM.shock(n, 'happy', -3 - sev, 200);
        N.crisis = { k: 'debt', start: S.day, until: S.day + 200 };
        KY.media.story(null, { n }, { h: U.pick(['Schlangen vor den Banken: Bankenkrise in ' + name, name + ': Regierung schließt Banken für eine Woche']), tone: -0.5, heat: 30, key: 'bankrun' });
        log(t, 'Bankenkrise in ' + name); return { ok: true, msg: 'Bankenkrise in ' + name };
      case 'harvest':
        SIM.shock(n, 'poverty', -3 - sev, 365); SIM.shock(n, 'happy', 2 + sev * 0.6, 300);
        if (S.mkt && S.mkt.com[2]) S.mkt.com[2].v *= 0.92;
        KY.media.story(null, { n }, { h: U.pick(['Rekordernte in ' + name + ': Speicher randvoll', 'Goldene Felder: ' + name + ' feiert die beste Ernte seit Jahrzehnten']), tone: 0.5, heat: 16, key: 'harvest' });
        log(t, 'Rekordernte in ' + name); return { ok: true, msg: 'Rekordernte in ' + name };
      case 'reform':
        N.base.press = U.clamp(N.base.press + 8 + sev * 2, 0, 100); N.base.corrupt = U.clamp(N.base.corrupt - 6 - sev * 2, 0, 100);
        N.gov.approval = U.clamp(N.gov.approval + (Math.random() < 0.5 ? 6 : -6), 0, 100);
        KY.media.story(null, { n }, { h: U.pick(['Reformwelle in ' + name + ': Pressefreiheit gestärkt, Antikorruptionsbehörde gegründet', name + ' räumt auf: Große Reform beschlossen']), tone: 0.4, heat: 20, key: 'reform' });
        log(t, 'Reformwelle in ' + name); return { ok: true, msg: 'Reformen in ' + name };
      case 'statevisit': case 'borderopen': {
        if (n2 === undefined || n2 < 0 || n2 === n) return { ok: false, err: 'Zwei verschiedene Staaten wählen.' };
        SIM.relAdd(n, n2, id === 'statevisit' ? 16 : 10, 'regie');
        if (id === 'borderopen') { SIM.rel(n, n2).trade = true; S.nations[n].fx.growth = (S.nations[n].fx.growth || 0) + 0.1; S.nations[n2].fx.growth = (S.nations[n2].fx.growth || 0) + 0.1; }
        const h = id === 'statevisit' ? U.pick(['Historischer Staatsbesuch: ' + S.nations[n].gov.leader + ' in ' + SIM.nName(n2), 'Bilder einer Annäherung: Staatsbesuch zwischen ' + name + ' und ' + SIM.nName(n2)]) : 'Schlagbäume fallen: ' + name + ' und ' + SIM.nName(n2) + ' öffnen ihre Grenzen';
        KY.media.story(null, { n, n2 }, { h, tone: 0.5, heat: 22, key: id });
        log(t, t.n + ': ' + name + ' und ' + SIM.nName(n2)); return { ok: true, msg: t.n + ': ' + name + ' und ' + SIM.nName(n2) };
      }
      case 'worldcup': {
        const r = KY.geo.nearestCity(tg.lon, tg.lat);
        if (!r) return { ok: false, err: 'Keine Stadt in der Nähe.' };
        const nn = r.city.nation;
        SIM.shock(nn, 'happy', 5, 150); SIM.shock(nn, 'growth', 0.3, 200);
        S.cities[r.city.id].sent = U.clamp(S.cities[r.city.id].sent + 4, -100, 100);
        S.g.worldcup = { c: r.city.id, n: nn, until: S.day + 30 };
        KY.media.story(null, { n: nn, c: r.city.id }, { h: U.pick(['Anpfiff in ' + r.city.name + ': Die Weltmeisterschaft beginnt', SIM.nName(nn) + ' im Fußballfieber: WM-Eröffnung in ' + r.city.name]), tone: 0.6, heat: 34, global: true, key: 'worldcup' });
        log(t, 'Weltmeisterschaft in ' + r.city.name); return { ok: true, msg: 'WM in ' + r.city.name, city: r.city.id, n: nn };
      }
      case 'cure': {
        let k = 0;
        S.events.forEach(e => { if (e.n === n && e.type === 'epidemic' && e.phase !== 'vorbei') { e.saved += Math.max(0, e.dead - e.deadNow); e.dead = e.deadNow; e.end = S.day; k++; } });
        SIM.shock(n, 'health', 4, 300);
        KY.media.story(null, { n }, { h: k ? 'Durchbruch in ' + name + ': Neuer Impfstoff stoppt die Epidemie' : 'Neuer Impfstoff in ' + name + ' zugelassen', tone: 0.6, heat: 24, key: 'cure' });
        log(t, 'Heilmittel in ' + name); return { ok: true, msg: k ? 'Epidemie gestoppt' : 'Impfstoff verteilt' };
      }
      case 'medbreak':
        S.nations.forEach(m => { m.fx.health = (m.fx.health || 0) + 1.5 + sev * 0.5; });
        KY.media.story(null, {}, { h: 'Medizinischer Durchbruch: Neue Therapie rettet weltweit Millionen', tone: 0.6, heat: 40, global: true, key: 'medbreak' });
        log(t, 'Medizinischer Durchbruch'); return { ok: true, msg: 'Gesundheit weltweit verbessert' };
      case 'rain': {
        let k = 0;
        S.events.forEach(e => { if (e.n === n && (e.type === 'drought' || e.type === 'fire' || e.type === 'heat') && e.phase !== 'vorbei') { e.dead = e.deadNow; e.end = S.day; k++; } });
        SIM.shock(n, 'poverty', -2, 200); SIM.shock(n, 'happy', 3, 120);
        KY.media.story(null, { n }, { h: k ? 'Endlich Regen: Menschen in ' + name + ' tanzen auf den Straßen' : 'Ergiebiger Regen über ' + name, tone: 0.5, heat: 20, key: 'rain' });
        log(t, 'Regen über ' + name); return { ok: true, msg: k ? k + ' Krise(n) beendet' : 'Regen über ' + name };
      }
      case 'aidwave': {
        let saved = 0;
        S.events.forEach(e => { if (e.phase === 'vorbei' || D.EVENTS[e.type].harmless) return; const sv = Math.round(Math.max(0, e.dead - e.deadNow) * 0.35); e.dead -= sv; e.saved += sv; saved += sv; e.helped.WELT = S.day; });
        KY.media.story(null, {}, { h: 'Weltweite Hilfswelle: Hilfsgüter erreichen alle Krisengebiete', tone: 0.6, heat: 30, global: true, key: 'aidwave' });
        log(t, 'Weltweite Hilfswelle'); return { ok: true, msg: U.count(saved) + ' Menschen gerettet' };
      }
    }
    return { ok: false, err: 'Nicht möglich.' };
  }

  /* Globale Regler */
  SB.FREQ = [{ v: 0, n: 'aus' }, { v: 0.5, n: 'selten' }, { v: 1, n: 'normal' }, { v: 2, n: 'häufig' }, { v: 4, n: 'chaotisch' }];
  SB.CLIMATE = [0, 0.5, 1, 1.5, 2, 3];

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
