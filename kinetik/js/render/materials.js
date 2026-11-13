// Gemeinsame Materialien und Geometrien (zwischengespeichert, damit nichts doppelt im Speicher liegt)
// sowie Hilfen für industrielle Bauteile: Drehteile, verjüngte Profile, Schläuche, Schilder, Warnstreifen.
import * as THREE from 'three';
import { RoundedBoxGeometry, mergeGeometries } from 'three';

const matCache = new Map();
const geoCache = new Map();

function cached(key, make) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

export const Mat = {
  // Pulverbeschichtung (seidenmatt)
  paint: (color = '#c5c7c4') => cached('paint' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.46, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.5 })),
  shell: (color = '#c5c7c4') => Mat.paint(color),
  accent: (color) => cached('accent' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.35 })),
  graphite: () => cached('graphite', () => new THREE.MeshStandardMaterial({ color: '#2a2e34', roughness: 0.55, metalness: 0.45 })),
  // schwarz eloxiert (Motorgehäuse, Getriebe)
  anodized: () => cached('anod', () => new THREE.MeshStandardMaterial({ color: '#1d2024', roughness: 0.42, metalness: 0.7 })),
  // Aluguss, gestrahlt
  cast: () => cached('cast', () => new THREE.MeshStandardMaterial({ color: '#9ea4aa', roughness: 0.6, metalness: 0.8 })),
  joint: () => cached('joint', () => new THREE.MeshStandardMaterial({ color: '#34393f', roughness: 0.4, metalness: 0.75 })),
  steel: () => cached('steel', () => new THREE.MeshStandardMaterial({ color: '#c3c8ce', roughness: 0.3, metalness: 1.0 })),
  alu: () => cached('alu', () => new THREE.MeshStandardMaterial({ color: '#cfd4d9', roughness: 0.4, metalness: 0.9 })),
  rubber: () => cached('rubber', () => new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.9, metalness: 0.0 })),
  cable: () => cached('cable', () => new THREE.MeshStandardMaterial({ color: '#121417', roughness: 0.7, metalness: 0.1 })),
  visor: () => cached('visor', () => new THREE.MeshPhysicalMaterial({ color: '#07090c', roughness: 0.08, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 })),
  lens: () => cached('lens', () => new THREE.MeshPhysicalMaterial({ color: '#0a1220', roughness: 0.05, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.02 })),
  glass: (color = '#1a1f26', opacity = 0.75) => cached('glass' + color + opacity, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, metalness: 0.2, transparent: true, opacity, clearcoat: 1 })),
  glow: (color, k = 2.4) => cached('glow' + color + k, () => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: k, roughness: 0.4 })),
  plain: (color, rough = 0.6, metal = 0) => cached(`plain${color}${rough}${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })),
  wood: (color = '#c9a273') => cached('wood' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, map: woodTexture() })),
  foam: (color) => cached('foam' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })),
  cubeMetal: (color) => cached('cubeMetal' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.85 })),
  cubePlastic: (color) => cached('cubePl' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0, clearcoat: 0.25 })),
  line: (color, opacity = 1) => cached(`line${color}${opacity}`, () => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })),
  hazard: () => cached('hazard', () => new THREE.MeshStandardMaterial({ map: stripeTexture('#e2a312', '#17191c'), roughness: 0.55, metalness: 0.05 })),
  hazardRed: () => cached('hazardR', () => new THREE.MeshStandardMaterial({ map: stripeTexture('#c9312b', '#eeeeee'), roughness: 0.55 })),
  // Typenschild bzw. Beschriftung
  label: (text, opts = {}) => cached('label' + text + JSON.stringify(opts), () => new THREE.MeshStandardMaterial({ map: labelTexture(text, opts), roughness: 0.5, metalness: 0.1, transparent: !!opts.transparent })),
};

let woodTex = null;
function woodTexture() {
  if (woodTex) return woodTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 256;
    g.strokeStyle = `rgba(110,70,30,${0.05 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3);
    g.stroke();
  }
  woodTex = new THREE.CanvasTexture(c);
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  return woodTex;
}

const stripeCache = new Map();
export function stripeTexture(a, b, n = 6) {
  const key = a + b + n;
  if (stripeCache.has(key)) return stripeCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  g.fillStyle = b;
  const w = 128 / n;
  for (let i = -n; i < n * 2; i += 2) {
    g.beginPath();
    g.moveTo(i * w, 0); g.lineTo(i * w + w, 0); g.lineTo(i * w + w + 128, 128); g.lineTo(i * w + 128, 128);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  stripeCache.set(key, t);
  return t;
}

export function labelTexture(text, o = {}) {
  const c = document.createElement('canvas');
  const W = o.w || 256, H = o.h || 64;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!o.transparent) { g.fillStyle = o.bg || '#1b1e22'; g.fillRect(0, 0, W, H); }
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4); }
  g.fillStyle = o.color || '#e6e8eb';
  g.font = `${o.weight || 700} ${o.size || Math.round(H * 0.58)}px ${o.font || '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = H / lines.length;
  lines.forEach((l, i) => g.fillText(l, o.align === 'left' ? 10 : W / 2, lh * (i + 0.5) + (o.dy || 0)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const Geo = {
  box: (w, h, d, r = 0) => {
    const key = `b${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)},${r.toFixed(4)}`;
    let g = geoCache.get(key);
    if (!g) {
      const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
      g = rr > 0.0005 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d);
      geoCache.set(key, g);
    }
    return g;
  },
  cyl: (rTop, rBot, h, seg = 32) => {
    const key = `c${rTop},${rBot},${h},${seg}`;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.CylinderGeometry(rTop, rBot, h, seg); geoCache.set(key, g); }
    return g;
  },
  sphere: (r, seg = 32) => {
    const key = `s${r},${seg}`;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)); geoCache.set(key, g); }
    return g;
  },
  capsule: (r, len, seg = 16) => {
    const key = `cap${r},${len}`;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.CapsuleGeometry(r, len, 6, seg); geoCache.set(key, g); }
    return g;
  },
  torus: (r, t, seg = 48) => {
    const key = `t${r},${t}`;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.TorusGeometry(r, t, 12, seg); geoCache.set(key, g); }
    return g;
  },
  // Drehteil aus einem Profil [[r, y], …] (von unten nach oben)
  lathe: (profile, seg = 48) => {
    const key = 'l' + JSON.stringify(profile) + seg;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); geoCache.set(key, g); }
    return g;
  },
  // Zylinder mit gefasten Kanten (liegt entlang y)
  chamferCyl: (r, h, c = 0.004, seg = 40) => Geo.lathe([[0, -h / 2], [r - c, -h / 2], [r, -h / 2 + c], [r, h / 2 - c], [r - c, h / 2], [0, h / 2]], seg),
  // verjüngter Kasten entlang y (unten w0×d0, oben w1×d1), Kanten gerundet
  taper: (w0, d0, w1, d1, len, r = 0.01) => {
    const key = `tp${w0},${d0},${w1},${d1},${len},${r}`;
    let g = geoCache.get(key);
    if (!g) {
      g = new RoundedBoxGeometry(w0, len, d0, 3, Math.min(r, w0 / 2 - 1e-4, d0 / 2 - 1e-4));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = (p.getY(i) + len / 2) / len;
        p.setX(i, p.getX(i) * (1 + (w1 / w0 - 1) * t));
        p.setZ(i, p.getZ(i) * (1 + (d1 / d0 - 1) * t));
      }
      g.computeVertexNormals();
      geoCache.set(key, g);
    }
    return g;
  },
  // Schlauch/Kabel entlang Punkten
  tube: (pts, r = 0.008, seg = 32) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, seg, r, 10, false);
  },
  // Wellrohr (Kabelschutz) entlang Punkten
  conduit: (pts, r = 0.011, seg = 48) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, r, 10, false);
    const n = g.attributes.normal, p = g.attributes.position;
    const rings = seg + 1, rad = 11;
    for (let i = 0; i < rings; i++) {
      const k = 1 + 0.12 * Math.cos(i * Math.PI * 1.2);
      for (let j = 0; j < rad; j++) {
        const idx = i * rad + j;
        const c = curve.getPointAt(i / seg);
        p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * k, c.y + (p.getY(idx) - c.y) * k, c.z + (p.getZ(idx) - c.z) * k);
      }
    }
    void n;
    g.computeVertexNormals();
    return g;
  },
  plane: (w, h) => {
    const key = `p${w},${h}`;
    let g = geoCache.get(key);
    if (!g) { g = new THREE.PlaneGeometry(w, h); geoCache.set(key, g); }
    return g;
  },
};

// Hilfsfunktion: Mesh mit Schatten
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Schraubenkreis (Zylinderkopfschrauben) als ein Mesh; Achse entlang y
export function boltCircle(radius, n, boltR = 0.005, h = 0.004, mat = Mat.steel()) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.CylinderGeometry(boltR, boltR, h, 8);
    g.translate(Math.cos(a) * radius, h / 2, Math.sin(a) * radius);
    geos.push(g);
  }
  const m = mesh(mergeGeometries(geos), mat);
  m.castShadow = false;
  return m;
}

// Kühlrippen um einen Motor (Achse y)
export function fins(r, h, n = 6, depth = 0.004, mat = Mat.anodized()) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.CylinderGeometry(r + depth, r + depth, h / (n * 2.2), 28);
    g.translate(0, -h / 2 + (i + 0.5) * (h / n), 0);
    geos.push(g);
  }
  return mesh(mergeGeometries(geos), mat);
}

// Flaches Schild (Ebene) mit Textur; zeigt nach +z
export function plate(text, w, h, opts = {}) {
  const m = new THREE.Mesh(Geo.plane(w, h), Mat.label(text, { w: Math.round(256 * Math.max(1, w / h / 4)), h: 64, ...opts }));
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/*
 * Statische Meshes einer Gruppe nach Material zusammenfassen (weniger Draw-Calls).
 * Meshes mit userData.keep bleiben einzeln (z. B. LEDs oder drehende Teile).
 */
export function optimizeGroup(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || o === group || o.userData.keep || o.isInstancedMesh || o.material.transparent) return;
    let p = o.parent, keep = false;
    while (p && p !== group) { if (p.userData.keep) { keep = true; break; } p = p.parent; }
    if (keep) return;
    const g = o.geometry;
    if (!g.attributes.position || !g.attributes.normal) return;
    const key = o.material.uuid + (g.index ? 'i' : 'n') + (g.attributes.uv ? 'u' : '') + (o.castShadow ? 's' : '');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, list: [], shadow: o.castShadow });
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    buckets.get(key).list.push({ g, mtx, o });
  });
  for (const b of buckets.values()) {
    if (b.list.length < 2) continue;
    const geos = [];
    for (const { g, mtx } of b.list) {
      let c = g.clone();
      for (const name of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(name)) c.deleteAttribute(name);
      if (!c.attributes.uv) continue;
      c.applyMatrix4(mtx);
      geos.push(c);
    }
    if (geos.length < 2) continue;
    let merged = null;
    try { merged = mergeGeometries(geos); } catch { merged = null; }
    if (!merged) continue;
    for (const { o } of b.list) if (o.geometry.attributes.uv) remove.push(o);
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.shadow;
    m.receiveShadow = true;
    group.add(m);
  }
  for (const o of remove) o.removeFromParent();
}

export { mergeGeometries };
