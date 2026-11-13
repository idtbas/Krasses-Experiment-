// Startseite mit Schnellstarts und Kurzanleitung
import { h, modal } from './dom.js';
import { icon, LOGO } from './icons.js';
import { SCANNERS } from '../scanners/catalog.js';
import { SCENES } from '../world/scenes.js';

export const QUICK = [
  { id: 'live', icon: 'live', title: 'Halle live scannen', text: 'Ein Velodyne VLP-16 läuft auf dem Stativ: 16 Laser, 10 Umdrehungen pro Sekunde. Geh herum und sieh zu, wie die Ringe entstehen – du selbst wirfst einen Scanschatten.', meta: ['Werkhalle', 'Rotierend'], scene: 'halle', scanner: 'vlp16', mount: 'stativ', start: true },
  { id: 'tls', icon: 'tripod', title: 'Vermessen mit dem Laserscanner', text: 'Leica RTC360 auf dem Stativ: F startet den millimetergenauen Rundum-Scan. Danach Stativ tragen (G), zweite Station, im Feldrechner ausrichten.', meta: ['Werkhalle', 'TLS'], scene: 'halle', scanner: 'rtc360', mount: 'stativ', tls: true },
  { id: 'livox', icon: 'target', title: 'Nicht wiederholendes Muster', text: 'Livox Mid-70: Zwei Prismen zeichnen eine Rosette, die das Sichtfeld mit der Zeit immer dichter füllt.', meta: ['Werkhalle', 'Festkörper'], scene: 'halle', scanner: 'mid70', mount: 'stativ', start: true },
  { id: 'cheap', icon: 'scanner', title: '100 € gegen 4.000 €', text: 'RPLIDAR A1 (Triangulation) im Vergleich zum Hokuyo UTM-30LX: Rauschen, Reichweite und Kanten in einer Ebene.', meta: ['Werkhalle', '2D'], scene: 'halle', scanner: 'rpa1', mount: 'stativ', start: true },
  { id: 'robot', icon: 'robot', title: 'Roboter scannt allein', text: 'Fahrroboter AMR-1 mit Ouster OS0-128 auf dem Mast umrundet den Gabelstapler. LiDAR-SLAM bestimmt die Bahn – oder schalte auf Rad-Odometrie und sieh die Drift.', meta: ['Werkhalle', 'Autoscan', 'SLAM'], scene: 'halle', scanner: 'os0_128', mount: 'rover', auto: true },
  { id: 'turntable', icon: 'arm', title: 'Roboterarm + Drehteller', text: 'Ein KX-5 führt eine RealSense L515 in drei Höhen um die Büste, der Drehteller dreht je Bahn 360°. Ergebnis in Objektkoordinaten – bereit zum Vernetzen.', meta: ['Messraum', 'Autoscan', 'Objekt'], scene: 'messraum', scanner: 'l515', mount: 'arm', auto: true },
  { id: 'room', icon: 'cube', title: 'Raum wie mit Polycam', text: 'Stationsscan der Wohnung mit dem Leica RTC360, danach rechnet der Feldrechner daraus ein Raummodell: Wände, Tür, Fenster, Möbel als Netz und ein Grundriss mit Maßen – als SVG, OBJ oder JSON zu exportieren.', meta: ['Wohnung', 'TLS', '3D-Modell'], scene: 'wohnung', flow: 'roomModel' },
  { id: 'phone', icon: 'phone', title: 'Smartphone gegen Profi', text: 'Erst ein Stationsscan mit dem Leica RTC360, dann nimmst du das iPhone und scannst denselben Raum selbst (576 Punkte, Tiefenfusion, Netz). Am Ende zeigt der Vergleich die Abweichung.', meta: ['Wohnung', 'Smartphone', 'Vergleich'], scene: 'wohnung', flow: 'phoneVsPro' },
  { id: 'drone', icon: 'drone', title: 'Drohnenflug über das Haus', text: 'Livox Avia unter einer Drohne im Rasterflug. Die Rosette tastet Dach, Fassaden und Bäume ab – mit RTK-Bahn oder GNSS ohne Korrektur.', meta: ['Außengelände', 'Autoscan', 'Luft'], scene: 'aussen', scanner: 'avia', mount: 'drohne', auto: true },
  { id: 'hand', icon: 'hand', title: 'Handscanner-Rundgang', text: 'Leica BLK2GO in deiner Hand: R startet die Aufnahme, dann läufst du selbst um den Stapler. LiDAR-SLAM rechnet deine Bahn – und du verdeckst selbst einen Teil der Sicht.', meta: ['Werkhalle', 'SLAM', 'Handgeführt'], scene: 'halle', scanner: 'blk2go', mount: 'hand', start: true, hint: '<b>R</b> startet die Aufnahme – dann langsam um den Gabelstapler gehen und erneut <b>R</b>.' },
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
    const free = h('button.qcard', { html: `<div class="ic">${icon('catalog')}</div><h3>Frei arbeiten</h3><p>Du stehst in der Halle: Feldrechner holen, Scanner aus dem Koffer nehmen, Stativ aufstellen, Roboter bestücken. ${SCANNERS.length} Geräte von 100 € bis 120.000 €.</p><div class="meta"><span class="chip acc">Alles selbst</span></div>` });
    free.addEventListener('click', () => {
      this.hide();
      const a = this.app;
      if (!a.player.hasTablet) { a.setHint('<b>Willkommen!</b> Du bist der Vermesser. Geh zur <b>Geräteausgabe</b> (Tisch mit Koffern), nimm mit <b>F</b> den Feldrechner und wähle mit <b>E</b> einen Scanner. Das Stativ steht schon bereit.'); setTimeout(() => a.setHint(null), 16000); }
    });
    qs.appendChild(free);
    const cls = (k) => SCANNERS.filter((s) => s.cls === k).length;
    this.el.replaceChildren(
      h('div.hbrand', { html: LOGO.replace('width="28" height="28"', 'width="38" height="38"') + '<div><b>ECHO</b><small>LIDAR-STUDIO</small></div>' }),
      h('h1', { html: 'Laserscannen, wie es <em>wirklich</em> funktioniert.' }),
      h('p.lead', 'Du bist der Vermesser: Geh durch Halle, Straße, Wohnung, Prüfstrecke und Messraum, stell Stative auf, setz Scanner auf Roboter und Drohnen oder scanne selbst aus der Hand. Echte Abtastmuster, Strahldivergenz, Mischpixel, Mehrfachechos, Glas, Spiegel und Retroreflektoren, Rauschen nach Datenblatt, Sonne, Nebel und Regen.'),
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
    // Hinweise eines vorigen Schnellstarts nicht mitnehmen
    clearTimeout(this.hintTimer); a.setHint(null);
    const hintFor = (html, ms = 12000) => { a.setHint(html); this.hintTimer = setTimeout(() => a.setHint(null), ms); };
    if (q.scene && q.scene !== a.sceneId) await a.switchScene(q.scene);
    if (q.scanner && (!a.dev || a.dev.spec.id !== q.scanner)) await a.replaceDevice(q.scanner);
    if (q.mount && a.dev.mountKind !== q.mount) await a.setMount(q.mount);
    if (!a.player.hasTablet) a.player.takeTablet();
    if (q.start && a.dev.state !== 'stream') a.toggleStream();
    if (q.auto) { a.fpc.setTab('live'); a.mounts.start(); }
    if (q.hint) hintFor(q.hint);
    if (q.flow === 'phoneVsPro') await this.phoneVsPro();
    if (q.flow === 'roomModel') await this.roomModel(hintFor);
    if (q.tls) { a.fpc.setTab('scans'); hintFor(`<b>Tipp:</b> Zum Stativ gehen und <b>F</b> drücken – der Stationsscan läuft. Danach mit <b>G</b> das Stativ samt Scanner tragen, mit <b>E</b> neu aufstellen und erneut scannen.`); }
  }

  // Ablauf „Raum wie mit Polycam“: Stationsscan, dann Raummodell im Feldrechner
  async roomModel(hintFor) {
    const a = this.app, f = a.fpc;
    a.project.clear();
    await a.replaceDevice('rtc360');
    await a.setMount('stativ');
    a.lw.sync();
    a.setHint('<b>1/2</b> Stationsscan mit dem Leica RTC360 …');
    await f.stationScan();
    if (!a.project.scans.some((s) => s.kind === 'station')) { a.setHint(null); return; }
    a.setHint('<b>2/2</b> Raummodell: Boden, Decke, Wände, Türen und Fenster …');
    if (!a.player.tabletOpen) a.player.toggleTablet(true);
    f.setTab('model');
    const { buildModel, opts } = await import('../device/tabs/model.js');
    Object.assign(opts(f), { mode: 'raum', src: 'sichtbar', furniture: true, look: 'orig' });
    f.render();
    await buildModel(f);
    hintFor('Fertig – im Feldrechner drehen und zoomen, unten der Grundriss. <b>Objekt</b> rechnet stattdessen ein glattes Netz.', 10000);
  }

  // Ablauf „Smartphone gegen Profi“: Referenz-Stationsscan, dann iPhone-Raumscan, dann Scan-zu-Scan-Vergleich
  async phoneVsPro() {
    const a = this.app, f = a.fpc;
    a.project.clear();
    await a.replaceDevice('rtc360');
    await a.setMount('stativ');
    a.lw.sync();
    a.setHint('<b>1/3</b> Referenz: Stationsscan mit dem Leica RTC360 …');
    await f.stationScan();
    const ref = a.project.scans.find((s) => s.kind === 'station');
    if (!ref) { a.setHint(null); return; }
    a.setHint('<b>2/3</b> Jetzt du mit dem iPhone: Aufnahme läuft – dreh dich langsam, geh durch den Raum und beende mit <b>R</b> (oder dem Auslöser).');
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
      <p><b>Du bist die Figur.</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> oder Pfeiltasten zum Gehen, <kbd>Shift</kbd> schneller. In die Szene klicken fängt die Maus – dann umsehen, <kbd>Esc</kbd> gibt sie frei. Mausrad: Abstand der Kamera, <kbd>V</kbd>: Schulterblick oder Ich-Sicht. Am iPad: links ziehen zum Gehen, rechts wischen zum Umsehen, Tasten unten rechts.</p>
      <p><b>Aktionen</b> stehen unten in der Mitte, sobald du vor etwas stehst: <kbd>E</kbd> nehmen, aufsetzen, montieren · <kbd>F</kbd> einschalten, Stationsscan, Autoscan, Drehteller · <kbd>R</kbd> Aufnahme · <kbd>G</kbd> ablegen oder das Stativ samt Scanner tragen · <kbd>Q</kbd> markiert das Objekt in der Bildmitte (Ziel für den Autoscan, Sollgeometrie im Vergleich).</p>
      <p><b>Geräteausgabe</b> (Tisch mit Koffern): <kbd>E</kbd> öffnet den Katalog mit 44 Scannern – der gewählte liegt danach in deiner Hand. Dort liegt auch der <b>Feldrechner</b>: <kbd>F</kbd> nimmt ihn mit, <kbd>Tab</kbd> hält ihn vor dich. Darin: Live-Daten und Abstandsbild, Scans, Ausrichten, Bearbeiten, <b>3D-Modell</b> (glattes Netz oder Raum mit Grundriss, wie Polycam), Messen, Soll-Ist-Vergleich, Export.</p>
      <p><b>Plattformen</b>: Fahrroboter AMR-1, Roboterarm KX-5 am Drehteller (Messraum) und Drohne stehen geparkt herum. Mit dem Scanner in der Hand davor <kbd>E</kbd> – montiert. <kbd>F</kbd> startet den Autoscan um das markierte Objekt. Leichte Scanner (bis 2 kg, z. B. BLK2GO, ZEB, iPhone) misst du auch selbst aus der Hand: einschalten, <kbd>R</kbd>, losgehen – LiDAR-SLAM rechnet deine Bahn.</p>
      <p><b>Realismus</b>: Jeder Schuss wird mit mehreren Teilstrahlen über die Strahldivergenz verfolgt. Echos unterhalb der Pulsauflösung verschmelzen (Mischpixel), Glas lässt durch, Spiegel erzeugen Geisterpunkte, Retroreflektoren übersteuern. Auch du selbst bist für den Laser sichtbar und wirfst Scanschatten.</p>` });
    modal('Kurzanleitung', body, [{ label: 'Verstanden', primary: true }], { width: 'min(640px, 100%)' });
  }
}
