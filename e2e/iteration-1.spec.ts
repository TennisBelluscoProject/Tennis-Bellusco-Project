import { test, expect } from './fixtures/lighthouse';
import { MAESTRO_STATE, ALLIEVO_STATE } from '../playwright.config';
import { IterationRecorder } from './helpers/result-recorder';

/**
 * ITERAZIONE 1 — Autenticazione, OTP e workflow di approvazione
 * ------------------------------------------------------------------
 * UC coperti: UC-01..UC-06, verificati sulle superfici raggiungibili da una
 * sessione GIÀ AUTENTICATA (requisito della suite).
 *
 * Flusso NON distruttivo: verifica che il maestro raggiunga il cruscotto e
 * l'area approvazioni (UC-06) e che l'allievo approvato raggiunga la propria
 * dashboard (esito di UC-03/UC-05). Non esegue approvazioni reali → ripetibile.
 *
 * Selettori reali del progetto (niente data-testid necessari):
 *   - login: input[type=email|password], button[type=submit] "Accedi"
 *   - cruscotto maestro (desktop): testo "PANORAMICA CLUB" (ClubOverview)
 *   - area approvazioni (UC-06): tab "Richieste" → card "Approvazioni allievi"
 *   - dashboard allievo: tab "Obiettivi" (PlayerView)
 *   - pending screen allievo: <h2> "In attesa di approvazione"
 * Nota: la dashboard maestro monta desktop+mobile insieme (toggle CSS):
 *   per i click usiamo "button:visible" così colpiamo solo la vista attiva.
 */

const recorder = new IterationRecorder(1, 'Autenticazione, OTP & workflow di approvazione', [
  'UC-01', 'UC-02', 'UC-03', 'UC-04', 'UC-05', 'UC-06',
]);

// ───────────────────────── Sessione MAESTRO ─────────────────────────
test.describe('Iterazione 1 · sessione maestro', () => {
  test.use({ storageState: MAESTRO_STATE });

  test('il maestro accede al cruscotto e all’area approvazioni', async ({ page, lhAudit }) => {
    await recorder.track('Sessione maestro autenticata (no login screen)', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    });

    await recorder.track('Routing per ruolo: niente schermata pending (UC-03)', async () => {
      await expect(page.getByRole('heading', { name: /in attesa di approvazione/i })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /registrazione rifiutata/i })).toHaveCount(0);
    });

    await recorder.track('Cruscotto maestro renderizzato (CoachDashboard)', async () => {
      await expect(page.getByText(/panoramica club/i)).toBeVisible({ timeout: 15_000 });
    });

    await recorder.track('Area approvazioni allievi raggiungibile (UC-06)', async () => {
      // Apre la tab "Richieste" della vista attiva (desktop).
      await page.locator('button:visible', { hasText: 'Richieste' }).first().click();
      await expect(page.getByText('Approvazioni allievi')).toBeVisible({ timeout: 15_000 });
    });

    await recorder.track('Audit Lighthouse cruscotto maestro (desktop)', async () => {
      const audit = await lhAudit({
        url: '/',
        label: 'Cruscotto maestro (/)',
        storageState: MAESTRO_STATE,
        formFactor: 'desktop',
        reportName: 'iter1-maestro-dashboard',
      });
      recorder.addAudit(audit);
      expect.soft(audit.scores.accessibility ?? 0, 'accessibilità ≥ 90').toBeGreaterThanOrEqual(90);
      expect.soft(audit.scores['best-practices'] ?? 0, 'best practices ≥ 90').toBeGreaterThanOrEqual(90);
    });
  });
});

// ───────────────────────── Sessione ALLIEVO ─────────────────────────
test.describe('Iterazione 1 · sessione allievo approvato', () => {
  test.use({ storageState: ALLIEVO_STATE });

  test('l’allievo approvato accede alla propria dashboard (UC-03/UC-05)', async ({ page, lhAudit }) => {
    await recorder.track('Sessione allievo autenticata (no login screen)', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    });

    await recorder.track('Allievo approvato: nessuna schermata pending (UC-05)', async () => {
      await expect(page.getByRole('heading', { name: /in attesa di approvazione/i })).toHaveCount(0);
      // Marker della dashboard allievo: la tab "Obiettivi" di PlayerView.
      await expect(page.getByRole('button', { name: 'Obiettivi' }).first()).toBeVisible({ timeout: 15_000 });
    });

    await recorder.track('Audit Lighthouse dashboard allievo (mobile, RNF-01)', async () => {
      const audit = await lhAudit({
        url: '/',
        label: 'Dashboard allievo (/)',
        storageState: ALLIEVO_STATE,
        formFactor: 'mobile',
        reportName: 'iter1-allievo-dashboard',
      });
      recorder.addAudit(audit);
      expect.soft(audit.scores.accessibility ?? 0, 'accessibilità ≥ 90').toBeGreaterThanOrEqual(90);
    });
  });

  test.afterAll(async () => {
    recorder.flush(); // scrive e2e-report/results/iteration-1.json
  });
});
