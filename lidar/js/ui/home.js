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
    if (q.tls) { a.fpc.setTab('scans'); a.setHint(`<b>Tipp:</b> „Stationsscan“ oben rechts starten. Danach das Stativ verschieben und erneut scannen.`); setTimeout(() => a.setHint(null), 9000); }
  }

  help() {
    const body = h('div', { html: `
      <p><b>Szene</b> (links): ziehen dreht die Ansicht, zwei Finger verschieben und zoomen. Das Stativ lässt sich mit dem Verschieben-Werkzeug ziehen.</p>
      <p><b>Scanner</b> (oben): Katalog mit Datenblatt und Musterschau. „Diesen Scanner verwenden“ montiert ihn an der Stelle des alten.</p>
      <p><b>Feldrechner</b> (rechts): die Scan-Software. <i>Live</i> zeigt den Datenstrom und das Abstandsbild, <i>Scans</i> die gespeicherten Aufnahmen, <i>Ausrichten</i> verbindet mehrere Stationen, <i>Bearbeiten</i> filtert und vernetzt, <i>Messen</i> und <i>Vergleich</i> prüfen Maße und Abweichungen, <i>Export</i> speichert PLY, LAS, PCD, XYZ, OBJ und mehr.</p>
      <p><b>Realismus</b>: Jeder Schuss wird mit mehreren Teilstrahlen über die Strahldivergenz verfolgt. Echos unterhalb der Pulsauflösung verschmelzen (Mischpixel), Glas lässt durch, Spiegel erzeugen Geisterpunkte, Retroreflektoren übersteuern. Die Erkennungsschwelle folgt aus der Reichweite bei 10 % Reflektivität.</p>
      <p class="muted">Tastatur: Leertaste startet/stoppt den Scanner, R startet die Aufnahme, F passt die Ansicht ein.</p>` });
    modal('Kurzanleitung', body, [{ label: 'Verstanden', primary: true }], { width: 'min(640px, 100%)' });
  }
}
