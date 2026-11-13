/* VistoOS · os/faces.js — Zifferblätter und der Uhr-Startbildschirm
 *
 *  V.faces.register({
 *    id, name, order,
 *    options: [ {key, label, type:'color'|'choice'|'toggle', values:[{v, label}], default} ],
 *    create(root, ctx) → { frame(dt, now), minute(now), setOptions(opts), ambient(on), destroy() }
 *  })
 *  ctx = { opts, color(key='color') → Hex, accent(), preview (bool), onFrame(fn) }
 *
 *  V.faces.show(id, {dir})   V.faces.next(±1)   V.faces.opts(id)   V.faces.setOpt(id, key, v)
 *  V.faces.preview(id, el, optsOverride) → Instanz (für Editor, Einrichtung)
 *
 *  Komplikationen lesen Daten über V.info.* (von Apps bereitgestellt; können fehlen):
 *    V.info.weather() → {temp, icon, text, hi, lo, place} | null
 *    V.info.nextEvent() → {title, start: Date} | null
 *    V.info.timer() → {left (s), total (s), label} | null
 */
'use strict';
(function () {
  const V = window.V, U = V.util;
  const reg = new Map();
  V.info = V.info || {};

  const COLORS = [
    { v: 'accent', label: 'Akzent' },
    { v: '#FFFFFF', label: 'Weiß' },
    { v: '#FF9A4D', label: 'Glut' },
    { v: '#FF5E7A', label: 'Koralle' },
    { v: '#FF8FD1', label: 'Rosé' },
    { v: '#B79CFF', label: 'Lavendel' },
    { v: '#7CC8FF', label: 'Eis' },
    { v: '#5EE6B0', label: 'Minze' },
    { v: '#F5E663', label: 'Zitrone' },
    { v: '#FF453A', label: 'Rot' },
  ];

  let home = null;        // Startbildschirm-Element
  let cur = null;         // {id, def, inst, root, ctx}
  let ambientOn = false;
  let frameOff = null;

  function resolveOpts(def, override) {
    const saved = (V.store.get('settings.faceOpts', {}) || {})[def.id] || {};
    const o = {};
    for (const op of def.options || []) o[op.key] = op.default;
    Object.assign(o, saved, override || {});
    return o;
  }

  function makeCtx(def, opts, preview) {
    const offs = [];
    return {
      opts,
      preview: !!preview,
      accent: () => V.store.get('settings.accent', '#FF9A4D'),
      color(key = 'color') {
        const v = this.opts[key];
        return !v || v === 'accent' ? V.store.get('settings.accent', '#FF9A4D') : v;
      },
      onFrame(fn) { const off = V.loop.add(fn, 4); offs.push(off); return off; },
      on(evt, fn) { const off = V.on(evt, fn); offs.push(off); return off; },
      _destroy() { offs.splice(0).forEach((f) => f()); },
    };
  }

  function instantiate(def, root, override, preview) {
    const opts = resolveOpts(def, override);
    const ctx = makeCtx(def, opts, preview);
    let inst = null;
    try { inst = def.create(root, ctx) || {}; } catch (e) { console.error('[VistoOS] Zifferblatt', def.id, e); inst = {}; }
    const now = V.time.now();
    if (inst.minute) V.safe(() => inst.minute(now));
    return { id: def.id, def, inst, root, ctx };
  }
  function destroy(f) {
    if (!f) return;
    if (f.inst.destroy) V.safe(() => f.inst.destroy());
    f.ctx._destroy();
  }

  function onFrame(dt) {
    if (!cur || !cur.inst.frame) return;
    if (home && home.style.visibility === 'hidden') return;
    cur.inst.frame(dt, V.time.now());
  }

  const faces = (V.faces = {
    COLORS,
    register(def) { def.order = def.order !== undefined ? def.order : 50; reg.set(def.id, def); return def; },
    get: (id) => reg.get(id),
    list: () => Array.from(reg.values()).filter((d) => !d.hidden).sort((a, b) => a.order - b.order),
    get current() { return cur ? cur.id : null; },
    get instance() { return cur; },

    mountHome(stage) {
      home = U.el('div', { class: 'vos-screen vos-home' });
      stage.appendChild(home);
      V.on('time:minute', (d) => { if (cur && cur.inst.minute) V.safe(() => cur.inst.minute(d)); });
      V.on('store:settings.accent', () => faces.refresh());
      V.on('store:settings.use24h', () => faces.refresh());
      frameOff = V.loop.add(onFrame, 4);
      return home;
    },
    get home() { return home; },

    show(id, o = {}) {
      const def = reg.get(id) || faces.list()[0];
      if (!def || !home) return;
      V.store.set('settings.face', def.id);
      const root = U.el('div', { class: 'vos-screen vos-face vos-face-' + def.id });
      home.appendChild(root);
      const old = cur;
      cur = instantiate(def, root);
      if (ambientOn && cur.inst.ambient) V.safe(() => cur.inst.ambient(true));
      V.emit('face:changed', def.id);
      if (old && o.dir) {
        // Drehübergang: altes Blatt dreht weg, neues dreht herein
        const dir = o.dir;
        const sp = V.spring(0, { response: 0.55, bounce: 0.12 });
        old.root.style.pointerEvents = 'none';
        sp.onUpdate((t) => {
          const k = U.clamp(t, 0, 1.2);
          old.root.style.transform = `rotate(${-dir * 32 * k}deg) scale(${1 - 0.14 * k})`;
          old.root.style.opacity = String(U.clamp(1 - k * 1.6, 0, 1));
          root.style.transform = `rotate(${dir * 32 * (1 - t)}deg) scale(${0.86 + 0.14 * t})`;
          root.style.opacity = String(U.clamp(t * 1.4, 0, 1));
        });
        root.style.opacity = '0';
        sp.to(1).then(() => { destroy(old); old.root.remove(); root.style.transform = ''; root.style.opacity = ''; });
        V.sound.play('tick');
      } else if (old) {
        destroy(old); old.root.remove();
      }
      return cur;
    },
    next(dir = 1) {
      const list = faces.list();
      if (!list.length) return;
      const i = Math.max(0, list.findIndex((d) => d.id === (cur && cur.id)));
      const n = list[U.wrap(i + dir, list.length)];
      faces.show(n.id, { dir });
      V.notify.toast(n.name, 'face');
    },
    refresh() { if (cur) faces.show(cur.id); },

    opts(id) { const d = reg.get(id); return d ? resolveOpts(d) : {}; },
    setOpt(id, key, value) {
      const all = Object.assign({}, V.store.get('settings.faceOpts', {}));
      all[id] = Object.assign({}, all[id] || {}, { [key]: value });
      V.store.set('settings.faceOpts', all);
      if (cur && cur.id === id) {
        cur.ctx.opts = resolveOpts(cur.def);
        if (cur.inst.setOptions) V.safe(() => cur.inst.setOptions(cur.ctx.opts));
        else faces.refresh();
      }
    },

    /** nicht interaktive Vorschau (Editor, Einrichtung). Läuft mit eigenem Takt. */
    preview(id, el, override) {
      const def = reg.get(id);
      if (!def) return null;
      const root = U.el('div', { class: 'vos-screen vos-face vos-face-' + def.id, style: { pointerEvents: 'none' } });
      el.appendChild(root);
      const f = instantiate(def, root, override, true);
      const off = V.loop.add((dt) => { if (f.inst.frame) f.inst.frame(dt, V.time.now()); }, 4);
      const offM = V.on('time:minute', (d) => { if (f.inst.minute) f.inst.minute(d); });
      return {
        root, inst: f.inst,
        setOptions(o) { f.ctx.opts = resolveOpts(def, o); if (f.inst.setOptions) f.inst.setOptions(f.ctx.opts); },
        destroy() { off(); offM(); destroy(f); root.remove(); },
      };
    },

    setAmbient(on) {
      ambientOn = on;
      if (cur && cur.inst.ambient) V.safe(() => cur.inst.ambient(on));
    },

    /* --------- Hilfen für Zifferblätter ---------- */

    /** Ziffern, die beim Wechsel weich nach oben rollen */
    rollDigits(container, o = {}) {
      const slots = [];
      function slotFor(i) {
        if (slots[i]) return slots[i];
        const s = U.el('span', { class: 'rd-slot', style: { position: 'relative', display: 'inline-block', overflow: 'visible', textAlign: 'center' } });
        container.appendChild(s);
        slots[i] = { el: s, ch: null };
        return slots[i];
      }
      return {
        set(str) {
          const chars = String(str).split('');
          // überzählige entfernen
          while (slots.length > chars.length) { const s = slots.pop(); s.el.remove(); }
          chars.forEach((ch, i) => {
            const s = slotFor(i);
            if (s.ch === ch) return;
            const isColon = ch === ':' || ch === '.' || ch === ' ' || ch === ',';
            s.el.style.width = isColon ? (o.colonW || '0.32em') : (o.digitW || '0.6em');
            const prev = s.ch;
            s.ch = ch;
            const nu = U.el('span', { class: 'rd-ch', style: { display: 'inline-block', willChange: 'transform, opacity, filter' }, text: ch });
            if (prev === null || o.instant) { s.el.innerHTML = ''; s.el.appendChild(nu); return; }
            const old = s.el.lastChild;
            if (old) { old.style.position = 'absolute'; old.style.left = '0'; old.style.right = '0'; old.style.top = '0'; }
            s.el.appendChild(nu);
            const sp = V.spring(0, { response: o.response || 0.62, bounce: 0.08 });
            sp.onUpdate((t) => {
              nu.style.transform = `translateY(${(1 - t) * 42}%) scale(${0.92 + 0.08 * t})`;
              nu.style.opacity = U.clamp(t * 1.3, 0, 1).toFixed(3);
              nu.style.filter = o.blur !== false && t < 0.98 ? `blur(${((1 - t) * 0.08).toFixed(3)}em)` : '';
              if (old) {
                old.style.transform = `translateY(${-t * 42}%) scale(${1 - 0.08 * t})`;
                old.style.opacity = U.clamp(1 - t * 1.5, 0, 1).toFixed(3);
                if (o.blur !== false) old.style.filter = `blur(${(t * 0.08).toFixed(3)}em)`;
              }
            });
            sp.to(1).then(() => { if (old && old.parentNode) old.remove(); nu.style.filter = ''; });
          });
        },
      };
    },

    /** kurzer Text für Komplikationen unter der Uhrzeit */
    complicationText(o = {}) {
      const parts = [];
      const w = V.info.weather && V.safe(() => V.info.weather());
      if (w && o.weather !== false) parts.push({ icon: w.icon || 'sun', text: Math.round(w.temp) + '°' + (o.place && w.place ? ' ' + w.place : '') });
      const t = V.info.timer && V.safe(() => V.info.timer());
      if (t && o.timer !== false) parts.push({ icon: 'timer', text: V.fmt.duration(t.left), color: '#FF9F0A' });
      const al = V.info.alarm && V.safe(() => V.info.alarm());
      if (al && o.alarm !== false && (al.date || al.at)) {
        const d = new Date(al.date || al.at);
        if (!isNaN(d) && d - V.time.now() < 14 * 3600e3) parts.push({ icon: 'alarm', text: V.fmt.time24(d) });
      }
      const ev = V.info.nextEvent && V.safe(() => V.info.nextEvent());
      if (ev && o.event !== false && !t) {
        const day = V.fmt.relDay(ev.start);
        parts.push({ icon: 'calendar', text: (day === 'Heute' ? '' : day + ' ') + V.fmt.time24(ev.start) + ' ' + ev.title });
      }
      return parts;
    },
    renderComplications(el, o = {}) {
      const parts = faces.complicationText(o).slice(0, o.max || 2);
      el.innerHTML = parts.map((p) => `<span class="cx" style="display:inline-flex;align-items:center;gap:1.3cqw;${p.color ? 'color:' + p.color : ''}">${V.icon(p.icon, 'style="width:1.15em;height:1.15em"')}<span>${U.esc(p.text)}</span></span>`).join('<span style="opacity:.35;margin:0 2cqw">·</span>');
    },
  });
})();
