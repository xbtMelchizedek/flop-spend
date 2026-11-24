// The chain as the second source, through flop-receipt-root's genesis-pinned RPC reader.
import { NETWORKS, connectRpc, readChainFacts, rpcFinalized, rpcHashAt } from 'flop-receipt-root';

// flop-receipt-root 0.3.0 has no testnet RPC. The testnet docs (network-testnet, 2026-11-24) give
// wss://testnet.flop.network/; the same host answers HTTPS JSON-RPC with the pinned testnet genesis
// (checked 2026-11-24 4:0x PM ET: chain_getBlockHash(0) = 0x918abd58…d800).
export const RPC = { devnet: NETWORKS.devnet.rpc, testnet: 'https://testnet.flop.network' };

export async function openChain(network, url = RPC[network]) {
  const api = await connectRpc(network, url);
  return {
    finalized: () => rpcFinalized(api),
    hashAt: (n) => rpcHashAt(api, n),
    readFacts: (f) => readChainFacts(api, f),
    close: () => api.disconnect(),
  };
}
