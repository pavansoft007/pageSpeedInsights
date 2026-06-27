#!/usr/bin/env node

import { normalizeAuditMode } from './pipeline/auditMode.js';

function parseCliArgs(argv) {
  let url = null;
  let auditMode = process.env.AUDIT_MODE ?? 'internal';

  for (const arg of argv) {
    if (arg === '--single' || arg === '-s') {
      auditMode = 'single';
      continue;
    }

    if (arg.startsWith('--mode=')) {
      auditMode = arg.slice('--mode='.length);
      continue;
    }

    if (!arg.startsWith('-') && !url) {
      url = arg;
    }
  }

  return { url, auditMode: normalizeAuditMode(auditMode) };
}

const { url, auditMode } = parseCliArgs(process.argv.slice(2));

if (url) {
  const { runAuditCli } = await import('./cli/auditCli.js');

  runAuditCli(url, { auditMode })
    .then((result) => {
      process.exit(result.status === 'completed' || result.analyzed > 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
} else {
  await import('./server.js');
}
