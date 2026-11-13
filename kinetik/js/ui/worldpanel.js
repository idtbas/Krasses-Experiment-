// Umgebung der freien Testfläche: Beleuchtung, Nebel und Temperatur; Anlagenteile, Testobjekte und Roboter platzieren und bearbeiten.
import { h, clear, uid } from '../core/util.js';
import { icon } from '../core/icons.js';
import { OBJECT_TYPES, MATERIALS } from '../world/objects.js';
import { COLORS } from '../lang/commands.js';
import { ROBOT_TYPES, DEFAULT_CONFIGS, withDefaults } from '../robots/parts.js';
import { toast } from './dialogs.js';
import { ProgramDoc } from './program.js';

const COLORABLE = new Set(['würfel', 'kugel', 'zylinder', 'zone', 'kiste', 'ziel', 'taster', 'wand']);
const SHELF = [
  ['Werkstücke', ['würfel', 'zylinder', 'kugel']],
  ['Anlage', ['tisch', 'band', 'spender', 'lichtschranke', 'taster', 'lampe', 'kiste', 'zone']],
  ['Halle', ['wand', 'zaun', 'regal', 'hindernis', 'rampe', 'linie', 'ziel', 'ladestation', 'basisstation', 'markierung']],
  ['Testobjekte', ['fahrzeug', 'dummy']],
];
const LIGHT = [['Tag', 1], ['Dämmerung', 0.25], ['Dunkel', 0.04]];
const FOG = [['klar', 0], ['dunstig', 0.4], ['Nebel', 0.75]];

export class WorldPanel {
  constructor(app) {
    this.app = app;
    this.el = h('div.pane.scroll');
    this.placing = null;
  }

  get project() { return this.app.project; }

  render() {
    clear(this.el);
    const app = this.app;
    if (!app.isSandbox()) { this.el.appendChild(h('p.muted', 'Die Umgebung ist nur auf der freien Testfläche änderbar.')); return; }
    // Hallenbedingungen
    const env = this.project.env || (this.project.env = {});
    const sub = (t) => h('div.cap', { style: { margin: '0 0 6px' } }, t);
    const seg = (opts, cur, pick) => {
      const s2 = h('div.seg');
      for (const [label, v] of opts) {
        const b = h('button' + (cur === v ? '.on' : ''), label);
        b.addEventListener('click', () => { pick(v); app.buildWorld(); app.autosave(); this.render(); });
        s2.appendChild(b);
      }
      return s2;
    };
    this.el.appendChild(h('div.envbar',
      h('div', sub('Hallenbeleuchtung'), seg(LIGHT, env.licht ?? 1, (v) => { env.licht = v; })),
      h('div', sub('Sicht'), seg(FOG, env.nebel ?? 0, (v) => { env.nebel = v; }))));
    this.el.appendChild(h('div.envbar', h('div', sub('Hallentemperatur'), seg([['12 °C', 12], ['22 °C', 22], ['35 °C', 35]], env.temperatur ?? 22, (v) => { env.temperatur = v; })), h('div')));
    for (const [title, list] of SHELF) {
      this.el.appendChild(h('div.cap', { style: { margin: '14px 0 6px' } }, title));
      const shelf = h('div.shelf');
      for (const t of list) {
        const o = OBJECT_TYPES[t];
        const b = h('button' + (this.placing === t ? '.on' : ''), { html: icon(o.icon) + `<span>${o.name}</span>` });
        b.addEventListener('click', () => this.startPlacing(t));
        shelf.appendChild(b);
      }
      this.el.appendChild(shelf);
    }
    this.el.appendChild(h('div.cap', { style: { margin: '14px 0 6px' } }, 'Roboter'));
    const rs = h('div.shelf');
    for (const [id, t] of Object.entries(ROBOT_TYPES)) {
      const b = h('button' + (this.placing === 'robot:' + id ? '.on' : ''), { html: icon(id) + `<span>${t.name}<br><small class="muted">${t.label}</small></span>` });
      b.addEventListener('click', () => this.startPlacing('robot:' + id));
      rs.appendChild(b);
    }
    this.el.appendChild(rs);
    this.el.appendChild(h('p.muted', { style: { fontSize: '12px' } }, 'Teil wählen und auf den Hallenboden tippen. Verschieben mit dem Aufbauwerkzeug rechts in der 3D-Ansicht.'));
    this.renderInspector();
  }

  startPlacing(t) {
    this.placing = this.placing === t ? null : t;
    if (this.placing) toast('Zielposition in der 3D-Ansicht antippen.');
    this.render();
  }

  // vom App-Klick auf den Boden aufgerufen
  place(point) {
    const t = this.placing;
    if (!t) return false;
    const app = this.app;
    const x = Math.round(point.x * 100) / 100, z = Math.round(point.z * 100) / 100;
    if (t.startsWith('robot:')) {
      const type = t.slice(6);
      const n = this.project.robots.filter((r) => r.config.type === type).length;
      const cfg = withDefaults({ ...DEFAULT_CONFIGS[type], name: DEFAULT_CONFIGS[type].name + (n ? '-' + (n + 1) : '') });
      const def = { id: uid('r'), config: cfg, spawn: { x, y: 0, z, yaw: 0 }, code: 'beim start\n  \nende\n', layout: [] };
      this.project.robots.push(def);
      app.docs.set(def.id, new ProgramDoc(def.code, []));
      app.buildWorld();
      app.selectRobot(def.id);
      app.renderRobotsBar();
    } else {
      const spec = { type: t, x, z };
      if (t === 'fahrzeug') spec.path = [[x - 2, z], [x + 2, z]];
      if (t === 'dummy') spec.route = [[0, x, z], [4, x, z], [7, x + 1.5, z], [11, x + 1.5, z], [14, x, z]];
      if (COLORABLE.has(t)) spec.color = t === 'zone' ? 'grün' : t === 'kiste' ? 'blau' : t === 'ziel' ? 'orange' : 'rot';
      // auf Tischen ablegen
      for (const e of app.sim.entities) if (e.surfaceAt && (t === 'würfel' || t === 'kugel' || t === 'zylinder' || t === 'zone' || t === 'kiste')) { const top = e.surfaceAt(x, z); if (top != null) spec.y = t === 'zone' || t === 'kiste' ? top : top + 0.05; }
      this.project.objects.push(spec);
      app.buildWorld();
      app.selected = app.sim.entities.find((e) => e.specIndex === this.project.objects.length - 1) || null;
    }
    this.placing = null;
    app.autosave();
    this.render();
    return true;
  }

  syncSpec(ent) {
    // Position aus der Welt ins Projekt übernehmen
    const spec = ent && this.project.objects[ent.specIndex];
    if (spec) { spec.x = ent.spec.x; spec.z = ent.spec.z; }
  }

  index(ent) { return ent.specIndex ?? -1; }

  renderInspector() {
    const app = this.app;
    const sel = app.selected;
    if (!sel || !sel.alive) return;
    const box = h('div.insp');
    if (sel.isRobot) {
      const def = app.robotDefOf(sel);
      box.appendChild(h('h4', { html: icon(sel.type) + `<span>${sel.name}</span>` }));
      const row = h('div.row');
      const rot = h('button.btn.small', { html: icon('rotate') + '<span>Drehen</span>' });
      rot.addEventListener('click', () => { def.spawn.yaw = ((def.spawn.yaw || 0) + Math.PI / 4) % (Math.PI * 2); app.buildWorld(); app.selected = app.robotEntity(def.id); app.autosave(); this.render(); });
      const del = h('button.btn.small.danger', { html: icon('trash') + '<span>Entfernen</span>' });
      del.addEventListener('click', () => {
        if (this.project.robots.length < 2) { toast('Mindestens ein Roboter muss in der Anlage bleiben.'); return; }
        this.project.robots = this.project.robots.filter((d) => d !== def);
        app.docs.delete(def.id);
        app.currentId = this.project.robots[0].id;
        app.buildWorld(); app.renderRobotsBar(); app.loadEditors(); app.autosave(); this.render();
      });
      row.append(rot, del);
      box.appendChild(row);
      this.el.appendChild(box);
      return;
    }
    const idx = this.index(sel);
    const spec = this.project.objects[idx];
    if (!spec) return;
    const T = OBJECT_TYPES[spec.type];
    box.appendChild(h('h4', { html: icon(T.icon) + `<span>${T.name}</span>` }));
    if (COLORABLE.has(spec.type)) {
      const row = h('div.row', h('span', 'Farbe'));
      for (const [n, hex] of Object.entries(COLORS)) {
        const b = h('button.swatch' + (spec.color === n ? '.on' : ''), { style: { background: hex }, title: n });
        b.addEventListener('click', () => { spec.color = n; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    if (['würfel', 'kugel', 'zylinder'].includes(spec.type)) {
      const row = h('div.row', h('span', 'Material'));
      for (const [k, m] of Object.entries(MATERIALS)) {
        const b = h('button.btn.small' + ((spec.material || (spec.type === 'kugel' ? 'gummi' : 'holz')) === k ? '.on' : ''), m.name);
        b.addEventListener('click', () => { spec.material = k; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
      if (spec.type === 'würfel') {
        const r2 = h('div.row', h('span', 'Größe'));
        for (const s of [0.04, 0.06, 0.08, 0.12]) {
          const b = h('button.btn.small' + ((spec.size || 0.06) === s ? '.on' : ''), Math.round(s * 100) + ' cm');
          b.addEventListener('click', () => { spec.size = s; this.rebuild(idx); });
          r2.appendChild(b);
        }
        box.appendChild(r2);
      }
    }
    if (['würfel', 'zylinder'].includes(spec.type)) {
      const row = h('div.row', h('span', 'Temperatur'));
      for (const v of [null, 45, 80, 150]) {
        const b = h('button.btn.small' + ((spec.temp ?? null) === v ? '.on' : ''), v == null ? 'Halle' : v + ' °C');
        b.addEventListener('click', () => { if (v == null) delete spec.temp; else spec.temp = v; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
      const r3 = h('div.row', h('span', 'Kennung'));
      for (const v of [null, 'A-1001', 'B-2002', 'C-3003']) {
        const b = h('button.btn.small' + ((spec.code ?? null) === v ? '.on' : ''), v || 'ohne');
        b.addEventListener('click', () => { if (v == null) delete spec.code; else spec.code = v; this.rebuild(idx); });
        r3.appendChild(b);
      }
      box.appendChild(r3);
    }
    if (spec.type === 'wand') {
      const row = h('div.row', h('span', 'Material'));
      for (const [k, n] of [[undefined, 'Trockenbau'], ['beton', 'Beton'], ['stahlbeton', 'Stahlbeton'], ['blech', 'Blech'], ['glas', 'Glas']]) {
        const b = h('button.btn.small' + (spec.material === k ? '.on' : ''), n);
        b.addEventListener('click', () => { if (k) spec.material = k; else delete spec.material; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    if (spec.type === 'hindernis') {
      const row = h('div.row', h('span', 'Bauform'));
      for (const [k, n] of [['karton', 'Karton'], ['gitterbox', 'Gitterbox'], ['pylon', 'Pylon'], ['palette', 'Palette']]) {
        const b = h('button.btn.small' + ((spec.variant || 'karton') === k ? '.on' : ''), n);
        b.addEventListener('click', () => { spec.variant = k; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    if (spec.type === 'fahrzeug') {
      const row = h('div.row', h('span', 'Tempo'));
      for (const v of [0.5, 1.0, 1.5]) {
        const b = h('button.btn.small' + ((spec.speed ?? 1) === v ? '.on' : ''), v.toFixed(1) + ' m/s');
        b.addEventListener('click', () => { spec.speed = v; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    if (spec.type === 'band') {
      const row = h('div.row', h('span', 'Tempo'));
      for (const v of [20, 40, 70, -40]) {
        const b = h('button.btn.small' + ((spec.speed ?? 40) === v ? '.on' : ''), v + ' %');
        b.addEventListener('click', () => { spec.speed = v; this.rebuild(idx); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    const row = h('div.row');
    const rot = h('button.btn.small', { html: icon('rotate') + '<span>Drehen</span>' });
    rot.addEventListener('click', () => { spec.yaw = ((spec.yaw || 0) + Math.PI / 8) % (Math.PI * 2); this.rebuild(idx); });
    const dup = h('button.btn.small', { html: icon('copy') + '<span>Kopie</span>' });
    dup.addEventListener('click', () => { this.project.objects.push({ ...spec, x: (spec.x || 0) + 0.12 }); this.app.buildWorld(); this.app.autosave(); this.render(); });
    const del = h('button.btn.small.danger', { html: icon('trash') + '<span>Löschen</span>' });
    del.addEventListener('click', () => { this.project.objects.splice(idx, 1); this.app.selected = null; this.app.buildWorld(); this.app.autosave(); this.render(); });
    row.append(rot, dup, del);
    box.appendChild(row);
    this.el.appendChild(box);
  }

  rebuild(idx) {
    this.app.buildWorld();
    this.app.selected = this.app.sim.entities.find((e) => e.specIndex === idx) || null;
    this.app.autosave();
    this.render();
  }
}
