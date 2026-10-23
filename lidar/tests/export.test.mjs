// Dateiformate zurücklesen. node lidar/tests/export.test.mjs
import assert from 'node:assert/strict';
import { writeLAS, writePLY, writePCD, writeVelodynePCAP, writeSTL } from '../js/cloud/export.js';
import { BY_ID } from '../js/scanners/catalog.js';

const n = 1000;
const d = { n, pos: new Float32Array(n * 3), rgb: new Uint8Array(n * 3), i: new Uint8Array(n), meta: new Uint8Array(n * 4), t: new Float32Array(n) };
for (let k = 0; k < n; k++) { d.pos[k * 3] = 1 + k * 0.01; d.pos[k * 3 + 1] = 0.5; d.pos[k * 3 + 2] = -2 - k * 0.002; d.rgb[k * 3] = k % 256; d.i[k] = 50; d.meta[k * 4] = 1 | (1 << 4); d.meta[k * 4 + 1] = 2; d.t[k] = k * 0.001; }

// LAS
{
  const buf = new DataView(await writeLAS(d, { axis: 'zup' }).arrayBuffer());
  assert.equal(String.fromCharCode(buf.getUint8(0), buf.getUint8(1), buf.getUint8(2), buf.getUint8(3)), 'LASF');
  assert.equal(buf.getUint8(24), 1); assert.equal(buf.getUint8(25), 2);
  assert.equal(buf.getUint16(94, true), 227); assert.equal(buf.getUint32(96, true), 227);
  assert.equal(buf.getUint8(104), 3); assert.equal(buf.getUint16(105, true), 34); assert.equal(buf.getUint32(107, true), n);
  const sx = buf.getFloat64(131, true), ox = buf.getFloat64(155, true), oy = buf.getFloat64(163, true), oz = buf.getFloat64(171, true);
  const X = buf.getInt32(227, true) * sx + ox, Y = buf.getInt32(231, true) * sx + oy, Z = buf.getInt32(235, true) * sx + oz;
  assert.ok(Math.abs(X - 1) < 1e-4 && Math.abs(Y - 2) < 1e-4 && Math.abs(Z - 0.5) < 1e-4, `LAS-Punkt ${X} ${Y} ${Z}`);
  assert.equal(buf.byteLength, 227 + 34 * n);
  const cls = buf.getUint8(227 + 15);
  assert.equal(cls, 2);
  console.log('✓ LAS 1.2 / PDRF 3: Kopf, Skalierung, Achsen (Z oben), Klasse');
}
// PLY und PCD
{
  const t = new TextDecoder().decode(new Uint8Array(await writePLY(d).arrayBuffer()).slice(0, 400));
  assert.ok(t.startsWith('ply\nformat binary_little_endian 1.0') && t.includes(`element vertex ${n}`));
  const p = new TextDecoder().decode(new Uint8Array(await writePCD(d).arrayBuffer()).slice(0, 400));
  assert.ok(p.includes('VERSION 0.7') && p.includes(`POINTS ${n}`) && p.includes('DATA binary'));
  console.log('✓ PLY- und PCD-Kopf');
}
// STL
{
  const m = { pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), index: new Uint32Array([0, 1, 2]) };
  const b = new DataView(await writeSTL(m).arrayBuffer());
  assert.equal(b.byteLength, 84 + 50); assert.equal(b.getUint32(80, true), 1);
  console.log('✓ STL binär');
}
// Velodyne-PCAP: 16 Kanäle, 2 Feuerfolgen je Block
{
  const spec = BY_ID.vlp16;
  const cyc = spec.pattern.cycleUs * 1e-6;
  const m = 16 * 240;
  const raw = { n: m, ls: new Float32Array(m * 3), ring: new Uint16Array(m), t: new Float64Array(m), i: new Uint8Array(m).fill(77), ret: new Uint8Array(m).fill(17) };
  for (let c = 0; c < 240; c++) for (let ch = 0; ch < 16; ch++) { const k = c * 16 + ch; raw.ring[k] = ch; raw.t[k] = c * cyc + ch * 2.304e-6; raw.ls[k * 3 + 2] = 10 + ch * 0.01; }
  const b = new DataView(await writeVelodynePCAP(raw, spec).arrayBuffer());
  assert.equal(b.getUint32(0, true), 0xa1b2c3d4);
  assert.equal(b.getUint32(20, true), 1);
  const pk = 24;
  assert.equal(b.getUint32(pk + 8, true), 1248);
  const pl = pk + 16 + 42; // Nutzdaten
  assert.equal(b.getUint8(pl), 0xff); assert.equal(b.getUint8(pl + 1), 0xee);
  const dist0 = b.getUint16(pl + 4, true) * 0.002, dist1 = b.getUint16(pl + 7, true) * 0.002;
  assert.ok(Math.abs(dist0 - 10) < 0.003 && Math.abs(dist1 - 10.01) < 0.003, `Entfernung ${dist0} ${dist1}`);
  assert.equal(b.getUint8(pl + 2 + 2 + 2), 77); // Flag, Azimut, Entfernung, dann Reflektivität
  assert.equal(b.getUint8(pl + 1204), 0x37); assert.equal(b.getUint8(pl + 1205), 0x22);
  // IPv4-Prüfsumme muss 0 ergeben
  let s = 0; for (let i = 0; i < 20; i += 2) s += b.getUint16(pk + 16 + 14 + i, false);
  while (s >> 16) s = (s & 0xffff) + (s >> 16);
  assert.equal(s, 0xffff);
  assert.equal(b.byteLength, 24 + 10 * (16 + 1248));
  console.log('✓ Velodyne-PCAP: Paketaufbau, Entfernungen (2 mm), Reflektivität, Werksbytes, IP-Prüfsumme');
}
