// Re-record test/fixtures/devnet_replay.json from the live devnet explorer and RPC (read-only, public endpoints).
// Every HTTP response and chain read made by one `build` and two `has-spent` calls is saved and replayed in tests.
// Run: node scripts/record-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { buildData } from '../src/build.mjs';
import { hasSpent } from '../src/hasSpent.mjs';
import { openChain } from '../src/chain.mjs';

const http = {};
const fetchImpl = async (url, init) => {
  const r = await fetch(url, init);
  let body = await r.text();
  // The justweight snapshot is large; keep only the fields this tool reads.
  if (url.includes('justweight/data/snapshot.json') && r.ok) { const j = JSON.parse(body); body = JSON.stringify({ generatedAt: j.generatedAt, flop: { watch: j.flop?.watch }, _trimmed: 'only generatedAt and flop.watch kept' }); }
  http[url] = { status: r.status, body };
  return new Response(body, { status: r.status, headers: { 'content-type': 'application/json' } });
};
const chain = { finalized: null, hashAt: {}, facts: {} };
const key = (f) => `${f.channelId}:${f.settledBlock}:${f.eventIndex}`;
const chainFor = async (net) => {
  const c = await openChain(net);
  return {
    finalized: async () => (chain.finalized ??= await c.finalized()),
    hashAt: async (n) => (chain.hashAt[n] ??= await c.hashAt(n)),
    readFacts: async (f) => (chain.facts[key(f)] ??= await c.readFacts(f)),
    close: () => c.close(),
  };
};

const built = await buildData({ lastBlocks: 1800, fetchImpl, chainFor });
const top = built.data.agents[0].address;
const miner = (await (await fetchImpl(`${built.data.sources.explorer}/api/settlement-prices?limit=1&offset=0`)).json()).data[0].miner;
const yes = await hasSpent(top, { maxRows: 100, fetchImpl, chainFor });
const no = await hasSpent(miner, { maxRows: 100, fetchImpl, chainFor });
writeFileSync(new URL('../test/fixtures/devnet_replay.json', import.meta.url), JSON.stringify({
  recordedAt: new Date().toISOString(), lastBlocks: 1800, spender: top, nonSpender: miner, http, chain,
  expect: { totals: built.data.totals, window: built.data.window, root: built.data.sources.root, yes: { spentFlop: yes.spentFlop, settlements: yes.settlements }, no: { spent: no.spent } },
}, null, 1) + '\n');
console.log(JSON.stringify({ totals: built.data.totals, window: built.data.window, yes: [yes.spent, yes.verified, yes.spentFlop, yes.settlements], no: [no.spent, no.settlements], urls: Object.keys(http).length, facts: Object.keys(chain.facts).length }));
