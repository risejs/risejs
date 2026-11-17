/**
 * Usage: node --import ./scripts/css-stub-register.mjs scripts/test-app.mjs
 * Maps `import './x.css'` to an empty module (Node does not understand CSS).
 */
import { register } from 'node:module';

register('./css-stub-hooks.mjs', import.meta.url);
