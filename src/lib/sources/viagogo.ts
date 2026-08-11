import type { CompetitionConfig } from '../competitions';
import type { SourceEvent } from '../types';
import { decodeEntities, type TicketSource } from './base';
import { extractJsonLd, fetchText } from './http';

/**
 * viagogo.
 *
 * Category pages embed a JSON-LD array of SportsEvent objects (name, startDate,
 * url, location) — but deliberately no price: viagogo only reveals numbers on
 * the individual event page, behind its heaviest bot protection. So this
 * adapter contributes fixtures and deep links, not prices, and
 * `pricesOnListing: false` tells the UI to render a "check price" link instead
 * of a number.
 *
 * Also note viagogo geo-redirects: the same URL served from a German IP returns
 * EUR and a Frankfurt-localised page. Prices are therefore not comparable
 * across hosts without pinning a locale.
 *
 * MEASURED BEHAVIOUR: viagogo serves category pages happily to a real browser
 * but returns 403 to server-side fetches — it fingerprints the TLS/HTTP2
 * client, which headers alone cannot defeat. In practice this adapter blocks
 * on the first request of every cycle, the circuit breaker parks it, and the
 * site renders from the other sources. That is the designed-for outcome, not a
 * bug; leaving it enabled costs one request per cooldown window.
 *
 * If viagogo coverage matters, the options are a headless browser with a real
 * TLS fingerprint (heavier, and squarely against their ToS) or their
 * affiliate feed.
 */

const ORIGIN = 'https://www.viagogo.com';

interface LdEvent {
  '@type'?: string;
  name?: string;
  url?: string;
  startDate?: string;
  location?: { name?: string; address?: { addressLocality?: string } };
}

function collect(blocks: unknown[]): LdEvent[] {
  const out: LdEvent[] = [];

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      visit(obj['@graph']);
      return;
    }
    const type = obj['@type'];
    if (type === 'SportsEvent' || type === 'Event') out.push(obj as LdEvent);
  };

  blocks.forEach(visit);
  return out;
}

export const viagogo: TicketSource = {
  id: 'viagogo',
  name: 'viagogo',
  homepage: ORIGIN,
  pricesOnListing: false,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const slug = comp.slugs.viagogo;
    if (!slug) return [];

    const html = await fetchText(`${ORIGIN}/${slug}`, {
      headers: {
        // Ask for a stable locale so the geo-redirect doesn't shuffle currency
        // between refreshes.
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    });

    return collect(extractJsonLd(html))
      .filter((e) => e.name && e.url)
      .map((e) => ({
        sourceId: 'viagogo' as const,
        externalId: e.url?.match(/E-(\d+)/)?.[1] ?? null,
        title: decodeEntities(e.name as string),
        homeName: null,
        awayName: null,
        startDate: e.startDate ?? null,
        venueName: e.location?.name ?? null,
        city: e.location?.address?.addressLocality ?? null,
        url: e.url as string,
        imageUrl: null,
        fromPrice: null, // never present on category pages
        highPrice: null,
        currency: null,
        inventory: null,
      }));
  },
};
