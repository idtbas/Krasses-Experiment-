/* VistoOS · main.js — Start
 *
 *  URL-Schalter: ?skip   Startanimation und Einrichtung überspringen (Entwicklung)
 *                ?reset  Werkszustand
 *                ?app=id App direkt öffnen   ?face=id Zifferblatt
 */
'use strict';
(function () {
  const V = window.V;
  const q = new URLSearchParams(location.search);
  if (q.has('reset')) V.store.reset();

  function applyAccent() {
    const a = V.store.get('settings.accent', '#FF9A4D');
    const r = document.documentElement.style;
    r.setProperty('--accent', a);
    r.setProperty('--accent-rgb', V.util.hexToRgb(a).join(','));
    r.setProperty('--accent-ink', V.util.luma(a) > 0.55 ? '#140a02' : '#ffffff');
  }

  function start() {
    // Wirt: Emulator (index.html) oder das OS allein im Gerätemodus (device.html)
    if (V.platform.host === 'device' && V.host) V.host.mount(document.getElementById('host') || document.body);
    else V.emulator.mount(document.getElementById('emu'));
    applyAccent();
    V.on('store:settings.accent', applyAccent);
    V.fx.setup();
    V.emit('boot:fx');
    V.shell.init();
    V.apps.initAll();
    V.launcher.rebuild();
    if (q.get('face') && V.faces.get(q.get('face'))) V.faces.show(q.get('face'));
    V.emit('boot:ready');

    const skip = q.has('skip');
    const done = V.store.get('setupDone');
    const toHome = () => {
      V.shell.enterHome();
      V.emit('boot:home');
      if (q.get('app')) setTimeout(() => V.shell.open(q.get('app')), 300);
    };
    if (skip) {
      if (!done) { V.store.set('setupDone', true); if (!V.store.get('user.name')) V.store.set('user.name', 'Alex'); }
      toHome();
      return;
    }
    V.shell.setMode('boot');
    const boot = V.boot && V.boot.run ? V.boot.run() : Promise.resolve();
    boot.then(() => {
      if (!V.store.get('setupDone') && V.setup && V.setup.start) {
        V.shell.setMode('setup');
        V.setup.start().then(() => { V.store.set('setupDone', true); toHome(); });
      } else toHome();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.addEventListener('error', (e) => console.error('[VistoOS] Fehler:', e.message));
})();
