import { generateExcelReport } from './excelReport.js';
import { generateCsvReport } from './csvReport.js';
import logger from '../utils/logger.js';

export class ReportService {
  async generateAll(auditResult) {
    const [excelPath, csvPath] = await Promise.all([
      generateExcelReport(auditResult),
      generateCsvReport(auditResult),
    ]);

    const reports = { excel: excelPath, csv: csvPath };
    logger.info('All reports generated', reports);
    return reports;
  }

  async generateExcel(auditResult) {
    return generateExcelReport(auditResult);
  }

  async generateCsv(auditResult) {
    return generateCsvReport(auditResult);
  }
}

export const reportService = new ReportService();
export default reportService;
