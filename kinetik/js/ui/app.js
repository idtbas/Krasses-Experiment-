// KINETIK · App: Bildschirme, Arbeitsplatz, Ausführung, Prüfaufträge und Speichern.
import * as THREE from 'three';
import { Renderer } from '../render/renderer.js';
import { OrbitCam } from '../render/camera.js';
import { Sim } from '../sim/sim.js';
import { Scenario } from '../sim/scenario.js';
import { Viewport } from './viewport.js';
import { ProgramDoc } from './program.js';
import { TextEditor } from './texteditor.js';
import { BlockEditor } from '../blocks/editor.js';
import { Configurator } from './configurator.js';
import { WorldPanel } from './worldpanel.js';
import { HelpPanel } from './help.js';
import { DeviceMonitor } from './devices.js';
import { Home } from './home.js';
import { MissionsScreen, MissionCard } from './missionsui.js';
import { MISSION_BY_ID, MISSIONS, countStatements } from '../missions/missions.js';
import { Audio } from '../core/audio.js';
import { Store } from '../core/store.js';
import { h, $, clear, uid, rng, fmtNum, clamp } from '../core/util.js';
import { icon, LOGO } from '../core/icons.js';
import { toast, modal, closeModal, modalOpen, closePop, popOpen, confirmBox, ask } from './dialogs.js';
import { ROBOT_TYPES, withDefaults, bom, fmtEuro } from '../robots/parts.js';
import { show, Runtime } from '../lang/interp.js';
import { RobotHost } from '../robots/host.js';

const KEY_NAMES = { ' ': 'leertaste', ArrowUp: 'oben', ArrowDown: 'unten', ArrowLeft: 'links', ArrowRight: 'rechts', Enter: 'enter' };

export class App {
  constructor(R) {
    this.R = R;
    this.audio = new Audio();
    this.selected = null;
    this.mode = Store.setting('editorMode', 'blocks');
    this.screen = null;
    this.docs = new Map();
    this.keysDown = new Set();
    this.logs = [];
    this.lastHud = 0;
    this.buildStage();
    this.home = new Home(this);
    this.missionsScreen = new MissionsScreen(this);
    this.buildBench();
    this.bindKeys();
    addEventListener('pointerdown', () => this.audio.unlock(), { capture: true });
    addEventListener('pagehide', () => this.autosave());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(); });
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  /* ================= Bühne (3D) ================= */

  buildStage() {
    this.canvas = h('canvas', { tabindex: '0', 'aria-label': '3D-Ansicht' });
    $('#stage').appendChild(this.canvas);
    this.renderer = new Renderer(this.canvas);
    this.cam = new OrbitCam(this.renderer.camera, this.canvas);
    this.sim = new Sim(this.R, this.renderer);
    this.sim.running = true;
    this.scenario = new Scenario(this.sim, {
      audio: this.audio,
      onLog: (robot, text, kind) => this.log(text, kind, robot),
      onSay: () => {},
      onWarn: (robot, text) => {
        this.log(text, 'warn', robot);
        if (!robot.speech || this.sim.time > robot.speech.until) robot.speech = { text: text.split(/[–.]/)[0].trim(), t: this.sim.time, until: this.sim.time + 2.5, warn: true };
        this.mctx && this.mctx.onWarn && this.mctx.onWarn(text);
      },
      onError: (slot, err) => this.runtimeError(slot, err),
      onFinish: () => this.programFinished(),
      onStop: () => {},
      onCommand: (robot, id) => { if (this.mctx) this.mctx.flags['cmd_' + id] = true; },
      onGrip: (robot, what, thing) => { if (what === 'greift') this.audio.grip(); this.mctx && this.mctx.onGrip && this.mctx.onGrip(what, thing, robot); },
      onSafety: (robot, on) => { if (this.mctx && this.mctx.onSafety) this.mctx.onSafety(robot, on); },
    });
    this.viewport = new Viewport(this);
  }

  mountCanvas(parent) {
    if (this.canvas.parentElement !== parent) parent.appendChild(this.canvas);
    if (parent !== this.viewport.viewEl) this.viewport.overlay.remove();
    this.renderer.resize();
  }

  /* ================= Werkbank ================= */

  buildBench() {
    const bench = $('#bench');
    this.benchEl = bench;
    // Kopfzeile
    const homeBtn = h('button.btn.ghost', { title: 'Startseite', 'aria-label': 'Startseite', html: `<span class="logo">${LOGO}</span>` });
    homeBtn.addEventListener('click', () => this.goHome());
    this.titleEl = h('div.title', h('b', ''), h('span', ''));
    this.robotsBar = h('div#robots-bar');
    this.runBtn = h('button.btn.go', { html: icon('play') + '<span>START</span>', title: 'Ablauf starten (⌘↩)' });
    this.runBtn.addEventListener('click', () => this.toggleRun());
    const resetBtn = h('button.btn', { html: icon('reset') + '<span>Reset</span>', title: 'Anlage zurücksetzen' });
    resetBtn.addEventListener('click', () => this.resetWorld());
    this.speedBtn = h('button.btn.icon', { title: 'Simulationsgeschwindigkeit', html: '<b class="mono" style="font-size:12px">1×</b>' });
    this.speedBtn.addEventListener('click', () => this.cycleSpeed());
    this.pauseBtn = h('button.btn.icon', { title: 'Physik anhalten', html: icon('pause') });
    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.saveBtn = h('button.btn.icon', { title: 'Projekt', html: icon('folder') });
    this.saveBtn.addEventListener('click', () => this.projectMenu());
    this.clockEl = h('span.simclock', 'T+0,0 s');
    const topbar = h('div#topbar', homeBtn, this.titleEl, this.robotsBar, h('div.spacer'), this.clockEl, h('div.run', this.pauseBtn, this.speedBtn, resetBtn, this.runBtn, this.saveBtn));

    // Hauptbereich
    this.viewEl = h('div#view');
    this.splitter = h('div#splitter', { title: 'Breite ändern' });
    this.side = h('div#side');
    const main = h('div#main', this.viewEl, this.splitter, this.side);
    bench.append(topbar, main);
    this.viewport.attach(this.viewEl, this.canvas);

    // Überlagerungen
    this.missionCard = new MissionCard(this);
    this.viewEl.appendChild(this.missionCard.el);
    this.hud = h('div#hud.ov');
    this.viewEl.appendChild(this.hud);
    this.buildConsole();
    this.buildViewTools();

    // Seitenleiste
    this.modeSeg = h('div.seg',
      this.segBtn('blocks', 'Bausteine', 'blocks'),
      this.segBtn('text', 'Skript', 'code'));
    this.tabBtns = {};
    const tab = (id, label, ic) => {
      const b = h('button.btn.small.ghost', { html: icon(ic) + `<span>${label}</span>` });
      b.addEventListener('click', () => this.showTab(id));
      this.tabBtns[id] = b;
      return b;
    };
    this.sideTabs = h('div#side-tabs', this.modeSeg, h('div', { style: { flex: 1 } }), tab('devices', 'Geräte', 'monitor'), tab('build', 'Konfiguration', 'sliders'), tab('world', 'Umgebung', 'globe'), tab('help', 'Referenz', 'help'));
    this.sideBody = h('div#side-body');
    this.side.append(this.sideTabs, this.sideBody);

    this.textEd = new TextEditor({
      onChange: (t) => this.onTextChange(t),
      robotType: () => (this.currentRobot() ? this.currentRobot().type : null),
    });
    this.blockEd = new BlockEditor({
      robot: () => this.currentRobot(),
      onChange: () => this.onBlocksChange(),
      onTry: (item) => this.tryStack(item),
      onPeek: (expr, el) => this.peek(expr, el),
      audio: this.audio,
    });
    this.config = new Configurator(this);
    this.worldPanel = new WorldPanel(this);
    this.help = new HelpPanel(this);
    this.devices = new DeviceMonitor(this);
    this.sideBody.append(this.blockEd.el, this.textEd.el, this.devices.el, this.config.el, this.worldPanel.el, this.help.el);
    this.bindSplitter();
  }

  segBtn(id, label, ic) {
    const b = h('button', { html: icon(ic) + `<span>${label}</span>`, title: label + ' (⌘E wechselt)' });
    b.dataset.mode = id;
    b.addEventListener('click', () => { this.setMode(id); this.showTab('program'); });
    return b;
  }

  buildConsole() {
    this.consoleLog = h('div.log');
    this.consoleCount = h('span.n', '');
    const tog = h('button.btn.icon.small.ghost', { html: icon('chevDown'), title: 'Ein-/Ausklappen' });
    const clr = h('button.btn.icon.small.ghost', { html: icon('trash'), title: 'Leeren' });
    this.console = h('div#console.ov', h('div.h', h('span', { html: icon('terminal') }), 'Protokoll', this.consoleCount, h('div', { style: { flex: 1 } }), clr, tog), this.consoleLog);
    tog.addEventListener('click', () => { this.console.classList.toggle('min'); Store.setSetting('consoleMin', this.console.classList.contains('min')); });
    clr.addEventListener('click', () => { clear(this.consoleLog); this.logCount = 0; this.consoleCount.textContent = ''; });
    if (Store.setting('consoleMin', false)) this.console.classList.add('min');
    this.viewEl.appendChild(this.console);
  }

  buildViewTools() {
    const mk = (ic, title, fn, id) => { const b = h('button.btn.icon', { title, 'aria-label': title, html: icon(ic) }); b.addEventListener('click', fn); if (id) b.dataset.tool = id; return b; };
    this.toolHand = mk('hand', 'Greifen und werfen', () => this.setTool('hand'), 'hand');
    this.toolMove = mk('grid', 'Verschieben (Aufbau)', () => this.setTool('move'), 'move');
    this.toolPath = mk('pencil', 'Pfad zeichnen (Apple Pencil)', () => this.setTool('path'), 'path');
    this.toolSensors = mk('eye', 'Sensorik einblenden (Strahlen, Punktwolke, Radar)', () => { this.showSensors = !this.showSensors; this.toolSensors.classList.toggle('on', this.showSensors); Store.setSetting('sensors', this.showSensors); });
    this.toolMonitor = mk('pip', 'Geräteansicht einblenden', () => this.togglePip());
    this.toolFollow = mk('follow', 'Roboter folgen', () => this.toggleFollow());
    this.toolCam = mk('camera', 'Ansicht zurücksetzen', () => this.resetCamera());
    this.viewTools = h('div#view-tools.ov', this.toolHand, this.toolMove, this.toolPath, h('div.sep'), this.toolSensors, this.toolMonitor, this.toolFollow, this.toolCam);
    this.viewEl.appendChild(this.viewTools);
    this.showSensors = Store.setting('sensors', true);
    this.toolSensors.classList.toggle('on', this.showSensors);
    this.setTool('hand');
  }

  // Bild-in-Bild: erste Kamera bzw. erstes bildgebendes Gerät in der 3D-Ansicht
  togglePip() {
    const dm = this.devices;
    if (dm.pip) { dm.setPip(null); this.toolMonitor.classList.remove('on'); return; }
    dm.render();
    const t = dm.tiles.find((x) => ['rgb', 'thermal', 'lidar', 'radar', 'depth', 'cloud'].includes(x.kind));
    if (!t) { toast('Kein bildgebendes Gerät verbaut (Kamera, Wärmebild, LiDAR oder Radar).'); return; }
    dm.setPip(t);
    this.toolMonitor.classList.add('on');
  }

  setTool(t) {
    if (t === 'move' && !this.canEditWorld()) { toast('Verschieben nur auf der freien Testfläche bei gestopptem Ablauf.'); t = 'hand'; }
    this.viewport.tool = t;
    for (const b of [this.toolHand, this.toolMove, this.toolPath]) b.classList.toggle('on', b.dataset.tool === t);
    if (t === 'path') toast('Pfad mit Apple Pencil oder Finger auf den Boden zeichnen – „folge dem pfad“ fährt ihn ab.', '', 3200);
  }

  bindSplitter() {
    const sp = this.splitter;
    const saved = Store.setting('sideWidth', null);
    if (saved) this.side.style.width = saved + 'px';
    sp.addEventListener('pointerdown', (e) => {
      sp.setPointerCapture(e.pointerId);
      const startX = e.clientX, startW = this.side.offsetWidth;
      const move = (ev) => {
        const w = clamp(startW - (ev.clientX - startX), 340, innerWidth - 320);
        this.side.style.width = w + 'px';
        this.renderer.resize();
      };
      const up = () => { sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); Store.setSetting('sideWidth', this.side.offsetWidth); this.renderer.resize(); };
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', up);
    });
  }

  showTab(id) {
    this.tab = id;
    for (const p of [this.blockEd.el, this.textEd.el, this.devices.el, this.config.el, this.worldPanel.el, this.help.el]) p.classList.remove('on');
    if (id === 'program') (this.mode === 'blocks' ? this.blockEd.el : this.textEd.el).classList.add('on');
    if (id === 'devices') { this.devices.show(); this.devices.el.classList.add('on'); } else this.devices.hide();
    if (id === 'build') { this.config.render(); this.config.el.classList.add('on'); }
    if (id === 'world') { this.worldPanel.render(); this.worldPanel.el.classList.add('on'); }
    if (id === 'help') { this.help.render(); this.help.el.classList.add('on'); }
    for (const [k, b] of Object.entries(this.tabBtns)) b.classList.toggle('on', k === id);
    for (const b of this.modeSeg.children) b.classList.toggle('on', id === 'program' && b.dataset.mode === this.mode);
  }

  setMode(m) {
    const doc = this.currentDoc();
    if (m === this.mode) return;
    if (m === 'blocks' && doc && doc.error) {
      toast('Syntaxfehler im Skript – erst beheben, dann zu den Bausteinen wechseln.', 'err', 3500);
      this.textEd.setError(doc.error);
      return;
    }
    this.mode = m;
    Store.setSetting('editorMode', m);
    if (doc) {
      if (m === 'text') {
        // Text kanonisch neu erzeugen, damit Zeilen und Baum passen
        doc.setText(doc.text, 'switch');
        this.textEd.setValue(doc.text);
        this.textEd.setError(doc.error);
      } else {
        doc.setText(this.textEd.value, 'switch');
        this.blockEd.refreshFromDoc();
      }
    }
  }

  /* ================= Bildschirme ================= */

  goHome() {
    this.autosave();
    this.stopProgram();
    this.screen = 'home';
    this.benchEl.classList.remove('on');
    this.missionsScreen.hide();
    this.mission = null;
    this.mountCanvas($('#stage'));
    this.home.show();
  }

  showMissions() {
    this.autosave();
    this.missionsScreen.show();
  }

  enterBench() {
    this.home.hide();
    this.missionsScreen.hide();
    this.screen = 'bench';
    this.benchEl.classList.add('on');
    this.mountCanvas(this.viewEl);
    this.viewEl.appendChild(this.viewport.overlay);
    if (!this.tab) this.showTab('program');
    else this.showTab(this.tab === 'world' && !this.isSandbox() ? 'program' : this.tab);
    this.tabBtns.world.style.display = this.isSandbox() ? '' : 'none';
    this.toolMove.style.display = this.isSandbox() ? '' : 'none';
    setTimeout(() => this.renderer.resize(), 30);
  }

  isSandbox() { return this.project && this.project.kind === 'sandbox'; }
  canEditWorld() { return this.isSandbox() && !this.scenario.running; }

  /* ================= Projekte und Missionen ================= */

  openMission(id) {
    const m = MISSION_BY_ID[id];
    if (!m) return;
    this.autosave();
    this.mission = m;
    const saved = Store.missionCode(id);
    const defs = (m.robotDefs || [m.robotDef]).map((d, i) => {
      const s = saved && saved.robots && saved.robots[i];
      const config = withDefaults({ ...d.config, ...(s && s.config ? s.config : {}), type: d.config.type });
      if (d.config.name) config.name = d.config.name;
      return { id: 'r' + i, config, spawn: { ...d.spawn }, code: s ? s.code : (d.code ?? m.starter ?? 'beim start\n  \nende\n'), layout: s ? s.layout : [] };
    });
    this.project = { kind: 'mission', missionId: id, name: m.title, robots: defs, objects: m.objects, env: m.env || null };
    this.loadProject(this.project);
    this.missionCard.show(m);
    this.enterBench();
    this.applyCamera(m.camera);
  }

  openSandbox(project) {
    this.autosave();
    this.mission = null;
    this.project = project;
    this.loadProject(project);
    this.missionCard.hide();
    this.enterBench();
    this.applyCamera(project.camera || { target: [0, 0.45, 0.3], dist: 2.4, yaw: 0.7, pitch: 0.5 });
  }

  loadProject(p) {
    this.stopProgram();
    if (this.devices) { this.devices.setPip(null); this.toolMonitor && this.toolMonitor.classList.remove('on'); }
    this.docs.clear();
    for (const d of p.robots) this.docs.set(d.id, new ProgramDoc(d.code || '', d.layout || []));
    this.currentId = p.robots[0] ? p.robots[0].id : null;
    this.buildWorld();
    this.renderRobotsBar();
    this.loadEditors();
    this.updateTitle();
    clear(this.consoleLog);
    this.logCount = 0;
    this.consoleCount.textContent = '';
    this.log(this.mission ? `Prüfauftrag ${this.mission.code} „${this.mission.title}“ geladen.` : `Projekt „${p.name}“ geöffnet.`, 'sys');
  }

  buildWorld() {
    const p = this.project;
    this.viewport.clearOverlay();
    let objects = p.objects || [];
    if (this.mission && this.mission.randomize) {
      const rnd = rng((Date.now() & 0xffff) + 7);
      objects = objects.map((o) => { const c = { ...o }; this.mission.randomize(c, rnd); return c; });
    }
    this.scenario.build({ ...p, objects });
    if (this.sim.path) this.viewport.drawPath(this.sim.path);
    this.selected = this.robotEntity(this.currentId) || null;
    this.mctx = null;
    if (this.mission) this.missionCard.reset();
  }

  robotEntity(defId) { const s = this.scenario.slotOf(defId); return s ? s.robot : null; }
  robotDefOf(ent) { return this.project.robots.find((d) => d.id === ent.defId); }
  currentDef() { return this.project && this.project.robots.find((d) => d.id === this.currentId); }
  currentDoc() { return this.docs.get(this.currentId); }
  currentRobot() { return this.robotEntity(this.currentId); }

  loadEditors() {
    const doc = this.currentDoc();
    if (!doc) return;
    this.textEd.setValue(doc.text);
    this.textEd.setError(doc.error);
    this.blockEd.setDoc(doc);
    if (doc.error && this.mode === 'blocks') { this.mode = 'text'; this.showTab('program'); }
  }

  selectRobot(defId) {
    if (defId === this.currentId) return;
    this.syncDocFromEditor();
    this.currentId = defId;
    this.selected = this.robotEntity(defId);
    this.renderRobotsBar();
    this.loadEditors();
    if (this.tab === 'build') this.config.render();
  }

  renderRobotsBar() {
    clear(this.robotsBar);
    const p = this.project;
    if (!p || p.robots.length < 2) return;
    for (const d of p.robots) {
      const b = h('button.chip' + (d.id === this.currentId ? '.on' : ''), h('i', { style: { background: d.config.lack || '#888' } }), d.config.name || ROBOT_TYPES[d.config.type].name);
      b.addEventListener('click', () => this.selectRobot(d.id));
      this.robotsBar.appendChild(b);
    }
  }

  updateTitle() {
    const [b, s] = this.titleEl.children;
    if (this.mission) {
      b.textContent = this.mission.title;
      s.textContent = `${this.mission.code} · Prüfauftrag`;
    } else {
      b.textContent = this.project.name;
      s.textContent = 'Freie Testfläche';
    }
  }

  syncDocFromEditor() {
    const doc = this.currentDoc();
    if (!doc) return;
    if (this.mode === 'text') doc.setText(this.textEd.value);
  }

  // Projekt (bzw. Missionsstand) speichern
  autosave() {
    if (!this.project) return;
    this.syncDocFromEditor();
    for (const d of this.project.robots) {
      const doc = this.docs.get(d.id);
      if (doc) { d.code = doc.text; d.layout = doc.layout; }
    }
    if (this.project.kind === 'mission') {
      Store.setMissionCode(this.project.missionId, { robots: this.project.robots.map((d) => ({ code: d.code, layout: d.layout, config: d.config })) });
    } else {
      if (this.sim.path) this.project.path = this.sim.path; else delete this.project.path;
      this.project.camera = this.cameraState();
      Store.saveProject(this.project);
    }
  }

  cameraState() {
    const c = this.cam;
    return { target: [c.goalTarget.x, c.goalTarget.y, c.goalTarget.z], dist: c.goal.dist, yaw: c.goal.yaw, pitch: c.goal.pitch };
  }
  applyCamera(c) {
    this.cam.follow = null;
    this.toolFollow && this.toolFollow.classList.remove('on');
    // schmale Ansicht (Hochformat-Ausschnitt): etwas weiter weg, damit alles hineinpasst
    this.renderer.resize();
    const k = clamp(1.3 / Math.max(0.3, this.renderer.camera.aspect), 1, 1.55);
    this.cam.lookAt(new THREE.Vector3(...c.target), c.dist * k, c.yaw, c.pitch);
    this.cam.jump();
    this.homeCamera = c;
    if (this.mission && this.mission.follow) this.toggleFollow(true);
  }
  resetCamera() { if (this.homeCamera) this.applyCamera(this.homeCamera); }

  toggleFollow(force) {
    const on = force ?? !this.cam.follow;
    if (on) {
      const self = this;
      this.cam.follow = () => {
        const r = self.selected && self.selected.isRobot ? self.selected : self.currentRobot();
        if (!r) return null;
        const p = r.frame().p;
        return new THREE.Vector3(p.x, r.type === 'humanoid' ? 0.75 : r.type === 'rover' ? 0.15 : 0.5 + r.spawn.y, p.z);
      };
    } else this.cam.follow = null;
    this.toolFollow.classList.toggle('on', !!this.cam.follow);
  }

  projectMenu() {
    if (this.mission) {
      const m = this.mission;
      import('./dialogs.js').then(({ menu }) => menu(this.saveBtn, [
        { label: 'Alle Prüfaufträge', icon: 'clipboard', run: () => this.showMissions() },
        { label: 'Referenzlösung laden', icon: 'check', run: () => this.loadReference() },
        { label: 'Ablauf als Skript anzeigen', icon: 'code', run: () => this.showCode() },
        { label: 'Prüfauftrag zurücksetzen', icon: 'reset', danger: true, run: async () => { if (await confirmBox('Zurücksetzen?', 'Ablauf und Konfiguration für diesen Prüfauftrag werden auf den Ausgangszustand gesetzt.', 'Zurücksetzen', true)) { Store.setMissionCode(m.id, null); this.openMission(m.id); } } },
      ]));
      return;
    }
    import('./dialogs.js').then(({ menu }) => menu(this.saveBtn, [
      { label: 'Speichern', icon: 'save', run: () => { this.autosave(); toast('Gespeichert.', 'ok'); } },
      { label: 'Umbenennen', icon: 'pencil', run: async () => { const n = await ask('Projekt umbenennen', 'Neuer Name:', this.project.name); if (n) { this.project.name = n; this.updateTitle(); this.autosave(); } } },
      { label: 'Als Datei exportieren', icon: 'download', run: () => this.exportProject() },
      { label: 'Ablauf als Skript anzeigen', icon: 'code', run: () => this.showCode() },
      '-',
      { label: 'Alle Projekte', icon: 'folder', run: () => { this.goHome(); this.home.projects(); } },
    ]));
  }

  exportProject() {
    this.autosave();
    const blob = new Blob([JSON.stringify(this.project, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: (this.project.name || 'kinetik').replace(/[^\wäöüß-]+/gi, '_') + '.kinetik.json' });
    document.body.appendChild(a); a.click(); a.remove();
    toast('Datei wird gespeichert …', 'ok');
  }

  showCode() {
    this.syncDocFromEditor();
    const doc = this.currentDoc();
    modal({ title: 'Ablauf als Skript', body: h('pre.code', doc ? doc.text : ''), wide: true, actions: [{ label: 'Kopieren', icon: 'copy', keep: true, run: () => { navigator.clipboard && navigator.clipboard.writeText(doc.text).then(() => toast('Kopiert.', 'ok')); } }, { label: 'Schließen', primary: true }] });
  }

  /* ================= Bearbeiten ================= */

  onTextChange(t) {
    const doc = this.currentDoc();
    if (!doc) return;
    clearTimeout(this.textTimer);
    this.textTimer = setTimeout(() => {
      doc.setText(t, 'text');
      this.textEd.setError(doc.error);
      this.markDirty();
    }, 250);
  }

  onBlocksChange() {
    const doc = this.currentDoc();
    if (this.mode === 'blocks' && doc) { this.textEd.setValue(doc.text); this.textEd.setError(null); }
    this.blockEd.setError(null);
    this.markDirty();
  }

  markDirty() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.autosave(), 1500);
    if (this.scenario.running) this.textEd.setInfo('Geändert – Neustart nötig, damit die Änderung wirkt.');
  }

  /* ================= Ausführen ================= */

  toggleRun() {
    if (this.scenario.running) this.stopProgram(true);
    else this.startProgram();
  }

  startProgram() {
    this.syncDocFromEditor();
    closePop();
    const errs = this.scenario.check((def) => this.docs.get(def.id));
    if (errs.length) {
      const e = errs[0];
      if (e.def.id !== this.currentId) this.selectRobot(e.def.id);
      const who = this.project.robots.length > 1 ? `${e.def.config.name}: ` : '';
      this.log(who + (e.err.line && this.mode === 'text' ? `Zeile ${e.err.line}: ` : '') + e.err.message, 'err');
      if (this.mode === 'text') { this.textEd.setError(e.err); if (e.err.line) this.textEd.goToLine(e.err.line); }
      else { this.blockEd.setError(e.err.nodeId); toast(e.err.message, 'err', 4000); }
      this.audio.error();
      return;
    }
    this.textEd.setError(null);
    this.blockEd.setError(null);
    // Mission: Welt frisch aufbauen, damit jeder Versuch fair startet
    if (this.mission && (this.dirtyWorld || this.sim.time > 0.5)) this.buildWorld();
    this.dirtyWorld = true;
    this.mctx = this.mission ? this.makeMissionContext() : null;
    this.scenario.start((def) => this.docs.get(def.id));
    this.runStart = this.sim.time;
    this.sim.running = true;
    this.pauseBtn.innerHTML = icon('pause');
    this.updateRunBtn();
    this.audio.start();
    this.log('▶ Ablauf gestartet', 'sys');
  }

  stopProgram(user) {
    if (!this.scenario) return;
    const was = this.scenario.running;
    this.scenario.stop();
    this.updateRunBtn();
    this.blockEd && this.blockEd.setActive(new Set());
    this.textEd && this.textEd.setRunLines(new Set());
    if (was && user) this.log('■ Ablauf gestoppt', 'sys');
  }

  updateRunBtn() {
    const r = this.scenario.running;
    this.runBtn.className = 'btn ' + (r ? 'stop' : 'go');
    this.runBtn.innerHTML = r ? icon('stop') + '<span>STOPP</span>' : icon('play') + '<span>START</span>';
  }

  programFinished() {
    this.updateRunBtn();
    this.log('✓ Ablauf beendet', 'ok');
    this.blockEd.setActive(new Set());
    this.textEd.setRunLines(new Set());
  }

  runtimeError(slot, err) {
    const who = this.project.robots.length > 1 ? `${slot.def.config.name}: ` : '';
    this.log(who + (err.line && this.mode === 'text' ? `Zeile ${err.line}: ` : '') + err.message, 'err');
    this.audio.error();
    if (slot.def.id !== this.currentId) this.selectRobot(slot.def.id);
    if (this.mode === 'text') this.textEd.setError(err);
    else { this.blockEd.setError(err.nodeId); toast(err.message, 'err', 4500); }
    setTimeout(() => this.updateRunBtn(), 0);
  }

  resetWorld() {
    this.stopProgram();
    this.buildWorld();
    this.dirtyWorld = false;
    this.log('⟲ Anlage zurückgesetzt', 'sys');
  }

  togglePause() {
    this.sim.running = !this.sim.running;
    this.pauseBtn.innerHTML = icon(this.sim.running ? 'pause' : 'play');
    this.pauseBtn.classList.toggle('on', !this.sim.running);
    toast(this.sim.running ? 'Simulation läuft.' : 'Simulation angehalten.');
  }

  cycleSpeed() {
    const opts = [1, 0.5, 0.25, 2];
    const i = (opts.indexOf(this.sim.speed) + 1) % opts.length;
    this.sim.speed = opts[i];
    this.speedBtn.innerHTML = `<b class="mono" style="font-size:12px">${opts[i]}×</b>`;
  }

  tryStack(item) {
    if (this.scenario.running) { toast('Einzelne Stapel lassen sich nur bei gestopptem Ablauf ausführen.'); return; }
    const doc = this.currentDoc();
    const th = this.scenario.tryStack(this.currentDef(), doc, item);
    if (th) { this.trying = true; this.updateRunBtn(); }
  }

  // Melder antippen: aktuellen Wert anzeigen
  peek(expr) {
    const s = this.scenario.slotOf(this.currentId);
    if (!s) return;
    const rt = s.runtime || new Runtime({ type: 'program', items: [] }, new RobotHost(s.robot, { sim: this.sim }), {});
    try { toast('= ' + show(rt.evalSync(expr, { node: null, ops: 0, depth: 0 }, rt.globals))); } catch (e) { toast(e.message, 'err'); }
  }

  /* ================= Missionen prüfen ================= */

  makeMissionContext() {
    const m = this.mission;
    const ctx = { sim: this.sim, scenario: this.scenario, robot: this.scenario.slots[0] && this.scenario.slots[0].robot, robots: this.scenario.slots.map((s) => s.robot), log: [], flags: {}, latched: new Set(), t: 0, mission: m };
    if (m.setup) m.setup(ctx);
    const prevBroadcast = this.scenario.broadcast.bind(this.scenario);
    this.scenario.broadcast = (msg, from) => { ctx.flags.message = true; return prevBroadcast(msg, from); };
    return ctx;
  }

  checkMission() {
    const ctx = this.mctx;
    if (!ctx || ctx.done) return;
    ctx.t = this.sim.time - this.runStart;
    ctx.dt = this.sim.time - (ctx.lastT ?? this.sim.time);
    ctx.lastT = this.sim.time;
    if (ctx.tick && this.scenario.running) ctx.tick();
    if (ctx.watchBump) {
      for (const r of ctx.robots) {
        const ph = this.sim.physics;
        for (const p of r.parts.values()) for (const c of p.colliders) ph.contacts(c, (o) => { const i = ph.infoOf(o); if (i && ((i.entity && ['wand', 'zaun', 'hindernis', 'regal', 'fahrzeug', 'dummy'].includes(i.entity.kind)) || i.kind === 'halle')) ctx.flags.bump = true; });
      }
    }
    const res = ctx.mission.goals.map((g, i) => {
      if (ctx.latched.has(i)) return true;
      let ok = false;
      try { ok = !!g.check(ctx); } catch { ok = false; }
      if (ok && g.keep) ctx.latched.add(i);
      return ok;
    });
    // „keep“-Ziele, die einen Fehler beschreiben (z. B. nicht gerammt), dürfen nicht vorab einrasten
    this.missionCard.update(res, ctx.t);
    if (res.every(Boolean)) {
      ctx.okTime = ctx.okTime ?? this.sim.time;
      if (this.sim.time - ctx.okTime > 0.6) { ctx.done = true; this.missionSuccess(ctx); }
    } else ctx.okTime = null;
  }

  missionSuccess(ctx) {
    const m = this.mission;
    let stmts = 0;
    for (const d of this.project.robots) { const dd = this.docs.get(d.id); if (dd && dd.ast) stmts += countStatements(dd.ast); }
    const t = ctx.okTime - this.runStart;
    const cost = this.project.robots.reduce((sum, d) => sum + bom(d.config).total, 0);
    const res = { time: t, stmts, cost, okTime: t <= m.par.time * 1.3, okStmts: stmts <= m.par.stmts, okCost: !m.budget || cost <= m.budget };
    const grade = 1 + (res.okTime ? 1 : 0) + (res.okStmts ? 1 : 0) + (m.budget ? (res.okCost ? 1 : 0) : 0);
    const max = m.budget ? 4 : 3;
    const prev = Store.progress(m.id);
    Store.setProgress(m.id, { stars: Math.max(grade, prev && prev.stars || 0), grade, max, best: Math.min(Math.round(t * 10) / 10, prev && prev.best || Infinity), cost: Math.round(cost), done: true });
    this.autosave();
    this.audio.success();
    this.log(`✓ Prüfung bestanden · ${fmtNum(t, 1)} s · ${stmts} Anweisungen · ${fmtEuro(cost)}`, 'ok');
    this.missionCard.success(grade, max);
    setTimeout(() => this.missionsScreen.successModal(m, res, grade, max, prev), 600);
  }

  // Referenzlösung (Ablauf und ggf. Konfiguration) in den Arbeitsplatz laden
  async loadReference() {
    const m = this.mission;
    if (!m) return;
    if (!(await confirmBox('Referenzlösung laden?', 'Der aktuelle Ablauf wird durch die Referenzlösung ersetzt.', 'Laden'))) return;
    const sols = m.solutions || [m.solution];
    const cfgs = m.solutionConfigs || (m.solutionConfig ? [m.solutionConfig] : []);
    this.project.robots.forEach((d, i) => { if (cfgs[i]) d.config = withDefaults({ ...d.config, ...cfgs[i], type: d.config.type }); });
    this.buildWorld();
    this.renderRobotsBar();
    sols.forEach((src, i) => { const d = this.project.robots[i]; const doc = d && this.docs.get(d.id); if (doc) { doc.layout = []; doc.setText(src); } });
    this.loadEditors();
    this.blockEd.renderPalette();
    this.autosave();
    this.log('Referenzlösung geladen.', 'sys');
  }

  /* ================= Welt-Interaktion ================= */

  onViewTap(ent, hit) {
    if (this.isSandbox() && this.worldPanel.placing) {
      let p = hit && hit.point;
      if (!p && hit && hit.ray && hit.ray.direction.y < 0) { const t = -hit.ray.origin.y / hit.ray.direction.y; p = hit.ray.origin.clone().addScaledVector(hit.ray.direction, t); }
      if (p && this.worldPanel.place(p)) return;
    }
    if (ent && ent.isRobot) {
      if (ent.defId && ent.defId !== this.currentId) this.selectRobot(ent.defId);
      this.selected = ent;
      if (this.scenario.running) this.scenario.tap(ent);
    } else if (ent && (ent.isObject || ent.spec)) {
      this.selected = this.isSandbox() ? ent : null;
    } else this.selected = this.isSandbox() ? null : this.currentRobot();
    if (this.tab === 'world') this.worldPanel.render();
  }

  select(ent) { this.selected = ent; if (this.tab === 'world') this.worldPanel.render(); }

  // Gegenstand/Roboter verschieben (Sandbox-Bau-Modus)
  moveEntity(ent, x, z, done) {
    if (ent.isRobot) {
      const def = this.robotDefOf(ent);
      if (x != null) { def.spawn.x = x; def.spawn.z = z; this.dragGhost = true; }
      if (done || x != null) {
        if (done) { this.buildWorld(); this.selected = this.robotEntity(def.id); this.autosave(); }
        else {
          // während des Ziehens: ganzen Roboter mitnehmen
          const f = ent.frame();
          const dx = x - f.p.x, dz = z - f.p.z;
          for (const p of ent.parts.values()) { const t = p.body.translation(); p.body.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
          if (ent.type === 'arm') { ent.spawn.x = x; ent.spawn.z = z; }
        }
      }
      return;
    }
    const spec = ent.spec;
    if (x != null) {
      spec.x = x; spec.z = z;
      if (ent.isObject) { const t = ent.body.translation(); ent.body.setTranslation({ x, y: Math.max(t.y, ent.halfHeight + 0.002), z }, true); ent.body.setLinvel({ x: 0, y: 0, z: 0 }, true); ent.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
      else { ent.fixedBody.setTranslation({ x, y: ent.baseY || 0, z }, true); }
    }
    if (done) { this.worldPanel.syncSpec(ent); this.autosave(); }
  }

  setPath(pts) {
    this.sim.path = pts;
    this.viewport.drawPath(pts);
    if (pts) toast(`Pfad mit ${pts.length} Punkten gespeichert. Nutze „folge dem pfad“.`, 'ok');
    if (this.isSandbox()) this.autosave();
  }

  /* ================= Konsole und Anzeige ================= */

  log(text, kind = 'sys', robot) {
    if (!this.consoleLog) return;
    if (this.mctx && kind === 'say') this.mctx.log.push({ kind, text });
    const line = h('div.' + kind);
    if (this.scenario && this.scenario.running) line.appendChild(h('span.t', (this.sim.time - this.runStart).toFixed(2).padStart(6, ' ')));
    if (robot && this.project && this.project.robots.length > 1) line.appendChild(h('b', robot.name + ': '));
    else if (kind === 'say' && robot) line.appendChild(h('b', robot.name + ': '));
    line.appendChild(document.createTextNode(text));
    this.consoleLog.appendChild(line);
    while (this.consoleLog.children.length > 200) this.consoleLog.firstChild.remove();
    this.consoleLog.scrollTop = this.consoleLog.scrollHeight;
    this.logCount = (this.logCount || 0) + 1;
    this.consoleCount.textContent = this.logCount;
  }

  updateHud() {
    const r = this.selected && this.selected.isRobot ? this.selected : this.currentRobot();
    if (!r || this.screen !== 'bench') { this.hud.style.display = 'none'; return; }
    this.hud.style.display = '';
    const rows = [];
    const add = (k, v) => rows.push(h('span', k), h('span', v));
    const sens = r.sensors;
    try {
      if (r.type === 'arm') {
        const tcp = r.fk(r.currentAngles(false));
        add('TCP x / y / z', `${fmtNum(-tcp.x * 100, 0)} / ${fmtNum(tcp.y * 100, 0)} / ${fmtNum(tcp.z * 100, 0)}`);
        add('A1 · A2 · A3', ['basis', 'schulter', 'ellbogen'].map((n) => fmtNum(r.servos.get(n).display, 0) + '°').join(' · '));
      } else {
        add('Position', `${fmtNum(-r.frame().p.x * 100, 0)} / ${fmtNum(r.frame().p.z * 100, 0)} cm`);
        add('Orientierung', fmtNum(r.rep_kompass(), 0) + '°');
        const v = r.baseBody().linvel();
        add('Geschwindigkeit', fmtNum(Math.hypot(v.x, v.z), 2) + ' m/s');
      }
      if (r.type === 'humanoid') add('Neigung', fmtNum(r.rep_neigung(), 1) + '°');
      if (sens.abstand) add('Abstand', fmtNum(sens.abstand.value, 1) + ' cm');
      if (sens.lidar) { const n = sens.lidar.nearest(); add('LiDAR min.', fmtNum(n.dist * 100, 0) + ' cm @ ' + fmtNum(n.bearing, 0) + '°'); }
      if (sens.radar) { const t = sens.radar.nearest(); add('Radar', t ? `${fmtNum(t.dist, 1)} m · ${fmtNum(t.vr, 1)} m/s` : 'kein Ziel'); }
      if (sens.farbe) add('Farbsensor', sens.farbe.read());
      if (sens.linie) add('Spur L / R', (sens.linie.read('links') ? '■' : '□') + ' ' + (sens.linie.read('rechts') ? '■' : '□'));
      if (sens.waerme) add('Wärmebild max.', fmtNum(sens.waerme.maxTemp(), 1) + ' °C');
    } catch { /* während des Umbaus */ }
    const g = Object.values(r.grippers).find((x) => x.held) || r.grippers.main || r.grippers.rechts;
    if (g) add('Werkzeug', g.held ? `hält ${Math.round(g.held.mass * 1000)} g` : (g.type === 'zange' ? (g.isOpen ? 'offen' : 'geschlossen') : (g.on ? 'aktiv' : 'aus')));
    add('Antrieb max.', fmtNum(r.temperature(), 0) + ' °C');
    add('Leistung', fmtNum(r.power || 0, 0) + ' W' + (isFinite(r.battery.wh) ? ` · ${Math.round(r.batteryPct)} %` : ''));
    const slot = this.scenario.slotOf(r.defId);
    if (slot && slot.runtime) for (const [k, v] of slot.runtime.variables().slice(0, 5)) add(k, show(v).slice(0, 18));
    const st = r.status === 'umgefallen' ? h('span.st.bad', h('i.led.err'), 'STURZ') : r.status === 'akku leer' ? h('span.st.bad', h('i.led.err'), 'AKKU LEER') : r.paused ? h('span.st.hold', h('i.led.warn'), 'SICHERER HALT') : this.scenario.running ? h('span.st.run', h('i.led.ok'), 'AKTIV') : h('span.st', h('i.led'), 'BEREIT');
    const head = h('div.h', h('span', { html: icon(r.type) }), r.name, st);
    head.addEventListener('click', () => { this.hud.classList.toggle('min'); Store.setSetting('hudMin', this.hud.classList.contains('min')); });
    clear(this.hud);
    this.hud.append(head, h('div.grid', rows));
    if (Store.setting('hudMin', false)) this.hud.classList.add('min');
  }

  /* ================= Tastatur ================= */

  bindKeys() {
    addEventListener('keydown', (e) => {
      const typing = e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT');
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (this.screen === 'bench') this.toggleRun(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); if (this.screen === 'bench') { this.setMode(this.mode === 'blocks' ? 'text' : 'blocks'); this.showTab('program'); } return; }
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4', '5'].includes(e.key) && this.screen === 'bench') { e.preventDefault(); const tb = ['program', 'devices', 'build', 'world', 'help'][+e.key - 1]; if (tb !== 'world' || this.isSandbox()) this.showTab(tb); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); this.autosave(); toast('Gespeichert.', 'ok'); return; }
      if (e.key === 'Escape') {
        if (popOpen()) { closePop(); return; }
        if (modalOpen()) { closeModal(); return; }
        if (this.scenario.running) { this.stopProgram(true); return; }
      }
      if (typing || this.screen !== 'bench' || modalOpen()) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && this.mode === 'blocks') { e.preventDefault(); this.blockEd.undo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = KEY_NAMES[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : null);
      if (!k) return;
      if (this.scenario.running) {
        if (!this.keysDown.has(k)) this.scenario.keyDown(k);
        this.keysDown.add(k);
        if (k === 'leertaste' || k.startsWith('o') || ['oben', 'unten', 'links', 'rechts'].includes(k)) e.preventDefault();
        return;
      }
      if (k === 'f') { this.toggleFollow(); return; }
      if (k === '?') { this.showTab('help'); return; }
      if (['w', 'a', 's', 'd', 'oben', 'unten', 'links', 'rechts'].includes(k)) { e.preventDefault(); this.keysDown.add(k); }
    });
    addEventListener('keyup', (e) => {
      const k = KEY_NAMES[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : null);
      if (!k) return;
      this.keysDown.delete(k);
      if (this.scenario.running) this.scenario.keyUp(k);
    });
    addEventListener('blur', () => this.keysDown.clear());
  }

  // Fernsteuerung mit WASD / Pfeiltasten, solange kein Programm läuft
  manualDrive(dt) {
    if (this.scenario.running || this.screen !== 'bench') return;
    const r = this.currentRobot();
    if (!r) return;
    const k = this.keysDown;
    const fw = (k.has('w') || k.has('oben') ? 1 : 0) - (k.has('s') || k.has('unten') ? 1 : 0);
    const tn = (k.has('a') || k.has('links') ? 1 : 0) - (k.has('d') || k.has('rechts') ? 1 : 0);
    const active = fw || tn;
    if (r.type === 'rover') {
      if (active || this.wasDriving) r.setWheels(0.35 * fw - 0.18 * tn, 0.35 * fw + 0.18 * tn);
    } else if (r.type === 'humanoid') {
      if (r.status === 'umgefallen') return;
      const lo = r.loco;
      if (active) {
        r.legsManual = false;
        lo.mode = 'walk'; lo.stopping = false;
        lo.vx = 0.3 * fw;
        lo.stepT = 0.5;
        lo.yaw += tn * 1.4 * dt;
      } else if (this.wasDriving) { lo.stopping = true; lo.vx = 0; }
    } else if (r.type === 'arm' && active) {
      const b = r.servos.get('basis'), s = r.servos.get('schulter');
      b.set(b.target + tn * 1.2 * dt, 2);
      s.set(s.target - fw * 0.8 * dt, 2);
    }
    this.wasDriving = active;
  }

  /* ================= Hauptschleife ================= */

  frame(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    try {
      this.manualDrive(dt);
      this.sim.advance(dt);
      this.sim.sync();
      if (this.screen === 'home') this.home.update(dt);
      for (const r of this.sim.robots) for (const s of Object.values(r.sensors)) if (s.show) s.show(this.showSensors && this.screen === 'bench');
      this.viewport.update(dt);
      this.cam.update(dt);
      const focus = this.cam.target;
      this.renderer.focusShadow(focus.x, focus.z);
      this.renderer.render();
      if (this.screen === 'bench') {
        if (this.mctx && this.scenario.running) this.checkMission();
        else if (this.mission && this.mctx && !this.scenario.running && !this.mctx.done) this.checkMission();
        this.highlightRunning();
        if (t - this.lastHud > 150) { this.lastHud = t; this.updateHud(); this.clockEl.textContent = 'T+' + fmtNum(this.scenario.running ? this.sim.time - this.runStart : 0, 1) + ' s'; }
        let lvl = 0;
        for (const r of this.sim.robots) for (const s of r.servos.values()) lvl += Math.min(1, Math.abs(s.vel)) * (s.hidden ? 0.2 : 1);
        this.audio.servo(Math.min(1, lvl / 3));
        if (this.trying) {
          const s = this.scenario.slotOf(this.currentId);
          if (!s || !s.runtime || !s.runtime.threads.length) { this.trying = false; if (s && s.runtime && !this.scenario.running) { s.runtime.stop(); s.runtime = null; } this.updateRunBtn(); }
        }
      } else this.audio.servo(0);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }

  highlightRunning() {
    const s = this.scenario.slotOf(this.currentId);
    const ids = s && s.runtime && s.runtime.running ? s.runtime.activeNodes() : new Set();
    if (this.mode === 'blocks') this.blockEd.setActive(ids);
    else {
      const lines = new Set();
      if (ids.size && s.ast) {
        const walk = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o.id && ids.has(o.id) && o.line && o.type !== 'event' && o.type !== 'main' && o.type !== 'func') lines.add(o.line);
          for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
        };
        if (this.frameCount++ % 3 === 0 || !this.lastLines) { walk(s.ast); this.lastLines = lines; }
        this.textEd.setRunLines(this.lastLines);
      } else this.textEd.setRunLines(lines);
    }
  }
}

App.prototype.frameCount = 0;

// Automatischer Prüflauf: Musterlösung einer Mission so schnell wie möglich durchrechnen
App.prototype.testMission = function (id, maxSeconds = 240, opts = {}) {
  const m = MISSION_BY_ID[id];
  Store.setMissionCode(id, null);
  this.openMission(id);
  const sols = opts.code || m.solutions || [m.solution];
  const cfgs = opts.noConfig ? [] : (m.solutionConfigs || (m.solutionConfig ? [m.solutionConfig] : []));
  const extra = opts.config || [];
  if (cfgs.length || extra.length) { this.project.robots.forEach((d, i) => { const c = { ...(cfgs[i] || {}), ...(extra[i] || {}) }; d.config = withDefaults({ ...d.config, ...c, type: d.config.type }); }); this.buildWorld(); }
  sols.forEach((s, i) => { const d = this.project.robots[i]; const doc = this.docs.get(d.id); doc.layout = []; doc.setText(s); });
  this.loadEditors();
  this.startProgram();
  const t0 = performance.now();
  let errors = [], maxTemp = 0, hotAxis = '';
  const origErr = this.scenario.hooks.onError;
  this.scenario.hooks.onError = (slot, err) => { errors.push(err.message); origErr(slot, err); };
  while (this.sim.time - this.runStart < maxSeconds && !(this.mctx && this.mctx.done)) {
    this.sim.substep();
    if (this.sim.stepCount % 6 === 0) { this.checkMission(); for (const r of this.sim.robots) for (const sv of r.servos.values()) if (!sv.hidden && sv.temp > maxTemp) { maxTemp = sv.temp; hotAxis = sv.label; } }
    if (errors.length) break;
  }
  this.scenario.hooks.onError = origErr;
  const res = this.mission.goals.map((g, i) => { try { return this.mctx.latched.has(i) || !!g.check(this.mctx); } catch { return false; } });
  return { id, done: !!(this.mctx && this.mctx.done), simTime: +(this.sim.time - this.runStart).toFixed(1), wall: Math.round(performance.now() - t0), goals: res, errors, maxTemp: Math.round(maxTemp), hotAxis, log: [...this.consoleLog.children].slice(-6).map((d) => d.textContent) };
};
export { uid };
