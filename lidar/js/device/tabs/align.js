// Ausrichten (Registrierung): Stationen per Wolke-zu-Wolke-ICP (Punkt-zu-Ebene) verbinden
import * as THREE from 'three';
import { h, toast, fmtInt } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { subsample } from '../../cloud/proc.js';

function poseError(est, truth) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), s = new THREE.Vector3();
  est.decompose(a, qa, s); truth.decompose(b, qb, s);
  return { t: a.distanceTo(b), r: qa.angleTo(qb) * 180 / Math.PI };
}

export function render(f, P) {
  const a = f.app;
  const st = a.project.scans.filter((s) => s.kind === 'station' || s.kind === 'mobile');
  if (st.length < 2) {
    P.appendChild(h('div.empty', 'Zum Ausrichten werden mindestens zwei Scans gebraucht. Mit einem terrestrischen Scanner mehrere Standorte scannen – jede neue Station ist nur grob vorausgerichtet (wie mit Kompass und Neigungssensor) und wird hier per ICP millimetergenau eingepasst.'));
    return;
  }
  const row = h('div.row.wrap');
  const go = h('button.btn.primary', { html: icon('align') + '<span>Alle ausrichten (ICP)</span>' });
  go.addEventListener('click', () => runAll(f));
  row.append(go, h('div.grow'), h('span.muted', 'Wolke-zu-Wolke, Punkt-zu-Ebene'));
  P.appendChild(row);
  f._alignStatus = h('div.mono.muted', { style: { fontSize: '11.5px', minHeight: '16px' } }, f._alignMsg || '');
  P.appendChild(f._alignStatus);
  const t = h('table.t', h('thead', h('tr', h('th', 'Scan'), h('th', 'Status'), h('th', 'RMS'), h('th', 'Überl.'), h('th', 'Kontrolle (Sim.)'))));
  const tb = h('tbody');
  for (const s of st) {
    const err = poseError(s.pose, s.truePose);
    const r = s.reg;
    tb.appendChild(h('tr',
      h('td', s.name),
      h('td', { html: s.registered ? '<span class="chip ok">ausgerichtet</span>' : '<span class="chip warn">vorausgerichtet</span>' }),
      h('td', r ? `${(r.rms * 1000).toFixed(1)} mm` : '–'),
      h('td', r ? `${Math.round(r.overlap * 100)} %` : '–'),
      h('td', `${(err.t * 1000).toFixed(1)} mm / ${err.r.toFixed(3)}°`)));
  }
  t.appendChild(tb);
  P.appendChild(t);
  P.appendChild(h('p.muted', { style: { fontSize: '11.5px', margin: 0 } }, '„Kontrolle“ zeigt den Restfehler gegenüber der wahren Position – im echten Feld kennt man ihn nicht und prüft stattdessen mit Passpunkten (Kugeln, Zielmarken).'));
}

async function runAll(f) {
  const a = f.app, proc = a.proc;
  const scans = a.project.scans.filter((s) => s.kind === 'station' || s.kind === 'mobile');
  if (!scans.some((s) => s.registered)) scans[0].registered = true;
  const say = (m) => { f._alignMsg = m; if (f._alignStatus) f._alignStatus.textContent = m; };
  for (const s of scans) {
    if (s.registered) continue;
    // Ziel: alle bereits ausgerichteten Scans (Weltkoordinaten, ausgedünnt)
    const parts = scans.filter((x) => x.registered).map((x) => subsample(x.cloud.gather().pos, 350000 / Math.max(1, scans.filter((y) => y.registered).length)));
    const tlen = parts.reduce((q, p) => q + p.length, 0);
    const tgt = new Float32Array(tlen); let o = 0; for (const p of parts) { tgt.set(p, o); o += p.length; }
    const src = subsample(s.cloud.gather().pos, 25000);
    const before = poseError(s.pose, s.truePose);
    say(`${s.name}: ICP läuft … (Vorausrichtung ${(before.t * 100).toFixed(1)} cm / ${before.r.toFixed(2)}°)`);
    const t0 = performance.now();
    try {
      const r = await proc.run('icp', { src, tgt, init: new THREE.Matrix4().identity().elements, opts: {} }, [src.buffer, tgt.buffer]);
      const T = new THREE.Matrix4().fromArray(r.T);
      s.setPose(T.multiply(s.pose));
      if (!s.local) { s.cloud.group.matrixAutoUpdate = false; s.cloud.group.matrix.copy(new THREE.Matrix4().fromArray(r.T)); }
      s.registered = r.overlap > 0.15;
      s.reg = { rms: r.rms, overlap: r.overlap, iters: r.iters, ms: performance.now() - t0 };
      const after = poseError(s.pose, s.truePose);
      say(`${s.name}: RMS ${(r.rms * 1000).toFixed(1)} mm, Überlappung ${Math.round(r.overlap * 100)} %, ${r.iters} Iterationen, ${fmtInt(performance.now() - t0)} ms`);
      toast(`${s.name} ausgerichtet: Restfehler ${(after.t * 1000).toFixed(1)} mm`, s.registered ? 'ok' : 'warn');
    } catch (e) { say('Fehler: ' + e.message); }
  }
  f.render();
}
