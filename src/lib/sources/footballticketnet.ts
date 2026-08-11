import type { CompetitionConfig } from '../competitions';
import type { SourceEvent } from '../types';
import { absoluteUrl, decodeEntities, type TicketSource } from './base';
import { extractJsonLd, fetchText, parseCurrency, parsePrice } from './http';

/**
 * Football Ticket Net.
 *
 * Two extraction paths, merged — they cover different parts of the page:
 *
 * 1. JSON-LD. The page embeds an `ItemList` of `Event` objects carrying
 *    startDate, venue, city, teams and an AggregateOffer with lowPrice. This is
 *    the good stuff, and it's the only listing on any of the five sites that
 *    gives us kickoff times *and* prices together — which is what lets the app
 *    render a calendar with no fixtures API configured at all.
 *    It covers ~10 fixtures.
 *
 * 2. Accessible markup. The rest of the page (~25 fixtures) only appears in
 *    anchors like:
 *      <a href="/premier-league/arsenal-vs-coventry-city-...-tickets/event/126926"
 *         aria-label="Buy tickets for Arsenal vs Coventry City, From €214.78">
 *    which gives fixture + price but no date.
 *
 * The CSS-module class names are content-hashed
 * (`UpcomingMatchesSection-module__NKlfKa__priceCta`) and change on every
 * deploy, so they are deliberately never used as selectors.
 */

const ORIGIN = 'https://www.footballticketnet.com';

const LINK_RE =
  /<a\s+[^>]*href="([^"]+\/event\/\d+)"[^>]*aria-label="Buy tickets for ([^"]+)"[^>]*>/gi;

interface LdEvent {
  '@type'?: string;
  name?: string;
  url?: string;
  startDate?: string;
  location?: {
    name?: string;
    address?: { addressLocality?: string; addressCountry?: string };
  };
  performer?: { '@type'?: string; name?: string }[];
  offers?: { lowPrice?: number; highPrice?: number; priceCurrency?: string; url?: string };
}

/** Walk ItemList / @graph / bare arrays and pull out every Event. */
function collectLdEvents(blocks: unknown[]): LdEvent[] {
  const out: LdEvent[] = [];

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    if (Array.isArray(obj['@graph'])) return visit(obj['@graph']);
    if (Array.isArray(obj.itemListElement)) return visit(obj.itemListElement);
    if (obj.item) return visit(obj.item);

    const type = obj['@type'];
    if (type === 'Event' || type === 'SportsEvent') out.push(obj as LdEvent);
  };

  blocks.forEach(visit);
  return out;
}

function eventId(url: string | undefined): string | null {
  return url?.match(/\/event\/(\d+)/)?.[1] ?? null;
}

/** "Arsenal vs Coventry City, From €214.78" → fixture + price. */
function parseAriaLabel(label: string): { fixture: string; price: string | null } {
  const idx = label.lastIndexOf(', From ');
  if (idx === -1) return { fixture: label.trim(), price: null };
  return {
    fixture: label.slice(0, idx).trim(),
    price: label.slice(idx + ', From '.length).trim(),
  };
}

export const footballticketnet: TicketSource = {
  id: 'footballticketnet',
  name: 'Football Ticket Net',
  homepage: ORIGIN,
  pricesOnListing: true,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const slug = comp.slugs.footballticketnet;
    if (!slug) return [];

    const html = await fetchText(`${ORIGIN}/${slug}`);

    const byId = new Map<string, SourceEvent>();

    // --- Pass 1: JSON-LD (rich: dates, venues, teams, prices) ---
    for (const ev of collectLdEvents(extractJsonLd(html))) {
      if (!ev.name || !ev.url) continue;
      const id = eventId(ev.url) ?? ev.url;
      const teams = (ev.performer ?? []).filter((p) => p['@type'] === 'SportsTeam');

      byId.set(id, {
        sourceId: 'footballticketnet',
        externalId: eventId(ev.url),
        title: decodeEntities(ev.name),
        homeName: teams[0]?.name ? decodeEntities(teams[0].name) : null,
        awayName: teams[1]?.name ? decodeEntities(teams[1].name) : null,
        startDate: ev.startDate ?? null,
        venueName: ev.location?.name ?? null,
        city: ev.location?.address?.addressLocality ?? null,
        url: ev.url,
        imageUrl: null,
        fromPrice: ev.offers?.lowPrice ?? null,
        highPrice: ev.offers?.highPrice ?? null,
        currency: ev.offers?.priceCurrency ?? null,
        inventory: null,
      });
    }

    // --- Pass 2: aria-label anchors (wider coverage, price but no date) ---
    let m: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;

    while ((m = LINK_RE.exec(html)) !== null) {
      const href = m[1];
      const id = eventId(href) ?? href;
      if (byId.has(id)) continue; // JSON-LD entry is strictly richer

      const { fixture, price } = parseAriaLabel(decodeEntities(m[2]));

      byId.set(id, {
        sourceId: 'footballticketnet',
        externalId: eventId(href),
        title: fixture,
        homeName: null, // matcher splits the title
        awayName: null,
        startDate: null,
        venueName: null,
        city: null,
        url: absoluteUrl(ORIGIN, href),
        imageUrl: null,
        fromPrice: parsePrice(price),
        highPrice: null,
        currency: parseCurrency(price),
        inventory: null,
      });
    }

    return [...byId.values()];
  },
};
