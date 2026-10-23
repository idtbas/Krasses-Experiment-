// Materialbibliothek: sichtbares Aussehen (Three.js) und LiDAR-Eigenschaften im Nahinfrarot gehören zusammen.
// Reflektivität r bei 905 nm (r1550 bei 1550 nm), Glanzkeule (spec, specWidth in rad), Transmission (Glas),
// Spiegelgrad, Retro-Verstärkung, Oberflächenschwankung (var/varScale) und Rauheit (m).
// Klassen nach ASPRS-LAS: 1 unklassifiziert, 2 Boden, 3 niedrige / 5 hohe Vegetation, 6 Gebäude, 7 Rauschen, 9 Wasser.
import * as THREE from 'three';

const LIB = {
  // Böden und Außenflächen
  beton: { color: '#8b8e91', rough: 0.9, l: { r: 0.28, r1550: 0.3, var: 0.25, varScale: 0.45, cls: 2 } },
  beton_hell: { color: '#a6a8a8', rough: 0.88, l: { r: 0.38, r1550: 0.4, var: 0.18, varScale: 0.5, cls: 6 } },
  epoxid: { color: '#9aa0a3', rough: 0.35, l: { r: 0.42, spec: 0.6, specWidth: 0.05, var: 0.06, varScale: 0.8, cls: 2 } },
  asphalt: { color: '#3c3e41', rough: 0.95, l: { r: 0.09, r1550: 0.1, var: 0.3, varScale: 0.25, rough: 0.003, cls: 2 } },
  markierung: { color: '#e9e8e1', rough: 0.7, l: { r: 0.85, var: 0.12, varScale: 0.1, cls: 2 } },
  markierung_gelb: { color: '#e3b200', rough: 0.7, l: { r: 0.68, var: 0.1, varScale: 0.1, cls: 2 } },
  gras: { color: '#55803a', rough: 1, l: { r: 0.45, r1550: 0.25, var: 0.3, varScale: 0.12, rough: 0.02, cls: 3 } },
  erde: { color: '#6a5237', rough: 1, l: { r: 0.22, r1550: 0.3, var: 0.25, varScale: 0.2, rough: 0.006, cls: 2 } },
  kies: { color: '#8b8781', rough: 1, l: { r: 0.3, var: 0.35, varScale: 0.05, rough: 0.008, cls: 2 } },
  pflaster: { color: '#8f8a84', rough: 0.9, l: { r: 0.3, var: 0.3, varScale: 0.1, cls: 2 } },
  wasser: { color: '#2b4250', rough: 0.05, metal: 0.2, l: { kind: 'absorb', r: 0.02, r1550: 0.005, spec: 3, specWidth: 0.02, cls: 9 } },
  // Vegetation
  laub: { color: '#3d6a2a', rough: 0.8, side: true, l: { r: 0.5, r1550: 0.28, var: 0.2, varScale: 0.05, cls: 5 } },
  laub_herbst: { color: '#9a6a22', rough: 0.8, side: true, l: { r: 0.48, r1550: 0.32, var: 0.2, varScale: 0.05, cls: 5 } },
  rinde: { color: '#5a493a', rough: 1, l: { r: 0.3, r1550: 0.35, var: 0.2, varScale: 0.03, rough: 0.004, cls: 5 } },
  // Gebäude und Ausbau
  putz: { color: '#e5e1d8', rough: 0.95, l: { r: 0.82, var: 0.05, varScale: 0.5, cls: 6 } },
  putz_grau: { color: '#a9a8a3', rough: 0.95, l: { r: 0.45, var: 0.06, varScale: 0.5, cls: 6 } },
  ziegel: { color: '#9a5038', rough: 0.95, l: { r: 0.38, var: 0.25, varScale: 0.09, cls: 6 } },
  gipskarton: { color: '#ebe9e4', rough: 0.95, l: { r: 0.8, cls: 6 } },
  fliese: { color: '#d8d5cd', rough: 0.25, l: { r: 0.68, spec: 0.7, specWidth: 0.04, cls: 6 } },
  holz_hell: { color: '#c7a67b', rough: 0.7, l: { r: 0.55, var: 0.12, varScale: 0.08, cls: 1 } },
  holz_dunkel: { color: '#5e4229', rough: 0.6, l: { r: 0.3, var: 0.12, varScale: 0.08, cls: 1 } },
  holz_palette: { color: '#b49468', rough: 0.95, l: { r: 0.5, var: 0.2, varScale: 0.05, rough: 0.002, cls: 1 } },
  parkett: { color: '#a97d52', rough: 0.4, l: { r: 0.48, spec: 0.4, specWidth: 0.05, var: 0.1, varScale: 0.1, cls: 1 } },
  teppich: { color: '#6b5f51', rough: 1, l: { r: 0.3, rough: 0.003, cls: 1 } },
  textil: { color: '#6d7075', rough: 1, l: { r: 0.36, rough: 0.002, cls: 1 } },
  textil_dunkel: { color: '#2b2d31', rough: 1, l: { r: 0.08, rough: 0.002, cls: 1 } },
  leder: { color: '#5a3a26', rough: 0.55, l: { r: 0.28, spec: 0.3, specWidth: 0.08, cls: 1 } },
  wellblech: { color: '#b7bcc0', rough: 0.45, metal: 0.6, l: { r: 0.42, spec: 0.8, specWidth: 0.06, cls: 6 } },
  // Metalle und Lacke
  stahl_grau: { color: '#6d737a', rough: 0.5, metal: 0.3, l: { r: 0.22, spec: 0.3, specWidth: 0.08, cls: 1 } },
  stahl_verzinkt: { color: '#a8adb2', rough: 0.45, metal: 0.85, l: { r: 0.35, spec: 0.6, specWidth: 0.1, cls: 1 } },
  edelstahl: { color: '#c2c6ca', rough: 0.28, metal: 1, l: { r: 0.3, spec: 1.2, specWidth: 0.05, cls: 1 } },
  alu_blech: { color: '#d4d7da', rough: 0.22, metal: 1, l: { r: 0.4, spec: 2.0, specWidth: 0.03, cls: 1 } },
  chrom: { color: '#e4e6e8', rough: 0.04, metal: 1, l: { kind: 'mirror', r: 0.02, trans: 0.75, cls: 1 } },
  spiegel: { color: '#eef0f2', rough: 0.01, metal: 1, l: { kind: 'mirror', r: 0.01, trans: 0.92, cls: 1 } },
  lack_rot: { color: '#a8201d', rough: 0.25, l: { r: 0.55, spec: 0.8, specWidth: 0.035, cls: 1 } },
  lack_weiss: { color: '#e8e9ea', rough: 0.22, l: { r: 0.75, spec: 0.8, specWidth: 0.035, cls: 1 } },
  lack_schwarz: { color: '#141516', rough: 0.18, l: { r: 0.06, spec: 1.4, specWidth: 0.03, cls: 1 } },
  lack_blau: { color: '#1f4f8f', rough: 0.28, l: { r: 0.3, spec: 0.8, specWidth: 0.035, cls: 1 } },
  lack_silber: { color: '#a9adb1', rough: 0.3, metal: 0.6, l: { r: 0.42, spec: 0.9, specWidth: 0.04, cls: 1 } },
  lack_gelb: { color: '#e6b000', rough: 0.4, l: { r: 0.65, spec: 0.4, specWidth: 0.05, cls: 1 } },
  lack_orange: { color: '#e05d18', rough: 0.4, l: { r: 0.6, spec: 0.4, specWidth: 0.05, cls: 1 } },
  ral7035: { color: '#c5c7c4', rough: 0.5, l: { r: 0.6, spec: 0.3, specWidth: 0.06, cls: 1 } },
  ral6011: { color: '#587246', rough: 0.5, l: { r: 0.32, spec: 0.3, specWidth: 0.06, cls: 1 } },
  ral5010: { color: '#1f4a7a', rough: 0.5, l: { r: 0.26, spec: 0.3, specWidth: 0.06, cls: 1 } },
  ral3000: { color: '#a5241f', rough: 0.5, l: { r: 0.55, spec: 0.3, specWidth: 0.06, cls: 1 } },
  ral1003: { color: '#e5a50a', rough: 0.5, l: { r: 0.62, spec: 0.3, specWidth: 0.06, cls: 1 } },
  ral9005: { color: '#17181a', rough: 0.55, l: { r: 0.05, spec: 0.2, specWidth: 0.06, cls: 1 } },
  // Kunststoffe, Gummi, Pappe
  gummi: { color: '#1d1d1e', rough: 0.85, l: { r: 0.04, r1550: 0.05, rough: 0.001, cls: 1 } },
  kunststoff_schwarz: { color: '#232426', rough: 0.6, l: { r: 0.07, spec: 0.2, specWidth: 0.08, cls: 1 } },
  kunststoff_weiss: { color: '#e9e9e7', rough: 0.5, l: { r: 0.8, spec: 0.2, specWidth: 0.08, cls: 1 } },
  kunststoff_blau: { color: '#2a5ea8', rough: 0.55, l: { r: 0.25, spec: 0.2, specWidth: 0.08, cls: 1 } },
  kunststoff_grau: { color: '#7d8186', rough: 0.55, l: { r: 0.3, spec: 0.2, specWidth: 0.08, cls: 1 } },
  kunststoff_gruen: { color: '#2f7d46', rough: 0.55, l: { r: 0.32, spec: 0.2, specWidth: 0.08, cls: 1 } },
  karton: { color: '#b28a5a', rough: 0.95, l: { r: 0.6, var: 0.08, varScale: 0.15, cls: 1 } },
  stretchfolie: { color: '#d8e1e6', rough: 0.3, opacity: 0.35, l: { kind: 'glass', r: 0.08, spec: 1.5, specWidth: 0.25, trans: 0.75, cls: 1 } },
  kabel: { color: '#1b1c1e', rough: 0.6, l: { r: 0.05, cls: 1 } },
  // Glas und Spiegelnde
  glas: { color: '#c8d8e0', rough: 0.02, opacity: 0.18, l: { kind: 'glass', r: 0.0, spec: 6, specWidth: 0.012, trans: 0.92, cls: 6 } },
  glas_getoent: { color: '#334048', rough: 0.02, opacity: 0.55, l: { kind: 'glass', r: 0.0, spec: 6, specWidth: 0.012, trans: 0.6, cls: 1 } },
  bildschirm: { color: '#0b0c0d', rough: 0.05, l: { kind: 'absorb', r: 0.02, spec: 4, specWidth: 0.015, cls: 1 } },
  // Menschen
  haut: { color: '#c99b7d', rough: 0.7, l: { r: 0.45, r1550: 0.35, cls: 1 } },
  jeans: { color: '#33465f', rough: 1, l: { r: 0.16, rough: 0.002, cls: 1 } },
  baumwolle_hell: { color: '#cfd3d6', rough: 1, l: { r: 0.62, rough: 0.002, cls: 1 } },
  warnweste: { color: '#c6dc00', rough: 0.9, l: { r: 0.72, rough: 0.002, cls: 1 } },
  haare: { color: '#2a1f17', rough: 1, l: { r: 0.12, rough: 0.004, cls: 1 } },
  // Retroreflektoren (Folie, Bänder, Kennzeichen)
  retro_weiss: { color: '#f1f1ee', rough: 0.4, emissive: 0.02, l: { kind: 'retro', r: 0.3, retro: 260, cls: 1 } },
  retro_rot: { color: '#c51d1d', rough: 0.4, l: { kind: 'retro', r: 0.3, retro: 90, cls: 1 } },
  retro_gelb: { color: '#f0c400', rough: 0.4, l: { kind: 'retro', r: 0.3, retro: 170, cls: 1 } },
  retro_blau: { color: '#1b4fa0', rough: 0.4, l: { kind: 'retro', r: 0.2, retro: 50, cls: 1 } },
  retro_band: { color: '#e8e3cf', rough: 0.4, l: { kind: 'retro', r: 0.3, retro: 140, cls: 1 } },
  kennzeichen: { color: '#f3f3ef', rough: 0.4, l: { kind: 'retro', r: 0.3, retro: 180, cls: 1 } },
  // Prüfmittel
  kal90: { color: '#f2f2f2', rough: 1, l: { r: 0.9, cls: 1 } },
  kal50: { color: '#bcbcbc', rough: 1, l: { r: 0.5, cls: 1 } },
  kal10: { color: '#595959', rough: 1, l: { r: 0.1, cls: 1 } },
  kal5: { color: '#3d3d3d', rough: 1, l: { r: 0.05, cls: 1 } },
  kugel_matt: { color: '#f0f0ee', rough: 1, l: { r: 0.85, cls: 1 } },
};

const cache = new Map();

export function lm(name) {
  if (cache.has(name)) return cache.get(name);
  const d = LIB[name];
  if (!d) throw new Error('Unbekanntes Material: ' + name);
  const mat = new THREE.MeshStandardMaterial({
    color: d.color, roughness: d.rough ?? 0.7, metalness: d.metal ?? 0,
    transparent: d.opacity != null, opacity: d.opacity ?? 1, depthWrite: d.opacity == null,
    side: d.side || d.opacity != null ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (d.emissive) { mat.emissive = new THREE.Color(d.color); mat.emissiveIntensity = d.emissive; }
  const col = new THREE.Color(d.color); // linear
  mat.userData.lidar = { name, ...d.l, color: [col.r, col.g, col.b] };
  mat.name = name;
  cache.set(name, mat);
  return mat;
}

// Variante mit eigener Farbe (z. B. Lackfarben), LiDAR-Eigenschaften der Basis
export function lmTint(name, color, extra = {}) {
  const key = name + '|' + color + '|' + JSON.stringify(extra);
  if (cache.has(key)) return cache.get(key);
  const base = lm(name);
  const mat = base.clone();
  mat.color = new THREE.Color(color);
  const col = mat.color;
  mat.userData = { lidar: { ...base.userData.lidar, ...extra, color: [col.r, col.g, col.b] } };
  cache.set(key, mat);
  return mat;
}

export const MATERIAL_NAMES = Object.keys(LIB);
export function lidarOf(name) { return LIB[name]?.l; }

// LiDAR-Eigenschaften aus einem beliebigen Three.js-Material ableiten (z. B. Roboterteile aus KINETIK)
export function lidarProps(mat) {
  if (mat.userData && mat.userData.lidar) return mat.userData.lidar;
  const c = mat.color ? mat.color : new THREE.Color('#888');
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const metal = mat.metalness || 0, rough = mat.roughness ?? 0.7;
  const p = { color: [c.r, c.g, c.b], cls: 1 };
  if (mat.transparent && mat.opacity < 0.6) Object.assign(p, { kind: 'glass', r: 0.02, spec: 4, specWidth: 0.02, trans: 0.85 });
  else if (metal > 0.8 && rough < 0.12) Object.assign(p, { kind: 'mirror', r: 0.03, trans: 0.7 });
  else Object.assign(p, { r: Math.min(0.92, Math.max(0.03, lum * 0.95 * (1 - 0.4 * metal))), spec: metal * (1 - rough) * 2, specWidth: 0.03 + rough * 0.25 });
  return p;
}
