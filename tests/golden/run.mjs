// Runs one golden trajectory in a child process and returns the parsed result.
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileP = promisify(execFile);
const WORKER = fileURLToPath(new URL('./worker.mjs', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export async function runTrajectory({ track, laps, hz, seed, detailSecond }) {
  const args = [WORKER, `--track=${track}`, `--laps=${laps}`, `--hz=${hz}`];
  if (seed !== undefined) args.push(`--seed=${seed}`);
  if (detailSecond !== undefined && detailSecond !== null) args.push(`--detail-second=${detailSecond}`);
  let stdout;
  try {
    ({ stdout } = await execFileP(process.execPath, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
  } catch (e) {
    stdout = e.stdout;   // the worker prints its error as JSON and exits 1
    if (!stdout) throw e;
  }
  const out = JSON.parse(String(stdout).trim().split('\n').pop());
  if (out.error) throw new Error(`golden run failed for ${track} at ${hz} Hz:\n${out.error}`);
  return out;
}
