import type { Match, SourceEvent } from '../types';

/**
 * Matching fixtures to ticket-site events.
 *
 * This is the part that decides whether the whole thing works. football-data.org
 * says "Arsenal FC" and "Wolverhampton Wanderers FC"; the ticket sites say
 * "Arsenal" and "Wolves". So we normalise aggressively, keep a manual alias
 * table for the cases normalisation can't reach, and require the kickoff date
 * to agree within a day before accepting a pairing.
 */

/** Club-name noise that carries no identifying information. */
const NOISE = [
  'fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ss', 'ssc', 'us', 'ud', 'cd', 'rc', 'rcd',
  'sv', 'vfl', 'vfb', 'tsg', 'fsv', 'bsc', 'sge', 'club', 'calcio', 'futbol',
  'football', 'de', 'the', '1899', '1846', '1900', '04', '05', '96', '1907',
];

/** Names that normalisation alone will never reconcile. */
const ALIASES: Record<string, string> = {
  wolverhamptonwanderers: 'wolves',
  tottenhamhotspur: 'tottenham',
  brightonhovealbion: 'brighton',
  manchesterutd: 'manchesterunited',
  manutd: 'manchesterunited',
  mancity: 'manchestercity',
  newcastleunited: 'newcastle',
  westhamunited: 'westham',
  leedsunited: 'leeds',
  leicestercity: 'leicester',
  nottinghamforest: 'forest',
  bayernmunchen: 'bayernmunich',
  bayernmunuchen: 'bayernmunich',
  borussiadortmund: 'dortmund',
  borussiamonchengladbach: 'gladbach',
  bayer04leverkusen: 'leverkusen',
  eintrachtfrankfurt: 'frankfurt',
  parissaintgermain: 'psg',
  paris: 'psg',
  olympiquelyonnais: 'lyon',
  olympiquemarseille: 'marseille',
  atleticomadrid: 'atleticodemadrid',
  clubatleticodemadrid: 'atleticodemadrid',
  athleticclub: 'athleticbilbao',
  realsociedaddefutbol: 'realsociedad',
  internazionale: 'inter',
  intermilan: 'inter',
  acmilan: 'milan',
  ssclazio: 'lazio',
  asroma: 'roma',
  juventusfc: 'juventus',
  napolissc: 'napoli',
  sporting: 'sportingcp',
};

/**
 * Letters that NFD does not decompose \u2014 they're distinct characters, not a
 * base letter plus a combining mark. Without folding these, "Bod\u00f8/Glimt"
 * normalises to `bodglimt` (the \u00f8 is stripped as punctuation) and never
 * matches `bodoglimt`.
 */
const FOLD: Record<string, string> = {
  \u00f8: 'o',
  \u00e6: 'ae',
  \u00e5: 'a',
  \u00df: 'ss',
  \u0111: 'd',
  \u00f0: 'd',
  \u00fe: 'th',
  \u0142: 'l',
  \u0131: 'i',
  \u0153: 'oe',
};

/** Strip accents, punctuation, filler words and casing. */
export function normaliseTeam(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u00f8\u00e6\u00e5\u00df\u0111\u00f0\u00fe\u0142\u0131\u0153]/g, (c) => FOLD[c] ?? c)
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE.includes(w))
    .join('');

  return ALIASES[base] ?? base;
}

/** Split "Arsenal vs Coventry City" / "Arsenal - Coventry" into two names. */
export function splitTitle(title: string): { home: string; away: string } | null {
  const m = title.match(/^(.+?)\s+(?:vs\.?|v\.?|-|–|—|@|against)\s+(.+?)$/i);
  if (!m) return null;
  return { home: m[1].trim(), away: m[2].trim() };
}

/** Dice coefficient over character bigrams — tolerant of small spelling drift. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };

  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  let total = 0;

  for (const n of A.values()) total += n;
  for (const n of B.values()) total += n;

  for (const [g, n] of A) {
    const m = B.get(g);
    if (m) overlap += Math.min(n, m);
  }

  return (2 * overlap) / total;
}

/** How well two team names agree, 0..1. Substring containment counts as strong. */
export function teamSimilarity(a: string, b: string): number {
  const na = normaliseTeam(a);
  const nb = normaliseTeam(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  return similarity(na, nb);
}

const TEAM_THRESHOLD = 0.78;
/** Kickoff times drift across sites (local vs UTC, TBC slots) — allow ±36h. */
const DATE_TOLERANCE_MS = 36 * 60 * 60 * 1000;

export interface MatchCandidate {
  event: SourceEvent;
  score: number;
}

function eventTeams(event: SourceEvent): { home: string; away: string } | null {
  if (event.homeName && event.awayName) {
    return { home: event.homeName, away: event.awayName };
  }
  return splitTitle(event.title);
}

function datesAgree(match: Match, event: SourceEvent): boolean {
  if (!event.startDate) return true; // no date from the source — don't punish it
  const t = Date.parse(event.startDate);
  if (Number.isNaN(t)) return true;
  return Math.abs(t - Date.parse(match.kickoff)) <= DATE_TOLERANCE_MS;
}

/**
 * Pick the source event that best corresponds to `match`, or null when nothing
 * clears the bar. Returning null is the correct outcome far more often than a
 * wrong pairing — showing Arsenal prices on a Chelsea page destroys trust.
 */
export function findBestEvent(match: Match, events: SourceEvent[]): MatchCandidate | null {
  let best: MatchCandidate | null = null;

  for (const event of events) {
    const teams = eventTeams(event);
    if (!teams) continue;
    if (!datesAgree(match, event)) continue;

    const homeScore = teamSimilarity(match.home.name, teams.home);
    const awayScore = teamSimilarity(match.away.name, teams.away);

    if (homeScore < TEAM_THRESHOLD || awayScore < TEAM_THRESHOLD) continue;

    const score = (homeScore + awayScore) / 2;
    if (!best || score > best.score) best = { event, score };
  }

  return best;
}
