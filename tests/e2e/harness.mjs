// Shared helpers for the browser end-to-end tests (npm run test:e2e). Every page is served by the real room server
// (server/index.mjs, createServer) from dist/chapri-racer.html. Each player is its own browser context, so each one has
// its own localStorage and sessionStorage, the same as a separate phone or laptop.
import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FONT_DIR = ROOT + 'node_modules/@fontsource/';
const THREE_DIR = ROOT + 'node_modules/three/';

function fontCss() {
  let css = '';
  for (const w of [500, 600, 700, 800]) for (const sub of ['devanagari', 'latin']) css += `@font-face{font-family:'Baloo 2';font-weight:${w};font-style:normal;src:url(https://fonts.gstatic.com/local/baloo-2/baloo-2-${sub}-${w}-normal.woff2) format('woff2');${sub === 'devanagari' ? 'unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF;' : ''}}\n`;
  for (const w of [500, 600, 700]) css += `@font-face{font-family:'Teko';font-weight:${w};font-style:normal;src:url(https://fonts.gstatic.com/local/teko/teko-latin-${w}-normal.woff2) format('woff2');}\n`;
  return css;
}

// Starts the real room server on an ephemeral port. Returns { url, port, close }.
export async function startRoomServer(options = {}) {
  const mod = await import(pathToFileURL(ROOT + 'server/index.mjs').href);
  return mod.createServer({ port: 0, host: '127.0.0.1', quiet: true, ...options });
}

export async function launchChromium() {
  return chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
}

// Maps the CDN and Google Fonts requests to the copies in node_modules (the sandbox has no internet access).
export async function routeExternal(page) {
  const ok = (body, contentType) => ({ body, contentType, headers: { 'access-control-allow-origin': '*' } });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js', (r) =>
    r.fulfill(ok(fs.readFileSync(THREE_DIR + 'build/three.module.min.js'), 'text/javascript')));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/**', (r) => {
    const file = THREE_DIR + 'examples/jsm/' + new URL(r.request().url()).pathname.split('/examples/jsm/')[1];
    r.fulfill(ok(fs.readFileSync(file), 'text/javascript'));
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: fontCss(), contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/local/**', (r) => {
    try {
      const [, , fam, file] = new URL(r.request().url()).pathname.split('/');
      r.fulfill(ok(fs.readFileSync(FONT_DIR + fam + '/files/' + file), 'font/woff2'));
    } catch (e) { r.fulfill({ status: 404, body: '' }); }
  });
}

// One player = one browser context + one page. `errors` collects console errors and uncaught page errors.
export async function openPlayer(browser, baseUrl, { query = '', width = 960, height = 540, mobile = false, name = 'player' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await routeExternal(page);
  await page.goto(baseUrl + '/' + query, { waitUntil: 'domcontentloaded' });
  return { context, page, errors, name, close: () => context.close() };
}

// Waits for a predicate that runs inside the page. Throws a readable error instead of Playwright's raw timeout.
export async function waitUntil(page, predicate, arg, { timeout = 60000, message = 'a condition' } = {}) {
  try {
    await page.waitForFunction(predicate, arg, { timeout, polling: 200 });
  } catch (e) {
    throw new Error(`timed out after ${timeout} ms waiting for ${message}`);
  }
}

// Waits until the game menu is ready (the loader has finished and the menu screen is showing).
export async function waitForMenu(page) {
  await waitUntil(page, () => !!window.__chapri && document.querySelector('#menu') && document.querySelector('#menu').classList.contains('show'),
    null, { timeout: 180000, message: 'the game menu' });
}
