/**
 * Conditional Logger Utility
 * Controls logging based on environment
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const currentLevelValue = LOG_LEVELS[LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;
  const requestedLevelValue = LOG_LEVELS[level];
  return requestedLevelValue >= currentLevelValue;
}

export const logger = {
  debug: (...args: any[]) => {
    if (!IS_PRODUCTION && shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  },

  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },

  // Alias for backwards compatibility
  log: (...args: any[]) => {
    if (!IS_PRODUCTION) {
      console.log('[LOG]', ...args);
    }
  },
};

export default logger;
