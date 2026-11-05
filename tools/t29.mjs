import { openGame } from './serve-test.mjs';
const { browser, page } = await openGame({ query: '?test&q=low', width: 320, height: 180 });
await page.waitForSelector('#menu.show', { timeout: 90000 });
console.log(await page.evaluate(() => { const g = window.__chapri; g.loadTrack('dharavi-lanes'); const T = g.track, N = T.N; const out = []; for (const km of [95, 55, 35]) { const runs = []; let st = -1; for (let i = 0; i <= N; i++) { const ok = i < N && Math.abs(T.k[i]) < 1 / km; if (ok && st < 0) st = i; if (!ok && st >= 0) { runs.push([st * 0.5, i * 0.5]); st = -1; } } out.push(km + ': ' + runs.filter(r => r[1] - r[0] > 30).map(r => r.map(Math.round).join('-')).join(' ')); }
  return out.join('\n') + '\nbumps ' + T.bumps.map(b => Math.round(b.s)).join(',') + ' sc ' + T.shortcuts.map(s => Math.round(s.s) + '±' + s.half).join(','); }));
await browser.close();
