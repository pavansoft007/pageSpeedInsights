#!/usr/bin/env node

import { runAuditCli } from './cli/auditCli.js';

const url = process.argv[2];

if (!url) {
  console.error('Usage: npm start <url>');
  console.error('       npm run audit -- <url>');
  process.exit(1);
}

runAuditCli(url)
  .then((result) => {
    process.exit(result.status === 'completed' || result.analyzed > 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
