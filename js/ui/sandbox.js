/* KYTHERA · MANDAT · Oberfläche für Weltregie (Sandbox) und Orbitale Leitstelle */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const ui = KY.ui, A = KY.A, P = KY.P;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const SB = () => KY.sandbox;
  ui.st.sev = 3;

  /* ================= WELTREGIE ================= */
  P.regie = {
    title: 'Weltregie', kicker: 'Sandbox · Sie lenken die Welt',
    sub: () => 'Werkzeug wählen, dann auf die Karte klicken. Es bleibt aktiv, bis Sie Esc drücken.',
    render() {
      const S = SIM.S, sb = S.sb;
      const sw = (k, l, sub) => `<div class="switch ${sb[k] ? 'on' : ''}" data-a="sbSet" data-k="${k}"><div><div style="font-weight:600">${l}</div>${sub ? '<div class="dim" style="font-size:12px">' + sub + '</div>' : ''}</div><div class="tg"></div></div>`;
      let h = `<div class="card goldb" style="margin-bottom:12px"><div class="row">${ic('globe', 20)}<div class="note" style="font-size:12.5px">In der Weltregie gibt es keine Genehmigungen und keine Regeln für Sie. Die Welt reagiert trotzdem: Regierungen, Medien und die Bevölkerung erleben alles als echte Ereignisse.</div></div></div>`;
      h += `<div class="og"><div class="ol">Stärke für Naturgewalten</div><div class="seg">${[1, 2, 3, 4, 5].map(v => `<button class="${ui.st.sev === v ? 'on' : ''}" data-a="sbSev" data-v="${v}">Stufe ${v}</button>`).join('')}</div></div>`;
      KY.sandbox.CATS.forEach(c => {
        h += `<div class="h3">${ic(c.icon, 13)} ${esc(c.n)}</div><div class="cats" style="margin-bottom:6px">`;
        KY.sandbox.TOOLS.filter(t => t.cat === c.id).forEach(t => {
          const on = ui.st.tool === t.id && KY.map.placing;
          h += `<button class="cat ${on ? 'on' : ''}" data-a="sbTool" data-v="${t.id}" title="${esc(t.text || '')}">${ic(t.icon, 18)}<span class="n">${esc(t.n)}</span><span class="dim" style="font-size:10.5px;line-height:1.3">${t.target === 'point' ? 'Ort' : t.target === 'nation' ? 'Staat' : t.target === 'two' ? 'Zwei Staaten' : 'Weltweit'}</span></button>`;
        });
        h += '</div>';
      });
      h += `<div class="h3">${ic('sliders', 13)} Schalter</div>${sw('money', 'Unbegrenztes Vermögen', 'Das Vermögen fällt nie unter ¤ 5 Bio.')}${sw('approve', 'Genehmigungen immer erteilt', 'Regierungen sagen zu allem Ja')}`;
      h += `<div class="note" style="margin-top:10px">Staatswerte ändern: Klicken Sie auf einen Staat. Im Inspektor erscheinen Regler für Zufriedenheit, Gesundheit, Pressefreiheit und mehr.</div>`;
      if (sb.log.length) h += `<div class="h3">Protokoll der Regie</div>` + sb.log.slice().reverse().slice(0, 14).map(l => `<div class="kv"><span>${esc(l.txt)}</span><span class="dim">${U.dateStr(l.day, true)}</span></div>`).join('');
      return h;
    },
  };
  A.sbSev = b => { ui.st.sev = +b.dataset.v; ui.renderPanel(true); if (KY.map.placing && ui.st.tool) hint(); };
  A.sbSet = b => { const S = SIM.S; S.sb[b.dataset.k] = !S.sb[b.dataset.k]; b.classList.toggle('on', S.sb[b.dataset.k]); ui.updateBar(); };
  A.sbTool = b => startTool(b.dataset.v);

  function hint(err, ok) {
    const t = KY.sandbox.TOOL[ui.st.tool];
    if (!t) return;
    const h = U.$('#placehint');
    const what = t.target === 'point' ? 'Klicken Sie auf einen Ort.' : t.target === 'nation' ? 'Klicken Sie auf einen Staat.' : 'Wählen Sie nacheinander zwei Staaten.';
    h.innerHTML = `<div class="ic-c" style="color:var(--gold2)">${ic(t.icon, 20)}</div><div class="t"><b>Weltregie · ${esc(t.n)}</b><div>${esc(what)}${ok ? ' <span class="good">' + esc(ok) + '</span>' : ''}</div>${err ? '<div class="err">' + esc(err) + '</div>' : ''}</div>${t.sev ? `<div class="seg">${[1, 2, 3, 4, 5].map(v => `<button class="${ui.st.sev === v ? 'on' : ''}" data-a="sbSev" data-v="${v}">${v}</button>`).join('')}</div>` : ''}<button class="btn sm ghost" data-a="cancelPlace">Fertig <span class="kbd">esc</span></button>`;
    h.classList.add('on');
  }
  function startTool(id) {
    const t = KY.sandbox.TOOL[id];
    if (!t) return;
    KY.order.cancel(true);
    ui.st.tool = id;
    const done = r => {
      if (!r.ok) { KY.audio.play('err'); hint(r.err); return; }
      KY.audio.play(t.cat === 'natur' ? 'deep' : 'ok');
      hint(null, r.msg);
      KY.map.dataChanged(1); KY.map.redraw(); ui.refresh();
    };
    if (t.target === 'global') {
      ui.confirm(t.n + ' auslösen?', esc(t.text || ''), 'Auslösen').then(ok => { if (ok) { const r = KY.sandbox.apply(id, {}, ui.st.sev); ui.toast({ t: r.ok ? t.n : 'Nicht möglich', d: r.ok ? r.msg : r.err, icon: t.icon, kind: r.ok ? 'warn' : 'crit' }); ui.refresh(); } });
      return;
    }
    const pl = { kind: t.target === 'point' ? 'point' : t.target === 'nation' ? 'nation' : 'two' };
    pl.onClick = (h, x, y) => {
      const ll = KY.map.toLonLat(x, y);
      const nid = h.type === 'nation' ? h.id : h.type === 'city' ? SIM.W.cities[h.id].nation : KY.geo.nationAt(ll.lon, ll.lat);
      if (t.target === 'point') done(KY.sandbox.apply(id, { lon: ll.lon, lat: ll.lat }, ui.st.sev));
      else if (t.target === 'nation') { if (nid < 0) { hint('Dort liegt kein Staat.'); return; } done(KY.sandbox.apply(id, { n: nid }, ui.st.sev)); }
      else {
        if (nid < 0) return;
        if (pl.first < 0) { pl.first = nid; hint(null, 'Erster Staat: ' + SIM.nName(nid)); }
        else if (nid !== pl.first) { done(KY.sandbox.apply(id, { n: pl.first, n2: nid }, ui.st.sev)); pl.first = -1; }
      }
    };
    KY.map.place(pl);
    document.body.classList.add('placing');
    hint();
    ui.renderPanel(true);
  }

  /* Regler im Staatsinspektor */
  const baseNation = KY.INS.nation;
  KY.INS.nation = function (id) {
    const out = baseNation(id);
    if (!out || !KY.sandbox.on()) return out;
    const n = SIM.S.nations[id];
    const val = E => E.gov ? n.gov[E.k] : E.op ? n.op : n[E.k];
    const rows = KY.sandbox.EDIT.map(E => {
      const v = Math.round(val(E));
      return `<div class="b" style="grid-template-columns:150px 1fr 40px"><span>${esc(E.n)}</span><input type="range" min="${E.op ? -100 : 0}" max="100" value="${v}" data-sbedit="${E.k}" data-n="${id}" style="width:100%;accent-color:#c9a24f"><span>${v}</span></div>`;
    }).join('');
    out.body = `<div class="card goldb" style="margin-bottom:12px"><div class="lbl" style="margin-bottom:6px">${ic('sliders', 12)} Weltregie · Werte ändern</div><div class="bars">${rows}</div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn xs" data-a="sbQuick" data-v="election" data-n="${id}">${ic('ballot', 12)} Neuwahl</button><button class="btn xs" data-a="sbQuick" data-v="boom" data-n="${id}">${ic('trendUp', 12)} Boom</button><button class="btn xs" data-a="sbQuick" data-v="resource" data-n="${id}">${ic('mountain', 12)} Rohstofffund</button><button class="btn xs" data-a="sbQuick" data-v="epidemic" data-n="${id}">${ic('virus', 12)} Epidemie</button></div></div>` + out.body;
    return out;
  };
  A.sbQuick = b => {
    const r = KY.sandbox.apply(b.dataset.v, { n: +b.dataset.n }, ui.st.sev);
    ui.toast({ t: r.ok ? 'Weltregie' : 'Nicht möglich', d: r.ok ? r.msg : r.err, icon: 'globe', kind: r.ok ? '' : 'warn' });
    ui.renderInsp(true); KY.map.dataChanged(1);
  };
  document.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.sbedit) return;
    KY.sandbox.setValue(+el.dataset.n, el.dataset.sbedit, el.value);
    if (el.nextElementSibling) el.nextElementSibling.textContent = el.value;
    KY.map.invalidate(); ui.updateBar();
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset && el.dataset.sbedit && el.nextElementSibling) el.nextElementSibling.textContent = el.value;
  });

  /* ================= ORBITALE LEITSTELLE ================= */
  ui.st.mission = { rocket: 'mittel', type: 'wetter', count: 4, site: null, safe: true };
  P.orbit = {
    title: 'Orbitale Leitstelle', kicker: 'Raumfahrt · Satelliten', wide: true,
    sub: () => { const st = KY.orbit.state(); return st.sats.length + ' Satelliten im Orbit · ' + st.launches + ' Starts'; },
    onOpen() { if (KY.map.layer !== 'orbit') { ui.st.prevLayer = KY.map.layer; KY.map.setLayer('orbit'); } },
    onClose() { if (ui.st.prevLayer && KY.map.layer === 'orbit') KY.map.setLayer(ui.st.prevLayer); ui.st.prevLayer = null; },
    render() {
      const S = SIM.S, st = KY.orbit.state();
      const M = ui.st.mission;
      const sites = KY.orbit.sites();
      if (!M.site || !sites.some(s => s.id === M.site)) M.site = sites[0] ? sites[0].id : null;
      const q = KY.orbit.quote(M);
      const cnt = t => KY.orbit.count(t);
      const mods = KY.orbit.stationModules();
      let h = `<div class="grid4">
        <div class="stat"><div class="k">Satelliten</div><div class="v">${st.sats.length}</div><div class="s">${Object.keys(D.SATS).filter(t => cnt(t)).map(t => cnt(t) + ' ' + ({ wetter: 'Wetter', beob: 'Beobachtung', komm: 'Internet', navi: 'Navigation', wiss: 'Teleskop', modul: 'Station' })[t]).join(' · ') || 'noch keine'}</div></div>
        <div class="stat"><div class="k">Internet aus dem All</div><div class="v">${U.pct(KY.orbit.coverage() * 100, 0)}</div><div class="s">der Weltbevölkerung</div></div>
        <div class="stat"><div class="k">Frühwarnung</div><div class="v ${S.g.orbitWarn ? 'good' : ''}">${S.g.orbitWarn ? 'aktiv' : 'aus'}</div><div class="s">Opfer −${Math.round((S.g.orbitMit || 0) * 100)} %</div></div>
        <div class="stat"><div class="k">Weltraumschrott</div><div class="v ${st.debris > 40 ? 'bad' : st.debris > 15 ? 'warnc' : ''}">${Math.round(st.debris)} %</div><div class="s">${st.fails} Fehlstarts</div></div></div>
        <div class="row" style="gap:8px;margin:12px 0;flex-wrap:wrap"><button class="btn sm" data-a="layer" data-v="orbit">${ic('sat', 14)} Umlaufbahnen auf der Karte</button><button class="btn sm" data-a="orbitImg">${ic('camera', 14)} Wetterbild anfordern</button><button class="btn sm" data-a="orbitClean" ${st.debris < 5 ? 'disabled' : ''}>${ic('refresh', 14)} Aufräummission · ¤ 1,5 Mrd.</button>${mods ? `<span class="chip ${mods >= 3 ? 'green' : 'gold'}">${ic('sat', 12)} Raumstation ${mods >= 3 ? 'bewohnt' : mods + ' von 3 Modulen'}</span>` : ''}</div>`;
      h += `<div class="grid2" style="gap:18px;align-items:start"><div>`;
      h += `<div class="h3">${ic('rocket', 13)} Neue Mission</div><div class="og"><div class="ol">Trägerrakete</div><div class="choices">${D.ROCKETS.map(r => { const lock = r.tech && !S.res.done[r.tech]; return `<button class="choice ${M.rocket === r.id ? 'on' : ''}" data-a="msSet" data-k="rocket" data-v="${r.id}" ${lock ? 'style="opacity:.5"' : ''}><div class="l">${esc(r.n)} ${lock ? ic('lock', 11) : ''}</div><div class="n">${esc(r.kind)} · bis ${r.cap} Satelliten · ${U.pct(r.ok * 100, 1)} Erfolg</div></button>`; }).join('')}</div></div>`;
      h += `<div class="og"><div class="ol">Nutzlast</div><div class="choices">${Object.keys(D.SATS).map(t => `<button class="choice ${M.type === t ? 'on' : ''}" data-a="msSet" data-k="type" data-v="${t}"><div class="l">${ic(D.SATS[t].icon, 13)} ${esc(D.SATS[t].n)}</div><div class="n">${esc(D.SATS[t].text)}</div></button>`).join('')}</div></div>`;
      if (!D.SATS[M.type].station) h += `<div class="og"><div class="ol">Anzahl</div><div class="row" style="gap:8px"><button class="iconbtn" data-a="msCnt" data-v="-1">${ic('minus', 16)}</button><b style="font-size:18px;min-width:30px;text-align:center">${q.n}</b><button class="iconbtn" data-a="msCnt" data-v="1">${ic('plus', 16)}</button><span class="dim" style="font-size:12px">höchstens ${q.R ? q.R.cap : 1}</span></div></div>`;
      h += `<div class="og"><div class="ol">Startplatz</div><div class="choices">${sites.map(s => `<button class="choice ${M.site === s.id ? 'on' : ''}" data-a="msSet" data-k="site" data-v="${s.id}"><div class="l">${esc(s.n)}</div><div class="n">${s.own ? 'Ihr eigener Raumhafen' : '50 % Aufschlag, Bilder gehen an den Gaststaat'}</div></button>`).join('')}</div>${sites.every(s => !s.own) ? '<div class="note" style="margin-top:6px">Mit einem eigenen Raumhafen (Handeln → Wissenschaft) starten Sie günstiger.</div>' : ''}</div>`;
      h += `<div class="switch ${M.safe ? 'on' : ''}" data-a="msSafe"><div><div style="font-weight:600">Kontrollierter Absturz am Lebensende</div><div class="dim" style="font-size:12px">+20 % Kosten für die Nutzlast, hinterlässt keinen Schrott</div></div><div class="tg"></div></div>`;
      h += `<div class="card" style="margin-top:12px"><div class="row sb"><div><div class="lbl">Kosten</div><div class="bigsum">${U.money(q.cost)}</div></div><div style="text-align:right"><div class="lbl">Erfolgschance</div><b style="font-size:18px">${U.pct(q.ok * 100, 1)}</b><div class="dim" style="font-size:12px">Start in ${q.days} Tagen</div></div></div>${q.errs.map(e => `<div class="errbox" style="margin-top:8px">${ic('x', 14)}<div>${esc(e)}</div></div>`).join('')}<button class="btn primary block hold" id="ms-go" style="margin-top:10px" ${q.valid ? '' : 'disabled'}><span class="fill"></span><span>${ic('rocket', 15)} Start anordnen</span></button></div>`;
      h += `</div><div>`;
      const plan = st.missions.filter(m => m.status === 'geplant');
      h += `<div class="h3">${ic('clock', 13)} Countdown<span class="r dim">${plan.length}</span></div>` + (plan.length ? plan.map(m => `<div class="kv"><span>${ic('rocket', 12)} ${esc(D.ROCKET[m.rocket].n)} · ${m.n} × ${esc(D.SATS[m.type].n)}</span><span class="warnc">T−${m.launch - S.day} Tage</span></div>`).join('') : '<div class="dim" style="font-size:12px">Kein Start geplant.</div>');
      const done = st.missions.filter(m => m.status !== 'geplant').sort((a, b) => b.launch - a.launch).slice(0, 8);
      if (done.length) h += `<div class="h3">Letzte Starts</div>` + done.map(m => `<div class="kv"><span>${U.dateStr(m.launch, true)} · ${esc(D.ROCKET[m.rocket].n)} · ${m.n} × ${esc(D.SATS[m.type].n)}</span><span class="${m.status === 'erfolg' ? 'good' : 'bad'}">${m.status === 'erfolg' ? 'Erfolg' : 'Fehlstart'}</span></div>`).join('');
      h += `<div class="h3">${ic('sat', 13)} Flotte</div>`;
      if (!st.sats.length) h += '<div class="empty">Noch ist der Himmel leer. Ihr erster Start bringt die Flotte in die Umlaufbahn.</div>';
      else h += '<table class="tbl"><tr><th>Name</th><th>Typ</th><th class="r">Bahnneigung</th><th class="r">Restlaufzeit</th></tr>' + st.sats.slice().sort((a, b) => a.until - b.until).slice(0, 40).map(s => `<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${D.SATS[s.type].col};margin-right:6px"></span>${esc(s.name)}</td><td>${esc(D.SATS[s.type].n)}</td><td class="r">${Math.round(s.inc)}°</td><td class="r">${U.days(s.until - S.day)}</td></tr>`).join('') + '</table>';
      h += `</div></div>`;
      return h;
    },
    after(body) {
      const go = U.$('#ms-go', body);
      if (go && !go.disabled) KY.crisis.holdBtn(go, () => {
        const r = KY.orbit.plan(ui.st.mission);
        if (!r.ok) { ui.toast({ t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'warn' }); return; }
        KY.audio.play('grant');
        ui.toast({ t: 'Mission angeordnet', d: D.ROCKET[r.m.rocket].n + ' · Start am ' + U.dateStr(r.m.launch, true), icon: 'rocket', kind: 'good' });
        ui.renderPanel(true);
      });
    },
  };
  A.msSet = b => { ui.st.mission[b.dataset.k] = b.dataset.v; if (b.dataset.k === 'rocket') ui.st.mission.count = Math.min(ui.st.mission.count, D.ROCKET[b.dataset.v].cap); ui.renderPanel(true); };
  A.msCnt = b => { const M = ui.st.mission; M.count = U.clamp((M.count || 1) + +b.dataset.v, 1, D.ROCKET[M.rocket].cap); ui.renderPanel(true); };
  A.msSafe = () => { ui.st.mission.safe = !ui.st.mission.safe; ui.renderPanel(true); };
  A.orbitClean = () => { const r = KY.orbit.cleanup(); ui.toast(r.ok ? { t: 'Aufräummission gestartet', d: 'Der Trümmergürtel schrumpft.', icon: 'refresh', kind: 'good' } : { t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'warn' }); ui.renderPanel(true); };

  /* Wetterbild: Aufnahme von Wolken, Stürmen und Bränden unter einem Satelliten */
  A.orbitImg = function () {
    const S = SIM.S, st = KY.orbit.state();
    const sats = st.sats.filter(s => s.type === 'wetter' || s.type === 'beob');
    if (!sats.length) { ui.toast({ t: 'Kein passender Satellit', d: 'Wetter- oder Erdbeobachtungssatelliten liefern Bilder.', icon: 'sat', kind: 'warn' }); return; }
    const ev = KY.events.active()[0];
    const s = U.pick(sats);
    const p = KY.map.satPos(s);
    const lon = ev ? ev.lon : p.lon, lat = ev ? ev.lat : p.lat;
    const cv = KY.map.snapshot(lon, lat, 720, 405, ev ? 180 : 320);
    const g = cv.getContext('2d');
    // Wolkendecke
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 720, y = Math.random() * 405, r = 20 + Math.random() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,' + (0.18 + Math.random() * 0.25) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (ev) {
      g.strokeStyle = 'rgba(255,120,80,0.95)'; g.lineWidth = 2; g.setLineDash([6, 4]);
      g.beginPath(); g.arc(360, 202, 46, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.font = '700 14px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(ev.name.toUpperCase(), 418, 196);
    }
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 720, 26);
    g.font = '600 12px IBM Plex Mono, monospace'; g.fillStyle = '#9fe0ff';
    g.fillText(s.name + ' · ' + D.SATS[s.type].n.toUpperCase() + ' · ' + U.dateStr(S.day, true) + ' · ' + U.n(Math.abs(lat), 1) + '° ' + (lat >= 0 ? 'N' : 'S') + ' ' + U.n(Math.abs(lon), 1) + '° ' + (lon >= 0 ? 'O' : 'W'), 10, 17);
    ui.modal({ cls: 'w900', html: `<div class="mh"><div class="tt"><div class="lbl">Orbitale Leitstelle · Aufnahme</div><h2>${esc(ev ? ev.name : 'Wetterlage unter ' + s.name)}</h2></div><button class="iconbtn" data-a="mclose">${ic('close', 18)}</button></div><div class="mb"><img src="${cv.toDataURL('image/jpeg', 0.88)}" style="width:100%;border-radius:8px;display:block" alt="Satellitenbild"></div>` });
  };
})();
