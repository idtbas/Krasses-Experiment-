/* VistoOS · ui/icons.js — Symbole (24 × 24, Linienstärke 2, runde Enden)
 *
 *  V.icon('timer')            → SVG-Markup (String)
 *  V.iconEl('timer', {size})  → SVG-Element
 *  V.icons                    → alle Namen
 */
'use strict';
(function () {
  const V = window.V;
  // Jeder Eintrag: innerer SVG-Inhalt. 'F:' am Anfang = gefüllt statt Linie.
  const P = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.6M9.5 2.8h5M12 2.8V6"/><path d="M18.4 6.6l1.3-1.3"/>',
    stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5l3-3M10 2.8h4M12 2.8V6"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.2V13l2.4 1.6M4.2 4.6l3-2.2M19.8 4.6l-3-2.2M6.5 19.5L5 21M17.5 19.5L19 21"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.7 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.7-3.8-9S9.4 5.6 12 3z"/>',
    weather: '<path d="M8.5 6.2a4 4 0 0 1 6.7 1.6"/><path d="M5.5 4.2l.9.9M8.6 2.6v1.2M2.8 8.2H4"/><path d="M7.5 19.5h9.8a3.7 3.7 0 0 0 .4-7.4 5.2 5.2 0 0 0-10-1A4.2 4.2 0 0 0 7.5 19.5z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.4 8.4 0 1 0 10.6 10.6z"/>',
    cloud: '<path d="M7 19h10.5a4 4 0 0 0 .5-8 5.6 5.6 0 0 0-10.8-1.2A4.6 4.6 0 0 0 7 19z"/>',
    rain: '<path d="M7 15.5h10.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.7-1A4.1 4.1 0 0 0 7 15.5z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>',
    snow: '<path d="M7 14.5h10.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.7-1A4.1 4.1 0 0 0 7 14.5z"/><path d="M8 18.2v.1M12 19.8v.1M16 18.2v.1M10 21.4v.1M14 21.4v.1"/>',
    storm: '<path d="M7 14.5h10.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.7-1A4.1 4.1 0 0 0 7 14.5z"/><path d="M12.5 15.5l-2 3.4h3l-2 3.2"/>',
    fog: '<path d="M4 9h16M3 13h18M5 17h14M8 21h8"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7"/>',
    drop: '<path d="M12 3.2s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
    thermo: '<path d="M14 14.3V5a2 2 0 1 0-4 0v9.3a4 4 0 1 0 4 0z"/><path d="M12 17.6v-6"/>',
    music: '<path d="M9 18.5V5.6l11-2.1v12.6"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="16.1" r="2.5"/>',
    home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.8 9.4V20h12.4V9.4"/><path d="M10 20v-5.5h4V20"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.1V16h5.2v-.1c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
    list: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.6l1.3 1.2 2.2-2.6M3.8 12.1l1.3 1.2 2.2-2.6"/><circle cx="5.5" cy="17.5" r="1.4"/>',
    focus: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    breathe: '<path d="M12 20c-4.5 0-7.5-3.2-7.5-7.5 2.6 0 5 1 6.3 3"/><path d="M12 20c4.5 0 7.5-3.2 7.5-7.5-2.6 0-5 1-6.3 3"/><path d="M12 19.5c-2.2-2-3.2-4.4-3.2-7.2S10 6.4 12 4.2c2 2.2 3.2 5.3 3.2 8.1S14.2 17.5 12 19.5z"/>',
    photos: '<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><path d="M3.5 16.5l5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.8" cy="9" r="1.6"/>',
    calculator: '<rect x="5" y="2.8" width="14" height="18.4" rx="3"/><path d="M8.5 7h7M8.5 12h.1M12 12h.1M15.5 12h.1M8.5 15.5h.1M12 15.5h.1M15.5 15.5v2.5M8.5 18.6h.1M12 18.6h.1"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>',
    visto: '<circle cx="12" cy="12" r="8.6"/><path d="M9.4 10.2v3.2M14.6 10.2v3.2"/>',
    mic: '<rect x="9" y="2.8" width="6" height="11.6" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.7"/>',
    micoff: '<path d="M15 9.5V5.8a3 3 0 0 0-5.7-1.3M9 9v2.4a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.2 5.4M18.5 11a6.4 6.4 0 0 1-.5 2.5M12 17.5v3.7M3.5 3.5l17 17"/>',
    send: '<path d="M12 19V5M5.8 11.2L12 5l6.2 6.2"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6 10h.1M9.3 10h.1M12.6 10h.1M15.9 10h.1M18 10h.1M7.5 14h9"/>',
    play: 'F:<path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.6-6.8a1 1 0 0 0 0-1.8L9.6 4.3C8.9 3.9 8 4.4 8 5.2z"/>',
    pause: 'F:<rect x="6.2" y="4.5" width="4" height="15" rx="1.4"/><rect x="13.8" y="4.5" width="4" height="15" rx="1.4"/>',
    stop: 'F:<rect x="5.5" y="5.5" width="13" height="13" rx="2.6"/>',
    next: 'F:<path d="M4 6.2v11.6c0 .8.9 1.2 1.5.8l8.5-5.8a1 1 0 0 0 0-1.6L5.5 5.4C4.9 5 4 5.4 4 6.2z"/><rect x="16" y="5" width="3.4" height="14" rx="1.2"/>',
    prev: 'F:<path d="M20 6.2v11.6c0 .8-.9 1.2-1.5.8L10 12.8a1 1 0 0 1 0-1.6l8.5-5.8c.6-.4 1.5 0 1.5.8z"/><rect x="4.6" y="5" width="3.4" height="14" rx="1.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    down: '<path d="M5 9l7 7 7-7"/>',
    up: '<path d="M5 15l7-7 7 7"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v4.2h4.2"/>',
    flag: '<path d="M5 21V4M5 4.5h11l-2 3.8 2 3.8H5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 21h4"/>',
    belloff: '<path d="M8.4 5.6A6 6 0 0 1 18 11v4M6 11v5.5l-1.6 2h12.1M10 21h4M3.5 3.5l17 17"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.5a9.2 9.2 0 0 1 12.4 0M9.2 16a4.4 4.4 0 0 1 5.6 0"/><circle cx="12" cy="19.2" r=".6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.6"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    power: '<path d="M12 3v8.5"/><path d="M7 5.8a8 8 0 1 0 10 0"/>',
    brightness: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
    volume: '<path d="M4 9.5v5h3.5L12.5 19V5L7.5 9.5z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2"/>',
    mute: '<path d="M4 9.5v5h3.5L12.5 19V5L7.5 9.5z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6.5 6.5l.9 13.3c.1 1 .9 1.7 1.9 1.7h5.4c1 0 1.8-.7 1.9-1.7l.9-13.3"/>',
    location: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    face: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2"/><circle cx="12" cy="12" r="5.6" stroke-dasharray="1.2 2.4"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.8-1.3-3 0-1 .8-1.8 1.8-1.8h2.4A4.3 4.3 0 0 0 21 10.2C21 6.2 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10.5" cy="7.2" r="1.2"/><circle cx="15.4" cy="7.6" r="1.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    heart: '<path d="M12 20s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.4C20 15.2 12 20 12 20z"/>',
    sofa: '<path d="M4.5 11V8.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3V11"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4.5H3z"/><path d="M5 17.5V20M19 17.5V20"/>',
    bed: '<path d="M3 19v-9M3 15h18v4M21 15v-2.5a3 3 0 0 0-3-3h-7v5.5"/><circle cx="7" cy="12" r="1.8"/>',
    kitchen: '<path d="M6 3v7.5a2 2 0 0 0 4 0V3M8 3v18M16.5 21V3c-2 1.2-3 3.8-3 7.3h3"/>',
    desk: '<path d="M3 9h18M5 9v11M19 9v11M15 9v5h4"/><path d="M8.5 9V5.5h5V9"/>',
    fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2c0-4.4.8-7 3.3-7 2 0 2.5 2 1.4 3.6-1 1.5-2.9 2.6-4.7 3.4zM13.8 12c4.4 0 7 .8 7 3.3 0 2-2 2.5-3.6 1.4-1.5-1-2.6-2.9-3.4-4.7zM12 13.8c0 4.4-.8 7-3.3 7-2 0-2.5-2-1.4-3.6 1-1.5 2.9-2.6 4.7-3.4zM10.2 12c-4.4 0-7-.8-7-3.3 0-2 2-2.5 3.6-1.4 1.5 1 2.6 2.9 3.4 4.7z"/>',
    plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4"/>',
    blinds: '<path d="M4 3.5h16M5 3.5V16M19 3.5V16M5 7.5h14M5 11.5h14M5 15.5h14M12 16v4"/><circle cx="12" cy="20.6" r=".8"/>',
    shuffle: '<path d="M3.5 7h3.6c2 0 3.4 1 4.4 2.6l1.8 3c1 1.6 2.4 2.4 4.3 2.4H20.5M3.5 17h3.6c1.6 0 2.8-.6 3.7-1.7M14 8.7c.9-1.1 2.1-1.7 3.6-1.7h2.9M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>',
    repeat: '<path d="M4 11.5V10a4 4 0 0 1 4-4h12M17 3l3 3-3 3M20 12.5V14a4 4 0 0 1-4 4H4M7 21l-3-3 3-3"/>',
    heartbeat: '<path d="M3 12h4l2-4.5 3.5 9L15 9l1.5 3H21"/>',
    note: '<path d="M6 3.5h9l4 4V20.5H6z"/><path d="M14.5 3.5V8h4.5M9 12.5h7M9 16h5"/>',
    sprout: '<path d="M12 21v-8.5"/><path d="M12 12.5C12 8.4 9.3 6 5 6c0 4.2 2.7 6.5 7 6.5zM12 10.5c0-3.6 2.5-6.5 7-6.5 0 3.8-2.6 6.5-7 6.5z"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    dots: 'F:<circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    coffee: '<path d="M5 9h11v5.5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5c-.6.9-.6 1.9 0 2.8M12 3.5c-.6.9-.6 1.9 0 2.8"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    sunrise: '<path d="M5 17a7 7 0 0 1 14 0M2.5 20.5h19M12 3v5M9.5 5.5L12 3l2.5 2.5M4 10.5l1.5 1.2M20 10.5l-1.5 1.2"/>',
    battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.6"/><path d="M21.5 10.5v3"/><rect x="5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>',
  };

  function wrap(name, extra = '') {
    let body = P[name] || P.info;
    let filled = false;
    if (body.startsWith('F:')) { filled = true; body = body.slice(2); }
    const attr = filled
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg viewBox="0 0 24 24" ${attr} aria-hidden="true" ${extra}>${body}</svg>`;
  }

  V.icons = Object.keys(P);
  V.icon = (name, extra) => wrap(name, extra);
  V.iconEl = (name, o = {}) => {
    const el = V.util.frag(wrap(name));
    if (o.size) { el.style.width = o.size; el.style.height = o.size; }
    if (o.class) el.setAttribute('class', o.class);
    if (o.stroke) el.setAttribute('stroke-width', o.stroke);
    return el;
  };
  V.icon.add = (name, body) => { P[name] = body; V.icons = Object.keys(P); };
})();
