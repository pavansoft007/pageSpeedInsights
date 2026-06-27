import * as cheerio from 'cheerio';
import { isSameOrigin, resolveUrl } from '../utils/url.js';

export function extractLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = new Set();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    const resolved = resolveUrl(pageUrl, href);
    if (resolved && isSameOrigin(pageUrl, resolved)) {
      links.add(resolved.split('#')[0]);
    }
  });

  return [...links];
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

export default extractLinks;
