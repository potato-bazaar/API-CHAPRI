import * as THREE from 'three';

// ───────────────────────── CORE UTILITIES ─────────────────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const sstep = (t) => t * t * (3 - 2 * t);
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let RNG = mulberry32(1);
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rnd = (a = 0, b = 1) => a + RNG() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(RNG() * arr.length) % arr.length];
const fmtTime = (t) => { if (!isFinite(t) || t <= 0) return '--:--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const fmtTimeLong = (t) => { if (!isFinite(t) || t <= 0) return '--:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const fmtNum = (n) => Math.round(n).toLocaleString('en-IN');
const ordinal = (n) => (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');
const col = (hex) => new THREE.Color(hex);

const URLP = new URLSearchParams(location.search);
const DEBUG = {
  autopilot: URLP.has('autopilot'),
  timescale: +(URLP.get('timescale') || 1),
  fps: URLP.has('fps'),
  test: URLP.has('test'),
};
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ───────────────────────── GAME CONFIG ─────────────────────────
const BIKE_NAME = 'CR100'; // original RX-inspired two-stroke (no Yamaha / RX100 badging, per GDD §13)
const G = 9.81;

// Builds: 3 free, 5 unlocked with points (values from the Chapri Racer plan; tune in balancing)
const BUILDS = [
  { id: 'stock', name: 'Stock Silver', tag: 'STOCK', cost: 0, tank: '#b9bec6', accent: '#e8e8ec', note: 'Balanced; the one to learn on.', mod: { top: 0, acc: 0, grip: 0, brake: 0 } },
  { id: 'kaali', name: 'Kaali-Peeli', tag: 'STREET', cost: 0, tank: '#141414', accent: '#ffc21a', note: 'Quick launch, a little less top speed.', mod: { top: -2, acc: 0.08, grip: 0, brake: 0 } },
  { id: 'chrome', name: 'Chrome Tank', tag: 'STREET', cost: 0, tank: '#8a1630', accent: '#e9edf2', chrome: true, note: 'Extra grip; good in the monsoon.', mod: { top: 0, acc: 0, grip: 0.06, brake: 0 } },
  { id: 'sticker', name: 'Sticker Bomb', tag: 'STREET', cost: 2500, tank: '#ff2e88', accent: '#3fd0c9', stickers: true, note: 'Light front; the easiest wheelies.', mod: { top: 0, acc: 0.03, grip: 0, brake: 0, wheelie: 1 } },
  { id: 'cafe', name: 'Café Racer', tag: 'PRO', cost: 4500, tank: '#2f5d3a', accent: '#d9b46a', note: 'More lean angle; the cornering build.', mod: { top: 2, acc: 0.02, grip: 0.1, brake: 0.05 } },
  { id: 'neon', name: 'Neon Mod', tag: 'PRO', cost: 7000, tank: '#3b1d6e', accent: '#ff2e88', neon: true, note: 'Boost meter fills faster; best at night.', mod: { top: 4, acc: 0.05, grip: 0.04, brake: 0.04, boost: 1.35 } },
  { id: 'drag', name: 'Drag Build', tag: 'PRO', cost: 10000, tank: '#e85d1c', accent: '#1b1b1b', note: 'Strongest acceleration in the game.', mod: { top: 3, acc: 0.22, grip: 0, brake: 0.02 } },
  { id: 'raja', name: 'Raja Gold', tag: 'LEGEND', cost: 15000, tank: '#c99a2e', accent: '#7a1022', chrome: true, note: 'Highest top speed, worst grip until upgraded.', mod: { top: 12, acc: 0.06, grip: -0.12, brake: 0 } },
];
const UPGRADES = [
  { id: 'engine', name: 'Engine', icon: 'engine', desc: 'Top speed' },
  { id: 'silencer', name: 'Silencer', icon: 'exhaust', desc: 'Acceleration + powerband' },
  { id: 'tyres', name: 'Tyres', icon: 'tyre', desc: 'Grip + max lean' },
  { id: 'brakes', name: 'Brakes', icon: 'brake', desc: 'Stopping + wobble resistance' },
];
// Placeholder prices, flagged for balancing (GDD §15)
const upgradeCost = (build, lvl) => Math.round([300, 650, 1100, 1700, 2500][lvl] * (1 + BUILDS.findIndex(b => b.id === build.id) * 0.12) / 10) * 10;

const PAINTS = ['#b9bec6', '#141414', '#8a1630', '#ff2e88', '#2f5d3a', '#3b1d6e', '#e85d1c', '#c99a2e', '#1d6fb8', '#3e8e8a', '#f4f1ea', '#39ff6a', '#00c2ff', '#7b2cbf', '#ff3b30', '#ffd400', '#0b2f6b', '#5c3a21'];
// Visual mods, bought once and fitted to any owned bike. fx tweak the build's stats a little (shown in the Garage).
const MODS = {
  exhaust: { label: 'Silencer', items: [
    { id: 'stock', name: 'Stock', cost: 0 },
    { id: 'long', name: 'Lambi Pipe', cost: 900, note: 'Long chrome pipe · +2 km/h top', fx: { top: 2 } },
    { id: 'twin', name: 'Twin Upswept', cost: 1600, note: 'Pipe on each side · quicker pickup', fx: { acc: 0.04 } },
    { id: 'dragon', name: 'Dragon Mouth', cost: 2400, note: 'Spits fire on boost · boost fills faster', fx: { boost: 0.15 } } ] },
  tyres: { label: 'Tyres', items: [
    { id: 'stock', name: 'Stock', cost: 0 },
    { id: 'fat', name: 'Mota Tyre', cost: 1200, note: 'Fat and bulky · more grip, -1 km/h', fx: { grip: 0.05, top: -1 } },
    { id: 'racing', name: 'Racing Slick', cost: 2000, note: 'Sticky · more grip and lean', fx: { grip: 0.04, lean: 3 } } ] },
  kit: { label: 'Body kit', items: [
    { id: 'none', name: 'None', cost: 0 },
    { id: 'guard', name: 'Crash Guard', cost: 1100, note: 'Chrome guard + fog lamps · shrugs off hits', fx: { wobble: 0.12 } },
    { id: 'cafe', name: 'Café Cowl', cost: 1500, note: 'Headlight fairing + visor · +2 km/h top', fx: { top: 2 } },
    { id: 'full', name: 'Full Bulky Kit', cost: 3200, note: 'Guard, cowl and tank pads · both bonuses', fx: { wobble: 0.12, top: 2 } } ] },
  finish: { label: 'Finish', items: [
    { id: 'gloss', name: 'Gloss', cost: 0 },
    { id: 'matte', name: 'Matte', cost: 500, note: 'Flat, murdered-out look' },
    { id: 'flake', name: 'Metal Flake', cost: 800, note: 'Sparkles under the lights' },
    { id: 'chrome', name: 'Chrome', cost: 1500, note: 'Mirror paint' } ] },
};
const modsFor = (buildId) => { const b = BUILDS.find(x => x.id === buildId) || BUILDS[0]; return Object.assign({ exhaust: 'stock', tyres: 'stock', kit: 'none', finish: b.chrome ? 'chrome' : 'gloss' }, (SAVE.mods || {})[buildId] || {}); };
const modItem = (slot, id) => MODS[slot].items.find(x => x.id === id) || MODS[slot].items[0];
const COSMETICS = {
  shirt: [
    { id: 'floral-pink', name: 'Floral Pink', cost: 0, base: '#f04b8c', flowers: true },
    { id: 'floral-blue', name: 'Floral Blue', cost: 400, base: '#2c6fd6', flowers: true },
    { id: 'check', name: 'Check Shirt', cost: 400, base: '#c8321e', check: true },
    { id: 'leather', name: 'Black Leather', cost: 900, base: '#1c1a1f' },
    { id: 'marigold', name: 'Marigold Kurta', cost: 600, base: '#ffb000' },
  ],
  helmet: [
    { id: 'none', name: 'No helmet', cost: 0 },
    { id: 'red', name: 'Red helmet + visor', cost: 0, color: '#c8202f' },
    { id: 'white', name: 'White helmet + visor', cost: 0, color: '#eeeeee' },
  ],
  hair: [
    { id: 'pomp-brown', name: 'Pompadour (brown)', cost: 0, style: 'pomp', color: '#7a4628' },
    { id: 'pomp-black', name: 'Pompadour (black)', cost: 0, style: 'pomp', color: '#1c140f' },
    { id: 'pomp-copper', name: 'Copper Pompadour', cost: 400, style: 'pomp', color: '#a8521c' },
    { id: 'quiff-copper', name: 'Copper Quiff', cost: 0, style: 'quiff', color: '#c8641e' },
    { id: 'long-black', name: 'Long Hair (black)', cost: 0, style: 'long', color: '#1a120d' },
    { id: 'long-gold', name: 'Long Hair (golden)', cost: 500, style: 'long', color: '#e0b030' },
    { id: 'quiff-blonde', name: 'Blonde Quiff', cost: 400, style: 'quiff', color: '#e8c25a' },
    { id: 'quiff-red', name: 'Red Streak Quiff', cost: 600, style: 'quiff', color: '#c0263a' },
    { id: 'buzz', name: 'Buzz Cut', cost: 0, style: 'buzz', color: '#1a120d' },
  ],
  shades: [
    { id: 'gold', name: 'Gold aviators', cost: 0, color: '#d4a62a', style: 'aviator' },
    { id: 'black-av', name: 'Black aviators', cost: 300, color: '#2a2a2e', style: 'aviator' },
    { id: 'white', name: 'White frames', cost: 0, color: '#ffffff' },
    { id: 'none', name: 'No shades', cost: 0 },
  ],
};

// Seven AI rivals (GDD §5)
const RIVALS = [
  { name: 'Bunty Bhai', short: 'Bunty', style: 'blocker', weapon: 'chain', shirt: '#7a2a1c', helmet: '#222222', skill: 0.99, corner: 0.95, aggr: 1.2 },
  { name: 'Sunny Speed', short: 'Sunny', style: 'speed', weapon: 'bottle', shirt: '#1f3c88', helmet: null, skill: 1.03, corner: 0.9, aggr: 0.9 },
  { name: 'Pinku', short: 'Pinku', style: 'wheelie', weapon: 'gutka', shirt: '#ff7eb6', helmet: null, skill: 0.95, corner: 0.93, aggr: 0.8 },
  { name: 'Raju Rocket', short: 'Raju', style: 'latebrake', weapon: 'kick', shirt: '#2d8a4e', helmet: '#c8202f', skill: 1.0, corner: 1.04, aggr: 1.0 },
  { name: 'Dabbu', short: 'Dabbu', style: 'squeeze', weapon: 'belt', shirt: '#e8a317', helmet: null, skill: 0.98, corner: 0.98, aggr: 1.0 },
  { name: 'Lucky Lambu', short: 'Lambu', style: 'slider', weapon: 'chain', shirt: '#5b2a86', helmet: null, skill: 0.97, corner: 1.0, aggr: 1.1 },
  { name: 'Tinu', short: 'Tinu', style: 'clean', weapon: null, shirt: '#ececec', helmet: '#1d6fb8', skill: 1.0, corner: 1.0, aggr: 0 },
];

const DIFFICULTY = {
  easy: { label: 'Easy', mult: 0.8, pace: 0.88, corner: 0.84, aggr: 0.25, mistakes: 1, wobbleRecover: 1.5 },
  normal: { label: 'Normal', mult: 1, pace: 0.95, corner: 0.93, aggr: 0.6, mistakes: 0.4, wobbleRecover: 1 },
  hard: { label: 'Hard', mult: 1.5, pace: 1.0, corner: 1.0, aggr: 1.0, mistakes: 0.1, wobbleRecover: 1 },
};
const MODES = {
  quick: { label: 'Quick Race', desc: '8 riders · 1 to 5 laps', rivals: true, combat: true, laps: true },
  rumble: { label: 'Gali Rumble', desc: 'Knockdowns score as much as position', rivals: true, combat: 'force', fixedLaps: 3 },
  elimination: { label: 'Elimination', desc: 'Last rider out at every lap end', rivals: true, combat: true, fixedLaps: 7 },
  timetrial: { label: 'Time Trial', desc: 'Solo laps against your ghost', rivals: false, combat: false, laps: true },
  stunt: { label: 'Stunt Run', desc: 'One lap · stunts score only', rivals: false, combat: false, fixedLaps: 1 },
  cup: { label: 'Championship', desc: 'All 6 tracks · points carry over', rivals: true, combat: true, laps: true },
  police: { label: 'Police Express+', desc: 'Solo escape across the night nakabandi · jump the barricades, dodge the bullets, don\'t get caught', rivals: false, combat: 'force', fixedLaps: 2, police: true, track: 'bhaag-chapri', time: 'night' },
};
const TIMES = { morning: 'Morning chai', golden: 'Golden hour', night: 'Sodium night' };

// Scoring (GDD §6.2 + plan points table, before difficulty multiplier)
const PTS = {
  finish: [500, 300, 200, 120, 80, 60, 40, 20],
  overtake: 50, chain: 25, squeeze: 30, nearMiss: 15,
  hit: 20, dodge: 25, weaponSnatch: 75, knockdown: 150, revenge: 100, rumbleKnockdown: 400,
  launch: 50, clean: 150, lapRecord: 100, streak: 750,
};
const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

const DAILY = [
  { id: 'races', label: 'Finish 3 races', goal: 3, reward: 200 },
  { id: 'wheelies', label: 'Do 2 wheelies', goal: 2, reward: 150 },
  { id: 'knockdowns', label: 'Knockdown 1 rival', goal: 1, reward: 250 },
];
const DAILY_BONUS_ALL = 500;

const DEFAULT_KEYS = {
  throttle: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  rear: ['Space'], hitL: ['KeyJ'], hitR: ['KeyL'], throw: ['KeyK'], back: ['KeyQ'], boost: ['ShiftLeft', 'ShiftRight', 'KeyN'],
  gearUp: ['KeyX'], gearDown: ['KeyZ'], camera: ['KeyC'], respawn: ['KeyR'], pause: ['KeyP', 'Escape'], horn: ['KeyH'], mute: ['KeyM'],
};
const KEY_LABELS = {
  throttle: 'Throttle', brake: 'Front brake', left: 'Lean left', right: 'Lean right', rear: 'Rear brake / slide', hitL: 'Hit left', hitR: 'Hit right',
  throw: 'Throw / spit / shoot', back: 'Hop (tap) / wheelie (hold)', boost: 'Two-stroke kick', gearUp: 'Gear up (manual)', gearDown: 'Gear down (manual)',
  camera: 'Camera', respawn: 'Respawn', pause: 'Pause', horn: 'Horn', mute: 'Mute',
};

// ───────────────────────── SAVE DATA ─────────────────────────
const SAVE_KEY = 'chapri-racer-save-v1';
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function defaultSave() {
  return {
    // ugV1 and cosV2 mark the migrations in loadSave as done. A new save must carry both, or the first reload would
    // run a migration on choices the player has just made (cosV2 used to be missing: a free hair or shades pick reverted).
    name: 'PotatoBazaar', coins: 1500, parts: 3, xp: 0, ugV1: true, cosV2: true,
    build: 'chrome', owned: { stock: true, kaali: true, chrome: true },
    upgrades: {}, paint: {}, mods: {}, ownedMods: { 'exhaust:stock': true, 'tyres:stock': true, 'kit:none': true, 'finish:gloss': true },
    cos: { shirt: 'floral-pink', helmet: 'none', shades: 'gold', hair: 'pomp-brown' }, ownedCos: { 'floral-pink': true, none: true, red: true, white: true, gold: true },
    settings: { sfx: 0.8, engine: 0.8, music: 0.6, comic: true, camera: 0, wheelieAssist: true, manualGears: false, tilt: false, quality: 'auto', keys: null, vibration: true, smoking: true, steerAssist: true, traffic: 'light', guide: true },
    setup: { mode: 'quick', track: 'mumbai-underground', laps: 2, diff: 'normal', time: 'auto', weather: 'clear', combat: true },
    records: {}, ghosts: {},
    daily: { date: todayStr(), prog: {}, claimed: {}, bonus: false },
    streak: 0, wins: 0, races: 0, lastLogin: null, loginDays: 0,
    seenHelp: false,
  };
}
let SAVE = defaultSave();
const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// JSON.parse keeps "__proto__" as an ordinary key; copying it by assignment would replace the target's prototype
const ownKeys = (o) => Object.keys(o).filter(k => k !== '__proto__');
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// Rebuilds a usable save from whatever was stored. A known field keeps its stored value only when it has the shape the
// game reads, otherwise it falls back to its default, so a hand-edited, truncated or older save can not crash the boot,
// the menu or a race (a null `daily` or `upgrades`, a key binding that is not a list, or an unknown quality tier all
// used to). Fields this build does not know are kept as they were, as the old Object.assign merge did.
function cleanSave(s) {
  const D = defaultSave();
  if (!isPlainObj(s)) return D;
  const num = (v, d, lo = 0, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  const extras = (src, dst) => { for (const k of ownKeys(src)) if (!hasOwn(dst, k)) dst[k] = src[k]; return dst; };
  // { id: true } maps. The free items in the default save stay owned whatever the stored map says.
  const flags = (v, d) => { const o = Object.assign({}, d); if (isPlainObj(v)) for (const k of ownKeys(v)) if (v[k] === true) o[k] = true; return o; };
  // maps whose entries are checked one by one: a bad entry is dropped, the rest of the map survives
  const map = (v, fn) => { const o = {}; if (isPlainObj(v)) for (const k of ownKeys(v)) { const x = fn(v[k], k); if (x !== undefined) o[k] = x; } return o; };
  const finite = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

  extras(s, D);
  if (typeof s.name === 'string' && s.name.trim()) D.name = s.name.slice(0, 16);
  for (const k of ['coins', 'parts', 'xp', 'streak', 'wins', 'races']) D[k] = num(s[k], D[k]);
  D.loginDays = Math.round(num(s.loginDays, D.loginDays, 0, 7));
  D.lastLogin = typeof s.lastLogin === 'string' ? s.lastLogin : null;
  D.seenHelp = bool(s.seenHelp, D.seenHelp);
  D.owned = flags(s.owned, D.owned);
  if (typeof s.build === 'string' && D.owned[s.build] && BUILDS.some(b => b.id === s.build)) D.build = s.build;
  D.upgrades = map(s.upgrades, (u) => (isPlainObj(u) ? map(u, (n) => (finite(n) === undefined ? undefined : clamp(Math.round(n), 0, 5))) : undefined));
  D.paint = map(s.paint, (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined));
  D.mods = map(s.mods, (m) => (isPlainObj(m) ? map(m, (id) => (typeof id === 'string' ? id : undefined)) : undefined));
  D.ownedMods = flags(s.ownedMods, D.ownedMods);
  if (isPlainObj(s.cos)) for (const k of Object.keys(D.cos)) if (COSMETICS[k].some(c => c.id === s.cos[k])) D.cos[k] = s.cos[k];
  D.ownedCos = flags(s.ownedCos, D.ownedCos);
  // records hold one object per track, plus the championship's best place as a bare number
  D.records = map(s.records, (r, k) => (k === 'cupBest' ? (finite(r) >= 1 ? Math.round(r) : undefined) : isPlainObj(r) ? map(r, finite) : undefined));
  // a time-trial ghost is a list of samples, each one a list of numbers (Race.updateGhost indexes into every sample)
  D.ghosts = map(s.ghosts, (g) => (Array.isArray(g) && g.every(Array.isArray) ? g : undefined));
  const dl = s.daily;
  if (isPlainObj(dl) && dl.date === todayStr()) D.daily = { date: dl.date, prog: map(dl.prog, (n) => (finite(n) >= 0 ? n : undefined)), claimed: flags(dl.claimed, {}), bonus: dl.bonus === true };

  const S = s.settings, DS = D.settings;
  if (isPlainObj(S)) {
    extras(S, DS);
    for (const k of ['sfx', 'engine', 'music']) DS[k] = num(S[k], DS[k], 0, 1);   // an AudioParam throws on NaN
    for (const k of ['comic', 'wheelieAssist', 'manualGears', 'tilt', 'vibration', 'smoking', 'steerAssist', 'guide']) DS[k] = bool(S[k], DS[k]);
    DS.camera = oneOf(S.camera, [0, 1, 2], DS.camera);
    DS.quality = oneOf(S.quality, ['auto', 'low', 'medium', 'high'], DS.quality);   // an unknown tier has no QUALITY entry
    DS.traffic = oneOf(S.traffic, ['off', 'light', 'jam'], DS.traffic);
    // INPUT calls .some() on every bound action, so each one must be a list of key codes
    const keys = map(S.keys, (v, k) => (hasOwn(DEFAULT_KEYS, k) && Array.isArray(v) && v.length && v.every(c => typeof c === 'string') ? v : undefined));
    DS.keys = Object.keys(keys).length ? keys : null;
    if (hasOwn(DS, 'detected') && !['low', 'medium', 'high'].includes(DS.detected)) delete DS.detected;
    if (hasOwn(DS, 'musicStyle') && !['mass', 'dhinchak'].includes(DS.musicStyle)) delete DS.musicStyle;
    if (hasOwn(DS, 'entry') && typeof DS.entry !== 'boolean') delete DS.entry;
  }
  const U = s.setup, DU = D.setup;
  if (isPlainObj(U)) {
    extras(U, DU);
    DU.mode = oneOf(U.mode, Object.keys(MODES).filter(k => !MODES[k].mp), DU.mode);   // the solo setup never holds the friends mode
    DU.track = oneOf(U.track, TRACKS.map(t => t.id), DU.track);
    DU.laps = Number.isInteger(U.laps) && U.laps >= 1 && U.laps <= 20 ? U.laps : DU.laps;
    DU.diff = oneOf(U.diff, Object.keys(DIFFICULTY), DU.diff);
    DU.time = oneOf(U.time, ['auto', ...Object.keys(TIMES)], DU.time);
    DU.weather = oneOf(U.weather, ['clear', 'monsoon'], DU.weather);
    DU.combat = bool(U.combat, DU.combat);
  }
  // one-off migrations, keyed on the flags of the save as it was stored (the cleaned save always has both set)
  if (!s.ugV1) { DU.track = 'mumbai-underground'; DU.laps = 2; if (DU.mode === 'police') DU.mode = 'quick'; }
  if (!s.cosV2) { if (D.cos.hair === 'quiff-copper') D.cos.hair = 'pomp-brown'; if (D.cos.shades === 'white') D.cos.shades = 'gold'; }
  return D;
}

// ── One save, several tabs ──
// Every tab of a browser shares the one stored save but works on its own copy in memory, read at boot. Writing that
// whole copy back used to wipe out whatever another tab had saved since (a race reward, a purchase, a new name): the
// last tab to write won. That is likely with friends rooms, where the ?room= invite link is often opened in a second
// tab. So a write first checks whether the stored save is still the one this tab last read or wrote. If another tab has
// written since, the two are merged against that last common save: counters add both tabs' changes, records keep the
// better value, and every other field takes this tab's value only where this tab changed it. A tab idling in the menus
// also takes another tab's save as soon as it is written (the 'storage' event), so its screens stay current. A tab in a
// race, in a friends room or still loading waits until it is back in the menus; its own next write merges anyway.
// `raw` is the stored text this tab last read or wrote, `obj` the SAVE object it belonged to: a SAVE replaced as a
// whole (Reset progress) is written as it is, without a merge.
const SAVE_SYNC = { raw: null, obj: null, timer: 0 };
const cloneJson = (v) => JSON.parse(JSON.stringify(v));
// deep equality of two JSON values; key order does not matter
function sameJson(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => hasOwn(b, k) && sameJson(a[k], b[k]));
}
// a stored save as this build reads it, or null when there is no usable one
function storedSave(raw) {
  if (typeof raw !== 'string') return null;
  try { const s = JSON.parse(raw); return isPlainObj(s) ? cleanSave(s) : null; } catch (e) { return null; }
}
// How a field both tabs changed is settled, by its path in the save. Counters add both changes (two race rewards both
// count, a purchase in one tab still costs). Best times and places keep the better one; upgrade levels the higher one.
const MERGE_SUM = /^(coins|parts|xp|races|wins|daily\.prog\.[^.]+)$/;
const MERGE_LEAST = /^records\.(cupBest|[^.]+\.(bestLap|bestPos|bestEscape))$/;
const MERGE_MOST = /^(records\.[^.]+\.bestStunt|upgrades\.[^.]+\.[^.]+)$/;
function mergeSaves(base, mine, theirs) {
  const lapOf = (s, k) => { const r = isPlainObj(s.records) ? s.records[k] : null; return isPlainObj(r) && Number.isFinite(r.bestLap) ? r.bestLap : Infinity; };
  const walk = (path, b, m, t) => {
    if (path === 'daily' && isPlainObj(m) && isPlainObj(t)) {
      if (m.date !== t.date) return t.date === todayStr() ? t : m;   // a tab left open overnight still holds yesterday's
      if (!isPlainObj(b) || b.date !== m.date) b = { date: m.date, prog: {}, claimed: {}, bonus: false };
    }
    if (MERGE_SUM.test(path)) {   // before the equality checks: two tabs that each add 1 make 2
      const n = [b, m, t].map(v => (v === undefined ? 0 : v));
      if (n.every(Number.isFinite)) return Math.max(0, n[2] + n[1] - n[0]);
    }
    if (sameJson(m, t) || sameJson(t, b)) return m;
    if (sameJson(m, b)) return t;
    if (isPlainObj(m) && isPlainObj(t)) {
      const bo = isPlainObj(b) ? b : {}, o = {};
      for (const k of new Set([...ownKeys(m), ...ownKeys(t)])) { const v = walk(path ? path + '.' + k : k, bo[k], m[k], t[k]); if (v !== undefined) o[k] = v; }
      return o;
    }
    const both = [m, t].filter(Number.isFinite);
    if (MERGE_LEAST.test(path) && both.length) return Math.min(...both);
    if (MERGE_MOST.test(path) && both.length) return Math.max(...both);
    if (path.startsWith('ghosts.')) { const k = path.slice(7); return lapOf(theirs, k) < lapOf(mine, k) ? t : m; }   // the ghost of the better lap
    return m;
  };
  return cleanSave(walk('', base, mine, theirs));   // cleaned again: e.g. a bike picked here that the other tab's reset took away
}
// Makes dst equal src in place. Screens keep references into the save (the Settings handlers hold SAVE.settings), so the
// objects stay the same objects.
function syncInto(dst, src) {
  for (const k of Object.keys(dst)) if (!hasOwn(src, k)) delete dst[k];
  for (const k of ownKeys(src)) { if (isPlainObj(src[k]) && isPlainObj(dst[k])) syncInto(dst[k], src[k]); else dst[k] = src[k]; }
}
// Folds the save another tab stored (raw) into this tab's SAVE. Returns false when that save is unusable.
function takeStored(raw) {
  const theirs = storedSave(raw); if (!theirs) return false;
  syncInto(SAVE, mergeSaves(storedSave(SAVE_SYNC.raw) || defaultSave(), cloneJson(SAVE), theirs));
  SAVE_SYNC.raw = raw;   // memory now holds that save: it is the base of the next merge, whether or not the next write lands
  return true;
}

// A new browser, blocked storage or an unreadable save all start from defaultSave(). An unreadable save is copied to a
// side key first: the next checkpoint overwrites the main key, and the copy keeps the old progress recoverable by hand.
function loadSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage blocked: play with defaults */ }
  SAVE = defaultSave();
  if (raw) {
    let ok = false;
    try { const s = JSON.parse(raw); if (isPlainObj(s)) { SAVE = cleanSave(s); ok = true; } } catch (e) { SAVE = defaultSave(); }
    if (!ok) { try { localStorage.setItem(SAVE_KEY + '-unreadable', raw); } catch (e) { /* storage full or blocked */ } }
  }
  if (SAVE.daily.date !== todayStr()) SAVE.daily = { date: todayStr(), prog: {}, claimed: {}, bonus: false };
  SAVE_SYNC.raw = raw; SAVE_SYNC.obj = SAVE;
}
// Writes the whole save, merged first with anything another tab stored meanwhile (see above). A failure is most likely a
// full storage quota; the time-trial ghosts are the bulk of a save and the one part worth giving up, so the progress
// itself still gets written. Blocked storage fails both times, and the game plays on from memory. Returns whether the
// save reached storage.
function persist() {
  if (SAVE_SYNC.obj && SAVE === SAVE_SYNC.obj) {
    let cur = SAVE_SYNC.raw;
    try { cur = localStorage.getItem(SAVE_KEY); } catch (e) { /* unreadable: write as before */ }
    if (cur !== SAVE_SYNC.raw && cur !== null) takeStored(cur);
  }
  const write = (json) => {
    try { localStorage.setItem(SAVE_KEY, json); } catch (e) { return false; }
    SAVE_SYNC.raw = json; SAVE_SYNC.obj = SAVE; return true;
  };
  if (write(JSON.stringify(SAVE))) return true;
  return isPlainObj(SAVE.ghosts) && Object.keys(SAVE.ghosts).length > 0 && write(JSON.stringify(Object.assign({}, SAVE, { ghosts: {} })));
}
// Only the menus take another tab's save at once. GAME and MP are defined further on in the bundle; this runs from events.
function saveIdle() {
  try { return !!(GAME && GAME.ui && ['menu', 'garage', 'store'].includes(GAME.state) && !(typeof MP !== 'undefined' && MP && MP.room)); } catch (e) { return false; }
}
function takeOtherTabSave() {
  if (!SAVE_SYNC.obj || SAVE !== SAVE_SYNC.obj) return;   // not loaded yet, or a reset this tab could not store: it wins at its next write
  let cur; try { cur = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
  if (cur === SAVE_SYNC.raw || cur === null) return;
  if (!saveIdle()) { if (!SAVE_SYNC.timer) SAVE_SYNC.timer = setTimeout(() => { SAVE_SYNC.timer = 0; takeOtherTabSave(); }, 1500); return; }
  const before = cloneJson(SAVE);
  if (takeStored(cur)) refreshAfterSync(before);
}
// Redraws what shows the save: the menu, the open screen and dialogs, the menu bike and the backdrop.
function refreshAfterSync(before) {
  const g = GAME, ui = g.ui, now = SAVE;
  const changed = (...keys) => keys.some(k => !sameJson(before[k], now[k]));
  const shown = (id) => { const el = document.getElementById(id); return !!el && !el.hidden; };
  ui.renderMenu();
  if (g.state === 'garage') ui.renderGarage(); else if (g.state === 'store') ui.renderStore();
  if (shown('settings') && changed('settings', 'name')) ui.renderSettings();
  if (shown('setup') && changed('setup')) ui.renderSetup();
  if (shown('board') && changed('records', 'wins', 'races')) ui.renderBoard();
  if (changed('settings')) {
    if (typeof AUDIO !== 'undefined') AUDIO.applyVolumes();
    if (g.state === 'menu' && (before.settings.quality !== now.settings.quality || before.settings.detected !== now.settings.detected)) g.applyQuality(true);
  }
  if (g.state === 'menu' && ['track', 'time', 'weather'].some(k => before.setup[k] !== now.setup[k])) g.previewTrack(now.setup.track);   // also redraws the bike
  else if (changed('build', 'paint', 'mods', 'cos')) g.refreshMenuRig(g.state === 'garage' ? ui.gSel : undefined);
}
if (typeof addEventListener === 'function') addEventListener('storage', (e) => { if (e.key === SAVE_KEY || e.key === null) takeOtherTabSave(); });
// For tests and debugging only (like window.__chapri): a copy of the save this tab holds in memory. Reading it changes nothing.
if (typeof window !== 'undefined') window.__save = () => cloneJson(SAVE);
const levelFromXp = (xp) => { let lvl = 1, need = 1000, acc = 0; while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.18 / 10) * 10; } return { lvl, into: xp - acc, need }; };
const keymap = () => Object.assign({}, DEFAULT_KEYS, SAVE.settings.keys || {});

function buildStats(buildId) {
  const b = BUILDS.find(x => x.id === buildId) || BUILDS[0];
  const u = SAVE.upgrades[buildId] || {};
  const e = u.engine || 0, s = u.silencer || 0, t = u.tyres || 0, br = u.brakes || 0;
  const md = modsFor(b.id), fx = {}; for (const k of ['exhaust', 'tyres', 'kit']) for (const [a, v] of Object.entries(modItem(k, md[k]).fx || {})) fx[a] = (fx[a] || 0) + v;
  const top = 100 + b.mod.top + e * 5 + s * 1 + (fx.top || 0); // km/h: 100 stock → ~135 fully upgraded
  const acc = 1 + b.mod.acc + s * 0.07 + e * 0.015 + (fx.acc || 0);
  const lean = 45 + t * 1.4 + b.mod.grip * 20 + (fx.lean || 0); // degrees: +7° across 5 tyre levels
  const grip = 1 + b.mod.grip + t * 0.03 + (fx.grip || 0);
  const brake = 1 + b.mod.brake + br * 0.07;
  const wobbleRes = 1 + br * 0.06 + (fx.wobble || 0);
  // 0–100 estimate for the stat card
  const zeroTo100 = clamp(6.7 / acc * (100 / Math.min(top, 100)) ** 0.5, 4.5, 12);
  return { build: b, mods: md, top, acc, lean, grip, brake, wobbleRes, zeroTo100, boostFill: (b.mod.boost || 1) + (fx.boost || 0), wheelieEase: b.mod.wheelie || 0, lvls: { engine: e, silencer: s, tyres: t, brakes: br } };
}
