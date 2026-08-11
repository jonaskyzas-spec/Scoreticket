/**
 * Scoreticket mark — a ticket stub with a football punched out of it.
 *
 * Construction, since it isn't obvious from the paths:
 *   1. A mask paints the ticket body white (visible) and knocks out three
 *      black shapes: the two semicircular notches on the left/right edges that
 *      make a rectangle read as a *ticket*, and a circular hole in the middle.
 *   2. The gradient rect is drawn through that mask, giving a notched stub.
 *   3. The football is drawn back into the hole in the same gradient, with its
 *      panel and seams knocked out in the page background colour.
 *
 * The knockouts use `var(--bg)` rather than a hardcoded dark, so the mark
 * inverts correctly in light mode instead of showing near-black seams on a
 * white header.
 *
 * Sized in a 32×32 viewBox and kept deliberately chunky — at 32px the notches
 * and the pentagon are what carry the "ticket" and "football" reading, so both
 * need to survive being small.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Scoreticket"
      style={{ filter: 'drop-shadow(0 2px 8px rgba(52, 245, 197, 0.35))' }}
    >
      <defs>
        <linearGradient
          id="st-grad"
          x1="2"
          y1="5"
          x2="30"
          y2="27"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#34f5c5" />
          <stop offset="1" stopColor="#4d9fff" />
        </linearGradient>

        <mask id="st-mask">
          <rect width="32" height="32" fill="black" />
          {/* ticket body */}
          <rect x="1.5" y="6.5" width="29" height="19" rx="4.5" fill="white" />
          {/* edge notches — these are what make it read as a ticket */}
          <circle cx="1.5" cy="16" r="2.9" fill="black" />
          <circle cx="30.5" cy="16" r="2.9" fill="black" />
          {/* hole the football sits in */}
          <circle cx="16" cy="16" r="6.4" fill="black" />
        </mask>
      </defs>

      {/* notched ticket stub */}
      <rect width="32" height="32" fill="url(#st-grad)" mask="url(#st-mask)" />

      {/* football */}
      <circle cx="16" cy="16" r="5.2" fill="url(#st-grad)" />

      {/*
        Centre panel — a regular pentagon (circumradius 2.6), flat side down,
        the way a football panel actually sits.

        No seams. Two earlier attempts drew spokes from the pentagon's vertices
        towards the rim, and that geometry is a five-pointed star: at 32px the
        mark read as a sheriff's badge, not a ball. A solid panel inside a clean
        circle is the standard minimal football and stays unambiguous down to
        20px.
      */}
      <path d="M16 13.4 18.47 15.19 17.53 18.1 14.47 18.1 13.53 15.19Z" fill="var(--bg)" />

      {/* Three rim panels, hinted as arcs — enough to suggest the stitching
          pattern at large sizes without muddying the silhouette when small. */}
      <g stroke="var(--bg)" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M12.4 12.4a5.2 5.2 0 0 1 7.2 0" />
        <path d="M20.6 17.6a5.2 5.2 0 0 1-3 2.9" />
        <path d="M11.4 17.6a5.2 5.2 0 0 0 3 2.9" />
      </g>
    </svg>
  );
}
