import boardSnapshot from '../../data/board-snapshot.json';
import transfersSnapshot from '../../data/transfers-snapshot.json';
import type { Board } from './board';
import type { Transfer } from './transfers/types';

/**
 * Committed fallback data, bundled into the build.
 *
 * On Vercel the runtime cache lives in `/tmp`, which is empty on every cold
 * start. Without this, the first request to a fresh instance would kick off a
 * full scrape inside the user's page load — around a minute of waiting, and a
 * thundering-herd of requests at the ticket sites each time Vercel scales up.
 *
 * These are imported (not read from disk) so the bundler inlines them and they
 * are guaranteed present in the serverless function, regardless of what the
 * file tracer decides to include.
 *
 * Regenerate with `npm run snapshot` before deploying — this is the floor the
 * site falls back to, so a stale floor means stale prices on cold starts.
 */

export const SNAPSHOT_BOARD = boardSnapshot as unknown as Board;
export const SNAPSHOT_TRANSFERS = transfersSnapshot as unknown as Transfer[];

/** How old the committed snapshot is, in hours. */
export function snapshotAgeHours(): number {
  const generated = Date.parse(SNAPSHOT_BOARD.generatedAt);
  if (Number.isNaN(generated)) return Number.POSITIVE_INFINITY;
  return (Date.now() - generated) / 3_600_000;
}
