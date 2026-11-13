/* VistoOS · os/live.js — Live-Rand: laufende Dinge als gestapelte Lichtbögen ganz außen am Rand
 *
 *  Die runde Antwort auf die „Dynamic Island“: Timer, Fokus, Stoppuhr, Musik, Schlummern … leben systemweit
 *  als dünne Bögen am Displayrand, je mit einem kleinen Symbol am Bogenkopf. Antippen öffnet die App.
 *  Die Aktivität der gerade offenen App wird ausgeblendet (die App zeigt sie selbst groß).
 *
 *  V.live.set(id, { app, color, icon, value, label, sub, priority = 0, pulse = false,
 *                   paused = false, span, from = 0, params })
 *      value   0…1 (Bogen von `from` im Uhrzeigersinn) · null = läuft ohne Fortschritt (kreisender Lichtschweif)
 *              · Funktion → 0…1 (wird beim Zeichnen gelesen; dann muss die App nichts nachführen)
 *      span    Anteil 0…1: nur ein Schweif dieser Länge hinter dem Kopf (z. B. Stoppuhr: Sekundenlauf)
 *      label, sub   Text oder Funktion → Text (für Karussell, Blicke …)
 *      pulse   Bogen atmet sanft (z. B. Musik) · paused  gedimmt · params  für V.shell.open
 *  V.live.clear(id) · V.live.list() → [{id, app, color, icon, value, label, sub, priority, pulse, paused}]
 *  V.live.get(id) · V.live.has(id) · V.live.glyph(symbol, farbe) → Bild für Canvas (oder null, solange es lädt)
 *  Ereignis 'live:changed' { id, on }   (nur beim Erscheinen/Verschwinden, nicht bei jedem Wert)
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const LANE0 = 486, LANE_GAP = 11, WIDTH = 4, BADGE = 13, MAX_LANES = 3;
  const APP_TAIL = 16;          // in Apps bleibt vom Bogen nur ein kurzer Schweif hinter dem Symbol (Grad)
  const rad = (a) => ((a - 90) * Math.PI) / 180;

  const items = new Map();      // id → Eintrag
  let seq = 0;
  let cover = 1;                // Systemebene darüber → tritt zurück
  let spin = 0;                 // Winkel für Bögen ohne Fortschritt
  let inApp = 0;                // 0 Zifferblatt/Orbit: ganzer Bogen · 1 in einer App: nur Symbol mit Schweif

  const val = (v) => (typeof v === 'function' ? V.safe(v, 'live') : v);

  /* ---------------------------------------------------- Symbole als Bild */
  const glyphs = new Map();
  /** Symbol (V.icon) in einer Farbe als Bild für Canvas; null, solange es noch lädt */
  function glyph(name, color) {
    const key = name + '|' + color;
    let im = glyphs.get(key);
    if (!im) {
      const svg = V.icon(name).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ').replace(/currentColor/g, color);
      im = new Image();
      im.onload = () => V.emit('live:glyph', key);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      glyphs.set(key, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  /* ------------------------------------------------------------- Zustand */
  function hiddenFor(e) {
    const a = V.shell && V.shell.app;
    return !!(a && a.def.id === e.app);
  }
  /** sichtbare Einträge nach Rang; vergibt Spuren (0 = ganz außen) */
  function layout() {
    const list = [];
    for (const e of items.values()) if (!e.dead) list.push(e);
    list.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    let lane = 0;
    for (const e of list) {
      e.want = !hiddenFor(e) && lane < MAX_LANES;
      if (e.want) { e.laneT = LANE0 - lane * LANE_GAP; lane++; }
    }
    return list;
  }

  const live = (V.live = {
    set(id, o) {
      let e = items.get(id);
      const fresh = !e || e.dead;
      if (!e) {
        e = { id, app: id, color: '#FFFFFF', icon: 'info', value: null, label: '', sub: '', priority: 0, pulse: false, paused: false, span: 0, from: 0, params: undefined,
          seq: ++seq, shown: null, vis: 0, lane: 0, laneT: LANE0, want: true, dead: false, head: 0, dim: 1 };
        items.set(id, e);
      }
      e.dead = false;
      Object.assign(e, o);
      if (fresh) { e.shown = null; V.emit('live:changed', { id, on: true }); }
      return e;
    },
    clear(id) {
      const e = items.get(id);
      if (!e || e.dead) return;
      e.dead = true;
      V.emit('live:changed', { id, on: false });
    },
    has: (id) => { const e = items.get(id); return !!(e && !e.dead); },
    get(id) { const e = items.get(id); return e && !e.dead ? pub(e) : null; },
    list() { return layout().map(pub); },
    get count() { let n = 0; for (const e of items.values()) if (!e.dead) n++; return n; },
    glyph,
  });
  function pub(e) {
    return { id: e.id, app: e.app, color: e.color, icon: e.icon, value: val(e.value), label: val(e.label) || '', sub: val(e.sub) || '', priority: e.priority, pulse: !!e.pulse, paused: !!e.paused };
  }

  /* ------------------------------------------------------------ Zeichnen */
  function geometry(e, t) {
    // → Anfangs- und Endwinkel des Bogens (Uhrwinkel), Kopf = a1
    let v = val(e.value);
    if (v === null || v === undefined || !isFinite(v)) {
      e.a1 = spin + e.seq * 97; e.a0 = e.a1 - 58; e.comet = true;
      return;
    }
    v = U.clamp(v, 0, 1);
    if (e.span) {
      e.a1 = e.from + v * 360; e.a0 = e.a1 - e.span * 360; e.comet = true;
      return;
    }
    if (e.shown === null) e.shown = v;
    e.shown += (v - e.shown) * Math.min(1, t * 10);
    e.a0 = e.from; e.a1 = e.from + e.shown * 360; e.comet = false;
  }

  function draw(ctx, g, t, dt) {
    const mode = V.shell ? V.shell.mode : 'boot';
    const sys = (V.control && V.control.isOpen) || (V.faceEditor && V.faceEditor.isOpen) || (V.convo && V.convo.active);
    const travel = mode === 'home' && V.horizon && V.horizon.active;
    let target = mode === 'boot' || mode === 'setup' ? 0 : sys ? 0.12 : travel ? 0 : 1;
    if (V.ambient && V.ambient.on) target *= 0.55;
    cover += (target - cover) * Math.min(1, dt * 8);
    spin = (spin + dt * 46) % 360;
    inApp += ((mode === 'app' ? 1 : 0) - inApp) * Math.min(1, dt * 7);
    layout();
    for (const e of items.values()) {
      const want = !e.dead && e.want;
      if (!e.lane) e.lane = e.laneT;
      e.lane += (e.laneT - e.lane) * Math.min(1, dt * 9);
      e.vis += ((want ? 1 : 0) - e.vis) * Math.min(1, dt * (want ? 6 : 9));
      e.dim += ((e.paused ? 0.42 : 1) - e.dim) * Math.min(1, dt * 8);
      if (e.dead && e.vis < 0.01) { items.delete(e.id); continue; }
      geometry(e, dt);
      let alpha = e.vis * cover * e.dim;
      if (e.pulse && !e.paused) alpha *= 0.74 + 0.26 * Math.sin(t * 2.1 + e.seq);
      e.alpha = alpha;
      if (alpha < 0.004) continue;
      const r = e.lane - (1 - e.vis) * 10;     // gleitet von innen an den Rand
      // in Apps zieht sich der Bogen zum Symbol zusammen – der Rand gehört dort der App
      if (!e.comet && inApp > 0.004) e.a0 = U.lerp(e.a0, Math.max(e.a0, e.a1 - APP_TAIL), inApp);
      const span = e.a1 - e.a0;
      ctx.lineCap = 'round'; g.lineCap = 'round';
      if (e.comet) {
        ctx.globalAlpha = 1; g.globalAlpha = 1;
        V.rim.tail(ctx, 500, 500, r, e.a0, e.a1, e.color, WIDTH, alpha, 0);
        V.rim.tail(g, 500, 500, r, e.a0 + span * 0.45, e.a1, e.color, WIDTH * 2.6, alpha * 0.5, 0);
      } else if (span > 0.05 && inApp > 0.5) {
        ctx.globalAlpha = 1;
        V.rim.tail(ctx, 500, 500, r, e.a0, e.a1, e.color, WIDTH, alpha, alpha * (1 - inApp));
      } else if (span > 0.05) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = WIDTH;
        ctx.beginPath();
        if (span >= 359.9) ctx.arc(500, 500, r, 0, TAU); else ctx.arc(500, 500, r, rad(e.a0), rad(e.a1));
        ctx.stroke();
        g.globalAlpha = alpha * 0.26 * (1 - inApp);
        g.strokeStyle = e.color;
        g.lineWidth = WIDTH * 2.6;
        g.beginPath();
        if (span >= 359.9) g.arc(500, 500, r, 0, TAU); else g.arc(500, 500, r, rad(e.a0), rad(e.a1));
        g.stroke();
      }
      // Symbol am Bogenkopf: dunkle Perle mit Lichtkante
      const p = V.display.pt(e.a1, r);
      e.hx = p.x; e.hy = p.y; e.head = e.a1;
      const k = 0.6 + 0.4 * e.vis;
      ctx.globalAlpha = Math.min(1, alpha * 1.3);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(p.x, p.y, (BADGE + 2.5) * k, 0, TAU); ctx.fill();
      ctx.fillStyle = U.mix(e.color, '#0b0b0d', 0.8);
      ctx.beginPath(); ctx.arc(p.x, p.y, BADGE * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = U.rgba(e.color, 0.62);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, (BADGE - 0.7) * k, 0, TAU); ctx.stroke();
      const im = glyph(e.icon, U.lighten(e.color, 0.3));
      if (im) { const s = 16.5 * k; ctx.drawImage(im, p.x - s / 2, p.y - s / 2, s, s); }
      g.globalAlpha = alpha * 0.5;
      g.fillStyle = e.color;
      g.beginPath(); g.arc(p.x, p.y, BADGE * 1.5, 0, TAU); g.fill();
      ctx.globalAlpha = 1; g.globalAlpha = 1;
    }
  }

  /** Bereich aller Bögen inkl. Leuchten (logisch); null = ganze Fläche */
  function bounds() {
    let box;
    for (const e of items.values()) {
      if (e.a1 === undefined) return null;
      const lo = Math.min(e.a0, e.a1), hi = Math.max(e.a0, e.a1);
      if (hi - lo > 300) return null;
      const r = e.lane || LANE0;
      const pad = 40;
      for (let c = lo; ; c = Math.min(hi, (Math.floor(c / 90) + 1) * 90)) {
        const p = V.display.pt(c, r);
        if (!box) box = [p.x - pad, p.y - pad, p.x + pad, p.y + pad];
        else { box[0] = Math.min(box[0], p.x - pad); box[1] = Math.min(box[1], p.y - pad); box[2] = Math.max(box[2], p.x + pad); box[3] = Math.max(box[3], p.y + pad); }
        if (c >= hi) break;
      }
    }
    return box || [0, 0, 1, 1];
  }

  V.on('boot:fx', () => {
    V.fx.add({ z: 9, active: () => items.size > 0, bounds, draw });
  });

  /* ------------------------------------------------------------ Antippen */
  function hit(p) {
    const mode = V.shell.mode;
    if (mode !== 'home' && mode !== 'launcher' && mode !== 'app') return null;
    if ((V.control && V.control.isOpen) || (V.convo && V.convo.active)) return null;
    if (p.y > 868 && Math.abs(p.x - 500) < 175) return null;      // Visto-Zone gehört Visto
    let best = null, bestD = 1e9;
    for (const e of items.values()) {
      if (e.dead || !e.want || (e.alpha || 0) < 0.3) continue;
      // Symbol am Kopf (großzügig) …
      let d = Math.hypot(p.x - e.hx, p.y - e.hy);
      let ok = d < 48;
      // … auf Zifferblatt und Orbit auch der Bogen selbst
      if (!ok && mode !== 'app' && !e.comet && Math.abs(p.r - e.lane) < 22) {
        const rel = U.wrap(p.a - e.a0, 360);
        if (rel <= e.a1 - e.a0 + 3 || rel >= 357) { ok = true; d = 60 + Math.abs(p.r - e.lane); }
      }
      if (ok && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }
  V.on('boot:ready', () => {
    V.shell.hooks.tap.push((p) => {
      const e = hit(p);
      if (!e) return false;
      V.haptic(8);
      V.sound.play('tap');
      V.rim.pulse({ at: U.wrap(e.head, 360), color: e.color, spread: 26, duration: 0.7 });
      V.shell.open(e.app, e.params, { x: e.hx, y: e.hy, r: 16 });
      return true;
    });
  });
  void live;
})();
