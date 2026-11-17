/** Day–night cycle and weather. Pure. */
export const PRESETS = {
  dawn: { sunY: 6, sunIntensity: 1.4, ambient: 0.45, fog: 0x27303a, fogDensity: 0.009, sky: 0x1b2430 },
  noon: { sunY: 60, sunIntensity: 3.6, ambient: 0.7, fog: 0x8a9aa8, fogDensity: 0.005, sky: 0x33414d },
  dusk: { sunY: 8, sunIntensity: 2.0, ambient: 0.5, fog: 0x3a2a26, fogDensity: 0.008, sky: 0x2a1f22 },
  night: { sunY: -20, sunIntensity: 0.25, ambient: 0.18, fog: 0x0b1017, fogDensity: 0.014, sky: 0x070a0f },
};

const ORDER = ['dawn', 'noon', 'dusk', 'night'];

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** time 0..1 cycles through dawn→noon→dusk→night→dawn */
export function dayCycle(time = 0.25) {
  const t = ((time % 1) + 1) % 1;
  const scaled = t * 4;
  const i = Math.floor(scaled) % 4;
  const k = scaled - Math.floor(scaled);
  const a = PRESETS[ORDER[i]];
  const b = PRESETS[ORDER[(i + 1) % 4]];

  return {
    sunY: a.sunY + (b.sunY - a.sunY) * k,
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k,
    ambient: a.ambient + (b.ambient - a.ambient) * k,
    fog: lerpColor(a.fog, b.fog, k),
    fogDensity: a.fogDensity + (b.fogDensity - a.fogDensity) * k,
    sky: lerpColor(a.sky, b.sky, k),
    phase: ORDER[i],
    next: ORDER[(i + 1) % 4],
    k,
  };
}

/** Blends two sets of weather parameters. */
export function blendWeather(a, b, t) {
  const out = {};
  for (const key of Object.keys(a)) {
    out[key] = typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * t : t < 0.5 ? a[key] : b[key];
  }
  return out;
}
