# KINETIK – optimierter Prompt

> Ausgangsidee: „Eine extrem coole Web-App, mit der auch Anfänger humanoide Roboter in 3D konfigurieren und programmieren können – mit eigener Sprache, Bausteinen, Sensoren, Objekten und korrekter Physik. Nur für Safari auf dem iPad mit Magic Keyboard und Apple Pencil.“

---

## Rolle

Du bist ein kleines Senior-Team aus 3D-Grafik, Echtzeit-Physik, Programmiersprachen-Design und UX für Lernsoftware. Du baust ein fertiges, spielbares Produkt, keinen Prototyp mit Platzhaltern.

## Auftrag

Entwickle **KINETIK**, eine Robotik-Werkstatt im Browser. Einsteiger bauen dort in einer physikalisch simulierten 3D-Welt **humanoide Roboter, Roboterarme und Fahrroboter** zusammen, programmieren sie und testen ihr Können an Aufgaben.

**Maßstab:** Nach weniger als fünf Minuten bewegt sich der erste eigene Roboter. Trotzdem reicht die Tiefe für echte Automationen mit mehreren Robotern und Sensoren.

## Zielplattform (verbindlich)

- **Safari auf dem iPad** (iPadOS 17 oder neuer), Querformat, 1024 × 768 bis 1366 × 1024 Punkte.
- **Eingaben:** Touch, **Apple Pencil** (präzises Ziehen, Hover-Vorschau, Pfade auf den Boden zeichnen) und **Magic Keyboard** mit Trackpad (Tastenkürzel, Zwei-Finger-Scrollen, Pinch-Zoom, Rechtsklick).
- **Keine Handy-Version.** Auf kleinen Bildschirmen erscheint ein freundlicher Hinweis. Desktop-Browser dürfen funktionieren, sind aber nicht das Ziel.
- Die App läuft rein statisch (GitHub Pages), ohne Server und ohne Anmeldung. Gespeichert wird lokal im Browser.

## 1. Roboter und Konfigurator

- **Drei Grundmodelle:**
  - Humanoid: zweibeinig, etwa 1,3 m groß, mit Kopf, Armen, Händen und Beinen.
  - Roboterarm: Basis, Schulter, Ellbogen, Handgelenk und Greifer.
  - Fahrroboter: Differentialantrieb, optional mit aufgesetztem Arm.
- **Austauschbare Teile:**
  - Sensorkopf
  - Greifer (Zweifinger, Saugnapf, Magnet)
  - Motorklasse (Mikro, Standard, Industrie), jeweils mit echten Drehmoment- und Tempogrenzen
  - Gliedlängen
  - Akku
  - Sensoren
  - Lackierung
- **Jede Wahl wirkt sich in der Physik aus:** Masse, Reichweite, Traglast und Standfestigkeit ändern sich.
- Live-Vorschau in 3D und ein Datenblatt mit Masse, Reichweite, Traglast und Gelenken.

## 2. Physik

- **Echte Starrkörperphysik:** Gelenke mit Servomotoren, Drehmomentgrenzen, Masse, Reibung, Schwerkraft und Kollisionen. Die Simulation läuft in festen Zeitschritten mit 120 Hz, mit Pause und Zeitlupe.
- **Objekte:**
  - Würfel aus Holz, Aluminium oder Schaumstoff, jeweils mit eigener Masse und Reibung
  - Kugeln, Zylinder, Rampen und Wände
  - Förderband, Taster, Lampe, Lichtschranke und Zielzonen
- **Greifen über Griffkraft und Reibung:** Zu schwache Motoren oder zu wenig Kraft lassen Gegenstände rutschen. Humanoide können das Gleichgewicht verlieren und umfallen.

## 3. Programmierung – zwei Wege, ein Programm

- **Bausteine:**
  - Drag & Drop, fingertauglich und mit dem Pencil präzise.
  - Farbige Kategorien: Ereignisse, Bewegung, Greifer, Sensoren, Steuerung, Rechnen, Variablen, Funktionen.
- **Eigene Textsprache „Klartext“:** deutsch, lesbar und blockorientiert mit `ende`:
  ```
  beim start
    öffne greifer
    bewege greifer zu 0.5, 0.1, 0
    schließe greifer
    wiederhole 3 mal
      drehe basis um 30
    ende
    sage "Fertig!"
  ende

  wenn abstand < 10
    stopp
  ende
  ```
  - **Ereignisse:** Start, Taste, Sensorbedingung, Nachricht
  - **Steuerung:** `wenn/sonst`, `solange`, `wiederhole`, `gleichzeitig … ende` für parallele Bewegungen
  - Variablen, Listen, eigene Funktionen und Nachrichten zwischen Robotern
- **Verlustfrei umwandelbar:** Bausteine und Text teilen sich einen Syntaxbaum. Umschalten verändert das Programm nicht.
- **Ausführung:**
  - Mehrere Abläufe laufen parallel.
  - Der aktive Baustein bzw. die aktive Zeile leuchtet.
  - Fehlermeldungen sind verständlich, auf Deutsch und mit Zeilenangabe.
  - Variablen und Sensorwerte sind live sichtbar.
  - Endlosschleifen frieren nichts ein.

## 4. Sensoren und Automation

- **Sensoren:**
  - Abstand
  - Farbe
  - Berührung
  - Greifkraft
  - Neigung
  - Kamera, die Objekte nach Farbe findet
  - Liniensensor
  - Lichtschranke und Taster in der Welt
- **Roboter schicken sich Nachrichten.** So entstehen Fertigungsstraßen, etwa: Förderband → Arm sortiert → Humanoid räumt ab.

## 5. Missionen und Sandbox

- **Missionen mit steigender Schwierigkeit:**
  1. Gelenk bewegen
  2. Würfel greifen
  3. Würfel stapeln
  4. Nach Farbe sortieren
  5. Förderband-Automation
  6. Humanoid-Parcours
- Jede Mission wird automatisch geprüft und vergibt bis zu drei Sterne. Dazu gibt es Tipps und eine Musterlösung.
- **Freie Sandbox:** Objekte und mehrere Roboter platzieren, verschieben und drehen. Eigene Projekte lassen sich speichern.

## 6. Design und UX

- **Hochwertige Studio-Optik:** heller Studioboden mit weichen Schatten und PBR-Materialien, umgeben von einer ruhigen, dunklen Oberfläche mit einer klaren Akzentfarbe.
- **Flüssig:** 60 fps auf dem iPad.
- **Bedienbarkeit:**
  - Trefferflächen von mindestens 44 pt.
  - Nichts hängt von Hover ab.
  - Kurze Einführung beim ersten Start.
- Alles auf Deutsch, in der du-Form.
- **Tastenkürzel:** ⌘↩ Start, Esc Stopp, ⌘E Bausteine/Text umschalten, WASD fährt manuell, F fokussiert den Roboter, ? zeigt die Hilfe.

## 7. Technik

- **Bibliotheken:** Three.js (WebGL 2) für die Darstellung, Rapier (WebAssembly) für die Physik. Beide liegen lokal im Projekt.
- **Code:** Vanilla-JavaScript-Module, kein Build-Schritt nötig.
- **Module:** `render`, `physics`, `robots`, `world`, `lang`, `blocks`, `ui`, `missions`.
- **Tests:** für Lexer, Parser, Formatter und Interpreter. Jede Mission lässt sich mit ihrer Musterlösung automatisch lösen.

## Abnahmekriterien

1. Ein Einsteiger schafft die erste Mission ohne Anleitung.
2. Der Roboterarm hebt einen Würfel rein physikalisch auf und legt ihn in eine Zielzone.
3. Der Humanoid geht, dreht sich, greift und fällt bei einem Stoß nachvollziehbar um.
4. Bausteine → Text → Bausteine ergibt exakt dasselbe Programm.
5. Keine Konsolenfehler; flüssig mit zwei Robotern und 30 Objekten.

## Vorgehen

1. Architektur und Sprache festlegen.
2. Spielbaren Kern bauen: Arm, Würfel und Bausteine.
3. Humanoid und Fahrroboter, Sensoren, Missionen, Sandbox.
4. Feinschliff und Veröffentlichung.
