/* KYTHERA · MANDAT · Taktgeber der Simulation */
(function () {
  'use strict';
  const KY = window.KY;
  const SIM = KY.sim;
  const E = (KY.engine = {});
  E.SPEEDS = [0, 1, 4, 12, 30, 90];
  E.SPEED_NAMES = ['Pause', '1 Tag/s', '4 Tage/s', '12 Tage/s', '30 Tage/s', '90 Tage/s'];
  let acc = 0;

  E.start = function (S, W, isNew) {
    SIM.bind(S, W);
    KY.events.reset();
    KY.sandbox.init(S, S.mode);
    KY.orbit.state();
    KY.nations.init();
    KY.orbit.applyEffects();
    KY.media.initMarkets();
    if (isNew) KY.advisors.welcome();
  };

  E.stepDay = function () {
    const S = SIM.S;
    S.day++;
    KY.finance.daily();
    KY.projects.daily();
    KY.incidents.daily();
    KY.events.daily();
    KY.nations.daily();
    KY.cover.daily();
    KY.research.daily();
    KY.orbit.daily();
    KY.sandbox.daily();
    KY.media.daily();
    if (S.day % 30 === 0) {
      KY.nations.monthly();
      KY.finance.monthly();
      KY.incidents.monthly();
      KY.advisors.monthly();
      KY.orbit.monthly();
      KY.bus.emit('month', S.day);
    }
    if (S.day % 365 === 0) {
      KY.advisors.yearly();
      KY.finance.yearly();
    }
    KY.bus.emit('day', S.day);
  };

  /* dt in Sekunden Echtzeit; liefert Anzahl simulierter Tage */
  E.tick = function (dt) {
    const S = SIM.S;
    if (!S || S.paused) { acc = 0; return 0; }
    acc += Math.min(0.25, dt) * E.SPEEDS[S.speed];
    let n = 0;
    while (acc >= 1 && n < 16) {
      acc -= 1;
      E.stepDay();
      n++;
      if (S.paused) { acc = 0; break; }
    }
    return n;
  };
  E.setSpeed = function (s) {
    const S = SIM.S;
    if (!S) return;
    if (s === 0) { S.paused = true; }
    else { S.speed = s; S.paused = false; }
    KY.bus.emit('speed', { speed: S.speed, paused: S.paused });
  };
  E.toggle = function () {
    const S = SIM.S;
    if (!S) return;
    S.paused = !S.paused;
    KY.bus.emit('speed', { speed: S.speed, paused: S.paused });
  };
  E.pause = function (why) {
    const S = SIM.S;
    if (!S || S.paused) return;
    S.paused = true;
    KY.bus.emit('speed', { speed: S.speed, paused: true, why });
  };
})();
