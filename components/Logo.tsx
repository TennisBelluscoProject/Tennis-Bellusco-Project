'use client';

/**
 * Marchio del club.
 *
 * Il segno e' una palla da tennis ridotta all'essenziale: il cerchio e le due
 * cuciture, disegnati a filo su una piastrella cobalto. E' tutto tracciato
 * (niente riempimenti), cosi' regge sia il tema chiaro sia quello scuro e
 * resta leggibile fino a 20px.
 *
 * `animated` fa "disegnare" le cuciture all'ingresso: si usa in login e
 * schermata di caricamento, dove c'e' tempo per guardarle.
 */

interface LogoMarkProps {
  size?: number;
  /** `tile` = quadrato pieno cobalto; `bare` = solo il segno, nel colore corrente. */
  variant?: 'tile' | 'bare';
  animated?: boolean;
  className?: string;
}

export function LogoMark({
  size = 36,
  variant = 'tile',
  animated = false,
  className = '',
}: LogoMarkProps) {
  const tile = variant === 'tile';
  const stroke = tile ? 'var(--primary-foreground)' : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Tennis Bellusco"
    >
      {tile && <rect width="48" height="48" rx="13" fill="var(--primary)" />}

      <g
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        opacity={tile ? 1 : 0.95}
      >
        <circle cx="24" cy="24" r="13" opacity="0.55" />
        <path
          d="M14.8 14.8C19.8 18.4 19.8 29.6 14.8 33.2"
          className={animated ? 'logo-seam' : undefined}
        />
        <path
          d="M33.2 14.8C28.2 18.4 28.2 29.6 33.2 33.2"
          className={animated ? 'logo-seam logo-seam-2' : undefined}
        />
      </g>

      {animated && (
        <style>{`
          .logo-seam {
            stroke-dasharray: 26;
            stroke-dashoffset: 26;
            animation: logoSeam 900ms var(--ease-out-quint) 120ms forwards;
          }
          .logo-seam-2 { animation-delay: 260ms; }
          @keyframes logoSeam { to { stroke-dashoffset: 0; } }
          @media (prefers-reduced-motion: reduce) {
            .logo-seam { animation: none; stroke-dashoffset: 0; }
          }
        `}</style>
      )}
    </svg>
  );
}

interface LogoProps {
  size?: number;
  /** Nasconde il testo: utile nelle barre strette e sotto i 640px. */
  markOnly?: boolean;
  variant?: 'tile' | 'bare';
  animated?: boolean;
  className?: string;
}

export function Logo({
  size = 34,
  markOnly = false,
  variant = 'tile',
  animated = false,
  className = '',
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} variant={variant} animated={animated} />
      {!markOnly && (
        <span className="flex flex-col leading-none">
          <span
            className="font-bold text-foreground"
            style={{ fontSize: size * 0.44, letterSpacing: '-0.03em' }}
          >
            Bellusco
          </span>
          <span
            className="font-semibold text-subtle-foreground uppercase"
            style={{ fontSize: size * 0.24, letterSpacing: '0.16em', marginTop: size * 0.1 }}
          >
            Tennis Club
          </span>
        </span>
      )}
    </span>
  );
}
