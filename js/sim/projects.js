/* KYTHERA · MANDAT · Vorhabenmotor: Standortprüfung, Angebot, Genehmigung, Bau, Betrieb, Wirkung */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, G = KY.geo;
  const SIM = KY.sim;
  const P = (KY.projects = {});

  P.RISK_K = 1.8; // Grundhäufigkeit von Vorfällen
  P.PHASES = { antrag: 'Genehmigungsverfahren', bau: 'Im Bau', laufend: 'Läuft', betrieb: 'In Betrieb', abgeschlossen: 'Abgeschlossen', abgelehnt: 'Abgelehnt', pausiert: 'Ruht', stillgelegt: 'Stillgelegt', aufgegeben: 'Aufgegeben', uebergeben: 'An den Staat übergeben' };
  P.ACTIVE = { antrag: 1, bau: 1, laufend: 1, betrieb: 1, pausiert: 1 };
  const AUTO_KEYS = ['cost', 'days', 'risk', 'protest', 'vis', 'approve'];

  P.typeName = p => D.ACT[p.act].name;
  P.byId = id => SIM.S.projects.find(p => p.id === id);
  P.active = () => SIM.S.projects.filter(p => P.ACTIVE[p.phase]);
  P.isBuild = A => !A.instant && !A.program;

  /* ---------- Optionen ---------- */
  P.optionGroups = function (A) {
    const out = [];
    (A.opts || []).forEach(g => out.push(Object.assign({ own: true }, g, { id: g.id || 'size' })));
    (A.common || []).forEach(k => out.push(Object.assign({ id: k, common: true }, D.COMMON[k])));
    return out;
  };
  P.defaults = function (A) {
    const o = {};
    P.optionGroups(A).forEach(g => { o[g.id] = g.def; });
    return o;
  };
  function choice(A, gid, v) {
    const g = P.optionGroups(A).find(x => x.id === gid);
    return g ? g.choices.find(c => c.v === v) || g.choices[0] : null;
  }
  P.choice = choice;
  function mult(A, o, key) {
    let m = 1;
    P.optionGroups(A).forEach(g => {
      if (g.own && A.ownOpts) return;
      const c = choice(A, g.id, o[g.id]);
      if (c && typeof c[key] === 'number' && AUTO_KEYS.indexOf(key) >= 0) m *= c[key];
    });
    return m;
  }
  function fxScale(A, o) {
    if (A.ownOpts) return 1;
    let m = 1;
    (A.opts || []).forEach(g => { const c = choice(A, g.id || 'size', o[g.id || 'size']); if (c && typeof c.fx === 'number') m *= c.fx; });
    return m;
  }

  /* ---------- Kontext eines Vorhabens ---------- */
  function natCtx(nid) {
    const n = SIM.S.nations[nid], w = SIM.W.nations[nid];
    return { id: nid, pop: n.pop, gdp: n.gdp, dev: n.dev, name: w.short, corrupt: n.corrupt };
  }
  function cityCtx(cid) {
    const c = SIM.W.cities[cid], s = SIM.S.cities[cid];
    return Object.assign({}, c, { pop: s.pop });
  }
  P.ctx = function (A, pl, o) {
    const S = SIM.S, W = SIM.W;
    const x = { o, A, pl, errs: [], warns: [], n: null, c: null, c2: null, nid: -1, n2id: -1, cid: -1, c2id: -1, km: 0, seaKm: 0, area: 0, gw: 0, sun: 1, windQ: 1, demand: 50, biome: 0, sea: false, downstream: null, downId: -1, popDensity: 0.5, displaced: 0, smallBoost: 1, devN: 0.5, rate: 4, chance: 0.5, ev: null, lon: 0, lat: 0 };
    x.optv = (g, k) => { const c = choice(A, g, o[g]); return c ? c[k] : undefined; };
    const err = t => x.errs.push(t);
    const setCity = cid => { x.cid = cid; x.c = cityCtx(cid); x.nid = x.c.nation; x.lon = x.c.lon; x.lat = x.c.lat; };
    const nearestCityIn = (nid, lon, lat) => { const r = G.nearestCity(lon, lat, c => c.nation === nid) || G.nearestCity(lon, lat); return r ? r.city.id : -1; };
    pl = pl || {};
    switch (A.place) {
      case 'city': case 'city-big': case 'city-coast':
        if (pl.c === undefined || pl.c < 0) { err('Wählen Sie eine Stadt.'); break; }
        setCity(pl.c);
        if (A.place === 'city-big' && x.c.pop < 1.2) err(x.c.name + ' ist zu klein (mindestens 1,2 Mio. Einwohner).');
        if (A.place === 'city-coast' && !x.c.coastal) err(x.c.name + ' liegt nicht an der Küste.');
        break;
      case 'nation':
        if (pl.n === undefined || pl.n < 0) { err('Wählen Sie einen Staat.'); break; }
        x.nid = pl.n; setCity(W.nations[pl.n].capital); x.nid = pl.n;
        break;
      case 'two-nations':
        if (pl.n === undefined || pl.n < 0 || pl.n2 === undefined || pl.n2 < 0) { err('Wählen Sie zwei Staaten.'); break; }
        if (pl.n === pl.n2) { err('Wählen Sie zwei verschiedene Staaten.'); break; }
        x.nid = pl.n; x.n2id = pl.n2; setCity(W.nations[pl.n].capital); x.c2id = W.nations[pl.n2].capital; x.c2 = cityCtx(x.c2id); x.nid = pl.n;
        break;
      case 'land': case 'land-or-sea': case 'land-high': case 'land-water': case 'coast-equator': case 'river': {
        if (pl.lon === undefined) { err('Wählen Sie einen Standort auf der Karte.'); break; }
        x.lon = pl.lon; x.lat = pl.lat;
        const k = G.cell(pl.lon, pl.lat);
        x.cell = k; x.biome = W.biome[k];
        const land = W.elev[k] > 0;
        if (A.place === 'river') {
          const rv = G.riverNear(pl.lon, pl.lat);
          if (!rv || rv.flow < 3) { err('Hier fließt kein ausreichend großer Fluss.'); break; }
          if (W.elev[rv.k] < 40) { err('Zu nah an der Mündung: Ein Staudamm braucht ein Tal.'); break; }
          x.cell = rv.k; [x.lon, x.lat] = G.cellLonLat(rv.k);
          x.nid = rv.nation; x.flow = rv.flow;
          if (rv.down >= 0) { x.downId = rv.down; x.downstream = W.nations[rv.down].short; }
          x.popDensity = U.clamp(W.hab[rv.k] || 0.4, 0.1, 1.6);
        } else if (!land) {
          if (A.place !== 'land-or-sea') { err('Der Standort muss an Land liegen.'); break; }
          if (G.seaDist[k] > 3 || G.seaNat[k] < 0) { err('Zu weit vor der Küste: Offshore-Anlagen höchstens rund 180 km vor der Küste.'); break; }
          x.sea = true; x.nid = G.seaNat[k];
        } else {
          x.nid = W.nation[k];
          if (x.nid < 0 || x.biome === 2 || x.biome === 12) { err('Auf Eis und Gletschern kann nicht gebaut werden.'); break; }
          if (A.place === 'land-high' && W.elev[k] < 700 && x.biome !== 11) err('Geothermie braucht vulkanisches oder gebirgiges Gelände (über 700 m).');
          if (A.place === 'land-water' && W.coastDist[k] > 2 && !G.riverNear(pl.lon, pl.lat)) err('Ein Kraftwerk braucht Kühlwasser: Wählen Sie einen Ort an der Küste oder einem Fluss.');
          if (A.place === 'coast-equator') {
            if (Math.abs(x.lat) > 16) err('Ein Raumhafen muss nahe dem Äquator liegen (höchstens 16° Breite).');
            if (W.coastDist[k] > 2) err('Ein Raumhafen braucht eine Küste für sichere Startkorridore.');
          }
        }
        if (x.nid < 0) { err('Dieses Gebiet gehört zu keinem Staat.'); break; }
        x.cid = nearestCityIn(x.nid, x.lon, x.lat); x.c = cityCtx(x.cid);
        x.sun = Math.min(1.3, G.sun(x.cell) * (A.id === 'SOLAR' ? SIM.techFx('solarMult') : 1)); x.windQ = G.wind(x.cell, x.sea);
        break;
      }
      case 'line-land': case 'line-sea': case 'line-sea-long': {
        if (pl.c === undefined || pl.c2 === undefined) { err('Wählen Sie zwei Städte.'); break; }
        if (pl.c === pl.c2) { err('Wählen Sie zwei verschiedene Städte.'); break; }
        setCity(pl.c); x.c2id = pl.c2; x.c2 = cityCtx(pl.c2); x.n2id = x.c2.nation;
        const rt = G.route(x.c, x.c2);
        x.route = rt; x.km = Math.round(rt.km); x.seaKm = Math.round(rt.seaKm);
        x.lon2 = x.c2.lon; x.lat2 = x.c2.lat;
        if (A.place === 'line-land') {
          if (rt.landFrac < 0.92 || rt.maxSeaKm > 40) err('Die Trasse würde über das Meer führen. Für Meerengen gibt es die Meeresquerung.');
          if (A.minKm && x.km < A.minKm) err('Die Städte liegen zu nah beieinander (mindestens ' + A.minKm + ' km).');
          if (A.maxKm && x.km > A.maxKm) err('Zu lang: höchstens ' + U.n(A.maxKm) + ' km.');
        } else if (A.place === 'line-sea') {
          if (!x.c.coastal || !x.c2.coastal) err('Beide Städte müssen an der Küste liegen.');
          if (rt.seaKm < 4) err('Zwischen den Städten liegt kein Meer.');
          if (rt.maxSeaKm > A.maxSea) err('Die Meerenge ist zu breit: höchstens ' + A.maxSea + ' km offenes Wasser (hier ' + Math.round(rt.maxSeaKm) + ' km).');
          if (x.km > 900) err('Die Städte liegen zu weit auseinander.');
          x.seaKm = Math.round(rt.maxSeaKm + (rt.seaKm - rt.maxSeaKm) * 0.5);
        } else {
          if (!x.c.coastal || !x.c2.coastal) err('Beide Städte müssen an der Küste liegen.');
          if (A.minKm && x.km < A.minKm) err('Zu kurz für ein Seekabel (mindestens ' + A.minKm + ' km).');
          if (A.maxKm && x.km > A.maxKm) err('Zu lang: höchstens ' + U.n(A.maxKm) + ' km.');
          x.km = Math.round(x.km * 1.18);
        }
        break;
      }
      case 'area-land': case 'area-sea': case 'area-desert': {
        if (pl.lon0 === undefined) { err('Ziehen Sie ein Gebiet auf der Karte auf.'); break; }
        const ar = G.area(pl.lon0, pl.lat0, pl.lon1, pl.lat1);
        x.ar = ar; x.lon = ar.lonMid; x.lat = ar.latMid;
        if (A.place === 'area-sea') {
          x.area = Math.round(ar.sea);
          x.nid = ar.seaNation;
          if (x.area < 3000) err('Das Gebiet enthält zu wenig Meeresfläche (mindestens 3.000 km²).');
          if (x.nid < 0) err('Ein Schutzgebiet muss vor der Küste eines Staates liegen.');
          if (x.area > 400000) err('Zu groß: höchstens 400.000 km².');
        } else {
          const bad = (ar.biomes[2] || 0) + (ar.biomes[12] || 0) + (ar.biomes[11] || 0);
          x.nid = ar.nation;
          if (A.place === 'area-desert') {
            x.area = Math.round(ar.biomes[7] || 0);
            if (x.area < 2000 || x.area < ar.land * 0.4) err('Das Gebiet muss überwiegend Wüste sein.');
            if (x.area > 250000) err('Zu groß: höchstens 250.000 km² Wüstenrand.');
          } else {
            x.area = Math.round(ar.land - bad - (ar.biomes[7] || 0) * 0.85);
            if (x.area < 1500) err('Zu wenig geeignetes Land (mindestens 1.500 km²). In Wüsten, Hochgebirge und Eis wachsen keine Wälder.');
            if (x.area > 300000) err('Zu groß: höchstens 300.000 km².');
          }
          if (x.nid < 0) err('Das Gebiet liegt in keinem Staat.');
        }
        if (x.nid >= 0) { x.cid = nearestCityIn(x.nid, x.lon, x.lat); x.c = cityCtx(x.cid); }
        break;
      }
      case 'event': {
        const ev = pl.ev !== undefined ? S.events.find(e => e.id === pl.ev) : null;
        if (!ev) { err('Wählen Sie eine laufende Katastrophe.'); break; }
        x.ev = ev; x.nid = ev.n; if (ev.c >= 0) setCity(ev.c); x.nid = ev.n; x.lon = ev.lon; x.lat = ev.lat;
        if (ev.phase === 'vorbei') err('Diese Katastrophe ist vorüber.');
        break;
      }
      case 'global': case 'front':
        x.global = true;
        break;
    }
    if (x.nid >= 0) {
      x.n = natCtx(x.nid);
      const sn = S.nations[x.nid];
      x.demand = Math.max(4, sn.pop * (0.4 + sn.dev * 2.2));
      x.devN = sn.dev;
      x.smallBoost = U.clamp(Math.sqrt(30 / Math.max(1, sn.pop)), 0.45, 2.4);
      x.rate = U.clamp(2 + (1 - sn.dev) * 6 + (100 - sn.stab) / 30 + Math.max(0, sn.debt - 80) / 25 + (sn.crisis && sn.crisis.k === 'debt' ? 4 : 0), 1.5, 16);
    }
    if (x.n2id >= 0) x.n2 = natCtx(x.n2id);
    // Voraussetzungen
    if (A.requiresTech && !(S.g.unlock && S.g.unlock[A.id])) err('Erfordert das Forschungsprogramm „' + (D.TECH_BY[A.requiresTech] || {}).n + '“.');
    if (A.requiresSite && !S.projects.some(p => p.act === A.requiresSite && p.phase === 'betrieb')) err('Erfordert einen betriebsbereiten Raumhafen.');
    if (A.where && !x.errs.length) { const w = A.where(x); if (w) err(w); }
    return x;
  };

  /* ---------- Angebot (alles, was der Vorhabenbogen anzeigt) ---------- */
  P.quote = function (actId, pl, oIn) {
    const S = SIM.S;
    const A = D.ACT[actId];
    const o = Object.assign(P.defaults(A), oIn || {});
    const x = P.ctx(A, pl, o);
    const q = { A, o, x, ok: false, errs: x.errs, warns: x.warns, principles: [] };
    if (x.errs.length) return q;
    try {
      if (A.gw) x.gw = A.gw(x);
      if (A.displaced) x.displaced = A.displaced(x);
      if (A.diplo) x.chance = P.diploChance(A.diplo, x);
      const techCost = (A.id === 'HGUE' ? SIM.techFx('hgueCost') : 1) * (A.id === 'WOHNEN' ? SIM.techFx('housingCost') : 1);
      q.cost = Math.max(0.005, (A.cost ? A.cost(x) : 0) * mult(A, o, 'cost') * techCost);
      q.days = Math.max(1, Math.round((A.days ? A.days(x) : 1) * mult(A, o, 'days') * (A.id === 'WOHNEN' && SIM.techFx('housingCost') < 1 ? 0.7 : 1)));
      if (A.relief && SIM.contract('envoy') === 'okonkwo') q.days = Math.max(1, Math.round(q.days * 0.6));
      q.vis = (A.vis || 0) * mult(A, o, 'vis');
      q.describe = A.describe ? A.describe(x) : [A.short];
      q.income = A.income ? A.income(x) * fxScale(A, o) : 0;
      q.upkeep = A.upkeep ? A.upkeep(x) : 0;
      q.displaced = x.displaced || 0;
      q.approval = !!A.approval;
      q.chance = A.approval ? P.approvalChance(A, x, o) : 100;
      q.risks = (A.risks || []).filter(r => r.p > 0).map(r => {
        const pm = r.p * P.RISK_K * P.riskMult(A, o, r.id, x);
        return { id: r.id, n: (D.INCIDENTS[r.id] || {}).n || r.id, phase: r.phase, pm, sev: r.sev, py: 1 - Math.pow(1 - pm, 12) };
      });
      q.oppose = A.oppose || 0;
      const fearG = S.g.fear[A.id] || 0, fearL = x.nid >= 0 ? (S.nations[x.nid].fear[A.id] || 0) : 0;
      q.protestRisk = U.clamp(q.oppose * mult(A, o, 'protest') * (1 + fearL * 1.5 + fearG * 0.6) * (1 + q.displaced / 60000), 0, 1);
      q.fear = fearL + fearG * 0.5;
      q.traceGain = KY.cover.traceGain(A, o, x, null, q.vis);
      if (x.downstream) q.warns.push('Flussabwärts liegt ' + x.downstream + '. Die Beziehungen werden leiden.');
      if (q.fear > 0.3) q.warns.push('Nach früheren Vorfällen ist die Bevölkerung gegenüber diesem Vorhabentyp misstrauisch.');
      if (x.nid >= 0 && S.nations[x.nid].dep > 2.5) q.warns.push('In ' + x.n.name + ' wächst die Sorge vor Abhängigkeit von ausländischem Geld.');
      if (S.g.auflagen && S.day < S.g.auflagen.until && S.g.auflagen.kind === 'safety' && o.safety && o.safety !== 'max') q.errs.push('Auflage des Kuratoriums: Bis auf Weiteres nur mit höchstem Sicherheitsstandard.');
      q.principles = P.principleConflicts(A, o, q);
      // Krisenhilfe nur einmal je Katastrophe
      if (A.relief && x.ev && x.ev.helped && x.ev.helped[A.id]) q.errs.push('Diese Hilfe wurde für diese Katastrophe bereits angeordnet.');
      if (A.id === 'TARN_GESICHT' && S.g.face) q.errs.push('Sie haben bereits ein öffentliches Gesicht.');
      q.ok = !q.errs.length;
      if (q.cost > S.fin.cash) { q.warns.push('Die liquiden Mittel reichen derzeit nicht für die volle Summe.'); if (A.instant || A.relief) { q.errs.push('Nicht genügend liquide Mittel.'); q.ok = false; } }
    } catch (e) {
      console.error(e);
      q.errs.push('Interner Fehler bei der Berechnung.');
    }
    return q;
  };

  P.riskMult = function (A, o, rid, x) {
    let m = mult(A, o, 'risk');
    if (rid === 'batteriebrand' || (A.id === 'FIRMA' && o.sector === 'battery' && rid === 'industrieunfall')) m *= SIM.techFx('batteryRisk');
    if (rid === 'stoerfall') m *= SIM.techFx('nuclearRisk');
    if (rid === 'einsturz' || rid === 'dammbruch' || rid === 'deichbruch' || rid === 'baumaengel') m *= SIM.techFx('structRisk');
    if (rid === 'korruption' && x && x.nid >= 0) m *= SIM.S.nations[x.nid].corrupt / 45 * (choice(A, 'partner', o.partner) || { corrupt: 1 }).corrupt / (choice(A, 'safety', o.safety) || { risk: 1 }).risk;
    if (rid === 'verdraengung' || rid === 'streik') m /= (choice(A, 'safety', o.safety) || { risk: 1 }).risk;
    if (rid === 'kostenexplosion') m /= (choice(A, 'safety', o.safety) || { risk: 1 }).risk;
    const r = (A.risks || []).find(z => z.id === rid);
    if (r && r.scale && x) m *= r.scale(x);
    return m;
  };

  P.approvalChance = function (A, x, o) {
    const S = SIM.S, n = S.nations[x.nid];
    const part = choice(A, 'part', o.part) || { protest: 1 };
    const partner = choice(A, 'partner', o.partner) || { approve: 0 };
    let c = 53 + n.access * 0.36 + (n.gov.openness - 50) * 0.42 + n.op * 0.2 + (partner.approve || 0) + mult(A, o, 'approve') * 0 -
      (A.oppose || 0) * 26 * (part.protest || 1) - ((S.g.fear[A.id] || 0) * 0.5 + (n.fear[A.id] || 0)) * 30;
    if (SIM.contract('trustee') === 'mensah' && n.dev < 0.5) c += 10;
    if (n.gov.lean === 'pop') c -= (A.vis || 3) * 1.6;
    if ((n.dep || 0) > 2.5) c -= (n.dep - 2.5) * 4;
    if (['society', 'relief', 'nature'].indexOf(A.cat) >= 0) c += 9;
    if (A.cat === 'energy' && n.energy < 45) c += 8;
    if (S.g.exposed) c += n.op * 0.12;
    if (x.downId >= 0) c -= 4;
    return Math.round(U.clamp(c, 4, 96));
  };

  P.diploChance = function (kind, x) {
    const S = SIM.S;
    const envoy = SIM.contract('envoy');
    if (kind === 'summit') {
      const avg = U.avg(Object.values(S.rel).map(r => r.v));
      const acc = U.avg(S.nations.map(n => n.access));
      return U.clamp(0.28 + avg / 250 + acc / 220 + (envoy === 'vidal' ? 0.08 : 0) - (S.g.lastSummit && S.day - S.g.lastSummit < 1100 ? 0.25 : 0), 0.05, 0.9);
    }
    const a = S.nations[x.nid], b = S.nations[x.n2id];
    const R = SIM.rel(x.nid, x.n2id);
    let c = kind === 'mediate' ? 0.22 : 0.32;
    c += (a.access + b.access) / 400 + (R.v + 100) / 700;
    if (kind === 'mediate' && envoy === 'vidal') c += 0.15;
    if (kind === 'trade' && envoy === 'takeda') c += 0.15;
    if (a.gov.lean === 'pop' || b.gov.lean === 'pop') c -= 0.1;
    if (kind === 'trade' && R.v < -60) c -= 0.25;
    if (kind === 'mediate' && R.v > -20) c -= 0.1;
    if (R.lastTry && S.day - R.lastTry < 180) c -= 0.15;
    return U.clamp(c, 0.04, 0.92);
  };

  P.principleConflicts = function (A, o, q) {
    const out = [];
    const has = SIM.hasPrinciple;
    if (has('nuclear') && A.id === 'KERN') out.push({ id: 'nuclear', n: 'Verzicht auf Kernkraft' });
    if (has('participation') && o.part === 'none' && (A.vis || 0) >= 4) out.push({ id: 'participation', n: 'Keine Großprojekte ohne Bürgerbeteiligung' });
    if (has('displace') && q.displaced > 0 && o.part !== 'codet') out.push({ id: 'displace', n: 'Keine Umsiedlungen ohne Mitbestimmung der Betroffenen' });
    if (has('local') && o.partner === 'intl') out.push({ id: 'local', n: 'Vorrang für lokale Partner' });
    if (has('safety') && o.safety === 'min') out.push({ id: 'safety', n: 'Niemals Mindeststandard bei der Sicherheit' });
    return out;
  };

  /* ---------- Anordnen ---------- */
  P.order = function (q, frontId) {
    const S = SIM.S;
    if (!q.ok) return { ok: false, err: q.errs[0] };
    const A = q.A, x = q.x;
    const front = S.fronts.find(f => f.id === frontId) || S.fronts.find(f => !f.exposed) || S.fronts[0];
    const p = {
      id: 'p' + (++S.seq.proj), act: A.id, cat: A.cat, n: x.nid, n2: x.n2id, c: x.cid, c2: x.c2id, down: x.downId,
      lon: x.lon, lat: x.lat, lon2: x.lon2, lat2: x.lat2, area: x.pl && x.pl.lon0 !== undefined ? { lon0: x.pl.lon0, lat0: x.pl.lat0, lon1: x.pl.lon1, lat1: x.pl.lat1 } : null,
      ev: x.ev ? x.ev.id : null, o: Object.assign({}, q.o), front: front ? front.id : null,
      cost: q.cost, paid: 0, days: q.days, prog: 0, phase: 'antrag', start: S.day, decideAt: -1, chance: q.chance, approvedAt: -1, doneAt: -1, pauseUntil: -1,
      vis: q.vis, income: q.income, upkeep: q.upkeep, displaced: q.displaced, gw: x.gw || 0, km: x.km, seaKm: x.seaKm, areaKm: x.area, sun: x.sun, windQ: x.windQ,
      demand: x.demand, rate: x.rate, dchance: x.chance, retrofit: false, scale: 1, incidents: [], acc: {}, cond: null, name: '', mods: null, bil: null, protest: false,
      fxs: fxScale(A, q.o), breaks: q.principles.map(b => b.id), stall: 0,
    };
    p.name = P.displayName(p);
    S.projects.push(p);
    if (front) front.projects.push(p.id);
    // Grundsatzbrüche
    q.principles.forEach(b => KY.incidents.principleBreak(b, p));
    // Tarnung
    KY.cover.onOrder(p, q);
    // Genehmigung oder sofortiger Start
    if (A.approval) {
      p.decideAt = S.day + Math.round(20 + Math.random() * 45 + (A.vis || 3) * 3);
      SIM.chron('vorhaben', 'Antrag gestellt: ' + p.name + ' (Genehmigungsaussicht ' + p.chance + ' %).', { proj: p.id });
    } else {
      P.begin(p);
    }
    const n = x.nid >= 0 ? S.nations[x.nid] : null;
    if (n && (A.vis || 0) >= 3) {
      SIM.opImpulse(x.nid, D.REACT[A.id] || 0.2, (q.vis || 1) * 0.22 / (1 + (n.habit[A.id] || 0) * 0.3), { aware: q.vis * 0.5 });
      announce(p, 'start');
    }
    KY.bus.emit('order', p);
    return { ok: true, p };
  };

  P.displayName = function (p) {
    const A = D.ACT[p.act];
    const cn = id => SIM.cName(id), nn = id => SIM.nName(id);
    switch (A.place) {
      case 'line-land': case 'line-sea': case 'line-sea-long': return A.name + ' ' + cn(p.c) + ' – ' + cn(p.c2);
      case 'two-nations': return A.name + ': ' + nn(p.n) + ' und ' + nn(p.n2);
      case 'nation': return A.name + ' ' + nn(p.n);
      case 'area-land': case 'area-sea': case 'area-desert': return A.name + ' in ' + nn(p.n);
      case 'event': { const ev = SIM.S.events.find(e => e.id === p.ev); return A.name + (ev ? ': ' + ev.name : ''); }
      case 'global': case 'front': return A.name;
      case 'land': case 'land-or-sea': case 'land-high': case 'land-water': case 'river': case 'coast-equator': return A.name + ' bei ' + cn(p.c);
      default: return A.name + ' ' + cn(p.c);
    }
  };

  function announce(p, kind) {
    const A = D.ACT[p.act];
    const arr = A.news && A.news[kind];
    const v = { n: p.n, n2: p.n2, c: p.c, c2: p.c2, extra: { proj: A.name, front: frontName(p) } };
    const react = D.REACT[A.id];
    const tone = react ? U.avg(react) : 0.2;
    if (arr && arr.length) KY.media.story(null, v, { h: U.pick(arr), tone, heat: 6 + (p.vis || 1) * 3.5, about: true, proj: p.id, key: 'project_' + kind });
    else KY.media.story(kind === 'start' ? 'project_start' : 'project_done', v, { tone, heat: 5 + (p.vis || 1) * 3, about: true, proj: p.id });
  }
  function frontName(p) { const f = SIM.S.fronts.find(z => z.id === p.front); return f ? f.name : 'ein Investor'; }
  P.frontName = frontName;

  /* Beginn von Bau oder Programm */
  P.begin = function (p) {
    const S = SIM.S, A = D.ACT[p.act];
    p.approvedAt = S.day;
    if (A.instant) {
      KY.finance.spend(p.cost, p.name); p.paid = p.cost;
      p.phase = 'laufend';
    } else {
      const down = p.cost * 0.15;
      KY.finance.spend(down, p.name); p.paid = down;
      p.phase = A.program ? 'laufend' : 'bau';
    }
    if (p.n >= 0) {
      S.nations[p.n].access = U.clamp(S.nations[p.n].access + (A.vis || 1) * 0.6, 0, 100);
      S.nations[p.n].investM = (S.nations[p.n].investM || 0) + p.paid;
    }
    if (A.program && !A.gradual) activate(p);
    if (p.displaced > 0 && p.n >= 0) {
      const k = p.o.part === 'codet' ? 0.3 : 1;
      SIM.opImpulse(p.n, [-0.2, -0.1, -1, -0.3, -0.5], Math.min(7, p.displaced / 18000) * k, { aware: 3 });
      if (p.c >= 0) S.cities[p.c].sent = U.clamp(S.cities[p.c].sent - Math.min(20, p.displaced / 6000) * k, -100, 100);
      SIM.chron('vorhaben', 'Für ' + p.name + ' müssen etwa ' + U.count(p.displaced) + ' Menschen umgesiedelt werden.', { proj: p.id });
    }
    SIM.chron('vorhaben', (A.instant ? 'Angeordnet: ' : A.program ? 'Programm gestartet: ' : 'Baubeginn: ') + p.name + '.', { proj: p.id });
    KY.bus.emit('begin', p);
  };

  /* Wirkung einschalten */
  function activate(p) {
    if (p.mods) return;
    const A = D.ACT[p.act];
    if (!A.mods) { p.mods = {}; return; }
    const x = P.liteCtx(p);
    p.mods = A.mods(x) || {};
    p.scale = p.fxs * (A.gradual ? 0 : 1);
    if (!A.gradual) SIM.applyMods(p, p.mods, 1);
  }
  function deactivate(p) {
    if (!p.mods) return;
    SIM.applyMods(p, p.mods, -1);
    p.mods = null;
  }
  P.activate = activate; P.deactivate = deactivate;

  /* Leichter Kontext aus einem gespeicherten Vorhaben (für Wirkungsfunktionen) */
  P.liteCtx = function (p) {
    const S = SIM.S, A = D.ACT[p.act];
    const x = {
      o: p.o, A, nid: p.n, n2id: p.n2, cid: p.c, c2id: p.c2, km: p.km, seaKm: p.seaKm, area: p.areaKm, gw: p.gw, sun: p.sun, windQ: p.windQ,
      demand: p.demand, displaced: p.displaced, rate: p.rate, chance: p.dchance, devN: p.n >= 0 ? S.nations[p.n].dev : 0.5,
      smallBoost: p.n >= 0 ? U.clamp(Math.sqrt(30 / Math.max(1, S.nations[p.n].pop)), 0.45, 2.4) : 1, sea: false, biome: 0,
    };
    x.optv = (g, k) => { const c = choice(A, g, p.o[g]); return c ? c[k] : undefined; };
    if (p.n >= 0) x.n = natCtx(p.n);
    if (p.c >= 0) x.c = cityCtx(p.c);
    if (p.c2 >= 0) x.c2 = cityCtx(p.c2);
    if (p.ev) x.ev = S.events.find(e => e.id === p.ev) || { sev: 2 };
    return x;
  };

  /* ---------- Täglicher Ablauf ---------- */
  P.daily = function () {
    const S = SIM.S;
    for (const p of S.projects) {
      if (!P.ACTIVE[p.phase]) continue;
      const A = D.ACT[p.act];
      if (p.phase === 'pausiert') {
        if (S.day >= p.pauseUntil) { p.phase = p.prePause || 'betrieb'; if (p.phase === 'betrieb' || (p.phase === 'laufend' && !A.gradual)) activate(p); SIM.chron('vorhaben', p.name + ' nimmt den Betrieb wieder auf.', { proj: p.id }); }
        continue;
      }
      if (p.phase === 'antrag') { if (S.day >= p.decideAt) decide(p); continue; }
      if (p.phase === 'bau' || p.phase === 'laufend') progress(p, A);
      else if (p.phase === 'betrieb') operate(p, A);
      // Risiken
      rollRisks(p, A);
    }
  };

  function blocked(p) {
    if (p.c < 0) return false;
    const c = SIM.S.cities[p.c];
    return c.protest && c.protest.proj === p.id && c.protest.stage >= 3;
  }

  function progress(p, A) {
    const S = SIM.S;
    if (blocked(p)) { p.stall++; p.cost += p.cost * 0.0004; return; }
    const step = 1 / p.days;
    if (!A.instant) {
      const pay = (p.cost - p.cost * 0.15) * step;
      if (S.fin.cash < pay) { p.stall++; if (p.stall % 30 === 1) SIM.msg('trustee', 'Finanzierung stockt: ' + p.name, ['Die liquiden Mittel reichen nicht für die laufenden Zahlungen. Der Bau ruht, bis wieder Mittel verfügbar sind.'], { kind: 'warn', ref: { proj: p.id } }); return; }
      KY.finance.spend(pay, null, true);
      p.paid += pay;
      if (p.n >= 0) S.nations[p.n].investM = (S.nations[p.n].investM || 0) + pay;
    }
    p.prog = Math.min(1, p.prog + step);
    if (A.program && A.gradual && p.mods === null) activate(p);
    if (A.program && A.gradual && p.mods) {
      const target = p.fxs * p.prog;
      const d = target - p.scale;
      if (d > 0.001) { const s0 = p.scale; p.scale = d; SIM.applyMods(p, p.mods, 1); p.scale = s0 + d; }
    }
    if (A.program || p.phase === 'laufend') yearly(p, A, A.gradual ? p.prog : 1);
    if (p.prog >= 1) complete(p, A);
  }

  function operate(p, A) {
    const S = SIM.S;
    if (p.income) KY.finance.income(p.income / 365);
    if (p.upkeep) KY.finance.spend(p.upkeep / 365, null, true);
    yearly(p, A, 1);
    if (p.bond && p.bond.amount > 0) KY.finance.income(p.bond.amount * p.bond.rate / 100 / 365);
    if (p.afterUntil && S.day >= p.afterUntil) {
      deactivate(p); p.phase = 'abgeschlossen'; p.afterUntil = 0;
      SIM.chron('vorhaben', 'Die Wirkung von ' + p.name + ' ist verklungen.', { proj: p.id });
    }
  }

  function yearly(p, A, k) {
    if (!A.yearly) return;
    const S = SIM.S;
    if (!p.yv) p.yv = A.yearly(P.liteCtx(p));
    for (const key in p.yv) {
      let v = p.yv[key] * k / 365;
      if (key === 'lives' && A.id === 'KLINIK') v *= SIM.techFx('healthBoost');
      if (key === 'lives' && A.id === 'WASSER') v *= SIM.techFx('waterBoost');
      p.acc[key] = (p.acc[key] || 0) + v;
      S.g[key] = (S.g[key] || 0) + v;
    }
  }

  function decide(p) {
    const S = SIM.S, A = D.ACT[p.act], n = S.nations[p.n];
    const chance = P.approvalChance(A, P.liteCtx(p), p.o);
    p.chance = chance;
    const roll = Math.random() * 100;
    if (roll < chance) {
      if (roll > chance - 14 && Math.random() < 0.6) {
        const kind = U.pick(['cost', 'part', 'local']);
        if (kind === 'cost') { p.cost *= 1.08; p.cond = 'Auflage: zusätzliche Umweltprüfungen und Ausgleichsmaßnahmen (+8 % Kosten).'; }
        else if (kind === 'part' && p.o.part !== undefined && p.o.part !== 'codet') { p.o.part = 'hear'; p.days = Math.round(p.days * 1.08); p.cond = 'Auflage: verpflichtende öffentliche Anhörungen (+8 % Bauzeit).'; }
        else { p.cost *= 1.04; p.cond = 'Auflage: 40 % der Aufträge an heimische Firmen (+4 % Kosten).'; }
        KY.media.story('approval_cond', { n: p.n, extra: { proj: A.name } }, { tone: 0.1, heat: 8 + p.vis * 2, about: true, proj: p.id });
        SIM.chron('vorhaben', 'Genehmigt mit Auflagen: ' + p.name + '. ' + p.cond, { proj: p.id });
      } else {
        if ((p.vis || 0) >= 5) KY.media.story('approval_ok', { n: p.n, extra: { proj: A.name } }, { tone: 0.2, heat: 6 + p.vis * 2, about: true, proj: p.id });
        SIM.chron('vorhaben', 'Genehmigt: ' + p.name + '.', { proj: p.id });
      }
      n.govBonus = (n.govBonus || 0) + (A.vis || 2) * 0.4;
      P.begin(p);
      KY.bus.emit('approved', p);
    } else {
      p.phase = 'abgelehnt';
      p.rejectedAt = S.day;
      KY.media.story('approval_denied', { n: p.n, extra: { proj: A.name } }, { tone: -0.1, heat: 8 + p.vis * 2, about: true, proj: p.id });
      SIM.chron('vorhaben', 'Abgelehnt: ' + p.name + ' (Aussicht war ' + chance + ' %).', { proj: p.id });
      SIM.msg('envoy', 'Antrag abgelehnt: ' + p.name, ['Die Regierung von ' + SIM.nName(p.n) + ' hat den Antrag abgelehnt. Offiziell wegen „offener Fragen zur Trägerschaft“.', 'Mit mehr Zugang zur Regierung, Bürgerbeteiligung oder einem staatlichen Partner steigen die Chancen. Ein neuer Antrag ist in 120 Tagen möglich.'], { kind: 'warn', ref: { proj: p.id } });
      KY.bus.emit('rejected', p);
    }
  }

  P.resubmit = function (p) {
    const S = SIM.S;
    if (p.phase !== 'abgelehnt' || S.day - p.rejectedAt < 120) return false;
    p.phase = 'antrag'; p.decideAt = S.day + 30 + Math.round(Math.random() * 30);
    SIM.chron('vorhaben', 'Neuer Antrag: ' + p.name + '.', { proj: p.id });
    return true;
  };

  function complete(p, A) {
    const S = SIM.S;
    p.doneAt = S.day; p.prog = 1;
    if (A.diplo) { finishDiplo(p, A); return; }
    if (A.relief) { KY.events.relief(p); p.phase = 'abgeschlossen'; return; }
    if (A.cover) { KY.cover.finish(p); p.phase = 'abgeschlossen'; return; }
    if (A.bond) {
      p.bond = { amount: +p.o.amount, rate: p.rate };
      if (p.n >= 0) S.nations[p.n].access = U.clamp(S.nations[p.n].access + A.access(P.liteCtx(p)), 0, 100);
      activate(p); p.phase = 'betrieb';
      SIM.chron('finanzen', 'Anleihen von ' + SIM.nName(p.n) + ' gezeichnet: ' + U.money(p.bond.amount) + ' zu ' + U.n(p.rate, 1) + ' %.', { proj: p.id });
      return;
    }
    if (A.global) {
      const gfx = A.global(P.liteCtx(p));
      if (gfx.warn) S.g.warn = 1;
      if (gfx.tech) S.g.globalTech = (S.g.globalTech || 0) + gfx.tech;
      if (gfx.growth) S.nations.forEach(n => { n.fx.growth = (n.fx.growth || 0) + gfx.growth; });
    }
    if (A.program) {
      if (A.afterglow) { if (!p.mods) activate(p); p.afterUntil = S.day + A.afterglow; p.phase = 'betrieb'; }
      else {
        const keep = A.lasting === undefined ? 1 : A.lasting;
        if (keep < 1 && p.mods) { SIM.applyMods(p, p.mods, -1); p.scale = p.scale * keep; SIM.applyMods(p, p.mods, 1); }
        p.phase = 'abgeschlossen';
      }
    } else {
      activate(p);
      p.phase = 'betrieb';
      // Einrichtungen der Stadt
      const cm = p.mods && p.mods.city;
      if (cm && p.c >= 0) ['port', 'airport', 'metro', 'hospital', 'uni', 'flood'].forEach(k => { if (cm[k]) S.cities[p.c].fac[k] = (S.cities[p.c].fac[k] || 0) + 1; });
    }
    p.bil = A.bilanz ? A.bilanz(P.liteCtx(p)) : {};
    const n = p.n >= 0 ? S.nations[p.n] : null;
    if (n) {
      n.access = U.clamp(n.access + (A.vis || 1) * 1.1, 0, 100);
      const habit = n.habit[A.id] || 0;
      SIM.opImpulse(p.n, D.REACT[A.id] || 0.3, (1.4 + (p.vis || 1) * 0.4) / (1 + habit * 0.35), { aware: (p.vis || 1) * 0.9 });
      n.habit[A.id] = habit + 1;
      if (p.n2 >= 0 && p.n2 !== p.n) SIM.opImpulse(p.n2, D.REACT[A.id] || 0.3, 1 + (p.vis || 1) * 0.3, { aware: (p.vis || 1) * 0.6 });
      if (p.c >= 0) S.cities[p.c].sent = U.clamp(S.cities[p.c].sent + 6 + U.avg(D.REACT[A.id] || [0.3]) * 10, -100, 100);
      n.govBonus = (n.govBonus || 0) + (A.vis || 2) * 0.6;
    }
    if ((p.vis || 0) >= 1) announce(p, 'done');
    SIM.chron('vorhaben', (A.program ? 'Abgeschlossen: ' : 'Fertiggestellt: ') + p.name + '.', { proj: p.id });
    KY.bus.emit('complete', p);
  }

  function finishDiplo(p, A) {
    const S = SIM.S;
    const ok = Math.random() < p.dchance;
    p.phase = 'abgeschlossen'; p.result = ok ? 'erfolg' : 'fehlschlag';
    if (A.diplo === 'summit') {
      S.g.lastSummit = S.day;
      if (ok) {
        S.g.summit = (S.g.summit || 0) + 3;
        for (const k in S.rel) SIM.relAdd(+k.split(':')[0], +k.split(':')[1], 5, 'gipfel');
        S.nations.forEach((n, id) => SIM.opImpulse(id, D.REACT.GIPFEL, 0.8, { aware: 2 }));
        KY.media.story('summit_ok', { c: p.c }, { tone: 0.6, heat: 60, about: true, proj: p.id, global: true });
        SIM.chron('diplomatie', 'Weltklimagipfel in ' + SIM.cName(p.c) + ' erfolgreich: Alle Staaten verpflichten sich zu saubererer Energie.', { proj: p.id });
        SIM.g_trust(5);
      } else {
        KY.media.story('summit_fail', { c: p.c }, { tone: -0.3, heat: 40, about: true, proj: p.id, global: true });
        SIM.chron('diplomatie', 'Weltklimagipfel in ' + SIM.cName(p.c) + ' ohne Einigung.', { proj: p.id });
      }
      return;
    }
    const R = SIM.rel(p.n, p.n2);
    R.lastTry = S.day;
    const a = S.nations[p.n], b = S.nations[p.n2];
    if (ok) {
      if (A.diplo === 'mediate') {
        const dv = 22 + Math.random() * 24;
        SIM.relAdd(p.n, p.n2, dv, 'vermittlung'); R.base = Math.max(R.base, R.v - 10);
        KY.media.story('mediation_ok', { n: p.n, n2: p.n2 }, { tone: 0.5, heat: 30, about: false });
        SIM.chron('diplomatie', 'Vermittlung erfolgreich: ' + SIM.nName(p.n) + ' und ' + SIM.nName(p.n2) + ' nähern sich an (+' + Math.round(dv) + ').', { proj: p.id });
        SIM.g_trust(4);
        S.g.peace = (S.g.peace || 0) + 1;
      } else {
        SIM.relAdd(p.n, p.n2, 12, 'handel'); R.trade = true;
        a.fx.growth = (a.fx.growth || 0) + 0.15; b.fx.growth = (b.fx.growth || 0) + 0.15;
        SIM.opImpulse(p.n, D.REACT.HANDEL, 0.6); SIM.opImpulse(p.n2, D.REACT.HANDEL, 0.6);
        KY.media.story('trade_deal', { n: p.n, n2: p.n2 }, { tone: 0.3, heat: 20 });
        SIM.chron('diplomatie', 'Handelsabkommen zwischen ' + SIM.nName(p.n) + ' und ' + SIM.nName(p.n2) + ' unterzeichnet.', { proj: p.id });
      }
      a.access = U.clamp(a.access + 8, 0, 100); b.access = U.clamp(b.access + 8, 0, 100);
      SIM.msg('envoy', (A.diplo === 'mediate' ? 'Vermittlung gelungen' : 'Abkommen unterzeichnet') + ': ' + SIM.nName(p.n) + ' und ' + SIM.nName(p.n2), ['Beide Delegationen haben unterschrieben. Ihr Name fiel kein einziges Mal.', 'Die Regierungen wissen allerdings, wem sie den Tisch zu verdanken haben. Unser Zugang ist gewachsen.'], { kind: 'info', ref: { proj: p.id } });
    } else {
      SIM.relAdd(p.n, p.n2, -4, 'fehlschlag');
      if (A.diplo === 'mediate') KY.media.story('mediation_fail', { n: p.n, n2: p.n2 }, { tone: -0.2, heat: 16 });
      SIM.chron('diplomatie', (A.diplo === 'mediate' ? 'Vermittlung' : 'Handelsgespräche') + ' zwischen ' + SIM.nName(p.n) + ' und ' + SIM.nName(p.n2) + ' gescheitert.', { proj: p.id });
      SIM.msg('envoy', 'Gespräche gescheitert: ' + SIM.nName(p.n) + ' und ' + SIM.nName(p.n2), ['Die Positionen lagen zu weit auseinander. Ein neuer Versuch ist frühestens in einigen Monaten sinnvoll.'], { kind: 'warn', ref: { proj: p.id } });
    }
  }

  function rollRisks(p, A) {
    if (!A.risks || !A.risks.length) return;
    const ph = p.phase === 'betrieb' ? 'betrieb' : 'bau';
    if (p.phase === 'laufend' && !A.program && !A.instant) return;
    for (const r of A.risks) {
      if (r.p <= 0 || r.phase !== ph) continue;
      if (ph === 'bau' && blocked(p)) continue;
      const pm = r.p * P.RISK_K * P.riskMult(A, p.o, r.id, P.liteCtx(p)) * (p.retrofit ? 0.35 : 1);
      if (Math.random() < pm / 30) { KY.incidents.create(p, r); break; }
    }
  }

  /* ---------- Eingriffe der Mandatsperson ---------- */
  P.pause = function (p, days) {
    if (!P.ACTIVE[p.phase] || p.phase === 'pausiert' || p.phase === 'antrag') return false;
    p.prePause = p.phase; p.phase = 'pausiert'; p.pauseUntil = SIM.S.day + (days || 90);
    if (p.prePause === 'betrieb' || p.prePause === 'laufend') deactivate(p);
    SIM.chron('vorhaben', p.name + ' ruht für ' + U.days(days || 90) + '.', { proj: p.id });
    return true;
  };
  P.shutdown = function (p, why) {
    if (!P.ACTIVE[p.phase]) return false;
    deactivate(p);
    const wasAntrag = p.phase === 'antrag';
    p.phase = wasAntrag ? 'aufgegeben' : 'stillgelegt';
    p.endedAt = SIM.S.day;
    const S = SIM.S;
    if (p.c >= 0 && S.cities[p.c].protest && S.cities[p.c].protest.proj === p.id) KY.nations.endProtest(S.cities[p.c], 'gone');
    SIM.chron('vorhaben', (wasAntrag ? 'Antrag zurückgezogen: ' : 'Stillgelegt: ') + p.name + (why ? ' (' + why + ')' : '') + '.', { proj: p.id });
    KY.bus.emit('shutdown', p);
    return true;
  };
  P.handover = function (p) {
    if (p.phase !== 'betrieb') return false;
    const S = SIM.S;
    p.phase = 'uebergeben'; p.endedAt = S.day; p.income = 0;
    // Wirkung bleibt bestehen, Verantwortung geht über
    if (p.n >= 0) { S.nations[p.n].access = U.clamp(S.nations[p.n].access + 6, 0, 100); SIM.opImpulse(p.n, 0.3, 1.2); }
    SIM.g_trust(1);
    SIM.chron('vorhaben', p.name + ' wurde an den Staat ' + SIM.nName(p.n) + ' übergeben.', { proj: p.id });
    return true;
  };
  P.retrofit = function (p) {
    if (p.retrofit || !P.ACTIVE[p.phase]) return { ok: false };
    const cost = Math.max(0.01, p.cost * 0.08);
    if (SIM.S.fin.cash < cost) return { ok: false, err: 'Nicht genügend liquide Mittel.' };
    KY.finance.spend(cost, 'Nachrüstung ' + p.name);
    p.retrofit = true; p.cost += cost;
    SIM.chron('vorhaben', p.name + ' wird sicherheitstechnisch nachgerüstet.', { proj: p.id });
    return { ok: true, cost };
  };

  /* Anleihen fallen bei Staatsschuldenkrise teilweise aus */
  P.bondDefault = function (nid) {
    const S = SIM.S;
    S.projects.filter(p => p.bond && p.n === nid && p.phase === 'betrieb').forEach(p => {
      const cut = 0.3 + Math.random() * 0.4;
      const loss = p.bond.amount * cut;
      p.bond.amount -= loss;
      KY.incidents.create(p, { id: 'zahlungsausfall', sev: [2, 3] }, { loss });
    });
  };

  /* Bilanz aller laufenden Vorhaben */
  P.totals = function () {
    const S = SIM.S;
    const t = { jobs: 0, co2: 0, power: 0, homes: 0, trees: 0, sea: 0, income: 0, upkeep: 0, invested: 0, count: 0, building: 0 };
    S.projects.forEach(p => {
      if (p.paid) t.invested += p.paid;
      if (p.phase === 'bau' || p.phase === 'antrag' || (p.phase === 'laufend')) t.building++;
      if (p.phase !== 'betrieb' && p.phase !== 'abgeschlossen' && p.phase !== 'uebergeben') return;
      t.count++;
      const b = p.bil || {};
      t.jobs += b.jobs || 0; t.co2 += b.co2 || 0; t.power += b.power || 0; t.homes += b.homes || 0; t.trees += b.trees || 0; t.sea += b.sea || 0;
      if (p.phase === 'betrieb') { t.income += (p.income || 0) + (p.bond ? p.bond.amount * p.bond.rate / 100 : 0); t.upkeep += p.upkeep || 0; }
    });
    return t;
  };
})();
