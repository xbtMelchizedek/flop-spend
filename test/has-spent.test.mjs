import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSpent } from '../src/hasSpent.mjs';
import { main, makeHandler } from '../src/cli.mjs';
import { fx, replayFetch, replayChain } from './replay.mjs';

const opts = (o = {}) => ({ maxRows: 100, fetchImpl: replayFetch(o.over), chainFor: replayChain(o.chain) });

test('has-spent yes: recorded devnet spender, newest 3 agree on chain, partial read is labelled', async () => {
  const r = await hasSpent(fx.spender, opts());
  assert.equal(r.network, 'devnet');
  assert.match(r.note, /devnet.*no value/i);
  assert.equal(r.spent, true);
  assert.equal(r.verified, true);
  assert.equal(r.spentFlop, fx.expect.yes.spentFlop);
  assert.deepEqual(r.settlements, fx.expect.yes.settlements);
  assert.equal(r.settlements.complete, false);
  assert.equal(r.check.checked, 3);
});

test('has-spent no: an address with zero settlements as agent', async () => {
  const r = await hasSpent(fx.nonSpender, opts());
  assert.equal(r.spent, false);
  assert.equal(r.check, null);
  assert.equal(r.settlements.explorerTotal, 0);
});

test('explorer ignoring the agent filter is an error, not a count', async () => {
  const url = `agent=${fx.spender}`;
  const wrong = (rec) => { const j = JSON.parse(rec.body); j.data[5].agent = fx.nonSpender; return { status: 200, body: JSON.stringify(j) }; };
  await assert.rejects(hasSpent(fx.spender, opts({ over: { [url]: wrong } })), /refusing to count/);
});

test('chain disagreement: not verified, CLI exit 2', async () => {
  const edit = (x) => { if (x?.channel) x.channel.agent = fx.nonSpender; return x; };
  const r = await hasSpent(fx.spender, opts({ chain: { edit } }));
  assert.equal(r.verified, false);
  assert.ok(r.check.problems.length > 0);
  let out = '';
  assert.equal(await main(['has-spent', fx.spender, '--max-rows', '100'], { out: (s) => { out = s; }, fetchImpl: replayFetch(), chainFor: replayChain({ edit }) }), 2);
  assert.match(out, /UNVERIFIED/);
});

test('CLI exit codes: 0 yes, 1 no, 2 bad address, 2 testnet forced while its explorer is down', async () => {
  let out = '';
  const o = { out: (s) => { out = s; }, fetchImpl: replayFetch(), chainFor: replayChain() };
  assert.equal(await main(['has-spent', fx.spender, '--max-rows', '100'], o), 0);
  assert.match(out, /^Answered on devnet/);
  assert.match(out, /YES: .* spent [\d.]+ FLOP on devnet across the newest 100 of \d+ settlements/);
  assert.match(out, /No airdrop estimate/);
  assert.equal(await main(['has-spent', fx.nonSpender, '--max-rows', '100'], o), 1);
  assert.match(out, /NO: /);
  assert.equal(await main(['has-spent', 'nope'], o), 2);
  assert.match(out, /SS58/);
  assert.equal(await main(['has-spent', fx.spender, '--network', 'testnet'], o), 2);
  assert.match(out, /testnet\.flopscan\.io.*(\/api\/stats|404)/);
  assert.equal(await main(['has-spent', fx.spender, '--max-rows', '100', '--json'], o), 0);
  assert.equal(JSON.parse(out).verified, true);
});

test('MCP: tools/list and flop_has_spent / flop_spend_status calls', async () => {
  const h = makeHandler({ fetchImpl: replayFetch(), chainFor: replayChain() });
  const init = await h({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'flop-spend');
  const list = await h({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['flop_has_spent', 'flop_spend_status']);
  const no = await h({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'flop_has_spent', arguments: { address: fx.nonSpender } } });
  assert.equal(no.result.isError, false);
  assert.match(no.result.content[0].text, /^Answered on devnet[\s\S]*NO: /);
  const bad = await h({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'flop_has_spent', arguments: { address: 'x' } } });
  assert.equal(bad.result.isError, true);
  const st = await h({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'flop_spend_status', arguments: {} } });
  assert.equal(JSON.parse(st.result.content[0].text).pick, 'devnet');
  assert.equal(await h({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
