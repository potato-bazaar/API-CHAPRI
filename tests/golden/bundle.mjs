// Builds the headless copy of the game bundle that a golden run imports.
// The source is read fresh from src/js on every run, so a stale dist/ file can never be the thing under test.
// Two things change, and neither is game code: the bare `three` import becomes an absolute path, and a footer
// exports the names the harness needs.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL, fileURLToPath } from 'url';
import { readGameJs } from '../../tools/build-order.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const THREE_IMPORT = "import * as THREE from 'three';";
const FOOTER = '\n// ===== golden-harness footer (appended by tests/golden/bundle.mjs; not game code) =====\n' +
  'export { THREE, Game, GAME, TRACKS, MODES, DEBUG, SAVE, TEX, buildTextures, Race, Track, World };\n';

export function headlessSource() {
  const js = readGameJs(ROOT);
  const count = js.split(THREE_IMPORT).length - 1;
  if (count !== 1) throw new Error(`expected exactly one "${THREE_IMPORT}" in the game source, found ${count}`);
  const threeUrl = pathToFileURL(path.join(ROOT, 'node_modules/three/build/three.module.js')).href;
  return js.replace(THREE_IMPORT, `import * as THREE from '${threeUrl}';`) + FOOTER;
}

// Writes the headless module into tests/golden/.cache (git-ignored) and returns its file URL.
// The file name carries a hash of the content, so a changed source never reuses an old file.
export function headlessModuleUrl() {
  const src = headlessSource();
  const hash = crypto.createHash('sha256').update(src).digest('hex').slice(0, 16);
  const dir = path.join(ROOT, 'tests/golden/.cache');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `headless-${hash}.mjs`);
  if (!fs.existsSync(file)) {
    // Write to a per-process temp file, then rename. Several golden runs can start at once, and none may import a half-written file.
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, src);
    fs.renameSync(tmp, file);
  }
  return pathToFileURL(file).href;
}
