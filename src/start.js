#!/usr/bin/env node

const url = process.argv[2];

if (url && !url.startsWith('-')) {
  const { runAuditCli } = await import('./cli/auditCli.js');

  runAuditCli(url)
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
