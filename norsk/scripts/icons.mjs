// Renders the app icon (northern lights over a fjord) to PNG with the
// pre-installed Chromium. Run: node scripts/icons.mjs
import { chromium } from 'playwright-core';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#071526"/>
      <stop offset="0.6" stop-color="#123a63"/>
      <stop offset="1" stop-color="#1d5a7a"/>
    </linearGradient>
    <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8affc8" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#5ff2b0" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#2bb38a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="a2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b48cff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#7fd8ff" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#3fd6a0" stop-opacity="0"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <g fill="#ffffff">
    <circle cx="70" cy="70" r="2.4" opacity="0.9"/><circle cx="140" cy="40" r="1.6" opacity="0.7"/>
    <circle cx="430" cy="60" r="2.2" opacity="0.85"/><circle cx="380" cy="120" r="1.4" opacity="0.6"/>
    <circle cx="250" cy="34" r="1.8" opacity="0.8"/><circle cx="470" cy="170" r="1.5" opacity="0.6"/>
    <circle cx="40" cy="170" r="1.4" opacity="0.6"/>
  </g>
  <g filter="url(#blur)">
    <path d="M-20 250 C 80 120, 170 230, 260 140 S 430 60, 540 130 L 540 210 C 430 150, 360 240, 260 220 S 90 220, -20 330 Z" fill="url(#a1)"/>
    <path d="M-20 190 C 90 90, 200 170, 290 100 S 440 40, 540 70 L 540 120 C 450 90, 360 170, 280 160 S 100 170, -20 260 Z" fill="url(#a2)"/>
  </g>
  <path d="M0 360 L 70 300 L 120 330 L 190 250 L 250 310 L 300 280 L 360 330 L 420 270 L 512 340 L 512 512 L 0 512 Z" fill="#0b1f33"/>
  <path d="M190 250 L 172 266 L 186 264 L 196 274 L 206 262 Z M420 270 L 404 284 L 418 282 L 428 290 L 436 282 Z" fill="#e8f1f8" opacity="0.9"/>
  <path d="M0 410 C 120 395, 380 395, 512 410 L 512 512 L 0 512 Z" fill="#0f2c46"/>
  <path d="M60 430 C 180 422, 330 422, 450 430" stroke="#5ff2b0" stroke-opacity="0.35" stroke-width="3" fill="none"/>
</svg>`;

const out = process.argv[2] ?? 'public/icons';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${out}/${name}`, omitBackground: false });
  console.log('wrote', `${out}/${name}`);
}
await browser.close();
