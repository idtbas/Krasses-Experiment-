// Boot-Animationen der Hersteller: Leinwand über dem Viewer, solange das Gerät bootet und hochläuft.
// Jede Marke zeigt ihr eigenes Messprinzip (Puck-Kopf, SPAD-Matrix, Risley-Rosette, Wellenform, Phasenvergleich …).
// Der Ablauf hängt am echten Zustand der Unit (Selbsttest → Motoranlauf → misst), die Bewegung läuft in echter Zeit.
import { FONTS as F } from './brands.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const seg = (x, a, b) => clamp((x - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (v, d = 0) => v.toFixed(d).replace('.', ',');
const pad = (v, n) => String(Math.max(0, Math.round(v))).padStart(n, '0');

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }

// Turbo-Farbskala (Google) als CSS-Farbe
function turbo(t, a = 1) {
  t = clamp(t);
  const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
  const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
  const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
  const c = (v) => Math.round(clamp(v) * 255);
  return `rgba(${c(r)},${c(g)},${c(b)},${a})`;
}

/* ---------------- Zeichenhilfen ---------------- */
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fillBg(g, S, c0, c1, radial) {
  let gr;
  if (radial) { const x = S.W * radial[0], y = S.H * radial[1]; gr = g.createRadialGradient(x, y, 0, x, y, Math.hypot(S.W, S.H) * (radial[2] || 0.7)); }
  else gr = g.createLinearGradient(0, 0, 0, S.H);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillRect(0, 0, S.W, S.H);
}
// Text mit optionaler Sperrung (ls in em); gibt die Breite zurück
function text(g, s, x, y, o = {}) {
  const size = o.size || 12;
  g.font = `${o.it ? 'italic ' : ''}${o.w || 400} ${size}px ${o.f || F.sf}`;
  g.textBaseline = o.bl || 'alphabetic';
  const a = o.a ?? 1;
  if (a <= 0.003 || !s) return 0;
  g.globalAlpha = a;
  g.fillStyle = o.c || '#fff';
  let w;
  if (o.ls) {
    const sp = o.ls * size, ws = [];
    w = 0;
    for (const ch of s) { const cw = g.measureText(ch).width; ws.push(cw); w += cw + sp; }
    w -= sp;
    let cx = o.al === 'center' ? x - w / 2 : o.al === 'right' ? x - w : x;
    g.textAlign = 'left';
    let i = 0;
    for (const ch of s) { g.fillText(ch, cx, y); cx += ws[i++] + sp; }
  } else { g.textAlign = o.al || 'left'; g.fillText(s, x, y); w = g.measureText(s).width; }
  g.globalAlpha = 1;
  return w;
}
function bar(g, x, y, w, h, p, fg, bg, r = h / 2) {
  if (bg) { g.fillStyle = bg; rr(g, x, y, w, h, r); g.fill(); }
  p = clamp(p);
  if (p > 0) { g.fillStyle = fg; rr(g, x, y, Math.max(Math.min(w, h), w * p), h, r); g.fill(); }
}
function line(g, x0, y0, x1, y1, c, w = 1, a = 1) { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.globalAlpha = 1; }
function circle(g, x, y, r, o = {}) {
  g.beginPath(); g.arc(x, y, Math.max(0, r), o.a0 ?? 0, o.a1 ?? TAU);
  g.globalAlpha = o.a ?? 1;
  if (o.fill) { g.fillStyle = o.fill; g.fill(); }
  if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.w || 1; g.stroke(); }
  g.globalAlpha = 1;
}
function gridLines(g, x, y, w, h, step, c, a = 1) {
  g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = 1; g.beginPath();
  for (let xx = x; xx <= x + w + 0.5; xx += step) { g.moveTo(Math.round(xx) + 0.5, y); g.lineTo(Math.round(xx) + 0.5, y + h); }
  for (let yy = y; yy <= y + h + 0.5; yy += step) { g.moveTo(x, Math.round(yy) + 0.5); g.lineTo(x + w, Math.round(yy) + 0.5); }
  g.stroke(); g.globalAlpha = 1;
}
// eigene Zeichenebene (z. B. für nachleuchtende Punkte)
function layer(S, w = S.W, h = S.H) {
  const c = document.createElement('canvas'), d = S.dpr;
  c.width = Math.max(1, Math.round(w * d)); c.height = Math.max(1, Math.round(h * d));
  const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
  return { c, g: x, w, h };
}
function fade(L, a) { const g = L.g; g.globalCompositeOperation = 'destination-out'; g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, L.w, L.h); g.globalCompositeOperation = 'source-over'; }
function blit(g, L, x = 0, y = 0) { g.drawImage(L.c, x, y, L.w, L.h); }

// Protokoll: Zeilen erscheinen nacheinander (nach Zeit und echtem Fortschritt) und werden getippt
// Zeile: { s: Text oder S => Text, at: frühestens nach s, p: frühestens ab Fortschritt, ok: Fortschritt für die Quittung, okText, c }
const lstr = (L, S) => (typeof L.s === 'function' ? L.s(S) : L.s);
function log(g, S, st, lines, x, y, o = {}) {
  const T = st._log || (st._log = []);
  const u = S.u, lh = o.lh ?? 15.5 * u, cps = o.cps ?? 80, size = o.size ?? 11 * u, max = o.max ?? 99;
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (T[i] == null) {
      const L = lines[i];
      const prevDone = i === 0 || (S.t - T[i - 1]) * cps >= lstr(lines[i - 1], S).length;
      if (prevDone && S.t >= (L.at ?? 0) && S.p >= (L.p ?? 0)) T[i] = S.t; else break;
    }
    last = i;
  }
  const first = Math.max(0, last - max + 1);
  let yy = y;
  for (let i = first; i <= last; i++) {
    const L = lines[i], s = lstr(L, S);
    const n = Math.min(s.length, Math.floor((S.t - T[i]) * cps));
    const age = i - first, a = o.fadeOld && last - first >= 3 ? 0.45 + 0.55 * (age / (last - first)) : 1;
    const w = text(g, s.slice(0, n), x, yy, { f: o.f || F.mono, size, c: L.c || o.c || '#cfd6dd', w: o.w || 400, a });
    if (i === last && (n < s.length || Math.floor(S.t * 2.4) % 2 === 0)) { g.fillStyle = o.cur || o.c || '#cfd6dd'; g.fillRect(x + w + 2, yy - size * 0.82, size * 0.55, size * 0.95); }
    if (L.ok != null && n >= s.length && o.okX) {
      const done = S.p >= L.ok;
      text(g, done ? (L.okText || o.okText || 'OK') : '|/-\\'[Math.floor(S.t * 10) % 4], x + o.okX, yy, { f: o.f || F.mono, size, c: done ? (o.okC || '#3fcf73') : (o.dimC || '#8a8f96'), al: 'right', w: 700 });
    }
    yy += lh;
  }
  return yy;
}

// synthetischer Raum in Polarkoordinaten (Wände + Pfeiler), für Draufsichten
function roomPolar(seed, N = 720) {
  const R = rng(seed);
  const xr = 2.5 + R() * 4, xl = -(2.5 + R() * 4), zt = 1.8 + R() * 3, zb = -(1.8 + R() * 3);
  const posts = Array.from({ length: 5 }, () => [lerp(xl, xr, 0.15 + R() * 0.7), lerp(zb, zt, 0.15 + R() * 0.7), 0.12 + R() * 0.3]).filter(([x, z, r]) => Math.hypot(x, z) > r + 0.6);
  const r = new Float32Array(N);
  let max = 0;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU, dx = Math.cos(th), dz = Math.sin(th);
    let t = Math.min(dx > 1e-6 ? xr / dx : dx < -1e-6 ? xl / dx : Infinity, dz > 1e-6 ? zt / dz : dz < -1e-6 ? zb / dz : Infinity);
    for (const [px, pz, pr] of posts) {
      const b = dx * px + dz * pz, disc = b * b - (px * px + pz * pz - pr * pr);
      if (disc > 0) { const tt = b - Math.sqrt(disc); if (tt > 0 && tt < t) t = tt; }
    }
    r[i] = t; if (t > max) max = t;
  }
  return { r, max, N, at: (th) => r[((Math.round((th / TAU) * N) % N) + N) % N] };
}

// Kopfzeile: Wortmarke links, Modell darunter, rechts Seriennummer
function header(g, S, o) {
  const u = S.u, x = o.x ?? 26 * u, y = o.y ?? 38 * u;
  let w = text(g, o.word, x, y, { f: o.f, size: (o.size || 17) * u, w: o.w || 800, c: o.c, ls: o.ls, it: o.it });
  if (o.word2) text(g, o.word2, x + w + 7 * u, y, { f: o.f, size: (o.size2 || o.size || 17) * u, w: o.w2 || 300, c: o.c2 || o.c, ls: o.ls2 ?? o.ls });
  if (o.model !== false) text(g, o.model || S.dev.model, x, y + 20 * u, { f: o.fm || o.f, size: 12.5 * u, w: 400, c: o.cm || 'rgba(255,255,255,.6)', ls: o.lsm });
  if (o.right !== false) {
    text(g, o.right || `S/N ${S.dev.serial}`, S.W - x, y - 2 * u, { f: F.mono, size: 10.5 * u, c: o.cr || 'rgba(255,255,255,.45)', al: 'right' });
    if (o.right2) text(g, o.right2, S.W - x, y + 13 * u, { f: F.mono, size: 10.5 * u, c: o.cr || 'rgba(255,255,255,.45)', al: 'right' });
  }
}

/* ======================================================================================
   Szenen. Jede Szene: init(S) → Zustand, draw(g, S, st). S: t, dt, W, H, u, p, pb, ps, rpm, ready, out, dev …
   ====================================================================================== */
const SC = {};

/* ---------- ECHO (unbekannte Marke) ---------- */
SC.echo = {
  draw(g, S) {
    const u = S.u, cx = S.W / 2, cy = S.H / 2;
    fillBg(g, S, '#0c1824', '#020304', [0.5, 0.5, 0.7]);
    for (let i = 0; i < 4; i++) {
      const r = ((S.t * 0.6 + i / 4) % 1) * Math.min(S.W, S.H) * 0.45;
      circle(g, cx, cy, r, { stroke: '#35d0ff', w: 1.5, a: 0.5 * (1 - r / (Math.min(S.W, S.H) * 0.45)) });
    }
    text(g, 'ECHO', cx, cy + 6 * u, { size: 34 * u, w: 800, c: '#e9f6ff', al: 'center', ls: 0.3 });
    text(g, S.dev.model, cx, cy + 32 * u, { size: 12 * u, c: 'rgba(233,246,255,.6)', al: 'center' });
    bar(g, cx - 120 * u, cy + 56 * u, 240 * u, 3 * u, S.p, '#35d0ff', 'rgba(255,255,255,.1)');
  },
};

/* ---------- Velodyne: der Puck – Kopf läuft auf Solldrehzahl, Laserfächer, Draufsicht wie im Viewer ---------- */
function puck(g, cx, cy, R, hh, phi, S, firing) {
  const k = 0.28, top = cy - hh / 2, bot = cy + hh / 2, cap = hh * 0.3;
  const metal = (y0, y1) => {
    const gr = g.createLinearGradient(cx - R, 0, cx + R, 0);
    gr.addColorStop(0, '#2b3036'); gr.addColorStop(0.22, '#b8bec5'); gr.addColorStop(0.42, '#e3e7ea'); gr.addColorStop(0.7, '#7c838b'); gr.addColorStop(1, '#2a2e33');
    g.fillStyle = gr; g.fillRect(cx - R, y0, 2 * R, y1 - y0);
  };
  // Schatten
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(cx, bot + R * 0.18, R * 1.15, R * k * 0.9, 0, 0, TAU); g.fill();
  // Boden
  g.fillStyle = '#3a4047'; g.beginPath(); g.ellipse(cx, bot, R, R * k, 0, 0, Math.PI); g.fill();
  metal(bot - cap, bot);
  // Fenster (schwarzes Band) mit Spiegelung
  const wy0 = top + cap, wy1 = bot - cap;
  const wg = g.createLinearGradient(cx - R, 0, cx + R, 0);
  wg.addColorStop(0, '#020304'); wg.addColorStop(0.3, '#16202a'); wg.addColorStop(0.36, '#0b1118'); wg.addColorStop(1, '#020304');
  g.fillStyle = wg; g.fillRect(cx - R, wy0, 2 * R, wy1 - wy0);
  // innen umlaufender Messkopf: Sender (rot glimmend) und Empfängerlinse
  for (const [off, col, wdt] of [[0, firing ? 'rgba(255,60,40,.95)' : 'rgba(120,30,25,.7)', 0.16], [0.55, 'rgba(90,140,200,.55)', 0.22]]) {
    const a = phi + off, c = Math.cos(a);
    if (c <= 0) continue;
    const x = cx + R * 0.94 * Math.sin(a), w = R * wdt * c;
    const eg = g.createLinearGradient(x - w, 0, x + w, 0);
    eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(0.5, col); eg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = eg; g.fillRect(x - w, wy0 + 2, 2 * w, wy1 - wy0 - 4);
  }
  // Deckel mit Kühlrippen
  metal(top, top + cap);
  g.strokeStyle = 'rgba(20,24,28,.55)'; g.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { const y = top + (cap * i) / 5; g.beginPath(); g.ellipse(cx, y, R, R * k * 0.25, 0, 0, Math.PI); g.stroke(); }
  for (let i = 1; i <= 4; i++) { const y = bot - cap + (cap * i) / 5; g.beginPath(); g.ellipse(cx, y, R, R * k * 0.25, 0, 0, Math.PI); g.stroke(); }
  const tg = g.createLinearGradient(cx - R, top - R * k, cx + R, top + R * k);
  tg.addColorStop(0, '#d9dde1'); tg.addColorStop(0.5, '#9aa1a8'); tg.addColorStop(1, '#5c636a');
  g.fillStyle = tg; g.beginPath(); g.ellipse(cx, top, R, R * k, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(cx, top, R * 0.72, R * k * 0.72, 0, 0, TAU); g.stroke();
  // Kabel
  g.strokeStyle = '#15181b'; g.lineWidth = R * 0.08; g.beginPath(); g.moveTo(cx + R * 0.55, bot + R * 0.05); g.quadraticCurveTo(cx + R * 1.1, bot + R * 0.4, cx + R * 1.6, bot + R * 0.36); g.stroke();
}
SC.velodyne = {
  init(S) { return { phi: 0, last: 0, room: roomPolar(S.seed), L: layer(S) }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev;
    fillBg(g, S, '#0a1520', '#000000', [0.32, 0.5, 0.75]);
    gridLines(g, 0, 0, W, H, 32 * u, '#1b2a38', 0.25);
    const prev = st.phi;
    st.phi += S.dt * TAU * Math.min(S.rpm / 60, 1.15); // sichtbar verlangsamt (sonst Stroboskop)
    const firing = S.ps > 0.9 || S.ready;
    const wide = W / H > 1.12;
    const pcx = wide ? W * 0.29 : W * 0.5, pcy = wide ? H * 0.47 : H * 0.36, R = (wide ? 74 : 60) * u, hh = R * 1.3;
    // Laserfächer (rechts, wenn der Kopf zur Seite schaut)
    if (firing) {
      const P = D.P, el = P.elev || [0];
      for (const side of [1, -1]) {
        const a = Math.pow(clamp(Math.sin(st.phi) * side), 3);
        if (a < 0.02) continue;
        const x0 = pcx + side * R, len = (wide ? 190 : 140) * u;
        for (let i = 0; i < el.length; i += Math.max(1, Math.floor(el.length / 32))) {
          const e = (el[i] * Math.PI) / 180 * 1.8;
          const x1 = x0 + side * len * Math.cos(e), y1 = pcy - len * Math.sin(e);
          const gr = g.createLinearGradient(x0, pcy, x1, y1);
          gr.addColorStop(0, `rgba(255,70,50,${0.55 * a})`); gr.addColorStop(1, 'rgba(255,70,50,0)');
          g.strokeStyle = gr; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, pcy); g.lineTo(x1, y1); g.stroke();
          circle(g, x0 + side * len * 0.62 * Math.cos(e), pcy - len * 0.62 * Math.sin(e), 1.6 * u, { fill: turbo(0.3 + (i / el.length) * 0.6), a: a });
        }
      }
    }
    puck(g, pcx, pcy, R, hh, st.phi, S, firing);
    // Drehzahl
    const gx = wide ? pcx - 120 * u : pcx - 120 * u, gy = pcy + hh / 2 + 62 * u, gw = 240 * u;
    text(g, pad(S.rpm, 3), gx, gy - 14 * u, { f: F.mono, size: 30 * u, w: 600, c: '#e8eef4' });
    text(g, 'RPM', gx + 62 * u, gy - 14 * u, { f: F.segoe, size: 12 * u, w: 600, c: '#1f7bd8', ls: 0.12 });
    text(g, `Soll ${D.hz * 60}`, gx + gw, gy - 14 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(255,255,255,.5)', al: 'right' });
    for (let i = 0; i <= 12; i++) line(g, gx + (gw * i) / 12, gy, gx + (gw * i) / 12, gy + (i % 3 ? 4 : 8) * u, '#4a5866', 1);
    bar(g, gx, gy + 11 * u, gw, 3 * u, S.rpm / 1200, '#1f7bd8', 'rgba(255,255,255,.08)');
    line(g, gx + (gw * D.hz * 60) / 1200, gy - 2 * u, gx + (gw * D.hz * 60) / 1200, gy + 16 * u, '#ffffff', 1.5, 0.8);
    text(g, '300 – 1200 RPM', gx, gy + 28 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(255,255,255,.35)' });
    // Draufsicht
    const ox = wide ? W * 0.71 : W * 0.5, oy = wide ? H * 0.45 : H * 0.72, Rp = wide ? Math.min(W * 0.21, H * 0.33) : Math.min(W * 0.36, H * 0.2);
    for (let i = 1; i <= 4; i++) circle(g, ox, oy, (Rp * i) / 4, { stroke: '#1d3550', w: 1, a: 0.9 });
    line(g, ox - Rp, oy, ox + Rp, oy, '#1d3550'); line(g, ox, oy - Rp, ox, oy + Rp, '#1d3550');
    for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; line(g, ox + Math.cos(a) * Rp, oy + Math.sin(a) * Rp, ox + Math.cos(a) * (Rp + (i % 9 ? 3 : 7) * u), oy + Math.sin(a) * (Rp + (i % 9 ? 3 : 7) * u), '#2f4d6d'); }
    // Punkte: nachleuchtende Ebene, nur im überstrichenen Winkel
    const L = st.L;
    fade(L, Math.min(0.5, S.dt * 0.35));
    if (firing) {
      // Halle (Raum × 3), Sensor 1,5 m hoch: Kanäle nach unten zeichnen Bodenringe, die übrigen treffen die Wände
      const M = 3, sc = (Rp * 0.94) / (st.room.max * M), lg = L.g, el = D.P.elev || [0];
      const a0 = prev, a1 = st.phi, n = Math.min(360, Math.ceil(((a1 - a0) / TAU) * 540));
      for (let k = 0; k < n; k++) {
        const th = a0 + ((a1 - a0) * k) / n, wall = st.room.at(th) * M;
        for (let c = 0; c < el.length; c += Math.max(1, Math.floor(el.length / 16))) {
          const e = (el[c] * Math.PI) / 180, floor = e < -0.005 ? 1.5 / Math.tan(-e) : Infinity;
          const r = Math.min(wall, floor) * sc * (1 + (Math.random() - 0.5) * 0.01);
          lg.fillStyle = turbo(floor < wall ? 0.15 + 0.35 * (floor / wall) : 0.62 + 0.3 * ((el[c] + 15) / 30), 0.95);
          lg.fillRect(ox + Math.cos(th) * r - 0.7, oy + Math.sin(th) * r - 0.7, 1.4, 1.4);
        }
      }
    }
    blit(g, L);
    // Kegel des Kopfs
    for (let i = 0; i < 14; i++) {
      const a = st.phi - (i / 14) * 0.8;
      g.fillStyle = `rgba(31,123,216,${0.16 * (1 - i / 14)})`; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, Rp, a - 0.06, a); g.closePath(); g.fill();
    }
    line(g, ox, oy, ox + Math.cos(st.phi) * Rp, oy + Math.sin(st.phi) * Rp, '#5fb0ff', 1.5, 0.9);
    circle(g, ox, oy, 4 * u, { fill: '#e6ebef' });
    text(g, firing ? 'LASER ON' : S.ps > 0 ? 'MOTOR SPIN-UP' : 'SELF-TEST', ox, oy + Rp + 26 * u, { f: F.segoe, size: 10.5 * u, w: 700, c: firing ? '#ff6a55' : '#8fb4d9', al: 'center', ls: 0.2 });
    header(g, S, { word: 'VELODYNE', word2: 'LIDAR', f: F.segoe, size: 17, w: 800, ls: 0.06, c: '#f2f5f8', c2: '#3d97f0', ls2: 0.22, right2: 'FW 3.0.41.1' });
    const lines = [
      { s: `Booting ${D.model.replace(/[„“]/g, '')} …`, at: 0.1 },
      { s: `Self-test laser diodes ${D.ch}/${D.ch}`, p: 0.05, ok: 0.3 },
      { s: 'Ethernet 100BASE-TX link up', p: 0.2, ok: 0.34 },
      { s: 'IP 192.168.1.201 → 255.255.255.255', p: 0.34 },
      { s: 'UDP 2368 data · 8308 position', p: 0.4 },
      { s: (s) => `Motor ${pad(s.rpm, 3)} / ${D.hz * 60} RPM`, p: S.wb, ok: 0.995, okText: 'LOCK' },
      { s: 'GPS: no NMEA · PPS: absent', p: S.wb + 0.05 },
      { s: `Return mode: ${{ strongest: 'Strongest', last: 'Last', dual: 'Dual' }[D.returns] || 'Strongest'}`, p: 0.98 },
    ];
    log(g, S, st, lines, 26 * u, wide ? H - 118 * u : H * 0.53, { f: F.mono, c: '#9fb3c7', okX: 270 * u, okC: '#3fcf73', max: wide ? 6 : 4, fadeOld: true });
  },
};

/* ---------- Ouster: Digitales LiDAR – SPAD-Matrix, Photonen-Histogramm, Panorama-Abstandsbild ---------- */
SC.ouster = {
  init(S) {
    const R = rng(S.seed);
    const rows = Math.min(48, S.dev.ch), cols = 64;
    return { rows, cols, noise: Float32Array.from({ length: rows * cols }, () => R()), scroll: 0, enc: 0 };
  },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, LIME = '#d9ff4a';
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const cx = W / 2;
    text(g, 'OUSTER', cx, 46 * u, { f: F.helv, size: 18 * u, w: 500, c: '#ffffff', al: 'center', ls: 0.62 });
    text(g, D.model.toUpperCase() + '  ·  DIGITAL LIDAR', cx, 66 * u, { f: F.helv, size: 10 * u, w: 500, c: 'rgba(255,255,255,.45)', al: 'center', ls: 0.3 });
    // Matrix
    const gw = Math.min(W * 0.62, 520 * u), cs = gw / st.cols, gh = cs * st.rows * 0.62, gx = cx - gw / 2, gy = Math.max(96 * u, H * 0.42 - gh / 2);
    const ch = gh / st.rows;
    st.scroll += S.dt * (S.rpmFrac * 22 + (S.ready ? 4 : 0));
    const readCol = (S.t * 26) % st.cols;
    const flash = S.pb > 0.35 ? Math.pow(Math.max(0, Math.sin(S.t * 9)), 18) : 0;
    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const n = st.noise[r * st.cols + c];
        let v, col;
        if (S.ps > 0 || S.ready) {
          // Panorama: Spalten laufen mit der Drehung durch, Werte = Entfernung einer gedachten Halle
          const az = ((c + st.scroll) / st.cols) * TAU, el = (r / st.rows - 0.5) * 1.2;
          const wall = 0.55 + 0.25 * Math.sin(az * 2 + 0.6) + 0.12 * Math.sin(az * 7);
          const d = el > 0.18 ? 0.25 + (el - 0.18) * 1.4 : wall + (Math.sin(az * 13 + r * 0.3) > 0.92 ? -0.3 : 0);
          const reveal = clamp((S.ps * st.cols * 1.6 - ((c + st.cols) % st.cols)) / 6) || (S.ready ? 1 : 0);
          v = (1 - clamp(d)) * reveal; col = v;
        } else {
          // Dunkelzählrate (Rauschen) und Kalibrier-Auslese
          const near = Math.abs(c - readCol) < 1.5 ? 0.7 : 0;
          v = Math.pow(n, 6) * 0.5 * S.pb + near * S.pb + flash * 0.5 * (r % 2 ? 1 : 0.6);
          col = -1;
        }
        if (v < 0.02) { g.fillStyle = '#0d0d10'; g.fillRect(gx + c * cs + 0.5, gy + r * ch + 0.5, cs - 1, ch - 1); continue; }
        g.fillStyle = col < 0 ? `rgba(217,255,74,${clamp(v)})` : `hsl(${lerp(265, 70, col)},${lerp(60, 100, col)}%,${lerp(28, 62, col)}%)`;
        g.fillRect(gx + c * cs + 0.5, gy + r * ch + 0.5, cs - 1, ch - 1);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.strokeRect(gx - 4.5, gy - 4.5, gw + 9, gh + 9);
    text(g, `${D.ch} PIXEL / SPALTE`, gx - 4, gy - 12 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(255,255,255,.4)', ls: 0.1 });
    text(g, S.ps > 0 || S.ready ? 'RANGE IMAGE' : 'SPAD ARRAY · DARK COUNT', gx + gw + 4, gy - 12 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(255,255,255,.4)', al: 'right', ls: 0.1 });
    // Photonen-Histogramm eines Pixels (Zeitkorrelierte Zählung): Peak bildet sich heraus
    const hx = gx, hy = gy + gh + 30 * u, hw = gw * 0.48, hh = 52 * u, nb = 48;
    const peak = 0.62 + 0.04 * Math.sin(S.t * 0.7), sharp = 0.15 + 0.85 * S.p;
    for (let b = 0; b < nb; b++) {
      const x = b / nb, sig = Math.exp(-Math.pow((x - peak) / (0.025 + (1 - sharp) * 0.12), 2)) * sharp;
      const noise = 0.1 + 0.25 * Math.abs(Math.sin(b * 12.9898 + Math.floor(S.t * 12) * 78.233) * 43758.5453 % 1);
      const v = clamp(sig + noise * (1 - 0.6 * sharp));
      g.fillStyle = sig > 0.3 ? LIME : 'rgba(255,255,255,.28)';
      g.fillRect(hx + (b * hw) / nb, hy + hh - v * hh, hw / nb - 1, v * hh);
    }
    text(g, 'PHOTONEN-HISTOGRAMM · PIXEL 64', hx, hy + hh + 15 * u, { f: F.mono, size: 9 * u, c: 'rgba(255,255,255,.4)', ls: 0.08 });
    // Zustand und Encoder
    const running = S.ready;
    const sx = gx + gw, sy = hy + 8 * u;
    const label = running ? 'RUNNING' : 'INITIALIZING';
    const tw = text(g, label, sx, sy + 8 * u, { f: F.helv, size: 13 * u, w: 600, c: running ? LIME : '#ffffff', al: 'right', ls: 0.2 });
    circle(g, sx - tw - 12 * u, sy + 3.5 * u, 4 * u, { fill: running ? LIME : '#ffffff', a: running ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(S.t * 3)) });
    st.enc = (st.enc + S.dt * S.rpmFrac * D.hz * 90112 * 0.05) % 90112;
    text(g, `encoder ${pad(st.enc, 5)} / 90112`, sx, sy + 28 * u, { f: F.mono, size: 10 * u, c: 'rgba(255,255,255,.55)', al: 'right' });
    text(g, `${fmt(S.rpmFrac * D.hz, 1)} / ${D.hz} Hz`, sx, sy + 44 * u, { f: F.mono, size: 10 * u, c: 'rgba(255,255,255,.55)', al: 'right' });
    // Metadaten wie aus der Sensor-API
    const ly = Math.min(H - 20 * u, hy + hh + 46 * u);
    const lines = [
      { s: `"prod_sn": "${D.serial}"`, at: 0.15 },
      { s: `"status": "${running ? 'RUNNING' : 'INITIALIZING'}"`, p: 0.02 },
      { s: `"lidar_mode": "1024x${D.hz}"`, p: 0.15 },
      { s: '"udp_profile_lidar": "RNG19_RFL8_SIG16_NIR16"', p: 0.25 },
      { s: '"udp_port_lidar": 7502, "udp_port_imu": 7503', p: 0.38 },
      { s: '"timestamp_mode": "TIME_FROM_INTERNAL_OSC"', p: 0.5 },
      { s: '"phase_lock_enable": false', p: 0.7 },
    ];
    log(g, S, st, lines, gx, ly, { f: F.mono, size: 10 * u, lh: 13.5 * u, c: 'rgba(255,255,255,.62)', cur: LIME, max: Math.max(2, Math.floor((H - ly) / (13.5 * u)) ), fadeOld: true });
  },
};

/* ---------- Hesai: Puls und Echo im Oszilloskop, dann rotierende Kanäle bzw. Polygonspiegel (AT128) ---------- */
SC.hesai = {
  init(S) { return { shots: [], next: 0, phi: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev;
    fillBg(g, S, '#131f52', '#03061a', [0.75, 0.1, 0.9]);
    // Wabenraster
    g.strokeStyle = 'rgba(120,140,255,.06)'; g.lineWidth = 1;
    const hs = 26 * u;
    for (let y = 0, row = 0; y < H + hs; y += hs * 0.866, row++) for (let x = (row % 2) * hs * 0.5; x < W + hs; x += hs) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; g.lineTo(x + Math.cos(a) * hs * 0.5, y + Math.sin(a) * hs * 0.5); } g.closePath(); g.stroke(); }
    const gr = g.createLinearGradient(26 * u, 0, 160 * u, 0); gr.addColorStop(0, '#7d9bff'); gr.addColorStop(1, '#c08bff');
    text(g, 'HESAI', 26 * u, 40 * u, { f: F.avenir, size: 22 * u, w: 800, it: true, c: gr, ls: 0.16 });
    text(g, D.model, 26 * u, 60 * u, { f: F.avenir, size: 12.5 * u, c: 'rgba(228,233,255,.65)' });
    text(g, `S/N ${D.serial}`, W - 26 * u, 38 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(200,210,255,.45)', al: 'right' });
    // Oszilloskop
    const ox = 26 * u, oy = 84 * u, ow = W - 52 * u, oh = Math.min(150 * u, H * 0.28);
    g.fillStyle = 'rgba(5,10,35,.75)'; rr(g, ox, oy, ow, oh, 12 * u); g.fill();
    g.strokeStyle = 'rgba(120,150,255,.25)'; rr(g, ox, oy, ow, oh, 12 * u); g.stroke();
    gridLines(g, ox + 10 * u, oy + 10 * u, ow - 20 * u, oh - 20 * u, (ow - 20 * u) / 12, '#3550a8', 0.18);
    const rate = 0.8 - 0.6 * S.p;
    if (S.t >= st.next) { st.shots.push(S.t); st.next = S.t + rate; if (st.shots.length > 4) st.shots.shift(); }
    const base = oy + oh - 18 * u, ampH = oh - 40 * u, x0 = ox + 22 * u, x1 = ox + ow - 18 * u;
    const targets = [[0.22, 0.32, 'Glas'], [0.48, 0.9, 'Wand'], [0.79, 0.45, 'Halle']];
    const cv = 0.9; // Anteil der Laufzeit je Sekunde (sichtbar verlangsamt)
    g.lineWidth = 2 * u;
    // Zeitbasis wie am Oszilloskop: Sendepuls bei 0, Echos bei ihrer Laufzeit; der Strahl schreibt von links nach rechts
    for (const t0 of st.shots) {
      const age = (S.t - t0) * cv, fadeA = clamp(1.7 - age);
      if (fadeA <= 0) continue;
      const n = Math.max(2, Math.floor(260 * Math.min(1, age)));
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = i / 260;
        let v = Math.exp(-Math.pow((x - 0.02) / 0.008, 2));
        for (const [d, a] of targets) v += a * clamp(S.p * 3) * Math.exp(-Math.pow((x - d) / 0.01, 2));
        v += 0.03 * Math.sin(i * 7.3 + t0 * 50) * Math.sin(i * 1.9);
        const y = base - v * ampH;
        if (i === 0) g.moveTo(x0 + x * (x1 - x0), y); else g.lineTo(x0 + x * (x1 - x0), y);
      }
      g.strokeStyle = `rgba(120,180,255,${fadeA * 0.85})`; g.stroke();
    }
    // Ausbreitender Puls
    const last = st.shots[st.shots.length - 1] ?? 0, age = (S.t - last) * cv;
    if (age < 1) { const px = x0 + clamp(age) * (x1 - x0); circle(g, px, base, 4 * u, { fill: '#ffffff', a: 0.9 }); line(g, x0, base, px, base, '#6f8dff', 2 * u, 0.6); }
    // Ziele mit Doppel-Echo-Markierung
    for (const [d, a, name] of targets) {
      const x = x0 + d * (x1 - x0);
      line(g, x, oy + 16 * u, x, base, '#a07bff', 1, 0.35);
      text(g, `${name} ${fmt(d * 60, 1)} m`, x + 5 * u, oy + 24 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(200,210,255,.75)' });
    }
    if (S.p > 0.45) {
      for (const [k, lab, c] of [[1, 'STRONGEST', '#7d9bff'], [2, 'LAST', '#c08bff']]) {
        const x = x0 + targets[k][0] * (x1 - x0) + 12 * u, y = base - targets[k][1] * ampH * 0.55;
        g.fillStyle = 'rgba(5,10,35,.85)'; g.font = `700 ${9.5 * u}px ${F.avenir}`; const w = text(g, lab, -999, -999, { f: F.avenir, size: 9.5 * u, w: 700, ls: 0.15 });
        g.fillStyle = 'rgba(5,10,35,.85)'; rr(g, x - 4 * u, y - 10 * u, w + 8 * u, 14 * u, 4 * u); g.fill();
        text(g, lab, x, y, { f: F.avenir, size: 9.5 * u, w: 700, c, ls: 0.15 });
      }
    }
    text(g, '0 ns', x0, oy + oh - 4 * u, { f: F.mono, size: 9 * u, c: 'rgba(200,210,255,.4)' });
    text(g, '400 ns', x1, oy + oh - 4 * u, { f: F.mono, size: 9 * u, c: 'rgba(200,210,255,.4)', al: 'right' });
    // Unten: Kanäle (mechanisch) oder Polygonspiegel (AT128)
    const by = oy + oh + 22 * u, bh = H - by - 20 * u;
    st.phi += S.dt * TAU * Math.min(1.1, S.rpm / 60);
    const cx = W * 0.3, cy = by + bh * 0.5;
    if (D.type === 'raster') {
      // Polygonspiegel: sechseckiger Spiegel dreht, 128 VCSEL-Zeilen werden in den 120°-Fächer gelenkt
      const R = Math.min(bh * 0.33, 70 * u);
      g.save(); g.translate(cx, cy); g.rotate(st.phi * 0.5);
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.closePath();
      const mg = g.createLinearGradient(-R, -R, R, R); mg.addColorStop(0, '#9fb4ff'); mg.addColorStop(0.5, '#2a3c8a'); mg.addColorStop(1, '#c7d2ff');
      g.fillStyle = mg; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.stroke(); g.restore();
      if (S.ps > 0.2 || S.ready) for (let i = 0; i < 24; i++) {
        const a = -0.9 + ((i / 23) * 1.8) + 0.15 * Math.sin(st.phi * 3 + i);
        line(g, cx, cy, cx + Math.cos(a) * W * 0.5, cy + Math.sin(a) * bh * 0.42, '#8a5cff', 1, 0.25 * clamp(S.ps * 2));
      }
      text(g, '128 VCSEL · Polygonspiegel · 120°', cx, cy + R + 22 * u, { f: F.avenir, size: 10.5 * u, c: 'rgba(200,210,255,.7)', al: 'center' });
    } else {
      // rotierender Kopf, Kanäle als Lichtpunkte auf dem Zylinder
      const R = Math.min(bh * 0.34, 74 * u), hh = R * 1.15, n = Math.min(D.ch, 64), firing = S.ps > 0.5 || S.ready;
      // Fächer nach rechts, wenn die Sendezeile zur Seite zeigt
      if (firing) {
        const a = Math.pow(clamp(Math.sin(st.phi)), 2);
        for (let i = 0; i < n; i += 2) {
          const e = ((i / (n - 1)) - 0.5) * 0.9, x1 = cx + R + Math.cos(e) * 150 * u, y1 = cy - Math.sin(e) * 150 * u;
          const lg2 = g.createLinearGradient(cx + R, cy, x1, y1); lg2.addColorStop(0, `rgba(160,120,255,${0.45 * a})`); lg2.addColorStop(1, 'rgba(160,120,255,0)');
          g.strokeStyle = lg2; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + R * 0.9, cy - hh * 0.4 + (i / (n - 1)) * hh * 0.8); g.lineTo(x1, y1); g.stroke();
        }
      }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, cy + hh / 2 + 8 * u, R * 1.15, R * 0.28, 0, 0, TAU); g.fill();
      const bg2 = g.createLinearGradient(cx - R, 0, cx + R, 0); bg2.addColorStop(0, '#0a1230'); bg2.addColorStop(0.35, '#3b4f9a'); bg2.addColorStop(0.55, '#1c2a66'); bg2.addColorStop(1, '#070d24');
      g.fillStyle = bg2; g.fillRect(cx - R, cy - hh / 2, 2 * R, hh);
      g.fillStyle = '#05081a'; g.fillRect(cx - R, cy - hh * 0.32, 2 * R, hh * 0.64);
      g.fillStyle = '#0a1230'; g.beginPath(); g.ellipse(cx, cy + hh / 2, R, R * 0.25, 0, 0, Math.PI); g.fill();
      const tg2 = g.createLinearGradient(cx - R, 0, cx + R, 0); tg2.addColorStop(0, '#2b3d85'); tg2.addColorStop(0.4, '#8ea4ff'); tg2.addColorStop(1, '#22306e');
      g.fillStyle = tg2; g.beginPath(); g.ellipse(cx, cy - hh / 2, R, R * 0.25, 0, 0, TAU); g.fill();
      for (let k = 0; k < 3; k++) {
        const a = st.phi + (k * TAU) / 3, c = Math.cos(a);
        if (c < 0) continue;
        const x = cx + Math.sin(a) * R * 0.95, w = 10 * u * c;
        const gl = g.createLinearGradient(x - w, 0, x + w, 0); gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(0.5, firing ? 'rgba(255,90,140,.55)' : 'rgba(111,141,255,.4)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gl; g.fillRect(x - w, cy - hh * 0.3, 2 * w, hh * 0.6);
        for (let i = 0; i < n; i += 2) circle(g, x, cy - hh * 0.27 + (i / (n - 1)) * hh * 0.54, 1.2 * u, { fill: firing ? '#ffd0e0' : '#b7c6ff', a: c });
      }
      text(g, `${D.ch} Kanäle · ${pad(S.rpm, 3)} rpm`, cx, cy + hh / 2 + 26 * u, { f: F.avenir, size: 10.5 * u, c: 'rgba(200,210,255,.7)', al: 'center' });
    }
    const lines = [
      { s: 'PTC 9347 connected', at: 0.1, ok: 0.2 },
      { s: 'Lidar UDP 2368 · GPS UDP 10110', p: 0.2 },
      { s: `Return mode: ${D.returns === 'dual' ? 'Dual (Last + Strongest)' : D.returns === 'last' ? 'Last' : 'Strongest'}`, p: 0.35 },
      { s: 'Sync source: internal clock', p: 0.45 },
      { s: D.type === 'raster' ? 'Mirror speed lock' : (s) => `Spin rate ${pad(s.rpm, 3)} rpm`, p: S.wb, ok: 0.995 },
      { s: 'Work mode', p: 0.99, ok: 0.999 },
    ];
    log(g, S, st, lines, W * 0.56, by + 16 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(214,222,255,.8)', okX: W * 0.4, okC: '#7dffb3', max: Math.max(3, Math.floor(bh / (15.5 * u)) - 1), fadeOld: true });
  },
};

/* ---------- Livox: zwei gegenläufige Risley-Prismen – die nicht wiederholende Rosette deckt das Sichtfeld zu ---------- */
SC.livox = {
  init(S) {
    const D = S.dev, P = D.P, sz = Math.min(S.W * 0.48, S.H * 0.6);
    return { tt: 0, L: layer(S, sz, sz), sz, occ: new Uint8Array(64 * 64), cov: 0, last: null };
  },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, P = D.P, TEAL = '#2fd5c5';
    fillBg(g, S, '#16181c', '#060607', [0.5, 0.45, 0.8]);
    text(g, 'LIVOX', 28 * u, 40 * u, { f: F.sf, size: 18 * u, w: 700, c: '#f4f5f6', ls: 0.36 });
    text(g, D.model, 28 * u, 60 * u, { f: F.sf, size: 12.5 * u, c: 'rgba(244,245,246,.55)' });
    const code = (D.serial.replace(/[^A-Z0-9]/g, '') + '000000000000000').slice(0, 14) + '1';
    text(g, `Broadcast-Code ${code}`, W - 28 * u, 38 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(244,245,246,.45)', al: 'right' });
    const sz = st.sz, fx = W * 0.34 - sz / 2, fy = H * 0.52 - sz / 2;
    const cx = fx + sz / 2, cy = fy + sz / 2, R = sz * 0.47;
    const L = st.L, lg = L.g;
    // Prismen-Darstellung (links oben im Feld): zwei Keile drehen gegenläufig
    const spin = S.ps > 0 || S.ready ? S.rpmFrac : 0;
    st.tt += S.dt * (0.02 + 0.98 * spin) * 0.12; // Zeitlupe: echte Prismen drehen mit > 100 Hz
    const rose = (t) => {
      if (P.type === 'rosette') {
        const a = Math.cos(P.w1 * t) + Math.cos(P.w2 * t), b = Math.sin(P.w1 * t) + Math.sin(P.w2 * t);
        return [a * 0.5, b * 0.5];
      }
      if (P.type === 'dome') { // Mid-360: abgewickelter Mantel 360° × 59°, vier Laser mit versetzter Phase
        const k = Math.floor((t * 4000) % 4), az = (t * 60 + k * 0.25) % 1, el = Math.sin(t * 2 * Math.PI * 173.3 + k * 1.7) * Math.cos(t * 2 * Math.PI * 7.1 + k);
        return [az * 2 - 1, el * 0.96];
      }
      // HAP: Zeilenraster, Zeilen verschachtelt (wie ein Bild, das sich Zeile um Zeile aufbaut)
      const line2 = Math.floor(t * 40), row = (line2 * 7) % 24;
      return [((t * 40) % 1) * 2 - 1, ((row / 23) * 2 - 1) * 0.92 + 0.02 * Math.sin(t * 900)];
    };
    const round = P.type === 'rosette';
    fade(L, Math.min(0.4, S.dt * 0.08));
    if (spin > 0) {
      const steps = 420, t0 = st.tt - S.dt * (0.02 + 0.98 * spin) * 0.12;
      lg.lineWidth = 0.8; lg.strokeStyle = 'rgba(47,213,197,.5)'; lg.beginPath();
      for (let i = 0; i <= steps; i++) {
        const [x, y] = rose(lerp(t0, st.tt, i / steps));
        const px = sz / 2 + x * R, py = sz / 2 + (round ? y : y * 0.42) * R;
        if (i === 0 || (!round && Math.abs(px - st.lx) > R * 0.2)) lg.moveTo(px, py); else lg.lineTo(px, py);
        st.lx = px;
        const gx = Math.floor((x * 0.5 + 0.5) * 63.99), gy = Math.floor((y * 0.5 + 0.5) * 63.99);
        if (gx >= 0 && gy >= 0 && gx < 64 && gy < 64) st.occ[gy * 64 + gx] = 1;
      }
      lg.stroke();
      let n = 0, m = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = (x + 0.5) / 32 - 1, dy = (y + 0.5) / 32 - 1; if (!round || dx * dx + dy * dy < 0.98) { m++; n += st.occ[y * 64 + x]; } }
      st.cov = n / m;
    }
    // Rahmen des Sichtfelds
    if (round) circle(g, cx, cy, R + 6 * u, { stroke: 'rgba(255,255,255,.18)', w: 1 });
    else { g.strokeStyle = 'rgba(255,255,255,.18)'; g.strokeRect(cx - R - 6 * u, cy - R * 0.42 - 6 * u, 2 * R + 12 * u, R * 0.84 + 12 * u); }
    blit(g, L, fx, fy);
    if (spin > 0) { const [x, y] = rose(st.tt); circle(g, cx + x * R, cy + (round ? y : y * 0.42) * R, 3.5 * u, { fill: '#ffffff' }); }
    // Prismenpaar
    const px = cx, py = round ? cy + R + 46 * u : cy + R * 0.42 + 50 * u;
    if (py < H - 20 * u) {
      for (const [dx, dir] of [[-26 * u, 1], [26 * u, -1]]) {
        const a = st.tt * 260 * dir;
        circle(g, px + dx, py, 18 * u, { stroke: 'rgba(255,255,255,.35)', w: 1.5 });
        g.save(); g.translate(px + dx, py); g.rotate(a); g.fillStyle = 'rgba(47,213,197,.55)'; g.beginPath(); g.moveTo(0, -16 * u); g.lineTo(13 * u, 10 * u); g.lineTo(-13 * u, 10 * u); g.closePath(); g.fill(); g.restore();
      }
      text(g, 'Risley-Prismen gegenläufig', px, py + 34 * u, { f: F.sf, size: 10 * u, c: 'rgba(244,245,246,.5)', al: 'center' });
    }
    // Abdeckung
    const kx = W * 0.62, ky = H * 0.3;
    text(g, 'Abdeckung des Sichtfelds', kx, ky, { f: F.sf, size: 11 * u, c: 'rgba(244,245,246,.6)' });
    text(g, `${fmt(st.cov * 100, 0)} %`, kx, ky + 46 * u, { f: F.sf, size: 44 * u, w: 200, c: '#ffffff' });
    bar(g, kx, ky + 60 * u, Math.min(W - kx - 28 * u, 240 * u), 3 * u, st.cov, TEAL, 'rgba(255,255,255,.1)');
    text(g, round ? 'nicht wiederholend · Rosette' : D.type === 'dome' ? '360° × 59° · nicht wiederholend' : 'Raster · 120° × 25°', kx, ky + 80 * u, { f: F.sf, size: 10.5 * u, c: 'rgba(244,245,246,.45)' });
    const state = S.ready ? 'Normal' : 'Initializing';
    text(g, state, kx, ky + 112 * u, { f: F.sf, size: 15 * u, w: 600, c: S.ready ? TEAL : '#ffffff' });
    const lines = [
      { s: 'Broadcast empfangen', at: 0.1, ok: 0.12 },
      { s: 'Handshake', p: 0.1, ok: 0.25 },
      { s: 'Work state: Initializing', p: 0.25 },
      { s: 'Prismenmotoren laufen an', p: S.wb, ok: 0.99 },
      { s: 'Koordinaten: kartesisch · 32 bit', p: 0.6 },
      { s: 'Work state: Normal', p: 0.999 },
    ];
    log(g, S, st, lines, kx, ky + 142 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(244,245,246,.72)', okX: Math.min(W - kx - 28 * u, 250 * u), okC: TEAL, cur: TEAL, max: Math.max(2, Math.floor((H - ky - 150 * u) / (15.5 * u))), fadeOld: true });
  },
};

/* ---------- RoboSense: MSOP- und DIFOP-Pakete fliegen zum Rechner, die 16 Ringe bauen sich auf ---------- */
SC.robosense = {
  init(S) { return { pk: [], nextM: 0, nextD: 0.6, phi: 0, room: roomPolar(S.seed + 3), L: layer(S) }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, RED = '#ff3347';
    fillBg(g, S, '#1d2026', '#08090a');
    gridLines(g, 0, 0, W, H, 24 * u, '#2a2d33', 0.35);
    text(g, 'Robo', 26 * u, 40 * u, { f: F.segoe, size: 19 * u, w: 800, c: '#ffffff' });
    text(g, 'Sense', 26 * u + text(g, 'Robo', -999, -999, { f: F.segoe, size: 19 * u, w: 800 }), 40 * u, { f: F.segoe, size: 19 * u, w: 400, c: RED });
    text(g, D.model, 26 * u, 60 * u, { f: F.segoe, size: 12.5 * u, c: 'rgba(255,255,255,.55)' });
    text(g, `S/N ${D.serial}`, W - 26 * u, 38 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(255,255,255,.4)', al: 'right' });
    // Bahnen: Sensor → Rechner
    const wide = W / H > 1.1;
    const ax = 66 * u, bx = wide ? W * 0.47 : W - 74 * u, y1 = wide ? H * 0.34 : 128 * u, y2 = y1 + 44 * u;
    const sg = g.createLinearGradient(ax - 30 * u, 0, ax + 30 * u, 0); sg.addColorStop(0, '#1b1d22'); sg.addColorStop(0.4, '#4a4f58'); sg.addColorStop(1, '#16181c');
    g.fillStyle = sg; rr(g, ax - 30 * u, y1 - 34 * u, 60 * u, 108 * u, 12 * u); g.fill();
    g.fillStyle = '#07080a'; g.fillRect(ax - 30 * u, y1 - 6 * u, 60 * u, 34 * u);
    const glow = 0.5 + 0.5 * Math.sin(S.t * 8);
    const rg = g.createRadialGradient(ax, y1 + 11 * u, 0, ax, y1 + 11 * u, 16 * u); rg.addColorStop(0, `rgba(255,51,71,${S.ready ? 0.9 : 0.35 + 0.4 * glow})`); rg.addColorStop(1, 'rgba(255,51,71,0)');
    g.fillStyle = rg; g.fillRect(ax - 16 * u, y1 - 5 * u, 32 * u, 32 * u);
    // Rechner
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; rr(g, bx - 34 * u, y1 - 22 * u, 68 * u, 46 * u, 4 * u); g.stroke();
    line(g, bx - 16 * u, y1 + 34 * u, bx + 16 * u, y1 + 34 * u, 'rgba(255,255,255,.3)', 1.5);
    text(g, 'Host 192.168.1.102', bx, y1 + 52 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(255,255,255,.4)', al: 'center' });
    for (const [y, lab, c] of [[y1, 'MSOP · UDP 6699 · 1248 B', '#5aa9ff'], [y2, 'DIFOP · UDP 7788 · 1 Hz', RED]]) {
      line(g, ax + 36 * u, y, bx - 40 * u, y, 'rgba(255,255,255,.12)', 1);
      text(g, lab, ax + 38 * u, y - 7 * u, { f: F.mono, size: 9.5 * u, c });
    }
    // Pakete erzeugen: MSOP mit der Datenrate, DIFOP einmal je Sekunde
    const mRate = S.ready ? 34 : S.ps * 28;
    if (mRate > 0 && S.t >= st.nextM) { st.pk.push({ t: S.t, y: y1, c: '#5aa9ff' }); st.nextM = S.t + 1 / mRate; }
    if (S.pb > 0.5 && S.t >= st.nextD) { st.pk.push({ t: S.t, y: y2, c: RED }); st.nextD = S.t + 1; }
    const span = bx - 40 * u - (ax + 36 * u);
    st.pk = st.pk.filter((q) => S.t - q.t < 0.9);
    for (const q of st.pk) { const x = ax + 36 * u + ((S.t - q.t) / 0.9) * span; g.fillStyle = q.c; rr(g, x - 8 * u, q.y - 3.5 * u, 16 * u, 7 * u, 2 * u); g.fill(); }
    // Ringe (Draufsicht): 16 Kanäle, Wände in Rot
    const ox = wide ? W * 0.77 : W * 0.5, oy = wide ? H * 0.47 : H * 0.66, Rp = wide ? Math.min(W * 0.2, H * 0.34) : Math.min(W * 0.34, H * 0.2);
    const prev = st.phi; st.phi += S.dt * TAU * Math.min(1.1, S.rpm / 60);
    for (let ring = 0; ring < 16; ring++) circle(g, ox, oy, ((ring + 1) / 17) * Rp, { stroke: 'rgba(90,169,255,.07)' });
    const L = st.L; fade(L, Math.min(0.5, S.dt * 0.4));
    if (S.ps > 0.3 || S.ready) {
      const lg = L.g, n = Math.ceil(((st.phi - prev) / TAU) * 900);
      for (let k = 0; k < n; k++) {
        const th = prev + ((st.phi - prev) * k) / n;
        for (let ring = 0; ring < 16; ring++) {
          const rr0 = (ring + 1) / 17 * Rp, wall = st.room.at(th) / st.room.max * Rp;
          const r = Math.min(rr0, wall);
          lg.fillStyle = r < rr0 ? 'rgba(255,90,100,.9)' : `rgba(90,169,255,${0.35 + ring / 40})`;
          lg.fillRect(ox + Math.cos(th) * r - 0.7, oy + Math.sin(th) * r - 0.7, 1.4, 1.4);
        }
      }
    }
    blit(g, L);
    line(g, ox, oy, ox + Math.cos(st.phi) * Rp, oy + Math.sin(st.phi) * Rp, RED, 1.5, 0.8);
    text(g, `${pad(S.rpm, 3)} rpm`, ox, oy + Rp + 22 * u, { f: F.mono, size: 12 * u, w: 600, c: '#ffffff', al: 'center' });
    const lines = [
      { s: 'DIFOP: Geräteinfo empfangen', p: 0.5, ok: 0.55 },
      { s: 'Motor: Soll 600 rpm', p: S.wb, ok: 0.99 },
      { s: 'MSOP: Datenpakete', p: S.wb + 0.1, ok: 0.999 },
      { s: 'Rückgabe: Strongest', p: 0.99 },
    ];
    const ly = y2 + 74 * u, lmax = wide ? Math.max(2, Math.floor((H - ly - 10 * u) / (15.5 * u))) : Math.max(1, Math.floor((oy - Rp - 16 * u - ly) / (15.5 * u)));
    log(g, S, st, [{ s: `Init ${D.model} · 192.168.1.200`, at: 0.1 }, ...lines], 26 * u, ly, { f: F.mono, size: 10.5 * u, c: 'rgba(255,255,255,.7)', okX: Math.min((wide ? W * 0.47 : W) - 52 * u, 300 * u), okC: '#5aff9c', max: lmax, fadeOld: true });
  },
};

/* ---------- Leica: LED-Ring, Neigungskompensator, Schritte – weiß und ruhig ---------- */
SC.leica = {
  init(S) { const R = rng(S.seed); return { bx: (R() - 0.5) * 2, by: (R() - 0.5) * 2 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, RED = '#e30613';
    fillBg(g, S, '#ffffff', '#ecebe8', [0.5, 0.42, 0.75]);
    g.fillStyle = RED; g.fillRect(26 * u, 27 * u, 10 * u, 10 * u);
    text(g, 'LEICA', 44 * u, 37 * u, { f: F.helv, size: 13 * u, w: 700, c: '#1c1c1c', ls: 0.24 });
    text(g, 'GEOSYSTEMS', 44 * u + 64 * u, 37 * u, { f: F.helv, size: 9.5 * u, w: 400, c: '#8a8a87', ls: 0.24 });
    text(g, D.model, 26 * u, 66 * u, { f: F.helv, size: 22 * u, w: 300, c: '#1c1c1c' });
    text(g, `SN ${D.serial}`, W - 26 * u, 36 * u, { f: F.helv, size: 10.5 * u, c: '#8a8a87', al: 'right', ls: 0.06 });
    const slam = D.cls === 'slam';
    const cx = W * (W / H > 1.1 ? 0.36 : 0.5), cy = H * 0.5, R = Math.min(W, H) * 0.2;
    // Gerät von oben: helles Gehäuse, LED-Ring aus 24 Segmenten
    const body = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R * 0.95);
    body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#d9d8d4');
    g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.arc(cx + 4 * u, cy + 8 * u, R * 0.98, 0, TAU); g.fill();
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, R * 0.92, 0, TAU); g.fill();
    g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(cx, cy, R * 0.6, 0, TAU); g.fill();
    const ready = S.ready, n = 24;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU - Math.PI / 2 + 0.02, a1 = ((i + 1) / n) * TAU - Math.PI / 2 - 0.02;
      const lit = ready ? 1 : (i / n) < S.p ? 1 : 0;
      const pulse = ready ? 1 : 0.55 + 0.45 * Math.sin(S.t * 4 - i * 0.35);
      g.strokeStyle = ready ? `rgba(46,204,113,${0.9})` : lit ? `rgba(255,191,0,${0.4 + 0.6 * pulse})` : 'rgba(0,0,0,.08)';
      g.lineWidth = R * 0.09; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy, R * 0.76, a0, a1); g.stroke();
    }
    g.lineCap = 'butt';
    text(g, `${Math.round(S.p * 100)}`, cx, cy + R * 0.16, { f: F.helv, size: R * 0.46, w: 200, c: '#ffffff', al: 'center' });
    text(g, ready ? 'BEREIT' : slam ? 'RUHIG HALTEN' : S.ph === 'boot' ? 'SELBSTTEST' : 'ANLAUF', cx, cy + R * 0.36, { f: F.helv, size: R * 0.085, w: 600, c: 'rgba(255,255,255,.75)', al: 'center', ls: 0.2 });
    // Kompensator (Doppelachse): Blase pendelt gedämpft zur Mitte
    const kx = W * (W / H > 1.1 ? 0.72 : 0.5), ky = W / H > 1.1 ? H * 0.38 : H * 0.83, kr = Math.min(56 * u, H * 0.12);
    const damp = Math.exp(-S.t * 0.9) * (1 - eo(S.p * 1.4));
    const bx = st.bx * damp * Math.cos(S.t * 3.1) * kr * 0.6, by = st.by * damp * Math.sin(S.t * 2.7) * kr * 0.6;
    circle(g, kx, ky, kr, { fill: '#ffffff', stroke: '#d6d5d1', w: 1.5 });
    circle(g, kx, ky, kr * 0.28, { stroke: '#c9c8c4', w: 1 });
    line(g, kx - kr, ky, kx + kr, ky, '#e3e2de'); line(g, kx, ky - kr, kx, ky + kr, '#e3e2de');
    circle(g, kx + bx, ky + by, kr * 0.2, { fill: 'rgba(227,6,19,.18)', stroke: RED, w: 1.5 });
    if (W / H > 1.1) {
      text(g, 'Neigungskompensator', kx, ky + kr + 22 * u, { f: F.helv, size: 11 * u, c: '#666664', al: 'center' });
      text(g, `L ${fmt((bx / kr) * 0.25, 3)}°   Q ${fmt((by / kr) * 0.25, 3)}°`, kx, ky + kr + 40 * u, { f: F.mono, size: 11 * u, c: '#1c1c1c', al: 'center' });
    }
    // Schritte
    const steps = slam ? [['IMU', 0.2], ['Kameras', 0.45], ['SLAM', 0.75], ['Bereit', 0.999]]
      : D.id === 'rtc360' ? [['Selbsttest', 0.25], ['Kompensator', 0.5], ['VIS-Kameras', 0.75], ['Bereit', 0.999]]
        : [['Selbsttest', 0.3], ['Kompensator', 0.6], ['HDR-Kamera', 0.85], ['Bereit', 0.999]];
    const sx0 = W * 0.1, sx1 = W * 0.9, sy = H - 46 * u;
    line(g, sx0, sy, sx1, sy, '#dcdbd7', 2);
    line(g, sx0, sy, lerp(sx0, sx1, clamp(S.p)), sy, RED, 2);
    steps.forEach(([name, at], i) => {
      const x = lerp(sx0, sx1, i / (steps.length - 1)), done = S.p >= at;
      circle(g, x, sy, 6 * u, { fill: done ? RED : '#ffffff', stroke: done ? RED : '#c9c8c4', w: 1.5 });
      text(g, name, x, sy + 22 * u, { f: F.helv, size: 10.5 * u, w: done ? 600 : 400, c: done ? '#1c1c1c' : '#8a8a87', al: 'center' });
    });
    if (D.id === 'rtc360' && W / H > 1.1) {
      // fünf VIS-Kameras um das Gerät
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2, on = S.p > 0.5 + i * 0.05; circle(g, cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12, 5 * u, { fill: on ? '#1c1c1c' : '#e2e1dd' }); }
      text(g, 'Doppelscan · bewegte Objekte werden entfernt', kx, ky + kr + 62 * u, { f: F.helv, size: 10 * u, c: '#8a8a87', al: 'center' });
    }
  },
};

/* ---------- FARO: Sensoren melden sich (Neigung, Kompass, Höhe, GNSS), der Spiegel läuft an ---------- */
SC.faro = {
  init(S) { return { mir: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, BL = '#1aa3ff';
    fillBg(g, S, '#0c2240', '#030912', [0.3, 0.2, 0.9]);
    text(g, 'FARO', 26 * u, 44 * u, { f: F.helv, size: 26 * u, w: 800, it: true, c: '#ffffff', ls: 0.06 });
    text(g, D.model, 26 * u, 64 * u, { f: F.helv, size: 12.5 * u, c: 'rgba(230,240,250,.6)' });
    text(g, `S/N ${D.serial}`, W - 26 * u, 40 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(200,220,240,.45)', al: 'right' });
    const wide = W / H > 1.1;
    const tx = 26 * u, ty = 88 * u, tw = wide ? Math.min(W * 0.27, 190 * u) : (W - 64 * u) / 2, th = Math.min(H * 0.3, 118 * u);
    const tiles = [['Neigungssensor', 0.2], ['Kompass', 0.42], ['Höhenmesser', 0.62], ['GNSS', 0.82]];
    tiles.forEach(([name, at], i) => {
      const x = tx + (i % 2) * (tw + 12 * u), y = ty + Math.floor(i / 2) * (th + 12 * u);
      const p = seg(S.p, at - 0.22, at), done = S.p >= at;
      g.fillStyle = 'rgba(16,36,63,.85)'; rr(g, x, y, tw, th, 12 * u); g.fill();
      g.strokeStyle = done ? 'rgba(26,163,255,.6)' : 'rgba(255,255,255,.08)'; g.lineWidth = 1.5; rr(g, x, y, tw, th, 12 * u); g.stroke();
      text(g, name, x + 12 * u, y + 20 * u, { f: F.helv, size: 11 * u, w: 600, c: '#e6f0fa' });
      text(g, done ? '✓' : '…', x + tw - 12 * u, y + 20 * u, { f: F.helv, size: 13 * u, w: 700, c: done ? '#4cd964' : 'rgba(255,255,255,.4)', al: 'right' });
      const mx = x + tw / 2, my = y + th * 0.6, mr = Math.min(tw, th) * 0.26;
      if (i === 0) { // Libelle
        circle(g, mx, my, mr, { stroke: 'rgba(255,255,255,.25)', w: 1.5 });
        const off = (1 - eo(p)) * mr * 0.7;
        circle(g, mx + off * Math.cos(S.t * 2), my + off * Math.sin(S.t * 2.6), mr * 0.25, { fill: 'rgba(26,163,255,.5)', stroke: BL });
        text(g, `${fmt((1 - eo(p)) * 1.84, 3)}°`, mx, y + th - 10 * u, { f: F.mono, size: 10 * u, c: 'rgba(230,240,250,.7)', al: 'center' });
      } else if (i === 1) { // Kompassnadel pendelt ein
        const head = 4.14 + Math.exp(-S.t * 0.8) * Math.sin(S.t * 5) * (1 - p) * 1.4;
        circle(g, mx, my, mr, { stroke: 'rgba(255,255,255,.25)', w: 1.5 });
        g.save(); g.translate(mx, my); g.rotate(head);
        g.fillStyle = '#ff5a5a'; g.beginPath(); g.moveTo(0, -mr * 0.9); g.lineTo(mr * 0.15, 0); g.lineTo(-mr * 0.15, 0); g.fill();
        g.fillStyle = '#e6f0fa'; g.beginPath(); g.moveTo(0, mr * 0.9); g.lineTo(mr * 0.15, 0); g.lineTo(-mr * 0.15, 0); g.fill(); g.restore();
        text(g, `${pad((head / TAU) * 360, 3)}°`, mx, y + th - 10 * u, { f: F.mono, size: 10 * u, c: 'rgba(230,240,250,.7)', al: 'center' });
      } else if (i === 2) { // Höhenmesser zählt
        const v = 212 * eo(p);
        text(g, `${fmt(v, 1)} m`, mx, my + 8 * u, { f: F.helv, size: 22 * u, w: 300, c: '#ffffff', al: 'center' });
        text(g, 'ü. NN (barometrisch)', mx, y + th - 10 * u, { f: F.helv, size: 9.5 * u, c: 'rgba(230,240,250,.5)', al: 'center' });
      } else { // Himmelsplot
        circle(g, mx, my, mr, { stroke: 'rgba(255,255,255,.25)', w: 1 }); circle(g, mx, my, mr * 0.5, { stroke: 'rgba(255,255,255,.12)', w: 1 });
        const nSat = S.outdoor ? Math.round(p * 11) : Math.round(p * 2);
        for (let k = 0; k < nSat; k++) { const a = k * 2.4, r = mr * (0.25 + ((k * 37) % 70) / 100); circle(g, mx + Math.cos(a) * r, my + Math.sin(a) * r, 2.5 * u, { fill: S.outdoor ? '#4cd964' : '#f2b23a' }); }
        text(g, S.outdoor ? `${nSat} Satelliten` : 'kein Fix (innen)', mx, y + th - 10 * u, { f: F.helv, size: 9.5 * u, c: 'rgba(230,240,250,.6)', al: 'center' });
      }
    });
    // Spiegel: Seitenansicht, dreht mit wachsender Drehzahl
    const mx = wide ? W * 0.78 : W * 0.5, my = wide ? H * 0.46 : ty + 2 * (th + 12 * u) + 80 * u, R = wide ? Math.min(W * 0.14, H * 0.24) : 60 * u;
    st.mir += S.dt * (S.ph === 'boot' ? S.pb * 3 : 14);
    g.fillStyle = '#1b2f4d'; rr(g, mx - R * 0.9, my - R * 1.05, R * 1.8, R * 2.1, 16 * u); g.fill();
    g.fillStyle = '#0a1628'; rr(g, mx - R * 0.6, my - R * 0.75, R * 1.2, R * 1.5, 10 * u); g.fill();
    const c = Math.cos(st.mir);
    g.save(); g.translate(mx, my); g.scale(1, Math.abs(c) * 0.8 + 0.2);
    const mg = g.createLinearGradient(-R * 0.5, 0, R * 0.5, 0); mg.addColorStop(0, '#5d7ea6'); mg.addColorStop(0.5, '#e8f3ff'); mg.addColorStop(1, '#5d7ea6');
    g.fillStyle = mg; g.beginPath(); g.ellipse(0, 0, R * 0.5, R * 0.5, 0, 0, TAU); g.fill(); g.restore();
    if (S.ready) for (let k = 0; k < 6; k++) { const a = st.mir + k * 0.1; line(g, mx, my, mx + Math.cos(a) * R * 2.2, my + Math.sin(a) * R * 2.2, BL, 1, 0.25); }
    text(g, S.ready ? 'Spiegel auf Drehzahl' : S.ph === 'boot' ? 'Spiegel läuft an' : 'Spiegel', mx, my + R * 1.05 + 24 * u, { f: F.helv, size: 11 * u, c: 'rgba(230,240,250,.7)', al: 'center' });
    // Fortschritt unten
    const by = H - 34 * u;
    bar(g, 26 * u, by, W - 52 * u, 6 * u, S.p, BL, 'rgba(255,255,255,.1)');
    text(g, S.ready ? 'Scanner bereit · Profil „Innen bis 20 m“ · Auflösung 1/5 · Qualität 3x' : 'Scanner wird initialisiert …', 26 * u, by - 10 * u, { f: F.helv, size: 11 * u, c: 'rgba(230,240,250,.8)' });
    text(g, `${Math.round(S.p * 100)} %`, W - 26 * u, by - 10 * u, { f: F.mono, size: 11 * u, c: '#ffffff', al: 'right' });
  },
};

/* ---------- RIEGL: Echtzeit-Echodigitalisierung – Wellenform, Zerlegung in Ziele, MTA-Zonen ---------- */
SC.riegl = {
  init(S) { return { shot: 0, wf: null, next: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, AMB = '#ffa024';
    fillBg(g, S, '#0e1830', '#03060c');
    text(g, 'RIEGL', 26 * u, 42 * u, { f: F.segoe, size: 22 * u, w: 800, c: '#ffffff', ls: 0.3 });
    text(g, `${D.model}  ·  Waveform-LiDAR`, 26 * u, 62 * u, { f: F.segoe, size: 12.5 * u, c: 'rgba(231,236,245,.6)' });
    text(g, `S/N ${D.serial}`, W - 26 * u, 40 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(231,236,245,.45)', al: 'right' });
    const ox = 26 * u, oy = 84 * u, ow = W - 52 * u, oh = Math.min(H * 0.46, 220 * u);
    g.fillStyle = '#050a14'; g.fillRect(ox, oy, ow, oh);
    gridLines(g, ox, oy, ow, oh, ow / 10, '#ffa024', 0.08);
    g.strokeStyle = 'rgba(255,160,36,.35)'; g.strokeRect(ox + 0.5, oy + 0.5, ow, oh);
    // neue Wellenform je Schuss (Zielanordnung leicht verschieden: Laub, Ast, Wand)
    if (S.t >= st.next) {
      st.shot++; st.next = S.t + 0.18;
      const j = Math.sin(st.shot * 1.7) * 0.01;
      st.wf = [[0.18 + j, 0.35, 0.012], [0.235 + j * 2, 0.22, 0.016], [0.31, 0.5, 0.01], [0.64 - j, 0.95, 0.009]];
    }
    const base = oy + oh - 16 * u, A = oh - 44 * u, x0 = ox + 14 * u, x1 = ox + ow - 14 * u;
    const sharp = eo(S.p * 1.3), noiseA = 0.06 * (1 - sharp) + 0.015;
    // Sendepuls
    g.beginPath();
    for (let i = 0; i <= 400; i++) {
      const x = i / 400;
      let v = 0.9 * Math.exp(-Math.pow((x - 0.04) / 0.008, 2));
      for (const [d, a, w] of st.wf) v += a * Math.exp(-Math.pow((x - d) / w, 2)) * seg(S.p, 0.05, 0.3);
      v += noiseA * Math.sin(i * 12.9 + st.shot * 3.1) * Math.sin(i * 4.1);
      const y = base - v * A;
      if (i === 0) g.moveTo(x0, y); else g.lineTo(x0 + x * (x1 - x0), y);
    }
    g.strokeStyle = AMB; g.lineWidth = 1.6 * u; g.stroke();
    // Zerlegung in Ziele (online)
    if (S.p > 0.45) {
      st.wf.forEach(([d, a], k) => {
        const x = x0 + d * (x1 - x0), y = base - a * A;
        line(g, x, y - 6 * u, x, base, '#ffffff', 1, 0.5);
        circle(g, x, y, 3 * u, { fill: '#ffffff' });
        const r = (d - 0.04) * 120;
        const ly = k % 2 ? y - 8 * u : y - 26 * u;
        text(g, `#${k + 1} ${fmt(r, 2)} m`, x + 5 * u, ly, { f: F.mono, size: 9.5 * u, c: '#ffffff' });
        text(g, `${fmt(20 * Math.log10(a / 0.95), 1)} dB`, x + 5 * u, ly + 11 * u, { f: F.mono, size: 9 * u, c: 'rgba(255,255,255,.55)' });
      });
    }
    text(g, 'Sendepuls', x0 + 0.04 * (x1 - x0), oy + 16 * u, { f: F.segoe, size: 9.5 * u, c: 'rgba(255,255,255,.5)', al: 'center' });
    text(g, S.p > 0.45 ? 'Online-Waveform-Processing: 4 Ziele' : 'Digitalisierung der Echos …', x1, oy + 16 * u, { f: F.segoe, size: 10 * u, c: AMB, al: 'right' });
    // MTA-Zonen
    const my = oy + oh + 24 * u, mw = ow;
    for (let z = 0; z < 4; z++) {
      const x = ox + (mw * z) / 4, on = z === 0 || (z === 1 && S.p > 0.7);
      g.fillStyle = on ? 'rgba(255,160,36,.25)' : 'rgba(255,255,255,.05)'; g.fillRect(x + 1, my, mw / 4 - 2, 16 * u);
      text(g, `MTA ${z + 1}`, x + 8 * u, my + 12 * u, { f: F.mono, size: 9.5 * u, c: on ? '#ffffff' : 'rgba(255,255,255,.4)' });
    }
    const lines = [
      { s: 'Laser self-test', at: 0.1, ok: 0.2 },
      { s: 'Pulse repetition rate 300 kHz', p: 0.15 },
      { s: 'Echo digitization online', p: 0.3, ok: 0.45 },
      { s: 'MTA zone resolution', p: 0.5, ok: 0.7 },
      { s: 'GNSS / IMU', p: 0.6, ok: 0.85, okText: S.outdoor ? 'FIX' : 'NO FIX' },
      { s: 'Real-time registration ready', p: 0.9, ok: 0.999 },
    ];
    log(g, S, st, lines, ox, my + 44 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(231,236,245,.75)', okX: Math.min(ow, 340 * u), okC: AMB, cur: AMB, max: Math.max(2, Math.floor((H - my - 50 * u) / (15.5 * u))) });
  },
};

/* ---------- Trimble X7: Auto-Nivellierung und Auto-Kalibrierung an Fadenkreuz und Teilkreisen ---------- */
SC.trimble = {
  draw(g, S) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, Y = '#ffd23f';
    fillBg(g, S, '#2a3037', '#0c0e11', [0.4, 0.5, 0.8]);
    text(g, 'TRIMBLE', 26 * u, 40 * u, { f: F.helv, size: 15 * u, w: 700, c: '#ffffff', ls: 0.3 });
    text(g, D.model, 26 * u + 110 * u, 40 * u, { f: F.helv, size: 15 * u, w: 300, c: Y });
    text(g, `S/N ${D.serial}`, W - 26 * u, 38 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(238,241,244,.45)', al: 'right' });
    const wide = W / H > 1.1, cx = wide ? W * 0.38 : W * 0.5, cy = H * 0.5, R = Math.min(W * (wide ? 0.24 : 0.36), H * 0.34);
    const pH = seg(S.p, 0.3, 0.8), pV = seg(S.p, 0.45, 0.95);
    // Horizontalkreis: Teilung läuft ein
    const offH = (1 - eio(pH)) * 0.8 + Math.sin(S.t * 1.3) * 0.02 * (1 - pH);
    g.save(); g.translate(cx, cy);
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU + offH, l = i % 10 ? 6 * u : 14 * u;
      line(g, Math.cos(a) * R, Math.sin(a) * R, Math.cos(a) * (R - l), Math.sin(a) * (R - l), '#ffffff', 1, i % 10 ? 0.25 : 0.6);
    }
    g.strokeStyle = Y; g.lineWidth = 3 * u; g.beginPath(); g.arc(0, 0, R + 8 * u, -Math.PI / 2, -Math.PI / 2 + pH * TAU); g.stroke();
    // Vertikalkreis (innen)
    const r2 = R * 0.62;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU - (1 - eio(pV)) * 1.2;
      line(g, Math.cos(a) * r2, Math.sin(a) * r2, Math.cos(a) * (r2 - (i % 6 ? 4 : 10) * u), Math.sin(a) * (r2 - (i % 6 ? 4 : 10) * u), Y, 1, i % 6 ? 0.25 : 0.7);
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 2 * u; g.beginPath(); g.arc(0, 0, r2 + 6 * u, Math.PI / 2, Math.PI / 2 + pV * TAU); g.stroke();
    // Fadenkreuz
    const jit = (1 - eo(S.p)) * 8 * u;
    const jx = Math.sin(S.t * 3.7) * jit, jy = Math.cos(S.t * 2.9) * jit;
    line(g, -r2 * 0.6 + jx, jy, r2 * 0.6 + jx, jy, Y, 1.5); line(g, jx, -r2 * 0.6 + jy, jx, r2 * 0.6 + jy, Y, 1.5);
    circle(g, jx, jy, r2 * 0.18, { stroke: Y, w: 1.5 });
    g.restore();
    text(g, 'Hz', cx + R + 16 * u, cy - R * 0.7, { f: F.helv, size: 11 * u, w: 700, c: Y });
    text(g, 'V', cx + r2 + 12 * u, cy + r2 * 0.75, { f: F.helv, size: 11 * u, w: 700, c: '#ffffff' });
    // Nivellierung: zwei Achsen laufen auf null
    const lx = wide ? W * 0.68 : W * 0.15, ly = wide ? H * 0.26 : H * 0.82, lw = wide ? W * 0.27 : W * 0.7;
    const tilt = (k) => (1 - eo(seg(S.p, 0.05, 0.35))) * (k ? 6.2 : -3.8) + Math.sin(S.t * 2 + k) * 0.05 * (1 - S.p);
    for (const k of [0, 1]) {
      const y = ly + k * 30 * u, v = tilt(k);
      text(g, k ? 'Quer' : 'Längs', lx, y, { f: F.helv, size: 10.5 * u, c: 'rgba(238,241,244,.6)' });
      const bx = lx + 54 * u, bw = lw - 120 * u;
      g.fillStyle = 'rgba(255,255,255,.08)'; rr(g, bx, y - 8 * u, bw, 10 * u, 5 * u); g.fill();
      line(g, bx + bw / 2, y - 11 * u, bx + bw / 2, y + 5 * u, '#ffffff', 1, 0.5);
      circle(g, bx + bw / 2 + (v / 10) * bw / 2, y - 3 * u, 5 * u, { fill: Math.abs(v) < 0.05 ? Y : '#ffffff' });
      text(g, `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}°`, lx + lw, y, { f: F.mono, size: 10.5 * u, c: '#ffffff', al: 'right' });
    }
    if (wide) {
      const steps = [['Selbsttest', 0.12], ['Auto-Nivellierung ±10°', 0.35], ['Auto-Kalibrierung Hz', 0.8], ['Auto-Kalibrierung V', 0.95], ['Kamera · Laserzeiger', 0.98], ['Bereit', 0.999]];
      steps.forEach(([name, at], i) => {
        const y = ly + 78 * u + i * 24 * u, done = S.p >= at, act = !done && (i === 0 || S.p >= steps[i - 1][1]);
        circle(g, lx + 7 * u, y - 4 * u, 7 * u, { fill: done ? Y : 'transparent', stroke: done ? Y : act ? '#ffffff' : 'rgba(255,255,255,.25)', w: 1.5 });
        if (done) { g.strokeStyle = '#15181c'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + 3.5 * u, y - 4 * u); g.lineTo(lx + 6 * u, y - 1.5 * u); g.lineTo(lx + 10.5 * u, y - 7 * u); g.stroke(); }
        text(g, name, lx + 22 * u, y, { f: F.helv, size: 11.5 * u, w: act ? 600 : 400, c: done ? '#ffffff' : act ? Y : 'rgba(238,241,244,.4)' });
      });
    }
  },
};

/* ---------- Z+F: Phasenvergleich mit drei Modulationsfrequenzen, Eindeutigkeit aufgelöst ---------- */
SC.zf = {
  draw(g, S) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, RED = '#ff2a1a', DC = "'DIN Condensed', 'Bahnschrift Condensed', 'Arial Narrow', sans-serif";
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    gridLines(g, 0, 0, W, H, 40 * u, RED, 0.06);
    const zw = text(g, 'Z+F', 26 * u, 46 * u, { f: DC, size: 30 * u, w: 700, c: '#ffffff' });
    text(g, 'IMAGER® 5016', 26 * u + zw + 12 * u, 46 * u, { f: DC, size: 16 * u, w: 700, c: 'rgba(255,255,255,.55)', ls: 0.3 });
    text(g, `SN ${D.serial}`, W - 26 * u, 44 * u, { f: DC, size: 13 * u, w: 700, c: 'rgba(255,255,255,.5)', al: 'right', ls: 0.15 });
    line(g, 26 * u, 58 * u, W - 26 * u, 58 * u, RED, 1);
    const target = 23.418;
    const mods = [['MOD 1', 0.5, 0.25], ['MOD 2', 2.5, 0.5], ['MOD 3', 40, 0.78]]; // Wellenlänge der Modulation (m), Zeitpunkt
    const top = 82 * u, rowH = Math.min((H - top - 100 * u) / 3, 92 * u);
    mods.forEach(([name, lam, at], k) => {
      const y = top + k * rowH, mid = y + rowH * 0.45, amp = rowH * 0.28, x0 = 110 * u, x1 = W - 120 * u;
      const on = S.p > at - 0.2, lock = S.p >= at;
      text(g, name, 26 * u, mid + 5 * u, { f: DC, size: 15 * u, w: 700, c: on ? '#ffffff' : 'rgba(255,255,255,.3)', ls: 0.12 });
      text(g, `λ/2 = ${fmt(lam / 2, 2)} m`, 26 * u, mid + 21 * u, { f: DC, size: 11 * u, w: 700, c: 'rgba(255,255,255,.4)', ls: 0.1 });
      if (!on) { line(g, x0, mid, x1, mid, 'rgba(255,255,255,.12)', 1); return; }
      const phase = ((2 * target) / lam) % 1 * TAU, cyc = 3.5, drift = S.t * 2.2;
      for (const [col, ph, wdt] of [['#ffffff', 0, 1.2], [RED, phase, 2]]) {
        g.beginPath();
        for (let i = 0; i <= 200; i++) { const x = i / 200, y2 = mid - Math.sin(x * cyc * TAU - drift - ph) * amp; if (i === 0) g.moveTo(x0 + x * (x1 - x0), y2); else g.lineTo(x0 + x * (x1 - x0), y2); }
        g.strokeStyle = col; g.lineWidth = wdt * u; g.globalAlpha = col === RED ? clamp((S.p - at + 0.2) * 5) : 0.6; g.stroke(); g.globalAlpha = 1;
      }
      const shown = lock ? phase : phase * seg(S.p, at - 0.2, at) + Math.sin(S.t * 13) * 0.3 * (1 - seg(S.p, at - 0.2, at));
      text(g, `Δφ ${fmt(((shown / TAU) * 360 + 360) % 360, 1)}°`, W - 26 * u, mid + 5 * u, { f: DC, size: 16 * u, w: 700, c: lock ? RED : '#ffffff', al: 'right' });
      line(g, 26 * u, y + rowH - 4 * u, W - 26 * u, y + rowH - 4 * u, 'rgba(255,255,255,.08)', 1);
    });
    // Ergebnis
    const ry = H - 50 * u;
    const resolved = S.p >= 0.8;
    text(g, resolved ? 'EINDEUTIGKEIT AUFGELÖST' : 'PHASENVERGLEICH', 26 * u, ry, { f: DC, size: 14 * u, w: 700, c: resolved ? RED : 'rgba(255,255,255,.6)', ls: 0.2 });
    const shownR = resolved ? target : (target * S.p * 1.25 + Math.sin(S.t * 20) * 3) % 40;
    text(g, `${fmt(Math.abs(shownR), 3)} m`, W - 26 * u, ry + 6 * u, { f: DC, size: 34 * u, w: 700, c: '#ffffff', al: 'right' });
    bar(g, 26 * u, H - 28 * u, W * 0.45, 3 * u, S.p, RED, 'rgba(255,255,255,.1)', 0);
    text(g, S.ready ? 'BEREIT · HDR-KAMERA' : S.ph === 'boot' ? 'SELBSTTEST' : 'SPIEGEL', 26 * u + W * 0.45 + 12 * u, H - 24 * u, { f: DC, size: 12 * u, w: 700, c: 'rgba(255,255,255,.6)', ls: 0.2 });
  },
};

/* ---------- SICK: Schutzfeld und Warnfeld werden gezeichnet, der Strahl tastet ab – SOPAS-Optik ---------- */
SC.sick = {
  init(S) { return { phi: 0, room: roomPolar(S.seed + 5), L: layer(S) }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, P = D.P, BL = '#007cc1';
    g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, H);
    gridLines(g, 0, 52 * u, W, H, 20 * u, '#c9d3dd', 0.45);
    g.fillStyle = BL; g.fillRect(0, 0, W, 52 * u);
    text(g, 'SICK', 24 * u, 33 * u, { f: F.helv, size: 22 * u, w: 800, c: '#ffffff' });
    text(g, `${D.model}  ·  ${D.id === 'microscan3' ? 'Sicherheits-Laserscanner' : '2D-LiDAR-Sensor'}`, 24 * u + 70 * u, 32 * u, { f: F.helv, size: 13 * u, c: 'rgba(255,255,255,.88)' });
    text(g, `SN ${D.serial}`, W - 24 * u, 32 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(255,255,255,.75)', al: 'right' });
    const safety = D.id === 'microscan3';
    const wide = W / H > 1.1, top = 52 * u;
    const ox = wide ? W * 0.34 : W * 0.5, oy = wide ? top + (H - top) * 0.56 : top + (H - top) * 0.4;
    const R = Math.min(wide ? W * 0.27 : W * 0.4, (oy - top - 14 * u) / 1.08, (H - oy - 10 * u) / 0.8);
    const fov = ((P.fov || 270) * Math.PI) / 180, a0 = -Math.PI / 2 - fov / 2, a1 = -Math.PI / 2 + fov / 2;
    // Feld = Rechteck vor dem Gerät (vorne fw, seitlich sw, hinten bw), vom Sichtbereich beschnitten
    const rect = (fw, sw, bw) => (a) => { const dx = Math.cos(a), dy = Math.sin(a); return Math.min(dx > 1e-6 ? sw / dx : dx < -1e-6 ? -sw / dx : Infinity, dy < -1e-6 ? fw / -dy : dy > 1e-6 ? bw / dy : Infinity); };
    const warnR = rect(R * 0.86, R * 0.62, R * 0.3), protR = rect(R * 0.5, R * 0.36, R * 0.16);
    const fieldPath = (fr, k) => { g.beginPath(); g.moveTo(ox, oy); const n = 90, pe = clamp(k); for (let i = 0; i <= n * pe; i++) { const a = lerp(a0, a1, i / n), r = fr(a); g.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r); } g.closePath(); };
    circle(g, ox, oy, R * 1.08, { stroke: 'rgba(0,124,193,.25)', a0, a1 });
    line(g, ox, oy, ox + Math.cos(a0) * R * 1.08, oy + Math.sin(a0) * R * 1.08, 'rgba(0,124,193,.35)');
    line(g, ox, oy, ox + Math.cos(a1) * R * 1.08, oy + Math.sin(a1) * R * 1.08, 'rgba(0,124,193,.35)');
    fieldPath(warnR, seg(S.p, 0.15, 0.5)); g.fillStyle = 'rgba(255,196,0,.22)'; g.fill(); g.strokeStyle = '#e0a800'; g.lineWidth = 1.5; g.stroke();
    fieldPath(protR, seg(S.p, 0.3, 0.65)); g.fillStyle = 'rgba(230,40,40,.2)'; g.fill(); g.strokeStyle = '#d32f2f'; g.stroke();
    if (S.p > 0.5) {
      text(g, safety ? 'Warnfeld' : 'Feld 2', ox + R * 0.64, oy - R * 0.7, { f: F.helv, size: 10 * u, w: 600, c: '#a07800' });
      text(g, safety ? 'Schutzfeld' : 'Feld 1', ox + R * 0.38, oy - R * 0.36, { f: F.helv, size: 10 * u, w: 600, c: '#c62828' });
    }
    // Strahl und Punkte: Raumkontur liegt außerhalb der Felder
    const prev = st.phi; st.phi += S.dt * TAU * Math.min(1.2, (S.rpm / 60) * 0.12);
    const L = st.L; fade(L, Math.min(0.5, S.dt * 0.3));
    const sweep = (x) => a0 + (((x % TAU) + TAU) % TAU) / TAU * fov;
    if (S.ps > 0.5 || S.ready) {
      const lg = L.g, n = 160;
      for (let k = 0; k < n; k++) {
        const a = sweep(lerp(prev, st.phi, k / n)), r = Math.min(R * 1.06, Math.max(warnR(a) * 1.12, R * (0.7 + 0.5 * (st.room.at(a) / st.room.max))));
        lg.fillStyle = '#00467a'; lg.fillRect(ox + Math.cos(a) * r - 1, oy + Math.sin(a) * r - 1, 2, 2);
      }
      const a = sweep(st.phi);
      line(g, ox, oy, ox + Math.cos(a) * R * 1.06, oy + Math.sin(a) * R * 1.06, BL, 1.5, 0.8);
    }
    blit(g, L);
    g.fillStyle = '#4a5560'; rr(g, ox - 16 * u, oy - 10 * u, 32 * u, 26 * u, 4 * u); g.fill();
    g.fillStyle = '#ffd100'; g.fillRect(ox - 16 * u, oy - 10 * u, 32 * u, 6 * u);
    // LEDs und Status
    const px = wide ? W * 0.7 : 24 * u, py = wide ? 90 * u : H * 0.72;
    const leds = safety ? [['PWR', true, '#2e7d32'], ['OSSD', S.ready, S.ready ? '#2e7d32' : '#d32f2f'], ['WARN', S.p > 0.5, '#e0a800']] : [['PWR', true, '#2e7d32'], ['STAT', S.p > 0.3, S.ready ? '#2e7d32' : '#e0a800'], ['Q1', S.ready, '#2e7d32'], ['Q2', false, '#9e9e9e']];
    leds.forEach(([name, on, col], i) => {
      const x = px + i * 56 * u;
      circle(g, x + 7 * u, py, 6 * u, { fill: on || name === 'OSSD' ? col : '#cfd8dc', stroke: 'rgba(0,0,0,.2)' });
      text(g, name, x + 18 * u, py + 4 * u, { f: F.helv, size: 10.5 * u, w: 600, c: '#37474f' });
    });
    const lines = safety
      ? [{ s: 'Safety Designer verbunden', at: 0.1, ok: 0.15 }, { s: 'Konfiguration geprüft (CRC)', p: 0.15, ok: 0.4 }, { s: 'Schutzfeld 1 · Warnfeld 1', p: 0.35, ok: 0.65 }, { s: 'Wiederanlaufsperre: aus', p: 0.6 }, { s: (s) => `OSSD ${s.ready ? 'EIN' : 'AUS'}`, p: 0.8, ok: 0.999, okText: 'EIN' }]
      : [{ s: 'SOPAS · CoLa A · TCP 2111', at: 0.1, ok: 0.15 }, { s: 'Benutzerebene: Authorized Client', p: 0.15 }, { s: 'Feldsatz 1 aktiv', p: 0.35, ok: 0.65 }, { s: `Scanfrequenz ${D.hz} Hz · ${fmt(P.step || 0.25, 4).replace(/0+$/, '')}°`, p: 0.6 }, { s: 'Messung', p: 0.95, ok: 0.999 }];
    log(g, S, st, lines, px, py + 34 * u, { f: F.helv, size: 11.5 * u, lh: 19 * u, c: '#263238', okX: Math.min(W - px - 24 * u, 290 * u), okC: '#2e7d32', dimC: '#90a4ae', cur: BL, cps: 70, max: wide ? 8 : 3 });
  },
};

/* ---------- Hokuyo: SCIP-2.0-Handschlag im Terminal, daneben der Fächer im Schrittraster ---------- */
function scipSum(s) { let v = 0; for (let i = 0; i < s.length; i++) v += s.charCodeAt(i); return String.fromCharCode((v & 0x3f) + 0x30); }
SC.hokuyo = {
  init(S) { return { room: roomPolar(S.seed + 7), L: layer(S), k: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, P = D.P, OR = '#e8590c', NV = '#1f2a44';
    g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, W, H);
    text(g, 'HOKUYO', 24 * u, 38 * u, { f: F.courier, size: 18 * u, w: 700, c: NV, ls: 0.18 });
    text(g, D.model, 24 * u, 58 * u, { f: F.helv, size: 12.5 * u, c: '#5f5a4e' });
    // Parameter wie aus „PP“
    const spec = { urg04: [20, 5600, 1024, 44, 725, 384, 600], ust10: [20, 30000, 1440, 0, 1080, 540, 2400], utm30: [23, 60000, 1440, 0, 1080, 540, 2400] }[D.id] || [20, 5600, 1024, 44, 725, 384, 600];
    const [dmin, dmax, ares, amin, amax, afrt, scan] = spec;
    const model = D.model.replace(/[^A-Z0-9-]/gi, '');
    const L2 = (s) => s + scipSum(s);
    const lines = [
      { s: '> SCIP2.0', at: 0.15, c: OR }, { s: '  SCIP2.0  0' },
      { s: '> VV', p: 0.15, c: OR }, { s: '  ' + L2('VEND:Hokuyo Automatic Co.,Ltd.;') }, { s: '  ' + L2(`PROD:SOKUIKI Sensor ${model};`) }, { s: '  ' + L2('PROT:SCIP 2.0;') },
      { s: '> PP', p: 0.35, c: OR }, { s: '  ' + L2(`DMIN:${dmin};`) }, { s: '  ' + L2(`DMAX:${dmax};`) }, { s: '  ' + L2(`ARES:${ares};`) }, { s: '  ' + L2(`AMIN:${amin};`) }, { s: '  ' + L2(`AMAX:${amax};`) }, { s: '  ' + L2(`AFRT:${afrt};`) }, { s: '  ' + L2(`SCAN:${scan};`) },
      { s: '> BM', p: S.wb, c: OR }, { s: '  00P   (Laser an)', p: S.wb + 0.05 },
      { s: `> MD${pad(amin, 4)}${pad(amax, 4)}01000`, p: 0.97, c: OR }, { s: '  99b   (Messdaten …)', p: 0.995 },
    ];
    const wide = W / H > 1.1;
    const tx = 24 * u, ty = 78 * u, tw = wide ? W * 0.46 : W - 48 * u, th = wide ? H - ty - 24 * u : H * 0.42;
    g.fillStyle = NV; rr(g, tx, ty, tw, th, 3 * u); g.fill();
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(tx, ty, tw, 18 * u);
    text(g, 'COM3 · 115200 Bd · SCIP 2.0', tx + 10 * u, ty + 12.5 * u, { f: F.courier, size: 10 * u, c: '#b9c2d6' });
    log(g, S, st, lines, tx + 12 * u, ty + 38 * u, { f: F.courier, size: 11 * u, lh: 14.5 * u, c: '#f4f0e6', cur: OR, cps: 110, max: Math.max(4, Math.floor((th - 46 * u) / (14.5 * u))) });
    // Fächer
    const fx = wide ? W * 0.75 : W * 0.5, fy = wide ? H * 0.56 : ty + th + (H - ty - th) * 0.62, R = wide ? Math.min(W * 0.2, H * 0.32) : Math.min(W * 0.36, (H - ty - th) * 0.42);
    const step = TAU / ares, aFront = -Math.PI / 2;
    const ang = (idx) => aFront + (idx - afrt) * step;
    g.fillStyle = 'rgba(31,42,68,.05)'; g.beginPath(); g.moveTo(fx, fy); g.arc(fx, fy, R, ang(amin), ang(amax)); g.closePath(); g.fill();
    g.strokeStyle = NV; g.lineWidth = 1; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
    for (let i = 1; i <= 3; i++) circle(g, fx, fy, (R * i) / 3, { stroke: 'rgba(31,42,68,.18)', a0: ang(amin), a1: ang(amax) });
    for (const [idx, lab] of [[amin, 'AMIN'], [afrt, 'AFRT'], [amax, 'AMAX']]) {
      const a = ang(idx); line(g, fx, fy, fx + Math.cos(a) * R * 1.08, fy + Math.sin(a) * R * 1.08, OR, 1, 0.8);
      text(g, `${lab} ${idx}`, fx + Math.cos(a) * R * 1.18, fy + Math.sin(a) * R * 1.18 + 4 * u, { f: F.courier, size: 9.5 * u, w: 700, c: OR, al: 'center' });
    }
    const L = st.L; fade(L, Math.min(0.5, S.dt * 0.2));
    if (S.p > 0.97) {
      const per = Math.max(1, Math.round((amax - amin) / 90));
      for (let n = 0; n < 6; n++) {
        st.k = (st.k + per) % (amax - amin);
        const idx = amin + st.k, a = ang(idx), r = Math.min(R, (st.room.at(a) / st.room.max) * R * 1.4);
        L.g.fillStyle = NV; L.g.fillRect(fx + Math.cos(a) * r - 1, fy + Math.sin(a) * r - 1, 2, 2);
      }
    }
    blit(g, L);
    g.fillStyle = '#26272b'; rr(g, fx - 12 * u, fy - 12 * u, 24 * u, 24 * u, 4 * u); g.fill();
    circle(g, fx, fy, 6 * u, { fill: S.p > S.wb ? OR : '#55585f' });
    text(g, `${D.hz} Hz · ${fmt(360 / ares, 3)}°/Schritt`, fx, fy + 34 * u, { f: F.courier, size: 10.5 * u, c: NV, al: 'center' });
  },
};

/* ---------- Slamtec: Triangulation (A1/A2) bzw. Laufzeit (S2), daneben das Polardiagramm ---------- */
SC.slamtec = {
  init(S) { return { phi: 0, room: roomPolar(S.seed + 9), L: layer(S) }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, CO = '#ff6b4a';
    fillBg(g, S, '#111c44', '#040814', [0.3, 0.3, 0.9]);
    text(g, 'SLAMTEC', 26 * u, 40 * u, { f: F.avenir, size: 17 * u, w: 800, c: '#ffffff', ls: 0.12 });
    text(g, D.model, 26 * u, 60 * u, { f: F.avenir, size: 12.5 * u, c: 'rgba(238,241,255,.6)' });
    const hex = Array.from({ length: 16 }, (_, i) => ((S.seed >>> (i % 24)) ^ (i * 2654435761)) & 255).map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
    text(g, `S/N ${hex}`, W - 26 * u, 38 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(238,241,255,.45)', al: 'right' });
    const wide = W / H > 1.1, dtof = D.id === 'rps2';
    // Messprinzip
    const bx = 26 * u, by = 90 * u, bw = wide ? W * 0.42 : W - 52 * u, bh = wide ? H * 0.5 : H * 0.3;
    g.fillStyle = 'rgba(10,17,41,.8)'; rr(g, bx, by, bw, bh, 18 * u); g.fill();
    const tz = bx + bw * (0.62 + 0.25 * Math.sin(S.t * 0.9));
    const ey = by + bh * 0.3, sy = by + bh * 0.7, ex = bx + 30 * u;
    g.fillStyle = '#2a3870'; g.fillRect(tz, by + 16 * u, 8 * u, bh - 32 * u);
    if (!dtof) {
      // Sender – Ziel – Linse – Zeilensensor
      g.fillStyle = CO; g.fillRect(ex - 10 * u, ey - 5 * u, 16 * u, 10 * u);
      const on = S.pb > 0.3;
      if (on) { line(g, ex + 6 * u, ey, tz, ey, CO, 2 * u, 0.9); circle(g, tz, ey, 4 * u, { fill: '#ffd0c2' }); line(g, tz, ey, ex + 40 * u, sy, CO, 1, 0.5); }
      g.strokeStyle = '#9fb0ff'; g.lineWidth = 2; g.beginPath(); g.ellipse(ex + 40 * u, sy, 4 * u, 14 * u, 0, 0, TAU); g.stroke();
      const sensX = ex + 10 * u, n = 24, spot = clamp(1 - (tz - bx) / bw) * n;
      for (let i = 0; i < n; i++) { g.fillStyle = on && Math.abs(i - spot) < 1.2 ? CO : '#26336a'; g.fillRect(sensX - 6 * u, sy - 22 * u + (i * 44 * u) / n, 10 * u, (44 * u) / n - 1); }
      text(g, 'Triangulation: d = f · b / x', bx + bw - 14 * u, by + bh - 14 * u, { f: F.avenir, size: 10.5 * u, c: 'rgba(238,241,255,.6)', al: 'right' });
    } else {
      const k = (S.t * 1.3) % 1, x = k < 0.5 ? lerp(ex, tz, k * 2) : lerp(tz, ex, (k - 0.5) * 2);
      g.fillStyle = CO; g.fillRect(ex - 10 * u, ey - 5 * u, 16 * u, 10 * u);
      if (S.pb > 0.3) circle(g, x, ey, 5 * u, { fill: CO });
      text(g, `Δt ${fmt(((tz - ex) / bw) * 33.3, 1)} ns`, bx + bw - 14 * u, by + bh - 14 * u, { f: F.mono, size: 11 * u, c: 'rgba(238,241,255,.7)', al: 'right' });
      text(g, 'Direkte Laufzeit (DTOF)', bx + 14 * u, by + bh - 14 * u, { f: F.avenir, size: 10.5 * u, c: 'rgba(238,241,255,.6)' });
    }
    // Polardiagramm
    const ox = wide ? W * 0.75 : W * 0.5, oy = wide ? H * 0.45 : by + bh + (H - by - bh) * 0.46, R = wide ? Math.min(W * 0.2, H * 0.32) : Math.min(W * 0.32, (H - by - bh) * 0.36);
    g.fillStyle = '#050a1a'; g.beginPath(); g.arc(ox, oy, R * 1.06, 0, TAU); g.fill();
    for (let i = 1; i <= 4; i++) circle(g, ox, oy, (R * i) / 4, { stroke: 'rgba(120,140,220,.22)' });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; line(g, ox, oy, ox + Math.cos(a) * R, oy + Math.sin(a) * R, 'rgba(120,140,220,.12)'); }
    const prev = st.phi; st.phi += S.dt * TAU * Math.min(1.2, S.rpm / 60);
    const L = st.L; fade(L, Math.min(0.5, S.dt * 0.25));
    if (S.ps > 0.6 || S.ready) {
      const n = Math.ceil(((st.phi - prev) / TAU) * 500);
      for (let k = 0; k < n; k++) { const a = lerp(prev, st.phi, k / n), r = (st.room.at(a) / st.room.max) * R; L.g.fillStyle = '#ff3d3d'; L.g.fillRect(ox + Math.cos(a) * r - 1.2, oy + Math.sin(a) * r - 1.2, 2.4, 2.4); }
    }
    blit(g, L);
    line(g, ox, oy, ox + Math.cos(st.phi) * R, oy + Math.sin(st.phi) * R, '#ffb199', 1, 0.6);
    text(g, `RPM ${pad(S.rpm, 3)}`, ox, oy + R + 26 * u, { f: F.mono, size: 12 * u, w: 600, c: '#ffffff', al: 'center' });
    const mode = D.id === 'rpa1' ? 'Standard' : D.id === 'rpa2' ? 'Boost' : 'DenseBoost';
    const lines = [
      { s: `Firmware 1.29 · Hardware 7`, at: 0.1 },
      { s: 'Health', p: 0.15, ok: 0.35, okText: 'Good' },
      { s: `Motor-PWM ${D.id === 'rpa1' ? 'Spannung' : '660'}`, p: S.wb, ok: 0.99 },
      { s: `Scan-Modus: ${mode}`, p: 0.9 },
    ];
    log(g, S, st, lines, bx + 2 * u, by + bh + 28 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(238,241,255,.75)', okX: Math.min(bw, 260 * u), okC: '#5dff9e', cur: CO, max: wide ? 5 : 2 });
  },
};

/* ---------- Unitree L1: Halbkugel füllt sich nicht wiederholend, IMU findet die Schwerkraft ---------- */
SC.unitree = {
  init(S) { return { k: 0, L: layer(S), rot: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, OR = '#ff8a2a';
    fillBg(g, S, '#161616', '#000000', [0.5, 0.55, 0.8]);
    text(g, 'UNITREE', 26 * u, 40 * u, { f: F.futura, size: 16 * u, w: 600, c: '#ffffff', ls: 0.36 });
    text(g, 'L1 · 4D LIDAR', 26 * u, 60 * u, { f: F.futura, size: 12 * u, w: 500, c: OR, ls: 0.16 });
    text(g, `SN ${D.serial}`, W - 26 * u, 38 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(255,255,255,.4)', al: 'right' });
    const cx = W * 0.5, cy = H * 0.64, R = Math.min(W * 0.32, H * 0.42);
    st.rot += S.dt * 0.04;
    const proj = (az, el) => { const x = Math.cos(el) * Math.cos(az + st.rot), z = Math.cos(el) * Math.sin(az + st.rot), y = Math.sin(el); return [cx + x * R, cy - y * R * 0.95 + z * R * 0.28, z]; };
    // Gitter
    g.lineWidth = 1;
    for (let e = 0; e <= 4; e++) { const el = (e / 4) * (Math.PI / 2) * 0.98; g.beginPath(); for (let i = 0; i <= 72; i++) { const [x, y] = proj((i / 72) * TAU, el); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.strokeStyle = 'rgba(255,255,255,.1)'; g.stroke(); }
    for (let a = 0; a < 12; a++) { g.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = proj((a / 12) * TAU, (i / 24) * Math.PI / 2); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.strokeStyle = 'rgba(255,255,255,.07)'; g.stroke(); }
    // Punkte (Goldener-Schnitt-Folge = nicht wiederholend)
    const L = st.L; fade(L, Math.min(0.5, S.dt * 0.15));
    if (S.ps > 0 || S.ready) {
      const n = Math.round(260 * (S.ready ? 1 : S.ps));
      for (let i = 0; i < n; i++) {
        st.k++;
        const az = ((st.k * 0.7548776662466927) % 1) * TAU, el = Math.asin((st.k * 0.5698402909980532) % 1) * 0.98;
        const [x, y, z] = proj(az, el);
        L.g.fillStyle = z > 0 ? `rgba(255,138,42,.9)` : 'rgba(255,255,255,.35)'; L.g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }
    }
    blit(g, L);
    g.fillStyle = '#1c1c1c'; rr(g, cx - 22 * u, cy - 6 * u, 44 * u, 30 * u, 6 * u); g.fill();
    g.fillStyle = '#2c2c2c'; g.beginPath(); g.ellipse(cx, cy - 6 * u, 20 * u, 8 * u, 0, 0, TAU); g.fill();
    // IMU-Achsen: Schwerkraftvektor pendelt sich ein
    const ix = 70 * u, iy = H - 70 * u, ir = 38 * u, wob = (1 - eo(S.pb)) * 0.6;
    const gv = [Math.sin(S.t * 3.1) * wob, 1, Math.cos(S.t * 2.3) * wob];
    for (const [dx, dy, c, n] of [[1, 0.25, '#ff4d4d', 'x'], [-0.55, 0.5, '#4dff88', 'y'], [0, -1, '#4da6ff', 'z']]) { line(g, ix, iy, ix + dx * ir, iy + dy * ir, c, 2, 0.8); text(g, n, ix + dx * ir * 1.2, iy + dy * ir * 1.2 + 4 * u, { f: F.mono, size: 10 * u, c, al: 'center' }); }
    line(g, ix, iy, ix + gv[0] * ir * 0.8, iy + gv[1] * ir * 0.8, OR, 3, 1);
    text(g, S.pb < 1 ? 'IMU kalibriert …' : 'IMU 6-Achsen · g = 9,81 m/s²', ix + ir + 16 * u, iy + 4 * u, { f: F.futura, size: 11 * u, c: 'rgba(255,255,255,.75)' });
    const kx = W - 26 * u;
    text(g, '360° × 90°', kx, H * 0.2, { f: F.futura, size: 28 * u, w: 500, c: '#ffffff', al: 'right' });
    text(g, 'Sichtfeld · Halbkugel', kx, H * 0.2 + 18 * u, { f: F.futura, size: 11 * u, c: 'rgba(255,255,255,.5)', al: 'right' });
    text(g, '21.600 Punkte/s', kx, H * 0.2 + 52 * u, { f: F.futura, size: 18 * u, w: 500, c: OR, al: 'right' });
    text(g, S.ready ? 'misst' : S.ph === 'boot' ? 'startet' : 'Rotor läuft an', kx, H * 0.2 + 72 * u, { f: F.futura, size: 11 * u, c: 'rgba(255,255,255,.5)', al: 'right' });
  },
};

/* ---------- Luminar Iris: 1550-nm-Puls fährt die Straße hinauf, Entfernungsringe bis 250 m ---------- */
SC.luminar = {
  draw(g, S) {
    const u = S.u, W = S.W, H = S.H, D = S.dev;
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0d0612'); sky.addColorStop(0.45, '#1a0b22'); sky.addColorStop(0.46, '#07040a'); sky.addColorStop(1, '#000000');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(26 * u, 0, 190 * u, 0); gr.addColorStop(0, '#ff4f8b'); gr.addColorStop(1, '#a24bff');
    text(g, 'LUMINAR', 26 * u, 40 * u, { f: F.avenir, size: 15 * u, w: 300, c: '#ffffff', ls: 0.6 });
    text(g, `${D.model}  ·  1550 nm`, 26 * u, 60 * u, { f: F.avenir, size: 12 * u, w: 400, c: gr });
    text(g, `S/N ${D.serial}`, W - 26 * u, 38 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(255,255,255,.35)', al: 'right' });
    const hy = H * 0.46, vx = W / 2;
    // Distanz → Bildhöhe (Perspektive)
    const K = 70, yAt = (d) => hy + (H - hy) * (K / (d + K));
    const half = (d) => (W * 0.42) * (K / (d + K)) + 3;
    // Fahrbahn
    g.fillStyle = '#0a070d'; g.beginPath(); g.moveTo(vx - half(0) * 1.6, H); g.lineTo(vx - 2, hy); g.lineTo(vx + 2, hy); g.lineTo(vx + half(0) * 1.6, H); g.closePath(); g.fill();
    for (const s of [-1, 1]) { g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(vx + s * half(0) * 1.6, H); g.lineTo(vx + s * 2, hy); g.stroke(); }
    for (let d = 4; d < 300; d += 14) { const y0 = yAt(d), y1 = yAt(d + 6); line(g, vx - 0.5, y0, vx - 0.5, y1, 'rgba(255,255,255,.35)', Math.max(1, 6 * (K / (d + K)))); }
    // Entfernungsringe
    for (const d of [50, 100, 150, 200, 250]) {
      const y = yAt(d), w = half(d) * 2.2;
      g.strokeStyle = 'rgba(162,75,255,.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(vx, y, w, w * 0.08, 0, 0, TAU); g.stroke();
      text(g, `${d} m`, vx + w + 8 * u, y + 4 * u, { f: F.avenir, size: 10 * u, c: 'rgba(255,255,255,.5)' });
    }
    // Puls: läuft hin und zurück
    if (S.pb > 0.2) {
      const k = (S.t * 0.55) % 1, d = 5 + (k < 0.5 ? k * 2 : 2 - k * 2) * 255, y = yAt(d), w = half(d) * 2.2;
      g.strokeStyle = k < 0.5 ? '#ff4f8b' : '#a24bff'; g.lineWidth = 2.5; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(vx, y, w, w * 0.08, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
    }
    // erkannte Objekte
    if (S.p > 0.6) {
      for (const [d, off, lab, side] of [[38, -0.45, 'PKW', -1], [96, 0.4, 'LKW', 1], [182, -0.35, 'PKW', -1], [243, 0.3, 'Reifen 10 %', 1]]) {
        const y = yAt(d), sc = K / (d + K), x = vx + off * half(d) * 2;
        const w = 150 * u * sc * (lab === 'LKW' ? 1.3 : 1) + 4, hgt = 90 * u * sc * (lab === 'LKW' ? 1.6 : 1) + 3;
        const a = seg(S.p, 0.6, 0.8);
        g.strokeStyle = '#ff4f8b'; g.lineWidth = 1.5; g.globalAlpha = a; g.strokeRect(x - w / 2, y - hgt, w, hgt); g.globalAlpha = 1;
        const lx = x + side * (w / 2 + 26 * u);
        line(g, x + side * w / 2, y - hgt / 2, lx, y - hgt / 2, '#ff4f8b', 1, a * 0.7);
        text(g, `${lab} · ${d} m`, lx + side * 4 * u, y - hgt / 2 + 4 * u, { f: F.avenir, size: Math.max(8.5, 10.5 * u), c: '#ffffff', al: side > 0 ? 'left' : 'right', a });
      }
    }
    // ROI am Horizont
    const roi = 26 * u * (1.6 - S.p);
    g.fillStyle = 'rgba(255,79,139,.07)'; g.fillRect(0, hy - roi, W, roi * 2);
    text(g, 'ROI · Horizont verdichtet', 26 * u, hy - roi - 6 * u, { f: F.avenir, size: 10 * u, c: 'rgba(255,79,139,.8)' });
    // Kennzahlen
    text(g, '250 m', W - 26 * u, 96 * u, { f: F.avenir, size: 40 * u, w: 200, c: '#ffffff', al: 'right' });
    text(g, 'bei 10 % Reflektivität', W - 26 * u, 114 * u, { f: F.avenir, size: 11 * u, c: 'rgba(255,255,255,.5)', al: 'right' });
    text(g, '> 300 Punkte/°²', W - 26 * u, 140 * u, { f: F.avenir, size: 13 * u, w: 500, c: gr, al: 'right' });
    bar(g, 26 * u, H - 22 * u, W - 52 * u, 2 * u, S.p, '#ff4f8b', 'rgba(255,255,255,.08)');
  },
};

/* ---------- Matterport Pro3: Puppenhaus-Modell wächst, das Gerät dreht – digitaler Zwilling ---------- */
SC.matterport = {
  draw(g, S) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, V = '#8f6bff';
    fillBg(g, S, '#2a2142', '#0b0912', [0.5, 0.3, 0.9]);
    text(g, 'Matterport', 26 * u, 42 * u, { f: F.avenir, size: 20 * u, w: 600, c: '#ffffff' });
    text(g, `${D.model}  ·  Digitaler Zwilling`, 26 * u, 62 * u, { f: F.avenir, size: 12 * u, c: 'rgba(241,238,252,.55)' });
    const cx = W * 0.5, cy = H * 0.55, s = Math.min(W / 1.25, H) * 0.0074;
    const iso = (x, y, z) => [cx + (x - z) * s * 8.66, cy + (x + z) * s * 5 - y * s * 10];
    const quad = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([x, y, z], i) => { const [px, py] = iso(x, y, z); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } };
    const pFloor = seg(S.p, 0, 0.3), pWall = eo(seg(S.p, 0.2, 0.7)), pFurn = seg(S.p, 0.55, 0.95);
    const X = 5, Z = 4;
    // Boden mit Raster
    quad([[-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z]], `rgba(143,107,255,${0.12 * pFloor})`, `rgba(143,107,255,${0.5 * pFloor})`);
    g.globalAlpha = pFloor * 0.35;
    for (let i = -X; i <= X; i++) { const [a, b] = iso(i, 0, -Z), [c, d] = iso(i, 0, Z); line(g, a, b, c, d, '#8f6bff', 1, 0.3); }
    for (let i = -Z; i <= Z; i++) { const [a, b] = iso(-X, 0, i), [c, d] = iso(X, 0, i); line(g, a, b, c, d, '#8f6bff', 1, 0.3); }
    g.globalAlpha = 1;
    const hgt = 2.8 * pWall;
    quad([[-X, 0, -Z], [X, 0, -Z], [X, hgt, -Z], [-X, hgt, -Z]], 'rgba(200,185,255,.16)', 'rgba(220,210,255,.6)');
    quad([[-X, 0, -Z], [-X, 0, Z], [-X, hgt, Z], [-X, hgt, -Z]], 'rgba(170,150,255,.12)', 'rgba(220,210,255,.6)');
    // Fenster und Tür
    if (pWall > 0.8) { quad([[1, 1, -Z], [3, 1, -Z], [3, 2.1, -Z], [1, 2.1, -Z]], 'rgba(120,200,255,.25)', 'rgba(180,230,255,.7)'); quad([[-X, 0, 0.5], [-X, 0, 1.6], [-X, 2.1, 1.6], [-X, 2.1, 0.5]], 'rgba(0,0,0,.25)', 'rgba(220,210,255,.6)'); }
    // Möbel
    const box = (x0, z0, x1, z1, h0, col) => { const hh = h0 * eo(pFurn); quad([[x0, hh, z0], [x1, hh, z0], [x1, hh, z1], [x0, hh, z1]], col, 'rgba(255,255,255,.4)'); quad([[x0, 0, z1], [x1, 0, z1], [x1, hh, z1], [x0, hh, z1]], 'rgba(0,0,0,.2)', 'rgba(255,255,255,.25)'); quad([[x1, 0, z0], [x1, 0, z1], [x1, hh, z1], [x1, hh, z0]], 'rgba(0,0,0,.3)', 'rgba(255,255,255,.25)'); };
    if (pFurn > 0) { box(-4.5, -3.6, -1.5, -2.4, 0.8, 'rgba(255,170,120,.35)'); box(1.5, 0.5, 3.5, 2.5, 0.75, 'rgba(120,220,200,.3)'); box(-2, 1.5, -1.2, 2.3, 1.1, 'rgba(255,255,255,.2)'); }
    // Gerät auf dem Stativ mit drehender Abtastlinie
    const [sx, sy] = iso(0, 0, 0), [tx, ty] = iso(0, 1.5, 0);
    line(g, sx, sy, tx, ty, '#ffffff', 2, 0.7);
    const ang = S.t * (S.ready ? 2.4 : 0.6 + S.ps * 1.8);
    for (let k = 0; k < 18; k++) { const a = ang - k * 0.05; const [px, py] = iso(Math.cos(a) * 4.5, 1.5, Math.sin(a) * 3.6); line(g, tx, ty, px, py, V, 1, 0.3 * (1 - k / 18)); }
    circle(g, tx, ty, 6 * u, { fill: '#ffffff' });
    // Fortschrittsring unten
    const rx = W / 2, ry = H - 46 * u, r = 20 * u;
    circle(g, rx, ry, r, { stroke: 'rgba(255,255,255,.15)', w: 4 * u });
    g.strokeStyle = V; g.lineWidth = 4 * u; g.lineCap = 'round'; g.beginPath(); g.arc(rx, ry, r, -Math.PI / 2, -Math.PI / 2 + S.p * TAU); g.stroke(); g.lineCap = 'butt';
    text(g, S.ready ? 'Bereit für den ersten Scan' : S.p < 0.35 ? 'Verbindung über WLAN …' : S.p < 0.7 ? 'Kameras werden kalibriert …' : 'LiDAR läuft an …', rx + r + 14 * u, ry + 5 * u, { f: F.avenir, size: 13 * u, w: 500, c: '#ffffff' });
  },
};

/* ---------- GeoSLAM ZEB Horizon: ruhig halten (IMU), dann Losgehen – Weg und Karte wachsen ---------- */
SC.geoslam = {
  init(S) { return { path: [], L: layer(S), phi: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, GR = '#3fd47a';
    fillBg(g, S, '#13241b', '#040806', [0.5, 0.4, 0.8]);
    text(g, 'GeoSLAM', 26 * u, 42 * u, { f: F.gill, size: 21 * u, w: 600, c: '#ffffff' });
    text(g, `${D.model}  ·  Scankopf VLP-16 auf Rotor`, 26 * u, 62 * u, { f: F.gill, size: 12 * u, c: 'rgba(233,245,238,.55)' });
    text(g, `S/N ${D.serial}`, W - 26 * u, 40 * u, { f: F.mono, size: 10.5 * u, c: 'rgba(233,245,238,.4)', al: 'right' });
    const wide = W / H > 1.1, cx = wide ? W * 0.3 : W * 0.5, cy = H * (wide ? 0.52 : 0.4), R = Math.min(W * 0.18, H * 0.25);
    // Ruhig-halten-Ring (Initialisierung)
    const still = S.ph === 'boot';
    circle(g, cx, cy, R, { stroke: 'rgba(255,255,255,.1)', w: 8 * u });
    g.strokeStyle = GR; g.lineWidth = 8 * u; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + S.p * TAU); g.stroke(); g.lineCap = 'butt';
    text(g, still ? 'Ruhig halten' : S.ready ? 'Losgehen' : 'Rotor läuft an', cx, cy - 4 * u, { f: F.gill, size: 18 * u, w: 600, c: '#ffffff', al: 'center' });
    // IMU-Rauschen wird kleiner
    const nx = cx - R * 0.6, nw = R * 1.2, ny = cy + 22 * u, amp = (1 - eo(S.pb)) * 10 * u + 1 * u;
    for (const [c, ph] of [['#ff6b6b', 0], ['#6bffa3', 2], ['#6bb5ff', 4]]) {
      g.beginPath();
      for (let i = 0; i <= 60; i++) { const x = nx + (i / 60) * nw, y = ny + Math.sin(i * 1.7 + S.t * 9 + ph) * Math.sin(i * 0.37 + ph) * amp; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.strokeStyle = c; g.lineWidth = 1; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    }
    text(g, 'IMU', cx, ny + 26 * u, { f: F.mono, size: 9.5 * u, c: 'rgba(233,245,238,.5)', al: 'center' });
    // Weg und Karte (nach dem Start)
    const mx = wide ? W * 0.72 : W * 0.5, my = wide ? H * 0.52 : H * 0.78, mr = wide ? Math.min(W * 0.22, H * 0.34) : Math.min(W * 0.36, H * 0.17);
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.strokeRect(mx - mr, my - mr, mr * 2, mr * 2);
    const L = st.L;
    // Grundriss in Kartenkoordinaten (−1 … 1): Außenwände, Innenwand mit Durchgang, zwei Pfeiler
    const walls = [[-0.9, -0.9, 0.9, -0.9], [0.9, -0.9, 0.9, 0.9], [0.9, 0.9, -0.9, 0.9], [-0.9, 0.9, -0.9, -0.9], [-0.1, -0.9, -0.1, -0.15], [-0.1, 0.25, -0.1, 0.9], [0.4, 0.3, 0.6, 0.3], [-0.6, -0.4, -0.45, -0.4]];
    if (S.ps > 0 || S.ready) {
      const k = (S.t - (st.t0 ?? (st.t0 = S.t))) * 0.22, qx0 = 0.55 * Math.cos(k), qy0 = 0.45 * Math.sin(2 * k) - 0.05;
      const px = mx + qx0 * mr, py = my + qy0 * mr;
      const last = st.path[st.path.length - 1];
      if (!last || Math.hypot(last[0] - px, last[1] - py) > 2) st.path.push([px, py]);
      st.phi += S.dt * 9;
      for (let i = 0; i < 140; i++) {
        const a = st.phi + i * 0.0449, dx = Math.cos(a), dy = Math.sin(a);
        let t = 0.85; // Reichweite in Kartenmaß
        for (const [x0, y0, x1, y1] of walls) {
          const ex = x1 - x0, ey = y1 - y0, den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-9) continue;
          const tt = ((x0 - qx0) * ey - (y0 - qy0) * ex) / den, uu = ((x0 - qx0) * dy - (y0 - qy0) * dx) / den;
          if (tt > 0 && tt < t && uu >= 0 && uu <= 1) t = tt;
        }
        if (t < 0.85) { L.g.fillStyle = 'rgba(63,212,122,.75)'; L.g.fillRect(px + dx * t * mr - 0.8, py + dy * t * mr - 0.8, 1.6, 1.6); }
      }
    }
    blit(g, L);
    if (st.path.length > 1) { g.strokeStyle = '#ffffff'; g.lineWidth = 2 * u; g.beginPath(); st.path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); const [x, y] = st.path[st.path.length - 1]; circle(g, x, y, 4 * u, { fill: GR }); }
    text(g, 'Start- und Endpunkt gleich halten', mx, my + mr + 20 * u, { f: F.gill, size: 11 * u, c: 'rgba(233,245,238,.6)', al: 'center' });
  },
};

/* ---------- Smartphone: 576 Punkte des Projektors flackern, die Szene wird zum Netz ---------- */
SC.ios = {
  draw(g, S) {
    const u = S.u, W = S.W, H = S.H;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // Raumecke vor der Kamera: Boden 1,3 m tiefer, Ecke 4 m entfernt, Wände unter 45°
    const f = Math.min(W, H) * 0.95, cx = W / 2, cy = H * 0.44, Q = Math.SQRT1_2;
    const P = (x, y, z) => [cx + (x / z) * f, cy - (y / z) * f];
    const pm = seg(S.t, 0.5, 2.2);
    // Netz wie die Szenenrekonstruktion: Boden blau, Wände gelb, wächst von der Bildmitte nach außen
    if (pm > 0) {
      const tri = (A, B, C, col, mA) => {
        const pa = P(...A), pb = P(...B), pc = P(...C);
        const mx = (pa[0] + pb[0] + pc[0]) / 3 - cx, my = (pa[1] + pb[1] + pc[1]) / 3 - cy;
        const k = Math.hypot(mx, my) / (Math.min(W, H) * 0.62) + 0.12 * Math.sin(mx * 0.05 + my * 0.07);
        if (k > pm) return;
        g.beginPath(); g.moveTo(...pa); g.lineTo(...pb); g.lineTo(...pc); g.closePath();
        g.fillStyle = col.replace('A', String(mA * 0.14)); g.fill(); g.strokeStyle = col.replace('A', String(mA * clamp((pm - k) * 6))); g.lineWidth = 0.8; g.stroke();
      };
      const grid = (fn, n1, n2, col, mA) => { for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) { const A = fn(i, j), B = fn(i + 1, j), C = fn(i + 1, j + 1), D = fn(i, j + 1); if (!A || !B || !C || !D) continue; tri(A, B, C, col, mA); tri(A, C, D, col, mA); } };
      grid((i, j) => { const x = -2.4 + i * 0.3, z = 1.9 + j * 0.3; return z <= 4 - Math.abs(x) + 0.01 ? [x, -1.3, z] : null; }, 16, 8, 'rgba(100,210,255,A)', 0.5);
      for (const sgn of [-1, 1]) grid((i, j) => { const sv = i * 0.3, y = -1.3 + j * 0.3; return [sgn * sv * Q, y, 4 - sv * Q]; }, 6, 9, 'rgba(255,214,10,A)', 0.26);
    }
    // Projektorpunkte (gedrehtes 24 × 24-Raster), Größe und Helligkeit nach Entfernung
    g.save(); g.translate(cx, cy); g.rotate(0.12);
    const n = 24, sp = Math.min(W, H) * 0.5 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i - n / 2 + 0.5) * sp, y = (j - n / 2 + 0.5) * sp;
      const sx = x * Math.cos(0.12) - y * Math.sin(0.12), sy = x * Math.sin(0.12) + y * Math.cos(0.12);
      const dx = sx / f, dy = -sy / f, tw = 4 / (1 + Math.abs(dx)), tf = dy < -1e-4 ? -1.3 / dy : Infinity, d = Math.min(tw, tf);
      const fl = 0.5 + 0.5 * Math.sin(S.t * 14 + i * 1.3 + j * 0.7);
      g.fillStyle = `rgba(200,180,255,${(0.3 + 0.6 * fl) * (1 - pm * 0.5)})`;
      g.beginPath(); g.arc(x, y, (2.6 / d) * 2.2 * u, 0, TAU); g.fill();
    }
    g.restore();
    const label = S.t < 1.1 ? 'LiDAR wird gestartet' : 'Bewege das Gerät langsam';
    g.font = `600 ${14 * u}px ${F.sf}`;
    const tw = g.measureText(label).width + 36 * u;
    g.fillStyle = 'rgba(44,44,46,.88)'; rr(g, cx - tw / 2, H - 70 * u, tw, 34 * u, 17 * u); g.fill();
    text(g, label, cx, H - 48 * u, { f: F.sf, size: 14 * u, w: 600, c: '#ffffff', al: 'center' });
    text(g, '576 Punkte · direkte Laufzeit · 940 nm', cx, 40 * u, { f: F.sf, size: 12 * u, c: 'rgba(235,235,245,.6)', al: 'center' });
  },
};

/* ---------- Intel RealSense L515: MEMS-Spiegel rastert das Tiefenbild Zeile für Zeile ---------- */
SC.intel = {
  init(S) { const w = Math.min(S.W * 0.56, 480 * S.u), h = w * 0.75; return { w, h, L: layer(S, w, h), yv: 0 }; },
  draw(g, S, st) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, CY = '#00c7fd';
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, W, H);
    text(g, 'intel', 26 * u, 40 * u, { f: F.segoe, size: 22 * u, w: 600, c: '#ffffff' });
    text(g, 'RealSense', 26 * u + 52 * u, 40 * u, { f: F.segoe, size: 16 * u, w: 400, c: CY });
    text(g, `${D.model} · USB 3.2 · FW 01.05.08.01`, 26 * u, 60 * u, { f: F.segoe, size: 11.5 * u, c: 'rgba(233,235,238,.55)' });
    const ix = W - st.w - 26 * u, iy = Math.max(84 * u, (H - st.h) / 2 + 10 * u);
    g.fillStyle = '#000'; g.fillRect(ix, iy, st.w, st.h);
    // Raster: schnelle Zeile (Resonanz), langsame Spalte
    const L = st.L, lg = L.g;
    if (S.pb > 0.25) {
      const lines2 = Math.ceil(S.dt * (S.ready ? 260 : 90 + 170 * S.p));
      for (let k = 0; k < lines2; k++) {
        st.yv = (st.yv + 1) % 120;
        const y = (st.yv / 120) * st.h;
        for (let i = 0; i < 64; i++) {
          const x = (i / 64) * st.w, nx = i / 64, ny = st.yv / 120;
          let d = 0.35 + 0.4 * ny + 0.1 * Math.sin(nx * 6);
          if (nx > 0.3 && nx < 0.55 && ny > 0.4) d = 0.2;
          if (nx > 0.7 && ny > 0.25 && ny < 0.7) d = 0.55;
          lg.fillStyle = turbo(1 - d); lg.fillRect(x, y, st.w / 64 + 0.5, st.h / 120 + 0.5);
        }
      }
      const y = (st.yv / 120) * st.h, x = (0.5 + 0.5 * Math.sin(S.t * 40)) * st.w;
      blit(g, L, ix, iy);
      circle(g, ix + x, iy + y, 4 * u, { fill: '#ffffff' });
      line(g, ix, iy + y, ix + st.w, iy + y, '#ffffff', 1, 0.4);
    }
    g.strokeStyle = '#3a3d43'; g.strokeRect(ix - 0.5, iy - 0.5, st.w + 1, st.h + 1);
    text(g, 'Depth · 1024 × 768 · 30 fps', ix, iy - 8 * u, { f: F.segoe, size: 10.5 * u, c: 'rgba(233,235,238,.6)' });
    // Seitenleiste wie im Viewer
    const px = 26 * u, py = 92 * u;
    const rows = [['Stream', S.ready ? 'Depth ●' : '–'], ['Preset', 'Max Range'], ['Laser Power', `${Math.round(100 * clamp(S.p * 1.2))} %`], ['Confidence', S.ready ? 'High' : 'Low'], ['MEMS', S.pb > 0.25 ? 'resonant' : 'aus']];
    rows.forEach(([k, v], i) => {
      const y = py + i * 30 * u;
      g.fillStyle = '#26282c'; g.fillRect(px, y, Math.min(200 * u, ix - px - 20 * u), 24 * u);
      text(g, k, px + 8 * u, y + 16 * u, { f: F.segoe, size: 11 * u, c: 'rgba(233,235,238,.6)' });
      text(g, v, px + Math.min(200 * u, ix - px - 20 * u) - 8 * u, y + 16 * u, { f: F.segoe, size: 11 * u, w: 600, c: CY, al: 'right' });
    });
  },
};

/* ---------- Orbbec Femto Bolt: iToF – vier Phasenproben, zwei Frequenzen, Tiefenbild mit sechseckiger Sicht ---------- */
SC.orbbec = {
  draw(g, S) {
    const u = S.u, W = S.W, H = S.H, D = S.dev, M = '#2ee6a6';
    fillBg(g, S, '#10232a', '#04080a', [0.5, 0.35, 0.85]);
    text(g, 'ORBBEC', 26 * u, 40 * u, { f: F.avenir, size: 16 * u, w: 700, c: '#ffffff', ls: 0.3 });
    text(g, `${D.model} · NFOV unbinned 640 × 576 · 30 fps`, 26 * u, 60 * u, { f: F.avenir, size: 11.5 * u, c: 'rgba(230,246,242,.55)' });
    const wide = W / H > 1.1;
    // vier Phasenproben
    const bx = 26 * u, by = 100 * u, bw = wide ? W * 0.4 : W - 52 * u, bh = 110 * u;
    const phi = 1.1 + 0.3 * Math.sin(S.t * 0.8);
    ['Q 0°', 'Q 90°', 'Q 180°', 'Q 270°'].forEach((lab, k) => {
      const v = 0.5 + 0.45 * Math.cos(phi - (k * Math.PI) / 2) * clamp(S.pb * 1.5);
      const x = bx + k * (bw / 4) + 8 * u, w = bw / 4 - 16 * u;
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, by, w, bh);
      g.fillStyle = M; g.fillRect(x, by + bh * (1 - v), w, bh * v);
      text(g, lab, x + w / 2, by + bh + 16 * u, { f: F.mono, size: 10 * u, c: 'rgba(230,246,242,.7)', al: 'center' });
    });
    text(g, `φ = atan2(Q270 − Q90, Q0 − Q180) = ${fmt((phi * 180) / Math.PI, 1)}°`, bx, by + bh + 40 * u, { f: F.mono, size: 10.5 * u, c: '#ffffff' });
    // zwei Frequenzen: Sägezähne, Schnitt = eindeutige Entfernung
    const sy = by + bh + 62 * u, sh = 46 * u;
    if (sy + sh < H - 10 * u) {
      for (const [f, c] of [[3.2, M], [5.1, '#7fb8ff']]) {
        g.beginPath();
        for (let i = 0; i <= 200; i++) { const x = i / 200, y = (x * f) % 1; const px2 = bx + x * bw, py2 = sy + sh - y * sh; if (i && (x * f) % 1 < ((i - 1) / 200 * f) % 1) g.moveTo(px2, py2); else if (i) g.lineTo(px2, py2); else g.moveTo(px2, py2); }
        g.strokeStyle = c; g.lineWidth = 1.5; g.globalAlpha = clamp(S.p * 2); g.stroke(); g.globalAlpha = 1;
      }
      if (S.p > 0.6) { const x = bx + 0.62 * bw; line(g, x, sy - 4 * u, x, sy + sh + 4 * u, '#ffffff', 1.5, 0.8); text(g, 'Entfaltung · 2 Frequenzen', x + 6 * u, sy + 8 * u, { f: F.avenir, size: 10 * u, c: '#ffffff' }); }
    }
    // Tiefenbild (sechseckiges Sichtfeld)
    const cx = wide ? W * 0.74 : W * 0.5, cy = wide ? H * 0.52 : H * 0.8, r = wide ? Math.min(W * 0.2, H * 0.32) : Math.min(W * 0.3, H * 0.15);
    g.save(); g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9); } g.closePath(); g.clip();
    const res = 26, cs = (2 * r) / res, rv = clamp(S.p * 1.3);
    for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) {
      const nx = i / res, ny = j / res;
      let d = 0.3 + 0.5 * ny; if (Math.hypot(nx - 0.45, ny - 0.55) < 0.18) d = 0.15;
      const noise = (Math.sin(i * 12.9 + j * 78.2 + Math.floor(S.t * 15)) * 43758.5) % 1;
      const v = lerp(Math.abs(noise), d, rv);
      g.fillStyle = turbo(1 - v); g.fillRect(cx - r + i * cs, cy - r + j * cs, cs + 0.5, cs + 0.5);
    }
    g.restore();
    text(g, S.ready ? 'Tiefe bereit' : 'Phasen werden ausgewertet …', cx, cy + r + 22 * u, { f: F.avenir, size: 11 * u, c: 'rgba(230,246,242,.75)', al: 'center' });
  },
};

/* ======================================================================================
   Steuerung
   ====================================================================================== */
export class BootFX {
  constructor(parent) {
    this.cv = document.createElement('canvas');
    this.cv.className = 'bootfx';
    parent.appendChild(this.cv);
    this.g = this.cv.getContext('2d');
    this.run = null;
  }

  stop() { this.run = null; this.cv.classList.remove('on'); }
  get active() { return !!this.run; }

  // je Bild. d: Gerät, B: Marke, vis: darf gezeichnet werden, w/h: Größe in CSS-Pixeln
  frame(dt, d, B, vis, w, h, world) {
    const U = d && d.unit;
    const live = !!U && (d.state === 'stream' || d.state === 'tls');
    const booting = live && (U.phase === 'boot' || U.phase === 'anlauf');
    if (this.run && (this.run.d !== d || this.run.B !== B)) this.stop();
    if (!this.run && booting) {
      const scene = SC[B.key] || SC.echo;
      const resume = U.phase === 'anlauf';
      this.run = { d, B, scene, t: 0, resume, minT: resume ? 1.6 : B.key === 'ios' ? 2.4 : 3.2, outT: null, st: null, seed: hash(U.serial) };
    }
    const R = this.run;
    if (!R) return false;
    R.t += Math.min(dt, 0.1);
    // Ende: misst und Mindestzeit vorbei → ausblenden; ausgeschaltet → schnell weg
    if (R.outT == null) {
      if (!live || U.phase === 'aus' || U.phase === 'bereit') { R.outT = R.t; R.outDur = 0.25; }
      else if (U.ready && R.t >= R.minT) { R.outT = R.t; R.outDur = 0.8; }
    }
    const out = R.outT == null ? 0 : clamp((R.t - R.outT) / R.outDur);
    if (out >= 1) { this.stop(); return false; }
    if (!vis || w < 60 || h < 60) { this.cv.classList.remove('on'); return true; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(w * dpr), chh = Math.round(h * dpr);
    if (this.cv.width !== cw || this.cv.height !== chh) { this.cv.width = cw; this.cv.height = chh; R.st = null; }
    const tb = U.tBoot, ts = U.tSpin, wb = R.resume ? 0 : tb / Math.max(1e-6, tb + ts);
    const ph = U.phase;
    const S = R.S || (R.S = {});
    Object.assign(S, {
      t: R.t, dt: Math.min(dt, 0.1), W: w, H: h, dpr, u: clamp(Math.min(w / 720, h / 520), 0.62, 1.7), seed: R.seed, wb,
      ph, ready: U.ready, out, resume: R.resume, outdoor: !!world && world.lighting === 'outdoor',
      pb: R.resume || ph !== 'boot' ? 1 : U.progress, ps: ph === 'boot' ? 0 : ph === 'anlauf' ? U.progress : 1,
      p: ph === 'boot' ? U.progress * wb : ph === 'anlauf' ? wb + U.progress * (1 - wb) : 1,
      rpmFrac: U.rpmFrac, rpm: U.rpmFrac * (d.pattern.hz || d.set.hz || 10) * 60,
    });
    if (!S.dev || S.dev.serial !== U.serial) {
      const sp = d.spec;
      S.dev = { model: sp.model, maker: sp.maker, id: sp.id, serial: U.serial, ch: U.channels, hz: d.pattern.hz || d.set.hz || 10, link: U.link, wl: sp.wavelength, cls: sp.cls, type: sp.pattern.type, P: sp.pattern, returns: d.set.returns };
    }
    const g = this.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!R.st) { R.st = R.scene.init ? R.scene.init(S) : {}; }
    try { R.scene.draw(g, S, R.st); } catch (e) { console.error(e); this.stop(); return false; }
    // Ausblenden: leicht vergrößern und durchsichtig werden
    this.cv.style.opacity = out > 0 ? String(1 - eio(out)) : '1';
    this.cv.style.transform = out > 0 ? `scale(${1 + 0.04 * eio(out)})` : '';
    this.cv.classList.add('on');
    return true;
  }
}

export const BOOT_SCENES = Object.keys(SC);
