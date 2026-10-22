// „Welt“ in der Sandbox: Gegenstände und Roboter hinzufügen, auswählen, einfärben, drehen, löschen.
import { h, clear, uid } from '../core/util.js';
import { icon } from '../core/icons.js';
import { OBJECT_TYPES, MATERIALS } from '../world/objects.js';
import { COLORS } from '../lang/commands.js';
import { ROBOT_TYPES, DEFAULT_CONFIGS, withDefaults } from '../robots/parts.js';
import { toast } from './dialogs.js';
import { ProgramDoc } from './program.js';

const COLORABLE = new Set(['würfel', 'kugel', 'zylinder', 'zone', 'kiste', 'ziel', 'taster', 'wand']);
const SHELF = ['würfel', 'kugel', 'zylinder', 'tisch', 'wand', 'rampe', 'zone', 'kiste', 'ziel', 'band', 'spender', 'lichtschranke', 'taster', 'lampe'];

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
    if (!app.isSandbox()) { this.el.appendChild(h('p.muted', 'Die Welt lässt sich nur in der Sandbox umbauen.')); return; }
    this.el.appendChild(h('h3.muted', { style: { margin: '0 0 10px', fontSize: '13px', letterSpacing: '.08em', textTransform: 'uppercase' } }, 'Hinzufügen'));
    const shelf = h('div.shelf');
    for (const t of SHELF) {
      const o = OBJECT_TYPES[t];
      const b = h('button' + (this.placing === t ? '.on' : ''), { html: icon(o.icon) + `<span>${o.name}</span>` });
      b.addEventListener('click', () => this.startPlacing(t));
      shelf.appendChild(b);
    }
    for (const [id, t] of Object.entries(ROBOT_TYPES)) {
      const b = h('button' + (this.placing === 'robot:' + id ? '.on' : ''), { html: icon(id) + `<span>+ ${t.name}</span>` });
      b.addEventListener('click', () => this.startPlacing('robot:' + id));
      shelf.appendChild(b);
    }
    this.el.appendChild(shelf);
    this.el.appendChild(h('p.muted', { style: { fontSize: '12.5px' } }, 'Tippe auf ein Teil und dann auf den Boden. Mit dem Verschieben-Werkzeug (rechts in der 3D-Ansicht) ziehst du Dinge an einen anderen Platz.'));
    this.renderInspector();
  }

  startPlacing(t) {
    this.placing = this.placing === t ? null : t;
    if (this.placing) toast('Tippe in der 3D-Ansicht auf die Stelle, an der es stehen soll.');
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
      const cfg = withDefaults({ ...DEFAULT_CONFIGS[type], name: DEFAULT_CONFIGS[type].name + (n ? ' ' + (n + 1) : '') });
      const accents = ['#ff7a1a', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#14b8a6'];
      cfg.accent = accents[this.project.robots.length % accents.length];
      const def = { id: uid('r'), config: cfg, spawn: { x, y: 0, z, yaw: 0 }, code: 'beim start\n  \nende\n', layout: [] };
      this.project.robots.push(def);
      app.docs.set(def.id, new ProgramDoc(def.code, []));
      app.buildWorld();
      app.selectRobot(def.id);
      app.renderRobotsBar();
    } else {
      const spec = { type: t, x, z };
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
        if (this.project.robots.length < 2) { toast('Ein Roboter muss bleiben.'); return; }
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
