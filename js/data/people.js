/* KYTHERA · MANDAT · Personen, Milieus, Parteien, Tarnstrukturen (frei erfunden) */
(function () {
  'use strict';
  const KY = window.KY;
  const D = (KY.data = KY.data || {});

  /* Bevölkerungsmilieus: jedes Milieu bewertet Vorhaben nach eigenen Interessen */
  D.MILIEUS = [
    { id: 'urb', n: 'Städtische Mittelschicht', short: 'Stadt', color: '#7aa7d9', text: 'Angestellte, Selbstständige, Akademiker in den Metropolen' },
    { id: 'arb', n: 'Arbeiterschaft', short: 'Arbeit', color: '#d9a35f', text: 'Industrie, Handwerk, Dienstleistungen, Gewerkschaften' },
    { id: 'land', n: 'Landbevölkerung', short: 'Land', color: '#8fbf6a', text: 'Bauern, Fischer, Kleinstädte und Dörfer' },
    { id: 'jung', n: 'Junge Generation', short: 'Jugend', color: '#c98ad6', text: 'Studierende, Berufseinsteiger, Klimabewegung' },
    { id: 'kons', n: 'Traditionelle und Ältere', short: 'Tradition', color: '#b9b2a6', text: 'Rentner, Kirchen- und Vereinsmilieu, Konservative' },
  ];
  D.MIL_IDX = { urb: 0, arb: 1, land: 2, jung: 3, kons: 4 };

  /* Reaktionsvektoren je Handlung: [urb, arb, land, jung, kons] von −1 bis +1 */
  D.REACT = {
    HSR: [0.6, 0.3, -0.3, 0.4, -0.1], BRUECKE: [0.5, 0.5, 0.1, 0.4, 0.1], HAFEN: [0.2, 0.6, 0, 0.1, 0], FLUGHAFEN: [0.3, 0.4, -0.2, 0.1, -0.4],
    METRO: [0.8, 0.3, -0.1, 0.5, 0], SEEKABEL: [0.4, 0.1, 0, 0.4, 0], HGUE: [0.2, 0.2, -0.4, 0.2, -0.1], WOHNEN: [0.3, 0.6, 0, 0.6, 0.1],
    SOLAR: [0.4, 0.2, -0.1, 0.7, -0.2], WIND: [0.4, 0.2, -0.3, 0.7, -0.3], DAMM: [0.1, 0.3, -0.8, -0.4, -0.2], GEO: [0.3, 0.2, -0.1, 0.4, 0],
    KERN: [-0.2, 0.4, -0.4, -0.6, 0.1], FUSION: [0.6, 0.4, 0.1, 0.6, 0.3], SPEICHER: [0.2, 0.1, 0, 0.3, 0],
    KLINIK: [0.6, 0.7, 0.7, 0.5, 0.8], UNI: [0.5, 0.2, 0.1, 0.8, 0.2], SCHULEN: [0.5, 0.5, 0.5, 0.4, 0.5], IMPF: [0.5, 0.5, 0.5, 0.4, 0.1],
    WASSER: [0.4, 0.6, 0.8, 0.4, 0.5], GRUNDEINK: [0, 0.4, 0.2, 0.6, -0.5], KULTUR: [0.5, 0.1, -0.1, 0.8, -0.1], SPIELE: [0.3, 0.3, -0.1, 0.4, 0.3],
    PRESSE: [0.5, 0.1, 0, 0.3, -0.1], FIRMA: [0.2, 0.7, 0, 0.3, 0.1], SWZ: [0.2, 0, -0.1, 0.1, -0.2], ANLEIHE: [0, -0.1, -0.1, -0.1, -0.2],
    MIKRO: [0.1, 0.4, 0.7, 0.3, 0.2], AGRAR: [0, 0.2, 0.9, 0.1, 0.4], WALD: [0.3, 0.1, 0.2, 0.5, 0.2], MEER: [0.3, -0.1, -0.5, 0.5, 0],
    WUESTE: [0.3, 0.2, 0.6, 0.4, 0.3], DEICH: [0.5, 0.4, 0.3, 0.3, 0.4], VERMITTLUNG: [0.4, 0.2, 0.2, 0.3, 0.3], HANDEL: [0.3, -0.1, -0.1, 0.1, 0],
    GIPFEL: [0.4, 0, -0.1, 0.6, -0.1], HILFSFONDS: [0.4, 0.4, 0.5, 0.5, 0.5], RAUMHAFEN: [0.4, 0.3, -0.2, 0.5, 0], SATNETZ: [0.3, 0.1, 0.1, 0.3, 0],
    LUFTBRUECKE: [0.8, 0.8, 0.9, 0.8, 0.8], LAZARETT: [0.8, 0.8, 0.9, 0.7, 0.8], WIEDERAUFBAU: [0.7, 0.8, 0.8, 0.6, 0.8],
  };

  /* Politische Landschaft */
  D.PARTIES = {
    left: ['Soziale Allianz', 'Partei der Arbeit', 'Linksbund', 'Solidarische Union'],
    green: ['Ökologische Liste', 'Bündnis Zukunft', 'Grüne Erneuerung'],
    center: ['Bürgerliche Mitte', 'Liberale Union', 'Fortschrittspartei', 'Demokratische Sammlung'],
    right: ['Nationale Erneuerung', 'Heimatbund', 'Konservative Union', 'Partei der Ordnung'],
    pop: ['Bewegung Souveränität', 'Volkes Stimme', 'Neue Unabhängigkeit'],
  };
  /* Haltung je Richtung zu ausländischen Investoren (Offenheit) und zum Stifter */
  D.PARTY_LEAN = { left: { open: -5, donor: 4 }, green: { open: 0, donor: 6 }, center: { open: 12, donor: 2 }, right: { open: -8, donor: -4 }, pop: { open: -22, donor: -16 } };
  D.PARTY_COLOR = { left: '#c0504d', green: '#5f9e5a', center: '#d6a23c', right: '#4a6fa5', pop: '#8a5a9e' };
  D.PARTY_NAME = { left: 'Links', green: 'Grün', center: 'Mitte', right: 'Konservativ', pop: 'Souveränisten' };

  /* Beraterstab der Mandatsperson */
  D.ADVISORS = {
    haddad: { id: 'haddad', name: 'Leila Haddad', role: 'Krisenkoordinatorin', short: 'Krisenstab', color: '#d0634f', init: 'LH' },
    dobrev: { id: 'dobrev', name: 'Milena Dobrev', role: 'Recht und Tarnung', short: 'Recht', color: '#8c7ad6', init: 'MD' },
    brennan: { id: 'brennan', name: 'Aled Brennan', role: 'Medien- und Stimmungsanalyse', short: 'Medien', color: '#4fa3c9', init: 'AB' },
    kuratorium: { id: 'kuratorium', name: 'Dr. h. c. Ingeborg Lindqvist', role: 'Vorsitzende des Kuratoriums', short: 'Kuratorium', color: '#c9a94f', init: 'IL' },
    halvorsen: { id: 'halvorsen', name: 'Ingrid Halvorsen', role: 'Treuhand · Halvorsen & Aasen', short: 'Treuhand', color: '#6fae8a', init: 'IH', house: 'Halvorsen & Aasen Treuhand' },
    castellan: { id: 'castellan', name: 'Teodoro Castellan', role: 'Treuhand · Castellan Fiduciaria', short: 'Treuhand', color: '#6fae8a', init: 'TC', house: 'Castellan Fiduciaria' },
    mensah: { id: 'mensah', name: 'Kofi Mensah', role: 'Treuhand · Mensah Kariuki Development Trust', short: 'Treuhand', color: '#6fae8a', init: 'KM', house: 'Mensah Kariuki Development Trust' },
    vidal: { id: 'vidal', name: 'Inés Vidal', role: 'Leitende Gesandte · Vermittlung', short: 'Gesandte', color: '#d69a4f', init: 'IV' },
    takeda: { id: 'takeda', name: 'Kenji Takeda', role: 'Leitender Gesandter · Handel', short: 'Gesandter', color: '#d69a4f', init: 'KT' },
    okonkwo: { id: 'okonkwo', name: 'Dr. Thandiwe Okonkwo', role: 'Leitende Gesandte · Krisenhilfe', short: 'Gesandte', color: '#d69a4f', init: 'TO' },
  };

  /* Tarnstrukturen */
  D.FRONT_KINDS = [
    { id: 'stiftung', n: 'Stiftung', suf: ['Stiftung', 'Stiftung für Gemeinwohl', 'Foundation', 'Stiftung für Entwicklung'], note: 'Unauffällig bei sozialen Vorhaben' },
    { id: 'holding', n: 'Holding', suf: ['Holding', 'Infrastruktur Holding', 'Capital Partners', 'Beteiligungs-AG'], note: 'Unauffällig bei Infrastruktur und Wirtschaft' },
    { id: 'fonds', n: 'Fonds', suf: ['Entwicklungsfonds', 'Impact Fund', 'Zukunftsfonds', 'Klimafonds'], note: 'Unauffällig bei Energie und Natur' },
    { id: 'kanzlei', n: 'Kanzlei', suf: ['& Partner', 'Rechtsanwälte', 'Advisory', 'Consulting'], note: 'Unauffällig bei Diplomatie und Anleihen' },
    { id: 'initiative', n: 'Initiative', suf: ['Initiative', 'Allianz', 'Netzwerk', 'Forum'], note: 'Unauffällig bei Kultur und Krisenhilfe' },
  ];
  D.FRONT_FIT = {
    stiftung: ['society', 'relief', 'science'], holding: ['infra', 'economy'], fonds: ['energy', 'nature', 'economy'],
    kanzlei: ['diplo', 'economy'], initiative: ['society', 'relief', 'diplo', 'nature'],
  };
  D.FRONT_ROOTS = ['Aurelia', 'Nordlicht', 'Meridian', 'Halcyon', 'Corvina', 'Solenne', 'Vesper', 'Lumen', 'Astrea', 'Calder', 'Orvieta', 'Silvaris', 'Brightwater', 'Kestrel', 'Ostara', 'Marlow', 'Tidewell', 'Valcourt', 'Arcadia', 'Polaris', 'Seraphin', 'Linden', 'Quillon', 'Esmeray', 'Northgate', 'Albion Vale', 'Cerulean', 'Fernhill', 'Elmstead', 'Rosmarin'];
  D.SEATS = ['Port Aurelio', 'Holmvik', 'Lirani-Inseln', 'Freihafen Calder', 'Sankt Esmeray', 'Velmora'];

  /* Öffentliches Gesicht (Kandidaten) */
  D.FACES = [
    { id: 'aster', name: 'Helena Aster', role: 'Philanthropin, ehemalige Intendantin', cred: 70, cost: 1.5, note: 'Elegant, beliebt beim Feuilleton' },
    { id: 'ndlovu', name: 'Jabari Ndlovu', role: 'Ehemaliger Entwicklungsökonom', cred: 78, cost: 2.1, note: 'Seriös, international respektiert' },
    { id: 'solberg', name: 'Liv Solberg', role: 'Unternehmerin, Gründerin einer Reederei', cred: 62, cost: 1.1, note: 'Nahbar, aber angreifbar' },
  ];
})();
