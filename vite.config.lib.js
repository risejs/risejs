import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** Builds the core library: ESM, three is external, CSS included. */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: resolve('src/rise/index.js'),
      formats: ['es'],
      fileName: 'rise',
      cssFileName: 'rise',
    },
    rollupOptions: {
      external: ['three', /^three\//],
    },
  },
});
