// Replays test/fixtures/devnet_replay.json: every explorer response and chain read from one real devnet recording.
import { readFileSync } from 'node:fs';

export const fx = JSON.parse(readFileSync(new URL('./fixtures/devnet_replay.json', import.meta.url), 'utf8'));
const key = (f) => `${f.channelId}:${f.settledBlock}:${f.eventIndex}`;

/** fetch from the recording; `over` maps url (or url substring) to {status, body} or a function(row) edit. */
export function replayFetch(over = {}) {
  return async (url) => {
    const hit = Object.entries(over).find(([k]) => url === k || url.includes(k));
    const rec = hit ? (typeof hit[1] === 'function' ? hit[1](structuredClone(fx.http[url])) : hit[1]) : fx.http[url];
    if (!rec) throw new Error(`not in recording: ${url}`);
    return new Response(rec.body, { status: rec.status, headers: { 'content-type': 'application/json' } });
  };
}

export function replayChain({ edit = (x) => x, finalized, hashes = {} } = {}) {
  return async () => ({
    finalized: async () => structuredClone(finalized ?? fx.chain.finalized),
    hashAt: async (n) => hashes[n] ?? fx.chain.hashAt[n] ?? null,
    readFacts: async (f) => edit(structuredClone(fx.chain.facts[key(f)] ?? null), f),
    close: async () => {},
  });
}

export const rowsOf = (url) => JSON.parse(fx.http[url].body).data;
