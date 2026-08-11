/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crest } from '@/components/Crest';
import { getBoard } from '@/lib/board';
import { COMPETITION_BY_ID } from '@/lib/competitions';
import { formatPrice, toEurApprox } from '@/lib/fx';
import { SOURCES } from '@/lib/sources';
import type { PriceQuote } from '@/lib/types';

export const revalidate = 900;

function sortQuotes(quotes: PriceQuote[]): PriceQuote[] {
  return [...quotes].sort((a, b) => {
    // Packages sit below all ticket rows — they're a different product, so
    // interleaving them by price would imply a comparison that isn't valid.
    if (!!a.isPackage !== !!b.isPackage) return a.isPackage ? 1 : -1;

    // Priced quotes first, cheapest to dearest; link-only quotes last.
    if (a.fromPrice == null && b.fromPrice == null) return 0;
    if (a.fromPrice == null) return 1;
    if (b.fromPrice == null) return -1;
    const ae = toEurApprox(a.fromPrice, a.currency) ?? Number.MAX_SAFE_INTEGER;
    const be = toEurApprox(b.fromPrice, b.currency) ?? Number.MAX_SAFE_INTEGER;
    return ae - be;
  });
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = decodeURIComponent(id);

  const board = await getBoard();
  const entry = board.matches.find((m) => m.match.id === matchId);
  if (!entry) notFound();

  const { match, quotes, best } = entry;
  const comp = COMPETITION_BY_ID.get(match.competitionId);
  const ordered = sortQuotes(quotes);
  const missing = SOURCES.filter((s) => !quotes.some((q) => q.sourceId === s.id));
  const kickoff = new Date(match.kickoff);

  // Packages are excluded from `best` on purpose, so "nothing available" means
  // no ticket price AND no package price.
  const hasPackage = quotes.some((q) => q.isPackage && q.fromPrice != null);
  const nothingAvailable = best?.fromPrice == null && !hasPackage;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/fixtures" className="text-sm muted transition hover:text-[var(--accent)]">
        ← All fixtures
      </Link>

      <section className="hero-shell rise">
        <div
          className="hero-media"
          style={{
            background: `
              radial-gradient(60% 90% at 20% 10%, ${comp?.accent ?? '#4d9fff'}44, transparent 70%),
              radial-gradient(60% 90% at 80% 90%, #b06bff33, transparent 70%),
              linear-gradient(140deg, #0a1322, #131b31)
            `,
          }}
        />
        <div className="hero-scrim" />

        <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-9">
          <span
            className="w-fit rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ background: comp?.accent ?? 'var(--muted)' }}
          >
            {match.competitionName}
            {match.matchday ? ` · Matchday ${match.matchday}` : ''}
          </span>

          {/* Badge-vs-badge face-off. Fixed-height boxes keep the two crests
              optically balanced regardless of their source aspect ratios. */}
          <div className="flex items-center justify-center gap-5 sm:gap-10">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div className="flex h-20 items-center justify-center sm:h-28">
                <Crest src={match.home.crest} name={match.home.name} size={112} contain />
              </div>
              <span className="display text-center text-lg sm:text-2xl">{match.home.name}</span>
            </div>

            <span className="display shrink-0 text-sm muted sm:text-lg">VS</span>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div className="flex h-20 items-center justify-center sm:h-28">
                <Crest src={match.away.crest} name={match.away.name} size={112} contain />
              </div>
              <span className="display text-center text-lg sm:text-2xl">{match.away.name}</span>
            </div>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Date</dt>
              <dd className="mt-1 font-semibold">
                {kickoff.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Kickoff</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {kickoff.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })}{' '}
                UTC
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Venue</dt>
              <dd className="mt-1 font-semibold">
                {match.venue.name ?? 'TBC'}
                {match.venue.city ? (
                  <span className="block text-xs font-normal muted">{match.venue.city}</span>
                ) : null}
              </dd>
            </div>
          </dl>

          {best?.fromPrice != null ? (
            <div className="flex items-baseline gap-2.5 pt-1">
              <span className="eyebrow">Cheapest right now</span>
              <span className="display text-3xl accent">
                {formatPrice(best.fromPrice, best.currency)}
              </span>
              <span className="text-xs muted">via {best.sourceName}</span>
            </div>
          ) : nothingAvailable ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span
                className="display rounded-lg px-3.5 py-2 text-lg uppercase tracking-wider"
                style={{
                  background: 'var(--danger-dim)',
                  color: 'var(--danger)',
                  border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
                }}
              >
                Sold out
              </span>
              <span className="text-sm muted">No tickets on sale right now</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-2.5 pt-1">
              <span className="eyebrow">Available as a package</span>
              <span className="text-sm muted">
                No bare tickets listed — see the ticket + hotel options below.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="display text-xl">Compare ticket prices</h2>

        {/*
          Sold-out notice. Shown whenever no source is quoting a purchasable
          price. Any link-only listings are still rendered below it, so a
          visitor can go and check for themselves rather than hitting a dead end.
        */}
        {nothingAvailable && (
          <div
            className="flex flex-col gap-2 rounded-xl p-5"
            style={{
              background: 'var(--danger-dim)',
              border: '1px solid color-mix(in srgb, var(--danger) 32%, transparent)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: 'var(--danger)' }}
              />
              <h3 className="display text-base" style={{ color: 'var(--danger)' }}>
                Sold out
              </h3>
            </div>
            <p className="text-sm leading-relaxed muted">
              None of the marketplaces we track are listing tickets for this match at the moment.
              We check again every couple of hours — <strong style={{ color: 'var(--text)' }}>this
              page updates automatically as soon as new tickets are released</strong>, so it&rsquo;s
              worth coming back closer to kickoff. Resale listings often reappear in the final week
              before a match.
            </p>
          </div>
        )}

        {ordered.length === 0 ? (
          <p className="panel p-8 text-sm muted">
            None of the ticket sites listed this fixture at the last refresh.
          </p>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-left eyebrow"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <th className="px-5 py-3">Site</th>
                    <th className="px-5 py-3">From</th>
                    <th className="hidden px-5 py-3 sm:table-cell">Price range</th>
                    <th className="hidden px-5 py-3 md:table-cell">Tickets</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((q) => {
                    const isBest = best?.sourceId === q.sourceId && q.fromPrice != null;
                    return (
                      <tr
                        key={q.sourceId}
                        style={{
                          borderTop: '1px solid var(--border)',
                          background: isBest ? 'rgba(52,245,197,0.05)' : undefined,
                        }}
                      >
                        <td className="px-5 py-4 font-semibold">
                          {q.sourceName}
                          {q.isPackage ? (
                            <span
                              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                              style={{
                                background: 'rgba(77,159,255,0.16)',
                                color: 'var(--accent-2)',
                              }}
                            >
                              Ticket + hotel
                            </span>
                          ) : null}
                          {isBest ? (
                            <span
                              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-black uppercase"
                              style={{ background: 'var(--accent)', color: '#04121a' }}
                            >
                              Cheapest
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          {q.fromPrice != null ? (
                            <span className="display text-lg">
                              {formatPrice(q.fromPrice, q.currency)}
                            </span>
                          ) : (
                            <span className="muted">See site</span>
                          )}
                        </td>
                        <td className="hidden px-5 py-4 muted tabular-nums sm:table-cell">
                          {q.fromPrice != null && q.highPrice != null
                            ? `${formatPrice(q.fromPrice, q.currency)} – ${formatPrice(q.highPrice, q.currency)}`
                            : '—'}
                        </td>
                        <td className="hidden px-5 py-4 muted tabular-nums md:table-cell">
                          {q.inventory != null ? q.inventory.toLocaleString('en-GB') : '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <a
                            href={q.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="btn-glow inline-block px-4 py-2 text-xs"
                          >
                            View tickets
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 text-xs muted">
          {missing.length > 0 ? (
            <p>Not listed at last refresh: {missing.map((s) => s.name).join(', ')}.</p>
          ) : null}
          <p>
            &ldquo;From&rdquo; prices are the cheapest listing each site advertised and typically
            exclude booking fees and delivery. Currencies differ by site and are shown as quoted.
          </p>
          {hasPackage ? (
            <p>
              Rows marked <strong style={{ color: 'var(--accent-2)' }}>Ticket + hotel</strong> are
              official travel packages including accommodation, not standalone tickets — they
              aren&rsquo;t counted when we work out the cheapest ticket.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
