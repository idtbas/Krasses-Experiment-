/* VistoOS · os/faceeditor.js — Zifferblatt-Editor
 *
 *  V.faceEditor.open()  V.faceEditor.close({cancel})  V.faceEditor.isOpen
 *
 *  Öffnen (langes Drücken auf das Zifferblatt): das aktuelle Blatt schrumpft federnd auf ein Rad.
 *  Links/rechts wischen – oder am Rand drehen – rollt die Zifferblätter auf einer Kreisbahn vorbei,
 *  die Namen wandern dabei am oberen Bogen mit. „Anpassen“ öffnet Optionsseiten:
 *    Farbe   → Farbtupfer-Ring am Rand (antippen oder mit dem Finger am Rand entlangstreichen)
 *    Auswahl → Chips          Schalter → .vos-switch
 *  Jede Änderung wirkt sofort in der Vorschau. „Fertig“ (oder Sockeltaste, Antippen der Vorschau)
 *  übernimmt; vom linken Rand nach rechts wischen geht eine Ebene zurück bzw. bricht ab.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;

  const STEP = 34;                          // Grad je Zifferblatt auf dem Rad
  const RW = 960;                           // Radius des Rads (logisch)
  const C0 = { x: 500, y: 410, s: 0.64 };   // Vorschau im Karussell
  const C1 = { x: 500, y: 298, s: 0.36 };   // Vorschau beim Anpassen
  const NAME_STEP = 30;                     // Grad je Name am oberen Bogen
  const SWIPE = 560;                        // logische Einheiten je Seite beim Wischen
  const RING_FROM = 225, RING_SPAN = 270;   // Farbtupfer-Ring: von 7:30 über oben bis 4:30 Uhr
  const RING_R = 432;

  V.css('fed', `
    .fed-root { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; touch-action: none; transform-origin: 50% 50%; }
    .fed-bg { position: absolute; inset: 0; background: #000; pointer-events: none; }
    .fed-cards { position: absolute; inset: 0; pointer-events: none; }
    .fed-card { position: absolute; left: 0; top: 0; width: 100cqw; height: 100cqw; border-radius: 50%; overflow: hidden;
      background: #000; transform-origin: 50% 50%; will-change: transform, opacity; }
    .fed-card .vos-face { pointer-events: none; }
    .fed-ring { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
      box-shadow: inset 0 0 0 .6cqw rgba(255,255,255,.13); transition: box-shadow .45s ease; }
    .fed-card.on .fed-ring { box-shadow: inset 0 0 0 .6cqw rgba(255,255,255,.26); }
    .fed-root.custom .fed-card.on .fed-ring { box-shadow: inset 0 0 0 .9cqw var(--fed-acc, rgba(255,255,255,.5)); }
    .fed-layer { position: absolute; inset: 0; pointer-events: none; }
    .fed-arc { position: absolute; inset: 0; pointer-events: none; transform-origin: 50% 50%; will-change: transform, opacity; }
    .fed-row { position: absolute; left: 0; right: 0; top: 74.6cqw; display: flex; justify-content: center; align-items: center; gap: 2.6cqw;
      pointer-events: none; will-change: transform, opacity; }
    .fed-row > * { pointer-events: auto; }
    .fed-row .vos-btn { height: 11.4cqw; }
    .fed-row .fed-adj { background: rgba(255,255,255,.12); padding: 0 5.4cqw; }
    .fed-row .fed-done { padding: 0 6.4cqw; }
    .fed-page { position: absolute; left: 9cqw; right: 9cqw; top: 51cqw; height: 22cqw; display: flex; flex-wrap: wrap;
      align-content: center; justify-content: center; gap: 1.8cqw 1.8cqw; pointer-events: none; will-change: transform, opacity; }
    .fed-page.live > * { pointer-events: auto; }
    .fed-chip { position: relative; height: 9.6cqw; padding: 0 4.6cqw; font-size: 3.7cqw; font-weight: 620; border-radius: 99cqw;
      background: rgba(255,255,255,.1); color: #fff; border: 0; cursor: pointer;
      transition: transform .3s var(--spring), background .25s ease, color .25s ease, box-shadow .25s ease; }
    .fed-chip::after { content: ''; position: absolute; inset: -1cqw -.6cqw; }
    .fed-chip:active { transform: scale(.93); }
    .fed-chip.on { background: #fff; color: #000; box-shadow: 0 0 3cqw rgba(255,255,255,.18); }
    .fed-chip.big { height: 11cqw; font-size: 4cqw; padding: 0 5.4cqw; }
    .fed-toggle { display: flex; align-items: center; gap: 4cqw; height: 15cqw; padding: 0 3.4cqw 0 6.4cqw; border-radius: 99cqw;
      background: rgba(255,255,255,.08); cursor: pointer; transition: transform .3s var(--spring), background .2s; }
    .fed-toggle:active { transform: scale(.96); }
    .fed-toggle b { font-size: 4.4cqw; font-weight: 600; white-space: nowrap; }
    .fed-cname { display: flex; flex-direction: column; align-items: center; gap: 1.2cqw; text-align: center; }
    .fed-cname b { font-size: 6cqw; font-weight: 600; letter-spacing: -.015em; transition: color .3s ease; }
    .fed-cname small { font-size: 3.1cqw; font-weight: 550; color: rgba(255,255,255,.42); }
    .fed-cring { position: absolute; inset: 0; pointer-events: none; will-change: opacity, transform; transform-origin: 50% 50%; }
    .fed-cring.live .fed-cdot { pointer-events: auto; }
    .fed-cdot { position: absolute; width: 11.4cqw; height: 11.4cqw; margin: -5.7cqw 0 0 -5.7cqw; border: 0; padding: 0; border-radius: 50%;
      background: transparent; cursor: pointer; display: grid; place-items: center; pointer-events: none; }
    .fed-cdot i { display: block; width: 6.2cqw; height: 6.2cqw; border-radius: 50%; background: var(--c);
      box-shadow: inset 0 0 0 .25cqw rgba(255,255,255,.18); transition: transform .35s var(--spring), box-shadow .3s ease; }
    .fed-cdot.on i { transform: scale(1.18); box-shadow: 0 0 0 .7cqw #000, 0 0 0 1.25cqw var(--c), 0 0 4cqw var(--c); }
    .fed-cdot:active i { transform: scale(.88); }
    .fed-cdot.acc i { background: conic-gradient(from 210deg, var(--c), #fff 30%, var(--c) 60%, var(--c)); }
  `);

  let st = null;           // Zustand, solange der Editor offen ist

  /* ------------------------------------------------------------- Hilfen */
  function savedOpts(id) { return V.faces.opts(id) || {}; }
  function valueOf(S, def, key) {
    const p = S.pending[def.id];
    if (p && p[key] !== undefined) return p[key];
    return savedOpts(def.id)[key];
  }
  function colorHex(v) { return !v || v === 'accent' ? V.store.get('settings.accent', '#FF9A4D') : v; }
  function colorLabel(v) { const c = V.faces.COLORS.find((x) => x.v === v); return c ? c.label : 'Eigene'; }
  function arcName(text, o = {}) {
    const a = V.ui.arcText(Object.assign({ text, r: 461, size: 28, weight: 680, spacing: 4.6, color: 'rgba(255,255,255,.92)' }, o));
    a.el.classList.add('fed-arc');
    return a;
  }

  /* ------------------------------------------------------------- Aufbau */
  function build(S) {
    const root = U.el('div', { class: 'fed-root', attrs: { 'data-nogesture': 'all', role: 'dialog', 'aria-label': 'Zifferblatt anpassen' } });
    const bg = U.el('div', { class: 'fed-bg' });
    const cards = U.el('div', { class: 'fed-cards' });
    const names = U.el('div', { class: 'fed-layer' });
    const custom = U.el('div', { class: 'fed-layer' });
    root.append(bg, cards, names, custom);

    // Namen am Bogen (wandern beim Wischen mit)
    S.nameArcs = S.list.map((d) => { const a = arcName(d.name); names.appendChild(a.el); return a; });

    // Seitenpunkte unter dem Namen
    const dots = U.svg('svg', { class: 'vos-svg fed-arc', viewBox: '0 0 1000 1000' });
    S.dotEls = S.list.map((d, i) => {
      const p = V.display.pt((i - (S.list.length - 1) / 2) * 3.4, 418);
      const c = U.svg('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 4, fill: '#fff' });
      dots.appendChild(c);
      return c;
    });
    names.appendChild(dots);

    // Knöpfe im Karussell
    const row = U.el('div', { class: 'fed-row' });
    S.adjBtn = V.ui.button('Anpassen', { icon: 'edit', cls: 'fed-adj', onClick: () => enterCustom(S) });
    S.doneBtn = V.ui.button('Fertig', { kind: 'white', cls: 'fed-done', onClick: () => close() });
    row.append(S.adjBtn, S.doneBtn);
    root.appendChild(row);
    S.row = row;

    // Knöpfe beim Anpassen
    const row2 = U.el('div', { class: 'fed-row' });
    S.backBtn = V.ui.roundButton('back', { kind: 'sm', label: 'Zurück', onClick: () => leaveCustom(S) });
    S.backBtn.style.background = 'rgba(255,255,255,.12)';
    S.done2Btn = V.ui.button('Fertig', { kind: 'white', cls: 'fed-done', onClick: () => close() });
    row2.append(S.backBtn, S.done2Btn);
    root.appendChild(row2);
    S.row2 = row2;

    Object.assign(S, { root, bg, cards, names, custom });
    V.display.overlay.appendChild(root);
  }

  /* ---------------------------------------------- Vorschau-Karten (lazy) */
  function ensureCards(S) {
    const c = Math.round(S.pos.value);
    for (let i = 0; i < S.list.length; i++) {
      const near = Math.abs(i - S.pos.value) < 1.7 || i === c || i === S.focus;
      const card = S.cardMap.get(i);
      if (near && !card) {
        const def = S.list[i];
        const holder = U.el('div', { class: 'fed-card' });
        S.cards.appendChild(holder);
        const pv = V.faces.preview(def.id, holder, S.pending[def.id]);
        holder.appendChild(U.el('div', { class: 'fed-ring' }));
        S.cardMap.set(i, { holder, pv });
      } else if (!near && card && Math.abs(i - S.pos.value) > 2.4) {
        V.safe(() => card.pv && card.pv.destroy());
        card.holder.remove();
        S.cardMap.delete(i);
      }
    }
  }

  /* ---------------------------------------------------------- Darstellung */
  function render(S) {
    const e = U.clamp(S.enter.value, -0.05, 1.1);
    const eC = U.clamp(e, 0, 1);
    const m = U.clamp(S.modeK.value, 0, 1);
    const pos = S.pos.value;
    ensureCards(S);
    S.bg.style.opacity = U.smoothstep(0, 0.35, eC).toFixed(3);
    for (const [i, c] of S.cardMap) {
      const d = i - pos;
      const ad = Math.abs(d);
      const spread = 1 + (1 - eC) * 0.7;
      const ang = U.rad(d * STEP * spread);
      let x = 500 + RW * Math.sin(ang);
      let y = C0.y + RW * (1 - Math.cos(ang));
      let s = C0.s * (1 - 0.2 * Math.min(1.5, ad));
      let rot = d * STEP * 0.55;
      let op = U.clamp(1 - ad * 0.52, 0, 1);
      // Anpassen: nur die Mitte bleibt, rückt nach oben und wird kleiner
      if (i === S.index) { x = U.lerp(x, C1.x, m); y = U.lerp(y, C1.y, m); s = U.lerp(s, C1.s, m); rot *= 1 - m; }
      else op *= 1 - m;
      // Öffnen/Schließen: das fokussierte Blatt kommt aus der Vollansicht bzw. kehrt dorthin zurück
      if (i === S.focus) { x = U.lerp(500, x, e); y = U.lerp(500, y, e); s = U.lerp(1, s, e); rot *= eC; op = U.lerp(1, op, eC); }
      else op *= U.smoothstep(0.2, 1, eC);
      c.holder.style.transform = `translate(${((x - 500) / 10).toFixed(3)}cqw, ${((y - 500) / 10).toFixed(3)}cqw) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;
      c.holder.style.opacity = op.toFixed(3);
      c.holder.style.zIndex = String(i === S.focus ? 20 : 10 - Math.round(ad * 2));
      c.holder.style.display = op < 0.01 ? 'none' : '';
      c.holder.classList.toggle('on', i === S.index && ad < 0.5);
    }
    // Namen und Seitenpunkte
    const nameK = eC * (1 - m);
    S.nameArcs.forEach((a, j) => {
      const dj = j - pos;
      const op = U.clamp(1 - Math.abs(dj) * 1.15, 0, 1) * nameK;
      a.el.style.opacity = op.toFixed(3);
      a.el.style.transform = `rotate(${(dj * NAME_STEP + (1 - eC) * -8).toFixed(2)}deg)`;
      a.el.style.display = op < 0.01 ? 'none' : '';
    });
    S.dotEls.forEach((c, j) => {
      const w = U.clamp(1 - Math.abs(j - pos), 0, 1);
      c.setAttribute('r', (3.6 + 2.6 * w).toFixed(2));
      c.setAttribute('opacity', ((0.24 + 0.76 * w) * nameK).toFixed(3));
    });
    // Knopfreihen
    const rk = U.smoothstep(0.35, 1, eC);
    S.row.style.opacity = (rk * (1 - m)).toFixed(3);
    S.row.style.transform = `translateY(${((1 - rk) * 5 + m * 4).toFixed(2)}cqw) scale(${(0.92 + 0.08 * rk).toFixed(3)})`;
    S.row.style.visibility = rk * (1 - m) < 0.02 ? 'hidden' : '';
    S.row.style.pointerEvents = m > 0.5 || eC < 0.6 || S.closing ? 'none' : '';
    S.row2.style.opacity = (m * eC).toFixed(3);
    S.row2.style.transform = `translateY(${((1 - m) * 4).toFixed(2)}cqw)`;
    S.row2.style.visibility = m * eC < 0.02 ? 'hidden' : '';
    S.row2.style.pointerEvents = m < 0.5 || S.closing ? 'none' : '';
    S.root.classList.toggle('custom', m > 0.5);
    renderCustom(S, m * eC);
    const def = S.list[S.index];
    S.adjBtn.disabled = !(def && def.options && def.options.length);
  }

  /* ------------------------------------------------------------ Anpassen */
  function buildCustom(S) {
    destroyCustom(S);
    S.root.style.removeProperty('--fed-acc');
    const def = S.list[S.index];
    const opts = (def.options || []).slice();
    const C = { def, opts, pages: [], titles: [], rings: [], el: U.el('div', { class: 'fed-layer' }) };
    S.custom.appendChild(C.el);
    // Seitenpunkte der Optionen
    const dots = U.svg('svg', { class: 'vos-svg fed-arc', viewBox: '0 0 1000 1000' });
    C.dots = opts.map((o, i) => {
      const p = V.display.pt((i - (opts.length - 1) / 2) * 3.4, 418);
      const c = U.svg('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 4, fill: '#fff' });
      dots.appendChild(c);
      return c;
    });
    opts.forEach((op, j) => {
      const t = arcName(op.label);
      C.el.appendChild(t.el);
      C.titles.push(t);
      const page = U.el('div', { class: 'fed-page' });
      C.el.appendChild(page);
      const P = { op, page, ring: null, refresh: null };
      if (op.type === 'color') buildColorPage(S, C, P);
      else if (op.type === 'choice') buildChoicePage(S, C, P);
      else buildTogglePage(S, C, P);
      C.pages.push(P);
    });
    C.el.appendChild(dots);
    S.C = C;
    S.optPos.set(0);
    S.optIdx = 0;
    return C;
  }
  function destroyCustom(S) {
    if (S.C) { S.C.el.remove(); S.C = null; }
  }

  function setValue(S, def, key, v) {
    const p = (S.pending[def.id] = S.pending[def.id] || {});
    if (p[key] === v && valueOf(S, def, key) === v) return;
    p[key] = v;
    const card = S.cardMap.get(S.index);
    if (card && card.pv) V.safe(() => card.pv.setOptions(p));
    if (S.C) S.C.pages.forEach((P) => P.refresh && P.refresh());
    V.haptic(5);
  }

  function buildColorPage(S, C, P) {
    const def = C.def, key = P.op.key;
    const cols = V.faces.COLORS;
    const ring = U.el('div', { class: 'fed-cring' });
    const n = cols.length;
    P.dotEls = cols.map((c, i) => {
      const a = RING_FROM + (n > 1 ? (i * RING_SPAN) / (n - 1) : 0);
      const p = V.display.pt(a, RING_R);
      const b = U.el('button', { class: 'fed-cdot' + (c.v === 'accent' ? ' acc' : ''), attrs: { type: 'button', 'aria-label': c.label },
        style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw', '--c': colorHex(c.v) } }, U.el('i'));
      V.ui.tap(b, () => setValue(S, def, key, c.v), { sound: 'tick' });
      ring.appendChild(b);
      return { b, a, v: c.v };
    });
    C.el.appendChild(ring);
    P.ring = ring;
    const nameB = U.el('b');
    const hint = U.el('small', { text: 'Tippen oder am Rand entlangstreichen' });
    P.page.appendChild(U.el('div', { class: 'fed-cname' }, nameB, hint));
    P.refresh = () => {
      const v = valueOf(S, def, key);
      P.dotEls.forEach((d) => d.b.classList.toggle('on', d.v === v));
      nameB.textContent = colorLabel(v);
      nameB.style.color = colorHex(v);
      S.root.style.setProperty('--fed-acc', U.rgba(colorHex(v), 0.85));
    };
    // Finger am Rand: nächstgelegenen Farbtupfer wählen
    P.scrub = (angle) => {
      let best = null, bd = 1e9;
      for (const d of P.dotEls) { const dd = Math.abs(U.angDiff(angle, d.a)); if (dd < bd) { bd = dd; best = d; } }
      if (best && bd < 24 && valueOf(S, def, key) !== best.v) { setValue(S, def, key, best.v); V.sound.play('tick'); }
    };
    P.refresh();
  }

  function buildChoicePage(S, C, P) {
    const def = C.def, key = P.op.key;
    const vals = P.op.values || [];
    const big = vals.length <= 3;
    P.chips = vals.map((val) => {
      const b = U.el('button', { class: 'fed-chip' + (big ? ' big' : ''), text: val.label, attrs: { type: 'button' } });
      V.ui.tap(b, () => setValue(S, def, key, val.v), { sound: 'tick' });
      P.page.appendChild(b);
      return { b, v: val.v };
    });
    P.refresh = () => {
      const v = valueOf(S, def, key);
      P.chips.forEach((c) => c.b.classList.toggle('on', String(c.v) === String(v)));
    };
    P.step = (dir) => {
      const v = valueOf(S, def, key);
      const i = Math.max(0, vals.findIndex((x) => String(x.v) === String(v)));
      const n = U.clamp(i + dir, 0, vals.length - 1);
      if (n !== i) { setValue(S, def, key, vals[n].v); V.sound.play('tick'); }
    };
    P.refresh();
  }

  function buildTogglePage(S, C, P) {
    const def = C.def, key = P.op.key;
    const sw = U.el('div', { class: 'vos-switch' });
    const row = U.el('div', { class: 'fed-toggle', attrs: { role: 'switch', 'data-tap': '1' } }, U.el('b', { text: P.op.label }), sw);
    V.ui.tap(row, () => setValue(S, def, key, !valueOf(S, def, key)));
    P.page.appendChild(row);
    P.refresh = () => {
      const on = !!valueOf(S, def, key);
      sw.classList.toggle('on', on);
      row.setAttribute('aria-checked', on ? 'true' : 'false');
    };
    P.step = (dir) => { const want = dir > 0; if (!!valueOf(S, def, key) !== want) { setValue(S, def, key, want); V.sound.play('tick'); } };
    P.refresh();
  }

  function renderCustom(S, k) {
    const C = S.C;
    if (!C) return;
    const op = S.optPos.value;
    C.el.style.opacity = k.toFixed(3);
    C.el.style.display = k < 0.01 ? 'none' : '';
    C.titles.forEach((t, j) => {
      const d = j - op;
      const o = U.clamp(1 - Math.abs(d) * 1.15, 0, 1);
      t.el.style.opacity = o.toFixed(3);
      t.el.style.transform = `rotate(${(d * NAME_STEP).toFixed(2)}deg)`;
      t.el.style.display = o < 0.01 ? 'none' : '';
    });
    C.dots.forEach((c, j) => {
      const w = U.clamp(1 - Math.abs(j - op), 0, 1);
      c.setAttribute('r', (3.6 + 2.6 * w).toFixed(2));
      c.setAttribute('opacity', (0.24 + 0.76 * w).toFixed(3));
    });
    C.pages.forEach((P, j) => {
      const d = j - op;
      const o = U.clamp(1 - Math.abs(d) * 1.35, 0, 1);
      P.page.style.opacity = o.toFixed(3);
      P.page.style.transform = `translateX(${(d * 62).toFixed(2)}cqw) scale(${(1 - Math.min(1, Math.abs(d)) * 0.08).toFixed(3)})`;
      P.page.style.display = o < 0.01 ? 'none' : '';
      const live = Math.abs(d) < 0.3 && k > 0.6;
      P.page.classList.toggle('live', live);
      if (P.ring) {
        // Farbring dreht sich beim Blättern leicht mit und blendet weich ein
        const ro = U.clamp(1 - Math.abs(d) * 1.6, 0, 1);
        P.ring.style.opacity = ro.toFixed(3);
        P.ring.style.transform = `rotate(${(-d * 24).toFixed(2)}deg) scale(${(0.94 + 0.06 * k).toFixed(3)})`;
        P.ring.style.display = ro < 0.01 ? 'none' : '';
        P.ring.classList.toggle('live', live);
      }
    });
  }

  function enterCustom(S) {
    if (!st || S.closing) return;
    const def = S.list[S.index];
    if (!def || !def.options || !def.options.length) return;
    S.pos.to(S.index);
    buildCustom(S);
    S.mode = 'custom';
    S.modeK.to(1, { response: 0.55, bounce: 0.14 });
    V.sound.play('open');
    V.haptic(8);
  }
  function leaveCustom(S) {
    if (S.mode !== 'custom') return;
    S.mode = 'carousel';
    V.sound.play('close');
    S.modeK.to(0, { response: 0.5, bounce: 0.1 }).then((done) => { if (done && S.mode === 'carousel') destroyCustom(S); });
  }

  /* --------------------------------------------------------------- Gesten */
  function settle(S, target) {
    const n = S.list.length;
    target = U.clamp(Math.round(target), 0, n - 1);
    if (target !== S.index) { S.index = target; V.haptic(4); }
    S.pos.to(target, { response: 0.5, bounce: 0.12 });
  }
  function settleOpt(S, target) {
    const n = S.C ? S.C.pages.length : 1;
    target = U.clamp(Math.round(target), 0, n - 1);
    if (target !== S.optIdx) { S.optIdx = target; V.haptic(4); }
    S.optPos.to(target, { response: 0.5, bounce: 0.1 });
  }
  function rubber(v, max) { return v < 0 ? v * 0.3 : v > max ? max + (v - max) * 0.3 : v; }

  function attachGestures(S) {
    let kind = null, start = 0, lastTick = 0, edge = false, rim = false;
    S.g = V.gesture(S.root, {
      start(p) {
        kind = null;
        V.emit('activity');
        edge = p.x0 < 115 && Math.abs(p.y0 - 500) < 330;
        rim = p.r0 > 372;
        start = S.mode === 'custom' ? S.optPos.value : S.pos.value;
        lastTick = Math.round(start);
      },
      move(p) {
        if (S.closing) return;
        if (!kind) {
          if (!p.moved) return;
          const ax = Math.abs(p.dx), ay = Math.abs(p.dy);
          const tang = Math.abs(p.dA) * (Math.PI / 180) * p.r0, radial = Math.abs(p.r - p.r0);
          if (edge && p.dx > 0 && ax > ay * 1.2) kind = 'back';
          else if (rim && tang > radial * 1.3 && tang > 14) kind = 'crown';
          else if (ax > ay * 1.05) kind = 'swipe';
          else kind = 'none';
          if (kind !== 'none') V.shell.swallowClick = true;
          if (kind === 'swipe' || kind === 'crown') { S.pos.stop(); S.optPos.stop(); }
        }
        if (kind === 'swipe') {
          if (S.mode === 'carousel') {
            const v = rubber(start - p.dx / SWIPE, S.list.length - 1);
            S.pos.set(v);
            const r = U.clamp(Math.round(v), 0, S.list.length - 1);
            if (r !== lastTick) { lastTick = r; V.sound.play('tick'); }
          } else if (S.C) {
            const v = rubber(start - p.dx / SWIPE, S.C.pages.length - 1);
            S.optPos.set(v);
            const r = U.clamp(Math.round(v), 0, S.C.pages.length - 1);
            if (r !== lastTick) { lastTick = r; V.sound.play('tick'); }
          }
        } else if (kind === 'crown') {
          if (S.mode === 'carousel') {
            // Drehen am Rand dreht das Rad (eine Seite je STEP Grad)
            const v = rubber(start + p.dA / STEP, S.list.length - 1);
            S.pos.set(v);
            const r = U.clamp(Math.round(v), 0, S.list.length - 1);
            if (r !== lastTick) { lastTick = r; V.sound.play('tick'); V.haptic(3); }
          } else if (S.C) {
            const P = S.C.pages[S.optIdx];
            if (P && P.scrub) P.scrub(p.a);
            else if (P && P.step) {
              const steps = Math.trunc(p.dA / 28) - (P._steps || 0);
              if (steps) { P._steps = (P._steps || 0) + steps; P.step(Math.sign(steps)); }
            }
          }
        } else if (kind === 'back') {
          const k = U.clamp(p.dx / 520, 0, 1);
          const e = 1 - Math.pow(1 - k, 2);
          S.backK = k;
          S.root.style.transform = `translateX(${(p.dx * 0.25 / 10).toFixed(2)}cqw) scale(${(1 - 0.12 * e).toFixed(4)})`;
          S.root.style.opacity = (1 - 0.3 * e).toFixed(3);
        }
      },
      end(p) {
        const k = kind; kind = null;
        setTimeout(() => { V.shell.swallowClick = false; }, 0);
        if (S.C) S.C.pages.forEach((P) => { P._steps = 0; });
        if (!k || k === 'none' || S.closing) return;
        if (k === 'swipe') {
          if (S.mode === 'carousel') settle(S, S.pos.value - (p.vx / SWIPE) * 0.18);
          else settleOpt(S, S.optPos.value - (p.vx / SWIPE) * 0.18);
        } else if (k === 'crown') {
          if (S.mode === 'carousel') settle(S, S.pos.value);
        } else if (k === 'back') {
          const commit = !p.cancelled && ((S.backK || 0) > 0.28 || p.vx > 650);
          const k0 = S.backK || 0;
          S.backK = 0;
          if (commit && S.mode === 'custom') { springRoot(S, k0); leaveCustom(S); }
          else if (commit) { springRoot(S, k0, true); close({ cancel: true }); }
          else springRoot(S, k0);
        }
      },
      tap(p, ev) {
        if (S.closing) return;
        const t = ev && ev.target;
        if (t && t.closest && t.closest('button, [data-tap], .fed-cdot')) return;
        if (S.mode !== 'carousel') return;
        // Antippen der Vorschau übernimmt, Antippen eines Nachbarn holt ihn in die Mitte
        const r = C0.s * 500;
        if (Math.hypot(p.x - C0.x, p.y - C0.y) < r) { V.sound.play('tap'); close(); return; }
        if (p.y > 250 && p.y < 760) {
          if (p.x > 800) settle(S, S.index + 1);
          else if (p.x < 200) settle(S, S.index - 1);
        }
      },
    }, { slop: 10 });
  }
  function springRoot(S, k0, fade) {
    V.tween({ duration: 0.34, ease: V.ease.smooth, onUpdate: (t) => {
      const k = k0 * (1 - t);
      const e = 1 - Math.pow(1 - k, 2);
      S.root.style.transform = k > 0.001 ? `translateX(${(k * 520 * 0.25 / 10).toFixed(2)}cqw) scale(${(1 - 0.12 * e).toFixed(4)})` : '';
      if (!fade) S.root.style.opacity = (1 - 0.3 * e).toFixed(3);
    } });
  }

  /* --------------------------------------------------------- Öffnen/Schließen */
  function open() {
    if (st || !V.display.overlay || !V.faces.home) return;
    if (V.shell.mode !== 'home') return;
    const list = V.faces.list();
    if (!list.length) return;
    const curId = V.faces.current;
    const index = Math.max(0, list.findIndex((d) => d.id === curId));
    const S = {
      list, index, origIndex: index, focus: index, mode: 'carousel', optIdx: 0,
      pending: {}, cardMap: new Map(), closing: false, C: null,
      pos: V.spring(index, { response: 0.5, bounce: 0.12 }),
      optPos: V.spring(0, { response: 0.5, bounce: 0.1 }),
      enter: V.spring(0, { response: 0.58, bounce: 0.16 }),
      modeK: V.spring(0, { response: 0.55, bounce: 0.12 }),
      offs: [],
    };
    st = S;
    build(S);
    attachGestures(S);
    S.offs.push(V.loop.add(() => render(S), 6));
    // Systemereignisse: Editor schließt sich, wenn etwas anderes nach vorn kommt
    S.offs.push(V.on('ambient', (on) => { if (on && st === S) close(); }));
    S.offs.push(V.on('convo:open', () => { if (st === S) close(); }));
    S.offs.push(V.on('app:open', () => { if (st === S) close({ instant: true }); }));
    S.offs.push(V.on('shell:mode', (m) => { if (st === S && m !== 'home') close({ instant: true }); }));
    render(S);
    V.sound.play('open');
    V.haptic(12);
    S.enter.to(1).then(() => {
      if (st === S && !S.closing && V.faces.home) V.faces.home.style.visibility = 'hidden';
    });
    V.emit('faceeditor', true);
  }

  function commit(S) {
    const def = S.list[S.index];
    for (const id in S.pending) {
      const p = S.pending[id];
      for (const k in p) {
        if (savedOpts(id)[k] !== p[k]) V.faces.setOpt(id, k, p[k]);
      }
    }
    if (def && V.faces.current !== def.id) V.faces.show(def.id);
    return def;
  }

  function close(o = {}) {
    const S = st;
    if (!S || S.closing) return;
    S.closing = true;
    st = null;
    // Zifferblatt wieder sichtbar machen; bei App-/Launcher-Wechsel blendet die Shell es selbst aus
    if (V.faces.home) V.faces.home.style.visibility = '';
    if (o.cancel) {
      S.index = S.origIndex;
      S.focus = S.origIndex;
      S.pos.to(S.origIndex, { response: 0.45, bounce: 0 });
    } else {
      const def = commit(S);
      S.focus = S.index;
      S.pos.to(S.index, { response: 0.45, bounce: 0 });
      if (def && !o.instant && def.id !== S.list[S.origIndex].id) V.notify.toast(def.name, 'face');
    }
    if (S.g) S.g.destroy();
    S.root.style.pointerEvents = 'none';
    V.sound.play('close');
    V.haptic(8);
    const finish = () => {
      S.offs.splice(0).forEach((f) => f());
      for (const c of S.cardMap.values()) V.safe(() => c.pv && c.pv.destroy());
      S.cardMap.clear();
      S.root.remove();
      [S.pos, S.optPos, S.enter, S.modeK].forEach((sp) => sp.stop());
      V.emit('faceeditor', false);
    };
    if (o.instant) { finish(); return; }
    S.modeK.to(0, { response: 0.45, bounce: 0 });
    S.enter.to(0, { response: 0.5, bounce: 0 }).then(finish);
  }

  V.faceEditor = {
    open,
    close,
    get isOpen() { return !!st; },
  };

  /* ------------------------------------------------------- Visto & Aktionen */
  const COLOR_WORDS = [
    [/(?<![a-zäöüß])(weiß|weiss)(?![a-zäöüß])/, '#FFFFFF'], [/(?<![a-zäöüß])(glut|orange)(?![a-zäöüß])/, '#FF9A4D'],
    [/(?<![a-zäöüß])koralle(?![a-zäöüß])/, '#FF5E7A'], [/(?<![a-zäöüß])(rosé|rose|rosa|pink)(?![a-zäöüß])/, '#FF8FD1'],
    [/(?<![a-zäöüß])(lavendel|lila|violett)(?![a-zäöüß])/, '#B79CFF'], [/(?<![a-zäöüß])(eis|eisblau|blau|hellblau)(?![a-zäöüß])/, '#7CC8FF'],
    [/(?<![a-zäöüß])(minze|mint|grün|türkis)(?![a-zäöüß])/, '#5EE6B0'], [/(?<![a-zäöüß])(zitrone|gelb)(?![a-zäöüß])/, '#F5E663'],
    [/(?<![a-zäöüß])rot(?![a-zäöüß])/, '#FF453A'], [/(?<![a-zäöüß])(akzent|akzentfarbe|systemfarbe)(?![a-zäöüß])/, 'accent'],
  ];
  function toHome() { if (V.convo && V.convo.active) V.convo.close(); if (V.shell.mode !== 'home') V.shell.home(); }
  function editLater(delay) {
    setTimeout(() => {
      toHome();
      setTimeout(() => { if (V.shell.mode === 'home' && !V.faceEditor.isOpen) open(); }, V.shell.mode === 'home' ? 350 : 900);
    }, delay);
  }
  function normValue(def, op, raw) {
    if (op.type === 'toggle') {
      if (typeof raw === 'boolean') return raw;
      return /^(1|true|an|ein|ja|on|zeigen|sichtbar)$/i.test(String(raw).trim());
    }
    if (op.type === 'color') {
      const s = String(raw).trim();
      if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
      const byLabel = V.faces.COLORS.find((c) => c.label.toLowerCase() === s.toLowerCase() || c.v === s);
      if (byLabel) return byLabel.v;
      for (const [re, v] of COLOR_WORDS) if (re.test(s.toLowerCase())) return v;
      return null;
    }
    const s = String(raw).trim().toLowerCase();
    const hit = (op.values || []).find((x) => String(x.v).toLowerCase() === s || x.label.toLowerCase() === s);
    return hit ? hit.v : null;
  }
  function applyOption(id, key, raw) {
    const def = V.faces.get(id);
    if (!def) return { ok: false, say: 'Dieses Zifferblatt kenne ich nicht.' };
    const op = (def.options || []).find((x) => x.key === key || x.label.toLowerCase() === String(key).toLowerCase());
    if (!op) return { ok: false, say: `${def.name} hat keine Einstellung „${key}“.` };
    const v = normValue(def, op, raw);
    if (v === null || v === undefined) return { ok: false, say: `Diesen Wert kennt „${op.label}“ nicht.` };
    V.faces.setOpt(def.id, op.key, v);
    let shown = v;
    if (op.type === 'toggle') shown = v ? 'an' : 'aus';
    else if (op.type === 'color') shown = colorLabel(v);
    else { const x = op.values.find((y) => y.v === v); shown = x ? x.label : v; }
    return { ok: true, def, op, v, say: `${def.name}: ${op.label} ${op.type === 'toggle' ? shown : '„' + shown + '“'}.` };
  }

  function registerVoice() {
    if (!V.brain || !V.actions) return;
    V.actions.register('face.edit', {
      desc: 'Öffnet den Zifferblatt-Editor auf dem Display (Zifferblatt auswählen und anpassen).',
      run() { editLater(1300); return { say: 'Gern – wähle dein Zifferblatt.', emotion: 'happy' }; },
    });
    V.actions.register('face.list', {
      desc: 'Listet alle Zifferblätter mit ihren Einstellungen (id, Name, Optionen und erlaubte Werte).',
      run() {
        return V.faces.list().map((d) => `${d.id} „${d.name}“: ` + (d.options || []).map((o) => `${o.key} (${o.type}${o.values ? ': ' + o.values.map((v) => v.v).join('/') : ''})`).join(', ')).join('\n');
      },
    });
    V.actions.register('face.set_option', {
      desc: 'Ändert eine Einstellung eines Zifferblatts. face = id (z. B. stack, rings, words, orbit, flux, night, monolith, analog; leer = aktuelles), key = Optionsschlüssel (siehe face.list), value = Wert (Farbe als Hex, Farbname oder "accent"; Schalter true/false).',
      params: { face: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } },
      required: ['key', 'value'],
      run(a) {
        const r = applyOption(a.face || V.faces.current, a.key, a.value);
        return r.ok ? { say: r.say, emotion: 'happy' } : r.say;
      },
    });

    // „Zifferblatt anpassen“, „Uhr bearbeiten“
    V.brain.intent({
      id: 'face-edit', priority: 6,
      match: [
        /\b(zifferblatt|zifferblätter|uhr|watchface|uhrdesign)\b.*\b(anpassen|bearbeiten|gestalten|einstellen|personalisieren|editieren|aussuchen|auswählen)\b/,
        /\b(passe?|bearbeite|gestalte|personalisiere)\b.*\b(zifferblatt|uhr)\b/,
        /\b(zifferblatt-?editor|zifferblätter zeigen|alle zifferblätter)\b/,
      ],
      run() { return V.actions.run('face.edit'); },
    });
    // „Mach das Zifferblatt mint“, „Ziffern in Lavendel“
    V.brain.intent({
      id: 'face-color', priority: 6,
      match: (t) => {
        if (!/\b(zifferblatt|ziffern|uhr ?farbe|planet)\b/.test(t)) return null;
        for (const [re, v] of COLOR_WORDS) if (re.test(t)) return { v };
        return null;
      },
      run(m) {
        const id = V.faces.current;
        const def = V.faces.get(id);
        const op = def && (def.options || []).find((o) => o.type === 'color');
        if (!op) return { say: `${def ? def.name : 'Dieses Zifferblatt'} hat keine freie Farbwahl. Sag „Zifferblatt anpassen“, dann zeige ich dir die Möglichkeiten.`, emotion: 'thinking' };
        const r = applyOption(id, op.key, m.v);
        return { say: `Erledigt – ${def.name} leuchtet jetzt in ${colorLabel(r.v)}.`, emotion: 'happy' };
      },
    });
    // „Sekundenring aus“, „Zifferblatt Stärke kräftig“, „Wortuhr Schrift Mono“
    V.brain.intent({
      id: 'face-option', priority: 6,
      match: (t) => {
        const def = V.faces.get(V.faces.current);
        if (!def || !def.options) return null;
        const onOff = /(?<![a-zäöüß])(an|ein|einschalten|anzeigen|zeigen|einblenden)$/.test(t) ? true
          : /(?<![a-zäöüß])(aus|ausschalten|ausblenden|verstecken|weg)$/.test(t) ? false : null;
        for (const op of def.options) {
          const lab = op.label.toLowerCase();
          if (op.type === 'toggle' && onOff !== null && t.includes(lab)) return { op, v: onOff };
          if (op.type === 'choice' && (t.includes('zifferblatt') || t.includes(lab) || t.includes(def.name.toLowerCase()))) {
            const hit = op.values.find((x) => new RegExp('(?<![a-zäöüß])' + x.label.toLowerCase() + '(?![a-zäöüß])').test(t));
            if (hit) return { op, v: hit.v };
          }
        }
        return null;
      },
      run(m) {
        const r = applyOption(V.faces.current, m.op.key, m.v);
        return { say: r.say, emotion: r.ok ? 'happy' : 'confused' };
      },
    });
  }
  if (V.brain) registerVoice(); else V.once('boot:ready', registerVoice);
})();
