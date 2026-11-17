/**
 * Level format v1, shared by 2D / 2.5D / 3D.
 *
 *   { version:1, game:'city', spawn:[0,0,10], bounds:{min,max},
 *     entities:[{prefab:'box', pos:[x,y,z], size:[w,h,d], rotY:0, tags:[]}],
 *     terrain?:{...}, surfaces?:{...} }
 */
export const LEVEL_VERSION = 1;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

export function validateLevel(level) {
  const errors = [];
  if (!level || typeof level !== 'object' || Array.isArray(level)) {
    return { ok: false, errors: ['level must be an object'] };
  }
  if (level.version !== LEVEL_VERSION) errors.push(`version must be ${LEVEL_VERSION}`);
  if (typeof level.game !== 'string' || !level.game) errors.push('missing game id');
  if (!isVec3(level.spawn)) errors.push('spawn must be [x, y, z]');

  if (level.bounds) {
    if (!isVec3(level.bounds.min) || !isVec3(level.bounds.max)) errors.push('bounds must have min/max as [x,y,z]');
    else if (
      level.bounds.min[0] > level.bounds.max[0] ||
      level.bounds.min[1] > level.bounds.max[1] ||
      level.bounds.min[2] > level.bounds.max[2]
    ) {
      errors.push('bounds.min must be less than bounds.max');
    }
  }

  if (level.entities !== undefined) {
    if (!Array.isArray(level.entities)) errors.push('entities must be an array');
    else {
      level.entities.forEach((e, i) => {
        if (!e || typeof e !== 'object') return errors.push(`entities[${i}] is invalid`);
        if (typeof e.prefab !== 'string' || !e.prefab) errors.push(`entities[${i}].prefab is missing`);
        if (!isVec3(e.pos)) errors.push(`entities[${i}].pos must be [x,y,z]`);
        if (e.size !== undefined && !isVec3(e.size)) errors.push(`entities[${i}].size must be [w,h,d]`);
        if (e.rotY !== undefined && !isNum(e.rotY)) errors.push(`entities[${i}].rotY must be a number`);
        if (e.tags !== undefined && !Array.isArray(e.tags)) errors.push(`entities[${i}].tags must be an array`);
      });
    }
  }

  if (level.terrain !== undefined) {
    if (!isNum(level.terrain.size) || !isNum(level.terrain.res)) errors.push('terrain needs numeric size/res');
    if (typeof level.terrain.heightmap !== 'string') errors.push('terrain needs a heightmap (path)');
  }

  if (level.surfaces !== undefined && typeof level.surfaces.map !== 'string') {
    errors.push('surfaces needs a map (png path)');
  }

  return { ok: errors.length === 0, errors };
}

export function normalizeLevel(level) {
  const out = {
    version: LEVEL_VERSION,
    game: 'unknown',
    spawn: [0, 0, 0],
    bounds: { min: [-100, 0, -100], max: [100, 60, 100] },
    entities: [],
    ...level,
  };
  out.entities = (out.entities || []).map((e) => ({
    prefab: 'box',
    pos: [0, 0, 0],
    size: [1, 1, 1],
    rotY: 0,
    tags: [],
    ...e,
  }));
  return out;
}

export function parseLevel(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: ['invalid JSON: ' + err.message], level: null };
  }
  const check = validateLevel(data);
  return { ...check, level: check.ok ? normalizeLevel(data) : null };
}

/** Applies a level to the app; needs `buildEntity(entity, app)` from the game (prefab registry). */
export function applyLevel(app, level, { buildEntity } = {}) {
  if (typeof buildEntity !== 'function') return 0;
  const lv = normalizeLevel(level);
  let count = 0;
  for (const e of lv.entities) {
    buildEntity(e, app);
    count++;
  }
  return count;
}
