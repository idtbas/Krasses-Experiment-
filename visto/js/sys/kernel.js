/* VistoOS · sys/kernel.js — Kern: Dienste, App-Prozesse, Berechtigungen, Systemprotokoll, Zustandsbericht
 *
 *  V.sys.version · V.sys.bootTime (ms seit 1970) · V.sys.uptime() → Sekunden
 *
 *  V.sys.services.register(name, api, {desc, state() → 'running'|'idle'|'off', detail() → string}) → api
 *  V.sys.services.get(name) → api · V.sys.services.list() → [{name, desc, state, detail, since}]
 *     Die Systemmodule (Plattform, Speicher, Oberfläche, Visto, Lumen …) meldet der Kern beim Start selbst an;
 *     eigene Dienste dürfen sich jederzeit registrieren.
 *
 *  V.sys.procs.list() → [{id, name, state: 'running'|'paused', since, permissions}] · V.sys.procs.get(id)
 *     running = App ist offen (Vordergrund) · paused = Oberfläche geschlossen, Hintergrundarbeit läuft weiter
 *     (Timer, Musik, Fokus … – erkannt über keepAwake() bzw. den Live-Rand). Folgt 'app:open' / 'app:close'.
 *
 *  V.sys.perm.has(app, name) · await V.sys.perm.request(app, name) → bool · V.sys.perm.list() → [{app, name, granted}]
 *  V.sys.perm.set(app, name, bool) · V.sys.perm.revoke(app, name)        name: 'camera' | 'mic' | 'notify'
 *     'system' (das OS selbst) darf alles; Hinweise sind erlaubt, bis sie entzogen werden; Kamera/Mikrofon fragen nach.
 *
 *  V.sys.log(level, quelle, text) · V.sys.logs(n) → [{n, t, level, source, message, count}] (älteste zuerst)
 *     Ringpuffer (300 Einträge). Schreibt auch in die Konsole; console.warn/error landen ebenfalls im Puffer.
 *
 *  V.sys.info() → { version, build, platform, host, display, fps, hz, quality, uptime, storageBytes, apps, services, … }
 *  Ereignisse: 'sys:log' (Eintrag) · 'sys:procs' (Liste geändert) · 'sys:perm' ({app, name, granted})
 */
'use strict';
(function () {
  const V = window.V;
  const bootTime = Date.now();
  const t0 = performance.now();

  /* --------------------------------------------------------- Protokoll */
  const LOG_MAX = 300;
  const ring = new Array(LOG_MAX);
  let head = 0, count = 0, seq = 0, last = null, telling = false;
  const con = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  function push(level, source, message) {
    message = String(message);
    if (message.length > 400) message = message.slice(0, 399) + '…';
    // dieselbe Meldung in Folge (z. B. ein Fehler in jedem Bild) zählt hoch, statt den Puffer zu fluten
    if (last && last.level === level && last.source === source && last.message === message) {
      last.count++; last.t = Date.now();
      return last;
    }
    const e = { n: ++seq, t: Date.now(), level, source: source || 'system', message, count: 1 };
    ring[head] = e; head = (head + 1) % LOG_MAX; if (count < LOG_MAX) count++;
    last = e;
    if (!telling && V.emit) { telling = true; try { V.emit('sys:log', e); } finally { telling = false; } }
    return e;
  }
  function text(a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.message || String(a);
    if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return Object.prototype.toString.call(a); } }
    return String(a);
  }
  // Warnungen und Fehler der Konsole mitschreiben (am Gerät gibt es keine Entwicklerwerkzeuge)
  for (const level of ['warn', 'error']) {
    console[level] = function (...args) {
      con[level](...args);
      try {
        let msg = args.map(text).join(' ');
        let source = 'console';
        const m = msg.match(/^\[VistoOS\]\s*/);
        if (m) { msg = msg.slice(m[0].length); source = 'system'; }
        push(level, source, msg);
      } catch (e) { /* das Protokoll darf nie selbst stören */ }
    };
  }
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    push('error', 'promise', r && r.message ? r.message : String(r));
  });

  function log(level, source, message) {
    if (level !== 'warn' && level !== 'error') level = 'info';
    const e = push(level, source, message);
    con[level]('[VistoOS · ' + e.source + ']', e.message);
    return e;
  }
  function logs(n) {
    n = Math.min(count, n === undefined ? count : Math.max(0, n | 0));
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = ring[(head - n + i + LOG_MAX * 2) % LOG_MAX];
    return out;
  }

  /* ----------------------------------------------------------- Dienste */
  const svc = new Map();
  const services = {
    register(name, api, meta = {}) {
      if (!name) throw new Error('Dienst ohne Namen');
      svc.set(name, { name, api, desc: meta.desc || '', state: meta.state || null, detail: meta.detail || null, since: Date.now() });
      return api;
    },
    get: (name) => { const s = svc.get(name); return s ? s.api : undefined; },
    has: (name) => svc.has(name),
    list() {
      const out = [];
      for (const s of svc.values()) {
        let state = 'running', detail = '';
        if (s.state) { try { state = s.state() || 'running'; } catch (e) { state = 'off'; } }
        if (s.detail) { try { detail = s.detail() || ''; } catch (e) { detail = ''; } }
        out.push({ name: s.name, desc: s.desc, state, detail, since: s.since });
      }
      return out;
    },
  };

  /** Systemmodule anmelden, soweit vorhanden (parallel gebaute Teile dürfen fehlen) */
  function registerCore() {
    const P = V.platform;
    const core = [
      ['platform', 'Plattform', () => 'running', () => (P.name === 'linux' ? 'Linux' : 'Web') + ' · ' + (P.host === 'device' ? 'Gerät' : 'Emulator')],
      ['store', 'Speicher', null, () => (P.storage.persistent ? 'dauerhaft' : 'nur bis zum Neustart')],
      ['time', 'Zeit', null, () => (V.store && V.store.get('settings.timeMode') === 'manual' ? 'manuell gestellt' : 'automatisch')],
      ['loop', 'Bildtakt', null, () => V.loop.count + ' Abonnenten'],
      ['sound', 'Klang', () => (V.store && V.store.get('settings.sounds', true) ? 'running' : 'idle'), null],
      ['display', 'Display', null, () => P.display.width + ' × ' + P.display.height + ' · ' + P.display.hz + ' Hz'],
      ['fx', 'Leuchtebene', null, null],
      ['rim', 'Randanzeige', null, null],
      ['shell', 'Oberfläche', null, () => ({ home: 'Zifferblatt', launcher: 'Apps', app: 'App', setup: 'Einrichtung', boot: 'Start' })[V.shell.mode] || V.shell.mode],
      ['ambient', 'Helligkeit & Ruhe', () => (V.ambient.on ? 'idle' : 'running'), () => (P.caps.backlight ? 'Hardware' : 'Software') + ' · ' + Math.round(V.ambient.effective() * 100) + ' %'],
      ['presence', 'Kamera-Präsenz', () => (V.presence.active ? 'running' : 'off'), () => (V.presence.source === 'camera' ? 'Kamera' : V.presence.source === 'sim' ? 'Simulation' : 'aus')],
      ['notify', 'Hinweise', null, null],
      ['visto', 'Visto', null, null],
      ['voice', 'Sprache', () => (V.voice.canSpeak || V.voice.canListen ? 'running' : 'off'), () => [V.voice.canSpeak ? 'spricht' : '', V.voice.canListen ? 'hört' : ''].filter(Boolean).join(' · ')],
      ['brain', 'Verstehen', null, () => (V.brain.claudeSource ? 'Claude verbunden' : 'lokal')],
      ['lumen', 'Lumen-Grafik', () => (V.lumen.ok && V.lumen.quality > 0 ? 'running' : 'off'), () => ['aus', 'sparsam', 'voll'][V.lumen.quality] || ''],
      ['perf', 'Leistungsregler', null, () => 'Stufe ' + (['niedrig', 'mittel', 'hoch'][V.perf.level] || V.perf.level)],
      ['live', 'Live-Rand', null, () => { const n = V.live.list().length; return n ? n + ' aktiv' : ''; }],
      ['horizon', 'Horizont', null, null],
      ['glances', 'Blicke', null, null],
      ['switcher', 'Karussell', null, null],
    ];
    for (const [name, desc, state, detail] of core) {
      if (svc.has(name) || V[name] === undefined || V[name] === null) continue;
      services.register(name, V[name], { desc, state, detail });
    }
    if (!svc.has('bridge')) {
      services.register('bridge', P.bridge, {
        desc: 'Gerätebrücke (vistod)',
        state: () => (P.bridge.connected ? 'running' : P.name === 'linux' ? 'idle' : 'off'),
        detail: () => (P.bridge.connected ? 'verbunden' : P.name === 'linux' ? 'sucht ' + (P.bridge.url || 'Dienst') : 'nur am Gerät'),
      });
    }
  }

  /* --------------------------------------------------- Berechtigungen */
  const PERMS = ['camera', 'mic', 'notify'];
  const PERM_TEXT = {
    camera: { title: 'Kamera erlauben?', what: 'die Kamera verwenden', icon: 'camera' },
    mic: { title: 'Mikrofon erlauben?', what: 'das Mikrofon verwenden', icon: 'mic' },
    notify: { title: 'Hinweise erlauben?', what: 'dir Hinweise zeigen', icon: 'bell' },
  };
  const asking = new Map();
  const permData = () => { const d = V.store ? V.store.get('system.perm') : null; return d && typeof d === 'object' ? d : {}; };
  function decided(app, name) { const d = permData()[app]; return d && typeof d[name] === 'boolean' ? d[name] : undefined; }
  function setPerm(app, name, granted) {
    if (!V.store || PERMS.indexOf(name) < 0 || !app) return;
    const d = JSON.parse(JSON.stringify(permData()));
    if (granted === undefined) { if (d[app]) { delete d[app][name]; if (!Object.keys(d[app]).length) delete d[app]; } }
    else { (d[app] = d[app] || {})[name] = !!granted; }
    V.store.set('system.perm', d);
    V.emit('sys:perm', { app, name, granted });
    log('info', 'perm', (V.apps && V.apps.get(app) ? V.apps.get(app).name : app) + ' · ' + name + ' · ' + (granted === undefined ? 'zurückgesetzt' : granted ? 'erlaubt' : 'abgelehnt'));
  }
  const perm = {
    names: PERMS,
    has(app, name) {
      if (PERMS.indexOf(name) < 0) return false;
      if (app === 'system') return true;
      const v = decided(app, name);
      return v === undefined ? name === 'notify' : v;
    },
    /** 'granted' | 'denied' | 'ask' */
    state(app, name) {
      if (app === 'system') return 'granted';
      const v = decided(app, name);
      return v === undefined ? (name === 'notify' ? 'granted' : 'ask') : v ? 'granted' : 'denied';
    },
    request(app, name) {
      if (PERMS.indexOf(name) < 0) return Promise.resolve(false);
      const st = perm.state(app, name);
      if (st !== 'ask') return Promise.resolve(st === 'granted');
      const key = app + ':' + name;
      if (asking.has(key)) return asking.get(key);
      // ohne Oberfläche (Start, Einrichtung) wird nicht gefragt und nichts gemerkt
      if (!V.notify || !V.shell || V.shell.mode === 'boot' || V.shell.mode === 'setup') return Promise.resolve(false);
      const def = V.apps && V.apps.get(app);
      const tx = PERM_TEXT[name];
      const p = V.notify.alert({
        title: tx.title,
        body: '„' + (def ? def.name : app) + '“ möchte ' + tx.what + '.',
        icon: tx.icon, color: def ? def.color : undefined,
        buttons: [{ label: 'Nicht erlauben', kind: '', value: false }, { label: 'Erlauben', kind: 'white', value: true }],
      }).then((v) => { asking.delete(key); setPerm(app, name, !!v); return !!v; }, () => { asking.delete(key); return false; });
      asking.set(key, p);
      return p;
    },
    set(app, name, granted) { setPerm(app, name, !!granted); },
    revoke(app, name) { setPerm(app, name, undefined); },
    list() {
      const out = [], d = permData();
      for (const app in d) for (const name in d[app]) if (PERMS.indexOf(name) >= 0) out.push({ app, name, granted: !!d[app][name] });
      return out;
    },
    /** erlaubte Rechte einer App (Namen) */
    of(app) { return PERMS.filter((n) => decided(app, n) === true); },
  };

  /* ---------------------------------------------------------- Prozesse */
  const procMap = new Map();   // id → {id, name, state, since}
  let fg = null;

  function background(def) {
    try { if (typeof def.keepAwake === 'function' ? def.keepAwake() : def.keepAwake === true) return true; } catch (e) { /* */ }
    try {
      const l = V.live && V.live.list ? V.live.list() : null;
      if (Array.isArray(l)) for (const x of l) if (x && x.app === def.id) return true;
    } catch (e) { /* */ }
    return false;
  }
  function setProc(def, state) {
    let p = procMap.get(def.id);
    if (!p) { procMap.set(def.id, { id: def.id, name: def.name || def.id, state, since: Date.now() }); return true; }
    if (p.state === state) return false;
    p.state = state;
    return true;
  }
  /** Vordergrund-App läuft; alles mit Hintergrundarbeit bleibt als „pausiert“; der Rest ist beendet */
  function sweep() {
    if (!V.apps) return;
    let changed = false;
    for (const def of V.apps.list(true)) {
      if (def.id === fg) changed = setProc(def, 'running') || changed;
      else if (background(def)) changed = setProc(def, 'paused') || changed;
      else if (procMap.delete(def.id)) changed = true;
    }
    if (changed) V.emit('sys:procs', procs.list());
  }
  const view = (p) => ({ id: p.id, name: p.name, state: p.state, since: p.since, permissions: perm.of(p.id) });
  const procs = {
    list() { return Array.from(procMap.values()).sort((a, b) => (a.state === b.state ? a.since - b.since : a.state === 'running' ? -1 : 1)).map(view); },
    get(id) { const p = procMap.get(id); return p ? view(p) : null; },
    get foreground() { return fg; },
  };

  /* ------------------------------------------------------------ Bericht */
  function info() {
    const P = V.platform, L = V.loop || {}, D = V.display || {};
    const perf = V.perf && typeof V.perf.level === 'number' ? V.perf : null;
    return {
      version: V.version, build: V.build,
      platform: P.name, host: P.host,
      display: { width: P.display.width, height: P.display.height, round: P.display.round, hz: P.display.hz, size: D.size || 0, dpr: D.dpr || 1 },
      fps: perf && perf.fps > 0 ? Math.round(perf.fps) : L.fps || 0,
      hz: L.hz || 0,
      quality: perf ? perf.level : null,
      lumen: V.lumen && typeof V.lumen.quality === 'number' ? V.lumen.quality : null,
      uptime: sys.uptime(),
      storageBytes: P.storage.bytes(),
      apps: V.apps ? V.apps.list(true).length : 0,
      services: svc.size,
      procs: procMap.size,
      bridge: P.bridge.connected,
      mode: V.shell ? V.shell.mode : 'boot',
      loopSubs: L.count || 0,
      listeners: V.on && V.on.count ? V.on.count() : 0,
    };
  }

  const sys = (V.sys = {
    get version() { return V.version; },
    bootTime,
    uptime: () => (performance.now() - t0) / 1000,
    services, procs, perm,
    log, logs,
    info,
    restart() { log('info', 'kernel', 'Neustart angefordert'); V.platform.power.reboot(); },
  });

  /* ------------------------------------------------------ Lebenszyklus */
  const appName = (id) => { const d = V.apps && V.apps.get(id); return d ? d.name : id; };
  log('info', 'kernel', 'Kern gestartet · Plattform ' + V.platform.name + ' · Wirt ' + V.platform.host);
  V.on('boot:ready', () => {
    if (V.icon && V.icons && V.icons.indexOf('camera') < 0) {
      V.icon.add('camera', '<path d="M3.5 9a2.6 2.6 0 0 1 2.6-2.6h1.5l1.3-2h6.2l1.3 2h1.5A2.6 2.6 0 0 1 20.5 9v7.4a2.6 2.6 0 0 1-2.6 2.6H6.1a2.6 2.6 0 0 1-2.6-2.6z"/><circle cx="12" cy="12.6" r="3.4"/>');
    }
    registerCore();
    log('info', 'kernel', 'System bereit nach ' + Math.round(performance.now() - t0) + ' ms · ' + (V.apps ? V.apps.list(true).length : 0) + ' Apps · ' + svc.size + ' Dienste');
    setInterval(sweep, 2000);
    sweep();
  });
  V.on('app:open', (id) => { fg = id; log('info', 'apps', 'Geöffnet: ' + appName(id)); sweep(); });
  V.on('app:close', (id) => { if (fg === id) fg = null; log('info', 'apps', 'Geschlossen: ' + appName(id)); sweep(); });
  V.on('platform:bridge', (on) => log(on ? 'info' : 'warn', 'bridge', on ? 'Gerätebrücke verbunden' : 'Gerätebrücke getrennt – Web-Treiber als Rückfall'));
  V.on('platform:power', (what) => log('info', 'power', what === 'reboot' ? 'Neustart' : 'Ausschalten'));
  V.on('platform:camera', (on) => log('info', 'camera', on ? 'Kamera an' : 'Kamera aus'));
  V.on('platform:mic', (on) => log('info', 'mic', on ? 'Mikrofon an' : 'Mikrofon aus'));
  V.on('perf:level', (l) => { const n = l && typeof l === 'object' ? l.level : l; log('info', 'perf', 'Leistungsstufe ' + (['niedrig', 'mittel', 'hoch'][n] || n)); });
  V.on('store:reset', () => log('warn', 'store', 'Auf Werkszustand zurückgesetzt'));
})();
