/* eslint-disable @next/next/no-img-element */

/**
 * Club badge with a lettered fallback.
 *
 * Badges come from football-data.org (SVG) when an API key is configured, and
 * otherwise from TheSportsDB (transparent PNG). Coverage is good but never
 * total — cup qualifiers and smaller clubs fall through — so every badge
 * degrades to the club's initials rather than a broken image.
 *
 * `contain` sizes the badge to fit a box of `size` on its longest edge instead
 * of forcing a square. TheSportsDB badges vary a lot in aspect ratio, and
 * squaring them makes tall crests look shrunken next to wide ones.
 */
export function Crest({
  src,
  name,
  size = 28,
  contain = false,
}: {
  src?: string | null;
  name: string;
  size?: number;
  contain?: boolean;
}) {
  const initials = name
    .replace(/\b(FC|CF|AFC|SC|AC|SS|US|CD|SV|BK|IF)\b/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (!src) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full font-black"
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, size * 0.34),
          background: 'rgba(255,255,255,0.07)',
          color: 'var(--muted)',
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="shrink-0 object-contain"
      style={
        contain
          ? { maxWidth: size, maxHeight: size }
          : { width: size, height: size }
      }
    />
  );
}
