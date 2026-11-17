/**
 * KV adapter: memory (test/dev) · Cloudflare KV binding · HTTP (Redis/Postgres through a service).
 * Same contract: get / put / delete / list.
 */
export function memoryKv(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    kind: 'memory',
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, String(value));
      return { ok: true };
    },
    async delete(key) {
      map.delete(key);
      return { ok: true };
    },
    async list({ prefix = '' } = {}) {
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

export function bindingKv(binding) {
  if (!binding) return memoryKv();
  return {
    kind: 'binding',
    get: (key) => binding.get(key),
    async put(key, value, opts) {
      await binding.put(key, value, opts);
      return { ok: true };
    },
    async delete(key) {
      await binding.delete(key);
      return { ok: true };
    },
    async list({ prefix = '' } = {}) {
      const res = await binding.list({ prefix });
      return (res.keys || []).map((k) => k.name);
    },
  };
}

/** Redis/Postgres: an external service exposing /kv/:key (same shape as the Rise server). */
export function httpKv({ base, token = null, fetchImpl = fetch } = {}) {
  if (!base) return memoryKv();
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  return {
    kind: 'http',
    async get(key) {
      const res = await fetchImpl(`${base}/kv/${encodeURIComponent(key)}`, { headers });
      if (res.status === 404) return null;
      const data = await res.json();
      return data.value ?? null;
    },
    async put(key, value, { ttl } = {}) {
      const url = `${base}/kv/${encodeURIComponent(key)}${ttl ? `?ttl=${ttl}` : ''}`;
      await fetchImpl(url, { method: 'PUT', headers: { ...headers, 'content-type': 'text/plain' }, body: String(value) });
      return { ok: true };
    },
    async delete(key) {
      await fetchImpl(`${base}/kv/${encodeURIComponent(key)}`, { method: 'DELETE', headers });
      return { ok: true };
    },
    async list({ prefix = '' } = {}) {
      const res = await fetchImpl(`${base}/kv?prefix=${encodeURIComponent(prefix)}`, { headers });
      const data = await res.json();
      return data.keys || [];
    },
  };
}

export function getKv(env, { base = null, token = null } = {}) {
  if (env?.CACHE) return bindingKv(env.CACHE);
  if (base) return httpKv({ base, token });
  return memoryKv();
}
