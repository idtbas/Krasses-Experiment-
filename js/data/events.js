/* KYTHERA · MANDAT · Naturereignisse, Krisen und Vorfälle
   Alle Ereignisse sind fiktiv. Schaden entsteht nur durch Natur, Unfälle oder gesellschaftliche Dynamik. */
(function () {
  'use strict';
  const KY = window.KY;
  const D = (KY.data = KY.data || {});

  /* sev: Gewichte für Stufe 1–5 · dead/displaced: Spannen je Stufe (Personen) · dmg: Schaden in % des BIP je Stufe
     dur: Dauer in Tagen · rate: mittlere Häufigkeit pro Weltjahr */
  D.EVENTS = {
    quake: {
      n: 'Erdbeben', icon: 'quake', kind: 'Natur', rate: 2.2, where: 'fault', sev: [30, 32, 22, 11, 5], dur: [8, 24],
      dead: [[0, 2], [2, 40], [40, 600], [600, 6000], [6000, 45000]], displaced: [[0, 500], [500, 8000], [8000, 90000], [90000, 600000], [600000, 2500000]],
      dmg: [0.02, 0.15, 0.8, 2.6, 7], tech: 'fruehwarn', relief: 1, radius: [40, 260],
      text: ['Ein Beben der Magnitude {mag} erschüttert die Region um {city}.', 'Gebäude sind eingestürzt, Rettungskräfte suchen in den Trümmern nach Überlebenden.'],
      mag: [4.8, 5.6, 6.4, 7.2, 8.1],
    },
    storm: {
      n: 'Tropensturm', icon: 'storm', kind: 'Natur', rate: 3.2, where: 'tropic-coast', sev: [26, 30, 24, 14, 6], dur: [6, 14],
      dead: [[0, 4], [4, 60], [60, 700], [700, 5000], [5000, 25000]], displaced: [[0, 3000], [3000, 40000], [40000, 300000], [300000, 1500000], [1500000, 5000000]],
      dmg: [0.05, 0.3, 1, 2.8, 6], tech: 'klima', relief: 1, flood: true, radius: [120, 520], track: true,
      text: ['Ein Wirbelsturm der Kategorie {cat} trifft bei {city} auf die Küste.', 'Sturmflut und Starkregen überschwemmen ganze Küstenstriche.'],
      cat: [1, 2, 3, 4, 5],
    },
    flood: {
      n: 'Hochwasser', icon: 'flood', kind: 'Natur', rate: 2.6, where: 'river', sev: [34, 32, 20, 10, 4], dur: [10, 30],
      dead: [[0, 2], [2, 25], [25, 300], [300, 2500], [2500, 12000]], displaced: [[200, 4000], [4000, 30000], [30000, 200000], [200000, 900000], [900000, 3000000]],
      dmg: [0.02, 0.12, 0.5, 1.6, 4], relief: 1, radius: [60, 300],
      text: ['Nach tagelangem Regen tritt der Fluss bei {city} über die Ufer.', 'Ganze Stadtteile stehen unter Wasser.'],
    },
    drought: {
      n: 'Dürre', icon: 'drought', kind: 'Natur', rate: 1.7, where: 'dry', sev: [30, 30, 22, 12, 6], dur: [90, 260],
      dead: [[0, 0], [0, 80], [80, 2500], [2500, 30000], [30000, 160000]], displaced: [[0, 2000], [2000, 40000], [40000, 400000], [400000, 2000000], [2000000, 6000000]],
      dmg: [0.2, 0.6, 1.5, 3, 5], shield: 'droughtShield', tech: 'duerre', relief: 1.4, nationwide: true, devFactor: true,
      text: ['Seit Monaten ist kein Regen gefallen. Brunnen versiegen, Ernten verdorren.', 'Hilfsorganisationen warnen vor einer Hungerkrise.'],
    },
    fire: {
      n: 'Waldbrand', icon: 'fire', kind: 'Natur', rate: 2.4, where: 'forest-hot', sev: [36, 32, 20, 9, 3], dur: [8, 30],
      dead: [[0, 1], [1, 12], [12, 80], [80, 450], [450, 2000]], displaced: [[100, 3000], [3000, 25000], [25000, 120000], [120000, 400000], [400000, 900000]],
      dmg: [0.02, 0.1, 0.35, 0.9, 2], tech: 'klima', relief: 0.8, radius: [30, 220],
      text: ['Flammen fressen sich durch die Wälder nahe {city}.', 'Rauch verdunkelt den Himmel, Ortschaften werden evakuiert.'],
    },
    epidemic: {
      n: 'Epidemie', icon: 'virus', kind: 'Gesundheit', rate: 1.1, where: 'dense', sev: [32, 30, 22, 11, 5], dur: [60, 220],
      dead: [[0, 30], [30, 600], [600, 9000], [9000, 70000], [70000, 400000]], displaced: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      dmg: [0.05, 0.3, 1.2, 3.5, 8], shield: 'epiShield', tech: 'impfplattform', relief: 1.2, nationwide: true, devFactor: true, spread: true,
      text: ['Ein neuartiger Erreger breitet sich von {city} aus.', 'Kliniken melden volle Stationen, Schulen schließen.'],
    },
    heat: {
      n: 'Hitzewelle', icon: 'thermo', kind: 'Natur', rate: 2.4, where: 'hot', sev: [36, 32, 20, 9, 3], dur: [10, 26],
      dead: [[0, 20], [20, 300], [300, 2500], [2500, 15000], [15000, 50000]], displaced: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      dmg: [0.02, 0.08, 0.3, 0.8, 1.6], relief: 0.7, nationwide: true, energyFactor: true,
      text: ['Temperaturen über 46 Grad: {nation} ächzt unter einer Hitzewelle.', 'Stromnetze sind überlastet, Kliniken schlagen Alarm.'],
    },
    cold: {
      n: 'Kältewelle', icon: 'snow', kind: 'Natur', rate: 1.4, where: 'cold', sev: [40, 30, 18, 9, 3], dur: [8, 20],
      dead: [[0, 6], [6, 80], [80, 600], [600, 3000], [3000, 9000]], displaced: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      dmg: [0.02, 0.06, 0.2, 0.5, 1], relief: 0.7, nationwide: true, energyFactor: true,
      text: ['Minus 40 Grad: Eine Kältewelle legt {nation} lahm.', 'Heizungen fallen aus, Straßen sind unpassierbar.'],
    },
    volcano: {
      n: 'Vulkanausbruch', icon: 'volcano', kind: 'Natur', rate: 0.35, where: 'ridge', sev: [30, 30, 24, 12, 4], dur: [12, 40],
      dead: [[0, 2], [2, 30], [30, 400], [400, 3000], [3000, 20000]], displaced: [[1000, 10000], [10000, 60000], [60000, 250000], [250000, 800000], [800000, 2000000]],
      dmg: [0.05, 0.25, 0.8, 2, 4], relief: 1, radius: [40, 200],
      text: ['Der Vulkan nahe {city} ist ausgebrochen. Aschewolken steigen kilometerhoch.', 'Der Flugverkehr in der Region ist eingestellt.'],
    },
  };

  /* Gesellschaftliche und wirtschaftliche Krisen (entstehen aus der Simulation) */
  D.CRISES = {
    crash: { n: 'Finanzkrise', icon: 'trendDown', kind: 'Wirtschaft', text: 'Panik an den Börsen: Der KX 500 bricht ein, Banken geraten ins Wanken.' },
    debt: { n: 'Staatsschuldenkrise', icon: 'bank', kind: 'Wirtschaft', text: 'Die Regierung kann ihre Anleihen kaum noch bedienen. Ratingagenturen stufen herab.' },
    blackout: { n: 'Großflächiger Stromausfall', icon: 'power', kind: 'Versorgung', text: 'Das überlastete Netz bricht zusammen. Millionen Menschen sitzen im Dunkeln.' },
    cropfail: { n: 'Missernte', icon: 'wheat', kind: 'Versorgung', text: 'Nach der Dürre fällt die Ernte aus. Lebensmittelpreise steigen dramatisch.' },
    strike: { n: 'Generalstreik', icon: 'megaphone', kind: 'Gesellschaft', text: 'Gewerkschaften legen das Land lahm: Häfen, Bahnen und Fabriken stehen still.' },
    unrest: { n: 'Massenproteste', icon: 'protest', kind: 'Gesellschaft', text: 'Hunderttausende demonstrieren gegen die Regierung.' },
    govfall: { n: 'Regierungskrise', icon: 'ballot', kind: 'Politik', text: 'Die Regierungskoalition ist zerbrochen. Neuwahlen stehen bevor.' },
    scandal: { n: 'Korruptionsskandal', icon: 'eyeglass', kind: 'Politik', text: 'Enthüllungen über Schmiergeldzahlungen erschüttern die Regierung.' },
    boom: { n: 'Wirtschaftsboom', icon: 'trendUp', kind: 'Wirtschaft', text: 'Die Wirtschaft wächst so schnell wie seit Jahrzehnten nicht.' },
  };

  /* Vorfälle an eigenen Vorhaben. dead/injured: Spannen je Stufe 1–5. dmg: Anteil der Investitionssumme. delay: Bauverzug (Tage) */
  const PHYS = (dead, inj, disp, dmg, delay) => ({ dead, inj, disp, dmg, delay });
  D.INCIDENTS = {
    bauunfall: Object.assign(PHYS([[0, 0], [0, 2], [2, 9], [8, 30], [30, 90]], [[0, 4], [3, 14], [10, 40], [30, 120], [80, 300]], null, [0.002, 0.01, 0.03, 0.06, 0.12], [5, 20, 60, 120, 240]), {
      n: 'Bauunfall', icon: 'helmet', kind: 'Unfall',
      d: ['Ein Kran stürzt auf der Baustelle {proj} bei {city} um.', 'Ein Gerüst bricht auf der Baustelle {proj} bei {city} zusammen.', 'Eine Explosion erschüttert die Baustelle {proj} bei {city}.', 'Ein Teil der Baugrube {proj} bei {city} rutscht ab und verschüttet Arbeiter.'],
      cause: ['Überlastung eines Krans', 'mangelhafte Sicherung', 'Zeitdruck auf der Baustelle', 'Materialfehler', 'unzureichende Schulung der Subunternehmer'],
    }),
    entgleisung: Object.assign(PHYS([[0, 0], [0, 3], [3, 18], [18, 70], [70, 220]], [[0, 10], [10, 40], [30, 120], [100, 300], [200, 600]], null, [0.002, 0.006, 0.015, 0.03, 0.05], [2, 7, 20, 45, 90]), {
      n: 'Zugunglück', icon: 'rail', kind: 'Unfall',
      d: ['Ein Hochgeschwindigkeitszug entgleist auf der neuen Strecke bei {city}.', 'Zwei Züge kollidieren auf der Schnellfahrstrecke nahe {city}.'],
      cause: ['ein Weichendefekt', 'ein Fehler in der Signaltechnik', 'Unterspülung des Gleisbetts', 'Ermüdungsbruch eines Radsatzes'],
    }),
    einsturz: Object.assign(PHYS([[0, 0], [0, 4], [4, 30], [30, 120], [120, 400]], [[0, 6], [6, 30], [20, 80], [60, 250], [200, 600]], null, [0.01, 0.05, 0.2, 0.45, 0.8], [10, 40, 120, 300, 600]), {
      n: 'Teileinsturz', icon: 'bridge', kind: 'Unfall',
      d: ['Ein Teil der Querung bei {city} bricht nach einem Sturm ab.', 'Risse in einem Pfeiler: Die Querung bei {city} wird gesperrt.', 'Ein Abschnitt der Querung bei {city} stürzt ins Meer.'],
      cause: ['Korrosion an Spannkabeln', 'ein Konstruktionsfehler', 'Schiffsanprall an einem Pfeiler', 'eine Jahrhundertwelle'],
    }),
    hafenbrand: Object.assign(PHYS([[0, 0], [0, 3], [3, 25], [25, 160], [160, 900]], [[0, 10], [8, 40], [40, 300], [300, 3000], [1500, 6000]], [[0, 0], [0, 500], [500, 6000], [6000, 60000], [60000, 220000]], [0.005, 0.02, 0.08, 0.25, 0.5], [5, 15, 60, 150, 300]), {
      n: 'Großbrand im Hafen', icon: 'fire', kind: 'Unfall',
      d: ['Im neuen Hafen von {city} brennt ein Gefahrgutlager.', 'Eine gewaltige Explosion zerstört Teile des Hafens von {city}.', 'Ein Containerschiff steht im Hafen von {city} in Flammen.'],
      cause: ['falsch deklariertes Gefahrgut', 'Selbstentzündung in einem Lager', 'ein Schweißunfall', 'überalterte Löschtechnik'],
    }),
    leck: Object.assign(PHYS([[0, 0], [0, 0], [0, 2], [0, 6], [2, 20]], [[0, 0], [0, 6], [4, 40], [30, 300], [200, 1500]], [[0, 0], [0, 300], [300, 4000], [4000, 30000], [30000, 120000]], [0.003, 0.01, 0.04, 0.1, 0.2], [0, 10, 30, 90, 180]), {
      n: 'Austritt von Schadstoffen', icon: 'drop', kind: 'Umwelt', env: true,
      d: ['Aus der Anlage {proj} bei {city} treten Chemikalien aus.', 'Ein Leck verseucht Gewässer nahe {city}.', 'Giftige Dämpfe aus der Anlage {proj}: {city} ruft zum Schließen der Fenster auf.'],
      cause: ['ein korrodiertes Rohrsystem', 'ein Bedienfehler', 'ein defektes Rückhaltebecken', 'Starkregen überflutet ein Lager'],
    }),
    tunneleinbruch: Object.assign(PHYS([[0, 0], [0, 3], [3, 14], [12, 40], [40, 110]], [[0, 4], [4, 20], [12, 50], [30, 120], [80, 250]], [[0, 0], [0, 200], [200, 2000], [2000, 8000], [8000, 20000]], [0.01, 0.03, 0.08, 0.15, 0.3], [20, 60, 150, 300, 500]), {
      n: 'Tunneleinbruch', icon: 'tunnel', kind: 'Unfall',
      d: ['Beim U-Bahn-Bau in {city} sackt eine Straße ab.', 'Ein Tunnelabschnitt unter {city} bricht ein, Häuser werden evakuiert.'],
      cause: ['unerwartet weicher Untergrund', 'ein Fehler bei der Vortriebsmaschine', 'eingedrungenes Grundwasser'],
    }),
    kabelbruch: Object.assign(PHYS([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0.02, 0.05, 0.1, 0.15, 0.2], [0, 0, 0, 0, 0]), {
      n: 'Kabelbruch', icon: 'cable', kind: 'Störung', noHarm: true,
      d: ['Das Seekabel zwischen {city} und {city2} ist gerissen. Das Internet der Region stockt.'],
      cause: ['ein Schleppnetz', 'ein Seebeben', 'ein Schiffsanker'],
    }),
    baumaengel: Object.assign(PHYS([[0, 0], [0, 0], [0, 6], [6, 30], [30, 120]], [[0, 0], [0, 8], [6, 40], [30, 150], [100, 400]], [[0, 300], [300, 3000], [3000, 15000], [15000, 40000], [40000, 90000]], [0.01, 0.03, 0.08, 0.2, 0.35], [0, 0, 0, 0, 0]), {
      n: 'Baumängel', icon: 'house', kind: 'Mängel',
      d: ['Risse in Neubauten: Bewohner in {city} müssen ihre Wohnungen verlassen.', 'Ein Wohnblock in {city} stürzt teilweise ein.', 'Schimmel und Brandschutzmängel in den neuen Vierteln von {city}.'],
      cause: ['minderwertiger Beton', 'eingesparte Prüfungen', 'Pfusch eines Subunternehmers'],
    }),
    unwetterschaden: Object.assign(PHYS([[0, 0], [0, 0], [0, 2], [1, 6], [4, 12]], [[0, 0], [0, 4], [2, 10], [6, 30], [10, 60]], null, [0.01, 0.04, 0.1, 0.2, 0.35], [0, 0, 0, 0, 0]), {
      n: 'Unwetterschaden', icon: 'storm', kind: 'Störung',
      d: ['Ein Sturm beschädigt die Anlage {proj} bei {city} schwer.', 'Hagel zerstört Teile der Anlage {proj} bei {city}.'],
      cause: ['ein Orkan', 'eine Superzelle', 'unterschätzte Windlasten'],
    }),
    dammbruch: Object.assign(PHYS([[0, 0], [0, 10], [10, 300], [300, 4000], [4000, 30000]], [[0, 20], [20, 200], [200, 1500], [1500, 9000], [9000, 40000]], [[500, 5000], [5000, 40000], [40000, 250000], [250000, 900000], [900000, 2500000]], [0.05, 0.2, 0.6, 1, 1], [30, 120, 400, 900, 9999]), {
      n: 'Dammbruch', icon: 'dam', kind: 'Katastrophe', scalePop: true,
      d: ['Der Staudamm bei {city} hat nachgegeben. Eine Flutwelle rollt durch das Tal.', 'Notablass am Damm bei {city}: Flussabwärts werden Ortschaften überflutet.', 'Risse in der Staumauer bei {city}: Hunderttausende werden evakuiert.'],
      cause: ['Sickerwasser im Dammkörper', 'ein Erdbeben in der Region', 'ein Jahrhunderthochwasser', 'versagende Hochwasserentlastung'],
    }),
    erdstoss: Object.assign(PHYS([[0, 0], [0, 0], [0, 2], [1, 8], [5, 30]], [[0, 0], [0, 5], [3, 20], [15, 80], [50, 250]], [[0, 0], [0, 200], [200, 2000], [2000, 10000], [10000, 40000]], [0.005, 0.02, 0.06, 0.12, 0.25], [0, 30, 90, 180, 360]), {
      n: 'Induzierter Erdstoß', icon: 'quake', kind: 'Unfall',
      d: ['Ein Erdstoß der Stärke {mag} erschüttert {city}. Die Bohrungen gelten als Ursache.', 'Risse in Häusern rund um das Geothermiekraftwerk bei {city}.'],
      cause: ['zu hoher Injektionsdruck', 'eine unbekannte Störungszone'],
    }),
    stoerfall: Object.assign(PHYS([[0, 0], [0, 0], [0, 3], [3, 40], [40, 600]], [[0, 0], [0, 4], [2, 30], [30, 400], [400, 6000]], [[0, 0], [0, 0], [0, 6000], [60000, 260000], [260000, 900000]], [0.002, 0.01, 0.15, 0.7, 1], [10, 60, 400, 1200, 9999]), {
      n: 'Störfall im Kraftwerk', icon: 'nuclear', kind: 'Katastrophe', nuclear: true,
      d: ['Meldepflichtiges Ereignis im Kernkraftwerk bei {city}: Ein Reaktor wird abgeschaltet.', 'Ausfall der Kühlung im Kraftwerk bei {city}. Die Behörden lösen Voralarm aus.', 'Radioaktivität tritt aus dem Kraftwerk bei {city} aus. Evakuierung im Umkreis von 20 Kilometern.', 'Kernschmelze im Kraftwerk bei {city}. Eine Sperrzone wird eingerichtet.'],
      cause: ['ein Defekt einer Kühlmittelpumpe', 'ein Bedienfehler während einer Revision', 'ein Stromausfall mit versagenden Notstromaggregaten', 'ein Konstruktionsmangel am Druckbehälter'],
    }),
    batteriebrand: Object.assign(PHYS([[0, 0], [0, 0], [0, 2], [1, 6], [4, 20]], [[0, 0], [0, 4], [2, 20], [10, 60], [30, 200]], [[0, 0], [0, 400], [400, 4000], [4000, 20000], [20000, 60000]], [0.02, 0.08, 0.2, 0.4, 0.7], [0, 30, 90, 180, 360]), {
      n: 'Brand im Batteriespeicher', icon: 'battery', kind: 'Unfall',
      d: ['Großspeicher bei {city} in Flammen: Feuerwehr kämpft gegen Lithiumbrand.', 'Giftiger Rauch über {city} nach einem Brand im Batteriespeicher.'],
      cause: ['ein thermisches Durchgehen einer Zelle', 'ein Kühlungsausfall', 'ein Fehler im Batteriemanagement'],
    }),
    versorgungsengpass: Object.assign(PHYS([[0, 0], [0, 2], [1, 8], [6, 30], [20, 80]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0, 0.01, 0.02, 0.04, 0.06], [0, 0, 0, 0, 0]), {
      n: 'Versorgungsengpass', icon: 'hospital', kind: 'Mängel',
      d: ['Personalmangel im Klinikum {city}: Notaufnahme zeitweise geschlossen.', 'Medikamente knapp: Das Klinikum {city} muss Operationen verschieben.'],
      cause: ['zu wenig ausgebildetes Personal', 'Lieferprobleme', 'eingesparte Betriebsmittel'],
    }),
    kuehlkette: Object.assign(PHYS([[0, 0], [0, 0], [0, 6], [6, 40], [40, 200]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0.05, 0.1, 0.2, 0.3, 0.4], [10, 20, 40, 60, 90]), {
      n: 'Unterbrochene Kühlkette', icon: 'syringe', kind: 'Mängel',
      d: ['Hunderttausende Impfdosen in {nation} verdorben: Kühlkette unterbrochen.', 'Impfkampagne in {nation} stockt nach Logistikpanne.'],
      cause: ['ausgefallene Kühlcontainer', 'eine Hitzewelle', 'gestohlene Generatoren'],
    }),
    gedraenge: Object.assign(PHYS([[0, 0], [0, 2], [2, 12], [12, 40], [40, 120]], [[0, 10], [10, 60], [40, 200], [150, 600], [400, 1500]], null, [0, 0.05, 0.1, 0.2, 0.3], [0, 0, 0, 0, 0]), {
      n: 'Massenpanik', icon: 'users', kind: 'Unfall',
      d: ['Gedränge am Festivalgelände in {city}: Menschen werden erdrückt.', 'Panik bei einem Konzert des Festivals in {city}.'],
      cause: ['zu wenige Ausgänge', 'Überfüllung', 'ein Fehlalarm', 'unzureichende Ordnerdienste'],
    }),
    kostenexplosion: Object.assign(PHYS([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0.08, 0.2, 0.4, 0.7, 1], [30, 90, 180, 300, 500]), {
      n: 'Kostenexplosion', icon: 'money', kind: 'Finanzen', noHarm: true,
      d: ['Das Vorhaben {proj} in {city} wird deutlich teurer als geplant.', 'Rechnungshof rügt Kostenexplosion beim Projekt {proj} in {city}.'],
      cause: ['gestiegene Materialpreise', 'Planungsfehler', 'Nachforderungen der Baufirmen'],
    }),
    verdraengung: Object.assign(PHYS([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 800], [800, 6000], [6000, 20000], [20000, 60000], [60000, 120000]], [0, 0.01, 0.02, 0.04, 0.06], [0, 20, 40, 80, 120]), {
      n: 'Verdrängung', icon: 'family', kind: 'Sozial',
      d: ['Mieten explodieren: Alteingesessene müssen {city} verlassen.', 'Räumung ganzer Straßenzüge für das Vorhaben {proj} in {city}.'],
      cause: ['spekulative Grundstückskäufe', 'fehlender Mieterschutz', 'beschleunigte Planverfahren'],
    }),
    industrieunfall: Object.assign(PHYS([[0, 0], [0, 3], [3, 15], [15, 70], [70, 300]], [[0, 6], [6, 30], [20, 120], [100, 600], [400, 2500]], [[0, 0], [0, 300], [300, 3000], [3000, 30000], [30000, 120000]], [0.005, 0.03, 0.1, 0.3, 0.6], [10, 30, 90, 240, 480]), {
      n: 'Industrieunfall', icon: 'factory', kind: 'Unfall',
      d: ['Explosion im neuen Werk in {city}.', 'Großbrand in der Fabrik bei {city}: Arbeiter eingeschlossen.', 'Ein Reaktionsbehälter im Werk {city} birst.'],
      cause: ['ein defektes Sicherheitsventil', 'Wartungsmängel', 'überlastete Schichtpläne', 'ein Bedienfehler'],
    }),
    streik: Object.assign(PHYS([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0.01, 0.02, 0.04, 0.06, 0.1], [0, 0, 0, 0, 0]), {
      n: 'Streik', icon: 'megaphone', kind: 'Sozial', noHarm: true,
      d: ['Beschäftigte in {city} legen die Arbeit nieder.', 'Streik in der Sonderwirtschaftszone {city}: „Wir sind keine Maschinen“.'],
      cause: ['niedrige Löhne', 'überlange Schichten', 'fehlender Arbeitsschutz'],
    }),
    korruption: Object.assign(PHYS([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0.02, 0.06, 0.12, 0.2, 0.3], [0, 30, 60, 120, 180]), {
      n: 'Veruntreuung', icon: 'eyeglass', kind: 'Finanzen', noHarm: true, trace: 14,
      d: ['Gelder für das Vorhaben {proj} in {nation} versickert: Ermittlungen gegen Beamte.', 'Lokaler Partner zweigt Millionen aus dem Vorhaben {proj} ab.'],
      cause: ['ein bestechlicher Beamter', 'Scheinrechnungen eines Partners', 'fehlende Kontrollen'],
    }),
    zahlungsausfall: Object.assign(PHYS([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], null, [0.1, 0.3, 0.5, 0.7, 0.9], [0, 0, 0, 0, 0]), {
      n: 'Zahlungsausfall', icon: 'bond', kind: 'Finanzen', noHarm: true,
      d: ['{nation} setzt Zahlungen auf seine Anleihen aus.'],
      cause: ['eine Staatsschuldenkrise'],
    }),
    waldbrand: Object.assign(PHYS([[0, 0], [0, 1], [1, 6], [4, 20], [15, 60]], [[0, 0], [0, 6], [4, 20], [15, 60], [40, 150]], [[0, 500], [500, 4000], [4000, 20000], [20000, 60000], [60000, 150000]], [0.05, 0.15, 0.3, 0.5, 0.7], [0, 0, 0, 0, 0]), {
      n: 'Brand im Aufforstungsgebiet', icon: 'fire', kind: 'Unfall',
      d: ['Feuer im neuen Wald in {nation}: Junge Bestände brennen.', 'Monokultur in Flammen? Waldbrand im Aufforstungsgebiet in {nation}.'],
      cause: ['Trockenheit', 'Brandstiftung durch Unbekannte', 'ein Blitzschlag'],
    }),
    deichbruch: Object.assign(PHYS([[0, 0], [0, 4], [4, 40], [40, 300], [300, 2000]], [[0, 10], [10, 60], [40, 300], [200, 1500], [800, 6000]], [[500, 6000], [6000, 40000], [40000, 200000], [200000, 700000], [700000, 2000000]], [0.05, 0.15, 0.4, 0.8, 1], [0, 0, 0, 0, 0]), {
      n: 'Deichbruch', icon: 'wave', kind: 'Katastrophe',
      d: ['Der neue Deich vor {city} hält der Sturmflut nicht stand.', 'Sperrwerk versagt: Meerwasser strömt nach {city}.'],
      cause: ['eine Sturmflut über dem Bemessungswert', 'ein Fehler in der Steuerung des Sperrwerks', 'Unterspülung'],
    }),
    fehlstart: Object.assign(PHYS([[0, 0], [0, 0], [0, 2], [1, 8], [4, 20]], [[0, 0], [0, 2], [2, 10], [6, 40], [20, 120]], [[0, 0], [0, 0], [0, 1000], [1000, 6000], [6000, 20000]], [0.02, 0.06, 0.12, 0.25, 0.4], [10, 30, 90, 180, 300]), {
      n: 'Fehlstart', icon: 'rocket', kind: 'Unfall',
      d: ['Rakete explodiert kurz nach dem Start vom Raumhafen bei {city}.', 'Trümmerteile einer Rakete gehen nahe {city} nieder.'],
      cause: ['ein Triebwerksausfall', 'ein Softwarefehler', 'ein Leck im Tank'],
    }),
  };

  /* Reaktionsmöglichkeiten des Krisenstabs auf einen Vorfall */
  D.RESPONSES = [
    { id: 'comp', n: 'Soforthilfe und Entschädigung', icon: 'heart', text: 'Betroffene und Hinterbliebene erhalten unbürokratisch Geld, Unterkunft und Beratung.', pressure: -14, trust: 5, op: 4 },
    { id: 'inquiry', n: 'Unabhängige Untersuchung', icon: 'eyeglass', text: 'Eine internationale Kommission klärt die Ursache auf. Prüfer sehen sich auch die Eigentümer an.', pressure: -9, trust: 6, op: 2, trace: 6 },
    { id: 'retrofit', n: 'Sicherheit nachrüsten', icon: 'wrench', text: 'Die Anlage wird auf den höchsten Standard gebracht. Künftiges Risiko sinkt stark.', pressure: -6, trust: 4, op: 1 },
    { id: 'pause', n: 'Vorübergehend stilllegen', icon: 'pause', text: 'Betrieb oder Bau ruhen 90 Tage. Keine Einnahmen, keine Wirkung, aber Zeit für Prüfungen.', pressure: -8, trust: 3, op: 2 },
    { id: 'shutdown', n: 'Endgültig stilllegen', icon: 'power', text: 'Das Vorhaben wird aufgegeben. Die Investition ist verloren, die Gefahr gebannt.', pressure: -18, trust: 2, op: 5 },
    { id: 'statement', n: 'Öffentliche Erklärung', icon: 'mic', text: 'Die Tarnstruktur (oder Ihr öffentliches Gesicht) äußert Bedauern und übernimmt Verantwortung.', pressure: -7, trust: 2, op: 3, trace: 3 },
    { id: 'silence', n: 'Schweigen', icon: 'eyeOff', text: 'Keine Reaktion. Kein Geld, keine Spuren, aber die Öffentlichkeit wartet.', pressure: 0, trust: -6, op: -4 },
  ];
})();
