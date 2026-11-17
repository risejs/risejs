import { Stats, Progression, StatusEffects, xpForLevel } from './core.js';
export { Stats, Progression, StatusEffects, xpForLevel };

/**
 * Stats pack: attributes, XP and status effects.
 *
 *   app.use(statsPlugin);
 *   const hp = new Stats({ vit: 10 });
 */
export function statsPlugin(app) {
  const api = {
    create: (base) => new Stats(base),
    progression: (opts) => new Progression(opts),
    effects: () => new StatusEffects(),
    dispose() {
      if (app.stats === api) app.stats = null;
    },
  };
  app.stats = api;
  return api;
}
