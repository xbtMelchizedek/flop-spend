# Fixtures

`devnet_replay.json` is one real recording of Flop devnet, made by `npm run record` (`scripts/record-fixtures.mjs`) against https://explorer.devnet.flop.network, https://rpc.devnet.flop.network, https://testnet.flopscan.io and justweight's published snapshot. It covers one `build` over 1,800 blocks and two `has-spent` calls: the top spender in that window and an address with no settlements as agent. It holds every HTTP response (status and body) and every chain read.

The justweight snapshot is trimmed to `generatedAt` and `flop.watch`, the only fields this tool reads. Nothing else is edited.

Tests that need other conditions (testnet up with 0 or 4 settlements, explorer 503, a lagging RPC node, a chain that disagrees, an explorer that ignores the agent filter) apply synthetic edits in the test itself and say so.
