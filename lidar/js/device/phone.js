// Smartphone mit LiDAR-Scanner-App „ECHO Scan“ (Querformat). Wie die echten Apps: Kamerabild mit den 576
// Laserpunkten oder dem fusionierten Tiefenbild als Überlagerung, wachsendes AR-Netz während der Aufnahme,
// Hinweise zu Tempo und Abstand, danach Verarbeitung zu Netz und Punktwolke und Übergabe ans Projekt.
// Pose: visuell-inertiale Odometrie (ARKit-artig) mit etwa 1 % Drift der Wegstrecke.
import * as THREE from 'three';
import { h, toast, fmtInt, fmtNum } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { Scan } from '../cloud/project.js';
import { Localizer } from '../cloud/localizer.js';
import { meshScan, addMeshToProject } from '../cloud/meshing.js';

export const PHONE_LAYER = 4;
const D = Math.PI / 180;

const TURBO = Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
  const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
  const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
  return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * 255))));
});

export class PhoneApp {
  constructor(app) {
    this.app = app;
    this.opts = { overlay: 'dots', mode: 'objekt', range: 3, mesh: true };
    this.session = null;
    this.result = null;
    this.cam = new THREE.PerspectiveCamera(48, 61 / 48, 0.03, 60);
    this.cam.layers.set(0); this.cam.layers.enable(PHONE_LAYER);
    this.build();
    this.visible = false;
  }

  build() {
    const el = h('div.phone.hidden');
    const scr = h('div.pscreen');
    this.camEl = h('div.pcam');
    this.ov = h('canvas.pov');
    this.hud = h('div.phud.mono');
    this.hint = h('div.phint');
    this.camEl.append(this.ov, this.hud, this.hint);
    const side = h('div.pside');
    this.ovBtn = h('button.pbtn', { title: 'Überlagerung wechseln' });
    this.ovBtn.addEventListener('click', () => { const L = ['dots', 'depth', 'none']; this.opts.overlay = L[(L.indexOf(this.opts.overlay) + 1) % L.length]; this.renderSide(); });
    this.modeBtn = h('button.pbtn', { title: 'Objekt umrunden oder Raum erfassen' });
    this.modeBtn.addEventListener('click', () => { if (this.session) return; this.opts.mode = this.opts.mode === 'objekt' ? 'raum' : 'objekt'; this.renderSide(); });
    this.rangeBtn = h('button.pbtn', { title: 'Maximale Tiefe für die Aufnahme' });
    this.rangeBtn.addEventListener('click', () => { if (this.session) return; const L = [1.5, 3, 5]; this.opts.range = L[(L.indexOf(this.opts.range) + 1) % L.length]; this.renderSide(); });
    this.shutter = h('button.pshutter', { title: 'Scan starten / beenden' }, h('i'));
    this.shutter.addEventListener('click', () => this.toggle());
    side.append(this.modeBtn, this.rangeBtn, this.shutter, this.ovBtn);
    this.res = h('div.pres.hidden');
    scr.append(this.camEl, side, this.res);
    el.append(h('div.pnotch'), scr);
    this.el = el;
    this.renderSide();
  }

  renderSide() {
    const o = this.opts;
    this.ovBtn.innerHTML = `<b>${{ dots: '576', depth: 'Tiefe', none: 'Bild' }[o.overlay]}</b><small>Ansicht</small>`;
    this.modeBtn.innerHTML = `<b>${o.mode === 'objekt' ? 'Objekt' : 'Raum'}</b><small>Modus</small>`;
    this.rangeBtn.innerHTML = `<b>${fmtNum(o.range, o.range % 1 ? 1 : 0)} m</b><small>Reichweite</small>`;
    this.shutter.classList.toggle('on', !!this.session);
    this.modeBtn.disabled = this.rangeBtn.disabled = !!this.session;
  }

  setDevice(d) {
    const on = !!d && d.kind === 'phone';
    this.dev = on ? d : null;
    this.visible = on;
    this.el.classList.toggle('hidden', !on);
    if (this.view) this.view.enabled = on;
    if (on) { d.onDepth = (m) => this.onDepth(m); if (d.state !== 'stream') d.start(); }
    this.app.sceneEl.classList.toggle('withphone', on);
  }

  // Kamera der App = optisches Zentrum des Telefons (blickt entlang Sensor +Z)
  syncCamera() {
    const d = this.dev;
    if (!d) return;
    const s = d.model.sensor;
    s.updateWorldMatrix(true, false);
    s.matrixWorld.decompose(this.cam.position, this.cam.quaternion, new THREE.Vector3());
    this.cam.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    this.cam.updateMatrixWorld();
  }

  /* ---------- Aufnahme ---------- */
  toggle() {
    if (this.busy) return;
    if (this.session) { this.app.mounts.stopJob(null); this.finish(); return; }
    this.result = null;
    this.res.classList.add('hidden');
    this.app.mounts.opts.hand.phoneMode = this.opts.mode;
    this.app.mounts.start();
  }

  // vom Rundgang (Mounts) aufgerufen, sobald die Person am Startpunkt steht
  begin(job) {
    const a = this.app, d = this.dev;
    if (!d) return;
    if (d.state !== 'stream') d.start();
    const n = a.project.scans.filter((s) => s.kind === 'phone').length + 1;
    const scan = new Scan({ kind: 'phone', spec: d.spec, set: d.set, name: `iPhone-Scan ${String(n).padStart(2, '0')}${job && job.target ? ' · ' + job.target.name : ''}`, origin: new THREE.Vector3(...d.pose().slice(0, 3)), limit: 6e6 });
    a.project.add(scan);
    const loc = new Localizer(a, d, scan, { mode: 'odo', drift: 'vio', listen: false, seed: 4711 + n });
    this.session = { scan, loc, t0: a.clock.t, frames: 0, used: 0, lastMesh: a.clock.t, meshBusy: false, job, speed: 0, rot: 0, lastP: null, hints: '' };
    this.renderSide();
  }

  onDepth(m) {
    this.last = m;
    const S = this.session;
    if (!S || m.t < S.t0) return;
    S.frames++;
    if (S.frames % 3) return; // 5 Bilder/s in die Wolke (wie die Apps: Schlüsselbilder)
    this.integrate(m, S);
  }

  // dichtes Tiefenbild mit VIO-Pose in Weltpunkte umrechnen (jedes zweite Pixel, nur mittlere/hohe Konfidenz)
  integrate(m, S) {
    const W = m.w, H = m.h, dep = m.depth, conf = m.conf;
    const fovH = this.dev.spec.pattern.fovH, fovV = this.dev.spec.pattern.fovV;
    const tx = Math.tan(fovH * D / 2), ty = Math.tan(fovV * D / 2);
    const M = S.loc.estimateAt(m.t, new THREE.Matrix4()).elements;
    const T = S.loc.truth.at(m.t, new THREE.Matrix4()).elements;
    const max = (W / 2) * (H / 2);
    const b = { n: 0, w: new Float32Array(max * 3), ls: new Float32Array(max * 3), rgb: new Uint8Array(max * 3), i: new Uint8Array(max), ret: new Uint8Array(max), cls: new Uint8Array(max), ring: new Uint16Array(max), f: new Uint8Array(max), t: new Float32Array(max), obj: new Uint16Array(max) };
    for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
      const id = j * W + i, z = dep[id];
      if (!z || z > this.opts.range || conf[id] < 1) continue;
      const x = ((i + 0.5) / W * 2 - 1) * tx, y = (1 - (j + 0.5) / H * 2) * ty;
      const lx = -x * z, ly = y * z, lz = z, k = b.n++;
      b.ls[k * 3] = lx; b.ls[k * 3 + 1] = ly; b.ls[k * 3 + 2] = lz;
      b.w[k * 3] = M[0] * lx + M[4] * ly + M[8] * lz + M[12]; b.w[k * 3 + 1] = M[1] * lx + M[5] * ly + M[9] * lz + M[13]; b.w[k * 3 + 2] = M[2] * lx + M[6] * ly + M[10] * lz + M[14];
      b.rgb[k * 3] = m.rgb[id * 3]; b.rgb[k * 3 + 1] = m.rgb[id * 3 + 1]; b.rgb[k * 3 + 2] = m.rgb[id * 3 + 2];
      b.i[k] = conf[id] === 2 ? 200 : 110; b.ret[k] = 1 | (1 << 4); b.cls[k] = 1; b.ring[k] = j; b.f[k] = 0; b.t[k] = m.t; b.obj[k] = m.obj[id];
    }
    if (!b.n) return;
    S.scan.cloud.add(b);
    S.used++;
    S.scan.traj.push([m.t, M[12], M[13], M[14]]);
    S.scan.trajTrue.push([m.t, T[12], T[13], T[14]]);
  }

  async finish() {
    const S = this.session, a = this.app;
    if (!S) return;
    this.session = null;
    this.busy = true;
    this.renderSide();
    const info = S.loc.finish();
    S.scan.stats.duration = a.clock.t - S.t0;
    S.scan.cloud.recomputeBox();
    this.dropPreview();
    if (!S.scan.points) { a.project.remove(S.scan); this.busy = false; toast('Kein Punkt aufgenommen – näher an das Objekt?', 'warn'); this.renderSide(); return; }
    this.showResult(`Verarbeitung … ${fmtInt(S.scan.points)} Punkte`);
    const t0 = performance.now();
    const voxel = this.opts.mode === 'objekt' ? 0.012 : 0.02;
    let tris = 0;
    try {
      const res = await meshScan(a, S.scan, voxel, { maxPoints: 2.5e6 });
      if (res) { addMeshToProject(a, S.scan, res, voxel, `Netz · ${S.scan.name}`); tris = res.r.index.length / 3; }
    } catch (e) { console.error(e); }
    this.busy = false;
    this.result = { scan: S.scan, tris, ms: performance.now() - t0, drift: info.endErr, dist: info.dist, dur: S.scan.stats.duration };
    this.showResult();
    a.fpc.render();
    toast(`${S.scan.name}: ${fmtInt(S.scan.points)} Punkte, ${fmtInt(tris)} Dreiecke – im Feldrechner unter „Scans“`, 'ok');
    this.renderSide();
  }

  showResult(text) {
    const R = this.result;
    this.res.classList.remove('hidden');
    if (text) { this.res.innerHTML = `<div class="mono">${text}</div>`; return; }
    if (!R) { this.res.classList.add('hidden'); return; }
    this.res.innerHTML = '';
    const close = h('button.pbtn.small', { html: icon('close') });
    close.addEventListener('click', () => this.res.classList.add('hidden'));
    const show = h('button.pbtn.wide', { html: '<b>Im Feldrechner zeigen</b>' });
    show.addEventListener('click', () => { this.app.fpc.setTab('scans'); this.app.fpc.fit(); });
    this.res.append(h('div.ptitle', 'Scan fertig'), h('div.mono', `${fmtInt(R.scan.points)} Punkte · ${fmtInt(R.tris)} Dreiecke`),
      h('div.mono.muted', `${fmtNum(R.dur, 0)} s · ${fmtNum(R.dist, 1)} m Weg · Drift ${fmtNum(R.drift * 100, 1)} cm`), show, close);
  }

  // Vorschau-Netz während der Aufnahme (grob, alle ~2 s)
  async updatePreview(S) {
    if (S.meshBusy || !this.opts.mesh || S.scan.points < 4000) return;
    S.meshBusy = true;
    try {
      const res = await meshScan(this.app, S.scan, 0.04, { maxPoints: 180000, trunc: 2.5 });
      if (res && this.session === S) {
        this.dropPreview();
        const m = new THREE.Mesh(res.geo, new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }));
        m.layers.set(PHONE_LAYER);
        m.renderOrder = 5;
        this.app.world.clouds.add(m);
        this.preview = m;
      }
    } catch (e) { console.error(e); }
    S.meshBusy = false;
    S.lastMesh = this.app.clock.t;
  }
  dropPreview() {
    if (!this.preview) return;
    this.preview.removeFromParent();
    this.preview.geometry.dispose();
    this.preview = null;
  }

  /* ---------- je Bild ---------- */
  frame(dt) {
    if (!this.visible || !this.dev) return;
    const S = this.session, a = this.app;
    if (S) {
      S.loc.update(a.clock.t);
      if (a.clock.t - S.lastMesh > 2) this.updatePreview(S);
      // Bewegung (aus der Bahn): Tempo und Drehrate für die Hinweise
      const P = this.dev.pose();
      const p = new THREE.Vector3(P[0], P[1], P[2]), q = new THREE.Quaternion(P[3], P[4], P[5], P[6]);
      if (S.lastP && dt > 0) {
        S.speed += (p.distanceTo(S.lastP.p) / dt - S.speed) * Math.min(1, dt * 3);
        S.rot += (q.angleTo(S.lastP.q) / dt - S.rot) * Math.min(1, dt * 3);
      }
      S.lastP = { p, q };
    }
    this.syncCamera();
    this.drawOverlay();
  }

  drawOverlay() {
    const c = this.ov, r = this.camEl.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const m = this.last, S = this.session;
    const fovH = this.dev.spec.pattern.fovH, fovV = this.dev.spec.pattern.fovV;
    const tx = Math.tan(fovH * D / 2), ty = Math.tan(fovV * D / 2);
    let center = 0;
    if (m && this.opts.overlay === 'depth' && m.depth) {
      // fusioniertes Tiefenbild 256 × 192 (Konfidenz niedrig = gestrichelt dunkler)
      const w = m.w, hh = m.h;
      if (!this._img || this._img.width !== w) { this._img = new ImageData(w, hh); this._cv = document.createElement('canvas'); this._cv.width = w; this._cv.height = hh; }
      const px = this._img.data;
      for (let k = 0; k < w * hh; k++) {
        const z = m.depth[k];
        if (!z) { px[k * 4 + 3] = 0; continue; }
        const col = TURBO[Math.max(0, Math.min(255, Math.round((1 - Math.min(1, z / 5)) * 255)))];
        px[k * 4] = col[0]; px[k * 4 + 1] = col[1]; px[k * 4 + 2] = col[2]; px[k * 4 + 3] = m.conf[k] === 0 ? 120 : m.conf[k] === 1 ? 190 : 225;
      }
      this._cv.getContext('2d').putImageData(this._img, 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage(this._cv, 0, 0, W, H);
    }
    if (m && this.opts.overlay === 'dots' && m.dots && m.dots.n) {
      // 576 Laserpunkte (8 × 8 VCSEL × 3 × 3 DOE), Farbe nach Entfernung
      const L = m.dots.ls;
      const rad = Math.max(2, W / 160);
      for (let k = 0; k < m.dots.n; k++) {
        const x = L[k * 3], y = L[k * 3 + 1], z = L[k * 3 + 2];
        if (z <= 0) continue;
        const u = (-x / z / tx * 0.5 + 0.5) * W, v = (0.5 - y / z / ty * 0.5) * H;
        const d = Math.hypot(x, y, z);
        const col = TURBO[Math.max(0, Math.min(255, Math.round((1 - Math.min(1, d / 5)) * 255)))];
        g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.95)`;
        g.beginPath(); g.arc(u, v, rad, 0, Math.PI * 2); g.fill();
      }
    }
    if (m && m.depth) { const id = (m.h >> 1) * m.w + (m.w >> 1); center = m.depth[id]; }
    // Fadenkreuz
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = dpr;
    g.beginPath(); g.moveTo(W / 2 - 10 * dpr, H / 2); g.lineTo(W / 2 + 10 * dpr, H / 2); g.moveTo(W / 2, H / 2 - 10 * dpr); g.lineTo(W / 2, H / 2 + 10 * dpr); g.stroke();
    // Statuszeile und Hinweise
    const pts = S ? S.scan.points : 0;
    const t = S ? this.app.clock.t - S.t0 : 0;
    this.hud.innerHTML = S
      ? `<span class="recdot"></span>${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')} · ${fmtInt(pts)} Pkt · ${center ? fmtNum(center, 2) + ' m' : '– m'}`
      : `LiDAR · 576 Punkte · 15 Hz · ${center ? fmtNum(center, 2) + ' m' : 'kein Echo'}`;
    let hint = '';
    if (S) {
      if (S.speed > 0.75 || S.rot > 1.3) hint = 'Langsamer bewegen';
      else if (!center || center > this.opts.range) hint = 'Näher herangehen';
      else if (center < 0.3) hint = 'Etwas mehr Abstand';
    } else if (!this.result && !this.busy) hint = this.opts.mode === 'objekt' ? 'Auslöser: Rundgang um das Objekt' : 'Auslöser: Raum rundum erfassen';
    this.hint.textContent = hint;
    this.hint.classList.toggle('hidden', !hint);
  }
}
