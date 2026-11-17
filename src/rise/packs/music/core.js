/** Background music: chords, fades and ducking. The pure part, for tests. */
export const MOODS = {
  calm: { root: 110, notes: [0, 7, 12, 19], cutoff: 900, gain: 0.12, lfo: 0.08 },
  tense: { root: 98, notes: [0, 6, 12, 18], cutoff: 1400, gain: 0.14, lfo: 0.22 },
  dark: { root: 82.4, notes: [0, 3, 10, 15], cutoff: 620, gain: 0.13, lfo: 0.05 },
  victory: { root: 130.8, notes: [0, 4, 7, 12], cutoff: 2200, gain: 0.15, lfo: 0.3 },
};

/** Note frequencies of a chord (semitones from the root). */
export function chordFreqs(root, semitones = [0, 7, 12]) {
  return semitones.map((s) => root * Math.pow(2, s / 12));
}

/** Equal-power crossfade: t 0..1 → [outGain, inGain]. */
export function crossfade(t) {
  const k = Math.max(0, Math.min(1, t));
  return [Math.cos((k * Math.PI) / 2), Math.sin((k * Math.PI) / 2)];
}

/** Gain factor used to duck the music under dialogue or a menu. */
export function duckGain(ducked, amount = 0.35, t = 1) {
  const target = ducked ? amount : 1;
  return 1 + (target - 1) * Math.max(0, Math.min(1, t));
}

export function moodOf(name = 'calm') {
  return MOODS[name] || MOODS.calm;
}
