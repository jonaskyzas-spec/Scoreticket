/* eslint-disable @next/next/no-img-element */
import type { Transfer } from '@/lib/transfers/types';

/**
 * Transfer market ticker.
 *
 * Big-money moves (€40m+) involving recognisable clubs, newest stories first:
 * pending deals lead, then confirmed ones by fee. Laid out as a horizontal rail
 * so it reads like a ticker at the top of the page without pushing the rest of
 * the content down.
 *
 * Confirmed and pending are visually distinct on purpose — green tick vs amber
 * clock, and pending fees are prefixed "~" and labelled as reported. A rumour
 * rendered identically to a completed deal is how a site ends up asserting
 * things that aren't true.
 */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** One colour per state, reused by the badge, the fee and the arrow. */
function statusColour(status: Transfer['status']): string {
  if (status === 'confirmed') return 'var(--ok)';
  if (status === 'denied') return 'var(--danger)';
  return 'var(--warn)';
}

function statusTint(status: Transfer['status']): string {
  if (status === 'confirmed') return 'var(--ok-dim)';
  if (status === 'denied') return 'var(--danger-dim)';
  return 'var(--warn-dim)';
}

function StatusBadge({ status }: { status: Transfer['status'] }) {
  const colour = statusColour(status);

  const icon =
    status === 'confirmed' ? (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ) : status === 'denied' ? (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    ) : (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{
        background: statusTint(status),
        color: colour,
        border: `1px solid color-mix(in srgb, ${colour} 40%, transparent)`,
      }}
    >
      {icon}
      {status === 'confirmed' ? 'Confirmed' : status === 'denied' ? 'Denied' : 'Pending'}
    </span>
  );
}

function TransferCard({ t }: { t: Transfer }) {
  return (
    <article
      className="panel panel-hover flex w-[268px] shrink-0 flex-col gap-3 p-4"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="flex items-start justify-between gap-2">
        <StatusBadge status={t.status} />
        <span
          className="display text-lg"
          style={{
            color: t.status === 'confirmed' ? 'var(--accent)' : statusColour(t.status),
            // A denied fee was never real — strike it so it can't be skim-read
            // as a live price.
            textDecoration: t.status === 'denied' ? 'line-through' : undefined,
            opacity: t.status === 'denied' ? 0.75 : 1,
          }}
        >
          {t.feeLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {t.photoUrl ? (
          <img
            src={t.photoUrl}
            alt={t.player}
            loading="lazy"
            className="size-14 shrink-0 rounded-full object-cover"
            style={{ border: '1px solid var(--border-strong)' }}
          />
        ) : (
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-sm font-black"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--muted)' }}
          >
            {initials(t.player)}
          </span>
        )}

        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{t.player}</span>
          {t.note ? (
            <span className="block truncate text-[11px] muted">{t.note}</span>
          ) : t.date ? (
            <span className="block text-[11px] muted">
              {new Date(`${t.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}
            </span>
          ) : null}
        </span>
      </div>

      {/* from → to */}
      <div
        className="flex items-center gap-2 border-t pt-3 text-xs hairline"
        style={{ borderTopWidth: 1 }}
      >
        <span className="min-w-0 flex-1 truncate muted" title={t.fromClub}>
          {t.fromClub}
        </span>
        <svg
          width="18"
          height="12"
          viewBox="0 0 24 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          style={{ color: statusColour(t.status) }}
          aria-label="to"
        >
          <path d="M1 8h20M15 2l6 6-6 6" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-right font-semibold" title={t.toClub}>
          {t.toClub}
        </span>
      </div>
    </article>
  );
}

export function TransferMarket({ transfers }: { transfers: Transfer[] }) {
  if (transfers.length === 0) return null;

  const pending = transfers.filter((t) => t.status === 'pending').length;
  const denied = transfers.filter((t) => t.status === 'denied').length;
  const confirmed = transfers.length - pending - denied;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Transfer market</span>
          <h2 className="display mt-1 text-2xl">Big money moves</h2>
        </div>
        <p className="text-xs muted">
          €40m+ deals · {confirmed} confirmed
          {pending > 0 ? ` · ${pending} pending` : ''}
          {denied > 0 ? ` · ${denied} denied` : ''}
        </p>
      </div>

      <div
        className="tx-rail -mx-4 flex gap-4 overflow-x-auto px-4 pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {transfers.map((t) => (
          <TransferCard key={t.id} t={t} />
        ))}
      </div>

    </section>
  );
}
