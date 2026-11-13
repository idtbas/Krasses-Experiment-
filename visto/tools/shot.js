/* VistoOS · tools/shot.js — Screenshots im Handy-Format (Playwright)
 *
 *  node visto/tools/shot.js <ausgabe.png> [suchparameter] [schritte-json] [--display]
 *  Schritte: [{"wait":ms}, {"eval":"js"}, {"tap":[x,y]} (logisch 0…1000), {"swipe":[x0,y0,x1,y1]}, {"rotate":[a0,a1,r]}, {"files":[pfade]} (vor dem Antippen), {"type":"text"}]
 *  --display  nur das runde Display ausschneiden
 *  Zeigt Konsolenfehler der Seite an.
 */
'use strict';
const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const [out, search = '?skip', stepsJson = '[]', ...flags] = process.argv.slice(2);
  if (!out) { console.error('Ausgabe fehlt'); process.exit(1); }
  const steps = JSON.parse(stepsJson);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13 Pro'], timezoneId: process.env.VISTO_TZ || 'Europe/Berlin', locale: 'de-DE', deviceScaleFactor: flags.includes('--hd') ? 3 : 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const base = process.env.VISTO_URL || 'file://' + path.join(__dirname, '..', 'index.html');
  await page.goto(base + search, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const disp = async () => page.evaluate(() => { const r = document.querySelector('.vos-display').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
  for (const s of steps) {
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.eval) { try { await page.evaluate(s.eval); } catch (e) { errors.push('eval: ' + e.message); } }
    if (s.tap) { const d = await disp(); await page.mouse.click(d.x + (s.tap[0] / 1000) * d.w, d.y + (s.tap[1] / 1000) * d.w); }
    if (s.swipe) {
      const d = await disp();
      const [x0, y0, x1, y1] = s.swipe.map((v) => (v / 1000) * d.w);
      await page.mouse.move(d.x + x0, d.y + y0);
      await page.mouse.down();
      const n = 12;
      for (let i = 1; i <= n; i++) { await page.mouse.move(d.x + x0 + ((x1 - x0) * i) / n, d.y + y0 + ((y1 - y0) * i) / n); await page.waitForTimeout(16); }
      await page.mouse.up();
    }
    if (s.rotate) {
      // am Rand entlangfahren: [startWinkel, endWinkel, radius] in Uhrwinkel-Grad / logisch
      const d = await disp();
      const [a0, a1, r = 460] = s.rotate;
      const at = (a) => ({ x: d.x + ((500 + Math.sin(a * Math.PI / 180) * r) / 1000) * d.w, y: d.y + ((500 - Math.cos(a * Math.PI / 180) * r) / 1000) * d.w });
      let p0 = at(a0); await page.mouse.move(p0.x, p0.y); await page.mouse.down();
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
      for (let i = 1; i <= n; i++) { const p = at(a0 + ((a1 - a0) * i) / n); await page.mouse.move(p.x, p.y); await page.waitForTimeout(16); }
      await page.mouse.up();
    }
    if (s.files) {
      // Dateien für den nächsten <input type=file> bereitlegen (vor dem Klick registrieren)
      page.once('filechooser', (fc) => fc.setFiles(s.files).catch((e) => errors.push('files: ' + e.message)));
    }
    if (s.type) { await page.fill('.talk-field input', s.type); await page.press('.talk-field input', 'Enter'); }
    if (s.shot) {
      const d = await disp();
      await page.screenshot({ path: s.shot, clip: flags.includes('--display') ? { x: d.x - 4, y: d.y - 4, width: d.w + 8, height: d.w + 8 } : undefined });
    }
  }
  const d = await disp();
  await page.screenshot({ path: out, clip: flags.includes('--display') ? { x: d.x - 4, y: d.y - 4, width: d.w + 8, height: d.w + 8 } : undefined, fullPage: flags.includes('--full') });
  if (errors.length) console.log('FEHLER:\n' + errors.slice(0, 20).join('\n'));
  else console.log('ok', out);
  await browser.close();
})();
