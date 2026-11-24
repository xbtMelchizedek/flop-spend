// Explorer reads for one address, genesis pinned through flop-receipt-root. Every row is validated: the explorer's
// agent filter is undocumented, so a row for any other address is an error, never silently counted.
import { NETWORKS, ss58ToPubkey, finalizedHead } from 'flop-receipt-root';

const UA = { 'user-agent': 'flop-spend (+https://github.com/xbtMelchizedek/flop-spend)', accept: 'application/json' };

export class InputError extends Error {
  constructor(field, msg) { super(`${field}: ${msg}`); this.field = field; }
}

/** SS58 address check (checksum verified). Returns the 32-byte public key hex. */
export function checkAddress(address) {
  if (typeof address !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(address)) throw new InputError('address', 'expected an SS58 address like 5F...');
  try { return ss58ToPubkey(address); } catch (e) { throw new InputError('address', `not a valid SS58 address (${e.message})`); }
}

/** finalizedHead with the explorer named in any error. */
export async function explorerHead(network, fetchImpl) {
  try { return await finalizedHead(network, fetchImpl); } catch (e) { throw Object.assign(new Error(`${network} explorer ${NETWORKS[network].explorer}: ${e.message}`), { status: e.status }); }
}

export async function getJson(fetchImpl, url) {
  const r = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) {
    let body = '';
    try { body = (await r.text()).slice(0, 120); } catch { /* ignore */ }
    const e = new Error(`${new URL(url).host}${new URL(url).pathname} HTTP ${r.status}${body ? `: ${body}` : ''}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

/** Newest-first settlements where `address` is the agent, up to maxRows. */
export async function agentSettlements(network, address, { maxRows = 1000, fetchImpl = globalThis.fetch } = {}) {
  const net = NETWORKS[network];
  if (!net) throw new InputError('network', `unknown network ${network}`);
  checkAddress(address);
  const rows = [];
  let total = null;
  for (let offset = 0; rows.length < maxRows;) {
    const j = await getJson(fetchImpl, `${net.explorer}/api/settlement-prices?limit=100&offset=${offset}&agent=${encodeURIComponent(address)}`);
    if (!Array.isArray(j?.data)) throw new Error('settlement-prices: no data array');
    total = Number.isSafeInteger(j.pagination?.total) ? j.pagination.total : total;
    for (const r of j.data) {
      if (r.agent !== address) throw new Error(`explorer returned a settlement for ${r.agent} when asked for ${address}; refusing to count it`);
      if (rows.length < maxRows) rows.push(r);
    }
    offset += j.data.length;
    if (j.data.length === 0 || !j.pagination?.hasMore) return { rows, total, complete: true };
  }
  return { rows, total, complete: total !== null && rows.length >= total };
}
