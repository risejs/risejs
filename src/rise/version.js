/** Framework and API versions. Bump API_VERSION on breaking changes. */
export const VERSION = '0.1.0-alpha.3';
export const API_VERSION = 2;

const warned = new Set();

/** Warns about a deprecation once per name. */
export function deprecate(name, replacement = null, { since = VERSION } = {}) {
  if (warned.has(name)) return;
  warned.add(name);
  const suffix = replacement ? `; use ${replacement} instead` : '';
  console.warn(`[rise] "${name}" is deprecated (since ${since})${suffix}`);
}

/** Version info for logs and telemetry. */
export function apiInfo() {
  return { version: VERSION, apiVersion: API_VERSION };
}
