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
    concurrency: parseIntEnv('PAGESPEED_CONCURRENCY', 3),
    timeoutMs: parseIntEnv('PAGESPEED_TIMEOUT_MS', 60_000),
    apiUrl: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  },
  crawler: {
    maxPages: parseIntEnv('CRAWL_MAX_PAGES', 10),
    maxDepth: parseIntEnv('CRAWL_MAX_DEPTH', 2),
    timeoutMs: parseIntEnv('CRAWL_TIMEOUT_MS', 30_000),
  },
  paths: {
    reports: path.resolve(projectRoot, process.env.REPORTS_DIR ?? 'reports'),
    logs: path.resolve(projectRoot, process.env.LOGS_DIR ?? 'logs'),
  },
};

export default config;
