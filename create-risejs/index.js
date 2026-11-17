#!/usr/bin/env node
// create-risejs: scaffolds a Rise.js game project. Uses Node built-in modules only.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = ['3d', '2d'];
const DEFAULT_DIR = 'my-game';
const TEXT_FILES = ['package.json', 'index.html', 'README.md', 'src/game/index.js'];

const pkgVersion = () => JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version;

const HELP = `create-risejs ${pkgVersion()}

Usage:
  npm create risejs@latest [directory] [-- --template 3d|2d] [--yes]
  create-risejs [directory] [--template 3d|2d] [--yes]

Options:
  -t, --template <3d|2d>  game template (default: 3d)
  -y, --yes               skip prompts and use the defaults
  -h, --help              show help
  -v, --version           show version

Web: https://risejs.dev
`;

class CliError extends Error {}

export function parseArgs(argv) {
  const o = { dir: null, template: null, yes: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-v' || a === '--version') o.version = true;
    else if (a === '-y' || a === '--yes') o.yes = true;
    else if (a === '-t' || a === '--template') {
      if (i + 1 >= argv.length) throw new CliError('Missing value for --template (3d or 2d).');
      o.template = argv[++i];
    } else if (a.startsWith('--template=')) o.template = a.slice('--template='.length);
    else if (a.startsWith('-') && a !== '-') throw new CliError(`Unknown option: ${a} (see --help).`);
    else if (o.dir === null) o.dir = a;
    else throw new CliError(`Unexpected argument: ${a}.`);
  }
  if (o.template !== null && !TEMPLATES.includes(o.template)) {
    throw new CliError(`Invalid template: "${o.template}". Choose 3d or 2d.`);
  }
  return o;
}

/** Directory name -> valid npm package name (lowercase, digits, '-', '.', '_'). */
export function toPackageName(input) {
  const name = String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-._]/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-{2,}/g, '-')
    .replace(/[-.]+$/, '')
    .slice(0, 214);
  return name || DEFAULT_DIR;
}

/** Display name: strips characters unsafe for HTML/JS and capitalises each word. */
export function toTitle(input) {
  const words = String(input)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));
  return words.join(' ') || 'My Game';
}

function detectPm() {
  const ua = process.env.npm_config_user_agent || '';
  const name = ua.split(' ')[0].split('/')[0];
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(name) ? name : 'npm';
}

function isEmptyDir(dir) {
  return fs.readdirSync(dir).length === 0;
}

// Not fs.cpSync: on Windows some Node 22 releases write to a mis-encoded path when the
// destination contains non-ASCII characters. mkdirSync/copyFileSync handle those paths correctly.
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function copyTemplate(template, target) {
  copyDir(path.join(HERE, 'template', 'base'), target);
  copyDir(path.join(HERE, 'template', template), target);
  if (!fs.existsSync(path.join(target, 'package.json'))) {
    throw new CliError(`Could not copy the template into "${target}".`);
  }
  const ig = path.join(target, '_gitignore');
  if (fs.existsSync(ig)) fs.renameSync(ig, path.join(target, '.gitignore'));
}

function fillPlaceholders(target, name, title) {
  for (const rel of TEXT_FILES) {
    const file = path.join(target, rel);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8').replaceAll('__NAME__', name).replaceAll('__TITLE__', title);
    fs.writeFileSync(file, text, 'utf8');
  }
}

export async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) return console.log(HELP);
  if (opts.version) return console.log(pkgVersion());

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !opts.yes;
  let { dir, template } = opts;

  if (interactive && (dir === null || template === null)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (dir === null) dir = (await rl.question(`Project name (${DEFAULT_DIR}): `)).trim() || DEFAULT_DIR;
      if (template === null) {
        const t = (await rl.question('Template, 3d or 2d (3d): ')).trim().toLowerCase() || '3d';
        if (!TEMPLATES.includes(t)) throw new CliError(`Invalid template: "${t}". Choose 3d or 2d.`);
        template = t;
      }
    } finally {
      rl.close();
    }
  }
  dir ??= DEFAULT_DIR;
  template ??= '3d';

  const target = path.resolve(process.cwd(), dir);
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) throw new CliError(`"${dir}" is a file, not a directory.`);
    if (!isEmptyDir(target)) throw new CliError(`Directory "${dir}" is not empty. Choose another name or empty it first.`);
  }

  const base = path.basename(target);
  const name = toPackageName(base);
  const title = toTitle(base);

  copyTemplate(template, target);
  fillPlaceholders(target, name, title);

  const pm = detectPm();
  const install = pm === 'npm' ? 'npm install' : `${pm} install`;
  const dev = pm === 'npm' || pm === 'bun' ? `${pm} run dev` : `${pm} dev`;
  const rel = path.relative(process.cwd(), target);

  console.log(`\nCreated "${name}" (${template} template) in ${target}\n`);
  console.log('Next steps:');
  if (rel) console.log(`  cd ${rel.includes(' ') ? `"${rel}"` : rel}`);
  console.log(`  ${install}`);
  console.log(`  ${dev}\n`);
  console.log('Docs: https://risejs.dev');
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`Error: ${err instanceof CliError ? err.message : err?.message || err}`);
    process.exit(1);
  });
}
