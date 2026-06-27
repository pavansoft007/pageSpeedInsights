import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(projectRoot, '.env') });

function parseIntEnv(key, defaultValue) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseIntEnv('PORT', 3000),
  projectRoot,
  pagespeed: {
    apiKey: process.env.PAGESPEED_API_KEY ?? '',
    strategy: process.env.PAGESPEED_STRATEGY ?? 'mobile',
    concurrency: parseIntEnv('PAGESPEED_CONCURRENCY', 5),
    retries: parseIntEnv('PAGESPEED_RETRIES', 3),
    retryDelayMs: parseIntEnv('PAGESPEED_RETRY_DELAY_MS', 2000),
    rateLimitDelayMs: parseIntEnv('PAGESPEED_RATE_LIMIT_DELAY_MS', 2000),
    timeoutMs: parseIntEnv('PAGESPEED_TIMEOUT_MS', 60_000),
    apiUrl: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  },
  crawler: {
    maxPages: parseIntEnv('CRAWL_MAX_PAGES', 10_000),
    maxDepth: parseIntEnv('CRAWL_MAX_DEPTH', 100),
    concurrency: parseIntEnv('CRAWL_CONCURRENCY', 5),
    retries: parseIntEnv('CRAWL_RETRIES', 3),
    retryDelayMs: parseIntEnv('CRAWL_RETRY_DELAY_MS', 1000),
    timeoutMs: parseIntEnv('CRAWL_TIMEOUT_MS', 30_000),
    preferSitemap: process.env.CRAWL_PREFER_SITEMAP !== 'false',
  },
  paths: {
    reports: path.resolve(projectRoot, process.env.REPORTS_DIR ?? 'reports'),
    logs: path.resolve(projectRoot, process.env.LOGS_DIR ?? 'logs'),
    queue: path.resolve(projectRoot, process.env.QUEUE_STATE_DIR ?? 'reports/queue'),
    checkpoint: path.resolve(projectRoot, process.env.CHECKPOINT_DIR ?? 'reports/checkpoint'),
  },
  queue: {
    concurrency: parseIntEnv('PAGESPEED_QUEUE_CONCURRENCY', 5),
    maxRetries: parseIntEnv('PAGESPEED_QUEUE_MAX_RETRIES', 3),
  },
};

export default config;
