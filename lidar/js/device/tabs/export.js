// Export: Punktwolken (LAS, PLY, PCD, XYZ, CSV), Netze (OBJ, STL, PLY), Rohdaten (Velodyne-PCAP)
import { h, seg, toggle, toast, fmtInt, fmtBytes } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { writeLAS, writePLY, writePCD, writeXYZ, writeOBJ, writeSTL, writeMeshPLY, writeVelodynePCAP, download } from '../../cloud/export.js';

const PFORMATS = [
  ['las', 'LAS 1.2', 'Vermessung, GIS, CloudCompare – Punktformat 3 mit Farbe, Echo, Klasse, Zeit', 34],
  ['ply', 'PLY (binär)', 'Universell (MeshLab, Blender, CloudCompare)', 27],
  ['pcd', 'PCD', 'PCL / ROS (x y z intensity ring time)', 30],
  ['xyz', 'XYZ (Text)', 'x y z r g b Intensität', 52],
  ['csv', 'CSV', 'alle Attribute als Tabelle', 70],
];
const MFORMATS = [['obj', 'OBJ (mit Eckfarben)'], ['stl', 'STL (binär)'], ['mply', 'PLY-Netz']];

export function render(f, P) {
  const a = f.app;
  f.xo = f.xo || { fmt: 'las', axis: 'zup', merge: true, only: 'visible', mfmt: 'obj' };
  const X = f.xo;
  const scans = a.project.scans.filter((s) => s.points && s.kind !== 'mesh');
  P.appendChild(h('h4', 'Punktwolke'));
  if (!scans.length) P.appendChild(h('div.empty', 'Noch nichts zu exportieren.'));
  else {
    P.appendChild(h('div.field', h('label', 'Format'), seg(PFORMATS.map((p) => [p[0], p[1]]), X.fmt, (v) => { X.fmt = v; f.render(); })));
    const pf = PFORMATS.find((p) => p[0] === X.fmt);
    P.appendChild(h('div.muted', { style: { fontSize: '11.5px', marginTop: '-4px' } }, pf[2]));
    P.appendChild(h('div.field', h('label', 'Achsen'), seg([['zup', 'Z oben (Vermessung/ROS)'], ['yup', 'Y oben (3D-Grafik)']], X.axis, (v) => { X.axis = v; })));
    P.appendChild(h('div.field', h('label', 'Umfang'), seg([['visible', 'sichtbare Scans'], ['selected', 'nur gewählter'], ['all', 'alle']], X.only, (v) => { X.only = v; f.render(); })));
    P.appendChild(h('div.field', h('label', 'Dateien'), toggle('zu einer Datei zusammenführen', X.merge, (v) => { X.merge = v; })));
    const list = pick(f, scans);
    const n = list.reduce((q, s) => q + s.points, 0);
    const b = h('button.btn.primary', { html: icon('export') + (list.length ? `<span>Exportieren · ${fmtInt(n)} Punkte · ≈ ${fmtBytes(n * pf[3])}</span>` : '<span>Keine sichtbaren Scans – Umfang „alle“ wählen</span>') });
    if (!list.length) b.disabled = true;
    b.addEventListener('click', () => exportPoints(f, list));
    P.appendChild(b);
  }
  // Netze aus „Bearbeiten → Vernetzen“ und Objektmodelle aus dem Modell-Tab (Räume dort mit Grundriss exportieren)
  const meshes = [...(a.project.meshes || []), ...(a.project.models || []).filter((m) => m.data && !m.room).map((m) => ({ name: m.name, data: m.data }))];
  P.appendChild(h('h4', 'Netze'));
  if (!meshes.length) P.appendChild(h('div.empty', 'Kein Netz vorhanden – im Tab „Modell“ ein 3D-Modell erstellen.'));
  else {
    P.appendChild(h('div.field', h('label', 'Format'), seg(MFORMATS, X.mfmt, (v) => { X.mfmt = v; })));
    for (const m of meshes) {
      const b = h('button.btn', { html: icon('mesh') + `<span>${m.name} · ${fmtInt(m.data.index.length / 3)} Dreiecke</span>` });
      b.addEventListener('click', () => {
        const blob = X.mfmt === 'stl' ? writeSTL(m.data, { axis: X.axis }) : X.mfmt === 'mply' ? writeMeshPLY(m.data, { axis: X.axis }) : writeOBJ(m.data, { axis: X.axis });
        download(blob, safe(m.name) + (X.mfmt === 'stl' ? '.stl' : X.mfmt === 'mply' ? '.ply' : '.obj'));
        toast(`${m.name} exportiert (${fmtBytes(blob.size)})`, 'ok');
      });
      P.appendChild(b);
    }
  }
  const raws = a.project.scans.filter((s) => s.raw && s.raw.length);
  P.appendChild(h('h4', 'Rohdaten'));
  if (!raws.length) P.appendChild(h('div.empty', 'Rohpakete entstehen bei Aufnahmen mit Velodyne-Sensoren (VLP-16, Puck Hi-Res, VLP-32C, HDL-32E).'));
  for (const s of raws) {
    const b = h('button.btn', { html: icon('doc') + `<span>${s.name} als Velodyne-PCAP (VeloView)</span>` });
    b.addEventListener('click', () => {
      const n = s.raw.reduce((q, r) => q + r.n, 0);
      const raw = { n, ls: new Float32Array(n * 3), ring: new Uint16Array(n), t: new Float64Array(n), i: new Uint8Array(n), ret: new Uint8Array(n) };
      let o = 0;
      for (const r of s.raw) { raw.ls.set(r.ls, o * 3); raw.ring.set(r.ring, o); raw.t.set(r.t, o); raw.i.set(r.i, o); raw.ret.set(r.ret, o); o += r.n; }
      const blob = writeVelodynePCAP(raw, s.spec, { hz: s.set.hz });
      download(blob, safe(s.name) + '.pcap');
      toast(`PCAP mit ${fmtInt(blob.size / 1264)} UDP-Paketen exportiert`, 'ok');
    });
    P.appendChild(b);
  }
}

function pick(f, scans) {
  const X = f.xo;
  if (X.only === 'selected') return f.selScan && scans.includes(f.selScan) ? [f.selScan] : scans.slice(-1);
  if (X.only === 'all') return scans;
  return scans.filter((s) => s.visible);
}
const safe = (s) => s.replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '_') || 'scan';

function exportPoints(f, list) {
  const X = f.xo;
  const write = (d, name) => {
    const opts = { axis: X.axis };
    const blob = X.fmt === 'las' ? writeLAS(d, opts) : X.fmt === 'ply' ? writePLY(d, opts) : X.fmt === 'pcd' ? writePCD(d, opts) : writeXYZ(d, { ...opts, csv: X.fmt === 'csv' });
    download(blob, safe(name) + '.' + (X.fmt === 'csv' ? 'csv' : X.fmt));
    return blob.size;
  };
  if (!list.length) return;
  let bytes = 0;
  if (X.merge && list.length > 1) {
    const parts = list.map((s) => s.cloud.gather());
    const n = parts.reduce((q, p) => q + p.n, 0);
    const d = { n, pos: new Float32Array(n * 3), rgb: new Uint8Array(n * 3), i: new Uint8Array(n), meta: new Uint8Array(n * 4), t: new Float32Array(n) };
    let o = 0;
    for (const p of parts) { d.pos.set(p.pos, o * 3); d.rgb.set(p.rgb, o * 3); d.i.set(p.i, o); d.meta.set(p.meta, o * 4); d.t.set(p.t, o); o += p.n; }
    bytes = write(d, f.app.project.name);
  } else for (const s of list) bytes += write(s.cloud.gather(), s.name);
  toast(`Export fertig: ${fmtBytes(bytes)}`, 'ok');
}
