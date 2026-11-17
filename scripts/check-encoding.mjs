/**
 * Encoding check: every text file must be valid UTF-8 with no U+FFFD and no mojibake.
 * Guards against tools that rewrite files in a legacy code page and corrupt non-ASCII characters.
 *
 * Run: node scripts/check-encoding.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'docs', 'scripts', 'server'];
const EXT = /\.(js|mjs|css|md|json|html|webmanifest|yml|toml)$/;
const SKIP = /node_modules|dist|\.git/;
const BAD = [
  '\uFFFD',
  'â€“',
  'â€”',
  'â€œ',
  'â€\x9d',
  'áº',
  'á»',
  'Ã¡',
  'Ã¢',
  'Ã©',
  'Ã´',
  'Ã¼',
];
const SELF = 'scripts/check-encoding.mjs';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const files = [...ROOTS.flatMap((r) => walk(r)), 'package.json', 'index.html', 'README.md'];
const decoder = new TextDecoder('utf-8', { fatal: true });
const errors = [];

for (const file of files) {
  if (file === SELF) continue;
  let text;
  try {
    text = decoder.decode(readFileSync(file));
  } catch {
    errors.push(`${file}: not valid UTF-8`);
    continue;
  }

  if (text.charCodeAt(0) === 0xfeff) errors.push(`${file}: has a BOM`);

  for (const marker of BAD) {
    if (text.includes(marker)) {
      const line = text.slice(0, text.indexOf(marker)).split('\n').length;
      errors.push(`${file}:${line}: nghi mojibake (${JSON.stringify(marker)})`);
      break;
    }
  }
}

if (errors.length) {
  console.error(`✗ encoding: ${errors.length} files with errors`);
  for (const e of errors.slice(0, 40)) console.error('   ' + e);
  process.exit(1);
}
console.log(`✓ encoding: ${files.length} files are clean UTF-8`);
