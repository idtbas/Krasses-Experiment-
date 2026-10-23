// Kopfzeile: Szene, Scanner, Halterung, Umgebung, Start/Stopp, Aufnahme, Zeitraffer
import { h, popover, seg } from './dom.js';
import { icon, LOGO } from './icons.js';
import { SCENES } from '../world/scenes.js';
import { fmtPrice } from '../scanners/catalog.js';
import { openCatalog } from './catalog.js';

export const WEATHER = [
  ['klar', 'Klar', 'sun'], ['bedeckt', 'Bedeckt', 'sun'], ['nebel', 'Nebel (Sicht 45 m)', 'fog'], ['dichter_nebel', 'Dichter Nebel (18 m)', 'fog'],
  ['regen', 'Regen (12 mm/h)', 'rain'], ['starkregen', 'Starkregen (40 mm/h)', 'rain'], ['staub', 'Staub / Rauch', 'fog'],
];

export class TopBar {
  constructor(app) {
    this.app = app;
    this.el = h('div#top');
    const brand = h('div.brand', { html: LOGO + '<div><b>ECHO</b><small>LIDAR-STUDIO</small></div>' });
    brand.addEventListener('click', () => app.home.show());
    this.scene = this.pick('Szene', () => this.sceneMenu());
    this.scanner = this.pick('Scanner', () => openCatalog(app));
    this.mount = this.pick('Halterung', () => this.mountMenu());
    this.env = this.pick('Umgebung', () => this.envMenu());
    this.go = h('button.btn.primary.go');
    this.go.addEventListener('click', () => app.toggleStream());
    this.rec = h('button.btn', { title: 'Aufnahme in ein Projekt-Scan' });
    this.rec.addEventListener('click', () => app.fpc.toggleRecord());
    this.speed = seg([[0.25, '¼×'], [0.5, '½×'], [1, '1×']], 1, (v) => { app.clock.speed = v; });
    this.pause = h('button.btn.icon', { html: icon('pause'), title: 'Simulation anhalten' });
    this.pause.addEventListener('click', () => { app.clock.paused = !app.clock.paused; this.render(); });
    this.clock = h('div.clock');
    const help = h('button.btn.icon.ghost', { html: icon('help'), title: 'Kurzanleitung' });
    help.addEventListener('click', () => app.home.help());
    this.el.append(brand, this.scene, this.scanner, this.mount, this.env, h('div.grow'), this.go, this.rec, this.pause, this.speed, this.clock, help);
    setInterval(() => { this.clock.textContent = 'T+' + app.clock.t.toFixed(1) + ' s'; }, 200);
  }

  pick(label, fn) {
    const b = h('button.pick', h('small', label), h('span', '–'));
    b.addEventListener('click', () => fn(b));
    return b;
  }
  setPick(b, html) { b.querySelector('span').innerHTML = html; }

  render() {
    const a = this.app, d = a.dev;
    const sc = SCENES[a.sceneId];
    if (sc) this.setPick(this.scene, `${sc.name} <em>${sc.sub.split('·')[0]}</em>`);
    if (d) this.setPick(this.scanner, `${d.spec.maker} ${d.spec.model} <em>${fmtPrice(d.spec.price)}</em>`);
    this.setPick(this.mount, d ? (MOUNT_NAMES[d.mountKind] || d.mountKind) : '–');
    const w = WEATHER.find((x) => x[0] === a.world.weather.preset);
    this.setPick(this.env, (a.world.lighting === 'night' ? 'Nacht · ' : '') + (w ? w[1] : 'Klar'));
    if (d) {
      const tls = d.kind === 'tls';
      const busy = d.state === 'stream' || d.state === 'tls';
      this.go.className = 'btn go ' + (busy ? '' : 'primary');
      this.go.innerHTML = icon(busy ? 'stop' : 'play') + `<span>${busy ? (tls ? 'Abbrechen' : 'Stopp') : tls ? 'Stationsscan' : 'Scannen'}</span>`;
      this.rec.classList.toggle('hidden', tls || d.kind === 'phone');
      const on = !!a.fpc.recording;
      this.rec.className = 'btn' + (on ? ' rec' : '') + (tls || d.kind === 'phone' ? ' hidden' : '');
      this.rec.innerHTML = icon('rec') + `<span>${on ? 'Aufnahme läuft' : 'Aufnahme'}</span>`;
    }
    this.pause.classList.toggle('on', a.clock.paused);
  }

  sceneMenu() {
    const items = Object.values(SCENES).map((s) => ({ label: s.name, sub: s.sub + ' – ' + s.desc, icon: 'scene', on: s.id === this.app.sceneId, run: () => this.app.switchScene(s.id) }));
    popover(this.scene, items, { width: 330 });
  }
  mountMenu() {
    const a = this.app, d = a.dev;
    const items = [{ head: 'Halterung für ' + (d ? d.spec.model : 'Scanner') }];
    for (const [k, label, sub, ic] of MOUNTS) {
      if (!a.mountAllowed || a.mountAllowed(k)) items.push({ label, sub, icon: ic, on: d && d.mountKind === k, run: () => a.setMount(k) });
    }
    popover(this.mount, items, { width: 300 });
  }
  envMenu() {
    const a = this.app;
    const items = [{ head: 'Wetter und Umgebung' }];
    for (const [k, label, ic] of WEATHER) items.push({ label, icon: ic, on: a.world.weather.preset === k, run: () => a.setWeather(k) });
    if (a.world.def && a.world.def.lighting === 'outdoor') {
      items.push({ head: 'Tageszeit' });
      items.push({ label: 'Tag', icon: 'sun', on: a.world.lighting === 'outdoor', run: () => a.setDaylight(true) });
      items.push({ label: 'Nacht', sub: 'LiDAR misst weiter, Kamerafarben fehlen', icon: 'moon', on: a.world.lighting === 'night', run: () => a.setDaylight(false) });
    }
    popover(this.env, items, { width: 260 });
  }
}

export const MOUNTS = [
  ['stativ', 'Stativ', 'Fester Standort, ideal für Stationsscans', 'tripod'],
  ['rover', 'Fahrroboter AMR-1', 'Fährt um ein Objekt und scannt allein', 'robot'],
  ['arm', 'Roboterarm KX-5 + Drehteller', 'Führt den Scanner um ein Objekt auf dem Drehteller', 'arm'],
  ['drohne', 'Drohne', 'Überfliegt Gelände und Gebäude', 'drone'],
  ['hand', 'Handgeführt (gehen)', 'Mobiles Erfassen im Rundgang', 'hand'],
];
export const MOUNT_NAMES = Object.fromEntries(MOUNTS.map((m) => [m[0], m[1]]));
