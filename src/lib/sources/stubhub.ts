import type { CompetitionConfig } from '../competitions';
import type { SourceEvent } from '../types';
import { type TicketSource } from './base';
import { fetchJson, parseCurrency, parsePrice } from './http';

/**
 * StubHub.
 *
 * StubHub's public HTML is a React shell with no useful server-rendered data,
 * but the site's own front-end calls an internal JSON endpoint that answers
 * plain GETs:
 *
 *   /explore?method=getExploreEvents&...
 *   → { events: [{ eventId, name, url, imageUrl, formattedFromPrice,
 *                  venueName, formattedVenueLocation, formattedDateWithoutYear,
 *                  formattedTime, ... }], total }
 *
 * Verified live: returns 200 + application/json, and it is the only source of
 * the five that hands us event artwork.
 *
 * KNOWN LIMITATION — read before relying on this adapter.
 * `/explore` is a *local discovery* endpoint, not a search endpoint. Testing
 * showed:
 *   - `q=Arsenal` is ignored entirely (returns local concerts).
 *   - `lat`/`lon`/`radius` are ignored; results are geolocated from the
 *     requesting server's IP.
 *   - `sortBy=DATE` is what makes `formattedFromPrice` populate.
 * So from any single host it only ever returns events near that host, which
 * cannot cover ten competitions across Europe and South America. The fixture
 * matcher discards the irrelevant results, so this adapter is harmless but
 * contributes little — it is disabled by default in `.env.example`.
 *
 * To get real StubHub coverage you need their partner/affiliate API, which
 * supplies a proper event search. This adapter is the seam to plug it into:
 * keep `listEvents`, swap the URL and the response mapping.
 */

const ORIGIN = 'https://www.stubhub.com';

interface ExploreEvent {
  eventId?: number;
  name?: string;
  url?: string;
  imageUrl?: string;
  formattedFromPrice?: string;
  venueName?: string;
  formattedVenueLocation?: string;
  formattedDate?: string;
  formattedDateWithoutYear?: string;
  formattedTime?: string;
  hasActiveListings?: boolean;
}

interface ExploreResponse {
  events?: ExploreEvent[];
  total?: number;
}

/** Tunable query shape — see the caveat above. */
const PARAMS = {
  limit: '100',
  // 64 is StubHub's soccer grouping; the endpoint does not reliably honour it.
  categoryId: '64',
  // Without this, `formattedFromPrice` comes back empty on every row.
  sortBy: 'DATE',
};

function buildUrl(comp: CompetitionConfig): string {
  const qs = new URLSearchParams({
    method: 'getExploreEvents',
    q: comp.name,
    ...PARAMS,
  });
  return `${ORIGIN}/explore?${qs.toString()}`;
}

/**
 * StubHub gives "Aug 21" + "8:00 PM" but no year on listing rows. We reattach
 * the nearest plausible year so the matcher's date check has something to work
 * with, and fall back to null rather than guessing wrong.
 */
function inferStartDate(ev: ExploreEvent): string | null {
  const datePart = ev.formattedDate ?? ev.formattedDateWithoutYear;
  if (!datePart) return null;

  const now = new Date();
  for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    const parsed = Date.parse(`${datePart} ${year} ${ev.formattedTime ?? '00:00'} UTC`);
    if (!Number.isNaN(parsed)) {
      // Reject dates far in the past — that means we picked the wrong year.
      if (parsed > now.getTime() - 7 * 24 * 60 * 60 * 1000) {
        return new Date(parsed).toISOString();
      }
    }
  }
  return null;
}

export const stubhub: TicketSource = {
  id: 'stubhub',
  name: 'StubHub',
  homepage: ORIGIN,
  pricesOnListing: true,

  async listEvents(comp: CompetitionConfig): Promise<SourceEvent[]> {
    const data = await fetchJson<ExploreResponse>(buildUrl(comp), {
      headers: { Referer: `${ORIGIN}/` },
    });

    return (data.events ?? [])
      .filter((e) => e.name && e.url)
      .map((e) => ({
        sourceId: 'stubhub' as const,
        externalId: e.eventId != null ? String(e.eventId) : null,
        title: e.name as string,
        homeName: null,
        awayName: null,
        startDate: inferStartDate(e),
        venueName: e.venueName ?? null,
        city: e.formattedVenueLocation ?? null,
        url: e.url as string,
        imageUrl: e.imageUrl ?? null,
        fromPrice: parsePrice(e.formattedFromPrice),
        highPrice: null,
        currency: parseCurrency(e.formattedFromPrice),
        inventory: null,
      }));
  },
};
