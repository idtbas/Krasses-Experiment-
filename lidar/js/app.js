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
import { Mounts } from './robots/mounts.js';
import { PhoneApp } from './device/phone.js';
import { Player } from './player/player.js';
import { TripodItem, EquipmentStation } from './player/items.js';
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
    this.tripods = [];
    this.station = null;
    this.view = { beams: false, cloudInScene: true, sceneMode: 'flat', scenePoint: 2 };
  }

  async init() {
    const canvas = document.getElementById('gl');
    document.body.classList.add('player');
    this.views = new Views(canvas);
    this.world = new World(this, this.R);
    this.world.setEnvMap(this.views.r);
    this.engine = new ScanEngine();
    this.lw = new LidarWorld(this.engine);
    this.project = new Project(this);
    this.proc = new Proc();
    this.edl = new EDLPass();
    this.mounts = new Mounts(this);
    this.player = new Player(this);
    this.buildUI();
    this.setupViews();
    this.setupPhoneView();
    this.keys();
    this.report('HALLE WIRD AUFGEBAUT …');
    await this.loadScene('halle');
    const d = this.addDevice('vlp16');
    d.mountOn('stativ', { tripod: this.tripods[0] });
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
    this.phone = new PhoneApp(this);
    this.sceneEl.appendChild(this.phone.el);
    this.home = new Home(this);
    ui.appendChild(this.home.el);
    this.player.mount(this.sceneEl);
    this.player.bindScene(this.sceneHit);
    // Feldrechner in der Hand: abgedunkelte Welt rund um das Tablet, Schaltfläche zum Senken
    this.tabShade = h('div#tabshade');
    const close = h('button#tabclose.btn.small', { html: icon('close') + '<span>Feldrechner senken (Tab)</span>' });
    close.addEventListener('click', () => this.player.toggleTablet(false));
    ui.append(this.tabShade, close);
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
    this.tool = 'none';
    // Einblendungen wie eine AR-Brille: Laserstrahlen und Live-Punkte in der Welt
    tool('beam', 'Laserstrahlen einblenden', (b) => { this.view.beams = !this.view.beams; b.classList.toggle('on', this.view.beams); });
    tool('layers', 'Live-Punkte in der Welt einblenden', (b) => { this.view.cloudInScene = !this.view.cloudInScene; b.classList.toggle('on', this.view.cloudInScene); }, true);
    tool('eye', 'Schulterblick / Ich-Sicht (V)', () => this.player.key('V'));
  }

  setupViews() {
    // 3D-Szene
    this.sceneCam = new THREE.PerspectiveCamera(48, 1, 0.05, 600);
    this.sceneCam.layers.enable(0); this.sceneCam.layers.enable(CLOUD_LAYER);
    // keine fliegende Kamera: die Szenenkamera folgt der Spielfigur
    this.orbit = new OrbitCam(this.sceneCam, h('div'));
    this.orbit.enabled = false;
    this.sceneCam.layers.enable(5);
    this.views.add({
      name: 'scene', el: this.sceneEl, camera: this.sceneCam, enabled: true,
      render: (r, rect, dpr) => {
        this.setCloudUniforms('scene', rect, dpr, this.sceneCam);
        for (const c of this.allClouds()) c.group.visible = this.view.cloudInScene && (c.isLive || c.visibleInScene);
        // Schattenkarte hier und nur hier neu; Löschen übernimmt three nach dem Schattenpass (ein Bildschirm-Durchgang)
        r.shadowMap.needsUpdate = true;
        r.setClearColor(0x000000, 0);
        r.autoClear = true;
        r.render(this.world.scene, this.sceneCam);
        r.autoClear = false;
        // Feldrechner vor dir: dort bleibt die Leinwand durchsichtig (das Tablet liegt darunter)
        const t = this.player.tabletOpen && this.views.extra && this.views.extra.get(this.fpc.el);
        if (t) {
          const H = this.views.H;
          r.setScissor(t.left, H - t.top - t.height, t.width, t.height);
          r.setClearColor(0x000000, 0);
          r.clear(true, true, false);
          r.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
        }
      },
    });
    // Bildschirm des Feldrechners
    this.viewerCam = new THREE.PerspectiveCamera(55, 1, 0.03, 800);
    this.viewerCam.layers.set(CLOUD_LAYER);
    this.viewerCam.layers.enable(MESH_LAYER);
    this.vorbit = new OrbitCam(this.viewerCam, this.fpc.viewHit);
    this.vorbit.maxDist = 300; this.vorbit.minDist = 0.2;
    this.vorbit.onTap = (info) => this.fpc.onViewerTap(info);
    this.fpc.bindViewer();
    this.views.add({
      name: 'viewer', el: this.fpc.viewEl, camera: this.viewerCam, enabled: true,
      // Punktwolke vorab in den eigenen Puffer, im Bildschirm-Durchgang nur noch zusammensetzen
      prepare: (r, rect, dpr) => {
        this.setCloudUniforms('viewer', rect, dpr, this.viewerCam);
        for (const c of this.allClouds()) c.group.visible = c.isLive ? this.fpc.showLive : c.visible !== false;
        const hl = this.world.headlight;
        hl.position.copy(this.viewerCam.position); hl.target.position.copy(this.vorbit.target); hl.target.updateMatrixWorld();
        this.edl.prepare(r, this.world.scene, this.viewerCam, rect, dpr);
      },
      render: (r) => {
        this.edl.mat.uniforms.enabled.value = this.fpc.opts.edl ? 1 : 0;
        this.edl.mat.uniforms.strength.value = this.fpc.opts.edlStrength;
        this.edl.composite(r);
      },
    });
  }

  setupPhoneView() {
    // Kamerabild der Handy-App: Welt ohne Punktwolken, dazu das AR-Vorschaunetz (eigene Ebene)
    this.phone.view = this.views.add({
      name: 'phone', el: this.phone.camEl, camera: this.phone.cam, enabled: false,
      render: (r) => { r.clear(true, true, true); r.render(this.world.scene, this.phone.cam); },
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
    if (this.mounts) this.mounts.reset();
    for (const d of this.devices) { d.stop(); d.unmount(); }
    this.world.clear();
    this.world.setLighting(def.lighting, { bg: def.bg, ...(def.light || {}) });
    def.build(this.world, { object: this.studioObject });
    this.world.setBounds(def.bounds);
    this.world.def = def;
    this.sceneId = id;
    this.engine.setEnv(this.world.setWeather(def.weather || 'klar'));
    // Welt zum Anfassen: Stativ am Startpunkt, Geräteausgabe mit Feldrechner, geparkte Roboter, die Spielfigur
    const S = def.start;
    this.tripods = [];
    const tr = new TripodItem(this);
    tr.place(S.scanner[0], S.scanner[2], S.scanner[3] || 0);
    this.tripods.push(tr);
    this.station = new EquipmentStation(this, ...(S.station || [S.scanner[0] + 2, S.scanner[2] + 2, 0]));
    if (this.player.hasTablet) this.station.takeTablet();
    this.mounts.populate(def);
    const pp = S.player || [S.scanner[0] - 1.5, S.scanner[2] - 2, 0.6];
    this.player.spawn(pp[0], pp[1], pp[2] || 0);
    for (const d of this.devices) { d.regObj = null; if (d.kind === 'phone') continue; d.mountOn('stativ', { tripod: tr }); }
    const c = def.start.cam;
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

  // Neues Gerät aus der Geräteausgabe: der bisherige Scanner geht in seinen Koffer zurück, der neue liegt in deiner Hand
  async replaceDevice(specId) {
    const old = this.dev, P = this.player;
    if (this.fpc.recording) this.fpc.toggleRecord();
    if (old) {
      if (old.state === 'tls') this.fpc.stationScan();
      if (this.mounts.cur) this.mounts.detach();
      old.dispose(); this.devices.splice(this.devices.indexOf(old), 1);
      if (old.regObj) this.world.objects.splice(this.world.objects.indexOf(old.regObj), 1);
      for (const t of this.tripods) if (t.device === old) t.device = null;
    }
    if (P.hand && P.hand.type === 'tripod') P.placeTripod();
    if (P.hand && P.hand.type === 'device') P.hand = null;
    const d = this.addDevice(specId);
    P.takeDevice(d);
    await this.rebuildLidar();
    this.select(d);
    toast(`${d.spec.maker} ${d.spec.model} in der Hand – zum Stativ, zu einer Plattform oder selbst messen`);
    return d;
  }

  select(d) {
    this.dev = d;
    this.fpc.setDevice(d);
    this.phone.setDevice(d);
    this.top.render();
  }

  toggleStream() {
    const d = this.dev;
    if (!d) return;
    if (d.mountKind === 'getragen') { toast(`${d.spec.model} misst nicht aus der Hand – auf ein Stativ oder eine Plattform setzen`, 'warn'); return; }
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
    if (text) this.hintEl.innerHTML = `<span>${text}</span>`;
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
    // Lage aller Ansichten zuerst lesen (Layout ist zu Beginn des Bildes sauber), danach nur noch schreiben
    this.views.measure(this.player.tabletOpen ? [this.fpc.el] : []);
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
    this.mounts.update(dt);
    // Figur läuft in Echtzeit; nur wenn sie selbst misst (Handgerät an), im Takt der Messung
    const handheld = this.dev && this.mounts.cur && this.mounts.cur.player && this.dev.state === 'stream' && !C.paused;
    this.player.update(handheld ? dt : dtr, dtr);
    this.world.update(dt, C.t);
    this.lw.sync();
    for (const d of this.devices) { d.tick(dt, C.t); d.measure(); }
    if (this.fpc.recording) this.fpc.recording.loc.update(C.t);
    this.phone.frame(dt);
    if (this.player.tabletOpen) {
      const t = this.views.extra.get(this.fpc.el);
      const key = t ? `${t.left}|${t.top}|${t.width}|${t.height}` : '';
      if (t && key !== this.tabShadeKey) {
        this.tabShadeKey = key;
        const st = this.tabShade.style;
        st.left = t.left + 'px'; st.top = t.top + 'px'; st.width = t.width + 'px'; st.height = t.height + 'px';
      }
    } else this.tabShadeKey = '';
    if ((this.topT = (this.topT || 0) + dtr) > 0.5) { this.topT = 0; this.top.render(); }
    this.player.updateCamera(this.sceneCam, dtr);
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
    if (this.dev && this.dev.kind === 'phone') this.player.takeDevice(this.dev);
    await this.rebuildLidar();
    for (const d of this.devices) d.live.clear();
    this.fpc.render();
    toast(`${SCENES[id].name} geladen · ${this.lidarInfo.tris.toLocaleString('de-DE')} Dreiecke für den Scan-Kern`);
  }

  mountAllowed(kind) {
    const d = this.dev;
    if (!d) return false;
    if (kind === 'stativ') return d.kind !== 'phone';
    return this.mounts.allowed(kind, d);
  }
  mountWhyNot(kind) { return this.dev && kind !== 'stativ' ? this.mounts.whyNot(kind, this.dev) : null; }
  // Halterung direkt setzen (Schnellstarts): aufs freie Stativ, in die Hand oder an eine geparkte Plattform
  async setMount(kind) {
    const d = this.dev, P = this.player;
    if (!d || d.mountKind === kind) return;
    if (this.fpc.recording) this.fpc.toggleRecord();
    if (P.hand && P.hand.type === 'device' && P.hand.dev === d) P.hand = null;
    if (kind === 'stativ') {
      const on = d.state === 'stream';
      if (this.mounts.cur) this.mounts.detach();
      const tr = this.tripods.find((t) => !t.device && !t.carried) || this.tripods[0];
      d.mountOn('stativ', { tripod: tr });
      await this.rebuildLidar();
      if (on) d.start();
    } else if (kind === 'hand') P.takeDevice(d);
    else await this.mounts.attach(kind, d);
    this.top.render();
    this.fpc.render();
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
    });
  }
}
