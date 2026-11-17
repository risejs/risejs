import { ok, fail } from '../contracts/diagnostics.js';

/** Default coordinate frame: an asset either declares its own or uses this one. */
export const ASSET_FRAME = Object.freeze({ units: 'm', forward: '+X', up: '+Y', right: '+Z' });
export const ASSET_VERSION = 1;
export const COLLIDER_KINDS = ['box', 'capsule', 'hull'];

const AXES = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

export function roleMatches(role, base) {
  if (!role || !base) return false;
  if (role === base) return true;
  return role.startsWith(base + '.') || role.startsWith(base + '/');
}

export function rolesOf(node) {
  const meta = node?.userData?.riseSemantic || null;
  return Array.isArray(meta?.roles) ? meta.roles : [];
}

export function hasRole(node, base) {
  return rolesOf(node).some((r) => roleMatches(r, base));
}

export function findByRole(root, base) {
  const out = [];
  root?.traverse?.((o) => {
    if (hasRole(o, base)) out.push(o);
  });
  return out;
}

/** Minimal manifest validation; returns a Result so the caller decides on a fallback. */
export function validateManifest(m) {
  if (!m || typeof m !== 'object') return fail('asset.manifest-missing', 'rise.asset.json not found');

  const errors = [];
  if (m.version !== ASSET_VERSION) errors.push(`version must be ${ASSET_VERSION}`);
  if (m.frame) {
    if (m.frame.units && m.frame.units !== 'm') errors.push('frame.units must be "m"');
    for (const k of ['forward', 'up', 'right']) {
      if (m.frame[k] && !AXES.includes(m.frame[k])) errors.push(`frame.${k} is invalid`);
    }
  }

  for (const [i, c] of (m.colliders || []).entries()) {
    const kind = c?.shape?.kind;
    if (!COLLIDER_KINDS.includes(kind)) errors.push(`colliders[${i}].shape.kind must be box|capsule|hull`);
    if (kind === 'box' && !Array.isArray(c.shape.size)) errors.push(`colliders[${i}] box is missing size[3]`);
    if (kind === 'capsule' && !(c.shape.radius > 0 && c.shape.height >= c.shape.radius * 2)) {
      errors.push(`colliders[${i}] capsule needs radius>0 and height>=2r`);
    }
    if (kind === 'hull' && !Array.isArray(c.shape.vertices)) errors.push(`colliders[${i}] hull is missing vertices`);
  }

  const lod = m.lod;
  if (lod && (!Array.isArray(lod.screenCoverage) || lod.screenCoverage.some((v) => !(v >= 0 && v <= 1)))) {
    errors.push('lod.screenCoverage must be an array of values in 0..1');
  }

  if (m.budget?.triangles && typeof m.budget.triangles !== 'number' && typeof m.budget.triangles !== 'object') {
    errors.push('budget.triangles must be a number or a record');
  }

  return errors.length ? fail('asset.manifest-invalid', errors.join('; '), { errors }) : ok(m);
}

const IDENTITY = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };

export function collidersOf(manifest) {
  return (manifest?.colliders || []).map((c, i) => ({
    id: c.id || `collider-${i}`,
    role: c.role || 'collider',
    shape: c.shape,
    transform: { ...IDENTITY, ...(c.transform || {}) },
  }));
}

export function anchorsOf(manifest) {
  return (manifest?.anchors || []).map((a, i) => ({
    id: a.id || a.name || `anchor-${i}`,
    role: a.role || 'anchor',
    transform: { ...IDENTITY, ...(a.transform || {}) },
  }));
}

export function portsOf(manifest) {
  return (manifest?.ports || []).map((p, i) => ({
    id: p.id || p.name || `port-${i}`,
    role: p.role || 'kit.port',
    transform: { ...IDENTITY, ...(p.transform || {}) },
  }));
}

/** AABB of a shape after its transform (translation and scale only; rotation is ignored for capsule and hull). */
export function shapeBounds(shape, transform = IDENTITY) {
  const s = transform.scale || [1, 1, 1];
  const t = transform.translation || [0, 0, 0];

  if (shape.kind === 'box') {
    const half = [shape.size[0] / 2, shape.size[1] / 2, shape.size[2] / 2];
    return {
      min: [t[0] - half[0] * Math.abs(s[0]), t[1] - half[1] * Math.abs(s[1]), t[2] - half[2] * Math.abs(s[2])],
      max: [t[0] + half[0] * Math.abs(s[0]), t[1] + half[1] * Math.abs(s[1]), t[2] + half[2] * Math.abs(s[2])],
    };
  }

  if (shape.kind === 'capsule') {
    const r = shape.radius;
    const h = shape.height;
    return {
      min: [t[0] - r * Math.abs(s[0]), t[1], t[2] - r * Math.abs(s[2])],
      max: [t[0] + r * Math.abs(s[0]), t[1] + h * Math.abs(s[1]), t[2] + r * Math.abs(s[2])],
    };
  }

  if (shape.kind === 'hull') {
    const v = shape.vertices || [];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const value = t[k] + v[i + k] * s[k];
        min[k] = Math.min(min[k], value);
        max[k] = Math.max(max[k], value);
      }
    }
    return v.length ? { min, max } : null;
  }

  return null;
}

/** Picks the LOD level from screen coverage (0..1). Levels are descending (for example [0.4, 0.12]); below the last threshold the deepest level is used. */
export function lodIndexFor(coverage, levels = []) {
  for (let i = 0; i < levels.length; i++) if (coverage >= levels[i]) return i;
  return levels.length;
}

/** Advisory budget check: compares measured against declared values and never blocks. */
export function budgetCheck(budget = {}, measured = {}) {
  const tiers = [];
  const declared = budget.triangles;
  if (declared) {
    const map = typeof declared === 'number' ? { LOD0: declared } : declared;
    for (const [tier, limit] of Object.entries(map)) {
      const value = measured.triangles?.[tier] ?? (tier === 'LOD0' ? measured.triangles?.total : undefined);
      if (value == null) continue;
      tiers.push({ tier, declared: limit, measured: value, status: value <= limit ? 'pass' : 'fail' });
    }
  }
  if (budget.draws != null && measured.draws != null) {
    tiers.push({ tier: 'draws', declared: budget.draws, measured: measured.draws, status: measured.draws <= budget.draws ? 'pass' : 'fail' });
  }
  return { status: tiers.every((t) => t.status === 'pass') ? 'pass' : 'fail', tiers };
}
