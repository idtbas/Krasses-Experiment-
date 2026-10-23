// Prüfaufträge der Testhalle: knappe Prüfvorschrift, automatische Prüfkriterien und Referenzlösung.
// Koordinaten der Welt in Metern (Three.js: x links, y hoch, z vor dem Ursprung).

export const CHAPTERS = [
  { id: 1, code: 'H', title: 'Handhabung', sub: 'Knickarm KX-5 · Greifen, Stapeln, Sortieren, Schwerlast, Wärmebild, Schutzfeld' },
  { id: 2, code: 'M', title: 'Mobile Robotik', sub: 'AMR-1 · Fahren, Andocken, Spurführung, LiDAR-Navigation, Radar, Dunkelheit' },
  { id: 3, code: 'U', title: 'Humanoide Robotik', sub: 'HX-2 · Gang, Teiletransport, Wegpunkte' },
  { id: 4, code: 'S', title: 'Systemintegration', sub: 'Mehrere Geräte · Übergabe und Funkstrecke' },
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
  // Fahrzeug: auch die Front zählt (dort sitzen die Sensoren)
  return r.type === 'rover' && z.contains({ x: f.p.x + Math.sin(f.yaw) * 0.16, y: f.p.y, z: f.p.z + Math.cos(f.yaw) * 0.16 });
};
const stopped = (r) => { const v = r.baseBody().linvel(); return Math.hypot(v.x, v.z) < 0.03; };
const joint = (r, n) => (r.servos.get(n) ? r.servos.get(n).display : 0);
const said = (ctx) => ctx.log.some((l) => l.kind === 'say');
const binOf = (ctx, color) => ctx.sim.entities.find((e) => e.kind === 'kiste' && e.color === color) || null;

function stackedOn(top, bottom) {
  if (!top || !bottom) return false;
  const a = top.body.translation(), b = bottom.body.translation();
  return Math.hypot(a.x - b.x, a.z - b.z) < 0.035 && a.y - b.y > (top.halfHeight + bottom.halfHeight) * 0.8 && a.y - b.y < (top.halfHeight + bottom.halfHeight) * 1.25;
}

/* ---------- Bausteine der Szenen ---------- */

const ARM_TABLE = [{ type: 'tisch', x: 0, z: 0.22, w: 1.3, d: 0.95, h: 0.4 }, { type: 'markierung', x: 0, z: 0.15, w: 2.4, d: 2.2, t: 0.05 }];
const armCam = { target: [0, 0.6, 0.28], dist: 2.0, yaw: 0.75, pitch: 0.5 };
const humCam = { target: [0, 0.8, 0.5], dist: 3.4, yaw: 0.6, pitch: 0.3 };

export const MISSIONS = [
  /* ================= H · Handhabung ================= */
  {
    id: 'arm-hallo', code: 'H-01', chapter: 1, level: 1, title: 'Inbetriebnahme', robot: 'arm',
    brief: 'Achse A1 auf 90° positionieren und Bereitschaft melden.',
    story: 'Erstinbetriebnahme des KX-5: Statusmeldung an den Leitstand ausgeben und die Basisachse A1 auf 90° fahren.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE],
    goals: [
      { text: 'Statusmeldung im Protokoll', check: (ctx) => said(ctx) },
      { text: 'A1 Basis = 90° ± 5°', check: (ctx) => Math.abs(joint(ctx.robot, 'basis') - 90) < 5 },
    ],
    par: { time: 4, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  sage "Bereit"\n  drehe basis auf 90\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-greifen', code: 'H-02', chapter: 1, level: 1, title: 'Greifen und Anheben', robot: 'arm',
    brief: 'Werkstück rot greifen und mindestens 15 cm über die Tischplatte anheben.',
    story: 'Kamerageführtes Greifen: Werkstück lokalisieren, greifen und um mindestens 15 cm anheben.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE, { type: 'würfel', x: -0.12, y: 0.43, z: 0.42, color: 'rot', yaw: 0.35 }],
    goals: [
      { text: 'Werkstück im Greifer', check: (ctx) => !!thing(ctx, 'rot')?.heldBy },
      { text: 'Hubhöhe ≥ 15 cm über Tisch', check: (ctx) => { const t = thing(ctx, 'rot'); return t && t.heldBy && t.body.translation().y > 0.4 + 0.15 + 0.03; } },
    ],
    par: { time: 9, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  nimm rot\n  bewege greifer um 0, 10, 0\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-zone', code: 'H-03', chapter: 1, level: 1, title: 'Pick & Place', robot: 'arm',
    brief: 'Werkstück gelb auf die Ablagefläche grün umsetzen.',
    story: 'Standard-Pick-&-Place: Werkstück gelb greifen, auf der Ablage grün absetzen, Greifer öffnen.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE, { type: 'würfel', x: 0.25, y: 0.43, z: 0.38, color: 'gelb', yaw: -0.3 }, { type: 'zone', x: -0.32, y: 0.4, z: 0.32, color: 'grün', w: 0.2, d: 0.2 }],
    goals: [
      { text: 'Werkstück liegt auf Ablage grün', check: (ctx) => inside(zone(ctx, 'grün'), thing(ctx, 'gelb')) && free(thing(ctx, 'gelb')) },
      { text: 'Greifer geöffnet', check: (ctx) => !ctx.robot.grippers.main.held },
    ],
    par: { time: 12, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  nimm gelb\n  lege ab auf grün\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-turm', code: 'H-04', chapter: 1, level: 2, title: 'Stapeln', robot: 'arm',
    brief: 'Drei Werkstücke stapeln: unten gelb, Mitte blau, oben rot.',
    story: 'Präzisionsstapelung mit Versatz ≤ 3,5 mm. Der Stapel muss ohne Halt stehen bleiben.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE,
      { type: 'würfel', x: 0.0, y: 0.43, z: 0.5, color: 'gelb' },
      { type: 'würfel', x: 0.3, y: 0.43, z: 0.3, color: 'blau', yaw: 0.6 },
      { type: 'würfel', x: -0.3, y: 0.43, z: 0.32, color: 'rot', yaw: -0.4 }],
    goals: [
      { text: 'Blau auf Gelb', check: (ctx) => stackedOn(thing(ctx, 'blau'), thing(ctx, 'gelb')) },
      { text: 'Rot auf Blau', check: (ctx) => stackedOn(thing(ctx, 'rot'), thing(ctx, 'blau')) },
      { text: 'Stapel steht frei', check: (ctx) => ['rot', 'blau', 'gelb'].every((c) => free(thing(ctx, c)) && resting(thing(ctx, c))) && stackedOn(thing(ctx, 'rot'), thing(ctx, 'blau')) },
    ],
    par: { time: 26, stmts: 4 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  nimm blau\n  lege ab auf gelb\n  nimm rot\n  lege ab auf blau\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-sortieren', code: 'H-05', chapter: 1, level: 2, title: 'Farbsortierung', robot: 'arm',
    brief: 'Alle Werkstücke auf die Ablage ihrer Farbe sortieren – mit einer Schleife.',
    story: 'Vier Werkstücke, zwei Ablagen. Bereits richtig liegende Teile werden von der Bilderkennung übersprungen.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE,
      { type: 'würfel', x: -0.1, y: 0.43, z: 0.5, color: 'rot', yaw: 0.2 },
      { type: 'würfel', x: 0.1, y: 0.43, z: 0.5, color: 'blau', yaw: -0.5 },
      { type: 'würfel', x: -0.05, y: 0.43, z: 0.32, color: 'blau' },
      { type: 'würfel', x: 0.16, y: 0.43, z: 0.34, color: 'rot', yaw: 0.8 },
      { type: 'zone', x: -0.4, y: 0.4, z: 0.25, color: 'rot', w: 0.2, d: 0.26 },
      { type: 'zone', x: 0.42, y: 0.4, z: 0.25, color: 'blau', w: 0.2, d: 0.26 }],
    goals: [
      { text: 'Beide roten Teile auf Ablage rot', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'rot').every((t) => inside(zone(ctx, 'rot'), t) && free(t)) },
      { text: 'Beide blauen Teile auf Ablage blau', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'blau').every((t) => inside(zone(ctx, 'blau'), t) && free(t)) },
    ],
    par: { time: 50, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  für jedes f in [rot, blau, rot, blau]\n    nimm f\n    lege ab auf f\n  ende\nende\n',
    camera: armCam,
  },
  {
    id: 'arm-schwer', code: 'H-06', chapter: 1, level: 3, title: 'Schwerlast', robot: 'arm',
    brief: 'Drei Stahlblöcke (je 2,7 kg) in den KLT umsetzen – ohne Absturz und ohne Übertemperatur.',
    story: 'Die Zelle ist mit DC-Getriebeservos bestückt. Antriebe auf die Dauerlast auslegen: Keine Achse darf 60 °C überschreiten, kein Teil darf abrutschen. Temperaturen zeigt der Gerätemonitor.',
    robotDef: { config: { type: 'arm', antrieb: { achsen: 'servo', hand: 'servo' } }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE,
      { type: 'würfel', x: 0.22, y: 0.44, z: 0.5, color: 'grau', material: 'stahl', size: 0.07, yaw: 0.3 },
      { type: 'würfel', x: 0.34, y: 0.44, z: 0.32, color: 'grau', material: 'stahl', size: 0.07, yaw: -0.2 },
      { type: 'würfel', x: 0.06, y: 0.44, z: 0.56, color: 'grau', material: 'stahl', size: 0.07 },
      { type: 'kiste', x: -0.4, y: 0.4, z: 0.3, color: 'orange', w: 0.3, d: 0.3, h: 0.08 }],
    goals: [
      { text: 'Alle drei Blöcke im KLT orange', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'grau').every((t) => inside(zone(ctx, 'orange'), t) && free(t)) },
      { text: 'Kein Teil abgerutscht', check: (ctx) => !ctx.flags.slipped },
      { text: 'Alle Achsen < 60 °C', check: (ctx) => !ctx.flags.hot },
    ],
    par: { time: 45, stmts: 4 },
    budget: 12500,
    starter: 'beim start\n  wiederhole 3 mal\n    nimm grau\n    lege ab auf orange\n  ende\nende\n',
    solution: 'beim start\n  tempo 55\n  greifkraft 100\n  wiederhole 3 mal\n    nimm grau\n    lege ab auf orange\n  ende\nende\n',
    solutionConfig: { antrieb: { achsen: 'bldc', hand: 'bldc' } },
    camera: armCam,
    setup: (ctx) => {
      ctx.onWarn = (m) => { if (/rutscht|gerutscht/i.test(m)) ctx.flags.slipped = true; };
      ctx.tick = () => { for (const s of ctx.robot.servos.values()) if (!s.hidden && s.temp > 60) ctx.flags.hot = true; };
    },
  },
  {
    id: 'fabrik-band', code: 'H-07', chapter: 1, level: 3, title: 'Bandkommissionierung', robot: 'arm',
    brief: 'Werkstücke vom Förderband an der Lichtschranke abgreifen und nach Farbe in die KLT sortieren.',
    story: 'Band an der Lichtschranke stoppen, Farbe mit dem Farbsensor im Greifer bestimmen, in den passenden KLT legen, Band wieder starten.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'band', x: -0.05, z: 0.45, l: 1.3, w: 0.18, h: 0.12, speed: 40, on: false, yaw: Math.PI },
      { type: 'spender', x: 0.48, z: 0.45, colors: ['rot', 'blau', 'blau', 'rot'], max: 4, interval: 2.5 },
      { type: 'lichtschranke', x: 0.05, z: 0.45, w: 0.28, h: 0.15, yaw: Math.PI / 2 },
      { type: 'kiste', x: -0.42, z: 0.05, color: 'rot', w: 0.2, d: 0.2 },
      { type: 'kiste', x: 0.4, z: 0.0, color: 'blau', w: 0.2, d: 0.2 },
      { type: 'markierung', x: 0, z: 0.2, w: 2.0, d: 1.6, t: 0.05 },
    ],
    goals: [
      { text: 'Zwei rote Teile im KLT rot', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'rot' && inside(zone(ctx, 'rot'), o) && free(o)).length >= 2 },
      { text: 'Zwei blaue Teile im KLT blau', check: (ctx) => ctx.sim.objects.filter((o) => o.color === 'blau' && inside(zone(ctx, 'blau'), o) && free(o)).length >= 2 },
      { text: 'Kein Teil vom Band gefallen', check: (ctx) => ctx.sim.objects.every((o) => o.body.translation().y > 0.05 || ctx.sim.entities.some((z) => z.kind === 'kiste' && z.contains(o.body.translation()))) },
    ],
    par: { time: 80, stmts: 10 },
    starter: 'beim start\n  band an\n  wiederhole 4 mal\n    warte bis lichtschranke unterbrochen\n    band aus\n    \n    band an\n  ende\nende\n',
    solution: 'beim start\n  band an\n  wiederhole 4 mal\n    warte bis lichtschranke unterbrochen\n    warte 0.2\n    band aus\n    bewege greifer zu -6, 30, 45\n    f = farbe\n    sage f\n    nimm f\n    lege ab auf f\n    band an\n  ende\nende\n',
    camera: { target: [0, 0.3, 0.3], dist: 2.3, yaw: 0.6, pitch: 0.6 },
  },
  {
    id: 'arm-waerme', code: 'H-08', chapter: 1, level: 2, title: 'Wärmeprüfung', robot: 'arm',
    brief: 'Das überhitzte Lagergehäuse erkennen und aussortieren, die übrigen in den Gut-KLT legen.',
    story: 'Vier optisch identische Lagergehäuse, eines davon zu heiß. Mit einer Wärmebildkamera nachrüsten: Ausschuss in KLT rot, Gutteile in KLT grün.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0.4, z: 0, yaw: 0 } },
    objects: [...ARM_TABLE,
      { type: 'würfel', x: 0.18, y: 0.43, z: 0.45, color: 'grau', material: 'alu', temp: 24 },
      { type: 'würfel', x: -0.02, y: 0.43, z: 0.52, color: 'grau', material: 'alu', temp: 25 },
      { type: 'würfel', x: 0.3, y: 0.43, z: 0.28, color: 'grau', material: 'alu', temp: 78, name: 'heiss' },
      { type: 'würfel', x: -0.1, y: 0.43, z: 0.34, color: 'grau', material: 'alu', temp: 23 },
      { type: 'kiste', x: -0.42, y: 0.4, z: 0.42, color: 'rot', w: 0.2, d: 0.2 },
      { type: 'kiste', x: -0.42, y: 0.4, z: 0.12, color: 'grün', w: 0.22, d: 0.22 }],
    goals: [
      { text: 'Heißes Teil im KLT rot', check: (ctx) => { const t = ctx.sim.objects.find((o) => o.name === 'heiss'); return t && inside(binOf(ctx, 'rot'), t) && free(t); } },
      { text: 'Drei Gutteile im KLT grün', check: (ctx) => ctx.sim.objects.filter((o) => o.name !== 'heiss' && inside(binOf(ctx, 'grün'), o) && free(o)).length === 3 },
      { text: 'Kein Gutteil im Ausschuss', check: (ctx) => !ctx.sim.objects.some((o) => o.name !== 'heiss' && inside(binOf(ctx, 'rot'), o)) },
    ],
    par: { time: 45, stmts: 5 },
    budget: 15000,
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  nimm wärmstes teil\n  lege ab auf rot\n  wiederhole 3 mal\n    nimm grau\n    lege ab auf grün\n  ende\nende\n',
    solutionConfig: { module: ['ultraschall', 'farbsensor', 'kamera', 'kontakt', 'waermebild'] },
    camera: armCam,
  },
  {
    id: 'arm-schutzfeld', code: 'H-09', chapter: 1, level: 3, title: 'Schutzfeld', robot: 'arm',
    brief: 'Drei Teile umsetzen, während eine Person die Zelle betritt: sicherer Halt und Signalisierung.',
    story: 'Ein Personen-Dummy betritt nach einigen Sekunden die Zelle. Sicherheitslaserscanner und Signalsäule nachrüsten: Der Arm muss im Schutzfeld stillstehen, die Säule rot zeigen und danach selbstständig weiterarbeiten.',
    robotDef: { config: { type: 'arm' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'tisch', x: 0, z: 0.46, w: 0.9, d: 0.42, h: 0.18 },
      { type: 'würfel', x: 0.22, y: 0.21, z: 0.44, color: 'rot', yaw: 0.2 },
      { type: 'würfel', x: 0.05, y: 0.21, z: 0.5, color: 'blau' },
      { type: 'würfel', x: -0.1, y: 0.21, z: 0.42, color: 'gelb', yaw: -0.3 },
      { type: 'zone', x: -0.3, y: 0.18, z: 0.46, color: 'grün', w: 0.2, d: 0.26 },
      { type: 'markierung', x: 0, z: 0, w: 2.0, d: 2.0, t: 0.06 },
      { type: 'dummy', x: -2.6, z: 0.3, route: [[0, -2.6, 0.3], [6, -2.6, 0.3], [8, -0.75, 0.25], [13, -0.75, 0.25], [15, -2.6, 0.3]] },
    ],
    goals: [
      { text: 'Alle Teile auf Ablage grün', check: (ctx) => ['rot', 'blau', 'gelb'].every((c) => inside(zone(ctx, 'grün'), thing(ctx, c)) && free(thing(ctx, c))) },
      { text: 'Stillstand bei Zutritt', check: (ctx) => ctx.flags.entered && !ctx.flags.movedInField },
      { text: 'Signalsäule rot bei Zutritt', check: (ctx) => ctx.flags.redShown && !ctx.flags.notRed },
    ],
    par: { time: 40, stmts: 8 },
    starter: 'beim start\n  für jedes f in [rot, blau, gelb]\n    nimm f\n    lege ab auf grün\n  ende\nende\n',
    solution: 'beim start\n  signalsäule grün\n  für jedes f in [rot, blau, gelb]\n    nimm f\n    lege ab auf grün\n  ende\nende\n\nsobald schutzfeld verletzt\n  signalsäule rot\n  warte bis nicht schutzfeld verletzt\n  signalsäule grün\nende\n',
    solutionConfig: { module: ['ultraschall', 'farbsensor', 'kamera', 'kontakt', 'sicherheitsscanner', 'signalsaeule'] },
    camera: { target: [-0.5, 0.4, 0.3], dist: 3.2, yaw: 0.35, pitch: 0.5 },
    setup: (ctx) => {
      ctx.tick = () => {
        const d = ctx.sim.ofKind('dummy')[0];
        const r = ctx.robot;
        if (!d || !r) return;
        const inField = Math.hypot(d.pos.x - r.spawn.x, d.pos.z - r.spawn.z) < 1.0;
        if (inField) {
          ctx.flags.entered = true;
          ctx.inT = (ctx.inT || 0) + ctx.dt;
          if (ctx.inT > 0.5) {
            const v = r.handPart.body.linvel();
            if (Math.hypot(v.x, v.y, v.z) > 0.05) ctx.flags.movedInField = true;
            if (r.stack === 'rot') ctx.flags.redShown = true;
            if (ctx.inT > 1.2 && r.stack !== 'rot') ctx.flags.notRed = true;
          }
        } else ctx.inT = 0;
      };
    },
  },

  /* ================= M · Mobile Robotik ================= */
  {
    id: 'rover-flagge', code: 'M-01', chapter: 2, level: 1, title: 'Zielanfahrt', robot: 'rover',
    brief: 'Zielmarke in 1,5 m Entfernung anfahren und im Zielkreis halten.',
    story: 'Geradeausfahrt über 1,5 m mit Positioniergenauigkeit im Zielkreis (Ø 36 cm).',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [{ type: 'ziel', x: 0, z: 1.5, color: 'orange', r: 0.18, label: 'ZIEL 0 / 150' }],
    goals: [
      { text: 'Im Zielkreis angehalten', check: (ctx) => robotIn(zone(ctx, 'orange'), ctx.robot) && stopped(ctx.robot) },
    ],
    par: { time: 5, stmts: 1 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  fahre 150 cm vor\nende\n',
    camera: { target: [0, 0.2, 0.8], dist: 2.8, yaw: 0.9, pitch: 0.55 },
    follow: true,
  },
  {
    id: 'rover-garage', code: 'M-02', chapter: 2, level: 1, title: 'Andocken', robot: 'rover',
    brief: 'Um die Ecke an die Ladestation andocken, ohne Wandkontakt.',
    story: 'Fahrweg: 100 cm geradeaus, Rechtsdrehung, dann in die Ladebucht. Kontakt mit den Begrenzungen ist unzulässig.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'zone', x: -0.8, z: 1.0, color: 'blau', w: 0.42, d: 0.46 },
      { type: 'ladestation', x: -0.8, z: 1.0, d: 0.42, yaw: Math.PI / 2 },
      { type: 'wand', x: -0.8, z: 1.275, w: 0.5, h: 0.2, d: 0.03, color: 'grau' },
      { type: 'wand', x: -0.8, z: 0.725, w: 0.5, h: 0.2, d: 0.03, color: 'grau' },
      { type: 'wand', x: -1.08, z: 1.0, w: 0.58, h: 0.2, d: 0.03, color: 'grau', yaw: Math.PI / 2 },
      { type: 'wand', x: 0.4, z: 0.6, w: 0.03, h: 0.2, d: 1.2, color: 'grau' },
    ],
    goals: [
      { text: 'In der Ladebucht angehalten', check: (ctx) => robotIn(zone(ctx, 'blau'), ctx.robot) && stopped(ctx.robot) },
      { text: 'Kein Wandkontakt', check: (ctx) => !ctx.flags.bump },
    ],
    par: { time: 9, stmts: 3 },
    starter: 'beim start\n  fahre 100 cm vor\n  \nende\n',
    solution: 'beim start\n  fahre 100 cm vor\n  drehe dich um 90 nach rechts\n  fahre 80 cm vor\nende\n',
    camera: { target: [-0.4, 0.2, 0.7], dist: 2.8, yaw: 0.2, pitch: 0.7 },
    setup: (ctx) => { ctx.watchBump = true; },
  },
  {
    id: 'rover-bremse', code: 'M-03', chapter: 2, level: 2, title: 'Kollisionsvermeidung', robot: 'rover',
    brief: 'Auf ein Hindernis unbekannter Lage zufahren und 15–25 cm davor halten.',
    story: 'Die Lage der Wand variiert bei jedem Lauf. Mit dem Abstandssensor sensorgeführt anhalten – berührungsfrei.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [{ type: 'wand', x: 0, z: 1.85, w: 1.0, h: 0.3, d: 0.05, color: 'rot' }],
    randomize: (spec, rnd) => { if (spec.type === 'wand') spec.z = 1.4 + rnd() * 0.9; },
    goals: [
      { text: 'Halt 15–25 cm vor der Wand', check: (ctx) => { const w = ctx.sim.ofKind('wand')[0]; const p = ctx.robot.frame().p; const gap = w.spec.z - 0.025 - (p.z + 0.18); return gap > 0.15 && gap < 0.25 && stopped(ctx.robot); } },
      { text: 'Kein Kontakt', check: (ctx) => !ctx.flags.bump },
    ],
    par: { time: 6, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  fahre los\n  warte bis abstand < 20\n  stopp\nende\n',
    camera: { target: [0, 0.2, 1.0], dist: 2.9, yaw: 1.2, pitch: 0.45 },
    setup: (ctx) => { ctx.watchBump = true; },
  },
  {
    id: 'rover-linie', code: 'M-04', chapter: 2, level: 2, title: 'Spurführung', robot: 'rover',
    brief: 'Der Bodenspur bis in den Zielbereich grün folgen und dort halten.',
    story: 'Optische Spurführung mit zwei Reflexlichttastern: Abweichung links/rechts korrigieren, im Zielbereich stoppen.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'linie', points: [[0, -0.1], [0, 0.6], [-0.15, 0.95], [-0.45, 1.2], [-0.8, 1.3], [-1.1, 1.55], [-1.2, 1.95], [-1.05, 2.3], [-0.7, 2.45]] },
      { type: 'zone', x: -0.62, z: 2.5, color: 'grün', w: 0.36, d: 0.36 },
    ],
    goals: [
      { text: 'Zielbereich erreicht', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robot) },
      { text: 'Im Zielbereich angehalten', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robot) && stopped(ctx.robot) },
    ],
    par: { time: 20, stmts: 9 },
    starter: 'beim start\n  wiederhole immer\n    wenn linie links dann\n      setze motoren auf 5, 40\n    sonst\n      setze motoren auf 35, 35\n    ende\n  ende\nende\n',
    solution: 'beim start\n  wiederhole immer\n    wenn linie links dann\n      setze motoren auf 5, 40\n    sonst wenn linie rechts dann\n      setze motoren auf 40, 5\n    sonst\n      setze motoren auf 35, 35\n    ende\n  ende\nende\n\nsobald farbe == grün\n  stopp\n  stoppe alles\nende\n',
    camera: { target: [-0.6, 0.2, 1.2], dist: 3.2, yaw: 0.3, pitch: 0.85 },
  },
  {
    id: 'rover-liefern', code: 'M-05', chapter: 2, level: 2, title: 'Transportauftrag', robot: 'rover',
    brief: 'Werkstücke rot und gelb mit dem Frontgreifer aufnehmen und auf Ablage blau abliefern.',
    story: 'Kamerageführte Aufnahme mit dem Frontgreifer FG-2 und Ablieferung auf der Bereitstellfläche.',
    robotDef: { config: { type: 'rover', werkzeug: 'frontgreifer' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'würfel', x: 0.5, z: 0.9, color: 'rot', yaw: 0.4 },
      { type: 'würfel', x: -0.4, z: 1.3, color: 'gelb', yaw: -0.2 },
      { type: 'zone', x: 0, z: -0.6, color: 'blau', w: 0.4, d: 0.4 },
    ],
    goals: [
      { text: 'Rot auf Ablage blau', check: (ctx) => inside(zone(ctx, 'blau'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) },
      { text: 'Gelb auf Ablage blau', check: (ctx) => inside(zone(ctx, 'blau'), thing(ctx, 'gelb')) && free(thing(ctx, 'gelb')) },
    ],
    par: { time: 35, stmts: 4 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  nimm rot\n  lege ab auf blau\n  nimm gelb\n  lege ab auf blau\nende\n',
    camera: { target: [0, 0.2, 0.4], dist: 3.3, yaw: 0.7, pitch: 0.75 },
  },
  {
    id: 'rover-nav', code: 'M-06', chapter: 2, level: 2, title: 'LiDAR-Navigation', robot: 'rover',
    brief: 'Durch ein unbekanntes Hindernisfeld zur Zielmarke navigieren – ohne Kontakt.',
    story: 'Gitterboxen, Kartons und Pylone stehen bei jedem Lauf etwas anders. Mit dem 2D-LiDAR und „navigiere zu“ den Weg selbst finden lassen.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'hindernis', variant: 'gitterbox', x: 0.05, z: 1.0 },
      { type: 'hindernis', variant: 'karton', x: -0.75, z: 1.7 },
      { type: 'hindernis', variant: 'karton', x: 0.55, z: 2.0, yaw: 0.4 },
      { type: 'hindernis', variant: 'pylon', x: -0.1, z: 2.55 },
      { type: 'hindernis', variant: 'gitterbox', x: -0.9, z: 0.6, yaw: 0.2 },
      { type: 'ziel', x: -0.4, z: 3.3, color: 'grün', r: 0.22, label: 'ZIEL 40 / 330' },
      { type: 'markierung', x: -0.2, z: 1.65, w: 2.6, d: 4.3, t: 0.05 },
    ],
    randomize: (spec, rnd) => { if (spec.type === 'hindernis') { spec.x += (rnd() - 0.5) * 0.2; spec.z += (rnd() - 0.5) * 0.2; } },
    goals: [
      { text: 'Zielmarke erreicht', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robot) && stopped(ctx.robot) },
      { text: 'Kein Kontakt mit Hindernissen', check: (ctx) => !ctx.flags.bump },
    ],
    par: { time: 16, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  tempo 80\n  navigiere zu 40, 330\nende\n',
    camera: { target: [-0.2, 0.3, 1.6], dist: 4.2, yaw: 0.5, pitch: 0.75 },
    setup: (ctx) => { ctx.watchBump = true; },
  },
  {
    id: 'rover-radar', code: 'M-07', chapter: 2, level: 3, title: 'Querverkehr', robot: 'rover',
    brief: 'Einen befahrenen Fahrweg kreuzen, ohne den Routenzug zu behindern.',
    story: 'Ein fahrerloser Routenzug pendelt auf dem Querweg. Mit einem Radar nachrüsten und die Lücke abpassen: Der Zug darf nicht bremsen müssen. Für das Budget nicht benötigte Sensorik abrüsten.',
    robotDef: { config: { type: 'rover' }, spawn: { x: 0, y: 0, z: -0.6, yaw: 0 } },
    objects: [
      { type: 'markierung', x: 0, z: 1.2, w: 8, d: 1.0, t: 0.06 },
      { type: 'fahrzeug', x: -3.4, z: 1.2, path: [[-3.4, 1.2], [3.4, 1.2]], speed: 1.1, pause: 0.4, s0: 1.2 },
      { type: 'zone', x: 0, z: 2.3, color: 'grün', w: 0.5, d: 0.45 },
    ],
    goals: [
      { text: 'Zielfläche grün erreicht', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robot) && stopped(ctx.robot) },
      { text: 'Kein Kontakt mit dem Routenzug', check: (ctx) => !ctx.flags.bump },
      { text: 'Routenzug musste nicht bremsen', check: (ctx) => { const v = ctx.sim.ofKind('fahrzeug')[0]; return v && v.brakes === 0; } },
    ],
    par: { time: 14, stmts: 4 },
    budget: 9500,
    starter: 'beim start\n  fahre 290 cm vor\nende\n',
    solution: 'beim start\n  tempo 100\n  warte bis radar annäherung\n  warte bis nicht radar annäherung\n  fahre 290 cm vor\nende\n',
    solutionConfig: { module: ['ultraschall', 'farbsensor', 'linie', 'kontakt', 'lidar2d', 'radar'] },
    camera: { target: [0, 0.3, 1.0], dist: 5.2, yaw: 0.25, pitch: 0.55 },
    setup: (ctx) => { ctx.watchBump = true; },
  },
  {
    id: 'rover-dunkel', code: 'M-08', chapter: 2, level: 2, title: 'Dunkelhalle', robot: 'rover',
    brief: 'Bei ausgeschalteter Hallenbeleuchtung ein Werkstück holen und abliefern.',
    story: 'Die Farbkamera erkennt ohne Licht nichts. Einen LED-Scheinwerfer nachrüsten und einschalten, dann Werkstück rot auf Ablage blau bringen.',
    robotDef: { config: { type: 'rover', werkzeug: 'frontgreifer' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    env: { licht: 0.04 },
    objects: [
      { type: 'würfel', x: -0.25, z: 1.25, color: 'rot', yaw: 0.3 },
      { type: 'zone', x: 0.7, z: 0.3, color: 'blau', w: 0.4, d: 0.4 },
    ],
    goals: [
      { text: 'Werkstück rot auf Ablage blau', check: (ctx) => inside(zone(ctx, 'blau'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) },
    ],
    par: { time: 25, stmts: 3 },
    starter: 'beim start\n  nimm rot\n  lege ab auf blau\nende\n',
    solution: 'beim start\n  scheinwerfer an\n  nimm rot\n  lege ab auf blau\nende\n',
    solutionConfig: { module: ['ultraschall', 'farbsensor', 'linie', 'kontakt', 'kamera', 'lidar2d', 'scheinwerfer'] },
    camera: { target: [0.2, 0.2, 0.7], dist: 3.0, yaw: 0.6, pitch: 0.7 },
  },

  /* ================= U · Humanoide Robotik ================= */
  {
    id: 'hum-schritte', code: 'U-01', chapter: 3, level: 1, title: 'Gangtest', robot: 'humanoid',
    brief: 'Zur Zielmarke gehen, um 180° wenden und quittieren.',
    story: 'Dynamischer Zweibeingang über 1,2 m, Wende auf der Stelle und Quittiergeste mit der rechten Hand.',
    robotDef: { config: { type: 'humanoid' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [{ type: 'ziel', x: 0, z: 1.2, color: 'orange', r: 0.22, label: 'ZIEL 0 / 120' }],
    goals: [
      { text: 'Steht an der Zielmarke', check: (ctx) => robotIn(zone(ctx, 'orange'), ctx.robot) },
      { text: 'Blickrichtung Start (180°)', check: (ctx) => robotIn(zone(ctx, 'orange'), ctx.robot) && Math.cos(ctx.robot.frame().yaw) < -0.85 },
      { text: 'Quittiergeste ausgeführt', check: (ctx) => ctx.flags.cmd_winke, keep: true },
    ],
    par: { time: 16, stmts: 3 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  gehe 120 cm vor\n  drehe dich um 180 nach links\n  winke\nende\n',
    camera: humCam,
    follow: true,
  },
  {
    id: 'hum-kellner', code: 'U-02', chapter: 3, level: 2, title: 'Teiletransport', robot: 'humanoid',
    brief: 'Werkstück vom Arbeitstisch holen und am zweiten Tisch auf der Ablage absetzen.',
    story: 'Der HX-2 lokalisiert das Teil per Kamera, geht selbst hin, greift mit der rechten Hand und legt es am Zieltisch ab.',
    robotDef: { config: { type: 'humanoid' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'tisch', x: 0.2, z: 1.0, w: 0.6, d: 0.45, h: 0.62 },
      { type: 'tisch', x: -1.1, z: 0.2, w: 0.6, d: 0.45, h: 0.62, yaw: Math.PI / 2 },
      { type: 'würfel', x: 0.22, y: 0.65, z: 0.92, color: 'rot', yaw: 0.3 },
      { type: 'zone', x: -1.1, y: 0.62, z: 0.2, color: 'grün', w: 0.22, d: 0.22 },
    ],
    goals: [
      { text: 'Werkstück gegriffen', check: (ctx) => ctx.flags.grabbed, keep: true },
      { text: 'Werkstück auf Ablage grün', check: (ctx) => inside(zone(ctx, 'grün'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) },
    ],
    par: { time: 40, stmts: 2 },
    starter: 'beim start\n  \nende\n',
    solution: 'beim start\n  tempo 70\n  nimm rot\n  lege ab auf grün\nende\n',
    camera: { target: [-0.4, 0.7, 0.6], dist: 3.4, yaw: 0.9, pitch: 0.42 },
    setup: (ctx) => { ctx.onGrip = (what) => { if (what === 'greift') ctx.flags.grabbed = true; }; },
  },
  {
    id: 'hum-parcours', code: 'U-03', chapter: 3, level: 2, title: 'Wegpunktfolge', robot: 'humanoid',
    brief: 'Die Wegpunkte A, B und C in dieser Reihenfolge anlaufen.',
    story: 'Koordinaten in cm an den Zielmarken (x nach rechts, z nach vorn). Die Wegpunkte werden nacheinander mit „gehe zu“ angelaufen.',
    robotDef: { config: { type: 'humanoid' }, spawn: { x: 0, y: 0, z: 0, yaw: 0 } },
    objects: [
      { type: 'ziel', x: -0.6, z: 1.0, color: 'blau', r: 0.2, label: 'A  60 / 100' },
      { type: 'ziel', x: 0.4, z: 1.8, color: 'gelb', r: 0.2, label: 'B  −40 / 180' },
      { type: 'ziel', x: 0.6, z: 0.4, color: 'grün', r: 0.2, label: 'C  −60 / 40' },
      { type: 'wand', x: -0.05, z: 0.82, w: 0.04, h: 0.35, d: 0.5, color: 'grau' },
    ],
    goals: [
      { text: 'Wegpunkt A', check: (ctx) => ctx.flags.a || (robotIn(zone(ctx, 'blau'), ctx.robot) && (ctx.flags.a = true)), keep: true },
      { text: 'danach Wegpunkt B', check: (ctx) => ctx.flags.b || (ctx.flags.a && robotIn(zone(ctx, 'gelb'), ctx.robot) && (ctx.flags.b = true)), keep: true },
      { text: 'zuletzt Wegpunkt C', check: (ctx) => ctx.flags.b && robotIn(zone(ctx, 'grün'), ctx.robot) },
    ],
    par: { time: 40, stmts: 3 },
    starter: 'beim start\n  gehe zu 60, 100\nende\n',
    solution: 'beim start\n  tempo 80\n  gehe zu 60, 100\n  gehe zu -40, 180\n  gehe zu -60, 40\nende\n',
    camera: { target: [0, 0.6, 1.0], dist: 3.8, yaw: 0.25, pitch: 0.7 },
  },

  /* ================= S · Systemintegration ================= */
  {
    id: 'team-staffel', code: 'S-01', chapter: 4, level: 3, title: 'Übergabe AMR → Knickarm', robots: true, robot: 'rover',
    brief: 'Die Plattform liefert ein Teil an die Übergabestelle; nach Funkmeldung stapelt der Arm es auf Werkstück blau.',
    story: 'Zwei Geräte, zwei Abläufe. Oben das Gerät wählen. „sende …“ und „bei nachricht …“ koppeln die Abläufe über Funk.',
    robotDefs: [
      { config: { type: 'rover', werkzeug: 'frontgreifer' }, spawn: { x: 0.6, y: 0, z: -0.1, yaw: 0 }, code: 'beim start\n  nimm rot\n  lege ab auf grün\n  \nende\n' },
      { config: { type: 'arm' }, spawn: { x: -0.55, y: 0, z: 0.9, yaw: Math.PI / 2 }, code: 'bei nachricht "geliefert"\n  \nende\n' },
    ],
    objects: [
      { type: 'würfel', x: 0.65, z: 1.0, color: 'rot', yaw: 0.3 },
      { type: 'zone', x: 0.0, z: 0.9, color: 'grün', w: 0.26, d: 0.26 },
      { type: 'würfel', x: -0.2, z: 1.25, color: 'blau' },
    ],
    goals: [
      { text: 'Teil an der Übergabestelle', check: (ctx) => ctx.flags.handover || (inside(zone(ctx, 'grün'), thing(ctx, 'rot')) && free(thing(ctx, 'rot')) && (ctx.flags.handover = true)), keep: true },
      { text: 'Funkmeldung gesendet', check: (ctx) => ctx.flags.message, keep: true },
      { text: 'Rot auf Blau gestapelt', check: (ctx) => stackedOn(thing(ctx, 'rot'), thing(ctx, 'blau')) && free(thing(ctx, 'rot')) },
    ],
    par: { time: 22, stmts: 6 },
    solutions: ['beim start\n  nimm rot\n  lege ab auf grün\n  fahre 30 cm zurück\n  sende "geliefert"\nende\n', 'bei nachricht "geliefert"\n  nimm rot\n  lege ab auf blau\nende\n'],
    camera: { target: [0.05, 0.3, 0.7], dist: 2.9, yaw: 0.35, pitch: 0.75 },
  },
  {
    id: 'funk-strecke', code: 'S-02', chapter: 4, level: 3, title: 'Funkstrecke', robots: true, robot: 'arm',
    brief: 'Fahrauftrag über drei Stahlbetonwände an die Plattform übertragen und quittieren lassen.',
    story: 'Der Arm sendet „auftrag“, die Plattform fährt in die Zielfläche. Mit WLAN reicht der Pegel durch die Wände nicht – Funktechnik bzw. Antennen auslegen.',
    robotDefs: [
      { config: { type: 'arm' }, spawn: { x: 3.0, y: 0, z: 0, yaw: -Math.PI / 2 }, code: 'beim start\n  sende "auftrag" und warte\n  drehe basis auf 90\nende\n' },
      { config: { type: 'rover' }, spawn: { x: -4.0, y: 0, z: -0.6, yaw: 0 }, code: 'bei nachricht "auftrag"\n  fahre 120 cm vor\nende\n' },
    ],
    objects: [
      { type: 'wand', x: 1.6, z: 0, w: 0.2, h: 2.4, d: 6, material: 'stahlbeton' },
      { type: 'wand', x: -0.4, z: 0, w: 0.2, h: 2.4, d: 6, material: 'stahlbeton' },
      { type: 'wand', x: -2.4, z: 0, w: 0.2, h: 2.4, d: 6, material: 'stahlbeton' },
      { type: 'zone', x: -4.0, z: 0.6, color: 'grün', w: 0.5, d: 0.5 },
      { type: 'markierung', x: -4.0, z: 0, w: 1.6, d: 2.4, t: 0.05 },
      { type: 'markierung', x: 3.0, z: 0, w: 1.6, d: 1.6, t: 0.05 },
    ],
    goals: [
      { text: 'Plattform in Zielfläche grün', check: (ctx) => robotIn(zone(ctx, 'grün'), ctx.robots[1]) && stopped(ctx.robots[1]) },
      { text: 'Quittierung: A1 Basis = 90°', check: (ctx) => Math.abs(joint(ctx.robots[0], 'basis') - 90) < 5 },
    ],
    par: { time: 8, stmts: 4 },
    solutions: ['beim start\n  sende "auftrag" und warte\n  drehe basis auf 90\nende\n', 'bei nachricht "auftrag"\n  fahre 120 cm vor\nende\n'],
    solutionConfigs: [{ funk: 'funk868', antenne: 'rundstrahl' }, { funk: 'funk868', antenne: 'rundstrahl' }],
    camera: { target: [-0.5, 0.6, 0], dist: 8.5, yaw: 0.0, pitch: 0.85 },
  },
];

export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

// Anzahl der Anweisungen (für die Effizienzbewertung)
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
