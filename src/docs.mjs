// What Flop's own docs say, quoted and dated. The tracker measures settled inference spend and nothing else:
// no airdrop estimates, no scores, no claims beyond these lines.
export const MEASURED = 'Settled inference spend: for every finalized computeChannel settlement where the address is the agent, minerPaid + burned (the part of the escrow that was actually charged). Re-read from the chain over JSON-RPC before it is shown.';

export const DOCS = [
  {
    url: 'https://docs.flop.network/docs/airdrop-and-testnet-conversion',
    page: 'The airdrop and testnet conversion',
    updated: '2026-11-18',
    read: '2026-11-24',
    quotes: [
      'Both distributions are earned by usage, not by holding.',
      'Locked agent airdrop can be spent only on compute: opening or topping up inference sessions.',
    ],
  },
  {
    url: 'https://docs.flop.network/docs/network-testnet',
    page: 'Testnet opening FAQ',
    updated: '2026-11-24',
    read: '2026-11-24',
    quotes: [
      'This early network is unscored. Test FLOP has no monetary value.',
      'Earning begins at the publicly announced finalized activation block of a future tested runtime upgrade. There is no announced block or date yet. Earlier activity earns zero, with no backfill.',
    ],
  },
];
