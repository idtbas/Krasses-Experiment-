// Physikalisches Strahlmodell eines LiDAR-Schusses (läuft im Worker, ohne Abhängigkeiten).
//
// Ein Schuss besteht aus mehreren Teilstrahlen innerhalb der Strahldivergenz (Gauß-Profil).
// Jeder Teilstrahl wird verfolgt: diffuse Flächen (Lambert + Glanzkeule), Glas (schwacher Reflex,
// Durchgang), Spiegel (Umlenkung → Geisterpunkte hinter dem Spiegel), Retroreflektoren (Sättigung,
// Blooming) und Absorber (Wasser, schwarzer Lack). Die Echos aller Teilstrahlen werden nach Entfernung
// sortiert und innerhalb der Pulsauflösung zusammengefasst (→ Mischpixel an Kanten), danach gegen eine
// Erkennungsschwelle geprüft, die aus der Reichweite bei 10 % Reflektivität folgt (LiDAR-Gleichung,
// Reichweite ∝ √ρ). Rauschen, Range-Walk, Sonnenlicht, Nebel, Regen und Quantisierung kommen dazu.

export const MAT_STRIDE = 16;
export const KIND = { DIFFUSE: 0, GLASS: 1, MIRROR: 2, RETRO: 3, ABSORB: 4 };

// Materialtabelle (Float32Array, MAT_STRIDE Werte je Material)
//  0 Art   1 ρ@905   2 ρ@1550   3 Glanz   4 Glanzbreite (rad)   5 Transmission/Spiegelgrad
//  6 Retro-Verstärkung   7 Variation   8 Variationsmaßstab (m)   9–11 Farbe linear   12 Klasse (LAS)
//  13 Rauheit (m)   14 frei   15 frei
export function packMaterials(list) {
  const out = new Float32Array(Math.max(1, list.length) * MAT_STRIDE);
  list.forEach((m, i) => {
    const o = i * MAT_STRIDE;
    out[o] = KIND[(m.kind || 'diffuse').toUpperCase()] ?? 0;
    out[o + 1] = m.r ?? 0.5;
    out[o + 2] = m.r1550 ?? m.r ?? 0.5;
    out[o + 3] = m.spec ?? 0;
    out[o + 4] = m.specWidth ?? 0.08;
    out[o + 5] = m.trans ?? (m.kind === 'mirror' ? 0.9 : 0.9);
    out[o + 6] = m.retro ?? 0;
    out[o + 7] = m.var ?? 0;
    out[o + 8] = m.varScale ?? 0.2;
    const c = m.color || [0.6, 0.6, 0.6];
    out[o + 9] = c[0]; out[o + 10] = c[1]; out[o + 11] = c[2];
    out[o + 12] = m.cls ?? 1;
    out[o + 13] = m.rough ?? 0;
  });
  return out;
}

/* ---------------- Zufall ---------------- */

export class Rng {
  constructor(seed = 1) { this.seed(seed); }
  seed(s) { this.a = s >>> 0 || 1; this.b = 0x9e3779b9; this.c = 0x85ebca6b; this.d = 0xc2b2ae35 ^ s; this.spare = NaN; for (let i = 0; i < 12; i++) this.next(); }
  next() { // sfc32
    let a = this.a, b = this.b, c = this.c, d = this.d;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return (t >>> 0) / 4294967296;
  }
  gauss() {
    if (this.spare === this.spare) { const s = this.spare; this.spare = NaN; return s; }
    let u = this.next(); if (u < 1e-12) u = 1e-12;
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(6.283185307179586 * v);
    return r * Math.cos(6.283185307179586 * v);
  }
}

// Gitterrauschen (Wertrauschen) für Reflektivitätsschwankungen von Oberflächen
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi), c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi);
  const e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1), g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * sx, x2 = c + (d - c) * sx, x3 = e + (f - e) * sx, x4 = g + (h - g) * sx;
  const y1 = x1 + (x2 - x1) * sy, y2 = x3 + (x4 - x3) * sy;
  return y1 + (y2 - y1) * sz; // 0…1
}

/* ---------------- Teilstrahl-Muster ---------------- */

// Versatz (in Einheiten der halben Divergenz) und Gewicht der Teilstrahlen
function subrayPattern(n) {
  if (n <= 1) return [[0, 0, 1]];
  if (n <= 3) return [[0, 0, 0.5], [-0.62, 0, 0.25], [0.62, 0, 0.25]];
  if (n <= 5) return [[0, 0, 0.36], [-0.65, 0, 0.16], [0.65, 0, 0.16], [0, -0.65, 0.16], [0, 0.65, 0.16]];
  // 3×3 + Rand: dichteres Gauß-Profil (präzise, für TLS und Kantenuntersuchungen)
  const out = [[0, 0, 0.2]];
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; out.push([Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.075]); }
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; out.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.05]); }
  return out;
}

const MAX_ECHO = 48;

/*
 * BeamSim: rechnet Schüsse eines Sensors. Ergebnis landet in einem Ausgabepuffer (PointSink).
 * spec: Kennwerte aus dem Katalog, opt: Betriebsart (Echos, Teilstrahlen), env: Umgebung.
 */
export class BeamSim {
  constructor(scene, mats, spec, opt = {}) {
    this.scene = scene;
    this.mats = mats;
    this.setSpec(spec, opt);
    this.env = { sun: 0, fogVis: 0, rain: 0, dust: 0, sunDir: [0.3, 0.8, 0.5] };
    this.rng = new Rng(1);
    // Echo-Puffer
    this.eR = new Float64Array(MAX_ECHO); this.eE = new Float64Array(MAX_ECHO);
    this.eM = new Int32Array(MAX_ECHO); this.eO = new Int32Array(MAX_ECHO);
    this.eC = new Float64Array(MAX_ECHO); this.eF = new Int32Array(MAX_ECHO);
    this.eNx = new Float64Array(MAX_ECHO); this.eNy = new Float64Array(MAX_ECHO); this.eNz = new Float64Array(MAX_ECHO);
    this.eRough = new Float64Array(MAX_ECHO);
    this.ne = 0;
    // zusammengefasste Echos
    this.cR = new Float64Array(MAX_ECHO); this.cE = new Float64Array(MAX_ECHO); this.cM = new Int32Array(MAX_ECHO);
    this.cO = new Int32Array(MAX_ECHO); this.cC = new Float64Array(MAX_ECHO); this.cF = new Int32Array(MAX_ECHO);
    this.cQ = new Float64Array(MAX_ECHO); this.cRough = new Float64Array(MAX_ECHO);
    this.cNx = new Float64Array(MAX_ECHO); this.cNy = new Float64Array(MAX_ECHO); this.cNz = new Float64Array(MAX_ECHO);
    this.nc = 0;
    this.sel = new Int32Array(16);
    this.cA = new Float64Array(MAX_ECHO);
    this.R = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); // Sensor → Welt (zeilenweise), vom Worker je Schuss gesetzt
  }

  setSpec(spec, opt = {}) {
    this.spec = spec;
    const p = spec.phys;
    this.r10 = p.r10;
    this.rMax = p.rangeMax;
    this.rMin = p.rangeMin;
    this.sigma0 = p.sigma / Math.sqrt(Math.max(1, opt.quality || 1)); // Mehrfachmessung (TLS „Qualität“) mittelt das Rauschen
    this.sigmaR = p.sigmaR || 0;       // zusätzlicher Anteil proportional zur Entfernung
    this.sigmaR2 = p.sigmaR2 || 0;     // quadratischer Anteil (Triangulation, iToF)
    this.sep = p.echoSep ?? 0.6;
    this.quant = p.rangeRes ?? 0.002;
    this.walk = p.walk ?? this.sigma0 * 0.8;
    this.satBias = p.satBias ?? this.sigma0 * 1.5;
    this.lambda = spec.wavelength || 905;
    this.l1550 = this.lambda >= 1400;
    this.sunSens = p.sunSens ?? (this.lambda >= 1400 ? 0.25 : this.lambda >= 930 ? 0.55 : 1.0);
    this.falseRate = p.falseRate ?? 0.0012;
    this.ah = (p.divH ?? 3) * 0.0005; // halbe Divergenz in rad (mrad → rad / 2)
    this.av = (p.divV ?? p.divH ?? 3) * 0.0005;
    this.mode = opt.returns || spec.returns?.[0] || 'strongest';
    this.maxRet = this.mode === 'multi' ? (p.maxReturns || 8) : this.mode === 'triple' ? 3 : this.mode === 'dual' ? 2 : 1;
    this.subs = subrayPattern(opt.subrays ?? p.subrays ?? 5);
    this.angNoise = (p.angNoise ?? 0.01) * Math.PI / 180;
    this.satQ = p.satQ ?? 3000;
    this.bloom = p.bloom ?? 1;
    this.intensityMode = spec.intensity || 'calib';
    this.colorOn = !!opt.color;
    this.shadowOn = !!opt.shadow;
    this.selfMin = p.rangeMin;
    this.biasConst = p.biasConst || 0; // systematischer Offset des Einzelgeräts (z. B. SICK ±60 mm)
  }

  setEnv(env) {
    Object.assign(this.env, env);
    const e = this.env;
    // Extinktion: Sichtweite V → α = 3,912 / V (Koschmieder), Regen nach Rate (mm/h)
    this.alpha = (e.fogVis > 0 ? 3.912 / e.fogVis : 0) + (e.rain > 0 ? 0.0006 * Math.pow(e.rain, 0.6) : 0) + (e.dust || 0) * 0.02;
    this.sunK = 1 / Math.sqrt(1 + 0.8 * (e.sun || 0) * this.sunSens);
  }

  /* -------- Verfolgung eines Teilstrahls -------- */

  addEcho(r, e, mat, obj, cos, nx, ny, nz, flag, rough) {
    if (this.ne >= MAX_ECHO || e <= 0) return;
    const k = this.ne++;
    this.eR[k] = r; this.eE[k] = e; this.eM[k] = mat; this.eO[k] = obj; this.eC[k] = cos; this.eF[k] = flag;
    this.eNx[k] = nx; this.eNy[k] = ny; this.eNz[k] = nz; this.eRough[k] = rough;
  }

  trace(ox, oy, oz, dx, dy, dz, w) {
    const sc = this.scene, M = this.mats, hit = sc.hit;
    let g = w, path = 0, flag = 0;
    for (let bounce = 0; bounce < 5; bounce++) {
      const left = this.rMax * 1.05 - path;
      if (left <= 0) return;
      if (!sc.cast(ox, oy, oz, dx, dy, dz, bounce === 0 ? 0.0 : 1e-4, left)) return;
      const t = hit.t;
      path += t;
      const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
      const mo = hit.mat * MAT_STRIDE;
      const kind = M[mo];
      let cos = -(hit.nx * dx + hit.ny * dy + hit.nz * dz);
      if (cos < 0) cos = -cos;
      let rho = this.l1550 ? M[mo + 2] : M[mo + 1];
      const vr = M[mo + 7];
      if (vr > 0) {
        const s = 1 / M[mo + 8];
        rho *= 1 + vr * (vnoise(px * s, py * s, pz * s) * 2 - 1);
      }
      // Glanzkeule um die Rückstreurichtung (nur bei fast senkrechtem Auftreffen)
      const spec = M[mo + 3];
      let lobe = 0;
      if (spec > 0) {
        const ang = Math.acos(Math.min(1, cos)) / M[mo + 4];
        lobe = ang < 4 ? spec * Math.exp(-ang * ang) : 0;
      }
      const rough = M[mo + 13];
      if (kind === 0) { // diffus
        this.addEcho(path, g * (rho * cos + lobe), hit.mat, hit.obj, cos, hit.nx, hit.ny, hit.nz, flag, rough);
        return;
      }
      if (kind === 3) { // Retroreflektor: Rückstrahlung fast unabhängig vom Winkel
        this.addEcho(path, g * (M[mo + 6] * Math.sqrt(cos) + rho * cos), hit.mat, hit.obj, cos, hit.nx, hit.ny, hit.nz, flag | 2, rough);
        return;
      }
      if (kind === 1) { // Glas: Fresnel-Reflex + Durchgang
        const e = rho * cos + lobe;
        if (e > 0) this.addEcho(path, g * e, hit.mat, hit.obj, cos, hit.nx, hit.ny, hit.nz, flag, 0);
        const T = M[mo + 5];
        g *= T * T;
        flag |= 4;
        ox = px + dx * 2e-4; oy = py + dy * 2e-4; oz = pz + dz * 2e-4;
        continue;
      }
      if (kind === 2 || kind === 4) { // Spiegel / spiegelnder Absorber (Wasser, schwarzer Hochglanz)
        const e = rho * cos + lobe;
        if (e > 0) this.addEcho(path, g * e, hit.mat, hit.obj, cos, hit.nx, hit.ny, hit.nz, flag, 0);
        if (kind === 4) {
          // Fresnel: Wasser reflektiert bei flachem Winkel stärker
          const R = 0.02 + 0.98 * Math.pow(1 - cos, 5);
          g *= R * R;
          if (g < 1e-4) return;
        } else {
          const R = M[mo + 5];
          g *= R * R;
        }
        flag |= 8;
        const dn = dx * hit.nx + dy * hit.ny + dz * hit.nz;
        dx -= 2 * dn * hit.nx; dy -= 2 * dn * hit.ny; dz -= 2 * dn * hit.nz;
        ox = px + hit.nx * 2e-4; oy = py + hit.ny * 2e-4; oz = pz + hit.nz * 2e-4;
        continue;
      }
      return;
    }
  }

  /*
   * Einen Schuss rechnen. o, d: Weltursprung und Welt-Richtung (normiert).
   * ls: Richtung im Sensorsystem (für die Rohdaten). Ausgabe über sink.push(...).
   * Rückgabe: Anzahl ausgegebener Punkte.
   */
  shoot(t, ox, oy, oz, dx, dy, dz, lsx, lsy, lsz, ring, col, sink) {
    const rng = this.rng;
    this.ne = 0;
    // Basis senkrecht zur Strahlrichtung
    let ux, uy, uz;
    if (Math.abs(dy) < 0.9) { ux = dz; uy = 0; uz = -dx; } else { ux = 0; uy = -dz; uz = dy; }
    let ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= ul; uy /= ul; uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const subs = this.subs, ah = this.ah, av = this.av;
    for (let s = 0; s < subs.length; s++) {
      const S = subs[s];
      let sx = dx, sy = dy, sz = dz;
      if (S[0] !== 0 || S[1] !== 0) {
        const a = S[0] * ah, b = S[1] * av;
        sx += ux * a + vx * b; sy += uy * a + vy * b; sz += uz * a + vz * b;
        const l = 1 / Math.sqrt(sx * sx + sy * sy + sz * sz);
        sx *= l; sy *= l; sz *= l;
      }
      this.trace(ox, oy, oz, sx, sy, sz, S[2]);
    }
    // Umwelt: Regen- und Staubtropfen, Nebel-Rückstreuung, Sonnenrauschen
    const env = this.env;
    if (env.rain > 0) {
      let firstR = this.rMax;
      for (let k = 0; k < this.ne; k++) if (this.eR[k] < firstR) firstR = this.eR[k];
      const L = Math.min(firstR, 40);
      const p = 1 - Math.exp(-0.00008 * env.rain * L);
      if (rng.next() < p) this.addEcho(this.rMin + rng.next() * (L - this.rMin), 0.25 + rng.next() * 0.5, -1, 0, 1, 0, 0, 0, 16, 0);
    }
    if (env.fogVis > 0) {
      const a = this.alpha;
      const p = Math.min(0.6, (1 - Math.exp(-2 * a * 6)) * 0.45);
      if (rng.next() < p) {
        const r = Math.min(15, this.rMin + (-Math.log(1 - rng.next() * 0.999) / (2 * a)));
        this.addEcho(r, 0.02 + rng.next() * 0.05, -1, 0, 1, 0, 0, 0, 16, 0);
      }
    }
    if (env.dust > 0 && rng.next() < env.dust * 0.04) this.addEcho(this.rMin + rng.next() * 4, 0.05 + rng.next() * 0.2, -1, 0, 1, 0, 0, 0, 16, 0);
    if (env.sun > 0 && rng.next() < env.sun * this.sunSens * this.falseRate) {
      this.addEcho(this.rMin + rng.next() * this.r10 * 0.8, 0.002 + rng.next() * 0.01, -1, 0, 1, 0, 0, 0, 32, 0);
    }
    if (this.ne === 0) return 0;
    this.mergeEchoes();
    return this.emit(t, ox, oy, oz, dx, dy, dz, lsx, lsy, lsz, ring, col, sink);
  }

  mergeEchoes() {
    const n = this.ne, R = this.eR, E = this.eE;
    // Einfügesortierung nach Entfernung (wenige Echos)
    const idx = MERGE_IDX;
    for (let i = 0; i < n; i++) idx[i] = i;
    for (let i = 1; i < n; i++) {
      const v = idx[i], rv = R[v];
      let j = i - 1;
      while (j >= 0 && R[idx[j]] > rv) { idx[j + 1] = idx[j]; j--; }
      idx[j + 1] = v;
    }
    let nc = 0, cur = -1, lastR = -1e9;
    for (let q = 0; q < n; q++) {
      const k = idx[q];
      if (cur >= 0 && R[k] - lastR < this.sep) {
        // in dasselbe Echo: energiegewichtete Entfernung (Mischpixel)
        const e0 = this.cE[cur], e1 = E[k];
        this.cR[cur] = (this.cR[cur] * e0 + R[k] * e1) / (e0 + e1);
        if (e1 > this.cQ[cur]) { // stärkster Anteil bestimmt Material und Normale
          this.cQ[cur] = e1; this.cM[cur] = this.eM[k]; this.cO[cur] = this.eO[k]; this.cC[cur] = this.eC[k];
          this.cNx[cur] = this.eNx[k]; this.cNy[cur] = this.eNy[k]; this.cNz[cur] = this.eNz[k]; this.cRough[cur] = this.eRough[k];
        }
        this.cF[cur] |= this.eF[k];
        this.cE[cur] = e0 + e1;
        lastR = R[k];
      } else {
        cur = nc++;
        this.cR[cur] = R[k]; this.cE[cur] = E[k]; this.cQ[cur] = E[k]; this.cM[cur] = this.eM[k]; this.cO[cur] = this.eO[k];
        this.cC[cur] = this.eC[k]; this.cF[cur] = this.eF[k]; this.cRough[cur] = this.eRough[k];
        this.cNx[cur] = this.eNx[k]; this.cNy[cur] = this.eNy[k]; this.cNz[cur] = this.eNz[k];
        lastR = R[k];
      }
    }
    this.nc = nc;
  }

  emit(t, ox, oy, oz, dx, dy, dz, lsx, lsy, lsz, ring, col, sink) {
    const rng = this.rng, nc = this.nc;
    const r10sq = this.r10 * this.r10;
    // Erkennung: q = ρ_eff·R10² / (0,1·r²) – Verhältnis zur Schwelle; P = 1/(1+q^-3)
    const det = DET_IDX;
    let nd = 0;
    for (let c = 0; c < nc; c++) {
      const r = this.cR[c];
      if (r < this.rMin || r > this.rMax) continue;
      let rho = this.cE[c];
      if (this.alpha > 0) rho *= Math.exp(-2 * this.alpha * r);
      this.cA[c] = rho;
      const q = rho * r10sq * this.sunK * this.sunK / (0.1 * r * r);
      this.cQ[c] = q;
      if (q <= 0) continue;
      const P = q > 50 ? 1 : 1 / (1 + Math.pow(q, -3));
      if (P < 1 && rng.next() > P) continue;
      det[nd++] = c;
    }
    if (nd === 0) return 0;
    // Echo-Auswahl
    const sel = this.sel;
    let ns = 0;
    const mode = this.mode;
    let strongest = det[0], last = det[nd - 1], first = det[0];
    for (let i = 1; i < nd; i++) if (this.cQ[det[i]] > this.cQ[strongest]) strongest = det[i];
    if (mode === 'strongest') sel[ns++] = strongest;
    else if (mode === 'last') sel[ns++] = last;
    else if (mode === 'first') sel[ns++] = first;
    else if (mode === 'dual') {
      sel[ns++] = strongest;
      if (last !== strongest) sel[ns++] = last;
      else if (nd > 1) { // zweitstärkstes, wenn stärkstes = letztes (wie bei Velodyne)
        let s2 = -1;
        for (let i = 0; i < nd; i++) if (det[i] !== strongest && (s2 < 0 || this.cQ[det[i]] > this.cQ[s2])) s2 = det[i];
        if (s2 >= 0) sel[ns++] = s2;
      }
    } else if (mode === 'triple') {
      sel[ns++] = first;
      if (strongest !== first) sel[ns++] = strongest;
      if (last !== first && last !== strongest) sel[ns++] = last;
    } else { // multi: alle bis maxRet
      for (let i = 0; i < nd && ns < this.maxRet; i++) sel[ns++] = det[i];
    }
    // nach Entfernung ordnen (Echo-Nummer 1 = nächstes)
    for (let i = 1; i < ns; i++) { const v = sel[i]; let j = i - 1; while (j >= 0 && this.cR[sel[j]] > this.cR[v]) { sel[j + 1] = sel[j]; j--; } sel[j + 1] = v; }

    let out = 0;
    const M = this.mats;
    for (let i = 0; i < ns; i++) {
      const c = sel[i];
      const q = this.cQ[c];
      let r = this.cR[c];
      const cos = this.cC[c];
      // Rauschen: Grundrauschen, schwaches Signal, Entfernung, schräger Auftreffwinkel, Rauheit
      let sig = this.sigma0 * (1 + 0.6 / Math.sqrt(Math.max(q, 0.05))) + this.sigmaR * r + this.sigmaR2 * r * r;
      const tanT = cos > 0.05 ? Math.sqrt(1 - cos * cos) / cos : 20;
      const foot = r * this.ah * tanT * 0.35;
      sig = Math.sqrt(sig * sig + foot * foot + this.cRough[c] * this.cRough[c]);
      // Range-Walk: schwache Pulse wirken weiter, gesättigte näher
      let bias = this.biasConst;
      if (q > this.satQ) bias -= this.satBias;
      else bias += this.walk * Math.max(0, 1 - Math.log10(Math.max(q, 1)) / 2);
      r += bias + rng.gauss() * sig;
      if (this.quant > 0) r = Math.round(r / this.quant) * this.quant;
      if (r < this.rMin) continue;
      // Reflektivität (kalibriert, Velodyne-Skala: 0–100 diffus, 101–255 Retro)
      let rhoHat = this.cA[c] * (1 + rng.gauss() * 0.04);
      let inten;
      if (rhoHat <= 1) inten = Math.max(0, Math.min(100, Math.round(rhoHat * 100)));
      else inten = Math.min(255, 101 + Math.round(Math.log10(rhoHat) * 60));
      if (this.intensityMode === 'raw') inten = Math.min(255, Math.round(Math.sqrt(q) * 4));
      // Richtung im Sensorsystem mit Winkelgeber-Rauschen
      let lx = lsx, ly = lsy, lz = lsz;
      if (this.angNoise > 0) {
        const a = rng.gauss() * this.angNoise, b = rng.gauss() * this.angNoise;
        lx += a * lsz; lz -= a * lsx; ly += b;
        const l = 1 / Math.sqrt(lx * lx + ly * ly + lz * lz);
        lx *= l; ly *= l; lz *= l;
      }
      const mat = this.cM[c];
      let cr = 0, cg = 0, cb = 0, cls = 7; // 7 = Rauschen (LAS)
      if (mat >= 0) {
        const mo = mat * MAT_STRIDE;
        cls = M[mo + 12];
        if (this.colorOn) {
          // Kamera-Farbe: Albedo × Beleuchtung (Himmel + Sonne), optional mit Schattenstrahl
          const sd = this.env.sunDir;
          let lam = Math.max(0, this.cNx[c] * sd[0] + this.cNy[c] * sd[1] + this.cNz[c] * sd[2]);
          if (lam > 0 && this.shadowOn) {
            const tr = this.cR[c];
            const px = ox + dx * tr + this.cNx[c] * 0.003, py = oy + dy * tr + this.cNy[c] * 0.003, pz = oz + dz * tr + this.cNz[c] * 0.003;
            if (this.scene.cast(px, py, pz, sd[0], sd[1], sd[2], 1e-3, 80)) lam = 0;
          }
          const L = (this.env.ambient ?? 0.45) + (this.env.sunI ?? 0.75) * lam;
          cr = M[mo + 9] * L; cg = M[mo + 10] * L; cb = M[mo + 11] * L;
        }
      }
      const flags = this.cF[c];
      const Rm = this.R;
      const px = lx * r, py = ly * r, pz = lz * r;
      sink.push(t, px, py, pz,
        ox + Rm[0] * px + Rm[1] * py + Rm[2] * pz, oy + Rm[3] * px + Rm[4] * py + Rm[5] * pz, oz + Rm[6] * px + Rm[7] * py + Rm[8] * pz,
        inten, ring, col, i + 1, ns, this.cO[c], cls, cr, cg, cb, flags);
      out++;
      // Blooming um gesättigte Retroreflektoren: Streulicht erzeugt Phantompunkte in Nachbarrichtungen
      if ((flags & 2) && q > this.satQ && this.bloom > 0) {
        const nb = Math.min(6, Math.floor(Math.log10(q / this.satQ) * 3 * this.bloom) + 1);
        // Basis senkrecht zur Sensorrichtung
        let ax, ay, az;
        if (Math.abs(lsy) < 0.9) { ax = lsz; ay = 0; az = -lsx; } else { ax = 0; ay = -lsz; az = lsy; }
        const al = 1 / Math.sqrt(ax * ax + ay * ay + az * az); ax *= al; ay *= al; az *= al;
        const bx0 = lsy * az - lsz * ay, by0 = lsz * ax - lsx * az, bz0 = lsx * ay - lsy * ax;
        for (let k = 0; k < nb; k++) {
          const a = (rng.next() * 2 - 1) * this.ah * 6, b = (rng.next() * 2 - 1) * this.av * 6;
          let bx = lsx + ax * a + bx0 * b, by = lsy + ay * a + by0 * b, bz = lsz + az * a + bz0 * b;
          const bl = 1 / Math.sqrt(bx * bx + by * by + bz * bz);
          const rb = (r + rng.gauss() * this.sigma0) * bl;
          bx *= rb; by *= rb; bz *= rb;
          sink.push(t, bx, by, bz,
            ox + Rm[0] * bx + Rm[1] * by + Rm[2] * bz, oy + Rm[3] * bx + Rm[4] * by + Rm[5] * bz, oz + Rm[6] * bx + Rm[7] * by + Rm[8] * bz,
            (30 + rng.next() * 40) | 0, ring, col, i + 1, ns, this.cO[c], 7, cr, cg, cb, flags | 64);
          out++;
        }
      }
    }
    return out;
  }
}

const MERGE_IDX = new Int32Array(MAX_ECHO);
const SRGB_LUT = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) { const c = i / 1024; SRGB_LUT[i] = Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); }
const srgb8 = (v) => SRGB_LUT[v <= 0 ? 0 : v >= 1 ? 1024 : (v * 1024) | 0];
const DET_IDX = new Int32Array(MAX_ECHO);

/*
 * Punktpuffer für eine Rechenrunde (Struktur aus Feldern). Wird an den Haupt-Thread übertragen.
 *  ls: Sensorsystem (Rohdaten), w: Welt (wahre Pose), i: Reflektivität, ring/col: Kanal/Spalte,
 *  ret: Echo-Nr. (4 Bit) | Anzahl Echos (4 Bit), obj: Objekt, cls: Klasse, rgb, f: Merker, t: Zeit
 */
export class PointSink {
  constructor(cap = 65536) { this.alloc(cap); }
  alloc(cap) {
    this.cap = cap;
    this.n = 0;
    this.ls = new Float32Array(cap * 3);
    this.w = new Float32Array(cap * 3);
    this.i = new Uint8Array(cap);
    this.ring = new Uint16Array(cap);
    this.col = new Uint16Array(cap);
    this.ret = new Uint8Array(cap);
    this.obj = new Uint16Array(cap);
    this.cls = new Uint8Array(cap);
    this.rgb = new Uint8Array(cap * 3);
    this.f = new Uint8Array(cap);
    this.t = new Float64Array(cap);
  }
  grow() {
    const old = this;
    const o = { ls: this.ls, w: this.w, i: this.i, ring: this.ring, col: this.col, ret: this.ret, obj: this.obj, cls: this.cls, rgb: this.rgb, f: this.f, t: this.t, n: this.n };
    this.alloc(this.cap * 2);
    this.n = o.n;
    this.ls.set(o.ls); this.w.set(o.w); this.i.set(o.i); this.ring.set(o.ring); this.col.set(o.col); this.ret.set(o.ret);
    this.obj.set(o.obj); this.cls.set(o.cls); this.rgb.set(o.rgb); this.f.set(o.f); this.t.set(o.t);
    return old;
  }
  push(t, lx, ly, lz, wx, wy, wz, inten, ring, col, retNo, nRet, obj, cls, r, g, b, flags) {
    if (this.n >= this.cap) this.grow();
    const k = this.n++, k3 = k * 3;
    this.ls[k3] = lx; this.ls[k3 + 1] = ly; this.ls[k3 + 2] = lz;
    this.w[k3] = wx; this.w[k3 + 1] = wy; this.w[k3 + 2] = wz;
    this.i[k] = inten; this.ring[k] = ring; this.col[k] = col;
    this.ret[k] = (retNo & 15) | ((nRet & 15) << 4);
    this.obj[k] = obj; this.cls[k] = cls;
    if (r || g || b) { this.rgb[k3] = srgb8(r); this.rgb[k3 + 1] = srgb8(g); this.rgb[k3 + 2] = srgb8(b); }
    this.f[k] = flags; this.t[k] = t;
  }
  // kompakte Kopie zum Übertragen
  take() {
    const n = this.n;
    const out = {
      n,
      ls: this.ls.slice(0, n * 3), w: this.w.slice(0, n * 3), i: this.i.slice(0, n), ring: this.ring.slice(0, n), col: this.col.slice(0, n),
      ret: this.ret.slice(0, n), obj: this.obj.slice(0, n), cls: this.cls.slice(0, n), rgb: this.rgb.slice(0, n * 3), f: this.f.slice(0, n), t: this.t.slice(0, n),
    };
    this.n = 0;
    return out;
  }
  static transferables(o) { return [o.ls.buffer, o.w.buffer, o.i.buffer, o.ring.buffer, o.col.buffer, o.ret.buffer, o.obj.buffer, o.cls.buffer, o.rgb.buffer, o.f.buffer, o.t.buffer]; }
}
