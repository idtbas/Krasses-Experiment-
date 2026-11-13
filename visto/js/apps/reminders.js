/* VistoOS · apps/reminders.js — Erinnerungen
 *
 *  Runde Liste (V.ui.roundList): oben groß die Zahl der offenen Erinnerungen, der Rand zeigt,
 *  wie viel schon erledigt ist. Abhak-Kreis antippen → Kreis füllt sich mit Feder, das Häkchen
 *  zeichnet sich, Funken stieben, der Text wird durchgestrichen und verblasst; danach wandert
 *  die Erinnerung zu „Erledigt“. Erledigte antippen holt sie zurück.
 *
 *  Hintergrund: fällige Erinnerungen lösen V.notify.banner aus (Prüfung in init).
 *  Aktionen:    reminders.add {text, at?} · reminders.list · reminders.complete {text}
 *  Daten:       V.store.app('reminders') = {items:[{id, text, at, done, doneAt, notified, created}], seeded}
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#FF9500';
  const MIN = 60e3, HOUR = 3600e3, DAY = 864e5;

  /* ------------------------------------------------------------ Daten */
  let S = null;
  function st() {
    if (!S) S = V.store.app('reminders', { items: [], seeded: 0 });
    return S;
  }
  const now = () => V.time.ms();
  function day0(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function atDay(off, h, m) { const d = new Date(day0(now())); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d.getTime(); }

  function seed() {
    const s = st();
    const t = now();
    const mk = (text, at, extra) => Object.assign({ id: U.uid('rm'), text, at, done: false, doneAt: 0, notified: !!(at && at <= t), created: t }, extra || {});
    s.items = [
      mk('Pflanzen gießen', atDay(0, 18, 0)),
      mk('Lea zurückrufen', Math.ceil((t + 2 * HOUR) / (15 * MIN)) * 15 * MIN),
      mk('Geschenk für Max besorgen', null),
      mk('Steuererklärung abschicken', atDay(3, 10, 0)),
      mk('Rezept in der Apotheke abholen', atDay(1, 12, 30)),
      mk('Fahrrad aufpumpen', null, { done: true, doneAt: t - 50 * MIN }),
      mk('Stromrechnung bezahlen', null, { done: true, doneAt: t - 26 * HOUR }),
    ];
    s.seeded = t;
    V.store.save();
  }

  function open() {
    return st().items.filter((i) => !i.done).sort((a, b) => {
      if (a.at && b.at) return a.at - b.at;
      if (a.at) return -1;
      if (b.at) return 1;
      return a.created - b.created;
    });
  }
  function done() { return st().items.filter((i) => i.done).sort((a, b) => b.doneAt - a.doneAt); }

  function add(text, at) {
    const it = { id: U.uid('rm'), text: String(text).trim().slice(0, 80), at: at || null, done: false, doneAt: 0, notified: false, created: now() };
    st().items.push(it);
    V.store.save();
    V.emit('reminders:changed', { added: it.id });
    return it;
  }
  function setDone(it, on) {
    it.done = on;
    it.doneAt = on ? now() : 0;
    if (!on && it.at && it.at > now()) it.notified = false;
    // Erledigte begrenzen
    const s = st();
    const d = done();
    if (d.length > 30) { const keep = new Set(d.slice(0, 30).map((x) => x.id)); s.items = s.items.filter((x) => !x.done || keep.has(x.id)); }
    V.store.save();
  }
  function clearDone() {
    const s = st();
    s.items = s.items.filter((i) => !i.done);
    V.store.save();
    V.emit('reminders:changed', {});
  }
  /** beste Übereinstimmung zu einem gesprochenen Text */
  function find(q, list) {
    q = String(q || '').toLowerCase().replace(/[^\wäöüß ]+/g, ' ').trim();
    if (!q) return null;
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    let best = null, bestS = 0;
    for (const it of list) {
      const t = it.text.toLowerCase();
      let sc = 0;
      if (t === q) sc = 100;
      else if (t.includes(q) || q.includes(t)) sc = 60;
      else sc = words.filter((w) => t.includes(w.replace(/(en|e|n|s)$/, ''))).length * 15;
      if (sc > bestS) { bestS = sc; best = it; }
    }
    return bestS >= 15 ? best : null;
  }

  /* ---------------------------------------------------------- Formate */
  function when(at) {
    const d = new Date(at);
    const rel = V.fmt.relDay(d);
    return rel + ', ' + V.fmt.time(d);
  }
  function whenWords(at, rel) {
    const t = now();
    if (rel) {
      const m = Math.round((at - t) / MIN);
      return 'in ' + (m < 60 ? (m === 1 ? 'einer Minute' : m + ' Minuten') : V.fmt.durationWords(m * 60).replace(/^1 Stunde/, 'einer Stunde'));
    }
    const diff = Math.round((day0(at) - day0(t)) / DAY);
    const time = 'um ' + V.fmt.time(new Date(at)) + ' Uhr';
    if (diff === 0) return time;
    if (diff === 1) return 'morgen ' + time;
    if (diff === 2) return 'übermorgen ' + time;
    if (diff < 7) return 'am ' + V.fmt.weekday(new Date(at)) + ' ' + time;
    return 'am ' + new Date(at).getDate() + '. ' + V.fmt.MON[new Date(at).getMonth()] + ' ' + time;
  }

  /* -------------------------------------------------- Hintergrund */
  function bgCheck() {
    if (V.shell.mode === 'setup' || V.shell.mode === 'boot') return;
    const t = now();
    let changed = false;
    for (const it of st().items) {
      if (it.done || !it.at || it.notified || it.at > t) continue;
      it.notified = true;
      changed = true;
      if (t - it.at > 6 * HOUR) continue; // längst vorbei: still nachtragen
      V.notify.banner({
        title: it.text,
        body: 'Erinnerung · ' + V.fmt.time(new Date(it.at)),
        icon: 'list', color: COLOR,
        onClick: () => V.shell.open('reminders'),
      });
    }
    if (changed) { V.store.save(); V.emit('reminders:changed', {}); }
  }

  /* ---------------------------------------------- Sprache: Text & Zeit */
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
    B + '(?:morgens|vormittags|mittags|nachmittags|abends|nachts|später|gleich|nachher)' + E,
  ].map((s) => new RegExp(s, 'gi'));
  function stripTime(s) {
    for (const rx of TIME_RX) s = s.replace(rx, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  /** „Erinnere mich in 10 Minuten an den Tee“ → {text: 'Tee', phrase: 'an den Tee'} */
  function aboutFrom(original) {
    let s = String(original).replace(/[„“"!?]/g, ' ').replace(/\.+\s*$/, '');
    s = s.replace(/^.*?(?<![\wäöüß])erinner\w*\s+(?:mich|uns)\s*/i, '');
    s = stripTime(s).replace(/^[,:\s]+|[,:\s]+$/g, '').replace(/^bitte\s+/i, '');
    const phrase = s;
    let txt = s.replace(/^(?:daran,?\s*(?:dass\s+ich\s+|zu\s+)?|an\s+(?:den|die|das|dem|meinen|meine|mein)\s+|ans\s+|an\s+|zu\s+|dass\s+ich\s+)/i, '');
    if (/\szu\s+\S+$/i.test(txt)) txt = txt.replace(/^(?:die|den|das|meine[nm]?|mein)\s+/i, '').replace(/\s+zu\s+(\S+)$/i, ' $1');
    txt = txt.replace(/^[,:\s]+|[,:\s]+$/g, '');
    if (!txt) return null;
    return { text: txt.charAt(0).toUpperCase() + txt.slice(1), phrase };
  }
  // „in einer (halben) Stunde“ versteht V.brain.parseTime (noch) nicht – lokal ergänzt
  const REL = [
    [/\bin (?:einer |1 )?halben stunde\b/, 1800], [/\bin (?:einer |1 )?dreiviertelstunde\b/, 2700],
    [/\bin (?:einer |1 )?viertelstunde\b/, 900], [/\bin anderthalb stunden\b/, 5400],
    [/\bin (?:einer|1) stunde\b/, 3600], [/\bin (?:einer|1) minute\b/, 60],
  ];
  /** Zeit aus dem Satz: genaue Uhrzeit, relativ oder Tageszeit-Wörter */
  function timeFrom(t) {
    for (const [rx, s] of REL) if (rx.test(t)) return { at: now() + s * 1000, rel: true };
    const p = V.brain.parseTime(t);
    if (p) return { at: p.date.getTime(), rel: p.rel };
    const base = (off, h, m = 0) => ({ at: atDay(off, h, m), rel: false });
    if (/(?<![a-zäöüß])übermorgen/.test(t)) return base(2, 9);
    if (/\bmorgen (früh|vormittag)\b/.test(t)) return base(1, 8);
    if (/\bmorgen (nachmittag)\b/.test(t)) return base(1, 15);
    if (/\bmorgen (abend)\b/.test(t)) return base(1, 19);
    if (/\bmorgen\b/.test(t)) return base(1, 9);
    if (/\bheute (abend)\b|\bheute nacht\b/.test(t)) return base(0, 19);
    if (/\bheute nachmittag\b/.test(t)) return base(0, 15);
    if (/\b(später|nachher)\b/.test(t)) return { at: now() + HOUR, rel: true };
    if (/\bgleich\b/.test(t)) return { at: now() + 10 * MIN, rel: true };
    return null;
  }

  function addReply(it, phrase, rel) {
    const w = it.at ? whenWords(it.at, rel) : '';
    const conn = phrase && /^(an |ans |daran)/i.test(phrase);
    const say = !it.at ? `Gemerkt: ${it.text}.` : conn ? `Mach ich. Ich erinnere dich ${w} ${phrase}.` : `Mach ich. Ich erinnere dich ${w}: ${it.text}.`;
    return {
      say,
      card: { type: 'icon', icon: 'list', color: COLOR, title: it.text, sub: it.at ? when(it.at) : 'Erinnerungen' },
      emotion: 'happy',
    };
  }

  /* -------------------------------------------------------- Karte */
  function countCard(n) {
    const box = U.el('div', { class: 'rm-card' });
    box.innerHTML = `<svg viewBox="0 0 200 200" style="width:21cqw;height:21cqw;display:block;overflow:visible">
      <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/>
      ${n ? `<circle cx="100" cy="100" r="86" fill="none" stroke="${COLOR}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(540 * Math.min(1, n / 8)).toFixed(1)} 999" transform="rotate(-90 100 100)" style="filter:drop-shadow(0 0 5px ${U.rgba(COLOR, 0.7)})"/>` : ''}
      <text x="100" y="104" text-anchor="middle" dominant-baseline="middle" font-size="66" font-weight="220" fill="#fff" style="font-family:'Inter Tight',system-ui,sans-serif;letter-spacing:-2px">${n}</text>
      <text x="100" y="146" text-anchor="middle" font-size="14" font-weight="700" fill="rgba(255,255,255,.5)" letter-spacing="2.4" style="font-family:'Inter Tight',system-ui,sans-serif">OFFEN</text></svg>`;
    return box;
  }

  /* ---------------------------------------------------------------- App */
  V.apps.register({
    id: 'reminders',
    name: 'Erinnerungen',
    icon: 'list',
    color: COLOR,
    order: 55,
    keywords: ['erinnerungen', 'erinnerung', 'aufgaben', 'to-do', 'todo', 'merkliste'],

    init() {
      if (!st().seeded) seed();
      setInterval(bgCheck, 5000);
      V.on('time:minute', bgCheck);
      V.on('time:changed', bgCheck);

      V.actions.register('reminders.add', {
        desc: 'Legt eine Erinnerung an. text = worum es geht (z. B. „Tee“), at = Zeitpunkt als lokale ISO-Zeit (optional; ohne at nur gemerkt).',
        params: { text: { type: 'string' }, at: { type: 'string', description: 'ISO-Zeit, lokal (optional)' } },
        required: ['text'],
        run(a) {
          let at = null;
          if (a.at) { const d = new Date(a.at); if (!isNaN(d)) at = d.getTime(); }
          const it = add(String(a.text || 'Erinnerung'), at);
          return addReply(it, a.phrase, !!a.rel);
        },
      });
      V.actions.register('reminders.list', {
        desc: 'Nennt die offenen Erinnerungen.',
        run() {
          const list = open();
          if (!list.length) return { say: 'Du hast keine offenen Erinnerungen. Alles erledigt!', card: { type: 'el', el: countCard(0) }, emotion: 'happy' };
          const names = list.slice(0, 3).map((i) => i.text + (i.at && i.at - now() < DAY && i.at > now() ? ' um ' + V.fmt.time(new Date(i.at)) : ''));
          const more = list.length > 3 ? ` und ${list.length - 3} weitere` : '';
          const lead = list.length === 1 ? 'Du hast eine offene Erinnerung: ' : `Du hast ${list.length} offene Erinnerungen: `;
          const joined = names.length > 1 && !more ? names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1] : names.join(', ') + more;
          return { say: lead + joined + '.', card: { type: 'el', el: countCard(list.length) } };
        },
      });
      V.actions.register('reminders.complete', {
        desc: 'Hakt die offene Erinnerung ab, die am besten zu text passt.',
        params: { text: { type: 'string' } },
        required: ['text'],
        run(a) {
          const it = find(a.text, open());
          if (!it) return { say: 'Diese Erinnerung finde ich nicht.', emotion: 'confused' };
          setDone(it, true);
          V.emit('reminders:changed', { done: it.id });
          V.sound.play('success');
          return { say: `Abgehakt: ${it.text}.`, card: { type: 'icon', icon: 'check', color: COLOR, title: it.text, sub: 'Erledigt' }, emotion: 'happy' };
        },
      });

      V.brain.intent({
        id: 'rem-add', priority: 9.2,
        match: (t, original) => {
          let m;
          const o = String(original || '');
          if ((m = o.match(/^\s*(?:bitte\s+)?(?:merk|merke|notier|notiere)\s+(?:dir|mir)\s*[:,]?\s*(?:bitte\s*[:,]?\s*)?(.+)$/i))) return { kind: 'note', body: m[1] };
          if ((m = o.match(/^\s*(?:bitte\s+)?(?:setz|setze|schreib|schreibe|pack|packe)\s+(.+?)\s+auf\s+(?:die|meine)\s+(?:liste|einkaufsliste|merkliste|erinnerungen)\s*[.!]?$/i))) return { kind: 'note', body: m[1] };
          if (/(?<![a-zäöüß])erinner(?:e|n|st)? (?:mich|uns)\b/.test(t)) return { kind: 'remind' };
          return null;
        },
        run(m, t, original) {
          if (m.kind === 'note') {
            const tf = timeFrom(V.brain.norm(m.body));
            let text = stripTime(m.body).replace(/^(?:dass ich\s+)/i, '').replace(/^[,:\s]+|[,:\s.!]+$/g, '');
            if (!text) return { say: 'Was soll ich mir merken?', emotion: 'confused' };
            text = text.charAt(0).toUpperCase() + text.slice(1);
            return addReply(add(text, tf ? tf.at : null), null, tf && tf.rel);
          }
          const ab = aboutFrom(original);
          const tf = timeFrom(t);
          if (!ab && tf) {
            const it = add('Erinnerung', tf.at);
            return { say: `Mach ich. Ich melde mich ${whenWords(it.at, tf.rel)}.`, card: { type: 'icon', icon: 'bell', color: COLOR, title: V.fmt.time(new Date(it.at)), sub: 'Erinnerung' }, emotion: 'happy' };
          }
          if (!ab) return { say: 'Woran und wann soll ich dich erinnern?', emotion: 'confused' };
          return addReply(add(ab.text, tf ? tf.at : null), ab.phrase, tf && tf.rel);
        },
      });
      V.brain.intent({
        id: 'rem-done', priority: 9.1,
        match: [/^(?:hake?|streiche?) (.+?) ab$/, /^(.+?) (?:ist|sind|habe ich|hab ich) erledigt$/, /^erledige? (.+)$/, /^(.+?) erledigt$/],
        run(m) {
          const it = find(m[1], open());
          if (!it) return null;
          return V.actions.run('reminders.complete', { text: it.text });
        },
      });
      V.brain.intent({
        id: 'rem-list', priority: 9,
        match: [/\berinnerungen\b/, /\bwas (?:muss|sollte|wollte) ich (?:noch )?(?:erledigen|machen|tun|besorgen)\b/, /\bmeine (?:to-?dos?|aufgaben|merkliste)\b/],
        run(m, t) {
          if (/(?<![a-zäöüß])(öffne|zeig|starte)/.test(t)) return { say: 'Hier sind deine Erinnerungen.', open: 'reminders' };
          return V.actions.run('reminders.list');
        },
      });
    },

    create(ctx) {
      const root = ctx.root;
      ctx.title('Erinnerungen', { color: U.rgba(COLOR, 0.82) });
      const list = V.ui.roundList({ items: [] });
      list.el.classList.add('rm-list');
      root.appendChild(list.el);

      function checkSvg() {
        const sparks = Array.from({ length: 7 }, (_, i) => `<circle class="rm-spark" cx="20" cy="20" r="1.6" data-a="${(i / 7) * 360 + 12}"/>`).join('');
        return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="rm-burst" cx="20" cy="20" r="17"/>${sparks}
          <circle class="rm-ring" cx="20" cy="20" r="17"/><circle class="rm-fill" cx="20" cy="20" r="17"/>
          <path class="rm-tick" d="M12.2 20.6l5.2 5.1 10.6-11.2"/></svg>`;
      }

      function rowFor(it) {
        const t = now();
        const over = !it.done && it.at && it.at <= t;
        const soon = !it.done && it.at && !over && it.at - t < 2 * HOUR;
        const row = U.el('div', { class: 'vos-rrow rm-row' + (it.done ? ' done' : '') + (over ? ' over' : '') + (soon ? ' soon' : ''), attrs: { role: 'button', 'aria-label': it.text + (it.done ? ', erledigt' : '') } });
        const chk = U.el('div', { class: 'rm-check', html: checkSvg() });
        const sub = it.done ? 'Erledigt · ' + when(it.doneAt) : it.at ? (over ? 'Überfällig · ' : '') + when(it.at) : null;
        const tx = U.el('div', { class: 'tx' }, U.el('b', { text: it.text }), sub ? U.el('small', { html: (it.at && !it.done ? V.icon('bell') : '') + '<span>' + U.esc(sub) + '</span>' }) : null);
        row.append(chk, tx);
        V.ui.tap(row, () => toggle(it, row), { sound: false });
        return row;
      }

      function header(nOpen, nDone) {
        const h = U.el('div', { class: 'rm-head' });
        if (nOpen) {
          h.append(U.el('div', { class: 'rm-count vos-num', text: String(nOpen) }),
            U.el('div', { class: 'vos-label rm-sub', text: 'Offen' }));
          const dueToday = open().filter((i) => i.at && day0(i.at) <= day0(now())).length;
          if (dueToday) h.lastChild.textContent = 'Offen · ' + dueToday + ' heute';
        } else {
          h.append(U.el('div', { class: 'rm-all' + (nDone ? '' : ' empty'), html: V.icon(nDone ? 'check' : 'list') }), U.el('div', { class: 'vos-label rm-sub', text: nDone ? 'Alles erledigt' : 'Keine Erinnerungen' }));
        }
        return h;
      }

      function footer(nDone) {
        const f = U.el('div', { class: 'rm-foot' });
        f.appendChild(V.ui.button('Neue Erinnerung', { icon: 'mic', cls: 'rm-new', onClick: () => V.convo && V.convo.activate({ via: 'tap' }) }));
        f.appendChild(U.el('div', { class: 'rm-hint' }, 'Sag zum Beispiel', U.el('b', { text: '„Erinnere mich um 15 Uhr ans Telefonieren“' })));
        if (nDone) f.appendChild(V.ui.button('Erledigte löschen', { kind: 'ghost', size: 'sm', icon: 'trash', onClick: () => { clearDone(); V.notify.toast('Erledigte gelöscht', 'trash'); } }));
        return f;
      }

      function render() {
        const o = open(), d = done();
        const items = o.map((it) => ({ el: rowFor(it) }));
        if (d.length) {
          items.push({ section: 'Erledigt' });
          for (const it of d.slice(0, 12)) items.push({ el: rowFor(it) });
        }
        list.inner.style.minHeight = '';
        const st0 = list.scroller.scrollTop;
        list.setItems(items);
        // Kopf und Fuß sind nicht Teil der Zeilen (keine Fischaugen-Skalierung)
        list.inner.insertBefore(header(o.length, d.length), list.inner.firstChild);
        list.inner.appendChild(footer(d.length));
        list.scroller.scrollTop = st0;
        progress(o.length, d.length);
      }
      function progress(nOpen, nDone) {
        const total = nOpen + nDone;
        ctx.rim.arc('prog', { value: total ? nDone / total : 0, from: 0, color: COLOR, width: 9, r: 487, glow: 0.9, track: true, head: nDone > 0 && nOpen > 0, smooth: true });
      }

      let pending = 0;
      function toggle(it, row) {
        const on = !it.done;
        setDone(it, on);
        animateCheck(row, on);
        row.classList.toggle('done', on);
        if (on) { V.sound.play('success'); V.haptic([8, 30, 14]); V.rim.pulse({ at: 0, color: COLOR, spread: 60 }); } else { V.sound.play('tap'); V.haptic(5); }
        progress(open().length, done().length);
        clearTimeout(pending);
        pending = ctx.timeout(() => { pending = 0; render(); }, on ? 1150 : 520);
      }

      function animateCheck(row, on) {
        const fill = row.querySelector('.rm-fill'), tick = row.querySelector('.rm-tick'), burst = row.querySelector('.rm-burst');
        const sp = V.spring(on ? 0 : 1, { response: on ? 0.42 : 0.28, bounce: on ? 0.42 : 0 });
        sp.onUpdate((v) => { fill.style.transform = `scale(${Math.max(0, v).toFixed(4)})`; });
        sp.to(on ? 1 : 0);
        V.tween({ from: on ? 26 : 0, to: on ? 0 : 26, duration: on ? 0.36 : 0.18, delay: on ? 0.1 : 0, ease: V.ease.outCubic, onUpdate: (v) => { tick.style.strokeDashoffset = v.toFixed(2); } });
        if (!on) return;
        V.tween({ duration: 0.65, ease: V.ease.outCubic, onUpdate: (v) => {
          burst.setAttribute('r', (17 + v * 11).toFixed(2));
          burst.style.opacity = ((1 - v) * 0.9).toFixed(3);
          burst.style.strokeWidth = (3 * (1 - v) + 0.2).toFixed(2);
        } });
        row.querySelectorAll('.rm-spark').forEach((s, i) => {
          const a = U.rad(+s.dataset.a);
          V.tween({ duration: 0.7, delay: 0.04 + i * 0.012, ease: V.ease.outExpo, onUpdate: (v) => {
            const r = 14 + v * 15;
            s.setAttribute('cx', (20 + Math.sin(a) * r).toFixed(2));
            s.setAttribute('cy', (20 - Math.cos(a) * r).toFixed(2));
            s.style.opacity = (v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85).toFixed(3);
            s.setAttribute('r', (1.9 * (1 - v * 0.6)).toFixed(2));
          } });
        });
      }

      render();
      ctx.on('reminders:changed', () => { clearTimeout(pending); pending = 0; render(); });
      // Fälligkeiten nachführen – aber keine laufende Abhak-Animation unterbrechen
      ctx.on('time:minute', () => { if (!pending) render(); });
      return {
        crown(dA) { list.crown(dA); },
      };
    },
  });

  V.css('reminders', `
    .rm-list { padding-top: 19cqw; padding-bottom: 30cqw;
      -webkit-mask-image: linear-gradient(to bottom, transparent 8%, #000 17%, #000 76%, transparent 91%);
      mask-image: linear-gradient(to bottom, transparent 8%, #000 17%, #000 76%, transparent 91%); }
    .rm-head { text-align: center; margin: 0 auto 4cqw; }
    .rm-count { font-size: 16cqw; font-weight: 200; letter-spacing: -.05em; line-height: 1; }
    .rm-sub { margin-top: 1.4cqw; color: ${U.rgba(COLOR, 0.88)}; }
    .rm-all { width: 15cqw; height: 15cqw; margin: 0 auto; border-radius: 50%; display: grid; place-items: center;
      background: ${COLOR}; color: #2a1500; box-shadow: 0 0 8cqw ${U.rgba(COLOR, 0.45)}; }
    .rm-all svg { width: 8cqw; height: 8cqw; stroke-width: 2.6; }
    .rm-all.empty { background: ${U.rgba(COLOR, 0.14)}; color: ${COLOR}; box-shadow: inset 0 0 0 .4cqw ${U.rgba(COLOR, 0.4)}; }
    .rm-all.empty svg { stroke-width: 2; }
    .rm-row { gap: 3.2cqw; padding-left: 3cqw; }
    .rm-check { flex: none; width: 9.6cqw; height: 9.6cqw; position: relative; }
    .rm-check svg { width: 100%; height: 100%; overflow: visible; display: block; }
    .rm-ring { fill: none; stroke: rgba(255,255,255,.34); stroke-width: 2.4; }
    .rm-row.over .rm-ring { stroke: rgba(255,107,94,.75); }
    .rm-fill { fill: ${COLOR}; transform-box: fill-box; transform-origin: center; transform: scale(0); }
    .rm-tick { fill: none; stroke: #2a1500; stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 26; stroke-dashoffset: 26; }
    .rm-burst { fill: none; stroke: ${COLOR}; stroke-width: 2; opacity: 0; }
    .rm-spark { fill: #FFD08A; opacity: 0; }
    .rm-row.done .rm-fill { transform: scale(1); }
    .rm-row.done .rm-tick { stroke-dashoffset: 0; }
    .rm-row .tx b { position: relative; display: inline-block; max-width: 100%; vertical-align: top; }
    .rm-row .tx b::after { content: ''; position: absolute; left: 0; right: 0; top: 54%; height: .28cqw; border-radius: 1cqw;
      background: currentColor; transform: scaleX(0); transform-origin: left center; transition: transform .45s var(--ease) .12s; }
    .rm-row .tx { transition: opacity .55s ease .25s; }
    .rm-row.done .tx b::after { transform: scaleX(1); }
    .rm-row.done .tx { opacity: .4; }
    .rm-row.done .rm-check { opacity: .5; transition: opacity .55s ease .25s; }
    .rm-row small { display: flex !important; align-items: center; gap: 1cqw; }
    .rm-row small span { overflow: hidden; text-overflow: ellipsis; }
    .rm-row small svg { width: 3.1cqw; height: 3.1cqw; flex: none; }
    .rm-row.over small { color: #FF6B5E; }
    .rm-row.soon small { color: #FFB340; }
    .rm-foot { display: flex; flex-direction: column; align-items: center; gap: 2.6cqw; margin-top: 6cqw; }
    .rm-new { background: ${U.rgba(COLOR, 0.2)}; color: ${COLOR}; }
    .rm-hint { font-size: 3.2cqw; line-height: 1.4; color: var(--fg3); text-align: center; }
    .rm-hint b { display: block; font-weight: 550; color: var(--fg2); white-space: nowrap; }
  `);
})();
