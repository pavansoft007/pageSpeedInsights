export function normalizeUrl(input) {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = '';
  return url.href.replace(/\/$/, '') || url.href;
}

export function isSameOrigin(baseUrl, targetUrl) {
  try {
    const base = new URL(baseUrl);
    const target = new URL(targetUrl, baseUrl);
    return base.origin === target.origin;
  } catch {
    return false;
  }
}

export function isValidHttpUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}
