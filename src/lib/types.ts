/** Core domain types shared by the fixtures layer, the ticket sources and the UI. */

export type CompetitionId =
  | 'premier-league'
  | 'la-liga'
  | 'serie-a'
  | 'bundesliga'
  | 'ligue-1'
  | 'champions-league'
  | 'europa-league'
  | 'conference-league'
  | 'efl-cup'
  | 'copa-libertadores';

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  crest?: string | null;
}

export interface Venue {
  name?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface Match {
  /** Stable internal id: `${competitionId}:${providerMatchId}` */
  id: string;
  competitionId: CompetitionId;
  competitionName: string;
  /** ISO-8601 UTC kickoff. */
  kickoff: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'UNKNOWN';
  matchday?: number | null;
  stage?: string | null;
  home: Team;
  away: Team;
  venue: Venue;
}

/** A price quote for one match from one ticket source. */
export interface PriceQuote {
  sourceId: SourceId;
  sourceName: string;
  /** Cheapest available ticket, in minor-unit-free decimal (e.g. 187.5). */
  fromPrice: number | null;
  highPrice?: number | null;
  currency: string;
  /** Number of listings/tickets available, when the source exposes it. */
  inventory?: number | null;
  /** Deep link to the match page on that source. */
  url: string;
  /** Event artwork the source provides, if any. */
  imageUrl?: string | null;
  /**
   * True when the price is for a travel package (match ticket + hotel), not a
   * bare ticket. Package prices are an order of magnitude higher and are NEVER
   * ranked against ticket prices — see `pickBest` in sources/index.ts.
   */
  isPackage?: boolean;
  /** The source says this fixture is sold out. */
  soldOut?: boolean;
  /** When this quote was captured (ISO-8601). */
  fetchedAt: string;
}

export type SourceId =
  | 'seatpick'
  | 'stubhub'
  | 'footballticketnet'
  | 'livefootballtickets'
  | 'viagogo'
  | 'sportsbreaks'
  | 'p1travel';

/** An event as listed on a ticket site, before it's matched to a fixture. */
export interface SourceEvent {
  sourceId: SourceId;
  /** Which competition page this was listed on. Stamped by the runner. */
  competitionId?: CompetitionId | null;
  /** The source's own event id, when available. */
  externalId?: string | null;
  /** Raw title, e.g. "Arsenal vs Coventry City FC". */
  title: string;
  homeName?: string | null;
  awayName?: string | null;
  /** ISO-8601, may be local time without zone if the source omits it. */
  startDate?: string | null;
  venueName?: string | null;
  city?: string | null;
  url: string;
  imageUrl?: string | null;
  fromPrice?: number | null;
  highPrice?: number | null;
  currency?: string | null;
  inventory?: number | null;
  /** Price covers a ticket + hotel package rather than a ticket alone. */
  isPackage?: boolean;
  /** The source explicitly marks this fixture as sold out. */
  soldOut?: boolean;
}

export type SourceHealth = 'ok' | 'degraded' | 'blocked' | 'disabled';

export interface SourceStatus {
  sourceId: SourceId;
  health: SourceHealth;
  consecutiveFailures: number;
  /** ISO-8601; while in the future the source is skipped. */
  cooldownUntil?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
}

/** A match plus every quote we currently hold for it. */
export interface MatchWithPrices {
  match: Match;
  quotes: PriceQuote[];
  /** Lowest fromPrice across sources, normalised to a single currency. */
  best: PriceQuote | null;
  /** Stadium photograph from Wikimedia, when one exists for this venue. */
  photo?: { url: string; pageUrl: string; title: string } | null;
}
