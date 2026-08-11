/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { WelcomeBackdrop } from '@/components/WelcomeBackdrop';
import { getConfirmedTransfers } from '@/lib/transfers';
import type { Transfer } from '@/lib/transfers/types';

export const metadata: Metadata = {
  title: 'Transfer market — completed deals | Scoreticket',
  description:
    'Every completed €40m+ football transfer: which player, from which club to which, for how much.',
};

export const revalidate = 900;

/**
 * Transfer market — completed deals only.
 *
 * Rumours live on the homepage ticker; this page is strictly "transfers that
 * have been made", so nothing pending or denied appears. Mixing them would
 * defeat the point of a page you can trust at a glance.
 *
 * Data is merged from Wikipedia's transfer lists and BeSoccer's official feed,
 * deduped on surname + destination because the two disagree on name format,
 * club naming and even the fee for the same deal.
 */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Deterministic hue per player, so rows without a photo still feel distinct. */
function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function TransferRow({ t, rank }: { t: Transfer; rank: number }) {
  const hue = hueFor(t.player + t.toClub);

  return (
    <article className="panel panel-hover flex items-center gap-4 p-4">
      <span
        className="hidden w-7 shrink-0 text-center text-sm font-black tabular-nums sm:block"
        style={{ color: 'var(--muted)' }}
      >
        {rank}
      </span>

      {t.photoUrl ? (
        <img
          src={t.photoUrl}
          alt={t.player}
          loading="lazy"
          className="size-16 shrink-0 rounded-full object-cover"
          style={{ border: '1px solid var(--border-strong)' }}
        />
      ) : (
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full text-base font-black"
          style={{
            background: `linear-gradient(140deg, hsl(${hue} 60% 30% / 0.6), hsl(${(hue + 60) % 360} 60% 24% / 0.6))`,
            color: 'var(--text)',
          }}
        >
          {initials(t.player)}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate font-bold">{t.player}</span>

        <span className="flex items-center gap-2 text-xs">
          <span className="min-w-0 truncate muted" title={t.fromClub}>
            {t.fromClub}
          </span>
          <svg
            width="16"
            height="11"
            viewBox="0 0 24 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            style={{ color: 'var(--ok)' }}
            aria-label="to"
          >
            <path d="M1 8h20M15 2l6 6-6 6" />
          </svg>
          <span className="min-w-0 truncate font-semibold" title={t.toClub}>
            {t.toClub}
          </span>
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="display text-lg accent">{t.feeLabel}</span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={{
            background: 'var(--ok-dim)',
            color: 'var(--ok)',
            border: '1px solid color-mix(in srgb, var(--ok) 40%, transparent)',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Confirmed
        </span>
      </div>
    </article>
  );
}

export default async function TransfersPage() {
  const transfers = await getConfirmedTransfers();

  const total = transfers.reduce((sum, t) => sum + t.feeEurM, 0);
  const biggest = transfers[0];

  return (
    <div className="flex flex-col gap-8">
      {/* Same ambient treatment as the welcome page — this is a showcase page,
          not a utility screen like /fixtures. */}
      <WelcomeBackdrop />

      <section className="flex flex-col items-center gap-4 px-4 py-10 text-center sm:py-14">
        <span className="eyebrow">Transfer market</span>
        <h1 className="display text-4xl sm:text-6xl">
          Deals <span className="gradient-text">done</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed muted">
          Every completed transfer of €40m or more — who moved, from where to where, and what it
          cost. Confirmed deals only; rumours stay on the front page.
        </p>

        <dl className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 pt-4">
          <div>
            <dt className="eyebrow">deals listed</dt>
            <dd className="display text-3xl tabular-nums">{transfers.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">total spend</dt>
            <dd className="display text-3xl tabular-nums">€{total}m</dd>
          </div>
          {biggest ? (
            <div>
              <dt className="eyebrow">biggest</dt>
              <dd className="display text-3xl">{biggest.feeLabel}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {transfers.length === 0 ? (
        <p className="panel p-10 text-center muted">
          No completed transfers on the board right now.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          {transfers.map((t, i) => (
            <TransferRow key={t.id} t={t} rank={i + 1} />
          ))}
        </section>
      )}

      <p className="text-center text-[11px] muted">
        Fees as reported by the source and converted where needed, so figures can differ slightly
        between outlets for the same deal.
      </p>
    </div>
  );
}
