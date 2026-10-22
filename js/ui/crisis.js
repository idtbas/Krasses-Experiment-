/* KYTHERA · MANDAT · Krisenstab, Anruf, Anhörung, Enttarnung, Jahresbericht */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data, SIM = KY.sim;
  const ui = KY.ui;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const C = (KY.crisis = {});

  /* ---------- Eingehender Anruf ---------- */
  let callEl = null;
  C.call = function (inc) {
    if (callEl) callEl.remove();
    const a = SIM.adv('haddad');
    callEl = U.el(`<div class="call"><div class="avatar" style="background:${a.color}">${a.init}</div><div style="flex:1;min-width:0"><div class="lbl" style="color:#ff9f94">Eingehender Anruf · Krisenstab</div><b>${esc(a.name)}</b><div class="dim ell" style="font-size:12px">${esc(inc.name)} · ${esc(inc.projName)}</div></div><div class="col" style="gap:6px"><button class="btn sm danger" id="call-ok">${ic('phone', 14)} Annehmen</button><button class="btn xs ghost" id="call-no">Später</button></div></div>`);
    U.$('#game').appendChild(callEl);
    KY.audio.play('alert');
    const ring = setInterval(() => KY.audio.play('alert'), 2600);
    const end = () => { clearInterval(ring); if (callEl) { callEl.remove(); callEl = null; } };
    U.$('#call-ok', callEl).addEventListener('click', () => { end(); C.open(inc.id); });
    U.$('#call-no', callEl).addEventListener('click', () => { end(); ui.toast({ t: 'Der Krisenstab wartet', d: 'Frist bis ' + U.dateStr(inc.deadline, true) + ' · Taste E öffnet den Krisenstab.', icon: 'clock', kind: 'warn' }); });
    setTimeout(() => { if (callEl) end(); }, 14000);
  };

  /* ---------- Krisenstab ---------- */
  C.open = function (incId) {
    const S = SIM.S;
    const inc = KY.incidents.byId(incId);
    if (!inc) return;
    KY.engine.pause('krisenstab');
    const open = inc.status === 'offen';
    const sel = new Set();
    const m = ui.modal({
      cls: 'w900 crisis', dismiss: true,
      html: `<div class="mh"><div class="siren">${ic('siren', 24)}</div><div class="tt" style="flex:1;min-width:0"><div class="lbl" style="color:#ff9f94">Krisenstab · ${esc(SIM.adv('haddad').name)} · ${open ? 'Entscheidung erforderlich' : 'Entschieden am ' + U.dateStr(inc.decidedAt, true)}</div><h2>${esc(inc.name)} · ${esc(inc.projName)}</h2><div class="dim" style="font-size:12px;margin-top:3px">${ic('pin', 12)} ${inc.c >= 0 ? esc(SIM.cName(inc.c)) + ', ' : ''}${esc(SIM.nName(inc.n))} · ${U.dateStr(inc.day)} · Stufe ${inc.sev} von 5</div></div><button class="iconbtn" data-a="mclose">${ic('close', 18)}</button></div>
        <div class="mb" id="cr-b"></div>
        <div class="mf" id="cr-f"></div>`,
    });
    const draw = () => {
      const left = inc.deadline - S.day;
      const news = S.news.filter(a => a.inc === inc.id || (a.proj === inc.proj && a.day >= inc.day)).slice(0, 3);
      const posts = S.social.filter(p => p.n === inc.n && (p.kind === 'incident' || p.kind === 'grief') && p.day >= inc.day).slice(0, 2);
      const p = KY.projects.byId(inc.proj);
      const f = p ? S.fronts.find(z => z.id === p.front) : null;
      let h = `<p style="font:16px/1.55 var(--serif);color:#efe7da;margin:0">${esc(inc.title)}</p>
        <div class="casualty">
          <div class="stat dead"><div class="k">Todesopfer</div><div class="v">${U.n(inc.deadNow)}</div><div class="s">${inc.deadNow < inc.dead ? '<span class="bad">Zahl steigt</span>' : inc.dead ? 'bestätigt' : 'keine'}</div></div>
          <div class="stat"><div class="k">Verletzte</div><div class="v">${U.n(inc.injured)}</div></div>
          <div class="stat"><div class="k">Evakuiert / obdachlos</div><div class="v">${U.count(inc.displaced)}</div></div>
          <div class="stat"><div class="k">Schaden</div><div class="v">${U.money(inc.dmg || inc.lossFin)}</div></div></div>`;
      if (inc.dead > 0) h += `<div class="memorial" style="margin-bottom:10px">${ic('candle', 15)} Jedes dieser Leben hatte einen Namen. Das Register vergisst keinen davon.</div>`;
      h += `<div class="grid2" style="gap:14px;align-items:start"><div>`;
      h += `<div class="h3">Lagebeurteilung</div><div class="card"><div class="row top">${ui.advAvatar('haddad', 30)}<div class="note" style="font-size:12.5px">${assessment(inc, p, f)}</div></div></div>`;
      if (inc.fundPaid) h += `<div class="okbox" style="margin-top:8px">${ic('heart', 15)}<div>Der Entschädigungsfonds hat Betroffenen bereits ${U.money(inc.fundPaid)} Soforthilfe gezahlt.</div></div>`;
      if (inc.verdict) h += `<div class="card" style="margin-top:8px"><div class="lbl">Untersuchungsbericht</div><div class="note" style="margin-top:4px">${esc(inc.verdict)}</div></div>`;
      h += `</div><div><div class="h3">Was die Welt sieht</div>` + (news.map(a => `<div class="art" data-a="article" data-id="${a.id}" style="padding:8px 0"><div class="meta">${esc((D.CHANNELS.find(c => c.id === a.ch) || {}).name || '')}</div><div class="h" style="font-size:14px">${esc(a.h)}</div></div>`).join('') || '<div class="dim" style="font-size:12px">Noch keine Berichte.</div>') + posts.map(po => `<div class="post" style="padding:7px 0"><div style="min-width:0"><div class="nm" style="font-size:11.5px">${esc(po.name)} <span>${esc(po.handle)}</span></div><div class="tx" style="font-size:12px">${esc(po.text)}</div></div></div>`).join('') + `</div></div>`;
      if (open) {
        h += `<div class="h3">Ihre Entscheidung <span class="r deadline">${left < 0 ? 'Frist seit ' + U.days(-left) + ' überschritten' : left === 0 ? 'Frist endet heute' : 'Frist: ' + U.dateStr(inc.deadline, true) + ' (noch ' + U.days(left) + ')'}</span></div><div class="resp">`;
        D.RESPONSES.forEach(R => {
          const av = KY.incidents.respAvailable(inc, R.id) || R.id === 'silence' || R.id === 'statement' || R.id === 'inquiry';
          if (!av) return;
          const cost = KY.incidents.respCost(inc, R.id);
          const label = R.id === 'statement' && S.g.face ? 'Erklärung durch ' + S.g.face.name : R.n;
          h += `<button class="choice ${sel.has(R.id) ? 'on' : ''} ${R.id === 'silence' ? 'silence' : ''}" data-r="${R.id}"><span class="ic-c">${ic(R.icon, 18)}</span><span><div class="l">${esc(label)}</div><div class="n">${esc(R.text)}</div><div class="cost">${cost > 0 ? U.money(cost) : 'keine Kosten'}</div></span></button>`;
        });
        h += '</div>';
      } else {
        h += `<div class="h3">Ihre Entscheidung</div><div class="row" style="gap:6px;flex-wrap:wrap">${inc.responses.map(r => `<span class="chip ${r === 'silence' ? 'red' : 'green'}">${esc(D.RESPONSES.find(x => x.id === r).n)}</span>`).join('')}${inc.late ? '<span class="chip amber">nach Fristablauf</span>' : ''}${inc.versaeumt ? '<span class="stamp">Versäumnis</span>' : ''}</div>`;
      }
      U.$('#cr-b', m.el).innerHTML = h;
      const tot = Array.from(sel).reduce((s, r) => s + KY.incidents.respCost(inc, r), 0);
      U.$('#cr-f', m.el).innerHTML = open
        ? `<span class="l">${sel.size ? 'Gesamtkosten ' + U.money(tot) : 'Wählen Sie eine oder mehrere Maßnahmen'}</span><button class="btn ghost" data-a="mclose">Später entscheiden</button><button class="btn ${sel.has('silence') ? 'danger' : 'primary'} hold" id="cr-ok" ${sel.size ? '' : 'disabled'}><span class="fill"></span><span>${sel.has('silence') ? 'Schweigen' : 'Entscheidung zeichnen'}</span></button>`
        : `<button class="btn ghost" data-a="proj" data-id="${inc.proj}">Vorhaben ansehen</button><button class="btn primary" data-a="mclose">Schließen</button>`;
      const ok = U.$('#cr-ok', m.el);
      if (ok) holdBtn(ok, () => {
        const r = KY.incidents.respond(inc.id, Array.from(sel));
        if (!r.ok) { ui.toast({ t: 'Nicht möglich', d: r.err, icon: 'x', kind: 'crit' }); return; }
        KY.audio.play(sel.has('silence') ? 'deny' : 'gavel');
        m.close();
        ui.toast({ t: 'Entscheidung gezeichnet', d: inc.name + ' · ' + inc.projName, icon: 'pen', kind: sel.has('silence') ? 'warn' : 'good' });
        ui.refresh(); KY.map.redraw();
      });
    };
    m.el.addEventListener('click', e => {
      const c = e.target.closest('.choice[data-r]');
      if (c) {
        const r = c.dataset.r;
        if (r === 'silence') { sel.clear(); sel.add('silence'); }
        else { sel.delete('silence'); if (sel.has(r)) sel.delete(r); else sel.add(r); if (r === 'shutdown') sel.delete('pause'); if (r === 'pause') sel.delete('shutdown'); }
        KY.audio.play('click');
        draw();
        return;
      }
      const t = e.target.closest('[data-a]');
      if (t && t.dataset.a !== 'mclose') setTimeout(() => m.close(), 0);
    });
    draw();
  };
  function assessment(inc, p, f) {
    const S = SIM.S;
    const out = [];
    if (inc.noHarm) out.push('Es gibt keine Verletzten, aber der Vorfall kostet Geld und Glaubwürdigkeit.');
    else if (inc.dead >= 50) out.push('Das ist eine Katastrophe. Die Bilder gehen um die Welt, und die Menschen vor Ort wollen wissen, wer dafür einsteht.');
    else if (inc.dead > 0) out.push('Menschen sind gestorben. Die Angehörigen und die Öffentlichkeit erwarten eine Antwort.');
    else out.push('Glücklicherweise ist niemand ums Leben gekommen. Trotzdem wird genau beobachtet, wie der Betreiber reagiert.');
    if (inc.safety === 'min') out.push('Wir haben beim Sicherheitsstandard gespart. Eine Untersuchung wird das wahrscheinlich zutage fördern.');
    if (f && !f.exposed && f.trace > 50) out.push('Achtung: ' + f.name + ' steht bereits unter Beobachtung. Eine Untersuchung und öffentliche Erklärungen erzeugen weitere Spuren.');
    if (S.g.pressure > 60) out.push('Der Druck auf Sie ist schon jetzt hoch.');
    if (p && KY.projects.ACTIVE[p.phase] && inc.sev >= 3 && !p.retrofit) out.push('Ohne Nachrüstung kann es wieder passieren.');
    out.push('Die Entscheidung liegt bei Ihnen.');
    return out.map(esc).join(' ');
  }
  function holdBtn(btn, done) {
    const fill = U.$('.fill', btn);
    let raf = null;
    btn.addEventListener('pointerdown', e => {
      if (btn.disabled) return;
      e.preventDefault();
      const t0 = performance.now();
      const step = () => { const f = Math.min(1, (performance.now() - t0) / 700); fill.style.width = f * 100 + '%'; if (f >= 1) { raf = null; done(); return; } raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    });
    const rel = () => { if (raf) cancelAnimationFrame(raf); raf = null; fill.style.width = '0'; };
    btn.addEventListener('pointerup', rel); btn.addEventListener('pointerleave', rel);
  }
  C.holdBtn = holdBtn;

  /* ---------- Anhörung ---------- */
  C.hearing = function () {
    const S = SIM.S, H = S.g.hearing;
    if (!H) { ui.toast({ t: 'Keine Anhörung anberaumt', icon: 'info' }); return; }
    KY.engine.pause('anhoerung');
    const ans = [];
    let qi = 0;
    const m = ui.modal({
      cls: 'w900', dismiss: false,
      html: `<div class="mh"><div class="siren" style="background:rgba(201,162,79,.16);color:var(--gold2);animation:none">${ic('gavel', 24)}</div><div class="tt"><div class="lbl">Kuratorium des Stiftungsverbunds Kythera · vertrauliche Sitzung</div><h2>Anhörung der Mandatsperson „${esc(S.codename)}“</h2></div></div><div class="mb" id="hr-b"></div><div class="mf" id="hr-f"></div>`,
    });
    const draw = () => {
      if (qi >= H.qs.length) {
        U.$('#hr-b', m.el).innerHTML = `<div class="letter"><div class="lh"><span>PROTOKOLL DER ANHÖRUNG</span><span>${U.dateStr(S.day, true).toUpperCase()}</span></div><p>Die Mandatsperson hat alle Fragen des Kuratoriums beantwortet. Das Kuratorium zieht sich zur Beratung zurück.</p><div class="sig">Dr. h. c. Ingeborg Lindqvist<br><span style="font-size:12px">Vorsitzende des Kuratoriums</span></div></div>`;
        U.$('#hr-f', m.el).innerHTML = '<button class="btn primary" id="hr-done">Sitzung beenden</button>';
        U.$('#hr-done', m.el).addEventListener('click', () => { KY.incidents.answerHearing(ans); m.close(); KY.audio.play('gavel'); ui.refresh(); });
        return;
      }
      const Q = H.qs[qi];
      U.$('#hr-b', m.el).innerHTML = `<div class="row" style="gap:14px;align-items:flex-start;margin-bottom:16px">${ui.advAvatar('kuratorium', 40)}<div><div class="lbl">Frage ${qi + 1} von ${H.qs.length} · Dr. h. c. Ingeborg Lindqvist</div><p style="font:18px/1.5 var(--serif);color:#f0e8d8;margin:6px 0 0">„${esc(Q.q)}“</p></div></div><div class="col">${Q.a.map((a, i) => `<button class="choice" data-i="${i}" style="padding:12px 14px"><div class="l" style="font-weight:500;font-size:13.5px">${esc(a.t)}</div></button>`).join('')}</div>`;
      U.$('#hr-f', m.el).innerHTML = '<span class="l">Ihre Antwort wird protokolliert.</span>';
    };
    m.el.addEventListener('click', e => {
      const c = e.target.closest('.choice[data-i]');
      if (!c) return;
      ans.push(+c.dataset.i); qi++;
      KY.audio.play('click');
      draw();
    });
    draw();
  };

  /* ---------- Enttarnung ---------- */
  C.reveal = function () {
    const S = SIM.S, g = S.g;
    const el = U.el(`<div class="reveal"><div class="in"><div class="stamp" style="font-size:12px">Öffentliche Phase</div>
      <h1>„Hinter allem steht ein einziger Mensch.“</h1>
      <p>Die Recherchen sind zusammengeführt. Die Welt weiß nun, dass ${S.projects.length} Vorhaben in ${new Set(S.projects.map(p => p.n).filter(n => n >= 0)).size} Staaten von einer einzigen Person angeordnet wurden – bekannt nur unter dem Decknamen <b style="color:#f3ede0">„${esc(S.codename)}“</b>.</p>
      <p style="margin-top:22px">Name: <span class="redbar"></span></p>
      <p style="font-size:13px;color:#8d97a3">Ihre Identität bleibt nach § 6 der Geheimhaltungsvereinbarung versiegelt. Ab heute wird jede Entscheidung öffentlich Ihnen zugeschrieben: ${U.count(Math.round(g.lives))} gerettete Leben, ${U.n(g.deaths)} Todesopfer.</p>
      <button class="btn primary" style="margin-top:26px" id="rv-ok">Weiter</button></div></div>`);
    U.$('#game').appendChild(el);
    KY.audio.play('deep');
    U.$('#rv-ok', el).addEventListener('click', () => { el.remove(); ui.refresh(); });
  };

  /* ---------- Jahresbericht ---------- */
  C.report = function (d, readOnly) {
    const m = ui.modal({
      cls: 'w560', html: `<div class="mb" style="padding:22px"><div class="letter"><div class="lh"><span>KURATORIUM · JAHRESBERICHT ${d.year}</span><span>${U.dateStr(d.day, true).toUpperCase()}</span></div>
        <p>Bewertung des Mandatsjahres: <b>${esc(d.grade)}</b></p>
        <p>Gerettete Leben (geschätzt): <b>${U.n(d.lives)}</b><br>Todesopfer in Ihrer Verantwortung: <b>${U.n(d.deaths)}</b><br>Fertiggestellte Vorhaben: <b>${d.done}</b><br>Vorfälle: <b>${d.inc}</b> · Versäumnisse: <b>${d.versaeumt}</b> · Grundsatzbrüche: <b>${d.breaks}</b><br>Veränderung der weltweiten Haltung: <b>${U.sgn(d.op, 1)}</b><br>Ausgaben: <b>${U.money(d.spent)}</b> · Kapitalerträge: <b>${U.money(d.ret)}</b></p>
        <p>${d.score > 1.5 ? 'Das Kuratorium ist mit Ihrer Mandatsführung sehr zufrieden.' : d.score > 0 ? 'Das Kuratorium erkennt Ihre Bemühungen an.' : 'Das Kuratorium erwartet eine deutliche Verbesserung.'}</p>
        <div class="sig">Dr. h. c. Ingeborg Lindqvist<br><span style="font-size:12px">Vorsitzende des Kuratoriums</span></div></div></div><div class="mf"><button class="btn primary" data-a="mclose">${readOnly ? 'Schließen' : 'Zur Kenntnis genommen'}</button></div>`,
    });
    if (!readOnly) KY.audio.play('note');
    return m;
  };
})();
