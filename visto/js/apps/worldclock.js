/* VistoOS · apps/worldclock.js — Weltuhr
 *
 *  Der Rand ist ein 24-Stunden-Ring: Mittag oben, Mitternacht unten, Morgen links, Abend rechts.
 *  Tag hell, Nacht dunkel, Dämmerung als Verlauf – berechnet für die gewählte Stadt (Breite, Jahreszeit).
 *  Jede Stadt sitzt als Punkt auf dem Ring an ihrer Ortszeit und wandert mit der Zeit weiter.
 *  Mitte: gewählte Stadt groß (Zeit, Differenz „+9 Std.“, Tag/Nacht-Symbol, Sonnenauf- und -untergang).
 *  Antippen eines Punktes oder Drehen am Rand wählt die Stadt; ein Zeiger gleitet federnd hinüber.
 *
 *  V.worldclock.find(text) → Stadt {name, zone} | null      V.worldclock.time(name) → {name, time, diff, …}
 *  Absicht: „Wie spät ist es in Tokio?“, „Zeitverschiebung nach New York?“
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#5E5CE6';
  const TAU = Math.PI * 2;

  // Städte auf dem Ring (Heimatort kommt aus den Einstellungen dazu)
  const CITIES = [
    { id: 'honolulu', name: 'Honolulu', code: 'HNL', zone: 'Pacific/Honolulu', lat: 21.31, lon: -157.86 },
    { id: 'sf', name: 'San Francisco', code: 'SFO', zone: 'America/Los_Angeles', lat: 37.77, lon: -122.42 },
    { id: 'ny', name: 'New York', code: 'NYC', zone: 'America/New_York', lat: 40.71, lon: -74.01 },
    { id: 'rio', name: 'Rio de Janeiro', code: 'RIO', zone: 'America/Sao_Paulo', lat: -22.91, lon: -43.17 },
    { id: 'london', name: 'London', code: 'LON', zone: 'Europe/London', lat: 51.51, lon: -0.13 },
    { id: 'dubai', name: 'Dubai', code: 'DXB', zone: 'Asia/Dubai', lat: 25.2, lon: 55.27 },
    { id: 'mumbai', name: 'Mumbai', code: 'BOM', zone: 'Asia/Kolkata', lat: 19.08, lon: 72.88 },
    { id: 'singapur', name: 'Singapur', code: 'SIN', zone: 'Asia/Singapore', lat: 1.35, lon: 103.82 },
    { id: 'tokio', name: 'Tokio', code: 'TYO', zone: 'Asia/Tokyo', lat: 35.68, lon: 139.69 },
    { id: 'sydney', name: 'Sydney', code: 'SYD', zone: 'Australia/Sydney', lat: -33.87, lon: 151.21 },
  ];
  const HOMES = {
    berlin: { name: 'Berlin', code: 'BER', zone: 'Europe/Berlin', lat: 52.52, lon: 13.4 },
    hamburg: { name: 'Hamburg', code: 'HAM', zone: 'Europe/Berlin', lat: 53.55, lon: 9.99 },
    muenchen: { name: 'München', code: 'MUC', zone: 'Europe/Berlin', lat: 48.14, lon: 11.58 },
    koeln: { name: 'Köln', code: 'CGN', zone: 'Europe/Berlin', lat: 50.94, lon: 6.96 },
    frankfurt: { name: 'Frankfurt', code: 'FRA', zone: 'Europe/Berlin', lat: 50.11, lon: 8.68 },
    wien: { name: 'Wien', code: 'VIE', zone: 'Europe/Vienna', lat: 48.21, lon: 16.37 },
    zuerich: { name: 'Zürich', code: 'ZRH', zone: 'Europe/Zurich', lat: 47.37, lon: 8.54 },
  };
  // weitere Städte nur für Fragen an Visto
  const MORE = [
    ['Los Angeles', 'America/Los_Angeles', ['la', 'kalifornien']], ['Chicago', 'America/Chicago'], ['Toronto', 'America/Toronto'],
    ['Vancouver', 'America/Vancouver'], ['Mexiko-Stadt', 'America/Mexico_City', ['mexiko stadt', 'mexico city', 'mexiko']],
    ['São Paulo', 'America/Sao_Paulo', ['sao paulo', 'brasilien']], ['Buenos Aires', 'America/Argentina/Buenos_Aires', ['argentinien']],
    ['Reykjavík', 'Atlantic/Reykjavik', ['reykjavik', 'island']], ['Lissabon', 'Europe/Lisbon', ['portugal']], ['Dublin', 'Europe/Dublin', ['irland']],
    ['Paris', 'Europe/Paris', ['frankreich']], ['Madrid', 'Europe/Madrid', ['spanien']], ['Rom', 'Europe/Rome', ['italien']],
    ['Amsterdam', 'Europe/Amsterdam'], ['Stockholm', 'Europe/Stockholm'], ['Helsinki', 'Europe/Helsinki', ['finnland']],
    ['Athen', 'Europe/Athens', ['griechenland']], ['Istanbul', 'Europe/Istanbul', ['türkei']], ['Moskau', 'Europe/Moscow', ['russland']],
    ['Kairo', 'Africa/Cairo', ['ägypten']], ['Kapstadt', 'Africa/Johannesburg', ['johannesburg', 'südafrika']], ['Nairobi', 'Africa/Nairobi', ['kenia']],
    ['Delhi', 'Asia/Kolkata', ['neu delhi', 'new delhi', 'indien']], ['Bangkok', 'Asia/Bangkok', ['thailand']], ['Bali', 'Asia/Makassar'],
    ['Peking', 'Asia/Shanghai', ['beijing', 'china']], ['Shanghai', 'Asia/Shanghai'], ['Hongkong', 'Asia/Hong_Kong', ['hong kong']],
    ['Seoul', 'Asia/Seoul', ['südkorea', 'korea']], ['Melbourne', 'Australia/Melbourne'], ['Auckland', 'Pacific/Auckland', ['neuseeland']],
    ['Wien', 'Europe/Vienna', ['österreich']], ['Zürich', 'Europe/Zurich', ['zuerich', 'zurich', 'schweiz']], ['Berlin', 'Europe/Berlin', ['deutschland']],
    ['Hamburg', 'Europe/Berlin'], ['München', 'Europe/Berlin', ['muenchen']], ['Köln', 'Europe/Berlin', ['koeln']], ['Frankfurt', 'Europe/Berlin'],
  ];
  const EXTRA_ALIAS = { tokio: ['tokyo', 'japan'], sf: ['san francisco', 'silicon valley'], ny: ['new york city', 'nyc', 'manhattan'], honolulu: ['hawaii'], london: ['england', 'großbritannien'], singapur: ['singapore'], sydney: ['australien'], dubai: ['emirate', 'vae'], rio: ['rio'], mumbai: ['bombay'] };

  /* --------------------------------------------------------- Zeitzonen */
  const fmts = new Map();
  function partsIn(zone, ms) {
    let f = fmts.get(zone);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
      fmts.set(zone, f);
    }
    const o = {};
    for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
  }
  /** Versatz zu UTC in Minuten; zone = null → Geräteuhr */
  function offsetMin(zone, ms) {
    if (!zone) return -new Date(ms).getTimezoneOffset();
    try {
      const p = partsIn(zone, ms);
      return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000);
    } catch (e) { return 0; }
  }
  /** Wanduhr der Stadt als Date (lokale Felder = Ortszeit) */
  function wall(city, ms) {
    if (!city.zone) return new Date(ms);
    const p = partsIn(city.zone, ms);
    return new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  }
  const homeCity = () => {
    const k = String(V.store.get('settings.location', 'Berlin')).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
    const h = HOMES[k] || HOMES.berlin;
    return Object.assign({ id: 'home', home: true }, h, { zone: null, realZone: h.zone });
  };
  const allCities = () => [homeCity()].concat(CITIES);

  /** Sonnenauf- und -untergang in Ortsstunden (NOAA-Näherung) */
  function sunTimes(city, wallDate, offH) {
    const n = Math.round((new Date(wallDate.getFullYear(), wallDate.getMonth(), wallDate.getDate()) - new Date(wallDate.getFullYear(), 0, 1)) / 864e5) + 1;
    const gam = (TAU / 365) * (n - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(gam) - 0.032077 * Math.sin(gam) - 0.014615 * Math.cos(2 * gam) - 0.040849 * Math.sin(2 * gam));
    const decl = 0.006918 - 0.399912 * Math.cos(gam) + 0.070257 * Math.sin(gam) - 0.006758 * Math.cos(2 * gam) + 0.000907 * Math.sin(2 * gam) - 0.002697 * Math.cos(3 * gam) + 0.00148 * Math.sin(3 * gam);
    const lat = U.rad(city.lat);
    const cosH = Math.cos(U.rad(90.833)) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
    const noon = (720 - 4 * city.lon - eq) / 60 + offH;
    if (cosH >= 1) return { rise: noon, set: noon, polar: 'night' };
    if (cosH <= -1) return { rise: noon - 12, set: noon + 12, polar: 'day' };
    const ha = U.deg(Math.acos(cosH));
    return { rise: noon - (ha * 4) / 60, set: noon + (ha * 4) / 60 };
  }
  const fmtH = (h) => { h = U.wrap(h, 24); let H = Math.floor(h), m = Math.round((h - H) * 60); if (m === 60) { H = (H + 1) % 24; m = 0; } return H + ':' + U.pad(m); };

  function diffText(min, long) {
    if (!min) return long ? 'gleiche Zeit wie hier' : 'Gleiche Zeit';
    const s = min > 0 ? '+' : '−';
    const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
    if (!long) return s + (m ? (h + (m === 30 ? ',5' : m === 45 ? ',75' : ':' + U.pad(m))) : h) + ' Std.';
    const hs = h ? (h === 1 ? 'eine Stunde' : h + ' Stunden') : '';
    const ms = m ? m + ' Minuten' : '';
    return [hs, ms].filter(Boolean).join(' und ') + (min > 0 ? ' später als hier' : ' früher als hier');
  }
  function dayRel(cw, hw) {
    const a = new Date(cw.getFullYear(), cw.getMonth(), cw.getDate()), b = new Date(hw.getFullYear(), hw.getMonth(), hw.getDate());
    const d = Math.round((a - b) / 864e5);
    return d > 0 ? 'Morgen' : d < 0 ? 'Gestern' : 'Heute';
  }
  /** Zustand einer Stadt jetzt */
  function info(city, ms) {
    ms = ms || V.time.ms();
    const off = offsetMin(city.zone, ms), offHome = offsetMin(null, ms);
    const w = wall(city, ms), hw = new Date(ms);
    const h = w.getHours() + w.getMinutes() / 60 + w.getSeconds() / 3600;
    const sun = sunTimes(city, w, off / 60);
    let phase;
    if (sun.polar) phase = sun.polar;
    else if (Math.abs(h - sun.rise) < 0.6) phase = 'dawn';
    else if (Math.abs(h - sun.set) < 0.6) phase = 'dusk';
    else phase = h > sun.rise && h < sun.set ? 'day' : 'night';
    return { city, wall: w, h, off, diff: off - offHome, rel: dayRel(w, hw), sun, phase, time: V.fmt.time24 ? V.fmt.time24(w) : V.fmt.time(w) };
  }

  /* ----------------------------------------------------------- Suchen */
  function norm(s) { return String(s || '').toLowerCase(); }
  let INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = [];
    for (const c of CITIES) {
      INDEX.push([norm(c.name), c]);
      for (const a of EXTRA_ALIAS[c.id] || []) INDEX.push([a, c]);
    }
    for (const [name, zone, al] of MORE) {
      const known = CITIES.find((c) => c.name === name);
      const c = known || { id: 'x-' + name, name, zone, lat: 0, lon: 0, extra: true };
      if (!known) INDEX.push([norm(name), c]);
      for (const a of al || []) INDEX.push([a, c]);
    }
    INDEX.sort((a, b) => b[0].length - a[0].length);
    return INDEX;
  }
  function find(text) {
    const t = norm(text);
    for (const [k, c] of index()) {
      if (new RegExp('(?<![a-zäöüßé])' + k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '(?![a-zäöüßé])').test(t)) return c;
    }
    return null;
  }
  function timeOf(city) {
    const ms = V.time.ms();
    const z = city.zone;
    const off = offsetMin(z, ms), offHome = offsetMin(null, ms);
    const p = partsIn(z, ms);
    const w = new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    return { name: city.name, time: U.pad(p.h) + ':' + U.pad(p.mi), spoken: p.h + ':' + U.pad(p.mi), diff: off - offHome, rel: dayRel(w, new Date(ms)), wall: w, hour: p.h };
  }

  V.worldclock = {
    cities: () => allCities().map((c) => c.name),
    find,
    time(name) { const c = find(name); return c ? timeOf(c) : null; },
  };

  /* -------------------------------------------------------- Symbole */
  function glyph(phase) {
    let b;
    if (phase === 'day') {
      b = '<g stroke="#FFD23F" stroke-width="3.3" stroke-linecap="round">';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; b += `<path d="M${(32 + Math.cos(a) * 16.5).toFixed(1)} ${(32 + Math.sin(a) * 16.5).toFixed(1)}L${(32 + Math.cos(a) * 22).toFixed(1)} ${(32 + Math.sin(a) * 22).toFixed(1)}"/>`; }
      b += '</g><circle cx="32" cy="32" r="11" fill="#FFD23F"/>';
    } else if (phase === 'dawn' || phase === 'dusk') {
      const col = phase === 'dawn' ? '#FFB347' : '#FF8A4F';
      b = `<defs><clipPath id="wcclip-${phase}"><rect x="0" y="0" width="64" height="40"/></clipPath></defs>`;
      b += `<g clip-path="url(#wcclip-${phase})"><circle cx="32" cy="40" r="12" fill="${col}"/><g stroke="${col}" stroke-width="3.2" stroke-linecap="round">`;
      for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 5); b += `<path d="M${(32 + Math.cos(a) * 17).toFixed(1)} ${(40 + Math.sin(a) * 17).toFixed(1)}L${(32 + Math.cos(a) * 22.5).toFixed(1)} ${(40 + Math.sin(a) * 22.5).toFixed(1)}"/>`; }
      b += `</g></g><path d="M10 46h44M18 53h28" stroke="${col}" stroke-width="3.4" stroke-linecap="round" opacity=".75"/>`;
    } else {
      b = '<path fill="#F3EFE2" d="M38.25 17.27A16 16 0 1 0 46.83 37.99A12.2 12.2 0 0 1 38.25 17.27Z"/>';
      b += '<g fill="#fff"><circle cx="47" cy="17" r="1.8"/><circle cx="54" cy="27" r="1.2"/><circle cx="43" cy="8" r="1.1"/></g>';
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${b}</svg>`;
  }

  /* ------------------------------------------------------- Ring-Farben */
  function ringStops(rise, set, polar) {
    if (polar === 'night') return [[0, '#070a1f'], [12, '#121a46'], [24, '#070a1f']];
    if (polar === 'day') return [[0, '#ffc98a'], [12, '#fff3d6'], [24, '#ffc98a']];
    const st = [
      [0, '#070a1f'], [rise - 1.6, '#0b1236'], [rise - 0.65, '#272e70'], [rise - 0.12, '#9a4f8a'], [rise + 0.35, '#ff9a5c'], [rise + 1.4, '#ffd59a'],
      [(rise + set) / 2, '#fff3d6'],
      [set - 1.4, '#ffd59a'], [set - 0.35, '#ff8a4f'], [set + 0.12, '#a24a86'], [set + 0.65, '#2a2a6c'], [set + 1.6, '#0b1236'], [24, '#070a1f'],
    ];
    const out = [];
    let last = -1;
    for (const [h, c] of st) { const hh = U.clamp(h, 0, 24); if (hh <= last) continue; out.push([hh, c]); last = hh; }
    return out;
  }
  function colorAt(stops, h) {
    h = U.wrap(h, 24);
    for (let i = 1; i < stops.length; i++) if (h <= stops[i][0]) return U.mix(stops[i - 1][1], stops[i][1], U.invLerp(stops[i - 1][0], stops[i][0], h));
    return stops[stops.length - 1][1];
  }

  /* ============================================================== App */
  V.css('wc', `
    .wc-cv { position:absolute; inset:0; width:100%; height:100%; display:block; }
    .wc-lay { position:absolute; inset:0; pointer-events:none; }
    .wc-lab { position:absolute; transform:translate(-50%,-50%); font-size:2.45cqw; font-weight:720; letter-spacing:.12em; color:rgba(255,255,255,.5);
      white-space:nowrap; transition:color .35s, transform .45s var(--spring); font-variant-numeric:tabular-nums; }
    .wc-lab.on { color:#fff; transform:translate(-50%,-50%) scale(1.18); }
    .wc-lab.home::before { content:''; display:inline-block; width:1.1cqw; height:1.1cqw; border-radius:50%; background:${COLOR}; margin-right:.8cqw; vertical-align:.25cqw; box-shadow:0 0 1.4cqw ${COLOR}; }
    .wc-mid { position:absolute; inset:0; }
    .wc-g { position:absolute; left:50%; top:23.6cqw; width:9cqw; height:9cqw; margin-left:-4.5cqw; }
    .wc-g svg { width:100%; height:100%; display:block; }
    .wc-name { position:absolute; left:16%; right:16%; top:33.6cqw; text-align:center; font-size:6cqw; font-weight:620; letter-spacing:-.015em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .wc-time { position:absolute; left:0; right:0; top:40.5cqw; display:flex; justify-content:center; font-size:21cqw; font-weight:190; letter-spacing:-.045em; line-height:1; font-variant-numeric:tabular-nums; }
    .wc-diff { position:absolute; left:0; right:0; top:62.8cqw; text-align:center; font-size:4.1cqw; font-weight:600; color:rgba(255,255,255,.78); font-variant-numeric:tabular-nums; white-space:nowrap; }
    .wc-diff b { font-weight:650; color:#A9A8FF; }
    .wc-sun { position:absolute; left:0; right:0; top:69cqw; display:flex; justify-content:center; gap:3.4cqw; font-size:3.1cqw; font-weight:620; color:rgba(255,255,255,.55); font-variant-numeric:tabular-nums; }
    .wc-sun span { display:inline-flex; align-items:center; gap:1cqw; }
    .wc-sun svg { width:3.6cqw; height:3.6cqw; }
  `);

  const R = 466, BW = 46;                        // Ring: Mitte und Breite
  const angOf = (h) => 180 + h * 15;             // Ortsstunde → Uhrwinkel (Mitternacht unten, Mittag oben)
  const hasConic = typeof CanvasRenderingContext2D !== 'undefined' && 'createConicGradient' in CanvasRenderingContext2D.prototype;
  const crad = (a) => U.rad(a - 90);
  /** um Mitternacht (unten, Visto-Zone) treten Punkte zurück */
  const vistoFade = (a) => 0.28 + 0.72 * U.smoothstep(16, 30, Math.abs(U.angDiff(180, a)));

  function create(ctx) {
    const root = ctx.root;
    const store = ctx.store;
    let cities = allCities();
    let selId = (ctx.params && ctx.params.city && (find(ctx.params.city) || {}).id) || store.sel || 'home';
    if (!cities.find((c) => c.id === selId)) selId = 'home';
    let offs = {};            // Versatz je Stadt (Minuten), einmal pro Minute
    let homeOff = 0;
    let cur = null;           // info() der gewählten Stadt
    let crownAcc = 0;

    const cv = U.el('canvas', { class: 'wc-cv' });
    const g = cv.getContext('2d');
    const labs = U.el('div', { class: 'wc-lay' });
    const mid = U.el('div', { class: 'wc-mid' });
    const gEl = U.el('div', { class: 'wc-g' });
    const nameEl = U.el('div', { class: 'wc-name' });
    const timeEl = U.el('div', { class: 'wc-time' });
    const diffEl = U.el('div', { class: 'wc-diff' });
    const sunEl = U.el('div', { class: 'wc-sun' });
    mid.append(gEl, nameEl, timeEl, diffEl, sunEl);
    root.append(cv, labs, mid);
    const digits = V.faces.rollDigits(timeEl, { digitW: '0.58em', colonW: '0.27em' });

    let W = 0, sc = 1;
    function resize() {
      W = Math.max(64, Math.round((V.display.size || 360) * Math.min(2, V.display.dpr || 1)));
      cv.width = cv.height = W;
      sc = W / 1000;
    }
    resize();
    ctx.on('display:resize', resize);

    // Federn
    const handS = V.spring(0, { response: 0.6, bounce: 0.16 });      // Versatz des Zeigers (Grad) → 0
    const riseS = V.spring(6, { response: 0.7, bounce: 0 });
    const setS = V.spring(18, { response: 0.7, bounce: 0 });
    const introS = V.spring(0, { response: 0.9, bounce: 0.05 });
    const swapS = V.spring(1, { response: 0.45, bounce: 0.1 });
    swapS.onUpdate((v) => {
      const k = U.clamp(v, 0, 1.2);
      for (const el of [gEl, nameEl, diffEl, sunEl]) { el.style.opacity = U.clamp(k * 1.3 - 0.2, 0, 1).toFixed(3); el.style.transform = `translateY(${((1 - k) * 2.2).toFixed(2)}cqw)`; }
    });

    function refreshOffsets() {
      const ms = V.time.ms();
      homeOff = offsetMin(null, ms);
      for (const c of cities) offs[c.id] = offsetMin(c.zone, ms);
    }
    const localH = (c, ms) => U.wrap((ms / 3600e3) + offs[c.id] / 60, 24);
    const sel = () => cities.find((c) => c.id === selId) || cities[0];

    /* ------------------------------------------- Beschriftungen am Ring */
    const labEls = new Map();
    function layoutLabels() {
      const ms = V.time.ms();
      const list = cities.map((c) => ({ c, a: angOf(localH(c, ms)) })).sort((x, y) => x.a - y.a);
      // dichte Nachbarn abwechselnd auf eine innere Spur legen
      let lane = 0;
      list.forEach((it, i) => {
        const prev = list[(i - 1 + list.length) % list.length];
        const close = i > 0 && Math.abs(U.angDiff(prev.a, it.a)) < 11;
        lane = close ? 1 - lane : 0;
        it.lane = lane;
        it.la = it.a;
        // sehr dicht (z. B. gleiche Zeitzone): zusätzlich seitlich auseinanderziehen
        if (close && Math.abs(U.angDiff(prev.a, it.a)) < 6) { prev.la = prev.a - 4.5; it.la = it.a + 4.5; }
      });
      for (const it of list) {
        let el = labEls.get(it.c.id);
        if (!el) {
          el = U.el('div', { class: 'wc-lab' + (it.c.home ? ' home' : ''), text: it.c.code });
          labs.appendChild(el);
          labEls.set(it.c.id, el);
        }
        const p = V.display.pt(it.la, it.lane ? 360 : 402);
        el.style.left = p.x / 10 + 'cqw';
        el.style.top = p.y / 10 + 'cqw';
        el.classList.toggle('on', it.c.id === selId);
        el.style.opacity = it.c.id === selId ? '' : vistoFade(it.a).toFixed(2);
        el._a = it.a;
      }
    }

    /* ------------------------------------------------------- Mitte */
    function renderMid(swap) {
      const c = sel();
      cur = info(c);
      const w = cur.wall;
      digits.set(U.pad(w.getHours()) + ':' + U.pad(w.getMinutes()));
      nameEl.textContent = c.name;
      if (c.home) diffEl.innerHTML = 'Hier · <b>Ortszeit</b>';
      else diffEl.innerHTML = `<b>${diffText(cur.diff)}</b> · ${cur.rel}`;
      if (gEl._p !== cur.phase) { gEl.innerHTML = glyph(cur.phase); gEl._p = cur.phase; }
      if (cur.sun.polar) sunEl.innerHTML = `<span>${cur.sun.polar === 'night' ? 'Polarnacht' : 'Mitternachtssonne'}</span>`;
      else sunEl.innerHTML = `<span>${V.icon('sunrise')}${fmtH(cur.sun.rise)}</span><span style="opacity:.8">${V.icon('moon')}${fmtH(cur.sun.set)}</span>`;
      riseS.to(cur.sun.rise); setS.to(cur.sun.set);
      if (swap) { swapS.set(0.25); swapS.to(1); }
    }

    function select(id, user) {
      if (id === selId) return;
      const ms = V.time.ms();
      const old = sel();
      const a0 = angOf(localH(old, ms)) + handS.value;
      selId = id;
      store.sel = id;
      ctx.save();
      const a1 = angOf(localH(sel(), ms));
      handS.set(U.angDiff(a1, a0));
      handS.to(0);
      if (user) { V.sound.play('tick'); V.haptic(5); }
      renderMid(true);
      layoutLabels();
    }
    function step(dir) {
      const ms = V.time.ms();
      const list = cities.map((c) => ({ id: c.id, a: U.wrap(angOf(localH(c, ms)) - 180, 360) })).sort((x, y) => x.a - y.a);
      const i = list.findIndex((x) => x.id === selId);
      select(list[U.wrap(i + dir, list.length)].id, true);
    }

    /* ------------------------------------------------------- Zeichnen */
    function draw(t) {
      const ms = V.time.ms();
      const intro = U.clamp(introS.value, 0, 1.05);
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.clearRect(0, 0, 1000, 1000);
      const stops = ringStops(riseS.value, setS.value, cur && cur.sun.polar);
      // weiches Licht des Tages in den Raum (sehr dezent)
      const noonP = V.display.pt(angOf((riseS.value + setS.value) / 2), 520);
      const amb = g.createRadialGradient(noonP.x, noonP.y, 0, noonP.x, noonP.y, 620);
      amb.addColorStop(0, 'rgba(255,214,150,.09)'); amb.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = amb; g.fillRect(0, 0, 1000, 1000);
      // Ring
      const span = 360 * V.ease.outCubic(intro);
      g.lineCap = 'butt';
      g.lineWidth = BW;
      if (hasConic) {
        const cg = g.createConicGradient(crad(180), 500, 500);
        for (const [h, c] of stops) cg.addColorStop(U.clamp(h / 24, 0, 1), c);
        g.strokeStyle = cg;
        g.beginPath(); g.arc(500, 500, R, crad(-span / 2), crad(span / 2)); g.stroke();
      } else {
        for (let i = 0; i < 96; i++) {
          const h = i / 4, a = angOf(h);
          if (Math.abs(U.angDiff(0, a)) > span / 2) continue;
          g.strokeStyle = colorAt(stops, h + 0.125);
          g.beginPath(); g.arc(500, 500, R, crad(a), crad(a + 3.9)); g.stroke();
        }
      }
      // feine Kanten
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(255,255,255,.08)';
      g.beginPath(); g.arc(500, 500, R - BW / 2, 0, TAU); g.stroke();
      // Stundenmarken im Ring
      for (let h = 0; h < 24; h++) {
        const a = angOf(h);
        if (Math.abs(U.angDiff(0, a)) > span / 2) continue;
        const lum = U.luma(colorAt(stops, h));
        const big = h % 6 === 0;
        if (big && h !== 0) continue;   // Ziffern stehen dort
        const p0 = V.display.pt(a, R - (h % 3 === 0 ? 13 : 7)), p1 = V.display.pt(a, R + (h % 3 === 0 ? 13 : 7));
        g.strokeStyle = lum > 0.5 ? 'rgba(60,40,20,.35)' : 'rgba(255,255,255,.28)';
        g.lineWidth = h % 3 === 0 ? 2.6 : 1.6;
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      }
      g.font = "700 25px 'Inter Tight', system-ui, sans-serif";
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const h of [6, 12, 18]) {
        if (cities.some((c) => Math.abs(U.angDiff(angOf(h), angOf(localH(c, ms)))) < 4.5)) continue;   // Punkt liegt darauf
        const p = V.display.pt(angOf(h), R);
        const lum = U.luma(colorAt(stops, h));
        g.fillStyle = lum > 0.5 ? 'rgba(40,24,10,.62)' : 'rgba(255,255,255,.7)';
        g.globalAlpha = U.clamp(intro * 1.4 - 0.3, 0, 1);
        g.fillText(String(h), p.x, p.y + 1);
      }
      g.globalAlpha = 1;
      // Visto-Zone unten: Ring weich ausblenden
      g.save();
      g.globalCompositeOperation = 'destination-out';
      if (hasConic) {
        const fg = g.createConicGradient(crad(180 - 40), 500, 500);
        fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(22 / 360, 'rgba(0,0,0,.92)'); fg.addColorStop(58 / 360, 'rgba(0,0,0,.92)'); fg.addColorStop(80 / 360, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
        g.strokeStyle = fg;
      } else g.strokeStyle = 'rgba(0,0,0,.9)';
      g.lineWidth = BW + 6;
      g.beginPath(); g.arc(500, 500, R, crad(140), crad(220)); g.stroke();
      g.restore();

      // Zeiger zur gewählten Stadt
      const s = sel();
      const aSel = angOf(localH(s, ms)) + handS.value;
      const h0 = V.display.pt(aSel, 300), h1 = V.display.pt(aSel, R - BW / 2 - 6);
      const lg = g.createLinearGradient(h0.x, h0.y, h1.x, h1.y);
      lg.addColorStop(0, 'rgba(169,168,255,0)'); lg.addColorStop(1, 'rgba(169,168,255,.75)');
      g.strokeStyle = lg; g.lineWidth = 3; g.lineCap = 'round';
      g.globalAlpha = intro;
      g.beginPath(); g.moveTo(h0.x, h0.y); g.lineTo(h1.x, h1.y); g.stroke();
      g.globalAlpha = 1;

      // Stadtpunkte
      for (const c of cities) {
        const a = angOf(localH(c, ms));
        if (Math.abs(U.angDiff(0, a)) > span / 2 + 2) continue;
        const p = V.display.pt(a, R);
        const on = c.id === selId;
        const col = colorAt(stops, localH(c, ms));
        if (on) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
          const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 44);
          gl.addColorStop(0, `rgba(169,168,255,${0.55 + 0.2 * pulse})`); gl.addColorStop(1, 'rgba(169,168,255,0)');
          g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, 44, 0, TAU); g.fill();
        }
        const rr = on ? 15 : c.home ? 11 : 9;
        g.globalAlpha = on ? 1 : vistoFade(a);
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.beginPath(); g.arc(p.x, p.y, rr + 4, 0, TAU); g.fill();
        g.fillStyle = on ? '#ffffff' : U.luma(col) > 0.5 ? '#ffffff' : 'rgba(255,255,255,.92)';
        g.beginPath(); g.arc(p.x, p.y, rr, 0, TAU); g.fill();
        if (c.home) { g.fillStyle = COLOR; g.beginPath(); g.arc(p.x, p.y, rr * 0.45, 0, TAU); g.fill(); }
        g.globalAlpha = 1;
      }
      // Zeiger-Ende auf dem gewählten Punkt
      const hp = V.display.pt(aSel, R);
      g.strokeStyle = '#A9A8FF'; g.lineWidth = 3;
      g.beginPath(); g.arc(hp.x, hp.y, 21, 0, TAU); g.stroke();
    }

    /* ------------------------------------------------------- Ablauf */
    refreshOffsets();
    layoutLabels();
    renderMid(false);
    riseS.set(cur.sun.rise); setS.set(cur.sun.set);
    introS.to(1);
    ctx.onFrame((dt, t) => draw(t));
    ctx.on('time:minute', () => { refreshOffsets(); layoutLabels(); renderMid(false); });
    ctx.on('store:settings.location', () => { cities = allCities(); refreshOffsets(); labs.innerHTML = ''; labEls.clear(); layoutLabels(); renderMid(true); });

    V.gesture(root, {
      tap(p) {
        if (p.y > 868 && Math.abs(p.x - 500) < 175) return;     // Visto-Zone
        const pr = V.display.polar(p.x, p.y);
        if (pr.r < 330) return;
        const ms = V.time.ms();
        let best = null, bd = 1e9;
        for (const c of cities) {
          const a = angOf(localH(c, ms));
          const el = labEls.get(c.id);
          // Abstand zum Punkt am Ring oder zur Beschriftung
          const pd = V.display.pt(a, R), pl = el ? V.display.centerOf(el) : pd;
          const d = Math.min(Math.hypot(p.x - pd.x, p.y - pd.y), Math.hypot(p.x - pl.x, p.y - pl.y));
          if (d < bd) { bd = d; best = c; }
        }
        if (best && bd < 70) select(best.id, true);
      },
    });

    return {
      crown(dA) {
        crownAcc += dA;
        if (crownAcc >= 18) { crownAcc = 0; step(1); }
        else if (crownAcc <= -18) { crownAcc = 0; step(-1); }
      },
      params(p) { if (p && p.city) { const c = find(p.city); if (c && cities.find((x) => x.id === c.id)) select(c.id); } },
    };
  }

  V.apps.register({
    id: 'worldclock',
    name: 'Weltuhr',
    icon: 'globe',
    color: COLOR,
    order: 60,
    keywords: ['weltuhr', 'zeitzonen', 'zeitzone'],

    init() {
      V.actions.register('worldclock.time', {
        desc: 'Liefert die aktuelle Ortszeit einer Stadt weltweit (z. B. Tokio, New York, London) und den Zeitunterschied zum Standort.',
        params: { city: { type: 'string', description: 'Stadt, z. B. „Tokio“' } },
        required: ['city'],
        run(a) { return answer(find(a.city), a.city); },
      });
      V.brain.intent({
        id: 'worldclock', priority: 8,
        match: (t) => {
          if (!/(wie spät|wie viel uhr|wieviel uhr|uhrzeit|welche zeit|zeitverschiebung|zeitunterschied|zeitzone|wie spät ist)/.test(t)) return null;
          const c = find(t);
          return c ? { c } : null;
        },
        run(m) { return answer(m.c); },
      });
    },
    create,
  });

  function answer(c, raw) {
    if (!c) return { say: `${raw ? 'Die Stadt „' + raw + '“' : 'Diese Stadt'} kenne ich leider noch nicht.`, emotion: 'confused' };
    const r = timeOf(c);
    const night = r.hour >= 22 || r.hour < 6;
    const dayNote = r.rel === 'Morgen' ? `, dort ist schon ${V.fmt.WD[r.wall.getDay()]}` : r.rel === 'Gestern' ? `, dort ist noch ${V.fmt.WD[r.wall.getDay()]}` : '';
    const say = r.diff === 0 ? `In ${c.name} ist es ${r.spoken} Uhr – genau wie hier.` : `In ${c.name} ist es ${r.spoken} Uhr, ${diffText(r.diff, true)}${dayNote}.`;
    return { say, card: { type: 'big', text: r.time, sub: c.name + ' · ' + (r.diff ? diffText(r.diff) : 'gleiche Zeit') }, emotion: night ? 'sleepy' : 'happy' };
  }
})();
