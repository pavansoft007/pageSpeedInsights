import { chromium } from 'playwright';
import logger from '../utils/logger.js';

let browserInstance = null;

export async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
    logger.debug('Playwright browser launched');
  }
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.debug('Playwright browser closed');
  }
}

export async function fetchPage(url, timeoutMs) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'WebsitePerformanceAuditor/1.0 (+https://github.com/website-performance-auditor)',
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    const html = await page.content();
    const statusCode = response?.status() ?? 0;
    const finalUrl = page.url();

    return { html, statusCode, finalUrl };
  } finally {
    await context.close();
  }
}

export default { getBrowser, closeBrowser, fetchPage };
