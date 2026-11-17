import { buildEditorWorld } from './world.js';
import { editorPlugin } from '../../rise/packs/editor/index.js';

/**
 * Editor sample game: a 1 m grid yard where you place and delete objects and save JSON to localStorage.
 */
export default {
  id: 'editor',
  title: 'Rise — Editor',

  config: {
    preset: { camera: 'fp', crosshair: 'dot' },
    render: { fog: 0.004, exposure: 1.2 },
    lights: { sun: { position: [-24, 36, 24], intensity: 3.2 } },
    player: { spawn: [0, 0, 16], yaw: 0, walk: 6, run: 9, jump: 4.2 },
    hud: {
      hint: { enabled: true, text: 'E PLACE · Q DELETE · R ROTATE · T SIZE · CTRL+S SAVE · CTRL+O LOAD' },
    },
  },

  hud: {
    kicker: 'LEVEL EDITOR',
    title: 'PLACE OBJECTS',
    sub: '1 m grid · saved to localStorage',
  },

  build(app) {
    const world = buildEditorWorld();
    app.world.setStatic(world.root, world.colliders);
    app.use(editorPlugin, { cell: 1, storageKey: 'rise.editor.demo' });
  },
};
