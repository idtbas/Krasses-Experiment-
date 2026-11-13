/* VistoOS · tools/sheet.js — Übersichtsbild: viele Bildschirme als Raster
 *  node visto/tools/sheet.js <ausgabe.png> [spalten]
 *  Nimmt Zifferblatt, Apps und Systemansichten auf (nur was schon existiert) und setzt sie zu einem Bild zusammen.
 */
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const VIEWS = [
  ['Zifferblatt', '?skip', []],
  ['Visto hört zu', '?skip', [{ eval: 'V.convo.activate({via:"text"})' }, { wait: 1500 }]],
  ['Visto antwortet', '?skip', [{ eval: 'V.convo.input("Wie spät ist es?")' }, { wait: 2600 }]],
  ['App-Orbit', '?skip', [{ eval: 'V.shell.launcher()' }, { wait: 1300 }]],
  ['Kontrollzentrum', '?skip', [{ eval: 'V.control && V.control.open && V.control.open()' }, { wait: 1300 }], 'control'],
  ['Zifferblatt-Editor', '?skip', [{ eval: 'V.faceEditor && V.faceEditor.open && V.faceEditor.open()' }, { wait: 1300 }], 'faceEditor'],
];
const FACES = ['analog', 'stack', 'rings', 'words', 'orbit', 'flux', 'night'];
const APPS = ['timer', 'stopwatch', 'alarm', 'worldclock', 'weather', 'calendar', 'reminders', 'music', 'home', 'focus', 'breathe', 'photos', 'calculator', 'settings'];

(async () => {
  const out = process.argv[2] || 'sheet.png';
  const cols = +(process.argv[3] || 4);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13 Pro'], timezoneId: process.env.VISTO_TZ || 'Europe/Berlin', locale: 'de-DE', deviceScaleFactor: 1.5 });
  const shots = [];
  const tmp = path.join(path.dirname(out), '.sheet');
  fs.mkdirSync(tmp, { recursive: true });
  const base = 'file://' + path.join(__dirname, '..', 'index.html');

  async function grab(label, search, steps, needs) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    try {
      await page.goto(base + search, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      if (needs) { const ok = await page.evaluate((n) => !!(window.V && V[n] && Object.keys(V[n]).length), needs); if (!ok) { await page.close(); return; } }
      for (const s of steps) {
        if (s.wait) await page.waitForTimeout(s.wait);
        if (s.eval) await page.evaluate(s.eval).catch((e) => errs.push(e.message));
      }
      await page.waitForTimeout(steps.some((s) => s.wait) ? 200 : 1400);
      const r = await page.evaluate(() => { const b = document.querySelector('.vos-display').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width }; });
      const f = path.join(tmp, shots.length + '.png');
      await page.screenshot({ path: f, clip: { x: r.x - 3, y: r.y - 3, width: r.w + 6, height: r.w + 6 } });
      shots.push({ label, f, err: errs[0] });
    } catch (e) { shots.push({ label, f: null, err: e.message }); }
    await page.close();
  }

  for (const [l, s, st, n] of VIEWS) await grab(l, s, st, n);
  const probe = await ctx.newPage();
  await probe.goto(base + '?skip', { waitUntil: 'load' });
  await probe.waitForTimeout(500);
  const info = await probe.evaluate(() => ({ faces: V.faces.list().map((f) => [f.id, f.name]), apps: V.apps.list().map((a) => [a.id, a.name]) }));
  await probe.close();
  for (const [id, name] of info.faces) if (FACES.includes(id)) await grab('Zifferblatt · ' + name, '?skip&face=' + id, []);
  for (const [id, name] of info.apps) if (APPS.includes(id)) await grab(name, '?skip&app=' + id, [{ wait: 1700 }]);

  const cells = shots.map((s) => `<figure>${s.f ? `<img src="file://${s.f}">` : '<div class="miss">–</div>'}<figcaption>${s.label}${s.err ? ' <em>⚠</em>' : ''}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0b0c10;color:#fff;font:600 15px 'Inter Tight',system-ui,sans-serif;padding:22px}
    h1{font-size:20px;margin:0 0 16px;font-weight:700;letter-spacing:-.01em} h1 span{color:#8a8f99;font-weight:500}
    .g{display:grid;grid-template-columns:repeat(${cols},260px);gap:18px 16px}
    figure{margin:0;text-align:center} img{width:260px;height:260px;border-radius:50%;display:block}
    figcaption{margin-top:8px;color:#c9ccd3;font-size:13px} em{color:#ff9f0a;font-style:normal}
    .miss{width:260px;height:260px;border-radius:50%;background:#16171b}
  </style><h1>VistoOS <span>· ${shots.length} Ansichten</span></h1><div class="g">${cells}</div>`;
  const hp = path.join(tmp, 'sheet.html');
  fs.writeFileSync(hp, html);
  const p2 = await browser.newPage({ viewport: { width: 22 * 2 + cols * 276, height: 400 }, deviceScaleFactor: 1 });
  await p2.goto('file://' + hp);
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log('ok', out, shots.length, 'Ansichten', shots.filter((s) => s.err).map((s) => s.label + ': ' + s.err).join(' | '));
})();
