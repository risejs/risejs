import { AudioBus } from '../audio.js';
import { definePlugin } from '../plugin.js';

/** Installs AudioBus on the app. Disable with config.audio.enabled = false. */
export const audioPlugin = definePlugin('audio', (app, options) => {
  app.audio = new AudioBus(options ?? app.config.audio ?? {});
});
