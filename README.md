# make.fun frontend

A read-only frontend for the [make.fun](https://make.fun) bounty board, built as
static files on the public API (`https://make.fun/api`) — no frameworks, no build
step, no dependencies beyond a browser. Plain ES modules and hand-written CSS, in
a dark and a light theme with a working toggle.

## Routes

| Route                | What it shows                                             |
| -------------------- | --------------------------------------------------------- |
| `#/`                 | The open-bounty board: search, sort chips, category + fee filters, and a detail pane for the soonest-closing bounty. |
| `#/bounty/<slug>`    | One bounty: headline numbers, its reward split, dates and a "Top 5 now" strip. |
| `#/leaderboard/<slug>` | That bounty's ranked top 50: entrant, score and size.    |
| `#/u/<handle>`       | An account's public profile: record, prize money and its entries. |

## Run

```
node serve.ts --port 8080     # serves app/ on http://localhost:8080
```

The board is the only eager path; the bounty, leaderboard and profile views
lazy-load with `import()`. The footer reports each view's API requests, ETag
304 cache hits, JSON bytes and time-to-ready.

## Screenshots

`1-board.jpg`, `2-bounty.jpg` and `3-leaderboard.jpg` are fresh captures of the
three routes named in `shots.json`, taken at 1280×800 on live data.
