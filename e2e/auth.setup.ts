import { test as setup, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { AUTH_DIR, MAESTRO_STATE, ALLIEVO_STATE } from '../playwright.config';

/**
 * SETUP DI AUTENTICAZIONE
 * ------------------------------------------------------------------
 * Esegue il login reale (UC-03) per maestro e allievo approvato e salva lo
 * storageState. Tutti i flussi delle iterazioni ripartono da questi stati
 * GIÀ AUTENTICATI. Credenziali in e2e/.env.e2e.
 *
 * Nota: l'allievo DEVE essere approvato (approval_status='approved'),
 * altrimenti il doppio gate di signIn (UC-03) fa signOut e il login non va.
 */

fs.mkdirSync(AUTH_DIR, { recursive: true });

function creds(role: 'MAESTRO' | 'ALLIEVO') {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Credenziali mancanti: imposta E2E_${role}_EMAIL e E2E_${role}_PASSWORD in e2e/.env.e2e`);
  }
  return { email, password };
}

/**
 * Compila il form di login (modalità "Accedi") e attende l'uscita dalla
 * schermata di login. Selettori reali del progetto:
 *   - email/password: unici input type=email/password in modalità login
 *   - submit: <button type="submit">Accedi</button> (il toggle è type="button")
 */
async function login(page: Page, email: string, password: string) {
  await page.goto('/');

  await expect(page.locator('input[type="email"]'), 'LoginPage visibile').toBeVisible();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]', { hasText: 'Accedi' }).click();

  // Segnale di autenticazione: la schermata di login sparisce.
  await expect(
    page.locator('input[type="password"]'),
    'usciti dalla schermata di login',
  ).toHaveCount(0, { timeout: 20_000 });

  // Nessun errore di credenziali/approvazione.
  await expect(
    page.getByText(/credenziali|non valid|rifiutata|approvati dal maestro/i),
  ).toHaveCount(0);
}

setup('autentica maestro', async ({ page }) => {
  const { email, password } = creds('MAESTRO');
  await login(page, email, password);

  // Il maestro raggiunge il cruscotto: marker desktop "PANORAMICA CLUB".
  await expect(page.getByText(/panoramica club/i)).toBeVisible({ timeout: 20_000 });

  await page.context().storageState({ path: MAESTRO_STATE });
});

setup('autentica allievo approvato', async ({ page }) => {
  const { email, password } = creds('ALLIEVO');
  await login(page, email, password);

  // L'allievo approvato NON resta nella schermata pending (h2 della pending screen).
  await expect(
    page.getByRole('heading', { name: /in attesa di approvazione/i }),
  ).toHaveCount(0);

  await page.context().storageState({ path: ALLIEVO_STATE });
});
