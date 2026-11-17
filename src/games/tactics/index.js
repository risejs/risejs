import { buildTactics } from './world.js';
import { gridPlugin } from '../../rise/packs/grid/index.js';

/**
 * Turn-based/tactics sample game: a 3 m grid where each step is a turn.
 * Same Rise core, without first-person movement.
 */
export default {
  id: 'tactics',
  title: 'Rise — Tactics',

  config: {
    preset: { camera: 'topdown', crosshair: 'none' },
    render: { fog: 0.006, exposure: 1.25 },
    lights: { sun: { position: [-24, 38, 26], intensity: 3.0 } },
    player: {
      spawn: [0, 0, 6],
      walk: 0,
      run: 0,
      jump: 0,
      crouch: { enabled: false },
      view: { topdown: { height: 26, distance: 7, fov: 50 } },
    },
    hud: { hint: { enabled: true, text: 'WASD MOVE ONE CELL · P MENU' } },
  },

  hud: {
    kicker: 'GRID DEMO',
    title: 'REACH THE GREEN CELL',
    sub: '3 m grid · one turn per step',
  },

  build(app) {
    const world = buildTactics();
    app.world.setStatic(world.root, world.colliders);

    app.use(gridPlugin, {
      cell: world.cell,
      stepTime: 0.18,
      repeat: 0.24,
      min: world.bounds.min,
      max: world.bounds.max,
    });

    app.tactics = { world, reached: false };

    app.events.on('grid:step', () => app.audio.play('ui'));
    app.events.on('grid:blocked', () => app.audio.play('error'));

    // mark the target cell in the HUD
    app.hud.setHint('WASD MOVE ONE CELL · P MENU');
  },

  tick(dt, app) {
    const t = app.tactics;
    if (t.reached) return;
    const { i, j } = app.grid.cell;
    if (i === t.world.goal.i && j === t.world.goal.j) {
      t.reached = true;
      app.setObjective({ title: 'TARGET CELL REACHED', sub: 'The next move is yours' });
      app.hud.setHint('Done · try P for the menu');
      app.audio.play('hit');
      app.events.emit('tactics:reached');
    }
  },
};
