import pLimit from 'p-limit';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { createProgressBar } from '../utils/progress.js';
import { runPageSpeed } from './pagespeedClient.js';
import {
  parsePageSpeedResult,
  parseStrategyResult,
  flattenPageSpeedResult,
} from './pagespeedParser.js';

export class PageSpeedService {
  constructor(options = {}) {
    this.concurrency = options.concurrency ?? config.pagespeed.concurrency;
    this.retries = options.retries ?? config.pagespeed.retries;
    this.retryDelayMs = options.retryDelayMs ?? config.pagespeed.retryDelayMs;
    this.rateLimitDelayMs = options.rateLimitDelayMs ?? config.pagespeed.rateLimitDelayMs;
    this.showProgress = options.showProgress ?? false;
  }

  getRequestOptions() {
    return {
      retries: this.retries,
      retryDelayMs: this.retryDelayMs,
      rateLimitDelayMs: this.rateLimitDelayMs,
    };
  }

  async analyzeStrategy(url, strategy) {
    const data = await runPageSpeed(url, strategy, this.getRequestOptions());
    return parseStrategyResult(data, strategy);
  }

  async analyzeUrl(url) {
    const requestOptions = this.getRequestOptions();

    const mobileData = await runPageSpeed(url, 'mobile', requestOptions);
    const desktopData = await runPageSpeed(url, 'desktop', requestOptions);

    return parsePageSpeedResult(url, mobileData, desktopData);
  }

  async analyzeUrls(urls, { showProgress } = {}) {
    const limit = pLimit(this.concurrency);
    const useProgress = showProgress ?? this.showProgress;
    const progress = useProgress ? createProgressBar(urls.length, 'PageSpeed') : null;

    const tasks = urls.map((url) =>
      limit(async () => {
        try {
          const result = await this.analyzeUrl(url);
          progress?.increment({ url });
          return result;
        } catch (error) {
          logger.warn('PageSpeed analysis failed', { url, error: error.message });
          progress?.increment({ url });
          return {
            url,
            mobile: { strategy: 'mobile', error: error.message },
            desktop: { strategy: 'desktop', error: error.message },
          };
        }
      })
    );

    const results = await Promise.all(tasks);
    progress?.stop();

    logger.info('PageSpeed analysis completed', { total: results.length });
    return results;
  }

  flattenResults(results) {
    return results.flatMap((result) => flattenPageSpeedResult(result));
  }
}

export async function analyzePageSpeed(url, options = {}) {
  const service = new PageSpeedService(options);
  return service.analyzeUrl(url);
}

export async function analyzePageSpeedBatch(urls, options = {}) {
  const service = new PageSpeedService(options);
  return service.analyzeUrls(urls, options);
}

export { flattenPageSpeedResult };
export const pageSpeedService = new PageSpeedService();
export default pageSpeedService;
