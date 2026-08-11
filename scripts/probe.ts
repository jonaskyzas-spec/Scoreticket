/**
 * Scraper probe.
 *
 * Hits one ticket site (or all of them) for one competition and prints what
 * came back. No football-data.org key required — this exercises only the
 * scraping half, which is the half that breaks when a site changes its markup.
 *
 *   npm run probe                      # every source, Premier League
 *   npm run probe -- seatpick          # one source
 *   npm run probe -- seatpick la-liga  # one source, one competition
 *   npm run probe -- all champions-league
 */

import { COMPETITIONS, getCompetition } from '../src/lib/competitions';
import { SOURCES } from '../src/lib/sources';
import { BlockedError } from '../src/lib/sources/http';

const [sourceArg = 'all', compArg = 'premier-league'] = process.argv.slice(2);

async function main(): Promise<void> {
  const comp = getCompetition(compArg);
  if (!comp) {
    console.error(`Unknown competition "${compArg}".`);
    console.error(`Try one of: ${COMPETITIONS.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  const targets =
    sourceArg === 'all' ? SOURCES : SOURCES.filter((s) => s.id === sourceArg);

  if (targets.length === 0) {
    console.error(`Unknown source "${sourceArg}".`);
    console.error(`Try one of: all, ${SOURCES.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nProbing ${targets.length} source(s) for ${comp.name}\n`);

  for (const source of targets) {
    const started = Date.now();
    process.stdout.write(`${source.name.padEnd(22)} `);

    try {
      const events = await source.listEvents(comp);
      const priced = events.filter((e) => e.fromPrice != null);
      console.log(
        `OK   ${String(events.length).padStart(3)} events, ` +
          `${String(priced.length).padStart(3)} priced  (${Date.now() - started}ms)`,
      );

      for (const e of events.slice(0, 3)) {
        const price =
          e.fromPrice != null ? `${e.currency ?? '?'} ${e.fromPrice}` : 'no price on listing';
        console.log(`    · ${e.title.padEnd(44).slice(0, 44)} ${price}`);
      }
      if (events.length > 3) console.log(`    · … ${events.length - 3} more`);
    } catch (err) {
      const tag = err instanceof BlockedError ? 'BLOCKED' : 'FAIL';
      console.log(`${tag} ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
