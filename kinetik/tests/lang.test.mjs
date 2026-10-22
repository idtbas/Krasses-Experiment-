// Tests für Klartext: node kinetik/tests/lang.test.mjs
import assert from 'node:assert/strict';
import { parse } from '../js/lang/parser.js';
import { format } from '../js/lang/format.js';
import { Runtime, checkProgram, show } from '../js/lang/interp.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error('✗', name, '\n ', e.message); }
}

// Syntaxbaum ohne ids/Zeilen vergleichen
function strip(n) {
  if (Array.isArray(n)) return n.map(strip);
  if (n && typeof n === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(n)) {
      if (k === 'id' || k === 'line' || k === 'elsLine' || k === 'p') continue;
      o[k] = strip(v);
    }
    return o;
  }
  return n;
}

function roundtrip(src) {
  const a = parse(src);
  const t1 = format(a).text;
  const b = parse(t1);
  const t2 = format(b).text;
  assert.deepEqual(strip(b), strip(a), 'AST nach Rundreise verschieden:\n' + t1);
  assert.equal(t2, t1, 'Formatierung nicht stabil');
  return t1;
}

const SAMPLE = `# Würfel greifen
beim start
  tempo 60 %
  greifkraft 80
  lass los
  bewege greifer zu 0, 20, 45
  bewege greifer zu 0, 3, 45   # runter
  greife
  wenn hält etwas dann
    sage "Hab ihn!"
    leuchte grün
  sonst wenn abstand < 10 dann
    sage "Fast"
  sonst
    leuchte rot
  ende

  drehe basis um -90
  warte 500 ms
  lege ab auf grün
ende

sobald abstand < 10 und nicht hält etwas
  stopp
ende

bei taste "a"
  drehe basis auf 30°
ende

bei nachricht "los"
  gleichzeitig
    drehe schulter auf 20
    drehe ellbogen auf 40
  ende
ende

funktion quadrat(x)
  gib x * x zurück
ende

ablage
  piepe
ende
`;

test('Rundreise Beispielprogramm', () => roundtrip(SAMPLE));

test('Rundreise Ausdrücke mit Klammern und Vorrang', () => {
  roundtrip('x = (1 + 2) * 3\ny = 1 + 2 * 3\nz = -(4 - 2) ^ 2\nw = 2 ^ 3 ^ 2\nl = [1, "zwei", wahr, nichts]\nl[2] = 5\nk = l[1] + länge(l)\n');
});

test('lose Anweisungen bilden das Hauptprogramm', () => {
  const p = parse('fahre 50 cm vor\ndrehe dich um 90 nach links\n');
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].type, 'main');
  assert.equal(p.items[0].body[0].cmd, 'fahre_vor');
  assert.equal(p.items[0].body[0].args.strecke.unit, 'cm');
  assert.equal(p.items[0].body[1].args.richtung, 'links');
});

test('Muster mit Rückverfolgung: fahre zu / fahre vor / fahre mit tempo', () => {
  const p = parse('fahre zu 10, 20\nfahre 1 m vor\nfahre mit tempo -30\nfahre los\n');
  assert.deepEqual(p.items[0].body.map((s) => s.cmd), ['fahre_zu', 'fahre_vor', 'fahre_tempo', 'fahre_los']);
});

test('„sende x und warte“ trennt am und', () => {
  const p = parse('sende "start" und warte\nsende "x"\n');
  assert.equal(p.items[0].body[0].cmd, 'sende_warte');
  assert.equal(p.items[0].body[1].cmd, 'sende');
});

test('typografische Anführungszeichen vom iPad', () => {
  const p = parse('sage „Hallo Welt“\nsage “ok”\n');
  assert.equal(p.items[0].body[0].args.text.v, 'Hallo Welt');
  assert.equal(p.items[0].body[1].args.text.v, 'ok');
});

test('für-Schleife mit Schritt', () => {
  const t = roundtrip('für i von 1 bis 10 schritt 2\n  sage i\nende\nfür jedes f in [rot, blau]\n  nimm f\nende\n');
  assert.match(t, /schritt 2/);
});

test('Fehler: unbekannter Befehl mit Vorschlag', () => {
  assert.throws(() => parse('dreh basis auf 4\n'), /Meintest du „drehe“/);
});

test('Fehler: fehlendes ende', () => {
  assert.throws(() => parse('beim start\n  piepe\n'), /fehlt das „ende“/);
});

test('Fehler: falsche Einheit', () => {
  assert.throws(() => parse('warte 3 cm\n'), /Einheit „cm“ passt hier nicht/);
});

test('Fehler: Farbe als Variablenname', () => {
  assert.throws(() => parse('rot = 5\n'), /ist eine Farbe/);
});

test('Prüfung: Befehl passt nicht zum Roboter', () => {
  const errs = checkProgram(parse('gehe 50 vor\n'), 'rover', []);
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /fahre … vor/);
  const e2 = checkProgram(parse('drehe knie auf 3\n'), 'arm', ['basis', 'schulter']);
  assert.match(e2[0].message, /Gelenk „knie“/);
});

/* ---------------- Interpreter ---------------- */

function makeHost() {
  const log = [];
  const host = {
    log,
    time: 0,
    command(id, args) {
      log.push(id + (Object.keys(args).length ? ' ' + JSON.stringify(args) : ''));
      if (id === 'drehe_auf') {
        const until = host.time + 0.5;
        return { done: () => host.time >= until, cancel() {} };
      }
      if (id === 'sage') return null;
      return null;
    },
    reporter(id) { if (id === 'r_abstand') return host.abstand ?? 100; if (id === 'r_haelt') return false; return 0; },
    broadcast(msg) { return host.rt.receive(msg); },
    stopMotion() { log.push('STOPP'); },
  };
  return host;
}

function run(src, seconds = 5, setup) {
  const host = makeHost();
  let error = null;
  const rt = new Runtime(parse(src), host, { onError: (e) => { error = e; } });
  host.rt = rt;
  if (setup) setup(rt, host);
  rt.start();
  const dt = 1 / 120;
  for (let t = 0; t < seconds; t += dt) {
    host.time += dt;
    rt.tick(dt);
    if (host.onTick) host.onTick(host.time, rt);
  }
  return { host, rt, error, log: host.log };
}

test('Rechnen, Variablen, Funktionen', () => {
  const { rt, error } = run(`
funktion fak(n)
  wenn n <= 1 dann
    gib 1 zurück
  ende
  gib n * fak(n - 1) zurück
ende
setze a auf fak(5)
b = 7 % 3
c = "Wert: " + a
l = [3, 1, 2]
füge 9 zu l hinzu
s = 0
für jedes x in l
  ändere s um x
ende
`, 1);
  assert.equal(error, null, error && error.message);
  const v = Object.fromEntries(rt.variables());
  assert.equal(v.a, 120);
  assert.equal(v.b, 1);
  assert.equal(v.c, 'Wert: 120');
  assert.equal(v.s, 15);
});

test('warte und Befehle mit Dauer', () => {
  const { log, error, host } = run(`
beim start
  drehe basis auf 10
  warte 1 s
  sage "fertig"
ende`, 3);
  assert.equal(error, null);
  assert.deepEqual(log.slice(0, 2).map((x) => x.split(' ')[0]), ['drehe_auf', 'sage']);
});

test('gleichzeitig wartet auf alle Zweige', () => {
  let tDone = null;
  const { error } = run(`
beim start
  gleichzeitig
    drehe basis auf 10
    warte 1
  ende
  sage "ok"
ende`, 3, (rt, host) => {
    const orig = host.command;
    host.command = (id, a) => { if (id === 'sage') tDone = host.time; return orig(id, a); };
  });
  assert.equal(error, null);
  assert.ok(tDone > 0.99 && tDone < 1.05, 'Zeitpunkt ' + tDone);
});

test('Endlosschleife friert nicht ein', () => {
  const t0 = Date.now();
  const { rt, error } = run('beim start\n  x = 0\n  wiederhole immer\n    ändere x um 1\n  ende\nende\n', 1);
  assert.equal(error, null);
  assert.ok(Date.now() - t0 < 3000);
  assert.ok(Object.fromEntries(rt.variables()).x > 1000);
});

test('sobald reagiert auf Flanke', () => {
  let count = 0;
  const { error } = run('sobald abstand < 10\n  sage "nah"\nende\n', 3, (rt, host) => {
    host.onTick = (t) => { host.abstand = t > 1 && t < 1.5 ? 5 : t > 2 && t < 2.5 ? 3 : 50; };
    const orig = host.command;
    host.command = (id, a) => { if (id === 'sage') count++; return orig(id, a); };
  });
  assert.equal(error, null);
  assert.equal(count, 2);
});

test('Nachrichten und sende … und warte', () => {
  const { log, error } = run(`
beim start
  sende "a" und warte
  sage "danach"
ende
bei nachricht "a"
  drehe basis auf 5
  sage "empfangen"
ende`, 3);
  assert.equal(error, null);
  const says = log.filter((x) => x.startsWith('sage')).map((x) => JSON.parse(x.slice(5)).text);
  assert.deepEqual(says, ['empfangen', 'danach']);
});

test('Laufzeitfehler mit Zeile', () => {
  const { error } = run('beim start\n  x = 5\n  y = x / 0\nende\n', 1);
  assert.ok(error);
  assert.equal(error.line, 3);
  assert.match(error.message, /Durch 0/);
});

test('Text-Vergleich ohne Groß/Klein', () => {
  const { rt } = run('a = "Rot" == rot\nb = show\n'.replace('b = show\n', ''), 0.1);
  assert.equal(Object.fromEntries(rt.variables()).a, true);
});

test('show formatiert Werte', () => {
  assert.equal(show([1, 'a', true, null, 2.5]), '[1, "a", wahr, nichts, 2.5]');
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
