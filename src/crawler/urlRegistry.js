import { normalizeCrawlUrl } from './urlNormalizer.js';
import { shouldCrawlUrl } from './urlFilter.js';
import { isDisallowedPath } from './robotsParser.js';
import logger from '../utils/logger.js';

export class UrlRegistry {
  constructor(origin, maxUrls, disallowRules = []) {
    this.origin = origin;
    this.maxUrls = maxUrls;
    this.disallowRules = disallowRules;
    this.requested = new Set();
    this.enqueued = new Set();
    this.canonicals = new Set();
    this.canonicalOwners = new Map();
    this.duplicateCanonicals = 0;
    this.skippedDisallowed = 0;
    this.skippedDuplicates = 0;
    this.queue = [];
    this.queueIndex = 0;
  }

  isAllowed(url) {
    if (!url || !shouldCrawlUrl(url)) {
      return false;
    }

    try {
      const pathname = new URL(url).pathname;
      if (isDisallowedPath(pathname, this.disallowRules)) {
        this.skippedDisallowed += 1;
        logger.debug('URL blocked by robots.txt', { url });
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  enqueue(url) {
    const normalized = normalizeCrawlUrl(url, this.origin);
    if (!normalized || !this.isAllowed(normalized)) {
      return false;
    }

    if (this.canonicals.size >= this.maxUrls) {
      return false;
    }

    if (this.enqueued.has(normalized) || this.requested.has(normalized)) {
      this.skippedDuplicates += 1;
      return false;
    }

    this.enqueued.add(normalized);
    this.queue.push(normalized);
    logger.debug('URL enqueued', { url: normalized, queueSize: this.queue.length - this.queueIndex });
    return true;
  }

  dequeue() {
    while (this.queueIndex < this.queue.length) {
      const url = this.queue[this.queueIndex++];
      if (!this.requested.has(url)) {
        return url;
      }
    }

    return null;
  }

  markRequested(url) {
    this.requested.add(url);
  }

  hasPending() {
    return this.queueIndex < this.queue.length;
  }

  tryAddCanonical(canonical, sourceUrl) {
    const normalized = normalizeCrawlUrl(canonical, this.origin);
    if (!normalized || !this.isAllowed(normalized)) {
      return false;
    }

    if (this.canonicals.has(normalized)) {
      this.duplicateCanonicals += 1;
      logger.debug('Duplicate canonical ignored', {
        canonical: normalized,
        sourceUrl,
        existingSource: this.canonicalOwners.get(normalized),
      });
      return false;
    }

    if (this.canonicals.size >= this.maxUrls) {
      return false;
    }

    this.canonicals.add(normalized);
    this.canonicalOwners.set(normalized, sourceUrl);
    logger.debug('Canonical URL accepted', { canonical: normalized, sourceUrl });
    return true;
  }

  addFromSitemap(url) {
    return this.tryAddCanonical(url, url);
  }

  size() {
    return this.canonicals.size;
  }

  toSortedArray() {
    return [...this.canonicals].sort();
  }

  getStats() {
    return {
      discovered: this.canonicals.size,
      requested: this.requested.size,
      enqueued: this.enqueued.size,
      duplicateCanonicals: this.duplicateCanonicals,
      skippedDisallowed: this.skippedDisallowed,
      skippedDuplicates: this.skippedDuplicates,
      pending: Math.max(this.queue.length - this.queueIndex, 0),
    };
  }
}

export default UrlRegistry;
