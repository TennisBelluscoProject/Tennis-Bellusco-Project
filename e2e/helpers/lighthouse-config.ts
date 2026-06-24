// Configurazioni Lighthouse e soglie condivise tra le iterazioni.

export type LhScores = {
  performance: number | null;
  accessibility: number | null;
  'best-practices': number | null;
  seo: number | null;
  pwa?: number | null;
};

// Soglie INFORMATIVE: registrate e mostrate nel report. Nello spec usiamo
// expect.soft, così un punteggio basso è visibile ma non blocca il flusso
// funzionale (la performance in locale è naturalmente rumorosa).
export const DEFAULT_THRESHOLDS = {
  performance: 50,
  accessibility: 90,
  'best-practices': 90,
  seo: 80,
};

const ONLY = ['performance', 'accessibility', 'best-practices', 'seo'];

export const desktopConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop' as const,
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    onlyCategories: ONLY,
  },
};

export const mobileConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile' as const,
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    onlyCategories: ONLY,
  },
};
