import { generateExcelReport } from './excelReport.js';
import { generateCsvReport } from './csvReport.js';
import { generatePageSpeedReports } from './pagespeedReport.js';
import logger from '../utils/logger.js';

export class ReportService {
  async generateAll(auditResult) {
    const pageSpeedResults =
      auditResult.pageSpeedFullResults ??
      auditResult.pageSpeedResults ??
      [];

    const [legacyReports, pageSpeedReports] = await Promise.all([
      Promise.all([
        generateExcelReport(auditResult),
        generateCsvReport(auditResult),
      ]),
      generatePageSpeedReports(pageSpeedResults, { pages: auditResult.pages ?? [] }),
    ]);

    const reports = {
      excel: legacyReports[0],
      csv: legacyReports[1],
      pageSpeedExcel: pageSpeedReports.excel,
      pageSpeedCsv: pageSpeedReports.csv,
    };

    logger.info('All reports generated', reports);
    return reports;
  }

  async generateExcel(auditResult) {
    return generateExcelReport(auditResult);
  }

  async generateCsv(auditResult) {
    return generateCsvReport(auditResult);
  }

  async generatePageSpeed(pageSpeedResults, options = {}) {
    return generatePageSpeedReports(pageSpeedResults, options);
  }
}

export const reportService = new ReportService();
export default reportService;
