/* VistoOS · sys/platform.js — Plattformschicht: die einzige Stelle, die Hardware bzw. den Browser anfasst
 *
 *  Das OS ruft nie direkt Browser-Funktionen für Hardware auf, sondern V.platform. Zwei Treiber:
 *    web    Emulator, Handy, Entwicklungsrechner – alles über den Browser, fehlende Hardware wird simuliert
 *    linux  das Gerät: Kiosk-Browser + Dienst „vistod“ (WebSocket-Brücke, Standard ws://127.0.0.1:7707).
 *           Ist die Brücke nicht erreichbar, fällt jede Funktion still auf den Web-Treiber zurück
 *           und die Verbindung wird im Hintergrund weiter versucht (1 s … 30 s).
 *
 *  Treiberwahl:  ?platform=linux  (oder window.VISTO_PLATFORM = 'linux', oder ?bridge=ws://127.0.0.1:PORT)
 *  Wirt:         <html data-host="device"> → host 'device' (device.html), sonst 'emulator' (index.html)
 *
 *  V.platform = {
 *    name: 'web' | 'linux',  host: 'emulator' | 'device',
 *    caps: { camera, mic, haptics, backlight, lightSensor, wifi, speech },   // wird bei Brückenkontakt aktualisiert
 *    display: { width, height, round, hz, setBacklight(0…1) → bool },         // false = Software-Abdunklung nötig
 *    light:   { value() → 0…1, onChange(fn) → off, set(v) (nur Simulation) },
 *    haptics: { pulse(ms | muster) },
 *    storage: { get(key) → string|null, set(key, str), remove(key), keys(), bytes() },
 *    camera:  { open({facing, width, height, fps}) → Promise<MediaStream>, close(), active },
 *    mic:     { open() → Promise<MediaStream>, close(), active },
 *    net:     { online(), wifi: { current() → {ssid, strength, secure}|null, scan() → Promise<[…]>, connect(ssid, pass) → Promise<bool>, disconnect() } },
 *    power:   { reboot(), shutdown(), onAC },
 *    bridge:  { connected, url, send(type, data, {timeout}) → Promise, on(type, fn) → off },
 *    activated() → bool        // darf schon Ton/Haptik ausgegeben werden? (Browser: erst nach einer Berührung)
 *  }
 *  Ereignisse: 'platform:bridge' (bool) · 'platform:light' (0…1) · 'platform:camera' / 'platform:mic' (bool)
 *              · 'platform:net' ({online}) · 'platform:power' ('reboot' | 'shutdown')
 *
 *  Brückenprotokoll (JSON-Textnachrichten):
 *    Anfrage  { id, type, data }      Antwort  { id, ok: true, data } | { id, ok: false, error }
 *    Ereignis { type, data }          (vom Dienst, ohne id) – z. B. 'light' {value}, 'net' {wifi}
 */
'use strict';
(function () {
  const V = window.V;
  const q = new URLSearchParams(location.search);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const emit = (name, data) => { if (V.emit) V.emit(name, data); };

  const host = document.documentElement.getAttribute('data-host') === 'device' ? 'device' : 'emulator';
  const linux = q.get('platform') !== 'web' && (q.get('platform') === 'linux' || window.VISTO_PLATFORM === 'linux' || q.has('bridge'));

  /* ----------------------------------------------------------- Speicher */
  // Browser-Speicher; ist er gesperrt (privater Modus, voll), hält ein Zwischenspeicher die Werte bis zum Neuladen.
  // Am Gerät liegt der Browser-Speicher im dauerhaften Kiosk-Profil (siehe linux/start-kiosk.sh).
  const mem = new Map();
  let sized = null;
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  const storage = {
    get(key) {
      try { const s = ls(); const v = s ? s.getItem(key) : null; if (v !== null) return v; } catch (e) { /* gesperrt */ }
      return mem.has(key) ? mem.get(key) : null;
    },
    set(key, str) {
      str = String(str);
      sized = null;
      try { ls().setItem(key, str); mem.delete(key); } catch (e) { mem.set(key, str); }
    },
    remove(key) {
      sized = null;
      try { const s = ls(); if (s) s.removeItem(key); } catch (e) { /* egal */ }
      mem.delete(key);
    },
    keys() {
      const out = new Set(mem.keys());
      try { const s = ls(); if (s) for (let i = 0; i < s.length; i++) out.add(s.key(i)); } catch (e) { /* */ }
      return Array.from(out);
    },
    /** belegter Platz in Bytes (UTF-16), nur Schlüssel mit diesem Anfang */
    bytes(prefix = 'vistoos') {
      // gemerkt bis zum nächsten Schreiben (höchstens 5 s): die Diagnose fragt das laufend ab
      const now = Date.now();
      if (sized && sized.prefix === prefix && now - sized.t < 5000) return sized.n;
      let n = 0;
      for (const k of storage.keys()) { if (k.indexOf(prefix) !== 0) continue; const v = storage.get(k); n += (k.length + (v ? v.length : 0)) * 2; }
      sized = { prefix, n, t: now };
      return n;
    },
    get persistent() { try { return !!ls() && mem.size === 0; } catch (e) { return false; } },
  };

  /* ----------------------------------------------------------- Brücke */
  function bridgeUrl() {
    const raw = q.get('bridge') || window.VISTO_BRIDGE || 'ws://127.0.0.1:7707/';
    // nur der eigene Rechner: die Brücke steuert Hardware und darf nicht auf fremde Dienste zeigen
    try {
      const u = new URL(raw);
      if (!/^wss?:$/.test(u.protocol) || !/^(127\.0\.0\.1|localhost|\[::1\])$/.test(u.hostname)) return null;
      return u.href;
    } catch (e) { return null; }
  }
  const B = { url: linux ? bridgeUrl() : null, ws: null, connected: false, seq: 0, tries: 0, timer: 0, info: null };
  const pending = new Map();      // id → {resolve, reject, timer}
  const handlers = new Map();     // type → Set<fn>

  function dispatch(type, data) {
    const s = handlers.get(type);
    if (!s) return;
    for (const fn of Array.from(s)) { try { fn(data); } catch (e) { console.error('[VistoOS] Brücke', type, e); } }
  }
  function failPending(reason) {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    pending.clear();
  }
  function request(type, data, o) {
    return new Promise((resolve, reject) => {
      if (!B.ws || B.ws.readyState !== 1) { reject(new Error('Brücke nicht verbunden')); return; }
      const id = ++B.seq;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Zeitüberschreitung: ' + type)); }, (o && o.timeout) || 8000);
      pending.set(id, { resolve, reject, timer });
      try { B.ws.send(JSON.stringify({ id, type, data: data === undefined ? null : data })); }
      catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
    });
  }
  function scheduleConnect() {
    clearTimeout(B.timer);
    const wait = Math.min(30000, 1000 * Math.pow(2, Math.min(B.tries, 5)));
    B.tries++;
    B.timer = setTimeout(connect, wait);
  }
  function connect() {
    if (!B.url || B.ws) return;
    let ws;
    try { ws = new WebSocket(B.url); } catch (e) { scheduleConnect(); return; }
    B.ws = ws;
    ws.onopen = () => {
      B.tries = 0;
      // erst nach der Begrüßung gilt die Brücke als verbunden: dann sind die Fähigkeiten des Geräts bekannt
      request('hello', { client: 'VistoOS', version: V.version, host }, { timeout: 4000 }).then((info) => {
        if (B.ws !== ws) return;
        B.info = info || {};
        const c = (info && info.caps) || {};
        caps.backlight = !!c.backlight;
        caps.lightSensor = !!c.lightSensor;
        caps.wifi = !!c.wifi;
        if (c.haptics) { caps.haptics = true; remoteHaptics = true; }
        if (info && typeof info.light === 'number') setLight(info.light, 'sensor');
        if (info && info.wifi !== undefined) wifiNow = info.wifi || null;
        B.connected = true;
        if (blWant !== null) pushBacklight();
        emit('platform:bridge', true);
      }).catch(() => { try { ws.close(); } catch (e) { /* */ } });
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.id !== undefined && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.ok === false) p.reject(new Error(m.error || 'Fehler')); else p.resolve(m.data);
      } else if (typeof m.type === 'string') dispatch(m.type, m.data);
    };
    ws.onerror = () => { /* onclose folgt */ };
    ws.onclose = () => {
      if (B.ws !== ws) return;
      const was = B.connected;
      B.ws = null; B.connected = false; B.info = null;
      failPending('Brücke getrennt');
      if (was) {
        // Rückfall auf den Web-Treiber: Hardware-Fähigkeiten zurücknehmen
        caps.backlight = false; caps.lightSensor = false; caps.wifi = false;
        if (remoteHaptics) { remoteHaptics = false; caps.haptics = webHaptics; }
        blSent = null;
        emit('platform:bridge', false);
      }
      scheduleConnect();
    };
  }
  const bridge = {
    get connected() { return B.connected; },
    get url() { return B.url; },
    get info() { return B.info; },
    send(type, data, o) { return request(type, data, o); },
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => { const s = handlers.get(type); if (s) s.delete(fn); };
    },
  };

  /* ------------------------------------------------------ Fähigkeiten */
  const md = navigator.mediaDevices;
  const webHaptics = typeof navigator.vibrate === 'function';
  let remoteHaptics = false;
  const caps = {
    camera: !!(md && md.getUserMedia),
    mic: !!(md && md.getUserMedia),
    haptics: webHaptics,
    backlight: false,        // echte Hintergrundbeleuchtung/Panelhelligkeit (nur über die Brücke)
    lightSensor: false,      // echter Umgebungslichtsensor (sonst Simulation)
    wifi: false,             // echte WLAN-Verwaltung (sonst Vorführnetze)
    speech: !!(window.speechSynthesis || window.SpeechRecognition || window.webkitSpeechRecognition),
  };

  /* ---------------------------------------------------------- Display */
  let blWant = null, blSent = null, blTimer = 0;
  function pushBacklight() {
    blTimer = 0;
    if (!B.connected || !caps.backlight || blWant === null || blWant === blSent) return;
    blSent = blWant;
    request('backlight.set', { value: blWant }).catch(() => { blSent = null; });
  }
  const display = {
    width: 1080, height: 1080, round: true, hz: 90,
    get backlight() { return blWant; },
    /** Helligkeit 0…1 setzen. true = die Hardware regelt; false = das OS muss selbst abdunkeln (Software) */
    setBacklight(v) {
      blWant = Math.round(clamp(+v || 0, 0, 1) * 1000) / 1000;
      if (!B.connected || !caps.backlight) return false;
      if (!blTimer) blTimer = setTimeout(pushBacklight, 40);   // Drehen am Rand: höchstens 25 Befehle je Sekunde
      return true;
    },
  };

  /* ------------------------------------------------------------ Licht */
  let lightVal = 0.7, lightSrc = 'sim';
  const lightFns = new Set();
  function setLight(v, src) {
    v = clamp(+v || 0, 0, 1);
    if (src) lightSrc = src;
    if (Math.abs(v - lightVal) < 0.004) return;
    lightVal = v;
    for (const fn of Array.from(lightFns)) { try { fn(v); } catch (e) { console.error('[VistoOS] Licht', e); } }
    emit('platform:light', v);
  }
  const light = {
    value: () => lightVal,
    get source() { return B.connected && caps.lightSensor ? 'sensor' : 'sim'; },
    onChange(fn) { lightFns.add(fn); return () => lightFns.delete(fn); },
    /** Simulation (Emulator-Regler). Mit echtem Sensor wirkungslos – der Sensor hat das letzte Wort. */
    set(v) { if (B.connected && caps.lightSensor) return; setLight(v, 'sim'); },
  };
  bridge.on('light', (d) => { if (d && typeof d.value === 'number') setLight(d.value, 'sensor'); });
  void lightSrc;

  /* ----------------------------------------------------------- Haptik */
  function activated() {
    if (linux) return true;   // der Kiosk startet ohne Berührungszwang (--autoplay-policy=no-user-gesture-required)
    const ua = navigator.userActivation;
    return !ua || ua.hasBeenActive;
  }
  const haptics = {
    pulse(p) {
      if (p === undefined || p === null) p = 8;
      if (remoteHaptics && B.connected) { request('haptics.pulse', { pattern: Array.isArray(p) ? p : [p] }).catch(() => {}); return true; }
      if (!webHaptics) return false;
      const ua = navigator.userActivation;
      if (ua && !ua.hasBeenActive) return false;   // Browser erlauben Vibration erst nach einer Berührung
      try { return !!navigator.vibrate(p); } catch (e) { return false; }
    },
  };

  /* -------------------------------------------------- Kamera, Mikrofon */
  function media(kind, build) {
    let stream = null;
    const api = {
      get active() { return !!stream; },
      get stream() { return stream; },
      async open(o = {}) {
        if (!md || !md.getUserMedia) throw new Error(kind === 'camera' ? 'Keine Kamera verfügbar' : 'Kein Mikrofon verfügbar');
        api.close();
        const s = await md.getUserMedia(build(o));
        stream = s;
        // zieht jemand den Stecker (oder entzieht die Erlaubnis), gilt der Zugriff als beendet
        for (const t of s.getTracks()) t.addEventListener('ended', () => { if (stream === s) { stream = null; emit('platform:' + kind, false); } });
        emit('platform:' + kind, true);
        return s;
      },
      close() {
        if (!stream) return;
        const s = stream; stream = null;
        try { s.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ }
        emit('platform:' + kind, false);
      },
    };
    return api;
  }
  const camera = media('camera', (o) => ({
    video: { facingMode: o.facing || 'user', width: { ideal: o.width || 320 }, height: { ideal: o.height || 240 }, frameRate: { ideal: o.fps || 24 } },
    audio: false,
  }));
  const mic = media('mic', () => ({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }));

  /* ------------------------------------------------------------- Netz */
  // Ohne echte WLAN-Verwaltung (Browser): Vorführnetze, Zustand in den Einstellungen ('settings.wifi').
  const DEMO_NETS = [
    { ssid: 'Zuhause', strength: 0.95, secure: true },
    { ssid: 'FRITZ!Box 7590', strength: 0.76, secure: true },
    { ssid: 'Vodafone-8E2C', strength: 0.57, secure: true },
    { ssid: 'Café Mondschein', strength: 0.41, secure: false },
    { ssid: 'Telekom_FON', strength: 0.28, secure: false },
  ];
  let wifiNow = null;   // letzter Stand vom Gerät
  const real = () => B.connected && caps.wifi;
  const stored = () => (V.store ? V.store.get('settings.wifi', '') : '');
  const normNet = (n) => ({ ssid: String(n.ssid || ''), strength: clamp(+n.strength || 0, 0, 1), secure: !!n.secure });
  const wifi = {
    current() {
      if (real()) return wifiNow ? normNet(wifiNow) : null;
      const name = stored();
      if (!name) return null;
      return normNet(DEMO_NETS.find((n) => n.ssid === name) || { ssid: name, strength: 0.8, secure: true });
    },
    scan() {
      if (real()) return request('wifi.scan', null, { timeout: 20000 }).then((l) => (Array.isArray(l) ? l.map(normNet).filter((n) => n.ssid) : []));
      return new Promise((r) => setTimeout(() => r(DEMO_NETS.map(normNet)), 600));
    },
    connect(ssid, pass) {
      ssid = String(ssid || '');
      if (!ssid) return Promise.resolve(false);
      if (real()) {
        return request('wifi.connect', { ssid, pass: pass || '' }, { timeout: 45000 })
          .then((r) => { const ok = !!(r && r.ok); if (ok) { wifiNow = r.wifi || { ssid, strength: 0.8, secure: !!pass }; emit('platform:net', { online: net.online(), wifi: wifi.current() }); } return ok; })
          .catch(() => false);
      }
      return new Promise((r) => setTimeout(() => { if (V.store) V.store.set('settings.wifi', ssid); r(true); }, 900));
    },
    disconnect() {
      if (real()) return request('wifi.disconnect', null, { timeout: 15000 }).then(() => { wifiNow = null; return true; }).catch(() => false);
      if (V.store) V.store.set('settings.wifi', '');
      return Promise.resolve(true);
    },
  };
  const net = { online: () => navigator.onLine !== false, wifi };
  bridge.on('net', (d) => { if (d && d.wifi !== undefined) { wifiNow = d.wifi || null; emit('platform:net', { online: net.online(), wifi: wifi.current() }); } });
  window.addEventListener('online', () => emit('platform:net', { online: true, wifi: wifi.current() }));
  window.addEventListener('offline', () => emit('platform:net', { online: false, wifi: wifi.current() }));

  /* ------------------------------------------------------------ Strom */
  /** „Aus“ ohne echte Hardware: schwarzer Vorhang; die nächste Berührung oder Taste startet neu */
  function curtain() {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;opacity:0;transition:opacity .8s ease;cursor:none';
    document.body.appendChild(c);
    requestAnimationFrame(() => { c.style.opacity = '1'; });
    const wake = () => location.reload();
    setTimeout(() => { window.addEventListener('pointerdown', wake, true); window.addEventListener('keydown', wake, true); }, 900);
  }
  const power = {
    onAC: true,   // Visto hängt am Netzteil, kein Akku
    reboot() {
      emit('platform:power', 'reboot');
      if (B.connected) { request('power.reboot').catch(() => location.reload()); return; }
      location.reload();
    },
    shutdown() {
      emit('platform:power', 'shutdown');
      if (B.connected) { request('power.shutdown').catch(curtain); return; }
      curtain();
    },
  };

  V.platform = {
    name: linux ? 'linux' : 'web',
    host,
    caps, display, light, haptics, storage, camera, mic, net, power, bridge,
    activated,
  };

  if (linux) {
    if (B.url) connect();
    else console.warn('[VistoOS] Brücke: Adresse abgelehnt (nur 127.0.0.1/localhost erlaubt) – Web-Treiber als Rückfall');
    // kommt der Rechner aus dem Schlaf oder wird die Seite wieder sichtbar: sofort neu versuchen
    document.addEventListener('visibilitychange', () => { if (!document.hidden && B.url && !B.ws) { B.tries = 0; clearTimeout(B.timer); connect(); } });
  }
})();
