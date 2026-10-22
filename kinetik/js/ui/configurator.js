// Konfigurator („Bauen“): Robotertyp, Motoren, Greifer, Sensoren, Akku und Lackierung.
import { h, clear, fmtNum } from '../core/util.js';
import { icon } from '../core/icons.js';
import { ROBOT_TYPES, MOTORS, GRIPPERS, ARM_LENGTHS, BATTERIES, BALANCE, HEADS, WHEELS, SENSORS, SHELL_COLORS, ACCENT_COLORS, DEFAULT_CONFIGS, withDefaults } from '../robots/parts.js';

export class Configurator {
  constructor(app) {
    this.app = app;
    this.el = h('div.pane.scroll.cfg');
  }

  get def() { return this.app.currentDef(); }

  change(patch, full = false) {
    const def = this.def;
    if (!def) return;
    def.config = full ? withDefaults(patch) : withDefaults({ ...def.config, ...patch });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.app.stopProgram();
      this.app.buildWorld();
      this.app.renderRobotsBar();
      this.app.blockEd.renderPalette();
      this.app.autosave();
      this.render();
    }, 120);
    this.render();
  }

  render() {
    const def = this.def;
    clear(this.el);
    if (!def) { this.el.appendChild(h('p.muted', 'Kein Roboter ausgewählt.')); return; }
    const c = def.config;
    const app = this.app;
    const locked = !!app.mission;

    if (locked) this.el.appendChild(h('div.lockinfo', 'In dieser Mission ist der Robotertyp festgelegt – Teile, Sensoren und Farben kannst du aber frei tauschen.'));

    this.el.appendChild(h('h3', 'Robotertyp'));
    const types = h('div.types');
    for (const [id, t] of Object.entries(ROBOT_TYPES)) {
      const b = h('button.opt' + (c.type === id ? '.on' : '') + (locked && c.type !== id ? '.locked' : ''), { html: icon(id, 'big') + `<b>${t.name}</b><small>${t.short}</small>` });
      b.addEventListener('click', () => { if (c.type !== id) this.change({ ...DEFAULT_CONFIGS[id], name: DEFAULT_CONFIGS[id].name, shell: c.shell, accent: c.accent }, true); });
      types.appendChild(b);
    }
    this.el.appendChild(types);

    this.el.appendChild(h('h3', 'Name'));
    const name = h('input', { type: 'text', value: c.name || '', maxlength: 20, autocapitalize: 'words', autocorrect: 'off' });
    name.addEventListener('change', () => { def.config.name = name.value.trim() || ROBOT_TYPES[c.type].name; app.renderRobotsBar(); app.buildWorld(); app.autosave(); });
    this.el.appendChild(h('div.namebox', name));

    this.group('Motoren', MOTORS, c.motor, (k) => this.change({ motor: k }), (m) => m.desc);
    if (c.type === 'arm') {
      this.group('Armlänge', ARM_LENGTHS, c.laenge, (k) => this.change({ laenge: k }), (m) => m.desc);
      this.group('Greifer', GRIPPERS, c.greifer, (k) => this.change({ greifer: k }), (m) => m.desc);
    }
    if (c.type === 'humanoid') {
      this.group('Gleichgewicht', BALANCE, c.gyro, (k) => this.change({ gyro: k }), (m) => m.desc);
      this.group('Kopf', HEADS, c.kopf, (k) => this.change({ kopf: k }), (m) => m.desc);
      this.group('Hände', { zange: GRIPPERS.zange, sauger: GRIPPERS.sauger }, c.greifer === 'sauger' ? 'sauger' : 'zange', (k) => this.change({ greifer: k }), (m) => m.desc);
    }
    if (c.type === 'rover') {
      this.group('Räder', WHEELS, c.raeder, (k) => this.change({ raeder: k }), (m) => m.desc);
      this.group('Aufsatz', { keiner: { name: 'Ohne', desc: 'Leicht und wendig.' }, zange: { name: 'Frontzange', desc: 'Sammelt Würfel ein und liefert sie ab.' } }, c.greifer === 'zange' ? 'zange' : 'keiner', (k) => this.change({ greifer: k }), (m) => m.desc);
    }

    this.el.appendChild(h('h3', 'Sensoren'));
    const sens = h('div.sens');
    for (const [k, s] of Object.entries(SENSORS)) {
      if (s.robots && !s.robots.includes(c.type)) continue;
      const on = c.sensoren.includes(k);
      const b = h('button' + (on ? '.on' : ''), { html: icon(s.icon) + `<span>${s.name}</span>`, title: s.desc });
      b.addEventListener('click', () => {
        const list = on ? c.sensoren.filter((x) => x !== k) : [...c.sensoren, k];
        this.change({ sensoren: list });
      });
      sens.appendChild(b);
    }
    this.el.appendChild(sens);
    this.el.appendChild(h('p.muted', { style: { fontSize: '12.5px', margin: '8px 2px 0' } }, 'Tipp: Fehlt ein Sensor, meldet das Programm beim Ausführen, welchen du einbauen musst.'));

    this.group('Akku', BATTERIES, c.akku, (k) => this.change({ akku: k }), (b) => isFinite(b.wh) ? `${fmtNum(b.mass, 2)} kg – hält länger, macht aber schwerer.` : 'Kabel statt Akku: unbegrenzt, für Experimente.');

    this.el.appendChild(h('h3', 'Lackierung'));
    const sw1 = h('div.swatches');
    for (const s of SHELL_COLORS) {
      const b = h('button' + (c.shell === s.hex ? '.on' : ''), { style: { background: s.hex }, title: s.name, 'aria-label': s.name });
      b.addEventListener('click', () => this.change({ shell: s.hex }));
      sw1.appendChild(b);
    }
    const sw2 = h('div.swatches', { style: { marginTop: '10px' } });
    for (const s of ACCENT_COLORS) {
      const b = h('button' + (c.accent === s.hex ? '.on' : ''), { style: { background: s.hex }, title: s.id, 'aria-label': s.id });
      b.addEventListener('click', () => this.change({ accent: s.hex }));
      sw2.appendChild(b);
    }
    this.el.append(sw1, sw2);

    // Datenblatt
    const r = app.currentRobot();
    if (r) {
      const sp = r.specs();
      const sheet = h('div.sheet');
      const cell = (k, v) => sheet.appendChild(h('div', h('span', k), h('b', v)));
      cell('Masse', fmtNum(sp.mass, 1) + ' kg');
      cell('Gelenke', String(sp.joints));
      if (r.type === 'arm') {
        cell('Reichweite', Math.round((r.L1 + r.L2) * 100 + 15) + ' cm');
        const g = r.grippers.main;
        const hold = g.type === 'zange' ? 2 * Math.sqrt(1.15 * 0.6) * g.maxForce : g.maxForce;
        cell('Traglast', '≈ ' + fmtNum(hold / 9.81, 1) + ' kg');
        cell('Schulter', Math.round(r.servos.get('schulter').maxForce) + ' Nm');
      }
      if (r.type === 'humanoid') {
        cell('Größe', '1,42 m');
        cell('Gyro', r.gyro.torque ? r.gyro.torque + ' Nm' : '–');
        cell('Knie', Math.round(r.servos.get('knie_l').maxForce) + ' Nm');
      }
      if (r.type === 'rover') {
        cell('Höchsttempo', '0,6 m/s');
        cell('Raddurchm.', Math.round(r.R_W * 200) + ' cm');
      }
      cell('Akku', isFinite(r.battery.wh) ? r.battery.wh + ' Wh' : 'Netz');
      cell('Sensoren', String(Object.keys(r.sensors).length));
      this.el.appendChild(h('h3', 'Datenblatt'));
      this.el.appendChild(sheet);
    }
  }

  group(title, opts, cur, pick, desc) {
    this.el.appendChild(h('h3', title));
    const box = h('div.opts');
    for (const [k, o] of Object.entries(opts)) {
      const b = h('button.opt' + (cur === k ? '.on' : ''), h('b', o.name), h('small', desc ? desc(o) : ''));
      b.addEventListener('click', () => { if (cur !== k) pick(k); });
      box.appendChild(b);
    }
    this.el.appendChild(box);
  }
}
