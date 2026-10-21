/* KYTHERA · Modul Integrität */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;
  const SEV = { 1: ['gering', 'info'], 2: ['erhöht', 'warn'], 3: ['kritisch', 'crit'] };

  KY.mod.integritaet = {
    mount(el, arg) {
      this.el = el;
      this.sel = arg || null;
      el.innerHTML = KY.ui.head({ crumb: 'System', code: 'IN-14', title: 'Integrität', sub: 'Zustand des KYTHERA-Netzes und der Diskretion des Kuratoriums. Offene Anomalien kosten Rechenkapazität, bis sie behoben sind.' }) +
        '<div class="g g4" id="inKpi"></div>' +
        '<div class="g g-main mt12"><section class="pn tick"><div class="pn-h"><h3>Netzknoten</h3><div class="tools"><span class="meta">Verbindungsgraph · Echtzeit</span></div></div><div class="pn-b flush" id="inMap"></div></section>' +
        '<aside class="col gap12"><section class="pn"><div class="pn-h"><h3>Diskretion</h3></div><div class="pn-b" id="inDisk"></div></section></aside></div>' +
        '<section class="pn mt12"><div class="pn-h"><h3>Anomalien</h3><div class="tools"><span class="meta" id="inAnMeta"></span></div></div><div class="pn-b flush tbl-w" id="inAn"></div></section>' +
        '<section class="pn mt12"><div class="pn-h"><h3>Knotenübersicht</h3></div><div class="pn-b flush tbl-w" id="inNodes"></div></section>';
      this.map = new KY.Map(el.querySelector('#inMap'), { height: 300, overlay: 'praes', tools: false, legend: false, layers: { nodes: true, labels: false } });
      U.on(el, 'click', '[data-ia]', (e, b) => {
        const [aid, act] = b.dataset.ia.split('|');
        const r = KY.integ.act(aid, act);
        if (!r.ok) { KY.ui.flashMsg(r.err || 'Nicht möglich', 'crit'); return; }
        KY.ui.flashMsg(r.fixed ? 'Anomalie ' + aid + ' behoben' : 'Maßnahme ohne Wirkung', r.fixed ? 'ok' : 'crit');
        this.render();
      });
      U.on(el, 'click', '[data-go]', (e, b) => KY.ui.go(b.dataset.go));
      this.sub = KY.bus.on('integ', () => { this.dirty = true; });
      this.render();
    },
    arg(a) { this.sel = a; this.rAn(); },
    unmount() { this.map.destroy(); this.sub(); },
    tick() { this.n = (this.n || 0) + 1; this.rKpi(); if (this.dirty || this.n % 4 === 0) { this.dirty = false; this.rAn(); this.rNodes(); this.rDisk(); } },
    render() { this.rKpi(); this.rAn(); this.rNodes(); this.rDisk(); },
    rKpi() {
      const S = KY.S;
      const open = S.integ.anomalies.filter(a => a.state === 'offen');
      const up = Object.values(S.integ.nodes).filter(n => n.up).length;
      const vis = KY.data.nodes.filter(n => !n.hidden || KY.flag('omegaTraced') || S.story.ending).length;
      U.setHTML(this.el.querySelector('#inKpi'),
        '<div class="kpi"><span class="lbl">Systemintegrität</span><span class="v">' + U.n(S.integ.level, 1) + '<small>%</small></span>' + C.meter(S.integ.level, 100, C.lvlCls((S.integ.level - 60) * 2.5)) + '</div>' +
        '<div class="kpi"><span class="lbl">Offene Anomalien</span><span class="v">' + open.length + '</span><span class="dl">' + (open.some(a => a.sev >= 3) ? C.pill('kritisch', 'crit') : open.length ? C.pill('in Bearbeitung', 'warn') : C.pill('keine', 'ok')) + '</span></div>' +
        '<div class="kpi"><span class="lbl">Knoten online</span><span class="v">' + Math.min(up, vis) + '<small>/ ' + vis + '</small></span><span class="dl mut">KY-N1 Leitknoten</span></div>' +
        '<div class="kpi"><span class="lbl">Rechenverlust</span><span class="v">' + U.n(100 - S.integ.level, 1) + '<small>%</small></span><span class="dl mut">durch Integritätsmängel</span></div>');
    },
    rAn() {
      const S = KY.S, IG = KY.integ;
      const list = S.integ.anomalies.slice(0, 24);
      U.setText(this.el.querySelector('#inAnMeta'), S.integ.anomalies.filter(a => a.state === 'offen').length + ' offen · ' + S.integ.anomalies.length + ' gesamt');
      U.setHTML(this.el.querySelector('#inAn'), list.length ? '<table class="tbl"><thead><tr><th>Kennung</th><th>Knoten</th><th>Beschreibung</th><th>Schwere</th><th>Status</th><th></th></tr></thead><tbody>' + list.map(a => {
        const sv = SEV[a.sev];
        const acts = a.state === 'offen' ? Object.entries(IG.ACTIONS).map(([k, A]) => '<button class="btn sm ghost" data-ia="' + a.id + '|' + k + '" data-tip="' + U.esc(A.n + ' · ' + KY.costText(A.cost)) + '">' + A.n + '</button>').join(' ') : '';
        return '<tr' + (a.id === this.sel ? ' class="on"' : '') + '><td class="mono small">' + a.id + '</td><td class="mono small' + (a.node === 'KY-Ω' ? ' acc' : '') + '">' + a.node + '</td><td><div class="small">' + U.esc(a.t) + '</div>' + (a.res ? '<div class="xs ' + (a.state === 'behoben' ? 'fg2' : 'dn') + ' mt4">' + U.esc(a.res) + '</div>' : '') + '</td><td>' + C.pill(sv[0], sv[1]) + '</td><td>' + (a.state === 'offen' ? C.pill('offen', 'warn', true) : C.pill('behoben', 'ok')) + '</td><td class="r nowrap">' + acts + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty"><b>Keine Anomalien</b>Das Netz arbeitet einwandfrei.</div>');
    },
    rNodes() {
      const S = KY.S, D = KY.data;
      const nodes = D.nodes.filter(n => !n.hidden || KY.flag('omegaTraced') || S.story.ending);
      U.setHTML(this.el.querySelector('#inNodes'), '<table class="tbl"><thead><tr><th>Knoten</th><th>Standort</th><th class="num">Latenz</th><th>Integrität</th><th>Status</th></tr></thead><tbody>' + nodes.map(n => {
        const st = S.integ.nodes[n.id];
        const open = S.integ.anomalies.filter(a => a.state === 'offen' && a.node === n.id).length;
        return '<tr><td class="mono' + (n.hidden ? ' acc' : '') + '">' + n.id + '</td><td>' + (n.hidden ? '34,2° N · 21,4° O' : n.name) + '</td><td class="num">' + (n.hidden ? '−252 000 ms' : Math.round(st.lat) + ' ms') + '</td><td style="width:160px">' + C.meter(st.integ, 100, st.integ > 95 ? 'ok' : st.integ > 85 ? 'warn' : 'crit') + '</td><td>' + (!st.up ? C.pill('isoliert', 'plain') : open ? C.pill(open + ' Anomalie' + (open > 1 ? 'n' : ''), 'warn') : C.pill('online', 'ok')) + '</td></tr>';
      }).join('') + '</tbody></table>');
    },
    rDisk() {
      const S = KY.S;
      const proj = S.projects.active.length;
      U.setHTML(this.el.querySelector('#inDisk'), C.gauge(S.res.disk, { label: 'Diskretion', max: 200 }) +
        '<dl class="kv mt12"><dt>Laufende Vorhaben</dt><dd>' + proj + ' (' + S.projects.active.filter(p => p.ap === 'SCH').length + ' beschleunigt)</dd><dt>Erholung</dt><dd>ca. ' + U.n((92 - S.res.disk) * 0.0035 * 60, 1) + ' Pkt./min</dd><dt>Stiftungsarchitektur</dt><dd>' + (KY.hasRes('F2') ? 'aktiv (−30 %)' : 'nicht erforscht') + '</dd></dl>' +
        '<p class="xs mut mt12">Unter 35 Punkten verliert das Plenum das Vertrauen. Öffentlichkeitsarbeit über Stiftungen hebt die Diskretion.</p><button class="btn sm ghost mt8" data-go="news">Zur Öffentlichkeitsarbeit</button>');
    },
  };
})();
