import { normalizeCrawlUrl } from './urlNormalizer.js';
import logger from '../utils/logger.js';

function normalizePath(pathname) {
  let path = pathname || '/';
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

export function parseRobotsTxt(content, origin) {
  const sitemaps = [];
  const disallowRules = [];
  let activeAgentMatches = false;

  if (!content) {
    return { sitemaps, disallowRules };
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (directive === 'user-agent') {
      const agent = value.toLowerCase();
      activeAgentMatches = agent === '*' || agent.includes('websiteperformanceauditor');
      continue;
    }

    if (directive === 'sitemap') {
      const normalized = normalizeCrawlUrl(value, origin) ?? value;
      sitemaps.push(normalized);
      logger.debug('robots.txt sitemap discovered', { sitemap: normalized });
      continue;
    }

    if (directive === 'disallow' && activeAgentMatches && value) {
      disallowRules.push(normalizePath(value));
      logger.debug('robots.txt disallow rule discovered', { rule: value });
    }
  }

  return {
    sitemaps: [...new Set(sitemaps)],
    disallowRules: [...new Set(disallowRules)],
  };
}

export function isDisallowedPath(pathname, disallowRules) {
  const path = normalizePath(pathname.toLowerCase());

  return disallowRules.some((rule) => {
    if (rule === '/') {
      return path === '/';
    }

    return path === rule || path.startsWith(`${rule}/`);
  });
}

export default parseRobotsTxt;
