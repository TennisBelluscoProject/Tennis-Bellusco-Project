'use client';

import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'avatars';

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  fullName: string;
  /** Size in px (width = height). Default 80 */
  size?: number;
  onUploaded: (publicUrl: string) => void;
}

export function AvatarUpload({
  userId,
  currentUrl,
  fullName,
  size = 80,
  onUploaded,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initial = fullName.charAt(0).toUpperCase();
  const displayUrl = previewUrl || currentUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato non supportato. Usa JPG, PNG o WebP.');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setError('Immagine troppo grande. Massimo 2 MB.');
      return;
    }

    // Show instant preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);

    try {
      // Build a unique file path: {userId}/avatar.{ext}
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${userId}/avatar.${ext}`;

      // Upload with upsert so re-uploads overwrite the old file
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      // Append cache-buster so the browser picks up the new image
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Persist the URL in the profile row
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', userId);

      if (dbError) throw dbError;

      onUploaded(publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il caricamento';
      setError(msg);
      // Revert preview on failure
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Carica foto profilo"
      />

      {/* Clickable avatar */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group focus:outline-none focus:ring-2 focus:ring-[var(--club-blue)] focus:ring-offset-2 rounded-2xl"
        aria-label="Cambia foto profilo"
        style={{ width: size, height: size }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={fullName}
            className="w-full h-full rounded-2xl object-cover shadow-md"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="w-full h-full rounded-2xl bg-gradient-to-br from-[var(--club-blue)] to-[var(--club-blue-dark)] flex items-center justify-center text-white font-bold shadow-md"
            style={{ width: size, height: size, fontSize: size * 0.375 }}
          >
            {initial}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <svg
              className="animate-spin h-6 w-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Loading overlay (always visible when uploading) */}
        {uploading && (
          <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
            <svg
              className="animate-spin h-6 w-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
      </button>

      {/* "Modifica foto profilo" label */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-[13px] font-semibold text-gray-500 hover:text-[var(--club-blue)] transition-colors disabled:opacity-50"
      >
        {uploading ? 'Caricamento...' : 'Modifica foto profilo'}
      </button>

      {/* Error message */}
      {error && (
        <p className="text-[12px] text-[var(--club-red)] text-center max-w-[200px]">
          {error}
        </p>
      )}
    </div>
  );
}
