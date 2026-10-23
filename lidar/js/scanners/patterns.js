// Abtastmuster der Scanner als zustandslose Funktionen der Zeit.
// Sensorsystem: +Z vorn, +Y oben, −X rechts. Azimut α im Uhrzeigersinn (von oben) ab vorn,
// Elevation ω ab Horizont:  d = (−sin α · cos ω,  sin ω,  cos α · cos ω)
//
// Jedes Muster liefert über shots(t0, t1, cb) alle Schüsse im Zeitfenster [t0, t1):
//   cb(t, dx, dy, dz, ring, col)
// Weil nur die Zeit zählt, kann jeder Worker jedes Zeitfenster rechnen (Lastverteilung).

const D = Math.PI / 180;
const PHI = 0.6180339887498949;

export function dirOf(azDeg, elDeg, out) {
  const a = azDeg * D, e = elDeg * D, ce = Math.cos(e);
  out[0] = -Math.sin(a) * ce; out[1] = Math.sin(e); out[2] = Math.cos(a) * ce;
  return out;
}

// Rotationsmatrix um eine Sensorachse (für Handgeräte mit Drehkopf)
function rotAxis(axis, ang, m) {
  const c = Math.cos(ang), s = Math.sin(ang);
  if (axis === 'z') { m[0] = c; m[1] = -s; m[2] = 0; m[3] = s; m[4] = c; m[5] = 0; m[6] = 0; m[7] = 0; m[8] = 1; }
  else if (axis === 'x') { m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = c; m[5] = -s; m[6] = 0; m[7] = s; m[8] = c; }
  else { m[0] = c; m[1] = 0; m[2] = s; m[3] = 0; m[4] = 1; m[5] = 0; m[6] = -s; m[7] = 0; m[8] = c; }
  return m;
}

// Gleichmäßig oder zur Mitte verdichtet verteilte Elevationen
export function elevations(n, lo, hi, opts = {}) {
  const out = [];
  if (!opts.center) { for (let i = 0; i < n; i++) out.push(lo + (hi - lo) * (n === 1 ? 0.5 : i / (n - 1))); return out; }
  // verdichtet um opts.center, kleinste Teilung opts.min
  const c = opts.center, nl = Math.round(n * (c - lo) / (hi - lo)), nu = n - nl;
  const seg = (count, span) => { const a = Math.min(1, (opts.min * count) / Math.abs(span)); const r = []; for (let i = 1; i <= count; i++) { const u = i / count; r.push(span * (a * u + (1 - a) * u * u * u)); } return r; };
  const low = seg(nl, lo - c).reverse(), up = seg(nu - 1, hi - c);
  for (const v of low) out.push(c + v);
  out.push(c);
  for (const v of up) out.push(c + v);
  return out.slice(0, n);
}

/* ---------------- rotierende Mehrstrahl-LiDAR ---------------- */

class Spin {
  constructor(p, set) {
    this.p = p;
    this.elev = p.elev;
    this.n = p.elev.length;
    this.azOff = p.azOff || null;
    this.hz = set.hz || p.hz || 10;
    this.dir = new Float64Array(3);
    this.rot = new Float64Array(9);
    this.fovLo = set.fov ? set.fov[0] : -180;
    this.fovHi = set.fov ? set.fov[1] : 180;
    if (p.firing === 'sim') {
      this.cols = set.cols || p.cols?.[1] || p.cols?.[0] || 1024;
      this.tcol = 1 / (this.hz * this.cols);
    } else {
      this.tc = p.cycleUs * 1e-6;
      this.fire = (p.fireUs || 0) * 1e-6;
      this.group = p.group || 1;
      this.cols = Math.round(1 / (this.hz * this.tc));
    }
    this.rows = this.n;
    this.rate = this.n * this.cols * this.hz;
    this.period = 1 / this.hz;
    this.rotor = p.rotor || null; // Drehkopf (Handgeräte)
  }
  inFov(az) {
    if (this.fovLo <= -180 && this.fovHi >= 180) return true;
    let a = az; while (a > 180) a -= 360; while (a <= -180) a += 360;
    return a >= this.fovLo && a <= this.fovHi;
  }
  emitDir(t, az, ring, col, cb) {
    const d = dirOf(az, this.elev[ring], this.dir);
    if (this.rotor) {
      const m = rotAxis(this.rotor.axis, 2 * Math.PI * this.rotor.hz * t, this.rot);
      const x = d[0], y = d[1], z = d[2];
      d[0] = m[0] * x + m[1] * y + m[2] * z; d[1] = m[3] * x + m[4] * y + m[5] * z; d[2] = m[6] * x + m[7] * y + m[8] * z;
    }
    cb(t, d[0], d[1], d[2], ring, col);
  }
  shots(t0, t1, cb) {
    let n = 0;
    const az0 = 360 * this.hz;
    if (this.p.firing === 'sim') {
      const k0 = Math.ceil(t0 / this.tcol), k1 = Math.ceil(t1 / this.tcol);
      for (let k = k0; k < k1; k++) {
        const t = k * this.tcol;
        const col = k % this.cols;
        const azc = (col / this.cols) * 360;
        if (!this.inFov(azc)) continue;
        for (let r = 0; r < this.n; r++) {
          this.emitDir(t, azc + (this.azOff ? this.azOff[r] : 0), r, col, cb);
          n++;
        }
      }
      return n;
    }
    const k0 = Math.ceil(t0 / this.tc), k1 = Math.ceil(t1 / this.tc);
    const G = this.group, ng = Math.ceil(this.n / G);
    for (let k = k0; k < k1; k++) {
      const tk = k * this.tc;
      const col = k % this.cols;
      if (!this.inFov(((tk * az0) % 360))) continue;
      for (let g = 0; g < ng; g++) {
        const t = tk + g * this.fire;
        const az = (t * az0) % 360;
        for (let q = 0; q < G; q++) {
          const r = g * G + q;
          if (r >= this.n) break;
          this.emitDir(t, az + (this.azOff ? this.azOff[r] : 0), r, col, cb);
          n++;
        }
      }
    }
    return n;
  }
}

/* ---------------- 2D-Laserscanner ---------------- */

class Line {
  constructor(p, set) {
    this.p = p;
    this.hz = set.hz || p.hz;
    this.step = p.step || (360 * this.hz) / p.sampleRate;
    this.perRev = Math.round(360 / this.step);
    this.ts = 1 / (this.perRev * this.hz);
    this.lo = -p.fov / 2; this.hi = p.fov / 2;
    this.rows = 1;
    this.cols = Math.round(p.fov / this.step);
    this.rate = this.cols * this.hz;
    this.period = 1 / this.hz;
    this.dir = new Float64Array(3);
    this.tilt = p.tilt || 0;
  }
  shots(t0, t1, cb) {
    let n = 0;
    const k0 = Math.ceil(t0 / this.ts), k1 = Math.ceil(t1 / this.ts);
    for (let k = k0; k < k1; k++) {
      const j = k % this.perRev;
      const az = -180 + j * this.step;
      if (az < this.lo || az > this.hi) continue;
      const d = dirOf(az, this.tilt, this.dir);
      cb(k * this.ts, d[0], d[1], d[2], 0, Math.round((az - this.lo) / this.step));
      n++;
    }
    return n;
  }
}

/* ---------------- Risley-Prismen (Livox): nicht wiederholende Rosette ---------------- */

class Rosette {
  constructor(p, set) {
    this.p = p;
    this.rate = p.rate;                // Schüsse je Sekunde (alle Laser zusammen)
    this.lasers = p.lasers || 1;
    this.ts = this.lasers / this.rate; // Zeit zwischen zwei Schüssen eines Lasers
    this.ax = (p.fovH || p.fov) / 4;   // halber Prismenwinkel (zwei Prismen → Radius = fov/2)
    this.ay = (p.fovV || p.fov) / 4;
    this.w1 = p.w1 || 2 * Math.PI * 121.3;
    this.w2 = p.w2 || -2 * Math.PI * 77.7;
    this.rows = 0; this.cols = 0;
    this.period = p.frame || 0.1;
    this.dir = new Float64Array(3);
    this.spread = p.spread || 0;
  }
  shots(t0, t1, cb) {
    let n = 0;
    const k0 = Math.ceil(t0 / this.ts), k1 = Math.ceil(t1 / this.ts);
    for (let k = k0; k < k1; k++) {
      const t = k * this.ts;
      for (let l = 0; l < this.lasers; l++) {
        const tl = t + l * this.ts / this.lasers;
        const ph = l * 2 * Math.PI / this.lasers;
        const x = this.ax * (Math.cos(this.w1 * tl + ph) + Math.cos(this.w2 * tl - ph * 0.7)) + (l - (this.lasers - 1) / 2) * this.spread;
        const y = this.ay * (Math.sin(this.w1 * tl + ph) + Math.sin(this.w2 * tl - ph * 0.7));
        const d = dirOf(x, y, this.dir);
        cb(tl, d[0], d[1], d[2], l, 0);
        n++;
      }
    }
    return n;
  }
}

/* ---------------- Kuppel (Mid-360, Unitree L1, BLK2GO): Rotation + nicht wiederholende Elevation ---------------- */

class Dome {
  constructor(p, set) {
    this.p = p;
    this.rate = p.rate;
    this.lasers = p.lasers || 1;
    this.ts = this.lasers / this.rate;
    this.hz = p.hz || 10;
    this.lo = p.elevMin; this.hi = p.elevMax;
    this.fv = this.hz * (p.vRatio || 3.0 + PHI);
    this.rows = 0; this.cols = 0;
    this.period = p.frame || 0.1;
    this.dir = new Float64Array(3);
    this.rot = new Float64Array(9);
    this.rotor = p.rotor || null;
  }
  shots(t0, t1, cb) {
    let n = 0;
    const k0 = Math.ceil(t0 / this.ts), k1 = Math.ceil(t1 / this.ts);
    const span = this.hi - this.lo;
    for (let k = k0; k < k1; k++) {
      const t = k * this.ts;
      for (let l = 0; l < this.lasers; l++) {
        const tl = t + l * this.ts / this.lasers;
        const az = (360 * this.hz * tl + l * 360 / this.lasers) % 360;
        // Dreieckswelle mit irrationalem Frequenzverhältnis → füllt die Kuppel lückenlos
        let u = (this.fv * tl + l * PHI) % 1;
        u = u < 0.5 ? u * 2 : 2 - u * 2;
        // flächentreu: mehr Schüsse nahe dem Horizont (dort ist der Umfang größer)
        const el = this.lo + span * u;
        const d = dirOf(az, el, this.dir);
        if (this.rotor) {
          const m = rotAxis(this.rotor.axis, 2 * Math.PI * this.rotor.hz * tl, this.rot);
          const x = d[0], y = d[1], z = d[2];
          d[0] = m[0] * x + m[1] * y + m[2] * z; d[1] = m[3] * x + m[4] * y + m[5] * z; d[2] = m[6] * x + m[7] * y + m[8] * z;
        }
        cb(tl, d[0], d[1], d[2], l, 0);
        n++;
      }
    }
    return n;
  }
}

/* ---------------- Raster (Festkörper/Hybrid: Hesai AT128, Luminar Iris, Livox HAP) ---------------- */

class Raster {
  constructor(p, set) {
    this.p = p;
    this.hz = p.hz || 10;
    this.elev = p.elev;
    this.rows = p.elev.length;
    this.cols = p.cols;
    this.lo = -p.fovH / 2; this.step = p.fovH / (p.cols - 1);
    this.tcol = 1 / (this.hz * this.cols);
    this.rate = this.rows * this.cols * this.hz;
    this.period = 1 / this.hz;
    this.dir = new Float64Array(3);
  }
  shots(t0, t1, cb) {
    let n = 0;
    const k0 = Math.ceil(t0 / this.tcol), k1 = Math.ceil(t1 / this.tcol);
    for (let k = k0; k < k1; k++) {
      const col = k % this.cols;
      const az = this.lo + col * this.step;
      const t = k * this.tcol;
      for (let r = 0; r < this.rows; r++) {
        const d = dirOf(az, this.elev[r], this.dir);
        cb(t, d[0], d[1], d[2], r, col);
        n++;
      }
    }
    return n;
  }
}

/* ---------------- Flash / Tiefenkamera (Raster ohne Mechanik, ganze Bilder) ---------------- */

class Flash {
  constructor(p, set) {
    this.p = p;
    this.fps = set.fps || p.fps || 30;
    const mode = set.depthMode ? p.modes?.[set.depthMode] : null;
    this.w = mode?.w || p.w; this.h = mode?.h || p.h;
    this.fovH = mode?.fovH || p.fovH; this.fovV = mode?.fovV || p.fovV;
    this.rows = this.h; this.cols = this.w;
    this.rate = this.w * this.h * this.fps;
    this.period = 1 / this.fps;
    this.dir = new Float64Array(3);
    this.tx = Math.tan(this.fovH * D / 2); this.ty = Math.tan(this.fovV * D / 2);
  }
  // Bild k: alle Pixel zum gleichen Zeitpunkt (Lochkamera-Projektion)
  pixelDir(i, j, out) {
    const x = ((i + 0.5) / this.w * 2 - 1) * this.tx, y = (1 - (j + 0.5) / this.h * 2) * this.ty;
    const l = 1 / Math.sqrt(x * x + y * y + 1);
    out[0] = -x * l; out[1] = y * l; out[2] = l;
    return out;
  }
  frames(t0, t1) { const k0 = Math.ceil(t0 * this.fps), k1 = Math.ceil(t1 * this.fps); const r = []; for (let k = k0; k < k1; k++) r.push(k / this.fps); return r; }
  shots(t0, t1, cb) {
    let n = 0;
    for (const t of this.frames(t0, t1)) for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const d = this.pixelDir(i, j, this.dir);
      cb(t, d[0], d[1], d[2], j, i);
      n++;
    }
    return n;
  }
}

/* ---------------- Smartphone-dToF: 576 Laserpunkte (8×8 VCSEL × 3×3 DOE) ---------------- */

class PhoneDots {
  constructor(p, set) {
    this.p = p;
    this.fps = p.fps || 15;
    this.fovH = p.fovH; this.fovV = p.fovV;
    this.rows = 24; this.cols = 24;
    this.rate = 576 * this.fps;
    this.period = 1 / this.fps;
    this.dirs = [];
    // 3×3 Kacheln (DOE) aus je 8×8 Punkten, Kacheln leicht verzerrt (kissenförmig) wie beim echten Projektor
    const tx = Math.tan(this.fovH * D / 2), ty = Math.tan(this.fovV * D / 2);
    for (let ty0 = 0; ty0 < 3; ty0++) for (let tx0 = 0; tx0 < 3; tx0++) for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const gx = (tx0 * 8 + i + 0.5) / 24 * 2 - 1, gy = (ty0 * 8 + j + 0.5) / 24 * 2 - 1;
      const k = 0.06 * (gx * gx + gy * gy);
      const x = gx * (1 + k) * tx * 0.94, y = gy * (1 + k) * ty * 0.94;
      const l = 1 / Math.sqrt(x * x + y * y + 1);
      this.dirs.push([-x * l, -y * l, l, ty0 * 8 + j, tx0 * 8 + i]);
    }
  }
  shots(t0, t1, cb) {
    let n = 0;
    const k0 = Math.ceil(t0 * this.fps), k1 = Math.ceil(t1 * this.fps);
    for (let k = k0; k < k1; k++) {
      const t = k / this.fps;
      for (const d of this.dirs) { cb(t, d[0], d[1], d[2], d[3], d[4]); n++; }
    }
    return n;
  }
}

/* ---------------- Terrestrischer Laserscanner (Stationsscan) ---------------- */

// Spiegel dreht schnell um die horizontale Achse, Kopf schwenkt langsam um 180°.
// Spalte c: Kopfazimut φ = c·Δ, Zeile j: Spiegelwinkel ψ = ψ0 + j·Δ über Vorder- und Rückseite.
export class TlsScan {
  constructor(p, set) {
    this.p = p;
    const res = set.resolution ?? p.resolutions[p.resDefault ?? 1]; // mm @ 10 m
    this.res = res;
    this.delta = (res / 1000) / 10;                  // rad
    this.dec = Math.max(1, set.decimate || 1);        // Simulationsdichte
    this.step = this.delta * this.dec;
    this.eMin = (p.vFov ? p.vFov[0] : -60) * D;       // untere Grenze (Sockel)
    this.perRevNominal = Math.round(2 * Math.PI / this.delta);
    this.colsNominal = Math.round(Math.PI / this.delta);
    this.cols = Math.round(Math.PI / this.step);
    this.rowsPerSide = Math.round((Math.PI / 2 - this.eMin) / this.step);
    this.mirrorHz = p.rate / this.perRevNominal; // der Laser misst durchgehend, auch Richtung Sockel
    this.quality = set.quality || 1;
    this.duration = (this.colsNominal / this.mirrorHz) * this.quality;
    this.nominalPoints = this.colsNominal * Math.round((Math.PI / 2 - this.eMin) * 2 / this.delta);
    this.points = this.cols * this.rowsPerSide * 2;
    this.dir = new Float64Array(3);
    this.hFov = set.hFov || null; // [von, bis] Grad (Ausschnitt)
    this.vWin = set.vWin || null;
  }
  // Spalten c0…c1 (nach Simulationsdichte), cb(t, dx, dy, dz, row, col)
  columns(c0, c1, cb) {
    let n = 0;
    const T = this.duration;
    for (let c = c0; c < c1 && c < this.cols; c++) {
      const phi = c * this.step;
      const tc = (c / this.cols) * T;
      for (let side = 0; side < 2; side++) {
        let az = phi / D + (side ? 180 : 0);
        if (this.hFov) { let a = az % 360; if (a > 180) a -= 360; if (a < this.hFov[0] || a > this.hFov[1]) continue; }
        for (let j = 0; j < this.rowsPerSide; j++) {
          const el = this.eMin + j * this.step;
          const elD = el / D;
          if (this.vWin && (elD < this.vWin[0] || elD > this.vWin[1])) continue;
          const d = dirOf(az, elD, this.dir);
          cb(tc + ((side * this.rowsPerSide + j) / (this.rowsPerSide * 2)) * (T / this.cols), d[0], d[1], d[2], side * this.rowsPerSide + j, c);
          n++;
        }
      }
    }
    return n;
  }
}

export function makePattern(spec, set = {}) {
  const p = spec.pattern;
  switch (p.type) {
    case 'spin': return new Spin(p, set);
    case 'line': return new Line(p, set);
    case 'rosette': return new Rosette(p, set);
    case 'dome': return new Dome(p, set);
    case 'raster': return new Raster(p, set);
    case 'flash': return new Flash(p, set);
    case 'phone': return new PhoneDots(p, set);
    case 'tls': return new TlsScan(p, set);
    default: throw new Error('Unbekanntes Abtastmuster: ' + p.type);
  }
}

// Musterschau für das Datenblatt: Richtungen über eine Zeitspanne als (Azimut, Elevation)
export function previewPattern(spec, seconds = 0.1, max = 60000, set = {}) {
  const pat = makePattern(spec, set);
  const out = [];
  const cb = (t, x, y, z, ring) => {
    if (out.length >= max * 3) return;
    const az = Math.atan2(-x, z) / D, el = Math.asin(Math.max(-1, Math.min(1, y))) / D;
    out.push(az, el, ring);
  };
  if (pat instanceof TlsScan) {
    const step = Math.max(1, Math.floor(pat.cols / 240));
    for (let c = 0; c < pat.cols; c += step) pat.columns(c, c + 1, cb);
  } else pat.shots(0, seconds, cb);
  return out;
}
