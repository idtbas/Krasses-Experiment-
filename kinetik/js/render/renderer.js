// 3D-Darstellung: Studio-Szene mit weichem Licht, Schatten, Rasterboden und Umgebungsreflexen
import * as THREE from 'three';
import { RoomEnvironment } from 'three';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.r = r;

    const scene = new THREE.Scene();
    this.scene = scene;
    this.horizon = new THREE.Color('#e9edf2');
    scene.background = this.horizon.clone();
    scene.fog = new THREE.Fog(this.horizon, 9, 26);

    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.03, 80);
    this.camera.position.set(2.2, 1.6, 2.6);

    this.addSky();
    this.addLights();
    this.addFloor();

    // Weltgruppe für Dinge, die beim Zurücksetzen entfernt werden
    this.world = new THREE.Group();
    scene.add(this.world);
    // Hilfsgrafiken (Sensorstrahlen, Pfade, Auswahl)
    this.helpers = new THREE.Group();
    scene.add(this.helpers);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas.parentElement || canvas);
  }

  addSky() {
    const geo = new THREE.SphereGeometry(40, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color('#cdd6e2') }, bottom: { value: this.horizon } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }',
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    this.sky = sky;
    this.scene.add(sky);
  }

  addLights() {
    const hemi = new THREE.HemisphereLight('#ffffff', '#b9c0cc', 0.75);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#fffaf2', 2.3);
    key.position.set(3.5, 6, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = 3.2;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 18 });
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 4;
    this.key = key;
    this.scene.add(key);
    this.scene.add(key.target);
    const rim = new THREE.DirectionalLight('#dfe8ff', 0.6);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
  }

  addFloor() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#f3f4f6';
    g.fillRect(0, 0, 512, 512);
    // feine Linien alle 10 cm, kräftige jeden Meter
    for (let i = 0; i <= 10; i++) {
      const p = Math.round(i * 51.2);
      g.fillStyle = i % 10 === 0 ? 'rgba(90,100,120,0.34)' : 'rgba(90,100,120,0.10)';
      const w = i % 10 === 0 ? 3 : 1.5;
      g.fillRect(p - w / 2, 0, w, 512);
      g.fillRect(0, p - w / 2, 512, w);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    tex.anisotropy = this.r.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'boden';
    this.floor = floor;
    this.scene.add(floor);
    // Achsenkreuz am Ursprung (x rot, z blau), sehr dezent
    const ax = new THREE.Group();
    const bar = (len, color, rotY) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.012), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rotY;
      m.position.y = 0.0015;
      return m;
    };
    const xb = bar(0.5, '#ef4444', 0); xb.position.x = -0.25; ax.add(xb);
    const zb = bar(0.5, '#3b82f6', Math.PI / 2); zb.position.z = 0.25; ax.add(zb);
    this.axes = ax;
    this.scene.add(ax);
  }

  // Schattenkamera folgt dem Geschehen
  focusShadow(x, z) {
    this.key.position.set(x + 3.5, 6, z + 2.5);
    this.key.target.position.set(x, 0, z);
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.sky.position.copy(this.camera.position);
    this.r.render(this.scene, this.camera);
  }

  // Weltpunkt → Bildschirmkoordinaten (CSS-Pixel relativ zur Leinwand)
  project(v) {
    const p = (v.isVector3 ? v : new THREE.Vector3(v.x, v.y, v.z)).clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, visible: p.z < 1 && p.z > -1 };
  }
}
