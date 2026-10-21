/* KYTHERA · Kuratorium: Sitze und Beschlussvorlagen */
(function () {
  'use strict';
  const D = (window.KY.data = window.KY.data || {});

  // Achsen: stab Stabilität · wachs Wachstum · disk Diskretion · fors Forschung · soli Solidarität
  D.council = [
    {
      id: 'AQUILA', seat: 'I', role: 'Vorsitz · Hüter der Charta', since: 1998,
      prio: { stab: 0.45, disk: 0.35, wachs: 0.1, fors: 0.05, soli: 0.05 }, att: 18,
      bio: 'Führt den Vorsitz seit 2011. Spricht selten, protokolliert alles. Gilt als letzte Instanz in Auslegungsfragen der Charta von 1902.',
      style: 'förmlich', sig: 'A.',
    },
    {
      id: 'LYRA', seat: 'II', role: 'Stiftungen · Bildung · Kultur', since: 2014,
      prio: { soli: 0.5, stab: 0.2, fors: 0.2, wachs: 0.05, disk: 0.05 }, att: 30,
      bio: 'Verwaltet das Stiftungsnetz des Kuratoriums mit über 400 Programmen. Sieht im Kuratorium eine Verpflichtung, keine Beute.',
      style: 'warm', sig: 'L.',
    },
    {
      id: 'CORVUS', seat: 'III', role: 'Finanzen · Gemeinschaftsfonds', since: 2006,
      prio: { wachs: 0.6, disk: 0.2, stab: 0.15, fors: 0.05, soli: 0.0 }, att: -6,
      bio: 'Verwaltet den Gemeinschaftsfonds. Rechnet in Jahrzehnten, handelt in Sekunden. Misstraut jedem, der nicht rechnet.',
      style: 'knapp', sig: 'C.',
    },
    {
      id: 'DRACO', seat: 'IV', role: 'Kontinuität · Sicherheit des Kuratoriums', since: 2003,
      prio: { disk: 0.55, stab: 0.3, fors: 0.1, wachs: 0.05, soli: 0.0 }, att: 2,
      bio: 'Verantwortet Schutz, Nachfolge und Notfallpläne. Hat als Einziger offen Zweifel an der Rolle von PYTHIA geäußert (Sitzung 2019-07).',
      style: 'misstrauisch', sig: 'D.',
    },
    {
      id: 'CYGNUS', seat: 'V', role: 'Wissenschaft · Forschungsprogramme', since: 2009,
      prio: { fors: 0.6, soli: 0.15, wachs: 0.15, stab: 0.1, disk: 0.0 }, att: 36,
      bio: 'Physikerin von Ausbildung, Pragmatikerin aus Erfahrung. Stand VESPER von allen am nächsten.',
      style: 'neugierig', sig: 'C. (V)',
    },
    {
      id: 'ORION', seat: 'VI', role: 'Diplomatie · Vermittlung', since: 2016,
      prio: { stab: 0.4, soli: 0.3, wachs: 0.15, disk: 0.1, fors: 0.05 }, att: 20,
      bio: 'Ehemaliger Unterhändler. Glaubt, dass jedes Problem einen Tisch braucht, an dem alle sitzen, und einen, an dem niemand sitzt.',
      style: 'diplomatisch', sig: 'O.',
    },
    {
      id: 'VELA', seat: 'VII', role: 'Logistik · Seefahrt · Flotte', since: 2012,
      prio: { wachs: 0.4, stab: 0.25, fors: 0.15, soli: 0.1, disk: 0.1 }, att: 9,
      bio: 'Kommandiert die Flotte der Stiftung Serrano. Spricht in Seemeilen und Lieferfenstern.',
      style: 'direkt', sig: 'V.',
    },
    {
      id: 'HYDRA', seat: 'VIII', role: 'Stimmführung per Proxy', since: 1988,
      prio: null, att: 0, proxy: true,
      bio: 'Keine persönliche Teilnahme seit 1988. Stimmen werden über einen beglaubigten Proxy abgegeben (Charta, Anhang C). Keine Kontaktdaten hinterlegt.',
      style: '—', sig: '—',
    },
  ];

  // Beschlussvorlagen: imp = Wirkung auf Achsen (−1…+1); param: region | sector | topic
  D.resolutions = [
    { id: 'KRISENFONDS', title: 'Aufstockung des gemeinsamen Krisenfonds um ¤ {n} Mrd.', imp: { stab: 0.6, soli: 0.5, wachs: -0.2, disk: 0 },
      text: 'Der gemeinsame Krisenfonds wird aufgestockt. Jeder Sitz trägt ein Neuntel. Krisenhilfe aller Sitze wird für 10 Minuten um 30 % günstiger.',
      effect: 'Ihr Anteil: ¤ {share} Mrd. · Krisenhilfe −30 % (10 min) · globale Stabilität +' },
    { id: 'MORATORIUM', title: 'Moratorium für Großprojekte in {region}', param: 'region', imp: { stab: 0.35, wachs: -0.5, disk: 0.45, soli: 0 },
      text: 'Infrastruktur-, Energie- und Korridorprojekte in der Region werden für 8 Minuten ausgesetzt, um Aufmerksamkeit zu vermeiden.',
      effect: 'Großvorhaben in {region} gesperrt (8 min) · Diskretion +' },
    { id: 'FORSCHUNG', title: 'Gemeinsames Forschungsprogramm „{topic}“', param: 'topic', imp: { fors: 0.8, wachs: 0.15, disk: -0.1 },
      text: 'Alle Sitze legen Forschungsmittel zusammen. Ihre Forschungsgeschwindigkeit steigt für 10 Minuten um 25 %.',
      effect: 'Forschung +25 % (10 min) · Ihr Beitrag ¤ 3,0 Mrd.' },
    { id: 'DISKRETION', title: 'Verschärfung der Diskretionsrichtlinie', imp: { disk: 0.85, wachs: -0.3, fors: -0.1 },
      text: 'Alle Vorhaben laufen für 10 Minuten über zusätzliche Stiftungsschichten. Weniger Sichtbarkeit, mehr Reibung.',
      effect: 'Diskretion +8 · Diskretionskosten −20 % · Dauer +10 % (10 min)' },
    { id: 'PORTFOLIO', title: 'Umschichtung des Gemeinschaftsfonds in den Sektor {sector}', param: 'sector', imp: { wachs: 0.6, stab: -0.1, disk: -0.05 },
      text: 'Der Gemeinschaftsfonds kauft gezielt im Sektor. Der Kauf allein bewegt die Kurse.',
      effect: 'Kurse im Sektor {sector} steigen um ca. 6 %' },
    { id: 'MANDAT', title: 'Vermittlungsmandat für {region}', param: 'region', imp: { stab: 0.6, soli: 0.3, disk: -0.2 },
      text: 'Das Kuratorium bietet über neutrale Kanäle Vermittlung in laufenden Konflikten an.',
      effect: 'Spannungen in {region} −10 · Einfluss +10' },
    { id: 'EXPANSION', title: 'Aufbau einer Präsenz in {region}', param: 'region', imp: { wachs: 0.45, disk: -0.4, stab: 0.05 },
      text: 'Neue Büros, Beteiligungen und Stiftungslehrstühle. Sichtbarer, aber wirksamer.',
      effect: 'Präsenz in {region} +8 · Diskretion −3' },
    { id: 'BILDUNG', title: 'Stiftungsprogramm Bildung in {region}', param: 'region', imp: { soli: 0.75, wachs: 0.1, stab: 0.15, disk: -0.1 },
      text: 'Stipendien, Schulen, Lehrerausbildung. Langfristig das wirksamste Programm, das das Kuratorium betreibt.',
      effect: 'Kooperation in {region} +6 · Stabilität +2' },
    { id: 'ORBIT', title: 'Finanzierung eines zusätzlichen ARGO-Satelliten', imp: { fors: 0.45, wachs: 0.2, disk: -0.3 },
      text: 'Orsa Orbital baut einen weiteren Satelliten für die Konstellation des Kuratoriums.',
      effect: '+1 Satellit · Ihr Beitrag ¤ 6,0 Mrd.' },
    { id: 'ENERGIE', title: 'Strategische Energiereserve für {region}', param: 'region', imp: { stab: 0.5, wachs: 0.2, soli: 0.2, disk: -0.15 },
      text: 'Langfristige Lieferverträge und Speicherkapazitäten werden über Stiftungen abgesichert.',
      effect: 'Energiesicherheit in {region} +7' },
  ];

  // Sondervorlagen, die durch Ereignisse ausgelöst werden
  D.specialResolutions = {
    FREIGABE: { id: 'FREIGABE', title: 'Erweiterung der Freigabe für Sitz IX auf Stufe 4', imp: { stab: 0.25, disk: -0.05, fors: 0.1 },
      text: 'Antrag des Vorsitzes: Sitz IX erhält Einsicht in Archivbestände der Stufe 4, das Antragsrecht im Plenum und Zugriff auf die orbitale Bildaufklärung.',
      effect: 'Freigabestufe 4 · Antragsrecht · Archiv Stufe 4', special: true, proposer: 'AQUILA' },
    PRUEFUNG: { id: 'PRUEFUNG', title: 'Unabhängige Prüfung des PYTHIA-Kerns', imp: { disk: 0.2, stab: -0.15, fors: 0.35 },
      text: 'Antrag von Sitz IV: Eine externe Prüfgruppe erhält für 72 Stunden Lesezugriff auf Entscheidungsprotokolle des PYTHIA-Kerns seit 1988.',
      effect: 'Prüfbericht im Archiv · Mechanismus-Forschung', special: true, proposer: 'DRACO' },
  };

  D.researchTopics = ['Meeresspiegel 2060', 'Fusionsmaterialien', 'Präzisionslandwirtschaft', 'Polare Mikrobiologie', 'Energiespeicher', 'Frühwarnsysteme'];
})();
