import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { AuditPipeline } from '../pipeline/auditPipeline.js';
import { WebUiAdapter } from '../adapters/webUiAdapter.js';
import { AuditProgress } from '../utils/auditProgress.js';
import { normalizeStartUrl } from '../crawler/urlNormalizer.js';
import { isValidHttpUrl } from '../utils/url.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const jobs = new Map();

class WebAuditProgress extends AuditProgress {
  constructor(total, job) {
    super(total);
    this.job = job;
    this.job.progress = {
      completed: 0,
      total,
      errors: 0,
      percentage: 0,
    };
  }

  update(completed, errors = 0) {
    super.update(completed, errors);
    this.job.progress = {
      completed,
      total: this.total,
      errors,
      percentage: this.total > 0 ? Math.round((completed / this.total) * 100) : 0,
    };
  }
}

function sanitizeJob(job) {
  return {
    id: job.id,
    url: job.url,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    summary: job.summary,
    reports: job.reports
      ? {
          excel: job.reports.excel ? path.basename(job.reports.excel) : null,
          csv: job.reports.csv ? path.basename(job.reports.csv) : null,
        }
      : null,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    messages: job.messages.slice(-20),
  };
}

export class WebAuditService {
  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('A valid URL is required');
    }

    const normalized = normalizeStartUrl(url);
    if (!normalized || !isValidHttpUrl(normalized)) {
      throw new ValidationError('Invalid URL. Example: https://example.com');
    }

    return normalized;
  }

  getJob(id) {
    const job = jobs.get(id);
    if (!job) {
      throw new NotFoundError(`Audit not found: ${id}`);
    }
    return job;
  }

  listJobs() {
    return [...jobs.values()]
      .map(sanitizeJob)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  getJobStatus(id) {
    return sanitizeJob(this.getJob(id));
  }

  getReportPath(id, type) {
    const job = this.getJob(id);
    const reportPath = type === 'csv' ? job.reports?.csv : job.reports?.excel;

    if (!reportPath || !fs.existsSync(reportPath)) {
      throw new NotFoundError('Report not found');
    }

    return reportPath;
  }

  startAudit(url, options = {}) {
    const normalized = this.validateUrl(url);
    const id = randomUUID();

    const job = {
      id,
      url: normalized,
      status: 'pending',
      stage: 'Starting',
      progress: { completed: 0, total: 0, errors: 0, percentage: 0 },
      summary: null,
      reports: null,
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      messages: [],
    };

    jobs.set(id, job);
    this.runAudit(job, options).catch((error) => {
      logger.error('Web audit failed', { id, error: error.message });
    });

    return sanitizeJob(job);
  }

  async runAudit(job, options) {
    job.status = 'running';
    const ui = new WebUiAdapter(job);
    const pipeline = new AuditPipeline({
      maxUrls: options.maxUrls,
      concurrency: options.concurrency,
      outputBasename: 'pagespeed-report',
    });

    pipeline.manager.registerShutdownHandlers = () => {};

    const originalRunPageSpeed = pipeline.manager.runPageSpeedPhase.bind(pipeline.manager);
    pipeline.manager.runPageSpeedPhase = async (state, _progress) => {
      const progress = new WebAuditProgress(state.stats.total, job);
      progress.update(state.stats.completedCount, state.stats.failedCount);
      return originalRunPageSpeed(state, progress);
    };

    try {
      const result = await pipeline.run(job.url, {
        ui,
        runLogger: ui.runLogger,
        validateDeps: { normalizeStartUrl, isValidHttpUrl },
      });

      job.status = result.status === 'completed' ? 'completed' : 'failed';
      job.summary = result.summary;
      job.reports = {
        excel: result.reportPath,
        csv: result.reportCsvPath,
      };
      job.completedAt = new Date().toISOString();
      job.stage = 'Finished';
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date().toISOString();
      job.stage = 'Failed';
      ui.error(error.message);
    }
  }
}

export const webAuditService = new WebAuditService();
export default webAuditService;
