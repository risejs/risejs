/** Weighted loot tables with rarity, rolled with a seeded RNG. */

export const RARITY = {
  common: { id: 'common', weight: 60, color: '#cfcfc6', mul: 1 },
  uncommon: { id: 'uncommon', weight: 25, color: '#7fd18b', mul: 1.25 },
  rare: { id: 'rare', weight: 11, color: '#6ab0ff', mul: 1.6 },
  epic: { id: 'epic', weight: 3.5, color: '#c58bff', mul: 2.1 },
  legendary: { id: 'legendary', weight: 0.5, color: '#ffb347', mul: 3 },
};

export function rarityOf(roll = 0) {
  const list = Object.values(RARITY);
  const total = list.reduce((n, r) => n + r.weight, 0);
  let acc = 0;
  const target = roll * total;
  for (const r of list) {
    acc += r.weight;
    if (target < acc) return r;
  }
  return list[0];
}

/**
 * entries: [{ id, weight?, min?, max?, chance?, rarity? }]
 * chance = probability of appearing (0..1), default 1. weight = weight when picking.
 */
export class LootTable {
  constructor(entries = []) {
    this.entries = entries.map((e) => ({ chance: 1, min: 1, max: 1, weight: 10, ...e }));
  }

  /** @returns {{id:string, count:number, rarity:object}[]} */
  roll(rng, { luck = 0, rolls = 1 } = {}) {
    const drops = [];
    for (let i = 0; i < rolls; i++) {
      const hit = rng.weighted(this.entries.map((e) => [e, Math.max(0, e.weight * (1 + luck * (e.rareBonus || 0)))]));
      if (!hit) continue;
      if (rng.float() > Math.min(1, hit.chance + luck * 0.05)) continue;

      const count = rng.int(hit.min, Math.max(hit.min, hit.max));
      const rarity = hit.rarity ? RARITY[hit.rarity] || RARITY.common : rarityOf(rng.float());
      drops.push({ id: hit.id, count, rarity });
    }
    return drops;
  }
}

/** Default table for the demo (city: supply crates). */
export const CRATE_LOOT = new LootTable([
  { id: 'ammo', weight: 40, min: 6, max: 18 },
  { id: 'medkit', weight: 18, min: 1, max: 2, rareBonus: 1 },
  { id: 'scrap', weight: 30, min: 2, max: 7 },
  { id: 'blueprint', weight: 4, min: 1, max: 1, chance: 0.6, rarity: 'rare' },
  { id: 'core', weight: 1, min: 1, max: 1, chance: 0.3, rarity: 'legendary' },
]);
