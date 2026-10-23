// Bearbeiten: Filter, Boden, Zuschneiden, Objekt isolieren, Vernetzen. Jede Operation erzeugt einen neuen Scan
// (zerstörungsfrei); das Original wird ausgeblendet.
import * as THREE from 'three';
import { h, seg, toast, fmtInt, select } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { derivedScan } from '../../cloud/project.js';
import { meshScan, addMeshToProject } from '../../cloud/meshing.js';
import { pickPoint } from './measure.js';

function current(f) {
  const L = f.app.project.scans.filter((s) => s.points && s.kind !== 'mesh');
  if (!L.includes(f.selScan)) f.selScan = L[L.length - 1] || null;
  return f.selScan;
}

export function render(f, P) {
  const a = f.app;
  const s = current(f);
  f.eopts = f.eopts || { voxel: 0.01, mesh: 0.02, sor: 2 };
  const E = f.eopts;
  if (!s) { P.appendChild(h('div.empty', 'Noch keine Punktwolke. Zuerst scannen oder aufnehmen.')); return; }
  const scans = a.project.scans.filter((x) => x.points && x.kind !== 'mesh');
  P.appendChild(h('div.field', h('label', 'Punktwolke'), select(scans.map((x) => [x.id, `${x.name} · ${fmtInt(x.points)}`]), s.id, (v) => { f.selScan = scans.find((x) => x.id === Number(v)); f.render(); })));
  f._editMsg = h('div.mono.muted', { style: { fontSize: '11.5px', minHeight: '16px' } }, f._emsg || '');
  P.appendChild(f._editMsg);
  const op = (ic, label, fn, sub) => { const b = h('button.btn', { html: icon(ic) + `<span>${label}</span>` }); b.addEventListener('click', () => fn()); return h('div.row', b, sub ? h('span.muted', { style: { fontSize: '11.5px' } }, sub) : null); };
  P.appendChild(h('h4', 'Bereinigen'));
  P.appendChild(op('filter', 'Phantompunkte entfernen', () => phantoms(f, s), 'Blooming, Regen-, Nebel- und Sonnenechos'));
  P.appendChild(h('div.row', op('filter', 'Rauschfilter (SOR)', () => sor(f, s)), seg([[1, 'streng'], [2, 'normal'], [3, 'locker']], E.sor, (v) => { E.sor = v; })));
  P.appendChild(h('div.row', op('grid', 'Ausdünnen', () => voxel(f, s)), seg([[0.005, '5 mm'], [0.01, '1 cm'], [0.02, '2 cm'], [0.05, '5 cm']], E.voxel, (v) => { E.voxel = v; })));
  P.appendChild(h('h4', 'Gliedern'));
  P.appendChild(op('layers', 'Boden klassifizieren', () => ground(f, s, false), 'RANSAC-Ebene, Klasse 2'));
  P.appendChild(op('layers', 'Boden entfernen', () => ground(f, s, true)));
  const sel = a.selected;
  P.appendChild(op('cube', 'Auf Objekt zuschneiden', () => crop(f, s), sel ? `„${sel.name}“ (in der Szene gewählt)` : 'Objekt in der Szene antippen (Werkzeug „Auswählen“)'));
  const iso = op('target', f.isoMode ? 'Jetzt Punkt im Viewer antippen …' : 'Objekt isolieren (Region Growing)', () => { f.isoMode = !f.isoMode; f.render(); }, 'Startpunkt antippen');
  if (f.isoMode) iso.firstChild.classList.add('on');
  P.appendChild(iso);
  P.appendChild(h('h4', 'Vernetzen'));
  P.appendChild(h('div.row', op('mesh', 'Netz erstellen (TSDF)', () => mesh(f, s)), seg([[0.01, '1 cm'], [0.02, '2 cm'], [0.04, '4 cm']], E.mesh, (v) => { E.mesh = v; })));
  const meshes = a.project.meshes || [];
  if (meshes.length) {
    const list = h('div.list');
    for (const m of meshes) {
      const it = h('div.litem', h('span.sw', { style: { background: '#9fb3c8' } }), h('div.t', { html: `<b>${m.name}</b><small>${fmtInt(m.data.index.length / 3)} Dreiecke · Voxel ${(m.voxel * 100).toFixed(0)} cm</small>` }));
      const vis = h('button.btn.small.icon.ghost', { html: icon(m.mesh.visible ? 'eye' : 'close') }); vis.addEventListener('click', () => { m.mesh.visible = !m.mesh.visible; f.render(); });
      const del = h('button.btn.small.icon.ghost', { html: icon('trash') }); del.addEventListener('click', () => { m.mesh.removeFromParent(); m.mesh.geometry.dispose(); meshes.splice(meshes.indexOf(m), 1); f.render(); });
      it.append(vis, del);
      list.appendChild(it);
    }
    P.appendChild(list);
  }
}

function msg(f, t) { f._emsg = t; if (f._editMsg) f._editMsg.textContent = t; }
function publish(f, src, scan, text) {
  f.app.project.add(scan);
  src.visible = false;
  f.selScan = scan;
  msg(f, text);
  toast(text, 'ok');
  f.render();
}

function phantoms(f, s) {
  const g = s.cloud.gather();
  const mask = new Uint8Array(g.n);
  let rm = 0;
  for (let k = 0; k < g.n; k++) { const bad = (g.meta[k * 4 + 3] & (64 | 16 | 32)) || g.meta[k * 4 + 1] === 7; mask[k] = bad ? 0 : 1; if (bad) rm++; }
  publish(f, s, derivedScan(s, g, mask, s.name + ' · bereinigt'), `${fmtInt(rm)} Phantompunkte entfernt`);
}

async function sor(f, s) {
  const g = s.cloud.gather();
  msg(f, 'Statistischer Ausreißerfilter läuft …');
  const r = await f.app.proc.run('sor', { pos: g.pos.slice(), k: 8, alpha: f.eopts.sor }, [], (p) => msg(f, `Ausreißerfilter … ${Math.round(p * 100)} %`));
  publish(f, s, derivedScan(s, g, r.keep, s.name + ' · SOR'), `SOR: ${fmtInt(r.removed)} Punkte entfernt (mittlerer Nachbarabstand ${(r.mu * 1000).toFixed(1)} mm)`);
}

async function voxel(f, s) {
  const g = s.cloud.gather();
  msg(f, 'Ausdünnen …');
  const r = await f.app.proc.run('voxel', { pos: g.pos.slice(), size: f.eopts.voxel });
  let n = 0; for (const v of r.keep) n += v;
  publish(f, s, derivedScan(s, g, r.keep, `${s.name} · ${f.eopts.voxel * 100} cm`), `Auf ${fmtInt(n)} Punkte ausgedünnt (Raster ${(f.eopts.voxel * 1000).toFixed(0)} mm)`);
}

async function ground(f, s, remove) {
  const g = s.cloud.gather();
  msg(f, 'Bodenebene wird gesucht …');
  const r = await f.app.proc.run('ground', { pos: g.pos.slice(), tol: 0.035 });
  if (!r.plane) { msg(f, 'Keine Bodenebene gefunden'); return; }
  if (remove) {
    const keep = new Uint8Array(g.n); for (let k = 0; k < g.n; k++) keep[k] = r.mask[k] ? 0 : 1;
    publish(f, s, derivedScan(s, g, keep, s.name + ' · ohne Boden'), `${fmtInt(r.count)} Bodenpunkte entfernt`);
  } else {
    const sc = derivedScan(s, g, null, s.name + ' · klassifiziert', { cls: (k, c) => (r.mask[k] ? 2 : c === 2 ? 1 : c) });
    publish(f, s, sc, `${fmtInt(r.count)} Punkte als Boden klassifiziert`);
    f.opts.mode = 'class';
  }
}

function crop(f, s) {
  const o = f.app.selected;
  if (!o) { toast('Zuerst ein Objekt in der 3D-Szene antippen (Werkzeug „Auswählen“).', 'warn'); return; }
  const box = new THREE.Box3().setFromObject(o.root).expandByScalar(0.05);
  box.min.y = Math.max(box.min.y, 0.015); // Boden knapp ausschließen
  const g = s.cloud.gather();
  const mask = new Uint8Array(g.n);
  let n = 0;
  const v = new THREE.Vector3();
  for (let k = 0; k < g.n; k++) { v.set(g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]); if (box.containsPoint(v)) { mask[k] = 1; n++; } }
  if (!n) { toast('Im Bereich des Objekts liegen keine Punkte – erst scannen.', 'warn'); return; }
  const sc = derivedScan(s, g, mask, o.name);
  sc.ref = o;
  publish(f, s, sc, `${o.name}: ${fmtInt(n)} Punkte ausgeschnitten`);
}

export async function tap(f, info) {
  if (!f.isoMode) return;
  const s = current(f);
  const hit = pickPoint(f, info, { scan: s });
  if (!hit) { toast('Kein Punkt getroffen', 'warn'); return; }
  f.isoMode = false;
  const g = s.cloud.gather();
  // Index des getroffenen Punkts in der gesammelten Liste
  let seed = 0, best = Infinity;
  for (let k = 0; k < g.n; k++) { const d = (g.pos[k * 3] - hit.p.x) ** 2 + (g.pos[k * 3 + 1] - hit.p.y) ** 2 + (g.pos[k * 3 + 2] - hit.p.z) ** 2; if (d < best) { best = d; seed = k; } }
  msg(f, 'Region Growing …');
  const gr = await f.app.proc.run('ground', { pos: g.pos.slice(), tol: 0.03 });
  const r = await f.app.proc.run('region', { pos: g.pos.slice(), seed, r: Math.max(0.02, (s.set && s.set.resolution ? s.set.resolution / 1000 * 2.2 : 0.05)), exclude: gr.mask });
  publish(f, s, derivedScan(s, g, r.mask, s.name + ' · Objekt'), `Objekt isoliert: ${fmtInt(r.count)} zusammenhängende Punkte`);
}

async function mesh(f, s) {
  const a = f.app;
  const voxel = f.eopts.mesh;
  if (s.points > 3e6) { toast('Für das Vernetzen bitte erst ausdünnen oder zuschneiden (höchstens 3 Mio. Punkte).', 'warn'); return; }
  msg(f, `Vernetzen (Voxel ${voxel * 100} cm) …`);
  const t0 = performance.now();
  const res = await meshScan(a, s, voxel);
  if (!res) { msg(f, 'Kein Netz entstanden – zu wenige Punkte?'); return; }
  addMeshToProject(a, s, res, voxel);
  s.visible = false;
  const n = res.r.index.length / 3;
  msg(f, `Netz: ${fmtInt(n)} Dreiecke in ${fmtInt(performance.now() - t0)} ms`);
  toast(`Netz erstellt: ${fmtInt(n)} Dreiecke`, 'ok');
  f.render();
}
