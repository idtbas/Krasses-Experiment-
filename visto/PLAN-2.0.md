# VistoOS 2.0 – Plan

Ziel: aus dem Emulator-Prototyp wird ein **echtes Betriebssystem**, das die Website nur noch *wiedergibt*.
Später läuft dasselbe System unverändert auf Linux (Kiosk-Browser + kleiner Gerätedienst).
Gestaltung: deutlich näher an Apple – und der Kreis wird vom Rahmen zum Prinzip.

## 1 · System (echtes OS statt Webseite)

| Baustein | Inhalt |
|---|---|
| **Plattformschicht** `js/sys/platform.js` | Eine Hardware-Schnittstelle `V.platform` für Display, Helligkeit, Lichtsensor, Kamera, Mikrofon, Ton, Haptik, Speicher, Netz, Strom. Treiber `web` (Emulator/Handy) und `linux` (Gerät, spricht per WebSocket mit dem Dienst `vistod`). Das OS ruft nie mehr direkt Browser-Funktionen auf. |
| **Kern** `js/sys/kernel.js` | Dienste-Verzeichnis, App-Prozesse mit Lebenszyklus (gestartet · pausiert · beendet), Berechtigungen je App (Kamera, Mikrofon, Hinweise), Systemprotokoll, Zustandsbericht `V.sys.info()`. |
| **Gerätemodus** `device.html` | Das OS allein, bildschirmfüllend, ohne Emulator-Rahmen – genau das startet später der Linux-Kiosk (1080 × 1080). Der Emulator (`index.html`) ist nur noch ein „Wirt“ darum herum. |
| **Linux-Paket** `linux/` | Startskript für den Kiosk (cage + Chromium/Cog), systemd-Dienste, Referenz-Gerätedienst `vistod` (Helligkeit, Lichtsensor, WLAN). Als Vorlage, auf echter Hardware noch ungetestet. |

## 2 · Grafik („Lumen“-Engine)

- **GPU-Ebene (WebGL2)** unter und über der Oberfläche: lebendiger Hintergrund aus Licht (reagiert auf Berührung, Tageszeit, App-Farbe), Lichtreflex unter dem Finger, Linsen-Lichtring bei App-Start, Glanzlicht am Glasrand.
- **Tiefe statt Schwarzblende:** Was nach hinten tritt, wird unscharf und kleiner (wie bei Apple) – bei Visto, Kontrollzentrum, App-Wechsel.
- **Leistungsregler:** misst die Bildzeit und passt Qualität stufenweise an (120/90/60 Hz, Leuchtauflösung), damit es auf jedem Gerät flüssig bleibt.
- Visto selbst bleibt im Aussehen **unverändert**.

## 3 · Der Kreis als Prinzip (neue Bedienideen)

1. **Horizont** – Zeit ist rund: Der Rand des Zifferblatts zeigt die nächsten 12 Stunden, ausgerichtet wie auf einer Uhr: Termine als Bögen, Wetter, Sonnenauf-/-untergang, Wecker, Timer.
2. **Zeitreise** – am Rand drehen spult die Zeit vor: Zeiger/Ziffern laufen mit, die Mitte zeigt „in 3 Std. · 7° · Yoga“. Loslassen federt zurück ins Jetzt.
3. **Live-Rand** – laufende Dinge (Timer, Musik, Fokus, Stoppuhr, Wecker) leben als gestapelte Lichtbögen am Rand, systemweit verwaltet; antippen öffnet die App. (Die runde Antwort auf Apples „Dynamic Island“.)
4. **Blicke** – links/rechts vom Zifferblatt liegen runde Kurzansichten der Apps (Wetter, Kalender, Musik, Zuhause …) wie auf einem Drehteller; das Zifferblatt wechselt man im Editor (wie bei der Apple Watch).
5. **Tortenmenü** – langes Drücken öffnet ein Menü rund um den Finger: schnellste Menüform überhaupt, auf dem Kreis naheliegend.
6. **Karussell** – zuletzt benutzte Apps auf einem Ring; Doppeldruck auf die Sockeltaste.

## 4 · Gestaltung 2.0 („Glas & Licht“)

- **Materialien:** echtes Milchglas (Unschärfe + Sättigung + Lichtkante) in drei Stärken, statt grauer Flächen.
- **Bewegung:** vier feste Federn (flink · weich · federnd · sanft) für das ganze System.
- **Bedienelemente:** Glas-Kapseln und -Kreise mit Lichtkante, Druck = Licht + Feder.
- **App-Symbole** mit Tiefe und Glanz; Orbit mit Beschriftung und weicher Randlinse.
- **Typografie** und Abstände nach festem Raster; Ziffern dünn und groß, Etiketten klein und gesperrt.

## 5 · Alle Apps auf 2.0

Jede der 14 Apps: neue Materialien und Federn, eigener **Blick**, **Live-Rand**, wo sinnvoll **Tortenmenü**, Hintergrundlicht in App-Farbe. Dazu Kontrollzentrum als Glasvorhang, Einrichtung und Start mit der neuen Engine.

## 6 · Ablauf

1. **Fundament** (parallel): Plattform + Kern + Gerätemodus · Lumen-Engine · Horizont/Zeitreise/Live-Rand · Blicke · Gestaltung 2.0 (Glas, Tiefe, Orbit, Tortenmenü).
2. **Apps** (parallel, je Agent 2–3 Apps): Umstellung auf 2.0.
3. **Prüfung**: Gesten, Darstellung, Leistung (auch die abgebrochene Leistungsmessung), Gesamtübersicht.

Jeder Schritt wird geprüft, gepusht und ist sofort live.
