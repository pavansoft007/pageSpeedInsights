import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

function ensureReportsDir() {
  fs.mkdirSync(config.paths.reports, { recursive: true });
}

function buildFilename(prefix, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.${extension}`;
}

export async function generateExcelReport(auditResult) {
  ensureReportsDir();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Website Performance Auditor';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 60 },
  ];
  summarySheet.addRows([
    { field: 'Audit ID', value: auditResult.id },
    { field: 'Start URL', value: auditResult.startUrl },
    { field: 'Status', value: auditResult.status },
    { field: 'Started At', value: auditResult.startedAt },
    { field: 'Completed At', value: auditResult.completedAt ?? '' },
    { field: 'Pages Crawled', value: auditResult.pages?.length ?? 0 },
    { field: 'Pages Analyzed', value: auditResult.pageSpeedResults?.length ?? 0 },
  ]);

  const crawlSheet = workbook.addWorksheet('Crawl Results');
  crawlSheet.columns = [
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Final URL', key: 'finalUrl', width: 50 },
    { header: 'Depth', key: 'depth', width: 10 },
    { header: 'Status', key: 'statusCode', width: 10 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'H1 Count', key: 'h1Count', width: 12 },
    { header: 'Links', key: 'linkCount', width: 10 },
    { header: 'Images', key: 'imageCount', width: 10 },
    { header: 'Scripts', key: 'scriptCount', width: 10 },
    { header: 'Error', key: 'error', width: 30 },
  ];
  crawlSheet.addRows(auditResult.pages ?? []);

  const perfSheet = workbook.addWorksheet('PageSpeed Results');
  perfSheet.columns = [
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Strategy', key: 'strategy', width: 12 },
    { header: 'Performance', key: 'performanceScore', width: 14 },
    { header: 'Accessibility', key: 'accessibilityScore', width: 16 },
    { header: 'Best Practices', key: 'bestPracticesScore', width: 16 },
    { header: 'SEO', key: 'seoScore', width: 10 },
    { header: 'FCP', key: 'firstContentfulPaint', width: 14 },
    { header: 'LCP', key: 'largestContentfulPaint', width: 14 },
    { header: 'INP', key: 'interactionToNextPaint', width: 14 },
    { header: 'TBT', key: 'totalBlockingTime', width: 14 },
    { header: 'CLS', key: 'cumulativeLayoutShift', width: 14 },
    { header: 'Speed Index', key: 'speedIndex', width: 14 },
    { header: 'TTI', key: 'timeToInteractive', width: 14 },
    { header: 'Error', key: 'error', width: 30 },
  ];
  perfSheet.addRows(auditResult.pageSpeedResults ?? []);

  const filename = buildFilename(`audit-${auditResult.id}`, 'xlsx');
  const filepath = path.join(config.paths.reports, filename);
  await workbook.xlsx.writeFile(filepath);

  logger.info('Excel report generated', { filepath });
  return filepath;
}

export default generateExcelReport;
