// Guest progress, end to end (spec section 5): no sign-up, the save lives in this browser's localStorage under
// chapri-racer-save-v1. Each visitor is its own browser context, so each one has its own storage, like a separate
// phone or laptop. window.__save() (00_core.js) returns a copy of the save the page holds in memory, so a test can
// compare what the game loaded with what is stored. The tests run in order:
//   Asha: a fresh visit shows level 1 and no XP and stores nothing yet; an autopilot solo race pays XP and coins and
//         sets a lap record and a ghost, the results show and the menu reflects them; she then renames herself, changes
//         a volume, her bike and the rain, and has a garage from an earlier session; a reload loads exactly what is
//         stored and the screens show it; so does a "browser restart" (a new context with her storage);
//   Bunty: a brand-new visitor starts fresh while Asha has progress;
//   Asha: Reset progress in Settings takes her back to level 1 but keeps her settings, and it sticks across a reload;
//   corrupted saves (garbage JSON, wrong field types) and storage that throws on read, on write or once it is full all
//   boot to a working menu with no page error; an older save is migrated once, and a choice made after that sticks;
//   Hari: two tabs of one browser share the save; a race finishing in one tab keeps what the other tab saved during the
//   race, and the idle tab shows the race's reward at once.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRoomServer, launchChromium, routeExternal, waitUntil, waitForMenu } from './harness.mjs';

const SAVE_KEY = 'chapri-racer-save-v1';
const VIEW = { width: 640, height: 360 };
const RACE_QUERY = '?autopilot&q=low&timescale=3&track=mumbai-central&laps=1';
const DEFAULT_COINS = 1500;
const DEFAULT_COS = { shirt: 'floral-pink', helmet: 'none', shades: 'gold', hair: 'pomp-brown' };
const FREE_BUILDS = { stock: true, kaali: true, chrome: true };
let server = null, browser = null;
const everyone = [];
const P = {};

function watch(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
}
// One visitor = one browser context. `init` runs before any page script on every load of the context (addInitScript);
// `storageState` starts the context with another one's storage, as a browser restart would.
async function visitor(name, { query = '?q=low', init = null, initArg = null, storageState = undefined } = {}) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, storageState });
  context.setDefaultTimeout(120000);
  if (init) await context.addInitScript(init, initArg);
  const page = await context.newPage();
  const errors = [];
  watch(page, errors);
  await routeExternal(page);
  const p = { name, context, page, errors, close: () => context.close() };
  everyone.push(p);
  if (query !== null) await load(p, query);
  return p;
}
// A second tab in a visitor's browser: the same context, so the same localStorage.
async function secondTab(p, name, query) {
  const page = await p.context.newPage();
  const errors = [];
  watch(page, errors);
  await routeExternal(page);
  const q = { name, context: p.context, page, errors, close: () => page.close() };
  everyone.push(q);
  await page.goto(server.url + '/' + query, { waitUntil: 'domcontentloaded' });
  return q;
}
async function load(p, query = '?q=low') {
  await p.page.goto(server.url + '/' + query, { waitUntil: 'domcontentloaded' });
  await waitForMenu(p.page);
  await settle(p);
}
// The menu shows before the first frames are drawn, and those frames (shader programs, the profile portrait) can take a
// while on a software GPU. The page is in use once the game clock runs; a frame loop that throws never gets there.
const settle = (p) => waitUntil(p.page, () => !!window.__chapri && window.__chapri.state !== 'loading' && window.__chapri.t > 1.5,
  null, { timeout: 300000, message: `${p.name}'s first frames` });
// Plants a save before the first load only, so that a reload reads what the game itself wrote.
function plantOnce([k, v]) { try { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch (e) { /* about:blank has no storage */ } }

// What the home screen shows. The template's placeholders are "1", "0 / 1,000" and "0" coins; the coin count proves
// that the menu was rendered from a save, not left as the placeholder.
const menuView = (p) => p.page.evaluate(() => ({
  state: window.__chapri && window.__chapri.state,
  menu: document.querySelector('#menu').classList.contains('show'),
  lv: document.querySelector('#lvNum').textContent,
  xp: document.querySelector('#xpTxt').textContent,
  coins: document.querySelector('#coins').textContent,
  name: document.querySelector('#pName').textContent,
}));
const readKey = (p, key) => p.page.evaluate((k) => { try { return localStorage.getItem(k); } catch (e) { return 'storage threw: ' + e.name; } }, key);
const stored = async (p) => { const raw = await readKey(p, SAVE_KEY); return raw === null ? null : JSON.parse(raw); };
const liveSave = (p) => p.page.evaluate(() => window.__save());
// Waits until the stored save passes `pred` (checked here, in Node) and returns it.
async function storedWhen(p, pred, message, timeout = 60000) {
  const end = Date.now() + timeout;
  for (;;) {
    const s = await stored(p).catch(() => null);
    if (s && pred(s)) return s;
    if (Date.now() > end) throw new Error(`timed out after ${timeout} ms waiting for ${message}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
// The daily challenges belong to the day, not to the save as stored, so the load comparisons leave them out.
const withoutDaily = (s) => { const { daily, ...rest } = s; return rest; };
// On the results screen the finished race still rolls on behind it, and a coin picked up then is added in memory only,
// until the next checkpoint. Comparisons made after a race leave the coins to their own check.
const withoutCoins = (s) => ({ ...s, coins: 0 });

// The game's level curve (levelFromXp in 00_core.js), number format (fmtNum) and lap time format (fmtTime).
const fmt = (n) => Math.round(n).toLocaleString('en-IN');
function levelText(xp) {
  let lvl = 1, need = 1000, acc = 0;
  while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.18 / 10) * 10; }
  return { lv: String(lvl), xp: `${fmt(xp - acc)} / ${fmt(need)}` };
}
const lapText = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const FRESH = { state: 'menu', menu: true, lv: '1', xp: '0 / 1,000', coins: fmt(DEFAULT_COINS), name: 'PotatoBazaar' };

describe('guest progress', () => {
  let afterRace = null, menuAfterRace = null, returning = null, menuReturning = null;

  beforeAll(async () => {
    server = await startRoomServer();
    browser = await launchChromium();
  });
  afterAll(async () => {
    for (const p of everyone) await p.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  });

  it('a fresh visitor starts at level 1 with no XP and the default coins', async () => {
    P.asha = await visitor('Asha');
    expect(await menuView(P.asha)).toEqual(FRESH);
    // nothing is stored before the first checkpoint (a race, a purchase, a setting); the game runs on the default save
    expect(await stored(P.asha)).toBeNull();
    const live = await liveSave(P.asha);
    expect({ xp: live.xp, coins: live.coins, races: live.races, name: live.name, build: live.build, owned: live.owned, records: live.records, ghosts: live.ghosts })
      .toEqual({ xp: 0, coins: DEFAULT_COINS, races: 0, name: 'PotatoBazaar', build: 'chrome', owned: FREE_BUILDS, records: {}, ghosts: {} });
  });

  it('a finished solo race raises XP and coins; the results show, then the menu shows the new level', async () => {
    const A = P.asha, page = A.page;
    await page.goto(server.url + '/' + RACE_QUERY, { waitUntil: 'domcontentloaded' });
    await waitUntil(page, () => !!window.__chapri && window.__chapri.state === 'race' && !!window.__chapri.race,
      null, { timeout: 300000, message: 'the autopilot race to start' });
    expect(await page.evaluate(() => ({ track: window.__chapri.race.def.id, laps: window.__chapri.race.laps }))).toEqual({ track: 'mumbai-central', laps: 1 });
    // ~85 s of race at three times speed, slower when the software GPU drops frames; the results follow 3.6 s after the finish
    await waitUntil(page, () => document.querySelector('#results').classList.contains('show'),
      null, { timeout: 600000, message: 'the results screen after the autopilot race' });
    const total = await page.evaluate(() => document.querySelector('#rTotal').textContent);
    afterRace = await stored(A);
    expect(afterRace).not.toBeNull();
    expect(afterRace.races).toBe(1);
    expect(afterRace.xp).toBeGreaterThan(0);
    // a quick race pays the same total in XP and coins; coins picked up on the track come on top
    expect(total).toBe('+' + fmt(afterRace.xp));
    expect(afterRace.coins).toBeGreaterThanOrEqual(DEFAULT_COINS + afterRace.xp);
    // the lap set the track's first lap record and its ghost, and the finish its best place
    const rec = afterRace.records['mumbai-central'];
    expect(rec.bestLap).toBeGreaterThan(0);
    expect(rec.bestPos).toBeGreaterThanOrEqual(1);
    expect(afterRace.ghosts['mumbai-central'].length).toBeGreaterThan(0);
    const live = await liveSave(A);
    expect(withoutCoins(live)).toEqual(withoutCoins(afterRace));
    expect(live.coins).toBeGreaterThanOrEqual(afterRace.coins);

    await page.click('#rMenu');
    await waitUntil(page, () => window.__chapri.state === 'menu' && document.querySelector('#menu').classList.contains('show'),
      null, { timeout: 120000, message: 'the menu after the results' });
    menuAfterRace = await menuView(A);
    expect(menuAfterRace).toEqual({ ...FRESH, ...levelText(afterRace.xp), coins: fmt(afterRace.coins) });
    // the results screen and the way back to the menu do not change the save
    expect(await stored(A)).toEqual(afterRace);
  });

  it('a reload keeps the XP, coins and level, and the garage, records, settings and name', async () => {
    const A = P.asha, page = A.page;
    // A returning player's save: a name, a volume, a bike and the rain, set through the game's own controls...
    await page.click('#profileBtn');
    await page.$eval('#setName', (el) => { el.value = 'Asha'; el.dispatchEvent(new Event('change')); });
    await page.$eval('#setSfx', (el) => { el.value = '0.35'; el.dispatchEvent(new Event('input')); });
    await page.click('#settings [data-close]');
    await page.click('#buildNext');   // the Chrome Tank → the Stock Silver
    await page.click('#rainTog');
    await storedWhen(A, (s) => s.name === 'Asha' && s.settings.sfx === 0.35 && s.build === 'stock' && s.setup.weather === 'monsoon', 'the menu changes saved');
    // ...and the garage, wardrobe, key binding and cup place an earlier session left in storage
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      Object.assign(s.owned, { sticker: true });
      s.upgrades = { stock: { engine: 2, tyres: 1 }, sticker: { brakes: 3 } };
      s.paint = { stock: '#1d6fb8' };
      s.mods = { stock: { exhaust: 'long', kit: 'guard' } };
      Object.assign(s.ownedMods, { 'exhaust:long': true, 'kit:guard': true });
      s.cos = { shirt: 'check', helmet: 'red', shades: 'black-av', hair: 'quiff-copper' };
      Object.assign(s.ownedCos, { check: true, 'black-av': true });
      Object.assign(s.settings, { traffic: 'jam', keys: { throttle: ['KeyI'] } });
      s.records.cupBest = 2;
      localStorage.setItem(k, JSON.stringify(s));
    }, SAVE_KEY);
    returning = await stored(A);
    expect(returning.setup.track).toBe('mumbai-central');   // not the default track: the last race's

    await load(A, '?q=low');   // a plain visit: no autopilot, so no new race
    menuReturning = { ...menuAfterRace, name: 'Asha' };
    expect(await menuView(A)).toEqual(menuReturning);
    // a plain visit writes nothing, and the game loaded exactly what is stored
    expect(await stored(A)).toEqual(returning);
    expect(withoutDaily(await liveSave(A))).toEqual(withoutDaily(returning));
    expect(returning).toMatchObject({ xp: afterRace.xp, coins: afterRace.coins, races: 1, parts: afterRace.parts });

    // and the screens show it: the bike card, Settings and the records board
    expect(await page.evaluate(() => document.querySelector('#bcTag').textContent)).toBe('STOCK SILVER');
    await page.click('#profileBtn');
    expect(await page.evaluate(() => ({ name: document.querySelector('#setName').value, sfx: document.querySelector('#setSfx').value })))
      .toEqual({ name: 'Asha', sfx: '0.35' });
    await page.click('#settings [data-close]');
    await page.click('.nav[data-open="board"]');
    const row = await page.evaluate(() => [...document.querySelectorAll('#boardBody tr')].map((tr) => [...tr.children].map((td) => td.textContent))
      .find((cells) => cells[0] === 'Mumbai Central'));
    expect(row[1]).toBe(lapText(returning.records['mumbai-central'].bestLap));
    await page.click('#board [data-close]');
  });

  it('a browser restart (a new context with the same storage) keeps them too', async () => {
    const state = await P.asha.context.storageState();
    const again = await visitor('Asha after a restart', { storageState: state });
    expect(await menuView(again)).toEqual(menuReturning);
    expect(await stored(again)).toEqual(returning);
    expect(withoutDaily(await liveSave(again))).toEqual(withoutDaily(returning));
    await again.close();
  });

  it('a brand-new visitor starts fresh again while another one has progress', async () => {
    const B = await visitor('Bunty');
    expect(await menuView(B)).toEqual(FRESH);
    expect(await stored(B)).toBeNull();
    // the first checkpoint stores the default progress
    await B.page.click('#rainTog');
    await storedWhen(B, (s) => s.setup.weather === 'monsoon', "Bunty's rain toggle saved");
    const s = await stored(B);
    expect({ xp: s.xp, coins: s.coins, races: s.races, parts: s.parts, name: s.name, records: s.records })
      .toEqual({ xp: 0, coins: DEFAULT_COINS, races: 0, parts: 3, name: 'PotatoBazaar', records: {} });
    await B.close();
  });

  it('Reset progress in Settings clears it back to level 1, and the reset survives a reload', async () => {
    const A = P.asha, page = A.page;
    const settingsBefore = (await stored(A)).settings;
    expect(settingsBefore).toMatchObject({ sfx: 0.35, traffic: 'jam' });   // not the defaults, so keeping them means something
    await page.click('#profileBtn');
    await page.click('#resetAll');
    await waitUntil(page, () => !document.querySelector('#confirm').hidden, null, { timeout: 60000, message: 'the reset confirmation' });
    await page.click('#cfYes');
    await waitUntil(page, () => document.querySelector('#lvNum').textContent === '1' && document.querySelector('#coins').textContent === '1,500',
      null, { timeout: 60000, message: 'the menu after the reset' });
    expect(await menuView(A)).toEqual(FRESH);
    const s = await stored(A);
    expect({ xp: s.xp, coins: s.coins, races: s.races }).toEqual({ xp: 0, coins: DEFAULT_COINS, races: 0 });
    expect({ name: s.name, build: s.build, owned: s.owned, upgrades: s.upgrades, paint: s.paint, mods: s.mods, cos: s.cos, records: s.records, ghosts: s.ghosts })
      .toEqual({ name: 'PotatoBazaar', build: 'chrome', owned: FREE_BUILDS, upgrades: {}, paint: {}, mods: {}, cos: DEFAULT_COS, records: {}, ghosts: {} });
    expect(s.settings).toEqual(settingsBefore);   // the reset keeps the settings, as its dialog has always done
    await load(A, '?q=low');
    expect(await menuView(A)).toEqual(FRESH);
    expect(withoutDaily(await liveSave(A))).toEqual(withoutDaily(s));
    await A.close();
  });

  it('garbage JSON under the save key falls back to defaults, keeps a copy of it, and the game boots', async () => {
    const garbage = '{"coins": 99999, "xp": 5000, "build": "raja"';   // cut off mid-write
    const C = await visitor('Chotu (garbage save)', {
      init: ([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* about:blank has no storage */ } },
      initArg: [SAVE_KEY, garbage],
    });
    expect(await menuView(C)).toEqual(FRESH);
    expect(await readKey(C, SAVE_KEY + '-unreadable')).toBe(garbage);
    await C.close();
  });

  it('a save with fields of the wrong type keeps its good fields and still boots and runs', async () => {
    // every one of these used to stop the boot or the frame loop: a null daily, an unknown quality tier, a key binding
    // that is not a list, a bike that does not exist, null maps. The page has no ?q=, so the boot takes its graphics
    // tier from the save (the unknown 'ultra' must become 'auto', which then uses the detected 'low').
    const broken = JSON.stringify({
      name: 'Dabbu', xp: 2500, coins: 'lots', parts: 4, build: 'ghost-bike', daily: null, upgrades: null, paint: null, records: null,
      ghosts: { 'mumbai-central': [1, 2, 3] }, owned: 'all', cos: { hair: 'bald' }, ugV1: true, cosV2: true,
      settings: { quality: 'ultra', detected: 'low', sfx: 'loud', keys: { throttle: 'KeyW' } },
      setup: { mode: 'warp', track: 'mars', diff: 'insane', laps: 'many' },
    });
    const D = await visitor('Dabbu (wrong types)', {
      query: '?',
      init: ([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* about:blank has no storage */ } },
      initArg: [SAVE_KEY, broken],
    });
    expect(await menuView(D)).toEqual({ ...FRESH, ...levelText(2500), name: 'Dabbu' });
    const game = await D.page.evaluate(() => ({ quality: window.__chapri.quality, track: window.__chapri.track.def.id }));
    expect(game).toEqual({ quality: 'low', track: 'mumbai-underground' });
    // a checkpoint writes the cleaned save back
    await D.page.click('#rainTog');
    await storedWhen(D, (s) => s.setup.weather === 'monsoon', 'the rain toggle saved');
    const s = await stored(D);
    expect({ xp: s.xp, coins: s.coins, parts: s.parts, build: s.build, owned: s.owned, upgrades: s.upgrades, paint: s.paint, records: s.records, ghosts: s.ghosts, cos: s.cos })
      .toEqual({ xp: 2500, coins: DEFAULT_COINS, parts: 4, build: 'chrome', owned: FREE_BUILDS, upgrades: {}, paint: {}, records: {}, ghosts: {}, cos: DEFAULT_COS });
    expect({ quality: s.settings.quality, detected: s.settings.detected, sfx: s.settings.sfx, keys: s.settings.keys })
      .toEqual({ quality: 'auto', detected: 'low', sfx: 0.8, keys: null });
    expect({ mode: s.setup.mode, track: s.setup.track, diff: s.setup.diff, laps: s.setup.laps })
      .toEqual({ mode: 'quick', track: 'mumbai-underground', diff: 'normal', laps: 2 });
    expect(s.daily).toMatchObject({ prog: {}, claimed: {}, bonus: false });
    expect(withoutDaily(await liveSave(D))).toEqual(withoutDaily(s));
    await D.close();
  });

  it('storage that throws on every access still boots with defaults and plays on', async () => {
    const E = await visitor('Elvis (storage blocked)', {
      init: () => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
      },
    });
    expect(await readKey(E, SAVE_KEY)).toBe('storage threw: SecurityError');
    expect(await menuView(E)).toEqual(FRESH);
    await E.page.click('#rainTog');   // a checkpoint: persist() fails quietly and the game keeps the change in memory
    await waitUntil(E.page, () => document.querySelector('#rainTog').classList.contains('on'), null, { timeout: 60000, message: 'the rain toggle' });
    // the frames go on after the failed write: a second more of game time, with no page error on the way
    const t0 = await E.page.evaluate(() => window.__chapri.t);
    await waitUntil(E.page, (t) => window.__chapri.t > t + 1, t0, { timeout: 120000, message: "Elvis's frames after the failed write" });
    expect(await E.page.evaluate(() => window.__chapri.state)).toBe('menu');
    expect((await liveSave(E)).setup.weather).toBe('monsoon');
    expect(E.errors).toEqual([]);
    await E.close();
  });

  it('storage that throws on write still loads the saved progress and plays on', async () => {
    const save = JSON.stringify({ name: 'Farah', xp: 1200, coins: 3210, ugV1: true, cosV2: true });
    const F = await visitor('Farah (storage full)', {
      init: ([k, v]) => {
        try { localStorage.setItem(k, v); } catch (e) { /* about:blank has no storage */ }
        Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
      },
      initArg: [SAVE_KEY, save],
    });
    expect(await menuView(F)).toEqual({ ...FRESH, ...levelText(1200), coins: fmt(3210), name: 'Farah' });
    await F.page.click('#rainTog');
    await waitUntil(F.page, () => document.querySelector('#rainTog').classList.contains('on'), null, { timeout: 60000, message: 'the rain toggle' });
    expect(JSON.parse(await readKey(F, SAVE_KEY))).toEqual(JSON.parse(save));   // the write failed; the stored save is untouched
    expect((await liveSave(F)).setup.weather).toBe('monsoon');
    await F.close();
  });

  it('storage that is nearly full gives up the time-trial ghosts, not the progress', async () => {
    // The ghost holds a sample no other part of the save has: storage takes every write without it, none with it.
    const MARK = '4242.4242';
    const save = JSON.stringify({
      name: 'Gita', xp: 1800, coins: 2600, ugV1: true, cosV2: true,
      records: { 'mumbai-central': { bestLap: 61.5 } }, ghosts: { 'mumbai-central': [[0, 0, 0, 0, 0, 0], [+MARK, 0.1, 0, 0, 0, 0.5]] },
    });
    const G = await visitor('Gita (storage nearly full)', {
      init: ([k, v, mark]) => {
        try { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch (e) { /* about:blank has no storage */ }
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (String(value).includes(mark)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
          return setItem.call(this, key, value);
        };
      },
      initArg: [SAVE_KEY, save, MARK],
    });
    expect(await menuView(G)).toEqual({ ...FRESH, ...levelText(1800), coins: fmt(2600), name: 'Gita' });
    expect((await liveSave(G)).ghosts['mumbai-central']).toHaveLength(2);
    await G.page.click('#rainTog');
    await storedWhen(G, (s) => s.setup.weather === 'monsoon', 'the rain toggle saved without the ghost');
    const s = await stored(G);
    expect({ name: s.name, xp: s.xp, coins: s.coins, records: s.records, ghosts: s.ghosts })
      .toEqual({ name: 'Gita', xp: 1800, coins: 2600, records: { 'mumbai-central': { bestLap: 61.5 } }, ghosts: {} });
    // this session keeps the ghost to race against
    expect((await liveSave(G)).ghosts['mumbai-central']).toHaveLength(2);
    await G.close();
  });

  it('an older save is migrated once, and a choice made after that survives a reload', async () => {
    // a save from before the Underground map and the cosmetics rework (no ugV1 or cosV2 flag), with a graphics tier
    // this build does not know
    const old = JSON.stringify({
      name: 'Gopal', xp: 600, coins: 2200, cos: { shirt: 'check', helmet: 'red', shades: 'white', hair: 'quiff-copper' }, ownedCos: { check: true },
      setup: { mode: 'police', track: 'sion-flyover', laps: 4, diff: 'hard' }, settings: { quality: 'low', detected: 'ultra', music: 0.25 },
    });
    const G = await visitor('Gopal (older save)', { init: plantOnce, initArg: [SAVE_KEY, old] });
    expect(await menuView(G)).toEqual({ ...FRESH, ...levelText(600), coins: fmt(2200), name: 'Gopal' });
    let live = await liveSave(G);
    expect({ cos: live.cos, setup: live.setup, ugV1: live.ugV1, cosV2: live.cosV2, music: live.settings.music, detected: live.settings.detected }).toEqual({
      cos: { shirt: 'check', helmet: 'red', shades: 'gold', hair: 'pomp-brown' },
      setup: { mode: 'quick', track: 'mumbai-underground', laps: 2, diff: 'hard', time: 'auto', weather: 'clear', combat: true },
      ugV1: true, cosV2: true, music: 0.25, detected: undefined,
    });
    // pick the white frames and the copper quiff again in the Store (both free); that stores the save with both flags
    await G.page.click('.pill.coin');
    await waitUntil(G.page, () => document.querySelector('#store').classList.contains('show') && !!document.querySelector('[data-cos="shades:white"]'),
      null, { timeout: 60000, message: 'the Store' });
    await G.page.click('[data-cos="shades:white"]');
    await G.page.click('[data-cos="hair:quiff-copper"]');
    await storedWhen(G, (s) => s.cos.shades === 'white' && s.cos.hair === 'quiff-copper', 'the Store picks saved');
    const s = await stored(G);
    expect({ ugV1: s.ugV1, cosV2: s.cosV2, detected: s.settings.detected, track: s.setup.track }).toEqual({ ugV1: true, cosV2: true, detected: undefined, track: 'mumbai-underground' });
    // the reload must not run the migration again on the new picks
    await load(G, '?q=low');
    live = await liveSave(G);
    expect(live.cos).toEqual({ shirt: 'check', helmet: 'red', shades: 'white', hair: 'quiff-copper' });
    expect(withoutDaily(live)).toEqual(withoutDaily(s));
    await G.close();
  });

  it('two tabs share the save: a race in one tab keeps what the other saved meanwhile, and the idle tab shows the race', async () => {
    // The friends invite link is often opened in a second tab of the same browser. Both tabs work on one stored save.
    const H = await visitor('Hari (menu tab)');
    const R = await secondTab(H, 'Hari (race tab)', RACE_QUERY);
    await waitUntil(R.page, () => !!window.__chapri && window.__chapri.state === 'race' && !!window.__chapri.race,
      null, { timeout: 300000, message: 'the autopilot race in the second tab' });

    // while the race runs, the menu tab collects the daily login bonus (+100 coins) and changes the rider's name
    await H.page.click('#bell');
    const { lastLogin } = await storedWhen(H, (s) => !!s.lastLogin, 'the login bonus saved');
    await H.page.click('#profileBtn');
    await H.page.$eval('#setName', (el) => { el.value = 'Hari'; el.dispatchEvent(new Event('change')); });
    await H.page.click('#settings [data-close]');
    await storedWhen(H, (s) => s.name === 'Hari', 'the new name saved');
    // A racing tab does not take another tab's save mid-race. Its own write does merge it in, and a long wheelie or a
    // knockdown writes mid-race, so the old name is certain only while the race tab has not written.
    const mid = await R.page.evaluate(() => { const s = window.__save(); return { state: window.__chapri.state, name: s.name, wrote: (s.daily.prog.wheelies || 0) + (s.daily.prog.knockdowns || 0) > 0 }; });
    expect(mid.state).toBe('race');
    expect(mid.wrote || mid.name === 'PotatoBazaar', `the race tab took the other tab's save mid-race: ${JSON.stringify(mid)}`).toBe(true);

    // The race ends. In the race tab's memory the reward went on top of the other tab's save: its name, its login
    // bonus, and every coin picked up on the track. Read in one go, as the race still rolls on behind the results.
    await waitUntil(R.page, () => document.querySelector('#results').classList.contains('show'),
      null, { timeout: 600000, message: 'the results in the race tab' });
    const atResults = await R.page.evaluate(() => {
      const s = window.__save();
      return { name: s.name, lastLogin: s.lastLogin, xp: s.xp, coins: s.coins, got: window.__chapri.race.coinsGot || 0, total: document.querySelector('#rTotal').textContent };
    });
    expect(atResults.xp).toBeGreaterThan(0);
    expect(atResults.total).toBe('+' + fmt(atResults.xp));
    expect(atResults).toMatchObject({ name: 'Hari', lastLogin, coins: DEFAULT_COINS + 100 + atResults.xp + 5 * atResults.got });
    // back in the menu the race is over, so the save stays as stored until the next checkpoint
    await R.page.click('#rMenu');
    await waitUntil(R.page, () => window.__chapri.state === 'menu' && document.querySelector('#menu').classList.contains('show'),
      null, { timeout: 120000, message: "the race tab's menu" });
    const s = await stored(H);
    expect({ name: s.name, lastLogin: s.lastLogin, loginDays: s.loginDays, races: s.races, xp: s.xp })
      .toEqual({ name: 'Hari', lastLogin, loginDays: 1, races: 1, xp: atResults.xp });
    expect(s.coins).toBeGreaterThanOrEqual(DEFAULT_COINS + 100 + s.xp);
    expect(s.records['mumbai-central'].bestLap).toBeGreaterThan(0);
    expect(withoutCoins(await liveSave(R))).toEqual(withoutCoins(s));

    // the menu tab took the race's save as soon as it was written, and its menu shows the new level
    await waitUntil(H.page, ([xp, coins]) => window.__save().xp === xp && window.__save().coins === coins, [s.xp, s.coins],
      { timeout: 60000, message: 'the menu tab to take the race' });
    expect(await liveSave(H)).toEqual(s);
    await waitUntil(H.page, (c) => document.querySelector('#coins').textContent === c, fmt(s.coins), { timeout: 60000, message: "the menu tab's coins" });
    expect(await menuView(H)).toEqual({ ...FRESH, ...levelText(s.xp), coins: fmt(s.coins), name: 'Hari' });

    // a later save in the menu tab keeps the race's reward
    await H.page.click('#rainTog');
    const s2 = await storedWhen(H, (x) => x.setup.weather === 'monsoon', "the menu tab's rain toggle saved");
    expect({ xp: s2.xp, coins: s2.coins, races: s2.races, name: s2.name, records: s2.records, ghosts: s2.ghosts })
      .toEqual({ xp: s.xp, coins: s.coins, races: 1, name: 'Hari', records: s.records, ghosts: s.ghosts });

    // and the race tab, idle in its menu, takes the rain the other tab turned on and shows it
    await waitUntil(R.page, () => window.__save().setup.weather === 'monsoon' && document.querySelector('#rainTog').classList.contains('on'),
      null, { timeout: 60000, message: 'the race tab to take the rain' });
    const liveR = await liveSave(R);
    expect(withoutCoins(liveR)).toEqual(withoutCoins(s2));
    expect(liveR.coins).toBeGreaterThanOrEqual(s2.coins);
    expect(await menuView(R)).toEqual({ ...FRESH, ...levelText(s.xp), coins: fmt(liveR.coins), name: 'Hari' });
    await H.close();
  });

  it('logged no console errors and no page errors on any page', () => {
    for (const p of everyone) expect(p.errors, p.name).toEqual([]);
  });
});
