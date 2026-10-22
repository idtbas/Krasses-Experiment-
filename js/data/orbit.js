/* KYTHERA · MANDAT · Raumfahrt: Trägerraketen und Satellitentypen (zivil, frei erfunden) */
(function () {
  'use strict';
  const KY = window.KY;
  const D = (KY.data = KY.data || {});

  D.ROCKETS = [
    { id: 'leicht', n: 'Kestrel-1', kind: 'Leichte Trägerrakete', cap: 1, cost: 0.06, ok: 0.93, days: 14, note: 'Ein kleiner Satellit, günstig und schnell startklar' },
    { id: 'mittel', n: 'Meridian-4', kind: 'Mittlere Trägerrakete', cap: 4, cost: 0.18, ok: 0.955, days: 21, note: 'Bewährtes Arbeitspferd für bis zu vier Satelliten' },
    { id: 'schwer', n: 'Atlantea Heavy', kind: 'Schwerlastrakete', cap: 12, cost: 0.6, ok: 0.95, days: 35, note: 'Zwölf Satelliten oder ein Modul der Raumstation', station: true },
    { id: 'wieder', n: 'Phoenix R', kind: 'Wiederverwendbare Rakete', cap: 6, cost: 0.11, ok: 0.97, days: 18, note: 'Landet nach dem Start wieder. Erfordert Forschung', tech: 'raketen' },
  ];
  D.ROCKET = {};
  D.ROCKETS.forEach(r => { D.ROCKET[r.id] = r; });

  D.SATS = {
    wetter: { n: 'Wettersatellit', pl: 'Wettersatelliten', icon: 'cloud', cost: 0.15, life: [6, 10], col: '#7fd3ff', inc: [0, 98], text: 'Sieht Stürme, Hitzewellen und Brände Tage im Voraus. Katastrophen fordern weniger Opfer.' },
    beob: { n: 'Erdbeobachtungssatellit', pl: 'Erdbeobachtungssatelliten', icon: 'globe', cost: 0.2, life: [5, 9], col: '#4fc46a', inc: [80, 98], text: 'Kartiert Dürren, Ernten und Schäden. Hilfe kommt gezielter an, Dürren treffen weniger hart.' },
    komm: { n: 'Kommunikationssatellit', pl: 'Kommunikationssatelliten', icon: 'radio', cost: 0.08, life: [5, 8], col: '#c9a24f', inc: [40, 70], text: 'Schnelles Internet für entlegene Regionen. Ab etwa 24 Satelliten ist die ganze Welt abgedeckt.' },
    navi: { n: 'Navigationssatellit', pl: 'Navigationssatelliten', icon: 'compass', cost: 0.12, life: [10, 14], col: '#9085e9', inc: [52, 58], text: 'Präzise Ortung für Verkehr, Landwirtschaft und Rettungsdienste. Infrastruktur weltweit besser.' },
    wiss: { n: 'Weltraumteleskop', pl: 'Weltraumteleskope', icon: 'star', cost: 0.5, life: [12, 20], col: '#ff9fd0', inc: [20, 35], text: 'Bilder aus der Tiefe des Alls. Forschung kommt schneller voran, die Welt staunt.' },
    modul: { n: 'Modul der Raumstation', pl: 'Module der Raumstation', icon: 'sat', cost: 1.2, life: [25, 30], col: '#ffffff', inc: [50, 52], station: true, text: 'Baut eine bemannte Raumstation. Ab drei Modulen ist sie bewohnt – ein Symbol für die ganze Menschheit.' },
  };
  D.SAT_PREFIX = { wetter: 'Halcyon', beob: 'Argos', komm: 'Lumen', navi: 'Polaris', wiss: 'Vesper', modul: 'Concordia' };
})();
