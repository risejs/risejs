/** Pure preload logic: normalises the list and computes progress. */
export function classify(url = '') {
  const clean = String(url).split('?')[0];
  if (/\.(glb|gltf)$/i.test(clean)) return 'gltf';
  if (/\.(png|jpe?g|webp|ktx2|hdr)$/i.test(clean)) return 'texture';
  if (/\.(mp3|ogg|wav|m4a)$/i.test(clean)) return 'audio';
  if (/\.(json|txt|vtt|m3u8)$/i.test(clean)) return 'text';
  return 'binary';
}

export function normalizeList(list = [], base = '') {
  return list.map((entry) => {
    if (typeof entry === 'string') return { url: base + entry, type: classify(entry) };
    return { type: classify(entry.url), ...entry, url: base + (entry.url || '') };
  });
}

export function progressOf(done = 0, total = 0, weights = null) {
  if (!total) return 1;
  if (!weights) return Math.max(0, Math.min(1, done / total));
  const sum = weights.reduce((n, w) => n + w, 0) || 1;
  const acc = weights.slice(0, done).reduce((n, w) => n + w, 0);
  return Math.max(0, Math.min(1, acc / sum));
}
