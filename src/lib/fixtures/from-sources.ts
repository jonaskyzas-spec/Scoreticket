import { COMPETITION_BY_ID } from '../competitions';
import { normaliseTeam, splitTitle } from '../sources/matching';
import type { Match, SourceEvent, SourceId } from '../types';

/**
 * Fallback fixtures provider.
 *
 * football-data.org needs a (free) API key, and until one is configured the
 * calendar would be empty. But Football Ticket Net and SeatPick both publish
 * JSON-LD carrying kickoff times, venues and teams alongside their prices — so
 * we can build a perfectly serviceable calendar out of the ticket data we've
 * already fetched, with no key at all.
 *
 * This is genuinely real data, not placeholder content. It is however *worse*
 * than the fixtures API: it only covers fixtures the ticket sites happen to be
 * selling (so no sold-out or non-resold games), it has no crests, and kickoff
 * times are as the ticket site states them rather than authoritative. So it's
 * strictly a fallback — the moment a key is present, football-data.org wins.
 */

/**
 * Sources whose listings carry trustworthy kickoff times, best-quality first
 * (the first source to claim a fixture wins the dedupe).
 *
 * SportsBreaks is included because it publishes full fixture dates on its club
 * pages — including matches the resale sites aren't listing yet. Leaving it out
 * meant its events could only ever attach to fixtures another source had
 * already put on the calendar, so most of them never appeared at all.
 */
const DATED_SOURCES: SourceId[] = ['footballticketnet', 'seatpick', 'sportsbreaks', 'p1travel'];

function teamsOf(event: SourceEvent): { home: string; away: string } | null {
  if (event.homeName && event.awayName) {
    return { home: event.homeName, away: event.awayName };
  }
  return splitTitle(event.title);
}

/**
 * Normalise a source's startDate to an ISO UTC string. These sites emit local
 * times without a zone (`2026-08-21T20:00:00`); Date.parse treats those as
 * local to the server, which is the closest we can get without a venue
 * timezone lookup.
 */
function toIsoUtc(startDate: string): string | null {
  const t = Date.parse(startDate);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

/**
 * Dedupe key: same competition + same two teams + same calendar day.
 *
 * Uses the matcher's club normaliser rather than a naive strip, because sources
 * disagree on club naming: P1 Travel says "Sevilla" where Football Ticket Net
 * says "Sevilla FC", and "Levante" vs "Levante UD". A plain lowercase-and-strip
 * treats those as different clubs and puts the same fixture on the board twice.
 */
function fixtureKey(competitionId: string, home: string, away: string, iso: string): string {
  return `${competitionId}:${normaliseTeam(home)}:${normaliseTeam(away)}:${iso.slice(0, 10)}`;
}

/**
 * Build a fixture list from already-scraped ticket-site events.
 * Returns matches sorted by kickoff, deduped across sources.
 */
export function fixturesFromSourceEvents(
  eventsBySource: Partial<Record<SourceId, SourceEvent[]>>,
): Match[] {
  const byKey = new Map<string, Match>();

  for (const sourceId of DATED_SOURCES) {
    for (const event of eventsBySource[sourceId] ?? []) {
      if (!event.startDate || !event.competitionId) continue;

      const iso = toIsoUtc(event.startDate);
      if (!iso) continue;

      const teams = teamsOf(event);
      if (!teams) continue;

      const comp = COMPETITION_BY_ID.get(event.competitionId);
      if (!comp) continue;

      const key = fixtureKey(comp.id, teams.home, teams.away, iso);
      // First dated source wins; DATED_SOURCES is ordered by data quality.
      if (byKey.has(key)) continue;

      byKey.set(key, {
        id: `${comp.id}:src-${sourceId}-${event.externalId ?? key}`,
        competitionId: comp.id,
        competitionName: comp.name,
        kickoff: iso,
        status: 'SCHEDULED',
        matchday: null,
        stage: null,
        home: { id: `src:${teams.home}`, name: teams.home, crest: null },
        away: { id: `src:${teams.away}`, name: teams.away, crest: null },
        venue: {
          name: event.venueName ?? null,
          city: event.city ?? null,
          country: comp.country,
          lat: null,
          lon: null,
        },
      });
    }
  }

  return [...byKey.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
