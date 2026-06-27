#!/usr/bin/env node

import { analyzePageSpeed } from './pagespeed/index.js';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: npm run pagespeed -- <url>');
    process.exit(1);
  }

  const result = await analyzePageSpeed(url);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
