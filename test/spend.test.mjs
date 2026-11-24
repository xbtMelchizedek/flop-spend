import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spentOf, flop, aggregate } from '../src/spend.mjs';
import { checkAddress } from '../src/explorer.mjs';
import { fx, rowsOf } from './replay.mjs';

const WIN = 'https://explorer.devnet.flop.network/api/settlement-prices?limit=100&offset=0';

test('spend is minerPaid + burned, and on real devnet rows escrow = minerPaid + burned + unusedEscrow', () => {
  const rows = [...rowsOf(WIN), ...rowsOf(`${WIN}&agent=${fx.spender}`)];
  assert.ok(rows.length > 100);
  for (const r of rows) assert.equal(BigInt(r.escrow), spentOf(r) + BigInt(r.unusedEscrow), r.channelId);
  assert.equal(spentOf({ minerPaid: '64610625000000009', burned: '5' }), 64610625000000014n);
  assert.throws(() => spentOf({ minerPaid: '1.5', burned: '0' }), /not an integer/);
  assert.throws(() => spentOf({ minerPaid: '-1', burned: '0' }), /not an integer/);
});

test('flop() formats 18-decimal planck exactly', () => {
  assert.equal(flop(0n), '0');
  assert.equal(flop(10n ** 18n), '1');
  assert.equal(flop(1n), '0.000000000000000001');
  assert.equal(flop(131841375000000040n), '0.13184137500000004');
  assert.equal(flop(123n * 10n ** 18n + 5n * 10n ** 17n), '123.5');
});

test('aggregate: per-agent sums, sorted by spend, every planck accounted for', () => {
  const rows = rowsOf(`${WIN}&agent=${fx.spender}`);
  const [a] = aggregate(rows);
  assert.equal(a.address, fx.spender);
  assert.equal(a.settlements, rows.length);
  assert.equal(BigInt(a.spentPlanck), rows.reduce((s, r) => s + spentOf(r), 0n));
  assert.equal(a.lastBlock, Math.max(...rows.map((r) => r.settledBlock)));
  const two = aggregate([{ ...rows[0], agent: 'B' }, { ...rows[1], agent: 'A', minerPaid: '0', burned: '0' }, rows[2]]);
  assert.deepEqual(two.map((x) => x.address), [...[{ a: 'B', s: spentOf(rows[0]) }, { a: fx.spender, s: spentOf(rows[2]) }].sort((x, y) => (y.s > x.s ? 1 : -1)).map((x) => x.a), 'A']);
});

test('addresses are checked before any network call', () => {
  assert.match(checkAddress(fx.spender), /^0x[0-9a-f]{64}$/);
  assert.throws(() => checkAddress('0x1234'), /SS58/);
  assert.throws(() => checkAddress(fx.spender.slice(0, -1) + (fx.spender.endsWith('S') ? 'T' : 'S')), /not a valid SS58/);
});
