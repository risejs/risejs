/** Picks the XR mode and probes support. Pure logic, for tests. */
export function pickMode({ preferred = 'immersive-ar', ar = false, vr = false } = {}) {
  if (preferred === 'immersive-ar' && ar) return 'immersive-ar';
  if (vr) return 'immersive-vr';
  if (ar) return 'immersive-ar';
  return null;
}

export async function detectSupport(nav = globalThis.navigator) {
  const xr = nav?.xr;
  if (!xr?.isSessionSupported) return { hasXR: false, ar: false, vr: false };
  const check = async (mode) => {
    try {
      return !!(await xr.isSessionSupported(mode));
    } catch {
      return false;
    }
  };
  const [ar, vr] = await Promise.all([check('immersive-ar'), check('immersive-vr')]);
  return { hasXR: true, ar, vr };
}

export function featuresFor(mode) {
  if (mode === 'immersive-ar') {
    return { requiredFeatures: [], optionalFeatures: ['local-floor', 'hit-test', 'dom-overlay', 'hand-tracking', 'anchors'] };
  }
  return { requiredFeatures: [], optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
}
