/* KYTHERA · MANDAT · Forschungsprogramme */
(function () {
  'use strict';
  const KY = window.KY;
  const D = (KY.data = KY.data || {});

  /* cost in Mrd. ¤, days Laufzeit, req: Voraussetzungen, fx: Wirkung (von der Simulation ausgewertet) */
  D.TECH = [
    { id: 'perowskit', n: 'Perowskit-Tandemzellen', field: 'Energie', icon: 'solar', cost: 2.2, days: 420, req: [], fx: { solarMult: 1.3 },
      text: 'Solarzellen mit über 34 % Wirkungsgrad. Neue Solarparks liefern 30 % mehr Strom.' },
    { id: 'feststoff', n: 'Feststoffbatterien', field: 'Energie', icon: 'battery', cost: 2.8, days: 520, req: [], fx: { batteryRisk: 0.35 },
      text: 'Nicht brennbare Akkus. Das Brandrisiko von Großspeichern und Batteriefabriken sinkt um zwei Drittel.' },
    { id: 'supra', n: 'Hochtemperatur-Supraleiter', field: 'Energie', icon: 'bolt', cost: 4, days: 700, req: ['feststoff'], fx: { hgueCost: 0.6 },
      text: 'Verlustfreie Stromleitungen. Fernleitungen kosten 40 % weniger.' },
    { id: 'fusion', n: 'Kompakte Fusion', field: 'Energie', icon: 'star', cost: 12, days: 1400, req: ['supra'], fx: { unlock: 'FUSION' },
      text: 'Supraleitende Magnete halten das Plasma stabil. Ermöglicht das erste Fusionskraftwerk der Welt.' },
    { id: 'smr2', n: 'Passive Reaktorsicherheit', field: 'Energie', icon: 'nuclear', cost: 3, days: 600, req: [], fx: { nuclearRisk: 0.45 },
      text: 'Reaktoren, die sich ohne Strom und Eingriff selbst abschalten. Das Störfallrisiko sinkt um mehr als die Hälfte.' },
    { id: 'impfplattform', n: 'Universelle Impfplattform', field: 'Gesundheit', icon: 'syringe', cost: 3.5, days: 640, req: [], fx: { epiMult: 0.5 },
      text: 'Impfstoffe gegen neue Erreger in 60 statt 300 Tagen. Epidemien fordern nur noch halb so viele Opfer.' },
    { id: 'kidiag', n: 'Klinische Diagnostik-Assistenz', field: 'Gesundheit', icon: 'stethoscope', cost: 1.6, days: 380, req: [], fx: { healthBoost: 1.25 },
      text: 'Software unterstützt Ärztinnen bei der Diagnose. Kliniken retten ein Viertel mehr Leben.' },
    { id: 'duerre', n: 'Dürreresistente Kulturpflanzen', field: 'Ernährung', icon: 'wheat', cost: 1.8, days: 560, req: [], fx: { droughtMult: 0.6 },
      text: 'Hirse, Mais und Reis, die mit der Hälfte des Wassers auskommen. Dürren fordern deutlich weniger Opfer.' },
    { id: 'entsalz', n: 'Solare Meerwasserentsalzung', field: 'Wasser', icon: 'water', cost: 2, days: 480, req: ['perowskit'], fx: { waterBoost: 1.5 },
      text: 'Trinkwasser aus dem Meer für ein Zehntel der bisherigen Kosten. Wasserprogramme wirken 50 % stärker.' },
    { id: 'fruehwarn', n: 'Erdbeben-Frühwarnsystem', field: 'Katastrophenschutz', icon: 'quake', cost: 1.4, days: 360, req: [], fx: { quakeMult: 0.7 },
      text: 'Sensornetze geben Sekunden bis Minuten Vorwarnzeit. Erdbeben fordern 30 % weniger Opfer.' },
    { id: 'klima', n: 'Hochauflösende Klimamodelle', field: 'Katastrophenschutz', icon: 'storm', cost: 1.5, days: 420, req: [], fx: { stormMult: 0.75 },
      text: 'Stürme, Brände und Hitzewellen werden Tage früher vorhergesagt. Opfer sinken um ein Viertel.' },
    { id: 'werkstoff', n: 'Selbstheilender Beton', field: 'Bauwesen', icon: 'building', cost: 2.4, days: 540, req: [], fx: { structRisk: 0.5 },
      text: 'Bakterien verschließen Risse im Beton. Einstürze, Damm- und Deichbrüche werden halb so wahrscheinlich.' },
    { id: 'modulbau', n: 'Serieller Modulbau', field: 'Bauwesen', icon: 'crane', cost: 1.2, days: 300, req: [], fx: { housingCost: 0.7 },
      text: 'Wohnungen aus der Fabrik. Wohnungsbau wird 30 % günstiger und schneller.' },
    { id: 'ccs', n: 'Direkte CO₂-Abscheidung', field: 'Klima', icon: 'cloud', cost: 5, days: 900, req: ['perowskit'], fx: { co2Global: 1 },
      text: 'Anlagen filtern CO₂ aus der Luft. Die Umweltqualität aller Staaten verbessert sich langsam.' },
  ];
  D.TECH_BY = {};
  D.TECH.forEach(t => { D.TECH_BY[t.id] = t; });
})();
