/* KYTHERA · Startsequenz, Authentifizierung, Ernennung */
(function () {
  'use strict';
  const KY = window.KY, U = KY.U;
  const B = KY.boot = {};
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let root, skip = false;

  const LOG = [
    ['KY-SECURE BOOT 4.11 · Kap Orsa Systemfertigung', ''],
    ['TPM 2.0 ........................................ ', 'ok', 'VERIFIZIERT'],
    ['Messkette PCR[0–7] ............................. ', 'ok', 'KONSISTENT'],
    ['Speicherprüfung 512 GiB ECC .................... ', 'ok', 'FEHLERFREI'],
    ['Verschlüsselter Datenträger (XTS-AES-512) ...... ', 'ok', 'ENTSPERRT'],
    ['Tunnel KY-N1 Kap Orsa ⇄ KY-N3 Kaldfjord ........ ', 'ok', '23 ms'],
    ['Zertifikatskette Kuratorium-Wurzel-CA 1987 ..... ', 'ok', 'GÜLTIG'],
    ['PYTHIA Kern 31.0 Handshake ..................... ', 'ok', 'BEREIT'],
    ['Mechanismus-Emulation KY-3 ..................... ', 'a', 'SYNCHRON'],
    ['Lagedaten: 12 Regionen, 24 Emittenten, 9 Sitze . ', 'ok', 'GELADEN'],
    ['Sitzkennung IX ................................. ', 'w', 'NEU ZUGEORDNET'],
  ];

  B.run = function (returning, done) {
    root = document.createElement('div');
    root.className = 'boot';
    root.innerHTML = '<div class="boot-log" id="bootLog"></div><div class="boot-stage" id="bootStage"></div>';
    document.body.appendChild(root);
    const onKey = e => { if (e.key === 'Escape' && returning) skip = true; };
    document.addEventListener('keydown', onKey);
    B.sequence(returning).then(() => {
      document.removeEventListener('keydown', onKey);
      root.style.transition = 'opacity .6s';
      root.style.opacity = '0';
      setTimeout(() => root.remove(), 650);
      done();
    });
  };

  B.sequence = async function (returning) {
    const S = KY.S;
    const log = root.querySelector('#bootLog'), stage = root.querySelector('#bootStage');
    if (returning) {
      stage.innerHTML = '<p class="fine">ESC · Schnellstart</p>';
    }
    for (const l of LOG) {
      if (skip) break;
      const line = document.createElement('div');
      line.textContent = l[0];
      log.appendChild(line);
      await wait(returning ? 60 : 110 + Math.random() * 120);
      if (l[1]) {
        const s = document.createElement('span');
        s.className = l[1];
        s.textContent = (l[2] || 'OK') + (returning && l[2] === 'NEU ZUGEORDNET' ? '' : '');
        if (returning && l[2] === 'NEU ZUGEORDNET') { s.className = 'ok'; s.textContent = S.user.codename; }
        line.appendChild(s);
      }
    }
    await wait(skip ? 0 : 300);
    log.style.transition = 'opacity .8s'; log.style.opacity = '.18';
    stage.innerHTML = KY.seal(150, true) + '<h1>KYTHERA</h1><p class="tagline">Wir bewahren, was kommt.</p><p class="fine">KURATORIALES LAGE- UND STEUERUNGSSYSTEM · VERSION 7.4.2<br>UNBEFUGTER ZUGRIFF IST UNTERSAGT UND WIRD VERFOLGT</p>';
    stage.style.animation = 'fadeIn 1s';
    await wait(skip ? 200 : 1400);
    await B.auth(stage, returning);
    if (!returning) {
      await B.certificate(stage);
      await B.codename(stage);
      await B.oath(stage);
    }
    stage.innerHTML = KY.seal(110) + '<div class="lbl" style="color:var(--ok);letter-spacing:.3em">Zugang gewährt</div><div class="serif" style="font-size:26px">' + (returning ? 'Willkommen zurück, ' : 'Willkommen, ') + U.esc(S.user.codename) + '.</div><p class="fine">SITZ IX · FREIGABESTUFE ' + S.user.clr + ' · ' + U.longDate(new Date()).toUpperCase() + '</p>';
    KY.audio.play('grant');
    await wait(skip ? 500 : 1500);
  };

  B.auth = function (stage, returning) {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'col';
      box.style.alignItems = 'center';
      box.style.gap = '14px';
      box.innerHTML = '<div class="lbl">Hardware-Token KY-HT-09 erkannt · Sitz IX</div>' +
        '<button class="scan-btn" id="scanBtn" aria-label="Zur Authentifizierung gedrückt halten"><span class="fill"></span><span class="beam"></span>' +
        '<svg viewBox="0 0 62 78" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M31 6c-13 0-23 10-23 23v10"/><path d="M54 39V29C54 16 44 6 31 6"/><path d="M15 50V29c0-9 7-16 16-16s16 7 16 16v21"/><path d="M22 60V29c0-5 4-9 9-9s9 4 9 9v33"/><path d="M31 29v40"/><path d="M8 47c0 10 3 18 8 24"/><path d="M54 47c0 9-2 16-5 21"/></svg></button>' +
        '<div class="fine" id="scanMsg">Zur biometrischen Bestätigung gedrückt halten</div>';
      stage.appendChild(box);
      const btn = box.querySelector('#scanBtn'), fill = btn.querySelector('.fill'), msg = box.querySelector('#scanMsg');
      let t0 = 0, raf = 0, done = false;
      const HOLD = skip ? 250 : 1300;
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / HOLD);
        fill.style.height = (k * 100) + '%';
        if (k >= 1) { finish(); return; }
        raf = requestAnimationFrame(step);
      };
      const start = e => {
        if (done) return;
        if (e) e.preventDefault();
        KY.audio.unlock();
        KY.audio.play('scan');
        t0 = performance.now();
        btn.classList.add('on');
        msg.textContent = 'Abgleich läuft …';
        raf = requestAnimationFrame(step);
      };
      const stop = () => {
        if (done) return;
        cancelAnimationFrame(raf);
        btn.classList.remove('on');
        fill.style.height = '0';
        msg.textContent = 'Abgleich abgebrochen. Bitte länger gedrückt halten.';
      };
      const finish = () => {
        done = true;
        btn.classList.remove('on');
        btn.classList.add('ok');
        msg.innerHTML = '<span style="color:var(--ok)">Biometrie bestätigt · Übereinstimmung 99,7 %</span>';
        KY.audio.play('ok');
        setTimeout(() => { box.remove(); resolve(); }, skip ? 150 : 700);
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
      btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
      setTimeout(() => btn.focus(), 50);
      if (skip) start();
    });
  };

  B.certificate = function (stage) {
    return new Promise(resolve => {
      const d = new Date();
      stage.innerHTML = '<div class="lbl" style="color:var(--warn)">Neuer Sitzinhaber · Ernennungsurkunde wird geladen</div>' +
        '<div class="cert"><div class="h">Das Kuratorium</div><h2>Ernennung zum Inhaber<br>des Sitzes IX</h2>' +
        '<p>Das Plenum hat in seiner Sitzung vom ' + U.longDate(d) + ' beschlossen, Ihnen den neunten Sitz zu übertragen, der seit dem Rücktritt des bisherigen Inhabers unbesetzt ist.</p>' +
        '<p>Mit diesem Sitz verbunden sind eine Stimme im Plenum, die Verfügung über ein eigenes Budget, Flotte und Satelliten, sowie der Zugang zu PYTHIA.</p>' +
        '<div class="sig"><span>Für den Vorsitz: A.</span><span>Beglaubigt: B. Aurel, Notar</span></div></div>' +
        '<button class="btn pri lg" id="certOk">Ernennung annehmen</button>';
      stage.querySelector('#certOk').onclick = () => { KY.audio.play('click'); resolve(); };
      stage.querySelector('#certOk').focus();
    });
  };

  B.codename = function (stage) {
    return new Promise(resolve => {
      const names = ['SIRIUS', 'ALTAIR', 'POLARIS', 'ANTARES', 'DENEB', 'CAPELLA', 'RIGEL', 'ARCTURUS', 'MIRA'];
      let pick = null;
      stage.innerHTML = '<div class="lbl">Rufname festlegen</div><p class="serif" style="font-size:19px;color:var(--fg2);max-width:42ch">Im Kuratorium trägt niemand seinen Namen. Wählen Sie den Rufnamen, unter dem Sie geführt werden.</p>' +
        '<div class="cn-grid">' + names.map(n => '<button data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
        '<div class="fld" style="width:100%"><label for="cnIn">Oder eigener Rufname (3–12 Buchstaben)</label><input class="inp mono" id="cnIn" maxlength="12" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.2em;text-align:center"></div>' +
        '<button class="btn pri lg" id="cnOk" disabled>Rufname bestätigen</button>';
      const ok = stage.querySelector('#cnOk'), inp = stage.querySelector('#cnIn');
      const valid = v => /^[A-ZÄÖÜ]{3,12}$/.test(v) && v !== 'VESPER' && !KY.data.council.some(m => m.id === v);
      U.on(stage, 'click', '[data-n]', (e, b) => {
        pick = b.dataset.n; inp.value = '';
        U.$$('[data-n]', stage).forEach(x => x.classList.toggle('on', x === b));
        ok.disabled = false; KY.audio.play('click');
      });
      inp.addEventListener('input', () => {
        const v = inp.value.toUpperCase().replace(/[^A-ZÄÖÜ]/g, '');
        inp.value = v;
        U.$$('[data-n]', stage).forEach(x => x.classList.remove('on'));
        pick = valid(v) ? v : null;
        ok.disabled = !pick;
        if (v === 'VESPER') { ok.disabled = true; KY.audio.play('deny'); }
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && pick) ok.click(); });
      ok.onclick = () => { KY.S.user.codename = pick; KY.audio.play('ok'); resolve(); };
    });
  };

  B.oath = function (stage) {
    return new Promise(resolve => {
      const S = KY.S;
      stage.innerHTML = '<div class="lbl">Verschwiegenheitsgelöbnis · Charta, Artikel IX</div>' +
        '<div class="cert" style="text-align:left"><p style="margin:0 0 10px">Ich gelobe, über die Existenz des Kuratoriums, über seine Beschlüsse und über den Mechanismus Stillschweigen zu bewahren, auch über meinen Rücktritt hinaus.</p>' +
        '<p style="margin:0">Ich gelobe, meine Stimme nach bestem Wissen abzugeben und die Mittel des Sitzes IX zur Erhaltung der Ordnung, zur Linderung von Not und zum Fortschritt der Wissenschaften einzusetzen.</p></div>' +
        '<label class="chk" style="text-align:left;width:100%"><input type="checkbox" id="oathChk"><span class="fg2 small">Ich habe das Gelöbnis gelesen und leiste es. Mir ist bewusst, dass alle Handlungen in KYTHERA protokolliert werden.</span></label>' +
        '<div class="fld" style="width:100%"><label for="oathSig">Unterschrift: Rufname eingeben (' + U.esc(S.user.codename) + ')</label><input class="inp mono" id="oathSig" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.2em;text-align:center"></div>' +
        '<button class="btn pri lg" id="oathOk" disabled>Gelöbnis leisten</button>';
      const chk = stage.querySelector('#oathChk'), sig = stage.querySelector('#oathSig'), ok = stage.querySelector('#oathOk');
      const upd = () => { ok.disabled = !(chk.checked && sig.value.trim().toUpperCase() === S.user.codename); };
      chk.onchange = upd; sig.oninput = upd;
      sig.addEventListener('keydown', e => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
      ok.onclick = () => { S.user.sworn = true; KY.audio.play('grant'); resolve(); };
    });
  };
})();
