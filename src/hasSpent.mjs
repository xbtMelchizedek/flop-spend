// "Has this address spent yet?" Explorer rows for the address, newest first; only finalized settlements count, and
// the newest few are re-read from the chain before the answer is yes.
import { NETWORKS, toLeafFields, compareFacts } from 'flop-receipt-root';
import { agentSettlements, checkAddress, explorerHead, InputError } from './explorer.mjs';
import { spentOf, flop } from './spend.mjs';
import { MEASURED, DOCS } from './docs.mjs';
import { networkStatus } from './status.mjs';
import { openChain } from './chain.mjs';

export async function hasSpent(address, { network = 'auto', fetchImpl = globalThis.fetch, chainFor = openChain, check = 3, maxRows = 1000, snapshotUrl } = {}) {
  checkAddress(address);
  if (!Number.isSafeInteger(check) || check < 1 || check > 50) throw new InputError('check', 'must be 1..50');
  let note = null;
  if (network === 'auto') {
    const st = await networkStatus({ fetchImpl, snapshotUrl });
    network = st.pick;
    if (network === 'devnet') note = `Answered on devnet: ${st.reason}. Devnet FLOP has no value and devnet is not scored.`;
  }
  if (!NETWORKS[network]) throw new InputError('network', 'must be auto, devnet or testnet');
  const fin = await explorerHead(network, fetchImpl);
  const { rows, total, complete } = await agentSettlements(network, address, { maxRows, fetchImpl });
  const final = rows.filter((r) => /^computeChannel\./.test(r.settlementEvent ?? '') && Number(r.settledBlock) <= fin.number);
  const charged = final.filter((r) => spentOf(r) > 0n);
  const spent = charged.reduce((s, r) => s + spentOf(r), 0n);
  const out = {
    address, network, note,
    spent: charged.length > 0,
    verified: false,
    spentFlop: flop(spent),
    settlements: { explorerTotal: total, fetched: rows.length, finalized: final.length, charged: charged.length, complete },
    newest: charged[0] ? { block: Number(charged[0].settledBlock), at: Number.isFinite(charged[0].settledAt) ? new Date(charged[0].settledAt).toISOString() : null, channelId: charged[0].channelId, spentFlop: flop(spentOf(charged[0])) } : null,
    check: null,
    explorerFinalized: fin.number,
    measured: MEASURED,
    docs: DOCS.map((d) => d.url),
  };
  if (!out.spent) return out;
  const chain = await chainFor(network);
  try {
    const cf = await chain.finalized();
    // Rows newer than the RPC node's finalized head are counted by the explorer but not re-read yet.
    const sample = charged.filter((r) => Number(r.settledBlock) <= cf.number).slice(0, check);
    const problems = [];
    for (const r of sample) {
      const f = toLeafFields(r, NETWORKS[network].genesis);
      problems.push(...compareFacts(f, await chain.readFacts(f)));
    }
    out.check = { checked: sample.length, agree: problems.length === 0, chainFinalized: cf.number, problems: problems.slice(0, 20) };
    out.verified = sample.length > 0 && problems.length === 0;
  } finally {
    await chain.close?.();
  }
  return out;
}
