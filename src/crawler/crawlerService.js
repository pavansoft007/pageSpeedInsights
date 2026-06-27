import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { normalizeUrl } from '../utils/url.js';
import { fetchPage } from './playwrightClient.js';
import { extractLinks, extractPageMetadata } from './linkExtractor.js';

export class CrawlerService {
  constructor(options = {}) {
    this.maxPages = options.maxPages ?? config.crawler.maxPages;
    this.maxDepth = options.maxDepth ?? config.crawler.maxDepth;
    this.timeoutMs = options.timeoutMs ?? config.crawler.timeoutMs;
  }

  async crawl(startUrl) {
    const origin = normalizeUrl(startUrl);
    const visited = new Set();
    const queue = [{ url: origin, depth: 0 }];
    const pages = [];

    logger.info('Starting crawl', { startUrl: origin, maxPages: this.maxPages });

    while (queue.length > 0 && pages.length < this.maxPages) {
      const { url, depth } = queue.shift();

      if (visited.has(url)) {
        continue;
      }
      visited.add(url);

      try {
        const { html, statusCode, finalUrl } = await fetchPage(url, this.timeoutMs);
        const metadata = extractPageMetadata(html);

        pages.push({
          url,
          finalUrl,
          depth,
          statusCode,
          ...metadata,
          crawledAt: new Date().toISOString(),
        });

        if (depth < this.maxDepth) {
          const links = extractLinks(html, finalUrl);
          for (const link of links) {
            if (!visited.has(link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to crawl page', { url, error: error.message });
        pages.push({
          url,
          finalUrl: url,
          depth,
          statusCode: 0,
          title: null,
          description: null,
          h1Count: 0,
          linkCount: 0,
          imageCount: 0,
          scriptCount: 0,
          error: error.message,
          crawledAt: new Date().toISOString(),
        });
      }
    }

    logger.info('Crawl completed', { pagesFound: pages.length });
    return pages;
  }
}

export const crawlerService = new CrawlerService();
export default crawlerService;
