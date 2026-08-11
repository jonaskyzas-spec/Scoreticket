import type { CompetitionConfig } from '../competitions';
import type { SourceEvent } from '../types';
import { absoluteUrl, decodeEntities, type TicketSource } from './base';
import { fetchText, parsePrice } from './http';

/**
 * SportsBreaks.
 *
 * Different in kind from the other five sources, in two ways that matter:
 *
 * 1. It's an OFFICIAL partner (it says "Official Match Breaks Supplier" for the
 *    clubs it works with), not a resale marketplace. Its inventory is legitimate
 *    club allocation.
 * 2. It sells **ticket + hotel packages**, not bare tickets. A £296 Liverpool
 *    package is not comparable to a £74 resale ticket, so every quote from here
 *    is flagged `isPackage` and is deliberately excluded from the "cheapest"
 *    ranking. Mixing the two would make the comparison actively misleading.
 *
 * It also states sold-out status explicitly, which is better evidence than our
 * usual inference from a missing price.
 *
 * Structure (a WordPress site with hand-written BEM classes, so far more stable
 * than content-hashed CSS modules):
 *
 *   .event-card
 *     .event-card__date   <span>29 Aug</span><span>Sat 12:30<br>2026</span>
 *     .event-card__title  <span>Liverpool FC v Nottingham Forest</span>
 *     .event-card__price  <span class="prefix">From </span><span>£296.00</span>
 *     .event-card__button--sold-out   (present only when sold out)
 *
 * Fixtures live on *club* pages, not league pages — league pages are marketing
 * copy. So we read the league page for its club links, then walk those.
 */

const ORIGIN = 'https://www.sportsbreaks.com';

/** Cap clubs per competition so one refresh can't fan out into dozens of requests. */
const MAX_CLUBS = 10;

function findCards(html: string): string[] {
  const marker = 'class="event-card ';
  const out: string[] = [];
  const starts: number[] = [];

  let i = html.indexOf(marker);
  while (i !== -1) {
    starts.push(i);
    i = html.indexOf(marker, i + marker.length);
  }

  for (let n = 0; n < starts.length; n++) {
    out.push(html.slice(starts[n], starts[n + 1] ?? starts[n] + 4000));
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Reassemble "29 Aug" + "Sat 12:30" + "2026" into an ISO timestamp. The three
 * parts live in two sibling spans separated by a <br>, hence the shape below.
 */
function parseCardDate(card: string): string | null {
  const block = card.match(
    /event-card__date"[^>]*>\s*<span>([^<]+)<\/span>\s*<span>([^<]*?)<br\s*\/?>\s*(\d{4})/i,
  );
  if (!block) return null;

  const dayMonth = block[1].trim().match(/(\d{1,2})\s+([A-Za-z]{3})/);
  const time = block[2].trim().match(/(\d{1,2}):(\d{2})/);
  const year = Number(block[3]);

  if (!dayMonth || !Number.isFinite(year)) return null;

  const month = MONTHS[dayMonth[2].toLowerCase()];
  if (month === undefined) return null;

  const d = new Date(
    Date.UTC(
      year,
      month,
      Number(dayMonth[1]),
      time ? Number(time[1]) : 12,
      time ? Number(time[2]) : 0,
    ),
  );

  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseCard(card: string): SourceEvent | null {
  const title = card
    .match(/event-card__title"[^>]*>\s*<span>([^<]+)<\/span>/i)?.[1]
    ?.trim();
  if (!title) return null;

  const soldOut = /event-card__button--sold-out|lister-button-sold-out/i.test(card);
  const priceText = card.match(/event-card__price"[\s\S]{0,220}?(£[\d.,]+)/i)?.[1] ?? null;

  const href =
    card.match(/<a[^>]+class="wp-block-button__link[^"]*"[^>]+href="([^"#]+)"/i)?.[1] ??
    card.match(/href="(https:\/\/www\.sportsbreaks\.com\/football\/[^"#]+)"/i)?.[1] ??
    null;

  return {
    sourceId: 'sportsbreaks',
    externalId: href ? href.split('/').filter(Boolean).pop() ?? null : null,
    title: decodeEntities(title),
    homeName: null, // the matcher splits "X v Y" from the title
    awayName: null,
    startDate: parseCardDate(card),
    venueName: null,
    city: null,
    url: href ? absoluteUrl(ORIGIN, href) : ORIGIN,
    imageUrl: null,
    fromPrice: parsePrice(priceText),
    highPrice: null,
    currency: priceText ? 'GBP' : null,
    inventory: null,
    isPackage: true,
    soldOut,
  };
}

/** Club pages linked from a competition's landing page. */
function clubUrls(html: string, leagueSlug: string): string[] {
  const re = new RegExp(
    `https://www\\.sportsbreaks\\.com/football/${leagueSlug}/([a-z0-9-]+)`,
    'gi',
  );
  const seen = new Set<string>();

  for (const m of html.matchAll(re)) {
    const slug = m[1];
    // Skip the ancillary pages that share the club URL space.
    if (/travel|coach|hospitality|hotel|guide|faq/i.test(slug)) continue;
    seen.add(`${ORIGIN}/football/${leagueSlug}/${slug}`);
  }

  return [...seen].slice(0, MAX_CLUBS);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const sportsbreaks: TicketSource = {
  id: 'sportsbreaks',
  name: 'SportsBreaks',
  homepage: ORIGIN,
  pricesOnListing: true,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const slug = comp.slugs.sportsbreaks;
    if (!slug) return [];

    const leagueHtml = await fetchText(`${ORIGIN}/football/${slug}`);
    const clubs = clubUrls(leagueHtml, slug);

    const out: SourceEvent[] = [];
    const seen = new Set<string>();

    for (const clubUrl of clubs) {
      try {
        const html = await fetchText(clubUrl);
        for (const card of findCards(html)) {
          const event = parseCard(card);
          if (!event) continue;

          // The same fixture appears on both clubs' pages.
          const key = `${event.title}|${event.startDate ?? ''}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          out.push(event);
        }
      } catch {
        // One club page failing shouldn't lose the rest of the competition.
      }

      await sleep(900);
    }

    return out;
  },
};
