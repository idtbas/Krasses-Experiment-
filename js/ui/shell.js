/* KYTHERA · Anwendungsrahmen */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;
  const UI = KY.ui = {};
  KY.mod = KY.mod || {};

  UI.NAV = [
    { g: 'Lage', items: [
      { id: 'lage', n: 'Lagebild', d: 'Gesamtlage, Empfehlungen, offene Vorgänge' },
      { id: 'atlas', n: 'Atlas', d: 'Weltkarte mit Regionsdossiers' },
      { id: 'news', n: 'Nachrichtenlage', d: 'Weltpresse und öffentliche Aufmerksamkeit' },
    ] },
    { g: 'Steuerung', items: [
      { id: 'vorhaben', n: 'Vorhaben', d: 'Projekte planen, genehmigen, überwachen' },
      { id: 'kapital', n: 'Kapital', d: 'Beteiligungen, Märkte, Erträge' },
      { id: 'orbit', n: 'Flotte & Orbit', d: 'Satelliten, Schiffe, Rechenzentren, Bildaufklärung' },
      { id: 'forschung', n: 'Forschung', d: 'Forschungsprogramme und neue Fähigkeiten' },
    ] },
    { g: 'Kuratorium', items: [
      { id: 'kuratorium', n: 'Plenum', d: 'Beschlussvorlagen, Stimmen, Mehrheiten' },
      { id: 'netzwerk', n: 'Netzwerk', d: 'Partner, Fachleute, Beziehungen' },
      { id: 'komm', n: 'Kommunikation', d: 'Gesicherter Posteingang' },
    ] },
    { g: 'Analyse', items: [
      { id: 'pythia', n: 'PYTHIA', d: 'Analysesystem des Kuratoriums' },
      { id: 'depeschen', n: 'Depeschen', d: 'Verschlüsselte interne Meldungen' },
      { id: 'archiv', n: 'Archiv', d: 'Dokumente seit 1901' },
      { id: 'mechanismus', n: 'Mechanismus', d: 'Rekonstruktion des Fundstücks von 1901', hide: () => !KY.flag('mechView') },
      { id: 'sitz0', n: 'Sitz 0', d: 'Nullter Sitz', lockedName: '████', locked: () => !KY.S.story.ending },
    ] },
    { g: 'System', items: [
      { id: 'integritaet', n: 'Integrität', d: 'Netzknoten, Anomalien, Diskretion' },
      { id: 'terminal', n: 'Terminal', d: 'Direkter Befehlszugriff' },
      { id: 'protokoll', n: 'Protokoll', d: 'Lückenlose Aufzeichnung aller Vorgänge' },
      { id: 'system', n: 'Konfiguration', d: 'Darstellung, Ton, Sitzungsdaten' },
    ] },
  ];
  UI.navItem = id => { for (const g of UI.NAV) for (const it of g.items) if (it.id === id) return Object.assign({ grp: g.g }, it); return null; };

  UI.head = function (o) {
    return '<header class="mh"><div><div class="crumb">KYTHERA › ' + U.esc(o.crumb || '') + (o.code ? ' › <b>' + U.esc(o.code) + '</b>' : '') + '</div>' +
      '<h1>' + U.esc(o.title) + '</h1>' + (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') + '</div>' + (o.act ? '<div class="act">' + o.act + '</div>' : '') + '</header>';
  };

  /* ================= Aufbau ================= */
  UI.init = function () {
    const S = KY.S;
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="cls-bar" id="clsTop"></div>' +
      '<header class="hdr">' +
        '<button class="ib menu-btn" id="menuBtn" aria-label="Navigation öffnen">' + KY.I('menu') + '</button>' +
        '<div class="brand" id="brand">' + KY.seal(26) + '<div><div class="wm">KYTHERA</div><div class="ver">7.4.2 · SITZ IX</div></div></div>' +
        '<div class="res" id="resBar"></div>' +
        '<div class="hdr-r">' +
          '<div class="ls" id="lsBox" data-tip="Globale Lagestufe 1–5. Steigt mit Spannungen, kritischen Regionen und akuten Krisen."><span class="lbl">Lage</span><span class="boxes"><i></i><i></i><i></i><i></i><i></i></span><span class="mono" id="lsN"></span></div>' +
          '<div class="clock"><span class="lbl">UTC</span><span class="t" id="clkU"></span></div>' +
          '<div class="clock hide-xs"><span class="lbl">Ortszeit</span><span class="t" id="clkL"></span></div>' +
          '<div class="user"><div class="seat">IX</div><div class="nmw"><div class="nm" id="uName"></div><div class="lbl" id="uClr"></div></div></div>' +
          '<button class="ib" id="srchBtn" data-tip="Schnellzugriff (Strg+K)" aria-label="Schnellzugriff">' + KY.I('search') + '</button>' +
          '<button class="ib hide-m" id="sndBtn" data-tip="Ton ein/aus" aria-label="Ton">' + KY.I('sound') + '</button>' +
          '<button class="ib" id="ntfBtn" data-tip="Benachrichtigungen" aria-label="Benachrichtigungen">' + KY.I('bell') + '<span class="badge" id="ntfBadge" hidden></span></button>' +
          '<button class="ib hide-m" id="lockBtn" data-tip="Sitzung sperren" aria-label="Sitzung sperren">' + KY.I('lock') + '</button>' +
        '</div>' +
      '</header>' +
      '<div class="resb" id="resBar2"></div>' +
      '<nav class="nav" id="nav" aria-label="Hauptnavigation"></nav>' +
      '<main class="work" id="work"></main>' +
      '<footer class="sbar"><span class="seg-i"><i class="dot"></i><span id="sbConn">KY-N1</span></span><span class="seg-i hide-sm" id="sbSess"></span><span class="seg-i hide-sm" id="sbCyc"></span><div class="ticker" id="ticker"><div class="tr" id="tickerTr"></div></div><span class="seg-i hide-sm" style="border-left:1px solid var(--line);border-right:0">AES-256-GCM · ' + S.user.codename + '</span></footer>' +
      '<div class="cls-bar bot" id="clsBot"></div>';
    document.body.insertAdjacentHTML('beforeend', '<div class="toasts" id="toasts" aria-live="polite"></div><div class="scrim" id="scrim"></div><aside class="drawer" id="drawer" aria-label="Benachrichtigungen"></aside><div class="tip" id="tip" role="tooltip"></div>');
    UI.applyPrefs();
    UI.buildNav();
    UI.buildRes();
    UI.bind();
    UI.update();
    UI.renderTicker();
    const h = (location.hash || '').replace('#', '');
    UI.go(KY.mod[h] && UI.allowed(h) ? h : 'lage');
    KY.bus.on('tick', () => { UI.update(); if (UI.cur && KY.mod[UI.cur].tick) { try { KY.mod[UI.cur].tick(); } catch (e) { console.error(e); } } UI.crisisTick(); });
    KY.bus.on('notify', n => UI.toast(n));
    KY.bus.on('notifs', () => UI.updateBadges());
    ['msgs', 'dsp', 'council', 'projects', 'integ', 'story', 'clearance', 'research'].forEach(ev => KY.bus.on(ev, () => { UI.updateBadges(); UI.buildNav(); }));
    KY.bus.on('crisis', cr => { if (cr) UI.openCrisis(); else UI.closeCrisis(); });
    KY.bus.on('news', () => { clearTimeout(UI._tk); UI._tk = setTimeout(UI.renderTicker, 400); });
    KY.bus.on('ending', () => { UI.applyPrefs(); UI.buildNav(); });
    if (S.crisis) setTimeout(UI.openCrisis, 600);
    UI.idleWatch();
  };

  UI.applyPrefs = function () {
    const S = KY.S, p = S.user.prefs, root = document.documentElement;
    root.dataset.accent = p.accent;
    root.dataset.density = p.density;
    root.dataset.motion = p.motion ? 'an' : 'aus';
    document.body.classList.toggle('scan-fx', !!p.scan);
    const cls = 'STRENG GEHEIM // KURATORIUM // KY-ORCON // NUR FÜR SITZ ' + (S.story.ending === 'archon' ? '0' : 'IX') + ' // FREIGABE ' + S.user.clr;
    const t = document.getElementById('clsTop'), b = document.getElementById('clsBot');
    if (t) t.textContent = cls;
    if (b) b.textContent = cls;
    const sb = document.getElementById('sndBtn');
    if (sb) sb.innerHTML = KY.I(p.sound ? 'sound' : 'mute');
  };

  UI.allowed = function (id) {
    const it = UI.navItem(id);
    if (!it) return !!KY.mod[id];
    if (it.hide && it.hide()) return false;
    if (it.locked && it.locked()) return false;
    return true;
  };

  UI.buildNav = function () {
    const nav = document.getElementById('nav');
    if (!nav) return;
    let h = '';
    for (const g of UI.NAV) {
      h += '<div class="grp-l lbl">' + g.g + '</div>';
      for (const it of g.items) {
        if (it.hide && it.hide()) continue;
        const locked = it.locked && it.locked();
        h += '<a class="ni' + (UI.cur === it.id ? ' on' : '') + (locked ? ' locked' : '') + '" data-mod="' + it.id + '" data-tip="' + U.esc(locked ? 'Zugriff verweigert · Freigabestufe 5' : it.d) + '" tabindex="0" role="link">' +
          KY.I(it.id) + '<span>' + (locked ? it.lockedName : it.n) + '</span>' + (locked ? KY.I('lock', 'lock') : '<span class="badge" data-b="' + it.id + '" hidden></span>') + '</a>';
      }
    }
    const S = KY.S;
    h += '<div class="nav-f"><div class="mono">SITZUNG ' + S.meta.created.toString(36).toUpperCase().slice(-6) + '-' + (S.meta.sessions || 1) + '<br>KNOTEN KY-N1 · KAP ORSA<br>BUILD 1902-41</div></div>';
    nav.innerHTML = h;
    UI.updateBadges();
  };

  UI.updateBadges = function () {
    const S = KY.S;
    const set = (id, n, crit) => {
      const b = document.querySelector('[data-b="' + id + '"]');
      if (!b) return;
      b.hidden = !n;
      b.textContent = n > 99 ? '99+' : n;
      b.classList.toggle('crit', !!crit);
    };
    set('komm', S.msgs.filter(m => !m.read).length);
    set('depeschen', S.dsp.list.filter(d => d.enc && !d.decT && (d.flag || d.story)).length);
    set('kuratorium', S.council.open && !S.council.open.mine ? 1 : 0, true);
    set('vorhaben', S.projects.active.length);
    set('integritaet', S.integ.anomalies.filter(a => a.state === 'offen').length, S.integ.anomalies.some(a => a.state === 'offen' && a.sev >= 3));
    const fr = Object.keys(S.story.frags).length;
    set('archiv', 0);
    const nb = document.getElementById('ntfBadge');
    const un = S.notifs.filter(n => !n.read).length;
    if (nb) { nb.hidden = !un; nb.textContent = un > 99 ? '99+' : un; }
    void fr;
  };

  /* ---------- Ressourcenleiste ---------- */
  UI.RES = [
    { k: 'kap', l: 'Liquidität', tip: '<b>Liquidität</b>Frei verfügbares Kapital in Milliarden ¤. Zufluss aus Dividenden und Stiftungserträgen, abzüglich Unterhalt von Flotte, Satelliten und Rechenzentren.' },
    { k: 'nw', l: 'Vermögen', tip: '<b>Gesamtvermögen</b>Liquidität plus Marktwert aller Beteiligungen.' },
    { k: 'ein', l: 'Einfluss', tip: '<b>Einfluss</b>Politisches Kapital. Wächst mit Ihrer Präsenz in den Regionen. Benötigt für Vermittlung, Abkommen, Werben im Plenum und Anträge.' },
    { k: 'rech', l: 'Rechenzeit', tip: '<b>Rechenkontingent</b>EFLOP-Stunden aus Ihren Rechenzentren. Benötigt für Entschlüsselung, Bildaufklärung und Analysen.' },
    { k: 'disk', l: 'Diskretion', tip: '<b>Diskretion</b>Wie unsichtbar das Kuratorium bleibt. Sinkt durch sichtbare Vorhaben und Berichterstattung, erholt sich langsam. Unter 35 wird das Plenum unruhig.' },
    { k: 'ans', l: 'Ansehen', tip: '<b>Ansehen im Plenum</b>Ihr Gewicht unter den Sitzen. Steigt mit erfolgreichen Vorhaben und gewonnenen Abstimmungen.' },
  ];
  UI.buildRes = function () {
    const mk = () => UI.RES.map(r => '<div class="rc" data-tip="' + U.esc(r.tip) + '" data-rk="' + r.k + '"><span class="lbl">' + r.l + '</span><span class="row" style="gap:0;align-items:baseline"><span class="v"></span><span class="d"></span></span>' + (r.k === 'disk' || r.k === 'ans' ? '<span class="bar"><i></i></span>' : '') + '</div>').join('');
    document.getElementById('resBar').innerHTML = mk();
    document.getElementById('resBar2').innerHTML = mk();
  };
  UI.prev = {};
  UI.update = function () {
    const S = KY.S;
    const nw = KY.market.netWorth();
    const vals = {
      kap: [U.n(S.res.kap, 1), 'Mrd ¤'], nw: [U.n(nw, 1), 'Mrd ¤'], ein: [U.n(S.res.ein), ''], rech: [U.n(S.res.rech), 'EF'],
      disk: [U.n(S.res.disk), '/100'], ans: [U.n(S.res.ans), '/100'],
    };
    const raw = { kap: S.res.kap, nw, ein: S.res.ein, rech: S.res.rech, disk: S.res.disk, ans: S.res.ans };
    U.$$('.rc').forEach(el => {
      const k = el.dataset.rk, v = vals[k];
      const vEl = el.querySelector('.v');
      U.setHTML(vEl, v[0] + (v[1] ? '<small>' + v[1] + '</small>' : ''));
      const bar = el.querySelector('.bar i');
      if (bar) { bar.style.width = raw[k] + '%'; bar.style.background = 'var(--' + C.lvlCls(raw[k]) + ')'; }
      const dEl = el.querySelector('.d');
      const p = UI.prev[k];
      if (p !== undefined && Math.abs(raw[k] - p) > (k === 'kap' || k === 'nw' ? 0.25 : 0.6)) {
        const up = raw[k] > p;
        dEl.className = 'd ' + (up ? 'up' : 'dn');
        dEl.textContent = (up ? '▲' : '▼');
        clearTimeout(dEl._t);
        dEl._t = setTimeout(() => { dEl.textContent = ''; }, 2500);
      }
    });
    U.RES_T = (U.RES_T || 0) + 1;
    if (U.RES_T % 3 === 0) UI.prev = raw;
    const ls = document.getElementById('lsBox');
    if (ls) {
      ls.dataset.l = S.lagestufe;
      ls.querySelectorAll('.boxes i').forEach((b, i) => b.classList.toggle('on', i < S.lagestufe));
      U.setText(document.getElementById('lsN'), String(S.lagestufe));
    }
    const d = new Date();
    U.setText(document.getElementById('clkU'), U.clock(d, true));
    U.setText(document.getElementById('clkL'), U.clock(d));
    U.setText(document.getElementById('uName'), S.user.codename);
    U.setText(document.getElementById('uClr'), 'Freigabe ' + S.user.clr + (S.story.ending === 'archon' ? ' · ARCHON' : ''));
    const n1 = S.integ.nodes['KY-N1'];
    U.setText(document.getElementById('sbConn'), 'KY-N1 · ' + Math.round(n1.lat) + ' ms · Integrität ' + U.n(S.integ.level, 1) + ' %');
    U.setText(document.getElementById('sbSess'), 'Sitzungszeit ' + U.dur(S.t));
    const nextVote = S.council.open ? 'Abstimmung läuft · ' + U.dur(Math.max(0, S.council.open.until - S.t)) : 'Nächste Plenarvorlage ' + U.dur(Math.max(0, S.timers.council - S.t));
    U.setText(document.getElementById('sbCyc'), nextVote);
  };

  /* ---------- Laufband ---------- */
  UI.renderTicker = function () {
    const tr = document.getElementById('tickerTr');
    if (!tr) return;
    const items = KY.S.news.slice(0, 14);
    const html = items.map(n => '<span><b>' + U.esc(n.outlet) + '</b>' + U.esc(n.head) + '</span>').join('');
    tr.innerHTML = html + html;
    tr.style.animation = 'none';
    const w = tr.scrollWidth / 2;
    if (!UI._tickStyle) { UI._tickStyle = document.createElement('style'); document.head.appendChild(UI._tickStyle); }
    UI._tickStyle.textContent = '@keyframes tickerMove{from{transform:translate(0,-50%)}to{transform:translate(-' + w + 'px,-50%)}}';
    tr.style.animation = 'tickerMove ' + Math.max(40, w / 45) + 's linear infinite';
  };

  /* ================= Navigation ================= */
  UI.go = function (id, arg) {
    const S = KY.S;
    if (id === 'krise') { UI.openCrisis(true); return; }
    if (!KY.mod[id]) id = 'lage';
    if (!UI.allowed(id)) {
      if (id === 'sitz0') UI.denied();
      return;
    }
    UI.closeNav();
    if (UI.cur === id && KY.mod[id].arg) { KY.mod[id].arg(arg); return; }
    if (UI.cur && KY.mod[UI.cur].unmount) { try { KY.mod[UI.cur].unmount(); } catch (e) { console.error(e); } }
    UI.cur = id;
    const work = document.getElementById('work');
    work.innerHTML = '';
    work.scrollTop = 0;
    const el = document.createElement('div');
    el.className = 'mod';
    el.dataset.mod = id;
    work.appendChild(el);
    try { KY.mod[id].mount(el, arg); } catch (e) { console.error(e); el.innerHTML = '<div class="empty"><b>Modul konnte nicht geladen werden</b>' + U.esc(e.message) + '</div>'; }
    U.$$('.ni').forEach(n => n.classList.toggle('on', n.dataset.mod === id));
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* Rahmen erlaubt keine Adressänderung */ }
    if (KY.audio) KY.audio.play('nav');
    S.lastMod = id;
  };
  UI.doAct = function (act) {
    if (!act) return;
    if (act.plan) UI.go('vorhaben', { plan: act.plan });
    else UI.go(act.mod, act.arg);
  };
  UI.denied = function () {
    if (KY.audio) KY.audio.play('deny');
    UI.modal({
      lbl: 'Zugriff verweigert', title: 'Freigabestufe 5 erforderlich',
      body: '<p class="fg2">Dieser Bereich ist für Ihre Freigabestufe nicht verfügbar. Der Zugriffsversuch wurde protokolliert.</p><p class="mono small mut mt12">ERR 0x0000 · RESSOURCE: SITZ_0 · ANFORDERER: ' + U.esc(KY.S.user.codename) + ' (IX)</p>',
      actions: [{ label: 'Schließen', cls: 'pri' }],
    });
    KY.log('sys', 'Zugriff verweigert: Bereich ████ (Freigabestufe 5)');
  };
  UI.openNav = function () { document.getElementById('nav').classList.add('open'); document.getElementById('scrim').classList.add('on'); UI.scrimFor = 'nav'; };
  UI.closeNav = function () { const n = document.getElementById('nav'); if (n) n.classList.remove('open'); if (UI.scrimFor === 'nav') { document.getElementById('scrim').classList.remove('on'); UI.scrimFor = null; } };

  /* ================= Ereignisbindung ================= */
  UI.bind = function () {
    const S = KY.S;
    U.on(document.getElementById('nav'), 'click', '.ni', (e, a) => UI.go(a.dataset.mod));
    document.getElementById('nav').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('ni')) UI.go(e.target.dataset.mod); });
    document.getElementById('menuBtn').onclick = UI.openNav;
    document.getElementById('scrim').onclick = () => { UI.closeNav(); UI.closeDrawer(); };
    document.getElementById('ntfBtn').onclick = UI.openDrawer;
    document.getElementById('srchBtn').onclick = UI.palette;
    document.getElementById('lockBtn').onclick = () => UI.lock();
    document.getElementById('sndBtn').onclick = () => { S.user.prefs.sound = !S.user.prefs.sound; UI.applyPrefs(); if (S.user.prefs.sound) KY.audio.play('ok'); };
    let clicks = 0, ct;
    document.getElementById('brand').onclick = () => {
      clicks++; clearTimeout(ct); ct = setTimeout(() => { clicks = 0; }, 1600);
      if (clicks >= 7) { clicks = 0; UI.buildInfo(); }
    };
    U.on(document.getElementById('resBar'), 'click', '.rc', (e, el) => UI.resJump(el.dataset.rk));
    U.on(document.getElementById('resBar2'), 'click', '.rc', (e, el) => UI.resJump(el.dataset.rk));
    // Tooltips
    const tip = document.getElementById('tip');
    let tipT = null;
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tip.classList.remove('on'); return; }
      clearTimeout(tipT);
      tipT = setTimeout(() => {
        tip.innerHTML = t.dataset.tip.indexOf('<b>') === 0 ? t.dataset.tip : U.esc(t.dataset.tip);
        const r = t.getBoundingClientRect();
        tip.classList.add('on');
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
        if (y + th > window.innerHeight - 8) y = r.top - th - 8;
        tip.style.left = U.clamp(x, 8, window.innerWidth - tw - 8) + 'px';
        tip.style.top = Math.max(8, y) + 'px';
      }, 280);
    });
    document.addEventListener('mouseout', e => { if (e.target.closest('[data-tip]')) { clearTimeout(tipT); tip.classList.remove('on'); } });
    document.addEventListener('click', () => { tip.classList.remove('on'); }, true);
    // Tastatur
    document.addEventListener('keydown', e => {
      UI.lastAct = Date.now();
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); UI.palette(); return; }
      if (e.key === 'Escape') { if (UI.closeTop()) e.preventDefault(); return; }
      if (typing) return;
      if (e.key === '`' || e.key === '^') { e.preventDefault(); UI.go('terminal'); return; }
      if (e.key === '?') { UI.help(); return; }
      if (e.key === '/') { e.preventDefault(); UI.palette(); return; }
      if (/^[1-9]$/.test(e.key) && e.altKey) {
        const flat = []; UI.NAV.forEach(g => g.items.forEach(i => { if (UI.allowed(i.id)) flat.push(i.id); }));
        const id = flat[+e.key - 1]; if (id) UI.go(id);
      }
    });
    ['pointerdown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { UI.lastAct = Date.now(); }, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) KY.save(); });
    window.addEventListener('beforeunload', () => KY.save());
  };
  UI.resJump = function (k) {
    const map = { kap: 'kapital', nw: 'kapital', ein: 'kuratorium', rech: 'orbit', disk: 'integritaet', ans: 'kuratorium' };
    UI.go(map[k]);
  };

  /* ================= Dialoge ================= */
  UI.stack = [];
  UI.modal = function (o) {
    const ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = '<div class="mdl ' + (o.cls || '') + '" role="dialog" aria-modal="true">' + (o.noClose ? '' : '<button class="x" aria-label="Schließen">' + KY.I('x') + '</button>') +
      (o.title ? '<div class="mdl-h">' + (o.lbl ? '<div class="lbl">' + U.esc(o.lbl) + '</div>' : '') + '<h2>' + U.esc(o.title) + '</h2></div>' : '') +
      '<div class="mdl-b"></div>' + (o.actions && o.actions.length ? '<div class="mdl-f"></div>' : '') + '</div>';
    const body = ov.querySelector('.mdl-b');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    const close = () => { ov.remove(); UI.stack = UI.stack.filter(x => x !== api); if (o.onClose) o.onClose(); };
    const api = { el: ov, body, close, noEsc: o.noClose };
    if (o.actions) {
      const f = ov.querySelector('.mdl-f');
      o.actions.forEach(a => {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.cls || '');
        b.textContent = a.label;
        if (a.disabled) b.disabled = true;
        b.onclick = () => { if (a.fn && a.fn(api) === false) return; close(); };
        f.appendChild(b);
      });
    }
    if (!o.noClose) {
      ov.querySelector('.x').onclick = close;
      ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    }
    document.body.appendChild(ov);
    UI.stack.push(api);
    const first = ov.querySelector('input, .btn.pri, .btn');
    if (first && o.focus !== false) setTimeout(() => first.focus(), 30);
    return api;
  };
  UI.confirm = function (title, text, okLabel, fn, danger) {
    return UI.modal({ lbl: 'Bestätigung', title, body: '<p class="fg2">' + text + '</p>', actions: [{ label: 'Abbrechen', cls: 'ghost' }, { label: okLabel || 'Bestätigen', cls: danger ? 'dan' : 'pri', fn }] });
  };
  UI.closeTop = function () {
    if (document.querySelector('.cmdk-ovl')) { document.querySelector('.cmdk-ovl').remove(); return true; }
    const top = UI.stack[UI.stack.length - 1];
    if (top && !top.noEsc) { top.close(); return true; }
    if (document.getElementById('drawer').classList.contains('open')) { UI.closeDrawer(); return true; }
    if (document.getElementById('nav').classList.contains('open')) { UI.closeNav(); return true; }
    return false;
  };
  UI.flashMsg = function (text, lvl) {
    UI.toast({ title: text, lvl: lvl || 'info', cat: 'sys', local: true });
    if (KY.audio) KY.audio.play(lvl === 'crit' ? 'err' : lvl === 'ok' ? 'ok' : 'click');
  };

  /* ---------- Hinweise (Toasts) ---------- */
  UI.toast = function (n) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (n.lvl || '');
    t.innerHTML = '<div style="min-width:0"><div class="tc">' + U.esc(KY.CATS[n.cat] || 'System') + '</div><div class="tt">' + U.esc(n.title) + '</div>' + (n.text ? '<div class="tx">' + U.esc(n.text) + '</div>' : '') + '</div>';
    t.onclick = () => { if (n.link) UI.go(n.link.mod, n.link.arg); if (n.id) { n.read = true; UI.updateBadges(); } t.remove(); };
    box.prepend(t);
    while (box.children.length > (window.innerWidth < 760 ? 2 : 4)) box.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, n.lvl === 'crit' ? 7000 : 5200);
  };

  /* ---------- Benachrichtigungszentrale ---------- */
  UI.openDrawer = function () {
    const S = KY.S, d = document.getElementById('drawer');
    const render = () => {
      d.innerHTML = '<div class="pn-h"><h3>Benachrichtigungen</h3><div class="tools"><button class="btn sm ghost" id="ntfAll">Alle gelesen</button><button class="ib" style="width:36px;border:0" id="ntfX" aria-label="Schließen">' + KY.I('x') + '</button></div></div>' +
        '<div class="list">' + (S.notifs.length ? S.notifs.map(n => '<div class="li' + (n.read ? '' : ' unread') + '" data-n="' + n.id + '"><div class="ic" style="border-color:var(--' + (n.lvl === 'info' ? 'line2' : n.lvl) + ')">' + U.esc((KY.CATS[n.cat] || 'SYS').slice(0, 3).toUpperCase()) + '</div><div class="body"><div class="t">' + U.esc(n.title) + '</div>' + (n.text ? '<div class="small fg2 mt4">' + U.esc(n.text) + '</div>' : '') + '<div class="m">' + U.stamp(n.ts) + '</div></div></div>').join('') : '<div class="empty"><b>Keine Benachrichtigungen</b>Neue Ereignisse erscheinen hier.</div>') + '</div>';
      d.querySelector('#ntfX').onclick = UI.closeDrawer;
      d.querySelector('#ntfAll').onclick = () => { S.notifs.forEach(n => { n.read = true; }); render(); UI.updateBadges(); };
      U.on(d.querySelector('.list'), 'click', '.li', (e, el) => {
        const n = S.notifs.find(x => x.id === el.dataset.n);
        n.read = true; UI.updateBadges(); UI.closeDrawer();
        if (n.link) UI.go(n.link.mod, n.link.arg);
      });
    };
    render();
    d.classList.add('open');
    document.getElementById('scrim').classList.add('on');
    UI.scrimFor = 'drawer';
  };
  UI.closeDrawer = function () {
    document.getElementById('drawer').classList.remove('open');
    if (UI.scrimFor === 'drawer') { document.getElementById('scrim').classList.remove('on'); UI.scrimFor = null; }
  };

  /* ================= Krisenfenster ================= */
  UI.openCrisis = function (force) {
    const S = KY.S, cr = S.crisis;
    if (!cr) return;
    if (UI.crisisDlg && UI.crisisDlg.el.isConnected) return;
    if (UI.crisisMin && !force && UI.crisisMin === cr.id) return;
    UI.removeStrip();
    const body = document.createElement('div');
    const D = KY.data;
    const reg = cr.rid ? D.regions[cr.rid] : null;
    body.innerHTML = '<div class="cr-head"><div class="cr-ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="var(--line2)" stroke-width="4"/><circle id="crArc" cx="32" cy="32" r="28" fill="none" stroke="var(--crit)" stroke-width="4" stroke-dasharray="175.9" stroke-dashoffset="0"/></svg><div class="n" id="crN"></div></div>' +
      '<div style="min-width:0"><div class="row wrap gap4">' + C.pill(cr.kind === 'welt' ? 'Weltlage · Schwere ' + cr.sev : 'Interne Vorlage', cr.kind === 'welt' ? (cr.sev >= 3 ? 'crit' : 'ser') : 'info', true) + (reg ? C.pill(reg.name, 'plain') : '') + '</div>' +
      '<p class="fg2 mt8">' + U.esc(cr.text) + '</p></div></div>' +
      '<div class="lbl mt16" style="margin-bottom:8px">Optionen</div><div class="col" id="crOpts">' +
      cr.opts.map((o, i) => {
        const can = KY.canPay(o.cost);
        return '<button class="opt' + (i === cr.py ? ' py' : '') + (can ? '' : ' dis') + '" data-i="' + i + '"' + (can ? '' : ' aria-disabled="true"') + '><span class="on">' + String.fromCharCode(65 + i) + '</span><span style="min-width:0;flex:1"><span class="t">' + U.esc(o.t) + '</span>' +
          (i === cr.py ? ' ' + C.pill('PYTHIA-Empfehlung', 'acc') : '') + '<div class="d">' + U.esc(o.d) + '</div><div class="c">Kosten: ' + KY.costText(o.cost) + (can ? '' : ' · nicht verfügbar: ' + KY.missing(o.cost).join(', ')) + '</div></span></button>';
      }).join('') + '</div>' +
      '<p class="xs mut mt12">' + (S.story.ending === 'frei' ? 'Bei Fristablauf wird keine Maßnahme ergriffen.' : 'Bei Fristablauf setzt PYTHIA die markierte Empfehlung um (Betriebsregel 7).') + '</p>';
    UI.crisisDlg = UI.modal({
      cls: 'crisis', lbl: 'Priorität Alpha · Entscheidung erforderlich', title: cr.title, body, focus: false,
      actions: [{ label: 'Später entscheiden', cls: 'ghost', fn: () => { UI.crisisMin = cr.id; UI.showStrip(); } }],
      onClose: () => { UI.crisisDlg = null; if (KY.S.crisis) { UI.crisisMin = KY.S.crisis.id; UI.showStrip(); } },
    });
    U.on(body, 'click', '.opt', (e, b) => {
      if (b.classList.contains('dis')) { UI.flashMsg('Nicht genügend Mittel für diese Option.', 'crit'); return; }
      const i = +b.dataset.i;
      KY.crisis.choose(i, false);
    });
    UI.crisisTick();
    if (KY.audio) KY.audio.play('alert');
  };
  UI.closeCrisis = function () {
    UI.removeStrip();
    UI.crisisMin = null;
    if (UI.crisisDlg) { const d = UI.crisisDlg; UI.crisisDlg = null; d.el.remove(); UI.stack = UI.stack.filter(x => x !== d); }
  };
  UI.showStrip = function () {
    UI.removeStrip();
    const b = document.createElement('button');
    b.className = 'crisis-strip';
    b.id = 'crStrip';
    b.innerHTML = KY.I('warn') + '<span class="lt">Entscheidung erforderlich</span><span class="mono" id="crStripT"></span>';
    b.onclick = () => UI.openCrisis(true);
    document.querySelector('.hdr').appendChild(b);
    UI.crisisTick();
  };
  UI.removeStrip = function () { const s = document.getElementById('crStrip'); if (s) s.remove(); };
  UI.crisisTick = function () {
    const S = KY.S;
    if (!S.crisis) return;
    const rem = KY.crisis.remaining();
    const n = document.getElementById('crN');
    if (n) n.textContent = Math.ceil(rem);
    const arc = document.getElementById('crArc');
    if (arc) arc.setAttribute('stroke-dashoffset', (175.9 * (1 - rem / S.crisis.dur)).toFixed(1));
    const st = document.getElementById('crStripT');
    if (st) st.textContent = U.dur(rem);
    if (rem <= 10 && rem > 0 && KY.audio) KY.audio.play('click');
  };

  /* ================= Schnellzugriff ================= */
  UI.palette = function () {
    if (document.querySelector('.cmdk-ovl')) return;
    const S = KY.S, D = KY.data;
    const items = [];
    UI.NAV.forEach(g => g.items.forEach(i => { if (UI.allowed(i.id)) items.push({ k: 'Bereich', t: i.n, s: i.d, go: () => UI.go(i.id) }); }));
    D.regionOrder.forEach(id => items.push({ k: 'Region', t: D.regions[id].name, s: D.regions[id].cap, go: () => UI.go('atlas', id) }));
    D.companies.forEach(c => items.push({ k: 'Unternehmen', t: c.n, s: c.t, go: () => UI.go('kapital', c.t) }));
    D.people.forEach(p => items.push({ k: 'Person', t: p.n, s: p.role, go: () => UI.go('netzwerk', p.id) }));
    D.council.forEach(m => items.push({ k: 'Sitz', t: m.id, s: 'Sitz ' + m.seat + ' · ' + m.role, go: () => UI.go('kuratorium', m.id) }));
    D.archive.forEach(a => { if (a.clr <= S.user.clr) items.push({ k: 'Dokument', t: a.id + ' ' + a.title, s: a.date, go: () => UI.go('archiv', a.id) }); });
    Object.keys(D.projectTypes).forEach(t => { if (KY.proj.available(t)) items.push({ k: 'Vorhaben', t: D.projectTypes[t].name + ' planen', s: 'Neues Vorhaben', go: () => UI.go('vorhaben', { plan: { type: t } }) }); });
    items.push({ k: 'Befehl', t: 'Sitzung sperren', s: '', go: () => UI.lock() });
    items.push({ k: 'Befehl', t: 'Ton umschalten', s: '', go: () => { S.user.prefs.sound = !S.user.prefs.sound; UI.applyPrefs(); } });
    items.push({ k: 'Befehl', t: 'Tastaturkürzel anzeigen', s: '?', go: () => UI.help() });
    items.push({ k: 'Befehl', t: 'PYTHIA: Empfehlungen anfordern', s: '', go: () => UI.go('pythia', { ask: 'Was empfiehlst du?' }) });
    const ov = document.createElement('div');
    ov.className = 'ovl cmdk-ovl';
    ov.innerHTML = '<div class="cmdk" role="dialog" aria-label="Schnellzugriff"><input id="cmdkIn" placeholder="Bereich, Region, Person, Unternehmen, Dokument …" autocomplete="off" spellcheck="false"><div class="res-l" id="cmdkL"></div><div class="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> wählen</span><span><kbd>↵</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span></div></div>';
    document.body.appendChild(ov);
    const inp = ov.querySelector('input'), list = ov.querySelector('#cmdkL');
    let sel = 0, shown = [];
    const render = () => {
      const q = U.norm(inp.value.trim());
      shown = (q ? items.filter(i => U.norm(i.t + ' ' + i.s + ' ' + i.k).indexOf(q) >= 0) : items.filter(i => i.k === 'Bereich' || i.k === 'Befehl')).slice(0, 40);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length ? shown.map((i, n) => '<div class="it' + (n === sel ? ' on' : '') + '" data-i="' + n + '"><span class="k">' + i.k + '</span><span class="ell">' + U.esc(i.t) + '</span><span class="s ell">' + U.esc(i.s) + '</span></div>').join('') : '<div class="empty">Keine Treffer</div>';
      const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const run = i => { ov.remove(); if (shown[i]) shown[i].go(); };
    inp.addEventListener('input', () => { sel = 0; render(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); render(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      if (e.key === 'Enter') run(sel);
      if (e.key === 'Escape') ov.remove();
    });
    U.on(list, 'click', '.it', (e, el) => run(+el.dataset.i));
    ov.addEventListener('pointerdown', e => { if (e.target === ov) ov.remove(); });
    render();
    setTimeout(() => inp.focus(), 20);
  };

  UI.help = function () {
    UI.modal({
      lbl: 'Bedienung', title: 'Tastaturkürzel und Hinweise',
      body: '<div class="kv" style="font-size:13px;gap:9px 18px"><dt><kbd>Strg</kbd> + <kbd>K</kbd> oder <kbd>/</kbd></dt><dd>Schnellzugriff auf alles</dd><dt><kbd>`</kbd></dt><dd>Terminal öffnen</dd><dt><kbd>Alt</kbd> + <kbd>1</kbd>…<kbd>9</kbd></dt><dd>Bereiche direkt wechseln</dd><dt><kbd>Esc</kbd></dt><dd>Dialog schließen</dd><dt><kbd>?</kbd></dt><dd>Diese Übersicht</dd></div>' +
        '<p class="fg2 mt16">Fast jede Zahl erklärt sich, wenn Sie mit dem Mauszeiger darauf zeigen. Die Ressourcen in der Kopfzeile führen per Klick in den zuständigen Bereich. PYTHIA beantwortet Fragen in natürlicher Sprache.</p>',
      actions: [{ label: 'Verstanden', cls: 'pri' }],
    });
  };

  UI.buildInfo = function () {
    const S = KY.S;
    KY.flag('buildInfo', true);
    if (KY.audio) KY.audio.play('glitch');
    UI.modal({
      lbl: 'Systeminformation', title: 'KYTHERA 7.4.2',
      body: '<pre class="mono small fg2" style="white-space:pre-wrap;margin:0">Build            1902-41\nKern             PYTHIA 31.0 (seit 21.10.1987)\nEmulation        KY-3 (37 Zahnräder, 1 Ring)\nKnoten           9 (8 sichtbar)\nSitze            9 + 0\nBetriebsregel 7  aktiv\nSitzung          ' + U.dur(S.t) + '\nLetzter Login IX ' + (S.meta.boots > 1 ? U.stamp(S.meta.lastSeen) : '10.09.2026 03:12:44 (IX-alt)') + '\n\nUrsprung         34°12′ N · 21°24′ O</pre>',
      actions: [{ label: 'Schließen', cls: 'ghost' }],
    });
  };

  /* ================= Abwesenheit ================= */
  UI.absence = function (sum) {
    if (!sum || sum.sec < 30) return;
    UI.modal({
      lbl: 'Während Ihrer Abwesenheit', title: 'Lagezusammenfassung · ' + U.dur(sum.sec) + ' simuliert',
      body: '<div class="g g3"><div class="kpi"><span class="lbl">Vermögensänderung</span><span class="v">' + U.sgn(sum.nw, 1) + '<small>Mrd ¤</small></span></div><div class="kpi"><span class="lbl">Weltereignisse</span><span class="v">' + sum.events + '</span></div><div class="kpi"><span class="lbl">Vorhaben beendet</span><span class="v">' + sum.projects + '</span></div>' +
        '<div class="kpi"><span class="lbl">Plenarbeschlüsse</span><span class="v">' + sum.votes + '</span></div><div class="kpi"><span class="lbl">Neue Nachrichten</span><span class="v">' + sum.msgs + '</span></div><div class="kpi"><span class="lbl">Betriebsregel 7</span><span class="v">' + sum.regel7 + '</span></div></div>' +
        (sum.regel7 ? '<p class="fg2 mt12">In Ihrer Abwesenheit hat PYTHIA ' + (sum.regel7 === 1 ? 'eine Krisenentscheidung' : sum.regel7 + ' Krisenentscheidungen') + ' nach Betriebsregel 7 getroffen.</p>' : '') +
        '<div class="lbl mt16">Letzte Einträge</div><div class="mono small fg2 mt8" style="line-height:1.7">' + sum.lines.map(l => '› ' + U.esc(l)).join('<br>') + '</div>',
      actions: [{ label: 'Protokoll öffnen', cls: 'ghost', fn: () => UI.go('protokoll') }, { label: 'Zur Lage', cls: 'pri' }],
    });
  };

  /* ================= Sperre ================= */
  UI.idleWatch = function () {
    UI.lastAct = Date.now();
    setInterval(() => {
      if (!document.querySelector('.lockscreen') && Date.now() - UI.lastAct > 6 * 60 * 1000 && !document.hidden) UI.lock(true);
    }, 15000);
  };
  UI.lock = function (auto) {
    if (document.querySelector('.lockscreen')) return;
    const S = KY.S;
    KY.log('sys', auto ? 'Sitzung nach Inaktivität gesperrt' : 'Sitzung manuell gesperrt');
    KY.save();
    const el = document.createElement('div');
    el.className = 'lockscreen';
    el.innerHTML = '<canvas width="640" height="640"></canvas><div class="lbl" style="letter-spacing:.3em">Sitzung gesperrt</div><div class="serif" style="font-size:22px">' + U.esc(S.user.codename) + ' · Sitz IX</div><p class="mut small">Die Simulation läuft im Hintergrund weiter.</p><button class="btn pri lg" id="unlockBtn">Entsperren</button>';
    document.body.appendChild(el);
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
    let alive = true;
    const draw = now => {
      if (!alive) return;
      ctx.clearRect(0, 0, 640, 640);
      ctx.save(); ctx.translate(320, 320);
      const rings = [[60, 1, 6], [105, -0.6, 9], [150, 0.35, 12], [200, -0.22, 18], [255, 0.12, 27]];
      rings.forEach(([r, sp, n], k) => {
        ctx.strokeStyle = 'rgba(201,165,92,' + (0.12 + k * 0.03) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < n; i++) {
          const a = now / 1000 * sp * 0.4 + i / n * Math.PI * 2;
          ctx.fillStyle = i === 0 ? 'rgba(236,208,150,0.95)' : 'rgba(201,165,92,0.35)';
          ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, i === 0 ? 4 : 1.5, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.fillStyle = 'rgba(236,208,150,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    el.querySelector('#unlockBtn').onclick = () => {
      alive = false; el.remove(); UI.lastAct = Date.now();
      KY.log('sys', 'Sitzung entsperrt');
      if (KY.audio) KY.audio.play('grant');
    };
  };
})();
