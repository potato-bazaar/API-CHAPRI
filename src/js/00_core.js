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
    { id: 'stock', name: 'Stock', cost: 0, note: 'Company silencer · the crisp RX beat' },
    { id: 'free', name: 'Free Flow', cost: 700, note: 'Pipe welded into the muffler · loud, hard beat and crackle · quicker revs', fx: { acc: 0.03, top: -1 } },
    { id: 'long', name: 'Lambi Pipe', cost: 900, note: 'Long chrome pipe · deep bass boom · +2 km/h top', fx: { top: 2 } },
    { id: 'twin', name: 'Twin Upswept', cost: 1600, note: 'Pipe on each side · loudest, left-right beat · quicker pickup', fx: { acc: 0.04 } },
    { id: 'chamber', name: 'Expansion Chamber', cost: 2800, note: 'Motocross pipe · quiet low down, screams in the powerband · +3 km/h top', fx: { top: 3, acc: -0.02 } },
    { id: 'dragon', name: 'Dragon Mouth', cost: 2400, note: 'Raspy, pops and spits fire on boost · boost fills faster', fx: { boost: 0.15 } } ] },
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
// the underwear brand printed on the waistband (swap it here; a real brand name needs the brand owner's permission)
const UW_BRAND = 'LUX COZI';
const COSMETICS = {
  shirt: [
    { id: 'floral-pink', name: 'Floral Pink', cost: 0, base: '#f04b8c', flowers: true },
    { id: 'floral-blue', name: 'Floral Blue', cost: 400, base: '#2c6fd6', flowers: true },
    { id: 'check', name: 'Check Shirt', cost: 400, base: '#c8321e', check: true },
    { id: 'leather', name: 'Black Leather', cost: 900, base: '#1c1a1f' },
    { id: 'marigold', name: 'Marigold Kurta', cost: 600, base: '#ffb000' },
    { id: 'baniyan', name: 'Just Baniyan (white)', cost: 250, top: 'vest', vest: '#f2efe6', base: '#f2efe6' },
    { id: 'baniyan-black', name: 'Black Baniyan', cost: 350, top: 'vest', vest: '#26242c', base: '#26242c' },
    { id: 'baniyan-pink', name: 'Pink Gym Vest', cost: 450, top: 'vest', vest: '#ff4f9a', base: '#ff4f9a' },
    { id: 'shirtless', name: 'No Shirt (full chapri)', cost: 600, top: 'bare', base: 'linear-gradient(135deg,#c98a5e,#9a6440)' },
    { id: 'denim-jacket', name: 'Denim Jacket', cost: 1200, base: '#3d5f8f', pattern: 'denim' },
    { id: 'bomber', name: 'Olive Bomber', cost: 1100, base: '#5b6236' },
    { id: 'neon-jacket', name: 'Neon Windcheater', cost: 1500, base: '#19d8ff', pattern: 'neon' },
    { id: 'leopard-shirt', name: 'Leopard Print', cost: 1300, base: '#d9a441', pattern: 'leopard' },
  ],
  // who rides: the classic chapri (every wardrobe item below), or Dogesh in his Diwali set (long hair, beard, wayfarers,
  // saffron kurta, white churidar and an emerald brocade long jacket with gold zari; helmet, cape and chain still apply)
  rider: [
    { id: 'chapri', name: 'Chapri (classic)', cost: 0, base: 'linear-gradient(135deg,#f04b8c 0 50%,#1f2a4a 50%)' },
    { id: 'dogesh', name: 'Dogesh · Diwali set', cost: 0, base: 'linear-gradient(135deg,#ff8a1c 0 38%,#f0e7d3 38% 62%,#0d5a3d 62%)', tag: 'NEW' },
  ],
  // long capes: a cloth sheet pinned across the shoulders that streams back at speed (our own designs and crests)
  cape: [
    { id: 'none', name: 'No cape', cost: 0 },
    { id: 'raat', name: 'Raat Cape', cost: 1800, base: '#17141d', lining: '#b0145e', hem: 'scallop', glow: '#ff2e88' },
    { id: 'hero', name: 'Hero Cape', cost: 1800, base: '#c8102e', lining: '#7a0a1c', crest: 'crown', trim: '#ffc21a' },
    { id: 'neon', name: 'Neon Cape', cost: 2600, base: '#2a1140', lining: '#0c2a3a', hem: 'scallop', glow: '#20e0ff' },
    { id: 'raja', name: 'Raja Cape', cost: 3500, base: '#c9962e', lining: '#6d0f1f', pattern: 'brocade', trim: '#7a1020', crest: 'crown' },
  ],
  // the waistband that shows above the jeans (the chapri signature). The brand name is one constant: UW_BRAND.
  chaddi: [
    { id: 'hidden', name: 'Belt up (hidden)', cost: 0 },
    { id: 'kozi-white', name: UW_BRAND + ' White', cost: 0, band: '#f4f2ec', ink: '#d01c2a', style: 'brand' },
    { id: 'kozi-black', name: UW_BRAND + ' Black', cost: 300, band: '#17161b', ink: '#ffffff', style: 'brand' },
    { id: 'kozi-red', name: UW_BRAND + ' Red', cost: 300, band: '#c8202f', ink: '#ffffff', style: 'brand' },
    { id: 'kozi-neon', name: UW_BRAND + ' Neon', cost: 500, band: '#20e0ff', ink: '#16101c', style: 'brand' },
    { id: 'leopard', name: 'Leopard Trunk', cost: 700, band: '#d9a441', style: 'leopard' },
    { id: 'pantie', name: 'Pink Pantie', cost: 900, band: '#ff7ab8', style: 'pantie' },
    { id: 'lace', name: 'Lace Pantie', cost: 1400, band: '#e0459a', style: 'lace' },
    { id: 'lace-black', name: 'Black Lace', cost: 1600, band: '#1c1220', style: 'lace' },
  ],
  jeans: [
    { id: 'blue', name: 'Blue Jeans', cost: 0, color: '#1f2a4a' },
    { id: 'black', name: 'Black Jeans', cost: 300, color: '#151418' },
    { id: 'acid', name: 'Acid Wash', cost: 600, color: '#5f7898' },
    { id: 'white', name: 'White Jeans', cost: 700, color: '#d6d3cb' },
    { id: 'red', name: 'Red Pants', cost: 800, color: '#7a1622' },
    { id: 'cargo', name: 'Olive Cargo', cost: 700, color: '#4d5130' },
  ],
  // body: muscle grows the arms, chest, back, traps and thighs (a vertex push in the rider's shaders)
  body: [
    { id: 'slim', name: 'Patla (slim)', cost: 0, muscle: 0 },
    { id: 'fit', name: 'Fit', cost: 600, muscle: 0.5 },
    { id: 'muscle', name: 'Muscular', cost: 1500, muscle: 1.0 },
    { id: 'gym-bhai', name: 'Gym Bhai', cost: 3000, muscle: 1.6 },
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
  // the boss: a maxed-out bike, no mistakes, boosts on straights. Off the grid on Easy (Tinu rides instead).
  { name: 'Toofan Bhai', short: 'Toofan', style: 'boss', weapon: 'chain', shirt: '#141414', helmet: '#d4a017', skill: 1.04, corner: 1.04, aggr: 1.0, boss: true },
];
const RIVAL_EASY = { name: 'Tinu', short: 'Tinu', style: 'clean', weapon: null, shirt: '#ececec', helmet: '#1d6fb8', skill: 1.0, corner: 1.0, aggr: 0 };

const DIFFICULTY = {
  // pace/corner: how hard the field rides · catchup: extra pace for a rival far behind you · ease: a rival far ahead lifts a touch
  // sev: how hard crashes into traffic and obstacles hit you · boss: Toofan's speed relative to your bike's top speed
  easy: { label: 'Easy', mult: 0.8, pace: 0.9, corner: 0.88, aggr: 0.3, mistakes: 0.8, wobbleRecover: 1.5, catchup: 0, ease: 0.93, sev: 0.7, boss: 0.97 },
  normal: { label: 'Normal', mult: 1, pace: 1.0, corner: 0.97, aggr: 0.75, mistakes: 0.25, wobbleRecover: 1, catchup: 0.07, ease: 0.97, sev: 1.0, boss: 1.03 },
  hard: { label: 'Hard', mult: 1.5, pace: 1.04, corner: 1.02, aggr: 1.0, mistakes: 0.05, wobbleRecover: 1, catchup: 0.11, ease: 1.0, sev: 1.15, boss: 1.08 },
};
const MODES = {
  quick: { label: 'Quick Race', desc: '8 riders · 1 to 5 laps', rivals: true, combat: true, laps: true },
  rumble: { label: 'Gali Rumble', desc: 'Knockdowns score as much as position', rivals: true, combat: 'force', fixedLaps: 3 },
  elimination: { label: 'Elimination', desc: 'Last rider out at every lap end', rivals: true, combat: true, fixedLaps: 7 },
  timetrial: { label: 'Time Trial', desc: 'Solo laps against your ghost', rivals: false, combat: false, laps: true },
  stunt: { label: 'Stunt Run', desc: 'One lap · stunts score only', rivals: false, combat: false, fixedLaps: 1 },
  cup: { label: 'Championship', desc: 'All 6 tracks · points carry over', rivals: true, combat: true, laps: true },
  flying: { label: 'Flying Mode', desc: 'Solo · wings on the bike · jump the cliff, fly the canyon, land it', rivals: false, combat: false, fixedLaps: 1, flying: true, track: 'cliff-run', time: 'morning' },
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
    name: 'PotatoBazaar', coins: 1500, parts: 3, xp: 0, ugV1: true,
    build: 'chrome', owned: { stock: true, kaali: true, chrome: true },
    upgrades: {}, paint: {}, mods: {}, ownedMods: { 'exhaust:stock': true, 'tyres:stock': true, 'kit:none': true, 'finish:gloss': true },
    cos: { rider: 'chapri', shirt: 'floral-pink', helmet: 'none', shades: 'gold', hair: 'pomp-brown', chaddi: 'kozi-white', jeans: 'blue', body: 'slim', cape: 'none' }, ownedCos: { 'floral-pink': true, none: true, red: true, white: true, gold: true },
    settings: { sfx: 0.8, engine: 0.8, music: 0.6, comic: true, camera: 0, wheelieAssist: true, manualGears: false, tilt: false, quality: 'auto', keys: null, vibration: true, smoking: true, steerAssist: true, traffic: 'light', guide: true },
    setup: { mode: 'quick', track: 'mumbai-underground', laps: 2, diff: 'normal', time: 'auto', weather: 'clear', combat: true },
    records: {}, ghosts: {}, career: { stars: {}, paid: {} }, fly: { up: {}, own: { bamboo: true }, build: 'bamboo', best: 0 },
    daily: { date: todayStr(), prog: {}, claimed: {}, bonus: false },
    streak: 0, wins: 0, races: 0, lastLogin: null, loginDays: 0,
    seenHelp: false,
  };
}
let SAVE = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const s = JSON.parse(raw); SAVE = Object.assign(defaultSave(), s); SAVE.settings = Object.assign(defaultSave().settings, s.settings || {}); SAVE.setup = Object.assign(defaultSave().setup, s.setup || {}); SAVE.cos = Object.assign(defaultSave().cos, s.cos || {}); if (!s.ugV1) { SAVE.setup.track = 'mumbai-underground'; SAVE.setup.laps = 2; if (SAVE.setup.mode === 'police') SAVE.setup.mode = 'quick'; SAVE.ugV1 = true; } if (!s.cosV2) { if (SAVE.cos.hair === 'quiff-copper') SAVE.cos.hair = 'pomp-brown'; if (SAVE.cos.shades === 'white') SAVE.cos.shades = 'gold'; SAVE.cosV2 = true; } SAVE.ownedMods = Object.assign(defaultSave().ownedMods, s.ownedMods || {}); SAVE.mods = s.mods || {}; }
  } catch (e) { /* storage blocked: play with defaults */ }
  if (SAVE.daily.date !== todayStr()) SAVE.daily = { date: todayStr(), prog: {}, claimed: {}, bonus: false };
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* ignore */ } }
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
