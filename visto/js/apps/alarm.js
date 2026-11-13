/* VistoOS · apps/alarm.js — Wecker mit Sonnenaufgang
 *
 *  Liste:   Zeit groß, Name, Wochentage als feine Buchstabenreihe, Schalter. Der Rand ist ein
 *           24-Stunden-Ring (12 Uhr oben, Mitternacht unten, Morgen links): jeder Wecker eine Marke,
 *           ein leuchtender Bogen läuft von „jetzt“ bis zum nächsten Wecker.
 *  Neu/Bearbeiten: zwei Auswahlräder (Stunde/Minute), Wochentage als Chips am oberen Bogen,
 *           Sonnenaufgang an/aus; die Marke am Rand wandert mit.
 *  Hintergrund (init): sekündliche Prüfung über V.time.now(); Klingeln als V.notify.alert mit
 *           V.sound.alarm('sunrise'), Schlummern 9 Minuten.
 *  Sonnenaufgang: ab 5 Minuten vorher leuchtet das Display von unten immer stärker warm
 *           (Ebene V.display.top, antippen beendet das Licht). Auch der Weckbildschirm glüht.
 *  V.info.alarm() → {date, h, m, label, in, text} des nächsten Weckers.
 *  Aktionen: alarm.set {time, label, days, date}, alarm.list, alarm.delete {time, all}
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#FF6B3D', INK = '#2a0b00', WARM = '#FFB36B';
  const SNOOZE_MIN = 9, SUN_MIN = 5, GRACE = 10 * 60e3;
  const ORDER = [1, 2, 3, 4, 5, 6, 0];                      // Mo … So (Date.getDay)
  const SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const R_RING = 481;                                        // Marken und Bogen am Rand

  /* ------------------------------------------------------------ Daten */
  let S = null;
  function st() {
    if (!S) S = V.store.app('alarm', { alarms: [], lastH: 7, lastM: 0 });
    if (!Array.isArray(S.alarms)) S.alarms = [];
    // kaputte Einträge (z. B. alter Speicherstand) verwerfen, Wochentage absichern
    if (S.alarms.some((a) => !a || !isFinite(a.h) || !isFinite(a.m) || !Array.isArray(a.days))) {
      S.alarms = S.alarms.filter((a) => a && isFinite(a.h) && isFinite(a.m));
      for (const a of S.alarms) if (!Array.isArray(a.days)) a.days = [];
    }
    return S;
  }
  V.on('store:reset', () => { S = null; });
  const now = () => V.time.ms();

  function cleanDays(days) {
    const out = [];
    for (const d of days || []) { const n = Number(d); if (n >= 0 && n <= 6 && !out.includes(n)) out.push(n); }
    return out.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  }
  /** nächstes Klingeln nach `from` (ms) */
  function nextOf(a, from) {
    if (a.snooze && a.snooze > from) return a.snooze;
    if (!a.days.length && a.at && a.at > from) return a.at;
    const b = new Date(from);
    for (let i = 0; i <= 7; i++) {
      const c = new Date(b.getFullYear(), b.getMonth(), b.getDate() + i, a.h, a.m, 0, 0);
      if (c.getTime() > from && (!a.days.length || a.days.includes(c.getDay()))) return c.getTime();
    }
    return null;
  }
  function plan(a, from) { a.next = a.on ? nextOf(a, from === undefined ? now() : from) : null; }
  function changed() { V.store.save(); V.emit('alarm:changed'); }
  function sorted() { return st().alarms.slice().sort((x, y) => x.h * 60 + x.m - (y.h * 60 + y.m) || (x.days.length - y.days.length)); }
  function upcoming(onlySun) {
    let best = null;
    for (const a of st().alarms) if (a.on && a.next && (!onlySun || a.sun) && (!best || a.next < best.next)) best = a;
    return best;
  }
  function add(o) {
    const a = {
      id: U.uid('w'), h: U.clamp(Math.round(o.h), 0, 23), m: U.clamp(Math.round(o.m), 0, 59), label: o.label || '',
      days: cleanDays(o.days), on: true, sun: o.sun !== false, at: o.at || null, snooze: null, next: null,
    };
    if (a.days.length) a.at = null;
    st().alarms.push(a);
    st().lastH = a.h; st().lastM = a.m;
    plan(a);
    changed();
    return a;
  }
  function edit(a, o) {
    Object.assign(a, o);
    a.days = cleanDays(a.days);
    a.at = null; a.snooze = null; a.on = true;
    st().lastH = a.h; st().lastM = a.m;
    plan(a);
    changed();
  }
  function setOn(a, on) {
    a.on = !!on; a.snooze = null;
    if (on && !a.days.length) a.at = null;
    plan(a);
    changed();
  }
  function remove(a) { st().alarms = st().alarms.filter((x) => x !== a); changed(); }

  /* ----------------------------------------------------------- Formate */
  const hm = (h, m) => V.fmt.time(new Date(2000, 0, 1, h, m));
  function daysText(a) {
    const d = a.days;
    if (a.on && a.snooze && a.next === a.snooze) return 'Schlummert bis ' + V.fmt.time(new Date(a.snooze));
    if (!d.length) {
      if (a.on && a.next) return V.fmt.relDay(new Date(a.next));
      return 'Einmalig';
    }
    if (d.length === 7) return 'Täglich';
    const key = d.slice().sort().join('');
    if (key === '12345') return 'Werktags';
    if (key === '06') return 'Am Wochenende';
    if (d.length === 1) return LONG[d[0]] + 's';
    return d.map((x) => SHORT[x]).join(', ');
  }
  function daysWords(a) {
    const d = a.days;
    if (!d.length) return a.next ? whenWord(a.next) : 'einmalig';
    if (d.length === 7) return 'täglich';
    const key = d.slice().sort().join('');
    if (key === '12345') return 'werktags';
    if (key === '06') return 'am Wochenende';
    const names = d.map((x) => LONG[x] + 's');
    return names.length > 1 ? names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1] : names[0];
  }
  /** 'heute' | 'morgen' | 'am Samstag' */
  function whenWord(ms) {
    const r = V.fmt.relDay(new Date(ms));
    return r === 'Heute' ? 'heute' : r === 'Morgen' ? 'morgen' : r === 'Gestern' ? 'gestern' : 'am ' + r;
  }
  /** 'in 9 Std. 12 Min.' */
  function inText(ms) {
    const min = Math.max(1, Math.ceil(ms / 60e3));
    const h = Math.floor(min / 60), m = min % 60;
    if (h >= 24) { const d = Math.floor(h / 24), r = h % 24; return 'in ' + d + (d === 1 ? ' Tag' : ' Tagen') + (r ? ' ' + r + ' Std.' : ''); }
    return 'in ' + (h ? h + ' Std.' : '') + (h && m ? ' ' : '') + (m ? m + ' Min.' : '');
  }
  function inWords(ms) {
    const min = Math.max(1, Math.ceil(ms / 60e3));
    const h = Math.floor(min / 60), m = min % 60;
    if (h >= 24) { const d = Math.round(h / 24); return 'in ' + d + (d === 1 ? ' Tag' : ' Tagen'); }
    const p = [];
    if (h) p.push(h + (h === 1 ? ' Stunde' : ' Stunden'));
    if (m) p.push(m + (m === 1 ? ' Minute' : ' Minuten'));
    return 'in ' + p.join(' und ');
  }
  function spokenTime(h, m) { return m ? h + ':' + U.pad(m) + ' Uhr' : h + ' Uhr'; }
  /** Uhrwinkel auf dem 24-Stunden-Ring: 12 Uhr oben, 0 Uhr unten */
  const angOf = (h, m) => U.wrap(((h + m / 60 - 12) / 24) * 360, 360);

  /* ------------------------------------------------- Prüfen & Klingeln */
  function tick() {
    const t = now();
    let dirty = false;
    for (const a of st().alarms.slice()) {
      if (!a.on) continue;
      if (!a.next) { plan(a, t); dirty = true; if (!a.next) continue; }
      if (t >= a.next) {
        const due = a.next;
        a.snooze = null;
        if (a.days.length) plan(a, Math.max(t, due) + 1000);
        else { a.on = false; a.next = null; a.at = null; }
        dirty = true;
        if (t - due < GRACE) ring(a, due);
      }
    }
    if (dirty) changed();
    sunCheck(t);
    liveSync(t);
  }
  /** Live-Rand: Schlummern (Bogen läuft ab) und die letzten Minuten vor dem Klingeln */
  function liveSync(t) {
    if (!V.live) return;
    const a = upcoming();
    const left = a ? a.next - t : Infinity;
    const snz = !!(a && a.snooze && a.next === a.snooze);
    const span = snz ? SNOOZE_MIN * 60e3 : SUN_MIN * 60e3;
    if (a && left > 0 && left <= span && !ringing) {
      V.live.set('alarm', {
        app: 'alarm', color: COLOR, icon: 'alarm', priority: 40,
        value: () => U.clamp((a.next - now()) / span, 0, 1),
        label: snz ? 'Schlummern' : a.label || 'Wecker',
        sub: () => (snz ? 'bis ' : '') + hm(new Date(a.next).getHours(), new Date(a.next).getMinutes()) + ' · ' + inText(a.next - now()),
      });
    } else V.live.clear('alarm');
  }

  let ringing = 0;
  async function ring(a) {
    ringing++;
    const label = a.label || (a.h >= 4 && a.h < 11 ? 'Guten Morgen' : 'Wecker');
    const glow = a.sun;
    if (glow) sunRing(a);
    const p = V.notify.alert({
      title: label,
      body: hm(a.h, a.m) + ' · ' + (a.label ? 'Wecker' : V.fmt.weekday(V.time.now())),
      icon: 'alarm', color: COLOR, alarm: 'sunrise',
      buttons: [{ label: 'Schlummern', value: 'snooze' }, { label: 'Stopp', kind: 'white', value: 'stop' }],
    });
    // Weckbildschirm glüht warm (eigene Ebene im Hinweis, nur dieses Element)
    if (glow && V.display.top) {
      const all = V.display.top.querySelectorAll('.vos-alert');
      const el = all[all.length - 1];
      if (el) { el.classList.add('alm-alert'); el.prepend(sunLayers(true)); }
    }
    const v = await p;
    ringing--;
    sunEnd();
    if (v === 'snooze') {
      const t = now();
      a.snooze = t + SNOOZE_MIN * 60e3;
      a.on = true;
      a.next = a.snooze;
      changed();
      V.notify.toast('Schlummern bis ' + V.fmt.time(new Date(a.snooze)), 'alarm');
    } else if (v === 'stop') {
      V.sound.play('success');
    }
  }

  /* ---------------------------------------------- Sonnenaufgang (Licht) */
  const sun = { el: null, txt: null, layers: null, mode: 'off', due: 0, key: '', dismissed: '', k: 0, off: null, pokeT: 0 };
  function sunLayers(full) {
    const wrap = U.el('div', { class: 'alm-sunl' + (full ? ' full' : '') },
      U.el('div', { class: 'alm-sky' }),
      U.el('div', { class: 'alm-disc' }),
      U.el('div', { class: 'alm-rays' }));
    return wrap;
  }
  function sunCheck(t) {
    if (sun.mode === 'ring' || ringing) return;
    const a = upcoming(true);
    if (a && V.shell && V.shell.mode !== 'setup' && V.shell.mode !== 'boot') {
      const left = a.next - t;
      const key = a.id + ':' + a.next;
      if (left > 0 && left <= SUN_MIN * 60e3 && sun.dismissed !== key && !V.notify.alertOpen) {
        sunShow(a, key);
        return;
      }
    }
    if (sun.mode === 'pre') sunFade();
  }
  function sunBuild() {
    if (sun.el) return;
    V.css('alarm', CSS);
    sun.layers = sunLayers(false);
    sun.txt = V.ui.arcText({ text: '', r: 471, size: 20, weight: 700, spacing: 4.4, color: 'rgba(255,236,214,.88)' });
    sun.txt.el.classList.add('alm-suntxt');
    sun.el = U.el('div', { class: 'alm-sun', attrs: { role: 'button', 'aria-label': 'Sonnenaufgang beenden', 'data-tap': '1' } }, sun.layers, sun.txt.el);
    V.ui.tap(sun.el, () => {
      sun.dismissed = sun.key;
      sunFade();
    }, { sound: 'close' });
    V.display.top.appendChild(sun.el);
    sun.k = 0;
    sun.off = V.loop.add(sunFrame, 7);
  }
  function sunShow(a, key) {
    sunBuild();
    sun.mode = 'pre';
    sun.key = key;
    sun.due = a.next;
    sun.el.style.pointerEvents = '';
    sun.txt.set('Sonnenaufgang · ' + hm(a.h, a.m));
  }
  function sunRing(a) {
    sunBuild();
    sun.mode = 'ring';
    sun.due = a.next || now();
    sun.el.style.pointerEvents = 'none';
  }
  function sunFade() { if (sun.el) { sun.mode = 'fade'; sun.el.style.pointerEvents = 'none'; } }
  function sunEnd() { sunFade(); }
  function sunFrame(dt, tt) {
    if (!sun.el) return;
    const t = now();
    let target = 0;
    if (sun.mode === 'pre') target = U.clamp(1 - (sun.due - t) / (SUN_MIN * 60e3), 0, 1);
    else if (sun.mode === 'ring') target = 1;
    // Licht folgt weich (zeitbasiert)
    const rate = sun.mode === 'fade' ? 1.9 : sun.mode === 'ring' ? 1.2 : 0.9;
    sun.k += (target - sun.k) * Math.min(1, dt * rate);
    const k = sun.k;
    const lvl = sun.mode === 'fade' ? k : 0.14 + 0.86 * V.ease.inOutSine(k);
    const vis = sun.mode === 'fade' ? k : U.clamp(sun.k * 8, 0, 1) * lvl;
    const breathe = 1 + 0.025 * Math.sin(tt * 0.9);
    const L = sun.layers.children;
    L[0].style.opacity = vis.toFixed(3);
    L[0].style.transform = `translateY(${((1 - lvl) * 22).toFixed(2)}%) scale(${(breathe).toFixed(4)})`;
    L[1].style.opacity = U.clamp(vis * 1.1, 0, 1).toFixed(3);
    L[1].style.transform = `translateY(${((1 - lvl) * 34).toFixed(2)}cqw) scale(${(0.72 + 0.4 * lvl).toFixed(4)})`;
    L[2].style.opacity = (vis * 0.55).toFixed(3);
    L[2].style.transform = `translateY(${((1 - lvl) * 30).toFixed(2)}cqw) rotate(${(tt * 2.2).toFixed(2)}deg)`;
    sun.txt.el.style.opacity = sun.mode === 'pre' ? U.clamp(vis * 1.6, 0, 1).toFixed(3) : '0';
    // Display wach halten, solange es dämmert
    if (sun.mode !== 'fade') { sun.pokeT += dt; if (sun.pokeT > 2) { sun.pokeT = 0; V.emit('activity'); } }
    if (sun.mode === 'fade' && k < 0.004) {
      if (sun.off) sun.off();
      sun.off = null;
      sun.el.remove();
      sun.el = null;
      sun.mode = 'off';
    }
  }

  /* ------------------------------------------------------------ Stile */
  const CSS = `
.alm-dial { pointer-events: none; }
.alm-dial .mk { transition: opacity .4s; }
.alm-view { position: absolute; inset: 0; will-change: transform, opacity; }
.alm .alm-list.vos-rlist { padding: 21cqw 0 36cqw;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, transparent 16.5%, #000 22.5%, #000 79%, transparent 88%);
  mask-image: linear-gradient(to bottom, transparent 0, transparent 16.5%, #000 22.5%, #000 79%, transparent 88%); }
.alm-narc { pointer-events: none; }
.alm-head { display: flex; flex-direction: column; align-items: center; text-align: center; margin: 0 auto 3cqw; }
.alm-add { height: 9.6cqw; padding: 0 5cqw 0 4cqw; background: ${U.rgba(COLOR, 0.18)}; color: ${COLOR}; font-size: 3.7cqw; }
.alm-add svg { width: 4.6cqw; height: 4.6cqw; }
.alm-row { position: relative; width: 78cqw; margin: 0 auto 2.2cqw; padding: 3.2cqw 4.6cqw 3.2cqw 7cqw; border-radius: 8cqw;
  display: flex; align-items: center; gap: 3cqw; background: rgba(255,255,255,.075); transform-origin: 50% 50%;
  will-change: transform, opacity; cursor: pointer; transition: background .2s; }
.alm-row:active { background: rgba(255,255,255,.13); }
.alm-rl { flex: 1; min-width: 0; }
.alm-rt { font-size: 10.4cqw; font-weight: 250; letter-spacing: -.035em; line-height: 1; font-variant-numeric: tabular-nums;
  transition: opacity .35s, color .35s; }
.alm-rm { display: flex; align-items: center; gap: 1.6cqw; margin-top: 1.5cqw; font-size: 3.3cqw; font-weight: 550;
  color: rgba(255,255,255,.6); white-space: nowrap; overflow: hidden; transition: opacity .35s; }
.alm-rm svg { width: 3.8cqw; height: 3.8cqw; color: ${WARM}; flex: none; }
.alm-rm .lb { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.alm-dd { display: inline-flex; gap: .95cqw; font-size: 2.8cqw; font-weight: 750; letter-spacing: .02em; }
.alm-dd i { font-style: normal; color: rgba(255,255,255,.2); }
.alm-dd i.on { color: ${COLOR}; }
.alm-row.off .alm-rt { opacity: .4; }
.alm-row.off .alm-rm { opacity: .5; }
.alm-row.off .alm-dd i.on { color: rgba(255,255,255,.7); }
.alm-sw { flex: none; }
.alm-sw.on { background: ${COLOR}; }
.alm-empty { position: absolute; left: 0; right: 0; top: 23cqw; display: flex; flex-direction: column; align-items: center; text-align: center; }
.alm-eic { width: 22cqw; height: 22cqw; border-radius: 50%; display: grid; place-items: center; color: ${COLOR};
  background: radial-gradient(circle at 50% 40%, ${U.rgba(COLOR, 0.28)}, ${U.rgba(COLOR, 0.06)} 70%);
  box-shadow: 0 0 9cqw ${U.rgba(COLOR, 0.22)}; animation: almBreath 4.5s ease-in-out infinite; }
.alm-eic svg { width: 10cqw; height: 10cqw; }
@keyframes almBreath { 50% { transform: scale(1.05); box-shadow: 0 0 13cqw ${U.rgba(COLOR, 0.34)}; } }
.alm-et { margin-top: 4.6cqw; font-size: 6cqw; font-weight: 620; letter-spacing: -.02em; }
.alm-es { margin-top: 1.2cqw; font-size: 3.7cqw; color: rgba(255,255,255,.5); font-weight: 500; }
.alm-empty .alm-add { margin-top: 5cqw; }
/* Bearbeiten */
.alm-day { position: absolute; width: 11.6cqw; height: 11.6cqw; margin: -5.8cqw 0 0 -5.8cqw; border-radius: 50%; border: 0; padding: 0;
  background: rgba(255,255,255,.1); color: rgba(255,255,255,.72); font: 680 3.5cqw/1 var(--font); cursor: pointer;
  display: grid; place-items: center; transition: background .3s, color .3s, box-shadow .4s, transform .3s var(--spring); }
.alm-day span { display: block; transform: rotate(var(--rot)); }
.alm-day.on { background: ${COLOR}; color: ${INK}; box-shadow: 0 0 4.4cqw ${U.rgba(COLOR, 0.42)}; }
.alm-day:active { transform: scale(.88); }
.alm-band { position: absolute; left: 50%; top: 48.5cqw; width: 54cqw; height: 11cqw; transform: translate(-50%, -50%); border-radius: 99cqw;
  background: ${U.rgba(COLOR, 0.13)}; box-shadow: inset 0 0 0 .25cqw ${U.rgba(COLOR, 0.3)}; pointer-events: none; }
.alm-wheels { position: absolute; left: 50%; top: 48.5cqw; transform: translate(-50%, -50%); display: flex; align-items: center; gap: .6cqw;
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 24%, #000 76%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 24%, #000 76%, transparent); }
.alm-colon { font-size: 9cqw; font-weight: 250; color: rgba(255,255,255,.85); margin-top: -1.2cqw; width: 3cqw; text-align: center; }
.alm-hint { position: absolute; left: 0; right: 0; top: 72cqw; text-align: center; font-size: 3.4cqw; font-weight: 560;
  color: rgba(255,255,255,.55); white-space: nowrap; font-variant-numeric: tabular-nums; }
.alm-slot { position: absolute; transform: translate(-50%, -50%); }
.alm-eb { width: 14.5cqw; height: 14.5cqw; background: rgba(255,255,255,.12); color: #fff; }
.alm-eb svg { width: 6.2cqw; height: 6.2cqw; }
.alm-eb.save { background: ${COLOR}; color: ${INK}; box-shadow: 0 0 6cqw ${U.rgba(COLOR, 0.32)}; }
.alm-eb.del { background: rgba(255,69,58,.2); color: #FF6B62; }
.alm-sunp { position: absolute; left: 50%; top: 81.4cqw; transform: translate(-50%, -50%); height: 9.4cqw; padding: 0 4.4cqw 0 3.6cqw;
  border-radius: 99cqw; border: 0; display: inline-flex; align-items: center; gap: 1.6cqw; cursor: pointer; white-space: nowrap;
  background: rgba(255,255,255,.1); color: rgba(255,255,255,.62); font: 650 3.5cqw/1 var(--font);
  transition: background .35s, color .35s, box-shadow .4s; }
.alm-sunp svg { width: 4.8cqw; height: 4.8cqw; }
.alm-sunp.on { background: linear-gradient(90deg, ${COLOR}, ${WARM}); color: ${INK}; box-shadow: 0 0 6cqw ${U.rgba(WARM, 0.3)}; }
.alm-sunp:active { transform: translate(-50%, -50%) scale(.93); }
/* Sonnenaufgang */
.alm-sun { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; cursor: pointer; }
.alm-sunl { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none; }
.alm-sky { position: absolute; left: -12%; right: -12%; top: 0; bottom: -6%; transform-origin: 50% 100%; opacity: 0;
  background: radial-gradient(118% 92% at 50% 104%, rgba(255,232,190,.96) 0%, rgba(255,176,96,.9) 16%, rgba(255,112,58,.74) 33%,
    rgba(214,58,58,.5) 50%, rgba(120,24,62,.3) 66%, rgba(40,8,40,.12) 80%, rgba(0,0,0,0) 92%); }
.alm-disc { position: absolute; left: 50%; top: 86%; width: 62cqw; height: 62cqw; margin: -31cqw 0 0 -31cqw; border-radius: 50%; opacity: 0;
  background: radial-gradient(circle, rgba(255,250,232,1) 0%, rgba(255,232,170,.95) 16%, rgba(255,190,110,.6) 34%, rgba(255,140,70,.18) 56%, rgba(255,120,60,0) 70%); }
.alm-rays { position: absolute; left: 50%; top: 92%; width: 150cqw; height: 150cqw; margin: -75cqw 0 0 -75cqw; border-radius: 50%; opacity: 0;
  background: repeating-conic-gradient(from 0deg, rgba(255,214,160,.16) 0deg 4deg, rgba(255,214,160,0) 4deg 15deg);
  -webkit-mask-image: radial-gradient(circle, #000 0%, rgba(0,0,0,.5) 30%, transparent 62%);
  mask-image: radial-gradient(circle, #000 0%, rgba(0,0,0,.5) 30%, transparent 62%); }
.alm-sunl.full .alm-sky { opacity: 1; animation: almSky 7s ease-in-out infinite; }
.alm-sunl.full .alm-disc { opacity: 1; transform: translateY(4cqw) scale(1.05); animation: almDisc 6s ease-in-out infinite; }
.alm-sunl.full .alm-rays { opacity: .5; animation: almRays 60s linear infinite; }
@keyframes almSky { 50% { transform: scale(1.04); } }
@keyframes almDisc { 50% { transform: translateY(2.5cqw) scale(1.1); } }
@keyframes almRays { to { transform: rotate(360deg); } }
.alm-suntxt { pointer-events: none; }
.vos-alert.alm-alert { isolation: isolate; background: #000; }
.vos-alert.alm-alert > .alm-sunl { z-index: -1; }
.vos-alert.alm-alert .vos-body { color: rgba(255,255,255,.8); }
`;

  /* ------------------------------------------------------- Sprache */
  const DAYMAP = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 0 };
  /** Wochentage aus Text („werktags“, „jeden Montag und Mittwoch“, „täglich“) – null = einmalig */
  function daysFromText(t) {
    if (/(?<![a-zäöüß])(täglich|jeden tag|jeden morgen|alle tage)(?![a-zäöüß])/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
    if (/(?<![a-zäöüß])(werktags|wochentags|jeden werktag|an werktagen|unter der woche|montag bis freitag)(?![a-zäöüß])/.test(t)) return [1, 2, 3, 4, 5];
    if (/(?<![a-zäöüß])(am wochenende|wochenends|samstags und sonntags|jedes wochenende)(?![a-zäöüß])/.test(t)) return [0, 6];
    const out = [];
    const re = /(?<![a-zäöüß])(?:jeden |immer )?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(s?)(?![a-zäöüß])/g;
    let m;
    while ((m = re.exec(t))) {
      const pre = t.slice(Math.max(0, m.index - 6), m.index);
      if (m[2] === 's' || /jeden $|immer $/.test(pre)) out.push(DAYMAP[m[1]]);
    }
    return out.length ? out : null;
  }
  function daysFromArg(v) {
    if (v === undefined || v === null || v === '') return [];
    const list = Array.isArray(v) ? v : String(v).split(/[\s,;]+|\bund\b/);
    const out = [];
    for (const raw of list) {
      if (typeof raw === 'number') { out.push(raw); continue; }
      const s = String(raw).toLowerCase().trim().replace(/s$/, '');
      if (!s) continue;
      if (/^(täglich|daily|alle|jeden tag|every ?day)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
      if (/^(werktag|wochentag|weekday)/.test(s)) return [1, 2, 3, 4, 5];
      if (/^(wochenende|weekend)/.test(s)) return [0, 6];
      const k = s.slice(0, 2);
      const en = { mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0 };
      if (s in DAYMAP) out.push(DAYMAP[s]);
      else if (k in DAYMAP) out.push(DAYMAP[k]);
      else if (k in en) out.push(en[k]);
      else if (/^[0-6]$/.test(s)) out.push(+s);
    }
    return cleanDays(out);
  }
  function confirmSay(a) {
    const when = (a.days.length ? daysWords(a) : whenWord(a.next)) + ' um ' + spokenTime(a.h, a.m);
    return `Wecker gestellt: ${when}${a.label ? ' – „' + a.label + '“' : ''}. Das ist ${inWords(a.next - now())}.`;
  }
  function alarmCard(a) {
    return { type: 'icon', icon: 'alarm', color: COLOR, title: hm(a.h, a.m), sub: (a.label ? a.label + ' · ' : '') + (a.days.length ? daysText(a) : V.fmt.relDay(new Date(a.next))) + ' · ' + inText(a.next - now()) };
  }
  function listCard(items) {
    const el = U.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1.6cqw', alignItems: 'stretch', minWidth: '48cqw' } });
    for (const a of items.slice(0, 3)) {
      el.appendChild(U.el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '3cqw', justifyContent: 'space-between', opacity: a.on ? 1 : 0.45 } },
        U.el('span', { style: { fontSize: '7.4cqw', fontWeight: 280, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }, text: hm(a.h, a.m) }),
        U.el('span', { style: { fontSize: '3.3cqw', fontWeight: 600, color: a.on ? COLOR : 'rgba(255,255,255,.6)', whiteSpace: 'nowrap' }, text: a.on ? (a.label || daysText(a)) : 'Aus' })));
    }
    if (items.length > 3) el.appendChild(U.el('div', { class: 'vos-label', style: { textAlign: 'center' }, text: '+ ' + (items.length - 3) + ' weitere' }));
    return { type: 'el', el };
  }

  function actSet(args, atOverride) {
    const m = String(args.time || '').match(/(\d{1,2})[:.h ]?(\d{2})?/);
    if (!m) return { say: 'Um wie viel Uhr soll ich dich wecken?', emotion: 'confused' };
    const h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h > 23 || mi > 59) return { say: 'Diese Uhrzeit verstehe ich nicht.', emotion: 'confused' };
    const days = daysFromArg(args.days);
    let at = !days.length && atOverride && atOverride > now() ? atOverride : null;
    if (!at && !days.length && args.date) {
      const dm = String(args.date).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dm) { const d = new Date(+dm[1], +dm[2] - 1, +dm[3], h, mi, 0, 0); if (d.getTime() > now()) at = d.getTime(); }
    }
    const label = args.label ? String(args.label).slice(0, 28) : '';
    const want = at || nextOf({ h, m: mi, days, at: null, snooze: null }, now());
    const dup = st().alarms.find((x) => x.on && x.h === h && x.m === mi && x.days.join() === days.join() && x.next === want);
    const a = dup || add({ h, m: mi, days, label, at });
    if (dup && label) { dup.label = label; changed(); }
    V.sound.play('success');
    return { say: confirmSay(a), card: alarmCard(a), emotion: 'happy' };
  }
  function actList() {
    const list = sorted();
    if (!list.length) return { say: 'Du hast keinen Wecker gestellt.', card: { type: 'icon', icon: 'alarm', color: COLOR, title: 'Keine Wecker', sub: 'Sag „Weck mich um 7“' } };
    const on = list.filter((a) => a.on && a.next).sort((x, y) => x.next - y.next);
    const src = on.length ? on : list;
    const parts = src.slice(0, src.length > 4 ? 3 : 4).map((a) => daysWords(a) + ' um ' + spokenTime(a.h, a.m));
    if (src.length > 4) parts.push((src.length - 3) + ' weitere');
    const joined = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1] : parts[0];
    let say;
    if (!on.length) say = `Du hast ${list.length === 1 ? 'einen Wecker' : list.length + ' Wecker'}, aber keiner ist an.`;
    else say = `${on.length === 1 ? 'Ein Wecker ist an' : on.length + ' Wecker sind an'}: ${joined}.`;
    if (on.length === 1) say += ` Das ist ${inWords(on[0].next - now())}.`;
    return { say, card: listCard(list) };
  }
  function actDelete(args) {
    const list = st().alarms;
    if (!list.length) return 'Es ist kein Wecker gestellt.';
    let hit;
    const tm = args.time ? String(args.time).match(/(\d{1,2})(?:[:.](\d{2}))?/) : null;
    if (args.all || !tm) {
      if (!args.all && list.length > 1 && !tm) return { say: 'Welchen Wecker soll ich löschen? Sag zum Beispiel „Lösche den Wecker um 7“ oder „Lösche alle Wecker“.', emotion: 'thinking' };
      hit = list.slice();
    } else {
      const h = +tm[1], mi = tm[2] ? +tm[2] : 0;
      hit = list.filter((a) => a.m === mi && (a.h === h || a.h === (h + 12) % 24));
      if (!hit.length) return { say: `Ich finde keinen Wecker um ${spokenTime(h, mi)}.`, emotion: 'confused' };
    }
    st().alarms = list.filter((a) => !hit.includes(a));
    changed();
    const n = hit.length;
    return {
      say: n === 1 ? `Der Wecker um ${spokenTime(hit[0].h, hit[0].m)} ist gelöscht.`
        : tm && !args.all ? `${n === 2 ? 'Beide' : 'Die ' + n} Wecker um ${spokenTime(hit[0].h, hit[0].m)} sind gelöscht.`
        : n === 2 ? 'Beide Wecker sind gelöscht.' : `Alle ${n} Wecker sind gelöscht.`,
      card: { type: 'icon', icon: 'trash', color: COLOR, title: n === 1 ? hm(hit[0].h, hit[0].m) : n + ' Wecker', sub: 'Gelöscht' },
    };
  }

  /* ------------------------------------------------------------- App */
  V.apps.register({
    id: 'alarm',
    name: 'Wecker',
    icon: 'alarm',
    color: COLOR,
    order: 14,
    keywords: ['wecker', 'alarm', 'weckzeit', 'aufwachen'],

    init() {
      V.on('time:second', () => V.safe(tick, 'alarm tick'));
      V.on('time:changed', () => { for (const a of st().alarms) { a.snooze = null; plan(a); } changed(); });
      V.info.alarm = () => {
        const a = upcoming();
        if (!a) return null;
        const d = new Date(a.next);
        return { date: d, h: a.h, m: a.m, label: a.label, in: (a.next - now()) / 1000, sun: a.sun, text: 'Wecker ' + hm(d.getHours(), d.getMinutes()) };
      };
      /** alle Weckzeiten im Zeitraum (für Horizont und Zeitreise) → [{date, label, sun}] */
      V.info.alarms = (from, to) => {
        const t0 = +from, t1 = +to, out = [];
        for (const a of st().alarms) {
          if (!a.on) continue;
          // einmalige Wecker klingeln genau einmal (a.next); wiederholte an jedem ihrer Tage im Zeitraum
          if (!a.days.length) { if (a.next && a.next >= t0 && a.next < t1) out.push({ date: new Date(a.next), label: a.label || '', sun: !!a.sun }); continue; }
          const plain = { h: a.h, m: a.m, days: a.days, at: null, snooze: null };
          let t = nextOf(plain, t0 - 1000), guard = 0;
          while (t && t < t1 && guard++ < 16) {
            out.push({ date: new Date(t), label: a.label || '', sun: !!a.sun });
            t = nextOf(plain, t + 1000);
          }
          if (a.snooze && a.snooze >= t0 && a.snooze < t1) out.push({ date: new Date(a.snooze), label: a.label || '', sun: false });
        }
        return out.sort((x, y) => x.date - y.date);
      };

      V.actions.register('alarm.set', {
        desc: 'Stellt einen Wecker. time = Uhrzeit "HH:MM" (24 h). days = optionale Wochentage für wiederholte Wecker (z. B. ["mo","di","mi","do","fr"], "werktags", "wochenende", "täglich"); ohne days klingelt er einmal beim nächsten Erreichen der Uhrzeit. date = optional "YYYY-MM-DD" für einen bestimmten Tag. label = optionaler Name.',
        params: {
          time: { type: 'string', description: 'Uhrzeit HH:MM' },
          label: { type: 'string', description: 'Name, z. B. „Training“' },
          days: { type: 'array', items: { type: 'string' }, description: 'Wochentage: mo, di, mi, do, fr, sa, so (oder werktags/wochenende/täglich)' },
          date: { type: 'string', description: 'YYYY-MM-DD (nur einmalige Wecker)' },
        },
        required: ['time'],
        run: actSet,
      });
      V.actions.register('alarm.list', { desc: 'Listet alle Wecker mit Uhrzeit, Wochentagen und Status.', run: actList });
      V.actions.register('alarm.delete', {
        desc: 'Löscht Wecker. time = "HH:MM" löscht die Wecker zu dieser Uhrzeit; all = true löscht alle.',
        params: { time: { type: 'string', description: 'HH:MM' }, all: { type: 'boolean' } },
        run: actDelete,
      });

      const W = '(?<![a-zäöüß])(?:wecker|weckzeit|weckzeiten)(?![a-zäöüß])';
      V.brain.intent({
        id: 'alarm-list', priority: 9,
        match: [new RegExp('(?:welche|zeig|liste|wie viele|was für)(?![a-zäöüß]).*' + W), new RegExp(W + '.*(?:habe ich|hab ich|sind gestellt|gestellt|an sind)'), /\bwann (?:klingelt|weckst du mich|werde ich geweckt|muss ich aufstehen)\b/, /\bwann klingelt (?:der|mein) wecker\b/],
        run(m, t) {
          // „Wann klingelt mein Wecker?“ → nur der nächste
          const a = /^wann/.test(t) && upcoming();
          if (a) return { say: `Dein nächster Wecker klingelt ${whenWord(a.next)} um ${spokenTime(new Date(a.next).getHours(), new Date(a.next).getMinutes())}. Das ist ${inWords(a.next - now())}.`, card: alarmCard(a) };
          return actList();
        },
      });
      V.brain.intent({
        id: 'alarm-delete', priority: 9,
        match: [new RegExp('(?:lösch|lösche|löschen|entfern|entferne|streich|streiche)(?![a-zäöüß]).*' + W), new RegExp(W + '.*(?:löschen|entfernen|streichen)'), new RegExp('alle ' + W + ' (?:aus|weg)')],
        run(m, t) {
          if (/(?<![a-zäöüß])alle(?![a-zäöüß])/.test(t)) return actDelete({ all: true });
          const p = V.brain.parseTime(t, { literal: true });
          if (p) return actDelete({ time: U.pad(p.h) + ':' + U.pad(p.m) });
          if (st().alarms.length === 1) return actDelete({ all: true });
          return actDelete({});
        },
      });
      V.brain.intent({
        id: 'alarm-set', priority: 8,
        match: [/(?<![a-zäöüß])weck(?:e)? mich(?![a-zäöüß])/, /^(?!wann|wer|wie|warum)(?=.*\d).*(?<![a-zäöüß])(?:wecken|aufwecken)(?![a-zäöüß])/, new RegExp('(?:stell|stelle|setz|setze|mach|mache|erstelle)(?![a-zäöüß]).*' + W), new RegExp(W + '.*(?:um|für|auf) \\d'), new RegExp('neuer? ' + W)],
        run(m, t, original) {
          const p = V.brain.parseTime(t);
          if (!p) return { say: 'Um wie viel Uhr soll ich dich wecken? Du kannst die Zeit auch hier einstellen.', emotion: 'thinking', open: 'alarm', params: { new: true } };
          const days = daysFromText(t) || [];
          // Name: „namens Training“, „mit dem Namen Yoga“
          const lm = original.match(/(?:namens|mit dem Namen|Name)\s+„?([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]{1,24})/);
          return actSet({ time: U.pad(p.h) + ':' + U.pad(p.m), days, label: lm ? lm[1] : '' }, days.length ? null : p.date.getTime());
        },
      });
    },

    create(ctx) {
      V.css('alarm', CSS);
      const root = ctx.root;
      root.classList.add('alm');

      /* ----------------------------- Rand: 24-Stunden-Ring mit Marken */
      const dial = U.svg('svg', { class: 'vos-svg alm-dial', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      for (let h = 0; h < 24; h++) {
        const a = angOf(h, 0);
        const major = h % 6 === 0;
        const nearVisto = Math.abs(a - 180) < 14 || Math.abs(U.angDiff(a, 0)) < 8;
        const p0 = V.display.pt(a, major ? 452 : 459), p1 = V.display.pt(a, 468);
        dial.appendChild(U.svg('line', { x1: p0.x.toFixed(1), y1: p0.y.toFixed(1), x2: p1.x.toFixed(1), y2: p1.y.toFixed(1), stroke: '#fff', 'stroke-width': major ? 3.4 : 2.2, 'stroke-linecap': 'round', opacity: nearVisto ? 0.1 : major ? 0.42 : 0.2 }));
      }
      for (const [h, txt] of [[6, '6'], [18, '18']]) {
        const p = V.display.pt(angOf(h, 0), 428);
        dial.appendChild(U.svg('text', { x: p.x.toFixed(1), y: (p.y + 9).toFixed(1), 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 650, fill: 'rgba(255,255,255,.34)', 'font-family': "'Inter Tight', system-ui, sans-serif", text: txt }));
      }
      const marks = U.svg('g');
      const nowG = U.svg('g');
      const nowHalo = U.svg('circle', { cx: 500, cy: 500 - R_RING, r: 15, fill: '#fff', opacity: 0.16 });
      const nowDot = U.svg('circle', { cx: 500, cy: 500 - R_RING, r: 6.5, fill: '#fff' });
      nowG.append(nowHalo, nowDot);
      const editG = U.svg('g', { opacity: 0 });
      const editHalo = U.svg('circle', { cx: 500, cy: 500 - R_RING, r: 24, fill: COLOR, opacity: 0.3 });
      const editDot = U.svg('circle', { cx: 500, cy: 500 - R_RING, r: 10, fill: COLOR, stroke: '#fff', 'stroke-width': 3 });
      editG.append(editHalo, editDot);
      dial.append(marks, nowG, editG);
      root.appendChild(dial);
      const title = ctx.title('Wecker', { color: U.rgba(COLOR, 0.85) });

      function nowAngle() { const d = V.time.now(); return angOf(d.getHours(), d.getMinutes() + d.getSeconds() / 60); }
      function drawMarks() {
        marks.innerHTML = '';
        const nx = upcoming();
        for (const a of st().alarms) {
          const p = V.display.pt(angOf(a.h, a.m), R_RING);
          const isNext = nx === a;
          if (a.on) {
            marks.appendChild(U.svg('circle', { class: 'mk', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: isNext ? 20 : 14, fill: COLOR, opacity: isNext ? 0.3 : 0.18 }));
            marks.appendChild(U.svg('circle', { class: 'mk', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: isNext ? 8.5 : 7, fill: COLOR }));
          } else {
            marks.appendChild(U.svg('circle', { class: 'mk', cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 6.5, fill: 'none', stroke: 'rgba(255,255,255,.4)', 'stroke-width': 2.4 }));
          }
        }
        nowG.setAttribute('transform', `rotate(${nowAngle().toFixed(2)} 500 500)`);
      }
      function rimArc(toMs, o) {
        const span = (toMs - now()) / 864e5;
        if (!(span > 0)) { ctx.rim.remove('next'); return; }
        // mehr als ein Tag: Bogen bis zur Marke, dazu eine zarte volle Spur
        const multi = span > 1;
        ctx.rim.arc('next', Object.assign({ from: nowAngle(), value: multi ? Math.max(0.002, span % 1) : span, color: COLOR, width: 5.5, r: R_RING, glow: 0.9, alpha: 0.85, head: false, track: multi, trackAlpha: 0.13, smooth: true }, o || {}));
      }

      /* ------------------------------------------------------- Liste */
      const listV = U.el('div', { class: 'alm-view' });
      const head = U.el('div', { class: 'alm-head' });
      const addBtn = V.ui.button('Neuer Wecker', { icon: 'plus', cls: 'alm-add', onClick: () => openEdit(null) });
      head.append(addBtn);
      // nächster Wecker als Schrift am oberen Bogen
      const nextArc = V.ui.arcText({ text: '', r: 398, size: 23, weight: 650, spacing: 3.4, color: 'rgba(255,255,255,.66)' });
      nextArc.el.classList.add('alm-narc');
      const rl = V.ui.roundList({ items: [], header: head });
      rl.el.classList.add('alm-list');
      const empty = U.el('div', { class: 'alm-empty' },
        U.el('div', { class: 'alm-eic', html: V.icon('alarm') }),
        U.el('div', { class: 'alm-et', text: 'Noch kein Wecker' }),
        U.el('div', { class: 'alm-es', text: 'Sag „Weck mich um 7“' }),
        V.ui.button('Neuer Wecker', { icon: 'plus', cls: 'alm-add', onClick: () => openEdit(null) }));
      listV.append(rl.el, nextArc.el, empty);
      root.appendChild(listV);

      function rowEl(a) {
        const sw = U.el('div', { class: 'vos-switch alm-sw' + (a.on ? ' on' : ''), attrs: { role: 'switch', 'aria-checked': String(a.on), 'aria-label': 'Wecker ' + hm(a.h, a.m), 'data-tap': '1' } });
        const dd = U.el('span', { class: 'alm-dd' });
        if (a.days.length) for (const d of ORDER) dd.appendChild(U.el('i', { class: a.days.includes(d) ? 'on' : '', text: SHORT[d][0] }));
        const group = /^(Täglich|Werktags|Am Wochenende|\w+tags|\w+chs)$/.test(daysText(a)) || /^Schlummert/.test(daysText(a));
        const txt = a.label ? (a.days.length && !/^Schlummert/.test(daysText(a)) ? a.label : a.label + ' · ' + daysText(a)) : a.days.length && !group ? '' : daysText(a);
        const meta = U.el('div', { class: 'alm-rm' },
          a.sun ? U.frag(V.icon('sunrise')) : null,
          txt ? U.el('span', { class: 'lb', text: txt }) : null,
          a.days.length ? dd : null);
        const row = U.el('div', { class: 'alm-row' + (a.on ? '' : ' off'), attrs: { 'data-tap': '1', role: 'button', 'aria-label': 'Wecker ' + hm(a.h, a.m) + ' bearbeiten' } },
          U.el('div', { class: 'alm-rl' }, U.el('div', { class: 'alm-rt', text: hm(a.h, a.m) }), meta), sw);
        V.ui.tap(sw, (e) => {
          e.stopPropagation();
          setOn(a, !a.on);
          if (a.on) V.notify.toast(inText(a.next - now()).replace(/^in/, 'Klingelt in'), 'alarm');
        }, { sound: 'tick' });
        V.ui.tap(row, () => openEdit(a));
        return row;
      }
      function renderList() {
        const list = sorted();
        const nx = upcoming();
        empty.style.display = list.length ? 'none' : '';
        rl.el.style.display = list.length ? '' : 'none';
        nextArc.el.style.display = list.length ? '' : 'none';
        if (nx) {
          const d = new Date(nx.next);
          nextArc.set((nx.snooze ? 'Schlummert bis ' + hm(d.getHours(), d.getMinutes()) : V.fmt.relDay(d) + ' ' + hm(d.getHours(), d.getMinutes())) + ' · ' + inText(nx.next - now()));
        } else nextArc.set('Alle Wecker aus');
        rl.setItems(list.map((a) => ({ el: rowEl(a) })));
        drawMarks();
        if (mode === 'list') { if (nx) rimArc(nx.next); else ctx.rim.remove('next'); }
      }

      /* -------------------------------------------------- Bearbeiten */
      const editV = U.el('div', { class: 'alm-view', style: { opacity: 0, pointerEvents: 'none' } });
      root.appendChild(editV);
      let mode = 'list', cur = null;   // cur = bearbeiteter Wecker oder null (neu)
      const draft = { h: 7, m: 0, days: [], sun: true };
      const dayBtns = ORDER.map((d, i) => {
        const a = -57 + i * 19;
        const p = V.display.pt(a, 401);
        const b = U.el('button', { class: 'alm-day', attrs: { type: 'button', 'aria-label': LONG[d], 'aria-pressed': 'false' }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw', '--rot': a * 0.55 + 'deg' } }, U.el('span', { text: SHORT[d] }));
        V.ui.tap(b, () => {
          const k = draft.days.indexOf(d);
          if (k >= 0) draft.days.splice(k, 1); else draft.days.push(d);
          syncDraft();
        }, { sound: 'tick' });
        editV.appendChild(b);
        return { d, b };
      });
      editV.appendChild(U.el('div', { class: 'alm-band' }));
      const wheels = U.el('div', { class: 'alm-wheels' });
      const hw = V.ui.wheel({ items: Array.from({ length: 24 }, (_, i) => U.pad(i)), index: 7, rows: 5, itemH: 8.6, size: 10.5, width: '20cqw', weight: 280, onChange: (i) => { draft.h = i; syncDraft(); } });
      const mw = V.ui.wheel({ items: Array.from({ length: 60 }, (_, i) => U.pad(i)), index: 0, rows: 5, itemH: 8.6, size: 10.5, width: '20cqw', weight: 280, onChange: (i) => { draft.m = i; syncDraft(); } });
      wheels.append(hw.el, U.el('div', { class: 'alm-colon', text: ':' }), mw.el);
      editV.appendChild(wheels);
      const hint = U.el('div', { class: 'alm-hint' });
      editV.appendChild(hint);
      const leftB = V.ui.roundButton('close', { label: 'Abbrechen', cls: 'alm-eb', onClick: () => onLeftEdit() });
      const saveB = V.ui.roundButton('check', { label: 'Sichern', cls: 'alm-eb save', onClick: () => saveEdit() });
      const lp = V.display.pt(245, 370), rp = V.display.pt(115, 370);
      editV.append(
        U.el('div', { class: 'alm-slot', style: { left: lp.x / 10 + 'cqw', top: lp.y / 10 + 'cqw' } }, leftB),
        U.el('div', { class: 'alm-slot', style: { left: rp.x / 10 + 'cqw', top: rp.y / 10 + 'cqw' } }, saveB));
      const sunP = U.el('button', { class: 'alm-sunp on', attrs: { type: 'button', 'aria-pressed': 'true' }, html: V.icon('sunrise') + '<span>Sonnenaufgang</span>' });
      V.ui.tap(sunP, () => { draft.sun = !draft.sun; syncDraft(); }, { sound: 'tick' });
      editV.appendChild(sunP);

      function draftNext() { return nextOf({ h: draft.h, m: draft.m, days: draft.days, at: null, snooze: null }, now()); }
      const editAng = V.spring(0, { response: 0.45, bounce: 0.14 });
      editAng.onUpdate((v) => editG.setAttribute('transform', `rotate(${v.toFixed(2)} 500 500)`));
      function syncDraft() {
        for (const { d, b } of dayBtns) { const on = draft.days.includes(d); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
        sunP.classList.toggle('on', draft.sun);
        sunP.setAttribute('aria-pressed', String(draft.sun));
        const nx = draftNext();
        const dd = new Date(nx);
        hint.textContent = (draft.days.length ? daysText({ days: draft.days }) : V.fmt.relDay(dd)) + ' · ' + inText(nx - now());
        const target = angOf(draft.h, draft.m);
        editAng.to(editAng.value + U.angDiff(U.wrap(editAng.value, 360), target));
        if (mode === 'edit') rimArc(nx, { alpha: 0.7 });
      }
      function onLeftEdit() {
        if (cur) {
          const a = cur;
          closeEdit();
          remove(a);
          V.notify.toast('Wecker gelöscht', 'trash');
        } else closeEdit();
      }
      function saveEdit() {
        const o = { h: draft.h, m: draft.m, days: draft.days.slice(), sun: draft.sun };
        let a;
        if (cur) { a = cur; edit(a, o); } else a = add(Object.assign(o, { label: '' }));
        V.sound.play('success');
        V.haptic([8, 40, 8]);
        closeEdit();
        V.notify.toast(inText(a.next - now()).replace(/^in/, 'Klingelt in'), 'alarm');
      }

      const view = V.spring(0, { response: 0.5, bounce: 0.08 });
      view.onUpdate((p) => {
        const q = U.clamp(p, 0, 1.1);
        listV.style.opacity = U.clamp(1 - q * 1.6, 0, 1).toFixed(3);
        listV.style.transform = `scale(${(1 - 0.1 * q).toFixed(4)})`;
        editV.style.opacity = U.clamp((q - 0.2) / 0.8, 0, 1).toFixed(3);
        editV.style.transform = `scale(${(1.08 - 0.08 * q).toFixed(4)})`;
        title.el.style.opacity = U.clamp(1 - q * 2, 0, 1).toFixed(3);
        editG.setAttribute('opacity', U.clamp(q, 0, 1).toFixed(3));
        marks.setAttribute('opacity', (1 - 0.6 * U.clamp(q, 0, 1)).toFixed(3));
      });
      function openEdit(a) {
        cur = a;
        mode = 'edit';
        draft.h = a ? a.h : st().lastH; draft.m = a ? a.m : st().lastM;
        draft.days = a ? a.days.slice() : [];
        draft.sun = a ? a.sun : true;
        hw.set(draft.h, false); mw.set(draft.m, false);
        editAng.set(angOf(draft.h, draft.m));
        leftB.innerHTML = V.icon(a ? 'trash' : 'close');
        leftB.classList.toggle('del', !!a);
        leftB.setAttribute('aria-label', a ? 'Löschen' : 'Abbrechen');
        listV.style.pointerEvents = 'none';
        editV.style.pointerEvents = '';
        syncDraft();
        view.to(1);
      }
      function closeEdit() {
        mode = 'list';
        cur = null;
        listV.style.pointerEvents = '';
        editV.style.pointerEvents = 'none';
        view.to(0);
        renderList();
      }

      renderList();
      ctx.on('alarm:changed', () => { if (mode === 'list') renderList(); else drawMarks(); });
      ctx.on('time:minute', () => { if (mode === 'list') renderList(); else { drawMarks(); syncDraft(); } });
      if (ctx.params && ctx.params.new) openEdit(null);

      return {
        crown(dA) { if (mode === 'edit') mw.crown(dA); else rl.crown(dA); },
        back() { if (mode === 'edit') { closeEdit(); return true; } return false; },
        params(p) { if (p && p.new && mode === 'list') openEdit(null); },
      };
    },
  });
})();
