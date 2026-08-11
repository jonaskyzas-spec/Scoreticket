import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a demo — Scoreticket',
  description:
    'Book a 30-minute demo of Scoreticket. Got an idea, or want to partner with us? Pick a slot straight from our calendar.',
};

/**
 * Book a demo.
 *
 * Reached from the bouncing pill in the header, so it's available from every
 * page rather than only the homepage.
 *
 * Booking goes to Calendly, where visitors pick a slot from real availability.
 * `NEXT_PUBLIC_DEMO_BOOKING_URL` overrides it without a code change if the
 * scheduling link ever moves.
 */

const CONTACT_EMAIL = 'info@scoreticket.eu';
const CALENDLY_URL = 'https://calendly.com/jonaskyzas/30min';

function bookingUrl(): string {
  return process.env.NEXT_PUBLIC_DEMO_BOOKING_URL || CALENDLY_URL;
}

const POINTS = [
  {
    title: 'Got an idea?',
    body: 'A competition we should cover, a feature you keep wishing existed, a smarter way to surface prices — we would genuinely like to hear it.',
  },
  {
    title: 'Want to partner with us?',
    body: 'If you run a ticket marketplace, we can show you exactly how your inventory would appear alongside everyone else — and talk affiliate feeds.',
  },
];

const AGENDA = [
  ['5 min', 'What you’re trying to solve'],
  ['15 min', 'Live walkthrough — fixtures, price comparison, coverage'],
  ['10 min', 'Your questions, and what a partnership could look like'],
];

export default function DemoPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="hero-shell sweep rise">
        <div
          className="hero-media"
          style={{
            background: `
              radial-gradient(60% 90% at 18% 8%, rgba(52, 245, 197, 0.3), transparent 68%),
              radial-gradient(55% 85% at 84% 92%, rgba(176, 107, 255, 0.24), transparent 68%),
              linear-gradient(140deg, #071b18, #0a1322 55%, #131b31)
            `,
          }}
        />
        <div className="hero-scrim" />

        <div className="relative z-10 flex flex-col gap-5 p-6 sm:p-10">
          <div className="flex items-center gap-2.5">
            <span
              className="pulse-dot inline-block size-2 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            <span className="eyebrow">Let&rsquo;s talk</span>
          </div>

          <h1 className="display max-w-3xl text-3xl sm:text-5xl">
            Got an interesting idea, or want to{' '}
            <span className="gradient-text">partner with us?</span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed muted sm:text-lg">
            Book a 30-minute demo straight into our calendar. No sales script — we&rsquo;ll show you
            how Scoreticket pulls live ticket prices from the major resale marketplaces, and you
            tell us what you&rsquo;re after.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <a
              href={bookingUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-glow inline-flex items-center gap-2 px-6 py-3 text-sm"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Let&rsquo;s talk
            </a>

            <span className="text-xs muted">
              Prefer email?{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="accent hover:underline">
                {CONTACT_EMAIL}
              </a>
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {POINTS.map((p) => (
          <div key={p.title} className="panel panel-hover p-5">
            <h2 className="text-sm font-bold accent">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed muted">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="panel p-6 sm:p-8">
        <h2 className="display text-xl">What the 30 minutes looks like</h2>
        <ol className="mt-5 flex flex-col gap-4">
          {AGENDA.map(([time, what]) => (
            <li key={what} className="flex items-start gap-4">
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
                style={{ background: 'rgba(52, 245, 197, 0.12)', color: 'var(--accent)' }}
              >
                {time}
              </span>
              <span className="text-sm leading-relaxed">{what}</span>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-xs leading-relaxed muted">
          Nothing to prepare, and no obligation — if it turns out we&rsquo;re not a fit we&rsquo;ll
          say so on the call.
        </p>
      </section>
    </div>
  );
}
