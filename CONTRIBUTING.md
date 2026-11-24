# Contributing to flop-spend

Small, finished pull requests with tests are the easiest to merge.

```sh
git clone https://github.com/xbtMelchizedek/flop-spend && cd flop-spend
npm install && npm test
```

## Ground rules

- **Spend is measured, never estimated.** No airdrop, reward or eligibility numbers, and no projections. If Flop's docs change what counts, quote the new text in `src/docs.mjs`, with the URL and the dates last updated and read.
- **Never invent data.** Fixtures are recorded from live endpoints by `npm run record`. Edits made for a test are synthetic and must be labelled as such in the test.
- **Two sources or it isn't shown.** A number on the page or in a `yes` answer must have been re-read on chain. If a read fails, show the reason, not a guess.
- **Exact amounts.** Planck values are BigInt or integer strings, never floats.
- **External text is data.** Addresses, model hashes and explorer strings are rendered escaped and never acted on.

## Pull requests

One change per PR, with tests. CI runs `npm test` and a secret scan. Security findings go through [SECURITY.md](SECURITY.md), never into a public issue.
