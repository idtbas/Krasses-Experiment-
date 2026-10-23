// Messen: Punktinfo, Strecken (3D, horizontal, Höhe), Markierungen im Viewer
import * as THREE from 'three';
import { h, seg, fmtNum } from '../../ui/dom.js';
import { CLOUD_LAYER } from '../../cloud/cloud.js';

const CLS = { 1: 'unklassifiziert', 2: 'Boden', 3: 'niedr. Vegetation', 5: 'hohe Vegetation', 6: 'Gebäude', 7: 'Rauschen', 9: 'Wasser' };

// nächsten sichtbaren Punkt unter dem Finger suchen (Abstand zum Sichtstrahl, vorderster Treffer)
export function pickPoint(f, info, opts = {}) {
  const a = f.app, cam = a.viewerCam;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(info.nx, info.ny), cam);
  const o = ray.ray.origin, d = ray.ray.direction;
  const rect = f.viewEl.getBoundingClientRect();
  const pixAng = (cam.fov * Math.PI / 180) / rect.height * (opts.px || 7);
  let best = null, bestT = Infinity;
  const v = new THREE.Vector3();
  const clouds = a.project.scans.filter((s) => s.visible && s.points && (!opts.scan || s === opts.scan)).map((s) => s.cloud);
  if (!opts.scan && f.showLive && f.dev && f.dev.live.count) clouds.push(f.dev.live);
  for (const c of clouds) {
    c.group.updateMatrixWorld(true);
    const M = c.group.matrixWorld, ident = c.isIdentity();
    for (const ch of c.chunks) {
      const P = ch.pos;
      for (let i = 0; i < ch.n; i++) {
        v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        if (!ident) v.applyMatrix4(M);
        const px = v.x - o.x, py = v.y - o.y, pz = v.z - o.z;
        const t = px * d.x + py * d.y + pz * d.z;
        if (t <= 0.05 || t >= bestT) continue;
        const qx = px - d.x * t, qy = py - d.y * t, qz = pz - d.z * t;
        if (qx * qx + qy * qy + qz * qz > (t * pixAng) ** 2) continue;
        bestT = t;
        best = { cloud: c, chunk: ch, i, p: v.clone() };
      }
    }
  }
  return best;
}

function marker(color) {
  const g = new THREE.SphereGeometry(1, 12, 8);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
  m.layers.set(CLOUD_LAYER); m.renderOrder = 10;
  return m;
}

export function ensureLayer(f) {
  if (f._mgroup) return f._mgroup;
  const g = new THREE.Group();
  g.name = 'Messungen';
  f.app.world.clouds.add(g);
  f._mgroup = g;
  return g;
}

export function render(f, P) {
  f.mstate = f.mstate || { mode: 'dist', pts: [], results: [] };
  const S = f.mstate;
  P.appendChild(h('div.row.wrap', seg([['info', 'Punktinfo'], ['dist', 'Strecke'], ['height', 'Höhe über Boden']], S.mode, (v) => { S.mode = v; S.pts = []; f.render(); }), h('div.grow'), (() => { const b = h('button.btn.small', 'Messungen löschen'); b.addEventListener('click', () => { S.results = []; S.pts = []; if (f._mgroup) f._mgroup.clear(); f.render(); }); return b; })()));
  P.appendChild(h('div.muted', { style: { fontSize: '12px' } }, S.mode === 'info' ? 'Einen Punkt im Viewer antippen.' : S.mode === 'dist' ? (S.pts.length ? 'Zweiten Punkt antippen.' : 'Ersten Punkt antippen.') : 'Punkt antippen – gemessen wird der lotrechte Abstand zum Boden (tiefster Punkt darunter).'));
  if (S.info) {
    const k = S.info;
    P.appendChild(h('div.kv',
      h('span', 'Position X / Y / Z'), h('b', `${fmtNum(k.p.x, 3)} / ${fmtNum(k.p.y, 3)} / ${fmtNum(k.p.z, 3)} m`),
      h('span', 'Reflektivität'), h('b', `${k.inten} ${k.inten > 100 ? '(Retroreflektor)' : '%'}`),
      h('span', 'Echo'), h('b', `${k.ret & 15} von ${k.ret >> 4}`),
      h('span', 'Klasse'), h('b', CLS[k.cls] || k.cls),
      h('span', 'Kanal / Zeile'), h('b', String(k.ring)),
      h('span', 'Zeit'), h('b', `${fmtNum(k.t, 6)} s`),
      k.range != null ? h('span', 'Entfernung zum Scanner') : null, k.range != null ? h('b', `${fmtNum(k.range, 3)} m`) : null,
      k.flags & 64 ? h('span', 'Hinweis') : null, k.flags & 64 ? h('b', 'Blooming-Phantom') : null,
      k.flags & 8 ? h('span', 'Hinweis') : null, k.flags & 8 ? h('b', 'über Spiegel (Geisterpunkt)') : null,
      k.flags & 4 ? h('span', 'Hinweis') : null, k.flags & 4 ? h('b', 'durch Glas gemessen') : null));
  }
  if (S.results.length) {
    const t = h('table.t', h('thead', h('tr', h('th', '#'), h('th', 'Strecke'), h('th', 'horizontal'), h('th', 'Höhe Δ'))));
    const tb = h('tbody');
    S.results.forEach((r, i) => tb.appendChild(h('tr', h('td', r.kind === 'height' ? `H${i + 1}` : `S${i + 1}`), h('td', `${fmtNum(r.d, 3)} m`), h('td', r.hz != null ? `${fmtNum(r.hz, 3)} m` : '–'), h('td', `${fmtNum(r.dy, 3)} m`))));
    t.appendChild(tb);
    P.appendChild(t);
  }
}

export function tap(f, info) {
  const S = f.mstate;
  const hit = pickPoint(f, info);
  if (!hit) return;
  const ch = hit.chunk, i = hit.i;
  const scan = hit.cloud.scan;
  const origin = scan ? scan.origin : null;
  S.info = { p: hit.p, inten: ch.inten[i], ret: ch.meta[i * 4], cls: ch.meta[i * 4 + 1], ring: ch.meta[i * 4 + 2], flags: ch.meta[i * 4 + 3], t: ch.time[i], range: origin ? hit.p.distanceTo(origin) : null };
  const g = ensureLayer(f);
  const dist = f.app.vorbit.dist;
  const sz = Math.max(0.004, dist * 0.006);
  const m = marker(S.mode === 'height' ? '#ffb02e' : '#35d0ff'); m.scale.setScalar(sz); m.position.copy(hit.p); g.add(m);
  if (S.mode === 'dist') {
    S.pts.push(hit.p);
    if (S.pts.length === 2) {
      const [A, B] = S.pts;
      const geo = new THREE.BufferGeometry().setFromPoints([A, B]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#35d0ff', depthTest: false }));
      line.layers.set(CLOUD_LAYER); line.renderOrder = 9; g.add(line);
      S.results.push({ kind: 'dist', d: A.distanceTo(B), hz: Math.hypot(A.x - B.x, A.z - B.z), dy: B.y - A.y });
      S.pts = [];
    }
  } else if (S.mode === 'height') {
    // Bodenhöhe: tiefster Punkt im Umkreis von 0,3 m unterhalb
    let floor = Infinity;
    for (const s of f.app.project.scans) if (s.visible) {
      const c = s.cloud; c.group.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      for (const chk of c.chunks) for (let k = 0; k < chk.n; k++) {
        v.set(chk.pos[k * 3], chk.pos[k * 3 + 1], chk.pos[k * 3 + 2]); if (!c.isIdentity()) v.applyMatrix4(c.group.matrixWorld);
        if (Math.hypot(v.x - hit.p.x, v.z - hit.p.z) < 0.3 && v.y < floor) floor = v.y;
      }
    }
    if (floor < Infinity) {
      const B = new THREE.Vector3(hit.p.x, floor, hit.p.z);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([hit.p, B]), new THREE.LineBasicMaterial({ color: '#ffb02e', depthTest: false }));
      line.layers.set(CLOUD_LAYER); g.add(line);
      S.results.push({ kind: 'height', d: hit.p.y - floor, hz: null, dy: hit.p.y - floor });
    }
  }
  f.render();
}
