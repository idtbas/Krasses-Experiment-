// Symbole als Inline-SVG (24×24, Strichstärke über CSS)
const P = {
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
  blocks: '<rect x="3.5" y="4" width="11" height="6" rx="1.6"/><rect x="7" y="13" width="13.5" height="6" rx="1.6"/><path d="M6 10v3"/>',
  code: '<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/><path d="M13.5 5l-3 14"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 4.8 5.2l-8.6 8.6a2.1 2.1 0 0 1-3-3l8.6-8.6a4 4 0 0 0-1.8-2.2z"/><circle cx="17" cy="7" r=".1"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.5"/><circle cx="12" cy="16.8" r=".6" fill="currentColor"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14"/><path d="M8 12.5l-1.4-1.4a1.6 1.6 0 0 0-2.3 2.2L8 17.5c1.3 1.6 3 2.5 5 2.5h.5a4.5 4.5 0 0 0 4.5-4.5V12"/>',
  pencil: '<path d="M15 5l4 4L8.5 19.5 4 20l.5-4.5z"/><path d="M13 7l4 4"/>',
  camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2V16h5v0c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="5"/>',
  folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  speed: '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 14l4-5"/><circle cx="12" cy="14.5" r="1.3" fill="currentColor"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4"/>',
  sensor: '<path d="M5 12a7 7 0 0 1 7-7M8.5 12A3.5 3.5 0 0 1 12 8.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M19 12a7 7 0 0 1-7 7M15.5 12a3.5 3.5 0 0 1-3.5 3.5"/>',
  battery: '<rect x="3" y="7.5" width="16" height="9" rx="2"/><path d="M21 10.5v3"/><rect x="5.5" y="10" width="8" height="4" rx=".8" fill="currentColor" stroke="none"/>',
  follow: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
  undo: '<path d="M8 8H4V4"/><path d="M4.5 8.3A8 8 0 1 1 6 17"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M8 11h6"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  // Robotertypen
  humanoid: '<rect x="9" y="2.5" width="6" height="5" rx="1.6"/><path d="M10.5 5h.01M13.5 5h.01"/><rect x="7.5" y="8.5" width="9" height="7" rx="2"/><path d="M7.5 10l-3 4M16.5 10l3 4M10 15.5V21M14 15.5V21"/>',
  arm: '<path d="M4 21h9"/><rect x="5.5" y="17.5" width="6" height="3.5" rx="1"/><path d="M8.5 17.5V14l5-6.5 4 3"/><circle cx="8.5" cy="14" r="1.6"/><circle cx="13.5" cy="7.5" r="1.6"/><path d="M17.5 10.5l2.5-1M17.5 10.5l1 2.5"/>',
  rover: '<rect x="4" y="9" width="16" height="7" rx="2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M14 9V5.5h3M17 5.5h.01"/>',
  // Gegenstände
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  ball: '<circle cx="12" cy="12" r="8"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/>',
  cylinder: '<ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v12c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6"/>',
  table: '<path d="M3 9h18"/><path d="M5 9v11M19 9v11M3 9l2-3h14l2 3"/>',
  wall: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 12h18M9 6v6M15 12v6"/>',
  ramp: '<path d="M3 19h18V8z"/>',
  zone: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.5"/>',
  bin: '<path d="M4 8h16l-1.5 12h-13z"/><path d="M3 8h18"/>',
  line: '<path d="M3 17c4 0 4-10 9-10s5 10 9 10"/>',
  conveyor: '<rect x="2.5" y="9" width="19" height="6" rx="3"/><circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/><path d="M5 19h14"/>',
  button: '<rect x="4" y="13" width="16" height="6" rx="1.5"/><path d="M8 13v-2a4 4 0 0 1 8 0v2"/>',
  lamp: '<circle cx="12" cy="8" r="4.5"/><path d="M12 12.5V21M8 21h8"/>',
  barrier: '<path d="M5 4v16M19 4v16"/><path d="M5 10h14" stroke-dasharray="2 2"/>',
  dispenser: '<path d="M7 3h10v7l-2 3H9l-2-3z"/><path d="M10 17h4v4h-4z"/>',
  robotAdd: '<rect x="5" y="7" width="12" height="10" rx="3"/><path d="M9 11h.01M13 11h.01M11 4v3"/><path d="M19 15v6M16 18h6"/>',
  sonar: '<circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><rect x="3" y="7.5" width="18" height="9" rx="2"/>',
  color: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
  touch: '<path d="M4 16h16M7 16V9a5 5 0 0 1 10 0v7"/>',
};

export function icon(name, cls = '') {
  const body = P[name] || P.help;
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
export function iconEl(name, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = icon(name, cls);
  return t.content.firstChild;
}

export const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="#ff7a1a"/><path d="M16 2.5l11.7 6.75v6.75L16 16z" fill="#ffa25c"/><circle cx="16" cy="16" r="5.2" fill="#1b0d00"/><circle cx="16" cy="16" r="2.2" fill="#ffd2b0"/><path d="M16 2.5v8.3M27.7 22.75l-7.2-4.15M4.3 22.75l7.2-4.15" stroke="#1b0d00" stroke-width="2.2"/></svg>`;
