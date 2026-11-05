import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: '?test&q=low', width: 844, height: 390, mobile: true });
await page.waitForSelector('#menu.show', { timeout: 90000 });
const r = await page.evaluate(() => { window.__chapri.startFromSetup(); return new Promise(res => setTimeout(() => { const q = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; }; res({ ih: innerHeight, iw: innerWidth, vv: visualViewport && visualViewport.height, app: q('#app'), hud: q('#hud'), bottom: q('.hud-bottom'), gas: q('.gas'), pad: q('.action-pad'), speedo: q('.speedo'), fs: getComputedStyle(document.documentElement).fontSize, docH: document.documentElement.scrollHeight }); }, 1500)); });
console.log(JSON.stringify(r));
await browser.close();
