import Link from 'next/link';
import { COMPETITIONS } from '@/lib/competitions';
import type { CompetitionId } from '@/lib/types';

export function CompetitionFilter({
  active,
  counts,
}: {
  active: CompetitionId | 'all';
  counts: Map<CompetitionId, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/fixtures"
        className={`chip px-3.5 py-1.5 text-sm font-semibold ${active === 'all' ? 'chip-active' : ''}`}
        style={
          active === 'all'
            ? { background: 'linear-gradient(96deg, var(--accent), var(--accent-2))' }
            : undefined
        }
      >
        All
      </Link>

      {COMPETITIONS.map((c) => {
        const count = counts.get(c.id) ?? 0;
        const isActive = active === c.id;
        const empty = count === 0;

        return (
          <Link
            key={c.id}
            href={`/fixtures?competition=${c.id}`}
            className={`chip px-3.5 py-1.5 text-sm font-semibold ${isActive ? 'chip-active' : ''}`}
            style={{
              ...(isActive
                ? { background: c.accent, color: '#fff', boxShadow: `0 0 20px -4px ${c.accent}` }
                : {}),
              opacity: empty && !isActive ? 0.4 : 1,
            }}
            title={empty ? `${c.name} — no fixtures available` : `${c.name} — ${count} fixtures`}
          >
            {c.shortName}
            {count > 0 ? (
              <span className="ml-1.5 text-xs font-bold opacity-70">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
