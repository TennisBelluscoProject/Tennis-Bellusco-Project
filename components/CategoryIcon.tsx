'use client';

import { Trophy, Brain, Dumbbell, Sparkles } from 'lucide-react';

/**
 * Maps category icon keys (from CATEGORY_CONFIG) to Lucide components.
 * 'racquet' uses a custom inline SVG since Lucide doesn't have a tennis racquet.
 */

const ICON_MAP: Record<string, React.FC<{ size?: number; strokeWidth?: number; className?: string }>> = {
  brain: Brain,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  trophy: Trophy,
};

interface CategoryIconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CategoryIcon({ name, size = 14, strokeWidth = 2, className }: CategoryIconProps) {
  // Custom tennis racquet SVG
  if (name === 'racquet') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="13" cy="9" r="7" />
        <path d="M9.7 14.3L3 21" />
        <path d="M6 9h14" />
        <path d="M13 2v14" />
      </svg>
    );
  }

  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
