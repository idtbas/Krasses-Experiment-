/* KYTHERA · MANDAT · Start: Titel, neues Mandat, Weltaufbau, Laden */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, SIM = KY.sim;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const B = (KY.boot = {});
  let world = null, uiReady = false;

  const show = id => ['#title', '#contracts', '#build', '#game'].forEach(s => U.$(s).classList.toggle('hidden', s !== id));

  /* ---------- Titel ---------- */
  B.title = function () {
    show('#title');
    const t = U.$('#title');
    const slots = SIM.slots.map(s => ({ s, m: SIM.meta(s) })).filter(x => x.m);
    t.innerHTML = `<canvas class="bgmap" id="t-bg"></canvas><div class="veil"></div>
      <div class="inner"><div class="brand"><div class="seal">${KY.sealSvg(64)}</div><div class="kicker">Streng vertraulich · Mandat</div><h1>KYTHERA<small>MANDAT</small></h1>
      <p>Ein Vermögen, das größer ist als die Wirtschaft ganzer Staaten. Eine Welt voller Menschen, denen Sie nie begegnen werden. Niemand kennt Ihren Namen – und jede Ihrer Entscheidungen hat Folgen.</p></div>
      <div class="menu"><button class="btn primary" id="t-new">Neues Mandat <span>${ic('arrowR', 16)}</span></button>
      <button class="btn" id="t-sb" style="height:48px;justify-content:space-between;padding:0 18px">Freie Sandbox · Weltregie <span>${ic('globe', 16)}</span></button>
      <div class="dim" style="font-size:11.5px;margin:-2px 2px 4px">Ohne Verträge, ohne Geldsorgen, alle Werkzeuge frei. Die Welt reagiert trotzdem auf alles.</div>
      ${slots.length ? `<div class="lbl" style="margin-top:10px">Mandat fortsetzen</div><div class="slots">${slots.map(x => `<button class="slot" data-slot="${x.s}"><span><b>${esc(x.m.codename)}</b><br><span class="dim" style="font-size:12px">${x.s === 'auto' ? 'Automatische Sicherung' : 'Speicherplatz ' + x.s} · ${U.dateStr(x.m.day, true)}</span></span><span class="dim" style="font-size:11px;text-align:right">${x.m.projects} Vorhaben${x.m.exposed ? '<br><span class="bad">öffentlich</span>' : ''}</span></button>`).join('')}</div>` : ''}
      <button class="btn ghost" id="t-imp" style="margin-top:4px">${ic('upload', 14)} Spielstand importieren</button></div></div>
      <div class="foot"><span>Für iPad im Querformat mit Magic Keyboard</span><span><span class="kbd">⌘</span> <span class="kbd">K</span> Suche</span><span><span class="kbd">Leertaste</span> Zeit</span><span>Fiktives Rollenspiel</span></div>`;
    // Hintergrund: eine zufällige, unscharfe Welt
    setTimeout(async () => {
      const cv = U.$('#t-bg');
      if (!cv) return;
      const w = await KY.gen.generate(1000 + Math.floor(Math.random() * 90000));
      const px = KY.paint.paint(w, 800, 400);
      cv.width = 800; cv.height = 400;
      cv.getContext('2d').putImageData(new ImageData(px, 800, 400), 0, 0);
    }, 60);
    U.$('#t-new').addEventListener('click', () => { KY.audio.unlock(); KY.audio.play('boot'); B.newMandate(); });
    U.$('#t-sb').addEventListener('click', () => { KY.audio.unlock(); KY.audio.play('boot'); B.newSandbox(); });
    U.$$('.slot', t).forEach(b => b.addEventListener('click', () => { KY.audio.unlock(); B.loadSlot(b.dataset.slot); }));
    U.$('#t-imp').addEventListener('click', () => {
      KY.audio.unlock();
      const txt = window.prompt('Exportierten Spielstand einfügen:');
      if (!txt) return;
      const S = SIM.importSave(txt);
      if (S) B.startLoaded(S); else window.alert('Ungültiger Spielstand.');
    });
  };
  B.toTitle = function () { if (KY.ui) KY.ui.running = false; B.title(); };

  /* ---------- Neues Mandat ---------- */
  B.newMandate = function () {
    if (KY.ui) KY.ui.running = false;
    show('#contracts');
    const seed = 10000 + Math.floor(Math.random() * 899999);
    KY.contracts.run({ seed, akz: 'KY-' + seed, done: r => build(r.seed, (W) => SIM.newGame(W, r.vals, { sig: r.sig, initials: r.initials }), true) });
  };

  /* ---------- Freie Sandbox ---------- */
  B.newSandbox = function () {
    if (KY.ui) KY.ui.running = false;
    const seed = 10000 + Math.floor(Math.random() * 899999);
    const vals = { codename: 'Regie', jurisdiction: 'holmvik', trustee: 'castellan', strategy: 'bal', deadline: '7', fund: '1', envoy: 'vidal', principles: [] };
    build(seed, W => SIM.newGame(W, vals, { mode: 'sandbox' }), true);
  };

  /* ---------- Weltaufbau ---------- */
  async function build(seed, makeState, isNew) {
    show('#build');
    const b = U.$('#build');
    b.innerHTML = `<div class="box"><div class="seal">${KY.sealSvg(54)}</div><h2>${isNew ? 'Die Welt wird übergeben' : 'Das Mandat wird wieder aufgenommen'}</h2><div class="dim">Aktenzeichen ${seed}</div><div class="bar2"><i id="bd-bar"></i></div><div class="log" id="bd-log"></div></div>`;
    const log = (t) => { const l = U.$('#bd-log'); if (!l) return; l.insertAdjacentHTML('beforeend', '<div>› ' + esc(t) + '</div>'); while (l.children.length > 7) l.firstElementChild.remove(); };
    const bar = f => { const e = U.$('#bd-bar'); if (e) e.style.width = Math.round(f * 100) + '%'; };
    let lastMsg = '';
    const prog = (base, span) => (f, msg) => { bar(base + f * span); if (msg && msg !== lastMsg) { lastMsg = msg; log(msg); } };
    await new Promise(r => setTimeout(r, 60));
    world = await KY.gen.generate(seed, prog(0, 0.55));
    await KY.map.prepare(world, prog(0.55, 0.35));
    log('Staaten, Regierungen und Medien werden eingerichtet');
    bar(0.95);
    await new Promise(r => setTimeout(r, 30));
    const S = makeState(world);
    log('Verschlüsselter Kanal steht');
    bar(1);
    await new Promise(r => setTimeout(r, 350));
    start(S, world, isNew);
  }

  function start(S, W, isNew) {
    show('#game');
    KY.engine.start(S, W, isNew);
    if (!uiReady) { KY.ui.init(); uiReady = true; }
    KY.map.init(U.$('#map'), W);
    KY.audio.setOn(S.ui.sound !== false);
    KY.ui.closePanel(); KY.ui.closeInsp();
    KY.ui.start();
    KY.ui.rebuildDock();
    if (KY.ui.renderRegiebar) KY.ui.renderRegiebar();
    if (isNew) {
      KY.ui.save('auto');
      setTimeout(S.mode === 'sandbox' ? sandboxIntro : briefing, 500);
    } else {
      KY.ui.toast({ t: 'Willkommen zurück', d: S.codename + ' · ' + U.dateStr(S.day), icon: 'seal', kind: 'good' });
    }
  }

  function briefing() {
    const S = SIM.S;
    const m = KY.ui.modal({
      cls: 'w560', html: `<div class="mh">${KY.ui.advAvatar('haddad', 40)}<div class="tt"><div class="lbl">Erster Mandatstag · ${U.dateStr(0)}</div><h2>Willkommen, ${esc(S.codename)}.</h2></div></div>
      <div class="mb"><p class="note" style="font-size:13.5px">Ich bin Leila Haddad und leite Ihren Krisenstab. Ab heute verwalten Sie ${U.money(S.fin.cash)}. Die Zeit steht still, bis Sie sie mit der <span class="kbd">Leertaste</span> in Gang setzen.</p>
      <div class="col" style="margin-top:12px">
        <div class="row">${ic('globe', 18)}<div class="note"><b style="color:var(--text)">Sehen Sie sich die Welt an.</b> Wischen Sie mit zwei Fingern, zoomen Sie mit Zusammenziehen. Ein Klick auf einen Staat zeigt, wie es den Menschen dort geht.</div></div>
        <div class="row">${ic('plus', 18)}<div class="note"><b style="color:var(--text)">Handeln Sie.</b> Der Katalog (<span class="kbd">A</span>) enthält ${KY.data.ACTIONS.length} Handlungen – vom Krankenhaus bis zur Vermittlung zwischen verfeindeten Staaten.</div></div>
        <div class="row">${ic('scale', 18)}<div class="note"><b style="color:var(--text)">Tragen Sie die Folgen.</b> Wenn etwas geschieht, rufe ich Sie an. Dann brauchen wir Ihre Entscheidung, nicht Ihre Ausreden.</div></div>
        <div class="row">${ic('inbox', 18)}<div class="note"><b style="color:var(--text)">Lesen Sie den Kanal.</b> Ihr Stab hat Ihnen bereits geschrieben (<span class="kbd">K</span>).</div></div>
      </div></div><div class="mf"><button class="btn ghost" data-a="mclose" id="br-help">Einweisung lesen</button><button class="btn primary" data-a="mclose" id="br-ok">Verstanden</button></div>`,
    });
    U.$('#br-help', m.el).addEventListener('click', () => setTimeout(() => KY.ui.panel('hilfe'), 50));
    U.$('#br-ok', m.el).addEventListener('click', () => setTimeout(() => KY.ui.panel('lage'), 50));
  }

  function sandboxIntro() {
    const m = KY.ui.modal({
      cls: 'w560', html: `<div class="mh"><div style="color:var(--gold)">${KY.sealSvg(40)}</div><div class="tt"><div class="lbl">Freie Sandbox</div><h2>Die Welt gehört Ihnen.</h2></div></div>
      <div class="mb"><div class="col">
        <div class="row">${ic('sliders', 18)}<div class="note"><b style="color:var(--text)">Weltregie</b> (<span class="kbd">W</span>): Erdbeben, Tsunamis, Vulkane, Meteoriten, Seuchen, Börsencrashs, Rohstofffunde, Neuwahlen, Annäherung und Eiszeit zwischen Staaten.</div></div>
        <div class="row">${ic('sat', 18)}<div class="note"><b style="color:var(--text)">Orbitale Leitstelle</b> (<span class="kbd">U</span>): Raketen starten, Satellitenflotten aufbauen, eine Raumstation errichten.</div></div>
        <div class="row">${ic('plus', 18)}<div class="note"><b style="color:var(--text)">Alle Vorhaben</b> (<span class="kbd">A</span>): unbegrenztes Geld, jede Genehmigung wird erteilt.</div></div>
        <div class="row">${ic('users', 18)}<div class="note"><b style="color:var(--text)">Die Welt reagiert:</b> Regierungen, Wahlen, Medien und fünf Bevölkerungsgruppen erleben alles als echte Ereignisse. Klicken Sie auf einen Staat, um seine Werte direkt zu verändern.</div></div>
      </div></div><div class="mf"><button class="btn primary" data-a="mclose" id="sbi-ok">Los geht’s</button></div>`,
    });
    U.$('#sbi-ok', m.el).addEventListener('click', () => setTimeout(() => KY.ui.panel('regie'), 50));
  }

  /* ---------- Laden ---------- */
  B.loadSlot = function (slot) {
    const S = SIM.load(slot);
    if (!S) { KY.ui && KY.ui.toast ? KY.ui.toast({ t: 'Spielstand nicht lesbar', icon: 'x', kind: 'crit' }) : window.alert('Spielstand nicht lesbar.'); return; }
    B.startLoaded(S);
  };
  B.startLoaded = function (S) {
    if (KY.ui) KY.ui.running = false;
    S.paused = true;
    build(S.seed, () => S, false);
  };

  /* ---------- Hinweis für Hochformat und kleine Bildschirme ---------- */
  B.init = function () {
    const n = U.$('#notice-portrait');
    n.innerHTML = `<div class="box"><div style="color:var(--gold)">${KY.sealSvg(54)}</div><h2>Bitte im Querformat verwenden</h2><p class="note" style="font-size:13px">KYTHERA · MANDAT ist für das iPad im Querformat mit Magic Keyboard gestaltet. Drehen Sie das Gerät oder vergrößern Sie das Fenster.</p><button class="btn ghost sm" id="np-skip" style="margin-top:12px">Trotzdem fortfahren</button></div>`;
    U.$('#np-skip').addEventListener('click', () => n.classList.remove('on'));
    document.addEventListener('pointerdown', () => KY.audio.unlock(), { once: true });
    document.addEventListener('keydown', () => KY.audio.unlock(), { once: true });
    // Kein Seitenzoom durch Gesten oder Doppeltippen
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); }, { passive: false });
    B.title();
  };
})();
