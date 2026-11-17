import './a11y.css';
import { resolveA11y, a11yCss, SVG_FILTERS } from './core.js';

/**
 * Accessibility pack: colorblind filter, UI scale, reduce motion, high contrast.
 * Settings are stored in localStorage under `rise.a11y`; initial values come from the plugin options.
 */
export function a11yPlugin(app, options = {}) {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem('rise.a11y') || '{}');
  } catch {
    stored = {};
  }

  let settings = resolveA11y({ ...stored, ...options });

  const appEl = document.getElementById('app');
  const uiEl = document.getElementById('ui');

  document.body.insertAdjacentHTML('beforeend', SVG_FILTERS);
  const svgEl = document.body.lastElementChild;

  function apply() {
    const css = a11yCss(settings);
    if (appEl) appEl.style.filter = css.filter;
    document.body.classList.toggle('a11y-reduce-motion', css.reduceMotion);
    document.body.classList.toggle('a11y-contrast', css.highContrast);
    if (uiEl) uiEl.style.zoom = String(css.uiScale);
  }

  function save() {
    try {
      localStorage.setItem('rise.a11y', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }

  function set(patch) {
    settings = resolveA11y({ ...settings, ...patch });
    apply();
    save();
    app.events.emit('a11y:change', settings);
    return settings;
  }

  apply();

  const api = {
    get settings() {
      return settings;
    },
    set,
    reset() {
      return set({});
    },
    toggleReduceMotion() {
      return set({ reduceMotion: !settings.reduceMotion });
    },
  };

  api.dispose = () => {
    svgEl?.remove();
    if (appEl) appEl.style.filter = '';
    document.body.classList.remove('a11y-reduce-motion', 'a11y-contrast');
    if (uiEl) uiEl.style.zoom = '';
    if (app.a11y === api) app.a11y = null;
  };

  app.a11y = api;
  return api;
}
