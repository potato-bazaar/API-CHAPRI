// Friends races, end to end: the real room server, the built game page, and one browser context per player. Rooms are
// created and joined through window.__mp, so this file does not depend on the lobby screens (lobby.e2e.test.mjs covers
// those). The tests run in order and share one room of three: Asha (host), Bunty and Chotu.
//   race 1: all three start, each on the bike and look of their seat in race:begin, see each other as ghosts, GO lines
//           up, everyone finishes, the same results reach everyone;
//   race 2: Chotu leaves mid-race from the pause menu, everything is released, the other two finish;
//   race 3: Chotu joins again and races, then leaves mid-race through game.leaveMultiplayer(); nothing grows between
//           the two leaves (Chotu's page closes after this race);
//   race 4: Bunty reloads his page mid-race, takes his seat back and rejoins the race at its current time;
//   race 5: stale lobby views, right after race:begin and later in the countdown, do not end the race. Asha crosses the
//           line while her connection is down, goes back to the lobby, gets her connection back, then reloads: she is
//           never put back on the grid, her finish reaches the server, and her reward is paid. Bunty never finishes: the
//           server's timeout makes him DNF, which ends his run of wins, and his bike is parked under the results, where
//           the line in front of it counts for nothing.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startRoomServer, launchChromium, openPlayer, waitUntil, waitForMenu } from './harness.mjs';

const VIEW = { width: 480, height: 270 };   // small pages and ?q=low keep three WebGL pages affordable
const TRACK = 'mumbai-central';
let server = null, browser = null, pin = null;
const P = {};
const everyone = [];
const seatOf = {};

async function player(name) {
  const p = await openPlayer(browser, server.url, { query: '?q=low', ...VIEW, name });
  everyone.push(p);
  return p;
}
// A timeout says what the page was doing, so a failure on a slow machine can be told apart from a wrong state.
// (Only flags and codes: never the seat token.)
const pageState = (p) => p.page.evaluate(() => {
  const g = window.__chapri, mp = window.__mp, R = g && g.race, M = window.__mprace;
  return JSON.stringify({
    state: g && g.state, race: R ? { mp: !!R.mp, raceId: R.mp && R.mp.raceId, state: R.state, over: !!R.mpOver } : null,
    mp: mp ? { status: mp.status, seat: mp.seat, phase: mp.room && mp.room.phase, raceId: mp.room && mp.room.raceId, error: mp.lastError && mp.lastError.code, session: !!mp.session() } : null,
    pending: M && M.pendingRace ? M.pendingRace.mp.raceId : null, lobby: !!document.querySelector('#mpLobby.show'),
  });
}).catch((err) => `unavailable (${String(err.message).slice(0, 80)})`);
const wait = async (p, predicate, arg, timeout, message) => {
  try { await waitUntil(p.page, predicate, arg, { timeout, message: `${p.name}: ${message}` }); }
  catch (e) { throw new Error(`${e.message}; page state: ${await pageState(p)}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// What a page knows about its friends race.
function raceView(p) {
  return p.page.evaluate(() => {
    const g = window.__chapri, R = g.race;
    if (!R) return { state: g.state, race: null };
    return {
      state: g.state, race: R.state, raceId: R.mp && R.mp.raceId, mode: R.mode, raceT: R.raceT, laps: R.laps, L: R.track.L,
      seat: R.mp && R.mp.seat, goWall: R.mp && R.mp.goWall, camGap: g.camera.position.distanceTo(R.player.rig.root.position), goAt: R.mp && R.mp.goAt, finishAck: R.mp && R.mp.finishAck,
      riders: R.riders.map((r) => ({ player: r.isPlayer, seat: r.net ? r.net.seat : R.mp && R.mp.seat, name: r.isPlayer ? null : r.name, dist: r.dist, d: r.d, v: r.v, finished: !!r.finished, gone: !!(r.net && r.net.gone), visible: r.rig.root.visible, buffered: r.net ? r.net.buf.length : null, delay: r.net ? r.net.delay : null })),
    };
  });
}
// Everything a leave must give back: scene objects, GPU memory, MP listeners, race timers.
function leakView(p) {
  return p.page.evaluate(() => {
    const g = window.__chapri; let objects = 0, meshes = 0;
    g.scene.traverse((o) => { objects++; if (o.isMesh || o.isPoints || o.isLine) meshes++; });
    const listeners = Object.fromEntries(Object.entries(window.__mp._listeners).map(([k, v]) => [k, v.length]).filter(([, n]) => n > 0));
    return { objects, meshes, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures, listeners, timers: window.__mprace.timers.size, race: !!g.race, state: g.state };
  });
}
const inRace = (p, raceId) => wait(p, (id) => { const R = window.__chapri.race; return !!R && !!R.mp && (id === undefined || R.mp.raceId !== id) && window.__chapri.state === 'race'; }, raceId, 60000, 'a friends race');
const racing = (p) => wait(p, () => { const R = window.__chapri.race; return !!R && R.state !== 'countdown'; }, null, 60000, 'GO');
const hold = (p, key) => p.page.keyboard.down(key);
const frames = (p, n) => p.page.evaluate((k) => new Promise((done) => { let i = 0; const f = () => (++i >= k ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const release = (p, key) => p.page.keyboard.up(key);

// Puts the local bike a metre and a half before the finish line, upright and rolling. A crashed bike is left to get back
// up first (its respawn would undo the move).
async function crossLine(p) {
  await wait(p, () => { const P = window.__chapri.race.player; return !P.crashed && !P.wreck; }, null, 30000, 'the bike back on its wheels');
  await p.page.evaluate(() => {
    const R = window.__chapri.race, P = R.player, T = R.track, at = R.laps * T.L - 1.5;
    P.dist = at; P.s = ((at % T.L) + T.L) % T.L; P.psi = 0; P.d = clamp0(P.d, P.halfW - 0.6); P.v = Math.max(P.v, 14); P.y = T.gy(P.s, P.d); P.vy = 0; P.air = false; P.wobble = 0;
    function clamp0(v, m) { return Math.max(-m, Math.min(m, v)); }
  });
}
// crossLine, then waits until the room server has acknowledged the finish
async function finishLine(p) {
  await crossLine(p);
  await wait(p, () => window.__chapri.race.state === 'finished' && window.__chapri.race.mp.finishAck === true, null, 30000, 'the finish acknowledged');
}
const results = (p, raceId) => p.page.evaluate((id) => {
  const r = window.__mprace.lastResults; if (!r || r.raceId !== id) return null;
  const shown = (sel) => { const el = document.querySelector(sel); return !!el && !el.hidden && el.getClientRects().length > 0; };
  return {
    reason: r.reason, order: r.order.map((o) => ({ pos: o.pos, seat: o.seat, name: o.name, finished: o.finished, dnf: o.dnf })),
    screen: document.querySelector('#results').classList.contains('show'),
    table: [...document.querySelectorAll('#rMpTable tr')].slice(1).map((tr) => ({ pos: tr.children[0].textContent, name: tr.children[1].textContent, me: tr.classList.contains('me') })),
    pos: document.querySelector('#rPos').textContent, title: document.querySelector('#rTitle').textContent,
    list: [...document.querySelectorAll('#rList li')].map((li) => li.textContent),
    again: shown('#rMpAgain'), lobby: shown('#rMpLobby'), soloButtons: ['#rAgain', '#rNext', '#rGarage', '#rMenu'].some(shown),
  };
}, raceId);
const save = (p) => p.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('chapri-racer-save-v1') || '{}'); return { xp: s.xp || 0, coins: s.coins || 0, races: s.races || 0, streak: s.streak || 0 }; });

describe('friends races', () => {
  let race1 = null, race2 = null, leak0 = null, leak1 = null;

  beforeAll(async () => {
    // GO 15 s after Start instead of 5: three pages compile the race's shaders at once on a software GPU, which can
    // hold a page's main thread for several seconds. The countdown alignment is what is measured, not this machine.
    // The seat is held 6 minutes after a disconnect instead of 1: a page reload boots the whole game again here, and in
    // race 5 the reloaded page has been offline for a minute already.
    // A race ends 240 s after its first finish instead of 120. Race 5 waits for that timeout on purpose, and a page reload
    // has to fit inside it: about a minute here, but it gets the same 4 minutes as the reload in race 4 on a busy machine.
    // Every other race has all its racers finish (or leave) within a few seconds of the first.
    server = await startRoomServer({ timers: { goDelayMs: 15000, reconnectGraceMs: 360000, finishTimeoutMs: 240000 } });
    browser = await launchChromium();
    [P.A, P.B, P.C] = await Promise.all([player('Asha'), player('Bunty'), player('Chotu')]);
    await Promise.all(Object.values(P).map((p) => waitForMenu(p.page)));
  });

  afterAll(async () => {
    for (const p of everyone) await p.close().catch(() => {});
    if (browser) await browser.close();
    if (server) await server.close();
  });

  it('three players start a race and each sees the other two as ghosts, on the same grid', async () => {
    const { A, B, C } = P;
    await frames(C, 5);   // a few menu frames first: the menu's own lights are added on its first frame
    leak0 = await leakView(C);
    // Asha's look carries a key the game does not know and a script-looking name: neither may reach another page as code
    const created = await A.page.evaluate(() => window.__mp.create({ name: 'Asha', bike: 'chrome', look: { tank: '#12ab34', hair: 'buzz', evil: '<img src=x onerror=alert(1)>', lod: true } }));
    expect(created.ok).toBe(true);
    pin = created.pin;
    expect(pin).toMatch(/^\d{4}$/);
    for (const [p, name] of [[B, 'Bunty'], [C, 'Chotu']]) {
      const ack = await p.page.evaluate(([pn, nm]) => window.__mp.join({ pin: pn, name: nm, bike: 'kaali', look: null }), [pin, name]);
      expect(ack.ok, `${name} joins`).toBe(true);
    }
    expect((await A.page.evaluate((t) => window.__mp.setSettings({ track: t, laps: 1, time: 'morning', weather: 'clear' }), TRACK)).ok).toBe(true);
    for (const p of [A, B, C]) await wait(p, (t) => { const r = window.__mp.room; return !!r && r.racers.length === 3 && r.settings.track === t && r.settings.laps === 1; }, TRACK, 15000, 'the room of three');
    for (const p of [A, B, C]) seatOf[p.name] = await p.page.evaluate(() => window.__mp.seat);
    expect(new Set(Object.values(seatOf)).size).toBe(3);

    const start = await A.page.evaluate(() => window.__mp.startRace());
    expect(start.ok).toBe(true);
    await Promise.all([A, B, C].map((p) => inRace(p)));
    const views = {};
    for (const p of [A, B, C]) views[p.name] = await raceView(p);
    race1 = views.Asha.raceId;
    for (const p of [A, B, C]) {
      const v = views[p.name];
      expect(v.raceId).toBe(race1);
      expect(v.mode).toBe('friends');
      expect(v.laps).toBe(1);
      expect(v.riders.length).toBe(3);
      expect(v.riders[0].player).toBe(true);
      expect(v.riders.filter((r) => !r.player).map((r) => r.name).sort()).toEqual(['Asha', 'Bunty', 'Chotu'].filter((n) => n !== p.name));
      expect(v.seat).toBe(seatOf[p.name]);
    }
    // the grid comes from seat order, so every page puts every racer on the same spot before GO
    const spot = (v, seat) => { const r = v.riders.find((x) => x.seat === seat); return [+r.dist.toFixed(3), +r.d.toFixed(3)]; };
    for (const seat of Object.values(seatOf)) {
      expect(spot(views.Bunty, seat), `seat ${seat} on Bunty's page`).toEqual(spot(views.Asha, seat));
      expect(spot(views.Chotu, seat), `seat ${seat} on Chotu's page`).toEqual(spot(views.Asha, seat));
    }
    // the ghost's look went through the sanitizer: known keys only, the tank colour kept
    const look = await B.page.evaluate((seat) => { const r = window.__chapri.race.riders.find((x) => x.net && x.net.seat === seat); return r.rig.o; }, seatOf.Asha);
    expect(look.tank).toBe('#12ab34');
    expect(look.hair).toBe('buzz');
    expect('evil' in look).toBe(false);
    expect(look.lod).toBe(true);   // set by Rider for every non-player rig, not taken from the network
    // each page rides the bike and look that its seat has in race:begin, the ones the other pages draw: Bunty's save holds
    // the chrome bike, but he joined on the kaali one
    const ridden = await B.page.evaluate(() => { const P = window.__chapri.race.player; return { build: P.st.build.id, saved: window.__save().build, look: P.rig.o }; });
    const drawn = await A.page.evaluate((seat) => window.__chapri.race.riders.find((x) => x.net && x.net.seat === seat).rig.o, seatOf.Bunty);
    expect(ridden.build).toBe('kaali');
    expect(ridden.saved).toBe('chrome');
    const { lod, ...drawnLook } = drawn;   // lod: the far-away detail flag, set on every rig but the player's own
    expect(lod).toBe(true);
    expect(ridden.look).toEqual(drawnLook);
    // names are text, never markup
    expect(await B.page.evaluate(() => document.querySelectorAll('#standings img, #pops img').length)).toBe(0);
  });

  it('the countdowns line up: GO fires within 50 ms on all three pages', async () => {
    const { A, B, C } = P;
    await Promise.all([A, B, C].map((p) => racing(p)));
    const go = [];
    for (const p of [A, B, C]) { const v = await raceView(p); go.push(v.goWall); expect(Math.abs(v.goWall - v.goAt)).toBeLessThan(200); }
    expect(Math.max(...go) - Math.min(...go)).toBeLessThan(50);
  });

  it('the ghosts move, and each one is drawn where the real bike was, a short delay ago', async () => {
    const { A, B, C } = P, pages = [A, B, C];
    // every page records its own bike's path, frame by frame, to check the other pages' ghosts against
    for (const p of pages) await p.page.evaluate(() => {
      if (window.__trail) return; window.__trail = [];
      const f = () => { const R = window.__chapri.race, T = window.__trail; if (R && R.mp && R.state !== 'countdown' && (!T.length || T[T.length - 1][0] !== R.raceT)) { T.push([R.raceT, R.player.dist, R.player.d]); if (T.length > 2000) T.shift(); } requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    for (const p of pages) await hold(p, 'KeyW');
    // three WebGL pages on a software GPU draw a frame or two a second here, so motion is waited for, not timed
    for (const p of pages) await wait(p, () => window.__chapri.race.player.dist > 12, null, 120000, 'its own bike rolling');
    const before = {};
    for (const p of pages) before[p.name] = await raceView(p);
    for (const p of pages) {
      const v0 = before[p.name];
      const ghosts = v0.riders.filter((r) => !r.player).map((r) => [r.seat, r.dist]);
      await wait(p, ([mine, gs]) => {
        const R = window.__chapri.race;
        return R.player.dist > mine + 10 && gs.every(([seat, d0]) => { const g = R.riders.find((r) => r.net && r.net.seat === seat); return g.dist > d0 + 10 && g.net.buf.length > 0; });
      }, [v0.riders[0].dist, ghosts], 120000, 'its own bike and both ghosts moving on');
    }
    // the chase camera is a real position a few metres behind the local bike: not NaN, not left behind on a slow page,
    // and not carried past the bike into the rider's head
    for (const p of pages) { const v = await raceView(p); expect(v.camGap, `${p.name}'s camera`).toBeGreaterThan(2.3); expect(v.camGap, `${p.name}'s camera`).toBeLessThan(8); }
    // Five readings of every ghost, then each one against the sender's own recorded path at (the reader's race clock
    // minus the ghost's drawing delay). The delay is 0.1 s on a fast device and grows with a slow sender's frame gap;
    // a sender that stalls for longer than that leaves its ghost briefly held, so the median error is what is checked.
    const samples = [];
    for (let k = 0; k < 5; k++) {
      samples.push(await Promise.all(pages.map((p) => p.page.evaluate(() => { const R = window.__chapri.race; return { raceT: R.raceT, ghosts: R.riders.filter((r) => r.net).map((r) => ({ seat: r.net.seat, dist: r.dist, d: r.d, delay: r.net.delay })) }; }))));
      await sleep(1000);
    }
    const trails = {};
    for (const p of pages) trails[seatOf[p.name]] = await p.page.evaluate(() => window.__trail);
    const at = (trail, t, k) => { let i = 0; while (i < trail.length - 2 && trail[i + 1][0] < t) i++; const a = trail[i], b = trail[i + 1]; const f = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))); return a[k] + (b[k] - a[k]) * f; };
    for (let j = 0; j < 3; j++) for (const seat of Object.values(seatOf)) {
      if (seat === seatOf[pages[j].name]) continue;
      const errs = [], lat = [];
      for (const snap of samples) {
        const g = snap[j].ghosts.find((x) => x.seat === seat), t = snap[j].raceT - g.delay, tr = trails[seat];
        expect(g.delay).toBeGreaterThanOrEqual(0.1);
        expect(g.delay).toBeLessThanOrEqual(1);
        if (t < tr[0][0] || t > tr[tr.length - 1][0]) continue;
        errs.push(Math.abs(g.dist - at(tr, t, 1))); lat.push(Math.abs(g.d - at(tr, t, 2)));
      }
      const med = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
      const who = `${pages[j].name}'s ghost of seat ${seat}: ${errs.map((e) => e.toFixed(2)).join(', ')}`;
      expect(errs.length, who).toBeGreaterThanOrEqual(3);
      expect(med(errs), who).toBeLessThan(2);
      expect(med(lat), who).toBeLessThan(0.75);
    }
  });

  it('finishing is reported, and race:results arrive with the same order on all three pages', async () => {
    const { A, B, C } = P;
    const before = {};
    for (const p of [A, B, C]) before[p.name] = await save(p);
    for (const p of [B, C, A]) { await finishLine(p); await sleep(700); }   // Bunty first, then Chotu, then Asha
    for (const p of [A, B, C]) await release(p, 'KeyW');
    for (const p of [A, B, C]) await wait(p, (id) => !!window.__mprace.lastResults && window.__mprace.lastResults.raceId === id && window.__chapri.state === 'results', race1, 30000, 'the results');
    const res = {};
    for (const p of [A, B, C]) res[p.name] = await results(p, race1);
    const want = [seatOf.Bunty, seatOf.Chotu, seatOf.Asha];
    for (const p of [A, B, C]) {
      const r = res[p.name];
      expect(r.reason).toBe('all-finished');
      expect(r.order.map((o) => o.seat), `${p.name}'s order`).toEqual(want);
      expect(r.order.map((o) => o.name)).toEqual(['Bunty', 'Chotu', 'Asha']);
      expect(r.order.every((o) => o.finished && !o.dnf)).toBe(true);
      expect(r.screen).toBe(true);
      expect(r.table.map((t) => t.pos)).toEqual(['1', '2', '3']);
      expect(r.table.filter((t) => t.me).map((t) => t.name)).toEqual([`${p.name} (You)`]);
      expect(r.lobby).toBe(true);
      expect(r.soloButtons).toBe(false);
      expect(r.again).toBe(p === A);   // RACE AGAIN is the host's
    }
    expect(res.Bunty.pos).toBe('1');
    expect(res.Bunty.title).toBe('JEET GAYA!');
    // the Quick Race reward table, by the server's position
    const points = { Bunty: 500, Chotu: 300, Asha: 200 };
    for (const p of [A, B, C]) {
      expect(res[p.name].list.some((l) => l === `Position points+${points[p.name]}`), `${p.name}: ${res[p.name].list.join(' | ')}`).toBe(true);
      const after = await save(p);
      expect(after.xp - before[p.name].xp).toBeGreaterThanOrEqual(points[p.name]);
      expect(after.races).toBe(before[p.name].races + 1);
    }
  });

  it('the pause menu only offers leaving; leaving mid-race releases the race and the others carry on', async () => {
    const { A, B, C } = P;
    await A.page.click('#rMpAgain');
    await Promise.all([A, B, C].map((p) => inRace(p, race1)));
    race2 = (await raceView(A)).raceId;
    await Promise.all([A, B, C].map((p) => racing(p)));
    for (const p of [A, B, C]) await hold(p, 'KeyW');
    await sleep(2500);
    const ghostRoots = await C.page.evaluate(() => window.__chapri.race.riders.filter((r) => r.net).map((r) => r.rig.root.uuid));
    expect(ghostRoots.length).toBe(2);
    // pause: the menu opens, the race does not stop
    await C.page.keyboard.press('Escape');
    await wait(C, () => !document.querySelector('#pause').hidden, null, 5000, 'the pause menu');
    const menu = await C.page.evaluate(() => ({ state: window.__chapri.state, t: window.__chapri.race.raceT, restart: document.querySelector('#pRestart').hidden, settings: document.querySelector('#pSettings').hidden, quit: document.querySelector('#pQuit').textContent }));
    expect(menu).toMatchObject({ state: 'race', restart: true, settings: true, quit: 'Leave race' });
    await wait(C, (t) => window.__chapri.state === 'race' && window.__chapri.race.raceT > t + 0.3, menu.t, 15000, 'the race running on under the menu');
    await release(C, 'KeyW');
    await C.page.click('#pQuit');
    await wait(C, () => window.__chapri.state === 'menu' && !window.__chapri.race && window.__mp.status === 'offline', null, 30000, 'the menu after leaving');
    await frames(C, 5);   // let the menu draw before measuring
    leak1 = await leakView(C);
    const left = await C.page.evaluate((ids) => ({
      inScene: ids.filter((id) => !!window.__chapri.scene.getObjectByProperty('uuid', id)).length,
      room: window.__mp.room, session: sessionStorage.getItem('chapri-mp-session'), menu: document.querySelector('#menu').classList.contains('show'),
      pause: document.querySelector('#pause').hidden, pauseLabel: document.querySelector('#pQuit').textContent,
    }), ghostRoots);
    expect(left).toEqual({ inScene: 0, room: null, session: null, menu: true, pause: true, pauseLabel: 'Quit to menu' });
    expect(leak1.timers).toBe(0);
    expect(leak1.race).toBe(false);
    expect(leak1.listeners).toEqual(leak0.listeners);   // no subscription was added for the race, and none is left
    expect(leak1.objects).toBe(leak0.objects);           // the menu scene is back to what it was before the first race
    // the two still racing see Chotu's ghost leave the road, then finish
    for (const p of [A, B]) await wait(p, (seat) => { const g = window.__chapri.race.riders.find((r) => r.net && r.net.seat === seat); return g.eliminated && !g.rig.root.visible; }, seatOf.Chotu, 15000, 'the ghost of a racer who left');
    for (const p of [A, B]) { await finishLine(p); await sleep(500); }
    for (const p of [A, B]) await release(p, 'KeyW');
    for (const p of [A, B]) await wait(p, (id) => !!window.__mprace.lastResults && window.__mprace.lastResults.raceId === id, race2, 30000, 'the results of race 2');
    const rA = await results(A, race2), rB = await results(B, race2);
    expect(rA.order.map((o) => o.seat)).toEqual([seatOf.Asha, seatOf.Bunty, seatOf.Chotu]);
    expect(rB.order).toEqual(rA.order);
    expect(rA.order[2]).toMatchObject({ seat: seatOf.Chotu, finished: false, dnf: true });
    expect(await C.page.evaluate(() => window.__mprace.lastResults.raceId)).toBe(race1);   // nothing reaches a player who left
  });

  it('re-entering works, and a second leave gives back exactly as much as the first', async () => {
    const { A, B, C } = P;
    const ack = await C.page.evaluate((pn) => window.__mp.join({ pin: pn, name: 'Chotu', bike: 'stock', look: null }), pin);
    expect(ack.ok).toBe(true);
    await wait(A, () => window.__mp.room && window.__mp.room.racers.length === 3, null, 15000, 'Chotu back in the room');
    await wait(A, () => { const b = document.querySelector('#rMpAgain'); return !!b && !b.hidden && !b.disabled; }, null, 15000, 'RACE AGAIN');
    await A.page.click('#rMpAgain');
    await Promise.all([A, B, C].map((p) => inRace(p, race2)));
    const vC = await raceView(C), vA = await raceView(A);
    expect(vC.riders.length).toBe(3);
    expect(vC.riders.filter((r) => !r.player).map((r) => r.name).sort()).toEqual(['Asha', 'Bunty']);
    expect(vA.riders.find((r) => r.seat === seatOf.Chotu)).toMatchObject({ name: 'Chotu', gone: false });
    await Promise.all([A, B, C].map((p) => racing(p)));
    for (const p of [A, B, C]) await hold(p, 'KeyW');
    await wait(A, (seat) => window.__chapri.race.riders.find((r) => r.net && r.net.seat === seat).dist > 5, seatOf.Chotu, 120000, 'the ghost of Chotu rolling');
    await release(C, 'KeyW');
    await C.page.evaluate(() => window.__chapri.leaveMultiplayer());
    await wait(C, () => window.__chapri.state === 'menu' && !window.__chapri.race && window.__mp.status === 'offline', null, 30000, 'the menu after the second leave');
    await frames(C, 5);
    const leak2 = await leakView(C);
    expect(leak2.timers).toBe(0);
    expect(leak2.listeners).toEqual(leak1.listeners);
    expect(leak2.objects).toBe(leak1.objects);
    expect(leak2.meshes).toBe(leak1.meshes);
    // GPU memory: what the menu has drawn so far can differ a little, a leaked race (two rigs, the race world) would not
    expect(leak2.geometries).toBeLessThanOrEqual(Math.ceil(leak1.geometries * 1.05) + 5);
    expect(leak2.textures).toBeLessThanOrEqual(leak1.textures + 2);
    // the other two finish; BACK TO LOBBY takes Bunty back into the room
    for (const p of [A, B]) { await finishLine(p); await sleep(500); }
    for (const p of [A, B]) await release(p, 'KeyW');
    for (const p of [A, B]) await wait(p, (id) => window.__chapri.state === 'results' && !!window.__mprace.lastResults && window.__mprace.lastResults.raceId === id, vA.raceId, 30000, 'the results of race 3');
    const r3 = await results(A, vA.raceId);
    expect(r3.order.map((o) => o.seat)).toEqual([seatOf.Asha, seatOf.Bunty, seatOf.Chotu]);
    expect(r3.order[2].dnf).toBe(true);
    await B.page.click('#rMpLobby');
    await wait(B, () => !window.__chapri.race && window.__chapri.state === 'menu' && !!window.__mp.room && document.querySelector('#mpLobby').classList.contains('show'), null, 30000, 'the lobby');
    expect(await B.page.evaluate(() => ['#rAgain', '#rNext', '#rGarage', '#rMenu'].every((s) => !document.querySelector(s).hidden) && document.querySelector('#rMpLobby').hidden)).toBe(true);
  });

  it('a reload mid-race takes the seat back and joins the race at its current time', async () => {
    const { A, B, C } = P;
    // Chotu has sat out since race 3. His page would keep drawing the menu on the software GPU and take CPU from the
    // reloaded page, which has to boot the whole game and build the race again within the wait below.
    await C.close();
    const before = await A.page.evaluate(() => window.__mprace.lastResults.raceId);
    await wait(A, () => { const b = document.querySelector('#rMpAgain'); return !!b && !b.hidden && !b.disabled; }, null, 15000, 'RACE AGAIN');
    await A.page.click('#rMpAgain');   // Bunty is in the lobby: race:begin reaches him there
    await Promise.all([A, B].map((p) => inRace(p, before)));
    const race4 = (await raceView(A)).raceId;
    await Promise.all([A, B].map((p) => racing(p)));
    for (const p of [A, B]) await hold(p, 'KeyW');
    await wait(B, () => window.__chapri.race.player.dist > 8, null, 120000, 'Bunty rolling');
    for (const p of [A, B]) await release(p, 'KeyW');   // Asha coasts to a stop: she must not finish on her own meanwhile
    await B.page.reload({ waitUntil: 'domcontentloaded' });
    // the session in this tab resumes the seat; the server sends race:begin again, after GO, and the race picks up there
    await wait(B, (id) => { const g = window.__chapri, R = g && g.race; return !!R && !!R.mp && R.mp.raceId === id && R.state === 'racing' && g.state === 'race'; }, race4, 240000, 'the race again after the reload');
    const late = await B.page.evaluate(() => { const R = window.__chapri.race; return { raceT: R.raceT, clock: (window.__mp.serverNow() - R.mp.goAt) / 1000, riders: R.riders.length, dist: R.player.dist, lapStart: R.player.lapStart }; });
    expect(late.riders).toBe(2);
    expect(late.raceT).toBeGreaterThan(3);                      // not a fresh countdown
    expect(Math.abs(late.raceT - late.clock)).toBeLessThan(2);  // the server's race time (read a moment later)
    expect(late.lapStart).toBeGreaterThan(3);                   // the first lap is timed from this bike's own start
    expect(late.dist).toBeLessThan(5);                          // back on the grid
    // Asha's ghost of Bunty snaps back to the grid instead of sliding there
    await wait(A, (seat) => { const g = window.__chapri.race.riders.find((r) => r.net && r.net.seat === seat); return !g.eliminated && g.dist < 5; }, seatOf.Bunty, 60000, 'the ghost of Bunty back on the grid');
    for (const p of [B, A]) { await finishLine(p); await sleep(500); }
    for (const p of [A, B]) await wait(p, (id) => !!window.__mprace.lastResults && window.__mprace.lastResults.raceId === id && window.__chapri.state === 'results', race4, 30000, 'the results of race 4');
    const rA = await results(A, race4), rB = await results(B, race4);
    expect(rA.order.map((o) => o.seat)).toEqual([seatOf.Bunty, seatOf.Asha]);
    expect(rB.order).toEqual(rA.order);
    expect(rB.table.filter((t) => t.me).map((t) => t.name)).toEqual(['Bunty (You)']);
  });

  it('a finish made offline counts, a finished racer stays out of the race through a reconnect and a reload, and a DNF earns nothing more', async () => {
    const { A, B } = P;
    const prev = await A.page.evaluate(() => window.__mprace.lastResults.raceId);
    const saveA = await save(A), saveB = await save(B);
    expect(saveB.streak, 'Bunty won race 4, so he has a run of wins to lose').toBeGreaterThan(0);
    // On a polling connection the answer to a request sent from the lobby can be applied just after race:begin, with the
    // room still in the lobby phase: MP resumes the request after the begin when both come in one batch. Bunty's page gets
    // such a view straight after race 5's begin, as MP would apply it, with its clock pushed past GO for that moment (a
    // slow device can still be building the race at GO). It follows no view of race 5, so it must not end race 5.
    const lobbyBefore = await B.page.evaluate(() => {
      const mp = window.__mp, stale = Object.assign({}, mp.room);   // the room as it is now, in the lobby
      const fn = () => {
        mp.off('begin', fn);
        queueMicrotask(() => {
          const R = window.__chapri.race, off = mp.clockOffset;
          mp.clockOffset += R.mp.goAt + 1000 - mp.serverNow();
          try { mp._onRoom(stale); } finally { mp.clockOffset = off; }
          window.__stale = { raceId: R.mp.raceId, over: !!R.mpOver, phase: mp.room.phase };
        });
      };
      mp.on('begin', fn);
      return mp.room.phase;
    });
    expect(lobbyBefore).toBe('lobby');
    await wait(A, () => { const b = document.querySelector('#rMpAgain'); return !!b && !b.hidden && !b.disabled; }, null, 15000, 'RACE AGAIN');
    await A.page.click('#rMpAgain');
    await inRace(B, prev);
    const race5 = (await raceView(B)).raceId;
    expect(await B.page.evaluate(() => window.__stale)).toEqual({ raceId: race5, over: false, phase: 'lobby' });
    // The same view again later in the countdown, once the room has shown race 5: then only GO, still to come, tells
    // that the view cannot mean the end of race 5.
    await wait(B, (id) => window.__mp.room.raceId === id, race5, 15000, 'the room showing race 5');
    const early = await B.page.evaluate(() => { const mp = window.__mp, R = window.__chapri.race, before = mp.serverNow() < R.mp.goAt - 1000; mp._onRoom(Object.assign({}, mp.room, { phase: 'lobby', raceId: null })); return before; });
    expect(early, 'the stale view came before GO').toBe(true);
    await inRace(A, prev);
    expect((await raceView(A)).raceId).toBe(race5);
    await Promise.all([A, B].map((p) => racing(p)));
    await wait(B, () => window.__mp.room.phase === 'racing', null, 15000, "the server's view of the race after GO");
    expect(await B.page.evaluate(() => { const g = window.__chapri, R = g.race; return { over: !!R.mpOver, state: g.state, race: R.state }; }))
      .toEqual({ over: false, state: 'race', race: 'racing' });

    for (const p of [A, B]) await hold(p, 'KeyW');
    await wait(A, () => window.__chapri.race.player.dist > 8, null, 120000, 'Asha rolling');
    for (const p of [A, B]) await release(p, 'KeyW');   // Bunty stays out on the road: he never finishes this race

    // Asha's connection goes down (socket.io is kept from reconnecting) and she crosses the line while it is down
    await wait(A, () => { const P = window.__chapri.race.player; return !P.crashed && !P.wreck; }, null, 30000, 'Asha on her wheels');
    await A.page.evaluate(() => { const m = window.__mp.socket.io; m.reconnection(false); m.engine.close(); });
    await wait(A, () => window.__mp.status === 'reconnecting', null, 15000, 'the connection down');
    await crossLine(A);
    await wait(A, () => window.__chapri.race.state === 'finished' && !!window.__chapri.race.mp.finishMsg, null, 30000, 'the finish');
    // A minute on, with no answer, the local standings show. MP.finish gives up on the report after its two waits of
    // 20 s for the connection; those count only time the page could run, so on a slow page they can end after the
    // standings show: that is waited for too.
    await wait(A, () => window.__chapri.state === 'results' && !document.querySelector('#rMpLobby').hidden && !window.__chapri.race.mp.finishing, null, 180000, 'the local standings, with the finish report given up');
    const waiting = await A.page.evaluate(() => { const M = window.__chapri.race.mp; return { ack: M.finishAck === true, sending: !!M.finishing, note: document.querySelector('#rMpNote').textContent, status: window.__mp.status }; });
    expect(waiting).toEqual({ ack: false, sending: false, note: 'Waiting for the other racers…', status: 'reconnecting' });
    await A.page.click('#rMpLobby');
    await wait(A, (id) => !window.__chapri.race && document.querySelector('#mpLobby').classList.contains('show') && !!window.__mprace.pendingRace && window.__mprace.pendingRace.mp.raceId === id, race5, 30000, 'the lobby, with the reward still to come');

    // The connection comes back: the seat resumes and the server sends race:begin again, while it still has Asha racing.
    // She stays in the lobby, and her finish report goes out from the race she left. The server's 240 s finish timer
    // starts with it.
    await A.page.evaluate(() => { window.__begins = []; window.__mp.on('begin', (b) => window.__begins.push(b.raceId)); window.__mp.socket.io.reconnection(true); window.__mp.socket.connect(); });
    await wait(A, (id) => window.__begins.includes(id) && window.__mp.status === 'online' && !!window.__mprace.pendingRace && window.__mprace.pendingRace.mp.finishAck === true,
      race5, 60000, 'race:begin again after the reconnect, and the finish acknowledged');
    await frames(A, 3);
    expect(await A.page.evaluate(() => ({ race: !!window.__chapri.race, state: window.__chapri.state, lobby: document.querySelector('#mpLobby').classList.contains('show') })))
      .toEqual({ race: false, state: 'menu', lobby: true });

    // A reload: the page takes the seat back. The server knows Asha has finished by now, so it sends her no race:begin.
    // She stays off the grid, and the tab restores her finish and the reward due from sessionStorage and sends the finish
    // again (the server answers the repeated report as a duplicate).
    await A.page.reload({ waitUntil: 'domcontentloaded' });
    await wait(A, (id) => {
      const M = window.__mprace, room = window.__mp && window.__mp.room;
      return !!M && !!M.pendingRace && M.pendingRace.mp.raceId === id && M.pendingRace.mp.finishAck === true && !!room && room.phase === 'racing';
    }, race5, 240000, 'the seat back after the reload, with the finish sent again');
    expect(await A.page.evaluate(() => ({ race: !!window.__chapri.race, state: window.__chapri.state }))).toEqual({ race: false, state: 'menu' });

    // the server ends the race 240 s after Asha's finish reached it: she is first, Bunty did not finish
    for (const p of [A, B]) await wait(p, (id) => !!window.__mprace.lastResults && window.__mprace.lastResults.raceId === id, race5, 300000, 'the results of race 5');
    const rA = await results(A, race5), rB = await results(B, race5);
    expect(rB.reason).toBe('timeout');
    expect(rB.order.map((o) => o.seat)).toEqual([seatOf.Asha, seatOf.Bunty]);
    expect(rB.order[0]).toMatchObject({ finished: true, dnf: false });
    expect(rB.order[1]).toMatchObject({ finished: false, dnf: true });
    expect(rA.order).toEqual(rB.order);

    // Asha, in the lobby, is paid for her real run: first place by the server's order
    await wait(A, () => window.__mprace.pendingRace === null && document.querySelector('#mpLobby').classList.contains('show'), null, 60000, 'the reward paid, in the lobby');
    expect(await A.page.evaluate(() => ({ race: !!window.__chapri.race, state: window.__chapri.state, kept: sessionStorage.getItem('chapri-mp-finish') })))
      .toEqual({ race: false, state: 'menu', kept: null });
    const afterA = await save(A);
    expect(afterA.races).toBe(saveA.races + 1);
    expect(afterA.xp - saveA.xp).toBeGreaterThanOrEqual(500);

    // Bunty did not finish: his run of wins ends, as with a Quick Race loss
    expect(rB.screen).toBe(true);
    expect(rB.title).toBe('DID NOT FINISH');
    const afterB = await save(B);
    expect(afterB.races).toBe(saveB.races + 1);
    expect(afterB.streak).toBe(0);
    // His bike is parked under the results, no longer simulated, so the line in front of it counts for nothing: no
    // finish, no lap, no finish report. Put a metre and a half before the line at 14 m/s, a bike still being simulated
    // would be over it within a frame or two.
    await B.page.evaluate(() => { window.__mp.lastError = null; });
    const parkedAt = await B.page.evaluate(() => { const R = window.__chapri.race, P = R.player, T = R.track, at = R.laps * T.L - 1.5; P.dist = at; P.s = ((at % T.L) + T.L) % T.L; P.v = 14; return at; });
    await frames(B, 10);
    expect(await B.page.evaluate(() => { const R = window.__chapri.race, P = R.player; return { state: window.__chapri.state, race: R.state, dist: P.dist, v: P.v, finished: P.finished, pos: R.playerPos, laps: P.laps.length, error: window.__mp.lastError, timers: window.__mprace.timers.size, title: document.querySelector('#rTitle').textContent }; }))
      .toEqual({ state: 'results', race: 'racing', dist: parkedAt, v: 0, finished: false, pos: 2, laps: 0, error: null, timers: 0, title: 'DID NOT FINISH' });
  });

  it('logged no console errors on any page', () => {
    for (const p of everyone) expect(p.errors, p.name).toEqual([]);
  });
});
