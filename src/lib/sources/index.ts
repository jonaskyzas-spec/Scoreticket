import { COMPETITIONS, type CompetitionConfig } from '../competitions';
import { toEurApprox } from '../fx';
import type { Match, MatchWithPrices, PriceQuote, SourceEvent, SourceId } from '../types';
import type { TicketSource } from './base';
import { recordFailure, recordSuccess, shouldSkip } from './circuit-breaker';
import { footballticketnet } from './footballticketnet';
import { BlockedError } from './http';
import { livefootballtickets } from './livefootballtickets';
import { findBestEvent } from './matching';
import { seatpick } from './seatpick';
import { sportsbreaks } from './sportsbreaks';
import { stubhub } from './stubhub';
import { viagogo } from './viagogo';

/**
 * Ordered best-data-first: SeatPick and StubHub carry real prices on their
 * listings, FTN carries a from-price, viagogo and LFT contribute deep links.
 */
export const SOURCES: TicketSource[] = [
  seatpick,
  stubhub,
  footballticketnet,
  sportsbreaks,
  viagogo,
  livefootballtickets,
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function delayMs(): number {
  const raw = Number(process.env.SCRAPER_DELAY_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2500;
}

export interface SourceScrapeReport {
  sourceId: SourceId;
  sourceName: string;
  events: number;
  competitionsOk: number;
  competitionsFailed: number;
  skipped: boolean;
  blocked: boolean;
  errors: string[];
}

export interface ScrapeResult {
  /** Every event we managed to list, keyed by source. */
  eventsBySource: Partial<Record<SourceId, SourceEvent[]>>;
  reports: SourceScrapeReport[];
}

/**
 * Walk every enabled source across every competition.
 *
 * Failure is expected and never fatal: a source that blocks is recorded, parked
 * by the circuit breaker, and simply contributes nothing this cycle. The site
 * renders with whatever the other sources returned.
 */
export async function scrapeAllSources(
  competitions: CompetitionConfig[] = COMPETITIONS,
): Promise<ScrapeResult> {
  const eventsBySource: Partial<Record<SourceId, SourceEvent[]>> = {};
  const reports: SourceScrapeReport[] = [];

  for (const source of SOURCES) {
    if (await shouldSkip(source.id)) {
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        events: 0,
        competitionsOk: 0,
        competitionsFailed: 0,
        skipped: true,
        blocked: true,
        errors: ['skipped: in cooldown or disabled'],
      });
      continue;
    }

    const collected: SourceEvent[] = [];
    const errors: string[] = [];
    let ok = 0;
    let failed = 0;
    let blocked = false;

    for (const comp of competitions) {
      try {
        const events = await source.listEvents(comp);
        // Stamp the competition so the fallback fixtures provider (and any
        // per-competition filtering) doesn't have to re-derive it.
        collected.push(...events.map((e) => ({ ...e, competitionId: comp.id })));
        ok++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${comp.id}: ${message}`);

        if (err instanceof BlockedError) {
          blocked = true;
          // No point walking the remaining competitions on a blocked host.
          break;
        }
      }

      await sleep(delayMs());
    }

    if (blocked || (ok === 0 && failed > 0)) {
      await recordFailure(source.id, errors[0] ?? 'unknown error', blocked);
    } else {
      await recordSuccess(source.id);
    }

    eventsBySource[source.id] = collected;
    reports.push({
      sourceId: source.id,
      sourceName: source.name,
      events: collected.length,
      competitionsOk: ok,
      competitionsFailed: failed,
      skipped: false,
      blocked,
      errors: errors.slice(0, 5),
    });
  }

  return { eventsBySource, reports };
}

function toQuote(source: TicketSource, event: SourceEvent, currencyFallback: string): PriceQuote {
  return {
    sourceId: source.id,
    sourceName: source.name,
    fromPrice: event.fromPrice ?? null,
    highPrice: event.highPrice ?? null,
    currency: event.currency ?? currencyFallback,
    inventory: event.inventory ?? null,
    url: event.url,
    imageUrl: event.imageUrl ?? null,
    isPackage: event.isPackage ?? false,
    soldOut: event.soldOut ?? false,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Rank quotes cheapest-first.
 *
 * Package quotes (SportsBreaks: ticket + hotel) are excluded outright. A £296
 * package alongside a £74 resale ticket isn't a cheaper-or-dearer comparison,
 * it's a different product — ranking them together would misrepresent both.
 * They still appear in the table, clearly labelled.
 */
function pickBest(quotes: PriceQuote[]): PriceQuote | null {
  const priced = quotes.filter((q) => q.fromPrice != null && !q.isPackage);
  if (priced.length === 0) return null;

  let best: PriceQuote | null = null;
  let bestEur = Number.POSITIVE_INFINITY;

  for (const q of priced) {
    const eur = toEurApprox(q.fromPrice as number, q.currency);
    // Unknown currency can't be ranked — keep it as a last-resort candidate.
    const value = eur ?? Number.MAX_SAFE_INTEGER;
    if (value < bestEur) {
      bestEur = value;
      best = q;
    }
  }

  return best;
}

/** Attach every source's quote to each fixture. */
export function attachPrices(
  matches: Match[],
  eventsBySource: Partial<Record<SourceId, SourceEvent[]>>,
): MatchWithPrices[] {
  const currencyFallback = process.env.SCORETICKET_CURRENCY ?? 'EUR';

  return matches.map((match) => {
    const quotes: PriceQuote[] = [];

    for (const source of SOURCES) {
      const events = eventsBySource[source.id];
      if (!events || events.length === 0) continue;

      const candidate = findBestEvent(match, events);
      if (!candidate) continue;

      quotes.push(toQuote(source, candidate.event, currencyFallback));
    }

    return { match, quotes, best: pickBest(quotes) };
  });
}

export { getAllStatuses } from './circuit-breaker';
export type { TicketSource };
