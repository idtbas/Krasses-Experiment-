/* KYTHERA · MANDAT · Baut eine eigenständige Einzeldatei: dist/kythera-standalone.html */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let html = read('index.html');
const css = read('css/app.css');
html = html.replace('<link rel="stylesheet" href="css/app.css">', () => '<style>\n' + css + '\n</style>');

const m = html.match(/<!-- BUNDLE:START -->([\s\S]*?)<!-- BUNDLE:END -->/);
if (!m) throw new Error('BUNDLE-Markierung fehlt in index.html');
const files = Array.from(m[1].matchAll(/<script src="([^"]+)"><\/script>/g)).map(x => x[1]);
let js = '';
for (const f of files) {
  const src = read(f);
  if (/<\/script/i.test(src)) throw new Error('Unzulässiges </script> in ' + f);
  js += '\n/* ===== ' + f + ' ===== */\n' + src + '\n';
}
html = html.replace(m[0], () => '<script>\n' + js + '\n</script>');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'kythera-standalone.html');
fs.writeFileSync(out, html);
console.log('Gebaut:', path.relative(ROOT, out), (html.length / 1024).toFixed(0) + ' KB,', files.length, 'Skripte');
