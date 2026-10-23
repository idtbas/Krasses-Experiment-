// Scanner-Katalog: Karten mit 3D-Vorschau, Filter, Datenblatt mit Musterschau, Vergleich
import * as THREE from 'three';
import { SCANNERS, CLASSES, BY_ID, RETURN_NAMES, fmtPrice, fmtPts } from '../scanners/catalog.js';
import { buildScannerModel } from '../scanners/models3d.js';
import { previewPattern } from '../scanners/patterns.js';
import { h, clear, modal, fmtInt } from './dom.js';

const thumbs = new Map();

// Vorschaubilder einmalig mit dem Haupt-Renderer erzeugen
function makeThumbs(app) {
  if (thumbs.size) return;
  const r = app.views.r;
  const W = 440, H = 236;
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8eef5', '#3a3f45', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#9fdcff', 1.4); rim.position.set(-3, 2, -3); scene.add(rim);
  scene.environment = app.world.envTex;
  scene.environmentIntensity = 0.8;
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.01, 10);
  const buf = new Uint8Array(W * H * 4);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const prevTarget = r.getRenderTarget();
  const prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
  r.setScissorTest(false);
  for (const s of SCANNERS) {
    const m = buildScannerModel(s);
    const g = m.group;
    g.rotation.y = -0.6;
    scene.add(g);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const R = Math.max(size.x, size.y, size.z) * 0.62;
    const dist = R / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.05;
    cam.position.set(c.x + dist * 0.35, c.y + dist * 0.32, c.z + dist * 0.88);
    cam.lookAt(c);
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, cam);
    r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    thumbs.set(s.id, cv.toDataURL('image/png'));
    scene.remove(g);
  }
  r.setRenderTarget(prevTarget);
  r.setClearColor(prevClear, prevAlpha);
  rt.dispose();
}

export function thumbOf(id) { return thumbs.get(id) || ''; }

export function openCatalog(app) {
  makeThumbs(app);
  const state = { cls: 'alle', use: 'alle', cmp: new Set(), sort: 'klasse' };
  const body = h('div');
  const head = h('div.row.wrap');
  const grid = h('div.grid');
  const uses = [...new Set(SCANNERS.flatMap((s) => s.use))].sort();
  const render = () => {
    clear(head); clear(grid);
    const chip = (label, on, fn) => { const b = h('button.btn.small' + (on ? '.on' : ''), label); b.addEventListener('click', fn); return b; };
    head.appendChild(chip(`Alle (${SCANNERS.length})`, state.cls === 'alle', () => { state.cls = 'alle'; render(); }));
    for (const [k, c] of Object.entries(CLASSES)) head.appendChild(chip(`${c.short} (${SCANNERS.filter((s) => s.cls === k).length})`, state.cls === k, () => { state.cls = k; render(); }));
    head.appendChild(h('div.grow'));
    const us = h('select'); us.appendChild(h('option', { value: 'alle' }, 'Einsatz: alle'));
    for (const u of uses) { const o = h('option', { value: u }, u); if (u === state.use) o.selected = true; us.appendChild(o); }
    us.addEventListener('change', () => { state.use = us.value; render(); });
    const so = h('select');
    for (const [v, l] of [['klasse', 'Nach Klasse'], ['preis', 'Nach Preis'], ['reichweite', 'Nach Reichweite'], ['punkte', 'Nach Punktrate']]) { const o = h('option', { value: v }, l); if (v === state.sort) o.selected = true; so.appendChild(o); }
    so.addEventListener('change', () => { state.sort = so.value; render(); });
    head.append(h('div.sel', us), h('div.sel', so));
    if (state.cmp.size >= 2) head.appendChild(chip(`Vergleichen (${state.cmp.size})`, true, () => compare(app, [...state.cmp])));
    let list = SCANNERS.filter((s) => (state.cls === 'alle' || s.cls === state.cls) && (state.use === 'alle' || s.use.includes(state.use)));
    if (state.sort === 'preis') list = list.slice().sort((a, b) => a.price - b.price);
    if (state.sort === 'reichweite') list = list.slice().sort((a, b) => b.phys.rangeMax - a.phys.rangeMax);
    if (state.sort === 'punkte') list = list.slice().sort((a, b) => b.data.pts - a.data.pts);
    for (const s of list) {
      const card = h('div.ccard' + (app.dev && app.dev.spec.id === s.id ? '.on' : ''));
      const cmp = h('div.toggle' + (state.cmp.has(s.id) ? '.on' : ''), { title: 'Zum Vergleich' }, h('i'));
      cmp.classList.add('cmp');
      cmp.addEventListener('click', (e) => { e.stopPropagation(); if (state.cmp.has(s.id)) state.cmp.delete(s.id); else if (state.cmp.size < 4) state.cmp.add(s.id); render(); });
      card.append(
        cmp,
        h('div.thumb', h('img', { src: thumbOf(s.id), alt: s.model })),
        h('div.mk', `${s.maker} · ${CLASSES[s.cls].short}`),
        h('h4', s.model),
        h('p', s.tagline),
        h('div.specs',
          h('span', 'Reichweite'), h('b', `${s.phys.rangeMax} m`),
          h('span', '@ 10 %'), h('b', `${s.phys.r10} m`),
          h('span', 'Punkte/s'), h('b', fmtPts(s.data.pts)),
          h('span', 'Sichtfeld'), h('b', `${s.data.fovH}° × ${String(s.data.fovV).split(' ')[0]}`),
          h('span', 'Genauigkeit'), h('b', `σ ${s.phys.sigma >= 0.01 ? (s.phys.sigma * 100).toFixed(1) + ' cm' : (s.phys.sigma * 1000).toFixed(1) + ' mm'}`),
          h('span', 'Wellenlänge'), h('b', `${s.wavelength} nm`)),
        h('div.row', h('span.price', fmtPrice(s.price)), h('div.grow'), h('span.chip', s.use[0])),
      );
      card.addEventListener('click', () => datasheet(app, s, () => m.close()));
      grid.appendChild(card);
    }
  };
  body.append(head, grid);
  render();
  const m = modal('Scanner-Katalog', body, [], { width: 'min(1220px, 100%)', height: '100%' });
  m.sheet.classList.add('cat');
  m.sheet.querySelector('header').insertBefore(h('span.chip', `${SCANNERS.length} Geräte · Kennwerte gerundet, Preise unverbindlich`), m.sheet.querySelector('.grow'));
}

function drawPattern(canvas, spec) {
  const W = canvas.width, H = canvas.height, g = canvas.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  const pts = previewPattern(spec, spec.pattern.type === 'rosette' || spec.pattern.type === 'dome' ? 0.25 : 0.1, 90000);
  // Ausschnitt passend zum Sichtfeld
  let a0 = -180, a1 = 180, e0 = -90, e1 = 90;
  if (spec.data.fovH < 200) { let mn = 1e9, mx = -1e9, en = 1e9, ex = -1e9; for (let k = 0; k < pts.length; k += 3) { mn = Math.min(mn, pts[k]); mx = Math.max(mx, pts[k]); en = Math.min(en, pts[k + 1]); ex = Math.max(ex, pts[k + 1]); } const pa = (mx - mn) * 0.08 + 1, pe = (ex - en) * 0.08 + 1; a0 = mn - pa; a1 = mx + pa; e0 = en - pe; e1 = ex + pe; }
  else { let en = 1e9, ex = -1e9; for (let k = 1; k < pts.length; k += 3) { en = Math.min(en, pts[k]); ex = Math.max(ex, pts[k]); } e0 = Math.max(-90, en - 6); e1 = Math.min(90, ex + 6); }
  g.strokeStyle = '#1b222b'; g.lineWidth = 1; g.fillStyle = '#5d6874'; g.font = '10px ui-monospace, monospace';
  for (let e = Math.ceil(e0 / 10) * 10; e <= e1; e += 10) { const y = H - (e - e0) / (e1 - e0) * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(e + '°', 3, y - 2); }
  const step = a1 - a0 > 200 ? 45 : 10;
  for (let a = Math.ceil(a0 / step) * step; a <= a1; a += step) { const x = (a - a0) / (a1 - a0) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  const n = spec.pattern.elev ? spec.pattern.elev.length : spec.pattern.lasers || 1;
  for (let k = 0; k < pts.length; k += 3) {
    const x = (pts[k] - a0) / (a1 - a0) * W, y = H - (pts[k + 1] - e0) / (e1 - e0) * H;
    const t = n > 1 ? (pts[k + 2] % n) / (n - 1) : 0.75;
    g.fillStyle = `hsl(${190 - t * 170}, 90%, 60%)`;
    g.fillRect(x, y, 1.2, 1.2);
  }
}

export function datasheet(app, s, onPick) {
  makeThumbs(app);
  const d = s.data;
  const pv = h('canvas', { width: 560, height: 250 });
  const rows = [
    ['Hersteller', s.maker], ['Klasse', CLASSES[s.cls].name], ['Messprinzip', s.cls === 'line' && s.wavelength === 785 ? 'Triangulation' : s.phys.echoSep >= 99 ? 'Phasenvergleich / iToF' : s.cls === 'depth' ? 'dToF-Punktraster' : 'Pulslaufzeit (ToF)'],
    ['Wellenlänge', `${s.wavelength} nm · Laserklasse ${s.laserClass}`], ['Punkte je Sekunde', fmtInt(d.pts) + (s.pattern.cols ? ' (höchster Modus)' : '')],
    ['Sichtfeld horizontal', `${d.fovH}°`], ['Sichtfeld vertikal', d.fovV], ['Auflösung vertikal', d.resV], ['Auflösung horizontal', d.resH],
    ['Reichweite', `${s.phys.rangeMin} – ${s.phys.rangeMax} m`], ['Reichweite bei 10 % Reflektivität', `${s.phys.r10} m`],
    ['Genauigkeit laut Datenblatt', d.accuracy], ['Rauschen (Simulation, 1σ)', s.phys.sigma >= 0.01 ? `${(s.phys.sigma * 100).toFixed(1)} cm` : `${(s.phys.sigma * 1000).toFixed(2)} mm`],
    ['Strahldivergenz', `${s.phys.divH} × ${s.phys.divV ?? s.phys.divH} mrad`], ['Echos', s.returns.map((r) => RETURN_NAMES[r]).join(', ')],
    ['Kamera / Farbe', s.camera ? 'ja' : 'nein'], ['Gewicht', d.weight >= 1000 ? (d.weight / 1000).toLocaleString('de-DE') + ' kg' : d.weight + ' g'], ['Leistung', d.power + ' W'],
    ['Abmessungen', d.size], ['Schutzart', d.ip], ['Betriebstemperatur', d.temp], ['Schnittstelle', d.io], ['Richtpreis', fmtPrice(s.price)],
  ];
  const table = h('table.t', h('tbody', rows.map(([k, v]) => h('tr', h('td', k), h('td', String(v))))));
  const left = h('div', h('div.pv', h('img', { src: thumbOf(s.id), style: { width: '100%', display: 'block' } })), h('p.muted', { style: { fontSize: '12.5px', lineHeight: '1.45' } }, s.tagline), s.notes ? h('p', { style: { fontSize: '12.5px', lineHeight: '1.5', color: '#c2cbd4' } }, s.notes) : null);
  const right = h('div', h('div.cap', 'Abtastmuster ' + (s.pattern.type === 'rosette' || s.pattern.type === 'dome' ? '(0,25 s, nicht wiederholend)' : s.pattern.type === 'tls' ? '(ausgedünnt)' : '(0,1 s)')), h('div.pv', pv), h('div', { style: { height: '10px' } }), table);
  const body = h('div.dsheet', left, right);
  const m = modal(`${s.maker} ${s.model}`, body, [
    { label: 'Schließen' },
    { label: 'Diesen Scanner verwenden', primary: true, run: () => { if (onPick) onPick(); app.replaceDevice(s.id); } },
  ], { width: 'min(980px, 100%)' });
  requestAnimationFrame(() => drawPattern(pv, s));
  return m;
}

function compare(app, ids) {
  const list = ids.map((id) => BY_ID[id]);
  const rows = [
    ['Klasse', (s) => CLASSES[s.cls].short], ['Preis', (s) => fmtPrice(s.price)], ['Punkte/s', (s) => fmtInt(s.data.pts)],
    ['Reichweite max.', (s) => s.phys.rangeMax + ' m'], ['@ 10 % Reflektivität', (s) => s.phys.r10 + ' m'], ['Mindestabstand', (s) => s.phys.rangeMin + ' m'],
    ['Rauschen 1σ', (s) => (s.phys.sigma * 1000).toFixed(s.phys.sigma < 0.001 ? 2 : 1) + ' mm'], ['Sichtfeld', (s) => `${s.data.fovH}° × ${String(s.data.fovV).split(' ')[0]}`],
    ['Divergenz', (s) => `${s.phys.divH} mrad`], ['Wellenlänge', (s) => s.wavelength + ' nm'], ['Echos', (s) => s.returns.length > 1 ? s.returns.length + ' Modi' : '1'],
    ['Kamera', (s) => (s.camera ? 'ja' : '–')], ['Gewicht', (s) => s.data.weight + ' g'], ['Leistung', (s) => s.data.power + ' W'],
  ];
  const t = h('table.t', h('thead', h('tr', h('th', ''), list.map((s) => h('th', `${s.maker} ${s.model}`)))), h('tbody', rows.map(([k, f]) => h('tr', h('td', k), list.map((s) => h('td', String(f(s))))))));
  modal('Vergleich', h('div', { style: { overflowX: 'auto' } }, t), [{ label: 'Schließen' }], { width: 'min(1000px, 100%)' });
}
