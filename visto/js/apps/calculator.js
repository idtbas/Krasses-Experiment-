/* VistoOS · apps/calculator.js — Rechner als Wählscheibe
 *
 *  Ziffern 0–9 liegen auf dem äußeren Ring wie bei einer Telefon-Wählscheibe (unten bleibt die
 *  Lücke mit dem Fingeranschlag frei – dort wohnt Visto). Operatoren + − × ÷ = , % ⌫ C bilden den
 *  inneren Ring, die Anzeige sitzt in der Mitte und wird bei langen Zahlen weich kleiner.
 *  Tasten federn, nach jeder Ziffer läuft ein Lichtpunkt am Rand zum Fingeranschlag (wie die
 *  zurücklaufende Scheibe), „=“ lässt den Rand von unten aufleuchten und das Ergebnis rollt ein.
 *  Auswertung über V.brain.calc (sicherer Parser, kein eval).
 *  Tastatur: Ziffern, + - * / , . % Enter Rücktaste Entf/Esc.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const COLOR = '#A2845E';
  const OP = '#FF9F0A';
  const R_DIG = 400, D_DIG = 13.6;    // Ziffernring (logisch) · Tastengröße (cqw)
  const R_OPS = 240, D_OPS = 11.4;    // Operatorenring
  const GAP = 42;                      // halbe Lücke unten (Grad) – Visto-Zone frei
  const STOP = 156;                    // Fingeranschlag (Uhrwinkel)
  const digA = (i) => 180 + GAP + i * ((360 - 2 * GAP) / 9);
  const OPS = [
    { k: '÷', a: 20, t: 'op', aria: 'geteilt durch' },
    { k: '×', a: 60, t: 'op', aria: 'mal' },
    { k: '−', a: 100, t: 'op', aria: 'minus' },
    { k: '+', a: 140, t: 'op', aria: 'plus' },
    { k: '=', a: 180, t: 'eq', aria: 'gleich' },
    { k: ',', a: 220, t: 'fn', aria: 'Komma' },
    { k: '%', a: 260, t: 'fn', aria: 'Prozent' },
    { k: '⌫', a: 300, t: 'fn', aria: 'Letzte Stelle löschen', icon: 'cal-back' },
    { k: 'C', a: 340, t: 'fn', aria: 'Alles löschen' },
  ];
  V.icon.add('cal-back', '<path d="M9.2 5.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.2L3.5 12z"/><path d="M11.8 9.6l4.8 4.8M16.6 9.6l-4.8 4.8"/>');

  /* ===================================================== Rechenwerk */

  const isOp = (t) => t === '+' || t === '−' || t === '×' || t === '÷';
  const num = (raw) => (!raw || raw === '−' ? NaN : parseFloat(String(raw).replace('−', '-').replace(',', '.')));
  /** Zahl ohne Exponent für den Parser */
  function plain(v) { return v.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 }); }
  function toExpr(toks) {
    return toks.map((t) => (isOp(t) ? { '+': '+', '−': '-', '×': '*', '÷': '/' }[t] : '(' + plain(num(t)) + ')')).join('');
  }
  function evaluate(toks) {
    if (!toks.length) return NaN;
    try { return V.brain.calc(toExpr(toks)); } catch (e) { return NaN; }
  }
  /** Zahl → Eingabe (deutsch, auf 12 Stellen gerundet) */
  function rawOf(v) {
    const r = Number.isSafeInteger(v) ? v : Number(v.toPrecision(12));
    return plain(Object.is(r, -0) ? 0 : r).replace('-', '−').replace('.', ',');
  }
  /** Eingabe → Anzeige mit Tausenderpunkten */
  function fmtRaw(raw) {
    if (!raw) return '0';
    const neg = raw.startsWith('−');
    const s = neg ? raw.slice(1) : raw;
    const [i, f] = s.split(',');
    const ii = (i || (s.includes(',') ? '0' : '')).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + (ii || (neg ? '' : '0')) + (s.includes(',') ? ',' + (f || '') : '');
  }
  function fmtVal(v) {
    if (!isFinite(v)) return 'Fehler';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e15 || a < 1e-9)) {
      const [m, e] = v.toExponential(9).split('e');
      return m.replace(/\.?0+$/, '').replace('.', ',').replace('-', '−') + 'E' + e.replace('+', '').replace('-', '−');
    }
    return fmtRaw(rawOf(v));
  }
  const fmtTok = (t) => (isOp(t) ? t : fmtRaw(t));

  /** Zustand: toks = fertige Zahlen/Operatoren, entry = aktuelle Eingabe, done = Ergebnis steht */
  function fresh() { return { toks: [], entry: '', done: false, last: '', err: false }; }

  function press(st, k) {
    if (st.err && k !== 'C') { Object.assign(st, fresh()); if (k === '⌫' || k === '=' || k === '%') return 'clear'; }
    if (/^\d$/.test(k)) {
      if (st.done) Object.assign(st, fresh());
      if (st.entry.replace(/\D/g, '').length >= 15) return 'deny';
      if (st.entry === '0') st.entry = k;
      else if (st.entry === '−0') st.entry = '−' + k;
      else st.entry += k;
      return 'type';
    }
    if (k === ',') {
      if (st.done) Object.assign(st, fresh());
      if (st.entry.includes(',')) return 'deny';
      st.entry = (st.entry === '' ? '0' : st.entry === '−' ? '−0' : st.entry) + ',';
      return 'type';
    }
    if (isOp(k)) {
      if (st.done) { const r = st.entry || '0'; Object.assign(st, fresh()); st.toks = [r, k]; return 'op'; }
      if (st.entry && st.entry !== '−') { st.toks.push(st.entry.replace(/,$/, '')); st.entry = ''; st.toks.push(k); return 'op'; }
      if (st.entry === '−') {
        if (k === '−') return 'deny';
        st.entry = '';
        if (st.toks.length) st.toks[st.toks.length - 1] = k; else st.toks = ['0', k];
        return 'op';
      }
      if (!st.toks.length) { if (k === '−') { st.entry = '−'; return 'type'; } st.toks = ['0', k]; return 'op'; }
      const last = st.toks[st.toks.length - 1];
      if (k === '−' && (last === '×' || last === '÷')) { st.entry = '−'; return 'type'; }
      if (last === k) return 'deny';
      st.toks[st.toks.length - 1] = k;
      return 'op';
    }
    if (k === '=') {
      if (st.done) return 'deny';
      const toks = st.toks.slice();
      if (st.entry && st.entry !== '−') toks.push(st.entry.replace(/,$/, ''));
      while (toks.length && isOp(toks[toks.length - 1])) toks.pop();
      if (toks.length < 3) return 'deny';
      const v = evaluate(toks);
      st.last = toks.map(fmtTok).join(' ') + ' =';
      st.toks = [];
      st.done = true;
      if (!isFinite(v)) { st.err = true; st.entry = ''; return 'error'; }
      st.entry = rawOf(v);
      return 'result';
    }
    if (k === '%') {
      if (!st.entry || st.entry === '−') return 'deny';
      let x = num(st.entry);
      const last = st.toks[st.toks.length - 1];
      if (!st.done && (last === '+' || last === '−') && st.toks.length >= 2) {
        const a = evaluate(st.toks.slice(0, -1));
        x = isFinite(a) ? (a * x) / 100 : x / 100;
      } else x /= 100;
      st.entry = rawOf(x);
      return 'result';
    }
    if (k === '⌫') {
      if (st.done) { st.done = false; st.last = ''; return 'soft'; }
      if (st.entry) { st.entry = st.entry.slice(0, -1); return 'del'; }
      if (st.toks.length) { st.toks.pop(); st.entry = st.toks.pop() || ''; return 'del'; }
      return 'deny';
    }
    if (k === 'C') { const had = st.entry || st.toks.length || st.last; Object.assign(st, fresh()); return had ? 'clear' : 'deny'; }
    return 'deny';
  }

  /* ---------------------------------------------- Sprache → Rechnung */
  const NB = '(?<![a-zäöüß])', NA = '(?![a-zäöüß])';
  function exprFromText(t) {
    let e = ' ' + String(t).toLowerCase() + ' ';
    e = e.replace(new RegExp(NB + '(taschen)?rechner' + NA, 'g'), ' ');
    e = e.replace(/(\d)\s*x\s*(\d)/g, '$1*$2');
    e = e.replace(new RegExp(NB + '(geteilt durch|dividiert durch|durch|geteilt)' + NA, 'g'), '/');
    e = e.replace(new RegExp(NB + '(mal|multipliziert mit)' + NA, 'g'), '*');
    e = e.replace(new RegExp(NB + '(plus)' + NA, 'g'), '+').replace(new RegExp(NB + '(minus|weniger)' + NA, 'g'), '-');
    e = e.replace(/(\d)\s+und\s+(\d)/g, '$1+$2');
    e = e.replace(new RegExp(NB + '(öffne|öffnen|zeig|zeige|mir|im|in|den|dem|der|die|das|mit|und|dann|rechne|rechnen|berechne|tipp|tippe|gib|ein|eine|bitte|was|ist|sind|ergibt|macht|wie|viel|gleich|auf|dort|da|mal eben|kurz)' + NA, 'g'), ' ');
    e = e.replace(/[=?]/g, ' ').replace(/×|·/g, '*').replace(/÷|:/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
    e = e.replace(/^[+*/]+/, '');
    if (!e || !/\d/.test(e) || !/^[\d.,+\-*/()]+$/.test(e)) return null;
    return e;
  }
  /** Ausdruck → Zustand für die Wählscheibe (ohne Klammern) */
  function stateFromExpr(e) {
    const st = fresh();
    if (/[()]/.test(e)) {
      let v; try { v = V.brain.calc(e); } catch (err) { v = NaN; }
      if (!isFinite(v)) return null;
      st.entry = rawOf(v); st.done = true; st.last = e.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/-/g, ' − ').replace(/\./g, ',') + ' =';
      return { st, pre: true };
    }
    const parts = e.match(/\d+(?:[.,]\d+)?|[+\-*/]/g) || [];
    const toks = [];
    let sign = '';
    for (const p of parts) {
      if (/\d/.test(p)) { toks.push(sign + p.replace('.', ',')); sign = ''; }
      else if (!toks.length || isOp(toks[toks.length - 1])) { if (p === '-') sign = sign ? '' : '−'; }
      else toks.push({ '+': '+', '-': '−', '*': '×', '/': '÷' }[p]);
    }
    while (toks.length && isOp(toks[toks.length - 1])) toks.pop();
    if (!toks.length) return null;
    st.entry = toks.pop();
    st.toks = toks;
    return { st, pre: false };
  }

  /* ===================================================== App */

  const live = { inst: null };
  let pending = null;
  function request(o) {
    pending = o;
    if (live.inst && !(V.convo && V.convo.active)) live.inst.apply();
  }
  function calcSay(e) {
    const s = stateFromExpr(e);
    if (!s) return null;
    const tmp = JSON.parse(JSON.stringify(s.st));
    if (!s.pre && tmp.toks.length) press(tmp, '=');
    if (tmp.err || !tmp.entry) return { fail: true, s };
    const v = num(tmp.entry);
    return { s, value: v, text: fmtVal(v), sub: (tmp.last || '').replace(/ =$/, '') };
  }

  V.css('calculator', `
    .cal-root { background: #000; }
    .cal-deco { pointer-events: none; }
    .cal-key { position: absolute; border: 0; padding: 0; margin: 0; border-radius: 50%; display: grid; place-items: center;
      cursor: pointer; color: #fff; font-family: var(--font); line-height: 1; will-change: transform;
      transition: background .28s ease, color .28s ease, box-shadow .35s ease; -webkit-tap-highlight-color: transparent; }
    .cal-key span { pointer-events: none; display: block; transform: translateY(-.02em); }
    .cal-key svg { width: 46%; height: 46%; pointer-events: none; }
    .cal-dig { font-size: 6.3cqw; font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: -.02em;
      background: radial-gradient(circle at 50% 28%, rgba(255,255,255,.15), rgba(255,255,255,.065) 72%);
      box-shadow: inset 0 0 0 .16cqw rgba(255,255,255,.07); }
    .cal-dig.cal-down { background: rgba(255,255,255,.36); box-shadow: 0 0 4.5cqw rgba(255,255,255,.28), inset 0 0 0 .16cqw rgba(255,255,255,.3); transition: none; }
    .cal-op { font-size: 6.4cqw; font-weight: 400; color: #FFB340; background: rgba(255,159,10,.15);
      box-shadow: inset 0 0 0 .16cqw rgba(255,159,10,.16); }
    .cal-op.cal-on { background: #FF9F0A; color: #1c0e00; box-shadow: 0 0 4cqw rgba(255,159,10,.45); }
    .cal-op.cal-down { background: rgba(255,159,10,.48); transition: none; }
    .cal-eq { font-size: 6.8cqw; font-weight: 500; color: #1c0e00;
      background: radial-gradient(circle at 50% 30%, #FFC163, #FF9F0A 70%); box-shadow: 0 0 5cqw rgba(255,159,10,.35); }
    .cal-eq.cal-down { background: #FFD08A; box-shadow: 0 0 7cqw rgba(255,170,40,.7); transition: none; }
    .cal-fn { font-size: 4.9cqw; font-weight: 520; color: rgba(255,255,255,.9); background: rgba(255,255,255,.13); }
    .cal-fn.cal-down { background: rgba(255,255,255,.34); transition: none; }
    .cal-expr { position: absolute; left: 35.5cqw; right: 35.5cqw; top: 36cqw; height: 5cqw; text-align: center; white-space: nowrap; overflow: hidden;
      font-size: 3.5cqw; font-weight: 520; color: rgba(255,255,255,.42); font-variant-numeric: tabular-nums; letter-spacing: .01em;
      transition: opacity .3s; }
    .cal-main { position: absolute; left: 0; right: 0; top: 50%; height: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .cal-scaler { position: relative; transform-origin: 50% 50%; }
    .cal-line { display: flex; white-space: nowrap; font-size: 12.5cqw; font-weight: 200; letter-spacing: -.035em; line-height: 1;
      font-variant-numeric: tabular-nums; color: #fff; transform: translateY(-3%); }
    .cal-line.cal-old { position: absolute; left: 50%; top: 0; }
    .cal-ch { display: inline-block; will-change: transform, opacity; }
    .cal-prev { position: absolute; left: 33cqw; right: 33cqw; top: 58.4cqw; text-align: center; white-space: nowrap; overflow: hidden;
      font-size: 3.9cqw; font-weight: 500; color: rgba(255,179,64,.85); font-variant-numeric: tabular-nums;
      transition: opacity .35s ease, transform .45s var(--spring); }
    .cal-err { color: #FF6B62; }
  `);

  V.apps.register({
    id: 'calculator',
    name: 'Rechner',
    icon: 'calculator',
    color: COLOR,
    order: 85,
    keywords: ['rechner', 'taschenrechner', 'calculator', 'rechnen'],

    init() {
      V.actions.register('calculator.calculate', {
        desc: 'Rechnet einen Ausdruck sichtbar im Rechner aus (öffnet die App). expression z. B. "12*7+3", erlaubt: Ziffern, + - * / , . und Klammern.',
        params: { expression: { type: 'string', description: 'Rechenausdruck, z. B. 12*7+3' } },
        required: ['expression'],
        run(a) {
          const e = exprFromText(String(a.expression || ''));
          const r = e && calcSay(e);
          if (!r || r.fail) return { say: 'Das kann ich nicht ausrechnen.', emotion: 'confused', open: 'calculator' };
          request({ st: r.s.st, compute: !r.s.pre });
          return { say: `Das sind ${r.text}.`, card: { type: 'big', text: r.text, sub: r.sub }, open: 'calculator' };
        },
      });
      V.actions.register('calculator.open', {
        desc: 'Öffnet den Rechner (Wählscheibe).',
        run() { return { say: 'Hier ist der Rechner.', open: 'calculator', emotion: 'happy' }; },
      });
      V.brain.intent({
        id: 'calc-app', priority: 7,
        match: (t) => {
          const named = new RegExp(NB + '(taschen)?rechner' + NA).test(t);
          const open = V.shell.app && V.shell.app.def.id === 'calculator';
          if (!named && !open) return null;
          const e = exprFromText(t);
          const hasOp = e && /\d[+\-*/]+\(*-?\d/.test(e);
          if (named) return { e: hasOp ? e : null };
          return hasOp ? { e } : null;   // App offen: Rechnungen landen auf der Scheibe
        },
        run(m) {
          if (!m.e) return V.actions.run('calculator.open');
          return V.actions.run('calculator.calculate', { expression: m.e });
        },
      });
      V.on('convo:close', () => setTimeout(() => { if (live.inst && pending) live.inst.apply(); }, 420));
    },

    create(ctx) {
      const root = ctx.root;
      root.classList.add('cal-root');
      const data = ctx.store;
      const st = Object.assign(fresh(), data.st && typeof data.st === 'object' ? data.st : {});
      st.toks = Array.isArray(st.toks) ? st.toks.filter((t) => typeof t === 'string') : [];
      st.entry = typeof st.entry === 'string' ? st.entry : '';
      let alive = true;

      /* ---------- Zierde: Wählscheibe, Fingeranschlag, innerer Ring */
      const deco = U.svg('svg', { class: 'vos-svg cal-deco', viewBox: '0 0 1000 1000', 'aria-hidden': 'true' });
      const a0 = digA(0), a1 = digA(9) + 360;
      deco.append(
        U.svg('path', { d: V.ui.arcPath(500, 500, R_DIG, a0, a1), fill: 'none', stroke: 'rgba(255,255,255,.034)', 'stroke-width': 160, 'stroke-linecap': 'round' }),
        U.svg('path', { d: V.ui.arcPath(500, 500, R_DIG + 81, a0 + 6, a1 - 6), fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 1.4 }),
        U.svg('circle', { cx: 500, cy: 500, r: R_OPS, fill: 'none', stroke: 'rgba(255,255,255,.055)', 'stroke-width': 1.4 }),
      );
      // Fingeranschlag: kleiner Metallbügel außen hinter der 9
      const sp = V.display.pt(STOP, R_DIG + 30), ep = V.display.pt(STOP, R_DIG + 84);
      const grd = U.svg('linearGradient', { id: 'cal-stop', x1: sp.x, y1: sp.y, x2: ep.x, y2: ep.y, gradientUnits: 'userSpaceOnUse' },
        U.svg('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.55 }), U.svg('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0.16 }));
      deco.append(U.svg('defs', null, grd),
        U.svg('line', { x1: sp.x, y1: sp.y, x2: ep.x, y2: ep.y, stroke: 'url(#cal-stop)', 'stroke-width': 10, 'stroke-linecap': 'round' }),
        U.svg('circle', { cx: sp.x, cy: sp.y, r: 4.5, fill: '#fff', opacity: 0.7 }));
      root.appendChild(deco);

      /* ---------- Anzeige */
      const exprEl = U.el('div', { class: 'cal-expr' });
      const mainEl = U.el('div', { class: 'cal-main', attrs: { 'aria-live': 'polite' } });
      const scaler = U.el('div', { class: 'cal-scaler' });
      mainEl.appendChild(scaler);
      const prevEl = U.el('div', { class: 'cal-prev' });
      root.append(exprEl, mainEl, prevEl);

      /* ---------- Tasten */
      const keys = new Map();
      function makeKey(k, a, r, d, cls, aria, icon) {
        const p = V.display.pt(a, r);
        const b = U.el('button', { class: 'cal-key ' + cls, attrs: { type: 'button', 'aria-label': aria, 'data-k': k }, style: {
          left: (p.x / 10).toFixed(2) + 'cqw', top: (p.y / 10).toFixed(2) + 'cqw', width: d + 'cqw', height: d + 'cqw',
          marginLeft: -d / 2 + 'cqw', marginTop: -d / 2 + 'cqw' } });
        if (icon) b.innerHTML = V.icon(icon); else b.appendChild(U.el('span', { text: k }));
        const s = V.spring(1, { response: 0.3, bounce: 0.3 });
        s.onUpdate((v) => { b.style.transform = `scale(${v.toFixed(4)})`; });
        const down = () => { s.to(0.84, { response: 0.14, bounce: 0 }); b.classList.add('cal-down'); };
        const up = () => { s.to(1, { response: 0.45, bounce: 0.45 }); b.classList.remove('cal-down'); };
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('click', () => { if (V.shell.swallowClick) return; hit(k); });
        const key = { k, a, el: b, s, bump() { down(); setTimeout(up, 90); } };
        keys.set(k, key);
        root.appendChild(b);
        return key;
      }
      for (let i = 0; i <= 9; i++) makeKey(String(i), digA(i), R_DIG, D_DIG, 'cal-dig', 'Ziffer ' + i);
      for (const o of OPS) makeKey(o.k, o.a, R_OPS, D_OPS, 'cal-' + o.t, o.aria, o.icon);

      /* ---------- Hauptzahl: einrollen, einpassen */
      let line = null, shown = null;
      const fit = V.spring(1, { response: 0.42, bounce: 0.08 });
      fit.onUpdate((v) => { scaler.style.transform = `scale(${v.toFixed(4)})`; });
      const shake = V.spring(0, { response: 0.32, bounce: 0.55 });
      shake.onUpdate((v) => { mainEl.style.transform = `translateX(${v.toFixed(2)}cqw)`; });
      function charSpring(el, delay, from) {
        el.style.transform = `translateY(${from}%)`;
        el.style.opacity = '0';
        const s = V.spring(0, { response: 0.56, bounce: 0.16 });
        s.onUpdate((t) => {
          el.style.transform = `translateY(${((1 - t) * from).toFixed(2)}%)`;
          el.style.opacity = U.clamp(t * 1.5, 0, 1).toFixed(3);
          el.style.filter = t < 0.97 ? `blur(${((1 - t) * 0.07).toFixed(3)}em)` : '';
        });
        ctx.timeout(() => s.to(1), delay);
      }
      function setMain(text, how, err) {
        if (text === shown && how !== 'force') return;
        const old = line;
        line = U.el('div', { class: 'cal-line' + (err ? ' cal-err' : '') });
        const chars = Array.from(text).map((ch) => U.el('span', { class: 'cal-ch', text: ch }));
        chars.forEach((c) => line.appendChild(c));
        scaler.appendChild(line);
        if (old) {
          if (how === 'roll' || how === 'clear') {
            old.classList.add('cal-old');
            old.style.transform = 'translate(-50%, -3%)';
            const s = V.spring(0, { response: 0.5, bounce: 0 });
            s.onUpdate((t) => {
              old.style.transform = `translate(-50%, ${(-3 - t * 55).toFixed(2)}%)`;
              old.style.opacity = U.clamp(1 - t * 1.6, 0, 1).toFixed(3);
              old.style.filter = `blur(${(t * 0.06).toFixed(3)}em)`;
            });
            s.to(1).then(() => old.remove());
          } else old.remove();
        }
        if (how === 'roll' || how === 'clear') chars.forEach((c, i) => charSpring(c, 40 + i * 26, 60));
        else if (how === 'type' && chars.length) {
          const c = chars[chars.length - 1];
          const s = V.spring(0, { response: 0.4, bounce: 0.35 });
          s.onUpdate((t) => { c.style.transform = `scale(${(0.45 + 0.55 * t).toFixed(4)}) translateY(${((1 - t) * 18).toFixed(2)}%)`; c.style.opacity = U.clamp(t * 2, 0, 1).toFixed(3); });
          s.to(1);
        }
        shown = text;
        // einpassen: verfügbare Breite in der Mitte des inneren Rings
        const avail = root.clientWidth * 0.335;
        const w = line.offsetWidth || 1;
        const k = U.clamp(avail / w, 0.2, 1);
        if (how === 'instant') fit.set(k); else fit.to(k);
      }
      function setExpr(text) {
        exprEl.textContent = text;
        if (exprEl.scrollWidth > exprEl.clientWidth + 1) {
          const parts = text.split(' ');
          while (parts.length > 2) {
            parts.shift();
            exprEl.textContent = '… ' + parts.join(' ');
            if (exprEl.scrollWidth <= exprEl.clientWidth + 1) break;
          }
        }
      }
      let prevShown = '';
      function setPrev(text) {
        if (text === prevShown) return;
        prevShown = text;
        prevEl.textContent = text;
        prevEl.style.opacity = text ? '1' : '0';
        prevEl.style.transform = text ? 'none' : 'translateY(1.5cqw)';
      }

      /* ---------- Darstellung des Zustands */
      function render(how) {
        let main, err = false;
        if (st.err) { main = 'Fehler'; err = true; }
        else if (st.entry) {
          const v = num(st.entry), a = Math.abs(v);
          main = st.done && a && (a >= 1e15 || a < 1e-9) ? fmtVal(v) : fmtRaw(st.entry);
        }
        else if (st.toks.length) main = fmtRaw(st.toks[st.toks.length - 2] || '0');
        else main = '0';
        setMain(main, how || 'none', err);
        setExpr(st.done ? st.last : st.toks.map(fmtTok).join(' '));
        // Vorschau
        let pv = '';
        if (!st.done && st.toks.length && st.entry && st.entry !== '−') {
          const v = evaluate(st.toks.concat([st.entry.replace(/,$/, '')]));
          pv = isFinite(v) ? '= ' + fmtVal(v) : '';
        }
        setPrev(pv);
        // aktiver Operator
        const lastOp = !st.entry && !st.done && st.toks.length ? st.toks[st.toks.length - 1] : null;
        for (const o of OPS) if (o.t === 'op') keys.get(o.k).el.classList.toggle('cal-on', o.k === lastOp);
        data.st = { toks: st.toks.slice(), entry: st.entry, done: st.done, last: st.last, err: st.err };
        ctx.save();
      }

      /* ---------- Rand: Wählscheibe läuft zurück, Ergebnis leuchtet */
      let dialN = 0;
      function dialComet(a) {
        const id = 'dial' + (dialN++ % 5);
        let end = STOP;
        while (end <= a + 2) end += 360;
        const total = end - a;
        const L = Math.min(48, total);
        V.tween({ duration: 0.26 + (total / 360) * 0.5, ease: V.ease.inOutSine, onUpdate: (v) => {
          if (!alive) return;
          const head = a + total * v, tail = Math.max(a, head - L * Math.min(1, v * 4));
          ctx.rim.arc(id, { from: tail, value: Math.max(0.0008, (head - tail) / 360), color: '#FFFFFF', width: 7, r: 489, glow: 1, alpha: 0.85 * (1 - Math.pow(v, 4)), smooth: false, head: true });
        } }).promise.then(() => { if (alive) ctx.rim.remove(id); });
      }
      function rimBloom(color, dur) {
        V.tween({ duration: dur || 1.05, ease: V.ease.linear, onUpdate: (v) => {
          if (!alive) return;
          const g = V.ease.outCubic(U.clamp(v / 0.55, 0, 1));
          const a = 1 - U.smoothstep(0.45, 1, v);
          ctx.rim.arc('eq', { from: 180 - 180 * g, value: Math.max(0.001, g), color, width: 9, r: 488, glow: 1.4, alpha: a, smooth: false });
        } }).promise.then(() => { if (alive) ctx.rim.remove('eq'); });
      }

      /* ---------- Eingabe */
      function hit(k) {
        V.emit('activity');
        const key = keys.get(k);
        const r = press(st, k);
        V.haptic(r === 'deny' ? [4, 30, 4] : 5);
        if (r === 'deny') { shake.impulse(-70); return; }
        if (/^\d$/.test(k)) dialComet(key.a);
        else if (key) V.rim.pulse({ at: key.a, color: k === 'C' || k === '⌫' ? '#FFFFFF' : OP, spread: 34, duration: 0.8 });
        if (r === 'result') { render('roll'); if (k === '=') { rimBloom(OP); V.sound.play('success'); } }
        else if (r === 'error') { render('roll'); rimBloom('#FF453A', 0.9); shake.impulse(-90); V.sound.play('error'); }
        else if (r === 'clear') render('clear');
        else if (r === 'type') render('type');
        else render('none');
      }
      ctx.cleanup(() => { alive = false; });

      // Tastatur (Emulator am Rechner)
      const onKey = (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        const tg = e.target;
        if (tg && (/^(input|textarea|select)$/i.test(tg.tagName) || tg.isContentEditable)) return;
        const map = { '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', ':': '÷', ',': ',', '.': ',', '%': '%', Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C', Escape: 'C', c: 'C', C: 'C' };
        const k = /^\d$/.test(e.key) ? e.key : map[e.key];
        if (!k || !keys.has(k)) return;
        e.preventDefault();
        keys.get(k).bump();
        V.sound.play('tap');
        hit(k);
      };
      window.addEventListener('keydown', onKey);
      ctx.cleanup(() => window.removeEventListener('keydown', onKey));

      /* ---------- Wünsche aus Sprache / Aktionen */
      function apply() {
        const p = pending; pending = null;
        if (!p || !p.st) return;
        Object.assign(st, fresh(), JSON.parse(JSON.stringify(p.st)));
        render('clear');
        if (p.compute) {
          ctx.timeout(() => {
            if (!alive) return;
            const k = keys.get('=');
            k.bump();
            hit('=');
          }, 650);
        } else rimBloom(OP);
      }

      render('instant');
      if (pending) ctx.timeout(apply, 520);
      const inst = { apply };
      live.inst = inst;
      ctx.cleanup(() => { if (live.inst === inst) live.inst = null; });

      return {
        params() { apply(); },
      };
    },
  });
})();
