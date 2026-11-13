// Funkstrecken: Linkbudget aus Sendeleistung, Antennengewinnen (mit Richtwirkung), Freiraumdämpfung
// und Wanddämpfung (je Material und Frequenz). Nachrichten kommen nur an, wenn der Pegel über der
// Empfindlichkeit des Empfängers liegt, und mit der Latenz der Funktechnik.
import { DEG } from '../core/util.js';

// Dämpfung je Wanddurchgang in dB bei 2,4 GHz
const WALL_DB = { beton: 15, stahlbeton: 22, blech: 28, stahl: 28, ziegel: 9, holz: 4, glas: 3, trockenbau: 5 };

export class Radio {
  constructor(sim) { this.sim = sim; }

  gain(robot, toward) {
    const a = robot.antenna;
    if (!a) return 0;
    if (!a.beam) return a.gain;
    const { p, d } = robot.antennaPose();
    const v = { x: toward.x - p.x, z: toward.z - p.z };
    const l = Math.hypot(v.x, v.z) || 1;
    const dl = Math.hypot(d.x, d.z) || 1;
    const cos = (v.x * d.x + v.z * d.z) / (l * dl);
    return cos >= Math.cos((a.beam / 2) * DEG) ? a.gain : a.gain - 18;
  }

  // Dämpfung durch Wände zwischen zwei Punkten (dB)
  wallLoss(p1, p2, freq) {
    const ph = this.sim.physics;
    let o = { ...p1 };
    const total = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const dir = { x: (p2.x - p1.x) / total, y: (p2.y - p1.y) / total, z: (p2.z - p1.z) / total };
    let left = total, loss = 0, walls = 0;
    const seen = new Set();
    for (let i = 0; i < 24 && left > 0.02; i++) {
      const hit = ph.ray(o, dir, left, ph.rayEnvOnly, undefined, false);
      if (!hit) break;
      const info = hit.info || {};
      const e = info.entity;
      if (e && e.kind === 'wand' && !seen.has(e)) {
        seen.add(e);
        walls++;
        loss += (WALL_DB[e.spec.material] ?? WALL_DB.trockenbau) * Math.sqrt(freq / 2400);
      }
      const step = hit.dist + 0.002;
      o = { x: o.x + dir.x * step, y: o.y + dir.y * step, z: o.z + dir.z * step };
      left -= step;
    }
    return { loss, walls };
  }

  // Pegel von a nach b (oder zu einem festen Punkt, z. B. einer Basisstation)
  link(a, b) {
    const ra = a.radio || a.radioSpec, rb = b.radio || b.radioSpec;
    if (!ra || !rb || !ra.tech || !rb.tech) return { ok: false, rssi: -200, reason: 'kein Funk' };
    if (ra.tech !== rb.tech) return { ok: false, rssi: -200, reason: 'inkompatibel' };
    const pa = a.antennaPose ? a.antennaPose().p : a.pos, pb = b.antennaPose ? b.antennaPose().p : b.pos;
    const d = Math.max(0.5, Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z));
    const f = ra.freq;
    const fspl = 20 * Math.log10(d) + 20 * Math.log10(f) - 27.55;
    const wl = this.wallLoss(pa, pb, f);
    const ga = a.antennaPose ? this.gain(a, pb) : a.gain || 0;
    const gb = b.antennaPose ? this.gain(b, pa) : b.gain || 0;
    const rssi = Math.round((ra.ptx + ga + gb - fspl - wl.loss) * 10) / 10;
    return { ok: rssi >= rb.sens, rssi, walls: wl.walls, dist: d, latency: Math.max(ra.latency, rb.latency) };
  }

  stations() { return this.sim.entities.filter((e) => e.kind === 'basisstation'); }

  // Verbindung zwischen zwei Robotern, bei 5G über die beste Basisstation
  route(a, b) {
    if (!a.radio.tech || !b.radio.tech) return { ok: false, rssi: -200, reason: 'kein Funk' };
    if (a.radio.tech !== b.radio.tech) return { ok: false, rssi: -200, reason: 'inkompatibel' };
    if (a.radio.tech === '5g') {
      const bs = this.stations();
      if (!bs.length) return { ok: true, rssi: -68, latency: a.radio.latency, via: 'Campusnetz' };
      let best = null;
      for (const s of bs) {
        const l1 = this.link(a, s), l2 = this.link(s, b);
        const r = Math.min(l1.rssi, l2.rssi);
        if (!best || r > best.rssi) best = { ok: l1.ok && l2.ok, rssi: r, latency: a.radio.latency * 2, via: s.name };
      }
      return best;
    }
    return this.link(a, b);
  }

  bestRssi(robot) {
    let best = -120;
    for (const r of this.sim.robots) if (r !== robot) best = Math.max(best, this.route(robot, r).rssi);
    if (robot.radio.tech === '5g') for (const s of this.stations()) best = Math.max(best, this.link(robot, s).rssi);
    return best;
  }
}
