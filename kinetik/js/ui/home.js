// Startbildschirm mit lebendiger Demo-Szene, Sandbox-Vorlagen und Projektliste
import * as THREE from 'three';
import { h, clear, uid } from '../core/util.js';
import { icon, LOGO } from '../core/icons.js';
import { Store } from '../core/store.js';
import { MISSIONS, MISSION_BY_ID } from '../missions/missions.js';
import { DEFAULT_CONFIGS, withDefaults } from '../robots/parts.js';
import { modal, closeModal, confirmBox, toast } from './dialogs.js';
import { ProgramDoc } from './program.js';

export const TEMPLATES = [
  {
    id: 'leer', name: 'Leere Werkstatt', desc: 'Ein Humanoid und viel Platz.', icon: 'humanoid',
    make: () => ({ robots: [robot('humanoid', { x: 0, z: 0 })], objects: [{ type: 'würfel', x: 0.5, z: 0.6, color: 'rot' }, { type: 'kugel', x: -0.5, z: 0.7, color: 'blau' }] }),
  },
  {
    id: 'fabrik', name: 'Fabrikhalle', desc: 'Arm, Förderband, Spender, Lichtschranke und Kisten.', icon: 'conveyor',
    make: () => ({
      robots: [robot('arm', { x: 0, z: 0 }, 'band an\n  wiederhole immer\n    warte bis lichtschranke unterbrochen\n    warte 0.2\n    band aus\n    bewege greifer zu -6, 30, 45\n    f = farbe\n    nimm f\n    lege ab auf f\n    band an\n  ende')],
      objects: [
        { type: 'band', x: -0.05, z: 0.45, l: 1.3, w: 0.18, h: 0.12, speed: 40, on: false, yaw: Math.PI },
        { type: 'spender', x: 0.48, z: 0.45, colors: ['rot', 'blau', 'gelb', 'blau', 'rot', 'gelb'], max: 12, interval: 3 },
        { type: 'lichtschranke', x: 0.05, z: 0.45, w: 0.28, h: 0.15, yaw: Math.PI / 2 },
        { type: 'kiste', x: -0.42, z: 0.05, color: 'rot' }, { type: 'kiste', x: 0.4, z: 0.0, color: 'blau' }, { type: 'kiste', x: 0.0, z: -0.42, color: 'gelb' },
      ],
    }),
  },
  {
    id: 'strecke', name: 'Rennstrecke', desc: 'Fahrroboter, Linie, Wände und ein Ziel.', icon: 'rover',
    make: () => {
      const pts = [];
      for (let i = 0; i <= 72; i++) { const a = (i / 72) * Math.PI * 2; pts.push([Math.cos(a) * 1.2 - 1.2, Math.sin(a) * 0.75]); }
      return {
        robots: [robot('rover', { x: 0, z: 0 }, 'wiederhole immer\n    wenn linie links dann\n      setze motoren auf 5, 45\n    sonst wenn linie rechts dann\n      setze motoren auf 45, 5\n    sonst\n      setze motoren auf 40, 40\n    ende\n  ende')],
        objects: [{ type: 'linie', points: pts }, { type: 'wand', x: 0.6, z: 1.0, w: 0.04, h: 0.25, d: 1.0 }, { type: 'ziel', x: -2.4, z: 0, color: 'grün' }, { type: 'rampe', x: 1.0, z: -0.6, w: 0.5, l: 0.8, h: 0.1 }],
      };
    },
  },
  {
    id: 'spielplatz', name: 'Spielplatz', desc: 'Humanoid, Tische, Bälle und eine Rampe.', icon: 'ball',
    make: () => ({
      robots: [robot('humanoid', { x: 0, z: 0 }, 'winke\n  nimm rot\n  gehe 40 zurück\n  wirf')],
      objects: [
        { type: 'tisch', x: 0.15, z: 0.85, w: 0.6, d: 0.45, h: 0.62 },
        { type: 'würfel', x: 0.18, y: 0.65, z: 0.78, color: 'rot' }, { type: 'würfel', x: 0.0, y: 0.65, z: 0.86, color: 'gelb' },
        { type: 'kugel', x: -0.6, z: 0.4, color: 'blau' }, { type: 'kugel', x: -0.8, z: 0.2, color: 'orange', r: 0.06 },
        { type: 'rampe', x: -0.9, z: 1.2, w: 0.5, l: 0.8, h: 0.15 }, { type: 'kiste', x: 0.9, z: -0.3, color: 'grün', w: 0.3, d: 0.3, h: 0.12 },
      ],
    }),
  },
  {
    id: 'team', name: 'Team aus drei', desc: 'Arm, Humanoid und Fahrroboter zusammen.', icon: 'robotAdd',
    make: () => ({
      robots: [robot('arm', { x: -0.6, z: 0.2, yaw: 0.6 }), robot('humanoid', { x: 0.2, z: 0 }), robot('rover', { x: 0.9, z: 0.3 })],
      objects: [{ type: 'würfel', x: -0.4, z: 0.6, color: 'rot' }, { type: 'würfel', x: -0.7, z: 0.65, color: 'blau' }, { type: 'zone', x: 0.2, z: 0.9, color: 'grün', w: 0.3, d: 0.3 }],
    }),
  },
];

function robot(type, spawn, body) {
  return { id: uid('r'), config: withDefaults({ ...DEFAULT_CONFIGS[type] }), spawn: { x: 0, y: 0, z: 0, yaw: 0, ...spawn }, code: 'beim start\n  ' + (body || '') + '\nende\n', layout: [] };
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
    let total = 0, done = 0;
    for (const m of MISSIONS) { const p = Store.progress(m.id); if (p) { total += p.stars || 0; if (p.done) done++; } }
    const next = MISSIONS.find((m) => !(Store.progress(m.id) || {}).done) || MISSIONS[0];
    const last = Store.setting('last', null);
    const btn = (ic, title, sub, cls, fn) => {
      const b = h('button.btn' + (cls ? '.' + cls : ''), { html: icon(ic) + `<span class="txt"><span>${title}</span><small>${sub}</small></span>` });
      b.addEventListener('click', fn);
      return b;
    };
    const actions = h('div.actions',
      btn('flag', done ? 'Weiter mit den Missionen' : 'Erste Mission starten', done ? `${done} von ${MISSIONS.length} geschafft · ${total} Sterne` : `„${next.title}“ – in zwei Minuten bewegt sich dein Roboter`, 'primary', () => app.openMission(next.id)),
      btn('grid', 'Alle Missionen', `${MISSIONS.length} Aufgaben in 4 Kapiteln`, '', () => app.showMissions()),
      btn('sparkles', 'Freie Sandbox', 'Eigene Welt bauen, mehrere Roboter, eigene Automationen', '', () => this.newSandbox()),
      Store.projects().length ? btn('folder', 'Meine Projekte', `${Store.projects().length} gespeichert`, '', () => this.projects()) : null);
    const content = h('div.content',
      h('div.logo', { html: LOGO + '<span>KINE<b>TIK</b></span>' }),
      h('h1', { html: 'Roboter bauen.<br><span>Programmieren.</span><br>Testen.' }),
      h('p.tag', 'Humanoide, Greifarme und Fahrroboter – mit echter Physik, Bausteinen und der Robotersprache Klartext.'),
      actions);
    void last;
    const foot = h('div.foot', h('div.badges', h('span.chip', { html: icon('keyboard') + 'Magic Keyboard' }), h('span.chip', { html: icon('pencil') + 'Apple Pencil' }), h('span.chip', { html: icon('hand') + 'Touch' })), h('span', 'Gemacht für Safari auf dem iPad'));
    this.el.append(h('div.scrim'), content, foot);
  }

  // Lebendige Szene im Hintergrund
  buildDemo() {
    const app = this.app;
    const project = {
      kind: 'demo',
      robots: [
        { id: 'd1', config: withDefaults({ ...DEFAULT_CONFIGS.humanoid, accent: '#ff7a1a', kopf: 'visier' }), spawn: { x: -0.35, y: 0, z: 0.25, yaw: 0.25 }, code: 'beim start\n  warte 1\n  wiederhole immer\n    winke\n    warte 2\n    drehe kopf auf 30\n    warte 1.5\n    drehe kopf auf -20\n    warte 1\n    drehe kopf auf 0\n    warte 2\n  ende\nende\n' },
        { id: 'd2', config: withDefaults({ ...DEFAULT_CONFIGS.arm, accent: '#3b82f6' }), spawn: { x: 0.75, y: 0.4, z: -0.15, yaw: -0.4 }, code: 'beim start\n  tempo 45\n  wiederhole immer\n    nimm rot\n    lege ab auf blau\n    nimm rot\n    lege ab bei 25, 0, 40\n  ende\nende\n' },
        { id: 'd3', config: withDefaults({ ...DEFAULT_CONFIGS.rover, accent: '#22c55e' }), spawn: { x: -1.3, y: 0, z: -0.4, yaw: 1.2 }, code: 'beim start\n  tempo 40\n  wiederhole immer\n    fahre 50 cm vor\n    drehe dich um 120 nach links\n  ende\nende\n' },
      ],
      objects: [
        { type: 'tisch', x: 0.85, z: 0.1, w: 0.8, d: 0.7, h: 0.4, yaw: -0.4 },
        { type: 'würfel', x: 0.7, y: 0.43, z: 0.32, color: 'rot' },
        { type: 'würfel', x: 1.0, y: 0.43, z: 0.2, color: 'blau', yaw: 0.4 },
        { type: 'kugel', x: -0.9, z: 0.7, color: 'gelb' },
        { type: 'würfel', x: -0.75, z: 0.9, color: 'grün', yaw: 0.7 },
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
    app.cam.lookAt(new THREE.Vector3(-0.75, 0.62, 0.35), 3.4, 0.35, 0.2);
    app.cam.jump();
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    // Kamera wandert sanft
    const c = this.app.cam;
    c.goal.yaw = 0.35 + Math.sin(this.t * 0.08) * 0.35;
  }

  newSandbox() {
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' } });
    for (const t of TEMPLATES) {
      const b = h('button.mcard', { style: { minHeight: '120px' } }, h('div.top', h('span', { html: icon(t.icon) })), h('h4', t.name), h('p', t.desc));
      b.addEventListener('click', () => {
        closeModal();
        const made = t.make();
        const p = { id: uid('p'), kind: 'sandbox', name: t.name, robots: made.robots, objects: made.objects, created: Date.now() };
        Store.saveProject(p);
        this.app.openSandbox(p);
      });
      grid.appendChild(b);
    }
    modal({ title: 'Neue Sandbox', body: h('div', h('p', 'Wähle eine Vorlage – alles lässt sich danach umbauen.'), grid), wide: true, actions: [{ label: 'Abbrechen', ghost: true }] });
  }

  projects() {
    const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    const fill = () => {
      clear(list);
      const ps = Store.projects();
      if (!ps.length) list.appendChild(h('p.muted', 'Noch keine Projekte gespeichert.'));
      for (const p of ps) {
        const open = h('button.btn', { style: { flex: 1, justifyContent: 'flex-start' }, html: icon('folder') + `<span>${p.name}</span><small class="muted" style="margin-left:auto">${new Date(p.updated || 0).toLocaleDateString('de-DE')}</small>` });
        open.addEventListener('click', () => { closeModal(); this.app.openSandbox(Store.project(p.id)); });
        const del = h('button.btn.icon.danger', { html: icon('trash'), title: 'Löschen' });
        del.addEventListener('click', async () => { if (await confirmBox('Projekt löschen?', `„${p.name}“ wird endgültig gelöscht.`, 'Löschen', true)) { Store.deleteProject(p.id); this.projects(); } });
        list.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, open, del));
      }
    };
    fill();
    const imp = h('button.btn', { html: icon('upload') + '<span>Datei importieren</span>' });
    imp.addEventListener('click', () => this.importFile());
    modal({ title: 'Meine Projekte', body: h('div', list, h('div', { style: { marginTop: '12px' } }, imp)), wide: true, actions: [{ label: 'Schließen', ghost: true }] });
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
          Store.saveProject(p);
          closeModal();
          this.app.openSandbox(p);
          toast('Projekt importiert.', 'ok');
        } catch { toast('Diese Datei ist kein KINETIK-Projekt.', 'err'); }
      });
    });
    inp.click();
  }

  // Kurze Einführung beim ersten Missionsstart
  tour() {
    const app = this.app;
    if (app.mode !== 'blocks') app.setMode('blocks');
    app.showTab('program');
    const steps = [
      { el: () => app.blockEd.rail, title: 'Die Palette', text: 'Hier liegen alle Bausteine – nach Farben sortiert. Tippe eine Kategorie an und ziehe einen Baustein nach rechts.' },
      { el: () => app.blockEd.ws, title: 'Dein Programm', text: 'Bausteine rasten untereinander ein. Antippen probiert einen Stapel sofort aus. Lange drücken öffnet das Menü.' },
      { el: () => app.runBtn, title: 'Start', text: 'Startet das Programm. Mit dem Magic Keyboard geht das auch mit ⌘↩. „Zurücksetzen“ baut die Welt neu auf.' },
      { el: () => app.viewEl, title: 'Die Welt', text: 'Alles hier ist echte Physik. Ein Finger dreht die Kamera, zwei zoomen. Würfel und Roboter kannst du anfassen und schubsen!' },
      { el: () => app.missionCard.el, title: 'Deine Mission', text: 'Hier steht, was zu tun ist. Häkchen erscheinen von allein. Mit „Tipp“ bekommst du Hilfe.' },
    ];
    let i = 0;
    const spot = h('div.tour-spot');
    const box = h('div.tour');
    document.body.append(spot, box);
    const end = () => { spot.remove(); box.remove(); Store.setSetting('seenIntro', true); };
    const showStep = () => {
      const s = steps[i];
      const r = s.el().getBoundingClientRect();
      Object.assign(spot.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
      clear(box);
      const next = h('button.btn.primary', i === steps.length - 1 ? 'Los geht’s' : 'Weiter');
      next.addEventListener('click', () => { i++; if (i >= steps.length) end(); else showStep(); });
      const skip = h('button.btn.ghost', 'Überspringen');
      skip.addEventListener('click', end);
      box.append(h('h4', s.title), h('p', s.text), h('div.acts', h('span', `${i + 1} / ${steps.length}`), skip, next));
      let x = r.right + 16, y = r.top;
      if (x + 330 > innerWidth) x = Math.max(12, r.left - 340);
      if (x < 12) { x = Math.min(innerWidth - 332, r.left); y = r.bottom + 14; }
      if (y + 180 > innerHeight) y = innerHeight - 200;
      box.style.left = x + 'px'; box.style.top = Math.max(12, y) + 'px';
    };
    setTimeout(showStep, 400);
  }
}

export { MISSION_BY_ID };
