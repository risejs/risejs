/**
 * Checks the core ↔ packs boundary.
 *
 * Hard rules (fail CI):
 *  1. The core does NOT statically import from `packs/` (dynamic import of lazy packs is allowed).
 *  2. Packs may import other packs, but the graph must be acyclic.
 *  3. Every core file must state its reason in `scripts/core-manifest.json`.
 *
 * Budgets are **guidelines**, not gates:
 *  - guideline: core 85 KB, pack 16 KB
 *  - warning:   over the guideline
 *  - fails only above the **hard ceilings**: core 100 KB, pack 24 KB
 * Reason: cutting a pack or feature just to fit a number trades quality in the wrong place.
 *
 * Run: node scripts/check-boundary.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src/rise';
const PACKS = join(ROOT, 'packs');
const CORE_ADVISORY = 85 * 1024;
const CORE_HARD = 100 * 1024;
const PACK_ADVISORY = 16 * 1024;
const PACK_HARD = 24 * 1024;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push({ path: p.replace(/\\/g, '/'), size: st.size });
  }
  return out;
}

const staticRe = /^\s*(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/gm;
const bareRe = /^\s*import\s+['"]([^'"]+)['"]/gm;

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  for (const re of [staticRe, bareRe]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) out.push(m[1]);
  }
  return out;
}

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = join(fromFile, '..', spec).replace(/\\/g, '/');
  return base.endsWith('.js') ? base : `${base}.js`;
}

const all = walk(ROOT);
const coreFiles = all.filter((f) => !f.path.startsWith(`${PACKS.replace(/\\/g, '/')}/`));
const packFiles = all.filter((f) => f.path.startsWith(`${PACKS.replace(/\\/g, '/')}/`));

let fail = 0;

// 1. core → packs (static)
const leaks = [];
for (const f of coreFiles) {
  for (const spec of importsOf(f.path)) {
    const target = resolveSpec(f.path, spec);
    if (target && target.includes('/packs/')) leaks.push(`${f.path} → ${spec}`);
  }
}
if (leaks.length) {
  console.error(`✗ core imports a pack (${leaks.length}):`);
  for (const l of leaks) console.error('   ' + l);
  fail++;
} else {
  console.log('✓ boundary: the core does not statically import from packs');
}

// 2. cycles between packs
const graph = new Map();
for (const f of packFiles) {
  const pack = relative(PACKS, f.path).split(/[\\/]/)[0];
  if (!graph.has(pack)) graph.set(pack, new Set());
  for (const spec of importsOf(f.path)) {
    const target = resolveSpec(f.path, spec);
    if (!target || !target.includes('/packs/')) continue;
    const to = relative(PACKS, target).split(/[\\/]/)[0];
    if (to !== pack) graph.get(pack).add(to);
  }
}

const cycles = [];
const state = new Map();
function dfs(node, stack) {
  if (state.get(node) === 'done') return;
  if (state.get(node) === 'open') {
    cycles.push([...stack.slice(stack.indexOf(node)), node].join(' → '));
    return;
  }
  state.set(node, 'open');
  for (const next of graph.get(node) || []) dfs(next, [...stack, node]);
  state.set(node, 'done');
}
for (const node of graph.keys()) dfs(node, []);
if (cycles.length) {
  console.error(`✗ pack cycles (${cycles.length}):`);
  for (const c of cycles) console.error('   ' + c);
  fail++;
} else {
  console.log(`✓ boundary: ${graph.size} packs, no cycles`);
}

// 3. budgets
const coreSize = coreFiles.reduce((n, f) => n + f.size, 0);
const packs = new Map();
for (const f of packFiles) {
  const pack = relative(PACKS, f.path).split(/[\\/]/)[0];
  packs.set(pack, (packs.get(pack) || 0) + f.size);
}

const biggest = [...packs].sort((a, b) => b[1] - a[1]).slice(0, 5);
const coreState = coreSize > CORE_HARD ? 'hard' : coreSize > CORE_ADVISORY ? 'warn' : 'ok';
const mark = { ok: '✓', warn: '!', hard: '✗' }[coreState];
console.log(`\n${mark} core: ${(coreSize / 1024).toFixed(1)} KB (guideline 85, ceiling 100) · ${coreFiles.length} files`);
console.log(`packs: ${packs.size} packs, ${(packFiles.reduce((n, f) => n + f.size, 0) / 1024).toFixed(1)} KB total`);
console.log('largest: ' + biggest.map(([n, s]) => `${n} ${(s / 1024).toFixed(1)}`).join(' · '));

if (coreState === 'hard') {
  console.error(`✗ core is ${((coreSize - CORE_HARD) / 1024).toFixed(1)} KB over the hard ceiling`);
  fail++;
} else if (coreState === 'warn') {
  console.warn(`! core is ${((coreSize - CORE_ADVISORY) / 1024).toFixed(1)} KB over the guideline: consider splitting out a pack (not blocking)`);
}

const overAdvisory = [];
for (const [name, size] of packs) {
  if (size > PACK_HARD) {
    console.error(`✗ pack ${name} is ${((size - PACK_HARD) / 1024).toFixed(1)} KB over the hard ceiling`);
    fail++;
  } else if (size > PACK_ADVISORY) {
    overAdvisory.push(`${name} ${(size / 1024).toFixed(1)}KB`);
  }
}
if (overAdvisory.length) {
  console.warn(`! packs over the 16 KB guideline (not blocking): ${overAdvisory.join(', ')}`);
}
if (!overAdvisory.length) console.log('✓ packs: all within the 16 KB guideline');

// 4. manifest: every core file must state why it belongs in the core
let manifest = {};
try {
  manifest = JSON.parse(readFileSync('scripts/core-manifest.json', 'utf8'));
} catch {
  console.error('✗ missing scripts/core-manifest.json');
  fail++;
}

const declared = new Map(Object.entries(manifest).filter(([k]) => !k.startsWith('_')));
const missing = coreFiles
  .map((f) => relative(ROOT, f.path).replace(/\\/g, '/'))
  .filter((name) => !declared.has(name));
const stale = [...declared.keys()].filter((name) => !coreFiles.some((f) => relative(ROOT, f.path).replace(/\\/g, '/') === name));

if (missing.length) {
  console.error(`✗ core files with no stated reason (${missing.length}): ${missing.join(', ')}`);
  console.error('   → add them to scripts/core-manifest.json with a one-sentence reason, or move them to packs/');
  fail++;
} else {
  console.log(`✓ manifest: all ${declared.size} core files have a reason`);
}
if (stale.length) {
  console.error(`✗ manifest has stale entries (${stale.length}): ${stale.join(', ')}`);
  fail++;
}

if (fail) process.exit(1);
console.log('\nboundary OK (budgets are guidelines)');
