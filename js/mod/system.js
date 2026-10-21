/* KYTHERA · Modul Konfiguration */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;

  KY.mod.system = {
    mount(el) {
      this.el = el;
      U.on(el, 'click', '[data-pref]', (e, b) => {
        const p = KY.S.user.prefs, k = b.dataset.pref, v = b.dataset.val;
        p[k] = v === 'true' ? true : v === 'false' ? false : v;
        KY.ui.applyPrefs();
        if (k === 'sound' && p.sound) KY.audio.play('ok');
        this.render();
      });
      this.render();
    },
    unmount() {},
    tick() {},
    render() {
      const S = KY.S, p = S.user.prefs, el = this.el;
      const accents = [['messing', 'Messing'], ['eis', 'Eis'], ['signal', 'Signal']];
      if (S.story.ending === 'archon') accents.push(['archon', 'Archon']);
      if (S.story.ending === 'symbiose') accents.push(['symbiose', 'Symbiose']);
      const seg = (key, opts, cur) => '<div class="seg">' + opts.map(([v, n]) => '<button data-pref="' + key + '" data-val="' + v + '"' + (String(cur) === v ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div>';
      el.innerHTML = KY.ui.head({ crumb: 'System', code: 'KF-17', title: 'Konfiguration', sub: 'Darstellung, Ton und Sitzungsdaten. Der Sitzungsstand wird lokal in diesem Browser gespeichert.' }) +
        '<div class="g g2"><section class="pn"><div class="pn-h"><h3>Darstellung</h3></div><div class="pn-b col gap16">' +
        '<div class="fld"><span class="lbl">Akzentfarbe</span>' + seg('accent', accents, p.accent) + '</div>' +
        '<div class="fld"><span class="lbl">Dichte</span>' + seg('density', [['normal', 'Normal'], ['kompakt', 'Kompakt']], p.density) + '</div>' +
        '<div class="fld"><span class="lbl">Animationen</span>' + seg('motion', [['true', 'An'], ['false', 'Aus']], p.motion) + '</div>' +
        '<div class="fld"><span class="lbl">Bildschirmraster</span>' + seg('scan', [['true', 'An'], ['false', 'Aus']], p.scan) + '</div>' +
        '<div class="fld"><span class="lbl">Einweisung</span><div><button class="btn sm ghost" id="sysOnb">Einweisung im Lagebild ' + (S.onb.hidden ? 'wieder einblenden' : 'ausblenden') + '</button></div></div></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Ton</h3></div><div class="pn-b col gap16"><div class="fld"><span class="lbl">Signaltöne</span>' + seg('sound', [['true', 'An'], ['false', 'Aus']], p.sound) + '</div>' +
        '<div class="fld"><label for="sysVol">Lautstärke</label><input type="range" id="sysVol" min="0" max="1" step="0.05" value="' + p.vol + '"></div><div><button class="btn sm ghost" id="sysTest">Testsignal</button></div></div></section>' +
        '<section class="pn"><div class="pn-h"><h3>Sitzungsdaten</h3></div><div class="pn-b"><dl class="kv"><dt>Rufname</dt><dd>' + U.esc(S.user.codename) + '</dd><dt>Amtsantritt</dt><dd class="mono">' + U.stamp(S.meta.created) + '</dd><dt>Anmeldungen</dt><dd class="mono">' + S.meta.boots + '</dd><dt>Sitzungszeit</dt><dd class="mono">' + U.dur(S.t) + '</dd><dt>Letzte Sicherung</dt><dd class="mono">' + U.stamp(S.meta.saved) + '</dd></dl>' +
        '<div class="row wrap mt16"><button class="btn" id="sysSave">Jetzt sichern</button><button class="btn ghost" id="sysExp">Sitzungsstand exportieren</button><button class="btn ghost" id="sysImp">Importieren</button></div></div></section>' +
        '<section class="pn" style="border-color:rgba(224,72,72,.45)"><div class="pn-h"><h3>Notfalllöschung</h3></div><div class="pn-b"><p class="fg2 small">Löscht den gesamten Sitzungsstand unwiderruflich und gibt Sitz IX zurück an das Kuratorium. Die Simulation beginnt danach von vorn.</p><button class="btn dan mt12" id="sysWipe">' + KY.I('warn') + 'Notfalllöschung einleiten</button></div></section></div>' +
        '<p class="xs mut mt16">KYTHERA 7.4.2 · Alle Daten, Personen, Organisationen und Ereignisse dieser Simulation sind fiktiv.</p>';
      el.querySelector('#sysVol').oninput = e => { p.vol = +e.target.value; };
      el.querySelector('#sysVol').onchange = () => KY.audio.play('note');
      el.querySelector('#sysTest').onclick = () => KY.audio.play('alert');
      el.querySelector('#sysOnb').onclick = () => { S.onb.hidden = !S.onb.hidden; this.render(); };
      el.querySelector('#sysSave').onclick = () => { const ok = KY.save(); KY.ui.flashMsg(ok ? 'Sitzungsstand gesichert' : 'Speichern in diesem Browser nicht möglich', ok ? 'ok' : 'crit'); this.render(); };
      el.querySelector('#sysExp').onclick = () => this.exportDlg();
      el.querySelector('#sysImp').onclick = () => this.importDlg();
      el.querySelector('#sysWipe').onclick = () => this.wipe();
    },
    exportDlg() {
      const txt = KY.exportState();
      const body = document.createElement('div');
      body.innerHTML = '<p class="small fg2">Der vollständige Sitzungsstand als Text. Kopieren Sie ihn, um ihn auf einem anderen Gerät zu importieren.</p><textarea class="inp mono mt12" id="expTxt" rows="8" readonly style="font-size:10.5px"></textarea>';
      body.querySelector('#expTxt').value = txt;
      KY.ui.modal({ lbl: 'Export', title: 'Sitzungsstand exportieren', body, actions: [{ label: 'Schließen', cls: 'ghost' }, { label: 'Kopieren', cls: 'pri', fn: () => { const ta = body.querySelector('#expTxt'); U.copy(txt, ta).then(ok => KY.ui.flashMsg(ok ? 'In die Zwischenablage kopiert' : 'Text markiert, bitte manuell kopieren', ok ? 'ok' : 'info')); ta.select(); return false; } }] });
    },
    importDlg() {
      const body = document.createElement('div');
      body.innerHTML = '<p class="small fg2">Fügen Sie einen exportierten Sitzungsstand ein. Der aktuelle Stand wird ersetzt.</p><textarea class="inp mono mt12" id="impTxt" rows="8" style="font-size:10.5px"></textarea>';
      KY.ui.modal({ lbl: 'Import', title: 'Sitzungsstand importieren', body, actions: [{ label: 'Abbrechen', cls: 'ghost' }, { label: 'Importieren und neu laden', cls: 'pri', fn: () => {
        try { KY.engine.stop(); KY.importState(body.querySelector('#impTxt').value); KY.S = null; location.reload(); }
        catch (e) { KY.engine.start(); KY.ui.flashMsg(e.message || 'Ungültiger Sitzungsstand', 'crit'); return false; }
      } }] });
    },
    wipe() {
      const S = KY.S;
      const body = document.createElement('div');
      body.innerHTML = '<p class="fg2">Geben Sie zur Bestätigung Ihren Rufnamen ein. Dieser Vorgang kann nicht rückgängig gemacht werden.</p><input class="inp mono mt12" id="wipeIn" autocomplete="off" style="letter-spacing:.2em;text-transform:uppercase" placeholder="' + U.esc(S.user.codename) + '">';
      const dlg = KY.ui.modal({ lbl: 'Notfalllöschung', title: 'Sitz IX zurückgeben?', body, cls: 'crisis', actions: [{ label: 'Abbrechen', cls: 'ghost' }, { label: 'Endgültig löschen', cls: 'dan', fn: () => {
        if (body.querySelector('#wipeIn').value.trim().toUpperCase() !== S.user.codename) { KY.ui.flashMsg('Rufname stimmt nicht überein.', 'crit'); return false; }
        this.countdown();
      } }] });
      void dlg;
    },
    countdown() {
      const ov = document.createElement('div');
      ov.className = 'null-ovl';
      ov.innerHTML = '<div class="lbl" style="color:var(--crit);letter-spacing:.4em">Notfalllöschung</div><div class="mono" style="font-size:72px;color:#ff8f84" id="wipeN">5</div><p>Schlüssel werden vernichtet. Sitz IX wird an das Kuratorium zurückgegeben.</p><button class="btn ghost" id="wipeStop">Abbrechen</button>';
      document.body.appendChild(ov);
      let n = 5, stop = false;
      ov.querySelector('#wipeStop').onclick = () => { stop = true; ov.remove(); };
      const t = () => {
        if (stop) return;
        if (KY.audio) KY.audio.play('alert');
        if (n <= 0) {
          KY.engine.stop();
          KY.wipe();
          KY.S = null;
          ov.innerHTML = '<div class="mono" style="color:#9aa39c">Sitzungsstand gelöscht.</div>';
          setTimeout(() => location.reload(), 1200);
          return;
        }
        ov.querySelector('#wipeN').textContent = n--;
        setTimeout(t, 1000);
      };
      t();
    },
  };
})();
