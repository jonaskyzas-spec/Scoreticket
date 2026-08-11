import { readJson, writeJson } from './cache';
import { normaliseTeam } from './sources/matching';

/**
 * Club badges from TheSportsDB.
 *
 * football-data.org supplies crests, but only with an API key — and in no-key
 * mode the fixtures come from the ticket sites, which give us team *names* and
 * nothing else. TheSportsDB fills that gap: a free, keyless search by team name
 * that returns a transparent PNG badge.
 *
 * Two failure modes worth guarding against, both handled below:
 *   - The search is cross-sport, so "Phoenix" or "Arsenal" can return a
 *     basketball or cricket side. We filter to Soccer.
 *   - It's a fuzzy search, so a miss returns a *plausible but wrong* club
 *     rather than nothing. We re-check the returned name against the one we
 *     asked for, because a wrong badge is far worse than no badge.
 *
 * Cached for 30 days — badges change about once a decade.
 */

const CACHE_KEY = 'team-logos';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const API = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';

type LogoMap = Record<string, string | null>;

interface SdbTeam {
  strTeam?: string;
  strTeamAlternate?: string;
  strSport?: string;
  strBadge?: string;
  strTeamBadge?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Dice coefficient over character bigrams. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
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

/**
 * How confident we are that `got` is the club named `asked`, 0..1.
 *
 * Substring containment is explicitly NOT enough. Asking for "Aarhus" and
 * accepting "Aarhus Fremad" — a different club in a different division —
 * silently puts the wrong badge on a fixture, which is worse than showing no
 * badge at all. Exact match wins outright; otherwise the names must be
 * genuinely similar in full, so a distinguishing extra word ("Fremad") drags
 * the score below threshold while a dropped filler word ("Deportivo") doesn't.
 */
function nameConfidence(asked: string, got: SdbTeam): number {
  const target = normaliseTeam(asked);
  if (!target) return 0;

  const candidates = [got.strTeam, got.strTeamAlternate]
    .filter((n): n is string => Boolean(n))
    // strTeamAlternate is a comma-separated list of aliases.
    .flatMap((n) => n.split(','))
    .map((n) => normaliseTeam(n.trim()))
    .filter(Boolean);

  let best = 0;
  for (const c of candidates) {
    if (c === target) return 1;
    best = Math.max(best, similarity(c, target));
  }
  return best;
}

/** Below this, we'd rather show initials than risk another club's badge. */
const CONFIDENCE_THRESHOLD = 0.72;

async function lookup(team: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?t=${encodeURIComponent(team)}`, {
        headers: { 'User-Agent': 'Scoreticket/0.1 (football fixtures)' },
      });

      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) return null;

      const data = (await res.json()) as { teams?: SdbTeam[] | null };
      const teams = (data.teams ?? []).filter((t) => /soccer/i.test(t.strSport ?? ''));

      // Rank every candidate and take the best — the search returns several
      // similarly-named clubs, and the first is not reliably the right one.
      let best: SdbTeam | null = null;
      let bestScore = 0;
      for (const t of teams) {
        const score = nameConfidence(team, t);
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }

      if (!best || bestScore < CONFIDENCE_THRESHOLD) return null;

      return best.strBadge ?? best.strTeamBadge ?? null;
    } catch {
      if (attempt < 2) {
        await sleep(700 * 2 ** attempt);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Resolve badges for many clubs at once, reusing the cache. Misses are retried
 * on later runs (a throttle looks identical to "no such club"), hits never are.
 */
export async function getTeamLogos(names: string[], retryMisses = true): Promise<LogoMap> {
  const cache = (await readJson<LogoMap>(CACHE_KEY)) ?? {};
  const wanted = [...new Set(names.filter(Boolean))];
  const missing = wanted.filter((n) => !(n in cache) || (retryMisses && cache[n] === null));

  for (const name of missing) {
    try {
      cache[name] = await lookup(name);
    } catch {
      cache[name] = null;
    }
    // TheSportsDB's keyless tier rate-limits aggressively: at 250ms it silently
    // starts refusing, which is indistinguishable from "club not found" and
    // quietly cost ~40% of badge coverage. 900ms holds up across a full run.
    await sleep(900);
  }

  if (missing.length > 0) {
    await writeJson(CACHE_KEY, cache, CACHE_TTL_SECONDS);
  }

  const out: LogoMap = {};
  for (const n of wanted) out[n] = cache[n] ?? null;
  return out;
}
