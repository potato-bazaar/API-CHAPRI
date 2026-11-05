// Menu + garage at medium with the comic look, plus a forced pop-up word
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?test&q=medium${process.env.EXTRA || ''}`, width: 960, height: 540 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 }); await frames(2);
  await page.screenshot({ path: 'tools/cm_menu.png', timeout: 120000 });
  await page.evaluate(() => { const g = window.__chapri; g.showScreen('garage'); g.ui.garageYaw = 1.2; g.ui.dragT = 1e9; document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); });
  await frames(3);
  await page.evaluate(() => { document.querySelector('#comicLayer').style.animationPlayState = 'paused'; const el = document.createElement('div'); el.className = 'comic-pop'; el.textContent = 'DHISHOOM!'; el.style.left = '30%'; el.style.top = '30%'; el.style.animation = 'none'; el.style.setProperty('--rot', '-8deg'); document.querySelector('#comicLayer').appendChild(el);
    const e2 = el.cloneNode(true); e2.textContent = 'DHADAAM!'; e2.style.left = '72%'; e2.style.top = '62%'; e2.style.setProperty('--fill', '#ff6a3d'); e2.style.setProperty('--rot', '7deg'); document.querySelector('#comicLayer').appendChild(e2); });
  await page.screenshot({ path: 'tools/cm_garage.png', timeout: 120000 });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
