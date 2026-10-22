// Startseite: Live-Szene der Testhalle, Einstieg in Prüfaufträge, neue Projekte aus Vorlagen, Projektliste
import * as THREE from 'three';
import { h, clear, uid } from '../core/util.js';
import { icon, LOGO } from '../core/icons.js';
import { Store } from '../core/store.js';
import { MISSIONS, MISSION_BY_ID } from '../missions/missions.js';
import { DEFAULT_CONFIGS, MODULES, withDefaults } from '../robots/parts.js';
import { modal, closeModal, confirmBox, toast } from './dialogs.js';
import { ProgramDoc } from './program.js';

export const TEMPLATES = [
  {
    id: 'leer', name: 'Leere Testfläche', desc: 'Ein KX-5 am Arbeitstisch – frei konfigurierbar.', icon: 'arm',
    make: () => ({ robots: [robot('arm', { x: 0, y: 0.4, z: 0 })], objects: [{ type: 'tisch', x: 0, z: 0.22, w: 1.3, d: 0.95, h: 0.4 }, { type: 'würfel', x: 0.15, y: 0.43, z: 0.42, color: 'rot' }, { type: 'würfel', x: -0.15, y: 0.43, z: 0.38, color: 'blau' }] }),
  },
  {
    id: 'zelle', name: 'Fertigungszelle', desc: 'Knickarm, Förderband, Teilezuführung, Lichtschranke, KLT und Schutzzaun.', icon: 'conveyor',
    make: () => ({
      robots: [robot('arm', { x: 0, z: 0 }, 'band an\n  signalsäule grün\n  wiederhole immer\n    warte bis lichtschranke unterbrochen\n    warte 0.2\n    band aus\n    bewege greifer zu -6, 30, 45\n    f = farbe\n    nimm f\n    lege ab auf f\n    band an\n  ende', { module: ['ultraschall', 'farbsensor', 'kamera', 'kontakt', 'signalsaeule'] })],
      objects: [
        { type: 'band', x: -0.05, z: 0.45, l: 1.3, w: 0.18, h: 0.12, speed: 40, on: false, yaw: Math.PI },
        { type: 'spender', x: 0.48, z: 0.45, colors: ['rot', 'blau', 'gelb', 'blau', 'rot', 'gelb'], max: 12, interval: 3 },
        { type: 'lichtschranke', x: 0.05, z: 0.45, w: 0.28, h: 0.15, yaw: Math.PI / 2 },
        { type: 'kiste', x: -0.42, z: 0.05, color: 'rot' }, { type: 'kiste', x: 0.4, z: 0.0, color: 'blau' }, { type: 'kiste', x: 0.0, z: -0.42, color: 'gelb' },
        { type: 'zaun', x: 0, z: -1.0, w: 2.2 }, { type: 'zaun', x: -1.1, z: 0.1, w: 2.2, yaw: Math.PI / 2 }, { type: 'zaun', x: 1.1, z: 0.1, w: 2.2, yaw: Math.PI / 2 },
      ],
    }),
  },
  {
    id: 'intralogistik', name: 'Intralogistik', desc: 'AMR mit LiDAR und Radar, Hindernisfeld, Routenzug auf dem Querweg.', icon: 'rover',
    make: () => ({
      robots: [robot('rover', { x: 0, z: -0.6 }, 'tempo 80\n  navigiere zu 0, 300', { module: ['ultraschall', 'farbsensor', 'linie', 'kontakt', 'kamera', 'lidar2d', 'radar', 'rundumleuchte'] })],
      objects: [
        { type: 'hindernis', variant: 'gitterbox', x: 0.1, z: 0.6 }, { type: 'hindernis', variant: 'karton', x: -0.7, z: 1.7 }, { type: 'hindernis', variant: 'pylon', x: 0.4, z: 2.2 },
        { type: 'markierung', x: 0, z: 3.9, w: 8, d: 1.0, t: 0.06 },
        { type: 'fahrzeug', x: -3.4, z: 3.9, path: [[-3.4, 3.9], [3.4, 3.9]], speed: 1.0, pause: 1.0 },
        { type: 'ziel', x: 0, z: 3.0, color: 'grün', r: 0.22, label: 'ZIEL 0 / 300' },
      ],
    }),
  },
  {
    id: 'lager', name: 'Lagerhalle', desc: 'Regalgasse, Palette und 5G-Kleinzelle für Funktests.', icon: 'rack',
    make: () => ({
      robots: [robot('rover', { x: 0, z: 0 }, 'tempo 70\n  navigiere zu 0, 400', { module: ['ultraschall', 'kontakt', 'kamera', 'lidar3d', 'rundumleuchte'], funk: 'g5', antenne: 'stab', steuerung: 'edge' })],
      objects: [
        { type: 'regal', x: -1.3, z: 2.0, w: 3.0, d: 0.7, yaw: Math.PI / 2 }, { type: 'regal', x: 1.3, z: 2.0, w: 3.0, d: 0.7, yaw: Math.PI / 2 },
        { type: 'hindernis', variant: 'palette', x: 0.45, z: 2.2 }, { type: 'basisstation', x: 2.6, z: 0.5 },
        { type: 'markierung', x: 0, z: 2.0, w: 1.9, d: 5.0, style: 'linien', t: 0.06 },
      ],
    }),
  },
  {
    id: 'verbund', name: 'Systemverbund', desc: 'Knickarm, Humanoid und mobile Plattform gemeinsam in einer Anlage.', icon: 'robotAdd',
    make: () => ({
      robots: [robot('arm', { x: -0.6, z: 0.2, yaw: 0.6 }), robot('humanoid', { x: 0.2, z: 0 }), robot('rover', { x: 0.9, z: 0.3 })],
      objects: [{ type: 'würfel', x: -0.4, z: 0.6, color: 'rot' }, { type: 'würfel', x: -0.7, z: 0.65, color: 'blau' }, { type: 'zone', x: 0.2, z: 0.9, color: 'grün', w: 0.3, d: 0.3 }],
    }),
  },
];

function robot(type, spawn, body, cfg) {
  return { id: uid('r'), config: withDefaults({ ...DEFAULT_CONFIGS[type], ...(cfg || {}) }), spawn: { x: 0, y: 0, z: 0, yaw: 0, ...spawn }, code: 'beim start\n  ' + (body || '') + '\nende\n', layout: [] };
}

export class Home {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('home');
    this.t = 0;
  }

  show() {
    const app = this.app;
    app.screen = 'home';
    this.render();
    this.el.classList.remove('hidden');
    this.buildDemo();
  }
  hide() { this.el.classList.add('hidden'); }

  render() {
    clear(this.el);
    const app = this.app;
    let done = 0;
    for (const m of MISSIONS) { const p = Store.progress(m.id); if (p && p.done) done++; }
    const next = MISSIONS.find((m) => !(Store.progress(m.id) || {}).done) || MISSIONS[0];
    const btn = (ic, title, sub, cls, fn) => {
      const b = h('button.btn' + (cls ? '.' + cls : ''), { html: icon(ic) + `<span class="txt"><span>${title}</span><small>${sub}</small></span>` + icon('chev', 'arrow') });
      b.addEventListener('click', fn);
      return b;
    };
    const nProj = Store.projects().length;
    const actions = h('div.actions',
      btn('clipboard', `${next.code} · ${next.title}`, done ? `${done} von ${MISSIONS.length} Prüfaufträgen bestanden` : 'Nächster offener Prüfauftrag', 'primary', () => app.openMission(next.id)),
      btn('list', 'Prüfaufträge', `${MISSIONS.length} Aufträge · Handhabung, Mobile Robotik, Humanoid, Systemintegration`, '', () => app.showMissions()),
      btn('plus', 'Neues Projekt', 'Freie Testfläche aus Vorlage', '', () => this.newSandbox()),
      btn('folder', 'Projekte', nProj ? `${nProj} gespeichert · Import aus Datei` : 'Keine gespeicherten Projekte · Import aus Datei', '', () => this.projects()));
    const nMods = Object.keys(MODULES).length;
    const content = h('div.content',
      h('div.logo', { html: LOGO + '<span>KINETIK</span><small>ROBOTIK-LABOR</small>' }),
      h('h1', { html: 'Roboter auslegen, programmieren und prüfen.<br><span>Physikalisch simuliert in der Testhalle.</span>' }),
      h('p.tag', 'Knickarm, Humanoid und autonome Plattform – mit wählbaren Antrieben, LiDAR, Radar, Kameras, Wärmebild und Funk. Abläufe als Bausteine oder Skript.'),
      h('div.stats', h('b', String(MISSIONS.length)), h('b', String(nMods)), h('b', '120 Hz'), h('span', 'Prüfaufträge'), h('span', 'Module'), h('span', 'Physiktakt')),
      actions);
    const foot = h('div.foot', h('div.badges', h('span.chip', { html: icon('keyboard') + 'Magic Keyboard' }), h('span.chip', { html: icon('pencil') + 'Apple Pencil' }), h('span.chip', { html: icon('hand') + 'Touch' })), h('span', 'Für Safari auf dem iPad'));
    this.el.append(h('div.scrim'), content, foot, h('div.ver', 'KINETIK 2.0 · Rapier 0.21 · three.js r186'));
  }

  // Live-Szene im Hintergrund: Zelle mit Arm, AMR mit LiDAR, Humanoid
  buildDemo() {
    const app = this.app;
    const project = {
      kind: 'demo',
      robots: [
        { id: 'd2', config: withDefaults({ ...DEFAULT_CONFIGS.arm, module: ['ultraschall', 'farbsensor', 'kamera', 'kontakt', 'signalsaeule'] }), spawn: { x: 0.75, y: 0.4, z: -0.15, yaw: -0.4 }, code: 'beim start\n  tempo 45\n  signalsäule grün\n  wiederhole immer\n    nimm rot\n    lege ab auf blau\n    nimm rot\n    lege ab bei 25, 0, 40\n  ende\nende\n' },
        { id: 'd1', config: withDefaults({ ...DEFAULT_CONFIGS.humanoid, module: ['ultraschall', 'kamera', 'kontakt', 'lidar3d'] }), spawn: { x: -0.35, y: 0, z: 0.25, yaw: 0.25 }, code: 'beim start\n  warte 1\n  wiederhole immer\n    drehe kopf auf 30\n    warte 1.5\n    drehe kopf auf -20\n    warte 1\n    drehe kopf auf 0\n    warte 3\n  ende\nende\n' },
        { id: 'd3', config: withDefaults({ ...DEFAULT_CONFIGS.rover, module: ['ultraschall', 'kontakt', 'kamera', 'lidar2d', 'rundumleuchte'] }), spawn: { x: -1.4, y: 0, z: -0.4, yaw: 1.2 }, code: 'beim start\n  tempo 40\n  wiederhole immer\n    fahre 50 cm vor\n    drehe dich um 120 nach links\n  ende\nende\n' },
      ],
      objects: [
        { type: 'tisch', x: 0.85, z: 0.1, w: 0.8, d: 0.7, h: 0.4, yaw: -0.4 },
        { type: 'würfel', x: 0.7, y: 0.43, z: 0.32, color: 'rot' },
        { type: 'kiste', x: 1.05, y: 0.4, z: 0.18, color: 'blau', w: 0.2, d: 0.2, yaw: -0.4 },
        { type: 'hindernis', variant: 'gitterbox', x: -2.2, z: 0.9, yaw: 0.3 },
        { type: 'zaun', x: 1.6, z: -0.6, w: 1.6, yaw: 1.2 },
        { type: 'markierung', x: 0.85, z: 0.1, w: 1.6, d: 1.5, t: 0.05 },
      ],
    };
    app.mission = null;
    app.project = project;
    app.docs.clear();
    for (const d of project.robots) app.docs.set(d.id, new ProgramDoc(d.code));
    app.currentId = 'd1';
    app.scenario.build(project);
    app.selected = null;
    app.scenario.start((def) => app.docs.get(def.id));
    app.cam.follow = null;
    app.cam.lookAt(new THREE.Vector3(-0.6, 0.62, 0.3), 3.6, 0.35, 0.22);
    app.cam.jump();
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const c = this.app.cam;
    c.goal.yaw = 0.35 + Math.sin(this.t * 0.07) * 0.35;
  }

  newSandbox() {
    const grid = h('div', { style: { display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' } });
    for (const t of TEMPLATES) {
      const b = h('button.mcard.tpl', h('span', { html: icon(t.icon) }), h('div', h('h4', t.name), h('p', t.desc)));
      b.addEventListener('click', () => {
        closeModal();
        const made = t.make();
        const p = { id: uid('p'), kind: 'sandbox', name: t.name, robots: made.robots, objects: made.objects, env: made.env || null, created: Date.now() };
        Store.saveProject(p);
        this.app.openSandbox(p);
      });
      grid.appendChild(b);
    }
    modal({ title: 'Neues Projekt', body: h('div', h('p', 'Vorlage wählen. Roboter, Module und Anlage lassen sich danach frei ändern.'), grid), wide: true, actions: [{ label: 'Abbrechen', ghost: true }] });
  }

  projects() {
    const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    const fill = () => {
      clear(list);
      const ps = Store.projects();
      if (!ps.length) list.appendChild(h('p.muted', 'Keine gespeicherten Projekte.'));
      for (const p of ps) {
        const open = h('button.btn', { style: { flex: 1, justifyContent: 'flex-start' }, html: icon('folder') + `<span>${p.name}</span><small class="muted mono" style="margin-left:auto">${new Date(p.updated || 0).toLocaleDateString('de-DE')}</small>` });
        open.addEventListener('click', () => { closeModal(); this.app.openSandbox(Store.project(p.id)); });
        const del = h('button.btn.icon.danger', { html: icon('trash'), title: 'Löschen' });
        del.addEventListener('click', async () => { if (await confirmBox('Projekt löschen?', `„${p.name}“ wird endgültig gelöscht.`, 'Löschen', true)) { Store.deleteProject(p.id); this.projects(); } });
        list.appendChild(h('div', { style: { display: 'flex', gap: '6px' } }, open, del));
      }
    };
    fill();
    const imp = h('button.btn', { html: icon('upload') + '<span>Datei importieren</span>' });
    imp.addEventListener('click', () => this.importFile());
    modal({ title: 'Projekte', body: h('div', list, h('div', { style: { marginTop: '12px' } }, imp)), wide: true, actions: [{ label: 'Schließen', ghost: true }] });
  }

  importFile() {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.addEventListener('change', () => {
      const f = inp.files[0];
      if (!f) return;
      f.text().then((t) => {
        try {
          const p = JSON.parse(t);
          if (!p.robots || !p.objects) throw new Error('Format');
          p.id = uid('p'); p.kind = 'sandbox';
          for (const r of p.robots) r.config = withDefaults(r.config);
          Store.saveProject(p);
          closeModal();
          this.app.openSandbox(p);
          toast('Projekt importiert.', 'ok');
        } catch { toast('Datei ist kein KINETIK-Projekt.', 'err'); }
      });
    });
    inp.click();
  }
}

export { MISSION_BY_ID };
