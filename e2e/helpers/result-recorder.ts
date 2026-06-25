import fs from 'node:fs';
import path from 'node:path';
import type { LhAuditResult } from '../fixtures/lighthouse';

/**
 * Raccoglie l'esito di UN'iterazione (step E2E + audit Lighthouse) e lo
 * serializza in e2e-report/results/iteration-<n>.json. Il globalTeardown
 * legge tutti questi file e genera l'HTML riassuntivo screenshottabile.
 */

export type StepStatus = 'passed' | 'failed' | 'skipped';
export type StepResult = { name: string; status: StepStatus; note?: string };

export type IterationResult = {
  iteration: number;
  title: string;
  useCases?: string[];
  steps: StepResult[];
  audits: Array<{ label: string; url: string; formFactor: string; scores: LhAuditResult['scores'] }>;
  e2eStatus: StepStatus;
  timestamp: string;
  links?: { lighthouse?: string; playwright?: string };
};

const RESULTS_DIR = path.join(process.cwd(), 'e2e-report', 'results');

export class IterationRecorder {
  private steps: StepResult[] = [];
  private audits: IterationResult['audits'] = [];
  private lighthouseLink?: string;

  constructor(private iteration: number, private title: string, private useCases: string[] = []) {}

  step(name: string, status: StepStatus, note?: string) {
    this.steps.push({ name, status, note });
  }

  /** Esegue un blocco e registra passed/failed in base all'esito. */
  async track(name: string, fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      this.step(name, 'passed');
      return true;
    } catch (err) {
      this.step(name, 'failed', err instanceof Error ? err.message.split('\n')[0] : String(err));
      return false;
    }
  }

  addAudit(a: LhAuditResult) {
    this.audits.push({ label: a.label, url: a.url, formFactor: a.formFactor, scores: a.scores });
    if (!this.lighthouseLink) this.lighthouseLink = a.htmlReport;
  }

  /** Da chiamare in afterAll: scrive il JSON dell'iterazione. */
  flush() {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const e2eStatus: StepStatus = this.steps.some((s) => s.status === 'failed')
      ? 'failed'
      : this.steps.length === 0
        ? 'skipped'
        : 'passed';

    const result: IterationResult = {
      iteration: this.iteration,
      title: this.title,
      useCases: this.useCases,
      steps: this.steps,
      audits: this.audits,
      e2eStatus,
      timestamp: new Date().toISOString(),
      links: { lighthouse: this.lighthouseLink, playwright: '../playwright-report/index.html' },
    };

    fs.writeFileSync(path.join(RESULTS_DIR, `iteration-${this.iteration}.json`), JSON.stringify(result, null, 2));
  }
}
