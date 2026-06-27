const IGNORED_HOSTS = [
  'facebook.com',
  'fb.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
];

const IGNORED_EXTENSIONS = [
  '.pdf',
  '.zip',
  '.rar',
  '.7z',
  '.gz',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.bmp',
  '.avif',
  '.tiff',
  '.tif',
];

const IGNORED_PROTOCOLS = ['javascript:', 'mailto:', 'tel:', 'data:'];

export function isIgnoredHref(href) {
  if (!href) {
    return true;
  }

  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed || lower.startsWith('#')) {
    return true;
  }

  if (IGNORED_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) {
    return true;
  }

  if (IGNORED_HOSTS.some((host) => lower.includes(host))) {
    return true;
  }

  const pathPart = lower.split('?')[0].split('#')[0];
  if (IGNORED_EXTENSIONS.some((ext) => pathPart.endsWith(ext))) {
    return true;
  }

  return false;
}

export function shouldCrawlUrl(normalizedUrl) {
  if (!normalizedUrl) {
    return false;
  }

  try {
    const url = new URL(normalizedUrl);
    const pathname = url.pathname.toLowerCase();

    if (IGNORED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return false;
    }

    return !IGNORED_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

export default shouldCrawlUrl;
