/* KYTHERA · Modul Kommunikation */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  const INTENTS = {
    dank: { n: 'Anerkennung aussprechen', t: 'Ich möchte Ihnen für Ihre Arbeit im Plenum danken.' },
    bitte: { n: 'Um Unterstützung bei der laufenden Vorlage bitten', t: 'Darf ich bei der laufenden Vorlage auf Ihre Stimme zählen?' },
    info: { n: 'Um Einschätzung bitten', t: 'Mich würde Ihre Einschätzung der Lage interessieren.' },
  };

  KY.mod.komm = {
    mount(el, arg) {
      this.el = el;
      this.f = 'alle';
      this.sel = arg || (KY.S.msgs[0] && KY.S.msgs[0].id);
      el.innerHTML = KY.ui.head({ crumb: 'Kuratorium', code: 'KO-10', title: 'Kommunikation', sub: 'Gesicherter Posteingang von Sitz IX. Ende-zu-Ende verschlüsselt, Zustellung über die Knoten des Kuratoriums.', act: '<button class="btn" id="kmNew">' + KY.I('komm') + 'Nachricht verfassen</button>' }) +
        '<div class="g g-side"><section class="pn"><div class="pn-h"><div class="seg" id="kmF">' + [['alle', 'Alle'], ['neu', 'Ungelesen'], ['sitze', 'Sitze'], ['andere', 'Andere']].map(([k, n]) => '<button data-f="' + k + '"' + (k === this.f ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div></div><div class="pn-b flush" id="kmList" style="max-height:calc(100vh - 290px);min-height:300px;overflow-y:auto"></div></section>' +
        '<section class="pn" id="kmView"></section></div>';
      U.on(el, 'click', '[data-f]', (e, b) => { this.f = b.dataset.f; U.$$('[data-f]', el).forEach(x => x.classList.toggle('on', x === b)); this.rList(); });
      U.on(el, 'click', '[data-m]', (e, b) => this.open(b.dataset.m));
      U.on(el, 'click', '[data-rep]', (e, b) => { KY.story.reply(this.sel, +b.dataset.rep); if (KY.audio) KY.audio.play('ok'); this.rView(); });
      U.on(el, 'click', '[data-link]', (e, b) => KY.ui.go(b.dataset.link, b.dataset.arg));
      el.querySelector('#kmNew').onclick = () => this.compose();
      this.sub = KY.bus.on('msgs', () => { this.dirty = true; });
      this.rList();
      if (this.sel) this.open(this.sel); else this.rView();
    },
    arg(a) { if (a) this.open(a); },
    unmount() { this.sub(); },
    tick() { if (this.dirty) { this.dirty = false; this.rList(); this.rView(); } },
    open(id) {
      const S = KY.S, m = S.msgs.find(x => x.id === id);
      this.sel = id;
      if (m && !m.read) {
        m.read = true;
        if (m.from === 'SEK') KY.onb('post');
        if (m.from === 'NULL' && KY.audio) KY.audio.play('glitch');
        KY.bus.emit('msgs');
      }
      this.rList(); this.rView();
    },
    rList() {
      const S = KY.S, D = KY.data;
      const seat = m => D.council.some(c => c.id === m.from);
      const list = S.msgs.filter(m => this.f === 'alle' || (this.f === 'neu' && !m.read) || (this.f === 'sitze' && seat(m)) || (this.f === 'andere' && !seat(m)));
      U.setHTML(this.el.querySelector('#kmList'), list.length ? list.map(m => {
        const s = KY.story.sender(m.from);
        return '<div class="li' + (m.id === this.sel ? ' on' : '') + (m.read ? '' : ' unread') + '" data-m="' + m.id + '"><div class="ic" style="' + (s.kind === 'null' ? 'border-color:var(--crit);color:var(--crit)' : s.kind === 'seat' ? 'border-color:var(--acc3);color:var(--acc)' : '') + '">' + U.esc(s.short) + '</div><div class="body"><div class="row"><span class="small ' + (m.read ? 'mut' : 'bold') + ' ell" style="flex:1">' + U.esc(s.name) + '</span><span class="mono xs mut">' + U.hm(new Date(m.ts)) + '</span></div><div class="t ell">' + U.esc(m.subj) + '</div></div></div>';
      }).join('') : '<div class="empty"><b>Keine Nachrichten</b></div>');
    },
    rView() {
      const S = KY.S, m = S.msgs.find(x => x.id === this.sel);
      const box = this.el.querySelector('#kmView');
      if (!m) { U.setHTML(box, '<div class="pn-b"><div class="empty"><b>Keine Nachricht ausgewählt</b></div></div>'); return; }
      const s = KY.story.sender(m.from);
      const isNull = m.from === 'NULL';
      let body = U.esc(m.body);
      body = body.replace(/(KY-\d{4})/g, '<button class="lnk" data-link="archiv" data-arg="$1">$1</button>').replace(/(DSP-\d{4})/g, '<button class="lnk" data-link="depeschen" data-arg="$1">$1</button>');
      U.setHTML(box, '<div class="pn-h"><h3>' + (isNull ? 'Absender nicht verifizierbar' : 'Nachricht') + '</h3><div class="tools">' + (isNull ? C.pill('Signatur ungültig', 'crit') : C.pill('Signatur geprüft', 'ok')) + '</div></div><div class="pn-b">' +
        '<div class="row" style="align-items:flex-start"><div class="li ic" style="width:42px;height:42px;padding:0;border:1px solid ' + (isNull ? 'var(--crit)' : 'var(--line3)') + ';display:grid;place-items:center;font:600 13px/1 var(--font-cond)">' + U.esc(s.short) + '</div><div style="min-width:0;flex:1;margin-left:12px"><div class="bold">' + U.esc(s.name) + '</div><div class="xs mut">' + U.esc(s.role || (s.kind === 'seat' ? 'Sitz des Kuratoriums' : s.kind === 'null' ? 'Zustellung über internen Knoten · Kennung IX-alt' : 'Systemnachricht')) + '</div></div><span class="mono xs mut">' + U.stamp(m.ts) + '</span></div>' +
        '<h2 class="serif" style="font-size:24px;font-weight:600;margin-top:16px">' + U.esc(m.subj) + '</h2>' +
        '<div class="' + (isNull ? 'mono' : 'serif') + '" style="white-space:pre-wrap;margin-top:12px;line-height:1.65;font-size:' + (isNull ? '14px' : '17px') + ';color:' + (isNull ? '#d9e3dc' : 'var(--fg)') + ';max-width:70ch">' + body + '</div>' +
        (m.replies ? '<div class="lbl mt16" style="margin-bottom:8px">' + (m.replied != null ? 'Ihre Antwort' : 'Antworten') + '</div>' + (m.replied != null ? '<div style="border-left:2px solid var(--acc);padding:6px 12px;background:var(--acc-bg)">' + U.esc(m.replies[m.replied].t) + '</div>' : '<div class="col">' + m.replies.map((r, i) => '<button class="opt" data-rep="' + i + '"><span class="on">' + String.fromCharCode(65 + i) + '</span><span class="t" style="font-weight:500">' + U.esc(r.t) + '</span></button>').join('') + '</div>') : '') +
        '</div>');
    },
    compose() {
      const S = KY.S, D = KY.data;
      const recips = D.council.filter(m => !m.proxy).map(m => ({ id: m.id, n: m.id + ' · Sitz ' + m.seat })).concat([{ id: 'HYDRA', n: 'HYDRA · Sitz VIII' }]);
      const body = document.createElement('div');
      body.innerHTML = '<div class="fld"><label for="cmTo">Empfänger</label><select class="inp" id="cmTo">' + recips.map(r => '<option value="' + r.id + '">' + r.n + '</option>').join('') + '</select></div>' +
        '<div class="fld mt12"><label for="cmI">Anliegen</label><select class="inp" id="cmI">' + Object.entries(INTENTS).map(([k, v]) => '<option value="' + k + '">' + v.n + '</option>').join('') + '</select></div>' +
        '<div class="fld mt12"><label for="cmT">Text</label><textarea class="inp" id="cmT" rows="4"></textarea></div>';
      const ta = body.querySelector('#cmT'), sel = body.querySelector('#cmI');
      const fill = () => { ta.value = INTENTS[sel.value].t + '\n\n' + S.user.codename + ' (IX)'; };
      sel.onchange = fill; fill();
      KY.ui.modal({
        lbl: 'Gesicherte Nachricht', title: 'Nachricht verfassen', body,
        actions: [{ label: 'Abbrechen', cls: 'ghost' }, { label: 'Senden', cls: 'pri', fn: () => { this.send(body.querySelector('#cmTo').value, sel.value, ta.value); } }],
      });
    },
    send(to, intent, text) {
      const S = KY.S, D = KY.data;
      KY.log('msg', 'Gesendet an ' + to + ': ' + INTENTS[intent].n);
      KY.ui.flashMsg('Nachricht an ' + to + ' zugestellt', 'ok');
      S.sentCool = S.sentCool || {};
      const key = to + intent;
      const cool = (S.sentCool[key] || 0) > S.t;
      S.sentCool[key] = S.t + 300;
      const delay = U.ri(12, 30);
      setTimeout(() => {
        if (!KY.S) return;
        if (to === 'HYDRA') {
          KY.story.sendCustom('SEK', 'Unzustellbar: Nachricht an Sitz VIII', 'Ihre Nachricht an Sitz VIII konnte nicht zugestellt werden. Für diesen Sitz ist kein persönliches Postfach hinterlegt. Stimmabgaben erfolgen über den beglaubigten Proxy (Charta, Anhang C).\n\nUrsprünglicher Text:\n' + text);
          return;
        }
        const m = D.council.find(x => x.id === to);
        const att = S.council.att[to];
        let reply;
        if (cool) reply = 'Sie haben mir dazu vor Kurzem bereits geschrieben. Ich habe es nicht vergessen.';
        else if (intent === 'dank') { KY.seatAdj(to, att > 40 ? 1 : 3); reply = { förmlich: 'Ihr Dank ist angekommen und vermerkt.', warm: 'Danke Ihnen. Das tut gut in diesen Wochen.', knapp: 'Zur Kenntnis genommen.', misstrauisch: 'Danke. Ich frage mich, was Sie als Nächstes brauchen.', neugierig: 'Oh, danke! Wir sollten uns einmal persönlich unterhalten.', diplomatisch: 'Ich weiß das zu schätzen. Der Ton im Plenum wird dadurch nicht schlechter.', direkt: 'Danke. Weiter so.' }[m.style]; }
        else if (intent === 'bitte') {
          const res = S.council.open;
          if (!res || !res.mine || res.mine === 'ENTH') reply = 'Ich weiß nicht, worum Sie mich bitten. Es liegt keine Vorlage vor, oder Sie haben noch keine Position bezogen.';
          else if (res.lobby[to]) reply = 'Wir sind uns bereits einig.';
          else if (att > 25 && Math.random() < 0.4 + att / 200) { res.lobby[to] = res.mine; KY.bus.emit('council'); reply = 'Einverstanden. Ich stimme mit Ihnen: ' + (res.mine === 'JA' ? 'Ja' : 'Nein') + '. Denken Sie daran, wenn ich Sie einmal brauche.'; KY.seatAdj(to, -1); }
          else { KY.seatAdj(to, -1); reply = 'Ich entscheide nach eigenem Ermessen. Bitte verstehen Sie das nicht als Unfreundlichkeit.'; }
        } else {
          const axis = Object.entries(m.prio).sort((a, b) => b[1] - a[1])[0][0];
          reply = 'Offen gesagt: Mich interessiert vor allem ' + D.axisNames[axis] + '. Vorlagen, die das stärken, unterstütze ich. Alles andere prüfe ich genau.';
        }
        KY.story.sendCustom(to, 'Re: ' + INTENTS[intent].n, reply + '\n\n' + m.sig);
      }, delay * 1000);
    },
  };
})();
