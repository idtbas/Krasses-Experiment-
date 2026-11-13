/* VistoOS · core/time.js — Systemzeit (automatisch oder manuell gestellt) und deutsche Formate
 *
 *  V.time.now()              Date der Systemuhr
 *  V.time.setManual(date)    Uhr stellen       V.time.setAuto()
 *  V.time.isNight()          laut Einstellungen
 *  Ereignisse: 'time:second' (Date), 'time:minute' (Date), 'time:changed'
 *
 *  V.fmt.time(d) '14:05'   V.fmt.dateLong(d) 'Freitag, 13. November'   V.fmt.duration(299) '4:59'
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const time = (V.time = {
    offset() { return V.store.get('settings.timeMode') === 'manual' ? V.store.get('settings.timeOffset', 0) : 0; },
    ms() { return Date.now() + time.offset(); },
    now() { return new Date(time.ms()); },
    /** angezeigte Zeit: Jetzt + Zeitreise (os/horizon.js ersetzt das; ohne Zeitreise = now()) */
    view() { return time.now(); },
    setManual(date) {
      V.store.set('settings.timeMode', 'manual');
      V.store.set('settings.timeOffset', date.getTime() - Date.now());
      V.emit('time:changed');
      check(true);
    },
    setAuto() {
      V.store.set('settings.timeMode', 'auto');
      V.store.set('settings.timeOffset', 0);
      V.emit('time:changed');
      check(true);
    },
    isManual() { return V.store.get('settings.timeMode') === 'manual'; },
    isNight(d) {
      d = d || time.now();
      const h = d.getHours() + d.getMinutes() / 60;
      const from = V.store.get('settings.nightFrom', 22), to = V.store.get('settings.nightTo', 7);
      return from > to ? h >= from || h < to : h >= from && h < to;
    },
    /** Tageslicht 0 (Nacht) … 1 (Mittag) für Wetter/Umgebung */
    daylight(d) {
      d = d || time.now();
      const h = d.getHours() + d.getMinutes() / 60;
      return U.clamp(Math.sin(((h - 6) / 14) * Math.PI), 0, 1);
    },
  });

  let lastS = -1, lastM = -1;
  function check(force) {
    const d = time.now();
    const s = Math.floor(d.getTime() / 1000);
    if (s !== lastS || force) {
      lastS = s;
      V.emit('time:second', d);
      const m = Math.floor(s / 60);
      if (m !== lastM || force) { lastM = m; V.emit('time:minute', d); }
    }
  }
  V.loop.add(() => check(false), -50);
  setInterval(() => check(false), 1000); // auch wenn kein Bild gezeichnet wird

  /* ------------------------------------------------------------- Formate */
  const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const WD_S = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MON_S = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

  const fmt = (V.fmt = {
    WD, WD_S, MON, MON_S,
    h24() { return V.store.get('settings.use24h', true); },
    parts(d) {
      d = d || time.now();
      const H = d.getHours();
      const h12 = H % 12 === 0 ? 12 : H % 12;
      const h = fmt.h24() ? H : h12;
      return {
        H, h, m: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds(),
        hh: fmt.h24() ? U.pad(h) : String(h), mm: U.pad(d.getMinutes()), ss: U.pad(d.getSeconds()),
        ampm: H < 12 ? 'AM' : 'PM',
      };
    },
    time(d, o = {}) {
      const p = fmt.parts(d);
      return p.hh + ':' + p.mm + (o.seconds ? ':' + p.ss : '');
    },
    /** feste 24h-Darstellung, unabhängig von der Einstellung */
    time24(d) { return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); },
    weekday: (d) => WD[(d || time.now()).getDay()],
    dateLong(d) { d = d || time.now(); return WD[d.getDay()] + ', ' + d.getDate() + '. ' + MON[d.getMonth()]; },
    dateShort(d) { d = d || time.now(); return WD_S[d.getDay()] + ', ' + d.getDate() + '. ' + MON_S[d.getMonth()]; },
    dateNum(d) { d = d || time.now(); return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); },
    /** 'Heute', 'Morgen', 'Gestern' oder Wochentag */
    relDay(d) {
      const a = new Date(time.now()); a.setHours(0, 0, 0, 0);
      const b = new Date(d); b.setHours(0, 0, 0, 0);
      const diff = Math.round((b - a) / 864e5);
      if (diff === 0) return 'Heute';
      if (diff === 1) return 'Morgen';
      if (diff === -1) return 'Gestern';
      if (diff > 1 && diff < 7) return WD[b.getDay()];
      return fmt.dateShort(b);
    },
    /** Sekunden → '4:59' bzw. '1:04:59' */
    duration(sec, o = {}) {
      sec = Math.max(0, o.ceil === false ? Math.floor(sec) : Math.ceil(sec));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h || o.hours) return h + ':' + U.pad(m) + ':' + U.pad(s);
      return m + ':' + U.pad(s);
    },
    /** Sekunden → '5 Minuten', '1 Stunde und 30 Minuten' */
    durationWords(sec) {
      sec = Math.round(sec);
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      const out = [];
      if (h) out.push(h + (h === 1 ? ' Stunde' : ' Stunden'));
      if (m) out.push(m + (m === 1 ? ' Minute' : ' Minuten'));
      if (s && !h) out.push(s + (s === 1 ? ' Sekunde' : ' Sekunden'));
      if (!out.length) return '0 Sekunden';
      return out.length > 1 ? out.slice(0, -1).join(', ') + ' und ' + out[out.length - 1] : out[0];
    },
    /** relative Angabe: 'in 5 Min.', 'vor 2 Std.' */
    rel(ms) {
      const a = Math.abs(ms), fut = ms > 0;
      let v;
      if (a < 60e3) v = 'wenigen Sek.';
      else if (a < 3600e3) v = Math.round(a / 60e3) + ' Min.';
      else if (a < 86400e3) v = Math.round(a / 3600e3) + ' Std.';
      else v = Math.round(a / 86400e3) + ' Tagen';
      return (fut ? 'in ' : 'vor ') + v;
    },
    num(n, digits = 0) {
      return Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    },
    /** Zahl schön für Sprache/Anzeige (bis zu 6 sinnvolle Stellen) */
    smart(n) {
      if (!isFinite(n)) return String(n);
      const a = Math.abs(n);
      const d = a >= 1e6 ? 0 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
      return Number(n.toFixed(d)).toLocaleString('de-DE', { maximumFractionDigits: d });
    },
    /** Uhrzeit als gesprochenes Deutsch: 'Viertel nach drei' */
    spoken(d) {
      d = d || time.now();
      const h = d.getHours(), m = d.getMinutes();
      if (m === 0) return h + ' Uhr';
      return h + ' Uhr ' + m;
    },
  });
})();
