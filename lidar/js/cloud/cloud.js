// Punktwolken-Speicher und -Darstellung.
// Blöcke fester Größe (je ein THREE.Points), Attribute: Position, RGB, Reflektivität, Echo/Klasse/Kanal/Merker, Zeit,
// optional Abweichung. Ein gemeinsamer Shader färbt nach Modus; „ring“-Wolken überschreiben zyklisch (Live-Puffer).
import * as THREE from 'three';

export const CLOUD_LAYER = 2;
export const MESH_LAYER = 3;

export const COLOR_MODES = [
  { id: 'intensity', name: 'Reflektivität', short: 'Reflekt.' },
  { id: 'intensity_rb', name: 'Reflektivität (Farbe)', short: 'Reflekt. bunt' },
  { id: 'rgb', name: 'Kamerafarbe (RGB)', short: 'RGB' },
  { id: 'height', name: 'Höhe', short: 'Höhe' },
  { id: 'range', name: 'Entfernung', short: 'Entf.' },
  { id: 'ring', name: 'Kanal / Ring', short: 'Kanal' },
  { id: 'return', name: 'Echo-Nummer', short: 'Echo' },
  { id: 'time', name: 'Zeit', short: 'Zeit' },
  { id: 'class', name: 'Klasse (LAS)', short: 'Klasse' },
  { id: 'deviation', name: 'Abweichung', short: 'Abw.' },
  { id: 'flat', name: 'Einfarbig', short: 'Einfarbig' },
];
const MODE_INDEX = Object.fromEntries(COLOR_MODES.map((m, i) => [m.id, i]));

// Farbtabellen (je 256 Werte): Turbo, Viridis, Grau, Divergierend, Regenbogen, Inferno
function makeLUT() {
  const W = 256, H = 6;
  const data = new Uint8Array(W * H * 4);
  const turbo = (t) => {
    const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
    const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
    const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
    return [r, g, b];
  };
  const viridis = (t) => {
    const c0 = [0.2777, 0.0054, 0.334], c1 = [0.105, 1.4046, 1.3846], c2 = [-0.3309, 0.2148, 0.095], c3 = [-4.6342, -5.7991, -19.3324], c4 = [6.2283, 14.1799, 56.6906], c5 = [4.7764, -13.7451, -65.353], c6 = [-5.4355, 4.6459, 26.3124];
    return [0, 1, 2].map((i) => c0[i] + t * (c1[i] + t * (c2[i] + t * (c3[i] + t * (c4[i] + t * (c5[i] + t * c6[i]))))));
  };
  const inferno = (t) => {
    const c0 = [0.0002, 0.0016, -0.0194], c1 = [0.1065, 0.5639, 3.9327], c2 = [11.6025, -3.9729, -15.9424], c3 = [-41.704, 17.4364, 44.3541], c4 = [77.163, -33.4023, -81.8073], c5 = [-71.3194, 32.6261, 73.2095], c6 = [25.1311, -12.2427, -23.0703];
    return [0, 1, 2].map((i) => c0[i] + t * (c1[i] + t * (c2[i] + t * (c3[i] + t * (c4[i] + t * (c5[i] + t * c6[i]))))));
  };
  const div = (t) => { // blau – weiß – rot (Abweichung)
    if (t < 0.5) { const u = t / 0.5; return [0.12 + 0.86 * u, 0.32 + 0.66 * u, 0.85 + 0.13 * u]; }
    const u = (t - 0.5) / 0.5; return [0.98 - 0.12 * u, 0.98 - 0.78 * u, 0.98 - 0.82 * u];
  };
  const rainbow = (t) => { const h = (1 - t) * 0.7; const c = new THREE.Color().setHSL(h, 1, 0.5); return [c.r, c.g, c.b]; };
  const rows = [turbo, viridis, (t) => [t, t, t], div, rainbow, inferno];
  rows.forEach((f, r) => {
    for (let x = 0; x < W; x++) {
      const c = f(x / (W - 1));
      const o = (r * W + x) * 4;
      data[o] = Math.max(0, Math.min(255, c[0] * 255)); data[o + 1] = Math.max(0, Math.min(255, c[1] * 255)); data[o + 2] = Math.max(0, Math.min(255, c[2] * 255)); data[o + 3] = 255;
    }
  });
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
let LUT = null;
export function lut() { return LUT || (LUT = makeLUT()); }

const VS = /* glsl */`
attribute vec4 cinfo;    // RGB + Reflektivität in einem 4-Byte-Paket (Metal/Safari braucht 4-Byte-Schritte)
attribute vec4 meta;     // Echo-Info, Klasse, Kanal, Merker (0…255)
attribute float ptime;
attribute float dev;
uniform int mode;
uniform float size;
uniform float sizeWorld;
uniform float pxScale;
uniform vec2 hRange;
uniform vec3 origin;
uniform vec2 rRange;
uniform vec2 tRange;
uniform vec2 dRange;
uniform vec2 iRange;
uniform vec3 tint;
uniform sampler2D lut;
uniform float hideBloom;
uniform float hideNoise;
uniform vec4 clipMin;
uniform vec4 clipMax;
varying vec3 vColor;
vec3 lutc(float row, float t) { return texture2D(lut, vec2(clamp(t, 0.0, 1.0) * 0.996 + 0.002, (row + 0.5) / 6.0)).rgb; }
vec3 catc(float k) { return lutc(4.0, fract(k * 0.61803398875)); }
void main() {
  vec3 color = cinfo.rgb;
  float intensity = cinfo.a;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float flags = meta.w;
  bool kill = (hideBloom > 0.5 && mod(floor(flags / 64.0), 2.0) > 0.5) || (hideNoise > 0.5 && meta.y > 6.5 && meta.y < 7.5);
  if (clipMax.w > 0.5 && (any(lessThan(wp.xyz, clipMin.xyz)) || any(greaterThan(wp.xyz, clipMax.xyz)))) kill = true;
  vec4 mv = viewMatrix * wp;
  gl_Position = kill ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  float ps = sizeWorld > 0.0 ? sizeWorld * pxScale / max(0.01, -mv.z) : size;
  gl_PointSize = clamp(ps, 1.0, 48.0);
  float it = (intensity * 255.0 - iRange.x) / max(1.0, iRange.y - iRange.x);
  if (mode == 0) { float g = pow(clamp(it, 0.0, 1.0), 0.75); vColor = vec3(g); }
  else if (mode == 1) vColor = lutc(0.0, it);
  else if (mode == 2) vColor = color;
  else if (mode == 3) vColor = lutc(0.0, (wp.y - hRange.x) / max(0.01, hRange.y - hRange.x));
  else if (mode == 4) vColor = lutc(5.0, 1.0 - (distance(wp.xyz, origin) - rRange.x) / max(0.01, rRange.y - rRange.x));
  else if (mode == 5) vColor = catc(meta.z);
  else if (mode == 6) {
    float n = floor(meta.x / 16.0); float r = mod(meta.x, 16.0);
    vColor = n <= 1.0 ? vec3(0.35, 0.55, 0.95) : (r == 1.0 ? vec3(0.25, 0.85, 0.45) : (r == n ? vec3(0.95, 0.3, 0.25) : vec3(0.98, 0.8, 0.2)));
  }
  else if (mode == 7) vColor = lutc(1.0, (ptime - tRange.x) / max(0.0001, tRange.y - tRange.x));
  else if (mode == 8) {
    float c = meta.y;
    vColor = c == 2.0 ? vec3(0.62, 0.48, 0.3) : c == 3.0 ? vec3(0.55, 0.8, 0.35) : c == 5.0 ? vec3(0.15, 0.6, 0.2) : c == 6.0 ? vec3(0.9, 0.55, 0.3) : c == 7.0 ? vec3(0.95, 0.1, 0.6) : c == 9.0 ? vec3(0.2, 0.45, 0.95) : vec3(0.72);
  }
  else if (mode == 9) vColor = dev > 1e8 ? vec3(0.45) : lutc(3.0, (dev - dRange.x) / max(1e-6, dRange.y - dRange.x));
  else vColor = tint;
}`;

const FS = /* glsl */`
varying vec3 vColor;
uniform float opacity;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  if (dot(c, c) > 1.0) discard;
  gl_FragColor = vec4(vColor, opacity);
}`;

export function makeCloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      mode: { value: 0 }, size: { value: 2 }, sizeWorld: { value: 0 }, pxScale: { value: 800 },
      hRange: { value: new THREE.Vector2(0, 4) }, origin: { value: new THREE.Vector3() }, rRange: { value: new THREE.Vector2(0, 30) },
      tRange: { value: new THREE.Vector2(0, 1) }, dRange: { value: new THREE.Vector2(-0.02, 0.02) }, iRange: { value: new THREE.Vector2(0, 110) },
      tint: { value: new THREE.Color('#5fd3ff') }, lut: { value: lut() }, opacity: { value: 1 },
      hideBloom: { value: 0 }, hideNoise: { value: 0 },
      clipMin: { value: new THREE.Vector4(-1e9, -1e9, -1e9, 0) }, clipMax: { value: new THREE.Vector4(1e9, 1e9, 1e9, 0) },
    },
    vertexShader: VS, fragmentShader: FS, transparent: false,
  });
}

// „keine Abweichung“ (1e9) für alle Punkte, ein GPU-Puffer je Blockgröße für alle Blöcke
const NO_DEV = new Map();
function noDev(cap) {
  let a = NO_DEV.get(cap);
  if (!a) NO_DEV.set(cap, a = new THREE.BufferAttribute(new Float32Array(cap).fill(1e9), 1));
  return a;
}

class Chunk {
  constructor(cap, material) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.rgb = new Uint8Array(cap * 3);
    this.inten = new Uint8Array(cap);
    this.meta = new Uint8Array(cap * 4);
    this.time = new Float32Array(cap);
    this.obj = new Uint16Array(cap);
    this.dev = null;
    const g = new THREE.BufferGeometry();
    const A = (arr, n, norm = false) => { const a = new THREE.BufferAttribute(arr, n, norm); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', A(this.pos, 3));
    // für die GPU: Farbe und Reflektivität gepackt; 3- und 1-Byte-Attribute zeichnet Safari (Metal) nicht
    this.cinfo = new Uint8Array(cap * 4);
    g.setAttribute('cinfo', A(this.cinfo, 4, true));
    g.setAttribute('meta', A(this.meta, 4));
    g.setAttribute('ptime', A(this.time, 1));
    g.setAttribute('dev', noDev(cap)); // Platzhalter in voller Länge: Safari verwirft Zeichenaufrufe mit zu kurzen Attributen
    g.setDrawRange(0, 0);
    this.geo = g;
    this.points = new THREE.Points(g, material);
    this.points.frustumCulled = false;
    this.points.layers.set(CLOUD_LAYER);
    this.box = new THREE.Box3();
    this.dirtyFrom = -1; this.dirtyTo = -1;
  }
  markDirty(a, b) {
    this.dirtyFrom = this.dirtyFrom < 0 ? a : Math.min(this.dirtyFrom, a);
    this.dirtyTo = Math.max(this.dirtyTo, b);
  }
  flush() {
    if (this.dirtyFrom < 0) return;
    const a = this.dirtyFrom, b = this.dirtyTo;
    const g = this.geo;
    // noch nicht hochgeladene Bereiche zusammenführen: mehrere Pakete pro Bild = ein Upload je Attribut
    // (früher überschrieb jedes Paket den Bereich des vorigen, dessen Punkte erreichten die GPU nie)
    const up = (name, k) => {
      const at = g.attributes[name], R = at.updateRanges;
      let s0 = a * k, s1 = b * k;
      if (R.length) { for (const q of R) { s0 = Math.min(s0, q.start); s1 = Math.max(s1, q.start + q.count); } at.clearUpdateRanges(); }
      at.addUpdateRange(s0, s1 - s0); at.needsUpdate = true;
    };
    const ci = this.cinfo, rgb = this.rgb, it = this.inten;
    for (let i = a; i < b; i++) { const j = i * 4, k = i * 3; ci[j] = rgb[k]; ci[j + 1] = rgb[k + 1]; ci[j + 2] = rgb[k + 2]; ci[j + 3] = it[i]; }
    up('position', 3); up('cinfo', 4); up('meta', 4); up('ptime', 1);
    this.dirtyFrom = this.dirtyTo = -1;
  }
  ensureDev() {
    if (this.dev) return this.dev;
    this.dev = new Float32Array(this.cap).fill(1e9);
    this.geo.setAttribute('dev', new THREE.BufferAttribute(this.dev, 1));
    return this.dev;
  }
  dispose() { this.geo.dispose(); }
}

/*
 * PointCloud: wächst blockweise bis zum Limit; mit ring = true wird zyklisch überschrieben.
 * add(b, M): b im Format des Workers (PointSink.take), M optional Matrix4 oder Funktion (k, out) → Weltposition.
 */
export class PointCloud {
  constructor(opts = {}) {
    this.chunkSize = opts.chunk || 131072;
    this.limit = opts.limit || 6e6;
    this.ring = !!opts.ring;
    this.material = opts.material || makeCloudMaterial();
    this.group = new THREE.Group();
    this.group.name = opts.name || 'Punktwolke';
    this.chunks = [];
    this.count = 0;       // gültige Punkte
    this.written = 0;     // insgesamt geschrieben (für den Ringpuffer)
    this.box = new THREE.Box3();
    this.tMin = Infinity; this.tMax = -Infinity;
    this.useWorld = opts.useWorld !== false;
    this.dropped = 0;
  }

  get capacity() { return this.chunks.length * this.chunkSize; }

  newChunk() {
    const c = new Chunk(this.chunkSize, this.material);
    this.chunks.push(c);
    this.group.add(c.points);
    return c;
  }

  // Schreibposition für den nächsten Punkt
  slot() {
    if (this.ring) {
      const cap = Math.ceil(this.limit / this.chunkSize) * this.chunkSize;
      const k = this.written % cap;
      const ci = Math.floor(k / this.chunkSize);
      while (this.chunks.length <= ci) this.newChunk();
      const c = this.chunks[ci];
      const i = k - ci * this.chunkSize;
      if (c.n <= i) c.n = i + 1;
      this.written++;
      this.count = Math.min(this.written, cap);
      return [c, i];
    }
    if (this.count >= this.limit) return null;
    let c = this.chunks[this.chunks.length - 1];
    if (!c || c.n >= c.cap) c = this.newChunk();
    const i = c.n++;
    this.count++; this.written++;
    return [c, i];
  }

  add(b, M = null, filter = null) {
    const src = this.useWorld ? b.w : b.ls;
    const out = TMP;
    const e = M && M.isMatrix4 ? M.elements : null;
    const cs = this.chunkSize, ring = this.ring, cap = ring ? Math.ceil(this.limit / cs) * cs : 0;
    let c = null, i = 0;
    for (let k = 0; k < b.n; k++) {
      if (filter && !filter(b, k)) continue;
      // Schreibposition (wie slot(), ohne ein Feld je Punkt anzulegen)
      if (ring) {
        const q = this.written % cap, ci = (q / cs) | 0;
        while (this.chunks.length <= ci) this.newChunk();
        c = this.chunks[ci]; i = q - ci * cs;
        if (c.n <= i) c.n = i + 1;
        this.written++;
      } else {
        if (this.count >= this.limit) { this.dropped += b.n - k; break; }
        c = this.chunks[this.chunks.length - 1];
        if (!c || c.n >= c.cap) c = this.newChunk();
        i = c.n++;
        this.count++; this.written++;
      }
      let x = src[k * 3], y = src[k * 3 + 1], z = src[k * 3 + 2];
      if (e) { const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; x = X; y = Y; z = Z; }
      else if (typeof M === 'function') { M(b, k, out); x = out[0]; y = out[1]; z = out[2]; }
      const i3 = i * 3;
      c.pos[i3] = x; c.pos[i3 + 1] = y; c.pos[i3 + 2] = z;
      c.rgb[i3] = b.rgb[k * 3]; c.rgb[i3 + 1] = b.rgb[k * 3 + 1]; c.rgb[i3 + 2] = b.rgb[k * 3 + 2];
      c.inten[i] = b.i[k];
      const m4 = i * 4;
      c.meta[m4] = b.ret[k]; c.meta[m4 + 1] = b.cls[k]; c.meta[m4 + 2] = b.ring[k] & 255; c.meta[m4 + 3] = b.f[k];
      const t = b.t[k];
      c.time[i] = t;
      c.obj[i] = b.obj[k];
      if (c.dev) c.dev[i] = 1e9;
      if (t < this.tMin) this.tMin = t; if (t > this.tMax) this.tMax = t;
      if (!this.ring) this.box.expandByPoint(V.set(x, y, z));
      if (c.dirtyFrom < 0 || i < c.dirtyFrom) c.dirtyFrom = i;
      if (i + 1 > c.dirtyTo) c.dirtyTo = i + 1;
    }
    if (ring) this.count = Math.min(this.written, cap);
    for (const ch of this.chunks) { ch.geo.setDrawRange(0, ch.n); ch.flush(); }
  }

  // Punkte direkt (z. B. aus Dateien oder Verarbeitung) hinzufügen
  addRaw(pos, attrs = {}) {
    const n = pos.length / 3;
    const b = { n, w: pos, ls: pos, rgb: attrs.rgb || new Uint8Array(n * 3), i: attrs.i || new Uint8Array(n).fill(60), ret: attrs.ret || new Uint8Array(n).fill(17), cls: attrs.cls || new Uint8Array(n).fill(1), ring: attrs.ring || new Uint16Array(n), f: attrs.f || new Uint8Array(n), t: attrs.t || new Float32Array(n), obj: attrs.obj || new Uint16Array(n) };
    this.add(b);
  }

  clear() {
    for (const c of this.chunks) { c.points.removeFromParent(); c.dispose(); }
    this.chunks = []; this.count = 0; this.written = 0; this.box.makeEmpty(); this.tMin = Infinity; this.tMax = -Infinity; this.dropped = 0;
  }

  // über alle Punkte laufen: cb(chunk, i)
  each(cb) { for (const c of this.chunks) for (let i = 0; i < c.n; i++) cb(c, i); }

  // Bounding Box neu berechnen (nach Filtern oder Transformieren)
  recomputeBox() {
    this.box.makeEmpty();
    for (const c of this.chunks) for (let i = 0; i < c.n; i++) this.box.expandByPoint(V.set(c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]));
    return this.box;
  }

  // alle Punkte in ein Feld kopieren (für Verarbeitung/Export); with: Liste der Attribute
  gather() {
    const n = this.count;
    const out = { n, pos: new Float32Array(n * 3), rgb: new Uint8Array(n * 3), i: new Uint8Array(n), meta: new Uint8Array(n * 4), t: new Float32Array(n), obj: new Uint16Array(n) };
    let o = 0;
    const M = this.group.matrixWorld;
    const ident = this.isIdentity();
    for (const c of this.chunks) {
      const m = Math.min(c.n, n - o);
      if (m <= 0) break;
      if (ident) out.pos.set(c.pos.subarray(0, m * 3), o * 3);
      else for (let i = 0; i < m; i++) { V.set(c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]).applyMatrix4(M); out.pos[(o + i) * 3] = V.x; out.pos[(o + i) * 3 + 1] = V.y; out.pos[(o + i) * 3 + 2] = V.z; }
      out.rgb.set(c.rgb.subarray(0, m * 3), o * 3);
      out.i.set(c.inten.subarray(0, m), o);
      out.meta.set(c.meta.subarray(0, m * 4), o * 4);
      out.t.set(c.time.subarray(0, m), o);
      out.obj.set(c.obj.subarray(0, m), o);
      o += m;
    }
    return out;
  }
  isIdentity() { this.group.updateMatrixWorld(true); const e = this.group.matrixWorld.elements; return e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[1] === 0 && e[2] === 0 && e[4] === 0; }

  // Punkte nach Bedingung behalten (für Filter): keep(chunk, i) → bool
  retain(keep) {
    let removed = 0;
    for (const c of this.chunks) {
      let w = 0;
      for (let i = 0; i < c.n; i++) {
        if (!keep(c, i)) { removed++; continue; }
        if (w !== i) {
          c.pos[w * 3] = c.pos[i * 3]; c.pos[w * 3 + 1] = c.pos[i * 3 + 1]; c.pos[w * 3 + 2] = c.pos[i * 3 + 2];
          c.rgb[w * 3] = c.rgb[i * 3]; c.rgb[w * 3 + 1] = c.rgb[i * 3 + 1]; c.rgb[w * 3 + 2] = c.rgb[i * 3 + 2];
          c.inten[w] = c.inten[i];
          c.meta[w * 4] = c.meta[i * 4]; c.meta[w * 4 + 1] = c.meta[i * 4 + 1]; c.meta[w * 4 + 2] = c.meta[i * 4 + 2]; c.meta[w * 4 + 3] = c.meta[i * 4 + 3];
          c.time[w] = c.time[i]; c.obj[w] = c.obj[i];
          if (c.dev) c.dev[w] = c.dev[i];
        }
        w++;
      }
      c.n = w;
      c.geo.setDrawRange(0, w);
      c.markDirty(0, w);
      c.flush();
      if (c.dev) c.geo.attributes.dev.needsUpdate = true;
    }
    this.count -= removed;
    this.written = this.count;
    this.recomputeBox();
    return removed;
  }

  setMode(id) { this.material.uniforms.mode.value = MODE_INDEX[id] ?? 0; }
  dispose() { this.clear(); this.material.dispose(); }
}

const V = new THREE.Vector3();
const TMP = new Float64Array(3);
