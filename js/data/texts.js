/* KYTHERA · Ereignisse, Meldungen, Depeschen, Krisenentscheidungen */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  D.outlets = {
    WES: 'Havenstad Courant', KAL: 'Isberg Tidende', OSM: 'Varnower Rundschau', MER: 'Meridian Herald',
    TAR: 'Qadir Observer', SOL: 'Diário de Porto Sol', PAM: 'El Lucano', ZAM: 'Umora Daily Nation',
    YAR: 'Tamyr Vestnik', KAI: 'Shiren Shimbun', SUN: 'Pelangi Pos', HAL: 'Halden Ledger', GLOBAL: 'MNA Nachrichtenagentur',
  };

  /* Weltereignisse
     w(r): Gewicht abhängig von Regionszustand r.m · fx: Wirkung (skaliert mit Schwere) · com: Rohstoffimpuls in %
     sec: Sektorimpuls in % für Unternehmen der Region · crisis: Entscheidungsvorlage bei hoher Schwere */
  D.events = [
    { id: 'STURM', name: 'Sturmflut', cat: 'natur', regions: ['SUN', 'HAL', 'MER', 'WES', 'SOL', 'KAI'],
      w: m => 1 + (100 - m.infra) / 45, fx: { stab: -4, infra: -5, wohl: -2 }, com: { FRA: 2.5 }, sec: { LOG: -3 }, crisis: 'STURM', natur: true,
      head: ['Sturmflut trifft {cap}: Zehntausende in Notunterkünften', 'Schwerster Sturm seit Jahrzehnten legt Häfen in {reg} lahm', 'Deiche in {reg} halten nur knapp'] },
    { id: 'DUERRE', name: 'Dürre', cat: 'natur', regions: ['TAR', 'SOL', 'ZAM', 'PAM', 'YAR'],
      w: m => 0.8 + (100 - m.ener) / 80, fx: { wohl: -4, stab: -3, span: 3 }, com: { WEI: 5 }, sec: { AGR: -5 }, crisis: 'DUERRE', natur: true,
      head: ['Dürre in {reg}: Ernteprognose um ein Drittel gesenkt', 'Wasserrationierung in {cap} ausgeweitet', 'Flusspegel in {reg} auf historischem Tiefstand'] },
    { id: 'BEBEN', name: 'Erdbeben', cat: 'natur', regions: ['YAR', 'KAI', 'PAM', 'SUN'],
      w: () => 0.6, fx: { infra: -8, stab: -4, wohl: -2 }, sec: { IND: -3 }, crisis: 'BEBEN', natur: true,
      head: ['Erdbeben der Stärke {mag} erschüttert {reg}', 'Nachbeben in {reg}: Rettungskräfte arbeiten rund um die Uhr', 'Brücken und Bahnstrecken in {reg} gesperrt'] },
    { id: 'ENERGIE', name: 'Energieengpass', cat: 'wirtschaft', regions: null,
      w: m => m.ener < 50 ? (60 - m.ener) / 10 : 0.1, fx: { wohl: -3, stab: -2, ener: -4 }, com: { ENE: 6 }, sec: { ENE: 4, IND: -3 }, crisis: 'ENERGIE',
      head: ['Strompreise in {reg} verdoppeln sich binnen einer Woche', 'Netzbetreiber in {reg} warnt vor Lastabwürfen', 'Industrie in {reg} drosselt Produktion wegen Energiekosten'] },
    { id: 'STREIK', name: 'Hafenstreik', cat: 'wirtschaft', regions: ['MER', 'SUN', 'WES', 'PAM', 'KAI'],
      w: m => 0.4 + m.span / 40, fx: { wohl: -2, span: 4 }, com: { FRA: 4 }, sec: { LOG: -4 }, crisis: 'STREIK',
      head: ['Hafenarbeiter in {cap} legen die Arbeit nieder', 'Containerstau vor {cap}: {n} Schiffe warten', 'Streik in {reg} trifft globale Lieferketten'] },
    { id: 'DURCHBRUCH', name: 'Technologiedurchbruch', cat: 'fortschritt', regions: ['KAI', 'WES', 'HAL', 'OSM', 'TAR'],
      w: m => m.wohl / 60, fx: { wohl: 3, stab: 1 }, sec: { HLB: 5, PHA: 4, ROB: 5, ENE: 3 }, good: true,
      head: ['Forschende in {reg} melden Durchbruch bei Energiespeichern', 'Neues Fertigungsverfahren aus {reg} halbiert Kosten', '{reg}: Start-up stellt bahnbrechendes Diagnoseverfahren vor'] },
    { id: 'FUND', name: 'Rohstofffund', cat: 'wirtschaft', regions: ['KAL', 'ZAM', 'PAM', 'HAL', 'YAR'],
      w: () => 0.6, fx: { wohl: 4, span: 2 }, com: { LIT: -4 }, sec: { ROH: 7 }, good: true,
      head: ['Großes Lithiumvorkommen in {reg} bestätigt', 'Geologen entdecken Kupferlagerstätte in {reg}', '{reg}: Rohstofffund weckt Hoffnungen und Begehrlichkeiten'] },
    { id: 'HANDELSSTREIT', name: 'Handelsstreit', cat: 'politik', regions: null, dual: true,
      w: m => 0.3 + m.span / 50, fx: { span: 6, wohl: -2 }, com: { FRA: 2 },
      head: ['{reg} und {reg2} verhängen gegenseitig Strafzölle', 'Handelsgespräche zwischen {reg} und {reg2} abgebrochen', 'Zollstreit: {reg} droht {reg2} mit Exportstopp'] },
    { id: 'PROTEST', name: 'Protestwelle', cat: 'politik', regions: null,
      w: m => m.stab < 50 ? (55 - m.stab) / 8 : 0.05, fx: { stab: -4, span: 5, vert: -2 }, crisis: 'PROTEST',
      head: ['Massenproteste in {cap} gegen steigende Lebenshaltungskosten', 'Generalstreik in {reg} angekündigt', 'Regierung in {reg} unter Druck: Zehntausende auf den Straßen'] },
    { id: 'REGIERUNG', name: 'Regierungswechsel', cat: 'politik', regions: null,
      w: () => 0.35, fx: { vert: 0, span: 0 }, flip: true,
      head: ['Neue Regierung in {reg} vereidigt', 'Koalition in {reg} zerbricht: Neuwahlen angesetzt', '{reg}: Parlament wählt neue Regierungschefin'] },
    { id: 'ABKOMMEN', name: 'Regionales Abkommen', cat: 'politik', regions: null,
      w: m => m.span < 25 ? 0.8 : 0.2, fx: { stab: 3, span: -4, wohl: 1 }, good: true,
      head: ['{reg} unterzeichnet Infrastrukturpakt mit Nachbarn', 'Durchbruch bei Grenzgesprächen in {reg}', '{reg}: Regierung und Opposition einigen sich auf Reformpaket'] },
    { id: 'RALLY', name: 'Börsenrally', cat: 'markt', regions: ['WES', 'KAI', 'MER', 'HAL'],
      w: m => m.wohl / 90, fx: { wohl: 2 }, market: 3, good: true,
      head: ['Börse in {cap} schließt auf Rekordhoch', 'Anleger stürmen Technologiewerte aus {reg}', 'Meridian 24 klettert auf neues Jahreshoch'] },
    { id: 'KORREKTUR', name: 'Kurskorrektur', cat: 'markt', regions: ['WES', 'KAI', 'MER', 'OSM'],
      w: () => 0.45, fx: { wohl: -1 }, market: -4, crisis: 'KORREKTUR',
      head: ['Kursrutsch in {cap}: Meridian 24 verliert deutlich', 'Zinsangst erfasst die Märkte in {reg}', 'Banken in {reg} unter Verkaufsdruck'] },
    { id: 'EPIDEMIE', name: 'Grippewelle', cat: 'gesundheit', regions: null,
      w: m => 0.15 + (100 - m.infra) / 300, fx: { stab: -2, wohl: -1 }, sec: { PHA: 3 }, crisis: 'EPIDEMIE',
      head: ['Ungewöhnlich heftige Grippewelle in {reg}', 'Kliniken in {cap} an der Belastungsgrenze', 'Gesundheitsbehörde in {reg} ruft Notfallplan aus'] },
    { id: 'AUSFALL', name: 'Infrastrukturausfall', cat: 'technik', regions: null,
      w: m => m.infra < 45 ? (50 - m.infra) / 10 : 0.05, fx: { wohl: -3, stab: -2, infra: -3 },
      head: ['Großflächiger Stromausfall in {reg}', 'Brückeneinsturz legt Verkehr in {reg} lahm', 'Wasserversorgung in {cap} stundenlang unterbrochen'] },
  ];

  D.projectHeads = {
    start: [
      'Unbekannter Investor kündigt Großprojekt in {reg} an',
      'Stiftung mit Sitz in Meridia finanziert Vorhaben in {cap}',
      'Gerüchte über anonymen Geldgeber für Projekt in {reg}',
    ],
    done: {
      INF: ['Neue Infrastruktur in {reg} eingeweiht: „Ein Generationenprojekt“', '{cap} feiert Eröffnung des Hafenausbaus'],
      ENE: ['Neuer Energiepark in {reg} am Netz: Strompreise sinken', '{reg}: Energieversorgung so sicher wie seit Jahren nicht'],
      HUM: ['Hilfslieferungen erreichen Betroffene in {reg} binnen 48 Stunden', 'Rätselhaft schnell: Hilfe in {reg} „wie aus dem Nichts“'],
      HAN: ['Überraschend: {reg} und {reg2} schließen Handelsabkommen', 'Handelspakt zwischen {reg} und {reg2} unterzeichnet'],
      VER: ['Einigung in {reg}: Konfliktparteien legen Streit bei', 'Diskrete Vermittlung beendet Krise in {reg}'],
      FOR: ['Neues Forschungszentrum in {reg} eröffnet', '{reg}: Universitäten gründen gemeinsames Institut'],
      INV: ['Kapitalzufluss belebt Unternehmen in {reg}', 'Investoren entdecken {reg}: Kurse ziehen an'],
      BIL: ['Neues Stipendienprogramm in {reg}: tausende Bewerbungen', 'Stiftung eröffnet Schulen in {reg}'],
      KLI: ['{reg} schützt Küsten mit neuem Deichsystem', 'Frühwarnsystem in {reg} geht in Betrieb'],
      GES: ['Mobile Kliniken erreichen entlegene Regionen in {reg}', 'Impfkampagne in {reg} übertrifft alle Ziele'],
      LOG: ['Neuer Frachtkorridor verbindet {reg} und {reg2}', 'Erster Güterzug zwischen {reg} und {reg2} angekommen'],
      EXP: ['Forschungsschiff kehrt mit Funden nach {cap} zurück', 'Expedition vor {reg} meldet ungewöhnliche Ergebnisse'],
      FUS: ['Weltpremiere in {reg}: Erste Fusionsanlage liefert Strom', '„Ein neues Zeitalter“: Fusionsstrom aus {reg}'],
    },
    fail: ['Ehrgeiziges Projekt in {reg} gerät ins Stocken', 'Vorhaben in {reg} gescheitert: Investor zieht sich zurück'],
  };

  D.ambientHeads = [
    'Zentralbank von {reg} belässt Leitzins unverändert',
    'Studie: Lebenserwartung in {reg} steigt weiter',
    'Neue Fährverbindung zwischen {reg} und den Nachbarinseln',
    '{cap} plant autofreie Innenstadt bis 2030',
    'Tourismus in {reg} erreicht Vorkrisenniveau',
    'Regierung von {reg} stellt Haushaltsentwurf vor',
    'Archäologen in {reg} legen antike Hafenanlage frei',
    'Fachkräftemangel bremst Bauindustrie in {reg}',
    'Rekordernte bei Obst und Gemüse in {reg}',
    'Universität {cap} steigt in internationalem Ranking auf',
    'Inflation in {reg} sinkt den dritten Monat in Folge',
    'Philharmonie {cap} gastiert erstmals im Ausland',
  ];

  /* Krisenentscheidungen
     opts: cost {kap, ein, rech} · fx Regionswirkung · g globale Wirkung {disk, ans} · py PYTHIA-Bewertung (höher = bevorzugt) */
  D.crises = {
    STURM: {
      title: 'Sturmflut in {reg}', text: 'Ein Orkantief hat die Küste von {reg} getroffen. In {cap} sind ganze Stadtteile überflutet, die Behörden sind überfordert. Partnerorganisationen bitten um Unterstützung.',
      opts: [
        { t: 'Soforthilfe über Partnerorganisationen', d: 'Luftbrücke, Notunterkünfte, Trinkwasser.', cost: { kap: 4 }, fx: { stab: 6, vert: 8 }, g: { disk: -2 }, py: 3 },
        { t: 'Wiederaufbaufonds auflegen', d: 'Langfristige Mittel für Infrastruktur, anonym über die Entwicklungsbank.', cost: { kap: 11 }, fx: { infra: 6, stab: 3, vert: 4, wohl: 2 }, g: { disk: -3 }, py: 2 },
        { t: 'Nicht eingreifen', d: 'Ressourcen schonen. Die Region wird sich langsamer erholen.', cost: {}, fx: { stab: -3, vert: -3 }, g: {}, py: 0 },
      ],
    },
    DUERRE: {
      title: 'Dürre in {reg}', text: 'Die Niederschläge in {reg} liegen seit Monaten bei einem Drittel des Mittels. Die Getreidepreise steigen, in ländlichen Regionen wird Wasser knapp.',
      opts: [
        { t: 'Notreserven an Getreide freigeben', d: 'Stiftungsreserven stabilisieren die Preise.', cost: { kap: 3 }, fx: { stab: 4, vert: 5 }, g: {}, py: 2, com: { WEI: -4 } },
        { t: 'Mobile Entsalzungsanlagen entsenden', d: 'Aqua Meridia liefert binnen Tagen.', cost: { kap: 6 }, fx: { stab: 5, infra: 3, vert: 4 }, g: { disk: -2 }, py: 3, sec: { AQM: 4 } },
        { t: 'Lage beobachten', d: 'Keine Mittel binden. Preise und Stimmung können weiter kippen.', cost: {}, fx: { stab: -3, wohl: -2 }, g: {}, py: 0 },
      ],
    },
    BEBEN: {
      title: 'Erdbeben in {reg}', text: 'Ein starkes Beben hat {reg} getroffen. Straßen und Brücken sind beschädigt, Rettungskräfte arbeiten unter Hochdruck.',
      opts: [
        { t: 'Bergungsteams und Ausrüstung entsenden', d: 'Schwere Technik über Krisenlogistik-Partner.', cost: { kap: 5, ein: 4 }, fx: { stab: 6, vert: 9 }, g: { disk: -2 }, py: 3 },
        { t: 'Wiederaufbau über Grauwald Bau finanzieren', d: 'Schneller Wiederaufbau, gute Rendite für Beteiligungen.', cost: { kap: 9 }, fx: { infra: 7, wohl: 2 }, g: {}, py: 2, sec: { GWB: 6 } },
        { t: 'Nicht eingreifen', d: 'Die nationalen Behörden sind zuständig.', cost: {}, fx: { stab: -3, vert: -2 }, g: {}, py: 0 },
      ],
    },
    ENERGIE: {
      title: 'Energieengpass in {reg}', text: 'Die Netzreserven in {reg} sind erschöpft. Ohne zusätzliche Kapazität drohen rollierende Abschaltungen in Industrie und Haushalten.',
      opts: [
        { t: 'Lieferverträge über Nordlys Energi vermitteln', d: 'Kurzfristige Stromlieferungen zum Selbstkostenpreis.', cost: { kap: 4, ein: 6 }, fx: { ener: 8, stab: 3 }, g: {}, py: 3 },
        { t: 'Notkraftwerke anmieten', d: 'Teuer, aber sofort wirksam.', cost: { kap: 8 }, fx: { ener: 12, wohl: 2 }, g: { disk: -2 }, py: 2 },
        { t: 'Abwarten', d: 'Markt und Regierung finden eine Lösung, vielleicht.', cost: {}, fx: { wohl: -3, stab: -2 }, g: {}, py: 0 },
      ],
    },
    STREIK: {
      title: 'Hafenstreik in {cap}', text: 'Die Hafenarbeiter in {cap} streiken für höhere Löhne. Vor der Küste stauen sich die Schiffe, Lieferketten geraten unter Druck.',
      opts: [
        { t: 'Neutrale Vermittlung anbieten', d: 'Über den Hafenverband, ohne Absender.', cost: { ein: 10 }, fx: { span: -8, stab: 3 }, g: {}, py: 3 },
        { t: 'Lohnausgleichsfonds finanzieren', d: 'Beendet den Streik sofort. Setzt einen Präzedenzfall.', cost: { kap: 3 }, fx: { span: -10, vert: 4 }, g: { disk: -2 }, py: 2 },
        { t: 'Fracht umleiten', d: 'Alamar Shipping weicht auf andere Häfen aus.', cost: { kap: 1 }, fx: { wohl: -2 }, g: {}, py: 1, sec: { ALS: 2 } },
      ],
    },
    PROTEST: {
      title: 'Protestwelle in {reg}', text: 'In {cap} und anderen Städten demonstrieren Zehntausende gegen steigende Preise. Die Regierung wirkt ratlos.',
      opts: [
        { t: 'Sozialfonds über lokale Stiftungen', d: 'Entlastet Familien direkt und schnell.', cost: { kap: 6 }, fx: { stab: 6, span: -6, vert: 5 }, g: { disk: -2 }, py: 3 },
        { t: 'Dialogforum vermitteln', d: 'Regierung und Zivilgesellschaft an einen Tisch.', cost: { ein: 12 }, fx: { span: -8, stab: 3 }, g: {}, py: 2 },
        { t: 'Nicht eingreifen', d: 'Innere Angelegenheit der Region.', cost: {}, fx: { stab: -2 }, g: {}, py: 0 },
      ],
    },
    KORREKTUR: {
      title: 'Kursrutsch an den Märkten', text: 'Die Börse in {cap} verliert binnen Stunden deutlich. Algorithmen verstärken die Bewegung. Ihre Beteiligungen sind betroffen.',
      opts: [
        { t: 'Antizyklisch kaufen', d: '¤ 10 Mrd. in unterbewertete Titel. Hohe Rendite, wenn die Erholung kommt.', cost: { kap: 10 }, fx: {}, g: {}, py: 2, buyDip: 10 },
        { t: 'Gemeinschaftsfonds stützt den Markt', d: 'Beruhigt die Märkte, kostet Einfluss im Kuratorium.', cost: { ein: 15 }, fx: { wohl: 2, stab: 2 }, g: {}, py: 3, market: 3 },
        { t: 'Positionen halten', d: 'Keine Reaktion. Schwankungen gehören dazu.', cost: {}, fx: {}, g: {}, py: 1 },
      ],
    },
    EPIDEMIE: {
      title: 'Grippewelle in {reg}', text: 'Kliniken in {reg} melden doppelt so viele Fälle wie üblich. Impfstoff ist knapp, das Personal erschöpft.',
      opts: [
        { t: 'Impfstoffkontingent von Lumen freigeben', d: 'Lieferung binnen 72 Stunden.', cost: { kap: 3, ein: 4 }, fx: { stab: 4, vert: 7 }, g: {}, py: 3, sec: { LMP: 2 } },
        { t: 'Mobile Kliniken finanzieren', d: 'Entlastet die Krankenhäuser.', cost: { kap: 5 }, fx: { stab: 5, vert: 5, infra: 1 }, g: { disk: -1 }, py: 2 },
        { t: 'Beobachten', d: 'Die meisten Wellen ebben von selbst ab.', cost: {}, fx: { stab: -2 }, g: {}, py: 0 },
      ],
    },
  };

  /* Interne Ereignisse mit Entscheidung (Kuratorium, Netzwerk, Betrieb) */
  D.internal = [
    {
      id: 'ANFRAGE_PRESSE', title: 'Anfrage des Havenstad Courant',
      text: 'Mira Ekström, Chefredakteurin des Havenstad Courant, hat eine schriftliche Anfrage an die Stiftung Serrano gerichtet. Sie fragt nach der Herkunft der Mittel für mehrere Großprojekte der letzten Monate.',
      opts: [
        { t: 'Transparenzbericht der Stiftung veröffentlichen', d: 'Ehrlich, aber unvollständig. Öffnet Türen.', cost: {}, g: { disk: -4, ans: -2 }, person: ['P25', 12], py: 1 },
        { t: 'Höflich auf öffentliche Jahresberichte verweisen', d: 'Korrekt und unverbindlich.', cost: {}, g: { disk: 1 }, person: ['P25', -2], py: 3 },
        { t: 'Interview mit der Stiftungsleitung anbieten', d: 'Persönlich, kontrolliert. Ekström wird mehr wollen.', cost: { ein: 5 }, g: { disk: -2 }, person: ['P25', 20], py: 2 },
      ],
    },
    {
      id: 'GEFALLEN_CORVUS', title: 'Bitte von Sitz III', seat: 'CORVUS',
      text: 'CORVUS bittet Sie, ¤ 8 Mrd. aus Ihrem Budget kurzfristig in den Gemeinschaftsfonds zu überführen, um eine Gelegenheit am Anleihemarkt zu nutzen. Eine Rückzahlung mit Rendite wird zugesagt.',
      opts: [
        { t: 'Zustimmen', d: '¤ 8 Mrd. für 4 Minuten gebunden. Rückzahlung mit 12 % Rendite.', cost: { kap: 8 }, g: {}, seat: ['CORVUS', 14], loan: { amt: 8.96, t: 240 }, py: 3 },
        { t: 'Ablehnen', d: 'Sie behalten Ihre Liquidität.', cost: {}, g: {}, seat: ['CORVUS', -8], py: 1 },
      ],
    },
    {
      id: 'FORSCHERIN', title: 'Finanzierungsbitte aus Qadir',
      text: 'Dr. Noor Haddad bittet um ¤ 2 Mrd. für eine Pilotfabrik für Wüstensolarmodule. Wirkungsgrad und Haltbarkeit übertreffen alles, was am Markt verfügbar ist.',
      opts: [
        { t: 'Vollständig finanzieren', d: 'Beteiligung an der Pilotfabrik über Qadir Solar.', cost: { kap: 2 }, g: {}, person: ['P31', 18], region: ['TAR', { ener: 3, wohl: 1 }], sec: { QSR: 6 }, research: 15, py: 3 },
        { t: 'Anteilig finanzieren', d: 'Die Hälfte. Der Rest muss vom Markt kommen.', cost: { kap: 1 }, g: {}, person: ['P31', 6], region: ['TAR', { ener: 1 }], py: 2 },
        { t: 'Ablehnen', d: 'Kein strategischer Fokus.', cost: {}, g: {}, person: ['P31', -6], py: 0 },
      ],
    },
    {
      id: 'KUEHLUNG', title: 'Kühlung in Kaldfjord',
      text: 'Das Rechenzentrum Kaldfjord meldet erhöhte Kühlwassertemperaturen. Oskar Lindqvist empfiehlt, die Last für zehn Minuten zu drosseln. PYTHIA rät davon ab.',
      opts: [
        { t: 'Last drosseln (Empfehlung Lindqvist)', d: 'Rechenkapazität −30 % für 10 Minuten, kein Risiko.', cost: {}, g: {}, computeThrottle: 600, person: ['P18', 6], py: 0 },
        { t: 'Volllast beibehalten (Empfehlung PYTHIA)', d: 'Kein Kapazitätsverlust. Geringes Ausfallrisiko.', cost: {}, g: {}, risk: 'dc', py: 3 },
      ],
    },
    {
      id: 'STIPENDIUM', title: 'Ein Brief aus Umora',
      text: 'Fatou Diallo schreibt: 40 neue Solarschulen wären fertig, wenn die Finanzierung der Lehrkräfte für zwei Jahre gesichert wäre. Kosten: ¤ 0,6 Mrd.',
      opts: [
        { t: 'Finanzieren', d: 'Klein für das Kuratorium. Groß für 12.000 Kinder.', cost: { kap: 0.6 }, g: { ans: 1 }, person: ['P19', 16], region: ['ZAM', { vert: 4, stab: 1 }], py: 2 },
        { t: 'Auf das Stiftungsprogramm von LYRA verweisen', d: 'Über den regulären Weg. Dauert länger.', cost: {}, g: {}, seat: ['LYRA', 3], person: ['P19', 2], py: 1 },
      ],
    },
    {
      id: 'ROUTE', title: 'Nordroute frei',
      text: 'Kapitänin Ingrid Falk meldet: Das Eis auf der Nordroute ist zwei Wochen früher aufgebrochen als erwartet. Eine Konvoifahrt würde Fracht von Kaldmark nach Kaidan um 9 Tage verkürzen.',
      opts: [
        { t: 'Konvoi genehmigen', d: 'Frachtindex sinkt, Logistikwerte steigen.', cost: { kap: 1.5 }, g: {}, person: ['P32', 8], com: { FRA: -5 }, sec: { ALS: 3, TMR: -2 }, region: ['KAL', { wohl: 2 }], py: 3 },
        { t: 'Ablehnen', d: 'Zu riskant bei unklarer Wetterlage.', cost: {}, g: {}, person: ['P32', -3], py: 1 },
      ],
    },
  ];

  /* Depeschen: interne verschlüsselte Meldungen aus Büros, Stationen und Schiffen */
  D.dispatchSources = [
    'Feldbüro Alamar', 'Feldbüro Havenstad', 'Vertretung Shiren', 'Station Meridian-Süd', 'FS HALVORSEN', 'FS NORDLICHT',
    'Orbitalkontrolle Orsa', 'Rechenzentrum Kaldfjord', 'Feldbüro Umora', 'Vertretung Qadir', 'Feldbüro Porto Sol', 'Vertretung Port Halden',
  ];
  D.dispatches = [
    { k: 'chance', subj: 'Investitionsgelegenheit in {reg}', body: 'Die Regierung von {reg} sucht diskret Kapital für ein Hafen- und Bahnprogramm. Partner vor Ort signalisieren Vorzugskonditionen für Stiftungsmittel. Empfehlung: Infrastrukturprogramm oder Investitionsoffensive innerhalb der nächsten Minuten.', buff: { type: ['INF', 'INV'], succ: 12, ttl: 420 } },
    { k: 'chance', subj: 'Vermittlung erwünscht: {reg}', body: 'Beide Seiten des laufenden Streits in {reg} haben unabhängig voneinander um einen neutralen Vermittler gebeten. Ein solches Fenster schließt sich erfahrungsgemäß schnell.', buff: { type: ['VER', 'HAN'], succ: 15, ttl: 360 } },
    { k: 'chance', subj: 'Forschungspartner in {reg}', body: 'Eine Universität in {cap} bietet Laborflächen und Personal zu Selbstkosten an, wenn das Kuratorium eine Station mitfinanziert.', buff: { type: ['FOR', 'BIL'], succ: 12, ttl: 480, costMult: 0.75 } },
    { k: 'warnung', subj: 'Wetterwarnung: {reg}', body: 'Ozeanmodelle zeigen ein sich verstärkendes Tiefdruckgebiet vor {reg}. Wahrscheinlichkeit eines schweren Sturms binnen weniger Minuten: {p} %. Resilienzmaßnahmen jetzt würden Schäden erheblich mindern.', warn: 'STURM' },
    { k: 'warnung', subj: 'Netzlast kritisch: {reg}', body: 'Die Netzreserven in {reg} liegen unter 4 %. Ohne zusätzliche Kapazität droht ein Engpass.', warn: 'ENERGIE' },
    { k: 'markt', subj: 'Marktbeobachtung {tick}', body: 'Unsere Analysten in {cap} erwarten für {name} eine deutliche Bewegung: Auftragsbücher {dir}. Zeithorizont: wenige Minuten.', tip: true },
    { k: 'plenum', subj: 'Vertraulich: Haltung von {seat}', body: 'Aus dem Umfeld von {seat} ist zu hören, dass der Sitz Beschlüsse mit Schwerpunkt {axis} derzeit besonders wohlwollend prüft.', seatHint: true },
    { k: 'betrieb', subj: 'Lagebericht {src}', body: 'Routinemeldung. Alle Systeme nominell. Personal vollzählig. Keine besonderen Vorkommnisse. Nächster Bericht im regulären Turnus.' },
    { k: 'betrieb', subj: 'Funkverkehr {src}', body: 'Position gemeldet, Kurs gehalten. Seegang 4, Sicht gut. An Bord wird über das Kythera-Sperrgebiet gesprochen, seit die HALVORSEN dort im August ohne Erklärung zwei Tage vor Anker lag.' },
    { k: 'betrieb', subj: 'Wartungsprotokoll {src}', body: 'Planmäßige Wartung abgeschlossen. Hinweis: Der PYTHIA-Kern hat während des Fensters 4 Minuten 12 Sekunden lang Rechenlast angefordert, obwohl alle Anfragen pausiert waren. Ursache unbekannt.' },
  ];

  D.axisNames = { stab: 'Stabilität', wachs: 'Wachstum', disk: 'Diskretion', fors: 'Forschung', soli: 'Solidarität' };
})();
