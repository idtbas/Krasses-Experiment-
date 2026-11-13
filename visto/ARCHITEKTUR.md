# VistoOS – Architektur und Leitfaden für Mitwirkende

VistoOS ist das Betriebssystem von **Visto**, einem Schreibtisch-Assistenten mit **rundem 7″-OLED-Display**
(1080 × 1080, exakt kreisrund, 90 Hz, Touch) auf einem Sockel. Diese Website ist ein **Emulator für das Handy**.
Maßstab: Stell dir vor, Apple baut ein rundes Gerät für den Schreibtisch.

## Gestaltungsgrundsätze (verbindlich)

1. **Der Kreis ist das Raster.** Jede Stelle wird genutzt: Text folgt Bögen, Listen werden zum Rand hin kleiner,
   Fortschritt läuft **am Rand entlang** (kein Ladebalken, nie). Inhalte im Mittelteil, Akzente am Rand.
2. **OLED-Schwarz.** Hintergrund fast immer reines `#000`. Farbe sparsam, leuchtend, mit weichem Glühen.
3. **Bewegung ist Physik.** Übergänge mit Federn (`V.spring`, response 0.35–0.7, bounce 0–0.25), nie linear.
   Alles reagiert auf Berührung (Druckeffekt, Haptik, leiser Klick). 90 Hz: Animationen zeitbasiert über `V.loop`.
4. **Apple-Niveau.** Großzügiger Weißraum, klare Hierarchie, Schrift *Inter Tight* (Ziffern `tabular-nums`,
   große Zahlen dünn: 150–250), kleine Großbuchstaben-Etiketten mit Sperrung (`.vos-label`).
5. **Deutsch** mit korrekten Umlauten und „deutschen Anführungszeichen“. Kurz, freundlich, präzise.
6. **Visto-Zone frei lassen:** unten mittig (logisch y > 870 und |x − 500| < 175) liegt Visto als Linie –
   dort keine Bedienelemente platzieren.

## Koordinaten und Maße

- Das Display ist ein Container (`container-type: size`): **1cqw = 1 % des Durchmessers**. Alle CSS-Maße in `cqw`.
- Logisch: **0…1000**, Mitte (500, 500), Radius 500. SVG mit `viewBox="0 0 1000 1000"` und Klasse `vos-svg`.
  10 logische Einheiten = 1cqw.
- Winkel sind **Uhrwinkel in Grad**: 0° = oben, im Uhrzeigersinn. `V.display.pt(a, r)` → `{x, y}`.
- Sicherer Bereich (einbeschriebenes Quadrat): `.vos-safe`. Kreisbreite auf Höhe y: `V.display.chord(y)`.

## Dateien

```
index.html               lädt alle Skripte (klassische Skripte, Namensraum window.V) – Wirt „Emulator“
device.html              dieselben Skripte ohne Emulator – Wirt „Gerät“ (siehe Abschnitt „System“)
css/visto.css            Emulator + Grundbausteine des OS (.vos-*)
js/sys/    platform (V.platform: Hardware-Treiber web/linux) · kernel (V.sys) · device (Gerätemodus, V.host)
           perf (V.perf: Leistungsregler)
js/gfx/    lumen (V.lumen: Licht unter und über der Oberfläche, WebGL – siehe Abschnitt „Lumen“)
js/core/   base (V.util, V.on/emit, V.css) · anim (V.loop, V.spring, V.tween, V.ease)
           store (V.store) · time (V.time, V.fmt) · sound (V.sound, V.haptic) · gestures (V.gesture)
js/ui/     icons (V.icon) · kit (V.ui)
js/os/     display · fx (Leuchtebene) · rim (V.rim) · apps (V.apps, V.actions) · notify · faces
           live (V.live, Live-Rand) · horizon (V.horizon, Horizont und Zeitreise)
           glances (V.glances, Blicke auf dem Drehteller) · switcher (V.switcher, Karussell der letzten Apps)
           launcher · shell · ambient · control* · faceeditor* · boot* · setup*
js/visto/  visto (Figur) · voice (Sprache) · brain (Verstehen, Claude) · conversation (Ablauf)
js/faces/  Zifferblätter        js/apps/  Apps        js/emulator/  Handy-Seite      js/main.js
tools/shot.js  Screenshots (Playwright)
```
`*` = eigenständige Module mit klarer Schnittstelle (siehe unten).

## Wichtigste Schnittstellen

```js
// Hilfen
const U = V.util;  U.el(tag, {class, style, text, html, attrs, data, on}, ...kinder)  U.svg(tag, attrs, ...)
U.clamp, U.lerp, U.smoothstep, U.mix(hex, hex, t), U.rgba(hex, a), U.rng(seed), U.noise(x), U.uid()
V.css('meine-app', `.ma-x { … }`)      // Stile einmalig einhängen – Präfix je Datei!
V.on('ereignis', fn) → off ; V.emit('ereignis', daten)

// Bewegung
V.loop.add((dt, t) => …, z) → off       // jedes Bild; dt in Sekunden
const s = V.spring(0, {response: .5, bounce: .15}); s.onUpdate(v => …); await s.to(1); s.set(0)
await V.tween({from, to, duration, ease: V.ease.smooth, onUpdate(v, t)}).promise
V.ease.smooth / outCubic / outBack / inOutSine / outExpo / bezier(...)

// Speicher (Browser-Speicher, robust)
V.store.get('settings.accent') ; V.store.set('settings.volume', .5)   // Ereignis 'store:settings.volume'
const data = V.store.app('meine-app', {standard: 1}); data.x = 2; V.store.save();

// Zeit
V.time.now() (Date, berücksichtigt manuell gestellte Uhr) · V.time.ms() · V.time.isNight()
V.fmt.time(d) '14:05' · dateLong(d) · dateShort(d) · relDay(d) · duration(s) '4:59' · durationWords(s) · weekday(d)
Ereignisse: 'time:second', 'time:minute' · Visto: 'convo:open', 'convo:close', 'convo:closed' (nach dem Ausblenden)

// Klang & Haptik
V.sound.play('tap'|'tick'|'open'|'close'|'success'|'notify'|'error'|'wake'|'sleep')
const stop = V.sound.alarm('chime'|'marimba'|'pulse'|'sunrise') ; V.sound.ctx() (AudioContext) ; V.sound.out() (Hauptausgang)
V.haptic(ms|muster)

// Gesten (Display-Koordinaten 0…1000)
V.gesture(el, {start(p), move(p), end(p), tap(p), long(p)}, {slop, longMs})
// p: x, y, dx, dy, vx, vy, r, a (Uhrwinkel), dA (aufsummierte Drehung am Rand), moved
// Elemente mit data-nogesture="all" (oder "y" für senkrechtes Scrollen, "x") behalten ihre Gesten.

// Rand
V.rim.arc(id, {value 0…1, from 0, color, width 9, r 488, glow 1, track, head, smooth, alpha}) ; V.rim.remove(id)
const l = V.rim.loading({color}); await l.done()          // Ladekreis: Linie fährt am Rand entlang
V.rim.pulse({at: 0, color}) ; V.rim.level('Lautstärke', .6, {color, side:'right'}) ; V.rim.aurora(0…1)
V.rim.tail(ctx, cx, cy, r, a0, a1, color, width, alphaKopf, alphaSchwanz)   // Bogen mit Verlauf (Leuchtspur) auf eigener Leinwand

// UI-Bausteine (js/ui/kit.js)
V.ui.title(root, 'Timer')                       // geschwungener Titel oben
V.ui.arcText({text, r, side:'top'|'bottom', size, weight, color, spacing}) → {el, set(t)}
V.ui.arcPath(cx, cy, r, a0, a1)                  // SVG-Pfad eines Bogens
V.ui.fitText(container, text, {top, bottom, size})  // Zeilen nutzen die Kreisbreite
V.ui.roundList({items:[{icon, color, title, sub, end, onClick}|{section}], header}) → {el, setItems, crown}
V.ui.wheel({items, index, onChange, rows, itemH, size}) → {el, get, set, crown}
V.ui.button(text, {icon, kind:'primary'|'white'|'danger'|'ghost', size:'sm', onClick})
V.ui.roundButton(icon, {kind:'lg'|'sm', style, onClick, label}) ; V.ui.tap(el, fn) ; V.ui.icon(app, size)
V.ui.rimDrag(el, {start, drag(p, dA), end}, {minR})  // am Rand drehen
V.icon('name') → SVG-String (Namen: siehe js/ui/icons.js; eigene: V.icon.add('name', '<path …/>'))
CSS-Klassen: .vos-btn(.primary/.white/.danger/.ghost/.sm) .vos-round(.lg/.sm) .vos-chip(.on) .vos-card
            .vos-h1 .vos-h2 .vos-body .vos-small .vos-label .vos-num .vos-hero .vos-switch(.on) .vos-center

// Hinweise
V.notify.banner({title, body, icon, color, silent}) ; await V.notify.alert({title, body, icon, color, alarm, buttons:[{label, kind, value}]})
V.notify.toast('Gespeichert', 'check')

// Kamera (Gesichtsposition, alles lokal)
V.presence.state → {present, x, y (−1…1 aus Sicht der Person), near (0 weit … 1 nah), looking}
Ereignisse: 'presence' (laufend), 'presence:arrive', 'presence:leave', 'presence:look'
V.presence.start('camera'|'sim') · V.presence.off() · V.visto.watch(x, y) (macht presence.js selbst)

// Navigation
V.shell.open(appId, params, origin) ; V.shell.home() ; V.shell.launcher() ; V.shell.back() ; V.shell.mode
```

### Eine App

```js
V.apps.register({
  id: 'weather', name: 'Wetter', icon: 'weather', color: '#3D8BFF', order: 20,
  keywords: ['wetter', 'regen'],            // für „öffne …“
  keepAwake: () => playing,                 // optional: nicht nach Ruhezeit schließen
  init() {                                  // einmal beim Start: Dienste, Aktionen, Absichten, Datenquellen
    V.info.weather = () => ({temp, icon, text, hi, lo, place});
    V.actions.register('weather.forecast', {desc, params: {day: {type: 'number'}}, required: [], run(a) { return {say, card}; }});
    V.brain.intent({id: 'wx', priority: 7, match: [/\bwetter\b/], run(m, t, original) { return {say, card, emotion}; }});
  },
  create(ctx) {                             // beim Öffnen. ctx.root ist der runde App-Container
    ctx.title('Wetter');
    ctx.onFrame((dt, t) => …);  ctx.on('time:minute', …);  ctx.rim.arc('x', {...}); ctx.timeout/interval
    ctx.store (= V.store.app(id)), ctx.save(), ctx.close(), ctx.params
    return { destroy() {}, crown(dA) {}, back() { return wurdeInternBehandelt; } };
  },
});
```
Aufräumen von `ctx.onFrame/on/rim/timeout/interval` geschieht automatisch.
`back()` → `true`, wenn die App eine Unteransicht schließt (z. B. Detail → Liste).

### Visto-Absichten

`V.brain.intent({id, priority, match, run})`: `match` ist eine Liste von RegExp auf normalisiertem Text
(klein, Zahlwörter → Ziffern, „ein/eine“ bleiben) oder eine Funktion `t → Treffer|null`.
Achtung: `\b` funktioniert in JS **nicht** neben ä/ö/ü/ß – nutze `(?<![a-zäöüß])` bzw. `(?![a-zäöüß])`.
Hilfen: `V.brain.parseDuration(t)` → Sekunden, `V.brain.parseTime(t)` → `{date, h, m, rel}`.
Antwort: String oder `{say, card, emotion, open, params}` (`open` öffnet die App nach der Antwort mit `params`); `card`: `{type:'big', text, sub}` · `{type:'icon', icon, color, title, sub}` · `{type:'el', el}`.
`emotion`: happy, love, wink, sleepy, surprised, thinking, sad, confused. `say` kurz (≤ 2 Sätze).
Aktionen (`V.actions.register`) werden Claude automatisch als Werkzeuge angeboten – Beschreibung präzise halten.

### Datenquellen für Zifferblätter (V.info)

`V.info.weather()` · `V.info.nextEvent()` → `{title, start}` · `V.info.timer()` · `V.info.music()` → `{title, artist, playing, color}`
Zeiträume (für Horizont/Zeitreise): `V.info.events(from, to)` · `V.info.alarms(from, to)` → `[{date, label}]` ·
`V.info.timers()` → `[{label, left, total, paused, end}]` · `V.info.reminders(from, to)` → `[{text, at}]` · `V.weather.at(date)`

### Zifferblatt

```js
V.faces.register({ id, name, order, options: [{key, label, type:'color'|'choice'|'toggle', values:[{v, label}], default}],
  create(root, ctx) { /* ctx.opts, ctx.color(), ctx.accent(), ctx.preview */
    return { minute(now), frame(dt, now), setOptions(opts), ambient(on), travel(on), destroy() }; } });
```
Hilfen: `V.faces.rollDigits(el)` (rollende Ziffern), `V.faces.renderComplications(el)`, `V.faces.COLORS`.
`now` ist die **angezeigte** Zeit – bei der Zeitreise die Reisezeit (siehe „Horizont & Live-Rand“): nie selbst `V.time.now()` lesen.

## Horizont & Live-Rand (js/os/horizon.js · js/os/live.js)

„Zeit ist rund“: Der Rand zeigt, was kommt (Horizont), was läuft (Live-Rand), und lässt die Zeit drehen (Zeitreise).

```js
// Live-Rand – laufende Dinge als dünne Lichtbögen ganz außen, Symbol am Bogenkopf; Antippen öffnet die App
V.live.set(id, { app, color, icon, value, label, sub, priority = 0, pulse, paused, span, params })
//   value: 0…1 · null (läuft ohne Fortschritt: kreisender Schweif) · () => 0…1 (wird beim Zeichnen gelesen)
//   span: nur ein Schweif dieser Länge (Anteil) hinter dem Kopf, z. B. Stoppuhr · label/sub: Text oder () => Text
V.live.clear(id) · V.live.list() → [{id, app, color, icon, value, label, sub, priority, pulse, paused}] · V.live.has(id)
// Ereignis 'live:changed' {id, on}

// Horizont – die nächsten 12 Stunden am Rand des Zifferblatts, Winkel = Uhrzeit auf dem 12-Stunden-Blatt
V.horizon.provide(id, (from, to) => [{ start: Date, end?: Date, kind: 'event'|'weather'|'sun'|'alarm'|'timer'|'reminder',
                                       color, icon?, label, sub? }])        // → Abmelden()
V.horizon.items(from, to) · V.horizon.refresh() · V.horizon.describe(date) → {weather, current: [...], next}

// Zeitreise – am Rand des Zifferblatts drehen (360° = 12 h, Rastung je Viertelstunde auf der Uhr)
V.horizon.active · V.horizon.offset (ms, läuft weich) · V.horizon.at() → Date (gerastete Reisezeit, sonst jetzt)
V.horizon.travel(date | msVersatz, {hold}) · V.horizon.back()
V.time.view() → Date                       // Jetzt + Zeitreise, läuft weich mit (für Zeiger)
// Ereignis 'horizon:travel' {offset, at, active}  – bei jeder Rastung, während des Rücklaufs, am Ende
```
- **Live-Rand:** bis zu drei Spuren (r 486 · 475 · 464), nach `priority` von außen nach innen. Die Aktivität der offenen
  App wird ausgeblendet; in anderen Apps bleibt nur das Symbol mit kurzem Schweif (der Rand gehört dort der App).
  Unter Systemebenen, im Ruhemodus und während der Zeitreise tritt er zurück. Apps melden sich in `init()` an und
  räumen selbst ab (`clear`). Bereits angebunden: Timer, Fokus, Stoppuhr, Musik, Wecker (Schlummern, letzte 5 Minuten).
- **Horizont:** eigene Leinwand im Startbildschirm (unter Visto und unter dem Live-Rand). Marke = jetzt; von dort im
  Uhrzeigersinn 11,5 Stunden: hauchdünnes Band (warm = Tag, blau = Nacht, aus den Sonnenzeiten), Termine als Bögen,
  Zeichen für Wetter (je 3-Stunden-Block, auf den Diagonalen), Sonnenauf-/-untergang, Wecker, Timer-Ende, Erinnerungen.
  „Hauch“ in Ruhe; präsent kurz nach dem Wecken, beim Berühren des Rands und bei der Zeitreise; im Ruhemodus aus.
  Wo das Band die Visto-Linie kreuzen würde, läuft es dahinter durch (blendet aus); Zeichen rücken dort an den Rand.
  Anbieter (Kalender, Wetter, Wecker, Timer, Erinnerungen) sind in horizon.js eingerichtet – eigene mit `provide`.
- **Zeitreise:** `hooks.homeCrown`. Die Marke wandert mit, ein Lichtfaden spannt sich vom Jetzt (kleiner Ring) zur
  Reisezeit, die Glas-Kapsel nennt „In 2 Std. 53 Min. · 17:00“ und was dann ist. Loslassen → 2,4 s Pause → federt zurück
  (`V.motion.gentle`); Antippen kehrt sofort zurück. Grenzen −24 h … +48 h. Verlässt man das Zifferblatt, endet sie.
- **Zifferblätter:** `frame(dt, now)` bekommt `V.time.view()` (weich – Zeiger laufen mit), `minute(now)` die gerastete
  Reisezeit (Ziffern, Datum; bei rascher Folge schalten `rollDigits`-Ziffern knackig um statt zu rollen),
  `travel(on)` meldet Beginn/Ende (Sekundenanzeigen ausblenden). `V.faces.complicationText` liefert bei der Zeitreise
  die Werte der Reisezeit. In der Definition: `horizon: 'rim'` (Standard) · `'travel'` (nur bei Zeitreise) · `false`,
  `horizonR` (Radius des Bands, Standard 452; > 475 = ganz außen mit kleineren Zeichen),
  `horizonCapsule` (Höhe der Kapsel-Mitte in cqw, Standard 25, oder `{y, compact, info}` für eine einzeilige Kapsel).
- **Visto:** „Was ist in drei Stunden?“, „Was ist um 18 Uhr?“, „Zeitreise auf morgen früh“ → Antwort, danach dreht sich
  das Zifferblatt sichtbar dorthin und federt zurück.

## System (js/sys/ · device.html · linux/)

VistoOS ist ein Betriebssystem mit zwei **Wirten**: `index.html` (Emulator um das Gerät herum) und `device.html`
(Gerätemodus: das OS allein, Kreis = `min(Breite, Höhe)`, schwarzer Grund – das startet der Linux-Kiosk).
Beide laden **dieselbe Skriptliste**; `node visto/tools/build.js --check` prüft das. Neue Skripte in beide eintragen.

```js
// Plattformschicht (js/sys/platform.js) – Hardware nie direkt über Browser-Funktionen ansprechen, sondern so:
V.platform.name 'web'|'linux' · host 'emulator'|'device' · caps {camera, mic, haptics, backlight, lightSensor, wifi, speech}
V.platform.storage.get/set/remove(key) · keys() · bytes()            // V.store nutzt das; eigene Schlüssel 'vistoos.…'
V.platform.display.setBacklight(0…1) → bool (false = Software-Abdunklung) · light.value() / onChange(fn) / set(v)
V.platform.haptics.pulse(muster) (über V.haptic) · camera.open({facing}) / close() · mic.open() / close()
V.platform.net.online() · net.wifi.current() / scan() / connect(ssid, pass) · power.reboot() / shutdown()
V.platform.bridge.connected / send(type, data) → Promise / on(type, fn)   // nur linux: WebSocket zu vistod
Ereignisse: 'platform:bridge' · 'platform:light' · 'platform:camera' · 'platform:mic' · 'platform:net' · 'platform:power'

// Kern (js/sys/kernel.js)
V.sys.info() → {version, build, platform, host, display, fps, hz, quality, uptime, storageBytes, apps, services, …}
V.sys.services.register('name', api, {desc, state() → 'running'|'idle'|'off', detail()}) · get(name) · list()
V.sys.procs.list() → [{id, name, state: 'running' (offen) | 'paused' (Hintergrundarbeit), since, permissions}]
await V.sys.perm.request(appId, 'camera'|'mic'|'notify') → bool · perm.has(appId, name) · perm.list()
V.sys.log('info'|'warn'|'error', 'quelle', 'Text') · V.sys.logs(n)     // Ringpuffer; console.warn/error landen mit darin
Ereignisse: 'sys:log' · 'sys:procs' · 'sys:perm'
```
- **Treiber `linux`** (`?platform=linux`): spricht mit dem Dienst `vistod` (ws://127.0.0.1:7707). Ohne Dienst fällt jede
  Funktion auf den Web-Treiber zurück und verbindet sich später von selbst. Paket und Protokoll: `linux/README.md`
  (auf Hardware ungetestet; `python3 linux/vistod.py --simulate --www .` zum Ausprobieren).
- **Gerätemodus-Tastatur** (`js/sys/device.js`): Esc/Home = Sockeltaste · „/“ oder Leertaste = an Visto schreiben
  (`V.convo.typing(text)` zeigt Getipptes wie Gehörtes unter dem Ring; Enter sendet).
- **Diagnose** (`js/apps/system.js`, App `system`): Bildrate als Randbogen, Bildzeit-Kranz, Prozesse, Dienste, Speicher,
  Protokoll, Neu starten. `V.shell.open('system', {page: 'procs'|'services'|'storage'|'log'})`.
- Im Gerätemodus testen: `VISTO_URL=file://$PWD/visto/device.html node visto/tools/shot.js …`
  (statt `{"type": …}` dort `{"eval":"V.convo.input('…')"}` – die Emulator-Eingabe gibt es nicht).

## Lumen (js/gfx/lumen.js · js/sys/perf.js)

Licht als eigene Schicht, mit WebGL (2, sonst 1) auf zwei Leinwänden gerechnet. Ohne WebGL ist `V.lumen.ok = false`,
alle Aufrufe bleiben folgenlos, das System läuft unverändert weiter.

- **Lichtgrund** (`V.display.back`, unter allem): wie eine von unten beleuchtete Glasscheibe – eine weiche Lichtsichel
  über Vistos Linie, zwei langsam wandernde Schleier, zur Mitte und zum Rand reines Schwarz (höchstens ~14 %
  Anzeigehelligkeit). Farbe = Akzent bzw. App-Farbe, abends wärmer, nachts dunkler. Berührung schickt eine Welle
  hindurch, die Kopfposition (`V.presence`) verschiebt das Licht leicht.
- **Licht** (`V.display.light`, über Inhalt und Hinweisen, unter Visto): Lichtfleck unter dem Finger mit auslaufendem
  Ring, Lichtring `flare` mit Farbsaum, Glanzlicht am Glasrand (oben links, wandert mit Zeit und Kopf).
  Die Ebene mischt wie „screen“, ohne CSS-Mischmodus (vormultipliziertes Alpha).

```js
V.lumen.scene('home'|'launcher'|'app'|'visto'|'ambient'|'off')   // folgt selbst 'shell:mode', 'ambient', 'convo:open/close'
V.lumen.tint('#3D8BFF' | null, stärke = 1)                        // folgt selbst 'app:open' (App-Farbe) / 'app:close'
V.lumen.touch(x, y, kraft = 1)                                    // hängt selbst an den Zeigerereignissen des Displays
V.lumen.flare({ x, y, color, kind: 'iris'|'ring'|'burst', size, reverse, strength, duration })
V.lumen.energy(0…1)                                               // Musikpegel, Visto spricht: Lichtgrund wird lebhafter
V.lumen.quality  (0 aus · 1 sparsam · 2 voll; Zuweisen hält fest, null = wieder selbst) · V.lumen.state() · V.lumen.refresh()

V.perf.level (0 · 1 · 2) · V.perf.fps · frameMs · workMs · hz · V.perf.on(fn(level, vorher)) · V.perf.pin(level | null)
Ereignis 'perf:level' · URL-Schalter ?perf=0|1|2
```
- `flare`: `iris` läuft vom Symbol (`size` = Radius, logisch) über das ganze Display, im Takt der runden App-Blende;
  `reverse: true` zieht den Ring zum Symbol zurück (Schließen). `ring` = kurzer Ring um eine Stelle, `burst` =
  weiches Aufleuchten mit Ring. Die Shell ruft `flare` beim Öffnen/Schließen; Apps dürfen es für Bestätigungen nutzen.
- **Apps und der Lichtgrund:** Unter einer App mit deckendem Hintergrund ruht der Lichtgrund (er wäre unsichtbar).
  Wer das Licht in App-Farbe zeigen will, lässt den Hintergrund seines App-Bildschirms durchsichtig; ändert eine App
  das nachträglich, `V.lumen.refresh()` rufen. Zifferblätter können mit `lumen: false` in der Definition reines
  Schwarz verlangen (das Nachtblatt tut es).
- **Leistungsregler** `V.perf`: misst die gleitende Bildzeit gegen den Takt des Displays. Über 130 % für rund zwei
  Sekunden → eine Stufe hinunter; lange unter 110 % → vorsichtig wieder hinauf (Wartezeit verdoppelt sich nach jedem
  Rückfall). Die Stufe wird gemerkt. Stufen senken die Auflösung beider Lumen-Ebenen und der Leuchtebene
  (`fx.js`: Leuchtpuffer ⅓ → 1/3,75 → 1/4,5, auf Stufe 0 zusätzlich höchstens 1,5-fache Pixeldichte);
  auf Stufe 0 steht der Lichtgrund still. Eigene aufwendige Effekte bitte an `V.perf.level` koppeln.
- **Sparsamkeit:** Lichtgrund in ~40 % der Gerätepixel und nur 30-mal je Sekunde, solange nichts geschieht; die
  Lichtebene zeichnet nur die Rechtecke, in denen Licht liegt, und ruht sonst. Im Ruhemodus, unter deckenden Apps und
  bei verstecktem Tab wird nichts gezeichnet (Leinwände unsichtbar). Kontextverlust wird abgefangen und wiederhergestellt.

## Testen

```
node visto/tools/shot.js AUSGABE.png "?skip&app=weather" '[{"wait":1500},{"tap":[500,700]},{"swipe":[500,700,500,300]},{"eval":"V.shell.home()"},{"type":"Wie wird das Wetter?"}]' --display
```
`?skip` überspringt Start und Einrichtung, `?app=id` öffnet eine App, `?face=id` ein Zifferblatt.
Das Skript meldet Konsolenfehler (`FEHLER:`). Screenshots mit dem Read-Werkzeug ansehen und so lange
verbessern, bis es wirklich hochwertig aussieht. Mehrere Zwischenstände: `{"shot":"pfad.png"}` als Schritt.

## Gestaltung 2.0 „Glas & Licht“ (css/design2.css)

- **Glas:** `.vos-glass` (+ `.thin` · `.thick` · `.tint` mit `--tint: Farbe` · `.blur` für echte Hintergrundunschärfe –
  nur wenn Inhalt dahinter liegt). Knöpfe, Chips, Karten, Listenzeilen, Schalter, Banner und App-Symbole sind bereits
  systemweit Glas mit Lichtkante – eigene Flächen bitte ebenfalls mit `.vos-glass` statt grauer Füllung bauen.
- **Bewegung:** nur die vier Federn `V.motion.snappy` (Tippen, Schalter) · `smooth` (Ebenen, Seiten) · `bouncy`
  (Erscheinen, Bestätigen) · `gentle` (Licht, große Flächen): `V.spring(0, V.motion.bouncy)`.
- **Tiefe:** Was zurücktritt, wird Milchglas (Unschärfe + leichte Abdunklung), nie hartes Schwarz.
- **Tortenmenü:** `const wahl = await V.ui.pie([{id, icon, label, color, danger}], {x, y, title})` – für
  Kontextaktionen bei langem Drücken (in Apps: `V.gesture(el, {long(p) { … V.ui.pie(…, {x: p.x, y: p.y}) }})`).
- **Shell-Erweiterungspunkte:** `V.shell.hooks` (homeSwipeX, homeCrown, tap[], long[], baseDouble) – siehe SPEC-2.0.md.
