import { openGame } from './serve-test.mjs';
const tr = process.argv[2] || 'mumbai-central'; const extra = process.argv[3] || ''; const tag = process.argv[4] || 'spd';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=medium&timescale=1&laps=3&track=${tr}${extra}`, width: 960, height: 540 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  // fast-forward the race physics until the player is at speed on a straight
  await page.evaluate(() => { const g = window.__chapri; g.race.raceT = 0; g.race.state = 'racing'; g.hud.el.big.hidden = true;
    const R = g.race; for (let i = 0; i < 90 * 14; i++) R.update(1 / 90); g.camInit = false; });
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => { const g = window.__chapri, P = g.race.player; return { kmh: (P.v * 3.6).toFixed(0), fov: g.camera.fov.toFixed(1), lines: g.fx.lines.length, inten: g.fx.intensity.toFixed(2), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, whoosh: g.world.whoosh.length }; });
  console.log('cruise', JSON.stringify(a));
  await page.screenshot({ path: `tools/${tag}_cruise.png`, timeout: 60000 });
  // force a boost to see the kick
  await page.evaluate(() => { const P = window.__chapri.race.player; P.boost = 100; const orig = P.think.bind(P); P.think = (...x) => { orig(...x); P.input.boost = true; }; });
  await page.waitForFunction(() => window.__chapri.fx.fovPunch > 6, null, { timeout: 30000 }).catch(() => {});
  const b = await page.evaluate(() => { const g = window.__chapri, P = g.race.player; return { kmh: (P.v * 3.6).toFixed(0), fov: g.camera.fov.toFixed(1), boosting: P.boosting, punch: g.fx.fovPunch.toFixed(1), lines: g.fx.lines.length }; });
  console.log('boost', JSON.stringify(b));
  await page.screenshot({ path: `tools/${tag}_boost.png`, timeout: 60000 });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
