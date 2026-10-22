// Missionsübersicht, Missionskarte in der 3D-Ansicht und Erfolgsdialog
import { h, clear, fmtNum } from '../core/util.js';
import { icon } from '../core/icons.js';
import { MISSIONS, CHAPTERS } from '../missions/missions.js';
import { ROBOT_TYPES } from '../robots/parts.js';
import { Store } from '../core/store.js';
import { modal, closeModal, toast } from './dialogs.js';

const starSvg = (on, cls = 'star') => `<svg class="${cls} ${on ? 'on' : 'off'}" viewBox="0 0 24 24"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
export const stars = (n, max = 3) => Array.from({ length: max }, (_, i) => starSvg(i < n)).join('');

export class MissionsScreen {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('missions');
  }

  show() {
    this.render();
    this.el.classList.add('on');
  }
  hide() { this.el.classList.remove('on'); }

  render() {
    clear(this.el);
    const wrap = h('div.wrap');
    const back = h('button.btn', { html: icon('back') + '<span>Zurück</span>' });
    back.addEventListener('click', () => { this.hide(); if (this.app.screen !== 'bench') this.app.home.show(); });
    let total = 0;
    for (const m of MISSIONS) total += (Store.progress(m.id) || {}).stars || 0;
    wrap.appendChild(h('header', back, h('h2', 'Missionen'), h('div.sum', { html: starSvg(true) + `<b>${total}</b> von ${MISSIONS.length * 3}` })));
    for (const ch of CHAPTERS) {
      wrap.appendChild(h('div.chapter', h('h3', `Kapitel ${ch.id} · ${ch.title}`), h('span', ch.sub)));
      const grid = h('div.grid');
      for (const m of MISSIONS.filter((x) => x.chapter === ch.id)) {
        const p = Store.progress(m.id) || {};
        const idx = MISSIONS.indexOf(m) + 1;
        const types = m.robotDefs ? [...new Set(m.robotDefs.map((d) => d.config.type))] : [m.robot];
        const card = h('button.mcard',
          h('div.top', h('span.num', String(idx).padStart(2, '0')), h('span.rt', { html: types.map((t) => icon(t)).join('') + ' ' + types.map((t) => ROBOT_TYPES[t].name).join(' + ') })),
          h('h4', m.title),
          h('p', m.brief),
          h('div.foot', h('span.stars', { html: stars(p.stars || 0) }), h('span.lvl', '●'.repeat(m.level) + '○'.repeat(3 - m.level))));
        card.addEventListener('click', () => this.app.openMission(m.id));
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
    }
    this.el.appendChild(wrap);
  }

  successModal(m, n, t, stmts, prev) {
    const i = MISSIONS.indexOf(m);
    const next = MISSIONS[i + 1];
    const body = h('div',
      h('div.big-stars', { html: [1, 2, 3].map((k) => starSvg(k <= n)).join('') }),
      h('p', { style: { textAlign: 'center' } }, `Geschafft in ${fmtNum(t, 1)} Sekunden mit ${stmts} Anweisung${stmts === 1 ? '' : 'en'}.`),
      h('p.muted', { style: { textAlign: 'center', fontSize: '13.5px' } },
        n < 3 ? (t > m.par.time * 1.3 ? `Für den zweiten Stern: schneller als ${Math.round(m.par.time * 1.3)} s (Tipp: „tempo“). ` : '') + (stmts > m.par.stmts ? `Für den dritten Stern: höchstens ${m.par.stmts} Anweisungen.` : '') : 'Perfekt – alle drei Sterne!'),
      prev && prev.stars > n ? h('p.muted', { style: { textAlign: 'center' } }, `Dein Rekord bleibt bei ${prev.stars} Sternen.`) : null);
    modal({
      title: 'Mission erfüllt!',
      body,
      actions: [
        { label: 'Übersicht', ghost: true, run: () => this.app.showMissions() },
        { label: 'Nochmal', icon: 'reset', run: () => this.app.resetWorld() },
        next ? { label: 'Nächste Mission', icon: 'chev', primary: true, run: () => this.app.openMission(next.id) } : { label: 'Zur Sandbox', primary: true, run: () => this.app.home.newSandbox() },
      ],
    });
  }
}

export class MissionCard {
  constructor(app) {
    this.app = app;
    this.el = h('div#mission-card.ov.hidden');
    this.hintsShown = 0;
  }

  show(m) {
    this.m = m;
    this.hintsShown = 0;
    this.el.classList.remove('hidden');
    this.render();
  }
  hide() { this.el.classList.add('hidden'); this.m = null; }
  reset() { this.res = null; this.render(); }

  render() {
    const m = this.m;
    if (!m) return;
    clear(this.el);
    const idx = 1 + MISSIONS.indexOf(m);
    const p = Store.progress(m.id) || {};
    const collapse = h('button.btn.icon.small.ghost.collapse', { html: icon(this.el.classList.contains('min') ? 'chevDown' : 'minus'), title: 'Einklappen' });
    collapse.addEventListener('click', () => { this.el.classList.toggle('min'); this.render(); });
    this.el.appendChild(h('h3', h('span.n', String(idx).padStart(2, '0')), m.title, h('span.stars', { html: stars(p.stars || 0) }), collapse));
    this.el.appendChild(h('p', m.story || m.brief));
    const ul = h('ul');
    m.goals.forEach((g, i) => {
      const done = this.res && this.res[i];
      ul.appendChild(h('li' + (done ? '.done' : ''), h('span.box', { html: done ? icon('check') : '' }), h('span', g.text)));
    });
    ul.appendChild(h('li', h('span.box', { style: { borderStyle: 'dashed' } }), h('span.muted', `★★ unter ${Math.round(m.par.time * 1.3)} s · ★★★ mit höchstens ${m.par.stmts} Anweisungen`)));
    this.el.appendChild(ul);
    const hint = h('button.btn.small', { html: icon('bulb') + '<span>Tipp</span>' });
    hint.addEventListener('click', () => this.hint());
    const sol = h('button.btn.small.ghost', { html: icon('sparkles') + '<span>Lösung</span>' });
    sol.addEventListener('click', () => this.solution());
    const row = h('div.row', hint, this.hintsShown >= m.hints.length ? sol : null);
    this.timeEl = h('span.muted', { style: { marginLeft: 'auto', alignSelf: 'center', fontSize: '13px', fontVariantNumeric: 'tabular-nums' } }, this.time != null ? fmtNum(this.time, 1) + ' s' : '');
    row.appendChild(this.timeEl);
    this.el.appendChild(row);
  }

  update(res, t) {
    const changed = !this.res || res.some((v, i) => v !== this.res[i]);
    this.res = res;
    this.time = t;
    if (changed) this.render();
    else if (this.timeEl) this.timeEl.textContent = fmtNum(t, 1) + ' s';
  }

  success(n) {
    this.el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 500 });
    void n;
    this.render();
  }

  hint() {
    const m = this.m;
    const i = Math.min(this.hintsShown, m.hints.length - 1);
    toast('Tipp: ' + m.hints[i], '', 6000);
    this.app.log('Tipp: ' + m.hints[i], 'sys');
    this.hintsShown = Math.min(m.hints.length, this.hintsShown + 1);
    this.render();
  }

  solution() {
    const m = this.m;
    const sols = m.solutions || [m.solution];
    const body = h('div', h('p', 'So könnte eine Lösung aussehen. Du kannst sie übernehmen – oder nur abschauen und es selbst bauen.'), ...sols.map((s, i) => h('div', sols.length > 1 ? h('b', (m.robotDefs[i].config.name || '') + ':') : null, h('pre.code', s))));
    modal({
      title: 'Musterlösung', body, wide: true,
      actions: [{ label: 'Schließen', ghost: true }, {
        label: 'Übernehmen', primary: true, run: () => {
          const app = this.app;
          sols.forEach((s, i) => { const d = app.project.robots[i]; if (d) { const doc = app.docs.get(d.id); doc.layout = []; doc.setText(s, 'solution'); } });
          app.loadEditors();
          app.autosave();
          closeModal();
          toast('Lösung übernommen – drück auf Start!', 'ok');
        },
      }],
    });
  }
}
