/**
 * Deterministic hashing for assets, caches and CI: the same data gives the same string regardless of key order.
 * 32-bit FNV-1a for short ids; SHA-256 when collision resistance matters (needs crypto.subtle).
 */
export function stableStringify(value) {
  return stringify(value, new Set());
}

function stringify(value, seen) {
  if (value === null || value === undefined) return 'null';
  const type = typeof value;

  if (type === 'number') {
    if (!Number.isFinite(value)) return 'null';
    if (Object.is(value, -0)) return '0';
    // fast path: integers (id, hp, seq) skip toPrecision
    if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) return String(value);
    // 12 significant digits: enough for coordinates and UVs, and avoids float drift between machines
    return Number(value.toPrecision(12)).toString();
  }
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return JSON.stringify(value);
  if (type === 'bigint') return JSON.stringify(value.toString());

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error('[hash] circular data');
    seen.add(value);
    const out = `[${value.map((v) => stringify(v, seen)).join(',')}]`;
    seen.delete(value);
    return out;
  }

  if (type === 'object') {
    if (seen.has(value)) throw new Error('[hash] circular data');
    seen.add(value);
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    const out = `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(value[k], seen)}`).join(',')}}`;
    seen.delete(value);
    return out;
  }

  return 'null';
}

export function fnv1a(text, seed = 2166136261) {
  let h = seed >>> 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 32-bit hash of any value (through stableStringify). */
export function hashValue(value) {
  return fnv1a(stableStringify(value));
}

export function shortHash(value, length = 8) {
  const hex = hashValue(value).toString(16).padStart(8, '0');
  return hex.slice(0, Math.max(4, Math.min(8, length)));
}

/** SHA-256 as hex; returns null when crypto.subtle is unavailable. */
export async function sha256Hex(input) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const buf = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
