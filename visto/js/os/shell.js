/* VistoOS · os/shell.js — Navigation, Übergänge und Systemgesten
 *
 *  Zustände: boot · setup · home (Zifferblatt) · launcher (Orbit) · app
 *
 *  Systemgesten auf dem Display:
 *    Zifferblatt:  ↑ wischen → Apps   ↓ wischen → Kontrollzentrum   ← → Zifferblatt wechseln
 *                  lange drücken → Zifferblatt anpassen   am Rand drehen → Helligkeit
 *    Überall:      Linie unten antippen oder nach oben ziehen → Visto
 *                  vom linken Rand nach rechts wischen → zurück (folgt dem Finger)
 *                  vom oberen Rand nach unten → Kontrollzentrum
 *                  am Rand entlangfahren → Drehkrone (Listen, Regler, App-Gitter)
 *
 *  Elemente mit data-nogesture="all|x|y" behalten ihre Gesten selbst (y = senkrecht, x = waagerecht).
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  let stage, homeEl;
  let app = null;            // {def, ctx, inst, el, content, origin, from}
  let busy = false;
  let openGen = 0;           // jüngster open()-Aufruf
  let closing = null;        // Promise des laufenden Schließens
  let lastFrom = 'home';
  let backDrag = null;     // laufende Zurück-Geste
  let crownAcc = 0;

  const shell = (V.shell = {
    mode: 'boot',
    swallowClick: false,
    get app() { return app; },
    get busy() { return busy; },

    init() {
      stage = V.display.stage;
      homeEl = V.faces.mountHome(stage);
      V.launcher.mount(stage);
      V.faces.show(V.store.get('settings.face', 'monolith'));
      attachGestures();
      // Klicks nach erkannten Gesten verschlucken
      V.display.el.addEventListener('click', (e) => {
        if (shell.swallowClick) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    },

    state() {
      return { mode: shell.mode, app: app ? app.def.id : null, control: !!(V.control && V.control.isOpen), visto: !!(V.convo && V.convo.active) };
    },

    /* ---------------------------------------------------- Zifferblatt */
    async home(o = {}) {
      if (shell.mode === 'setup' || shell.mode === 'boot') return;
      if (V.control && V.control.isOpen) V.control.close();
      if (shell.mode === 'app') {
        openGen++;
        if (!app) await settleApp();
        if (app) { await closeApp({ to: 'home' }); return; }
      }
      if (shell.mode === 'home') return;
      shell.mode = 'home';
      V.launcher.hide();
      showHome(o.instant);
      V.sound.play('close');
      V.emit('shell:mode', 'home');
    },

    async launcher() {
      if (shell.mode === 'setup' || shell.mode === 'boot') return;
      if (shell.mode === 'app') {
        openGen++;
        if (!app) await settleApp();
        if (app) { await closeApp({ to: 'launcher' }); return; }
      }
      if (shell.mode === 'launcher') return;
      shell.mode = 'launcher';
      hideHome();
      V.launcher.show();
      V.sound.play('open');
      V.haptic(8);
      V.emit('shell:mode', 'launcher');
    },

    /** App öffnen. origin = {x, y, r} logisch (Symbolposition) */
    async open(id, params, origin) {
      const def = V.apps.get(id);
      if (!def) { console.warn('[VistoOS] App fehlt:', id); return null; }
      if (shell.mode === 'setup' || shell.mode === 'boot') return null;
      // rasch aufeinanderfolgende Aufrufe: nur der jüngste gewinnt, laufendes Schließen abwarten
      const gen = ++openGen;
      while (closing) await closing;
      if (gen !== openGen) return null;
      if (app && app.def.id === id) {
        if (app.inst.params) V.safe(() => app.inst.params(params || {}));
        return app;
      }
      if (V.control && V.control.isOpen) V.control.close();
      let from = shell.mode;
      if (shell.mode === 'app') {
        from = app ? app.from : lastFrom;
        if (app) await closeApp({ to: null, quick: true });
        while (closing) await closing;
        if (gen !== openGen) return null;
      }
      if (from === 'app') from = 'home';
      busy = true;
      origin = origin || { x: 500, y: 560, r: 70 };
      const el = U.el('div', { class: 'vos-screen vos-app', data: { app: id } });
      const content = U.el('div', { class: 'vos-app-content' });
      el.appendChild(content);
      el.style.background = def.color;
      stage.appendChild(el);
      const ctx = V.apps.makeContext(def, content, params);
      let inst = {};
      try { inst = def.create(ctx) || {}; } catch (e) { console.error('[VistoOS] App-Start', id, e); }
      const me = (app = { def, ctx, inst, el, content, origin, from });
      lastFrom = from;
      shell.mode = 'app';
      V.emit('shell:mode', 'app');
      V.emit('app:open', id);
      V.sound.play('open');
      V.haptic(8);
      const under = from === 'launcher' ? V.launcher.el : homeEl;
      const dist = Math.hypot(origin.x - 500, origin.y - 500);
      const endR = (500 + dist + 20) / 10;
      const startR = Math.max(4, (origin.r || 60) / 10);
      content.style.transformOrigin = `${origin.x / 10}% ${origin.y / 10}%`;
      const sp = (me.sp = V.spring(0, { response: 0.5, bounce: 0.06 }));
      sp.onUpdate((t) => {
        const k = U.clamp(t, 0, 1);
        el.style.clipPath = `circle(${U.lerp(startR, endR, t).toFixed(2)}% at ${origin.x / 10}% ${origin.y / 10}%)`;
        el.style.background = U.mix(def.color, '#000000', U.smoothstep(0.05, 0.6, k));
        content.style.transform = `scale(${U.lerp(0.55, 1, t).toFixed(4)})`;
        content.style.opacity = U.smoothstep(0.15, 0.7, k).toFixed(3);
        if (under) { under.style.transform = `scale(${(1 - 0.12 * k).toFixed(4)})`; under.style.opacity = (1 - 0.85 * k).toFixed(3); }
      });
      await sp.to(1);
      me.sp = null;
      if (app !== me) return null;   // während des Öffnens geschlossen
      el.style.clipPath = '';
      el.style.background = '#000';
      content.style.transform = '';
      content.style.opacity = '';
      if (under) under.style.visibility = 'hidden';
      busy = false;
      if (inst.shown) V.safe(() => inst.shown());
      return app;
    },

    /** Zurück: zuerst fragt die App selbst */
    back() {
      if (V.convo && V.convo.active) { V.convo.close(); return; }
      if (V.control && V.control.isOpen) { V.control.close(); return; }
      if (V.faceEditor && V.faceEditor.isOpen) { V.faceEditor.close(); return; }
      if (shell.mode === 'app') {
        if (!app) { shell.home(); return; }   // gerade im Übergang
        if (app.inst.back && V.safe(() => app.inst.back())) return;
        closeApp({ to: app.from === 'launcher' ? 'launcher' : 'home' });
      } else if (shell.mode === 'launcher') shell.home();
    },

    /** Taste am Sockel */
    homeButton() {
      // im Ruhemodus weckt die Taste nur (wie die erste Berührung)
      const sleeping = !!(V.ambient && V.ambient.on);
      V.emit('activity');
      if (sleeping) return;
      if (shell.mode === 'setup' || shell.mode === 'boot') return;
      if (V.notify.alertOpen) return;
      if (V.convo && V.convo.active) { V.convo.close(); return; }
      if (V.control && V.control.isOpen) { V.control.close(); return; }
      if (V.faceEditor && V.faceEditor.isOpen) { V.faceEditor.close(); return; }
      if (shell.mode === 'app') shell.home();
      else if (shell.mode === 'launcher') shell.home();
      else shell.launcher();
    },

    /** während Einrichtung/Start alles sperren */
    setMode(m) {
      shell.mode = m;
      V.emit('shell:mode', m);
    },
    /** Zifferblatt nach Einrichtung einblenden */
    enterHome(o = {}) {
      shell.mode = 'home';
      homeEl.style.visibility = '';
      showHome(o.instant);
      V.emit('shell:mode', 'home');
    },
    closeApp: (o) => closeApp(o || { to: 'home' }),
  });

  function showHome(instant) {
    homeEl.style.visibility = '';
    const sp = V.spring(instant ? 1 : 0, { response: 0.5, bounce: 0.1 });
    const apply = (t) => {
      homeEl.style.transform = `scale(${(1.14 - 0.14 * t).toFixed(4)})`;
      homeEl.style.opacity = U.clamp(t * 1.2, 0, 1).toFixed(3);
    };
    sp.onUpdate(apply);
    if (instant) { apply(1); homeEl.style.transform = ''; return Promise.resolve(); }
    return sp.to(1).then(() => { homeEl.style.transform = ''; });
  }
  function hideHome() {
    return V.tween({ duration: 0.42, ease: V.ease.outCubic, onUpdate: (t) => {
      homeEl.style.transform = `scale(${(1 - 0.2 * t).toFixed(4)})`;
      homeEl.style.opacity = (1 - t).toFixed(3);
    } }).promise.then(() => { if (shell.mode !== 'home') homeEl.style.visibility = 'hidden'; });
  }

  /** App schließen, zurück zu Symbol bzw. Mitte. o.to: 'home' | 'launcher' | null, o.from = Fortschritt der Geste */
  function closeApp(o = {}) {
    if (!app) return closing || Promise.resolve();
    const p = closeAppNow(o);
    const done = (closing = p.catch((e) => { console.error('[VistoOS] closeApp', e); busy = false; }).then(() => { if (closing === done) closing = null; }));
    return done;
  }
  /** nach einem abgebrochenen Wechsel (Modus „app“ ohne App) wieder einen festen Zustand herstellen */
  async function settleApp() {
    while (closing) await closing;
    if (shell.mode === 'app' && !app) {
      shell.mode = lastFrom === 'launcher' && V.launcher.visible ? 'launcher' : 'home';
      if (shell.mode === 'home') { homeEl.style.visibility = ''; homeEl.style.opacity = ''; homeEl.style.transform = ''; }
      V.emit('shell:mode', shell.mode);
    }
  }
  async function closeAppNow(o) {
    const a = app;
    app = null;
    busy = true;
    if (a.sp) { a.sp.stop(); a.sp = null; }   // Öffnen läuft noch → abbrechen
    const to = o.to === undefined ? 'home' : o.to;
    const under = to === 'launcher' || (to === null && a.from === 'launcher') ? V.launcher.el : homeEl;
    if (to === 'launcher' && !V.launcher.visible) V.launcher.show({ instant: true, reset: false });
    if (to === 'home' && a.from === 'launcher') { V.launcher.hide({ instant: true }); }
    if (under) { under.style.visibility = ''; }
    if (to === 'home') homeEl.style.visibility = '';
    const target = (to === 'launcher' && V.launcher.originOf(a.def.id)) || (to === 'home' ? { x: 500, y: 500, r: 120 } : a.origin) || { x: 500, y: 500, r: 60 };
    if (!o.quick) V.sound.play('close');
    const start = o.progress || 0;
    const content = a.content, el = a.el;
    const fromScale = o.fromScale || 1;
    const fromX = o.fromX || 0;
    content.style.transformOrigin = `${target.x / 10}% ${target.y / 10}%`;
    el.style.transform = '';
    const dist = Math.hypot(target.x - 500, target.y - 500);
    const startR = (500 + dist + 20) / 10;
    const endR = Math.max(3, (target.r || 60) / 10);
    const dur = o.quick ? 0.22 : 0.48;
    await V.tween({ duration: dur * (1 - start * 0.5), ease: V.ease.smooth, onUpdate: (t) => {
      const k = start + (1 - start) * t;
      el.style.clipPath = `circle(${U.lerp(startR, endR, k).toFixed(2)}% at ${target.x / 10}% ${target.y / 10}%)`;
      content.style.transform = `translateX(${(fromX * (1 - t) / 10).toFixed(2)}cqw) scale(${(U.lerp(fromScale, 0.4, t)).toFixed(4)})`;
      content.style.opacity = (1 - U.smoothstep(0.35, 0.95, k)).toFixed(3);
      el.style.background = U.mix('#000000', a.def.color, U.smoothstep(0.55, 1, k));
      if (under) { under.style.transform = `scale(${(0.88 + 0.12 * k).toFixed(4)})`; under.style.opacity = (0.15 + 0.85 * k).toFixed(3); }
    } }).promise;
    if (a.inst.destroy) V.safe(() => a.inst.destroy());
    a.ctx._destroy();
    el.remove();
    if (under) { under.style.transform = ''; under.style.opacity = ''; }
    // die andere Ebene kann vom Öffnen noch verkleinert/abgedunkelt sein
    const other = under === homeEl ? V.launcher.el : homeEl;
    if (other) { other.style.transform = ''; other.style.opacity = ''; }
    if (to === 'launcher') homeEl.style.visibility = 'hidden';
    busy = false;
    V.emit('app:close', a.def.id);
    if (to === 'home') { shell.mode = 'home'; homeEl.style.opacity = ''; homeEl.style.transform = ''; V.emit('shell:mode', 'home'); }
    else if (to === 'launcher') { shell.mode = 'launcher'; V.emit('shell:mode', 'launcher'); }
  }

  /* -------------------------------------------------------- Gesten */
  function lineZone(x, y) { return y > 868 && Math.abs(x - 500) < 175; }
  function isInteractive(t) {
    return !!(t && t.closest && t.closest('button, input, textarea, select, a, [data-tap], .vos-rrow, .vos-lic, .vos-banner'));
  }
  function blocked() {
    return shell.mode === 'boot' || shell.mode === 'setup' || V.notify.alertOpen || (V.faceEditor && V.faceEditor.isOpen);
  }
  function crownTarget() {
    if (V.convo && V.convo.active) return null;
    if (V.control && V.control.isOpen) return V.control.crown ? (d) => V.control.crown(d) : null;
    if (shell.mode === 'app') return app && app.inst.crown ? (d) => app.inst.crown(d) : null;
    if (shell.mode === 'launcher') return (d) => V.launcher.crown(d);
    if (shell.mode === 'home') return (d) => {
      const b = U.clamp(V.store.get('settings.brightness', 0.9) + d / 300, 0.05, 1);
      V.store.set('settings.brightness', b);
      V.rim.level('Helligkeit', b, { color: '#FFD60A', side: d > 0 ? 'right' : 'right' });
    };
    return null;
  }

  function attachGestures() {
    const root = V.display.el;
    let kind = null, ng = null, startLine = false, startTop = false, startEdge = false, startRim = false;
    let crownFn = null, lastA = 0;

    V.gesture(root, {
      start(p, e) {
        kind = null; crownFn = null;
        V.emit('activity');
        if (blocked()) { kind = 'none'; return; }
        const t = e.target;
        const n = t && t.closest ? t.closest('[data-nogesture]') : null;
        ng = n ? n.getAttribute('data-nogesture') : null;
        startLine = lineZone(p.x0, p.y0) && !(V.convo && V.convo.active);
        startTop = p.y0 < 135 && Math.abs(p.x0 - 500) < 260;
        startEdge = p.x0 < 120 && Math.abs(p.y0 - 500) < 320;
        startRim = p.r0 > 395;
        lastA = 0;
        if (startLine && !isInteractive(t)) V.visto && V.visto.hover(true);
      },
      move(p) {
        if (kind === 'none') return;
        if (!kind) {
          if (!p.moved) return;
          const ax = Math.abs(p.dx), ay = Math.abs(p.dy);
          const horiz = ax > ay * 1.15, vert = ay > ax * 1.15;
          // tangentiale Bewegung am Rand?
          const tang = Math.abs(p.dA) * (Math.PI / 180) * p.r0;
          const radial = Math.abs(p.r - p.r0);
          const visto = V.convo && V.convo.active;
          const ccOpen = !!(V.control && V.control.isOpen);
          if (startEdge && horiz && p.dx > 0 && (shell.mode === 'app' || shell.mode === 'launcher') && !visto && !ccOpen && ng !== 'noedge') kind = 'back';
          else if (startLine && vert && p.dy < 0 && !visto) kind = 'visto';
          else if (startRim && tang > radial * 1.4 && tang > 18 && !ccOpen && (crownFn = crownTarget()) && ng !== 'all') kind = 'crown';
          else if (startTop && vert && p.dy > 0 && !visto && shell.mode !== 'home' && V.control) kind = 'control';
          else if (ng === 'all') kind = 'none';
          else if (shell.mode === 'home' && !visto && !(V.control && V.control.isOpen)) {
            if (vert && p.dy < 0 && ng !== 'y') kind = 'launcher';
            else if (vert && p.dy > 0 && ng !== 'y') kind = 'control';
            else if (horiz && ng !== 'x') kind = 'face';
            else kind = 'none';
          } else kind = 'none';
          if (kind !== 'none') { V.gesture.claim('shell'); shell.swallowClick = true; }
          if (kind === 'back') beginBack();
          if (kind === 'crown') { lastA = p.dA; crownAcc = 0; }
        }
        if (kind === 'back') moveBack(p);
        else if (kind === 'crown' && crownFn) {
          const d = p.dA - lastA; lastA = p.dA;
          crownAcc += d;
          // fühlbare Rastung alle 12°
          if (Math.abs(crownAcc) >= 12) { V.sound.play('tick'); V.haptic(3); crownAcc = 0; }
          crownFn(d);
        }
      },
      end(p) {
        V.visto && V.visto.hover(false);
        const k = kind; kind = null;
        setTimeout(() => { shell.swallowClick = false; }, 0);
        if (!k || k === 'none' || p.cancelled) { if (k === 'back') endBack(p, true); return; }
        if (k === 'back') endBack(p);
        else if (k === 'visto') { if (p.dy < -40) V.convo && V.convo.activate({ via: 'swipe' }); }
        else if (k === 'launcher') { if (p.dy < -60 || p.vy < -500) shell.launcher(); }
        else if (k === 'control') { if (p.dy > 60 || p.vy > 500) V.control && V.control.open(); }
        else if (k === 'face') { if (Math.abs(p.dx) > 70 || Math.abs(p.vx) > 600) V.faces.next(p.dx < 0 ? 1 : -1); }
      },
      tap(p, e) {
        if (blocked()) return;
        if (isInteractive(e.target)) return;
        if (lineZone(p.x, p.y) && !(V.convo && V.convo.active) && !(V.control && V.control.isOpen)) {
          V.convo && V.convo.activate({ via: 'tap' });
        }
      },
      long(p, e) {
        if (blocked() || shell.mode !== 'home') return;
        if (V.convo && V.convo.active) return;
        if (V.control && V.control.isOpen) return;
        if (isInteractive(e.target)) return;
        if (lineZone(p.x, p.y)) return;
        V.haptic(14);
        V.faceEditor && V.faceEditor.open();
      },
    }, { owner: 'shell', slop: 12, longMs: 520 });
  }

  /* ------------------------------------------- interaktives Zurück */
  function beginBack() {
    if (!app && shell.mode === 'launcher') { backDrag = { launcher: true }; return; }
    if (!app) return;
    const under = app.from === 'launcher' ? V.launcher.el : homeEl;
    if (app.from === 'launcher' && !V.launcher.visible) V.launcher.show({ instant: true, reset: false });
    under.style.visibility = '';
    backDrag = { under, a: app };
    app.content.style.transformOrigin = '50% 50%';
  }
  function moveBack(p) {
    if (!backDrag || backDrag.launcher) return;
    const k = U.clamp(p.dx / 520, 0, 1);
    const e = 1 - Math.pow(1 - k, 2);
    backDrag.k = k;
    const a = backDrag.a;
    a.el.style.transform = `translateX(${(p.dx * 0.32 / 10).toFixed(2)}cqw) scale(${(1 - 0.24 * e).toFixed(4)})`;
    a.el.style.borderRadius = '50%';
    a.el.style.opacity = (1 - 0.25 * e).toFixed(3);
    backDrag.under.style.transform = `scale(${(0.88 + 0.12 * e).toFixed(4)})`;
    backDrag.under.style.opacity = (0.15 + 0.85 * e).toFixed(3);
  }
  function endBack(p, cancelled) {
    const b = backDrag; backDrag = null;
    if (!b) return;
    if (b.launcher) { if (!cancelled && (p.dx > 80 || p.vx > 600)) shell.home(); return; }
    const a = b.a;
    const commit = !cancelled && ((b.k || 0) > 0.28 || p.vx > 650);
    if (commit && app === a) {
      // erst internes Zurück der App fragen
      if (a.inst.back && V.safe(() => a.inst.back())) { springBack(a, b); return; }
      const k = b.k || 0;
      const e = 1 - Math.pow(1 - k, 2);
      a.el.style.transform = '';
      a.el.style.opacity = '';
      closeApp({ to: a.from === 'launcher' ? 'launcher' : 'home', progress: 0, fromScale: 1 - 0.24 * e, fromX: p.dx * 0.32 });
    } else springBack(a, b);
  }
  function springBack(a, b) {
    const k0 = b.k || 0;
    V.tween({ duration: 0.35, ease: V.ease.smooth, onUpdate: (t) => {
      const k = k0 * (1 - t);
      const e = 1 - Math.pow(1 - k, 2);
      a.el.style.transform = `scale(${(1 - 0.24 * e).toFixed(4)})`;
      a.el.style.opacity = (1 - 0.25 * e).toFixed(3);
      b.under.style.transform = `scale(${(0.88 + 0.12 * e).toFixed(4)})`;
      b.under.style.opacity = (0.15 + 0.85 * e).toFixed(3);
    } }).promise.then(() => {
      a.el.style.transform = ''; a.el.style.opacity = '';
      if (app === a) b.under.style.visibility = 'hidden';
    });
  }
})();
