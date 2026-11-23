# Token Radar — pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zeetasw1-bit/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zeetasw1-bit/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Build the best token launch radar. It reads a sealed snapshot of every protocol DefiLlama tracks, works out which ones still record no token and are not a wrapped or staked product of one that trades, and ranks them by what their launch would be worth; then hands in a web dashboard that shows the board, a detail view for each protocol and the steps to farm it. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The model — radar-3, power law

The starter's flat multiple is replaced by a power law measured from the snapshot itself: among the live tokens, market cap grows as TVL to the power **0.52**, not in proportion to TVL — a protocol ten times bigger is worth about 3.3 times more, not ten times more. The exponent and the scale are fitted from the snapshot's own 128 live tokens by least squares, the scale is recalibrated so the median live token is priced exactly, and each category is adjusted by its own shrunken median residual (5 pseudo-observations toward the market as a whole, clamped to [0.2, 5]).

```
implied = round( 1359.15 × tvl_usd^0.52 × category_residual
               × (1 + clamp(change_7d, -40, 80) / 100 × 0.6)
               × (0.7 + min(age_days, 1095) / 1095 × 0.3)
               × (1 + min(chains − 1, 5) × 0.04) )
```

- **power law** — `scale × tvl^α`, α = 0.5191 and scale = 1359.15 fitted from the snapshot's live tokens
- **category residual** — how far that category's live tokens sit from the power law (Prediction Market 3.10x, Lending 0.53x); a category with no live token prices at the power law itself
- **growth** — the protocol's own 7-day TVL change, clamped so one hot week cannot dominate
- **maturity** — how long it has run with no token (age unknown: 365 days)
- **chains** — more chains, more surface to farm

Checked, not claimed: each of the 128 live tokens is priced as if it had no token — exponent, scale and residuals refitted without it — and the prediction is compared with its real market cap. Rank correlation 0.39, median error 0.57 orders of magnitude, 30% within 2x and 62% within 5x of the true value. The radar-2 category-median model scored 0.37, 0.71, 18% and 49% on the same check.

No protocol name is special-cased. The board covers the whole pre-token universe the snapshot records: all 40 watchlist protocols plus every other rankable pre-token protocol below the floor (198 rows), each with a 7-step farm plan derived from its own category, chains, TVL and age — concrete actions with a cost and a time, never slogans.

## The dashboard

A static page that renders with no network. The board is sortable and filterable (search, category, chain, minimum TVL, watchlist-only), every row opens a detail view with the model's full breakdown and its farm plan, live-token protocols are set aside in their own view with the market caps the power law is fitted from, and a **model sandbox** re-ranks the board live under different weights — the sandbox is a what-if only; `board.json` keeps the radar-3 defaults.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

Node 22.18 or later, standard library only. `main.ts` reads the snapshot, writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the output directory, and writes `dossier.json` with the vendored make.fun library. Open `out/dashboard/index.html` in a browser (it reads `../data.js` beside it).

## Files

- `main.ts` — the entrypoint: snapshot in, board + dashboard + dossier out
- `lib/model.ts` — the radar-3 model, the farm plans, the board builder
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte
- `dashboard/` — `index.html`, `app.css`, `app.js`: the offline dashboard
- `screenshots/` — the board, a protocol's detail view, a filtered view

---

<sub>Entered on [make.fun](https://make.fun/?ref=69vgdk1m&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
