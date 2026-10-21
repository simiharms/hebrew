import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Emits sw.js with the list of built files to precache, so the app works
// offline right after the first visit.
function serviceWorker(): Plugin {
  return {
    name: 'shoresh-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const statics = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
      const precache = ['./', ...[...files, ...statics].map((f) => `./${f}`)];
      const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const template = readFileSync('src/sw-template.js', 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache)),
      });
    },
  };
}

// The single-file build has no manifest or icon files to link to.
const stripPwaLinks: Plugin = {
  name: 'strip-pwa-links',
  transformIndexHtml: (html) => html.replace(/\s*<link rel="(manifest|apple-touch-icon|icon)"[^>]*>/g, ''),
};

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [preact(), ...(single ? [viteSingleFile(), stripPwaLinks] : [serviceWorker()])],
    define: { __SINGLE__: JSON.stringify(single) },
    publicDir: single ? false : 'public',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2020',
      chunkSizeWarningLimit: 2000,
    },
    test: { include: ['tests/**/*.test.ts'] },
  };
});
