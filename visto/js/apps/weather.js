/* VistoOS · apps/weather.js — Wetter
 *
 *  Dienst (sofort beim Laden verfügbar, Zifferblätter nutzen ihn):
 *    V.weather.current(stadt?)        → {temp, feels, code, text, icon, hi, lo, place, precip, wind, humidity, night, sunrise, sunset}
 *    V.weather.hourly(n = 24, stadt?) → [{date, hour, temp, feels, code, text, icon, night, precip (0…1), rain, mm, cloud, wind, humidity}]
 *    V.weather.daily(n = 7, stadt?)   → [{date, hi, lo, code, text, icon, precip, mm, wind, sunrise, sunset}]
 *    V.weather.describe(code, nacht)  → {code, text, icon, color, say, fc}
 *    V.info.weather()                 → {temp, icon, text, hi, lo, place}
 *
 *  Simulation: deterministisch, gesät mit Stadt + Datum. Klima je Stadt (Jahresmittel, Jahresgang,
 *  Feuchte, Nebelneigung, Gewitterneigung) + Jahreszeit aus V.time.now(). Wetterlagen ziehen über
 *  mehrere Tage (geglättet), stündlich weich interpoliert, Sonnenauf- und -untergang berechnet.
 *
 *  App: vollflächiger, lebendiger Himmel (Canvas) je nach Lage und Tageslicht – Sonne mit Strahlen,
 *       Mond in seiner Phase, Sterne, ziehende Wolken, Regen, Schnee, Nebelbänder, Gewitterblitze.
 *       Mitte: große, dünne Temperatur, Zustand, Höchst/Tiefst. Rand: 24-Stunden-Kurve als Bogen
 *       (210° → 150°, die Visto-Zone unten bleibt frei), Tag/Nacht am Rand, Symbole alle 3 Stunden.
 *       ↑ wischen, „7 Tage“ antippen oder am Rand drehen → 7-Tage-Ring: Tage als Bögen am Rand,
 *       in der Mitte der gewählte Tag. Drehen wählt den Tag, ↓ wischen oder Zurück → Jetzt.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#3D8BFF';
  const TAU = Math.PI * 2;
  const HOUR = 3600e3;

  /* ================================================================ Klima */
  // mean/amp: Jahresmittel und halbe Jahresschwankung (°C), wet: Niederschlagsneigung,
  // fog: Nebelneigung, storm: Gewitterneigung, wind: Windigkeit, cont: Kontinentalität
  const CITIES = [
    { id: 'berlin', name: 'Berlin', lat: 52.52, lon: 13.40, mean: 9.9, amp: 9.9, wet: 0.95, fog: 0.9, storm: 1.0, wind: 1.0, cont: 0.6 },
    { id: 'hamburg', name: 'Hamburg', lat: 53.55, lon: 9.99, mean: 9.6, amp: 8.4, wet: 1.2, fog: 1.1, storm: 0.8, wind: 1.35, cont: 0.3 },
    { id: 'muenchen', name: 'München', lat: 48.14, lon: 11.58, mean: 9.0, amp: 9.7, wet: 1.15, fog: 1.0, storm: 1.4, wind: 0.85, cont: 0.7 },
    { id: 'koeln', name: 'Köln', lat: 50.94, lon: 6.96, mean: 10.9, amp: 8.3, wet: 1.0, fog: 1.0, storm: 1.0, wind: 1.0, cont: 0.35 },
    { id: 'frankfurt', name: 'Frankfurt', lat: 50.11, lon: 8.68, mean: 10.6, amp: 9.5, wet: 0.9, fog: 1.05, storm: 1.1, wind: 0.9, cont: 0.5 },
    { id: 'wien', name: 'Wien', lat: 48.21, lon: 16.37, mean: 11.0, amp: 10.6, wet: 0.85, fog: 1.0, storm: 1.2, wind: 1.25, cont: 0.85 },
    { id: 'zuerich', name: 'Zürich', lat: 47.37, lon: 8.54, mean: 9.3, amp: 9.0, wet: 1.25, fog: 1.3, storm: 1.2, wind: 0.8, cont: 0.55 },
  ];
  const ALIAS = { munich: 'muenchen', munchen: 'muenchen', zurich: 'zuerich', vienna: 'wien', cologne: 'koeln', koln: 'koeln', 'frankfurt am main': 'frankfurt' };
  const keyOf = (s) => String(s || '').toLowerCase().trim().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  function findCity(name) {
    if (!name) return null;
    if (typeof name === 'object' && name.id) return name;
    let k = keyOf(name);
    k = ALIAS[k] || k;
    return CITIES.find((c) => c.id === k) || CITIES.find((c) => k.startsWith(c.id)) || null;
  }
  const home = () => findCity(V.store.get('settings.location', 'Berlin')) || CITIES[0];
  const cityOf = (name) => findCity(name) || home();

  /* ------------------------------------------------------------ Kalender */
  function midnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dkey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayOfYear(d) { return Math.round((midnight(d) - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1; }
  const hoursOf = (d) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const fmtH = (h) => { h = U.wrap(h, 24); const m = Math.round((h % 1) * 60); return Math.floor(h) + (m === 60 ? 1 : 0) + ':' + U.pad(m === 60 ? 0 : m); };

  /* ---------------------------------------------------------- Zwischenspeicher */
  const cache = new Map();
  function memo(key, fn) {
    let v = cache.get(key);
    if (v === undefined) {
      v = fn();
      cache.set(key, v);
      if (cache.size > 6000) cache.delete(cache.keys().next().value);
    }
    return v;
  }

  /* --------------------------------------------------------------- Sonne */
  /** Sonnenauf- und -untergang in Stunden der Geräteuhr (NOAA-Näherung) */
  function sunTimes(c, d) {
    return memo('sun|' + c.id + '|' + dkey(d), () => {
      const gam = (TAU / 365) * (dayOfYear(d) - 1);
      const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(gam) - 0.032077 * Math.sin(gam) - 0.014615 * Math.cos(2 * gam) - 0.040849 * Math.sin(2 * gam));
      const decl = 0.006918 - 0.399912 * Math.cos(gam) + 0.070257 * Math.sin(gam) - 0.006758 * Math.cos(2 * gam) + 0.000907 * Math.sin(2 * gam) - 0.002697 * Math.cos(3 * gam) + 0.00148 * Math.sin(3 * gam);
      const lat = U.rad(c.lat);
      const cosH = Math.cos(U.rad(90.833)) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
      const ha = U.deg(Math.acos(U.clamp(cosH, -1, 1)));
      const tz = -new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTimezoneOffset() / 60;
      const noon = (720 - 4 * c.lon - eq) / 60 + tz;
      return { rise: noon - (ha * 4) / 60, set: noon + (ha * 4) / 60, noon };
    });
  }
  /** Tageslicht 0 (Nacht) … 1 (Tag) mit weicher Dämmerung */
  function daylight(c, d, h) {
    const s = sunTimes(c, d);
    return U.smoothstep(s.rise - 0.6, s.rise + 0.55, h) * (1 - U.smoothstep(s.set - 0.55, s.set + 0.6, h));
  }
  /** Dämmerungsstärke 0…1 (Morgen- und Abendrot) */
  function duskOf(c, d, h) {
    const s = sunTimes(c, d);
    const b = (x) => 1 - U.smoothstep(0, 1.35, Math.abs(h - x));
    return Math.max(b(s.rise + 0.15), b(s.set - 0.15));
  }
  function moonPhase(ms) { return U.wrap((ms - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853, 1); }

  /* ----------------------------------------------------------- Beschreibung */
  const DESC = {
    clear: { text: ['Sonnig', 'Klar'], icon: ['sun', 'moon'], say: ['sonnig', 'klar'], fc: 'Sonne pur', color: '#FFD23F' },
    fair: { text: ['Heiter', 'Meist klar'], icon: ['weather', 'moon'], say: ['heiter', 'meist klar'], fc: 'freundlich', color: '#FFC94D' },
    partly: { text: ['Teils bewölkt', 'Teils bewölkt'], icon: ['weather', 'cloud'], say: ['teils bewölkt', 'teils bewölkt'], fc: 'ein Mix aus Sonne und Wolken', color: '#8EC5FF' },
    cloudy: { text: ['Stark bewölkt', 'Stark bewölkt'], icon: ['cloud', 'cloud'], say: ['stark bewölkt', 'stark bewölkt'], fc: 'viele Wolken', color: '#9AA7B8' },
    overcast: { text: ['Bedeckt', 'Bedeckt'], icon: ['cloud', 'cloud'], say: ['bedeckt', 'bedeckt'], fc: 'grau und bedeckt', color: '#8792A3' },
    fog: { text: ['Nebel', 'Nebel'], icon: ['fog', 'fog'], say: ['neblig', 'neblig'], fc: 'Nebel', color: '#A9B2BE' },
    drizzle: { text: ['Nieselregen', 'Nieselregen'], icon: ['rain', 'rain'], say: ['es nieselt', 'es nieselt'], fc: 'Nieselregen', color: '#6CB6FF' },
    rain: { text: ['Regen', 'Regen'], icon: ['rain', 'rain'], say: ['es regnet', 'es regnet'], fc: 'Regen', color: '#4DA3FF' },
    heavy: { text: ['Starkregen', 'Starkregen'], icon: ['rain', 'rain'], say: ['es regnet kräftig', 'es regnet kräftig'], fc: 'kräftiger Regen', color: '#2F84F0' },
    showers: { text: ['Regenschauer', 'Regenschauer'], icon: ['rain', 'rain'], say: ['es gibt Schauer', 'es gibt Schauer'], fc: 'Schauer', color: '#4DA3FF' },
    storm: { text: ['Gewitter', 'Gewitter'], icon: ['storm', 'storm'], say: ['es gewittert', 'es gewittert'], fc: 'Gewitter', color: '#FFB020' },
    sleet: { text: ['Schneeregen', 'Schneeregen'], icon: ['snow', 'snow'], say: ['es fällt Schneeregen', 'es fällt Schneeregen'], fc: 'Schneeregen', color: '#9FD0FF' },
    snow: { text: ['Schneefall', 'Schneefall'], icon: ['snow', 'snow'], say: ['es schneit', 'es schneit'], fc: 'Schnee', color: '#DDEBFF' },
  };
  const WET = { drizzle: 1, rain: 1, heavy: 1, showers: 1, storm: 1, sleet: 1, snow: 1 };
  /** Zustand als Satzteil: Adjektive klein („teils bewölkt“), Nomen groß („Regen“) */
  function phrase(code, night) {
    const d = describe(code, night);
    return d.wet || code === 'fog' ? d.text.replace('Regenschauer', 'Schauer') : d.text.toLowerCase();
  }
  function describe(code, night) {
    const d = DESC[code] || DESC.partly;
    const i = night ? 1 : 0;
    return { code, text: d.text[i], icon: d.icon[i], say: d.say[i], fc: d.fc, color: d.color, wet: !!WET[code] };
  }

  /* ------------------------------------------------------------ Simulation */
  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.732; }
  function dayRaw(c, d) {
    return memo('raw|' + c.id + '|' + dkey(d), () => {
      const r = U.rng('visto-wx|' + c.id + '|' + dkey(d));
      return { t: gauss(r), p: gauss(r), w: r(), h: r(), conv: r(), fog: r() };
    });
  }
  const NORM = 1 / Math.sqrt(0.5 * 0.5 + 0.32 * 0.32 + 0.18 * 0.18);
  /** Wetterlage eines Tages: geglättet über die Vortage, damit Lagen mehrere Tage anhalten */
  function dayState(c, d) {
    return memo('st|' + c.id + '|' + dkey(d), () => {
      const a = dayRaw(c, d), b = dayRaw(c, addDays(d, -1)), e = dayRaw(c, addDays(d, -2));
      return {
        t: (a.t * 0.5 + b.t * 0.32 + e.t * 0.18) * NORM,
        p: (a.p * 0.5 + b.p * 0.32 + e.p * 0.18) * NORM,
        w: a.w * 0.6 + b.w * 0.4, h: a.h * 0.65 + b.h * 0.35, conv: a.conv, fog: a.fog,
      };
    });
  }
  function stateAt(c, d0, h) {
    // Tageswerte gelten um 12 Uhr, dazwischen weich überblenden
    const early = h < 12;
    const A = dayState(c, early ? addDays(d0, -1) : d0), B = dayState(c, early ? d0 : addDays(d0, 1));
    const f = U.smoothstep(0, 1, early ? (h + 12) / 24 : (h - 12) / 24);
    const o = {};
    for (const k in A) o[k] = U.lerp(A[k], B[k], f);
    return o;
  }

  function hourRec(c, d0, h) {
    return memo('h|' + c.id + '|' + dkey(d0) + '|' + h, () => computeHour(c, d0, h));
  }
  function computeHour(c, d0, h) {
    const S = stateAt(c, d0, h + 0.5);
    const s = Math.cos((TAU * (dayOfYear(d0) - 200)) / 365);   // 1 Hochsommer … −1 Hochwinter
    const win = (1 - s) / 2, sum = 1 - win;
    const seed = (U.hash(c.id) % 997) / 7;
    const eh = d0.getTime() / HOUR + h;
    const n1 = U.noise(eh / 5.5, seed), n2 = U.noise(eh / 2.3, seed + 3.1), n3 = U.noise(eh / 9, seed + 7.7);
    const sun = sunTimes(c, d0);
    // Wärmegewitter: Sommer, Nachmittag, labile Tage
    const aft = U.smoothstep(11, 14.5, h) * (1 - U.smoothstep(19, 22.5, h));
    const conv = U.clamp((S.conv - 0.6) / 0.4, 0, 1) * aft * U.clamp((sum - 0.45) * 2.5, 0, 1);
    // Bewölkung
    let C = 0.5 - 0.32 * S.p + 0.22 * win - 0.06 * sum + 0.2 * n1 + 0.1 * (S.h - 0.5) + conv * 0.45;
    C += win * Math.max(0, S.p) * (0.3 + 0.5 * S.h) * c.fog * 0.55;      // Hochnebel bei winterlichem Hochdruck
    C = U.clamp(C, 0.02, 1);
    // Temperatur: Jahresgang + Lage + Tagesgang (Minimum vor Sonnenaufgang, Maximum am Nachmittag)
    const mean = c.mean + c.amp * s + S.t * (2.2 + 1.4 * win * (0.6 + c.cont)) + n3 * 0.8;
    const range = (3.8 + 6.6 * sum) * (1 - 0.62 * C) + 1.2;
    const tLo = sun.rise - 0.2, tHi = 14.6 + 0.6 * sum;
    let shape;
    if (h >= tLo && h <= tHi) shape = -Math.cos((Math.PI * (h - tLo)) / (tHi - tLo));
    else { const hh = h < tLo ? h + 24 : h; shape = Math.cos((Math.PI * (hh - tHi)) / (tLo + 24 - tHi)); }
    let T = mean + (range / 2) * shape;
    if (shape < 0) T -= (1 - C) * (0.6 + 2.2 * win) * c.cont * -shape;   // klare Nächte kühlen aus
    // Niederschlag
    let pot = U.clamp((C - 0.62) / 0.38, 0, 1) * U.clamp(0.36 - 0.6 * S.p + 0.3 * n2, 0, 1.3) * c.wet;
    pot = Math.max(pot, conv * (0.65 + 0.35 * n2) * c.storm);
    T -= Math.max(0, pot - 0.3) * 2 * sum;
    const wet = pot > 0.32;
    const inten = wet ? U.clamp((pot - 0.32) / 0.6, 0.04, 1) * (conv > 0.3 ? 1 : 0.62 + 0.38 * sum) : 0;
    const prob = U.smoothstep(0.1, 0.5, pot);
    // Wind und Feuchte
    const wind = Math.max(2, (6 + 13 * S.w + 9 * Math.max(0, -S.p) + 4 * n2) * c.wind + conv * 18 + 3 * Math.sin(Math.PI * U.clamp((h - 8) / 12, 0, 1)));
    const hum = U.clamp(52 + 34 * C + 9 * win - 12 * sum * (1 - C) + (wet ? 12 : 0) - 8 * Math.max(0, shape), 28, 99);
    // Nebel: Herbst/Winter, Hochdruck, früh am Morgen, wenig Wind
    const tod = h < 12 ? 1 - U.smoothstep(7, 11.5, h) : U.smoothstep(18.5, 23.5, h);
    const fogPot = c.fog * U.clamp((win - 0.25) * 1.6, 0, 1) * (0.45 + 0.55 * S.fog) * U.clamp(0.5 + 0.45 * S.p, 0, 1.2) * tod * U.clamp(1.3 - wind / 22, 0, 1) * 1.3;
    const fog = !wet && fogPot > 0.6;
    const storm = conv > 0.5 && pot > 0.62 && T > 14;
    const night = daylight(c, d0, h + 0.5) < 0.5;
    let code;
    if (wet) {
      if (storm) code = 'storm';
      else if (T <= 0.6) code = 'snow';
      else if (T <= 2.6) code = 'sleet';
      else if (conv > 0.3) code = 'showers';
      else if (inten < 0.22) code = 'drizzle';
      else if (inten > 0.8) code = 'heavy';
      else code = 'rain';
    } else if (fog) code = 'fog';
    else if (C < 0.16) code = 'clear';
    else if (C < 0.42) code = 'fair';
    else if (C < 0.68) code = 'partly';
    else if (C < 0.87) code = 'cloudy';
    else code = 'overcast';
    let feels = T;
    if (T <= 10 && wind > 4.8) { const v = Math.pow(wind, 0.16); feels = 13.12 + 0.6215 * T - 11.37 * v + 0.3965 * T * v; }
    else if (T >= 26) feels = T + (hum - 40) * 0.08;
    const date = new Date(d0);
    date.setHours(h, 0, 0, 0);
    const dsc = describe(code, night);
    return {
      date, hour: h, temp: T, feels, code, text: dsc.text, icon: dsc.icon, night,
      precip: prob, rain: inten, mm: wet ? Math.pow(inten, 1.6) * 7 : 0, cloud: C, wind, humidity: hum, fog: fog ? 1 : 0, storm,
    };
  }

  function dayRec(c, d0) {
    return memo('d|' + c.id + '|' + dkey(d0), () => {
      const hrs = [];
      for (let h = 0; h < 24; h++) hrs.push(hourRec(c, d0, h));
      let hi = -99, lo = 99, mm = 0, wind = 0, cl = 0;
      for (const r of hrs) { hi = Math.max(hi, r.temp); lo = Math.min(lo, r.temp); mm += r.mm; }
      const dayH = hrs.slice(7, 22);
      const counts = {};
      for (const r of dayH) { counts[r.code] = (counts[r.code] || 0) + 1; wind = Math.max(wind, r.wind); cl += r.cloud; }
      cl /= dayH.length;
      const wetH = dayH.filter((r) => WET[r.code]);
      let code;
      if (counts.storm) code = 'storm';
      else if (wetH.length) {
        const sn = counts.snow || 0, sl = counts.sleet || 0;
        if (sn >= Math.max(2, wetH.length / 2)) code = 'snow';
        else if (sn + sl >= wetH.length / 2) code = 'sleet';
        else if (wetH.length >= 5) code = (counts.heavy || 0) >= 3 ? 'heavy' : 'rain';
        else if (wetH.length >= 2 || counts.showers) code = 'showers';
        else code = counts.drizzle ? 'drizzle' : 'showers';
      } else if ((counts.fog || 0) >= 5) code = 'fog';
      else code = cl < 0.16 ? 'clear' : cl < 0.4 ? 'fair' : cl < 0.64 ? 'partly' : cl < 0.8 ? 'cloudy' : 'overcast';
      let precip = 0;
      for (const r of hrs.slice(6)) precip = Math.max(precip, r.precip);
      const sun = sunTimes(c, d0);
      const dsc = describe(code, false);
      return { date: new Date(d0), hi, lo, code, text: dsc.text, icon: dsc.icon, precip, mm, wind, sunrise: sun.rise, sunset: sun.set, hours: hrs };
    });
  }

  function hourly(n = 24, cityName, from) {
    const c = cityOf(cityName);
    const now = from || V.time.now();
    const out = [];
    let d = midnight(now), h = now.getHours();
    for (let i = 0; i < n; i++) {
      out.push(hourRec(c, d, h));
      if (++h >= 24) { h = 0; d = addDays(d, 1); }
    }
    return out;
  }
  function daily(n = 7, cityName) {
    const c = cityOf(cityName);
    const d0 = midnight(V.time.now());
    const out = [];
    for (let i = 0; i < n; i++) out.push(dayRec(c, addDays(d0, i)));
    return out;
  }
  function current(cityName) {
    const c = cityOf(cityName);
    const now = V.time.now();
    const d = midnight(now), h = now.getHours(), f = now.getMinutes() / 60;
    const a = hourRec(c, d, h), b = h < 23 ? hourRec(c, d, h + 1) : hourRec(c, addDays(d, 1), 0);
    const day = dayRec(c, d);
    const night = daylight(c, d, hoursOf(now)) < 0.5;
    const dsc = describe(a.code, night);
    const temp = U.lerp(a.temp, b.temp, f);
    return {
      temp, feels: U.lerp(a.feels, b.feels, f), code: a.code, text: dsc.text, icon: dsc.icon, night,
      hi: Math.max(day.hi, temp), lo: Math.min(day.lo, temp), place: c.name, city: c.id,
      precip: a.precip, rain: a.rain, wind: U.lerp(a.wind, b.wind, f), humidity: U.lerp(a.humidity, b.humidity, f), cloud: U.lerp(a.cloud, b.cloud, f),
      sunrise: day.sunrise, sunset: day.sunset, date: now,
    };
  }

  V.weather = {
    cities: CITIES.map((c) => c.name),
    city: (n) => cityOf(n).name,
    find: (n) => { const c = findCity(n); return c ? c.name : null; },
    current, hourly, daily, describe,
    sun(date, cityName) { const c = cityOf(cityName); const s = sunTimes(c, midnight(date || V.time.now())); return { rise: s.rise, set: s.set, riseText: fmtH(s.rise), setText: fmtH(s.set) }; },
  };
  V.info = V.info || {};
  V.info.weather = () => { const w = current(); return { temp: w.temp, icon: w.icon, text: w.text, hi: w.hi, lo: w.lo, place: w.place, code: w.code }; };

  /* ================================================== Farben und Symbole */
  const TSTOPS = [[-12, '#A9C1FF'], [-3, '#74C6FF'], [4, '#5BD6E8'], [10, '#62E3A5'], [16, '#D2E66A'], [21, '#FFCA4D'], [27, '#FF8F3D'], [34, '#FF4D3D']];
  function tempColor(T) {
    if (T <= TSTOPS[0][0]) return TSTOPS[0][1];
    for (let i = 1; i < TSTOPS.length; i++) {
      if (T <= TSTOPS[i][0]) return U.mix(TSTOPS[i - 1][1], TSTOPS[i][1], (T - TSTOPS[i - 1][0]) / (TSTOPS[i][0] - TSTOPS[i - 1][0]));
    }
    return TSTOPS[TSTOPS.length - 1][1];
  }
  const deg = (T) => Math.round(T).toString().replace('-', '−') + '°';

  // mehrfarbige Wettersymbole (64 × 64)
  const CLOUD = 'M18 50H46A10 10 0 0 0 47 30.1A14 14 0 0 0 20.5 26.5A11.8 11.8 0 0 0 18 50Z';
  const MOON = 'M38.25 17.27A16 16 0 1 0 46.83 37.99A12.2 12.2 0 0 1 38.25 17.27Z';
  function gSun(cx, cy, r, col = '#FFD23F') {
    let s = `<g stroke="${col}" stroke-linecap="round" stroke-width="${(r * 0.3).toFixed(2)}">`;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, r1 = r * 1.48, r2 = r * 1.98;
      s += `<path d="M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}"/>`;
    }
    return s + `</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`;
  }
  const gMoon = (tx = 0, ty = 0, k = 1) => `<path transform="translate(${tx} ${ty}) scale(${k})" fill="#F3EFE2" d="${MOON}"/>`;
  const gCloud = (fill, tx = 0, ty = 0, k = 1) => `<path transform="translate(${tx} ${ty}) scale(${k})" fill="${fill}" d="${CLOUD}"/>`;
  const gDrops = (n, col = '#5AB0FF') => {
    const xs = n === 4 ? [19, 28, 37, 46] : n === 2 ? [26, 38] : [22, 32, 42];
    return `<path d="${xs.map((x) => `M${x} 51l-3 7`).join('')}" stroke="${col}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`;
  };
  const gFlakes = (pts) => `<g fill="#FFFFFF">${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.7"/>`).join('')}</g>`;
  function glyph(code, night) {
    let b;
    const up = (fill) => gCloud(fill, 0, -6);
    switch (code) {
      case 'clear': b = night ? gMoon(0, 0, 1) : gSun(32, 32, 11); break;
      case 'fair': b = (night ? gMoon(-6, -6, 0.72) : gSun(23, 23, 8.5)) + gCloud('#FFFFFF', 16, 15, 0.78); break;
      case 'partly': b = (night ? gMoon(-8, -8, 0.7) : gSun(21, 21, 8)) + gCloud('#F4F6FA', 5, 9, 0.92); break;
      case 'cloudy': b = gCloud('#9FAABB', 17, 1, 0.72) + gCloud('#F1F4F8', 2, 9, 0.9); break;
      case 'overcast': b = gCloud('#7F8A9C', 15, 2, 0.75) + gCloud('#C9D0DA', 2, 9, 0.9); break;
      case 'fog': b = gCloud('#B6BFCC', 8, -6, 0.75) + '<path d="M12 42h40M8 49h48M16 56h32" stroke="#D6DCE4" stroke-width="3.6" stroke-linecap="round" fill="none"/>'; break;
      case 'drizzle': b = up('#E2E7EE') + '<g fill="#6CB6FF"><circle cx="23" cy="54" r="2.2"/><circle cx="33" cy="57" r="2.2"/><circle cx="43" cy="54" r="2.2"/></g>'; break;
      case 'rain': b = up('#D6DDE7') + gDrops(3); break;
      case 'heavy': b = up('#A2ADBE') + gDrops(4, '#3F95FF'); break;
      case 'showers': b = (night ? gMoon(-8, -12, 0.66) : gSun(21, 16, 7.5)) + gCloud('#E2E7EE', 4, 0, 0.9) + gDrops(2); break;
      case 'storm': b = up('#8C97A8') + '<path d="M34 41l-8 11h6.5l-4 9 11.5-13h-6.8l4.4-7z" fill="#FFC21A"/>' + '<path d="M18 51l-2.6 6M48 51l-2.6 6" stroke="#5AB0FF" stroke-width="3.2" stroke-linecap="round"/>'; break;
      case 'sleet': b = up('#D6DDE7') + '<path d="M24 51l-3 7M40 51l-3 7" stroke="#5AB0FF" stroke-width="3.4" stroke-linecap="round"/>' + gFlakes([[32, 55]]); break;
      case 'snow': b = up('#E7ECF3') + gFlakes([[22, 53], [32, 57], [42, 53], [27, 61], [37, 61]]); break;
      default: b = gCloud('#F1F4F8');
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${b}</svg>`;
  }

  /* ============================================================== Himmel */
  const SKY = {
    dayClear: ['#0B3C93', '#2A6FD3', '#5EA3EE'],
    dayOver: ['#2C3542', '#465063', '#626D80'],
    nightClear: ['#000002', '#030a22', '#0b1840'],
    nightOver: ['#020203', '#090a0e', '#14171d'],
    dusk: ['#172160', '#7B4C8E', '#F68A57'],
    storm: ['#121619', '#232a30', '#363e46'],
  };
  function mix3(a, b, t) { return [U.mix(a[0], b[0], t), U.mix(a[1], b[1], t), U.mix(a[2], b[2], t)]; }

  let sprites = null;
  function cloudSprite(seed, dark) {
    const cv = document.createElement('canvas');
    cv.width = 400; cv.height = 220;
    const x = cv.getContext('2d');
    const r = U.rng('cloud' + seed);
    const n = 9 + Math.floor(r() * 5);
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const hump = Math.sin(u * Math.PI);
      const pr = 34 + hump * 50 + r() * 18;
      puffs.push([62 + u * 276 + (r() - 0.5) * 22, 170 - hump * 44 - r() * 16, pr]);
    }
    const base = dark ? [62, 69, 82] : [196, 205, 220];
    const hi = dark ? [104, 112, 126] : [255, 255, 255];
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    for (const [px, py, pr] of puffs) {
      const gr = x.createRadialGradient(px, py + pr * 0.22, pr * 0.1, px, py + pr * 0.22, pr);
      gr.addColorStop(0, rgba(base, 0.9)); gr.addColorStop(0.62, rgba(base, 0.55)); gr.addColorStop(1, rgba(base, 0));
      x.fillStyle = gr; x.beginPath(); x.arc(px, py + pr * 0.22, pr, 0, TAU); x.fill();
    }
    for (const [px, py, pr] of puffs) {
      const gr = x.createRadialGradient(px - pr * 0.18, py - pr * 0.3, pr * 0.05, px, py - pr * 0.08, pr * 0.86);
      gr.addColorStop(0, rgba(hi, 0.95)); gr.addColorStop(0.55, rgba(hi, 0.45)); gr.addColorStop(1, rgba(hi, 0));
      x.fillStyle = gr; x.beginPath(); x.arc(px, py - pr * 0.08, pr * 0.86, 0, TAU); x.fill();
    }
    // weicher, flacher Boden
    x.globalCompositeOperation = 'destination-out';
    const fade = x.createLinearGradient(0, 168, 0, 220);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = fade; x.fillRect(0, 160, 400, 60);
    return cv;
  }
  function getSprites() {
    if (!sprites) {
      sprites = { light: [], dark: [] };
      for (let i = 0; i < 4; i++) { sprites.light.push(cloudSprite(i, false)); sprites.dark.push(cloudSprite(i, true)); }
    }
    return sprites;
  }

  /** Himmelsszene auf einer Leinwand. setTarget(p) – alle Werte gleiten weich zum Ziel. */
  function makeSky(cv) {
    const g = cv.getContext('2d');
    let W = 0, sc = 1;
    // sunA/moonA: Uhrwinkel der Gestirne (die App legt sie in Lücken zwischen ihre Symbole), r = 338
    const P = { day: 0, dusk: 0, cover: 0.3, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0.3, sunF: 0.5, moonF: 0.5, sunA: 0, moonA: 0, phase: 0.5 };
    const T = Object.assign({}, P);
    const r = U.rng('visto-sky');
    const stars = [];
    for (let i = 0; i < 170; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 520;
      stars.push({ x: 500 + Math.cos(a) * d, y: 500 + Math.sin(a) * d * 0.95 - 40, s: 0.6 + Math.pow(r(), 3) * 2.2, ph: r() * TAU, sp: 0.6 + r() * 2.2 });
    }
    const clouds = [];
    for (let i = 0; i < 15; i++) {
      const layer = i % 3;
      clouds.push({ x: r() * 1400 - 300, y: 90 + r() * 560 + layer * 40, k: 0.55 + layer * 0.32 + r() * 0.3, v: 5 + layer * 7 + r() * 6, sp: i % 4, th: (i + 0.5) / 15, layer, vis: 0 });
    }
    clouds.sort((a, b) => a.layer - b.layer || a.k - b.k);
    const drops = [];
    for (let i = 0; i < 360; i++) drops.push({ x: r() * 1100 - 50, y: r() * 1000, z: 0.3 + r() * 0.7, l: 22 + r() * 30 });
    const flakes = [];
    for (let i = 0; i < 260; i++) flakes.push({ x: r() * 1000, y: r() * 1000, z: 0.25 + r() * 0.75, ph: r() * TAU });
    const fogs = [];
    for (let i = 0; i < 6; i++) fogs.push({ y: 300 + i * 105 + r() * 40, x: r() * 1000, w: 380 + r() * 300, v: (4 + r() * 8) * (i % 2 ? 1 : -1), a: 0.6 + r() * 0.4 });
    let flash = 0, bolt = null, boltT = 0, nextStrike = 1.2;
    let vignette = null;

    function resize() {
      const px = (V.display.size || 360) * Math.min(2, V.display.dpr || 1);
      W = Math.max(64, Math.round(px));
      cv.width = cv.height = W;
      sc = W / 1000;
      vignette = null;
    }
    resize();

    function setTarget(p, instant) {
      Object.assign(T, p);
      if (instant) Object.assign(P, T);
    }
    function step(dt) {
      const k = 1 - Math.exp(-dt * 1.7);
      for (const key in T) {
        if (key === 'sunA' || key === 'moonA') P[key] += (T[key] - P[key]) * (1 - Math.exp(-dt * 3));
        else P[key] += (T[key] - P[key]) * k;
      }
    }

    function strike() {
      flash = 1;
      const x0 = 260 + Math.random() * 480;
      const pts = [[x0, 170 + Math.random() * 60]];
      let x = pts[0][0], y = pts[0][1];
      while (y < 640 + Math.random() * 100) { y += 30 + Math.random() * 34; x += (Math.random() - 0.5) * 70; pts.push([x, y]); }
      const br = [];
      const bi = 2 + Math.floor(Math.random() * 3);
      if (pts[bi]) { let bx = pts[bi][0], by = pts[bi][1]; br.push([bx, by]); for (let i = 0; i < 4; i++) { by += 26 + Math.random() * 20; bx += (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 26); br.push([bx, by]); } }
      bolt = { pts, br };
      boltT = 0.32;
      setTimeout(() => { flash = Math.max(flash, 0.7); }, 130);
    }

    function draw(dt, t) {
      g.setTransform(sc, 0, 0, sc, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      // ---- Himmel
      const coverEff = U.clamp(U.smoothstep(0.42, 0.95, P.cover) * 0.92 + P.rain * 0.3 + P.snow * 0.2, 0, 1);
      let cols = mix3(mix3(SKY.nightClear, SKY.dayClear, P.day), mix3(SKY.nightOver, SKY.dayOver, P.day), coverEff);
      cols = mix3(cols, SKY.dusk, P.dusk * (1 - coverEff * 0.65) * 0.9);
      cols = mix3(cols, SKY.storm, P.storm * 0.75);
      if (P.fog > 0.01) cols = mix3(cols, P.day > 0.5 ? ['#69717d', '#858d99', '#9aa2ad'] : ['#07080a', '#101216', '#1a1d22'], P.fog * 0.55);
      const sky = g.createLinearGradient(0, 0, 0, 1000);
      sky.addColorStop(0, cols[0]); sky.addColorStop(0.58, cols[1]); sky.addColorStop(1, cols[2]);
      g.fillStyle = sky;
      g.fillRect(0, 0, 1000, 1000);

      // ---- Sterne
      const starA = (1 - U.smoothstep(0.05, 0.38, P.day)) * (1 - U.smoothstep(0.3, 0.88, P.cover)) * (1 - P.fog) * (1 - P.rain * 0.8);
      if (starA > 0.01) {
        g.fillStyle = '#ffffff';
        for (const s of stars) {
          const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
          g.globalAlpha = starA * tw * (0.35 + s.s * 0.3);
          g.beginPath(); g.arc(s.x, s.y, s.s, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
      }

      // ---- Sonne mit Strahlen
      const sunVis = U.smoothstep(0.02, 0.4, P.day) * (1 - P.cover * 0.62) * (1 - P.fog * 0.6) * (1 - P.rain * 0.7);
      if (sunVis > 0.01) {
        const sp0 = V.display.pt(P.sunA, 338);
        const sx = sp0.x, sy = sp0.y;
        const warm = U.clamp(P.dusk, 0, 1);
        const core = U.mix('#FFF7DE', '#FFC27A', warm);
        g.globalCompositeOperation = 'lighter';
        const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 330);
        glow.addColorStop(0, U.rgba(U.mix('#FFE8B0', '#FF9E5E', warm), 0.55 * sunVis));
        glow.addColorStop(0.25, U.rgba(U.mix('#FFD27A', '#FF7E4A', warm), 0.2 * sunVis));
        glow.addColorStop(1, 'rgba(255,200,120,0)');
        g.fillStyle = glow;
        g.fillRect(sx - 330, sy - 330, 660, 660);
        // Strahlen: lange, feine Keile, die sich langsam drehen
        const rays = 14;
        g.fillStyle = U.rgba(U.mix('#FFF0C8', '#FFB070', warm), 0.07 * sunVis * (1 - P.cover * 0.5));
        for (let i = 0; i < rays; i++) {
          const a = t * 0.035 + (i / rays) * TAU + Math.sin(t * 0.2 + i) * 0.03;
          const len = 470 + 90 * Math.sin(t * 0.3 + i * 1.7);
          const wdt = 0.045 + 0.025 * Math.sin(i * 2.3);
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx + Math.cos(a - wdt) * len, sy + Math.sin(a - wdt) * len);
          g.lineTo(sx + Math.cos(a + wdt) * len, sy + Math.sin(a + wdt) * len);
          g.closePath();
          g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = U.clamp(sunVis * 1.3, 0, 1);
        const disc = g.createRadialGradient(sx, sy, 0, sx, sy, 40);
        disc.addColorStop(0, '#FFFFFF'); disc.addColorStop(0.55, core); disc.addColorStop(1, U.rgba(core, 0));
        g.fillStyle = disc;
        g.beginPath(); g.arc(sx, sy, 40, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }

      // ---- Mond in seiner Phase
      const moonVis = (1 - U.smoothstep(0.1, 0.5, P.day)) * (1 - P.cover * 0.75) * (1 - P.fog * 0.7) * (1 - P.rain * 0.8);
      if (moonVis > 0.01) {
        const mp0 = V.display.pt(P.moonA, 338);
        const mx = mp0.x, my = mp0.y, mr = 28;
        g.globalCompositeOperation = 'lighter';
        const mg = g.createRadialGradient(mx, my, 10, mx, my, 210);
        mg.addColorStop(0, `rgba(200,215,255,${0.22 * moonVis})`); mg.addColorStop(1, 'rgba(200,215,255,0)');
        g.fillStyle = mg; g.fillRect(mx - 210, my - 210, 420, 420);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = moonVis;
        g.fillStyle = 'rgba(190,200,225,.10)';
        g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
        const p = P.phase, k = Math.cos(p * TAU), rx = Math.abs(k) * mr;
        g.fillStyle = '#F2EFE6';
        g.beginPath();
        if (p < 0.5) { g.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, false); g.ellipse(mx, my, rx, mr, 0, Math.PI / 2, k > 0 ? -Math.PI / 2 : Math.PI * 1.5, k > 0); }
        else { g.arc(mx, my, mr, Math.PI / 2, Math.PI * 1.5, false); g.ellipse(mx, my, rx, mr, 0, k > 0 ? Math.PI * 1.5 : -Math.PI / 2, Math.PI / 2, k > 0); }
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
      }

      // ---- Wolken
      const sp = getSprites();
      const dark = U.clamp(1 - P.day * 0.9 + P.rain * 0.45 + P.storm * 0.6 + P.snow * 0.1, 0, 1);
      const nightDim = U.lerp(0.55, 1, P.day);
      for (const c of clouds) {
        const want = U.smoothstep(c.th - 0.06, c.th + 0.08, P.cover * 1.05);
        c.vis += (want - c.vis) * (1 - Math.exp(-dt * 1.4));
        c.x += c.v * (0.35 + P.wind * 1.7) * dt;
        const w = 420 * c.k, h = w * 0.55;
        if (c.x > 1000 + 40) { c.x = -w - 40 - Math.random() * 200; }
        if (c.vis < 0.01) continue;
        const a = c.vis * (0.55 + c.layer * 0.2) * nightDim * (1 - 0.35 * U.clamp((P.cover - 0.75) * 4, 0, 1) - 0.3 * P.fog);
        const bob = Math.sin(t * 0.15 + c.th * 20) * 6;
        if (dark < 0.99) { g.globalAlpha = a * (1 - dark); g.drawImage(sp.light[c.sp], c.x, c.y + bob, w, h); }
        if (dark > 0.01) { g.globalAlpha = a * dark; g.drawImage(sp.dark[c.sp], c.x, c.y + bob, w, h); }
      }
      g.globalAlpha = 1;
      // geschlossene Wolkendecke
      const deck = U.clamp((P.cover - 0.7) * 2.6, 0, 1) * 0.75;
      if (deck > 0.01) {
        const dc = U.mix(U.mix('#15181d', '#6E7886', P.day), '#262b31', P.storm * 0.8 + P.rain * 0.3);
        const lg = g.createLinearGradient(0, 0, 0, 760);
        lg.addColorStop(0, U.rgba(dc, deck)); lg.addColorStop(0.6, U.rgba(dc, deck * 0.55)); lg.addColorStop(1, U.rgba(dc, 0));
        g.fillStyle = lg; g.fillRect(0, 0, 1000, 760);
      }

      // ---- Nebelbänder
      if (P.fog > 0.01) {
        const fc = P.day > 0.45 ? [178, 186, 197] : [70, 75, 84];
        g.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},${0.12 * P.fog})`;
        g.fillRect(0, 0, 1000, 1000);
        for (const b of fogs) {
          b.x += b.v * dt;
          if (b.x > 1400) b.x = -400; if (b.x < -400) b.x = 1400;
          g.save();
          g.translate(b.x, b.y + Math.sin(t * 0.2 + b.w) * 10);
          g.scale(b.w / 120, 1);
          const fg = g.createRadialGradient(0, 0, 0, 0, 0, 120);
          fg.addColorStop(0, `rgba(${fc[0]},${fc[1]},${fc[2]},${0.42 * P.fog * b.a})`);
          fg.addColorStop(1, `rgba(${fc[0]},${fc[1]},${fc[2]},0)`);
          g.fillStyle = fg;
          g.fillRect(-120, -120, 240, 240);
          g.restore();
        }
      }

      // ---- Regen
      const nr = Math.round(U.clamp(P.rain, 0, 1) * drops.length);
      if (nr > 0) {
        const slant = 0.06 + (P.wind - 0.25) * 0.35;
        const col = P.day > 0.4 ? '205,222,255' : '150,170,210';
        for (let b = 0; b < 3; b++) {
          g.beginPath();
          for (let i = b; i < nr; i += 3) {
            const d = drops[i];
            const v = 1050 + 950 * d.z;
            d.y += v * dt; d.x += v * slant * dt;
            if (d.y > 1040) { d.y = -60 - Math.random() * 120; d.x = Math.random() * 1100 - 100 - slant * 300; }
            const l = d.l * (0.6 + d.z);
            g.moveTo(d.x, d.y); g.lineTo(d.x - slant * l, d.y - l);
          }
          g.strokeStyle = `rgba(${col},${(0.16 + b * 0.13) * U.clamp(P.rain * 1.6, 0.35, 1)})`;
          g.lineWidth = 1.3 + b * 0.8;
          g.lineCap = 'round';
          g.stroke();
        }
      }
      // ---- Schnee
      const ns = Math.round(U.clamp(P.snow, 0, 1) * flakes.length);
      if (ns > 0) {
        for (let b = 0; b < 3; b++) {
          g.beginPath();
          for (let i = b; i < ns; i += 3) {
            const f = flakes[i];
            f.y += (40 + 95 * f.z) * dt;
            f.x += (Math.sin(t * 1.1 + f.ph) * 18 * f.z + P.wind * 30) * dt;
            if (f.y > 1020) { f.y = -20; f.x = Math.random() * 1000; }
            if (f.x > 1020) f.x = -20;
            const rr = 1.6 + 3.6 * f.z;
            g.moveTo(f.x + rr, f.y); g.arc(f.x, f.y, rr, 0, TAU);
          }
          g.fillStyle = `rgba(255,255,255,${0.35 + b * 0.25})`;
          g.fill();
        }
      }
      // ---- Gewitter
      if (P.storm > 0.5) { nextStrike -= dt; if (nextStrike <= 0) { strike(); nextStrike = 2.4 + Math.random() * 5.5; } }
      if (flash > 0.005) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(190,205,255,${flash * 0.38})`;
        g.fillRect(0, 0, 1000, 1000);
        g.globalCompositeOperation = 'source-over';
        flash *= Math.exp(-dt * 7);
      }
      if (bolt && boltT > 0) {
        const a = U.clamp(boltT / 0.32, 0, 1);
        g.lineJoin = 'round'; g.lineCap = 'round';
        for (const [path, wd] of [[bolt.pts, 1], [bolt.br, 0.55]]) {
          if (path.length < 2) continue;
          g.beginPath(); g.moveTo(path[0][0], path[0][1]);
          for (const q of path) g.lineTo(q[0], q[1]);
          g.strokeStyle = `rgba(170,190,255,${0.35 * a})`; g.lineWidth = 16 * wd; g.stroke();
          g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 3.4 * wd; g.stroke();
        }
        boltT -= dt;
      }

      // ---- Randabdunklung (OLED-Rand, ruhige Bühne für Kurve und Text)
      if (!vignette) {
        vignette = g.createRadialGradient(500, 500, 230, 500, 500, 505);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(0.5, 'rgba(0,0,0,.1)');
        vignette.addColorStop(0.74, 'rgba(0,0,0,.4)');
        vignette.addColorStop(1, 'rgba(0,0,0,.88)');
      }
      g.fillStyle = vignette;
      g.fillRect(0, 0, 1000, 1000);
      // helle, graue Lagen (Nebel, Schnee, Wolkendecke am Tag): Mitte für die Schrift leicht abdunkeln
      const bright = P.day * U.clamp(P.cover * 0.45 + P.fog * 0.6 + P.snow * 0.4, 0, 1);
      if (bright > 0.05) {
        const sg = g.createRadialGradient(500, 480, 40, 500, 480, 360);
        sg.addColorStop(0, `rgba(0,0,0,${(0.3 * bright).toFixed(3)})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sg; g.fillRect(0, 0, 1000, 1000);
      }
    }

    return { g, P, resize, setTarget, step, draw };
  }

  /* ============================================================ Sprache */
  const WD = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  /** Tagesversatz aus einer Frage: heute 0, morgen 1, „am Samstag“ … (null = nicht genannt) */
  function parseDay(t) {
    const now = V.time.now();
    if (/(?<![a-zäöüß])übermorgen(?![a-zäöüß])/.test(t)) return 2;
    if (/(?<![a-zäöüß])morgen(?![a-zäöüß])/.test(t) && !/(heute|gestern) morgen/.test(t)) return 1;
    const m = t.match(/in (\d) tagen/);
    if (m) return U.clamp(+m[1], 0, 6);
    if (/sonnabend/.test(t)) return (6 - now.getDay() + 7) % 7;
    for (let i = 0; i < 7; i++) if (new RegExp('(?<![a-zäöüß])' + WD[i] + 's?(?![a-zäöüß])').test(t)) return (i - now.getDay() + 7) % 7;
    if (/wochenende/.test(t)) { const d = now.getDay(); return d === 6 || d === 0 ? 0 : 6 - d; }
    if (/(?<![a-zäöüß])(heute|jetzt|gerade|aktuell|draußen)(?![a-zäöüß])/.test(t)) return 0;
    return null;
  }
  function dayWord(off, cap) {
    if (off === 0) return cap ? 'Heute' : 'heute';
    if (off === 1) return cap ? 'Morgen' : 'morgen';
    if (off === 2) return cap ? 'Übermorgen' : 'übermorgen';
    const d = addDays(midnight(V.time.now()), off);
    return (cap ? 'Am ' : 'am ') + V.fmt.WD[d.getDay()];
  }
  function cityFromText(t) {
    for (const c of CITIES) {
      const names = [keyOf(c.name), c.id, c.name.toLowerCase()];
      for (const [a, id] of Object.entries(ALIAS)) if (id === c.id) names.push(a);
      for (const n of names) if (new RegExp('(?<![a-zäöüß])' + n + '(?![a-zäöüß])').test(t)) return c;
    }
    return null;
  }
  /** erste Stunde (Index) mit Niederschlag ab Index i0 */
  function firstWet(hrs, i0 = 0, minP = 0.45) { for (let i = i0; i < hrs.length; i++) if (WET[hrs[i].code] || hrs[i].precip >= minP) return i; return -1; }
  function firstDry(hrs, i0 = 0) { for (let i = i0; i < hrs.length; i++) if (!WET[hrs[i].code]) return i; return -1; }
  const hourWord = (r) => r.hour + ' Uhr';
  function emotionFor(code, temp) {
    if (temp !== undefined && (temp >= 29 || temp <= -4)) return 'surprised';
    if (code === 'storm' || code === 'heavy' || code === 'rain' || code === 'showers' || code === 'drizzle' || code === 'sleet') return 'sad';
    if (code === 'snow') return 'surprised';
    if (code === 'fog') return 'confused';
    if (code === 'clear' || code === 'fair' || code === 'partly') return 'happy';
    if (code === 'overcast' || code === 'cloudy') return 'sleepy';
    return 'thinking';
  }

  /** Karte für Visto: Symbol, große Temperatur, Zustand und Höchst/Tiefst */
  function wxCard(o) {
    V.css('wx-card', `
      .wx-card { display:flex; align-items:center; gap:2.8cqw; }
      .wx-card .g { width:13cqw; height:13cqw; flex:none; filter:drop-shadow(0 .6cqw 1.6cqw rgba(0,0,0,.4)); }
      .wx-card .g svg { width:100%; height:100%; display:block; }
      .wx-card .t { font-size:14cqw; font-weight:200; letter-spacing:-.045em; line-height:1; font-variant-numeric:tabular-nums; }
      .wx-card .c { display:flex; flex-direction:column; gap:.8cqw; text-align:left; }
      .wx-card .c b { font-size:4.4cqw; font-weight:620; letter-spacing:-.01em; white-space:nowrap; }
      .wx-card .c span { font-size:3.1cqw; font-weight:600; color:rgba(255,255,255,.55); white-space:nowrap; font-variant-numeric:tabular-nums; }
    `);
    const el = U.el('div', { class: 'wx-card' },
      U.el('div', { class: 'g', html: glyph(o.code, o.night) }),
      U.el('div', { class: 't', text: o.big }),
      U.el('div', { class: 'c' }, U.el('b', { text: o.title }), o.sub ? U.el('span', { text: o.sub }) : null));
    return { type: 'el', el };
  }

  function sayCurrent(c) {
    const w = current(c.id);
    const hrs = hourly(14, c.id);
    let tail = `Heute höchstens ${Math.round(w.hi)} Grad.`;
    if (WET[w.code]) {
      const i = firstDry(hrs, 1);
      tail = i > 0 ? `Gegen ${hourWord(hrs[i])} wird es trockener.` : 'Das bleibt auch noch eine Weile so.';
    } else {
      const i = firstWet(hrs, 1);
      if (i > 0) tail = `Ab etwa ${hourWord(hrs[i])} ${hrs[i].code === 'snow' ? 'schneit' : hrs[i].code === 'storm' ? 'gewittert' : 'regnet'} es.`;
    }
    return {
      say: `In ${c.name} sind es gerade ${Math.round(w.temp)} Grad${describe(w.code).wet ? ' und ' : ', '}${describe(w.code, w.night).say}. ${tail}`,
      card: wxCard({ code: w.code, night: w.night, big: deg(w.temp), title: w.text, sub: `H ${deg(w.hi)}  T ${deg(w.lo)} · ${c.name}` }),
      emotion: emotionFor(w.code, w.temp),
    };
  }
  function sayDay(c, off) {
    if (off === 0) {
      const d = dayRec(c, midnight(V.time.now()));
      const w = current(c.id);
      const later = d.precip >= 0.45 && !WET[d.code] ? ` Regenrisiko ${Math.round(d.precip * 10) * 10} Prozent.` : '';
      return {
        say: `Heute in ${c.name}: ${describe(d.code).fc}, ${Math.round(d.lo)} bis ${Math.round(d.hi)} Grad. Gerade sind es ${Math.round(w.temp)} Grad.${later}`,
        card: wxCard({ code: d.code, big: deg(d.hi), title: d.text, sub: `H ${deg(d.hi)}  T ${deg(d.lo)} · Heute` }),
        emotion: emotionFor(d.code, d.hi),
      };
    }
    const d = dayRec(c, addDays(midnight(V.time.now()), off));
    const dsc = describe(d.code);
    const rain = d.precip >= 0.45 && !WET[d.code] ? ` Regenrisiko ${Math.round(d.precip * 10) * 10} Prozent.` : '';
    const label = dayWord(off, true);
    return {
      say: `${label} in ${c.name}: ${dsc.fc} bei ${Math.round(d.lo)} bis ${Math.round(d.hi)} Grad.${rain}`,
      card: wxCard({ code: d.code, big: deg(d.hi), title: d.text, sub: `H ${deg(d.hi)}  T ${deg(d.lo)} · ${off === 1 ? 'Morgen' : V.fmt.WD[d.date.getDay()]}` }),
      emotion: emotionFor(d.code, d.hi),
    };
  }
  /** „Gibt es Gewitter?“ / „Wird es sonnig?“ */
  function saySky(c, off, kind) {
    const now = V.time.now();
    const hrs = off ? dayRec(c, addDays(midnight(now), off)).hours.slice(7, 21) : hourly(Math.max(4, 22 - now.getHours()), c.id);
    const label = dayWord(off, false), Label = dayWord(off, true);
    const d = dayRec(c, addDays(midnight(now), off));
    if (kind === 'storm') {
      const r = hrs.find((h) => h.code === 'storm');
      return r
        ? { say: `Ja, ${label} gegen ${hourWord(r)} kann es gewittern. Achte auf Blitz und Donner.`, card: wxCard({ code: 'storm', big: deg(r.temp), title: 'Gewitter ab ' + hourWord(r), sub: `${c.name} · ${Label.replace(/^Am /, '')}` }), emotion: 'surprised' }
        : { say: `Nein, Gewitter sind ${label} nicht in Sicht.`, card: wxCard({ code: d.code, big: deg(d.hi), title: d.text, sub: `Kein Gewitter · ${c.name}` }), emotion: 'happy' };
    }
    const day = hrs.filter((h) => !h.night);
    const sunny = day.filter((h) => h.code === 'clear' || h.code === 'fair').length;
    const part = day.filter((h) => h.code === 'partly').length;
    const share = day.length ? (sunny + part * 0.5) / day.length : 0;
    let say;
    if (!day.length) say = 'Heute zeigt sich die Sonne nicht mehr – es ist schon dunkel.';
    else if (share > 0.6) say = `Ja, ${label} scheint oft die Sonne, bis ${Math.round(d.hi)} Grad.`;
    else if (share > 0.25) say = `Teilweise: ${label} wechseln sich Sonne und Wolken ab.`;
    else say = `Eher nicht, ${label} bleibt es meist ${WET[d.code] ? 'nass' : 'grau'}.`;
    return { say, card: wxCard({ code: d.code, big: deg(d.hi), title: d.text, sub: `H ${deg(d.hi)}  T ${deg(d.lo)} · ${Label.replace(/^Am /, '')}` }), emotion: share > 0.6 ? 'happy' : share > 0.25 ? 'wink' : 'sleepy' };
  }
  function sayWeekend(c) {
    const now = V.time.now(), wd = now.getDay();
    const sat = wd === 0 ? -1 : (6 - wd + 7) % 7;
    const parts = [];
    let first = null;
    for (const off of [sat, sat + 1]) {
      if (off < 0 || off > 6) continue;
      const d = dayRec(c, addDays(midnight(now), off));
      first = first || { d, off };
      parts.push(`${V.fmt.WD[d.date.getDay()]} ${describe(d.code).fc} bei ${Math.round(d.lo)} bis ${Math.round(d.hi)} Grad`);
    }
    const d = first.d;
    return {
      say: `Am Wochenende in ${c.name}: ${parts.join(', ')}.`,
      card: wxCard({ code: d.code, big: deg(d.hi), title: d.text, sub: `H ${deg(d.hi)}  T ${deg(d.lo)} · ${V.fmt.WD[d.date.getDay()]}` }),
      emotion: emotionFor(d.code, d.hi),
    };
  }
  /** Regnet es / Schirm / Schnee – Blick auf den Rest des Tages bzw. den genannten Tag */
  function sayPrecip(c, off, kind) {
    const now = V.time.now();
    let hrs, label;
    if (!off) {
      const left = Math.max(6, 24 - now.getHours());
      hrs = hourly(Math.min(left, 15), c.id);
      label = 'heute';
    } else {
      hrs = dayRec(c, addDays(midnight(now), off)).hours.slice(7, 22);
      label = dayWord(off, false);
    }
    const nowWet = !off && WET[hrs[0].code];
    const i = firstWet(hrs, 0, 0.5);
    const maxP = Math.max(...hrs.map((r) => r.precip));
    const r = i >= 0 ? hrs[i] : null;
    const snow = r && (r.code === 'snow' || r.code === 'sleet');
    const what = r ? (r.code === 'storm' ? 'Gewitter' : snow ? (r.code === 'snow' ? 'Schnee' : 'Schneeregen') : 'Regen') : '';
    const pct = Math.round(maxP * 10) * 10;
    let say, yes = !!r;
    if (kind === 'umbrella') {
      if (nowWet) say = snow ? 'Eher Mütze als Schirm – es schneit gerade.' : 'Ja, unbedingt. Es regnet gerade.';
      else if (r) say = snow ? `Eher Mütze als Schirm: ${label === 'heute' ? 'ab etwa ' + hourWord(r) : label} kommt ${what}.` : `Ja, nimm lieber einen Schirm mit. ${label === 'heute' ? 'Ab etwa ' + hourWord(r) : label.charAt(0).toUpperCase() + label.slice(1) + ' ab ' + hourWord(r)} kommt ${what}.`;
      else if (maxP >= 0.25) { say = `Eher nicht. Das Regenrisiko liegt ${label} bei höchstens ${pct} Prozent.`; yes = false; }
      else say = `Nein, ${label} bleibt es trocken. Der Schirm darf zu Hause bleiben.`;
    } else if (kind === 'snow') {
      const sn = hrs.find((h) => h.code === 'snow' || h.code === 'sleet');
      yes = !!sn;
      say = sn ? `Ja, ${label === 'heute' ? 'ab etwa ' + hourWord(sn) : label + ' ab ' + hourWord(sn)} ${sn.code === 'snow' ? 'schneit es' : 'gibt es Schneeregen'}.` : `Nein, Schnee ist ${label} nicht in Sicht.`;
    } else {
      if (nowWet) {
        const j = firstDry(hrs, 1);
        say = j > 0 ? `Ja, gerade ${hrs[0].code === 'snow' ? 'schneit' : 'regnet'} es. Gegen ${hourWord(hrs[j])} wird es trockener.` : `Ja, und es ${hrs[0].code === 'snow' ? 'schneit' : 'regnet'} noch eine ganze Weile.`;
      } else if (r) say = `Ja, ${label === 'heute' ? 'ab etwa ' + hourWord(r) : label + ' ab etwa ' + hourWord(r)} ist mit ${what} zu rechnen.`;
      else if (maxP >= 0.25) say = `Wahrscheinlich nicht. Das Regenrisiko liegt bei ${pct} Prozent.`;
      else say = `Nein, ${label} bleibt es trocken.`;
    }
    const code = r ? (WET[r.code] ? r.code : 'rain') : nowWet ? hrs[0].code : (off ? dayRec(c, addDays(midnight(now), off)).code : hrs[0].code);
    const night = !off && hrs[0].night && !r;
    let card;
    if (kind === 'umbrella') {
      card = { type: 'icon', icon: yes || nowWet ? (snow ? 'snow' : 'rain') : 'sun', color: yes || nowWet ? '#3D8BFF' : '#FFB020', title: yes || nowWet ? (snow ? 'Mütze statt Schirm' : 'Schirm mitnehmen') : 'Kein Schirm nötig', sub: r ? `${what} ab ${hourWord(r)} · ${Math.round(r.precip * 10) * 10} %` : `Regenrisiko ${pct} % · ${c.name}` };
    } else {
      card = wxCard({ code, night, big: pct + '%', title: r ? `${what} ab ${hourWord(r)}` : nowWet ? hrs[0].text : 'Trocken', sub: `Regenrisiko · ${label.charAt(0).toUpperCase() + label.slice(1)}` });
    }
    return { say, card, emotion: yes || nowWet ? (kind === 'umbrella' ? 'wink' : snow ? 'surprised' : 'sad') : 'happy' };
  }
  function sayTemp(c, off) {
    if (!off) {
      const w = current(c.id);
      const fe = Math.round(w.feels) !== Math.round(w.temp) ? `, gefühlt ${Math.round(w.feels)} Grad` : '';
      const extra = w.temp < 3 ? ' Zieh dich warm an.' : w.temp > 27 ? ' Viel trinken nicht vergessen.' : '';
      return {
        say: `In ${c.name} sind es gerade ${Math.round(w.temp)} Grad${fe}.${extra}`,
        card: { type: 'big', text: deg(w.temp), sub: `Gefühlt ${deg(w.feels)} · ${c.name}` },
        emotion: w.temp < 3 ? 'surprised' : w.temp > 27 ? 'surprised' : 'happy',
      };
    }
    const d = dayRec(c, addDays(midnight(V.time.now()), off));
    return {
      say: `${dayWord(off, true)} werden es in ${c.name} höchstens ${Math.round(d.hi)} Grad, nachts ${Math.round(d.lo)} Grad.`,
      card: wxCard({ code: d.code, big: deg(d.hi), title: d.text, sub: `H ${deg(d.hi)}  T ${deg(d.lo)} · ${dayWord(off, true).replace(/^Am /, '')}` }),
      emotion: d.hi < 3 || d.hi > 28 ? 'surprised' : 'happy',
    };
  }
  function saySun(c, off, t) {
    const d = addDays(midnight(V.time.now()), off || 0);
    const s = sunTimes(c, d);
    const rise = /auf|aufgang|hell/.test(t) && !/unter|untergang|dunkel/.test(t);
    const h = rise ? s.rise : s.set;
    return {
      say: `Die Sonne geht ${dayWord(off || 0, false)} um ${fmtH(h)} Uhr ${rise ? 'auf' : 'unter'}.`,
      card: { type: 'icon', icon: 'sunrise', color: rise ? '#FFB020' : '#FF7A45', title: fmtH(h) + ' Uhr', sub: (rise ? 'Sonnenaufgang' : 'Sonnenuntergang') + ' · ' + c.name },
      emotion: 'happy',
    };
  }

  /* ================================================================ App */
  V.css('wx', `
    .wx-cv { position:absolute; inset:0; width:100%; height:100%; display:block; }
    .wx-lay { position:absolute; inset:0; pointer-events:none; }
    .wx-lay button { pointer-events:auto; }
    .wx-sh { text-shadow: 0 0 3cqw rgba(0,0,0,.28), 0 .2cqw .6cqw rgba(0,0,0,.18); }
    .wx-place { position:absolute; left:50%; top:22.6cqw; transform:translateX(-50%); display:flex; align-items:center; gap:1.3cqw;
      height:11cqw; padding:0 4cqw; border:0; border-radius:99cqw; background:transparent; color:rgba(255,255,255,.9); cursor:pointer;
      font:700 3cqw/1 var(--font); letter-spacing:.2em; text-transform:uppercase; white-space:nowrap; transition:transform .3s var(--spring), background .2s; }
    .wx-place:active { transform:translateX(-50%) scale(.93); background:rgba(255,255,255,.1); }
    .wx-place svg { width:3.1cqw; height:3.1cqw; opacity:.85; }
    .wx-temp { position:absolute; left:0; right:0; top:30.5cqw; display:flex; justify-content:center; align-items:flex-start;
      font-size:25cqw; font-weight:180; letter-spacing:-.04em; line-height:1; font-variant-numeric:tabular-nums; }
    .wx-temp .dg { width:.34em; text-align:left; font-weight:160; }
    .wx-temp .num { display:flex; margin-left:.34em; }
    .wx-cond { position:absolute; left:15%; right:15%; top:56.6cqw; text-align:center; font-size:5cqw; font-weight:560; letter-spacing:-.012em; white-space:nowrap; }
    .wx-hilo { position:absolute; left:15%; right:15%; top:63cqw; text-align:center; font-size:3.7cqw; font-weight:600; color:rgba(255,255,255,.85);
      font-variant-numeric:tabular-nums; white-space:nowrap; }
    .wx-hilo i { font-style:normal; color:rgba(255,255,255,.5); font-weight:650; margin-right:1cqw; }
    .wx-note { position:absolute; left:28%; right:28%; top:68.4cqw; text-align:center; font-size:3cqw; font-weight:560; color:rgba(255,255,255,.62); line-height:1.25; }
    .wx-more { position:absolute; left:50%; top:74.6cqw; transform:translateX(-50%); height:11cqw; padding:0 4.2cqw; border:0; border-radius:99cqw;
      display:flex; align-items:center; gap:1.2cqw; cursor:pointer; background:rgba(255,255,255,.1); color:rgba(255,255,255,.88);
      font:700 2.7cqw/1 var(--font); letter-spacing:.18em; -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); transition:transform .3s var(--spring), background .2s; }
    .wx-more:active { transform:translateX(-50%) scale(.92); background:rgba(255,255,255,.18); }
    .wx-more svg { width:3.4cqw; height:3.4cqw; }
    .wx-mk { position:absolute; width:12cqw; height:14cqw; margin:-7cqw 0 0 -6cqw; border:0; padding:0; background:transparent; color:#fff; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.3cqw; border-radius:6cqw; transition:background .2s; }
    .wx-mk:active { background:rgba(255,255,255,.1); }
    .wx-mk.on { background:rgba(255,255,255,.14); }
    .wx-mk small { font-size:2.35cqw; font-weight:700; color:rgba(255,255,255,.55); letter-spacing:.04em; font-variant-numeric:tabular-nums; }
    .wx-mk .g { width:6cqw; height:6cqw; }
    .wx-mk .g svg, .wx-du .g svg, .wx-dc .g svg { width:100%; height:100%; display:block; filter:drop-shadow(0 .4cqw 1cqw rgba(0,0,0,.35)); }
    .wx-mk b { font-size:3.1cqw; font-weight:640; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
    .wx-du { position:absolute; display:flex; flex-direction:column; align-items:center; gap:.5cqw; transform:translate(-50%,-50%); }
    .wx-du .g { width:6.8cqw; height:6.8cqw; }
    .wx-du .t { white-space:nowrap; font-size:3.15cqw; font-weight:650; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
    .wx-du .t i { font-style:normal; color:rgba(255,255,255,.48); margin-left:1.1cqw; font-weight:600; }
    .wx-dc { position:absolute; inset:0; }
    .wx-dc .wd { position:absolute; left:0; right:0; top:25.6cqw; text-align:center; font-size:5.6cqw; font-weight:620; letter-spacing:-.015em; }
    .wx-dc .dt { position:absolute; left:0; right:0; top:32.4cqw; text-align:center; }
    .wx-dc .g { position:absolute; left:50%; top:36.4cqw; width:12cqw; height:12cqw; margin-left:-6cqw; }
    .wx-dc .tt { position:absolute; left:0; right:0; top:49cqw; text-align:center; font-size:11cqw; font-weight:200; letter-spacing:-.04em; line-height:1; font-variant-numeric:tabular-nums; }
    .wx-dc .tt i { font-style:normal; color:rgba(255,255,255,.45); font-size:.62em; letter-spacing:-.02em; }
    .wx-dc .cd { position:absolute; left:15%; right:15%; top:61.6cqw; text-align:center; font-size:4.4cqw; font-weight:580; white-space:nowrap; }
    .wx-dc .dl { position:absolute; left:0; right:0; top:67cqw; display:flex; justify-content:center; gap:3cqw; font-size:3.1cqw; font-weight:620;
      color:rgba(255,255,255,.72); font-variant-numeric:tabular-nums; }
    .wx-dc .dl span { display:inline-flex; align-items:center; gap:1cqw; }
    .wx-dc .dl svg { width:3.4cqw; height:3.4cqw; opacity:.8; }
  `);

  const SPAN0 = 210, SPAN = 300;                 // Bogen: 210° (links unten) über oben bis 150° (rechts unten)
  const angK = (k) => SPAN0 + (k / 24) * SPAN;   // Stunde ab jetzt → Uhrwinkel
  const R_LO = 398, R_HI = 456;
  const hasConic = typeof CanvasRenderingContext2D !== 'undefined' && 'createConicGradient' in CanvasRenderingContext2D.prototype;
  const crad = (a) => U.rad(a - 90);

  function create(ctx) {
    const root = ctx.root;
    let city = (ctx.params && findCity(ctx.params.city)) || home();
    let view = 'now', sel = 0, preview = null, previewT = 0;
    let data = null;       // {cur, hrs, days, curve}
    let crownAcc = 0;

    // ---- Leinwand
    const cv = U.el('canvas', { class: 'wx-cv' });
    root.appendChild(cv);
    const sky = makeSky(cv);
    const g = sky.g;
    ctx.on('display:resize', () => { sky.resize(); grads = null; });

    // ---- Ebene „Jetzt“
    const nowL = U.el('div', { class: 'wx-lay' });
    const placeB = U.el('button', { class: 'wx-place wx-sh', attrs: { type: 'button', 'aria-label': 'Ort wechseln' } });
    const tempEl = U.el('div', { class: 'wx-temp wx-sh' });
    const numEl = U.el('div', { class: 'num' });
    tempEl.append(numEl, U.el('span', { class: 'dg', text: '°' }));
    const condEl = U.el('div', { class: 'wx-cond wx-sh' });
    const hiloEl = U.el('div', { class: 'wx-hilo wx-sh' });
    const noteEl = U.el('div', { class: 'wx-note wx-sh' });
    const moreB = U.el('button', { class: 'wx-more', attrs: { type: 'button', 'aria-label': '7-Tage-Vorhersage' }, html: V.icon('up') + '<span>7 TAGE</span>' });
    const mkL = U.el('div', { class: 'wx-lay' });
    nowL.append(placeB, tempEl, condEl, hiloEl, noteEl, moreB);
    const digits = V.faces.rollDigits(numEl, { digitW: '0.56em', colonW: '0.3em' });

    // ---- Ebene „7 Tage“
    const daysL = U.el('div', { class: 'wx-lay', style: { opacity: 0, visibility: 'hidden' } });
    const daySvg = U.svg('svg', { class: 'vos-svg', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
    const dayItems = U.el('div', { class: 'wx-lay' });
    const dc = U.el('div', { class: 'wx-dc wx-sh' });
    const dcWd = U.el('div', { class: 'wd' }), dcDt = U.el('div', { class: 'dt vos-label', style: { color: 'rgba(255,255,255,.6)' } });
    const dcG = U.el('div', { class: 'g' }), dcTt = U.el('div', { class: 'tt' }), dcCd = U.el('div', { class: 'cd' }), dcDl = U.el('div', { class: 'dl' });
    dc.append(dcWd, dcDt, dcG, dcTt, dcCd, dcDl);
    const backB = U.el('button', { class: 'wx-more', attrs: { type: 'button', 'aria-label': 'Zurück zu jetzt' }, html: V.icon('down') + '<span>JETZT</span>' });
    daysL.append(daySvg, dayItems, dc, backB);
    root.append(mkL, nowL, daysL);

    // ---- Federn
    const viewS = V.spring(0, { response: 0.55, bounce: 0.08 });
    const revealS = V.spring(0, { response: 1.1, bounce: 0 });
    const selS = V.spring(0, { response: 0.42, bounce: 0.14 });
    const swapS = V.spring(1, { response: 0.5, bounce: 0.1 });
    viewS.onUpdate(applyView);
    swapS.onUpdate((v) => {
      const k = U.clamp(v, 0, 1.2);
      for (const el of [condEl, hiloEl, noteEl]) { el.style.opacity = U.clamp(k * 1.4 - 0.3, 0, 1).toFixed(3); el.style.transform = `translateY(${((1 - k) * 2.4).toFixed(2)}cqw)`; }
      placeB.style.opacity = U.clamp(k * 1.5 - 0.2, 0, 1).toFixed(3);
    });

    /* ---------------------------------------------------- Daten */
    function load() {
      const now = V.time.now();
      const cur = current(city.id);
      const hrs = hourly(28, city.id, new Date(now.getTime() - HOUR));
      const days = daily(7, city.id);
      data = { cur, hrs, days, t0: now.getTime(), curve: buildCurve(hrs, now) };
      grads = null;
    }
    function tempAt(hrs, tm) {
      const f = (tm - hrs[0].date.getTime()) / HOUR;
      const i = U.clamp(Math.floor(f), 0, hrs.length - 2), u = U.clamp(f - i, 0, 1);
      const p = (j) => hrs[U.clamp(j, 0, hrs.length - 1)].temp;
      const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
      return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
    function buildCurve(hrs, now) {
      const pts = [];
      let tmin = 99, tmax = -99;
      for (let q = 0; q <= 96; q++) {
        const k = q / 4, tm = now.getTime() + k * HOUR, dd = new Date(tm);
        const T = tempAt(hrs, tm);
        tmin = Math.min(tmin, T); tmax = Math.max(tmax, T);
        pts.push({ k, T, day: daylight(city, midnight(dd), hoursOf(dd)) });
      }
      let lo = tmin - 0.6, hi = tmax + 0.6;
      if (hi - lo < 6) { const m = (hi + lo) / 2; lo = m - 3; hi = m + 3; }
      for (const p of pts) p.r = R_LO + (R_HI - R_LO) * (p.T - lo) / (hi - lo);
      const marks = [];
      for (const r of hrs) {
        const k = (r.date.getTime() - now.getTime()) / HOUR;
        if (r.hour % 3 === 0 && k >= 1.2 && k <= 23.2) marks.push({ k, rec: r });
      }
      const rain = hrs.map((r) => ({ k: (r.date.getTime() - now.getTime()) / HOUR + 0.5, p: WET[r.code] ? Math.max(r.precip, 0.6) : r.precip })).filter((x) => x.p > 0.15 && x.k > 0 && x.k < 24);
      return { pts, marks, rain, lo, hi };
    }

    /* ---------------------------------------------------- Himmel-Ziel */
    function sceneFor(rec, date) {
      const d0 = midnight(date), h = hoursOf(date);
      const s = sunTimes(city, d0);
      const code = rec.code;
      const wetI = WET[code] ? 0.3 + 0.7 * Math.max(rec.rain, 0.2) : 0;
      const snowy = code === 'snow' ? 1 : code === 'sleet' ? 0.5 : 0;
      const nightLen = 24 - (s.set - s.rise);
      return {
        day: daylight(city, d0, h), dusk: duskOf(city, d0, h),
        cover: U.clamp(rec.cloud + (code === 'fog' ? 0.2 : 0), 0, 1),
        rain: code === 'snow' ? 0 : wetI * (code === 'sleet' ? 0.6 : 1) * (code === 'drizzle' ? 0.45 : 1),
        snow: snowy ? 0.35 + 0.65 * Math.max(rec.rain, 0.3) * snowy : 0,
        fog: code === 'fog' ? 0.95 : rec.humidity > 94 ? 0.2 : 0,
        storm: code === 'storm' ? 1 : 0,
        wind: U.clamp(rec.wind / 45, 0, 1),
        sunF: (h - s.rise) / (s.set - s.rise),
        moonF: U.wrap(h - s.set, 24) / nightLen,
        phase: moonPhase(date.getTime()),
      };
    }
    /** Gestirn in die nächste Lücke zwischen den Symbolen legen (natürlicher Winkel bleibt ungefähr erhalten) */
    function slot(a) {
      const gaps = [];
      if (view === 'days') for (let i = 0; i < 6; i++) gaps.push(SPAN0 + DW * (i + 1));
      else if (data) {
        const ms = data.curve.marks.map((m) => angK(m.k));
        for (let i = 0; i < ms.length - 1; i++) gaps.push((ms[i] + ms[i + 1]) / 2);
        if (ms.length && ms[0] - 18.75 > SPAN0 + 6) gaps.push(ms[0] - 18.75);
        if (ms.length && ms[ms.length - 1] + 18.75 < SPAN0 + SPAN - 6) gaps.push(ms[ms.length - 1] + 18.75);
      }
      if (!gaps.length) return a;
      return gaps.reduce((b, x) => (Math.abs(x - a) < Math.abs(b - a) ? x : b), gaps[0]);
    }
    function updateScene(instant) {
      if (!data) return;
      let sc;
      if (view === 'days' && sel > 0) {
        const d = data.days[sel];
        const rec = d.hours[13];
        sc = sceneFor(rec, rec.date);
      } else if (preview) sc = sceneFor(preview.rec, preview.rec.date);
      else sc = sceneFor(Object.assign({}, data.hrs[1], { code: data.cur.code, cloud: data.cur.cloud }), V.time.now());
      sc.sunA = slot(270 + 180 * U.clamp(sc.sunF, 0, 1));
      sc.moonA = slot(270 + 180 * U.clamp(sc.moonF, 0, 1));
      sky.setTarget(sc, instant || !sky.ready);
      sky.ready = true;
    }

    /* ---------------------------------------------------- Jetzt-Ansicht */
    function renderNow() {
      if (!data) return;
      const w = data.cur;
      const isHome = city.id === home().id;
      placeB.innerHTML = (isHome ? V.icon('location') : '') + `<span>${U.esc(preview ? 'Um ' + preview.rec.hour + ' Uhr' : city.name)}</span>`;
      if (preview) {
        const r = preview.rec;
        digits.set(Math.round(r.temp).toString().replace('-', '−'));
        condEl.textContent = r.text;
        hiloEl.innerHTML = `<i>REGEN</i>${Math.round(r.precip * 10) * 10} %  <span style="opacity:.4;margin:0 1.4cqw">·</span><i>WIND</i>${Math.round(r.wind)} km/h`;
        noteEl.textContent = 'Gefühlt ' + deg(r.feels);
      } else {
        digits.set(Math.round(w.temp).toString().replace('-', '−'));
        condEl.textContent = w.text;
        hiloEl.innerHTML = `<i>H</i>${deg(w.hi)}<span style="display:inline-block;width:3.4cqw"></span><i>T</i>${deg(w.lo)}`;
        noteEl.textContent = summary();
      }
      renderMarks();
    }
    function summary() {
      const hrs = data.hrs.slice(1, 16);
      const w = data.cur;
      if (WET[w.code]) {
        const j = firstDry(hrs, 1);
        return j > 0 ? `${w.text} bis etwa ${hrs[j].hour} Uhr.` : `${w.text} hält noch an.`;
      }
      const i = firstWet(hrs, 1, 0.5);
      if (i > 0) return `Ab etwa ${hrs[i].hour} Uhr ${hrs[i].text.replace('Regenschauer', 'Schauer')}.`;
      if (w.code === 'fog') { const j = hrs.findIndex((r, k) => k > 0 && r.code !== 'fog'); return j > 0 ? `Nebel lichtet sich gegen ${hrs[j].hour} Uhr.` : 'Der Nebel bleibt zäh.'; }
      const h = V.time.now().getHours();
      const tm = data.days[1];
      if (h >= 17 && tm) return `Morgen ${phrase(tm.code)}, bis ${deg(tm.hi)}.`;
      return 'Heute bleibt es trocken.';
    }
    const marks = [];
    function renderMarks() {
      const want = data.curve.marks;
      while (marks.length < want.length) {
        const b = U.el('button', { class: 'wx-mk wx-sh', attrs: { type: 'button' } });
        b.append(U.el('small'), U.el('div', { class: 'g' }), U.el('b'));
        V.ui.tap(b, () => { const m = b._m; if (!m) return; if (preview && preview.rec === m.rec) clearPreview(); else setPreview(m); });
        mkL.appendChild(b);
        marks.push(b);
      }
      marks.forEach((b, i) => {
        const m = want[i];
        b.style.display = m ? '' : 'none';
        if (!m) return;
        b._m = m;
        const p = V.display.pt(angK(m.k), 338);
        b.style.left = p.x / 10 + 'cqw'; b.style.top = p.y / 10 + 'cqw';
        b.setAttribute('aria-label', `${m.rec.hour} Uhr: ${m.rec.text}, ${Math.round(m.rec.temp)} Grad`);
        b.children[0].textContent = m.rec.hour;
        if (b._code !== m.rec.code + m.rec.night) { b.children[1].innerHTML = glyph(m.rec.code, m.rec.night); b._code = m.rec.code + m.rec.night; }
        b.children[2].textContent = deg(m.rec.temp);
        b.classList.toggle('on', !!preview && preview.rec === m.rec);
      });
    }
    function setPreview(m) {
      preview = m;
      previewT = 6;
      swapS.set(0.35); swapS.to(1);
      renderNow();
      updateScene();
    }
    function clearPreview() {
      if (!preview) return;
      preview = null;
      swapS.set(0.35); swapS.to(1);
      renderNow();
      updateScene();
    }

    /* ---------------------------------------------------- 7-Tage-Ring */
    const DW = SPAN / 7;
    const dayAng = (i) => SPAN0 + DW * (i + 0.5);
    const dayEls = [];
    function buildDays() {
      daySvg.innerHTML = '';
      dayItems.innerHTML = '';
      dayEls.length = 0;
      const defs = U.svg('defs');
      daySvg.appendChild(defs);
      data.days.forEach((d, i) => {
        const a = U.wrap(dayAng(i), 360);
        const bottom = a > 100 && a < 260;
        const size = 25, rc = 463;
        const rr = bottom ? rc + size * 0.36 : rc - size * 0.36;
        const id = U.uid('wxd');
        defs.appendChild(U.svg('path', { id, d: bottom ? V.ui.arcPath(500, 500, rr, a + 60, a - 60) : V.ui.arcPath(500, 500, rr, a - 60, a + 60) }));
        const tx = U.svg('text', { 'font-size': size, 'font-weight': 700, 'letter-spacing': 3.2, fill: 'rgba(255,255,255,.62)', 'font-family': "'Inter Tight', system-ui, sans-serif" });
        const tp = U.svg('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' });
        tp.textContent = (i === 0 ? 'Heute' : V.fmt.WD_S[d.date.getDay()]).toUpperCase();
        tx.appendChild(tp);
        daySvg.appendChild(tx);
        const up = V.display.pt(a, 374);
        const unit = U.el('div', { class: 'wx-du wx-sh', style: { left: up.x / 10 + 'cqw', top: up.y / 10 + 'cqw' } },
          U.el('div', { class: 'g', html: glyph(d.code, false) }),
          U.el('div', { class: 't', html: `${deg(d.hi)}<i>${deg(d.lo)}</i>` }));
        dayItems.append(unit);
        dayEls.push({ tx, unit });
      });
      renderDay(true);
    }
    function renderDay(instant) {
      const d = data.days[sel];
      if (!d) return;
      dcWd.textContent = sel === 0 ? 'Heute' : sel === 1 ? 'Morgen' : V.fmt.WD[d.date.getDay()];
      dcDt.textContent = (sel <= 1 ? V.fmt.WD[d.date.getDay()] + ', ' : '') + d.date.getDate() + '. ' + V.fmt.MON[d.date.getMonth()];
      dcG.innerHTML = glyph(d.code, false);
      dcTt.innerHTML = `${deg(d.hi)}<i> / ${deg(d.lo)}</i>`;
      dcCd.textContent = d.text;
      dcDl.innerHTML = `<span>${V.icon('drop')}${Math.round(d.precip * 10) * 10} %</span><span>${V.icon('wind')}${Math.round(d.wind)} km/h</span><span>${V.icon('sunrise')}${fmtH(d.sunrise)}</span>`;
      dayEls.forEach((e, i) => e.tx.setAttribute('fill', i === sel ? '#ffffff' : 'rgba(255,255,255,.55)'));
      if (!instant) V.tween({ duration: 0.45, ease: V.ease.outCubic, onUpdate: (v) => { dc.style.opacity = (0.2 + 0.8 * v).toFixed(3); } });
      updateScene();
    }
    function selectDay(i, fromUser) {
      i = U.clamp(i, 0, 6);
      if (i === sel) return;
      sel = i;
      selS.to(i);
      if (fromUser) { V.sound.play('tick'); V.haptic(4); }
      renderDay();
    }

    /* ---------------------------------------------------- Ansichten */
    function applyView(v) {
      const k = U.clamp(v, 0, 1);
      nowL.style.opacity = (1 - U.smoothstep(0, 0.55, k)).toFixed(3);
      nowL.style.transform = `scale(${(1 - 0.06 * k).toFixed(4)}) translateY(${(-3 * k).toFixed(2)}cqw)`;
      nowL.style.visibility = k > 0.98 ? 'hidden' : '';
      mkL.style.opacity = (1 - U.smoothstep(0, 0.4, k)).toFixed(3);
      mkL.style.visibility = k > 0.98 ? 'hidden' : '';
      daysL.style.visibility = k < 0.02 ? 'hidden' : '';
      daysL.style.opacity = U.smoothstep(0.25, 1, k).toFixed(3);
      dc.style.transform = `scale(${(0.92 + 0.08 * U.clamp(v, 0, 1.1)).toFixed(4)})`;
      dayEls.forEach((e, i) => {
        const q = U.clamp((v - 0.15 - i * 0.07) * 2.2, 0, 1.15);
        e.unit.style.opacity = U.clamp(q, 0, 1).toFixed(3);
        e.unit.style.transform = `translate(-50%,-50%) scale(${(0.6 + 0.4 * q).toFixed(3)})`;
      });
    }
    function setView(v) {
      if (v === view) return;
      view = v;
      crownAcc = 0;
      if (v === 'days') { clearPreview(); buildDays(); viewS.to(1); V.sound.play('open'); }
      else { if (sel !== 0) { sel = 0; selS.set(0); } viewS.to(0); V.sound.play('close'); }
      V.haptic(6);
      updateScene();
    }

    /* ---------------------------------------------------- Zeichnen am Rand */
    let grads = null;
    function makeGrads() {
      const c = data.curve;
      if (!hasConic) { grads = {}; return grads; }
      const st = crad(SPAN0);
      const curveG = g.createConicGradient(st, 500, 500);
      const fillG = g.createConicGradient(st, 500, 500);
      const ringG = g.createConicGradient(st, 500, 500);
      for (let q = 0; q < c.pts.length; q += 2) {
        const p = c.pts[q], off = (p.k / 24) * (SPAN / 360);
        const col = tempColor(p.T);
        curveG.addColorStop(off, col);
        fillG.addColorStop(off, U.rgba(col, 0.11));
        ringG.addColorStop(off, U.rgba(U.mix('#4F5FD0', '#FFD08A', p.day), U.lerp(0.42, 0.75, p.day)));
      }
      // Tage: Tiefst → Höchst je Bogen
      const daysG = g.createConicGradient(st, 500, 500);
      const dd = data.days;
      for (let i = 0; i < dd.length; i++) {
        const a0 = (DW * i + 2.2) / 360, a1 = (DW * (i + 1) - 2.2) / 360;
        daysG.addColorStop(a0, tempColor(dd[i].lo));
        daysG.addColorStop(a1, tempColor(dd[i].hi));
      }
      grads = { curveG, fillG, ringG, daysG };
      return grads;
    }
    function arc(r, a0, a1) { g.arc(500, 500, r, crad(a0), crad(a1)); }

    function drawNow(alpha, t) {
      const c = data.curve;
      const G = grads || makeGrads();
      const kMax = 24 * U.clamp(revealS.value, 0, 1);
      if (kMax <= 0.05) return;
      g.save();
      g.globalAlpha = alpha;
      g.lineCap = 'round';
      // Tag/Nacht-Spur am äußersten Rand
      g.lineWidth = 3.4;
      g.strokeStyle = G.ringG || 'rgba(255,214,140,.55)';
      g.beginPath(); arc(485, SPAN0, angK(kMax)); g.stroke();
      // Stundenmarken
      const t0 = data.t0;
      const firstK = (Math.ceil(t0 / HOUR) * HOUR - t0) / HOUR;
      for (let k = firstK, i = 0; k <= kMax; k += 1, i++) {
        const hr = new Date(t0 + k * HOUR).getHours();
        const big = hr % 3 === 0;
        const a = angK(k);
        const p0 = V.display.pt(a, big ? 462 : 470), p1 = V.display.pt(a, 477);
        g.strokeStyle = big ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.22)';
        g.lineWidth = big ? 2.6 : 1.6;
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      }
      // Regenband innen
      for (const r of c.rain) {
        if (r.k - 0.45 > kMax) continue;
        g.strokeStyle = `rgba(77,163,255,${(0.25 + 0.7 * r.p).toFixed(3)})`;
        g.lineWidth = 6;
        g.beginPath(); arc(386, angK(Math.max(0.05, r.k - 0.42)), angK(Math.min(kMax, r.k + 0.42))); g.stroke();
      }
      // Kurve
      const pts = c.pts;
      const n = Math.min(pts.length - 1, Math.floor(kMax * 4));
      const tail = kMax * 4 - n;
      const pos = (p) => V.display.pt(angK(p.k), p.r);
      const path = () => {
        g.beginPath();
        for (let i = 0; i <= n; i++) { const q = pos(pts[i]); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }
        if (tail > 0.001 && n < pts.length - 1) {
          const a = pts[n], b = pts[n + 1];
          const q = V.display.pt(angK(U.lerp(a.k, b.k, tail)), U.lerp(a.r, b.r, tail));
          g.lineTo(q.x, q.y);
        }
      };
      // Fläche zwischen Kurve und Grundlinie
      path();
      g.arc(500, 500, R_LO - 8, crad(angK(kMax)), crad(SPAN0), true);
      g.closePath();
      g.fillStyle = G.fillG || 'rgba(255,255,255,.08)';
      g.fill();
      // Leuchten + Linie
      path();
      g.lineJoin = 'round';
      g.strokeStyle = G.curveG || '#FFCA4D';
      g.globalAlpha = alpha * 0.28;
      g.lineWidth = 17;
      g.stroke();
      g.globalAlpha = alpha;
      g.lineWidth = 6;
      g.stroke();
      // Jetzt-Punkt mit Puls
      const p0 = pos(pts[0]);
      const ph = (t % 2.4) / 2.4;
      g.strokeStyle = `rgba(255,255,255,${(0.5 * (1 - ph)).toFixed(3)})`;
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(p0.x, p0.y, 10 + ph * 26, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.28)';
      g.beginPath(); g.arc(p0.x, p0.y, 17, 0, TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(p0.x, p0.y, 9, 0, TAU); g.fill();
      // gewählte Stunde
      if (preview) {
        const k = preview.k + 0.0;
        const i = U.clamp(Math.round(k * 4), 0, pts.length - 1);
        const q = pos(pts[i]);
        g.fillStyle = tempColor(pts[i].T);
        g.beginPath(); g.arc(q.x, q.y, 11, 0, TAU); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 3.5;
        g.beginPath(); g.arc(q.x, q.y, 11, 0, TAU); g.stroke();
      }
      g.restore();
    }

    function drawDays(alpha, t) {
      const G = grads || makeGrads();
      const s = selS.value;
      const a = SPAN0 + DW * (s + 0.5);
      g.save();
      g.globalAlpha = alpha;
      // Fokus des gewählten Tages: weicher Lichtfächer
      const hl = g.createRadialGradient(500, 500, 290, 500, 500, 500);
      hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.55, 'rgba(255,255,255,.07)'); hl.addColorStop(1, 'rgba(255,255,255,.16)');
      g.fillStyle = hl;
      g.beginPath(); g.arc(500, 500, 498, crad(a - DW / 2 + 0.6), crad(a + DW / 2 - 0.6)); g.arc(500, 500, 292, crad(a + DW / 2 - 0.6), crad(a - DW / 2 + 0.6), true); g.closePath(); g.fill();
      // Trennlinien
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5;
      for (let i = 1; i < 7; i++) { const p0 = V.display.pt(SPAN0 + DW * i, 305), p1 = V.display.pt(SPAN0 + DW * i, 470); g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); }
      // Temperaturbögen am Rand (Tiefst → Höchst)
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const on = 1 - U.clamp(Math.abs(s - i), 0, 1);
        g.strokeStyle = G.daysG || tempColor(data.days[i].hi);
        g.globalAlpha = alpha * (0.5 + 0.5 * on);
        g.lineWidth = 5 + 4 * on;
        g.beginPath(); arc(487, SPAN0 + DW * i + 2.2, SPAN0 + DW * (i + 1) - 2.2); g.stroke();
      }
      // Leuchtpunkt am gewählten Bogen
      g.globalAlpha = alpha;
      const pk = V.display.pt(a, 487);
      const gl = g.createRadialGradient(pk.x, pk.y, 0, pk.x, pk.y, 46);
      gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(pk.x, pk.y, 46, 0, TAU); g.fill();
      g.restore();
      void t;
    }

    /* ---------------------------------------------------- Takt */
    ctx.onFrame((dt, t) => {
      if (!data) return;
      sky.step(dt);
      sky.draw(dt, t);
      const v = U.clamp(viewS.value, 0, 1);
      if (v > 0.001) { g.fillStyle = `rgba(0,0,0,${(0.42 * v).toFixed(3)})`; g.fillRect(0, 0, 1000, 1000); }
      if (v < 0.999) drawNow(1 - U.smoothstep(0, 0.6, v), t);
      if (v > 0.001) drawDays(U.smoothstep(0.2, 1, v), t);
      if (preview) { previewT -= dt; if (previewT <= 0) clearPreview(); }
    });

    function refresh(instant) {
      const old = data && data.hrs[1] && data.hrs[1].date.getTime();
      load();
      renderNow();
      if (view === 'days') buildDays();
      if (preview) {
        const m = data.curve.marks.find((x) => x.rec.date.getTime() === preview.rec.date.getTime());
        if (m) preview = m; else preview = null;
      }
      updateScene(instant);
      return old;
    }
    ctx.on('time:minute', () => refresh());
    ctx.on('store:settings.location', () => { city = home(); refresh(); });

    /* ---------------------------------------------------- Bedienung */
    V.ui.tap(placeB, () => {
      if (preview) { clearPreview(); return; }
      const i = CITIES.indexOf(city);
      city = CITIES[(i + 1) % CITIES.length];
      swapS.set(0.2); swapS.to(1);
      refresh();
      revealS.set(0.35); revealS.to(1);
    });
    V.ui.tap(moreB, () => setView('days'));
    V.ui.tap(backB, () => setView('now'));
    V.gesture(root, {
      tap(p, e) {
        if (e && e.target && e.target.closest && e.target.closest('button')) return;
        if (p.y > 868 && Math.abs(p.x - 500) < 175) return;     // Visto-Zone
        if (view === 'days') {
          const pr = V.display.polar(p.x, p.y);
          if (pr.r >= 285) {
            const rel = U.wrap(pr.a - SPAN0, 360);
            if (rel <= SPAN) selectDay(Math.floor(rel / DW), true);
          }
        } else if (preview) clearPreview();
      },
      end(p) {
        if (!p.moved || p.cancelled) return;
        if (Math.abs(p.dy) < Math.abs(p.dx) * 1.2) return;
        if ((p.dy < -60 || p.vy < -600) && view === 'now') setView('days');
        else if ((p.dy > 60 || p.vy > 600) && view === 'days') setView('now');
      },
    });

    // Start
    refresh(true);
    applyView(0);
    swapS.set(1);
    revealS.to(1);

    return {
      crown(dA) {
        crownAcc += dA;
        if (view === 'now') {
          if (Math.abs(crownAcc) > 16) { setView('days'); crownAcc = 0; }
          return;
        }
        if (crownAcc >= 26) { crownAcc = 0; selectDay(sel + 1); }
        else if (crownAcc <= -26) {
          crownAcc = 0;
          if (sel === 0) setView('now'); else selectDay(sel - 1);
        }
      },
      back() {
        if (preview) { clearPreview(); return true; }
        if (view === 'days') { setView('now'); return true; }
        return false;
      },
      params(p) {
        if (p && p.city && findCity(p.city)) { city = findCity(p.city); refresh(); }
        if (p && p.day !== undefined) { setView('days'); selectDay(U.clamp(+p.day || 0, 0, 6)); }
      },
      shown() {
        const p = ctx.params || {};
        if (p.day !== undefined && +p.day > 0) { setView('days'); selectDay(U.clamp(+p.day, 0, 6)); }
      },
    };
  }

  /* ============================================================ Anmeldung */
  V.apps.register({
    id: 'weather',
    name: 'Wetter',
    icon: 'weather',
    color: COLOR,
    order: 20,
    keywords: ['wetter', 'vorhersage', 'temperatur', 'wetterbericht'],

    init() {
      V.info.weather = () => { const w = current(); return { temp: w.temp, icon: w.icon, text: w.text, hi: w.hi, lo: w.lo, place: w.place, code: w.code }; };

      V.actions.register('weather.current', {
        desc: 'Aktuelles Wetter am Standort (oder in city: Berlin, Hamburg, München, Köln, Frankfurt, Wien, Zürich): Temperatur, Zustand, Höchst- und Tiefstwert von heute.',
        params: { city: { type: 'string', description: 'optional: Stadt' } },
        run(a) { return sayCurrent(cityOf(a.city)); },
      });
      V.actions.register('weather.forecast', {
        desc: 'Wettervorhersage für einen Tag. day = 0 heute, 1 morgen, … bis 6. Optional city.',
        params: { day: { type: 'number', description: '0 = heute, 1 = morgen, … 6' }, city: { type: 'string' } },
        required: [],
        run(a) { const d = U.clamp(Math.round(Number(a.day) || 0), 0, 6); return sayDay(cityOf(a.city), d); },
      });
      V.actions.register('weather.rain', {
        desc: 'Beantwortet, ob es regnet bzw. ob man einen Schirm braucht (day 0 = heute, 1 = morgen …).',
        params: { day: { type: 'number' }, umbrella: { type: 'boolean' }, city: { type: 'string' } },
        run(a) { return sayPrecip(cityOf(a.city), U.clamp(Math.round(Number(a.day) || 0), 0, 6), a.umbrella ? 'umbrella' : 'rain'); },
      });

      const NOT_HERE = /(zimmer|küche|bad(?![a-zäöüß])|badezimmer|heizung|thermostat|drinnen|innen|raum|kühlschrank|backofen|wasser)/;
      V.brain.intent({
        id: 'weather', priority: 7,
        match: (t) => {
          if (/^(spiel|spiele|play)\b/.test(t) || NOT_HERE.test(t)) return null;
          if (/(?<![a-zäöüß])(öffne|öffnen|starte|app)(?![a-zäöüß])/.test(t)) return null;   // „Öffne Wetter“ öffnet die App
          const w = /(?<![a-zäöüß])(wetter|wetterbericht|wettervorhersage|vorhersage)(?![a-zäöüß])/.test(t);
          const umbrella = /(?<![a-zäöüß])(regen)?schirm(?![a-zäöüß])/.test(t);
          const rain = /(?<![a-zäöüß])(regnet|regnen|regen|nass|niederschlag|nieselt)(?![a-zäöüß])/.test(t);
          const snow = /(?<![a-zäöüß])(schneit|schnee|schneien)(?![a-zäöüß])/.test(t);
          const temp = /wie (warm|kalt|heiß)|(?<![a-zäöüß])(temperatur|temperaturen)(?![a-zäöüß])|wie ?viel grad|(ist|wird) es (draußen |heute |morgen )?(warm|kalt|heiß)|brauche ich (eine )?jacke|grad (hat es|sind es|ist es) draußen/.test(t);
          const sun = (/(wann|wie spät|um wie viel uhr).*sonne.*(?<![a-zäöüß])(auf|unter)(?![a-zäöüß])|sonnen(auf|unter)gang|wann wird es (hell|dunkel)/.test(t)) && !/weck/.test(t);
          const sunny = /(?<![a-zäöüß])sonnig(?![a-zäöüß])|scheint .*sonne|sonne scheint|sonnenschein/.test(t);
          const storm = /(?<![a-zäöüß])gewitter(?![a-zäöüß])/.test(t);
          if (!(w || umbrella || rain || snow || temp || sun || sunny || storm)) return null;
          const kind = umbrella ? 'umbrella' : sun ? 'sun' : snow ? 'snow' : storm ? 'storm' : rain ? 'rain' : sunny ? 'sunny' : temp ? 'temp' : 'general';
          return { kind, day: parseDay(t), city: cityFromText(t) };
        },
        run(m, t) {
          const wc = V.worldclock && V.worldclock.find && V.worldclock.find(t);
          if (!m.city && wc && !findCity(wc.name) && / in /.test(' ' + t + ' ')) {
            return { say: `Für ${wc.name} habe ich leider keine Wetterdaten. Ich kenne Berlin, Hamburg, München, Köln, Frankfurt, Wien und Zürich.`, emotion: 'sad' };
          }
          const c = m.city || home();
          const day = m.day;
          if (m.kind === 'umbrella') return sayPrecip(c, day || 0, 'umbrella');
          if (m.kind === 'rain') return sayPrecip(c, day || 0, 'rain');
          if (m.kind === 'snow') return sayPrecip(c, day || 0, 'snow');
          if (m.kind === 'temp') return sayTemp(c, day || 0);
          if (m.kind === 'sun') return saySun(c, day || 0, t);
          if (m.kind === 'storm' || m.kind === 'sunny') return saySky(c, day || 0, m.kind);
          if (day === null || (day === 0 && /(?<![a-zäöüß])(jetzt|gerade|aktuell|draußen)(?![a-zäöüß])/.test(t))) return sayCurrent(c);
          if (/wochenende/.test(t)) return sayWeekend(c);
          return sayDay(c, day);
        },
      });
    },

    create: create,
  });

  // für Tests und andere Module
  V.weather._glyph = glyph;
  V.weather._tempColor = tempColor;
})();
