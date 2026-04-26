'use client';

interface StatPillProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  valueColor?: string;
}

export function StatPill({ label, value, icon, accent, valueColor }: StatPillProps) {
  return (
    <div className="card stat-card p-3.5" style={{ '--stat-accent': accent } as React.CSSProperties}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${accent}1A`, color: accent }}>
        {icon}
      </div>
      <p className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: valueColor ?? 'var(--foreground)' }}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

export function FilterPill({ active, onClick, label, count }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[13px] font-semibold transition-all ${
        active
          ? 'bg-white text-[var(--club-blue)] border-[var(--club-blue)]'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        active ? 'bg-[var(--club-blue)] text-white' : 'bg-gray-100 text-gray-500'
      }`}>{count}</span>
    </button>
  );
}
