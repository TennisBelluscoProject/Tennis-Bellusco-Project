import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Bricolage_Grotesque, DM_Mono } from "next/font/google";
import "./globals.css";

// Corpo/UI: Instrument Sans — grotesque pulita e leggibile, ottima su mobile.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Titoli: Bricolage Grotesque — display sportivo con carattere da club.
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#C41E3A",
};

export const metadata: Metadata = {
  title: "Tennis Club Bellusco",
  description: "Gestione allievi e maestri - Tennis Club Bellusco",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TC Bellusco",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`h-full antialiased ${instrumentSans.variable} ${bricolageGrotesque.variable} ${dmMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

// Client component for SW registration (inline to avoid extra file)
function ServiceWorkerRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .catch(function() {});
            });
          }
        `,
      }}
    />
  );
}
