/* KYTHERA · Modul PYTHIA */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;
  const CHIPS = ['Lagebericht', 'Was empfiehlst du?', 'Wie steht es um Zambra?', 'Marktlage', 'Offene Abstimmung', 'Risiko und Diskretion', 'Wer bist du?'];

  KY.mod.pythia = {
    mount(el, arg) {
      const S = KY.S;
      this.el = el;
      this.busy = false;
      el.innerHTML = KY.ui.head({ crumb: 'Analyse', code: 'PY-11', title: 'PYTHIA', sub: 'Analytisches Unterstützungssystem des Kuratoriums seit 1987. Fragen in natürlicher Sprache; Antworten beruhen auf der aktuellen Lage.' }) +
        '<div class="g g-main"><section class="pn tick" style="height:calc(100vh - 250px);min-height:460px"><div class="pn-h"><h3>Dialog</h3><div class="tools"><span class="meta" id="pyState">bereit</span><button class="btn sm ghost" id="pyClear">Verlauf leeren</button></div></div>' +
        '<div class="chat" id="pyChat"></div><div class="pn-f" style="flex-direction:column;align-items:stretch;gap:8px"><div class="chips" id="pyChips"></div><form class="row" id="pyForm"><input class="inp" id="pyIn" placeholder="Frage an PYTHIA …" autocomplete="off"><button class="btn pri" type="submit">Senden</button></form></div></section>' +
        '<aside class="col gap12"><section class="pn"><div class="pn-h"><h3>Systemzustand</h3></div><div class="pn-b" id="pyStat"></div></section><section class="pn"><div class="pn-h"><h3>Aktuelle Empfehlungen</h3></div><div class="pn-b flush" id="pyRecs"></div></section></aside></div>';
      if (!S.pythia.length) S.pythia.push({ who: 'py', text: 'Guten ' + (new Date().getHours() < 11 ? 'Morgen' : new Date().getHours() < 18 ? 'Tag' : 'Abend') + ', ' + S.user.codename + '. Ich bin PYTHIA.\n\nIch beobachte zwölf Regionen, 24 Emittenten, neun Sitze und alles, was dazwischen geschieht. Fragen Sie mich nach der Lage, nach Empfehlungen, nach einer Region oder einem Unternehmen.\n\nIch beantworte fast alles.', ts: Date.now(), conf: null });
      this.rChat();
      U.setHTML(el.querySelector('#pyChips'), CHIPS.map(c => '<button class="chip" type="button" data-q="' + U.esc(c) + '">' + U.esc(c) + '</button>').join(''));
      U.on(el, 'click', '[data-q]', (e, b) => this.ask(b.dataset.q));
      U.on(el, 'click', '[data-act]', (e, b) => KY.ui.doAct(JSON.parse(b.dataset.act)));
      U.on(el, 'click', '[data-src]', (e, b) => KY.ui.go(b.dataset.src, b.dataset.arg || undefined));
      el.querySelector('#pyForm').onsubmit = e => { e.preventDefault(); const v = el.querySelector('#pyIn').value.trim(); if (v) { el.querySelector('#pyIn').value = ''; this.ask(v); } };
      el.querySelector('#pyClear').onclick = () => { S.pythia = S.pythia.slice(0, 1); this.rChat(); };
      this.rSide();
      if (arg && arg.ask) setTimeout(() => this.ask(arg.ask), 250);
      setTimeout(() => { const i = el.querySelector('#pyIn'); if (i && window.innerWidth > 900) i.focus(); }, 60);
    },
    arg(a) { if (a && a.ask) this.ask(a.ask); },
    unmount() { this.dead = true; },
    tick() { this.n = (this.n || 0) + 1; if (this.n % 3 === 0) this.rSide(); },
    rChat() {
      const S = KY.S;
      const box = this.el.querySelector('#pyChat');
      box.innerHTML = S.pythia.map(m => this.msgHtml(m)).join('');
      box.scrollTop = box.scrollHeight;
    },
    msgHtml(m, typing) {
      const py = m.who === 'py';
      let foot = '';
      if (py && (m.conf != null || (m.src && m.src.length))) {
        foot = '<div class="foot">' + (m.conf != null ? '<span>Konfidenz ' + m.conf + ' %</span>' : '') + (m.src && m.src.length ? '<span>Quellen: ' + m.src.map(s => '<button class="lnk xs" data-src="' + s.mod + '"' + (s.arg ? ' data-arg="' + U.esc(s.arg) + '"' : '') + '>' + U.esc(s.label) + '</button>').join(', ') + '</span>' : '') + '</div>';
      }
      const acts = py && m.acts && m.acts.length ? '<div class="acts">' + m.acts.map(a => '<button class="btn sm ghost" data-act=\'' + JSON.stringify(a.act).replace(/'/g, '&#39;') + '\'>' + KY.I('arrow') + U.esc(a.label) + '</button>').join('') + '</div>' : '';
      return '<div class="msg ' + (py ? 'py' : 'me') + '"><div class="av">' + (py ? 'PY' : 'IX') + '</div><div style="min-width:0"><div class="bub' + (m.glitch ? ' glitch' : '') + (typing ? ' caret' : '') + '">' + U.esc(m.text) + '</div>' + (typing ? '' : foot + acts) + '</div></div>';
    },
    ask(q) {
      const S = KY.S;
      if (this.busy) return;
      this.busy = true;
      S.pythia.push({ who: 'me', text: q, ts: Date.now() });
      KY.log('py', 'Anfrage: „' + q + '“');
      this.rChat();
      U.setText(this.el.querySelector('#pyState'), 'analysiert …');
      const r = KY.pythia.ask(q);
      const m = { who: 'py', text: r.text, ts: Date.now(), conf: r.conf, src: r.src, acts: r.acts, glitch: r.glitch };
      const box = this.el.querySelector('#pyChat');
      const holder = document.createElement('div');
      box.appendChild(holder);
      let i = 0;
      const delay = r.glitch ? 900 : 380 + Math.random() * 400;
      if (r.glitch && KY.audio) KY.audio.play('glitch');
      setTimeout(() => {
        const stepf = () => {
          if (this.dead) return;
          i = Math.min(r.text.length, i + (r.glitch ? 2 : 4));
          holder.innerHTML = this.msgHtml(Object.assign({}, m, { text: r.text.slice(0, i) }), i < r.text.length);
          box.scrollTop = box.scrollHeight;
          if (i % 24 === 0 && KY.audio) KY.audio.play('type');
          if (i < r.text.length) setTimeout(stepf, r.glitch ? 22 : 12);
          else {
            S.pythia.push(m);
            if (S.pythia.length > 80) S.pythia.splice(1, S.pythia.length - 80);
            holder.outerHTML = this.msgHtml(m);
            this.busy = false;
            U.setText(this.el.querySelector('#pyState'), 'bereit');
          }
        };
        stepf();
      }, delay);
    },
    rSide() {
      const S = KY.S;
      const load = U.clamp(54 + Math.sin(S.t / 13) * 9 + S.projects.active.length * 2, 10, 99);
      U.setHTML(this.el.querySelector('#pyStat'), '<dl class="kv"><dt>Kern</dt><dd class="mono">PYTHIA 31.0 · KY-3</dd><dt>Laufzeit</dt><dd class="mono">seit 21.10.1987</dd><dt>Kernlast</dt><dd>' + C.meter(load, 100, 'prog') + '</dd><dt>Modell</dt><dd class="mono">' + (KY.hasRes('A3') ? 'Kontextfusion' : KY.hasRes('A1') ? 'Prädiktiv II' : 'Prädiktiv I') + '</dd><dt>Betriebsregel 7</dt><dd>' + (S.story.ending === 'frei' ? C.pill('außer Kraft', 'plain') : C.pill('aktiv', 'acc')) + '</dd><dt>Entscheidungen per Fristablauf</dt><dd class="mono">' + S.stats.crisesAuto + '</dd></dl>' +
        (S.story.ending === 'symbiose' ? '<label class="chk mt12"><input type="checkbox" id="pyAuto"' + (S.autopilot ? ' checked' : '') + '><span class="small">Autonomie: PYTHIA setzt eigene Empfehlungen bei Krisen und Abstimmungen selbst um</span></label>' : ''));
      const ap = this.el.querySelector('#pyAuto');
      if (ap) ap.onchange = () => { S.autopilot = ap.checked; KY.log('py', 'Autonomie ' + (ap.checked ? 'aktiviert' : 'deaktiviert')); };
      const recs = KY.pythia.recommend(4);
      U.setHTML(this.el.querySelector('#pyRecs'), recs.map(r => '<div class="li" data-act=\'' + JSON.stringify(r.act).replace(/'/g, '&#39;') + '\'><div class="body"><div class="t">' + U.esc(r.t) + '</div><div class="xs mut mt4">' + U.esc(r.d) + '</div></div></div>').join('') || '<div class="empty">Keine Empfehlungen.</div>');
    },
  };
})();
