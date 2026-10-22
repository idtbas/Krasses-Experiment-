/* KYTHERA · MANDAT · Vertragsmappe: acht Urkunden, Paraphen, Unterschrift, Siegel */
(function () {
  'use strict';
  const KY = window.KY;
  const U = KY.U, D = KY.data;
  const ic = (n, s) => KY.icon(n, s || 16);
  const esc = U.esc;
  const K = (KY.contracts = {});

  const initialsOf = cn => {
    const w = String(cn || 'N. N.').replace(/[^A-Za-zÄÖÜäöüß. -]/g, '').split(/[\s.-]+/).filter(Boolean);
    return (w.length ? w.slice(0, 3).map(x => x[0].toUpperCase()).join('.') : 'N.N') + '.';
  };
  K.initialsOf = initialsOf;
  const fillTxt = (t, st) => esc(U.fill(t, { codename: st.vals.codename || 'N. N.', aktenzeichen: st.akz }));
  const isDone = (c, st) => {
    const fOk = c.fields.every(f => f.type === 'multi' || (st.vals[f.id] !== undefined && String(st.vals[f.id]).trim() !== ''));
    const iOk = c.initials.every(i => st.ini[c.id] && st.ini[c.id][i.id]);
    return { fOk, iOk, sOk: !!st.sigs[c.id], all: fOk && iOk && !!st.sigs[c.id] };
  };

  /* Papierdarstellung einer Urkunde */
  function paper(c, st, o) {
    o = o || {};
    const ro = !!o.readonly;
    const cn = st.vals.codename || 'N. N.';
    let h = `<div class="paper" id="paper-${c.id}"><div class="conf"><span>Streng vertraulich · Ausfertigung für die Mandatsperson</span><span>${esc(c.no)}</span></div>
      <div class="head"><div class="no">AKTENZEICHEN ${esc(st.akz)} · URKUNDE ${D.CONTRACTS.indexOf(c) + 1} VON ${D.CONTRACTS.length}</div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.sub)}</div></div>
      <div class="parties"><div class="p"><b>${esc(c.party)}</b>vertreten durch ${esc(c.signer)}</div><div class="and">und</div><div class="p"><b>die Mandatsperson „<span class="cn">${esc(cn)}</span>“</b>nachfolgend „Mandatsperson“</div></div>
      <div class="summary"><b>KURZFASSUNG DES NOTARIATS</b>${esc(c.summary)}</div>`;
    c.sections.forEach(s => { h += `<h4>${esc(s.h)}</h4>` + s.p.map(p => `<p>${fillTxt(p, st)}</p>`).join(''); });
    // Festlegungen
    c.fields.forEach(f => {
      h += `<div class="cf"><div class="fl">Festlegung · ${esc(f.label)}</div>${f.hint ? '<div class="fh">' + esc(f.hint) + '</div>' : ''}`;
      if (f.type === 'text') h += ro ? `<div style="font:italic 22px var(--serif)">${esc(st.vals[f.id] || '')}</div>` : `<input class="pin" data-f="${f.id}" maxlength="${f.max || 24}" value="${esc(st.vals[f.id] !== undefined ? st.vals[f.id] : f.def || '')}" autocomplete="off" spellcheck="false">`;
      else {
        const multi = f.type === 'multi';
        const cur = st.vals[f.id];
        h += '<div class="opts">' + f.choices.map(ch => {
          const on = multi ? (cur || []).indexOf(ch.v) >= 0 : cur === ch.v;
          return `<button class="opt ${multi ? 'multi' : ''} ${on ? 'on' : ''}" data-f="${f.id}" data-v="${esc(ch.v)}" ${ro ? 'disabled' : ''}><span class="bx"></span><span><b>${esc(ch.l)}</b>${ch.note ? '<span>' + esc(ch.note) + '</span>' : ''}</span></button>`;
        }).join('') + '</div>';
      }
      h += '</div>';
    });
    // Paraphen
    if (c.initials.length) {
      h += `<h4>Paraphen der Mandatsperson</h4>`;
      c.initials.forEach(i => {
        const done = st.ini[c.id] && st.ini[c.id][i.id];
        h += `<div class="ini"><div class="tx">${fillTxt(i.text, st)}</div><div class="box ${done ? 'done' : ''}" data-ini="${i.id}">${done ? esc(initialsOf(cn)) : 'PARAPHE'}</div></div>`;
      });
    }
    // Unterschriften
    const sig = st.sigs[c.id];
    h += `<div class="place">Holmvik, den 1. März 2027</div>
      <div class="sigarea"><div class="sigblk"><div class="ln"><span class="party ${sig || ro ? 'on' : ''}">${esc(c.signer.replace(/^Für das Treuhandhaus: |^Annahme durch die gewählte leitende Person/, '') || c.signer)}</span></div><div class="cap">für <b>${esc(c.party)}</b><br>${esc(c.signer)}, ${esc(c.signerRole)}</div></div>
      <div class="sigblk"><div class="ln" id="sigln-${c.id}">${sig ? `<img src="${sig}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">` : ro ? '' : '<canvas></canvas><div class="ph2">Hier unterschreiben</div>'}</div><div class="cap"><b>Mandatsperson „<span class="cn">${esc(cn)}</span>“</b><br>eigenhändig</div>
      ${ro || sig ? '' : `<div class="sigtools"><button class="btn" data-sig="clear">Löschen</button>${st.master ? '<button class="btn" data-sig="reuse">Unterschrift übernehmen</button>' : ''}</div>`}</div></div>
      <div class="seal ${o.sealed ? 'on' : ''}">${KY.waxSeal((c.seal || 'KURATORIUM · KYTHERA · SIEGEL').toUpperCase() + ' · ', 'KY')}</div>
      <div class="meta"><span>Notariat Penrose · Holmvik</span><span>${esc(c.no)}</span><span>Seite 1 von 1</span></div></div>`;
    return h;
  }

  /* Unterschriftenfeld mit druckabhängiger Linienstärke */
  function sigPad(host, onDone) {
    const cv = U.$('canvas', host);
    if (!cv) return;
    const ph = U.$('.ph2', host);
    const r = host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1f3c8a';
    let last = null, len = 0, lw = 2.2, drawing = false;
    const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top, performance.now()]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing = true; last = pos(e); if (ph) ph.style.display = 'none'; });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = pos(e);
      const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
      if (d < 0.8) return;
      const v = d / Math.max(1, p[2] - last[2]);
      const target = U.clamp(3.1 - v * 1.1, 1.1, 3.2) * (e.pressure && e.pointerType === 'pen' ? 0.6 + e.pressure : 1);
      lw = lw * 0.7 + target * 0.3;
      g.lineWidth = lw;
      g.beginPath(); g.moveTo(last[0], last[1]);
      g.quadraticCurveTo(last[0], last[1], (last[0] + p[0]) / 2, (last[1] + p[1]) / 2);
      g.lineTo(p[0], p[1]); g.stroke();
      len += d; last = p;
      if (Math.random() < 0.06) KY.audio.play('type');
    });
    const end = () => { if (!drawing) return; drawing = false; if (len > 60) onDone(cv.toDataURL('image/png')); };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    return { clear() { g.clearRect(0, 0, cv.width, cv.height); len = 0; if (ph) ph.style.display = ''; } };
  }

  /* ---------- Ablauf ---------- */
  K.run = function (opts) {
    const root = U.$('#contracts');
    root.classList.remove('hidden');
    const st = { cur: 0, vals: {}, ini: {}, sigs: {}, master: null, signed: {}, akz: opts.akz || String(opts.seed), seed: opts.seed, speech: D.NOTARY.lines.welcome.slice() };
    D.CONTRACTS.forEach(c => c.fields.forEach(f => { st.vals[f.id] = f.type === 'multi' ? (f.def || []).slice() : f.def; }));
    root.innerHTML = `<aside class="idx" id="ct-idx"></aside><main class="desk" id="ct-desk"></main><aside class="side" id="ct-side"></aside>`;
    let pad = null;
    const idx = () => {
      U.$('#ct-idx').innerHTML = `<div class="hd">NOTARIAT PENROSE · HOLMVIK</div><h3>Vertragsmappe des Mandats Kythera</h3>` +
        D.CONTRACTS.map((c, i) => `<button class="it ${st.signed[c.id] ? 'done' : ''} ${i === st.cur ? 'cur' : ''} ${i > st.cur && !st.signed[c.id] ? 'locked' : ''}" data-go="${i}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="tl">${esc(c.title)}</span><span class="st">${st.signed[c.id] ? ic('check', 11) : ''}</span></button>`).join('') +
        `<button class="it ${st.cur === D.CONTRACTS.length ? 'cur' : ''} ${Object.keys(st.signed).length < D.CONTRACTS.length ? 'locked' : ''}" data-go="${D.CONTRACTS.length}"><span class="no">${ic('seal', 13)}</span><span class="tl">Versiegelung</span><span class="st"></span></button>` +
        `<div class="foot">Datum 1. März 2027<br>Aktenzeichen ${esc(st.akz)}<br>Alle Personen und Orte sind frei erfunden.</div>`;
    };
    const side = () => {
      const c = D.CONTRACTS[st.cur];
      let chk = '';
      if (c) {
        const d = isDone(c, st);
        const nIni = c.initials.filter(i => st.ini[c.id] && st.ini[c.id][i.id]).length;
        chk = `<div class="lbl" style="color:#9a8e78">Urkunde ${st.cur + 1} von ${D.CONTRACTS.length}</div><div class="checklist">${c.fields.length ? `<div class="ck ${d.fOk ? 'on' : ''}"><i>${d.fOk ? ic('check', 10) : ''}</i>Festlegungen getroffen</div>` : ''}<div class="ck ${d.iOk ? 'on' : ''}"><i>${d.iOk ? ic('check', 10) : ''}</i>Paraphen gesetzt (${nIni}/${c.initials.length})</div><div class="ck ${d.sOk ? 'on' : ''}"><i>${d.sOk ? ic('check', 10) : ''}</i>Unterschrift geleistet</div></div>
          <button class="btn primary block" id="ct-sign" ${d.all && !st.signed[c.id] ? '' : 'disabled'}>${ic('seal', 15)} Unterzeichnen und siegeln</button>
          ${st.signed[c.id] ? '<button class="btn block" id="ct-next">' + (st.cur < D.CONTRACTS.length - 1 ? 'Nächste Urkunde' : 'Zur Versiegelung') + ' ' + ic('arrowR', 14) + '</button>' : ''}`;
      }
      U.$('#ct-side').innerHTML = `<div class="notary"><div class="avatar">MP</div><div><b>${esc(D.NOTARY.name)}</b><span>${esc(D.NOTARY.role)} · ${esc(D.NOTARY.office)}</span></div></div><div class="speech">${st.speech.map(p => '<p>„' + esc(p) + '“</p>').join('')}</div>${chk}<div class="note" style="color:#7d705a;font-size:11px;margin-top:auto">Tipp: Mit dem Trackpad gedrückt halten und ziehen, um zu unterschreiben. Ein Klick auf ein Paraphenfeld setzt Ihr Kürzel.</div>`;
      const sb = U.$('#ct-sign'); if (sb) sb.addEventListener('click', sign);
      const nb = U.$('#ct-next'); if (nb) nb.addEventListener('click', () => go(st.cur + 1));
    };
    const desk = () => {
      const deskEl = U.$('#ct-desk');
      if (st.cur >= D.CONTRACTS.length) { final(); return; }
      const c = D.CONTRACTS[st.cur];
      deskEl.innerHTML = paper(c, st, { sealed: !!st.signed[c.id], readonly: !!st.signed[c.id] });
      deskEl.scrollTop = 0;
      const ln = U.$('#sigln-' + c.id);
      if (ln && !st.sigs[c.id] && !st.signed[c.id]) pad = sigPad(ln, url => { st.sigs[c.id] = url; if (!st.master) st.master = url; KY.audio.play('ok'); refresh(); });
    };
    const refresh = () => { idx(); side(); desk(); };
    const go = i => {
      if (i > st.cur && !(st.signed[D.CONTRACTS[st.cur] && D.CONTRACTS[st.cur].id] || i <= Object.keys(st.signed).length)) return;
      st.cur = i;
      const c = D.CONTRACTS[i];
      st.speech = c ? (st.signed[c.id] ? ['Diese Urkunde ist bereits gesiegelt.'] : (i === 0 ? D.NOTARY.lines.welcome.slice(-2) : [U.pick(D.NOTARY.lines.between)]).concat(c.notary)) : D.NOTARY.lines.done.slice();
      KY.audio.play('nav');
      refresh();
    };
    function sign() {
      const c = D.CONTRACTS[st.cur];
      if (!isDone(c, st).all) return;
      st.signed[c.id] = Date.now();
      KY.audio.play('gavel');
      const pEl = U.$('#paper-' + c.id);
      if (pEl) { const ps = U.$('.party', pEl); if (ps) ps.classList.add('on'); const s = U.$('.seal', pEl); if (s) s.classList.add('on'); }
      st.speech = [U.pick(['Gesiegelt. Danke.', 'Damit ist diese Urkunde rechtskräftig.', 'Das Siegel ist gesetzt.'])];
      idx(); side();
      setTimeout(() => { if (st.cur < D.CONTRACTS.length && st.signed[c.id]) go(st.cur + 1); }, 1500);
    }
    function final() {
      const v = st.vals;
      const val = (cid, fid) => { const c = D.CONTRACTS.find(x => x.id === cid); const f = c.fields.find(x => x.id === fid); if (f.type === 'multi') return (v[fid] || []).map(x => (f.choices.find(ch => ch.v === x) || {}).l).join(', ') || 'keine'; return (f.choices ? (f.choices.find(ch => ch.v === v[fid]) || {}).l : v[fid]) || '—'; };
      U.$('#ct-desk').innerHTML = `<div class="paper"><div class="conf"><span>Streng vertraulich</span><span>KY-M/2027/SIEGEL</span></div>
        <div class="head"><div class="no">AKTENZEICHEN ${esc(st.akz)}</div><h1>Versiegelung der Vertragsmappe</h1><div class="sub">Niederschrift der Notarin über die Unterzeichnung</div></div>
        <p>Heute, am 1. März 2027, erschien vor mir, der Notarin Dr. Morwenna Penrose in Holmvik, die Mandatsperson mit dem Decknamen „${esc(v.codename || 'N. N.')}“. Die Mandatsperson hat die nachstehenden acht Urkunden gelesen, paraphiert und eigenhändig unterzeichnet. Die Identität der Mandatsperson wurde festgestellt und in einem gesonderten, versiegelten Umschlag verwahrt.</p>
        <h4>Festlegungen der Mandatsperson</h4>
        <p style="text-align:left">Rechtsordnung: ${esc(val('K02', 'jurisdiction'))}<br>Treuhandhaus: ${esc(val('K03', 'trustee'))}<br>Anlagestrategie: ${esc(val('K04', 'strategy'))}<br>Reaktionsfrist: ${esc(val('K06', 'deadline'))} · Entschädigungsfonds: ${esc(val('K06', 'fund'))}<br>Leitende Gesandtschaft: ${esc(val('K07', 'envoy'))}<br>Freiwillige Grundsätze: ${esc(val('K08', 'principles'))}</p>
        <h4>Identität</h4><p style="text-align:left">Name der Mandatsperson: <span class="redact">██████████████████</span><br>Verwahrung: Notariat Penrose, Tresor II, Fach ${(st.seed % 97) + 3}</p>
        <div class="cf"><div class="fl">Aktenzeichen der Welt</div><div class="fh">Bestimmt die Welt, in der Ihr Mandat beginnt. Mit demselben Aktenzeichen entsteht dieselbe Welt.</div><input class="pin" id="ct-akz" value="${esc(String(st.seed))}" maxlength="10" inputmode="numeric"></div>
        <div class="row" style="justify-content:center;gap:20px;margin-top:20px">${D.CONTRACTS.map(c => `<div style="width:54px;height:54px;opacity:.9">${KY.waxSeal(' ', String(D.CONTRACTS.indexOf(c) + 1), '#8e1b1b').replace('width="124" height="124"', 'width="54" height="54"')}</div>`).join('')}</div>
        <div style="text-align:center;margin-top:28px"><button class="btn primary" id="ct-go" style="height:46px;padding:0 26px;font-size:14px">${ic('seal', 16)} Mandat antreten</button></div>
        <div class="meta"><span>Notariat Penrose · Holmvik</span><span>Urkundenrolle 2027/0301</span><span>Ende der Niederschrift</span></div></div>`;
      U.$('#ct-go').addEventListener('click', () => {
        const ak = parseInt(String(U.$('#ct-akz').value).replace(/\D/g, ''), 10);
        const seed = isFinite(ak) && ak > 0 ? ak % 2147483647 : st.seed;
        KY.audio.play('deep');
        root.classList.add('hidden');
        opts.done({ vals: Object.assign({}, st.vals), sig: st.master, initials: st.ini, seed });
      });
    }
    // Eingaben auf dem Papier
    root.onclick = e => {
      const go2 = e.target.closest('[data-go]');
      if (go2) { go(+go2.dataset.go); return; }
      const c = D.CONTRACTS[st.cur];
      if (!c || st.signed[c.id]) return;
      const opt = e.target.closest('.opt[data-f]');
      if (opt) {
        const f = c.fields.find(x => x.id === opt.dataset.f);
        if (f.type === 'multi') { const a = st.vals[f.id] || []; const i = a.indexOf(opt.dataset.v); if (i >= 0) a.splice(i, 1); else a.push(opt.dataset.v); st.vals[f.id] = a; }
        else st.vals[f.id] = opt.dataset.v;
        KY.audio.play('click');
        U.$$('.opt[data-f="' + f.id + '"]').forEach(b => b.classList.toggle('on', f.type === 'multi' ? st.vals[f.id].indexOf(b.dataset.v) >= 0 : st.vals[f.id] === b.dataset.v));
        side(); return;
      }
      const box = e.target.closest('.box[data-ini]');
      if (box) {
        st.ini[c.id] = st.ini[c.id] || {};
        st.ini[c.id][box.dataset.ini] = !st.ini[c.id][box.dataset.ini];
        box.classList.toggle('done', st.ini[c.id][box.dataset.ini]);
        box.textContent = st.ini[c.id][box.dataset.ini] ? initialsOf(st.vals.codename) : 'PARAPHE';
        KY.audio.play('key');
        side(); return;
      }
      const sb = e.target.closest('[data-sig]');
      if (sb) {
        if (sb.dataset.sig === 'clear') { if (pad) pad.clear(); delete st.sigs[c.id]; side(); }
        if (sb.dataset.sig === 'reuse' && st.master) { st.sigs[c.id] = st.master; KY.audio.play('ok'); refresh(); }
      }
    };
    root.oninput = e => {
      const inp = e.target.closest('input.pin[data-f]');
      if (!inp) return;
      st.vals[inp.dataset.f] = inp.value.slice(0, 18);
      if (inp.dataset.f === 'codename') {
        U.$$('.cn', root).forEach(s => { s.textContent = inp.value || 'N. N.'; });
        U.$$('.box.done', root).forEach(b => { b.textContent = initialsOf(inp.value); });
      }
      side();
    };
    root.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('input.pin')) e.target.blur(); };
    refresh();
  };

  /* Ansicht einer gesiegelten Urkunde (Akten) */
  K.view = function (cid) {
    const S = KY.sim.S;
    const c = D.CONTRACTS.find(x => x.id === cid);
    if (!c) return;
    const st = { vals: Object.assign({ codename: S.codename }, S.contracts.vals), ini: S.contracts.initials || {}, sigs: {}, akz: String(S.seed) };
    st.sigs[c.id] = S.contracts.sig;
    c.initials.forEach(i => { st.ini[c.id] = st.ini[c.id] || {}; st.ini[c.id][i.id] = true; });
    KY.ui.modal({ cls: 'w900', html: `<div class="mh"><div class="tt"><div class="lbl">Akte · ${esc(c.no)}</div><h2>${esc(c.title)}</h2></div><button class="iconbtn" data-a="mclose">${ic('close', 18)}</button></div><div class="mb" style="background:#0d0b08">${paper(c, st, { readonly: true, sealed: true })}</div>` });
  };
})();
