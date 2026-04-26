'use client';

export type CoachTabId = 'home' | 'allievi' | 'risultati' | 'richieste';

interface Props {
  active: CoachTabId;
  onChange: (tab: CoachTabId) => void;
  pendingCount: number;
}

export function BottomNav({ active, onChange, pendingCount }: Props) {
  const items: { id: CoachTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <IconHome /> },
    { id: 'allievi', label: 'Allievi', icon: <IconUsers /> },
    { id: 'risultati', label: 'Risultati', icon: <IconTrophy /> },
    { id: 'richieste', label: 'Richieste', icon: <IconUserPlus /> },
  ];
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/98 backdrop-blur-lg border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-1.5">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-[var(--club-blue)]' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                {it.icon}
                {it.id === 'richieste' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--club-red)] text-white text-[9px] font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold tracking-tight ${
                  isActive ? 'text-[var(--club-blue)]' : 'text-gray-400'
                }`}
              >
                {it.label}
              </span>
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-[2.5px] rounded-full bg-[var(--club-blue)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
      <path d="M17 4h3v3a3 3 0 01-3 3" />
      <path d="M7 4H4v3a3 3 0 003 3" />
    </svg>
  );
}
function IconUserPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}
