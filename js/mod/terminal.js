/* KYTHERA · Modul Terminal */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;

  const HELP = [
    ['hilfe', 'Diese Übersicht'],
    ['status [--all]', 'Lagezusammenfassung'],
    ['ls [-a] [pfad] · cd · pwd · cat <datei>', 'Dateisystem'],
    ['history', 'Befehlsverlauf dieses Terminals'],
    ['regionen · region <name>', 'Regionen und Dossiers'],
    ['markt [kürzel] · kaufe|verkaufe <kürzel> <mrd>', 'Kapitalmarkt'],
    ['vorhaben · plane <typ> <region>', 'Vorhaben anzeigen und planen'],
    ['sat · sat ausrichten <id> <region> · sat img <breite> <länge>', 'Satelliten und Bildaufklärung'],
    ['depesche [id] · entschluessele <id>', 'Depeschen'],
    ['archiv [öffnen <id>] · fragmente', 'Archiv und Schlüsselfragmente'],
    ['kuratorium [--analyse <sitz>] · stimme ja|nein|enthaltung', 'Plenum'],
    ['pythia "<frage>"', 'PYTHIA direkt befragen'],
    ['knoten · ping <knoten> · trace <knoten>', 'Netz'],
    ['gehe <bereich> · ton an|aus · akzent <name> · clear · logout', 'Bedienung'],
  ];

  KY.mod.terminal = {
    mount(el) {
      const S = KY.S;
      this.el = el;
      this.cwd = '/home/sitz9';
      this.hpos = S.term.hist.length;
      this.mode = null;
      el.innerHTML = KY.ui.head({ crumb: 'System', code: 'TE-15', title: 'Terminal', sub: 'Direkter Befehlszugriff auf KYTHERA. „hilfe“ listet alle Befehle. Tab vervollständigt, Pfeiltasten blättern im Verlauf.' }) +
        '<div class="term" id="term"><div id="tOut"></div><form class="in-row" id="tForm"><span class="p" id="tPrompt"></span><input id="tIn" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Befehlseingabe"></form></div>';
      this.out = el.querySelector('#tOut');
      this.inp = el.querySelector('#tIn');
      el.querySelector('#term').addEventListener('click', () => { if (!window.getSelection().toString()) this.inp.focus(); });
      el.querySelector('#tForm').onsubmit = e => { e.preventDefault(); const v = this.inp.value; this.inp.value = ''; this.exec(v); };
      this.inp.addEventListener('keydown', e => this.key(e));
      const buf = this.buf || [];
      this.buf = [];
      buf.slice(-300).forEach(l => this.print(l[0], l[1]));
      if (!buf.length) {
        this.print('KYTHERA Terminal 7.4.2 · Sitz IX · ' + U.stamp(Date.now()), 'h');
        this.print('Letzte Anmeldung an diesem Terminal: 10.09.2026 03:12:44 von IX-alt', 'd');
        this.print('Geben Sie „hilfe“ ein.', 'd');
        this.print('');
      }
      this.prompt();
      setTimeout(() => this.inp.focus(), 50);
    },
    unmount() {},
    tick() {},
    prompt() {
      const p = this.mode === 'key' ? 'SCHLÜSSEL> ' : 'sitz9@kythera:' + this.cwd.replace('/home/sitz9', '~') + '$';
      U.setText(this.el.querySelector('#tPrompt'), p);
    },
    print(txt, cls) {
      this.buf = this.buf || [];
      this.buf.push([txt, cls]);
      if (this.buf.length > 400) this.buf.splice(0, this.buf.length - 400);
      const d = document.createElement('div');
      d.className = 'ln' + (cls ? ' ' + cls : '');
      d.textContent = txt;
      this.out.appendChild(d);
      while (this.out.childNodes.length > 600) this.out.removeChild(this.out.firstChild);
      const t = this.el.querySelector('#term');
      t.scrollTop = t.scrollHeight;
      return d;
    },
    printHTML(html) {
      const d = document.createElement('div');
      d.className = 'ln';
      d.innerHTML = html;
      this.out.appendChild(d);
      const t = this.el.querySelector('#term');
      t.scrollTop = t.scrollHeight;
    },
    key(e) {
      const S = KY.S, H = S.term.hist;
      if (e.key === 'ArrowUp') { e.preventDefault(); if (this.hpos > 0) { this.hpos--; this.inp.value = H[this.hpos] || ''; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (this.hpos < H.length) { this.hpos++; this.inp.value = H[this.hpos] || ''; } }
      else if (e.key === 'Tab') { e.preventDefault(); this.complete(); }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); this.out.innerHTML = ''; }
      else if (KY.audio && e.key.length === 1) KY.audio.play('key');
    },
    complete() {
      const v = this.inp.value;
      const parts = v.split(/\s+/);
      const cmds = ['hilfe', 'status', 'ls', 'cd', 'pwd', 'cat', 'history', 'regionen', 'region', 'markt', 'kaufe', 'verkaufe', 'vorhaben', 'plane', 'sat', 'depesche', 'entschluessele', 'archiv', 'fragmente', 'kuratorium', 'stimme', 'pythia', 'knoten', 'ping', 'trace', 'gehe', 'ton', 'akzent', 'clear', 'logout', 'whoami', 'date', 'uptime', 'echo', 'man'];
      if (KY.flag('history') || KY.story.fragCount() >= 4) cmds.push('protokoll-null');
      if (parts.length === 1) {
        const m = cmds.filter(c => c.indexOf(parts[0]) === 0);
        if (m.length === 1) this.inp.value = m[0] + ' ';
        else if (m.length > 1) this.print(m.join('  '), 'd');
        return;
      }
      const last = parts[parts.length - 1];
      const dir = last.indexOf('/') >= 0 ? this.resolve(last.slice(0, last.lastIndexOf('/') + 1) || '/') : this.cwd;
      const ents = (KY.data.fs[dir] || []).filter(n => n.indexOf(last.slice(last.lastIndexOf('/') + 1)) === 0);
      if (ents.length === 1) { parts[parts.length - 1] = last.slice(0, last.lastIndexOf('/') + 1) + ents[0]; this.inp.value = parts.join(' '); }
      else if (ents.length > 1) this.print(ents.join('  '), 'd');
    },
    resolve(p) {
      if (!p || p === '~') return '/home/sitz9';
      if (p.indexOf('~') === 0) p = '/home/sitz9' + p.slice(1);
      let parts = p.indexOf('/') === 0 ? [] : this.cwd.split('/').filter(Boolean);
      p.split('/').filter(Boolean).forEach(x => { if (x === '..') parts.pop(); else if (x !== '.') parts.push(x); });
      return '/' + parts.join('/');
    },
    file(path) {
      const D = KY.data, S = KY.S;
      const f = D.files[path];
      if (f === undefined) return null;
      if (f === '@history') return D.vesperHistory.map((c, i) => U.pad(i + 1, 3) + '  2026-09-10 0' + (2 + Math.floor(i / 4)) + ':' + U.pad(10 + i * 3) + '  ' + c).join('\n');
      if (f === '@archiv') return D.archive.map(a => a.id + '  Stufe ' + a.clr + '  ' + (S.user.clr >= a.clr ? a.title : '█'.repeat(18))).join('\n');
      if (f === '@authlog') return S.log.filter(l => l.cat === 'sys').slice(-14).map(l => U.stamp(l.ts) + '  ' + l.text).join('\n') + '\n2026-09-10 03:12:44  Abmeldung IX-alt (Spuren gelöscht: nein)';
      if (f === '@nodes') return D.nodes.filter(n => !n.hidden || KY.flag('omegaTraced')).map(n => n.id + '  ' + n.name).join('\n');
      return f;
    },
    exec(raw) {
      const S = KY.S, D = KY.data;
      const line = raw.trim();
      this.print((this.mode === 'key' ? 'SCHLÜSSEL> ' : this.el.querySelector('#tPrompt').textContent + ' ') + (this.mode === 'key' ? line.replace(/./g, '•') : line), 'p');
      if (this.mode === 'key') { this.keyInput(line); return; }
      if (!line) return;
      S.term.hist.push(line);
      if (S.term.hist.length > 200) S.term.hist.shift();
      this.hpos = S.term.hist.length;
      const args = (line.match(/"[^"]*"|\S+/g) || []).map(a => a.replace(/^"|"$/g, ''));
      const cmd = U.norm(args.shift());
      const a = args;
      const o = (t, c) => this.print(t, c);
      try {
        switch (cmd) {
          case 'hilfe': case 'help': case '?':
            HELP.forEach(([c, d]) => o(c.padEnd(58) + d));
            o('');
            o('Weitere Befehle existieren. Nicht alle sind dokumentiert.', 'd');
            break;
          case 'clear': case 'cls': this.out.innerHTML = ''; this.buf = []; break;
          case 'whoami': o(S.user.codename + ' · Sitz IX · Freigabestufe ' + S.user.clr + (S.story.ending === 'archon' ? ' · Sitz 0' : '')); break;
          case 'date': o(new Date().toString()); break;
          case 'uptime': o('Sitzung ' + U.dur(S.t) + ' · Kern seit 21.10.1987 · ' + Math.floor((Date.now() - Date.parse('1987-10-21')) / 86400000) + ' Tage'); break;
          case 'echo': o(a.join(' ')); break;
          case 'pwd': o(this.cwd); break;
          case 'ls': {
            const all = a[0] === '-a' || a[0] === '-la';
            const p = this.resolve(a.filter(x => x[0] !== '-')[0] || this.cwd);
            const ents = D.fs[p];
            if (!ents) { o('ls: ' + p + ': Verzeichnis nicht gefunden', 'e'); break; }
            o(ents.filter(n => all || n[0] !== '.').map(n => (D.fs[p + (p === '/' ? '' : '/') + n] ? n + '/' : n)).join('   '));
            break;
          }
          case 'cd': {
            const p = this.resolve(a[0] || '~');
            if (!D.fs[p]) { o('cd: ' + p + ': Verzeichnis nicht gefunden', 'e'); break; }
            if (p.indexOf('/home/vesper') === 0) o('Hinweis: Arbeitsbereich IX-alt, schreibgeschützt.', 'w');
            this.cwd = p; this.prompt();
            break;
          }
          case 'cat': case 'less': case 'more': {
            if (!a[0]) { o('cat: Datei angeben', 'e'); break; }
            const p = this.resolve(a[0]);
            const f = this.file(p);
            if (f === null) { o('cat: ' + a[0] + ': Datei nicht gefunden', 'e'); break; }
            if (p === '/home/vesper/.verlauf') KY.flag('history', true);
            if (p === '/home/vesper/.kythera') KY.flag('kytheraCoords', true);
            f.split('\n').forEach(l => o(l));
            KY.log('sys', 'Terminal: Datei gelesen ' + p);
            break;
          }
          case 'history': {
            o('# Verlauf dieses Terminals (Sitzkennung IX-alt, vor Neuzuordnung)', 'd');
            D.vesperHistory.forEach((c, i) => o(U.pad(i + 1, 4) + '  ' + c, 'w'));
            o('# Verlauf Sitzkennung IX (' + S.user.codename + ')', 'd');
            S.term.hist.slice(-20).forEach((c, i) => o(U.pad(D.vesperHistory.length + i + 1, 4) + '  ' + c));
            if (!KY.flag('history')) { KY.flag('history', true); KY.log('sys', 'Terminal: Verlauf von IX-alt eingesehen'); }
            break;
          }
          case 'status': {
            const W = KY.wsim;
            o('Lagestufe ' + S.lagestufe + ' · Globale Stabilität ' + U.n(W.globalStab(), 1) + ' · Vermögen ' + U.money(KY.market.netWorth()));
            o('Liquidität ' + U.money(S.res.kap) + ' · Einfluss ' + U.n(S.res.ein) + ' · Rechenzeit ' + U.n(S.res.rech) + ' EF · Diskretion ' + U.n(S.res.disk) + ' · Ansehen ' + U.n(S.res.ans));
            o('Vorhaben aktiv ' + S.projects.active.length + ' · Forschung ' + (S.research.active ? KY.research.get(S.research.active.id).n : 'keine') + ' · Anomalien ' + S.integ.anomalies.filter(x => x.state === 'offen').length);
            if (a[0] === '--all') D.regionOrder.forEach(id => { const m = S.regions[id].m; o('  ' + id + '  ' + D.regions[id].name.padEnd(18) + ' STAB ' + U.n(m.stab).padStart(3) + '  WOHL ' + U.n(m.wohl).padStart(3) + '  SPAN ' + U.n(m.span).padStart(3) + '  PRÄS ' + U.n(m.praes).padStart(3) + '  ' + W.status(id).t); });
            break;
          }
          case 'regionen': case 'regions':
            D.regionOrder.forEach(id => o(id + '  ' + D.regions[id].name.padEnd(18) + KY.wsim.status(id).t));
            break;
          case 'region': {
            const id = this.findRegion(a.join(' '));
            if (!id) { o('region: unbekannte Region', 'e'); break; }
            KY.pythia.region({ text: '', acts: [], src: [] }, id).text.split('\n').forEach(l => o(l));
            break;
          }
          case 'markt': {
            if (a[0]) {
              const co = D.companies.find(c => c.t === a[0].toUpperCase());
              if (!co) { o('markt: Kürzel unbekannt', 'e'); break; }
              KY.pythia.company({ text: '', acts: [], src: [] }, co).text.split('\n').forEach(l => o(l));
            } else D.companies.forEach(c => { const m = S.market.c[c.t]; o(c.t.padEnd(5) + c.n.padEnd(28) + U.n(m.p, 2).padStart(10) + '  ' + U.sgn(KY.market.change(c.t, 60), 2, ' %').padStart(9) + '  Pos. ' + U.n(m.u * m.p, 2)); });
            break;
          }
          case 'kaufe': case 'verkaufe': case 'buy': case 'sell': {
            const t = (a[0] || '').toUpperCase(), amt = parseFloat((a[1] || '').replace(',', '.'));
            if (!D.companies.find(c => c.t === t) || !(amt > 0)) { o('Syntax: ' + cmd + ' <KÜRZEL> <MRD>', 'e'); break; }
            const r = KY.market.trade(t, cmd === 'kaufe' || cmd === 'buy' ? 'buy' : 'sell', amt);
            if (!r.ok) o(r.err, 'e'); else o('Ausgeführt. Kursimpuls ' + U.sgn(r.impact, 2, ' %') + ', Gebühr ' + U.money(r.fee), 'o');
            break;
          }
          case 'vorhaben':
            if (!S.projects.active.length) { o('Keine laufenden Vorhaben.'); break; }
            S.projects.active.forEach(p => o(p.id + '  ' + p.code.padEnd(18) + D.projectTypes[p.type].short.padEnd(10) + D.regions[p.rid].name.padEnd(18) + Math.round(KY.proj.progress(p) * 100) + ' %  ' + U.dur(KY.proj.remaining(p))));
            break;
          case 'plane': {
            const t = Object.keys(D.projectTypes).find(k => k === (a[0] || '').toUpperCase() || U.norm(D.projectTypes[k].name).indexOf(U.norm(a[0] || '§')) === 0);
            const rid = this.findRegion(a.slice(1).join(' '));
            if (!t) { o('Typen: ' + Object.keys(D.projectTypes).join(', '), 'e'); break; }
            o('Öffne Planung …', 'd');
            KY.ui.go('vorhaben', { plan: { type: t, rid: rid || S.atlasSel || 'MER' } });
            break;
          }
          case 'sat': this.sat(a); break;
          case 'depesche': case 'depeschen': {
            if (a[0] === 'senden') {
              if (!KY.flag('history')) KY.flag('history', true);
              o('depesche: DSP-0412 bereits archiviert. Archivkopie wurde zugestellt.', 'w');
              break;
            }
            if (a[0]) {
              const d = S.dsp.list.find(x => x.id === a[0].toUpperCase());
              if (!d) { o('depesche: nicht gefunden', 'e'); break; }
              if (d.enc) { o(d.id + ' ist verschlüsselt. „entschluessele ' + d.id + '“', 'w'); break; }
              o(d.subj, 'h'); d.body.split('\n').forEach(l => o(l));
            } else S.dsp.list.slice(0, 15).forEach(d => o(d.id + '  ' + (d.enc ? '[verschlüsselt]'.padEnd(36) : d.subj.slice(0, 34).padEnd(36)) + d.src));
            break;
          }
          case 'entschluessele': case 'entschlussele': case 'entschlusseln': case 'decrypt': {
            const id = (a[0] || '').toUpperCase();
            const r = KY.dsp.decrypt(id);
            if (!r.ok) o(r.err || 'decrypt: nicht möglich (unbekannt, bereits entschlüsselt oder in Arbeit)', 'e');
            else o('Entschlüsselung gestartet. Fortschritt unter „depesche“ oder im Bereich Depeschen.', 'o');
            break;
          }
          case 'archiv': {
            if (a[0] && (U.norm(a[0]) === 'offnen' || a[0] === 'open')) { o('Öffne ' + a[1] + ' …', 'd'); KY.ui.go('archiv', (a[1] || '').toUpperCase()); break; }
            this.file('/archiv/index.txt').split('\n').forEach(l => o(l));
            break;
          }
          case 'fragmente': case 'keys': case 'schluessel': case 'schlussel':
            ['A', 'B', 'G', 'D'].forEach(k => { const f = D.fragments[k]; o(f.letter + '  ' + (S.story.frags[k] ? f.code + '   (' + f.where + ')' : '····   nicht gefunden'), S.story.frags[k] ? 'o' : 'd'); });
            break;
          case 'kuratorium': {
            if (a[0] === '--analyse') {
              if (!KY.flag('hydraAudit')) {
                if (!KY.pay({ rech: 12 })) { o('Nicht genügend Rechenkontingent (12 EF).', 'e'); break; }
                KY.story.hydraAudit();
              }
              const rows = KY.council.analysis();
              D.council.forEach(m => { const r = rows[m.id]; o(('Sitz ' + m.seat).padEnd(10) + m.id.padEnd(8) + U.n(r.same / r.n * 100, 1).padStart(6) + ' %  Übereinstimmung mit PYTHIA', m.proxy ? 'w' : ''); });
              break;
            }
            const res = S.council.open;
            if (!res) { o('Keine Vorlage. Nächste in ' + U.dur(Math.max(0, S.timers.council - S.t))); break; }
            const t = KY.council.tally(res);
            o(res.no + ': ' + res.title, 'h');
            o('Prognose ' + t.JA + ' Ja / ' + t.NEIN + ' Nein / ' + t.ENTH + ' Enth. · PYTHIA: ' + res.py + ' · Restzeit ' + U.dur(res.until - S.t));
            break;
          }
          case 'stimme': {
            const v = { ja: 'JA', nein: 'NEIN', enthaltung: 'ENTH' }[U.norm(a[0] || '')];
            if (!v || !S.council.open) { o(S.council.open ? 'Syntax: stimme ja|nein|enthaltung' : 'Keine Vorlage zur Abstimmung.', 'e'); break; }
            KY.council.vote(v); o('Stimme abgegeben: ' + v, 'o');
            break;
          }
          case 'pythia': {
            const q = a.join(' ');
            if (!q) { o('Syntax: pythia "<frage>"', 'e'); break; }
            const r = KY.pythia.ask(q);
            r.text.split('\n').forEach(l => o(l, r.glitch ? 'e' : 'h'));
            if (r.conf != null) o('Konfidenz ' + r.conf + ' %', 'd');
            break;
          }
          case 'knoten': case 'netstat':
            D.nodes.forEach(n => {
              if (n.hidden && !KY.flag('omegaTraced') && !S.story.ending) { o('KY-?   ███████   Antwort außerhalb des Zeitfensters', 'd'); return; }
              const st = S.integ.nodes[n.id]; o(n.id.padEnd(7) + n.name.padEnd(14) + (n.hidden ? '−252000 ms' : Math.round(st.lat) + ' ms').padStart(11) + '   ' + (st.up ? 'online' : 'isoliert'));
            });
            break;
          case 'ping': {
            const n = D.nodes.find(x => x.id === (a[0] || '').toUpperCase() || x.id === (a[0] || '').toUpperCase().replace('OMEGA', 'Ω'));
            if (!n) { o('ping: Knoten unbekannt', 'e'); break; }
            if (n.hidden) { [1, 2, 3].forEach(i => o('Antwort von ' + n.id + ': Zeit=−' + (252000 + i * 3) + ' ms', 'w')); o('Antworten treffen vor den Anfragen ein.', 'd'); KY.flag('omegaPing', true); break; }
            const st = S.integ.nodes[n.id];
            [1, 2, 3].forEach(i => o('Antwort von ' + n.id + ': Zeit=' + Math.round(st.lat + U.gauss() * 3) + ' ms TTL=' + (64 - i)));
            break;
          }
          case 'trace': case 'traceroute': {
            const tgt = (a[0] || '').toUpperCase().replace('OMEGA', 'Ω');
            if (tgt === 'KY-Ω' || tgt === 'Ω') {
              o(' 1  KY-N1 Kap Orsa          2 ms'); o(' 2  KY-N4 Alamar           11 ms'); o(' 3  * * *'); o(' 4  34.2000 N 21.4000 E    −252 000 ms', 'w'); o('Ziel erreicht. Standort: Kythera, Nordspitze.', 'h');
              KY.flag('omegaTraced', true); KY.flag('kytheraCoords', true);
              break;
            }
            const n = D.nodes.find(x => x.id === tgt);
            if (!n) { o('trace: Knoten unbekannt', 'e'); break; }
            o(' 1  KY-N1 Kap Orsa          2 ms'); o(' 2  ' + n.id + ' ' + n.name.padEnd(14) + Math.round(S.integ.nodes[n.id].lat) + ' ms');
            break;
          }
          case 'gehe': case 'open': case 'oeffne': case 'offne': {
            const id = U.norm(a[0] || '');
            const it = []; KY.ui.NAV.forEach(g => g.items.forEach(x => it.push(x)));
            const f = it.find(x => x.id === id || U.norm(x.n).indexOf(id) === 0);
            if (!f) { o('gehe: Bereich unbekannt', 'e'); break; }
            KY.ui.go(f.id);
            break;
          }
          case 'ton': S.user.prefs.sound = U.norm(a[0]) !== 'aus'; KY.ui.applyPrefs(); o('Ton ' + (S.user.prefs.sound ? 'an' : 'aus')); break;
          case 'akzent': {
            const v = U.norm(a[0] || '');
            const ok = ['messing', 'eis', 'signal'].concat(S.story.ending === 'archon' ? ['archon'] : []).concat(S.story.ending === 'symbiose' ? ['symbiose'] : []);
            if (ok.indexOf(v) < 0) { o('Akzente: ' + ok.join(', '), 'e'); break; }
            S.user.prefs.accent = v; KY.ui.applyPrefs(); o('Akzent: ' + v, 'o');
            break;
          }
          case 'logout': case 'exit':
            if (a[0] === '--spuren-loschen' || a[0] === '--spuren-löschen') { o('Nicht zulässig für Sitz IX. Alle Handlungen werden protokolliert.', 'e'); KY.log('sys', 'Terminal: Versuch, Spuren zu löschen'); break; }
            o('Sitzung wird gesperrt …', 'd'); setTimeout(() => KY.ui.lock(), 400);
            break;
          case 'sudo': o(S.user.codename + ' ist nicht in der sudoers-Datei. Dieser Vorfall wird gemeldet.', 'e'); KY.log('sys', 'Terminal: sudo-Versuch'); KY.seatAdj('DRACO', -1); break;
          case 'man': o(a[0] ? 'Kein Handbucheintrag für „' + a[0] + '“. Versuchen Sie „hilfe“.' : 'Welches Handbuch?', 'd'); break;
          case 'vesper': o('Benutzer IX-alt: deaktiviert seit 10.09.2026 03:12:44. Letzte Aktion: protokoll-null (abgebrochen).', 'w'); break;
          case 'hydra': o('Kein Benutzer. Kernprozess 0.', 'w'); break;
          case 'mechanismus':
            if (KY.flag('mechView')) { KY.ui.go('mechanismus'); break; }
            o('Rekonstruktion nicht verfügbar. Forschungsprogramm „Zahnradanalyse“ erforderlich.', 'e');
            if (!KY.flag('mechBranch')) o('Forschungszweig unbekannt.', 'd');
            break;
          case 'antikythera': o('Falsche Insel.', 'd'); break;
          case 'kythera': o('34° 12′ N · 21° 24′ O · Sperrgebiet seit 1988', 'w'); KY.flag('kytheraCoords', true); break;
          case 'protokoll-null': case 'protokollnull': case 'artikel-0': {
            const why = KY.story.canNull();
            if (why) { o('protokoll-null: ' + why, 'e'); break; }
            o('PROTOKOLL NULL · Zugang zu Artikel 0 der Charta', 'h');
            o('Vier Fragmente, Reihenfolge Α Β Γ Δ, Format XXXX-XXXX-XXXX-XXXX.', 'd');
            if (KY.story.fragCount() < 4) o('Warnung: ' + KY.story.fragCount() + ' von 4 Fragmenten in Ihrem Besitz.', 'w');
            this.mode = 'key'; this.prompt();
            break;
          }
          default:
            o(cmd + ': Befehl nicht gefunden. „hilfe“ zeigt verfügbare Befehle.', 'e');
        }
      } catch (err) { o('Fehler: ' + err.message, 'e'); console.error(err); }
    },
    keyInput(v) {
      const S = KY.S;
      this.mode = null; this.prompt();
      if (!v) { this.print('Abgebrochen.', 'd'); return; }
      if (S.nullLock && S.nullLock > S.t) { this.print('Gesperrt nach Fehlversuchen. Noch ' + U.dur(S.nullLock - S.t) + '.', 'e'); return; }
      if (KY.story.checkKey(v)) {
        this.print('Schlüssel gültig.', 'o');
        KY.log('sys', 'PROTOKOLL NULL: Schlüssel akzeptiert');
        setTimeout(() => KY.nullSeq.run(), 800);
      } else {
        S.nullFails = (S.nullFails || 0) + 1;
        KY.log('sys', 'PROTOKOLL NULL: Schlüssel abgelehnt (' + S.nullFails + ')');
        this.print('Schlüssel abgelehnt.', 'e');
        if (KY.audio) KY.audio.play('deny');
        if (S.nullFails % 3 === 0) { S.nullLock = S.t + 60; this.print('Drei Fehlversuche. Zugang für 60 s gesperrt.', 'e'); }
      }
    },
    findRegion(q) {
      const D = KY.data, n = U.norm(q || '');
      if (!n) return null;
      return D.regionOrder.find(id => id.toLowerCase() === n || U.norm(D.regions[id].name).indexOf(n) === 0 || U.norm(D.regions[id].cap).indexOf(n) === 0) || null;
    },
    sat(a) {
      const S = KY.S, D = KY.data, o = (t, c) => this.print(t, c);
      if (!a[0]) {
        S.infra.sats.forEach(s => { const [lon, lat] = KY.infra.satPos(s.id, S.t); o(s.id.padEnd(8) + KY.infra.satDef(s.id).fn.padEnd(15) + (U.n(lat, 1) + ' / ' + U.n(lon, 1)).padEnd(16) + (s.focus ? D.regions[s.focus].name : 'Bereitschaft')); });
        return;
      }
      if (a[0] === 'ausrichten') {
        const id = (a[1] || '').toUpperCase(), rid = this.findRegion(a.slice(2).join(' '));
        const r = KY.infra.retask(id, rid);
        if (!r.ok) o(r.err || 'Syntax: sat ausrichten <ARGO-n> <region>', 'e'); else o(id + ' → ' + (rid ? D.regions[rid].name : 'Bereitschaft'), 'o');
        return;
      }
      if (a[0] === 'img') {
        const lat = parseFloat((a[1] || '').replace(',', '.')), lon = parseFloat((a[2] || '').replace(',', '.'));
        if (a.indexOf('--res') >= 0 && !KY.hasRes('O1')) o('Hinweis: Angeforderte Auflösung nicht verfügbar. Fallback 4,0 m/px.', 'w');
        const r = KY.infra.requestImage(lat, lon);
        if (!r.ok) { o(r.err, 'e'); return; }
        o('Bildauftrag ' + r.img.id + ' an ' + r.img.sat + '. Empfang in 18 s. Anzeige unter Flotte & Orbit › Bildaufklärung.', 'o');
        return;
      }
      o('Syntax: sat | sat ausrichten <id> <region> | sat img <breite> <länge>', 'e');
    },
  };
})();
