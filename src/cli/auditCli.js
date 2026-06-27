import { AuditPipeline } from '../pipeline/auditPipeline.js';
import { CliUi } from '../utils/cliUi.js';
import { createRunLogger } from '../utils/runLogger.js';
import { silenceConsoleLogger } from '../utils/silenceLogger.js';
import { isValidHttpUrl } from '../utils/url.js';
import { normalizeStartUrl } from '../crawler/urlNormalizer.js';

export async function runAuditCli(startUrl, options = {}) {
  silenceConsoleLogger();

  const runLogger = createRunLogger();
  const ui = new CliUi(runLogger);
  const pipeline = new AuditPipeline(options);

  return pipeline.run(startUrl, {
    ui,
    runLogger,
    validateDeps: { normalizeStartUrl, isValidHttpUrl },
  });
}

export default runAuditCli;
