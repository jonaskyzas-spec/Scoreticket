/**
 * Visa / Mastercard / PayPal marks for the footer.
 *
 * Drawn as inline SVG rather than loaded as images: the strict no-external-
 * request rule aside, these stay sharp at any size and add nothing to the page
 * weight. Each sits on a light chip because all three brands are designed for
 * light backgrounds and their colours disappear against the dark footer.
 *
 * These are simplified representations in the brands' own colours, which is the
 * normal way payment marks appear in a footer. If you'd rather use the official
 * artwork, each brand publishes downloadable assets with usage rules — drop the
 * files in `public/` and swap the SVGs here.
 */

function Chip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex h-8 w-[52px] items-center justify-center rounded-md"
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }}
      role="img"
      aria-label={label}
    >
      {children}
    </span>
  );
}

export function PaymentMarks() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Visa */}
      <Chip label="Visa">
        <svg width="40" height="14" viewBox="0 0 40 14" fill="none">
          <text
            x="20"
            y="11.5"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="13"
            fontWeight="700"
            fontStyle="italic"
            letterSpacing="0.5"
            fill="#1434CB"
          >
            VISA
          </text>
        </svg>
      </Chip>

      {/* Mastercard — the interlocking discs */}
      <Chip label="Mastercard">
        <svg width="38" height="24" viewBox="0 0 38 24" fill="none">
          <circle cx="15" cy="12" r="7.2" fill="#EB001B" />
          <circle cx="23" cy="12" r="7.2" fill="#F79E1B" />
          {/* the overlap reads as a third colour on the real mark */}
          <path
            d="M19 6.6a7.2 7.2 0 0 0 0 10.8 7.2 7.2 0 0 0 0-10.8Z"
            fill="#FF5F00"
          />
        </svg>
      </Chip>

      {/* PayPal */}
      <Chip label="PayPal">
        <svg width="46" height="14" viewBox="0 0 46 14" fill="none">
          <text
            x="23"
            y="11"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="11.5"
            fontWeight="700"
            fontStyle="italic"
          >
            <tspan fill="#003087">Pay</tspan>
            <tspan fill="#009CDE">Pal</tspan>
          </text>
        </svg>
      </Chip>
    </div>
  );
}
