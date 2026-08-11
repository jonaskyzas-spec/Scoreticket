import type { CompetitionConfig } from '../competitions';
import type { SourceEvent, SourceId } from '../types';

/**
 * Every ticket site implements this one method. Adapters return raw listed
 * events; pairing them to fixtures is the runner's job (see `matching.ts`), so
 * an adapter never needs to know anything about football-data.org.
 */
export interface TicketSource {
  id: SourceId;
  name: string;
  homepage: string;
  /**
   * Sites that only expose prices on the individual event page rather than on
   * the competition listing. The runner still records the deep link so the UI
   * can send users there, it just won't have a number to show.
   */
  pricesOnListing: boolean;
  listEvents(comp: CompetitionConfig): Promise<SourceEvent[]>;
}

/** Resolve a possibly-relative href against a site origin. */
export function absoluteUrl(origin: string, href: string): string {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}

/** Decode the handful of HTML entities that show up in event titles. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}
