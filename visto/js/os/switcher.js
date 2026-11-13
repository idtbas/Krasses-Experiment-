/* VistoOS · os/switcher.js — Karussell der zuletzt benutzten Apps (Doppeldruck auf die Sockeltaste)
 *
 *  Die Apps liegen als Glasscheiben gleichmäßig auf einem Ring, auf den man leicht von oben schaut: vorn groß
 *  und klar, nach hinten kleiner, dunkler, weich. Der Ring folgt dem Finger – am Rand entlangfahren dreht ihn
 *  1 : 1, waagerecht wischen ebenso –, läuft mit Schwung aus (auch über mehrere Scheiben) und rastet auf einer
 *  Scheibe ein. Antippen öffnet die App (sie wächst aus ihrer Scheibe), eine Scheibe nach oben schnippen nimmt
 *  sie aus der Liste, der Ring schließt die Lücke. Unter dem Namen steht, was die App gerade tut (Live-Rand: Restzeit, Titel …),
 *  laufende Dinge zeigen ihren Fortschritt als Ring um die Scheibe. Was dahinter liegt, tritt zurück:
 *  kleiner, unscharf, dunkel. Die Visto-Linie bleibt frei und erreichbar.
 *
 *  V.switcher.open() · close() · toggle() · isOpen · recents() → [App-IDs, jüngste zuerst] · forget(id)
 *  Merkt sich die zuletzt geöffneten Apps über 'app:open' (V.store 'system.recents', höchstens 8).
 *  Ereignisse: 'switcher:open', 'switcher:close'
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const MAX = 8;
  const RX = 318;                                 // Ringradius (waagerecht, logisch)
  const Y_FRONT = 474, Y_BACK = 214;              // Höhe vorn / hinten
  const DISC = 356;                               // Durchmesser der vorderen Scheibe (logisch)
  const S_BACK = 0.3;                             // Maßstab ganz hinten
  const IDLE_MS = 30000;

  let root = null, ringEl = null, nameEl = null, liveEl = null, emptyEl = null, titleArc = null;
  let items = [];                                 // {id, def, el, arc, ang: Feder (Platz auf dem Ring in Grad), lift: Feder, sx, sy, sr, t}
  let slot = 360;                                 // Winkel zwischen zwei Scheiben (360° / Anzahl)
  let opened = false, building = false, drag = null, focus = -2, dirty = false, loopOff = null;
  let ret = null;                                 // wohin beim Schließen ohne Auswahl: {app} | {home: true} | null
  let lastClose = 0, lastAct = 0, liveT = 0;
  let lastClosedApp = null, lastClosedAt = 0, modeBefore = 'home', modeAt = 0, curMode = 'boot';

  const rot = V.spring(0, V.motion.smooth);       // Drehung des Rings in Grad (läuft frei durch, vorn = 0° relativ)
  const prog = V.spring(0, V.motion.smooth);      // 0…1 Einblendung
  rot.onUpdate(() => { dirty = true; });
  prog.onUpdate(() => { dirty = true; });

  const lineZone = (x, y) => y > 868 && Math.abs(x - 500) < 175;
  const lowPerf = () => !!(V.perf && V.perf.level < 2);
  const wrap180 = (a) => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
  /** dem Wert v nächstgelegener Winkel, der zu a gleichwertig ist (a + k·360°) */
  const near = (a, v) => a + 360 * Math.round((v - a) / 360);
  /** Index der Scheibe, die vorn steht bzw. der Raste am nächsten ist */
  function frontIndex(r) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < items.length; i++) { const d = Math.abs(wrap180(items[i].ang.target - r)); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  /* --------------------------------------------------------------- Liste */
  function recents() {
    const l = V.store.get('system.recents', []);
    return (Array.isArray(l) ? l : []).filter((id) => typeof id === 'string' && V.apps.get(id));
  }
  function remember(id) {
    if (!V.apps.get(id)) return;
    const l = recents().filter((x) => x !== id);
    l.unshift(id);
    V.store.set('system.recents', l.slice(0, MAX));
  }
  function forget(id) { V.store.set('system.recents', recents().filter((x) => x !== id)); }

  V.on('app:open', remember);
  V.on('app:close', (id) => { lastClosedApp = id; lastClosedAt = performance.now(); });
  V.on('shell:mode', (m) => { if (m !== curMode) { modeBefore = curMode; curMode = m; modeAt = performance.now(); } });

  /* -------------------------------------------------------- Live-Zustand */
  /** Was die App gerade tut → { text, value 0…1 | null, color, live } */
  function statusOf(id, def) {
    const live = V.live && V.live.list ? V.safe(() => V.live.list().find((e) => e.app === id), 'live') : null;
    if (live) {
      const parts = [live.label, live.sub].filter((s) => s && String(s).toLowerCase() !== def.name.toLowerCase());
      return { text: parts.join(' · ') || 'Läuft', value: typeof live.value === 'number' && isFinite(live.value) ? U.clamp(live.value, 0, 1) : null, color: live.color || def.color, live: true };
    }
    const I = V.info || {};
    const get = (k) => (I[k] ? V.safe(() => I[k](), k) : null);
    let text = '', value = null;
    if (id === 'timer') { const t = get('timer'); if (t) { text = (t.paused ? 'Pausiert · ' : '') + V.fmt.duration(t.left); value = t.total ? t.left / t.total : null; } }
    else if (id === 'stopwatch') { const s = get('stopwatch'); if (s) text = (s.running ? '' : 'Angehalten · ') + s.text; }
    else if (id === 'focus') { const f = get('focus'); if (f) { text = (f.paused ? 'Pausiert · ' : '') + V.fmt.duration(f.left); value = f.total ? 1 - f.left / f.total : null; } }
    else if (id === 'music') { const m = get('music'); if (m && m.started) text = (m.playing ? '' : 'Pausiert · ') + m.title; }
    else if (id === 'weather') { const w = get('weather'); if (w) text = Math.round(w.temp) + '° · ' + w.text; }
    else if (id === 'calendar') { const e = get('nextEvent'); if (e) { const d = V.fmt.relDay(e.start); text = (d === 'Heute' ? '' : d + ' ') + V.fmt.time(e.start) + ' · ' + e.title; } }
    else if (id === 'alarm') { const a = get('alarm'); if (a && a.date) text = 'Nächster ' + V.fmt.time(new Date(a.date)); }
    else if (id === 'home') { const h = get('home'); if (h) text = (h.lightsOn ? h.lightsOn + (h.lightsOn === 1 ? ' Licht an' : ' Lichter an') : 'Lichter aus') + ' · ' + String(h.current).replace('.', ',') + '°'; }
    if (text) return { text, value: value === null ? null : U.clamp(value, 0, 1), color: def.color, live: value !== null };
    return { text: '', value: null, color: def.color, live: false };
  }

  /* ----------------------------------------------------------------- Bau */
  function build() {
    if (root) return;
    styles();
    root = U.el('div', { class: 'sw-root off', attrs: { 'data-nogesture': 'all', role: 'dialog', 'aria-label': 'Zuletzt benutzte Apps', 'aria-hidden': 'true' } });
    ringEl = U.el('div', { class: 'sw-ring' });
    titleArc = V.ui.arcText({ text: 'Zuletzt benutzt', r: 446, size: 25, weight: 700, spacing: 5, color: 'rgba(255,255,255,.42)' });
    titleArc.el.classList.add('sw-title');
    nameEl = U.el('div', { class: 'sw-name' });
    liveEl = U.el('div', { class: 'sw-live' });
    emptyEl = U.el('div', { class: 'sw-empty', html: `<div class="sw-empty-ic">${V.icon('clock')}</div><b>Noch nichts geöffnet</b><span>Apps, die du benutzt, liegen hier bereit.</span>` });
    root.append(titleArc.el, ringEl, nameEl, liveEl, emptyEl);
    V.display.overlay.appendChild(root);

    // Die Shell soll hier nichts deuten (Zurück, Krone, Kontrollzentrum) – außer in der Visto-Zone.
    root.addEventListener('pointerdown', (e) => {
      const L = V.display.toLogical(e.clientX, e.clientY);
      V.emit('activity');
      if (lineZone(L.x, L.y)) return;
      e.stopPropagation();
    });
    root.addEventListener('click', (e) => { e.stopPropagation(); });

    V.gesture(root, {
      start(p) {
        drag = null;
        if (!opened || lineZone(p.x0, p.y0)) return;
        lastAct = performance.now();
        rot.stop();
        drag = { mode: null, rot0: rot.value, dx0: 0, dy0: 0, dA0: 0, rim: p.r0 > 385, hit: hit(p), sv: rot.value, st: performance.now(), vel: 0 };
        dirty = true;
      },
      move(p) {
        const d = drag;
        if (!d || !p.moved) return;
        if (!d.mode) {
          const ax = Math.abs(p.dx), ay = Math.abs(p.dy);
          const tang = Math.abs(p.dA) * (Math.PI / 180) * p.r0, radial = Math.abs(p.r - p.r0);
          if (d.rim && tang > radial * 1.2) d.mode = 'rim';
          else if (d.hit && d.hit.t > 0.55 && p.dy < 0 && ay > ax * 1.25) d.mode = 'lift';
          else if (ax > ay * 0.7 && items.length > 1) d.mode = 'pan';
          else d.mode = 'none';
          d.dx0 = p.dx; d.dy0 = p.dy; d.dA0 = p.dA;
          if (d.mode === 'lift') d.hit.lift.stop();
        }
        if (d.mode === 'rim') setRot(d.rot0 + (p.dA - d.dA0));                       // Fingerwinkel = Ringwinkel
        else if (d.mode === 'pan') setRot(d.rot0 - U.deg((p.dx - d.dx0) / RX));       // vordere Scheibe bleibt unter dem Finger
        else if (d.mode === 'lift') {
          const dy = p.dy - d.dy0;
          d.hit.lift.set(dy < 0 ? dy : dy * 0.25);
          dirty = true;
        }
      },
      end(p) {
        const d = drag; drag = null;
        if (!d || !d.mode) return;
        if (d.mode === 'rim' || d.mode === 'pan') {
          // Schwung trägt weiter (auch über mehrere Scheiben), dann rastet der Ring ein
          const vel = p.cancelled || performance.now() - d.st > 120 ? 0 : U.clamp(d.vel, -900, 900);
          snap(rot.value + vel * 0.24, vel);
        } else if (d.mode === 'lift') {
          const dy = p.dy - d.dy0;
          if (!p.cancelled && (dy < -150 || (p.vy < -700 && dy < -40))) remove(d.hit, p.vy);
          else d.hit.lift.to(0, V.motion.bouncy);
        }
      },
      tap(p) {
        if (!opened || lineZone(p.x, p.y)) return;
        const it = hit(p);
        if (it) { V.sound.play('tap'); V.haptic(6); choose(it); }
        else close();
      },
    }, { slop: 9, owner: 'switcher', longMs: 9999 });
  }

  /** auf der Scheibe einrasten, die dem Winkel v am nächsten liegt */
  function snap(v, vel) {
    if (!items.length) return;
    let best = 0, bd = 1e9;
    for (let i = 0; i < items.length; i++) { const d = Math.abs(wrap180(items[i].ang.target - v)); if (d < bd) { bd = d; best = i; } }
    const t = near(items[best].ang.target, v);
    rot.to(t, Object.assign({}, V.motion.bouncy, { velocity: vel || 0 }));
  }
  function setRot(v) {
    if (items.length < 2) v = drag ? drag.rot0 + (v - drag.rot0) * 0.18 : v;      // eine einzelne Scheibe gibt nur wenig nach
    const d = drag, now = performance.now();
    if (d) {
      const dt = (now - d.st) / 1000;
      if (dt > 0.012) { d.vel = d.vel * 0.35 + ((v - d.sv) / dt) * 0.65; d.sv = v; d.st = now; }
    }
    rot.set(v);
  }

  function makeItem(id, i) {
    const def = V.apps.get(id);
    const el = U.el('div', { class: 'sw-disc', style: { '--c': def.color } });
    const glow = U.el('div', { class: 'sw-glow' });
    const icon = V.ui.icon(def, '46%');
    icon.classList.add('sw-icon');
    const svg = U.svg('svg', { class: 'sw-arc', viewBox: '0 0 100 100', 'aria-hidden': 'true' });
    const track = U.svg('circle', { cx: 50, cy: 50, r: 46.4, fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 1.7 });
    const arc = U.svg('circle', { cx: 50, cy: 50, r: 46.4, fill: 'none', stroke: def.color, 'stroke-width': 2.3, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': '0 100', transform: 'rotate(-90 50 50)' });
    svg.append(track, arc);
    svg.style.opacity = '0';
    el.append(glow, icon, svg);
    ringEl.appendChild(el);
    const it = { id, def, el, svg, arc, ang: V.spring(i * slot, V.motion.smooth), lift: V.spring(0, V.motion.bouncy), sx: 500, sy: 500, sr: 0, t: 0, status: null, gone: false };
    it.ang.onUpdate(() => { dirty = true; });
    it.lift.onUpdate(() => { dirty = true; });
    return it;
  }

  function fill() {
    for (const it of items) { it.ang.stop(); it.lift.stop(); it.el.remove(); }
    const list = recents();
    slot = 360 / Math.max(1, list.length);
    items = list.map(makeItem);
    emptyEl.style.display = items.length ? 'none' : '';
    nameEl.style.display = liveEl.style.display = items.length ? '' : 'none';
    focus = -2;
    refreshStatus();
  }

  function refreshStatus() {
    for (const it of items) {
      const s = (it.status = statusOf(it.id, it.def));
      const on = s.value !== null;
      it.svg.style.opacity = on ? '1' : '0';
      if (on) { it.arc.setAttribute('stroke', s.color); it.arc.setAttribute('stroke-dasharray', (s.value * 100).toFixed(2) + ' 100'); }
    }
    showFocus(true);
  }
  function showFocus(force) {
    const i = frontIndex(rot.value);
    if (i === focus && !force) return;
    const changed = i !== focus;
    focus = i;
    const it = items[i];
    if (!it) { nameEl.textContent = ''; liveEl.textContent = ''; return; }
    if (nameEl.textContent !== it.def.name) nameEl.textContent = it.def.name;
    const s = it.status || { text: '', live: false, color: it.def.color };
    if (liveEl.textContent !== s.text) liveEl.textContent = s.text;
    liveEl.style.color = s.live ? U.lighten(s.color, 0.2) : '';
    if (changed && opened && (drag || rot.moving) && prog.value > 0.6) { V.sound.play('tick'); V.haptic(3); }
  }

  /* ------------------------------------------------------------- Layout */
  function layout() {
    const k = prog.value, kc = U.clamp(k, 0, 1);
    const r = rot.value, low = lowPerf();
    const sweep = (1 - kc) * 64;                    // beim Öffnen dreht der Ring herein
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const phi = it.ang.value - r - sweep;
      const a = U.rad(phi);
      const t = (1 + Math.cos(a)) / 2;              // 1 vorn … 0 hinten
      const far = 1;
      const lift = it.lift.value, la = Math.abs(lift);
      const x = 500 + RX * Math.sin(a);
      const y = Y_BACK + (Y_FRONT - Y_BACK) * (t * t * (3 - 2 * t)) + lift;
      const s = (S_BACK + (1 - S_BACK) * t * t) * (0.72 + 0.28 * k) * (1 - Math.min(0.22, la / 1600));
      const op = kc * far * (0.42 + 0.58 * t) * (1 - U.smoothstep(240, 620, la));
      const st = it.el.style;
      st.transform = `translate(${(x / 10).toFixed(2)}cqw, ${(y / 10).toFixed(2)}cqw) scale(${Math.max(0.01, s).toFixed(4)})`;
      st.opacity = op.toFixed(3);
      st.zIndex = String(Math.round(t * 100) + (la > 4 ? 200 : 0));
      // Unschärfe und Helligkeit in Stufen (zwischen zwei Stufen bleibt das Bild der Scheibe im Grafikspeicher)
      const bl = low ? 0 : Math.round((1 - t) * 1.2 * 5) / 5;
      const br = Math.round((0.4 + 0.6 * Math.pow(t, 0.8)) * 25) / 25;
      const f = t > 0.975 ? '' : (bl > 0 ? `blur(${bl.toFixed(1)}cqw) ` : '') + `brightness(${br.toFixed(2)})`;
      if (st.filter !== f) st.filter = f;
      it.sx = x; it.sy = y; it.sr = (DISC / 2) * s; it.t = t * far;
    }
    showFocus(false);
    // Name und Zustand gehören zur vorderen Scheibe: zwischen zwei Rasten treten sie zurück
    const front = items[focus];
    const off = front && items.length > 1 ? Math.abs(wrap180(front.ang.value - r)) / slot : 0;
    const ta = kc * (1 - Math.min(1, off * 2.4)) * (front ? 1 - U.smoothstep(40, 260, Math.abs(front.lift.value)) : 1);
    nameEl.style.opacity = liveEl.style.opacity = ta.toFixed(3);
    nameEl.style.transform = liveEl.style.transform = `translateY(${((1 - kc) * 3).toFixed(2)}cqw)`;
    titleArc.el.style.opacity = (kc * 0.9).toFixed(3);
    emptyEl.style.opacity = kc.toFixed(3);
    emptyEl.style.transform = `scale(${(0.9 + 0.1 * k).toFixed(4)})`;
    // Tiefe: was dahinter liegt, tritt zurück
    const stage = V.display.stage.style;
    if (kc < 0.002) { stage.scale = ''; stage.filter = ''; root.style.background = ''; }
    else {
      stage.scale = (1 - 0.1 * kc).toFixed(4);
      stage.filter = (low ? '' : `blur(${(2.2 * kc).toFixed(2)}cqw) `) + `brightness(${(1 - 0.72 * kc).toFixed(3)}) saturate(${(1 + 0.2 * kc).toFixed(2)})`;
      root.style.background = `rgba(0,0,0,${(0.34 * kc).toFixed(3)})`;
    }
  }

  function frame() {
    if (!dirty) return;
    dirty = false;
    layout();
  }

  function hit(p) {
    let best = null;
    for (const it of items) {
      if (it.gone || it.t < 0.08) continue;
      if (Math.hypot(p.x - it.sx, p.y - it.sy) > it.sr + 6) continue;
      if (!best || it.t > best.t) best = it;
    }
    return best;
  }

  /* ------------------------------------------------------- Aktionen */
  function choose(it) {
    const origin = { x: it.sx, y: it.sy, r: it.sr };
    ret = null;
    const open = V.shell.app && V.shell.app.def.id === it.id;
    close({ quick: true });
    if (!open) V.shell.open(it.id, {}, origin);
  }

  function remove(it, vy) {
    it.gone = true;
    V.sound.play('close'); V.haptic(10);
    forget(it.id);
    if (V.shell.app && V.shell.app.def.id === it.id) V.shell.closeApp({ to: 'home' });
    if (ret && ret.app === it.id) ret = null;
    const idx = items.indexOf(it);
    it.lift.to(-760, Object.assign({}, V.motion.smooth, { velocity: Math.min(vy || 0, -600) })).then(() => { it.el.remove(); });
    const wasFront = idx === frontIndex(rot.value);
    const keep = wasFront ? items[(idx + 1) % items.length] : items[frontIndex(rot.value)];
    items.splice(idx, 1);
    // der Ring schließt die Lücke: neue, gleichmäßige Abstände
    slot = 360 / Math.max(1, items.length);
    items.forEach((x, i) => x.ang.to(near(i * slot, x.ang.value), V.motion.bouncy));
    // die fliegende Scheibe bleibt bis zum Ende im Layout
    const ghost = it;
    const off = V.loop.add(() => {
      const la = Math.abs(ghost.lift.value);
      ghost.el.style.transform = `translate(${(ghost.sx / 10).toFixed(2)}cqw, ${((ghost.sy0 + ghost.lift.value) / 10).toFixed(2)}cqw) scale(${(ghost.ss0 * (1 - Math.min(0.22, la / 1600))).toFixed(4)})`;
      ghost.el.style.opacity = (1 - U.smoothstep(240, 620, la)).toFixed(3);
      if (!ghost.lift.moving) off();
    }, 7);
    ghost.sy0 = ghost.sy - ghost.lift.value; ghost.ss0 = ghost.sr / (DISC / 2) / (1 - Math.min(0.22, Math.abs(ghost.lift.value) / 1600));
    if (keep && keep !== it) rot.to(near(keep.ang.target, rot.value), V.motion.bouncy);
    focus = -2;
    if (!items.length) { emptyEl.style.display = ''; nameEl.style.display = liveEl.style.display = 'none'; setTimeout(() => { if (opened && !items.length) close(); }, 900); }
    dirty = true;
  }

  function open() {
    if (opened) return;
    const m = V.shell.mode;
    if (m === 'boot' || m === 'setup' || (V.notify && V.notify.alertOpen)) return;
    if (performance.now() - lastClose < 450) return;       // Doppeldruck, der gerade erst geschlossen hat
    if (V.faceEditor && V.faceEditor.isOpen) V.faceEditor.close();
    if (V.control && V.control.isOpen) V.control.close();
    if (V.ui.pie && V.ui.pie.close) V.safe(() => V.ui.pie.close(), 'pie');
    build();
    // Wohin, wenn nichts gewählt wird: der erste Tastendruck hat schon „Home“ bzw. den Orbit ausgelöst
    const now = performance.now();
    ret = null;
    const list = recents();
    const closing = (m === 'app' && !V.shell.app) || (lastClosedApp && now - lastClosedAt < 700);
    const cameFromApp = closing && list.length ? (m === 'app' && !V.shell.app ? list[0] : lastClosedApp) : null;
    if (cameFromApp) ret = { app: cameFromApp };
    else if (m === 'launcher' && modeBefore === 'home' && now - modeAt < 700) ret = { home: true };
    fill();
    opened = true;
    lastAct = now;
    root.classList.remove('off');
    root.setAttribute('aria-hidden', 'false');
    // kam man aus einer App, steht die vorherige vorn (schneller Wechsel), die eigene liegt links daneben
    const start = (cameFromApp || (V.shell.app && list[0] === V.shell.app.def.id)) && items.length > 1 ? 1 : 0;
    rot.set(start * slot);
    focus = -2;
    prog.to(1, V.motion.bouncy);
    if (!loopOff) loopOff = V.loop.add(frame, 7);
    clearInterval(liveT);
    liveT = setInterval(() => {
      if (!opened) return;
      if (!drag && performance.now() - lastAct > IDLE_MS) { close(); return; }
      refreshStatus();
    }, 500);
    dirty = true;
    V.sound.play('open'); V.haptic(8);
    V.emit('activity');
    V.emit('switcher:open');
  }

  function close(o = {}) {
    if (!opened) return;
    opened = false;
    drag = null;
    lastClose = performance.now();
    clearInterval(liveT);
    root.setAttribute('aria-hidden', 'true');
    root.style.pointerEvents = 'none';
    if (!o.quick) V.sound.play('close');
    const r = ret; ret = null;
    if (!o.quick && !o.stay && r) {
      if (r.app && V.apps.get(r.app)) {
        const it = items.find((x) => x.id === r.app);
        V.shell.open(r.app, {}, it ? { x: it.sx, y: it.sy, r: it.sr } : undefined);
      } else if (r.home && V.shell.mode === 'launcher') V.shell.home();
    }
    prog.to(0, Object.assign({}, V.motion.smooth, o.quick ? { response: 0.3 } : null)).then(() => {
      if (opened) return;
      root.classList.add('off');
      root.style.pointerEvents = '';
      layout();
      if (loopOff) { loopOff(); loopOff = null; }
      for (const it of items) { it.ang.stop(); it.lift.stop(); it.el.remove(); }
      items = [];
    });
    V.emit('switcher:close');
  }

  const switcher = (V.switcher = {
    open, close,
    toggle() { if (opened) close(); else open(); },
    get isOpen() { return opened; },
    recents, forget,
  });

  /* -------------------------------------------------- Systemanbindung */
  V.shell.hooks.baseDouble = () => switcher.toggle();
  V.on('boot:ready', () => {
    const hooks = V.shell.hooks;
    if (Array.isArray(hooks.basePress)) hooks.basePress.unshift(() => { if (!opened) return false; close(); return true; });
    intents();
  });
  V.on('convo:open', () => { if (opened) close({ stay: true }); });
  V.on('alert', () => { if (opened) close({ stay: true }); });
  V.on('ambient', (on) => { if (on && opened) close({ stay: true }); });
  V.on('control:open', () => { if (opened) close({ stay: true }); });
  V.on('live:changed', () => { if (opened) refreshStatus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opened) close(); });

  function intents() {
    if (!V.brain || !V.brain.intent) return;
    const say = () => {
      const n = recents().length;
      setTimeout(() => { if (V.convo && V.convo.active) { V.convo.close(); setTimeout(open, 440); } else open(); }, 1300);
      return { say: n ? 'Hier sind deine zuletzt benutzten Apps.' : 'Du hast noch keine App geöffnet.', emotion: 'happy' };
    };
    V.brain.intent({
      id: 'switcher', priority: 11,
      match: [
        /(?<![a-zäöüß])(offene[nr]?|geöffnete[nr]?|laufende[nr]?|letzte[nr]?|zuletzt (benutzte[nr]?|geöffnete[nr]?|verwendete[nr]?)) (apps|programme|anwendungen)(?![a-zäöüß])/,
        /(?<![a-zäöüß])(app-?wechsler|app-?umschalter|karussell|multitasking|app-?übersicht)(?![a-zäöüß])/,
        /(?<![a-zäöüß])(welche|was für) apps (sind|waren|habe ich) (offen|geöffnet|zuletzt)/,
        /(?<![a-zäöüß])(wechsle?|wechseln) (die |zwischen (den )?)?apps?(?![a-zäöüß])/,
      ],
      run: say,
    });
    V.actions.register('system.app_switcher', {
      desc: 'Öffnet das Karussell der zuletzt benutzten Apps (App-Wechsler), z. B. bei „Zeig die offenen Apps“.',
      params: {},
      run() { setTimeout(open, 1200); return 'Karussell geöffnet.'; },
    });
  }

  /* ---------------------------------------------------------------- Stile */
  function styles() {
    V.css('switcher', `
    .sw-root { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; touch-action: none; cursor: default; }
    .sw-root.off { visibility: hidden; pointer-events: none; }
    .sw-ring { position: absolute; inset: 0; }
    .sw-title { opacity: 0; }
    .sw-disc { position: absolute; left: 0; top: 0; width: ${DISC / 10}cqw; height: ${DISC / 10}cqw; margin: ${-DISC / 20}cqw 0 0 ${-DISC / 20}cqw; border-radius: 50%;
      display: grid; place-items: center; will-change: transform, opacity; cursor: pointer;
      background:
        radial-gradient(120% 80% at 50% -8%, rgba(255,255,255,.2), rgba(255,255,255,0) 58%),
        radial-gradient(86% 70% at 50% 118%, color-mix(in srgb, var(--c) 62%, transparent), transparent 72%),
        linear-gradient(180deg, #26262b 0%, #101013 62%, #0a0a0c 100%);
      box-shadow: var(--glass-edge, inset 0 .24cqw .22cqw -.06cqw rgba(255,255,255,.42), inset 0 0 0 .13cqw rgba(255,255,255,.075)), 0 2.6cqw 6cqw rgba(0,0,0,.6); }
    .sw-glow { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
      background: radial-gradient(60% 60% at 50% 44%, color-mix(in srgb, var(--c) 26%, transparent), transparent 70%); }
    .sw-icon { position: relative; aspect-ratio: 1; height: auto !important; margin-top: -2%; }
    .sw-arc { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; transition: opacity .35s ease; overflow: visible; }
    .sw-arc circle:last-child { filter: drop-shadow(0 0 .8px var(--c)); transition: stroke-dasharray .5s linear; }
    .sw-name, .sw-live { position: absolute; left: 14cqw; right: 14cqw; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; opacity: 0; }
    .sw-name { top: 70.6cqw; font-size: 5.7cqw; font-weight: 640; letter-spacing: -.02em; line-height: 1.15; color: #fff; }
    .sw-live { top: 78cqw; left: 20cqw; right: 20cqw; font-size: 3.5cqw; font-weight: 600; letter-spacing: -.004em; color: rgba(255,255,255,.56); font-variant-numeric: tabular-nums; line-height: 1.2; }
    .sw-empty { position: absolute; left: 0; right: 0; top: 30cqw; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.6cqw; pointer-events: none; opacity: 0; }
    .sw-empty-ic { width: 20cqw; height: 20cqw; border-radius: 50%; display: grid; place-items: center; margin-bottom: 2.4cqw; color: rgba(255,255,255,.7);
      background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.06)); box-shadow: var(--glass-edge, inset 0 .2cqw 0 rgba(255,255,255,.3)); }
    .sw-empty-ic svg { width: 8.4cqw; height: 8.4cqw; }
    .sw-empty b { font-size: 5.4cqw; font-weight: 640; letter-spacing: -.02em; }
    .sw-empty span { font-size: 3.6cqw; font-weight: 500; color: rgba(255,255,255,.55); max-width: 54cqw; line-height: 1.3; }
    `);
  }
})();
