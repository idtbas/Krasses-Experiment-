/* VistoOS · tools/build.js — baut die eigenständige Einzeldatei dist/visto.html
 *  node visto/tools/build.js
 *  (Schriften kommen weiterhin von Google Fonts; ohne Netz greift die Systemschrift.)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let html = read('index.html');
const css = read('css/visto.css');
html = html.replace('<link rel="stylesheet" href="css/visto.css">', () => '<style>\n' + css + '\n</style>');
const m = html.match(/<!-- BUNDLE:START -->([\s\S]*?)<!-- BUNDLE:END -->/);
if (!m) throw new Error('BUNDLE-Markierung fehlt in index.html');
const files = Array.from(m[1].matchAll(/<script src="([^"]+)"><\/script>/g)).map((x) => x[1]);
let js = '';
for (const f of files) {
  const src = read(f);
  if (/<\/script/i.test(src)) throw new Error('Unzulässiges </script> in ' + f);
  js += '\n/* ===== ' + f + ' ===== */\n' + src + '\n';
}
html = html.replace(m[0], () => '<script>\n' + js + '\n</script>');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'visto.html');
fs.writeFileSync(out, html);
console.log('Gebaut:', path.relative(process.cwd(), out), (html.length / 1024).toFixed(0) + ' KB,', files.length, 'Skripte');

// Fassung für ein Claude-Artefakt: ohne eigenes Dokumentgerüst (die Plattform legt es an)
const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
const fonts = Array.from(html.matchAll(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g)).map((x) => x[0]).join('\n');
const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const body = (html.match(/<body>([\s\S]*)<\/body>/) || ['', ''])[1];
const art = [title.replace(/VistoOS · Emulator/, "VistoOS Emulator"), '<meta name="claude:viewport-fit-sides" content="cover">', '<meta name="theme-color" content="#000000">', fonts, style, body.trim()].join('\n');
const out2 = path.join(ROOT, 'dist', 'visto-artifact.html');
fs.writeFileSync(out2, art);
console.log('Gebaut:', path.relative(process.cwd(), out2), (art.length / 1024).toFixed(0) + ' KB');
