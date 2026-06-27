import axios from 'axios';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

const client = axios.create({
  timeout: config.pagespeed.timeoutMs,
  validateStatus: (status) => status < 500,
});

export async function runPageSpeed(url, strategy = config.pagespeed.strategy) {
  const params = {
    url,
    strategy,
    category: ['performance', 'accessibility', 'best-practices', 'seo'],
  };

  if (config.pagespeed.apiKey) {
    params.key = config.pagespeed.apiKey;
  }

  logger.debug('Requesting PageSpeed Insights', { url, strategy });

  const response = await client.get(config.pagespeed.apiUrl, { params });

  if (response.status !== 200) {
    const message =
      response.data?.error?.message ?? `PageSpeed API returned status ${response.status}`;
    throw new Error(message);
  }

  return response.data;
}

export default { runPageSpeed };
