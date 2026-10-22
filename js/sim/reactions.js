/* KYTHERA · MANDAT · Reaktionen der Welt auf Ereignisse und Eingriffe der Weltregie
   Jede Reaktion wird mit Verzögerung abgearbeitet, damit sich Geschehen über Tage und Wochen entfaltet. */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const SIM = KY.sim;
  const RX = (KY.reactions = {});

  const q = () => (SIM.S.rq = SIM.S.rq || []);
  const add = (days, k, data) => q().push(Object.assign({ day: SIM.S.day + days, k }, data));
  RX.feed = () => (SIM.S.rfeed = SIM.S.rfeed || []);

  /* Eine sichtbare Reaktion: Feed, schwebender Hinweis auf der Karte, optional Meldung */
  function emit(o) {
    const S = SIM.S;
    const e = { day: S.day, text: o.text, icon: o.icon || 'info', tone: o.tone || 0, lon: o.lon, lat: o.lat, n: o.n };
    U.push(RX.feed(), e, 80);
    KY.bus.emit('reaction', e);
    if (o.h) KY.media.story(o.key || null, o.v || { n: o.n }, { h: o.h, tone: o.tone || 0, heat: o.heat || 14, key: o.mkey || 'reaction', ev: o.ev });
  }
  RX.emit = emit;
  const capOf = nid => SIM.W.cities[SIM.W.nations[nid].capital];

  /* ---------- Planung nach einem Naturereignis ---------- */
  KY.bus.on('event', ev => {
    if (!SIM.S) return;
    const T = D.EVENTS[ev.type];
    if (T.harmless) { add(1, 'joy', { ev: ev.id }); add(4, 'tourism', { ev: ev.id }); return; }
    // Sofortreaktion: die ersten Bilder und Notrufe
    if (ev.byDirector || ev.sev >= 3) {
      const W = SIM.W, city = W.cities[ev.c].name, name = W.nations[ev.n].short;
      const txt = T.nationwide ? ['Krisenstab in ' + name + ' tagt in Dauersitzung', 'Sondersendungen auf allen Kanälen in ' + name, 'Regierung von ' + name + ' ruft den Notstand aus'] : ['Erste Bilder aus ' + city + ' gehen um die Welt', 'Notrufzentralen in ' + name + ' überlastet', 'Live-Schalte nach ' + city + ': Menschen fliehen auf die Straßen', 'Augenzeugen filmen das Unglück bei ' + city];
      emit({ n: ev.n, lon: ev.lon, lat: ev.lat, icon: U.pick(['tv', 'phone', 'camera']), tone: -0.3, text: U.pick(txt) });
    }
    add(1, 'gov', { ev: ev.id });
    add(2, 'social', { ev: ev.id });
    if (ev.sev >= 3 || ev.dead > 300) { add(2 + Math.floor(Math.random() * 3), 'help', { ev: ev.id }); add(5, 'markets', { ev: ev.id }); }
    if (ev.dead >= 500) add(7, 'mourn', { ev: ev.id });
    if (ev.displaced >= 100000) add(18, 'shelter', { ev: ev.id });
    if (ev.dmg >= 0.5) add(50, 'rebuild', { ev: ev.id });
    if (ev.sev >= 3) add(100, 'lessons', { ev: ev.id });
  });

  /* ---------- Planung nach einem Eingriff der Weltregie ---------- */
  /* Erste Reaktion unmittelbar nach dem Eingriff */
  const NOW = {
    crash: ['Panikverkäufe an allen Börsen', 'trendDown', -0.5], oilshock: ['Schlangen an den Tankstellen', 'drop', -0.4], boom: ['Aufbruchstimmung in {n}', 'trendUp', 0.4],
    techjump: ['Investoren stürmen nach {n}', 'atom', 0.4], tourism: ['Flüge nach {n} ausgebucht', 'plane', 0.3], bankrun: ['Lange Schlangen vor den Banken in {n}', 'bank', -0.5],
    harvest: ['Bauern in {n} feiern', 'wheat', 0.4], resource: ['Goldgräberstimmung in {n}', 'mountain', 0.3], debt: ['Ratingagenturen stufen {n} herab', 'bank', -0.5],
    cropfail: ['Brotpreise in {n} steigen', 'wheat', -0.4], blackout: ['{n} sitzt im Dunkeln', 'power', -0.4], election: ['Wahllokale in {n} öffnen', 'ballot', 0.1],
    reform: ['Opposition in {n} gespalten', 'scale', 0.1], statevisit: ['Jubelnde Menschen säumen die Straßen', 'flag', 0.4], borderopen: ['Erste Reisende überqueren die Grenze', 'route', 0.4],
    detente: ['Erleichterung in beiden Hauptstädten', 'hands', 0.4], freeze: ['Botschaften werden geräumt', 'snow', -0.4], trade: ['Häfen melden volle Auftragsbücher', 'ship', 0.3],
    summit: ['Bilder des Gipfels gehen um die Welt', 'camera', 0.4], worldcup: ['Fans aus aller Welt reisen an', 'medal', 0.5], cure: ['Kliniken in {n} atmen auf', 'syringe', 0.5],
    medbreak: ['Ärzte weltweit sprechen von einem Wunder', 'stethoscope', 0.5], rain: ['Kinder tanzen im Regen', 'rain', 0.5], aidwave: ['Hilfsflüge heben überall ab', 'plane', 0.5],
  };
  RX.onTool = function (id, tg) {
    if (!SIM.S) return;
    const d = Object.assign({ tool: id }, tg);
    const nw = NOW[id];
    if (nw) {
      const nid = tg.n !== undefined && tg.n >= 0 ? tg.n : -1;
      const c = nid >= 0 ? capOf(nid) : null;
      emit({ n: nid, icon: nw[1], tone: nw[2], text: nw[0].replace('{n}', nid >= 0 ? SIM.W.nations[nid].short : ''), lon: tg.lon !== undefined ? tg.lon : c ? c.lon : undefined, lat: tg.lat !== undefined ? tg.lat : c ? c.lat : undefined });
    }
    switch (id) {
      case 'crash': add(8, 'crashProtest', d); add(45, 'centralBanks', d); break;
      case 'oilshock': add(6, 'oilReact', d); break;
      case 'boom': add(25, 'boomFollow', d); break;
      case 'resource': add(20, 'resourceClaims', d); add(120, 'resourceScandal', d); break;
      case 'debt': case 'bankrun': add(12, 'debtProtest', d); add(40, 'bailout', d); break;
      case 'election': add(4, 'congrats', d); break;
      case 'freeze': add(5, 'sides', d); break;
      case 'detente': case 'statevisit': add(4, 'marketsUp', d); break;
      case 'worldcup': add(30, 'worldcupDone', d); break;
      case 'cure': case 'medbreak': add(3, 'relief', d); break;
    }
  };

  /* ---------- Abarbeitung ---------- */
  RX.daily = function () {
    const S = SIM.S;
    const list = q();
    if (!list.length) return;
    const due = list.filter(r => r.day <= S.day);
    if (!due.length) return;
    S.rq = list.filter(r => r.day > S.day);
    due.forEach(r => { try { run(r); } catch (e) { console.error(e); } });
  };

  function run(r) {
    const S = SIM.S, W = SIM.W;
    const ev = r.ev ? KY.events.byId(r.ev) : null;
    if (r.ev && !ev) return;
    const nid = ev ? ev.n : r.n;
    // Gleiche Reaktion im selben Staat nicht mehrfach kurz hintereinander
    S.rthr = S.rthr || {};
    const tk = r.k + ':' + nid, gap = { gov: 12, social: 6, markets: 8, mourn: 20, joy: 8, tourism: 30, rebuild: 40, lessons: 60, shelter: 20 }[r.k];
    if (gap && S.rthr[tk] !== undefined && S.day - S.rthr[tk] < gap) return;
    S.rthr[tk] = S.day;
    const n = nid >= 0 ? S.nations[nid] : null;
    const wn = nid >= 0 ? W.nations[nid] : null;
    const name = nid >= 0 ? wn.short : '';
    const kind = ev ? D.EVENTS[ev.type].n : '';
    const at = ev ? { lon: ev.lon, lat: ev.lat } : nid >= 0 ? { lon: capOf(nid).lon, lat: capOf(nid).lat } : {};
    switch (r.k) {
      case 'gov': {
        const q2 = n.stab / 100 * 0.55 + n.dev * 0.4 + Math.random() * 0.3 - ev.sev * 0.06;
        if (q2 > 0.5) {
          n.gov.approval = U.clamp(n.gov.approval + 3 + ev.sev, 0, 100);
          emit(Object.assign({ n: nid, icon: 'check', tone: 0.3, text: name + ': Regierung handelt schnell', h: U.pick(['Krisenmanagement gelobt: ' + n.gov.leader + ' reagiert besonnen auf ' + kind, name + ': Regierung ruft Ausnahmezustand aus und mobilisiert alle Kräfte', 'Schnelle Hilfe aus der Hauptstadt: ' + name + ' zeigt sich krisenfest']), heat: 16 }, at));
        } else {
          n.gov.approval = U.clamp(n.gov.approval - 3 - ev.sev * 2, 0, 100);
          SIM.shock(nid, 'unrest', ev.sev * 1.5, 120);
          emit(Object.assign({ n: nid, icon: 'megaphone', tone: -0.4, text: name + ': Wut auf die Regierung', h: U.pick(['Wut auf die Regierung: „Wo bleibt die Hilfe?“ – ' + name + ' nach ' + kind, n.gov.leader + ' unter Druck: Krisenstab wirkt überfordert', 'Opposition in ' + name + ' wirft Regierung Versagen vor']), heat: 20 }, at));
        }
        break;
      }
      case 'social': {
        const tag = '#' + U.pick(['WirSindBei', 'Gemeinsam', 'StarkFür', 'HilfeFür']) + name.replace(/\s+/g, '');
        for (let i = 0; i < 3 + Math.min(4, ev.sev); i++) KY.media.post(Math.random() < 0.5 ? 'grief' : 'relief', { n: nid, c: ev.c }, 20 + ev.sev * 10);
        S.social.unshift({ id: ++S.seq.post, day: S.day, handle: '@spendenaufruf', name: 'Spendenaufruf', text: 'Jede Hilfe zählt. ' + tag + ' – Notunterkünfte, Wasser und Decken werden gebraucht.', kind: 'relief', tone: 0.6, n: nid, likes: Math.round(20000 + Math.random() * 400000 * ev.sev), shares: Math.round(5000 + Math.random() * 90000), replies: Math.round(Math.random() * 9000) });
        emit(Object.assign({ n: nid, icon: 'heart', tone: 0.5, text: 'Solidaritätswelle im Netz: ' + tag }, at));
        break;
      }
      case 'help': {
        // Andere Staaten schicken Hilfe – Katastrophendiplomatie kann Gräben überwinden
        const cands = W.nations.filter(o => o.id !== nid).map(o => ({ o, R: SIM.rel(nid, o.id), nb: wn.neighbors.indexOf(o.id) >= 0 }))
          .map(x => Object.assign(x, { w: (x.nb ? 3 : 1) * (S.nations[x.o.id].dev + 0.3) * (x.R.v > -40 ? 1 : 0.35) * (Math.sqrt(x.o.pop) + 1) })).sort((a, b) => b.w - a.w);
        const k = Math.min(cands.length, ev.sev >= 4 ? 3 : ev.sev >= 3 ? 2 : 1);
        for (let i = 0; i < k; i++) {
          const x = cands[i];
          const foe = x.R.v < -40;
          SIM.relAdd(nid, x.o.id, foe ? 14 : 6, 'hilfe');
          ev.dead = Math.max(ev.deadNow, Math.round(ev.dead * 0.97));
          const t = foe ? 'Trotz Eiszeit: ' + x.o.short + ' schickt Hilfe nach ' + name : x.o.short + ' schickt Rettungsteams nach ' + name;
          emit(Object.assign({ n: nid, icon: 'boxes', tone: 0.5, text: t, h: foe ? t + ' – Gesten der Versöhnung' : t, heat: foe ? 24 : 12, v: { n: nid, n2: x.o.id } }, at));
        }
        break;
      }
      case 'markets': {
        const hit = Math.min(0.06, ev.dmg / 100 * 0.8 + ev.sev * 0.004);
        if (S.mkt) for (const id in S.mkt.idx) S.mkt.idx[id].v *= 1 - hit * (0.6 + Math.random() * 0.8);
        let com = null;
        if (['drought', 'locusts', 'heat'].indexOf(ev.type) >= 0) com = 2; // Weizen
        if (['storm', 'tsunami', 'flood'].indexOf(ev.type) >= 0) com = 0; // Rohöl
        if (com !== null && S.mkt && S.mkt.com[com]) S.mkt.com[com].v *= 1 + 0.04 * ev.sev;
        emit(Object.assign({ n: nid, icon: 'trendDown', tone: -0.2, text: 'Börsen reagieren: KX 500 ' + U.sgn(-hit * 100, 1, ' %') + (com !== null ? ' · ' + D.TICKER.commodities[com].n + ' teurer' : '') }, at));
        break;
      }
      case 'mourn': {
        SIM.shock(nid, 'happy', -2, 30);
        emit(Object.assign({ n: nid, icon: 'candle', tone: -0.3, text: 'Staatstrauer in ' + name, h: U.pick(['Staatstrauer in ' + name + ': Flaggen auf halbmast', name + ' gedenkt der Opfer: Schweigeminute im ganzen Land', 'Trauerfeier in ' + SIM.cName(ev.c) + ': Tausende nehmen Abschied']), heat: 18 }, at));
        break;
      }
      case 'shelter': {
        const nbs = wn.neighbors.filter(b => SIM.rel(nid, b).v > -60);
        const b = nbs.length ? U.pick(nbs) : -1;
        if (b >= 0) { SIM.shock(b, 'unrest', 1.5, 90); SIM.relAdd(nid, b, 3, 'aufnahme'); }
        emit(Object.assign({ n: nid, icon: 'tent', tone: -0.1, text: U.count(ev.displaced) + ' Menschen in Notunterkünften', h: b >= 0 ? 'Notunterkünfte: ' + W.nations[b].short + ' nimmt Obdachlose aus ' + name + ' auf' : 'Zeltstädte in ' + name + ': ' + U.count(ev.displaced) + ' Menschen ohne Dach', heat: 16 }, at));
        break;
      }
      case 'rebuild': {
        SIM.shock(nid, 'growth', 0.5, 300); SIM.shock(nid, 'unemp', -1, 300);
        emit(Object.assign({ n: nid, icon: 'crane', tone: 0.3, text: 'Wiederaufbau in ' + name + ' bringt Aufschwung', h: 'Kräne statt Trümmer: Wiederaufbau in ' + name + ' kommt voran', heat: 10 }, at));
        break;
      }
      case 'lessons': {
        emit(Object.assign({ n: nid, icon: 'shield', tone: 0.3, text: name + ' zieht Lehren: besserer Katastrophenschutz', h: 'Lehren aus der Katastrophe: ' + name + ' investiert in Frühwarnung und Schutz', heat: 10 }, at));
        break;
      }
      case 'joy': {
        for (let i = 0; i < 4; i++) KY.media.post('pos', { n: nid, c: ev.c }, 30);
        emit(Object.assign({ n: nid, icon: 'spark', tone: 0.6, text: name + ': Millionen bestaunen das Himmelsschauspiel' }, at));
        break;
      }
      case 'tourism': {
        n.gdp *= 1.001;
        emit(Object.assign({ n: nid, icon: 'plane', tone: 0.4, text: 'Touristenansturm in ' + name, h: 'Hotels ausgebucht: Schaulustige aus aller Welt reisen nach ' + name, heat: 10 }, at));
        break;
      }
      case 'crashProtest': {
        const poor = S.nations.map((m, id) => ({ id, u: m.unemp })).sort((a, b) => b.u - a.u).slice(0, 2);
        poor.forEach(p => { SIM.shock(p.id, 'unrest', 6, 120); const c = capOf(p.id); emit({ n: p.id, icon: 'megaphone', tone: -0.4, text: 'Proteste gegen Massenentlassungen in ' + W.nations[p.id].short, lon: c.lon, lat: c.lat, h: 'Nach dem Crash: Tausende protestieren in ' + c.name + ' gegen Entlassungen', heat: 18 }); });
        break;
      }
      case 'centralBanks': {
        S.g.market = (S.g.market || 0) * 0.5;
        emit({ icon: 'bank', tone: 0.3, text: 'Notenbanken senken die Zinsen', h: 'Gemeinsame Aktion: Notenbanken der Welt stemmen sich gegen die Krise', heat: 22 });
        break;
      }
      case 'oilReact': {
        const poor = S.nations.map((m, id) => ({ id, e: m.energy })).sort((a, b) => a.e - b.e).slice(0, 3);
        poor.forEach(p => { SIM.shock(p.id, 'happy', -3, 120); const c = capOf(p.id); emit({ n: p.id, icon: 'power', tone: -0.3, text: 'Spritpreise explodieren in ' + W.nations[p.id].short, lon: c.lon, lat: c.lat }); });
        break;
      }
      case 'boomFollow': emit(Object.assign({ n: nid, icon: 'users', tone: 0.3, text: 'Fachkräfte strömen nach ' + name, h: 'Goldgräberstimmung: Fachkräfte aus aller Welt zieht es nach ' + name, heat: 12 }, at)); break;
      case 'resourceClaims': {
        const nb = wn.neighbors[0];
        if (nb !== undefined) { SIM.relAdd(nid, nb, -8, 'rohstoffe'); emit(Object.assign({ n: nid, icon: 'flag', tone: -0.3, text: 'Streit um Rohstoffe mit ' + W.nations[nb].short, h: W.nations[nb].short + ' erhebt Ansprüche auf Rohstofffelder in ' + name, heat: 18, v: { n: nid, n2: nb } }, at)); }
        break;
      }
      case 'resourceScandal': {
        if (Math.random() < 0.5) { n.gov.approval = U.clamp(n.gov.approval - 10, 0, 100); emit(Object.assign({ n: nid, icon: 'eyeglass', tone: -0.4, text: 'Korruptionsskandal um Förderlizenzen', h: 'Förderlizenzen gegen Bargeld? Skandal erschüttert ' + name, heat: 20 }, at)); }
        break;
      }
      case 'debtProtest': SIM.shock(nid, 'unrest', 6, 120); emit(Object.assign({ n: nid, icon: 'megaphone', tone: -0.4, text: 'Sparpaket: Proteste in ' + name, h: 'Gegen das Sparpaket: Generalstreik legt ' + name + ' lahm', heat: 18 }, at)); break;
      case 'bailout': SIM.shock(nid, 'growth', 0.8, 300); emit(Object.assign({ n: nid, icon: 'bank', tone: 0.2, text: 'Rettungspaket für ' + name, h: 'Weltwährungsrat schnürt Rettungspaket für ' + name, heat: 16 }, at)); break;
      case 'congrats': {
        const nb = wn.neighbors.slice(0, 2);
        nb.forEach(b => SIM.relAdd(nid, b, 2, 'glueckwunsch'));
        emit(Object.assign({ n: nid, icon: 'hands', tone: 0.2, text: 'Glückwünsche an ' + n.gov.leader }, at));
        break;
      }
      case 'sides': {
        // Andere Staaten ergreifen Partei
        W.nations.forEach(o => {
          if (o.id === r.n || o.id === r.n2) return;
          const a = SIM.rel(o.id, r.n).v, b = SIM.rel(o.id, r.n2).v;
          if (Math.abs(a - b) < 15) return;
          SIM.relAdd(o.id, a > b ? r.n2 : r.n, -4, 'partei');
        });
        emit({ n: r.n, icon: 'scales', tone: -0.3, text: 'Die Welt ergreift Partei', lon: capOf(r.n).lon, lat: capOf(r.n).lat, h: 'Gespaltene Welt: Staaten stellen sich hinter ' + W.nations[r.n].short + ' oder ' + W.nations[r.n2].short, heat: 20 });
        break;
      }
      case 'marketsUp': if (S.mkt) for (const id in S.mkt.idx) S.mkt.idx[id].v *= 1.01; emit({ n: r.n, icon: 'trendUp', tone: 0.3, text: 'Börsen feiern die Annäherung', lon: capOf(r.n).lon, lat: capOf(r.n).lat }); break;
      case 'worldcupDone': emit({ n: r.n, icon: 'medal', tone: 0.5, text: 'Fußballfest geht zu Ende', lon: capOf(r.n).lon, lat: capOf(r.n).lat, h: 'Abschied mit Feuerwerk: Weltmeisterschaft in ' + W.nations[r.n].short + ' war ein Fest', heat: 14 }); break;
      case 'relief': emit({ n: r.n, icon: 'heart', tone: 0.5, text: 'Erleichterung in den Kliniken', lon: r.n >= 0 ? capOf(r.n).lon : undefined, lat: r.n >= 0 ? capOf(r.n).lat : undefined }); break;
    }
  }
})();
