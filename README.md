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

---

# KINETIK · Robotik-Labor

**Online öffnen:** https://idtbas.github.io/Krasses-Experiment-/kinetik/

Ein Labor zum Konfigurieren, Programmieren und Prüfen von Industrierobotern in einer physikalisch simulierten 3D-Testhalle – für das **iPad mit Magic Keyboard oder Apple Pencil** (Safari), auch am Desktop-Browser nutzbar.

- **Drei Grundgeräte:** Knickarm KX-5, Humanoid HX-2, autonomes Fahrzeug AMR-1
- **Komponentenkatalog mit Preisen:** Antriebe (DC-Servo, Schrittmotor, bürstenlos/BLDC, Harmonic Drive, QDD, AC-Servo), Werkzeuge, 19 Sensor- und Signalmodule (u. a. 2D/3D-LiDAR, Sicherheitslaserscanner, Radar, Tiefen- und Wärmebildkamera, RFID, Kraft-Moment-Sensor, Signalsäule), Funk (WLAN, 868 MHz, LoRa, 5G) mit Antennen, Akkus und Steuerungen. Alles wird ohne Verkabelung eingebunden; Stückliste und Kennwerte (Masse, Traglast, Laufzeit, Rechenlast) rechnen live mit.
- **Ablaufsprache als Text oder Blöcke:** es erscheinen nur die Befehle, die die verbaute Hardware auch kann.
- **Gerätemonitor:** live sehen, was Kamera, Tiefenkamera, Wärmebild, LiDAR (Draufsicht und Punktwolke) und Radar erfassen – auch als Bild-in-Bild.
- **Testhalle 2:** 22 Prüfaufträge (Handhabung, Mobilität, Humanoid, Systemverbund) mit Funkstrecken durch Stahlbeton, Dunkelheit, Querverkehr, Schutzfeldern und Wärmelasten.

**Abläufe per KI erzeugen:** [`kinetik/KI-PROMPT.md`](kinetik/KI-PROMPT.md) enthält die komplette Sprach- und Befehlsreferenz als Prompt. In einen beliebigen KI-Chat kopieren, Aufgabe ergänzen, Code im Tab Skript einfügen.

Technik: Vanilla-JavaScript-Module, Three.js und Rapier (Physik) liegen im Ordner `kinetik/vendor`. Lokal starten mit `python3 -m http.server` im Ordner `kinetik/`. Sprachtests: `node kinetik/tests/lang.test.mjs`.

# ECHO · LiDAR-Studio

**Online öffnen:** https://idtbas.github.io/Krasses-Experiment-/lidar/

Ein LiDAR-Scan-Simulator für Einsteiger, der so realistisch wie möglich misst: 44 Scanner (rotierend, Festkörper, 2D, terrestrische Laserscanner, SLAM-Handgeräte, Tiefenkameras und das Smartphone-LiDAR), fünf Szenen (Werkhalle, Außengelände, Wohnung, Prüfstrecke, Messraum mit Drehteller) und ein Feldrechner „ECHO Field T10“ mit eigener Scan-Software.

**Du bist der Vermesser:** keine fliegende Kamera, sondern eine Figur in der Szene (Schulterblick oder Ich-Sicht, WASD und Maus, am iPad Joystick und Wischen). Scanner holst du an der Geräteausgabe, das Stativ trägst und stellst du selbst auf, setzt den Scanner darauf, schaltest ihn ein, montierst ihn an den geparkten Fahrroboter, den Roboterarm oder die Drohne – oder misst aus der Hand. Den Feldrechner nimmst du vom Tisch und hältst ihn mit Tab vor dich. Auch du bist für die Laser sichtbar und wirfst Scanschatten.

- **Messphysik:** echte Abtastmuster (Feuerfolgen, Rosetten, Raster, Spiegel-TLS), mehrere Teilstrahlen über die Strahldivergenz, Mischpixel und Mehrfachechos, Glas, Spiegel-Geisterpunkte, übersteuernde Retroreflektoren, Erkennung aus der Reichweite bei 10 % Reflektivität, Rauschen nach Datenblatt, Sonne, Nebel, Regen und Staub, 905 vs. 1550 nm.
- **Plattformen mit Autoscan:** Stativ, Fahrroboter AMR-1 (umrundet das markierte Objekt allein, Laserscanner im Stop-and-Go), Roboterarm KX-5 mit Drehteller (Scan in Objektkoordinaten), Drohne (Raster oder Umrundung), handgeführt durch dich selbst.
- **Positionsbestimmung wie in echt:** Referenzbahn, Koppelnavigation (Rad-Odometrie, GNSS ohne RTK, reine IMU) mit typischer Drift oder LiDAR-SLAM (Scan-zu-Karte, Punkt-zu-Ebene mit IMU-Stützung); Entzerrung (Deskew) zuschaltbar.
- **Smartphone-LiDAR:** iPhone-Pro-Klasse mit 576 dToF-Punkten, fusioniertem 256 × 192-Tiefenbild, Handy-App mit Kamerabild, wachsendem AR-Netz und visuell-inertialer Pose; Schnellstart „Smartphone gegen Profi“ vergleicht mit einem RTC360-Stationsscan.
- **Feldrechner:** Live-Ansicht mit Abstandsbild, Registrierung (ICP), Filter, Boden, Zuschneiden, Vernetzen (TSDF), Messen, Soll-Ist-Vergleich, Export als LAS, PLY, PCD, XYZ/CSV, OBJ/STL und Velodyne-PCAP.
- **3D-Modell (wie Polycam):** „Objekt“ rechnet aus der Punktwolke ein glattes Netz (TSDF, Schwebeteile entfernen, Taubin-Glättung; Farbe, Höhe oder Ton) – Räume sieht man von außen als Puppenhaus. „Raum“ erkennt Boden, Decke, rechtwinklige Wände, Türen und Fenster (durchquerte Wandebenen, Glas, Tiefenkarte je Station) und zeichnet den Grundriss mit Maßen; Export als OBJ/STL/PLY, Grundriss-SVG und Raum-JSON.

Technik: eigener Strahlverfolgungs-Kern (BVH mit Instanzen) in Web Workern, Three.js und Rapier aus `kinetik/vendor`, Roboter aus KINETIK. Lokal starten mit `python3 -m http.server` im Hauptordner, dann `http://localhost:8000/lidar/` öffnen. Tests: `for t in lidar/tests/*.test.mjs; do node $t; done`.

