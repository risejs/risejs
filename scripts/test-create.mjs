/**
 * Tests the create-risejs scaffolder: runs the CLI into a temp folder, checks the files, then boots the generated game on the real framework.
 *   node --import ./scripts/css-stub-register.mjs scripts/test-create.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { installDom, fakeRenderer, El } from './dom-stub.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'create-risejs', 'index.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'create-risejs-'));

let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) {
    pass++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    fail++;
    process.stdout.write(`  ✗ ${label}${extra ? '\n    ' + extra : ''}\n`);
  }
};
const run = (args, env = {}) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });

// --- minimal browser stubs (same as test-games.mjs) ---
function sink() {
  const fn = function () {};
  return new Proxy(fn, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k === 'data') return new Uint8ClampedArray(4);
      if (k === 'width' || k === 'height' || k === 'currentTime' || k === 'sampleRate' || k === 'length') return 1;
      if (k === 'state') return 'running';
      if (!(k in t)) t[k] = sink();
      return t[k];
    },
    set: (t, k, v) => ((t[k] = v), true),
    apply: () => sink(),
    construct: () => sink(),
  });
}
El.prototype.getContext = function (kind) {
  return kind === '2d' ? sink() : null;
};
El.prototype.insertAdjacentHTML ??= function () {};
if (!('dataset' in El.prototype)) {
  Object.defineProperty(El.prototype, 'dataset', { get() { return (this._dataset ??= {}); } });
}
El.prototype.toDataURL ??= () => 'data:,';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

async function bootGenerated(app_dir, label) {
  const nm = path.join(app_dir, 'node_modules');
  fs.mkdirSync(nm, { recursive: true });
  fs.symlinkSync(ROOT, path.join(nm, 'risejs-core'), 'junction');
  fs.symlinkSync(path.join(ROOT, 'node_modules', 'three'), path.join(nm, 'three'), 'junction');

  installDom();
  window.AudioContext = function () { return sink(); };
  globalThis.Image ??= class { set src(_v) {} };
  const logged = [];
  const origError = console.error;
  const origLog = console.log;
  console.log = () => {};
  console.error = (...a) => logged.push(a.map((x) => x?.stack || String(x)).join(' '));
  let app = null;
  try {
    const { createApp } = await import('../src/rise/app.js');
    const game = (await import(pathToFileURL(path.join(app_dir, 'src/game/index.js')).href)).default;
    const r = fakeRenderer();
    app = await createApp({ game, renderer: r });
    app.start();
    for (let i = 0; i < 5; i++) r.loop?.(performance.now() + i * 16);
    if (app.interaction) {
      const it = app.interaction.items[0];
      it.onUse();
      if (app.inventory.slots.get('crystal')?.count !== 1) throw new Error('picking up a crystal did not add it to the inventory');
      r.loop?.(performance.now() + 100);
    }
    if (logged.length) throw new Error('console.error:\n      ' + logged.join('\n      '));
    app.destroy();
    ok(true, `${label}: game sinh ra boot + 5 frame + destroy`);
  } catch (err) {
    ok(false, `${label}: game sinh ra boot`, String(err?.stack || err).split('\n').slice(0, 5).join('\n    '));
    try { app?.destroy(); } catch {}
  } finally {
    console.error = origError;
    console.log = origLog;
  }
}

try {
  for (const variant of ['3d', '2d']) {
    const dir = path.join(tmp, `app-${variant}`);
    const r = run([dir, '--yes', '--template', variant]);
    ok(r.status === 0, `${variant}: CLI exit 0`, r.stderr);
    for (const f of ['package.json', 'index.html', 'README.md', '.gitignore', 'src/main.js', 'src/game/index.js']) {
      ok(fs.existsSync(path.join(dir, f)), `${variant}: has ${f}`);
    }
    ok(!fs.existsSync(path.join(dir, '_gitignore')), `${variant}: no _gitignore left`);
    const left = walk(dir).filter((f) => /__NAME__|__TITLE__/.test(fs.readFileSync(f, 'utf8')));
    ok(left.length === 0, `${variant}: no placeholders left`, left.join(', '));
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    ok(pkg.name === `app-${variant}`, `${variant}: package name`, pkg.name);
    ok(pkg.dependencies['risejs-core'] === '0.1.0-alpha.3' && pkg.dependencies.three === '^0.180.0', `${variant}: dependencies`);
    ok(/^\^8\./.test(pkg.devDependencies?.vite || ''), `${variant}: devDependency vite ^8`);
    ok(/Next steps/.test(r.stdout) && /npm install/.test(r.stdout), `${variant}: prints the next steps`);
    await bootGenerated(dir, variant);
  }

  // pnpm detect
  {
    const r = run([path.join(tmp, 'pm'), '--yes'], { npm_config_user_agent: 'pnpm/9.0.0 npm/? node/v22' });
    ok(r.status === 0 && /pnpm install/.test(r.stdout) && /pnpm dev/.test(r.stdout), 'detects pnpm');
  }

  // non-empty directory
  {
    const dir = path.join(tmp, 'busy');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'x.txt'), 'x');
    const r = run([dir, '--yes']);
    ok(r.status === 1 && /not empty/.test(r.stderr), 'refuses a non-empty directory (exit 1)', r.stderr);
    ok(fs.readdirSync(dir).join() === 'x.txt', 'does not overwrite a non-empty directory');
    const empty = path.join(tmp, 'empty');
    fs.mkdirSync(empty);
    ok(run([empty, '--yes']).status === 0, 'accepts an empty directory');
  }

  // template sai, --version, --help
  ok(run([path.join(tmp, 'bad'), '--yes', '-t', '4d']).status === 1, 'invalid template → exit 1');
  {
    const v = run(['--version']);
    const want = JSON.parse(fs.readFileSync(path.join(ROOT, 'create-risejs/package.json'), 'utf8')).version;
    ok(v.status === 0 && v.stdout.trim() === want, '--version', v.stdout);
    const h = run(['--help']);
    ok(h.status === 0 && /--template/.test(h.stdout), '--help');
  }

  // unusual names → valid package name (the accented name is a regression test for non-ASCII paths)
  {
    const cases = [
      ['My Cool Game!', 'my-cool-game'],
      ['Trò Chơi Đẹp', 'tro-choi-dep'],
      ['_Foo__Bar..', 'foo__bar'],
      ['UPPER_case', 'upper_case'],
    ];
    for (const [dirName, want] of cases) {
      const dir = path.join(tmp, 'odd', dirName);
      const r = run([dir, '--yes']);
      const pkgFile = path.join(dir, 'package.json');
      const created = fs.existsSync(pkgFile);
      const pkg = r.status === 0 && created ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : {};
      if (!created) {
        const parent = path.dirname(dir);
        const found = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
        process.stdout.write(`    [debug] status=${r.status} wanted=${JSON.stringify(dirName)} found=${JSON.stringify(found)}\n    stdout=${JSON.stringify(r.stdout)}\n    stderr=${JSON.stringify(r.stderr)}\n`);
      }
      ok(pkg.name === want && /^[a-z0-9][a-z0-9-._]*$/.test(pkg.name || ''), `name "${dirName}" → "${want}"`, `${pkg.name} ${r.stderr}`);
      ok(JSON.stringify(fs.readdirSync(path.join(tmp, 'odd')).filter((n) => /[ÃÆÄ]/.test(n))) === '[]', `"${dirName}": no mis-encoded sibling folder`);
      if (r.status === 0 && created) {
        const g = fs.readFileSync(path.join(dir, 'src/game/index.js'), 'utf8');
        ok(!/__(NAME|TITLE)__/.test(g) && g.includes(`id: '${want}'`), `game id matches "${want}"`);
      }
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
