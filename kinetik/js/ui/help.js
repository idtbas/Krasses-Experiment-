// Hilfe: Sprachreferenz, Koordinaten, Bedienung – passend zum ausgewählten Roboter.
import { h, clear, esc } from '../core/util.js';
import { CMD, REP, CATEGORIES, CAT, BUILTINS, UNITS } from '../lang/commands.js';
import { highlight } from './texteditor.js';

const STRUCTS = [
  ['beim start … ende', 'Läuft los, sobald du auf Start drückst.'],
  ['bei taste "a" … ende', 'Läuft, wenn die Taste gedrückt wird (auch „leertaste“, „oben“, „links“ …).'],
  ['bei nachricht "los" … ende', 'Läuft, wenn irgendein Roboter „sende "los"“ ausführt.'],
  ['sobald abstand < 10 … ende', 'Läuft jedes Mal, wenn die Bedingung wahr wird.'],
  ['bei antippen … ende', 'Läuft, wenn du den Roboter in der 3D-Ansicht antippst.'],
  ['wenn … dann … sonst wenn … sonst … ende', 'Entscheidungen treffen.'],
  ['wiederhole 3 mal … ende', 'Etwas genau so oft wiederholen.'],
  ['wiederhole immer … ende', 'Endlos wiederholen (bis Stopp).'],
  ['wiederhole bis … ende / solange … ende', 'Wiederholen, bis bzw. solange eine Bedingung gilt.'],
  ['für i von 1 bis 10 schritt 2 … ende', 'Zählschleife mit Variable i.'],
  ['für jedes f in [rot, blau] … ende', 'Für jedes Element einer Liste.'],
  ['gleichzeitig … ende', 'Jede Zeile darin startet zugleich – praktisch, um mehrere Gelenke auf einmal zu bewegen.'],
  ['funktion name(a, b) … ende', 'Eigener Befehl. Aufruf: name(1, 2). Mit „gib x zurück“ liefert er einen Wert.'],
  ['x = 5 / setze x auf 5 / ändere x um 1', 'Variablen (Zahlen, Texte, Listen).'],
  ['liste = [1, 2, 3] · liste[1] · länge(liste)', 'Listen – gezählt wird ab 1.'],
  ['# Notiz', 'Kommentar – wird nicht ausgeführt.'],
];

const KEYS = [
  ['⌘ ↩', 'Start / Stopp'],
  ['Esc', 'Stopp bzw. Menü schließen'],
  ['⌘ E', 'Zwischen Bausteinen und Text wechseln'],
  ['⌘ 1 – 4', 'Programm · Bauen · Welt · Hilfe'],
  ['⌘ Z', 'Rückgängig (Bausteine)'],
  ['⌘ S', 'Speichern'],
  ['W A S D / Pfeile', 'Fernsteuerung, solange kein Programm läuft'],
  ['F', 'Kamera folgt dem Roboter'],
];

const GESTURES = [
  ['1 Finger / Pencil ziehen', 'Kamera drehen – oder einen Gegenstand anfassen und werfen'],
  ['2 Finger', 'Verschieben, Zusammenziehen zoomt, Drehen schwenkt'],
  ['Trackpad: 2 Finger scrollen', 'Kamera drehen (⇧ = verschieben, Pinch = zoomen)'],
  ['Apple Pencil + Pfad-Werkzeug', 'Einen Weg auf den Boden zeichnen'],
  ['Baustein antippen', 'Diesen Stapel sofort ausprobieren'],
  ['Baustein lange drücken / Rechtsklick', 'Duplizieren, ablegen, löschen, Hilfe'],
];

export class HelpPanel {
  constructor(app) {
    this.app = app;
    this.el = h('div.pane.scroll.help');
    this.all = false;
  }

  render() {
    clear(this.el);
    const r = this.app.currentRobot();
    const type = r ? r.type : null;
    const el = this.el;
    el.appendChild(h('h3', { style: { marginTop: 0 } }, 'Klartext – die Robotersprache'));
    el.appendChild(h('p.intro', 'Jeder Baustein ist auch eine Zeile Text. Du kannst jederzeit oben zwischen „Bausteine“ und „Text“ wechseln – das Programm bleibt dasselbe. Blöcke enden mit „ende“.'));
    el.appendChild(h('pre', { html: highlight('# Würfel greifen und stapeln\nbeim start\n  tempo 70 %\n  nimm rot\n  lege ab auf blau\n  wenn hält etwas dann\n    sage "Hoppla"\n  sonst\n    sage "Fertig!"\n  ende\nende') }));

    el.appendChild(h('h3', 'Koordinaten und Einheiten'));
    el.appendChild(h('p.intro', { html: 'Positionen sind in <b>Zentimetern</b>: <b>x</b> nach rechts, <b>y</b> nach oben, <b>z</b> nach vorn. Beim Arm liegt der Nullpunkt in der Mitte seines Sockels – „bewege greifer zu 0, 10, 40“ heißt also: 10 cm über der Fläche, 40 cm vor dem Arm. „gehe zu“ und „fahre zu“ nutzen das Kreuz am Boden als Ursprung.' }));
    const units = h('p.intro', 'Einheiten hinter Zahlen: ' + [...new Set(Object.keys(UNITS))].join(', ') + '. Ohne Einheit gilt: Zeit in s, Strecken in cm, Winkel in Grad.');
    el.appendChild(units);

    const tog = h('button.btn.small', this.all ? 'Nur Befehle für diesen Roboter' : 'Alle Befehle zeigen');
    tog.addEventListener('click', () => { this.all = !this.all; this.render(); });
    el.appendChild(h('div', { style: { margin: '14px 0 4px' } }, tog));

    for (const c of CATEGORIES) {
      const cmds = CMD.filter((d) => d.cat === c.id && (this.all || !type || d.robots.includes(type)));
      const reps = REP.filter((d) => d.cat === c.id && (this.all || !type || d.robots.includes(type)));
      if (!cmds.length && !reps.length && c.id !== 'steuerung' && c.id !== 'rechnen') continue;
      el.appendChild(h('h3', h('i', { style: { background: c.color } }), c.name));
      if (c.id === 'steuerung') for (const [p, d] of STRUCTS) el.appendChild(this.cmd(p, d));
      for (const d of cmds) el.appendChild(this.cmd(d.p.replace(/\{(\w+):\w+\}/g, '…$1…').replace(/…(\w+)…/g, '‹$1›'), d.help));
      for (const d of reps) el.appendChild(this.cmd(d.p.replace(/\{(\w+):\w+\}/g, '‹$1›'), (d.type === 'bool' ? 'Bedingung: ' : 'Wert: ') + d.help));
      if (c.id === 'rechnen') {
        el.appendChild(this.cmd('+  −  *  /  %  ^   <  >  <=  >=  ==  !=   und  oder  nicht', 'Rechnen und Vergleichen. „=“ funktioniert in Bedingungen auch.'));
        for (const [n, b] of Object.entries(BUILTINS)) el.appendChild(this.cmd(`${n}(${b.n === 1 ? 'x' : 'a, b'})`, b.help));
      }
    }

    el.appendChild(h('h3', 'Tastenkürzel (Magic Keyboard)'));
    el.appendChild(this.table(KEYS));
    el.appendChild(h('h3', 'Bedienung mit Finger, Pencil und Trackpad'));
    el.appendChild(this.table(GESTURES));
    el.appendChild(h('p.intro', { style: { marginTop: '16px' } }, 'Die Physik ist echt: Motoren haben Kraftgrenzen, Greifer halten nur mit Reibung bzw. Saugkraft, und ein Humanoid ohne Gleichgewicht fällt um. Probier es aus – im Zweifel hilft „Zurücksetzen“.'));
  }

  cmd(p, d) {
    return h('div.cmd', h('code', p), d ? h('div', d) : null);
  }

  table(rows) {
    const t = h('table');
    for (const [a, b] of rows) t.appendChild(h('tr', h('td', h('b', a)), h('td', b)));
    return t;
  }
}

export { esc, CAT };
