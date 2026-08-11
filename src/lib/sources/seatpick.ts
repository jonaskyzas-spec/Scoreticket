import type { CompetitionConfig } from '../competitions';
import type { SourceEvent } from '../types';
import { decodeEntities, type TicketSource } from './base';
import { extractJsonLd, fetchText } from './http';

/**
 * SeatPick.
 *
 * The richest of the five: every competition page embeds an
 * `application/ld+json` `@graph` of SportsEvent objects carrying an
 * AggregateOffer with lowPrice, highPrice, currency and inventory level.
 * Parsing that is far more durable than CSS selectors, which is why this
 * adapter ignores the DOM entirely.
 *
 * Verified live: /english-premier-league-tickets returns 20 events per page.
 */

const ORIGIN = 'https://seatpick.com';

interface LdOffer {
  price?: number;
  lowPrice?: number;
  highPrice?: number;
  priceCurrency?: string;
  url?: string;
  inventoryLevel?: { value?: number };
}

interface LdPerformer {
  '@type'?: string;
  name?: string;
}

interface LdSportsEvent {
  '@type'?: string;
  name?: string;
  url?: string;
  startDate?: string;
  image?: string | null;
  location?: {
    name?: string;
    address?: { addressLocality?: string; addressCountry?: string };
  };
  performer?: LdPerformer[];
  offers?: LdOffer;
}

function collectEvents(blocks: unknown[]): LdSportsEvent[] {
  const out: LdSportsEvent[] = [];

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
    if (obj['@type'] === 'SportsEvent') {
      out.push(obj as LdSportsEvent);
    }
  };

  blocks.forEach(visit);
  return out;
}

function toSourceEvent(ev: LdSportsEvent): SourceEvent | null {
  if (!ev.name || !ev.url) return null;

  const teams = (ev.performer ?? []).filter((p) => p['@type'] === 'SportsTeam');
  const offer = ev.offers;

  return {
    sourceId: 'seatpick',
    externalId: ev.url.match(/\/event\/(\d+)/)?.[1] ?? null,
    title: decodeEntities(ev.name),
    homeName: teams[0]?.name ? decodeEntities(teams[0].name) : null,
    awayName: teams[1]?.name ? decodeEntities(teams[1].name) : null,
    startDate: ev.startDate ?? null,
    venueName: ev.location?.name ?? null,
    city: ev.location?.address?.addressLocality ?? null,
    url: ev.url,
    imageUrl: ev.image ?? null,
    fromPrice: offer?.lowPrice ?? offer?.price ?? null,
    highPrice: offer?.highPrice ?? null,
    currency: offer?.priceCurrency ?? null,
    inventory: offer?.inventoryLevel?.value ?? null,
  };
}

export const seatpick: TicketSource = {
  id: 'seatpick',
  name: 'SeatPick',
  homepage: ORIGIN,
  pricesOnListing: true,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const slug = comp.slugs.seatpick;
    if (!slug) return [];

    const html = await fetchText(`${ORIGIN}/${slug}`);
    const events = collectEvents(extractJsonLd(html));

    return events
      .map(toSourceEvent)
      .filter((e): e is SourceEvent => e !== null);
  },
};
