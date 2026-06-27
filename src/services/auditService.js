import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { CrawlerService } from '../crawler/crawlerService.js';
import { PageSpeedService } from '../pagespeed/pagespeedService.js';
import { reportService } from '../reports/reportService.js';
import { closeBrowser } from '../crawler/playwrightClient.js';
import { normalizeUrl, isValidHttpUrl } from '../utils/url.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const audits = new Map();

export class AuditService {
  createAuditRecord(startUrl, options = {}) {
    const id = randomUUID();
    const record = {
      id,
      startUrl: normalizeUrl(startUrl),
      status: 'pending',
      options: {
        maxPages: options.maxPages ?? config.crawler.maxPages,
        maxDepth: options.maxDepth ?? config.crawler.maxDepth,
        strategy: options.strategy ?? config.pagespeed.strategy,
        generateReports: options.generateReports ?? true,
      },
      startedAt: new Date().toISOString(),
      completedAt: null,
      pages: [],
      pageSpeedResults: [],
      reports: null,
      error: null,
    };

    audits.set(id, record);
    return record;
  }

  getAudit(id) {
    const audit = audits.get(id);
    if (!audit) {
      throw new NotFoundError(`Audit not found: ${id}`);
    }
    return audit;
  }

  listAudits() {
    return [...audits.values()].map(({ id, startUrl, status, startedAt, completedAt }) => ({
      id,
      startUrl,
      status,
      startedAt,
      completedAt,
    }));
  }

  validateStartUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('A valid URL is required');
    }

    const normalized = normalizeUrl(url);
    if (!isValidHttpUrl(normalized)) {
      throw new ValidationError('URL must use http or https protocol');
    }

    return normalized;
  }

  async runAudit(auditId) {
    const audit = this.getAudit(auditId);
    audit.status = 'running';

    const crawler = new CrawlerService({
      maxPages: audit.options.maxPages,
      maxDepth: audit.options.maxDepth,
    });

    const pageSpeed = new PageSpeedService({
      concurrency: config.pagespeed.concurrency,
    });

    try {
      audit.pages = await crawler.crawl(audit.startUrl);

      const urls = [...new Set(audit.pages.map((page) => page.finalUrl || page.url))];
      const pageSpeedResults = await pageSpeed.analyzeUrls(urls, { showProgress: true });
      audit.pageSpeedResults = pageSpeed.flattenResults(pageSpeedResults);
      audit.pageSpeedFullResults = pageSpeedResults;

      if (audit.options.generateReports) {
        audit.reports = await reportService.generateAll(audit);
      }

      audit.status = 'completed';
      audit.completedAt = new Date().toISOString();
      logger.info('Audit completed', { auditId, pages: audit.pages.length });
    } catch (error) {
      audit.status = 'failed';
      audit.error = error.message;
      audit.completedAt = new Date().toISOString();
      logger.error('Audit failed', { auditId, error: error.message });
      throw error;
    } finally {
      await closeBrowser();
    }

    return audit;
  }

  startAudit(url, options = {}) {
    const startUrl = this.validateStartUrl(url);
    const audit = this.createAuditRecord(startUrl, options);

    this.runAudit(audit.id).catch(() => {
      // Errors are stored on the audit record
    });

    return audit;
  }

  async runAuditSync(url, options = {}) {
    const startUrl = this.validateStartUrl(url);
    const audit = this.createAuditRecord(startUrl, options);
    await this.runAudit(audit.id);
    return audit;
  }
}

export const auditService = new AuditService();
export default auditService;
