import fs from 'node:fs';
import path from 'node:path';
import { createObjectCsvWriter } from 'csv-writer';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

function ensureReportsDir() {
  fs.mkdirSync(config.paths.reports, { recursive: true });
}

function buildFilename(prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.csv`;
}

export async function generateCsvReport(auditResult) {
  ensureReportsDir();

  const filename = buildFilename(`audit-${auditResult.id}-pagespeed`);
  const filepath = path.join(config.paths.reports, filename);

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'url', title: 'URL' },
      { id: 'strategy', title: 'Strategy' },
      { id: 'performanceScore', title: 'Performance Score' },
      { id: 'accessibilityScore', title: 'Accessibility Score' },
      { id: 'bestPracticesScore', title: 'Best Practices Score' },
      { id: 'seoScore', title: 'SEO Score' },
      { id: 'firstContentfulPaint', title: 'FCP' },
      { id: 'largestContentfulPaint', title: 'LCP' },
      { id: 'interactionToNextPaint', title: 'INP' },
      { id: 'totalBlockingTime', title: 'TBT' },
      { id: 'cumulativeLayoutShift', title: 'CLS' },
      { id: 'speedIndex', title: 'Speed Index' },
      { id: 'timeToInteractive', title: 'TTI' },
      { id: 'error', title: 'Error' },
    ],
  });

  await csvWriter.writeRecords(auditResult.pageSpeedResults ?? []);

  logger.info('CSV report generated', { filepath });
  return filepath;
}

export default generateCsvReport;
