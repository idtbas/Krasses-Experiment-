/* VistoOS · sys/perf.js — Leistungsregler
 *
 *  Misst die gleitende Bildzeit und stellt eine Qualitätsstufe für alles, was optional ist
 *  (Lumen-Ebenen, Auflösung der Leuchtebene). Der Bildtakt V.loop bleibt unberührt.
 *
 *  V.perf.level            0 niedrig · 1 mittel · 2 hoch
 *  V.perf.fps / frameMs    gleitende Bildrate bzw. Bildzeit (Abstand zweier Bilder, ms)
 *  V.perf.workMs           gleitende Rechenzeit der Skripte je Bild (ms)
 *  V.perf.hz               geschätzte Bildwiederholrate des Displays
 *  V.perf.on(fn(level, vorher)) → abmelden()        Ereignis 'perf:level' (level)
 *  V.perf.pin(level | null)                          Stufe festhalten (null = wieder selbst regeln)
 *  V.perf.stats()          → { level, pinned, fps, frameMs, workMs, hz, load }
 *  URL-Schalter: ?perf=0|1|2 hält die Stufe fest (Tests, Vergleichsmessungen)
 *
 *  Regel: Liegt die Bildzeit rund zwei Sekunden lang deutlich über dem Takt des Displays (> 130 %),
 *  geht es eine Stufe hinunter. Läuft es lange sauber (< 110 %), wird vorsichtig wieder angehoben –
 *  nach jedem Rückfall wartet der Regler doppelt so lange, damit nichts pendelt.
 */
'use strict';
(function () {
  const V = window.V;
  const now = () => performance.now();

  const fns = [];
  let level = 2, pinned = null;
  let last = 0, t0 = 0;
  let frameMs = 1000 / 60, workMs = 0;
  let period = 1000 / 60;            // geschätzter Takt des Displays (ms)
  let hold = 0;                      // bis dahin (ms) nicht messen: Start, Tab-Wechsel, Stufenwechsel
  let load = 1;

  // Messfenster
  const N = 96;
  const ring = new Float32Array(N), sorted = new Float32Array(N);
  let rn = 0, ri = 0;
  let winSum = 0, winN = 0, winT = 0;
  let badWins = 0, goodMs = 0;
  let upWait = 8000;                 // so lange muss es sauber laufen, bevor angehoben wird
  let lastRaise = 0, lastDrop = 0;

  try { const s = V.store && V.store.get('sys.perfLevel'); if (s === 0 || s === 1 || s === 2) level = s; } catch (e) { /* ohne Speicher: Standard */ }

  function setLevel(l, auto) {
    l = l < 0 ? 0 : l > 2 ? 2 : l | 0;
    if (l === level) return;
    const prev = level;
    level = l;
    badWins = 0; goodMs = 0;
    hold = now() + 1600;             // Umstellen (neue Auflösungen) nicht mitmessen
    if (auto) { try { V.store && V.store.set('sys.perfLevel', l); } catch (e) { /* egal */ } }
    for (let i = 0; i < fns.length; i++) { try { fns[i](l, prev); } catch (e) { console.error('[VistoOS] perf', e); } }
    V.emit('perf:level', l);
  }

  function estimatePeriod() {
    if (rn < 24) return;
    for (let i = 0; i < rn; i++) sorted[i] = ring[i];
    const s = sorted.subarray(0, rn);
    s.sort();
    const p10 = s[Math.floor(rn * 0.1)];
    // Der Takt des Displays ist die untere Grenze der Abstände. Schneller wird sofort übernommen,
    // langsamer nur träge (Display schaltet z. B. von 120 auf 60 Hz).
    if (p10 < period) period = p10;
    else period += (p10 - period) * 0.04;
    // Unter 60 Hz gilt nicht als Takt: Wer dauerhaft nur 30 Bilder schafft (oder im Stromsparmodus
    // gedrosselt wird), soll auf die sparsame Stufe fallen.
    if (period > 1000 / 60) period = 1000 / 60;
    if (period < 1000 / 144) period = 1000 / 144;
  }

  function begin() {
    const t = now();
    t0 = t;
    if (!last || document.hidden) { last = t; return; }
    const iv = t - last;
    last = t;
    if (iv <= 0) return;
    if (iv > 250) { hold = Math.max(hold, t + 500); return; }   // Aussetzer (Tab, Speicherbereinigung): nicht werten
    frameMs += (iv - frameMs) * Math.min(1, iv / 500);
    ring[ri] = iv; ri = (ri + 1) % N; if (rn < N) rn++;
    if (t < hold) { winSum = 0; winN = 0; winT = t; return; }
    winSum += iv; winN++;
    if (t - winT < 900 || winN < 12) return;
    // ---- ein Messfenster (~1 s) ist voll
    estimatePeriod();
    const avg = winSum / winN, span = t - winT;
    winSum = 0; winN = 0; winT = t;
    load = avg / period;
    if (pinned !== null) return;
    if (load > 1.3) {
      goodMs = 0;
      if (++badWins >= 2 && level > 0) {
        if (t - lastRaise < 20000) upWait = Math.min(480000, upWait * 2);   // Anheben war zu früh
        lastDrop = t;
        setLevel(level - 1, true);
      }
    } else {
      badWins = 0;
      if (load < 1.1) {
        goodMs += span;
        if (level < 2 && goodMs >= upWait) { lastRaise = t; setLevel(level + 1, true); }
        // lange stabil auf der höheren Stufe → Wartezeit wieder verkürzen
        if (upWait > 8000 && t - lastDrop > 4 * upWait) { upWait = Math.max(8000, upWait / 2); lastDrop = t; }
      } else goodMs = Math.max(0, goodMs - span);
    }
  }
  function end() {
    const w = now() - t0;
    if (w >= 0 && w < 250) workMs += (w - workMs) * 0.08;
  }

  V.perf = {
    get level() { return level; },
    get pinned() { return pinned; },
    get frameMs() { return Math.round(frameMs * 100) / 100; },
    get fps() { return Math.round(1000 / frameMs); },
    get workMs() { return Math.round(workMs * 100) / 100; },
    get hz() { return Math.round(1000 / period); },
    get load() { return Math.round(load * 100) / 100; },
    on(fn) { fns.push(fn); return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; },
    pin(l) {
      if (l === null || l === undefined) { pinned = null; badWins = 0; goodMs = 0; return; }
      pinned = l < 0 ? 0 : l > 2 ? 2 : l | 0;
      setLevel(pinned, false);
    },
    stats() { return { level, pinned, fps: V.perf.fps, frameMs: V.perf.frameMs, workMs: V.perf.workMs, hz: V.perf.hz, load: V.perf.load }; },
  };

  const q = /[?&]perf=([012])\b/.exec(location.search);
  if (q) V.perf.pin(+q[1]);

  hold = now() + 2500;               // der Start (Schriften, erste Bilder) zählt nicht
  document.addEventListener('visibilitychange', () => { last = 0; hold = now() + 1500; });
  V.loop.add(begin, -1e9);           // als Erstes im Bild …
  V.loop.add(end, 1e9);              // … und als Letztes: dazwischen liegt die Rechenzeit
})();
