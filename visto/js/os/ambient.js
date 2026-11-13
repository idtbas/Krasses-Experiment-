/* VistoOS · os/ambient.js — Helligkeit, Ruhemodus (Always-On), Nachtmodus, Einbrennschutz
 *
 *  Nach Ruhezeit auf dem Zifferblatt: Ruhemodus (abgedunkelt, vereinfacht, Pixel wandern).
 *  Nachts (Einstellung „auto“ 22–7 Uhr oder „an“): warmes Rotlicht im Ruhemodus.
 *  V.ambient.lux (0…1) ist der simulierte Umgebungslichtsensor (Emulator-Regler).
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  let last = performance.now();
  let on = false;
  let shiftT = 0;
  let curDim = 0;

  const amb = (V.ambient = {
    lux: 0.7,
    get on() { return on; },
    night() {
      const m = V.store.get('settings.night', 'auto');
      return m === 'on' || (m === 'auto' && V.time.isNight());
    },
    poke() { last = performance.now(); if (on) amb.wake(); },
    wake() {
      if (!on) return;
      on = false;
      V.faces.setAmbient(false);
      V.display.shift(0, 0);
      V.emit('ambient', false);
      apply();
    },
    sleep() {
      if (on) return;
      if (V.shell.mode !== 'home') return;
      if (V.convo && V.convo.active) return;
      if (V.control && V.control.isOpen) return;
      on = true;
      V.faces.setAmbient(true);
      V.emit('ambient', true);
      apply();
    },
    effective() {
      let b = V.store.get('settings.brightness', 0.9);
      if (V.store.get('settings.autoBrightness', true)) b *= U.lerp(0.5, 1.15, amb.lux);
      if (amb.night()) b *= on ? 0.5 : 0.75;
      if (on) b *= V.store.get('settings.alwaysOn', true) ? 0.4 : 0;
      return U.clamp(b, 0, 1);
    },
  });

  function apply() {
    const b = amb.effective();
    // wahrnehmungsgerechte Kurve: hohe Helligkeit bleibt strahlend, niedrige wird deutlich dunkler
    const target = Math.pow(1 - U.clamp(b, 0.03, 1), 1.7);
    curDim = target;
    V.display.setDim(on && !V.store.get('settings.alwaysOn', true) ? 1 : target * 0.95);
    V.display.setNightTint(on && amb.night() ? 0.92 : amb.night() && V.store.get('settings.night') === 'on' ? 0.5 : 0);
  }

  V.on('activity', () => amb.poke());
  V.on('store', (e) => { if (/^settings\.(brightness|autoBrightness|night|alwaysOn|nightFrom|nightTo)/.test(e.path)) apply(); });
  V.on('time:minute', apply);
  V.on('lux', apply);
  V.on('convo:open', () => amb.poke());
  V.on('notify', () => amb.poke());
  V.on('alert', () => amb.poke());

  V.on('boot:ready', () => {
    // erste Berührung im Ruhemodus weckt nur
    V.display.el.addEventListener('pointerdown', (e) => {
      last = performance.now();
      if (on) {
        amb.wake();
        e.stopPropagation();
        V.shell.swallowClick = true;
        setTimeout(() => (V.shell.swallowClick = false), 400);
      }
    }, true);
    apply();
    V.loop.add((dt) => {
      const idle = (performance.now() - last) / 1000;
      const lim = V.store.get('settings.idleSec', 60);
      if (!on && idle > lim && V.shell.mode === 'home' && !V.notify.alertOpen) amb.sleep();
      // Apps ohne Wachhalten kehren nach langer Ruhe zum Zifferblatt zurück
      if (V.shell.mode === 'app' && idle > Math.max(180, lim * 3)) {
        const a = V.shell.app;
        const keep = a && (a.def.keepAwake === true || (typeof a.def.keepAwake === 'function' && a.def.keepAwake()));
        if (!keep) { last = performance.now() - lim * 1000 + 4000; V.shell.home(); }
      }
      if (on) {
        shiftT += dt;
        if (shiftT > 50) {
          shiftT = 0;
          V.display.shift(Math.round((Math.random() - 0.5) * 12), Math.round((Math.random() - 0.5) * 12));
        }
      }
    }, -1);
  });
  void curDim;
})();
