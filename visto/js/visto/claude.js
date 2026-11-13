/* VistoOS · visto/claude.js — Visto mit Claude (Anthropic) verbinden
 *
 *  Weg 1 – eigener API-Schlüssel der Organisation (Emulator-Menü „Claude verbinden“):
 *          offizielles Anthropic-SDK, im Browser geladen, Schlüssel bleibt nur in diesem Browser.
 *          Modell: Claude Sonnet 5.5 (umstellbar). Geräteaktionen laufen als Werkzeuge (tool use).
 *  Weg 2 – im Claude-Artefakt: über das Claude-Konto der Person (window.claude „sample“), siehe brain.js.
 *
 *  V.claude.configured  → bool
 *  V.claude.ask(messages, {system, onTool}) → Promise<{text}>
 *  V.claude.setKey(key) / setModel(id) / test()
 */
'use strict';
(function () {
  const V = window.V;
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.137.0/+esm';
  const KEY = 'vistoos.claudeKey';
  const MODELS = [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (empfohlen)' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (am klügsten)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (am schnellsten)' },
  ];
  let sdkPromise = null, client = null, clientKey = '';

  function readKey() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function model() { try { return localStorage.getItem(KEY + '.model') || 'claude-sonnet-5-5'; } catch (e) { return 'claude-sonnet-5-5'; } }

  async function getClient() {
    const key = readKey();
    if (!key) throw new Error('kein Schlüssel');
    if (client && clientKey === key) return client;
    if (!sdkPromise) sdkPromise = import(SDK_URL);
    const mod = await sdkPromise;
    const Anthropic = mod.default || mod.Anthropic;
    // Der Schlüssel gehört der Person selbst und bleibt in ihrem Browser.
    client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
    clientKey = key;
    return client;
  }

  /** Geräteaktionen als Werkzeuge beschreiben */
  function toolDefs() {
    const map = new Map();
    const tools = V.actions.list().slice(0, 48).map((a) => {
      const name = a.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
      map.set(name, a);
      return {
        name,
        description: (a.desc || a.name).slice(0, 900),
        input_schema: { type: 'object', properties: a.params || {}, required: a.required || [] },
      };
    });
    return { tools, map };
  }

  async function runTool(a, input, o) {
    try {
      if (o.onTool) o.onTool(a);
      const r = await V.actions.run(a.name, input || {});
      if (r && typeof r === 'object') {
        if (r.card) o.result.card = r.card;
        if (r.open) { o.result.open = r.open; o.result.params = r.params; }
      }
      return typeof r === 'string' ? r : r && r.say ? r.say : JSON.stringify(r === undefined ? 'erledigt' : r);
    } catch (e) {
      return { error: String(e && e.message || e) };
    }
  }

  const api = (V.claude = {
    MODELS,
    get configured() { return !!readKey(); },
    get model() { return model(); },
    setKey(k) {
      try { if (k) localStorage.setItem(KEY, k.trim()); else localStorage.removeItem(KEY); } catch (e) { /* */ }
      client = null;
      V.emit('brain:ai', api.configured);
    },
    setModel(id) { try { localStorage.setItem(KEY + '.model', id); } catch (e) { /* */ } },

    /** Gespräch mit Werkzeugschleife. messages: [{role, content}] (Text) */
    async ask(messages, o = {}) {
      const c = await getClient();
      const { tools, map } = toolDefs();
      const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = { text: '' };
      const ctx = Object.assign({}, o, { result });
      for (let round = 0; round < 6; round++) {
        if (o.signal && o.signal.aborted) throw Object.assign(new Error('abgebrochen'), { code: 'cancelled' });
        const response = await c.beta.messages.create({
          model: model(),
          max_tokens: 2048,
          system: o.system,
          messages: msgs,
          tools,
          output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        }, { signal: o.signal });
        if (response.stop_reason === 'refusal') {
          result.text = 'Dabei kann ich leider nicht helfen.';
          result.emotion = 'sad';
          return result;
        }
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
        if (text) { result.text = text; if (o.onText) o.onText(text); }
        if (response.stop_reason === 'pause_turn') { msgs.push({ role: 'assistant', content: response.content }); continue; }
        if (response.stop_reason !== 'tool_use') return result;
        msgs.push({ role: 'assistant', content: response.content });
        const uses = response.content.filter((b) => b.type === 'tool_use');
        const results = [];
        for (const u of uses) {
          const a = map.get(u.name);
          const out = a ? await runTool(a, u.input, ctx) : { error: 'Unbekanntes Werkzeug' };
          const isErr = out && typeof out === 'object' && out.error;
          results.push({ type: 'tool_result', tool_use_id: u.id, content: isErr ? out.error : String(out), is_error: isErr ? true : undefined });
        }
        msgs.push({ role: 'user', content: results });
      }
      return result;
    },

    /** Verbindung prüfen (kleine Anfrage) */
    async test() {
      const c = await getClient();
      const r = await c.messages.create({ model: model(), max_tokens: 64, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Antworte nur mit: Verbunden.' }] });
      return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim() || 'Verbunden.';
    },
  });
})();
