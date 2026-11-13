/* VistoOS · apps/home.js — Zuhause: simuliertes Smart Home
 *
 *  Karussell (links/rechts wischen):  Szenen · Wohnzimmer · Küche · Schlafzimmer · Arbeitszimmer · Flur · Klima
 *    Raum    großer runder Lichtregler: am Rand entlangziehen = Helligkeit (leuchtender Bogen in Lichtfarbe),
 *            Glühbirne in der Mitte antippen = an/aus, Weiß- und Farbtöne als Chips am unteren Bogen,
 *            Farbrad (Unteransicht), Rollo (Unteransicht: Behang fährt im Kreis), Kaffeemaschine (Küche)
 *    Klima   Thermostat-Drehregler mit feinen Strichen rundherum, 0,5-°C-Schritte, Heizen orange / Kühlen blau
 *    Szenen  „Guten Morgen“, „Film“, „Gute Nacht“, „Alles aus“ – alle Geräte gleiten gestaffelt in den Zustand
 *
 *  Zustand: V.store.app('home')   Datenquelle: V.info.home()   Ereignis: 'home:changed'
 *  Aktionen: home.light · home.scene · home.thermostat · home.blinds · home.coffee · home.status
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const APP_COLOR = '#FFB52E';
  const HEAT = '#FF7A1F', COOL = '#3FA0FF';
  const RIM_R = 478;                       // Radius der Randbögen
  const RIM_MIN = 388;                     // ab diesem Radius bedeutet Ziehen „am Rand drehen“
  const L_A0 = 215, L_SPAN = 290;          // Lichtregler: 215° (links unten) im Uhrzeigersinn bis 145°
  const T_MIN = 10, T_MAX = 30, T_A0 = 220, T_SPAN = 280;
  const T_DEG = T_SPAN / (T_MAX - T_MIN);  // 14° je Grad Celsius
  const PAGE_W = 560;                      // Wischweg für eine Seite (logisch)
  const COFFEE = '#C98A5B';
  const HUE_A0 = 205, HUE_SPAN = 310;      // Farbrad: Lücke unten für Visto
  const hueToAngle = (h) => HUE_A0 + (U.wrap(h, 360) / 360) * HUE_SPAN;
  function angleToHue(a) {
    let rel = U.wrap(a - HUE_A0, 360);
    if (rel > HUE_SPAN) rel = rel > HUE_SPAN + (360 - HUE_SPAN) / 2 ? 0 : HUE_SPAN;
    return Math.min(359, (rel / HUE_SPAN) * 360);
  }
  const inVistoZone = (x, y) => y > 868 && Math.abs(x - 500) < 175;

  /* ------------------------------------------------------------ Modell */
  const ROOMS = [
    { id: 'wohnzimmer', name: 'Wohnzimmer', in: 'im Wohnzimmer', blinds: true },
    { id: 'kueche', name: 'Küche', in: 'in der Küche', blinds: true, coffee: true },
    { id: 'schlafzimmer', name: 'Schlafzimmer', in: 'im Schlafzimmer', blinds: true },
    { id: 'arbeitszimmer', name: 'Arbeitszimmer', in: 'im Arbeitszimmer', blinds: true },
    { id: 'flur', name: 'Flur', in: 'im Flur', blinds: false },
  ];
  const ROOM = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
  const BLIND_ROOMS = ROOMS.filter((r) => r.blinds).map((r) => r.id);

  const TONES = {
    kerze: { name: 'Kerzenlicht', k: 2200, hex: '#FF9A3C' },
    warm: { name: 'Warmweiß', k: 2700, hex: '#FFC47E' },
    neutral: { name: 'Neutralweiß', k: 4000, hex: '#FFEBD4' },
    kalt: { name: 'Tageslicht', k: 6500, hex: '#DCE8FF' },
  };
  const TONE_ORDER = ['kerze', 'warm', 'neutral', 'kalt'];
  const HUES = [
    { name: 'Rot', adj: 'rot', h: 2, words: ['rot'] },
    { name: 'Orange', adj: 'orange', h: 26, words: ['orange'] },
    { name: 'Gelb', adj: 'gelb', h: 50, words: ['gelb'] },
    { name: 'Grün', adj: 'grün', h: 132, words: ['grün'] },
    { name: 'Türkis', adj: 'türkis', h: 178, words: ['türkis', 'cyan', 'mint'] },
    { name: 'Blau', adj: 'blau', h: 222, words: ['blau'] },
    { name: 'Lila', adj: 'lila', h: 268, words: ['lila', 'violett', 'lavendel'] },
    { name: 'Pink', adj: 'pink', h: 318, words: ['pink', 'magenta', 'rosa'] },
  ];
  const hueHex = (h) => U.hsl(h, 92, 62);

  const OFF = { on: false };
  const SCENES = [
    { id: 'morgen', name: 'Guten Morgen', icon: 'sunrise', color: '#FFB340',
      lights: { wohnzimmer: { on: true, bri: 0.7, tone: 'neutral' }, kueche: { on: true, bri: 1, tone: 'kalt' }, schlafzimmer: { on: true, bri: 0.45, tone: 'warm' }, arbeitszimmer: { on: true, bri: 0.8, tone: 'neutral' }, flur: { on: true, bri: 0.5, tone: 'warm' } },
      blinds: 100, temp: 21.5, coffee: true,
      say: 'Guten Morgen! Die Rollos fahren hoch und der Kaffee läuft schon.', sub: 'Licht hell · Rollos auf · Kaffee' },
    { id: 'film', name: 'Film', icon: 'hm-film', color: '#8C6CFF',
      lights: { wohnzimmer: { on: true, bri: 0.14, tone: 'hue', hue: 258 }, kueche: OFF, schlafzimmer: OFF, arbeitszimmer: OFF, flur: { on: true, bri: 0.06, tone: 'kerze' } },
      blinds: { wohnzimmer: 0 }, temp: 21,
      say: 'Film ab! Das Wohnzimmer ist gedimmt und die Rollos sind unten.', sub: 'Wohnzimmer gedimmt · Rollo zu' },
    { id: 'nacht', name: 'Gute Nacht', icon: 'moon', color: '#6E6BFF',
      lights: { wohnzimmer: OFF, kueche: OFF, schlafzimmer: { on: true, bri: 0.05, tone: 'kerze' }, arbeitszimmer: OFF, flur: OFF },
      blinds: 0, temp: 18, coffee: false,
      say: 'Gute Nacht. Alles ist dunkel und die Heizung senkt auf 18 Grad.', sub: 'Lichter aus · Rollos zu · 18 °C' },
    { id: 'aus', name: 'Alles aus', icon: 'power', color: '#A6A6AD',
      lights: { wohnzimmer: OFF, kueche: OFF, schlafzimmer: OFF, arbeitszimmer: OFF, flur: OFF }, coffee: false,
      say: 'Erledigt, alles ist aus.', sub: 'Alle Lichter und Geräte aus' },
  ];
  const SCENE = Object.fromEntries(SCENES.map((s) => [s.id, s]));

  const PAGES = [{ id: 'szenen', name: 'Szenen', kind: 'scenes' }]
    .concat(ROOMS.map((r) => ({ id: r.id, name: r.name, kind: 'room', room: r })))
    .concat([{ id: 'klima', name: 'Klima', kind: 'thermo' }]);
  const pageIndex = (id) => PAGES.findIndex((p) => p.id === id);

  const DEF_ROOMS = {
    wohnzimmer: { on: true, bri: 0.72, tone: 'warm', hue: 268, blinds: 100 },
    kueche: { on: false, bri: 0.9, tone: 'neutral', hue: 222, blinds: 100 },
    schlafzimmer: { on: false, bri: 0.35, tone: 'kerze', hue: 318, blinds: 30 },
    arbeitszimmer: { on: true, bri: 0.85, tone: 'neutral', hue: 178, blinds: 70 },
    flur: { on: false, bri: 0.5, tone: 'warm', hue: 26, blinds: null },
  };

  let cache = null;
  /** gespeicherter Zustand (robust ergänzt, auch nach Werkszustand) */
  function st() {
    const o = V.store.app('home');
    if (o !== cache) {
      cache = o;
      if (!o.rooms || typeof o.rooms !== 'object') o.rooms = {};
      for (const id in DEF_ROOMS) o.rooms[id] = Object.assign(U.clone(DEF_ROOMS[id]), o.rooms[id] || {});
      o.thermo = Object.assign({ on: true, target: 21.5, cur0: 20.4, t0: 0 }, o.thermo || {});
      if (o.coffee === undefined) o.coffee = false;
      if (o.customHue === undefined) o.customHue = 268;
      if (!o.page || pageIndex(o.page) < 0) o.page = 'wohnzimmer';
      if (!ROOM[o.room]) o.room = 'wohnzimmer';
    }
    return o;
  }
  function changed(detail) { V.store.save(); V.emit('home:changed', detail || {}); }

  /* ------------------------------------------------------------ Licht */
  const roomState = (id) => st().rooms[id];
  const levelOf = (r) => (r.on ? r.bri : 0);
  const colorOf = (r) => (r.tone === 'hue' ? hueHex(r.hue) : (TONES[r.tone] || TONES.warm).hex);
  function hueEntry(h) {
    let best = HUES[0], bd = 999;
    for (const x of HUES) { const d = Math.abs(U.angDiff(x.h, h)); if (d < bd) { bd = d; best = x; } }
    return best;
  }
  const toneName = (r) => (r.tone === 'hue' ? hueEntry(r.hue).name : (TONES[r.tone] || TONES.warm).name);
  const pctOf = (r) => Math.max(1, Math.round(r.bri * 100));

  /** Licht eines Raums ändern. o: {on, bri 0…1, tone, hue} */
  function setLight(id, o, src) {
    const r = roomState(id);
    if (!r) return null;
    if (o.tone) {
      r.tone = TONES[o.tone] || o.tone === 'hue' ? o.tone : 'warm';
      if (o.tone === 'hue' && o.hue !== undefined) r.hue = U.wrap(Math.round(o.hue), 360);
      if (o.tone === 'hue' && src !== 'scene') st().customHue = r.hue;
    }
    if (o.bri !== undefined) r.bri = U.clamp(o.bri, 0.01, 1);
    if (o.on !== undefined) r.on = !!o.on;
    else if (o.bri !== undefined || o.tone) r.on = true;
    if (r.on && r.bri < 0.02 && o.bri === undefined) r.bri = 0.6;
    if (src !== 'scene') st().scene = null;
    if (src === 'voice') st().room = id;
    return r;
  }
  function stepTone(r, dir) {
    const i = r.tone === 'hue' ? (dir < 0 ? 2 : 1) : TONE_ORDER.indexOf(r.tone);
    return { tone: TONE_ORDER[U.clamp(i + dir, 0, TONE_ORDER.length - 1)] };
  }

  /* ------------------------------------------------------------ Rollos */
  function setBlinds(id, pos, src) {
    const r = roomState(id);
    if (!r || r.blinds === null || r.blinds === undefined) return null;
    r.blinds = U.clamp(Math.round(pos), 0, 100);
    if (src !== 'scene') st().scene = null;
    return r;
  }
  const blindsText = (p) => (p >= 99 ? 'Offen' : p <= 1 ? 'Geschlossen' : p + ' % offen');

  /* ------------------------------------------------------------ Kaffeemaschine */
  let coffeeT = 0;
  function setCoffee(on, src) {
    const s = st();
    on = !!on;
    if (src !== 'scene') s.scene = null;
    if (s.coffee === on) return on;
    s.coffee = on;
    clearTimeout(coffeeT);
    if (on) {
      coffeeT = setTimeout(() => {
        if (st().coffee) V.notify.banner({ title: 'Kaffee ist fertig', body: 'Küche · Kaffeemaschine', icon: 'coffee', color: COFFEE });
      }, 45000);
    }
    return on;
  }

  /* ------------------------------------------------------------ Heizung */
  const TAU = 420;                         // Sekunden, bis sich die Raumtemperatur merklich angleicht
  const goalTemp = (th) => (th.on ? th.target : 17.5);
  function curTemp() {
    const th = st().thermo;
    if (!th.t0) th.t0 = Date.now();
    const dt = Math.max(0, (Date.now() - th.t0) / 1000);
    const g = goalTemp(th);
    return g + (th.cur0 - g) * Math.exp(-dt / TAU);
  }
  function setThermoRaw(target, on) {
    const th = st().thermo;
    th.cur0 = curTemp(); th.t0 = Date.now();
    if (target !== undefined && target !== null) th.target = U.clamp(Math.round(target * 2) / 2, T_MIN, T_MAX);
    if (on !== undefined) th.on = !!on;
  }
  function thermoMode() {
    const th = st().thermo;
    if (!th.on) return 'off';
    const c = curTemp();
    return th.target - c > 0.25 ? 'heat' : c - th.target > 0.25 ? 'cool' : 'hold';
  }
  const modeColor = (m) => (m === 'heat' ? HEAT : m === 'cool' ? COOL : m === 'off' ? '#8E8E93' : '#FFFFFF');
  const modeText = (m) => (m === 'heat' ? 'Heizt' : m === 'cool' ? 'Kühlt' : m === 'off' ? 'Aus' : 'Gehalten');
  const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  const fmtT = (v) => { const h = Math.round(v * 2) / 2; return h % 1 ? fmt1(h) : String(h); };
  const tAngle = (v) => T_A0 + (U.clamp(v, T_MIN, T_MAX) - T_MIN) * T_DEG;

  /* ------------------------------------------------------------ Szenen */
  function runScene(id) {
    const sc = SCENE[id];
    if (!sc) return null;
    for (const rid in sc.lights) setLight(rid, sc.lights[rid], 'scene');
    if (typeof sc.blinds === 'number') BLIND_ROOMS.forEach((r) => setBlinds(r, sc.blinds, 'scene'));
    else if (sc.blinds) for (const r in sc.blinds) setBlinds(r, sc.blinds[r], 'scene');
    if (sc.temp !== undefined) setThermoRaw(sc.temp, true);
    if (sc.coffee !== undefined) setCoffee(sc.coffee, 'scene');
    st().scene = sc.id;
    changed({ what: 'scene', scene: sc.id, stagger: true });
    V.rim.pulse({ at: 0, color: sc.color, spread: 150, duration: 1.8 });
    return sc;
  }

  /* ------------------------------------------------------------ Sprache: Hilfen */
  const W = (s) => new RegExp('(?<![a-zäöüß])(?:' + s + ')(?![a-zäöüß])');
  const RE = {
    light: /(?<![a-zäöüß])(?:wohnzimmer|küchen|schlafzimmer|arbeitszimmer|flur|büro|decken|tisch|steh|nacht|lese)?(?:licht|lichter|lampe|lampen|leuchte|beleuchtung)(?![a-zäöüß])/,
    off: W('aus|ausschalten|ausmachen|abschalten|ausknipsen|abdrehen'),
    on: W('an|ein|einschalten|anmachen|anschalten|anknipsen'),
    pct: /(\d{1,3})\s*(?:%|prozent)/,
    blinds: W('rollo|rollos|rollladen|rollläden|rolladen|rolläden|jalousie|jalousien|vorhang|vorhänge|beschattung|markise|markisen'),
    coffee: /kaffee/,
    heat: W('heizung|heizungen|thermostat|raumtemperatur|heizkörper|klimaanlage'),
    indoor: W('drinnen|innen|zimmer|wohnung|zuhause|daheim|hier drin|im haus|bei mir'),
    question: /^(?:ist|sind|brennt|brennen|leuchtet|leuchten|läuft|laufen|welche|welches|welcher|wie|was|wo|hab ich|habe ich|haben wir|steht|stehen)(?![a-zäöüß])/,
    request: /^(?:kannst|könntest|würdest|kann|könnte|würde|machst|magst|bitte|mach|schalt|stell|dreh|dimm|setz)/,
    exclude: /erinner|timer|wecker|weck mich|wecke mich|alarm|countdown/,
    show: /^(?:zeig|öffne|öffnen)/,
  };
  const ALL_RE = W('überall|alle|allen|alles|sämtliche|ganze wohnung|ganzen wohnung|ganze haus|ganzen haus|jedem raum');
  const ROOM_WORDS = [
    ['wohnzimmer', /wohnzimmer|wohnraum|(?<![a-zäöüß])stube/],
    ['kueche', /küche|kueche|küchen/],
    ['schlafzimmer', /schlafzimmer|schlafraum/],
    ['arbeitszimmer', /arbeitszimmer|(?<![a-zäöüß])büro|(?<![a-zäöüß])office|schreibtisch/],
    ['flur', /(?<![a-zäöüß])(?:flur|diele|eingang|korridor)/],
  ];
  function roomFrom(t) { for (const [id, re] of ROOM_WORDS) if (re.test(t)) return id; return null; }
  /** Raum aus Aktionsargument: id, Name oder „alle“ → [ids] | null (unbekannt) */
  function resolveRooms(arg, fallback) {
    if (arg === undefined || arg === null || String(arg).trim() === '') return [fallback || defaultRoom()];
    const s = String(arg).toLowerCase().trim();
    if (/^(alle|all|überall|alles|\*)$/.test(s)) return ROOMS.map((r) => r.id);
    if (ROOM[s]) return [s];
    const r = roomFrom(s);
    return r ? [r] : null;
  }
  /** angesprochener Raum ohne Nennung: der in der App gezeigte, sonst der zuletzt benutzte */
  function defaultRoom() {
    const a = V.shell && V.shell.app;
    if (a && a.def.id === 'home' && a.inst && a.inst._room) { const r = a.inst._room(); if (r) return r; }
    return st().room;
  }
  function joinList(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]; }
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function colorFromText(t, r) {
    if (W('wärmer|gemütlicher').test(t)) return stepTone(r, -1);
    if (W('kälter|kühler|frischer').test(t)) return stepTone(r, 1);
    if (W('kerzenlicht|kerzenschein|kerze|gemütlich|kuschelig|romantisch').test(t)) return { tone: 'kerze' };
    if (W('warmweiß|warmweiss|warmes|warm').test(t)) return { tone: 'warm' };
    if (W('tageslicht|tageslichtweiß|kaltweiß|kaltweiss|kaltes|kalt').test(t)) return { tone: 'kalt' };
    if (W('neutralweiß|neutralweiss|neutral|weiß|weiss|weißes|normal').test(t)) return { tone: 'neutral' };
    for (const h of HUES) if (h.words.some((w) => W(w + '(?:e[snmr]?)?').test(t))) return { tone: 'hue', hue: h.h };
    return null;
  }
  function colorFromArg(s, r) {
    s = String(s || '').toLowerCase().trim();
    if (!s) return null;
    const hex = s.match(/^#?([0-9a-f]{6})$/);
    if (hex) {
      const [R, G, B] = U.hexToRgb(hex[1]);
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx - mn < 40) return { tone: B > R ? 'kalt' : 'neutral' };
      let h;
      if (mx === R) h = ((G - B) / (mx - mn)) % 6; else if (mx === G) h = (B - R) / (mx - mn) + 2; else h = (R - G) / (mx - mn) + 4;
      return { tone: 'hue', hue: U.wrap(h * 60, 360) };
    }
    if (TONES[s]) return { tone: s };
    return colorFromText(V.brain.norm(s), r);
  }

  /* ------------------------------------------------------------ Antwortkarten */
  function orbEl(r, big) {
    const el = U.el('div', { class: 'hm-orb' });
    if (r.on) {
      const c = colorOf(r), lit = 1 - Math.pow(1 - r.bri, 3);
      el.style.background = `radial-gradient(circle at 50% 34%, #fff 0%, ${U.mix(c, '#ffffff', 0.3)} 24%, ${c} 52%, ${U.mix(c, '#000000', 0.45)} 100%)`;
      el.style.boxShadow = `0 0 ${(1.5 + 4.5 * lit).toFixed(1)}cqw ${U.rgba(c, 0.3 + 0.4 * lit)}, inset 0 0 0 .25cqw rgba(255,255,255,.25)`;
      el.style.opacity = (0.6 + 0.4 * lit).toFixed(2);
      el.style.color = U.mix(c, '#000000', 0.78);
    } else {
      el.style.background = '#1d1d20';
      el.style.boxShadow = 'inset 0 0 0 .25cqw rgba(255,255,255,.12)';
      el.style.color = 'rgba(255,255,255,.4)';
    }
    if (big) el.innerHTML = V.icon('bulb');
    return el;
  }
  function lightCard(ids, sub) {
    if (ids.length === 1) {
      const r = roomState(ids[0]);
      return { type: 'el', el: U.el('div', { class: 'hm-card' }, orbEl(r, true),
        U.el('div', null, U.el('b', { text: r.on ? pctOf(r) + ' %' : 'Aus' }), U.el('small', { text: sub || ROOM[ids[0]].name + (r.on ? ' · ' + toneName(r) : '') }))) };
    }
    const on = ids.filter((id) => roomState(id).on).length;
    return { type: 'el', el: U.el('div', { class: 'hm-card' }, U.el('div', { class: 'hm-orbs' }, ids.map((id) => orbEl(roomState(id), false))),
      U.el('div', null, U.el('b', { text: on ? (on === ids.length ? 'Alle an' : `${on} von ${ids.length} an`) : 'Alle aus' }), U.el('small', { text: sub || 'Lichter' }))) };
  }
  function thermoCard() {
    const th = st().thermo, m = thermoMode(), col = modeColor(m);
    const svg = U.svg('svg', { viewBox: '0 0 100 100', class: 'hm-mini' });
    svg.appendChild(U.svg('path', { d: V.ui.arcPath(50, 50, 41, T_A0, T_A0 + T_SPAN), fill: 'none', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 7, 'stroke-linecap': 'round' }));
    if (th.on && th.target > T_MIN) svg.appendChild(U.svg('path', { d: V.ui.arcPath(50, 50, 41, T_A0, tAngle(th.target)), fill: 'none', stroke: col, 'stroke-width': 7, 'stroke-linecap': 'round' }));
    const ic = U.frag(V.icon('thermo'));
    ['x', 'y', 'width', 'height'].forEach((k, i) => ic.setAttribute(k, [32, 32, 36, 36][i]));
    ic.setAttribute('color', th.on ? col : 'rgba(255,255,255,.5)');
    svg.appendChild(ic);
    return { type: 'el', el: U.el('div', { class: 'hm-card' }, svg,
      U.el('div', null, U.el('b', { text: th.on ? fmtT(th.target) + ' °C' : 'Heizung aus' }), U.el('small', { text: (th.on ? modeText(m) + ' · ' : '') + 'innen ' + fmt1(curTemp()) + ' °C' }))) };
  }
  const iconCard = (icon, color, title, sub) => ({ type: 'icon', icon, color, title, sub });

  /* ------------------------------------------------------------ Befehle (Aktionen und Absichten) */
  function pulse(color) {
    const a = V.shell && V.shell.app;
    if (!(a && a.def.id === 'home')) V.rim.pulse({ at: 0, color, spread: 110, duration: 1.5 });
  }

  /** a: {room, on, brightness (0…100), color, delta (−1…1)} */
  function lightCommand(a, src) {
    const ids = resolveRooms(a.room);
    if (!ids) return { say: 'Diesen Raum kenne ich nicht. Ich kenne Wohnzimmer, Küche, Schlafzimmer, Arbeitszimmer und Flur.', emotion: 'confused' };
    const parts = {};
    let toggled = false;
    if (a.on !== undefined && a.on !== null && a.on !== '') parts.on = a.on === true || /^(true|an|ein|on|1)$/i.test(String(a.on));
    if (a.brightness !== undefined && a.brightness !== null && a.brightness !== '') {
      const b = Number(a.brightness);
      if (isFinite(b)) { if (b <= 0) parts.on = false; else parts.bri = U.clamp(b / 100, 0.01, 1); }
    }
    let colorName = null;
    const before = ids.map((id) => levelOf(roomState(id)));
    const toneBefore = roomState(ids[0]).tone;
    for (const id of ids) {
      const r = roomState(id);
      const o = Object.assign({}, parts);
      if (a.delta) {
        const base = r.on ? r.bri : 0;
        const nb = U.clamp(base + a.delta, 0, 1);
        if (nb < 0.01) o.on = false; else o.bri = nb;
      }
      if (a.color) { const c = colorFromArg(a.color, r); if (c) { Object.assign(o, c); colorName = c; } }
      if (!Object.keys(o).length) { o.on = !r.on; toggled = true; }
      setLight(id, o, src);
    }
    changed({ what: 'light', rooms: ids, focus: ids.length === 1 ? ids[0] : null, src });
    const r0 = roomState(ids[0]);
    pulse(r0.on ? colorOf(r0) : '#8E8E93');
    // Antwort
    let say;
    if (ids.length > 1) {
      const anyOn = ids.some((id) => roomState(id).on);
      if (!anyOn) say = 'Alle Lichter sind aus.';
      else if (colorName) say = `Alle Lichter leuchten jetzt ${colorName.tone === 'hue' ? hueEntry(r0.hue).adj : 'in ' + TONES[r0.tone].name}.`;
      else if (parts.bri !== undefined || a.delta) say = `Alle Lichter auf ${pctOf(r0)} Prozent.`;
      else say = 'Alle Lichter sind an.';
      return { say, card: lightCard(ids), emotion: anyOn ? 'happy' : undefined };
    }
    const room = ROOM[ids[0]];
    const relColor = /^(wärmer|kälter|kühler)$/i.test(String(a.color || ''));
    if (relColor && r0.tone === toneBefore && r0.on) return { say: `${/^w/i.test(a.color) ? 'Wärmer' : 'Kühler'} geht es nicht – das Licht ${room.in} leuchtet schon in ${TONES[r0.tone].name}.`, card: lightCard(ids) };
    if (!r0.on) say = `Das Licht ${room.in} ist aus.`;
    else if (colorName) say = `Das Licht ${room.in} leuchtet jetzt ${r0.tone === 'hue' ? hueEntry(r0.hue).adj : 'in ' + TONES[r0.tone].name}.`;
    else if (parts.bri !== undefined || a.delta) say = `Das Licht ${room.in} ist ${a.delta < 0 || (parts.bri !== undefined && parts.bri < before[0]) ? 'auf ' + pctOf(r0) + ' Prozent gedimmt' : 'jetzt auf ' + pctOf(r0) + ' Prozent'}.`;
    else say = `Das Licht ${room.in} ist an.`;
    if (toggled && r0.on) say = `Das Licht ${room.in} ist jetzt an.`;
    return { say, card: lightCard(ids) };
  }

  function sceneCommand(id) {
    const sc = runScene(id);
    if (!sc) return { say: 'Welche Szene? „Guten Morgen“, „Film“, „Gute Nacht“ oder „Alles aus“.', emotion: 'thinking' };
    V.sound.play('success');
    return { say: sc.say, card: iconCard(sc.icon, sc.color, sc.name, sc.sub), emotion: sc.id === 'nacht' ? 'sleepy' : 'happy' };
  }

  function thermoCommand(a, src) {
    const th = st().thermo;
    let note = '';
    if (a.on === false || /^(false|aus|off|0)$/i.test(String(a.on))) {
      setThermoRaw(undefined, false);
      changed({ what: 'thermo', focus: 'klima', src });
      return { say: 'Die Heizung ist aus.', card: thermoCard() };
    }
    let v = th.target;
    if (a.temp !== undefined && a.temp !== null && a.temp !== '' && isFinite(Number(a.temp))) {
      v = Number(a.temp);
      if (v > T_MAX) note = ` Mehr als ${T_MAX} Grad geht nicht.`;
      if (v < T_MIN) note = ` Weniger als ${T_MIN} Grad geht nicht.`;
    } else if (a.delta) v = th.target + Number(a.delta);
    setThermoRaw(v, true);
    if (src !== 'scene') st().scene = null;
    changed({ what: 'thermo', focus: 'klima', src });
    pulse(modeColor(thermoMode()));
    const m = thermoMode();
    const tail = m === 'heat' ? ' Ich heize auf.' : m === 'cool' ? ' Ich lasse es etwas abkühlen.' : '';
    return { say: `Die Heizung steht auf ${fmtT(st().thermo.target)} Grad.${note || tail}`, card: thermoCard(), emotion: 'happy' };
  }

  function blindsCommand(a, src) {
    let ids;
    if (a.room === undefined || a.room === null || a.room === '') ids = BLIND_ROOMS.slice();
    else {
      ids = resolveRooms(a.room);
      if (!ids) return { say: 'Diesen Raum kenne ich nicht.', emotion: 'confused' };
      ids = ids.filter((id) => ROOM[id].blinds);
      if (!ids.length) return { say: `${ROOM[resolveRooms(a.room)[0]].name}: Dort gibt es keine Rollos.`, emotion: 'confused' };
    }
    const pos = U.clamp(Math.round(Number(a.position)), 0, 100);
    if (!isFinite(pos)) return { say: 'Wie weit sollen die Rollos auf?', emotion: 'confused' };
    ids.forEach((id) => setBlinds(id, pos, src));
    changed({ what: 'blinds', rooms: ids, focus: ids.length === 1 ? ids[0] : null, src });
    const where = ids.length === BLIND_ROOMS.length ? 'Alle Rollos' : ids.length === 1 ? 'Rollo · ' + ROOM[ids[0]].name : ids.length + ' Rollos';
    const say = ids.length === 1
      ? (pos <= 1 ? `Das Rollo ${ROOM[ids[0]].in} fährt herunter.` : pos >= 99 ? `Das Rollo ${ROOM[ids[0]].in} fährt hoch.` : `Das Rollo ${ROOM[ids[0]].in} fährt auf ${pos} Prozent.`)
      : (pos <= 1 ? 'Die Rollos fahren herunter.' : pos >= 99 ? 'Die Rollos fahren hoch.' : `Die Rollos fahren auf ${pos} Prozent.`);
    return { say, card: iconCard('blinds', '#64D2FF', blindsText(pos), where) };
  }

  function coffeeCommand(on, src) {
    setCoffee(on, src);
    changed({ what: 'coffee', focus: 'kueche', src });
    pulse(on ? COFFEE : '#8E8E93');
    return { say: on ? 'Die Kaffeemaschine läuft. Ich sage dir, wenn der Kaffee fertig ist.' : 'Die Kaffeemaschine ist aus.', card: iconCard('coffee', COFFEE, on ? 'An' : 'Aus', 'Kaffeemaschine · Küche'), emotion: on ? 'happy' : undefined };
  }

  function statusAnswer() {
    const on = ROOMS.filter((r) => roomState(r.id).on);
    const th = st().thermo, cur = curTemp();
    let say = on.length === 0 ? 'Alle Lichter sind aus.' : on.length === ROOMS.length ? 'Überall brennt Licht.' : `Licht brennt ${joinList(on.map((r) => r.in))}.`;
    say += th.on ? ` Die Heizung steht auf ${fmtT(th.target)} Grad, drinnen sind es ${fmt1(cur)} Grad.` : ` Die Heizung ist aus, drinnen sind es ${fmt1(cur)} Grad.`;
    return { say, card: lightCard(ROOMS.map((r) => r.id), th.on ? 'Heizung ' + fmtT(th.target) + ' °C' : 'Heizung aus') };
  }

  /* ------------------------------------------------------------ Stile */
  function styles() {
    const hueStops = [], ringStops = [];
    for (let h = 0; h <= 360; h += 20) { hueStops.push(hueHex(h % 360)); ringStops.push(hueHex(h % 360) + ' ' + ((h / 360) * HUE_SPAN).toFixed(1) + 'deg'); }
    V.css('home', `
.hm-root { overflow: hidden; }
.hm-root .vos-svg { pointer-events: none; }
.hm-layer { position: absolute; inset: 0; pointer-events: none; }
.hm-page { position: absolute; inset: 0; will-change: transform, opacity; transform-origin: 50% 50%; }
.hm-halo { position: absolute; width: 84cqw; height: 84cqw; left: 8cqw; border-radius: 50%; pointer-events: none; will-change: transform, background; }
.hm-bulb { position: absolute; left: 50%; width: 24cqw; height: 30cqw; margin-left: -12cqw; padding: 0; border: 0; background: none; cursor: pointer;
  transition: transform .4s var(--spring); -webkit-tap-highlight-color: transparent; }
.hm-bulb:active { transform: scale(.93); }
.hm-bulb svg { width: 100%; height: 100%; display: block; overflow: visible; }
.hm-pct { position: absolute; left: 0; right: 0; text-align: center; font-size: 13.5cqw; font-weight: 200; letter-spacing: -.045em; line-height: 1; white-space: nowrap; }
.hm-pct small { font-size: .4em; font-weight: 300; letter-spacing: 0; margin-left: .12em; color: rgba(255,255,255,.55); vertical-align: .95em; }
.hm-pct.off { font-size: 9cqw; font-weight: 250; letter-spacing: -.02em; color: rgba(255,255,255,.5); }
.hm-sub { position: absolute; left: 0; right: 0; text-align: center; white-space: nowrap; }
.hm-chip { position: absolute; width: 11cqw; height: 11cqw; margin: -5.5cqw 0 0 -5.5cqw; border-radius: 50%; border: 0; padding: 0;
  background: none; cursor: pointer; display: grid; place-items: center; transition: transform .35s var(--spring); }
.hm-chip:active { transform: scale(.86); }
.hm-dot { width: 7.6cqw; height: 7.6cqw; border-radius: 50%; position: relative;
  box-shadow: inset 0 0 0 .22cqw rgba(255,255,255,.2), inset 0 -.9cqw 1.6cqw rgba(0,0,0,.22);
  transition: transform .45s var(--spring), box-shadow .35s ease; }
.hm-chip.on .hm-dot { transform: scale(1.14); box-shadow: 0 0 0 .5cqw #000, 0 0 0 .85cqw rgba(255,255,255,.95), 0 0 4.5cqw var(--g); }
.hm-chip.sel .hm-dot { box-shadow: 0 0 0 .5cqw #000, 0 0 0 .85cqw rgba(255,255,255,.3); }
.hm-wheel .hm-dot { background: conic-gradient(${hueStops.join(',')}); }
.hm-wheel .hm-dot::after { content: ''; position: absolute; inset: 1.9cqw; border-radius: 50%; background: #000; }
.hm-side { position: absolute; width: 12cqw; height: 12cqw; margin: -6cqw 0 0 -6cqw; border-radius: 50%; border: 0; padding: 0;
  background: rgba(255,255,255,.09); color: rgba(255,255,255,.82); display: grid; place-items: center; cursor: pointer;
  transition: transform .35s var(--spring), background .35s, color .35s, box-shadow .35s; }
.hm-side svg { width: 5.4cqw; height: 5.4cqw; }
.hm-side:active { transform: scale(.88); }
.hm-side.on { background: var(--c); color: #160b02; box-shadow: 0 0 5cqw var(--g); }
.hm-sidelbl { position: absolute; width: 22cqw; margin-left: -11cqw; text-align: center; font-size: 3cqw; font-weight: 600;
  color: rgba(255,255,255,.48); font-variant-numeric: tabular-nums; white-space: nowrap; letter-spacing: .01em; }
.hm-tnum { position: absolute; left: 0; right: 0; display: flex; justify-content: center; align-items: flex-start; line-height: 1;
  font-size: 23cqw; font-weight: 200; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
.hm-tnum .hm-deg { font-size: .36em; font-weight: 250; margin: .1em 0 0 .06em; letter-spacing: 0; color: rgba(255,255,255,.75); }
.hm-scene { position: absolute; width: 17cqw; height: 17cqw; margin: -8.5cqw 0 0 -8.5cqw; border-radius: 50%; border: 0; padding: 0; cursor: pointer;
  display: grid; place-items: center; color: var(--c); background: radial-gradient(circle at 50% 28%, var(--c1), var(--c2) 72%);
  box-shadow: inset 0 0 0 .3cqw var(--c3); transition: transform .4s var(--spring), background .45s, color .45s, box-shadow .45s; }
.hm-scene svg { width: 7.4cqw; height: 7.4cqw; }
.hm-scene:active { transform: scale(.9); }
.hm-scene.on { background: radial-gradient(circle at 50% 30%, var(--cl), var(--c) 70%); color: #0b0b0e; box-shadow: 0 0 8cqw var(--c4); }
.hm-scenelbl { position: absolute; width: 32cqw; margin-left: -16cqw; text-align: center; font-size: 3.5cqw; font-weight: 600; color: rgba(255,255,255,.7); white-space: nowrap; }
.hm-subview { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; background: #000; will-change: transform, opacity; }
.hm-huering { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from ${HUE_A0}deg, ${ringStops.join(',')}, transparent ${HUE_SPAN}deg);
  -webkit-mask: radial-gradient(circle closest-side, transparent 80.5%, #000 81.2%, #000 95.8%, transparent 96.5%);
  mask: radial-gradient(circle closest-side, transparent 80.5%, #000 81.2%, #000 95.8%, transparent 96.5%); }
.hm-cap { position: absolute; width: 7.3cqw; height: 7.3cqw; margin: -3.65cqw 0 0 -3.65cqw; border-radius: 50%; pointer-events: none; }
.hm-knob { position: absolute; width: 9cqw; height: 9cqw; margin: -4.5cqw 0 0 -4.5cqw; border-radius: 50%; pointer-events: none;
  box-shadow: 0 0 0 .7cqw #fff, 0 .8cqw 2.4cqw rgba(0,0,0,.55); }
.hm-card { display: flex; align-items: center; gap: 3.4cqw; background: rgba(255,255,255,.08); padding: 2.4cqw 6cqw 2.4cqw 2.4cqw; border-radius: 99cqw; }
.hm-card b { display: block; font-size: 5.6cqw; font-weight: 650; letter-spacing: -.02em; white-space: nowrap; line-height: 1.12; }
.hm-card small { display: block; font-size: 3.3cqw; color: rgba(255,255,255,.55); white-space: nowrap; }
.hm-orb { flex: none; width: 13cqw; height: 13cqw; border-radius: 50%; display: grid; place-items: center; }
.hm-orb svg { width: 6.2cqw; height: 6.2cqw; }
.hm-orbs { display: flex; gap: 1.2cqw; padding-left: 1.4cqw; }
.hm-orbs .hm-orb { width: 6cqw; height: 6cqw; }
.hm-mini { width: 13cqw; height: 13cqw; flex: none; overflow: visible; }
`);
  }

  /* ------------------------------------------------------------ eigene Federn (laufen nur im App-Takt) */
  function spring(v, response, bounce, eps) {
    const s = { v, to: v, vel: 0, delay: 0, eps: eps || 1e-3 };
    tune(s, response || 0.5, bounce || 0);
    return s;
  }
  function tune(s, response, bounce) {
    const w = (2 * Math.PI) / response;
    s.k = w * w; s.c = 2 * (1 - (bounce || 0)) * w;
    return s;
  }
  function aim(s, to, o) {
    s.to = to;
    if (o && o.delay !== undefined) s.delay = o.delay;
    if (o && o.response) tune(s, o.response, o.bounce || 0);
  }
  function step(s, dt) {
    if (s.delay > 0) { s.delay -= dt; if (s.delay > 0) return; }
    if (s.v === s.to && s.vel === 0) return;
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) { const acc = -s.k * (s.v - s.to) - s.c * s.vel; s.vel += acc * h; s.v += s.vel * h; }
    if (Math.abs(s.vel) < s.eps * 10 && Math.abs(s.v - s.to) < s.eps) { s.v = s.to; s.vel = 0; }
  }

  /* ------------------------------------------------------------ Glühbirne (SVG) */
  const BULB_D = 'M 88 204 C 88 176 40 152 40 106 A 80 80 0 1 1 200 106 C 200 152 152 176 152 204 Z';
  const FIL_D = 'M 104 203 L 108 148 M 136 203 L 132 148 M 108 148 C 108 134 114 131 116 139 C 118 147 122 147 124 139 C 126 131 132 134 132 148';
  function buildBulb() {
    const gid = U.uid('hmg');
    const svg = U.svg('svg', { viewBox: '0 0 240 300', 'aria-hidden': 'true' });
    const grad = U.svg('radialGradient', { id: gid, cx: '50%', cy: '36%', r: '60%', fx: '50%', fy: '30%' });
    const s0 = U.svg('stop', { offset: '0%' }), s1 = U.svg('stop', { offset: '46%' }), s2 = U.svg('stop', { offset: '100%' });
    grad.append(s0, s1, s2);
    const defs = U.svg('defs');
    defs.appendChild(grad);
    const glass = U.svg('path', { d: BULB_D, fill: `url(#${gid})`, 'stroke-width': 2.4 });
    const filGlow = U.svg('path', { d: FIL_D, fill: 'none', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const fil = U.svg('path', { d: FIL_D, fill: 'none', 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const shine = U.svg('path', { d: 'M 66 92 A 56 56 0 0 1 100 50', fill: 'none', stroke: '#ffffff', 'stroke-width': 7, 'stroke-linecap': 'round' });
    const base = U.svg('g');
    const parts = [
      U.svg('rect', { x: 86, y: 209, width: 68, height: 14, rx: 7 }),
      U.svg('rect', { x: 88, y: 226, width: 64, height: 13, rx: 6.5 }),
      U.svg('rect', { x: 92, y: 242, width: 56, height: 12, rx: 6 }),
      U.svg('path', { d: 'M 104 257 Q 120 275 136 257 Z' }),
    ];
    base.append(...parts);
    svg.append(defs, glass, filGlow, fil, shine, base);
    return { svg, s0, s1, s2, glass, fil, filGlow, shine, base };
  }
  function paintBulb(B, lvl, c) {
    const lit = 1 - Math.pow(1 - U.clamp(lvl, 0, 1), 3);
    B.s0.setAttribute('stop-color', U.mix('#3b3b40', '#ffffff', lit));
    B.s1.setAttribute('stop-color', U.mix('#202024', U.mix(c, '#ffffff', 0.12), lit));
    B.s2.setAttribute('stop-color', U.mix('#121214', U.mix(c, '#000000', 0.38), lit));
    B.glass.setAttribute('stroke', lit > 0.02 ? U.rgba(U.mix(c, '#ffffff', 0.5), 0.25 + 0.35 * lit) : 'rgba(255,255,255,.2)');
    B.fil.setAttribute('stroke', U.mix('#5c5c62', '#fffdf6', lit));
    B.filGlow.setAttribute('stroke', U.mix(c, '#ffffff', 0.5));
    B.filGlow.setAttribute('opacity', (0.45 * lit).toFixed(3));
    B.shine.setAttribute('opacity', (0.1 + 0.28 * lit).toFixed(3));
    B.base.setAttribute('fill', U.mix('#3a3a3f', U.mix(c, '#4a4a50', 0.55), lit * 0.8));
  }

  /* ------------------------------------------------------------ App */
  V.icon.add('hm-film', '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 4.5v15M16 4.5v15M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5"/>');

  V.apps.register({
    id: 'home',
    name: 'Zuhause',
    icon: 'home',
    color: APP_COLOR,
    order: 40,
    keywords: ['zuhause', 'smart home', 'smarthome', 'haus', 'licht', 'lichter', 'lampe', 'heizung', 'thermostat', 'rollo', 'rollos', 'szenen'],

    init() {
      styles();
      st();
      V.info = V.info || {};
      V.info.home = () => {
        const s = st();
        return {
          lightsOn: ROOMS.filter((r) => s.rooms[r.id].on).length,
          rooms: ROOMS.map((r) => { const x = s.rooms[r.id]; return { id: r.id, name: r.name, on: x.on, brightness: x.bri, color: colorOf(x), tone: toneName(x), blinds: x.blinds }; }),
          target: s.thermo.target, current: Math.round(curTemp() * 10) / 10, heating: s.thermo.on, mode: thermoMode(),
          coffee: s.coffee, scene: s.scene,
        };
      };
      V.on('store:reset', () => { cache = null; });

      /* --- Aktionen (werden Claude als Werkzeuge angeboten) --- */
      V.actions.register('home.light', {
        desc: 'Steuert das Licht zuhause. room: wohnzimmer, kueche, schlafzimmer, arbeitszimmer, flur oder alle (leer = zuletzt benutzter Raum). on: an/aus. brightness: Helligkeit in Prozent 1–100. color: kerzenlicht, warmweiß, neutralweiß, tageslicht, wärmer, kälter, rot, orange, gelb, grün, türkis, blau, lila, pink oder Hex wie #7A5CFF.',
        params: { room: { type: 'string', description: 'Raum-ID oder „alle“' }, on: { type: 'boolean' }, brightness: { type: 'number', description: 'Prozent 1–100' }, color: { type: 'string', description: 'Farbe oder Weißton' } },
        required: [],
        run(a) { return lightCommand(a || {}, 'voice'); },
      });
      V.actions.register('home.scene', {
        desc: 'Aktiviert eine Szene für die ganze Wohnung. name: morgen (Guten Morgen), film (Film), nacht (Gute Nacht) oder aus (Alles aus).',
        params: { name: { type: 'string', enum: ['morgen', 'film', 'nacht', 'aus'] } },
        required: ['name'],
        run(a) {
          const n = String((a && a.name) || '').toLowerCase();
          const id = SCENE[n] ? n : /morgen/.test(n) ? 'morgen' : /film|kino/.test(n) ? 'film' : /nacht/.test(n) ? 'nacht' : /aus/.test(n) ? 'aus' : null;
          return sceneCommand(id);
        },
      });
      V.actions.register('home.thermostat', {
        desc: 'Stellt die Heizung (Thermostat der ganzen Wohnung). temp: Solltemperatur in °C (10–30, halbe Grad möglich). delta: relative Änderung in °C (z. B. 1 = wärmer). on: false schaltet die Heizung aus.',
        params: { temp: { type: 'number', description: 'Solltemperatur in °C' }, delta: { type: 'number' }, on: { type: 'boolean' } },
        required: [],
        run(a) { return thermoCommand(a || {}, 'voice'); },
      });
      V.actions.register('home.blinds', {
        desc: 'Fährt Rollos. position: Öffnung in Prozent (100 = ganz offen/hoch, 0 = geschlossen/runter). room: wohnzimmer, kueche, schlafzimmer, arbeitszimmer oder leer für alle.',
        params: { room: { type: 'string' }, position: { type: 'number', description: '0 = zu, 100 = offen' } },
        required: ['position'],
        run(a) { return blindsCommand(a || {}, 'voice'); },
      });
      V.actions.register('home.coffee', {
        desc: 'Schaltet die Steckdose der Kaffeemaschine in der Küche an (on: true) oder aus.',
        params: { on: { type: 'boolean' } },
        required: ['on'],
        run(a) { return coffeeCommand(!!(a && a.on), 'voice'); },
      });
      V.actions.register('home.status', {
        desc: 'Liefert den Zustand des Zuhauses: welche Lichter an sind, Heizung, Raumtemperatur, Rollos, Kaffeemaschine.',
        params: {},
        run() {
          const r = statusAnswer();
          const s = st();
          r.data = { rooms: V.info.home().rooms, coffee: s.coffee };
          return r;
        },
      });

      /* --- Absichten (lokal, sofort) --- */
      const opt = (r, t, page) => {
        if (RE.show.test(t) && pageIndex(page) >= 0) { st().page = page; r.open = 'home'; V.emit('home:changed', { focus: page, src: 'voice' }); }
        return r;
      };

      // Fragen: „Ist das Licht in der Küche an?“, „Läuft die Kaffeemaschine?“, „Wie warm ist es drinnen?“
      V.brain.intent({
        id: 'home-query', priority: 9,
        match(t, original) {
          if (RE.exclude.test(t)) return null;
          const q = RE.question.test(t) || (/\?\s*$/.test(original || '') && !RE.request.test(t));
          if (!q) return null;
          if (RE.light.test(t)) return { k: 'light' };
          if (RE.coffee.test(t)) return { k: 'coffee' };
          if (RE.blinds.test(t)) return { k: 'blinds' };
          if (RE.heat.test(t) || (/(wie warm|wie kalt|welche temperatur|wie viel grad|wieviel grad)/.test(t) && RE.indoor.test(t))) return { k: 'heat' };
          return null;
        },
        run(m, t) {
          if (m.k === 'coffee') { const on = st().coffee; return { say: on ? 'Ja, die Kaffeemaschine läuft.' : 'Nein, die Kaffeemaschine ist aus.', card: iconCard('coffee', COFFEE, on ? 'An' : 'Aus', 'Kaffeemaschine · Küche') }; }
          if (m.k === 'heat') {
            const th = st().thermo;
            return { say: th.on ? `Drinnen sind es ${fmt1(curTemp())} Grad, die Heizung steht auf ${fmtT(th.target)} Grad.` : `Drinnen sind es ${fmt1(curTemp())} Grad, die Heizung ist aus.`, card: thermoCard() };
          }
          if (m.k === 'blinds') {
            const id = roomFrom(t);
            if (id && ROOM[id].blinds) { const p = roomState(id).blinds; return { say: `Das Rollo ${ROOM[id].in} ist ${p >= 99 ? 'ganz offen' : p <= 1 ? 'geschlossen' : 'zu ' + p + ' Prozent offen'}.`, card: iconCard('blinds', '#64D2FF', blindsText(p), 'Rollo · ' + ROOM[id].name) }; }
            const closed = BLIND_ROOMS.filter((r) => roomState(r).blinds <= 1);
            const say = closed.length === BLIND_ROOMS.length ? 'Alle Rollos sind unten.' : !closed.length ? 'Alle Rollos sind oben.' : `Unten ist das Rollo ${joinList(closed.map((r) => ROOM[r].in))}.`;
            return { say, card: iconCard('blinds', '#64D2FF', closed.length === BLIND_ROOMS.length ? 'Geschlossen' : `${BLIND_ROOMS.length - closed.length} von ${BLIND_ROOMS.length} offen`, 'Rollos') };
          }
          // Licht
          const id = roomFrom(t);
          if (!id || ALL_RE.test(t)) {
            const on = ROOMS.filter((r) => roomState(r.id).on);
            const yn = !/^(?:welche|wo|wie)/.test(t);
            const say = !on.length ? (yn ? 'Nein, alle Lichter sind aus.' : 'Gerade brennt nirgends Licht.') : on.length === ROOMS.length ? (yn ? 'Ja, überall brennt Licht.' : 'Überall brennt Licht.') : `Licht brennt ${joinList(on.map((r) => r.in))}.`;
            return { say, card: lightCard(ROOMS.map((r) => r.id)) };
          }
          const r = roomState(id), room = ROOM[id];
          if (/wie hell|helligkeit|welche farbe/.test(t) && r.on) return { say: `Das Licht ${room.in} leuchtet mit ${pctOf(r)} Prozent in ${toneName(r)}.`, card: lightCard([id]) };
          return { say: r.on ? `Ja, ${room.in} brennt Licht – ${pctOf(r)} Prozent in ${toneName(r)}.` : `Nein, das Licht ${room.in} ist aus.`, card: lightCard([id]) };
        },
      });

      // Szenen: „Szene Film“, „Aktiviere Gute Nacht“, „Alles aus“, „Filmabend“
      V.brain.intent({
        id: 'home-scene', priority: 9,
        match(t) {
          if (RE.exclude.test(t)) return null;
          const which = (s) => /guten morgen|morgen|aufwachen|aufstehen/.test(s) ? 'morgen' : /film|kino/.test(s) ? 'film' : /gute ?nacht|schlafen|nachtruhe/.test(s) ? 'nacht' : /alles aus|(?<![a-zäöüß])aus$/.test(s) ? 'aus' : null;
          if (W('szene|szenen|stimmung|routine').test(t) || /^(?:aktiviere|starte|spiel)\w* (?:die )?(?:guten morgen|gute nacht|film)/.test(t)) return { s: which(t.replace(/szenen?|stimmung|routine/g, '')) };
          if (/^(?:bitte )?(?:mach |schalte |schalt )?(?:überall |hier )?alles aus(?: bitte)?$/.test(t)) return { s: 'aus' };
          if (W('filmabend|filmmodus|kinomodus|kinoabend|heimkino|filmzeit').test(t) || /zeit für (?:einen|nen) film/.test(t)) return { s: 'film' };
          return null;
        },
        run(m, t) { return opt(sceneCommand(m.s), t, 'szenen'); },
      });

      // Kaffeemaschine
      V.brain.intent({
        id: 'home-coffee', priority: 9,
        match(t) { return RE.coffee.test(t) && !RE.exclude.test(t) && !/kalorien|koffein|rezept|wie viel|wieviel|bohnen/.test(t) ? {} : null; },
        run(m, t) { return opt(coffeeCommand(!RE.off.test(t), 'voice'), t, 'kueche'); },
      });

      // Rollos: „Rollos runter“, „Rollo im Schlafzimmer auf 40 Prozent“
      V.brain.intent({
        id: 'home-blinds', priority: 9,
        match(t) { return RE.blinds.test(t) && !RE.exclude.test(t) ? {} : null; },
        run(m, t) {
          let pos = null;
          const pm = t.match(RE.pct);
          if (pm) pos = +pm[1];
          else if (W('runter|herunter|hinunter|zu|schließen|schließe|schliess\\w*|dicht|unten|zumachen|ab|abdunkeln').test(t)) pos = 0;
          else if (W('halb|halbe|hälfte|halbwegs').test(t)) pos = 50;
          else if (W('hoch|rauf|herauf|hinauf|auf|öffnen|öffne|oben|aufmachen|aufziehen').test(t)) pos = 100;
          const id = roomFrom(t);
          if (pos === null) {
            if (RE.show.test(t) || !id) { st().page = id || st().page; return { say: 'Wie weit sollen die Rollos auf? Sag zum Beispiel „Rollos runter“.', emotion: 'thinking' }; }
            pos = roomState(id).blinds > 50 ? 0 : 100;
          }
          const plural = /rollos|rolläden|rollläden|jalousien|vorhänge|markisen/.test(t);
          const room = id && !ALL_RE.test(t) ? id : plural || ALL_RE.test(t) ? null : (ROOM[defaultRoom()].blinds ? defaultRoom() : null);
          return opt(blindsCommand({ room, position: pos }, 'voice'), t, room || 'wohnzimmer');
        },
      });

      // Licht: „Licht an im Wohnzimmer“, „Dimme das Licht auf 30 Prozent“, „Mach das Licht wärmer/blau“
      V.brain.intent({
        id: 'home-light', priority: 9,
        match(t) {
          if (RE.exclude.test(t)) return null;
          if (RE.light.test(t)) return {};
          if (/^(?:(?:mach|schalte|schalt) )?(?:das |die |den )?(?:im |in der )?(?:wohnzimmer|küche|schlafzimmer|arbeitszimmer|flur|büro) (?:an|aus|ein)$/.test(t)) return {};
          return null;
        },
        run(m, t) {
          const id = roomFrom(t);
          const all = ALL_RE.test(t) || /lichter|lampen/.test(t) && !id;
          const a = { room: all ? 'alle' : id || undefined };
          const r = roomState(all ? defaultRoom() : id || defaultRoom());
          const pm = t.match(RE.pct) || (/dimm|hell/.test(t) && t.match(/(?:auf|zu) (\d{1,3})(?![\d.,]| ?(?:grad|°|uhr|minuten))/));
          if (pm) a.brightness = +pm[1];
          else if (W('ganz hell|volle helligkeit|voll|maximal|maximum|hellste').test(t)) a.brightness = 100;
          else if (W('halb|halbe helligkeit').test(t)) a.brightness = 50;
          else if (W('heller').test(t)) a.delta = 0.2;
          else if (W('dunkler').test(t)) a.delta = -0.2;
          else if (/dimm/.test(t)) a.delta = r.on && r.bri > 0.35 ? -0.25 : 0;
          else if (W('gedimmt|dunkel|schwach|sanft|leise').test(t)) a.brightness = 20;
          else if (W('gemütlich|kuschelig|romantisch').test(t)) a.brightness = 35;
          const c = colorFromText(t, r);
          if (c) a.color = W('wärmer|gemütlicher').test(t) ? 'wärmer' : W('kälter|kühler|frischer').test(t) ? 'kälter' : c.tone === 'hue' ? hueHex(c.hue) : c.tone;
          // „Zeig mir das Licht im Wohnzimmer“: nur zeigen, nichts schalten
          if (RE.show.test(t) && !c && a.brightness === undefined && !a.delta && !RE.off.test(t) && !RE.on.test(t)) {
            const rid = all ? defaultRoom() : id || defaultRoom();
            const x = roomState(rid);
            return opt({ say: x.on ? `Das Licht ${ROOM[rid].in} leuchtet mit ${pctOf(x)} Prozent.` : `Das Licht ${ROOM[rid].in} ist aus.`, card: lightCard([rid]) }, t, rid);
          }
          if (RE.off.test(t)) a.on = false;
          else if (RE.on.test(t) && a.brightness === undefined && !a.delta) a.on = true;
          if (a.delta === 0) delete a.delta;
          const res = lightCommand(a, 'voice');
          return opt(res, t, all ? defaultRoom() : id || defaultRoom());
        },
      });

      // Heizung: „Stell die Heizung auf 21 Grad“, „Mach es wärmer“, „Mir ist kalt“, „Heizung aus“
      V.brain.intent({
        id: 'home-thermo', priority: 9,
        match(t) {
          if (RE.exclude.test(t) || RE.light.test(t)) return null;
          if (/draußen|wetter|vorhersage|morgen früh|übermorgen/.test(t)) return null;
          if (RE.heat.test(t)) return { k: 'heat' };
          if (/(?<![a-zäöüß])temperatur/.test(t) && (RE.indoor.test(t) || /^(?:stell|setz|dreh|mach)/.test(t))) return { k: 'heat' };
          if (/^(?:bitte )?(?:mach|stell|dreh|heiz)\w*(?: es| die wohnung| das zimmer| hier)?(?: bitte)?(?: noch)?(?: etwas| ein bisschen| ein wenig| ein paar grad| um)?(?: \d+(?:[.,]\d)? grad)? (?:wärmer|kälter|kühler)/.test(t)) return { k: 'rel' };
          if (/^(?:es ist |mir ist )(?:es )?(?:hier )?(?:zu |so |ziemlich |echt |sehr |etwas )?(?:kalt|warm|heiß|frisch|kühl)(?![a-zäöüß])/.test(t)) return { k: 'feel' };
          if (/^(?:etwas |ein bisschen |ein wenig |noch )?(?:wärmer|kälter|kühler)(?: bitte)?$/.test(t)) return { k: 'rel' };
          return null;
        },
        run(m, t) {
          // relativ: „um 2 Grad wärmer“, „2 Grad kälter“
          const rel = t.match(/(?:um )?(\d+(?:[.,]\d)?)\s*(?:grad|°)\s*(?:wärmer|kälter|kühler|höher|niedriger|mehr|weniger|hoch|runter|rauf)/) || t.match(/(?<![a-zäöüß])um (\d+(?:[.,]\d)?)\s*(?:grad|°)/);
          const tm = !rel && t.match(/(\d{1,2})(?:\s*(?:[.,]|komma)\s*(\d))?(?:\s*(?:einhalb|1\/2))?\s*(?:grad|°)?/);
          if (tm) {
            let v = +tm[1] + (tm[2] ? +tm[2] / 10 : 0);
            if (/einhalb|1\/2/.test(t)) v += 0.5;
            return opt(thermoCommand({ temp: v }, 'voice'), t, 'klima');
          }
          const amount = rel ? parseFloat(rel[1].replace(',', '.')) : 1;
          if (W('wärmer|höher|hoch|rauf|hochdrehen|aufdrehen|hochstellen|mehr').test(t) || /(?<![a-zäöüß])auf$/.test(t) || /kalt|frisch|kühl$/.test(t) && m.k === 'feel') return opt(thermoCommand({ delta: amount }, 'voice'), t, 'klima');
          if (W('kälter|kühler|niedriger|runter|herunter|weniger|absenken|senken|runterdrehen|zurückdrehen|kleiner').test(t) || m.k === 'feel') return opt(thermoCommand({ delta: -amount }, 'voice'), t, 'klima');
          if (RE.off.test(t)) return opt(thermoCommand({ on: false }, 'voice'), t, 'klima');
          if (RE.on.test(t)) { setThermoRaw(undefined, true); changed({ what: 'thermo', src: 'voice' }); return opt({ say: `Die Heizung ist an und steht auf ${fmtT(st().thermo.target)} Grad.`, card: thermoCard() }, t, 'klima'); }
          const th = st().thermo;
          return opt({ say: th.on ? `Die Heizung steht auf ${fmtT(th.target)} Grad, drinnen sind es ${fmt1(curTemp())} Grad.` : `Die Heizung ist aus, drinnen sind es ${fmt1(curTemp())} Grad.`, card: thermoCard() }, t, 'klima');
        },
      });

      // Überblick: „Status Zuhause“, „Welche Lichter sind an?“ (Fragen deckt home-query ab)
      V.brain.intent({
        id: 'home-status', priority: 8,
        match: [/(?<![a-zäöüß])(?:status|übersicht|zustand)(?![a-zäöüß]).*(?:zuhause|wohnung|haus|smart ?home|geräte)/, /^(?:was ist los|wie sieht es aus|wie sieht's aus|alles ok|alles in ordnung) (?:zuhause|daheim|in der wohnung)/, /^(?:zuhause|smart ?home) ?(?:status)?$/],
        run() { return statusAnswer(); },
      });
    },

    create(ctx) {
      const root = ctx.root;
      const S = st();
      root.classList.add('hm-root');
      root.setAttribute('data-nogesture', 'all');

      let pageI = pageIndex((ctx.params && ctx.params.page) || S.page);
      if (pageI < 0) pageI = 1;
      const pos = spring(pageI, 0.5, 0.04, 2e-4);
      let sub = null;                         // offene Unteransicht (Rollo, Farbrad)
      const subT = spring(0, 0.42, 0.04, 1e-3);
      let suppressClick = false;

      // angezeigte (animierte) Werte je Raum
      const shown = {};
      for (const r of ROOMS) {
        const x = S.rooms[r.id], rgb = U.hexToRgb(colorOf(x));
        shown[r.id] = {
          lvl: spring(levelOf(x), 0.4, 0, 5e-4),
          r: spring(rgb[0], 0.5, 0, 0.05), g: spring(rgb[1], 0.5, 0, 0.05), b: spring(rgb[2], 0.5, 0, 0.05),
          blinds: spring(x.blinds === null ? 100 : x.blinds, 0.9, 0, 0.05),
        };
      }
      const thTarget = spring(S.thermo.target, 0.38, 0.08, 1e-3);
      const SPRINGS = [pos, subT, thTarget];
      for (const id in shown) { const s = shown[id]; SPRINGS.push(s.lvl, s.r, s.g, s.b, s.blinds); }

      /** Federziele auf den gespeicherten Zustand setzen (o.stagger = Szene: gestaffelt) */
      function sync(o = {}) {
        const s = st();
        ROOMS.forEach((r, i) => {
          const x = s.rooms[r.id], sh = shown[r.id], rgb = U.hexToRgb(colorOf(x));
          const opt = o.stagger ? { delay: 0.08 + i * 0.12, response: 0.85 } : o.drag ? { delay: 0, response: 0.14 } : { delay: 0, response: 0.42 };
          aim(sh.lvl, levelOf(x), opt);
          const copt = Object.assign({}, opt, { response: o.drag ? 0.2 : o.stagger ? 0.9 : 0.5 });
          aim(sh.r, rgb[0], copt); aim(sh.g, rgb[1], copt); aim(sh.b, rgb[2], copt);
          if (x.blinds !== null) aim(sh.blinds, x.blinds, { delay: o.stagger ? 0.1 + i * 0.12 : 0, response: o.drag ? 0.16 : 1.1 });
        });
        aim(thTarget, s.thermo.target, { delay: o.stagger ? 0.5 : 0, response: o.drag ? 0.22 : 0.45, bounce: o.drag ? 0 : 0.08 });
        for (const P of pageObjs) if (P.refresh) P.refresh();
        if (sub && sub.refresh) sub.refresh();
      }

      /* ---------------------------------------------- feste Ebenen */
      const glow = U.el('div', { class: 'hm-layer' });
      const rimSvg = U.svg('svg', { class: 'vos-svg hm-layer', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      const blurId = U.uid('hmblur');
      const fdefs = U.svg('defs');
      const filt = U.svg('filter', { id: blurId, x: '-30%', y: '-30%', width: '160%', height: '160%' });
      filt.appendChild(U.svg('feGaussianBlur', { stdDeviation: 9 }));
      fdefs.appendChild(filt);
      rimSvg.appendChild(fdefs);

      // Lichtregler: Spur, Rastpunkte, Sonnen an den Enden
      const lightG = U.svg('g');
      lightG.appendChild(U.svg('path', { d: V.ui.arcPath(500, 500, RIM_R, L_A0, L_A0 + L_SPAN), fill: 'none', stroke: 'rgba(255,255,255,.085)', 'stroke-width': 12, 'stroke-linecap': 'round' }));
      for (let i = 1; i < 10; i++) { const p = V.display.pt(L_A0 + (L_SPAN * i) / 10, RIM_R); lightG.appendChild(U.svg('circle', { cx: p.x, cy: p.y, r: 1.8, fill: 'rgba(255,255,255,.28)' })); }
      const sunAt = (a, size, op) => {
        const p = V.display.pt(a, 448);
        const g = U.frag(V.icon('sun'));
        g.setAttribute('x', p.x - size / 2); g.setAttribute('y', p.y - size / 2); g.setAttribute('width', size); g.setAttribute('height', size);
        g.setAttribute('color', `rgba(255,255,255,${op})`);
        return g;
      };
      lightG.append(sunAt(L_A0 - 4, 26, 0.3), sunAt(L_A0 + L_SPAN + 4, 34, 0.45));

      // Thermostat: feine Striche rundherum
      const thermoG = U.svg('g');
      const heatGlow = U.svg('path', { fill: 'none', 'stroke-width': 24, 'stroke-linecap': 'round', filter: `url(#${blurId})`, opacity: 0.38 });
      thermoG.appendChild(heatGlow);
      const ticks = [];
      for (let i = 0; i <= T_SPAN / 2; i++) {
        const a = T_A0 + i * 2, major = i % 7 === 0;
        const ln = U.svg('line', { x1: 500, y1: 500 - 470, x2: 500, y2: 500 - (major ? 428 : 438), transform: `rotate(${a} 500 500)`, 'stroke-linecap': 'round' });
        thermoG.appendChild(ln);
        ticks.push({ el: ln, a, major, k: '' });
      }
      const curMark = U.svg('g');
      curMark.appendChild(U.svg('circle', { cx: 500, cy: 500 - 487, r: 5.5, fill: '#fff', opacity: 0.9 }));
      const tgtGlow = U.svg('line', { x1: 500, y1: 500 - 478, x2: 500, y2: 500 - 420, 'stroke-width': 18, 'stroke-linecap': 'round', filter: `url(#${blurId})` });
      const tgtMark = U.svg('line', { x1: 500, y1: 500 - 478, x2: 500, y2: 500 - 420, stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round' });
      const tgtG = U.svg('g');
      tgtG.append(tgtGlow, tgtMark);
      thermoG.append(curMark, tgtG);
      rimSvg.append(lightG, thermoG);

      // Seitennamen am oberen Bogen (drehen beim Wischen mit)
      const LR = 404, LS = 25;
      const ringSvg = U.svg('svg', { class: 'vos-svg hm-layer', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      const arcId = U.uid('hmarc');
      ringSvg.appendChild(U.svg('path', { id: arcId, d: V.ui.arcPath(500, 500, LR - LS * 0.36, -175, 175), fill: 'none', stroke: 'none' }));
      const mcv = document.createElement('canvas').getContext('2d');
      const labels = PAGES.map((p) => {
        const g = U.svg('g');
        const tx = U.svg('text', { 'font-size': LS, 'font-weight': 700, 'letter-spacing': 4.5, fill: '#fff', 'font-family': "'Inter Tight', system-ui, sans-serif" });
        const tp = U.svg('textPath', { href: '#' + arcId, startOffset: '50%', 'text-anchor': 'middle' });
        tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + arcId);
        tp.textContent = p.name.toUpperCase();
        tx.appendChild(tp); g.appendChild(tx); ringSvg.appendChild(g);
        return { g, w: 0, c: 0 };
      });
      function measureLabels() {
        mcv.font = `700 ${LS}px 'Inter Tight', system-ui, sans-serif`;
        let acc = 0;
        labels.forEach((L, i) => {
          const name = PAGES[i].name.toUpperCase();
          const w = mcv.measureText(name).width + 4.5 * (name.length - 1);
          L.w = U.deg(w / LR);
          if (i) acc += labels[i - 1].w / 2 + 10 + L.w / 2;
          L.c = acc;
        });
      }
      measureLabels();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureLabels(); lastRing = -1; });

      const pagesEl = U.el('div', { class: 'hm-layer', style: { pointerEvents: 'auto' } });
      root.append(glow, rimSvg, pagesEl, ringSvg);

      /* ---------------------------------------------- Hilfen */
      function tap(el, fn, sound) {
        el.addEventListener('click', (e) => {
          if (suppressClick || (V.shell && V.shell.swallowClick)) return;
          if (sound !== false) V.sound.play(sound || 'tap');
          V.haptic(6);
          fn(e);
        });
        return el;
      }
      const at = (x, y) => ({ left: x / 10 + 'cqw', top: y / 10 + 'cqw' });
      const curPage = () => PAGES[U.clamp(Math.round(pos.v), 0, PAGES.length - 1)];
      function goPage(i, o = {}) {
        i = U.clamp(i, 0, PAGES.length - 1);
        aim(pos, i, { response: o.response || (Math.abs(i - pos.v) > 1.5 ? 0.75 : 0.5), bounce: 0.04 });
        if (o.velocity !== undefined) pos.vel = o.velocity;
        settlePage(i);
      }
      function settlePage(i) {
        const p = PAGES[i];
        const s = st();
        if (s.page !== p.id) { s.page = p.id; if (p.kind === 'room') s.room = p.id; V.store.save(); }
      }

      /* ---------------------------------------------- Seiten */
      const CHIPS = [
        { tone: 'kerze' }, { tone: 'warm' }, { tone: 'neutral' }, { tone: 'kalt' }, { tone: 'hue' }, { wheel: true },
      ];
      const CHIP_A = [235, 213, 191, 169, 147, 125], CHIP_R = 318;
      const BULB_TOP = 150;                  // logisch
      const GLASS_Y = BULB_TOP + (106 / 300) * 300;

      function buildRoomPage(P) {
        const room = P.room;
        const el = U.el('div', { class: 'hm-page' });
        const halo = U.el('div', { class: 'hm-halo', style: { top: (GLASS_Y - 420) / 10 + 'cqw' } });
        const bulb = U.el('button', { class: 'hm-bulb', attrs: { type: 'button', 'aria-label': 'Licht ' + room.name + ' an oder aus' }, style: { top: BULB_TOP / 10 + 'cqw' } });
        const B = buildBulb();
        bulb.appendChild(B.svg);
        const pct = U.el('div', { class: 'hm-pct vos-num', style: { top: '47.4cqw' } });
        const tone = U.el('div', { class: 'hm-sub vos-label', style: { top: '61.8cqw', letterSpacing: '.11em' } });
        el.append(halo, bulb, pct, tone);
        tap(bulb, () => {
          const x = roomState(room.id);
          setLight(room.id, { on: !x.on }, 'ui');
          V.haptic(x.on ? 10 : 6);
          changed({ what: 'light', rooms: [room.id], src: 'ui' });
        }, 'tap');
        // Farb-Chips am unteren Bogen
        const chips = CHIPS.map((c, i) => {
          const p = V.display.pt(CHIP_A[i], CHIP_R);
          const label = c.wheel ? 'Farbrad' : c.tone === 'hue' ? 'Eigene Farbe' : TONES[c.tone].name;
          const b = U.el('button', { class: 'hm-chip' + (c.wheel ? ' hm-wheel' : ''), attrs: { type: 'button', 'aria-label': label }, style: at(p.x, p.y) });
          const dot = U.el('span', { class: 'hm-dot' });
          b.appendChild(dot);
          tap(b, () => {
            if (c.wheel) { openHue(room.id); return; }
            const o = c.tone === 'hue' ? { tone: 'hue', hue: st().customHue } : { tone: c.tone };
            setLight(room.id, o, 'ui');
            changed({ what: 'light', rooms: [room.id], src: 'ui' });
          });
          el.appendChild(b);
          return { b, dot, c };
        });
        // Seitenknöpfe: Rollo (links), Kaffeemaschine bzw. Klima (rechts)
        const sides = [];
        const side = (x, icon, lblText, fn, aria) => {
          const b = U.el('button', { class: 'hm-side', attrs: { type: 'button', 'aria-label': aria }, html: V.icon(icon), style: at(x, 452) });
          const l = U.el('div', { class: 'hm-sidelbl', style: at(x, 526), text: lblText });
          tap(b, fn);
          el.append(b, l);
          const o = { b, l };
          sides.push(o);
          return o;
        };
        const blindsBtn = room.blinds ? side(186, 'blinds', '', () => openBlinds(room.id), 'Rollo ' + room.name) : null;
        // im Flur: der Schalter an der Wohnungstür – alles aus beim Gehen
        if (!room.blinds) side(186, 'power', 'Alles aus', () => { runScene('aus'); V.sound.play('success'); }, 'Alles ausschalten');
        const rightBtn = room.coffee
          ? side(814, 'coffee', '', () => { const on = !st().coffee; setCoffee(on, 'ui'); changed({ what: 'coffee', src: 'ui' }); if (on) V.sound.play('success'); }, 'Kaffeemaschine')
          : side(814, 'thermo', '', () => goPage(pageIndex('klima')), 'Heizung');

        let lastPct = null, lastKey = '';
        Object.assign(P, {
          el,
          refresh() {
            const x = roomState(room.id);
            tone.textContent = x.tone === 'hue' ? hueEntry(x.hue).name : TONES[x.tone].name + ' · ' + TONES[x.tone].k + ' K';
            tone.style.color = x.on ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.26)';
            for (const ch of chips) {
              const on = !ch.c.wheel && (ch.c.tone === x.tone);
              ch.b.classList.toggle('on', on && x.on);
              ch.b.classList.toggle('sel', on && !x.on);
              if (!ch.c.wheel) {
                const col = ch.c.tone === 'hue' ? hueHex(x.tone === 'hue' ? x.hue : st().customHue) : TONES[ch.c.tone].hex;
                ch.dot.style.background = `radial-gradient(circle at 50% 32%, ${U.mix(col, '#ffffff', 0.35)}, ${col} 58%, ${U.mix(col, '#000000', 0.2)})`;
                ch.b.style.setProperty('--g', U.rgba(col, 0.55));
              }
            }
            if (blindsBtn) { const bp = x.blinds; blindsBtn.l.textContent = bp >= 99 ? 'Offen' : bp <= 1 ? 'Zu' : bp + ' %'; }
            if (room.coffee) {
              const on = st().coffee;
              rightBtn.b.classList.toggle('on', on);
              rightBtn.b.style.setProperty('--c', COFFEE);
              rightBtn.b.style.setProperty('--g', U.rgba(COFFEE, 0.5));
              rightBtn.l.textContent = on ? 'Kaffee an' : 'Kaffee';
            } else rightBtn.l.textContent = st().thermo.on ? fmtT(st().thermo.target) + ' °C' : 'Heizung aus';
          },
          frame() {
            const sh = shown[room.id];
            const lvl = U.clamp(sh.lvl.v, 0, 1);
            const c = U.rgbToHex(sh.r.v, sh.g.v, sh.b.v);
            const key = lvl.toFixed(4) + c;
            if (key === lastKey) return;
            lastKey = key;
            paintBulb(B, lvl, c);
            const lit = 1 - Math.pow(1 - lvl, 3);
            B.svg.style.filter = lit > 0.01 ? `drop-shadow(0 0 ${(1 + 3 * lit).toFixed(2)}cqw ${U.rgba(c, 0.25 + 0.45 * lit)})` : 'none';
            halo.style.background = `radial-gradient(circle, ${U.rgba(c, 0.62 * lit)} 0%, ${U.rgba(c, 0.26 * lit)} 22%, ${U.rgba(c, 0.08 * lit)} 44%, ${U.rgba(c, 0)} 64%)`;
            halo.style.transform = `scale(${(0.62 + 0.42 * Math.sqrt(lvl)).toFixed(4)})`;
            const x = roomState(room.id);
            const n = lvl < 0.004 && !x.on ? -1 : Math.max(1, Math.round(lvl * 100));
            if (n !== lastPct) {
              lastPct = n;
              pct.classList.toggle('off', n < 0);
              pct.innerHTML = n < 0 ? 'Aus' : n + '<small>%</small>';
            }
          },
        });
        P.refresh();
        return P;
      }

      function buildThermoPage(P) {
        const el = U.el('div', { class: 'hm-page' });
        const modeArc = V.ui.arcText({ text: '', r: 316, size: 27, weight: 700, spacing: 5.5 });
        const num = U.el('div', { class: 'hm-tnum', style: { top: '35.5cqw', height: '23cqw' } });
        const digitsEl = U.el('div', { style: { display: 'flex' } });
        const deg = U.el('span', { class: 'hm-deg', text: '°' });
        num.append(digitsEl, deg);
        const digits = V.faces.rollDigits(digitsEl, { digitW: '0.56em', colonW: '0.24em' });
        const cur = U.el('div', { class: 'hm-sub vos-label', style: { top: '62.4cqw' } });
        const minus = V.ui.roundButton('minus', { kind: 'sm', label: 'Kälter', onClick: () => bump(-0.5) });
        const plus = V.ui.roundButton('plus', { kind: 'sm', label: 'Wärmer', onClick: () => bump(0.5) });
        Object.assign(minus.style, at(352, 742), { position: 'absolute', margin: '-6cqw 0 0 -6cqw', background: 'rgba(255,255,255,.09)' });
        Object.assign(plus.style, at(648, 742), { position: 'absolute', margin: '-6cqw 0 0 -6cqw', background: 'rgba(255,255,255,.09)' });
        el.append(modeArc.el, num, cur, minus, plus);
        function bump(d) {
          if (suppressClick) return;
          const th = st().thermo;
          setThermoRaw(th.target + d, true);
          st().scene = null;
          changed({ what: 'thermo', src: 'ui' });
        }
        let lastNum = '', lastMode = '', lastCur = '';
        Object.assign(P, {
          el,
          refresh() {
            const th = st().thermo;
            const s = th.on ? fmtT(th.target) : 'Aus';
            if (s !== lastNum) {
              lastNum = s;
              digits.set(s);
              digitsEl.querySelectorAll('.rd-slot').forEach((sl, i) => { if (s[i] === ',') sl.style.width = '0.2em'; });
              deg.style.display = th.on ? '' : 'none';
              num.style.fontSize = th.on ? '' : '15cqw';
              num.style.paddingTop = th.on ? '' : '4cqw';
            }
            P.frame(true);
          },
          frame(force) {
            const m = thermoMode();
            if (m !== lastMode || force) {
              lastMode = m;
              const txt = { heat: 'Heizen', cool: 'Kühlen', hold: 'Temperatur gehalten', off: 'Heizung' }[m];
              modeArc.set(txt);
              modeArc.text.setAttribute('fill', m === 'hold' || m === 'off' ? 'rgba(255,255,255,.55)' : modeColor(m));
            }
            const c = 'Innen ' + fmt1(curTemp()) + ' °C';
            if (c !== lastCur) { lastCur = c; cur.textContent = c; }
          },
        });
        P.refresh();
        return P;
      }

      function buildScenesPage(P) {
        const el = U.el('div', { class: 'hm-page' });
        const POS = [[368, 380], [632, 380], [368, 630], [632, 630]];
        const discs = SCENES.map((sc, i) => {
          const [x, y] = POS[i];
          const b = U.el('button', { class: 'hm-scene', attrs: { type: 'button', 'aria-label': 'Szene ' + sc.name }, html: V.icon(sc.icon), style: at(x, y) });
          b.style.setProperty('--c', sc.color);
          b.style.setProperty('--cl', U.mix(sc.color, '#ffffff', 0.35));
          b.style.setProperty('--c1', U.rgba(sc.color, 0.34));
          b.style.setProperty('--c2', U.rgba(sc.color, 0.1));
          b.style.setProperty('--c3', U.rgba(sc.color, 0.3));
          b.style.setProperty('--c4', U.rgba(sc.color, 0.55));
          // Beschriftung außen: obere Reihe darüber, untere darunter
          const l = U.el('div', { class: 'hm-scenelbl', text: sc.name, style: at(x, y < 500 ? y - 136 : y + 104) });
          tap(b, () => { runScene(sc.id); V.sound.play('success'); V.haptic([8, 30, 8]); }, false);
          el.append(b, l);
          return { b, sc };
        });
        Object.assign(P, {
          el,
          refresh() { const cur = st().scene; for (const d of discs) d.b.classList.toggle('on', d.sc.id === cur); },
          frame() {},
        });
        P.refresh();
        return P;
      }

      const pageObjs = PAGES.map((p) => {
        const P = { page: p, room: p.room, vis: true, lastT: '' };
        if (p.kind === 'room') buildRoomPage(P);
        else if (p.kind === 'thermo') buildThermoPage(P);
        else buildScenesPage(P);
        pagesEl.appendChild(P.el);
        return P;
      });

      /* ---------------------------------------------- Unteransichten */
      function openSub(o) {
        if (sub) closeSub(true);
        sub = o;
        o.el.classList.add('hm-subview');
        o.el.style.opacity = '0';
        root.appendChild(o.el);
        aim(subT, 1, { response: 0.42, bounce: 0.05 });
        V.sound.play('open');
      }
      function closeSub(instant) {
        if (!sub) return;
        const o = sub;
        sub = null;
        if (o.close) o.close();
        if (instant) { o.el.remove(); subT.v = subT.to = 0; return; }
        aim(subT, 0, { response: 0.36 });
        o.leaving = true;
        leaving.push(o);
        V.sound.play('close');
      }
      const leaving = [];

      function openBlinds(id) {
        const room = ROOM[id];
        const el = U.el('div');
        const svg = U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
        const gid = U.uid('hmsky');
        const defs = U.svg('defs');
        const lg = U.svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
        lg.append(U.svg('stop', { offset: '0%', 'stop-color': '#2a6fd6', 'stop-opacity': 0.75 }), U.svg('stop', { offset: '58%', 'stop-color': '#8ec0f0', 'stop-opacity': 0.42 }), U.svg('stop', { offset: '100%', 'stop-color': '#ffc27a', 'stop-opacity': 0.34 }));
        const sun = U.svg('radialGradient', { id: gid + 's' });
        sun.append(U.svg('stop', { offset: '0%', 'stop-color': '#fff6e0', 'stop-opacity': 0.95 }), U.svg('stop', { offset: '18%', 'stop-color': '#ffd99a', 'stop-opacity': 0.55 }), U.svg('stop', { offset: '100%', 'stop-color': '#ffb85c', 'stop-opacity': 0 }));
        defs.append(lg, sun);
        svg.appendChild(defs);
        svg.appendChild(U.svg('rect', { x: 0, y: 0, width: 1000, height: 1000, fill: `url(#${gid})` }));
        svg.appendChild(U.svg('circle', { cx: 720, cy: 300, r: 260, fill: `url(#${gid}s)` }));
        // Fensterkreuz
        svg.appendChild(U.svg('path', { d: 'M 500 0 V 1000 M 0 560 H 1000', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 14 }));
        const shade = U.svg('g');
        shade.appendChild(U.svg('rect', { x: 0, y: -1020, width: 1000, height: 1020, fill: '#141416' }));
        for (let y = -1020; y < 0; y += 38) {
          shade.appendChild(U.svg('rect', { x: 0, y, width: 1000, height: 2, fill: 'rgba(255,255,255,.06)' }));
          shade.appendChild(U.svg('rect', { x: 0, y: y + 2, width: 1000, height: 3, fill: 'rgba(0,0,0,.6)' }));
        }
        shade.appendChild(U.svg('rect', { x: 0, y: -16, width: 1000, height: 16, fill: '#3a3a3e' }));
        shade.appendChild(U.svg('rect', { x: 0, y: -16, width: 1000, height: 2, fill: 'rgba(255,255,255,.18)' }));
        svg.appendChild(shade);
        const title = V.ui.arcText({ text: 'Rollo · ' + room.name, r: 404, size: 25, weight: 700, spacing: 4.5, color: 'rgba(255,255,255,.85)' });
        const big = U.el('div', { class: 'hm-pct vos-num', style: { top: '40cqw', textShadow: '0 0 4cqw rgba(0,0,0,.85)' } });
        const lbl = U.el('div', { class: 'hm-sub vos-label', style: { top: '54.5cqw', color: 'rgba(255,255,255,.7)', textShadow: '0 0 3cqw rgba(0,0,0,.9)' } });
        const mk = (icon, x, label, val) => {
          const b = V.ui.roundButton(icon, { kind: 'sm', label, style: Object.assign(at(x, 742), { position: 'absolute', margin: '-6cqw 0 0 -6cqw', background: 'rgba(30,30,34,.85)', backdropFilter: 'blur(8px)' }) });
          tap(b, () => { setBlinds(id, val, 'ui'); changed({ what: 'blinds', rooms: [id], src: 'ui' }); });
          return b;
        };
        const done = V.ui.roundButton('check', { kind: 'sm', label: 'Fertig', style: Object.assign(at(500, 742), { position: 'absolute', margin: '-6cqw 0 0 -6cqw', background: '#fff', color: '#000' }) });
        tap(done, () => closeSub());
        el.append(svg, title.el, big, lbl, mk('up', 332, 'Öffnen', 100), done, mk('down', 668, 'Schließen', 0));
        let last = '';
        const o = {
          el, kind: 'blinds', room: id,
          frame() {
            const v = U.clamp(shown[id].blinds.v, 0, 100);
            const cover = (100 - v) / 100;
            shade.setAttribute('transform', `translate(0 ${(cover * 1000).toFixed(1)})`);
            const target = roomState(id).blinds;
            const s = String(Math.round(v)) + '|' + target;
            if (s === last) return;
            last = s;
            const n = Math.round(v);
            big.innerHTML = n + '<small>%</small>';
            lbl.textContent = target >= 99 && n >= 99 ? 'Ganz offen' : target <= 1 && n <= 1 ? 'Geschlossen' : 'Geöffnet';
          },
          start(p) { return { mode: p.r0 >= RIM_MIN ? 'rim' : 'v', v0: roomState(id).blinds, last: 0 }; },
          move(p, g) {
            let v;
            if (g.mode === 'rim') v = g.v0 + p.dA / 2.6;
            else v = g.v0 - p.dy / 7.2;
            v = U.clamp(Math.round(v), 0, 100);
            if (v !== roomState(id).blinds) {
              if (v % 10 === 0) { V.sound.play('tick'); V.haptic(3); }
              setBlinds(id, v, 'ui');
              V.emit('home:changed', { what: 'blinds', rooms: [id], src: 'ui', drag: true });
            }
          },
          end() { V.store.save(); },
        };
        openSub(o);
      }

      function openHue(id) {
        const el = U.el('div');
        const ring = U.el('div', { class: 'hm-huering' });
        const knob = U.el('div', { class: 'hm-knob' });
        const B = buildBulb();
        const halo = U.el('div', { class: 'hm-halo', style: { top: (395 - 420) / 10 + 'cqw' } });
        const bulbBox = U.el('div', { style: { position: 'absolute', left: '50%', top: '22.8cqw', width: '19cqw', height: '23.75cqw', marginLeft: '-9.5cqw' } }, B.svg);
        B.svg.style.width = '100%'; B.svg.style.height = '100%';
        const name = U.el('div', { class: 'hm-sub', style: { top: '51cqw', fontSize: '6.4cqw', fontWeight: 600, letterSpacing: '-.02em' } });
        const hint = U.el('div', { class: 'hm-sub vos-label', style: { top: '60cqw' }, text: 'Am Ring wählen' });
        const done = V.ui.roundButton('check', { kind: 'sm', label: 'Fertig', style: Object.assign(at(500, 738), { position: 'absolute', margin: '-6cqw 0 0 -6cqw', background: '#fff', color: '#000' }) });
        const caps = [HUE_A0, HUE_A0 + HUE_SPAN].map((a, i) => {
          const p = V.display.pt(a, 442.5);
          return U.el('div', { class: 'hm-cap', style: Object.assign(at(p.x, p.y), { background: hueHex(i ? 359 : 0) }) });
        });
        el.append(halo, ring, ...caps, knob, bulbBox, name, hint, done);
        const x0 = roomState(id);
        let hue = x0.tone === 'hue' ? x0.hue : st().customHue;
        let touched = x0.tone === 'hue' && x0.on;
        function apply(h, save) {
          hue = U.wrap(Math.round(h), 360);
          touched = true;
          setLight(id, { tone: 'hue', hue }, 'ui');
          V.emit('home:changed', { what: 'light', rooms: [id], src: 'ui', drag: !save });
          if (save) V.store.save();
        }
        tap(done, () => { if (!touched) { apply(hue, true); } closeSub(); });
        let lastH = -1, lastKey = '';
        const o = {
          el, kind: 'hue', room: id,
          frame() {
            const c = hueHex(hue), lvl = touched ? Math.max(0.4, U.clamp(shown[id].lvl.v, 0, 1)) : 0.75;
            const key = c + lvl.toFixed(3);
            if (key !== lastKey) {
              lastKey = key;
              paintBulb(B, lvl, c);
              B.svg.style.filter = `drop-shadow(0 0 3cqw ${U.rgba(c, 0.55)})`;
              halo.style.background = `radial-gradient(circle, ${U.rgba(c, 0.5)} 0%, ${U.rgba(c, 0.18)} 24%, ${U.rgba(c, 0)} 60%)`;
              halo.style.transform = 'scale(.8)';
            }
            if (hue !== lastH) {
              lastH = hue;
              const p = V.display.pt(hueToAngle(hue), 442.5);
              Object.assign(knob.style, at(p.x, p.y));
              knob.style.background = c;
              knob.style.boxShadow = `0 0 0 .7cqw #fff, 0 0 5cqw ${U.rgba(c, 0.7)}, 0 .8cqw 2.4cqw rgba(0,0,0,.55)`;
              name.textContent = hueEntry(hue).name;
            }
          },
          start(p) { if (p.r0 >= 330) { V.haptic(4); apply(angleToHue(p.a)); return { mode: 'ring', lastName: hueEntry(hue).name }; } return null; },
          move(p, g) {
            if (!g || g.mode !== 'ring') return;
            apply(angleToHue(p.a));
            const n = hueEntry(hue).name;
            if (n !== g.lastName) { g.lastName = n; V.sound.play('tick'); V.haptic(3); }
          },
          end() { apply(hue, true); },
        };
        openSub(o);
      }

      /* ---------------------------------------------- Rand drehen */
      let rimAcc = 0;
      function rimStart() { rimAcc = 0; }
      function rimDrag(page, d) {
        if (page.kind === 'room') {
          const id = page.id, x = roomState(id);
          const before = x.on ? x.bri : 0;
          let v = U.clamp(before + d / L_SPAN, 0, 1);
          if (v < 0.01 && d < 0) v = 0;
          if (before === v) { if ((v === 0 && d < 0) || (v === 1 && d > 0)) { rimAcc += Math.abs(d); if (rimAcc > 25) { rimAcc = 0; V.haptic(8); } } return; }
          if (v === 0) setLight(id, { on: false }, 'ui'); else setLight(id, { bri: Math.max(0.01, v), on: true }, 'ui');
          if (Math.floor(before * 20) !== Math.floor(v * 20)) { V.sound.play('tick'); V.haptic(v === 1 || v === 0 ? 10 : 3); }
          V.emit('home:changed', { what: 'light', rooms: [id], src: 'ui', drag: true });
        } else if (page.kind === 'thermo') {
          const th = st().thermo;
          rimAcc += d;
          const steps = Math.trunc(rimAcc / (T_DEG / 2));
          if (!steps) return;
          rimAcc -= steps * (T_DEG / 2);
          const v = U.clamp(th.target + steps * 0.5, T_MIN, T_MAX);
          if (v === th.target && th.on) { V.haptic(8); return; }
          setThermoRaw(v, true);
          st().scene = null;
          V.sound.play('tick'); V.haptic(3);
          V.emit('home:changed', { what: 'thermo', src: 'ui', drag: true });
        }
      }

      /* ---------------------------------------------- Gesten */
      let G = null;
      V.gesture(root, {
        start(p) {
          suppressClick = false;
          if (inVistoZone(p.x0, p.y0)) { G = null; return; }
          if (sub) { G = { sub: true, inner: sub.start ? sub.start(p) : null }; return; }
          const pg = curPage();
          const settled = Math.abs(pos.v - Math.round(pos.v)) < 0.08;
          if (p.r0 >= RIM_MIN && settled && (pg.kind === 'room' || pg.kind === 'thermo')) { G = { mode: 'rim', page: pg, last: 0 }; rimStart(); return; }
          G = { mode: 'pending', p0: pos.v, lastTick: Math.round(pos.v) };
        },
        move(p) {
          if (!G) return;
          if (p.moved) suppressClick = true;
          if (G.sub) { if (sub && sub.move && G.inner) sub.move(p, G.inner); return; }
          if (G.mode === 'rim') { const d = p.dA - G.last; G.last = p.dA; rimDrag(G.page, d); return; }
          if (G.mode === 'pending') {
            if (!p.moved) return;
            G.mode = Math.abs(p.dx) > Math.abs(p.dy) * 1.05 ? 'swipe' : 'none';
            if (G.mode === 'swipe') { pos.delay = 0; }
          }
          if (G.mode === 'swipe') {
            let v = G.p0 - p.dx / PAGE_W;
            const max = PAGES.length - 1;
            if (v < 0) v = -Math.pow(-v, 0.7) * 0.35;
            if (v > max) v = max + Math.pow(v - max, 0.7) * 0.35;
            pos.v = pos.to = v; pos.vel = 0;
            const r = U.clamp(Math.round(v), 0, max);
            if (r !== G.lastTick) { G.lastTick = r; V.sound.play('tick'); V.haptic(3); }
          }
        },
        end(p) {
          const g = G; G = null;
          if (!g) return;
          if (g.sub) { if (sub && sub.end && g.inner) sub.end(p, g.inner); return; }
          if (g.mode === 'rim') { V.store.save(); return; }
          if (g.mode === 'swipe') {
            const vel = p.cancelled ? 0 : -p.vx / PAGE_W;
            const proj = pos.v + vel * 0.2;
            const from = Math.round(g.p0);
            let target = Math.round(proj);
            const moved = pos.v - from;
            // ab gut einem Viertel Seite weiterblättern, außer der Finger schnippt zurück
            if (!p.cancelled && target === from && Math.abs(moved) > 0.27 && vel * Math.sign(moved) > -0.6) target = from + Math.sign(moved);
            target = U.clamp(target, Math.max(0, from - 1), Math.min(PAGES.length - 1, from + 1));
            goPage(target, { velocity: vel * 0.6 });
          }
        },
      }, { slop: 8 });

      /* ---------------------------------------------- Bild für Bild */
      let lastPos = NaN, lastSub = NaN, lastRing = -1, lastGlow = '', lastThermo = '';
      function render(t) {
        const p = pos.v, sT = U.clamp(subT.v, 0, 1);
        // Seiten
        if (p !== lastPos || sT !== lastSub) {
          for (let i = 0; i < pageObjs.length; i++) {
            const P = pageObjs[i], d = i - p, ad = Math.abs(d);
            if (ad > 1.12) { if (P.vis) { P.el.style.visibility = 'hidden'; P.vis = false; } continue; }
            if (!P.vis) { P.el.style.visibility = ''; P.vis = true; }
            const sc = (1 - 0.13 * Math.min(1, ad)) * (1 - 0.06 * sT);
            P.el.style.transform = `translateX(${(d * 62).toFixed(3)}cqw) scale(${sc.toFixed(4)})`;
            P.el.style.opacity = (U.clamp(1 - ad * 1.25, 0, 1) * (1 - sT)).toFixed(3);
            P.el.style.pointerEvents = ad < 0.5 && sT < 0.05 ? '' : 'none';
          }
          lastPos = p; lastSub = sT;
        }
        // Seitennamen am Bogen
        const ringKey = p.toFixed(4) + sT.toFixed(3);
        if (ringKey !== lastRing) {
          lastRing = ringKey;
          const i0 = U.clamp(Math.floor(p), 0, PAGES.length - 1), i1 = Math.min(PAGES.length - 1, i0 + 1);
          const f = p - i0;
          const off = labels[i0].c + (labels[i1].c - labels[i0].c) * f + (p < 0 ? p * 40 : p > PAGES.length - 1 ? (p - PAGES.length + 1) * 40 : 0);
          labels.forEach((L) => {
            const a = L.c - off, aa = Math.abs(a);
            const op = (aa < 4 ? 0.92 : U.lerp(0.92, 0.3, U.smoothstep(4, 28, aa))) * (1 - U.smoothstep(36, 56, aa)) * (1 - sT);
            L.g.setAttribute('transform', `rotate(${a.toFixed(3)} 500 500)`);
            L.g.setAttribute('opacity', op.toFixed(3));
          });
        }
        // Gewichte der Seitenarten
        let wRoom = 0, wTh = 0, lvl = 0, cr = 0, cg = 0, cb = 0;
        for (let i = 0; i < PAGES.length; i++) {
          const w = Math.max(0, 1 - Math.abs(i - U.clamp(p, 0, PAGES.length - 1)));
          if (!w) continue;
          const pg = PAGES[i];
          if (pg.kind === 'room') {
            const sh = shown[pg.id];
            wRoom += w; lvl += U.clamp(sh.lvl.v, 0, 1) * w; cr += sh.r.v * w; cg += sh.g.v * w; cb += sh.b.v * w;
          } else if (pg.kind === 'thermo') wTh += w;
        }
        if (wRoom > 0) { lvl /= wRoom; cr /= wRoom; cg /= wRoom; cb /= wRoom; }
        const lc = U.rgbToHex(cr, cg, cb);
        const fade = 1 - sT;
        // Lichtbogen am Rand
        lightG.setAttribute('opacity', (wRoom * fade).toFixed(3));
        ctx.rim.arc('light', { from: L_A0, value: lvl * (L_SPAN / 360), color: lc, width: 12, r: RIM_R, glow: 0.95, head: true, smooth: false, alpha: wRoom * fade });
        // Thermostat
        thermoG.setAttribute('opacity', (wTh * fade).toFixed(3));
        const th = st().thermo, mode = thermoMode();
        if (wTh > 0.001) {
          const cur = curTemp(), tg = thTarget.v;
          const key = cur.toFixed(2) + '|' + tg.toFixed(3) + '|' + mode;
          if (key !== lastThermo) {
            lastThermo = key;
            const aC = tAngle(cur), aT = tAngle(tg);
            const lo = Math.min(aC, aT), hi = Math.max(aC, aT);
            const col = modeColor(mode);
            const act = mode === 'heat' || mode === 'cool';
            for (const tk of ticks) {
              const on = act && tk.a >= lo - 0.6 && tk.a <= hi + 0.6;
              const k = on ? 'on' + mode : tk.a > aT || !th.on ? (tk.major ? 'M' : 'm') : tk.major ? 'Mb' : 'mb';
              if (k === tk.k) continue;
              tk.k = k;
              tk.el.setAttribute('stroke', on ? col : 'rgba(255,255,255,1)');
              tk.el.setAttribute('stroke-opacity', on ? 1 : k === 'M' ? 0.34 : k === 'm' ? 0.17 : k === 'Mb' ? 0.5 : 0.28);
              tk.el.setAttribute('stroke-width', on ? 4 : tk.major ? 3.4 : 2.6);
              tk.el.setAttribute('y2', 500 - (on ? 424 : tk.major ? 428 : 440));
            }
            heatGlow.setAttribute('d', act && hi - lo > 0.5 ? V.ui.arcPath(500, 500, 450, lo, hi) : 'M 0 0');
            heatGlow.setAttribute('stroke', col);
            tgtGlow.setAttribute('stroke', act ? col : '#ffffff');
            tgtGlow.setAttribute('opacity', th.on ? (act ? 0.75 : 0.3) : 0);
            tgtMark.setAttribute('opacity', th.on ? 1 : 0.35);
            tgtG.setAttribute('transform', `rotate(${aT.toFixed(3)} 500 500)`);
            curMark.setAttribute('transform', `rotate(${aC.toFixed(3)} 500 500)`);
          }
        }
        // Leuchten im Hintergrund (Lichtfarbe bzw. Heizen/Kühlen)
        const litBg = 1 - Math.pow(1 - lvl, 3);
        const tcol = mode === 'heat' ? HEAT : mode === 'cool' ? COOL : null;
        const breathe = 0.85 + 0.15 * Math.sin(t * 1.6);
        const gk = lc + (wRoom * litBg * fade).toFixed(3) + (tcol ? tcol + (wTh * fade * breathe).toFixed(3) : '');
        if (gk !== lastGlow) {
          lastGlow = gk;
          const parts = [];
          if (wRoom * litBg * fade > 0.002) parts.push(`radial-gradient(circle at 50% ${GLASS_Y / 10}%, ${U.rgba(lc, 0.2 * litBg * wRoom * fade)} 0%, ${U.rgba(lc, 0.07 * litBg * wRoom * fade)} 38%, ${U.rgba(lc, 0)} 70%)`);
          if (tcol && wTh * fade > 0.002) parts.push(`radial-gradient(circle at 50% 50%, ${U.rgba(tcol, 0.26 * wTh * fade * breathe)} 0%, ${U.rgba(tcol, 0.1 * wTh * fade * breathe)} 42%, ${U.rgba(tcol, 0)} 72%)`);
          glow.style.background = parts.join(',') || 'none';
        }
        // Szenen-Seite: die Räume als leuchtende Abschnitte am Rand
        const wSc = Math.max(0, 1 - Math.abs(U.clamp(p, 0, PAGES.length - 1))) * fade;
        ROOMS.forEach((r, i) => {
          const span = L_SPAN / ROOMS.length;
          const sh = shown[r.id], l = U.clamp(sh.lvl.v, 0, 1);
          const c = U.rgbToHex(sh.r.v, sh.g.v, sh.b.v);
          ctx.rim.arc('seg' + i, {
            from: L_A0 + i * span + 4, value: (span - 8) / 360, r: RIM_R, width: 12, smooth: false,
            color: l > 0.01 ? c : '#ffffff', glow: l > 0.01 ? 0.4 + 0.6 * l : 0, alpha: wSc * (l > 0.01 ? 0.35 + 0.65 * Math.sqrt(l) : 0.1),
          });
        });
        // sichtbare Seiten
        for (const P of pageObjs) if (P.vis) P.frame();
        if (sub && sub.frame) sub.frame();
        // Unteransichten ein-/ausblenden
        if (sub) { sub.el.style.opacity = sT.toFixed(3); sub.el.style.transform = `scale(${(1.06 - 0.06 * sT).toFixed(4)})`; }
        for (let i = leaving.length - 1; i >= 0; i--) {
          const o = leaving[i];
          if (o.frame) o.frame();
          o.el.style.opacity = sT.toFixed(3);
          o.el.style.transform = `scale(${(1.06 - 0.06 * sT).toFixed(4)})`;
          if (sT <= 0.01 || sub) { o.el.remove(); leaving.splice(i, 1); }
        }
      }

      ctx.onFrame((dt, t) => {
        for (const s of SPRINGS) step(s, dt);
        render(t);
      });
      ctx.on('home:changed', (e) => {
        sync(e || {});
        if (e && e.focus && !G && !sub && e.src === 'voice') {
          const i = pageIndex(e.focus);
          if (i >= 0) goPage(i, { response: 0.8 });
        }
      });
      sync();
      render(0);

      return {
        _room: () => (curPage().kind === 'room' ? curPage().id : null),
        back() { if (sub) { closeSub(); return true; } return false; },
        params(p) { if (p && p.page && pageIndex(p.page) >= 0) { if (sub) closeSub(); goPage(pageIndex(p.page)); } },
        crown(dA) {
          const pg = curPage();
          if (sub && sub.kind === 'blinds') { setBlinds(sub.room, roomState(sub.room).blinds + dA / 2.6, 'ui'); changed({ what: 'blinds', src: 'ui', drag: true }); return; }
          if (!sub && (pg.kind === 'room' || pg.kind === 'thermo')) rimDrag(pg, dA);
        },
        shown() { measureLabels(); lastRing = -1; },
      };
    },
  });
})();
