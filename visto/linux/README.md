# VistoOS auf Linux – Kiosk und Gerätedienst

> **Status: Vorlage. Auf echter Visto-Hardware ungetestet.**
> Dieses Paket beschreibt, wie VistoOS auf dem Gerät (rundes 7″-Display, 1080 × 1080, 90 Hz) starten soll.
> Geprüft wurde bisher nur am Entwicklungsrechner:
>
> | Teil | Stand |
> |---|---|
> | `vistod.py --simulate` gegen `device.html?platform=linux` im Browser (Brücke, Protokoll, Helligkeit und Lichtsensor über nachgebildete sysfs-Dateien, WLAN vorgetäuscht, Rückfall und Wiederverbinden) | **getestet** (Chromium, automatisiert) |
> | Auslieferung der Seite durch `vistod` (`--www`) | **getestet** |
> | `start-kiosk.sh` (Ablauf mit Platzhalter-Browser), Syntax der systemd-Units | geprüft (`sh -n`, `systemd-analyze verify`) |
> | cage, Chromium/Cog im Kiosk, echte Hintergrundbeleuchtung, echter Lichtsensor, `nmcli`, Neustart, 90 Hz | **ungetestet** |
>
> Wer es auf Hardware in Betrieb nimmt: bitte Abweichungen hier nachtragen.

## Aufbau

```
┌──────────────────────────── Gerät (Linux) ────────────────────────────┐
│  systemd                                                              │
│   ├─ vistod.service        python3 vistod.py --www /opt/visto         │
│   │     · http://127.0.0.1:7707/        liefert device.html, css/, js/│
│   │     · ws://127.0.0.1:7707/          Brücke für V.platform         │
│   │     · /sys/class/backlight · /sys/bus/iio · nmcli · systemctl     │
│   └─ visto-kiosk.service   cage -d -s -- start-kiosk.sh               │
│         └─ Chromium --kiosk (oder Cog)                                │
│               http://127.0.0.1:7707/device.html?platform=linux        │
│               = VistoOS im Gerätemodus, Treiber „linux“               │
└───────────────────────────────────────────────────────────────────────┘
```

- **`device.html`** ist dasselbe OS wie der Emulator (`index.html`), nur ohne Rahmen: Der Kreis füllt den Bildschirm.
- **`?platform=linux`** wählt in `js/sys/platform.js` den Treiber „linux“. Er spricht per WebSocket mit `vistod`.
  Ist der Dienst nicht erreichbar, fällt jede Funktion auf den Web-Treiber zurück (Software-Abdunklung, Vorführ-WLAN)
  und die Verbindung wird weiter versucht (1 s … 30 s). Das OS bleibt also immer bedienbar.
- **Einstellungen** liegen im Browser-Speicher des Kiosk-Profils (`/var/lib/visto/profile`). Dieses Verzeichnis muss
  dauerhaft sein – wer das Wurzeldateisystem schreibgeschützt betreibt, legt es auf eine beschreibbare Partition.

## Dateien

| Datei | Zweck |
|---|---|
| `vistod.py` | Referenzdienst, nur Python-Standardbibliothek: WebSocket-Brücke, Helligkeit, Lichtsensor, WLAN, Neustart, Auslieferung der Seite |
| `vistod.service` | systemd-Unit für den Dienst (`Type=notify`, nur Loopback) |
| `start-kiosk.sh` | setzt den Bildmodus, wartet auf `vistod`, startet Chromium bzw. Cog im Kiosk |
| `visto-kiosk.service` | systemd-Unit: `cage` auf tty1 als Benutzer `visto` (ersetzt die Anmeldung) |

## Einrichten (Debian / Raspberry Pi OS „Bookworm“, als root)

```sh
apt install cage chromium python3 network-manager wlr-randr      # statt chromium ggf. cog
useradd --create-home --groups video,input,audio,render visto
install -d -o visto -g visto /var/lib/visto/profile

# VistoOS nach /opt/visto (device.html, index.html, css/, js/, linux/)
mkdir -p /opt/visto && cp -r device.html index.html css js linux /opt/visto/
chmod +x /opt/visto/linux/start-kiosk.sh /opt/visto/linux/vistod.py

cp /opt/visto/linux/vistod.service /opt/visto/linux/visto-kiosk.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vistod.service
systemctl enable visto-kiosk.service
systemctl set-default graphical.target
reboot
```

Optionale Einstellungen in `/etc/default/visto` (wird von beiden Units gelesen):

```sh
VISTO_OUTPUT=DSI-1                 # Wayland-Ausgang; dann setzt start-kiosk.sh den Modus mit wlr-randr
VISTO_MODE=1080x1080@90            # Standard
VISTO_BROWSER=chromium             # chromium | cog | auto
VISTO_PROFILE=/var/lib/visto/profile
VISTOD_ARGS=--backlight=rpi_backlight      # z. B. bestimmtes Gerät unter /sys/class/backlight
```

## Ohne Hardware ausprobieren

```sh
python3 linux/vistod.py --simulate --www .          # im Ordner visto/
# Browser: http://127.0.0.1:7707/device.html?platform=linux&skip
```

Im Simulationsmodus legt `vistod` Helligkeit und Lichtsensor als Dateien in einem temporären Ordner an (Pfad steht
im Protokoll). `echo 900 > …/in_illuminance_input` ändert das Umgebungslicht; die Datei `…/brightness` zeigt, was
das OS als Helligkeit setzt. WLAN ist vorgetäuscht, Neustart wird nur protokolliert.
In VistoOS zeigt die App **Diagnose → Dienste**, ob die Brücke steht (Plattform „Linux“, Gerätebrücke „verbunden“).

## Brückenprotokoll

JSON-Textnachrichten über WebSocket. Anfrage `{id, type, data}` → Antwort `{id, ok, data}` bzw. `{id, ok:false, error}`;
Ereignisse vom Dienst kommen ohne `id`.

| `type` | `data` | Antwort |
|---|---|---|
| `hello` | `{client, version, host}` | `{name, version, simulate, caps:{backlight, lightSensor, wifi, haptics}, light, backlight, wifi}` |
| `ping` | – | `{t}` |
| `backlight.get` / `backlight.set` | – / `{value: 0…1}` | `{value}` |
| `light.get` | – | `{value: 0…1, lux}` |
| `wifi.current` | – | `{ssid, strength, secure}` oder `null` |
| `wifi.scan` | – | `[{ssid, strength: 0…1, secure}]` |
| `wifi.connect` | `{ssid, pass}` | `{ok, wifi}` |
| `wifi.disconnect` | – | `{ok}` |
| `power.reboot` / `power.shutdown` | – | `{ok}` |
| Ereignis `light` | `{value, lux}` | bei Änderung ≥ 0,02 (jede Sekunde geprüft) |
| Ereignis `net` | `{wifi}` | bei Wechsel des WLANs |

Auf der OS-Seite: `V.platform.bridge.send(type, data)` → Promise, `V.platform.bridge.on(type, fn)`.

## Hardware anbinden (Hinweise, ungetestet)

- **Helligkeit:** Das OS übergibt die wirksame Helligkeit 0…1 (Einstellung × Umgebungslicht × Nacht/Ruhe).
  Meldet das Panel kein Gerät unter `/sys/class/backlight`, dunkelt VistoOS wie im Browser per Software ab.
- **Lichtsensor:** jeder IIO-Sensor mit `in_illuminance_input` oder `_raw` (+ `_scale`), z. B. VEML7700, BH1750, TSL2591.
  Lux werden logarithmisch auf 0…1 abgebildet (1 lx ≈ 0,1 · 100 lx ≈ 0,67 · ab 1000 lx = 1).
- **Sockeltaste:** als `gpio-keys` mit Tastencode `KEY_HOME` (oder `KEY_ESC`) einbinden – `device.html` behandelt
  „Home“/„Esc“ als Sockeltaste (einmal = Home, zweimal schnell = Karussell). Eine angesteckte Tastatur schreibt mit
  „/“ oder Leertaste an Visto.
- **Kamera und Mikrofon** nutzt der Browser direkt (V4L2 / PipeWire). `--use-fake-ui-for-media-stream` erteilt die
  Freigabe ohne Rückfrage – im Kiosk gibt es niemanden, der sie bestätigen könnte.
- **Ton** ohne erste Berührung: `--autoplay-policy=no-user-gesture-required` (steht in `start-kiosk.sh`).
- **Berührung:** cage reicht Touch-Eingaben als Zeigerereignisse durch; den Mauszeiger blendet VistoOS im Kiosk aus.

## Sicherheit

- `vistod` lauscht nur auf `127.0.0.1` und nimmt WebSocket-Verbindungen nur von lokalen Ursprüngen an
  (`http://127.0.0.1…`, `http://localhost…`). Seiten von `file://` (Ursprung „null“) nur mit `--allow-file-origin`,
  weitere Ursprünge nur mit `--origin https://…`.
- Das OS verbindet sich seinerseits nur mit einer Brücke auf dem eigenen Rechner (`?bridge=ws://127.0.0.1:PORT`).
- Der Dienst läuft als root, weil er nach `/sys` schreibt und `nmcli`/`systemctl` aufruft; die Unit schränkt ihn ein
  (nur Loopback, kein Heimatverzeichnis, keine neuen Rechte).
- Das WLAN-Passwort wird `nmcli` als Argument übergeben und ist währenddessen in der Prozessliste sichtbar.

## Fehlersuche

```sh
journalctl -u vistod -u visto-kiosk -b        # Protokolle
curl -I http://127.0.0.1:7707/device.html      # liefert vistod die Seite?
ls /sys/class/backlight /sys/bus/iio/devices   # findet der Kernel Panel und Sensor?
```

Startet `vistod` nicht, lädt `start-kiosk.sh` nach 15 s `file:///opt/visto/device.html?platform=linux`; das OS läuft
dann mit dem Web-Treiber. Soll sich die Brücke später trotzdem verbinden, braucht `vistod` in diesem Fall
`--allow-file-origin` (in `VISTOD_ARGS`).

## Offen

- Inbetriebnahme auf dem echten Gerät (Treiber für Panel und Touch, 90-Hz-Modus, Leistungsaufnahme).
- Haptik-Motor und Lichtleiste im Sockel: im Protokoll vorgesehen (`caps.haptics`), in `vistod` noch nicht umgesetzt.
- Spracherkennung am Gerät: Der Browser im Kiosk bringt keine Offline-Erkennung mit; dafür ist ein eigener Dienst nötig.
- Aktualisierung des Systems (z. B. A/B-Partitionen) und Werkseinstellungen auf Dateisystemebene.
