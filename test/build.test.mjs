import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildData, fallbackData } from '../src/build.mjs';
import { networkStatus } from '../src/status.mjs';
import { main } from '../src/cli.mjs';
import { verifyProof, leafHash, unhex } from 'flop-receipt-root';
import { fx, replayFetch, replayChain } from './replay.mjs';

const lastBlocks = fx.lastBlocks;
const SNAP = 'justweight/data/snapshot.json';
const TH = 'https://testnet.flopscan.io/api/health';
const now = () => new Date('2026-11-24T21:10:00Z');

test('build on recorded devnet: totals, window and root match the recording; every leaf cross-checked', async () => {
  const { data, epoch } = await buildData({ lastBlocks, fetchImpl: replayFetch(), chainFor: replayChain(), now });
  assert.equal(data.network, 'devnet');
  assert.match(data.status.reason, /testnet explorer \(https:\/\/testnet\.flopscan\.io\): .*404/);
  assert.equal(data.status.testnet.watch.stage, 'explorer-down');
  assert.deepEqual(data.totals, fx.expect.totals);
  assert.deepEqual(data.window, fx.expect.window);
  assert.equal(data.sources.root, fx.expect.root);
  assert.equal(data.sources.crossChecked, data.totals.settlements);
  assert.equal(data.agents.reduce((s, a) => s + a.settlements, 0), data.totals.settlements);
  const [w, f = ''] = data.totals.spentFlop.split('.');
  assert.equal(data.agents.reduce((s, a) => s + BigInt(a.spentPlanck), 0n), BigInt(w) * 10n ** 18n + BigInt(f.padEnd(18, '0')));
  // Published epoch is verifiable with flop-receipt-root.
  for (const it of epoch.items) assert.ok(verifyProof(unhex(epoch.msg.root), leafHash(it.fields), it.proof.map(unhex)));
  assert.ok(data.docs.length === 2 && data.measured.includes('minerPaid + burned'));
});

test('build refuses numbers the chain disagrees with', async () => {
  const edit = (x) => { if (x?.settled?.[0]) x.settled[0].minerPaid = (BigInt(x.settled[0].minerPaid) + 1n).toString(); return x; };
  await assert.rejects(buildData({ lastBlocks, fetchImpl: replayFetch(), chainFor: replayChain({ edit }), now }), (e) => e.problems?.length > 0);
});

test('window ends at the older finalized head of explorer and RPC', async () => {
  // Synthetic: the RPC node is 500 blocks behind the recording. Same window start, so every row is still recorded.
  const lag = { number: fx.chain.finalized.number - 500, hash: '0x' + '11'.repeat(32) };
  const { data } = await buildData({ lastBlocks: lastBlocks - 500, fetchImpl: replayFetch(), chainFor: replayChain({ finalized: lag, hashes: { [lag.number]: lag.hash } }), now });
  assert.equal(data.window.toBlock, lag.number);
  assert.equal(data.window.fromBlock, fx.expect.window.fromBlock);
  assert.ok(data.totals.settlements < fx.expect.totals.settlements);
  assert.ok(data.agents.every((a) => a.lastBlock <= lag.number));
});

test('status: testnet 503, testnet up with 0 settlements, testnet with settlements (synthetic testnet responses)', async () => {
  const s503 = await networkStatus({ fetchImpl: replayFetch({ [TH]: { status: 503, body: '{"error":"Era-T reader unavailable"}' } }) });
  assert.equal(s503.pick, 'devnet');
  assert.match(s503.reason, /503/);
  const health = { status: 200, body: JSON.stringify({ writer: { genesis: '0x918abd58fb16306b30ef3886514cfaebffecb4de43e82b6f8ec4795c43cfd800', sourceFinalizedHead: 1000, sourceFinalizedHash: '0x' + 'ab'.repeat(32), indexedHead: 1000 } }) };
  const empty = { status: 200, body: JSON.stringify({ data: [], pagination: { total: 0, limit: 1, offset: 0, hasMore: false } }) };
  const s0 = await networkStatus({ fetchImpl: replayFetch({ [TH]: health, 'testnet.flopscan.io/api/settlement-prices': empty }) });
  assert.equal(s0.pick, 'devnet');
  assert.match(s0.reason, /up but reports 0 settlements/);
  const some = { status: 200, body: JSON.stringify({ data: [{}], pagination: { total: 4, limit: 1, offset: 0, hasMore: true } }) };
  const s4 = await networkStatus({ fetchImpl: replayFetch({ [TH]: health, 'testnet.flopscan.io/api/settlement-prices': some }) });
  assert.equal(s4.pick, 'testnet');
  const noSnap = await networkStatus({ fetchImpl: replayFetch({ [SNAP]: { status: 500, body: '' } }) });
  assert.match(noSnap.testnet.watch.detail, /unreadable/);
});

test('cli build degrades: explorer 503 with no previous site gives an empty state; with a previous site, stale data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fs-'));
  const down = { 'explorer.devnet.flop.network/api/health': { status: 503, body: '{"error":"down"}' } };
  let out = '';
  assert.equal(await main(['build', '--out', dir, '--last-blocks', String(lastBlocks)], { out: (s) => { out = s; }, fetchImpl: replayFetch({ ...down, 'flop-spend/data/spend.json': { status: 404, body: '' } }), chainFor: replayChain() }), 0);
  const empty = JSON.parse(readFileSync(join(dir, 'data/spend.json'), 'utf8'));
  assert.match(empty.unavailable, /503/);
  assert.deepEqual(empty.agents, []);
  assert.equal(empty.status.pick, 'devnet');
  assert.match(out, /unavailable/);

  const prev = { generatedAt: '2026-11-24T19:00:00.000Z', network: 'devnet', agents: [{ address: fx.spender }], totals: { settlements: 1, agents: 1, spentFlop: '1' } };
  const dir2 = mkdtempSync(join(tmpdir(), 'fs-'));
  await main(['build', '--out', dir2, '--last-blocks', String(lastBlocks)], { out: () => {}, fetchImpl: replayFetch({ ...down, 'flop-spend/data/spend.json': { status: 200, body: JSON.stringify(prev) } }), chainFor: replayChain() });
  const stale = JSON.parse(readFileSync(join(dir2, 'data/spend.json'), 'utf8'));
  assert.equal(stale.stale.since, prev.generatedAt);
  assert.match(stale.stale.reason, /503/);
  assert.equal(stale.agents.length, 1);
  assert.ok(!existsSync(join(dir2, 'data/epoch.json')));
});

test('cli build writes spend.json and epoch.json from the recording', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fs-'));
  assert.equal(await main(['build', '--out', dir, '--last-blocks', String(lastBlocks)], { out: () => {}, fetchImpl: replayFetch(), chainFor: replayChain() }), 0);
  const d = JSON.parse(readFileSync(join(dir, 'data/spend.json'), 'utf8'));
  const e = JSON.parse(readFileSync(join(dir, 'data/epoch.json'), 'utf8'));
  assert.deepEqual(d.totals, fx.expect.totals);
  assert.equal(e.msg.root, d.sources.root);
});

test('fallbackData with nothing published is an explicit empty state', async () => {
  const d = await fallbackData('x', { fetchImpl: async () => { throw new Error('offline'); }, now });
  assert.equal(d.unavailable, 'x');
  assert.equal(d.network, null);
});
