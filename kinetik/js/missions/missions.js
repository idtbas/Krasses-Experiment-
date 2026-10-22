// Missionen: Aufgaben mit steigender Schwierigkeit, automatischer Prüfung und Musterlösung.
// Koordinaten der Welt in Metern (Three.js: x links, y hoch, z vor dem Ursprung).

export const CHAPTERS = [
  { id: 1, title: 'Greifarm-Grundkurs', sub: 'Gelenke, Greifen, Stapeln und Sortieren' },
  { id: 2, title: 'Fahrschule', sub: 'Fahren, Sensoren und Linien' },
  { id: 3, title: 'Humanoid', sub: 'Gehen, Balancieren und Tragen' },
  { id: 4, title: 'Automation', sub: 'Fabriken und Teamwork mit mehreren Robotern' },
];

/* ---------- Prüf-Helfer ---------- */

const thing = (ctx, color, i = 0) => ctx.sim.objects.filter((o) => o.color === color)[i] || null;
const zone = (ctx, color) => ctx.sim.entities.find((e) => (e.kind === 'zone' || e.kind === 'kiste' || e.kind === 'ziel') && e.color === color) || null;
const inside = (z, t) => !!(z && t && z.contains(t.body.translation()));
const resting = (t) => { const v = t.body.linvel(); return Math.hypot(v.x, v.y, v.z) < 0.05; };
const free = (t) => t && !t.heldBy;
const robotIn = (z, r) => {
  if (!z || !r) return false;
  const f = r.frame();
  if (z.contains(f.p)) return true;
  // Fahrroboter: auch die Nase zählt (dort sitzen die Sensoren)
  return r.type === 'rover' && z.contains({ x: f.p.x + Math.sin(f.yaw) * 0.16, y: f.p.y, z: f.p.z + Math.cos(f.yaw) * 0.16 });
};
const stopped = (r) => { const v = r.baseBody().linvel(); return Math.hypot(v.x, v.z) < 0.03; };
const joint = (r, n) => (r.servos.get(n) ? r.servos.get(n).display : 0);
const said = (ctx) => ctx.log.some((l) => l.kind === 'say');

function stackedOn(top, bottom) {
  if (!top || !bottom) return false;
  const a = top.body.translation(), b = bottom.body.translation();
  return Math.hypot(a.x - b.x, a.z - b.z) < 0.035 && a.y - b.y > (top.halfHeight + bottom.halfHeight) * 0.8 && a.y - b.y < (top.halfHeight + bottom.halfHeight) * 1.25;
}

/* ---------- Bausteine der Szenen ---------- */

const ARM_TABLE = [{ type: 'tisch', x: 0, z: 0.22, w: 1.3, d: 0.95, h: 0.4 }];
const armCam = { target: [0, 0.6, 0.28], dist: 2.0, yaw: 0.75, pitch: 0.5 };
const roverCam = (z = 0.8) => ({ target: [0, 0.2, z], dist: 2.6, yaw: 0.55, pitch: 0.62 });
const humCam = { target: [0, 0.8, 0.5], dist: 3.4, yaw: 0.6, pitch: 0.3 };

export const MISSIONS = [
  /* ================= Kapitel 1: Greifarm ================= */
  {
    id: 'arm-hallo', chapter: 1, level: 1, title: 'Hallo, Greifi!', robot: 'arm',
    brief: 'Der Arm soll „Hallo“ sagen und sich dir zuwenden.',
    story: 'Das ist Greifi, ein Roboterarm mit fünf Gelenken. Ziehe Bausteine aus der Palette unter „beim start“ und drücke auf Start.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE],
    goals: [
      { text: 'Greifi sagt etwas', check: (ctx) => said(ctx) },
      { text: 'Die Basis steht auf 90° (± 5°)', check: (ctx) => Math.abs(joint(ctx.robot, 'basis') - 90) < 5 },
    ],
    par: { time: 4, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    hints: ['Unter „Licht & Ton“ findest du „sage“.', 'Unter „Bewegung“ gibt es „drehe … auf …“. Wähle das Gelenk „basis“ und tippe auf die Zahl.'],
    solution: 'beim start\n  sage "Hallo!"\n  drehe basis auf 90\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-greifen', chapter: 1, level: 1, title: 'Greifen lernen', robot: 'arm',
    brief: 'Hebe den roten Würfel mindestens 15 cm über den Tisch.',
    story: 'Mit „nimm rot“ sucht die Kamera den Würfel und der Arm greift zu. Danach musst du ihn noch anheben – zum Beispiel mit „bewege greifer um 0, 10, 0“ (x, y, z in Zentimetern).',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE, { type: 'würfel', x: -0.12, y: 0.43, z: 0.42, color: 'rot', yaw: 0.35 }],
    goals: [
      { text: 'Der rote Würfel ist im Greifer', check: (ctx) => !!thing(ctx, 'rot')?.heldBy },
      { text: 'Er schwebt 15 cm über dem Tisch', check: (ctx) => { const t = thing(ctx, 'rot'); return t && t.heldBy && t.body.translation().y > 0.4 + 0.15 + 0.03; } },
    ],
    par: { time: 9, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    hints: ['„nimm rot“ steht unter „Greifen“.', 'Nach dem Greifen: „bewege greifer um 0, 10, 0“ hebt um 10 cm an.'],
    solution: 'beim start\n  nimm rot\n  bewege greifer um 0, 10, 0\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-zone', chapter: 1, level: 1, title: 'Ab in die Zone', robot: 'arm',
    brief: 'Lege den gelben Würfel in die grüne Zone.',
    story: 'Erst greifen, dann ablegen. „lege ab auf grün“ bringt den Würfel in die grüne Zone und öffnet den Greifer.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE, { type: 'würfel', x: 0.25, y: 0.43, z: 0.38, color: 'gelb', yaw: -0.3 }, { type: 'zone', x: -0.32, y: 0.4, z: 0.32, color: 'grün', w: 0.2, d: 0.2 }],
    goals: [
      { text: 'Der gelbe Würfel liegt in der grünen Zone', check: (ctx) => inside(zone(ctx, 'grün'), thing(ctx, 'gelb')) && free(thing(ctx, 'gelb')) },
      { text: 'Der Greifer ist wieder offen', check: (ctx) => !ctx.robot.grippers.main.held },
    ],
    par: { time: 12, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    hints: ['Zwei Bausteine genügen: „nimm …“ und „lege ab auf …“.'],
    solution: 'beim start\n  nimm gelb\n  lege ab auf grün\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-turm', chapter: 1, level: 2, title: 'Turmbau', robot: 'arm',
    brief: 'Staple die drei Würfel zu einem Turm: unten gelb, dann blau, oben rot.',
    story: 'Ein Turm braucht Präzision. „lege ab auf blau“ setzt den gehaltenen Würfel genau auf den blauen.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE,
      { type: 'würfel', x: 0.0, y: 0.43, z: 0.5, color: 'gelb' },
      { type: 'würfel', x: 0.3, y: 0.43, z: 0.3, color: 'blau', yaw: 0.6 },
      { type: 'würfel', x: -0.3, y: 0.43, z: 0.32, color: 'rot', yaw: -0.4 }],
    goals: [
      { text: 'Blau steht auf Gelb', check: (ctx) => stackedOn(thing(ctx, 'blau'), thing(ctx, 'gelb')) },
      { text: 'Rot steht auf Blau', check: (ctx) => stackedOn(thing(ctx, 'rot'), thing(ctx, 'blau')) },
      { text: 'Der Turm steht von allein', check: (ctx) => ['rot', 'blau', 'gelb'].every((c) => free(thing(ctx, c)) && resting(thing(ctx, c))) && stackedOn(thing(ctx, 'rot'), thing(ctx, 'blau')) },
    ],
    par: { time: 26, stmts: 4 },
    starter: 'beim start\n  \nende\n',
    hints: ['Erst „nimm blau“ und „lege ab auf gelb“.', 'Dann dasselbe mit rot auf blau.'],
    solution: 'beim start\n  nimm blau\n  lege ab auf gelb\n  nimm rot\n  lege ab auf blau\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-sortieren', chapter: 1, level: 2, title: 'Farbensortierer', robot: 'arm',
    brief: 'Sortiere alle Würfel in die Zone ihrer Farbe – am besten mit einer Schleife.',
    story: 'Vier Würfel, zwei Zonen. Mit „für jedes f in [rot, blau, …]“ wiederholst du dieselben Schritte für jede Farbe in der Liste. Würfel, die schon in der richtigen Zone liegen, nimmt der Roboter nicht noch einmal.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE,
      { type: 'würfel', x: -0.1, y: 0.43, z: 0.5, color: 'rot', yaw: 0.2 },
      { type: 'würfel', x: 0.1, y: 0.43, z: 0.5, color: 'blau', yaw: -0.5 },
      { type: 'würfel', x: -0.05, y: 0.43, z: 0.32, color: 'blau' },
      { type: 'würfel', x: 0.16, y: 0.43, z: 0.34, color: 'rot', yaw: 0.8 },
      { type: 'zone', x: -0.4, y: 0.4, z: 0.25, color: 'rot', w: 0.2, d: 0.26 },
      { type: 'zone', x: 0.42, y: 0.4, z: 0.25, color: 'blau', w: 0.2, d: 0.26 }],
    goals: [
      { text: 'Beide roten Würfel liegen in der roten Zone', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'rot').every((t) => inside(zone(ctx, 'rot'), t) && free(t)) },
      { text: 'Beide blauen Würfel liegen in der blauen Zone', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'blau').every((t) => inside(zone(ctx, 'blau'), t) && free(t)) },
    ],
    par: { time: 50, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    hints: ['Unter „Steuerung“ gibt es „für jedes … in …“.', 'Die Liste schreibst du als [rot, blau, rot, blau]. In der Schleife: „nimm f“ und „lege ab auf f“.'],
    solution: 'beim start\n  für jedes f in [rot, blau, rot, blau]\n    nimm f\n    lege ab auf f\n  ende\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-schwer', chapter: 1, level: 3, title: 'Schwergewicht', robot: 'arm',
    brief: 'Ein Stahlwürfel wiegt 1,7 kg. Bringe ihn in die Kiste, ohne dass er herausrutscht.',
    story: 'Je schwerer der Gegenstand und je schneller die Bewegung, desto mehr Haltekraft braucht der Greifer. Mit „greifkraft 100“ drückt er fester zu, mit „tempo 30“ wird er sanfter. Oder du baust im Konfigurator einen Elektromagneten an!',
    robotDef: { config: { type: 'arm', motor: 'standard' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE, { type: 'würfel', x: 0.2, y: 0.43, z: 0.45, color: 'grau', material: 'stahl', yaw: 0.3 }, { type: 'kiste', x: -0.35, y: 0.4, z: 0.3, color: 'orange', w: 0.2, d: 0.2 }],
    goals: [
      { text: 'Der Stahlwürfel liegt in der orangen Kiste', check: (ctx) => inside(zone(ctx, 'orange'), thing(ctx, 'grau')) && free(thing(ctx, 'grau')) },
      { text: 'Er ist unterwegs nicht heruntergefallen', check: (ctx) => !ctx.flags.slipped, keep: true },
    ],
    par: { time: 22, stmts: 4 },
    starter: 'beim start\n  tempo 100\n  greifkraft 40\n  nimm grau\n  lege ab auf orange\nende\n',
    hints: ['Probier das Programm einmal aus und schau, was passiert.', 'Erhöhe die Greifkraft und senke das Tempo.'],
    solution: 'beim start\n  tempo 40\n  greifkraft 100\n  nimm grau\n  lege ab auf orange\nende\n',
    camera: armCam,
    setup: (ctx) => { ctx.onWarn = (m) => { if (/gerutscht/.test(m)) ctx.flags.slipped = true; }; },
  },

  /* ================= Kapitel 2: Fahrroboter ================= */
  {
    id: 'rover-flagge', chapter: 2, level: 1, title: 'Erste Fahrt', robot: 'rover',
    brief: 'Fahre bis zur Flagge und bleib im Kreis stehen.',
    story: 'Die Flagge steht 1,5 Meter vor dir. „fahre 50 cm vor“ – du kannst auch „1.5 m“ schreiben.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [{ type: 'ziel', x: 0, z: 1.5, color: 'orange', r: 0.18 }],
    goals: [
      { text: 'Der Fahrroboter steht im Zielkreis', check: (ctx) => robotIn(zone(ctx, 'orange'), ctx.robot) && stopped(ctx.robot) },
    ],
    par: { time: 5, stmts: 1 },
    starter: 'beim start\n  \nende\n',
    hints: ['„fahre … vor“ findest du unter „Fahren & Gehen“.', 'Die Strecke ist 150 cm.'],
    solution: 'beim start\n  fahre 150 cm vor\nende\n',
    camera: { target: [0, 0.2, 0.8], dist: 2.8, yaw: 0.9, pitch: 0.55 },
    follow: true,
  },
  {
    id: 'rover-garage', chapter: 2, level: 1, title: 'Einparken', robot: 'rover',
    brief: 'Fahre um die Ecke in die blaue Garage.',
    story: 'Geradeaus, dann rechts abbiegen. „drehe dich um 90 nach rechts“ dreht den Roboter auf der Stelle.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'zone', x: -0.8, z: 1.0, color: 'blau', w: 0.42, d: 0.42 },
      { type: 'wand', x: -0.8, z: 1.24, w: 0.5, h: 0.2, d: 0.03, color: 'grau' },
      { type: 'wand', x: -0.8, z: 0.76, w: 0.5, h: 0.2, d: 0.03, color: 'grau' },
      { type: 'wand', x: -1.06, z: 1.0, w: 0.5, h: 0.2, d: 0.03, color: 'grau', yaw: Math.PI / 2 },
      { type: 'wand', x: 0.4, z: 0.6, w: 0.03, h: 0.2, d: 1.2, color: 'grau' },
    ],
    goals: [
      { text: 'Der Roboter steht in der Garage', check: (ctx) => robotIn(zone(ctx, 'blau'), ctx.robot) && stopped(ctx.robot) },
      { text: 'Keine Wand gerammt', check: (ctx) => !ctx.flags.bump, keep: true },
    ],
    par: { time: 9, stmts: 3 },
    starter: 'beim start\n  fahre 100 cm vor\n  \nende\n',
    hints: ['Nach 100 cm geradeaus musst du dich nach rechts drehen.', 'Die Garage ist dann noch 80 cm entfernt.'],
    solution: 'beim start\n  fahre 100 cm vor\n  drehe dich um 90 nach rechts\n  fahre 80 cm vor\nende\n',
    camera: { target: [-0.4, 0.2, 0.7], dist: 2.8, yaw: 0.2, pitch: 0.7 },
    setup: (ctx) => { ctx.watchBump = true; },
  },
  {
    id: 'rover-bremse', chapter: 2, level: 2, title: 'Bremsassistent', robot: 'rover',
    brief: 'Fahre auf die Wand zu und halte 15 bis 25 cm davor an – ohne sie zu berühren.',
    story: 'Wie weit die Wand weg ist, weißt du nicht genau. Der Abstandssensor misst es: „fahre los“, dann „warte bis abstand < 20“ und „stopp“.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [{ type: 'wand', x: 0, z: 1.85, w: 1.0, h: 0.3, d: 0.05, color: 'rot' }],
    randomize: (spec, rnd) => { if (spec.type === 'wand') spec.z = 1.4 + rnd() * 0.9; },
    goals: [
      { text: 'Der Roboter steht 15–25 cm vor der Wand', check: (ctx) => { const w = ctx.sim.ofKind('wand')[0]; const p = ctx.robot.frame().p; const gap = w.spec.z - 0.025 - (p.z + 0.18); return gap > 0.15 && gap < 0.25 && stopped(ctx.robot); } },
      { text: 'Die Wand wurde nicht berührt', check: (ctx) => !ctx.flags.bump, keep: true },
    ],
    par: { time: 6, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    hints: ['„fahre los“ fährt einfach immer weiter.', '„warte bis …“ steht unter „Steuerung“, „abstand“ unter „Sensoren“.'],
    solution: 'beim start\n  fahre los\n  warte bis abstand < 20\n  stopp\nende\n',
    camera: { target: [0, 0.2, 1.0], dist: 2.9, yaw: 1.2, pitch: 0.45 },
    setup: (ctx) => { ctx.watchBump = true; },
  },
  {
    id: 'rover-linie', chapter: 2, level: 2, title: 'Linienfolger', robot: 'rover',
    brief: 'Folge der schwarzen Linie bis ins grüne Ziel.',
    story: 'Zwei Liniensensoren schauen auf den Boden. Sieht der linke die Linie, lenkst du nach links – sieht der rechte sie, nach rechts. Ein Klassiker der Robotik!',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'linie', points: [[0, -0.1], [0, 0.6], [-0.15, 0.95], [-0.45, 1.2], [-0.8, 1.3], [-1.1, 1.55], [-1.2, 1.95], [-1.05, 2.3], [-0.7, 2.45]] },
      { type: 'zone', x: -0.62, z: 2.5, color: 'grün', w: 0.36, d: 0.36 },
    ],
    goals: [
      { text: 'Im grünen Ziel angekommen', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robot) },
      { text: 'Dort angehalten', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robot) && stopped(ctx.robot) },
    ],
    par: { time: 20, stmts: 9 },
    starter: 'beim start\n  wiederhole immer\n    wenn linie links dann\n      setze motoren auf 5, 40\n    sonst\n      setze motoren auf 35, 35\n    ende\n  ende\nende\n',
    hints: ['Ergänze einen Fall für „linie rechts“ mit „sonst wenn“.', 'Für das Ziel: „sobald farbe == grün“ mit „stoppe alles“ darin.'],
    solution: 'beim start\n  wiederhole immer\n    wenn linie links dann\n      setze motoren auf 5, 40\n    sonst wenn linie rechts dann\n      setze motoren auf 40, 5\n    sonst\n      setze motoren auf 35, 35\n    ende\n  ende\nende\n\nsobald farbe == grün\n  stopp\n  stoppe alles\nende\n',
    camera: { target: [-0.6, 0.2, 1.2], dist: 3.2, yaw: 0.3, pitch: 0.85 },
  },
  {
    id: 'rover-liefern', chapter: 2, level: 2, title: 'Lieferdienst', robot: 'rover',
    brief: 'Sammle den roten und den gelben Würfel ein und bringe beide in die blaue Zone.',
    story: 'Dieser Fahrroboter hat vorne eine Zange. „nimm rot“ fährt hin und packt zu, „lege ab auf blau“ liefert ab.',
    robotDef: { config: { type: 'rover', greifer: 'zange' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'würfel', x: 0.5, z: 0.9, color: 'rot', yaw: 0.4 },
      { type: 'würfel', x: -0.4, z: 1.3, color: 'gelb', yaw: -0.2 },
      { type: 'zone', x: 0, z: -0.6, color: 'blau', w: 0.4, d: 0.4 },
    ],
    goals: [
      { text: 'Der rote Würfel ist in der blauen Zone', check: (ctx) => inside(zone(ctx, 'blau'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) },
      { text: 'Der gelbe Würfel ist in der blauen Zone', check: (ctx) => inside(zone(ctx, 'blau'), thing(ctx, 'gelb')) && free(thing(ctx, 'gelb')) },
    ],
    par: { time: 35, stmts: 4 },
    starter: 'beim start\n  \nende\n',
    hints: ['„nimm rot“, dann „lege ab auf blau“.', 'Danach das Gleiche mit gelb.'],
    solution: 'beim start\n  nimm rot\n  lege ab auf blau\n  nimm gelb\n  lege ab auf blau\nende\n',
    camera: { target: [0, 0.2, 0.4], dist: 3.3, yaw: 0.7, pitch: 0.75 },
  },

  /* ================= Kapitel 3: Humanoid ================= */
  {
    id: 'hum-schritte', chapter: 3, level: 1, title: 'Erste Schritte', robot: 'humanoid',
    brief: 'Gehe zur Flagge, dreh dich zu mir um und winke.',
    story: 'Nova läuft auf zwei Beinen – ihre Füße drücken sich vom Boden ab, ein Kreisel im Bauch hält sie im Gleichgewicht. Die Flagge steht 1,2 m vor ihr.',
    robotDef: { config: { type: 'humanoid' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [{ type: 'ziel', x: 0, z: 1.2, color: 'orange', r: 0.22 }],
    goals: [
      { text: 'Nova steht an der Flagge', check: (ctx) => robotIn(zone(ctx, 'orange'), ctx.robot) },
      { text: 'Sie schaut zurück zum Start', check: (ctx) => robotIn(zone(ctx, 'orange'), ctx.robot) && Math.cos(ctx.robot.frame().yaw) < -0.85 },
      { text: 'Sie winkt', check: (ctx) => ctx.flags.cmd_winke, keep: true },
    ],
    par: { time: 16, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    hints: ['„gehe … vor“, „drehe dich um … nach …“ und „winke“.', 'Umdrehen heißt 180°.'],
    solution: 'beim start\n  gehe 120 cm vor\n  drehe dich um 180 nach links\n  winke\nende\n',
    camera: humCam,
    follow: true,
  },
  {
    id: 'hum-kellner', chapter: 3, level: 2, title: 'Kellnerin', robot: 'humanoid',
    brief: 'Nimm den Würfel vom Tisch und stelle ihn auf den anderen Tisch in die Zone.',
    story: 'Zum Greifen beugt sich Nova vor und streckt die rechte Hand aus. Sie geht selbst zum Würfel, wenn sie ihn mit der Kamera sieht.',
    robotDef: { config: { type: 'humanoid' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'tisch', x: 0.2, z: 1.0, w: 0.6, d: 0.45, h: 0.62 },
      { type: 'tisch', x: -1.1, z: 0.2, w: 0.6, d: 0.45, h: 0.62, yaw: Math.PI / 2 },
      { type: 'würfel', x: 0.22, y: 0.65, z: 0.92, color: 'rot', yaw: 0.3 },
      { type: 'zone', x: -1.1, y: 0.62, z: 0.2, color: 'grün', w: 0.22, d: 0.22 },
    ],
    goals: [
      { text: 'Nova hat den Würfel', check: (ctx) => ctx.flags.grabbed, keep: true },
      { text: 'Der Würfel liegt in der grünen Zone', check: (ctx) => inside(zone(ctx, 'grün'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) },
    ],
    par: { time: 40, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    hints: ['„nimm rot“ – sie läuft selbst hin.', 'Dann „lege ab auf grün“.'],
    solution: 'beim start\n  tempo 70\n  nimm rot\n  lege ab auf grün\nende\n',
    camera: { target: [-0.4, 0.7, 0.6], dist: 3.4, yaw: 0.9, pitch: 0.42 },
    setup: (ctx) => { ctx.onGrip = (what) => { if (what === 'greift') ctx.flags.grabbed = true; }; },
  },
  {
    id: 'hum-parcours', chapter: 3, level: 2, title: 'Parcours', robot: 'humanoid',
    brief: 'Laufe nacheinander zu den Flaggen A (blau), B (gelb) und C (grün).',
    story: '„gehe zu x, z“ läuft zu einem Punkt am Boden. Die Koordinaten stehen an den Flaggen (in cm). x zählt nach rechts, z nach vorn.',
    robotDef: { config: { type: 'humanoid' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'ziel', x: -0.6, z: 1.0, color: 'blau', r: 0.2, label: 'A (60, 100)' },
      { type: 'ziel', x: 0.4, z: 1.8, color: 'gelb', r: 0.2, label: 'B (-40, 180)' },
      { type: 'ziel', x: 0.6, z: 0.4, color: 'grün', r: 0.2, label: 'C (-60, 40)' },
      { type: 'wand', x: -0.05, z: 1.0, w: 0.04, h: 0.35, d: 0.6, color: 'grau' },
    ],
    goals: [
      { text: 'Flagge A erreicht', check: (ctx) => ctx.flags.a || (robotIn(zone(ctx, 'blau'), ctx.robot) && (ctx.flags.a = true)), keep: true },
      { text: 'danach Flagge B', check: (ctx) => ctx.flags.b || (ctx.flags.a && robotIn(zone(ctx, 'gelb'), ctx.robot) && (ctx.flags.b = true)), keep: true },
      { text: 'und zum Schluss Flagge C', check: (ctx) => ctx.flags.b && robotIn(zone(ctx, 'grün'), ctx.robot) },
    ],
    par: { time: 40, stmts: 3 },
    starter: 'beim start\n  gehe zu 60, 100\nende\n',
    hints: ['Für B und C brauchst du noch zwei „gehe zu“.', 'B liegt bei (-40, 180), C bei (-60, 40).'],
    solution: 'beim start\n  tempo 80\n  gehe zu 60, 100\n  gehe zu -40, 180\n  gehe zu -60, 40\nende\n',
    camera: { target: [0, 0.6, 1.0], dist: 3.8, yaw: 0.25, pitch: 0.7 },
  },

  /* ================= Kapitel 4: Automation ================= */
  {
    id: 'fabrik-band', chapter: 4, level: 3, title: 'Fließband-Fabrik', robot: 'arm',
    brief: 'Würfel kommen über das Band. Halte es an der Lichtschranke an und sortiere jeden Würfel in die Kiste seiner Farbe.',
    story: 'Echte Automation: Lichtschranke, Förderband, Farbsensor. Der Farbsensor sitzt im Greifer – fahre ihn über den Würfel, lies „farbe“ und merke sie dir in einer Variablen.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'band', x: -0.05, z: 0.45, l: 1.3, w: 0.18, h: 0.12, speed: 40, on: false, yaw: Math.PI },
      { type: 'spender', x: 0.48, z: 0.45, colors: ['rot', 'blau', 'blau', 'rot'], max: 4, interval: 2.5 },
      { type: 'lichtschranke', x: 0.05, z: 0.45, w: 0.28, h: 0.15, yaw: Math.PI / 2 },
      { type: 'kiste', x: -0.42, z: 0.05, color: 'rot', w: 0.2, d: 0.2 },
      { type: 'kiste', x: 0.4, z: 0.0, color: 'blau', w: 0.2, d: 0.2 },
    ],
    goals: [
      { text: 'Zwei rote Würfel in der roten Kiste', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'rot' && inside(zone(ctx, 'rot'), o) && free(o)).length >= 2 },
      { text: 'Zwei blaue Würfel in der blauen Kiste', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'blau' && inside(zone(ctx, 'blau'), o) && free(o)).length >= 2 },
      { text: 'Nichts ist vom Band gefallen', check: (ctx) => ctx.sim.objects.every((o) => o.body.translation().y > 0.05 || ctx.sim.entities.some((z) => z.kind === 'kiste' && z.contains(o.body.translation()))), keep: true },
    ],
    par: { time: 80, stmts: 10 },
    starter: 'beim start\n  band an\n  wiederhole 4 mal\n    warte bis lichtschranke unterbrochen\n    band aus\n    \n    band an\n  ende\nende\n',
    hints: ['Fahre den Greifer über die Lichtschranke: „bewege greifer zu -6, 30, 45“.', 'Merke dir die Farbe: „f = farbe“, dann „nimm f“ und „lege ab auf f“.'],
    solution: 'beim start\n  band an\n  wiederhole 4 mal\n    warte bis lichtschranke unterbrochen\n    warte 0.2\n    band aus\n    bewege greifer zu -6, 30, 45\n    f = farbe\n    sage f\n    nimm f\n    lege ab auf f\n    band an\n  ende\nende\n',
    camera: { target: [0, 0.3, 0.3], dist: 2.3, yaw: 0.6, pitch: 0.6 },
  },
  {
    id: 'team-staffel', chapter: 4, level: 3, title: 'Teamwork', robots: true, robot: 'rover',
    brief: 'Der Fahrroboter bringt den Würfel zum Arm. Sobald er geliefert hat, schickt er eine Nachricht – und der Arm stapelt ihn auf den blauen Würfel.',
    story: 'Zwei Roboter, zwei Programme. Wähle oben den Roboter aus, dessen Programm du bearbeiten willst. „sende …“ und „bei nachricht …“ verbinden die beiden.',
    robotDefs: [
      { config: { type: 'rover', greifer: 'zange', name: 'Flitzer' }, spawn: { x: 0.6, y: 0, z: -0.1, yaw: 0 }, code: 'beim start\n  nimm rot\n  lege ab auf grün\n  \nende\n' },
      { config: { type: 'arm', name: 'Greifi' }, spawn: { x: -0.55, y: 0, z: 0.9, yaw: Math.PI / 2 }, code: 'bei nachricht "geliefert"\n  \nende\n' },
    ],
    objects: [
      { type: 'würfel', x: 0.65, z: 1.0, color: 'rot', yaw: 0.3 },
      { type: 'zone', x: 0.0, z: 0.9, color: 'grün', w: 0.26, d: 0.26 },
      { type: 'würfel', x: -0.2, z: 1.25, color: 'blau' },
    ],
    goals: [
      { text: 'Der Würfel liegt in der grünen Übergabezone', check: (ctx) => ctx.flags.handover || (inside(zone(ctx, 'grün'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) && (ctx.flags.handover = true)), keep: true },
      { text: 'Eine Nachricht wurde gesendet', check: (ctx) => ctx.flags.message, keep: true },
      { text: 'Rot steht auf Blau', check: (ctx) => stackedOn(thing(ctx, 'rot'), thing(ctx, 'blau')) && free(thing(ctx, 'rot')) },
    ],
    par: { time: 22, stmts: 6 },
    hints: ['Im Programm des Fahrroboters fehlt am Ende: sende "geliefert".', 'Der Arm braucht in „bei nachricht“: „nimm rot“ und „lege ab auf blau“.'],
    solutions: ['beim start\n  nimm rot\n  lege ab auf grün\n  fahre 30 cm zurück\n  sende "geliefert"\nende\n', 'bei nachricht "geliefert"\n  nimm rot\n  lege ab auf blau\nende\n'],
    camera: { target: [0.05, 0.3, 0.7], dist: 2.9, yaw: 0.35, pitch: 0.75 },
  },
];

export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

// Anzahl der Anweisungen (für den dritten Stern)
export function countStatements(ast) {
  let n = 0;
  const walk = (list) => {
    for (const s of list) {
      if (s.type === 'comment') continue;
      n++;
      if (s.body) walk(s.body);
      if (s.branches) for (const b of s.branches) walk(b.body);
      if (s.els) walk(s.els);
    }
  };
  for (const it of ast.items) if (it.type !== 'ablage' && it.type !== 'func') walk(it.body);
  for (const it of ast.items) if (it.type === 'func') walk(it.body);
  return n;
}
