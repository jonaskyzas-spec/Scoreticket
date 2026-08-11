import type { CompetitionConfig } from '../competitions';
import type { SourceEvent } from '../types';
import { absoluteUrl, type TicketSource } from './base';
import { fetchText, parseCurrency, parsePrice } from './http';

/**
 * LiveFootballTickets.
 *
 * Server-rendered HTML with a locale prefix on every path (`/us/...`).
 * Competition pages live at `/{locale}/{competition}-tickets.html` and link to
 * fixtures as:
 *
 *   /us/fixtures/arsenal-vs-coventry-city-tickets-english-premier-league.html
 *   /us/fixtures/hull-city-v-manchester-united-tickets-english-premier-league.html
 *
 * Note both `-v-` and `-vs-` separators appear, seemingly at random per
 * fixture — matching only one silently drops most of the page.
 *
 * Anchors wrap nested SVG icons, so we scan for hrefs directly rather than
 * trying to match balanced <a>…</a> pairs, then look for a price in the markup
 * immediately following the link. Competition pages mostly don't carry prices
 * (those live on the fixture page), hence `pricesOnListing: false`.
 */

const ORIGIN = 'https://www.livefootballtickets.com';
const LOCALE = 'us';

const HREF_RE = /href="(\/[a-z]{2}\/fixtures\/([^"]+?)\.html)"/gi;

/**
 * Every competition page also renders a global nav dropdown linking to fixtures
 * from *other* competitions — so a naive href scrape returns Inter Miami games
 * on the La Liga page. The competition is encoded in the slug suffix
 * (`...-tickets-spanish-la-liga`), and the page is always dominated by its own
 * competition, so we keep only the most frequent suffix. That self-tunes for
 * all ten competitions instead of hardcoding a suffix table that would rot.
 */
function dominantSuffix(slugs: string[]): string | null {
  const counts = new Map<string, number>();

  for (const slug of slugs) {
    const suffix = slug.match(/-tickets-(.+)$/)?.[1];
    if (!suffix) continue;
    counts.set(suffix, (counts.get(suffix) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [suffix, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = suffix;
    }
  }

  // With no clear winner the page probably isn't a fixture listing at all;
  // returning null keeps every fixture and lets the matcher sort it out.
  return bestCount >= 2 ? best : null;
}

/** Accept both `a-vs-b` and `a-v-b`; trailing `-tickets-<competition>` is dropped. */
function parseFixtureSlug(slug: string): { home: string; away: string } | null {
  const m = slug.match(/^(.+?)-vs?-(.+?)-tickets(?:-.*)?$/);
  if (!m) return null;

  const deslug = (s: string) =>
    s
      .split('-')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ')
      .trim();

  const home = deslug(m[1]);
  const away = deslug(m[2]);
  if (!home || !away) return null;
  return { home, away };
}

export const livefootballtickets: TicketSource = {
  id: 'livefootballtickets',
  name: 'Live Football Tickets',
  homepage: ORIGIN,
  pricesOnListing: false,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const slug = comp.slugs.livefootballtickets;
    if (!slug) return [];

    const html = await fetchText(`${ORIGIN}/${LOCALE}/${slug}`);

    // First pass: collect every fixture link so we can work out which
    // competition this page is actually about.
    const found: { href: string; slug: string; index: number }[] = [];
    const seen = new Set<string>();

    let m: RegExpExecArray | null;
    HREF_RE.lastIndex = 0;

    while ((m = HREF_RE.exec(html)) !== null) {
      if (seen.has(m[2])) continue;
      seen.add(m[2]);
      found.push({ href: m[1], slug: m[2], index: m.index });
    }

    const wanted = dominantSuffix(found.map((f) => f.slug));
    const out: SourceEvent[] = [];

    for (const { href, slug: fixtureSlug, index } of found) {
      if (wanted && fixtureSlug.match(/-tickets-(.+)$/)?.[1] !== wanted) continue;

      const teams = parseFixtureSlug(fixtureSlug);
      if (!teams) continue;

      // Prices, when present, sit shortly after the link in the same card.
      const window = html.slice(index, index + 600);
      const priceText = window.match(/[€£$]\s?\d[\d,.]*/)?.[0] ?? null;

      out.push({
        sourceId: 'livefootballtickets',
        externalId: fixtureSlug,
        title: `${teams.home} vs ${teams.away}`,
        homeName: teams.home,
        awayName: teams.away,
        startDate: null,
        venueName: null,
        city: null,
        url: absoluteUrl(ORIGIN, href),
        imageUrl: null,
        fromPrice: parsePrice(priceText),
        highPrice: null,
        currency: priceText ? parseCurrency(priceText) : null,
        inventory: null,
      });
    }

    return out;
  },
};
