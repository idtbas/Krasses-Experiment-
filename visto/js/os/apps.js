/* VistoOS · os/apps.js — App-Verzeichnis und Systemaktionen
 *
 *  V.apps.register({
 *    id: 'timer', name: 'Timer', icon: 'timer', color: '#FF9F0A', order: 10,
 *    init() {},                 // einmal beim Start (Hintergrunddienste, Aktionen, Visto-Absichten)
 *    create(ctx) { return { destroy(), crown(dA), back() → true wenn intern behandelt, shown() } }
 *  })
 *
 *  ctx = { id, app, root, params, store, save(), close(), onFrame(fn), on(evt, fn), cleanup(fn),
 *          rim: {arc(id, o), remove(id)}, title(text), line(alpha) }
 *
 *  V.actions.register('timer.start', { desc, params: {seconds: {type:'number', description}}, required: ['seconds'], run(args) })
 *  V.actions.run('timer.start', {seconds: 300}) → Promise<Ergebnis>
 *     Ergebnis: String (Antwort) oder {say, card, emotion}
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const reg = new Map();

  V.apps = {
    register(def) {
      if (!def || !def.id) throw new Error('App ohne id');
      def.order = def.order !== undefined ? def.order : 100;
      def.color = def.color || '#8E8E93';
      def.icon = def.icon || 'info';
      reg.set(def.id, def);
      return def;
    },
    get: (id) => reg.get(id),
    list(all) {
      return Array.from(reg.values()).filter((a) => all || !a.hidden).sort((a, b) => a.order - b.order);
    },
    initAll() {
      for (const a of reg.values()) if (a.init) V.safe(() => a.init(), 'init ' + a.id);
    },
    open(id, params, origin) { return V.shell.open(id, params, origin); },

    /** Kontext für eine geöffnete App */
    makeContext(app, root, params) {
      const cleanups = [];
      const rimIds = new Set();
      const ctx = {
        id: app.id, app, root, params: params || {},
        store: V.store.app(app.id),
        save: () => V.store.save(),
        close: () => V.shell.back(),
        onFrame(fn) { const off = V.loop.add(fn, 5); cleanups.push(off); return off; },
        on(evt, fn) { const off = V.on(evt, fn); cleanups.push(off); return off; },
        cleanup(fn) { cleanups.push(fn); },
        timeout(fn, ms) { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); return t; },
        interval(fn, ms) { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); return t; },
        rim: {
          arc(id, o) { const full = app.id + ':' + id; rimIds.add(full); return V.rim.arc(full, o); },
          remove(id) { const full = app.id + ':' + id; rimIds.delete(full); V.rim.remove(full); },
        },
        title(text, o) { return V.ui.title(root, text, o); },
        line(alpha) { V.visto && V.visto.setLine(alpha); },
        _destroy() {
          for (const f of cleanups.splice(0)) V.safe(f, 'cleanup ' + app.id);
          for (const id of rimIds) V.rim.remove(id);
          rimIds.clear();
          V.visto && V.visto.setLine(1);
        },
      };
      return ctx;
    },
  };

  /* --------------------------------------------------------- Aktionen */
  const actions = new Map();
  V.actions = {
    register(name, def) { def.name = name; actions.set(name, def); return def; },
    has: (name) => actions.has(name),
    get: (name) => actions.get(name),
    list: () => Array.from(actions.values()),
    async run(name, args) {
      const a = actions.get(name);
      if (!a) throw new Error('Unbekannte Aktion: ' + name);
      return await a.run(args || {});
    },
  };
  void U;
})();
