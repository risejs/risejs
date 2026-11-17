import * as THREE from 'three';

function atlasTexture() {
  const S = 32;
  const c = document.createElement('canvas');
  c.width = 4 * S;
  c.height = 4 * S;
  const ctx = c.getContext('2d');

  const tile = (i, draw) => {
    const x = (i % 4) * S;
    const y = Math.floor(i / 4) * S;
    ctx.save();
    ctx.translate(x, y);
    draw(ctx);
    ctx.restore();
  };

  // 0: grass (top face)
  tile(0, (g) => {
    g.fillStyle = '#2f3a33';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#4a7a4f';
    g.fillRect(0, 0, S, 8);
  });
  // 1: stone
  tile(1, (g) => {
    g.fillStyle = '#4a5560';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#5d6b78';
    g.fillRect(0, 0, S, 6);
  });
  // 2: dirt
  tile(2, (g) => {
    g.fillStyle = '#3a2f26';
    g.fillRect(0, 0, S, S);
  });
  // 3: crate
  tile(3, (g) => {
    g.fillStyle = '#8a5a2b';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#5d3b1c';
    g.lineWidth = 3;
    g.strokeRect(2, 2, S - 4, S - 4);
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

function playerTexture() {
  const F = 32;
  const c = document.createElement('canvas');
  c.width = 4 * F;
  c.height = 48;
  const g = c.getContext('2d');

  for (let f = 0; f < 4; f++) {
    const x = f * F;
    const swing = [0, 3, 0, -3][f];
    g.fillStyle = '#8a5a2b';
    g.fillRect(x + 8, 0, 16, 16);
    g.fillStyle = '#c9a227';
    g.fillRect(x + 10, 6, 12, 4);
    g.fillStyle = '#4a5560';
    g.fillRect(x + 6, 16, 20, 20);
    g.fillStyle = '#2f3a33';
    g.fillRect(x + 6 + swing, 36, 6, 12);
    g.fillRect(x + 20 - swing, 36, 6, 12);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

/** 120×20 cell map, 1 m tiles, 4×4 atlas. */
export function build2DWorld() {
  const W = 120;
  const H = 20;
  const data = Array.from({ length: H }, () => Array(W).fill(-1));

  // dirt base + grass
  for (let c = 0; c < W; c++) {
    data[H - 1][c] = 2;
    data[H - 2][c] = 2;
    data[H - 3][c] = 0;
  }

  // platform: [x, y, w]
  for (const [x, y, w] of [
    [6, 4, 5],
    [16, 6, 4],
    [26, 4, 5],
    [38, 7, 6],
    [50, 5, 4],
    [62, 8, 6],
    [76, 4, 5],
    [88, 6, 6],
  ]) {
    const r = H - 1 - y;
    for (let c = x; c < x + w; c++) if (r >= 0 && r < H) data[r][c] = 1;
  }

  return {
    atlas: atlasTexture(),
    playerTex: playerTexture(),
    data,
    cols: 4,
    rows: 4,
    tile: 1,
    solids: [0, 1, 2],
    goalX: 92,
    spawn: [1, 3],
  };
}
