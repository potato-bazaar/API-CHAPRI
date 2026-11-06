// Golden race trajectories. Each committed baseline must reproduce exactly. Runs must be reproducible across
// separate processes. A different seed must change the outcome, so the baselines cannot pass by accident.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CUP, SEED, allBaselines, baselineFile } from './spec.mjs';
import { runTrajectory } from './run.mjs';
import { compareRuns } from './compare.mjs';

const BASELINES = fileURLToPath(new URL('./baselines/', import.meta.url));
const TIMEOUT = 600000;
const load = (file) => JSON.parse(fs.readFileSync(BASELINES + file, 'utf8'));

describe('golden race trajectories (solo, Quick mode, autopilot player)', () => {
  for (const b of allBaselines()) {
    it.concurrent(`${b.track} at ${b.hz} Hz matches its committed baseline`, async () => {
      const base = load(b.file);
      const cur = await runTrajectory({ track: b.track, laps: b.laps, hz: b.hz });
      const cmp = compareRuns(base, cur);
      let detail = '';
      if (!cmp.ok && cmp.firstSecond !== null) {
        const at = await runTrajectory({ track: b.track, laps: b.laps, hz: b.hz, detailSecond: cmp.firstSecond });
        detail = `\nrider state at simulated second ${cmp.firstSecond} (current code): ${JSON.stringify(at.detail ? at.detail.riders : null)}`;
      }
      expect(cmp.ok, `${b.file}: ${JSON.stringify(cmp.problems)}\nbaseline recorded with ${base.node}; running ${cur.node}${detail}`).toBe(true);
    }, TIMEOUT);
  }

  for (const c of CUP) {
    it.concurrent(`${c.track} is reproducible across separate processes`, async () => {
      const a = await runTrajectory({ track: c.track, laps: c.laps, hz: 60 });
      const b = await runTrajectory({ track: c.track, laps: c.laps, hz: 60 });
      const cmp = compareRuns(a, b);
      expect(cmp.ok, `two separate runs differ: ${JSON.stringify(cmp.problems)}`).toBe(true);
    }, TIMEOUT);
  }

  it.concurrent('a different seed changes the outcome, so the baselines are not vacuous', async () => {
    const base = load(baselineFile('mumbai-central', 60));
    const other = await runTrajectory({ track: 'mumbai-central', laps: 1, hz: 60, seed: SEED + 1 });
    expect(compareRuns(base, other).ok, 'a different seed produced the same trajectory').toBe(false);
  }, TIMEOUT);
});
