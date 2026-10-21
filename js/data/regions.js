/* KYTHERA · Regionen, Orte, Routen */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  // Kennzahlen: stab Stabilität · wohl Wohlstand · vert Kooperationsbereitschaft
  //             praes Präsenz des Kuratoriums · ener Energiesicherheit · infra Infrastruktur · span Spannungen
  D.regions = {
    WES: {
      name: 'Vesterland', kont: 'Aurelien', cap: 'Havenstad', capPos: [-118, 44], labelPos: [-110, 50], pop: 142,
      text: 'Finanz- und Dienstleistungszentrum am Westozean. Gefestigte Institutionen, aber eine alternde Infrastruktur und hohe Lebenshaltungskosten.',
      branchen: ['Finanzen', 'Software', 'Raumfahrt'], klima: 'gemäßigt, maritim', risiken: ['Sturmfluten', 'Immobilienblase'],
      m: { stab: 78, wohl: 82, vert: 44, praes: 58, ener: 61, infra: 57, span: 16 },
    },
    KAL: {
      name: 'Kaldmark', kont: 'Aurelien', cap: 'Isberg', capPos: [-84, 63], labelPos: [-82, 66], pop: 23,
      text: 'Rohstoffreiche Polarregion mit Wasserkraft und Seltenen Erden. Dünn besiedelt, strategisch für die Nordrouten und die Archivanlage Gotthelm.',
      branchen: ['Rohstoffe', 'Wasserkraft', 'Datenzentren'], klima: 'subpolar', risiken: ['Permafrost', 'Abwanderung'],
      m: { stab: 74, wohl: 63, vert: 58, praes: 66, ener: 84, infra: 41, span: 12 },
    },
    OSM: {
      name: 'Ostmark', kont: 'Aurelien', cap: 'Varnow', capPos: [-56, 44], labelPos: [-58, 48], pop: 96,
      text: 'Das industrielle Herz Aureliens: Stahl, Maschinenbau, Chemie. Der Strukturwandel belastet die Mittelschicht und die Regionalhaushalte.',
      branchen: ['Stahl', 'Maschinenbau', 'Chemie'], klima: 'kontinental', risiken: ['Strukturwandel', 'Energiepreise'],
      m: { stab: 61, wohl: 58, vert: 39, praes: 34, ener: 47, infra: 62, span: 31 },
    },
    MER: {
      name: 'Meridia', kont: 'Mittland', cap: 'Alamar', capPos: [6, 41], labelPos: [14, 50], pop: 118,
      text: 'Handelsküste am Binnenmeer mit alten Kaufmannsrepubliken, Versicherungen und den wichtigsten Häfen Mittlands. Wiege des Kuratoriums.',
      branchen: ['Handel', 'Versicherungen', 'Schifffahrt'], klima: 'mediterran', risiken: ['Hafenstreiks', 'Hitzewellen'],
      m: { stab: 69, wohl: 71, vert: 52, praes: 72, ener: 55, infra: 66, span: 22 },
    },
    TAR: {
      name: 'Tarsis', kont: 'Mittland', cap: 'Qadir', capPos: [30, 22], labelPos: [30, 18], pop: 87,
      text: 'Wüstenplateau mit dem größten Solarpotenzial der Welt. Wasserknappheit, eine sehr junge Bevölkerung und ehrgeizige Modernisierungspläne.',
      branchen: ['Solarenergie', 'Wasserstoff', 'Bau'], klima: 'arid', risiken: ['Dürre', 'Wasserkonflikte'],
      m: { stab: 52, wohl: 49, vert: 47, praes: 29, ener: 72, infra: 38, span: 38 },
    },
    SOL: {
      name: 'Solenne', kont: 'Solenne', cap: 'Porto Sol', capPos: [-58, -2], labelPos: [-64, -2], pop: 164,
      text: 'Tropischer Agrarraum und Kornkammer des Westens. Große Flüsse, dichter Regenwald, anfällig für Dürren und Preisschocks.',
      branchen: ['Agrar', 'Lebensmittel', 'Bioenergie'], klima: 'tropisch', risiken: ['Dürre', 'Ernteausfälle'],
      m: { stab: 57, wohl: 46, vert: 51, praes: 31, ener: 52, infra: 35, span: 33 },
    },
    PAM: {
      name: 'Pampera', kont: 'Solenne', cap: 'San Lucan', capPos: [-64, -30], labelPos: [-63, -33], pop: 58,
      text: 'Bergbau und Viehwirtschaft im Süden Solennes. Lithium- und Kupfervorkommen von Weltrang, eine Bevölkerung mit tiefem Misstrauen gegenüber Fremdkapital.',
      branchen: ['Lithium', 'Kupfer', 'Viehwirtschaft'], klima: 'semiarid', risiken: ['Erdbeben', 'Rohstoffpreise'],
      m: { stab: 63, wohl: 54, vert: 33, praes: 22, ener: 58, infra: 44, span: 27 },
    },
    ZAM: {
      name: 'Zambra', kont: 'Zambra', cap: 'Umora', capPos: [24, -12], labelPos: [27, -18], pop: 231,
      text: 'Schnell wachsende Volkswirtschaften mit enormen Bodenschätzen und einer jungen, gut vernetzten Bevölkerung. Die Infrastruktur hält mit dem Wachstum nicht Schritt.',
      branchen: ['Bergbau', 'Telekommunikation', 'Agrar'], klima: 'tropisch bis savannenartig', risiken: ['Überschwemmungen', 'Energieengpässe'],
      m: { stab: 55, wohl: 41, vert: 62, praes: 27, ener: 36, infra: 29, span: 34 },
    },
    YAR: {
      name: 'Yaru-Hochland', kont: 'Ostkontinent', cap: 'Tamyr', capPos: [80, 44], labelPos: [86, 48], pop: 49,
      text: 'Steppen und Hochgebirge zwischen Ost und West. Transitkorridore, Pipelines und eines der besten Windregime der Welt.',
      branchen: ['Transit', 'Windenergie', 'Bergbau'], klima: 'kontinental, trocken', risiken: ['Erdbeben', 'Transitstreit'],
      m: { stab: 59, wohl: 47, vert: 41, praes: 24, ener: 63, infra: 37, span: 36 },
    },
    KAI: {
      name: 'Kaidan', kont: 'Ostkontinent', cap: 'Shiren', capPos: [130, 36], labelPos: [126, 44], pop: 312,
      text: 'Technologische Großmacht des Ostens: Halbleiter, Robotik, Werften. Hohe Effizienz, hoher Druck, zunehmende Spannungen mit den Nachbarn.',
      branchen: ['Halbleiter', 'Robotik', 'Werften'], klima: 'gemäßigt bis subtropisch', risiken: ['Taifune', 'Lieferketten'],
      m: { stab: 72, wohl: 76, vert: 36, praes: 41, ener: 49, infra: 81, span: 34 },
    },
    SUN: {
      name: 'Sundara-Archipel', kont: 'Sundara', cap: 'Pelangi', capPos: [117, -7], labelPos: [116, -8.5], pop: 176,
      text: 'Tausende Inseln, Seehandel und Tourismus. Dynamisch und offen, aber Stürmen und dem steigenden Meeresspiegel stark ausgesetzt.',
      branchen: ['Seehandel', 'Tourismus', 'Fischerei'], klima: 'tropisch, maritim', risiken: ['Zyklone', 'Meeresspiegel'],
      m: { stab: 58, wohl: 52, vert: 57, praes: 33, ener: 41, infra: 34, span: 25 },
    },
    HAL: {
      name: 'Halden-Union', kont: 'Halden', cap: 'Port Halden', capPos: [148, -34], labelPos: [140, -30], pop: 34,
      text: 'Stabile Föderation im Südozean mit Biotechnologie, Rohstoffen und Polarforschung. Kleiner Markt, große Reserven, wachsende Bedeutung.',
      branchen: ['Biotechnologie', 'Rohstoffe', 'Polarforschung'], klima: 'gemäßigt bis arid', risiken: ['Buschbrände', 'Wasserknappheit'],
      m: { stab: 81, wohl: 74, vert: 55, praes: 46, ener: 66, infra: 59, span: 11 },
    },
  };
  D.regionOrder = ['WES', 'KAL', 'OSM', 'MER', 'TAR', 'SOL', 'PAM', 'ZAM', 'YAR', 'KAI', 'SUN', 'HAL'];

  D.metricInfo = {
    stab: { name: 'Stabilität', short: 'STAB', good: 'hi', text: 'Belastbarkeit von Institutionen und öffentlicher Ordnung.' },
    wohl: { name: 'Wohlstand', short: 'WOHL', good: 'hi', text: 'Wirtschaftsleistung und Lebensstandard im Verhältnis zum Weltmittel.' },
    vert: { name: 'Kooperation', short: 'KOOP', good: 'hi', text: 'Bereitschaft lokaler Partner, mit Stiftungen des Kuratoriums zusammenzuarbeiten.' },
    praes: { name: 'Präsenz', short: 'PRÄS', good: 'hi', text: 'Dichte eigener Beteiligungen, Büros und Partnerschaften in der Region.' },
    ener: { name: 'Energiesicherheit', short: 'ENER', good: 'hi', text: 'Versorgungssicherheit und Preisstabilität im Energiesystem.' },
    infra: { name: 'Infrastruktur', short: 'INFR', good: 'hi', text: 'Zustand von Verkehrswegen, Häfen, Netzen und Wasserversorgung.' },
    span: { name: 'Spannungen', short: 'SPAN', good: 'lo', text: 'Konflikte, Streiks, Handelsdispute. Hohe Werte gefährden Vorhaben.' },
  };

  // Besondere Orte
  D.pois = [
    { id: 'ORSA', name: 'Kap Orsa', type: 'sitz', pos: [-2, 44], text: 'Sitz des Kuratoriums seit 1902. Villa Serrano, Plenarsaal, Kontrollzentrum KY-N1.' },
    { id: 'GOTT', name: 'Archivanlage Gotthelm', type: 'archiv', pos: [-92, 61], text: 'Fels-Archiv in 380 m Tiefe. Klimatisiert, autark, Freigabestufe 4.' },
    { id: 'KYT', name: 'Kythera', type: 'unbekannt', pos: [21.4, 34.2], text: 'Felsinsel im Binnenmeer. Fundort des Mechanismus (1901). Seit 1988 Sperrgebiet der Stiftung Serrano.' },
    { id: 'POL', name: 'Station Meridian-Süd', type: 'forschung', pos: [20, -70], text: 'Polarforschungsstation im Südpolar-Vertragsgebiet. 41 Personen Stammbesatzung.' },
    { id: 'KFJ', name: 'Rechenzentrum Kaldfjord', type: 'rechen', pos: [-74, 67], text: 'Hauptrechenzentrum. 412 MW, Wasserkühlung aus dem Fjord.' },
  ];

  // Schifffahrtsrouten (Wegpunkte in lon/lat)
  D.routes = {
    westring: [[-130, 30], [-110, 22], [-80, 18], [-50, 22], [-30, 35], [-14, 44], [-30, 55], [-60, 72], [-110, 74], [-140, 58], [-130, 30]],
    binnen: [[-10, 36], [4, 34], [21, 31], [34, 34], [24, 38], [8, 37], [-10, 36]],
    suedbogen: [[-36, -10], [-20, -30], [5, -40], [40, -44], [80, -35], [110, -20], [100, -8], [90, 5], [70, 12], [55, 8], [50, -5], [40, -38], [0, -42], [-30, -22], [-36, -10]],
    ostpazifik: [[150, 20], [160, 0], [158, -24], [165, -46], [130, -48], [112, -38], [106, -16], [112, 12], [150, 20]],
    polar: [[-20, -62], [30, -64], [80, -60], [120, -58], [160, -60], [170, -50], [100, -52], [40, -58], [-20, -62]],
  };
})();
