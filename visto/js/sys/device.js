/* VistoOS · sys/device.js — Gerätemodus: der Wirt ohne Emulator (device.html)
 *
 *  Das OS allein, bildschirmfüllend: der Kreis sitzt mittig und nimmt min(Breite, Höhe) ein, ringsum Schwarz.
 *  Genau diese Seite startet der Linux-Kiosk auf dem runden 1080 × 1080-Display (siehe linux/).
 *  Aktiv nur, wenn V.platform.host === 'device' – in index.html wird die Datei geladen, tut aber nichts.
 *
 *  Tastatur (am Gerät: die Sockeltaste meldet sich als Taste „Home“):
 *    Esc / Home           Sockeltaste (wie im Emulator: Home, zweimal schnell = Karussell)
 *    „/“ oder Leertaste   Visto rufen und schreiben – am Gerät wird sonst gesprochen
 *    Visto hört zu        einfach lostippen · Enter sendet · Esc bricht ab
 *  Die getippte Frage erscheint wie erkannte Sprache unter Vistos Ring (V.convo.typing), mit Schreibmarke.
 *
 *  V.host.mount(el) · V.host.type(text?) (Texteingabe öffnen) · V.host.typing → bool
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  let field = null, typing = false;

  function size() {
    const D = Math.max(120, Math.floor(Math.min(window.innerWidth, window.innerHeight)));
    document.documentElement.style.setProperty('--D', D + 'px');
    V.display.resize(D);
  }

  const locked = () => V.shell.mode === 'boot' || V.shell.mode === 'setup' || !!(V.notify && V.notify.alertOpen);

  /* ------------------------------------------------------ Texteingabe */
  // Ein unsichtbares echtes Eingabefeld nimmt die Tasten entgegen (auch Bildschirmtastatur, Umlaute, Einfügen);
  // gezeichnet wird im Display – rund gesetzt, dort wo sonst das Gehörte steht.
  function ensureField() {
    if (field) return field;
    field = U.el('input', { class: 'dv-field', attrs: { type: 'text', autocomplete: 'off', autocorrect: 'on', autocapitalize: 'sentences', spellcheck: 'false', enterkeyhint: 'send', maxlength: 240, 'aria-label': 'Nachricht an Visto', tabindex: '-1' } });
    field.addEventListener('input', () => { if (typing) V.convo.typing(field.value); });
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();   // Kurztasten des Wirts gelten beim Schreiben nicht
      if (e.key === 'Enter') { e.preventDefault(); if (!e.isComposing) send(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    // Fokus halten, solange Visto auf die Frage wartet (ein Tippen auf den Ring startet zusätzlich das Mikrofon)
    field.addEventListener('blur', () => {
      if (!typing) return;
      setTimeout(() => { if (typing && V.convo.active && V.convo.phase === 'listening') field.focus({ preventScroll: true }); else if (typing) end(); }, 0);
    });
    document.body.appendChild(field);
    return field;
  }
  function begin(seed) {
    if (locked() || !V.convo || !V.convo.typing) return false;
    ensureField();
    field.value = seed || '';
    if (!V.convo.typing(field.value)) return false;
    typing = true;
    field.focus({ preventScroll: true });
    return true;
  }
  function end() {
    if (!typing) return;
    typing = false;
    if (field) { field.value = ''; field.blur(); }
  }
  function send() {
    const t = field.value.trim();
    end();
    if (t) V.convo.input(t); else V.convo.close();
  }
  function cancel() { end(); V.convo.close(); }

  /* --------------------------------------------------------- Tastatur */
  function homeButton() { V.sound.play('tap'); V.haptic(10); V.shell.homeButton(); }
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    // Eingabefelder des OS (z. B. Name in den Einstellungen) behalten ihre Tasten
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    // im Ruhemodus weckt die erste Taste nur (wie die erste Berührung)
    if (V.ambient && V.ambient.on) { e.preventDefault(); V.emit('activity'); return; }
    if (e.key === 'Escape' || e.key === 'Home') {
      e.preventDefault();
      if (!e.repeat) homeButton();
      return;
    }
    if (e.key === '/' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) begin('');
      return;
    }
    // Visto hört schon zu: einfach lostippen – das Zeichen landet im frisch fokussierten Feld
    if (e.key.length === 1 && V.convo && V.convo.active && V.convo.phase === 'listening' && !typing) begin('');
  }

  V.host = {
    kind: 'device',
    get typing() { return typing; },
    type: (text) => begin(text || ''),

    mount(el) {
      const linux = V.platform.name === 'linux';
      document.body.classList.add('dv');
      if (linux) document.body.classList.add('dv-kiosk');
      const wrap = U.el('div', { class: 'dv-host' });
      el.appendChild(wrap);
      V.display.mount(wrap);
      size();
      window.addEventListener('resize', size);
      window.addEventListener('orientationchange', () => setTimeout(size, 200));
      document.addEventListener('keydown', onKey);
      V.on('convo:close', end);
      // ohne Spracherkennung (und ohne Emulator-Eingabe) öffnet Visto gleich die Texteingabe
      V.on('convo:open', () => { if (!V.voice.canListen || V.store.get('settings.micMuted')) setTimeout(() => { if (V.convo.active && V.convo.phase === 'listening') begin(''); }, 0); });

      // Tastenhinweis in der schwarzen Ecke neben dem Kreis – nur am Rechner (Maus + Tastatur), nie am Gerät
      const desk = !linux && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (desk) {
        const keys = U.el('div', { class: 'dv-keys', attrs: { 'aria-hidden': 'true' }, html: '<kbd>Esc</kbd> Home&ensp;·&ensp;<kbd>/</kbd> oder <kbd>Leertaste</kbd> Visto schreiben' });
        document.body.appendChild(keys);
        setTimeout(() => keys.classList.add('calm'), 9000);
      }
      V.sys.log('info', 'host', 'Gerätemodus · Display ' + V.display.size + ' px' + (linux ? ' · Kiosk' : ''));
    },
  };

  V.css('device', `
    body.dv { background: #000 !important; overflow: hidden; height: 100%; min-height: 0; overscroll-behavior: none; touch-action: none; }
    .dv-host { position: fixed; inset: 0; display: grid; place-items: center; background: #000; }
    /* am Rechner zeigt ein Hauch von Kante, wo das runde Glas endet; am Gerät ist dort der Gehäuserand */
    body.dv:not(.dv-kiosk) .dv-host::before { content: ''; position: absolute; left: 50%; top: 50%; width: var(--D); height: var(--D); translate: -50% -50%; border-radius: 50%; box-shadow: 0 0 0 1px rgba(255,255,255,.07), 0 0 60px rgba(255,255,255,.025); pointer-events: none; }
    body.dv-kiosk, body.dv-kiosk * { cursor: none !important; }
    .dv-field { position: fixed; left: 50%; top: 50%; width: 2px; height: 2px; margin: 0; padding: 0; border: 0; outline: 0; opacity: 0; pointer-events: none; font-size: 16px; background: transparent; color: transparent; caret-color: transparent; }
    .dv-keys { position: fixed; left: 16px; bottom: 14px; z-index: 5; font: 500 11.5px/1 var(--font); letter-spacing: .02em; color: rgba(255,255,255,.42); pointer-events: none; transition: opacity 2.4s ease; white-space: nowrap; }
    .dv-keys.calm { opacity: .38; }
    .dv-keys kbd { display: inline-block; font: 600 10.5px/1 var(--font); color: rgba(255,255,255,.6); padding: 3px 6px 3.5px; border-radius: 6px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); margin-right: 3px; }
    @media (max-width: 520px), (max-height: 420px) { .dv-keys { display: none; } }
    /* getippte Frage an Visto: heller als Gehörtes, mit Schreibmarke in Akzentfarbe */
    .vos-convo .cv-typed { color: rgba(255,255,255,.94); }
    .vos-convo .cv-caret { display: inline-block; width: .55cqw; height: .98em; margin: 0 -1.25cqw 0 .7cqw; vertical-align: -.14em; border-radius: .3cqw; background: var(--accent); box-shadow: 0 0 2.4cqw rgba(var(--accent-rgb), .7); animation: dv-caret 1.15s cubic-bezier(.5, 0, .5, 1) infinite; }
    @keyframes dv-caret { 0%, 45% { opacity: 1; } 60%, 90% { opacity: .12; } 100% { opacity: 1; } }
  `);
})();
