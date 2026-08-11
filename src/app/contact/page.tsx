import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact us — Scoreticket',
  description:
    'Get in touch with the Scoreticket team about pricing data, partnerships, press or a problem with the site.',
};

/**
 * Contact page.
 *
 * The form posts to a plain `mailto:` action rather than an API route on
 * purpose: there's no mail provider wired up yet, and a form that silently
 * swallows messages is worse than one that visibly opens the user's mail
 * client. Swap `action` for a POST to /api/contact once a provider (Resend,
 * Postmark, Formspree…) is configured.
 */

/** Single public address — every enquiry, whatever the topic, goes here. */
const CONTACT_EMAIL = 'info@scoreticket.eu';

const REASONS = [
  {
    title: 'Something looks wrong',
    body: 'A price that doesn’t match the seller, a fixture in the wrong place, a missing match — tell us which game and we’ll dig in.',
  },
  {
    title: 'Partnerships & affiliates',
    body: 'If you run a ticket marketplace and want your inventory included, or want to talk about an affiliate feed, this is the one.',
  },
  {
    title: 'Press & media',
    body: 'Data requests, pricing trends across competitions, or comment on the resale market.',
  },
];

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <span className="eyebrow">Get in touch</span>
        <h1 className="display text-3xl sm:text-5xl">
          Talk to <span className="gradient-text">us</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed muted">
          Questions about a price, a fixture that looks off, or a marketplace you&rsquo;d like us to
          cover — we read everything. Most messages get a reply within two working days.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel p-6">
          <h2 className="display text-xl">Send a message</h2>

          <form
            action={`mailto:${CONTACT_EMAIL}`}
            method="post"
            encType="text/plain"
            className="mt-5 flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold muted">Your name</span>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Alex Moreno"
                  className="chip px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  style={{ color: 'var(--text)' }}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold muted">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="chip px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  style={{ color: 'var(--text)' }}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold muted">Subject</span>
              <select
                name="subject"
                className="chip px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                style={{ color: 'var(--text)', background: 'var(--panel-solid)' }}
              >
                <option>A price or fixture looks wrong</option>
                <option>Partnership or affiliate enquiry</option>
                <option>Press or media request</option>
                <option>Something else</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold muted">Message</span>
              <textarea
                name="message"
                required
                rows={6}
                placeholder="Tell us which match or which site, and what you were expecting to see…"
                className="chip resize-y px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                style={{ color: 'var(--text)' }}
              />
            </label>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button type="submit" className="btn-glow px-6 py-2.5 text-sm">
                Send message
              </button>
              <span className="text-xs muted">Opens in your email app.</span>
            </div>
          </form>
        </section>

        <div className="flex flex-col gap-4">
          {REASONS.map((r) => (
            <section key={r.title} className="panel panel-hover p-5">
              <h3 className="display text-base">{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed muted">{r.body}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-3 inline-block text-sm font-semibold accent hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </section>
          ))}

          <section className="panel p-5">
            <h3 className="display text-base">Before you write</h3>
            <p className="mt-1.5 text-sm leading-relaxed muted">
              We can&rsquo;t help with orders, refunds or delivery — we don&rsquo;t sell tickets and
              never handle payments. For anything about a booking, contact the marketplace you
              bought from directly.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
