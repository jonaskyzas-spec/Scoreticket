import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { PaymentMarks } from '@/components/PaymentMarks';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scoreticket — football fixtures & ticket prices compared',
  description:
    'Compare football ticket prices across the major resale marketplaces, with fixtures, kickoff times and venues for Europe’s biggest competitions.',
};

/**
 * Public navigation. `/status` is deliberately absent — it's an internal
 * diagnostics view (blocked scrapers, API-key state, raw error strings) that
 * would only confuse a visitor. The route still works if you go to it directly.
 */
const NAV = [
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/transfers', label: 'Transfer market' },
  { href: '/contact', label: 'Contact us' },
];

/** Primary public address. Topic-specific ones live on the contact page. */
const CONTACT_EMAIL = 'info@scoreticket.eu';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header
          className="sticky top-0 z-30 border-b backdrop-blur-xl hairline"
          style={{
            borderBottomWidth: 1,
            background: 'color-mix(in srgb, var(--bg) 78%, transparent)',
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={32} />
              <span className="display text-lg">Scoreticket</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm sm:gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-white/5 sm:px-3"
                >
                  {item.label}
                </Link>
              ))}

              {/* Book a demo sits in the nav so it's reachable from every page,
                  and bounces to pull the eye. The halo is on the wrapper so the
                  bounce transform doesn't drag it around. */}
              <Link
                href="/demo"
                className="demo-halo relative ml-1 inline-flex shrink-0 rounded-full"
              >
                <span
                  className="bouncy inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold sm:px-4"
                  style={{
                    background: 'linear-gradient(96deg, var(--accent), var(--accent-2))',
                    color: '#04121a',
                    boxShadow: '0 8px 22px -10px rgba(52, 245, 197, 0.85)',
                  }}
                >
                  <span aria-hidden>⚡</span>
                  <span className="hidden sm:inline">Book a demo</span>
                  <span className="sm:hidden">Demo</span>
                </span>
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>

        <footer className="mt-20 border-t hairline" style={{ borderTopWidth: 1 }}>
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <span className="display text-base">Scoreticket</span>
              <p className="text-xs leading-relaxed muted">
                Fixtures and resale ticket prices for Europe&rsquo;s major football competitions,
                compared in one place.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Site</span>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-sm muted hover:underline">
                  {item.label}
                </Link>
              ))}
              <Link href="/demo" className="text-sm muted hover:underline">
                Book a demo
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Get in touch</span>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              <Link href="/contact" className="text-sm muted hover:underline">
                Contact form
              </Link>
            </div>
          </div>

          <div
            className="border-t px-4 py-6 text-center text-[11px] leading-relaxed muted hairline"
            style={{ borderTopWidth: 1 }}
          >
            <p className="mx-auto max-w-3xl">
              Scoreticket is an independent price comparison site and is not affiliated with any
              league, club or ticket marketplace. Prices are indicative &ldquo;from&rdquo; figures
              collected from third-party resale marketplaces and typically exclude booking fees and
              delivery — always confirm the final price on the seller&rsquo;s site.
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider">
                Payment methods accepted by our partner sites
              </span>
              <PaymentMarks />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
