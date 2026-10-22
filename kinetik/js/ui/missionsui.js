// Prüfaufträge: Übersicht (Protokollliste), Prüfkarte in der 3D-Ansicht und Ergebnisprotokoll
import { h, clear, fmtNum } from '../core/util.js';
import { icon } from '../core/icons.js';
import { MISSIONS, CHAPTERS } from '../missions/missions.js';
import { ROBOT_TYPES, fmtEuro } from '../robots/parts.js';
import { Store } from '../core/store.js';
import { modal } from './dialogs.js';

const gradeBar = (n, max) => `<span class="grade">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
export const stars = (n, max = 3) => gradeBar(n, max);

export class MissionsScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('missions');
  }

  show() { this.render(); this.el.classList.add('on'); }
  hide() { this.el.classList.remove('on'); }

  render() {
    clear(this.el);
    const wrap = h('div.wrap');
    const back = h('button.btn', { html: icon('back') + '<span>Zurück</span>' });
    back.addEventListener('click', () => { this.hide(); if (this.app.screen !== 'bench') this.app.home.show(); });
    let done = 0;
    for (const m of MISSIONS) if ((Store.progress(m.id) || {}).done) done++;
    wrap.appendChild(h('header', back, h('h2', 'Prüfaufträge · Testhalle 2'), h('div.sum', h('span', h('b', String(done)), ` / ${MISSIONS.length} bestanden`))));
    for (const ch of CHAPTERS) {
      wrap.appendChild(h('div.chapter', h('h3', `${ch.code} · ${ch.title}`), h('span', ch.sub)));
      const grid = h('div.grid');
      for (const m of MISSIONS.filter((x) => x.chapter === ch.id)) {
        const p = Store.progress(m.id) || {};
        const types = m.robotDefs ? [...new Set(m.robotDefs.map((d) => d.config.type))] : [m.robot];
        const card = h('button.mcard',
          h('span.num', m.code),
          h('div', h('h4', m.title), h('p', m.brief)),
          h('span.rt', { html: types.map((t) => icon(t)).join('') + ' ' + types.map((t) => ROBOT_TYPES[t].name).join(' + ') }),
          h('span.state' + (p.done ? '.ok' : ''), h('i.led' + (p.done ? '.ok' : '')), p.done ? 'BESTANDEN' : 'OFFEN'),
          h('span.best', p.done ? `${fmtNum(p.best, 1)} s` : h('span.lvl', { html: [1, 2, 3].map((k) => `<i class="${k <= m.level ? 'on' : ''}"></i>`).join('') })));
        card.addEventListener('click', () => this.app.openMission(m.id));
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
    }
    this.el.appendChild(wrap);
  }

  successModal(m, res, grade, max, prev) {
    const i = MISSIONS.indexOf(m);
    const next = MISSIONS[i + 1];
    const cell = (k, v, ok, note) => h('div' + (ok ? '.good' : ''), h('span', k), h('b', v), h('small', note));
    const body = h('div',
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' } }, h('span.passbadge', { html: icon('check') + 'BESTANDEN' }), h('span.mono.muted', `${m.code} · ${new Date().toLocaleString('de-DE')}`)),
      h('div.result',
        cell('Zykluszeit', `${fmtNum(res.time, 1)} s`, res.okTime, `Ziel ≤ ${fmtNum(m.par.time * 1.3, 0)} s`),
        cell('Anweisungen', String(res.stmts), res.okStmts, `Ziel ≤ ${m.par.stmts}`),
        cell('Stückliste', fmtEuro(res.cost), m.budget ? res.okCost : false, m.budget ? `Budget ≤ ${fmtEuro(m.budget)}` : 'ohne Vorgabe')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('span.cap', 'Effizienz'), h('span', { html: gradeBar(grade, max) }), h('span.mono', `${grade} / ${max}`)),
      prev && prev.done && prev.best < res.time ? h('p.muted', { style: { marginTop: '8px' } }, `Bestzeit bleibt ${fmtNum(prev.best, 1)} s.`) : null);
    modal({
      title: m.title,
      body,
      actions: [
        { label: 'Übersicht', ghost: true, run: () => this.app.showMissions() },
        { label: 'Wiederholen', icon: 'reset', run: () => this.app.resetWorld() },
        next ? { label: `Weiter: ${next.code}`, icon: 'chev', primary: true, run: () => this.app.openMission(next.id) } : { label: 'Freie Testfläche', primary: true, run: () => this.app.home.newSandbox() },
      ],
    });
  }
}

export class MissionCard {
  constructor(app) {
    this.app = app;
    this.el = h('div#mission-card.ov.hidden');
  }

  show(m) {
    this.m = m;
    this.el.classList.remove('hidden');
    this.render();
  }
  hide() { this.el.classList.add('hidden'); this.m = null; }
  reset() { this.res = null; this.time = null; this.render(); }

  render() {
    const m = this.m;
    if (!m) return;
    clear(this.el);
    const min = this.el.classList.contains('min');
    const collapse = h('button.btn.icon.small.ghost', { html: icon(min ? 'chevDown' : 'minus'), title: min ? 'Ausklappen' : 'Einklappen' });
    collapse.addEventListener('click', () => { this.el.classList.toggle('min'); this.render(); });
    const p = Store.progress(m.id) || {};
    this.el.appendChild(h('div.mhead', h('span.id', m.code), h('b', m.title), p.done ? h('i.led.ok', { title: 'bestanden' }) : null, collapse));
    const body = h('div.mbody');
    body.appendChild(h('p', m.story || m.brief));
    const ul = h('ul');
    m.goals.forEach((g, i) => {
      const done = this.res && this.res[i];
      ul.appendChild(h('li' + (done ? '.done' : ''), h('span.box', { html: done ? icon('check') : '' }), h('span', g.text)));
    });
    body.appendChild(ul);
    this.timeEl = h('b', this.time != null ? fmtNum(this.time, 1) + ' s' : '–');
    body.appendChild(h('div.meta', h('span', 'Zeit ', this.timeEl), h('span', 'Ziel ', h('b', `≤ ${fmtNum(m.par.time * 1.3, 0)} s`)), h('span', 'Anw. ', h('b', `≤ ${m.par.stmts}`)), m.budget ? h('span', 'Budget ', h('b', fmtEuro(m.budget))) : null));
    this.el.appendChild(body);
  }

  update(res, t) {
    const changed = !this.res || res.some((v, i) => v !== this.res[i]);
    this.res = res;
    this.time = t;
    if (changed) this.render();
    else if (this.timeEl) this.timeEl.textContent = fmtNum(t, 1) + ' s';
  }

  success() {
    this.el.animate([{ boxShadow: '0 0 0 0 rgba(63,185,80,0)' }, { boxShadow: '0 0 0 3px rgba(63,185,80,.8)' }, { boxShadow: '0 0 0 0 rgba(63,185,80,0)' }], { duration: 900 });
    this.render();
  }
}
