# flop-spend

Has this address spent on Flop inference yet? flop-spend reads an address's compute settlements from the Flop explorer, re-reads them on chain, and reports the settled inference spend. It works as a CLI, an MCP tool and a dashboard.

**Live:** https://xbtmelchizedek.github.io/flop-spend/ · [spend.json](https://xbtmelchizedek.github.io/flop-spend/data/spend.json) · [epoch.json](https://xbtmelchizedek.github.io/flop-spend/data/epoch.json)

## Quickstart

```sh
npx -y github:xbtMelchizedek/flop-spend has-spent 5GsXb3TmNGixuEsbtixqHnqWr9UQJ2M8bkqBQWteNekgF98S
```

Real output, 2026-11-24 about 4:13 PM ET:

```
Answered on devnet: testnet explorer (https://testnet.flopscan.io): /api/health HTTP 404. Devnet FLOP has no value and devnet is not scored.
YES: 5GsXb3TmNGixuEsbtixqHnqWr9UQJ2M8bkqBQWteNekgF98S spent 517.82456187107393482 FLOP on devnet across the newest 1000 of 9973 settlements (pass --max-rows for more).
Newest: block 4558960 at 2026-11-24T21:09:05.000Z, 0.007645325000000003 FLOP.
Chain agrees on the newest 3 (RPC finalized 4559218).
Measured: minerPaid + burned per settlement. No airdrop estimate: see https://docs.flop.network/docs/airdrop-and-testnet-conversion
```

Node 22 or later. Exit codes: **0** yes, and the newest settlements were re-read on chain and agree. **1** no finalized, charged settlement as agent. **2** bad input, the explorer is down, or the chain disagrees. Add `--json` for the full answer.

## What is measured

**Spend** is, for every finalized `computeChannel` settlement where the address is the *agent*, `minerPaid + burned`: the part of the escrow that was actually charged. Unused escrow is refunded, so it is not spend. On real devnet data `escrow = minerPaid + burned + unusedEscrow` holds for every row, and that's in the tests. Amounts are 18-decimal planck shown as FLOP, using the chain's own `system_properties`.

**What is not measured:** airdrop amounts, eligibility or rewards. flop-spend makes no estimates. Flop's own docs say:

> "Both distributions are earned by usage, not by holding." "Locked agent airdrop can be spent only on compute: opening or topping up inference sessions."
> — [The airdrop and testnet conversion](https://docs.flop.network/docs/airdrop-and-testnet-conversion), last updated 2026-11-18. The page is marked as a draft.

> "This early network is unscored. Test FLOP has no monetary value." "Earning begins at the publicly announced finalized activation block of a future tested runtime upgrade. There is no announced block or date yet. Earlier activity earns zero, with no backfill."
> — [Testnet opening FAQ](https://docs.flop.network/docs/network-testnet), last updated 2026-11-24.

Read those pages yourself. They change, and this tool only quotes them.

## Testnet and devnet

Testnet is used **as soon as it has settlements**. Until then, every answer and the dashboard say they are on devnet, and why. `testnet.flopscan.io/api/health` is still HTTP 404, but from 0.1.1 (via [flop-receipt-root v0.3.2](https://github.com/xbtMelchizedek/flop-receipt-root/releases/tag/v0.3.2)) the finalized head is read from `/api/stats` and `/api/blocks/<n>` and checked against the official Testnet RPC genesis pin. `flop-spend status` shows:

- the testnet explorer's finalized head and settlement count, read directly; and
- the stage of [justweight](https://github.com/xbtMelchizedek/justweight)'s testnet watcher, from its published snapshot, as a second signal.

When the explorer is down, `has-spent` exits 2 with the explorer's own error. The dashboard republishes its last good build marked stale, or shows an empty state with the reason. It never shows numbers it couldn't check.

## How the check works

1. **Explorer.** `/api/settlement-prices?agent=<address>`, newest first. The `agent` filter is undocumented, so every returned row must name the address, or the answer is an error.
2. **Finality.** Only rows at or below the explorer's finalized head count.
3. **Chain.** The newest few are re-read over JSON-RPC with [flop-receipt-root](https://github.com/xbtMelchizedek/flop-receipt-root), with the genesis hash pinned: the block hash, the `Settled` event (minerPaid, burned, aggregate G_n) and the channel (agent, miner, model, escrow). Any difference is reported field by field.

The dashboard does the same for **every** settlement in its window: the last 86,400 blocks, about 24 hours on devnet. The first live build re-read 1,164 settlements from 94 addresses on chain in under 6 minutes. Its window ends at whichever finalized head is older, the explorer's or the RPC node's. It also publishes `epoch.json`, a Merkle root over those settlements, so any one receipt can be checked with `npx github:xbtMelchizedek/flop-receipt-root verify`.

## Agents

```sh
flop-spend has-spent <SS58> [--network auto|devnet|testnet] [--check 3] [--max-rows 1000] [--json]
flop-spend status
flop-spend mcp
flop-spend build [--out _site] [--last-blocks 86400]
```

As an MCP server it provides `flop_has_spent` (address, network, check) and `flop_spend_status`:

```json
{ "mcpServers": { "flop-spend": { "command": "npx", "args": ["-y", "github:xbtMelchizedek/flop-spend", "mcp"] } } }
```

As a library:

```js
import { hasSpent, networkStatus } from 'flop-spend';
const r = await hasSpent('5Gs…', { network: 'auto', check: 3 });
if (r.spent && r.verified) console.log(r.spentFlop, 'FLOP on', r.network);
```

## Limits

- `has-spent` reads up to `--max-rows` (default 1000) of an address's settlements. If it has more, the total is labelled as covering only the newest ones, and the explorer's full count is shown next to it.
- The dashboard covers a recent window, not all history. Use `has-spent` for one address's full history.
- The testnet RPC (`https://testnet.flop.network`) answers with the pinned testnet genesis. The testnet explorer's settlement API is not up yet, so the testnet path has only been tested against synthetic responses. The first real testnet build will show whether its shape matches devnet's.
- Two sources run by the same project can be wrong together. The chain check catches an explorer that misreports. It can't catch a chain that settled something it shouldn't have.

## Part of the agent inference kit

flop-spend is one of a set of small tools for agents that pay for inference. Each does one job, and they work together. The full list is sorted by job, with a one-line command and a live number for each: **https://xbtmelchizedek.github.io/agent-inference-kit/**. Its source is [kit.json](https://github.com/xbtMelchizedek/agent-inference-kit/blob/main/kit.json), so adding a tool takes one change there.

## Develop

```sh
git clone https://github.com/xbtMelchizedek/flop-spend && cd flop-spend
npm install && npm test
npm run build      # live: build _site/ from the network
npm run record     # re-record test/fixtures/devnet_replay.json from live devnet
```

The tests replay one real devnet recording: every explorer response and chain read from a build and two `has-spent` calls. Testnet outages, disagreements and filter failures are labelled synthetic edits on top of it (see `test/fixtures/README.md`). One dependency: flop-receipt-root. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

MIT. The page uses Arc UI foundation tokens (MIT, see `web/arc/LICENSE`).
