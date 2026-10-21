# KYTHERA

**Kuratoriales Lage- und Steuerungssystem · Version 7.4.2**

Sie wurden soeben zum Inhaber von **Sitz IX** ernannt. Ihr Zugang ist eingerichtet.

KYTHERA ist eine vollständig lokale, interaktive Simulation im Stil einer streng vertraulichen Spezialsoftware. Alle Personen, Organisationen, Staaten, Unternehmen und Ereignisse sind frei erfunden und spielen in einer fiktiven Welt. Es gibt keine Verbindung zu realen Systemen.

## Starten

**Online:** https://idtbas.github.io/Krasses-Experiment-/

Oder lokal, eine der folgenden Möglichkeiten:

- `index.html` im Browser öffnen (funktioniert direkt von der Festplatte, kein Server nötig)
- `dist/kythera-standalone.html` öffnen: dieselbe Anwendung als einzelne Datei
- oder einen beliebigen statischen Server im Projektordner starten, z. B. `npx serve .`

Der Sitzungsstand wird automatisch im Browser gespeichert. Die Welt läuft während Ihrer Abwesenheit weiter (bis zu einer Stunde wird nachgerechnet).

## Hinweise für den Einstieg

- Die **Einweisung** im Lagebild führt in sieben Schritten durch die wichtigsten Bereiche.
- Fast jede Zahl erklärt sich, wenn Sie mit dem Mauszeiger darauf zeigen.
- `Strg + K` öffnet den Schnellzugriff, `` ` `` das Terminal, `?` die Tastaturkürzel.
- Krisenvorlagen haben Fristen. Was nach Fristablauf geschieht, steht im Kleingedruckten.
- Lesen Sie Ihre Post.

Mehr wird hier nicht verraten.

## Technik

- Reines HTML, CSS und JavaScript ohne Abhängigkeiten oder Build-Schritt; Schriften von Google Fonts (mit Ersatzschriften)
- Prozedural erzeugte Weltkarte, Satellitenbilder und Porträts
- Simulationskern mit Märkten, Regionen, Ereignissen, Abstimmungen, Forschung und Abwesenheitsberechnung
- Synthetische Signaltöne über die Web Audio API
- `node tools/build.js` erzeugt die Einzeldateien in `dist/`
- Jeder Push auf `claude/kythera` baut die Seite neu und veröffentlicht sie über GitHub Pages (`.github/workflows/pages.yml`)
- `node tools/shot.js` erstellt geschwärzte Kontroll-Screenshots (`dev-screenshots/SECRET_*.png`)

```
index.html            Einstieg
css/kythera.css       Gestaltungssystem
js/core/              Hilfsfunktionen, Zustand, Ton
js/data/              Welt, Regionen, Wirtschaft, Akteure, Texte, Archiv
js/sim/               Simulationskern
js/ui/                Rahmen, Bausteine, Karte, Anmeldung
js/mod/               Arbeitsbereiche
tools/                Build- und Screenshot-Werkzeuge
dist/                 gebündelte Einzeldateien
```
