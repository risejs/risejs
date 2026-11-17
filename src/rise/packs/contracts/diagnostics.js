/**
 * Coded diagnostics shared by the core, packs and tooling.
 * Codes follow the `domain.area.problem` convention (for example `asset.missing`, `save.version-newer`).
 * Data pipelines do not throw: they return a Result and let the caller decide.
 */
export const DIAGNOSTIC_CODE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,3}$/;

export function ok(value) {
  return { ok: true, value };
}

export function fail(code, message, meta = null) {
  return { ok: false, code, message, meta };
}

export function isOk(result) {
  return !!result && result.ok === true;
}

export function unwrap(result) {
  if (!isOk(result)) throw new Error(`[rise] ${result?.code || 'error'}: ${result?.message || ''}`);
  return result.value;
}

export function diagnostic(code, message, meta = null) {
  return { code, message, meta };
}

/** Normalises a diagnostic and validates its code; used for logging and telemetry. */
export function formatDiagnostic(d) {
  if (!d) return '';
  const code = DIAGNOSTIC_CODE.test(d.code || '') ? d.code : 'app.unknown';
  return `${code}: ${d.message || ''}`.trim();
}

/** Merges diagnostics, de-duplicating by code + message. */
export function mergeDiagnostics(list = []) {
  const seen = new Set();
  const out = [];
  for (const d of list) {
    if (!d) continue;
    const key = `${d.code}|${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}
