# VistoOS 2.0 – Technische Vorgaben (für alle, die am Fundament bauen)

Lies zuerst `PLAN-2.0.md` (Ziel) und `ARCHITEKTUR.md` (bestehende Schnittstellen). Dieses Dokument legt die
**neuen** Schnittstellen fest. Sie sind verbindlich, damit parallel gebaute Teile zusammenpassen.

Leitlinien für jede Zeile:
- **Apple-Niveau.** Ruhig, präzise, physikalisch. Lieber eine Sache perfekt als drei halb.
- **Der Kreis ist das Prinzip:** Zeit, Fortschritt, Auswahl und Navigation folgen Bögen und Drehung.
- **Visto (Linie/Ring/Augen) bleibt im Aussehen unverändert.**
- **Leistung:** zeitbasiert über `V.loop`, nichts pro Bild neu allozieren, kein Layout-Lesen in Schleifen,
  Canvas/GL nur zeichnen, wenn sichtbar. Ziel 90 Hz auf dem Gerät, flüssig auf Mittelklasse-Handys.
- Bewegung nur mit den vier Federn `V.motion.snappy | smooth | bouncy | gentle` (`V.spring(0, V.motion.smooth)`).
- Deutsch mit Umlauten. Keine Bedienelemente in der Visto-Zone (logisch y > 870, |x−500| < 175).
- **Arbeitsweise bei parallelen Agenten:** eigene Dateien frei schreiben; fremde/gemeinsame Dateien nur mit dem
  Edit-Werkzeug gezielt ändern (vorher frisch lesen), nie komplett überschreiben. Kein git commit.
  Neue Skripte in `index.html` (und `device.html`, falls vorhanden) per Edit eintragen.
- Testen mit `node tools/shot.js …` (siehe ARCHITEKTUR.md; Schritte wait/eval/tap/swipe/rotate/type/shot),
  Screenshots ansehen, keine Konsolenfehler, `node --check`.

## Erweiterungspunkte der Shell (bereits vorhanden – shell.js nicht umbauen)

```js
V.shell.hooks.homeSwipeX = { start(p), move(p), end(p, cancelled) }   // waagerechtes Wischen auf dem Zifferblatt
V.shell.hooks.homeCrown  = { start(p), turn(dA, p), end(p) }           // Drehen am Rand auf dem Zifferblatt
V.shell.hooks.tap.push((p, e) => true|false)                           // true = behandelt
V.shell.hooks.long.push((p, e) => true|false)
V.shell.hooks.baseDouble = () => {}                                    // Doppeldruck Sockeltaste
Ereignisse: 'shell:mode' (home|launcher|app|setup|boot), 'app:open' id, 'app:close' id, 'activity', 'ambient' bool
Ebenen: V.display.back (Canvas, z 5, unter allem) · stage (10) · scrim (20) · convo (25) · overlay (40)
        · V.display.light (Canvas, z 45, mix-blend screen) · fx (50) · top (60)
```

## A · System: Plattform, Kern, Gerätemodus  (`js/sys/*`, `device.html`, `linux/*`)

```js
V.platform = {
  name: 'web' | 'linux',                 // Treiber
  host: 'emulator' | 'device',           // index.html bzw. device.html
  caps: { camera, mic, haptics, backlight, lightSensor, wifi, speech },
  display: { width: 1080, height: 1080, round: true, hz: 90, setBacklight(0…1) → bool (false = Software-Abdunklung nötig) },
  light:   { value() → 0…1, onChange(fn) },             // Umgebungslicht (Emulator-Regler bzw. Sensor)
  haptics: { pulse(ms | muster) },
  storage: { get(key) → string|null, set(key, str), remove(key) },
  camera:  { open({facing:'user'}) → Promise<MediaStream>, close() },
  mic:     { open() → Promise<MediaStream>, close() },
  net:     { online() → bool, wifi: { current(), scan() → Promise<[{ssid, strength, secure}]>, connect(ssid, pass) → Promise<bool> } },
  power:   { reboot(), shutdown(), onAC: true },
  bridge:  { connected, send(type, data) → Promise, on(type, fn) },   // nur linux: WebSocket zu vistod (ws://127.0.0.1:7707)
}
V.sys = {
  version, bootTime, uptime(),
  services: { register(name, api), get(name), list() },
  procs: { list() → [{id, name, state:'running'|'paused', since, permissions}], get(id) },   // folgt 'app:open'/'app:close'
  perm:  { has(app, name), request(app, name) → Promise<bool>, list() },                      // 'camera' | 'mic' | 'notify'
  log(level, source, message), logs(n) → [...],                                                // Ringpuffer, auch console
  info() → { version, build, platform, host, display, fps, hz, quality, uptime, storageBytes, apps, services },
}
```
- Bestehende direkte Browser-Zugriffe hinter `V.platform` legen (gezielt, kleine Edits): `V.haptic` (sound.js),
  Speicher (store.js, emulator-Schlüssel), Kamera (presence.js), Helligkeit/Lichtsensor (ambient.js, Emulator-Regler).
- `device.html`: dasselbe OS **ohne** Emulator, Display füllt den Bildschirm (Kreis mittig, `min(vw, vh)`), schwarzer Grund,
  `V.platform.host = 'device'`. Tastatur: Esc/Home = Sockeltaste, „/“ oder Leertaste = Visto (Texteingabe als schlichte
  runde Eingabe im Display, weil am Gerät sonst gesprochen wird). `?skip`, `?app=` wie gehabt. Skriptliste identisch zu
  index.html (Build prüft das). Pages-Workflow kopiert `device.html` mit (`.github/workflows/pages.yml`).
- Neue App „Diagnose“ (`js/apps/system.js`, id `system`, order 95, Symbol passend): runder Systemmonitor –
  Bildrate als Ring, Qualität, Prozesse, Dienste, Speicher, Protokoll; „Neu starten“.
- `linux/`: `README.md` (Aufbau: cage/Wayland-Kiosk + Chromium oder Cog auf `device.html`, 1080×1080, 90 Hz),
  `visto-kiosk.service`, `vistod.service`, `start-kiosk.sh`, `vistod.py` (Referenzdienst: WebSocket, Helligkeit über
  /sys/class/backlight, Lichtsensor über iio, WLAN über nmcli). Klar als „auf Hardware ungetestet“ kennzeichnen.

## B · Lumen-Engine  (`js/gfx/lumen.js`, `js/sys/perf.js`)

WebGL2 (Rückfall WebGL1 → aus) auf `V.display.back` und `V.display.light`.
```js
V.lumen = {
  ok, quality,                              // 0 aus · 1 sparsam · 2 voll
  scene(name),                              // 'home' | 'launcher' | 'app' | 'visto' | 'ambient' | 'off' – folgt selbst 'shell:mode'
  tint(hex | null, strength = 1),           // Lichtfarbe (App-Farbe); null = Akzent
  touch(x, y, kraft),                       // Lichtreflex + Welle (hängt sich selbst an pointer-Ereignisse des Displays)
  flare({ x, y, color, kind: 'iris' | 'ring' | 'burst', size }),   // z. B. beim App-Start vom Symbol aus
  energy(0…1),                              // z. B. Musikpegel, Visto spricht
}
V.perf = { level (0 niedrig · 1 mittel · 2 hoch), fps, frameMs, on(fn), pin(level|null) }   // Ereignis 'perf:level'
```
- **Lichtgrund (back):** OLED-treu – fast schwarz, darin langsam fließende, weiche Lichtschleier (wenige Prozent
  Helligkeit, Rand geht in Schwarz), eingefärbt mit `tint`, wärmer am Abend; Berührung schickt eine sanfte Welle,
  Kopfposition (`V.presence.state`) verschiebt das Licht leicht (Parallaxe). Text muss immer klar lesbar bleiben.
- **Licht (light):** kurzer weicher Lichtfleck unter dem Finger mit auslaufendem Ring; `flare` als Linsen-Lichtring
  (dünn, mit Farbsaum) – wird beim App-Öffnen/-Schließen von der Shell gerufen; ein kaum sichtbares Glanzlicht am
  Glasrand, das mit Kopfposition/Zeit wandert.
- **Leistungsregler:** gleitende Bildzeit; Stufen senken Auflösung der Lumen-Ebenen und der Leuchtebene (fx.js:
  kleine Stellschraube ergänzen), bei 0 pausiert der Lichtgrund (statisches Bild). `V.loop` nicht verändern.
- Im Ruhemodus (`'ambient'`) und bei `document.hidden` praktisch keine GPU-Last.

## C · Horizont, Zeitreise, Live-Rand  (`js/os/horizon.js`, `js/os/live.js`)

```js
V.live.set(id, { app, color, icon, value: 0…1 | null, label, sub, priority = 0, pulse = false })
V.live.clear(id) · V.live.list()
// Darstellung: dünne, gestapelte Lichtbögen ganz außen am Rand (über V.rim/fx oder eigene Zeichnung), je mit kleinem
// Symbol am Bogenkopf; die Aktivität der gerade offenen App wird ausgeblendet; Antippen (hooks.tap) öffnet die App.
// Bisherige Hintergrundbögen (timer 'timer:bg', focus 'focus:bg', stoppuhr, musik, wecker) darauf umstellen.

V.horizon.provide(id, (from: Date, to: Date) => [{ start: Date, end?: Date, kind: 'event'|'weather'|'sun'|'alarm'|'timer'|'reminder',
                                                    color, icon?, label, sub? }])
V.horizon.items(from, to) · V.horizon.offset (ms, 0 = jetzt) · V.horizon.at() → Date
V.time.view() → Date            // Jetzt + Zeitreise; Zifferblätter bekommen diese Zeit in frame(dt, now)/minute(now)
Ereignis 'horizon:travel' { offset, at, active }
```
- **Horizont:** auf dem Zifferblatt die nächsten 12 Stunden am Rand, an der Uhr ausgerichtet (Winkel = Uhrzeit auf dem
  12-Stunden-Blatt, „jetzt“ als feine Marke): Termine als Bögen, Wetter-/Sonnen-/Wecker-Zeichen. Zurückhaltend; kurz nach
  dem Wecken und beim Berühren des Rands präsent, sonst nur ein Hauch. Zifferblätter können per `def.horizon`
  (`'rim'` Standard · `'travel'` nur bei Zeitreise · `false`) steuern, weil manche den Rand selbst nutzen (Ringe, Chronos).
  Anbieter einrichten: Kalender (Termine), Wetter (alle 3 h + Sonnenauf-/-untergang), Wecker, Timer, Erinnerungen –
  die Daten der Apps über deren vorhandene Schnittstellen holen (`V.weather`, `V.info.*`; fehlende kleine Getter in
  den App-Dateien per Edit ergänzen).
- **Zeitreise:** `hooks.homeCrown` – Drehen spult vor/zurück (360° = 12 h, fühlbare Rastung je 15 min), Zifferblatt zeigt
  `V.time.view()`, eine ruhige Glas-Kapsel nennt „In 3 Std. · 16:00“ und was dann ist (Wetter, Termin); Loslassen →
  nach kurzer Pause federnd zurück ins Jetzt (Zeiger laufen sichtbar zurück). faces.js entsprechend anpassen.

## D · Blicke und Karussell  (`js/os/glances.js`, `js/os/switcher.js`)

```js
V.glances.register({ id, app, name, order, create(root, ctx) → { update(), destroy() } })   // ctx: { open(params), accent(), onFrame, on }
// oder in der App-Definition: glance: { order, create(root, ctx) }
V.glances.show(id | 'face') · V.glances.current
V.switcher.open() / close() / isOpen · V.sys? unabhängig: merkt sich die zuletzt benutzten Apps über 'app:open'
```
- **Blicke:** Seiten links/rechts vom Zifferblatt (`hooks.homeSwipeX`). Wischen folgt dem Finger; die Seiten laufen wie
  auf einem **Drehteller** (Drehung um einen Punkt weit unter dem Display, leichte Verkleinerung/Unschärfe der gehenden
  Seite), Feder zum Einrasten, Seitenpunkte als Bogen. Ein Blick ist eine runde Kurzansicht einer App (groß, ruhig, eine
  Aussage), Antippen öffnet die App. Rahmenwerk + vier Blicke mitliefern: Wetter, Kalender (nächste Termine), Musik
  (läuft/Start), Zuhause (Licht/Temperatur). Nach Ruhe zurück zum Zifferblatt. `V.faces.next` per Wischen entfällt
  (Zifferblattwechsel im Editor).
- **Karussell:** `hooks.baseDouble` – zuletzt benutzte Apps als Scheiben auf einem Ring, am Rand drehen oder wischen,
  antippen öffnet; mit Live-Zustand (z. B. Restzeit) unter dem Namen. Glas, Tiefe, Feder.

## E · Gestaltung 2.0  (`css/design2.css`, kit.js, launcher.js, Shell-Übergänge – macht die Hauptsitzung)

Glas-Klassen `.vos-glass(.thin|.thick|.tint)`, angehobene Grundbausteine (Knöpfe, Chips, Karten, Zeilen, Banner),
`V.ui.pie(items, {x, y})` (Tortenmenü), Tiefe (Unschärfe statt Schwarz), App-Symbole 2.0, Orbit 2.0.
