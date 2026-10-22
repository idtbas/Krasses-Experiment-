// Speichern im Browser – mit Absicherung für private Fenster und volle Speicher
const KEY = 'kinetik.v1';

let cache = null;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { cache = {}; }
  cache.progress ||= {};
  cache.projects ||= [];
  cache.settings ||= {};
  cache.missionCode ||= {};
  return cache;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); return true; } catch { return false; }
}

export const Store = {
  get data() { return load(); },
  save,
  setting(k, def) { const s = load().settings; return k in s ? s[k] : def; },
  setSetting(k, v) { load().settings[k] = v; save(); },
  progress(id) { return load().progress[id] || null; },
  setProgress(id, p) {
    const cur = load().progress[id] || {};
    load().progress[id] = { ...cur, ...p, stars: Math.max(cur.stars || 0, p.stars || 0), best: cur.best ? Math.min(cur.best, p.best ?? Infinity) : p.best };
    save();
  },
  missionCode(id) { return load().missionCode[id] || null; },
  setMissionCode(id, code) { load().missionCode[id] = code; save(); },
  projects() { return load().projects.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)); },
  project(id) { return load().projects.find((p) => p.id === id) || null; },
  saveProject(p) {
    const list = load().projects;
    p.updated = Date.now();
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) list[i] = p; else list.push(p);
    return save();
  },
  deleteProject(id) {
    const d = load();
    d.projects = d.projects.filter((p) => p.id !== id);
    save();
  },
};
