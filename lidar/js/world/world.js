// Welt: Three.js-Szene mit LiDAR-relevantem Inhalt, Hilfsobjekten, Punktwolken, Licht, Wetter und Physik.
// Alles unter `content` sehen die Scanner. Objekte mit eigener ID (Register) können ausgewählt, verschoben
// und gezielt gescannt werden; sie sind eigene Instanzen im Scan-Kern.
import * as THREE from 'three';
import { RoomEnvironment } from 'three';
import { Sim } from '../../../kinetik/js/sim/sim.js';

export class World {
  constructor(app, R) {
    this.app = app;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.content = new THREE.Group(); this.content.name = 'Inhalt';
    this.helpers = new THREE.Group(); this.helpers.name = 'Hilfen'; this.helpers.userData.noLidar = true;
    this.clouds = new THREE.Group(); this.clouds.name = 'Punktwolken';
    scene.add(this.content, this.helpers, this.clouds);
    this.objects = [];
    this.nextId = 1;
    this.animated = [];
    this.addLights();
    // Physik (Rapier) aus KINETIK – Roboter fahren in derselben Welt
    this.sim = new Sim(R, { world: this.content, helpers: this.helpers, setEnvironment() {} });
    this.sim.running = true;
    this.weather = { preset: 'klar', sun: 0, fogVis: 0, rain: 0, dust: 0 };
    this.def = null;
  }

  addLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight('#dfe7f0', '#4a4f55', 0.8);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff4e5', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    s.add(sun, sun.target);
    this.fill = new THREE.DirectionalLight('#c9d6e6', 0.4);
    this.fill.position.set(-6, 4, -5);
    s.add(this.fill);
    // Netze im Viewer (Ebene 3): Kopflicht wie in Mesh-Viewern, unabhängig von der Hallenbeleuchtung
    this.headlight = new THREE.DirectionalLight('#ffffff', 2.0);
    this.headlight.layers.set(3);
    this.meshAmb = new THREE.HemisphereLight('#e8eef5', '#40454c', 0.9);
    this.meshAmb.layers.set(3);
    s.add(this.headlight, this.headlight.target, this.meshAmb);
  }

  setEnvMap(r) {
    if (this.envTex) return;
    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.45;
  }

  // Beleuchtung: Halle (Kunstlicht), außen (Sonne), Nacht
  setLighting(kind, opts = {}) {
    const s = this.scene;
    this.lighting = kind;
    const sun = this.sun;
    if (kind === 'outdoor') {
      const az = opts.sunAz ?? 0.8, el = opts.sunEl ?? 0.75;
      this.sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
      sun.position.copy(this.sunDir).multiplyScalar(40);
      sun.intensity = 3.0; sun.color.set('#fff2df');
      const S = opts.shadowSize ?? 24;
      Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 120 });
      sun.shadow.camera.updateProjectionMatrix();
      this.hemi.intensity = 1.0; this.hemi.color.set('#cfe2ff'); this.hemi.groundColor.set('#5b5346');
      s.background = new THREE.Color('#9fbad6');
      s.fog = new THREE.Fog('#b8c9da', 60, 260);
      this.scene.environmentIntensity = 0.55;
      this.light = { ambient: 0.5, sunI: 0.8, sun: 1 };
    } else if (kind === 'night') {
      this.sunDir = new THREE.Vector3(0.2, 0.9, 0.3).normalize();
      sun.position.set(6, 20, 8); sun.intensity = 0.25; sun.color.set('#9fb4ff');
      this.hemi.intensity = 0.12; this.hemi.color.set('#6b7fb3');
      s.background = new THREE.Color('#05070c');
      s.fog = new THREE.Fog('#05070c', 30, 140);
      this.scene.environmentIntensity = 0.08;
      this.light = { ambient: 0.05, sunI: 0.05, sun: 0 };
    } else {
      this.sunDir = new THREE.Vector3(0.25, 0.9, 0.3).normalize();
      sun.position.set(5, 14, 6); sun.intensity = 2.0; sun.color.set('#fff6ea');
      const S = opts.shadowSize ?? 14;
      Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 0.5, far: 50 });
      sun.shadow.camera.updateProjectionMatrix();
      this.hemi.intensity = 0.85; this.hemi.color.set('#e3e9f0'); this.hemi.groundColor.set('#4c5157');
      s.background = new THREE.Color(opts.bg || '#1a1e23');
      s.fog = new THREE.Fog(opts.bg || '#1a1e23', 30, 90);
      this.scene.environmentIntensity = 0.45;
      this.light = { ambient: 0.55, sunI: 0.6, sun: 0 };
    }
  }

  clear() {
    this.sim.clear();
    for (const c of [...this.content.children]) c.removeFromParent();
    for (const c of [...this.helpers.children]) c.removeFromParent();
    this.objects = [];
    this.nextId = 1;
    this.animated = [];
    this.def = null;
  }

  // Objekt registrieren: eigene ID, eigene Instanz im Scan-Kern (außer static: true)
  register(root, info = {}) {
    const id = this.nextId++;
    root.userData.objId = id;
    if (!info.static) root.userData.lidarBody = true;
    if (info.blasKey) root.userData.blasKey = info.blasKey;
    const o = { id, name: info.name || root.name || 'Objekt ' + id, kind: info.kind || 'objekt', root, movable: info.movable !== false && !info.static, target: info.target !== false, solid: !!info.solid, info: info.info || '', ref: info.ref || null };
    root.name = o.name;
    this.objects.push(o);
    if (info.solid) this.addCollider(root);
    return o;
  }

  objectById(id) { return this.objects.find((o) => o.id === id) || null; }

  // feste Kollisionskörper aus dem Hüllquader (für Roboter)
  addCollider(root) {
    const R = this.sim.physics.R, w = this.sim.physics.world;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    if (s.x < 0.02 || s.z < 0.02) return;
    const body = w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z));
    const col = w.createCollider(R.ColliderDesc.cuboid(s.x / 2, Math.max(0.01, s.y / 2), s.z / 2), body);
    this.sim.physics.tag(col, { kind: 'objekt', color: 'grau' });
    root.userData.collider = { body, col };
  }
  moveCollider(root) {
    const cl = root.userData.collider;
    if (!cl) return;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    cl.body.setTranslation({ x: c.x, y: c.y, z: c.z }, true);
  }

  animate(fn) { this.animated.push(fn); }

  update(dt, t) {
    for (const f of this.animated) f(dt, t);
    this.sim.advance(dt);
    this.sim.sync();
    if (this.rain) this.updateRain(dt);
  }

  /* -------- Wetter (sichtbar + LiDAR-Parameter) -------- */
  setWeather(preset) {
    const P = {
      klar: { sun: this.lighting === 'outdoor' ? 1 : 0, fogVis: 0, rain: 0, dust: 0 },
      bedeckt: { sun: this.lighting === 'outdoor' ? 0.35 : 0, fogVis: 0, rain: 0, dust: 0 },
      nebel: { sun: this.lighting === 'outdoor' ? 0.15 : 0, fogVis: 45, rain: 0, dust: 0 },
      dichter_nebel: { sun: 0, fogVis: 18, rain: 0, dust: 0 },
      regen: { sun: 0.1, fogVis: 0, rain: 12, dust: 0 },
      starkregen: { sun: 0, fogVis: 350, rain: 40, dust: 0 },
      staub: { sun: 0, fogVis: 120, rain: 0, dust: 0.6 },
      nacht: { sun: 0, fogVis: 0, rain: 0, dust: 0 },
    }[preset] || { sun: 0, fogVis: 0, rain: 0, dust: 0 };
    this.weather = { preset, ...P };
    const s = this.scene;
    const base = this.lighting === 'outdoor' ? '#b8c9da' : this.lighting === 'night' ? '#05070c' : '#1a1e23';
    if (P.fogVis > 0) {
      const col = this.lighting === 'outdoor' ? '#c3ccd4' : '#3a3f45';
      s.fog = new THREE.Fog(col, 0.5, Math.max(8, P.fogVis * 1.1));
      if (this.lighting === 'outdoor') s.background = new THREE.Color(col);
    } else {
      s.fog = new THREE.Fog(base, this.lighting === 'outdoor' ? 60 : 30, this.lighting === 'outdoor' ? 260 : 90);
      if (this.lighting === 'outdoor') s.background = new THREE.Color(P.sun < 0.5 ? '#aab6c2' : '#9fbad6');
    }
    if (this.lighting === 'outdoor') this.sun.intensity = 0.6 + 2.6 * P.sun;
    this.setRain(P.rain);
    return this.lidarEnv();
  }

  lidarEnv() {
    const L = this.light || { ambient: 0.5, sunI: 0.6 };
    const d = this.sunDir || new THREE.Vector3(0.3, 0.8, 0.5);
    return { ...this.weather, sunDir: [d.x, d.y, d.z], ambient: L.ambient, sunI: L.sunI * (this.weather.sun > 0 ? 0.4 + 0.6 * this.weather.sun : 0.6) };
  }

  setRain(rate) {
    if (this.rain) { this.rain.removeFromParent(); this.rain.geometry.dispose(); this.rain = null; }
    if (!rate) return;
    const n = Math.min(9000, Math.round(rate * 260));
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 40, y = Math.random() * 14, z = (Math.random() - 0.5) * 40;
      pos.set([x, y, z, x + 0.02, y - 0.35, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color: '#c9d6e2', transparent: true, opacity: 0.35 });
    this.rain = new THREE.LineSegments(g, m);
    this.rain.frustumCulled = false;
    this.helpers.add(this.rain);
  }
  updateRain(dt) {
    const p = this.rain.geometry.attributes.position, a = p.array;
    for (let i = 0; i < a.length; i += 6) {
      a[i + 1] -= 9 * dt; a[i + 4] -= 9 * dt;
      if (a[i + 4] < 0) { a[i + 1] += 14; a[i + 4] += 14; }
    }
    p.needsUpdate = true;
  }
}
