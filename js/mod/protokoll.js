/* KYTHERA · Modul Protokoll */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.protokoll = {
    mount(el) {
      this.el = el;
      this.cat = '';
      this.q = '';
      el.innerHTML = KY.ui.head({ crumb: 'System', code: 'PR-16', title: 'Protokoll', sub: 'Lückenlose Aufzeichnung aller Vorgänge an Sitz IX gemäß Charta, Artikel IX. Einträge können nicht gelöscht werden.', act: '<button class="btn ghost" id="prCopy">' + KY.I('copy') + 'In Zwischenablage</button>' }) +
        '<div class="g g4" id="prKpi"></div>' +
        '<section class="pn mt12"><div class="pn-h"><input class="inp" id="prQ" placeholder="Protokoll durchsuchen …" style="height:26px;max-width:280px"><div class="tools"><span class="meta" id="prN"></span></div></div><div class="row wrap" style="gap:4px;padding:8px 12px;border-bottom:1px solid var(--line)" id="prCats"></div><div class="pn-b flush tbl-w" id="prTbl" style="max-height:calc(100vh - 380px);min-height:300px;overflow-y:auto"></div></section>';
      el.querySelector('#prQ').oninput = e => { this.q = e.target.value; this.rTbl(); };
      U.on(el, 'click', '[data-cat]', (e, b) => { this.cat = this.cat === b.dataset.cat ? '' : b.dataset.cat; this.rCats(); this.rTbl(); });
      el.querySelector('#prCopy').onclick = () => {
        const txt = this.rows().map(l => U.stamp(l.ts) + '\t' + (KY.CATS[l.cat] || l.cat) + '\t' + l.text).join('\n');
        U.copy(txt, el.querySelector('#prTbl')).then(ok => KY.ui.flashMsg(ok ? 'Protokoll kopiert' : 'Kopieren nicht möglich. Text wurde markiert.', ok ? 'ok' : 'info'));
      };
      this.sub = KY.bus.on('log', () => { this.dirty = true; });
      this.render();
    },
    unmount() { this.sub(); },
    tick() { if (this.dirty) { this.dirty = false; this.render(); } },
    render() { this.rKpi(); this.rCats(); this.rTbl(); },
    rows() {
      const q = U.norm(this.q);
      return KY.S.log.filter(l => (!this.cat || l.cat === this.cat) && (!q || U.norm(l.text).indexOf(q) >= 0)).slice().reverse();
    },
    rKpi() {
      const S = KY.S;
      U.setHTML(this.el.querySelector('#prKpi'),
        '<div class="kpi"><span class="lbl">Einträge</span><span class="v">' + S.log.length + '</span></div>' +
        '<div class="kpi"><span class="lbl">Sitzungszeit</span><span class="v">' + U.dur(S.t) + '</span></div>' +
        '<div class="kpi"><span class="lbl">Entscheidungen</span><span class="v">' + (S.stats.crises + S.stats.votes) + '</span><span class="dl mut">' + S.stats.crisesAuto + ' durch Fristablauf</span></div>' +
        '<div class="kpi"><span class="lbl">Amtsantritt</span><span class="v" style="font-size:17px">' + U.stamp(S.meta.created) + '</span></div>');
    },
    rCats() {
      const S = KY.S;
      const counts = {};
      S.log.forEach(l => { counts[l.cat] = (counts[l.cat] || 0) + 1; });
      U.setHTML(this.el.querySelector('#prCats'), Object.keys(KY.CATS).filter(k => counts[k]).map(k => '<button class="chip" data-cat="' + k + '"' + (this.cat === k ? ' style="border-color:var(--acc);color:var(--acc2)"' : '') + '>' + KY.CATS[k] + ' <span class="mono mut">' + counts[k] + '</span></button>').join(''));
    },
    rTbl() {
      const rows = this.rows();
      U.setText(this.el.querySelector('#prN'), rows.length + ' Einträge');
      U.setHTML(this.el.querySelector('#prTbl'), rows.length ? '<table class="tbl"><thead><tr><th>Zeitpunkt</th><th>Sitzung</th><th>Kategorie</th><th>Vorgang</th></tr></thead><tbody>' + rows.slice(0, 400).map(l => '<tr><td class="mono small nowrap">' + U.stamp(l.ts) + '</td><td class="mono small mut">' + U.dur(l.t) + '</td><td>' + C.pill(KY.CATS[l.cat] || l.cat, l.cat === 'kri' ? 'crit' : l.cat === 'kur' ? 'acc' : 'plain') + '</td><td class="small">' + U.esc(l.text) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">Keine Einträge.</div>');
    },
  };
})();
