/* VistoOS · visto/conversation.js — Ablauf eines Gesprächs mit Visto auf dem Display
 *
 *  V.convo.activate({via: 'tap'|'swipe'|'mic'|'text', text})   Visto aufrufen (optional sofort mit Frage)
 *  V.convo.input(text)                                         Frage stellen (Emulator-Eingabe, Sprache)
 *  V.convo.listen()                                            Mikrofon starten (aus einer Berührung!)
 *  V.convo.close()
 *
 *  Ablauf: Linie → Ring mit Augen (zuhören) → denkt (Ring kreist) → antwortet
 *          (Ring rückt nach oben, Antwort füllt den Kreis Wort für Wort, wird vorgelesen) → Linie.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  let root, qEl, aEl, cardEl, hintEl, chipsEl;
  let active = false, phase = 'idle', closeT = 0, listenH = null, token = 0;
  let micFailed = false;

  const SUGGEST = [
    ['Wie wird das Wetter?', 'Timer 5 Minuten', 'Erzähl einen Witz'],
    ['Wie spät ist es?', 'Licht aus', 'Spiel Musik'],
    ['Was ist 18 mal 24?', 'Weck mich um 7', 'Wie geht es dir?'],
    ['Was steht heute an?', 'Starte Fokus', 'Mach es blau'],
  ];
  let suggI = 0;

  function build() {
    root = V.display.convo;
    qEl = U.el('div', { class: 'cv-text cv-q' });
    aEl = U.el('div', { class: 'cv-text cv-a' });
    cardEl = U.el('div', { class: 'cv-card' });
    hintEl = U.el('div', { class: 'cv-hint' });
    chipsEl = U.el('div', { style: { position: 'absolute', left: 0, right: 0, top: '70.5cqw', display: 'flex', justifyContent: 'center', gap: '1.8cqw', flexWrap: 'wrap', padding: '0 15cqw', pointerEvents: 'auto', transition: 'opacity .4s, transform .5s var(--ease)' } });
    root.append(qEl, aEl, cardEl, hintEl, chipsEl);
    root.style.opacity = '0';
    root.style.transition = 'opacity .35s ease';
    // Scrim: antippen schließt, Ring antippen fragt erneut
    const scrim = V.display.scrim;
    scrim.addEventListener('click', (e) => {
      if (!active || V.shell.swallowClick) return;
      const p = V.display.toLogical(e.clientX, e.clientY);
      const ring = ringPos();
      if (Math.hypot(p.x - ring.x, p.y - ring.y) < ring.r + 50) { convo.listen(true); return; }
      convo.close();
    });
    // Augen folgen dem Finger
    V.display.el.addEventListener('pointermove', (e) => {
      if (!active) return;
      const p = V.display.toLogical(e.clientX, e.clientY);
      V.visto.lookAt(p.x, p.y);
    });
    V.display.el.addEventListener('pointerdown', (e) => {
      if (!active) return;
      const p = V.display.toLogical(e.clientX, e.clientY);
      V.visto.lookAt(p.x, p.y);
    });
    // nach unten wischen schließt
    V.gesture(scrim, { end(p) { if (active && p.moved && p.dy > 90 && Math.abs(p.dx) < p.dy) convo.close(); } });
  }

  let ringNow = { x: 500, y: 455, r: 150 };
  function ringPos() { return ringNow; }
  function place(o) { ringNow = o; V.visto.place(o); }

  function scrimOn(on) {
    const s = V.display.scrim;
    s.style.transition = 'opacity .45s ease';
    s.style.opacity = on ? '0.93' : '0';
    s.style.pointerEvents = on ? 'auto' : 'none';
    root.style.opacity = on ? '1' : '0';
  }

  function clearText() {
    qEl.innerHTML = ''; aEl.innerHTML = ''; cardEl.innerHTML = ''; hintEl.textContent = '';
    cardEl.style.opacity = '0';
  }
  function showChips(on) {
    chipsEl.innerHTML = '';
    if (!on) { chipsEl.style.opacity = '0'; return; }
    const set = SUGGEST[suggI++ % SUGGEST.length];
    for (const s of set) {
      const c = U.el('button', { class: 'vos-chip', text: s, attrs: { type: 'button' } });
      V.ui.tap(c, () => convo.input(s));
      chipsEl.appendChild(c);
    }
    chipsEl.style.opacity = '1';
    chipsEl.style.transform = 'none';
  }
  function hint(text) {
    hintEl.textContent = text;
    hintEl.style.top = '63.5cqw';
    hintEl.style.opacity = text ? '1' : '0';
  }

  function listeningLayout() {
    phase = 'listening';
    clearTimeout(closeT);
    clearText();
    place({ x: 500, y: 430, r: 150 });
    V.visto.setState('listening');
    V.rim.aurora(0.45);
    const can = V.voice.canListen && !micFailed && !V.store.get('settings.micMuted');
    hint(can ? 'Ich höre zu …' : 'Was kann ich für dich tun?');
    showChips(true);
    scheduleClose(14000);
  }

  function scheduleClose(ms) {
    clearTimeout(closeT);
    closeT = setTimeout(() => { if (active && phase !== 'thinking' && !V.voice.speaking) convo.close(); }, ms);
  }

  function renderCard(card) {
    cardEl.innerHTML = '';
    if (!card) { cardEl.style.opacity = '0'; return 0; }
    let el;
    if (card.type === 'big') {
      el = U.el('div', { style: { textAlign: 'center' } },
        U.el('div', { class: 'vos-num', style: { fontSize: (String(card.text).length > 6 ? 11 : 15) + 'cqw', fontWeight: 220, letterSpacing: '-.04em', lineHeight: 1, whiteSpace: 'nowrap' }, text: card.text }),
        card.sub ? U.el('div', { class: 'vos-label', style: { marginTop: '1.6cqw', color: 'rgba(255,255,255,.5)' }, text: card.sub }) : null);
    } else if (card.type === 'icon') {
      const ic = U.el('div', { class: 'vos-icon', style: { '--ic': card.color || V.store.get('settings.accent'), width: '13cqw', height: '13cqw', flex: 'none' }, html: V.icon(card.icon || 'check') });
      el = U.el('div', { style: { display: 'flex', alignItems: 'center', gap: '3.4cqw', background: 'rgba(255,255,255,.08)', padding: '2.4cqw 6cqw 2.4cqw 2.4cqw', borderRadius: '99cqw' } },
        ic, U.el('div', { style: { textAlign: 'left' } }, U.el('div', { style: { fontSize: '5.6cqw', fontWeight: 650, letterSpacing: '-.02em', whiteSpace: 'nowrap' }, text: card.title || '' }), card.sub ? U.el('div', { style: { fontSize: '3.3cqw', color: 'rgba(255,255,255,.55)', whiteSpace: 'nowrap' }, text: card.sub }) : null));
    } else if (card.type === 'el' && card.el) el = card.el;
    if (!el) return 0;
    cardEl.appendChild(el);
    cardEl.style.pointerEvents = '';
    cardEl.style.top = '40cqw';
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'translateX(-50%) scale(.85)';
    cardEl.style.transition = 'opacity .45s ease, transform .6s var(--spring)';
    requestAnimationFrame(() => { cardEl.style.opacity = '1'; cardEl.style.transform = 'translateX(-50%) scale(1)'; });
    return 1;
  }

  async function answer(text, viaVoice) {
    const my = ++token;
    phase = 'thinking';
    clearTimeout(closeT);
    if (listenH) { listenH.stop(); listenH = null; }
    showChips(false);
    hint('');
    aEl.innerHTML = ''; cardEl.innerHTML = '';
    // Frage oben klein
    place({ x: 500, y: 228, r: 92 });
    qEl.innerHTML = '';
    const q = U.el('div', { class: 'cv-line cv-user', style: { top: '34.2cqw', fontSize: '3.7cqw', maxWidth: '64cqw', overflow: 'hidden', textOverflow: 'ellipsis' }, text: '„' + text + '“' });
    qEl.appendChild(q);
    V.visto.setState('thinking');
    V.rim.aurora(0.18);
    let streamed = '';
    let res;
    try {
      res = await V.brain.ask(text, {
        onText(t) {
          if (my !== token) return;
          streamed = t;
          if (phase === 'thinking') { V.visto.setState('speaking'); }
          phase = 'streaming';
          V.ui.fitText(aEl, t, { top: 420, bottom: 845, size: 50, minSize: 32, weight: 520, cls: 'cv-answer' });
        },
      });
    } catch (e) {
      res = { say: 'Hoppla, da ist etwas schiefgelaufen.', emotion: 'sad' };
    }
    if (my !== token || !active) return;
    if (res.silent) { listeningLayout(); return; }
    phase = 'speaking';
    V.rim.aurora(0);
    V.visto.setState('speaking');
    if (res.emotion) V.visto.emote(res.emotion, 3200);
    const hasCard = renderCard(res.card);
    const top = hasCard ? 612 : 420;
    const { words } = V.ui.fitText(aEl, res.say, { top, bottom: hasCard ? 868 : 845, size: hasCard ? 42 : 50, minSize: 30, weight: 520, cls: 'cv-answer', words: true });
    let shown = streamed ? words.length : 0;
    if (streamed) words.forEach((w) => w.classList.add('on'));
    const reveal = (i) => { for (; shown <= Math.min(i + 1, words.length - 1); shown++) words[shown] && words[shown].classList.add('on'); };
    if (res.open) setTimeout(() => { if (my === token) { convo.close(); setTimeout(() => V.shell.open(res.open, res.params || {}), 380); } }, 1500);
    await V.voice.speak(res.say, { onWord: reveal });
    if (my !== token || !active) return;
    words.forEach((w) => w.classList.add('on'));
    V.visto.setState('idle');
    phase = 'answered';
    hint('');
    hintEl.style.top = '90cqw';
    scheduleClose(Math.max(5000, words.length * 380));
    void viaVoice;
  }

  const convo = (V.convo = {
    get active() { return active; },
    get phase() { return phase; },

    activate(o = {}) {
      if (!root) build();
      if (V.shell.mode === 'setup' || V.shell.mode === 'boot') return;
      V.emit('activity');
      if (V.control && V.control.isOpen) V.control.close();
      if (!active) {
        active = true;
        scrimOn(true);
        V.visto.open();
        V.emit('convo:open');
      }
      if (o.text) { convo.input(o.text); return; }
      listeningLayout();
      if (o.via === 'tap' || o.via === 'swipe' || o.via === 'mic') convo.listen(o.via === 'mic');
    },

    listen(force) {
      if (!active) { convo.activate({ via: 'mic' }); return; }
      if (phase !== 'listening') listeningLayout();
      if (!V.voice.canListen || V.store.get('settings.micMuted')) return;
      if (micFailed && !force) return;
      if (listenH) listenH.stop();
      V.emit('voice:listening', true);
      listenH = V.voice.listen({
        onPartial(t) {
          if (!active) return;
          showChips(false);
          hint('');
          V.ui.fitText(aEl, t, { top: 640, bottom: 860, size: 40, minSize: 30, weight: 500, cls: 'cv-user' });
          scheduleClose(14000);
        },
        onFinal(t) { if (active && t) answer(t, true); },
        onEnd(reason) {
          V.emit('voice:listening', false);
          listenH = null;
          if (/not-allowed|service-not-allowed|not_granted|audio-capture/.test(reason || '')) {
            micFailed = true;
            if (active && phase === 'listening') hint('Mikrofon nicht verfügbar – tippe unten.');
          } else if (active && phase === 'listening' && reason !== 'final') {
            hint('Was kann ich für dich tun?');
          }
        },
      });
      if (!listenH) micFailed = true;
    },

    stopListening() { if (listenH) { listenH.stop(); listenH = null; } },

    input(text) {
      text = String(text || '').trim();
      if (!text) return;
      if (!active) { convo.activate({ via: 'text', text }); return; }
      answer(text, false);
    },

    close() {
      if (!active) return;
      active = false;
      token++;
      phase = 'idle';
      clearTimeout(closeT);
      if (listenH) { listenH.stop(); listenH = null; }
      if (V.brain._abort) V.brain._abort();
      V.voice.stop();
      V.rim.aurora(0);
      showChips(false);
      scrimOn(false);
      cardEl.style.pointerEvents = 'none';   // ausblendende Karte darf keine Berührungen schlucken
      setTimeout(() => { if (!active) clearText(); }, 400);
      V.visto.close();
      V.emit('convo:close');
      setTimeout(() => { if (!active) V.emit('convo:closed'); }, 480);   // nach dem Ausblenden: Apps dürfen sichtbar ändern
    },
  });
})();
