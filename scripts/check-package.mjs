import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const errors = [];
const warnings = [];

// 1. required metadata
for (const key of ['name', 'version', 'license', 'type', 'exports', 'files']) {
  if (!pkg[key]) errors.push(`missing "${key}" in package.json`);
}
if (pkg.private) errors.push('"private": true, so it cannot be published');

// 1b. three must be the only peerDependency, with no runtime dependencies
// (so a consumer never ends up with two copies of three, which breaks instanceof)
if (Object.keys(pkg.dependencies || {}).length) {
  errors.push(`"dependencies" must be empty, found: ${Object.keys(pkg.dependencies).join(', ')}`);
}
const peers = Object.keys(pkg.peerDependencies || {});
if (peers.length !== 1 || peers[0] !== 'three') {
  errors.push(`"peerDependencies" must contain exactly "three", found: ${peers.join(', ') || '(empty)'}`);
}

// 2. exports point at files that exist (patterns with * are skipped)
const targets = [];
for (const [subpath, target] of Object.entries(pkg.exports || {})) {
  if (typeof target === 'string' && !target.includes('*')) targets.push([subpath, target]);
}
for (const [subpath, target] of targets) {
  if (!existsSync(target)) errors.push(`exports["${subpath}"] points at ${target}, which does not exist`);
}

// 3. files exist
for (const entry of pkg.files || []) {
  if (entry.includes('*') || entry.startsWith('!')) continue;
  if (!existsSync(entry)) errors.push(`files lists "${entry}", which does not exist`);
}

// 4. LICENSE/NOTICE/CHANGELOG
for (const f of ['LICENSE', 'NOTICE', 'CHANGELOG.md']) {
  if (!existsSync(f)) errors.push(`missing ${f}`);
}

// 5. npm pack: size and files
const npmArgs = ['pack', '--dry-run', '--json'];
const res =
  process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npm', ...npmArgs], { encoding: 'utf8' })
    : spawnSync('npm', npmArgs, { encoding: 'utf8' });
if (res.status !== 0) {
  errors.push(`npm pack --dry-run failed: ${(res.stderr || '').slice(0, 300)}`);
} else {
  let info;
  try {
    const parsed = JSON.parse(res.stdout);
    info = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    errors.push('could not read the npm pack JSON');
  }
  if (info) {
    const size = info.size ?? info.unpackedSize ?? 0;
    const count = info.entryCount ?? info.files?.length ?? 0;
    console.log(`npm pack: ${(size / 1024 / 1024).toFixed(2)} MB · ${count} file`);
    if (size > 3 * 1024 * 1024) errors.push(`tarball ${(size / 1024 / 1024).toFixed(2)} MB > 3 MB`);
    if (count > 400) warnings.push(`the tarball has ${count} files: check "files"`);
    const names = (info.files || []).map((f) => f.path || f.name || '');
    if (!names.some((n) => n.startsWith('src/rise/'))) errors.push('the tarball is missing src/rise');
    if (names.some((n) => n.startsWith('dist/'))) errors.push('the tarball contains the dist/ of the demo app: remove it from files');
    if (names.some((n) => n.includes('node_modules'))) errors.push('the tarball contains node_modules');
    if (names.some((n) => n.startsWith('research/') || n.startsWith('docs/internal/') || n.startsWith('docs/research/'))) errors.push('the tarball contains internal documents (docs/internal, research): exclude them from "files"');
  }
}

// 6. can the entry be imported? (syntax check only, no browser APIs are run)
try {
  const entry = pkg.exports?.['.'];
  if (typeof entry === 'string') {
    const src = readFileSync(entry, 'utf8');
    if (!src.includes('createApp')) errors.push(`${entry} does not export createApp`);
  }
} catch (err) {
  errors.push(`could not read the entry: ${err.message}`);
}

for (const w of warnings) console.warn(`! ${w}`);
if (errors.length) {
  console.error(`✗ package: ${errors.length} errors`);
  for (const e of errors) console.error('   ' + e);
  process.exit(1);
}
console.log('✓ package: metadata + exports + files + tarball OK');
