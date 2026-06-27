#!/usr/bin/env node

import { crawlWebsite } from './crawler/index.js';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: npm run crawl -- <url>');
    process.exit(1);
  }

  const urls = await crawlWebsite(url);

  console.log(JSON.stringify(urls, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
