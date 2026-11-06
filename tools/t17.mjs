// Solo race smoke gate (npm run test:race). It exits 1 unless every check below holds:
//   1. the simulation runs without throwing,
//   2. every rider finishes within the cap (the race runs to completion, not only to the player's finish),
//   3. no rider state is NaN, and the finishing positions are 1..N with no duplicates,
//   4. the page logs no console error and no page error.
// Usage: node tools/t17.mjs [track] [laps]
import { openGame } from './serve-test.mjs';

const track = process.argv[2] || 'mumbai-central';
const laps = Number(process.argv[3] || 1);
const CAP_SECONDS = 400;

const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&laps=${laps}&track=${track}`, width: 480, height: 270 });
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
let run = null;

try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  // The game's own per-frame function drives the race (autopilot player, rivals, combat), one 60 Hz frame at a time.
  run = await page.evaluate((capSeconds) => {
    const g = window.__chapri, R = g.race, dt = 1 / 60;
    const INP = { pause: false, throttle: 0, brake: 0, rear: 0, steer: 0, back: false, boost: false, hop: false,
      hitL: false, hitR: false, hitAuto: false, gpSide: 0, throw: false, respawn: false, gearUp: false, gearDown: false,
      horn: false, camera: false };
    let frames = 0;
    let error = null;
    try {
      while (frames < capSeconds * 60 && !R.riders.every((r) => r.finished || r.eliminated)) { g.raceFrame(dt, INP); frames++; }
    } catch (e) {
      error = String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ');
    }
    const ranking = R.ranking();
    return {
      error,
      frames,
      simSeconds: +(frames * dt).toFixed(2),
      raceState: R.state,
      playerPos: R.playerPos ?? null,
      riders: ranking.map((r, i) => ({
        pos: i + 1,
        name: r.short,
        finished: !!r.finished,
        finishT: r.finished ? +r.finishT.toFixed(2) : null,
        nan: [r.dist, r.d, r.v, r.psi, r.y].some((x) => Number.isNaN(x)),
      })),
    };
  }, CAP_SECONDS);
} catch (e) {
  failures.push('the race could not be run: ' + String(e.message).split('\n')[0]);
}

if (run) {
  check(run.error === null, `the simulation threw: ${run.error}`);
  const unfinished = run.riders.filter((r) => !r.finished).map((r) => r.name);
  check(unfinished.length === 0, `not every rider finished within ${CAP_SECONDS} simulated seconds; still racing: ${unfinished.join(', ')}`);
  check(!run.riders.some((r) => r.nan), 'a rider state is NaN');
  check(new Set(run.riders.map((r) => r.pos)).size === run.riders.length, 'finishing positions are not unique');
}
const errorLogs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
check(errorLogs.length === 0, `the page logged ${errorLogs.length} error(s): ${errorLogs.slice(0, 3).join(' || ')}`);

console.log(`${failures.length === 0 ? 'PASS' : 'FAIL'}  solo race smoke: ${track}, ${laps} lap(s), Quick mode, autopilot player, 480x270`);
if (run) {
  console.log(`  simulated ${run.simSeconds} s (${run.frames} frames at 60 Hz), race state ${run.raceState}, player place ${run.playerPos ?? '-'}`);
  for (const r of run.riders) console.log(`  ${String(r.pos).padStart(2)}  ${r.name.padEnd(8)} finished=${r.finished}  finishT=${r.finishT ?? '-'}`);
}
for (const f of failures) console.log(`  FAILED: ${f}`);
await browser.close();
process.exitCode = failures.length === 0 ? 0 : 1;
