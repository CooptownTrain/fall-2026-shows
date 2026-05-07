# 2026 Music and Comedy Shows

Auto-refreshing concert guide across 12 US + 14 EU cities.

**Live page:** https://cooptowntrain.github.io/fall-2026-shows/

## How it works

Every Sunday at 9 AM ET, GitHub Actions runs `scripts/refresh.js` which:

1. Pulls music events for selected artists (`data/selected-artists.json`)
   - Ticketmaster + SeatGeek for US cities (May - Dec 2026)
   - Ticketmaster + Songkick for EU cities (Apr 24-30 + Sep - Dec 2026)
2. Pulls every comedy event (no artist filter) from Ticketmaster across all US cities
3. Adds Sphere Las Vegas residencies (Metallica, Backstreet Boys)
4. Filters out past events, NYC borough restriction (Manhattan/Brooklyn/Queens only)
5. Builds `index.html` and commits the changes

## Manual trigger

Go to **Actions → Sunday Refresh → Run workflow** in GitHub.

## Secrets required

- `TM_KEY` — Ticketmaster Discovery API key
- `SG_KEY` — SeatGeek API client ID

## Adding/removing artists

Edit `data/selected-artists.json` and commit. Next refresh picks it up.
