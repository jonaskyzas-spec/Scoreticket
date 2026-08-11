import type { Metadata } from 'next';
import { CompetitionFilter } from '@/components/CompetitionFilter';
import { Hero } from '@/components/Hero';
import { MatchCard } from '@/components/MatchCard';
import { getBoard } from '@/lib/board';
import type { CompetitionId, MatchWithPrices } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Fixtures & ticket prices — Scoreticket',
  description:
    'Every upcoming fixture across Europe’s biggest competitions, with ticket prices compared side by side across the major resale marketplaces.',
};

export const revalidate = 900;

function formatDay(key: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  if (key === today) return 'Today';
  if (key === tomorrow) return 'Tomorrow';

  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function groupByDay(entries: MatchWithPrices[]): [string, MatchWithPrices[]][] {
  const map = new Map<string, MatchWithPrices[]>();
  for (const e of entries) {
    const key = e.match.kickoff.slice(0, 10);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const { competition } = await searchParams;
  const board = await getBoard();

  const upcoming = board.matches.filter(
    (m) => m.match.status === 'SCHEDULED' || m.match.status === 'TIMED',
  );

  const counts = new Map<CompetitionId, number>();
  for (const m of upcoming) {
    counts.set(m.match.competitionId, (counts.get(m.match.competitionId) ?? 0) + 1);
  }

  const active: CompetitionId | 'all' = (competition as CompetitionId | undefined) ?? 'all';
  const filtered =
    active === 'all' ? upcoming : upcoming.filter((m) => m.match.competitionId === active);

  const days = groupByDay(filtered);

  return (
    <div className="flex flex-col gap-10">
      <Hero
        fixtureCount={upcoming.length}
        pricedCount={upcoming.filter((m) => m.best != null).length}
        sourceCount={board.sourceReports.length}
      />

      <section id="fixtures" className="flex scroll-mt-20 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Fixtures</span>
            <h2 className="display mt-1 text-2xl">What&rsquo;s coming up</h2>
          </div>
          <p className="text-xs muted">
            Updated {new Date(board.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
          </p>
        </div>

        <CompetitionFilter active={active} counts={counts} />
      </section>

      {days.length === 0 ? (
        <p className="panel p-10 text-center muted">
          No upcoming fixtures to show. Run <code>npm run refresh</code> to fetch the latest data.
        </p>
      ) : (
        days.map(([day, entries]) => (
          <section key={day} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <h2 className="display shrink-0 text-lg">{formatDay(day)}</h2>
              <span
                className="h-px flex-1"
                style={{
                  background:
                    'linear-gradient(90deg, var(--border-strong), transparent)',
                }}
              />
              <span className="shrink-0 text-xs muted">{entries.length} matches</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((e) => (
                <MatchCard key={e.match.id} entry={e} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
