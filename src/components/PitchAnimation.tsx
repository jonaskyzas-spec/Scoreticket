/**
 * Animated tactical pitch — the hero's moving background.
 *
 * Pure SVG + CSS keyframes: no video file, no external asset, no licensing
 * question, a few KB, and it renders on the server. It reads as a live tactics
 * board — pass lines drawing between players, the ball moving through them,
 * radar sweep over the centre circle.
 *
 * If a real clip is dropped at `public/hero.mp4`, Hero.tsx layers it on top of
 * this instead; this stays as the fallback.
 */
export function PitchAnimation() {
  return (
    <svg
      className="pitch-anim hero-media"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="pitchBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#071b18" />
          <stop offset="52%" stopColor="#06121f" />
          <stop offset="100%" stopColor="#0a0820" />
        </linearGradient>

        <radialGradient id="ballGlow">
          <stop offset="0%" stopColor="#34f5c5" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#34f5c5" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#34f5c5" stopOpacity="0" />
          <stop offset="50%" stopColor="#34f5c5" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#34f5c5" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1200" height="600" fill="url(#pitchBg)" />

      {/* Mown stripes */}
      <g opacity="0.05">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 120} y="0" width="60" height="600" fill="#5eead4" />
        ))}
      </g>

      {/* Pitch markings */}
      <g
        stroke="#34f5c5"
        strokeWidth="1.6"
        fill="none"
        opacity="0.34"
        strokeLinecap="round"
      >
        <rect x="70" y="50" width="1060" height="500" rx="4" />
        <line x1="600" y1="50" x2="600" y2="550" />
        <circle cx="600" cy="300" r="86" />
        <circle cx="600" cy="300" r="4" fill="#34f5c5" stroke="none" />
        <rect x="70" y="160" width="150" height="280" />
        <rect x="980" y="160" width="150" height="280" />
        <rect x="70" y="238" width="56" height="124" />
        <rect x="1074" y="238" width="56" height="124" />
        <path d="M220 244 A 74 74 0 0 1 220 356" />
        <path d="M980 244 A 74 74 0 0 0 980 356" />
      </g>

      {/* Radar sweep over the centre circle */}
      <g className="radar" style={{ transformOrigin: '600px 300px' }}>
        <rect x="600" y="214" width="300" height="86" fill="url(#sweepGrad)" opacity="0.5" />
      </g>

      {/* Pass network: lines draw themselves in sequence */}
      <g stroke="#4d9fff" strokeWidth="1.6" opacity="0.55" fill="none" strokeLinecap="round">
        <path className="pass p1" d="M250 420 L470 300" />
        <path className="pass p2" d="M470 300 L700 190" />
        <path className="pass p3" d="M700 190 L900 330" />
        <path className="pass p4" d="M900 330 L1055 300" />
      </g>

      {/* Player nodes */}
      <g fill="#4d9fff" opacity="0.85">
        {[
          [250, 420],
          [470, 300],
          [700, 190],
          [900, 330],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="5">
            <animate
              attributeName="opacity"
              values="0.35;1;0.35"
              dur="2.6s"
              begin={`${i * 0.55}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>

      {/* The ball, travelling the pass network */}
      <g className="ball-wrap">
        <circle r="26" fill="url(#ballGlow)" />
        <circle r="6.5" fill="#eafff9" />
        <animateMotion
          dur="7s"
          repeatCount="indefinite"
          keyPoints="0;0.25;0.5;0.75;1"
          keyTimes="0;0.25;0.5;0.75;1"
          calcMode="spline"
          keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
          path="M250 420 L470 300 L700 190 L900 330 L1055 300"
        />
      </g>

      <style>{`
        .radar { animation: radarSpin 8s linear infinite; }
        @keyframes radarSpin { to { transform: rotate(360deg); } }

        .pass {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: draw 7s ease-in-out infinite;
        }
        .p1 { animation-delay: 0s; }
        .p2 { animation-delay: 1.75s; }
        .p3 { animation-delay: 3.5s; }
        .p4 { animation-delay: 5.25s; }

        @keyframes draw {
          0%   { stroke-dashoffset: 300; opacity: 0; }
          12%  { stroke-dashoffset: 0;   opacity: 0.85; }
          38%  { stroke-dashoffset: 0;   opacity: 0.85; }
          55%  { stroke-dashoffset: -300; opacity: 0; }
          100% { stroke-dashoffset: -300; opacity: 0; }
        }
      `}</style>
    </svg>
  );
}
