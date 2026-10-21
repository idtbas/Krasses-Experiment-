/* KYTHERA · Satelliten, Schiffe, Rechenzentren, Netzknoten, Dateisystem */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  // inc Bahnneigung° · per Umlauf in s (Echtzeit) · ph Phase · fn Funktion
  D.sats = [
    { id: 'ARGO-1', inc: 52, per: 140, ph: 0.0, lon0: -40, fn: 'Optisch', focus: 'MER' },
    { id: 'ARGO-2', inc: 63, per: 150, ph: 0.3, lon0: 60, fn: 'Optisch', focus: 'KAI' },
    { id: 'ARGO-3', inc: 44, per: 130, ph: 0.6, lon0: 140, fn: 'Radar', focus: 'SUN' },
    { id: 'ARGO-4', inc: 71, per: 160, ph: 0.15, lon0: -110, fn: 'Radar', focus: 'WES' },
    { id: 'ARGO-5', inc: 35, per: 125, ph: 0.8, lon0: 20, fn: 'Wetter', focus: 'TAR' },
    { id: 'ARGO-6', inc: 82, per: 170, ph: 0.45, lon0: -60, fn: 'Kommunikation', focus: null },
    { id: 'ARGO-7', inc: 58, per: 145, ph: 0.25, lon0: 100, fn: 'Optisch', focus: null, extra: true },
    { id: 'ARGO-8', inc: 49, per: 135, ph: 0.7, lon0: -150, fn: 'Radar', focus: null, extra: true },
    { id: 'ARGO-9', inc: 66, per: 155, ph: 0.5, lon0: 0, fn: 'Optisch', focus: null, extra: true },
  ];

  D.ships = [
    { id: 'HALVORSEN', cls: 'Forschungsschiff', route: 'binnen', speed: 0.010, crew: 46, home: 'Alamar', cap: 'Tiefsee, Archäologie' },
    { id: 'NORDLICHT', cls: 'Eisbrecher', route: 'westring', speed: 0.007, crew: 61, home: 'Isberg', cap: 'Polar, Logistik' },
    { id: 'MERIDIAN STAR', cls: 'Versorger', route: 'suedbogen', speed: 0.006, crew: 38, home: 'Porto Sol', cap: 'Katastrophenhilfe' },
    { id: 'KESTREL', cls: 'Forschungsschiff', route: 'ostpazifik', speed: 0.008, crew: 41, home: 'Port Halden', cap: 'Ozeanographie' },
    { id: 'SIROCCO', cls: 'Schnellfrachter', route: 'polar', speed: 0.009, crew: 22, home: 'Station Meridian-Süd', cap: 'Polarversorgung' },
  ];

  // cap Rechenkapazität (EFLOP-h/min) · lvl Ausbaustufe
  D.dcs = [
    { id: 'KFJ', name: 'Kaldfjord', r: 'KAL', mw: 412, cap: 9, lvl: 3, core: true },
    { id: 'ORS', name: 'Kap Orsa', r: 'MER', mw: 96, cap: 3, lvl: 2 },
    { id: 'SHR', name: 'Shiren Süd', r: 'KAI', mw: 180, cap: 4, lvl: 2 },
    { id: 'PHD', name: 'Port Halden', r: 'HAL', mw: 72, cap: 2, lvl: 1 },
    { id: 'QDR', name: 'Qadir Solarcampus', r: 'TAR', mw: 140, cap: 2, lvl: 1 },
  ];

  D.nodes = [
    { id: 'KY-N1', name: 'Kap Orsa', pos: [-2, 44] },
    { id: 'KY-N2', name: 'Havenstad', pos: [-118, 44] },
    { id: 'KY-N3', name: 'Kaldfjord', pos: [-74, 67] },
    { id: 'KY-N4', name: 'Alamar', pos: [6, 41] },
    { id: 'KY-N5', name: 'Shiren', pos: [130, 36] },
    { id: 'KY-N6', name: 'Port Halden', pos: [148, -34] },
    { id: 'KY-N7', name: 'Qadir', pos: [30, 22] },
    { id: 'KY-N8', name: 'Tamyr', pos: [80, 44] },
    { id: 'KY-Ω', name: '—', pos: [21.4, 34.2], hidden: true },
  ];
  D.nodeLinks = [['KY-N1', 'KY-N2'], ['KY-N1', 'KY-N3'], ['KY-N1', 'KY-N4'], ['KY-N1', 'KY-N7'], ['KY-N3', 'KY-N2'], ['KY-N4', 'KY-N7'], ['KY-N4', 'KY-N8'], ['KY-N8', 'KY-N5'], ['KY-N5', 'KY-N6'], ['KY-N3', 'KY-N5'], ['KY-N4', 'KY-Ω'], ['KY-N3', 'KY-Ω']];

  D.anomalies = [
    { t: 'Zertifikat läuft in 72 h ab', sev: 1, fix: 'rotate', cause: 'Planmäßiger Ablauf. Rotation empfohlen.' },
    { t: 'Latenzspitze auf Übertragungsstrecke', sev: 1, fix: 'diag', cause: 'Überlastetes Seekabelsegment. Umleitung eingerichtet.' },
    { t: 'Wiederholte Authentifizierungsfehler', sev: 2, fix: 'rotate', cause: 'Veralteter Dienstschlüssel eines Wartungsskripts.' },
    { t: 'Ungewöhnlicher Datenabfluss', sev: 2, fix: 'isolate', cause: 'Fehlkonfiguriertes Backup schrieb in falschen Speicherbereich.' },
    { t: 'Prüfsummenabweichung im Speicher', sev: 2, fix: 'diag', cause: 'Defektes Speichermodul. Austausch beauftragt.' },
    { t: 'Unsignierter Prozess gestartet', sev: 3, fix: 'isolate', cause: 'Testumgebung eines Dienstleisters. Isoliert und entfernt.' },
  ];

  /* Virtuelles Dateisystem des Terminals */
  D.fs = {
    '/': ['home', 'archiv', 'var', 'sys'],
    '/home': ['sitz9', 'vesper'],
    '/home/sitz9': ['willkommen.txt', 'checkliste.txt'],
    '/home/vesper': ['notiz.txt', '.verlauf', '.kythera'],
    '/archiv': ['index.txt'],
    '/var': ['log'],
    '/var/log': ['auth.log', 'pythia.log', 'kern.log'],
    '/sys': ['version', 'knoten'],
  };
  D.files = {
    '/home/sitz9/willkommen.txt': `KYTHERA Terminal · Sitz IX

Dieses Terminal bietet direkten Zugriff auf alle Funktionen von KYTHERA.
Geben Sie "hilfe" ein, um alle Befehle zu sehen.

Pfeil hoch/runter: Befehlsverlauf · Tab: Vervollständigung`,
    '/home/sitz9/checkliste.txt': `[ ] Lagebild prüfen
[ ] Erstes Vorhaben genehmigen
[ ] PYTHIA befragen
[ ] Im Plenum abstimmen
[ ] Herausfinden, warum der Stuhl noch warm ist`,
    '/home/vesper/notiz.txt': `Die Maschine irrt nie. Das ist das Problem.

1.412 Abstimmungen. Null Abweichungen.
Wer zählt die Stimme von VIII?

Erinnerung: Halvorsen fragen, ob er schweigen kann.`,
    '/home/vesper/.verlauf': '@history',
    '/home/vesper/.kythera': `Breite 34,20 · Länge 21,40
Leuchtturm Nordspitze. Seit 1988 dunkel.
Die Farbe auf dem Dach hält etwa zehn Jahre.`,
    '/archiv/index.txt': '@archiv',
    '/var/log/auth.log': '@authlog',
    '/var/log/pythia.log': `[1987-10-21 00:00:00] PYTHIA Kern gestartet
[1988-02-02 03:12:00] Proxy-Signatur Sitz VIII initialisiert
[2009-06-14 11:20:41] WARN Ausgabefehler bei Anfrage "sitz 0" (Stufe 4)
[2019-07-11 16:02:13] Abstimmung 2019-07/4 · Proxy VIII: NEIN
[2026-09-09 03:12:00] Lesezugriff KY-0409 durch IX-alt
[2026-09-10 21:40:17] Leuchtfeuer Kythera: Signal empfangen
[2026-09-11 21:40:00] Leuchtfeuer Kythera: kein Signal`,
    '/var/log/kern.log': `KY-Kern 7.4.2 · Laufzeit seit 1987-10-21
Aktive Prozesse: 1.204
Prozess 0: ohne Benutzerkennung · Priorität: höchste · Beschreibung: —`,
    '/sys/version': 'KYTHERA 7.4.2 (Build 1902-41) · PYTHIA Kern 31.0 · Mechanismus-Emulation KY-3',
    '/sys/knoten': '@nodes',
  };
})();
