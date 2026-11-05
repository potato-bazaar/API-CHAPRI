// Police Express+ gameplay shots at set points: start, naka approach (laser), stairs, water, boost. HUD on.
import { openGame } from './serve-test.mjs';
const tag = process.argv[2] || 'pe';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${process.env.Q || 'medium'}&mode=police&nobust&timescale=1`, width: +(process.env.W || 960), height: +(process.env.H || 540) });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 180000, polling: 200 }); };
try {
  await page.waitForSelector('#hud.show', { timeout: 120000 });
  const pts = await page.evaluate(() => { const T = window.__chapri.track; const n = T.nakas.slice().sort((a, b) => a.s - b.s)[0];
    return [['start', 25], ['naka', n.s - 34], ['stairs', T.stairs.s0 + 16], ['top', T.stairs.s0 + T.stairs.up + 8], ['water', T.nala.s0 + 14], ['boost', T.nala.s0 + 120]]; });
  for (const [n, target] of pts) {
    await page.evaluate(([target, boost]) => { const g = window.__chapri, R = g.race, P = R.player; if (R.state !== 'racing') { R.raceT = 0; R.state = 'racing'; }
      let k = 0; while (k++ < 90 * 200 && !(P.s > target && P.s < target + 6 && !P.crashed)) R.update(1 / 90);
      if (boost) { P.boost = 100; const th = P.think.bind(P); P.think = function (...a) { th(...a); this.input.boost = true; }; for (let i = 0; i < 40; i++) R.update(1 / 90); }
      g.camInit = false; }, [target, n === 'boost']);
    await frames(4);
    const st = await page.evaluate(() => { const g = window.__chapri, P = g.race.player, PO = g.race.police; return { s: Math.round(P.s), kmh: Math.round(P.v * 3.6), heat: PO && Math.round(PO.heat), cop: PO && Math.round(PO.copDist), aiming: PO && PO.shooters.filter(s => s.aim > 0).length }; });
    console.log(n, JSON.stringify(st)); await page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 180000 });
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
