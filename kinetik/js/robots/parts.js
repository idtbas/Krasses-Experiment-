// Komponentenkatalog: Grundgeräte, Antriebe je Achsgruppe, Werkzeuge, Sensorik, Funk, Signalgeber,
// Energie und Steuerung – mit Datenblattwerten, Preisen (netto, unverbindlich) und echter Wirkung
// auf Physik, Sensorik und Energiebedarf.

export const ROBOT_TYPES = {
  arm: { name: 'KX-5', label: 'Knickarmroboter', short: '5 Achsen · Traglast bis 4 kg · stationär', icon: 'arm', price: 6400 },
  humanoid: { name: 'HX-2', label: 'Humanoider Roboter', short: '22 Achsen · 1,42 m · zweibeinig', icon: 'humanoid', price: 24900 },
  rover: { name: 'AMR-1', label: 'Autonome mobile Plattform', short: 'Differentialantrieb · 0,55 m/s · Nutzlast 8 kg', icon: 'rover', price: 3200 },
};

/* ---------------- Antriebe ---------------- */

// Faktoren sind absolut; im Roboter wirken sie relativ zum Referenzantrieb der Achsgruppe.
export const DRIVES = {
  servo: { name: 'DC-Getriebeservo', model: 'DS-40 · Stirnradgetriebe', desc: 'Bürstenbehafteter DC-Motor. Günstig, mittlere Dynamik, erwärmt sich unter Last deutlich.', torque: 1.0, speed: 1.0, mass: 1.0, stiff: 1.0, eff: 0.55, price: 95 },
  schritt: { name: 'Schrittmotor', model: 'NEMA 23 · Planetengetriebe i=10', desc: 'Hohes Haltemoment und sehr wiederholgenau, bei hoher Drehzahl jedoch träge.', torque: 1.2, speed: 0.7, mass: 1.25, stiff: 1.7, eff: 0.45, price: 160 },
  bldc: { name: 'Bürstenloser Servomotor', model: 'BLDC-60 · Planetengetriebe', desc: 'Elektronisch kommutiert, hohe Leistungsdichte und Dynamik, wartungsfrei.', torque: 1.6, speed: 1.4, mass: 0.95, stiff: 1.3, eff: 0.85, price: 420 },
  harmonic: { name: 'BLDC + Wellgetriebe', model: 'BLDC-60 · Harmonic Drive i=100', desc: 'Spielfrei, sehr steif und kräftig – Standard in Industrierobotern.', torque: 2.6, speed: 1.1, mass: 1.1, stiff: 2.0, eff: 0.75, price: 1450 },
  qdd: { name: 'Quasi-Direktantrieb', model: 'QDD-90 · i=9', desc: 'Rücktreibbar und nachgiebig – ideal für Laufroboter und Kontaktaufgaben.', torque: 1.9, speed: 1.6, mass: 1.05, stiff: 0.9, eff: 0.9, price: 680 },
  ac: { name: 'AC-Servo + Zykloidgetriebe', model: 'AC-400 · RV i=120', desc: 'Schwerlastantrieb mit hoher Überlastreserve. Schwer, aber robust.', torque: 3.4, speed: 0.9, mass: 1.6, stiff: 2.3, eff: 0.8, price: 2300 },
};

// Achsgruppen je Robotertyp. ref: Referenzantrieb (Faktor 1 in der Physik).
export const DRIVE_GROUPS = {
  arm: {
    achsen: { name: 'Hauptachsen A1–A3', axes: 3, ref: 'bldc', options: ['servo', 'schritt', 'bldc', 'harmonic', 'ac'] },
    hand: { name: 'Handachsen A4–A5', axes: 2, ref: 'bldc', options: ['servo', 'schritt', 'bldc', 'harmonic'] },
  },
  humanoid: {
    beine: { name: 'Beinantriebe (8 Achsen)', axes: 8, ref: 'qdd', options: ['servo', 'bldc', 'qdd', 'harmonic'] },
    arme: { name: 'Rumpf, Kopf und Arme (10 Achsen)', axes: 10, ref: 'bldc', options: ['servo', 'bldc', 'qdd', 'harmonic'] },
  },
  rover: {
    fahr: { name: 'Fahrantrieb (2 Räder)', axes: 2, ref: 'bldc', options: ['servo', 'schritt', 'bldc', 'ac'] },
  },
};

/* ---------------- Grundgerät ---------------- */

export const ARM_LENGTHS = {
  kurz: { name: 'KX-5 S', l1: 0.30, l2: 0.27, desc: 'Reichweite 0,72 m, sehr steif.', price: -900 },
  mittel: { name: 'KX-5 M', l1: 0.40, l2: 0.36, desc: 'Reichweite 0,91 m.', price: 0 },
  lang: { name: 'KX-5 L', l1: 0.50, l2: 0.45, desc: 'Reichweite 1,10 m, braucht kräftige Hauptachsen.', price: 1400 },
};

export const BALANCE = {
  keins: { name: 'Nur Fußgelenke', model: '–', desc: 'Balance allein über die Sprunggelenke. Instabil bei Stößen.', torque: 0, price: 0 },
  standard: { name: 'Reaktionsrad-Stabilisator', model: 'RW-200', desc: 'Ein Reaktionsrad im Becken stützt den Oberkörper.', torque: 200, price: 1900 },
  pro: { name: 'Doppel-Reaktionsrad', model: 'RW-420', desc: 'Zwei gegenläufige Räder, fängt auch kräftige Stöße ab.', torque: 420, price: 3600 },
};

export const WHEELS = {
  standard: { name: 'PU-Räder Ø 100 mm', r: 0.05, friction: 1.1, desc: 'Hallenboden, leise, genaue Odometrie.', price: 0 },
  gelaende: { name: 'Luftbereifung Ø 130 mm', r: 0.065, friction: 1.5, desc: 'Mehr Bodenfreiheit und Grip, schafft Rampen leichter.', price: 240 },
};

/* ---------------- Werkzeuge ---------------- */

export const TOOLS = {
  parallel: { name: 'Parallelgreifer', model: 'PG-80', desc: 'Zwei Backen, Hub 2 × 62 mm, Greifkraft 28 N. Reibschlüssig.', force: 28, mass: 0.35, price: 890, gtype: 'zange', robots: ['arm', 'humanoid'] },
  parallel_hd: { name: 'Schwerlast-Parallelgreifer', model: 'PG-160 HD', desc: 'Greifkraft 70 N, gummierte Backen. Für schwere Werkstücke.', force: 70, mass: 0.75, price: 2100, gtype: 'zange', robots: ['arm'] },
  vakuum: { name: 'Vakuumsauger', model: 'VS-40 · Ejektor', desc: 'Hält an glatten, ebenen Flächen. Ungeeignet für Kugeln.', force: 22, mass: 0.25, price: 540, gtype: 'sauger', robots: ['arm', 'humanoid'] },
  magnet: { name: 'Elektromagnetgreifer', model: 'EM-50 · 24 V', desc: 'Nur für Stahl, dafür sehr hohe Haltekraft.', force: 45, mass: 0.45, price: 760, gtype: 'magnet', robots: ['arm'] },
  lackier: { name: 'Lackierpistole', model: 'SP-1 HVLP', desc: 'Beschichtet Werkstücke unter der Düse in einer wählbaren Farbe. Greift nicht.', mass: 0.4, price: 1350, gtype: 'lackier', robots: ['arm'] },
  frontgreifer: { name: 'Frontgreifer', model: 'FG-2', desc: 'Zangengreifer an der Front für Behälter und Werkstücke bis 1 kg.', force: 16.8, mass: 0.4, price: 640, gtype: 'zange', robots: ['rover'] },
  keins: { name: 'Ohne Werkzeug', model: '–', desc: 'Leichter und günstiger.', mass: 0, price: 0, gtype: null, robots: ['rover'] },
};

/* ---------------- Module (Sensorik und Signalgeber) ---------------- */

// key: unter welchem Namen das Gerät im Roboter erreichbar ist. group: schließt sich gegenseitig aus.
// compute: Rechenlast in Einheiten der Steuerung. power: Leistungsaufnahme in Watt.
export const MODULES = {
  // Sensorik
  ultraschall: { cat: 'sensorik', key: 'abstand', group: 'abstand', name: 'Ultraschallsensor', model: 'US-200', desc: 'Abstand 2–200 cm, Schallkeule 15°. Unabhängig von Farbe und Licht.', price: 65, mass: 0.03, power: 0.4, compute: 0 },
  tof: { cat: 'sensorik', key: 'abstand', group: 'abstand', name: 'ToF-Laserdistanzsensor', model: 'TL-4', desc: 'Lichtlaufzeit, Punktmessung bis 4 m, ± 3 mm.', price: 145, mass: 0.02, power: 0.6, compute: 0 },
  farbsensor: { cat: 'sensorik', key: 'farbe', name: 'Farbsensor', model: 'CS-3 RGB', desc: 'Erkennt Farben aus 1–30 cm, mit eigener Weißlicht-LED.', price: 120, mass: 0.02, power: 0.3, compute: 0 },
  linie: { cat: 'sensorik', key: 'linie', name: 'Spurführungssensor', model: 'LS-2', desc: 'Zwei Reflexlichttaster unter der Front zum Folgen von Bodenlinien.', price: 80, mass: 0.02, power: 0.2, compute: 0, robots: ['rover'] },
  kontakt: { cat: 'sensorik', key: 'beruehrung', name: 'Taktile Kontaktleiste', model: 'KL-1', desc: 'Schaltleiste an Bumper bzw. Greiferbacken.', price: 110, mass: 0.05, power: 0.1, compute: 0 },
  kamera: { cat: 'sensorik', key: 'kamera', group: 'vision', name: 'Industriekamera RGB', model: 'VC-5 · 5 MP', desc: 'Farbbild mit Objektdetektion. Braucht ausreichend Licht.', price: 690, mass: 0.12, power: 3, compute: 3 },
  tiefenkamera: { cat: 'sensorik', key: 'kamera', group: 'vision', name: 'Stereo-Tiefenkamera', model: 'RGB-D D4', desc: 'Farbbild plus Tiefenkarte bis 6 m. Ersetzt die RGB-Kamera.', price: 980, mass: 0.16, power: 4, compute: 4, depth: true },
  waermebild: { cat: 'sensorik', key: 'waerme', name: 'Wärmebildkamera', model: 'TC-160 LWIR', desc: '160 × 120 px, −20 … 400 °C. Sieht im Dunkeln, aber keine Farben.', price: 1890, mass: 0.14, power: 2, compute: 2 },
  lidar2d: { cat: 'sensorik', key: 'lidar', group: 'lidar', name: '2D-LiDAR', model: 'LS-360 · 12 m', desc: '360°-Laserscanner, 1° Auflösung, 10 Hz. Für Navigation und Hinderniserkennung.', price: 1250, mass: 0.19, power: 3, compute: 2, robots: ['rover', 'humanoid'] },
  lidar3d: { cat: 'sensorik', key: 'lidar', group: 'lidar', name: '3D-LiDAR', model: 'LX-16 · 16 Kanäle', desc: '360° × 30°, 30 m, Punktwolke mit 5 Hz.', price: 4200, mass: 0.83, power: 8, compute: 6 },
  sicherheitsscanner: { cat: 'sensorik', key: 'lidar', group: 'lidar', name: 'Sicherheitslaserscanner', model: 'SLS-270 · PL d', desc: '270°, 5 m. Schutzfeld stoppt die Achsen automatisch und sicher, sobald jemand eintritt.', price: 2650, mass: 0.6, power: 4, compute: 1, robots: ['arm', 'rover'], safety: true },
  radar: { cat: 'sensorik', key: 'radar', name: 'FMCW-Radar 77 GHz', model: 'RD-77', desc: '± 60°, 0,2–20 m. Misst Entfernung und Relativgeschwindigkeit – auch bei Dunkelheit, Staub und Nebel.', price: 1480, mass: 0.15, power: 4, compute: 2 },
  rfid: { cat: 'sensorik', key: 'rfid', name: 'RFID-Lesekopf', model: 'HF 13,56 MHz', desc: 'Liest Transponder an Werkstücken aus bis zu 10 cm.', price: 310, mass: 0.08, power: 1, compute: 0 },
  barcode: { cat: 'sensorik', key: 'barcode', name: 'Code-Scanner', model: 'BC-2D', desc: 'Liest 1D- und 2D-Codes aus bis zu 60 cm.', price: 540, mass: 0.09, power: 2, compute: 1 },
  kraftmoment: { cat: 'sensorik', key: 'kraft', name: 'Kraft-Momenten-Sensor', model: 'FT-6 · 6 Achsen', desc: 'Am Handflansch: misst Last und Kontaktkräfte am Werkzeug.', price: 2900, mass: 0.25, power: 1.5, compute: 1, robots: ['arm'] },
  // Signalgeber
  signalsaeule: { cat: 'signal', key: 'signalsaeule', name: 'Signalsäule', model: 'SL-4 · rot/gelb/grün/blau', desc: 'Vier Leuchtsegmente für Betriebszustände.', price: 160, mass: 0.3, power: 2, compute: 0 },
  rundumleuchte: { cat: 'signal', key: 'rundumleuchte', name: 'Rundumleuchte', model: 'RL-24 · LED orange', desc: 'Leuchtet automatisch, solange sich der Roboter bewegt.', price: 85, mass: 0.15, power: 3, compute: 0 },
  scheinwerfer: { cat: 'signal', key: 'scheinwerfer', name: 'LED-Scheinwerfer', model: 'FL-20 · 2000 lm', desc: 'Leuchtet den Arbeitsbereich aus – Kameras arbeiten dann auch im Dunkeln.', price: 120, mass: 0.2, power: 20, compute: 0 },
  hupe: { cat: 'signal', key: 'hupe', name: 'Signalhupe', model: 'HS-105 · 105 dB', desc: 'Akustische Warnung.', price: 40, mass: 0.1, power: 1, compute: 0 },
};

/* ---------------- Kommunikation ---------------- */

export const RADIOS = {
  keins: { name: 'Kein Funk', model: '–', desc: 'Keine Nachrichten an andere Geräte.', price: 0 },
  wlan: { name: 'WLAN-Modul', model: 'Wi-Fi 6 · 2,4 GHz', desc: 'Hohe Datenrate, kurze Latenz. Wände dämpfen stark.', ptx: 20, sens: -82, freq: 2400, latency: 0.01, price: 75, tech: 'wlan' },
  funk868: { name: 'ISM-Funkmodul', model: 'SRD 868 MHz', desc: 'Geringere Frequenz: dringt besser durch Wände.', ptx: 14, sens: -105, freq: 868, latency: 0.04, price: 130, tech: 'srd' },
  lora: { name: 'LoRa-Modul', model: 'SX1262 · 868 MHz', desc: 'Sehr große Reichweite, aber träge (ca. 0,4 s je Nachricht).', ptx: 14, sens: -130, freq: 868, latency: 0.38, price: 45, tech: 'lora' },
  g5: { name: '5G-Campusmodem', model: '5G NR · Band n78', desc: 'Über das Campusnetz der Halle, Latenz ca. 12 ms.', ptx: 23, sens: -100, freq: 3700, latency: 0.012, price: 390, tech: '5g' },
};

export const ANTENNAS = {
  chip: { name: 'Chipantenne (intern)', gain: 0, desc: 'Auf der Platine, kein Anbauteil.', price: 0 },
  stab: { name: 'Stabantenne λ/4', gain: 2.2, desc: 'Rundstrahlend, kompakt.', price: 18 },
  rundstrahl: { name: 'Rundstrahlantenne', gain: 5, desc: 'Längerer Strahler auf Fuß, rundstrahlend.', price: 65 },
  patch: { name: 'Patchantenne', gain: 8, beam: 70, desc: 'Gerichtet (70°), zeigt nach vorn.', price: 90 },
  yagi: { name: 'Richtantenne (Yagi)', gain: 12, beam: 35, desc: 'Stark gerichtet (35°), zeigt nach vorn.', price: 140 },
};

/* ---------------- Energie und Steuerung ---------------- */

export const BATTERIES = {
  netz: { name: 'Netzteil 48 V', model: 'PSU-1k · 230 V', wh: Infinity, mass: 0.6, desc: 'Kabelgebunden, unbegrenzte Laufzeit.', price: 260 },
  liion_s: { name: 'Li-Ion-Akku 24 V', model: '5 Ah · 120 Wh', wh: 120, mass: 0.8, desc: 'Leicht, kurze Laufzeit.', price: 180 },
  liion_l: { name: 'Li-Ion-Akku 48 V', model: '10 Ah · 480 Wh', wh: 480, mass: 2.9, desc: 'Ausgewogen.', price: 520 },
  lifepo4: { name: 'LiFePO4-Akku 48 V', model: '20 Ah · 960 Wh', wh: 960, mass: 6.8, desc: 'Lange Laufzeit, zyklenfest, schwer.', price: 890 },
};

export const CONTROLLERS = {
  mcu: { name: 'Mikrocontroller', model: 'MC-32 · 600 MHz', compute: 3, power: 2, desc: 'Echtzeitfähig, für einfache Sensorik.', price: 120 },
  ipc: { name: 'Industrie-PC', model: 'IPC-4 · 4 Kerne', compute: 8, power: 25, desc: 'Genug Leistung für Kamera und LiDAR.', price: 1150 },
  edge: { name: 'Edge-KI-Rechner', model: 'AX-8 · 40 TOPS', compute: 16, power: 40, desc: 'GPU für mehrere Kameras und 3D-Punktwolken.', price: 2400 },
};

/* ---------------- Lackierung ---------------- */

export const SHELL_COLORS = [
  { id: 'ral7035', name: 'Lichtgrau RAL 7035', hex: '#c5c7c4' },
  { id: 'ral9016', name: 'Verkehrsweiß RAL 9016', hex: '#e9ebe7' },
  { id: 'ral7016', name: 'Anthrazitgrau RAL 7016', hex: '#3a4045' },
  { id: 'ral1003', name: 'Signalgelb RAL 1003', hex: '#e2a312' },
  { id: 'ral2004', name: 'Reinorange RAL 2004', hex: '#e2601a' },
  { id: 'ral5015', name: 'Himmelblau RAL 5015', hex: '#2c6fae' },
  { id: 'ral6018', name: 'Gelbgrün RAL 6018', hex: '#4f9a3a' },
];
export const ACCENT_COLORS = [
  { id: 'weiß', name: 'Weiß', hex: '#e8f1ff' }, { id: 'cyan', name: 'Cyan', hex: '#34d3ee' }, { id: 'grün', name: 'Grün', hex: '#3fd07a' },
  { id: 'bernstein', name: 'Bernstein', hex: '#ffb21a' }, { id: 'blau', name: 'Blau', hex: '#4c8dff' },
];

/* ---------------- Grundkonfigurationen ---------------- */

export const DEFAULT_CONFIGS = {
  arm: {
    type: 'arm', name: 'KX-5', antrieb: { achsen: 'bldc', hand: 'bldc' }, werkzeug: 'parallel', laenge: 'mittel', akku: 'netz', steuerung: 'ipc',
    module: ['ultraschall', 'farbsensor', 'kamera', 'kontakt'], funk: 'wlan', antenne: 'stab', lack: '#c5c7c4', akzent: '#e8f1ff',
  },
  humanoid: {
    type: 'humanoid', name: 'HX-2', antrieb: { beine: 'qdd', arme: 'bldc' }, werkzeug: 'parallel', gyro: 'standard', akku: 'liion_l', steuerung: 'edge',
    module: ['ultraschall', 'kamera', 'kontakt', 'farbsensor'], funk: 'wlan', antenne: 'chip', lack: '#e9ebe7', akzent: '#34d3ee',
  },
  rover: {
    type: 'rover', name: 'AMR-1', antrieb: { fahr: 'bldc' }, werkzeug: 'keins', raeder: 'standard', akku: 'liion_l', steuerung: 'ipc',
    module: ['ultraschall', 'farbsensor', 'linie', 'kontakt', 'kamera', 'lidar2d'], funk: 'wlan', antenne: 'stab', lack: '#e2a312', akzent: '#3fd07a',
  },
};

/* ---------------- Übernahme älterer Konfigurationen ---------------- */

const OLD_MOTOR = { mikro: 'servo', standard: null, industrie: 'harmonic' };
const OLD_TOOL = { zange: 'parallel', sauger: 'vakuum', magnet: 'magnet', keiner: 'keins' };
const OLD_SENSOR = { abstand: 'ultraschall', farbe: 'farbsensor', kamera: 'kamera', beruehrung: 'kontakt', linie: 'linie' };
const OLD_BATTERY = { unendlich: 'netz', klein: 'liion_s', standard: 'liion_l', gross: 'lifepo4' };
const OLD_NAMES = new Set(['Greifi', 'Nova', 'Flitzer']);

function migrate(cfg) {
  const c = { ...cfg };
  const groups = DRIVE_GROUPS[c.type] || {};
  if (c.motor && !c.antrieb) {
    const d = OLD_MOTOR[c.motor];
    c.antrieb = {};
    for (const [g, info] of Object.entries(groups)) c.antrieb[g] = d && info.options.includes(d) ? d : info.ref;
  }
  if (c.greifer && !c.werkzeug) c.werkzeug = c.type === 'rover' ? (c.greifer === 'zange' ? 'frontgreifer' : 'keins') : OLD_TOOL[c.greifer] || 'parallel';
  if (c.sensoren && !c.module) c.module = c.sensoren.map((s) => OLD_SENSOR[s]).filter(Boolean);
  if (c.akku && OLD_BATTERY[c.akku]) c.akku = c.type === 'arm' || c.akku !== 'unendlich' ? OLD_BATTERY[c.akku] : 'liion_l';
  if (c.shell && !c.lack) c.lack = c.shell;
  if (c.accent && !c.akzent) c.akzent = c.accent;
  if (c.name && OLD_NAMES.has(c.name)) delete c.name;
  delete c.motor; delete c.greifer; delete c.sensoren; delete c.shell; delete c.accent; delete c.kopf;
  return c;
}

export function withDefaults(cfg) {
  const m = migrate(cfg || {});
  const base = DEFAULT_CONFIGS[m.type] || DEFAULT_CONFIGS.arm;
  const out = { ...base, ...m, antrieb: { ...base.antrieb, ...(m.antrieb || {}) }, module: [...(m.module || base.module)] };
  // Ungültige Einträge bereinigen
  for (const [g, info] of Object.entries(DRIVE_GROUPS[out.type])) if (!DRIVES[out.antrieb[g]] || !info.options.includes(out.antrieb[g])) out.antrieb[g] = info.ref;
  for (const g of Object.keys(out.antrieb)) if (!DRIVE_GROUPS[out.type][g]) delete out.antrieb[g];
  if (!TOOLS[out.werkzeug] || !TOOLS[out.werkzeug].robots.includes(out.type)) out.werkzeug = base.werkzeug;
  const seen = new Set();
  out.module = out.module.filter((id) => {
    const md = MODULES[id];
    if (!md || (md.robots && !md.robots.includes(out.type))) return false;
    const g = md.group || id;
    if (seen.has(g)) return false;
    seen.add(g);
    return true;
  });
  if (!RADIOS[out.funk]) out.funk = base.funk;
  if (!ANTENNAS[out.antenne]) out.antenne = base.antenne;
  if (!BATTERIES[out.akku]) out.akku = base.akku;
  if (!CONTROLLERS[out.steuerung]) out.steuerung = base.steuerung;
  if (!out.name) out.name = ROBOT_TYPES[out.type].name;
  return out;
}

/* ---------------- Auswertung ---------------- */

export function hasModule(cfg, id) { return cfg.module.includes(id); }

// Stückliste mit Preisen
export function bom(cfg) {
  const c = withDefaults(cfg);
  const rows = [];
  const add = (cat, name, model, qty, price) => rows.push({ cat, name, model, qty, price, sum: qty * price });
  const t = ROBOT_TYPES[c.type];
  add('Grundgerät', `${t.label} ${t.name}`, 'Struktur, Verkabelung, Gehäuse', 1, t.price);
  if (c.type === 'arm') { const l = ARM_LENGTHS[c.laenge]; if (l.price) add('Grundgerät', `Baugröße ${l.name}`, l.desc, 1, l.price); }
  if (c.type === 'humanoid') { const b = BALANCE[c.gyro] || BALANCE.standard; if (b.price) add('Grundgerät', b.name, b.model, 1, b.price); }
  if (c.type === 'rover') { const w = WHEELS[c.raeder] || WHEELS.standard; if (w.price) add('Grundgerät', w.name, w.desc, 1, w.price); }
  for (const [g, info] of Object.entries(DRIVE_GROUPS[c.type])) {
    const d = DRIVES[c.antrieb[g]];
    add('Antrieb', `${d.name} – ${info.name}`, d.model, info.axes, d.price);
  }
  const tool = TOOLS[c.werkzeug];
  if (tool.price) add('Werkzeug', tool.name, tool.model, c.type === 'humanoid' ? 2 : 1, tool.price);
  for (const id of c.module) { const md = MODULES[id]; add(md.cat === 'signal' ? 'Signal' : 'Sensorik', md.name, md.model, 1, md.price); }
  const r = RADIOS[c.funk];
  if (r.price) add('Kommunikation', r.name, r.model, 1, r.price);
  const a = ANTENNAS[c.antenne];
  if (c.funk !== 'keins' && a.price) add('Kommunikation', a.name, `${a.gain} dBi`, 1, a.price);
  const b = BATTERIES[c.akku];
  add('Energie', b.name, b.model, 1, b.price);
  const s = CONTROLLERS[c.steuerung];
  add('Steuerung', s.name, s.model, 1, s.price);
  return { rows, total: rows.reduce((x, y) => x + y.sum, 0) };
}

// Rechenlast der Sensorik im Verhältnis zur Steuerung
export function computeLoad(cfg) {
  const c = withDefaults(cfg);
  const need = c.module.reduce((s, id) => s + (MODULES[id].compute || 0), 0);
  const cap = CONTROLLERS[c.steuerung].compute;
  return { need, cap, ratio: need / cap };
}

// Grundlast in Watt (Steuerung, Sensorik, Funk)
export function idlePower(cfg) {
  const c = withDefaults(cfg);
  let p = CONTROLLERS[c.steuerung].power;
  for (const id of c.module) if (id !== 'scheinwerfer' && id !== 'rundumleuchte') p += MODULES[id].power || 0;
  if (c.funk !== 'keins') p += 1.5;
  return p;
}

export const fmtEuro = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
