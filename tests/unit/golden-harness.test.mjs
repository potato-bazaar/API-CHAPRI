// Unit tests for the golden harness itself. A harness that cannot fail is worse than none, so these check it.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { mulberry32 } from '../golden/prng.mjs';
import { compareRuns } from '../golden/compare.mjs';
import { JS_ORDER, readGameJs } from '../../tools/build-order.mjs';
import { headlessSource, ROOT } from '../golden/bundle.mjs';
import { CUP, STREAMS_HZ, allBaselines, baselineFile } from '../golden/spec.mjs';

describe('seeded generator', () => {
  it('produces the recorded sequence for seed 12345', () => {
    const r = mulberry32(12345);
    expect(Array.from({ length: 5 }, () => r())).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061,
    ]);
  });

  it('the same seed repeats its sequence and a different seed does not', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const c = mulberry32(8);
    const seqA = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c())).not.toEqual(seqA);
  });
});

describe('comparison of runs', () => {
  const base = { hashes: ['h0', 'h1', 'h2'], result: { allFinished: true, playerPos: 2 } };

  it('accepts identical runs', () => {
    expect(compareRuns(base, JSON.parse(JSON.stringify(base))).ok).toBe(true);
  });

  it('reports the first simulated second whose hash differs', () => {
    const r = compareRuns(base, { hashes: ['h0', 'h1', 'X'], result: base.result });
    expect(r.ok).toBe(false);
    expect(r.firstSecond).toBe(2);
  });

  it('reports a run with a different number of simulated seconds', () => {
    const r = compareRuns(base, { hashes: ['h0', 'h1'], result: base.result });
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.kind)).toContain('length');
  });

  it('reports a different final result even when every hash matches', () => {
    const r = compareRuns(base, { hashes: base.hashes, result: { allFinished: true, playerPos: 3 } });
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.kind)).toEqual(['result']);
  });
});

describe('headless game bundle', () => {
  it('uses the source files in the browser build order', () => {
    // 30 solo files, plus the three multiplayer files (82, 83, 84) that sit between the menu UI and the input module.
    expect(JS_ORDER).toHaveLength(33);
    expect(JS_ORDER[0]).toBe('00_core');
    expect(JS_ORDER[JS_ORDER.length - 1]).toBe('90_main');
    const menu = JS_ORDER.indexOf('80_ui');
    expect(JS_ORDER.slice(menu, menu + 5)).toEqual(['80_ui', '82_mp_net', '83_mp_lobby', '84_mp_race', '85_input']);
    for (const f of JS_ORDER) expect(fs.existsSync(`${ROOT}src/js/${f}.js`), f).toBe(true);
  });

  it('concatenates the source the way the browser build does', () => {
    expect(readGameJs(ROOT).startsWith('// ===== 00_core.js =====\n')).toBe(true);
  });

  it('replaces the bare three.js import once, with an absolute path, and exports the names the harness uses', () => {
    const src = headlessSource();
    expect(src).not.toContain("import * as THREE from 'three';");
    expect(src).toMatch(/import \* as THREE from 'file:\/\/[^']*three\.module\.js';/);
    expect(src).toMatch(/export \{ THREE, Game, GAME, TRACKS, MODES, DEBUG, SAVE, TEX, buildTextures, Race, Track, World \};/);
  });
});

describe('golden coverage', () => {
  it('covers exactly the six cup tracks defined in src/js/10_tracks.js', () => {
    const src = fs.readFileSync(`${ROOT}src/js/10_tracks.js`, 'utf8');
    const defs = [...src.matchAll(/^\s*id: '([a-z-]+)'.*$/gm)].map((m) => ({ id: m[1], special: /special: true/.test(m[0]) }));
    const cup = defs.filter((d) => !d.special).map((d) => d.id).sort();
    expect(cup).toHaveLength(6);
    expect(CUP.map((c) => c.track).sort()).toEqual(cup);
  });

  it('has one committed baseline per track and frame stream', () => {
    expect(STREAMS_HZ).toEqual([60, 30, 144]);
    expect(allBaselines()).toHaveLength(18);
    for (const b of allBaselines()) {
      expect(fs.existsSync(fileURLToPath(new URL('../golden/baselines/' + baselineFile(b.track, b.hz), import.meta.url)))).toBe(true);
    }
  });
});
