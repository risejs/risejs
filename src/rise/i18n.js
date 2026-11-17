/**
 * Minimal i18n: string tables per locale, a fallback, {var} interpolation.
 *
 *   const i18n = new I18n({ locale: 'fr', fallback: 'en', strings: { fr: {...}, en: {...} } });
 *   i18n.t('city.title');            // "LA VILLE"
 *   i18n.t('hud.ammo', { n: 30 });   // "Munitions 30"
 */
export class I18n {
  constructor({ locale = 'en', fallback = 'en', strings = {} } = {}) {
    this.locale = locale;
    this.fallback = fallback;
    this.strings = strings;
  }

  setLocale(locale) {
    this.locale = locale;
    return this;
  }

  has(locale = this.locale) {
    return !!this.strings[locale];
  }

  t(key, vars = null) {
    const primary = this.strings[this.locale]?.[key];
    const secondary = this.strings[this.fallback]?.[key];
    const raw = primary ?? secondary ?? key;
    if (!vars) return raw;
    return String(raw).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString());
  }

  /** Translates '@key' values in an object (shallow recursion). */
  translateDeep(obj) {
    if (typeof obj === 'string') return obj.startsWith('@') ? this.t(obj.slice(1)) : obj;
    if (Array.isArray(obj)) return obj.map((v) => this.translateDeep(v));
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = this.translateDeep(v);
      return out;
    }
    return obj;
  }
}
