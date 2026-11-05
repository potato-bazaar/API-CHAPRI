// Gameplay look: real chase cam mid-race (HUD on), given track / time / weather / quality. Usage: node t32.mjs tag track time weather [ff seconds]
import { openGame } from './serve-test.mjs';
const [tag = 'look', tr = 'mumbai-central', time = 'golden', wx = 'monsoon', ff = '14'] = process.argv.slice(2);
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${process.env.Q || 'medium'}&timescale=1&laps=3&track=${tr}&time=${time}&weather=${wx}${process.env.EXTRA || ''}`, width: +(process.env.W || 960), height: +(process.env.H || 540) });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 180000, polling: 200 }); };
try {
  await page.waitForSelector('#hud.show', { timeout: 120000 });
  for (const [i, sec] of String(ff).split(',').entries()) {
    await page.evaluate((sec) => { const g = window.__chapri, R = g.race; if (R.state !== 'racing') { R.raceT = 0; R.state = 'racing'; } for (let i = 0; i < 90 * sec; i++) R.update(1 / 90); g.camInit = false; }, +sec);
    await frames(4);
    const st = await page.evaluate(() => { const g = window.__chapri, P = g.race.player, ri = g.renderer.info; return { s: Math.round(P.s), kmh: (P.v * 3.6).toFixed(0), calls: ri.render.calls, tris: ri.render.triangles }; });
    console.log(tag, i, JSON.stringify(st)); await page.screenshot({ path: `tools/${tag}_${i}.png`, timeout: 180000 });
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
