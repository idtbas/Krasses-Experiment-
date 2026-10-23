// Scans im Projekt: Liste, Sichtbarkeit, Umbenennen, Löschen
import { h, toggle, fmtInt, fmtBytes, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';

export function render(f, P) {
  const a = f.app, d = f.dev;
  const row = h('div.row.wrap');
  if (d && d.kind === 'tls') { const b = h('button.btn.primary', { html: icon('play') + '<span>Stationsscan starten</span>' }); b.addEventListener('click', () => f.stationScan()); row.appendChild(b); }
  else if (d && d.kind !== 'phone') { const b = h('button.btn' + (f.recording ? '.rec' : ''), { html: icon('rec') + `<span>${f.recording ? 'Aufnahme beenden' : 'Aufnahme starten'}</span>` }); b.addEventListener('click', () => f.toggleRecord()); row.appendChild(b); }
  row.appendChild(h('div.grow'));
  if (a.project.scans.length) { const b = h('button.btn.small', { html: icon('trash') + '<span>Alle löschen</span>' }); b.addEventListener('click', () => { a.project.clear(); toast('Projekt geleert'); }); row.appendChild(b); }
  P.appendChild(row);
  const list = h('div.list');
  if (!a.project.scans.length) list.appendChild(h('div.empty', d && d.kind === 'tls' ? 'Noch keine Stationen. Stativ in der Szene platzieren und „Stationsscan“ drücken. Für ein vollständiges Modell mehrere Standorte scannen und danach ausrichten.' : 'Noch keine Aufnahmen. „Aufnahme starten“ speichert den Datenstrom als Scan.'));
  for (const s of a.project.scans) {
    const it = h('div.litem' + (f.selScan === s ? '.on' : ''));
    const vis = h('button.btn.small.icon.ghost', { html: icon(s.visible ? 'eye' : 'close'), title: 'Ein-/ausblenden' });
    vis.addEventListener('click', (e) => { e.stopPropagation(); s.visible = !s.visible; f.render(); });
    const del = h('button.btn.small.icon.ghost', { html: icon('trash'), title: 'Löschen' });
    del.addEventListener('click', (e) => { e.stopPropagation(); if (f.selScan === s) f.selScan = null; a.project.remove(s); });
    const kind = { station: 'Station', mobile: 'Mobil', phone: 'Smartphone', import: 'Import', mesh: 'Netz', derived: 'Bearbeitet' }[s.kind] || s.kind;
    const reg = s.kind === 'station' ? (s.registered ? '<span class="chip ok">ausgerichtet</span>' : '<span class="chip warn">nicht ausgerichtet</span>') : '';
    it.append(h('span.sw', { style: { background: s.color } }), h('div.t', { html: `<b>${s.name}</b><small>${kind} · ${s.spec ? s.spec.model : ''} · ${fmtInt(s.points)} Pkt · ${fmtBytes(s.points * 26)}</small>` }), h('span', { html: reg }), vis, del);
    it.addEventListener('click', () => { f.selScan = s; f.render(); });
    list.appendChild(it);
  }
  P.appendChild(list);
  const s = f.selScan;
  if (s && a.project.scans.includes(s)) {
    P.appendChild(h('h4', 'Details'));
    const name = h('input', { value: s.name, style: { background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: '6px', height: '28px', padding: '0 8px', width: '100%' } });
    name.addEventListener('change', () => { s.name = name.value; f.render(); });
    P.appendChild(name);
    const b = s.cloud.box;
    const size = b.isEmpty() ? null : b.getSize(new (b.min.constructor)());
    P.appendChild(h('div.kv',
      h('span', 'Punkte'), h('b', fmtInt(s.points)),
      s.stats.nominal ? h('span', 'Punkte am Gerät') : null, s.stats.nominal ? h('b', fmtInt(s.stats.nominal)) : null,
      s.stats.decimate > 1 ? h('span', 'Simulationsdichte') : null, s.stats.decimate > 1 ? h('b', `1:${s.stats.decimate * s.stats.decimate}`) : null,
      h('span', 'Dauer'), h('b', `${s.stats.duration.toFixed(1)} s`),
      size ? h('span', 'Ausdehnung') : null, size ? h('b', `${size.x.toFixed(2)} × ${size.z.toFixed(2)} × ${size.y.toFixed(2)} m`) : null,
      h('span', 'Erstellt'), h('b', s.created.toLocaleTimeString('de-DE')),
      h('span', 'Farbe in Szene'), h('b', '')));
    P.appendChild(toggle('In der 3D-Szene zeigen', s.cloud.visibleInScene, (v) => { s.cloud.visibleInScene = v; }));
  }
}
