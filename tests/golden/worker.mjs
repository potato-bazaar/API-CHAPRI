// Child-process entry for one golden run. A fresh process per run means no state can leak between runs.
// Usage: node tests/golden/worker.mjs --track=<id> --laps=<n> --hz=<60|30|144> [--seed=<n>] [--detail-second=<k>]
// Prints one JSON object on stdout. Exit code 1 if the run threw.
import crypto from 'crypto';
import { SEED, PINNED_NOW, QUALITY, MAX_SIM_SECONDS, setupFor } from './spec.mjs';
import { mulberry32 } from './prng.mjs';
import { pinClock, installBrowserStubs, visualStub } from './shim.mjs';
import { headlessModuleUrl } from './bundle.mjs';

const flags = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const track = String(flags.track ?? '');
const laps = Number(flags.laps ?? 1);
const hz = Number(flags.hz ?? 60);
const seed = flags.seed !== undefined ? Number(flags.seed) : SEED;
const detailSecond = flags['detail-second'] !== undefined ? Number(flags['detail-second']) : null;

function emit(obj, code) {
  process.stdout.write(JSON.stringify(obj) + '\n', () => process.exit(code));
}
console.log = (...a) => console.error(...a);   // stdout carries only the JSON line

// Every number the hashes cover, in a fixed order. Strings keep NaN and Infinity visible.
function riderFields(r) {
  return [r.dist, r.d, r.psi, r.v, r.y, r.lean, r.pitch, r.wobble, r.boost, r.lap,
    r.crashed ? 1 : 0, r.finished ? 1 : 0, r.finished ? r.finishT : null, r.eliminated ? 1 : 0, r.laps.length];
}

try {
  if (!track || !(hz > 0)) throw new Error('usage: --track=<id> --laps=<n> --hz=<n>');
  pinClock(PINNED_NOW);
  Math.random = mulberry32(seed);
  installBrowserStubs();
  const G = await import(headlessModuleUrl());
  const g = G.GAME;
  if (!g || typeof g.raceFrame !== 'function') throw new Error('the bundle boot did not create GAME');
  if (!G.TRACKS.some((t) => t.id === track)) throw new Error(`unknown track ${track}`);

  // Browser pieces that the solo race needs but a headless boot never creates (the boot stops at WebGL).
  g.quality = QUALITY;
  g.vw = 480;
  g.vh = 270;
  g.renderer = visualStub({ shadowMap: visualStub({}), compile: () => {}, setPixelRatio: () => {}, getPixelRatio: () => 1 });
  g.scene = new G.THREE.Scene();
  g.camera = new G.THREE.PerspectiveCamera(66, 480 / 270, 0.1, 2400);
  g.hud = visualStub({});
  g.fx = visualStub({ fovPunch: 0, dip: 0, boostAmt: 0 });
  if (Object.keys(G.TEX).length === 0) G.buildTextures();
  G.DEBUG.autopilot = true;   // the player is driven by the game's own autopilot, as ?autopilot does

  g.startRace(setupFor({ track, laps }));   // the game's own race setup: track, world, riders, grid
  const R = g.race;
  const dt = 1 / hz;
  const INP = { pause: false, throttle: 0, brake: 0, rear: 0, steer: 0, back: false, boost: false, hop: false,
    hitL: false, hitR: false, hitAuto: false, gpSide: 0, throw: false, respawn: false, gearUp: false, gearDown: false,
    horn: false, camera: false };

  const stateString = () => [R.raceT, ...R.riders.flatMap(riderFields)].map(String).join(',');
  const hashNow = () => crypto.createHash('sha256').update(stateString()).digest('hex');
  const allDone = () => R.riders.every((r) => r.finished || r.eliminated);
  const snapshotRiders = () => R.riders.map((r) => ({ name: r.short, dist: r.dist, d: r.d, psi: r.psi, v: r.v, y: r.y,
    lean: r.lean, pitch: r.pitch, wobble: r.wobble, boost: r.boost, lap: r.lap, crashed: !!r.crashed,
    finished: !!r.finished, finishT: r.finished ? r.finishT : null }));

  // One hash per simulated second: seconds[k] is the state after k whole seconds. The last entry is the final state.
  const seconds = [hashNow()];
  const cap = Math.round(MAX_SIM_SECONDS * hz);
  let frame = 0;
  let detail = null;
  while (!allDone() && frame < cap) {
    g.raceFrame(dt, INP);   // the game's own per-frame function (autopilot, combat, race update, camera)
    frame++;
    if (frame % hz === 0) seconds.push(hashNow());
    if (detailSecond !== null && frame === detailSecond * hz) detail = { second: detailSecond, riders: snapshotRiders() };
  }
  if (frame % hz !== 0) seconds.push(hashNow());

  const result = {
    allFinished: allDone(),
    raceState: R.state,
    playerPos: R.playerPos ?? null,
    framesSimulated: frame,
    ranking: R.ranking().map((r, i) => ({ pos: i + 1, name: r.short, finished: !!r.finished, finishT: r.finished ? r.finishT : null })),
    nan: R.riders.some((r) => [r.dist, r.d, r.v, r.psi, r.y, r.lean, r.pitch, r.wobble].some((x) => Number.isNaN(x))),
  };
  emit({ track, laps, hz, seed, quality: QUALITY, autopilot: true, pinnedNow: PINNED_NOW, node: process.version,
    hashes: seconds, result, detail }, 0);
} catch (e) {
  emit({ error: String((e && e.stack) || e) }, 1);
}
