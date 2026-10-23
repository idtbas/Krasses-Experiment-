// Gerät: Einstellungen des verbundenen Scanners und Datenblatt
import { h, field, select, seg, slider, toggle, fmtInt } from '../../ui/dom.js';
import { RETURN_NAMES, fmtPrice, CLASSES } from '../../scanners/catalog.js';
import { makePattern } from '../../scanners/patterns.js';
import { datasheet } from '../../ui/catalog.js';

export function render(f, P) {
  const d = f.dev, a = f.app;
  if (!d) return;
  const s = d.spec, p = s.pattern;
  P.appendChild(h('div.row', h('div', h('div', { style: { fontWeight: 600, fontSize: '14px' } }, `${s.maker} ${s.model}`), h('div.muted', `${CLASSES[s.cls].name} · ${s.wavelength} nm · ${fmtPrice(s.price)}`)), h('div.grow'), (() => { const b = h('button.btn.small', 'Datenblatt'); b.addEventListener('click', () => datasheet(a, s)); return b; })()));
  const apply = (patch) => { d.configure(patch); f.render(); };
  if (p.hzOptions) P.appendChild(field('Drehzahl', seg(p.hzOptions.map((hz) => [hz, `${hz} Hz`]), d.set.hz, (v) => apply({ hz: v }))));
  if (Array.isArray(p.cols)) P.appendChild(field('Spalten', seg([...new Set(p.cols)].map((c) => [c, String(c)]), d.set.cols, (v) => apply({ cols: v }))));
  if (s.returns.length > 1) P.appendChild(field('Echos', select(s.returns.map((r) => [r, RETURN_NAMES[r]]), d.set.returns, (v) => apply({ returns: v }))));
  P.appendChild(field('Strahlmodell', seg([[1, 'Schnell'], [3, 'Standard'], [5, 'Fein'], [13, 'Präzise']], d.set.subrays, (v) => apply({ subrays: v }))));
  if (p.type === 'spin' && (s.data.fovH === 360)) {
    const opts = [['all', '360°'], ['front', 'vorn 180°'], ['f90', 'vorn 90°']];
    const cur = !d.set.fov ? 'all' : d.set.fov[1] - d.set.fov[0] > 100 ? 'front' : 'f90';
    P.appendChild(field('Sichtfeld', seg(opts, cur, (v) => apply({ fov: v === 'all' ? null : v === 'front' ? [-90, 90] : [-45, 45] }))));
  }
  if (p.type === 'rosette' || p.type === 'dome') P.appendChild(field('Integration', seg([[0.1, '0,1 s'], [0.5, '0,5 s'], [1, '1 s'], [2, '2 s']], d.set.persistence || 0.1, (v) => apply({ persistence: v }))));
  if (p.type === 'tls') {
    P.appendChild(field('Auflösung', seg(p.resolutions.map((r, i) => [r, `${p.resNames[i]}`]), d.set.resolution, (v) => apply({ resolution: v }))));
    P.appendChild(field('Qualität', seg([[1, '1×'], [2, '2×'], [4, '4×']], d.set.quality || 1, (v) => apply({ quality: v }))));
    P.appendChild(field('Punktbudget', seg([[1e6, '1 Mio.'], [3e6, '3 Mio.'], [6e6, '6 Mio.']], d.set.budget, (v) => apply({ budget: v }))));
    const pat = makePattern(s, d.set);
    const dec = Math.max(1, Math.ceil(Math.sqrt(pat.nominalPoints / d.set.budget)));
    P.appendChild(h('div.kv', h('span', 'Punkte (Gerät)'), h('b', fmtInt(pat.nominalPoints)), h('span', 'Simuliert'), h('b', `${fmtInt(pat.nominalPoints / (dec * dec))} (1:${dec * dec})`), h('span', 'Scanzeit am Gerät'), h('b', `${Math.round(pat.duration * (d.set.quality || 1))} s`), h('span', 'Spiegeldrehzahl'), h('b', `${pat.mirrorHz.toFixed(0)} U/s`)));
  }
  if (p.type === 'flash') {
    if (p.modes) P.appendChild(field('Modus', seg(Object.keys(p.modes).map((k) => [k, k.toUpperCase()]), d.set.depthMode || 'nfov', (v) => apply({ depthMode: v }))));
    P.appendChild(field('Vorschau', seg([[2, '1/2'], [4, '1/4'], [8, '1/8']], d.set.decimate || 4, (v) => apply({ decimate: v }))));
  }
  if (s.camera) P.appendChild(field('Kamerafarbe', toggle('Punkte einfärben (RGB)', !!d.set.color, (v) => apply({ color: v }))));
  P.appendChild(h('div.sep'));
  const pat = d.pattern;
  P.appendChild(h('div.kv',
    h('span', 'Schüsse je Sekunde'), h('b', fmtInt(pat.rate || 0)),
    h('span', 'Bildperiode'), h('b', `${((pat.period || 0) * 1000).toFixed(1)} ms`),
    pat.rows ? h('span', 'Abstandsbild') : null, pat.rows ? h('b', `${pat.rows} × ${pat.cols}`) : null,
    h('span', 'Reichweite @ 10 %'), h('b', `${s.phys.r10} m`),
    h('span', 'Mindestabstand'), h('b', `${s.phys.rangeMin} m`),
    h('span', 'Rauschen 1σ'), h('b', s.phys.sigma >= 0.01 ? `${(s.phys.sigma * 100).toFixed(1)} cm` : `${(s.phys.sigma * 1000).toFixed(2)} mm`),
    h('span', 'Firmware'), h('b', `ECHO-SIM ${s.id}.${s.wavelength}`)));
  void slider;
}
