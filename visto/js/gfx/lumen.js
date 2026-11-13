/* VistoOS · gfx/lumen.js — Lumen-Engine: Licht unter und über der Oberfläche (WebGL)
 *
 *  Zwei Ebenen mit eigenen Shadern:
 *    V.display.back   Lichtgrund – fast schwarz, darin langsam fließende, weiche Lichtschleier;
 *                     zum Rand hin reines OLED-Schwarz. Berührung schickt eine sanfte Welle hindurch,
 *                     die Kopfposition verschiebt das Licht leicht (es liegt „hinter“ dem Glas).
 *    V.display.light  Licht über der Oberfläche – Lichtfleck unter dem Finger mit auslaufendem Ring,
 *                     Linsen-Lichtring (flare) mit Farbsaum, Glanzlicht am Glasrand.
 *
 *  V.lumen.ok                      false = kein WebGL; alle Aufrufe bleiben gefahrlos
 *  V.lumen.quality                 0 aus · 1 sparsam · 2 voll (folgt V.perf; Zuweisen hält fest, null = wieder selbst)
 *  V.lumen.scene(name)             'home' | 'launcher' | 'app' | 'visto' | 'ambient' | 'off'
 *                                  – folgt selbst 'shell:mode', 'ambient', 'convo:open' / 'convo:close'
 *  V.lumen.tint(hex | null, s = 1) Lichtfarbe; null = Akzent – folgt selbst 'app:open' / 'app:close'
 *  V.lumen.touch(x, y, kraft = 1)  Lichtreflex + Welle (logisch 0…1000); hängt selbst an den Zeigerereignissen
 *  V.lumen.flare({ x, y, color, kind: 'iris' | 'ring' | 'burst', size, reverse, strength, duration })
 *        iris   Lichtring läuft vom Symbol (size = Radius) über das ganze Display – wie die App-Blende;
 *               reverse: true zieht ihn zurück zum Symbol (Schließen)
 *        ring   kurzer Ring um eine Stelle (Bestätigung, Hinweis)
 *        burst  weiches Aufleuchten mit schnellem Ring
 *  V.lumen.energy(0…1)             Lebhaftigkeit des Lichtgrunds (Musikpegel, Visto spricht)
 *  V.lumen.state()                 Zustandsbericht für die Diagnose
 *  V.lumen.refresh()               Verdeckung neu prüfen: Unter einer deckenden App (Hintergrund ohne Durchsicht) ruht der
 *                                  Lichtgrund. Apps, die das Licht zeigen wollen, lassen ihren Hintergrund durchsichtig.
 *
 *  Sparsamkeit: Der Lichtgrund wird klein gerechnet (weiche Formen) und nur 30-mal je Sekunde erneuert,
 *  solange nichts geschieht; die Lichtebene zeichnet nur die Rechtecke, in denen wirklich Licht liegt,
 *  und ruht sonst. Jeder Shader liegt in Varianten vor (mit/ohne Wellen, Berührung, Lichtring), damit nie
 *  gerechnet wird, was gerade nicht zu sehen ist – auch auf Grafikchips, die Verzweigungen nicht überspringen.
 *  Im Ruhemodus, bei verdecktem Lichtgrund und verstecktem Tab wird nichts gezeichnet.
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const TAU = Math.PI * 2;
  const MAX_T = 4, MAX_W = 4, MAX_F = 3, LOBES = 3;

  /* ================================================================ Shader */

  const VERT = `
attribute vec2 aPos;
varying vec2 vP;
void main() {
  vP = vec2(aPos.x, -aPos.y);            // −1…1, +y nach unten (wie die logischen Koordinaten)
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  // geordnetes Rauschen gegen Farbstufen in den sehr dunklen Verläufen (± ½ Stufe: Schwarz bleibt Schwarz)
  const DITHER = `
float grain(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))) - 0.5; }`;

  /* Lichtgrund nach dem Vorbild einer kantenbeleuchteten Glasscheibe: Das Licht tritt unten (bei Vistos Linie)
     in das Glas, läuft als weiche Sichel am Rand entlang und verliert sich zur Mitte und nach oben. Darin
     steigen zwei Schleier langsam auf und ab; ihre Lage rechnet die CPU. Der Raum wird sanft verbogen
     (Schleier statt Flecken) und von Berührungswellen gebrochen. Gerechnet wird in Polarkoordinaten –
     der Kreis ist das Prinzip. */
  const FRAG_BACK = `
varying vec2 vP;
uniform vec4 uLobeA[${LOBES}];           // Winkel (0 = unten, Bogenmaß) · Radius · 1/σ²(Winkel) · 1/σ²(nach innen)
uniform vec4 uLobeB[${LOBES}];           // Gewicht · 1/σ²(nach außen) · – · –
uniform vec3 uLobeC[${LOBES}];           // Lichtfarbe (linear)
uniform vec4 uCore;                      // Hauch hinter der Mitte: x, y · 1/σ² · Gewicht
uniform vec3 uCoreC;
uniform vec4 uPh;                        // Phasen der Verbiegung
uniform vec4 uView;                      // Parallaxe x, y · Verstärkung · Körnungsversatz
uniform vec4 uWave[${MAX_W}];            // Mitte x, y · Radius · Stärke
uniform vec2 uWaveB[${MAX_W}];           // 1/Breite · –
uniform vec4 uCrest;                     // Farbe des Wellenkamms (linear) · –
${DITHER}
void main() {
  vec2 p = vP;
  float r = length(p);
  if (r >= 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 q = p - uView.xy;
  float crest = 0.0;
#ifdef WAVES
  for (int i = 0; i < ${MAX_W}; i++) {
    vec4 w = uWave[i];
    if (w.w > 0.0) {
      vec2 d = p - w.xy;
      float l = length(d) + 1e-4;
      float x = (l - w.z) * uWaveB[i].x;
      float g = exp(-x * x) * w.w;
      q -= (d / l) * (x * g) * 0.075;    // die Welle bricht das Licht dahinter
      crest += g;
    }
  }
#endif
  vec2 s = q + 0.15 * vec2(sin(q.y * 1.9 + uPh.x), sin(q.x * 1.6 + uPh.y))
             + 0.05 * vec2(sin(q.y * 4.3 + uPh.z), sin(q.x * 3.7 + uPh.w));
  float rr = length(s);
  float ph = atan(s.x, s.y);             // 0 = unten, links negativ, rechts positiv
  vec3 L = vec3(0.0);
  for (int i = 0; i < ${LOBES}; i++) {
    vec4 A = uLobeA[i];
    vec4 B = uLobeB[i];
    float dp = ph - A.x;
    float dr = rr - A.y;
    L += uLobeC[i] * (B.x * exp(-(dp * dp * A.z + dr * dr * (dr > 0.0 ? B.y : A.w))));
  }
  vec2 dc = s - uCore.xy;
  L += uCoreC * (uCore.w * exp(-dot(dc, dc) * uCore.z));
  float edge = 1.0 - smoothstep(0.6, 0.985, r);
  edge *= edge;                          // zum Rand hin reines Schwarz
  float Y = dot(L, vec3(0.3333));
  L += vec3(Y * Y * 0.18);               // wo viel Licht ist, wird es weißer – Licht statt Farbe
  L = (L * (1.0 + 0.7 * crest) + uCrest.rgb * crest) * (edge * uView.z);
  vec3 c = sqrt(L);                      // lineares Licht → Anzeige
  c = c / (1.0 + c);
  c += grain(gl_FragCoord.xy + uView.w) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

  /* Licht über der Oberfläche. Ausgabe vormultipliziert mit Alpha = hellster Kanal: Das ergibt beim
     gewöhnlichen Überlagern dieselbe Wirkung wie „screen“ – ohne teuren Mischmodus im Browser. */
  const FRAG_LIGHT = `
varying vec2 vP;
uniform vec4 uTouch[${MAX_T}];           // x, y · Radius · Stärke   (Lichtfleck unter dem Finger)
uniform vec4 uRing[${MAX_T}];            // x, y · Radius · Stärke   (auslaufender Ring)
uniform vec3 uTouchC;
uniform vec4 uFlareA[${MAX_F}];          // x, y · Radius · 1/Breite
uniform vec4 uFlareB[${MAX_F}];          // Stärke · Farbsaum · Füllung · Hof
uniform vec3 uFlareC[${MAX_F}];
uniform vec4 uSheen;                     // Richtung x, y · Stärke · Gegenlicht
uniform vec3 uSheenC;
uniform vec4 uMisc;                      // Körnungsversatz · cos(Halbwinkel) · cos(Halbwinkel Gegenlicht) · –
${DITHER}
void main() {
  vec2 p = vP;
  float r = length(p);
  if (r >= 1.0) { gl_FragColor = vec4(0.0); return; }
  vec3 c = vec3(0.0);

  // Glanzlicht am Glasrand: feine Lichtkante mit weichem Hof nach innen, gegenüber ein schwacher Widerschein
  if (r > 0.84) {
    float k = dot(p / r, uSheen.xy);
    float e = 1.0 - r;
    float band = exp(-e * e * 9000.0) + 0.16 * exp(-e * e * 700.0);
    float m = smoothstep(uMisc.y, 1.0, k);
    float n = smoothstep(uMisc.z, 1.0, -k);
    c += uSheenC * (band * (m * m * uSheen.z + n * n * uSheen.w));
  }

#ifdef TOUCH
  for (int i = 0; i < ${MAX_T}; i++) {
    vec4 t = uTouch[i];
    if (t.w > 0.0) {
      vec2 d = p - t.xy;
      c += uTouchC * (t.w * exp(-dot(d, d) / (t.z * t.z)));
    }
    vec4 g = uRing[i];
    if (g.w > 0.0) {
      // wie eine Welle im Wasser: klare Vorderkante, innen läuft das Licht weich aus
      float x = (length(p - g.xy) - g.z) / (0.008 + g.z * 0.055);
      c += uTouchC * (g.w * exp(-x * x * (x > 0.0 ? 2.6 : 0.4)));
    }
  }
#endif

#ifdef FLARE
  for (int i = 0; i < ${MAX_F}; i++) {
    vec4 A = uFlareA[i];
    vec4 B = uFlareB[i];
    if (B.x + B.z > 0.0) {
      vec2 d = p - A.xy;
      float l = length(d) + 1e-4;
      float x = l - A.z;
      if (abs(x) * A.w < 22.0) {         // nur nahe am Ring gibt es etwas zu rechnen
        // Farbsaum: die Farben brechen verschieden stark – Rot läuft außen, Blau innen
        vec3 xs = (vec3(x) + vec3(-B.y, 0.0, B.y)) * A.w;
        vec3 ring = exp(-xs * xs);
        float h = x * A.w * 0.13;
        float halo = exp(-h * h) * B.w;
        float lit = 0.74 + 0.26 * dot(d / l, uSheen.xy);   // dem Licht zugewandte Seite ist heller
        c += (mix(vec3(1.0), uFlareC[i], 0.55) * ring + uFlareC[i] * halo) * (B.x * lit);
      }
      if (B.z > 0.0) c += uFlareC[i] * (B.z * (1.0 - smoothstep(A.z * 0.1, A.z, l)));
    }
  }
#endif

  c = min(c, vec3(1.0));
  c += step(0.002, c) * grain(gl_FragCoord.xy + uMisc.x) / 255.0;
  c = max(c, vec3(0.0));
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`;

  /* ================================================================ Zustand */

  const L = (V.lumen = {
    ok: false,
    get quality() { return quality(); },
    set quality(q) { forced = q === null || q === undefined ? null : U.clamp(q | 0, 0, 2); sizes(); wake(); },
    scene, tint, touch, flare, energy, state,
    /** neu prüfen, ob der Lichtgrund verdeckt ist (z. B. wenn eine App ihren Hintergrund nachträglich ändert) */
    refresh() { if (L.ok) { checkOcclusion(); wake(); } },
  });

  let back = null, light = null;      // { cv, gl, progs, cur, w, lost, shown }
  let forced = null;                  // festgehaltene Qualität
  let webgl = 0;

  // Szenen: Verstärkung · Mitte (Hauch hinter der Mitte) · Weite der Sichel · Fließtempo · Glanzlicht · Sättigung · Sichel
  const SCENES = {
    home:     [1.00, 0.16, 1.00, 1.0, 1.0, 1.00, 1.00],
    launcher: [0.60, 0.10, 2.40, 0.8, 1.0, 0.40, 0.80],
    app:      [0.80, 0.08, 0.88, 0.7, 0.8, 1.00, 1.00],
    visto:    [1.00, 0.85, 1.20, 1.3, 0.6, 0.70, 0.40],
    ambient:  [0.00, 0.16, 1.00, 0.0, 0.0, 1.00, 1.00],
    off:      [0.00, 0.16, 1.00, 0.0, 0.0, 1.00, 1.00],
  };
  let base = 'off', ambientOn = false, convoOn = false, faceDark = false, sceneName = 'off';
  let tintHex = null, tintStrength = 1;
  let occluded = false, occTimer = 0;

  // gleitende Größen (kritisch gedämpft, Federn der Bewegungssprache)
  const GAIN = 0, CORE = 1, SPREAD = 2, FLOW = 3, SHEEN = 4, ENERGY = 5, PX = 6, PY = 7, COL = 8, TC = 17, ARC = 20, NF = 21;
  const cur = new Float32Array(NF), vel = new Float32Array(NF), tgt = new Float32Array(NF), om = new Float32Array(NF);
  const W_GENTLE = TAU / V.motion.gentle.response, W_SMOOTH = TAU / V.motion.smooth.response, W_SNAPPY = TAU / V.motion.snappy.response;
  for (let i = 0; i < NF; i++) om[i] = W_GENTLE;
  om[PX] = om[PY] = W_SMOOTH; om[ENERGY] = W_SMOOTH;
  cur[SPREAD] = tgt[SPREAD] = 1; cur[ARC] = tgt[ARC] = 1;
  let moving = false;

  // Lichtfelder der Sichel: Winkel (0 = unten) · Winkeldrift · Frequenz · Phase · Radius · Radiusdrift
  //                         · σ Winkel · σ nach innen · σ nach außen · Gewicht · Farbe
  const LOBE = [
    [0.00, 0.22, 0.083, 0.0, 0.70, 0.03, 1.05, 0.34, 0.20, 1.00, 0],     // breiter Schein unten (über Vistos Linie)
    [-1.46, 0.30, 0.127, 1.7, 0.66, 0.05, 0.64, 0.30, 0.20, 0.36, 1],    // Schleier, der links aufsteigt
    [1.58, 0.28, 0.099, 3.9, 0.67, 0.05, 0.58, 0.28, 0.20, 0.33, 2],     // … und rechts
  ];
  const BASE_GAIN = 0.024;            // lineares Licht; ergibt etwa 14 % Anzeigehelligkeit im hellsten Teil der Sichel
  const uLobeA = new Float32Array(LOBES * 4), uLobeB = new Float32Array(LOBES * 4), uLobeC = new Float32Array(LOBES * 3);
  const uCore = new Float32Array(4), uCoreC = new Float32Array(3);
  const uPh = new Float32Array(4), uView = new Float32Array(4), uCrest = new Float32Array(4);
  const uWave = new Float32Array(MAX_W * 4), uWaveB = new Float32Array(MAX_W * 2);
  const uTouch = new Float32Array(MAX_T * 4), uRing = new Float32Array(MAX_T * 4), uTouchC = new Float32Array(3);
  const uFlareA = new Float32Array(MAX_F * 4), uFlareB = new Float32Array(MAX_F * 4), uFlareC = new Float32Array(MAX_F * 3);
  const uSheen = new Float32Array(4), uSheenC = new Float32Array(3), uMisc = new Float32Array(4);

  let flowT = 0, clock = 0, grainN = 0;
  let warm = 0, late = 0;             // Abendwärme, späte Nacht (0…1)
  let backAcc = 1, backDirty = true, backDrawn = false, lightDrawn = false, skip = 0, skip2 = 0;
  let draws = 0;

  // Berührungen
  const tId = new Int32Array(MAX_T).fill(-1), tDown = new Uint8Array(MAX_T);
  const tX = new Float32Array(MAX_T), tY = new Float32Array(MAX_T), tTX = new Float32Array(MAX_T), tTY = new Float32Array(MAX_T);
  const tPress = new Float32Array(MAX_T), tK = new Float32Array(MAX_T), tAge = new Float32Array(MAX_T);
  const gX = new Float32Array(MAX_T), gY = new Float32Array(MAX_T), gAge = new Float32Array(MAX_T).fill(-1), gK = new Float32Array(MAX_T);
  // Wellen im Lichtgrund
  const wX = new Float32Array(MAX_W), wY = new Float32Array(MAX_W), wAge = new Float32Array(MAX_W).fill(-1), wK = new Float32Array(MAX_W);
  // Lichtringe
  const fl = [];
  for (let i = 0; i < MAX_F; i++) fl.push({ on: false, x: 0, y: 0, r: 0, g: 0, b: 0, kind: 0, size: 0.1, t: 0, dur: 0.7, rev: false, k: 1, reach: 2 });
  // Glanzlicht
  let sheenA = 315, sheenI = 0, sheenDrawnA = -999, sheenDrawnI = -1;
  const SHEEN_W = 40, SHEEN_W2 = 26;  // Halbwinkel Glanzlicht / Widerschein (Grad)
  // Zeichenbereiche der Lichtebene (uv: x0, y0, x1, y1)
  const rects = new Float32Array(4 * (2 + MAX_T * 2 + MAX_F));
  let nRects = 0;

  function quality() {
    if (!L.ok) return 0;
    if (forced !== null) return forced;
    return V.perf && V.perf.level < 2 ? 1 : 2;
  }
  const lvl = () => (forced !== null ? forced : V.perf ? V.perf.level : 2);

  /* ================================================================ WebGL */

  function makeLayer(cv, alpha, frag, names) {
    const attrs = { alpha, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    let gl = null, v = 2;
    try { gl = cv.getContext('webgl2', attrs); } catch (e) { gl = null; }
    if (!gl) { v = 1; try { gl = cv.getContext('webgl', attrs) || cv.getContext('experimental-webgl', attrs); } catch (e) { gl = null; } }
    if (!gl) return null;
    webgl = v;
    return { cv, gl, frag, names, progs: {}, cur: null, prec: '', w: 0, lost: false, shown: false, alpha };
  }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader: ' + log);
    }
    return s;
  }

  const BACK_U = ['uLobeA', 'uLobeB', 'uLobeC', 'uCore', 'uCoreC', 'uPh', 'uView', 'uWave', 'uWaveB', 'uCrest'];
  const LIGHT_U = ['uTouch', 'uRing', 'uTouchC', 'uFlareA', 'uFlareB', 'uFlareC', 'uSheen', 'uSheenC', 'uMisc'];
  const DEFS = { W: 'WAVES', T: 'TOUCH', F: 'FLARE' };

  /** Grundzustand einer Ebene (nach dem Anlegen und nach einem wiederhergestellten Kontext) */
  function prepare(layer) {
    const gl = layer.gl;
    layer.progs = {}; layer.cur = null;
    // ein Dreieck, das die ganze Fläche deckt
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
    gl.clearColor(0, 0, 0, layer.alpha ? 0 : 1);
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    layer.prec = 'precision ' + (hp && hp.precision > 0 ? 'highp' : 'mediump') + ' float;\n';
    layer.lost = false;
  }
  /** Shader-Variante wählen (key: Buchstaben aus DEFS, z. B. '' · 'W' · 'T' · 'TF'); übersetzt beim ersten Gebrauch */
  function use(layer, key) {
    let p = layer.progs[key];
    if (!p) {
      const gl = layer.gl;
      let defs = '';
      for (let i = 0; i < key.length; i++) defs += '#define ' + DEFS[key[i]] + '\n';
      const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, layer.prec + defs + layer.frag);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Programm: ' + gl.getProgramInfoLog(prog));
      gl.deleteShader(vs); gl.deleteShader(fs);
      const u = {};
      for (const n of layer.names) u[n] = gl.getUniformLocation(prog, n);   // fehlt eine Größe in der Variante: null, Setzen bleibt folgenlos
      p = layer.progs[key] = { prog, u };
    }
    if (layer.cur !== p) { layer.gl.useProgram(p.prog); layer.cur = p; }
    return p.u;
  }
  const buildBack = () => { prepare(back); use(back, ''); };
  const buildLight = () => { prepare(light); use(light, ''); use(light, 'T'); };
  /** übrige Varianten in einer ruhigen Minute vorbereiten, damit die erste Welle / der erste Lichtring nicht stockt */
  function warmUp() {
    const todo = [[back, 'W'], [light, 'F'], [light, 'TF']];
    const next = () => {
      const t = todo.shift();
      if (!t || !L.ok) return;
      try { if (!t[0].lost) { const c = t[0].cur; use(t[0], t[1]); if (c) { t[0].gl.useProgram(c.prog); t[0].cur = c; } } } catch (e) { /* zeigt sich beim Gebrauch */ }
      setTimeout(next, 250);
    };
    setTimeout(next, 1500);
  }

  function watchContext(layer, rebuild) {
    layer.cv.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();               // erlaubt dem Browser, den Kontext wiederherzustellen
      layer.lost = true;
      show(layer, false);
    });
    layer.cv.addEventListener('webglcontextrestored', () => {
      try { rebuild(); layer.w = 0; sizes(); wake(); } catch (e) { console.warn('[VistoOS] Lumen: Kontext nicht wiederherstellbar –', e.message); layer.lost = true; }
    });
  }

  function show(layer, on) {
    if (layer.shown === on) return;
    layer.shown = on;
    layer.cv.style.visibility = on ? '' : 'hidden';   // versteckt = keine Arbeit für die Bildmischung
  }

  /** Auflösung der Ebenen: Gerätepixel (höchstens 2-fach), je Stufe kleiner */
  function sizes() {
    if (!L.ok) return;
    const l = lvl();
    const dev = Math.max(64, V.display.size * Math.min(V.display.dpr || 1, 2));
    const bw = U.clamp(Math.round(dev * [0.34, 0.4, 0.5][l]), 96, 640);
    const lw = U.clamp(Math.round(dev * [0.5, 0.66, 0.85][l]), 128, 960);
    if (back.w !== bw) { back.w = bw; back.cv.width = back.cv.height = bw; if (!back.lost) back.gl.viewport(0, 0, bw, bw); backDirty = true; }
    if (light.w !== lw) { light.w = lw; light.cv.width = light.cv.height = lw; if (!light.lost) light.gl.viewport(0, 0, lw, lw); sheenDrawnA = -999; }
  }

  function wake() { backDirty = true; sheenDrawnA = -999; }

  /* ================================================================ Farbe */

  const tmp = [0, 0, 0];
  function hueShift(rgb, deg, out, o) {
    // RGB (0…1, Anzeige) um den Farbton drehen → lineares Licht nach out[o…o+2]
    const r = rgb[0], g = rgb[1], b = rgb[2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 1e-5) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60;
    }
    const l = (mx + mn) / 2, s = d < 1e-5 ? 0 : d / (1 - Math.abs(2 * l - 1));
    h = (((h + deg) % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let R = 0, G = 0, B = 0;
    if (h < 60) { R = c; G = x; } else if (h < 120) { R = x; G = c; } else if (h < 180) { G = c; B = x; }
    else if (h < 240) { G = x; B = c; } else if (h < 300) { R = x; B = c; } else { R = c; B = x; }
    out[o] = Math.pow(R + m, 2.2); out[o + 1] = Math.pow(G + m, 2.2); out[o + 2] = Math.pow(B + m, 2.2);
  }
  /** Lichtfarbe (linear): gleich hell empfunden, am Abend wärmer, je nach Szene entsättigt */
  function shape(a, o, sat) {
    let r = a[o], g = a[o + 1], b = a[o + 2];
    const mx = Math.max(r, g, b, 1e-4);
    r /= mx; g /= mx; b /= mx;
    // Abend: niedrigere Farbtemperatur – wie ein Filter, der Blau und etwas Grün zurücknimmt.
    // (Zumischen von Bernstein würde blaues Licht nur vergrauen.)
    g *= 1 - 0.2 * warm; b *= 1 - 0.46 * warm;
    // Szene: Richtung neutrales Licht
    r = 0.82 + (r - 0.82) * sat; g = 0.86 + (g - 0.86) * sat; b = 0.95 + (b - 0.95) * sat;
    // Blau wirkt dunkler als Gelb → auf gleiche empfundene Helligkeit bringen
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const k = 1 / Math.pow(0.4 + 0.6 * lum, 0.7);
    a[o] = r * k; a[o + 1] = g * k; a[o + 2] = b * k;
  }
  function colorTargets() {
    const acc = V.store.get('settings.accent', '#FF9A4D');
    let hex = acc;
    if (tintHex) hex = tintStrength >= 1 ? tintHex : U.mix(acc, tintHex, U.clamp(tintStrength, 0, 1));
    const c = U.hexToRgb(hex);
    tmp[0] = c[0] / 255; tmp[1] = c[1] / 255; tmp[2] = c[2] / 255;
    const sat = SCENES[sceneName][5];
    // Nachbarfarben für die beiden Schleier. Dunkles Gelbgrün wirkt schmutzig – deshalb weichen warme Töne
    // Richtung Rot aus und grüne Richtung Türkis; Blau, Violett und Rot dürfen nach beiden Seiten.
    const mx0 = Math.max(tmp[0], tmp[1], tmp[2]), mn0 = Math.min(tmp[0], tmp[1], tmp[2]);
    let hue = 0;
    if (mx0 - mn0 > 1e-5) {
      hue = mx0 === tmp[0] ? ((tmp[1] - tmp[2]) / (mx0 - mn0)) % 6 : mx0 === tmp[1] ? (tmp[2] - tmp[0]) / (mx0 - mn0) + 2 : (tmp[0] - tmp[1]) / (mx0 - mn0) + 4;
      hue = ((hue * 60) + 360) % 360;
    }
    const hA = hue >= 20 && hue < 95 ? -9 : hue >= 95 && hue < 190 ? 14 : 16;
    const hB = hue >= 20 && hue < 95 ? -24 : hue >= 95 && hue < 190 ? 30 : -22;
    const h0 = -12 * Math.max(0, 1 - Math.abs(hue - 56) / 20);   // reines Gelb etwas Richtung Bernstein
    hueShift(tmp, h0, tgt, COL); shape(tgt, COL, sat);
    hueShift(tmp, h0 + hA, tgt, COL + 3); shape(tgt, COL + 3, sat);
    hueShift(tmp, h0 + hB, tgt, COL + 6); shape(tgt, COL + 6, sat);
    // Berührungslicht: fast weiß mit einem Hauch der Lichtfarbe
    hueShift(tmp, 0, tgt, TC);
    const mx = Math.max(tgt[TC], tgt[TC + 1], tgt[TC + 2], 1e-4);
    for (let i = 0; i < 3; i++) tgt[TC + i] = 0.8 + 0.2 * Math.pow(tgt[TC + i] / mx, 1 / 2.2);
    wake();
  }
  function dayTime() {
    const d = V.time.now(), h = d.getHours() + d.getMinutes() / 60;
    warm = h < 12 ? 1 - U.smoothstep(5, 8, h) : U.smoothstep(16.5, 21, h);
    late = h < 12 ? 1 - U.smoothstep(5, 6.5, h) : U.smoothstep(21.5, 23, h);
    colorTargets();
  }

  /* ================================================================ Szene */

  function applyScene() {
    const name = ambientOn ? 'ambient' : convoOn ? 'visto' : base === 'home' && faceDark ? 'off' : base;
    const s = SCENES[name] || SCENES.off;
    const changed = name !== sceneName;
    sceneName = name;
    tgt[GAIN] = s[0] * (1 - 0.3 * late);
    tgt[SHEEN] = s[4] * (1 - 0.35 * late);
    if (s[0] > 0) { tgt[CORE] = s[1]; tgt[SPREAD] = s[2]; tgt[FLOW] = s[3]; tgt[ARC] = s[6]; }   // beim Ausblenden bleibt die Form stehen
    if (changed) colorTargets();
    wake();
  }
  function scene(name) {
    if (!SCENES[name]) return;
    if (name === 'ambient') ambientOn = true;
    else if (name === 'visto') { convoOn = true; ambientOn = false; }
    else { base = name; ambientOn = false; convoOn = false; }
    applyScene();
  }
  function tint(hex, strength) {
    tintHex = hex || null;
    tintStrength = strength === undefined ? 1 : strength;
    colorTargets();
  }
  function energy(v) {
    v = U.clamp(+v || 0, 0, 1);
    om[ENERGY] = v > tgt[ENERGY] ? W_SNAPPY : W_GENTLE;   // rasch hinauf, sanft hinab
    tgt[ENERGY] = v;
  }

  /** Liegt eine deckende App über dem Lichtgrund, braucht er nicht gerechnet zu werden. */
  function checkOcclusion() {
    let occ = false;
    const a = V.shell && V.shell.mode === 'app' ? V.shell.app : null;
    if (a && a.el && !V.shell.busy) {
      const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(a.el).backgroundColor || '');
      if (m) { const p = m[1].split(/[,\s/]+/).filter(Boolean); occ = p.length < 4 || parseFloat(p[3]) >= 0.99; }
    }
    if (occ !== occluded) { occluded = occ; wake(); }
  }
  function occlusionSoon() {
    clearTimeout(occTimer);
    if (occluded) { occluded = false; wake(); }
    occTimer = setTimeout(() => { checkOcclusion(); occTimer = setTimeout(checkOcclusion, 1500); }, 800);
  }

  /* ================================================================ Berührung */

  function wave(x, y, k) {
    let s = 0, oldest = -1;
    for (let i = 0; i < MAX_W; i++) { if (wAge[i] < 0) { s = i; oldest = 1e9; break; } if (wAge[i] > oldest) { oldest = wAge[i]; s = i; } }
    wX[s] = x; wY[s] = y; wAge[s] = 0; wK[s] = k;
  }
  function ringAt(x, y, k) {
    let s = 0, oldest = -1;
    for (let i = 0; i < MAX_T; i++) { if (gAge[i] < 0) { s = i; oldest = 1e9; break; } if (gAge[i] > oldest) { oldest = gAge[i]; s = i; } }
    gX[s] = x; gY[s] = y; gAge[s] = 0; gK[s] = k;
  }
  function spotSlot() {
    let s = 0, low = 9;
    for (let i = 0; i < MAX_T; i++) { if (!tDown[i] && tPress[i] < low) { low = tPress[i]; s = i; } }
    return s;
  }
  const uvx = (x) => (x - 500) / 500;

  function touch(x, y, kraft) {
    if (!L.ok || quality() === 0) return;
    const k = U.clamp(kraft === undefined ? 1 : kraft, 0, 2), ux = uvx(x), uy = uvx(y);
    const s = spotSlot();
    tId[s] = -1; tDown[s] = 0; tX[s] = tTX[s] = ux; tY[s] = tTY[s] = uy; tK[s] = k; tPress[s] = Math.max(tPress[s], 0.85); tAge[s] = 0;
    ringAt(ux, uy, k);
    wave(ux, uy, k);
  }
  function onDown(e) {
    if (!L.ok || quality() === 0 || document.hidden) return;
    const p = V.display.toLogical(e.clientX, e.clientY);
    const ux = uvx(p.x), uy = uvx(p.y);
    if (ux * ux + uy * uy > 1.02) return;
    const k = e.pointerType === 'touch' || e.pointerType === 'pen' ? 1 : 0.9;
    const s = spotSlot();
    tId[s] = e.pointerId; tDown[s] = 1; tX[s] = tTX[s] = ux; tY[s] = tTY[s] = uy; tK[s] = k; tAge[s] = 0;
    ringAt(ux, uy, k);
    wave(ux, uy, k);
  }
  function onMove(e) {
    for (let i = 0; i < MAX_T; i++) {
      if (tDown[i] && tId[i] === e.pointerId) {
        const p = V.display.toLogical(e.clientX, e.clientY);
        tTX[i] = uvx(p.x); tTY[i] = uvx(p.y);
        return;
      }
    }
  }
  function onUp(e) {
    for (let i = 0; i < MAX_T; i++) if (tDown[i] && tId[i] === e.pointerId) tDown[i] = 0;
  }

  /* ================================================================ Lichtring */

  const KINDS = { iris: 0, ring: 1, burst: 2 };
  function flare(o) {
    if (!L.ok || quality() === 0 || !o) return;
    let f = fl[0];
    for (let i = 0; i < MAX_F; i++) { if (!fl[i].on) { f = fl[i]; break; } if (fl[i].t / fl[i].dur > f.t / f.dur) f = fl[i]; }
    const kind = KINDS[o.kind] !== undefined ? KINDS[o.kind] : 1;
    const x = o.x === undefined ? 500 : o.x, y = o.y === undefined ? 500 : o.y;
    f.on = true; f.t = 0; f.kind = kind; f.rev = !!o.reverse;
    f.x = uvx(x); f.y = uvx(y);
    f.size = Math.max(0.02, (o.size === undefined ? (kind === 0 ? 60 : 44) : o.size) / 500);
    f.k = U.clamp(o.strength === undefined ? 1 : o.strength, 0, 2);
    // iris: bis über den fernsten Rand, wie die runde Blende der Shell (Feder, response 0.5)
    f.reach = kind === 0 ? 1.04 + Math.hypot(f.x, f.y) : f.size + (kind === 1 ? 0.5 : 0.42);
    f.dur = o.duration || (kind === 0 ? (f.rev ? 0.5 : 0.78) : kind === 1 ? 0.8 : 0.6);
    const c = U.hexToRgb(o.color || tintHex || V.store.get('settings.accent', '#FF9A4D'));
    const mx = Math.max(c[0], c[1], c[2], 1);
    f.r = c[0] / mx; f.g = c[1] / mx; f.b = c[2] / mx;
  }

  /* ================================================================ Bild */

  function follow(i, dt) {
    const w = om[i], d = cur[i] - tgt[i];
    if (d === 0 && vel[i] === 0) return;
    if (Math.abs(d) < 2e-5 && Math.abs(vel[i]) < 2e-4) { cur[i] = tgt[i]; vel[i] = 0; return; }
    const e = Math.exp(-w * dt), k = (vel[i] + w * d) * dt;
    cur[i] = tgt[i] + (d + k) * e;
    vel[i] = (vel[i] - w * k) * e;
    moving = true;
  }

  function frame(dt) {
    if (!L.ok || document.hidden) return;
    const q = quality(), l = lvl();
    clock += dt;

    // Kopfposition: Das Licht liegt hinter dem Glas und wandert mit dem Blick
    const P = V.presence;
    if (l > 0 && P && P.active && P.state.present) { tgt[PX] = P.state.x; tgt[PY] = P.state.y; } else { tgt[PX] = 0; tgt[PY] = 0; }

    moving = false;
    for (let i = 0; i < NF; i++) follow(i, dt);

    /* ---------------------------------------------------- Lichtgrund */
    let waves = false, fresh = false;
    for (let i = 0; i < MAX_W; i++) {
      if (wAge[i] < 0) continue;
      wAge[i] += dt;
      if (wAge[i] > 2.6) wAge[i] = -1; else { waves = true; if (wAge[i] < 1.1) fresh = true; }
    }
    const lit = cur[GAIN] > 0.002 || tgt[GAIN] > 0;
    if (q === 0 || !lit || occluded || back.lost) {
      if (back.shown && !back.lost) {     // einmal schwarz, dann ruht die Ebene
        back.gl.clear(back.gl.COLOR_BUFFER_BIT);
        show(back, false);
      }
      backDrawn = false;
    } else {
      if (l > 0) flowT += dt * cur[FLOW] * (1 + 0.6 * cur[ENERGY]);
      backAcc += dt;
      // eine frische Welle braucht jedes Bild, die auslaufende ist langsam und schwach: jedes zweite genügt
      const busy = moving || (l > 0 && (fresh || (waves && (skip ^= 1))));
      // ruhiges Fließen: 30 bzw. 20 Bilder je Sekunde genügen; Stufe 0: Standbild (nur Übergänge, jedes zweite Bild)
      const due = backDirty || !backDrawn || (busy ? (l > 0 || (skip2 ^= 1)) : l > 0 && backAcc >= (l > 1 ? 1 / 30 : 1 / 20) - 0.002);
      if (due) { drawBack(l); backAcc = 0; backDirty = false; backDrawn = true; show(back, true); }
    }

    /* ---------------------------------------------------- Licht darüber */
    let live = false;
    for (let i = 0; i < MAX_T; i++) {
      if (tDown[i]) {
        tAge[i] += dt;
        // der Fleck folgt dem Finger ohne Ruck
        const a = 1 - Math.exp(-dt * 26);
        tX[i] += (tTX[i] - tX[i]) * a; tY[i] += (tTY[i] - tY[i]) * a;
        tPress[i] += (1 - tPress[i]) * (1 - Math.exp(-dt * 20));
        if (tAge[i] > 12) tDown[i] = 0;   // verlorenes Loslassen
      } else if (tPress[i] > 0) {
        tPress[i] *= Math.exp(-dt * 7.5);
        if (tPress[i] < 0.004) tPress[i] = 0;
      }
      if (tPress[i] > 0) live = true;
      if (gAge[i] >= 0) { gAge[i] += dt; if (gAge[i] > 0.72) gAge[i] = -1; else live = true; }
    }
    for (let i = 0; i < MAX_F; i++) {
      const f = fl[i];
      if (!f.on) continue;
      f.t += dt;
      if (f.t >= f.dur) f.on = false; else live = true;
    }
    // Glanzlicht: wandert sehr langsam mit der Zeit und deutlich mit dem Kopf
    sheenI = q === 0 ? 0 : cur[SHEEN] * (l > 0 ? 0.9 + 0.1 * Math.sin(clock * 0.31) : 1);
    sheenA = 318 + cur[PX] * 26 + (l > 0 ? 7 * Math.sin(clock * 0.043) + 3 * Math.sin(clock * 0.017 + 1) : 0);
    const sheenOn = sheenI > 0.004;
    if (light.lost) return;
    if (!live && !sheenOn) {
      if (lightDrawn) { light.gl.disable(light.gl.SCISSOR_TEST); light.gl.clear(light.gl.COLOR_BUFFER_BIT); lightDrawn = false; show(light, false); }
      return;
    }
    if (live || Math.abs(sheenA - sheenDrawnA) > 0.2 || Math.abs(sheenI - sheenDrawnI) > 0.004) {
      drawLight(sheenOn);
      sheenDrawnA = sheenA; sheenDrawnI = sheenI; lightDrawn = true;
      show(light, true);
    }
  }

  function drawBack(l) {
    const gl = back.gl;
    const en = cur[ENERGY];
    const sp = cur[SPREAD] * (1 + 0.07 * en);
    for (let i = 0; i < LOBES; i++) {
      const d = LOBE[i], ph = d[3], o = i * 4;
      const sa = d[6] * sp, si = d[7], so = d[8];
      uLobeA[o] = d[0] + d[1] * Math.sin(flowT * d[2] + ph);
      uLobeA[o + 1] = d[4] + d[5] * Math.cos(flowT * d[2] * 0.71 + ph * 1.7);
      uLobeA[o + 2] = 1 / (sa * sa); uLobeA[o + 3] = 1 / (si * si);
      uLobeB[o] = d[9] * cur[ARC] * (0.82 + 0.18 * Math.sin(flowT * d[2] * 0.83 + ph * 3.1));
      uLobeB[o + 1] = 1 / (so * so);
      const c = COL + d[10] * 3;
      uLobeC[i * 3] = cur[c]; uLobeC[i * 3 + 1] = cur[c + 1]; uLobeC[i * 3 + 2] = cur[c + 2];
    }
    uCore[0] = 0.16 * Math.sin(flowT * 0.069 + 5.2); uCore[1] = -0.1 + 0.1 * Math.cos(flowT * 0.057 + 2.1);
    uCore[2] = 1 / (0.46 * 0.46); uCore[3] = cur[CORE];
    uCoreC[0] = cur[COL]; uCoreC[1] = cur[COL + 1]; uCoreC[2] = cur[COL + 2];
    uPh[0] = (flowT * 0.11 + 1.3) % TAU; uPh[1] = (4.1 - flowT * 0.09) % TAU;
    uPh[2] = (-flowT * 0.17) % TAU; uPh[3] = (flowT * 0.13) % TAU;
    uView[0] = cur[PX] * 0.055; uView[1] = cur[PY] * 0.04;
    uView[2] = BASE_GAIN * cur[GAIN] * (1 + 0.55 * en);
    uView[3] = l > 0 ? (grainN = (grainN + 1) % 64) * 5.588238 : 0;
    let nw = 0;
    for (let i = 0; i < MAX_W; i++) {
      const a = wAge[i], o = i * 4;
      if (a < 0 || l === 0) { uWave[o + 3] = 0; continue; }
      nw++;
      uWave[o] = wX[i]; uWave[o + 1] = wY[i];
      uWave[o + 2] = 1.5 * (1 - Math.exp(-0.9 * a));                 // läuft rasch los und wird langsamer
      uWave[o + 3] = wK[i] * Math.min(1, a / 0.09) * Math.exp(-1.35 * a);
      uWaveB[i * 2] = 1 / (0.07 + 0.09 * a);
    }
    // Wellenkamm: ein fester Hauch Licht, unabhängig davon, wie hell die Szene gerade ist
    const ck = (0.0016 * U.clamp(cur[GAIN] * 2, 0, 1)) / Math.max(1e-5, uView[2]);
    uCrest[0] = cur[COL] * ck; uCrest[1] = cur[COL + 1] * ck; uCrest[2] = cur[COL + 2] * ck;

    const u = use(back, nw ? 'W' : '');

    gl.uniform4fv(u.uLobeA, uLobeA); gl.uniform4fv(u.uLobeB, uLobeB); gl.uniform3fv(u.uLobeC, uLobeC);
    gl.uniform4fv(u.uCore, uCore); gl.uniform3fv(u.uCoreC, uCoreC);
    gl.uniform4fv(u.uPh, uPh); gl.uniform4fv(u.uView, uView);
    if (nw) { gl.uniform4fv(u.uWave, uWave); gl.uniform2fv(u.uWaveB, uWaveB); }
    gl.uniform4fv(u.uCrest, uCrest);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    draws++;
  }

  function addRect(x0, y0, x1, y1) {
    const o = nRects * 4;
    rects[o] = Math.max(-1, x0); rects[o + 1] = Math.max(-1, y0); rects[o + 2] = Math.min(1, x1); rects[o + 3] = Math.min(1, y1);
    if (rects[o + 2] > rects[o] && rects[o + 3] > rects[o + 1]) nRects++;
  }
  function addArc(deg, half) {
    let x0 = 2, y0 = 2, x1 = -2, y1 = -2;
    for (let i = 0; i <= 8; i++) {
      const a = ((deg - half + (2 * half * i) / 8) * Math.PI) / 180, sx = Math.sin(a), sy = -Math.cos(a);
      x0 = Math.min(x0, sx, sx * 0.84); x1 = Math.max(x1, sx, sx * 0.84);
      y0 = Math.min(y0, sy, sy * 0.84); y1 = Math.max(y1, sy, sy * 0.84);
    }
    addRect(x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01);
  }
  const critical = (t, resp) => { const w = (TAU / resp) * t; return 1 - (1 + w) * Math.exp(-w); };

  function drawLight(sheenOn) {
    const gl = light.gl;
    let nt = 0, nf = 0;
    nRects = 0;
    // Glanzlicht
    const sa = (sheenA * Math.PI) / 180;
    uSheen[0] = Math.sin(sa); uSheen[1] = -Math.cos(sa);
    uSheen[2] = sheenOn ? 0.14 * sheenI : 0; uSheen[3] = sheenOn ? 0.05 * sheenI : 0;
    uSheenC[0] = 0.9 + 0.1 * cur[TC]; uSheenC[1] = 0.9 + 0.1 * cur[TC + 1]; uSheenC[2] = 0.9 + 0.1 * cur[TC + 2];
    uMisc[0] = (grainN = (grainN + 1) % 64) * 5.588238;
    uMisc[1] = Math.cos((SHEEN_W * Math.PI) / 180); uMisc[2] = Math.cos((SHEEN_W2 * Math.PI) / 180);
    if (sheenOn) { addArc(sheenA, SHEEN_W); addArc(sheenA + 180, SHEEN_W2); }
    // Berührung
    for (let i = 0; i < MAX_T; i++) {
      const o = i * 4, pr = tPress[i];
      if (pr > 0) {
        const rad = 0.105 + 0.03 * Math.min(1, tAge[i] / 0.5) * (tDown[i] ? 1 : 0.6);
        uTouch[o] = tX[i]; uTouch[o + 1] = tY[i]; uTouch[o + 2] = rad; uTouch[o + 3] = 0.19 * pr * tK[i];
        addRect(tX[i] - rad * 2.7, tY[i] - rad * 2.7, tX[i] + rad * 2.7, tY[i] + rad * 2.7);
      } else uTouch[o + 3] = 0;
      const a = gAge[i];
      if (a >= 0) {
        const t = a / 0.72, e = 1 - (1 - t) * (1 - t) * (1 - t);
        const R = 0.05 + 0.33 * e, wdt = (0.008 + R * 0.055) * 1.6;
        uRing[o] = gX[i]; uRing[o + 1] = gY[i]; uRing[o + 2] = R;
        uRing[o + 3] = 0.2 * gK[i] * Math.min(1, a / 0.05) * (1 - t) * (1 - t);
        const ext = R + wdt * 2.7;
        addRect(gX[i] - ext, gY[i] - ext, gX[i] + ext, gY[i] + ext);
      } else uRing[o + 3] = 0;
    }
    uTouchC[0] = cur[TC]; uTouchC[1] = cur[TC + 1]; uTouchC[2] = cur[TC + 2];
    // Lichtringe
    for (let i = 0; i < MAX_F; i++) {
      const f = fl[i], o = i * 4;
      if (!f.on) { uFlareB[o] = 0; uFlareB[o + 2] = 0; continue; }
      const t = f.t / f.dur, rise = Math.min(1, f.t / 0.05);
      let R, wd, I, fringe, fill = 0, halo = 0.16;
      if (f.kind === 0) {              // iris
        const s = critical(f.t, f.rev ? 0.34 : 0.5), k = f.rev ? 1 - s : s;
        R = f.size + (f.reach - f.size) * k;
        wd = 0.0075 + 0.012 * k;
        fringe = wd * (0.42 + 0.3 * k);
        const end = 1 - U.smoothstep(0.72, 1, t);
        I = f.rev ? 0.5 * Math.pow(s, 0.6) * end * rise : 0.62 * Math.pow(1 - s, 0.55) * rise;
        fill = f.rev ? 0 : 0.055 * (1 - s) * (1 - s) * rise;
        halo = 0.2;
      } else if (f.kind === 1) {       // ring
        const e = 1 - Math.pow(1 - t, 3);
        R = f.size + (f.reach - f.size) * e;
        wd = 0.0075 + 0.009 * e;
        fringe = wd * (0.4 + 0.35 * e);
        I = 0.55 * rise * (1 - t) * (1 - t);
      } else {                         // burst
        const e = 1 - Math.pow(1 - t, 4);
        R = f.size * 0.6 + (f.reach - f.size * 0.6) * e;
        wd = 0.009 + 0.012 * e;
        fringe = wd * 0.5;
        I = 0.5 * rise * (1 - t) * (1 - t);
        fill = 0.22 * rise * Math.pow(1 - t, 3);
        halo = 0.3;
      }
      uFlareA[o] = f.x; uFlareA[o + 1] = f.y; uFlareA[o + 2] = R; uFlareA[o + 3] = 1 / wd;
      uFlareB[o] = I * f.k; uFlareB[o + 1] = fringe; uFlareB[o + 2] = fill * f.k; uFlareB[o + 3] = halo;
      uFlareC[i * 3] = f.r; uFlareC[i * 3 + 1] = f.g; uFlareC[i * 3 + 2] = f.b;
      const ext = R + wd * 20;
      addRect(f.x - ext, f.y - ext, f.x + ext, f.y + ext);
    }

    gl.uniform4fv(u.uTouch, uTouch); gl.uniform4fv(u.uRing, uRing); gl.uniform3fv(u.uTouchC, uTouchC);
    gl.uniform4fv(u.uFlareA, uFlareA); gl.uniform4fv(u.uFlareB, uFlareB); gl.uniform3fv(u.uFlareC, uFlareC);
    gl.uniform4fv(u.uSheen, uSheen); gl.uniform3fv(u.uSheenC, uSheenC); gl.uniform4fv(u.uMisc, uMisc);

    // nur die Rechtecke zeichnen, in denen Licht liegt (zusammen kleiner als die halbe Fläche), sonst alles
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    let area = 0;
    for (let i = 0; i < nRects; i++) area += (rects[i * 4 + 2] - rects[i * 4]) * (rects[i * 4 + 3] - rects[i * 4 + 1]);
    if (area > 2.2 || nRects === 0) { gl.drawArrays(gl.TRIANGLES, 0, 3); draws++; return; }
    gl.enable(gl.SCISSOR_TEST);
    const W = light.w, h = W / 2;
    for (let i = 0; i < nRects; i++) {
      const o = i * 4;
      const x0 = Math.floor((rects[o] + 1) * h), x1 = Math.ceil((rects[o + 2] + 1) * h);
      const y0 = Math.floor((1 - rects[o + 3]) * h), y1 = Math.ceil((1 - rects[o + 1]) * h);
      gl.scissor(x0, y0, x1 - x0, y1 - y0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.SCISSOR_TEST);
    draws++;
  }

  /* ================================================================ Start */

  function state() {
    return { ok: L.ok, quality: quality(), webgl, scene: sceneName, tint: tintHex, occluded, back: back ? back.w : 0, light: light ? light.w : 0,
      backShown: !!(back && back.shown), lightShown: !!(light && light.shown), lost: !!(back && back.lost) || !!(light && light.lost), draws };
  }

  let started = false;
  function init() {
    if (started || !V.display || !V.display.back || !V.display.light) return;
    started = true;
    const bc = V.display.back, lc = V.display.light;
    bc.style.visibility = 'hidden'; lc.style.visibility = 'hidden';
    try {
      back = makeLayer(bc, false, FRAG_BACK, BACK_U);
      light = back && makeLayer(lc, true, FRAG_LIGHT, LIGHT_U);
      if (!back || !light) throw new Error('kein WebGL');
      buildBack(); buildLight();
    } catch (e) {
      console.warn('[VistoOS] Lumen aus –', e && e.message);
      bc.style.display = 'none'; lc.style.display = 'none';
      back = light = null;
      return;
    }
    L.ok = true;
    watchContext(back, buildBack);
    watchContext(light, buildLight);
    sizes();
    dayTime();
    applyScene();
    warmUp();

    V.on('display:resize', sizes);
    V.on('perf:level', () => { sizes(); wake(); });
    V.on('time:minute', () => { dayTime(); applyScene(); });
    V.on('time:changed', () => { dayTime(); applyScene(); });
    V.on('store:settings.accent', colorTargets);

    const el = V.display.el;
    el.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    window.addEventListener('pointerup', onUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', onUp, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

    V.loop.add(frame, 90);
  }

  // Szene und Lichtfarbe folgen dem System
  V.on('shell:mode', (m) => {
    base = m === 'home' || m === 'launcher' || m === 'app' ? m : 'off';
    if (L.ok) { applyScene(); occlusionSoon(); }
  });
  V.on('ambient', (on) => { ambientOn = !!on; if (L.ok) applyScene(); });
  V.on('convo:open', () => { convoOn = true; if (L.ok) applyScene(); });
  V.on('convo:close', () => { convoOn = false; if (L.ok) applyScene(); });
  V.on('app:open', (id) => { const d = V.apps && V.apps.get(id); tintHex = d && d.color ? d.color : null; tintStrength = 1; if (L.ok) { colorTargets(); occlusionSoon(); } });
  V.on('app:close', () => { tintHex = null; if (L.ok) { colorTargets(); occlusionSoon(); } });
  V.on('face:changed', (id) => {
    const d = V.faces && V.faces.get(id);
    faceDark = !!(d && (d.lumen === false || id === 'night'));   // Nachtblatt: reines Schwarz
    if (L.ok) applyScene();
  });

  V.on('boot:fx', init);
  V.on('boot:ready', init);
})();
