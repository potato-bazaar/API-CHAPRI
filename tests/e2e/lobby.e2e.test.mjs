// Friends-room lobby, end to end: the real room server, the built game page, and one browser context per player (each
// one is like a separate phone or laptop, with its own localStorage and sessionStorage). The tests run in order and
// share the same room: create, wrong PIN, join by PIN, join by invite link, settings, host-only controls, reload,
// leave, host migration, invite link with a saved name, an invite link to another room from a tab that holds a seat,
// and the rooms closing when the server shuts down. The last checks drive the lobby code directly on an offline page.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRoomServer, launchChromium, routeExternal, waitUntil, waitForMenu } from './harness.mjs';

const VIEW = { width: 640, height: 360 };   // small pages and ?q=low keep three WebGL pages affordable
const FPS = 6;
let server = null, browser = null, serverOpen = false, pin = null;
const P = {};
const everyone = [];

// The harness's openPlayer, plus a frame cap. Three uncapped SwiftShader pages starve each other on a few cores (a frame
// every few seconds), so every click and every handshake in a page waits on the others. The cap only skips animation
// frames; the game code is the same and the lobby does not depend on the frame rate. All callbacks of an allowed frame run.
async function player(name, query = '?q=low') {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  context.setDefaultTimeout(120000);
  await context.addInitScript((fps) => {
    const raf = window.requestAnimationFrame.bind(window);
    let allowed = -1e9;
    window.requestAnimationFrame = (cb) => raf(function gate(t) {
      if (t === allowed || t - allowed >= 1000 / fps) { allowed = t; cb(t); } else raf(gate);
    });
  }, FPS);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await routeExternal(page);
  await page.goto(server.url + '/' + query, { waitUntil: 'domcontentloaded' });
  const p = { context, page, errors, name, close: () => context.close() };
  everyone.push(p);
  return p;
}

// What the page was doing, for a failure message (never the session token).
function diag(page) {
  return page.evaluate(() => JSON.stringify({
    url: location.pathname + location.search, state: window.__chapri && window.__chapri.state, booted: window.__mpui && window.__mpui.booted,
    dialog: !document.querySelector('#friends').hidden, msg: document.querySelector('#mpEntryMsg').textContent,
    lobby: document.querySelector('#mpLobby').classList.contains('show'), status: window.__mp && window.__mp.status, room: !!(window.__mp && window.__mp.room),
    notes: window.__mpui ? window.__mpui.recent.slice(-4) : [],
  })).catch((e) => 'no page state: ' + e.message);
}

// Like the harness's waitUntil, with fast polling for the timing checks and the page's state in the error.
async function waitFor(page, predicate, arg, timeout, message) {
  try {
    await page.waitForFunction(predicate, arg, { timeout, polling: 50 });
  } catch (e) {
    throw new Error(`timed out after ${timeout} ms waiting for ${message}; page: ${await diag(page)}`);
  }
}

// The menu shows before the game draws its first frame, and that first frame (shader programs, the profile portrait) can
// hold a software-GPU page for a minute on a busy machine. A page is ready to use once the game clock runs.
const settle = (p) => waitFor(p.page, () => !!window.__chapri && window.__chapri.state !== 'loading' && window.__chapri.t > 1.5, null, 300000, `${p.name}'s first frames`);

// A new track behind the lobby is a new 3D world, and its first frames can also hold a software-GPU page for a while.
// Timing checks start only once every page involved is drawing again.
async function steady(p) {
  const t0 = await p.page.evaluate(() => window.__chapri.t);
  await waitFor(p.page, (t) => window.__chapri.t > t + 1, t0, 300000, `${p.name}'s frames after a scene change`);
}

// a game boot (page load or reload) is part of some of these waits, hence the long limit
const inLobby = (p) => waitFor(p.page, () => document.querySelector('#mpLobby').classList.contains('show') && !!window.__mp.room,
  null, 300000, `${p.name} in the lobby`);

// What a player sees in the lobby, read from the DOM.
function lobby(p) {
  return p.page.evaluate(() => {
    const shown = (sel) => { const el = document.querySelector(sel); return !!el && !el.hidden && el.getClientRects().length > 0; };
    const seg = (id) => {
      const btns = [...document.querySelectorAll(`#${id} button`)];
      const on = btns.filter((b) => b.classList.contains('on'));
      return { value: on.length === 1 ? on[0].dataset.v : null, pressed: btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.v), disabled: btns.every((b) => b.disabled), enabled: btns.every((b) => !b.disabled) };
    };
    return {
      shown: document.querySelector('#mpLobby').classList.contains('show'),
      pin: document.querySelector('#mpPin').textContent,
      count: document.querySelector('#mpCount').textContent,
      roster: [...document.querySelectorAll('#mpRoster li')].map((li) => ({ name: li.querySelector('.mp-who b').textContent, host: !!li.querySelector('.mp-badge.host'), you: !!li.querySelector('.mp-badge.you'), connected: !li.classList.contains('off'), bike: li.querySelector('.mp-bikec').textContent })),
      track: seg('mpTrack'), laps: seg('mpLaps'), time: seg('mpTime'), weather: seg('mpWeather'),
      hostNote: shown('#mpHostNote'), start: shown('#mpStart'), waitFriends: shown('#mpWaitFriends'), waitHost: shown('#mpWaitHost'),
      seat: window.__mp.seat,
    };
  });
}
const countIs = (p, n, timeout = 15000) => waitFor(p.page, (c) => document.querySelector('#mpCount').textContent === c, `${n}/8`, timeout, `${p.name} to show ${n}/8`);
const noted = (p, text, timeout = 15000) => waitFor(p.page, (t) => window.__mpui.recent.includes(t), text, timeout, `${p.name} to get the notice "${text}"`);
// Never print the token itself: only whether it looks right.
const session = (p) => p.page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('chapri-mp-session') || 'null'); return s && { pin: s.pin, tokenOk: /^[0-9a-f]{32}$/.test(s.token) }; });

async function openFriends(p) {
  await p.page.click('button[data-open="friends"]');
  await p.page.waitForSelector('#friends:not([hidden])');
}

describe('friends room lobby', () => {
  beforeAll(async () => {
    // A reload here means a full game boot on a software GPU, which can take longer than the real 60 s seat grace
    // on a busy machine. The grace itself is not under test, so give the seat ten minutes.
    server = await startRoomServer({ timers: { reconnectGraceMs: 600000 } });
    serverOpen = true;
    browser = await launchChromium();
    // two players boot side by side; the game boot is the slow part on a few cores
    [P.A, P.B] = await Promise.all([player('Asha'), player('Bunty')]);
    await Promise.all([waitForMenu(P.A.page), waitForMenu(P.B.page)]);
    await Promise.all([settle(P.A), settle(P.B)]);
  });

  afterAll(async () => {
    for (const p of everyone) await p.close().catch(() => {});
    if (browser) await browser.close();
    if (server && serverOpen) await server.close();
  });

  it('creates a room: the PIN shows and the roster is 1/8 with HOST and YOU', async () => {
    const A = P.A;
    await openFriends(A);
    expect(await A.page.inputValue('#mpName')).toBe('PotatoBazaar');   // prefilled from the (fresh) save
    // the privacy note opens from its link
    await A.page.click('#mpPrivacyBtn');
    expect(await A.page.getAttribute('#mpPrivacyBtn', 'aria-expanded')).toBe('true');
    expect(await A.page.textContent('#mpPrivacy')).toContain('It keeps IP addresses in memory only, to limit open connections and wrong PIN guesses per address. It counts room creation under a keyed hash of the address, with a secret that changes each time the server starts. Nothing is written to disk, and each count is dropped as soon as it no longer applies.');
    await A.page.fill('#mpName', 'Asha');
    await A.page.click('#mpCreate');
    await inLobby(A);
    await steady(A);
    const L = await lobby(A);
    expect(L.pin).toMatch(/^\d{4}$/);
    expect(L.count).toBe('1/8');
    expect(L.roster).toEqual([{ name: 'Asha', host: true, you: true, connected: true, bike: 'Chrome Tank' }]);
    // alone: no start button yet, the dashed waiting box instead; the host's controls are live
    expect(L.start).toBe(false);
    expect(L.waitFriends).toBe(true);
    expect(L.track.enabled && L.laps.enabled && L.time.enabled && L.weather.enabled).toBe(true);
    expect(L.hostNote).toBe(false);
    expect(L.track.pressed).toEqual([L.track.value]);
    expect(await session(A)).toEqual({ pin: L.pin, tokenOk: true });
    // the typed name is the player's name from now on
    expect(await A.page.evaluate(() => JSON.parse(localStorage.getItem('chapri-racer-save-v1')).name)).toBe('Asha');
    pin = L.pin;
  });

  it('a wrong PIN shows the NOT_FOUND message and stays in the dialog', async () => {
    const B = P.B;
    await openFriends(B);
    await B.page.fill('#mpName', 'Bunty');
    await B.page.fill('#mpPinIn', pin === '0000' ? '0001' : '0000');
    await B.page.click('#mpJoin');
    await waitFor(B.page, () => document.querySelector('#mpEntryMsg').classList.contains('err'), null, 30000, 'the error message');
    expect(await B.page.textContent('#mpEntryMsg')).toBe('No room has that PIN. Check the 4 digits with your friend.');
    expect(await B.page.evaluate(() => document.querySelector('#mpLobby').classList.contains('show'))).toBe(false);
    expect(await session(B)).toBe(null);
    // the PIN field takes digits only
    await B.page.fill('#mpPinIn', '');
    await B.page.type('#mpPinIn', '12ab345');
    expect(await B.page.inputValue('#mpPinIn')).toBe('1234');
  });

  it('a second player joins by typing the PIN, a third by the invite link, and all three see 3/8 within a second', async () => {
    const A = P.A, B = P.B;
    await B.page.fill('#mpPinIn', pin);
    await B.page.press('#mpPinIn', 'Enter');
    await inLobby(B);
    await countIs(A, 2, 15000);
    await Promise.all([steady(A), steady(B)]);
    expect((await lobby(B)).roster.map((r) => [r.name, r.host, r.you])).toEqual([['Asha', true, false], ['Bunty', false, true]]);
    // two racers: the host gets START RACE, the guest waits for the host
    const LA = await lobby(A), LB = await lobby(B);
    expect([LA.start, LA.waitFriends, LA.waitHost]).toEqual([true, false, false]);
    expect([LB.start, LB.waitFriends, LB.waitHost]).toEqual([false, false, true]);
    await noted(A, 'Bunty joined the room');

    // COPY LINK copies <origin>/?room=PIN
    await A.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
    await A.page.click('#mpCopy');
    await noted(A, 'Invite link copied');
    const link = await A.page.evaluate(() => navigator.clipboard.readText());
    const origin = await A.page.evaluate(() => location.origin);
    expect(link).toBe(`${origin}/?room=${pin}`);

    // a brand-new browser opens the link: the dialog opens with the PIN in and asks for a name first
    P.C = await player('Chotu', `?room=${pin}&q=low`);
    const C = P.C;
    await waitForMenu(C.page);
    await waitFor(C.page, () => !document.querySelector('#friends').hidden, null, 300000, 'the invite dialog');
    await settle(C);
    expect(await C.page.inputValue('#mpPinIn')).toBe(pin);
    expect(await C.page.textContent('#mpEntryMsg')).toBe('Type your name, then tap JOIN.');
    expect(await C.page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('mpName');
    // every page notes the moment it learns of the third racer (one machine, one clock); the lobby redraws in the same call
    for (const p of [A, B, C]) await p.page.evaluate(() => { window.__seen3 = 0; window.__mp.on('room', (r) => { if (!window.__seen3 && r.racers.length === 3) window.__seen3 = Date.now(); }); });
    await C.page.fill('#mpName', 'Chotu');
    await C.page.click('#mpJoin');
    await inLobby(C);
    expect((await lobby(C)).count).toBe('3/8');   // C's own view comes with the join answer
    await Promise.all([countIs(A, 3, 1000), countIs(B, 3, 1000)]);
    const [seenA, seenB, seenC] = await Promise.all([A, B, C].map((p) => p.page.evaluate(() => window.__seen3)));
    expect(seenA > 0 && seenB > 0 && seenC > 0).toBe(true);
    expect(Math.max(seenA, seenB) - seenC).toBeLessThan(1000);
    for (const p of [A, B, C]) {
      const L = await lobby(p);
      expect(L.pin).toBe(pin);
      expect(L.roster.map((r) => r.name)).toEqual(['Asha', 'Bunty', 'Chotu']);
      expect(L.roster.filter((r) => r.you).map((r) => r.name)).toEqual([p.name]);
      expect(L.roster.filter((r) => r.host).map((r) => r.name)).toEqual(['Asha']);
    }
    // the invite link's ?room= is gone after the join, so a later reload does not join again
    expect(new URL(C.page.url()).searchParams.has('room')).toBe(false);
    expect(new URL(C.page.url()).searchParams.get('q')).toBe('low');
  });

  it('the host changes track, laps, time and weather, and the others see it', async () => {
    const A = P.A, B = P.B, C = P.C;
    await A.page.click('#mpTrack button[data-v="sion-flyover"]');
    await A.page.click('#mpLaps button[data-v="5"]');
    await A.page.click('#mpTime button[data-v="night"]');
    await A.page.click('#mpWeather button[data-v="monsoon"]');
    const want = { track: 'sion-flyover', laps: '5', time: 'night', weather: 'monsoon' };
    const sees = (w) => ['mpTrack', 'mpLaps', 'mpTime', 'mpWeather'].every((id, i) => { const on = document.querySelector(`#${id} button.on`); return on && on.dataset.v === Object.values(w)[i] && on.getAttribute('aria-pressed') === 'true'; });
    for (const p of [A, B, C]) await waitFor(p.page, sees, want, 30000, `${p.name} to see the new settings`);
    for (const p of [A, B, C]) {
      const L = await lobby(p);
      expect([L.track.value, L.laps.value, L.time.value, L.weather.value]).toEqual(Object.values(want));
      expect(L.track.pressed).toEqual(['sion-flyover']);
    }
    // the menu scene behind the lobby follows the room: Sion Flyover, at night, in the rain
    for (const p of [B, C]) {
      await waitFor(p.page, () => window.__chapri.track.def.id === 'sion-flyover' && window.__chapri.wet === true && window.__chapri.state === 'menu', null, 30000, `${p.name}'s backdrop`);
    }
    await noted(B, 'The host changed the race settings');
    // Random is a choice too, shown as Random
    await A.page.click('#mpTrack button[data-v="random"]');
    await waitFor(B.page, () => { const on = document.querySelector('#mpTrack button.on'); return on && on.dataset.v === 'random' && on.textContent === 'Random'; }, null, 30000, 'Random on the guest');
  });

  it('only the host can change the settings; every racer picks their own bike', async () => {
    const A = P.A, B = P.B, C = P.C;
    for (const p of [B, C]) {
      const L = await lobby(p);
      expect(L.track.disabled && L.laps.disabled && L.time.disabled && L.weather.disabled).toBe(true);
      expect(L.hostNote).toBe(true);
      expect(await p.page.textContent('#mpHostNote')).toBe('The host picks the track');
    }
    const LA = await lobby(A);
    expect(LA.track.enabled).toBe(true);
    expect(LA.hostNote).toBe(false);
    // a guest's bike: the carousel only offers owned builds (a fresh save owns Stock Silver, Kaali-Peeli and Chrome Tank)
    const names = [];
    for (let i = 0; i < 4; i++) { await B.page.click('#mpBikeNext'); names.push(await B.page.textContent('#mpBikeName')); }
    expect(names).toEqual(['Stock Silver', 'Kaali-Peeli', 'Chrome Tank', 'Stock Silver']);
    await waitFor(A.page, () => [...document.querySelectorAll('#mpRoster li')].some((li) => li.querySelector('.mp-who b').textContent === 'Bunty' && li.querySelector('.mp-bikec').textContent === 'Stock Silver'), null, 30000, 'Bunty on Stock Silver');
    // keyboard: the controls are real buttons, reachable with Tab and pressed with Enter
    await A.page.focus('#mpLaps button[data-v="1"]');
    await A.page.keyboard.press('Enter');
    await waitFor(C.page, () => document.querySelector('#mpLaps button.on').dataset.v === '1', null, 30000, 'laps 1 on the guest');
  });

  it('a reload keeps the same seat in the same room', async () => {
    const A = P.A, B = P.B;
    const before = await lobby(B);
    await B.page.reload({ waitUntil: 'domcontentloaded' });
    await inLobby(B);
    await settle(B);
    const after = await lobby(B);
    expect(after.pin).toBe(before.pin);
    expect(after.seat).toBe(before.seat);
    expect(after.count).toBe('3/8');
    expect(after.roster.filter((r) => r.you).map((r) => r.name)).toEqual(['Bunty']);
    expect(await session(B)).toEqual({ pin, tokenOk: true });
    await waitFor(A.page, () => [...document.querySelectorAll('#mpRoster li')].some((li) => li.querySelector('.mp-who b').textContent === 'Bunty' && !li.classList.contains('off')), null, 10000, 'Bunty connected again');
  });

  it('leaving takes the player back to the menu and updates the others', async () => {
    const A = P.A, B = P.B, C = P.C;
    await C.page.click('#mpLeave');
    await waitUntil(C.page, () => document.querySelector('#menu').classList.contains('show') && !document.querySelector('#mpLobby').classList.contains('show'), null, { timeout: 120000, message: 'the menu after leaving' });
    expect(await session(C)).toBe(null);
    expect(await C.page.evaluate(() => window.__mp.room === null && window.__chapri.state === 'menu')).toBe(true);
    // the socket closes once the server has the leave
    await waitFor(C.page, () => window.__mp.status === 'offline', null, 30000, 'Chotu offline after leaving');
    await Promise.all([countIs(A, 2, 15000), countIs(B, 2, 15000)]);
    expect((await lobby(A)).roster.map((r) => r.name)).toEqual(['Asha', 'Bunty']);
    await noted(A, 'Chotu left the room');
  });

  it('when the host leaves, the next racer becomes the host', async () => {
    const A = P.A, B = P.B;
    await A.page.click('#mpLeave');
    await countIs(B, 1, 15000);
    await waitFor(B.page, () => !!document.querySelector('#mpRoster li .mp-badge.host'), null, 15000, 'a host badge');
    const L = await lobby(B);
    expect(L.roster).toEqual([{ name: 'Bunty', host: true, you: true, connected: true, bike: 'Stock Silver' }]);
    expect(L.track.enabled).toBe(true);
    expect(L.hostNote).toBe(false);
    expect([L.start, L.waitFriends]).toEqual([false, true]);   // alone again
    await noted(B, 'You are the host now');
  });

  it('a player with a saved name joins from an invite link at once', async () => {
    const B = P.B, C = P.C;
    await C.page.goto(`${server.url}/?room=${pin}&q=low`, { waitUntil: 'domcontentloaded' });
    await inLobby(C);   // no typing: the saved name Chotu is used
    await settle(C);
    await countIs(B, 2, 15000);
    // the roster is in seat order, and Chotu may get the seat Asha freed, so compare by name
    const seen = (await lobby(C)).roster.map((r) => [r.name, r.you, r.host]).sort((a, b) => a[0].localeCompare(b[0]));
    expect(seen).toEqual([['Bunty', false, true], ['Chotu', true, false]]);
    const LB = await lobby(B);
    expect([LB.start, LB.waitFriends]).toEqual([true, false]);
  });

  it('an invite link to another room takes a player there from the room this tab is in', async () => {
    const A = P.A, B = P.B, C = P.C;
    // Asha, on the menu since she left, opens a room of her own
    await openFriends(A);
    expect(await A.page.inputValue('#mpName')).toBe('Asha');
    await A.page.click('#mpCreate');
    await inLobby(A);
    const pin2 = (await lobby(A)).pin;
    expect(pin2).toMatch(/^\d{4}$/);
    expect(pin2).not.toBe(pin);
    // Chotu holds a seat in the first room, and opens Asha's link in the same tab (the session survives the navigation)
    expect(await session(C)).toEqual({ pin, tokenOk: true });
    await A.page.evaluate(() => { window.__mpui.recent.length = 0; });   // Asha already heard "Chotu joined" once, in the first room
    await C.page.goto(`${server.url}/?room=${pin2}&q=low`, { waitUntil: 'domcontentloaded' });
    await waitFor(C.page, (p2) => document.querySelector('#mpLobby').classList.contains('show') && !!window.__mp.room && window.__mp.room.pin === p2,
      pin2, 300000, 'Chotu in the second room');
    await settle(C);
    const L = await lobby(C);
    expect(L.pin).toBe(pin2);
    expect(L.roster.map((r) => [r.name, r.you, r.host]).sort((a, b) => a[0].localeCompare(b[0]))).toEqual([['Asha', false, true], ['Chotu', true, false]]);
    expect(await session(C)).toEqual({ pin: pin2, tokenOk: true });
    expect(new URL(C.page.url()).searchParams.has('room')).toBe(false);
    await countIs(A, 2, 15000);
    await noted(A, 'Chotu joined the room');
    // the first room keeps Chotu's old seat as disconnected until its grace period ends, like any dropped racer
    await waitFor(B.page, () => [...document.querySelectorAll('#mpRoster li')].some((li) => li.querySelector('.mp-who b').textContent === 'Chotu' && li.classList.contains('off')),
      null, 15000, 'Chotu shown as disconnected in the first room');
    expect((await lobby(B)).pin).toBe(pin);
  });

  it('when the server shuts down, everyone in the room is told it closed and goes back to the menu', async () => {
    const A = P.A, B = P.B, C = P.C;
    serverOpen = false;
    await server.close();
    for (const p of [A, B, C]) {
      await waitUntil(p.page, () => document.querySelector('#menu').classList.contains('show'), null, { timeout: 120000, message: `${p.name} back on the menu` });
      await noted(p, 'That room has closed.');
      expect(await session(p)).toBe(null);
    }
  });

  it('cleans every look and name from the network, and shows names as text', async () => {
    const A = P.A;   // back on the menu, offline: a safe place to call the pure helpers
    const out = await A.page.evaluate(() => {
      const L = window.__mp.sanitizeLook;
      const bad = JSON.parse('{"tank":"red","accent":"#00ff00","lod":true,"ghost":true,"basic":true,"helmet":"url(x)","shades":null,"hair":"mohawk","flowers":"yes","chrome":true,"mods":{"exhaust":"rocket","tyres":"fat","kit":["x"]},"__proto__":{"polluted":1}}');
      const clean = L(bad, 'raja');
      return {
        keys: Object.keys(clean).sort(), tank: clean.tank, accent: clean.accent, helmet: clean.helmet, shades: clean.shades, hair: clean.hair,
        flowers: clean.flowers, chrome: clean.chrome, mods: clean.mods, flags: ['lod', 'ghost', 'basic', 'polluted'].filter((k) => k in clean),
        notObject: L('nope', 'stock').tank, arr: L([1, 2], 'kaali').tank,
        names: [window.__mp.cleanName('  Asha\u202e\u0007  '), window.__mp.cleanName(''), window.__mp.cleanName('abcdefghijklmnopqrstu'), window.__mp.cleanName(12)],
      };
    });
    expect(out.keys).toEqual(['accent', 'check', 'chrome', 'flowers', 'goldChain', 'hair', 'hairColor', 'helmet', 'jeans', 'mods', 'neon', 'shades', 'shadesStyle', 'shirt', 'stickers', 'stubble', 'tank', 'watch']);
    expect(out.tank).toBe('#c99a2e');   // Raja Gold's own tank colour replaces the bad value
    expect([out.accent, out.helmet, out.shades, out.hair, out.flowers, out.chrome]).toEqual(['#00ff00', null, null, 'pomp', true, true]);
    expect(out.mods).toEqual({ exhaust: 'stock', tyres: 'fat', kit: 'none', finish: 'chrome' });
    expect(out.flags).toEqual([]);
    expect([out.notObject, out.arr]).toEqual(['#b9bec6', '#141414']);
    expect(out.names).toEqual(['Asha', 'Rider', 'abcdefghijklmnop', '12']);
    // a name that looks like markup is shown as those characters, never parsed
    const shown = await A.page.evaluate(() => {
      const name = '<img src=x onerror="window.__pwned=1">';
      window.__mpui.renderRoster({ hostSeat: 0, racers: [{ seat: 0, name, bike: 'stock', connected: true }] });
      const li = document.querySelector('#mpRoster li');
      const r = { text: li.querySelector('.mp-who b').textContent, imgs: document.querySelectorAll('#mpRoster img').length };
      document.querySelector('#mpRoster').textContent = '';
      return r;
    });
    expect(shown).toEqual({ text: '<img src=x onerror="window.__pwned=1">', imgs: 0 });
  });

  it('notices and controls follow the seats, not the names, and a burst of notices stays short', async () => {
    const A = P.A;   // offline on the menu again: the lobby code is driven directly, with made-up rooms
    const out = await A.page.evaluate(async () => {
      const mp = window.__mp, ui = window.__mpui, L = mp.sanitizeLook;
      // a key that is there with no value is a missing key (lookFromSave writes shades: undefined for No shades)
      const holes = L({ shades: undefined, flowers: undefined, helmet: undefined, check: undefined, shadesStyle: undefined }, 'stock');
      const mine = ui.myLook();
      const sameAsSent = JSON.stringify(L(mine, 'stock')) === JSON.stringify(L(JSON.parse(JSON.stringify(mine)), 'stock'));
      const room = (hostSeat, phase = 'lobby') => ({ pin: '4321', phase, you: 0, raceId: null, hostSeat, settings: { track: 'random', laps: 3, time: 'morning', weather: 'clear' },
        racers: [0, 1].map((seat) => ({ seat, name: 'PotatoBazaar', bike: 'stock', look: L(null, 'stock'), host: seat === hostSeat, connected: true })) });
      const last = () => ui.recent[ui.recent.length - 1];
      // two racers share the default name: the host left, and the room update after the notice says who took over
      mp.seat = 0;
      mp.room = room(null); ui.onNotice({ kind: 'new-host', name: 'PotatoBazaar' }); mp.room = room(1); ui.onRoom();
      const otherHost = last();
      mp.room = room(null); ui.onNotice({ kind: 'new-host', name: 'PotatoBazaar' }); mp.room = room(0); ui.onRoom();
      const youHost = last();
      // back in the lobby while the room still races: no start controls, a line that says so
      const cta = () => { const v = (s) => !document.querySelector(s).hidden; return { raceOn: v('#mpRaceOn'), text: document.querySelector('#mpRaceOn').textContent, start: v('#mpStart'), label: document.querySelector('#mpStartLbl').textContent, waitHost: v('#mpWaitHost'), waitFriends: v('#mpWaitFriends') }; };
      ui.starting = false;
      mp.room = room(0, 'racing'); ui.render(); const hostRacing = cta();
      mp.seat = 1; ui.render(); const guestRacing = cta();
      mp.room = room(0, 'countdown'); ui.render(); const guestCountdown = cta();
      mp.seat = 0; mp.room = room(0); ui.render(); const hostLobby = cta();
      // a racer whose connection flaps (or who reloads) gives no notices; one who stays away does, after a moment
      ui.onNotice({ kind: 'disconnected', name: 'Zed' }); ui.onNotice({ kind: 'reconnected', name: 'Zed' });
      for (let i = 0; i < 200; i++) ui.onNotice({ kind: i % 2 ? 'reconnected' : 'disconnected', name: 'Flap' });
      ui.onNotice({ kind: 'disconnected', name: 'Gone' });
      await new Promise((r) => setTimeout(r, 3500));
      const flaps = ui.recent.filter((t) => /Zed|Flap/.test(t));
      const gone = ui.recent.includes('Gone lost connection');
      // a burst of different notices keeps only the newest few waiting
      for (let i = 0; i < 20; i++) ui.onNotice({ kind: 'joined', name: 'Racer' + i });
      const queued = ui.notes.length, newest = last();
      mp.room = null; mp.seat = null; ui.notes.length = 0;
      document.querySelector('#mpRoster').textContent = '';
      return { holes, sameAsSent, otherHost, youHost, hostRacing, guestRacing, guestCountdown, hostLobby, flaps, gone, queued, newest };
    });
    expect([out.holes.shades, out.holes.flowers, out.holes.helmet, out.holes.check, out.holes.shadesStyle]).toEqual([null, false, null, false, null]);
    expect(out.sameAsSent).toBe(true);
    expect(out.otherHost).toBe('PotatoBazaar is the host now');
    expect(out.youHost).toBe('You are the host now');
    expect(out.hostRacing).toEqual({ raceOn: true, text: 'Race in progress… results soon', start: false, label: 'START RACE', waitHost: false, waitFriends: false });
    expect([out.guestRacing.raceOn, out.guestRacing.waitHost, out.guestRacing.start]).toEqual([true, false, false]);
    expect([out.guestCountdown.raceOn, out.guestCountdown.text]).toEqual([true, 'The race is starting…']);
    expect([out.hostLobby.raceOn, out.hostLobby.start, out.hostLobby.label]).toEqual([false, true, 'START RACE']);
    expect(out.flaps).toEqual([]);
    expect(out.gone).toBe(true);
    expect(out.queued).toBeLessThanOrEqual(3);
    expect(out.newest).toBe('Racer19 joined the room');
  });

  it('logged no console errors on any page', () => {
    for (const p of everyone) expect(p.errors, p.name).toEqual([]);
  });
});
