// Dashboard data: every finalized settlement in a recent window, cross-checked on chain (flop-receipt-root),
// summed per agent. If a build can't complete, the last good data is republished marked stale, or an empty
// state with the reason; the page never shows numbers it could not check.
import { NETWORKS, settlementsSince, buildEpoch, crossCheck } from 'flop-receipt-root';
import { networkStatus } from './status.mjs';
import { aggregate, spentOf, flop, rowKey } from './spend.mjs';
import { getJson, explorerHead } from './explorer.mjs';
import { openChain, RPC } from './chain.mjs';
import { MEASURED, DOCS } from './docs.mjs';

export const SITE = 'https://xbtmelchizedek.github.io/flop-spend/';

export async function buildData({ network = 'auto', lastBlocks = 21600, maxRows = 3000, fetchImpl = globalThis.fetch, chainFor = openChain, snapshotUrl, now = () => new Date() } = {}) {
  const status = await networkStatus({ fetchImpl, snapshotUrl });
  const net = network === 'auto' ? status.pick : network;
  if (!NETWORKS[net]) throw new Error('network must be auto, devnet or testnet');
  const base = { generatedAt: now().toISOString(), network: net, status, measured: MEASURED, docs: DOCS };
  const chain = await chainFor(net);
  try {
    // The window ends at whichever finalized head is older, the explorer's or the RPC node's, so every row in it is
    // final on both sources.
    const xfin = await explorerHead(net, fetchImpl);
    const cfin = await chain.finalized();
    const fin = cfin.number <= xfin.number ? cfin : xfin;
    const fromBlock = Math.max(0, fin.number - lastBlocks);
    const rows = await settlementsSince(net, fromBlock, { maxRows, fetchImpl });
    const settled = rows.filter((r) => /^computeChannel\./.test(r.settlementEvent ?? '') && Number(r.settledBlock) <= fin.number && Number(r.settledBlock) >= fromBlock);
    const window = { fromBlock, toBlock: fin.number, toBlockHash: fin.hash, blocks: fin.number - fromBlock };
    if (settled.length === 0) return { data: { ...base, window, empty: `no finalized settlements on ${net} in blocks ${fromBlock}..${fin.number}`, agents: [], totals: { settlements: 0, agents: 0, spentFlop: '0' } }, epoch: null };
    const epoch = buildEpoch({ rows: settled, finalized: fin, genesis: NETWORKS[net].genesis, epoch: 1, fromBlock });
    const cc = await crossCheck(epoch, chain, { concurrency: 8 });
    return finish(base, window, settled, epoch, cc, net);
  } finally {
    await chain.close?.();
  }
}

function finish(base, window, settled, epoch, cc, net) {
  // Same dedupe as the epoch: one row per settlement event.
  const uniq = [...new Map(settled.map((r) => [rowKey(r), r])).values()];
  const agents = aggregate(uniq);
  const total = uniq.reduce((s, r) => s + spentOf(r), 0n);
  return {
    data: {
      ...base, window,
      sources: { explorer: NETWORKS[net].explorer, rpc: RPC[net], crossChecked: cc.checked, rpcFinalized: cc.finalized.number, root: epoch.msg.root },
      totals: { settlements: uniq.length, agents: agents.length, spentFlop: flop(total) },
      agents,
    },
    epoch: { network: net, builtAt: base.generatedAt, note: 'unsigned; every leaf cross-checked on chain', ...epoch, sigs: [] },
  };
}

/** Last good data from the live site, marked stale; or an empty state that says why. */
export async function fallbackData(reason, { fetchImpl = globalThis.fetch, prevUrl = `${SITE}data/spend.json`, now = () => new Date() } = {}) {
  try {
    const prev = await getJson(fetchImpl, prevUrl);
    if (prev && Array.isArray(prev.agents)) return { ...prev, stale: { reason, since: prev.stale?.since ?? prev.generatedAt, checkedAt: now().toISOString() } };
  } catch { /* first build or site down: fall through */ }
  return { generatedAt: now().toISOString(), network: null, unavailable: reason, agents: [], totals: { settlements: 0, agents: 0, spentFlop: '0' }, measured: MEASURED, docs: DOCS };
}
