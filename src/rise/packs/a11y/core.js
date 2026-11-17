/**
 * Pure accessibility logic (no DOM): normalises settings and builds the CSS filter.
 */
export const COLORBLIND = {
  none: '',
  protanopia: 'url(#rise-cb-protanopia)',
  deuteranopia: 'url(#rise-cb-deuteranopia)',
  tritanopia: 'url(#rise-cb-tritanopia)',
};

export const A11Y_DEFAULTS = {
  colorblind: 'none',
  uiScale: 1,
  reduceMotion: false,
  highContrast: false,
};

export function resolveA11y(input = {}) {
  const out = { ...A11Y_DEFAULTS, ...input };
  if (!(out.colorblind in COLORBLIND)) out.colorblind = 'none';
  out.uiScale = Math.max(0.75, Math.min(1.6, Number(out.uiScale) || 1));
  out.reduceMotion = !!out.reduceMotion;
  out.highContrast = !!out.highContrast;
  return out;
}

export function a11yCss(settings) {
  const s = resolveA11y(settings);
  return {
    filter: COLORBLIND[s.colorblind] || '',
    uiScale: s.uiScale,
    reduceMotion: s.reduceMotion,
    highContrast: s.highContrast,
  };
}

/** SVG filter defs for three kinds of colour blindness (approximate matrices). */
export const SVG_FILTERS = `
<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">
  <filter id="rise-cb-protanopia"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/></filter>
  <filter id="rise-cb-deuteranopia"><feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/></filter>
  <filter id="rise-cb-tritanopia"><feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0"/></filter>
</svg>`;
