/* VistoOS · os/glances.js — „Blicke“: runde Kurzansichten links und rechts vom Zifferblatt
 *
 *  Die Seiten liegen wie auf einem großen Drehteller, dessen Achse weit unter dem Display sitzt:
 *  Wischen dreht den Teller, die Seite folgt dem Finger, die gehende Seite sinkt, kippt, wird kleiner
 *  und weich; beim Loslassen rastet der Teller mit seiner Masse in die nächste Seite ein. An den Enden
 *  hält ein Gummiband dagegen. Seitenpunkte liegen als Bogen oben am Rand.
 *
 *  V.glances.register({ id, app, name, order, create(root, ctx) → { update(), destroy() } })
 *      order < 0  links vom Zifferblatt · order ≥ 0 rechts davon (kleiner = näher am Zifferblatt)
 *      oder in der App-Definition:  glance: { order, create(root, ctx) }   (id = App-ID, ersetzt den mitgelieferten Blick)
 *  ctx = { id, app (Definition), root, visible, open(params), accent(), onFrame(fn), on(evt, fn),
 *          label(text, farbe) → Titel am oberen Bogen, aura(farbe, stärke) → weiches Licht im Hintergrund }
 *      onFrame läuft nur, solange der Blick sichtbar ist; on(…) ruft nur dann, sonst folgt später update().
 *      update() kommt beim Sichtbarwerden und jede Minute. Antippen des Blicks öffnet die App (ctx.open).
 *
 *  V.glances.show(id | 'face', {instant})   V.glances.next(±1)   V.glances.current   V.glances.list()
 *  V.glances.faceShown   1 = Zifferblatt ganz zu sehen … 0 = ganz weggedreht
 *  V.glances.smile(svg, {r, half})   Bogen unten („Lächeln“) als gemeinsame Anzeige der Blicke
 *  Ereignisse: 'glance:changed' id · 'glance:move' {pos, faceShown}
 *
 *  Zurück zum Zifferblatt: nach Ruhe (25 s), im Ruhemodus, mit der Sockeltaste.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  /* ----------------------------------------------------------- Geometrie */
  const PIVOT = 1800;                                        // Drehpunkt: so weit unter der Displaymitte (logisch)
  const GAP = 50;                                            // Luft zwischen zwei Seiten
  const STEP = 2 * Math.asin((1000 + GAP) / 2 / PIVOT);      // Winkel zwischen zwei Seiten (Bogenmaß)
  const STEP_DEG = U.deg(STEP);
  const PAGE_DX = PIVOT * STEP;                              // Fingerweg für eine Seite (logisch)
  const CROWN_DEG = 60;                                      // Drehen am Rand: Grad je Seite
  const DOT_DEG = 4.3, DOT_R = 466.5;                          // Seitenpunkte: Abstand und Radius
  const RETURN_S = 25;                                       // Ruhe bis zur Rückkehr zum Zifferblatt
  const SMILE_R = 322, SMILE_HALF = 31;                      // Bogen unten: Radius, halbe Öffnung (Grad)

  const reg = new Map();
  let home = null, pages = [], faceIdx = 0, built = false;
  let dotsEl = null, dotMark = null, faceEdge = null;
  let cur = 'face', dirty = false, lastV = 0, lastAct = performance.now();
  let drag = null, crownOn = false, crownV0 = 0, crownAcc = 0, tickAt = null, dotsT = 0, rebuildT = 0;

  const pos = V.spring(0, V.motion.smooth);                  // gleitende Seitenposition (Index)
  pos.onUpdate(() => { dirty = true; });
  const dotsA = V.spring(0, V.motion.smooth);
  dotsA.onUpdate((v) => { if (dotsEl) dotsEl.style.opacity = U.clamp(v, 0, 1).toFixed(3); });

  const lineZone = (x, y) => y > 868 && Math.abs(x - 500) < 175;
  const accent = () => V.store.get('settings.accent', '#FF9A4D');
  const quiet = () => !!(V.convo && V.convo.active) || !!(V.control && V.control.isOpen) || !!(V.switcher && V.switcher.isOpen);
  const blur = () => !V.perf || V.perf.level >= 2;

  styles();

  /* ------------------------------------------------------------- Seiten */
  function makePage(def) {
    const el = U.el('div', { class: 'vos-screen gl-page', data: { glance: def.id }, style: { visibility: 'hidden' }, attrs: { role: 'button', 'aria-label': def.name || def.id } });
    const body = U.el('div', { class: 'gl-body' });
    const edge = U.el('div', { class: 'gl-edge' });
    el.append(body, edge);
    el._gl = true;
    home.appendChild(el);
    return { id: def.id, def, el, body, edge, inst: null, vis: false, frames: [], offs: [], dirty: true, labelArc: null, auraEl: null };
  }

  function ensure(p) {
    if (p.inst || p.face) return;
    const def = p.def;
    const ctx = {
      id: def.id, app: V.apps.get(def.app) || null, root: p.body,
      get visible() { return p.vis; },
      accent,
      open(params, origin) { openPage(p, params, origin); },
      onFrame(fn) { p.frames.push(fn); return () => { const i = p.frames.indexOf(fn); if (i >= 0) p.frames.splice(i, 1); }; },
      on(evt, fn) {
        const off = V.on(evt, (d) => { if (p.vis) V.safe(() => fn(d), 'Blick ' + p.id); else p.dirty = true; });
        p.offs.push(off);
        return off;
      },
      label(text, color) {
        if (!p.labelArc) {
          p.labelArc = V.ui.arcText({ text, r: 428, size: 26, weight: 700, spacing: 5, color: color || 'rgba(255,255,255,.55)' });
          p.labelArc.el.classList.add('gl-label');
          p.body.appendChild(p.labelArc.el);
        } else {
          p.labelArc.set(text);
          if (color) p.labelArc.text.setAttribute('fill', color);
        }
        return p.labelArc;
      },
      aura(color, k = 1) {
        if (!p.auraEl) { p.auraEl = U.el('div', { class: 'gl-aura' }); p.body.insertBefore(p.auraEl, p.body.firstChild); }
        const key = color + '|' + k.toFixed(2);
        if (p.auraEl._k === key) return;
        p.auraEl._k = key;
        p.auraEl.style.background = color
          ? `radial-gradient(62% 50% at 50% 30%, ${U.rgba(color, 0.2 * k)}, ${U.rgba(color, 0.06 * k)} 58%, ${U.rgba(color, 0)} 100%)`
          : 'none';
      },
    };
    p.ctx = ctx;
    let inst = null;
    try { inst = def.create(p.body, ctx) || {}; } catch (e) { console.error('[VistoOS] Blick', def.id, e); inst = {}; }
    p.inst = inst;
    p.dirty = true;
  }
  function kill(p) {
    if (p.face || !p.inst) return;
    if (p.inst.destroy) V.safe(() => p.inst.destroy(), 'Blick ' + p.id);
    for (const f of p.offs.splice(0)) f();
    p.frames.length = 0;
    p.inst = null; p.ctx = null; p.labelArc = null; p.auraEl = null;
    p.body.innerHTML = '';
  }
  function update(p) {
    p.dirty = false;
    if (p.inst && p.inst.update) V.safe(() => p.inst.update(), 'Blick ' + p.id);
  }
  function setVis(p, vis) {
    if (p.vis === vis) return;
    p.vis = vis;
    p.el.style.visibility = vis ? '' : 'hidden';
    if (vis) { ensure(p); update(p); }
  }

  function collect() {
    // Blicke aus App-Definitionen (glance: { order, create })
    for (const a of V.apps.list(true)) {
      if (!a.glance || typeof a.glance.create !== 'function') continue;
      const have = reg.get(a.id);
      if (have && have._from === a) continue;
      reg.set(a.id, { id: a.id, app: a.id, name: a.name, order: a.glance.order !== undefined ? a.glance.order : 50, create: a.glance.create, _from: a });
    }
  }

  function build() {
    home = V.faces && V.faces.home;
    if (!home) return;
    collect();
    const keep = cur;
    for (const p of pages) if (!p.face) { kill(p); p.el.remove(); }
    const defs = Array.from(reg.values()).filter((d) => !d.app || V.apps.get(d.app)).sort((a, b) => a.order - b.order);
    const left = defs.filter((d) => d.order < 0), right = defs.filter((d) => d.order >= 0);
    pages = left.map(makePage).concat([{ id: 'face', face: true }], right.map(makePage));
    faceIdx = left.length;
    if (!faceEdge) { faceEdge = U.el('div', { class: 'gl-edge gl-edge-face' }); faceEdge._gl = true; }
    home.appendChild(faceEdge);
    buildDots();
    built = true;
    let i = pages.findIndex((p) => p.id === keep);
    if (i < 0) { i = faceIdx; cur = 'face'; }
    pos.set(i);
    lastV = i;
    apply();
  }

  function buildDots() {
    if (dotsEl) dotsEl.remove();
    dotsEl = U.svg('svg', { class: 'vos-svg gl-dots', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    dotsEl._gl = true;
    pages.forEach((p, i) => {
      const pt = V.display.pt((i - faceIdx) * DOT_DEG, DOT_R);
      dotsEl.appendChild(p.face
        ? U.svg('circle', { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 4.4, fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 2.2 })
        : U.svg('circle', { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 4.2, fill: 'rgba(255,255,255,.34)' }));
    });
    dotMark = U.svg('path', { fill: 'none', stroke: '#fff', 'stroke-width': 10.5, 'stroke-linecap': 'round' });
    dotsEl.appendChild(dotMark);
    dotsEl.style.opacity = U.clamp(dotsA.value, 0, 1).toFixed(3);
    home.appendChild(dotsEl);
  }
  function showDots() {
    dotsA.to(1);
    clearTimeout(dotsT);
    dotsT = setTimeout(() => { if (!drag && !crownOn) dotsA.to(cur === 'face' ? 0 : 0.45, V.motion.gentle); }, 1500);
  }

  /* --------------------------------------------------------- Drehteller */
  /** Seite um den fernen Drehpunkt drehen; d = Abstand in Seiten (0 = vorn) */
  function place(el, d) {
    const ad = Math.abs(d);
    const st = el.style;
    if (ad >= 1.02) { if (st.visibility !== 'hidden') st.visibility = 'hidden'; return; }
    if (st.visibility === 'hidden') st.visibility = '';
    if (ad < 0.0006) { st.transform = ''; st.opacity = ''; st.filter = ''; st.willChange = ''; return; }
    const th = d * STEP, k = Math.min(1, ad);
    const x = (PIVOT * Math.sin(th)) / 10, y = (PIVOT * (1 - Math.cos(th))) / 10;
    st.willChange = 'transform, opacity';
    st.transform = `translate(${x.toFixed(2)}cqw, ${y.toFixed(2)}cqw) rotate(${(d * STEP_DEG).toFixed(2)}deg) scale(${(1 - 0.1 * k).toFixed(4)})`;
    st.opacity = (1 - 0.62 * U.smoothstep(0.2, 1, k)).toFixed(3);
    // Unschärfe in Stufen: zwischen zwei Stufen bleibt das weichgezeichnete Bild im Speicher der Grafikkarte
    const b = blur() ? Math.round(1.3 * U.smoothstep(0.38, 1, k) * 5) / 5 : 0;
    const f = b > 0 ? `blur(${b.toFixed(1)}cqw)` : '';
    if (st.filter !== f) st.filter = f;
  }
  function edgeAlpha(d) { const ad = Math.abs(d); return ad >= 1.02 ? 0 : Math.min(1, ad * 7) * (1 - U.smoothstep(0.7, 1, ad)); }

  function apply() {
    if (!built) return;
    const v = pos.value;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i], d = i - v;
      if (p.face) {
        // alles im Startbildschirm, was nicht zu den Blicken gehört, ist das Zifferblatt
        const kids = home.children;
        for (let j = 0; j < kids.length; j++) if (!kids[j]._gl) place(kids[j], d);
        place(faceEdge, d);
        faceEdge.style.opacity = edgeAlpha(d).toFixed(3);
        faceEdge.style.filter = '';
      } else {
        const vis = Math.abs(d) < 1.02;
        setVis(p, vis);
        if (vis) { place(p.el, d); p.edge.style.opacity = edgeAlpha(d).toFixed(3); }
      }
    }
    // Seitenpunkte: die Marke gleitet mit und zieht sich bei Tempo in die Länge
    const sp = Math.min(6, Math.abs(v - lastV) / Math.max(V.loop.dt || 1 / 60, 1 / 240));
    lastV = v;
    const a = (v - faceIdx) * DOT_DEG, st = 0.03 + sp * 0.3;
    dotMark.setAttribute('d', V.ui.arcPath(500, 500, DOT_R, a - st, a + st));
    if (tickAt !== null && Math.abs(v - tickAt) < 0.05) { tickAt = null; V.sound.play('tick'); V.haptic(6); }
    V.emit('glance:move', moveInfo(v));
  }
  const mv = { pos: 0, faceShown: 1 };
  function moveInfo(v) { mv.pos = v - faceIdx; mv.faceShown = 1 - Math.min(1, Math.abs(v - faceIdx)); return mv; }

  function frame(dt, t) {
    if (dirty) { dirty = false; apply(); }
    if (!built || cur === 'face' && !pos.moving && !drag && !crownOn) return;
    if (V.shell.mode !== 'home' || home.style.visibility === 'hidden' || document.hidden) return;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p.vis || !p.frames.length) continue;
      for (let j = 0; j < p.frames.length; j++) p.frames[j](dt, t);
    }
  }

  /** Gummiband an den Enden */
  function band(v) {
    const hi = pages.length - 1;
    const rb = (x) => (1 - 1 / (x * 1.15 + 1)) * 0.4;
    return v < 0 ? -rb(-v) : v > hi ? hi + rb(v - hi) : v;
  }

  function setCurrent(i) {
    const p = pages[i];
    if (!p || p.id === cur) return;
    cur = p.id;
    lastAct = performance.now();
    if (!p.face && V.horizon && V.horizon.active && V.horizon.back) V.safe(() => V.horizon.back(), 'horizon');
    if (V.lumen && V.lumen.tint) V.safe(() => V.lumen.tint(p.face ? null : (V.apps.get(p.def.app) || {}).color || null, 0.7), 'lumen');
    V.emit('glance:changed', cur);
  }
  /** einrasten: Ziel-Seite anfahren (mit Schwung, falls vorhanden) */
  function settle(i, o = {}) {
    i = U.clamp(Math.round(i), 0, pages.length - 1);
    if (pages[i].id !== cur) tickAt = i;
    setCurrent(i);
    showDots();
    const cfg = Object.assign({}, o.spring || V.motion.smooth, { velocity: o.velocity || 0 });
    return pos.to(i, cfg);
  }
  const atFace = () => cur === 'face' && Math.abs(pos.value - faceIdx) < 0.02;

  /* ------------------------------------------------------ Wischen (Shell) */
  V.shell.hooks.homeSwipeX = {
    start(p) {
      if (!built || quiet()) { drag = null; return; }
      pos.stop();
      drag = { v0: pos.value, dx0: p.dx, base: U.clamp(Math.round(pos.value), 0, pages.length - 1) };
      tickAt = null;
      dotsA.to(1);
      clearTimeout(dotsT);
    },
    move(p) {
      if (!drag) return;
      pos.set(band(drag.v0 - (p.dx - drag.dx0) / PAGE_DX));
    },
    end(p, cancelled) {
      const d = drag; drag = null;
      if (!d) return;
      const v = pos.value, hi = pages.length - 1;
      // Tempo beim Loslassen; bei kurzen Schnippern zählt auch das Mittel über die ganze Geste (wenige Messpunkte)
      let vx = p.vx || 0;
      if (p.ms > 0 && p.ms < 300) { const avg = p.dx / (p.ms / 1000); if (Math.abs(avg) > Math.abs(vx) && avg * (vx || avg) > 0) vx = avg; }
      const vel = cancelled ? 0 : U.clamp(-vx / PAGE_DX, -7, 7);        // Seiten je Sekunde
      const moved = v - d.base;
      let t = d.base;
      if (!cancelled) {
        if (Math.abs(vel) > 0.45 && (Math.abs(moved) < 0.04 || Math.sign(vel) === Math.sign(moved))) t = d.base + Math.sign(vel);
        else if (Math.abs(moved) > 0.34) t = d.base + Math.sign(moved);
      }
      t = U.clamp(t, 0, hi);
      const over = v < 0 || v > hi;
      // über das Ende hinaus gezogen: weich zurück; sonst trägt der Schwung in die Raste
      settle(t, over ? { spring: V.motion.smooth } : { spring: V.motion.bouncy, velocity: vel });
    },
  };

  /* ---------------------------------- Drehen am Rand: auf einem Blick dreht es den Teller */
  // Das Zifferblatt behält sein eigenes Drehen (Zeitreise); liegt ein Blick vorn, übernimmt der Teller.
  const hooks = V.shell.hooks;
  let innerCrown = hooks.homeCrown || null;
  const tableCrown = {
    start() { crownOn = true; pos.stop(); crownV0 = pos.value; crownAcc = 0; tickAt = null; dotsA.to(1); clearTimeout(dotsT); },
    turn(dA) {
      if (!crownOn) return;
      crownAcc += dA;
      pos.set(band(crownV0 - crownAcc / CROWN_DEG));
    },
    end() {
      if (!crownOn) return;
      crownOn = false;
      settle(Math.round(U.clamp(pos.value, 0, pages.length - 1)), { spring: V.motion.bouncy });
    },
  };
  try {
    Object.defineProperty(hooks, 'homeCrown', {
      configurable: true, enumerable: true,
      get() { return built && (crownOn || !atFace()) ? tableCrown : innerCrown; },
      set(v) { innerCrown = v; },
    });
  } catch (e) { /* dann bleibt das Drehen beim Zifferblatt */ }

  /* --------------------------------------------------------- Sockeltaste */
  // Erweiterungspunkt hooks.basePress[] (fn → true = behandelt). Fehlt er in der Shell, wird die Taste hier umhüllt.
  if (!Array.isArray(hooks.basePress)) {
    hooks.basePress = [];
    const orig = V.shell.homeButton;
    let last = 0;
    V.shell.homeButton = function () {
      const m = V.shell.mode;
      const free = !(V.ambient && V.ambient.on) && m !== 'setup' && m !== 'boot' && !V.notify.alertOpen
        && !(V.convo && V.convo.active) && !(V.control && V.control.isOpen) && !(V.faceEditor && V.faceEditor.isOpen);
      if (free) {
        const now = performance.now();
        if (hooks.baseDouble && now - last < 380) { last = 0; V.emit('activity'); V.safe(() => hooks.baseDouble(), 'baseDouble'); return undefined; }
        for (const fn of hooks.basePress) if (V.safe(() => fn(), 'hook basePress')) { last = now; V.emit('activity'); return undefined; }
      }
      return orig.apply(this, arguments);
    };
  }
  hooks.basePress.push(() => {
    if (!built || cur === 'face' && !pos.moving) return false;
    if (V.shell.mode === 'home' && !quiet()) { glances.show('face'); return true; }
    glances.show('face', { instant: true });      // unter einer App/dem Orbit: „Home“ heißt Zifferblatt
    return false;
  });

  /* ---------------------------------------------------------------- API */
  function openPage(p, params, origin) {
    if (!p || p.face || !p.def.app || !V.apps.get(p.def.app)) return;
    V.shell.open(p.def.app, params || {}, origin || { x: 500, y: 500, r: 330 });
  }

  const glances = (V.glances = {
    register(def) {
      if (!def || !def.id || typeof def.create !== 'function') throw new Error('Blick ohne id/create');
      def.order = def.order !== undefined ? def.order : 50;
      reg.set(def.id, def);
      if (built) { clearTimeout(rebuildT); rebuildT = setTimeout(build, 0); }
      return def;
    },
    get: (id) => reg.get(id),
    list: () => pages.map((p) => ({ id: p.id, name: p.face ? 'Zifferblatt' : p.def.name || p.id, app: p.face ? null : p.def.app || null })),
    get current() { return cur; },
    get faceShown() { return built ? 1 - Math.min(1, Math.abs(pos.value - faceIdx)) : 1; },
    get moving() { return !!drag || crownOn || pos.moving; },
    show(id, o = {}) {
      if (!built) return false;
      const i = pages.findIndex((p) => p.id === id || (!p.face && p.def.app === id));
      if (i < 0) return false;
      if (o.instant) {
        pos.set(i); tickAt = null; setCurrent(i); lastV = i; dirty = false; apply();
        clearTimeout(dotsT); dotsA.set(cur === 'face' ? 0 : 0.45);
      } else settle(i, { spring: o.gentle ? V.motion.gentle : V.motion.smooth });
      return true;
    },
    next(dir = 1) {
      if (!built) return false;
      const i = U.clamp(Math.round(pos.target) + (dir < 0 ? -1 : 1), 0, pages.length - 1);
      settle(i, { spring: V.motion.bouncy });
      return pages[i].id;
    },
    smile,
    PAGE_DX,
  });

  /* ------------------------------------------------- Systemanbindung */
  V.on('boot:ready', () => {
    build();
    V.loop.add(frame, 4);
    // nach den übrigen Systemmodulen (Live-Rand, Tortenmenü): erst sie, dann der Blick
    setTimeout(() => {
      hooks.tap.push((p, e) => {
        if (!built || V.shell.mode !== 'home' || cur === 'face' || quiet() || drag || lineZone(p.x, p.y)) return false;
        if (!home.contains(e.target)) return false;
        const pg = pages.find((x) => x.id === cur);
        if (!pg || Math.abs(pos.value - pages.indexOf(pg)) > 0.25) return false;
        V.sound.play('tap'); V.haptic(6);
        if (pg.inst && pg.inst.tap && V.safe(() => pg.inst.tap(p), 'Blick ' + pg.id)) return true;
        openPage(pg);
        return true;
      });
      // langes Drücken gehört auf einem Blick nicht dem Zifferblatt-Editor
      hooks.long.push((p, e) => built && V.shell.mode === 'home' && cur !== 'face' && home.contains(e.target));
    }, 0);
    intents();
  });

  V.on('activity', () => { lastAct = performance.now(); });
  V.on('horizon:travel', (e) => { if (e && e.active && built && cur !== 'face' && !drag && !crownOn) glances.show('face'); });
  V.on('face:changed', () => { if (built && !atFace()) { dirty = false; apply(); } });   // neues Blatt sofort mit auf den Teller
  V.on('time:minute', () => { for (const p of pages) { if (p.face) continue; if (p.vis) update(p); else p.dirty = true; } });
  V.on('ambient', (on) => {
    if (!on || !built) return;
    glances.show('face', { instant: true });
    for (const p of pages) kill(p);               // im Ruhemodus nichts festhalten
  });
  let awayT = 0;
  V.on('shell:mode', (m) => {
    clearTimeout(awayT);
    if (!built || cur === 'face') return;
    if (m === 'launcher') awayT = setTimeout(() => { if (V.shell.mode === 'launcher') glances.show('face', { instant: true }); }, 480);
    else if (m === 'app') awayT = setTimeout(() => { if (V.shell.mode === 'app') glances.show('face', { instant: true }); }, 30000);
    else if (m === 'home') lastAct = performance.now();
  });
  setInterval(() => {
    if (!built || cur === 'face' || drag || crownOn) return;
    if (V.shell.mode !== 'home' || quiet()) { return; }
    if (performance.now() - lastAct > RETURN_S * 1000) glances.show('face', { gentle: true });
  }, 1000);

  /* -------------------------------------------------- Visto-Absichten */
  function afterTalk(fn) {
    // nach der Antwort das Gespräch schließen und dann sichtbar handeln
    setTimeout(() => {
      if (V.convo && V.convo.active) { V.convo.close(); setTimeout(fn, 440); } else fn();
    }, 1400);
  }
  function goto(id) {
    const go = () => { if (id === 'next') glances.next(1); else glances.show(id); };
    if (V.shell.mode === 'home') { go(); return; }
    V.shell.home();
    setTimeout(go, 620);
  }
  function findByText(t) {
    for (const p of pages) {
      if (p.face) continue;
      const app = V.apps.get(p.def.app);
      const words = [String(p.def.name || '').toLowerCase(), p.id].concat((app && app.keywords) || []).filter((w) => w && w.length > 2);
      if (words.some((w) => t.includes(w))) return p;
    }
    return null;
  }
  function intents() {
    if (!V.brain || !V.brain.intent) return;
    const names = () => pages.filter((p) => !p.face).map((p) => p.def.name || p.id);
    V.brain.intent({
      id: 'glance', priority: 11,
      match: (t) => {
        if (!/(?<!augen|über|aus|rück|ein|an|durch|weit|hin|wohl)blick(e|en)?(?![a-zäöüß])|kurzansicht/.test(t)) return null;
        if (/^(was|wie|wo|warum|wieso|wer)\b/.test(t) && !/welche|gibt/.test(t)) return null;
        const p = findByText(t);
        if (p) return { id: p.id, name: p.def.name || p.id };
        if (/(?<![a-zäöüß])(nächste[nr]?|weiter|andere[nr]?)(?![a-zäöüß])/.test(t)) return { id: 'next' };
        if (/(?<![a-zäöüß])(welche|gibt es|zeig|alle|meine)(?![a-zäöüß])/.test(t)) return { list: true };
        return null;
      },
      run(m) {
        if (m.list) return { say: `Neben dem Zifferblatt liegen ${names().join(', ').replace(/, ([^,]*)$/, ' und $1')}. Wisch einfach zur Seite.`, emotion: 'happy' };
        afterTalk(() => goto(m.id));
        return { say: m.id === 'next' ? 'Hier ist der nächste Blick.' : `Hier ist der ${m.name}-Blick.`, emotion: 'happy' };
      },
    });
    V.actions.register('system.glance', {
      desc: 'Zeigt einen „Blick“ (runde Kurzansicht neben dem Zifferblatt). id: ' + pages.filter((p) => !p.face).map((p) => `${p.id} (${p.def.name || p.id})`).join(', ') + ' oder face (Zifferblatt).',
      params: { id: { type: 'string' } }, required: ['id'],
      run(a) {
        const id = String((a && a.id) || '');
        if (!pages.some((p) => p.id === id)) return 'Diesen Blick gibt es nicht.';
        setTimeout(() => goto(id), 1200);
        return id === 'face' ? 'Zifferblatt.' : 'Blick wird gezeigt.';
      },
    });
  }

  /* =====================================================================
     Gemeinsame Bausteine der Blicke
     ===================================================================== */

  /** Bogen unten („Lächeln“), konzentrisch zum Display – die Anzeige der Blicke über der Visto-Linie.
   *  f = 0 links … 1 rechts.  → { g, track, pt(f), d(f0, f1), seg(attrs), endLabel(seite, text) } */
  function smile(svg, o = {}) {
    const r = o.r || SMILE_R, half = o.half || SMILE_HALF;
    const ang = (f) => 180 + half - 2 * half * U.clamp(f, 0, 1);
    const pt = (f, rr) => V.display.pt(ang(f), rr || r);
    const d = (f0, f1) => V.ui.arcPath(500, 500, r, ang(f0), ang(Math.max(f1, f0 + 0.0005)));
    const g = U.svg('g');
    const track = U.svg('path', { d: d(0, 1), fill: 'none', stroke: o.track || 'rgba(255,255,255,.13)', 'stroke-width': o.width || 6, 'stroke-linecap': 'round' });
    g.appendChild(track);
    svg.appendChild(g);
    return {
      g, track, pt, d, r, half,
      seg(attrs) { const p = U.svg('path', Object.assign({ fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' }, attrs)); g.appendChild(p); return p; },
      endLabel(side, text) {
        const e = pt(side === 'left' ? 0 : 1);
        const t = U.svg('text', { x: (e.x + (side === 'left' ? -24 : 24)).toFixed(1), y: (e.y + 4).toFixed(1), 'text-anchor': side === 'left' ? 'end' : 'start', class: 'gl-end', text: text || '' });
        g.appendChild(t);
        return t;
      },
    };
  }
  const svgRoot = () => U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
  const row = (cls, top, text) => U.el('div', { class: 'gl-row ' + cls, style: { top: top / 10 + 'cqw' }, text: text || '' });
  const deg = (n) => Math.round(n) + '°';
  function setText(el, t) { if (el._t !== t) { el._t = t; el.textContent = t; } }
  function setHtml(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }

  /* ============================================================== Wetter */
  const WET = { drizzle: 'Regen', rain: 'Regen', heavy: 'Regen', showers: 'Schauer', storm: 'Gewitter', sleet: 'Schneeregen', snow: 'Schnee' };
  glances.register({
    id: 'weather', app: 'weather', name: 'Wetter', order: 10,
    create(root, ctx) {
      const W = V.weather;
      if (!W) return {};
      const COLOR = (ctx.app && ctx.app.color) || '#3D8BFF';
      const label = ctx.label('Wetter', U.rgba(U.lighten(COLOR, 0.25), 0.9));
      const glyph = U.el('div', { class: 'glw-glyph' });
      const temp = U.el('div', { class: 'gl-row gl-hero glw-temp', style: { top: '30.4cqw' } });
      const text = row('gl-line', 568);
      const say = row('gl-sub', 636);
      const svg = svgRoot();
      const id = U.uid('glw');
      const grad = U.svg('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 334, y1: 0, x2: 666, y2: 0 });
      const stops = [0, 0.5, 1].map((o) => { const s = U.svg('stop', { offset: o }); grad.appendChild(s); return s; });
      svg.appendChild(U.svg('defs', null, grad));
      const sm = smile(svg, { track: 'rgba(255,255,255,.1)', width: 9 });
      const range = sm.seg({ d: sm.d(0, 1), stroke: `url(#${id})`, 'stroke-width': 9 });
      const dot = U.svg('circle', { r: 10.5, fill: '#fff', stroke: '#000', 'stroke-width': 5 });
      sm.g.appendChild(dot);
      const lo = sm.endLabel('left'), hi = sm.endLabel('right');
      root.append(glyph, temp, text, say, svg);
      void range;

      function outlook(w) {
        const hrs = W.hourly(13);
        const nowWet = WET[w.code];
        if (nowWet) {
          const dry = hrs.findIndex((h, i) => i > 0 && !WET[h.code]);
          return dry > 0 ? `${nowWet} bis etwa ${hrs[dry].hour} Uhr` : `${nowWet} hält an`;
        }
        const wet = hrs.findIndex((h, i) => i > 0 && WET[h.code]);
        if (wet > 0) return `${WET[hrs[wet].code]} ab ${hrs[wet].hour} Uhr`;
        const H = V.time.now().getHours();
        if (H < 15) return 'Heute bleibt es trocken';
        const tm = W.daily(2)[1];
        return tm ? `Morgen ${tm.text.toLowerCase()}, bis ${deg(tm.hi)}` : 'Es bleibt trocken';
      }
      function update() {
        const w = W.current();
        label.set(w.place || 'Wetter');
        setHtml(glyph, W._glyph ? W._glyph(w.code, w.night) : V.icon(w.icon || 'weather'));
        setHtml(temp, `<span>${Math.round(w.temp)}</span><i>°</i>`);
        setText(text, w.text);
        setText(say, outlook(w));
        const tc = W._tempColor || (() => COLOR);
        stops[0].setAttribute('stop-color', tc(w.lo));
        stops[1].setAttribute('stop-color', tc((w.lo + w.hi) / 2));
        stops[2].setAttribute('stop-color', tc(w.hi));
        const f = w.hi - w.lo > 0.2 ? U.clamp((w.temp - w.lo) / (w.hi - w.lo), 0, 1) : 0.5;
        const p = sm.pt(f);
        dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1));
        lo.textContent = deg(w.lo); hi.textContent = deg(w.hi);
        const sky = w.night ? '#5468E8' : (W.describe(w.code, false) || {}).color || COLOR;
        ctx.aura(sky, w.night ? 0.85 : 1);
      }
      ctx.on('store:settings.location', update);
      return { update };
    },
  });

  /* ============================================================ Kalender */
  const HOUR = 3600e3, MIN = 60e3;
  function calEvents(from, to) {
    if (V.info.events) {
      const r = V.safe(() => V.info.events(new Date(from), new Date(to)), 'events');
      if (Array.isArray(r)) return r.map((e) => ({ title: e.title, start: +new Date(e.start), end: +new Date(e.end), color: e.color, place: e.place || '' }));
    }
    const s = V.store.app('calendar', { events: [] });
    return (s.events || []).filter((e) => e.end > from && e.start < to).sort((a, b) => a.start - b.start || a.end - b.end);
  }
  glances.register({
    id: 'calendar', app: 'calendar', name: 'Kalender', order: 20,
    create(root, ctx) {
      const COLOR = (ctx.app && ctx.app.color) || '#FF453A';
      ctx.aura(COLOR, 0.6);
      const label = ctx.label('Kalender', U.rgba(U.lighten(COLOR, 0.18), 0.92));
      const col = U.el('div', { class: 'glc-col' });
      const eyebrow = U.el('div', { class: 'gl-cap glc-eye' });
      const title = U.el('div', { class: 'glc-title' });
      const meta = U.el('div', { class: 'gl-sub glc-meta' });
      const list = U.el('div', { class: 'glc-list' });
      col.append(eyebrow, title, meta, list);
      const svg = svgRoot();
      const sm = smile(svg, { width: 5 });
      const segs = U.svg('g');
      sm.g.appendChild(segs);
      const nowDot = U.svg('circle', { r: 8.5, fill: '#fff', stroke: '#000', 'stroke-width': 4 });
      sm.g.appendChild(nowDot);
      const lEnd = sm.endLabel('left', 'Jetzt'), rEnd = sm.endLabel('right');
      root.append(col, svg);
      void lEnd;

      const tm = (ms) => V.fmt.time(new Date(ms));
      function lead(e, now) {
        if (e.start <= now) { const m = Math.max(1, Math.round((e.end - now) / MIN)); return 'Jetzt · noch ' + (m >= 90 ? Math.round(m / 60) + ' Std.' : m + ' Min.'); }
        const m = Math.round((e.start - now) / MIN);
        if (m < 1) return 'Jetzt gleich';
        if (m <= 90) return 'In ' + m + ' Min.';
        const day = V.fmt.relDay(new Date(e.start));
        return day === 'Heute' ? 'Heute · in ' + Math.round(m / 60) + ' Std.' : day;
      }
      function update() {
        const now = V.time.ms();
        const evs = calEvents(now, now + 3 * 864e5).filter((e) => e.end > now);
        const e = evs[0];
        label.set(V.fmt.dateShort(V.time.now()).replace(/\.$/, ''));
        if (!e) {
          eyebrow.style.color = 'rgba(255,255,255,.5)';
          setText(eyebrow, 'Frei');
          title.style.fontSize = '8.4cqw';
          setText(title, 'Nichts geplant');
          setText(meta, 'Die nächsten Tage sind frei');
          setHtml(list, '');
          segs.innerHTML = '';
          rEnd.textContent = '';
          const p0 = sm.pt(0); nowDot.setAttribute('cx', p0.x.toFixed(1)); nowDot.setAttribute('cy', p0.y.toFixed(1));
          return;
        }
        const c = e.color || COLOR;
        eyebrow.style.color = U.lighten(c, 0.12);
        setText(eyebrow, lead(e, now));
        const n = e.title.length;
        title.style.fontSize = (n <= 9 ? 10.4 : n <= 14 ? 9.2 : n <= 22 ? 7.8 : 6.6) + 'cqw';
        setText(title, e.title);
        setText(meta, tm(e.start) + ' – ' + tm(e.end) + (e.place ? ' · ' + e.place : ''));
        setHtml(list, evs.slice(1, 3).map((x) => {
          const day = V.fmt.relDay(new Date(x.start));
          return `<div class="glc-next"><i style="background:${x.color || COLOR}"></i><b>${day === 'Heute' ? '' : U.esc(day) + ' '}${tm(x.start)}</b><span>${U.esc(x.title)}</span></div>`;
        }).join(''));
        // Zeitbogen: von jetzt bis mindestens +6 Std., sonst bis kurz nach dem nächsten Termin
        const span = U.clamp(Math.ceil((e.end - now + 45 * MIN) / HOUR), 6, 18) * HOUR;
        const end = Math.ceil((now + span) / HOUR) * HOUR, len = end - now;
        segs.innerHTML = '';
        for (const x of evs) {
          if (x.start >= end) break;
          const f0 = U.clamp((x.start - now) / len, 0, 1), f1 = U.clamp((x.end - now) / len, 0, 1);
          segs.appendChild(U.svg('path', { d: sm.d(f0, Math.max(f1, f0 + 0.012)), fill: 'none', stroke: x.color || COLOR, 'stroke-width': 10, 'stroke-linecap': 'round' }));
        }
        const p0 = sm.pt(0); nowDot.setAttribute('cx', p0.x.toFixed(1)); nowDot.setAttribute('cy', p0.y.toFixed(1));
        const ed = new Date(end);
        rEnd.textContent = (V.fmt.relDay(ed) === 'Heute' ? '' : V.fmt.WD_S[ed.getDay()] + ' ') + V.fmt.time(ed);
      }
      ctx.on('calendar:changed', update);
      ctx.on('store:settings.use24h', update);
      return { update };
    },
  });

  /* =============================================================== Musik */
  glances.register({
    id: 'music', app: 'music', name: 'Musik', order: -10,
    create(root, ctx) {
      const COLOR = (ctx.app && ctx.app.color) || '#FF375F';
      const info = () => (V.info.music ? V.safe(() => V.info.music(), 'music') : null);
      const label = ctx.label('Musik', COLOR);
      const disc = U.el('div', { class: 'glm-disc' });
      const glow = U.el('div', { class: 'glm-glow' });
      const art = U.el('div', { class: 'glm-art' });
      const sheen = U.el('div', { class: 'glm-sheen' });
      const btn = U.el('button', { class: 'glm-btn vos-glass blur', attrs: { type: 'button', 'aria-label': 'Wiedergabe' } });
      disc.append(glow, art, sheen, btn);
      const title = row('gl-line glm-title', 606);
      const sub = row('gl-sub', 672);
      const svg = svgRoot();
      const sm = smile(svg, { width: 5 });
      const prog = sm.seg({ stroke: COLOR, 'stroke-width': 7 });
      const head = U.svg('circle', { r: 9, fill: '#fff' });
      sm.g.appendChild(head);
      const tL = sm.endLabel('left'), tR = sm.endLabel('right');
      root.append(disc, title, sub, svg);
      let rot = 0, acc = 1, lastKey = '', playing = false;

      V.ui.tap(btn, () => { const m = info(); if (m && m.toggle) m.toggle(); V.emit('activity'); setTimeout(update, 60); });

      function progress() {
        const m = (V.music && V.music.info && V.safe(() => V.music.info(), 'music')) || info();
        if (!m) return;
        const f = U.clamp(m.progress || 0, 0, 1);
        prog.setAttribute('d', sm.d(0, Math.max(0.004, f)));
        const p = sm.pt(f);
        head.setAttribute('cx', p.x.toFixed(1)); head.setAttribute('cy', p.y.toFixed(1));
        if (m.duration) {
          setText(tL, V.fmt.duration(m.position || 0, { ceil: false }));
          setText(tR, '−' + V.fmt.duration(Math.max(0, m.duration - (m.position || 0))));
        }
      }
      function update() {
        const m = info();
        if (!m) { setText(title, 'Musik'); setText(sub, 'Antippen zum Öffnen'); return; }
        const c = m.color || COLOR;
        playing = !!m.playing;
        const key = c + '|' + m.title + '|' + playing;
        if (key !== lastKey) {
          lastKey = key;
          label.set(m.artist || 'Musik');
          label.text.setAttribute('fill', U.lighten(c, 0.15));
          const dk = U.mix(c, '#07070a', 0.72), lt = U.lighten(c, 0.38), md = U.mix(c, '#000000', 0.25);
          art.style.background = `radial-gradient(circle at 50% 50%, rgba(0,0,0,.0) 0 33%, rgba(0,0,0,.28) 34%, rgba(0,0,0,0) 36%), conic-gradient(from 0deg, ${md}, ${dk} 18%, ${c} 38%, ${lt} 50%, ${md} 64%, ${dk} 82%, ${md})`;
          glow.style.background = `radial-gradient(circle, ${U.rgba(c, playing ? 0.5 : 0.22)}, ${U.rgba(c, 0)} 68%)`;
          prog.setAttribute('stroke', U.lighten(c, 0.1));
          setText(title, m.title || 'Musik');
          setHtml(btn, V.icon(playing ? 'pause' : 'play'));
          btn.setAttribute('aria-label', playing ? 'Pause' : 'Abspielen');
          disc.classList.toggle('on', playing);
          ctx.aura(c, playing ? 1 : 0.55);
        }
        setText(sub, playing ? 'Läuft gerade' : m.started ? 'Pausiert' : 'Bereit zum Abspielen');
        progress();
      }
      ctx.on('music:changed', update);
      ctx.onFrame((dt) => {
        if (!playing) return;
        rot = (rot + dt * 14) % 360;
        art.style.transform = `rotate(${rot.toFixed(2)}deg)`;
        acc += dt;
        if (acc > 0.5) { acc = 0; progress(); }
      });
      return { update };
    },
  });

  /* ============================================================= Zuhause */
  const ROOM_SHORT = { wohnzimmer: 'W', kueche: 'K', schlafzimmer: 'S', arbeitszimmer: 'A', flur: 'F' };
  glances.register({
    id: 'home', app: 'home', name: 'Zuhause', order: -20,
    create(root, ctx) {
      const COLOR = (ctx.app && ctx.app.color) || '#FFB52E';
      const info = () => (V.info.home ? V.safe(() => V.info.home(), 'home') : null);
      ctx.label('Zuhause', U.rgba(COLOR, 0.92));
      const eye = row('gl-cap glh-eye', 196, 'Innen');
      const temp = U.el('div', { class: 'gl-row gl-hero glh-temp', style: { top: '23.2cqw' } });
      const thermo = row('gl-sub glh-thermo', 500);
      const lights = row('gl-line', 568);
      const orbs = U.el('div', { class: 'glh-orbs' });
      root.append(eye, temp, thermo, lights, orbs);
      const btns = new Map();
      let flashT = 0, flash = '';

      function orbFor(r, i, n) {
        let b = btns.get(r.id);
        if (b) return b;
        const th = ((n - 1) / 2 - i) * 22;                       // Grad neben der Mitte unten
        const x = 500 - 292 * Math.sin(U.rad(th)), y = 500 + 292 * Math.cos(U.rad(th));
        b = U.el('button', { class: 'glh-orb vos-glass', attrs: { type: 'button' }, style: { left: x / 10 + 'cqw', top: y / 10 + 'cqw' }, text: ROOM_SHORT[r.id] || r.name.charAt(0) });
        V.ui.tap(b, () => {
          const h = info();
          const cr = h && h.rooms.find((q) => q.id === r.id);
          const on = !(cr && cr.on);
          V.emit('activity');
          Promise.resolve(V.actions.run('home.light', { room: r.id, on })).catch(() => {}).then(() => {
            flash = r.name + (on ? ' an' : ' aus');
            clearTimeout(flashT);
            flashT = setTimeout(() => { flash = ''; update(); }, 1700);
            update();
          });
        });
        btns.set(r.id, b);
        orbs.appendChild(b);
        return b;
      }
      function update() {
        const h = info();
        if (!h) { setHtml(temp, '<span>–</span>'); setText(lights, 'Zuhause'); return; }
        const cur = Number(h.current) || 0, whole = Math.floor(cur + 1e-6), dec = Math.round((cur - whole) * 10);
        setHtml(temp, `<span>${whole}</span><small>,${dec}</small><i>°</i>`);
        const tg = String(h.target).replace('.', ',') + '°';
        const mode = h.mode;
        setText(thermo, mode === 'off' ? 'Heizung aus' : mode === 'heat' ? 'Heizt auf ' + tg : mode === 'cool' ? 'Kühlt ab auf ' + tg : 'Hält ' + tg);
        thermo.style.color = mode === 'heat' ? '#FF9A4D' : mode === 'cool' ? '#6CB6FF' : '';
        const on = h.rooms.filter((r) => r.on);
        setText(lights, flash || (on.length === 0 ? 'Alle Lichter aus' : on.length === 1 ? 'Licht an: ' + on[0].name : on.length + ' Lichter an'));
        h.rooms.forEach((r, i) => {
          const b = orbFor(r, i, h.rooms.length);
          const key = (r.on ? r.color : '0') + '|' + Math.round((r.brightness || 0) * 20);
          if (b._k === key) return;
          b._k = key;
          b.classList.toggle('on', !!r.on);
          b.setAttribute('aria-label', r.name + (r.on ? ' – Licht an' : ' – Licht aus'));
          if (r.on) {
            const c = r.color || '#FFC47E', k = 0.45 + 0.55 * U.clamp(r.brightness || 1, 0, 1);
            b.style.background = `radial-gradient(circle at 50% 30%, ${U.lighten(c, 0.5)}, ${c} 70%)`;
            b.style.boxShadow = `0 0 ${(5 * k).toFixed(1)}cqw ${U.rgba(c, 0.6 * k)}, inset 0 .2cqw 0 rgba(255,255,255,.6)`;
            b.style.color = U.luma(c) > 0.45 ? 'rgba(30,18,4,.82)' : '#fff';
          } else { b.style.background = ''; b.style.boxShadow = ''; b.style.color = ''; }
        });
        const mixc = on.length ? on[0].color || COLOR : null;
        ctx.aura(mixc || COLOR, on.length ? 0.55 + 0.12 * on.length : 0.3);
      }
      ctx.on('home:changed', update);
      return { update, destroy() { clearTimeout(flashT); } };
    },
  });

  /* ---------------------------------------------------------------- Stile */
  function styles() {
    V.css('glances', `
    .gl-page { contain: layout style; cursor: pointer; }
    .gl-body { position: absolute; inset: 0; }
    .gl-edge { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; opacity: 0; z-index: 3;
      box-shadow: inset 0 0 0 .14cqw rgba(255,255,255,.2), inset 0 .6cqw 2cqw rgba(255,255,255,.08), inset 0 -1.2cqw 3cqw rgba(0,0,0,.5); }
    .gl-dots { z-index: 4; opacity: 0; }
    .gl-dots path { filter: drop-shadow(0 0 5px rgba(255,255,255,.55)); }
    .gl-aura { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; transition: opacity .6s ease; }
    .gl-row { position: absolute; left: 0; right: 0; text-align: center; white-space: nowrap; line-height: 1.2; }
    .gl-hero { font-size: 25.5cqw; font-weight: 200; letter-spacing: -.055em; line-height: 1; font-variant-numeric: tabular-nums; color: #fff; }
    .gl-hero span { display: inline-block; }
    .gl-hero i { font-style: normal; font-weight: 200; display: inline-block; width: 0; letter-spacing: 0; }
    .gl-hero small { font-size: .42em; font-weight: 300; letter-spacing: -.02em; }
    .gl-line { font-size: 5.3cqw; font-weight: 620; letter-spacing: -.016em; color: #fff; }
    .gl-sub { font-size: 3.75cqw; font-weight: 520; color: rgba(255,255,255,.58); letter-spacing: -.004em; }
    .gl-cap { font-size: 2.75cqw; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; color: rgba(255,255,255,.5); }
    .gl-end { font: 600 25px 'Inter Tight', system-ui, sans-serif; fill: rgba(255,255,255,.52); font-variant-numeric: tabular-nums; letter-spacing: .2px; }

    .glw-glyph { position: absolute; left: 50%; top: 15.2cqw; width: 15cqw; height: 15cqw; margin-left: -7.5cqw; filter: drop-shadow(0 1cqw 2.4cqw rgba(0,0,0,.45)); }
    .glw-glyph svg { width: 100%; height: 100%; display: block; }

    .glc-col { position: absolute; left: 0; right: 0; top: 19cqw; height: 55cqw; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .glc-eye { margin-bottom: 2.2cqw; }
    .glc-title { max-width: 66cqw; font-weight: 640; letter-spacing: -.028em; line-height: 1.04; color: #fff; text-wrap: balance;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; padding-bottom: .12em; }
    .glc-meta { margin-top: 1.9cqw; max-width: 62cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .glc-list { margin-top: 4.2cqw; display: flex; flex-direction: column; gap: 1.5cqw; align-items: center; }
    .glc-next { display: flex; align-items: center; gap: 1.7cqw; font-size: 3.5cqw; color: rgba(255,255,255,.5); font-weight: 520; max-width: 58cqw; white-space: nowrap; }
    .glc-next i { width: 1.25cqw; height: 1.25cqw; border-radius: 50%; flex: none; }
    .glc-next b { font-weight: 620; color: rgba(255,255,255,.72); font-variant-numeric: tabular-nums; }
    .glc-next span { overflow: hidden; text-overflow: ellipsis; }

    .glm-disc { position: absolute; left: 50%; top: 39.6cqw; width: 35cqw; height: 35cqw; margin: -17.5cqw 0 0 -17.5cqw; border-radius: 50%; }
    .glm-glow { position: absolute; inset: -9cqw; border-radius: 50%; pointer-events: none; transition: opacity .8s ease; opacity: .7; }
    .glm-disc.on .glm-glow { opacity: 1; }
    .glm-art { position: absolute; inset: 0; border-radius: 50%; will-change: transform;
      box-shadow: 0 2cqw 5cqw rgba(0,0,0,.55); }
    .glm-sheen { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
      background:
        repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 .55cqw, rgba(0,0,0,.13) .55cqw .7cqw),
        conic-gradient(from 210deg, rgba(255,255,255,0) 0 12%, rgba(255,255,255,.2) 20%, rgba(255,255,255,0) 30% 62%, rgba(255,255,255,.12) 70%, rgba(255,255,255,0) 80%);
      box-shadow: inset 0 0 0 .14cqw rgba(255,255,255,.2), inset 0 0 5cqw rgba(0,0,0,.35); }
    .glm-btn { position: absolute; left: 50%; top: 50%; width: 13.4cqw; height: 13.4cqw; margin: -6.7cqw 0 0 -6.7cqw; border: 0; border-radius: 50%; padding: 0;
      display: grid; place-items: center; color: #fff; cursor: pointer; transition: transform .28s var(--spring); }
    .glm-btn.vos-glass { background: linear-gradient(rgba(34,34,40,.5), rgba(8,8,10,.6)); }
    .glm-btn:active { transform: scale(.9); }
    .glm-btn svg { width: 5.6cqw; height: 5.6cqw; }
    .glm-title { max-width: 62cqw; left: 19cqw; right: 19cqw; overflow: hidden; text-overflow: ellipsis; }

    .glh-eye { color: rgba(255,255,255,.46); }
    .glh-temp i { width: .12em; }
    .glh-orbs { position: absolute; inset: 0; pointer-events: none; }
    .glh-orb { position: absolute; width: 9cqw; height: 9cqw; margin: -4.5cqw 0 0 -4.5cqw; border: 0; padding: 0; border-radius: 50%; pointer-events: auto; cursor: pointer;
      font: 650 3.3cqw/1 var(--font); color: rgba(255,255,255,.55); display: grid; place-items: center;
      transition: transform .28s var(--spring), background .35s ease, box-shadow .45s ease, color .3s ease; }
    .glh-orb:active { transform: scale(.88); }
    `);
  }
})();
