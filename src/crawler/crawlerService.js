import pLimit from 'p-limit';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { createProgressBar } from '../utils/progress.js';
import { getOrigin, normalizeCrawlUrl } from './urlNormalizer.js';
import { shouldCrawlUrl } from './urlFilter.js';
import {
  extractCanonicalUrl,
  extractCrawlLinks,
  extractPageMetadata,
} from './linkExtractor.js';
import { closeBrowser, fetchPage, initCrawlerBrowser } from './playwrightClient.js';
import { fetchRobotsTxt, discoverSitemapUrls } from './discoveryService.js';
import { UrlRegistry } from './urlRegistry.js';

export class CrawlerService {
  constructor(options = {}) {
    this.maxUrls = options.maxUrls ?? options.maxPages ?? config.crawler.maxPages;
    this.concurrency = options.concurrency ?? config.crawler.concurrency;
    this.timeoutMs = options.timeoutMs ?? config.crawler.timeoutMs;
    this.retries = options.retries ?? config.crawler.retries;
    this.retryDelayMs = options.retryDelayMs ?? config.crawler.retryDelayMs;
    this.showProgress = options.showProgress ?? true;
    this.preferSitemap = options.preferSitemap ?? config.crawler.preferSitemap;
  }

  validateStartUrl(startUrl) {
    if (!startUrl || typeof startUrl !== 'string') {
      throw new Error('A valid start URL is required');
    }

    const origin = getOrigin(startUrl);
    const normalized = normalizeCrawlUrl(startUrl, origin);

    if (!normalized || !shouldCrawlUrl(normalized)) {
      throw new Error(`Invalid or blocked start URL: ${startUrl}`);
    }

    return { origin, normalized };
  }

  async discoverUrls(startUrl) {
    const { origin, normalized } = this.validateStartUrl(startUrl);
    const robots = await fetchRobotsTxt(origin);
    const registry = new UrlRegistry(origin, this.maxUrls, robots.disallowRules);

    if (this.preferSitemap) {
      const sitemapCount = await discoverSitemapUrls(origin, robots.sitemaps, registry);

      if (sitemapCount > 0) {
        logger.info('URL discovery completed via sitemap', {
          startUrl: normalized,
          urls: registry.size(),
          stats: registry.getStats(),
        });
        return {
          urls: registry.toSortedArray(),
          discoveryMethod: 'sitemap',
          stats: registry.getStats(),
        };
      }

      logger.info('No sitemap URLs found, falling back to queue crawl', { startUrl: normalized });
    }

    registry.enqueue(normalized);
    const urls = await this.runQueueCrawl(origin, registry);
    return {
      urls,
      discoveryMethod: 'crawl',
      stats: registry.getStats(),
    };
  }

  async runQueueCrawl(origin, registry) {
    let inFlight = 0;
    let crawlErrors = 0;
    const limit = pLimit(this.concurrency);
    const progress = this.showProgress
      ? createProgressBar(registry.maxUrls, 'Crawling')
      : null;

    progress?.update({ url: '', value: registry.size() });

    await initCrawlerBrowser();

    const processUrl = async (url) => {
      if (registry.size() >= registry.maxUrls) {
        return;
      }

      registry.markRequested(url);
      logger.info('Crawling page', { url, discovered: registry.size() });

      try {
        const { html, finalUrl } = await fetchPage(url, {
          timeoutMs: this.timeoutMs,
          retries: this.retries,
          retryDelayMs: this.retryDelayMs,
        });

        const pageUrl = normalizeCrawlUrl(finalUrl, origin) ?? url;
        const canonical = extractCanonicalUrl(html, pageUrl, origin) ?? pageUrl;
        registry.tryAddCanonical(canonical, pageUrl);

        progress?.update({ url: pageUrl, value: registry.size() });

        if (registry.size() >= registry.maxUrls) {
          return;
        }

        for (const link of extractCrawlLinks(html, pageUrl, origin)) {
          registry.enqueue(link);
        }
      } catch (error) {
        crawlErrors += 1;
        logger.warn('Failed to crawl page after retries', { url, error: error.message });
      }
    };

    const pump = async () => {
      while (registry.size() < registry.maxUrls) {
        const batch = [];

        while (batch.length < this.concurrency) {
          const url = registry.dequeue();
          if (!url) {
            break;
          }

          batch.push(
            limit(async () => {
              inFlight += 1;
              try {
                await processUrl(url);
              } finally {
                inFlight -= 1;
              }
            })
          );
        }

        if (batch.length > 0) {
          await Promise.all(batch);
          continue;
        }

        if (!registry.hasPending() && inFlight === 0) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      while (inFlight > 0) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };

    try {
      logger.info('Starting queue-based crawl', {
        origin,
        maxUrls: registry.maxUrls,
        concurrency: this.concurrency,
      });

      await pump();

      const urls = registry.toSortedArray();
      logger.info('Queue crawl completed', {
        urlsFound: urls.length,
        errors: crawlErrors,
        stats: registry.getStats(),
      });

      progress?.stop();
      return urls;
    } finally {
      await closeBrowser();
    }
  }

  async crawlUrls(startUrl) {
    const result = await this.discoverUrls(startUrl);
    return result.urls;
  }

  async crawl(startUrl) {
    const urls = await this.crawlUrls(startUrl);

    return urls.map((url) => ({
      url,
      finalUrl: url,
      depth: 0,
      statusCode: 200,
      title: null,
      description: null,
      h1Count: 0,
      linkCount: 0,
      imageCount: 0,
      scriptCount: 0,
      crawledAt: new Date().toISOString(),
    }));
  }

  async crawlWithMetadata(startUrl) {
    const { origin, normalized } = this.validateStartUrl(startUrl);
    const urls = await this.crawlUrls(startUrl);

    await initCrawlerBrowser();

    try {
      const pages = [];

      for (const url of urls) {
        try {
          const { html, statusCode, finalUrl } = await fetchPage(url, {
            timeoutMs: this.timeoutMs,
            retries: this.retries,
            retryDelayMs: this.retryDelayMs,
          });

          const pageUrl = normalizeCrawlUrl(finalUrl, origin) ?? url;
          pages.push({
            url,
            finalUrl: pageUrl,
            depth: 0,
            statusCode,
            ...extractPageMetadata(html),
            crawledAt: new Date().toISOString(),
          });
        } catch (error) {
          pages.push({
            url,
            finalUrl: url,
            depth: 0,
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

      return pages;
    } finally {
      await closeBrowser();
    }
  }
}

export async function crawlWebsite(startUrl, options = {}) {
  const crawler = new CrawlerService(options);
  const result = await crawler.discoverUrls(startUrl);
  return result.urls;
}

export async function discoverWebsite(startUrl, options = {}) {
  const crawler = new CrawlerService(options);
  return crawler.discoverUrls(startUrl);
}

export const crawlerService = new CrawlerService();
export default crawlerService;
