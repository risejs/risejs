/**
 * Real install check: pack → temp folder → tiny Vite project that imports the library → build.
 *
 *   node scripts/check-install.mjs
 *
 * Purpose: catch `exports`/`files` mistakes that unit tests cannot see. No network needed:
 * `three` is linked from the repo's node_modules.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const tmp = mkdtempSync(join(tmpdir(), 'rise-install-'));
const fail = (msg) => {
  console.error('✗ install:', msg);
  cleanup();
  process.exit(1);
};
const cleanup = () => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
};

const sh = (cmd, cwd = tmp) => spawnSync(cmd, { cwd, encoding: 'utf8', shell: true });

// 1) pack
const packDir = join(tmp, 'pack');
mkdirSync(packDir, { recursive: true });
const packed = sh(`npm pack --pack-destination "${packDir}"`, root);
if (packed.status !== 0) fail('npm pack failed: ' + (packed.stderr || packed.stdout).slice(0, 300));
const tgz = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
if (!tgz) fail('no .tgz was created');

// 2) extract
const app = join(tmp, 'app');
mkdirSync(join(app, 'node_modules'), { recursive: true });
const untar = sh(`tar -xzf "${join(packDir, tgz)}" -C "${join(app, 'node_modules')}"`);
if (untar.status !== 0) fail('extraction failed: ' + (untar.stderr || '').slice(0, 300));

const pkgDir = join(app, 'node_modules', 'package');
if (!existsSync(join(pkgDir, 'package.json'))) fail('the tarball has no package.json at its root');
const installed = join(app, 'node_modules', 'risejs-core');
const mv = spawnSync(process.platform === 'win32' ? 'cmd' : 'mv', process.platform === 'win32' ? ['/c', 'move', pkgDir, installed] : [pkgDir, installed], {
  encoding: 'utf8',
});
if (mv.status !== 0) fail('renaming the package failed');

// 3) three from the repo (no network needed)
const threeSrc = join(root, 'node_modules', 'three');
if (!existsSync(threeSrc)) fail('missing node_modules/three in the repo');
try {
  symlinkSync(threeSrc, join(app, 'node_modules', 'three'), 'junction');
} catch {
  // Windows may refuse symlinks → copy instead
  spawnSync('cmd', ['/c', 'xcopy', threeSrc, join(app, 'node_modules', 'three'), '/E', '/I', '/Q'], { encoding: 'utf8' });
}
if (!existsSync(join(app, 'node_modules', 'three', 'package.json'))) fail('could not link three');

// 4) a tiny Vite app that uses several entries: core, packs, shared, CSS, dist
writeFileSync(
  join(app, 'index.html'),
  '<!doctype html><html><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>\n',
  'utf8'
);
writeFileSync(
  join(app, 'main.js'),
  [
    "import { createApp } from 'risejs-core';",
    "import 'risejs-core/style.css';",
    "import { shortHash } from 'risejs-core/packs/contracts/hash';",
    "import { CollisionMap } from 'risejs-core/shared/collision';",
    "import * as THREE from 'three';",
    // Note: this check only proves that importing and bundling work (typeof createApp). A real boot is covered by
    // (createApp → start → frame loop → destroy) do `npm run test:app` (headless, Node)
    // `npm run test:e2e` (Playwright, real browsers), so do not treat this gate as proof that the app runs.
    'const map = new CollisionMap({ boxes: [{ x: 0, z: 0, w: 1, d: 1 }] });',
    "document.getElementById('app').textContent = [typeof createApp, shortHash('x').length, map.size, THREE.REVISION].join(':');",
  ].join('\n'),
  'utf8'
);
writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'rise-install-test', private: true, type: 'module' }, null, 2), 'utf8');

const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(vite)) fail('missing vite in the repo');
const built = spawnSync(process.execPath, [vite, 'build', '--logLevel', 'warn'], { cwd: app, encoding: 'utf8' });
if (built.status !== 0) fail('vite build failed:\n' + (built.stderr || built.stdout).slice(0, 800));

const outDir = join(app, 'dist');
if (!existsSync(outDir)) fail('no dist/ after the build');
const bundles = readdirSync(join(outDir, 'assets')).filter((f) => f.endsWith('.js'));
if (!bundles.length) fail('no JS bundle');

const js = bundles.map((f) => readFileSyncSafe(join(outDir, 'assets', f))).join('');
if (!js.length) fail('the JS bundle is empty');
const css = readdirSync(join(outDir, 'assets')).filter((f) => f.endsWith('.css'));
if (!css.length) fail('no CSS: the "risejs-core/style.css" export could not be bundled');

// 5) Node ESM: exports + files must resolve outside Vite
writeFileSync(
  join(app, 'check.mjs'),
  [
    "const c = await import('risejs-core/shared/collision');",
    "const h = await import('risejs-core/packs/contracts/hash');",
    "if (typeof c.CollisionMap !== 'function') throw new Error('CollisionMap missing');",
    "if (typeof h.shortHash !== 'function') throw new Error('shortHash missing');",
    "if (new c.CollisionMap({ boxes: [{ x: 0, z: 0, w: 1, d: 1 }] }).size !== 1) throw new Error('map size');",
    "console.log('node-ok');",
  ].join('\n'),
  'utf8'
);
const nodeCheck = spawnSync(process.execPath, ['check.mjs'], { cwd: app, encoding: 'utf8' });
if (nodeCheck.status !== 0 || !nodeCheck.stdout.includes('node-ok')) {
  fail('node subpath import failed: ' + (nodeCheck.stderr || nodeCheck.stdout).slice(0, 400));
}

function readFileSyncSafe(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

console.log(`✓ install: tarball ${tgz} → Vite build OK (${bundles.length} bundle, ${Math.round(js.length / 1024)} KB)`);
cleanup();
