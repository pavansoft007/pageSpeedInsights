import { chromium } from 'playwright';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

let browserInstance = null;
let contextInstance = null;

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'stylesheet', 'font', 'media', 'manifest']);
const BLOCKED_URL_PATTERN =
  /\.(pdf|zip|rar|7z|gz|jpe?g|png|gif|webp|svg|ico|bmp|avif|tiff?)(\?|#|$)/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
    logger.debug('Playwright browser launched');
  }
  return browserInstance;
}

async function getContext() {
  if (!contextInstance) {
    const browser = await getBrowser();
    contextInstance = await browser.newContext({
      userAgent: 'WebsitePerformanceAuditor/1.0 (+https://github.com/website-performance-auditor)',
      ignoreHTTPSErrors: true,
    });

    await contextInstance.route('**/*', (route) => {
      const request = route.request();
      const resourceType = request.resourceType();

      if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
        return route.abort();
      }

      if (BLOCKED_URL_PATTERN.test(request.url())) {
        return route.abort();
      }

      return route.continue();
    });
  }

  return contextInstance;
}

export async function initCrawlerBrowser() {
  await getContext();
}

export async function closeBrowser() {
  if (contextInstance) {
    await contextInstance.close();
    contextInstance = null;
  }

  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.debug('Playwright browser closed');
  }
}

async function fetchPageOnce(url, timeoutMs) {
  const context = await getContext();
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    const statusCode = response?.status() ?? 0;
    if (statusCode >= 400) {
      throw new Error(`HTTP ${statusCode} for ${url}`);
    }

    const html = await page.content();
    const finalUrl = page.url();

    return { html, statusCode, finalUrl };
  } finally {
    await page.close();
  }
}

export async function fetchPage(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? config.crawler.timeoutMs;
  const retries = options.retries ?? config.crawler.retries;
  const retryDelayMs = options.retryDelayMs ?? config.crawler.retryDelayMs;

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchPageOnce(url, timeoutMs);
    } catch (error) {
      lastError = error;
      logger.warn('Page fetch failed', {
        url,
        attempt,
        retries,
        error: error.message,
      });

      if (attempt < retries) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw lastError;
}

export default { getBrowser, initCrawlerBrowser, closeBrowser, fetchPage };
