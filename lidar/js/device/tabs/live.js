// Live: Datenstrom, Darstellung, Kennzahlen
import { h, seg, toggle, slider, field, stat, fmtInt } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import * as platform from './platform.js';

export function render(f, P) {
  const a = f.app, d = f.dev;
  if (!d) { P.appendChild(h('div.empty', 'Kein Scanner verbunden.')); return; }
  const tls = d.kind === 'tls';
  const row = h('div.row.wrap');
  const go = h('button.btn' + (d.state === 'idle' ? '.primary' : ''), { html: icon(d.state === 'idle' ? 'play' : 'stop') + `<span>${d.state === 'idle' ? (tls ? 'Stationsscan starten' : 'Laser an') : tls ? 'Abbrechen' : 'Laser aus'}</span>` });
  go.addEventListener('click', () => { a.toggleStream(); f.render(); });
  row.appendChild(go);
  if (!tls && d.kind !== 'phone') {
    const rec = h('button.btn' + (f.recording ? '.rec' : ''), { html: icon('rec') + `<span>${f.recording ? 'Aufnahme beenden' : 'Aufnahme starten'}</span>` });
    rec.addEventListener('click', () => f.toggleRecord());
    row.appendChild(rec);
  }
  row.appendChild(h('div.grow'));
  row.appendChild(toggle('Live-Punkte', f.showLive, (v) => { f.showLive = v; }));
  row.appendChild(toggle('Scanner folgen', f.followOn, (v) => { f.followOn = v; if (v) f.aimAtDevice(); }));
  P.appendChild(row);
  f._plat = null;
  if (d.mountKind !== 'stativ') platform.render(f, P);
  if (tls && d.state === 'tls') {
    const bar = h('div.progress', h('i'));
    f._tlsBar = bar.firstChild;
    P.appendChild(h('div', h('div.row', h('span.cap', 'Stationsscan läuft'), h('div.grow'), h('span.mono.muted', 'Kopf schwenkt 180°, Spiegel rotiert')), bar));
  }
  // Drehteller (Messraum): drehen lassen; eine Aufnahme vom Stativ landet dann in Objektkoordinaten
  const T = a.world.turntable;
  if (T && d.mountKind === 'stativ') {
    P.appendChild(field('Drehteller', h('div.row.wrap', seg([[0, 'Stopp'], [2 * Math.PI / 40, '40 s/U'], [2 * Math.PI / 20, '20 s/U'], [2 * Math.PI / 10, '10 s/U']], T.speed, (v) => { T.speed = v; f.render(); }),
      h('span.muted', { style: { fontSize: '11.5px' } }, T.speed ? 'Aufnahme in Objektkoordinaten' : ''))));
  }
  const g = h('div.fgrid');
  f._stats = g;
  P.appendChild(g);
  P.appendChild(h('h4', 'Darstellung'));
  P.appendChild(field('Farbe', seg([['intensity', 'Reflekt.'], ['intensity_rb', 'Bunt'], ['height', 'Höhe'], ['range', 'Entf.'], ['ring', 'Kanal'], ['return', 'Echo']].concat(d.spec.camera ? [['rgb', 'RGB']] : []), f.opts.mode, (v) => { f.opts.mode = v; f.render(); })));
  P.appendChild(field('Punktgröße', slider(1, 6, 0.5, f.opts.size, (v) => v.toFixed(1) + ' px', (v) => { f.opts.size = v; })));
  P.appendChild(field('Eye-Dome', h('div.row', toggle('Schattierung', f.opts.edl, (v) => { f.opts.edl = v; }), slider(0.2, 3, 0.1, f.opts.edlStrength, (v) => v.toFixed(1), (v) => { f.opts.edlStrength = v; }))));
  P.appendChild(field('Höhenbereich', slider(1, 12, 0.5, f.opts.hRange[1], (v) => `bis ${v.toFixed(1)} m`, (v) => { f.opts.hRange = [-0.2, v]; f.updateLegend(); })));
  P.appendChild(field('Entfernung', slider(2, 120, 1, f.opts.rMax, (v) => `${v} m`, (v) => { f.opts.rMax = v; f.updateLegend(); })));
  P.appendChild(field('Filter', h('div.row.wrap', toggle('Blooming ausblenden', f.opts.hideBloom, (v) => { f.opts.hideBloom = v; }), toggle('Rauschen ausblenden', f.opts.hideNoise, (v) => { f.opts.hideNoise = v; }))));
  tick(f);
}

export function tick(f) {
  const d = f.dev;
  if (!d || !f._stats) return;
  if (f._tlsBar) f._tlsBar.style.width = Math.round((f.tlsProgress || 0) * 100) + '%';
  platform.tick(f);
  const s = d.stats;
  const hit = s.srate > 0 ? (s.rate / s.srate) * 100 : 0;
  const env = f.app.world.weather;
  f._stats.replaceChildren(
    stat('Punkte/s', fmtInt(s.rate)),
    stat('Schüsse/s', fmtInt(s.srate)),
    stat('Trefferquote', hit.toFixed(0), '%'),
    stat('Datenrate', (s.rate * s.bytes * 8 / 1e6).toFixed(1), 'Mbit/s'),
    stat('Live-Puffer', fmtInt(d.live.count)),
    stat('Echo-Modus', (d.set.returns || 'strongest').replace('strongest', 'stärkstes').replace('last', 'letztes').replace('dual', 'doppelt').replace('triple', 'dreifach').replace('multi', 'alle').replace('first', 'erstes')),
    stat('Umgebung', env.fogVis ? `Sicht ${env.fogVis} m` : env.rain ? `Regen ${env.rain} mm/h` : env.sun > 0.5 ? 'Sonne' : 'klar'),
    stat('Simulation', (f.app.clock.factor * 100).toFixed(0), '% Echtzeit'),
  );
}
