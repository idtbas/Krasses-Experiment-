/* VistoOS · core/store.js — dauerhafter Speicher (Browser-Speicher, abgesichert)
 *
 *  V.store.get('settings.accent')            Wert lesen (Punkt-Pfad)
 *  V.store.set('settings.accent', '#fff')    schreiben + Ereignis 'store' {path, value}
 *  V.store.app('timer')                       eigenes Objekt einer App; nach Änderung V.store.save()
 *  V.store.reset()                            Werkszustand
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const KEY = 'vistoos.v1';

  const DEFAULTS = {
    setupDone: false,
    user: { name: '' },
    settings: {
      accent: '#FF9A4D',
      face: 'monolith',
      faceOpts: {},
      use24h: true,
      showSeconds: false,
      brightness: 0.9,
      autoBrightness: true,
      night: 'auto',          // auto | on | off
      nightFrom: 22,
      nightTo: 7,
      alwaysOn: true,
      idleSec: 60,
      timeMode: 'auto',       // auto | manual
      timeOffset: 0,          // ms (manuell gestellte Uhr)
      sounds: true,
      volume: 0.6,
      haptics: true,
      voice: true,            // Visto spricht Antworten
      voiceRate: 1.04,
      vistoStyle: 'aurora',   // aurora | mono | accent
      vistoAI: true,          // Claude nutzen, wenn verfügbar
      wifi: '',
      location: 'Berlin',
      dnd: false,
      micMuted: false,
      units: 'metric',
    },
    apps: {},
  };

  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function merge(base, over) {
    if (!isObj(over)) return base;
    for (const k in over) {
      if (isObj(base[k]) && isObj(over[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
  let data = merge(U.clone(DEFAULTS), saved || {});

  let timer = 0;
  function persist() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* privat/voll: still weiter */ }
    }, 150);
  }

  function walk(path, create) {
    const parts = path.split('.');
    let o = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isObj(o[parts[i]])) { if (!create) return [null, null]; o[parts[i]] = {}; }
      o = o[parts[i]];
    }
    return [o, parts[parts.length - 1]];
  }

  V.store = {
    defaults: DEFAULTS,
    get data() { return data; },
    get(path, def) {
      const [o, k] = walk(path, false);
      if (!o || o[k] === undefined) return def;
      return o[k];
    },
    set(path, value) {
      const [o, k] = walk(path, true);
      const old = o[k];
      o[k] = value;
      persist();
      V.emit('store', { path, value, old });
      V.emit('store:' + path, value);
      return value;
    },
    update(path, fn) { return this.set(path, fn(this.get(path))); },
    /** eigener Speicherbereich einer App */
    app(id, defaults) {
      if (!isObj(data.apps[id])) data.apps[id] = {};
      const o = data.apps[id];
      if (defaults) for (const k in defaults) if (o[k] === undefined) o[k] = U.clone(defaults[k]);
      return o;
    },
    save() { persist(); },
    reset() {
      data = merge(U.clone(DEFAULTS), {});
      try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
      V.emit('store:reset');
    },
  };
})();
