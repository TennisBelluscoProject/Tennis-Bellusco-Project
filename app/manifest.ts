import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tennis Club Bellusco',
    short_name: 'TC Bellusco',
    description: 'Gestione allievi e maestri - Tennis Club Bellusco',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F8FA',
    theme_color: '#C41E3A',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
