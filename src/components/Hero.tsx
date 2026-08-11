import { existsSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { PitchAnimation } from './PitchAnimation';

/**
 * Landing hero.
 *
 * Background is the animated SVG pitch by default. Drop any clip at
 * `public/hero.mp4` and it's used instead automatically — no code change, no
 * config. We check for the file at render time rather than always emitting a
 * <video> tag, so a missing file can't produce a broken element or a 404.
 *
 * Deliberately not shipping a stock football clip by default: match footage is
 * almost always rights-encumbered (leagues license it aggressively), and an
 * unlicensed clip on a public commercial site is a real risk. The animation
 * carries the same energy with none of that.
 */
export function Hero({
  fixtureCount,
  pricedCount,
  sourceCount,
}: {
  fixtureCount: number;
  pricedCount: number;
  sourceCount: number;
}) {
  const hasVideo = existsSync(path.join(process.cwd(), 'public', 'hero.mp4'));

  const stats = [
    { value: fixtureCount, label: 'fixtures tracked' },
    { value: pricedCount, label: 'with live prices' },
    { value: sourceCount, label: 'ticket sites compared' },
  ];

  return (
    <section className="hero-shell sweep rise">
      <PitchAnimation />

      {hasVideo ? (
        <video
          className="hero-media"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      ) : null}

      <div className="hero-scrim" />

      <div className="relative z-10 flex flex-col gap-6 px-6 py-12 sm:px-10 sm:py-16">
        <div className="flex items-center gap-2.5">
          <span
            className="pulse-dot inline-block size-2 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
          <span className="eyebrow">Live resale market</span>
        </div>

        <h1 className="display max-w-2xl text-4xl sm:text-6xl">
          Every match.
          <br />
          <span className="gradient-text">Every price.</span>
        </h1>

        <p className="max-w-xl text-base leading-relaxed muted sm:text-lg">
          Fixtures, kickoff times and venues across Europe&rsquo;s biggest competitions — with
          ticket prices compared side by side across the major resale marketplaces, so you never
          overpay.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="#fixtures" className="btn-glow px-5 py-2.5 text-sm">
            Browse fixtures
          </Link>
          <Link
            href="/contact"
            className="chip px-5 py-2.5 text-sm font-semibold"
            style={{ color: 'var(--text)' }}
          >
            Contact us
          </Link>
        </div>

        <dl className="flex flex-wrap gap-x-10 gap-y-4 pt-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="eyebrow">{s.label}</dt>
              <dd className="display text-3xl tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
