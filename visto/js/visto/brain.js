/* VistoOS · visto/brain.js — Verstehen und Antworten
 *
 *  1) Lokale Absichten (sofort, ohne Netz): Uhrzeit, Rechnen, Umrechnen, Einstellungen …
 *     Apps melden eigene Absichten an:
 *       V.brain.intent({ id, priority, match: [/regex/, …] | fn(t), run(m, t, original) → Antwort })
 *  2) Claude (wenn die Umgebung es anbietet): versteht alles andere und führt über
 *     V.actions registrierte Systemaktionen als Werkzeuge aus.
 *  3) Freundlicher Rückfall.
 *
 *  Antwort: String oder { say, card, emotion, open: 'appId', params: {…} }
 *    card: {type:'big', text, sub} | {type:'icon', icon, color, title, sub} | {type:'el', el}
 *
 *  Hilfen für Apps: V.brain.parseDuration(t) → Sekunden | null
 *                   V.brain.parseTime(t, {literal}) → {date: Date, h, m, rel: bool} | null  (literal: ohne „nächstes Vorkommen“)
 *                   V.brain.norm(t), V.brain.num(wort)
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const intents = [];
  const history = [];        // [{role, content}]
  let claude = null;         // sample-Funktion
  let claudeTools = false;

  /* ------------------------------------------------------- Zahlwörter */
  const UNITS = { null: 0, ein: 1, eins: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19 };
  const TENS = { zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 };
  function wordNum(w) {
    if (w in UNITS) return UNITS[w];
    if (w in TENS) return TENS[w];
    if (w === 'hundert' || w === 'einhundert') return 100;
    const m = w.match(/^(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und(zwanzig|dreißig|dreissig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)$/);
    if (m) return (m[1] === 'ein' ? 1 : UNITS[m[1]]) + TENS[m[2]];
    return null;
  }
  function norm(text) {
    let t = String(text).toLowerCase().trim();
    t = t.replace(/[„“"!?¿¡]+/g, ' ').replace(/\s+/g, ' ').replace(/[.,;:]+$/g, '').trim();
    t = t.replace(/\bhey visto\b|\bhallo visto\b|\bvisto\b,?/g, (m) => (m.startsWith('hallo') ? 'hallo' : '')).trim();
    // Zahlwörter → Ziffern (nur ganze Wörter)
    t = t.replace(/\b([a-zäöüß]+)\b/g, (w) => {
      if (w === 'ein' || w === 'eine' || w === 'einen' || w === 'einer' || w === 'einem') return w; // Artikel erst im Kontext
      const n = wordNum(w);
      return n === null ? w : String(n);
    });
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  /* ----------------------------------------------------- Zeitspannen */
  function parseDuration(text) {
    let t = norm(text).replace(/(\d),(\d)/g, '$1.$2');
    t = t.replace(/\b(eine|einen|ein|einer)\s+(stunde|minute|sekunde|viertelstunde|halbe|dreiviertelstunde)/g, '1 $2');
    let sec = 0, hit = false;
    if (/\b(1 )?halben? stunde\b/.test(t)) { sec += 1800; hit = true; t = t.replace(/\b(1 )?halben? stunde\b/, ''); }
    if (/\bdreiviertelstunde\b/.test(t)) { sec += 2700; hit = true; t = t.replace(/\bdreiviertelstunde\b/, ''); }
    if (/\bviertelstunde\b/.test(t)) { sec += 900; hit = true; t = t.replace(/\b(1 )?viertelstunde\b/, ''); }
    if (/\banderthalb stunden?\b/.test(t)) { sec += 5400; hit = true; t = t.replace(/\banderthalb stunden?\b/, ''); }
    if (/\banderthalb minuten?\b/.test(t)) { sec += 90; hit = true; t = t.replace(/\banderthalb minuten?\b/, ''); }
    const re = /(\d+(?:\.\d+)?)\s*(stunden|stunde|std\.?|h\b|minuten|minute|min\.?|m\b|sekunden|sekunde|sek\.?|s\b)(?:\s*(?:und\s*)?(?:(1\/2|halbe?)))?/g;
    let m;
    while ((m = re.exec(t))) {
      const v = parseFloat(m[1]);
      const u = m[2];
      const k = /^(stunden|stunde|std|h)/.test(u) ? 3600 : /^(minuten|minute|min|m)/.test(u) ? 60 : 1;
      sec += v * k; hit = true;
      if (m[3]) sec += k / 2;
    }
    // „5 und 30 sekunden“ etc. bewusst nicht
    if (!hit) return null;
    return Math.round(sec);
  }

  /** Uhrzeit verstehen: „um 7“, „um 7:30“, „halb acht“, „viertel nach 8“, „morgen um 6“, „in 20 minuten“ */
  function parseTime(text, o = {}) {
    const t = norm(text);
    const now = V.time.now();
    // relativ
    if (/\bin\s+\d|\bin (eine[rmn]?|1) |\bin (1 )?(halben stunde|viertelstunde)|\bin anderthalb\b/.test(t)) {
      const s = parseDuration(t.replace(/^.*?\bin\b/, '').replace(/\b(eine[rmn]?)\b/, '1'));
      if (s) { const d = new Date(now.getTime() + s * 1000); return { date: d, h: d.getHours(), m: d.getMinutes(), rel: true }; }
    }
    let h = null, mi = 0;
    let m;
    if ((m = t.match(/\b(\d{1,2})[:.](\d{2})\b/))) { h = +m[1]; mi = +m[2]; }
    else if ((m = t.match(/\bhalb (\d{1,2})\b/))) { h = (+m[1] + 23) % 24; mi = 30; }
    else if ((m = t.match(/\bviertel nach (\d{1,2})\b/))) { h = +m[1]; mi = 15; }
    else if ((m = t.match(/\bviertel vor (\d{1,2})\b/))) { h = (+m[1] + 23) % 24; mi = 45; }
    else if ((m = t.match(/\bdreiviertel (\d{1,2})\b/))) { h = (+m[1] + 23) % 24; mi = 45; }
    else if ((m = t.match(/\b(\d{1,2}) nach (\d{1,2})\b/))) { h = +m[2]; mi = +m[1]; }
    else if ((m = t.match(/\b(\d{1,2}) vor (\d{1,2})\b/))) { h = (+m[2] + 23) % 24; mi = 60 - +m[1]; }
    else if ((m = t.match(/\b(\d{1,2}) uhr(?: (\d{1,2}))?\b/))) { h = +m[1]; mi = m[2] ? +m[2] : 0; }
    else if ((m = t.match(/\bum (\d{1,2})\b/))) { h = +m[1]; }
    else if (/\bmittags?\b/.test(t)) h = 12;
    else if (/\bmitternacht\b/.test(t)) h = 0;
    if (h === null || h > 24 || mi > 59) return null;
    // Tageszeit-Hinweise
    if (/\b(abends?|nachmittags?|heute abend|morgen abend)\b/.test(t) && h < 12) h += 12;
    if (/\bnachts?\b/.test(t) && h >= 9 && h < 12) h += 12;
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setHours(h % 24, mi);
    let dayOff = 0;
    if (/(?<![a-zäöüß])übermorgen\b/.test(t)) dayOff = 2;
    else if (/\bmorgen\b/.test(t) && !/\bmorgens\b/.test(t)) dayOff = 1;
    else {
      const wd = V.fmt.WD.findIndex((w) => new RegExp('\\b' + w.toLowerCase() + '\\b').test(t));
      if (wd >= 0) { dayOff = (wd - now.getDay() + 7) % 7 || 7; }
    }
    if (dayOff) d.setDate(d.getDate() + dayOff);
    else if (d <= now && !o.literal) {
      // ohne Tagesangabe: nächstes Vorkommen. Bei „um 7“ und es ist 9 Uhr → evtl. 19 Uhr
      if (h < 12 && !/\b(morgens|früh|vormittags|weck|wecker|aufwachen)/.test(t) && d.getTime() + 12 * 3600e3 > now.getTime()) d.setHours(d.getHours() + 12);
      else d.setDate(d.getDate() + 1);
    }
    return { date: d, h: d.getHours(), m: d.getMinutes(), rel: false };
  }

  /* --------------------------------------------------------- Rechnen */
  function calc(expr) {
    let s = expr.replace(/,/g, '.').replace(/×|·/g, '*').replace(/÷|:/g, '/').replace(/\s+/g, '');
    let i = 0;
    const peek = () => s[i];
    function num() {
      const m = s.slice(i).match(/^\d+(\.\d+)?/);
      if (!m) throw new Error('Zahl erwartet');
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function atom() {
      if (peek() === '(') { i++; const v = add(); if (peek() !== ')') throw new Error(')'); i++; return v; }
      if (peek() === '-') { i++; return -atom(); }
      if (peek() === '+') { i++; return atom(); }
      if (peek() === '√') { i++; return Math.sqrt(atom()); }
      return num();
    }
    function pow() { let b = atom(); while (peek() === '^') { i++; const e = atom(); b = Math.pow(b, e); } if (peek() === '!') { i++; let f = 1; for (let k = 2; k <= b; k++) f *= k; b = f; } return b; }
    function mul() { let v = pow(); while (peek() === '*' || peek() === '/' || peek() === '%') { const o = s[i++]; const r = pow(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } return v; }
    function add() { let v = mul(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const r = mul(); v = o === '+' ? v + r : v - r; } return v; }
    const v = add();
    if (i < s.length) throw new Error('Rest');
    return v;
  }
  function mathFrom(t) {
    let e = ' ' + t + ' ';
    e = e.replace(/\b(was|wie ?viel) (ist|sind|ergibt|macht)\b|\b(rechne|berechne|ausrechnen|bitte|denn|eigentlich|ungefähr|gleich|ergibt)\b|=/g, ' ');
    e = e.replace(/\bquadratwurzel (aus|von)\b|\bwurzel (aus|von)\b/g, ' √ ');
    e = e.replace(/(\d+(?:[.,]\d+)?) ?prozent von (\d+(?:[.,]\d+)?)/g, '($1/100*$2)');
    e = e.replace(/(\d+(?:[.,]\d+)?) ?(zum )?quadrat\b/g, '($1^2)');
    e = e.replace(/(\d+(?:[.,]\d+)?) hoch (\d+(?:[.,]\d+)?)/g, '$1^$2');
    e = e.replace(/\bgeteilt durch\b|\bdividiert durch\b|\bdurch\b|\bgeteilt\b/g, '/');
    e = e.replace(/\bmal\b|\bmultipliziert mit\b|(\d)\s*x\s*(\d)/g, (m, a, b) => (a ? a + '*' + b : '*'));
    e = e.replace(/\bplus\b|\bund\b/g, '+').replace(/\bminus\b|\bweniger\b/g, '-').replace(/\bmodulo\b/g, '%').replace(/\bfakultät\b/g, '!');
    e = e.replace(/\bklammer auf\b/g, '(').replace(/\bklammer zu\b/g, ')');
    e = e.trim();
    if (!/^[\d\s.,+\-*/^%√()!]+$/.test(e)) return null;
    if (!/\d/.test(e) || !/[+\-*/^√%!]/.test(e)) return null;
    try { const v = calc(e); return isFinite(v) ? { expr: e, value: v } : null; } catch (err) { return null; }
  }

  /* ------------------------------------------------------- Umrechnen */
  const UNIT = {
    length: { mm: 0.001, millimeter: 0.001, cm: 0.01, zentimeter: 0.01, m: 1, meter: 1, km: 1000, kilometer: 1000, zoll: 0.0254, inch: 0.0254, fuß: 0.3048, fuss: 0.3048, feet: 0.3048, yard: 0.9144, meile: 1609.344, meilen: 1609.344 },
    mass: { g: 0.001, gramm: 0.001, kg: 1, kilo: 1, kilogramm: 1, pfund: 0.45359237, lb: 0.45359237, unze: 0.0283495, unzen: 0.0283495, tonne: 1000, tonnen: 1000 },
    volume: { ml: 0.001, milliliter: 0.001, l: 1, liter: 1, gallone: 3.78541, gallonen: 3.78541, tasse: 0.24, tassen: 0.24, esslöffel: 0.015, teelöffel: 0.005 },
  };
  const UNIT_NAME = { mm: 'Millimeter', cm: 'Zentimeter', m: 'Meter', km: 'Kilometer', zoll: 'Zoll', inch: 'Zoll', fuß: 'Fuß', fuss: 'Fuß', feet: 'Fuß', yard: 'Yard', meile: 'Meilen', meilen: 'Meilen', g: 'Gramm', kg: 'Kilogramm', kilo: 'Kilogramm', pfund: 'Pfund', lb: 'Pfund', unze: 'Unzen', unzen: 'Unzen', tonne: 'Tonnen', tonnen: 'Tonnen', ml: 'Milliliter', l: 'Liter', millimeter: 'Millimeter', zentimeter: 'Zentimeter', meter: 'Meter', kilometer: 'Kilometer', gramm: 'Gramm', kilogramm: 'Kilogramm', milliliter: 'Milliliter', liter: 'Liter', esslöffel: 'Esslöffel', teelöffel: 'Teelöffel', gallone: 'Gallonen', gallonen: 'Gallonen', tasse: 'Tassen', tassen: 'Tassen' };
  function convert(t) {
    let m = t.match(/(-?\d+(?:[.,]\d+)?)\s*(grad )?([a-zäöüß]+)\s+(?:sind wie viele |in |nach |zu |sind |=\s*)\s*(grad )?([a-zäöüß]+)/);
    // „Wie viele Zentimeter sind 12 Zoll?“
    const r = !m && t.match(/wie ?viele? (grad )?([a-zäöüß]+) (?:sind|ergeben|hat|haben|entsprechen) (-?\d+(?:[.,]\d+)?)\s*(grad )?([a-zäöüß]+)/);
    if (r) m = [r[0], r[3], r[4], r[5], r[1], r[2]];
    if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.'));
    const a = m[3], b = m[5];
    const temp = { celsius: 'C', c: 'C', fahrenheit: 'F', f: 'F', kelvin: 'K', k: 'K' };
    if (temp[a] && temp[b]) {
      const toC = { C: (x) => x, F: (x) => ((x - 32) * 5) / 9, K: (x) => x - 273.15 }[temp[a]](v);
      const out = { C: (x) => x, F: (x) => (x * 9) / 5 + 32, K: (x) => x + 273.15 }[temp[b]](toC);
      const nm = { C: '°C', F: '°F', K: 'K' };
      return { text: V.fmt.smart(Math.round(out * 10) / 10) + ' ' + nm[temp[b]], say: `${V.fmt.smart(v)} ${nm[temp[a]]} sind ${V.fmt.smart(Math.round(out * 10) / 10)} ${nm[temp[b]]}.` };
    }
    for (const g in UNIT) {
      const T = UNIT[g];
      if (T[a] !== undefined && T[b] !== undefined) {
        const out = (v * T[a]) / T[b];
        const r = Math.abs(out) >= 100 ? Math.round(out * 10) / 10 : Math.round(out * 1000) / 1000;
        return { text: V.fmt.smart(r) + ' ' + (UNIT_NAME[b] || b), say: `${V.fmt.smart(v)} ${UNIT_NAME[a] || a} sind ${V.fmt.smart(r)} ${UNIT_NAME[b] || b}.` };
      }
    }
    return null;
  }

  /* ---------------------------------------------------------- Inhalte */
  const JOKES = [
    'Was ist grün und klopft an die Tür? Ein Klopfsalat.',
    'Was ist ein Keks unter einem Baum? Ein schattiges Plätzchen.',
    'Sagt die Null zur Acht: Schicker Gürtel!',
    'Wie nennt man einen Bumerang, der nicht zurückkommt? Einen Stock.',
    'Warum hat das Mathebuch schlechte Laune? Es hat zu viele Probleme.',
    'Ich wollte einen Witz über Zeitreisen erzählen. Aber den fandest du gestern schon nicht lustig.',
    'Was macht eine Wolke mit Juckreiz? Sie fliegt zum Wolkenkratzer.',
    'Mein Display ist rund. Deshalb habe ich auch keine Ecken und Kanten.',
    'Treffen sich zwei Magnete. Sagt der eine: Was soll ich heute bloß anziehen?',
    'Was sitzt auf dem Baum und schreit Aha? Ein Uhu mit Sprachfehler.',
    'Warum können Geister so schlecht lügen? Weil man durch sie hindurchsieht.',
    'Was ist orange und läuft durch den Wald? Eine Wanderine.',
  ];
  let jokeI = Math.floor(Math.random() * JOKES.length);

  const COLOR_WORDS = { rot: '#FF453A', orange: '#FF9A4D', gelb: '#F5E663', grün: '#5EE6B0', mint: '#5EE6B0', türkis: '#64D2FF', blau: '#7CC8FF', lila: '#B79CFF', violett: '#B79CFF', lavendel: '#B79CFF', pink: '#FF8FD1', rosa: '#FF8FD1', weiß: '#F2F2F7', koralle: '#FF5E7A' };

  function daytimeGreeting() {
    const h = V.time.now().getHours();
    return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  }
  const nameOf = () => V.store.get('user.name', '') || '';

  /* ------------------------------------------------------ Grundabsichten */
  const brain = (V.brain = {
    norm, parseDuration, parseTime, num: wordNum, calc,
    get history() { return history; },
    get claudeReady() { return (!!claude || !!(V.claude && V.claude.configured)) && V.store.get('settings.vistoAI', true); },
    get claudeAvailable() { return !!claude || !!(V.claude && V.claude.configured); },
    get claudeSource() { return V.claude && V.claude.configured ? 'api' : claude ? 'artifact' : null; },

    intent(def) {
      def.priority = def.priority || 0;
      intents.push(def);
      intents.sort((a, b) => b.priority - a.priority);
      return def;
    },

    async ask(text, o = {}) {
      const original = String(text || '').trim();
      if (!original) return { say: 'Ich habe dich nicht verstanden.', emotion: 'confused' };
      const t = norm(original);
      remember('user', original);
      for (const it of intents) {
        let m = null;
        if (typeof it.match === 'function') m = it.match(t, original);
        else for (const re of it.match) { const r = t.match(re); if (r) { m = r; break; } }
        if (!m) continue;
        try {
          const r = await it.run(m, t, original);
          if (r) { const out = finalize(r); remember('assistant', out.say); return out; }
        } catch (e) { console.error('[VistoOS] Absicht', it.id, e); }
      }
      if (brain.claudeReady) {
        const r = V.claude && V.claude.configured ? await askClaudeAPI(original, o) : await askClaude(original, o);
        if (r) { remember('assistant', r.say); return r; }
      }
      const fb = fallback(t);
      remember('assistant', fb.say);
      return fb;
    },
  });

  function remember(role, content) {
    if (!content) return;
    history.push({ role, content: String(content).slice(0, 600) });
    while (history.length > 12) history.shift();
  }
  function finalize(r) {
    if (typeof r === 'string') return { say: r };
    return r;
  }
  function fallback(t) {
    void t;
    const tips = ['„Wie spät ist es?“', '„Stell einen Timer auf 10 Minuten“', '„Wie wird das Wetter morgen?“', '„Mach das Licht aus“', '„Was ist 18 mal 24?“', '„Erzähl mir einen Witz“'];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const ai = claude ? ' Meine KI-Antworten sind gerade ausgeschaltet.' : '';
    return { say: `Das kann ich noch nicht beantworten.${ai} Frag mich zum Beispiel ${tip}.`, emotion: 'confused' };
  }

  /* ------------------------------------------------------- Claude */
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('sample').then(async (s) => {
      if (!s) return;
      claude = s;
      try { const lim = await s.limits(); claudeTools = !!(lim && lim.tools); } catch (e) { claudeTools = false; }
      V.emit('brain:ai', true);
    }).catch(() => {});
  }

  function context() {
    const now = V.time.now();
    const st = V.shell.state();
    const lines = [
      `Jetzt: ${V.fmt.dateLong(now)} ${now.getFullYear()}, ${V.fmt.time24(now)} Uhr.`,
      `Ort: ${V.store.get('settings.location', 'Berlin')}.`,
      nameOf() ? `Die Person heißt ${nameOf()}.` : 'Der Name der Person ist unbekannt.',
      `Bildschirm: ${st.mode === 'app' ? 'App „' + (V.apps.get(st.app) || {}).name + '“ geöffnet' : st.mode === 'launcher' ? 'App-Übersicht' : 'Zifferblatt'}.`,
    ];
    const w = V.info.weather && V.safe(() => V.info.weather());
    if (w) lines.push(`Wetter gerade: ${Math.round(w.temp)} °C, ${w.text || ''}.`);
    const tm = V.info.timer && V.safe(() => V.info.timer());
    if (tm) lines.push(`Ein Timer läuft noch ${V.fmt.durationWords(tm.left)}.`);
    const apps = V.apps.list().map((a) => a.name).join(', ');
    lines.push(`Apps auf dem Gerät: ${apps}.`);
    return lines.join('\n');
  }
  const RULES = [
    'Du bist Visto, der KI-Assistent eines runden 7-Zoll-Schreibtischgeräts mit OLED-Display (Betriebssystem VistoOS).',
    'Du erscheinst als leuchtender Ring mit zwei Augen. Du bist warm, aufmerksam, ein bisschen verspielt und sehr klug.',
    'Antworte immer auf Deutsch und knapp: höchstens zwei kurze Sätze, insgesamt höchstens etwa 220 Zeichen,',
    'denn die Antwort steht auf einem runden Display und wird vorgelesen. Kein Markdown, keine Aufzählungen, keine Emojis, keine Links.',
    'Wenn eine Geräteaktion gewünscht ist (Timer, Wecker, Erinnerung, Licht, Musik, App öffnen, Einstellungen …), führe sie mit den Werkzeugen wirklich aus und bestätige kurz.',
    'Erfinde keine Live-Daten (Nachrichten, Börsenkurse). Fürs Wetter nutze das Wetter-Werkzeug, falls vorhanden.',
    'Hänge am Ende optional genau ein Gefühl in eckigen Klammern an, wenn es passt: [happy], [love], [wink], [surprised], [thinking], [sad], [confused].',
  ].join(' ');

  async function askClaude(text, o) {
    const ctl = new AbortController();
    brain._abort = () => ctl.abort();
    const msgs = [{ role: 'user', content: RULES + '\n\nKontext:\n' + context() }];
    const past = history.slice(0, -1).slice(-8);
    // abwechselnd, erste nach Regeln darf assistant sein
    for (const h of past) msgs.push({ role: h.role, content: h.content });
    msgs.push({ role: 'user', content: text });
    // Wunsch der Person: Claude Sonnet 5.5 (fällt automatisch auf die Standardstufe zurück, falls nicht verfügbar)
    const opts = { model: 'claude-sonnet-5-5', modelTier: 'default', effort: 'low', cache: false, signal: ctl.signal };
    if (o.onText) opts.onText = ({ text: tx }) => o.onText(stripTag(tx).say);
    if (claudeTools) {
      opts.tools = V.actions.ranked(text).slice(0, 64).map((a) => ({
        name: a.name.replace(/[^A-Za-z0-9_-]/g, '_'),
        description: (a.desc || a.name).slice(0, 900),
        inputSchema: { type: 'object', properties: a.params || {}, required: a.required || [] },
        execute: async (input) => {
          if (o.onTool) o.onTool(a);
          const r = await V.actions.run(a.name, input || {});
          if (r && typeof r === 'object' && r.card) brain._lastCard = r.card;
          if (r && typeof r === 'object' && r.open) { brain._lastOpen = r.open; brain._lastParams = r.params; }
          return typeof r === 'string' ? r : r && r.say ? r.say : JSON.stringify(r === undefined ? 'erledigt' : r);
        },
      }));
      delete opts.cache;
    }
    brain._lastCard = null; brain._lastOpen = null;
    try {
      const res = await claude(msgs, opts);
      const out = stripTag(res.text);
      if (brain._lastCard) out.card = brain._lastCard;
      if (brain._lastOpen) { out.open = brain._lastOpen; out.params = brain._lastParams; }
      out.ai = true;
      return out;
    } catch (e) {
      const code = e && e.code;
      if (code === 'cancelled') return { say: '', silent: true };
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') { claude = null; return null; }
      if (code === 'rate_limited') return { say: 'Ich brauche eine kurze Verschnaufpause. Versuch es gleich noch einmal.', emotion: 'sleepy' };
      if (code === 'tools_unavailable') { claudeTools = false; return askClaude(text, o); }
      if (e && e.text) return stripTag(e.text);
      return { say: 'Da ist gerade etwas schiefgelaufen. Frag mich gleich noch einmal.', emotion: 'sad' };
    }
  }
  /** Claude über den eigenen API-Schlüssel der Organisation (V.claude, offizielles SDK) */
  async function askClaudeAPI(text, o) {
    const ctl = new AbortController();
    brain._abort = () => ctl.abort();
    const msgs = [];
    for (const h of history.slice(0, -1).slice(-8)) {
      if (!msgs.length && h.role !== 'user') continue;
      const last = msgs[msgs.length - 1];
      if (last && last.role === h.role) last.content += '\n' + h.content; else msgs.push({ role: h.role, content: h.content });
    }
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'user') last.content += '\n' + text; else msgs.push({ role: 'user', content: text });
    try {
      const r = await V.claude.ask(msgs, {
        system: RULES + '\n\nKontext:\n' + context(),
        signal: ctl.signal,
        onText: (t) => o.onText && o.onText(stripTag(t).say),
        onTool: o.onTool,
      });
      const out = stripTag(r.text);
      if (!out.emotion && r.emotion) out.emotion = r.emotion;
      if (r.card) out.card = r.card;
      if (r.open) { out.open = r.open; out.params = r.params; }
      if (!out.say) out.say = 'Erledigt.';
      out.ai = true;
      return out;
    } catch (e) {
      if (e && (e.code === 'cancelled' || e.name === 'AbortError' || /abort/i.test(e.name || ''))) return { say: '', silent: true };
      const st = e && e.status;
      if (st === 401 || st === 403) return { say: 'Mein API-Schlüssel wird nicht angenommen. Bitte prüfe ihn im Emulator-Menü unter „Claude verbinden“.', emotion: 'sad' };
      if (st === 429 || st === 529) return { say: 'Claude ist gerade ausgelastet. Versuch es gleich noch einmal.', emotion: 'sleepy' };
      if (st === 400) return { say: 'Die Anfrage wurde abgelehnt. Vielleicht passt das gewählte Modell nicht zu deinem Konto.', emotion: 'confused' };
      if (/kein Schlüssel/.test(String(e && e.message))) return null;
      return { say: 'Ich erreiche Claude gerade nicht. Prüfe die Internetverbindung.', emotion: 'sad' };
    }
  }

  function stripTag(t) {
    let s = String(t || '').trim();
    let emotion;
    const m = s.match(/\[(happy|love|wink|surprised|thinking|sad|confused|sleepy)\]\s*$/i);
    if (m) { emotion = m[1].toLowerCase(); s = s.slice(0, m.index).trim(); }
    s = s.replace(/\[(happy|love|wink|surprised|thinking|sad|confused|sleepy)\]/gi, '').replace(/[*_#`]+/g, '').trim();
    return { say: s, emotion };
  }

  /* ------------------------------------------------------ Absichten */
  const I = brain.intent;

  I({ id: 'time', priority: 1, match: [/\b(wie spät|wie viel uhr|wieviel uhr|uhrzeit|welche zeit)\b/],
    run() {
      const d = V.time.now();
      return { say: `Es ist ${V.fmt.time24(d).replace(/^0(?=\d)/, '')} Uhr.`, card: { type: 'big', text: V.fmt.time(d), sub: V.fmt.dateLong(d) } };
    } });
  I({ id: 'date', priority: 1, match: [/\b(welcher tag|welches datum|datum|der wievielte|den wievielten|welchen tag haben)\b/, /(?<![a-zäöüß])(wochentag|kalenderwoche|kw)(?![a-zäöüß])/, /^was (?:ist|war) (?:heute|morgen|übermorgen|gestern|vorgestern) für (?:ein )?tag$/, /^was für (?:ein )?tag (?:ist|war|haben wir) (?:heute|morgen|übermorgen|gestern|vorgestern)$/],
    run(m, t) {
      const d = V.time.now();
      let off = 0, w = 'Heute';
      if (/(?<![a-zäöüß])übermorgen(?![a-zäöüß])/.test(t)) { off = 2; w = 'Übermorgen'; }
      else if (/(?<![a-zäöüß])morgen(?![a-zäöüß])/.test(t)) { off = 1; w = 'Morgen'; }
      else if (/(?<![a-zäöüß])vorgestern(?![a-zäöüß])/.test(t)) { off = -2; w = 'Vorgestern'; }
      else if (/(?<![a-zäöüß])gestern(?![a-zäöüß])/.test(t)) { off = -1; w = 'Gestern'; }
      d.setDate(d.getDate() + off);
      if (/kalenderwoche|(?<![a-zäöüß])kw(?![a-zäöüß])/.test(t)) {
        // ISO-Kalenderwoche
        const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
        const kw = Math.ceil(((x - Date.UTC(x.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
        return { say: off ? `${w} ${off < 0 ? 'war' : 'ist'} Kalenderwoche ${kw}.` : `Wir sind in Kalenderwoche ${kw}.`, card: { type: 'big', text: 'KW ' + kw, sub: V.fmt.weekday(d) + ', ' + d.getDate() + '. ' + V.fmt.MON[d.getMonth()] } };
      }
      return { say: `${w} ${off < 0 ? 'war' : 'ist'} ${V.fmt.weekday(d)}, der ${d.getDate()}. ${V.fmt.MON[d.getMonth()]} ${d.getFullYear()}.`, card: { type: 'big', text: String(d.getDate()), sub: V.fmt.weekday(d) + ' · ' + V.fmt.MON[d.getMonth()] } };
    } });
  I({ id: 'days-until', priority: 2, match: [/wie ?(?:viele|lange)(?: tage)? (?:sind es |ist es |dauert es )?(?:noch )?bis (?:zu )?(?:weihnachten|heiligabend|silvester|neujahr)/],
    run(m, t) {
      const now = V.time.now();
      const [name, mo, day] = /silvester/.test(t) ? ['Silvester', 11, 31] : /neujahr/.test(t) ? ['Neujahr', 0, 1] : /heiligabend/.test(t) ? ['Heiligabend', 11, 24] : ['Weihnachten', 11, 24];
      const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let target = new Date(now.getFullYear(), mo, day);
      if (target < d0) target = new Date(now.getFullYear() + 1, mo, day);
      const n = Math.round((target - d0) / 864e5);
      const say = n === 0 ? `Heute ist ${name}!` : n === 1 ? `Morgen ist schon ${name}.` : `Bis ${name} sind es noch ${n} Tage.`;
      return { say, card: { type: 'big', text: String(n), sub: n === 1 ? 'Tag bis ' + name : 'Tage bis ' + name }, emotion: 'happy' };
    } });
  I({ id: 'greet', priority: 0, match: [/^(hallo|hi|hey|servus|moin|grüß dich|guten (morgen|tag|abend)|na)\b/],
    run() {
      const n = nameOf();
      return { say: `${daytimeGreeting()}${n ? ', ' + n : ''}! Was kann ich für dich tun?`, emotion: 'happy' };
    } });
  I({ id: 'howareyou', priority: 2, match: [/\bwie geht'?s( dir)?\b|\bwie geht es dir\b|\balles (gut|klar)\b/],
    run() {
      const a = ['Mir geht es prima. Mein Ring leuchtet in allen Farben!', 'Bestens, danke! Und dir?', 'Hervorragend. Ich hatte einen sehr runden Tag.'];
      return { say: a[Math.floor(Math.random() * a.length)], emotion: 'happy' };
    } });
  I({ id: 'who', priority: 2, match: [/\bwer bist du\b|\bwas bist du\b|\bwie heißt du\b|\bstell dich vor\b/],
    run() { return { say: 'Ich bin Visto, dein runder Assistent für den Schreibtisch. Ich stelle Timer, beantworte Fragen und kümmere mich um dein Zuhause.', emotion: 'happy' }; } });
  I({ id: 'help', priority: 2, match: [/\bwas kannst du\b|\bhilfe\b|\bwie funktionierst du\b|\bwas geht\b/],
    run() { return { say: 'Ich kann Timer und Wecker stellen, das Wetter ansagen, Licht und Musik steuern, rechnen, umrechnen und dich erinnern. Frag einfach!', emotion: 'happy' }; } });
  I({ id: 'thanks', priority: 2, match: [/^(danke|dankeschön|vielen dank|merci|super danke|danke dir)\b/],
    run() { const a = ['Gern geschehen!', 'Immer wieder gern.', 'Dafür bin ich da.']; return { say: a[Math.floor(Math.random() * a.length)], emotion: 'love' }; } });
  I({ id: 'love', priority: 3, match: [/\bich (liebe|mag) dich\b|\bdu bist (toll|super|klasse|süß|der beste|die beste)\b/],
    run() { return { say: 'Oh, danke! Ich mag dich auch sehr.', emotion: 'love' }; } });
  I({ id: 'joke', priority: 2, match: [/\bwitz\b|\bwas lustiges\b|\bbring mich zum lachen\b/],
    run() { jokeI = (jokeI + 1) % JOKES.length; return { say: JOKES[jokeI], emotion: 'wink' }; } });
  I({ id: 'meaning', priority: 3, match: [/\bsinn des lebens\b/],
    run() { return { say: 'Zweiundvierzig. Aber ich glaube, die eigentliche Frage ist noch offen.', emotion: 'wink', card: { type: 'big', text: '42', sub: 'Sinn des Lebens' } }; } });
  I({ id: 'coin', priority: 2, match: [/\bmünze\b|\bkopf oder zahl\b/],
    run() { const k = Math.random() < 0.5 ? 'Kopf' : 'Zahl'; return { say: `${k}!`, card: { type: 'big', text: k, sub: 'Münzwurf' }, emotion: 'surprised' }; } });
  I({ id: 'dice', priority: 2, match: [/\bwürfel\b|\bwürfle\b|\bwürfeln\b/],
    run() { const n = 1 + Math.floor(Math.random() * 6); return { say: `Eine ${n}.`, card: { type: 'big', text: String(n), sub: 'Gewürfelt' } }; } });
  I({ id: 'random', priority: 2, match: [/\bzufallszahl(?: zwischen (-?\d+) und (-?\d+))?\b/, /\bzufällige zahl(?: zwischen (-?\d+) und (-?\d+))?\b/],
    run(m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : 100; const n = Math.min(a, b) + Math.floor(Math.random() * (Math.abs(b - a) + 1)); return { say: `${n}.`, card: { type: 'big', text: String(n), sub: `zwischen ${a} und ${b}` } }; } });
  I({ id: 'name-set', priority: 4, match: [/\b(?:ich heiße|nenn mich|mein name ist|ich bin der|ich bin die)\s+([a-zäöüß-]{2,24})(?![a-zäöüß])/],
    run(m, t, original) {
      const raw = (original.match(/(?:heiße|nenn mich|name ist|bin der|bin die)\s+([A-Za-zÄÖÜäöüß-]{2,24})/i) || [])[1] || m[1];
      const n = raw.charAt(0).toUpperCase() + raw.slice(1);
      V.store.set('user.name', n);
      return { say: `Freut mich, ${n}! Das merke ich mir.`, emotion: 'happy' };
    } });
  I({ id: 'name-get', priority: 3, match: [/\bwie heiße ich\b|\bweißt du (wie ich heiße|meinen namen)\b/],
    run() { const n = nameOf(); return n ? { say: `Du bist ${n}. Wie könnte ich das vergessen?`, emotion: 'wink' } : { say: 'Das weiß ich noch nicht. Sag einfach: Ich heiße …', emotion: 'confused' }; } });

  I({ id: 'math', priority: 6, match: (t) => mathFrom(t),
    run(m) {
      const v = Math.round(m.value * 1e8) / 1e8;
      const s = V.fmt.smart(v);
      return { say: `Das sind ${s}.`, card: { type: 'big', text: s, sub: m.expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/\./g, ',') } };
    } });
  I({ id: 'convert', priority: 6, match: (t) => convert(t),
    run(m) { return { say: m.say, card: { type: 'big', text: m.text, sub: 'Umgerechnet' } }; } });

  I({ id: 'home', priority: 5, match: [/^(zurück|schließen|schließe( die app)?|zum zifferblatt|zeig (die )?uhr|startbildschirm|nach hause gehen)$/],
    run() { setTimeout(() => V.shell.home(), 900); return { say: 'Gern.', emotion: 'happy' }; } });

  I({ id: 'face', priority: 5, match: [/\b(zifferblatt|uhr ?design|uhrdesign|watchface)\b.*\b(wechsel|ändern|ander|nächste|neu)/, /\b(anderes|nächstes|neues) (zifferblatt|uhrdesign)\b/, /(?<![a-zäöüß])(wechsel\w*|änder\w*|tausch\w*)(?![a-zäöüß]).*(?<![a-zäöüß])(zifferblatt|uhrdesign|watchface)(?![a-zäöüß])/, /\bzeig (mir )?(die |das )?(analoguhr|analog|monolith|chronos|wortuhr|ringe|orbit|flux|stapel|nacht)\b/],
    run(m, t) {
      const list = V.faces.list();
      const named = list.find((f) => t.includes(f.name.toLowerCase()) || t.includes(f.id) || (f.id === 'analog' && /analog/.test(t)));
      setTimeout(() => { V.shell.home(); setTimeout(() => (named ? V.faces.show(named.id, { dir: 1 }) : V.faces.next(1)), 500); }, 700);
      return { say: named ? `Hier ist ${named.name}.` : 'Hier ist ein anderes Zifferblatt.', emotion: 'happy' };
    } });
  I({ id: 'color', priority: 5, match: [/\b(akzentfarbe|farbe|mach (es|alles|die uhr))\b.*\b(rot|orange|gelb|grün|mint|türkis|blau|lila|violett|lavendel|pink|rosa|weiß|koralle)(?![a-zäöüß])/, /\bmach (es|alles|die uhr) (rot|orange|gelb|grün|mint|türkis|blau|lila|violett|lavendel|pink|rosa|weiß|koralle)(?![a-zäöüß])/],
    run(m, t) {
      const w = Object.keys(COLOR_WORDS).find((k) => new RegExp('(?<![a-zäöüß])' + k + '(?![a-zäöüß])').test(t));
      V.store.set('settings.accent', COLOR_WORDS[w]);
      return { say: `Erledigt, alles leuchtet jetzt in ${w === 'weiß' ? 'Weiß' : w.charAt(0).toUpperCase() + w.slice(1)}.`, emotion: 'happy' };
    } });
  I({ id: 'brightness', priority: 5, match: [/\b(heller|dunkler|helligkeit)\b/, /(display|bildschirm).*dimm|dimm\w* (?:das |den )?(display|bildschirm)/],
    run(m, t) {
      let b = V.store.get('settings.brightness', 0.9);
      const n = t.match(/(\d{1,3}) ?(%|prozent)/) || t.match(/(?<![a-zäöüß])auf (\d{1,3})$/);
      if (n) b = +n[1] / 100;
      else if (/heller|max|voll/.test(t)) b = Math.min(1, b + 0.25);
      else if (/dunkler|min|dimm/.test(t)) b = Math.max(0.05, b - 0.25);
      b = U.clamp(b, 0.05, 1);
      V.store.set('settings.brightness', b);
      V.rim.level('Helligkeit', b, { color: '#FFD60A' });
      return { say: `Helligkeit auf ${Math.round(b * 100)} Prozent.`, card: { type: 'icon', icon: 'brightness', color: '#FFD60A', title: Math.round(b * 100) + ' %', sub: 'Helligkeit' } };
    } });
  I({ id: 'volume', priority: 5, match: [/(?<![a-zäöüß])(lauter|leiser|lautstärke|stumm|stummschalten|stummschaltung|ton aus|ton an)(?![a-zäöüß])/],
    run(m, t) {
      let v = V.store.get('settings.volume', 0.6);
      const n = t.match(/(\d{1,3}) ?(%|prozent)/) || t.match(/(?<![a-zäöüß])auf (\d{1,3})$/);
      if (n) v = +n[1] / 100;
      else if (/lauter|ton an/.test(t)) v = Math.min(1, Math.max(0.2, v + 0.2));
      else if (/leiser/.test(t)) v = Math.max(0, v - 0.2);
      else if (/stumm|ton aus/.test(t)) v = 0;
      v = U.clamp(v, 0, 1);
      V.store.set('settings.volume', v);
      V.rim.level('Lautstärke', v, { color: '#FFFFFF' });
      return { say: v === 0 ? 'Ich bin jetzt stumm.' : `Lautstärke auf ${Math.round(v * 100)} Prozent.`, card: { type: 'icon', icon: v === 0 ? 'mute' : 'volume', color: '#8E8E93', title: Math.round(v * 100) + ' %', sub: 'Lautstärke' } };
    } });
  const GOODNIGHT = /^(?:gute nacht|schlaf gut|ich geh(?:e)? (?:jetzt )?(?:schlafen|ins bett)|ich bin (?:dann )?(?:mal )?im bett)(?![a-zäöüß])/;
  I({ id: 'night', priority: 5, match: [/\bnachtmodus\b/, GOODNIGHT],
    run(m, t) {
      if (GOODNIGHT.test(t)) {
        V.store.set('settings.night', 'on');
        V.emit('visto:goodnight');
        setTimeout(() => { V.shell.home(); setTimeout(() => V.ambient.sleep(), 1500); }, 2600);
        return { say: `Gute Nacht${nameOf() ? ', ' + nameOf() : ''}. Schlaf gut, ich dimme das Licht.`, emotion: 'sleepy' };
      }
      const on = !/(?<![a-zäöüß])(aus|ausschalten|ausmachen|abschalten|beenden|beende)(?![a-zäöüß])|deaktiv/.test(t);
      V.store.set('settings.night', on ? 'on' : 'auto');
      return { say: on ? 'Nachtmodus ist an.' : 'Nachtmodus ist wieder automatisch.', emotion: on ? 'sleepy' : 'happy' };
    } });
  I({ id: 'dnd', priority: 5, match: [/\bnicht stören\b/],
    run(m, t) {
      const on = !/(?<![a-zäöüß])(aus|ausschalten|ausmachen|abschalten|beenden|beende)(?![a-zäöüß])|deaktiv/.test(t);
      V.store.set('settings.dnd', on);
      return { say: on ? 'Nicht stören ist an. Ich bleibe still.' : 'Nicht stören ist aus.', card: { type: 'icon', icon: on ? 'moon' : 'bell', color: '#5E5CE6', title: on ? 'An' : 'Aus', sub: 'Nicht stören' } };
    } });
  I({ id: 'openapp', priority: -1, match: [/(?<![a-zäöüß])(?:öffne|starte|zeig(?: mir)?|geh(?:e)? zu|wechsel(?:e)? zu|mach)\s+(?:die |den |das |mir )?(?:app )?([a-zäöüß ]{3,30}?)(?: app)?$/],
    run(m) {
      const q = m[1].trim();
      const app = V.apps.list().find((a) => q.includes(a.name.toLowerCase()) || (a.keywords || []).some((k) => q.includes(k)));
      if (!app) return null;
      return { say: `Ich öffne ${app.name}.`, open: app.id, emotion: 'happy' };
    } });

  I({ id: 'set-clock', priority: 7, match: [/\b(stell|stelle|setz|setze) (die )?(uhr|uhrzeit|systemzeit)\b/, /\buhrzeit\b.*\b(automatisch|manuell)\b/],
    run(m, t) {
      if (/automatisch|internet|richtig|zurück/.test(t)) {
        V.time.setAuto();
        return { say: `Die Uhr läuft wieder automatisch. Es ist ${V.fmt.time24(V.time.now()).replace(/^0(?=\d)/, '')} Uhr.`, card: { type: 'big', text: V.fmt.time(V.time.now()), sub: 'Automatisch' } };
      }
      if (/\b(24|zwölf|12)\b.*\bstunden/.test(t)) {
        const h24 = /24/.test(t);
        V.store.set('settings.use24h', h24);
        return { say: h24 ? 'Die Uhr zeigt jetzt 24 Stunden.' : 'Die Uhr zeigt jetzt 12 Stunden.', emotion: 'happy' };
      }
      const p = parseTime(t.replace(/\b(stell|stelle|setz|setze) (die )?(uhr|uhrzeit|systemzeit)( auf)?/, 'um'), { literal: true });
      if (!p) return { say: 'Auf welche Uhrzeit soll ich die Uhr stellen?', emotion: 'confused' };
      const d = V.time.now();
      d.setHours(p.h, p.m, 0, 0);
      V.time.setManual(d);
      return { say: `Erledigt, die Uhr steht jetzt auf ${V.fmt.time24(d).replace(/^0(?=\d)/, '')} Uhr.`, card: { type: 'big', text: V.fmt.time(d), sub: 'Manuell gestellt' }, emotion: 'happy' };
    } });

  /* Systemaktionen für Claude */
  V.actions.register('system.set_clock', {
    desc: 'Stellt die Systemuhr manuell (time als HH:MM) oder mit mode "auto" zurück auf automatisch.',
    params: { time: { type: 'string', description: 'HH:MM' }, mode: { type: 'string', enum: ['manual', 'auto'] } },
    run(a) {
      if (a.mode === 'auto' || !a.time) { V.time.setAuto(); return 'Uhr wieder automatisch.'; }
      const m = String(a.time).match(/(\d{1,2}):(\d{2})/);
      if (!m) return 'Ungültige Uhrzeit.';
      const d = V.time.now(); d.setHours(+m[1], +m[2], 0, 0); V.time.setManual(d);
      return 'Uhr gestellt auf ' + V.fmt.time(d) + '.';
    },
  });
  V.actions.register('system.open_app', {
    desc: 'Öffnet eine App auf dem Visto-Display. id ist eine der App-IDs.',
    params: { id: { type: 'string', description: 'App-ID, z. B. ' + 'timer, weather, music, home, calendar, reminders, focus, breathe, settings, stopwatch, alarm, worldclock, photos, calculator' } },
    required: ['id'],
    run(a) { const app = V.apps.get(String(a.id)); if (!app) return 'Diese App gibt es nicht.'; return { say: app.name + ' wird geöffnet.', open: app.id }; },
  });
  V.actions.register('system.set_accent', {
    desc: 'Setzt die Akzentfarbe des ganzen Systems (Ring von Visto, Zifferblatt-Akzente) als Hex. Passende Werte: Rot #FF453A, Orange #FF9A4D, Gelb #F5E663, Grün/Mint #5EE6B0, Türkis #64D2FF, Blau #7CC8FF, Lila #B79CFF, Pink #FF8FD1, Weiß #F2F2F7, Koralle #FF5E7A.',
    params: { color: { type: 'string', description: 'Farbe als Hex' } }, required: ['color'],
    run(a) { if (!/^#[0-9a-f]{6}$/i.test(a.color)) return 'Ungültige Farbe.'; V.store.set('settings.accent', a.color); return 'Akzentfarbe gesetzt.'; },
  });
  V.actions.register('system.set_brightness', {
    desc: 'Setzt die Helligkeit des Visto-Displays in Prozent (5–100). Nicht für das Licht zuhause – dafür home.light.',
    params: { percent: { type: 'number', description: 'Prozent 5–100' } }, required: ['percent'],
    run(a) { const b = U.clamp(Number(a.percent) / 100, 0.05, 1); V.store.set('settings.brightness', b); V.rim.level('Helligkeit', b, { color: '#FFD60A' }); return 'Helligkeit ' + Math.round(b * 100) + ' %.'; },
  });
  V.actions.register('system.set_volume', {
    desc: 'Setzt die Gesamtlautstärke von Visto (Stimme, Töne, Musik) in Prozent (0–100; 0 = stumm).',
    params: { percent: { type: 'number', description: 'Prozent 0–100' } }, required: ['percent'],
    run(a) { const v = U.clamp(Number(a.percent) / 100, 0, 1); V.store.set('settings.volume', v); V.rim.level('Lautstärke', v); return 'Lautstärke ' + Math.round(v * 100) + ' %.'; },
  });
  V.actions.register('system.set_face', {
    desc: 'Wechselt das Zifferblatt und zeigt es an. id: monolith (Monolith, große Ziffern), analog (Chronos, Analoguhr mit Zeigern), stack (Stapel), rings (Ringe), words (Wortuhr, Zeit in Worten), orbit (Orbit), flux (Flux), night (Nacht, gedimmt rot). Für Farben oder Optionen eines Zifferblatts face.set_option nutzen.',
    params: { id: { type: 'string' } }, required: ['id'],
    run(a) { if (!V.faces.get(a.id)) return 'Unbekanntes Zifferblatt.'; setTimeout(() => { V.shell.home(); setTimeout(() => V.faces.show(a.id, { dir: 1 }), 500); }, 1200); return 'Zifferblatt gewechselt.'; },
  });
  V.actions.register('system.night_mode', {
    desc: 'Schaltet den Nachtmodus des Displays (gedimmte, rötliche Anzeige): on = an, auto = automatisch nach Uhrzeit, off = nie. Für „Gute Nacht“ zusätzlich passend: home.scene mit name nacht.',
    params: { mode: { type: 'string', enum: ['on', 'auto', 'off'] } }, required: ['mode'],
    run(a) { V.store.set('settings.night', ['on', 'auto', 'off'].includes(a.mode) ? a.mode : 'auto'); return 'Nachtmodus: ' + a.mode; },
  });
  V.actions.register('system.do_not_disturb', {
    desc: 'Schaltet „Nicht stören“ an (true) oder aus (false).',
    params: { on: { type: 'boolean' } }, required: ['on'],
    run(a) { V.store.set('settings.dnd', !!a.on); return a.on ? 'Nicht stören an.' : 'Nicht stören aus.'; },
  });
})();
