import axios from 'axios';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

const client = axios.create({
  timeout: config.pagespeed.timeoutMs,
  validateStatus: () => true,
});

let throttleChain = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response, attempt, retryDelayMs, rateLimitDelayMs) {
  if (response?.status === 429) {
    const retryAfterHeader = response.headers?.['retry-after'];
    const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? '', 10);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
    return rateLimitDelayMs * attempt * 2;
  }

  return retryDelayMs * attempt;
}

async function throttleRequest() {
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });

  const previous = throttleChain;
  throttleChain = current;

  await previous;

  const elapsed = Date.now() - lastRequestAt;
  const waitMs = Math.max(0, config.pagespeed.rateLimitDelayMs - elapsed);
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastRequestAt = Date.now();
  release();
}

export async function runPageSpeed(url, strategy, options = {}) {
  const retries = options.retries ?? config.pagespeed.retries;
  const retryDelayMs = options.retryDelayMs ?? config.pagespeed.retryDelayMs;
  const rateLimitDelayMs = options.rateLimitDelayMs ?? config.pagespeed.rateLimitDelayMs;

  const params = {
    url,
    strategy,
    category: ['performance', 'accessibility', 'best-practices', 'seo'],
  };

  if (config.pagespeed.apiKey) {
    params.key = config.pagespeed.apiKey;
  }

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    await throttleRequest();

    try {
      logger.debug('Requesting PageSpeed Insights', { url, strategy, attempt, retries });

      const response = await client.get(config.pagespeed.apiUrl, { params });

      if (response.status === 429) {
        lastError = new Error(`Rate limited (HTTP 429) for ${url} (${strategy})`);
        const delayMs = getRetryDelayMs(response, attempt, retryDelayMs, rateLimitDelayMs);
        logger.warn('PageSpeed rate limit hit', { url, strategy, attempt, delayMs });

        if (attempt < retries) {
          await sleep(delayMs);
          continue;
        }

        throw lastError;
      }

      if (response.status >= 500) {
        throw new Error(`PageSpeed API server error: HTTP ${response.status}`);
      }

      if (response.status !== 200) {
        const message =
          response.data?.error?.message ?? `PageSpeed API returned status ${response.status}`;
        throw new Error(message);
      }

      return response.data;
    } catch (error) {
      lastError = error;
      logger.warn('PageSpeed request failed', {
        url,
        strategy,
        attempt,
        retries,
        error: error.message,
      });

      if (attempt < retries) {
        const delayMs = getRetryDelayMs(null, attempt, retryDelayMs, rateLimitDelayMs);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error(`PageSpeed request failed for ${url} (${strategy})`);
}

export default { runPageSpeed };
