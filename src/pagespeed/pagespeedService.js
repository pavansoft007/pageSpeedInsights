import pLimit from 'p-limit';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { createProgressBar } from '../utils/progress.js';
import { runPageSpeed } from './pagespeedClient.js';

function extractMetric(audits, auditId) {
  const audit = audits?.[auditId];
  if (!audit) {
    return null;
  }
  return audit.displayValue ?? audit.numericValue ?? null;
}

function parsePageSpeedResult(url, data, strategy) {
  const lighthouse = data.lighthouseResult ?? {};
  const categories = lighthouse.categories ?? {};
  const audits = lighthouse.audits ?? {};

  return {
    url,
    strategy,
    fetchedAt: new Date().toISOString(),
    performanceScore: categories.performance?.score != null
      ? Math.round(categories.performance.score * 100)
      : null,
    accessibilityScore: categories.accessibility?.score != null
      ? Math.round(categories.accessibility.score * 100)
      : null,
    bestPracticesScore: categories['best-practices']?.score != null
      ? Math.round(categories['best-practices'].score * 100)
      : null,
    seoScore: categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null,
    firstContentfulPaint: extractMetric(audits, 'first-contentful-paint'),
    largestContentfulPaint: extractMetric(audits, 'largest-contentful-paint'),
    totalBlockingTime: extractMetric(audits, 'total-blocking-time'),
    cumulativeLayoutShift: extractMetric(audits, 'cumulative-layout-shift'),
    speedIndex: extractMetric(audits, 'speed-index'),
    timeToInteractive: extractMetric(audits, 'interactive'),
  };
}

export class PageSpeedService {
  constructor(options = {}) {
    this.strategy = options.strategy ?? config.pagespeed.strategy;
    this.concurrency = options.concurrency ?? config.pagespeed.concurrency;
  }

  async analyzeUrl(url) {
    const data = await runPageSpeed(url, this.strategy);
    return parsePageSpeedResult(url, data, this.strategy);
  }

  async analyzeUrls(urls, { showProgress = false } = {}) {
    const limit = pLimit(this.concurrency);
    const progress = showProgress ? createProgressBar(urls.length, 'PageSpeed') : null;

    const tasks = urls.map((url) =>
      limit(async () => {
        progress?.update({ url });

        try {
          const result = await this.analyzeUrl(url);
          progress?.increment({ url });
          return result;
        } catch (error) {
          logger.warn('PageSpeed analysis failed', { url, error: error.message });
          progress?.increment({ url });
          return {
            url,
            strategy: this.strategy,
            fetchedAt: new Date().toISOString(),
            error: error.message,
          };
        }
      })
    );

    const results = await Promise.all(tasks);
    progress?.stop();

    logger.info('PageSpeed analysis completed', { total: results.length });
    return results;
  }
}

export const pageSpeedService = new PageSpeedService();
export default pageSpeedService;
