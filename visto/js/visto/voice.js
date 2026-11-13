/* VistoOS · visto/voice.js — Sprechen (Sprachausgabe) und Zuhören (Spracherkennung)
 *
 *  V.voice.speak(text, {onWord(i)}) → Promise (auch ohne Ton: wartet Lesedauer ab)
 *  V.voice.stop()
 *  V.voice.listen({onPartial(text), onFinal(text), onEnd(reason)}) → {stop()}  | null wenn nicht möglich
 *  V.voice.canListen   V.voice.canSpeak
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const synth = window.speechSynthesis || null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let voice = null, speaking = false, pulseT = 0, speakToken = 0;
  let dictation = null;      // Claude-Diktierfunktion (nur im Artefakt, Chromium)
  let dictSink = null;

  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
    if (!vs.length) return;
    const pref = [/premium|enhanced|neural|natural/i, /anna|helena|petra|marlene|vicki|katja|google deutsch|deutsch/i];
    voice = vs.find((v) => pref[0].test(v.name)) || vs.find((v) => pref[1].test(v.name)) || vs.find((v) => /de-DE/i.test(v.lang)) || vs[0];
  }
  if (synth) { pickVoice(); try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { synth.onvoiceschanged = pickVoice; } }

  // Claude-Diktat anbieten, falls die Umgebung es hat
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('dictation').then((d) => {
      if (!d) return;
      dictation = d;
      d.onPartial(({ text }) => dictSink && dictSink.onPartial && dictSink.onPartial(text));
      d.onFinal(({ text }) => dictSink && dictSink.onFinal && dictSink.onFinal(text));
      d.onState(({ state, reason }) => { if (state === 'idle' && dictSink) { const s = dictSink; dictSink = null; s.onEnd && s.onEnd(reason || 'stopped'); } });
      V.emit('voice:changed');
    }).catch(() => {});
  }

  function readMs(text) { return U.clamp(String(text).length * 62, 900, 14000) / V.store.get('settings.voiceRate', 1.04); }

  /** Sprechbewegung des Rings */
  function startPulses() {
    clearInterval(pulseT);
    pulseT = setInterval(() => { if (speaking) V.visto.pulse(0.35 + Math.random() * 0.65); }, 150);
  }
  function stopPulses() { clearInterval(pulseT); }

  const voiceApi = (V.voice = {
    get canSpeak() { return !!synth; },
    get canListen() { return !!(dictation || SR); },
    get speaking() { return speaking; },

    speak(text, o = {}) {
      const token = ++speakToken;
      const plain = String(text).replace(/[*_#`>]/g, '').trim();
      if (!plain) return Promise.resolve();
      speaking = true;
      startPulses();
      const done = () => { if (token === speakToken) { speaking = false; stopPulses(); } };
      const useVoice = synth && V.store.get('settings.voice', true) && V.store.get('settings.volume', 0.6) > 0.02;
      if (!useVoice) {
        // stumm: Wörter im Lesetempo „sprechen“
        const words = plain.split(/\s+/);
        const per = readMs(plain) / words.length;
        return new Promise((res) => {
          let i = 0;
          const tick = () => {
            if (token !== speakToken) return res();
            if (o.onWord) o.onWord(i);
            V.visto.pulse(0.5 + Math.random() * 0.4);
            i++;
            if (i < words.length) setTimeout(tick, per);
            else setTimeout(() => { done(); res(); }, 350);
          };
          tick();
        });
      }
      return new Promise((res) => {
        try { synth.cancel(); } catch (e) { /* */ }
        const u = new SpeechSynthesisUtterance(plain);
        u.lang = 'de-DE';
        if (voice) u.voice = voice;
        u.rate = V.store.get('settings.voiceRate', 1.04);
        u.pitch = 1.08;
        u.volume = U.clamp(V.store.get('settings.volume', 0.6) * 1.4, 0, 1);
        let wordI = 0, gotBoundary = false;
        const words = plain.split(/\s+/);
        u.onboundary = (e) => {
          if (e.name && e.name !== 'word') return;
          gotBoundary = true;
          // Wortnummer aus Zeichenposition
          const before = plain.slice(0, e.charIndex).trim();
          wordI = before ? before.split(/\s+/).length : 0;
          if (o.onWord) o.onWord(wordI);
          V.visto.pulse(0.7 + Math.random() * 0.3);
        };
        // Rückfall, falls keine Wortgrenzen gemeldet werden
        const per = readMs(plain) / words.length;
        let fi = 0;
        const fallback = setInterval(() => { if (token !== speakToken) return clearInterval(fallback); if (!gotBoundary && o.onWord && fi < words.length) o.onWord(fi++); }, per);
        let finished = false;
        const fin = () => { if (finished) return; finished = true; clearInterval(fallback); if (o.onWord) o.onWord(words.length - 1); done(); res(); };
        u.onend = fin;
        u.onerror = fin;
        // Sicherheitsnetz (manche Browser melden kein Ende)
        setTimeout(fin, readMs(plain) * 2.2 + 3000);
        try { synth.speak(u); } catch (e) { fin(); }
      });
    },

    stop() {
      speakToken++;
      speaking = false;
      stopPulses();
      if (synth) try { synth.cancel(); } catch (e) { /* */ }
    },

    /** Zuhören. Gibt null zurück, wenn kein Mikrofon-Weg existiert. Muss direkt aus einer Berührung kommen. */
    listen(h = {}) {
      if (V.store.get('settings.micMuted')) return null;
      if (dictation) {
        dictSink = h;
        try {
          dictation.start().catch((e) => { const s = dictSink; dictSink = null; s && s.onEnd && s.onEnd(e && e.code ? e.code : 'error'); });
        } catch (e) { dictSink = null; return null; }
        return { stop: () => { try { dictation.stop(); } catch (e) { /* */ } } };
      }
      if (!SR) return null;
      let rec;
      try { rec = new SR(); } catch (e) { return null; }
      rec.lang = 'de-DE';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '', ended = false;
      let lvlT = setInterval(() => V.visto.setLevel(0.12 + Math.random() * 0.12), 120);
      rec.onspeechstart = () => { clearInterval(lvlT); lvlT = setInterval(() => V.visto.setLevel(0.35 + Math.random() * 0.55), 90); };
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        V.visto.setLevel(0.7 + Math.random() * 0.3);
        if (h.onPartial) h.onPartial((finalText + ' ' + interim).trim());
      };
      rec.onerror = (e) => { if (!ended) { ended = true; clearInterval(lvlT); V.visto.setLevel(0); h.onEnd && h.onEnd(e.error || 'error'); } };
      rec.onend = () => {
        clearInterval(lvlT);
        V.visto.setLevel(0);
        if (ended) return;
        ended = true;
        if (finalText.trim() && h.onFinal) h.onFinal(finalText.trim());
        if (h.onEnd) h.onEnd(finalText.trim() ? 'final' : 'nothing');
      };
      try { rec.start(); } catch (e) { clearInterval(lvlT); return null; }
      return { stop: () => { try { rec.stop(); } catch (e) { /* */ } } };
    },
  });
  void voiceApi;
})();
