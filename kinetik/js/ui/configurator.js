// Konfiguration: Grundgerät, Antriebe je Achsgruppe, Werkzeug, Sensorik, Signalgeber, Funk,
// Energie, Steuerung und Lackierung – mit Kennzahlen und Stückliste. Alle Module sind Plug & Play:
// Sie werden am Feldbus automatisch erkannt, es muss nichts verkabelt oder eingerichtet werden.
import { h, clear, fmtNum, clamp } from '../core/util.js';
import { icon } from '../core/icons.js';
import {
  ROBOT_TYPES, DRIVES, DRIVE_GROUPS, ARM_LENGTHS, BALANCE, WHEELS, TOOLS, MODULES, RADIOS, ANTENNAS, BATTERIES, CONTROLLERS,
  SHELL_COLORS, ACCENT_COLORS, DEFAULT_CONFIGS, withDefaults, bom, computeLoad, idlePower, fmtEuro,
} from '../robots/parts.js';

const MOTION_W = { arm: 70, humanoid: 190, rover: 45 };

export class Configurator {
  constructor(app) {
    this.app = app;
    this.el = h('div.pane.scroll.cfg');
    this.open = new Set(['struktur', 'antrieb', 'sensorik']);
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
      if (this.app.devices && this.app.devices.visible) this.app.devices.render();
    }, 120);
    this.render();
  }

  render() {
    const def = this.def;
    const keep = this.el.scrollTop;
    clear(this.el);
    if (!def) { this.el.appendChild(h('p.muted', { style: { padding: '14px' } }, 'Kein Roboter ausgewählt.')); return; }
    const c = def.config;
    const app = this.app;
    const locked = !!app.mission;
    const t = ROBOT_TYPES[c.type];
    const b = bom(c);
    const budget = app.mission && app.mission.budget;

    // Kopf: Name, Preis, Kennzahlen
    const name = h('input', { type: 'text', value: c.name || '', maxlength: 20, autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false' });
    name.addEventListener('change', () => { def.config.name = name.value.trim() || t.name; app.renderRobotsBar(); app.buildWorld(); app.autosave(); });
    const over = budget && b.total > budget;
    const head = h('div.cfghead',
      h('div.nm', h('span', { html: icon(c.type) }), name),
      h('div.price', h('b', { style: over ? { color: 'var(--err)' } : null }, fmtEuro(b.total)), h('span', budget ? `Listenpreis · Budget ${fmtEuro(budget)}` : 'Listenpreis netto')),
      this.kpis(c));
    this.el.appendChild(head);
    if (locked) this.el.appendChild(h('div.lockinfo', `Grundgerät durch den Prüfauftrag festgelegt (${t.label}). Antriebe, Werkzeug, Module, Funk und Energie sind frei wählbar.`));

    // Grundgerät
    this.section('struktur', 'Grundgerät', 'robotAdd', `${t.label} ${t.name}`, (body) => {
      const types = h('div.types');
      for (const [id, tt] of Object.entries(ROBOT_TYPES)) {
        const btn = h('button.opt' + (c.type === id ? '.on' : '') + (locked && c.type !== id ? '.locked' : ''), { html: icon(id, 'big') + `<b>${tt.name}</b><small>${tt.label}</small><small class="model">${fmtEuro(tt.price)}</small>` });
        btn.addEventListener('click', () => { if (c.type !== id) this.change({ ...DEFAULT_CONFIGS[id], lack: c.lack, akzent: c.akzent }, true); });
        types.appendChild(btn);
      }
      body.appendChild(types);
      if (c.type === 'arm') this.choice(body, 'Baugröße', ARM_LENGTHS, c.laenge, (k) => this.change({ laenge: k }), (o) => ({ model: `L1 ${Math.round(o.l1 * 100)} cm · L2 ${Math.round(o.l2 * 100)} cm`, desc: o.desc, price: o.price, sign: true }));
      if (c.type === 'humanoid') this.choice(body, 'Balanceregelung', BALANCE, c.gyro, (k) => this.change({ gyro: k }), (o) => ({ model: o.model + (o.torque ? ` · ${o.torque} Nm` : ''), desc: o.desc, price: o.price }));
      if (c.type === 'rover') this.choice(body, 'Bereifung', WHEELS, c.raeder, (k) => this.change({ raeder: k }), (o) => ({ desc: o.desc, price: o.price }));
    });

    // Antriebe
    this.section('antrieb', 'Antriebe', 'motor', Object.values(c.antrieb).map((k) => DRIVES[k].name).filter((v, i, a) => a.indexOf(v) === i).join(' · '), (body) => {
      for (const [g, info] of Object.entries(DRIVE_GROUPS[c.type])) {
        const ref = DRIVES[info.ref];
        const opts = Object.fromEntries(info.options.map((k) => [k, DRIVES[k]]));
        this.choice(body, info.name, opts, c.antrieb[g], (k) => this.change({ antrieb: { ...c.antrieb, [g]: k } }), (d) => ({
          model: d.model, desc: d.desc, price: d.price * info.axes, priceNote: `${info.axes} × ${fmtEuro(d.price)}`,
          specs: [['Moment', `${fmtNum(d.torque / ref.torque * 100, 0)} %`], ['Drehzahl', `${fmtNum(d.speed / ref.speed * 100, 0)} %`], ['Steifigkeit', `${fmtNum(d.stiff / ref.stiff * 100, 0)} %`], ['Wirkungsgrad', `${Math.round(d.eff * 100)} %`], ['Masse', `${fmtNum(d.mass / ref.mass * 100, 0)} %`]],
        }));
      }
      body.appendChild(h('p.note', 'Werte relativ zum Referenzantrieb der Achsgruppe. Schwache oder ineffiziente Antriebe erwärmen sich unter Last und werden ab 90 °C gedrosselt.'));
    });

    // Werkzeug
    const tools = Object.fromEntries(Object.entries(TOOLS).filter(([, v]) => v.robots.includes(c.type)));
    this.section('werkzeug', c.type === 'rover' ? 'Aufbau' : 'Werkzeug', 'wrench', TOOLS[c.werkzeug].name, (body) => {
      this.choice(body, null, tools, c.werkzeug, (k) => this.change({ werkzeug: k }), (o) => ({ model: o.model, desc: o.desc, price: o.price * (c.type === 'humanoid' ? 2 : 1), specs: [o.force ? ['Greifkraft', `${fmtNum(o.force, 0)} N`] : null, ['Masse', `${fmtNum(o.mass, 2)} kg`]].filter(Boolean) }));
    });

    // Sensorik und Signalgeber
    const mods = (cat) => Object.entries(MODULES).filter(([, m]) => m.cat === cat && (!m.robots || m.robots.includes(c.type)));
    const sensSum = c.module.filter((m) => MODULES[m].cat === 'sensorik').map((m) => MODULES[m].name.replace('Industriekamera ', 'Kamera ')).join(' · ') || 'keine';
    this.section('sensorik', 'Sensorik', 'sensor', sensSum, (body) => this.multi(body, mods('sensorik'), c));
    const sigSum = c.module.filter((m) => MODULES[m].cat === 'signal').map((m) => MODULES[m].name).join(' · ') || 'Status-LED';
    this.section('signal', 'Signalgeber', 'bulb', sigSum, (body) => this.multi(body, mods('signal'), c));

    // Kommunikation
    this.section('funk', 'Kommunikation', 'antenna', c.funk === 'keins' ? 'ohne Funk' : `${RADIOS[c.funk].name} · ${ANTENNAS[c.antenne].name}`, (body) => {
      this.choice(body, 'Funkmodul', RADIOS, c.funk, (k) => this.change({ funk: k }), (r) => ({ model: r.model, desc: r.desc, price: r.price, specs: r.tech ? [['Sendeleistung', `${r.ptx} dBm`], ['Empfindlichkeit', `${r.sens} dBm`], ['Latenz', `${Math.round(r.latency * 1000)} ms`]] : [] }));
      if (c.funk !== 'keins') this.choice(body, 'Antenne', ANTENNAS, c.antenne, (k) => this.change({ antenne: k }), (a) => ({ model: `${a.gain} dBi${a.beam ? ` · ${a.beam}° Keule` : ' · rundstrahlend'}`, desc: a.desc, price: a.price }));
      body.appendChild(h('p.note', 'Nachrichten kommen nur an, wenn beide Geräte dieselbe Funktechnik nutzen und der Empfangspegel über der Empfindlichkeit liegt. Wände dämpfen je nach Material und Frequenz.'));
    });

    // Energie und Steuerung
    const load = computeLoad(c);
    this.section('energie', 'Energie und Steuerung', 'battery', `${BATTERIES[c.akku].name} · ${CONTROLLERS[c.steuerung].name}`, (body) => {
      this.choice(body, 'Energieversorgung', BATTERIES, c.akku, (k) => this.change({ akku: k }), (o) => ({ model: o.model, desc: o.desc, price: o.price, specs: [['Masse', `${fmtNum(o.mass, 1)} kg`]] }));
      this.choice(body, 'Steuerung', CONTROLLERS, c.steuerung, (k) => this.change({ steuerung: k }), (o) => ({ model: o.model, desc: o.desc, price: o.price, specs: [['Rechenleistung', `${o.compute} E`], ['Leistung', `${o.power} W`], ['Auslastung', `${Math.round(load.need / o.compute * 100)} %`]] }));
      if (load.ratio > 1) body.appendChild(h('p.note', { style: { color: 'var(--err)' } }, `Rechenlast ${Math.round(load.ratio * 100)} % – Sensorik läuft mit reduzierter Bildrate. Stärkere Steuerung wählen oder Module entfernen.`));
    });

    // Lackierung
    this.section('lack', 'Lackierung', 'sliders', (SHELL_COLORS.find((x) => x.hex === c.lack) || { name: c.lack }).name, (body) => {
      body.appendChild(h('div.sub', 'Gehäuse (RAL)'));
      const sw1 = h('div.swatches');
      for (const s of SHELL_COLORS) {
        const btn = h('button' + (c.lack === s.hex ? '.on' : ''), { style: { background: s.hex }, title: s.name, 'aria-label': s.name });
        btn.addEventListener('click', () => this.change({ lack: s.hex }));
        sw1.appendChild(btn);
      }
      body.appendChild(sw1);
      body.appendChild(h('div.sub', 'Statusanzeige'));
      const sw2 = h('div.swatches');
      for (const s of ACCENT_COLORS) {
        const btn = h('button' + (c.akzent === s.hex ? '.on' : ''), { style: { background: s.hex }, title: s.name, 'aria-label': s.name });
        btn.addEventListener('click', () => this.change({ akzent: s.hex }));
        sw2.appendChild(btn);
      }
      body.appendChild(sw2);
    });

    // Stückliste
    this.section('bom', 'Stückliste', 'list', `${b.rows.length} Positionen · ${fmtEuro(b.total)}`, (body) => {
      const tab = h('table.bom', h('tr', h('th', 'Pos.'), h('th', 'Komponente'), h('th.r', 'Menge'), h('th.r', 'Summe')));
      b.rows.forEach((r, i) => tab.appendChild(h('tr', h('td.r', String(i + 1).padStart(2, '0')), h('td', r.name, h('small', `${r.cat} · ${r.model}`)), h('td.r', String(r.qty)), h('td.r', fmtEuro(r.sum)))));
      tab.appendChild(h('tr.tot', h('td'), h('td', 'Gesamt netto'), h('td'), h('td.r', fmtEuro(b.total))));
      body.appendChild(tab);
      body.appendChild(h('p.note', 'Unverbindliche Listenpreise zur Orientierung – in KINETIK wird nichts berechnet.'));
    });
    this.el.scrollTop = keep;
  }

  kpis(c) {
    const r = this.app.currentRobot();
    const cell = (k, v, bad) => h('div', h('span', k), h('b' + (bad ? '.bad' : ''), v));
    const load = computeLoad(c);
    const bat = BATTERIES[c.akku];
    const p = idlePower(c) + MOTION_W[c.type];
    const out = [];
    if (r && r.config.type === c.type) {
      const sp = r.specs();
      out.push(cell('Masse', fmtNum(sp.mass, 1) + ' kg'));
      if (c.type === 'arm') {
        out.push(cell('Traglast', '≈ ' + fmtNum(this.armPayload(r), 1) + ' kg'));
        out.push(cell('Reichweite', Math.round((r.L1 + r.L2) * 100 + 15) + ' cm'));
      } else if (c.type === 'humanoid') {
        out.push(cell('Größe', '1,42 m'));
        out.push(cell('Balance', r.gyro.torque ? r.gyro.torque + ' Nm' : '–'));
      } else {
        out.push(cell('v max', fmtNum(r.vmax + 0.06, 2) + ' m/s'));
        out.push(cell('Rad Ø', Math.round(r.R_W * 2000) + ' mm'));
      }
    } else out.push(cell('Masse', '–'), cell('–', '–'), cell('–', '–'));
    out.push(cell('Rechenlast', Math.round(load.ratio * 100) + ' %', load.ratio > 1));
    out.push(cell('Laufzeit', isFinite(bat.wh) ? '≈ ' + fmtNum(bat.wh / p, 1) + ' h' : 'Netz'));
    return h('div.kpis', out);
  }

  // Grobe Traglast: Haltekraft des Werkzeugs und Moment der Schulterachse bei voller Ausladung
  armPayload(r) {
    const g = r.grippers.main;
    if (!g) return 0;
    const hold = g.type === 'zange' ? 2 * Math.sqrt(1.15 * 0.6) * g.maxForce : g.maxForce;
    const sh = r.servos.get('schulter');
    const m = (n) => { const p = r.parts.get(n); return p ? p.body.mass() : 0; };
    const self = (m('oberarm') * r.L1 / 2 + (m('unterarm') + m('handgelenk') + m('hand')) * (r.L1 + r.L2 / 2)) * 9.81;
    const reach = r.L1 + r.L2 + 0.1;
    const axis = Math.max(0, (sh.maxForce * 0.85 - self) / (9.81 * reach));
    return clamp(Math.min(hold / 9.81, axis), 0, 20);
  }

  section(id, title, ic, summary, fill) {
    const det = h('details.sec' + (this.open.has(id) ? '' : ''));
    if (this.open.has(id)) det.open = true;
    det.addEventListener('toggle', () => { if (det.open) this.open.add(id); else this.open.delete(id); });
    const body = h('div.secbody');
    det.append(h('summary', { html: icon(ic) + `<span>${title}</span><span class="sum">${summary}</span>` }), body);
    fill(body);
    this.el.appendChild(det);
  }

  // Einfachauswahl als Liste (Radio)
  choice(body, title, opts, cur, pick, info) {
    if (title) body.appendChild(h('div.sub', title));
    const list = h('div.list');
    for (const [k, o] of Object.entries(opts)) {
      const d = info ? info(o) : {};
      const price = d.price != null ? (d.price === 0 ? 'inkl.' : (d.sign && d.price > 0 ? '+' : '') + fmtEuro(d.price)) : '';
      const btn = h('button.opt' + (cur === k ? '.on' : ''),
        h('span.rd'),
        h('div', h('b', o.name), d.model ? h('span.model', d.model) : null, d.desc ? h('small', d.desc) : null),
        h('div.pr', price, d.priceNote ? h('small', d.priceNote) : null),
        d.specs && d.specs.length ? h('div.specs', d.specs.map(([a, v]) => h('span', a + ' ', h('b', v)))) : null);
      btn.addEventListener('click', () => { if (cur !== k) pick(k); });
      list.appendChild(btn);
    }
    body.appendChild(list);
  }

  // Mehrfachauswahl (Module); Gruppen schließen sich gegenseitig aus
  multi(body, entries, c) {
    const list = h('div.list');
    for (const [id, m] of entries) {
      const on = c.module.includes(id);
      const btn = h('button.opt.multi' + (on ? '.on' : ''),
        h('span.rd'),
        h('div', h('b', m.name), h('span.model', m.model), h('small', m.desc)),
        h('div.pr', fmtEuro(m.price)),
        h('div.specs', [['Leistung', `${m.power} W`], ['Rechenlast', `${m.compute || 0} E`], ['Masse', `${Math.round(m.mass * 1000)} g`]].map(([a, v]) => h('span', a + ' ', h('b', v))), on ? h('span.plug', { html: '● eingebunden · EtherCAT' }) : null));
      btn.addEventListener('click', () => {
        let list2 = c.module.filter((x) => x !== id);
        if (!on) { if (m.group) list2 = list2.filter((x) => MODULES[x].group !== m.group); list2.push(id); }
        this.change({ module: list2 });
      });
      list.appendChild(btn);
    }
    body.appendChild(list);
    body.appendChild(h('p.note', 'Plug & Play: Module werden am Feldbus automatisch erkannt und stehen sofort als Bausteine zur Verfügung – ohne Verkabelung oder Einrichtung.'));
  }
}
