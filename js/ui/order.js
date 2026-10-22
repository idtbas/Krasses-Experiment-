/* KYTHERA · MANDAT · Anordnen: Standortwahl auf der Karte und Vorhabenbogen */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const ui = KY.ui;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const O = (KY.order = {});
  const P = () => KY.projects;

  const KIND = { 'city': 'city', 'city-big': 'city', 'city-coast': 'city', 'nation': 'nation', 'two-nations': 'two', 'land': 'point', 'land-or-sea': 'point', 'land-high': 'point', 'land-water': 'point', 'river': 'point', 'coast-equator': 'point', 'line-land': 'line', 'line-sea': 'line', 'line-sea-long': 'line', 'area-land': 'area', 'area-sea': 'area', 'area-desert': 'area', 'event': 'event', 'global': 'none', 'front': 'front' };
  const HINT = {
    city: 'Klicken Sie auf eine hervorgehobene Stadt.', nation: 'Klicken Sie auf einen Staat.', two: 'Wählen Sie nacheinander zwei Staaten.',
    point: 'Klicken Sie auf einen geeigneten Standort.', line: 'Wählen Sie die erste Stadt, dann die zweite.', area: 'Halten Sie das Trackpad gedrückt und ziehen Sie ein Gebiet auf.', event: 'Klicken Sie auf eine laufende Katastrophe.',
  };

  O.start = function (actId, preset) {
    const A = D.ACT[actId];
    if (!A) return;
    if (A.research) { ui.panel('forschung', { keep: true }); return; }
    if (A.place === 'front') { O.newFrontDialog(); return; }
    O.cancel(true);
    const kind = KIND[A.place];
    if (preset && Object.keys(preset).length) { O.sheet(actId, preset); return; }
    if (kind === 'none') { O.sheet(actId, {}); return; }
    if (kind === 'event' && !KY.events.active().length) { ui.toast({ t: 'Keine laufende Katastrophe', d: 'Krisenhilfe ist nur bei akuten Ereignissen möglich.', icon: 'info' }); return; }
    // Voraussetzungen vorab prüfen
    const pre = P().ctx(A, null, P().defaults(A));
    const hard = pre.errs.find(e => /Erfordert/.test(e));
    if (hard) { ui.toast({ t: A.name, d: hard, icon: 'lock', kind: 'warn' }); return; }
    if (ui.cur === 'handeln' || ui.cur === 'staaten') ui.closePanel();
    begin(A, kind);
  };

  function hint(A, txt, err) {
    const h = U.$('#placehint');
    h.innerHTML = `<div class="ic-c" style="color:var(--gold2)">${ic(A.icon, 20)}</div><div class="t"><b>${esc(A.name)}</b><div>${esc(txt)}</div>${err ? '<div class="err">' + esc(err) + '</div>' : ''}</div><button class="btn sm ghost" data-a="cancelPlace">Abbrechen <span class="kbd">esc</span></button>`;
    h.classList.add('on');
  }
  KY.A.cancelPlace = () => O.cancel();
  O.cancel = function (silent) {
    if (!KY.map.placing) return;
    KY.map.cancelPlace();
    document.body.classList.remove('placing');
    U.$('#placehint').classList.remove('on');
    if (!silent) ui.toast({ t: 'Platzierung abgebrochen', icon: 'x', ms: 1600 });
  };

  function begin(A, kind) {
    const defs = P().defaults(A);
    const cityOk = c => {
      if (A.place === 'city-big') return SIM.S.cities[c.id].pop >= 1.2;
      if (A.place === 'city-coast' || A.place === 'line-sea' || A.place === 'line-sea-long') return c.coastal;
      return true;
    };
    const done = pl => { O.cancel(true); O.sheet(A.id, pl); };
    let throttle = 0;
    const pl = { kind };
    if (kind === 'city') {
      pl.cityFilter = cityOk;
      pl.onClick = h => { if (h.type === 'city' && cityOk(SIM.W.cities[h.id])) done({ c: h.id }); else hint(A, HINT.city, 'Hier nicht möglich.'); };
    } else if (kind === 'nation') {
      pl.onClick = h => { const id = h.type === 'nation' ? h.id : h.type === 'city' ? SIM.W.cities[h.id].nation : -1; if (id >= 0) done({ n: id }); };
    } else if (kind === 'two') {
      pl.onClick = h => {
        const id = h.type === 'nation' ? h.id : h.type === 'city' ? SIM.W.cities[h.id].nation : -1;
        if (id < 0) return;
        if (pl.first < 0) { pl.first = id; hint(A, 'Erster Staat: ' + SIM.nName(id) + '. Wählen Sie jetzt den zweiten Staat.'); }
        else if (id !== pl.first) done({ n: pl.first, n2: id });
      };
    } else if (kind === 'point') {
      pl.onMove = (x, y) => {
        const now = performance.now(); if (now - throttle < 60) return; throttle = now;
        const ll = KY.map.toLonLat(x, y);
        const c = P().ctx(A, { lon: ll.lon, lat: ll.lat }, defs);
        pl.valid = !c.errs.length;
        hint(A, HINT.point + (pl.valid && c.cid >= 0 ? ' Nächste Stadt: ' + SIM.cName(c.cid) + '.' : ''), c.errs[0]);
      };
      pl.onClick = (h, x, y) => {
        const ll = KY.map.toLonLat(x, y);
        const c = P().ctx(A, { lon: ll.lon, lat: ll.lat }, defs);
        if (c.errs.length) { hint(A, HINT.point, c.errs[0]); KY.audio.play('err'); return; }
        done({ lon: ll.lon, lat: ll.lat });
      };
    } else if (kind === 'line') {
      pl.cityFilter = c => cityOk(c) && c.id !== pl.first;
      pl.onMove = (x, y) => {
        if (pl.first < 0) return;
        const h = KY.map.placing && hover(x, y);
        if (h && h.type === 'city') {
          const c = P().ctx(A, { c: pl.first, c2: h.id }, defs);
          pl.valid = !c.errs.length; pl.km = c.km;
          hint(A, 'Von ' + SIM.cName(pl.first) + ' nach ' + SIM.cName(h.id) + ' · ' + U.n(c.km) + ' km', c.errs[0]);
        } else { pl.valid = undefined; pl.km = 0; }
      };
      pl.onClick = h => {
        if (h.type !== 'city' || !cityOk(SIM.W.cities[h.id])) return;
        if (pl.first < 0) { pl.first = h.id; hint(A, 'Start: ' + SIM.cName(h.id) + '. Wählen Sie jetzt die Zielstadt.'); return; }
        if (h.id === pl.first) return;
        const c = P().ctx(A, { c: pl.first, c2: h.id }, defs);
        if (c.errs.length) { hint(A, 'Von ' + SIM.cName(pl.first) + ' nach ' + SIM.cName(h.id), c.errs[0]); KY.audio.play('err'); return; }
        done({ c: pl.first, c2: h.id });
      };
    } else if (kind === 'area') {
      pl.onArea = (dr, fin) => {
        const a = KY.map.toLonLat(dr[0], dr[1]), b = KY.map.toLonLat(dr[2], dr[3]);
        const q = { lon0: a.lon, lat0: a.lat, lon1: b.lon, lat1: b.lat };
        const c = P().ctx(A, q, defs);
        pl.valid = !c.errs.length;
        pl.areaTxt = U.count(c.area) + ' km² geeignet' + (c.nid >= 0 ? ' · ' + SIM.nName(c.nid) : '');
        hint(A, HINT.area, c.errs[0]);
        if (fin) { if (c.errs.length) { KY.audio.play('err'); pl.drag = null; return; } done(q); }
      };
    } else if (kind === 'event') {
      pl.onClick = h => { if (h.type === 'ev') { const ev = KY.events.byId(h.id); if (ev && ev.phase !== 'vorbei') done({ ev: h.id }); } };
    }
    KY.map.place(pl);
    document.body.classList.add('placing');
    hint(A, HINT[kind]);
    KY.audio.play('nav');
  }
  // Treffer an der Mausposition (über die Karte)
  function hover(x, y) {
    const W = SIM.W;
    let best = null, bd = 14;
    W.cities.forEach(c => { const p = KY.map.llScreen(c.lon, c.lat); const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = c; } });
    return best ? { type: 'city', id: best.id } : null;
  }

  /* ---------- Vorhabenbogen ---------- */
  O.sheet = function (actId, pl) {
    const A = D.ACT[actId];
    const S = SIM.S;
    const o = P().defaults(A);
    if (S.g.auflagen && S.day < S.g.auflagen.until && S.g.auflagen.kind === 'safety' && o.safety) o.safety = 'max';
    const noFront = A.cat === 'cover';
    const fronts = S.fronts.filter(f => !f.dissolved);
    let front = (fronts.filter(f => !f.exposed).sort((a, b) => (KY.cover.fit(b, A) - KY.cover.fit(a, A)) || (a.trace - b.trace))[0] || fronts[0] || {}).id;
    const no = 'KY-V/' + U.year(S.day) + '/' + U.pad(S.seq.proj + 1, 4);
    const m = ui.modal({
      cls: 'w900', html: `<div class="mh"><div class="ic-c" style="width:44px;height:44px;border-radius:11px;background:rgba(201,162,79,.12);color:var(--gold2);display:flex;align-items:center;justify-content:center;flex:none">${ic(A.icon, 24)}</div><div class="tt" style="flex:1;min-width:0"><div class="lbl">Vorhabenbogen ${no} · ${esc(D.CATS.find(c => c.id === A.cat).n)}</div><h2>${esc(A.name)}</h2><div class="sub dim" id="sh-loc" style="font-size:12px;margin-top:2px"></div></div><button class="iconbtn" data-a="mclose">${ic('close', 18)}</button></div>
        <div class="sheet"><div class="opts" id="sh-opts"></div><div class="sum" id="sh-sum"></div></div>
        <div class="mf"><span class="l" id="sh-foot"></span><button class="btn ghost" data-a="mclose">Abbrechen</button><button class="btn primary hold" id="sh-ok"><span class="fill"></span><span id="sh-okl">Anordnen</span></button></div>`,
      onKey: e => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } },
    });
    let q = null;
    const render = () => {
      q = P().quote(actId, pl, o);
      const x = q.x;
      U.$('#sh-loc', m.el).innerHTML = locText(A, x);
      // Optionen
      let h = `<p class="note" style="font-size:13px;margin:0 0 16px">${esc(A.text)}</p>`;
      P().optionGroups(A).forEach(g => {
        h += `<div class="og"><div class="ol">${esc(g.label)}</div><div class="choices">${g.choices.map(c => `<button class="choice ${o[g.id] === c.v ? 'on' : ''}" data-g="${g.id}" data-v="${c.v}"><div class="l">${esc(c.l)}</div>${c.note ? '<div class="n">' + esc(c.note) + '</div>' : ''}</button>`).join('')}</div></div>`;
      });
      if (!noFront) {
        h += `<div class="og"><div class="ol">Träger (Tarnstruktur)</div><div class="choices">${fronts.map(f => { const fit = KY.cover.fit(f, A); return `<button class="choice ${front === f.id ? 'on' : ''}" data-front="${f.id}"><div class="l">${esc(f.name)}</div><div class="n">${f.exposed ? '<span class="bad">enttarnt</span>' : 'Spuren ' + Math.round(f.trace) + ' %'} · ${fit ? '<span class="good">passend</span>' : 'unpassend'} · ${f.projects.length} Vorhaben</div></button>`; }).join('')}</div></div>`;
      }
      U.$('#sh-opts', m.el).innerHTML = h;
      // Zusammenfassung
      let s = '';
      if (q.errs.length) s += q.errs.map(e => `<div class="errbox" style="margin-bottom:8px">${ic('x', 15)}<div>${esc(e)}</div></div>`).join('');
      if (q.cost !== undefined) {
        const fr = S.fronts.find(f => f.id === front);
        const tg = noFront ? 0 : KY.cover.traceGain(A, o, x, fr, q.vis);
        s += `<div class="lbl">Kosten</div><div class="bigsum">${U.money(q.cost)}</div><div class="dim" style="font-size:12px">${A.instant ? 'sofort fällig' : '15 % bei Baubeginn, Rest über die Bauzeit'} · verfügbar ${U.money(KY.finance.avail())}</div>
          <div style="margin-top:12px">
          <div class="kv"><span>${A.instant ? 'Dauer bis Wirkung' : A.program ? 'Laufzeit' : 'Bauzeit'}</span><span>${U.days(q.days)}</span></div>
          ${q.approval ? `<div class="kv"><span>Genehmigungsaussicht</span><span class="${q.chance < 40 ? 'bad' : q.chance > 70 ? 'good' : 'warnc'}">${q.chance} %</span></div>` : '<div class="kv"><span>Genehmigung</span><span>nicht erforderlich</span></div>'}
          ${A.diplo ? `<div class="kv"><span>Erfolgschance</span><span>${Math.round(x.chance * 100)} %</span></div>` : ''}
          ${q.income ? `<div class="kv"><span>Einnahmen</span><span>${U.money(q.income)}/Jahr</span></div>` : ''}
          ${q.upkeep ? `<div class="kv"><span>Unterhalt</span><span>${U.money(q.upkeep)}/Jahr</span></div>` : ''}
          ${q.displaced ? `<div class="kv"><span>Umsiedlungen</span><span class="bad">${U.count(q.displaced)} Menschen</span></div>` : ''}
          ${q.oppose ? `<div class="kv"><span>Protestrisiko</span><span class="${q.protestRisk > 0.4 ? 'bad' : q.protestRisk > 0.15 ? 'warnc' : ''}">${q.protestRisk > 0.5 ? 'hoch' : q.protestRisk > 0.2 ? 'mittel' : 'gering'}</span></div>` : ''}
          ${!noFront ? `<div class="kv"><span>Neue Spuren</span><span class="${tg > 10 ? 'warnc' : ''}">+${U.n(tg, 1)} %</span></div>` : ''}
          <div class="kv"><span>Sichtbarkeit</span><span>${q.vis >= 7 ? 'sehr hoch' : q.vis >= 4 ? 'hoch' : q.vis >= 2 ? 'mittel' : 'gering'}</span></div></div>`;
        if (q.describe && q.describe.length) s += `<div class="h3">Erwartete Wirkung</div>` + q.describe.map(d => `<div style="font-size:12.5px;padding:3px 0;display:flex;gap:6px">${ic('arrowR', 12)}<span>${esc(d)}</span></div>`).join('');
        if (q.risks && q.risks.length) s += `<div class="h3">Risiken pro Jahr</div>` + q.risks.map(r => `<div class="kv"><span>${esc(r.n)} <span class="mute">(${r.phase === 'bau' ? 'Bau' : 'Betrieb'})</span></span><span class="${r.py > 0.08 ? 'bad' : r.py > 0.03 ? 'warnc' : ''}">${U.pct(r.py * 100, 1)}</span></div>`).join('') + '<div class="dim" style="font-size:11px;margin-top:4px">Schwere reicht von Stufe ' + Math.min.apply(null, q.risks.map(r => r.sev[0])) + ' bis ' + Math.max.apply(null, q.risks.map(r => r.sev[1])) + '.</div>';
        if (A.opposeWho) s += `<div class="h3">Öffentliche Reaktion</div><div style="font-size:12px"><div><span class="good">Dafür:</span> ${esc(A.supportWho || '—')}</div><div style="margin-top:3px"><span class="bad">Dagegen:</span> ${esc(A.opposeWho)}</div></div>`;
        const R = D.REACT[A.id];
        if (R) s += '<div class="bars" style="margin-top:8px">' + D.MILIEUS.map((ml, i) => `<div class="b"><span>${esc(ml.n)}</span>${ui.dmeter(R[i] * 100)}<span>${R[i] > 0.15 ? '+' : R[i] < -0.15 ? '−' : '○'}</span></div>`).join('') + '</div>';
        if (q.warns.length) s += '<div style="margin-top:12px">' + q.warns.map(w => `<div class="warnbox" style="margin-bottom:6px">${ic('alert', 15)}<div>${esc(w)}</div></div>`).join('') + '</div>';
        if (q.principles.length) s += '<div style="margin-top:6px">' + q.principles.map(b => `<div class="errbox" style="margin-bottom:6px">${ic('scale', 15)}<div><b>Grundsatzbruch:</b> ${esc(b.n)}</div></div>`).join('') + '</div>';
      }
      U.$('#sh-sum', m.el).innerHTML = s;
      const ok = U.$('#sh-ok', m.el);
      ok.classList.toggle('disabled', !q.ok);
      ok.classList.toggle('danger', q.principles.length > 0);
      ok.classList.toggle('primary', !q.principles.length);
      U.$('#sh-okl', m.el).textContent = q.principles.length ? 'Trotzdem anordnen' : q.approval ? 'Antrag stellen' : 'Anordnen';
      U.$('#sh-foot', m.el).innerHTML = q.ok ? 'Gedrückt halten zum Zeichnen · <span class="kbd">↵</span>' : '';
    };
    m.el.addEventListener('click', e => {
      const c = e.target.closest('.choice');
      if (!c) return;
      if (c.dataset.front) front = c.dataset.front;
      else o[c.dataset.g] = c.dataset.v;
      KY.audio.play('click');
      render();
    });
    // Gedrückt halten zum Zeichnen
    const ok = U.$('#sh-ok', m.el);
    let hold = null;
    const fill = U.$('.fill', ok);
    ok.addEventListener('pointerdown', e => {
      if (!q || !q.ok) return;
      e.preventDefault();
      const t0 = performance.now();
      const step = () => {
        const f = Math.min(1, (performance.now() - t0) / 650);
        fill.style.width = (f * 100) + '%';
        if (f >= 1) { hold = null; confirm(); return; }
        hold = requestAnimationFrame(step);
      };
      hold = requestAnimationFrame(step);
    });
    const release = () => { if (hold) cancelAnimationFrame(hold); hold = null; fill.style.width = '0'; };
    ok.addEventListener('pointerup', release);
    ok.addEventListener('pointerleave', release);
    function confirm() {
      if (!q || !q.ok || m.closed) return;
      const r = P().order(q, front);
      if (!r.ok) { ui.toast({ t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'crit' }); return; }
      m.close();
      KY.audio.play('grant');
      ui.toast({ t: A.approval ? 'Antrag gestellt' : 'Angeordnet', d: r.p.name, icon: A.icon, kind: 'good', onClick: () => ui.inspect('proj', r.p.id) });
      if (A.place !== 'global') ui.inspect('proj', r.p.id);
      KY.map.dataChanged(1);
      ui.refresh();
    }
    render();
  };

  function locText(A, x) {
    const out = [];
    if (x.cid >= 0 && x.c) out.push(ic('pin', 12) + ' ' + esc(x.c.name));
    if (x.c2id >= 0 && x.c2 && A.place.indexOf('line') === 0) out.push('→ ' + esc(x.c2.name) + ' · ' + U.n(x.km) + ' km' + (x.seaKm ? ' (davon ' + U.n(x.seaKm) + ' km über Wasser)' : ''));
    if (x.nid >= 0) out.push(KY.flag(SIM.W.nations[x.nid], 12) + ' ' + esc(SIM.nName(x.nid)));
    if (x.n2id >= 0 && A.place === 'two-nations') { const R = SIM.rel(x.nid, x.n2id); out.push('und ' + KY.flag(SIM.W.nations[x.n2id], 12) + ' ' + esc(SIM.nName(x.n2id)) + ' · ' + SIM.REL_NAMES[R.state] + ' (' + Math.round(R.v) + ')'); }
    if (x.area) out.push(U.count(x.area) + ' km²');
    if (x.ev) out.push(esc(x.ev.name));
    if (A.place === 'land' || A.place === 'land-or-sea') out.push(x.sea ? 'vor der Küste' : esc(KY.geo.biomeName(x.biome)));
    if (A.id === 'SOLAR') out.push('Sonne ' + Math.round(x.sun * 100) + ' %');
    if (A.id === 'WIND') out.push('Wind ' + Math.round(x.windQ * 100) + ' %');
    if (A.place === 'global') out.push('weltweit');
    return out.join(' · ');
  }

  /* ---------- Neue Tarnstruktur ---------- */
  O.newFrontDialog = function () {
    const S = SIM.S;
    let kind = 'stiftung', seat = D.SEATS[0];
    const used = new Set(S.fronts.map(f => f.name));
    let name = SIM.frontName(Math.random, kind, used);
    const m = ui.modal({
      cls: 'w560', html: `<div class="mh"><div class="tt"><div class="lbl">Tarnung · ¤ 300 Mio.</div><h2>Neue Tarnstruktur gründen</h2></div><button class="iconbtn" data-a="mclose">${ic('close', 18)}</button></div><div class="mb" id="nf-b"></div><div class="mf"><button class="btn ghost" data-a="mclose">Abbrechen</button><button class="btn primary" id="nf-ok">Gründen</button></div>`,
    });
    const draw = () => {
      U.$('#nf-b', m.el).innerHTML = `<div class="field"><label>Name</label><input class="inp" id="nf-n" value="${esc(name)}" maxlength="42"></div>
        <div class="og"><div class="ol">Rechtsform</div><div class="choices">${D.FRONT_KINDS.map(k => `<button class="choice ${k.id === kind ? 'on' : ''}" data-k="${k.id}"><div class="l">${esc(k.n)}</div><div class="n">${esc(k.note)}</div></button>`).join('')}</div></div>
        <div class="og"><div class="ol">Sitz</div><div class="choices">${D.SEATS.map(s => `<button class="choice ${s === seat ? 'on' : ''}" data-s="${esc(s)}"><div class="l">${esc(s)}</div></button>`).join('')}</div></div>`;
    };
    m.el.addEventListener('click', e => {
      const c = e.target.closest('.choice');
      if (!c) return;
      const inp = U.$('#nf-n', m.el); if (inp) name = inp.value;
      if (c.dataset.k) { kind = c.dataset.k; name = SIM.frontName(Math.random, kind, used); }
      if (c.dataset.s) seat = c.dataset.s;
      draw();
    });
    U.$('#nf-ok', m.el).addEventListener('click', () => {
      const inp = U.$('#nf-n', m.el);
      const nm = (inp ? inp.value : name).trim() || name;
      const r = KY.cover.newFront(kind, seat, nm);
      if (!r.ok) { ui.toast({ t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'warn' }); return; }
      m.close(); KY.audio.play('ok');
      ui.toast({ t: 'Tarnstruktur gegründet', d: r.f.name + ' · ' + r.f.seat, icon: 'mask', kind: 'good' });
      ui.refresh();
    });
    draw();
  };
})();
