import { availableCompetitions, COMPETITIONS, type CompetitionConfig } from '../competitions';
import { cached } from '../cache';
import type { CompetitionId, Match } from '../types';
import { fetchCompetitionMatches, FootballDataError } from './football-data';

const FIXTURES_TTL_SECONDS = 60 * 60 * 6; // fixtures move rarely; 6h is plenty

export interface FixtureFetchReport {
  competitionId: CompetitionId;
  competitionName: string;
  matches: number;
  ok: boolean;
  skipped?: 'requires-paid-tier';
  error?: string;
}

export interface FixturesResult {
  matches: Match[];
  reports: FixtureFetchReport[];
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * football-data.org's free tier allows 10 requests/minute. Competitions are
 * fetched sequentially with a small gap so a full refresh never trips the limit.
 */
const REQUEST_GAP_MS = 6500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAll(daysAhead: number): Promise<FixturesResult> {
  const from = new Date();
  const to = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  const matches: Match[] = [];
  const reports: FixtureFetchReport[] = [];
  const usable = new Set(availableCompetitions().map((c) => c.id));

  for (const comp of COMPETITIONS) {
    if (!usable.has(comp.id)) {
      reports.push({
        competitionId: comp.id,
        competitionName: comp.name,
        matches: 0,
        ok: false,
        skipped: 'requires-paid-tier',
      });
      continue;
    }

    try {
      const got = await fetchCompetitionMatches(comp, ymd(from), ymd(to));
      matches.push(...got);
      reports.push({
        competitionId: comp.id,
        competitionName: comp.name,
        matches: got.length,
        ok: true,
      });
    } catch (err) {
      const message = err instanceof FootballDataError ? err.message : String(err);
      reports.push({
        competitionId: comp.id,
        competitionName: comp.name,
        matches: 0,
        ok: false,
        error: message,
      });
    }

    await sleep(REQUEST_GAP_MS);
  }

  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return { matches, reports };
}

/** Cached fixture list across every competition we can serve. */
export function getFixtures(daysAhead = 60): Promise<FixturesResult> {
  return cached(`fixtures-${daysAhead}d`, FIXTURES_TTL_SECONDS, () => fetchAll(daysAhead));
}

/** Force a refresh, bypassing the cache — used by the refresh job. */
export function refreshFixtures(daysAhead = 60): Promise<FixturesResult> {
  return fetchAll(daysAhead);
}

export type { CompetitionConfig };
