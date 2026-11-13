/* VistoOS · apps/calendar.js — Kalender mit „Tagesring“
 *
 *  Der Rand ist der Tag. 24 h: 12 Uhr oben, Mitternacht unten (die Nacht liegt in der Visto-Zone,
 *  der Tag oben). 12 h: ein halber Tag wie auf dem Zifferblatt (0–12 bzw. 12–24 Uhr).
 *  Termine leuchten als Bögen im Ring, ihr Titel läuft am Bogen entlang, die Uhrzeit ist ein
 *  glühender Zeiger. Die Mitte zeigt den nächsten Termin groß.
 *
 *  Bedienung:  Bogen (oder Mitte) antippen → Details, der Ring dreht den Termin nach oben
 *              Wischen ← → oder am Rand drehen → anderer Tag (in Details: nächster Termin)
 *              „+“ → neuer Termin: am Rand ziehen setzt die Zeit, Kreise unten die Art
 *  Dienste:    V.info.nextEvent() → {title, start: Date, end: Date, color}
 *              Hinweis (V.notify.banner) 10 Minuten vor jedem Termin
 *  Aktionen:   calendar.add {title, start, minutes} · calendar.list {day} · calendar.remove {title}
 *  Daten:      V.store.app('calendar') = {events:[{id, title, start, end, cat, color, place, demo}], notified, mode}
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#FF453A';
  const MIN = 60e3, HOUR = 3600e3, DAY = 864e5;
  const TAU = Math.PI * 2;
  const R = 471;            // Mittellinie des Tagesrings (logisch)
  const BAND = 38;          // Breite des Rings
  const LANE = 42;          // überlappende Termine rücken nach innen
  const LABEL_R = 425;      // Titel am Bogen
  const DATE_R = 372;       // Datum oben
  const FONT = "'Inter Tight', system-ui, sans-serif";
  const LABEL_FONT = '620 23px ' + FONT;
  const HOUR_FONT = '650 19px ' + FONT;

  V.icon.add('cal-phone', '<path d="M6.6 3.5h2.6l1.6 4.2-2 1.4a11.5 11.5 0 0 0 6.1 6.1l1.4-2 4.2 1.6v2.6a2.1 2.1 0 0 1-2.3 2.1A16.8 16.8 0 0 1 4.5 5.8a2.1 2.1 0 0 1 2.1-2.3z"/>');

  const CATS = {
    event: { name: 'Termin', color: COLOR, icon: 'calendar' },
    work: { name: 'Meeting', color: '#5AA2FF', icon: 'desk' },
    call: { name: 'Anruf', color: '#3DDC84', icon: 'cal-phone' },
    food: { name: 'Essen', color: '#FFA53D', icon: 'coffee' },
    sport: { name: 'Sport', color: '#45D3F2', icon: 'heartbeat' },
    health: { name: 'Arzt', color: '#FF6B8A', icon: 'heart' },
    leisure: { name: 'Freizeit', color: '#B98CFF', icon: 'star' },
  };
  const PICK = ['event', 'work', 'call', 'food', 'sport', 'health'];
  const DURS = [15, 30, 45, 60, 90, 120, 180];

  function guessCat(title) {
    const t = String(title || '').toLowerCase();
    if (/arzt|ärztin|praxis|physio|zahn|klinik|impf/.test(t)) return 'health';
    if (/meeting|besprechung|call|review|planung|kunde|präsentation|workshop|interview|sync|stand-?up|team|konferenz/.test(t)) return 'work';
    if (/anruf|telefon|anrufen/.test(t)) return 'call';
    if (/essen|mittag|frühstück|brunch|kaffee|dinner|restaurant|café|kochen/.test(t)) return 'food';
    if (/yoga|sport|laufen|joggen|training|fitness|gym|fußball|schwimmen|tennis|radfahren|pilates/.test(t)) return 'sport';
    if (/kino|konzert|party|geburtstag|theater|ausflug|urlaub|freunde|museum/.test(t)) return 'leisure';
    return 'event';
  }

  /* ------------------------------------------------------------ Daten */
  let S = null;
  function st() {
    if (!S) S = V.store.app('calendar', { events: [], notified: {}, mode: '24', seeded: 0 });
    return S;
  }
  const now = () => V.time.ms();
  function day0(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return day0(d.getTime()); }
  function todayD0() { return day0(now()); }
  function atDay(off, h, m) { const d = new Date(todayD0()); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d.getTime(); }
  function hourOf(d0, h) { const d = new Date(d0); d.setHours(h, 0, 0, 0); return d.getTime(); }

  // [Tag, Std, Min, Dauer, Titel, Art, Ort]
  const SEED = [
    [-1, 9, 30, 60, 'Team-Meeting', 'work', 'Raum Elbe'],
    [-1, 19, 0, 150, 'Geburtstag Max', 'leisure', 'Bei Max'],
    [0, 7, 30, 45, 'Laufen im Park', 'sport', 'Tiergarten'],
    [0, 10, 0, 60, 'Team-Meeting', 'work', 'Raum Elbe'],
    [0, 12, 30, 75, 'Mittag mit Lea', 'food', 'Café Lumen'],
    [0, 15, 0, 45, 'Design-Review', 'work', 'Videocall'],
    [0, 18, 30, 60, 'Yoga', 'sport', 'Studio Mitte'],
    [1, 9, 15, 45, 'Zahnarzt', 'health', 'Dr. Weber'],
    [1, 11, 0, 90, 'Sprint-Planung', 'work', 'Raum Spree'],
    [1, 19, 30, 150, 'Kino mit Sam', 'leisure', 'Delphi'],
    [2, 8, 0, 30, 'Anruf mit Jonas', 'call', 'Telefon'],
    [2, 13, 0, 60, 'Kundentermin', 'work', 'Agentur Nord'],
    [2, 19, 0, 120, 'Abendessen bei Oma', 'food', 'Pankow'],
    [3, 10, 0, 60, 'Team-Meeting', 'work', 'Raum Elbe'],
    [3, 17, 0, 30, 'Paket abholen', 'event', 'Packstation'],
    [3, 18, 30, 60, 'Yoga', 'sport', 'Studio Mitte'],
    [4, 14, 0, 45, 'Friseur', 'event', 'Salon Schnitt'],
    [5, 11, 0, 120, 'Brunch mit Freunden', 'food', 'Markthalle'],
    [6, 16, 0, 90, 'Fußball', 'sport', 'Sportplatz'],
  ];

  function seed() {
    const s = st();
    s.events = s.events.filter((e) => !e.demo);
    for (const [off, h, m, dur, title, cat, place] of SEED) {
      const start = atDay(off, h, m);
      s.events.push({ id: U.uid('ev'), title, start, end: start + dur * MIN, cat, color: CATS[cat].color, place, demo: true });
    }
    // ein Termin kurz nach jetzt – damit die Mitte „in 25 Min.“ zeigen kann
    const t = Math.ceil((now() + 25 * MIN) / (5 * MIN)) * 5 * MIN;
    const end = t + 20 * MIN;
    const free = !s.events.some((e) => e.start < end + 15 * MIN && e.end > t - 15 * MIN);
    if (free && day0(t) === todayD0() && new Date(t).getHours() >= 7 && new Date(end).getHours() < 22) {
      s.events.push({ id: U.uid('ev'), title: 'Anruf mit Mama', start: t, end, cat: 'call', color: CATS.call.color, place: 'Videoanruf', demo: true });
    }
    s.seeded = now();
    V.store.save();
  }
  function ensureSeed() {
    const s = st();
    if (!s.seeded || now() - s.seeded > 6 * DAY || now() < s.seeded - DAY) seed();
  }

  function sorted() { return st().events.slice().sort((a, b) => a.start - b.start || a.end - b.end); }
  function eventsIn(t0, t1) { return sorted().filter((e) => e.end > t0 && e.start < t1); }
  function eventsOfDay(d0) { return eventsIn(d0, addDays(d0, 1)); }
  function nextEvent(from, horizon = 7 * DAY) { from = from || now(); return sorted().find((e) => e.start > from && e.start < from + horizon) || null; }
  function byId(id) { return st().events.find((e) => e.id === id) || null; }

  function addEvent(o) {
    const cat = o.cat && CATS[o.cat] ? o.cat : guessCat(o.title);
    const ev = { id: U.uid('ev'), title: String(o.title || 'Termin').slice(0, 60), start: o.start, end: o.end, cat, color: o.color || CATS[cat].color, place: o.place || '' };
    st().events.push(ev);
    V.store.save();
    V.emit('calendar:changed', { added: ev.id });
    return ev;
  }
  function removeEvent(id) {
    const s = st();
    s.events = s.events.filter((e) => e.id !== id);
    delete s.notified[id];
    V.store.save();
    V.emit('calendar:changed', { removed: id });
  }

  /* ---------------------------------------------------------- Formate */
  const tm = (ms) => V.fmt.time(new Date(ms));
  function durWords(min) {
    min = Math.round(min);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' Min.';
    return h + ' Std.' + (m ? ' ' + m + ' Min.' : '');
  }
  function relIn(ms) {
    const m = Math.round(ms / MIN);
    if (m <= 0) return 'jetzt';
    if (m < 60) return 'in ' + m + ' Min.';
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 5 && r >= 5) return 'in ' + h + ' Std. ' + r + ' Min.';
    return 'in ' + Math.round(m / 60) + ' Std.';
  }
  function dayDiff(ms) { return Math.round((day0(ms) - todayD0()) / DAY); }
  /** für Sätze: „heute“, „morgen“, „am Montag“, „am 24. November“ */
  function whenWords(ms) {
    const d = dayDiff(ms);
    if (d === 0) return 'heute';
    if (d === 1) return 'morgen';
    if (d === 2) return 'übermorgen';
    if (d === -1) return 'gestern';
    const dt = new Date(ms);
    if (d > 1 && d < 7) return 'am ' + V.fmt.weekday(dt);
    return 'am ' + dt.getDate() + '. ' + V.fmt.MON[dt.getMonth()];
  }
  function dayTitle(d0) {
    const rel = V.fmt.relDay(new Date(d0));
    const long = V.fmt.dateLong(new Date(d0));
    if (rel === 'Heute' || rel === 'Morgen' || rel === 'Gestern') return rel + ' · ' + long;
    return long;
  }
  const soft = (hex, k = 0.32) => U.mix(hex, '#ffffff', k);

  /* --------------------------------------------------- Ring-Geometrie */
  function makeView(d0, mode, half) {
    const t0 = mode === '12' ? hourOf(d0, half * 12) : d0;
    const t1 = mode === '12' ? hourOf(d0, half * 12 + 12) : addDays(d0, 1);
    return { d0, mode, half, t0, t1 };
  }
  /** Uhrwinkel eines Zeitpunkts: 24 h −180…180 (12 Uhr = 0°), 12 h 0…360 */
  function angle(view, ms) {
    const k = (ms - view.t0) / (view.t1 - view.t0);
    return view.mode === '12' ? k * 360 : -180 + k * 360;
  }
  function timeAt(view, a) {
    const k = view.mode === '12' ? U.wrap(a, 360) / 360 : U.wrap(a + 180, 360) / 360;
    return view.t0 + k * (view.t1 - view.t0);
  }
  function autoHalf(d0) {
    if (d0 === todayD0()) return new Date(now()).getHours() < 12 ? 0 : 1;
    const evs = eventsOfDay(d0);
    if (!evs.length) return 0;
    const noon = hourOf(d0, 12);
    const am = evs.filter((e) => e.start < noon).length, pm = evs.length - am;
    return am === pm ? (evs[0].start < noon ? 0 : 1) : am > pm ? 0 : 1;
  }

  /* --------------------------------------------- Text am Bogen (Canvas) */
  const mctx = document.createElement('canvas').getContext('2d');
  const wcache = new Map();
  function widths(text, font) {
    const key = font + '|' + text;
    let w = wcache.get(key);
    if (!w) {
      mctx.font = font;
      w = Array.from(text).map((ch) => mctx.measureText(ch).width);
      wcache.set(key, w);
    }
    return w;
  }
  function textWidth(text, font, spacing) {
    const w = widths(text, font);
    return w.reduce((a, b) => a + b, 0) + spacing * Math.max(0, w.length - 1);
  }
  function fitLabel(text, font, spacing, maxW) {
    if (textWidth(text, font, spacing) <= maxW) return text;
    let s = text;
    while (s.length > 2 && textWidth(s + '…', font, spacing) > maxW) s = s.slice(0, -1).trimEnd();
    return s + '…';
  }
  /** Text mittig um Uhrwinkel mid auf Radius r; untere Hälfte wird lesbar gespiegelt */
  function textOnArc(c, text, mid, r, font, spacing) {
    const chars = Array.from(text);
    const ws = widths(text, font);
    const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    const A = U.wrap(mid, 360);
    const flip = A > 92 && A < 268;
    c.font = font;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let x = -total / 2;
    for (let i = 0; i < chars.length; i++) {
      const cw = ws[i];
      const off = U.deg((x + cw / 2) / r);
      const a = flip ? mid - off : mid + off;
      const t = U.rad(a);
      c.save();
      c.translate(500 + Math.sin(t) * r, 500 - Math.cos(t) * r);
      c.rotate(flip ? t + Math.PI : t);
      c.fillText(chars[i], 0, flip ? 1 : 0);
      c.restore();
      x += cw + spacing;
    }
  }
  const crad = (a) => U.rad(a - 90);
  function arcPath(c, r, a0, a1) { c.beginPath(); c.arc(500, 500, r, crad(a0), crad(a1)); }

  /** Anordnung eines Tages: Bögen, Bahnen, Titel, Stundenmarken */
  function layout(view) {
    const lanes = [];
    const items = eventsIn(view.t0, view.t1).map((e) => {
      const s = Math.max(e.start, view.t0), en = Math.min(e.end, view.t1);
      let lane = lanes.findIndex((end) => end <= s);
      if (lane < 0) { lane = lanes.length; lanes.push(en); } else lanes[lane] = en;
      return { e, a0: angle(view, s), a1: Math.max(angle(view, en), angle(view, s) + 1.4), lane: Math.min(lane, 2) };
    });
    // Titel: nur so viele, wie ohne Überschneidung passen
    const placed = [];
    const labels = [];
    const maxLane = items.reduce((m, it) => Math.max(m, it.lane), 0);
    const lr = LABEL_R - maxLane * LANE;
    for (const it of items) {
      const mid = (it.a0 + it.a1) / 2;
      const text = fitLabel(it.e.title, LABEL_FONT, 1.2, Math.min(330, lr * U.rad(64)));
      const span = U.deg(textWidth(text, LABEL_FONT, 1.2) / lr) + 3;
      const lo = mid - span / 2, hi = mid + span / 2;
      if (placed.some((p) => lo < p.hi && hi > p.lo)) continue;
      // nicht über die Visto-Linie unten
      const A = U.wrap(mid, 360);
      if (A > 166 && A < 194) continue;
      placed.push({ lo, hi });
      labels.push({ it, text, mid, r: lr });
    }
    // Stunden: Zahl alle 3 h (24 h) bzw. jede Stunde (12 h), sonst Punkt
    const hours = [];
    const n = view.mode === '12' ? 12 : 24;
    const h0 = view.mode === '12' ? view.half * 12 : 0;
    for (let i = 0; i < n; i++) {
      const h = h0 + i;
      const ms = hourOf(view.d0, h);
      const a = angle(view, ms);
      const A = U.wrap(a, 360);
      const covered = items.some((it) => it.lane === 0 && a > it.a0 - 2.2 && a < it.a1 + 2.2);
      const bottom = A > 168 && A < 192;
      const labeled = !bottom && (view.mode === '12' ? true : h % 3 === 0);
      const hh = V.fmt.h24() ? h : h % 12 || 12;
      hours.push({ a, label: labeled ? String(hh) : null, covered });
    }
    return { view, items, labels, hours };
  }

  /* ---------------------------------------------------- Mini-Ring (Karte) */
  function miniRing(d0, big, small) {
    const view = makeView(d0, '24', 0);
    const L = layout(view);
    const svg = U.svg('svg', { viewBox: '0 0 200 200', style: 'width:21cqw;height:21cqw;display:block;overflow:visible' });
    svg.appendChild(U.svg('circle', { cx: 100, cy: 100, r: 86, fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 15 }));
    const t = now();
    for (const it of L.items) {
      const past = it.e.end <= t;
      svg.appendChild(U.svg('path', {
        d: V.ui.arcPath(100, 100, 86 - it.lane * 17, it.a0, it.a1), fill: 'none', stroke: it.e.color,
        'stroke-width': 12, 'stroke-linecap': 'round', opacity: past ? 0.35 : 1,
        style: past ? null : `filter:drop-shadow(0 0 5px ${U.rgba(it.e.color, 0.7)})`,
      }));
    }
    if (d0 === todayD0()) {
      const p = V.display.pt(angle(view, t), 86);
      const x = p.x - 400, y = p.y - 400;
      svg.appendChild(U.svg('circle', { cx: x, cy: y, r: 10, fill: 'rgba(255,255,255,.22)' }));
      svg.appendChild(U.svg('circle', { cx: x, cy: y, r: 5.5, fill: '#fff' }));
    }
    svg.appendChild(U.svg('text', { x: 100, y: 104, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 66, 'font-weight': 220, fill: '#fff', 'font-family': FONT, style: 'font-variant-numeric:tabular-nums;letter-spacing:-2px', text: big }));
    svg.appendChild(U.svg('text', { x: 100, y: 146, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'rgba(255,255,255,.5)', 'font-family': FONT, 'letter-spacing': 2.4, text: String(small).toUpperCase() }));
    return svg;
  }

  /* ----------------------------------------------------------- Dienste */
  function bannerFor(e) {
    const lead = Math.max(1, Math.round((e.start - now()) / MIN));
    V.notify.banner({
      title: e.title,
      body: (lead >= 1 ? 'In ' + lead + ' Min.' : 'Jetzt') + ' · ' + tm(e.start) + (e.place ? ' · ' + e.place : ''),
      icon: CATS[e.cat] ? CATS[e.cat].icon : 'calendar',
      color: e.color || COLOR,
      onClick: () => V.shell.open('calendar', { event: e.id }),
    });
  }
  function bgCheck() {
    if (V.shell.mode === 'setup' || V.shell.mode === 'boot') return;
    const s = st();
    const t = now();
    let changed = false;
    for (const e of s.events) {
      if (s.notified[e.id]) continue;
      const lead = e.start - t;
      if (lead <= 10 * MIN && lead > -MIN) { s.notified[e.id] = e.start; changed = true; bannerFor(e); }
    }
    // Merkliste klein halten
    for (const id in s.notified) if (s.notified[id] < t - 2 * DAY) { delete s.notified[id]; changed = true; }
    if (changed) V.store.save();
  }

  /* ---------------------------------------------- Sprache: Zeit & Titel */
  const NUMW = '(?:\\d{1,2}|eins?|eine[nmr]?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|dreißig|vierzig|fünfzig|einundzwanzig|zweiundzwanzig|dreiundzwanzig|anderthalb|halben?)';
  const B = '(?<![\\wäöüß])', E = '(?![\\wäöüß])';
  const TIME_RX = [
    B + 'in ' + '(?:' + NUMW + ' )?(?:' + NUMW + ' )?(?:stunden?|std\\.?|minuten?|min\\.?|sekunden?|viertelstunde|dreiviertelstunde)(?: und (?:' + NUMW + ' )?(?:minuten?|sekunden?))?' + E,
    B + '(?:um )?(?:halb|viertel nach|viertel vor|dreiviertel) ' + NUMW + E,
    B + 'um ' + NUMW + '(?:[:.]\\d{2})?(?: uhr)?(?: ' + NUMW + ')?' + E,
    B + NUMW + '(?:[:.]\\d{2})? uhr(?: ' + NUMW + ')?' + E,
    B + '\\d{1,2}[:.]\\d{2}' + E,
    B + '(?:heute|morgen|übermorgen)(?: (?:früh|morgen|vormittag|mittag|nachmittag|abend|nacht))?' + E,
    B + '(?:am |nächsten |kommenden |diesen )?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?: (?:früh|vormittag|mittag|nachmittag|abend))?' + E,
    B + '(?:morgens|vormittags|mittags|nachmittags|abends|nachts)' + E,
    B + 'für ' + '(?:' + NUMW + ' )?(?:' + NUMW + ' )?(?:stunden?|minuten?|std\\.?|min\\.?)' + E,
    B + '(?:' + NUMW + ' )?(?:' + NUMW + ' )?(?:stunden?|minuten?) lang' + E,
  ].map((s) => new RegExp(s, 'gi'));
  function stripTime(s) {
    for (const rx of TIME_RX) s = s.replace(rx, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  function addTitle(original) {
    let s = ' ' + String(original).replace(/[„“"!?]/g, ' ').replace(/\.+\s*$/, '') + ' ';
    s = stripTime(s);
    const rx = (src, f) => new RegExp(src, f);
    s = s.replace(rx(B + '(?:bitte|mal|doch|bei mir)' + E, 'gi'), ' ')
      .replace(rx('^\\s*(?:trag|trage|schreib|schreibe|setz|setze|notier|notiere|leg|lege|plan|plane|erstell|erstelle|mach|mache|füg|füge)' + E + '(?: mir)?', 'i'), ' ')
      .replace(rx(B + '(?:in|im|zu|zum)\\s+(?:den |meinen |dem |meinem )?kalender' + E, 'gi'), ' ')
      .replace(rx(B + '(?:einen |ein |neuen |neuer |neue )?termine?' + E + '\\s*(?:für|mit dem titel|namens)?', 'gi'), ' ')
      .replace(rx(B + '(?:eintragen|einplanen|hinzufügen|notieren|anlegen)' + E, 'gi'), ' ')
      .replace(rx(B + '(?:ein|an|hinzu)\\s*$', 'i'), ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[:,\s]+|[:,\s]+$/g, '').replace(/^(?:für|zum|zur|beim|bei|den|die|das|der|ein|eine|einen)\s+/i, '');
    s = s.replace(/^[:,\s]+|[:,\s]+$/g, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  function dayOffsetFrom(t) {
    if (/(?<![a-zäöüß])übermorgen/.test(t)) return 2;
    if (/\bheute (morgen|früh)\b/.test(t)) return 0;
    if (/\bmorgen\b/.test(t)) return 1;
    if (/\bgestern\b/.test(t)) return -1;
    const wd = V.fmt.WD.findIndex((w) => new RegExp('(?<![a-zäöüß])' + w.toLowerCase() + '(?![a-zäöüß])').test(t));
    if (wd >= 0) return (wd - new Date(now()).getDay() + 7) % 7;
    return 0;
  }

  /* ------------------------------------------------------ Antworten */
  function joinList(arr) { return arr.length > 1 ? arr.slice(0, -1).join(', ') + ' und ' + arr[arr.length - 1] : arr[0] || ''; }
  function agenda(off) {
    const d0 = addDays(todayD0(), off);
    const t = now();
    const all = eventsOfDay(d0);
    const evs = off === 0 ? all.filter((e) => e.end > t) : all;
    const card = { type: 'el', el: miniRing(d0, String(evs.length), off === 0 ? 'offen' : evs.length === 1 ? 'Termin' : 'Termine') };
    const items = (list) => list.map((e) => tm(e.start) + ' ' + e.title);
    if (off === 0) {
      if (!evs.length) {
        const nx = nextEvent(t);
        return { say: 'Heute steht nichts mehr an.' + (nx ? ` ${whenWords(nx.start).replace(/^./, (c) => c.toUpperCase())} geht es um ${tm(nx.start)} Uhr mit ${nx.title} weiter.` : ' Genieß die freie Zeit!'), card, emotion: 'happy' };
      }
      if (evs.length === 1) return { say: `Heute steht noch ein Termin an: ${items(evs)[0]}.`, card };
      if (evs.length <= 4) return { say: `Heute stehen noch ${evs.length} Termine an: ${joinList(items(evs))}.`, card };
      return { say: `Heute stehen noch ${evs.length} Termine an. Als Nächstes: ${items(evs)[0]}.`, card };
    }
    const w = whenWords(d0);
    const W = w.charAt(0).toUpperCase() + w.slice(1);
    if (!evs.length) return { say: off < 0 ? `${W} hattest du keine Termine.` : `Nein, ${w} ist dein Kalender frei.`, card, emotion: 'happy' };
    if (off < 0) return { say: `${W} hattest du ${evs.length === 1 ? 'einen Termin' : evs.length + ' Termine'}: ${joinList(items(evs).slice(0, 4))}.`, card };
    if (evs.length === 1) return { say: `Ja, ${w} hast du einen Termin: um ${tm(evs[0].start)} Uhr ${evs[0].title}.`, card };
    return { say: `Ja, ${w} hast du ${evs.length} Termine. Der erste ist um ${tm(evs[0].start)} Uhr: ${evs[0].title}.`, card };
  }

  function parseDayArg(day) {
    if (day === undefined || day === null || day === '') return 0;
    if (typeof day === 'number' || /^-?\d+$/.test(String(day))) return Math.round(Number(day));
    const s = String(day).toLowerCase();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s.slice(0, 10) + 'T12:00'); if (!isNaN(d)) return dayDiff(d.getTime()); }
    return dayOffsetFrom(s);
  }

  /* ---------------------------------------------------------------- App */
  V.apps.register({
    id: 'calendar',
    name: 'Kalender',
    icon: 'calendar',
    color: COLOR,
    order: 50,
    keywords: ['kalender', 'termine', 'termin', 'tagesplan'],

    init() {
      ensureSeed();
      V.info.nextEvent = () => {
        const e = nextEvent(now(), 2 * DAY);
        return e ? { title: e.title, start: new Date(e.start), end: new Date(e.end), color: e.color } : null;
      };
      setInterval(bgCheck, 5000);
      V.on('time:minute', bgCheck);
      V.on('time:changed', () => { ensureSeed(); bgCheck(); });

      V.actions.register('calendar.add', {
        desc: 'Trägt einen Termin in den Kalender ein. title = Titel (z. B. „Zahnarzt“), start = Beginn als lokale ISO-Zeit (z. B. 2026-11-14T10:00), minutes = Dauer in Minuten (Standard 60).',
        params: { title: { type: 'string' }, start: { type: 'string', description: 'ISO-Zeit, lokal' }, minutes: { type: 'number', description: 'Dauer in Minuten' } },
        required: ['title', 'start'],
        run(a) {
          const d = new Date(a.start);
          if (isNaN(d)) return { say: 'Diese Uhrzeit habe ich nicht verstanden.', emotion: 'confused' };
          const minutes = U.clamp(Math.round(Number(a.minutes) || 60), 5, 24 * 60);
          const e = addEvent({ title: String(a.title || 'Termin'), start: d.getTime(), end: d.getTime() + minutes * MIN });
          const when = whenWords(e.start);
          return {
            say: `Erledigt: ${e.title}, ${when} um ${tm(e.start)} Uhr.`,
            card: { type: 'icon', icon: CATS[e.cat].icon, color: e.color, title: e.title, sub: when.replace(/^./, (c) => c.toUpperCase()) + ' · ' + tm(e.start) + '–' + tm(e.end) },
            emotion: 'happy',
          };
        },
      });
      V.actions.register('calendar.list', {
        desc: 'Listet die Termine eines Tages. day = Tagesversatz (0 = heute, 1 = morgen, −1 = gestern) oder ein Datum (JJJJ-MM-TT). Für heute nur die noch offenen.',
        params: { day: { type: 'string', description: '0, 1, -1 … oder JJJJ-MM-TT' } },
        run(a) { return agenda(parseDayArg(a.day)); },
      });
      V.actions.register('calendar.remove', {
        desc: 'Löscht den nächsten Termin, dessen Titel title enthält.',
        params: { title: { type: 'string' } },
        required: ['title'],
        run(a) {
          const q = String(a.title || '').toLowerCase().trim();
          const t = now();
          const hit = sorted().filter((e) => e.title.toLowerCase().includes(q)).sort((x, y) => (x.end < t) - (y.end < t) || x.start - y.start)[0];
          if (!q || !hit) return { say: 'Diesen Termin finde ich nicht.', emotion: 'confused' };
          removeEvent(hit.id);
          return { say: `Gelöscht: ${hit.title}, ${whenWords(hit.start)} um ${tm(hit.start)} Uhr.` };
        },
      });

      V.brain.intent({
        id: 'cal-add', priority: 8.6,
        match: (t) => {
          if (/erinner|merk/.test(t)) return null;
          if (/^(?:habe?|hab|hast|gibt|ist|sind|was|wann|wie|wo|welche[rn]?)\b/.test(t)) return null;
          const add = /^(?:bitte )?(?:trag|trage|schreib|schreibe|setz|setze|leg|lege|plan|plane|füg|füge)\b.*\b(?:ein|an|hinzu)$/.test(t)
            || /(?<![a-zäöüß])(?:eintragen|einplanen)(?![a-zäöüß])/.test(t)
            || /\b(?:neuer|neuen|einen) termin\b/.test(t)
            || /\b(?:in den|in meinen) kalender\b/.test(t);
          return add ? { add: true } : null;
        },
        run(m, t, original) {
          const p = V.brain.parseTime(t);
          const title = addTitle(original) || 'Termin';
          if (!p) return { say: `Wann soll ich „${title}“ eintragen?`, emotion: 'confused' };
          let minutes = 60;
          const dm = t.match(/\bfür\s+((?:\d+(?:\.\d+)?|eine?n?|anderthalb)\s*(?:halbe\s*)?(?:stunden?|minuten?|std|min)\b)/) || t.match(/\b((?:\d+(?:\.\d+)?|eine?n?|anderthalb)\s*(?:stunden?|minuten?))\s+lang\b/);
          if (dm) { const s = V.brain.parseDuration(dm[1]); if (s) minutes = Math.round(s / 60); }
          return V.actions.run('calendar.add', { title, start: new Date(p.date).toISOString(), minutes });
        },
      });
      V.brain.intent({
        id: 'cal-next', priority: 8.3,
        match: [/\b(?:nächste[rn]?|kommende[rn]?) termin\b/, /\bwann ist (?:mein |der )?nächste[rn]? termin\b/],
        run() {
          const e = nextEvent(now(), 14 * DAY);
          if (!e) return { say: 'In den nächsten zwei Wochen steht nichts an.', emotion: 'happy' };
          const when = whenWords(e.start);
          const soon = e.start - now() < 3 * HOUR ? ` – ${relIn(e.start - now()).replace('Min.', 'Minuten').replace('Std.', 'Stunden')}` : '';
          return { say: `Dein nächster Termin: ${e.title}, ${when} um ${tm(e.start)} Uhr${soon}.`, card: { type: 'icon', icon: CATS[e.cat] ? CATS[e.cat].icon : 'calendar', color: e.color, title: e.title, sub: when.replace(/^./, (c) => c.toUpperCase()) + ' · ' + tm(e.start) } };
        },
      });
      V.brain.intent({
        id: 'cal-agenda', priority: 8.2,
        match: [
          /\bwas steht\b.*\ban$/,
          /\bwas steht (?:heute|morgen|übermorgen)\b/,
          /\b(?:habe?|hab) ich\b.*\b(?:termine?|was vor|etwas vor|verabredungen?)\b/,
          /\b(?:meine|welche|alle) termine\b/,
          /\btermine?\b.*(?:heute|morgen|gestern|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/,
          /(?:heute|morgen|gestern)\b.*\btermine?\b/,
          /\bwas (?:habe|hab) ich (?:heute |morgen |übermorgen )?(?:noch )?vor\b/,
          /\bwie (?:sieht|ist) (?:mein|der) (?:tag|kalender)\b/,
        ],
        run(m, t) { return agenda(dayOffsetFrom(t)); },
      });
    },

    create(ctx) {
      ensureSeed();
      const s = st();
      const root = ctx.root;
      root.classList.add('cal-root');
      root.setAttribute('data-nogesture', 'all');

      /* -------- Ebenen: Ring (Canvas) · Zeiger (SVG) · Datum · Mitte */
      const cv = U.el('canvas', { class: 'cal-cv' });
      const c = cv.getContext('2d');
      let W = 1000, k = 1;
      function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(200, Math.round(V.display.size * dpr));
        cv.width = cv.height = W;
        k = W / 1000;
        dirty = true;
      }
      const gid = U.uid('calg');
      const needle = U.svg('svg', { class: 'vos-svg cal-now', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      needle.innerHTML = `<defs><linearGradient id="${gid}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <radialGradient id="${gid}h"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${COLOR}" stop-opacity=".55"/><stop offset="1" stop-color="${COLOR}" stop-opacity="0"/></radialGradient></defs>
        <g class="cal-now-g"><rect x="498.3" y="${500 - R - 16}" width="3.4" height="48" rx="1.7" fill="url(#${gid}n)" opacity=".9"/>
        <circle class="cal-halo" cx="500" cy="${500 - R}" r="30" fill="url(#${gid}h)"/>
        <circle cx="500" cy="${500 - R}" r="8.5" fill="#fff"/></g>`;
      const needleG = needle.querySelector('.cal-now-g');
      const date = V.ui.arcText({ text: '', r: DATE_R, size: 24, weight: 680, spacing: 4.2, color: 'rgba(255,255,255,.62)' });
      date.el.classList.add('cal-date');
      const mid = U.el('div', { class: 'cal-mid' });
      root.append(cv, needle, date.el, mid);

      /* -------- Zustand */
      let mode = s.mode === '12' ? '12' : '24';
      let viewDay = todayD0();
      let half = autoHalf(viewDay);
      let cur = layout(makeView(viewDay, mode, half));
      let prev = null, transDir = 0, prevRot = 0;
      let state = 'day';                 // day | detail | add
      let selId = null, centerEv = null;
      let draft = null;
      let dirty = true;
      let growClock = 0, popId = null, popClock = 9;
      let page = null, crownAcc = 0;
      const mark = () => { dirty = true; };
      const trans = V.spring(1, { response: 0.55, bounce: 0.1 }).onUpdate(mark);
      const rot = V.spring(0, { response: 0.42, bounce: 0.12 }).onUpdate(mark);
      const focus = V.spring(0, { response: 0.62, bounce: 0.12 }).onUpdate(mark);
      const selK = V.spring(0, { response: 0.4, bounce: 0 }).onUpdate(mark);

      size();
      ctx.on('display:resize', size);
      if (document.fonts && document.fonts.load) document.fonts.load(LABEL_FONT).then(() => { wcache.clear(); cur = layout(cur.view); mark(); }).catch(() => {});

      function rebuild() { cur = layout(makeView(viewDay, mode, half)); mark(); }
      /** Datum am Bogen – kurz ausblenden, Text tauschen, einblenden */
      let dateT = 0;
      function setDate(text, color) {
        const fill = color || 'rgba(255,255,255,.62)';
        if (date.tp.textContent === String(text).toUpperCase() && date.text.getAttribute('fill') === fill) return;
        clearTimeout(dateT);
        if (!date.tp.textContent) { date.set(text); date.text.setAttribute('fill', fill); return; }
        date.el.style.opacity = '0';
        dateT = setTimeout(() => { date.set(text); date.text.setAttribute('fill', fill); date.el.style.opacity = '1'; }, 160);
      }
      ctx.cleanup(() => clearTimeout(dateT));

      /* -------- Zeichnen */
      function grow(i) { return V.ease.smooth(U.clamp((growClock - 0.12 - i * 0.07) / 0.7, 0, 1)); }

      function drawLayer(L, alpha, off) {
        if (alpha <= 0.004) return;
        const view = L.view;
        const t = now();
        const isToday = view.d0 === todayD0();
        c.globalAlpha = alpha;
        // Tagesfortschritt: der vergangene Teil des Rings glimmt
        if (isToday && t > view.t0) {
          const a0 = angle(view, view.t0) + off, a1 = angle(view, Math.min(t, view.t1)) + off;
          if (a1 - a0 > 0.3) {
            let style = 'rgba(255,255,255,.07)';
            if (c.createConicGradient && a1 - a0 < 359.5) {
              const g = c.createConicGradient(crad(a0), 500, 500);
              const f = (a1 - a0) / 360;
              g.addColorStop(0, 'rgba(255,255,255,0)');
              g.addColorStop(Math.max(0.0001, f), 'rgba(255,255,255,.13)');
              g.addColorStop(Math.min(1, f + 0.0001), 'rgba(255,255,255,0)');
              style = g;
            }
            c.strokeStyle = style;
            c.lineWidth = BAND;
            c.lineCap = 'butt';
            arcPath(c, R, a0, a1);
            c.stroke();
          }
        }
        // Stunden
        c.font = HOUR_FONT;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (const h of L.hours) {
          if (h.covered) continue;
          const p = V.display.pt(h.a + off, R);
          if (h.label) {
            c.fillStyle = 'rgba(255,255,255,.46)';
            c.fillText(h.label, p.x, p.y + 0.5);
          } else {
            c.fillStyle = 'rgba(255,255,255,.26)';
            c.beginPath(); c.arc(p.x, p.y, 2.6, 0, TAU); c.fill();
          }
        }
        // Termine
        const sel = state === 'add' ? '__draft' : selId;
        L.items.forEach((it, i) => {
          const g = popId === it.e.id ? V.ease.smooth(U.clamp(popClock / 0.6, 0, 1)) : grow(i);
          if (g <= 0) return;
          const e = it.e;
          const a0 = it.a0 + off;
          const a1 = a0 + (it.a1 - it.a0) * g;
          const r = R - it.lane * LANE;
          let w = BAND - 10;
          let al = alpha * (e.end <= t ? 0.38 : 1);
          if (sel) { if (sel === e.id) w += 7 * selK.value; else al *= 1 - 0.72 * selK.value; }
          c.lineCap = 'round';
          c.globalAlpha = al;
          c.strokeStyle = e.color;
          c.lineWidth = w;
          c.shadowColor = U.rgba(e.color, e.end <= t ? 0.3 : 0.85);
          c.shadowBlur = (e.end <= t ? 8 : 22) * k;
          // laufender Termin: vergangener Teil gedämpft
          if (e.start < t && e.end > t && isToday) {
            const an = U.clamp(angle(L.view, t) + off, a0, a1);
            c.globalAlpha = al * 0.5;
            arcPath(c, r, a0, an); c.stroke();
            c.globalAlpha = al;
            arcPath(c, r, an, a1); c.stroke();
          } else {
            arcPath(c, r, a0, a1); c.stroke();
          }
          c.shadowBlur = 0;
          // Glanzkante
          c.globalAlpha = al * 0.4;
          c.strokeStyle = '#ffffff';
          c.lineWidth = 2;
          arcPath(c, r + w * 0.24, a0 + 0.35, a1 - 0.35);
          c.stroke();
        });
        // Titel am Bogen
        L.labels.forEach((lb) => {
          const i = L.items.indexOf(lb.it);
          const g = popId === lb.it.e.id ? U.clamp(popClock / 0.6, 0, 1) : grow(i);
          if (g <= 0.05) return;
          const e = lb.it.e;
          let al = alpha * U.smoothstep(0.3, 1, g) * (e.end <= t ? 0.42 : 0.95);
          if (sel && sel !== e.id) al *= 1 - (sel === '__draft' ? 1 : 0.75) * U.clamp(selK.value, 0, 1);
          if (al <= 0.01) return;
          c.globalAlpha = al;
          c.fillStyle = soft(e.color, 0.35);
          textOnArc(c, lb.text, lb.mid + off, lb.r, LABEL_FONT, 1.2);
        });
        c.globalAlpha = 1;
      }

      function drawDraft(off, tt) {
        if (!draft) return;
        const view = cur.view;
        const cat = CATS[draft.cat];
        const s0 = U.clamp(draft.start, view.t0, view.t1), s1 = U.clamp(draft.start + draft.dur * MIN, view.t0, view.t1);
        const a0 = angle(view, s0) + off, a1 = Math.max(angle(view, s1) + off, a0 + 1.4);
        const pulse = 0.72 + 0.28 * Math.sin(tt * 3.4);
        const al = U.clamp(selK.value, 0, 1);
        c.lineCap = 'round';
        c.globalAlpha = al * pulse;
        c.strokeStyle = cat.color;
        c.lineWidth = BAND - 4;
        c.shadowColor = cat.color;
        c.shadowBlur = 26 * k;
        arcPath(c, R, a0, a1); c.stroke();
        c.shadowBlur = 0;
        // Griff am Anfang
        const p = V.display.pt(a0, R);
        c.globalAlpha = al;
        c.fillStyle = '#fff';
        c.shadowColor = cat.color; c.shadowBlur = 18 * k;
        c.beginPath(); c.arc(p.x, p.y, 13, 0, TAU); c.fill();
        c.shadowBlur = 0;
        c.fillStyle = cat.color;
        c.beginPath(); c.arc(p.x, p.y, 5, 0, TAU); c.fill();
        c.globalAlpha = al * 0.95;
        c.fillStyle = soft(cat.color, 0.35);
        textOnArc(c, cat.name, (a0 + a1) / 2, LABEL_R, LABEL_FONT, 1.2);
        c.globalAlpha = 1;
      }

      function draw(tt) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, W, W);
        c.setTransform(k, 0, 0, k, 0, 0);
        // Grund des Rings
        c.globalAlpha = 1;
        c.lineCap = 'butt';
        c.strokeStyle = 'rgba(255,255,255,.055)';
        c.lineWidth = BAND;
        c.beginPath(); c.arc(500, 500, R, 0, TAU); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.05)';
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(500, 500, R - BAND / 2 - 9, 0, TAU); c.stroke();
        const base = rot.value + focus.value;
        const p = U.clamp(trans.value, 0, 1.2);
        if (prev && p < 1) drawLayer(prev, U.clamp(1 - p * 1.25, 0, 1), prevRot + transDir * 34 * p);
        drawLayer(cur, U.clamp(p * 1.15 - 0.1, 0, 1), base - transDir * 34 * (1 - trans.value));
        if (state === 'add' || (draft && selK.value > 0.01)) drawDraft(base, tt);
      }

      function pointer() {
        const t = now();
        const view = cur.view;
        const vis = view.d0 === todayD0() && t >= view.t0 && t < view.t1 ? 1 : 0;
        const pv = prev && prev.view.d0 === todayD0() && t >= prev.view.t0 && t < prev.view.t1 ? 1 : 0;
        const p = U.clamp(trans.value, 0, 1);
        const op = vis * U.clamp(p * 1.15 - 0.1, 0, 1) + (prev && p < 1 ? pv * U.clamp(1 - p * 1.25, 0, 1) : 0);
        const a = vis || !prev ? angle(view, t) + rot.value + focus.value - transDir * 34 * (1 - trans.value) : angle(prev.view, t) + prevRot + transDir * 34 * p;
        needleG.setAttribute('transform', `rotate(${a.toFixed(2)} 500 500)`);
        needle.style.opacity = (op * (state === 'add' ? 1 - 0.7 * selK.value : 1)).toFixed(3);
      }

      ctx.onFrame((dt, tt) => {
        if (growClock < 3) { growClock += dt; dirty = true; }
        if (popClock < 1) { popClock += dt; dirty = true; }
        if (state === 'add' || selK.moving) dirty = true;
        if (dirty) { dirty = false; draw(tt); }
        pointer();
      });
      ctx.on('time:minute', () => {
        if (viewDay === todayD0() || prev) rebuild();
        if (state === 'day' && page) fillDay(page);
        if (state === 'detail' && page && page._ev) fillDetail(page, page._ev);
      });
      ctx.on('calendar:changed', (d) => {
        rebuild();
        if (selId && !byId(selId)) { state = 'day'; selId = null; focus.to(0); selK.to(0); swapPage(dayPage(), 0); return; }
        if (d && d.added) { popId = d.added; popClock = 0; }
        if (state === 'day' && page) fillDay(page);
      });

      /* -------- Mitte: Seiten mit Federübergang */
      function swapPage(nu, dir, fromX) {
        const old = page;
        page = nu;
        for (const ch of Array.from(mid.children)) if (ch !== old) ch.remove();
        mid.appendChild(nu);
        if (old) old.classList.add('cal-old');
        const ox = fromX !== undefined ? fromX : old && old._x ? old._x : 0;
        const sp = V.spring(0, { response: 0.5, bounce: 0.1 });
        sp.onUpdate((v) => {
          if (dir) {
            nu.style.transform = `translateX(${((1 - v) * dir * 30).toFixed(2)}cqw)`;
            nu.style.opacity = U.clamp(v * 1.3 - 0.15, 0, 1).toFixed(3);
            if (old) { old.style.transform = `translateX(${(ox - v * dir * 30).toFixed(2)}cqw)`; old.style.opacity = U.clamp(1 - v * 1.7, 0, 1).toFixed(3); }
          } else {
            nu.style.transform = `scale(${(0.9 + 0.1 * v).toFixed(4)})`;
            nu.style.opacity = U.clamp(v * 1.2, 0, 1).toFixed(3);
            if (old) { old.style.transform = `scale(${(1 + 0.08 * v).toFixed(4)})`; old.style.opacity = U.clamp(1 - v * 2, 0, 1).toFixed(3); }
          }
        });
        nu.style.opacity = '0';
        sp.to(1).then(() => { if (old && old !== page) old.remove(); nu.style.transform = ''; });
      }

      function el(cls, text) { return U.el('div', { class: cls, text }); }

      function dayPage() {
        const pg = U.el('div', { class: 'cal-page' });
        pg._kick = el('cal-kick');
        pg._big = el('cal-big vos-num');
        pg._ttl = el('cal-ttl');
        pg._sub = el('cal-sub');
        const row = U.el('div', { class: 'cal-row' });
        const modeChip = U.el('button', { class: 'cal-chip', attrs: { type: 'button', 'aria-label': 'Ansicht umschalten' } });
        modeChip.textContent = mode === '24' ? '24 h' : half ? '12–24 Uhr' : '0–12 Uhr';
        V.ui.tap(modeChip, cycleMode);
        const plus = V.ui.roundButton('plus', { kind: 'sm', label: 'Neuer Termin', cls: 'cal-plus', onClick: openAdd });
        row.append(modeChip, plus);
        if (viewDay !== todayD0()) {
          const back = U.el('button', { class: 'cal-chip', attrs: { type: 'button' }, text: 'Heute' });
          V.ui.tap(back, () => goDay(todayD0()));
          row.append(back);
        }
        pg.append(pg._kick, pg._big, pg._ttl, pg._sub, row);
        fillDay(pg);
        return pg;
      }
      function setSub(pg, text, icon) {
        pg._sub.innerHTML = '';
        if (icon) pg._sub.insertAdjacentHTML('beforeend', V.icon(icon));
        pg._sub.appendChild(U.el('span', { text }));
      }
      function fillDay(pg) {
        if (!pg._big) return;
        const t = now();
        const isToday = viewDay === todayD0();
        const evs = eventsOfDay(viewDay);
        pg._kick.style.color = '';
        if (isToday) {
          const up = evs.find((e) => e.start > t);
          const on = evs.filter((e) => e.start <= t && e.end > t).pop();
          const e = up || on;
          centerEv = e || null;
          if (e) {
            const ongoing = e === on && !up;
            pg._kick.textContent = ongoing ? 'Jetzt · noch ' + durWords((e.end - t) / MIN) : relIn(e.start - t);
            pg._kick.style.color = soft(e.color, 0.2);
            pg._big.textContent = tm(e.start);
            pg._ttl.textContent = e.title;
            setSub(pg, 'bis ' + tm(e.end) + (e.place ? ' · ' + e.place : ''), e.place ? 'location' : null);
          } else {
            const nx = nextEvent(t);
            pg._kick.textContent = 'Heute';
            pg._big.textContent = 'Frei';
            pg._ttl.textContent = evs.length ? 'Keine Termine mehr' : 'Keine Termine';
            setSub(pg, nx ? V.fmt.relDay(new Date(nx.start)) + ' ' + tm(nx.start) + ' · ' + nx.title : 'Genieß den Tag.');
          }
        } else {
          const e = evs[0];
          centerEv = e || null;
          if (e) {
            pg._kick.textContent = evs.length === 1 ? '1 Termin' : evs.length + ' Termine';
            pg._kick.style.color = soft(e.color, 0.2);
            pg._big.textContent = tm(e.start);
            pg._ttl.textContent = e.title;
            setSub(pg, evs[1] ? 'danach ' + tm(evs[1].start) + ' ' + evs[1].title : 'bis ' + tm(e.end) + (e.place ? ' · ' + e.place : ''), null);
          } else {
            pg._kick.textContent = 'Keine Termine';
            pg._big.textContent = String(new Date(viewDay).getDate());
            pg._ttl.textContent = 'Ein freier Tag';
            setSub(pg, V.fmt.weekday(new Date(viewDay)) + ', ' + V.fmt.MON[new Date(viewDay).getMonth()]);
          }
        }
      }

      function detailPage(e) {
        const pg = U.el('div', { class: 'cal-page cal-detail' });
        pg._ev = e;
        pg._kick = el('cal-kick');
        pg._ttl = el('cal-dttl');
        pg._time = el('cal-dtime vos-num');
        pg._sub = el('cal-sub');
        const row = U.el('div', { class: 'cal-row' });
        row.append(
          V.ui.roundButton('trash', { kind: 'sm', label: 'Löschen', cls: 'cal-del', onClick: () => askDelete(e) }),
          V.ui.roundButton('close', { kind: 'sm', label: 'Schließen', onClick: closeDetail }));
        pg.append(pg._kick, pg._ttl, pg._time, pg._sub, row);
        fillDetail(pg, e);
        return pg;
      }
      function fillDetail(pg, e) {
        const t = now();
        const rel = V.fmt.relDay(new Date(e.start));
        const status = e.end <= t ? 'vorbei' : e.start <= t ? 'läuft · noch ' + durWords((e.end - t) / MIN) : relIn(e.start - t);
        pg._kick.textContent = rel + ' · ' + status;
        pg._kick.style.color = soft(e.color, 0.2);
        pg._ttl.textContent = e.title;
        pg._ttl.style.fontSize = e.title.length > 16 ? '5.8cqw' : '7.2cqw';
        pg._time.textContent = tm(e.start) + ' – ' + tm(e.end);
        setSub(pg, durWords((e.end - e.start) / MIN) + (e.place ? ' · ' + e.place : ''), e.place ? 'location' : 'clock');
      }

      function addPage() {
        const pg = U.el('div', { class: 'cal-page cal-addp' });
        pg._big = el('cal-big vos-num');
        pg._ttl = el('cal-ttl');
        pg._sub = el('cal-sub', '');
        const row = U.el('div', { class: 'cal-row cal-arow' });
        const cancel = V.ui.roundButton('close', { kind: 'sm', label: 'Abbrechen', onClick: closeAdd });
        pg._dur = U.el('button', { class: 'cal-chip', attrs: { type: 'button', 'aria-label': 'Dauer' } });
        V.ui.tap(pg._dur, () => {
          const i = DURS.indexOf(draft.dur);
          draft.dur = DURS[(i + 1) % DURS.length];
          fillAdd(pg); mark();
        });
        const ok = V.ui.roundButton('check', { kind: 'sm', label: 'Eintragen', cls: 'cal-ok', onClick: saveDraft });
        row.append(cancel, pg._dur, ok);
        const dots = U.el('div', { class: 'cal-dots' });
        // Arten als Bogen unten – links drei, rechts drei, die Mitte bleibt Visto
        const ANG = [254, 232, 210, 150, 128, 106];
        pg._dots = PICK.map((id, i) => {
          const cat = CATS[id];
          const p = V.display.pt(ANG[i], 330);
          const b = U.el('button', { class: 'cal-dot', attrs: { type: 'button', 'aria-label': cat.name }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw', '--c': cat.color }, html: V.icon(cat.icon) });
          V.ui.tap(b, () => { draft.cat = id; fillAdd(pg); mark(); });
          dots.appendChild(b);
          return b;
        });
        pg.append(pg._big, pg._ttl, row, dots);
        fillAdd(pg);
        return pg;
      }
      function fillAdd(pg) {
        if (!draft) return;
        const cat = CATS[draft.cat];
        pg._big.textContent = tm(draft.start);
        pg._ttl.textContent = cat.name + ' · bis ' + tm(draft.start + draft.dur * MIN);
        pg._dur.textContent = durWords(draft.dur);
        pg._dots.forEach((b, i) => b.classList.toggle('on', PICK[i] === draft.cat));
      }

      /* -------- Navigation */
      function goDay(d0, o = {}) {
        if (d0 === viewDay) return;
        const dir = o.dir || (d0 > viewDay ? 1 : -1);
        prev = cur;
        prevRot = rot.value + focus.value;
        viewDay = d0;
        half = autoHalf(d0);
        rebuild();
        transDir = dir;
        trans.set(0);
        trans.to(1).then((done) => { if (done) { prev = null; mark(); } });
        setDate(dayTitle(viewDay));
        if (state !== 'day') { state = 'day'; selId = null; selK.to(0); focus.set(0); draft = null; }
        swapPage(dayPage(), dir, o.fromX);
        if (!o.silent) { V.sound.play('tick'); V.haptic(4); }
      }
      function cycleMode() {
        if (mode === '24') { mode = '12'; half = 0; } else if (half === 0) half = 1; else mode = '24';
        s.mode = mode;
        V.store.save();
        prev = cur;
        prevRot = rot.value + focus.value;
        rebuild();
        transDir = 0;
        growClock = 0;
        trans.set(0);
        trans.to(1).then((done) => { if (done) { prev = null; mark(); } });
        swapPage(dayPage(), 0);
      }
      function shortest(target, from) { return from + U.angDiff(from, target); }
      function openDetail(e, dir) {
        if (!e) return;
        if (day0(e.start) !== viewDay && day0(e.end - 1) !== viewDay) goDay(day0(e.start), { silent: true });
        let it = cur.items.find((x) => x.e.id === e.id);
        if (!it && mode === '12') { half = half ? 0 : 1; rebuild(); it = cur.items.find((x) => x.e.id === e.id); }
        if (!it) return;
        const midA = (it.a0 + it.a1) / 2;
        state = 'detail';
        selId = e.id;
        selK.to(1);
        focus.to(shortest(-midA, focus.value));
        swapPage(detailPage(e), dir || 0);
        V.haptic(5);
      }
      function closeDetail() {
        state = 'day';
        selId = null;
        selK.to(0);
        focus.to(shortest(0, focus.value)).then((done) => { if (done) focus.set(0); });
        swapPage(dayPage(), 0);
      }
      async function askDelete(e) {
        const ok = await V.notify.alert({
          title: 'Termin löschen?', body: e.title + ' · ' + V.fmt.relDay(new Date(e.start)) + ', ' + tm(e.start),
          icon: 'trash', color: COLOR,
          buttons: [{ label: 'Behalten', value: false }, { label: 'Löschen', kind: 'danger', value: true }],
        });
        if (!ok) return;
        removeEvent(e.id);
        V.notify.toast('Termin gelöscht', 'trash');
      }

      function openAdd() {
        const t = now();
        const view = cur.view;
        let start;
        if (viewDay === todayD0()) start = Math.ceil((t + 10 * MIN) / (15 * MIN)) * 15 * MIN;
        else start = hourOf(viewDay, mode === '12' && half ? 15 : 10);
        if (start < view.t0 || start >= view.t1) start = mode === '12' ? view.t0 + 3 * HOUR : hourOf(viewDay, 10);
        if (day0(start) !== viewDay) start = hourOf(viewDay, 22);
        draft = { start, dur: 60, cat: 'event' };
        state = 'add';
        selId = null;
        selK.to(1);
        setDate('Neuer Termin · ' + V.fmt.relDay(new Date(viewDay)), soft(COLOR, 0.15));
        swapPage(addPage(), 0);
      }
      function closeAdd() {
        state = 'day';
        selK.to(0).then((done) => { if (done && state !== 'add') { draft = null; mark(); } });
        setDate(dayTitle(viewDay));
        swapPage(dayPage(), 0);
      }
      function saveDraft() {
        if (!draft) return;
        const cat = CATS[draft.cat];
        const e = addEvent({ title: cat.name, cat: draft.cat, start: draft.start, end: draft.start + draft.dur * MIN });
        draft = null;
        state = 'day';
        selK.set(0);
        setDate(dayTitle(viewDay));
        swapPage(dayPage(), 0);
        V.sound.play('success');
        V.notify.toast('Eingetragen · ' + tm(e.start), 'check');
      }
      function placeAt(a) {
        if (!draft) return;
        const view = cur.view;
        let ms = timeAt(view, a - rot.value - focus.value);
        ms = Math.round(ms / (15 * MIN)) * 15 * MIN;
        ms = U.clamp(ms, view.t0, view.t1 - 15 * MIN);
        if (ms !== draft.start) {
          draft.start = ms;
          V.sound.play('tick'); V.haptic(3);
          if (page && page._dur) fillAdd(page);
          mark();
        }
      }

      /* -------- Gesten: Tippen, Wischen, am Rand drehen */
      function hit(p) {
        if (p.r < 360) return null;
        let best = null, bestD = 1e9;
        const off = rot.value + focus.value;
        for (const it of cur.items) {
          const span = it.a1 - it.a0;
          const d = U.wrap(p.a - (it.a0 + off), 360);
          const inside = d <= span + 5 || d >= 360 - 5;
          if (!inside) continue;
          const dm = Math.abs(U.angDiff(it.a0 + off + span / 2, p.a)) + Math.abs(p.r - (R - it.lane * LANE)) * 0.05;
          if (dm < bestD) { bestD = dm; best = it.e; }
        }
        return best;
      }
      const isCtl = (t) => !!(t && t.closest && t.closest('button'));
      const inLine = (p) => p.y > 868 && Math.abs(p.x - 500) < 175;
      let gs = null;
      V.gesture(root, {
        start(p, e) {
          gs = { kind: isCtl(e.target) ? 'none' : null, step: 0 };
          if (!gs.kind && state === 'add' && p.r0 >= 330 && !inLine(p)) { gs.kind = 'place'; placeAt(p.a); }
        },
        move(p) {
          if (!gs || gs.kind === 'none') return;
          if (gs.kind === 'place') { placeAt(p.a); return; }
          if (!gs.kind) {
            if (!p.moved) return;
            const tang = Math.abs(p.dA) * (Math.PI / 180) * p.r0;
            const radial = Math.abs(p.r - p.r0);
            if (p.r0 >= 300 && tang > radial * 1.3 && tang > 16 && state !== 'add') gs.kind = 'rot';
            else if (state === 'day' && Math.abs(p.dx) > Math.abs(p.dy) * 1.2) gs.kind = 'swipe';
            else gs.kind = 'none';
          }
          if (gs.kind === 'rot') {
            const STEP = state === 'detail' ? 32 : 40;
            const want = Math.trunc(p.dA / STEP);
            while (gs.step !== want) {
              const d = want > gs.step ? 1 : -1;
              gs.step += d;
              if (state === 'detail') {
                const list = cur.items.map((x) => x.e);
                const i = list.findIndex((x) => x.id === selId);
                const nx = list[U.clamp(i + d, 0, list.length - 1)];
                if (nx && nx.id !== selId) { openDetail(nx, d); V.sound.play('tick'); }
              } else goDay(addDays(viewDay, d), { dir: d });
            }
            rot.to((p.dA - gs.step * STEP) * 0.55, { response: 0.18, bounce: 0 });
          } else if (gs.kind === 'swipe' && page) {
            page._x = (p.dx * 0.42) / 10;
            page.style.transform = `translateX(${page._x.toFixed(2)}cqw)`;
            page.style.opacity = (1 - Math.min(0.6, Math.abs(p.dx) / 700)).toFixed(3);
            rot.set(p.dx * 0.045);
          }
        },
        end(p) {
          const g = gs; gs = null;
          if (!g) return;
          if (g.kind === 'rot') rot.to(0, { response: 0.5, bounce: 0.16 });
          else if (g.kind === 'swipe') {
            const go = !p.cancelled && (Math.abs(p.dx) > 80 || Math.abs(p.vx) > 450);
            if (go) {
              const d = p.dx < 0 ? 1 : -1;
              rot.to(0, { response: 0.5, bounce: 0.12 });
              goDay(addDays(viewDay, d), { dir: d });
            } else if (page) {
              const pg = page, x0 = pg._x || 0;
              pg._x = 0;
              V.tween({ duration: 0.4, ease: V.ease.smooth, onUpdate: (v) => { pg.style.transform = `translateX(${(x0 * (1 - v)).toFixed(2)}cqw)`; pg.style.opacity = ''; } });
              rot.to(0, { response: 0.45, bounce: 0.2 });
            }
          }
        },
        tap(p, e) {
          if (isCtl(e.target) || inLine(p) || state === 'add') return;
          const ev = hit(p);
          if (ev) { if (ev.id !== selId) { V.sound.play('tap'); openDetail(ev); } return; }
          if (p.r < 300 && state === 'day' && centerEv) { V.sound.play('tap'); openDetail(centerEv); }
        },
      }, { slop: 8 });

      /* -------- Start */
      setDate(dayTitle(viewDay));
      swapPage(dayPage(), 0);
      function applyParams(pr) {
        if (pr && pr.event) {
          const e = byId(pr.event);
          if (e) setTimeout(() => openDetail(e), 120);
        } else if (pr && pr.day !== undefined) goDay(addDays(todayD0(), parseDayArg(pr.day)));
      }
      applyParams(ctx.params);

      return {
        back() {
          if (state === 'detail') { closeDetail(); return true; }
          if (state === 'add') { closeAdd(); return true; }
          return false;
        },
        params: applyParams,
        // falls die Shell doch einmal die Drehkrone weiterreicht
        crown(dA) {
          crownAcc += dA;
          if (Math.abs(crownAcc) >= 40) { const d = Math.sign(crownAcc); crownAcc = 0; if (state === 'day') goDay(addDays(viewDay, d), { dir: d }); }
        },
      };
    },
  });

  V.css('calendar', `
    .cal-root { position: absolute; inset: 0; }
    .cal-cv { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .cal-now { pointer-events: none; transition: opacity .3s; }
    .cal-now .cal-halo { transform-box: fill-box; transform-origin: center; animation: calBreathe 2.8s ease-in-out infinite; }
    @keyframes calBreathe { 0%, 100% { opacity: .55; transform: scale(.78); } 50% { opacity: 1; transform: scale(1.12); } }
    .cal-date { pointer-events: none; transition: opacity .16s ease; }
    .cal-mid { position: absolute; inset: 0; pointer-events: none; }
    .cal-page { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; text-align: center;
      padding-top: 23.5cqw; will-change: transform, opacity; }
    .cal-page.cal-old, .cal-page.cal-old * { pointer-events: none !important; }
    .cal-kick { font-size: 2.9cqw; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; color: var(--fg3);
      height: 3.6cqw; white-space: nowrap; }
    .cal-big { font-size: 17cqw; font-weight: 200; letter-spacing: -.05em; line-height: 1; margin-top: 1.8cqw; }
    .cal-ttl { font-size: 6cqw; font-weight: 620; letter-spacing: -.02em; line-height: 1.15; margin-top: 1.6cqw;
      max-width: 58cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cal-sub { font-size: 3.5cqw; font-weight: 520; color: var(--fg3); margin-top: .9cqw; max-width: 54cqw;
      display: flex; align-items: center; justify-content: center; gap: 1.1cqw; white-space: nowrap; }
    .cal-sub span { overflow: hidden; text-overflow: ellipsis; }
    .cal-sub svg { width: 3.5cqw; height: 3.5cqw; flex: none; opacity: .8; }
    .cal-row { position: absolute; left: 0; right: 0; top: 67cqw; display: flex; justify-content: center; align-items: center; gap: 2.6cqw; }
    .cal-row > * { pointer-events: auto; }
    .cal-chip { height: 11cqw; min-width: 16cqw; padding: 0 4.4cqw; border-radius: 99cqw; border: 0; cursor: pointer;
      background: var(--card2); color: #fff; font: 620 3.6cqw/1 var(--font); letter-spacing: -.005em; white-space: nowrap;
      display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums;
      transition: transform .28s var(--spring), background .2s; }
    .cal-chip:active { transform: scale(.93); background: var(--card3); }
    .cal-plus { background: ${COLOR}; color: #fff; box-shadow: 0 0 6cqw ${U.rgba(COLOR, 0.35)}; }
    .cal-ok { background: ${COLOR}; color: #fff; box-shadow: 0 0 6cqw ${U.rgba(COLOR, 0.35)}; }
    .cal-del { background: rgba(255,69,58,.18); color: #ff6b62; }
    .cal-dttl { font-size: 7.2cqw; font-weight: 650; letter-spacing: -.025em; line-height: 1.08; margin-top: 2.4cqw; max-width: 60cqw;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cal-dtime { font-size: 8.4cqw; font-weight: 230; letter-spacing: -.035em; margin-top: 2.2cqw; line-height: 1; }
    .cal-detail .cal-sub { margin-top: 2cqw; }
    .cal-addp { padding-top: 20cqw; }
    .cal-addp .cal-big { font-size: 14.5cqw; margin-top: 1.4cqw; }
    .cal-addp .cal-ttl { font-size: 5cqw; margin-top: 1.4cqw; }
    .cal-arow { top: 46.5cqw; }
    .cal-dots { position: absolute; inset: 0; pointer-events: none; }
    .cal-dot { position: absolute; width: 11cqw; height: 11cqw; margin: -5.5cqw 0 0 -5.5cqw; border-radius: 50%; border: 0; padding: 0;
      display: grid; place-items: center; cursor: pointer; pointer-events: auto; color: var(--c);
      background: color-mix(in srgb, var(--c) 20%, transparent);
      transition: transform .4s var(--spring), background .25s, color .25s, box-shadow .3s; }
    .cal-dot svg { width: 5cqw; height: 5cqw; }
    .cal-dot:active { transform: scale(.9); }
    .cal-dot.on { background: var(--c); color: #fff; transform: scale(1.1);
      box-shadow: 0 0 0 .55cqw #000, 0 0 0 1cqw var(--c), 0 0 6cqw color-mix(in srgb, var(--c) 60%, transparent); }
  `);
})();
