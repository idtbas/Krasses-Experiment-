// Sensorzustand des Einzelgeräts: Betriebsphase, Temperatur und Entfernungsdrift, Netzwerk und Paketverlust,
// Kalibrierung. Karte für Live und Gerät, aktualisiert im Takt der Feldrechner-Anzeige.
import { h, setHTML } from '../../ui/dom.js';

const PHASE = { aus: 'Aus', boot: 'Bootet (Selbsttest)', anlauf: 'Motoranlauf', misst: 'Misst', bereit: 'Bereitschaft (Motor steht)' };
const CAL = { ideal: 'Ideal (ohne Fehler)', werk: 'Werkskalibrierung', dejustiert: 'Dejustiert (nach Sturz)' };
const n1 = (v, d = 1) => v.toFixed(d).replace('.', ',');

export function sensorCard(f) {
  const el = h('div.health');
  f._health = el;
  tickCard(f);
  return el;
}

export function tickCard(f) {
  const el = f._health, d = f.dev;
  if (!el || !el.isConnected || !d || !d.unit) return;
  const U = d.unit, ph = U.phase;
  const tls = d.state === 'tls';
  const phase = tls && ph === 'boot' ? 'Selbsttest, Kompensator' : tls ? `Stationsscan ${Math.round((f.tlsProgress || 0) * 100)} %` : PHASE[ph];
  const prog = ph === 'boot' || ph === 'anlauf' ? U.progress : tls ? f.tlsProgress || 0 : ph === 'misst' ? 1 : 0;
  const warm = Math.abs(U.T - U.Tref) < 1.5 ? 'eingeschwungen' : U.T < U.Tref ? 'wärmt auf' : 'über Betriebstemperatur';
  const load = d.kind === 'stream' && d.state === 'stream' ? U.loadOf(d.bitRate) : 0, loss = U.lossRate;
  const rpm = d.pattern.hz && d.pattern.type === 'spin' ? `${Math.round(U.rpmFrac * d.pattern.hz * 60)} U/min` : '';
  const cls = (v, a, b) => (v > b ? 'bad' : v > a ? 'warn' : 'ok');
  setHTML(el, `
    <div class="hrow"><span>Zustand</span><b class="${ph === 'misst' || tls ? 'ok' : ph === 'aus' ? '' : 'warn'}">${phase}</b>${rpm ? `<em>${rpm}</em>` : ''}</div>
    <div class="hbar"><i style="width:${(prog * 100).toFixed(0)}%"></i></div>
    <div class="hgrid">
      <div><span>Temperatur</span><b>${n1(U.T)} °C</b><em>${warm}</em></div>
      <div><span>Entfernungsdrift</span><b class="${cls(Math.abs(U.bias) * 1000, 3, 8)}">${U.bias >= 0 ? '+' : '−'}${n1(Math.abs(U.bias) * 1000)} mm</b><em>${n1(U.kT * 1000, 2)} mm/K</em></div>
      <div><span>${U.link.name}</span><b class="${cls(load, 0.7, 0.92)}">${load ? n1(load * 100, 0) + ' %' : '–'}</b><em>${load ? n1(d.bitRate / 1e6, 1) + ' von ' + U.link.mbit + ' Mbit/s' : 'kein Datenstrom'}</em></div>
      <div><span>Paketverlust</span><b class="${cls(loss, 0.001, 0.02)}">${n1(loss * 100, loss < 0.1 ? 2 : 0)} %</b><em>${Math.round(U.pktRate)} Pakete/s</em></div>
    </div>
    <div class="hrow small"><span>SN ${U.serial}</span><em>${CAL[U.calibMode]} · ${U.channels} Kanäle</em></div>`);
}

// Restfehler der Kalibrierung je Kanal als Balkendiagramm (Entfernung in mm oben, Elevation in Millgrad unten)
export function calibChart(U) {
  const C = U.calib, n = C.dR.length;
  const W = 320, H = 96, mid1 = 26, mid2 = 72, bw = Math.max(1, W / n - 1);
  const maxR = Math.max(0.002, ...C.dR.map(Math.abs)), maxE = Math.max(1e-6, ...C.dEl.map(Math.abs));
  let bars = '';
  for (let i = 0; i < n; i++) {
    const x = (i * W) / n;
    const hr = (C.dR[i] / maxR) * 20, he = (C.dEl[i] / maxE) * 20;
    bars += `<rect x="${x.toFixed(1)}" y="${(hr > 0 ? mid1 - hr : mid1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(hr).toFixed(1)}" fill="#5fd3ff"/>`;
    bars += `<rect x="${x.toFixed(1)}" y="${(he > 0 ? mid2 - he : mid2).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(he).toFixed(1)}" fill="#f2b23a"/>`;
  }
  const t = (y, s) => `<text x="2" y="${y}" fill="#8b98a6" font-size="9" font-family="ui-monospace,monospace">${s}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="calchart"><line x1="0" x2="${W}" y1="${mid1}" y2="${mid1}" stroke="#2a3442"/><line x1="0" x2="${W}" y1="${mid2}" y2="${mid2}" stroke="#2a3442"/>${bars}${t(9, `Entfernung ±${n1(maxR * 1000)} mm`)}${t(55, `Elevation ±${n1(maxE * 180 / Math.PI * 1000, 0)} m°`)}</svg>`;
}
