# KYTHERA · MANDAT

**Online spielen:** https://idtbas.github.io/Krasses-Experiment-/
(die erste Fassung „KYTHERA“ bleibt unter https://idtbas.github.io/Krasses-Experiment-/v1/ erreichbar)

Ein fiktives Rollenspiel in einer prozedural erzeugten Welt. Sie sind kein Gott, sondern eine einzelne, anonyme Person mit einem gewaltigen Vermögen – und Sie tragen die Verantwortung für alles, was Sie damit anstoßen.

Alle Staaten, Personen, Organisationen, Sender und Ereignisse sind frei erfunden.

## Zwei Arten zu spielen

- **Neues Mandat:** Vertragsmappe unterschreiben, mit begrenztem Vermögen handeln und für alle Folgen geradestehen.
- **Freie Sandbox · Weltregie:** ohne Verträge und Geldsorgen. 42 Werkzeuge in fünf Bereichen (Naturgewalten, Himmel und All, Wirtschaft, Politik, Gesellschaft) frei auslösen, Klima und Häufigkeit von Naturereignissen einstellen, Staatswerte verändern, Raketen starten und Satellitenflotten aufbauen. Jede Auslösung ist auf der Karte zu sehen – Meteoriten mit Druckwelle und Krater, Tsunami-Wellen über dem Meer, Beben mit Rissen, Aschesäulen, Wirbelstürme, Polarlichter, Feuerwerk – und die Welt reagiert: Regierungen, Nachbarstaaten, Märkte und Menschen antworten über Tage und Wochen. (Im Mandat lässt sich die Weltregie unter System freischalten.)

## Gerät

Gestaltet für das **iPad im Querformat mit Magic Keyboard** (Safari). Bedienung über Trackpad und Tastatur; ein Desktop-Browser im Querformat funktioniert ebenfalls. Eine Handy-Fassung gibt es bewusst nicht.

| Taste | Wirkung |
|---|---|
| Leertaste | Zeit anhalten oder fortsetzen |
| 1 – 4 | Geschwindigkeit |
| ⌘ K oder / | Suche und Befehle |
| A | Handlungskatalog |
| U | Orbitale Leitstelle |
| W | Weltregie (Sandbox) |
| B | Regie-Leiste ein- und ausklappen |
| E | Krisenstab |
| G | Kartenebene wechseln |
| ? | Einweisung |

Zwei Finger auf dem Trackpad verschieben die Karte, Zusammenziehen zoomt.

## Technik

- Reines HTML, CSS und JavaScript ohne Abhängigkeiten; Spielstände im Browser-Speicher
- `index.html` lädt die Quelldateien einzeln (läuft auch direkt von der Festplatte)
- `node tools/build.js` erzeugt die eigenständige Einzeldatei `dist/kythera-standalone.html`
- Jeder Push auf `claude/kythera` veröffentlicht automatisch über GitHub Pages (`.github/workflows/pages.yml`)

```
js/core   Grundfunktionen, Symbole, Ton
js/world  Weltgenerator und Geländetextur
js/data   Handlungen, Verträge, Medien, Ereignisse, Forschung, Personen
js/sim    Simulation
js/ui     Oberfläche
```

Die Aufnahmen in `dev-screenshots/` sind absichtlich geschwärzt.
