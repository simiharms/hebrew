// Turns the single-file build (dist-single/index.html) into a page body for a
// claude.ai artifact: the host adds its own document skeleton and viewport meta.
// Usage: node scripts/artifact.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/artifact.mjs <out.html>');
let html = readFileSync('dist-single/index.html', 'utf8');
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body>/gi, '')
  .replace(/<meta charset="UTF-8"\s*\/?>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<meta name="(apple-mobile-web-app-[^"]+|mobile-web-app-capable|theme-color)"[^>]*>/gi, '')
  .replace(/<link rel="(manifest|apple-touch-icon|icon)"[^>]*>/gi, '')
  .replace(/(<title>[^<]*<\/title>)/, '$1\n<meta name="claude:viewport-fit-sides" content="cover">');
const titleAt = html.indexOf('<title>');
if (titleAt < 0 || titleAt > 8000) throw new Error('title must be in the first 8KB');
writeFileSync(out, html.replace(/^\s+/, ''));
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
