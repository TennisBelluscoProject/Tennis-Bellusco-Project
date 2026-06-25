import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import dotenv from 'dotenv';

// Credenziali/URL della suite E2E (file non versionato).
dotenv.config({ path: path.resolve(__dirname, 'e2e', '.env.e2e') });

/**
 * Configurazione Playwright — Tennis Club Bellusco
 * ------------------------------------------------------------------
 * Architettura (pattern ufficiale Playwright, https://playwright.dev/docs/auth):
 *   - progetto "setup": esegue il login reale UNA volta e salva lo
 *     storageState (cookie + localStorage) su disco.
 *   - progetti "iteration-N": dichiarano dependencies:['setup'] e partono
 *     GIÀ AUTENTICATI riusando lo storageState. Un flusso per iterazione.
 *
 * Il globalTeardown assembla e2e-report/iteration-summary.html (screenshottabile).
 * I tre progetti chromium/firefox/webkit originari restano per i test in ./tests.
 */

export const AUTH_DIR = path.join(__dirname, 'e2e', 'playwright', '.auth');
export const MAESTRO_STATE = path.join(AUTH_DIR, 'maestro.json');
export const ALLIEVO_STATE = path.join(AUTH_DIR, 'allievo.json');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  // testDir globale per i progetti che non lo sovrascrivono (i test esistenti).
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never' }], // → playwright-report/
    ['json', { outputFile: 'e2e-report/playwright-results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Costruisce e2e-report/iteration-summary.html dai JSON in e2e-report/results/.
  globalTeardown: require.resolve('./e2e/report/build-report.ts'),

  projects: [
    // ─── Test esistenti (esempio Playwright) ───────────────────────────
    { name: 'chromium', testDir: './tests', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testDir: './tests', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testDir: './tests', use: { ...devices['Desktop Safari'] } },

    // ─── Autenticazione: gira per prima, salva gli storageState ─────────
    { name: 'setup', testDir: './e2e', testMatch: /auth\.setup\.ts/ },

    // ─── Iterazione 1: un flusso, già autenticato ──────────────────────
    {
      name: 'iteration-1',
      testDir: './e2e',
      testMatch: /iteration-1\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // storageState di default: sessione MAESTRO. Le sezioni "allievo"
        // lo sovrascrivono con test.use({ storageState: ALLIEVO_STATE }).
        storageState: MAESTRO_STATE,
      },
    },

    // Iterazioni successive: aggiungere qui un progetto per ciascuna.
  ],

  /**
   * Opzionale: avvia l'app prima dei test (scommentare per gestione automatica).
   */
  // webServer: {
  //   command: 'npm run start', // o 'npm run dev'
  //   url: BASE_URL,
  //   timeout: 120_000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
