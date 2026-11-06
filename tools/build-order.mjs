// The game's source order. tools/build.mjs and the golden harness (tests/golden) both read this one list,
// so the browser build and the headless harness always use the same source, concatenated the same way.
import fs from 'fs';

export const JS_ORDER = ['00_core', '05_textures', '10_tracks', '15_track', '18_batch', '20_world', '21_stage', '22_underground', '23_street', '28_bikemodel', '29_ridermodel', '30_bike', '31_cloth', '32_bikemods', '40_rider', '45_race', '46_police', '47_underground', '48_street', '50_combat', '55_speedfx', '56_reflect', '57_comic', '58_entry', '60_audio', '62_music', '70_hud', '80_ui', '85_input', '90_main'];

// The concatenated game source, exactly as tools/build.mjs has always produced it. `root` ends with a slash.
export function readGameJs(root) {
  return JS_ORDER.map((f) => `// ===== ${f}.js =====\n` + fs.readFileSync(root + 'src/js/' + f + '.js', 'utf8')).join('\n');
}
