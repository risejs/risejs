/**
 * Runtime environment checks, shared by app, touch, xr and bench.
 * Never throws; returns false or a safe value when an API is missing.
 */
export function hasWebGL2(doc = globalThis.document) {
  if (!doc?.createElement) return false;
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension?.('WEBGL_lose_context')?.loseContext?.();
    return true;
  } catch {
    return false;
  }
}

export function isSecureContext(win = globalThis) {
  return !!win.isSecureContext;
}

export function isTouchDevice(nav = globalThis.navigator) {
  if (!nav) return false;
  if (nav.maxTouchPoints > 0) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
}

export function prefersReducedMotion(win = globalThis) {
  try {
    return !!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  } catch {
    return false;
  }
}

/** Short info for logs and telemetry (no deep fingerprinting). */
export function envInfo(win = globalThis) {
  const nav = win.navigator || {};
  return {
    webgl2: hasWebGL2(win.document),
    secure: isSecureContext(win),
    touch: isTouchDevice(nav),
    reducedMotion: prefersReducedMotion(win),
    dpr: win.devicePixelRatio || 1,
    screen: win.screen ? `${win.screen.width}x${win.screen.height}` : '?',
    lang: nav.language || '?',
  };
}
