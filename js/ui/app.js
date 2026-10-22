/* KYTHERA · MANDAT · Oberfläche: Gerüst, Panels, Inspektor, Modale, Toasts, Tastatur, Schleife */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const ui = (KY.ui = { st: { tab: {}, sort: {}, filter: {} } });
  KY.P = {}; // Panels
  KY.INS = {}; // Inspektoren
  KY.A = {}; // Aktionen (data-a)
  const ic = (n, s, c) => KY.icon(n, s || 16, c);
  ui.ic = ic;

  const DOCK = [
    { id: 'lage', n: 'Lage', icon: 'grid', key: 'L' },
    { id: 'handeln', n: 'Handeln', icon: 'plus', key: 'A' },
    { id: 'vorhaben', n: 'Vorhaben', icon: 'crane', key: 'P' },
    { id: 'verantwortung', n: 'Verantw.', icon: 'scale', key: 'V' },
    { id: 'medien', n: 'Medien', icon: 'tv', key: 'M' },
    { id: 'staaten', n: 'Staaten', icon: 'globe', key: 'S' },
    { id: 'finanzen', n: 'Finanzen', icon: 'bank', key: 'F' },
    { id: 'tarnung', n: 'Tarnung', icon: 'mask', key: 'T' },
    { id: 'forschung', n: 'Forschung', icon: 'flask', key: 'R' },
    { id: 'kanal', n: 'Kanal', icon: 'inbox', key: 'K' },
    { id: 'chronik', n: 'Chronik', icon: 'history', key: 'C' },
    { id: 'akten', n: 'Akten', icon: 'folder', key: 'O' },
  ];
  ui.DOCK = DOCK;

  /* ---------- Aufbau ---------- */
  ui.init = function () {
    const g = U.$('#game');
    ui.$bar = U.$('#bar'); ui.$dock = U.$('#dock'); ui.$panel = U.$('#panel'); ui.$insp = U.$('#insp');
    ui.$ticker = U.$('#ticker'); ui.$toasts = U.$('#toasts'); ui.$modals = U.$('#modals'); ui.$tip = U.$('#tip');
    buildBar(); buildDock(); buildTicker();
    // Delegierte Klicks für data-a
    g.addEventListener('click', e => {
      const t = e.target.closest('[data-a]');
      if (!t || !g.contains(t)) return;
      const fn = KY.A[t.dataset.a];
      if (fn) { e.preventDefault(); e.stopPropagation(); KY.audio.play('click'); fn(t, e); }
    });
    U.on(ui.$dock, 'click', 'button[data-p]', (e, b) => { KY.audio.play('nav'); ui.panel(b.dataset.p); });
    document.addEventListener('keydown', onKey);
    KY.chart.bind(g);
    ui.bindBus();
  };

  function buildBar() {
    ui.$bar.innerHTML = `
      <div class="logo"><span class="mark">${KY.sealSvg(28)}</span><div><div class="t">KYTHERA</div><div class="c" id="b-code"></div></div></div>
      <div class="clock">
        <div class="date" id="b-date"></div>
        <div class="speeds" id="b-speeds">
          <button data-a="speed" data-v="0" title="Pause (Leertaste)">${ic('pause', 14)}</button>
          <button data-a="speed" data-v="1" title="1 Tag pro Sekunde (1)">${ic('play', 14)}</button>
          <button data-a="speed" data-v="2" title="4 Tage pro Sekunde (2)">${ic('fast', 14)}</button>
          <button data-a="speed" data-v="3" title="12 Tage pro Sekunde (3)">${ic('faster', 14)}</button>
          <button data-a="speed" data-v="4" title="30 Tage pro Sekunde (4)"><b style="font-size:10px">30×</b></button>
        </div>
      </div>
      <div class="gauges" id="b-gauges">
        <div class="gauge" data-a="panel" data-p="finanzen"><div class="k">Vermögen</div><div class="v" id="g-cash"></div></div>
        <div class="gauge press" id="g-press-w" data-a="panel" data-p="verantwortung"><div class="k">Druck</div><div class="v"><span id="g-press"></span><span class="meter"><i id="g-press-m"></i></span></div></div>
        <div class="gauge" data-a="panel" data-p="verantwortung"><div class="k">Kuratorium</div><div class="v"><span id="g-trust"></span><span class="meter"><i id="g-trust-m"></i></span></div></div>
        <div class="gauge" data-a="panel" data-p="tarnung"><div class="k">Enttarnung</div><div class="v"><span id="g-exp"></span><span class="meter"><i id="g-exp-m" style="background:var(--serious)"></i></span></div></div>
        <div class="gauge opt" data-a="panel" data-p="medien"><div class="k">Haltung</div><div class="v" id="g-op"></div></div>
        <div class="gauge opt" data-a="panel" data-p="verantwortung"><div class="k">Leben gerettet</div><div class="v" id="g-lives"></div></div>
      </div>
      <div class="tools">
        <button class="iconbtn" data-a="palette" title="Suche (⌘K oder /)">${ic('search', 18)}</button>
        <button class="iconbtn" data-a="panel" data-p="kanal" title="Kanal (K)">${ic('inbox', 18)}<span class="badge hidden" id="b-inbox"></span></button>
        <button class="iconbtn" data-a="crisisNext" title="Offene Vorfälle (E)" id="b-crisis">${ic('siren', 18)}<span class="badge hidden" id="b-inc"></span></button>
        <button class="iconbtn" data-a="panel" data-p="system" title="System (,)">${ic('settings', 18)}</button>
      </div>`;
  }
  function buildDock() {
    ui.$dock.innerHTML = DOCK.map(d => `<button data-p="${d.id}" title="${d.n} (${d.key})">${ic(d.icon, 19)}<span>${d.n}</span><span class="badge hidden" data-badge="${d.id}"></span></button>`).join('') +
      `<div class="grow"></div><button data-p="system" title="System">${ic('settings', 19)}<span>System</span></button><button data-p="hilfe" title="Hilfe (?)">${ic('help', 19)}<span>Hilfe</span></button>`;
  }
  function buildTicker() {
    ui.$ticker.innerHTML = `<div class="tag" id="t-tag">${ic('radio', 13)}<span>LAGE</span></div><div class="run"><div class="track" id="t-track"></div></div><div class="mk" id="t-mk"></div>`;
    ui.tickerX = 0;
  }

  /* ---------- Kopfleiste und Laufband aktualisieren ---------- */
  ui.updateBar = function () {
    const S = SIM.S, g = S.g;
    U.setText(U.$('#b-code'), 'Mandatsperson · ' + S.codename);
    U.setHTML(U.$('#b-date'), U.dateStr(S.day) + '<small>MANDATSTAG ' + (S.day + 1) + (S.paused ? ' · ANGEHALTEN' : '') + '</small>');
    U.$$('#b-speeds button').forEach(b => b.classList.toggle('on', S.paused ? b.dataset.v === '0' : +b.dataset.v === S.speed));
    const avail = KY.finance.avail();
    U.setText(U.$('#g-cash'), U.money(avail, avail >= 100 ? 0 : 1));
    const p = g.pressure;
    U.setText(U.$('#g-press'), Math.round(p) + ' %');
    U.$('#g-press-m').style.width = p + '%';
    const lvl = p > 80 ? 'crit' : p > 60 ? 'high' : p > 35 ? 'mid' : 'low';
    const pw = U.$('#g-press-w');
    pw.classList.toggle('high', lvl === 'high'); pw.classList.toggle('crit', lvl === 'crit');
    if (document.body.dataset.pressure !== lvl) document.body.dataset.pressure = lvl;
    U.setText(U.$('#g-trust'), Math.round(g.trust) + ' %');
    U.$('#g-trust-m').style.width = g.trust + '%';
    U.$('#g-trust-m').style.background = g.trust < 25 ? 'var(--crit)' : g.trust < 45 ? 'var(--warn)' : 'var(--gold)';
    U.setText(U.$('#g-exp'), g.exposed ? 'ÖFFENTLICH' : Math.round(g.exposure) + ' %');
    U.$('#g-exp-m').style.width = g.exposure + '%';
    const op = SIM.worldOp();
    U.setHTML(U.$('#g-op'), `<span class="${op > 2 ? 'good' : op < -2 ? 'bad' : ''}">${U.sgn(op, 1)}</span><span class="dim" style="font-size:11px;font-weight:500">${U.pct(SIM.worldAware(), 0)} bekannt</span>`);
    U.setText(U.$('#g-lives'), U.count(Math.round(g.lives)));
    const unread = S.inbox.filter(m => !m.read).length;
    const bi = U.$('#b-inbox'); bi.classList.toggle('hidden', !unread); U.setText(bi, unread > 99 ? '99+' : String(unread));
    const open = KY.incidents.open().length;
    const bc = U.$('#b-inc'); bc.classList.toggle('hidden', !open); U.setText(bc, String(open));
    U.$('#b-crisis').classList.toggle('on', open > 0);
    const db = (id, v) => { const b = U.$('[data-badge="' + id + '"]', ui.$dock); if (b) { b.classList.toggle('hidden', !v); U.setText(b, String(v)); } };
    db('kanal', unread); db('verantwortung', open);
    U.$('[data-p="verantwortung"]', ui.$dock).classList.toggle('alert', open > 0);
    ui.updateMarkets();
  };
  ui.updateMarkets = function () {
    const S = SIM.S;
    if (!S.mkt) return;
    const it = D.TICKER.indices.slice(0, 3).map(x => {
      const o = S.mkt.idx[x.id]; const ch = (o.v / o.prev - 1) * 100;
      return `<span>${x.n} <b>${U.n(o.v, 0)}</b> <span class="${ch >= 0 ? 'up' : 'dn'}">${U.sgn(ch, 2, '%')}</span></span>`;
    }).join('');
    U.setHTML(U.$('#t-mk'), it);
  };
  ui.rebuildTicker = function () {
    const S = SIM.S;
    const items = S.news.slice(0, 14);
    const fill = D.TICKER.filler;
    const html = items.map(a => `<span class="it" data-a="article" data-id="${a.id}"><span class="ch">${(D.CHANNELS.find(c => c.id === a.ch) || {}).short || ''}</span>${a.breaking ? '<b style="color:#ff9f94">EIL</b>' : ''}<b>${U.esc(a.h)}</b></span>`).join('') +
      fill.slice(0, 3).map(t => `<span class="it">${U.esc(t)}</span>`).join('');
    const tr = U.$('#t-track');
    if (tr._h !== html) { tr.innerHTML = html + html; tr._h = html; }
    const br = items.find(a => a.breaking && S.day - a.day < 3);
    const tag = U.$('#t-tag');
    tag.classList.toggle('breaking', !!br);
    U.setHTML(tag, br ? ic('alert', 13) + '<span>EILMELDUNG</span>' : ic('radio', 13) + '<span>LAGE</span>');
  };
  function tickerStep(dt) {
    const tr = U.$('#t-track');
    if (!tr) return;
    const w = tr.scrollWidth / 2;
    if (w <= 0) return;
    ui.tickerX = (ui.tickerX + dt * 42) % w;
    tr.style.transform = 'translateX(' + (-ui.tickerX) + 'px)';
  }

  /* ---------- Panels ---------- */
  ui.cur = null;
  ui.panel = function (id, opts) {
    opts = opts || {};
    if (!KY.P[id]) return;
    if (ui.cur === id && !opts.keep) { ui.closePanel(); return; }
    ui.cur = id;
    if (opts.tab) ui.st.tab[id] = opts.tab;
    const P = KY.P[id];
    ui.$panel.classList.add('open');
    ui.$panel.classList.toggle('wide', !!P.wide);
    ui.$panel.innerHTML = `<div class="ph"><div class="tt"><div class="lbl">${U.esc(P.kicker || 'Vertraulich')}</div><h2>${U.esc(P.title)}</h2><div class="sub" id="p-sub"></div></div><button class="iconbtn" data-a="closePanel" title="Schließen (Esc)">${ic('close', 18)}</button></div>${P.tabs ? '<div class="tabs" id="p-tabs"></div>' : ''}<div class="pb" id="p-body"></div>`;
    U.$$('button[data-p]', ui.$dock).forEach(b => b.classList.toggle('on', b.dataset.p === id));
    ui.renderPanel(true);
    if (P.onOpen) P.onOpen();
  };
  ui.closePanel = function () {
    if (ui.cur && KY.P[ui.cur] && KY.P[ui.cur].onClose) KY.P[ui.cur].onClose();
    ui.cur = null;
    ui.$panel.classList.remove('open');
    U.$$('button[data-p]', ui.$dock).forEach(b => b.classList.remove('on'));
  };
  ui.renderPanel = function (force) {
    if (!ui.cur) return;
    const P = KY.P[ui.cur];
    const body = U.$('#p-body');
    if (!body) return;
    if (!force && body.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (!force && P.static) return;
    if (P.tabs) {
      const tabs = typeof P.tabs === 'function' ? P.tabs() : P.tabs;
      const cur = ui.st.tab[ui.cur] || tabs[0].id;
      U.setHTML(U.$('#p-tabs'), tabs.map(t => `<button class="${t.id === cur ? 'on' : ''}" data-a="tab" data-p="${ui.cur}" data-v="${t.id}">${U.esc(t.n)}${t.badge ? '<span class="badge">' + t.badge + '</span>' : ''}</button>`).join(''));
    }
    const sub = P.sub ? P.sub() : '';
    U.setHTML(U.$('#p-sub'), sub);
    const st = body.scrollTop;
    const html = P.render(ui.st.tab[ui.cur]);
    if (body._h !== html) { body.innerHTML = html; body._h = html; body.scrollTop = st; if (P.after) P.after(body); }
  };

  /* ---------- Inspektor ---------- */
  ui.sel = null;
  ui.inspect = function (type, id) {
    if (!KY.INS[type]) return;
    ui.sel = { type, id };
    ui.$insp.classList.add('open');
    document.body.classList.add('insp-open');
    ui.$insp.innerHTML = `<div class="ph"><div class="tt" id="i-head"></div><button class="iconbtn" data-a="closeInsp" title="Schließen">${ic('close', 18)}</button></div><div class="pb" id="i-body"></div>`;
    ui.renderInsp(true);
    KY.map.select(ui.sel);
  };
  ui.closeInsp = function () {
    ui.sel = null;
    ui.$insp.classList.remove('open');
    document.body.classList.remove('insp-open');
    KY.map.select(null);
  };
  ui.renderInsp = function (force) {
    if (!ui.sel) return;
    const R = KY.INS[ui.sel.type];
    const out = R(ui.sel.id);
    if (!out) { ui.closeInsp(); return; }
    U.setHTML(U.$('#i-head'), out.head);
    const body = U.$('#i-body');
    if (!force && body.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const st = body.scrollTop;
    if (body._h !== out.body) { body.innerHTML = out.body; body._h = out.body; body.scrollTop = st; }
  };

  /* ---------- Modale Fenster ---------- */
  ui.modals = [];
  ui.modal = function (o) {
    const bg = U.el(`<div class="modal-bg"><div class="modal ${o.cls || ''}">${o.html}</div></div>`);
    ui.$modals.appendChild(bg);
    const m = { el: bg.firstElementChild, bg, o, close };
    function close(v) {
      if (m.closed) return;
      m.closed = true;
      bg.remove();
      ui.modals = ui.modals.filter(x => x !== m);
      if (o.onClose) o.onClose(v);
    }
    if (o.dismiss !== false) bg.addEventListener('pointerdown', e => { if (e.target === bg) close(); });
    bg.addEventListener('click', e => {
      const t = e.target.closest('[data-a]');
      if (!t) return;
      if (t.dataset.a === 'mclose') { e.stopPropagation(); close(); }
    });
    ui.modals.push(m);
    if (o.onOpen) o.onOpen(m);
    return m;
  };
  ui.topModal = () => ui.modals[ui.modals.length - 1];
  ui.confirm = function (title, text, okLabel, danger) {
    return new Promise(res => {
      const m = ui.modal({
        cls: 'w560', html: `<div class="mh"><div class="tt"><div class="lbl">Bestätigung</div><h2>${U.esc(title)}</h2></div></div><div class="mb"><p class="note" style="font-size:13px">${text}</p></div><div class="mf"><button class="btn ghost" data-a="mclose">Abbrechen</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${U.esc(okLabel || 'Bestätigen')}</button></div>`,
        onClose: v => res(!!v),
      });
      U.$('#cf-ok', m.el).addEventListener('click', () => m.close(true));
    });
  };

  /* ---------- Toasts ---------- */
  ui.toast = function (o) {
    const el = U.el(`<div class="toast ${o.kind || ''}"><span class="ic-c">${ic(o.icon || 'info', 17)}</span><div class="m"><div class="t">${U.esc(o.t)}</div>${o.d ? '<div class="d">' + U.esc(o.d) + '</div>' : ''}</div></div>`);
    ui.$toasts.appendChild(el);
    while (ui.$toasts.children.length > 3) ui.$toasts.firstElementChild.remove();
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', () => { if (o.onClick) o.onClick(); kill(); });
    setTimeout(kill, o.ms || 5200);
  };

  /* ---------- Tastatur ---------- */
  function onKey(e) {
    if (U.$('#game').classList.contains('hidden')) return;
    const tag = (document.activeElement || {}).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    const k = e.key;
    if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'K')) { e.preventDefault(); KY.A.palette(); return; }
    if ((e.metaKey || e.ctrlKey) && (k === 's' || k === 'S')) { e.preventDefault(); ui.save('auto', true); return; }
    if (k === 'Escape') {
      if (typing) { document.activeElement.blur(); return; }
      const m = ui.topModal();
      if (m) { if (m.o.dismiss !== false) m.close(); return; }
      if (KY.map.placing) { KY.order.cancel(); return; }
      if (ui.sel) { ui.closeInsp(); return; }
      if (ui.cur) { ui.closePanel(); return; }
      return;
    }
    if (typing) return;
    const m = ui.topModal();
    if (m) { if (m.o.onKey) m.o.onKey(e); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === ' ') { e.preventDefault(); KY.engine.toggle(); ui.updateBar(); return; }
    if (k >= '1' && k <= '4') { KY.engine.setSpeed(+k); ui.updateBar(); return; }
    if (k === '/' || k === '#') { e.preventDefault(); KY.A.palette(); return; }
    if (k === '?') { ui.panel('hilfe'); return; }
    if (k === ',') { ui.panel('system'); return; }
    if (k === 'e' || k === 'E') { KY.A.crisisNext(); return; }
    if (k === 'g' || k === 'G') { KY.map.cycleLayer(e.shiftKey ? -1 : 1); return; }
    if (k === '+' || k === '=') { KY.map.zoomBy(1.4); return; }
    if (k === '-' || k === '_') { KY.map.zoomBy(1 / 1.4); return; }
    if (k === '0') { KY.map.home(); return; }
    if (k.indexOf('Arrow') === 0) { e.preventDefault(); const d = 120; KY.map.panBy(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0); return; }
    // Kategorietasten im Handlungskatalog
    if (ui.cur === 'handeln') {
      const c = D.CATS.find(x => x.key === k.toUpperCase());
      if (c && KY.P.handeln.catKey(c.id)) return;
    }
    const d = DOCK.find(x => x.key === k.toUpperCase());
    if (d) { ui.panel(d.id); }
  }

  /* ---------- Speichern ---------- */
  ui.save = function (slot, notify) {
    const ok = SIM.save(SIM.S, slot);
    if (notify) ui.toast({ t: ok ? 'Mandat gesichert' : 'Speichern fehlgeschlagen', d: ok ? (slot === 'auto' ? 'Automatische Sicherung' : 'Speicherplatz ' + slot) + ' · ' + U.dateStr(SIM.S.day, true) : 'Der Browser-Speicher ist voll oder gesperrt.', icon: ok ? 'save' : 'alert', kind: ok ? 'good' : 'crit' });
    return ok;
  };

  /* ---------- Schleife ---------- */
  let last = 0, accUi = 0, accPanel = 0, accTicker = 0, daysSince = 0;
  ui.start = function () {
    ui.running = true;
    last = performance.now();
    ui.updateBar(); ui.rebuildTicker();
    requestAnimationFrame(frame);
  };
  function frame(t) {
    if (!ui.running) return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    let n = 0;
    try { n = KY.engine.tick(dt); } catch (e) { console.error(e); KY.engine.pause('fehler'); }
    if (n) { daysSince += n; KY.map.dataChanged(n); }
    accUi += dt; accPanel += dt; accTicker += dt;
    if (accUi > 0.2) { accUi = 0; ui.updateBar(); }
    // Herzschlag bei kritischem Druck (nur wenn die Zeit läuft)
    const S = SIM.S;
    if (S && !S.paused && S.g.pressure > 78) { ui.beat = (ui.beat || 0) + dt; if (ui.beat > (S.g.pressure > 90 ? 1.1 : 1.6)) { ui.beat = 0; KY.audio.play('heart'); } }
    if (accPanel > 0.6 && (daysSince || ui.forceRefresh)) {
      accPanel = 0; daysSince = 0; ui.forceRefresh = false;
      ui.renderPanel(); ui.renderInsp();
    }
    if (accTicker > 4) { accTicker = 0; ui.rebuildTicker(); }
    tickerStep(dt);
    KY.map.frame(dt);
    requestAnimationFrame(frame);
  }
  ui.refresh = function () { ui.forceRefresh = true; accPanel = 1; };

  /* ---------- Ereignisse aus der Simulation ---------- */
  ui.bindBus = function () {
    KY.bus.on('incident', inc => {
      KY.audio.play(inc.sev >= 3 ? 'alert' : 'note');
      KY.map.dataChanged(1);
      if (inc.noHarm && inc.sev < 3) { ui.toast({ t: inc.name + ' · ' + inc.projName, d: inc.title, icon: inc.icon, kind: 'warn', onClick: () => KY.crisis.open(inc.id) }); return; }
      if (SIM.S.ui.autoPause !== false && inc.sev >= 2) { KY.engine.pause('vorfall'); KY.crisis.call(inc); }
      else ui.toast({ t: inc.name + ' · ' + inc.projName, d: inc.title, icon: 'siren', kind: 'crit', onClick: () => KY.crisis.open(inc.id), ms: 8000 });
    });
    KY.bus.on('event', ev => {
      KY.map.dataChanged(1);
      if (ev.sev >= 3) {
        KY.audio.play('note');
        ui.toast({ t: ev.name, d: ev.text, icon: D.EVENTS[ev.type].icon, kind: ev.sev >= 4 ? 'crit' : 'warn', onClick: () => { KY.map.focus(ev.lon, ev.lat, 4); ui.inspect('ev', ev.id); }, ms: 7000 });
        if (ev.sev >= 4 && SIM.S.ui.autoPause !== false) KY.engine.pause('katastrophe');
      }
    });
    KY.bus.on('msg', m => {
      if (m.ref && (m.ref.ev || m.ref.inc)) return;
      if (m.kind === 'letter' || m.prio >= 2) {
        KY.audio.play('note');
        ui.toast({ t: SIM.adv(m.from).name, d: m.subj, icon: m.kind === 'letter' ? 'seal' : 'mail', kind: m.kind === 'crisis' ? 'crit' : '', onClick: () => KY.A.openMsg(null, null, m.id) });
      }
    });
    KY.bus.on('complete', p => { KY.map.dataChanged(1); ui.toast({ t: 'Fertiggestellt', d: p.name, icon: D.ACT[p.act].icon, kind: 'good', onClick: () => ui.inspect('proj', p.id) }); KY.audio.play('ok'); });
    KY.bus.on('approved', p => ui.toast({ t: 'Genehmigt', d: p.name + (p.cond ? ' · mit Auflagen' : ''), icon: 'check', kind: 'good', onClick: () => ui.inspect('proj', p.id) }));
    KY.bus.on('rejected', p => { KY.audio.play('deny'); ui.toast({ t: 'Abgelehnt', d: p.name, icon: 'x', kind: 'crit', onClick: () => ui.inspect('proj', p.id) }); });
    KY.bus.on('protest', e => { KY.map.dataChanged(1); ui.toast({ t: 'Protest in ' + SIM.cName(e.c), d: (KY.projects.byId(e.p) || {}).name || '', icon: 'protest', kind: 'warn', onClick: () => ui.inspect('city', e.c) }); });
    KY.bus.on('hearing', () => { KY.engine.pause('anhoerung'); KY.audio.play('gavel'); setTimeout(() => KY.crisis.hearing(), 400); });
    KY.bus.on('frontexposed', f => { KY.audio.play('glitch'); KY.engine.pause('enttarnt'); ui.toast({ t: 'Tarnstruktur enttarnt', d: f.name, icon: 'eye', kind: 'crit', ms: 9000, onClick: () => ui.panel('tarnung', { keep: true }) }); });
    KY.bus.on('exposed', () => { KY.engine.pause('enttarnung'); KY.crisis.reveal(); });
    KY.bus.on('report', d => { KY.engine.pause('jahresbericht'); setTimeout(() => KY.crisis.report(d), 300); });
    KY.bus.on('election', () => KY.map.dataChanged(1));
    KY.bus.on('news', a => { if (a.breaking) { ui.rebuildTicker(); } });
    KY.bus.on('month', () => {
      KY.map.invalidate();
      // Höchstens alle 25 Sekunden automatisch sichern, damit hohe Geschwindigkeiten flüssig bleiben
      if (SIM.S.ui.autosave !== false && Date.now() - (ui.lastAuto || 0) > 25000) { ui.lastAuto = Date.now(); ui.save('auto'); }
    });
    KY.bus.on('speed', () => ui.updateBar());
  };

  /* ---------- Allgemeine Aktionen ---------- */
  const A = KY.A;
  A.speed = b => { KY.engine.setSpeed(+b.dataset.v); ui.updateBar(); };
  A.panel = b => ui.panel(b.dataset.p, { keep: ui.cur !== b.dataset.p ? false : false });
  A.closePanel = () => ui.closePanel();
  A.closeInsp = () => ui.closeInsp();
  A.tab = b => { ui.st.tab[b.dataset.p] = b.dataset.v; ui.renderPanel(true); const body = U.$('#p-body'); if (body) body.scrollTop = 0; };
  A.nation = b => { const id = +b.dataset.id; ui.inspect('nation', id); if (b.dataset.focus !== '0') { const w = SIM.W.nations[id]; KY.map.focus(w.lon, w.lat); } };
  A.city = b => { const id = +b.dataset.id; ui.inspect('city', id); const c = SIM.W.cities[id]; KY.map.focus(c.lon, c.lat, Math.max(KY.map.zoomLevel(), 3)); };
  A.proj = b => { const p = KY.projects.byId(b.dataset.id); if (!p) return; ui.inspect('proj', p.id); if (p.lon !== undefined && p.n >= 0) KY.map.focus(p.lon, p.lat); };
  A.ev = b => { const ev = KY.events.byId(b.dataset.id); if (!ev) return; ui.inspect('ev', ev.id); KY.map.focus(ev.lon, ev.lat, Math.max(KY.map.zoomLevel(), 2.5)); };
  A.inc = b => KY.crisis.open(b.dataset.id);
  A.front = b => ui.inspect('front', b.dataset.id);
  A.crisisNext = () => {
    const open = KY.incidents.open();
    if (open.length) KY.crisis.open(open[0].id);
    else { ui.panel('verantwortung', { keep: true }); ui.toast({ t: 'Keine offenen Vorfälle', d: 'Der Krisenstab hat derzeit nichts zu entscheiden.', icon: 'check', kind: 'good' }); }
  };
  A.focus = b => KY.map.focus(+b.dataset.lon, +b.dataset.lat, +(b.dataset.z || 3));
  A.order = b => KY.order.start(b.dataset.id, b.dataset.pl ? JSON.parse(b.dataset.pl) : null);
  A.save = b => ui.save(b.dataset.v, true);

  /* Aktionen aus Nachrichten des Kanals */
  ui.msgAct = function (a, p) {
    p = p || {};
    switch (a) {
      case 'act': KY.order.start(p.id, p.n !== undefined ? (p.n2 !== undefined ? { n: p.n, n2: p.n2 } : { n: p.n }) : p.ev ? { ev: p.ev } : null); break;
      case 'inc': KY.crisis.open(p.id); break;
      case 'panel': ui.panel(p.id, { keep: true }); break;
      case 'proj': ui.inspect('proj', p.id); break;
      case 'nation': ui.inspect('nation', p.id); { const w = SIM.W.nations[p.id]; KY.map.focus(w.lon, w.lat); } break;
      case 'focus': KY.map.focus(p.lon, p.lat, 3.5); break;
      case 'hearing': KY.crisis.hearing(); break;
      case 'prepare': {
        const ok = KY.events.prepare(p.city, p.day);
        ui.toast({ t: ok ? 'Hilfe bereitgestellt' : 'Nicht möglich', d: ok ? 'Die Hilfsgüter stehen bereit, bevor das Ereignis eintrifft.' : 'Bereits vorbereitet oder nicht genügend Mittel.', icon: ok ? 'boxes' : 'x', kind: ok ? 'good' : 'warn' });
        break;
      }
    }
  };

  /* ---------- Befehlspalette ---------- */
  A.palette = function () {
    if (ui.modals.some(m => m.o.cls && m.o.cls.indexOf('palette') >= 0)) return;
    const S = SIM.S, W = SIM.W;
    const items = [];
    DOCK.forEach(d => items.push({ t: d.n === 'Verantw.' ? 'Verantwortung' : d.n, d: 'Bereich öffnen', icon: d.icon, k: d.key, run: () => ui.panel(d.id, { keep: true }) }));
    items.push({ t: 'System', d: 'Speichern, Einstellungen', icon: 'settings', k: ',', run: () => ui.panel('system', { keep: true }) });
    D.ACTIONS.forEach(a => items.push({ t: a.name, d: 'Handlung · ' + D.CATS.find(c => c.id === a.cat).n, icon: a.icon, run: () => KY.order.start(a.id) }));
    W.nations.forEach(n => items.push({ t: n.short, d: 'Staat · ' + n.name, icon: 'flag', run: () => { ui.inspect('nation', n.id); KY.map.focus(n.lon, n.lat); } }));
    W.cities.forEach(c => items.push({ t: c.name, d: 'Stadt · ' + W.nations[c.nation].short, icon: 'pin', run: () => { ui.inspect('city', c.id); KY.map.focus(c.lon, c.lat, 3.5); } }));
    S.projects.forEach(p => items.push({ t: p.name, d: 'Vorhaben · ' + KY.projects.PHASES[p.phase], icon: D.ACT[p.act].icon, run: () => ui.inspect('proj', p.id) }));
    const m = ui.modal({
      cls: 'palette', html: `<div class="pin">${ic('search', 18)}<input id="pal-in" placeholder="Staaten, Städte, Handlungen, Vorhaben …" autocomplete="off" spellcheck="false"><span class="kbd">esc</span></div><div class="res" id="pal-res"></div>`,
      onOpen: mm => setTimeout(() => U.$('#pal-in', mm.el).focus(), 30),
    });
    let sel = 0, res = [];
    const inp = U.$('#pal-in', m.el), box = U.$('#pal-res', m.el);
    const draw = () => {
      const q = U.norm(inp.value.trim());
      res = (q ? items.filter(i => U.norm(i.t).indexOf(q) >= 0 || U.norm(i.d).indexOf(q) >= 0).sort((a, b) => U.norm(a.t).indexOf(q) - U.norm(b.t).indexOf(q)) : items.slice(0, 13)).slice(0, 40);
      sel = Math.min(sel, Math.max(0, res.length - 1));
      box.innerHTML = res.map((r, i) => `<div class="ri ${i === sel ? 'on' : ''}" data-i="${i}">${ic(r.icon, 16)}<div><div style="font-weight:600">${U.esc(r.t)}</div><div class="dim" style="font-size:11px">${U.esc(r.d)}</div></div>${r.k ? '<span class="k kbd">' + r.k + '</span>' : ''}</div>`).join('') || '<div class="empty">Nichts gefunden.</div>';
      const on = box.querySelector('.ri.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); const r = res[sel]; if (r) { m.close(); r.run(); } }
      else if (e.key === 'Escape') { e.preventDefault(); m.close(); }
    });
    U.on(box, 'click', '.ri', (e, el) => { const r = res[+el.dataset.i]; m.close(); if (r) r.run(); });
    draw();
  };

  /* ---------- Hilfsfunktionen für Darstellung ---------- */
  ui.phaseChip = function (p) {
    const map = { antrag: 'ghost', bau: 'amber', laufend: 'blue', betrieb: 'green', abgeschlossen: 'ghost', abgelehnt: 'red', pausiert: 'amber', stillgelegt: 'red', aufgegeben: 'ghost', uebergeben: 'ghost' };
    return `<span class="chip ${map[p.phase] || ''}">${KY.projects.PHASES[p.phase]}</span>`;
  };
  ui.meter = (v, color, max) => `<div class="meter"><i style="width:${U.clamp(v / (max || 100) * 100, 0, 100)}%;background:${color || 'var(--blue)'}"></i></div>`;
  ui.dmeter = function (v) {
    const w = Math.abs(v) / 2;
    return `<div class="meter dv"><i style="${v >= 0 ? 'left:50%' : 'left:' + (50 - w) + '%'};width:${w}%;background:${v >= 0 ? 'var(--blue)' : '#e66767'}"></i></div>`;
  };
  ui.opColor = function (op, aware) {
    const t = U.clamp(op / 40, -1, 1);
    const a = aware === undefined ? 1 : U.clamp(aware / 60, 0.15, 1);
    const neg = [230, 103, 103], mid = [56, 56, 53], pos = [57, 135, 229];
    const c = t >= 0 ? mid.map((m, i) => m + (pos[i] - m) * t) : mid.map((m, i) => m + (neg[i] - m) * -t);
    return 'rgba(' + c.map(Math.round).join(',') + ',' + a.toFixed(2) + ')';
  };
  ui.advAvatar = function (id, size) {
    const a = SIM.adv(id);
    return `<div class="avatar" style="background:${a.color};${size ? 'width:' + size + 'px;height:' + size + 'px' : ''}">${a.init}</div>`;
  };
  ui.dayAgo = function (d) {
    const n = SIM.S.day - d;
    return n <= 0 ? 'heute' : n === 1 ? 'gestern' : n < 60 ? 'vor ' + n + ' Tagen' : U.dateStr(d, true);
  };
})();
