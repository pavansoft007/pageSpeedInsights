import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { config } from '../config/index.js';

fs.mkdirSync(config.paths.logs, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return stack
    ? `${ts} [${level}]: ${stack}${metaString}`
    : `${ts} [${level}]: ${message}${metaString}`;
});

export const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: combine(errors({ stack: true }), timestamp(), logFormat),
  defaultMeta: { service: 'website-performance-auditor' },
  transports: [
    new winston.transports.File({
      filename: path.join(config.paths.logs, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(config.paths.logs, 'combined.log'),
    }),
  ],
});

if (config.env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), logFormat),
    })
  );
} else {
  logger.add(new winston.transports.Console({ format: combine(timestamp(), logFormat) }));
}

export default logger;
