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

// Gerätemodus: device.html ist dasselbe OS ohne Emulator – Skripte und Stylesheets müssen übereinstimmen.
// `node visto/tools/build.js --check` prüft nur das (für den Pages-Workflow) und baut nichts.
(function checkDevice() {
  if (!fs.existsSync(path.join(ROOT, 'device.html'))) { if (process.argv.includes('--check')) throw new Error('device.html fehlt'); return; }
  const list = (name, src) => {
    const b = src.match(/<!-- BUNDLE:START -->([\s\S]*?)<!-- BUNDLE:END -->/);
    if (!b) throw new Error('BUNDLE-Markierung fehlt in ' + name);
    return {
      js: Array.from(b[1].matchAll(/<script src="([^"]+)"><\/script>/g)).map((x) => x[1]),
      css: Array.from(src.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g)).map((x) => x[1]),
    };
  };
  const a = list('index.html', html), d = list('device.html', read('device.html'));
  for (const kind of ['js', 'css']) {
    const what = kind === 'js' ? 'Skriptliste' : 'Stylesheets';
    const onlyA = a[kind].filter((f) => !d[kind].includes(f)), onlyD = d[kind].filter((f) => !a[kind].includes(f));
    if (onlyA.length || onlyD.length) {
      throw new Error(what + ' von index.html und device.html weichen ab.'
        + (onlyA.length ? '\n  fehlt in device.html: ' + onlyA.join(', ') : '')
        + (onlyD.length ? '\n  fehlt in index.html:  ' + onlyD.join(', ') : ''));
    }
    const i = a[kind].findIndex((f, k) => f !== d[kind][k]);
    if (i >= 0) throw new Error(what + ': Reihenfolge weicht ab (Stelle ' + (i + 1) + '): index.html „' + a[kind][i] + '“ · device.html „' + d[kind][i] + '“');
  }
  for (const f of a.js.concat(a.css)) if (!fs.existsSync(path.join(ROOT, f))) throw new Error('Datei fehlt: ' + f);
  console.log('Geprüft: index.html und device.html laden dieselben', a.js.length, 'Skripte und', a.css.length, 'Stylesheets');
})();
if (process.argv.includes('--check')) process.exit(0);

// alle eigenen Stylesheets einbetten (css/*.css)
const cssFiles = Array.from(html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g));
let css = '';
for (const m0 of cssFiles) { css += '\n/* ===== ' + m0[1] + ' ===== */\n' + read(m0[1]); html = html.replace(m0[0], ''); }
html = html.replace('</head>', () => '<style>\n' + css + '\n</style>\n</head>');
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
