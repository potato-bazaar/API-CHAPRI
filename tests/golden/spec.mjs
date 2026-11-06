// What the golden baselines cover. Every run in tests/golden uses these values.
export const SEED = 12345;                 // seed for Math.random in every golden run
export const PINNED_NOW = 1730000000000;   // what Date.now() and new Date() return in every golden run
export const QUALITY = 'low';              // the ?q=low tier that the browser smoke test (tools/t17.mjs) uses
export const MAX_SIM_SECONDS = 400;        // a run ends when every rider has finished, or at this cap
export const STREAMS_HZ = [60, 30, 144];   // frame streams; 60 Hz is the reference stream

// The six cup tracks (CUP_TRACKS in the game). Bhaag Chapri Bhaag is police-only and not part of v1.
// Laps follow the solo test plan: Mumbai Underground has two laps, the others have one.
export const CUP = [
  { track: 'mumbai-central', laps: 1 },
  { track: 'dharavi-lanes', laps: 1 },
  { track: 'mumbai-underground', laps: 2 },
  { track: 'sion-flyover', laps: 1 },
  { track: 'crawford-market', laps: 1 },
  { track: 'bandstand-rush', laps: 1 },
];

// The race setup the golden runs use. It matches a default save: Quick mode, normal difficulty, combat on, clear weather.
export function setupFor({ track, laps }) {
  return { mode: 'quick', track, laps, diff: 'normal', time: 'auto', weather: 'clear', combat: true };
}

export const baselineFile = (track, hz) => `${track}.${hz}hz.json`;

export function allBaselines() {
  return CUP.flatMap((c) => STREAMS_HZ.map((hz) => ({ track: c.track, laps: c.laps, hz, file: baselineFile(c.track, hz) })));
}
