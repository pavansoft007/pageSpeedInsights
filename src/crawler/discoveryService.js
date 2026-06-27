import { fetchText } from './httpClient.js';
import { parseRobotsTxt } from './robotsParser.js';
import { parseSitemapXml } from './sitemapParser.js';
import { normalizeCrawlUrl } from './urlNormalizer.js';
import logger from '../utils/logger.js';

export async function fetchRobotsTxt(origin) {
  const robotsUrl = `${origin}/robots.txt`;
  logger.info('Fetching robots.txt', { url: robotsUrl });

  const content = await fetchText(robotsUrl);
  if (!content) {
    logger.info('robots.txt not available', { url: robotsUrl });
    return { sitemaps: [], disallowRules: [] };
  }

  const parsed = parseRobotsTxt(content, origin);
  logger.info('robots.txt parsed', {
    sitemaps: parsed.sitemaps.length,
    disallowRules: parsed.disallowRules.length,
  });

  return parsed;
}

export async function discoverSitemapUrls(origin, robotsSitemaps, registry) {
  const defaultSitemaps = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const sitemapQueue = [...new Set([...robotsSitemaps, ...defaultSitemaps])].map((url) =>
    normalizeCrawlUrl(url, origin)
  ).filter(Boolean);

  const seenSitemaps = new Set();
  let queueIndex = 0;
  let totalFromSitemaps = 0;

  logger.info('Starting sitemap discovery', { entryPoints: sitemapQueue.length });

  while (queueIndex < sitemapQueue.length && registry.size() < registry.maxUrls) {
    const sitemapUrl = sitemapQueue[queueIndex++];

    if (seenSitemaps.has(sitemapUrl)) {
      continue;
    }

    seenSitemaps.add(sitemapUrl);
    logger.info('Fetching sitemap', { url: sitemapUrl });

    const xml = await fetchText(sitemapUrl);
    if (!xml) {
      continue;
    }

    const parsed = parseSitemapXml(xml, origin);

    for (const nestedSitemap of parsed.sitemaps) {
      if (!seenSitemaps.has(nestedSitemap)) {
        sitemapQueue.push(nestedSitemap);
        logger.debug('Nested sitemap queued', { url: nestedSitemap });
      }
    }

    for (const url of parsed.urls) {
      if (registry.addFromSitemap(url)) {
        totalFromSitemaps += 1;
      }

      if (registry.size() >= registry.maxUrls) {
        logger.info('Sitemap discovery reached max URL limit', { maxUrls: registry.maxUrls });
        break;
      }
    }
  }

  logger.info('Sitemap discovery finished', {
    sitemapsProcessed: seenSitemaps.size,
    urlsAdded: totalFromSitemaps,
    totalCanonicalUrls: registry.size(),
  });

  return totalFromSitemaps;
}

export default { fetchRobotsTxt, discoverSitemapUrls };
