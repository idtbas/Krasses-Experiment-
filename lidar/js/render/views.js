// Ein Canvas, mehrere Ansichten: 3D-Szene, Bildschirm des Feldrechners, Kamera des Smartphones.
// Jede Ansicht folgt einem DOM-Element (Rechteck), gerendert wird per Viewport/Scissor in denselben Kontext.
// Punktwolken im Viewer bekommen Eye-Dome-Lighting (EDL) wie in CloudCompare oder Potree.
import * as THREE from 'three';

const EDL_FS = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float strength;
uniform float radius;
uniform vec3 bgTop;
uniform vec3 bgBottom;
uniform float enabled;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
void main() {
  float d = texture2D(tDepth, vUv).r;
  vec3 bg = mix(bgBottom, bgTop, vUv.y);
  if (d >= 0.99999) { gl_FragColor = vec4(bg, 1.0); return; }
  vec3 col = texture2D(tColor, vUv).rgb;
  if (enabled < 0.5) { gl_FragColor = vec4(col, 1.0); return; }
  float lz = log2(lin(d));
  float s = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.78539816;
    vec2 o = vec2(cos(a), sin(a)) * radius * texel;
    float dn = texture2D(tDepth, vUv + o).r;
    float ln = dn >= 0.99999 ? log2(far) : log2(lin(dn));
    s += max(0.0, lz - ln);
  }
  float shade = exp(-s * 30.0 * strength);
  gl_FragColor = vec4(col * shade, 1.0);
}`;

export class EDLPass {
  constructor() {
    this.rt = null;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() },
        near: { value: 0.05 }, far: { value: 500 }, strength: { value: 1.0 }, radius: { value: 1.4 },
        bgTop: { value: new THREE.Color('#14202e') }, bgBottom: { value: new THREE.Color('#030405') }, enabled: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: EDL_FS, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  ensure(w, h) {
    if (this.rt && this.rt.width === w && this.rt.height === h) return;
    if (this.rt) this.rt.dispose();
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(w, h, { depthTexture: depth, depthBuffer: true, samples: 0 });
    this.rt.texture.minFilter = this.rt.texture.magFilter = THREE.NearestFilter;
  }
  // scene/camera zuerst ins Ziel, dann zusammensetzen in den aktuellen Viewport
  render(r, scene, camera, rect, dpr) {
    const w = Math.max(1, Math.round(rect.w * dpr)), h = Math.max(1, Math.round(rect.h * dpr));
    this.ensure(w, h);
    const keepBg = scene.background;
    scene.background = null;
    r.setRenderTarget(this.rt);
    r.setScissorTest(false);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);
    r.setRenderTarget(null);
    scene.background = keepBg;
    const u = this.mat.uniforms;
    u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture;
    u.texel.value.set(1 / w, 1 / h);
    u.near.value = camera.near; u.far.value = camera.far;
    r.setScissorTest(true);
    r.render(this.qscene, this.qcam);
  }
}

export class Views {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: true, premultipliedAlpha: true });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.r = r;
    this.list = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.W = w; this.H = h;
    this.r.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }
  add(view) { this.list.push(view); return view; }

  rectOf(el) {
    const b = el.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  }

  frame() {
    const r = this.r;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.W, this.H);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    for (const v of this.list) {
      if (!v.enabled || !v.el || !v.el.isConnected) continue;
      const rect = this.rectOf(v.el);
      if (rect.w < 2 || rect.h < 2 || rect.x > this.W || rect.y > this.H || rect.x + rect.w < 0 || rect.y + rect.h < 0) continue;
      if (v.el.offsetParent === null && getComputedStyle(v.el).position !== 'fixed') continue;
      const y = this.H - rect.y - rect.h;
      r.setViewport(rect.x, y, rect.w, rect.h);
      r.setScissor(rect.x, y, rect.w, rect.h);
      r.setScissorTest(true);
      v.camera.aspect = rect.w / rect.h;
      v.camera.updateProjectionMatrix();
      v.rect = rect;
      v.render(r, rect, this.dpr);
    }
    r.setScissorTest(false);
  }
}
