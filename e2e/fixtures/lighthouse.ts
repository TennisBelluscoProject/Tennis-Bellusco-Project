import { test as base, chromium } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import fs from 'node:fs';
import path from 'node:path';
import { desktopConfig, mobileConfig, DEFAULT_THRESHOLDS, type LhScores } from '../helpers/lighthouse-config';

/**
 * FIXTURE LIGHTHOUSE SU SESSIONE AUTENTICATA
 * ------------------------------------------------------------------
 * playAudit() richiede un Chromium con --remote-debugging-port, che la `page`
 * standard non espone. Lanciamo quindi un Chromium dedicato con la porta di
 * debug e RICARICHIAMO lo stesso storageState del progetto: l'audit gira sulla
 * STESSA sessione autenticata.
 * Doc: https://unlighthouse.dev/learn-lighthouse/playwright
 *      https://www.npmjs.com/package/playwright-lighthouse
 */

export type LhAuditOptions = {
  url: string;
  label?: string;
  storageState: string;
  formFactor?: 'desktop' | 'mobile';
  reportName: string;
};

export type LhAuditResult = {
  url: string;
  label: string;
  formFactor: string;
  scores: LhScores;
  htmlReport: string;
};

const LH_DIR = path.join(process.cwd(), 'e2e-report', 'lighthouse');

function readScoresFromJson(jsonPath: string): LhScores {
  const lhr = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const cat = lhr.categories || {};
  const pct = (c: any) => (c && typeof c.score === 'number' ? Math.round(c.score * 100) : null);
  return {
    performance: pct(cat.performance),
    accessibility: pct(cat.accessibility),
    'best-practices': pct(cat['best-practices']),
    seo: pct(cat.seo),
    ...(cat.pwa ? { pwa: pct(cat.pwa) } : {}),
  };
}

// playwright-lighthouse scrive <directory>/<name>.report.{html,json}. Cerchiamo
// il json più recente che contiene il nome, per robustezza tra versioni.
function findReportJson(dir: string, name: string): string {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.includes(name) && f.endsWith('.json'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error(`Report Lighthouse JSON non trovato in ${dir} per "${name}"`);
  return path.join(dir, files[0].f);
}

export const test = base.extend<{
  lhAudit: (opts: LhAuditOptions) => Promise<LhAuditResult>;
}>({
  lhAudit: async ({}, use, testInfo) => {
    fs.mkdirSync(LH_DIR, { recursive: true });
    const port = 9222 + testInfo.parallelIndex; // porta univoca per worker

    await use(async (opts: LhAuditOptions): Promise<LhAuditResult> => {
      const formFactor = opts.formFactor ?? 'desktop';
      const config = formFactor === 'mobile' ? mobileConfig : desktopConfig;

      const browser = await chromium.launch({
        args: [`--remote-debugging-port=${port}`, '--no-sandbox'],
      });
      try {
        const context = await browser.newContext({ storageState: opts.storageState });
        const page = await context.newPage();
        await page.goto(opts.url, { waitUntil: 'networkidle' });

        await playAudit({
          page,
          port,
          config,
          thresholds: DEFAULT_THRESHOLDS,
          ignoreError: true, // il giudizio pass/fail funzionale è dello spec
          reports: {
            formats: { html: true, json: true },
            name: opts.reportName,
            directory: LH_DIR,
          },
        });

        const jsonPath = findReportJson(LH_DIR, opts.reportName);
        const scores = readScoresFromJson(jsonPath);
        const htmlAbs = jsonPath.replace(/\.json$/, '.html');
        const htmlRel = path
          .relative(path.join(process.cwd(), 'e2e-report'), htmlAbs)
          .split(path.sep)
          .join('/');

        return { url: opts.url, label: opts.label ?? opts.url, formFactor, scores, htmlReport: `./${htmlRel}` };
      } finally {
        await browser.close();
      }
    });
  },
});

export { expect } from '@playwright/test';
