/* KYTHERA · Modul Archiv */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  KY.mod.archiv = {
    mount(el, arg) {
      this.el = el;
      this.sel = null;
      el.innerHTML = KY.ui.head({ crumb: 'Analyse', code: 'AR-13', title: 'Archiv', sub: 'Bestände der Archivanlage Gotthelm, digitalisiert ab 1957. Schwärzungen lassen sich mit Rechenzeit analysieren, sofern Ihre Freigabe ausreicht.' }) +
        '<div class="g g-side"><section class="pn"><div class="pn-h"><h3>Bestände</h3><div class="tools"><span class="meta" id="arCount"></span></div></div><div class="pn-b flush" id="arList"></div></section><div id="arView"></div></div>';
      U.on(el, 'click', '[data-doc]', (e, b) => this.open(b.dataset.doc));
      U.on(el, 'click', '[data-ana]', () => this.analyse());
      this.subs = ['clearance', 'story'].map(ev => KY.bus.on(ev, () => { this.rList(); if (this.sel === 'fragmente') this.open('fragmente'); }));
      this.rList();
      this.open(arg || 'KY-0412');
    },
    arg(a) { if (a) this.open(a); },
    unmount() { this.subs.forEach(f => f()); clearTimeout(this.anaT); },
    tick() {},
    visible(d) { return d.id !== 'KY-0000' || KY.S.story.ending; },
    rList() {
      const S = KY.S, D = KY.data;
      const docs = D.archive.filter(d => this.visible(d) || d.id === 'KY-0000');
      const fr = Object.keys(S.story.frags).length;
      let h = '<div class="li' + (this.sel === 'fragmente' ? ' on' : '') + '" data-doc="fragmente"><div class="ic" style="border-color:var(--acc3);color:var(--acc)">' + KY.I('key') + '</div><div class="body"><div class="t">Schlüsselfragmente</div><div class="m">' + fr + ' von 4 gesichert</div></div></div>';
      [3, 4, 5].forEach(lvl => {
        const g = docs.filter(d => d.clr === lvl);
        if (!g.length) return;
        h += '<div class="lbl" style="padding:12px 12px 6px">Freigabestufe ' + lvl + (S.user.clr < lvl ? ' · gesperrt' : '') + '</div>';
        h += g.map(d => {
          const locked = S.user.clr < d.clr;
          const hidden = d.id === 'KY-0000' && !S.story.ending;
          return '<div class="li' + (this.sel === d.id ? ' on' : '') + (locked ? '" style="opacity:.55' : '') + '" data-doc="' + d.id + '"><div class="ic mono" style="width:auto;padding:0 6px;font-size:9.5px">' + (locked ? KY.I('lock') : d.id.slice(3)) + '</div><div class="body"><div class="t">' + (hidden ? '████████████' : U.esc(d.title)) + '</div><div class="m">' + d.id + ' · ' + (d.date === 'heute' ? U.date(new Date()) : d.date) + (d.enc && !S.archive.unlocked[d.id] ? ' · verschlüsselt' : '') + (S.archive.read[d.id] ? '' : ' · <span class="acc">neu</span>') + '</div></div></div>';
        }).join('');
      });
      U.setHTML(this.el.querySelector('#arList'), h);
      U.setText(this.el.querySelector('#arCount'), docs.filter(d => S.user.clr >= d.clr).length + ' zugänglich');
    },
    open(id) {
      const S = KY.S, D = KY.data;
      this.sel = id;
      const box = this.el.querySelector('#arView');
      if (id === 'fragmente') { this.frags(box); this.rList(); return; }
      const d = D.archive.find(x => x.id === id);
      if (!d) return;
      if (S.user.clr < d.clr) {
        if (KY.audio) KY.audio.play('deny');
        box.innerHTML = '<section class="pn"><div class="pn-b"><div class="empty"><b>Zugriff verweigert</b>' + d.id + ' erfordert Freigabestufe ' + d.clr + '. Ihre Freigabe: ' + S.user.clr + '.<div class="mono xs mt12">Zugriffsversuch protokolliert.</div></div></div></section>';
        KY.log('arc', 'Zugriff verweigert: ' + d.id + ' (Stufe ' + d.clr + ')');
        this.rList();
        return;
      }
      if (d.enc && !S.archive.unlocked[d.id]) {
        box.innerHTML = '<section class="pn tick"><div class="pn-h"><h3>' + d.id + ' · verschlüsselte Leihgabe</h3></div><div class="pn-b"><div class="empty" style="padding:30px 10px"><b>' + U.esc(d.title) + '</b>Diese Leihgabe ist mit einem Kennwort des Leihgebers geschützt. Quelle: ' + U.esc(d.src) + '.' +
          '<form class="row mt16" id="arPw" style="max-width:360px;margin-inline:auto"><input class="inp mono" id="arPwIn" placeholder="Kennwort" autocomplete="off" style="letter-spacing:.2em;text-transform:uppercase"><button class="btn pri" type="submit">Öffnen</button></form></div></div></section>';
        box.querySelector('#arPw').onsubmit = e => {
          e.preventDefault();
          const v = box.querySelector('#arPwIn').value.trim().toUpperCase();
          if (v === d.enc) {
            S.archive.unlocked[d.id] = true;
            KY.log('arc', 'Leihgabe ' + d.id + ' entschlüsselt');
            if (KY.audio) KY.audio.play('grant');
            this.open(d.id);
          } else {
            KY.log('arc', 'Falsches Kennwort für ' + d.id);
            if (KY.audio) KY.audio.play('deny');
            KY.ui.flashMsg('Kennwort abgelehnt.', 'crit');
          }
        };
        this.rList();
        return;
      }
      if (!S.archive.read[d.id]) { S.archive.read[d.id] = Date.now(); KY.log('arc', 'Gelesen: ' + d.id + ' · ' + d.title); }
      const reds = this.redactions(d);
      const open = reds.filter(r => !r.rev);
      const nextR = open.find(r => !r.perm && r.clr <= S.user.clr);
      const body = this.renderBody(d);
      box.innerHTML = '<article class="doc"><div class="dh"><div style="min-width:0"><div class="lbl" style="color:var(--acc)">' + d.id + ' · ' + d.kind + '</div><h2 class="mt4">' + U.esc(d.title) + '</h2><div class="mono xs mut mt8">' + (d.date === 'heute' ? U.date(new Date()) : d.date) + ' · ' + U.esc(d.src) + '</div></div><span class="stamp">Streng geheim · Stufe ' + d.clr + '</span></div>' + body + '</article>' +
        '<section class="pn mt12"><div class="pn-b row wrap"><span class="small fg2">' + (reds.length ? reds.filter(r => r.rev).length + ' von ' + reds.length + ' Schwärzungen aufgehoben' + (open.some(r => r.perm) ? ' · Originalschwärzung nicht analysierbar' : '') + (open.some(r => !r.perm && r.clr > S.user.clr) ? ' · teilweise höhere Freigabe erforderlich' : '') : 'Keine Schwärzungen') + '</span><span class="sp"></span>' +
        (nextR ? '<button class="btn pri" data-ana="1"' + (S.res.rech < nextR.cost ? ' disabled' : '') + '>' + KY.I('eye') + 'Schwärzung analysieren · ' + nextR.cost + ' EF</button>' : '') + '</div></section>';
      this.rList();
    },
    redactions(d) {
      const S = KY.S, out = [];
      const re = /\{\{(r\d+):([^}]*)\}\}/g;
      let m;
      while ((m = re.exec(d.body))) {
        const spec = d.red[m[1]] || {};
        out.push({ id: m[1], text: m[2], perm: !!spec.perm && !S.story.ending, clr: spec.clr || d.clr, cost: spec.cost || 10, frag: spec.frag, rev: !!S.archive.rev[d.id + ':' + m[1]] || (spec.perm && S.story.ending) });
      }
      return out;
    },
    renderBody(d) {
      const S = KY.S;
      const reds = {};
      this.redactions(d).forEach(r => { reds[r.id] = r; });
      let txt = d.body.replace('{codename}', S.user.codename);
      const paras = txt.split(/\n\n+/);
      return paras.map(p => {
        if (p.indexOf('## ') === 0) return '<h4>' + U.esc(p.slice(3)) + '</h4>';
        let html = U.esc(p).replace(/\{\{(r\d+):([^}]*)\}\}/g, (all, rid, t) => {
          const r = reds[rid];
          if (r.rev) return '<span class="revealed">' + t + '</span>';
          const cls = r.perm ? 'redact lock' : 'redact';
          return '<span class="' + cls + '" data-rid="' + rid + '">' + t.replace(/\S/g, '█') + '</span>';
        });
        return '<p>' + html.replace(/\n/g, '<br>') + '</p>';
      }).join('');
    },
    analyse() {
      const S = KY.S, D = KY.data, d = D.archive.find(x => x.id === this.sel);
      if (!d || this.anaT) return;
      const r = this.redactions(d).find(x => !x.rev && !x.perm && x.clr <= S.user.clr);
      if (!r) return;
      if (!KY.pay({ rech: r.cost })) { KY.ui.flashMsg('Nicht genügend Rechenkontingent.', 'crit'); return; }
      const span = this.el.querySelector('[data-rid="' + r.id + '"]');
      if (span) span.classList.add('scan');
      if (KY.audio) KY.audio.play('scan');
      const btn = this.el.querySelector('[data-ana]');
      if (btn) { btn.disabled = true; btn.textContent = 'Analyse läuft …'; }
      this.anaT = setTimeout(() => {
        this.anaT = null;
        S.archive.rev[d.id + ':' + r.id] = Date.now();
        KY.log('arc', 'Schwärzung aufgehoben: ' + d.id + ' / ' + r.id);
        if (r.frag) KY.story.fragment(r.frag);
        if (KY.audio) KY.audio.play('ok');
        if (this.sel === d.id) this.open(d.id);
      }, 2400);
    },
    frags(box) {
      const S = KY.S, D = KY.data;
      const all = Object.keys(S.story.frags).length === 4;
      box.innerHTML = '<section class="pn tick"><div class="pn-h"><h3>Schlüsselfragmente</h3><div class="tools"><span class="meta">Zugang zu Artikel 0</span></div></div><div class="pn-b">' +
        '<p class="fg2" style="max-width:70ch;line-height:1.6">Hier werden Codefragmente gesammelt, die in Dokumenten, Depeschen und Aufnahmen auftauchen. ' + (all ? 'Alle vier Teile liegen vor. Die Reihenfolge folgt den Buchstaben.' : 'Ihr Vorgänger hat einen Zugang in Teile zerlegt. Wo die übrigen liegen, ist nicht verzeichnet.') + '</p>' +
        '<div class="g g4 mt16">' + ['A', 'B', 'G', 'D'].map(k => {
          const f = D.fragments[k], got = S.story.frags[k];
          return '<div class="frag-card' + (got ? ' got' : '') + '"><div class="L">' + f.letter + '</div><div class="code">' + (got ? f.code : '····') + '</div><div class="xs mut">' + (got ? 'Quelle: ' + f.where : 'nicht gefunden') + '</div></div>';
        }).join('') + '</div>' +
        (all ? '<div class="mt16 mono" style="font-size:20px;letter-spacing:.2em;text-align:center;color:var(--acc2)">' + ['A', 'B', 'G', 'D'].map(k => D.fragments[k].code).join(' – ') + '</div><p class="xs mut c mt8">Einzugeben im Terminal. Der Befehl steht im Verlauf von IX-alt.</p>' : '') +
        '</div></section>';
    },
  };
})();
