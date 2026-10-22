// Referenz: Ablaufsprache, Koordinaten, Bedienung – passend zum ausgewählten Roboter und seinen Modulen.
import { h, clear, esc } from '../core/util.js';
import { CMD, REP, CATEGORIES, CAT, BUILTINS, UNITS, NEED_TEXT, missingNeed } from '../lang/commands.js';
import { highlight } from './texteditor.js';

const STRUCTS = [
  ['beim start … ende', 'Startet mit START.'],
  ['bei taste "a" … ende', 'Startet bei Tastendruck („leertaste“, „oben“, „links“ …).'],
  ['bei nachricht "los" … ende', 'Startet, wenn ein Gerät „sende "los"“ ausführt und die Funkstrecke steht.'],
  ['sobald schutzfeld verletzt … ende', 'Startet bei jeder steigenden Flanke der Bedingung (Ereignissteuerung).'],
  ['bei antippen … ende', 'Startet, wenn der Roboter in der 3D-Ansicht angetippt wird.'],
  ['wenn … dann … sonst wenn … sonst … ende', 'Verzweigung.'],
  ['wiederhole 3 mal … ende', 'Zählschleife.'],
  ['wiederhole immer … ende', 'Endlosschleife (bis STOPP).'],
  ['wiederhole bis … ende / solange … ende', 'Bedingte Schleife.'],
  ['für i von 1 bis 10 schritt 2 … ende', 'Zählschleife mit Laufvariable.'],
  ['für jedes f in [rot, blau] … ende', 'Schleife über eine Liste.'],
  ['gleichzeitig … ende', 'Startet alle enthaltenen Anweisungen parallel (z. B. mehrere Achsen).'],
  ['funktion name(a, b) … ende', 'Unterprogramm. Aufruf: name(1, 2). „gib x zurück“ liefert einen Wert.'],
  ['x = 5 / setze x auf 5 / ändere x um 1', 'Variablen (Zahl, Text, Liste).'],
  ['liste = [1, 2, 3] · liste[1] · länge(liste)', 'Listen, Index ab 1.'],
  ['# Notiz', 'Kommentar.'],
];

const KEYS = [
  ['⌘ ↩', 'Start / Stopp'],
  ['Esc', 'Stopp bzw. Menü schließen'],
  ['⌘ E', 'Bausteine ↔ Skript'],
  ['⌘ 1 – 5', 'Ablauf · Geräte · Konfiguration · Umgebung · Referenz'],
  ['⌘ Z', 'Rückgängig (Bausteine)'],
  ['⌘ S', 'Speichern'],
  ['W A S D / Pfeile', 'Handbetrieb (Tippbetrieb), solange kein Ablauf läuft'],
  ['F', 'Kamera folgt dem Roboter'],
];

const GESTURES = [
  ['1 Finger / Pencil ziehen', 'Ansicht drehen – oder ein Objekt greifen und bewegen'],
  ['2 Finger', 'Verschieben, Zusammenziehen zoomt, Drehen schwenkt'],
  ['Trackpad: 2 Finger scrollen', 'Ansicht drehen (⇧ = verschieben, Pinch = zoomen)'],
  ['Apple Pencil + Pfadwerkzeug', 'Fahrweg auf den Boden zeichnen'],
  ['Baustein antippen', 'Stapel einzeln ausführen'],
  ['Baustein lange drücken / Rechtsklick', 'Duplizieren, parken, löschen, Hilfe'],
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
    el.appendChild(h('h3', { style: { marginTop: 0 } }, 'Ablaufsprache'));
    el.appendChild(h('p.intro', 'Bausteine und Skript sind dieselbe Ablaufbeschreibung – Umschalten verliert nichts. Blöcke enden mit „ende“. Die Palette zeigt nur Befehle, für die das gewählte Gerät die nötigen Module hat.'));
    el.appendChild(h('pre', { html: highlight('# Ausschuss per Wärmebild aussortieren\nbeim start\n  tempo 70 %\n  signalsäule grün\n  nimm wärmstes teil\n  lege ab auf rot\nende\n\nsobald schutzfeld verletzt\n  signalsäule rot\nende') }));

    el.appendChild(h('h3', 'Koordinaten und Einheiten'));
    el.appendChild(h('p.intro', { html: 'Positionen in <b>Zentimetern</b>: <b>x</b> nach rechts, <b>y</b> nach oben, <b>z</b> nach vorn. Beim Knickarm liegt der Ursprung in der Sockelmitte („bewege greifer zu 0, 10, 40“: 10 cm über der Fläche, 40 cm vor dem Arm). „fahre zu“, „navigiere zu“ und „gehe zu“ nutzen das Achsenkreuz des Prüffelds. Winkel: + = rechts.' }));
    const units = h('p.intro', 'Einheiten: ' + [...new Set(Object.keys(UNITS))].join(', ') + '. Ohne Einheit: Zeit in s, Strecken in cm, Winkel in Grad.');
    el.appendChild(units);

    const tog = h('button.btn.small', this.all ? 'Nur verfügbare Befehle' : 'Alle Befehle zeigen');
    tog.addEventListener('click', () => { this.all = !this.all; this.render(); });
    el.appendChild(h('div', { style: { margin: '14px 0 4px' } }, tog));

    for (const c of CATEGORIES) {
      const caps = r ? r.caps() : null;
      const avail = (d) => !d.hidden && (this.all || !type || (d.robots.includes(type) && !missingNeed(d, caps)));
      const cmds = CMD.filter((d) => d.cat === c.id && avail(d));
      const reps = REP.filter((d) => d.cat === c.id && avail(d));
      if (!cmds.length && !reps.length && c.id !== 'steuerung' && c.id !== 'rechnen') continue;
      el.appendChild(h('h3', h('i', { style: { background: c.color } }), c.name));
      if (c.id === 'steuerung') for (const [p, d] of STRUCTS) el.appendChild(this.cmd(p, d));
      for (const d of cmds) el.appendChild(this.cmd(d.p.replace(/\{(\w+):\w+\}/g, '‹$1›'), d.help, d));
      for (const d of reps) el.appendChild(this.cmd(d.p.replace(/\{(\w+):\w+\}/g, '‹$1›'), (d.type === 'bool' ? 'Bedingung · ' : 'Messwert · ') + d.help, d));
      if (c.id === 'rechnen') {
        el.appendChild(this.cmd('+  −  *  /  %  ^   <  >  <=  >=  ==  !=   und  oder  nicht', 'Arithmetik, Vergleich, Logik. „=“ gilt in Bedingungen als Vergleich.'));
        for (const [n, b] of Object.entries(BUILTINS)) el.appendChild(this.cmd(`${n}(${b.n === 1 ? 'x' : 'a, b'})`, b.help));
      }
    }

    el.appendChild(h('h3', 'Tastenkürzel · Magic Keyboard'));
    el.appendChild(this.table(KEYS));
    el.appendChild(h('h3', 'Bedienung · Touch, Pencil, Trackpad'));
    el.appendChild(this.table(GESTURES));
    el.appendChild(h('h3', 'Simulation'));
    el.appendChild(h('p.intro', 'Starrkörperphysik mit 120 Hz: Antriebe haben Momenten- und Drehzahlgrenzen und erwärmen sich unter Last (Drosselung ab 90 °C), Greifer halten reibschlüssig bzw. per Vakuum oder Magnet, Sensoren messen über Strahlen in der Szene. LiDAR und Farbkamera leiden unter Nebel, Farbkameras brauchen Licht, Radar und Wärmebild nicht. Funk: Linkbudget mit Freiraum- und Wanddämpfung.'));
  }

  cmd(p, d, def) {
    const need = def && (def.needs || def.needsAny) ? [].concat(def.needs || def.needsAny).map((k) => (NEED_TEXT[k] || k).replace(/^(ein|eine|einen) /, '')).join(def.needsAny ? ' oder ' : ' + ') : '';
    return h('div.cmd', h('code', p), need ? h('span.need', need) : null, d ? h('div', d) : null);
  }

  table(rows) {
    const t = h('table');
    for (const [a, b] of rows) t.appendChild(h('tr', h('td', h('b', a)), h('td', b)));
    return t;
  }
}

export { esc, CAT };
