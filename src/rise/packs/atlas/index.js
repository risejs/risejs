/**
 * Deterministic shelf atlas packer.
 * Input is sizes and RGBA data only; there is no PNG dependency.
 */
export function packAtlas(images, { maxSize = 2048, padding = 2 } = {}) {
  const items = images
    .map((img) => ({ ...img, width: Math.ceil(img.width), height: Math.ceil(img.height) }))
    .sort((a, b) => b.height - a.height || b.width - a.width || String(a.key).localeCompare(String(b.key)));

  const pages = [];
  let page = newPage(maxSize);
  const gutter = Math.max(0, padding);

  for (const img of items) {
    if (img.width + gutter * 2 > maxSize || img.height + gutter * 2 > maxSize) {
      throw new Error(`[atlas] image "${img.key}" is larger than the ${maxSize} page`);
    }

    let placed = tryPlace(page, img, gutter);
    if (!placed) {
      pages.push(page);
      page = newPage(maxSize);
      placed = tryPlace(page, img, gutter);
    }
    if (!placed) throw new Error(`[atlas] could not place "${img.key}"`);
  }

  if (page.placements.length) pages.push(page);

  // the page uses its actual height (rounded up to a multiple of 4 for textures)
  for (const p of pages) p.height = Math.ceil((p.usedHeight + gutter) / 4) * 4;
  return pages;
}

function newPage(maxSize) {
  return { width: maxSize, height: maxSize, usedHeight: 0, shelves: [], placements: [] };
}

function tryPlace(page, img, gutter) {
  const w = img.width + gutter * 2;
  const h = img.height + gutter * 2;

  for (const shelf of page.shelves) {
    if (shelf.height >= h && shelf.x + w <= page.width) {
      const placement = {
        key: img.key,
        x: shelf.x + gutter,
        y: shelf.y + gutter,
        width: img.width,
        height: img.height,
      };
      page.placements.push(placement);
      shelf.x += w;
      return placement;
    }
  }

  if (page.usedHeight + h <= page.width) {
    const shelf = { y: page.usedHeight, height: h, x: w };
    page.shelves.push(shelf);
    page.usedHeight += h;
    const placement = { key: img.key, x: gutter, y: shelf.y + gutter, width: img.width, height: img.height };
    page.placements.push(placement);
    return placement;
  }

  return null;
}

/** Copies RGBA data into pages; pixels outside any image are 0 (transparent gutter). */
export function composePages(images, pages) {
  const byKey = new Map(images.map((i) => [i.key, i]));
  return pages.map((page) => {
    const out = new Uint8Array(page.width * page.height * 4);
    for (const p of page.placements) {
      const img = byKey.get(p.key);
      if (!img?.rgba) continue;
      for (let y = 0; y < p.height; y++) {
        const srcStart = y * p.width * 4;
        const dstStart = ((p.y + y) * page.width + p.x) * 4;
        out.set(img.rgba.subarray(srcStart, srcStart + p.width * 4), dstStart);
      }
    }
    return { ...page, rgba: out };
  });
}

/** Checks that rects do not overlap and stay inside the page (for tests and CI). */
export function validatePages(pages) {
  const errors = [];
  for (const [i, page] of pages.entries()) {
    for (const p of page.placements) {
      if (p.x < 0 || p.y < 0 || p.x + p.width > page.width || p.y + p.height > page.height) {
        errors.push(`page ${i}: "${p.key}" is out of bounds`);
      }
    }
    for (let a = 0; a < page.placements.length; a++) {
      for (let b = a + 1; b < page.placements.length; b++) {
        const A = page.placements[a];
        const B = page.placements[b];
        if (A.x < B.x + B.width && A.x + A.width > B.x && A.y < B.y + B.height && A.y + A.height > B.y) {
          errors.push(`page ${i}: "${A.key}" overlaps "${B.key}"`);
        }
      }
    }
  }
  return errors;
}
