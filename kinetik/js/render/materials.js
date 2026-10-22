// Gemeinsame Materialien und Geometrien (zwischengespeichert, damit nichts doppelt im Speicher liegt)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three';

const matCache = new Map();
const geoCache = new Map();

function cached(key, make) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

export const Mat = {
  shell: (color = '#f2f3f5') => cached('shell' + color, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.22,
  })),
  accent: (color) => cached('accent' + color, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.28, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15,
  })),
  graphite: () => cached('graphite', () => new THREE.MeshStandardMaterial({ color: '#2b2f37', roughness: 0.42, metalness: 0.55 })),
  joint: () => cached('joint', () => new THREE.MeshStandardMaterial({ color: '#3a3f49', roughness: 0.35, metalness: 0.75 })),
  steel: () => cached('steel', () => new THREE.MeshStandardMaterial({ color: '#c6ccd4', roughness: 0.28, metalness: 1.0 })),
  alu: () => cached('alu', () => new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.38, metalness: 0.9 })),
  rubber: () => cached('rubber', () => new THREE.MeshStandardMaterial({ color: '#1c1e23', roughness: 0.92, metalness: 0.0 })),
  visor: () => cached('visor', () => new THREE.MeshPhysicalMaterial({ color: '#0a0d13', roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 })),
  glow: (color) => cached('glow' + color, () => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: 2.4, roughness: 0.4 })),
  plain: (color, rough = 0.6, metal = 0) => cached(`plain${color}${rough}${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })),
  wood: (color = '#c9a273') => cached('wood' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, map: woodTexture() })),
  foam: (color) => cached('foam' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })),
  cubeMetal: (color) => cached('cubeMetal' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.85 })),
  cubePlastic: (color) => cached('cubePl' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0, clearcoat: 0.4 })),
  line: (color, opacity = 1) => cached(`line${color}${opacity}`, () => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })),
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
};

// Hilfsfunktion: Mesh mit Schatten
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
