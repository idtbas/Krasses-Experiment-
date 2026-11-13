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
index.html               lädt alle Skripte (klassische Skripte, Namensraum window.V)
css/visto.css            Emulator + Grundbausteine des OS (.vos-*)
js/core/   base (V.util, V.on/emit, V.css) · anim (V.loop, V.spring, V.tween, V.ease)
           store (V.store) · time (V.time, V.fmt) · sound (V.sound, V.haptic) · gestures (V.gesture)
js/ui/     icons (V.icon) · kit (V.ui)
js/os/     display · fx (Leuchtebene) · rim (V.rim) · apps (V.apps, V.actions) · notify · faces
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
Ereignisse: 'time:second', 'time:minute'

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

### Zifferblatt

```js
V.faces.register({ id, name, order, options: [{key, label, type:'color'|'choice'|'toggle', values:[{v, label}], default}],
  create(root, ctx) { /* ctx.opts, ctx.color(), ctx.accent(), ctx.preview */
    return { minute(now), frame(dt, now), setOptions(opts), ambient(on), destroy() }; } });
```
Hilfen: `V.faces.rollDigits(el)` (rollende Ziffern), `V.faces.renderComplications(el)`, `V.faces.COLORS`.

## Testen

```
node visto/tools/shot.js AUSGABE.png "?skip&app=weather" '[{"wait":1500},{"tap":[500,700]},{"swipe":[500,700,500,300]},{"eval":"V.shell.home()"},{"type":"Wie wird das Wetter?"}]' --display
```
`?skip` überspringt Start und Einrichtung, `?app=id` öffnet eine App, `?face=id` ein Zifferblatt.
Das Skript meldet Konsolenfehler (`FEHLER:`). Screenshots mit dem Read-Werkzeug ansehen und so lange
verbessern, bis es wirklich hochwertig aussieht. Mehrere Zwischenstände: `{"shot":"pfad.png"}` als Schritt.
