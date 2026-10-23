// Prüft die Abtastmuster gegen die Datenblattwerte. node lidar/tests/patterns.test.mjs
import { SCANNERS } from '../js/scanners/catalog.js';
import { makePattern } from '../js/scanners/patterns.js';
let bad = 0;
for (const s of SCANNERS) {
  const p = makePattern(s, Array.isArray(s.pattern.cols) ? { cols: Math.max(...s.pattern.cols) } : {}); // Datenblatt nennt den Höchstmodus
  let n = 0, minEl = 99, maxEl = -99, minAz = 999, maxAz = -999;
  const dur = s.pattern.type === 'tls' ? 0 : 0.5;
  if (s.pattern.type === 'tls') {
    n = p.columns(0, p.cols, () => {});
    console.log(`${s.id.padEnd(11)} TLS  Spalten ${p.cols}, Punkte (sim) ${n.toLocaleString('de-DE')}, nominal ${p.nominalPoints.toLocaleString('de-DE')}, Scanzeit ${p.duration.toFixed(0)} s, Spiegel ${p.mirrorHz.toFixed(0)} Hz`);
    continue;
  }
  p.shots(0, dur, (t, x, y, z) => {
    n++;
    const el = Math.asin(y) * 180 / Math.PI, az = Math.atan2(-x, z) * 180 / Math.PI;
    if (el < minEl) minEl = el; if (el > maxEl) maxEl = el; if (az < minAz) minAz = az; if (az > maxAz) maxAz = az;
    if (Math.abs(Math.hypot(x, y, z) - 1) > 1e-6) bad++;
  });
  const rate = n / dur;
  const ratio = rate / s.data.pts;
  const flag = Math.abs(ratio - 1) > 0.08 && !['phone', 'flash'].includes(s.pattern.type) ? '  ⚠' : '';
  if (flag) bad++;
  console.log(`${s.id.padEnd(11)} ${s.pattern.type.padEnd(7)} ${Math.round(rate).toLocaleString('de-DE').padStart(11)} Schuss/s (Datenblatt ${s.data.pts.toLocaleString('de-DE')})  El ${minEl.toFixed(1)}…${maxEl.toFixed(1)}  Az ${minAz.toFixed(0)}…${maxAz.toFixed(0)}${flag}`);
}
console.log(bad ? `✗ ${bad} Abweichungen` : '✓ alle Muster passen zum Datenblatt');
process.exit(bad ? 1 : 0);
