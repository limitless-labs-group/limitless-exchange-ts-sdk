/**
 * Retry mechanism for handling transient API failures.
 *
 * @remarks
 * This module provides flexible retry logic for handling rate limits (429),
 * server errors (500, 502, 503), and other transient failures.
 *
 * @example
 * ```typescript
 * // Decorator approach
 * @retryOnErrors({ statusCodes: [429, 500], maxRetries: 3, delays: [2, 5, 10] })
 * async function createOrder() {
 *   return await orderClient.createOrder(...);
 * }
 *
 * // Wrapper approach
 * const retryConfig = new RetryConfig({ statusCodes: [429, 500], maxRetries: 3 });
 * const retryableClient = new RetryableClient(httpClient, retryConfig);
 * const markets = await retryableClient.get('/markets');
 * ```
 *
 * @module api/retry
 * @public
 */

import { APIError } from './errors';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Configuration options for retry behavior.
 *
 * @public
 */
export interface RetryConfigOptions {
  /**
   * HTTP status codes to retry on
   * @defaultValue [429, 500, 502, 503, 504]
   */
  statusCodes?: number[];

  /**
   * Maximum number of retry attempts
   * @defaultValue 3
   */
  maxRetries?: number;

  /**
   * List of delays in seconds for each retry attempt.
   * If not provided, exponential backoff will be used.
   * @defaultValue undefined (use exponential backoff)
   */
  delays?: number[];

  /**
   * Base for exponential backoff calculation (delay = base^attempt)
   * @defaultValue 2
   */
  exponentialBase?: number;

  /**
   * Maximum delay in seconds for exponential backoff
   * @defaultValue 60
   */
  maxDelay?: number;

  /**
   * Optional callback called before each retry attempt
   * @param attempt - Retry attempt number (0-based)
   * @param error - The error that triggered the retry
   * @param delay - Delay in seconds before retry
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Configuration class for retry behavior.
 *
 * @public
 */
export class RetryConfig {
  /**
   * HTTP status codes to retry on
   */
  readonly statusCodes: Set<number>;

  /**
   * Maximum number of retry attempts
   */
  readonly maxRetries: number;

  /**
   * List of delays in seconds for each retry
   */
  readonly delays?: number[];

  /**
   * Base for exponential backoff
   */
  readonly exponentialBase: number;

  /**
   * Maximum delay in seconds
   */
  readonly maxDelay: number;

  /**
   * Optional retry callback
   */
  readonly onRetry?: (attempt: number, error: Error, delay: number) => void;

  /**
   * Creates a new retry configuration.
   *
   * @param options - Configuration options
   */
  constructor(options: RetryConfigOptions = {}) {
    this.statusCodes = new Set(options.statusCodes || [429, 500, 502, 503, 504]);
    this.maxRetries = options.maxRetries ?? 3;
    this.delays = options.delays;
    this.exponentialBase = options.exponentialBase ?? 2;
    this.maxDelay = options.maxDelay ?? 60;
    this.onRetry = options.onRetry;
  }

  /**
   * Calculates delay for a given retry attempt.
   *
   * @param attempt - Retry attempt number (0-based)
   * @returns Delay in seconds
   */
  getDelay(attempt: number): number {
    if (this.delays) {
      // Use specified delays
      return this.delays[Math.min(attempt, this.delays.length - 1)];
    } else {
      // Exponential backoff
      return Math.min(Math.pow(this.exponentialBase, attempt), this.maxDelay);
    }
  }
}

/**
 * Utility function to sleep for a given duration.
 *
 * @param seconds - Duration to sleep in seconds
 * @returns Promise that resolves after the duration
 * @internal
 */
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Decorator to add retry logic to async functions.
 *
 * @remarks
 * This decorator automatically retries failed API calls based on HTTP status codes.
 * Useful for handling transient errors like rate limits (429) or server errors (500, 502, 503).
 *
 * @param options - Retry configuration options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class MyService {
 *   @retryOnErrors({ statusCodes: [429, 500], maxRetries: 3, delays: [2, 5, 10] })
 *   async createOrder() {
 *     return await this.orderClient.createOrder(...);
 *   }
 * }
 * ```
 *
 * @public
 */
export function retryOnErrors(options: RetryConfigOptions = {}) {
  const config = new RetryConfig(options);

  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error | undefined;

      // First attempt
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        // Check if we should retry this error
        if (error instanceof APIError && config.statusCodes.has(error.status)) {
          lastError = error;
        } else {
          // Not a retryable error, rethrow immediately
          throw error;
        }
      }

      // Retry attempts
      for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
          // Calculate delay
          const delay = config.getDelay(attempt);

          // Call user callback if provided
          if (config.onRetry && lastError) {
            config.onRetry(attempt, lastError, delay);
          }

          // Wait before retry
          await sleep(delay);

          // Retry the function
          return await originalMethod.apply(this, args);
        } catch (error: any) {
          // Check if we should retry this error
          if (error instanceof APIError && config.statusCodes.has(error.status)) {
            lastError = error;
          } else {
            // Not a retryable error, rethrow immediately
            throw error;
          }
        }
      }

      // All retries exhausted
      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Standalone retry function for wrapping async operations.
 *
 * @remarks
 * This function wraps any async operation with retry logic.
 * More flexible than the decorator approach for one-off retries.
 *
 * @param fn - Async function to execute with retry
 * @param options - Retry configuration options
 * @param logger - Optional logger for retry information
 * @returns Promise resolving to the function result
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await orderClient.createOrder(...),
 *   { statusCodes: [429, 500], maxRetries: 3, delays: [2, 5, 10] }
 * );
 * ```
 *
 * @public
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryConfigOptions = {},
  logger: ILogger = new NoOpLogger()
): Promise<T> {
  const config = new RetryConfig(options);
  let lastError: Error | undefined;

  // First attempt
  try {
    return await fn();
  } catch (error: any) {
    // Check if we should retry this error
    if (error instanceof APIError && config.statusCodes.has(error.status)) {
      lastError = error;
      logger.warn('API error, starting retries', { status: error.status });
    } else {
      // Not a retryable error, rethrow immediately
      throw error;
    }
  }

  // Retry attempts
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      // Calculate delay
      const delay = config.getDelay(attempt);

      // Call user callback if provided
      if (config.onRetry && lastError) {
        config.onRetry(attempt, lastError, delay);
      }

      logger.info('Retrying operation', { attempt: attempt + 1, delay });

      // Wait before retry
      await sleep(delay);

      // Retry the function
      return await fn();
    } catch (error: any) {
      // Check if we should retry this error
      if (error instanceof APIError && config.statusCodes.has(error.status)) {
        lastError = error;
        logger.warn('Retry failed', { attempt: attempt + 1, status: error.status });
      } else {
        // Not a retryable error, rethrow immediately
        throw error;
      }
    }
  }

  // All retries exhausted
  logger.error('All retries exhausted');
  throw lastError;
}

/**
 * HTTP client wrapper that adds retry logic to all requests.
 *
 * @remarks
 * This class wraps an HttpClient and automatically retries failed requests
 * based on configured retry settings.
 *
 * @example
 * ```typescript
 * const httpClient = new HttpClient({ logger });
 * const retryConfig = new RetryConfig({ statusCodes: [429, 500], maxRetries: 3 });
 * const retryableClient = new RetryableClient(httpClient, retryConfig);
 *
 * // All requests automatically retry on 429, 500
 * const markets = await retryableClient.get('/markets');
 * ```
 *
 * @public
 */
export class RetryableClient {
  /**
   * Creates a new retryable client wrapper.
   *
   * @param httpClient - HTTP client to wrap
   * @param retryConfig - Retry configuration
   * @param logger - Optional logger
   */
  constructor(
    private httpClient: any,
    private retryConfig: RetryConfig = new RetryConfig(),
    private logger: ILogger = new NoOpLogger()
  ) {}

  /**
   * Performs a GET request with retry logic.
   *
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise resolving to the response data
   */
  async get<T = any>(url: string, config?: any): Promise<T> {
    return withRetry(
      async () => this.httpClient.get(url, config),
      {
        statusCodes: Array.from(this.retryConfig.statusCodes),
        maxRetries: this.retryConfig.maxRetries,
        delays: this.retryConfig.delays,
        exponentialBase: this.retryConfig.exponentialBase,
        maxDelay: this.retryConfig.maxDelay,
        onRetry: this.retryConfig.onRetry,
      },
      this.logger
    );
  }

  /**
   * Performs a POST request with retry logic.
   *
   * @param url - Request URL
   * @param data - Request body data
   * @param config - Additional request configuration
   * @returns Promise resolving to the response data
   */
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    return withRetry(
      async () => this.httpClient.post(url, data, config),
      {
        statusCodes: Array.from(this.retryConfig.statusCodes),
        maxRetries: this.retryConfig.maxRetries,
        delays: this.retryConfig.delays,
        exponentialBase: this.retryConfig.exponentialBase,
        maxDelay: this.retryConfig.maxDelay,
        onRetry: this.retryConfig.onRetry,
      },
      this.logger
    );
  }

  /**
   * Performs a DELETE request with retry logic.
   *
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise resolving to the response data
   */
  async delete<T = any>(url: string, config?: any): Promise<T> {
    return withRetry(
      async () => this.httpClient.delete(url, config),
      {
        statusCodes: Array.from(this.retryConfig.statusCodes),
        maxRetries: this.retryConfig.maxRetries,
        delays: this.retryConfig.delays,
        exponentialBase: this.retryConfig.exponentialBase,
        maxDelay: this.retryConfig.maxDelay,
        onRetry: this.retryConfig.onRetry,
      },
      this.logger
    );
  }

  /**
   * Forwards any other method calls to the wrapped HTTP client.
   *
   * @param method - Method name
   */
  [key: string]: any;
}
