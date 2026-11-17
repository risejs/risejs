/**
 * Machine-checkable release gates, replacing a self-graded scorecard.
 *
 *   node scripts/release-check.mjs            # run the machine gates and evidence checks, print the status
 *   node scripts/release-check.mjs --tier=r1  # exit 1 if R1 is not met
 *   node scripts/release-check.mjs --json     # machine-readable
 *
 * "Machine gates" actually run (test/build/pack/audit...). "Evidence" is read from
 * release-evidence.json (RISE_EVIDENCE): filled in by a person, dated, expiring after FRESH_DAYS.
 * Principle: no evidence means not met; nothing is scored by feel.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const FRESH_DAYS = 120;
const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const tierArg = (args.find((a) => a.startsWith('--tier=')) || '--tier=none').split('=')[1].toLowerCase();

const run = (cmd, cmdArgs, { shell = false } = {}) => {
  const started = Date.now();
  const res = spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell, maxBuffer: 20 * 1024 * 1024 });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return { ok: res.status === 0, out, ms: Date.now() - started };
};

const node = (script) => run(process.execPath, [script]);
const npx = (cmdArgs) => run('npx', cmdArgs, { shell: process.platform === 'win32' });

const checks = [];
const add = (id, label, ok, detail, ms) => checks.push({ id, label, ok, detail, ms });

// ---- Machine gates ----
const tests = node('scripts/test-core.mjs');
const mTests = tests.out.match(/(\d+) pass, (\d+) fail/);
add('unit', 'Unit test', tests.ok && !!mTests && Number(mTests[2]) === 0, mTests ? `${mTests[1]} pass / ${mTests[2]} fail` : 'could not read the result', tests.ms);

// App lifecycle test, headless in Node (a missing test file fails the gate)
const appTest = run(process.execPath, ['--import', './scripts/css-stub-register.mjs', 'scripts/test-app.mjs']);
const mApp = appTest.out.match(/(\d+) pass, (\d+) fail/);
add(
  'app',
  'Test app headless (lifecycle)',
  existsSync('scripts/test-app.mjs') && appTest.ok && (!mApp || Number(mApp[2]) === 0),
  existsSync('scripts/test-app.mjs') ? (mApp ? `${mApp[1]} pass / ${mApp[2]} fail` : appTest.ok ? 'OK' : 'test:app failed') : 'missing scripts/test-app.mjs',
  appTest.ms
);

const build = npx(['vite', 'build']);
const mBuild = build.out.match(/built in ([\d.]+m?s)/);
add('build', 'Build demo', build.ok, mBuild ? `built in ${mBuild[1]}` : 'build failed', build.ms);

const lib = npx(['vite', 'build', '--config', 'vite.config.lib.js']);
const mLib = lib.out.match(/rise\.js\s+([\d.]+) kB/);
add('lib', 'Build library', lib.ok, mLib ? `rise.js ${mLib[1]} kB` : 'lib build failed', lib.ms);

const api = node('scripts/check-api.mjs');
add('api', 'No breaking API change', api.ok, api.ok ? 'no export removed' : 'an export was removed', api.ms);

const pack = node('scripts/check-package.mjs');
const mPack = pack.out.match(/npm pack: ([\d.]+) MB · (\d+) file/);
add('pack', 'npm packaging', pack.ok, mPack ? `${mPack[1]} MB / ${mPack[2]} file` : 'pack failed', pack.ms);

const install = node('scripts/check-install.mjs');
const mInstall = install.out.match(/tarball (\S+?)\.tgz/);
add('install', 'Install from tarball (Vite build)', install.ok, install.ok ? 'tarball → build OK' : 'install failed', install.ms);

const boundary = node('scripts/check-boundary.mjs');
const mCore = boundary.out.match(/core: ([\d.]+) KB.*?(\d+) file/);
add('boundary', 'Core/pack boundary', boundary.ok, mCore ? `core ${mCore[1]} KB / ${mCore[2]} files` : 'boundary check failed', boundary.ms);

const audit = node('scripts/audit-packs.mjs');
const mHigh = audit.out.match(/high (\d+)/);
add('audit', 'Static audit', audit.ok && mHigh && Number(mHigh[1]) === 0, mHigh ? `high ${mHigh[1]}` : 'audit failed', audit.ms);

const enc = node('scripts/check-encoding.mjs');
const mEnc = enc.out.match(/(\d+) file/);
add('encoding', 'Encoding UTF-8', enc.ok, mEnc ? `${mEnc[1]} files clean` : 'encoding check failed', enc.ms);

const requiredDocs = [
  'docs/install.md',
  'docs/migration.md',
  'docs/troubleshooting.md',
  'docs/api-reference.md',
  'docs/api-stability.md',
  'docs/browser-support.md',
];
const missingDocs = requiredDocs.filter((f) => !existsSync(f));
add('docs', 'Required documents', missingDocs.length === 0, missingDocs.length ? `missing ${missingDocs.join(', ')}` : `${requiredDocs.length} file`);

let pkg = {};
try {
  pkg = JSON.parse(readFileSync('package.json', 'utf8'));
} catch {
  pkg = {};
}
const runtimeDeps = Object.keys(pkg.dependencies || {});
const peerDeps = Object.keys(pkg.peerDependencies || {});
const depsOk = runtimeDeps.length === 0 && peerDeps.length === 1 && peerDeps[0] === 'three';
add(
  'deps',
  'Runtime dependencies: 0 deps, three as the only peer',
  depsOk,
  depsOk ? `0 dependencies · peer: three ${pkg.peerDependencies.three}` : `dependencies: [${runtimeDeps.join(', ')}] · peer: [${peerDeps.join(', ')}]`
);

// ---- Evidence ----
// Evidence is kept outside the repository. Point RISE_EVIDENCE at the file; without it every evidence gate is "missing".
const evidencePath = process.env.RISE_EVIDENCE || '../private/rise-framework/docs-internal/release-evidence.json';
let ev = null;
let evError = null;
try {
  ev = JSON.parse(readFileSync(evidencePath, 'utf8'));
} catch (e) {
  evError = e.message;
}

const days = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : Infinity);
const fresh = (d, limit = FRESH_DAYS) => Number.isFinite(days(d)) && days(d) <= limit;

const browser = Array.isArray(ev?.browserMatrix) ? ev.browserMatrix.filter((b) => b && b.browser && fresh(b.date) && (b.consoleErrors ?? 1) === 0) : [];
const browserNames = [...new Set(browser.map((b) => String(b.browser).toLowerCase()))];
const gamesCovered = [...new Set(browser.flatMap((b) => b.games || []))];
const perf = Array.isArray(ev?.perf) ? ev.perf.filter((p) => p && Number(p.fps) > 0 && fresh(p.date)) : [];

const evidence = [
  {
    id: 'git',
    label: 'Repo git + tag',
    ok: !!(ev?.git?.repo && ev?.git?.tag),
    detail: ev?.git?.repo ? (ev.git.tag || 'not tagged') : 'no repository',
  },
  {
    id: 'browser',
    label: 'Browser matrix (clean console)',
    ok: browser.length >= 1,
    detail: browser.length ? `${browser.length} entries · ${browserNames.join('/')} · ${gamesCovered.length} games` : '0 entries',
  },
  {
    id: 'perf',
    label: 'Measured fps',
    ok: perf.length >= 1,
    detail: perf.length ? `${perf.length} entries · fps ${Math.min(...perf.map((p) => p.fps))}–${Math.max(...perf.map((p) => p.fps))}` : '0 entries',
  },
  {
    id: 'mobile',
    label: 'Real mobile devices (Android/iOS)',
    ok: !!(fresh(ev?.mobile?.android) && fresh(ev?.mobile?.ios)),
    detail: [ev?.mobile?.android ? 'android ✓' : 'android ✗', ev?.mobile?.ios ? 'ios ✓' : 'ios ✗'].join(' · '),
  },
  {
    id: 'pwa',
    label: 'PWA offline',
    ok: !!fresh(ev?.pwaOffline),
    detail: ev?.pwaOffline ? `${days(ev.pwaOffline)} days ago` : 'not checked',
  },
  {
    id: 'license',
    label: 'License audit asset/font',
    ok: !!fresh(ev?.licenseAudit?.date) && (ev?.licenseAudit?.issues || []).length === 0,
    detail: ev?.licenseAudit?.date ? `${(ev.licenseAudit.issues || []).length} issues` : 'not audited',
  },
  {
    id: 'server',
    label: 'Test server (ws/zone/ac)',
    ok: ['ws', 'zone', 'ac'].every((k) => (ev?.serverTests?.passed || []).includes(k)) && fresh(ev?.serverTests?.date, 30),
    detail: ev?.serverTests?.date ? `${(ev.serverTests.passed || []).join('/')} · wrangler ${ev.serverTests.wrangler || '?'}` : 'not recorded',
  },
  {
    id: 'a11y',
    label: 'Accessibility audit',
    ok: !!fresh(ev?.a11y?.date),
    detail: ev?.a11y?.date ? `${days(ev.a11y.date)} days ago` : 'not audited',
  },
];

// ---- Tiers ----
const machineAll = checks.every((c) => c.ok);
const has = (id) => evidence.find((e) => e.id === id)?.ok === true;

const tiers = [
  {
    id: 'R0',
    name: 'Preview (internal)',
    ok: machineAll && has('browser'),
    needs: 'machine gates + 1 browser with a clean console',
  },
  {
    id: 'R1',
    name: 'Public alpha',
    ok:
      machineAll &&
      has('browser') &&
      browser.length >= 3 &&
      ['chrome', 'safari', 'firefox'].every((b) => browserNames.includes(b)) &&
      has('git') &&
      has('perf') &&
      has('license'),
    needs: 'R0 + 3 browser + git/tag + fps + license audit',
  },
  {
    id: 'R2',
    name: 'Beta',
    ok:
      machineAll &&
      has('git') &&
      has('license') &&
      gamesCovered.length >= 9 &&
      has('mobile') &&
      has('pwa') &&
      perf.length >= 2 &&
      has('server') &&
      has('a11y'),
    needs: 'R1 + 9 games × 3 browsers + mobile + PWA + fps on ≥2 machines + a11y',
  },
];

const current = [...tiers].reverse().find((t) => t.ok)?.id || 'not met';
const wanted = tiers.find((t) => t.id.toLowerCase() === tierArg);
const blockers = [
  ...checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`),
  ...evidence.filter((e) => !e.ok).map((e) => `${e.label}: ${e.detail}`),
];

if (jsonOut) {
  console.log(JSON.stringify({ checks, evidence, tiers, current, wanted: wanted?.id || null, blockers }, null, 2));
} else {
  console.log('MACHINE GATES');
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.label.padEnd(30)} ${c.detail}${c.ms ? ` · ${c.ms} ms` : ''}`);
  }
  console.log('\nEVIDENCE (release-evidence.json (RISE_EVIDENCE))');
  if (evError && !ev) console.log(`  ✗ could not read: ${evError}`);
  for (const e of evidence) console.log(`  ${e.ok ? '✓' : '✗'} ${e.label.padEnd(30)} ${e.detail}`);
  console.log('\nRELEASE TIERS');
  for (const t of tiers) console.log(`  ${t.ok ? '✓' : '✗'} ${t.id} ${t.name.padEnd(18)} needs: ${t.needs}`);
  console.log(`\nCurrent: ${current}${wanted ? ` · required ${wanted.id}: ${wanted.ok ? 'MET' : 'NOT MET'}` : ''}`);
  if (blockers.length) {
    console.log('\nStill missing:');
    for (const b of blockers) console.log(`  - ${b}`);
  }
}

if (tierArg !== 'none') process.exit(wanted?.ok ? 0 : 1);
process.exit(0);
