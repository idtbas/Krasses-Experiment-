// Startseite mit Schnellstarts und Kurzanleitung
import { h, modal } from './dom.js';
import { icon, LOGO } from './icons.js';
import { SCANNERS } from '../scanners/catalog.js';
import { SCENES } from '../world/scenes.js';

export const QUICK = [
  { id: 'live', icon: 'live', title: 'Halle live scannen', text: 'Ein Velodyne VLP-16 auf dem Stativ: 16 Laser, 10 Umdrehungen pro Sekunde. Sieh zu, wie die Ringe am Boden entstehen.', meta: ['Werkhalle', 'Rotierend'], scene: 'halle', scanner: 'vlp16', mount: 'stativ', start: true },
  { id: 'tls', icon: 'tripod', title: 'Vermessen mit dem Laserscanner', text: 'Leica RTC360 auf dem Stativ: Millimetergenauer Rundum-Scan mit Kamerafarben. Danach umstellen, zweite Station, ausrichten.', meta: ['Werkhalle', 'TLS'], scene: 'halle', scanner: 'rtc360', mount: 'stativ', tls: true },
  { id: 'livox', icon: 'target', title: 'Nicht wiederholendes Muster', text: 'Livox Mid-70: Zwei Prismen zeichnen eine Rosette, die das Sichtfeld mit der Zeit immer dichter füllt.', meta: ['Werkhalle', 'Festkörper'], scene: 'halle', scanner: 'mid70', mount: 'stativ', start: true },
  { id: 'cheap', icon: 'scanner', title: '100 € gegen 4.000 €', text: 'RPLIDAR A1 (Triangulation) im Vergleich zum Hokuyo UTM-30LX: Rauschen, Reichweite und Kanten in einer Ebene.', meta: ['Werkhalle', '2D'], scene: 'halle', scanner: 'rpa1', mount: 'stativ', start: true },
  { id: 'robot', icon: 'robot', title: 'Roboter scannt allein', text: 'Fahrroboter AMR-1 mit Ouster OS0-128 auf dem Mast umrundet den Gabelstapler. LiDAR-SLAM bestimmt die Bahn – oder schalte auf Rad-Odometrie und sieh die Drift.', meta: ['Werkhalle', 'Autoscan', 'SLAM'], scene: 'halle', scanner: 'os0_128', mount: 'rover', auto: true },
  { id: 'turntable', icon: 'arm', title: 'Roboterarm + Drehteller', text: 'Ein KX-5 führt eine RealSense L515 in drei Höhen um die Büste, der Drehteller dreht je Bahn 360°. Ergebnis in Objektkoordinaten – bereit zum Vernetzen.', meta: ['Messraum', 'Autoscan', 'Objekt'], scene: 'messraum', scanner: 'l515', mount: 'arm', auto: true },
  { id: 'phone', icon: 'phone', title: 'Smartphone gegen Profi', text: 'Erst ein Stationsscan mit dem Leica RTC360, dann derselbe Raum mit dem iPhone-LiDAR (576 Punkte, Tiefenfusion, Netz). Am Ende zeigt der Vergleich die Abweichung.', meta: ['Wohnung', 'Smartphone', 'Vergleich'], scene: 'wohnung', flow: 'phoneVsPro' },
  { id: 'drone', icon: 'drone', title: 'Drohnenflug über das Haus', text: 'Livox Avia unter einer Drohne im Rasterflug. Die Rosette tastet Dach, Fassaden und Bäume ab – mit RTK-Bahn oder GNSS ohne Korrektur.', meta: ['Außengelände', 'Autoscan', 'Luft'], scene: 'aussen', scanner: 'avia', mount: 'drohne', auto: true },
  { id: 'hand', icon: 'hand', title: 'Handscanner-Rundgang', text: 'Leica BLK2GO in der Hand: Rundgang um den Stapler mit natürlichem Gang. Der Bediener verdeckt dabei selbst einen Teil der Sicht – wie in echt.', meta: ['Werkhalle', 'SLAM', 'Handgeführt'], scene: 'halle', scanner: 'blk2go', mount: 'hand', auto: true },
];

export class Home {
  constructor(app) {
    this.app = app;
    this.el = h('div#home.hidden');
    this.render();
  }
  render() {
    const qs = h('div.qs');
    for (const q of QUICK) {
      if (q.scene && !SCENES[q.scene]) continue;
      const c = h('button.qcard', { html: `<div class="ic">${icon(q.icon)}</div><h3>${q.title}</h3><p>${q.text}</p><div class="meta">${q.meta.map((m) => `<span class="chip">${m}</span>`).join('')}</div>` });
      c.addEventListener('click', () => this.quick(q.id));
      qs.appendChild(c);
    }
    const free = h('button.qcard', { html: `<div class="ic">${icon('catalog')}</div><h3>Frei arbeiten</h3><p>Szene, Scanner und Halterung selbst wählen. ${SCANNERS.length} Geräte im Katalog, von 100 € bis 120.000 €.</p><div class="meta"><span class="chip acc">Alle Werkzeuge</span></div>` });
    free.addEventListener('click', () => this.hide());
    qs.appendChild(free);
    const cls = (k) => SCANNERS.filter((s) => s.cls === k).length;
    this.el.replaceChildren(
      h('div.hbrand', { html: LOGO.replace('width="28" height="28"', 'width="38" height="38"') + '<div><b>ECHO</b><small>LIDAR-STUDIO</small></div>' }),
      h('h1', { html: 'Laserscannen, wie es <em>wirklich</em> funktioniert.' }),
      h('p.lead', 'Echte Abtastmuster, Strahldivergenz, Mischpixel, Mehrfachechos, Glas, Spiegel und Retroreflektoren, Rauschen nach Datenblatt, Sonne, Nebel und Regen. Alles läuft physikalisch im Browser – auf dem Stativ, auf einem Roboter oder im Smartphone.'),
      h('div.stats', { html: `<div><b>${SCANNERS.length}</b>Scanner</div><div><b>${cls('spin')}</b>rotierend</div><div><b>${cls('tls')}</b>terrestrisch</div><div><b>${cls('line')}</b>2D</div><div><b>${cls('solid')}</b>Festkörper</div><div><b>${Object.keys(SCENES).length}</b>Szenen</div>` }),
      qs,
      h('footer', 'Kennwerte nach öffentlichen Datenblättern, gerundet; wo Angaben fehlen, aus vergleichbaren Geräten abgeleitet. Preise sind unverbindliche Richtwerte. Keine Verbindung zu den Herstellern – nachgebildet wird das Messprinzip, nicht die Firmware.'),
    );
  }
  show() { this.render(); this.el.classList.remove('hidden'); document.body.classList.add('athome'); }
  hide() { this.el.classList.add('hidden'); document.body.classList.remove('athome'); }

  async quick(id) {
    const q = QUICK.find((x) => x.id === id);
    if (!q) return;
    const a = this.app;
    this.hide();
    if (q.scene && q.scene !== a.sceneId) await a.switchScene(q.scene);
    if (q.scanner && (!a.dev || a.dev.spec.id !== q.scanner)) await a.replaceDevice(q.scanner);
    if (q.mount && a.dev.mountKind !== q.mount) await a.setMount(q.mount);
    if (q.start && a.dev.state !== 'stream') a.toggleStream();
    if (q.auto) { a.fpc.setTab('live'); a.mounts.start(); }
    if (q.flow === 'phoneVsPro') await this.phoneVsPro();
    if (q.tls) { a.fpc.setTab('scans'); a.setHint(`<b>Tipp:</b> „Stationsscan“ oben rechts starten. Danach das Stativ verschieben und erneut scannen.`); setTimeout(() => a.setHint(null), 9000); }
  }

  // Ablauf „Smartphone gegen Profi“: Referenz-Stationsscan, dann iPhone-Raumscan, dann Scan-zu-Scan-Vergleich
  async phoneVsPro() {
    const a = this.app, f = a.fpc;
    const st = SCENES[a.sceneId].start.scanner;
    a.project.clear();
    await a.replaceDevice('rtc360');
    a.dev.setPosition(st[0], st[2], 0);
    a.lw.sync();
    a.setHint('<b>1/3</b> Referenz: Stationsscan mit dem Leica RTC360 …');
    await f.stationScan();
    const ref = a.project.scans.find((s) => s.kind === 'station');
    if (!ref) { a.setHint(null); return; }
    a.setHint('<b>2/3</b> Jetzt dasselbe mit dem iPhone: die Person dreht sich und erfasst den Raum …');
    await a.replaceDevice('iphone');
    a.phone.opts.mode = 'raum'; a.mounts.opts.hand.phoneMode = 'raum'; a.phone.renderSide();
    a.phone.toggle();
    const t0 = performance.now();
    while (!a.phone.result && performance.now() - t0 < 20 * 60e3) {
      if (!a.mounts.job && !a.phone.session && !a.phone.busy && !a.phone.result) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const R = a.phone.result;
    if (!R) { a.setHint(null); return; }
    a.setHint('<b>3/3</b> Vergleich iPhone → RTC360 (Abstand je Punkt zur Referenzwolke) …');
    R.scan.visible = true;
    f.selScan = R.scan;
    f.cmp = { ref: 'scan', other: ref, range: 0.05 };
    f.opts.dRange = [-0.05, 0.05];
    f.setTab('compare');
    const { run } = await import('../device/tabs/compare.js');
    await run(f);
    setTimeout(() => a.setHint(null), 8000);
  }

  help() {
    const body = h('div', { html: `
      <p><b>Szene</b> (links): ziehen dreht die Ansicht, zwei Finger verschieben und zoomen. Das Stativ lässt sich mit dem Verschieben-Werkzeug ziehen.</p>
      <p><b>Scanner</b> (oben): Katalog mit Datenblatt und Musterschau. „Diesen Scanner verwenden“ montiert ihn an der Stelle des alten.</p>
      <p><b>Feldrechner</b> (rechts): die Scan-Software. <i>Live</i> zeigt den Datenstrom und das Abstandsbild, <i>Scans</i> die gespeicherten Aufnahmen, <i>Ausrichten</i> verbindet mehrere Stationen, <i>Bearbeiten</i> filtert und vernetzt, <i>Messen</i> und <i>Vergleich</i> prüfen Maße und Abweichungen, <i>Export</i> speichert PLY, LAS, PCD, XYZ, OBJ und mehr.</p>
      <p><b>Halterung</b> (oben): Stativ, Fahrroboter AMR-1, Roboterarm KX-5 mit Drehteller (Messraum), Drohne oder handgeführt. Auf einer Plattform erscheint im Feldrechner unter <i>Live</i> der <b>Autoscan</b>: Ziel wählen, starten – Roboter, Drohne oder Person erledigen den Rest. Die <b>Positionsbestimmung</b> lässt sich umschalten: Referenzbahn, reine Koppelnavigation (mit Drift) oder LiDAR-SLAM; dazu die Entzerrung der Bewegung innerhalb einer Umdrehung.</p>
      <p><b>Smartphone</b>: Das iPhone-LiDAR aus dem Katalog erscheint als Handy mit Scanner-App. Auslöser drücken – die Person geht um das Objekt oder dreht sich im Raum, die App zeigt Kamerabild, Laserpunkte und das wachsende Netz und liefert am Ende Punkte und Netz an den Feldrechner.</p>
      <p><b>Realismus</b>: Jeder Schuss wird mit mehreren Teilstrahlen über die Strahldivergenz verfolgt. Echos unterhalb der Pulsauflösung verschmelzen (Mischpixel), Glas lässt durch, Spiegel erzeugen Geisterpunkte, Retroreflektoren übersteuern. Die Erkennungsschwelle folgt aus der Reichweite bei 10 % Reflektivität.</p>
      <p class="muted">Tastatur: Leertaste startet/stoppt den Scanner, R startet die Aufnahme, F passt die Ansicht ein.</p>` });
    modal('Kurzanleitung', body, [{ label: 'Verstanden', primary: true }], { width: 'min(640px, 100%)' });
  }
}
