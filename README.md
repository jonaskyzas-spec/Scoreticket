# Scoreticket

Football fixtures, kickoff times, venues and **ticket prices compared across five resale
marketplaces** — SeatPick, StubHub, viagogo, Football Ticket Net and Live Football Tickets.

Covers: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League,
Conference League, EFL Cup and Copa Libertadores.

---

## Quick start

**It works with no API key and no configuration.** If football-data.org isn't set up, the
calendar is built from the ticket sites' own listings instead (see
[No-key mode](#no-key-mode-what-you-get-for-free) below).

```bash
npm install
```

```bash
npm run refresh && npm run dev
```

Open <http://localhost:3000>.

### Getting the full calendar

For complete fixtures — including games nobody is reselling, plus club crests — add a free
football-data.org key:

```bash
cp .env.example .env.local
```

Register at <https://www.football-data.org/client/register> (free, no card), paste the key into
`.env.local` as `FOOTBALL_DATA_API_KEY`, then re-run `npm run refresh`. The app switches over
automatically.

### Useful commands

```bash
npm run probe
```

Tests the scrapers against the live sites and prints what each returned. No API key needed — run
this first whenever something looks wrong.

```bash
npm run verify
```

Runs the parsers against captured real markup. Catches parsing regressions even when a site is
blocking you.

---

## No-key mode: what you get for free

With zero configuration the app scrapes the ticket sites, and builds the calendar from the fixtures
they're selling. Measured on a real run:

- **59 fixtures** across Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and Champions League
- **54 of them with a live price**
- **43 matched across two or more sites**, so the price comparison is real

What you give up versus the fixtures API: only games actually being resold appear, there are no club
crests (initials are shown instead), and kickoff times are as the ticket site states them rather
than authoritative. The homepage says so in a banner, so the provenance is never ambiguous.

---

## How it works

```
football-data.org ──► fixtures (dates, venues, crests)
                              │
                              ├──► matching.ts ──► board ──► UI
                              │
5 ticket sites ─────► events (prices, deep links)
```

Fixtures and prices are fetched independently, then joined by fuzzy team-name matching
(`src/lib/sources/matching.ts`). Everything is cached to `.cache/` so page loads never trigger a
scrape.

### The five sources

Each adapter is ~100 lines behind one interface (`TicketSource.listEvents`), so a site changing its
markup means editing one file. Status below is what was actually measured, not what was hoped for.

| Source | Status | How we read it | Gives us |
|---|---|---|---|
| **Football Ticket Net** | ✅ **works, best source** | JSON-LD `ItemList` of `Event` (+ `aria-label` anchors for the rest of the page) | kickoff, venue, city, teams, from-price — 135 events/run |
| **Live Football Tickets** | ✅ works | `/{locale}/fixtures/{home}-v(s)-{away}-tickets-{competition}.html` | fixtures + deep links, no prices — 67 events/run |
| **SeatPick** | ⚠️ rate-limited | JSON-LD `@graph` + `AggregateOffer` | low+high price, currency, inventory, venue, geo — richest data *when reachable* |
| **viagogo** | ⚠️ mostly blocked | JSON-LD `SportsEvent` on category pages | a handful of deep links, never prices |
| **StubHub** | ❌ off by default | internal `/explore` JSON API | unusable server-side — see below |

**SeatPick** parses perfectly in a browser and passes `npm run verify`, but returns `429` to
server-side requests from an IP that has been fetching it. It may clear on its own; the circuit
breaker retries automatically. If it stays blocked, their affiliate feed is the fix.

**viagogo** serves category pages to a real browser but `403`s server-side — it fingerprints the
TLS/HTTP2 client, which headers cannot defeat. It blocks, gets parked, and costs one request per
cooldown. It never exposes prices on listing pages anyway.

**StubHub** is disabled in `.env.example`. Its `/explore` endpoint is *local discovery*, not search:
`q` is ignored entirely, `lat`/`lon` are ignored, and results are geolocated from the requesting
server's IP — so from one host it only ever returns events near that host. Real coverage needs their
partner API. (`sortBy=DATE` is what makes prices appear, if you're experimenting.)

### When a site blocks you

It will happen. `src/lib/sources/circuit-breaker.ts` handles it:

1. A `403`/`429`/`503` is recorded as a block; ordinary errors need 3 strikes.
2. The source is parked for `SCRAPER_COOLDOWN_MINUTES` (default 45) and skipped.
3. The next refresh after the cooldown retries it automatically.
4. The site keeps rendering from whatever the other sources returned, and `/status` shows exactly
   what's down and why.

Requests are spaced by `SCRAPER_DELAY_MS` (default 2.5s) per source, use browser-shaped headers, and
retry transient failures with backoff.

---

## Important limitations

**Read these before you rely on the numbers.**

### football-data.org free tier covers 6 of your 10 competitions

Free: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League.

Needs a paid plan (Standard, €49/mo, 25 competitions): **Europa League, Conference League, EFL Cup,
Copa Libertadores**. They're configured and gated — set `FOOTBALL_DATA_PAID_TIER=true` once you
upgrade and they light up with no code change. Until then `/status` reports them as gated rather
than silently showing empty pages.

Free tier is also capped at **10 requests/minute**, which is why `fixtures/index.ts` spaces
competition requests 6.5s apart.

### Prices are indicative, not authoritative

- They're "from" prices — the cheapest listing advertised, usually **excluding booking fees and
  delivery**, which on resale sites can add 15–30%.
- Each site quotes in whatever currency its geo-detection picks. The UI shows each quote in its
  **own** currency; the static rates in `src/lib/fx.ts` are used only to rank quotes, never to
  display a converted number.
- viagogo geo-redirects hard: the same URL returns different prices and currency depending on the
  server's IP. Prices scraped from a European host won't match what a US visitor sees.

### Legal note

viagogo and StubHub both prohibit automated collection in their terms of service, and all five sites
may block, rate-limit or serve altered data at any time. You asked to scrape and retry on blocks, and
that's what this builds — but for a public commercial site, the affiliate programs (SeatPick,
Football Ticket Net and Live Football Tickets all run one; StubHub has a partner API) give you the
same data contractually, and the adapter interface here is exactly the seam to swap them in behind.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `FOOTBALL_DATA_API_KEY` | — | Required for fixtures |
| `FOOTBALL_DATA_PAID_TIER` | `false` | Unlocks EL / ECL / EFL Cup / Libertadores |
| `SCORETICKET_CURRENCY` | `EUR` | Fallback currency when a site doesn't say |
| `SCRAPER_DELAY_MS` | `2500` | Gap between requests to the same source |
| `SCRAPER_COOLDOWN_MINUTES` | `45` | How long a blocked source is parked |
| `SCRAPER_DISABLED_SOURCES` | — | e.g. `viagogo,stubhub` to switch sources off |
| `NEXT_PUBLIC_DEMO_BOOKING_URL` | Calendly link | Overrides the /demo booking link |
| `CRON_SECRET` | — | Bearer token for `POST /api/cron/refresh` |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run refresh` | Fixtures + all scrapers → `.cache/` |
| `npm run refresh:fixtures` | Calendar only, no scraping |
| `npm run probe [source] [competition]` | Test one scraper, print what it found |
| `npm run verify` | Run parsers against captured markup (works offline) |
| `npm run typecheck` | TypeScript, no emit |

## Node.js

Node wasn't installed on this machine, so Node 22 LTS (arm64, checksum-verified from nodejs.org)
was extracted to `~/.local/node` and added to `PATH` in `~/.zshrc`. Nothing outside your home
directory was touched. To remove it: `rm -rf ~/.local/node` and delete the `PATH` line from
`~/.zshrc`.

## Routes

| Route | Purpose |
|---|---|
| `/` | Hero + fixture calendar grouped by day, competition filter |
| `/match/[id]` | One fixture: stadium photo, details + cross-source price table |
| `/demo` | Book a demo — partnership pitch and Calendly booking |
| `/contact` | Contact form and email address |
| `/status` | Diagnostics — per-source health, coverage notes. **Unlinked**: not in the nav or footer, visit the URL directly |
| `GET /api/matches` | JSON feed (`?competition=`, `?limit=`) |
| `POST /api/cron/refresh` | Full refresh; requires `Authorization: Bearer $CRON_SECRET` |

---

## Design

Dark-first "tactical display" theme — neon accents, glass panels, a faint pitch grid. All of it
lives in [`src/app/globals.css`](src/app/globals.css) (colour tokens and effects) and the components
in `src/components/`, entirely separate from the data layer, so the look can be reworked without
touching any scraping logic. A light mode is included for accessibility, and every animation is
disabled under `prefers-reduced-motion`.

### The hero animation

The hero background is an animated SVG tactics board — pass lines drawing between players, the ball
travelling the network, a radar sweep ([`PitchAnimation.tsx`](src/components/PitchAnimation.tsx)).
A few KB, server-rendered, no external asset.

**To use a real video instead:** drop any clip at `public/hero.mp4`. It's picked up automatically —
no code or config change. The file's presence is checked at render time, so a missing file can never
produce a broken element.

Note on why a stock clip isn't bundled: match footage is aggressively rights-managed by the leagues,
and an unlicensed clip on a public commercial site is a genuine legal risk. If you want real
footage, use something you've licensed (or shot yourself).

### Book a demo

A bouncing **⚡ Book a demo** pill sits in the header next to Fixtures and Contact us, in the same
mint (`#34f5c5`) used for prices — so it's reachable from every page, not just the homepage. It
leads to [`/demo`](src/app/demo/page.tsx): the partnership pitch, a 30-minute agenda, and a Google
Calendar booking button.

The bounce pauses on hover so the button holds still while it's being clicked, and stops entirely
under `prefers-reduced-motion`. On narrow screens the label shortens to "Demo" so the nav doesn't
wrap.

**The booking link.** The "Let's talk" button goes to
<https://calendly.com/jonaskyzas/30min>, where visitors pick a slot from real availability. Override
it without touching code by setting `NEXT_PUBLIC_DEMO_BOOKING_URL` in `.env.local`.

### Club badges (logo vs logo)

Match cards are a badge-vs-badge face-off. Badges come from football-data.org when an API key is
configured, and otherwise from TheSportsDB via [`team-logos.ts`](src/lib/team-logos.ts) — free, no
key, works from the club name alone. Currently **50 of 59 fixtures (85%)** show both badges; every
club without one falls back to its initials, so a card is never visibly broken.

Two things this module guards against, both learned the hard way:

- **Wrong badges.** The search is fuzzy and cross-sport, so asking for "Aarhus" happily returns
  *Aarhus Fremad* — a different club. Substring matching is therefore not enough; candidates are
  ranked by full-name similarity and rejected below a confidence threshold. Showing initials beats
  showing another club's crest.
- **Silent throttling.** TheSportsDB's keyless tier rate-limits hard, and a throttled response is
  indistinguishable from "no such club" — at a 250ms gap this quietly cost ~40% of coverage.
  Requests are spaced 900ms apart, and misses are retried on later runs, so coverage climbs across
  refreshes (63% → 88% → 90% over three passes on a cold cache).

Stadium photography from Wikimedia is still implemented in
[`venue-photos.ts`](src/lib/venue-photos.ts) and is no longer wired into the board. Re-enable it in
`board.ts` if you ever want photos back.

## Deploying

`vercel.json` runs the refresh every 2 hours. Set all env vars including `CRON_SECRET` in the Vercel
dashboard.

One caveat: `.cache/` is a local filesystem store, and serverless filesystems are ephemeral. For
production, swap `readJson`/`writeJson` in `src/lib/cache.ts` for Vercel KV, Redis or Postgres —
that file is the only thing that needs to change.
