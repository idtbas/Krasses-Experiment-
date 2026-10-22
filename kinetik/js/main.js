// KINETIK · Start: Physik laden, App aufbauen, Startbildschirm zeigen.
import RAPIER from '../vendor/rapier.mjs';
import { App } from './ui/app.js';
import { LOGO } from './core/icons.js';

const loader = document.getElementById('loader');
const msg = document.getElementById('loader-msg');
document.getElementById('loader-logo').innerHTML = LOGO;

// Pinch-Zoom der ganzen Seite in Safari verhindern (die 3D-Ansicht zoomt selbst)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

function fail(text) {
  msg.textContent = text;
  msg.style.color = '#ffb3b3';
  loader.querySelector('.bar').style.display = 'none';
}

async function boot() {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) { fail('Dieses Gerät unterstützt kein WebGL 2. Bitte Safari auf einem aktuellen iPad verwenden.'); return; }
  try {
    await RAPIER.init();
  } catch (e) {
    console.error(e);
    fail('Die Physik-Engine konnte nicht geladen werden.');
    return;
  }
  msg.textContent = 'TESTHALLE WIRD AUFGEBAUT …';
  await new Promise((r) => setTimeout(r, 20));
  const app = new App(RAPIER);
  window.kinetik = app;
  const params = new URLSearchParams(location.search);
  if (params.get('mission')) app.openMission(params.get('mission'));
  else app.home.show();
  loader.style.opacity = '0';
  setTimeout(() => loader.remove(), 500);
}

boot().catch((e) => { console.error(e); fail('Startfehler: ' + e.message); });
