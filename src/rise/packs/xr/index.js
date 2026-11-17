import './xr.css';
import { detectSupport, pickMode, featuresFor } from './support.js';
import { isSecureContext } from '../../env.js';

/**
 * XR pack: WebXR for VR and AR (AR-first).
 *
 *   app.use(xrPlugin, { mode: 'immersive-ar' });
 *
 * No XR support → the button is hidden, `app.xr.available === false`, and `xr:unavailable` is emitted.
 * Requires HTTPS (a secure context), except on localhost.
 */
export function xrPlugin(app, { mode = 'immersive-ar', fallback = 'immersive-vr' } = {}) {
  const renderer = app.renderer;
  const prevXr = renderer?.xr?.enabled;
  let session = null;
  let disposed = false;
  const button = document.createElement('button');
  button.className = 'xr-btn';
  button.type = 'button';
  button.textContent = 'XR';
  button.hidden = true;
  button.title = 'WebXR';
  app.hud.root.appendChild(button);

  const api = {
    mode,
    button,
    support: { hasXR: false, ar: false, vr: false },
    available: false,
    active: false,
    session: null,
    errors: [],
    async enter() {},
    async exit() {},
    dispose() {
      disposed = true;
      button.removeEventListener('click', onClick);
      button.remove();
      const s = session;
      session = null;
      try {
        s?.end?.()?.catch?.(() => {});
      } catch {}
      if (renderer?.xr && prevXr !== undefined) renderer.xr.enabled = prevXr;
      api.active = false;
      api.session = null;
      if (app.xr === api) app.xr = null;
    },
  };
  const onClick = () => (session ? api.exit() : api.enter());

  if (!renderer?.xr) {
    api.errors.push('renderer.xr unavailable');
    app.xr = api;
    app.events.emit('xr:unavailable', { reason: 'renderer' });
    return api;
  }

  if (!isSecureContext()) {
    api.errors.push('HTTPS required');
    app.xr = api;
    app.events.emit('xr:unavailable', { reason: 'insecure' });
    return api;
  }

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const labelOf = (m) => (m === 'immersive-ar' ? 'AR' : 'VR');

  async function enter() {
    if (session) return session;
    const chosen = pickMode({ preferred: mode, ...api.support }) || (await pickModeAsync());
    if (!chosen) {
      api.errors.push('no XR mode available');
      return null;
    }

    try {
      const sessionInit = featuresFor(chosen);
      session = await navigator.xr.requestSession(chosen, sessionInit);
      await renderer.xr.setSession(session);
      api.active = true;
      api.session = session;
      api.mode = chosen;
      button.textContent = 'EXIT';
      button.hidden = false;
      session.addEventListener('end', () => {
        session = null;
        api.active = false;
        api.session = null;
        button.textContent = labelOf(chosen);
        app.events.emit('xr:end', { mode: chosen });
      });
      app.events.emit('xr:start', { mode: chosen });
      return session;
    } catch (err) {
      api.errors.push(String(err?.message || err));
      button.textContent = 'XR ERR';
      console.warn('[rise] XR session failed', err);
      app.events.emit('xr:error', err);
      return null;
    }
  }

  async function pickModeAsync() {
    const support = await detectSupport();
    api.support = support;
    return pickMode({ preferred: mode, ...support });
  }

  async function exit() {
    if (session) await session.end();
  }

  button.addEventListener('click', onClick);

  api.enter = enter;
  api.exit = exit;

  // Probe support after the app starts (does not block build)
  detectSupport().then((support) => {
    if (disposed) return;
    api.support = support;
    const available = pickMode({ preferred: mode, ...support });
    api.available = !!available;
    if (!available) {
      button.hidden = true;
      app.events.emit('xr:unavailable', { reason: 'unsupported', support });
      return;
    }
    api.mode = available;
    button.hidden = false;
    button.textContent = labelOf(available);
    button.title = `Enter ${labelOf(available)}`;
    app.events.emit('xr:ready', { mode: available, support });
  });

  app.xr = api;
  return api;
}
