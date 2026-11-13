// 3D-Darstellung: Testhalle mit Betonboden, Stützen, Dachbindern und Hallenstrahlern,
// Schatten, Umgebungsreflexen sowie steuerbarer Beleuchtung (hell, Dämmerung, dunkel) und Nebel.
import * as THREE from 'three';
import { RoomEnvironment } from 'three';
import { Mat, Geo, mesh, optimizeGroup, stripeTexture, labelTexture } from './materials.js';

export const HALL = { x: 16, z: 16, h: 9, columns: 8 };

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
    this.bg = new THREE.Color('#1c1f23');
    scene.background = this.bg.clone();
    scene.fog = new THREE.Fog(this.bg.clone(), 14, 46);

    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.03, 90);
    this.camera.position.set(2.2, 1.6, 2.6);

    this.addLights();
    this.addFloor();
    this.addHall();

    this.world = new THREE.Group();
    scene.add(this.world);
    this.helpers = new THREE.Group();
    scene.add(this.helpers);

    this.env = { light: 1, fog: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas.parentElement || canvas);
  }

  addLights() {
    this.hemi = new THREE.HemisphereLight('#dfe6ee', '#4a4f55', 0.95);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight('#fff6ea', 2.2);
    key.position.set(2.5, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = 3.4;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 18 });
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 4;
    this.key = key;
    this.scene.add(key);
    this.scene.add(key.target);
    this.fill = new THREE.DirectionalLight('#cfd9e6', 0.55);
    this.fill.position.set(-4, 3, -3);
    this.scene.add(this.fill);
    this.base = { hemi: this.hemi.intensity, key: key.intensity, fill: this.fill.intensity, envI: 0.5 };
  }

  addFloor() {
    // Hallenboden: Beton mit Fugen; in der Mitte ein beschichtetes Prüffeld mit 0,5-m-Raster
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#7d8287'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * 1024, y = Math.random() * 1024, r = 2 + Math.random() * 26;
      const v = Math.random() < 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${0.012 + Math.random() * 0.03})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(30,30,30,${0.03 + Math.random() * 0.05})`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const x = Math.random() * 1024, y = Math.random() * 1024;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (Math.random() - 0.5) * 300, y + (Math.random() - 0.5) * 300, x + (Math.random() - 0.5) * 400, y + (Math.random() - 0.5) * 400);
      g.stroke();
    }
    g.fillStyle = 'rgba(25,27,30,0.55)';
    g.fillRect(0, 0, 1024, 3); g.fillRect(0, 0, 3, 1024);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(60 / 4, 60 / 4);
    tex.anisotropy = this.r.capabilities.getMaxAnisotropy();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.02 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'boden';
    this.floor = floor;
    this.scene.add(floor);

    // Prüffeld 10 × 10 m
    const fc = document.createElement('canvas');
    fc.width = fc.height = 512;
    const f = fc.getContext('2d');
    f.fillStyle = '#b4b8bc'; f.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      f.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      f.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 10, 2 + Math.random() * 10);
    }
    for (let i = 0; i <= 10; i++) {
      const p = Math.round(i * 51.2);
      f.fillStyle = i % 10 === 0 ? 'rgba(40,46,54,0.38)' : i === 5 ? 'rgba(40,46,54,0.18)' : 'rgba(40,46,54,0.1)';
      const w = i % 10 === 0 ? 3 : 1.5;
      f.fillRect(p - w / 2, 0, w, 512);
      f.fillRect(0, p - w / 2, 512, w);
    }
    const ft = new THREE.CanvasTexture(fc);
    ft.colorSpace = THREE.SRGBColorSpace;
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(10, 10);
    ft.anisotropy = this.r.capabilities.getMaxAnisotropy();
    const field = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.62, metalness: 0.02 }));
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0.0006;
    field.receiveShadow = true;
    this.scene.add(field);
    // Gehwegmarkierung rund um das Prüffeld
    const lane = new THREE.Group();
    const yellow = Mat.plain('#d9a514', 0.7);
    for (const [x, z, w, d] of [[0, 5.15, 10.6, 0.1], [0, -5.15, 10.6, 0.1], [5.15, 0, 0.1, 10.6], [-5.15, 0, 0.1, 10.6], [0, 6.35, 10.6, 0.1], [0, -6.35, 10.6, 0.1], [6.35, 0, 0.1, 12.8], [-6.35, 0, 0.1, 12.8]]) {
      const m = new THREE.Mesh(Geo.box(w, 0.002, d, 0), yellow);
      m.position.set(x, 0.001, z);
      m.receiveShadow = true;
      lane.add(m);
    }
    this.scene.add(lane);
    // Achsenkreuz am Ursprung (x rot, z blau), dezent
    const ax = new THREE.Group();
    const bar = (len, color, rotY) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.01), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rotY;
      m.position.y = 0.0015;
      return m;
    };
    const xb = bar(0.5, '#e5484d', 0); xb.position.x = -0.25; ax.add(xb);
    const zb = bar(0.5, '#4c8dff', Math.PI / 2); zb.position.z = 0.25; ax.add(zb);
    this.axes = ax;
    this.scene.add(ax);
  }

  // Halle: Wände, Stützen, Dachbinder, Strahler, Tor, Regale (alles statisch, zusammengefasst)
  addHall() {
    const hall = new THREE.Group();
    const X = HALL.x, Z = HALL.z, H = HALL.h;
    // Trapezblech
    const wc = document.createElement('canvas');
    wc.width = 256; wc.height = 64;
    const w = wc.getContext('2d');
    for (let x = 0; x < 256; x++) { const v = 150 + 30 * Math.sin((x / 256) * Math.PI * 2 * 8); w.fillStyle = `rgb(${v - 8},${v},${v + 8})`; w.fillRect(x, 0, 1, 64); }
    const wt = new THREE.CanvasTexture(wc);
    wt.colorSpace = THREE.SRGBColorSpace;
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    const wallMat = (len) => { const t = wt.clone(); t.repeat.set(len / 2, 1); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.35, color: '#c3c9cf' }); };
    for (const [x, z, len, rot] of [[0, -Z, 2 * X, 0], [0, Z, 2 * X, Math.PI], [-X, 0, 2 * Z, Math.PI / 2], [X, 0, 2 * Z, -Math.PI / 2]]) {
      const m = new THREE.Mesh(Geo.plane(len, H), wallMat(len));
      m.position.set(x, H / 2, z);
      m.rotation.y = rot;
      m.receiveShadow = true;
      hall.add(m);
      const sock = new THREE.Mesh(Geo.box(len, 1.0, 0.2, 0), Mat.plain('#8d9196', 0.9));
      sock.position.set(x, 0.5, z);
      sock.rotation.y = rot;
      hall.add(sock);
      const win = new THREE.Mesh(Geo.plane(len * 0.9, 0.9), new THREE.MeshBasicMaterial({ color: '#c7d6e4' }));
      win.position.set(x * 0.999, H - 1.4, z * 0.999);
      win.rotation.y = rot;
      hall.add(win);
      this.windows = this.windows || [];
      this.windows.push(win);
    }
    // Dach
    const roof = new THREE.Mesh(Geo.plane(2 * X, 2 * Z), Mat.plain('#5b6066', 0.8, 0.3));
    roof.rotation.x = Math.PI / 2;
    roof.position.y = H;
    hall.add(roof);
    // Stützen (HEB-Profil) mit Anfahrschutz
    const steel = Mat.paint('#4a5a6a');
    const guard = new THREE.MeshStandardMaterial({ map: stripeTexture('#e2a312', '#17191c', 4), roughness: 0.6 });
    const colX = [-12, -4, 4, 12], colZ = [-12, 12];
    this.columns = [];
    for (const cx of colX) for (const cz of colZ) {
      const col = new THREE.Group();
      col.add(mesh(Geo.box(0.3, H, 0.02, 0), steel, 0, H / 2, -0.14));
      col.add(mesh(Geo.box(0.3, H, 0.02, 0), steel, 0, H / 2, 0.14));
      col.add(mesh(Geo.box(0.02, H, 0.28, 0), steel, 0, H / 2, 0));
      const gm = new THREE.Mesh(Geo.box(0.5, 1.0, 0.5, 0.02), guard);
      gm.position.y = 0.5;
      col.add(gm);
      col.position.set(cx, 0, cz);
      hall.add(col);
      this.columns.push([cx, cz]);
    }
    // Dachbinder und Hallenstrahler
    this.lamps = [];
    const lampMat = Mat.glow('#fff4e0', 2.2);
    this.lampMat = lampMat;
    for (const lx of [-12, -4, 4, 12]) {
      const truss = mesh(Geo.box(0.25, 0.6, 2 * Z, 0), Mat.plain('#59636d', 0.6, 0.6), lx, H - 0.6, 0);
      hall.add(truss);
      for (const lz of [-9, -3, 3, 9]) {
        const housing = mesh(Geo.cyl(0.22, 0.32, 0.25, 20), Mat.plain('#2d3237', 0.5, 0.5), lx, H - 1.2, lz);
        hall.add(housing);
        const disk = new THREE.Mesh(Geo.cyl(0.29, 0.29, 0.01, 20), lampMat);
        disk.position.set(lx, H - 1.33, lz);
        hall.add(disk);
      }
    }
    // Sektionaltor in der Rückwand
    const door = new THREE.Group();
    for (let i = 0; i < 8; i++) door.add(mesh(Geo.box(4, 0.5, 0.06, 0.01), Mat.plain('#d6d9dc', 0.5, 0.2), 0, 0.27 + i * 0.52, 0));
    door.add(mesh(Geo.box(4.4, 0.12, 0.1, 0), new THREE.MeshStandardMaterial({ map: stripeTexture('#e2a312', '#17191c', 10), roughness: 0.6 }), 0, 4.3, 0));
    for (const s of [-1, 1]) door.add(mesh(Geo.box(0.12, 4.3, 0.1, 0), new THREE.MeshStandardMaterial({ map: stripeTexture('#e2a312', '#17191c', 3), roughness: 0.6 }), s * 2.14, 2.15, 0));
    door.position.set(-6, 0, -Z + 0.08);
    hall.add(door);
    const sign = new THREE.Mesh(Geo.plane(3.2, 0.5), new THREE.MeshBasicMaterial({ map: labelTexture('TESTHALLE 2 · ROBOTIK', { w: 1024, h: 160, bg: '#14171a', color: '#e6e8eb', size: 84 }) }));
    sign.position.set(4, 5.2, -Z + 0.06);
    hall.add(sign);
    // Palettenregale an der Rückwand
    const blue = Mat.paint('#2c5aa0'), orange = Mat.paint('#e2601a');
    const boxes = [Mat.plain('#b88a55', 0.85), Mat.plain('#c2c7cc', 0.4, 0.1), Mat.plain('#a3794a', 0.85)];
    for (let k = 0; k < 4; k++) {
      const rx = 3 + k * 2.9, rz = -Z + 1.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) hall.add(mesh(Geo.box(0.08, 4.2, 0.08, 0), blue, rx + sx * 1.35, 2.1, rz + sz * 0.5));
      for (let lv = 0; lv < 3; lv++) {
        const y = 0.3 + lv * 1.4;
        for (const sz of [-1, 1]) hall.add(mesh(Geo.box(2.8, 0.12, 0.06, 0), orange, rx, y, rz + sz * 0.5));
        for (let b = 0; b < 3; b++) hall.add(mesh(Geo.box(0.8, 0.9, 0.9, 0.01), boxes[(k + lv + b) % 3], rx - 0.9 + b * 0.9, y + 0.51, rz));
      }
    }
    // Lose Ausstattung: Gitterboxen, Paletten, KLT-Stapel
    const crate = Mat.plain('#7b858f', 0.5, 0.8);
    for (const [x, z] of [[-13, -6], [-13, -4.7], [-11.8, -6], [13, 7], [13, 5.8]]) hall.add(mesh(Geo.box(1.1, 0.9, 0.9, 0.02), crate, x, 0.45, z));
    for (const [x, z] of [[-13, 4], [-13, 5.4], [12.5, -5]]) {
      hall.add(mesh(Geo.box(1.2, 0.14, 0.8, 0.005), Mat.plain('#c9a273', 0.85), x, 0.07, z));
      hall.add(mesh(Geo.box(1.1, 0.7, 0.75, 0.02), boxes[0], x, 0.5, z));
    }
    for (const [x, z, n] of [[9, 9.5, 4], [9.7, 9.5, 3], [-9, 10, 5]]) for (let i = 0; i < n; i++) hall.add(mesh(Geo.box(0.6, 0.22, 0.4, 0.02), Mat.plain(i % 2 ? '#2c5aa0' : '#4a5058', 0.65), x, 0.11 + i * 0.225, z));
    // Schaltschrank
    hall.add(mesh(Geo.box(1.2, 2.0, 0.5, 0.01), Mat.plain('#b9bec3', 0.5, 0.3), 9, 1.0, -Z + 0.4));
    hall.add(mesh(Geo.box(0.12, 0.12, 0.02, 0.005), Mat.glow('#3fd07a', 1.4), 8.7, 1.6, -Z + 0.66));
    hall.add(mesh(Geo.box(0.12, 0.12, 0.02, 0.005), Mat.glow('#ffb21a', 1.4), 8.9, 1.6, -Z + 0.66));
    hall.traverse((o) => { if (o.isMesh) { o.receiveShadow = o.receiveShadow || false; o.castShadow = false; } });
    optimizeGroup(hall);
    this.hall = hall;
    this.scene.add(hall);
  }

  // Beleuchtung und Nebel einstellen (env.light 0…1, env.fog 0…1)
  setEnvironment(env) {
    this.env = env;
    const L = Math.max(0.02, env.light ?? 1);
    const b = this.base;
    this.hemi.intensity = b.hemi * L;
    this.key.intensity = b.key * L;
    this.fill.intensity = b.fill * L;
    this.scene.environmentIntensity = b.envI * Math.max(0.05, L);
    this.lampMat.emissiveIntensity = L > 0.5 ? 2.2 : L > 0.15 ? 0.6 : 0.0;
    for (const w of this.windows || []) w.material.color.set(L > 0.5 ? '#c7d6e4' : L > 0.15 ? '#46505a' : '#0c0f12');
    const fog = env.fog || 0;
    if (fog > 0) {
      const vis = 1.2 + 14 * (1 - fog) * (1 - fog);
      const fc = new THREE.Color('#8c9298').multiplyScalar(Math.max(0.15, L));
      this.scene.fog.color.copy(fc);
      this.scene.fog.near = 0.2;
      this.scene.fog.far = vis * 1.6;
      this.scene.background.copy(fc);
    } else {
      const bgc = this.bg.clone().multiplyScalar(Math.max(0.25, L));
      this.scene.fog.color.copy(bgc);
      this.scene.fog.near = 14;
      this.scene.fog.far = 46;
      this.scene.background.copy(bgc);
    }
  }

  focusShadow(x, z) {
    this.key.position.set(x + 2.5, 7, z + 3);
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
    if (this.beforeRender) this.beforeRender();
    this.r.setRenderTarget(null);
    this.r.setScissorTest(false);
    this.r.setViewport(0, 0, this.w, this.h);
    this.r.render(this.scene, this.camera);
  }

  // Weltpunkt → Bildschirmkoordinaten (CSS-Pixel relativ zur Leinwand)
  project(v) {
    const p = (v.isVector3 ? v : new THREE.Vector3(v.x, v.y, v.z)).clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, visible: p.z < 1 && p.z > -1 };
  }
}
