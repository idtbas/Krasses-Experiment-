// Plattform & Autoscan (im Live-Bereich, sobald der Scanner nicht auf dem Stativ steht)
import { h, seg, toggle, slider, field, stat, fmtInt, fmtNum } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { PLATFORMS } from '../../robots/mounts.js';
import { STUDIO_OBJECTS } from '../../world/scenes.js';

const DEG = Math.PI / 180;

export function render(f, P) {
  const a = f.app, d = f.dev, M = a.mounts, c = M.cur;
  if (!d || !c || !PLATFORMS[c.kind]) return;
  const kind = c.kind, Pf = PLATFORMS[kind], o = M.opts[kind], job = M.job;
  const box = h('div.platform');
  box.appendChild(h('h4', `Autoscan · ${Pf.name}`));
  // Ziel
  if (kind === 'arm') {
    // Messobjekt wechseln: Messraum wird mit dem neuen Objekt neu aufgebaut, der Arm wieder montiert
    const sel = h('select');
    const cur = a.studioObject || 'bust';
    for (const [k, [name]] of Object.entries(STUDIO_OBJECTS)) { const op = h('option', { value: k }, name); if (k === cur) op.selected = true; sel.appendChild(op); }
    sel.disabled = !!job;
    sel.addEventListener('change', async () => { a.studioObject = sel.value; await a.switchScene('messraum'); await a.setMount('arm'); });
    box.appendChild(field('Objekt', h('div.sel', sel)));
  } else {
    const sel = h('select');
    const cur = M.defaultTarget();
    for (const t of M.targets()) { const op = h('option', { value: t.id }, t.name); if (cur && t.id === cur.id) op.selected = true; sel.appendChild(op); }
    sel.addEventListener('change', () => { M.opts.target = +sel.value; });
    sel.disabled = !!job;
    box.appendChild(field('Ziel', h('div.sel', sel)));
  }
  // Bahnparameter je Plattform
  const dis = (el) => { if (job) el.querySelectorAll('input,button').forEach((x) => { x.disabled = true; }); return el; };
  if (kind === 'rover') {
    if (d.kind === 'tls') box.appendChild(field('Stationen', dis(seg([[3, '3'], [4, '4'], [6, '6'], [8, '8']], o.stations, (v) => { o.stations = v; }))));
    box.appendChild(field('Abstand', dis(slider(0.6, 4, 0.1, o.dist, (v) => fmtNum(v, 1) + ' m', (v) => { o.dist = v; }))));
    if (d.kind !== 'tls') {
      box.appendChild(field('Tempo', dis(slider(0.1, 0.55, 0.05, o.speed, (v) => fmtNum(v, 2) + ' m/s', (v) => { o.speed = v; }))));
      box.appendChild(field('Runden', dis(seg([[1, '1'], [1.1, '1 + 10 %'], [2, '2']], o.laps, (v) => { o.laps = v; }))));
      box.appendChild(field('Neigung', dis(seg([[0, '0°'], [15, '15°'], [30, '30°'], [45, '45°']], o.tilt, (v) => { o.tilt = v; d.holder.rotation.x = v * DEG; }))));
    }
  } else if (kind === 'arm') {
    box.appendChild(field('Bahnen', dis(seg([[1, '1'], [2, '2'], [3, '3'], [4, '4']], o.rings, (v) => { o.rings = v; }))));
    box.appendChild(field('Umdrehung', dis(slider(8, 60, 2, o.rev, (v) => `${v} s`, (v) => { o.rev = v; }))));
  } else if (kind === 'drohne') {
    box.appendChild(field('Flugmuster', dis(seg([['raster', 'Raster'], ['orbit', 'Umrundung']], o.pattern, (v) => { o.pattern = v; }))));
    box.appendChild(field('Flughöhe', dis(slider(0, 60, 1, o.alt, (v) => (v ? `${v} m` : 'automatisch'), (v) => { o.alt = v; }))));
    box.appendChild(field('Tempo', dis(slider(0.5, 10, 0.5, o.speed, (v) => fmtNum(v, 1) + ' m/s', (v) => { o.speed = v; }))));
    box.appendChild(field('Überlappung', dis(slider(0.2, 0.8, 0.1, o.overlap, (v) => Math.round(v * 100) + ' %', (v) => { o.overlap = v; }))));
  } else if (kind === 'hand' && d.kind === 'phone') {
    box.appendChild(field('Modus', dis(seg([['objekt', 'Objekt umrunden'], ['raum', 'Raum rundum']], o.phoneMode, (v) => { o.phoneMode = v; a.phone.opts.mode = v; a.phone.renderSide(); }))));
    box.appendChild(field('Abstand', dis(slider(0.4, 2.5, 0.1, o.phoneDist, (v) => fmtNum(v, 1) + ' m vom Objekt', (v) => { o.phoneDist = v; }))));
    box.appendChild(field('Gehtempo', dis(slider(0.2, 0.6, 0.05, Math.min(0.6, o.speed), (v) => fmtNum(v, 2) + ' m/s', (v) => { o.speed = v; }))));
    box.appendChild(h('div.hint.muted', 'Gesteuert wird in der Handy-App (Auslöser). Die Pose kommt wie bei ARKit aus Kamera und IMU (visuell-inertial) – mit etwa 1 % Drift der Wegstrecke.'));
  } else if (kind === 'hand') {
    box.appendChild(field('Abstand', dis(slider(0.8, 4, 0.1, o.dist, (v) => fmtNum(v, 1) + ' m', (v) => { o.dist = v; }))));
    box.appendChild(field('Gehtempo', dis(slider(0.3, 1.4, 0.1, o.speed, (v) => fmtNum(v, 1) + ' m/s', (v) => { o.speed = v; }))));
    box.appendChild(field('Runden', dis(seg([[1, '1'], [1.1, '1 + 10 %'], [2, '2']], o.laps, (v) => { o.laps = v; }))));
  }
  // Positionsbestimmung
  if (kind !== 'arm' && d.kind !== 'tls' && d.kind !== 'phone') {
    const rtk = kind === 'drohne' ? 'RTK-GNSS/INS' : 'Referenz';
    box.appendChild(field('Position', dis(seg([['ideal', rtk], ['odo', Pf.odoName], ['slam', 'LiDAR-SLAM']], M.opts.pos, (v) => { M.opts.pos = v; f.render(); }))));
    box.appendChild(field('Entzerrung', dis(toggle('Punkte mit Pose ihres Zeitstempels (Deskew)', M.opts.deskew, (v) => { M.opts.deskew = v; }))));
    const hint = {
      ideal: kind === 'drohne' ? 'Zentimetergenaue Bahn aus RTK-GNSS und Inertialsystem (Nachbearbeitung).' : 'Exakte Bahn – so gut wie ein externes Messsystem.',
      odo: kind === 'rover' ? 'Nur Radencoder und Kreisel: Maßstabs- und Kursfehler wachsen mit jeder Kurve – die Wolke verdoppelt sich am Schleifenschluss.' : kind === 'drohne' ? 'GNSS ohne Korrekturdaten: die Bahn wandert um ein bis zwei Meter.' : 'Nur Inertialsensoren: ohne Stützung wird der Fehler schnell sehr groß.',
      slam: 'Jede Umdrehung wird gegen die bisher gebaute Karte registriert (Punkt-zu-Ebene). Restfehler hängen von Geometrie und Bewegung ab.',
    }[M.opts.pos];
    box.appendChild(h('div.hint.muted', hint));
  }
  // Start/Stopp und Fortschritt
  const row = h('div.row.wrap');
  const go = h('button.btn' + (job ? '.rec' : '.primary'), { html: icon(job ? 'stop' : 'play') + `<span>${job ? 'Autoscan stoppen' : 'Autoscan starten'}</span>` });
  go.addEventListener('click', () => { M.start(); f.render(); });
  row.appendChild(go);
  box.appendChild(row);
  const prog = h('div.progress', h('i'));
  const phase = h('div.mono.muted.small');
  f._plat = { prog: prog.firstChild, phase, stats: h('div.fgrid') };
  if (job) box.append(phase, prog);
  box.appendChild(f._plat.stats);
  P.appendChild(box);
  tick(f);
}

export function tick(f) {
  const a = f.app, M = a.mounts, j = M.job, X = f._plat;
  if (!X) return;
  if (j) {
    X.prog.style.width = Math.round((j.progress || 0) * 100) + '%';
    X.phase.textContent = j.phase || '';
  }
  const r = f.recording;
  if (!r || !r.loc) { X.stats.replaceChildren(); return; }
  const s = r.loc.stats, L = [];
  L.push(stat('Punkte', fmtInt(r.scan.points)));
  L.push(stat('Strecke', fmtNum(s.dist, 1), 'm'));
  if (r.loc.mode !== 'ideal' && !r.loc.tt) {
    L.push(stat('Δ Position', s.errP < 1 ? fmtNum(s.errP * 100, 1) : fmtNum(s.errP, 2), s.errP < 1 ? 'cm' : 'm'));
    L.push(stat('Δ Kurs', fmtNum(s.errYaw, 2), '°'));
  }
  if (r.loc.mode === 'slam') {
    L.push(stat('ICP-RMS', fmtNum(s.rms * 1000, 1), 'mm'));
    L.push(stat('Karte', fmtInt(s.voxels), 'Voxel'));
  }
  X.stats.replaceChildren(...L);
}
