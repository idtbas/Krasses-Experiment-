/* KYTHERA · Modul Netzwerk */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  const STORY = {
    P01: S => S.user.clr >= 4
      ? 'VESPER hat in den letzten sechs Wochen 31 Akten angefordert. Fast alle zu 1987 und 1988. Und einmal das Original der Charta aus Tresor 0. Das Original hat keinen geschwärzten Artikel 0. Die Abschriften schon.'
      : 'Gotthelm verwahrt 1,4 Millionen Dokumente. Ihr Vorgänger kannte mehr davon als jeder andere Sitz. Wenn Sie Stufe 4 erhalten, schreibe ich Ihnen.',
    P02: S => S.story.shownMsgs.HALVORSEN_1
      ? 'Ich habe Ihnen alles geschrieben. Das Dach des Nebengebäudes. Von unten nicht lesbar. Ihre Satelliten sehen besser als ich.'
      : 'Ich fahre, wohin man mich schickt. Im August war das Kythera. Fragen Sie mich wieder, wenn Sie mehr Freigabe haben. Ich will keinen Ärger mit dem Vorsitz.',
    P18: () => 'Kernprozess 0 läuft seit dem 21. Oktober 1987 ohne Benutzerkennung. Im September hat er bei pausierter Last 4 Minuten 12 Sekunden Rechenzeit angefordert. Ich habe es gemeldet. Niemand hat geantwortet.',
    P22: () => 'Ich beglaubige den Proxy von Sitz VIII seit 2004, mein Vater hat es vorher getan. Die Signatur kommt aus Kaldfjord, Prozess 0. Ich habe nie gefragt, wer den Prozess bedient. Mein Vater hat es, einmal. Er bekam keine Antwort.',
    P28: S => { KY.flag('helios', true); return 'Die Skizze von 1901 existiert. Ich habe sie 1998 dem Kuratorium als Leihgabe überlassen, unter einer Bedingung: verschlüsselt, mit einem Kennwort, das nur ich kenne. VESPER hat es von mir bekommen. Jetzt bekommen Sie es: HELIOS.'; },
    P25: () => 'Off the record? Ich weiß, dass hinter der Stiftung Serrano mehr steckt als Kulturförderung. Ich weiß nicht, was. Solange niemand zu Schaden kommt, ist das für mich eine Geschichte, die warten kann.',
  };

  KY.mod.netzwerk = {
    mount(el, arg) {
      const D = KY.data;
      this.el = el;
      this.sel = arg && D.people.find(p => p.id === arg) ? arg : 'P01';
      this.q = '';
      this.tag = '';
      el.innerHTML = KY.ui.head({ crumb: 'Kuratorium', code: 'NW-09', title: 'Netzwerk', sub: '32 Personen, die Sitz IX vertrauen, zuarbeiten oder zumindest zuhören. Partner mit passender Fachrichtung erhöhen die Erfolgschancen Ihrer Vorhaben.' }) +
        '<section class="pn tick"><div class="pn-h"><h3>Beziehungsgeflecht</h3><div class="tools"><span class="meta">Knotengröße: Vertrauen · Linien: bekannte Verbindungen</span></div></div><div class="pn-b flush"><div class="graph-wrap" id="nwGraph"><canvas></canvas></div></div></section>' +
        '<div class="g g-side mt12"><section class="pn"><div class="pn-h"><input class="inp" id="nwQ" placeholder="Name, Rolle, Region …" style="height:26px"></div><div class="pn-b flush"><div class="row wrap" style="gap:4px;padding:8px 10px;border-bottom:1px solid var(--line)" id="nwTags"></div><div id="nwList" style="max-height:560px;overflow-y:auto"></div></div></section>' +
        '<section class="pn" id="nwDos"></section></div>';
      el.querySelector('#nwQ').oninput = e => { this.q = e.target.value; this.rList(); };
      U.on(el, 'click', '[data-p]', (e, b) => this.select(b.dataset.p));
      U.on(el, 'click', '[data-tg]', (e, b) => { this.tag = this.tag === b.dataset.tg ? '' : b.dataset.tg; this.rTags(); this.rList(); });
      U.on(el, 'click', '[data-pa]', (e, b) => this.act(b.dataset.pa));
      this.sub = KY.bus.on('people', () => { this.dirty = true; });
      this.rTags(); this.rList(); this.rDos();
      this.graph();
    },
    arg(a) { if (a && KY.data.people.find(p => p.id === a)) this.select(a); },
    unmount() { this.sub(); this.alive = false; },
    tick() { if (this.dirty) { this.dirty = false; this.rList(); this.rDos(); } else this.rDos(); },
    select(id) { this.sel = id; this.rList(); this.rDos(); if (KY.audio) KY.audio.play('click'); },
    rTags() {
      U.setHTML(this.el.querySelector('#nwTags'), Object.entries(KY.data.tagNames).map(([k, n]) => '<button class="chip' + (this.tag === k ? '" style="border-color:var(--acc);color:var(--acc2)' : '') + '" data-tg="' + k + '">' + n + '</button>').join(''));
    },
    rList() {
      const S = KY.S, D = KY.data, q = U.norm(this.q);
      const list = D.people.filter(p => (!q || U.norm(p.n + ' ' + p.role + ' ' + p.org + ' ' + D.regions[p.r].name).indexOf(q) >= 0) && (!this.tag || p.tags.indexOf(this.tag) >= 0));
      U.setHTML(this.el.querySelector('#nwList'), list.map(p => {
        const st = S.people[p.id];
        return '<div class="li' + (p.id === this.sel ? ' on' : '') + '" data-p="' + p.id + '">' + C.avatar(p.id, 30) + '<div class="body"><div class="t">' + U.esc(p.n) + '</div><div class="m ell">' + U.esc(p.role) + '</div></div><div class="col" style="align-items:flex-end;gap:3px"><span class="mono small">' + U.n(st.trust) + '</span>' + (st.busy ? '<span class="tag">' + st.busy + '</span>' : '') + '</div></div>';
      }).join('') || '<div class="empty">Keine Treffer.</div>');
    },
    rDos() {
      const S = KY.S, D = KY.data, p = D.people.find(x => x.id === this.sel), st = S.people[p.id];
      const links = D.links.filter(l => l[0] === p.id || l[1] === p.id).map(l => l[0] === p.id ? l[1] : l[0]);
      const cd = k => Math.max(0, (st[k] || -999) - S.t);
      const btn = (k, label, cost, cdk, extra) => {
        const c = cd(cdk);
        const ok = !c && KY.canPay(cost) && !extra;
        return '<button class="btn sm' + (ok ? '' : '') + '" data-pa="' + k + '"' + (ok ? '' : ' disabled') + ' data-tip="' + U.esc(extra || (c ? 'Wieder möglich in ' + U.dur(c) : KY.costText(cost))) + '">' + label + (c ? ' · ' + U.dur(c) : '') + '</button>';
      };
      const html = '<div class="pn-h"><h3>Dossier ' + p.id + '</h3><div class="tools">' + (st.busy ? C.pill('gebunden: ' + st.busy, 'acc') : C.pill('verfügbar', 'ok')) + '</div></div><div class="pn-b">' +
        '<div class="row" style="align-items:flex-start;gap:14px">' + C.avatar(p.id, 72) + '<div style="min-width:0;flex:1"><div class="serif" style="font-size:25px;line-height:1.1">' + U.esc(p.n) + '</div><div class="fg2 mt4">' + U.esc(p.role) + '</div><div class="xs mut mt4">' + U.esc(p.org) + ' · ' + D.regions[p.r].name + '</div><div class="row wrap mt8" style="gap:4px">' + p.tags.map(t => '<span class="tag acc">' + D.tagNames[t] + '</span>').join('') + '</div></div></div>' +
        '<p class="mt12" style="line-height:1.6">' + U.esc(p.bio) + '</p>' +
        '<div class="mrow mt12" style="grid-template-columns:90px minmax(0,1fr) 40px"><span class="k">Vertrauen</span>' + C.meter(st.trust, 100, C.lvlCls(st.trust)) + '<span class="v">' + U.n(st.trust) + '</span></div>' +
        '<div class="lbl mt16" style="margin-bottom:6px">Bekannte Verbindungen</div><div class="row wrap" style="gap:4px">' + links.map(id => '<button class="chip" data-p="' + id + '">' + U.esc(D.people.find(x => x.id === id).n) + '</button>').join('') + '</div>' +
        (st.lastBrief ? '<div class="lbl mt16">Letztes Briefing</div><div class="mt8" style="border-left:2px solid var(--acc3);padding:6px 12px;background:var(--acc-bg);font-style:italic;line-height:1.6">„' + U.esc(st.lastBrief) + '“</div>' : '') +
        '</div><div class="pn-f">' + btn('pflege', 'Kontakt pflegen', { ein: 3 }, 'cdPflege') + btn('foerder', 'Arbeit fördern', { kap: 1 }, 'cdFoerder') + btn('brief', 'Briefing anfordern', {}, 'cdBrief', st.trust < 40 ? 'Erfordert Vertrauen ab 40' : null) +
        '<span class="sp"></span><button class="btn sm pri" data-pa="plan"' + (st.busy ? ' disabled' : '') + '>Für Vorhaben einplanen</button></div>';
      U.setHTML(this.el.querySelector('#nwDos'), html);
    },
    act(a) {
      const S = KY.S, D = KY.data, p = D.people.find(x => x.id === this.sel), st = S.people[p.id];
      if (a === 'pflege') {
        if (!KY.pay({ ein: 3 })) return;
        const d = U.ri(3, 6) * (st.trust > 70 ? 0.5 : 1);
        KY.trustAdj(p.id, d); st.cdPflege = S.t + 90;
        KY.log('net', 'Kontaktpflege ' + p.n + ' · Vertrauen +' + U.n(d, 0));
        KY.ui.flashMsg('Vertrauen ' + p.n + ' +' + U.n(d, 0), 'ok');
      } else if (a === 'foerder') {
        if (!KY.pay({ kap: 1 })) { KY.ui.flashMsg('Nicht genügend Kapital.', 'crit'); return; }
        KY.trustAdj(p.id, 8); KY.regAdj(p.r, { vert: 2 }); st.cdFoerder = S.t + 180;
        KY.log('net', 'Förderung ' + p.n + ' · ¤ 1 Mrd. · Vertrauen +8, Kooperation ' + D.regions[p.r].name + ' +2');
        KY.ui.flashMsg('Förderung zugesagt · Vertrauen +8', 'ok');
      } else if (a === 'brief') {
        if (st.trust < 40) return;
        st.cdBrief = S.t + 120;
        let txt;
        if (STORY[p.id]) txt = STORY[p.id](S);
        else {
          const R = S.regions[p.r];
          const weak = Object.keys(R.m).filter(k => k !== 'span' && k !== 'praes').sort((x, y) => R.m[x] - R.m[y])[0];
          txt = 'Aus meiner Sicht in ' + D.regions[p.r].name + ': ' + D.metricInfo[weak].name + ' ist der Engpass. Wer jetzt dort ansetzt, findet offene Türen. Ich kann für die nächsten Minuten Kontakte für ' + p.tags.map(t => D.tagNames[t]).join(' und ') + ' herstellen.';
          KY.addBuff({ kind: 'proj', type: Object.keys(D.projectTypes).filter(t => D.projectTypes[t].tags.some(x => p.tags.indexOf(x) >= 0)), succ: 8, region: p.r, ttl: 300, label: 'Kontakte ' + p.n });
        }
        st.lastBrief = txt;
        KY.log('net', 'Briefing ' + p.n);
        if (KY.audio) KY.audio.play('note');
      } else if (a === 'plan') {
        const T = Object.keys(D.projectTypes).find(t => D.projectTypes[t].tags[0] === p.tags[0] && KY.proj.available(t)) || 'INF';
        KY.ui.go('vorhaben', { plan: { type: T, rid: p.r, partners: [p.id] } });
        return;
      }
      this.rDos(); this.rList();
    },

    /* Kräftebasierter Beziehungsgraph */
    graph() {
      const S = KY.S, D = KY.data;
      const wrap = this.el.querySelector('#nwGraph'), cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
      const nodes = D.people.map((p, i) => ({ id: p.id, p, x: Math.cos(i / D.people.length * Math.PI * 2) * 160, y: Math.sin(i / D.people.length * Math.PI * 2) * 120, vx: 0, vy: 0 }));
      const byId = {}; nodes.forEach(n => { byId[n.id] = n; });
      const edges = D.links.map(([a, b]) => [byId[a], byId[b]]);
      let hover = null, W = 0, H = 0, dpr = 1;
      const size = () => { const r = wrap.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; };
      size();
      const ro = new ResizeObserver(size); ro.observe(wrap);
      this.alive = true;
      let iter = 0;
      const step = () => {
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01;
          const f = 2600 / d2;
          const d = Math.sqrt(d2);
          a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
        }
        edges.forEach(([a, b]) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 70) * 0.02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; });
        nodes.forEach(n => { n.vx -= n.x * 0.004; n.vy -= n.y * 0.006; n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; n.x = U.clamp(n.x, -W / 2 + 30, W / 2 - 30); n.y = U.clamp(n.y, -H / 2 + 24, H / 2 - 24); });
      };
      for (let i = 0; i < 200; i++) step();
      const draw = () => {
        if (!this.alive || !wrap.isConnected) { ro.disconnect(); return; }
        if (iter++ < 600) step();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2);
        const now = performance.now();
        edges.forEach(([a, b]) => {
          const on = this.sel === a.id || this.sel === b.id || hover === a || hover === b;
          ctx.strokeStyle = on ? 'rgba(201,165,92,0.7)' : 'rgba(120,130,140,0.18)';
          ctx.lineWidth = on ? 1.4 : 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
        nodes.forEach(n => {
          const st = S.people[n.id];
          const r = 4 + st.trust / 14;
          const sel = n.id === this.sel;
          const col = st.trust >= 60 ? '#2fb344' : st.trust >= 45 ? '#c9a55c' : st.trust >= 30 ? '#ec835a' : '#e04848';
          if (sel) { ctx.strokeStyle = 'rgba(236,208,150,' + (0.4 + Math.sin(now / 300) * 0.3) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = col; ctx.globalAlpha = st.busy ? 0.55 : 0.95;
          ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#0c0f12'; ctx.lineWidth = 2; ctx.stroke();
          if (sel || hover === n || n.p.story && KY.S.user.clr >= 4) {
            ctx.font = '11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = sel ? '#ecd096' : 'rgba(226,221,209,0.85)';
            ctx.fillText(n.p.n, n.x + r + 5, n.y + 4);
          }
        });
        ctx.restore();
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
      const pick = e => {
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left - W / 2, y = e.clientY - r.top - H / 2;
        let best = null, bd = 400;
        nodes.forEach(n => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } });
        return best;
      };
      cv.addEventListener('mousemove', e => { hover = pick(e); cv.style.cursor = hover ? 'pointer' : 'default'; });
      cv.addEventListener('mouseleave', () => { hover = null; });
      cv.addEventListener('click', e => { const n = pick(e); if (n) this.select(n.id); });
    },
  };
})();
