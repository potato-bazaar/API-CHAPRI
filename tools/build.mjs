import fs from 'fs';
import zlib from 'zlib';
const root = new URL('../', import.meta.url).pathname;
const order = ['00_core', '05_textures', '10_tracks', '15_track', '18_batch', '20_world', '21_stage', '22_underground', '23_street', '28_bikemodel', '29_ridermodel', '30_bike', '31_cloth', '32_bikemods', '40_rider', '45_race', '46_police', '47_underground', '48_street', '50_combat', '55_speedfx', '56_reflect', '57_comic', '58_entry', '60_audio', '62_music', '70_hud', '72_coach', '80_ui', '82_share', '84_career', '85_input', '90_main'];
const js = order.map(f => `// ===== ${f}.js =====\n` + fs.readFileSync(root + 'src/js/' + f + '.js', 'utf8')).join('\n');
const css = fs.readFileSync(root + 'src/style.css', 'utf8');
const tpl = fs.readFileSync(root + 'src/template.html', 'utf8');
const glb = fs.existsSync(root + 'assets/rx100.glb') ? zlib.gzipSync(fs.readFileSync(root + 'assets/rx100.glb'), { level: 9 }).toString('base64') : '';
const rider = fs.existsSync(root + 'assets/rider.glb') ? zlib.gzipSync(fs.readFileSync(root + 'assets/rider.glb'), { level: 9 }).toString('base64') : '';
const dogesh = fs.existsSync(root + 'assets/dogesh.glb') ? zlib.gzipSync(fs.readFileSync(root + 'assets/dogesh.glb'), { level: 9 }).toString('base64') : '';
// the soundtrack (the player's own Suno tracks): plain base64 MP3, already compressed, loudness-normalised to -16 LUFS
const mp3 = (n) => fs.existsSync(root + 'assets/music/' + n) ? fs.readFileSync(root + 'assets/music/' + n).toString('base64') : '';
// Two builds: dist/chapri-racer.html carries the songs inside (one file that works anywhere), and dist/web/ leaves them
// out (index.html ~3 MB + music/*.mp3) so a hosted page loads fast and the songs stream when they're needed.
const fill = (withMusic) => tpl.replace('{{CSS}}', () => css).replace('{{BIKEGLB}}', () => glb).replace('{{RIDERGLB}}', () => rider).replace('{{DOGESHGLB}}', () => dogesh)
  .replace('{{MUSINTRO}}', () => withMusic ? mp3('intro.mp3') : '').replace('{{MUSRACE}}', () => withMusic ? mp3('race.mp3') : '').replace('{{MUSPOLICE}}', () => withMusic ? mp3('police.mp3') : '').replace('{{JS}}', () => js);
const page = fill(true), web = fill(false);
fs.mkdirSync(root + 'dist', { recursive: true });
fs.writeFileSync(root + 'dist/chapri-racer.html', page);
fs.mkdirSync(root + 'dist/web/music', { recursive: true });
fs.writeFileSync(root + 'dist/web/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${web}</body></html>`);
fs.writeFileSync(root + 'dist/artifact.html', web);   // same page without the wrapper, for the claude.ai artifact (music/ published beside it)
for (const n of ['intro.mp3', 'race.mp3', 'police.mp3']) if (fs.existsSync(root + 'assets/music/' + n)) fs.copyFileSync(root + 'assets/music/' + n, root + 'dist/web/music/' + n);
fs.writeFileSync(root + 'dist/test.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`);
fs.writeFileSync(root + 'dist/game.mjs', js.replace("import * as THREE from 'three';", "import * as THREE from '../node_modules/three/build/three.module.js';"));
console.log('built', (page.length / 1024).toFixed(1) + ' KB', '· web', (web.length / 1024).toFixed(1) + ' KB + music');
