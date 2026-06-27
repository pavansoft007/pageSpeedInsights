import * as cheerio from 'cheerio';
import { normalizeCrawlUrl } from './urlNormalizer.js';
import { shouldCrawlUrl } from './urlFilter.js';
import logger from '../utils/logger.js';

function parseLocElements($, origin) {
  const urls = [];

  $('url > loc').each((_, element) => {
    const loc = $(element).text().trim();
    const normalized = normalizeCrawlUrl(loc, origin);

    if (normalized && shouldCrawlUrl(normalized)) {
      urls.push(normalized);
    }
  });

  return urls;
}

function parseSitemapRefs($, origin) {
  const sitemaps = [];

  $('sitemap > loc').each((_, element) => {
    const loc = $(element).text().trim();
    const normalized = normalizeCrawlUrl(loc, origin);

    if (normalized) {
      sitemaps.push(normalized);
    }
  });

  return sitemaps;
}

export function parseSitemapXml(xml, origin) {
  if (!xml) {
    return { urls: [], sitemaps: [] };
  }

  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = parseLocElements($, origin);
  const nestedSitemaps = parseSitemapRefs($, origin);

  logger.debug('Sitemap XML parsed', {
    urls: urls.length,
    nestedSitemaps: nestedSitemaps.length,
  });

  return {
    urls: [...new Set(urls)],
    sitemaps: [...new Set(nestedSitemaps)],
  };
}

export default parseSitemapXml;
