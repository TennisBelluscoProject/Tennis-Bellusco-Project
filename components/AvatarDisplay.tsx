'use client';

import { cn } from '@/lib/utils';

interface AvatarDisplayProps {
  photoUrl: string | null | undefined;
  fullName: string;
  /** Lato in px. Default 48. */
  size?: number;
  className?: string;
}

/**
 * Avatar: la foto se c'e', altrimenti l'iniziale su fondo cobalto.
 *
 * La misura arriva SEMPRE da `size` e finisce in uno stile in linea, quindi
 * vince su qualunque classe di larghezza passata da fuori. E' voluto — un
 * avatar con due misure in conflitto viene ritagliato — ma vuol dire che chi
 * lo usa dentro un contenitore di dimensione fissa deve passare la stessa
 * misura, non fidarsi di `w-full`.
 */
export function AvatarDisplay({
  photoUrl,
  fullName,
  size = 48,
  className = '',
}: AvatarDisplayProps) {
  const initial = fullName.charAt(0).toUpperCase();
  const radius = Math.round(size * 0.28);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={fullName}
        className={cn('object-cover shrink-0', className)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center font-bold shrink-0 select-none',
        'bg-primary text-[var(--primary-foreground)]',
        className
      )}
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
