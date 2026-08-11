/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { COMPETITION_BY_ID } from '@/lib/competitions';
import { formatPrice } from '@/lib/fx';
import type { MatchWithPrices, Team } from '@/lib/types';

function kickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/** Initials for clubs with no badge, so both sides always have a mark. */
function initials(name: string): string {
  return name
    .replace(/\b(FC|CF|AFC|SC|AC|SS|US|CD|SV|BK|IF)\b/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * One side of the face-off: badge over club name.
 *
 * Badges arrive from TheSportsDB as transparent PNGs at wildly different aspect
 * ratios — some tall, some wide. A fixed box with `object-contain` keeps every
 * pairing optically balanced instead of letting one club tower over the other.
 */
function Side({ team }: { team: Team }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
      <div className="flex size-16 items-center justify-center sm:size-[72px]">
        {team.crest ? (
          <img
            src={team.crest}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-full text-sm font-black sm:size-16"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--muted)' }}
          >
            {initials(team.name)}
          </span>
        )}
      </div>

      <span className="line-clamp-2 text-center text-[13px] font-bold leading-tight">
        {team.shortName ?? team.name}
      </span>
    </div>
  );
}

export function MatchCard({ entry }: { entry: MatchWithPrices }) {
  const { match, quotes, best } = entry;
  const comp = COMPETITION_BY_ID.get(match.competitionId);

  /*
   * `best` deliberately ignores travel packages, so a fixture sold only as a
   * ticket+hotel package would otherwise fall through to "SOLD OUT" despite
   * being on sale. Surface the package instead, clearly labelled.
   */
  const bestPackage = quotes
    .filter((q) => q.isPackage && q.fromPrice != null)
    .sort((a, b) => (a.fromPrice as number) - (b.fromPrice as number))[0];

  return (
    <Link
      href={`/match/${encodeURIComponent(match.id)}`}
      className="panel panel-hover group flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: comp?.accent ?? '#334155' }}
        >
          {comp?.shortName ?? match.competitionName}
        </span>
        <span className="text-[11px] font-semibold tabular-nums muted">
          {kickoffTime(match.kickoff)} UTC
        </span>
      </div>

      <div className="relative flex items-start gap-2 px-4 py-5">
        {/* Soft glow behind the crests so they sit on the dark panel properly. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-2 h-20 opacity-60 blur-2xl"
          style={{
            background: `radial-gradient(closest-side, ${comp?.accent ?? '#4d9fff'}55, transparent)`,
          }}
        />

        <Side team={match.home} />

        <span
          className="mt-5 shrink-0 text-xs font-black tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          VS
        </span>

        <Side team={match.away} />
      </div>

      <div
        className="mt-auto flex items-center justify-between gap-3 border-t px-4 py-3 hairline"
        style={{ borderTopWidth: 1 }}
      >
        <span className="min-w-0 truncate text-xs muted">{match.venue.name ?? 'Venue TBC'}</span>

        {best?.fromPrice != null ? (
          <span className="shrink-0 text-right leading-none">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider muted">
              from
            </span>
            <span className="display text-base accent">
              {formatPrice(best.fromPrice, best.currency)}
            </span>
          </span>
        ) : bestPackage ? (
          <span className="shrink-0 text-right leading-none">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider muted">
              pkg
            </span>
            <span className="display text-base" style={{ color: 'var(--accent-2)' }}>
              {formatPrice(bestPackage.fromPrice as number, bestPackage.currency)}
            </span>
          </span>
        ) : (
          /* No ticket price and no package — nothing purchasable anywhere. */
          <span
            className="shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider"
            style={{
              background: 'var(--danger-dim)',
              color: 'var(--danger)',
              border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
            }}
          >
            Sold out
          </span>
        )}
      </div>
    </Link>
  );
}
