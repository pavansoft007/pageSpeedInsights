export function getOrigin(input) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = '';
  url.search = '';
  url.hostname = url.hostname.toLowerCase();
  return url.origin;
}

export function normalizeStartUrl(input) {
  const trimmed = input.trim();
  const origin = getOrigin(trimmed);

  if (!/^https?:\/\//i.test(trimmed)) {
    return normalizeCrawlUrl(`${origin}/`, origin);
  }

  return normalizeCrawlUrl(trimmed, origin);
}

export function normalizeCrawlUrl(input, allowedOrigin) {
  try {
    const trimmed = input.trim();
    let url;

    if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith('/') || !trimmed.includes('.')) {
      url = new URL(trimmed, allowedOrigin);
    } else {
      url = new URL(`https://${trimmed}`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (allowedOrigin && url.origin !== allowedOrigin) {
      return null;
    }

    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();

    let pathname = decodeURIComponent(url.pathname || '/');
    pathname = pathname.replace(/\/{2,}/g, '/');

    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    url.pathname = pathname;
    return url.href;
  } catch {
    return null;
  }
}

export default normalizeCrawlUrl;
