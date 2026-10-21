/* KYTHERA · Start */
(function () {
  'use strict';
  const KY = window.KY;

  function launch(fromHot) {
    const S = KY.S;
    S.meta.boots = (S.meta.boots || 0) + 1;
    S.meta.sessions = (S.meta.sessions || 0) + 1;
    KY.ui.init();
    const away = (Date.now() - (S.meta.lastSeen || Date.now())) / 1000;
    if (!fromHot && S.meta.boots > 1 && away > 30) {
      KY.log('sys', 'Sitzung fortgesetzt nach ' + KY.U.dur(Math.min(away, 3600)) + ' Abwesenheit');
      KY.engine.catchUp(away, true);
    } else if (S.meta.boots === 1) {
      KY.log('sys', 'Erstanmeldung Sitz IX · Rufname ' + S.user.codename);
    } else {
      KY.log('sys', 'Anmeldung Sitz IX');
    }
    KY.save();
    KY.engine.start();
  }

  function start(hot) {
    const saved = hot && hot.state ? hot.state : KY.load();
    if (saved && saved.user && saved.user.sworn) {
      KY.S = saved;
      if (hot && hot.state) { launch(true); return; }
      KY.boot.run(true, () => launch(false));
    } else {
      KY.S = KY.newState();
      KY.boot.run(false, () => launch(false));
    }
  }

  try {
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ state: KY.S }));
  } catch (e) { /* ohne Vorschau-Hook */ }
  const boot = () => {
    const h = window.claude && window.claude.hot;
    if (h && h.ready) h.ready(start); else start((h && h.data) || {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
