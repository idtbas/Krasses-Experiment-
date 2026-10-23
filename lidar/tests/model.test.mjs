// Tests der Modellbildung: Raum mit Tür und Fenster aus simulierten Laserstrahlen, Netzglättung. node lidar/tests/model.test.mjs
import assert from 'node:assert/strict';
import { roomModel, meshPost } from '../js/cloud/model.js';
import { tsdfMesh } from '../js/cloud/procworker.js';

let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// Raum 6 × 4 m, 2,6 m hoch, um 17° gedreht. Tür (0,9 × 2,0 m) in der Wand z = +2, Fenster (1,2 × 1,2 m ab 0,9 m) in x = +3.
// Strahlen vom Scanner (1,5 m hoch); durch Tür und Fenster treffen sie eine Außenhülle 10 m weiter.
function scanRoom(nRays, origin) {
  const ang = 17 * Math.PI / 180, c = Math.cos(ang), s = Math.sin(ang);
  const X = 3, Z = 2, Y = 2.6;
  const out = [];
  for (let k = 0; k < nRays; k++) {
    let dx = gauss(), dy = gauss() * 0.6, dz = gauss();
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const [ox, oy, oz] = origin;
    // Austritt aus dem inneren Quader (lokales System)
    const t = Math.min(dx > 0 ? (X - ox) / dx : dx < 0 ? (-X - ox) / dx : Infinity, dy > 0 ? (Y - oy) / dy : dy < 0 ? (0 - oy) / dy : Infinity, dz > 0 ? (Z - oz) / dz : dz < 0 ? (-Z - oz) / dz : Infinity);
    let hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
    const door = Math.abs(hz - Z) < 1e-6 && hx > 0.5 && hx < 1.4 && hy < 2.0;
    const win = Math.abs(hx - X) < 1e-6 && hz > -0.8 && hz < 0.4 && hy > 0.9 && hy < 2.1;
    if (door || win) {
      const t2 = Math.min(dx > 0 ? (X + 10 - ox) / dx : dx < 0 ? (-X - 10 - ox) / dx : Infinity, dz > 0 ? (Z + 10 - oz) / dz : dz < 0 ? (-Z - 10 - oz) / dz : Infinity, dy > 0 ? (Y - oy) / dy : dy < 0 ? (0 - oy) / dy : Infinity);
      hx = ox + dx * t2; hy = oy + dy * t2; hz = oz + dz * t2;
    }
    hx += gauss() * 0.004; hy += gauss() * 0.004; hz += gauss() * 0.004;
    out.push(c * hx - s * hz + 10, hy, s * hx + c * hz - 5);
  }
  const wo = [c * origin[0] - s * origin[2] + 10, origin[1], s * origin[0] + c * origin[2] - 5];
  return { pos: new Float32Array(out), origin: new Float32Array(wo) };
}

{
  const t0 = performance.now();
  const { pos, origin } = scanRoom(260000, [-0.6, 1.5, 0.4]);
  const r = roomModel(pos, new Uint16Array(pos.length / 3), origin);
  const ms = performance.now() - t0;
  assert.ok(!r.error, r.error);
  assert.ok(Math.abs(r.floor) < 0.02, `Boden ${r.floor}`);
  assert.ok(Math.abs(r.height - 2.6) < 0.03, `Raumhöhe ${r.height}`);
  assert.ok(Math.abs(r.area - 24) < 0.4, `Fläche ${r.area.toFixed(2)} m²`);
  assert.equal(r.walls.length, 4, 'vier Wände');
  const lens = r.walls.map((w) => w.len).sort((a, b) => a - b);
  assert.ok(Math.abs(lens[0] - 4) < 0.06 && Math.abs(lens[3] - 6) < 0.06, `Wandlängen ${lens.map((x) => x.toFixed(2))}`);
  const ops = r.walls.flatMap((w) => w.openings);
  const door = ops.find((q) => q.kind === 'tür'), win = ops.find((q) => q.kind === 'fenster');
  assert.ok(door, 'Tür erkannt');
  assert.ok(Math.abs(door.s1 - door.s0 - 0.9) < 0.2 && door.y1 > 1.8 && door.y1 < 2.2, `Tür ${JSON.stringify(door)}`);
  assert.ok(win, 'Fenster erkannt');
  assert.ok(Math.abs(win.s1 - win.s0 - 1.2) < 0.2 && Math.abs(win.y0 - 0.9) < 0.15 && Math.abs(win.y1 - 2.1) < 0.15, `Fenster ${JSON.stringify(win)}`);
  console.log(`Raum: ${r.area.toFixed(2)} m² · Höhe ${r.height.toFixed(2)} m · Wände ${lens.map((x) => x.toFixed(2)).join('/')} · Tür ${(door.s1 - door.s0).toFixed(2)} × ${(door.y1 - door.y0).toFixed(2)} · Fenster ${(win.s1 - win.s0).toFixed(2)} × ${(win.y1 - win.y0).toFixed(2)} · ${ms.toFixed(0)} ms`);
}

{
  // Kugel (r = 0,5 m) mit Rauschen + ein schwebender Splitter: Splitter verschwindet, Glättung senkt die Rauigkeit
  const pts = [];
  for (let k = 0; k < 120000; k++) {
    let x = gauss(), y = gauss(), z = gauss(); const l = Math.hypot(x, y, z); const r = 0.5 + gauss() * 0.006;
    pts.push(x / l * r, y / l * r + 1, z / l * r);
  }
  for (let k = 0; k < 300; k++) pts.push(1.4 + rnd() * 0.05, 1 + rnd() * 0.05, rnd() * 0.05);
  const pos = new Float32Array(pts), n = pos.length / 3;
  const rgb = new Float32Array(n * 3).fill(128);
  const m = tsdfMesh(pos, rgb, new Float32Array([0, 1, 3]), null, 0.02, 0.06, null);
  const rough = (P) => { let s = 0; const nv = P.length / 3; for (let i = 0; i < nv; i++) { const d = Math.hypot(P[i * 3], P[i * 3 + 1] - 1, P[i * 3 + 2]) - 0.5; s += d * d; } return Math.sqrt(s / nv); };
  const raw = meshPost(m.pos, m.rgb, m.index, { minPart: 0, minTris: 0, smooth: 0 });
  const post = meshPost(m.pos, m.rgb, m.index, { minPart: 0.02, smooth: 6 });
  assert.ok(post.dropped >= 1, 'Splitter entfernt');
  assert.ok(post.parts === 1, `ein Teil übrig (${post.parts})`);
  const far = (P) => { let c = 0; for (let i = 0; i < P.length / 3; i++) if (P[i * 3] > 1.2) c++; return c; };
  assert.equal(far(post.pos), 0, 'keine Eckpunkte am Splitter');
  assert.ok(far(raw.pos) > 0, 'ohne Aufräumen ist der Splitter da');
  const rr = rough(raw.pos), rp = rough(post.pos);
  assert.ok(rp < rr, `glatter (${(rr * 1000).toFixed(2)} → ${(rp * 1000).toFixed(2)} mm)`);
  assert.ok(Math.abs(rp) < 0.01, 'Kugel behält den Radius');
  console.log(`Netz: ${m.index.length / 3} → ${post.index.length / 3} Dreiecke, Abweichung ${(rr * 1000).toFixed(2)} → ${(rp * 1000).toFixed(2)} mm`);
}
console.log('model ok');
