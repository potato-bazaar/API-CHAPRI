// Headless test harness: serves dist/test.html, maps CDN + Google Fonts to local copies, records console errors.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const root = new URL('../', import.meta.url).pathname;   // repo root
const fontDir = root + 'node_modules/@fontsource/';
const fontCss = () => {
  let css = '';
  for (const w of [500, 600, 700, 800]) for (const sub of ['devanagari', 'latin']) css += `@font-face{font-family:'Baloo 2';font-weight:${w};font-style:normal;src:url(https://fonts.gstatic.com/local/baloo-2/baloo-2-${sub}-${w}-normal.woff2) format('woff2');${sub === 'devanagari' ? 'unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF;' : ''}}\n`;
  for (const w of [500, 600, 700]) css += `@font-face{font-family:'Teko';font-weight:${w};font-style:normal;src:url(https://fonts.gstatic.com/local/teko/teko-latin-${w}-normal.woff2) format('woff2');}\n`;
  return css;
};
export async function openGame({ query = '', width = 1280, height = 720, mobile = false, dpr = 1 } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js', r => r.fulfill({ body: fs.readFileSync(root + 'node_modules/three/build/three.module.min.js'), contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/**', r => { const f = root + 'node_modules/three/examples/jsm/' + new URL(r.request().url()).pathname.split('/examples/jsm/')[1]; r.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }); });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: fontCss(), contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/local/**', r => { const u = new URL(r.request().url()); const [, , fam, file] = u.pathname.split('/'); r.fulfill({ body: fs.readFileSync(fontDir + fam + '/files/' + file), contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); });
  await page.route('http://chapri.test/**', r => r.fulfill({ body: fs.readFileSync(root + 'dist/test.html'), contentType: 'text/html' }));
  await page.goto('http://chapri.test/index.html' + query);
  return { browser, page, logs };
}
