/* KYTHERA · Vorhabentypen */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  // cost Mrd ¤ · ein Einfluss · rech Rechenkontingent · dur Sekunden · base Grunderfolg % · disk Diskretionskosten
  // fx: Wirkung auf Regionskennzahlen bei vollem Erfolg · tags: passende Fachgebiete im Netzwerk
  D.projectTypes = {
    INF: {
      name: 'Infrastrukturprogramm', short: 'INFRA', cost: 16, ein: 6, rech: 4, dur: 210, base: 66, disk: 4, big: true,
      text: 'Häfen, Bahnstrecken, Stromnetze und Wasserleitungen über Entwicklungsbanken und Baukonsortien.',
      fx: { infra: 9, wohl: 4, praes: 6, stab: 2 }, tags: ['INF', 'LOG', 'FIN'], sector: 'BAU',
      phases: ['Standortanalyse', 'Finanzierungsstruktur', 'Bauphase', 'Inbetriebnahme'],
      log: [
        'Bedarfsanalyse für {cap} abgeschlossen: {n} Trassen geprüft, {m} priorisiert.',
        'Finanzierung über Entwicklungsbank strukturiert. Stiftungsanteil nicht ausgewiesen.',
        'Generalunternehmer beauftragt. {n} Baulose parallel gestartet.',
        'Abnahme durch Regionalbehörde. Erste Verkehrsfreigabe in {cap}.',
      ],
    },
    ENE: {
      name: 'Energieprojekt', short: 'ENERGIE', cost: 22, ein: 4, rech: 6, dur: 240, base: 64, disk: 4, big: true,
      text: 'Solar-, Wind- und Wasserkraftanlagen mit Speichern und Netzanschluss. Senkt Preise, stabilisiert Versorgung.',
      fx: { ener: 11, wohl: 3, praes: 5, stab: 2 }, tags: ['ENE', 'INF', 'KLI'], sector: 'ENE',
      phases: ['Ressourcenkartierung', 'Netzanschluss', 'Errichtung', 'Netzsynchronisation'],
      log: [
        'Ertragsgutachten: {n} Standorte, erwartete Volllaststunden über Plan.',
        'Netzbetreiber stimmt Einspeisung zu. Anschlusskapazität {m} MW reserviert.',
        'Montage läuft. {n} % der Anlagen errichtet, Speicher geliefert.',
        'Synchronisation mit dem Regionalnetz erfolgreich. Großhandelspreis reagiert.',
      ],
    },
    HUM: {
      name: 'Krisenhilfe', short: 'HILFE', cost: 5, ein: 2, rech: 2, dur: 80, base: 78, disk: 2,
      text: 'Schnelle Hilfe über Partnerorganisationen: Notunterkünfte, Wasser, Medizin, Logistik. Wirkt stärker während einer akuten Krise.',
      fx: { stab: 6, vert: 7, praes: 2 }, tags: ['MED', 'LOG', 'DIP'], crisisMult: 2.2,
      phases: ['Lagebeurteilung', 'Mobilisierung', 'Verteilung'],
      log: [
        'Bedarfsmeldung von Partnern vor Ort ausgewertet: {n} Gemeinden priorisiert.',
        'Luftbrücke über {m} Flüge eingerichtet. Lager in {cap} geöffnet.',
        'Versorgung von schätzungsweise {k} Menschen gesichert.',
      ],
    },
    HAN: {
      name: 'Handelsabkommen', short: 'HANDEL', cost: 3, ein: 16, rech: 3, dur: 140, base: 60, disk: 3, dual: true,
      text: 'Vermittlung eines Handelsabkommens zwischen zwei Regionen. Beide profitieren, die Spannungen sinken.',
      fx: { wohl: 4, span: -6, stab: 1, vert: 2 }, tags: ['DIP', 'FIN', 'LOG'],
      phases: ['Sondierung', 'Verhandlung', 'Unterzeichnung'],
      log: [
        'Vertrauliche Sondierung zwischen {reg} und {reg2}. Beide Seiten gesprächsbereit.',
        'Zollkorridor für {n} Warengruppen verhandelt. Streitpunkt Agrarquoten entschärft.',
        'Abkommen unterzeichnet. Vermittlerrolle wird in keiner Erklärung erwähnt.',
      ],
    },
    VER: {
      name: 'Vermittlungsmission', short: 'VERMITTL', cost: 2.5, ein: 22, rech: 2, dur: 160, base: 58, disk: 2,
      text: 'Neutrale Vermittlung in Arbeitskämpfen, Grenzstreit und Regierungskrisen. Senkt Spannungen deutlich.',
      fx: { span: -16, stab: 5, vert: 3 }, tags: ['DIP'],
      phases: ['Kontaktaufnahme', 'Pendeldiplomatie', 'Einigung'],
      log: [
        'Kanäle zu allen Konfliktparteien in {reg} geöffnet. Gesprächsort: neutral.',
        'Pendeldiplomatie, Runde {n}. Kompromisslinie zeichnet sich ab.',
        'Einigung erzielt. Gemeinsame Erklärung ohne Nennung der Vermittler.',
      ],
    },
    FOR: {
      name: 'Forschungsstation', short: 'STATION', cost: 11, ein: 3, rech: 8, dur: 200, base: 70, disk: 3,
      text: 'Errichtung einer Forschungsstation mit lokalen Universitäten. Beschleunigt die eigene Forschung dauerhaft.',
      fx: { wohl: 2, vert: 4, praes: 4 }, tags: ['FOR', 'BIL'], research: 6,
      phases: ['Partnerauswahl', 'Aufbau', 'Forschungsbetrieb'],
      log: [
        'Kooperationsvertrag mit {n} Instituten in {reg}.',
        'Labore und Rechenknoten eingerichtet. Erste {m} Stellen besetzt.',
        'Station meldet Betriebsbereitschaft. Daten fließen nach Kaldfjord.',
      ],
    },
    INV: {
      name: 'Investitionsoffensive', short: 'INVEST', cost: 14, ein: 4, rech: 5, dur: 120, base: 68, disk: 3,
      text: 'Gezielte Beteiligungen an Unternehmen der Region. Das Kapital fließt mit Rendite zurück.',
      fx: { wohl: 4, praes: 4 }, tags: ['FIN'], returns: true,
      phases: ['Zielauswahl', 'Akquisition', 'Integration'],
      log: [
        '{n} Zielunternehmen bewertet. Bewertungsabschlag {m} % gegenüber Weltmittel.',
        'Beteiligungen über {k} Zweckgesellschaften erworben.',
        'Aufsichtsratsmandate besetzt. Ausschüttungspolitik angepasst.',
      ],
    },
    BIL: {
      name: 'Bildungsstiftung', short: 'BILDUNG', cost: 4, ein: 3, rech: 1, dur: 260, base: 82, disk: 1,
      text: 'Stipendien, Schulen und Lehrerausbildung. Langsam, sehr diskret, nachhaltig wirksam.',
      fx: { vert: 8, wohl: 2, stab: 3 }, tags: ['BIL'],
      phases: ['Programmdesign', 'Ausschreibung', 'Erster Jahrgang'],
      log: [
        'Programm mit lokalen Trägern entworfen. Schwerpunkt: {topic}.',
        '{n} Bewerbungen eingegangen. Auswahlkommission unabhängig besetzt.',
        'Erster Jahrgang mit {m} Stipendiaten gestartet.',
      ],
      topics: ['Ingenieurwesen', 'Medizin', 'Lehramt', 'Agrarwissenschaft', 'Informatik'],
    },
    KLI: {
      name: 'Klimaresilienz', short: 'RESILIENZ', cost: 13, ein: 3, rech: 5, dur: 220, base: 70, disk: 3, big: true,
      text: 'Deiche, Rückhaltebecken, Frühwarnsysteme. Senkt Schäden durch künftige Naturereignisse deutlich.',
      fx: { infra: 4, stab: 3 }, tags: ['KLI', 'INF'], resilience: 0.5,
      phases: ['Risikomodell', 'Planung', 'Bau', 'Übergabe'],
      log: [
        'Risikomodell für {reg} gerechnet: {n} Hochrisikozonen identifiziert.',
        'Schutzbauwerke geplant, Bürgerbeteiligung abgeschlossen.',
        'Bau von {m} km Schutzanlagen läuft.',
        'Übergabe an Regionalbehörden. Frühwarnsystem aktiv.',
      ],
    },
    GES: {
      name: 'Gesundheitsprogramm', short: 'GESUNDH', cost: 7, ein: 3, rech: 3, dur: 200, base: 74, disk: 2,
      text: 'Kliniken, Impfprogramme und medizinische Versorgung im ländlichen Raum.',
      fx: { stab: 4, vert: 5, wohl: 2 }, tags: ['MED'],
      phases: ['Bedarfsanalyse', 'Versorgungsaufbau', 'Regelbetrieb'],
      log: [
        'Versorgungslücken in {n} Distrikten kartiert.',
        '{m} mobile Kliniken ausgerüstet und besetzt.',
        'Programm in Regelbetrieb überführt. Träger: lokale Gesundheitsbehörde.',
      ],
    },
    LOG: {
      name: 'Logistikkorridor', short: 'KORRIDOR', cost: 19, ein: 8, rech: 4, dur: 250, base: 62, disk: 4, dual: true, big: true,
      text: 'Durchgehender Fracht- und Energiekorridor zwischen zwei Regionen. Hebt den Wohlstand auf beiden Seiten.',
      fx: { wohl: 5, infra: 5, span: -3, praes: 3 }, tags: ['LOG', 'INF'], sector: 'LOG',
      phases: ['Trassenplanung', 'Zollabkommen', 'Ausbau', 'Erster Durchlauf'],
      log: [
        'Trasse zwischen {reg} und {reg2} festgelegt. {n} Umschlagpunkte.',
        'Zoll- und Transitabkommen paraphiert.',
        'Ausbau auf {m} km abgeschlossen.',
        'Erster Durchlaufzug erreicht {cap} planmäßig.',
      ],
    },
    EXP: {
      name: 'Expedition', short: 'EXPED', cost: 6, ein: 2, rech: 6, dur: 170, base: 72, disk: 2,
      text: 'Forschungsexpedition mit einem Schiff der Stiftung Serrano. Kann Rohstoffe, Erkenntnisse oder Unerwartetes zutage fördern.',
      fx: { praes: 2 }, tags: ['FOR', 'LOG', 'ARC'], expedition: true,
      phases: ['Ausrüstung', 'Überfahrt', 'Feldarbeit', 'Auswertung'],
      log: [
        'Schiff ausgerüstet. {n} Wissenschaftlerinnen und Wissenschaftler an Bord.',
        'Überfahrt ohne Zwischenfälle. Wetterfenster günstig.',
        'Feldarbeit: {m} Proben, {k} Tauchgänge.',
        'Auswertung läuft in Kaldfjord.',
      ],
    },
    FUS: {
      name: 'Fusionspilotanlage', short: 'FUSION', cost: 48, ein: 12, rech: 20, dur: 320, base: 52, disk: 7, big: true, requires: 'I2',
      text: 'Erste kommerzielle Fusionsanlage der Welt. Verändert die Energiesicherheit einer Region grundlegend.',
      fx: { ener: 28, wohl: 8, praes: 8, stab: 3 }, tags: ['ENE', 'FOR', 'INF'], sector: 'ENE',
      phases: ['Standortgenehmigung', 'Magnetsystem', 'Erstes Plasma', 'Netzbetrieb'],
      log: [
        'Standort in {reg} genehmigt. Öffentlichkeit informiert: „Forschungsreaktor“.',
        'Supraleitende Spulen montiert. Kühlung stabil bei 4,2 K.',
        'Erstes Plasma: {n} Sekunden Einschluss. Q > 1.',
        'Netzbetrieb mit {m} MW. Ein historischer Moment ohne Zeremonie.',
      ],
    },
  };

  D.approaches = {
    DIS: { name: 'Diskret', dur: 1.3, cost: 1.0, succ: -2, disk: 0.35, text: 'Über zusätzliche Stiftungsschichten. Langsamer, kaum sichtbar.' },
    STD: { name: 'Standard', dur: 1.0, cost: 1.0, succ: 0, disk: 1.0, text: 'Ausgewogenes Vorgehen über bestehende Strukturen.' },
    SCH: { name: 'Beschleunigt', dur: 0.6, cost: 1.3, succ: -8, disk: 1.8, text: 'Maximale Geschwindigkeit, höhere Kosten und Sichtbarkeit.' },
  };

  D.outcomes = {
    VOLL: { name: 'Voller Erfolg', mult: 1.3, cls: 'ok' },
    ERF: { name: 'Erfolg', mult: 1.0, cls: 'ok' },
    TEIL: { name: 'Teilerfolg', mult: 0.45, cls: 'warn' },
    FEHL: { name: 'Gescheitert', mult: 0, cls: 'crit' },
  };

  D.expeditionFinds = [
    { t: 'Rohstoffvorkommen', text: 'Bisher unbekanntes Vorkommen an Seltenen Erden kartiert. Lizenzrechte über Stiftung gesichert.', kap: 6, wohl: 3 },
    { t: 'Biologische Probe', text: 'Extremophile Mikroorganismen mit ungewöhnlicher Enzymaktivität isoliert. Übergabe an Halden Biopharm.', research: 20 },
    { t: 'Historisches Wrack', text: 'Wrack eines Handelsseglers aus dem 17. Jahrhundert. Ladung: Instrumente, Seekarten. Übergabe an die Bibliothek von Alamar.', ein: 10 },
    { t: 'Klimadaten', text: 'Sedimentkerne mit 40.000 Jahren Klimageschichte. Verbessert das Frühwarnmodell.', research: 12, resilience: true },
    { t: 'Ohne Befund', text: 'Keine verwertbaren Funde. Messdaten archiviert.', none: true },
  ];
})();
