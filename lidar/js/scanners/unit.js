// Das Einzelgerät hinter dem Datenblatt: Seriennummer, Restfehler der Werkskalibrierung je Kanal,
// Wärmehaushalt mit Aufwärmdrift, Hochlauf (Booten, Motor), Netzwerkanschluss mit Paketen und Verlust.
// Kein Scanner misst wie ein anderer desselben Typs – genau das bildet diese Datei ab.

// deterministischer Zufall je Seriennummer
function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-12, next()), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return { next, gauss };
}
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }

// Restfehler nach Werkskalibrierung (1σ) je Geräteklasse: Elevation/Azimut in Grad, Entfernung in m, Verstärkung relativ
function calibSigma(spec) {
  const c = spec.cls, m = spec.maker;
  if (c === 'tls') return { el: 0.0012, az: 0.0012, r: 0.0004, g: 0.015 };
  if (c === 'line') return { el: 0.02, az: 0.02, r: 0.008, g: 0.05 };
  if (c === 'depth' || c === 'phone') return { el: 0.01, az: 0.01, r: 0.003, g: 0.03 };
  if (m === 'Livox') return { el: 0.02, az: 0.02, r: 0.006, g: 0.05 };
  if (m === 'Ouster') return { el: 0.03, az: 0.025, r: 0.005, g: 0.08 };
  return { el: 0.05, az: 0.04, r: 0.011, g: 0.12 }; // klassische Mehrstrahl-Scanner (Velodyne, Hesai, Robosense)
}

// Hochlauf in Simulationssekunden: Selbsttest/Booten, danach Motor bzw. Prismen auf Solldrehzahl.
// (Echte Geräte brauchen teils länger – Ouster bis ≈ 30 s; hier verkürzt, das Verhalten bleibt gleich.)
function bootTimes(spec) {
  const m = spec.maker, t = spec.pattern.type;
  if (spec.cls === 'tls') return [2.5, 0];
  if (t === 'phone' || t === 'flash') return [0.6, 0];
  if (m === 'Ouster') return [6, 2];
  if (m === 'Livox') return [3.5, 1.5];
  if (spec.cls === 'line') return [1.2, 1.5];
  if (t === 'spin') return [2, 2.5];
  return [2, 1];
}

// Anschluss und Paketformat
function linkOf(spec) {
  const m = spec.maker, id = spec.id;
  // pkt: Messungen je Paket (fortlaufende Muster), pktCols: Spalten je Paket (rotierende Scanner)
  if (spec.cls === 'tls') return { name: 'WLAN', mbit: 150, pkt: 512, pktCols: 8, base: 5e-4 };
  if (spec.pattern.type === 'phone') return { name: 'intern', mbit: 10000, pkt: 576, pktCols: 1, base: 0 };
  if (/^rp|^ydl/i.test(id) || m === 'Slamtec') return { name: 'USB', mbit: 12, pkt: 64, pktCols: 64, base: 1e-5 };
  if (m === 'Ouster') return { name: 'ETH 1000M', mbit: 1000, pkt: 2048, pktCols: 16, base: 2e-5 };
  if (m === 'Hesai' || m === 'Robosense' || /hdl64|vls/i.test(id)) return { name: 'ETH 1000M', mbit: 1000, pkt: 1200, pktCols: 10, base: 2e-5 };
  if (m === 'Velodyne') return { name: 'ETH 100M', mbit: 100, pkt: 384, pktCols: 24, base: 2e-5 }; // 12 Blöcke × 2 Feuerfolgen
  return { name: 'ETH 100M', mbit: 100, pkt: 96, pktCols: 12, base: 2e-5 };
}

// Temperaturgang der Entfernung (m je K) – TLS sind temperaturkompensiert
function driftOf(spec) {
  if (spec.cls === 'tls') return 0.00003;
  if (spec.cls === 'line') return 0.0005;
  if (spec.maker === 'Livox') return 0.0004;
  if (spec.pattern.type === 'phone' || spec.pattern.type === 'flash') return 0.0002;
  return 0.0006;
}

let UNIT_SEQ = 0;

export class Unit {
  constructor(spec) {
    this.spec = spec;
    const no = ++UNIT_SEQ;
    const seed = hashStr(spec.id + ':' + no);
    this.serial = (spec.model.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'ECHO') + '-' + (seed % 900000 + 100000).toString(36).toUpperCase().padStart(4, '0');
    this.seed = seed;
    const p = spec.pattern;
    this.channels = Math.max(1, Math.min(256, p.elev ? p.elev.length : p.rows || 1));
    this.sig = calibSigma(spec);
    // Wärme: Eigenerwärmung nach Leistungsaufnahme, Zeitkonstante, Bezugstemperatur (eingeschwungen bei 22 °C)
    const W = (spec.data && spec.data.power) || 8;
    this.dTrun = 2.4 * Math.pow(W, 0.82);
    this.tau = spec.cls === 'tls' ? 240 : 160;
    this.Tref = 22 + this.dTrun;
    this.kT = driftOf(spec);
    this.T = null;                // °C innen (wird beim ersten Update auf Umgebung gesetzt)
    [this.tBoot, this.tSpin] = bootTimes(spec);
    this.phase = 'aus'; this.phaseT = 0;
    this.link = linkOf(spec);
    this.pkt = { sent: 0, lost: 0, win: [] };
    this.setCalib('werk');
  }

  // Kalibrierzustand: 'ideal' (perfektes Gerät), 'werk' (Restfehler nach Werkskalibrierung), 'dejustiert' (nach einem Sturz)
  setCalib(mode) {
    this.calibMode = mode;
    const n = this.channels, s = this.sig, R = rng(this.seed);
    const k = mode === 'ideal' ? 0 : mode === 'dejustiert' ? 5 : 1;
    const D = Math.PI / 180;
    this.calib = {
      dEl: Array.from({ length: n }, () => R.gauss() * s.el * D * k),
      dAz: Array.from({ length: n }, () => R.gauss() * s.az * D * k),
      dR: Array.from({ length: n }, () => R.gauss() * s.r * k),
      gain: Array.from({ length: n }, () => Math.max(0.5, 1 + R.gauss() * s.g * Math.min(k, 2))),
    };
    // nach einem Sturz zusätzlich ein gemeinsamer Kippfehler aller Kanäle
    if (mode === 'dejustiert') { const tilt = (0.15 + R.next() * 0.1) * D; for (let i = 0; i < n; i++) this.calib.dEl[i] += tilt; }
    return this.calib;
  }

  ambientOf(world) {
    const lt = world && world.lighting;
    const sun = world && world.weather ? world.weather.sun || 0 : 0;
    return { T: lt === 'outdoor' ? 16 : lt === 'night' ? 9 : 21, sunHeat: lt === 'outdoor' ? 7 * sun : 0 };
  }

  // je Bild: Zustand, Temperatur, Entfernungsdrift. on: Gerät eingeschaltet (misst), dt in Sekunden Simulationszeit
  update(dt, on, world) {
    const A = this.ambientOf(world);
    if (this.T == null) this.T = A.T;
    // Zustandsfolge beim Einschalten: Booten → Anlauf → misst; beim Ausschalten sofort aus (warm bleibt er)
    // Kaltstart: Booten → Anlauf → misst. „Laser aus“ = Bereitschaft (Motor steht, Elektronik bleibt warm);
    // aus der Bereitschaft muss nur der Motor wieder auf Drehzahl.
    if (on) {
      if (this.phase === 'aus') { this.phase = 'boot'; this.phaseT = 0; }
      else if (this.phase === 'bereit') { this.phase = this.tSpin > 0 ? 'anlauf' : 'misst'; this.phaseT = 0; }
      this.phaseT += dt;
      if (this.phase === 'boot' && this.phaseT >= this.tBoot) { this.phase = this.tSpin > 0 ? 'anlauf' : 'misst'; this.phaseT = 0; }
      if (this.phase === 'anlauf' && this.phaseT >= this.tSpin) { this.phase = 'misst'; this.phaseT = 0; }
    } else if (this.phase !== 'aus') { this.phase = 'bereit'; this.phaseT = 0; }
    const heat = this.phase === 'aus' ? 0 : this.phase === 'misst' ? 1 : this.phase === 'bereit' ? 0.35 : 0.55;
    const Teq = A.T + A.sunHeat + this.dTrun * heat;
    this.T += (Teq - this.T) * (1 - Math.exp(-dt / this.tau));
    return this.phase === 'misst';
  }
  get ready() { return this.phase === 'misst'; }
  get progress() { return this.phase === 'boot' ? this.phaseT / this.tBoot : this.phase === 'anlauf' ? this.phaseT / this.tSpin : this.phase === 'misst' ? 1 : 0; }
  // systematischer Entfernungsfehler aus der Temperatur (m)
  get bias() { return this.kT * ((this.T ?? this.Tref) - this.Tref); }
  get rpmFrac() { return this.phase === 'anlauf' ? Math.min(1, this.phaseT / this.tSpin) : this.phase === 'misst' ? 1 : 0; }

  // Netzwerk: Auslastung bei nominaler Datenrate (bit/s) und Anteil verlorener Pakete
  loadOf(bitsPerS) { return bitsPerS / (this.link.mbit * 1e6); }
  dropFraction(bitsPerS) {
    const u = this.loadOf(bitsPerS);
    // bis ≈ 92 % Auslastung kaum Verlust, darüber gehen alle Pakete verloren, die nicht mehr durchpassen
    return Math.min(0.98, this.link.base + (u > 0.92 ? 1 - 0.92 / u : 0));
  }
  // Paketzähler über ein gleitendes Fenster
  countPackets(t, sent, lost) {
    const P = this.pkt;
    P.sent += sent; P.lost += lost;
    P.win.push([t, sent, lost]);
    while (P.win.length > 2 && P.win[0][0] < t - 1) P.win.shift();
  }
  get lossRate() { let s = 0, l = 0; for (const [, a, b] of this.pkt.win) { s += a; l += b; } return s ? l / s : 0; }
  get pktRate() { const W = this.pkt.win; if (W.length < 2) return 0; let s = 0; for (const [, a] of W) s += a; return s / Math.max(0.1, W[W.length - 1][0] - W[0][0]); }
}

// Datensatz eines Rechenfensters auf die Punkte mit keep[k] = 1 verkleinern (alle Felder gleichlaufend)
export function compactData(d, keep) {
  const n = d.n;
  let m = 0;
  for (let k = 0; k < n; k++) if (keep[k]) m++;
  if (m === n) return d;
  for (const key of Object.keys(d)) {
    const a = d[key];
    if (!a || !ArrayBuffer.isView(a) || !n || a.length % n) continue;
    const st = a.length / n;
    let w = 0;
    for (let k = 0; k < n; k++) {
      if (!keep[k]) continue;
      if (w !== k) for (let q = 0; q < st; q++) a[w * st + q] = a[k * st + q];
      w++;
    }
    d[key] = a.subarray(0, m * st);
  }
  d.n = m;
  return d;
}
