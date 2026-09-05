import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { themeInitScript } from "@/lib/theme-script";
import { viewportInitScript } from "@/lib/viewport-script";

// Una sola famiglia per tutto: Inter, la stessa che indica il tema Cobalt
// Steel. La gerarchia la fanno peso e crenatura, non l'alternanza di due
// caratteri diversi — e' quello che tiene insieme il tono dell'interfaccia.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Solo per i numeri che devono stare in colonna: punteggi, statistiche,
// contatori.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // NIENTE `themeColor` qui.
  //
  // I due valori per `prefers-color-scheme` rispondevano alla preferenza di
  // SISTEMA, mentre il tema dell'app lo decide la classe `.dark`, che nasce
  // dalla scelta SALVATA (vedi lib/theme-script.ts). Chi teneva il telefono
  // in chiaro e l'app in scuro si ritrovava percio' la barra di sistema
  // bianca sopra un'app nera — e viceversa. Il valore scuro, per giunta, era
  // rimasto al vecchio `#141416`, che non e' piu' lo sfondo di nessun tema.
  //
  // Ora la tinta la scrive chi conosce il tema davvero applicato: lo script
  // in <head> alla prima pittura e ThemeProvider a ogni cambio.
};

export const metadata: Metadata = {
  title: "Bellusco Tennis Club",
  description: "Obiettivi, percorsi e risultati — Bellusco Tennis Club",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bellusco",
  },
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
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
    // `suppressHydrationWarning`: la classe `dark` la mette lo script qui
    // sotto prima dell'idratazione, quindi il markup del client differisce da
    // quello del server. E' voluto, ed e' l'unico modo per non avere un lampo
    // di tema sbagliato al caricamento.
    <html
      lang="it"
      suppressHydrationWarning
      className={`antialiased ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: viewportInitScript }} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="flex flex-col font-sans">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

// Registrazione del service worker, in linea per non aggiungere un file.
function ServiceWorkerRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            var h = location.hostname;
            var isDev = h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
            if (isDev) {
              // In sviluppo il SW va disinstallato: la sua cache-first sui file
              // .js congelerebbe il bundle e le modifiche al codice non si
              // vedrebbero nel browser.
              navigator.serviceWorker.getRegistrations()
                .then(function (rs) { rs.forEach(function (r) { r.unregister(); }); })
                .catch(function () {});
              if (window.caches && caches.keys) {
                caches.keys()
                  .then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); })
                  .catch(function () {});
              }
            } else {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                  .catch(function() {});
              });
            }
          }
        `,
      }}
    />
  );
}
