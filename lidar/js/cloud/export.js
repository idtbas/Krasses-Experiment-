// Dateiexport: LAS 1.2 (PDRF 3), PLY (binär), PCD (binär), XYZ/CSV, Netze (OBJ, STL, PLY) und Velodyne-PCAP.
// Achsen: „zup“ = Vermessung/ROS (X Ost, Y Nord, Z oben) → X = x, Y = −z, Z = y; „yup“ = 3D-Grafik unverändert.

export function axisMap(axis) {
  return axis === 'zup' ? (x, y, z, o) => { o[0] = x; o[1] = -z; o[2] = y; } : (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = z; };
}

class Writer {
  constructor(size) { this.buf = new ArrayBuffer(size); this.dv = new DataView(this.buf); this.u8 = new Uint8Array(this.buf); this.o = 0; }
  u8v(v) { this.dv.setUint8(this.o, v); this.o += 1; }
  i8(v) { this.dv.setInt8(this.o, v); this.o += 1; }
  u16(v) { this.dv.setUint16(this.o, v, true); this.o += 2; }
  u32(v) { this.dv.setUint32(this.o, v, true); this.o += 4; }
  i32(v) { this.dv.setInt32(this.o, v, true); this.o += 4; }
  f32(v) { this.dv.setFloat32(this.o, v, true); this.o += 4; }
  f64(v) { this.dv.setFloat64(this.o, v, true); this.o += 8; }
  str(s, n) { for (let i = 0; i < n; i++) this.u8[this.o + i] = i < s.length ? s.charCodeAt(i) & 0x7f : 0; this.o += n; }
  bytes(a) { this.u8.set(a, this.o); this.o += a.length; }
}

/* ---------------- LAS 1.2, Punktformat 3 ---------------- */
// d: { n, pos (Welt), rgb, i, meta [ret, cls, ring, flags], t }
export function writeLAS(d, opts = {}) {
  const map = axisMap(opts.axis || 'zup');
  const n = d.n, o = [0, 0, 0];
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const byRet = [0, 0, 0, 0, 0];
  for (let k = 0; k < n; k++) {
    map(d.pos[k * 3], d.pos[k * 3 + 1], d.pos[k * 3 + 2], o);
    for (let q = 0; q < 3; q++) { if (o[q] < mn[q]) mn[q] = o[q]; if (o[q] > mx[q]) mx[q] = o[q]; }
    const r = Math.max(1, Math.min(5, d.meta[k * 4] & 15));
    byRet[r - 1]++;
  }
  if (!n) { mn = [0, 0, 0]; mx = [0, 0, 0]; }
  const scale = opts.scale || 0.0001;
  const off = mn.map((v) => Math.floor(v));
  const w = new Writer(227 + n * 34);
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  w.str('LASF', 4); w.u16(0); w.u16(0); w.bytes(new Uint8Array(16)); w.u8v(1); w.u8v(2);
  w.str(opts.system || 'ECHO LiDAR-Simulation', 32); w.str('ECHO LiDAR-Studio', 32);
  w.u16(doy); w.u16(now.getFullYear()); w.u16(227); w.u32(227); w.u32(0); w.u8v(3); w.u16(34); w.u32(n);
  for (const c of byRet) w.u32(c);
  w.f64(scale); w.f64(scale); w.f64(scale); w.f64(off[0]); w.f64(off[1]); w.f64(off[2]);
  w.f64(mx[0]); w.f64(mn[0]); w.f64(mx[1]); w.f64(mn[1]); w.f64(mx[2]); w.f64(mn[2]);
  const t0 = opts.gpsTime || 0;
  for (let k = 0; k < n; k++) {
    map(d.pos[k * 3], d.pos[k * 3 + 1], d.pos[k * 3 + 2], o);
    w.i32(Math.round((o[0] - off[0]) / scale)); w.i32(Math.round((o[1] - off[1]) / scale)); w.i32(Math.round((o[2] - off[2]) / scale));
    w.u16(Math.min(65535, d.i[k] * 257));
    const rn = Math.max(1, Math.min(7, d.meta[k * 4] & 15)), nr = Math.max(1, Math.min(7, d.meta[k * 4] >> 4));
    w.u8v(rn | (nr << 3));
    w.u8v(d.meta[k * 4 + 1] & 31);
    w.i8(0); w.u8v(d.meta[k * 4 + 2]); w.u16(opts.sourceId || 1);
    w.f64(t0 + d.t[k]);
    w.u16(d.rgb[k * 3] * 257); w.u16(d.rgb[k * 3 + 1] * 257); w.u16(d.rgb[k * 3 + 2] * 257);
  }
  return new Blob([w.buf], { type: 'application/octet-stream' });
}

/* ---------------- PLY (binär, little endian) ---------------- */
export function writePLY(d, opts = {}) {
  const map = axisMap(opts.axis || 'yup');
  const n = d.n, o = [0, 0, 0];
  const head = `ply\nformat binary_little_endian 1.0\ncomment ECHO LiDAR-Studio (Simulation)\ncomment Achsen ${opts.axis === 'zup' ? 'Z oben' : 'Y oben'}\nelement vertex ${n}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty float intensity\nproperty uchar return_number\nproperty uchar number_of_returns\nproperty uchar classification\nproperty uchar ring\nproperty double gps_time\nend_header\n`;
  const H = new TextEncoder().encode(head);
  const w = new Writer(H.length + n * (12 + 3 + 4 + 4 + 8));
  w.bytes(H);
  for (let k = 0; k < n; k++) {
    map(d.pos[k * 3], d.pos[k * 3 + 1], d.pos[k * 3 + 2], o);
    w.f32(o[0]); w.f32(o[1]); w.f32(o[2]);
    w.u8v(d.rgb[k * 3]); w.u8v(d.rgb[k * 3 + 1]); w.u8v(d.rgb[k * 3 + 2]);
    w.f32(d.i[k]);
    w.u8v(d.meta[k * 4] & 15); w.u8v(d.meta[k * 4] >> 4); w.u8v(d.meta[k * 4 + 1]); w.u8v(d.meta[k * 4 + 2]);
    w.f64(d.t[k]);
  }
  return new Blob([w.buf], { type: 'application/octet-stream' });
}

/* ---------------- PCD v0.7 (PCL/ROS), binär ---------------- */
export function writePCD(d, opts = {}) {
  const map = axisMap(opts.axis || 'zup');
  const n = d.n, o = [0, 0, 0];
  const head = `# .PCD v0.7 - Point Cloud Data file format (ECHO LiDAR-Studio)\nVERSION 0.7\nFIELDS x y z intensity ring time\nSIZE 4 4 4 4 2 8\nTYPE F F F F U F\nCOUNT 1 1 1 1 1 1\nWIDTH ${n}\nHEIGHT 1\nVIEWPOINT 0 0 0 1 0 0 0\nPOINTS ${n}\nDATA binary\n`;
  const H = new TextEncoder().encode(head);
  const w = new Writer(H.length + n * 30);
  w.bytes(H);
  for (let k = 0; k < n; k++) {
    map(d.pos[k * 3], d.pos[k * 3 + 1], d.pos[k * 3 + 2], o);
    w.f32(o[0]); w.f32(o[1]); w.f32(o[2]); w.f32(d.i[k]); w.u16(d.meta[k * 4 + 2]); w.f64(d.t[k]);
  }
  return new Blob([w.buf], { type: 'application/octet-stream' });
}

/* ---------------- XYZ / CSV (Text) ---------------- */
export function writeXYZ(d, opts = {}) {
  const map = axisMap(opts.axis || 'zup');
  const o = [0, 0, 0];
  const parts = [opts.csv ? 'x,y,z,r,g,b,intensity,return,returns,class,ring,time\n' : '// x y z r g b intensity\n'];
  let s = '';
  for (let k = 0; k < d.n; k++) {
    map(d.pos[k * 3], d.pos[k * 3 + 1], d.pos[k * 3 + 2], o);
    if (opts.csv) s += `${o[0].toFixed(4)},${o[1].toFixed(4)},${o[2].toFixed(4)},${d.rgb[k * 3]},${d.rgb[k * 3 + 1]},${d.rgb[k * 3 + 2]},${d.i[k]},${d.meta[k * 4] & 15},${d.meta[k * 4] >> 4},${d.meta[k * 4 + 1]},${d.meta[k * 4 + 2]},${d.t[k].toFixed(6)}\n`;
    else s += `${o[0].toFixed(4)} ${o[1].toFixed(4)} ${o[2].toFixed(4)} ${d.rgb[k * 3]} ${d.rgb[k * 3 + 1]} ${d.rgb[k * 3 + 2]} ${d.i[k]}\n`;
    if (s.length > 1 << 20) { parts.push(s); s = ''; }
  }
  parts.push(s);
  return new Blob(parts, { type: 'text/plain' });
}

/* ---------------- Netze ---------------- */
// m: { pos Float32 (Welt), rgb Float32 0…255 (optional), index Uint32 }
export function writeOBJ(m, opts = {}) {
  const map = axisMap(opts.axis || 'yup'), o = [0, 0, 0];
  const parts = ['# ECHO LiDAR-Studio – vernetzte Punktwolke\n'];
  let s = '';
  for (let i = 0; i < m.pos.length; i += 3) {
    map(m.pos[i], m.pos[i + 1], m.pos[i + 2], o);
    s += m.rgb ? `v ${o[0].toFixed(4)} ${o[1].toFixed(4)} ${o[2].toFixed(4)} ${(m.rgb[i] / 255).toFixed(3)} ${(m.rgb[i + 1] / 255).toFixed(3)} ${(m.rgb[i + 2] / 255).toFixed(3)}\n` : `v ${o[0].toFixed(4)} ${o[1].toFixed(4)} ${o[2].toFixed(4)}\n`;
    if (s.length > 1 << 20) { parts.push(s); s = ''; }
  }
  for (let i = 0; i < m.index.length; i += 3) {
    s += `f ${m.index[i] + 1} ${m.index[i + 1] + 1} ${m.index[i + 2] + 1}\n`;
    if (s.length > 1 << 20) { parts.push(s); s = ''; }
  }
  parts.push(s);
  return new Blob(parts, { type: 'text/plain' });
}

export function writeSTL(m, opts = {}) {
  const map = axisMap(opts.axis || 'zup'), A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  const nt = m.index.length / 3;
  const w = new Writer(84 + nt * 50);
  w.str('ECHO LiDAR-Studio STL', 80); w.u32(nt);
  for (let t = 0; t < nt; t++) {
    const a = m.index[t * 3], b = m.index[t * 3 + 1], c = m.index[t * 3 + 2];
    map(m.pos[a * 3], m.pos[a * 3 + 1], m.pos[a * 3 + 2], A); map(m.pos[b * 3], m.pos[b * 3 + 1], m.pos[b * 3 + 2], B); map(m.pos[c * 3], m.pos[c * 3 + 1], m.pos[c * 3 + 2], C);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    w.f32(nx / l); w.f32(ny / l); w.f32(nz / l);
    for (const P of [A, B, C]) { w.f32(P[0]); w.f32(P[1]); w.f32(P[2]); }
    w.u16(0);
  }
  return new Blob([w.buf], { type: 'application/octet-stream' });
}

export function writeMeshPLY(m, opts = {}) {
  const map = axisMap(opts.axis || 'yup'), o = [0, 0, 0];
  const nv = m.pos.length / 3, nf = m.index.length / 3;
  const head = `ply\nformat binary_little_endian 1.0\ncomment ECHO LiDAR-Studio\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
  const H = new TextEncoder().encode(head);
  const w = new Writer(H.length + nv * 15 + nf * 13);
  w.bytes(H);
  for (let i = 0; i < nv; i++) {
    map(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2], o);
    w.f32(o[0]); w.f32(o[1]); w.f32(o[2]);
    w.u8v(m.rgb ? Math.round(m.rgb[i * 3]) : 200); w.u8v(m.rgb ? Math.round(m.rgb[i * 3 + 1]) : 200); w.u8v(m.rgb ? Math.round(m.rgb[i * 3 + 2]) : 200);
  }
  for (let t = 0; t < nf; t++) { w.u8v(3); w.i32(m.index[t * 3]); w.i32(m.index[t * 3 + 1]); w.i32(m.index[t * 3 + 2]); }
  return new Blob([w.buf], { type: 'application/octet-stream' });
}

/* ---------------- Velodyne-PCAP (Rohdatenpakete wie vom Sensor) ---------------- */
// raw: { n, ls (Sensorsystem), ring, t, i, ret } eines Velodyne-Sensors (VLP-16, Puck Hi-Res, VLP-32C, HDL-32E)
const PRODUCT = { vlp16: 0x22, vlp16hr: 0x24, vlp32c: 0x28, hdl32e: 0x21 };
export function writeVelodynePCAP(raw, spec, opts = {}) {
  const id = spec.id;
  const nch = spec.pattern.elev.length;
  const perBlock = 32; // Kanäle je Datenblock
  const seqPerBlock = nch === 16 ? 2 : 1;
  const cycle = spec.pattern.cycleUs * 1e-6;
  // Schüsse nach Feuerzyklus ordnen: Zyklus = floor(t / Zykluszeit)
  const cycles = new Map();
  for (let k = 0; k < raw.n; k++) {
    if ((raw.ret[k] & 15) !== 1) continue; // nur ein Echo je Schuss (Modus „stärkstes“)
    const c = Math.floor(raw.t[k] / cycle + 1e-6);
    let e = cycles.get(c);
    if (!e) { e = { d: new Uint16Array(nch), r: new Uint8Array(nch), t: c * cycle }; cycles.set(c, e); }
    const x = raw.ls[k * 3], y = raw.ls[k * 3 + 1], z = raw.ls[k * 3 + 2];
    const dist = Math.hypot(x, y, z);
    const ch = raw.ring[k];
    if (ch < nch) { e.d[ch] = Math.min(65535, Math.round(dist / 0.002)); e.r[ch] = raw.i[k]; }
  }
  const keys = [...cycles.keys()].sort((a, b) => a - b);
  const hz = opts.hz || 10;
  const azAt = (t) => Math.round(((t * hz * 360) % 360) * 100) % 36000;
  const seqsPerPacket = 12 * seqPerBlock;
  const nPk = Math.ceil(keys.length / seqsPerPacket);
  const pkLen = 42 + 1206;
  const w = new Writer(24 + nPk * (16 + pkLen));
  // globaler PCAP-Kopf
  w.u32(0xa1b2c3d4); w.u16(2); w.u16(4); w.i32(0); w.u32(0); w.u32(65535); w.u32(1);
  const t0 = opts.startEpoch || Math.floor(Date.now() / 1000);
  for (let p = 0; p < nPk; p++) {
    const first = cycles.get(keys[p * seqsPerPacket]);
    const ts = first.t;
    w.u32(t0 + Math.floor(ts)); w.u32(Math.floor((ts % 1) * 1e6)); w.u32(pkLen); w.u32(pkLen);
    // Ethernet
    w.bytes([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x60, 0x76, 0x88, 0x00, 0x00, 0x00, 0x08, 0x00]);
    // IPv4
    const ipStart = w.o;
    w.bytes([0x45, 0x00]); w.dv.setUint16(w.o, 1234, false); w.o += 2; w.dv.setUint16(w.o, p & 0xffff, false); w.o += 2;
    w.bytes([0x40, 0x00, 0xff, 0x11, 0x00, 0x00, 192, 168, 1, 201, 255, 255, 255, 255]);
    let sum = 0; for (let i = 0; i < 20; i += 2) sum += (w.u8[ipStart + i] << 8) | w.u8[ipStart + i + 1];
    while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
    w.dv.setUint16(ipStart + 10, ~sum & 0xffff, false);
    // UDP (Quelle und Ziel 2368)
    w.dv.setUint16(w.o, 2368, false); w.o += 2; w.dv.setUint16(w.o, 2368, false); w.o += 2; w.dv.setUint16(w.o, 1214, false); w.o += 2; w.u16(0);
    // 12 Datenblöcke
    for (let b = 0; b < 12; b++) {
      const kb = p * seqsPerPacket + b * seqPerBlock;
      const c0 = kb < keys.length ? cycles.get(keys[kb]) : null;
      w.u8v(0xff); w.u8v(0xee);
      w.u16(c0 ? azAt(c0.t) : 0);
      for (let s = 0; s < seqPerBlock; s++) {
        const c = kb + s < keys.length ? cycles.get(keys[kb + s]) : null;
        for (let ch = 0; ch < perBlock / seqPerBlock; ch++) { w.u16(c && ch < nch ? c.d[ch] : 0); w.u8v(c && ch < nch ? c.r[ch] : 0); }
      }
    }
    // Zeitstempel (µs seit voller Stunde) und Werksbytes
    w.u32(Math.floor((ts % 3600) * 1e6));
    w.u8v(0x37); w.u8v(PRODUCT[id] || 0x22);
  }
  return new Blob([w.buf], { type: 'application/vnd.tcpdump.pcap' });
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
