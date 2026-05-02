'use client';

interface AvatarDisplayProps {
  photoUrl: string | null | undefined;
  fullName: string;
  /** Size in px. Default 48 */
  size?: number;
  className?: string;
}

/**
 * Reusable avatar component: shows the photo if available, otherwise a
 * gradient circle with the user's initial.
 */
export function AvatarDisplay({
  photoUrl,
  fullName,
  size = 48,
  className = '',
}: AvatarDisplayProps) {
  const initial = fullName.charAt(0).toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={fullName}
        className={`rounded-2xl object-cover shadow-sm shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white font-bold shadow-sm shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.375 }}
    >
      {initial}
    </div>
  );
}
