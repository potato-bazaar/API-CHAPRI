// Track features: list shortcuts/hazards; overhead shots of a shortcut and a hazard cluster (dry + rain)
import { openGame } from './serve-test.mjs';
const tr = process.argv[2] || 'dharavi-lanes', weather = process.argv[3] || 'clear', tag = process.argv[4] || 'tf';
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'low'}&track=${tr}&weather=${weather}`, width: 800, height: 450 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  const info = await page.evaluate(([tr, weather]) => { const g = window.__chapri; g.loadTrack(tr, null, weather); const T = g.track;
    document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden'));
    return { L: T.L.toFixed(0), shortcuts: T.shortcuts.map(s => ({ s: s.s.toFixed(0), side: s.side })), hazards: T.hazards.map(h => h.type[0] + (h.big ? 'B' : '') + '@' + h.s.toFixed(0)).join(' '), triples: T.bumps.filter(b => b.triple).length / 3 }; }, [tr, weather]).catch(e => ({ err: e.message }));
  console.log(JSON.stringify(info));
  // freeze the menu camera logic and place our own
  await page.evaluate(() => { const g = window.__chapri; g.menuFrame = () => {}; });
  const views = await page.evaluate(() => { const T = window.__chapri.track; const v = []; if (T.shortcuts[0]) v.push({ s: T.shortcuts[0].s, h: 26, back: 22, side: 0 });
    const big = T.hazards.find(h => h.type === 'pothole' && h.big && !h.lane); if (big) v.push({ s: big.s, h: 6, back: 9, side: big.d });
    const mud = T.hazards.find(h => h.type === 'mud' && !h.lane); if (mud) v.push({ s: mud.s, h: 6, back: 11, side: mud.d });
    const tb = T.bumps.find(b => b.triple); if (tb) v.push({ s: tb.s, h: 4, back: 10, side: 0 }); return v; });
  for (const [i, v] of views.entries()) {
    await page.evaluate((v) => { const g = window.__chapri, T = g.track, V = g.camera.position.constructor; const a = T.pos(v.s - v.back, v.side * 0.5, new V(), v.h), b = T.pos(v.s, v.side, new V(), 0);
      g.camera.position.copy(a); g.camera.fov = 60; g.camera.updateProjectionMatrix(); g.camera.lookAt(b); }, v);
    await frames(2); await page.screenshot({ path: `tools/${tag}_${i}.png`, timeout: 120000 });
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
