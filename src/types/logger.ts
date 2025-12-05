/**
 * Logger interface for SDK integration.
 * Allows users to inject their own logging implementation.
 *
 * @public
 */
export interface ILogger {
  /**
   * Log debug information (verbose, development only)
   */
  debug(message: string, meta?: Record<string, any>): void;

  /**
   * Log informational messages
   */
  info(message: string, meta?: Record<string, any>): void;

  /**
   * Log warning messages
   */
  warn(message: string, meta?: Record<string, any>): void;

  /**
   * Log error messages
   */
  error(message: string, error?: Error, meta?: Record<string, any>): void;
}

/**
 * No-op logger (default) - does nothing.
 * Zero performance overhead when logging is not needed.
 *
 * @internal
 */
export class NoOpLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Simple console logger for development.
 * Can be used as a starting point or for debugging.
 *
 * @example
 * ```typescript
 * import { ConsoleLogger } from '@limitless-exchange/sdk';
 *
 * const logger = new ConsoleLogger('debug');
 * const authenticator = new Authenticator(httpClient, signer, logger);
 * ```
 *
 * @public
 */
export class ConsoleLogger implements ILogger {
  private level: 'debug' | 'info' | 'warn' | 'error';

  constructor(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.level = level;
  }

  private shouldLog(messageLevel: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      console.debug('[Limitless SDK]', message, meta || '');
    }
  }

  info(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      console.info('[Limitless SDK]', message, meta || '');
    }
  }

  warn(message: string, meta?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      console.warn('[Limitless SDK]', message, meta || '');
    }
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      // Only log error message, not the full error object (which includes stack trace)
      const errorMsg = error ? error.message : '';
      console.error('[Limitless SDK]', message, errorMsg ? `- ${errorMsg}` : '', meta || '');
    }
  }
}
