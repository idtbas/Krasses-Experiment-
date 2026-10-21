/* Baut KYTHERA zu einzelnen HTML-Dateien:
   dist/kythera.html            Seiteninhalt ohne Dokumentgerüst (für die Veröffentlichung als Artifact)
   dist/kythera-standalone.html vollständige Einzeldatei zum direkten Öffnen
   Aufruf: node tools/build.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g)].map(m => fs.readFileSync(path.join(root, m[1]), 'utf8')).join('\n');
const block = html.slice(html.indexOf('<!-- KY:SCRIPTS -->'), html.indexOf('<!-- /KY:SCRIPTS -->'));
const scripts = [...block.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => {
  const src = fs.readFileSync(path.join(root, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '/* ' + m[1] + ' */\n' + src;
}).join('\n');
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/)[0];

const page = [
  '<title>KYTHERA</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="description" content="Kuratoriales Lage- und Steuerungssystem">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  fonts,
  '<style>\n' + css + '\n</style>',
  '<div id="app"></div>',
  '<script>\n' + scripts + '\n</script>',
].join('\n');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'kythera.html'), page);
const standalone = '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#07090b">\n' +
  page.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>') + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(root, 'dist', 'kythera-standalone.html'), standalone);
console.log('dist/kythera.html', (page.length / 1024).toFixed(1) + ' KB');
console.log('dist/kythera-standalone.html', (standalone.length / 1024).toFixed(1) + ' KB');
