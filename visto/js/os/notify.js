/* VistoOS · os/notify.js — Hinweise, Alarme, kurze Meldungen
 *
 *  V.notify.banner({title, body, icon, color, onClick, sound: 'notify', silent: false, duration})
 *  V.notify.alert({title, body, icon, color, buttons:[{label, kind, icon, value}], alarm:'chime', rimColor}) → Promise<value>
 *  V.notify.toast(text, icon)
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  let toastEl = null, toastT = 0;
  const queue = [];
  let showing = false;
  let currentAlert = null;

  function showNext() {
    if (showing || !queue.length) return;
    showing = true;
    const o = queue.shift();
    const icon = U.el('div', { class: 'vos-icon', style: { '--ic': o.color || V.store.get('settings.accent') }, html: V.icon(o.icon || 'bell') });
    // data-nogesture: Hochwischen auf dem Hinweis schließt nur ihn (öffnet nicht zusätzlich den Orbit)
    const el = U.el('div', { class: 'vos-banner', attrs: { 'data-nogesture': 'all' } }, icon, U.el('div', null, U.el('b', { text: o.title || '' }), o.body ? U.el('small', { text: o.body }) : null));
    V.display.overlay.appendChild(el);
    const dnd = V.store.get('settings.dnd');
    if (!dnd && !o.silent) { V.sound.play(o.sound || 'notify'); V.haptic([10, 40, 10]); }
    V.rim.pulse({ at: 0, color: o.color || V.store.get('settings.accent'), spread: 80 });
    V.emit('notify', o);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    let gone = false;
    const hide = () => {
      if (gone) return; gone = true;
      el.classList.remove('on');
      setTimeout(() => { el.remove(); showing = false; showNext(); }, 450);
    };
    V.ui.tap(el, () => { hide(); if (o.onClick) o.onClick(); });
    // nach oben wischen schließt
    V.gesture(el, { move(p) { if (p.dy < -20) hide(); } });
    setTimeout(hide, o.duration || 4200);
  }

  V.notify = {
    banner(o) { queue.push(o); showNext(); },

    alert(o) {
      if (currentAlert) currentAlert.close(null);
      return new Promise((resolve) => {
        const color = o.color || V.store.get('settings.accent');
        const acts = U.el('div', { class: 'acts' });
        const el = U.el('div', { class: 'vos-alert' + (o.cls ? ' ' + o.cls : '') },
          o.icon ? U.el('div', { class: 'vos-icon vos-pop', style: { '--ic': color }, html: V.icon(o.icon) }) : null,
          U.el('div', { class: 'vos-h1', text: o.title || '' }),
          o.body ? U.el('div', { class: 'vos-body', style: { maxWidth: '64cqw' }, text: o.body }) : null,
          acts);
        let stopAlarm = null, pulseT = 0, closed = false;
        const close = (val) => {
          if (closed) return; closed = true;
          if (stopAlarm) stopAlarm();
          clearInterval(pulseT);
          V.rim.remove('alert');
          el.classList.remove('on');
          currentAlert = null;
          V.visto && V.visto.setLine(1);
          setTimeout(() => el.remove(), 420);
          resolve(val);
        };
        for (const b of o.buttons || [{ label: 'OK', kind: 'white', value: true }]) {
          acts.appendChild(V.ui.button(b.label, { kind: b.kind || '', icon: b.icon, onClick: () => close(b.value !== undefined ? b.value : b.label) }));
        }
        V.display.top.appendChild(el);
        V.visto && V.visto.setLine(0);
        requestAnimationFrame(() => el.classList.add('on'));
        // Wecker und Timer klingeln auch bei „Nicht stören“ (wie bei Apple); sonst nur Hinweiston ohne „Nicht stören“
        if (o.alarm) stopAlarm = V.sound.alarm(o.alarm);
        else if (!V.store.get('settings.dnd')) V.sound.play(o.sound || 'notify');
        // Rand pulsiert im Takt
        V.rim.arc('alert', { value: 1, color, width: 12, glow: 1.4, alpha: 1, smooth: false });
        let ph = 0;
        pulseT = setInterval(() => { ph += 0.12; const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ph * 5)); V.rim.arc('alert', { alpha: a }); }, 33);
        if (o.timeout) setTimeout(() => close(null), o.timeout);
        currentAlert = { close };
        V.emit('alert', o);
      });
    },
    get alertOpen() { return !!currentAlert; },

    toast(text, icon) {
      if (!toastEl) { toastEl = U.el('div', { class: 'vos-toast' }); V.display.top.appendChild(toastEl); }
      toastEl.innerHTML = (icon ? V.icon(icon) : '') + '<span>' + U.esc(text) + '</span>';
      clearTimeout(toastT);
      requestAnimationFrame(() => toastEl.classList.add('on'));
      toastT = setTimeout(() => toastEl.classList.remove('on'), 1900);
    },
  };
})();
