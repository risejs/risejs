import { createApp } from 'risejs-core';
import 'risejs-core/style.css';
import game from './game/index.js';

// Rise never reads the URL: all configuration lives in code (game/index.js or createApp({ config })).
createApp({ game })
  .then((app) => app.start())
  .catch((err) => {
    console.error(err);
    const box = document.createElement('pre');
    box.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:99;margin:0;padding:12px 16px;' +
      'font:12px/1.5 ui-monospace,monospace;color:#ffb4a8;background:rgba(40,8,4,.92);' +
      'white-space:pre-wrap;max-height:45%;overflow:auto';
    box.textContent = 'The game failed to start:\n\n' + (err?.stack || err);
    document.body.appendChild(box);
  });
