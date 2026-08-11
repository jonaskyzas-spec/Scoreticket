import { getBoard } from '@/lib/board';
import { SOURCE_BY_ID } from '@/lib/sources';
import type { SourceHealth } from '@/lib/types';

export const revalidate = 300;

const HEALTH_COLOUR: Record<SourceHealth, string> = {
  ok: '#12b76a',
  degraded: '#f79009',
  blocked: '#f04438',
  disabled: '#98a2b3',
};

export default async function StatusPage() {
  const board = await getBoard();

  const gated = board.fixtureReports.filter((r) => r.skipped === 'requires-paid-tier');
  const noApiKey = board.fixtureSource === 'ticket-sites';
  const blocked = board.sourceStatuses.filter(
    (s) => s.health === 'blocked' || s.health === 'disabled',
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <span className="eyebrow">Diagnostics</span>
        <h1 className="display mt-1 text-3xl">Source status</h1>
        <p className="mt-2 text-sm muted">
          Where the data comes from and what&rsquo;s currently unavailable. Blocked sources are
          skipped and retried automatically on the next refresh cycle.
        </p>
      </section>

      {(noApiKey || gated.length > 0 || blocked.length > 0) && (
        <section className="panel p-5 text-sm">
          <h2 className="display text-base">Coverage notes</h2>
          <ul className="mt-3 flex flex-col gap-2 muted">
            {noApiKey && (
              <li>
                <strong style={{ color: 'var(--text)' }}>
                  Calendar is built from ticket-site listings.
                </strong>{' '}
                No <code>FOOTBALL_DATA_API_KEY</code> is configured, so fixtures come from the
                ticket sites themselves — real, but limited to games being resold, and without club
                crests. Add a free key for full fixture coverage.
              </li>
            )}
            {gated.length > 0 && (
              <li>
                <strong style={{ color: 'var(--text)' }}>
                  {gated.map((g) => g.competitionName).join(', ')}
                </strong>{' '}
                need a paid football-data.org plan — not available on the free tier.
              </li>
            )}
            {blocked.length > 0 && (
              <li>
                Currently unavailable:{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {blocked.map((s) => s.sourceId).join(', ')}
                </strong>{' '}
                — retried automatically on the next refresh.
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="panel overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left muted" style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="px-4 py-2.5 font-medium">Ticket site</th>
              <th className="px-4 py-2.5 font-medium">Health</th>
              <th className="px-4 py-2.5 font-medium">Events</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last success</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last error</th>
            </tr>
          </thead>
          <tbody>
            {board.sourceStatuses.map((s) => {
              const report = board.sourceReports.find((r) => r.sourceId === s.sourceId);
              const source = SOURCE_BY_ID.get(s.sourceId);
              return (
                <tr key={s.sourceId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-medium">
                    {source?.name ?? s.sourceId}
                    {source && !source.pricesOnListing ? (
                      <span className="ml-2 text-[10px] muted">links only</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span
                        aria-hidden
                        className="inline-block size-2 rounded-full"
                        style={{ background: HEALTH_COLOUR[s.health] }}
                      />
                      {s.health}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{report?.events ?? 0}</td>
                  <td className="hidden px-4 py-3 muted md:table-cell">
                    {s.lastSuccessAt
                      ? new Date(s.lastSuccessAt).toLocaleString('en-GB', { timeZone: 'UTC' })
                      : 'never'}
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 muted lg:table-cell">
                    {s.lastError ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Fixture coverage</h2>
        <div className="panel overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left muted" style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-2.5 font-medium">Competition</th>
                <th className="px-4 py-2.5 font-medium">Fixtures</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {board.fixtureReports.map((r) => (
                <tr key={r.competitionId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-medium">{r.competitionName}</td>
                  <td className="px-4 py-3 tabular-nums">{r.matches}</td>
                  <td className="px-4 py-3 muted">
                    {r.skipped === 'requires-paid-tier'
                      ? 'Needs paid football-data.org plan'
                      : r.ok
                        ? 'OK'
                        : (r.error?.slice(0, 90) ?? 'failed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
