// Teilekatalog: alles, was man im Konfigurator auswählen kann – mit echten Auswirkungen auf die Physik.

export const ROBOT_TYPES = {
  humanoid: { name: 'Humanoid', short: 'Läuft auf zwei Beinen, greift mit zwei Händen.', icon: 'humanoid' },
  arm: { name: 'Roboterarm', short: 'Fünf Achsen, präzise und kräftig.', icon: 'arm' },
  rover: { name: 'Fahrroboter', short: 'Flink auf Rädern, voller Sensoren.', icon: 'rover' },
};

export const MOTORS = {
  mikro: { name: 'Mikro-Servo', desc: 'Leicht und schnell, aber schwach.', torque: 0.35, speed: 1.35, mass: 0.6, power: 0.6 },
  standard: { name: 'Standard-Servo', desc: 'Der Allrounder.', torque: 1, speed: 1, mass: 1, power: 1 },
  industrie: { name: 'Industrie-Antrieb', desc: 'Sehr kräftig, etwas schwerer und langsamer.', torque: 2.4, speed: 0.85, mass: 1.5, power: 1.6 },
};

export const GRIPPERS = {
  zange: { name: 'Zweifinger-Greifer', desc: 'Klemmt Gegenstände zwischen zwei Fingern ein. Hält, solange Reibung und Kraft reichen.', force: 28, mass: 0.35 },
  sauger: { name: 'Saugnapf', desc: 'Saugt sich an glatten Flächen fest – gut für Würfel, schlecht für Kugeln.', force: 22, mass: 0.25 },
  magnet: { name: 'Elektromagnet', desc: 'Hebt nur Gegenstände aus Stahl, die aber bombenfest.', force: 45, mass: 0.45 },
};

export const ARM_LENGTHS = {
  kurz: { name: 'Kurz', l1: 0.30, l2: 0.27, desc: 'Reichweite ca. 65 cm, sehr stabil.' },
  mittel: { name: 'Mittel', l1: 0.40, l2: 0.36, desc: 'Reichweite ca. 85 cm.' },
  lang: { name: 'Lang', l1: 0.50, l2: 0.45, desc: 'Reichweite ca. 105 cm, braucht kräftige Motoren.' },
};

export const BATTERIES = {
  klein: { name: 'Klein (50 Wh)', wh: 50, mass: 0.35 },
  standard: { name: 'Standard (120 Wh)', wh: 120, mass: 0.8 },
  gross: { name: 'Groß (300 Wh)', wh: 300, mass: 1.9 },
  unendlich: { name: 'Netzteil (unbegrenzt)', wh: Infinity, mass: 0.2 },
};

export const BALANCE = {
  keins: { name: 'Kein Gyro', desc: 'Nur die Fußgelenke halten das Gleichgewicht – Laufen wird zum Abenteuer.', torque: 0 },
  standard: { name: 'Gyro-Stabilisator', desc: 'Ein Kreiselmodul hält den Körper aufrecht.', torque: 200 },
  pro: { name: 'Gyro Pro', desc: 'Doppelte Kreisel, fängt auch kräftige Stöße ab.', torque: 420 },
};

export const HEADS = {
  visier: { name: 'Visier', desc: 'Klassisch mit Leuchtaugen.' },
  kamera: { name: 'Kamerakopf', desc: 'Große Linse, weiter Blick.' },
  lidar: { name: 'Lidar-Kopf', desc: 'Rotierender Laserscanner oben drauf.' },
};

export const WHEELS = {
  standard: { name: 'Standardräder', r: 0.05, friction: 1.1, desc: 'Leise und genau.' },
  gelaende: { name: 'Geländereifen', r: 0.065, friction: 1.5, desc: 'Größer und griffiger, schafft Rampen leichter.' },
};

export const SENSORS = {
  abstand: { name: 'Abstandssensor', desc: 'Misst per Ultraschall, wie weit das nächste Hindernis entfernt ist (bis 2 m).', icon: 'sonar' },
  farbe: { name: 'Farbsensor', desc: 'Erkennt die Farbe direkt vor bzw. unter sich.', icon: 'color' },
  kamera: { name: 'Kamera', desc: 'Findet Gegenstände nach Farbe – nötig für „nimm“ und „sieht“.', icon: 'camera' },
  beruehrung: { name: 'Berührungssensor', desc: 'Meldet, wenn die Stoßstange bzw. der Greifer etwas berührt.', icon: 'touch' },
  linie: { name: 'Liniensensoren', desc: 'Zwei Helligkeitssensoren unten vorne – zum Folgen von Linien.', icon: 'line', robots: ['rover'] },
};

export const SHELL_COLORS = [
  { id: 'weiß', name: 'Weiß', hex: '#f1f2f4' },
  { id: 'graphit', name: 'Graphit', hex: '#3b4049' },
  { id: 'sand', name: 'Sand', hex: '#e7dcc8' },
  { id: 'himmel', name: 'Himmel', hex: '#cfe3f7' },
  { id: 'mint', name: 'Mint', hex: '#cdeedd' },
];
export const ACCENT_COLORS = [
  { id: 'orange', hex: '#ff7a1a' }, { id: 'blau', hex: '#3b82f6' }, { id: 'grün', hex: '#22c55e' },
  { id: 'rot', hex: '#ef4444' }, { id: 'gelb', hex: '#facc15' }, { id: 'lila', hex: '#a855f7' }, { id: 'türkis', hex: '#14b8a6' },
];

export const DEFAULT_CONFIGS = {
  arm: { type: 'arm', name: 'Greifi', motor: 'standard', greifer: 'zange', laenge: 'mittel', akku: 'unendlich', sensoren: ['abstand', 'farbe', 'kamera', 'beruehrung'], shell: '#f1f2f4', accent: '#ff7a1a' },
  humanoid: { type: 'humanoid', name: 'Nova', motor: 'standard', greifer: 'zange', gyro: 'standard', kopf: 'visier', akku: 'unendlich', sensoren: ['abstand', 'kamera', 'beruehrung', 'farbe'], shell: '#f1f2f4', accent: '#3b82f6' },
  rover: { type: 'rover', name: 'Flitzer', motor: 'standard', greifer: 'keiner', raeder: 'standard', akku: 'unendlich', sensoren: ['abstand', 'farbe', 'linie', 'beruehrung', 'kamera'], shell: '#f1f2f4', accent: '#22c55e' },
};

export function withDefaults(cfg) {
  const base = DEFAULT_CONFIGS[cfg.type] || DEFAULT_CONFIGS.arm;
  return { ...base, ...cfg, sensoren: cfg.sensoren ? [...cfg.sensoren] : [...base.sensoren] };
}
