/**
 * Conditional Logger Utility
 * Only logs in development environment
 */

const IS_DEVELOPMENT = import.meta.env.MODE === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (IS_DEVELOPMENT) {
      console.log(...args);
    }
  },

  debug: (...args: any[]) => {
    if (IS_DEVELOPMENT) {
      console.debug(...args);
    }
  },

  info: (...args: any[]) => {
    if (IS_DEVELOPMENT) {
      console.info(...args);
    }
  },

  warn: (...args: any[]) => {
    // Warnings always shown
    console.warn(...args);
  },

  error: (...args: any[]) => {
    // Errors always shown
    console.error(...args);
  },
};

export default logger;
