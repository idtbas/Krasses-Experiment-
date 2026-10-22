/* KYTHERA · MANDAT · Erzeugt geschwärzte Entwicklungs-Screenshots („SECRET“), damit nichts vorweggenommen wird.
   Aufruf: node tools/redact.js <quellordner> <zielordner> */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [src, dst] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(dst, { recursive: true });
  const files = fs.readdirSync(src).filter(f => /\.png$/.test(f)).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  let n = 0;
  for (const f of files) {
    const b64 = fs.readFileSync(path.join(src, f)).toString('base64');
    const out = await page.evaluate(async ({ b64, seed }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      let s = seed;
      const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      // Grundbild stark verwischt, nur ein schmaler Streifen bleibt erkennbar
      g.filter = 'blur(14px) saturate(0.5) brightness(0.7)';
      g.drawImage(img, 0, 0);
      g.filter = 'none';
      const keepY = Math.floor(r() * (c.height * 0.6)), keepH = Math.floor(c.height * 0.14);
      g.save(); g.beginPath(); g.rect(0, keepY, c.width * 0.45, keepH); g.clip(); g.filter = 'blur(6px)'; g.drawImage(img, 0, 0); g.restore();
      // Schwärzungsbalken
      g.fillStyle = '#000';
      for (let i = 0; i < 26; i++) {
        const w = 80 + r() * 380, h = 10 + r() * 22, x = r() * (c.width - w), y = r() * (c.height - h);
        g.fillRect(x, y, w, h);
      }
      g.fillRect(0, keepY + 4, c.width * 0.45 * (0.4 + r() * 0.5), 14);
      // Stempel
      const stamp = (x, y, size, rot) => {
        g.save(); g.translate(x, y); g.rotate(rot);
        g.font = '800 ' + size + 'px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText('SECRET').width + size * 0.6;
        g.strokeStyle = 'rgba(200,30,30,0.85)'; g.lineWidth = size * 0.08; g.strokeRect(-w / 2, -size * 0.65, w, size * 1.3);
        g.fillStyle = 'rgba(200,30,30,0.85)'; g.fillText('SECRET', 0, 0);
        g.restore();
      };
      stamp(c.width / 2, c.height / 2, 120, -0.18);
      stamp(c.width * 0.18, c.height * 0.82, 44, 0.12);
      stamp(c.width * 0.84, c.height * 0.16, 38, -0.3);
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, c.height - 30, c.width, 30);
      g.fillStyle = '#c9a24f'; g.font = '600 13px monospace'; g.textAlign = 'left';
      g.fillText('KYTHERA · MANDAT · ENTWICKLUNGSAUFNAHME · INHALT GESCHWÄRZT', 14, c.height - 11);
      return c.toDataURL('image/png').split(',')[1];
    }, { b64, seed: 9973 + n * 131 });
    n++;
    fs.writeFileSync(path.join(dst, 'SECRET_MANDAT_' + String(n).padStart(2, '0') + '.png'), Buffer.from(out, 'base64'));
  }
  await browser.close();
  console.log(n, 'geschwärzte Aufnahmen in', dst);
})().catch(e => { console.error(e); process.exit(1); });
