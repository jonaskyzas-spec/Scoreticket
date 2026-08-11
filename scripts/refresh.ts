/**
 * Full refresh from the command line: fixtures + every ticket source.
 *
 *   npm run refresh
 *   npm run refresh:fixtures   # skip scraping, just update the calendar
 *
 * Writes into .cache/ so `npm run dev` picks the results up immediately.
 */

import { refreshBoard } from '../src/lib/board';
import { refreshFixtures } from '../src/lib/fixtures';
import { writeJson } from '../src/lib/cache';

const fixturesOnly = process.argv.includes('--fixtures-only');

async function main(): Promise<void> {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    console.error('FOOTBALL_DATA_API_KEY is not set — copy .env.example to .env.local first.');
    process.exit(1);
  }

  const started = Date.now();

  if (fixturesOnly) {
    const result = await refreshFixtures();
    await writeJson('fixtures-60d', result, 60 * 60 * 6);
    console.table(
      result.reports.map((r) => ({
        competition: r.competitionName,
        matches: r.matches,
        status: r.skipped ?? (r.ok ? 'ok' : (r.error?.slice(0, 60) ?? 'failed')),
      })),
    );
    console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }

  const board = await refreshBoard();

  console.log('\nFixtures');
  console.table(
    board.fixtureReports.map((r) => ({
      competition: r.competitionName,
      matches: r.matches,
      status: r.skipped ?? (r.ok ? 'ok' : (r.error?.slice(0, 60) ?? 'failed')),
    })),
  );

  console.log('\nTicket sources');
  console.table(
    board.sourceReports.map((r) => ({
      source: r.sourceName,
      events: r.events,
      ok: r.competitionsOk,
      failed: r.competitionsFailed,
      state: r.skipped ? 'skipped' : r.blocked ? 'blocked' : 'ok',
    })),
  );

  const quoted = board.matches.filter((m) => m.best != null).length;
  console.log(
    `\n${board.matches.length} fixtures, ${quoted} with at least one price ` +
      `(${((quoted / Math.max(board.matches.length, 1)) * 100).toFixed(0)}% coverage)`,
  );
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
