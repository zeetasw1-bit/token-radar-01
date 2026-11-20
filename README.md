# Token Radar — pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zeetasw1-bit/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zeetasw1-bit/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Build the best token launch radar. It reads a sealed snapshot of every protocol DefiLlama tracks, works out which ones still record no token and are not a wrapped or staked product of one that trades, and ranks them by what their launch would be worth; then hands in a web dashboard that shows the board, a detail view for each protocol and the steps to farm it. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The model — radar-2, category benchmarks

The starter's flat multiple is replaced by a multiple measured from the snapshot itself: for each category, the **median market-cap-per-TVL of that category's tokens that already trade**. A lending protocol is priced like lending protocols trade, a DEX like DEXes trade; a category with fewer than 3 live tokens falls back to the whole market's median (0.2138x on this snapshot).

```
implied = round( tvl_usd × multiple
               × (1 + clamp(change_7d, -40, 80) / 100 × 0.6)
               × (0.7 + min(age_days, 1095) / 1095 × 0.3)
               × (1 + min(chains − 1, 5) × 0.04) )
```

- **multiple** — the category benchmark above, clamped to [0.05, 1.00]
- **growth** — the protocol's own 7-day TVL change, clamped so one hot week cannot dominate
- **maturity** — how long it has run with no token (age unknown: 365 days)
- **chains** — more chains, more surface to farm

No protocol name is special-cased. The board covers the whole pre-token universe the snapshot records: all 40 watchlist protocols plus every other rankable pre-token protocol below the floor (289 rows), each with a 7-step farm plan derived from its own category, chains, TVL and age — concrete actions with a cost and a time, never slogans.

## The dashboard

A static page that renders with no network. The board is sortable and filterable (search, category, chain, minimum TVL, watchlist-only), every row opens a detail view with the model's full breakdown and its farm plan, live-token protocols are set aside in their own view with the market caps the benchmarks are priced from, and a **model sandbox** re-ranks the board live under different weights — the sandbox is a what-if only; `board.json` keeps the radar-2 defaults.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

Node 22.18 or later, standard library only. `main.ts` reads the snapshot, writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the output directory, and writes `dossier.json` with the vendored make.fun library. Open `out/dashboard/index.html` in a browser (it reads `../data.js` beside it).

## Files

- `main.ts` — the entrypoint: snapshot in, board + dashboard + dossier out
- `lib/model.ts` — the radar-2 model, the farm plans, the board builder
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte
- `dashboard/` — `index.html`, `app.css`, `app.js`: the offline dashboard
- `screenshots/` — the board, a protocol's detail view, a filtered view

---

<sub>Entered on [make.fun](https://make.fun/?ref=69vgdk1m&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
