/* KYTHERA · Taktgeber und Abwesenheitsberechnung */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const E = KY.engine = { running: false, paused: false };
  let timer = null, lastReal = 0, saveAcc = 0;

  E.step = function (dt) {
    const S = KY.S;
    S.t += dt;
    KY.market.tick(dt);
    KY.wsim.tickRegions(dt);
    KY.wsim.tickEvents();
    KY.crisis.tick();
    KY.proj.tick();
    KY.council.tick();
    KY.research.tick(dt);
    KY.dsp.tick(dt);
    KY.infra.tick();
    KY.integ.tick(dt);
    KY.resTick(dt);
    KY.story.tick();
    KY.story.autopilotTick();
  };

  E.start = function () {
    if (E.running) return;
    E.running = true;
    lastReal = performance.now();
    timer = setInterval(loop, 1000);
  };
  E.stop = function () { E.running = false; clearInterval(timer); };

  function loop() {
    const now = performance.now();
    let el = (now - lastReal) / 1000;
    lastReal = now;
    if (E.paused) return;
    if (el > 8) { E.catchUp(Math.min(el, 3600), true); return; }
    const dt = Math.max(1, Math.round(el));
    try { E.step(dt); } catch (e) { console.error(e); }
    KY.bus.emit('tick', dt);
    saveAcc += dt;
    if (saveAcc >= 10) { saveAcc = 0; KY.save(); }
  }

  /* Simuliert eine Abwesenheit im Schnelldurchlauf und liefert eine Zusammenfassung */
  E.catchUp = function (sec, live) {
    const S = KY.S;
    sec = Math.min(sec, 3600);
    if (sec < 5) return null;
    const before = {
      nw: KY.market.netWorth(), kap: S.res.kap, log: S.log.length, done: S.projects.done.length, past: S.council.past.length,
      news: S.news.length, msgs: S.msgs.length, dsp: S.dsp.list.length, stab: KY.wsim.globalStab(), crisesAuto: S.stats.crisesAuto,
    };
    const startLogTs = Date.now();
    KY.silent = true;
    const step = 2;
    let n = Math.floor(sec / step);
    try { while (n-- > 0) E.step(step); } catch (e) { console.error(e); }
    KY.silent = false;
    const sum = {
      sec,
      nw: KY.market.netWorth() - before.nw,
      events: S.log.filter(l => l.ts >= startLogTs && l.cat === 'welt').length,
      projects: S.projects.done.length - before.done,
      votes: S.council.past.length - before.past,
      news: S.news.length - before.news,
      msgs: S.msgs.length - before.msgs,
      dsp: S.dsp.list.length - before.dsp,
      stab: KY.wsim.globalStab() - before.stab,
      regel7: S.stats.crisesAuto - before.crisesAuto,
      lines: S.log.filter(l => l.ts >= startLogTs).slice(-8).map(l => l.text),
    };
    KY.bus.emit('tick', step);
    ['res', 'regions', 'projects', 'council', 'dsp', 'msgs', 'news', 'research', 'infra', 'integ', 'notifs'].forEach(ev => KY.bus.emit(ev));
    if (live && KY.ui && KY.ui.absence) KY.ui.absence(sum);
    return sum;
  };
})();
