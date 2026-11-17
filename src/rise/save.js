/**
 * Signed saves: tamper *detection* for save data, not absolute security.
 *
 * Envelope: { v:1, t:<ms>, data, sig }
 *  - sig = HMAC-SHA-256(gameId|save-v1, JSON(data))
 *  - Without crypto.subtle (file://) → a weak checksum is used and weak:true is set
 *
 * Note: the key lives on the client, so a determined person can still edit the save. Real protection
 * means storing saves server-side (see docs/anticheat.md).
 */
const ENC = new TextEncoder();
const keyCache = new Map();

async function getKey(gameId) {
  if (!globalThis.crypto?.subtle) return null;
  if (keyCache.has(gameId)) return keyCache.get(gameId);
  const material = ENC.encode(`rise|${gameId}|save-v1`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  const key = await crypto.subtle.importKey('raw', digest, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  keyCache.set(gameId, key);
  return key;
}

function weakSum(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

async function sign(gameId, text) {
  const key = await getKey(gameId);
  if (!key) return { sig: 'w:' + weakSum(text), weak: true };
  const buf = await crypto.subtle.sign('HMAC', key, ENC.encode(text));
  return { sig: [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''), weak: false };
}

/** Migration chain: v1→v2→…→current. Pure and testable. */
export function migrateData(data, from, to, migrations = {}) {
  let v = from;
  let out = data;
  let guard = 0;
  while (v < to && guard++ < 32) {
    const fn = migrations[v];
    if (typeof fn !== 'function') return { ok: false, reason: 'migrate-missing', at: v };
    out = fn(out);
    v++;
  }
  return { ok: true, data: out, version: v };
}

export class SaveSlot {
  constructor({ gameId, adapter = localStorage, key = 'rise.save.v1', version = 1, migrate = {} } = {}) {
    this.gameId = gameId;
    this.adapter = adapter;
    this.key = `${key}.${gameId}`;
    this.version = version;
    this.migrate = migrate;
  }

  async read() {
    let raw = null;
    try {
      raw = this.adapter.getItem(this.key);
    } catch {
      return null;
    }
    if (!raw) return null;

    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return { data: null, tampered: true, reason: 'json' };
    }

    const from = Number(env?.v ?? 0);
    if (!Number.isFinite(from) || from <= 0) return { data: env?.data ?? env, tampered: true, reason: 'version' };
    if (from > this.version) return { data: env.data, tampered: true, reason: 'version-newer' };

    const text = JSON.stringify(env.data);
    const { sig } = await sign(this.gameId, text);
    const tampered = sig !== env.sig;

    let data = env.data;
    let migrated = false;
    if (from < this.version) {
      const res = migrateData(data, from, this.version, this.migrate);
      if (!res.ok) return { data: env.data, tampered: true, reason: res.reason };
      data = res.data;
      migrated = true;
    }

    return {
      data,
      savedAt: env.t,
      tampered,
      migrated,
      from: migrated ? from : undefined,
      reason: tampered ? 'signature' : null,
    };
  }

  async write(data) {
    const text = JSON.stringify(data);
    const { sig, weak } = await sign(this.gameId, text);
    const env = { v: this.version, t: Date.now(), data, sig, weak: weak || undefined };
    try {
      this.adapter.setItem(this.key, JSON.stringify(env));
    } catch (err) {
      console.warn('[rise] could not write the save', err);
    }
    return env;
  }

  clear() {
    try {
      this.adapter.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}
