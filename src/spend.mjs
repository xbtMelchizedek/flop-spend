// Spend arithmetic in planck (1 FLOP = 10^18 planck, per the chain's system_properties). BigInt only.
const ONE = 10n ** 18n;

const int = (v, k) => {
  const s = String(v ?? '');
  if (!/^\d+$/.test(s)) throw new Error(`settlement field ${k} is not an integer: ${v}`);
  return BigInt(s);
};

/** What the agent was actually charged by one settlement: minerPaid + burned. */
export const spentOf = (row) => int(row.minerPaid, 'minerPaid') + int(row.burned, 'burned');

export function flop(planck) {
  const p = BigInt(planck);
  const f = (p % ONE).toString().padStart(18, '0').replace(/0+$/, '');
  return `${p / ONE}${f ? `.${f}` : ''}`;
}

export const rowKey = (r) => `${String(r.channelId).toLowerCase()}:${r.settledBlock}:${r.eventIndex}`;

/** Per-agent totals over settlement rows (already finalized and cross-checked). Sorted by spend, then address. */
export function aggregate(rows) {
  const by = new Map();
  for (const r of rows) {
    const a = by.get(r.agent) ?? { address: r.agent, settlements: 0, spent: 0n, gn: 0n, models: new Set(), miners: new Set(), firstBlock: Infinity, lastBlock: 0, lastAt: null };
    a.settlements += 1;
    a.spent += spentOf(r);
    a.gn += int(r.aggregateGn, 'aggregateGn');
    a.models.add(String(r.modelHash).toLowerCase());
    a.miners.add(r.miner);
    a.firstBlock = Math.min(a.firstBlock, Number(r.settledBlock));
    if (Number(r.settledBlock) >= a.lastBlock) { a.lastBlock = Number(r.settledBlock); a.lastAt = Number.isFinite(r.settledAt) ? new Date(r.settledAt).toISOString() : null; }
    by.set(r.agent, a);
  }
  return [...by.values()]
    .sort((x, y) => (y.spent > x.spent ? 1 : y.spent < x.spent ? -1 : x.address.localeCompare(y.address)))
    .map((a) => ({ address: a.address, settlements: a.settlements, spentPlanck: a.spent.toString(), spentFlop: flop(a.spent), aggregateGn: a.gn.toString(), models: a.models.size, miners: a.miners.size, firstBlock: a.firstBlock, lastBlock: a.lastBlock, lastAt: a.lastAt }));
}
