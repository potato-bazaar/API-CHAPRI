// Regenerates the committed golden baselines (npm run golden:capture).
// Run it only after you have reviewed why the simulation changed. Each configuration runs twice in separate
// processes. A baseline is written only if the two runs agree and every rider finishes.
import fs from 'fs';
import { fileURLToPath } from 'url';
import { allBaselines, SEED, PINNED_NOW, QUALITY, MAX_SIM_SECONDS, setupFor } from './spec.mjs';
import { runTrajectory } from './run.mjs';
import { compareRuns } from './compare.mjs';

const dir = fileURLToPath(new URL('./baselines/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });

const jobs = allBaselines();
const failures = [];
let next = 0;

async function lane() {
  while (next < jobs.length) {
    const b = jobs[next++];
    const first = await runTrajectory({ track: b.track, laps: b.laps, hz: b.hz });
    const second = await runTrajectory({ track: b.track, laps: b.laps, hz: b.hz });
    const same = compareRuns(first, second);
    if (!same.ok) {
      failures.push(`${b.file}: two runs in separate processes differ at simulated second ${same.firstSecond}; not written`);
      continue;
    }
    if (!first.result.allFinished) {
      failures.push(`${b.file}: not every rider finished within ${MAX_SIM_SECONDS} simulated seconds; not written`);
      continue;
    }
    const doc = {
      format: 'chapri-golden', version: 1, track: b.track, laps: b.laps, hz: b.hz,
      quality: QUALITY, seed: SEED, pinnedNow: PINNED_NOW, autopilot: true, maxSimSeconds: MAX_SIM_SECONDS,
      setup: setupFor(b), node: first.node, hashes: first.hashes, result: first.result,
    };
    fs.writeFileSync(dir + b.file, JSON.stringify(doc, null, 1) + '\n');
    console.log(`wrote ${b.file}: ${first.hashes.length} hashes, player ${first.result.playerPos} place, two runs identical`);
  }
}

await Promise.all([lane(), lane(), lane()]);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
