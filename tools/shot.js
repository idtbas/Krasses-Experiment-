/* Entwicklungswerkzeug: automatischer Durchlauf mit geschwärzten Kontroll-Screenshots.
   Aufruf: node tools/shot.js [modul,modul,...] [--w 1440] [--h 900] [--prefix 01] [--blur 6]
   Alle Bilder heißen SECRET_*.png und sind großflächig geschwärzt. */
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const args = process.argv.slice(2);
const opt = { w: 1440, h: 900, prefix: 'XX', blur: 6, bars: 14, mods: ['lage'], out: path.join(__dirname, '..', 'dev-screenshots'), ff: 0, keep: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--prefix') opt.prefix = args[++i];
  else if (a === '--blur') opt.blur = +args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--bars') opt.bars = +args[++i];
  else if (a === '--ff') opt.ff = +args[++i];
  else if (a === '--eval') opt.evalFile = args[++i];
  else opt.mods = a.split(',');
}

const REDACT = `(blur, seed, bars) => {
  document.querySelectorAll('.secret-ovl').forEach(e => e.remove());
  const W = innerWidth, H = innerHeight;
  const o = document.createElement('div');
  o.className = 'secret-ovl';
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;backdrop-filter:blur(' + blur + 'px);-webkit-backdrop-filter:blur(' + blur + 'px);';
  let r = seed;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  let html = '';
  // großflächige Schwärzungsbalken (ca. 45 % der Fläche)
  for (let i = 0; i < bars; i++) {
    const w = 120 + rnd() * W * 0.3, h = 16 + rnd() * H * 0.16;
    const x = rnd() * (W - w), y = rnd() * (H - h);
    html += '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;background:#000;opacity:.94"></div>';
  }
  for (let i = 0; i < Math.max(2, Math.round(bars / 3)); i++) {
    html += '<div style="position:absolute;left:' + (rnd() * W * 0.8) + 'px;top:' + (rnd() * H * 0.85) + 'px;transform:rotate(-14deg);font:700 54px/1 monospace;letter-spacing:.3em;color:rgba(200,40,40,.55);border:5px solid rgba(200,40,40,.55);padding:6px 18px">SECRET</div>';
  }
  o.innerHTML = html;
  document.body.appendChild(o);
}`;

(async () => {
  fs.mkdirSync(opt.out, { recursive: true });
  const browser = await pw.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined });
  const ctx = await browser.newContext({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  const url = 'file://' + path.join(__dirname, '..', 'index.html');
  await page.goto(url);
  await page.evaluate(() => {
    const S = KY.newState();
    S.user.sworn = true; S.user.codename = 'TESTER'; S.meta.boots = 1;
    localStorage.setItem('kythera.sitz9.v3', JSON.stringify(S));
  });
  await page.goto(url);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#nav .ni', { timeout: 15000 });
  await page.waitForTimeout(800);
  if (opt.ff) await page.evaluate(n => { KY.engine.catchUp(n, false); }, opt.ff);
  if (opt.evalFile) await page.evaluate(fs.readFileSync(opt.evalFile, 'utf8'));
  // Dialoge schließen
  await page.evaluate(() => { while (KY.ui.stack.length) KY.ui.stack[KY.ui.stack.length - 1].close(); });
  let i = 0;
  for (const m of opt.mods) {
    const [mod, arg] = m.split(':');
    await page.evaluate(([a, b]) => { KY.ui.go(a, b || undefined); }, [mod, arg]);
    await page.waitForTimeout(1600);
    await page.evaluate(() => { document.querySelectorAll('.ovl').forEach(o => o.remove()); KY.ui.stack = []; });
    const overflow = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page-x-scroll ' + document.documentElement.scrollWidth);
      document.querySelectorAll('.work *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > innerWidth + 2 && !el.closest('.tbl-w,.res,.tabs,.resb,.ticker,.map-wrap')) out.push((el.className || el.tagName) + ' right=' + Math.round(r.right));
      });
      return out.slice(0, 8);
    });
    if (overflow.length) console.log('OVERFLOW', mod, overflow.join(' | '));
    await page.evaluate(REDACT.replace('(blur, seed, bars) =>', '((blur, seed, bars) =>') + ')(' + opt.blur + ',' + (17 + i * 31) + ',' + opt.bars + ')');
    const file = path.join(opt.out, 'SECRET_' + opt.prefix + '_' + String(++i).padStart(2, '0') + '.png');
    await page.screenshot({ path: file });
    await page.evaluate(() => document.querySelectorAll('.secret-ovl').forEach(e => e.remove()));
    console.log('saved', path.basename(file), mod);
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 20).join('\n') : 'no console errors');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
