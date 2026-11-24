// Which network can be measured right now. Testnet is used as soon as it has finalized settlements; until then the
// tracker shows devnet and says why. The readiness signal is justweight's testnet watcher (its published snapshot
// carries the stage every 2 hours), plus one direct read of the testnet explorer.
import { NETWORKS, finalizedHead } from 'flop-receipt-root';
import { getJson } from './explorer.mjs';

export const JUSTWEIGHT_SNAPSHOT = 'https://xbtmelchizedek.github.io/justweight/data/snapshot.json';

export async function networkStatus({ fetchImpl = globalThis.fetch, snapshotUrl = JUSTWEIGHT_SNAPSHOT } = {}) {
  const testnet = { explorer: null, settlements: null, watch: null };
  try {
    const snap = await getJson(fetchImpl, snapshotUrl);
    const w = snap?.flop?.watch;
    testnet.watch = w ? { stage: w.stage ?? null, detail: w.detail ?? null, at: snap.generatedAt ?? null, source: snapshotUrl } : { stage: null, detail: 'snapshot has no flop.watch', source: snapshotUrl };
  } catch (e) {
    testnet.watch = { stage: null, detail: `justweight snapshot unreadable: ${e.message}`, source: snapshotUrl };
  }
  try {
    const fin = await finalizedHead('testnet', fetchImpl);
    testnet.explorer = { ok: true, finalized: fin.number };
    const j = await getJson(fetchImpl, `${NETWORKS.testnet.explorer}/api/settlement-prices?limit=1&offset=0`);
    testnet.settlements = Number.isSafeInteger(j?.pagination?.total) ? j.pagination.total : Array.isArray(j?.data) ? j.data.length : null;
  } catch (e) {
    testnet.explorer = { ok: false, detail: e.message };
  }
  const ready = testnet.explorer?.ok === true && testnet.settlements > 0;
  const why = ready
    ? `testnet has ${testnet.settlements} settlement(s)`
    : !testnet.explorer?.ok
      ? `testnet explorer (${NETWORKS.testnet.explorer}): ${testnet.explorer.detail}`
      : `testnet explorer is up but reports ${testnet.settlements ?? 'no'} settlements`;
  return { pick: ready ? 'testnet' : 'devnet', reason: why, testnet, checkedAt: new Date().toISOString() };
}
