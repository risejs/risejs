import { build2DWorld } from './world.js';
import { sprite2dPlugin, SpriteBatch, SpriteAnimator, atlasUV } from '../../rise/packs/sprite2d/index.js';
import { Tilemap } from '../../rise/packs/tilemap/index.js';
import { editor2dPlugin } from '../../rise/packs/editor2d/index.js';
import { SideController } from '../../rise/packs/sideview/index.js';
import { prefabsPlugin } from '../../rise/packs/prefabs/index.js';
import { applyLevel } from '../../shared/level.js';

/**
 * 2D game: atlas tilemap + tile collision, prefabs from the level format.
 */
export default {
  id: 'game2d',
  title: 'Rise — 2D',

  config: {
    preset: { camera: 'fp', crosshair: 'none' },
    render: { fog: 0.02, exposure: 1.2 },
    lights: { sun: { position: [0, 20, 30], intensity: 2.5 } },
    player: { controller: 'none', spawn: [1, 3] },
    hud: { hint: { enabled: true, text: 'A/D MOVE · SPACE JUMP · P MENU' } },
  },

  hud: {
    kicker: '2D DEMO',
    title: 'REACH THE MARKER',
    sub: 'Tilemap atlas · level JSON · sprite instanced',
  },

  build(app) {
    const world = build2DWorld();
    app.level2d = world;

    app.use(prefabsPlugin);
    app.use(sprite2dPlugin, {
      height: 14,
      follow: () => ctrl.x,
      bounds: { minX: 0, maxX: 120 },
    });

    const editing = ('edit' in app.options);

    const map = new Tilemap({
      texture: world.atlas,
      cols: world.cols,
      rows: world.rows,
      tile: world.tile,
      data: world.data,
      solids: world.solids,
    });

    let built;
    if (editing) {
      app.use(editor2dPlugin, {
        texture: world.atlas,
        cols: world.cols,
        rows: world.rows,
        data: world.data,
        solids: world.solids,
        tile: world.tile,
        storageKey: 'rise.editor2d.demo',
      });
      built = app.editor2d.built;
    } else {
      built = map.build({ chunk: 32 });
      app.scene.add(built.group);
    }
    app.tilemap = { map, ...built };

    // level format v1 → prefab registry
    const level = {
      version: 1,
      game: 'game2d',
      spawn: world.spawn,
      entities: [
        { prefab: 'box', pos: [20, 3.5, 0], size: [1, 1, 1], tags: ['crate'] },
        { prefab: 'box', pos: [52, 3.5, 0], size: [1, 1, 1], tags: ['crate'] },
        { prefab: 'box', pos: [80, 3.5, 0], size: [1, 1, 1], tags: ['crate'] },
      ],
    };
    applyLevel(app, level, {
      buildEntity: (e, a) => a.add(a.prefabs.build(e)),
    });

    const playerSprite = new SpriteBatch({ texture: world.playerTex, capacity: 1 });
    playerSprite.add({ x: 0, y: 1, w: 1, h: 1.5 });
    playerSprite.mesh.renderOrder = 5;
    app.scene.add(playerSprite.mesh);

    const RUN = [0, 1, 2, 3].map((i) => atlasUV(i, 4, 1));
    const IDLE = [RUN[0]];
    const AIR = [RUN[2]];
    const animator = new SpriteAnimator({ frames: IDLE, fps: 8 });
    let animMode = 'idle';

    const ctrl = new SideController({ spawn: world.spawn, speed: 6, jump: 12, gravity: 30 });
    app.sprite2d.ctrl = ctrl;

    app.events.on('frame', (dt) => {
      if (!app.state.is('playing')) return;
      const input = app.input;
      const active = app.editor2d?.built || built;
      ctrl.update(
        dt,
        { down: (a) => input.down(a), justPressed: (a) => input.justPressed(a) },
        active.colliders
      );
      const mode = !ctrl.onGround ? 'air' : Math.abs(ctrl.vx) > 0.4 ? 'run' : 'idle';
      if (mode !== animMode) {
        animMode = mode;
        animator.set(mode === 'run' ? RUN : mode === 'air' ? AIR : IDLE, mode === 'run' ? 10 : 6);
      }
      animator.update(dt);

      playerSprite.setAt(0, {
        x: ctrl.x,
        y: ctrl.y + 0.75,
        w: 1,
        h: 1.5,
        flip: ctrl.facing < 0,
        uv: animator.uv,
      });

      const cam = app.sprite2d.camera;
      built.update(cam.position.x, (cam.right - cam.left) / 2);
      active.update(cam.position.x, (cam.right - cam.left) / 2);
    });

    app.events.on('app:ready', () => {
      const cam = app.sprite2d.camera;
      cam.position.x = ctrl.x;
      cam.lookAt(ctrl.x, 3.5, 0);
    });
  },

  tick(dt, app) {
    if (app.sprite2d?.ctrl && app.sprite2d.ctrl.x > app.level2d.goalX && !app.won2d) {
      app.won2d = true;
      app.setObjective({ title: '2D LEVEL COMPLETE', sub: 'Press P for the menu' });
      app.audio.play('hit');
    }
  },
};
