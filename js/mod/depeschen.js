/* KYTHERA · Modul Depeschen */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const KIND = { chance: 'Gelegenheit', warnung: 'Warnung', markt: 'Markt', plenum: 'Plenum', betrieb: 'Betrieb', archiv: 'Archiv' };

  function cipher(id, len) {
    const r = U.rng(U.hash(id));
    let s = '';
    for (let i = 0; i < len; i++) { s += B64[Math.floor(r() * 64)]; if (i % 64 === 63) s += '\n'; }
    return s;
  }

  KY.mod.depeschen = {
    mount(el, arg) {
      this.el = el;
      this.f = 'alle';
      this.sel = arg || (KY.S.dsp.list[0] && KY.S.dsp.list[0].id);
      el.innerHTML = KY.ui.head({ crumb: 'Analyse', code: 'DP-12', title: 'Depeschen', sub: 'Verschlüsselte Meldungen der Feldbüros, Stationen und Schiffe. Entschlüsselung kostet Rechenzeit; manche Meldungen sind nur für kurze Zeit nützlich.' }) +
        '<div class="g g4" id="dpKpi"></div>' +
        '<div class="g g-main2 mt12"><section class="pn"><div class="pn-h"><div class="seg">' + [['alle', 'Alle'], ['enc', 'Verschlüsselt'], ['flag', 'Markiert'], ['dec', 'Gelesen']].map(([k, n]) => '<button data-f="' + k + '"' + (k === this.f ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div></div><div class="pn-b flush" id="dpList" style="max-height:calc(100vh - 360px);min-height:320px;overflow-y:auto"></div></section>' +
        '<div class="col gap12"><section class="pn tick" id="dpView"></section><section class="pn"><div class="pn-h"><h3>Stichwortfilter</h3><div class="tools"><span class="meta">markiert passende Depeschen</span></div></div><div class="pn-b"><div class="row wrap" id="dpTags" style="gap:4px"></div><form class="row mt8" id="dpTagF"><input class="inp" id="dpTagIn" placeholder="Stichwort hinzufügen …" maxlength="24"><button class="btn" type="submit">Hinzufügen</button></form>' +
        '<label class="chk mt12"><input type="checkbox" id="dpAuto"' + (KY.S.dsp.autoDec ? ' checked' : '') + '><span class="small fg2">Markierte Depeschen automatisch entschlüsseln, solange mehr als 100 EF verfügbar sind</span></label></div></section></div></div>';
      U.on(el, 'click', '[data-f]', (e, b) => { this.f = b.dataset.f; U.$$('[data-f]', el).forEach(x => x.classList.toggle('on', x === b)); this.rList(); });
      U.on(el, 'click', '[data-d]', (e, b) => { this.sel = b.dataset.d; const d = KY.S.dsp.list.find(x => x.id === this.sel); if (d) d.read = true; this.rList(); this.rView(true); });
      U.on(el, 'click', '[data-dec]', () => {
        const r = KY.dsp.decrypt(this.sel);
        if (!r.ok) { KY.ui.flashMsg(r.err || 'Nicht möglich', 'crit'); return; }
        if (KY.audio) KY.audio.play('scan');
        this.rView(true); this.rList();
      });
      U.on(el, 'click', '[data-untag]', (e, b) => { const S = KY.S; S.dsp.filters = S.dsp.filters.filter(f => f !== b.dataset.untag); this.rTags(); this.refilter(); });
      U.on(el, 'click', '[data-goact]', (e, b) => KY.ui.doAct(JSON.parse(b.dataset.goact)));
      el.querySelector('#dpTagF').onsubmit = e => {
        e.preventDefault();
        const S = KY.S, v = el.querySelector('#dpTagIn').value.trim();
        if (!v) return;
        if (S.dsp.filters.length >= 10) { KY.ui.flashMsg('Höchstens zehn Stichwörter.', 'crit'); return; }
        if (S.dsp.filters.indexOf(v) < 0) S.dsp.filters.push(v);
        el.querySelector('#dpTagIn').value = '';
        KY.log('dsp', 'Stichwortfilter hinzugefügt: „' + v + '“');
        this.rTags(); this.refilter();
      };
      el.querySelector('#dpAuto').onchange = e => { KY.S.dsp.autoDec = e.target.checked; KY.log('dsp', 'Automatische Entschlüsselung ' + (e.target.checked ? 'aktiv' : 'aus')); };
      this.sub = KY.bus.on('dsp', () => { this.dirty = true; });
      this.render();
    },
    arg(a) { if (a) { this.sel = a; this.rList(); this.rView(true); } },
    unmount() { this.sub(); },
    tick() {
      this.rKpi();
      const d = KY.S.dsp.list.find(x => x.id === this.sel);
      if (this.dirty) { this.dirty = false; this.rList(); this.rView(true); }
      else if (d && d.decT > 0) { this.rView(false); this.rList(); }
    },
    render() { this.rKpi(); this.rTags(); this.rList(); this.rView(true); },
    refilter() {
      const S = KY.S;
      S.dsp.list.forEach(d => {
        if (!d.enc && !d.story) { const txt = U.norm(d.subj + ' ' + d.body + ' ' + d.src); d.flag = S.dsp.filters.some(f => txt.indexOf(U.norm(f)) >= 0); }
        else if (!d.story) { const txt = U.norm(d.src + ' ' + (KY.data.regions[d.rid] ? KY.data.regions[d.rid].name : '')); d.flag = S.dsp.filters.some(f => txt.indexOf(U.norm(f)) >= 0) || d.flag; }
      });
      this.rList();
    },
    rKpi() {
      const S = KY.S, L = S.dsp.list;
      U.setHTML(this.el.querySelector('#dpKpi'),
        '<div class="kpi"><span class="lbl">Eingang</span><span class="v">' + L.length + '</span><span class="dl mut">' + S.stats.decrypted + ' entschlüsselt</span></div>' +
        '<div class="kpi"><span class="lbl">Verschlüsselt</span><span class="v">' + L.filter(d => d.enc).length + '</span><span class="dl mut">' + L.filter(d => d.decT > 0).length + ' in Arbeit</span></div>' +
        '<div class="kpi"><span class="lbl">Markiert</span><span class="v">' + L.filter(d => d.flag).length + '</span><span class="dl mut">' + S.dsp.filters.length + ' Stichwörter</span></div>' +
        '<div class="kpi"><span class="lbl">Rechenkontingent</span><span class="v">' + U.n(S.res.rech) + '<small>EF</small></span><span class="dl mut">' + (KY.hasRes('A2') ? 'Tiefenentschlüsselung aktiv' : 'Standardverfahren') + '</span></div>');
    },
    rTags() {
      U.setHTML(this.el.querySelector('#dpTags'), KY.S.dsp.filters.map(f => '<span class="tag acc" style="display:inline-flex;gap:6px;align-items:center">' + U.esc(f) + '<button class="lnk xs" data-untag="' + U.esc(f) + '" aria-label="Entfernen">×</button></span>').join('') || '<span class="xs mut">Keine Stichwörter.</span>');
    },
    rList() {
      const S = KY.S, D = KY.data;
      const list = S.dsp.list.filter(d => this.f === 'alle' || (this.f === 'enc' && d.enc) || (this.f === 'flag' && d.flag) || (this.f === 'dec' && !d.enc));
      U.setHTML(this.el.querySelector('#dpList'), list.length ? list.map(d => {
        const st = d.decT > 0 ? C.pill(Math.round(d.prog * 100) + ' %', 'warn', true) : d.enc ? C.pill('verschlüsselt', d.story ? 'crit' : 'plain') : C.pill(KIND[d.k] || 'Meldung', d.k === 'chance' ? 'ok' : d.k === 'warnung' ? 'warn' : 'info');
        return '<div class="li' + (d.id === this.sel ? ' on' : '') + (!d.read && !d.enc ? ' unread' : '') + '" data-d="' + d.id + '"><div class="ic" style="' + (d.flag ? 'border-color:var(--acc);color:var(--acc)' : '') + '">' + KY.I(d.enc ? 'lock' : 'depeschen') + '</div><div class="body"><div class="row"><span class="mono small ' + (d.story ? 'acc' : '') + '">' + d.id + '</span><span class="xs mut ell" style="flex:1">' + U.esc(d.src) + '</span><span class="mono xs mut">' + U.hm(new Date(d.ts)) + '</span></div>' +
          '<div class="t ell mt4">' + (d.enc ? '<span class="mono dim">' + cipher(d.id, 34).replace(/\n/g, '') + '</span>' : U.esc(d.subj)) + '</div><div class="mt4">' + st + (d.flag ? ' <span class="tag acc">markiert</span>' : '') + '</div></div></div>';
      }).join('') : '<div class="empty"><b>Keine Depeschen</b></div>');
    },
    rView(full) {
      const S = KY.S, D = KY.data, d = S.dsp.list.find(x => x.id === this.sel);
      const box = this.el.querySelector('#dpView');
      if (!d) { U.setHTML(box, '<div class="pn-b"><div class="empty"><b>Keine Depesche ausgewählt</b></div></div>'); return; }
      const meta = '<dl class="kv"><dt>Kennung</dt><dd class="mono">' + d.id + '</dd><dt>Quelle</dt><dd>' + U.esc(d.src) + '</dd><dt>Eingang</dt><dd class="mono">' + U.stamp(d.ts) + '</dd><dt>Verfahren</dt><dd class="mono">' + (d.story ? 'KY-Ω · 4096 bit' : 'KY-AES-256 · Feldschlüssel') + '</dd></dl>';
      if (d.enc && !(d.decT > 0)) {
        const cost = KY.dsp.decryptCost(d), time = KY.dsp.decryptTime(d);
        U.setHTML(box, '<div class="pn-h"><h3>Depesche ' + d.id + '</h3><div class="tools">' + C.pill('verschlüsselt', d.story ? 'crit' : 'plain') + '</div></div><div class="pn-b">' + meta +
          '<pre class="mono xs dim mt12" style="white-space:pre-wrap;word-break:break-all;line-height:1.5;margin-top:12px;max-height:180px;overflow:hidden">' + cipher(d.id, d.story ? 640 : 320) + '</pre>' +
          '<div class="row mt12"><span class="small fg2">Aufwand: <span class="mono">' + cost + ' EF</span> · Dauer <span class="mono">' + U.dur(time) + '</span></span><span class="sp"></span><button class="btn pri" data-dec="1"' + (KY.S.res.rech < cost ? ' disabled' : '') + '>' + KY.I('key') + 'Entschlüsseln</button></div>' +
          (KY.S.res.rech < cost ? '<p class="xs mut mt8">Nicht genügend Rechenkontingent. Rechenzentren ausbauen oder warten.</p>' : '') + '</div>');
        return;
      }
      if (d.decT > 0) {
        const src = d.subj + '\n\n' + d.body;
        const k = d.prog;
        const ct = cipher(d.id, src.length);
        let out = '';
        for (let i = 0; i < src.length; i++) {
          const thr = (U.hash(d.id + i) % 1000) / 1000;
          out += thr < k ? src[i] : (src[i] === '\n' ? '\n' : ct[i] || '░');
        }
        if (!full && box.querySelector('#dpDec')) {
          U.setText(box.querySelector('#dpDec'), out);
          box.querySelector('#dpBar').style.width = (k * 100) + '%';
          U.setText(box.querySelector('#dpPct'), Math.round(k * 100) + ' %');
          return;
        }
        U.setHTML(box, '<div class="pn-h"><h3>Entschlüsselung ' + d.id + '</h3><div class="tools">' + C.pill('läuft', 'warn', true) + '<span class="mono small" id="dpPct">' + Math.round(k * 100) + ' %</span></div></div><div class="pn-b">' + meta + '<div class="meter tall mt12 stripes prog"><i id="dpBar" style="width:' + (k * 100) + '%"></i></div><pre class="mono small mt12" id="dpDec" style="white-space:pre-wrap;word-break:break-word;line-height:1.6;color:var(--fg2)">' + U.esc(out) + '</pre></div>');
        return;
      }
      d.read = true;
      let acts = '';
      if (d.buff) {
        const R = D.regions[d.buff.region];
        const live = S.buffs.some(b => b.label === 'Gelegenheit ' + d.id && b.until > S.t);
        acts += '<div class="mt12" style="border:1px solid rgba(47,179,68,.4);background:var(--ok-bg);padding:10px 12px"><div class="small bold">' + (live ? 'Gelegenheit aktiv' : 'Gelegenheit abgelaufen') + '</div><div class="xs fg2 mt4">+' + d.buff.succ + ' Punkte Erfolg für ' + d.buff.type.map(t => D.projectTypes[t].name).join(' oder ') + ' in ' + R.name + (d.buff.costMult ? ', Kosten −25 %' : '') + '.</div>' +
          (live ? '<div class="row wrap mt8" style="gap:6px">' + d.buff.type.map(t => '<button class="btn sm pri" data-goact=\'' + JSON.stringify({ plan: { type: t, rid: d.buff.region } }) + '\'>' + D.projectTypes[t].name + ' planen</button>').join('') + '</div>' : '') + '</div>';
      }
      if (d.warn) acts += '<div class="row wrap mt12" style="gap:6px"><button class="btn sm pri" data-goact=\'' + JSON.stringify({ plan: { type: d.warn.type === 'STURM' ? 'KLI' : 'ENE', rid: d.warn.rid } }) + '\'>' + (d.warn.type === 'STURM' ? 'Klimaresilienz' : 'Energieprojekt') + ' in ' + D.regions[d.warn.rid].name + ' planen</button><button class="btn sm ghost" data-goact=\'' + JSON.stringify({ mod: 'atlas', arg: d.warn.rid }) + '\'>Im Atlas</button></div>';
      if (d.tip) acts += '<div class="row mt12"><button class="btn sm pri" data-goact=\'' + JSON.stringify({ mod: 'kapital', arg: d.tip.t }) + '\'>' + d.tip.t + ' im Kapitalbereich</button></div>';
      U.setHTML(box, '<div class="pn-h"><h3>Depesche ' + d.id + '</h3><div class="tools">' + C.pill(KIND[d.k] || 'Meldung', d.k === 'chance' ? 'ok' : d.k === 'warnung' ? 'warn' : d.story ? 'crit' : 'info') + '</div></div><div class="pn-b">' + meta +
        '<h2 class="serif mt16" style="font-size:22px;font-weight:600;margin-top:14px">' + U.esc(d.subj) + '</h2><div class="' + (d.story ? 'mono' : '') + '" style="white-space:pre-wrap;line-height:1.65;margin-top:10px;' + (d.story ? 'font-size:13.5px;color:#d9e3dc' : '') + '">' + U.esc(d.body) + '</div>' + acts + '</div>');
    },
  };
})();
