import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * Dev-only: receives a PNG/JPEG from the canvas (POST /__shot) and writes it to shots/.
 * Useful for checking the rendered image without depending on a screenshot tool.
 */
function shotSink() {
  return {
    name: 'shot-sink',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const base64 = body.includes(',') ? body.split(',')[1] : body;
            const dir = path.resolve('shots');
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `shot-${Date.now()}.png`);
            fs.writeFileSync(file, Buffer.from(base64, 'base64'));
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, file }));
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [shotSink()],
});
