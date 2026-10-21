/* KYTHERA · Unternehmen, Rohstoffe, Sektoren */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  D.sectors = {
    FIN: 'Finanzen', ENE: 'Energie', IND: 'Industrie', LOG: 'Logistik', AGR: 'Agrar', ROH: 'Rohstoffe',
    HLB: 'Halbleiter', TEL: 'Telekom', PHA: 'Pharma', RAU: 'Raumfahrt', ROB: 'Robotik', WAS: 'Wasser', BAU: 'Bau',
  };

  // t Kürzel · n Name · s Sektor · r Region · p Startkurs · v Volatilität · mc Marktkapitalisierung (Mrd ¤) · div Dividendenrendite p. a. · hold gehaltene Anteile (Mrd ¤ zu Startkurs)
  D.companies = [
    { t: 'HVB', n: 'Havenstad Bankhaus', s: 'FIN', r: 'WES', p: 84.20, v: 0.9, mc: 210, div: 3.4, hold: 9.5, text: 'Älteste Privatbank Vesterlands. Depotbank mehrerer Stiftungen des Kuratoriums.' },
    { t: 'ORB', n: 'Orsa Orbital', s: 'RAU', r: 'WES', p: 312.50, v: 1.6, mc: 96, div: 0.4, hold: 14.2, text: 'Betreiber von Erdbeobachtungs- und Kommunikationssatelliten. Baut die ARGO-Konstellation.' },
    { t: 'LMP', n: 'Lumen Pharmaceutica', s: 'PHA', r: 'WES', p: 141.80, v: 1.1, mc: 154, div: 2.1, hold: 0, text: 'Impfstoffe und Seltene-Krankheiten-Forschung. Starke Pipeline, hohe Bewertung.' },
    { t: 'NLE', n: 'Nordlys Energi', s: 'ENE', r: 'KAL', p: 47.30, v: 1.0, mc: 88, div: 4.8, hold: 6.0, text: 'Wasserkraft und Netzbetrieb in Kaldmark. Liefert Strom an das Rechenzentrum Kaldfjord.' },
    { t: 'ISH', n: 'Isberg Hydro', s: 'ENE', r: 'KAL', p: 22.90, v: 1.3, mc: 31, div: 3.9, hold: 0, text: 'Kleinere Wasserkraftgruppe mit Expansionsplänen nach Ostmark.' },
    { t: 'VSW', n: 'Varnow Stahlwerke', s: 'IND', r: 'OSM', p: 18.65, v: 1.5, mc: 27, div: 2.7, hold: 2.4, text: 'Traditionsreicher Stahlkonzern im Umbau auf wasserstoffbasierte Produktion.' },
    { t: 'GWB', n: 'Grauwald Bau', s: 'BAU', r: 'OSM', p: 56.10, v: 1.2, mc: 19, div: 2.2, hold: 0, text: 'Infrastruktur- und Tunnelbau. Profitiert direkt von Infrastrukturprogrammen.' },
    { t: 'ALS', n: 'Alamar Shipping', s: 'LOG', r: 'MER', p: 64.40, v: 1.4, mc: 58, div: 3.1, hold: 7.8, text: 'Größte Containerreederei am Binnenmeer. Betreibt Terminals in sieben Häfen.' },
    { t: 'AQM', n: 'Aqua Meridia', s: 'WAS', r: 'MER', p: 39.75, v: 0.8, mc: 24, div: 3.6, hold: 0, text: 'Entsalzung, Wasserversorgung und Abwassertechnik rund um das Binnenmeer.' },
    { t: 'MRE', n: 'Meridian Rückversicherung', s: 'FIN', r: 'MER', p: 227.00, v: 0.9, mc: 72, div: 3.0, hold: 5.1, text: 'Rückversicherer mit Katastrophenmodellen, die bemerkenswert oft recht behalten.' },
    { t: 'QSR', n: 'Qadir Solar', s: 'ENE', r: 'TAR', p: 31.20, v: 2.0, mc: 44, div: 0.9, hold: 3.3, text: 'Gigawatt-Solarparks und grüner Wasserstoff auf dem Tarsis-Plateau.' },
    { t: 'PSA', n: 'Porto Sol Agro', s: 'AGR', r: 'SOL', p: 27.80, v: 1.4, mc: 36, div: 2.5, hold: 0, text: 'Getreide, Soja, Lagerlogistik. Preissetzer im Westhandel.' },
    { t: 'SLM', n: 'San Lucan Minerales', s: 'ROH', r: 'PAM', p: 73.90, v: 1.9, mc: 41, div: 1.8, hold: 2.0, text: 'Lithium- und Kupferminen in Pampera. Politisch exponiert.' },
    { t: 'UMC', n: 'Umora Mining Corp.', s: 'ROH', r: 'ZAM', p: 12.40, v: 2.2, mc: 22, div: 1.2, hold: 0, text: 'Kobalt, Mangan, Graphit. Starkes Wachstum, schwache Logistik.' },
    { t: 'ZTC', n: 'Zambra Telekom', s: 'TEL', r: 'ZAM', p: 9.85, v: 1.7, mc: 18, div: 2.0, hold: 1.1, text: 'Mobilfunk und Zahlungsdienste für 140 Mio. Kunden.' },
    { t: 'TMR', n: 'Tamyr Rail', s: 'LOG', r: 'YAR', p: 15.30, v: 1.5, mc: 14, div: 2.8, hold: 0, text: 'Betreibt den Transitkorridor zwischen Kaidan und Mittland.' },
    { t: 'YWD', n: 'Yaru Wind', s: 'ENE', r: 'YAR', p: 8.70, v: 2.1, mc: 9, div: 0.0, hold: 0, text: 'Junger Windparkentwickler mit Zugang zu den besten Standorten des Hochlands.' },
    { t: 'SSC', n: 'Shiren Semiconductor', s: 'HLB', r: 'KAI', p: 488.00, v: 1.8, mc: 640, div: 0.7, hold: 21.0, text: 'Weltmarktführer für Logikchips unter 3 nm. Das Nadelöhr der digitalen Wirtschaft.' },
    { t: 'KRB', n: 'Kestrel Robotics', s: 'ROB', r: 'KAI', p: 96.40, v: 2.0, mc: 77, div: 0.3, hold: 4.5, text: 'Industrieroboter und autonome Hafentechnik.' },
    { t: 'KHI', n: 'Kaidan Schwerindustrie', s: 'IND', r: 'KAI', p: 44.15, v: 1.1, mc: 102, div: 2.9, hold: 0, text: 'Werften, Turbinen, Hochgeschwindigkeitszüge.' },
    { t: 'PLT', n: 'Pelangi Telekom', s: 'TEL', r: 'SUN', p: 6.30, v: 1.6, mc: 15, div: 3.3, hold: 0, text: 'Seekabel und Mobilfunk für den Archipel.' },
    { t: 'CRL', n: 'Coral Line', s: 'LOG', r: 'SUN', p: 21.55, v: 1.6, mc: 12, div: 2.4, hold: 0, text: 'Fähren und Inselfracht. Wetterabhängig, aber unverzichtbar.' },
    { t: 'HBP', n: 'Halden Biopharm', s: 'PHA', r: 'HAL', p: 118.30, v: 1.5, mc: 47, div: 0.8, hold: 3.6, text: 'Enzymforschung aus Extremorganismen der Polargebiete.' },
    { t: 'HRS', n: 'Halden Resources', s: 'ROH', r: 'HAL', p: 52.60, v: 1.3, mc: 63, div: 4.1, hold: 0, text: 'Eisenerz, Nickel, Seltene Erden. Solide Bilanz.' },
  ];

  // Rohstoffe & Indizes (Referenzpreise)
  D.commodities = [
    { id: 'ENE', n: 'Energie (Grundlast)', unit: '¤/MWh', p: 74.0, v: 1.4 },
    { id: 'LIT', n: 'Lithiumcarbonat', unit: '¤/t', p: 13850, v: 1.8 },
    { id: 'WEI', n: 'Weizen', unit: '¤/t', p: 232.5, v: 1.2 },
    { id: 'FRA', n: 'Frachtindex Binnenmeer', unit: 'Pkt.', p: 1840, v: 1.6 },
  ];

  D.indexName = 'Meridian 24';
})();
