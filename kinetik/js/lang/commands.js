// Klartext · Befehlstabelle
// Eine einzige Quelle für Text-Syntax, Bausteine, Hilfe und Autovervollständigung.
// Muster: Wörter sind feste Schlüsselwörter, {name:typ} sind Lücken.
//   num  – Zahl-Ausdruck        str  – Text-Ausdruck        any – beliebiger Ausdruck
//   bool – Bedingung            color – Farbe (Ausdruck mit Farbmenü)
//   joint – Gelenkname          dir/hand/side/axis – feste Auswahl

export const CATEGORIES = [
  { id: 'ereignis', name: 'Trigger', color: '#c9a227', ink: '#fff' },
  { id: 'bewegung', name: 'Achsen', color: '#4a86d8', ink: '#fff' },
  { id: 'greifen', name: 'Werkzeug', color: '#d0643a', ink: '#fff' },
  { id: 'mobil', name: 'Fahren · Gehen', color: '#36a074', ink: '#fff' },
  { id: 'sensor', name: 'Sensorik', color: '#2aa3b8', ink: '#fff' },
  { id: 'scan', name: 'LiDAR · Radar', color: '#5f78d6', ink: '#fff' },
  { id: 'licht', name: 'Signal · Funk', color: '#9b72cf', ink: '#fff' },
  { id: 'welt', name: 'Anlage', color: '#6b7787', ink: '#fff' },
  { id: 'steuerung', name: 'Ablauf', color: '#c27c2c', ink: '#fff' },
  { id: 'rechnen', name: 'Logik', color: '#5f9a3e', ink: '#fff' },
  { id: 'variable', name: 'Variablen', color: '#b45f9e', ink: '#fff' },
  { id: 'funktion', name: 'Funktionen', color: '#6a6fd6', ink: '#fff' },
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

// Welche Hardware ein Befehl braucht (für Prüfung, Palette und Meldungen)
export const NEED_TEXT = {
  abstand: 'ein Abstandssensor (Ultraschall oder ToF)', farbe: 'ein Farbsensor', kamera: 'eine Kamera (RGB oder RGB-D)', beruehrung: 'eine Kontaktleiste',
  linie: 'ein Spurführungssensor', lidar: 'ein LiDAR (2D, 3D oder Sicherheitsscanner)', radar: 'ein Radar', waerme: 'eine Wärmebildkamera', rfid: 'ein RFID-Lesekopf',
  barcode: 'ein Code-Scanner', kraft: 'ein Kraft-Momenten-Sensor', signalsaeule: 'eine Signalsäule', scheinwerfer: 'ein LED-Scheinwerfer', hupe: 'eine Signalhupe',
  schutzfeld: 'ein Sicherheitslaserscanner', funk: 'ein Funkmodul', greifer: 'ein Greifwerkzeug', lackier: 'eine Lackierpistole',
};

// Alle Robotertypen
const ALL = ['arm', 'humanoid', 'rover'];
const ARMS = ['arm', 'humanoid'];

/*
 * Befehle (Anweisungen). robots: wer den Befehl kann. def: Vorgaben für die Palette.
 */
export const COMMANDS = [
  // ---- Ereignisse (Nachrichten senden) ----
  { id: 'sende_warte', cat: 'ereignis', p: 'sende {nachricht:str} und warte', robots: ALL, def: { nachricht: 'los' }, help: 'Sendet eine Nachricht per Funk und wartet, bis alle Empfänger ihren Ablauf beendet haben.' },
  { id: 'sende', cat: 'ereignis', p: 'sende {nachricht:str}', robots: ALL, def: { nachricht: 'los' }, help: 'Sendet eine Nachricht per Funk an alle erreichbaren Geräte. Abläufe mit „bei nachricht“ starten.' },

  // ---- Bewegung ----
  { id: 'drehe_auf', cat: 'bewegung', p: 'drehe {gelenk:joint} auf {winkel:num}', robots: ARMS, def: { gelenk: { arm: 'basis', humanoid: 'schulter_r' }, winkel: 45 }, unit: { winkel: '°' }, help: 'Fährt eine Achse auf einen absoluten Winkel (Grad) und wartet auf die Sollposition.' },
  { id: 'drehe_um', cat: 'bewegung', p: 'drehe {gelenk:joint} um {winkel:num}', robots: ARMS, def: { gelenk: { arm: 'basis', humanoid: 'kopf' }, winkel: 30 }, unit: { winkel: '°' }, help: 'Fährt eine Achse relativ um einen Winkel.' },
  { id: 'bewege_greifer', cat: 'bewegung', p: 'bewege greifer zu {x:num}, {y:num}, {z:num}', robots: ['arm'], def: { x: 0, y: 20, z: 50 }, help: 'Linearbewegung des Werkzeugmittelpunkts (TCP) zu einem Punkt in cm (Roboterkoordinaten: x rechts, y hoch, z vor). Die Achswinkel berechnet die inverse Kinematik.' },
  { id: 'bewege_greifer_um', cat: 'bewegung', p: 'bewege greifer um {x:num}, {y:num}, {z:num}', robots: ['arm'], def: { x: 0, y: 10, z: 0 }, help: 'Relative Linearbewegung des TCP in cm.' },
  { id: 'bewege_hand', cat: 'bewegung', p: 'bewege {seite:side} hand zu {x:num}, {y:num}, {z:num}', robots: ['humanoid'], def: { seite: 'rechte', x: 20, y: 90, z: 35 }, help: 'Bewegt eine Hand zu einem Punkt in cm (Roboterkoordinaten). Rumpf und Knie werden bei Bedarf mitgenommen.' },
  { id: 'tempo', cat: 'bewegung', p: 'tempo {prozent:num}', robots: ALL, def: { prozent: 50 }, unit: { prozent: '%' }, help: 'Override der Verfahrgeschwindigkeit (1 bis 100 %).' },
  { id: 'grundstellung', cat: 'bewegung', p: 'grundstellung', robots: ARMS, help: 'Fährt alle Achsen in die Grundstellung.' },
  { id: 'winke', cat: 'bewegung', p: 'winke', robots: ['humanoid'], help: 'Handzeichen mit der rechten Hand (Quittierung).' },
  { id: 'verbeuge', cat: 'bewegung', hidden: true, p: 'verbeuge dich', robots: ['humanoid'], help: 'Vorbeugen des Oberkörpers und zurück.' },
  { id: 'tanze', cat: 'bewegung', hidden: true, p: 'tanze', robots: ['humanoid'], help: 'Bewegungstest für Balance und Antriebe.' },
  { id: 'hocke', cat: 'bewegung', p: 'hocke dich hin', robots: ['humanoid'], help: 'Geht in die Hocke.' },
  { id: 'steh_auf', cat: 'bewegung', p: 'steh auf', robots: ['humanoid'], help: 'Richtet sich auf – auch nach einem Sturz.' },
  { id: 'schaue_zu', cat: 'bewegung', p: 'schaue zu {farbe:color}', robots: ['humanoid'], needs: 'kamera', def: { farbe: 'rot' }, help: 'Richtet den Kopf auf das nächste Objekt dieser Farbe aus.' },

  // ---- Greifen ----
  { id: 'greife_mit', cat: 'greifen', p: 'greife mit {hand:hand}', robots: ['humanoid'], needs: 'greifer', def: { hand: 'rechts' }, help: 'Schließt die linke oder rechte Hand.' },
  { id: 'greife', cat: 'greifen', p: 'greife', robots: ALL, needs: 'greifer', help: 'Schließt den Greifer bzw. schaltet Vakuum oder Magnet ein.' },
  { id: 'lass_los', cat: 'greifen', p: 'lass los', robots: ALL, needs: 'greifer', help: 'Öffnet den Greifer bzw. schaltet Vakuum oder Magnet ab.' },
  { id: 'nimm', cat: 'greifen', p: 'nimm {farbe:color}', robots: ALL, needs: ['kamera', 'greifer'], def: { farbe: 'rot' }, help: 'Erkennt das nächste Objekt dieser Farbe per Kamera, fährt es an und greift es.' },
  { id: 'lege_auf', cat: 'greifen', p: 'lege ab auf {farbe:color}', robots: ALL, needs: ['kamera', 'greifer'], def: { farbe: 'grün' }, help: 'Legt das gegriffene Objekt auf einer Ablage, einem Behälter oder einem Objekt dieser Farbe ab.' },
  { id: 'lege_bei', cat: 'greifen', p: 'lege ab bei {x:num}, {y:num}, {z:num}', robots: ['arm'], needs: 'greifer', def: { x: 30, y: 0, z: 40 }, help: 'Legt das Objekt an einem Punkt ab (cm, Roboterkoordinaten).' },
  { id: 'lege', cat: 'greifen', p: 'lege ab', robots: ALL, needs: 'greifer', help: 'Setzt das Objekt an der aktuellen Position ab.' },
  { id: 'wirf', cat: 'greifen', p: 'wirf', robots: ['humanoid', 'arm'], needs: 'greifer', help: 'Wirft das gegriffene Objekt.' },
  { id: 'nimm_waermstes', cat: 'greifen', p: 'nimm wärmstes teil', robots: ALL, needs: ['waerme', 'greifer'], help: 'Greift das wärmste Werkstück im Bild der Wärmebildkamera.' },
  { id: 'lackiere', cat: 'greifen', p: 'lackiere {farbe:color}', robots: ['arm'], needs: 'lackier', def: { farbe: 'blau' }, help: 'Beschichtet das Werkstück unter der Lackierpistole (bis 30 cm Abstand) in dieser Farbe.' },
  { id: 'greifkraft', cat: 'greifen', p: 'greifkraft {prozent:num}', robots: ALL, needs: 'greifer', def: { prozent: 80 }, unit: { prozent: '%' }, help: 'Greifkraft in Prozent der Nennkraft. Zu wenig Kraft: schwere Teile rutschen.' },

  // ---- Fahren & Gehen ----
  { id: 'fahre_vor', cat: 'mobil', p: 'fahre {strecke:num} vor', robots: ['rover'], def: { strecke: 50 }, unit: { strecke: 'cm' }, help: 'Fährt eine Strecke geradeaus (Standard: cm).' },
  { id: 'fahre_zurueck', cat: 'mobil', p: 'fahre {strecke:num} zurück', robots: ['rover'], def: { strecke: 20 }, unit: { strecke: 'cm' }, help: 'Fährt eine Strecke rückwärts.' },
  { id: 'fahre_zu', cat: 'mobil', p: 'fahre zu {x:num}, {z:num}', robots: ['rover'], def: { x: 100, z: 100 }, help: 'Fährt zu einem Punkt auf dem Boden (Weltkoordinaten in cm).' },
  { id: 'navigiere', cat: 'mobil', p: 'navigiere zu {x:num}, {z:num}', robots: ['rover'], needs: 'lidar', def: { x: 0, z: 200 }, help: 'Fährt zu einem Punkt (Weltkoordinaten in cm) und umfährt dabei Hindernisse, die der LiDAR erkennt.' },
  { id: 'fahre_los', cat: 'mobil', p: 'fahre los', robots: ['rover'], help: 'Fährt dauerhaft geradeaus bis „stopp“.' },
  { id: 'fahre_tempo', cat: 'mobil', p: 'fahre mit tempo {prozent:num}', robots: ['rover'], def: { prozent: 50 }, unit: { prozent: '%' }, help: 'Fährt dauerhaft mit diesem Tempo (negativ = rückwärts).' },
  { id: 'motoren', cat: 'mobil', p: 'setze motoren auf {links:num}, {rechts:num}', robots: ['rover'], def: { links: 50, rechts: 30 }, help: 'Stellt linkes und rechtes Rad einzeln (−100 bis 100 %).' },
  { id: 'gehe_vor', cat: 'mobil', p: 'gehe {strecke:num} vor', robots: ['humanoid'], def: { strecke: 50 }, unit: { strecke: 'cm' }, help: 'Geht eine Strecke vorwärts (Standard: cm).' },
  { id: 'gehe_zurueck', cat: 'mobil', p: 'gehe {strecke:num} zurück', robots: ['humanoid'], def: { strecke: 30 }, unit: { strecke: 'cm' }, help: 'Geht rückwärts.' },
  { id: 'gehe_zu', cat: 'mobil', p: 'gehe zu {x:num}, {z:num}', robots: ['humanoid'], def: { x: 100, z: 100 }, help: 'Geht zu einem Punkt auf dem Boden (Weltkoordinaten in cm).' },
  { id: 'gehe_los', cat: 'mobil', p: 'gehe los', robots: ['humanoid'], help: 'Geht dauerhaft geradeaus bis „stopp“.' },
  { id: 'drehe_dich', cat: 'mobil', p: 'drehe dich um {winkel:num} nach {richtung:dir}', robots: ['humanoid', 'rover'], def: { winkel: 90, richtung: 'links' }, unit: { winkel: '°' }, help: 'Dreht den Roboter auf der Stelle.' },
  { id: 'folge_pfad', cat: 'mobil', p: 'folge dem pfad', robots: ['humanoid', 'rover'], help: 'Fährt den mit dem Pfadwerkzeug (Apple Pencil) gezeichneten Pfad ab.' },
  { id: 'stopp', cat: 'mobil', p: 'stopp', robots: ALL, help: 'Hält alle Bewegungen sofort an.' },

  // ---- Licht & Ton ----
  { id: 'sage', cat: 'licht', p: 'sage {text:any}', robots: ALL, def: { text: 'Hallo!' }, help: 'Gibt eine Statusmeldung im Protokoll und am Roboter aus.' },
  { id: 'leuchte_aus', cat: 'licht', p: 'leuchte aus', robots: ALL, help: 'Setzt die Statusanzeige zurück.' },
  { id: 'leuchte', cat: 'licht', p: 'leuchte {farbe:color}', robots: ALL, def: { farbe: 'grün' }, help: 'Statusanzeige (LED-Band) in einer Farbe.' },
  { id: 'signalsaeule', cat: 'licht', p: 'signalsäule {farbe:color}', robots: ALL, needs: 'signalsaeule', def: { farbe: 'grün' }, help: 'Schaltet ein Segment der Signalsäule ein (rot, gelb, grün oder blau).' },
  { id: 'signalsaeule_aus', cat: 'licht', p: 'signalsäule aus', robots: ALL, needs: 'signalsaeule', help: 'Schaltet die Signalsäule aus.' },
  { id: 'scheinwerfer_an', cat: 'licht', p: 'scheinwerfer an', robots: ALL, needs: 'scheinwerfer', help: 'Schaltet den LED-Scheinwerfer ein.' },
  { id: 'scheinwerfer_aus', cat: 'licht', p: 'scheinwerfer aus', robots: ALL, needs: 'scheinwerfer', help: 'Schaltet den LED-Scheinwerfer aus.' },
  { id: 'hupe', cat: 'licht', p: 'hupe', robots: ALL, needs: 'hupe', help: 'Kurzes Warnsignal der Signalhupe.' },
  { id: 'piepe', cat: 'licht', p: 'piepe', robots: ALL, help: 'Kurzer Signalton.' },
  { id: 'spiele_ton', cat: 'licht', p: 'spiele ton {hoehe:num}', robots: ALL, def: { hoehe: 440 }, help: 'Ton mit dieser Frequenz in Hz.' },

  // ---- Welt ----
  { id: 'band_an', cat: 'welt', p: 'band an', robots: ALL, help: 'Schaltet das Förderband ein.' },
  { id: 'band_aus', cat: 'welt', p: 'band aus', robots: ALL, help: 'Schaltet das Förderband aus.' },
  { id: 'band_tempo', cat: 'welt', p: 'band tempo {prozent:num}', robots: ALL, def: { prozent: 50 }, unit: { prozent: '%' }, help: 'Stellt die Geschwindigkeit des Förderbands ein (negativ = andersherum).' },
  { id: 'lampe_aus', cat: 'welt', p: 'lampe aus', robots: ALL, help: 'Schaltet die Signalleuchte der Anlage aus.' },
  { id: 'lampe', cat: 'welt', p: 'lampe {farbe:color}', robots: ALL, def: { farbe: 'grün' }, help: 'Schaltet die Signalleuchte der Anlage in einer Farbe ein.' },
  { id: 'spende', cat: 'welt', p: 'spende würfel', robots: ALL, help: 'Die Teilezuführung gibt ein Werkstück aus.' },

  // ---- Steuerung (einfache Anweisungen) ----
  { id: 'warte_bis', cat: 'steuerung', p: 'warte bis {bedingung:bool}', robots: ALL, def: { bedingung: null }, help: 'Wartet, bis die Bedingung erfüllt ist.' },
  { id: 'warte', cat: 'steuerung', p: 'warte {zeit:num}', robots: ALL, def: { zeit: 1 }, unit: { zeit: 's' }, help: 'Wartet eine Zeit lang (Standard: Sekunden, auch „500 ms“).' },
  { id: 'stoppe_alles', cat: 'steuerung', p: 'stoppe alles', robots: ALL, help: 'Beendet alle Abläufe.' },
  { id: 'beende', cat: 'steuerung', p: 'beende ablauf', robots: ALL, help: 'Beendet nur diesen Ablauf.' },

  // ---- Variablen / Listen ----
  { id: 'liste_add', cat: 'variable', p: 'füge {wert:any} zu {liste:var} hinzu', robots: ALL, def: { wert: 1, liste: 'liste' }, help: 'Hängt einen Wert hinten an eine Liste an.' },
  { id: 'liste_del', cat: 'variable', p: 'entferne nummer {index:num} aus {liste:var}', robots: ALL, def: { index: 1, liste: 'liste' }, help: 'Entfernt ein Element (gezählt ab 1).' },
];

/*
 * Melder (Werte, die man in Ausdrücken benutzt). type: num | bool | str
 */
export const REPORTERS = [
  { id: 'r_abstand', cat: 'sensor', p: 'abstand', type: 'num', robots: ALL, needs: 'abstand', help: 'Messwert des Abstandssensors in cm.' },
  { id: 'r_farbe', cat: 'sensor', p: 'farbe', type: 'str', robots: ALL, needs: 'farbe', help: 'Erkannte Farbe des Farbsensors, z. B. „rot“ – oder „keine“.' },
  { id: 'r_helligkeit', cat: 'sensor', p: 'helligkeit', type: 'num', robots: ALL, needsAny: ['linie', 'farbe'], help: 'Remission unter dem Sensor (0 = schwarz, 100 = weiß).' },
  { id: 'r_linie', cat: 'sensor', p: 'linie {seite:dir}', type: 'bool', robots: ['rover'], needs: 'linie', def: { seite: 'links' }, help: 'Wahr, wenn der linke bzw. rechte Spursensor die Linie erkennt.' },
  { id: 'r_beruehrt', cat: 'sensor', p: 'berührt', type: 'bool', robots: ALL, needs: 'beruehrung', help: 'Wahr, wenn die Kontaktleiste (Bumper oder Greiferbacken) betätigt ist.' },
  { id: 'r_haelt', cat: 'sensor', p: 'hält etwas', type: 'bool', robots: ALL, needs: 'greifer', help: 'Wahr, wenn das Werkzeug ein Objekt hält.' },
  { id: 'r_kraft', cat: 'sensor', p: 'kraft im greifer', type: 'num', robots: ALL, needs: 'greifer', help: 'Aktuelle Greifkraft in N.' },
  { id: 'r_gewicht', cat: 'sensor', p: 'gewicht', type: 'num', robots: ALL, needs: 'greifer', help: 'Masse des gegriffenen Objekts in g (0 ohne Last).' },
  { id: 'r_neigung', cat: 'sensor', p: 'neigung', type: 'num', robots: ALL, help: 'Neigung aus der IMU in Grad.' },
  { id: 'r_kompass', cat: 'sensor', p: 'kompass', type: 'num', robots: ALL, help: 'Orientierung (Gierwinkel) in Grad, 0 … 360.' },
  { id: 'r_position', cat: 'sensor', p: 'position {achse:axis}', type: 'num', robots: ALL, def: { achse: 'x' }, help: 'Position in Weltkoordinaten (cm).' },
  { id: 'r_winkel', cat: 'sensor', p: 'winkel von {gelenk:joint}', type: 'num', robots: ARMS, def: { gelenk: { arm: 'basis', humanoid: 'kopf' } }, help: 'Istwinkel einer Achse in Grad.' },
  { id: 'r_sieht', cat: 'sensor', p: 'sieht {farbe:color}', type: 'bool', robots: ALL, needs: 'kamera', def: { farbe: 'rot' }, help: 'Wahr, wenn die Kamera ein Objekt dieser Farbe erkennt.' },
  { id: 'r_richtung_zu', cat: 'sensor', p: 'richtung zu {farbe:color}', type: 'num', robots: ALL, needs: 'kamera', def: { farbe: 'rot' }, help: 'Richtung zum erkannten Objekt in Grad (+ = rechts).' },
  { id: 'r_entfernung_zu', cat: 'sensor', p: 'entfernung zu {farbe:color}', type: 'num', robots: ALL, needs: 'kamera', def: { farbe: 'rot' }, help: 'Entfernung zum erkannten Objekt in cm.' },
  { id: 'r_temperatur', cat: 'sensor', p: 'temperatur', type: 'num', robots: ALL, needs: 'waerme', help: 'Höchste Temperatur im Bild der Wärmebildkamera in °C.' },
  { id: 'r_motortemperatur', cat: 'sensor', p: 'motortemperatur', type: 'num', robots: ALL, help: 'Temperatur des wärmsten eigenen Antriebs in °C.' },
  { id: 'r_rfid', cat: 'sensor', p: 'rfid code', type: 'str', robots: ALL, needs: 'rfid', help: 'Kennung des nächsten RFID-Transponders (bis 10 cm) – oder „keiner“.' },
  { id: 'r_barcode', cat: 'sensor', p: 'barcode', type: 'str', robots: ALL, needs: 'barcode', help: 'Inhalt des Codes, den der Code-Scanner gerade sieht – oder „keiner“.' },
  { id: 'r_kraft_werkzeug', cat: 'sensor', p: 'kraft am werkzeug', type: 'num', robots: ['arm'], needs: 'kraft', help: 'Kraft am Werkzeugflansch in Newton (Gewicht und Beschleunigung der Last).' },
  { id: 'r_lidar_abstand', cat: 'scan', p: 'lidar abstand bei {winkel:num}', type: 'num', robots: ALL, needs: 'lidar', def: { winkel: 0 }, unit: { winkel: '°' }, help: 'Gemessener Abstand in cm in eine Richtung (0° = vorn, + = rechts).' },
  { id: 'r_lidar_naechstes', cat: 'scan', p: 'lidar nächstes hindernis', type: 'num', robots: ALL, needs: 'lidar', help: 'Abstand zum nächsten Hindernis im vorderen Halbraum in cm.' },
  { id: 'r_lidar_richtung', cat: 'scan', p: 'lidar richtung zum hindernis', type: 'num', robots: ALL, needs: 'lidar', help: 'Richtung zum nächsten Hindernis in Grad (+ = rechts).' },
  { id: 'r_weg_frei', cat: 'scan', p: 'weg frei auf {strecke:num}', type: 'bool', robots: ALL, needs: 'lidar', def: { strecke: 60 }, unit: { strecke: 'cm' }, help: 'Wahr, wenn der Fahrweg in Fahrzeugbreite auf dieser Länge frei ist.' },
  { id: 'r_schutzfeld', cat: 'scan', p: 'schutzfeld verletzt', type: 'bool', robots: ALL, needs: 'schutzfeld', help: 'Wahr, solange jemand das Schutzfeld des Sicherheitslaserscanners verletzt.' },
  { id: 'r_radar_anzahl', cat: 'scan', p: 'radar anzahl ziele', type: 'num', robots: ALL, needs: 'radar', help: 'Anzahl der Objekte, die das Radar erfasst.' },
  { id: 'r_radar_abstand', cat: 'scan', p: 'radar abstand', type: 'num', robots: ALL, needs: 'radar', help: 'Entfernung zum nächsten Radarziel in cm.' },
  { id: 'r_radar_geschwindigkeit', cat: 'scan', p: 'radar geschwindigkeit', type: 'num', robots: ALL, needs: 'radar', help: 'Relativgeschwindigkeit des nächsten Ziels in cm/s (negativ = nähert sich).' },
  { id: 'r_radar_annaeherung', cat: 'scan', p: 'radar annäherung', type: 'bool', robots: ALL, needs: 'radar', help: 'Wahr, wenn sich ein Objekt im Umkreis von 6 m nähert.' },
  { id: 'r_signalstaerke', cat: 'licht', p: 'signalstärke', type: 'num', robots: ALL, needs: 'funk', help: 'Bester Empfangspegel zu einem anderen Gerät in dBm.' },
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

// Kann ein Roboter mit diesen Fähigkeiten den Befehl ausführen? Liefert den fehlenden Schlüssel oder null.
export function missingNeed(def, caps) {
  if (!caps) return null;
  if (def.needs) for (const k of [].concat(def.needs)) if (!caps.has(k)) return k;
  if (def.needsAny && !def.needsAny.some((k) => caps.has(k))) return def.needsAny[0];
  return null;
}

export function defaultFor(def, slot, robotType) {
  const d = def.def && def.def[slot];
  if (d && typeof d === 'object') return d[robotType] ?? Object.values(d)[0];
  return d;
}
