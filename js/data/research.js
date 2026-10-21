/* KYTHERA · Forschungsprogramme */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  D.branches = {
    A: { name: 'Analyse', text: 'Modelle, Prognosen, Entschlüsselung' },
    O: { name: 'Orbit', text: 'Satelliten, Bildaufklärung, Frühwarnung' },
    F: { name: 'Finanzen', text: 'Kapitalmärkte, Stiftungsstrukturen' },
    I: { name: 'Infrastruktur', text: 'Bauweisen, Energie, Klimaschutz' },
    D: { name: 'Diplomatie', text: 'Vermittlung, Plenum, Konsens' },
    M: { name: 'Mechanismus', text: 'Ursprung und Funktion des Mechanismus von Kythera', hidden: true },
  };

  // pts benötigte Forschungspunkte · cost Mrd ¤ · req Voraussetzungen
  D.research = [
    { id: 'A1', b: 'A', n: 'Prädiktive Modelle II', pts: 60, cost: 4, req: [], fx: 'Erfolgswahrscheinlichkeit aller Vorhaben +4 Punkte. PYTHIA zeigt Konfidenzbänder.' },
    { id: 'A2', b: 'A', n: 'Tiefenentschlüsselung', pts: 90, cost: 6, req: ['A1'], fx: 'Depeschen werden dreimal so schnell entschlüsselt. Rechenkosten −40 %.' },
    { id: 'A3', b: 'A', n: 'Kontextfusion', pts: 140, cost: 9, req: ['A2'], fx: 'PYTHIA bewertet Empfehlungen mit erwartetem Nutzen. Analysekosten entfallen.' },
    { id: 'O1', b: 'O', n: 'Hochauflösende Optik', pts: 80, cost: 7, req: [], fx: 'Bildaufklärung mit 0,3 m/px statt 4 m/px. Details auf Satellitenbildern werden erkennbar.' },
    { id: 'O2', b: 'O', n: 'Konstellation II', pts: 120, cost: 14, req: ['O1'], fx: '+2 ARGO-Satelliten. Mehr Regionen gleichzeitig abgedeckt.' },
    { id: 'O3', b: 'O', n: 'Frühwarnsystem', pts: 100, cost: 8, req: ['O1'], fx: 'Krisen in abgedeckten Regionen werden früher erkannt: +30 s Entscheidungszeit, Schäden −25 %.' },
    { id: 'F1', b: 'F', n: 'Algorithmischer Handel', pts: 70, cost: 5, req: [], fx: 'Kursprognosen im Kapitalbereich. Handelsgebühren −50 %.' },
    { id: 'F2', b: 'F', n: 'Stiftungsarchitektur', pts: 110, cost: 9, req: ['F1'], fx: 'Diskretionskosten aller Vorhaben −30 %.' },
    { id: 'F3', b: 'F', n: 'Souveräner Fonds II', pts: 150, cost: 12, req: ['F2'], fx: 'Dividenden und Beteiligungserträge +25 %.' },
    { id: 'I1', b: 'I', n: 'Modulbauweise', pts: 80, cost: 6, req: [], fx: 'Infrastruktur-, Energie- und Korridorvorhaben 25 % schneller.' },
    { id: 'I2', b: 'I', n: 'Fusionsmaterialien', pts: 160, cost: 16, req: ['I1'], fx: 'Neuer Vorhabentyp: Fusionspilotanlage.' },
    { id: 'I3', b: 'I', n: 'Klimamodell Meridian', pts: 100, cost: 7, req: ['I1'], fx: 'Naturereignisse richten 30 % weniger Schaden an. Prognosen im Atlas.' },
    { id: 'D1', b: 'D', n: 'Vermittlerkorps', pts: 70, cost: 4, req: [], fx: 'Vermittlungsmissionen und Handelsabkommen +10 Punkte Erfolg, Einflusskosten −25 %.' },
    { id: 'D2', b: 'D', n: 'Plenarprotokoll', pts: 90, cost: 5, req: ['D1'], fx: 'Werben um Stimmen im Kuratorium kostet 40 % weniger Einfluss und gelingt häufiger.' },
    { id: 'D3', b: 'D', n: 'Konsensarchitektur', pts: 130, cost: 8, req: ['D2'], fx: 'Eigene Beschlussvorlagen erhalten +1 Grundzustimmung bei jedem Sitz.' },
    { id: 'M1', b: 'M', n: 'Zahnradanalyse', pts: 90, cost: 6, req: [], fx: 'Rekonstruktion der 37 Zahnräder. Öffnet die Ansicht MECHANISMUS.' },
    { id: 'M2', b: 'M', n: 'Resonanzkartierung', pts: 130, cost: 9, req: ['M1'], fx: 'Zeigt, welche Beschlüsse des Kuratoriums PYTHIA vorhergesagt hat, bevor sie beantragt wurden.' },
    { id: 'M3', b: 'M', n: 'Nullstellung', pts: 180, cost: 12, req: ['M2'], fx: 'Unbekannt. Die Projektbeschreibung ist geschwärzt.' },
  ];
})();
