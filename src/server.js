import { config } from './config/index.js';
import { createApp } from './app.js';
import { closeBrowser } from './crawler/playwrightClient.js';
import logger from './utils/logger.js';

const app = createApp();
let server = null;

function startServer() {
  server = app.listen(config.port, () => {
    logger.info('Server started', {
      port: config.port,
      env: config.env,
    });
  });

  return server;
}

async function shutdown(signal) {
  logger.info('Shutdown signal received', { signal });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await closeBrowser();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

startServer();

export default app;
