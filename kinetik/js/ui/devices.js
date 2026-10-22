// Gerätemonitor: Live-Ansichten aller verbauten Geräte des gewählten Roboters –
// Kamera (RGB), Tiefenkarte, Wärmebild, LiDAR (Draufsicht und Punktwolke), Radar (PPI),
// Abstand, Farbe, Kraft, Codes, Funkstrecken und Antriebe (Last, Temperatur).
import * as THREE from 'three';
import { h, clear, fmtNum, clamp } from '../core/util.js';
import { icon } from '../core/icons.js';
import { MODULES, RADIOS, ANTENNAS, DRIVES } from '../robots/parts.js';
import { COLORS } from '../lang/commands.js';
import { turbo, LIDAR_LAYER, visibility } from '../robots/sensors.js';

const FEED_W = 320, FEED_H = 200;

// Eisenglut-Palette für das Wärmebild
function ironbow(t, out = new THREE.Color()) {
  t = clamp(t, 0, 1);
  const stops = [[0, [0.02, 0.02, 0.08]], [0.2, [0.25, 0.02, 0.45]], [0.42, [0.72, 0.08, 0.42]], [0.6, [0.95, 0.35, 0.1]], [0.8, [1, 0.72, 0.08]], [1, [1, 1, 0.85]]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i], [b, cb] = stops[i + 1];
    if (t <= b) { const k = (t - a) / (b - a); return out.setRGB(ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k); }
  }
  return out.setRGB(1, 1, 0.85);
}

const thermalCache = new Map();
function thermalMaterial(bucket) {
  let m = thermalCache.get(bucket);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 col; varying vec3 vN; void main(){ float k = 0.72 + 0.28 * abs(vN.z); gl_FragColor = vec4(col * k, 1.0); }',
    });
    thermalCache.set(bucket, m);
  }
  return m;
}

const depthMat = new THREE.ShaderMaterial({
  uniforms: { range: { value: 6 } },
  vertexShader: 'varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform float range; varying float vD;
    vec3 turbo(float t){ t = clamp(t,0.0,1.0); return vec3(
      clamp(0.1357 + t*(4.5974 - t*(42.3277 - t*(130.5887 - t*(150.5666 - t*58.1375)))),0.0,1.0),
      clamp(0.0914 + t*(2.1856 + t*(4.8052 - t*(14.0195 - t*(4.2109 + t*2.7747)))),0.0,1.0),
      clamp(0.1067 + t*(12.5925 - t*(60.1097 - t*(109.0745 - t*(88.5066 - t*26.8183)))),0.0,1.0)); }
    void main(){ float t = 1.0 - clamp((vD - 0.15) / range, 0.0, 1.0); gl_FragColor = vD > range ? vec4(0.03,0.03,0.05,1.0) : vec4(turbo(t*0.92+0.04), 1.0); }`,
});

export class DeviceMonitor {
  constructor(app) {
    this.app = app;
    this.el = h('div.pane.scroll.devmon');
    this.tiles = [];
    this.cam = new THREE.PerspectiveCamera(60, FEED_W / FEED_H, 0.02, 40);
    this.t = 0;
    this.visible = false;
    this.pip = null;
    this.robotKey = null;
    this.frameNo = 0;
    app.renderer.beforeRender = () => this.renderFeeds();
  }

  /* ---------------- Aufbau ---------------- */

  render() {
    const r = this.app.currentRobot();
    clear(this.el);
    this.tiles = [];
    this.robotKey = r ? r.defId + ':' + r.index : null;
    if (!r) { this.el.appendChild(h('p.muted', 'Kein Roboter ausgewählt.')); return; }
    this.el.appendChild(h('div.devhead', h('span', { html: icon(r.type) }), h('b', r.name), h('span.muted', 'Gerätemonitor · live'), h('div', { style: { flex: 1 } }),
      h('span.chip.mono', `Rechenlast ${Math.round(100 / Math.max(0.01, r.computeScale || 1))} %`)));
    const grid = h('div.devgrid');
    this.el.appendChild(grid);
    const add = (kind, title, sub, opts = {}) => {
      const canvas = h('canvas', { width: FEED_W * (opts.scale || 1), height: FEED_H * (opts.scale || 1) });
      const info = h('div.devinfo');
      const pin = h('button.btn.icon.small.ghost', { html: icon('pip'), title: 'In der 3D-Ansicht einblenden' });
      const tile = h('div.devtile' + (opts.wide ? '.wide' : ''), h('div.devtitle', h('b', title), h('span', sub), h('div', { style: { flex: 1 } }), h('i.dot'), pin), opts.noCanvas ? null : h('div.devscreen', canvas), info);
      const t = { kind, title, sub, canvas, ctx: canvas.getContext('2d'), info, el: tile, opts, last: 0 };
      pin.addEventListener('click', () => this.setPip(this.pip && this.pip.kind === kind ? null : t));
      tile.addEventListener('dblclick', () => tile.classList.toggle('wide'));
      grid.appendChild(tile);
      this.tiles.push(t);
      return t;
    };
    const s = r.sensors;
    const mod = (key) => r.config.module.find((m) => MODULES[m].key === key);
    if (s.kamera) {
      const id = mod('kamera');
      add('rgb', MODULES[id].name, MODULES[id].model);
      if (s.kamera.depth) add('depth', 'Tiefenkarte', 'RGB-D · 0,15–6 m');
    }
    if (s.waerme) add('thermal', MODULES.waermebild.name, MODULES.waermebild.model);
    if (s.lidar) {
      const id = mod('lidar');
      add('lidar', MODULES[id].name, MODULES[id].model + ' · Draufsicht');
      add('cloud', 'Punktwolke', MODULES[id].kind === '3d' || id === 'lidar3d' ? '16 Kanäle · 3D' : 'Scanebene · 3D');
    }
    if (s.radar) add('radar', MODULES.radar.name, MODULES.radar.model + ' · PPI');
    if (s.abstand) add('dist', MODULES[mod('abstand')].name, MODULES[mod('abstand')].model, { short: true });
    if (s.farbe) add('color', MODULES.farbsensor.name, MODULES.farbsensor.model, { short: true });
    if (s.kraft) add('force', MODULES.kraftmoment.name, MODULES.kraftmoment.model, { short: true });
    if (s.rfid || s.barcode) add('codes', 'Identifikation', [s.rfid ? 'RFID' : null, s.barcode ? 'Code-Scanner' : null].filter(Boolean).join(' · '), { short: true });
    add('drives', 'Antriebe', Object.values(r.drives).map((d) => d.name).filter((v, i, a) => a.indexOf(v) === i).join(' · '), { wide: true, noCanvas: true });
    if (r.radio.tech) add('radio', 'Funk', `${RADIOS[r.config.funk].name} · ${ANTENNAS[r.config.antenne].name}`, { wide: true, noCanvas: true });
    for (const t of this.tiles) if (t.opts.short) { t.canvas.height = 90 * (t.opts.scale || 1); }
    if (this.pip) { const same = this.tiles.find((t) => t.kind === this.pip.kind); this.setPip(same || null); }
  }

  show() { this.visible = true; this.render(); }
  hide() { this.visible = false; }

  setPip(tile) {
    const app = this.app;
    if (this.pipEl) { this.pipEl.remove(); this.pipEl = null; }
    this.pip = tile ? { kind: tile.kind, tile } : null;
    if (!tile) return;
    const canvas = h('canvas', { width: FEED_W, height: tile.opts.short ? 90 : FEED_H });
    const close = h('button.btn.icon.small.ghost', { html: icon('x'), title: 'Schließen' });
    close.addEventListener('click', () => this.setPip(null));
    this.pipEl = h('div#pip.ov', h('div.devtitle', h('b', tile.title), h('span', tile.sub), h('div', { style: { flex: 1 } }), close), canvas);
    this.pip.canvas = canvas;
    app.viewEl.appendChild(this.pipEl);
  }

  /* ---------------- Aktualisierung ---------------- */

  active() { return (this.visible && this.app.tab === 'devices' && this.app.screen === 'bench') || (this.pip && this.app.screen === 'bench'); }

  // Läuft vor jedem Bild: Kamerabilder mit der Hauptleinwand rendern und herauskopieren
  renderFeeds() {
    if (!this.active()) return;
    const r = this.app.currentRobot();
    if (!r) return;
    if ((r.defId + ':' + r.index) !== this.robotKey && this.visible && this.app.tab === 'devices') this.render();
    const now = performance.now();
    this.frameNo++;
    const list = this.visible && this.app.tab === 'devices' ? this.tiles : this.pip ? [this.pip.tile] : [];
    let renders = 0;
    for (const t of list) {
      const camKind = t.kind === 'rgb' || t.kind === 'depth' || t.kind === 'thermal' || t.kind === 'cloud';
      const hz = camKind ? 10 : t.kind === 'drives' || t.kind === 'radio' ? 4 : 15;
      if (now - t.last < 1000 / hz) continue;
      if (camKind && renders >= 2) continue;
      t.last = now;
      try {
        if (camKind) { this.renderCamera(r, t); renders++; }
        else this.draw2d(r, t);
      } catch (e) { console.warn(e); }
      if (this.pip && this.pip.tile === t) this.pip.canvas.getContext('2d').drawImage(t.canvas, 0, 0, this.pip.canvas.width, this.pip.canvas.height);
    }
  }

  poseCamera(r, kind) {
    const cam = this.cam;
    let src = null, fov = 60, far = 40;
    if (kind === 'thermal') { src = r.sensors.waerme; fov = src.feedFov || 44; far = 30; }
    else if (kind === 'cloud') {
      const b = r.baseBody();
      const p = b.translation();
      const f = r.frame();
      const back = r.type === 'arm' ? 1.6 : 1.4;
      cam.position.set(p.x - Math.sin(f.yaw) * back, p.y + (r.type === 'arm' ? 1.3 : 1.0), p.z - Math.cos(f.yaw) * back);
      cam.up.set(0, 1, 0);
      cam.lookAt(p.x + Math.sin(f.yaw) * 1.2, p.y, p.z + Math.cos(f.yaw) * 1.2);
      cam.fov = 64; cam.far = 40; cam.updateProjectionMatrix();
      return cam;
    } else { src = r.sensors.kamera; fov = src.feedFov || 62; far = kind === 'depth' ? 8 : 40; }
    const { o, d, q } = src.pose();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    if (Math.abs(up.dot(new THREE.Vector3(d.x, d.y, d.z))) > 0.95) up.set(0, 0, 1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    cam.position.set(o.x, o.y, o.z);
    cam.up.copy(up);
    cam.lookAt(o.x + d.x, o.y + d.y, o.z + d.z);
    cam.fov = fov; cam.far = far; cam.near = 0.02;
    cam.updateProjectionMatrix();
    return cam;
  }

  renderCamera(robot, t) {
    const R = this.app.renderer;
    const gl = R.r;
    const scene = R.scene;
    const cam = this.poseCamera(robot, t.kind);
    const w = Math.min(FEED_W, R.w), hgt = Math.min(FEED_H, R.h);
    if (w < 40 || hgt < 40) return;
    cam.aspect = w / hgt;
    cam.updateProjectionMatrix();
    const helpersVis = R.helpers.visible;
    const prevBg = scene.background, prevFog = scene.fog, prevOverride = scene.overrideMaterial;
    const swapped = [];
    R.helpers.visible = t.kind === 'cloud';
    gl.shadowMap.autoUpdate = false;
    if (t.kind === 'depth') {
      scene.overrideMaterial = depthMat;
      scene.background = new THREE.Color('#06070a');
      scene.fog = null;
    } else if (t.kind === 'thermal') {
      this.applyThermal(robot, swapped);
      scene.background = new THREE.Color('#05040c');
      scene.fog = null;
    } else if (t.kind === 'cloud') {
      cam.layers.set(LIDAR_LAYER);
      scene.background = new THREE.Color('#05070a');
    }
    gl.setScissorTest(true);
    gl.setScissor(0, 0, w, hgt);
    gl.setViewport(0, 0, w, hgt);
    gl.render(scene, cam);
    const dpr = gl.getPixelRatio();
    const ctx = t.ctx;
    ctx.drawImage(gl.domElement, 0, gl.domElement.height - hgt * dpr, w * dpr, hgt * dpr, 0, 0, t.canvas.width, t.canvas.height);
    // zurücksetzen
    for (const [m, mat] of swapped) m.material = mat;
    cam.layers.set(0);
    scene.background = prevBg; scene.fog = prevFog; scene.overrideMaterial = prevOverride;
    R.helpers.visible = helpersVis;
    gl.setScissorTest(false);
    gl.shadowMap.autoUpdate = true;
    this.overlay(robot, t, cam);
  }

  // Wärmebild: jedes Mesh bekommt die Farbe seiner Temperatur
  applyThermal(robot, swapped) {
    const sim = this.app.sim;
    const amb = sim.ambient();
    let hot = amb + 25;
    for (const e of sim.entities) if (e.temperature) hot = Math.max(hot, e.temperature() + 2);
    this.thermalSpan = [amb - 4, hot];
    const set = (obj, temp) => {
      const b = Math.round(temp * 2) / 2;
      const m = thermalMaterial(b);
      m.uniforms.col.value.copy(ironbow((temp - this.thermalSpan[0]) / (this.thermalSpan[1] - this.thermalSpan[0])));
      obj.traverse((o) => { if (o.isMesh || o.isPoints) { swapped.push([o, o.material]); o.material = m; } });
    };
    const R = this.app.renderer;
    set(R.hall, amb - 1.5);
    set(R.floor, amb - 0.5);
    for (const c of R.scene.children) if (c !== R.world && c !== R.helpers && c !== R.hall && c !== R.floor && !c.isLight) set(c, amb - 0.8);
    for (const e of sim.entities) {
      if (e.isRobot) { for (const p of e.parts.values()) set(p.group, e.partTemp(p)); }
      else set(e.root, e.temperature ? e.temperature() : amb);
    }
  }

  overlay(robot, t, cam) {
    const ctx = t.ctx, W = t.canvas.width, H = t.canvas.height;
    const sim = this.app.sim;
    ctx.save();
    ctx.font = '600 10px ui-monospace, SF Mono, Menlo, monospace';
    ctx.textBaseline = 'top';
    if (t.kind === 'rgb') {
      const s = robot.sensors.kamera;
      const { o } = s.pose();
      const lux = sim.illumination(o);
      // Rauschen bei wenig Licht
      if (lux < 0.5) {
        const n = Math.round((0.5 - lux) * 900);
        for (let i = 0; i < n; i++) { const v = Math.random() * 90; ctx.fillStyle = `rgba(${v},${v},${v},0.5)`; ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
      }
      // Objektdetektion
      for (const d of s.detections()) {
        const e = d.entity;
        const p = e.body.translation();
        const hh = e.halfHeight, gw = e.gripWidth / 2;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, vis = true;
        for (const dx of [-gw, gw]) for (const dy of [-hh, hh]) for (const dz of [-gw, gw]) {
          const v = new THREE.Vector3(p.x + dx, p.y + dy, p.z + dz).project(cam);
          if (v.z > 1) vis = false;
          const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
          x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
        }
        if (!vis || x1 < 0 || y1 < 0 || x0 > W || y0 > H) continue;
        ctx.strokeStyle = '#3fd07a'; ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
        const lab = `${(e.color || '').toUpperCase()} ${fmtNum(d.dist, 2)} m`;
        const tw = ctx.measureText(lab).width + 6;
        ctx.fillStyle = 'rgba(10,30,18,0.85)'; ctx.fillRect(x0 - 2, y0 - 15, tw, 12);
        ctx.fillStyle = '#9ff0c0'; ctx.fillText(lab, x0 + 1, y0 - 14);
      }
      this.stamp(ctx, W, H, `${lux < 0.22 ? 'UNTERBELICHTET · ' : ''}${isFinite(visibility(sim)) ? 'SICHT ' + fmtNum(visibility(sim), 1) + ' m · ' : ''}RGB`);
    } else if (t.kind === 'depth') {
      this.stamp(ctx, W, H, 'TIEFE 0,15–6 m');
      const g = ctx.createLinearGradient(W - 90, 0, W - 10, 0);
      for (let i = 0; i <= 10; i++) { const c = turbo(1 - i / 10); g.addColorStop(i / 10, `rgb(${c[0] * 255},${c[1] * 255},${c[2] * 255})`); }
      ctx.fillStyle = g; ctx.fillRect(W - 90, H - 16, 80, 6);
    } else if (t.kind === 'thermal') {
      const th = robot.sensors.waerme;
      const span = this.thermalSpan || [18, 50];
      const g = ctx.createLinearGradient(0, H - 10, 0, 10);
      for (let i = 0; i <= 10; i++) { const c = ironbow(i / 10); g.addColorStop(i / 10, c.getStyle()); }
      ctx.fillStyle = g; ctx.fillRect(W - 14, 10, 6, H - 20);
      ctx.fillStyle = '#e6e8eb';
      ctx.fillText(`${Math.round(span[1])}°`, W - 40, 8);
      ctx.fillText(`${Math.round(span[0])}°`, W - 40, H - 18);
      const hot = th.hottest();
      if (hot) {
        const v = new THREE.Vector3(hot.pos.x, hot.pos.y, hot.pos.z).project(cam);
        if (v.z < 1) {
          const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(sx - 8, sy); ctx.lineTo(sx + 8, sy); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 8); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillText(`${fmtNum(hot.temp, 1)} °C`, sx + 10, sy - 12);
        }
      }
      this.stamp(ctx, W, H, `MAX ${fmtNum(th.maxTemp(), 1)} °C · LWIR`);
    } else if (t.kind === 'cloud') {
      const l = robot.sensors.lidar;
      this.stamp(ctx, W, H, `${l.steps * l.channels} PKT · ${fmtNum(l.rate * (robot.computeScale || 1), 0)} Hz`);
    }
    ctx.restore();
    this.setInfo(robot, t);
  }

  stamp(ctx, W, H, text) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(text).width + 10;
    ctx.fillRect(6, H - 18, tw, 13);
    ctx.fillStyle = '#d9dde2';
    ctx.fillText(text, 11, H - 17);
    const sec = (this.app.sim.time % 1000).toFixed(1).padStart(6, '0');
    ctx.fillText(`T+${sec}`, 8, 6);
    ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(W - 10, 10, 3, 0, Math.PI * 2); ctx.fill();
  }

  draw2d(robot, t) {
    const ctx = t.ctx, W = t.canvas.width, H = t.canvas.height;
    const s = robot.sensors;
    ctx.save();
    ctx.fillStyle = '#0a0c0f';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '600 10px ui-monospace, SF Mono, Menlo, monospace';
    ctx.textBaseline = 'top';
    if (t.kind === 'lidar') this.drawLidar(robot, ctx, W, H);
    else if (t.kind === 'radar') this.drawRadar(robot, ctx, W, H);
    else if (t.kind === 'dist') {
      const v = s.abstand.value, max = s.abstand.range * 100;
      this.bar(ctx, 14, 40, W - 28, 16, v / max, v < 15 ? '#ff3030' : v < 40 ? '#ffb21a' : '#3fd07a');
      ctx.fillStyle = '#e6e8eb'; ctx.font = '600 22px ui-monospace, SF Mono, Menlo, monospace';
      ctx.fillText(`${fmtNum(v, 1)} cm`, 14, 8);
      ctx.font = '600 10px ui-monospace, SF Mono, Menlo, monospace'; ctx.fillStyle = '#8a929c';
      ctx.fillText(`0`, 14, 62); ctx.fillText(`${max} cm`, W - 50, 62);
    } else if (t.kind === 'color') {
      const smp = s.farbe.sample();
      ctx.fillStyle = COLORS[smp.color] || '#222';
      ctx.fillRect(14, 14, 60, 60);
      ctx.strokeStyle = '#3a4048'; ctx.strokeRect(14, 14, 60, 60);
      ctx.fillStyle = '#e6e8eb'; ctx.font = '600 18px ui-monospace, SF Mono, Menlo, monospace';
      ctx.fillText(smp.color.toUpperCase(), 90, 18);
      ctx.font = '600 11px ui-monospace, SF Mono, Menlo, monospace'; ctx.fillStyle = '#8a929c';
      ctx.fillText(`Remission ${smp.light} %`, 90, 48);
    } else if (t.kind === 'force') {
      const f = s.kraft.read();
      ctx.fillStyle = '#e6e8eb'; ctx.font = '600 22px ui-monospace, SF Mono, Menlo, monospace';
      ctx.fillText(`Fz ${fmtNum(f, 1)} N`, 14, 8);
      this.bar(ctx, 14, 44, W - 28, 14, f / 60, f > 45 ? '#ff3030' : '#4c8dff');
      ctx.font = '600 10px ui-monospace, SF Mono, Menlo, monospace'; ctx.fillStyle = '#8a929c';
      ctx.fillText(`≈ ${fmtNum(f / 9.81, 2)} kg Last`, 14, 66);
    } else if (t.kind === 'codes') {
      ctx.fillStyle = '#8a929c'; ctx.fillText('RFID', 14, 12); ctx.fillText('CODE', 14, 46);
      ctx.fillStyle = '#e6e8eb'; ctx.font = '600 16px ui-monospace, SF Mono, Menlo, monospace';
      ctx.fillText(s.rfid ? s.rfid.read() : '–', 60, 9);
      ctx.fillText(s.barcode ? s.barcode.read() : '–', 60, 43);
    }
    ctx.restore();
    this.setInfo(robot, t);
  }

  bar(ctx, x, y, w, hh, k, color) {
    ctx.fillStyle = '#1a1e23'; ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(k, 0, 1), hh);
    ctx.strokeStyle = '#2c333b'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
  }

  drawLidar(robot, ctx, W, H) {
    const l = robot.sensors.lidar;
    const cx = W / 2, cy = H * (l.hfov < Math.PI * 1.9 ? 0.82 : 0.55);
    const viewR = Math.min(l.range, robot.type === 'arm' ? 2.5 : 4);
    const sc = Math.min(W, H * 1.6) * 0.46 / viewR;
    ctx.strokeStyle = '#1e252d'; ctx.lineWidth = 1;
    ctx.fillStyle = '#5c6670';
    for (let m = 1; m <= viewR; m++) { ctx.beginPath(); ctx.arc(cx, cy, m * sc, 0, Math.PI * 2); ctx.stroke(); ctx.fillText(`${m} m`, cx + m * sc * 0.71 + 2, cy - m * sc * 0.71 - 10); }
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    // Schutzfeld
    if (l.safety) {
      ctx.fillStyle = l.violated ? 'rgba(255,48,48,0.25)' : 'rgba(255,178,26,0.1)';
      ctx.strokeStyle = l.violated ? '#ff3030' : '#ffb21a';
      ctx.beginPath();
      const sec = (l.safety.sector || l.hfov / 2 / (Math.PI / 180)) * Math.PI / 180;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, l.safety.radius * sc, -Math.PI / 2 - sec, -Math.PI / 2 + sec);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const c = [0, 0, 0];
    for (let i = 0; i < l.steps; i++) {
      const r = l.ranges[i];
      if (r >= l.range - 1e-3 || r > viewR) continue;
      const a = l.az(i);
      const x = cx - Math.sin(a) * r * sc, y = cy - Math.cos(a) * r * sc;
      turbo(1 - r / viewR, c);
      ctx.fillStyle = `rgb(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0})`;
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
    }
    ctx.fillStyle = '#e6e8eb';
    ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx - 5, cy + 5); ctx.lineTo(cx + 5, cy + 5); ctx.closePath(); ctx.fill();
    const n = l.nearest();
    ctx.fillText(`MIN ${fmtNum(n.dist * 100, 0)} cm @ ${fmtNum(n.bearing, 0)}°`, 8, 6);
    ctx.fillText(`${l.steps} × ${l.channels} · ${fmtNum(l.rate * (robot.computeScale || 1), 0)} Hz${l.safety ? (l.violated ? ' · FELD VERLETZT' : ' · FELD FREI') : ''}`, 8, H - 16);
  }

  drawRadar(robot, ctx, W, H) {
    const rd = robot.sensors.radar;
    const cx = W / 2, cy = H - 10;
    const viewR = Math.min(rd.range, 8);
    const sc = (H - 22) / viewR;
    const half = rd.fov / 2;
    ctx.fillStyle = '#04100a';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, viewR * sc, -Math.PI / 2 - half, -Math.PI / 2 + half); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#14402a'; ctx.fillStyle = '#2f7a52';
    for (let m = 2; m <= viewR; m += 2) { ctx.beginPath(); ctx.arc(cx, cy, m * sc, -Math.PI / 2 - half, -Math.PI / 2 + half); ctx.stroke(); ctx.fillText(`${m} m`, cx + 3, cy - m * sc + 2); }
    for (const a of [-half, -half / 2, 0, half / 2, half]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * viewR * sc, cy - Math.cos(a) * viewR * sc); ctx.stroke(); }
    // Abtaststrahl
    const sw = Math.sin(performance.now() / 600) * half;
    ctx.strokeStyle = 'rgba(80,255,150,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(sw) * viewR * sc, cy - Math.cos(sw) * viewR * sc); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(60,160,100,0.35)';
    for (const c of rd.clutter) { if (c.dist > viewR) continue; const a = -c.az * Math.PI / 180; ctx.fillRect(cx + Math.sin(a) * c.dist * sc - 1.5, cy - Math.cos(a) * c.dist * sc - 1.5, 3, 3); }
    for (const tg of rd.targets) {
      if (tg.dist > viewR) continue;
      const a = -tg.az * Math.PI / 180;
      const x = cx + Math.sin(a) * tg.dist * sc, y = cy - Math.cos(a) * tg.dist * sc;
      const col = tg.vr < -0.1 ? '#ff6a3a' : tg.vr > 0.1 ? '#4fd1ff' : '#9ff0c0';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(a) * tg.vr * 8, y + Math.cos(a) * tg.vr * 8); ctx.stroke();
      ctx.fillText(`${fmtNum(tg.dist, 1)} m ${tg.vr >= 0 ? '+' : ''}${fmtNum(tg.vr, 1)} m/s`, x + 6, y - 5);
    }
    ctx.fillStyle = '#9ff0c0';
    ctx.fillText(`${rd.targets.length} ZIELE · ${rd.approaching() ? 'ANNÄHERUNG' : 'KEINE ANNÄHERUNG'}`, 8, 6);
  }

  setInfo(robot, t) {
    const rows = [];
    const add = (k, v, cls) => rows.push(h('span', k), h('b' + (cls ? '.' + cls : ''), v));
    if (t.kind === 'drives') {
      const tab = h('table.drv');
      tab.appendChild(h('tr', h('th', 'Achse'), h('th', 'Ist'), h('th', 'Last'), h('th', 'Temp.'), h('th', 'Antrieb')));
      for (const s of robot.servos.values()) {
        if (s.hidden) continue;
        const ld = clamp(s.load, 0, 1);
        const tc = s.temp > 85 ? 'bad' : s.temp > 60 ? 'warn' : '';
        tab.appendChild(h('tr',
          h('td', s.label),
          h('td.mono', s.kind === 'rev' ? fmtNum(s.display, 1) + '°' : fmtNum(s.display, 1) + ' cm'),
          h('td', h('div.mbar', h('i', { style: { width: Math.round(ld * 100) + '%', background: ld > 0.9 ? 'var(--err)' : ld > 0.7 ? 'var(--warn)' : 'var(--ok)' } }))),
          h('td.mono' + (tc ? '.' + tc : ''), fmtNum(s.temp, 1) + ' °C'),
          h('td.muted', (DRIVES[robot.config.antrieb[s.group]] || {}).name || '')));
      }
      clear(t.info); t.info.appendChild(tab);
      const p = robot.power || 0;
      t.info.appendChild(h('div.devkv', h('span', 'Leistung'), h('b', fmtNum(p, 0) + ' W'), h('span', 'Energie'), h('b', isFinite(robot.battery.wh) ? `${Math.round(robot.batteryPct)} % von ${robot.battery.wh} Wh` : 'Netzbetrieb'), h('span', 'Status'), h('b', robot.paused ? 'Sicherer Halt' : robot.status)));
      return;
    }
    if (t.kind === 'radio') {
      const sim = this.app.sim;
      const tab = h('table.drv');
      tab.appendChild(h('tr', h('th', 'Gegenstelle'), h('th', 'Pegel'), h('th', 'Wände'), h('th', 'Latenz'), h('th', 'Status')));
      const others = sim.robots.filter((x) => x !== robot);
      for (const o of others) {
        const l = sim.radio.route(robot, o);
        const q = clamp((l.rssi + 110) / 60, 0, 1);
        tab.appendChild(h('tr', h('td', o.name), h('td', h('div.mbar', h('i', { style: { width: Math.round(q * 100) + '%', background: l.ok ? 'var(--ok)' : 'var(--err)' } })), h('span.mono', ` ${l.rssi > -199 ? fmtNum(l.rssi, 0) + ' dBm' : '–'}`)), h('td.mono', l.walls != null ? String(l.walls) : '–'), h('td.mono', l.latency ? Math.round(l.latency * 1000) + ' ms' : '–'), h('td' + (l.ok ? '' : '.bad'), l.ok ? 'Verbindung' : (l.reason || 'zu schwach'))));
      }
      if (!others.length) tab.appendChild(h('tr', h('td', { colSpan: 5 }, 'Keine weiteren Geräte in der Anlage.')));
      clear(t.info); t.info.appendChild(tab);
      return;
    }
    clear(t.info);
    if (rows.length) t.info.appendChild(h('div.devkv', rows));
  }
}
