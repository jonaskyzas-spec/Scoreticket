/**
 * Full-page ambient backdrop for the welcome page.
 *
 * Intentionally a different visual language from the tactics-board pitch used
 * on /fixtures — that animation stays exclusive to the fixtures section, so the
 * two pages don't feel like the same screen twice. This one is atmospheric
 * rather than diagrammatic: drifting aurora light, footballs floating up
 * through the viewport, and a slowly rotating contour ring.
 *
 * It's `position: fixed` behind the content, so it runs continuously behind
 * every section as you scroll instead of being boxed into a hero.
 *
 * No video: a stock-footage background was tried and dropped. Worth knowing if
 * it ever comes up again — real match footage (Champions League goals and the
 * like) is exclusively licensed by UEFA and the broadcasters and can't be used
 * here, and the free stock alternatives all read as generic.
 */

/** Deterministic layout — no Math.random, so server and client markup agree. */
const FLOATERS = [
  { left: '8%', size: 26, duration: 34, delay: 0 },
  { left: '22%', size: 16, duration: 44, delay: 7 },
  { left: '37%', size: 34, duration: 39, delay: 15 },
  { left: '54%', size: 20, duration: 48, delay: 3 },
  { left: '68%', size: 29, duration: 36, delay: 21 },
  { left: '82%', size: 18, duration: 42, delay: 11 },
  { left: '93%', size: 24, duration: 52, delay: 27 },
];

function Ball({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
      <path
        d="M16 8.5 21.2 12.3 19.2 18.4 12.8 18.4 10.8 12.3Z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WelcomeBackdrop() {
  return (
    <div className="welcome-bg" aria-hidden>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />

      <svg className="rings" viewBox="0 0 100 100" fill="none">
        <g stroke="var(--accent)" strokeWidth="0.15" opacity="0.9">
          <circle cx="50" cy="50" r="18" />
          <circle cx="50" cy="50" r="29" />
          <circle cx="50" cy="50" r="40" strokeDasharray="1.6 3.2" />
          <circle cx="50" cy="50" r="49" strokeDasharray="0.8 4" />
        </g>
      </svg>

      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className="floater"
          style={{
            left: f.left,
            animationDuration: `${f.duration}s`,
            animationDelay: `-${f.delay}s`,
          }}
        >
          <Ball size={f.size} />
        </span>
      ))}
    </div>
  );
}
