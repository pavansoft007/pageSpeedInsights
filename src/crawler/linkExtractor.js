import * as cheerio from 'cheerio';
import { normalizeCrawlUrl } from './urlNormalizer.js';
import { isIgnoredHref, shouldCrawlUrl } from './urlFilter.js';

export function extractCanonicalUrl(html, pageUrl, allowedOrigin) {
  const $ = cheerio.load(html);
  const href = $('link[rel="canonical"]').attr('href')?.trim();

  if (!href) {
    return null;
  }

  return normalizeCrawlUrl(href, allowedOrigin) ?? normalizeCrawlUrl(href, pageUrl);
}

export function extractCrawlLinks(html, pageUrl, allowedOrigin) {
  const $ = cheerio.load(html);
  const links = new Set();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim();
    if (isIgnoredHref(href)) {
      return;
    }

    const normalized = normalizeCrawlUrl(href, allowedOrigin);
    if (normalized && shouldCrawlUrl(normalized) && normalized !== pageUrl) {
      links.add(normalized);
    }
  });

  return links;
}

export function extractPageMetadata(html) {
  const $ = cheerio.load(html);

  return {
    title: $('title').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content')?.trim() || null,
    h1Count: $('h1').length,
    linkCount: $('a[href]').length,
    imageCount: $('img').length,
    scriptCount: $('script').length,
  };
}

export default extractCrawlLinks;
