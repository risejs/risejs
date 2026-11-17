/**
 * Light static audit of the packs and core: risky patterns (XSS, eval, storage, fetch).
 * Warns by default; `--strict` fails when there is a "high" finding.
 *
 * Run: node scripts/audit-packs.mjs [--strict]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src/rise';
const findings = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

function add(level, file, line, rule, text) {
  findings.push({ level, file, line, rule, text: text.trim().slice(0, 140) });
}

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const hasEscape = /function escapeHtml|escapeHtml\(/.test(src);

  lines.forEach((line, i) => {
    const n = i + 1;

    if (/innerHTML\s*=\s*`[^`]*\$\{/.test(line)) {
      const safe = hasEscape && lines.slice(Math.max(0, i - 4), i + 4).join('\n').includes('escapeHtml');
      add(safe ? 'info' : 'review', file, n, 'innerHTML-template', line);
    }

    if (/\beval\s*\(|new\s+Function\s*\(/.test(line)) add('high', file, n, 'eval', line);
    if (/document\.write\s*\(/.test(line)) add('high', file, n, 'document.write', line);
    if (/insertAdjacentHTML\s*\(/.test(line) && !/`[^`]*\$\{/.test(line)) add('info', file, n, 'insertAdjacentHTML-static', line);
    if (/localStorage\.(setItem|getItem)\s*\(/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 8), i + 2).join('\n');
      if (!/try\s*\{/.test(ctx)) add('review', file, n, 'localStorage-no-try', line);
    }
    if (/fetch\s*\(/.test(line) && !/res\.ok|response\.ok|\.ok\b/.test(lines.slice(i, i + 4).join('\n'))) {
      add('review', file, n, 'fetch-no-ok-check', line);
    }
  });

  if (/createElement\('video'\)/.test(src) && !/crossOrigin/.test(src)) {
    add('review', file, 0, 'video-crossorigin', 'video without crossOrigin');
  }
}

const order = { high: 0, review: 1, info: 2 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file));

const counts = findings.reduce((acc, f) => ((acc[f.level] = (acc[f.level] || 0) + 1), acc), {});
for (const f of findings) {
  const icon = f.level === 'high' ? '✗' : f.level === 'review' ? '!' : '·';
  console.log(`${icon} ${f.level.toUpperCase().padEnd(6)} ${relative('.', f.file)}:${f.line}  ${f.rule}  ${f.text}`);
}
console.log(
  `\ntotal: ${findings.length} findings (high ${counts.high || 0}, review ${counts.review || 0}, info ${counts.info || 0})`
);

if (process.argv.includes('--strict') && (counts.high || 0) > 0) process.exit(1);
