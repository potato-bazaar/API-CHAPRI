import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: '?test&q=low&mode=timetrial&track=sion-flyover&laps=1', width: 640, height: 360 });
await page.waitForSelector('#menu.show', { timeout: 90000 });
// drive the physics directly at a fixed step (no rendering) to measure acceleration and top speed
const r = await page.evaluate(() => {
  const g = window.__chapri; g.startFromSetup(); const R = g.race; R.state = 'racing'; R.raceT = 0.5; const P = R.player;
  const out = []; let t = 0; let t100 = null;
  for (let i = 0; i < 90 * 20; i++) { P.input.throttle = 1; P.input.steer = 0; P.input.brake = 0; P.step(1 / 90, R.raceT += 1 / 90); P.d = 0; P.psi = 0; t += 1 / 90; if (!t100 && P.v * 3.6 >= 99) t100 = t; if (i % 90 === 0) out.push([t.toFixed(0), (P.v * 3.6).toFixed(0), P.gear, P.rpm.toFixed(0)]); }
  // braking 100 -> 0
  let tb = 0; while (P.v > 0.1 && tb < 10) { P.input.throttle = 0; P.input.brake = 1; P.step(1 / 90, R.raceT += 1 / 90); tb += 1 / 90; P.d = 0; P.psi = 0; }
  return { out, t100, tb: tb.toFixed(2), crashed: P.crashed };
});
console.log(JSON.stringify(r));
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
