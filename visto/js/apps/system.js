/* VistoOS · apps/system.js — Diagnose: der runde Systemmonitor
 *
 *  Übersicht wie ein Instrument, von außen nach innen:
 *    Rand        Bildrate als Bogen (270°, Lücke unten für Visto) – voll = Zielrate erreicht
 *    Kranz       Bildzeiten der letzten Bilder als Speichen; ein Schreibkopf läuft wie beim Oszilloskop im Kreis
 *    Mitte       Bilder pro Sekunde, Anzeige-Takt, Qualitätsstufe
 *    Bogen unten vier Scheiben – Prozesse · Dienste · Speicher · Protokoll (antippen = Einzelheiten) – und „Neu starten“
 *  Alle Zahlen kommen aus V.sys (Kern) und V.platform; die App selbst misst nichts außer den Bildzeiten des Kranzes.
 *
 *  V.shell.open('system', {page: 'procs' | 'services' | 'storage' | 'log'})
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#35D2E4', AMBER = '#FFD60A', RED = '#FF453A', GREEN = '#32D74B';
  const A0 = 225, SWEEP = 270;           // Instrumentenbogen: von links unten über oben nach rechts unten
  const SLOTS = 135, STEP = SWEEP / SLOTS; // Speichen des Bildzeit-Kranzes (2° je Bild)
  const R_BASE = 422, R_LEN = 32;        // Kranz: Speichen wachsen von außen nach innen

  V.icon.add('diagnose', '<path d="M5.2 17.8a8.6 8.6 0 1 1 13.6 0"/><path d="M12 13.4l3.4-4.6"/><circle cx="12" cy="13.6" r="1.25"/><path d="M12 6.6v.1M7.1 9.2l.1.1M16.9 9.2l-.1.1"/>');

  const SPOKE_OK = 'rgba(255,255,255,.34)', SPOKE_SLOW = U.rgba(AMBER, 0.9), SPOKE_BAD = U.rgba(RED, 0.95);   // nichts pro Bild neu bauen
  const QUALITY = ['niedrig', 'mittel', 'hoch'];
  const STATE = { running: ['aktiv', GREEN], idle: ['bereit', AMBER], off: ['aus', 'rgba(255,255,255,.28)'] };
  const PAGES = { procs: 'Prozesse', services: 'System', storage: 'Speicher', log: 'Protokoll' };

  function bytes(n) {
    if (n < 1024) return [String(n), 'B'];
    if (n < 1024 * 1024) return [V.fmt.num(n / 1024, n < 10240 ? 1 : 0), 'KB'];
    return [V.fmt.num(n / 1048576, 1), 'MB'];
  }
  const bytesText = (n) => bytes(n).join(' ');
  function uptimeText(s) {
    if (s < 60) return Math.round(s) + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' Min';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h < 24) return h + ' Std ' + m + ' Min';
    return Math.floor(h / 24) + ' T ' + (h % 24) + ' Std';
  }
  const clock = (ms) => { const d = new Date(ms); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + ':' + U.pad(d.getSeconds()); };
  /** Zielrate: so schnell, wie die Anzeige kann. Der gemessene Takt bricht unter Last selbst ein – deshalb zählt
   *  der beste bisher gesehene Wert (am Gerät von Anfang an die 90 Hz des Panels); gedrosselt höchstens 90. */
  let peakHz = 0;
  function target() {
    if (!peakHz) peakHz = V.platform.name === 'linux' ? V.platform.display.hz : 60;
    const hz = V.loop.hz || 0;
    if (hz > peakHz && hz <= 240) peakHz = hz;
    return V.loop.cap90 ? Math.min(peakHz, V.platform.display.hz) : peakHz;
  }
  const health = (ratio) => (ratio >= 0.9 ? COLOR : ratio >= 0.66 ? AMBER : RED);
  function problems() { let n = 0; for (const e of V.sys.logs()) if (e.level !== 'info') n += 1; return n; }

  function stateEnd(state, label) {
    const s = label ? [label, STATE[state][1]] : STATE[state] || STATE.running;
    return U.el('div', { class: 'sy-state' }, U.el('i', { style: { background: s[1], boxShadow: state === 'running' ? '0 0 1.6cqw ' + U.rgba(GREEN, 0.7) : 'none' } }), U.el('span', { text: s[0] }));
  }

  /* ------------------------------------------------------- Seiteninhalte */
  const LIST = {
    procs() {
      const items = [];
      const list = V.sys.procs.list();
      if (!list.length) items.push({ icon: 'check', color: 'rgba(255,255,255,.1)', title: 'Keine App aktiv', sub: 'Nur das System läuft' });
      for (const p of list) {
        const def = V.apps.get(p.id) || {};
        items.push({
          icon: def.icon || 'info', color: def.color || '#636366', title: p.name,
          sub: (p.state === 'running' ? 'Geöffnet' : 'Arbeitet weiter') + ' · seit ' + V.fmt.time(new Date(p.since)) + (p.permissions.length ? ' · ' + p.permissions.join(', ') : ''),
          end: p.state === 'running' ? stateEnd('running') : stateEnd('idle', 'Hintergrund'),
          onClick: p.id === 'system' ? null : () => V.shell.open(p.id),
        });
      }
      const i = V.sys.info();
      items.push({ section: 'Kern' });
      items.push({ icon: 'heartbeat', color: U.rgba(COLOR, 0.24), iconColor: COLOR, title: 'Bildtakt', sub: i.loopSubs + ' Abonnenten', end: i.fps + '/s' });
      items.push({ icon: 'sparkle', color: U.rgba(COLOR, 0.24), iconColor: COLOR, title: 'Ereignisse', sub: 'Zuhörer am Systembus', end: String(i.listeners) });
      items.push({ icon: 'clock', color: U.rgba(COLOR, 0.24), iconColor: COLOR, title: 'Laufzeit', sub: 'seit ' + V.fmt.time(new Date(V.sys.bootTime)), end: uptimeText(i.uptime) });
      const perms = V.sys.perm.list();
      if (perms.length) {
        items.push({ section: 'Berechtigungen' });
        const NAME = { camera: 'Kamera', mic: 'Mikrofon', notify: 'Hinweise' }, ICON = { camera: 'camera', mic: 'mic', notify: 'bell' };
        for (const p of perms) {
          const def = V.apps.get(p.app) || {};
          items.push({ icon: ICON[p.name], color: p.granted ? U.rgba(GREEN, 0.26) : 'rgba(255,255,255,.1)', iconColor: p.granted ? GREEN : '#fff', title: (def.name || p.app) + ' · ' + NAME[p.name], sub: 'Antippen setzt die Entscheidung zurück', end: p.granted ? 'erlaubt' : 'abgelehnt', onClick: () => { V.sys.perm.revoke(p.app, p.name); V.notify.toast('Zurückgesetzt', 'check'); } });
        }
      }
      return items;
    },
    services() {
      const i = V.sys.info(), P = V.platform;
      const row = (title, end, sub) => ({ title, sub, end, cls: 'sy-plain' });
      const items = [
        row('Software', 'VistoOS ' + i.version, 'Build ' + i.build),
        row('Plattform', P.name === 'linux' ? 'Linux' : 'Web', P.host === 'device' ? 'Gerätemodus' : 'Emulator'),
        row('Display', i.display.width + ' × ' + i.display.height, 'rund · ' + i.display.hz + ' Hz'),
        row('Darstellung', i.display.size + ' px', 'Pixeldichte ×' + V.fmt.num(i.display.dpr, i.display.dpr % 1 ? 1 : 0) + ' · Anzeige ' + i.hz + ' Hz'),
        row('Gerätebrücke', i.bridge ? 'verbunden' : P.name === 'linux' ? 'sucht …' : '–', i.bridge ? P.bridge.url : P.name === 'linux' ? 'Web-Treiber als Rückfall' : 'nur am Gerät (vistod)'),
        row('Helligkeit', (P.caps.backlight ? 'Hardware' : 'Software'), 'Umgebungslicht ' + Math.round(P.light.value() * 100) + ' % · ' + (P.light.source === 'sensor' ? 'Sensor' : 'simuliert')),
        { section: 'Dienste · ' + i.services },
      ];
      for (const s of V.sys.services.list()) items.push({ title: s.desc || s.name, sub: s.detail || s.name, end: stateEnd(s.state), cls: 'sy-plain' });
      return items;
    },
    storage() {
      const P = V.platform.storage, items = [];
      const size = (o) => { try { return JSON.stringify(o).length * 2; } catch (e) { return 0; } };
      const d = V.store.data;
      items.push({ icon: 'settings', color: '#636366', title: 'Einstellungen', sub: 'System, Zifferblatt, Person', end: bytesText(size(d.settings) + size(d.user)) });
      const apps = Object.keys(d.apps || {}).map((id) => ({ id, n: size(d.apps[id]) })).filter((a) => a.n > 4).sort((a, b) => b.n - a.n);
      if (apps.length) items.push({ section: 'Apps' });
      for (const a of apps) {
        const def = V.apps.get(a.id) || {};
        items.push({ icon: def.icon || 'info', color: def.color || '#636366', title: def.name || a.id, end: bytesText(a.n) });
      }
      const other = P.keys().filter((k) => k.indexOf('vistoos') === 0 && k !== 'vistoos.v1');
      if (other.length) items.push({ section: 'Weitere Schlüssel' });
      for (const k of other) items.push({ title: k.replace(/^vistoos\./, ''), end: bytesText((k.length + (P.get(k) || '').length) * 2), cls: 'sy-plain' });
      items.push({ section: 'Ablage' });
      items.push({ title: P.persistent ? 'Dauerhaft' : 'Nur bis zum Neustart', sub: V.platform.name === 'linux' ? 'Kiosk-Profil auf dem Gerät' : P.persistent ? 'Browser-Speicher dieses Geräts' : 'Der Browser sperrt den Speicher', end: stateEnd(P.persistent ? 'running' : 'idle'), cls: 'sy-plain' });
      return items;
    },
    log() {
      const items = [];
      const all = V.sys.logs(80).reverse();
      const LV = { info: ['info', 'rgba(255,255,255,.1)', 'rgba(255,255,255,.7)'], warn: ['bell', U.rgba(AMBER, 0.24), AMBER], error: ['close', U.rgba(RED, 0.26), RED] };
      for (const e of all) {
        const lv = LV[e.level] || LV.info;
        items.push({
          icon: lv[0], color: lv[1], iconColor: lv[2], title: e.message, cls: 'sy-log',
          sub: clock(e.t) + ' · ' + e.source + (e.count > 1 ? ' · ' + e.count + '×' : ''),
          onClick: () => V.notify.alert({ title: e.level === 'error' ? 'Fehler' : e.level === 'warn' ? 'Warnung' : 'Meldung', body: e.message + ' — ' + clock(e.t) + ', ' + e.source, icon: lv[0], color: e.level === 'info' ? COLOR : lv[2], buttons: [{ label: 'OK', kind: 'white', value: true }] }),
        });
      }
      if (!items.length) items.push({ icon: 'check', color: 'rgba(255,255,255,.1)', title: 'Keine Einträge' });
      return items;
    },
  };
  function headline(page) {
    const i = V.sys.info();
    if (page === 'procs') {
      const l = V.sys.procs.list(), bg = l.filter((p) => p.state === 'paused').length;
      return [String(l.length), l.length === 1 ? 'App aktiv' : 'Apps aktiv', bg ? bg + ' im Hintergrund' : 'Abonnenten im Bildtakt: ' + i.loopSubs];
    }
    if (page === 'services') return [String(i.services), 'Dienste', 'Laufzeit ' + uptimeText(i.uptime)];
    if (page === 'storage') { const b = bytes(i.storageBytes); return [b[0], b[1] + ' belegt', V.platform.storage.persistent ? 'dauerhaft gespeichert' : 'nur bis zum Neustart']; }
    const n = problems();
    return [String(n), n === 1 ? 'Meldung' : 'Meldungen', n ? 'Warnungen und Fehler' : 'Alles ruhig'];
  }

  V.apps.register({
    id: 'system',
    name: 'Diagnose',
    icon: 'diagnose',
    color: COLOR,
    order: 95,
    keywords: ['diagnose', 'system', 'systemmonitor', 'monitor', 'leistung', 'prozesse', 'protokoll'],

    init() {
      V.actions.register('system.diagnose', {
        desc: 'Nennt den Systemzustand von Visto (Bildrate, Prozesse, Dienste, Speicher, Laufzeit). open = true öffnet zusätzlich die Diagnose-App.',
        params: { open: { type: 'boolean' } },
        run(a) {
          const i = V.sys.info(), n = problems();
          const ok = i.fps >= target() * 0.9;
          const say = (ok ? 'Alles läuft rund: ' : 'Es ruckelt etwas: ') + i.fps + ' Bilder pro Sekunde, ' + i.services + ' Dienste, ' + bytesText(i.storageBytes).replace('KB', 'Kilobyte').replace('MB', 'Megabyte') + ' belegt' + (n ? ' – und ' + n + (n === 1 ? ' Meldung' : ' Meldungen') + ' im Protokoll.' : '.');
          const res = { say, card: { type: 'icon', icon: 'diagnose', color: COLOR, title: i.fps + ' Bilder/s', sub: 'Laufzeit ' + uptimeText(i.uptime) }, emotion: ok ? 'happy' : 'thinking' };
          if (a && (a.open === true || a.open === 'true')) return { say: 'Ich öffne die Diagnose.', open: 'system', emotion: 'happy' };
          return res;
        },
      });
      V.brain.intent({
        id: 'system-diagnose', priority: 7,
        match: [/(?<![a-zäöüß])(diagnose|systemmonitor|systemstatus|systemzustand|bildrate|fps)(?![a-zäöüß])/, /\bwie (läuft|geht es) (das|dem) (system|gerät)\b/, /\bläuft (das system|alles) (rund|flüssig|gut)\b/],
        run(m, t) { return V.actions.run('system.diagnose', { open: /(?<![a-zäöüß])(öffne|zeig|starte)/.test(t) }); },
      });
    },

    create(ctx) {
      const root = ctx.root;
      const title = ctx.title('Diagnose', { color: U.rgba(COLOR, 0.82) });
      const main = U.el('div', { class: 'sy-main' });
      const sub = U.el('div', { class: 'sy-sub' });
      root.append(main, sub);

      /* ---------- Übersicht */
      const cv = U.el('canvas', { class: 'sy-ring' });
      const fpsEl = U.el('div', { class: 'sy-fps vos-num', text: '–' });
      const unitEl = U.el('div', { class: 'sy-unit vos-label', text: 'Bilder / s' });
      const noteEl = U.el('div', { class: 'sy-note' });
      main.append(cv, fpsEl, unitEl, noteEl);

      const discs = {};
      [['procs', 245], ['services', 211], ['storage', 149], ['log', 115]].forEach(([id, a], k) => {
        const p = V.display.pt(a, 298);
        const b = U.el('b'), s = U.el('small');
        const d = U.el('button', { class: 'sy-disc', attrs: { type: 'button' }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw' } }, b, s);
        V.ui.tap(d, () => openPage(id));
        main.appendChild(d);
        discs[id] = { el: d, b, s };
        // federnd nacheinander erscheinen
        d.style.opacity = '0';
        const sp = V.spring(0, V.motion.bouncy);
        sp.onUpdate((v) => { d.style.opacity = U.clamp(v * 1.6, 0, 1).toFixed(3); d.style.scale = (0.6 + 0.4 * v).toFixed(4); });
        ctx.timeout(() => sp.to(1).then(() => { d.style.scale = ''; d.style.opacity = ''; }), 140 + k * 70);
        ctx.cleanup(() => sp.stop());
      });
      const power = V.ui.roundButton('power', { cls: 'sy-power', label: 'Neu starten', onClick: restart });
      main.appendChild(power);

      function setDisc(id, value, unit, label, tone) {
        const d = discs[id];
        const html = U.esc(value) + (unit ? '<i>' + U.esc(unit) + '</i>' : '');
        if (d.b._h !== html) { d.b.innerHTML = html; d.b._h = html; }
        if (d.s.textContent !== label) d.s.textContent = label;
        d.el.style.setProperty('--tone', tone || 'transparent');
        d.el.setAttribute('aria-label', label + ': ' + value + (unit ? ' ' + unit : ''));
      }

      let ratio = 1, shown = '', tick = 0;
      function refresh() {
        const i = V.sys.info(), tg = target();
        ratio = U.clamp(i.fps / tg, 0, 1);
        const col = health(ratio);
        const txt = String(i.fps);
        if (txt !== shown) { fpsEl.textContent = txt; shown = txt; }
        unitEl.style.color = U.rgba(col, 0.9);
        const q = i.quality !== null ? ' · Qualität ' + (QUALITY[i.quality] || i.quality) : '';
        noteEl.textContent = 'Ziel ' + tg + ' Hz' + q;
        const procs = V.sys.procs.list(), n = problems();
        setDisc('procs', String(procs.length), '', procs.length === 1 ? 'Prozess' : 'Prozesse');
        setDisc('services', String(i.services), '', 'Dienste');
        const b = bytes(i.storageBytes);
        setDisc('storage', b[0], b[1], 'Speicher');
        setDisc('log', String(n), '', 'Protokoll', n ? (V.sys.logs().some((e) => e.level === 'error') ? RED : AMBER) : null);
        if (page && ++tick % 4 === 0) refreshPage();   // Einzelheiten alle 2 s (Speicher misst die Daten aller Apps)
      }

      /* ---------- Kranz der Bildzeiten (ein Schreibkopf, je Bild eine Speiche – der Rest der Leinwand bleibt stehen) */
      const c2 = cv.getContext('2d');
      let W = 0, S = 1, slot = 0;
      function sizeRing() {
        W = Math.max(240, Math.min(1080, Math.round(V.display.size * Math.min(V.display.dpr, 2))));
        cv.width = cv.height = W;
        S = W / 1000;
        slot = 0;
        // ruhender Bogen unter dem Bildraten-Bogen am Rand
        c2.lineCap = 'round';
        c2.strokeStyle = U.rgba(COLOR, 0.13);
        c2.lineWidth = 8 * S;
        c2.beginPath();
        c2.arc(500 * S, 500 * S, 481 * S, U.rad(A0 - 90), U.rad(A0 + SWEEP - 90));
        c2.stroke();
      }
      function spoke(a, r0, r1) {
        const sn = Math.sin(U.rad(a)), cs = -Math.cos(U.rad(a));
        c2.beginPath();
        c2.moveTo((500 + sn * r0) * S, (500 + cs * r0) * S);
        c2.lineTo((500 + sn * r1) * S, (500 + cs * r1) * S);
        c2.stroke();
      }
      function drawSlot(ms) {
        const budget = 1000 / target();
        // Lücke vor dem Schreibkopf freiräumen (6 Speichen), dann die neue Speiche setzen
        c2.globalCompositeOperation = 'destination-out';
        c2.strokeStyle = '#000';
        c2.lineCap = 'butt';
        c2.lineWidth = (R_LEN + 12) * S;
        c2.beginPath();
        const a = A0 + (slot + 0.5) * STEP;
        const gapEnd = Math.min(A0 + SWEEP + STEP * 0.6, a + STEP * 6.6);
        c2.arc(500 * S, 500 * S, (R_BASE - R_LEN / 2) * S, U.rad(a - STEP * 0.62 - 90), U.rad(gapEnd - 90));
        c2.stroke();
        c2.globalCompositeOperation = 'source-over';
        const k = ms / budget;
        const len = U.clamp(k / 3, 0.1, 1) * R_LEN;
        c2.lineCap = 'round';
        c2.lineWidth = 6.4 * S;
        c2.strokeStyle = k <= 1.3 ? SPOKE_OK : k <= 2.3 ? SPOKE_SLOW : SPOKE_BAD;
        spoke(a, R_BASE - len, R_BASE);
        slot = (slot + 1) % SLOTS;
        if (slot === 0) {   // neue Runde: Anfang freiräumen
          c2.globalCompositeOperation = 'destination-out';
          c2.lineCap = 'butt';
          c2.lineWidth = (R_LEN + 12) * S;
          c2.beginPath();
          c2.arc(500 * S, 500 * S, (R_BASE - R_LEN / 2) * S, U.rad(A0 - STEP * 0.7 - 90), U.rad(A0 + STEP * 6 - 90));
          c2.stroke();
          c2.globalCompositeOperation = 'source-over';
        }
      }
      sizeRing();
      ctx.on('display:resize', sizeRing);

      /* ---------- Einzelheiten */
      let page = null, pageEl = null, list = null, sig = '', hero = null;
      const nav = V.spring(0, V.motion.smooth);
      nav.onUpdate((t) => {
        const k = U.clamp(t, 0, 1);
        main.style.transform = `scale(${(1 - 0.14 * t).toFixed(4)})`;
        main.style.opacity = (1 - U.smoothstep(0, 0.7, k)).toFixed(3);
        main.style.filter = k > 0.01 && k < 0.99 ? `blur(${(k * 1.6).toFixed(2)}cqw)` : '';
        main.style.visibility = k > 0.995 ? 'hidden' : '';
        sub.style.transform = `scale(${(1.12 - 0.12 * t).toFixed(4)})`;
        sub.style.opacity = U.smoothstep(0.25, 1, k).toFixed(3);
        sub.style.visibility = k < 0.005 ? 'hidden' : '';
      });
      nav.set(0);

      function buildPage(id) {
        sub.innerHTML = '';
        hero = U.el('div', { class: 'sy-hero' }, U.el('b', { class: 'vos-num' }), U.el('span', { class: 'vos-label' }), U.el('small'));
        list = V.ui.roundList({ items: [], header: hero });
        list.el.classList.add('sy-list');
        pageEl = list.el;
        sub.appendChild(pageEl);
        sig = '';
        page = id;
        refreshPage();
        list.scrollTo(0);
      }
      function refreshPage() {
        if (!page || !list) return;
        const h = headline(page);
        hero.children[0].textContent = h[0];
        hero.children[1].textContent = h[1];
        hero.children[1].style.color = U.rgba(COLOR, 0.9);
        hero.children[2].textContent = h[2];
        const items = LIST[page]();
        // nur neu aufbauen, wenn sich Sichtbares geändert hat (sonst flackern Druckzustände und Fischauge)
        const s = items.map((x) => (x.section || '') + '|' + (x.title || '') + '|' + (x.sub || '') + '|' + (typeof x.end === 'string' ? x.end : x.end ? x.end.textContent : '')).join('\n');
        if (s === sig) return;
        sig = s;
        list.setItems(items);
      }
      function openPage(id) {
        if (!PAGES[id]) return;
        buildPage(id);
        title.set(PAGES[id]);
        sub.style.pointerEvents = 'auto';
        main.style.pointerEvents = 'none';
        nav.to(1);
      }
      function closePage() {
        if (!page) return false;
        page = null;
        title.set('Diagnose');
        sub.style.pointerEvents = 'none';
        main.style.pointerEvents = '';
        nav.to(0).then((done) => { if (done && !page) { sub.innerHTML = ''; list = null; } });
        V.sound.play('close');
        return true;
      }

      let restarting = false;
      async function restart() {
        if (restarting) return;
        const ok = await V.notify.alert({
          title: 'Neu starten?', body: V.platform.name === 'linux' && V.platform.bridge.connected ? 'Das Gerät fährt herunter und startet neu. Timer und Wecker bleiben erhalten.' : 'VistoOS wird neu geladen. Timer und Wecker bleiben erhalten.',
          icon: 'power', color: COLOR,
          buttons: [{ label: 'Abbrechen', kind: '', value: false }, { label: 'Neu starten', kind: 'white', value: true }],
        });
        if (!ok) return;
        restarting = true;
        const l = V.rim.loading({ color: COLOR });
        setTimeout(async () => { await l.done(); V.sys.restart(); }, 900);
      }

      refresh();
      ctx.interval(refresh, 500);
      ctx.on('sys:procs', () => { refresh(); if (page === 'procs') refreshPage(); });
      ctx.on('sys:log', () => { if (page === 'log') refreshPage(); });

      let gauge = 0;
      const arc = { value: 0, from: A0, color: COLOR, width: 8, r: 481, glow: 0.75, head: true, smooth: false, alpha: 1 };   // wird je Bild nur befüllt
      ctx.onFrame((dt) => {
        // echte Bildzeit (Zeitlupe des Emulators herausrechnen)
        drawSlot((dt / (V.loop.slow || 1)) * 1000);
        gauge += (ratio - gauge) * Math.min(1, dt * 5);
        const vis = 1 - U.clamp(nav.value, 0, 1);
        if (vis < 0.02) { ctx.rim.remove('fps'); return; }
        arc.value = Math.max(0.004, gauge * (SWEEP / 360));
        arc.color = health(ratio);
        arc.alpha = vis;
        ctx.rim.arc('fps', arc);
      });

      if (ctx.params && PAGES[ctx.params.page]) { buildPage(ctx.params.page); title.set(PAGES[ctx.params.page]); sub.style.pointerEvents = 'auto'; main.style.pointerEvents = 'none'; nav.set(1); }
      else sub.style.pointerEvents = 'none';

      return {
        back: () => closePage(),
        crown(dA) { if (page && list) list.crown(dA); },
        params(p) { if (p && PAGES[p.page]) openPage(p.page); },
        destroy() { nav.stop(); },
      };
    },
  });

  V.css('system', `
    .sy-main, .sy-sub { position: absolute; inset: 0; border-radius: 50%; transform-origin: 50% 50%; will-change: transform, opacity; }
    .sy-ring { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .sy-fps { position: absolute; left: 0; right: 0; top: 23.6cqw; text-align: center; font-size: 21cqw; font-weight: 200; letter-spacing: -.05em; line-height: 1; color: #fff; }
    .sy-unit { position: absolute; left: 0; right: 0; top: 45.6cqw; text-align: center; transition: color .6s; }
    .sy-note { position: absolute; left: 0; right: 0; top: 50.4cqw; text-align: center; font-size: 3.05cqw; font-weight: 550; letter-spacing: .01em; color: var(--fg3); white-space: nowrap; }
    .sy-disc {
      position: absolute; width: 15.8cqw; height: 15.8cqw; margin: -7.9cqw 0 0 -7.9cqw; padding: .6cqw 0 0; border: 0; border-radius: 50%;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .7cqw; color: #fff; cursor: pointer;
      background: radial-gradient(130% 130% at 30% 12%, rgba(255,255,255,.17), rgba(255,255,255,.065) 52%, rgba(255,255,255,.04));
      box-shadow: inset 0 0 0 .14cqw rgba(255,255,255,.09), inset 0 .3cqw .5cqw -.1cqw rgba(255,255,255,.28), 0 0 0 .22cqw var(--tone, transparent), 0 1.2cqw 3cqw rgba(0,0,0,.5);
      transition: transform .3s var(--spring), filter .2s, box-shadow .5s;
    }
    .sy-disc:active { transform: scale(.91); filter: brightness(1.3); }
    .sy-disc b { font-size: 5.3cqw; font-weight: 480; letter-spacing: -.035em; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .sy-disc b i { font-style: normal; font-size: 2.3cqw; font-weight: 650; letter-spacing: .02em; margin-left: .45cqw; color: var(--fg2); }
    .sy-disc small { font-size: 1.84cqw; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--fg3); line-height: 1; }
    .vos-btn.vos-round.sy-power { position: absolute; left: 50%; top: 80.4cqw; width: 9.6cqw; height: 9.6cqw; margin: -4.8cqw 0 0 -4.8cqw; color: ${COLOR}; }
    .vos-btn.vos-round.sy-power svg { width: 4.5cqw; height: 4.5cqw; }
    .sy-sub .vos-rlist.sy-list { padding-top: 15cqw; -webkit-mask-image: linear-gradient(to bottom, transparent 0, transparent 8.5cqw, #000 18cqw, #000 84cqw, transparent 97cqw); mask-image: linear-gradient(to bottom, transparent 0, transparent 8.5cqw, #000 18cqw, #000 84cqw, transparent 97cqw); }
    .sy-hero { display: flex; flex-direction: column; align-items: center; margin: 0 auto 4.6cqw; }
    .sy-hero b { font-size: 15cqw; font-weight: 200; letter-spacing: -.045em; line-height: 1; }
    .sy-hero .vos-label { margin-top: 1.4cqw; }
    .sy-hero small { margin-top: 1cqw; font-size: 3.05cqw; font-weight: 550; color: var(--fg3); }
    .sy-state { flex: none; display: flex; align-items: center; gap: 1.5cqw; font-size: 3.2cqw; font-weight: 600; color: var(--fg3); }
    .sy-state i { width: 1.7cqw; height: 1.7cqw; border-radius: 50%; }
    .vos-rrow.sy-plain { cursor: default; padding-left: 5.6cqw; }
    .vos-rrow.sy-plain .end { color: var(--fg2); max-width: 34cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vos-rrow.sy-log .tx b { font-size: 3.7cqw; font-weight: 560; }
  `);
})();
