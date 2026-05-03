'use client';

import Image from 'next/image';

interface Props {
  onLogout: () => void;
}

export function MobileHeader({ onLogout }: Props) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-white/98 backdrop-blur-lg border-b border-gray-100/80">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo-header.png"
              alt="Tennis Bellusco 2012"
              width={73}
              height={36}
              priority
              className="object-contain shrink-0"
            />
            <div className="flex flex-col min-w-0">
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
