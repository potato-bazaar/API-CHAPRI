// Set-piece inventory per track
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: '?test&q=low', width: 320, height: 180 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  for (const id of ['mumbai-central', 'crawford-market', 'dharavi-lanes', 'bandstand-rush', 'sion-flyover']) {
    const r = await page.evaluate((id) => { const g = window.__chapri; g.loadTrack(id); const T = g.track; return { id, L: Math.round(T.L), roof: T.roof && { s0: Math.round(T.roof.s0), len: Math.round(T.roof.len), gaps: T.roof.gaps.length }, halls: T.halls.map(h => h.kind + '@' + Math.round(h.s0)), kickers: T.kickers.map(k => Math.round(k.s) + (k.side > 0 ? 'L' : 'R')), rail: T.rail && Math.round(T.rail.s), coins: T.coins.length, shortcuts: T.shortcuts.map(s => Math.round(s.s)) }; }, id);
    console.log(JSON.stringify(r));
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 5).join('\n'));
await browser.close();
