import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, symlinkSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));

test('package: bin, exports, files and changelog line up', async () => {
  assert.equal(pkg.bin['flop-spend'], 'src/cli.mjs');
  for (const f of pkg.files) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  assert.match(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), new RegExp(`## ${pkg.version.replaceAll('.', '\\.')} `));
  const m = await import('flop-spend');
  for (const k of ['hasSpent', 'networkStatus', 'buildData', 'aggregate', 'flop', 'DOCS', 'MEASURED']) assert.ok(m[k], k);
});

test('package: the bin runs through a symlink (npx) and prints help', () => {
  const link = join(mkdtempSync(join(tmpdir(), 'fsbin-')), 'flop-spend');
  symlinkSync(cli, link);
  const out = execFileSync(process.execPath, [link, '--help'], { encoding: 'utf8' });
  assert.match(out, /^flop-spend \d+\.\d+\.\d+/);
  assert.match(out, /No airdrop|Not measured: airdrop/);
  const bad = spawnSync(process.execPath, [link, 'has-spent', 'nope'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
