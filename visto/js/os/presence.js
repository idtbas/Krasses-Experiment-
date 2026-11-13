/* VistoOS · os/presence.js — Kamera: Wo ist das Gesicht?
 *
 *  Visto hat eine Frontkamera über dem Display. Alles wird auf dem Gerät ausgewertet, nichts verlässt es.
 *  Quelle: die Frontkamera des Handys (Gesichtserkennung lokal im Browser). 'sim' nur für Tests.
 *
 *  V.presence.state = { present, x, y (−1…1, aus Sicht der Person: rechts = +x, unten = +y),
 *                       near (0 = weit weg … 1 = ganz nah), looking (schaut aufs Display), since (ms) }
 *  V.presence.start('camera'|'sim') → Promise<bool>   V.presence.stop()   V.presence.source
 *  Ereignisse: 'presence' (state, ~30× pro Sekunde, geglättet), 'presence:arrive', 'presence:leave', 'presence:look'
 *
 *  Gesichtsabhängige Funktionen (siehe unten „Verbraucher“):
 *   · Visto schaut dich an – Augen folgen deinem Gesicht, auch wenn du dich bewegst
 *   · Näherkommen weckt das Display, Weggehen dimmt es früher
 *   · Anschauen genügt: Wer im Ruhemodus kurz aufs Display blickt, weckt es
 *   · Tiefe: Zifferblatt und Visto-Linie verschieben sich leicht gegeneinander (Parallaxe)
 *   · Fernansicht: Aus der Distanz wird die Uhrzeit größer, Details treten zurück
 *   · Visto begrüßt dich, wenn du nach einer Weile zurückkommst
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

  const st = { present: false, x: 0, y: 0, near: 0.5, looking: false, since: 0, conf: 0 };
  const raw = { seen: false, x: 0, y: 0, near: 0.5, frontal: 0, t: 0 };
  let source = null, video = null, stream = null, detector = null, native = null, busy = false;
  let lastSeen = 0, lookStart = 0, lookFired = false, offLoop = null, lastAway = Date.now();

  const pres = (V.presence = {
    get state() { return st; },
    get source() { return source; },
    get active() { return !!source; },

    async start(kind) {
      pres.stop();
      if (kind === 'sim') {
        source = 'sim';
        raw.seen = true; raw.t = performance.now();
        run();
        V.store.set('settings.camera', 'sim');
        V.emit('presence:source', source);
        return true;
      }
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Keine Kamera verfügbar');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 24 } }, audio: false });
        video = document.createElement('video');
        video.muted = true; video.playsInline = true; video.setAttribute('playsinline', '');
        video.srcObject = stream;
        await video.play();
        await loadDetector();
        source = 'camera';
        V.store.set('settings.camera', 'camera');
        run();
        V.emit('presence:source', source);
        return true;
      } catch (e) {
        console.warn('[VistoOS] Kamera:', e && e.message);
        pres.stop();
        V.emit('presence:error', e && e.message ? e.message : String(e));
        return false;
      }
    },

    stop() {
      if (offLoop) { offLoop(); offLoop = null; }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null; video = null; source = null;
      raw.seen = false;
      if (st.present) { st.present = false; V.emit('presence:leave'); }
      V.emit('presence', st);
      V.emit('presence:source', null);
    },
    off() { pres.stop(); V.store.set('settings.camera', 'off'); },

    /** Simulation: Gesichtsposition setzen (x, y −1…1, near 0…1) oder null = niemand da */
    simulate(x, y, near) {
      if (source !== 'sim') return;
      if (x === null) { raw.seen = false; return; }
      raw.seen = true;
      raw.x = U.clamp(x, -1, 1); raw.y = U.clamp(y, -1, 1);
      if (near !== undefined) raw.near = U.clamp(near, 0, 1);
      raw.frontal = 1 - Math.min(1, Math.hypot(raw.x, raw.y) * 0.8);
      raw.t = performance.now();
    },
  });

  async function loadDetector() {
    if ('FaceDetector' in window) {
      try { native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); return; } catch (e) { native = null; }
    }
    if (detector) return;
    const mod = await import(MP + '/vision_bundle.mjs');
    const files = await mod.FilesetResolver.forVisionTasks(MP + '/wasm');
    const make = (delegate) => mod.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 });
    try { detector = await make('GPU'); } catch (e) { detector = await make('CPU'); }
  }

  /** ein Kamerabild auswerten (höchstens ~15× pro Sekunde) */
  async function detect() {
    if (busy || !video || video.readyState < 2) return;
    busy = true;
    try {
      const vw = video.videoWidth || 320, vh = video.videoHeight || 240;
      let box = null, eyes = null;
      if (native) {
        const fs = await native.detect(video);
        if (fs && fs[0]) {
          const b = fs[0].boundingBox;
          box = { x: b.x / vw, y: b.y / vh, w: b.width / vw, h: b.height / vh };
          const lm = (fs[0].landmarks || []).filter((l) => l.type === 'eye');
          if (lm.length >= 2) eyes = lm.map((l) => ({ x: l.locations[0].x / vw, y: l.locations[0].y / vh }));
        }
      } else if (detector) {
        const r = detector.detectForVideo(video, performance.now());
        const d = r && r.detections && r.detections[0];
        if (d) {
          const b = d.boundingBox;
          box = { x: b.originX / vw, y: b.originY / vh, w: b.width / vw, h: b.height / vh };
          if (d.keypoints && d.keypoints.length >= 2) eyes = [d.keypoints[0], d.keypoints[1]];
        }
      }
      if (box) {
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        raw.seen = true;
        raw.x = U.clamp(-(cx - 0.5) * 2.4, -1, 1);       // gespiegelt: aus Sicht der Person
        raw.y = U.clamp((cy - 0.45) * 2.4, -1, 1);
        raw.near = U.clamp((box.w - 0.12) / 0.45, 0, 1);  // Gesichtsbreite ≈ Nähe
        // schaut aufs Display: Augen waagerecht, Gesicht mittig
        let frontal = 1 - Math.min(1, Math.abs(cx - 0.5) * 2.2);
        if (eyes) {
          const mid = (eyes[0].x + eyes[1].x) / 2;
          const off = Math.abs(mid - cx) / (box.w || 1);   // Kopfdrehung
          frontal *= U.clamp(1 - off * 5, 0, 1);
        }
        raw.frontal = frontal;
        raw.t = performance.now();
      } else raw.seen = false;
    } catch (e) { /* einzelnes Bild verwerfen */ }
    busy = false;
  }

  function run() {
    let acc = 0;
    offLoop = V.loop.add((dt) => {
      if (source === 'camera') { acc += dt; if (acc > 1 / 15) { acc = 0; detect(); } }
      const now = performance.now();
      const seenNow = raw.seen && now - raw.t < (source === 'sim' ? 1e9 : 900);
      if (seenNow) lastSeen = now;
      const present = seenNow || now - lastSeen < 1500;      // kurze Aussetzer überbrücken
      const k = Math.min(1, dt * 7);
      if (seenNow) {
        st.x += (raw.x - st.x) * k;
        st.y += (raw.y - st.y) * k;
        st.near += (raw.near - st.near) * Math.min(1, dt * 2.5);
      }
      if (present !== st.present) {
        st.present = present;
        st.since = Date.now();
        if (present) {
          V.emit('presence:arrive', { away: Date.now() - lastAway });
        } else {
          lastAway = Date.now();
          V.emit('presence:leave');
        }
      }
      const looking = present && raw.frontal > 0.55;
      if (looking) {
        if (!lookStart) lookStart = now;
        if (!lookFired && now - lookStart > 900) { lookFired = true; V.emit('presence:look'); }
      } else { lookStart = 0; lookFired = false; }
      st.looking = looking;
      V.emit('presence', st);
    }, -20);
  }

  /* ----------------------------------------------------------- Verbraucher */

  // 1 · Visto schaut dich an
  V.on('presence', (s) => {
    if (!V.visto) return;
    if (s.present) V.visto.watch(s.x, s.y); else V.visto.watch(null);
  });

  // 2 · Näherkommen weckt, Weggehen dimmt früher · 3 · Anschauen weckt
  V.on('presence:arrive', (e) => {
    V.emit('activity');
    // 6 · Begrüßung nach längerer Abwesenheit (nur Zifferblatt, nicht nachts)
    if (e && e.away > 20 * 60e3 && V.shell.mode === 'home' && !V.time.isNight() && V.visto && !V.visto.isOpen) {
      V.visto.greet();
    }
  });
  V.on('presence:look', () => { if (V.ambient && V.ambient.on) V.ambient.wake(); V.emit('activity'); });
  V.on('presence:leave', () => { V.emit('presence:away'); });

  // 4 · Parallaxe und 5 · Fernansicht auf dem Zifferblatt
  let px = 0, py = 0, far = 0;
  V.on('boot:ready', () => {
    V.loop.add((dt) => {
      const s = st;
      const on = !!source && s.present && V.shell.mode === 'home';
      const tx = on ? s.x : 0, ty = on ? s.y : 0;
      const k = Math.min(1, dt * 4);
      px += (tx - px) * k; py += (ty - py) * k;
      const farT = on && s.near < 0.22 ? 1 : 0;
      far += (farT - far) * Math.min(1, dt * 1.6);
      const home = V.faces && V.faces.home;
      if (!home) return;
      if (Math.abs(px) < 0.002 && Math.abs(py) < 0.002 && far < 0.002) {
        if (home._vpx) { home.style.translate = ''; home.style.scale = ''; home._vpx = false; }
        return;
      }
      home._vpx = true;
      // Inhalt wandert leicht entgegen der Kopfbewegung – wirkt wie Tiefe hinter dem Glas
      home.style.translate = `${(-px * 1.4).toFixed(3)}cqw ${(-py * 1.1).toFixed(3)}cqw`;
      home.style.scale = String((1 + far * 0.1).toFixed(4));
      home.classList.toggle('vos-far', far > 0.5);
    }, 3);
  });

  // gespeicherte Wahl wiederherstellen (Simulation sofort; echte Kamera erst nach Berührung)
  V.on('boot:home', () => {
    const c = V.store.get('settings.camera', 'off');
    if (c === 'camera') {
      const once = () => { window.removeEventListener('pointerdown', once, true); pres.start('camera'); };
      window.addEventListener('pointerdown', once, true);
    }
  });

  V.css('presence', `
    .vos-home.vos-far .mono-cx, .vos-home.vos-far .vos-svg text { transition: opacity .8s; }
    .vos-home.vos-far .mono-cx { opacity: 0 !important; }
  `);
})();
