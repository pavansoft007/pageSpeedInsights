#!/usr/bin/env node

import fs from 'node:fs';
import {
  runPageSpeedQueue,
  resumePageSpeedQueue,
  listJobs,
} from './queue/index.js';

function loadUrls(input) {
  if (fs.existsSync(input)) {
    const content = fs.readFileSync(input, 'utf8').trim();

    if (input.endsWith('.json')) {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : parsed.urls;
    }

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [input];
}

async function main() {
  const command = process.argv[2];

  if (command === 'resume') {
    const jobId = process.argv[3];
    const result = await resumePageSpeedQueue(jobId);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'completed' ? 0 : 1);
  }

  if (command === 'list') {
    console.log(JSON.stringify(listJobs(), null, 2));
    process.exit(0);
  }

  const input = command;

  if (!input) {
    console.error('Usage:');
    console.error('  npm run queue -- <url>');
    console.error('  npm run queue -- urls.txt');
    console.error('  npm run queue -- urls.json');
    console.error('  npm run queue -- resume [jobId]');
    console.error('  npm run queue -- list');
    process.exit(1);
  }

  const urls = loadUrls(input);
  const result = await runPageSpeedQueue(urls);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'completed' ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
