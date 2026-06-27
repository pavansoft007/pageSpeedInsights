import winston from 'winston';
import { logger } from './logger.js';

export function silenceConsoleLogger() {
  for (const transport of logger.transports) {
    if (transport instanceof winston.transports.Console) {
      transport.silent = true;
    }
  }
}

export default silenceConsoleLogger;
