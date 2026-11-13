#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vistod – Gerätedienst für VistoOS (Referenz).

STATUS: Vorlage. Auf echter Visto-Hardware UNGETESTET. Geprüft ist nur der Simulationsmodus
(`--simulate`) gegen `device.html?platform=linux` im Browser: WebSocket-Brücke, Protokoll,
Helligkeit/Lichtsensor über nachgebildete sysfs-Dateien, Auslieferung der Seite.

Was der Dienst tut
  · WebSocket-Brücke für V.platform (Treiber „linux“), Standard ws://127.0.0.1:7707
  · liefert auf demselben Port die VistoOS-Dateien aus (--www), damit der Kiosk-Browser
    http://127.0.0.1:7707/device.html?platform=linux laden kann (ein Ursprung, sicherer Kontext)
  · Helligkeit      /sys/class/backlight/<gerät>/brightness
  · Lichtsensor     /sys/bus/iio/devices/iio:device*/in_illuminance_(input|raw)
  · WLAN            nmcli (NetworkManager)
  · Strom           systemctl reboot / poweroff

Nur Python-Standardbibliothek (kein pip nötig). Lauscht ausschließlich auf der Loopback-Adresse und
nimmt WebSocket-Verbindungen nur von lokalen Ursprüngen an.

Protokoll (JSON-Textnachrichten)
  Anfrage   {"id": 7, "type": "backlight.set", "data": {"value": 0.6}}
  Antwort   {"id": 7, "ok": true, "data": {...}}   bzw.   {"id": 7, "ok": false, "error": "..."}
  Ereignis  {"type": "light", "data": {"value": 0.42}}        (ohne id, vom Dienst)

  hello              → {name, version, simulate, caps:{backlight, lightSensor, wifi, haptics}, light, backlight, wifi}
  ping               → {t}
  backlight.get      → {value}            backlight.set {value 0…1} → {value}
  light.get          → {value, lux}
  wifi.current       → {ssid, strength, secure} | null
  wifi.scan          → [{ssid, strength 0…1, secure}]
  wifi.connect {ssid, pass} → {ok, wifi}  wifi.disconnect → {ok}
  power.reboot / power.shutdown → {ok}
  Ereignisse: light {value, lux} · net {wifi}

Aufruf
  python3 vistod.py --www /opt/visto                 # am Gerät
  python3 vistod.py --simulate --www ..              # am Entwicklungsrechner, ohne Hardware
"""

import argparse
import asyncio
import base64
import glob
import hashlib
import json
import logging
import math
import mimetypes
import os
import socket
import struct
import sys
import tempfile
import time
from urllib.parse import unquote, urlsplit

VERSION = "0.1"
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_FRAME = 1 << 20
log = logging.getLogger("vistod")


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def read_text(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return None


def read_number(path):
    t = read_text(path)
    try:
        return float(t) if t not in (None, "") else None
    except ValueError:
        return None


# ----------------------------------------------------------------------------- Hardware


class Backlight:
    """Panelhelligkeit über die Kernel-Schnittstelle /sys/class/backlight."""

    def __init__(self, root="/sys/class/backlight", name=None):
        self.dir = None
        self.max = 0.0
        for cand in sorted(glob.glob(os.path.join(root, "*"))):
            if name and os.path.basename(cand) != name:
                continue
            mx = read_number(os.path.join(cand, "max_brightness"))
            if mx and mx > 0 and os.path.isfile(os.path.join(cand, "brightness")):
                self.dir, self.max = cand, mx
                break

    @property
    def available(self):
        return bool(self.dir) and os.access(os.path.join(self.dir, "brightness"), os.W_OK)

    def get(self):
        if not self.dir:
            return None
        raw = read_number(os.path.join(self.dir, "brightness"))
        return None if raw is None else clamp(raw / self.max, 0.0, 1.0)

    def set(self, value):
        if not self.available:
            raise RuntimeError("Keine schreibbare Hintergrundbeleuchtung gefunden")
        value = clamp(float(value), 0.0, 1.0)
        raw = int(round(value * self.max))
        if value > 0:
            raw = max(1, raw)  # nie versehentlich ganz aus
        with open(os.path.join(self.dir, "brightness"), "w", encoding="utf-8") as f:
            f.write(str(raw))
        return raw / self.max


class LightSensor:
    """Umgebungslicht über Industrial I/O (z. B. VEML7700, TSL2591, BH1750)."""

    NAMES = ("in_illuminance_input", "in_illuminance0_input", "in_illuminance_raw", "in_illuminance0_raw")

    def __init__(self, root="/sys/bus/iio/devices"):
        self.path = None
        self.scale = 1.0
        for dev in sorted(glob.glob(os.path.join(root, "iio:device*"))):
            for name in self.NAMES:
                p = os.path.join(dev, name)
                if os.path.isfile(p):
                    self.path = p
                    if name.endswith("_raw"):
                        s = read_number(os.path.join(dev, name.replace("_raw", "_scale")))
                        if s is None:
                            s = read_number(os.path.join(dev, "in_illuminance_scale"))
                        self.scale = s if s else 1.0
                    break
            if self.path:
                break

    @property
    def available(self):
        return bool(self.path)

    def lux(self):
        raw = read_number(self.path) if self.path else None
        return None if raw is None else max(0.0, raw * self.scale)

    @staticmethod
    def normalize(lux):
        """Lux → 0…1 (logarithmisch, wie das Auge): 1 lx ≈ 0,1 · 100 lx ≈ 0,67 · ab 1000 lx = 1."""
        return clamp(math.log10(lux + 1.0) / 3.0, 0.0, 1.0)

    def value(self):
        lux = self.lux()
        return None if lux is None else self.normalize(lux)


async def run(*cmd, timeout=20.0):
    proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("Zeitüberschreitung: " + cmd[0])
    return proc.returncode, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")


def split_terse(line):
    """Eine Zeile aus `nmcli -t` zerlegen (Doppelpunkte in Werten sind als \\: maskiert)."""
    out, cur, i = [], "", 0
    while i < len(line):
        c = line[i]
        if c == "\\" and i + 1 < len(line):
            cur += line[i + 1]
            i += 2
            continue
        if c == ":":
            out.append(cur)
            cur = ""
        else:
            cur += c
        i += 1
    out.append(cur)
    return out


class Wifi:
    """WLAN über NetworkManager (nmcli)."""

    def __init__(self):
        from shutil import which

        self.nmcli = which("nmcli")

    @property
    def available(self):
        return bool(self.nmcli)

    async def _list(self, rescan):
        rc, out, err = await run(self.nmcli, "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", rescan, timeout=25)
        if rc != 0:
            raise RuntimeError(err.strip() or "nmcli fehlgeschlagen")
        best = {}
        for line in out.splitlines():
            f = split_terse(line)
            if len(f) < 4 or not f[1]:
                continue
            try:
                strength = clamp(int(f[2]) / 100.0, 0.0, 1.0)
            except ValueError:
                strength = 0.0
            net = {"ssid": f[1], "strength": strength, "secure": f[3] not in ("", "--"), "active": f[0].strip() == "*"}
            old = best.get(net["ssid"])
            if not old or net["active"] or (strength > old["strength"] and not old["active"]):
                best[net["ssid"]] = net
        return sorted(best.values(), key=lambda n: (not n["active"], -n["strength"]))

    async def scan(self):
        return [{k: n[k] for k in ("ssid", "strength", "secure")} for n in await self._list("auto")]

    async def current(self):
        for n in await self._list("no"):
            if n["active"]:
                return {k: n[k] for k in ("ssid", "strength", "secure")}
        return None

    async def connect(self, ssid, password):
        cmd = [self.nmcli, "device", "wifi", "connect", ssid]
        if password:
            cmd += ["password", password]  # Hinweis: kurzzeitig in der Prozessliste sichtbar (Einzelnutzer-Gerät)
        rc, _out, err = await run(*cmd, timeout=40)
        if rc != 0:
            log.warning("WLAN-Verbindung mit %r fehlgeschlagen: %s", ssid, err.strip())
        return rc == 0

    async def disconnect(self):
        rc, out, _ = await run(self.nmcli, "-t", "-f", "DEVICE,TYPE", "device", timeout=10)
        if rc != 0:
            return False
        for line in out.splitlines():
            f = split_terse(line)
            if len(f) >= 2 and f[1] == "wifi":
                rc, _o, _e = await run(self.nmcli, "device", "disconnect", f[0], timeout=15)
                return rc == 0
        return False


class SimWifi:
    """Vorführnetze für den Simulationsmodus (dieselben Namen wie im Emulator)."""

    NETS = [
        {"ssid": "Zuhause", "strength": 0.95, "secure": True},
        {"ssid": "FRITZ!Box 7590", "strength": 0.76, "secure": True},
        {"ssid": "Vodafone-8E2C", "strength": 0.57, "secure": True},
        {"ssid": "Café Mondschein", "strength": 0.41, "secure": False},
        {"ssid": "Telekom_FON", "strength": 0.28, "secure": False},
    ]
    available = True

    def __init__(self):
        self.now = dict(self.NETS[0])

    async def scan(self):
        await asyncio.sleep(0.5)
        return [dict(n) for n in self.NETS]

    async def current(self):
        return dict(self.now) if self.now else None

    async def connect(self, ssid, password):
        await asyncio.sleep(1.0)
        net = next((n for n in self.NETS if n["ssid"] == ssid), None)
        if not net or (net["secure"] and not password):
            return False
        self.now = dict(net)
        return True

    async def disconnect(self):
        self.now = None
        return True


# ----------------------------------------------------------------------------- WebSocket


class Client:
    def __init__(self, reader, writer):
        self.reader, self.writer = reader, writer
        self.lock = asyncio.Lock()

    async def frame(self, opcode, payload=b""):
        n = len(payload)
        head = bytes([0x80 | opcode])
        if n < 126:
            head += bytes([n])
        elif n < 65536:
            head += bytes([126]) + struct.pack(">H", n)
        else:
            head += bytes([127]) + struct.pack(">Q", n)
        async with self.lock:
            self.writer.write(head + payload)
            await self.writer.drain()

    async def send(self, obj):
        await self.frame(0x1, json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    async def read(self):
        """Nächste vollständige Nachricht → (opcode, bytes). Wirft bei Verbindungsende."""
        opcode, chunks = None, []
        while True:
            b = await self.reader.readexactly(2)
            fin, op, masked, n = b[0] & 0x80, b[0] & 0x0F, b[1] & 0x80, b[1] & 0x7F
            if n == 126:
                n = struct.unpack(">H", await self.reader.readexactly(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", await self.reader.readexactly(8))[0]
            if n > MAX_FRAME:
                raise ValueError("Nachricht zu groß")
            mask = await self.reader.readexactly(4) if masked else None
            data = await self.reader.readexactly(n)
            if mask:
                key = (mask * (n // 4 + 1))[:n]
                data = (int.from_bytes(data, "big") ^ int.from_bytes(key, "big")).to_bytes(n, "big") if n else b""
            if op >= 0x8:  # Steuerrahmen (dürfen zwischen Fragmenten liegen)
                return op, data
            if op != 0x0:
                opcode = op
            chunks.append(data)
            if sum(len(c) for c in chunks) > MAX_FRAME:
                raise ValueError("Nachricht zu groß")
            if fin:
                return opcode, b"".join(chunks)


def origin_allowed(origin, cfg):
    """Nur lokale Seiten dürfen Hardware steuern. Ohne Origin = kein Browser (lokales Werkzeug)."""
    if not origin:
        return True
    if origin in ("null", "file://"):
        return cfg.allow_file_origin or cfg.simulate
    try:
        host = urlsplit(origin).hostname
    except ValueError:
        return False
    return host in ("127.0.0.1", "localhost", "::1") or origin in cfg.origin


# ----------------------------------------------------------------------------- Dienst


class Vistod:
    def __init__(self, cfg):
        self.cfg = cfg
        self.clients = set()
        self.started = time.time()
        self.simdir = None
        if cfg.simulate:
            self.simdir = tempfile.mkdtemp(prefix="vistod-sim-")
            bl = os.path.join(self.simdir, "backlight", "sim")
            iio = os.path.join(self.simdir, "iio", "iio:device0")
            os.makedirs(bl)
            os.makedirs(iio)
            for path, text in ((os.path.join(bl, "max_brightness"), "255"), (os.path.join(bl, "brightness"), "200"), (os.path.join(iio, "in_illuminance_input"), "180")):
                with open(path, "w", encoding="utf-8") as f:
                    f.write(text)
            self.backlight = Backlight(os.path.join(self.simdir, "backlight"))
            self.light = LightSensor(os.path.join(self.simdir, "iio"))
            self.wifi = SimWifi()
            log.info("Simulation: nachgebildete Geräte unter %s (Licht ändern: echo 900 > %s)", self.simdir, self.light.path)
        else:
            self.backlight = Backlight(name=cfg.backlight)
            self.light = LightSensor()
            self.wifi = Wifi()
        self.last_light = None
        self.last_wifi = "?"
        log.info("Helligkeit: %s · Lichtsensor: %s · WLAN: %s",
                 self.backlight.dir if self.backlight.available else "nicht verfügbar",
                 self.light.path if self.light.available else "nicht verfügbar",
                 "nmcli" if self.wifi.available and not cfg.simulate else "simuliert" if cfg.simulate else "nicht verfügbar")

    def caps(self):
        return {"backlight": self.backlight.available, "lightSensor": self.light.available, "wifi": self.wifi.available, "haptics": False}

    # ---- Anfragen
    async def on_hello(self, _data):
        wifi = None
        if self.wifi.available:
            try:
                wifi = await self.wifi.current()
            except Exception as e:  # noqa: BLE001 – Begrüßung darf an WLAN-Problemen nicht scheitern
                log.warning("WLAN-Abfrage: %s", e)
        return {"name": "vistod", "version": VERSION, "simulate": self.cfg.simulate, "caps": self.caps(),
                "light": self.light.value() if self.light.available else None,
                "backlight": self.backlight.get(), "wifi": wifi}

    async def on_ping(self, _data):
        return {"t": time.time()}

    async def on_backlight_get(self, _data):
        return {"value": self.backlight.get()}

    async def on_backlight_set(self, data):
        return {"value": self.backlight.set((data or {}).get("value", 1))}

    async def on_light_get(self, _data):
        return {"value": self.light.value(), "lux": self.light.lux()}

    async def on_wifi_current(self, _data):
        self._need_wifi()
        return await self.wifi.current()

    async def on_wifi_scan(self, _data):
        self._need_wifi()
        return await self.wifi.scan()

    async def on_wifi_connect(self, data):
        self._need_wifi()
        ssid = str((data or {}).get("ssid") or "")
        if not ssid:
            raise ValueError("ssid fehlt")
        ok = await self.wifi.connect(ssid, str((data or {}).get("pass") or ""))
        now = await self.wifi.current() if ok else None
        if ok:
            self.last_wifi = json.dumps(now, sort_keys=True)
            await self.broadcast("net", {"wifi": now})
        return {"ok": ok, "wifi": now}

    async def on_wifi_disconnect(self, _data):
        self._need_wifi()
        ok = await self.wifi.disconnect()
        if ok:
            self.last_wifi = "null"
            await self.broadcast("net", {"wifi": None})
        return {"ok": ok}

    async def on_power_reboot(self, _data):
        return self._power("reboot")

    async def on_power_shutdown(self, _data):
        return self._power("poweroff")

    def _need_wifi(self):
        if not self.wifi.available:
            raise RuntimeError("WLAN-Verwaltung nicht verfügbar (nmcli fehlt)")

    def _power(self, verb):
        if self.cfg.simulate:
            log.info("Simulation: systemctl %s (nicht ausgeführt)", verb)
            return {"ok": True, "simulated": True}
        # erst antworten, dann ausführen
        asyncio.get_running_loop().call_later(0.6, lambda: asyncio.ensure_future(run("systemctl", verb, timeout=30)))
        return {"ok": True}

    async def dispatch(self, client, msg):
        mid, mtype = msg.get("id"), msg.get("type")
        handler = getattr(self, "on_" + str(mtype).replace(".", "_"), None) if isinstance(mtype, str) else None
        try:
            if not handler:
                raise ValueError("Unbekannte Anfrage: %s" % mtype)
            data = await handler(msg.get("data"))
            reply = {"id": mid, "ok": True, "data": data}
        except Exception as e:  # noqa: BLE001 – jeder Fehler geht als Antwort zurück
            log.warning("%s: %s", mtype, e)
            reply = {"id": mid, "ok": False, "error": str(e)}
        if mid is not None:
            try:
                await client.send(reply)
            except (ConnectionError, OSError):
                pass

    async def broadcast(self, mtype, data):
        for c in list(self.clients):
            try:
                await c.send({"type": mtype, "data": data})
            except (ConnectionError, OSError):
                self.clients.discard(c)

    # ---- Hintergrund: Sensor und Netz beobachten
    async def watch(self):
        tick = 0
        while True:
            await asyncio.sleep(1.0)
            tick += 1
            if not self.clients:
                continue
            if self.light.available:
                v = self.light.value()
                if v is not None and (self.last_light is None or abs(v - self.last_light) >= 0.02):
                    self.last_light = v
                    await self.broadcast("light", {"value": round(v, 3), "lux": self.light.lux()})
            if self.wifi.available and tick % 15 == 0:
                try:
                    now = json.dumps(await self.wifi.current(), sort_keys=True)
                except Exception:  # noqa: BLE001
                    continue
                if now != self.last_wifi:
                    self.last_wifi = now
                    await self.broadcast("net", {"wifi": json.loads(now)})

    # ---- Verbindungen
    async def handle(self, reader, writer):
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 10)
            lines = head.decode("latin-1").split("\r\n")
            method, target, _ = lines[0].split(" ", 2)
            headers = {}
            for line in lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip().lower()] = v.strip()
            if headers.get("upgrade", "").lower() == "websocket":
                await self.websocket(reader, writer, headers)
            else:
                await self.http(writer, method, target)
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, asyncio.TimeoutError, ConnectionError, ValueError, OSError):
            pass
        finally:
            try:
                writer.close()
            except OSError:
                pass

    async def websocket(self, reader, writer, headers):
        key = headers.get("sec-websocket-key")
        origin = headers.get("origin", "")
        if not key or not origin_allowed(origin, self.cfg):
            log.warning("WebSocket abgelehnt (Ursprung %r)", origin)
            writer.write(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            await writer.drain()
            return
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")
        writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n" % accept).encode("ascii"))
        await writer.drain()
        client = Client(reader, writer)
        self.clients.add(client)
        self.last_light = None  # neuer Zuhörer bekommt den aktuellen Lichtwert
        log.info("Brücke verbunden (%s) · %d Verbindung(en)", origin or "ohne Ursprung", len(self.clients))
        tasks = set()
        try:
            while True:
                op, data = await client.read()
                if op == 0x8:
                    await client.frame(0x8, data[:2])
                    break
                if op == 0x9:
                    await client.frame(0xA, data)
                    continue
                if op != 0x1:
                    continue
                try:
                    msg = json.loads(data.decode("utf-8"))
                except ValueError:
                    continue
                if isinstance(msg, dict):
                    t = asyncio.ensure_future(self.dispatch(client, msg))  # lange Anfragen (WLAN) blockieren nichts
                    tasks.add(t)
                    t.add_done_callback(tasks.discard)
        finally:
            self.clients.discard(client)
            log.info("Brücke getrennt · %d Verbindung(en)", len(self.clients))

    async def http(self, writer, method, target):
        def respond(status, body=b"", ctype="text/plain; charset=utf-8", head_only=False):
            writer.write(("HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n" % (status, ctype, len(body))).encode("ascii"))
            if not head_only:
                writer.write(body)

        if method not in ("GET", "HEAD"):
            respond("405 Method Not Allowed")
        elif not self.cfg.www:
            respond("404 Not Found", "vistod läuft. Zum Ausliefern von VistoOS mit --www <ordner> starten.\n".encode("utf-8"))
        else:
            root = os.path.realpath(self.cfg.www)
            rel = unquote(urlsplit(target).path).lstrip("/") or "device.html"
            path = os.path.realpath(os.path.join(root, rel))
            if os.path.isdir(path):
                path = os.path.join(path, "index.html")
            if (path != root and not path.startswith(root + os.sep)) or not os.path.isfile(path):
                respond("404 Not Found", b"Nicht gefunden\n")
            else:
                ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
                if ctype.startswith("text/") or ctype in ("application/javascript", "application/json", "image/svg+xml"):
                    ctype += "; charset=utf-8"
                with open(path, "rb") as f:
                    body = f.read()
                respond("200 OK", body, ctype, head_only=method == "HEAD")
        await writer.drain()


def sd_notify(message):
    """systemd Bescheid geben (Type=notify), ohne Zusatzbibliothek."""
    addr = os.environ.get("NOTIFY_SOCKET")
    if not addr:
        return
    if addr.startswith("@"):
        addr = "\0" + addr[1:]
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as s:
            s.connect(addr)
            s.sendall(message.encode("utf-8"))
    except OSError:
        pass


async def main_async(cfg):
    daemon = Vistod(cfg)
    server = await asyncio.start_server(daemon.handle, cfg.host, cfg.port)
    log.info("vistod %s lauscht auf %s:%d%s", VERSION, cfg.host, cfg.port, " · liefert " + os.path.realpath(cfg.www) if cfg.www else "")
    sd_notify("READY=1")
    watcher = asyncio.ensure_future(daemon.watch())
    try:
        async with server:
            await server.serve_forever()
    finally:
        watcher.cancel()


def main():
    ap = argparse.ArgumentParser(description="vistod – Gerätedienst für VistoOS (Referenz, auf Hardware ungetestet)")
    ap.add_argument("--host", default="127.0.0.1", help="Adresse (Standard 127.0.0.1 – nicht ins Netz öffnen)")
    ap.add_argument("--port", type=int, default=7707)
    ap.add_argument("--www", default="", help="Ordner mit VistoOS (device.html, css/, js/), wird unter http://HOST:PORT/ ausgeliefert")
    ap.add_argument("--backlight", default=None, help="Name unter /sys/class/backlight (Standard: erstes Gerät)")
    ap.add_argument("--origin", action="append", default=[], help="zusätzlich erlaubter Ursprung, z. B. https://beispiel.de (mehrfach möglich)")
    ap.add_argument("--allow-file-origin", action="store_true", help="Seiten von file:// (Ursprung „null“) zulassen")
    ap.add_argument("--simulate", action="store_true", help="ohne Hardware: Helligkeit/Sensor als Dateien, WLAN vorgetäuscht, kein Neustart")
    ap.add_argument("-v", "--verbose", action="store_true")
    cfg = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if cfg.verbose else logging.INFO, format="%(asctime)s vistod %(levelname)s %(message)s", datefmt="%H:%M:%S")
    if cfg.host not in ("127.0.0.1", "localhost", "::1"):
        log.warning("vistod lauscht auf %s – der Dienst steuert Hardware und gehört nicht ins Netz!", cfg.host)
    try:
        asyncio.run(main_async(cfg))
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
