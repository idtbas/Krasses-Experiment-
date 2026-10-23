// ECHO · Start: WebGL prüfen, Physik laden (für Roboter), App aufbauen.
import RAPIER from '../../kinetik/vendor/rapier.mjs';
import { App } from './app.js';
import { LOGO } from './ui/icons.js';

const loader = document.getElementById('loader');
const msg = document.getElementById('loader-msg');
document.getElementById('loader-logo').innerHTML = LOGO;
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

function fail(text) {
  msg.textContent = text;
  msg.style.color = '#ffb3b3';
  loader.querySelector('.bar').style.display = 'none';
}

async function boot() {
  if (!document.createElement('canvas').getContext('webgl2')) { fail('Dieses Gerät unterstützt kein WebGL 2.'); return; }
  try { await RAPIER.init(); } catch (e) { console.error(e); fail('Die Physik-Engine konnte nicht geladen werden.'); return; }
  const app = new App(RAPIER, (t) => { msg.textContent = t; });
  window.echo = app;
  await app.init();
  const p = new URLSearchParams(location.search);
  if (p.get('quick')) await app.quickstart(p.get('quick'));
  else app.home.show();
  loader.style.opacity = '0';
  setTimeout(() => loader.remove(), 500);
}
boot().catch((e) => { console.error(e); fail('Startfehler: ' + e.message); });
