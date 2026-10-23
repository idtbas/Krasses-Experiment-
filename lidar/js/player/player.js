// Spielfigur: Du bist eine Person in der Szene. Laufen (WASD oder Pfeiltasten, Shift schneller), umsehen
// (Maus mit Zeigerfang, am iPad wischen), Schulter- oder Ich-Sicht (V). Du trägst Geräte in der Hand, stellst
// Stative auf, setzt Scanner auf, montierst sie an Roboter und hältst den Feldrechner vor dich (Tab).
// Die Figur ist für die Laser sichtbar – wer vor dem Scanner steht, wirft einen Scanschatten.
import * as THREE from 'three';
import { person } from '../world/props_industry.js';
import { h, toast } from '../ui/dom.js';
import { openCatalog } from '../ui/catalog.js';
import { PLATFORMS } from '../robots/mounts.js';
import { tabletModel } from './items.js';
import { lm, lmTint } from '../world/lidarmat.js';

export const PLAYER_LAYER = 5;
const R_BODY = 0.27;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));

// Höhe der Decke je Szene (für die Schulterkamera in Räumen)
const CEIL = { halle: 7.0, wohnung: 2.45, messraum: 3.0 };

export class Player {
  constructor(app) {
    this.app = app;
    this.pos = V(); this.vel = V();
    this.yaw = 0; this.pitch = -0.15; this.bodyYaw = 0;
    this.ground = 0; this.groundT = 0;
    this.view = 'tps'; this.camDist = 3.0;
    this.keys = new Set(); this.joy = { x: 0, y: 0, on: false };
    this.hand = null;            // { type: 'device', dev } | { type: 'tripod', tripod }
    this.hasTablet = false;
    this.tabletOpen = false;
    this.phase = 0; this.boxes = []; this.boxT = 0;
    this.target = null; this.acts = [];
    this.buildUI();
    this.bindInput();
  }

  /* ---------------- Aufbau ---------------- */
  spawn(x, z, yaw = 0) {
    const w = this.app.world;
    const g = person('arbeit', 0);
    g.name = 'Du';
    w.content.add(g);
    this.model = g;
    this.reg = w.register(g, { name: 'Du (Vermesser)', kind: 'spieler', target: false, movable: false });
    this.limbs = g.userData.limbs;
    // Hand (Geräte), Tragepunkt fürs Stativ (rechts neben dem Körper), Feldrechner am Gurt und in beiden Händen
    this.grip = new THREE.Object3D(); this.grip.position.set(-0.2, 1.15, 0.5); g.add(this.grip);
    this.carry = new THREE.Object3D(); this.carry.position.set(-0.46, 0.24, 0.08); g.add(this.carry);
    this.holster = tabletModel(); this.holster.scale.setScalar(0.85); this.holster.position.set(0.215, 0.98, -0.02); this.holster.rotation.set(0, 0, Math.PI / 2);
    this.held = tabletModel(); this.held.position.set(0, 1.2, 0.36); this.held.rotation.x = -1.05;
    for (const t of [this.holster, this.held]) { t.userData.noLidar = true; g.add(t); }
    // eigene Ausrüstung: orange Warnweste und blauer Helm (die Kollegen in der Halle tragen Gelb und Weiß)
    const vest = lm('warnweste'), myVest = lmTint('warnweste', '#ff7a1a'), myHelmet = lmTint('kunststoff_weiss', '#2f6fd6');
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material === vest) o.material = myVest;
      else if (o.material && o.material.color && o.material.color.getHexString() === 'f2f2f0') o.material = myHelmet;
      o.layers.set(PLAYER_LAYER); o.castShadow = true;
    });
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0);
    this.yaw = this.bodyYaw = yaw; this.pitch = -0.15;
    this.ground = 0;
    this.hand = null;
    this.boxT = 0;
    this.syncModel(0);
  }

  buildUI() {
    this.prompt = h('div#prompt.hidden');
    this.hotbar = h('div#hotbar');
    this.cross = h('div#cross');
    this.keysHelp = h('div#keyshelp', { html: TOUCH ? '' : '<b>WASD</b> gehen · <b>Shift</b> schneller · <b>Maus</b> umsehen (klicken) · <b>E F R G</b> Aktionen · <b>Q</b> Objekt markieren · <b>Tab</b> Feldrechner · <b>V</b> Sicht' });
    this.lockHint = h('div#lockhint.hidden', 'Klicken, um dich umzusehen · Esc gibt die Maus frei');
    this.touch = h('div#touchui' + (TOUCH ? '' : '.hidden'));
    this.joyEl = h('div.joy', h('i'));
    const btns = h('div.tbtns');
    for (const [k, label] of [['E', 'E'], ['F', 'F'], ['R', 'R'], ['G', 'G'], ['Tab', 'PC'], ['V', 'Sicht']]) {
      const b = h('button.tbtn', { 'data-k': k }, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.key(k); });
      btns.appendChild(b);
    }
    this.touch.append(this.joyEl, btns);
  }
  mount(sceneEl) { sceneEl.append(this.cross, this.prompt, this.hotbar, this.keysHelp, this.lockHint, this.touch); }

  /* ---------------- Eingabe ---------------- */
  bindInput() {
    const typing = (e) => e.target && /input|select|textarea/i.test(e.target.tagName);
    window.addEventListener('keydown', (e) => {
      if (!this.model || typing(e) || document.body.classList.contains('athome')) return;
      if (e.code === 'Tab') { e.preventDefault(); this.key('Tab'); return; }
      if (e.repeat) { if (/^(Key[WASD]|Arrow)/.test(e.code)) e.preventDefault(); return; }
      const k = { KeyE: 'E', KeyF: 'F', KeyR: 'R', KeyG: 'G', KeyQ: 'Q', KeyV: 'V' }[e.code];
      if (k) { e.preventDefault(); this.key(k); return; }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|ShiftLeft|ShiftRight)$/.test(e.code)) { this.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.lockEl; this.lockHint.classList.toggle('hidden', this.locked || TOUCH || this.tabletOpen); });
    document.addEventListener('mousemove', (e) => { if (this.locked) this.look(e.movementX, e.movementY); });
  }
  // Szenenfläche: Klick fängt den Zeiger (Desktop), Ziehen dreht die Sicht (Touch), Joystick links unten
  bindScene(el) {
    this.lockEl = el;
    const drags = new Map();
    el.addEventListener('pointerdown', (e) => {
      if (!this.model || this.tabletOpen) return;
      if (e.pointerType === 'mouse' && !TOUCH) { if (!this.locked && el.requestPointerLock) el.requestPointerLock(); return; }
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const joy = e.clientX - r.left < r.width * 0.42 && e.clientY - r.top > r.height * 0.45 && !this.joy.on;
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY, joy });
      if (joy) { this.joy.on = true; this.joy.cx = e.clientX; this.joy.cy = e.clientY; this.joyEl.style.left = (e.clientX - r.left - 55) + 'px'; this.joyEl.style.top = (e.clientY - r.top - 55) + 'px'; this.joyEl.classList.add('on'); }
    });
    el.addEventListener('pointermove', (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      if (d.joy) {
        const dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy, L = Math.hypot(dx, dy), m = Math.min(1, L / 50);
        this.joy.x = L ? dx / L * m : 0; this.joy.y = L ? dy / L * m : 0;
        this.joyEl.firstChild.style.transform = `translate(${this.joy.x * 34}px, ${this.joy.y * 34}px)`;
      } else { this.look((e.clientX - d.x) * 1.6, (e.clientY - d.y) * 1.6); d.x = e.clientX; d.y = e.clientY; }
    });
    const up = (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      drags.delete(e.pointerId);
      if (d.joy) { this.joy = { x: 0, y: 0, on: false }; this.joyEl.classList.remove('on'); this.joyEl.firstChild.style.transform = ''; }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { if (this.view === 'tps') { e.preventDefault(); this.camDist = clamp(this.camDist * (1 + Math.sign(e.deltaY) * 0.12), 1.2, 5); } }, { passive: false });
    this.lockHint.classList.toggle('hidden', TOUCH);
  }
  look(dx, dy) {
    this.yaw -= dx * 0.0023;
    this.pitch = clamp(this.pitch - dy * 0.0023, -1.35, 1.2);
  }
  key(k) {
    if (!this.model) return;
    if (k === 'Tab') { this.toggleTablet(); return; }
    if (k === 'V') { this.view = this.view === 'tps' ? 'fps' : 'tps'; toast(this.view === 'fps' ? 'Ich-Sicht' : 'Schulterblick'); return; }
    if (k === 'Q') { this.markObject(); return; }
    const a = this.acts.find((x) => x.key === k && x.run);
    if (a) { a.run(); this.refreshPrompt(true); }
  }

  /* ---------------- Feldrechner ---------------- */
  toggleTablet(force) {
    const open = force ?? !this.tabletOpen;
    if (open && !this.hasTablet) { toast('Der Feldrechner liegt an der Geräteausgabe – hingehen und mit F nehmen.', 'warn'); return; }
    this.tabletOpen = open;
    document.body.classList.toggle('tabopen', open);
    if (open) { this.app.fpc.setTab('live'); this.app.fpc.aimAtDevice(); }
    if (open && document.pointerLockElement) document.exitPointerLock();
    this.lockHint.classList.toggle('hidden', open || this.locked || TOUCH);
    this.app.fpc.render();
    this.app.top.render();
  }
  takeTablet() {
    const st = this.app.station;
    if (st) st.takeTablet();
    this.hasTablet = true;
    toast('Feldrechner am Gurt – Tab hält ihn vor dich', 'ok');
  }

  /* ---------------- Tragen und Abstellen ---------------- */
  front(d = 0.9) { return V(this.pos.x + Math.sin(this.yaw) * d, this.ground, this.pos.z + Math.cos(this.yaw) * d); }
  freeAt(p, r) {
    this.refreshBoxes(true);
    const b = this.app.world.bounds;
    if (b && (p.x < b[0] + r || p.x > b[1] - r || p.z < b[2] + r || p.z > b[3] - r)) return false;
    for (const B of this.boxes) if (p.x > B.min.x - r && p.x < B.max.x + r && p.z > B.min.z - r && p.z < B.max.z + r) return false;
    return true;
  }
  // Gerät in die Hand nehmen (aus der Ausgabe, vom Stativ, vom Boden oder von einer Plattform)
  takeDevice(dev) {
    const a = this.app;
    if (a.mounts.cur && a.mounts.cur.kind !== 'hand') a.mounts.detach();
    if (dev.state === 'tls') return;
    for (const t of a.tripods) if (t.device === dev) t.device = null;
    const handheld = a.mounts.allowed('hand', dev);
    if (handheld) a.mounts.attachPlayer(dev, this);
    else { dev.mountOn('getragen', { parent: this.grip }); a.mounts.cur = null; }
    this.hand = { type: 'device', dev };
    a.lw.sync();
    a.top.render(); a.fpc.render();
  }
  takeTripod(tr) {
    if (tr.device && tr.device.state === 'tls') { toast('Stationsscan läuft – Stativ nicht bewegen!', 'warn'); return; }
    if (tr.device && tr.device.state === 'stream' && this.app.fpc.recording) this.app.fpc.toggleRecord();
    this.carry.add(tr.group);
    tr.group.position.set(0, 0, 0); tr.group.rotation.set(0, 0, 0);
    tr.carried = true;
    this.hand = { type: 'tripod', tripod: tr };
  }
  placeTripod() {
    const tr = this.hand.tripod, p = this.front(0.95);
    if (!this.freeAt(p, 0.42)) { toast('Kein Platz zum Aufstellen', 'warn'); return; }
    tr.place(p.x, p.z, this.yaw);
    tr.group.position.y = this.groundAt(p);
    this.hand = null;
    this.app.lw.sync();
  }
  mountOnTripod(tr) {
    const dev = this.hand.dev, a = this.app;
    if (a.mounts.cur && a.mounts.cur.kind === 'hand') a.mounts.cur = null;
    dev.mountOn('stativ', { tripod: tr });
    tr.device = dev;
    this.hand = null;
    a.lw.sync(); a.top.render(); a.fpc.render();
    toast(`${dev.spec.model} sitzt auf dem Stativ – F schaltet ein`, 'ok');
  }
  putDown() {
    const dev = this.hand.dev, a = this.app, p = this.front(0.6);
    if (dev.state === 'stream' && a.fpc.recording) a.fpc.toggleRecord();
    if (a.mounts.cur && a.mounts.cur.kind === 'hand') a.mounts.cur = null;
    dev.mountOn('boden', { parent: a.world.content, offset: [p.x, this.groundAt(p), p.z] });
    dev.root.rotation.y = this.yaw;
    this.hand = null;
    a.lw.sync(); a.top.render(); a.fpc.render();
  }
  async mountOnPlatform(kind) {
    const dev = this.hand.dev;
    this.hand = null;
    const ok = await this.app.mounts.attach(kind, dev);
    if (!ok) this.takeDevice(dev);
  }
  takeFromPlatform() {
    const a = this.app, dev = a.dev;
    if (a.mounts.job) a.mounts.stopJob(null);
    a.mounts.detach();
    this.takeDevice(dev);
  }

  /* ---------------- Ziele und Aktionen ---------------- */
  candidates() {
    const a = this.app, L = [];
    for (const t of a.tripods) if (!t.carried && t.group.parent) L.push({ kind: 'tripod', ref: t, pos: t.pos, r: 1.6, name: t.device ? `Stativ · ${t.device.spec.maker} ${t.device.spec.model}` : 'Vermessungsstativ (leer)' });
    if (a.station) L.push({ kind: 'station', ref: a.station, pos: a.station.pos, r: 1.9, name: 'Geräteausgabe' });
    for (const [k, c] of Object.entries(a.mounts.park)) if (c.pos) L.push({ kind: 'platform', pk: k, ref: c, pos: c.pos(), r: k === 'arm' ? 1.9 : 1.5, name: PLATFORMS[k].name });
    const T = a.world.turntable;
    if (T) L.push({ kind: 'turntable', pos: T.plate.getWorldPosition(V()), r: 1.5, name: 'Drehteller' });
    const d = a.dev;
    if (d && d.mountKind === 'boden') L.push({ kind: 'floordev', ref: d, pos: d.root.getWorldPosition(V()), r: 1.3, name: `${d.spec.maker} ${d.spec.model} (am Boden)` });
    return L;
  }
  pickTarget() {
    let best = null, bs = Infinity;
    for (const c of this.candidates()) {
      const dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > c.r) continue;
      const ang = d < 0.5 ? 0 : Math.abs(wrap(Math.atan2(dx, dz) - this.yaw));
      if (ang > 1.05) continue;
      const s = d + ang * 1.3;
      if (s < bs) { bs = s; best = c; }
    }
    return best;
  }
  actions(t) {
    const a = this.app, hand = this.hand, d = a.dev, A = [];
    const add = (key, label, run) => { if (!A.some((x) => x.key === key)) A.push({ key, label, run }); };
    const devHand = hand && hand.type === 'device';
    const on = d && d.state === 'stream', tls = d && d.kind === 'tls';
    if (t) switch (t.kind) {
      case 'tripod': {
        const tr = t.ref;
        if (devHand && !tr.device) add('E', `${d.spec.model} aufsetzen`, () => this.mountOnTripod(tr));
        if (!hand && tr.device) {
          add('E', 'Scanner abnehmen', () => this.takeDevice(tr.device));
          add('F', tls ? (d.state === 'tls' ? 'Stationsscan abbrechen' : 'Stationsscan starten') : on ? 'Laser aus' : 'Laser an', () => a.toggleStream());
          if (!tls) add('R', a.fpc.recording ? 'Aufnahme beenden' : 'Aufnahme starten', () => a.fpc.toggleRecord());
          add('G', 'Stativ samt Scanner tragen', () => this.takeTripod(tr));
        }
        if (!hand && !tr.device) add('E', 'Stativ aufnehmen', () => this.takeTripod(tr));
        break;
      }
      case 'station':
        add('E', 'Scanner wählen (Katalog)', () => { if (document.pointerLockElement) document.exitPointerLock(); openCatalog(a); });
        if (!this.hasTablet && t.ref.hasTablet) add('F', 'Feldrechner nehmen', () => this.takeTablet());
        break;
      case 'platform': {
        const c = t.ref, mounted = a.mounts.cur === c;
        if (devHand && !mounted) { const why = a.mounts.whyNot(t.pk, d); add('E', why ? `Passt nicht: ${why}` : `${d.spec.model} montieren`, why ? null : () => this.mountOnPlatform(t.pk)); }
        if (!hand && mounted) {
          add('E', 'Scanner abnehmen', () => this.takeFromPlatform());
          add('F', a.mounts.job ? 'Autoscan stoppen' : 'Autoscan starten', () => a.mounts.start());
        }
        if (!hand && !mounted) add('', 'Scanner in die Hand nehmen, dann hier montieren', null);
        break;
      }
      case 'turntable': {
        const T = a.world.turntable;
        add('F', T.speed ? 'Drehteller anhalten' : 'Drehteller starten (20 s je Umdrehung)', () => { T.speed = T.speed ? 0 : 2 * Math.PI / 20; a.fpc.render(); });
        break;
      }
      case 'floordev':
        if (!hand) add('E', `${d.spec.model} aufheben`, () => this.takeDevice(d));
        if (!hand) add('F', on ? 'Laser aus' : 'Laser an', () => a.toggleStream());
        break;
    }
    // was du in der Hand hältst
    if (devHand) {
      if (d.mountKind === 'getragen') add('', 'Zum Messen auf ein Stativ oder eine Plattform setzen', null);
      else if (d.kind === 'phone') add('R', a.phone.session ? 'Handy-Scan beenden' : 'Handy-Scan starten', () => a.phone.toggle());
      else {
        add('F', on ? 'Laser aus' : 'Laser an', () => a.toggleStream());
        add('R', a.fpc.recording ? 'Aufnahme beenden' : 'Handgeführt aufnehmen', () => a.fpc.toggleRecord());
      }
      add('G', 'Ablegen', () => this.putDown());
    }
    if (hand && hand.type === 'tripod') add('E', 'Stativ hier aufstellen', () => this.placeTripod());
    return A;
  }
  // Objekt in der Blickmitte markieren (Sollobjekt für den Vergleich, Ziel für den Autoscan)
  async markObject() {
    const a = this.app, cam = a.sceneCam;
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const res = await a.engine.castRay([cam.position.x, cam.position.y, cam.position.z], [d.x, d.y, d.z], 60);
    const hit = res && (res.hit || res);
    const obj = hit && hit.obj ? a.world.objectById(hit.obj) : null;
    if (!obj || obj.target === false) { toast('Kein Objekt im Blick', 'warn'); return; }
    a.selected = obj;
    a.mounts.opts.target = obj.id;
    toast(`Markiert: ${obj.name} (${(hit.t || 0).toFixed(1).replace('.', ',')} m) – Ziel für Autoscan und Sollgeometrie im Vergleich`, 'ok');
    a.fpc.render();
  }

  refreshPrompt(force) {
    const t = this.target, A = this.acts;
    const sig = (t ? t.name : '') + '|' + A.map((x) => x.key + x.label).join('|');
    if (sig === this.sig && !force) return;
    this.sig = sig;
    this.prompt.classList.toggle('hidden', !t && !A.length);
    this.prompt.innerHTML = (t ? `<div class="pt">${t.name}</div>` : '') + A.map((x) => `<div class="pa${x.run ? '' : ' off'}">${x.key ? `<kbd>${x.key}</kbd>` : ''}<span>${x.label}</span></div>`).join('');
    const hd = this.hand;
    const what = !hd ? 'leere Hände' : hd.type === 'tripod' ? `Stativ${hd.tripod.device ? ' mit ' + hd.tripod.device.spec.model : ''}` : `${hd.dev.spec.maker} ${hd.dev.spec.model}`;
    this.hotbar.innerHTML = `<span>In der Hand: <b>${what}</b></span><span>Feldrechner: <b>${this.hasTablet ? (this.tabletOpen ? 'vor dir' : 'am Gurt <kbd>Tab</kbd>') : 'an der Ausgabe'}</b></span>`;
    for (const b of this.touch.querySelectorAll('.tbtn')) { const k = b.dataset.k; b.classList.toggle('dim', !['Tab', 'V'].includes(k) && !A.some((x) => x.key === k && x.run)); }
  }

  /* ---------------- Kollision und Boden ---------------- */
  refreshBoxes(force) {
    if (!force && this.boxT > 0) return;
    this.boxT = 0.4;
    const w = this.app.world, out = [];
    const skip = new Set([this.reg]);
    for (const t of this.app.tripods) if (t.carried) skip.add(t.reg);
    const d = this.app.dev;
    for (const o of w.objects) {
      if (skip.has(o) || !o.root.parent || o.kind === 'scanner') continue;
      if (o.static && !o.root.userData.collider) continue;
      if (o.kind === 'stativ') { const p = o.root.getWorldPosition(V()); out.push({ min: V(p.x - 0.22, 0, p.z - 0.22), max: V(p.x + 0.22, 2, p.z + 0.22) }); continue; }
      let inside = false;
      for (let q = this.model; q; q = q.parent) if (q === o.root) inside = true;
      if (inside) continue;
      const bx = new THREE.Box3().setFromObject(o.root);
      if (bx.isEmpty() || bx.max.y < this.ground + 0.28 || bx.min.y > this.ground + 1.8) continue;
      out.push(bx);
    }
    if (d && d.mountKind === 'boden') { const p = d.root.getWorldPosition(V()); out.push({ min: V(p.x - 0.12, 0, p.z - 0.12), max: V(p.x + 0.12, 1, p.z + 0.12) }); }
    this.boxes = out;
  }
  collide(p) {
    const R = R_BODY;
    for (let pass = 0; pass < 2; pass++) {
      for (const B of this.boxes) {
        const cx = clamp(p.x, B.min.x, B.max.x), cz = clamp(p.z, B.min.z, B.max.z);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-10) { const d = Math.sqrt(d2); p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
        else {
          // im Quader: kürzester Weg hinaus
          const m = [[p.x - B.min.x + R, -1, 0], [B.max.x - p.x + R, 1, 0], [p.z - B.min.z + R, 0, -1], [B.max.z - p.z + R, 0, 1]].sort((u, v) => u[0] - v[0])[0];
          p.x += m[1] * m[0]; p.z += m[2] * m[0];
        }
      }
    }
    const b = this.app.world.bounds;
    if (b) { p.x = clamp(p.x, b[0] + R, b[1] - R); p.z = clamp(p.z, b[2] + R, b[3] - R); }
    return p;
  }
  groundAt() { return this.ground; }
  // Bodenhöhe per Strahl aus dem Scan-Kern (Gehwege, Rasen), seitlich versetzt, damit die eigenen Beine nicht stören
  probeGround() {
    const a = this.app, p = this.pos;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const offs = [[0.38 * c, -0.38 * s], [-0.38 * c, 0.38 * s], [0.38 * s, 0.38 * c]];
    Promise.all(offs.map(([ox, oz]) => a.engine.castRay([p.x + ox, this.ground + 1.1, p.z + oz], [0, -1, 0], 2.5).catch(() => null))).then((R) => {
      let best = null;
      for (const r of R) {
        const hit = r && (r.hit || r);
        if (!hit || !hit.t) continue;
        const y = this.ground + 1.1 - hit.t;
        if (Math.abs(y - this.ground) < 0.22 && (best == null || Math.abs(y - this.ground) < Math.abs(best - this.ground))) best = y;
      }
      if (best != null) this.groundWant = best;
    });
  }

  /* ---------------- je Bild ---------------- */
  update(dt, dtr) {
    if (!this.model) return;
    const a = this.app;
    this.boxT -= dtr;
    this.refreshBoxes();
    // Wunschbewegung (relativ zur Blickrichtung)
    const K = this.keys;
    let f = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    let s = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    if (this.joy.on) { f = -this.joy.y; s = this.joy.x; }
    const L = Math.hypot(f, s);
    if (L > 1) { f /= L; s /= L; }
    const heavy = this.hand && this.hand.type === 'tripod';
    const vmax = (K.has('ShiftLeft') || K.has('ShiftRight') ? 2.6 : 1.35) * (heavy ? 0.75 : 1);
    const fw = V(Math.sin(this.yaw), 0, Math.cos(this.yaw)), rt = V(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const want = fw.multiplyScalar(f * vmax).add(rt.multiplyScalar(s * vmax));
    const k = 1 - Math.exp(-dt * 9);
    this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    const np = V(this.pos.x + this.vel.x * dt, 0, this.pos.z + this.vel.z * dt);
    this.collide(np);
    const moved = Math.hypot(np.x - this.pos.x, np.z - this.pos.z);
    if (dt > 0) { this.vel.x = (np.x - this.pos.x) / dt; this.vel.z = (np.z - this.pos.z) / dt; }
    this.pos.x = np.x; this.pos.z = np.z;
    // Boden
    this.groundT -= dtr;
    if (this.groundT <= 0) { this.groundT = 0.12; this.probeGround(); }
    if (this.groundWant != null) this.ground += (this.groundWant - this.ground) * Math.min(1, dtr * 10);
    this.pos.y = this.ground;
    // Körper dreht sich zur Blickrichtung
    this.bodyYaw += clamp(wrap(this.yaw - this.bodyYaw), -7 * dtr, 7 * dtr);
    this.phase += moved * 4.4;
    this.speed = dt > 0 ? moved / dt : 0;
    this.syncModel(dtr);
    // Ziel und Aktionen
    this.target = this.pickTarget();
    this.acts = this.actions(this.target);
    this.refreshPrompt();
  }

  // Gangbild und Haltung (Arme je nach getragenem Gegenstand)
  syncModel() {
    const g = this.model, L = this.limbs;
    const w = clamp((this.speed || 0) / 1.35, 0, 1.4);
    const sw = Math.sin(this.phase) * 0.48 * Math.min(1, w);
    g.position.set(this.pos.x, this.pos.y + 0.018 * Math.abs(Math.sin(this.phase)) * Math.min(1, w), this.pos.z);
    g.rotation.y = this.bodyYaw;
    L.legs[0].rotation.x = sw; L.legs[1].rotation.x = -sw;
    const hd = this.hand;
    if (this.tabletOpen) { L.arms[0].rotation.x = -0.95; L.arms[1].rotation.x = -0.95; }
    else {
      L.arms[1].rotation.x = -sw * 0.7;
      L.arms[0].rotation.x = hd && hd.type === 'device' ? -1.0 - this.pitch * 0.5 : hd && hd.type === 'tripod' ? -0.12 : sw * 0.7;
    }
    // Geräte zeigen dorthin, wohin du schaust (auch nach oben/unten)
    const look = hd && hd.type === 'device';
    this.grip.position.set(-0.2, 1.15 + (look ? this.pitch * 0.25 : 0), 0.5 - (look ? Math.abs(this.pitch) * 0.12 : 0));
    this.grip.rotation.set(look ? -this.pitch * 0.9 : 0, wrap(this.yaw - this.bodyYaw), 0);
    this.holster.visible = this.hasTablet && !this.tabletOpen;
    this.held.visible = this.tabletOpen;
  }

  // Schulter- oder Ich-Kamera
  updateCamera(cam, dtr) {
    if (!this.model) return;
    const a = this.app;
    const cp = Math.cos(this.pitch);
    const dir = V(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const right = V(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    if (this.view === 'fps') {
      const eye = V(this.pos.x, this.pos.y + 1.64, this.pos.z).addScaledVector(V(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.12);
      cam.position.copy(eye);
      cam.lookAt(eye.clone().add(dir));
      cam.layers.disable(PLAYER_LAYER);
    } else {
      const head = V(this.pos.x, this.pos.y + 1.52, this.pos.z).addScaledVector(right, 0.42);
      const c = head.clone().addScaledVector(dir, -this.camDist).add(V(0, 0.32, 0));
      const b = a.world.bounds;
      if (b) { c.x = clamp(c.x, b[0] + 0.15, b[1] - 0.15); c.z = clamp(c.z, b[2] + 0.15, b[3] - 0.15); }
      // an Wänden rückt die Kamera näher – dann über die Schulter nach oben ausweichen
      const dd = c.distanceTo(head);
      if (dd < this.camDist * 0.75) c.y += (this.camDist * 0.75 - dd) * 0.9;
      const ceil = CEIL[a.sceneId];
      c.y = clamp(c.y, this.pos.y + 0.35, ceil ? ceil : 1e9);
      if (!this.camInit) { cam.position.copy(c); this.camInit = true; }
      cam.position.lerp(c, 1 - Math.exp(-dtr * 16));
      cam.lookAt(head.clone().addScaledVector(dir, 4));
      cam.layers.enable(PLAYER_LAYER);
    }
  }
}
