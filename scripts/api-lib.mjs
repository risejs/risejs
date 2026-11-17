import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Extracts the public export names from an ESM file. */
export function exportsOf(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();

  const group = /export\s*\{([^}]+)\}\s*(?:from\s*['"][^'"]+['"])?/g;
  let m;
  while ((m = group.exec(src))) {
    for (const part of m[1].split(',')) {
      const item = part.trim();
      if (!item) continue;
      const alias = item.split(/\s+as\s+/);
      names.add((alias[1] || alias[0]).trim());
    }
  }

  const direct = /export\s+(?:async\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = direct.exec(src))) names.add(m[1]);

  if (/export\s+\*\s+from/.test(src)) names.add('*');

  return [...names].sort();
}

/** The JSDoc right before the first export (one-line summary). */
export function fileSummary(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^export\s/.test(lines[i])) continue;
    for (let j = i - 1; j >= 0 && j > i - 30; j--) {
      if (/^\s*\*\/\s*$/.test(lines[j])) {
        const block = [];
        for (let k = j - 1; k >= 0 && !/\/\*\*/.test(lines[k]); k--) block.unshift(lines[k]);
        const text = block
          .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
          .filter(Boolean)
          .join(' ');
        return text.slice(0, 160);
      }
      if (lines[j].trim() && !/^\s*\*/.test(lines[j]) && !/^\s*\/\*\*/.test(lines[j])) break;
    }
    break;
  }
  return '';
}

/**
 * One-line summary of a pack, taken from its index.js: the first JSDoc block that describes the
 * pack as a whole, otherwise the first JSDoc block in the file. Only the description is kept
 * (the text before the usage example), cut at a sentence boundary when it is long.
 */
export function packSummary(file) {
  const src = readFileSync(file, 'utf8');
  const blocks = [...src.matchAll(/\/\*\*([\s\S]*?)\*\//g)].map((m) => {
    const lines = m[1].split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim());
    while (lines.length && !lines[0]) lines.shift();
    const end = lines.indexOf('');
    return (end < 0 ? lines : lines.slice(0, end)).join(' ').trim();
  }).filter(Boolean);
  if (!blocks.length) return '';
  let text = blocks.find((b) => /\bpack\b/i.test(b.split(/[.:]\s/)[0] + ':')) || blocks[0];
  text = text.split(/\s+(?=app\.use\(|const |await |import |new [A-Z])/)[0].trim();
  if (text.length > 140) {
    const sentence = text.match(/^.*?[.!?](?=\s|$)/);
    text = sentence ? sentence[0] : text.slice(0, 140).replace(/\s+\S*$/, '') + '…';
  }
  return text;
}

export function coreExports(root = 'src/rise') {
  return exportsOf(join(root, 'index.js'));
}

export function packExports(root = 'src/rise/packs') {
  const out = {};
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    const file = join(dir, 'index.js');
    if (existsSync(file)) {
      out[name] = { exports: exportsOf(file), summary: fileSummary(file), path: file.replace(/\\/g, '/') };
      continue;
    }
    // packs without an index (pure libraries): the union of the exports of their .js files
    const names = new Set();
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
      for (const n of exportsOf(join(dir, f))) names.add(n);
    }
    if (names.size) out[name] = { exports: [...names].sort(), summary: '', path: dir.replace(/\\/g, '/') };
  }
  return out;
}

export function currentSurface(apiVersion) {
  return {
    apiVersion,
    core: coreExports(),
    packs: Object.fromEntries(Object.entries(packExports()).map(([k, v]) => [k, v.exports])),
  };
}
