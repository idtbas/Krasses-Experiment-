/* VistoOS · os/horizon.js — Horizont und Zeitreise: „Zeit ist rund“
 *
 *  (Darstellung: eigene Leinwand im Startbildschirm, unter Visto und unter dem Live-Rand.)
 *
 *  HORIZONT  Der Rand des Zifferblatts zeigt die nächsten zwölf Stunden, ausgerichtet wie auf einer Uhr
 *            (Winkel = Uhrzeit auf dem 12-Stunden-Blatt). Eine feine Marke steht bei „jetzt“; von dort läuft
 *            ein hauchdünnes Band im Uhrzeigersinn: warm, solange es hell ist, blau in der Nacht.
 *            Termine sind Bögen, Wetter, Sonnenauf-/-untergang, Wecker, Timer und Erinnerungen kleine Zeichen.
 *            Kurz nach dem Wecken und beim Berühren des Rands ist er präsent, sonst nur ein Hauch.
 *  ZEITREISE Am Rand drehen spult die Zeit (360° = 12 h, Rastung je Viertelstunde). Das Zifferblatt zeigt
 *            V.time.view(), die Marke wandert mit, ein Lichtfaden spannt sich vom Jetzt zur Reisezeit, und
 *            eine Glas-Kapsel sagt, wann das ist und was dann ist. Loslassen: kurze Pause, dann federt
 *            die Zeit sichtbar zurück ins Jetzt. Antippen kehrt sofort zurück.
 *
 *  V.horizon.provide(id, (from: Date, to: Date) => [{ start: Date, end?: Date,
 *        kind: 'event'|'weather'|'sun'|'alarm'|'timer'|'reminder', color, icon?, label, sub? }])
 *  V.horizon.items(from, to) → sortierte Liste aller Anbieter      V.horizon.refresh()
 *  V.horizon.offset   ms gegenüber jetzt (läuft weich mit)          V.horizon.active   Zeitreise läuft
 *  V.horizon.at()     → Date der Reisezeit (gerastet); ohne Zeitreise = jetzt
 *  V.horizon.travel(Date | ms-Versatz, {hold: ms})   hinreisen, kurz bleiben, zurückfedern
 *  V.horizon.back()   sofort zurück ins Jetzt
 *  V.horizon.describe(Date) → { weather: {temp, icon, text}|null, current: [Einträge, die dann laufen],
 *                               next: nächster Eintrag danach | null }
 *  V.time.view() → Date    Jetzt + Zeitreise (läuft weich; für Zeiger). Zifferblätter bekommen sie in frame(dt, now).
 *  Ereignis 'horizon:travel' { offset, at, active }   bei jeder Rastung, beim Beginn, während des Rücklaufs, am Ende
 *
 *  Zifferblatt-Definition:  horizon: 'rim' (Standard) | 'travel' (nur bei Zeitreise) | false
 *                           horizonR: Radius des Bands (logisch, Standard 452)
 *                           horizonCapsule: Höhe der Kapsel-Mitte in cqw (Standard 25) oder { y, compact: true, info: true }
 *                                           (compact = nur eine Zeile, wenn das Blatt kaum Platz lässt; info = Wetter in der Zeile)
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const MIN = 60e3, HOUR = 3600e3, DAY = 864e5, H12 = 12 * HOUR, Q = 15 * MIN;
  const MS_PER_DEG = H12 / 360;                  // 360° = 12 h → 2 Minuten je Grad
  const WINDOW = 11.5 * HOUR;                    // sichtbares Zeitfenster ab der Marke (die letzte halbe Stunde bleibt Lücke)
  const PAST = -24 * HOUR, FUTURE = 48 * HOUR;   // Grenzen der Zeitreise
  const HOLD_MS = 2400;                          // Pause nach dem Loslassen
  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const accent = () => V.store.get('settings.accent', '#FF9A4D');

  V.icon.add('sunset', '<path d="M5 17a7 7 0 0 1 14 0M2.5 20.5h19M12 8V3M9.5 5.5L12 8l2.5-2.5M4 10.5l1.5 1.2M20 10.5l-1.5 1.2"/>');

  V.css('hz', `
    .hz-layer { position: absolute; inset: 0; z-index: 6; pointer-events: none; border-radius: 50%; overflow: hidden; }
    .hz-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hz-cap { position: absolute; left: 50%; top: 25cqw; transform: translate(-50%, -50%) scale(.9); opacity: 0; visibility: hidden;
      padding: 2cqw 4.8cqw 2.25cqw; border-radius: 6cqw; display: flex; flex-direction: column; align-items: center; gap: .55cqw;
      white-space: nowrap; will-change: transform, opacity; max-width: 62cqw; }
    :where(.hz-cap) { background: linear-gradient(180deg, rgba(255,255,255,.2) 0%, rgba(255,255,255,.1) 58%, rgba(255,255,255,.12) 100%);
      box-shadow: inset 0 .24cqw .22cqw -.06cqw rgba(255,255,255,.42), inset 0 0 0 .13cqw rgba(255,255,255,.075), 0 .9cqw 2.6cqw rgba(0,0,0,.38);
      -webkit-backdrop-filter: blur(3.4cqw) saturate(1.7); backdrop-filter: blur(3.4cqw) saturate(1.7); }
    .hz-cap::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: rgba(8,8,12,.5); z-index: -1; }
    .hz-cap-top { display: flex; align-items: baseline; gap: 1.5cqw; font-size: 3.75cqw; font-weight: 640; letter-spacing: -.012em; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .hz-rel { color: rgba(255,255,255,.64); font-weight: 560; }
    .hz-sep { color: rgba(255,255,255,.3); }
    .hz-time { color: #fff; }
    .hz-cap-sub { display: flex; align-items: center; gap: 1.15cqw; font-size: 3.05cqw; font-weight: 540; color: rgba(255,255,255,.66); line-height: 1.2; max-width: 100%; }
    .hz-cap-sub svg { width: 3.5cqw; height: 3.5cqw; flex: none; }
    .hz-cap-sub .hz-dot { width: 1.5cqw; height: 1.5cqw; border-radius: 50%; flex: none; margin: 0 .2cqw 0 .1cqw; }
    .hz-cap-sub .hz-gap { opacity: .4; margin: 0 .35cqw; }
    .hz-cap-sub .hz-tx { overflow: hidden; text-overflow: ellipsis; }
    .hz-wx { display: inline-flex; align-items: center; gap: 1.1cqw; color: rgba(255,255,255,.78); font-weight: 560; align-self: center; }
    .hz-wx svg { width: 1.08em; height: 1.08em; }
    .hz-wx .hz-sep { margin-right: .4cqw; }
    .hz-cap.compact { padding: 1.5cqw 3.8cqw 1.6cqw; }
    .hz-cap.compact .hz-cap-top { font-size: 3.4cqw; }
  `);

  /* =============================================================== Anbieter */
  const providers = new Map();
  const KINDS = { event: 1, weather: 1, sun: 1, alarm: 1, timer: 1, reminder: 1 };
  const RANK = { alarm: 5, timer: 4, reminder: 3, sun: 2, weather: 1 };   // wer bei Gedränge bleibt

  function collect(from, to) {
    const out = [];
    for (const [pid, fn] of providers) {
      const list = V.safe(() => fn(from, to), 'horizon ' + pid);
      if (!Array.isArray(list)) continue;
      for (const it of list) {
        if (!it || !(it.start instanceof Date) || isNaN(it.start) || !KINDS[it.kind]) continue;
        out.push({ provider: pid, start: it.start, end: it.end instanceof Date && it.end > it.start ? it.end : null, kind: it.kind, color: it.color || '#FFFFFF', icon: it.icon || null, label: it.label || '', sub: it.sub || '' });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  /* ----- Zwischenspeicher für die Darstellung (Zeiten als ms, Winkel vorberechnet) */
  let cache = null;            // { from, to, built, list: [...], tz0, sun: [{rise, set}], day0 }
  const alphaOf = new Map();   // key → eingeblendeter Anteil (übersteht Neuaufbau)
  let stale = true;

  function angOf(ms) { const a = ((ms - cache.tz0) / MS_PER_DEG) % 360; return a < 0 ? a + 360 : a; }

  function build() {
    const now = V.time.ms();
    if (cache) for (const it of cache.list) if (it.va > 0.004) alphaOf.set(it.key, it.va);
    const from = now + PAST - HOUR, to = now + FUTURE + H12 + HOUR;
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const c = (cache = { from, to, built: now, list: [], tz0: d0.getTime(), day0: 0, sun: [] });
    // Sonnenzeiten je Tag (für die Farbe des Bands)
    const first = new Date(from); first.setHours(0, 0, 0, 0);
    c.day0 = first.getTime();
    if (V.weather && V.weather.sun) {
      for (let d = new Date(first); d.getTime() < to; d.setDate(d.getDate() + 1)) {
        const s = V.safe(() => V.weather.sun(d));
        c.sun.push(s ? { rise: d.getTime() + s.rise * HOUR, set: d.getTime() + s.set * HOUR } : null);
      }
    }
    const raw = collect(new Date(from), new Date(to));
    const lanesEnd = [];
    const points = [];
    for (const it of raw) {
      const s = it.start.getTime(), e = it.end ? it.end.getTime() : s;
      const o = { key: it.kind + '|' + s + '|' + it.label, s, e, kind: it.kind, color: it.color, icon: it.icon, label: it.label, sub: it.sub, a: 0, lane: 0, hide: false, va: 0, src: it };
      o.a = angOf(s);
      if (it.kind === 'event' && e > s) {
        // überlappende Termine: zweite Spur nach innen
        let lane = 0;
        while (lanesEnd[lane] !== undefined && lanesEnd[lane] > s + MIN) lane++;
        lanesEnd[lane] = e;
        o.lane = Math.min(lane, 2);
      } else points.push(o);
      o.va = alphaOf.get(o.key) || 0;
      c.list.push(o);
    }
    // Zeichen, die sich drängen: das wichtigere bleibt
    points.sort((x, y) => (RANK[y.kind] || 0) - (RANK[x.kind] || 0) || x.s - y.s);
    const kept = [];
    for (const p of points) {
      if (kept.some((k) => Math.abs(k.s - p.s) < 11 * MIN)) p.hide = true; else kept.push(p);
    }
    alphaOf.clear();
    stale = false;
    dirty = true;
  }
  function ensure() {
    const now = V.time.ms();
    if (stale || !cache || Math.abs(now - cache.built) > 10 * MIN) build();
  }

  /** Tageslicht 0 (Nacht) … 1 (Tag) zum Zeitpunkt ms – aus den Sonnenzeiten des Wetters */
  function skyAt(ms) {
    const s = cache.sun[Math.floor((ms - cache.day0) / DAY)];
    if (!s) return 1;
    const w = 34 * MIN;
    return U.smoothstep(s.rise - w, s.rise + w, ms) * (1 - U.smoothstep(s.set - w, s.set + w, ms));
  }
  const SKY = [];   // Farbtabelle Nacht → Dämmerung → Tag
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    SKY.push(k < 0.5 ? U.mix('#7F8DFF', '#FF9C7C', k * 2) : U.mix('#FF9C7C', '#FFE6AE', (k - 0.5) * 2));
  }

  /* ============================================================== Zeitreise */
  let active = false, dragging = false, returning = false;
  let targetAt = null;         // ms: gerastete Reisezeit (null = jetzt)
  let retAt = 0;               // ms: gerastete Zeit während des Rücklaufs
  let raw = 0;                 // ungerasteter Versatz unter dem Finger
  let holdT = 0, lastEmit = 0;
  const off = V.spring(0, V.motion.snappy);    // gezeigter Versatz in ms

  const nowMs = () => V.time.ms();
  function curOffset() {
    if (!active) return 0;
    if (!returning && !off.moving && targetAt !== null) return targetAt - nowMs();   // ruht auf der Reisezeit
    return off.value;
  }
  function atMs() {
    if (!active) return nowMs();
    if (returning) return retAt || nowMs();
    return targetAt === null ? nowMs() : targetAt;
  }
  function emit() {
    lastEmit = performance.now();
    V.emit('horizon:travel', { offset: curOffset(), at: new Date(atMs()), active });
  }

  function begin() {
    clearTimeout(holdT);
    const o = curOffset();
    returning = false;
    off.set(o);
    raw = o;
    if (!active) { active = true; targetAt = null; }
    dirty = true;
  }
  function setTarget(ms, motion) {
    targetAt = ms;
    off.to(ms === null ? 0 : ms - nowMs(), motion || V.motion.snappy);
    emit();
    updateCapsule();
  }
  function startReturn() {
    clearTimeout(holdT);
    if (!active) return;
    if (returning) return;
    const o = curOffset();
    returning = true;
    retAt = targetAt === null ? nowMs() : targetAt;
    targetAt = null;
    off.set(o);
    hideCapsule();
    off.to(0, V.motion.gentle).then((ok) => { if (ok && returning) finish(); });
    if (Math.abs(o) < 1000) finish();
  }
  function finish(instant) {
    clearTimeout(holdT);
    const was = active;
    active = false; dragging = false; returning = false; targetAt = null; raw = 0;
    off.set(0);
    hideCapsule(instant);
    dirty = true;
    if (was) { emit(); if (!instant) V.haptic(5); }
  }

  /** gerastete Reisezeit zum rohen Versatz: volle Viertelstunden auf der Uhr, nahe null = jetzt */
  function snap(rawOff) {
    if (Math.abs(rawOff) < 6 * MIN) return null;
    const n = nowMs();
    let t = Math.round((n + rawOff) / Q) * Q;
    if (rawOff > 0 && t <= n) t += Q;
    if (rawOff < 0 && t >= n) t -= Q;
    return t;
  }

  const crown = {
    start() {
      begin();
      dragging = true;
      attention(0);
    },
    turn(dA) {
      if (!active) begin();
      raw = U.clamp(raw + dA * MS_PER_DEG, PAST, FUTURE);
      const t = snap(raw);
      if (t === targetAt) return;
      const hour = t !== null && t % HOUR === 0;
      setTarget(t);
      if (t === null) { V.sound.play('tap'); V.haptic(10); }
      else { V.sound.play('tick'); V.haptic(hour ? 6 : 3); }
    },
    end() {
      dragging = false;
      if (!active) return;
      if (targetAt === null) { startReturn(); return; }
      clearTimeout(holdT);
      holdT = setTimeout(startReturn, HOLD_MS);
      attention(HOLD_MS + 2500);
    },
  };

  /* ================================================================ Zustand */
  let layer = null, cv = null, c = null, px = 0, dirty = true, blank = true;
  let cap = null, capRel = null, capTime = null, capWx = null, capSub = null, capOn = false, capKey = '';
  const capSp = V.spring(0, V.motion.bouncy);
  const showSp = V.spring(0, V.motion.gentle);   // Band überhaupt da (Hauch)
  const presSp = V.spring(0, V.motion.smooth);   // präsent: Zeichen, volle Stärke
  const travSp = V.spring(0, V.motion.smooth);   // Zeitreise: Marke in Akzentfarbe, Lichtfaden
  let showT = -1, presT = -1, travT = -1;
  let attnUntil = 0, touching = false;
  let cfg = { mode: 'rim', r: 452, capY: 25 };

  function attention(ms) { attnUntil = Math.max(attnUntil, performance.now() + ms); }

  function readCfg() {
    const f = V.faces && V.faces.instance;
    const d = f ? f.def : null;
    const mode = !d || d.horizon === undefined ? 'rim' : d.horizon === false ? 'off' : d.horizon;
    const hc = d && d.horizonCapsule;
    cfg = { mode, r: (d && d.horizonR) || 452, capY: (typeof hc === 'object' && hc ? hc.y : hc) || 25, compact: !!(hc && hc.compact), info: !!(hc && hc.info) };
    if (cap) { cap.style.top = cfg.capY + 'cqw'; cap.classList.toggle('compact', cfg.compact); capKey = ''; }
    dirty = true;
  }

  function mount() {
    const home = V.faces.home;
    if (!home || layer) return;
    layer = U.el('div', { class: 'hz-layer' });
    cv = U.el('canvas', { class: 'hz-cv' });
    c = cv.getContext('2d');
    cap = U.el('div', { class: 'hz-cap vos-glass thick blur' });
    capRel = U.el('span', { class: 'hz-rel' });
    capTime = U.el('span', { class: 'hz-time' });
    capSub = U.el('div', { class: 'hz-cap-sub' });
    capWx = U.el('span', { class: 'hz-wx' });
    cap.append(U.el('div', { class: 'hz-cap-top' }, capRel, U.el('span', { class: 'hz-sep', text: '·' }), capTime, capWx), capSub);
    layer.append(cv, cap);
    home.appendChild(layer);
    capSp.onUpdate((v) => {
      const k = U.clamp(v, 0, 1.3);
      cap.style.visibility = v < 0.01 ? 'hidden' : 'visible';
      cap.style.opacity = U.clamp(v * 1.5, 0, 1).toFixed(3);
      cap.style.transform = `translate(-50%, -50%) translateY(${((1 - k) * -1.6).toFixed(3)}cqw) scale(${(0.86 + 0.14 * k).toFixed(4)})`;
    });
    size();
    readCfg();
  }
  function size() {
    if (!cv) return;
    const dpr = Math.min(V.display.dpr || 1, 2);
    px = Math.max(200, Math.round((V.display.size || 360) * dpr));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    dirty = true;
  }

  /* ---------------------------------------------------------------- Kapsel */
  function relText(ms) {
    const m = Math.round(Math.abs(ms) / MIN);
    if (m < 1) return 'Jetzt';
    const h = Math.floor(m / 60), r = m % 60;
    const s = h ? h + ' Std.' + (r ? ' ' + r + ' Min.' : '') : r + ' Min.';
    return (ms > 0 ? 'In ' : 'Vor ') + s;
  }
  function dayWord(d) {
    const r = V.fmt.relDay(d);
    return r === 'Heute' ? '' : r.length > 7 ? V.fmt.WD_S[d.getDay()] + '.' : r;
  }
  function overlapping(t) {
    ensure();
    const cur = [];
    let next = null;
    for (const it of cache.list) {
      if (it.kind === 'weather' || it.kind === 'sun') continue;
      if (it.e > it.s ? it.s <= t && it.e > t : Math.abs(it.s - t) < 8 * MIN) cur.push(it);
      else if (it.s > t && !next) next = it;
    }
    return { cur, next };
  }
  function describe(date) {
    const t = date.getTime();
    const { cur, next } = overlapping(t);
    const w = V.weather && V.weather.at ? V.safe(() => V.weather.at(date)) : null;
    const pubIt = (it) => ({ start: new Date(it.s), end: it.e > it.s ? new Date(it.e) : null, kind: it.kind, color: it.color, icon: it.icon, label: it.label, sub: it.sub });
    return { weather: w ? { temp: w.temp, icon: w.icon, text: w.text, night: w.night } : null, current: cur.map(pubIt), next: next ? pubIt(next) : null };
  }
  function updateCapsule() {
    if (!cap) return;
    if (!active || returning || targetAt === null) { hideCapsule(); return; }
    const d = new Date(targetAt);
    const key = String(targetAt) + '|' + Math.round((targetAt - nowMs()) / MIN);
    if (key !== capKey) {
      capKey = key;
      const day = dayWord(d);
      capRel.textContent = relText(targetAt - nowMs());
      capTime.textContent = (day ? day + ' ' : '') + V.fmt.time(d);
      const info = describe(d);
      let html = '';
      const w = info.weather;
      const main = info.current[0] || (info.next && info.next.start - d <= 45 * MIN ? info.next : null);
      if (w) html += V.icon(w.icon || 'weather') + '<span>' + Math.round(w.temp) + '°' + (main ? '' : ' ' + U.esc(w.text)) + '</span>';
      if (main) {
        const soon = main.start > d;
        const tx = main.kind === 'event' || main.kind === 'reminder' ? main.label : main.kind === 'alarm' ? main.label || 'Wecker' : main.kind === 'timer' ? main.label + ' läuft ab' : main.label;
        html += (w ? '<span class="hz-gap">·</span>' : '') + `<span class="hz-dot" style="background:${main.color}"></span><span class="hz-tx">${U.esc(tx)}${soon ? ' ' + V.fmt.time(main.start) : ''}</span>`;
      }
      capSub.innerHTML = html;
      capSub.style.display = html && !cfg.compact ? '' : 'none';
      // einzeilige Kapsel: auf Wunsch das Wetter gleich mit in die Zeile
      const inline = cfg.compact && cfg.info && w;
      capWx.innerHTML = inline ? '<span class="hz-sep">·</span>' + V.icon(w.icon || 'weather') + '<span>' + Math.round(w.temp) + '°</span>' : '';
      capWx.style.display = inline ? '' : 'none';
    }
    if (!capOn) { capOn = true; capSp.to(1, V.motion.bouncy); }
  }
  function hideCapsule(instant) {
    capKey = '';
    if (!capOn && !instant) return;
    capOn = false;
    if (instant) capSp.set(0); else capSp.to(0, V.motion.snappy);
  }

  /* --------------------------------------------------------------- Zeichnen */
  /** Ausblenden zum Ende des Fensters (f = Anteil des Fensters 0…1) */
  const fade = (f) => (f < 0 ? 0 : f > 1 ? 0 : 1 - U.smoothstep(0.8, 1, f));
  /** Visto (die Linie unten) liegt davor: Bänder, die die Linie kreuzen würden, laufen dahinter durch und
   *  blenden dort aus. Ganz außen (R > 475) läuft das Band unter der Linie vorbei – nichts zu tun. */
  let vzCore = 14;
  /** Zeichen in diesem Bereich rücken an den äußersten Rand (unter die Linie), statt zu verschwinden: 0…1 */
  const vzOut = (a, R) => (R > 475 ? 0 : 1 - U.smoothstep(vzCore + 1, vzCore + 7, Math.abs(U.angDiff(a, 180))));

  function draw(dt) {
    const k = px / 1000;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, px, px);
    const show = U.clamp(showSp.value, 0, 1), pres = U.clamp(presSp.value, 0, 1), trav = U.clamp(travSp.value, 0, 1);
    if (show < 0.004) { blank = true; return false; }
    blank = false;
    ensure();
    c.setTransform(k, 0, 0, k, 0, 0);
    const R = cfg.r;
    const edge = R > 475;                 // Band ganz außen: kleinere Zeichen
    vzCore = U.deg(Math.asin(Math.min(0.9, 108 / R)));
    const n = nowMs();
    const o = curOffset();
    const vt = n + o;                     // betrachtete Zeit
    const headA = angOf(vt);
    const acc = accent();
    let anim = false;
    const step = Math.min(1, dt * 9);

    // 1 · das Band: Himmel der nächsten Stunden, in Viertelstunden, an der Uhr ausgerichtet
    c.lineCap = 'butt';
    c.lineWidth = 2.2 + 1 * pres;
    const bandA = show * (0.2 + 0.4 * pres);
    let t0 = vt;
    while (t0 < vt + WINDOW) {
      const t1 = Math.min(vt + WINDOW, (Math.floor(t0 / Q) + 1) * Q);
      const mid = (t0 + t1) / 2;
      const a0 = headA + (t0 - vt) / MS_PER_DEG, a1 = headA + (t1 - vt) / MS_PER_DEG;
      const al = bandA * fade((mid - vt) / WINDOW);
      if (al > 0.004) {
        c.globalAlpha = al;
        c.strokeStyle = SKY[Math.round(skyAt(mid) * 16)];
        c.beginPath(); c.arc(500, 500, R, rad(a0 + (t0 === vt ? 1.1 : 0)), rad(a1 + 0.12)); c.stroke();
      }
      t0 = t1;
    }

    // 2 · Termine als Bögen
    c.lineCap = 'round';
    const w = 3.8 + 1.8 * pres;
    for (const it of cache.list) {
      if (it.kind !== 'event' || it.e <= it.s) continue;
      const s = Math.max(it.s, vt), e = Math.min(it.e, vt + WINDOW);
      const vis = e - s > MIN;
      const target = vis ? fade((s - vt) / WINDOW) : 0;
      if (Math.abs(target - it.va) > 0.004) { it.va += (target - it.va) * step; anim = true; } else it.va = target;
      if (it.va < 0.004 || !vis) continue;
      const r = R - it.lane * (w + 4);
      const capDeg = ((w / 2) / r) * 57.2958;
      let a0 = headA + (s - vt) / MS_PER_DEG + capDeg, a1 = headA + (e - vt) / MS_PER_DEG - capDeg;
      if (a1 < a0) a0 = a1 = (a0 + a1) / 2;
      if (it.s <= vt) a0 += 1.6;                       // läuft gerade: Luft zur Marke
      if (a1 < a0) a1 = a0;
      const run = it.s <= vt ? 1 : 0;
      // dunkle Fuge, damit der Bogen frei auf dem Band liegt
      c.globalAlpha = it.va * show;
      c.strokeStyle = '#000';
      c.lineWidth = w + 5;
      c.beginPath(); c.arc(500, 500, r, rad(a0), rad(a1 + 0.01)); c.stroke();
      c.globalAlpha = it.va * show * (0.62 + 0.38 * pres) * (run ? 1 : 0.88);
      c.strokeStyle = it.color;
      c.lineWidth = w;
      if (run && pres > 0.3) { c.shadowColor = it.color; c.shadowBlur = 14 * k * pres; }
      c.beginPath(); c.arc(500, 500, r, rad(a0), rad(a1 + 0.01)); c.stroke();
      c.shadowBlur = 0;
    }

    // 3 · Zeitreise: Lichtfaden vom Jetzt zur Reisezeit – wie ein Gummiband, das zurückziehen will
    const rr = edge ? R - 10 : R + 10;
    const nowA = angOf(n);
    const band = trav > 0.01 && Math.abs(o) > 20e3;
    if (band) {
      const span = Math.min(360, Math.abs(o) / MS_PER_DEG);
      const ta = trav * show;
      c.lineCap = 'round';
      c.globalAlpha = 1;
      if (span >= 359.5) {
        c.globalAlpha = 0.3 * ta; c.strokeStyle = acc; c.lineWidth = 2.2;
        c.beginPath(); c.arc(500, 500, rr, 0, TAU); c.stroke();
        c.globalAlpha = 1;
        if (o > 0) V.rim.tail(c, 500, 500, rr, headA - 150, headA, acc, 2.2, 0.9 * ta, 0);
        else V.rim.tail(c, 500, 500, rr, headA, headA + 150, acc, 2.2, 0, 0.9 * ta);
      } else if (o > 0) V.rim.tail(c, 500, 500, rr, nowA, nowA + span, acc, 2.2, 0.95 * ta, 0.16 * ta);
      else V.rim.tail(c, 500, 500, rr, nowA - span, nowA, acc, 2.2, 0.16 * ta, 0.95 * ta);
    }

    // 4 · hinter Visto: Band, Bögen und Faden blenden unter der Linie aus
    if (!edge) {
      c.globalCompositeOperation = 'destination-out';
      c.lineCap = 'butt';
      c.strokeStyle = '#000';
      c.lineWidth = 76;
      const lim = Math.ceil(vzCore + 7);
      for (let i = -lim; i < lim; i++) {
        const m = 1 - U.smoothstep(vzCore, vzCore + 7, Math.abs(i + 0.5));
        if (m <= 0) continue;
        c.globalAlpha = m;
        c.beginPath(); c.arc(500, 500, R - 6, rad(180 + i), rad(181 + i + (m >= 1 ? 0.3 : 0))); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }

    // 5 · Zeichen: Wetter, Sonne, Wecker, Timer, Erinnerungen
    const gs = (edge ? 23 : 32) * (0.72 + 0.28 * pres);
    for (const it of cache.list) {
      if (it.kind === 'event' && it.e > it.s) continue;
      const d = it.s - vt;
      const target = it.hide || d < -2 * MIN ? 0 : fade(Math.max(0, d) / WINDOW);
      if (Math.abs(target - it.va) > 0.004) { it.va += (target - it.va) * step; anim = true; } else it.va = target;
      if (it.va < 0.004) continue;
      const a = headA + d / MS_PER_DEG;
      const out = vzOut(a, R);
      const p = V.display.pt(a, out > 0 ? U.lerp(R, 481, out) : R);
      const quiet = it.kind !== 'weather' ? it.va * show * (1 - pres) * 0.75 : 0;   // im Hauch: nur ein Punkt
      if (quiet > 0.004) {
        c.globalAlpha = it.va * show;
        c.fillStyle = '#000';
        c.beginPath(); c.arc(p.x, p.y, 5.6, 0, TAU); c.fill();
        c.globalAlpha = quiet;
        c.fillStyle = it.color;
        c.beginPath(); c.arc(p.x, p.y, 3, 0, TAU); c.fill();
      }
      const ga = it.va * show * pres;
      if (ga > 0.004) {
        c.globalAlpha = Math.min(1, ga * 1.2);
        c.fillStyle = '#000';
        c.beginPath(); c.arc(p.x, p.y, gs * 0.7, 0, TAU); c.fill();
        c.globalAlpha = ga;
        if (it.kind === 'reminder') {
          c.strokeStyle = it.color; c.lineWidth = 2.2;
          c.beginPath(); c.arc(p.x, p.y, gs * 0.3, 0, TAU); c.stroke();
          c.fillStyle = it.color;
          c.beginPath(); c.arc(p.x, p.y, gs * 0.1, 0, TAU); c.fill();
        } else {
          const im = V.live.glyph(it.icon || 'info', it.color);
          if (im) c.drawImage(im, p.x - gs / 2, p.y - gs / 2, gs, gs);
        }
      }
    }

    // 6 · Zeitreise: „jetzt“ bleibt als kleiner Ring stehen
    if (band) {
      const pn = V.display.pt(nowA, U.lerp(rr, 483, vzOut(nowA, R)));
      c.globalAlpha = trav * show;
      c.fillStyle = '#000';
      c.beginPath(); c.arc(pn.x, pn.y, 6.5, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.8;
      c.beginPath(); c.arc(pn.x, pn.y, 4.2, 0, TAU); c.stroke();
    }

    // 7 · die Marke: jetzt bzw. Reisezeit
    {
      const len = (edge ? 5 : 7) + 5 * pres;
      const hr = U.lerp(R, 483, vzOut(headA, R));
      const p0 = V.display.pt(headA, hr - len), p1 = V.display.pt(headA, Math.min(498, hr + len));
      const col = trav > 0.01 ? U.mix('#FFFFFF', acc, trav) : '#FFFFFF';
      c.lineCap = 'round';
      c.globalAlpha = show;
      c.strokeStyle = '#000'; c.lineWidth = 7.5;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      c.globalAlpha = show * (0.6 + 0.4 * pres);
      c.strokeStyle = col; c.lineWidth = 2.8;
      c.shadowColor = col; c.shadowBlur = (4 + 10 * pres) * k;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
    return anim;
  }

  /* ------------------------------------------------------------------- Takt */
  let wasAnim = false, lastMin = -1;
  function frame(dt) {
    if (!layer) return;
    const onHome = V.shell.mode === 'home' && V.faces.home.style.visibility !== 'hidden';
    if (!onHome || (V.faceEditor && V.faceEditor.isOpen)) { if (active) finish(true); return; }
    if (V.glances && V.glances.faceShown < 0.02) { if (active && !dragging) finish(true); touching = false; return; }   // ein Blick liegt vorn
    if (active && !dragging && !returning && V.convo && V.convo.active) startReturn();
    const amb = !!(V.ambient && V.ambient.on);
    if (amb && active) finish(true);
    // Ziele
    const sT = amb || cfg.mode === 'off' ? 0 : cfg.mode === 'travel' ? (active ? 1 : 0) : 1;
    const pT = active || touching || performance.now() < attnUntil ? 1 : 0;
    const tT = active ? 1 : 0;
    if (sT !== showT) { showT = sT; showSp.to(sT, sT ? V.motion.smooth : V.motion.gentle); }
    if (pT !== presT) { presT = pT; presSp.to(pT, pT ? V.motion.smooth : V.motion.gentle); }
    if (tT !== travT) { travT = tT; travSp.to(tT, V.motion.smooth); }
    // Rücklauf: die gerastete Zeit läuft mit zurück (Ziffern zählen sichtbar herunter)
    if (returning) {
      const o = off.value;
      const stepQ = Math.abs(o) > 2 * HOUR ? Q : Math.abs(o) > 20 * MIN ? 5 * MIN : MIN;
      const q = Math.round((nowMs() + o) / stepQ) * stepQ;
      if (q !== retAt && performance.now() - lastEmit > 85) { retAt = q; emit(); }
    }
    const m = Math.floor(nowMs() / MIN);
    if (m !== lastMin) { lastMin = m; dirty = true; if (capOn) updateCapsule(); }
    const moving = showSp.moving || presSp.moving || travSp.moving || off.moving || active;
    if (!moving && !dirty && !wasAnim) return;
    if (blank && showSp.value < 0.004 && !showSp.moving) { dirty = false; wasAnim = false; return; }
    dirty = false;
    wasAnim = draw(dt);
  }

  /* ============================================================ Schnittstelle */
  const horizon = (V.horizon = {
    provide(id, fn) { providers.set(id, fn); stale = true; dirty = true; return () => { providers.delete(id); stale = true; }; },
    items(from, to) { return collect(from || V.time.now(), to || new Date(V.time.ms() + H12)); },
    refresh() { stale = true; dirty = true; },
    get offset() { return curOffset(); },
    get active() { return active; },
    at() { return new Date(atMs()); },
    describe,
    /** zu einem Zeitpunkt reisen (Date oder ms-Versatz), dort kurz bleiben, dann zurückfedern */
    travel(to, o = {}) {
      if (!layer || V.shell.mode !== 'home') return false;
      let ms = to instanceof Date ? to.getTime() : nowMs() + Number(to || 0);
      ms = U.clamp(Math.round(ms / MIN) * MIN, nowMs() + PAST, nowMs() + FUTURE);
      if (Math.abs(ms - nowMs()) < MIN) return false;
      begin();
      dragging = false;
      setTarget(ms, V.motion.gentle);
      const hold = o.hold !== undefined ? o.hold : 5200;
      holdT = setTimeout(startReturn, 900 + hold);
      attention(900 + hold + 2500);
      return true;
    },
    back() { startReturn(); },
  });
  V.time.view = () => (active ? new Date(nowMs() + curOffset()) : V.time.now());

  /* ================================================================== Start */
  V.on('boot:ready', () => {
    mount();
    V.loop.add(frame, 5);
    V.shell.hooks.homeCrown = crown;
    // Antippen während der Zeitreise: sofort zurück ins Jetzt
    V.shell.hooks.tap.unshift((p) => {
      if (!active || dragging || V.shell.mode !== 'home') return false;
      if (p.y > 868 && Math.abs(p.x - 500) < 175) return false;
      startReturn();
      return true;
    });
    // Rand berühren → präsent
    const el = V.display.el;
    el.addEventListener('pointerdown', (e) => {
      if (V.shell.mode !== 'home') return;
      const p = V.display.toLogical(e.clientX, e.clientY);
      const r = Math.hypot(p.x - 500, p.y - 500);
      if (r < 395 || (p.y > 868 && Math.abs(p.x - 500) < 175)) return;
      touching = true;
    }, true);
    const up = () => { if (touching) { touching = false; attention(2600); } };
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);

    V.on('face:changed', readCfg);
    V.on('display:resize', size);
    V.on('ambient', (on) => { if (!on) attention(4800); dirty = true; });
    V.on('boot:home', () => attention(5200));
    V.on('shell:mode', (m) => { if (m !== 'home' && active) finish(true); dirty = true; });
    for (const ev of ['calendar:changed', 'alarm:changed', 'timer:changed', 'reminders:changed', 'time:changed', 'store:settings.location', 'store:settings.use24h']) V.on(ev, () => horizon.refresh());
    V.on('store:settings.accent', () => { dirty = true; });
    V.on('live:glyph', () => { dirty = true; });

    registerProviders();
    registerIntents();
    readCfg();
  });

  /* ============================================================== Anbieter */
  function registerProviders() {
    // Kalender: Termine als Bögen
    horizon.provide('calendar', (from, to) => {
      if (!V.info.events) return [];
      return V.info.events(from, to).map((e) => ({ start: e.start, end: e.end, kind: 'event', color: e.color || '#FF453A', icon: 'calendar', label: e.title, sub: e.place || '' }));
    });
    // Wetter: alle drei Stunden ein Zeichen, dazu Sonnenauf- und -untergang
    horizon.provide('weather', (from, to) => {
      const W = V.weather;
      if (!W || !W.at) return [];
      const out = [];
      // je Drei-Stunden-Block ein Zeichen in dessen Mitte (1:30, 4:30, 7:30, 10:30): das sind die Diagonalen
      // des Blatts – frei von Datum (oben), Visto (unten) und den Ziffern 3/9
      const d = new Date(from);
      d.setHours(Math.floor(d.getHours() / 3) * 3 + 1, 30, 0, 0);
      if (d < from) d.setHours(d.getHours() + 3);
      for (; d < to; d.setHours(d.getHours() + 3)) {
        const w = W.at(new Date(d));
        const tone = w.night && (w.code === 'clear' || w.code === 'fair') ? '#C8D2FF' : U.lighten(W.describe(w.code, w.night).color || '#FFFFFF', 0.28);
        out.push({ start: new Date(d), kind: 'weather', color: tone, icon: w.icon, label: Math.round(w.temp) + '°', sub: w.text });
      }
      if (W.sun) {
        const day = new Date(from); day.setHours(0, 0, 0, 0);
        for (; day < to; day.setDate(day.getDate() + 1)) {
          const s = W.sun(day);
          const rise = new Date(day.getTime() + s.rise * HOUR), set = new Date(day.getTime() + s.set * HOUR);
          if (rise >= from && rise < to) out.push({ start: rise, kind: 'sun', color: '#FFC46B', icon: 'sunrise', label: 'Sonnenaufgang', sub: V.fmt.time(rise) });
          if (set >= from && set < to) out.push({ start: set, kind: 'sun', color: '#FF9E6B', icon: 'sunset', label: 'Sonnenuntergang', sub: V.fmt.time(set) });
        }
      }
      return out;
    });
    // Wecker
    horizon.provide('alarm', (from, to) => {
      if (!V.info.alarms) return [];
      return V.info.alarms(from, to).map((a) => ({ start: a.date, kind: 'alarm', color: '#FF6B3D', icon: 'alarm', label: a.label || 'Wecker', sub: V.fmt.time(a.date) }));
    });
    // Timer: wann er abläuft
    horizon.provide('timer', (from, to) => {
      if (!V.info.timers) return [];
      return V.info.timers().filter((t) => !t.paused && t.end >= from && t.end < to)
        .map((t) => ({ start: t.end, kind: 'timer', color: '#FF9F0A', icon: 'timer', label: t.label || 'Timer', sub: 'endet ' + V.fmt.time(t.end) }));
    });
    // Erinnerungen mit Zeitpunkt
    horizon.provide('reminders', (from, to) => {
      if (!V.info.reminders) return [];
      return V.info.reminders(from, to).map((r) => ({ start: r.at, kind: 'reminder', color: '#FF9500', icon: 'list', label: r.text, sub: V.fmt.time(r.at) }));
    });
  }

  /* ================================================================= Visto */
  function registerIntents() {
    if (!V.brain || !V.brain.intent) return;
    const B = '(?<![a-zäöüß])', E = '(?![a-zäöüß])';
    const OTHER = new RegExp(B + '(wetter|regen|regnet|timer|wecker|weck|erinner\\w*|termin\\w*|stell\\w*|musik|licht)' + E);
    const ASK = new RegExp('^(und )?(was|wie)( ist| passiert| kommt| steht an| sieht es aus| ist los| wird)' + E);
    const TRAVEL = new RegExp(B + '(zeitreise|zeit ?vor|spule?|dreh\\w* die zeit|zeig\\w* (mir )?(die zeit|den horizont|meinen tag))' + E);
    V.brain.intent({
      id: 'horizon-travel', priority: 8,
      match(t) {
        const travel = TRAVEL.test(t);
        if (!travel && (!ASK.test(t) || OTHER.test(t))) return null;
        const back = new RegExp(B + '(zurück|vorhin|vor \\d+ (stunden?|minuten?))' + E).test(t) && !/\bin \d/.test(t);
        let date = null;
        const dur = /\b(in|vor|um) (\d|eine|1 |anderthalb)|\d+ (stunden?|minuten?|std|min)\b/.test(t) && !/\b(um|uhr)\b/.test(t) ? V.brain.parseDuration(t) : null;
        if (dur) date = new Date(V.time.ms() + (back ? -1 : 1) * dur * 1000);
        else { const p = V.brain.parseTime(t); if (p) date = p.date; }
        if (!date && /\bheute abend\b/.test(t)) { date = V.time.now(); date.setHours(19, 0, 0, 0); }
        if (!date && /\bmorgen früh\b/.test(t)) { date = V.time.now(); date.setDate(date.getDate() + 1); date.setHours(8, 0, 0, 0); }
        if (!date) return travel ? { date: null } : null;
        return { date };
      },
      run(m) {
        if (!m.date) return { say: 'Dreh einfach am Rand des Zifferblatts – so spulst du die Zeit vor und zurück.', card: { type: 'icon', icon: 'clock', color: accent(), title: 'Zeitreise', sub: 'Am Rand drehen' } };
        const now = V.time.ms();
        const ms = U.clamp(m.date.getTime(), now + PAST, now + FUTURE);
        const d = new Date(ms);
        const info = describe(d);
        const day = dayWord(d);
        const when = (day ? day + ' um ' : 'Um ') + V.fmt.time(d) + ' Uhr';
        const parts = [];
        if (info.weather) parts.push(Math.round(info.weather.temp) + ' Grad, ' + info.weather.text.toLowerCase());
        const ev = info.current[0];
        let tail = '';
        if (ev) tail = ev.kind === 'event' ? ` Dann läuft „${ev.label}“.` : ev.kind === 'alarm' ? ' Dann klingelt dein Wecker.' : ` Dann: ${ev.label}.`;
        else if (info.next && info.next.start - d < 3 * HOUR && info.next.kind === 'event') tail = ` Danach kommt „${info.next.label}“ um ${V.fmt.time(info.next.start)}.`;
        else tail = ' Du hast dann nichts vor.';
        // nach dem Gespräch die Zeit sichtbar dorthin drehen
        V.once('convo:closed', () => { if (V.shell.mode === 'home') setTimeout(() => horizon.travel(d, { hold: 5200 }), 250); });
        return {
          say: when + (parts.length ? ': ' + parts.join(', ') + '.' : '.') + tail,
          card: { type: 'big', text: V.fmt.time(d), sub: relText(ms - now) + (info.weather ? ' · ' + Math.round(info.weather.temp) + '°' : '') + (ev ? ' · ' + ev.label : '') },
        };
      },
    });
  }
})();
