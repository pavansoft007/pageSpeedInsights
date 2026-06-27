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

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use`, {
        port: config.port,
        hint: `Stop the other process or set PORT to a different value in .env`,
      });
      console.error(
        `\nPort ${config.port} is already in use.\n` +
          `Another server instance may still be running.\n` +
          `Windows: netstat -ano | findstr :${config.port}  then  taskkill /PID <pid> /F\n` +
          `Or set a different PORT in .env\n`
      );
      process.exit(1);
    }

    logger.error('Server failed to start', { error: error.message });
    process.exit(1);
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
