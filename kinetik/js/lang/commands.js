// Klartext · Befehlstabelle
// Eine einzige Quelle für Text-Syntax, Bausteine, Hilfe und Autovervollständigung.
// Muster: Wörter sind feste Schlüsselwörter, {name:typ} sind Lücken.
//   num  – Zahl-Ausdruck        str  – Text-Ausdruck        any – beliebiger Ausdruck
//   bool – Bedingung            color – Farbe (Ausdruck mit Farbmenü)
//   joint – Gelenkname          dir/hand/side/axis – feste Auswahl

export const CATEGORIES = [
  { id: 'ereignis', name: 'Ereignisse', color: '#F2B200', ink: '#2a1d00' },
  { id: 'bewegung', name: 'Bewegung', color: '#3B82F6', ink: '#fff' },
  { id: 'greifen', name: 'Greifen', color: '#F43F5E', ink: '#fff' },
  { id: 'mobil', name: 'Fahren & Gehen', color: '#10B981', ink: '#fff' },
  { id: 'sensor', name: 'Sensoren', color: '#06B6D4', ink: '#fff' },
  { id: 'licht', name: 'Licht & Ton', color: '#8B5CF6', ink: '#fff' },
  { id: 'welt', name: 'Welt', color: '#64748B', ink: '#fff' },
  { id: 'steuerung', name: 'Steuerung', color: '#FF8A00', ink: '#fff' },
  { id: 'rechnen', name: 'Rechnen', color: '#7CC520', ink: '#132100' },
  { id: 'variable', name: 'Variablen', color: '#D946EF', ink: '#fff' },
  { id: 'funktion', name: 'Funktionen', color: '#6366F1', ink: '#fff' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const ENUMS = {
  dir: ['links', 'rechts'],
  hand: ['links', 'rechts'],
  side: ['rechte', 'linke'],
  axis: ['x', 'y', 'z'],
};

export const COLORS = {
  rot: '#ef4444', orange: '#f97316', gelb: '#facc15', grün: '#22c55e', türkis: '#14b8a6',
  blau: '#3b82f6', lila: '#a855f7', pink: '#ec4899', weiß: '#f4f4f5', grau: '#9ca3af', schwarz: '#18181b',
};
export const COLOR_NAMES = Object.keys(COLORS);
export const CONSTANTS = { wahr: true, falsch: false, nichts: null, ja: true, nein: false };

export const KEYS = ['leertaste', 'oben', 'unten', 'links', 'rechts', 'enter', ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')];

// Alle Robotertypen
const ALL = ['arm', 'humanoid', 'rover'];
const ARMS = ['arm', 'humanoid'];

/*
 * Befehle (Anweisungen). robots: wer den Befehl kann. def: Vorgaben für die Palette.
 */
export const COMMANDS = [
  // ---- Ereignisse (Nachrichten senden) ----
  { id: 'sende_warte', cat: 'ereignis', p: 'sende {nachricht:str} und warte', robots: ALL, def: { nachricht: 'los' }, help: 'Schickt eine Nachricht an alle Roboter und wartet, bis alle fertig reagiert haben.' },
  { id: 'sende', cat: 'ereignis', p: 'sende {nachricht:str}', robots: ALL, def: { nachricht: 'los' }, help: 'Schickt eine Nachricht an alle Roboter. Wer „bei nachricht“ hat, reagiert.' },

  // ---- Bewegung ----
  { id: 'drehe_auf', cat: 'bewegung', p: 'drehe {gelenk:joint} auf {winkel:num}', robots: ARMS, def: { gelenk: { arm: 'basis', humanoid: 'schulter_r' }, winkel: 45 }, unit: { winkel: '°' }, help: 'Dreht ein Gelenk auf einen bestimmten Winkel (in Grad) und wartet, bis es angekommen ist.' },
  { id: 'drehe_um', cat: 'bewegung', p: 'drehe {gelenk:joint} um {winkel:num}', robots: ARMS, def: { gelenk: { arm: 'basis', humanoid: 'kopf' }, winkel: 30 }, unit: { winkel: '°' }, help: 'Dreht ein Gelenk um einen Winkel weiter.' },
  { id: 'bewege_greifer', cat: 'bewegung', p: 'bewege greifer zu {x:num}, {y:num}, {z:num}', robots: ['arm'], def: { x: 0, y: 20, z: 50 }, help: 'Fährt die Greifer-Spitze an einen Punkt (in cm, vom Roboter aus: x rechts, y hoch, z vor). Die Gelenkwinkel rechnet der Roboter selbst aus.' },
  { id: 'bewege_greifer_um', cat: 'bewegung', p: 'bewege greifer um {x:num}, {y:num}, {z:num}', robots: ['arm'], def: { x: 0, y: 10, z: 0 }, help: 'Verschiebt den Greifer um ein Stück (in cm).' },
  { id: 'bewege_hand', cat: 'bewegung', p: 'bewege {seite:side} hand zu {x:num}, {y:num}, {z:num}', robots: ['humanoid'], def: { seite: 'rechte', x: 20, y: 90, z: 35 }, help: 'Streckt eine Hand zu einem Punkt (in cm, vom Roboter aus). Der Roboter beugt sich dafür auch vor oder geht in die Knie.' },
  { id: 'tempo', cat: 'bewegung', p: 'tempo {prozent:num}', robots: ALL, def: { prozent: 50 }, unit: { prozent: '%' }, help: 'Legt fest, wie schnell sich der Roboter bewegt (1 bis 100 %).' },
  { id: 'grundstellung', cat: 'bewegung', p: 'grundstellung', robots: ARMS, help: 'Bringt alle Gelenke in die Ausgangsstellung.' },
  { id: 'winke', cat: 'bewegung', p: 'winke', robots: ['humanoid'], help: 'Der Roboter winkt mit der rechten Hand.' },
  { id: 'verbeuge', cat: 'bewegung', p: 'verbeuge dich', robots: ['humanoid'], help: 'Eine höfliche Verbeugung.' },
  { id: 'tanze', cat: 'bewegung', p: 'tanze', robots: ['humanoid'], help: 'Ein kleiner Tanz – das Gleichgewichtsmodul hat gut zu tun.' },
  { id: 'hocke', cat: 'bewegung', p: 'hocke dich hin', robots: ['humanoid'], help: 'Geht in die Knie.' },
  { id: 'steh_auf', cat: 'bewegung', p: 'steh auf', robots: ['humanoid'], help: 'Richtet sich wieder auf – auch nach einem Sturz.' },
  { id: 'schaue_zu', cat: 'bewegung', p: 'schaue zu {farbe:color}', robots: ['humanoid'], def: { farbe: 'rot' }, help: 'Dreht den Kopf zum nächsten Gegenstand dieser Farbe (braucht eine Kamera).' },

  // ---- Greifen ----
  { id: 'greife_mit', cat: 'greifen', p: 'greife mit {hand:hand}', robots: ['humanoid'], def: { hand: 'rechts' }, help: 'Schließt die linke oder rechte Hand.' },
  { id: 'greife', cat: 'greifen', p: 'greife', robots: ALL, help: 'Schließt den Greifer (bzw. schaltet Saugnapf oder Magnet ein). Liegt etwas dazwischen, hält der Roboter es fest.' },
  { id: 'lass_los', cat: 'greifen', p: 'lass los', robots: ALL, help: 'Öffnet den Greifer und lässt los.' },
  { id: 'nimm', cat: 'greifen', p: 'nimm {farbe:color}', robots: ALL, def: { farbe: 'rot' }, help: 'Sucht mit der Kamera den nächsten Gegenstand dieser Farbe, fährt hin und greift ihn.' },
  { id: 'lege_auf', cat: 'greifen', p: 'lege ab auf {farbe:color}', robots: ALL, def: { farbe: 'grün' }, help: 'Legt den gehaltenen Gegenstand auf eine Zone oder einen anderen Gegenstand dieser Farbe.' },
  { id: 'lege_bei', cat: 'greifen', p: 'lege ab bei {x:num}, {y:num}, {z:num}', robots: ['arm'], def: { x: 30, y: 0, z: 40 }, help: 'Legt den Gegenstand an einem Punkt ab (in cm, vom Roboter aus).' },
  { id: 'lege', cat: 'greifen', p: 'lege ab', robots: ALL, help: 'Setzt den Gegenstand direkt unter bzw. vor sich ab.' },
  { id: 'wirf', cat: 'greifen', p: 'wirf', robots: ['humanoid', 'arm'], help: 'Holt Schwung und wirft den gehaltenen Gegenstand.' },
  { id: 'greifkraft', cat: 'greifen', p: 'greifkraft {prozent:num}', robots: ALL, def: { prozent: 80 }, unit: { prozent: '%' }, help: 'Wie fest der Greifer zudrückt (1 bis 100 %). Zu wenig Kraft – und schwere Dinge rutschen heraus.' },

  // ---- Fahren & Gehen ----
  { id: 'fahre_vor', cat: 'mobil', p: 'fahre {strecke:num} vor', robots: ['rover'], def: { strecke: 50 }, unit: { strecke: 'cm' }, help: 'Fährt eine Strecke geradeaus (Standard: cm).' },
  { id: 'fahre_zurueck', cat: 'mobil', p: 'fahre {strecke:num} zurück', robots: ['rover'], def: { strecke: 20 }, unit: { strecke: 'cm' }, help: 'Fährt eine Strecke rückwärts.' },
  { id: 'fahre_zu', cat: 'mobil', p: 'fahre zu {x:num}, {z:num}', robots: ['rover'], def: { x: 100, z: 100 }, help: 'Fährt zu einem Punkt auf dem Boden (Weltkoordinaten in cm).' },
  { id: 'fahre_los', cat: 'mobil', p: 'fahre los', robots: ['rover'], help: 'Fährt los und hört erst bei „stopp“ auf.' },
  { id: 'fahre_tempo', cat: 'mobil', p: 'fahre mit tempo {prozent:num}', robots: ['rover'], def: { prozent: 50 }, unit: { prozent: '%' }, help: 'Fährt dauerhaft mit diesem Tempo (negativ = rückwärts).' },
  { id: 'motoren', cat: 'mobil', p: 'setze motoren auf {links:num}, {rechts:num}', robots: ['rover'], def: { links: 50, rechts: 30 }, help: 'Steuert linkes und rechtes Rad einzeln (−100 bis 100). Unterschiedliche Werte ergeben eine Kurve.' },
  { id: 'gehe_vor', cat: 'mobil', p: 'gehe {strecke:num} vor', robots: ['humanoid'], def: { strecke: 50 }, unit: { strecke: 'cm' }, help: 'Geht eine Strecke vorwärts (Standard: cm).' },
  { id: 'gehe_zurueck', cat: 'mobil', p: 'gehe {strecke:num} zurück', robots: ['humanoid'], def: { strecke: 30 }, unit: { strecke: 'cm' }, help: 'Geht rückwärts.' },
  { id: 'gehe_zu', cat: 'mobil', p: 'gehe zu {x:num}, {z:num}', robots: ['humanoid'], def: { x: 100, z: 100 }, help: 'Geht zu einem Punkt auf dem Boden (Weltkoordinaten in cm).' },
  { id: 'gehe_los', cat: 'mobil', p: 'gehe los', robots: ['humanoid'], help: 'Geht los und hört erst bei „stopp“ auf.' },
  { id: 'drehe_dich', cat: 'mobil', p: 'drehe dich um {winkel:num} nach {richtung:dir}', robots: ['humanoid', 'rover'], def: { winkel: 90, richtung: 'links' }, unit: { winkel: '°' }, help: 'Dreht den ganzen Roboter auf der Stelle.' },
  { id: 'folge_pfad', cat: 'mobil', p: 'folge dem pfad', robots: ['humanoid', 'rover'], help: 'Folgt dem Pfad, den du mit dem Apple Pencil (oder dem Pfad-Werkzeug) auf den Boden gezeichnet hast.' },
  { id: 'stopp', cat: 'mobil', p: 'stopp', robots: ALL, help: 'Hält alle Bewegungen sofort an.' },

  // ---- Licht & Ton ----
  { id: 'sage', cat: 'licht', p: 'sage {text:any}', robots: ALL, def: { text: 'Hallo!' }, help: 'Zeigt eine Sprechblase und schreibt in die Konsole.' },
  { id: 'leuchte_aus', cat: 'licht', p: 'leuchte aus', robots: ALL, help: 'Schaltet die Leuchten des Roboters aus.' },
  { id: 'leuchte', cat: 'licht', p: 'leuchte {farbe:color}', robots: ALL, def: { farbe: 'grün' }, help: 'Lässt Augen bzw. Statusring in einer Farbe leuchten.' },
  { id: 'piepe', cat: 'licht', p: 'piepe', robots: ALL, help: 'Ein kurzer Piepton.' },
  { id: 'spiele_ton', cat: 'licht', p: 'spiele ton {hoehe:num}', robots: ALL, def: { hoehe: 440 }, help: 'Spielt einen Ton mit dieser Frequenz in Hertz (z. B. 440).' },

  // ---- Welt ----
  { id: 'band_an', cat: 'welt', p: 'band an', robots: ALL, help: 'Schaltet das Förderband ein.' },
  { id: 'band_aus', cat: 'welt', p: 'band aus', robots: ALL, help: 'Schaltet das Förderband aus.' },
  { id: 'band_tempo', cat: 'welt', p: 'band tempo {prozent:num}', robots: ALL, def: { prozent: 50 }, unit: { prozent: '%' }, help: 'Stellt die Geschwindigkeit des Förderbands ein (negativ = andersherum).' },
  { id: 'lampe_aus', cat: 'welt', p: 'lampe aus', robots: ALL, help: 'Schaltet die Lampe aus.' },
  { id: 'lampe', cat: 'welt', p: 'lampe {farbe:color}', robots: ALL, def: { farbe: 'grün' }, help: 'Schaltet die Lampe in einer Farbe ein.' },
  { id: 'spende', cat: 'welt', p: 'spende würfel', robots: ALL, help: 'Der Würfelspender gibt einen neuen Würfel aus.' },

  // ---- Steuerung (einfache Anweisungen) ----
  { id: 'warte_bis', cat: 'steuerung', p: 'warte bis {bedingung:bool}', robots: ALL, def: { bedingung: null }, help: 'Wartet, bis die Bedingung erfüllt ist.' },
  { id: 'warte', cat: 'steuerung', p: 'warte {zeit:num}', robots: ALL, def: { zeit: 1 }, unit: { zeit: 's' }, help: 'Wartet eine Zeit lang (Standard: Sekunden, auch „500 ms“).' },
  { id: 'stoppe_alles', cat: 'steuerung', p: 'stoppe alles', robots: ALL, help: 'Beendet das ganze Programm.' },
  { id: 'beende', cat: 'steuerung', p: 'beende ablauf', robots: ALL, help: 'Beendet nur diesen Ablauf, andere laufen weiter.' },

  // ---- Variablen / Listen ----
  { id: 'liste_add', cat: 'variable', p: 'füge {wert:any} zu {liste:var} hinzu', robots: ALL, def: { wert: 1, liste: 'liste' }, help: 'Hängt einen Wert hinten an eine Liste an.' },
  { id: 'liste_del', cat: 'variable', p: 'entferne nummer {index:num} aus {liste:var}', robots: ALL, def: { index: 1, liste: 'liste' }, help: 'Entfernt ein Element (gezählt ab 1).' },
];

/*
 * Melder (Werte, die man in Ausdrücken benutzt). type: num | bool | str
 */
export const REPORTERS = [
  { id: 'r_abstand', cat: 'sensor', p: 'abstand', type: 'num', robots: ALL, help: 'Abstand bis zum nächsten Hindernis vor dem Abstandssensor, in cm (bis 200).' },
  { id: 'r_farbe', cat: 'sensor', p: 'farbe', type: 'str', robots: ALL, help: 'Die Farbe, die der Farbsensor gerade sieht, z. B. „rot“ – oder „keine“.' },
  { id: 'r_helligkeit', cat: 'sensor', p: 'helligkeit', type: 'num', robots: ALL, help: 'Wie hell der Boden unter dem Liniensensor ist (0 = schwarz, 100 = weiß).' },
  { id: 'r_linie', cat: 'sensor', p: 'linie {seite:dir}', type: 'bool', robots: ['rover'], def: { seite: 'links' }, help: 'Wahr, wenn der linke bzw. rechte Liniensensor eine dunkle Linie sieht.' },
  { id: 'r_beruehrt', cat: 'sensor', p: 'berührt', type: 'bool', robots: ALL, help: 'Wahr, wenn der Berührungssensor (Stoßstange oder Greifer) etwas berührt.' },
  { id: 'r_haelt', cat: 'sensor', p: 'hält etwas', type: 'bool', robots: ALL, help: 'Wahr, wenn der Roboter gerade etwas festhält.' },
  { id: 'r_kraft', cat: 'sensor', p: 'kraft im greifer', type: 'num', robots: ALL, help: 'Mit wie viel Kraft (Newton) der Greifer gerade zudrückt.' },
  { id: 'r_gewicht', cat: 'sensor', p: 'gewicht', type: 'num', robots: ALL, help: 'Masse des gehaltenen Gegenstands in Gramm (0, wenn nichts gehalten wird).' },
  { id: 'r_neigung', cat: 'sensor', p: 'neigung', type: 'num', robots: ALL, help: 'Wie schief der Roboter steht, in Grad.' },
  { id: 'r_kompass', cat: 'sensor', p: 'kompass', type: 'num', robots: ALL, help: 'Blickrichtung in Grad (0 bis 360).' },
  { id: 'r_position', cat: 'sensor', p: 'position {achse:axis}', type: 'num', robots: ALL, def: { achse: 'x' }, help: 'Wo der Roboter in der Welt steht (cm).' },
  { id: 'r_winkel', cat: 'sensor', p: 'winkel von {gelenk:joint}', type: 'num', robots: ARMS, def: { gelenk: { arm: 'basis', humanoid: 'kopf' } }, help: 'Der aktuelle Winkel eines Gelenks in Grad.' },
  { id: 'r_sieht', cat: 'sensor', p: 'sieht {farbe:color}', type: 'bool', robots: ALL, def: { farbe: 'rot' }, help: 'Wahr, wenn die Kamera einen Gegenstand dieser Farbe sieht.' },
  { id: 'r_richtung_zu', cat: 'sensor', p: 'richtung zu {farbe:color}', type: 'num', robots: ALL, def: { farbe: 'rot' }, help: 'In welcher Richtung (Grad, + = rechts) die Kamera den Gegenstand sieht.' },
  { id: 'r_entfernung_zu', cat: 'sensor', p: 'entfernung zu {farbe:color}', type: 'num', robots: ALL, def: { farbe: 'rot' }, help: 'Wie weit der nächste Gegenstand dieser Farbe entfernt ist (cm).' },
  { id: 'r_umgefallen', cat: 'sensor', p: 'umgefallen', type: 'bool', robots: ['humanoid'], help: 'Wahr, wenn der Roboter das Gleichgewicht verloren hat.' },
  { id: 'r_akku', cat: 'sensor', p: 'akku', type: 'num', robots: ALL, help: 'Ladestand des Akkus in Prozent.' },
  { id: 'r_zeit', cat: 'sensor', p: 'zeit', type: 'num', robots: ALL, help: 'Sekunden seit dem Start.' },
  { id: 'r_taste', cat: 'sensor', p: 'taste {taste:str} gedrückt', type: 'bool', robots: ALL, def: { taste: 'leertaste' }, help: 'Wahr, solange die Taste gedrückt ist.' },
  { id: 'r_schranke', cat: 'welt', p: 'lichtschranke unterbrochen', type: 'bool', robots: ALL, help: 'Wahr, wenn etwas den Lichtstrahl der Lichtschranke unterbricht.' },
  { id: 'r_taster', cat: 'welt', p: 'taster gedrückt', type: 'bool', robots: ALL, help: 'Wahr, solange jemand den Taster drückt.' },
  { id: 'r_zufall', cat: 'rechnen', p: 'zufallszahl von {von:num} bis {bis:num}', type: 'num', robots: ALL, def: { von: 1, bis: 6 }, help: 'Eine ganze Zufallszahl im Bereich.' },
];

/*
 * Eingebaute Funktionen in Aufruf-Schreibweise: runde(x)
 */
export const BUILTINS = {
  runde: { n: 1, label: 'runde {a}', help: 'Rundet auf eine ganze Zahl.' },
  abs: { n: 1, label: 'betrag von {a}', help: 'Der Betrag (ohne Minus).' },
  wurzel: { n: 1, label: 'wurzel aus {a}', help: 'Die Quadratwurzel.' },
  sin: { n: 1, label: 'sin {a}', help: 'Sinus (Winkel in Grad).' },
  cos: { n: 1, label: 'cos {a}', help: 'Kosinus (Winkel in Grad).' },
  min: { n: 2, label: 'kleinere von {a} und {b}', help: 'Die kleinere Zahl.' },
  max: { n: 2, label: 'größere von {a} und {b}', help: 'Die größere Zahl.' },
  zufall: { n: 2, label: 'zufall {a} bis {b}', help: 'Ganze Zufallszahl von a bis b.' },
  länge: { n: 1, label: 'länge von {a}', help: 'Anzahl der Elemente einer Liste oder Zeichen eines Textes.' },
  text: { n: 1, label: 'als text {a}', help: 'Macht aus einem Wert einen Text.' },
  zahl: { n: 1, label: 'als zahl {a}', help: 'Macht aus einem Text eine Zahl.' },
};

/* ---------- Muster vorbereiten ---------- */

function compile(def, kind) {
  const parts = [];
  const re = /\{(\w+):(\w+)\}|([^\s{},]+)|(,)/gu;
  let m;
  while ((m = re.exec(def.p))) {
    if (m[1]) parts.push({ slot: m[1], type: m[2] });
    else if (m[3]) parts.push({ word: m[3].toLowerCase() });
    else parts.push({ punct: ',' });
  }
  return { ...def, kind, parts, head: parts[0].word, slots: parts.filter((x) => x.slot) };
}
export const CMD = COMMANDS.map((c) => compile(c, 'cmd'));
export const REP = REPORTERS.map((r) => compile(r, 'rep'));
export const CMD_BY_ID = Object.fromEntries(CMD.map((c) => [c.id, c]));
export const REP_BY_ID = Object.fromEntries(REP.map((r) => [r.id, r]));

// Nach Kopfwort gruppiert; längere (spezifischere) Muster zuerst
function byHead(list) {
  const map = new Map();
  for (const c of list) {
    if (!map.has(c.head)) map.set(c.head, []);
    map.get(c.head).push(c);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => b.parts.filter((p) => p.word).length - a.parts.filter((p) => p.word).length || b.parts.length - a.parts.length);
  }
  return map;
}
export const CMD_HEADS = byHead(CMD);
export const REP_HEADS = byHead(REP);

// Schlüsselwörter der Steuerstrukturen
export const KEYWORDS = new Set([
  'beim', 'bei', 'sobald', 'wenn', 'dann', 'sonst', 'solange', 'wiederhole', 'mal', 'immer', 'bis', 'ende',
  'funktion', 'gib', 'zurück', 'setze', 'auf', 'ändere', 'um', 'für', 'von', 'jedes', 'in', 'schritt', 'gleichzeitig',
  'und', 'oder', 'nicht', 'ablage',
]);

export const UNITS = {
  s: { dim: 'zeit', f: 1 }, sek: { dim: 'zeit', f: 1 }, sekunde: { dim: 'zeit', f: 1 }, sekunden: { dim: 'zeit', f: 1 },
  ms: { dim: 'zeit', f: 0.001 }, min: { dim: 'zeit', f: 60 }, minuten: { dim: 'zeit', f: 60 }, minute: { dim: 'zeit', f: 60 },
  cm: { dim: 'länge', f: 1 }, mm: { dim: 'länge', f: 0.1 }, m: { dim: 'länge', f: 100 }, meter: { dim: 'länge', f: 100 },
  grad: { dim: 'winkel', f: 1 }, '°': { dim: 'winkel', f: 1 },
  '%': { dim: 'prozent', f: 1 }, prozent: { dim: 'prozent', f: 1 },
  schritte: { dim: 'länge', f: 18 },
};

// Alle Wörter für die Autovervollständigung
export function vocabulary() {
  const set = new Set(KEYWORDS);
  for (const c of [...CMD, ...REP]) for (const p of c.parts) if (p.word) set.add(p.word);
  for (const k of Object.keys(BUILTINS)) set.add(k);
  for (const k of COLOR_NAMES) set.add(k);
  return [...set];
}

export function defaultFor(def, slot, robotType) {
  const d = def.def && def.def[slot];
  if (d && typeof d === 'object') return d[robotType] ?? Object.values(d)[0];
  return d;
}
