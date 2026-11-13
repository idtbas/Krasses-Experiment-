// Hersteller-Oberflächen des Feldrechners: Je Marke eine eigene Software-Optik (Farben, Schrift, Formen,
// Viewer-Hintergrund, Zustandswörter) und eine eigene Boot-Animation (bootfx.js).
// Eigene Interpretationen des Charakters der Marken – Logos sind bewusst nicht nachgebaut, die Wortmarken sind reiner Text.

const F = {
  sf: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, Roboto, sans-serif",
  helv: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  segoe: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  avenir: "'Avenir Next', Avenir, 'Segoe UI', 'Helvetica Neue', sans-serif",
  din: "'DIN Alternate', 'Bahnschrift', 'DIN', 'Arial Narrow', 'Helvetica Neue', sans-serif",
  dinc: "'DIN Condensed', 'Bahnschrift Condensed', 'Arial Narrow', 'Helvetica Neue', sans-serif",
  futura: "Futura, 'Century Gothic', 'Avenir Next', sans-serif",
  gill: "'Gill Sans', 'Gill Sans MT', 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
  courier: "'Courier New', Courier, 'Liberation Mono', monospace",
};
export const FONTS = F;

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;

// Grundpaletten (dunkel / hell); jede Marke überschreibt, was sie prägt
const DARK = {
  '--f-bg': '#070a0e', '--f-bar': 'linear-gradient(180deg,#0c1117,#080b10)', '--f-bar-ink': '#8794a2', '--f-bar-hi': '#c9d3dd',
  '--f-rail': '#090d12', '--f-rail-ink': '#7b8896', '--f-grp': '#46525f', '--f-head': '#0a0e14', '--f-side': '#0a0e13',
  '--f-sidehead': 'linear-gradient(180deg,#0e141b,#0a0e13)', '--f-title': '#e9eff5',
  '--f-card': 'linear-gradient(180deg,#0f151d,#0c1118)', '--f-card-line': '#1a2330', '--f-cell': '#0a0f15', '--f-cell-line': '#161e29', '--f-well': '#0a0f15',
  '--f-line': '#141b24', '--f-ov': 'rgba(6,9,13,.66)', '--f-ov-line': 'rgba(255,255,255,.06)', '--f-ov-ink': '#8c98a5', '--f-ov-hi': '#dbe2e9',
  '--f-chip': '#111821', '--f-chip-line': '#1d2733', '--f-rad': '7px', '--f-rad2': '12px',
  '--panel': '#0e1217', '--panel2': '#141a21', '--panel3': '#1b222b', '--line': '#222a34', '--line2': '#2e3844',
  '--text': '#dbe2e9', '--muted': '#8c98a5', '--dim': '#5d6874', '--ok': '#3fcf73', '--warn': '#f2b23a', '--bad': '#ff5a5a',
};
const LIGHT = {
  '--f-bg': '#eceef1', '--f-bar': '#f7f8fa', '--f-bar-ink': '#56606b', '--f-bar-hi': '#1d232a',
  '--f-rail': '#f4f5f7', '--f-rail-ink': '#5d6773', '--f-grp': '#9aa3ad', '--f-head': '#fafbfc', '--f-side': '#f7f8fa',
  '--f-sidehead': '#ffffff', '--f-title': '#15191e',
  '--f-card': '#ffffff', '--f-card-line': '#dde1e6', '--f-cell': '#f3f5f7', '--f-cell-line': '#e3e7eb', '--f-well': '#f3f5f7',
  '--f-line': '#dde1e6', '--f-ov': 'rgba(250,251,252,.88)', '--f-ov-line': 'rgba(0,0,0,.08)', '--f-ov-ink': '#4f5964', '--f-ov-hi': '#1d232a',
  '--f-chip': '#eef1f4', '--f-chip-line': '#d8dde3', '--f-rad': '6px', '--f-rad2': '10px',
  '--panel': '#ffffff', '--panel2': '#f1f3f5', '--panel3': '#e6e9ed', '--line': '#dde1e6', '--line2': '#c9cfd6',
  '--text': '#1d232a', '--muted': '#5b6570', '--dim': '#8a939d', '--ok': '#1f9d55', '--warn': '#c77d00', '--bad': '#d93636',
};

function theme(base, acc, o = {}) {
  const light = base === LIGHT;
  const v = { ...base, '--accent': acc, '--accent-d': mix(acc, light ? '#000000' : '#000000', light ? 0.12 : 0.38), '--accent-bg': alpha(acc, light ? 0.1 : 0.13), '--f-acc-ink': light ? '#ffffff' : '#05080b', '--sans': F.sf, '--mono': F.mono, ...o };
  return v;
}

// Zustandswörter wie in der jeweiligen Gerätesoftware (Phase der Unit → Text)
const ST = {
  de: { aus: 'aus', boot: 'bootet', anlauf: 'Motoranlauf', misst: 'misst', bereit: 'Bereitschaft' },
  velodyne: { aus: 'Off', boot: 'Booting', anlauf: 'Motor spin-up', misst: 'Laser On', bereit: 'Laser Off' },
  ouster: { aus: 'OFF', boot: 'INITIALIZING', anlauf: 'INITIALIZING', misst: 'RUNNING', bereit: 'STANDBY' },
  hesai: { aus: 'Off', boot: 'Initializing', anlauf: 'Spin-up', misst: 'Working', bereit: 'Standby' },
  livox: { aus: 'Off', boot: 'Initializing', anlauf: 'Initializing', misst: 'Normal', bereit: 'Standby' },
  robosense: { aus: 'Off', boot: 'Init', anlauf: 'Motor', misst: 'Running', bereit: 'Standby' },
  sick: { aus: 'aus', boot: 'Initialisierung', anlauf: 'Motor startet', misst: 'Messung', bereit: 'Bereit' },
  hokuyo: { aus: 'OFF', boot: 'INIT', anlauf: 'MOTOR', misst: 'MD · Messung', bereit: 'QT · Laser aus' },
  slamtec: { aus: 'Off', boot: 'Health check', anlauf: 'Motor', misst: 'Scanning', bereit: 'Stopped' },
  leica: { aus: 'aus', boot: 'Selbsttest', anlauf: 'Anlauf', misst: 'scannt', bereit: 'bereit' },
};

// view: Hintergrund des 3D-Viewers oben/unten · word: Wortmarke (Text) · skin: Aufbau der Oberfläche
export const BRANDS = {
  ECHO: { key: 'echo', skin: 'echo', word: '<b>ECHO</b><i>Field</i>', view: ['#14202e', '#030405'], st: ST.de, vars: theme(DARK, '#35d0ff') },
  Velodyne: {
    key: 'velodyne', skin: 'desk', light: true, word: '<b>VELODYNE</b><i>LIDAR</i>', view: ['#000000', '#000000'], st: ST.velodyne,
    vars: theme(LIGHT, '#1f7bd8', { '--sans': F.segoe, '--f-bg': '#d9dadc', '--f-bar': 'linear-gradient(180deg,#f0f0f0,#dcdcdc)', '--f-rail': '#e6e6e6', '--f-head': 'linear-gradient(180deg,#fbfbfb,#e4e4e4)', '--f-side': '#efefef', '--f-sidehead': 'linear-gradient(180deg,#f7f7f7,#e1e1e1)', '--panel': '#fbfbfb', '--panel2': '#efefef', '--f-btn': 'linear-gradient(180deg,#fdfdfd,#e6e6e6)', '--panel3': '#e1e1e1', '--line': '#c6c6c6', '--line2': '#ababab', '--f-line': '#bdbdbd', '--f-rad': '3px', '--f-rad2': '3px', '--f-card': '#f9f9f9', '--f-card-line': '#c2c2c2', '--f-cell': '#ffffff', '--f-cell-line': '#d0d0d0' }),
  },
  Ouster: {
    key: 'ouster', skin: 'studio', word: '<b>OUSTER</b>', view: ['#0b0b0d', '#000000'], st: ST.ouster,
    vars: theme(DARK, '#d9ff4a', { '--sans': F.helv, '--f-bg': '#000000', '--f-bar': '#000000', '--f-rail': '#0c0c0e', '--f-head': '#0c0c0e', '--f-side': '#0c0c0e', '--f-sidehead': '#0c0c0e', '--panel': '#141416', '--panel2': '#1a1a1d', '--panel3': '#232327', '--line': '#262629', '--line2': '#333338', '--f-line': '#1e1e21', '--text': '#f2f2f3', '--muted': '#9a9aa2', '--dim': '#626269', '--f-rail-ink': '#8b8b93', '--f-grp': '#4a4a50', '--f-card': '#111113', '--f-card-line': '#232326', '--f-cell': '#0a0a0b', '--f-cell-line': '#1d1d20', '--f-well': '#050506', '--f-chip': '#141416', '--f-chip-line': '#29292d', '--f-rad': '999px', '--f-rad2': '18px', '--f-title': '#ffffff' }),
  },
  Hesai: {
    key: 'hesai', skin: 'studio', word: '<b>HESAI</b>', view: ['#0d1838', '#02040b'], st: ST.hesai,
    vars: theme(DARK, '#4d7cff', { '--sans': F.avenir, '--f-bg': '#050a1a', '--f-bar': 'linear-gradient(90deg,#08112a,#0b0f2e 60%,#160d33)', '--f-rail': '#0a1330', '--f-head': '#0a1330', '--f-side': '#0a1330', '--f-sidehead': 'linear-gradient(135deg,#111c44,#0a1330)', '--panel': '#0e1a3d', '--panel2': '#13214a', '--panel3': '#1a2a5a', '--line': '#1d2c5a', '--line2': '#2a3b70', '--f-line': '#16224a', '--text': '#e4e9ff', '--muted': '#93a0cc', '--dim': '#5e6a99', '--f-rail-ink': '#8794c4', '--f-grp': '#46507a', '--f-card': 'linear-gradient(160deg,#111d47,#0b1434)', '--f-card-line': '#1f2d60', '--f-cell': '#08102b', '--f-cell-line': '#18245a', '--f-well': '#060c22', '--f-chip': '#0e1a3d', '--f-chip-line': '#22306a', '--f-rad': '10px', '--f-rad2': '16px', '--f-acc-ink': '#ffffff' }),
  },
  Livox: {
    key: 'livox', skin: 'studio', word: '<b>LIVOX</b>', view: ['#1a1c20', '#050506'], st: ST.livox,
    vars: theme(DARK, '#f4f5f6', { '--sans': F.sf, '--f-bg': '#0b0c0e', '--f-bar': '#0b0c0e', '--f-rail': '#141518', '--f-head': '#141518', '--f-side': '#141518', '--f-sidehead': '#141518', '--panel': '#1b1d21', '--panel2': '#22252a', '--panel3': '#2b2e34', '--line': '#2a2d32', '--line2': '#3a3e45', '--f-line': '#212328', '--text': '#eceef0', '--muted': '#9a9fa6', '--dim': '#61666d', '--accent-bg': 'rgba(47,213,197,.12)', '--accent-d': '#2fd5c5', '--f-rail-ink': '#8f949b', '--f-grp': '#4d5157', '--f-card': '#191b1f', '--f-card-line': '#2a2d32', '--f-cell': '#111215', '--f-cell-line': '#25282d', '--f-well': '#0e0f11', '--f-chip': '#1b1d21', '--f-chip-line': '#2e3136', '--f-rad': '6px', '--f-rad2': '10px', '--f-acc-ink': '#0b0c0e', '--f-hi2': '#2fd5c5' }),
  },
  RoboSense: {
    key: 'robosense', skin: 'desk', word: '<b>Robo</b><i>Sense</i>', view: ['#16181c', '#060708'], st: ST.robosense,
    vars: theme(DARK, '#ff3347', { '--sans': F.segoe, '--f-bg': '#101114', '--f-bar': 'linear-gradient(180deg,#22242a,#191b1f)', '--f-rail': '#1a1c20', '--f-head': 'linear-gradient(180deg,#25272d,#1c1e22)', '--f-side': '#1a1c20', '--f-sidehead': 'linear-gradient(180deg,#2a2c33,#202227)', '--panel': '#202227', '--panel2': '#282a30', '--f-btn': 'linear-gradient(180deg,#2e3137,#24262b)', '--panel3': '#30333a', '--line': '#2f3238', '--line2': '#41454d', '--f-line': '#2a2c31', '--f-card': '#1d1f24', '--f-card-line': '#33363d', '--f-cell': '#16171a', '--f-cell-line': '#2c2f35', '--f-well': '#121316', '--f-rad': '3px', '--f-rad2': '4px', '--f-acc-ink': '#ffffff' }),
  },
  Leica: {
    key: 'leica', skin: 'field', light: true, word: '<b>LEICA</b><i>GEOSYSTEMS</i>', view: ['#3b4048', '#121417'], st: ST.leica,
    vars: theme(LIGHT, '#e30613', { '--sans': F.helv, '--f-bg': '#f4f4f3', '--f-bar': '#ffffff', '--f-rail': '#ffffff', '--f-head': '#ffffff', '--f-side': '#fafaf9', '--f-sidehead': '#ffffff', '--panel': '#ffffff', '--panel2': '#f4f4f3', '--panel3': '#e9e9e7', '--line': '#e4e4e2', '--line2': '#cfcfcc', '--f-line': '#e6e6e4', '--text': '#1c1c1c', '--muted': '#666664', '--dim': '#9a9a97', '--f-rad': '4px', '--f-rad2': '6px', '--f-card': '#ffffff', '--f-card-line': '#e2e2e0', '--f-cell': '#f7f7f6', '--f-cell-line': '#e6e6e4' }),
  },
  FARO: {
    key: 'faro', skin: 'field', word: '<b>FARO</b>', view: ['#0f2440', '#030912'], st: ST.de,
    vars: theme(DARK, '#1aa3ff', { '--sans': F.helv, '--f-bg': '#06111f', '--f-bar': '#081628', '--f-rail': '#0b1b31', '--f-head': '#0b1b31', '--f-side': '#0a182c', '--f-sidehead': 'linear-gradient(180deg,#10243f,#0a182c)', '--panel': '#0f2139', '--panel2': '#132846', '--panel3': '#183155', '--line': '#1b3252', '--line2': '#254268', '--f-line': '#132a47', '--text': '#e6f0fa', '--muted': '#8ea6c2', '--dim': '#5a7290', '--f-rail-ink': '#86a0be', '--f-grp': '#3f5878', '--f-card': '#0d1d33', '--f-card-line': '#1c3555', '--f-cell': '#081526', '--f-cell-line': '#183051', '--f-well': '#06111f', '--f-chip': '#0f2139', '--f-chip-line': '#22406a', '--f-rad': '10px', '--f-rad2': '12px', '--f-acc-ink': '#ffffff' }),
  },
  RIEGL: {
    key: 'riegl', skin: 'field', word: '<b>RIEGL</b>', view: ['#101a2e', '#03060c'], st: ST.de,
    vars: theme(DARK, '#ffa024', { '--sans': F.segoe, '--mono': F.mono, '--f-bg': '#070c17', '--f-bar': '#0a1222', '--f-rail': '#0c1528', '--f-head': '#0c1528', '--f-side': '#0b1324', '--f-sidehead': 'linear-gradient(180deg,#121e36,#0b1324)', '--panel': '#101b31', '--panel2': '#15223c', '--panel3': '#1b2b4a', '--line': '#1c2a46', '--line2': '#28395c', '--f-line': '#16223a', '--text': '#e7ecf5', '--muted': '#91a0bb', '--dim': '#5c6a86', '--f-rail-ink': '#8a99b5', '--f-grp': '#435170', '--f-card': '#0e182c', '--f-card-line': '#1f2e4c', '--f-cell': '#091121', '--f-cell-line': '#1a2742', '--f-well': '#050a14', '--f-chip': '#101b31', '--f-chip-line': '#24365a', '--f-rad': '4px', '--f-rad2': '6px' }),
  },
  Trimble: {
    key: 'trimble', skin: 'field', word: '<b>TRIMBLE</b>', view: ['#262b31', '#0a0c0e'], st: ST.de,
    vars: theme(DARK, '#ffd23f', { '--sans': F.helv, '--f-bg': '#15181c', '--f-bar': '#1b1f24', '--f-rail': '#1e2228', '--f-head': '#22272d', '--f-side': '#1e2228', '--f-sidehead': '#262b32', '--panel': '#262b32', '--panel2': '#2c323a', '--panel3': '#353c45', '--line': '#343a43', '--line2': '#46505b', '--f-line': '#2d333b', '--text': '#eef1f4', '--muted': '#a3acb7', '--dim': '#6c7580', '--f-rail-ink': '#9aa3ae', '--f-grp': '#59626d', '--f-card': '#232830', '--f-card-line': '#38404a', '--f-cell': '#1a1e23', '--f-cell-line': '#323942', '--f-well': '#14171b', '--f-chip': '#262b32', '--f-chip-line': '#3b434d', '--f-rad': '8px', '--f-rad2': '10px', '--f-acc-ink': '#15181c' }),
  },
  'Z+F': {
    key: 'zf', skin: 'field', word: '<b>Z+F</b><i>IMAGER</i>', view: ['#0a0a0a', '#000000'], st: ST.de,
    vars: theme(DARK, '#ff2a1a', { '--sans': F.din, '--f-bg': '#000000', '--f-bar': '#000000', '--f-rail': '#0b0b0b', '--f-head': '#0b0b0b', '--f-side': '#0b0b0b', '--f-sidehead': '#0b0b0b', '--panel': '#121212', '--panel2': '#171717', '--panel3': '#202020', '--line': '#262626', '--line2': '#363636', '--f-line': '#1f1f1f', '--text': '#f2f2f2', '--muted': '#9b9b9b', '--dim': '#5f5f5f', '--f-rail-ink': '#8f8f8f', '--f-grp': '#4a4a4a', '--f-card': '#0e0e0e', '--f-card-line': '#262626', '--f-cell': '#080808', '--f-cell-line': '#202020', '--f-well': '#050505', '--f-chip': '#121212', '--f-chip-line': '#2a2a2a', '--f-rad': '0px', '--f-rad2': '0px', '--f-acc-ink': '#ffffff', '--f-title': '#ffffff' }),
  },
  SICK: {
    key: 'sick', skin: 'desk', light: true, word: '<b>SICK</b><i>Sensor Intelligence.</i>', view: ['#f4f6f8', '#d9dfe5'], st: ST.sick,
    vars: theme(LIGHT, '#007cc1', { '--sans': F.helv, '--f-bg': '#e8ecf0', '--f-bar': '#007cc1', '--f-bar-ink': 'rgba(255,255,255,.78)', '--f-bar-hi': '#ffffff', '--f-rail': '#f5f7f9', '--f-head': '#ffffff', '--f-side': '#ffffff', '--f-sidehead': '#e9f2f9', '--panel': '#ffffff', '--panel2': '#f2f5f8', '--panel3': '#e4eaf0', '--line': '#d5dde5', '--line2': '#b8c4d0', '--f-line': '#d5dde5', '--f-rad': '2px', '--f-rad2': '2px', '--f-card': '#ffffff', '--f-card-line': '#cdd7e1', '--f-cell': '#f5f8fb', '--f-cell-line': '#dde4eb', '--f-chip': 'rgba(255,255,255,.14)', '--f-chip-line': 'rgba(255,255,255,.28)', '--f-ov': 'rgba(255,255,255,.9)' }),
  },
  Hokuyo: {
    key: 'hokuyo', skin: 'desk', light: true, word: '<b>HOKUYO</b>', view: ['#1b1f24', '#0b0d10'], st: ST.hokuyo,
    vars: theme(LIGHT, '#e8590c', { '--sans': F.helv, '--mono': F.courier, '--f-bg': '#e9e4d8', '--f-bar': '#1f2a44', '--f-bar-ink': '#b9c2d6', '--f-bar-hi': '#ffffff', '--f-rail': '#f4f0e6', '--f-head': '#fbf8f1', '--f-side': '#f7f3ea', '--f-sidehead': '#efe9dc', '--panel': '#fffdf8', '--panel2': '#f6f1e6', '--panel3': '#ebe4d5', '--line': '#d9d1bf', '--line2': '#c2b8a2', '--f-line': '#d9d1bf', '--text': '#1f2430', '--muted': '#5f5a4e', '--dim': '#958d7c', '--f-rad': '2px', '--f-rad2': '3px', '--f-card': '#fffdf8', '--f-card-line': '#d4cbb7', '--f-cell': '#f8f4eb', '--f-cell-line': '#e0d8c6', '--f-chip': 'rgba(255,255,255,.08)', '--f-chip-line': 'rgba(255,255,255,.18)', '--f-grp': '#a39a86' }),
  },
  Slamtec: {
    key: 'slamtec', skin: 'studio', word: '<b>SLAMTEC</b>', view: ['#0b1430', '#03060f'], st: ST.slamtec,
    vars: theme(DARK, '#ff6b4a', { '--sans': F.avenir, '--f-bg': '#060b1d', '--f-bar': '#060b1d', '--f-rail': '#0c1430', '--f-head': '#0c1430', '--f-side': '#0c1430', '--f-sidehead': '#0f1838', '--panel': '#111b3d', '--panel2': '#162248', '--panel3': '#1d2b57', '--line': '#1f2c55', '--line2': '#2c3c6e', '--f-line': '#18234a', '--text': '#eef1ff', '--muted': '#9aa3c9', '--dim': '#626c96', '--f-rail-ink': '#8f99c2', '--f-grp': '#46507a', '--f-card': '#0f1838', '--f-card-line': '#22305e', '--f-cell': '#0a1129', '--f-cell-line': '#1c2850', '--f-well': '#070c20', '--f-chip': '#111b3d', '--f-chip-line': '#26346a', '--f-rad': '12px', '--f-rad2': '18px', '--f-acc-ink': '#ffffff' }),
  },
  Unitree: {
    key: 'unitree', skin: 'studio', word: '<b>UNITREE</b>', view: ['#141414', '#000000'], st: ST.de,
    vars: theme(DARK, '#ff8a2a', { '--sans': F.futura, '--f-bg': '#000000', '--f-bar': '#000000', '--f-rail': '#101010', '--f-head': '#101010', '--f-side': '#101010', '--f-sidehead': '#141414', '--panel': '#161616', '--panel2': '#1c1c1c', '--panel3': '#262626', '--line': '#282828', '--line2': '#3a3a3a', '--f-line': '#202020', '--text': '#f5f5f5', '--muted': '#a0a0a0', '--dim': '#666666', '--f-rail-ink': '#909090', '--f-grp': '#4a4a4a', '--f-card': '#121212', '--f-card-line': '#262626', '--f-cell': '#0a0a0a', '--f-cell-line': '#222222', '--f-well': '#070707', '--f-chip': '#161616', '--f-chip-line': '#2c2c2c', '--f-rad': '4px', '--f-rad2': '6px' }),
  },
  Luminar: {
    key: 'luminar', skin: 'studio', word: '<b>LUMINAR</b>', view: ['#120a18', '#020103'], st: ST.de,
    vars: theme(DARK, '#ff4f8b', { '--sans': F.avenir, '--f-bg': '#050307', '--f-bar': '#050307', '--f-rail': '#0e0912', '--f-head': '#0e0912', '--f-side': '#0e0912', '--f-sidehead': 'linear-gradient(135deg,#1c0f24,#0e0912)', '--panel': '#160e1c', '--panel2': '#1d1325', '--panel3': '#271a31', '--line': '#2a1d33', '--line2': '#3b2a47', '--f-line': '#201628', '--text': '#f6eef9', '--muted': '#a897b3', '--dim': '#6c5c77', '--f-rail-ink': '#9c8ba8', '--f-grp': '#523f5e', '--f-card': 'linear-gradient(160deg,#1a1020,#110b16)', '--f-card-line': '#2e2038', '--f-cell': '#0b070e', '--f-cell-line': '#261a2f', '--f-well': '#08050a', '--f-chip': '#160e1c', '--f-chip-line': '#33243e', '--f-rad': '999px', '--f-rad2': '20px', '--f-acc-ink': '#ffffff' }),
  },
  Matterport: {
    key: 'matterport', skin: 'field', word: '<b>Matterport</b>', view: ['#221b33', '#0b0912'], st: ST.de,
    vars: theme(DARK, '#8f6bff', { '--sans': F.avenir, '--f-bg': '#0d0a16', '--f-bar': '#0d0a16', '--f-rail': '#151122', '--f-head': '#151122', '--f-side': '#151122', '--f-sidehead': '#1a152b', '--panel': '#1c1730', '--panel2': '#231d3b', '--panel3': '#2c2549', '--line': '#2c2647', '--line2': '#3d345f', '--f-line': '#221d38', '--text': '#f1eefc', '--muted': '#a59ec4', '--dim': '#6b6390', '--f-rail-ink': '#9b93bd', '--f-grp': '#4f4870', '--f-card': '#191429', '--f-card-line': '#2e2750', '--f-cell': '#110d1d', '--f-cell-line': '#28214a', '--f-well': '#0c0915', '--f-chip': '#1c1730', '--f-chip-line': '#352d58', '--f-rad': '12px', '--f-rad2': '16px', '--f-acc-ink': '#ffffff' }),
  },
  GeoSLAM: {
    key: 'geoslam', skin: 'field', word: '<b>GeoSLAM</b>', view: ['#13201a', '#040806'], st: ST.de,
    vars: theme(DARK, '#3fd47a', { '--sans': F.gill, '--f-bg': '#070d0a', '--f-bar': '#09120d', '--f-rail': '#0d1812', '--f-head': '#0d1812', '--f-side': '#0c1611', '--f-sidehead': '#112018', '--panel': '#122019', '--panel2': '#17291f', '--panel3': '#1e3428', '--line': '#1f3428', '--line2': '#2b4738', '--f-line': '#182b21', '--text': '#e9f5ee', '--muted': '#94b0a0', '--dim': '#5d7867', '--f-rail-ink': '#8aa797', '--f-grp': '#43604f', '--f-card': '#0f1c15', '--f-card-line': '#21382b', '--f-cell': '#09130e', '--f-cell-line': '#1b3125', '--f-well': '#060c09', '--f-chip': '#122019', '--f-chip-line': '#27412f', '--f-rad': '8px', '--f-rad2': '10px' }),
  },
  Smartphone: {
    key: 'ios', skin: 'ios', word: '<b>LiDAR</b><i>Scanner</i>', view: ['#1c1c1e', '#000000'], st: ST.de,
    vars: theme(DARK, '#0a84ff', { '--sans': F.sf, '--f-bg': '#000000', '--f-bar': '#000000', '--f-bar-ink': '#ffffff', '--f-bar-hi': '#ffffff', '--f-rail': '#1c1c1e', '--f-head': 'rgba(28,28,30,.94)', '--f-side': '#000000', '--f-sidehead': '#000000', '--panel': '#1c1c1e', '--panel2': '#2c2c2e', '--panel3': '#3a3a3c', '--line': '#38383a', '--line2': '#48484a', '--f-line': '#2c2c2e', '--text': '#ffffff', '--muted': '#98989f', '--dim': '#636366', '--f-rail-ink': '#ebebf5', '--f-grp': '#8e8e93', '--f-card': '#1c1c1e', '--f-card-line': 'transparent', '--f-cell': '#2c2c2e', '--f-cell-line': 'transparent', '--f-well': '#1c1c1e', '--f-chip': '#1c1c1e', '--f-chip-line': '#2c2c2e', '--f-rad': '10px', '--f-rad2': '12px', '--f-acc-ink': '#ffffff', '--ok': '#30d158', '--warn': '#ffd60a', '--bad': '#ff453a' }),
  },
  Intel: {
    key: 'intel', skin: 'desk', word: '<b>intel</b><i>RealSense</i>', view: ['#2b2d31', '#141518'], st: ST.de,
    vars: theme(DARK, '#00c7fd', { '--sans': F.segoe, '--f-bg': '#1b1c1f', '--f-bar': '#202125', '--f-rail': '#26282c', '--f-head': '#2b2d32', '--f-side': '#26282c', '--f-sidehead': '#2f3237', '--panel': '#303338', '--panel2': '#383b41', '--panel3': '#43464d', '--line': '#3a3d43', '--line2': '#4c5058', '--f-line': '#34373c', '--text': '#e9ebee', '--muted': '#a3a8b0', '--dim': '#6f747c', '--f-rail-ink': '#a0a5ad', '--f-grp': '#5d626a', '--f-card': '#2b2d32', '--f-card-line': '#3f4249', '--f-cell': '#222428', '--f-cell-line': '#393c42', '--f-well': '#1d1f22', '--f-chip': '#2b2d32', '--f-chip-line': '#44474e', '--f-rad': '2px', '--f-rad2': '3px', '--f-acc-ink': '#0b1a20' }),
  },
  Orbbec: {
    key: 'orbbec', skin: 'desk', word: '<b>ORBBEC</b>', view: ['#101a1e', '#04080a'], st: ST.de,
    vars: theme(DARK, '#2ee6a6', { '--sans': F.avenir, '--f-bg': '#071012', '--f-bar': '#0a1518', '--f-rail': '#0d1a1e', '--f-head': '#0f1e22', '--f-side': '#0d1a1e', '--f-sidehead': '#122428', '--panel': '#132429', '--panel2': '#172c32', '--panel3': '#1e373e', '--line': '#1d353b', '--line2': '#2a4950', '--f-line': '#172b30', '--text': '#e6f6f2', '--muted': '#93b3ad', '--dim': '#5b7b75', '--f-rail-ink': '#8aaaa4', '--f-grp': '#3f5f59', '--f-card': '#102024', '--f-card-line': '#20393f', '--f-cell': '#0a1619', '--f-cell-line': '#1b3237', '--f-well': '#071114', '--f-chip': '#132429', '--f-chip-line': '#26444b', '--f-rad': '6px', '--f-rad2': '8px' }),
  },
};

// alle Marken setzen dieselben Variablen (sonst blieben Werte der vorigen Marke stehen)
const ALL_KEYS = [...new Set(Object.values(BRANDS).flatMap((b) => Object.keys(b.vars)))];

export function brandOf(spec) { return (spec && BRANDS[spec.maker]) || BRANDS.ECHO; }

export function applyBrand(els, B) {
  for (const el of els) {
    if (!el) continue;
    el.dataset.brand = B.key;
    el.dataset.skin = B.skin;
    el.classList.toggle('flight', !!B.light);
    for (const k of ALL_KEYS) {
      const v = B.vars[k] ?? BRANDS.ECHO.vars[k];
      if (v != null) el.style.setProperty(k, v); else el.style.removeProperty(k);
    }
  }
}

// Zustandswort der Marke (für Statusleiste und Live-Anzeige)
export function stateWord(B, ph, d) {
  const s = (B.st || ST.de)[ph] || ph;
  if (B.key === 'velodyne' && ph === 'anlauf' && d) return `Motor ${Math.round(d.unit.rpmFrac * (d.pattern.hz || 10) * 60)} RPM`;
  return s;
}
