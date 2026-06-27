import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import auditRoutes from './routes/auditRoutes.js';
import { config } from './config/index.js';
import { AppError } from './utils/errors.js';
import logger from './utils/logger.js';

const publicDir = path.join(config.projectRoot, 'public');

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/audits', auditRoutes);
  app.use(express.static(publicDir));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((_req, _res, next) => {
    next(new AppError('Route not found', 404));
  });

  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode ?? 500;
    const message = err.message ?? 'Internal server error';

    logger.error('Request error', {
      statusCode,
      message,
      stack: err.stack,
    });

    res.status(statusCode).json({
      error: {
        message,
        ...(err.details ? { details: err.details } : {}),
        ...(process.env.NODE_ENV !== 'production' && err.stack
          ? { stack: err.stack }
          : {}),
      },
    });
  });

  return app;
}

export default createApp;
