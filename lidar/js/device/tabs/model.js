// Modell: aus der Punktwolke ein glattes 3D-Modell (Objekt) oder ein Raummodell mit Grundriss (Raum) – wie Polycam.
// Rechenarbeit im Verarbeitungs-Worker: TSDF + Surface Nets, Kleinteile entfernen, Taubin-Glättung; Raum aus
// Wandlinien, Freiraum und durchquerten Wandebenen (Türen, Fenster).
import * as THREE from 'three';
import { h, seg, toggle, toast, fmtInt, fmtNum, select, setText } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { originsFor } from '../../cloud/meshing.js';
import { meshObject, setLook, roomObject, floorPlanSVG, roomJSON, groupMeshData, LOOKS } from '../../cloud/modelgeo.js';
import { writeOBJ, writeSTL, writeMeshPLY, download } from '../../cloud/export.js';

const safe = (s) => s.replace(/[^\wäöüÄÖÜß\-]+/g, '_');

function opts(f) {
  return f.mopts || (f.mopts = { mode: 'objekt', src: 'sichtbar', detail: 'auto', smooth: 4, look: 'orig', wire: false, clean: true, ground: false, area: 'alles', furniture: true, ceiling: false, points: false, spin: false });
}
function scansFor(f) {
  const L = f.app.project.scans.filter((s) => s.points && s.kind !== 'mesh');
  const O = opts(f);
  if (O.src === 'sichtbar') return L.filter((s) => s.visible);
  if (O.src === 'alle') return L;
  return L.filter((s) => String(s.id) === String(O.src));
}

export function render(f, P) {
  const a = f.app, O = opts(f);
  const all = a.project.scans.filter((s) => s.points && s.kind !== 'mesh');
  const models = a.project.models || (a.project.models = []);
  if (!all.length && !models.length) {
    P.appendChild(h('div.empty', { html: 'Noch keine Punktwolke.<br>Erst einen Stationsscan machen oder eine Aufnahme starten – dann hier ein 3D-Modell daraus rechnen.' }));
    return;
  }
  P.appendChild(h('div.row.wrap',
    seg([['objekt', 'Objekt'], ['raum', 'Raum']], O.mode, (v) => { O.mode = v; f.render(); }),
    h('span.muted', { style: { fontSize: '11.5px' } }, O.mode === 'objekt' ? 'Glattes Netz eines Gegenstands oder einer Umgebung' : 'Rechtwinkliger Raum: Wände, Türen, Fenster, Grundriss mit Maßen')));
  const srcOpts = [['sichtbar', 'Sichtbare Scans'], ['alle', 'Alle Scans'], ...all.map((s) => [String(s.id), `${s.name} · ${fmtInt(s.points)}`])];
  P.appendChild(h('div.field', h('label', 'Quelle'), select(srcOpts, O.src, (v) => { O.src = v; f.render(); })));
  const list = scansFor(f), n = list.reduce((q, s) => q + s.points, 0);
  if (O.mode === 'objekt') {
    const sel = a.selected;
    P.appendChild(h('div.field', h('label', 'Bereich'), h('div.row.wrap',
      seg([['alles', 'Alles'], ['nah', 'Nahbereich 4 m'], ['objekt', 'Markiertes Objekt']], O.area, (v) => { O.area = v; f.render(); }),
      O.area === 'objekt' ? h('span.muted', { style: { fontSize: '11.5px' } }, sel ? `„${sel.name}“` : 'In der Welt mit Q markieren') : null)));
    P.appendChild(h('div.field', h('label', 'Detail'), seg([['auto', 'Auto'], [0.008, 'Fein'], [0.015, 'Mittel'], [0.03, 'Grob']], O.detail, (v) => { O.detail = v; })));
    P.appendChild(h('div.field', h('label', 'Glättung'), seg([[0, 'Aus'], [4, 'Leicht'], [12, 'Stark']], O.smooth, (v) => { O.smooth = v; })));
    P.appendChild(h('div.field', h('label', 'Bereinigen'), h('div.row.wrap',
      toggle('Schwebeteile entfernen', O.clean, (v) => { O.clean = v; }),
      toggle('Boden weglassen', O.ground, (v) => { O.ground = v; }))));
  } else {
    P.appendChild(h('div.field', h('label', 'Inhalt'), h('div.row.wrap',
      toggle('Möbel & Objekte als Netz', O.furniture, (v) => { O.furniture = v; }),
      toggle('Decke', O.ceiling, (v) => { O.ceiling = v; }))));
  }
  const go = h('button.btn.primary', { html: icon('cube') + `<span>${list.length ? `Modell erstellen · ${fmtInt(n)} Punkte` : 'Keine passenden Scans'}</span>` });
  go.disabled = !list.length || f._mbusy;
  go.addEventListener('click', () => build(f));
  f._mmsg = h('div.mono.muted', { style: { fontSize: '11.5px', minHeight: '16px' } }, f._mtext || '');
  P.appendChild(h('div.row.wrap', go, f._mmsg));

  if (!models.length) return;
  P.appendChild(h('h4', 'Darstellung'));
  P.appendChild(h('div.field', h('label', 'Oberfläche'), h('div.row.wrap',
    seg(Object.entries(LOOKS), O.look, (v) => { O.look = v; restyle(f); }),
    toggle('Drahtgitter', O.wire, (v) => { O.wire = v; restyle(f); }))));
  P.appendChild(h('div.field', h('label', 'Ansicht'), h('div.row.wrap',
    toggle('Punktwolke zeigen', O.points, (v) => { O.points = v; }),
    toggle('Drehen', O.spin, (v) => { O.spin = v; }))));
  P.appendChild(h('h4', 'Modelle'));
  const L = h('div.list');
  for (const m of [...models].reverse()) L.appendChild(item(f, m));
  P.appendChild(L);
  const room = models.filter((m) => m.room).at(-1);
  if (room && room.group.visible) {
    P.appendChild(h('h4', `Grundriss · ${room.name}`));
    const plan = h('div.plan', { html: floorPlanSVG(room.room) });
    P.appendChild(plan);
  }
}

function item(f, m) {
  const a = f.app;
  const info = m.room
    ? `${fmtNum(m.room.area, 1)} m² · Höhe ${fmtNum(m.room.height, 2)} m · ${m.room.walls.length} Wände · ${m.room.walls.reduce((q, w) => q + w.openings.filter((x) => x.kind === 'tür').length, 0)} Türen · ${m.room.walls.reduce((q, w) => q + w.openings.filter((x) => x.kind === 'fenster').length, 0)} Fenster`
    : `${fmtInt(m.tris)} Dreiecke · ${m.size.map((v) => fmtNum(v, 2)).join(' × ')} m · Voxel ${fmtNum(m.voxel * 100, 1)} cm`;
  const it = h('div.litem', h('span.sw', { style: { background: m.room ? '#e8901e' : '#5fd3ff' } }), h('div.t', { html: `<b>${m.name}</b><small>${info}</small>` }));
  const btn = (ic, title, fn) => { const b = h('button.btn.small.icon.ghost', { html: icon(ic), title }); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  it.append(
    btn('fit', 'Ansehen', () => frameModel(f, m)),
    btn(m.group.visible ? 'eye' : 'close', 'Ein-/ausblenden', () => { m.group.visible = !m.group.visible; f.render(); }),
    btn('export', 'Exportieren', () => exportMenu(f, m, it)),
    btn('trash', 'Löschen', () => {
      m.group.removeFromParent();
      m.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      const L = a.project.models; L.splice(L.indexOf(m), 1);
      f.render();
    }),
  );
  return it;
}

function exportMenu(f, m, anchor) {
  const old = anchor.parentNode.querySelector('.xrow');
  if (old) { old.remove(); return; }
  const data = m.room ? groupMeshData(m.group) : m.data;
  const row = h('div.xrow.row.wrap');
  const add = (label, fn) => { const b = h('button.btn.small', label); b.addEventListener('click', () => { const [blob, ext] = fn(); download(blob, safe(m.name) + ext); toast(`${m.name} als ${label} exportiert`, 'ok'); }); row.appendChild(b); };
  add('OBJ', () => [writeOBJ(data), '.obj']);
  add('STL', () => [writeSTL(data), '.stl']);
  add('PLY', () => [writeMeshPLY(data), '.ply']);
  if (m.room) {
    add('Grundriss SVG', () => [new Blob([floorPlanSVG(m.room, { bg: '#ffffff', ink: '#111418', dim: '#5b6672', acc: '#1d7fb8', fill: 'rgba(29,127,184,.06)', px: 1600 })], { type: 'image/svg+xml' }), '_grundriss.svg']);
    add('Raum JSON', () => [new Blob([roomJSON(m.room)], { type: 'application/json' }), '.json']);
  }
  anchor.after(row);
}

function msg(f, t) { f._mtext = t; if (f._mmsg) setText(f._mmsg, t); }

function restyle(f) {
  const O = opts(f);
  for (const m of f.app.project.models || []) m.group.traverse((o) => { if (o.isMesh && o.userData.data) setLook(o, O.look, O.wire); else if (o.isMesh && o.material) { o.material.wireframe = O.wire; } });
}

// Punkte aller Quellscans zusammenführen (mit Ursprung je Punkt), höchstens max Punkte
function collect(scans, max, rgbMode) {
  const { parts, origins } = originsFor(scans);
  let n = 0; for (const p of parts) n += p.g.n;
  const step = n / Math.min(n, max);
  const m = Math.min(n, max);
  const pos = new Float32Array(m * 3), rgb = new Float32Array(m * 3), oi = new Uint16Array(m);
  let hasRGB = false;
  for (const p of parts) { const g = p.g; for (let k = 0; k < g.n * 3; k += 31) if (g.rgb[k]) { hasRGB = true; break; } }
  let k = 0, acc = 0;
  for (const p of parts) {
    const g = p.g;
    for (let i = 0; i < g.n && k < m; i++) {
      acc += 1;
      if (acc < step) continue;
      acc -= step;
      pos[k * 3] = g.pos[i * 3]; pos[k * 3 + 1] = g.pos[i * 3 + 1]; pos[k * 3 + 2] = g.pos[i * 3 + 2];
      if (hasRGB && rgbMode !== 'refl') { rgb[k * 3] = g.rgb[i * 3]; rgb[k * 3 + 1] = g.rgb[i * 3 + 1]; rgb[k * 3 + 2] = g.rgb[i * 3 + 2]; }
      else { const v = Math.min(255, Math.pow(g.i[i] / 110, 0.7) * 235 + 12); rgb[k * 3] = rgb[k * 3 + 1] = rgb[k * 3 + 2] = v; }
      oi[k] = p.oi[i];
      k++;
    }
  }
  return { pos: pos.subarray(0, k * 3), rgb: rgb.subarray(0, k * 3), oi: oi.subarray(0, k), origins, n: k, total: n, hasRGB };
}

async function build(f) {
  const a = f.app, O = opts(f);
  const scans = scansFor(f);
  if (!scans.length || f._mbusy) return;
  f._mbusy = true;
  f.render();
  const t0 = performance.now();
  try {
    if (O.mode === 'objekt') await buildObject(f, scans);
    else await buildRoom(f, scans);
    msg(f, `${f._mtext} · ${fmtNum((performance.now() - t0) / 1000, 1)} s`);
  } catch (e) {
    console.error(e);
    msg(f, 'Fehler: ' + e.message);
  }
  f._mbusy = false;
  f.render();
}

async function meshPoints(a, pts, voxel, smooth, minPart) {
  const r = await a.proc.run('mesh', { pos: pts.pos.slice(), rgb: pts.rgb.slice(), origins: pts.origins, oIndex: pts.oi.slice(), voxel, trunc: voxel * 3, box: null });
  if (!r.index.length) return null;
  return a.proc.run('meshpost', { pos: r.pos, rgb: r.rgb, index: r.index, opts: { minPart, smooth } }, [r.pos.buffer, r.rgb.buffer, r.index.buffer]);
}

async function buildObject(f, scans) {
  const a = f.app, O = opts(f);
  msg(f, 'Punkte sammeln …');
  let pts = collect(scans, 2.5e6);
  const area = areaFilter(f, scans);
  if (area) pts = keep(pts, (k) => area(pts.pos[k * 3], pts.pos[k * 3 + 1], pts.pos[k * 3 + 2]));
  if (pts.n < 500) { msg(f, O.area === 'objekt' ? 'Kaum Punkte am markierten Objekt – erst scannen oder ein anderes Objekt markieren.' : 'Zu wenige Punkte im Bereich.'); return; }
  if (O.ground) {
    msg(f, 'Boden suchen …');
    const g = await a.proc.run('ground', { pos: pts.pos.slice(), tol: 0.03 });
    if (g.plane) pts = keep(pts, (k) => !g.mask[k]);
  }
  // Detailstufe: Auto nach robuster Ausdehnung (2 … 98 %, einzelne ferne Punkte zählen nicht), ≈ 300 Voxel, 6 mm … 4 cm
  // und nach dem Punktabstand: feiner als ≈ 2,5 Punktabstände reißt die TSDF in Splitter
  const ext = robustSize(pts.pos, pts.n), sp = spacingOf(pts.pos, pts.n);
  const voxel = O.detail === 'auto' ? Math.min(0.04, Math.max(0.006, sp * 2.5, Math.round(Math.max(ext[0], ext[1], ext[2]) / 300 * 200) / 200)) : O.detail;
  msg(f, `Vernetzen (Voxel ${fmtNum(voxel * 100, 1)} cm, ${fmtInt(pts.n)} Punkte) …`);
  const r = await meshPoints(a, pts, voxel, O.smooth, O.clean ? 0.015 : 0);
  if (!r || !r.index.length) { msg(f, 'Kein Netz entstanden – zu wenige oder zu verstreute Punkte?'); return; }
  const mesh = meshObject({ pos: r.pos, rgb: r.rgb, index: r.index }, O.look);
  setLook(mesh, O.look, O.wire);
  const box = mesh.geometry.boundingBox, size = box.getSize(new THREE.Vector3());
  const model = add(f, { name: `Modell ${String((a.project.models.length || 0) + 1).padStart(2, '0')} · ${scans.length > 1 ? scans.length + ' Scans' : scans[0].name}`, group: mesh, data: mesh.userData.data, tris: r.index.length / 3, voxel, size: [size.x, size.z, size.y] });
  msg(f, `${fmtInt(model.tris)} Dreiecke${r.dropped ? ` · ${r.dropped} Schwebeteile entfernt` : ''}`);
  toast(`3D-Modell erstellt: ${fmtInt(model.tris)} Dreiecke`, 'ok');
}

async function buildRoom(f, scans) {
  const a = f.app, O = opts(f);
  msg(f, 'Punkte sammeln …');
  const pts = collect(scans, 1.4e6);
  msg(f, 'Boden, Decke und Wände suchen …');
  const res = await a.proc.run('room', { pos: pts.pos.slice(), oIndex: pts.oi.slice(), origins: pts.origins });
  const room = res.room;
  if (!room || room.error) { msg(f, room ? room.error : 'Raum nicht erkannt'); toast(room ? room.error : 'Raum nicht erkannt', 'warn'); return; }
  const group = roomObject(room, { ceiling: O.ceiling });
  let furn = 0;
  if (O.furniture) {
    // Punkte im Raum, nicht an Wand, Boden oder Decke
    msg(f, 'Möbel und Objekte vernetzen …');
    const inside = insideTest(room, 0.1);
    const inner = keep(pts, (k) => { const y = pts.pos[k * 3 + 1]; return y > room.floor + 0.04 && y < room.top - 0.08 && inside(pts.pos[k * 3], pts.pos[k * 3 + 2]); });
    if (inner.n > 500) {
      const r = await meshPoints(a, inner, 0.025, 4, 0.004);
      if (r && r.index.length) {
        const m = meshObject({ pos: r.pos, rgb: r.rgb, index: r.index }, O.look);
        group.add(m);
        furn = r.index.length / 3;
      }
    }
  }
  const model = add(f, { name: `Raum ${String((a.project.models.length || 0) + 1).padStart(2, '0')} · ${fmtNum(room.area, 1)} m²`, group, room, tris: furn });
  setTimeout(() => frameModel(f, model, true), 0);
  const doors = room.walls.reduce((q, w) => q + w.openings.filter((x) => x.kind === 'tür').length, 0), wins = room.walls.reduce((q, w) => q + w.openings.filter((x) => x.kind === 'fenster').length, 0);
  msg(f, `${fmtNum(room.area, 1)} m² · ${room.walls.length} Wände · ${doors} Türen · ${wins} Fenster${furn ? ` · Möbel ${fmtInt(furn)} Dreiecke` : ''}`);
  toast(`Raummodell: ${fmtNum(room.area, 1)} m², Höhe ${fmtNum(room.height, 2)} m`, 'ok');
}

function keep(pts, fn) {
  const idx = [];
  for (let k = 0; k < pts.n; k++) if (fn(k)) idx.push(k);
  const m = idx.length, pos = new Float32Array(m * 3), rgb = new Float32Array(m * 3), oi = new Uint16Array(m);
  idx.forEach((k, j) => { pos.set(pts.pos.subarray(k * 3, k * 3 + 3), j * 3); rgb.set(pts.rgb.subarray(k * 3, k * 3 + 3), j * 3); oi[j] = pts.oi[k]; });
  return { ...pts, pos, rgb, oi, n: m };
}

// Punkt-in-Polygon mit Mindestabstand zu den Wänden
function insideTest(room, margin) {
  const P = room.poly;
  return (x, z) => {
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, zi] = P[i], [xj, zj] = P[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    if (!inside) return false;
    for (const w of room.walls) {
      const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - w.a[0]) * dx + (z - w.a[1]) * dz) / L2));
      if (Math.hypot(x - w.a[0] - t * dx, z - w.a[1] - t * dz) < margin) return false;
    }
    return true;
  };
}

function add(f, m) {
  const a = f.app;
  a.world.clouds.add(m.group);
  a.project.models.push(m);
  // Quellpunkte im Modell-Tab zunächst ausblenden (wie bei Polycam sieht man das Netz)
  opts(f).points = false;
  frameModel(f, m);
  return m;
}

export function frameModel(f, m, doll = false) {
  // Ausschnitt nach dem Kern des Modells (Perzentile), nicht nach einzelnen fernen Zipfeln
  const box = new THREE.Box3().setFromObject(m.group);
  if (box.isEmpty()) return;
  let c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  if (!m.room && m.data) {
    const n = m.data.pos.length / 3, lo = robustBox(m.data.pos, n);
    c = new THREE.Vector3((lo[0] + lo[3]) / 2, (lo[1] + lo[4]) / 2, (lo[2] + lo[5]) / 2);
    s = new THREE.Vector3(lo[3] - lo[0], lo[4] - lo[1], lo[5] - lo[2]);
  }
  const R = Math.max(s.x, s.y, s.z);
  f.app.vorbit.lookAt(c, Math.max(1.2, R * (m.room ? 1.05 : 1.25)), f.app.vorbit.goal.yaw, m.room || doll ? 0.95 : 0.45);
}

// jedes Bild: langsam drehen
export function frame(f, dt) {
  const O = f.mopts;
  if (O && O.spin) f.app.vorbit.goal.yaw += dt * 0.35;
}

// Perzentil-Hüllquader (2 … 98 %) aus einer Stichprobe
function robustBox(pos, n, q = 0.02) {
  const step = Math.max(1, Math.floor(n / 20000)), X = [], Y = [], Z = [];
  for (let k = 0; k < n; k += step) { X.push(pos[k * 3]); Y.push(pos[k * 3 + 1]); Z.push(pos[k * 3 + 2]); }
  const pick = (A) => { A.sort((a, b) => a - b); return [A[Math.floor(A.length * q)], A[Math.min(A.length - 1, Math.floor(A.length * (1 - q)))]]; };
  const [x0, x1] = pick(X), [y0, y1] = pick(Y), [z0, z1] = pick(Z);
  return [x0, y0, z0, x1, y1, z1];
}
function robustSize(pos, n) { const b = robustBox(pos, n); return [b[3] - b[0], b[4] - b[1], b[5] - b[2]]; }

// Bereich für den Objektmodus: alles, Nahbereich um den (ersten) Scanner, oder Hüllquader des markierten Objekts
function areaFilter(f, scans) {
  const O = opts(f);
  if (O.area === 'nah') {
    const s = scans[0], o = s.origin || new THREE.Vector3();
    return (x, y, z) => (x - o.x) ** 2 + (z - o.z) ** 2 < 16;
  }
  if (O.area === 'objekt') {
    const sel = f.app.selected;
    if (!sel || !sel.root) return () => false;
    const b = new THREE.Box3().setFromObject(sel.root).expandByScalar(0.06);
    return (x, y, z) => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z;
  }
  return null;
}

// mittlerer Punktabstand auf den Flächen: belegte 5-cm-Zellen ≈ Fläche, Abstand ≈ √(Fläche / Punkte)
function spacingOf(pos, n) {
  const step = Math.max(1, Math.floor(n / 400000)), c = 0.05, S = new Set();
  for (let k = 0; k < n; k += step) S.add(Math.floor(pos[k * 3] / c) * 73856093 ^ Math.floor(pos[k * 3 + 1] / c) * 19349663 ^ Math.floor(pos[k * 3 + 2] / c) * 83492791);
  const area = S.size * c * c * 1.3;
  return Math.sqrt(area / Math.max(1, n));
}
