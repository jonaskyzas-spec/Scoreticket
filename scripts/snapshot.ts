/**
 * Write the current board and transfer data to `data/` as a committed snapshot.
 *
 *   npm run snapshot
 *
 * Why this exists: on Vercel the runtime cache lives in `/tmp`, which is empty
 * on every cold start. Without a bundled fallback, the first visitor to hit a
 * cold instance would trigger a full scrape inside their page request — a
 * minute of waiting, and a burst of traffic at the ticket sites every time
 * Vercel spins up a new instance.
 *
 * The snapshot is the floor: a cold instance serves this instantly, and the
 * cron refresh replaces it with live data. Re-run this before deploying so the
 * committed floor isn't months stale.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { refreshBoard } from '../src/lib/board';
import { refreshTransfers } from '../src/lib/transfers';

async function main(): Promise<void> {
  const dir = path.join(process.cwd(), 'data');
  await fs.mkdir(dir, { recursive: true });

  process.stdout.write('Building board… ');
  const board = await refreshBoard();
  await fs.writeFile(
    path.join(dir, 'board-snapshot.json'),
    JSON.stringify(board),
    'utf8',
  );
  console.log(`${board.matches.length} matches`);

  process.stdout.write('Building transfers… ');
  let transferCount = 0;
  try {
    const transfers = await refreshTransfers();
    await fs.writeFile(
      path.join(dir, 'transfers-snapshot.json'),
      JSON.stringify(transfers),
      'utf8',
    );
    transferCount = transfers.length;
  } catch (err) {
    // The transfer scrape refuses to produce an empty board; keep whatever
    // snapshot is already committed rather than overwriting it with nothing.
    console.log(`kept existing (${err instanceof Error ? err.message : String(err)})`);
  }
  if (transferCount) console.log(`${transferCount} transfers`);

  console.log('\nSnapshot written to data/. Commit it so deploys have a floor.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
