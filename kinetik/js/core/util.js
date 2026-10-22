// Kleine Helfer für Mathematik, DOM und Zeit, die überall gebraucht werden.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const sign = (v) => (v < 0 ? -1 : 1);

let uidCounter = 0;
export const uid = (p = 'n') => p + (++uidCounter).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

export function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Zahlen freundlich formatieren: höchstens zwei Nachkommastellen, Punkt als Trenner
export function fmtNum(v, digits = 2) {
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return Object.is(r, -0) ? '0' : String(r);
}

/* ---------- Vektoren und Quaternionen als einfache Objekte {x,y,z(,w)} ---------- */

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vscale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const vlen = (a) => Math.hypot(a.x, a.y, a.z);
export const vnorm = (a) => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
export const vdist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const qid = () => ({ x: 0, y: 0, z: 0, w: 1 });
export const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export function qmul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
export function qrot(q, v) {
  // v' = q v q*
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}
export function qaxis(axis, angle) {
  const s = Math.sin(angle / 2);
  const a = vnorm(axis);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(angle / 2) };
}
export const qyaw = (a) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
// Gierwinkel (Drehung um Y) der lokalen Vorwärtsachse +Z
export function yawOf(q) {
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  return Math.atan2(fx, fz);
}
export function upOf(q) {
  return { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
}
// Drehwinkel der relativen Rotation um eine Achse (Twist-Zerlegung)
export function twistAngle(q, axis) {
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  return wrapAngle(2 * Math.atan2(d, q.w));
}

/* ---------- DOM ---------- */

// h('div.klasse#id', {attr}, kinder…)
export function h(tag, attrs, ...children) {
  const m = tag.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  appendKids(el, children);
  return el;
}
function appendKids(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) appendKids(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Seeded Zufall (für reproduzierbare Missionen)
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Levenshtein-Abstand für „Meintest du …?“
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
export function closest(word, list, max = 2) {
  let best = null, bd = Infinity;
  for (const w of list) { const d = editDistance(word, w); if (d < bd) { bd = d; best = w; } }
  return bd <= Math.max(max, Math.floor(word.length / 3)) ? best : null;
}
