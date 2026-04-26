'use client';

interface Props {
  onLogout: () => void;
}

export function MobileHeader({ onLogout }: Props) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--club-red)] flex items-center justify-center shadow-sm relative overflow-hidden shrink-0">
              <span className="text-lg relative z-10">🎾</span>
              <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className="text-[14px] font-bold text-[var(--club-blue)] leading-tight tracking-[-0.01em] truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Tennis Club Bellusco
              </span>
              <span className="text-[11px] text-[var(--muted)] leading-tight mt-0.5">
                Dashboard Maestro
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            aria-label="Esci"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-[var(--club-red)] hover:bg-[var(--club-red-light)] transition-colors shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>
      <div className="club-stripe" />
    </>
  );
}
