# Changelog

## 0.1.1 (2026-11-26)

- Measures live FLOP Testnet. `flop-receipt-root` is now `v0.3.2`, which reads the testnet explorer finalized head from `/api/stats` and `/api/blocks/<n>` when `/api/health` is HTTP 404 (still the case on `testnet.flopscan.io`), and pins genesis plus the block hash on `https://testnet.flop.network`. `flop-spend status` and `has-spent --network auto` therefore switch to testnet once settlements exist, instead of staying on devnet because of the 404.
- Live check 8:49 AM ET 26 Nov 2026: 31 finalized `computeChannel.Settled` rows on `flop_testnet` (blocks 154678–169626) re-read on chain; Merkle root `0x5557f737…6400` through flop-receipt-root.

## 0.1.0 (2026-11-24)

First release.

- `flop-spend has-spent <SS58>`: has this address spent on Flop inference yet? Sums `minerPaid + burned` over its finalized `computeChannel` settlements as agent, and re-reads the newest ones on chain with flop-receipt-root. Exit 0 yes, 1 no, 2 error or disagreement. `--json` for the full answer.
- `flop-spend status`: whether testnet is measurable yet, from the testnet explorer and justweight's testnet watcher stage.
- MCP server (`flop-spend mcp`) with `flop_has_spent` and `flop_spend_status`.
- Dashboard: spend per address over the last 86,400 blocks, with every settlement re-read on chain, plus `epoch.json` (Merkle root over the same settlements). It republishes the last good build marked stale, or shows an empty state with the reason, when a build can't read the network.
- Network auto-switch: testnet once it has settlements, devnet (labelled: no value, unscored) until then.
- Flop's docs quoted with URLs and dates. No airdrop estimates.
- Tests replay one real devnet recording; outage and disagreement cases are labelled synthetic edits.
