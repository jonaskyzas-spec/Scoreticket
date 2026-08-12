import { readJson, writeJson } from '../cache';
import type { SourceId, SourceStatus } from '../types';

/**
 * Per-source circuit breaker.
 *
 * The user's call was "scrape whatever you can, if they block try again next
 * time" — so a blocked source is never fatal. It's marked, skipped for a
 * cooldown window, then automatically retried on a later refresh cycle.
 */

const STATE_KEY = 'source-status';

const DEFAULT_COOLDOWN_MINUTES = 45;
/** Failures tolerated before a source is parked. */
const FAILURE_THRESHOLD = 3;

type StatusMap = Partial<Record<SourceId, SourceStatus>>;

function cooldownMinutes(): number {
  const raw = Number(process.env.SCRAPER_COOLDOWN_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_COOLDOWN_MINUTES;
}

function disabledSources(): Set<string> {
  return new Set(
    (process.env.SCRAPER_DISABLED_SOURCES ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function loadAll(): Promise<StatusMap> {
  return (await readJson<StatusMap>(STATE_KEY)) ?? {};
}

async function saveAll(map: StatusMap): Promise<void> {
  await writeJson(STATE_KEY, map);
}

export async function getStatus(sourceId: SourceId): Promise<SourceStatus> {
  if (disabledSources().has(sourceId)) {
    return { sourceId, health: 'disabled', consecutiveFailures: 0 };
  }
  const all = await loadAll();
  return all[sourceId] ?? { sourceId, health: 'ok', consecutiveFailures: 0 };
}

export async function getAllStatuses(): Promise<SourceStatus[]> {
  const all = await loadAll();
  const disabled = disabledSources();
  const ids: SourceId[] = [
    'seatpick',
    'stubhub',
    'footballticketnet',
    'sportsbreaks',
    'p1travel',
    'livefootballtickets',
    'viagogo',
  ];
  return ids.map((id) => {
    if (disabled.has(id)) return { sourceId: id, health: 'disabled', consecutiveFailures: 0 };
    return all[id] ?? { sourceId: id, health: 'ok', consecutiveFailures: 0 };
  });
}

/** True when the source should be skipped on this cycle. */
export async function shouldSkip(sourceId: SourceId): Promise<boolean> {
  const status = await getStatus(sourceId);
  if (status.health === 'disabled') return true;
  if (!status.cooldownUntil) return false;
  return new Date(status.cooldownUntil).getTime() > Date.now();
}

export async function recordSuccess(sourceId: SourceId): Promise<void> {
  const all = await loadAll();
  all[sourceId] = {
    sourceId,
    health: 'ok',
    consecutiveFailures: 0,
    cooldownUntil: null,
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
  };
  await saveAll(all);
}

export async function recordFailure(
  sourceId: SourceId,
  error: string,
  isBlock: boolean,
): Promise<void> {
  const all = await loadAll();
  const prev = all[sourceId] ?? { sourceId, health: 'ok' as const, consecutiveFailures: 0 };
  const failures = prev.consecutiveFailures + 1;

  // An outright block parks the source immediately; ordinary failures get a
  // few chances first (a single timeout shouldn't take a whole site offline).
  const park = isBlock || failures >= FAILURE_THRESHOLD;

  all[sourceId] = {
    sourceId,
    health: park ? 'blocked' : 'degraded',
    consecutiveFailures: failures,
    cooldownUntil: park
      ? new Date(Date.now() + cooldownMinutes() * 60_000).toISOString()
      : null,
    lastSuccessAt: prev.lastSuccessAt ?? null,
    lastError: error.slice(0, 300),
  };

  await saveAll(all);
}
