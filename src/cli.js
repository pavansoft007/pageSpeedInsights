#!/usr/bin/env node

import { auditService } from './services/auditService.js';
import logger from './utils/logger.js';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: npm run audit -- <url>');
    process.exit(1);
  }

  logger.info('Starting CLI audit', { url });

  const audit = await auditService.runAuditSync(url, { generateReports: true });

  console.log('\nAudit completed');
  console.log(`ID:       ${audit.id}`);
  console.log(`Status:   ${audit.status}`);
  console.log(`Pages:    ${audit.pages.length}`);
  console.log(`Reports:  ${audit.reports?.excel ?? 'n/a'}`);
  console.log(`          ${audit.reports?.csv ?? 'n/a'}`);

  process.exit(audit.status === 'completed' ? 0 : 1);
}

main().catch((error) => {
  logger.error('CLI audit failed', { error: error.message });
  console.error(error.message);
  process.exit(1);
});
