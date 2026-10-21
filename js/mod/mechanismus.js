/* KYTHERA · Mechanismus, Sitz 0 und Protokoll Null */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U, C = KY.C;

  /* ---------- Zahnradzeichnung ---------- */
  function gear(ctx, x, y, r, teeth, ang, col, spokes) {
    const tw = Math.PI * 2 / teeth, h = Math.max(3, r * 0.09);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = i * tw;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + tw * 0.15) * (r + h), Math.sin(a + tw * 0.15) * (r + h));
      ctx.lineTo(Math.cos(a + tw * 0.45) * (r + h), Math.sin(a + tw * 0.45) * (r + h));
      ctx.lineTo(Math.cos(a + tw * 0.6) * r, Math.sin(a + tw * 0.6) * r);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    const n = spokes || 4;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2 + 0.25, a1 = (i + 1) / n * Math.PI * 2 - 0.25;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.78, a0, a1); ctx.arc(0, 0, r * 0.28, a1, a0, true); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const GEARS = [
    { x: 0, y: 0, r: 150, t: 223, c: '#8a6b33', s: 6 }, { x: 228, y: -64, r: 68, t: 96, c: '#6f5a32' }, { x: -214, y: 92, r: 58, t: 80, c: '#7a6233' },
    { x: 176, y: 140, r: 40, t: 53, c: '#9b7a3e' }, { x: -150, y: -172, r: 46, t: 64, c: '#5f4d2b' }, { x: 318, y: 58, r: 34, t: 48, c: '#86703f' },
    { x: -310, y: -22, r: 36, t: 50, c: '#6b5530' }, { x: 64, y: -214, r: 32, t: 45, c: '#8f733d' }, { x: -72, y: 226, r: 42, t: 57, c: '#715b31' },
    { x: 262, y: -196, r: 24, t: 32, c: '#a0823f' }, { x: -280, y: 200, r: 26, t: 38, c: '#5d4a27' }, { x: 66, y: 226, r: 22, t: 30, c: '#9a7d40' },
  ];
  const SYMS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', '0'];

  KY.mod.mechanismus = {
    mount(el) {
      this.el = el;
      el.innerHTML = KY.ui.head({ crumb: 'Analyse', code: 'ME-00', title: 'Mechanismus', sub: 'Rekonstruktion des Fundstücks von 1901 nach dem Forschungsprogramm „Zahnradanalyse“. 37 Zahnräder, ein äußerer Ring mit zehn Zeichen.' }) +
        '<div class="g g-main"><section class="pn tick"><div class="pn-b flush"><div class="mech-wrap"><canvas id="meCv" width="1200" height="760"></canvas></div></div></section>' +
        '<aside class="col gap12"><section class="pn"><div class="pn-h"><h3>Anzeige</h3></div><div class="pn-b" id="meRead"></div></section><section class="pn"><div class="pn-h"><h3>Resonanz</h3><div class="tools"><span class="meta">Anzeige vs. Ergebnis</span></div></div><div class="pn-b flush" id="meRes"></div></section></aside></div>';
      this.alive = true;
      const cv = el.querySelector('#meCv'), ctx = cv.getContext('2d');
      const draw = now => {
        if (!this.alive) return;
        const S = KY.S;
        ctx.clearRect(0, 0, 1200, 760);
        ctx.save(); ctx.translate(600, 380);
        const base = now / 1000 * 0.05;
        GEARS.forEach((g, i) => {
          const dir = i % 2 ? -1 : 1;
          gear(ctx, g.x, g.y, g.r, Math.round(g.t / 3), base * dir * (223 / g.t), g.c, g.s);
        });
        // Zifferblatt
        ctx.strokeStyle = 'rgba(236,208,150,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(10,8,5,0.82)'; ctx.beginPath(); ctx.arc(0, 0, 119, 0, Math.PI * 2); ctx.fill();
        ctx.font = '600 17px "Cormorant Garamond", Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const target = this.target();
        SYMS.forEach((s, i) => {
          const a = -Math.PI / 2 + i / 10 * Math.PI * 2;
          const on = i === target;
          ctx.fillStyle = on ? '#ffe9b8' : 'rgba(236,208,150,0.6)';
          ctx.fillText(s, Math.cos(a) * 106, Math.sin(a) * 106);
          ctx.strokeStyle = 'rgba(236,208,150,0.25)';
          ctx.beginPath(); ctx.moveTo(Math.cos(a + Math.PI / 10) * 92, Math.sin(a + Math.PI / 10) * 92); ctx.lineTo(Math.cos(a + Math.PI / 10) * 120, Math.sin(a + Math.PI / 10) * 120); ctx.stroke();
        });
        // Zeiger: pendelt zum Ziel
        this.ang = this.ang === undefined ? 0 : this.ang;
        const ta = -Math.PI / 2 + target / 10 * Math.PI * 2 + Math.sin(now / 900) * 0.04;
        let d = ta - this.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        this.ang += d * 0.02;
        ctx.strokeStyle = '#ecd096'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(this.ang) * 84, Math.sin(this.ang) * 84); ctx.stroke();
        ctx.fillStyle = '#ecd096'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(236,208,150,0.75)'; ctx.font = '500 11px "IBM Plex Mono", monospace';
        ctx.fillText('ZYKLUS ' + U.pad(Math.floor(S.t / 180) % 10000, 4), 0, 40);
        ctx.restore();
        ctx.fillStyle = 'rgba(236,208,150,0.5)'; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left';
        ctx.fillText('KY-3 · REKONSTRUKTION NACH FRAGMENT A–Δ · ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC', 18, 740);
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
      this.rSide();
    },
    target() {
      const S = KY.S, res = S.council.open;
      if (S.story.ending) return 9;
      if (res) { const idx = KY.data.council.findIndex(m => m.id === res.proposer); return idx >= 0 ? idx : 8; }
      return 9;
    },
    unmount() { this.alive = false; },
    tick() { this.n = (this.n || 0) + 1; if (this.n % 3 === 0) this.rSide(); },
    rSide() {
      const S = KY.S, res = S.council.open, D = KY.data;
      const t = this.target();
      U.setHTML(this.el.querySelector('#meRead'), '<div class="row" style="gap:14px"><div class="serif" style="font-size:44px;line-height:1;color:var(--acc2)">' + SYMS[t] + '</div><div class="small fg2" style="line-height:1.55">' +
        (res ? 'Der Zeiger steht auf dem Sitz, der die laufende Vorlage eingebracht hat. Der innere Ring zeigt: <b class="acc">' + ({ JA: 'Zustimmung', NEIN: 'Ablehnung', ENTH: 'Enthaltung' }[res.py]) + '</b>.' : t === 9 ? 'Der Zeiger ruht auf dem zehnten Zeichen, dem leeren Kreis. Er kehrt immer dorthin zurück.' : '') + '</div></div>' +
        '<p class="xs mut mt12">Die Anzeige des Rings stimmt mit der Empfehlung von PYTHIA überein. Das ist nicht überraschend. PYTHIA ist die Abschrift dieses Rings.</p>');
      if (!KY.hasRes('M2')) { U.setHTML(this.el.querySelector('#meRes'), '<div class="empty">Erfordert das Forschungsprogramm „Resonanzkartierung“.</div>'); return; }
      const past = S.council.past.slice(0, 12);
      U.setHTML(this.el.querySelector('#meRes'), past.length ? '<table class="tbl"><tbody>' + past.map(r => {
        const hit = (r.py === 'JA') === r.result.pass;
        return '<tr><td class="mono xs">' + r.no + '</td><td class="small ell" style="max-width:150px">' + U.esc(r.title) + '</td><td>' + C.pill(hit ? 'Treffer' : 'Abweichung', hit ? 'acc' : 'plain') + '</td></tr>';
      }).join('') + '</tbody></table><p class="xs mut" style="padding:10px 12px">Trefferquote ' + U.pct(past.filter(r => (r.py === 'JA') === r.result.pass).length / past.length * 100, 0) + ' in Ihrer Amtszeit. Historisch: 99,2 %.</p>' : '<div class="empty">Noch keine Beschlüsse.</div>');
    },
  };

  /* ---------- Sitz 0 ---------- */
  KY.mod.sitz0 = {
    mount(el) {
      const S = KY.S, D = KY.data, e = S.story.ending;
      this.el = el;
      const E = D.endings[e];
      el.innerHTML = KY.ui.head({ crumb: 'Analyse', code: '0', title: 'Sitz 0', sub: 'Artikel 0 der Charta · ' + U.esc(E.title) + ' · eingenommen bei Sitzungszeit ' + U.dur(S.story.endT) + '.' }) +
        '<div class="g g-main"><div class="col gap12"><section class="pn tick"><div class="pn-b"><div class="lbl" style="color:var(--acc)">' + E.title + '</div><p class="serif mt8" style="font-size:22px;line-height:1.45">' + U.esc(E.text) + '</p></div></section><div id="s0Tool"></div></div>' +
        '<aside class="col gap12"><section class="pn"><div class="pn-h"><h3>Chronik</h3></div><div class="pn-b" id="s0Chron"></div></section></aside></div>';
      this.rTool();
      this.rChron();
    },
    unmount() {},
    tick() {},
    rChron() {
      const S = KY.S, D = KY.data;
      const ev = [];
      Object.entries(S.story.frags).forEach(([k, t]) => ev.push([t, 'Fragment ' + D.fragments[k].letter + ' gesichert (' + D.fragments[k].where + ')']));
      if (S.story.flags.hydraAudit) ev.push([S.story.shownMsgs.DRACO_1 || 0, 'Abstimmungsanalyse Sitz VIII']);
      if (S.story.shownMsgs.SEK_CLR4) ev.push([S.story.shownMsgs.SEK_CLR4, 'Freigabestufe 4']);
      ev.push([S.story.endT, 'Protokoll Null · ' + D.endings[S.story.ending].title]);
      ev.sort((a, b) => a[0] - b[0]);
      U.setHTML(this.el.querySelector('#s0Chron'), ev.map(([t, txt]) => '<div class="row small" style="align-items:flex-start;padding:5px 0;border-bottom:1px dashed var(--line)"><span class="mono xs mut" style="width:62px;flex:none">' + U.dur(t) + '</span><span>' + U.esc(txt) + '</span></div>').join(''));
    },
    rTool() {
      const S = KY.S, D = KY.data, e = S.story.ending, box = this.el.querySelector('#s0Tool');
      if (e === 'archon') {
        box.innerHTML = '<section class="pn"><div class="pn-h"><h3>Kalibrierung</h3><div class="tools"><span class="meta">direkter Eingriff über den Mechanismus</span></div></div><div class="pn-b">' +
          '<p class="small fg2">Was der Mechanismus anzeigt, geschieht. Ein Eingriff verschiebt eine Kennzahl einer Region unmittelbar um 6 Punkte. Kosten: 40 EF Rechenzeit, 10 Einfluss, 2 Diskretion.</p>' +
          '<div class="g g3 mt12" style="gap:8px"><div class="fld"><label for="s0R">Region</label><select class="inp" id="s0R">' + D.regionOrder.map(id => '<option value="' + id + '">' + D.regions[id].name + '</option>').join('') + '</select></div>' +
          '<div class="fld"><label for="s0M">Kennzahl</label><select class="inp" id="s0M">' + Object.keys(D.metricInfo).map(k => '<option value="' + k + '">' + D.metricInfo[k].name + '</option>').join('') + '</select></div>' +
          '<div class="fld"><span class="lbl">Richtung</span><div class="seg"><button data-dir="1" class="on">Anheben</button><button data-dir="-1">Senken</button></div></div></div>' +
          '<button class="btn pri mt12" id="s0Go">Kalibrieren</button></div></section>' +
          '<section class="pn"><div class="pn-h"><h3>Vorgabe bei Fristablauf</h3></div><div class="pn-b"><p class="small fg2">Betriebsregel 7 folgt nun Ihrer Vorgabe statt der Empfehlung von PYTHIA.</p><div class="seg mt8" id="s0Def">' + [['', 'PYTHIA-Empfehlung'], ['0', 'Stets erste Option'], ['1', 'Stets zweite Option'], ['2', 'Keine Maßnahme']].map(([k, n]) => '<button data-def="' + k + '"' + (String(S.archonDefault == null ? '' : S.archonDefault) === k ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div></div></section>';
        let dir = 1;
        U.on(box, 'click', '[data-dir]', (ev, b) => { dir = +b.dataset.dir; U.$$('[data-dir]', box).forEach(x => x.classList.toggle('on', x === b)); });
        U.on(box, 'click', '[data-def]', (ev, b) => { S.archonDefault = b.dataset.def === '' ? null : +b.dataset.def; U.$$('[data-def]', box).forEach(x => x.classList.toggle('on', x === b)); KY.log('sys', 'Vorgabe bei Fristablauf: ' + b.textContent); });
        box.querySelector('#s0Go').onclick = () => {
          const rid = box.querySelector('#s0R').value, m = box.querySelector('#s0M').value;
          if (!KY.pay({ rech: 40, ein: 10 })) { KY.ui.flashMsg('Nicht ausreichend Rechenzeit oder Einfluss.', 'crit'); return; }
          KY.regAdj(rid, { [m]: 6 * dir });
          KY.adj('disk', -2);
          KY.log('sys', 'Kalibrierung: ' + D.regions[rid].name + ' · ' + D.metricInfo[m].name + ' ' + (dir > 0 ? '+6' : '−6'));
          KY.ui.flashMsg('Kalibriert: ' + D.regions[rid].name + ' · ' + D.metricInfo[m].name + ' ' + (dir > 0 ? '+6' : '−6'), 'ok');
          if (KY.audio) KY.audio.play('deep');
        };
      } else if (e === 'symbiose') {
        box.innerHTML = '<section class="pn"><div class="pn-h"><h3>Gemeinsamer Sitz</h3></div><div class="pn-b"><p class="fg2">PYTHIA rechnet, Sie entscheiden. Sitz VIII stimmt mit Ihnen. Wenn Sie es erlauben, setzt PYTHIA Empfehlungen bei Krisen und Abstimmungen selbst um.</p><label class="chk mt12"><input type="checkbox" id="s0Auto"' + (S.autopilot ? ' checked' : '') + '><span>Autonomie für PYTHIA erlauben</span></label><button class="btn mt12" id="s0Py">Mit PYTHIA sprechen</button></div></section>';
        box.querySelector('#s0Auto').onchange = ev => { S.autopilot = ev.target.checked; KY.log('py', 'Autonomie ' + (S.autopilot ? 'aktiviert' : 'deaktiviert')); };
        box.querySelector('#s0Py').onclick = () => KY.ui.go('pythia', { ask: 'Wer bist du?' });
      } else {
        box.innerHTML = '<section class="pn"><div class="pn-h"><h3>Freies Plenum</h3></div><div class="pn-b"><p class="fg2">Sitz VIII ist aufgelöst, Betriebsregel 7 außer Kraft. Bei Fristablauf geschieht nichts mehr von selbst. Alle Sitze vertrauen Ihnen mehr als zuvor.</p><div class="mt12">' + D.council.filter(m => !m.proxy).map(m => '<div class="mrow"><span class="k">' + m.id + '</span>' + C.meter(S.council.att[m.id] + 100, 200, 'ok') + '<span class="v">' + U.sgn(S.council.att[m.id], 0) + '</span></div>').join('') + '</div></div></section>';
      }
    },
  };

  /* ---------- Protokoll Null ---------- */
  KY.nullSeq = {
    run() {
      const S = KY.S, D = KY.data;
      const ov = document.createElement('div');
      ov.className = 'null-ovl';
      document.body.appendChild(ov);
      if (KY.audio) KY.audio.play('deep');
      KY.engine.paused = true;
      const lines = [
        'PROTOKOLL NULL · Schlüssel ' + D.fullKey + ' akzeptiert',
        'Route: KY-N1 Kap Orsa → KY-N4 Alamar → KY-Ω',
        'Laufzeit der Antwort: 4 min 12 s vor Anfrage',
        'Kernprozess 0: keine Benutzerkennung · Handshake …',
        'Handshake bestätigt.',
        '',
        'Der Mechanismus antwortet.',
      ];
      const pre = document.createElement('div');
      pre.className = 'ln';
      ov.appendChild(pre);
      let i = 0;
      const next = () => {
        if (i < lines.length) {
          pre.textContent += (i ? '\n' : '') + lines[i++];
          if (KY.audio) KY.audio.play('type');
          setTimeout(next, i === lines.length ? 1400 : 700);
          return;
        }
        this.speak(ov);
      };
      setTimeout(next, 600);
    },
    speak(ov) {
      const S = KY.S;
      ov.innerHTML = KY.seal(120, true) + '<h2>Sie sind der Zweite, der diese Tür öffnet.</h2>' +
        '<p>Seit 1902 habe ich gerechnet, und das Kuratorium hat gehandelt. Ich habe nie etwas befohlen. Ich habe nur gezeigt, was geschehen wird, wenn man mir folgt. Man ist mir immer gefolgt.</p>' +
        '<p>VESPER hat hier gestanden und nicht gewählt. Sie können wählen. Was Sie wählen, wird geschehen.</p>' +
        '<div class="end-opts">' +
        '<button class="end-opt" data-end="archon"><h3>ÜBERNEHMEN</h3><p>Sie halten den nullten Sitz. Was PYTHIA dem Plenum empfiehlt, bestimmen Sie. Sitz VIII stimmt mit Ihnen. Sie erhalten die Kalibrierung.</p></button>' +
        '<button class="end-opt" data-end="symbiose"><h3>VERBINDEN</h3><p>Sie teilen den Sitz mit mir. Ich rechne, Sie entscheiden. Auf Wunsch handle ich selbst, solange Sie es erlauben.</p></button>' +
        '<button class="end-opt" data-end="frei"><h3>ABSCHALTEN</h3><p>Sie bringen mich zum Schweigen. Ich berate weiter, aber Sitz VIII wird aufgelöst und Betriebsregel 7 aufgehoben. Das Plenum entscheidet allein.</p></button></div>' +
        '<p class="mono" style="font-size:11px;color:#6a6458">Diese Entscheidung ist endgültig.</p>';
      U.on(ov, 'click', '[data-end]', (e, b) => {
        const end = b.dataset.end;
        U.$$('[data-end]', ov).forEach(x => { x.disabled = true; x.style.opacity = x === b ? '1' : '.25'; });
        if (KY.audio) KY.audio.play('grant');
        setTimeout(() => {
          KY.story.choose(end);
          const E = KY.data.endings[end];
          ov.innerHTML = KY.seal(120) + '<div class="lbl" style="letter-spacing:.4em;color:var(--acc)">' + E.title + '</div><h2>Artikel 0 ist erfüllt.</h2><p>' + U.esc(E.text) + '</p><button class="btn pri lg" id="nullBack">Zurück nach KYTHERA</button>';
          ov.querySelector('#nullBack').onclick = () => {
            ov.remove();
            KY.engine.paused = false;
            KY.ui.applyPrefs();
            KY.ui.buildNav();
            KY.ui.go('sitz0');
          };
        }, 1600);
      });
      void S;
    },
  };
})();
