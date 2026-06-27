import axios from 'axios';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

const client = axios.create({
  timeout: config.crawler.timeoutMs,
  maxRedirects: 5,
  validateStatus: (status) => status < 500,
  headers: {
    'User-Agent': 'WebsitePerformanceAuditor/1.0 (+https://github.com/website-performance-auditor)',
    Accept: 'text/plain,text/xml,application/xml',
  },
});

export async function fetchText(url, options = {}) {
  const retries = options.retries ?? config.crawler.retries;
  const retryDelayMs = options.retryDelayMs ?? config.crawler.retryDelayMs;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug('HTTP fetch started', { url, attempt });

      const response = await client.get(url, {
        responseType: 'text',
        timeout: options.timeoutMs ?? config.crawler.timeoutMs,
      });

      if (response.status === 404) {
        logger.debug('HTTP resource not found', { url, status: response.status });
        return null;
      }

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      logger.debug('HTTP fetch completed', { url, status: response.status, bytes: response.data?.length ?? 0 });
      return response.data;
    } catch (error) {
      lastError = error;
      logger.warn('HTTP fetch failed', { url, attempt, retries, error: error.message });

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  logger.error('HTTP fetch exhausted retries', { url, error: lastError?.message });
  return null;
}

export default { fetchText };
