/* VistoOS · emulator/emulator.js — die Handy-Seite um das Gerät herum
 *
 *  Zeigt das runde Display im Gerät (Metallring, Glas, Hals, Sockel mit Lichtleiste und Taste),
 *  darunter die „Stimme“ (Texteingabe, Mikrofon, Vorschläge) und ein Bedienfeld für den Emulator.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  let host, deviceEl, glass, baseLight, input, sendBtn, micBtn, sheet, sheetBack, stats = {};

  const CHIPS = ['Wie spät ist es?', 'Timer 5 Minuten', 'Wie wird das Wetter morgen?', 'Mach das Licht aus', 'Erzähl einen Witz', 'Was ist 17 mal 23?', 'Spiel entspannte Musik', 'Weck mich morgen um 7', 'Starte eine Atemübung', 'Mach es lila'];

  function logo() {
    return `<svg class="emu-logo" viewBox="0 0 32 32"><defs><linearGradient id="emuG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#46E6FF"/><stop offset=".5" stop-color="#A26BFF"/><stop offset="1" stop-color="#FF7AB8"/></linearGradient></defs><circle cx="16" cy="16" r="10" fill="none" stroke="url(#emuG)" stroke-width="2.6"/><rect x="12" y="13" width="2.4" height="5.6" rx="1.2" fill="#fff"/><rect x="17.6" y="13" width="2.4" height="5.6" rx="1.2" fill="#fff"/></svg>`;
  }

  function size() {
    const w = window.innerWidth, h = window.innerHeight;
    const full = document.body.classList.contains('emu-full');
    // Handy quer: Gerät links, Eingabe rechts (sonst passt das Display nicht auf den Bildschirm)
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // Tablet quer ebenso
    const land = !full && w > h && w >= 500 && (h <= 600 || (coarse && w >= h * 1.15));
    document.body.classList.toggle('emu-land', land);
    const ring = 2 * (0.028 + 0.022);           // Rahmen relativ zu D
    let D;
    if (full) D = Math.min(w - 24, h - 24) / (1 + ring);
    else if (land) {
      // Höhe: Rahmen + Hals/Sockel (~0,18 D) + Ränder; Breite: rechts bleiben mind. 260 px für die Eingabe
      D = Math.max(180, Math.min((h - 30) / (1 + ring + 0.18), (w - 32 - 16 - 260) / (1 + ring)));
    } else {
      // Breite bis 720 px (Tablet), solange die Höhe reicht
      const maxW = Math.min(w - 32, 720) / (1 + ring);
      const maxH = (h - 300) / (1 + ring + 0.2);
      D = Math.max(220, Math.min(maxW, Math.max(maxH, Math.min(maxW, 300))));
    }
    D = Math.floor(D);
    document.documentElement.style.setProperty('--D', D + 'px');
    V.display.resize(D);
  }

  function row(title, sub, control) {
    return U.el('div', { class: 'emu-row' }, U.el('div', null, U.el('b', { text: title }), sub ? U.el('small', { text: sub }) : null), control);
  }
  function switchEl(on, fn) {
    const inp = U.el('input', { attrs: { type: 'checkbox' } });
    inp.checked = on;
    inp.addEventListener('change', () => fn(inp.checked));
    return U.el('label', { class: 'emu-switch' }, inp, U.el('i'));
  }

  function buildSheet() {
    sheetBack = U.el('div', { class: 'emu-sheet-back', on: { click: () => toggleSheet(false) } });
    sheet = U.el('div', { class: 'emu-sheet', attrs: { role: 'dialog', 'aria-label': 'Emulator' } });
    const st = U.el('div', { class: 'emu-stats' });
    for (const [k, l] of [['hz', 'Handy-Display'], ['fps', 'Bilder/s'], ['target', 'Visto-Display']]) {
      const b = U.el('b', { text: '–' });
      stats[k] = b;
      st.appendChild(U.el('div', { class: 'emu-stat' }, b, U.el('span', { text: l })));
    }
    stats.target.textContent = '90 Hz';
    const lux = U.el('input', { class: 'emu-range', attrs: { type: 'range', min: 0, max: 100, value: Math.round(V.ambient.lux * 100) } });
    lux.addEventListener('input', () => { V.platform.light.set(lux.value / 100); });   // simulierter Sensor der Plattformschicht
    V.platform.light.onChange((v) => { if (document.activeElement !== lux) lux.value = Math.round(v * 100); });
    const slow = U.el('input', { class: 'emu-range', attrs: { type: 'range', min: 10, max: 100, value: 100 } });
    slow.addEventListener('input', () => { V.loop.slow = slow.value / 100; });
    sheet.append(
      U.el('div', { class: 'grab' }),
      U.el('div', { class: 'emu-sheet-head' }, U.el('h3', { text: 'Emulator' }),
        U.el('button', { class: 'emu-iconbtn', attrs: { type: 'button', 'aria-label': 'Schließen' }, html: V.icon('close'), on: { click: () => toggleSheet(false) } })),
      U.el('p', { class: 'sub', text: 'Visto V1 · 7″ OLED, kreisrund, 1080 × 1080, 90 Hz. Dieses Display ist maßstabsgetreu verkleinert.' }),
      st,
      claudeRow(),
      cameraRow(),
      row('90-Hz-Taktung', 'Zeichnet genau wie das echte Display höchstens 90 Bilder pro Sekunde.', switchEl(V.loop.cap90, (v) => { V.loop.cap90 = v; V.platform.storage.set('vistoos.cap90', v ? '1' : '0'); })),
      row('Umgebungslicht', 'Simulierter Lichtsensor für die automatische Helligkeit.', lux),
      row('Zeitlupe', 'Alle Animationen verlangsamt ansehen.', slow),
      row('Ruhemodus jetzt', 'Display dimmt wie nach längerer Pause.', U.el('button', { class: 'emu-btn', text: 'Dimmen', on: { click: () => { toggleSheet(false); V.shell.home(); setTimeout(() => V.ambient.sleep(), 700); } } })),
      row('Nur Display', 'Gerät, Sockel und Eingabe ausblenden.', U.el('button', { class: 'emu-btn', text: 'Vollbild', on: { click: () => { toggleSheet(false); setFull(true); } } })),
      deviceRow(),
      row('Neu einrichten', 'Setzt Visto auf Werkszustand zurück und startet die Einrichtung.', resetBtn()),
      U.el('div', { class: 'emu-foot', html: `VistoOS ${V.version} · Build ${V.build}<br>Wischen, Tippen, Halten und Drehen am Rand funktionieren wie auf dem Gerät.` }),
    );
    document.body.append(sheetBack, sheet);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('on')) toggleSheet(false); });
    setInterval(() => {
      if (!sheet.classList.contains('on')) return;
      stats.hz.textContent = V.loop.hz + ' Hz';
      stats.fps.textContent = String(V.loop.fps);
    }, 400);
  }
  /** Gerätemodus (device.html): das OS allein, so wie es der Linux-Kiosk startet. Nur wo die Seite daneben liegt
   *  (nicht in der gebauten Einzeldatei bzw. im Artefakt). */
  function deviceRow() {
    if (!document.querySelector('script[src$="js/main.js"]')) return document.createDocumentFragment();
    return row('Gerätemodus', 'Das OS allein, ohne Emulator – genau so läuft es auf dem Gerät.', U.el('button', { class: 'emu-btn', text: 'Öffnen', on: { click: () => { location.href = 'device.html' + (V.store.get('setupDone') ? '?skip' : ''); } } }));
  }
  /** Claude verbinden: eigener API-Schlüssel der Organisation, bleibt nur in diesem Browser */
  /* ------------------------------------------------------------ Kamera */
  // Visto nutzt die Frontkamera des Handys – am Gerät selbst ändert sich optisch nichts.
  function cameraRow() {
    const wrap = U.el('div', { class: 'emu-claude' });
    const msg = U.el('p', { class: 'emu-claude-msg' });
    const inp = U.el('input', { attrs: { type: 'checkbox', id: 'emu-camera' } });
    const sw = U.el('label', { class: 'emu-switch' }, inp, U.el('i'));
    inp.addEventListener('change', async () => {
      if (!inp.checked) { V.presence.off(); msg.textContent = 'Kamera aus.'; return; }
      msg.textContent = 'Kamera wird gestartet …';
      const ok = await V.presence.start('camera');
      inp.checked = ok;
      msg.textContent = ok ? 'Die Frontkamera läuft. Bewege den Kopf: Visto schaut dich an.' : 'Die Kamera ließ sich nicht starten. Bitte erlaube den Kamerazugriff im Browser.';
    });
    V.on('presence:source', (src) => { inp.checked = src === 'camera'; });
    const note = U.el('p', { class: 'emu-claude-note', text: 'Visto nutzt die Frontkamera deines Handys: Die Augen folgen deinem Gesicht, Hinschauen weckt das Display, Weggehen dimmt es früher, aus der Ferne wird die Uhr größer. Alles wird nur auf deinem Gerät ausgewertet.' });
    wrap.append(row('Kamera', 'Frontkamera des Handys', sw), msg, note);
    return wrap;
  }

  function claudeRow() {
    const wrap = U.el('div', { class: 'emu-claude' });
    const status = U.el('small');
    const btn = U.el('button', { class: 'emu-btn', attrs: { type: 'button' } });
    const panel = U.el('div', { class: 'emu-claude-panel', attrs: { hidden: true } });
    const key = U.el('input', { attrs: { id: 'emu-claude-key', type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Anthropic-API-Schlüssel' } });
    const sel = U.el('select', { attrs: { id: 'emu-claude-model', 'aria-label': 'Modell' } });
    for (const m of V.claude.MODELS) sel.appendChild(U.el('option', { attrs: { value: m.id }, text: m.label }));
    sel.value = V.claude.model;
    const go = U.el('button', { class: 'emu-btn primary', text: 'Verbinden und testen', attrs: { type: 'button' } });
    const off = U.el('button', { class: 'emu-btn danger', text: 'Trennen', attrs: { type: 'button' } });
    const msg = U.el('p', { class: 'emu-claude-msg' });
    const note = U.el('p', { class: 'emu-claude-note', text: 'Den Schlüssel erstellst du in der Claude Console deiner Organisation (platform.claude.com → API Keys). Er wird nur in diesem Browser gespeichert und direkt an Anthropic gesendet – nutze ihn nur auf deinem eigenen Gerät. Im Claude-Artefakt braucht Visto keinen Schlüssel.' });
    panel.append(U.el('label', { attrs: { for: 'emu-claude-key' }, text: 'API-Schlüssel' }), key, U.el('label', { attrs: { for: 'emu-claude-model' }, text: 'Modell' }), sel, U.el('div', { class: 'emu-claude-acts' }, go, off), msg, note);
    function refresh() {
      const src = V.brain.claudeSource;
      status.textContent = src === 'api' ? 'Verbunden · ' + (V.claude.MODELS.find((m) => m.id === V.claude.model) || { label: V.claude.model }).label.split(' (')[0]
        : src === 'artifact' ? 'Verbunden über dein Claude-Konto (Artefakt)' : 'Nicht verbunden · Visto antwortet nur lokal';
      btn.textContent = V.claude.configured ? 'Ändern' : 'Verbinden';
      off.hidden = !V.claude.configured;
    }
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) key.focus(); });
    sel.addEventListener('change', () => { V.claude.setModel(sel.value); refresh(); });
    off.addEventListener('click', () => { V.claude.setKey(''); key.value = ''; msg.textContent = 'Getrennt.'; refresh(); });
    go.addEventListener('click', async () => {
      const k = key.value.trim();
      if (k) V.claude.setKey(k);
      if (!V.claude.configured) { msg.textContent = 'Bitte zuerst einen Schlüssel eingeben.'; return; }
      V.claude.setModel(sel.value);
      msg.textContent = 'Verbinde …';
      go.disabled = true;
      try {
        const t = await V.claude.test();
        msg.textContent = '✓ ' + t + ' Visto nutzt jetzt ' + sel.options[sel.selectedIndex].text.split(' (')[0] + '.';
        key.value = '';
        V.store.set('settings.vistoAI', true);
      } catch (e) {
        msg.textContent = e && (e.status === 401 || e.status === 403) ? 'Der Schlüssel wurde abgelehnt. Bitte prüfen.' : 'Verbindung fehlgeschlagen: ' + ((e && e.message) || e);
      }
      go.disabled = false;
      refresh();
    });
    V.on('brain:ai', refresh);
    refresh();
    const r = row('Claude verbinden', '', btn);
    r.querySelector('small') ? r.querySelector('small').replaceWith(status) : r.firstChild.appendChild(status);
    wrap.append(r, panel);
    return wrap;
  }

  /** zweistufig bestätigen (Dialoge wie confirm() sind nicht überall erlaubt) */
  function resetBtn() {
    let armed = false, t = 0;
    const b = U.el('button', { class: 'emu-btn danger', text: 'Zurücksetzen' });
    b.addEventListener('click', () => {
      if (!armed) {
        armed = true; b.textContent = 'Wirklich zurücksetzen?';
        clearTimeout(t); t = setTimeout(() => { armed = false; b.textContent = 'Zurücksetzen'; }, 3500);
        return;
      }
      V.store.reset();
      V.platform.storage.remove('vistoos.v1');
      const url = location.href.replace(/[?&](skip|app|face)(=[^&]*)?/g, '');
      location.replace(url);
    });
    return b;
  }
  function toggleSheet(on) { sheet.classList.toggle('on', on); sheetBack.classList.toggle('on', on); }
  function setFull(on) { document.body.classList.toggle('emu-full', on); size(); }

  function send() {
    const t = input.value.trim();
    if (!t) return;
    input.value = '';
    sendBtn.disabled = true;
    input.blur();
    V.convo.input(t);
  }

  V.emulator = {
    mount(el) {
      host = el;
      V.loop.cap90 = V.platform.storage.get('vistoos.cap90') === '1';
      const page = U.el('div', { class: 'emu' });
      const head = U.el('header', { class: 'emu-head' },
        U.el('div', { class: 'emu-brand', html: logo() + '<b>Visto<i>OS</i></b><small>Emulator</small>' }),
        U.el('button', { class: 'emu-iconbtn', attrs: { 'aria-label': 'Emulator-Einstellungen' }, html: V.icon('dots'), on: { click: () => toggleSheet(true) } }));
      const stage = U.el('section', { class: 'emu-stage' });
      deviceEl = U.el('div', { class: 'device' });
      glass = U.el('div', { class: 'device-glass' });
      deviceEl.append(glass, U.el('div', { class: 'device-glare' }));
      const neck = U.el('div', { class: 'device-neck' });
      const base = U.el('div', { class: 'device-base' });
      baseLight = U.el('div', { class: 'base-light' });
      const baseBtn = U.el('button', { class: 'base-btn', attrs: { 'aria-label': 'Sockeltaste (Home)' }, on: { click: () => { V.sound.play('tap'); V.haptic(10); V.shell.homeButton(); } } });
      base.append(baseLight, baseBtn);
      stage.append(deviceEl, neck, base);

      // Sprechen
      const talk = U.el('section', { class: 'emu-talk' });
      input = U.el('input', { attrs: { type: 'text', placeholder: 'Mit Visto sprechen …', enterkeyhint: 'send', autocomplete: 'off', autocorrect: 'on', 'aria-label': 'Nachricht an Visto' } });
      micBtn = U.el('button', { class: 'talk-btn mic', attrs: { 'aria-label': 'Sprechen' }, html: V.icon('mic') });
      sendBtn = U.el('button', { class: 'talk-btn send', attrs: { 'aria-label': 'Senden', disabled: true }, html: V.icon('send') });
      input.addEventListener('input', () => { sendBtn.disabled = !input.value.trim(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      sendBtn.addEventListener('click', send);
      micBtn.addEventListener('click', () => {
        if (V.shell.mode === 'setup' || V.shell.mode === 'boot') return;
        if (micBtn.classList.contains('live')) { V.convo.stopListening(); return; }
        V.convo.activate({ via: 'mic' });
      });
      V.on('voice:listening', (on) => micBtn.classList.toggle('live', !!on));
      V.on('voice:changed', () => { micBtn.style.display = V.voice.canListen ? '' : 'none'; });
      micBtn.style.display = V.voice.canListen ? '' : 'none';
      const field = U.el('div', { class: 'talk-field' }, micBtn, input, sendBtn);
      const chips = U.el('div', { class: 'talk-chips' });
      for (const c of CHIPS) chips.appendChild(U.el('button', { class: 'talk-chip', text: c, on: { click: () => { if (V.shell.mode !== 'setup' && V.shell.mode !== 'boot') V.convo.input(c); } } }));
      const hint = U.el('p', { class: 'talk-hint', html: 'Linie unten antippen ruft Visto · ↑ Apps · ↓ Kontrollzentrum · ← → Zifferblatt · Halten zum Anpassen · Vom linken Rand wischen = zurück · Taste am Sockel = Home' });
      talk.append(field, chips, hint);
      const exit = U.el('button', { class: 'emu-iconbtn emu-exitfull', attrs: { 'aria-label': 'Vollbild verlassen' }, html: V.icon('shrink'), on: { click: () => setFull(false) } });
      page.append(head, stage, talk);
      host.append(page, exit);

      V.display.mount(glass);
      buildSheet();
      size();
      window.addEventListener('resize', size);
      window.addEventListener('orientationchange', () => setTimeout(size, 200));

      V.on('visto:state', (s) => baseLight.classList.toggle('on', s !== 'idle' || V.visto.isOpen));
      V.on('convo:close', () => baseLight.classList.remove('on'));
      V.on('shell:mode', (m) => { talk.style.opacity = m === 'setup' || m === 'boot' ? '0.35' : '1'; talk.style.pointerEvents = m === 'setup' || m === 'boot' ? 'none' : ''; });
    },
    setFull,
  };
})();
