/* KYTHERA · MANDAT · Einstieg */
(function () {
  'use strict';
  const start = () => {
    try { window.KY.boot.init(); } catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f88;padding:20px">' + String(e && e.stack || e) + '</pre>'); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
