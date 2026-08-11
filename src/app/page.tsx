import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { TransferMarket } from '@/components/TransferMarket';
import { WelcomeBackdrop } from '@/components/WelcomeBackdrop';
import { getBoard } from '@/lib/board';
import { COMPETITIONS } from '@/lib/competitions';
import { getTransfers } from '@/lib/transfers';

export const revalidate = 900;

/**
 * Welcome page.
 *
 * Deliberately not the fixture list — that lives at /fixtures. This is the
 * front door: what the site is, which competitions it covers, and one obvious
 * way in. Stats are read from the real board so the numbers on the landing page
 * are never stale marketing claims.
 */

const FEATURES = [
  {
    title: 'Every price, side by side',
    body: 'We check the major resale marketplaces for the same fixture and put their prices in one table, so the cheapest is obvious at a glance.',
    icon: (
      <>
        <path d="M4 18V9M10 18V5M16 18v-6M22 18h-20" />
      </>
    ),
  },
  {
    title: 'The whole calendar',
    body: 'Kickoff times, venues and dates for Europe’s biggest competitions — from Premier League weekends to Champions League nights.',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
  {
    title: 'Kept fresh',
    body: 'Prices are re-checked every couple of hours. When a match sells out we say so — and the page updates itself the moment tickets reappear.',
    icon: (
      <>
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </>
    ),
  },
];

export default async function WelcomePage() {
  // Fetched together so a slow Wikipedia lookup doesn't serialise behind the board.
  const [board, transfers] = await Promise.all([getBoard(), getTransfers()]);
  const upcoming = board.matches.filter(
    (m) => m.match.status === 'SCHEDULED' || m.match.status === 'TIMED',
  );

  const covered = new Set(upcoming.map((m) => m.match.competitionId));
  const priced = upcoming.filter((m) => m.best != null).length;

  return (
    <div className="flex flex-col gap-10">
      {/*
        Page-wide ambient backdrop. Lives outside any section so it runs behind
        the whole page — the pitch animation stays exclusive to /fixtures.
      */}
      <WelcomeBackdrop />

      {/* ---------- transfer market ---------- */}
      <TransferMarket transfers={transfers} />

      {/* ---------- welcome ---------- */}
      <section className="rise">
        <div className="flex flex-col items-center gap-6 px-6 py-8 text-center sm:py-12">
          <Logo size={68} />

          <div className="flex flex-col gap-4">
            <h1 className="display text-4xl sm:text-6xl">
              Welcome to <span className="gradient-text">Scoreticket</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-relaxed muted sm:text-lg">
              Football fixtures and ticket prices, compared across the biggest marketplaces in one
              place. Find your match, see what a seat actually costs, and go straight to the
              cheapest seller.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link href="/fixtures" className="btn-glow px-7 py-3.5 text-base">
              Browse fixtures
            </Link>
            <Link
              href="/demo"
              className="chip px-6 py-3.5 text-sm font-semibold"
              style={{ color: 'var(--text)' }}
            >
              Book a demo
            </Link>
          </div>

          <dl className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 pt-6">
            {[
              { v: upcoming.length, l: 'fixtures tracked' },
              { v: priced, l: 'with live prices' },
              { v: covered.size, l: 'competitions' },
            ].map((s) => (
              <div key={s.l}>
                <dt className="eyebrow">{s.l}</dt>
                <dd className="display text-3xl tabular-nums">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- what you get ---------- */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <span className="eyebrow">Why Scoreticket</span>
          <h2 className="display text-2xl sm:text-3xl">Stop opening six tabs</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel panel-hover flex flex-col gap-3 p-6">
              <span
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ background: 'rgba(52,245,197,0.1)', color: 'var(--accent)' }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {f.icon}
                </svg>
              </span>
              <h3 className="display text-base">{f.title}</h3>
              <p className="text-sm leading-relaxed muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- competitions ---------- */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <span className="eyebrow">Coverage</span>
          <h2 className="display text-2xl sm:text-3xl">The competitions that matter</h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {COMPETITIONS.map((c) => {
            const live = covered.has(c.id);
            return (
              <Link
                key={c.id}
                href={`/fixtures?competition=${c.id}`}
                className="panel panel-hover flex items-center gap-3 px-4 py-3"
                style={{ opacity: live ? 1 : 0.45 }}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: c.accent }}
                />
                <span className="text-sm font-semibold">{c.name}</span>
                {!live ? <span className="text-[10px] muted">soon</span> : null}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------- closing call to action ---------- */}
      <section className="panel overflow-hidden">
        <div
          className="h-1 w-full"
          style={{
            background:
              'linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3))',
          }}
        />
        <div className="flex flex-col items-center gap-5 px-6 py-14 text-center">
          <h2 className="display text-2xl sm:text-4xl">
            Find your <span className="gradient-text">next match</span>
          </h2>
          <p className="max-w-xl text-sm leading-relaxed muted sm:text-base">
            {upcoming.length} fixtures are on the board right now, {priced} of them with live
            prices.
          </p>
          <Link href="/fixtures" className="btn-glow px-7 py-3.5 text-base">
            Browse fixtures
          </Link>
        </div>
      </section>
    </div>
  );
}
