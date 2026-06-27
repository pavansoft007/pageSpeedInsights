import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createObjectCsvWriter } from 'csv-writer';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import {
  buildReportRow,
  buildSummaryStats,
  buildStatusCodeMap,
} from './pagespeedReportFormatter.js';

const REPORT_COLUMNS = [
  { header: 'URL', key: 'url', width: 45 },
  { header: 'Status Code', key: 'statusCode', width: 12 },
  { header: 'Mobile Performance', key: 'mobilePerformance', width: 18 },
  { header: 'Desktop Performance', key: 'desktopPerformance', width: 18 },
  { header: 'Mobile Accessibility', key: 'mobileAccessibility', width: 18 },
  { header: 'Desktop Accessibility', key: 'desktopAccessibility', width: 18 },
  { header: 'Mobile Best Practices', key: 'mobileBestPractices', width: 20 },
  { header: 'Desktop Best Practices', key: 'desktopBestPractices', width: 20 },
  { header: 'Mobile SEO', key: 'mobileSeo', width: 14 },
  { header: 'Desktop SEO', key: 'desktopSeo', width: 14 },
  { header: 'FCP Mobile', key: 'fcpMobile', width: 14 },
  { header: 'FCP Desktop', key: 'fcpDesktop', width: 14 },
  { header: 'LCP Mobile', key: 'lcpMobile', width: 14 },
  { header: 'LCP Desktop', key: 'lcpDesktop', width: 14 },
  { header: 'INP Mobile', key: 'inpMobile', width: 14 },
  { header: 'INP Desktop', key: 'inpDesktop', width: 14 },
  { header: 'CLS Mobile', key: 'clsMobile', width: 14 },
  { header: 'CLS Desktop', key: 'clsDesktop', width: 14 },
  { header: 'Speed Index Mobile', key: 'speedIndexMobile', width: 18 },
  { header: 'Speed Index Desktop', key: 'speedIndexDesktop', width: 18 },
  { header: 'Total Blocking Time Mobile', key: 'totalBlockingTimeMobile', width: 24 },
  { header: 'Total Blocking Time Desktop', key: 'totalBlockingTimeDesktop', width: 24 },
  { header: 'Time To Interactive Mobile', key: 'timeToInteractiveMobile', width: 24 },
  { header: 'Time To Interactive Desktop', key: 'timeToInteractiveDesktop', width: 24 },
  { header: 'Issues Count', key: 'issuesCount', width: 14 },
  { header: 'Date', key: 'date', width: 14 },
];

const SCORE_COLUMN_KEYS = new Set([
  'mobilePerformance',
  'desktopPerformance',
  'mobileAccessibility',
  'desktopAccessibility',
  'mobileBestPractices',
  'desktopBestPractices',
  'mobileSeo',
  'desktopSeo',
]);

const COLORS = {
  green: 'FFC6EFCE',
  yellow: 'FFFFEB9C',
  red: 'FFFFC7CE',
  header: 'FF4472C4',
  headerFont: 'FFFFFFFF',
  summaryLabel: 'FFD9E1F2',
};

function ensureReportsDir() {
  fs.mkdirSync(config.paths.reports, { recursive: true });
}

function getReportDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function buildReportBasename(date = new Date()) {
  return `pagespeed-report-${getReportDate(date)}`;
}

function resolveReportBasename(options = {}) {
  if (options.outputBasename) {
    return options.outputBasename;
  }

  return buildReportBasename(options.date ? new Date(options.date) : new Date());
}

function scoreBar(score) {
  if (typeof score !== 'number') {
    return '';
  }

  const filled = Math.max(0, Math.min(20, Math.round(score / 5)));
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`;
}

function applyHeaderStyle(row) {
  row.font = { bold: true, color: { argb: COLORS.headerFont } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    };
  });
}

function applyScoreFill(cell, score) {
  if (typeof score !== 'number') {
    return;
  }

  let color = COLORS.red;
  if (score >= 90) {
    color = COLORS.green;
  } else if (score >= 50) {
    color = COLORS.yellow;
  }

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  };
}

function autoFitColumns(worksheet, minWidth = 10, maxWidth = 55) {
  worksheet.columns.forEach((column) => {
    let maxLength = column.header?.length ?? minWidth;

    column.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, value.length);
    });

    column.width = Math.min(Math.max(maxLength + 2, minWidth), maxWidth);
  });
}

function applyScoreConditionalFormatting(worksheet, rowCount) {
  REPORT_COLUMNS.forEach((column, index) => {
    if (!SCORE_COLUMN_KEYS.has(column.key)) {
      return;
    }

    const letter = worksheet.getColumn(index + 1).letter;

    worksheet.addConditionalFormatting({
      ref: `${letter}2:${letter}${Math.max(rowCount, 2)}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThanOrEqual',
          formulae: [90],
          priority: 1,
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.green } },
          },
        },
        {
          type: 'cellIs',
          operator: 'between',
          formulae: [50, 89],
          priority: 2,
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.yellow } },
          },
        },
        {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: [50],
          priority: 3,
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.red } },
          },
        },
      ],
    });
  });
}

function styleDataSheet(worksheet, rows) {
  worksheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
  applyHeaderStyle(worksheet.getRow(1));

  rows.forEach((rowData, index) => {
    const row = worksheet.getRow(index + 2);
    row.alignment = { vertical: 'middle', wrapText: true };

    for (const key of SCORE_COLUMN_KEYS) {
      const columnIndex = REPORT_COLUMNS.findIndex((column) => column.key === key) + 1;
      applyScoreFill(row.getCell(columnIndex), rowData[key]);
    }
  });

  autoFitColumns(worksheet);
  applyScoreConditionalFormatting(worksheet, rows.length + 1);
}

function addSummarySheet(workbook, summary, reportDate) {
  const sheet = workbook.addWorksheet('Summary');
  sheet.properties.defaultColWidth = 24;

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = 'Website Performance Auditor - Summary';
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F4E78' } };

  sheet.getCell('A3').value = 'Report Date';
  sheet.getCell('B3').value = reportDate;

  const overviewRows = [
    ['Total Pages', summary.totalPages],
    ['Passed Pages', summary.passedPages],
    ['Failed Pages', summary.failedPages],
    ['Average Performance', summary.averageScores.performance],
    ['Average Accessibility', summary.averageScores.accessibility],
    ['Average Best Practices', summary.averageScores.bestPractices],
    ['Average SEO', summary.averageScores.seo],
    ['Highest Score', summary.highestScore],
    ['Lowest Score', summary.lowestScore],
  ];

  sheet.getCell('A5').value = 'Metric';
  sheet.getCell('B5').value = 'Value';
  applyHeaderStyle(sheet.getRow(5));

  overviewRows.forEach(([label, value], index) => {
    const rowNumber = 6 + index;
    sheet.getCell(`A${rowNumber}`).value = label;
    sheet.getCell(`B${rowNumber}`).value = value;
    sheet.getCell(`A${rowNumber}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.summaryLabel },
    };

    if (typeof value === 'number' && label.includes('Average')) {
      applyScoreFill(sheet.getCell(`B${rowNumber}`), value);
    }
  });

  const chartStartRow = 6 + overviewRows.length + 2;
  sheet.getCell(`A${chartStartRow}`).value = 'Average Scores by Category';
  sheet.getCell(`A${chartStartRow}`).font = { bold: true, size: 12 };

  const chartHeaderRow = chartStartRow + 1;
  ['Category', 'Mobile', 'Desktop', 'Mobile Chart', 'Desktop Chart'].forEach((header, index) => {
    sheet.getCell(chartHeaderRow, index + 1).value = header;
  });
  applyHeaderStyle(sheet.getRow(chartHeaderRow));

  summary.categoryAverages.forEach((item, index) => {
    const rowNumber = chartHeaderRow + 1 + index;
    sheet.getCell(`A${rowNumber}`).value = item.category;
    sheet.getCell(`B${rowNumber}`).value = item.mobile;
    sheet.getCell(`C${rowNumber}`).value = item.desktop;
    sheet.getCell(`D${rowNumber}`).value = scoreBar(item.mobile);
    sheet.getCell(`E${rowNumber}`).value = scoreBar(item.desktop);
    applyScoreFill(sheet.getCell(`B${rowNumber}`), item.mobile);
    applyScoreFill(sheet.getCell(`C${rowNumber}`), item.desktop);
    sheet.getCell(`D${rowNumber}`).font = { name: 'Consolas' };
    sheet.getCell(`E${rowNumber}`).font = { name: 'Consolas' };
  });

  const pageChartStart = chartHeaderRow + summary.categoryAverages.length + 3;
  sheet.getCell(`A${pageChartStart}`).value = 'Performance by Page';
  sheet.getCell(`A${pageChartStart}`).font = { bold: true, size: 12 };

  const pageHeaderRow = pageChartStart + 1;
  ['URL', 'Mobile Performance', 'Desktop Performance', 'Mobile Chart', 'Desktop Chart'].forEach(
    (header, index) => {
      sheet.getCell(pageHeaderRow, index + 1).value = header;
    }
  );
  applyHeaderStyle(sheet.getRow(pageHeaderRow));

  summary.performanceByPage.slice(0, 15).forEach((item, index) => {
    const rowNumber = pageHeaderRow + 1 + index;
    sheet.getCell(`A${rowNumber}`).value = item.url;
    sheet.getCell(`B${rowNumber}`).value = item.mobile;
    sheet.getCell(`C${rowNumber}`).value = item.desktop;
    sheet.getCell(`D${rowNumber}`).value = scoreBar(item.mobile);
    sheet.getCell(`E${rowNumber}`).value = scoreBar(item.desktop);
    applyScoreFill(sheet.getCell(`B${rowNumber}`), item.mobile);
    applyScoreFill(sheet.getCell(`C${rowNumber}`), item.desktop);
    sheet.getCell(`D${rowNumber}`).font = { name: 'Consolas' };
    sheet.getCell(`E${rowNumber}`).font = { name: 'Consolas' };
  });

  autoFitColumns(sheet, 12, 70);
  sheet.views = [{ state: 'frozen', ySplit: 5, activeCell: 'A6' }];
}

export function preparePageSpeedReportData(pageSpeedResults, pages = []) {
  const statusCodeMap = buildStatusCodeMap(pages);
  const rows = pageSpeedResults.map((result) => buildReportRow(result, statusCodeMap));
  const summary = buildSummaryStats(rows);
  return { rows, summary };
}

export async function generatePageSpeedExcelReport(pageSpeedResults, options = {}) {
  ensureReportsDir();

  const { rows, summary } = preparePageSpeedReportData(
    pageSpeedResults,
    options.pages ?? []
  );
  const reportDate = options.date ?? getReportDate();
  const basename = resolveReportBasename(options);
  const filepath = path.join(config.paths.reports, `${basename}.xlsx`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Website Performance Auditor';
  workbook.created = new Date();
  workbook.modified = new Date();

  const dataSheet = workbook.addWorksheet('PageSpeed Report');
  dataSheet.columns = REPORT_COLUMNS;
  dataSheet.addRows(rows);
  styleDataSheet(dataSheet, rows);

  addSummarySheet(workbook, summary, reportDate);

  await workbook.xlsx.writeFile(filepath);
  logger.info('PageSpeed Excel report generated', { filepath, rows: rows.length });
  return filepath;
}

export async function generatePageSpeedCsvReport(pageSpeedResults, options = {}) {
  ensureReportsDir();

  const { rows } = preparePageSpeedReportData(pageSpeedResults, options.pages ?? []);
  const basename = resolveReportBasename(options);
  const filepath = path.join(config.paths.reports, `${basename}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: REPORT_COLUMNS.map((column) => ({
      id: column.key,
      title: column.header,
    })),
  });

  await csvWriter.writeRecords(rows);
  logger.info('PageSpeed CSV report generated', { filepath, rows: rows.length });
  return filepath;
}

export async function generatePageSpeedReports(pageSpeedResults, options = {}) {
  const [excel, csv] = await Promise.all([
    generatePageSpeedExcelReport(pageSpeedResults, options),
    generatePageSpeedCsvReport(pageSpeedResults, options),
  ]);

  return { excel, csv };
}

export default generatePageSpeedReports;
