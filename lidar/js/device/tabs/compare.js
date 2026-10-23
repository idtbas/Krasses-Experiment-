// Soll-Ist-Vergleich: Abstand Scan → Sollgeometrie (Netz des Objekts, vorzeichenbehaftet) oder Scan → Scan
import * as THREE from 'three';
import { h, seg, select, toast, fmtInt } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { trianglesOf } from '../../cloud/proc.js';

export function render(f, P) {
  const a = f.app;
  f.cmp = f.cmp || { ref: 'soll', other: null, range: 0.02 };
  const C = f.cmp;
  const scans = a.project.scans.filter((s) => s.points && s.kind !== 'mesh');
  if (!scans.length) { P.appendChild(h('div.empty', 'Zuerst scannen. Am besten ein Objekt ausschneiden (Bearbeiten → Auf Objekt zuschneiden) und mit seiner Sollgeometrie vergleichen.')); return; }
  if (!scans.includes(f.selScan)) f.selScan = scans[scans.length - 1];
  P.appendChild(h('div.field', h('label', 'Ist (Scan)'), select(scans.map((x) => [x.id, `${x.name} · ${fmtInt(x.points)}`]), f.selScan.id, (v) => { f.selScan = scans.find((x) => x.id === Number(v)); f.render(); })));
  P.appendChild(h('div.field', h('label', 'Soll'), seg([['soll', 'Sollgeometrie (Objekt)'], ['scan', 'anderer Scan']], C.ref, (v) => { C.ref = v; f.render(); })));
  const obj = f.selScan.ref || a.selected;
  if (C.ref === 'soll') P.appendChild(h('div.muted', { style: { fontSize: '12px' } }, obj ? `Sollgeometrie: „${obj.name}“ (exaktes Modell aus der Szene)` : 'Objekt in der 3D-Szene antippen (Werkzeug „Auswählen“), um seine Sollgeometrie zu verwenden.'));
  else {
    const others = scans.filter((x) => x !== f.selScan);
    if (!others.includes(C.other)) C.other = others[0] || null;
    if (C.other) P.appendChild(h('div.field', h('label', 'Referenz-Scan'), select(others.map((x) => [x.id, x.name]), C.other.id, (v) => { C.other = others.find((x) => x.id === Number(v)); })));
  }
  P.appendChild(h('div.field', h('label', 'Farbskala'), seg([[0.002, '±2 mm'], [0.005, '±5 mm'], [0.01, '±1 cm'], [0.02, '±2 cm'], [0.05, '±5 cm']], C.range, (v) => { C.range = v; f.opts.dRange = [-v, v]; f.updateLegend(); })));
  const go = h('button.btn.primary', { html: icon('compare') + '<span>Abweichung berechnen</span>' });
  go.addEventListener('click', () => run(f));
  P.appendChild(h('div.row', go, h('div.grow'), f._cmpMsg = h('span.mono.muted', { style: { fontSize: '11.5px' } }, '')));
  if (C.result) {
    const R = C.result;
    P.appendChild(h('div.fgrid',
      h('div.stat', h('span', 'Mittel'), h('b', `${(R.mean * 1000).toFixed(2)} mm`)),
      h('div.stat', h('span', 'Standardabw.'), h('b', `${(R.sd * 1000).toFixed(2)} mm`)),
      h('div.stat', h('span', 'RMS'), h('b', `${(R.rms * 1000).toFixed(2)} mm`)),
      h('div.stat', h('span', '95 % innerhalb'), h('b', `±${(R.p95 * 1000).toFixed(1)} mm`)),
      h('div.stat', h('span', 'Max. |Abw.|'), h('b', `${(R.max * 1000).toFixed(1)} mm`)),
      h('div.stat', h('span', 'Punkte'), h('b', fmtInt(R.n)))));
    const cv = h('canvas', { width: 480, height: 110, style: { width: '100%', height: '110px', background: '#07090c', borderRadius: '6px' } });
    P.appendChild(cv);
    drawHist(cv, R);
    P.appendChild(h('div.muted', { style: { fontSize: '11.5px' } }, `${R.label}. Positiv = Punkt liegt außerhalb der Sollfläche.`));
  }
}

export async function run(f) {
  const a = f.app, C = f.cmp, s = f.selScan;
  const say = (t) => { if (f._cmpMsg) f._cmpMsg.textContent = t; };
  const g = s.cloud.gather();
  let d, label;
  const t0 = performance.now();
  if (C.ref === 'soll') {
    const obj = s.ref || a.selected;
    if (!obj) { toast('Bitte zuerst ein Objekt in der Szene wählen.', 'warn'); return; }
    const tris = trianglesOf(obj.root);
    say(`Abstand zu ${fmtInt(tris.length / 9)} Dreiecken …`);
    // nur Punkte in der Nähe des Objekts
    const box = new THREE.Box3().setFromObject(obj.root).expandByScalar(0.1);
    const idx = [];
    for (let k = 0; k < g.n; k++) if (box.containsPoint(new THREE.Vector3(g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]))) idx.push(k);
    const pts = new Float32Array(idx.length * 3);
    idx.forEach((k, j) => { pts[j * 3] = g.pos[k * 3]; pts[j * 3 + 1] = g.pos[k * 3 + 1]; pts[j * 3 + 2] = g.pos[k * 3 + 2]; });
    const r = await a.proc.run('c2m', { pts, tris, maxD: 0.25 }, [pts.buffer, tris.buffer]);
    d = new Float32Array(g.n).fill(1e9);
    idx.forEach((k, j) => { d[k] = r.d[j]; });
    label = `Wolke → Netz „${obj.name}“`;
  } else {
    if (!C.other) return;
    const b = C.other.cloud.gather();
    say('Abstand Wolke → Wolke …');
    const r = await a.proc.run('c2c', { a: g.pos.slice(), b: b.pos }, []);
    d = r.d;
    label = `Wolke → Wolke „${C.other.name}“ (ohne Vorzeichen)`;
  }
  // Abweichung in die Wolke schreiben (Reihenfolge wie gather)
  let o = 0;
  for (const ch of s.cloud.chunks) {
    const dv = ch.ensureDev();
    for (let i = 0; i < ch.n; i++) dv[i] = d[o++];
    ch.geo.attributes.dev.needsUpdate = true;
  }
  // Statistik
  const v = []; for (const x of d) if (x < 1e8) v.push(x);
  if (!v.length) { say('Keine Punkte in der Nähe der Sollgeometrie.'); return; }
  const n = v.length; let m = 0, q = 0, mx = 0;
  for (const x of v) { m += x; q += x * x; mx = Math.max(mx, Math.abs(x)); }
  m /= n;
  const sd = Math.sqrt(Math.max(0, q / n - m * m));
  const abs = v.map(Math.abs).sort((x, y) => x - y);
  C.result = { mean: m, sd, rms: Math.sqrt(q / n), p95: abs[Math.floor(n * 0.95)], max: mx, n, values: v, range: C.range, label };
  f.opts.mode = 'deviation';
  f.opts.dRange = [-C.range, C.range];
  for (const x of a.project.scans) if (x !== s) x.visible = false;
  s.visible = true;
  say(`fertig in ${fmtInt(performance.now() - t0)} ms`);
  f.render();
}

function drawHist(cv, R) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const bins = 60, lo = -R.range * 1.5, hi = R.range * 1.5;
  const c = new Array(bins).fill(0);
  for (const x of R.values) { const b = Math.floor((x - lo) / (hi - lo) * bins); if (b >= 0 && b < bins) c[b]++; }
  const mx = Math.max(...c, 1);
  g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
  for (let b = 0; b < bins; b++) {
    const t = (b + 0.5) / bins, x = b * W / bins, h = (c[b] / mx) * (H - 22);
    const u = Math.min(1, Math.max(0, (t - 0.1667) / 0.6667));
    g.fillStyle = u < 0.5 ? `rgb(${31 + 440 * u},${81 + 340 * u},${217 + 66 * u})` : `rgb(${250 - 26 * (u - 0.5) * 2},${250 - 199 * (u - 0.5) * 2},${250 - 208 * (u - 0.5) * 2})`;
    g.fillRect(x + 1, H - 16 - h, W / bins - 2, h);
  }
  g.fillStyle = '#8c98a5'; g.font = '10px ui-monospace, monospace';
  g.fillText(`${(lo * 1000).toFixed(0)} mm`, 2, H - 3); g.fillText('0', W / 2 - 3, H - 3); g.fillText(`+${(hi * 1000).toFixed(0)} mm`, W - 46, H - 3);
  g.strokeStyle = '#35d0ff'; g.beginPath(); const mxp = (R.mean - lo) / (hi - lo) * W; g.moveTo(mxp, 4); g.lineTo(mxp, H - 16); g.stroke();
}
