/* VistoOS · os/setup.js — Ersteinrichtung
 *
 *  V.setup.start() → Promise   (main.js im Modus 'setup'; danach ruft main.js V.shell.enterHome())
 *  Schritte: Hallo · Ort · WLAN · Name · Zifferblatt · Akzentfarbe · Visto · Gesten · Fertig
 *  Fortschritt: dünner Bogen am Rand, wächst Schritt für Schritt. Übergänge drehen und zoomen durch den Kreis.
 *  Zurück: Knopf oben links oder vom linken Rand wischen.
 *
 *  Außerdem: V.setup.restart()   Einrichtung erneut (auch per Visto: „Richte Visto neu ein“)
 *            V.setup.gestures()  nur die Gestenanleitung („Zeig mir die Gesten“)
 *  Tests:    V.setup._goto(n | 'wifi')   V.setup.step   V.setup.isOpen
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const VCOLS = ['#46E6FF', '#6F7BFF', '#B46BFF', '#FF6FB5', '#FFB86B'];
  const CYAN = '#64D2FF';
  const RIM = 489;
  const hasConic = typeof CanvasRenderingContext2D !== 'undefined' && 'createConicGradient' in CanvasRenderingContext2D.prototype;
  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const pt = (a, r) => V.display.pt(a, r);
  const accent = () => V.store.get('settings.accent', '#FF9A4D');
  const userName = () => String(V.store.get('user.name', '') || '').trim();

  const STEPS = ['hello', 'location', 'wifi', 'name', 'face', 'accent', 'visto', 'gestures', 'done'];
  const LAST = STEPS.length - 1;

  const HELLOS = ['Hallo', 'Hello', 'Bonjour', 'Hola', 'Ciao', 'Hej', 'こんにちは', 'Olá', 'Merhaba', 'Привет', 'Ahoj', '你好', 'Hoi'];
  const CITIES = [
    { name: 'Berlin', cc: 'DE' }, { name: 'Hamburg', cc: 'DE' }, { name: 'München', cc: 'DE' }, { name: 'Köln', cc: 'DE' },
    { name: 'Frankfurt', cc: 'DE' }, { name: 'Wien', cc: 'AT' }, { name: 'Zürich', cc: 'CH' },
  ];
  // erfundene Netze; Abstand zur Mitte = Signalstärke (stark = nah)
  const NETS = [
    { name: 'Zuhause', s: 0.95, lock: true, a: 298 },
    { name: 'FRITZ!Box 7590', s: 0.76, lock: true, a: 66 },
    { name: 'Vodafone-8E2C', s: 0.57, lock: true, a: 128 },
    { name: 'Café Mondschein', s: 0.41, lock: false, a: 245 },
    { name: 'Telekom_FON', s: 0.28, lock: false, a: 12 },
  ];
  const COLORS = [
    { c: '#FF453A', n: 'Rot' }, { c: '#FF9A4D', n: 'Glut' }, { c: '#FFC53D', n: 'Bernstein' }, { c: '#F5E663', n: 'Zitrone' },
    { c: '#B8F05A', n: 'Limette' }, { c: '#5EE6B0', n: 'Minze' }, { c: '#4FD8E8', n: 'Türkis' }, { c: '#7CC8FF', n: 'Eis' },
    { c: '#3D8BFF', n: 'Blau' }, { c: '#7D7AFF', n: 'Indigo' }, { c: '#B79CFF', n: 'Lavendel' }, { c: '#FF8FD1', n: 'Rosé' },
    { c: '#F2F2F7', n: 'Weiß' },
  ];
  const DEMOS = [
    { k: 'up', t: 'Nach oben wischen', s: 'öffnet deine Apps', from: [500, 610], to: [500, 250] },
    { k: 'down', t: 'Nach unten wischen', s: 'öffnet das Kontrollzentrum', from: [500, 170], to: [500, 520] },
    { k: 'back', t: 'Vom linken Rand wischen', s: 'bringt dich zurück', from: [62, 390], to: [420, 390] },
  ];

  V.css('setup', `
.su-root{position:absolute;inset:0;border-radius:50%;overflow:hidden;background-color:#000;transition:background-color .7s ease;touch-action:none;color:#fff;font-family:var(--font);z-index:4}
.su-root.su-see{background-color:rgba(0,0,0,0)}
.su-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.su-stage{position:absolute;inset:0}
.su-scene{position:absolute;inset:0;transform-origin:50% 50%}
.su-arc{pointer-events:none}
.su-t{position:absolute;left:0;right:0;text-align:center;white-space:nowrap;pointer-events:none}
.su-h1{font-size:7.4cqw;font-weight:600;letter-spacing:-.03em;line-height:1.1}
.su-big{font-size:8.6cqw;font-weight:600;letter-spacing:-.035em;line-height:1.08}
.su-h2{font-size:5.4cqw;font-weight:600;letter-spacing:-.02em;line-height:1.15}
.su-sub{font-size:3.9cqw;font-weight:450;color:rgba(255,255,255,.58);line-height:1.36;white-space:normal;padding:0 17cqw}
.su-lbl{font-size:2.9cqw;font-weight:650;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,255,255,.46)}
.su-row{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:2.6cqw}
.su-row .vos-btn:not(.vos-round){min-width:30cqw}
.su-fade{transition:opacity .55s ease,filter .6s ease,transform .7s var(--ease)}
.su-gone{opacity:0!important;filter:blur(1.2cqw);transform:scale(.96);pointer-events:none!important}
.su-back{position:absolute;left:21.4cqw;top:21.4cqw;width:11cqw;height:11cqw;margin:-5.5cqw 0 0 -5.5cqw;border-radius:50%;border:0;padding:0;display:grid;place-items:center;
  background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);cursor:pointer;transition:opacity .4s ease,transform .35s var(--spring),background .2s;z-index:3}
.su-back svg{width:5cqw;height:5cqw;margin-left:-.4cqw}
.su-back:active{transform:scale(.88);background:rgba(255,255,255,.18)}
.su-back.su-off{opacity:0;pointer-events:none;transform:scale(.6)}

.su-hello{position:absolute;left:0;right:0;top:50%;height:26cqw;margin-top:-15cqw}
.su-hw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:200;letter-spacing:-.03em;white-space:nowrap;will-change:transform,opacity,filter}
.su-tap{top:72cqw;font-size:3.7cqw;font-weight:500;color:rgba(255,255,255,.78);animation:suBreath 2.8s ease-in-out infinite}
@keyframes suBreath{50%{opacity:.42}}

.su-hl{position:absolute;left:18cqw;right:18cqw;top:37.6cqw;height:12.8cqw;border-radius:99cqw;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 .22cqw rgba(255,255,255,.08)}
.su-hl svg{position:absolute;left:4.2cqw;top:50%;width:5cqw;height:5cqw;margin-top:-2.5cqw;color:rgba(255,255,255,.5)}
.su-cc{position:absolute;right:4.8cqw;top:50%;transform:translateY(-50%);font-size:2.7cqw;font-weight:700;letter-spacing:.14em;color:rgba(255,255,255,.42)}

.su-net{position:absolute;width:26cqw;margin-left:-13cqw;margin-top:-6.5cqw;border:0;padding:0;background:none;color:#fff;display:flex;flex-direction:column;align-items:center;gap:1.5cqw;cursor:pointer;font:inherit;transform-origin:50% 6.5cqw;opacity:0}
.su-nb{position:relative;width:13cqw;height:13cqw;border-radius:50%;display:grid;place-items:center;flex:none;
  background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.26),rgba(255,255,255,.08) 58%,rgba(255,255,255,.05));
  box-shadow:inset 0 0 0 .22cqw rgba(255,255,255,.16),0 0 5cqw rgba(100,210,255,.14);transition:background .5s ease,box-shadow .5s ease}
.su-wf{width:6.6cqw;height:6.6cqw;transition:opacity .3s}
.su-lock{position:absolute;right:-.5cqw;bottom:-.3cqw;width:4.8cqw;height:4.8cqw;border-radius:50%;background:#1d1e23;display:grid;place-items:center;box-shadow:0 0 0 .55cqw #000;transition:opacity .3s}
.su-lock svg{width:2.5cqw;height:2.5cqw;color:rgba(255,255,255,.78)}
.su-nn{font-size:3.1cqw;font-weight:560;line-height:1.16;color:rgba(255,255,255,.84);text-align:center;max-width:24cqw;white-space:normal;text-shadow:0 0 1.4cqw #000,0 0 .4cqw #000}
.su-ck{position:absolute;inset:0;margin:auto;width:7cqw;height:7cqw;opacity:0;transition:opacity .2s}
.su-ck path{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .6s var(--ease) .12s}
.su-ok .su-nb{background:radial-gradient(circle at 34% 28%,#8dffa6,#32D74B 58%,#1d9e36);box-shadow:0 0 7cqw rgba(50,215,75,.5)}
.su-ok .su-ck{opacity:1}.su-ok .su-ck path{stroke-dashoffset:0}
.su-ok .su-wf,.su-ok .su-lock{opacity:0}
.su-rc{position:absolute;left:50%;top:50%;width:12cqw;height:12cqw;margin:-6cqw 0 0 -6cqw;border-radius:50%;display:grid;place-items:center;
  background:rgba(100,210,255,.12);box-shadow:inset 0 0 0 .22cqw rgba(100,210,255,.4),0 0 6cqw rgba(100,210,255,.25);color:#a8ecff}
.su-rc svg{width:5.6cqw;height:5.6cqw}
.su-status{top:81cqw;font-size:3.6cqw;font-weight:550;color:rgba(255,255,255,.66);transition:opacity .25s ease}

.su-field{position:absolute;left:16cqw;right:16cqw;top:44cqw;height:14.5cqw;border-radius:99cqw;background:rgba(255,255,255,.08);
  box-shadow:inset 0 0 0 .22cqw rgba(255,255,255,.12);transition:box-shadow .35s ease,background .35s ease;display:block;cursor:text}
.su-field.su-focus{background:rgba(255,255,255,.11);box-shadow:inset 0 0 0 .3cqw rgba(255,255,255,.55),0 0 8cqw rgba(160,190,255,.22)}
.su-field input{position:absolute;inset:0;width:100%;height:100%;border:0;outline:0;background:transparent;color:#fff;text-align:center;
  font:420 6.4cqw/1 var(--font);letter-spacing:-.015em;padding:0 7cqw;caret-color:#fff;border-radius:99cqw;-webkit-appearance:none;appearance:none}
.su-field input::placeholder{color:rgba(255,255,255,.3)}

.su-car{position:absolute;inset:0}
.su-fi{position:absolute;left:50%;top:40cqw;width:40cqw;height:40cqw;margin:-20cqw 0 0 -20cqw;will-change:transform,opacity;cursor:pointer}
.su-fp{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#000;container-type:size;font-size:1.6cqw;pointer-events:none}
.su-fp::after{content:'';position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 .25cqw rgba(255,255,255,.13);pointer-events:none}
.su-fpi{position:absolute;inset:0;font-size:4cqw}
.su-dots{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:1.5cqw;pointer-events:none}
.su-dots i{width:1.3cqw;height:1.3cqw;border-radius:50%;background:rgba(255,255,255,.25);transition:background .3s,transform .3s}
.su-dots i.on{background:#fff;transform:scale(1.3)}
.su-dots i.ok{background:#32D74B}
.su-name{transition:opacity .18s ease}

.su-dot{position:absolute;width:11cqw;height:11cqw;margin:-5.5cqw 0 0 -5.5cqw;border-radius:50%;border:0;padding:0;cursor:pointer;
  background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.5),rgba(255,255,255,0) 52%),var(--c);
  box-shadow:inset 0 0 0 .2cqw rgba(255,255,255,.2);transition:transform .5s var(--spring),box-shadow .35s ease;animation:suPop .7s var(--spring) backwards}
.su-dot.on{transform:scale(1.22);box-shadow:0 0 0 .75cqw #000,0 0 0 1.2cqw #fff,0 0 6cqw var(--c)}
@keyframes suPop{from{opacity:0;transform:scale(.2)}}
.su-time{top:34.5cqw;font-size:19cqw;font-weight:200;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums;transition:color .45s ease,text-shadow .45s ease}
.su-cname{top:56.2cqw;font-size:4.4cqw;font-weight:600;letter-spacing:-.01em;transition:color .45s ease}

.su-chev{width:5.4cqw;height:5.4cqw;margin:1.2cqw auto 0;color:rgba(255,255,255,.7);animation:suNudge 1.5s ease-in-out infinite}
.su-chev svg{width:100%;height:100%}
@keyframes suNudge{50%{transform:translateY(1.3cqw)}}
.su-w{display:inline-block;opacity:0;filter:blur(1cqw);transform:translateY(1.2cqw);transition:opacity .45s ease,filter .5s ease,transform .65s var(--ease)}
.su-w.on{opacity:1;filter:none;transform:none}
.su-ok-t{color:#32D74B!important}
`);

  /* ------------------------------------------------------------- Hilfen */
  function palAt(f) {
    f = U.wrap(f, 1) * VCOLS.length;
    const i = Math.floor(f);
    return U.mix(VCOLS[i % VCOLS.length], VCOLS[(i + 1) % VCOLS.length], f - i);
  }
  const mcv = document.createElement('canvas').getContext('2d');
  function measure(text, weight, size = 100) {
    mcv.font = `${weight} ${size}px 'Inter Tight', system-ui, sans-serif`;
    return mcv.measureText(text).width;
  }
  function glowDot(c, x, y, r, color, alpha) {
    if (alpha <= 0.003) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(color, alpha));
    g.addColorStop(0.4, U.rgba(color, alpha * 0.3));
    g.addColorStop(1, U.rgba(color, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  /** voller Ring mit Farbverlauf; alphaFn(f) bestimmt die Helligkeit entlang des Rings */
  function conicRing(c, r, w, rot, alphaFn) {
    c.lineWidth = w;
    if (hasConic) {
      const g = c.createConicGradient(rad(rot), 500, 500);
      const n = 18;
      for (let i = 0; i <= n; i++) { const f = i / n; g.addColorStop(f, U.rgba(palAt(f), U.clamp(alphaFn(f), 0, 1))); }
      c.strokeStyle = g;
      circle(c, 500, 500, r); c.stroke();
    } else {
      const n = 60;
      for (let i = 0; i < n; i++) {
        const f = i / n;
        c.strokeStyle = U.rgba(palAt(f), U.clamp(alphaFn(f), 0, 1));
        c.beginPath(); c.arc(500, 500, r, rad(rot + f * 360), rad(rot + (f + 1 / n) * 360 + 0.5)); c.stroke();
      }
    }
  }
  function arcTitle(text) {
    const t = V.ui.arcText({ text, r: 446, size: 27, weight: 700, spacing: 5, color: 'rgba(255,255,255,.55)' });
    t.el.classList.add('su-arc');
    return t;
  }
  function waitFor(cond, maxMs) {
    return new Promise((res) => {
      const t0 = performance.now();
      const off = V.loop.add(() => { if (cond() || performance.now() - t0 > maxMs) { off(); res(); } });
    });
  }

  /* ------------------------------------------------------------- Kern */
  let S = null;
  const BUILD = {};

  function start(o = {}) {
    if (S && !S.done) return S.promise;
    if (S) teardown(S);
    const top = V.display && V.display.top;
    if (!top) return Promise.resolve();
    const root = U.el('div', { class: 'su-root', attrs: { role: 'dialog', 'aria-label': o.only ? 'Gesten' : 'Einrichtung' } });
    const cv = U.el('canvas', { class: 'su-cv' });
    const stage = U.el('div', { class: 'su-stage' });
    const backBtn = U.el('button', { class: 'su-back su-off', attrs: { type: 'button', 'aria-label': 'Zurück' }, html: V.icon('back') });
    root.append(cv, stage, backBtn);
    top.appendChild(root);
    let resolveFn;
    const promise = new Promise((r) => (resolveFn = r));
    S = {
      root, cv, c: cv.getContext('2d'), stage, backBtn, W: 0, t: 0,
      idx: -1, scene: null, old: null, mix: 1, trans: null,
      prog: V.spring(0, { response: 0.9, bounce: 0.05 }),
      vis: V.spring(0, { response: 0.7 }),
      col: '#ffffff', flash: 0, flashT: -1, zoom: 0, pulses: [],
      promise, resolve: resolveFn, offs: [], only: o.only || null, done: false, home: null,
      upd() { if (S) S.backBtn.classList.toggle('su-off', !canBack() || !!(S.scene && S.scene.ownBack)); },
    };
    const s = S;
    sizeCanvas();
    s.offs.push(V.on('display:resize', sizeCanvas));
    s.offs.push(V.loop.add(frame, 8));
    // Das System bleibt außen vor; Aktivität trotzdem melden (Ruhemodus)
    root.addEventListener('pointerdown', (e) => { e.stopPropagation(); V.emit('activity'); });
    V.ui.tap(backBtn, () => back());
    // vom linken Rand wischen = zurück
    let edge = false;
    const eg = V.gesture(root, {
      start(p) { edge = p.x0 < 95 && Math.abs(p.y0 - 500) < 340; },
      end(p) {
        if (edge && !p.cancelled && p.dx > 110 && Math.abs(p.dy) < p.dx * 0.85) {
          if (!(s.scene && s.scene.edge && V.safe(() => s.scene.edge()))) back();
        }
        edge = false;
      },
    }, { slop: 10 });
    s.offs.push(() => eg.destroy());
    if (!s.only && V.faces.home) {
      // Zifferblatt darunter ausblenden (wie die Shell bei offenen Apps): Im Visto-Schritt wird die Ebene
      // durchsichtig, damit Visto auf der Leuchtebene zu sehen ist – dahinter soll reines Schwarz liegen.
      // main.js → V.shell.enterHome() blendet es am Ende wieder ein.
      s.home = { el: V.faces.home, v: V.faces.home.style.visibility };
      V.faces.home.style.visibility = 'hidden';
    }
    if (o.fadeIn) {
      root.style.opacity = '0';
      V.tween({ duration: 0.45, ease: V.ease.outCubic, onUpdate: (v) => { root.style.opacity = v.toFixed(3); } });
    }
    go(s.only ? STEPS.indexOf(s.only) : 0, 1);
    return promise;
  }

  function sizeCanvas() {
    if (!S) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(64, Math.round(V.display.size * dpr));
    if (S.W !== W) { S.W = W; S.cv.width = S.cv.height = W; }
  }

  function canBack() {
    if (!S || S.only || S.done) return false;
    if (S.idx <= 0 || S.idx >= LAST) return false;
    return !(S.scene && S.scene.noBack && V.safe(() => S.scene.noBack()));
  }

  function settleTransition() {
    const tr = S && S.trans;
    if (!tr) return;
    S.trans = null;
    tr.sp.stop();
    tr.end();
  }

  function go(i, dir) {
    if (!S || S.done) return;
    i = U.clamp(i, 0, LAST);
    if (i === S.idx) return;
    settleTransition();
    if (dir === undefined) dir = i > S.idx ? 1 : -1;
    const prev = S.scene;
    if (prev && prev.leave) V.safe(() => prev.leave(dir));
    S.idx = i;
    const key = STEPS[i];
    let sc = null;
    try { sc = BUILD[key](dir) || null; } catch (e) { console.error('[VistoOS] Einrichtung', key, e); }
    if (!sc) sc = { el: U.el('div') };
    sc.key = key;
    sc.el.classList.add('su-scene');
    S.stage.appendChild(sc.el);
    S.old = prev; S.scene = sc; S.mix = 0;
    if (prev) prev.el.style.pointerEvents = 'none';
    S.upd();
    if (!S.only) { S.prog.to(i / LAST); S.vis.to(i === 0 ? 0 : 1); }
    V.emit('setup:step', key);
    V.haptic(6);
    const sp = V.spring(0, { response: 0.66, bounce: 0.06 });
    const el = sc.el;
    const apply = (k) => {
      const kc = U.clamp(k, 0, 1);
      if (S) S.mix = kc;
      if (prev) {
        prev.el.style.transform = `scale(${(dir > 0 ? 1 + 0.55 * kc : 1 - 0.34 * kc).toFixed(4)}) rotate(${(-12 * kc * dir).toFixed(2)}deg)`;
        prev.el.style.opacity = U.clamp(1 - kc * 1.9, 0, 1).toFixed(3);
        prev.el.style.filter = `blur(${(kc * 1.3).toFixed(2)}cqw)`;
      }
      el.style.transform = `scale(${(dir > 0 ? 0.62 + 0.38 * k : 1.5 - 0.5 * k).toFixed(4)}) rotate(${(13 * (1 - k) * dir).toFixed(2)}deg)`;
      el.style.opacity = U.clamp(k * 1.7 - 0.35, 0, 1).toFixed(3);
      const b = (1 - kc) * 1.5;
      el.style.filter = b > 0.03 ? `blur(${b.toFixed(2)}cqw)` : '';
    };
    sp.onUpdate(apply);
    apply(0);
    const end = () => {
      if (prev) { V.safe(() => prev.destroy && prev.destroy()); prev.el.remove(); }
      if (S && S.old === prev) S.old = null;
      if (S) S.mix = 1;
      el.style.transform = ''; el.style.filter = ''; el.style.opacity = '';
      if (sc.shown) V.safe(() => sc.shown());
    };
    S.trans = { sp, end };
    const s = S;
    sp.to(1).then(() => { if (s.trans && s.trans.sp === sp) { s.trans = null; end(); } });
  }

  function next() { if (S && !S.done) go(S.idx + 1, 1); }
  function back() {
    if (!S || S.done || !canBack()) return;
    if (S.scene && S.scene.back && V.safe(() => S.scene.back())) return;
    V.sound.play('close');
    go(S.idx - 1, -1);
  }
  /** Lichtimpuls am Rand (z. B. beim Tippen) */
  function pulse(at, color) { if (S) S.pulses.push({ at, color: color || '#ffffff', t: 0 }); }

  /* -------------------------------------------------------- Zeichnen */
  function frame(dt) {
    if (!S) return;
    const s = S;
    s.t += dt;
    const c = s.c, W = s.W;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, W, W);
    const k = W / 1000;
    c.setTransform(k, 0, 0, k, 0, 0);
    const list = [[s.old, 1 - s.mix], [s.scene, s.mix]];
    for (const [sc, a] of list) {
      if (!sc) continue;
      if (sc.frame) { try { sc.frame(dt, s.t); } catch (e) { console.error('[VistoOS] Einrichtung', e); } }
      if (sc.draw && a > 0.003) {
        c.save();
        try { sc.draw(c, s.t, dt, a); } catch (e) { console.error('[VistoOS] Einrichtung', e); }
        c.restore();
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    }
    drawRim(c, dt);
  }

  function drawRim(c, dt) {
    const s = S;
    const target = s.idx >= STEPS.indexOf('accent') ? accent() : '#ffffff';
    s.col = U.mix(s.col, target, Math.min(1, dt * 5));
    const col = s.col;
    const vis = s.vis.value * (1 - s.zoom);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    // Lichtimpulse
    for (let i = s.pulses.length - 1; i >= 0; i--) {
      const P = s.pulses[i];
      P.t += dt;
      const kk = P.t / 1.1;
      if (kk >= 1) { s.pulses.splice(i, 1); continue; }
      const spread = 80 * V.ease.outCubic(Math.min(1, kk * 1.3));
      const al = (1 - kk) * (1 - kk) * 0.9;
      V.rim.tail(c, 500, 500, RIM, P.at, P.at + spread, P.color, 5, 0, al);
      V.rim.tail(c, 500, 500, RIM, P.at - spread, P.at, P.color, 5, al, 0);
    }
    if (vis < 0.01 && s.flash <= 0.01) return;
    const v = U.clamp(s.prog.value, 0, 1);
    const R = RIM + s.zoom * 140;
    // Schrittmarken
    for (let i = 1; i < LAST; i++) {
      const f = i / LAST;
      const on = v >= f - 0.004;
      const p = pt(f * 360, R);
      c.globalAlpha = vis * (on ? 0.95 : 0.3);
      c.fillStyle = on ? col : '#ffffff';
      circle(c, p.x, p.y, on ? 3.4 : 2.6); c.fill();
    }
    // Fortschritt
    const boost = 1 + s.flash * 1.6;
    if (v > 0.003) {
      const a1 = v * 360;
      const full = a1 >= 359.8;
      c.strokeStyle = col;
      for (const [w, al] of [[30, 0.06], [13, 0.16], [4.4, 1]]) {
        c.globalAlpha = U.clamp(vis * al * boost, 0, 1);
        c.lineWidth = w * (1 + s.flash * 0.8);
        c.beginPath();
        if (full) c.arc(500, 500, R, 0, TAU); else c.arc(500, 500, R, rad(0), rad(a1));
        c.stroke();
      }
      if (!full) {
        const p = pt(a1, R);
        glowDot(c, p.x, p.y, 26, col, 0.5 * vis);
        c.globalAlpha = vis;
        c.fillStyle = '#ffffff';
        circle(c, p.x, p.y, 3); c.fill();
      }
    }
    // Blitz beim Schließen des Rings
    if (s.flashT >= 0) {
      s.flashT += dt;
      s.flash = Math.max(0, 1 - s.flashT / 1.1);
      const kk = U.clamp(s.flashT / 1.0, 0, 1);
      const al = Math.pow(1 - kk, 2);
      c.globalAlpha = 1;
      c.strokeStyle = U.rgba('#ffffff', 0.7 * al);
      c.lineWidth = 3;
      circle(c, 500, 500, R); c.stroke();
      // Lichtwelle läuft vom Rand nach innen und verglüht
      const r2 = R - 250 * V.ease.outCubic(kk);
      c.strokeStyle = U.rgba(col, 0.32 * Math.pow(1 - kk, 3));
      c.lineWidth = 60 * (1 - kk) + 2;
      circle(c, 500, 500, Math.max(10, r2)); c.stroke();
      if (kk >= 1 && s.flash <= 0) s.flashT = -1;
    }
    c.globalAlpha = 1;
  }

  /* ============================================================ Schritte */

  /* ---------- a) Hallo */
  BUILD.hello = () => {
    const el = U.el('div');
    const box = U.el('div', { class: 'su-hello' });
    const tap = U.el('div', { class: 'su-t su-tap', text: 'Zum Starten tippen' });
    el.append(box, tap);
    let i = 0, cur = null;
    const sizeFor = (w) => U.clamp(64 / (measure(w, 200) / 100), 8, 17.5);
    function show(word) {
      const sp = U.el('span', { class: 'su-hw', text: word, style: { fontSize: sizeFor(word).toFixed(2) + 'cqw', opacity: '0' } });
      box.appendChild(sp);
      const old = cur;
      cur = sp;
      V.tween({ duration: 1.35, ease: V.ease.smooth, delay: old ? 0.18 : 0.1, onUpdate(v) {
        sp.style.opacity = U.clamp(v * 1.3, 0, 1).toFixed(3);
        sp.style.filter = v < 0.99 ? `blur(${((1 - v) * 2.4).toFixed(2)}cqw)` : 'none';
        sp.style.letterSpacing = U.lerp(0.16, -0.03, v).toFixed(4) + 'em';
        sp.style.transform = `scale(${(0.92 + 0.08 * v).toFixed(4)})`;
      } });
      if (old) {
        V.tween({ duration: 0.85, ease: V.ease.inOutSine, onUpdate(v) {
          old.style.opacity = (1 - v).toFixed(3);
          old.style.filter = `blur(${(v * 2).toFixed(2)}cqw)`;
          old.style.transform = `scale(${(1 + 0.07 * v).toFixed(4)})`;
          old.style.letterSpacing = U.lerp(-0.03, 0.07, v).toFixed(4) + 'em';
        } }).promise.then(() => old.remove());
      }
    }
    show(HELLOS[0]);
    const iv = setInterval(() => { i = (i + 1) % HELLOS.length; show(HELLOS[i]); }, 2300);
    const g = V.gesture(el, { tap() { V.sound.play('open'); next(); } });
    return {
      el,
      draw(c, t, dt, a) {
        const rot = t * 24;
        const br = 0.84 + 0.16 * Math.sin(t * 1.3);
        const lobes = (k) => (f) => k * (0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.cos((f * 2 - t * 0.11) * TAU), 1.6));
        c.globalCompositeOperation = 'lighter';
        conicRing(c, 488, 4.6, rot, lobes(a * 0.95 * br));
        conicRing(c, 476, 22, rot, lobes(a * 0.2 * br));
        conicRing(c, 450, 74, rot, lobes(a * 0.075 * br));
      },
      destroy() { clearInterval(iv); g.destroy(); },
    };
  };

  /* ---------- b) Ort */
  BUILD.location = () => {
    const el = U.el('div');
    const title = arcTitle('Wo steht Visto?');
    let idx = Math.max(0, CITIES.findIndex((c) => c.name === V.store.get('settings.location', 'Berlin')));
    const hl = U.el('div', { class: 'su-hl', html: V.icon('location') });
    const cc = U.el('div', { class: 'su-cc', text: CITIES[idx].cc });
    hl.appendChild(cc);
    const wheel = V.ui.wheel({
      items: CITIES.map((c) => c.name), index: idx, rows: 5, itemH: 11, size: 7.2, width: '64cqw', weight: 380,
      onChange(i) { idx = i; pick(); },
    });
    Object.assign(wheel.el.style, { position: 'absolute', left: '18cqw', top: '16.5cqw' });
    const row = U.el('div', { class: 'su-row', style: { top: '73.5cqw' } }, V.ui.button('Weiter', { kind: 'white', onClick: () => { pick(); next(); } }));
    el.append(title.el, hl, wheel.el, row);
    function pick() { cc.textContent = CITIES[idx].cc; V.store.set('settings.location', CITIES[idx].name); }
    pick();
    // am Rand drehen blättert ebenfalls
    let acc = 0, rim = false;
    const g = V.gesture(el, {
      start(p) { rim = p.r0 > 395 && p.x0 > 95; acc = 0; },
      move(p) {
        if (!rim) return;
        const d = p.dA - acc;
        if (Math.abs(d) >= 15) { acc += 15 * Math.sign(d); wheel.crown(Math.sign(d)); }
      },
    }, { slop: 6 });
    let ind = idx;
    return {
      el,
      draw(c, t, dt, a) {
        // Skala am rechten Rand zeigt die Lage in der Liste
        ind += (wheel.get() - ind) * Math.min(1, dt * 10);
        const a0 = 64, a1 = 116, r = 452, n = CITIES.length;
        c.globalCompositeOperation = 'lighter';
        c.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const p = pt(U.lerp(a0, a1, i / (n - 1)), r);
          c.globalAlpha = a * 0.28;
          c.fillStyle = '#ffffff';
          circle(c, p.x, p.y, 2.6); c.fill();
        }
        const p = pt(U.lerp(a0, a1, ind / (n - 1)), r);
        glowDot(c, p.x, p.y, 28, '#ffffff', 0.35 * a);
        c.globalAlpha = a;
        c.fillStyle = '#ffffff';
        circle(c, p.x, p.y, 6); c.fill();
      },
      destroy() { g.destroy(); },
    };
  };

  /* ---------- c) WLAN */
  function wifiSvg(s) {
    const lv = s > 0.8 ? 3 : s > 0.55 ? 2 : s > 0.35 ? 1 : 0;
    const on = 'rgba(255,255,255,.96)', off = 'rgba(255,255,255,.24)';
    return `<svg class="su-wf" viewBox="0 0 24 24" fill="none" stroke-width="2.3" stroke-linecap="round" aria-hidden="true">
      <path d="M2.6 9.4a13.6 13.6 0 0 1 18.8 0" stroke="${lv >= 3 ? on : off}"/>
      <path d="M5.9 12.8a8.9 8.9 0 0 1 12.2 0" stroke="${lv >= 2 ? on : off}"/>
      <path d="M9.2 16.2a4.3 4.3 0 0 1 5.6 0" stroke="${lv >= 1 ? on : off}"/>
      <circle cx="12" cy="19.4" r="1.4" fill="${on}" stroke="none"/></svg>`;
  }
  const CHECK = '<svg class="su-ck" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.3 12.7l3.8 3.8L17.9 8.5" pathLength="1"/></svg>';

  BUILD.wifi = () => {
    const el = U.el('div');
    const title = arcTitle('WLAN');
    const rc = U.el('div', { class: 'su-rc su-fade', html: V.icon('wifi') });
    const status = U.el('div', { class: 'su-t su-status', text: 'Suche nach Netzwerken …' });
    const t0 = S.t;
    let phase = 'scan', chosen = null, tc = 0, tok = 0, lenOk = 30, curLen = 30, curHead = -30, listed = false, alive = true;
    const pings = [];
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
    const move = V.spring(0, { response: 0.62, bounce: 0.16 });
    const gone = V.spring(0, { response: 0.45 });
    const scanOff = V.spring(0, { response: 0.6 });
    const items = NETS.map((n, i) => {
      const r = 150 + (1 - n.s) * 270;
      const p = pt(n.a, r);
      const b = U.el('button', { class: 'su-net', attrs: { type: 'button', 'aria-label': 'WLAN ' + n.name }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw' } });
      const nb = U.el('div', { class: 'su-nb', html: wifiSvg(n.s) + CHECK });
      if (n.lock) nb.appendChild(U.el('div', { class: 'su-lock', html: V.icon('lock') }));
      b.append(nb, U.el('div', { class: 'su-nn', text: n.name }));
      const o = { n, el: b, x: p.x, y: p.y, r, on: false, pop: V.spring(0, { response: 0.5, bounce: 0.38 }), seed: i * 7.31 + 1 };
      V.ui.tap(b, () => connect(o));
      return o;
    });
    el.append(title.el, rc, ...items.map((o) => o.el), status);

    function setStatus(text, cls) {
      status.style.opacity = '0';
      later(() => { status.textContent = text; status.classList.toggle('su-ok-t', cls === 'ok'); status.style.opacity = '1'; }, 180);
    }
    function connect(o) {
      if (phase !== 'scan' || !o.on) return;
      phase = 'connect'; chosen = o; tc = S.t;
      S.upd();
      move.to(1); gone.to(1); scanOff.to(1);
      rc.classList.add('su-gone');
      setStatus(`Verbinde mit „${o.n.name}“ …`);
      later(() => {
        phase = 'ok'; tok = S.t; lenOk = curLen;
        o.el.classList.add('su-ok');
        setStatus('Verbunden', 'ok');
        V.store.set('settings.wifi', o.n.name);
        V.sound.play('success');
        V.haptic([10, 40, 14]);
        later(() => { phase = 'done'; next(); }, 1550);
      }, 2500);
    }

    return {
      el,
      noBack: () => phase !== 'scan',
      frame(dt, t) {
        const wt = t - t0;
        const waveR = 46 + wt * 175;
        for (const o of items) {
          if (!o.on && phase === 'scan' && waveR >= o.r) {
            o.on = true; o.pop.to(1); pings.push({ x: o.x, y: o.y, t });
            V.sound.play('tick');
          }
          const m = o === chosen ? move.value : 0;
          const gn = o === chosen ? 0 : gone.value;
          const fx = U.noise(t * 0.35 + o.seed) * 0.7 * (1 - m), fy = U.noise(t * 0.3 + o.seed + 9) * 0.7 * (1 - m);
          const tx = fx + ((500 - o.x) / 10) * m, ty = fy + ((452 - o.y) / 10) * m;
          const sc = Math.max(0, o.pop.value) * (1 + 0.38 * m) * (1 - 0.45 * gn);
          o.el.style.transform = `translate(${tx.toFixed(3)}cqw, ${ty.toFixed(3)}cqw) scale(${sc.toFixed(4)})`;
          o.el.style.opacity = (U.clamp(o.pop.value, 0, 1) * (1 - gn)).toFixed(3);
          o.el.style.pointerEvents = gn > 0.5 ? 'none' : '';
        }
        if (phase === 'scan' && !listed && wt > 2.3) { listed = true; setStatus('Wähle dein WLAN'); }
      },
      draw(c, t, dt, a) {
        const wt = t - t0;
        const sa = a * (1 - scanOff.value);
        c.globalCompositeOperation = 'lighter';
        // feste Entfernungsringe
        c.lineWidth = 1.6;
        for (const r of [190, 300, 410]) { c.strokeStyle = U.rgba('#ffffff', 0.05 * sa); circle(c, 500, 500, r); c.stroke(); }
        // Radarstrahl
        if (sa > 0.01) {
          const ang = wt * 72;
          if (hasConic) {
            const g = c.createConicGradient(rad(ang - 75), 500, 500);
            g.addColorStop(0, U.rgba(CYAN, 0));
            g.addColorStop(75 / 360, U.rgba(CYAN, 0.14 * sa));
            g.addColorStop(75 / 360 + 0.0008, U.rgba(CYAN, 0));
            g.addColorStop(1, U.rgba(CYAN, 0));
            c.fillStyle = g;
            circle(c, 500, 500, 468); c.fill();
          }
          const p = pt(ang, 468);
          const lg = c.createLinearGradient(500, 500, p.x, p.y);
          lg.addColorStop(0, U.rgba(CYAN, 0)); lg.addColorStop(1, U.rgba(CYAN, 0.45 * sa));
          c.strokeStyle = lg; c.lineWidth = 2;
          c.beginPath(); c.moveTo(500, 500); c.lineTo(p.x, p.y); c.stroke();
        }
        // konzentrische Wellen
        const stopAt = phase === 'scan' ? Infinity : tc - t0;
        for (let n = 0; n < 200; n++) {
          const e = n * 1.15;
          if (e > wt || e > stopAt) break;
          const age = wt - e;
          if (age > 2.6) continue;
          const r = 46 + age * 175;
          const al = Math.pow(1 - age / 2.6, 1.7) * a;
          c.strokeStyle = U.rgba(CYAN, 0.42 * al); c.lineWidth = 2.6;
          circle(c, 500, 500, r); c.stroke();
          c.strokeStyle = U.rgba(CYAN, 0.08 * al); c.lineWidth = 18;
          circle(c, 500, 500, r); c.stroke();
        }
        // Pings, wenn ein Netz gefunden wird
        for (const P of pings) {
          const k = (t - P.t) / 0.95;
          if (k < 0 || k > 1) continue;
          c.strokeStyle = U.rgba(CYAN, 0.55 * (1 - k) * (1 - k) * a);
          c.lineWidth = 2.4;
          circle(c, P.x, P.y, 66 + V.ease.outCubic(k) * 60); c.stroke();
        }
        // Ladelinie am Rand
        if (phase !== 'scan') {
          const R = 470;
          const lt = t - tc;
          let head, len, al = a, col = CYAN;
          if (phase === 'connect') {
            curHead = -30 + lt * 300 + 40 * Math.sin(lt * 2.2);
            curLen = 34 + 116 * (0.5 - 0.5 * Math.cos(lt * 2.3));
            head = curHead; len = curLen;
          } else {
            const kk = t - tok;
            const e = V.ease.outCubic(U.clamp(kk / 0.55, 0, 1));
            head = curHead + kk * 120;
            len = U.lerp(lenOk, 360, e);
            col = U.mix(CYAN, '#32D74B', e);
            al *= 1 - U.clamp((kk - 0.7) / 0.6, 0, 1);
          }
          if (al > 0.005) {
            c.globalAlpha = al;
            if (len >= 359.5) {
              c.strokeStyle = col; c.lineWidth = 6; circle(c, 500, 500, R); c.stroke();
              c.strokeStyle = U.rgba(col, 0.25); c.lineWidth = 30; circle(c, 500, 500, R); c.stroke();
            } else {
              V.rim.tail(c, 500, 500, R, head - len, head, col, 6, 1, 0);
              V.rim.tail(c, 500, 500, R, head - len * 0.6, head, col, 26, 0.3, 0);
              const p = pt(head, R);
              glowDot(c, p.x, p.y, 34, col, 0.7);
              c.fillStyle = '#ffffff'; circle(c, p.x, p.y, 3.2); c.fill();
            }
            c.globalAlpha = 1;
          }
        }
      },
      leave() { alive = false; },
      destroy() { alive = false; timers.forEach(clearTimeout); },
    };
  };

  /* ---------- d) Name */
  BUILD.name = () => {
    const el = U.el('div');
    const title = arcTitle('Hallo');
    const q = U.el('div', { class: 'su-t su-h1', style: { top: '24cqw' }, html: 'Wie darf Visto<br>dich nennen?' });
    const field = U.el('label', { class: 'su-field' });
    const input = U.el('input', { attrs: { type: 'text', maxlength: 24, placeholder: 'Dein Name', autocomplete: 'given-name', autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Dein Name' } });
    input.value = userName();
    field.appendChild(input);
    field.setAttribute('data-nogesture', 'all');
    const skip = V.ui.button('Überspringen', { kind: 'ghost', onClick: () => { input.blur(); next(); } });
    const ok = V.ui.button('Weiter', { kind: 'white', onClick: () => save() });
    const row = U.el('div', { class: 'su-row', style: { top: '66cqw' } }, skip, ok);
    el.append(title.el, q, field, row);
    const clean = () => input.value.replace(/\s+/g, ' ').trim().slice(0, 24);
    const cap = (n) => n.charAt(0).toUpperCase() + n.slice(1);
    let lastLen = input.value.length;
    function upd() {
      const n = clean();
      title.set(n ? 'Hallo, ' + cap(n) : 'Hallo');
      ok.disabled = !n;
      if (input.value.length > lastLen) pulse(0, '#ffffff');
      lastLen = input.value.length;
    }
    function save() {
      const n = clean();
      if (!n) { input.focus(); return; }
      V.store.set('user.name', cap(n));
      input.blur();
      next();
    }
    input.addEventListener('input', upd);
    input.addEventListener('focus', () => field.classList.add('su-focus'));
    input.addEventListener('blur', () => field.classList.remove('su-focus'));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    upd();
    return {
      el,
      shown() {
        // am Rechner gleich schreiben können; am Handy öffnet erst das Antippen die Tastatur
        if (window.matchMedia && matchMedia('(pointer: fine)').matches && S && S.scene && S.scene.el === el) V.safe(() => input.focus({ preventScroll: true }));
      },
      leave() { input.blur(); },
      input,
    };
  };

  /* ---------- e) Zifferblatt */
  BUILD.face = () => {
    const el = U.el('div');
    const title = arcTitle('Zifferblatt');
    const list = V.faces.list();
    let idx = Math.max(0, list.findIndex((f) => f.id === V.store.get('settings.face', 'monolith')));
    const pos = V.spring(idx, { response: 0.5, bounce: 0.12 });
    const track = U.el('div', { class: 'su-car' });
    const items = list.map((f) => {
      const it = U.el('div', { class: 'su-fi', attrs: { 'aria-label': f.name } });
      const fp = U.el('div', { class: 'su-fp' });
      const inner = U.el('div', { class: 'su-fpi' });
      fp.appendChild(inner); it.appendChild(fp); track.appendChild(it);
      return { f, it, inner, pv: null };
    });
    const name = U.el('div', { class: 'su-t su-h2 su-name', style: { top: '62.4cqw' } });
    const dots = U.el('div', { class: 'su-dots', style: { top: '70.2cqw' } }, list.map(() => U.el('i')));
    const row = U.el('div', { class: 'su-row', style: { top: '74cqw' } }, V.ui.button('Auswählen', { kind: 'white', onClick: () => choose() }));
    el.append(title.el, track, name, dots, row);

    function layout(v) {
      items.forEach((o, i) => {
        const d = i - v, ad = Math.abs(d);
        const vis = ad < 2.2;
        o.it.style.visibility = vis ? '' : 'hidden';
        if (!vis) return;
        const x = Math.sign(d) * (ad <= 1 ? ad * 31 : 31 + (ad - 1) * 13);
        const y = Math.pow(Math.min(ad, 2), 2) * 2.4;
        const sc = ad <= 1 ? 1 - 0.46 * ad : 0.54 - 0.18 * (ad - 1);
        const op = ad <= 1 ? 1 - 0.45 * ad : 0.55 - 0.55 * (ad - 1);
        o.it.style.transform = `translate(${x.toFixed(3)}cqw, ${y.toFixed(3)}cqw) scale(${sc.toFixed(4)})`;
        o.it.style.opacity = U.clamp(op, 0, 1).toFixed(3);
        o.it.style.zIndex = String(100 - Math.round(ad * 10));
      });
    }
    function ensure() {
      items.forEach((o, i) => {
        const dd = Math.abs(i - idx);
        if (dd <= 2 && !o.pv) o.pv = V.safe(() => V.faces.preview(o.f.id, o.inner), 'Vorschau ' + o.f.id) || null;
        else if (dd > 3 && o.pv) { V.safe(() => o.pv.destroy()); o.pv = null; }
      });
    }
    let nameT = 0;
    function label(instant) {
      Array.from(dots.children).forEach((d, i) => d.classList.toggle('on', i === idx));
      const txt = list[idx] ? list[idx].name : '';
      if (instant) { name.textContent = txt; return; }
      name.style.opacity = '0';
      clearTimeout(nameT);
      nameT = setTimeout(() => { name.textContent = txt; name.style.opacity = '1'; }, 170);
    }
    function setIdx(i) {
      i = U.clamp(i, 0, list.length - 1);
      if (i !== idx) { idx = i; label(); ensure(); V.sound.play('tick'); V.haptic(4); }
      pos.to(idx);
    }
    function choose() {
      const f = list[idx];
      if (f) V.safe(() => V.faces.show(f.id));
      next();
    }
    pos.onUpdate(layout);
    layout(idx); ensure(); label(true);

    let mode = null, sv = 0;
    const g = V.gesture(el, {
      start(p) { mode = p.x0 < 95 ? null : p.r0 > 430 ? 'rim' : 'swipe'; sv = pos.value; },
      move(p) {
        if (!mode || !p.moved) return;
        const n = list.length - 1;
        let v = mode === 'rim' ? sv + p.dA / 36 : sv - p.dx / 300;
        v = v < 0 ? v * 0.3 : v > n ? n + (v - n) * 0.3 : v;
        pos.set(v);
        const r = U.clamp(Math.round(v), 0, n);
        if (r !== idx) { idx = r; label(); ensure(); V.sound.play('tick'); V.haptic(3); }
      },
      end(p) {
        if (!mode || !p.moved) { mode = null; return; }
        const proj = mode === 'rim' ? pos.value : pos.value - (p.vx / 300) * 0.16;
        mode = null;
        setIdx(Math.round(proj));
      },
      tap(p, e) {
        if (e && e.target && e.target.closest && e.target.closest('button')) return;
        if (Math.hypot(p.x - 500, p.y - 400) < 205) { V.sound.play('tap'); choose(); }
        else if (p.y > 230 && p.y < 620) setIdx(idx + (p.x < 500 ? -1 : 1));
      },
    }, { slop: 8 });

    return {
      el,
      draw(c, t, dt, a) {
        const off = Math.abs(pos.value - Math.round(pos.value));
        const al = a * (1 - U.clamp(off * 3, 0, 1));
        if (al < 0.01) return;
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = U.rgba('#ffffff', 0.85 * al);
        c.lineWidth = 3.2;
        circle(c, 500, 400, 216); c.stroke();
        c.strokeStyle = U.rgba('#ffffff', 0.08 * al);
        c.lineWidth = 22;
        circle(c, 500, 400, 216); c.stroke();
      },
      destroy() { g.destroy(); clearTimeout(nameT); pos.stop(); items.forEach((o) => { if (o.pv) V.safe(() => o.pv.destroy()); o.pv = null; }); },
    };
  };

  /* ---------- f) Akzentfarbe */
  BUILD.accent = () => {
    const el = U.el('div');
    const n = COLORS.length;
    const ang = (i) => U.wrap(215 + i * (290 / (n - 1)), 360);
    let sel = COLORS.findIndex((c) => c.c.toLowerCase() === String(accent()).toLowerCase());
    if (sel < 0) sel = 1;
    const dots = COLORS.map((c, i) => {
      const p = pt(ang(i), 398);
      return U.el('button', { class: 'su-dot', attrs: { type: 'button', 'aria-label': c.n }, style: { left: p.x / 10 + 'cqw', top: p.y / 10 + 'cqw', '--c': c.c, animationDelay: (140 + i * 38) + 'ms' } });
    });
    const lbl = U.el('div', { class: 'su-t su-lbl', style: { top: '28.5cqw' }, text: 'Akzentfarbe' });
    const time = U.el('div', { class: 'su-t su-time vos-num' });
    const cname = U.el('div', { class: 'su-t su-cname' });
    // der Zurück-Knopf oben links läge hier auf einem Farbtupfer – darum sitzt er neben „Weiter“
    const row = U.el('div', { class: 'su-row', style: { top: '64cqw' } },
      V.ui.roundButton('back', { kind: 'sm', label: 'Zurück', style: { background: 'rgba(255,255,255,.1)' }, onClick: () => back() }),
      V.ui.button('Weiter', { kind: 'white', onClick: () => next() }));
    el.append(...dots, lbl, time, cname, row);
    const setTime = () => { time.textContent = V.fmt.time(V.time.now()); };
    setTime();
    const offT = V.on('time:minute', setTime);
    let cur = COLORS[sel].c, curA = ang(sel);
    function select(i, quiet) {
      i = U.clamp(i, 0, n - 1);
      if (i === sel && quiet !== 'init') return;
      sel = i;
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      const c = COLORS[i].c;
      time.style.color = c;
      time.style.textShadow = `0 0 6cqw ${U.rgba(c, 0.42)}`;
      cname.textContent = COLORS[i].n;
      cname.style.color = c;
      V.store.set('settings.accent', c);
      if (!quiet) { V.sound.play('tick'); V.haptic(4); }
    }
    select(sel, 'init');
    function nearestByAngle(a) {
      let best = 0, bd = 999;
      for (let i = 0; i < n; i++) { const d = Math.abs(U.angDiff(a, ang(i))); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    let drag = false;
    const inRow = (e) => !!(e && e.target && e.target.closest && e.target.closest('.su-row'));
    const g = V.gesture(el, {
      start(p, e) { drag = p.r0 > 300 && p.x0 > 95 && !inRow(e); },
      move(p) { if (drag && p.moved) select(nearestByAngle(p.a)); },
      end() { drag = false; },
      tap(p, e) {
        if (inRow(e)) return;
        if (p.r > 300) select(nearestByAngle(p.a));
      },
    }, { slop: 5 });
    return {
      el,
      ownBack: true,
      draw(c, t, dt, a) {
        const target = COLORS[sel].c;
        cur = U.mix(cur, target, Math.min(1, dt * 7));
        curA += U.angDiff(curA, ang(sel)) * Math.min(1, dt * 11);
        c.globalCompositeOperation = 'lighter';
        c.lineCap = 'round';
        // weiches Farbband hinter den Tupfern, an den Enden (unten) ausgeblendet
        if (hasConic) {
          const bg = c.createConicGradient(rad(200), 500, 500);
          const span = 320 / 360;
          bg.addColorStop(0, U.rgba(cur, 0));
          bg.addColorStop(0.07, U.rgba(cur, 0.075 * a));
          bg.addColorStop(span - 0.07, U.rgba(cur, 0.075 * a));
          bg.addColorStop(span, U.rgba(cur, 0));
          bg.addColorStop(1, U.rgba(cur, 0));
          c.strokeStyle = bg;
          c.lineWidth = 132;
          c.lineCap = 'butt';
          circle(c, 500, 500, 398); c.stroke();
          c.lineCap = 'round';
        }
        // Licht hinter dem gewählten Tupfer
        const p = pt(curA, 398);
        glowDot(c, p.x, p.y, 125, cur, 0.5 * a);
        // Mitte leuchtet leise mit
        glowDot(c, 500, 440, 300, cur, 0.08 * a);
      },
      destroy() { g.destroy(); offT(); },
    };
  };

  /* ---------- g) Visto kennenlernen */
  BUILD.visto = () => {
    const el = U.el('div');
    const nm = userName();
    const intro = U.el('div', { class: 'su-t su-fade', style: { top: '31cqw' } },
      U.el('div', { class: 'su-h1', text: 'Das ist Visto.' }),
      U.el('div', { class: 'su-sub', style: { marginTop: '2.6cqw' }, text: 'Dein Assistent. Er hört zu, beantwortet Fragen und hilft dir durch den Tag.' }));
    const hint = U.el('div', { class: 'su-t su-fade', style: { top: '73cqw' } },
      U.el('div', { class: 'su-lbl', style: { color: 'rgba(255,255,255,.72)' }, text: 'Tippe auf die Linie' }),
      U.el('div', { class: 'su-chev', html: V.icon('down') }));
    const greet = U.el('div', { class: 'su-t su-fade', style: { top: '67cqw' } });
    const outro = U.el('div', { class: 'su-t su-fade su-gone', style: { top: '30cqw' } },
      U.el('div', { class: 'su-h1', text: 'Visto ist immer da.' }),
      U.el('div', { class: 'su-sub', style: { marginTop: '2.6cqw' }, text: 'Tippe auf die Linie oder wische von ihr nach oben – und frag einfach.' }));
    const row = U.el('div', { class: 'su-row su-fade su-gone', style: { top: '64cqw' } }, V.ui.button('Weiter', { kind: 'white', onClick: () => next() }));
    el.append(intro, hint, greet, outro, row);
    let phase = 'wait', alive = true, nudge = 0;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));

    // Ebene wird durchsichtig, damit Visto (Leuchtebene darunter) zu sehen ist
    S.root.classList.add('su-see');
    V.visto.setLine(1);

    function meet() {
      phase = 'meet';
      S.upd();
      intro.classList.add('su-gone');
      hint.classList.add('su-gone');
      V.visto.open();
      later(() => V.visto.emote('happy', 2500), 420);
      const said = nm ? `Hallo ${nm}! Schön, dich kennenzulernen.` : 'Hallo! Schön, dich kennenzulernen.';
      const l1 = nm ? ['Hallo,', nm + '!'] : ['Hallo!'];
      const l2 = ['Schön,', 'dich', 'kennenzulernen.'];
      const words = [];
      const line1 = U.el('div', { class: 'su-h1' });
      const line2 = U.el('div', { class: 'su-sub', style: { padding: '0', marginTop: '1.4cqw', fontSize: '4.4cqw', color: 'rgba(255,255,255,.7)' } });
      const fill = (line, ws) => ws.forEach((w, i) => { if (i) line.append(' '); const s = U.el('span', { class: 'su-w', text: w }); line.append(s); words.push(s); });
      fill(line1, l1); fill(line2, l2);
      greet.append(line1, line2);
      let shownI = -1;
      const reveal = (i) => {
        for (let k = shownI + 1; k <= Math.min(i, words.length - 1); k++) words[k].classList.add('on');
        shownI = Math.max(shownI, i);
      };
      later(() => {
        let sp;
        try { sp = V.voice.speak(said, { onWord: (i) => alive && reveal(i) }); } catch (e) { sp = Promise.resolve(); }
        words.forEach((w, i) => later(() => reveal(i), 200 + i * 290));
        const minMs = words.length * 290 + 900;
        const minP = new Promise((r) => setTimeout(r, minMs));
        const maxP = new Promise((r) => setTimeout(r, 7000));
        Promise.race([Promise.all([Promise.resolve(sp).catch(() => {}), minP]), maxP]).then(() => later(bye, 700));
      }, 650);
    }
    function bye() {
      phase = 'after';
      V.visto.close();
      greet.classList.add('su-gone');
      later(() => { outro.classList.remove('su-gone'); row.classList.remove('su-gone'); S.upd(); }, 650);
    }

    const g = V.gesture(el, {
      tap(p, e) {
        if (phase !== 'wait') return;
        if (e && e.target && e.target.closest && e.target.closest('button')) return;
        if (p.y > 800 && Math.abs(p.x - 500) < 240) meet();
        else { V.visto.hop(); nudge = 1; }
      },
    });
    return {
      el,
      noBack: () => phase === 'meet',
      draw(c, t, dt, a) {
        // sanftes Leuchten über der Linie, solange sie angetippt werden will
        nudge = Math.max(0, nudge - dt * 1.5);
        const w = phase === 'wait' ? 1 : 0;
        const pul = 0.5 + 0.5 * Math.sin(t * 2.6);
        if (w > 0) {
          c.globalCompositeOperation = 'lighter';
          c.save();
          c.translate(500, 952);
          c.scale(1, 0.32);
          glowDot(c, 0, 0, 230 + 30 * pul, palAt(t * 0.08), a * (0.16 + 0.12 * pul + 0.25 * nudge));
          c.restore();
        }
      },
      leave() {
        alive = false;
        timers.forEach(clearTimeout);
        V.voice.stop();
        if (V.visto.isOpen) V.visto.close();
        V.visto.setLine(0);
        if (S) S.root.classList.remove('su-see');
      },
      destroy() { alive = false; timers.forEach(clearTimeout); g.destroy(); },
    };
  };

  /* ---------- h) Gesten */
  const APPCOLS = ['#FF9F0A', '#3D8BFF', '#32D74B', '#FF375F', '#BF5AF2', '#64D2FF', '#FFD60A'];

  function drawClock(c, x, y, r, al) {
    if (al <= 0.005) return;
    c.globalAlpha = al;
    c.fillStyle = 'rgba(255,255,255,.05)';
    circle(c, x, y, r); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2.4;
    circle(c, x, y, r); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    c.lineWidth = r * 0.06;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + r * 0.32, y - r * 0.32); c.stroke();
    c.lineWidth = r * 0.04;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - r * 0.08, y - r * 0.66); c.stroke();
    c.fillStyle = accent();
    circle(c, x, y, r * 0.05); c.fill();
    c.globalAlpha = 1;
  }
  function bubble(c, x, y, r, color, al) {
    if (r <= 0.5 || al <= 0.005) return;
    c.globalAlpha = al;
    c.fillStyle = color;
    circle(c, x, y, r); c.fill();
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, 0, x - r * 0.35, y - r * 0.45, r * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.55, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    circle(c, x, y, r); c.fill();
    c.globalAlpha = 1;
  }

  BUILD.gestures = () => {
    const only = !!(S && S.only);
    const el = U.el('div');
    const title = arcTitle('Gesten');
    const cap = U.el('div', { class: 'su-t', style: { top: '57.5cqw' } });
    const capT = U.el('div', { class: 'su-h2' });
    const capS = U.el('div', { class: 'su-sub', style: { marginTop: '1.2cqw', padding: '0' } });
    cap.append(capT, capS);
    const ind = U.el('div', { class: 'su-dots', style: { top: '11.8cqw' } }, DEMOS.map(() => U.el('i')));
    const row = U.el('div', { class: 'su-row', style: { top: '74.5cqw' } }, V.ui.button(only ? 'Fertig' : 'Weiter', { kind: 'white', onClick: () => (only ? finish() : next()) }));
    el.append(title.el, ind, cap, row);
    const PER = 3.5;
    let di = 0, d0 = S.t, alive = true, capT0 = 0;
    const trail = [];
    function setDemo(i, cheer) {
      di = U.wrap(i, DEMOS.length);
      d0 = S.t;
      trail.length = 0;
      cap.style.transition = 'opacity .2s ease';
      cap.style.opacity = '0';
      clearTimeout(capT0);
      capT0 = setTimeout(() => {
        if (!alive) return;
        capT.textContent = DEMOS[di].t;
        capS.textContent = DEMOS[di].s;
        capS.classList.remove('su-ok-t');
        cap.style.opacity = '1';
      }, cheer ? 0 : 200);
      Array.from(ind.children).forEach((d, k) => d.classList.toggle('on', k === di));
    }
    function tried(k) {
      const i = DEMOS.findIndex((d) => d.k === k);
      if (i < 0) return;
      ind.children[i].classList.add('ok');
      V.sound.play('success');
      V.haptic([8, 30, 8]);
      if (i !== di) setDemo(i, true);
      clearTimeout(capT0);
      capT.textContent = DEMOS[i].t;
      capS.textContent = 'Genau so!';
      capS.classList.add('su-ok-t');
      cap.style.opacity = '1';
      d0 = S.t - 0.5;
      capT0 = setTimeout(() => { if (alive) setDemo(i + 1); }, 1500);
    }
    setDemo(0, true);
    const g = V.gesture(el, {
      end(p, e) {
        if (!p.moved || p.cancelled || p.x0 < 95) return;
        if (e && e.target && e.target.closest && e.target.closest('button')) return;
        if (p.dy < -110 && Math.abs(p.dx) < Math.abs(p.dy)) tried('up');
        else if (p.dy > 110 && Math.abs(p.dx) < Math.abs(p.dy)) tried('down');
      },
    }, { slop: 10 });

    return {
      el,
      edge() { tried('back'); return true; },
      frame() { if (S.t - d0 > PER) setDemo(di + 1); },
      draw(c, t, dt, a) {
        const lt = t - d0;
        const D = DEMOS[di];
        const vis = U.smoothstep(0, 0.35, lt) * (1 - U.smoothstep(PER - 0.4, PER, lt)) * a;
        const mv = V.ease.inOutCubic(U.clamp((lt - 0.55) / 1.0, 0, 1));
        const fa = U.smoothstep(0.2, 0.5, lt) * (1 - U.smoothstep(1.62, 1.95, lt));
        const res = V.ease.smooth(U.clamp((lt - 0.6) / 1.05, 0, 1));
        const cx = 500, cy = 385;
        c.globalCompositeOperation = 'source-over';
        if (D.k === 'up') {
          drawClock(c, cx, cy, 130 * (1 - 0.5 * res), vis * (1 - res));
          for (let i = 0; i < 7; i++) {
            const a0 = i === 0 ? 0 : ((i - 1) / 6) * 360 + 30;
            const tp = i === 0 ? { x: cx, y: cy } : { x: cx + Math.sin(U.rad(a0)) * 96, y: cy - Math.cos(U.rad(a0)) * 96 };
            const k = U.clamp(res * 1.7 - i * 0.1, 0, 1);
            const e = V.ease.outBack(k);
            bubble(c, U.lerp(cx, tp.x, e), U.lerp(cy + 170, tp.y, e), 38 * e, APPCOLS[i], vis * U.clamp(k * 2, 0, 1));
          }
        } else if (D.k === 'down') {
          drawClock(c, cx, cy, 130, vis * (1 - 0.75 * res));
          const py = U.lerp(-240, cy, res);
          c.globalAlpha = vis * res;
          c.fillStyle = 'rgba(38,39,46,.96)';
          circle(c, cx, py, 165); c.fill();
          c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
          circle(c, cx, py, 165); c.stroke();
          const tg = [[-52, -52, accent()], [52, -52, '#ffffff'], [-52, 52, 'rgba(255,255,255,.18)'], [52, 52, 'rgba(255,255,255,.18)']];
          for (const [dx, dy, col] of tg) { c.fillStyle = col; circle(c, cx + dx, py + dy, 38); c.fill(); }
          c.globalAlpha = 1;
        } else {
          drawClock(c, cx, cy, 130 * (0.82 + 0.18 * res), vis * (0.25 + 0.75 * res));
          const sx = cx + 210 * res, sc = 1 - 0.38 * res;
          c.globalAlpha = vis * (1 - res);
          const ag = c.createLinearGradient(sx, cy - 150 * sc, sx, cy + 150 * sc);
          ag.addColorStop(0, '#2c5fd6'); ag.addColorStop(1, '#0d1f4f');
          c.fillStyle = ag;
          circle(c, sx, cy, 150 * sc); c.fill();
          c.fillStyle = 'rgba(255,255,255,.85)';
          c.beginPath(); c.roundRect ? c.roundRect(sx - 60 * sc, cy - 50 * sc, 120 * sc, 20 * sc, 10 * sc) : c.rect(sx - 60 * sc, cy - 50 * sc, 120 * sc, 20 * sc); c.fill();
          c.fillStyle = 'rgba(255,255,255,.35)';
          for (let i = 0; i < 2; i++) { c.beginPath(); c.roundRect ? c.roundRect(sx - 80 * sc, cy + (-5 + i * 36) * sc, 160 * sc, 16 * sc, 8 * sc) : c.rect(sx - 80 * sc, cy + (-5 + i * 36) * sc, 160 * sc, 16 * sc); c.fill(); }
          c.globalAlpha = 1;
          // leuchtender Rand links
          c.globalCompositeOperation = 'lighter';
          c.lineCap = 'round';
          c.strokeStyle = U.rgba('#ffffff', 0.5 * vis * fa);
          c.lineWidth = 5;
          c.beginPath(); c.arc(500, 500, RIM, rad(240), rad(300)); c.stroke();
          c.globalCompositeOperation = 'source-over';
        }
        // Finger
        const fx = U.lerp(D.from[0], D.to[0], mv), fy = U.lerp(D.from[1], D.to[1], mv);
        if (fa > 0.01) {
          if (mv > 0 && mv < 1) trail.push({ x: fx, y: fy });
          if (trail.length > 26) trail.shift();
        } else trail.length = 0;
        c.globalCompositeOperation = 'lighter';
        if (trail.length > 1 && fa > 0.01) {
          c.lineCap = 'round'; c.lineJoin = 'round';
          for (let i = 1; i < trail.length; i++) {
            const k = i / trail.length;
            c.strokeStyle = U.rgba('#ffffff', 0.32 * k * fa * vis);
            c.lineWidth = 30 * k;
            c.beginPath(); c.moveTo(trail[i - 1].x, trail[i - 1].y); c.lineTo(trail[i].x, trail[i].y); c.stroke();
          }
        }
        if (fa > 0.01) {
          const press = U.smoothstep(0.3, 0.55, lt);
          const lift = U.smoothstep(1.6, 1.95, lt);
          const rr = 30 * (1.25 - 0.25 * press + 0.45 * lift);
          glowDot(c, fx, fy, 90, '#cfe0ff', 0.32 * fa * vis);
          c.globalAlpha = 0.92 * fa * vis;
          c.fillStyle = '#ffffff';
          circle(c, fx, fy, rr); c.fill();
          // Berührungsring
          const rk = U.clamp((lt - 0.38) / 0.6, 0, 1);
          if (rk > 0 && rk < 1) {
            c.globalAlpha = (1 - rk) * 0.6 * vis;
            c.strokeStyle = '#ffffff'; c.lineWidth = 2.5;
            circle(c, D.from[0], D.from[1], 34 + rk * 50); c.stroke();
          }
          c.globalAlpha = 1;
        }
      },
      destroy() { alive = false; clearTimeout(capT0); g.destroy(); },
    };
  };

  /* ---------- i) Fertig */
  BUILD.done = () => {
    const el = U.el('div');
    const nm = userName();
    const box = U.el('div', { class: 'su-t', style: { top: nm ? '36cqw' : '42cqw' } });
    box.appendChild(U.el('div', { class: 'su-big', text: nm ? 'Alles bereit,' : 'Alles bereit.' }));
    if (nm) {
      const size = U.clamp(66 / (measure(nm + '.', 600) / 100), 5, 8.6);
      box.appendChild(U.el('div', { class: 'su-big', style: { color: 'var(--accent)', fontSize: size.toFixed(2) + 'cqw' }, text: nm + '.' }));
    }
    const sub = U.el('div', { class: 'su-t su-sub', style: { top: nm ? '57.5cqw' : '53cqw' }, text: 'Viel Freude mit Visto.' });
    el.append(box, sub);
    let started = false, alive = true;
    async function seq() {
      await waitFor(() => !S || S.prog.value > 0.993, 3000);
      if (!alive || !S) return;
      S.flashT = 0; S.flash = 1;
      V.sound.play('success');
      V.haptic([12, 50, 20]);
      await U.sleep(1700);
      if (!alive || !S) return;
      await V.tween({ duration: 0.8, ease: V.ease.inOutCubic, onUpdate: (v) => {
        if (S) S.zoom = v;
        el.style.transform = `scale(${(1 + 0.9 * v).toFixed(4)})`;
        el.style.opacity = (1 - v).toFixed(3);
        el.style.filter = `blur(${(v * 1.6).toFixed(2)}cqw)`;
      } }).promise;
      if (alive) finish();
    }
    return {
      el,
      noBack: () => true,
      shown() { if (!started) { started = true; seq(); } },
      destroy() { alive = false; },
    };
  };

  /* ------------------------------------------------------------- Ende */
  function finish() {
    if (!S || S.done) return;
    const s = S;
    s.done = true;
    if (s.home && s.home.el.style.visibility === 'hidden') s.home.el.style.visibility = s.home.v || '';
    if (!s.only) V.emit('setup:done');
    s.root.style.pointerEvents = 'none';
    s.resolve();
    // Ebene sanft wegnehmen, darunter zoomt das Zifferblatt herein (main.js → V.shell.enterHome)
    V.tween({ duration: s.only ? 0.4 : 0.6, ease: V.ease.outCubic, onUpdate: (v) => { s.root.style.opacity = (1 - v).toFixed(3); } })
      .promise.then(() => teardown(s));
  }
  function teardown(s) {
    s.offs.splice(0).forEach((f) => V.safe(f));
    if (s.trans) { s.trans.sp.stop(); s.trans = null; }
    for (const sc of [s.old, s.scene]) if (sc) { V.safe(() => sc.leave && !s.done && sc.leave(1)); V.safe(() => sc.destroy && sc.destroy()); }
    s.old = s.scene = null;
    s.root.remove();
    if (S === s) S = null;
  }

  /* ----------------------------------------- Einrichtung erneut / Gesten */
  async function restart() {
    if ((S && !S.done) || !V.shell || V.shell.mode === 'setup' || V.shell.mode === 'boot') return;
    if (V.convo && V.convo.active) V.convo.close();
    if (V.control && V.control.isOpen) V.control.close();
    if (V.shell.mode === 'app') await V.shell.closeApp({ to: 'home' });
    else if (V.shell.mode === 'launcher') await V.shell.home();
    V.shell.setMode('setup');
    await start({ fadeIn: true });
    V.store.set('setupDone', true);
    V.shell.enterHome();
    V.emit('boot:home');
  }
  function gestures() {
    if (S && !S.done) return S.promise;
    if (V.convo && V.convo.active) V.convo.close();
    return start({ only: 'gestures', fadeIn: true });
  }

  V.setup = {
    start,
    restart,
    gestures,
    STEPS,
    get isOpen() { return !!S && !S.done; },
    get step() { return S && !S.done ? STEPS[S.idx] : null; },
    /** Test: direkt zu einem Schritt springen (startet die Einrichtung bei Bedarf) */
    _goto(n) {
      const i = typeof n === 'string' ? STEPS.indexOf(n) : n;
      if (i < 0) return;
      if (!S || S.done) {
        if (V.shell.mode !== 'setup') V.shell.setMode('setup');
        start().then(() => { V.store.set('setupDone', true); V.shell.enterHome(); });
      }
      go(i);
    },
    _next: () => next(),
    _back: () => back(),
  };

  /* ------------------------------------------------- Visto versteht … */
  const canon = (s) => V.brain && V.brain.norm ? V.brain.norm(s) : String(s).toLowerCase();
  function cityName(raw) {
    const t = String(raw || '').trim().replace(/[.!?]+$/, '');
    if (!t) return '';
    const k = canon(t).replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');
    const known = CITIES.find((c) => canon(c.name) === canon(t) || canon(c.name) === k);
    if (known) return known.name;
    const small = ['am', 'an', 'der', 'im', 'in', 'ob', 'bei', 'vor', 'auf'];
    return t.split(/\s+/).map((w, i) => (i && small.includes(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }
  const later = (fn, ms) => setTimeout(fn, ms);

  V.actions.register('system.restart_setup', {
    desc: 'Startet die Ersteinrichtung von Visto erneut (Ort, WLAN, Name, Zifferblatt, Akzentfarbe, Gesten). Nur auf ausdrücklichen Wunsch.',
    run() {
      later(() => restart(), 2200);
      return { say: 'Gern! Wir richten Visto noch einmal gemeinsam ein.', emotion: 'happy' };
    },
  });
  V.actions.register('system.show_gestures', {
    desc: 'Zeigt die animierte Gestenanleitung: nach oben wischen = Apps, nach unten = Kontrollzentrum, vom linken Rand = zurück.',
    run() {
      later(() => { if (V.convo && V.convo.active) V.convo.close(); later(() => gestures(), 450); }, 1900);
      return { say: 'Ich zeige dir die wichtigsten Gesten.', emotion: 'happy' };
    },
  });
  V.actions.register('system.set_location', {
    desc: 'Setzt den Standort von Visto (Stadt, z. B. Berlin, Hamburg, München, Köln, Frankfurt, Wien, Zürich). Wird für Wetter und Uhrzeit genutzt.',
    params: { city: { type: 'string', description: 'Name der Stadt' } },
    required: ['city'],
    run(a) {
      const city = cityName(a.city);
      if (!city) return { say: 'Welche Stadt soll ich als Standort nehmen?', emotion: 'confused' };
      V.store.set('settings.location', city);
      return { say: `Alles klar, Visto steht jetzt in ${city}.`, card: { type: 'icon', icon: 'location', color: '#0A84FF', title: city, sub: 'Standort' }, emotion: 'happy' };
    },
  });
  V.actions.register('system.wifi', {
    desc: 'Nennt das verbundene WLAN oder verbindet Visto mit einem anderen Netz (name). Bekannte Netze: ' + NETS.map((n) => n.name).join(', ') + '.',
    params: { name: { type: 'string', description: 'Name des WLANs (leer = nur abfragen)' } },
    run(a) {
      const want = String(a.name || '').trim();
      if (want) {
        const key = (x) => canon(x).replace(/[^a-z0-9äöüß]/g, '');
        const n = NETS.find((x) => key(x.name) === key(want)) || NETS.find((x) => key(want).length > 2 && key(x.name).includes(key(want)));
        if (!n) return { say: `Ich finde kein WLAN namens „${want}“. In der Nähe sind ${NETS.slice(0, 3).map((x) => x.name).join(', ')}.`, emotion: 'confused' };
        V.store.set('settings.wifi', n.name);
        V.rim.pulse({ at: 0, color: '#32D74B' });
        return { say: `Verbunden mit „${n.name}“.`, card: { type: 'icon', icon: 'wifi', color: '#32D74B', title: n.name, sub: 'WLAN verbunden' }, emotion: 'happy' };
      }
      const w = V.store.get('settings.wifi', '');
      return w
        ? { say: `Visto ist mit „${w}“ verbunden. Der Empfang ist gut.`, card: { type: 'icon', icon: 'wifi', color: '#0A84FF', title: w, sub: 'WLAN' } }
        : { say: 'Visto ist gerade mit keinem WLAN verbunden. Sag zum Beispiel: „Verbinde mit Zuhause“.', emotion: 'sad' };
    },
  });

  const NB = '(?<![a-zäöüß])', NA = '(?![a-zäöüß])';
  V.brain.intent({
    id: 'setup-restart', priority: 8,
    match: [
      new RegExp(NB + '(?:ersteinrichtung|einrichtungsassistent)' + NA),
      new RegExp(NB + 'einrichtung' + NA + '.*' + NB + '(?:neu|nochmal|noch einmal|wiederholen|starten|beginnen|zeigen|öffnen)' + NA),
      new RegExp(NB + '(?:starte|öffne|wiederhole|beginne|zeig(?:e)?(?: mir)?) (?:die |nochmal die |noch einmal die )?einrichtung' + NA),
      new RegExp(NB + 'richte (?:visto |dich |das gerät )?(?:neu|noch ?mal|noch einmal|erneut) ein' + NA),
    ],
    run() { return V.actions.run('system.restart_setup'); },
  });
  V.brain.intent({
    id: 'setup-gestures', priority: 7,
    match: [
      new RegExp(NB + '(?:gesten|gestenanleitung|gestenhilfe|wischgesten)' + NA),
      new RegExp(NB + 'wie (?:bediene|steuere|benutze|navigiere) ich(?: dich| visto| das gerät)?' + NA),
      new RegExp(NB + 'wie (?:komme|gehe) ich zurück' + NA),
    ],
    run() { return V.actions.run('system.show_gestures'); },
  });
  V.brain.intent({
    id: 'setup-location', priority: 6,
    match(t) {
      const m = t.match(new RegExp(NB + '(?:setze?|stelle?|änder(?:e)?|wechsle|wechsel(?:e)?) (?:den |meinen |deinen )?(?:standort|wohnort|ort) (?:auf|zu|nach|in) ([a-zäöüß .-]{2,32})$'))
        || t.match(new RegExp(NB + '(?:mein|dein) (?:standort|wohnort) ist (?:jetzt |nun )?([a-zäöüß .-]{2,32})$'))
        || t.match(new RegExp(NB + '(?:standort|wohnort) (?:auf|nach|ist) ([a-zäöüß .-]{2,32})$'))
        || t.match(new RegExp(NB + '(?:ich wohne|ich lebe|wir wohnen|wir leben) (?:jetzt |nun |seit kurzem )?in ([a-zäöüß .-]{2,32})$'));
      return m ? { city: m[1].trim() } : null;
    },
    run(m, t, original) {
      const om = original.match(/(?:auf|nach|zu|in|ist)\s+([A-Za-zÄÖÜäöüß .-]{2,32})[.!?]*\s*$/);
      return V.actions.run('system.set_location', { city: om ? om[1] : m.city });
    },
  });
  V.brain.intent({
    id: 'setup-location-get', priority: 5,
    // norm() entfernt das Wort „Visto“: „Wo steht Visto?“ kommt als „wo steht“ an
    match: [/^wo (?:bin ich|stehst du|bist du|steht(?: visto)?)$/, new RegExp(NB + '(?:welcher|was ist mein|was ist dein|wie ist mein) (?:standort|wohnort)' + NA)],
    run() {
      const c = V.store.get('settings.location', 'Berlin');
      return { say: `Visto steht in ${c}.`, card: { type: 'icon', icon: 'location', color: '#0A84FF', title: c, sub: 'Standort' } };
    },
  });
  V.brain.intent({
    id: 'setup-wifi', priority: 6,
    match(t) {
      if (!new RegExp(NB + '(?:wlan|wifi|wi-fi|wlan-netz|netzwerk|internet)' + NA).test(t)) return null;
      const m = t.match(new RegExp(NB + '(?:verbinde|wechsle|wechsel(?:e)?)(?: dich| visto)? (?:mit|zu|ins|in das) (?:dem |das )?(?:wlan |netzwerk |wifi )?(.{2,40})$'));
      return { name: m ? m[1].replace(/^(wlan|netzwerk|wifi) /, '').trim() : '' };
    },
    run(m) { return V.actions.run('system.wifi', m.name && !/^(wlan|wifi|netzwerk|internet)$/.test(m.name) ? { name: m.name } : {}); },
  });
})();
