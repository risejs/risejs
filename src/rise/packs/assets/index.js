import * as THREE from 'three';
import { classify, normalizeList, progressOf } from './core.js';
import { ByteCache } from './cache.js';
export { classify, normalizeList, progressOf, ByteCache };

/**
 * Assets pack: preloads textures, audio, JSON and glTF with progress reporting and a URL cache.
 *
 *   app.use(assetsPlugin, { base: '/assets/' });
 *   await app.assets.load(['tex/tile.png', 'sfx/hit.ogg']);
 *   const tex = app.assets.texture('tex/tile.png');
 *   const gltf = await app.assets.gltf('models/crate.glb');
 */
export function assetsPlugin(app, { base = '', cacheBytes = 64 * 1024 * 1024 } = {}) {
  const textures = new Map();
  const audios = new Map();
  const texts = new Map();
  const gltfs = new Map();
  const pending = new Map();
  const cache = new ByteCache({ budget: cacheBytes });

  const full = (url) => (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:') ? url : base + url);

  function texture(url) {
    const key = full(url);
    if (textures.has(key)) return textures.get(key);
    const tex = new THREE.TextureLoader().load(key);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, tex);
    return tex;
  }

  async function audio(url) {
    const key = full(url);
    if (audios.has(key)) return audios.get(key);
    const ctx = app.audio?.ctx;
    const res = await fetch(key);
    if (!res.ok) throw new Error(`[assets] ${res.status} ${key}`);
    const buf = await res.arrayBuffer();
    const decoded = ctx ? await ctx.decodeAudioData(buf) : { arrayBuffer: buf };
    audios.set(key, decoded);
    return decoded;
  }

  async function text(url) {
    const key = full(url);
    if (texts.has(key)) return texts.get(key);
    const res = await fetch(key);
    if (!res.ok) throw new Error(`[assets] ${res.status} ${key}`);
    const raw = await res.text();
    texts.set(key, raw);
    return raw;
  }

  async function json(url) {
    return JSON.parse(await text(url));
  }

  async function gltf(url) {
    const key = full(url);
    if (gltfs.has(key)) return gltfs.get(key);
    if (!pending.has(key)) {
      const p = import('../gltf/index.js').then(({ loadGltf }) => loadGltf(key)).then((g) => {
        gltfs.set(key, g);
        return g;
      });
      pending.set(key, p);
    }
    return pending.get(key);
  }

  /**
   * Loads a list and calls onProgress(ratio, entry) after each item.
   * One failed item does not block the rest; returns { ok, failed }.
   */
  async function load(list, { onProgress = null, concurrency = 4 } = {}) {
    const entries = normalizeList(list, base);
    const weights = entries.map((e) => (e.type === 'audio' ? 3 : e.type === 'gltf' ? 6 : 1));
    let done = 0;
    let failed = 0;

    const runOne = async (entry) => {
      try {
        if (entry.type === 'texture') texture(entry.url);
        else if (entry.type === 'audio') await audio(entry.url);
        else if (entry.type === 'gltf') await gltf(entry.url);
        else await text(entry.url);
      } catch (err) {
        failed++;
        app.events.emit('assets:error', { url: entry.url, error: err });
      } finally {
        done++;
        onProgress?.(progressOf(done, entries.length, weights), entry);
      }
    };

    const queue = [...entries];
    const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
      while (queue.length) await runOne(queue.shift());
    });
    await Promise.all(workers);

    const result = { ok: entries.length - failed, failed, total: entries.length };
    app.events.emit('assets:loaded', result);
    return result;
  }

  /** Fetches bytes through the byte cache; a hit makes no network request. */
  async function fetchCached(url, { headers = null } = {}) {
    const key = full(url);
    const hit = cache.get(key, Date.now());
    if (hit) return hit;

    const res = await fetch(key, headers ? { headers } : undefined);
    if (!res.ok) throw new Error(`[assets] ${res.status} ${key}`);
    const buf = await res.arrayBuffer();
    cache.put(key, buf, { size: buf.byteLength, at: Date.now() });
    app.events.emit('assets:cached', { url: key, bytes: buf.byteLength });
    return buf;
  }

  const api = {
    load,
    texture,
    audio,
    text,
    json,
    gltf,
    full,
    cache,
    fetchCached,
    report: () => cache.report(),
    clean: (budget, opts) => cache.clean(budget, opts),
    retain: (key, v) => cache.retain(key, v),
    caches: { textures, audios, texts, gltfs },
    dispose() {
      for (const tex of textures.values()) tex.dispose();
      textures.clear();
      audios.clear();
      texts.clear();
      gltfs.clear();
      pending.clear();
      cache.clear({ keepRetained: false });
      if (app.assets === api) app.assets = null;
    },
  };
  app.assets = api;
  return api;
}
