/* KYTHERA · Modul Kapital */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.kapital = {
    mount(el, arg) {
      const D = KY.data;
      this.el = el;
      this.n = 0;
      this.sel = arg && D.companies.find(c => c.t === arg) ? arg : 'SSC';
      this.side = 'buy';
      this.amt = 5;
      this.sort = { k: 'pos', d: -1 };
      this.filter = 'alle';
      el.innerHTML = KY.ui.head({ crumb: 'Steuerung', code: 'KP-05', title: 'Kapital', sub: 'Beteiligungen des Sitzes IX an 24 börsennotierten Unternehmen. Ihre Orders sind groß genug, um Kurse zu bewegen.' }) +
        '<div class="g g5" id="kpKpi"></div>' +
        '<div class="g g-main mt12"><section class="pn"><div class="pn-h"><h3>Markt und Positionen</h3><div class="tools"><div class="seg" id="kpF"><button data-f="alle" class="on">Alle</button><button data-f="pos">Gehalten</button></div></div></div><div class="pn-b flush tbl-w" id="kpTbl" style="max-height:560px;overflow-y:auto"></div></section>' +
        '<aside class="col gap12" id="kpDet"></aside></div>' +
        '<div class="g g3 mt12"><section class="pn"><div class="pn-h"><h3>Aufteilung nach Sektor</h3></div><div class="pn-b row gap16" id="kpAlloc" style="align-items:center"></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Rohstoffe und Indizes</h3></div><div class="pn-b flush" id="kpCom"></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Gesamtvermögen · 20 min</h3></div><div class="pn-b" id="kpNw"></div></section></div>';
      U.on(el, 'click', '[data-co]', (e, r) => { this.sel = r.dataset.co; this.rTbl(); this.rDet(true); });
      U.on(el, 'click', '[data-f]', (e, b) => { this.filter = b.dataset.f; U.$$('[data-f]', el).forEach(x => x.classList.toggle('on', x === b)); this.rTbl(); });
      U.on(el, 'click', '[data-sort]', (e, th) => { const k = th.dataset.sort; this.sort = { k, d: this.sort.k === k ? -this.sort.d : -1 }; this.rTbl(); });
      this.sub = KY.bus.on('market', () => { this.dirty = true; });
      this.render();
    },
    arg(a) { if (a && KY.data.companies.find(c => c.t === a)) { this.sel = a; this.rTbl(); this.rDet(true); } },
    unmount() { this.sub(); },
    tick() {
      this.n++;
      this.rKpi();
      if (this.n % 2 === 0 || this.dirty) { this.rTbl(); this.rDet(false); }
      if (this.n % 5 === 0 || this.dirty) { this.rAlloc(); this.rCom(); this.rNw(); }
      this.dirty = false;
    },
    render() { this.rKpi(); this.rTbl(); this.rDet(true); this.rAlloc(); this.rCom(); this.rNw(); },
    rKpi() {
      const S = KY.S, M = KY.market, D = KY.data;
      const hold = M.holdings();
      const cost = U.sum(D.companies.map(c => S.market.c[c.t].cost));
      const pl = hold - cost;
      const ih = S.market.idx.h;
      const ich = ih.length > 60 ? (S.market.idx.v / ih[ih.length - 60] - 1) * 100 : 0;
      U.setHTML(this.el.querySelector('#kpKpi'),
        '<div class="kpi"><span class="lbl">Gesamtvermögen</span><span class="v">' + U.n(M.netWorth(), 1) + '<small>Mrd ¤</small></span><div class="sp-wrap">' + C.spark(S.market.nw.slice(-60), { w: 160, h: 28 }) + '</div></div>' +
        '<div class="kpi"><span class="lbl">Liquidität</span><span class="v">' + U.n(S.res.kap, 1) + '<small>Mrd ¤</small></span><span class="dl mut">' + U.pct(S.res.kap / M.netWorth() * 100, 0) + ' des Vermögens</span></div>' +
        '<div class="kpi"><span class="lbl">Beteiligungen</span><span class="v">' + U.n(hold, 1) + '<small>Mrd ¤</small></span><span class="dl">' + C.delta(pl, 2, ' Mrd') + ' <span class="mut">unrealisiert</span></span></div>' +
        '<div class="kpi" data-tip="<b>Laufende Erträge</b>Dividenden ' + U.esc(U.money(M.lastDiv)) + ' + Stiftungserträge ¤ 1,20 Mrd. − Unterhalt ' + U.esc(U.money(M.upkeep())) + ' je Minute."><span class="lbl">Erträge je Minute</span><span class="v">' + U.n(M.lastIncome, 2) + '<small>Mrd ¤</small></span><span class="dl mut">realisiert ' + U.sgn(S.stats.profit, 2) + ' Mrd</span></div>' +
        '<div class="kpi"><span class="lbl">' + D.indexName + '</span><span class="v">' + U.n(S.market.idx.v, 1) + '</span><span class="dl">' + C.delta(ich, 2, ' %') + ' <span class="mut">5 min</span></span><div class="sp-wrap">' + C.spark(ih.slice(-60), { w: 160, h: 28, color: 'var(--c1)' }) + '</div></div>');
    },
    rTbl() {
      const S = KY.S, D = KY.data, M = KY.market;
      const f1 = KY.hasRes('F1');
      let rows = D.companies.map(co => {
        const c = S.market.c[co.t];
        return { co, c, ch: M.change(co.t, 60), pos: c.u * c.p, pl: c.u * c.p - c.cost, fc: f1 ? M.forecast(co.t) : 0 };
      });
      if (this.filter === 'pos') rows = rows.filter(r => r.pos > 0.001);
      const k = this.sort.k, d = this.sort.d;
      rows.sort((a, b) => {
        const va = k === 'name' ? a.co.n : k === 'ch' ? a.ch : k === 'pos' ? a.pos : k === 'pl' ? a.pl : k === 'fc' ? a.fc : a.c.p;
        const vb = k === 'name' ? b.co.n : k === 'ch' ? b.ch : k === 'pos' ? b.pos : k === 'pl' ? b.pl : k === 'fc' ? b.fc : b.c.p;
        return (va > vb ? 1 : va < vb ? -1 : 0) * d;
      });
      const th = (key, label, cls) => '<th class="sortable ' + (cls || '') + '" data-sort="' + key + '">' + label + (this.sort.k === key ? (this.sort.d < 0 ? ' ▾' : ' ▴') : '') + '</th>';
      U.setHTML(this.el.querySelector('#kpTbl'), '<table class="tbl"><thead><tr>' + th('name', 'Unternehmen') + '<th class="hide-xs">Sektor</th>' + th('p', 'Kurs', 'num') + th('ch', '5 min', 'num') + '<th class="hide-xs">Verlauf</th>' + th('pos', 'Position', 'num') + th('pl', 'G/V', 'num') + (f1 ? th('fc', 'Prognose', 'num') : '') + '</tr></thead><tbody>' +
        rows.map(r => '<tr class="click' + (r.co.t === this.sel ? ' on' : '') + '" data-co="' + r.co.t + '"><td><span class="mono acc small">' + r.co.t + '</span> <span class="small">' + U.esc(r.co.n) + '</span></td><td class="hide-xs small fg2">' + D.sectors[r.co.s] + '</td><td class="num">' + U.n(r.c.p, 2) + '</td><td class="num">' + C.delta(r.ch, 2, ' %') + '</td><td class="hide-xs" style="width:90px"><div style="height:20px">' + C.spark(r.c.h.slice(-40), { w: 90, h: 20, color: r.ch >= 0 ? 'var(--ok)' : 'var(--crit)' }) + '</div></td>' +
          '<td class="num">' + (r.pos > 0.001 ? U.n(r.pos, 2) : '<span class="dim">–</span>') + '</td><td class="num">' + (r.pos > 0.001 ? C.delta(r.pl, 2) : '<span class="dim">–</span>') + '</td>' + (f1 ? '<td class="num">' + C.delta(r.fc, 1, ' %') + '</td>' : '') + '</tr>').join('') + '</tbody></table>');
    },
    rDet(full) {
      const S = KY.S, D = KY.data, M = KY.market;
      const co = M.co(this.sel), c = S.market.c[co.t];
      let box = this.el.querySelector('#kpDet');
      const pos = c.u * c.p;
      if (full || !box.querySelector('#kpChart')) {
        const fresh = box.cloneNode(false);
        box.replaceWith(fresh);
        box = fresh;
        box.innerHTML = '<section class="pn tick"><div class="pn-h"><h3>' + co.t + ' · ' + U.esc(D.sectors[co.s]) + '</h3><div class="tools"><span class="meta">' + D.regions[co.r].name + '</span></div></div><div class="pn-b">' +
          '<div class="serif" style="font-size:24px;line-height:1.1">' + U.esc(co.n) + '</div><p class="small fg2 mt8">' + U.esc(co.text) + '</p>' +
          '<div class="row mt12" style="align-items:baseline"><span style="font:500 28px/1 var(--font-ui)" id="kpPx"></span><span class="mono small" id="kpCh"></span></div>' +
          '<div id="kpChart" class="mt8"></div><dl class="kv mt12" id="kpStats"></dl></div></section>' +
          '<section class="pn"><div class="pn-h"><h3>Order</h3><div class="tools"><div class="seg"><button data-side="buy"' + (this.side === 'buy' ? ' class="on"' : '') + '>Kaufen</button><button data-side="sell"' + (this.side === 'sell' ? ' class="on"' : '') + '>Verkaufen</button></div></div></div><div class="pn-b">' +
          '<div class="fld"><label for="kpAmt">Volumen in Mrd ¤</label><input class="inp mono" id="kpAmt" type="number" min="0.1" step="0.5" value="' + this.amt + '"></div>' +
          '<div class="row wrap mt8" style="gap:4px">' + [1, 5, 10, 25].map(v => '<button class="btn sm ghost" data-amt="' + v + '">' + v + '</button>').join('') + '<button class="btn sm ghost" data-amt="max">Max</button></div>' +
          '<dl class="kv mt12" id="kpPrev"></dl><button class="btn pri lg block mt12" id="kpGo"></button></div></section>';
        const amt = box.querySelector('#kpAmt');
        amt.oninput = () => { this.amt = Math.max(0, parseFloat(amt.value) || 0); this.rPrev(); };
        U.on(box, 'click', '[data-side]', (e, b) => { this.side = b.dataset.side; U.$$('[data-side]', box).forEach(x => x.classList.toggle('on', x === b)); this.rPrev(); });
        U.on(box, 'click', '[data-amt]', (e, b) => {
          const v = b.dataset.amt;
          this.amt = v === 'max' ? Math.floor((this.side === 'buy' ? S.res.kap * 0.99 : S.market.c[this.sel].u * S.market.c[this.sel].p) * 10) / 10 : +v;
          amt.value = this.amt; this.rPrev();
        });
        box.querySelector('#kpGo').onclick = () => {
          const r = M.trade(this.sel, this.side, this.amt);
          if (!r.ok) { KY.ui.flashMsg(r.err, 'crit'); return; }
          KY.ui.flashMsg((this.side === 'buy' ? 'Gekauft: ' : 'Verkauft: ') + U.money(this.amt) + ' ' + this.sel + ' · Kursimpuls ' + U.sgn(r.impact, 2, ' %'), 'ok');
          this.render();
        };
        this.chartN = -1;
      }
      U.setText(box.querySelector('#kpPx'), U.n(c.p, 2) + ' ¤');
      const ch = M.change(co.t, 60);
      U.setHTML(box.querySelector('#kpCh'), C.delta(ch, 2, ' %') + ' <span class="mut">5 min</span>');
      if (this.chartN !== this.n) {
        this.chartN = this.n;
        const band = KY.hasRes('F1') ? (() => { const f = M.forecast(co.t); const mid = c.p * (1 + f / 100); return [mid * 0.985, mid * 1.015]; })() : null;
        C.line(box.querySelector('#kpChart'), { vals: c.h.slice(-120), h: 170, fmt: v => U.n(v, 2) + ' ¤', label: i => 'vor ' + U.dur((119 - i) * 5), band, xlabels: [[0, '−10 min'], [119, 'jetzt']] });
      }
      const mc = co.mc * c.p / co.p;
      U.setHTML(box.querySelector('#kpStats'), '<dt>Marktkapitalisierung</dt><dd class="mono">' + U.money(mc) + '</dd><dt>Ihr Anteil</dt><dd class="mono">' + U.pct(pos / mc * 100, 2) + '</dd><dt>Position</dt><dd class="mono">' + U.money(pos) + ' · Einstand ' + U.money(c.cost) + '</dd><dt>Dividendenrendite</dt><dd class="mono">' + U.pct(co.div) + '</dd><dt>Volatilität</dt><dd class="mono">' + ['gering', 'mittel', 'hoch'][co.v < 1.2 ? 0 : co.v < 1.7 ? 1 : 2] + '</dd>' +
        (KY.hasRes('F1') ? '<dt>Prognose</dt><dd class="mono">' + C.delta(M.forecast(co.t), 1, ' %') + ' zur fairen Bewertung</dd>' : ''));
      this.rPrev();
    },
    rPrev() {
      const S = KY.S, M = KY.market, box = this.el.querySelector('#kpDet');
      const pv = M.preview(this.sel, this.side, this.amt || 0);
      const c = S.market.c[this.sel];
      const can = this.side === 'buy' ? S.res.kap >= this.amt + pv.fee && this.amt > 0 : c.u * c.p >= this.amt - 1e-6 && this.amt > 0;
      U.setHTML(box.querySelector('#kpPrev'), '<dt>Durchschnittskurs</dt><dd class="mono">' + U.n(pv.avg, 2) + ' ¤</dd><dt>Erwarteter Kursimpuls</dt><dd class="mono ' + (pv.impact >= 0 ? 'up' : 'dn') + '">' + U.sgn(pv.impact, 2, ' %') + '</dd><dt>Gebühren</dt><dd class="mono">' + U.money(pv.fee) + '</dd>' +
        '<dt>Verfügbar</dt><dd class="mono">' + (this.side === 'buy' ? U.money(S.res.kap) : U.money(c.u * c.p)) + '</dd>');
      const go = box.querySelector('#kpGo');
      go.disabled = !can;
      go.textContent = (this.side === 'buy' ? 'Kaufen · ' : 'Verkaufen · ') + U.money(this.amt || 0);
    },
    rAlloc() {
      const S = KY.S, D = KY.data;
      const by = {};
      D.companies.forEach(co => { const v = S.market.c[co.t].u * S.market.c[co.t].p; if (v > 0.001) by[co.s] = (by[co.s] || 0) + v; });
      let segs = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([s, v]) => ({ l: D.sectors[s], v }));
      if (segs.length > 6) { const rest = segs.slice(5); segs = segs.slice(0, 5).concat([{ l: 'Weitere', v: U.sum(rest.map(r => r.v)) }]); }
      segs.forEach((s, i) => { s.c = s.l === 'Weitere' ? 'var(--line3)' : C.CAT[i]; });
      const tot = U.sum(segs.map(s => s.v));
      U.setHTML(this.el.querySelector('#kpAlloc'), segs.length ? '<div style="width:140px;flex:none">' + C.donut(segs, [U.n(tot, 0), 'MRD ¤']) + '</div><div style="flex:1;min-width:0">' + C.legend(segs, tot) + '</div>' : '<div class="empty">Keine Beteiligungen.</div>');
    },
    rCom() {
      const S = KY.S, D = KY.data;
      U.setHTML(this.el.querySelector('#kpCom'), '<table class="tbl"><tbody>' + D.commodities.map(cm => {
        const c = S.market.com[cm.id], h = c.h, ch = h.length > 30 ? (c.p / h[h.length - 30] - 1) * 100 : 0;
        return '<tr><td><div class="small">' + cm.n + '</div><div class="xs mut">' + cm.unit + '</div></td><td class="num">' + U.n(c.p, c.p > 1000 ? 0 : 2) + '</td><td class="num">' + C.delta(ch, 2, ' %') + '</td><td style="width:80px"><div style="height:20px">' + C.spark(h.slice(-40), { w: 80, h: 20, color: 'var(--c1)' }) + '</div></td></tr>';
      }).join('') + '</tbody></table>');
    },
    rNw() {
      const S = KY.S;
      const vals = S.market.nw.slice(-240);
      if (vals.length < 2) { U.setHTML(this.el.querySelector('#kpNw'), '<div class="empty">Daten werden gesammelt …</div>'); return; }
      C.line(this.el.querySelector('#kpNw'), { vals, h: 150, fmt: v => U.n(v, 1) + ' Mrd', label: i => 'vor ' + U.dur((vals.length - 1 - i) * 5) });
    },
  };
})();
