/* KYTHERA · MANDAT · Medienzentrum: Fernsehen, Presse, soziale Netze, Umfragen */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const ui = KY.ui, A = KY.A;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const MU = (KY.mediaUi = {});
  const chOf = id => D.CHANNELS.find(c => c.id === id) || D.CHANNELS[0];

  MU.artRow = function (a) {
    const ch = chOf(a.ch);
    return `<div class="art" data-a="article" data-id="${a.id}"><div class="meta"><span class="chip" style="background:${ch.color}33;color:#e8eef6">${esc(ch.short)}</span><span>${esc(a.cat)}</span><span>· ${ui.dayAgo(a.day)}</span>${a.about ? '<span class="chip gold" style="height:18px">Ihr Mandat</span>' : ''}${a.breaking ? '<span class="chip red" style="height:18px">' + esc(ch.breaking) + '</span>' : ''}</div><div class="h">${esc(a.h)}</div>${a.lead ? '<div class="ld">' + esc(a.lead) + '</div>' : ''}</div>`;
  };

  A.article = b => MU.openArticle(+b.dataset.id);
  MU.openArticle = function (id) {
    const S = SIM.S;
    const a = S.news.find(x => x.id === id);
    if (!a) return;
    a.read = true;
    const ch = chOf(a.ch);
    const loc = a.ev ? KY.events.byId(a.ev) : null;
    const lon = loc ? loc.lon : a.c >= 0 ? SIM.W.cities[a.c].lon : a.n >= 0 ? SIM.W.nations[a.n].lon : null;
    const lat = loc ? loc.lat : a.c >= 0 ? SIM.W.cities[a.c].lat : a.n >= 0 ? SIM.W.nations[a.n].lat : null;
    const reporter = U.pick(ch.reporters || ch.anchors);
    const m = ui.modal({
      cls: 'w560', html: `<div class="mh"><div class="tt"><div class="lbl" style="color:${ch.color === '#1d4e89' ? '#9cc6f5' : 'var(--dim)'}">${esc(ch.name)} · ${esc(a.cat)} · ${U.dateStr(a.day, true)}</div><h2>${esc(a.h)}</h2></div><button class="iconbtn" data-a="mclose">${ic('close', 18)}</button></div>
      <div class="mb">${a.lead ? '<p style="font:15px/1.6 var(--serif);color:#e6dfd2;margin:0 0 12px">' + esc(a.lead) + '</p>' : ''}
      ${a.quotes.map(q => `<div class="art"><div class="q">„${esc(q.text)}“<br><b>${esc(q.name)}, ${esc(q.role)}</b></div></div>`).join('')}
      <div class="dim" style="font-size:12px;margin-top:12px">Von ${esc(reporter)}${a.chs.length > 1 ? ' · auch berichtet von ' + a.chs.slice(1).map(c => esc(chOf(c).name)).join(', ') : ''}</div></div>
      <div class="mf">${a.proj ? '<button class="btn sm" data-a="proj" data-id="' + a.proj + '">Vorhaben ansehen</button>' : ''}${a.inc ? '<button class="btn sm" data-a="inc" data-id="' + a.inc + '">Krisenstab</button>' : ''}${lon !== null ? `<button class="btn sm" data-a="focus" data-lon="${lon}" data-lat="${lat}" data-z="3.2">${ic('pin', 14)} Auf der Karte</button>` : ''}<button class="btn sm ghost" data-a="mclose">Schließen</button></div>`,
    });
    m.el.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (t && t.dataset.a !== 'mclose') setTimeout(() => m.close(), 0); });
  };

  /* ---------- Fernsehen ---------- */
  let tvTimer = null, tvIdx = 0, tvList = [];
  function tvStories() {
    const S = SIM.S;
    if (!D.CHANNELS.some(c => c.id === S.ui.tvChannel)) S.ui.tvChannel = D.CHANNELS[0].id;
    const chId = S.ui.tvChannel;
    return KY.media.forChannel(chId, 10);
  }
  function drawTv() {
    const box = U.$('#tv');
    if (!box) return;
    const S = SIM.S;
    const ch = chOf(S.ui.tvChannel || D.CHANNELS[0].id);
    tvList = tvStories();
    const a = tvList[tvIdx % Math.max(1, tvList.length)];
    const cv = U.$('canvas', box);
    const w = 640, h = 360;
    if (a) {
      const ev = a.ev ? KY.events.byId(a.ev) : null;
      const lon = ev ? ev.lon : a.c >= 0 ? SIM.W.cities[a.c].lon : a.n >= 0 ? SIM.W.nations[a.n].lon : null;
      const lat = ev ? ev.lat : a.c >= 0 ? SIM.W.cities[a.c].lat : a.n >= 0 ? SIM.W.nations[a.n].lat : null;
      if (lon !== null) {
        KY.map.snapshot(lon, lat, w, h, a.c >= 0 || ev ? 150 : 260, cv);
        const g = cv.getContext('2d');
        const sx = w / 2, sy = h / 2 - 20;
        const bad = a.tone < -0.3;
        g.strokeStyle = bad ? 'rgba(255,80,60,0.95)' : 'rgba(255,215,130,0.95)'; g.lineWidth = 3;
        g.beginPath(); g.arc(sx, sy, 16, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(sx, sy, 32, 0, Math.PI * 2); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
        g.font = '700 16px Inter, sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 4;
        const t = (a.c >= 0 ? SIM.cName(a.c) + ', ' : '') + (a.n >= 0 ? SIM.nName(a.n) : '');
        g.strokeText(t.toUpperCase(), sx + 40, sy + 6); g.fillText(t.toUpperCase(), sx + 40, sy + 6);
      } else {
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#05070b'); gr.addColorStop(1, ch.color);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.12; g.font = '800 140px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(ch.short, 30, 220); g.globalAlpha = 1;
      }
      const g = cv.getContext('2d');
      const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    } else {
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = '#05070b'; g.fillRect(0, 0, w, h);
    }
    box.className = 'tv ' + (ch.font || 'sans');
    const kick = a ? (a.breaking ? ch.breaking : a.about ? 'MANDAT' : a.cat.toUpperCase()) : '';
    U.setHTML(U.$('.logo', box), esc(ch.short));
    U.$('.logo', box).style.background = ch.color;
    U.setHTML(U.$('.lower', box), a ? `<span class="kick" style="background:${a.breaking ? '#c8102e' : ch.color}">${esc(kick)}</span><div class="hl">${esc(a.h)}</div><span class="who">${esc(U.pick(ch.shows))} · ${esc(ch.anchors[tvIdx % ch.anchors.length])}</span>` : `<div class="hl">${esc(ch.slogan || ch.name)}</div>`);
    const crawl = tvList.slice(0, 8).map(x => x.h).join('   +++   ') + '   +++   ' + D.TICKER.filler.slice(0, 4).join('   +++   ');
    const cr = U.$('.crawl span', box);
    if (cr.textContent !== crawl) cr.textContent = crawl;
  }
  function startTv() { stopTv(); tvIdx = 0; drawTv(); tvTimer = setInterval(() => { tvIdx++; drawTv(); }, 7000); }
  function stopTv() { if (tvTimer) clearInterval(tvTimer); tvTimer = null; }
  A.tvCh = b => { SIM.S.ui.tvChannel = b.dataset.v; tvIdx = 0; ui.renderPanel(true); drawTv(); };
  A.tvNext = () => { tvIdx++; drawTv(); };
  A.tvPrev = () => { tvIdx = Math.max(0, tvIdx - 1); drawTv(); };

  KY.P.medien = {
    title: 'Medienzentrum', kicker: 'Weltöffentlichkeit', wide: true,
    tabs: [{ id: 'tv', n: 'Fernsehen' }, { id: 'presse', n: 'Presse' }, { id: 'netz', n: 'Soziale Netze' }, { id: 'umfragen', n: 'Umfragen' }],
    sub: () => 'Haltung der Welt ' + U.sgn(SIM.worldOp(), 1) + ' · ' + U.pct(SIM.worldAware(), 0) + ' wissen von einem anonymen Geldgeber',
    onOpen() { if ((ui.st.tab.medien || 'tv') === 'tv') setTimeout(startTv, 30); },
    onClose: stopTv,
    after() { if ((ui.st.tab.medien || 'tv') === 'tv') { if (!tvTimer) startTv(); else drawTv(); } else stopTv(); },
    render(tab) {
      const S = SIM.S;
      tab = tab || 'tv';
      if (tab === 'tv') {
        if (!D.CHANNELS.some(c => c.id === S.ui.tvChannel)) S.ui.tvChannel = D.CHANNELS[0].id;
        const cur = S.ui.tvChannel;
        const ch = chOf(cur);
        const list = KY.media.forChannel(cur, 14);
        return `<div class="chans">${D.CHANNELS.map(c => `<button class="${c.id === cur ? 'on' : ''}" data-a="tvCh" data-v="${c.id}"><i style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>
          <div class="grid2" style="grid-template-columns:1.35fr 1fr;gap:16px;align-items:start"><div>
          <div class="tv" id="tv"><canvas></canvas><div class="live"><i></i>LIVE</div><div class="logo"></div><div class="lower"></div><div class="crawl"><span></span></div></div>
          <div class="row sb" style="margin-top:8px"><div class="dim" style="font-size:12px">${esc(ch.kind)} · „${esc(ch.slogan)}“</div><div class="row" style="gap:4px"><button class="iconbtn" data-a="tvPrev" title="Vorige Meldung">${ic('chevL', 16)}</button><button class="iconbtn" data-a="tvNext" title="Nächste Meldung">${ic('chevR', 16)}</button></div></div>
          <div class="card" style="margin-top:10px"><div class="lbl">Redaktionelle Linie</div>${[['Sensationslust', ch.bias.sens], ['Wirtschaftsfokus', ch.bias.biz], ['Kritisch gegenüber dem Geldgeber', ch.bias.crit], ['Gesellschaftsthemen', ch.bias.social]].map(x => `<div class="bars"><div class="b"><span>${x[0]}</span>${ui.meter(x[1] * 100, ch.color === '#1d4e89' ? 'var(--blue)' : ch.color)}<span>${Math.round(x[1] * 100)}</span></div></div>`).join('')}<div class="dim" style="font-size:11px;margin-top:6px">Moderation: ${ch.anchors.map(esc).join(', ')}</div></div>
          </div><div>${list.map(MU.artRow).join('') || '<div class="empty">Dieser Sender hat noch nichts berichtet.</div>'}</div></div>`;
      }
      if (tab === 'presse') {
        const f = ui.st.filter.presse || 'alle';
        const cats = ['alle', 'Mandat', 'Katastrophen', 'Politik', 'Diplomatie', 'Wirtschaft', 'Wissenschaft', 'Umfragen'];
        const list = S.news.filter(a => f === 'alle' || a.cat === f).slice(0, 80);
        return `<div class="row" style="gap:5px;flex-wrap:wrap;margin-bottom:6px">${cats.map(c => `<button class="chip ${c === f ? 'gold' : 'ghost'}" data-a="presseF" data-v="${c}">${c === 'alle' ? 'Alle' : c === 'Mandat' ? 'Über Sie' : c}</button>`).join('')}</div>` + (list.map(MU.artRow).join('') || '<div class="empty">Keine Meldungen.</div>');
      }
      if (tab === 'netz') {
        const tr = KY.media.trends();
        const COL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
        return `<div class="grid2" style="grid-template-columns:1fr 2fr;gap:18px;align-items:start"><div><div class="h3">Trends</div>${tr.map((t, i) => `<div class="kv"><span>${i + 1}. <b style="color:var(--text)">${esc(t.tag)}</b></span><span class="dim">${U.count(t.v)}</span></div>`).join('') || '<div class="empty">Noch keine Trends.</div>'}
          <div class="h3">Stimmung im Netz</div>${netMood()}</div><div>${S.social.slice(0, 60).map(p => `<div class="post"><div class="av" style="background:${COL[p.handle.length % COL.length]}">${esc(p.name[0] || '?')}</div><div style="flex:1;min-width:0"><div class="nm">${esc(p.name)} <span>${esc(p.handle)} · ${ui.dayAgo(p.day)} · ${esc(SIM.nName(p.n))}</span></div><div class="tx">${esc(p.text)}</div><div class="ac"><span>${ic('chat', 12)} ${U.count(p.replies)}</span><span>${ic('refresh', 12)} ${U.count(p.shares)}</span><span>${ic('heart', 12)} ${U.count(p.likes)}</span></div></div></div>`).join('') || '<div class="empty">Noch ist es still.</div>'}</div></div>`;
      }
      // Umfragen
      const ns = S.nations.map((n, id) => ({ id, n })).filter(x => x.n.aware >= 5).sort((a, b) => b.n.op - a.n.op);
      let h = '<div class="grid2" style="gap:18px;align-items:start"><div>';
      h += '<div class="h3">Haltung nach Milieus (weltweit)</div><div class="bars">' + D.MILIEUS.map((m, i) => {
        let s = 0, w = 0;
        S.nations.forEach(n => { const k = n.pop * n.milW[i] * (0.1 + n.aware / 100); s += n.milOp[i] * k; w += k; });
        const v = w ? s / w : 0;
        return `<div class="b"><span>${esc(m.n)}</span>${ui.dmeter(U.clamp(v, -100, 100))}<span class="${v > 2 ? 'good' : v < -2 ? 'bad' : ''}">${U.sgn(v, 1)}</span></div>`;
      }).join('') + '</div>';
      const wh = worldOpHist();
      if (wh.length > 2) h += '<div class="h3">Haltung der Welt im Verlauf</div>' + KY.chart.line(KY.chart.monthly(wh, S.day), { h: 110, zero: true, color: '#3987e5', fmt: v => U.sgn(v, 1) });
      h += '</div><div><div class="h3">Letzte Umfragen</div>';
      if (!ns.length) h += '<div class="empty">Noch kennt Sie niemand. Umfragen gibt es erst, wenn über den anonymen Geldgeber gesprochen wird.</div>';
      ns.forEach(x => {
        const p = x.n.lastPoll;
        h += `<div class="bars"><div class="b" data-a="nation" data-id="${x.id}" style="cursor:pointer"><span>${KY.flag(SIM.W.nations[x.id], 12)} ${esc(SIM.W.nations[x.id].short)}</span>${ui.dmeter(U.clamp(x.n.op, -100, 100))}<span>${p ? U.pct(p.pct, 0) : U.sgn(x.n.op, 0)}</span></div></div>`;
      });
      return h + '<div class="dim" style="font-size:11px;margin-top:8px">Balken: Haltung zum anonymen Geldgeber (−100 bis +100). Zahl: Zustimmung in der letzten Umfrage.</div></div></div>';
    },
  };
  A.presseF = b => { ui.st.filter.presse = b.dataset.v; ui.renderPanel(true); };
  function netMood() {
    const S = SIM.S;
    const rec = S.social.filter(p => S.day - p.day <= 30);
    if (!rec.length) return '<div class="dim" style="font-size:12px">Keine Beiträge in den letzten 30 Tagen.</div>';
    const pos = rec.filter(p => p.tone > 0.2).length, neg = rec.filter(p => p.tone < -0.2).length, neu = rec.length - pos - neg;
    const r = (n, l, col) => `<div class="bars"><div class="b"><span>${l}</span>${ui.meter(n / rec.length * 100, col)}<span>${Math.round(n / rec.length * 100)} %</span></div></div>`;
    return r(pos, 'Positiv', 'var(--blue)') + r(neu, 'Neutral', '#7d8a9a') + r(neg, 'Negativ', '#e66767');
  }
  function worldOpHist() {
    const S = SIM.S;
    const L = Math.min.apply(null, S.nations.map(n => n.hist.op.length));
    const out = [];
    for (let i = 0; i < L; i++) {
      let s = 0, w = 0;
      S.nations.forEach(n => { const v = n.hist.op[n.hist.op.length - L + i]; s += v * n.pop; w += n.pop; });
      out.push(w ? s / w : 0);
    }
    return out;
  }
})();
