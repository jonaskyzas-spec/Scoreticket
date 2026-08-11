import type { CompetitionConfig } from '../competitions';
import type { Match } from '../types';

const BASE = 'https://api.football-data.org/v4';

/** Shape of the bits of the football-data.org v4 match payload we consume. */
interface FdTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage?: string;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  venue?: string | null;
  area?: { name?: string };
  competition?: { code?: string; name?: string };
}

interface FdMatchesResponse {
  matches: FdMatch[];
}

export class FootballDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly competitionCode: string,
  ) {
    super(message);
    this.name = 'FootballDataError';
  }
}

function mapStatus(status: string): Match['status'] {
  const known = ['SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED'];
  return known.includes(status) ? (status as Match['status']) : 'UNKNOWN';
}

function toMatch(raw: FdMatch, comp: CompetitionConfig): Match {
  return {
    id: `${comp.id}:${raw.id}`,
    competitionId: comp.id,
    competitionName: comp.name,
    kickoff: raw.utcDate,
    status: mapStatus(raw.status),
    matchday: raw.matchday,
    stage: raw.stage ?? null,
    home: {
      id: String(raw.homeTeam.id),
      name: raw.homeTeam.name,
      shortName: raw.homeTeam.shortName ?? raw.homeTeam.tla,
      crest: raw.homeTeam.crest ?? null,
    },
    away: {
      id: String(raw.awayTeam.id),
      name: raw.awayTeam.name,
      shortName: raw.awayTeam.shortName ?? raw.awayTeam.tla,
      crest: raw.awayTeam.crest ?? null,
    },
    venue: {
      name: raw.venue ?? null,
      city: null,
      country: raw.area?.name ?? comp.country,
      lat: null,
      lon: null,
    },
  };
}

/**
 * Fetch scheduled matches for one competition in a date window.
 * Dates are `YYYY-MM-DD`; football-data.org caps the window at 10 days on the
 * free tier, so callers should chunk longer ranges.
 */
export async function fetchCompetitionMatches(
  comp: CompetitionConfig,
  dateFrom: string,
  dateTo: string,
  signal?: AbortSignal,
): Promise<Match[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new FootballDataError('FOOTBALL_DATA_API_KEY is not set', 401, comp.footballDataCode);
  }

  const url = `${BASE}/competitions/${comp.footballDataCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey },
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FootballDataError(
      `football-data.org ${res.status} for ${comp.footballDataCode}: ${body.slice(0, 200)}`,
      res.status,
      comp.footballDataCode,
    );
  }

  const data = (await res.json()) as FdMatchesResponse;
  return (data.matches ?? []).map((m) => toMatch(m, comp));
}
