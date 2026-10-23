// ECHO · App: Takt, Ansichten, Welt, Scan-Engine, Geräte und Oberfläche.
import * as THREE from 'three';
import { OrbitCam } from '../../kinetik/js/render/camera.js';
import { Views, EDLPass } from './render/views.js';
import { World } from './world/world.js';
import { SCENES } from './world/scenes.js';
import { ScanEngine } from './engine/engine.js';
import { LidarWorld } from './engine/lidarworld.js';
import { CLOUD_LAYER, MESH_LAYER } from './cloud/cloud.js';
import { BY_ID } from './scanners/catalog.js';
import { ScannerDevice } from './scanners/device.js';
import { Project } from './cloud/project.js';
import { Proc } from './cloud/proc.js';
import { FieldPC } from './device/fieldpc.js';
import { TopBar } from './ui/topbar.js';
import { Home } from './ui/home.js';
import { h, toast } from './ui/dom.js';
import { icon } from './ui/icons.js';

export class App {
  constructor(R, report = () => {}) {
    this.R = R;
    this.report = report;
    this.clock = { t: 0, speed: 1, paused: false, factor: 1 };
    this.devices = [];
    this.dev = null;
    this.view = { beams: false, cloudInScene: true, sceneMode: 'flat', scenePoint: 2 };
  }

  async init() {
    const canvas = document.getElementById('gl');
    this.views = new Views(canvas);
    this.world = new World(this, this.R);
    this.world.setEnvMap(this.views.r);
    this.engine = new ScanEngine();
    this.lw = new LidarWorld(this.engine);
    this.project = new Project(this);
    this.proc = new Proc();
    this.edl = new EDLPass();
    this.buildUI();
    this.setupViews();
    this.keys();
    this.report('HALLE WIRD AUFGEBAUT …');
    await this.loadScene('halle');
    const d = this.addDevice('vlp16');
    d.mountOn('stativ');
    const st = SCENES.halle.start.scanner;
    d.setPosition(st[0], st[2], 0);
    await this.rebuildLidar();
    this.select(d);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------------- Oberfläche ---------------- */
  buildUI() {
    const ui = document.getElementById('ui');
    this.ui = ui;
    this.top = new TopBar(this);
    ui.appendChild(this.top.el);
    this.sceneEl = h('div#scene');
    this.sceneHit = h('div#scene-hit');
    this.tagsEl = h('div#tags');
    this.toolsEl = h('div#tools');
    this.hintEl = h('div#hint.hidden');
    this.statusEl = h('div#status');
    this.sceneEl.append(this.sceneHit, this.tagsEl, this.toolsEl, this.hintEl, this.statusEl);
    ui.appendChild(this.sceneEl);
    this.dock = h('div#dock');
    ui.appendChild(this.dock);
    this.fpc = new FieldPC(this);
    this.dock.appendChild(this.fpc.el);
    this.home = new Home(this);
    ui.appendChild(this.home.el);
    this.buildTools();
    this.hud = h('div.hud.mono');
    this.statusEl.appendChild(this.hud);
  }

  buildTools() {
    const T = this.toolsEl;
    const tool = (name, title, fn, on) => {
      const b = h('button.btn.icon' + (on ? '.on' : ''), { html: icon(name), title });
      b.addEventListener('click', () => fn(b));
      T.appendChild(b);
      return b;
    };
    this.tool = 'move';
    const set = (b, t) => { this.tool = t; for (const x of T.querySelectorAll('.tsel')) x.classList.toggle('on', x === b); };
    tool('move', 'Scanner verschieben (ziehen)', (b) => set(b, 'move'), true).classList.add('tsel');
    tool('target', 'Objekt auswählen', (b) => set(b, 'select')).classList.add('tsel');
    T.appendChild(h('hr'));
    tool('beam', 'Laserstrahlen anzeigen', (b) => { this.view.beams = !this.view.beams; b.classList.toggle('on', this.view.beams); });
    tool('layers', 'Punktwolke in der Szene', (b) => { this.view.cloudInScene = !this.view.cloudInScene; b.classList.toggle('on', this.view.cloudInScene); }, true);
    tool('eye', 'Blick vom Scanner', () => this.lookFromScanner());
    tool('reset', 'Ansicht zurücksetzen', () => this.resetCamera());
  }

  setupViews() {
    // 3D-Szene
    this.sceneCam = new THREE.PerspectiveCamera(48, 1, 0.05, 600);
    this.sceneCam.layers.enable(0); this.sceneCam.layers.enable(CLOUD_LAYER);
    this.orbit = new OrbitCam(this.sceneCam, this.sceneHit);
    this.orbit.maxDist = 120; this.orbit.minDist = 0.6;
    this.orbit.interceptor = (e, info) => this.sceneGrab(e, info);
    this.orbit.onTap = (info) => this.sceneTap(info);
    this.views.add({
      name: 'scene', el: this.sceneEl, camera: this.sceneCam, enabled: true,
      render: (r, rect, dpr) => {
        this.setCloudUniforms('scene', rect, dpr, this.sceneCam);
        for (const c of this.allClouds()) c.group.visible = this.view.cloudInScene && (c.isLive || c.visibleInScene);
        r.clear(true, true, true);
        r.render(this.world.scene, this.sceneCam);
      },
    });
    // Bildschirm des Feldrechners
    this.viewerCam = new THREE.PerspectiveCamera(55, 1, 0.03, 800);
    this.viewerCam.layers.set(CLOUD_LAYER);
    this.viewerCam.layers.enable(MESH_LAYER);
    this.vorbit = new OrbitCam(this.viewerCam, this.fpc.viewHit);
    this.vorbit.maxDist = 300; this.vorbit.minDist = 0.2;
    this.vorbit.onTap = (info) => this.fpc.onViewerTap(info);
    this.views.add({
      name: 'viewer', el: this.fpc.viewEl, camera: this.viewerCam, enabled: true,
      render: (r, rect, dpr) => {
        this.setCloudUniforms('viewer', rect, dpr, this.viewerCam);
        for (const c of this.allClouds()) c.group.visible = c.isLive ? this.fpc.showLive : c.visible !== false;
        const hl = this.world.headlight;
        hl.position.copy(this.viewerCam.position); hl.target.position.copy(this.vorbit.target); hl.target.updateMatrixWorld();
        this.edl.mat.uniforms.enabled.value = this.fpc.opts.edl ? 1 : 0;
        this.edl.mat.uniforms.strength.value = this.fpc.opts.edlStrength;
        this.edl.render(r, this.world.scene, this.viewerCam, rect, dpr);
      },
    });
  }

  allClouds() {
    const L = [];
    for (const d of this.devices) if (d.live) L.push(d.live);
    for (const s of this.project.scans) if (s.cloud) L.push(s.cloud);
    return L;
  }

  setCloudUniforms(which, rect, dpr, cam) {
    const o = which === 'viewer' ? this.fpc.opts : { mode: this.view.sceneMode, size: this.view.scenePoint, world: 0 };
    const pxScale = (rect.h * dpr) / (2 * Math.tan((cam.fov * Math.PI / 180) / 2));
    for (const c of this.allClouds()) {
      const u = c.material.uniforms;
      c.setMode(o.mode);
      u.size.value = (o.size || 2) * dpr;
      u.sizeWorld.value = o.world || 0;
      u.pxScale.value = pxScale;
      if (o.hRange) u.hRange.value.set(o.hRange[0], o.hRange[1]);
      if (which === 'scene') { u.tint.value.set(c.isLive ? '#ff4b3a' : '#35d0ff'); }
      else u.tint.value.set(o.tint || '#5fd3ff');
      if (c.isLive && this.dev) { const p = this.dev.pose(); u.origin.value.set(p[0], p[1], p[2]); }
      else if (c.scan) u.origin.value.copy(c.scan.origin);
      u.rRange.value.set(0, o.rMax || 30);
      u.tRange.value.set(c.tMin === Infinity ? 0 : c.tMin, c.tMax === -Infinity ? 1 : c.tMax);
      u.hideBloom.value = o.hideBloom ? 1 : 0;
      u.hideNoise.value = o.hideNoise ? 1 : 0;
      if (o.dRange) u.dRange.value.set(o.dRange[0], o.dRange[1]);
      if (which === 'viewer' && o.clip) { u.clipMin.value.set(o.clip.min.x, o.clip.min.y, o.clip.min.z, 1); u.clipMax.value.set(o.clip.max.x, o.clip.max.y, o.clip.max.z, 1); }
      else { u.clipMin.value.w = 0; u.clipMax.value.w = 0; }
    }
  }

  /* ---------------- Szene & Geräte ---------------- */
  async loadScene(id) {
    const def = SCENES[id];
    for (const d of this.devices) { d.stop(); d.unmount(); }
    this.world.clear();
    this.world.setLighting(def.lighting, { bg: def.bg, ...(def.light || {}) });
    def.build(this.world);
    this.world.def = def;
    this.sceneId = id;
    this.engine.setEnv(this.world.setWeather(def.weather || 'klar'));
    for (const d of this.devices) { d.regObj = null; d.mountOn('stativ'); d.setPosition(def.start.scanner[0], def.start.scanner[2], def.start.scanner[3] || 0); }
    const c = def.start.cam;
    this.orbit.lookAt(new THREE.Vector3(...c.target), c.dist, c.yaw, c.pitch);
    this.orbit.jump();
    this.vorbit.lookAt(new THREE.Vector3(...c.target), c.dist * 0.8, c.yaw, Math.min(1.2, c.pitch + 0.25));
    this.vorbit.jump();
    if (this.top) this.top.render();
  }

  async rebuildLidar() {
    const t0 = performance.now();
    const info = await this.lw.build(this.world.content);
    for (const d of this.devices) this.engine.addSensor(d.id, d.spec, d.set);
    this.lidarInfo = info;
    console.log(`LiDAR-Szene: ${info.tris.toLocaleString('de-DE')} Dreiecke, ${info.bodies} Körper, ${info.materials} Materialien, ${Math.round(performance.now() - t0)} ms`);
    return info;
  }

  addDevice(specId) {
    const d = new ScannerDevice(this, BY_ID[specId]);
    this.devices.push(d);
    this.engine.addSensor(d.id, d.spec, d.set);
    return d;
  }

  async replaceDevice(specId) {
    const old = this.dev;
    const pos = old ? old.root.position.clone() : new THREE.Vector3();
    const ry = old ? old.root.rotation.y : 0;
    const wasRunning = old && old.state === 'stream';
    if (old) { old.dispose(); this.devices.splice(this.devices.indexOf(old), 1); if (old.regObj) this.world.objects.splice(this.world.objects.indexOf(old.regObj), 1); }
    const d = this.addDevice(specId);
    d.mountOn('stativ');
    d.setPosition(pos.x, pos.z, ry);
    await this.rebuildLidar();
    this.select(d);
    if (wasRunning && d.kind !== 'tls') d.start();
    toast(`${d.spec.maker} ${d.spec.model} montiert`);
    return d;
  }

  select(d) {
    this.dev = d;
    this.fpc.setDevice(d);
    this.top.render();
  }

  toggleStream() {
    const d = this.dev;
    if (!d) return;
    if (d.kind === 'tls') { this.fpc.stationScan(); return; }
    if (d.state === 'stream') d.stop(); else d.start();
    this.top.render();
    this.fpc.render();
  }

  /* ---------------- Interaktion in der Szene ---------------- */
  rayFromScreen(info) {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(info.nx, info.ny), this.sceneCam);
    r.layers.set(0);
    return r;
  }
  sceneGrab(e, info) {
    if (this.tool !== 'move' || !this.dev || this.dev.mountKind !== 'stativ' || this.dev.state === 'tls') return null;
    const rc = this.rayFromScreen(info);
    const hits = rc.intersectObject(this.dev.root, true);
    if (!hits.length) return null;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const d = this.dev;
    const start = d.root.position.clone();
    const p0 = rc.ray.intersectPlane(plane, new THREE.Vector3());
    if (!p0) return null;
    this.setHint('Stativ verschieben – loslassen zum Absetzen');
    return {
      move: (m) => {
        const r2 = this.rayFromScreen(m);
        const p = r2.ray.intersectPlane(plane, new THREE.Vector3());
        if (!p) return;
        d.setPosition(start.x + p.x - p0.x, start.z + p.z - p0.z);
      },
      end: () => { this.setHint(null); this.lw.sync(); },
    };
  }
  sceneTap(info) {
    const rc = this.rayFromScreen(info);
    const hits = rc.intersectObject(this.world.content, true);
    for (const hh of hits) {
      let o = hh.object;
      while (o && o.userData.objId == null) o = o.parent;
      if (o) { const obj = this.world.objectById(o.userData.objId); if (obj) { this.selected = obj; this.fpc.objectInfo(obj, hh.point); return; } }
    }
  }
  setHint(text) {
    this.hintEl.classList.toggle('hidden', !text);
    if (text) this.hintEl.innerHTML = text;
  }
  lookFromScanner() {
    if (!this.dev) return;
    const p = this.dev.pose();
    this.orbit.lookAt(new THREE.Vector3(p[0], p[1], p[2]), 2.2, this.orbit.goal.yaw, 0.35);
  }
  resetCamera() {
    const c = SCENES[this.sceneId].start.cam;
    this.orbit.lookAt(new THREE.Vector3(...c.target), c.dist, c.yaw, c.pitch);
  }

  /* ---------------- Takt ---------------- */
  loop(now) {
    const dtr = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const C = this.clock;
    let dt = C.paused ? 0 : dtr * C.speed;
    // Rechnet die Scan-Engine nicht hinterher, wartet die Simulation (ehrliche Zeitlupe statt Datenlücken)
    let lag = 0;
    for (const d of this.devices) if (d.state === 'stream') lag = Math.max(lag, C.t - d.t);
    if (lag > 0.2) dt = 0;
    else if (lag > 0.1) dt *= 0.5;
    C.t += dt;
    C.factor += ((dtr > 0 ? dt / dtr : 0) - C.factor) * Math.min(1, dtr * 3);
    this.world.update(dt, C.t);
    this.lw.sync();
    for (const d of this.devices) { d.tick(dt, C.t); d.measure(dtr); }
    this.orbit.update(dtr);
    this.vorbit.update(dtr);
    this.fpc.frame(dtr);
    this.updateHud();
    this.views.frame();
    requestAnimationFrame((t) => this.loop(t));
  }

  updateHud() {
    if ((this.hudT = (this.hudT || 0) + 1) % 10) return;
    const d = this.dev;
    const f = (v) => Math.round(v).toLocaleString('de-DE');
    const busy = this.engine.busy;
    this.hud.innerHTML = `<div class="kv"><span>Sim.-Zeit</span><b>${this.clock.t.toFixed(1)} s</b><span>Echtzeit</span><b>${(this.clock.factor * 100).toFixed(0)} %</b>${d ? `<span>Punkte/s</span><b>${f(d.stats.rate)}</b><span>Datenrate</span><b>${(d.stats.rate * d.stats.bytes * 8 / 1e6).toFixed(1)} Mbit/s</b>` : ''}<span>Worker</span><b>${this.engine.n} · ${busy} offen</b></div>`;
  }

  async quickstart(id) { return this.home.quick(id); }

  async switchScene(id) {
    if (this.fpc.recording) this.fpc.toggleRecord();
    this.project.clear();
    await this.loadScene(id);
    await this.rebuildLidar();
    for (const d of this.devices) d.live.clear();
    this.fpc.render();
    toast(`${SCENES[id].name} geladen · ${this.lidarInfo.tris.toLocaleString('de-DE')} Dreiecke für den Scan-Kern`);
  }

  mountAllowed(kind) {
    const d = this.dev;
    if (!d) return false;
    if (kind === 'stativ') return d.kind !== 'phone';
    return !!(this.mounts && this.mounts.allowed(kind, d));
  }
  async setMount(kind) {
    if (kind === 'stativ') { this.dev.mountOn('stativ'); await this.rebuildLidar(); this.top.render(); return; }
    if (this.mounts) await this.mounts.attach(kind, this.dev);
    this.top.render();
  }

  setWeather(k) {
    this.engine.setEnv(this.world.setWeather(k));
    this.top.render();
  }
  setDaylight(day) {
    const def = this.world.def;
    this.world.setLighting(day ? 'outdoor' : 'night', def.light || {});
    this.engine.setEnv(this.world.setWeather(day ? this.world.weather.preset : 'nacht'));
    this.top.render();
  }

  keys() {
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); this.toggleStream(); }
      else if (e.key === 'r' || e.key === 'R') this.fpc.toggleRecord();
      else if (e.key === 'f' || e.key === 'F') this.fpc.fit();
    });
  }
}
