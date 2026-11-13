// 3D-Modelle der Anbaugeräte. Jedes Modell schaut nach +z, oben ist +y, Ursprung = Befestigungspunkt.
import * as THREE from 'three';
import { Mat, Geo, mesh, boltCircle, fins, plate } from '../render/materials.js';

const G = () => new THREE.Group();
const keep = (o) => { o.userData.keep = true; return o; };

export const Dev = {
  // 2D-LiDAR: flacher Sockel, rotierender Kopf hinter dunklem Fenster
  lidar2d() {
    const g = G();
    g.add(mesh(Geo.chamferCyl(0.036, 0.022, 0.003), Mat.anodized(), 0, 0.011, 0));
    g.add(mesh(Geo.cyl(0.031, 0.031, 0.026, 36), Mat.glass('#0c1116', 0.92), 0, 0.035, 0));
    g.add(mesh(Geo.chamferCyl(0.034, 0.008, 0.002), Mat.anodized(), 0, 0.052, 0));
    const rotor = keep(G());
    rotor.add(mesh(Geo.box(0.02, 0.012, 0.012, 0.002), Mat.plain('#2b3036', 0.4, 0.6), 0, 0, 0.018));
    rotor.add(mesh(Geo.cyl(0.004, 0.004, 0.003, 12), Mat.glow('#ff2a2a', 1.6), 0, 0, 0.025).rotateX(Math.PI / 2));
    rotor.position.y = 0.035;
    rotor.userData.spin = 60;
    g.add(rotor);
    g.userData.rotor = rotor;
    return g;
  },
  // 3D-LiDAR: hoher Zylinder mit Kühlrippen und umlaufendem Fenster
  lidar3d() {
    const g = G();
    g.add(mesh(Geo.chamferCyl(0.045, 0.018, 0.003), Mat.alu(), 0, 0.009, 0));
    g.add(fins(0.043, 0.02, 4, 0.003, Mat.alu()).translateY(0.028));
    const win = mesh(Geo.cyl(0.044, 0.044, 0.04, 40), Mat.glass('#0a0f14', 0.95), 0, 0.058, 0);
    g.add(win);
    g.add(mesh(Geo.chamferCyl(0.045, 0.016, 0.003), Mat.alu(), 0, 0.086, 0));
    g.add(boltCircle(0.032, 6, 0.0025, 0.002).translateY(0.094));
    const rotor = keep(G());
    rotor.add(mesh(Geo.box(0.03, 0.03, 0.01, 0.003), Mat.plain('#263038', 0.3, 0.7), 0, 0, 0.03));
    rotor.position.y = 0.058;
    rotor.userData.spin = 31;
    g.add(rotor);
    g.userData.rotor = rotor;
    return g;
  },
  // Sicherheitslaserscanner: gelbes Gehäuse, schwarze Frontscheibe
  safetyScanner() {
    const g = G();
    g.add(mesh(Geo.box(0.1, 0.07, 0.08, 0.008), Mat.paint('#e2a312'), 0, 0.035, -0.01));
    g.add(mesh(Geo.cyl(0.045, 0.045, 0.04, 36, 1), Mat.glass('#0b0d10', 0.95), 0, 0.045, 0.015));
    g.add(mesh(Geo.box(0.1, 0.012, 0.09, 0.004), Mat.anodized(), 0, 0.072, -0.005));
    const st = mesh(Geo.box(0.02, 0.006, 0.004, 0.001), Mat.glow('#3fd07a', 1.4), 0.03, 0.06, 0.031);
    keep(st);
    g.add(st);
    g.userData.statusLed = st;
    return g;
  },
  // Radar: flaches Radom auf Halter
  radar() {
    const g = G();
    g.add(mesh(Geo.box(0.03, 0.02, 0.02, 0.004), Mat.anodized(), 0, 0.03, -0.012));
    g.add(mesh(Geo.box(0.085, 0.07, 0.022, 0.008), Mat.plain('#3b4148', 0.7, 0.1), 0, 0.035, 0.006));
    g.add(mesh(Geo.box(0.075, 0.06, 0.003, 0.006), Mat.plain('#2a2f35', 0.85, 0), 0, 0.035, 0.018));
    const p = plate('77 GHz', 0.04, 0.01, { bg: '#2a2f35', color: '#9aa3ad', size: 30 });
    p.position.set(0, 0.012, 0.0197);
    g.add(p);
    return g;
  },
  // Industriekamera: Gehäuse mit Objektiv
  camera() {
    const g = G();
    g.add(mesh(Geo.box(0.04, 0.04, 0.05, 0.004), Mat.anodized(), 0, 0.02, -0.01));
    g.add(mesh(Geo.cyl(0.015, 0.015, 0.03, 24), Mat.alu(), 0, 0.02, 0.03).rotateX(Math.PI / 2));
    g.add(mesh(Geo.cyl(0.011, 0.011, 0.004, 24), Mat.lens(), 0, 0.02, 0.046).rotateX(Math.PI / 2));
    g.add(mesh(Geo.box(0.02, 0.012, 0.008, 0.002), Mat.cable(), 0, 0.02, -0.038));
    return g;
  },
  // Tiefenkamera: breiter Riegel mit zwei Objektiven und Projektor
  depthCamera() {
    const g = G();
    g.add(mesh(Geo.box(0.1, 0.026, 0.026, 0.008), Mat.plain('#2c3238', 0.5, 0.5), 0, 0.013, 0));
    g.add(mesh(Geo.box(0.092, 0.018, 0.002, 0.004), Mat.visor(), 0, 0.013, 0.0135));
    for (const x of [-0.035, 0.035, 0.0]) g.add(mesh(Geo.cyl(x ? 0.005 : 0.0035, x ? 0.005 : 0.0035, 0.002, 16), x ? Mat.lens() : Mat.glow('#5a1010', 0.6), x, 0.013, 0.0148).rotateX(Math.PI / 2));
    return g;
  },
  // Wärmebildkamera: Gehäuse mit großem Germanium-Objektiv
  thermalCamera() {
    const g = G();
    g.add(mesh(Geo.box(0.046, 0.046, 0.055, 0.006), Mat.plain('#4a5058', 0.6, 0.4), 0, 0.023, -0.008));
    g.add(mesh(Geo.cyl(0.019, 0.021, 0.022, 28), Mat.anodized(), 0, 0.023, 0.028).rotateX(Math.PI / 2));
    g.add(mesh(Geo.cyl(0.015, 0.015, 0.003, 28), Mat.plain('#1a2430', 0.1, 0.9), 0, 0.023, 0.04).rotateX(Math.PI / 2));
    g.add(mesh(Geo.box(0.046, 0.006, 0.004, 0.001), Mat.paint('#e2601a'), 0, 0.044, 0.0196));
    return g;
  },
  ultrasonic() {
    const g = G();
    g.add(mesh(Geo.box(0.07, 0.03, 0.008, 0.003), Mat.plain('#1c3a5a', 0.6, 0.2), 0, 0.015, 0));
    for (const x of [-0.019, 0.019]) {
      g.add(mesh(Geo.cyl(0.0125, 0.0125, 0.014, 20), Mat.steel(), x, 0.015, 0.008).rotateX(Math.PI / 2));
      g.add(mesh(Geo.cyl(0.009, 0.009, 0.002, 20), Mat.plain('#202326', 0.9), x, 0.015, 0.0152).rotateX(Math.PI / 2));
    }
    return g;
  },
  tof() {
    const g = G();
    g.add(mesh(Geo.box(0.03, 0.022, 0.014, 0.003), Mat.anodized(), 0, 0.011, 0));
    g.add(mesh(Geo.cyl(0.005, 0.005, 0.003, 16), Mat.glow('#7a1010', 0.8), -0.007, 0.011, 0.008).rotateX(Math.PI / 2));
    g.add(mesh(Geo.cyl(0.005, 0.005, 0.003, 16), Mat.lens(), 0.007, 0.011, 0.008).rotateX(Math.PI / 2));
    return g;
  },
  rfid() {
    const g = G();
    g.add(mesh(Geo.box(0.06, 0.012, 0.06, 0.006), Mat.plain('#e4e6e8', 0.6), 0, 0.006, 0));
    const p = plate('RFID', 0.04, 0.012, { bg: '#e4e6e8', color: '#2b3036', size: 34 });
    p.rotation.x = -Math.PI / 2;
    p.position.set(0, 0.0125, 0.012);
    g.add(p);
    return g;
  },
  barcode() {
    const g = G();
    g.add(mesh(Geo.box(0.04, 0.03, 0.045, 0.005), Mat.plain('#2b3036', 0.6, 0.3), 0, 0.015, 0));
    g.add(mesh(Geo.box(0.03, 0.012, 0.002, 0.002), Mat.glow('#ff2a2a', 0.9), 0, 0.015, 0.0232));
    return g;
  },
  forceTorque() {
    const g = G();
    g.add(mesh(Geo.chamferCyl(0.036, 0.022, 0.002), Mat.alu(), 0, 0.011, 0));
    g.add(mesh(Geo.cyl(0.0365, 0.0365, 0.004, 40), Mat.anodized(), 0, 0.011, 0));
    g.add(boltCircle(0.028, 6, 0.0025, 0.002).translateY(0.022));
    return g;
  },
  colorSensor() {
    const g = G();
    g.add(mesh(Geo.box(0.024, 0.008, 0.024, 0.002), Mat.anodized(), 0, 0.004, 0));
    const led = keep(mesh(Geo.box(0.012, 0.002, 0.012, 0.001), Mat.glow('#ffffff', 1.4), 0, 0.0085, 0));
    g.add(led);
    return g;
  },
  // Signalsäule: Fuß, Rohr, vier Segmente
  stackLight() {
    const g = G();
    g.add(mesh(Geo.chamferCyl(0.022, 0.012, 0.002), Mat.anodized(), 0, 0.006, 0));
    g.add(mesh(Geo.cyl(0.006, 0.006, 0.08, 12), Mat.steel(), 0, 0.052, 0));
    const segs = {};
    const cols = [['blau', '#3a7bff'], ['grün', '#2fd46d'], ['gelb', '#ffb21a'], ['rot', '#ff3030']];
    cols.forEach(([n, c], i) => {
      const s = keep(mesh(Geo.cyl(0.02, 0.02, 0.026, 28), Mat.glass(c, 0.55), 0, 0.105 + i * 0.028, 0));
      s.userData.on = Mat.glow(c, 2.2);
      s.userData.off = Mat.glass(c, 0.55);
      segs[n] = s;
      g.add(s);
    });
    g.add(mesh(Geo.chamferCyl(0.021, 0.012, 0.003), Mat.anodized(), 0, 0.105 + 4 * 0.028 - 0.008, 0));
    g.userData.segments = segs;
    return g;
  },
  beacon() {
    const g = G();
    g.add(mesh(Geo.chamferCyl(0.03, 0.016, 0.003), Mat.anodized(), 0, 0.008, 0));
    const dome = keep(mesh(Geo.lathe([[0, 0], [0.026, 0], [0.026, 0.03], [0.02, 0.045], [0, 0.05]], 32), Mat.glass('#ff8a1a', 0.6), 0, 0.016, 0));
    dome.userData.on = Mat.glow('#ff8a1a', 2.6);
    dome.userData.off = Mat.glass('#ff8a1a', 0.6);
    g.add(dome);
    const rotor = keep(G());
    rotor.add(mesh(Geo.box(0.03, 0.02, 0.004, 0.001), Mat.steel(), 0, 0, 0));
    rotor.position.y = 0.035;
    rotor.userData.spin = 0;
    g.add(rotor);
    g.userData.dome = dome;
    g.userData.rotor = rotor;
    return g;
  },
  floodlight() {
    const g = G();
    g.add(mesh(Geo.box(0.012, 0.03, 0.012, 0.002), Mat.anodized(), 0, 0.015, -0.02));
    g.add(mesh(Geo.box(0.07, 0.05, 0.035, 0.006), Mat.plain('#2f353b', 0.55, 0.4), 0, 0.04, 0));
    const lens = keep(mesh(Geo.box(0.06, 0.04, 0.002, 0.004), Mat.plain('#d9dde2', 0.2, 0.1), 0, 0.04, 0.0185));
    lens.userData.on = Mat.glow('#fff6e0', 3.2);
    lens.userData.off = Mat.plain('#d9dde2', 0.2, 0.1);
    g.add(lens);
    g.userData.lens = lens;
    for (let i = 0; i < 4; i++) g.add(mesh(Geo.box(0.072, 0.003, 0.03, 0.001), Mat.anodized(), 0, 0.02 + i * 0.012, -0.004));
    return g;
  },
  horn() {
    const g = G();
    g.add(mesh(Geo.box(0.03, 0.03, 0.02, 0.004), Mat.anodized(), 0, 0.015, -0.01));
    g.add(mesh(Geo.cyl(0.022, 0.008, 0.03, 24, 1, true), Mat.plain('#c9312b', 0.5), 0, 0.015, 0.012).rotateX(Math.PI / 2));
    return g;
  },
  // Antennen (Funk)
  antenna(kind) {
    const g = G();
    if (kind === 'chip') return g;
    if (kind === 'stab') {
      g.add(mesh(Geo.cyl(0.006, 0.008, 0.012, 12), Mat.anodized(), 0, 0.006, 0));
      g.add(mesh(Geo.cyl(0.003, 0.004, 0.12, 8), Mat.plain('#1a1c1f', 0.6), 0, 0.072, 0));
    } else if (kind === 'rundstrahl') {
      g.add(mesh(Geo.chamferCyl(0.014, 0.01, 0.002), Mat.anodized(), 0, 0.005, 0));
      g.add(mesh(Geo.cyl(0.006, 0.007, 0.26, 10), Mat.plain('#e6e7e8', 0.5), 0, 0.14, 0));
      g.add(mesh(Geo.sphere(0.0065, 10), Mat.plain('#e6e7e8', 0.5), 0, 0.27, 0));
    } else if (kind === 'patch') {
      g.add(mesh(Geo.cyl(0.004, 0.004, 0.08, 8), Mat.steel(), 0, 0.04, 0));
      g.add(mesh(Geo.box(0.08, 0.08, 0.014, 0.006), Mat.plain('#eeeeee', 0.55), 0, 0.11, 0.008));
    } else if (kind === 'yagi') {
      g.add(mesh(Geo.cyl(0.004, 0.004, 0.1, 8), Mat.steel(), 0, 0.05, 0));
      const boom = mesh(Geo.box(0.008, 0.008, 0.24, 0.002), Mat.alu(), 0, 0.1, 0.07);
      g.add(boom);
      for (let i = 0; i < 6; i++) g.add(mesh(Geo.cyl(0.0018, 0.0018, 0.11 - i * 0.008, 6), Mat.alu(), 0, 0.1, -0.03 + i * 0.04).rotateZ(Math.PI / 2));
    }
    return g;
  },
  // Kleiner Mast (z. B. für Kameras am Arm)
  mast(h, r = 0.012) {
    const g = G();
    g.add(mesh(Geo.box(0.05, 0.008, 0.05, 0.002), Mat.anodized(), 0, 0.004, 0));
    g.add(mesh(Geo.cyl(r, r, h, 14), Mat.alu(), 0, h / 2, 0));
    return g;
  },
};

// Lampen an- bzw. ausschalten (Materialwechsel)
export function setLit(mesh, on) { if (mesh && mesh.userData.on) mesh.material = on ? mesh.userData.on : mesh.userData.off; }
