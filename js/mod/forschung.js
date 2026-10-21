/* KYTHERA · Modul Forschung */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.forschung = {
    mount(el) {
      this.el = el;
      el.innerHTML = KY.ui.head({ crumb: 'Steuerung', code: 'FO-07', title: 'Forschung', sub: 'Forschungsprogramme erweitern, was Sitz IX tun kann. Ein Programm läuft aktiv, bis zu drei weitere warten in der Reihe.' }) +
        '<div class="g g4" id="foKpi"></div><div id="foTree" class="mt12"></div>';
      U.on(el, 'click', '[data-rs]', (e, b) => {
        const r = KY.research.start(b.dataset.rs);
        if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return; }
        KY.ui.flashMsg('Forschung beauftragt: ' + KY.research.get(b.dataset.rs).n, 'ok');
        this.render();
      });
      this.sub = KY.bus.on('research', () => { this.dirty = true; });
      this.render();
    },
    unmount() { this.sub(); },
    tick() { this.rKpi(); if (this.dirty) { this.dirty = false; this.rTree(); } else this.rActive(); },
    render() { this.rKpi(); this.rTree(); },
    rKpi() {
      const S = KY.S, RS = KY.research;
      const a = S.research.active, r = a ? RS.get(a.id) : null;
      const rate = RS.rate();
      const done = Object.keys(S.research.done).length;
      const vis = KY.data.research.filter(x => RS.visible(x)).length;
      U.setHTML(this.el.querySelector('#foKpi'),
        '<div class="kpi span2" style="grid-column:span 2"><span class="lbl">Aktives Programm</span><span class="v" style="font-size:19px">' + (r ? U.esc(r.n) : '<span class="mut">keines</span>') + '</span>' + (r ? C.meter(a.pts / r.pts * 100, 100, 'prog stripes') + '<span class="dl mut">' + U.n(a.pts, 0) + ' / ' + r.pts + ' Punkte · noch ' + U.dur((r.pts - a.pts) / rate) + '</span>' : '<span class="dl mut">Wählen Sie unten ein Programm.</span>') + '</div>' +
        '<div class="kpi" data-tip="<b>Forschungsrate</b>Grundrate 0,55 Punkte/s, +6 % je Forschungsstation (' + S.research.stations + '), Boni durch Plenarbeschlüsse."><span class="lbl">Rate</span><span class="v">' + U.n(rate, 2) + '<small>Pkt/s</small></span><span class="dl mut">' + S.research.stations + ' Stationen</span></div>' +
        '<div class="kpi"><span class="lbl">Abgeschlossen</span><span class="v">' + done + '<small>/ ' + vis + '</small></span><span class="dl mut">Warteschlange: ' + S.research.queue.length + '</span></div>');
    },
    rActive() {
      const S = KY.S, a = S.research.active;
      if (!a) return;
      const n = this.el.querySelector('[data-node="' + a.id + '"] .meter > i');
      if (n) n.style.width = (a.pts / KY.research.get(a.id).pts * 100).toFixed(1) + '%';
    },
    rTree() {
      const S = KY.S, D = KY.data, RS = KY.research;
      let h = '';
      for (const b in D.branches) {
        const br = D.branches[b];
        if (br.hidden && !KY.flag('mechBranch')) {
          h += '<section class="pn mt12" style="border-style:dashed"><div class="pn-h"><h3>██████████</h3><div class="tools"><span class="meta">Zweig nicht freigegeben</span></div></div><div class="pn-b"><p class="small mut">Die Existenz dieses Forschungszweigs ist für Ihre aktuelle Kenntnislage nicht bestätigt.</p></div></section>';
          continue;
        }
        const nodes = D.research.filter(r => r.b === b);
        h += '<section class="pn mt12' + (br.hidden ? ' tick' : '') + '"><div class="pn-h"><h3>' + br.name + '</h3><div class="tools"><span class="meta">' + br.text + '</span></div></div><div class="pn-b"><div class="rtree">' + nodes.map(r => {
          const done = S.research.done[r.id], act = S.research.active && S.research.active.id === r.id, q = S.research.queue.indexOf(r.id) >= 0;
          const why = RS.canStart(r.id);
          const locked = why && !done && !act && !q;
          const fx = r.id === 'M3' && !KY.flag('nullstellung') ? '<span class="redact">' + '█'.repeat(38) + '</span>' : U.esc(r.fx);
          return '<div class="rnode' + (done ? ' done' : act ? ' act' : locked ? ' lock' : '') + '" data-node="' + r.id + '"><div class="row"><span class="id">' + r.id + '</span><span class="sp"></span>' + (done ? C.pill('abgeschlossen', 'ok') : act ? C.pill('läuft', 'acc', true) : q ? C.pill('vorgemerkt', 'info') : '') + '</div>' +
            '<div class="n">' + U.esc(r.n) + '</div><div class="fx">' + fx + '</div>' +
            (act ? C.meter(S.research.active.pts / r.pts * 100, 100, 'prog stripes') : '') +
            '<div class="row mt4"><span class="mono xs mut">' + r.pts + ' Pkt · ' + U.money(r.cost, 1) + '</span><span class="sp"></span>' + (done || act || q ? '' : '<button class="btn sm' + (why ? '' : ' pri') + '" data-rs="' + r.id + '"' + (why ? ' disabled data-tip="' + U.esc(why) + '"' : '') + '>' + (S.research.active ? 'Vormerken' : 'Starten') + '</button>') + '</div></div>';
        }).join('') + '</div></div></section>';
      }
      U.setHTML(this.el.querySelector('#foTree'), h);
    },
  };
})();
