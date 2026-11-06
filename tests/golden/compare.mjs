// Compares a fresh run with a committed baseline. A pure function, unit-tested in tests/unit.
export function compareRuns(baseline, current) {
  const problems = [];
  const bh = baseline.hashes;
  const ch = current.hashes;
  let firstSecond = null;
  for (let i = 0; i < Math.min(bh.length, ch.length); i++) {
    if (bh[i] !== ch[i]) { firstSecond = i; break; }
  }
  if (firstSecond !== null) problems.push({ kind: 'hash', second: firstSecond, expected: bh[firstSecond], actual: ch[firstSecond] });
  if (bh.length !== ch.length) problems.push({ kind: 'length', expected: bh.length, actual: ch.length });
  if (JSON.stringify(baseline.result) !== JSON.stringify(current.result)) problems.push({ kind: 'result' });
  return { ok: problems.length === 0, firstSecond, problems };
}
