import type { CompetitionId } from './types';

export interface CompetitionConfig {
  id: CompetitionId;
  name: string;
  shortName: string;
  country: string;
  /** football-data.org competition code (v4). */
  footballDataCode: string;
  /**
   * True when football-data.org only serves this competition on a paid plan.
   * Gated competitions are skipped unless FOOTBALL_DATA_PAID_TIER=true, so the
   * free tier doesn't spend its quota on requests that will 403.
   */
  requiresPaidTier: boolean;
  /** Brand colour used for the competition chip in the UI. */
  accent: string;
  /** Per-source URL slugs, discovered from each site's live navigation. */
  slugs: {
    seatpick?: string;
    footballticketnet?: string;
    livefootballtickets?: string;
    viagogo?: string;
    sportsbreaks?: string;
  };
}

export const COMPETITIONS: CompetitionConfig[] = [
  {
    id: 'premier-league',
    name: 'Premier League',
    shortName: 'PL',
    country: 'England',
    footballDataCode: 'PL',
    requiresPaidTier: false,
    accent: '#38003c',
    slugs: {
      seatpick: 'english-premier-league-tickets',
      footballticketnet: 'premier-league-football-tickets',
      livefootballtickets: 'premier-league-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/English-Premier-League-Tickets',
      sportsbreaks: 'premier-league',
    },
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    shortName: 'LaLiga',
    country: 'Spain',
    footballDataCode: 'PD',
    requiresPaidTier: false,
    accent: '#ee8707',
    slugs: {
      seatpick: 'spanish-la-liga-tickets',
      footballticketnet: 'spanish-la-liga-football-tickets',
      livefootballtickets: 'la-liga-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Spanish-La-Liga-Tickets',
      sportsbreaks: 'la-liga',
    },
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    footballDataCode: 'SA',
    requiresPaidTier: false,
    accent: '#0b3d91',
    slugs: {
      seatpick: 'italian-serie-a-tickets',
      footballticketnet: 'italian-serie-a-football-tickets',
      livefootballtickets: 'serie-a-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Italian-Serie-A-Tickets',
      sportsbreaks: 'serie-a',
    },
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'BL',
    country: 'Germany',
    footballDataCode: 'BL1',
    requiresPaidTier: false,
    accent: '#d20515',
    slugs: {
      seatpick: 'german-bundesliga-tickets',
      footballticketnet: 'german-bundesliga-football-tickets',
      livefootballtickets: 'bundesliga-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/German-Bundesliga-Tickets',
      sportsbreaks: 'bundesliga',
    },
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    shortName: 'L1',
    country: 'France',
    footballDataCode: 'FL1',
    requiresPaidTier: false,
    accent: '#dae025',
    slugs: {
      seatpick: 'french-ligue-1-tickets',
      footballticketnet: 'french-ligue-1-football-tickets',
      livefootballtickets: 'ligue-1-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/French-Ligue-1-Tickets',
      sportsbreaks: 'ligue-1',
    },
  },
  {
    id: 'champions-league',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europe',
    footballDataCode: 'CL',
    requiresPaidTier: false,
    accent: '#0e1e5b',
    slugs: {
      seatpick: 'uefa-champions-league-tickets',
      footballticketnet: 'champions-league-football-tickets',
      livefootballtickets: 'champions-league-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Champions-League-Tickets',
    },
  },
  {
    id: 'europa-league',
    name: 'UEFA Europa League',
    shortName: 'UEL',
    country: 'Europe',
    footballDataCode: 'EL',
    requiresPaidTier: true,
    accent: '#ff6900',
    slugs: {
      seatpick: 'uefa-europa-league-tickets',
      footballticketnet: 'europa-league-football-tickets',
      livefootballtickets: 'uefa-europa-league-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Europa-League-Tickets',
    },
  },
  {
    id: 'conference-league',
    name: 'UEFA Conference League',
    shortName: 'UECL',
    country: 'Europe',
    footballDataCode: 'UCL',
    requiresPaidTier: true,
    accent: '#00b74f',
    slugs: {
      seatpick: 'uefa-conference-league-tickets',
      footballticketnet: 'europa-conference-league-football-tickets',
      livefootballtickets: 'uefa-europa-conference-league-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Europa-Conference-League-Tickets',
    },
  },
  {
    id: 'efl-cup',
    name: 'EFL Cup (Carabao Cup)',
    shortName: 'EFL Cup',
    country: 'England',
    // football-data.org has no dedicated EFL Cup code on the plans below Pro;
    // 'ELC' is the Championship. Left as the cup code so a Pro key can serve it.
    footballDataCode: 'EFL',
    requiresPaidTier: true,
    accent: '#e01a4f',
    slugs: {
      seatpick: 'carabao-cup-tickets',
      footballticketnet: 'carabao-cup-football-tickets',
      livefootballtickets: 'efl-cup-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Carabao-Cup-Tickets',
    },
  },
  {
    id: 'copa-libertadores',
    name: 'Copa Libertadores',
    shortName: 'Libertadores',
    country: 'South America',
    footballDataCode: 'CLI',
    requiresPaidTier: true,
    accent: '#f2b705',
    slugs: {
      seatpick: 'copa-libertadores-tickets',
      footballticketnet: 'copa-libertadores-football-tickets',
      livefootballtickets: 'copa-libertadores-tickets.html',
      viagogo: 'Sports-Tickets/Soccer/Copa-Libertadores-Tickets',
    },
  },
];

export const COMPETITION_BY_ID = new Map(COMPETITIONS.map((c) => [c.id, c]));
export const COMPETITION_BY_CODE = new Map(COMPETITIONS.map((c) => [c.footballDataCode, c]));

export function isPaidTier(): boolean {
  return process.env.FOOTBALL_DATA_PAID_TIER === 'true';
}

/** Competitions we can actually fetch fixtures for with the current API key. */
export function availableCompetitions(): CompetitionConfig[] {
  const paid = isPaidTier();
  return COMPETITIONS.filter((c) => paid || !c.requiresPaidTier);
}

export function getCompetition(id: string): CompetitionConfig | undefined {
  return COMPETITION_BY_ID.get(id as CompetitionId);
}
