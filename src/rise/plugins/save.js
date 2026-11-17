import { SaveSlot } from '../save.js';
import { definePlugin } from '../plugin.js';

/** Installs a signed SaveSlot on the app. */
export const savePlugin = definePlugin('save', (app, options) => {
  app.save = new SaveSlot({ gameId: app.id, ...(options || {}) });
});
