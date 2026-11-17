import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { currentSurface } from './api-lib.mjs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const versionFile = readFileSync('src/rise/version.js', 'utf8');
const apiVersion = Number(versionFile.match(/API_VERSION\s*=\s*(\d+)/)?.[1] || 1);

const surface = currentSurface(apiVersion);
surface.package = pkg.name;
surface.version = pkg.version;

const text = JSON.stringify(surface, null, 2) + '\n';
const file = 'scripts/api-surface.json';

if (process.argv.includes('--write')) {
  writeFileSync(file, text);
  console.log(`wrote ${file}: core ${surface.core.length} export · ${Object.keys(surface.packs).length} pack`);
} else if (process.argv.includes('--check')) {
  if (!existsSync(file)) {
    console.error(`✗ missing ${file}: run npm run api:surface -- --write`);
    process.exit(1);
  }
  const prev = JSON.parse(readFileSync(file, 'utf8'));
  const removedCore = prev.core.filter((n) => !surface.core.includes(n));
  const removedPacks = [];
  for (const [pack, names] of Object.entries(prev.packs || {})) {
    const now = surface.packs[pack];
    if (!now) {
      removedPacks.push(`${pack} (whole pack)`);
      continue;
    }
    for (const n of names) if (!now.includes(n)) removedPacks.push(`${pack}:${n}`);
  }
  if (prev.apiVersion !== apiVersion) {
    console.error(`✗ API_VERSION changed ${prev.apiVersion} → ${apiVersion}: update the snapshot and CHANGELOG`);
    process.exit(1);
  }
  if (removedCore.length || removedPacks.length) {
    console.error('✗ API removed (breaking):');
    for (const n of removedCore) console.error(`   core: ${n}`);
    for (const n of removedPacks) console.error(`   pack: ${n}`);
    console.error('   → if intentional, bump API_VERSION, record it in CHANGELOG and update the snapshot');
    process.exit(1);
  }
  const addedCore = surface.core.filter((n) => !prev.core.includes(n));
  const addedPacks = [];
  for (const [pack, names] of Object.entries(surface.packs)) {
    const before = prev.packs?.[pack] || [];
    for (const n of names) if (!before.includes(n)) addedPacks.push(`${pack}:${n}`);
  }
  if (addedCore.length || addedPacks.length) {
    console.log(`+ API added: core ${addedCore.length}, packs ${addedPacks.length}. Run api:surface --write to update`);
    for (const n of addedCore.slice(0, 10)) console.log(`   + core: ${n}`);
  }
  console.log('✓ API: no export removed');
} else {
  console.log(text);
}
