import { readJson, readJsonStale, writeJson } from './cache';
import { COMPETITIONS, availableCompetitions } from './competitions';
import { getFixtures, refreshFixtures, type FixtureFetchReport } from './fixtures';
import { fixturesFromSourceEvents } from './fixtures/from-sources';
import { getTeamLogos } from './team-logos';
import { SNAPSHOT_BOARD } from './snapshot';
import {
  attachPrices,
  getAllStatuses,
  scrapeAllSources,
  type SourceScrapeReport,
} from './sources';
import type { MatchWithPrices, SourceEvent, SourceId, SourceStatus } from './types';

/**
 * The board is the single object the UI renders: fixtures joined to prices,
 * plus enough diagnostics to explain any gaps honestly on the page.
 */

const BOARD_KEY = 'board';
const EVENTS_KEY = 'source-events';
const BOARD_TTL_SECONDS = 60 * 30; // prices go stale fast
const EVENTS_TTL_SECONDS = 60 * 30;

export interface Board {
  generatedAt: string;
  matches: MatchWithPrices[];
  fixtureReports: FixtureFetchReport[];
  sourceReports: SourceScrapeReport[];
  sourceStatuses: SourceStatus[];
  /**
   * 'football-data' when the fixtures API supplied the calendar, 'ticket-sites'
   * when we fell back to dates scraped from the ticket listings. Surfaced in
   * the UI so the provenance of the calendar is never ambiguous.
   */
  fixtureSource: 'football-data' | 'ticket-sites';
}

async function buildBoard(daysAhead: number, forceRefresh: boolean): Promise<Board> {
  const fixtures = forceRefresh ? await refreshFixtures(daysAhead) : await getFixtures(daysAhead);

  // Normally we only scrape competitions we actually have fixtures for — no
  // point asking SeatPick for Copa Libertadores if football-data.org can't give
  // us the games. But when the fixtures API returned nothing at all (no key, or
  // it's down) we scrape everything, because the ticket sites are then our only
  // source of a calendar.
  const withFixtures = new Set(fixtures.matches.map((m) => m.competitionId));
  const targets =
    withFixtures.size > 0
      ? COMPETITIONS.filter((c) => withFixtures.has(c.id))
      : availableCompetitions();

  let eventsBySource: Partial<Record<SourceId, SourceEvent[]>>;
  let sourceReports: SourceScrapeReport[];

  if (forceRefresh) {
    const scraped = await scrapeAllSources(targets);
    eventsBySource = scraped.eventsBySource;
    sourceReports = scraped.reports;
    await writeJson(EVENTS_KEY, scraped, EVENTS_TTL_SECONDS);
  } else {
    const stale = await readJsonStale<{
      eventsBySource: Partial<Record<SourceId, SourceEvent[]>>;
      reports: SourceScrapeReport[];
    }>(EVENTS_KEY);

    if (stale) {
      eventsBySource = stale.value.eventsBySource;
      sourceReports = stale.value.reports;
    } else {
      const scraped = await scrapeAllSources(targets);
      eventsBySource = scraped.eventsBySource;
      sourceReports = scraped.reports;
      await writeJson(EVENTS_KEY, scraped, EVENTS_TTL_SECONDS);
    }
  }

  // With no usable API key football-data.org returns nothing. Rather than show
  // an empty calendar, rebuild it from the dated events the ticket sites gave
  // us — real fixtures, just less complete than the fixtures API.
  let matches = fixtures.matches;
  let fixtureSource: Board['fixtureSource'] = 'football-data';

  if (matches.length === 0) {
    const derived = fixturesFromSourceEvents(eventsBySource);
    if (derived.length > 0) {
      matches = derived;
      fixtureSource = 'ticket-sites';
    }
  }

  const priced = attachPrices(matches, eventsBySource);

  // Club badges, looked up once per club and cached for 30 days. Only clubs
  // that don't already have a crest from football-data.org are looked up, so
  // with an API key configured this costs nothing. Best-effort: a failure here
  // must never cost us the board.
  let logos: Record<string, string | null> = {};
  try {
    const needing = new Set<string>();
    for (const p of priced) {
      if (!p.match.home.crest) needing.add(p.match.home.name);
      if (!p.match.away.crest) needing.add(p.match.away.name);
    }
    logos = await getTeamLogos([...needing]);
  } catch {
    logos = {};
  }

  return {
    generatedAt: new Date().toISOString(),
    matches: priced.map((p) => ({
      ...p,
      match: {
        ...p.match,
        home: { ...p.match.home, crest: p.match.home.crest ?? logos[p.match.home.name] ?? null },
        away: { ...p.match.away, crest: p.match.away.crest ?? logos[p.match.away.name] ?? null },
      },
      photo: null,
    })),
    fixtureReports: fixtures.reports,
    sourceReports,
    sourceStatuses: await getAllStatuses(),
    fixtureSource,
  };
}

/**
 * Cached board for page rendering.
 *
 * Never scrapes inside a page request. If the cache is cold — which on Vercel
 * means every new instance — we serve the committed snapshot immediately and
 * let the cron job populate the real cache in the background. A visitor should
 * never wait a minute for a scrape.
 */
export async function getBoard(daysAhead = 60): Promise<Board> {
  const key = `${BOARD_KEY}-${daysAhead}d`;

  const fresh = await readJson<Board>(key);
  if (fresh) return fresh;

  const stale = await readJsonStale<Board>(key);
  if (stale) return stale.value;

  return SNAPSHOT_BOARD;
}

/** Full refresh: re-fetch fixtures AND re-scrape every source. */
export async function refreshBoard(daysAhead = 60): Promise<Board> {
  const board = await buildBoard(daysAhead, true);
  await writeJson(`${BOARD_KEY}-${daysAhead}d`, board, BOARD_TTL_SECONDS);
  return board;
}

/** Competitions the current API key can actually serve, for the filter bar. */
export function servableCompetitions() {
  return availableCompetitions();
}
