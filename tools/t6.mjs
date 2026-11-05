import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&timescale=2&mode=rumble&track=mumbai-central`, width: 960, height: 540 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  await page.waitForFunction(() => window.__chapri.race && window.__chapri.race.raceT > 11, null, { timeout: 120000 });
  // give the player a chain + gutka and swing at the nearest rival when one is alongside
  await page.evaluate(() => { const R = window.__chapri.race; R.player.weapons.melee = { kind: 'chain', uses: 6 }; R.player.weapons.throw = { kind: 'gutka', uses: 3 }; R.player.rig.showWeapon('chain'); });
  let shot = 0;
  for (let k = 0; k < 60 && shot < 3; k++) {
    const ok = await page.evaluate(() => { const R = window.__chapri.race, P = R.player; const t = R.riders.find(r => r !== P && !r.crashed && Math.abs(r.dist - P.dist) < 1.4 && Math.abs(r.d - P.d) > 0.3 && Math.abs(r.d - P.d) < 2.4); if (!t) return false; R.combat.melee(P, t.d > P.d ? 1 : -1); return true; });
    if (ok) { await page.waitForTimeout(260); await page.screenshot({ path: `tools/fight_${shot++}.png`, timeout: 60000 }); await page.waitForTimeout(1500); }
    else await page.waitForTimeout(400);
  }
  const st = await page.evaluate(() => { const R = window.__chapri.race; return { t: R.raceT.toFixed(1), score: R.score, riders: R.riders.map(r => r.short + (r.weapons.melee ? '[' + r.weapons.melee.kind + ']' : '') + (r.weapons.throw ? '[' + r.weapons.throw.kind + ']' : '') + ':w' + r.wobble.toFixed(0) + ':c' + (r._crashes || 0)).join(' ') }; });
  console.log('shots', shot, JSON.stringify(st));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
