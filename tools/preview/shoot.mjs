import { chromium } from 'playwright';
import fs from 'fs';
const model = process.argv[2], out = process.argv[3] || '/tmp/claude-0/-home-claude/d0068754-e91d-5433-95b6-3ca794e92c94/scratchpad/rx/views';
const views = JSON.parse(process.argv[4] || '[[0,0.15],[1.5708,0.1],[3.1416,0.15],[-1.5708,0.1],[0.7,0.45],[0,1.5]]');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
const root = '';
await p.route('http://chapri.test/**', r => { const u = new URL(r.request().url()); let f;
  if (u.pathname.startsWith('/three/')) f = root + 'node_modules' + u.pathname; else if (u.pathname === '/model.glb') f = model; else f = root + 'tools/preview/view.html';
  r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/html' }); });
await p.goto('http://chapri.test/view.html' + (process.env.HIDE ? '?hide=' + process.env.HIDE : '')); await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => window.__info)));
if (process.env.PICK) { for (const q of JSON.parse(process.env.PICK)) console.log('pick', JSON.stringify(q), JSON.stringify(await p.evaluate((a) => window.pick(...a), q))); }
let i = 0; for (const [az, el] of views) { const d = await p.evaluate(([a, e]) => window.shot(a, e), [az, el]); fs.writeFileSync(`${out}_${i++}.png`, Buffer.from(d.split(',')[1], 'base64')); }
await b.close();
