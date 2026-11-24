# Changelog

## 0.1.0 (2026-11-24)

First release.

- `flop-spend has-spent <SS58>`: has this address spent on Flop inference yet? Sums `minerPaid + burned` over its finalized `computeChannel` settlements as agent, and re-reads the newest ones on chain with flop-receipt-root. Exit 0 yes, 1 no, 2 error or disagreement. `--json` for the full answer.
- `flop-spend status`: whether testnet is measurable yet, from the testnet explorer and justweight's testnet watcher stage.
- MCP server (`flop-spend mcp`) with `flop_has_spent` and `flop_spend_status`.
- Dashboard: spend per address over the last 86,400 blocks, with every settlement re-read on chain, plus `epoch.json` (Merkle root over the same settlements). It republishes the last good build marked stale, or shows an empty state with the reason, when a build can't read the network.
- Network auto-switch: testnet once it has settlements, devnet (labelled: no value, unscored) until then.
- Flop's docs quoted with URLs and dates. No airdrop estimates.
- Tests replay one real devnet recording; outage and disagreement cases are labelled synthetic edits.
