// Feldrechner „ECHO Field T10“: robustes Tablet mit eigener Scan-Software.
// Bereiche: Live, Scans, Ausrichten, Bearbeiten, Messen, Vergleich, Export, Gerät.
import * as THREE from 'three';
import { h, clear, toast } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { COLOR_MODES } from '../cloud/cloud.js';
import { Scan } from '../cloud/project.js';
import { makePattern } from '../scanners/patterns.js';
import { Localizer } from '../cloud/localizer.js';
import * as live from './tabs/live.js';
import * as scans from './tabs/scans.js';
import * as align from './tabs/align.js';
import * as edit from './tabs/edit.js';
import * as measure from './tabs/measure.js';
import * as compare from './tabs/compare.js';
import * as exp from './tabs/export.js';
import * as device from './tabs/device.js';

// Turbo-Farbskala (Google, 2019) als Tabelle
const TURBO = Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
  const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
  const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
  return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * 255))));
});

const TABS = [
  ['live', 'Live', 'live', live], ['scans', 'Scans', 'scans', scans], ['align', 'Ausricht.', 'align', align], ['edit', 'Bearb.', 'edit', edit],
  ['measure', 'Messen', 'measure', measure], ['compare', 'Vergl.', 'compare', compare], ['export', 'Export', 'export', exp], ['device', 'Gerät', 'device', device],
];

export const LEGEND = {
  intensity: 'linear-gradient(90deg,#000,#fff)', intensity_rb: 'linear-gradient(90deg,#30123b,#4662d7,#36aaf9,#1ae4b6,#72fe5e,#c8ef34,#faba39,#f66b19,#ca2a04,#7a0403)',
  height: 'linear-gradient(90deg,#30123b,#4662d7,#36aaf9,#1ae4b6,#72fe5e,#c8ef34,#faba39,#f66b19,#ca2a04,#7a0403)',
  range: 'linear-gradient(90deg,#fcffa4,#f98e09,#bc3754,#57106e,#000004)', time: 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)',
  deviation: 'linear-gradient(90deg,#1f51d9,#fafafa,#e3332a)',
};

export class FieldPC {
  constructor(app) {
    this.app = app;
    this.tab = 'live';
    this.dev = null;
    this.showLive = true;
    this.recording = null;
    this.opts = { mode: 'intensity_rb', size: 2, world: 0, edl: true, edlStrength: 1, hideBloom: false, hideNoise: false, hRange: [-0.2, 4], rMax: 25, dRange: [-0.02, 0.02], tint: '#5fd3ff', clip: null };
    this.rimgMode = 'range';
    this.build();
  }

  build() {
    const el = h('div.tablet');
    el.append(h('div.corner2'), h('div.corner3'), h('div.cam'), h('div.brandplate', 'ECHO FIELD T10'), h('div.hwbtn', { style: { top: '90px' } }), h('div.hwbtn', { style: { top: '134px' } }));
    for (const [x, y] of [[8, 8], [8, null], [null, 8], [null, null]]) el.appendChild(h('div.screw', { style: { left: x != null ? x + 'px' : 'auto', right: x == null ? '8px' : 'auto', top: y != null ? y + 'px' : 'auto', bottom: y == null ? '8px' : 'auto' } }));
    const scr = h('div.screen');
    this.sbar = h('div.sbar');
    const fapp = h('div.fapp');
    this.rail = h('nav.frail');
    for (const [id, label, ic] of TABS) {
      const b = h('button', { html: icon(ic) + `<span>${label}</span>`, 'data-tab': id });
      b.addEventListener('click', () => this.setTab(id));
      this.rail.appendChild(b);
    }
    const main = h('div.fmain');
    this.head = h('div.fhead');
    this.viewEl = h('div.fview');
    this.viewHit = h('div.hit');
    this.ovTL = h('div.ov.tl'); this.ovTR = h('div.ov.tr'); this.ovBL = h('div.ov.bl'); this.ovC = h('div.ov.c.hidden');
    this.vbtns = h('div.vbtns');
    for (const [ic, title, fn] of [['fit', 'Einpassen', () => this.fit()], ['top', 'Draufsicht', () => this.viewPreset('top')], ['front', 'Seitenansicht', () => this.viewPreset('front')], ['iso', 'Schrägansicht', () => this.viewPreset('iso')], ['scanner', 'Vom Scanner aus', () => this.viewPreset('sensor')]]) {
      const b = h('button.btn.small.icon', { html: icon(ic), title }); b.addEventListener('click', fn); this.vbtns.appendChild(b);
    }
    this.viewEl.append(this.viewHit);
    // Anzeigen über dem Viewer liegen in einer eigenen Ebene oberhalb des WebGL-Canvas
    this.vover = h('div#vover', this.ovTL, this.ovTR, this.ovBL, this.ovC, this.vbtns);
    // Live-Ansicht folgt dem Scanner (Ziel der Kamera wandert mit, Drehen und Zoomen bleiben frei)
    this.followOn = true;
    document.getElementById('ui').appendChild(this.vover);
    this.rimg = h('div.rimg.hidden');
    this.rimgCanvas = h('canvas');
    this.rimgLab = h('div.lab');
    this.rimg.append(this.rimgCanvas, this.rimgLab);
    this.rimg.addEventListener('click', () => { this.rimgMode = this.rimgMode === 'range' ? 'intensity' : 'range'; });
    this.panel = h('div.fpanel');
    main.append(this.head, this.viewEl, this.rimg, this.panel);
    fapp.append(this.rail, main);
    scr.append(this.sbar, fapp);
    el.appendChild(scr);
    this.el = el;
    this.app.project.listeners.push(() => { if (['scans', 'align', 'edit', 'compare', 'export', 'measure'].includes(this.tab)) this.render(); });
    this.setTab('live');
  }

  // Live-Ansicht folgt dem Scanner (Ziel der Kamera wandert mit, Drehen und Zoomen bleiben frei)
  bindViewer() {
    this.app.vorbit.follow = () => {
      const d = this.dev;
      if (!this.followOn || this.tab !== 'live' || !d) return null;
      const p = d.pose();
      return new THREE.Vector3(p[0], p[1] - 0.6, p[2]);
    };
  }

  setDevice(d) {
    this.dev = d;
    this.render();
  }

  setTab(id) {
    this.tab = id;
    for (const b of this.rail.children) b.classList.toggle('on', b.dataset.tab === id);
    this.render();
  }

  render() {
    const d = this.dev;
    clear(this.head);
    const T = TABS.find((t) => t[0] === this.tab);
    const titles = { live: 'Live-Ansicht', scans: 'Scans im Projekt', align: 'Ausrichten (Registrierung)', edit: 'Bearbeiten', measure: 'Messen', compare: 'Soll-Ist-Vergleich', export: 'Export', device: 'Gerät' };
    this.head.append(h('h3', titles[this.tab] || T[1]), h('div.sub', d ? `· ${d.spec.maker} ${d.spec.model}` : ''), h('div.grow'));
    const modeSel = h('select');
    for (const m of COLOR_MODES) { const o = h('option', { value: m.id }, m.name); if (m.id === this.opts.mode) o.selected = true; modeSel.appendChild(o); }
    modeSel.addEventListener('change', () => { this.opts.mode = modeSel.value; this.updateLegend(); });
    this.head.appendChild(h('div.sel', modeSel));
    clear(this.panel);
    this.panel.scrollTop = 0;
    T[3].render(this, this.panel);
    this.rimg.classList.toggle('hidden', !(this.tab === 'live' && d && d.rimg));
    this.updateLegend();
  }

  updateLegend() {
    const m = this.opts.mode;
    const name = COLOR_MODES.find((x) => x.id === m)?.short || '';
    let range = '';
    if (m === 'height') range = `${this.opts.hRange[0].toFixed(1)} … ${this.opts.hRange[1].toFixed(1)} m`;
    else if (m === 'range') range = `0 … ${this.opts.rMax} m`;
    else if (m === 'intensity' || m === 'intensity_rb') range = '0 … 110 %';
    else if (m === 'deviation') range = `${(this.opts.dRange[0] * 1000).toFixed(0)} … +${(this.opts.dRange[1] * 1000).toFixed(0)} mm`;
    const grad = LEGEND[m];
    this.ovTR.innerHTML = grad ? `<div class="legend"><span>${name}</span><span class="bar" style="background:${grad}"></span><span>${range}</span></div>` : `<div>${name}</div>`;
  }

  // jedes Bild: Statusleiste, Überlagerungen, Abstandsbild
  frame(dt) {
    const r = this.viewEl.getBoundingClientRect();
    const st = this.vover.style;
    const vis = r.width > 2 && !document.body.classList.contains('athome');
    st.display = vis ? 'block' : 'none';
    if (vis) { st.left = r.left + 'px'; st.top = r.top + 'px'; st.width = r.width + 'px'; st.height = r.height + 'px'; }
    this.ft = (this.ft || 0) + dt;
    if (this.ft < 0.12) return;
    this.ft = 0;
    const d = this.dev, a = this.app;
    const now = new Date();
    const link = d ? (d.kind === 'phone' ? 'ARKit' : d.spec.cls === 'tls' ? 'WLAN · ' + d.spec.model : 'ETH 100M · 192.168.1.201') : 'kein Gerät';
    const temp = d ? (34 + Math.min(14, a.clock.t * 0.02) + (d.state === 'stream' ? 4 : 0)).toFixed(0) : '–';
    this.sbar.innerHTML = `<span>${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span><span class="row" style="gap:4px">${icon('wifi')}${link}</span><span class="grow"></span><span>${temp} °C</span><span class="row" style="gap:4px">${icon('battery')}86 %</span>`;
    if (d) {
      const st = d.state === 'stream' ? `<span class="led acc"></span> LIVE` : d.state === 'tls' ? `<span class="led acc"></span> SCAN ${Math.round((this.tlsProgress || 0) * 100)} %` : '<span class="led"></span> BEREIT';
      const rate = d.stats.rate;
      const hit = d.stats.srate > 0 ? Math.min(100, (rate / d.stats.srate) * 100) : 0;
      const p = d.pattern;
      const freq = d.kind === 'tls' ? `${d.set.resolution} mm @ 10 m` : d.kind === 'depth' ? `${d.set.hz} Bilder/s` : p.hz ? `${p.hz} Hz` : '';
      this.ovTL.innerHTML = `<div class="row" style="gap:6px;color:#dbe2e9">${st} · ${freq}${this.recording ? ' · <span style="color:#ff6b5e">● AUFNAHME</span>' : ''}</div><div>${Math.round(rate).toLocaleString('de-DE')} Pkt/s · Treffer ${hit.toFixed(0)} % · ${(rate * d.stats.bytes * 8 / 1e6).toFixed(1)} Mbit/s</div>`;
    }
    // leere Ansicht erklären statt schwarz zu bleiben
    const visScans = a.project.scans.some((x) => x.visible && x.points);
    const empty = this.tab === 'live' && d && (d.state !== 'stream' && d.state !== 'tls') && !(this.showLive && d.live.count) && !visScans;
    this.ovC.classList.toggle('hidden', !empty);
    if (empty) this.ovC.innerHTML = d.mountKind === 'getragen' ? `${d.spec.model} wird nur getragen –<br>auf ein Stativ oder eine Plattform setzen` : d.kind === 'tls' ? 'Bereit für den Stationsscan –<br><b>F</b> am Stativ oder „Stationsscan starten“' : 'Laser aus –<br><b>F</b> am Scanner oder „Laser an“ unten';
    const tot = a.project.total;
    this.ovBL.textContent = `Projekt: ${a.project.scans.length} Scans · ${tot.toLocaleString('de-DE')} Punkte` + (d && d.live ? ` · Live ${d.live.count.toLocaleString('de-DE')}` : '');
    if (d && d.rimg && !this.rimg.classList.contains('hidden') && d.rimg.dirty) this.drawRangeImage(d);
    const T = TABS.find((t) => t[0] === this.tab);
    if (T[3].tick) T[3].tick(this);
  }

  drawRangeImage(d) {
    const R = d.rimg, W = d.cols, H = d.rows;
    const c = this.rimgCanvas;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; this.rimgData = c.getContext('2d').createImageData(W, H); }
    const img = this.rimgData, px = img.data;
    const mode = this.rimgMode, rmax = this.opts.rMax;
    // Zeile 0 = unterster Kanal → oben im Bild der höchste
    const order = d.pattern.elev ? d.pattern.elev.map((e, i) => [e, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]) : [...Array(H).keys()];
    for (let y = 0; y < H; y++) {
      const ring = order[y];
      for (let x = 0; x < W; x++) {
        const id = ring * W + x, o = (y * W + (W - 1 - x)) * 4;
        const r = R.r[id];
        if (!r) { px[o] = px[o + 1] = px[o + 2] = 8; px[o + 3] = 255; continue; }
        if (mode === 'range') {
          const c = TURBO[Math.min(255, Math.round((1 - Math.min(1, r / rmax)) * 255))];
          px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
        } else { const v = Math.min(255, Math.pow(R.i[id] / 110, 0.7) * 255); px[o] = px[o + 1] = px[o + 2] = v; }
        px[o + 3] = 255;
      }
    }
    c.getContext('2d').putImageData(img, 0, 0);
    R.dirty = false;
    this.rimgLab.textContent = `${mode === 'range' ? 'Abstandsbild' : 'Reflektivitätsbild'} · ${H} × ${W} (tippen zum Wechseln)`;
  }

  /* ---------- Ansicht ---------- */
  visibleBox() {
    const box = new THREE.Box3();
    for (const s of this.app.project.scans) if (s.visible && s.points) { const b = s.cloud.box.clone(); if (s.local) b.applyMatrix4(s.pose); box.union(b); }
    if (box.isEmpty() && this.dev && this.dev.live.count) {
      const p = this.dev.pose();
      box.setFromCenterAndSize(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(16, 4, 16));
    }
    return box;
  }
  // Blick hinter dir auf den Scanner (beim Hochnehmen des Feldrechners)
  aimAtDevice() {
    const d = this.dev, a = this.app;
    if (!d) return;
    const p = d.pose(), P = a.player;
    const indoor = !!a.world.bounds && a.sceneId !== 'aussen' && a.sceneId !== 'pruef';
    const dist = a.sceneId === 'wohnung' || a.sceneId === 'messraum' ? 4.5 : indoor ? 9 : 14;
    a.vorbit.lookAt(new THREE.Vector3(p[0], p[1] - 0.6, p[2]), dist, (P ? P.yaw : 0) + Math.PI, 0.62);
  }

  fit() {
    const box = this.visibleBox();
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const o = this.app.vorbit;
    o.lookAt(c, Math.max(2, Math.max(s.x, s.z) * 0.9), o.goal.yaw, o.goal.pitch);
  }
  viewPreset(k) {
    const o = this.app.vorbit;
    const box = this.visibleBox();
    const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const s = box.isEmpty() ? 10 : Math.max(...box.getSize(new THREE.Vector3()).toArray());
    if (k === 'top') o.lookAt(c, s * 1.1, 0, 1.45);
    else if (k === 'front') o.lookAt(c, s * 0.9, 0, 0.02);
    else if (k === 'iso') o.lookAt(c, s * 0.85, 0.78, 0.6);
    else if (k === 'sensor' && this.dev) { const p = this.dev.pose(); o.lookAt(new THREE.Vector3(p[0], p[1], p[2]), 0.25, o.goal.yaw, 0.08); }
  }

  onViewerTap(info) {
    const T = TABS.find((t) => t[0] === this.tab);
    if (T[3].tap) T[3].tap(this, info);
  }

  objectInfo(obj, point) {
    this.app.selected = obj;
    toast(`${obj.name}${point ? ` · ${point.distanceTo(new THREE.Vector3(...this.dev.pose().slice(0, 3))).toFixed(2)} m vom Scanner` : ''}`);
    if (this.tab === 'compare' || this.tab === 'edit') this.render();
  }

  /* ---------- Aufnahme (mobile Scanner) ---------- */
  // Aufnahme eines bewegten (oder festen) Scanners; die Positionsbestimmung kommt von der Halterung
  toggleRecord(o = {}) {
    const d = this.dev, a = this.app;
    if (!d || d.kind === 'tls') return null;
    if (this.recording) {
      const r = this.recording;
      const info = r.loc.finish();
      r.scan.stats.duration = a.clock.t - r.t0;
      r.scan.cloud.recomputeBox();
      this.recording = null;
      const drift = info.mode !== 'ideal' && !info.turntable ? ` · Bahnabweichung am Ende ${(info.endErr * 100).toFixed(info.endErr < 0.1 ? 1 : 0)} cm` : '';
      toast(`${r.scan.name}: ${r.scan.points.toLocaleString('de-DE')} Punkte in ${r.scan.stats.duration.toFixed(1)} s${drift}`, 'ok');
      a.top.render();
      this.render();
      return r.scan;
    }
    if (d.state !== 'stream') d.start();
    const pos = a.mounts ? a.mounts.recordOptions(d, o) : { mode: 'ideal', drift: 'fixed', deskew: true };
    const scan = new Scan({ kind: 'mobile', spec: d.spec, set: d.set, name: o.name || `Aufnahme ${d.spec.model}`, origin: new THREE.Vector3(...d.pose().slice(0, 3)) });
    if (pos.keepEvery > 1) scan.stats.decimate = pos.keepEvery;
    a.project.add(scan);
    const loc = new Localizer(a, d, scan, pos);
    this.recording = { scan, loc, t0: a.clock.t };
    a.top.render();
    this.render();
    return scan;
  }

  /* ---------- Stationsscan (TLS) ---------- */
  async stationScan() {
    const d = this.dev, a = this.app;
    if (!d) return;
    if (d.state === 'tls') { a.engine.cancel(this.tlsJob); return; }
    const nominal = makePattern(d.spec, d.set);
    const dec = Math.max(1, Math.ceil(Math.sqrt(nominal.nominalPoints / (d.set.budget || 3e6))));
    const simSet = { ...d.set, decimate: dec };
    const pat = makePattern(d.spec, simSet);
    const sid = d.id + '#tls';
    a.engine.addSensor(sid, d.spec, simSet);
    const P = d.pose();
    const pose = new THREE.Matrix4().compose(new THREE.Vector3(P[0], P[1], P[2]), new THREE.Quaternion(P[3], P[4], P[5], P[6]), new THREE.Vector3(1, 1, 1));
    const n = a.project.scans.filter((s) => s.kind === 'station').length + 1;
    const scan = new Scan({ kind: 'station', spec: d.spec, set: simSet, name: `Station ${String(n).padStart(2, '0')}`, origin: new THREE.Vector3(P[0], P[1], P[2]), truePose: pose, pose: this.prealign(pose, n), local: true, limit: pat.points * 1.25 + 2e5 });
    scan.registered = n === 1;
    scan.stats.nominal = nominal.nominalPoints; scan.stats.duration = nominal.duration * (d.set.quality || 1); scan.stats.decimate = dec;
    a.project.add(scan);
    d.state = 'tls';
    this.tlsProgress = 0;
    a.top.render();
    this.setTab('live');
    const per = pat.rowsPerSide * 2;
    const chunk = Math.max(1, Math.floor(45000 / per));
    let done = 0;
    const t0 = performance.now();
    const rot = d.model.rotor;
    const job = a.engine.tls(sid, P, 0, pat.cols, chunk, (m) => {
      scan.cloud.add(m.data);
      done += m.c1 - m.c0;
      this.tlsProgress = done / pat.cols;
      if (rot) rot.rotation.y = -this.tlsProgress * Math.PI;
    });
    this.tlsJob = a.engine.lastTlsJob;
    const ok = await job;
    d.state = 'idle';
    scan.stats.ms = performance.now() - t0;
    scan.cloud.recomputeBox();
    if (rot) rot.rotation.y = 0;
    a.engine.dropSensor(sid);
    a.top.render();
    if (!ok) { toast('Stationsscan abgebrochen', 'warn'); a.project.remove(scan); return; }
    toast(`${scan.name}: ${scan.points.toLocaleString('de-DE')} Punkte (Gerätezeit ${Math.round(scan.stats.duration)} s, Simulation 1:${dec * dec})`, 'ok');
    this.render();
    if (a.project.scans.filter((s) => s.kind === 'station').length === 1) this.fit();
  }

  // Vorausrichtung neuer Stationen: wie mit VIS/Kompass – einige Zentimeter und Zehntelgrad daneben
  prealign(truePose, n) {
    if (n === 1) return truePose.clone();
    const err = this.app.registrationNoise ?? 1;
    const r = () => (Math.random() * 2 - 1);
    const dt = new THREE.Vector3(r() * 0.08 * err, r() * 0.02 * err, r() * 0.08 * err);
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.004 * err, r() * 0.03 * err, r() * 0.004 * err));
    const m = truePose.clone();
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(p, q, s);
    q.premultiply(dq); p.add(dt);
    return new THREE.Matrix4().compose(p, q, s);
  }
}
