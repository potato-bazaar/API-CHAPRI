// The CLI: `node server/index.mjs` as its own process, configured from the environment, stopped with a signal.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectClient, makeFixtureDir } from './helpers.mjs';

const ENTRY = fileURLToPath(new URL('../../server/index.mjs', import.meta.url));
let fixture;

beforeAll(() => {
  fixture = makeFixtureDir();
});

afterAll(() => {
  fixture.remove();
});

// Starts the CLI with PORT=0 and resolves once it logs its port.
function startCli(env = {}) {
  const child = spawn(process.execPath, [ENTRY], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', GAME_FILE: fixture.file, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const out = { stdout: '', stderr: '' };
  child.stdout.on('data', (d) => { out.stdout += d; });
  child.stderr.on('data', (d) => { out.stderr += d; });
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CLI did not start: ${out.stdout} ${out.stderr}`)), 10000);
    const check = () => {
      const line = out.stdout.split('\n').find((l) => l.includes('"msg":"listening"'));
      if (!line) return;
      clearTimeout(timer);
      child.stdout.off('data', check);
      resolve(JSON.parse(line).port);
    };
    child.stdout.on('data', check);
    exited.then(() => { clearTimeout(timer); reject(new Error(`CLI exited early: ${out.stdout} ${out.stderr}`)); });
  });
  return { child, out, exited, ready };
}

describe('node server/index.mjs', () => {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    it(`serves the page and health, and exits 0 on ${signal} after telling the rooms`, async () => {
      const cli = startCli();
      const port = await cli.ready;
      const url = `http://127.0.0.1:${port}`;
      const health = await (await fetch(url + '/healthz')).json();
      expect(health).toMatchObject({ ok: true, rooms: 0, sockets: 0 });
      const page = await fetch(url + '/');
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('Fixture Racer');
      expect((await fetch(url + '/socket.io/socket.io.js')).status).toBe(200);
      const c = await connectClient(url);
      expect((await c.request('room:create', { name: 'Cli' })).ok).toBe(true);
      const t0 = Date.now();
      cli.child.kill(signal);
      expect(await c.wait('room:closed', () => true, 5000)).toEqual({ reason: 'server-shutdown' });
      const { code } = await cli.exited;
      expect(code).toBe(0);
      expect(Date.now() - t0).toBeLessThan(5000);
      c.close();
      const lines = cli.out.stdout.trim().split('\n');
      for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
      expect(lines.some((l) => l.includes('"msg":"shutting down"'))).toBe(true);
      expect(cli.out.stdout).not.toMatch(/[0-9a-f]{32}/);
      expect(cli.out.stdout).not.toContain('127.0.0.1');
      expect(cli.out.stderr).toBe('');
    });
  }

  it('refuses to start with a malformed setting', async () => {
    const cli = startCli({ MAX_ROOMS: 'lots' });
    await expect(cli.ready).rejects.toThrow(/exited early/);
    const { code } = await cli.exited;
    expect(code).toBe(1);
    expect(cli.out.stderr).toContain('MAX_ROOMS');
  });

  it('exits 1 when the port is taken', async () => {
    const first = startCli();
    const port = await first.ready;
    const second = startCli({ PORT: String(port) });
    await expect(second.ready).rejects.toThrow(/exited early/);
    expect((await second.exited).code).toBe(1);
    expect(second.out.stdout).toContain('could not start');
    first.child.kill('SIGTERM');
    expect((await first.exited).code).toBe(0);
  });
});
