// Tiefenbilder für Flash-/iToF-Kameras und das Smartphone-LiDAR (im Worker).
//
// Flash/iToF: ein Strahl je Pixel (mit Teilstrahlen), phasenbasiertes Mitteln erzeugt „fliegende Pixel“.
// Smartphone: 576 echte dToF-Punkte (Rohdaten) und ein dichtes 256 × 192-Tiefenbild, wie es die Fusion aus
// Kamera und LiDAR liefert: kantengeglättet, kleine Löcher gefüllt, dünne Strukturen gehen verloren,
// Rauschen wächst mit der Entfernung, über 5 m nichts.
import { PointSink } from './beam.js';

const D = Math.PI / 180;

function shootPixel(s, pose, lx, ly, lz, t, row, col) {
  const R = pose.R;
  const dx = R[0] * lx + R[1] * ly + R[2] * lz, dy = R[3] * lx + R[4] * ly + R[5] * lz, dz = R[6] * lx + R[7] * ly + R[8] * lz;
  const before = s.sink.n;
  s.beam.shoot(t, pose.x, pose.y, pose.z, dx, dy, dz, lx, ly, lz, row, col, s.sink);
  return s.sink.n > before ? s.sink.n - 1 : -1;
}

export function postDepth(s, m, scene, mats, poseAt) {
  const pose = s.pose;
  poseAt(m.P, m.P, 0, pose);
  const p = s.spec.pattern;
  if (p.type === 'phone') return phoneFrame(s, m, pose);
  // Flash / iToF / MEMS-Tiefenkamera
  const pat = s.pattern;
  const dec = Math.max(1, m.decimate || 1);
  const W = Math.ceil(pat.w / dec), H = Math.ceil(pat.h / dec);
  const depth = new Float32Array(W * H);
  const dir = new Float64Array(3);
  const sink = s.sink;
  sink.n = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    pat.pixelDir(i * dec + (dec - 1) / 2, j * dec + (dec - 1) / 2, dir);
    const k = shootPixel(s, pose, dir[0], dir[1], dir[2], m.t, j, i);
    if (k >= 0) {
      const x = sink.ls[k * 3], y = sink.ls[k * 3 + 1], z = sink.ls[k * 3 + 2];
      depth[j * W + i] = z; // Tiefe entlang der optischen Achse
    }
  }
  const data = sink.take();
  return { msg: { w: W, h: H, depth, data }, transfer: [depth.buffer, ...PointSink.transferables(data)] };
}

function phoneFrame(s, m, pose) {
  const sink = s.sink;
  sink.n = 0;
  // 1) Rohpunkte: 576 Laserpunkte
  for (const d of s.pattern.dirs) shootPixel(s, pose, d[0], d[1], d[2], m.t, d[3], d[4]);
  const dots = sink.take();
  // 2) dichtes Tiefenbild (Fusion)
  const W = m.w || 256, H = m.h || 192;
  const fovH = s.spec.pattern.fovH, fovV = s.spec.pattern.fovV;
  const tx = Math.tan(fovH * D / 2), ty = Math.tan(fovV * D / 2);
  const raw = new Float32Array(W * H), conf = new Uint8Array(W * H), rgb = new Uint8Array(W * H * 3), obj = new Uint16Array(W * H);
  const beam = s.beam;
  const keepSub = beam.subs;
  beam.subs = [[0, 0, 1]];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = ((i + 0.5) / W * 2 - 1) * tx, y = (1 - (j + 0.5) / H * 2) * ty;
    const l = 1 / Math.sqrt(x * x + y * y + 1);
    const k = shootPixel(s, pose, -x * l, y * l, l, m.t, j, i);
    if (k >= 0) {
      const id = j * W + i;
      raw[id] = sink.ls[k * 3 + 2];
      conf[id] = sink.i[k] > 3 ? 2 : 1;
      rgb[id * 3] = sink.rgb[k * 3]; rgb[id * 3 + 1] = sink.rgb[k * 3 + 1]; rgb[id * 3 + 2] = sink.rgb[k * 3 + 2];
      obj[id] = sink.obj[k];
    }
  }
  beam.subs = keepSub;
  sink.n = 0;
  const depth = fuse(raw, conf, W, H);
  return {
    msg: { w: W, h: H, depth, conf, rgb, obj, dots },
    transfer: [depth.buffer, conf.buffer, rgb.buffer, obj.buffer, ...PointSink.transferables(dots)],
  };
}

// Nachbildung der Tiefenfusion: dünne Strukturen entfernen, Kanten glätten, kleine Löcher füllen
function fuse(raw, conf, W, H) {
  const at = (i, j) => raw[j * W + i];
  const a = new Float32Array(raw);
  // dünne Vordergrund-Strukturen (≤ 2 px) verschwinden: links/rechts oder oben/unten deutlich weiter
  for (let j = 2; j < H - 2; j++) for (let i = 2; i < W - 2; i++) {
    const d = at(i, j);
    if (!d) continue;
    const l = at(i - 2, j), r = at(i + 2, j), u = at(i, j - 2), b = at(i, j + 2);
    const th = 0.06 + d * 0.03;
    if (l && r && l - d > th && r - d > th) a[j * W + i] = (l + r) / 2;
    else if (u && b && u - d > th && b - d > th) a[j * W + i] = (u + b) / 2;
  }
  // kantenerhaltende Glättung (5 × 5), an Sprüngen weicher Übergang wie bei der KI-Verrechnung
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = a[j * W + i];
    let sw = 0, sv = 0, n = 0, fill = 0;
    for (let dj = -2; dj <= 2; dj++) {
      const jj = j + dj; if (jj < 0 || jj >= H) continue;
      for (let di = -2; di <= 2; di++) {
        const ii = i + di; if (ii < 0 || ii >= W) continue;
        const v = a[jj * W + ii];
        if (!v) continue;
        n++; fill += v;
        if (!c) continue;
        const dd = (v - c) / (0.02 + 0.015 * c);
        const w = Math.exp(-(di * di + dj * dj) / 4.5) * (1 / (1 + dd * dd * 0.6));
        sw += w; sv += w * v;
      }
    }
    if (c) out[j * W + i] = sv / sw;
    else if (n >= 14) { out[j * W + i] = fill / n; conf[j * W + i] = 0; } // kleine Löcher füllen (niedrige Konfidenz)
  }
  return out;
}
