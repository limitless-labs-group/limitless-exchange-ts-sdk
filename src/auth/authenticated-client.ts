/**
 * Optional helper for automatic authentication retry on token expiration.
 * @module auth/authenticated-client
 */

import { HttpClient } from '../api/http';
import { APIError } from '../api/errors';
import { Authenticator } from './authenticator';
import { MessageSigner } from './signer';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Configuration for authenticated client with auto-retry.
 * @public
 */
export interface AuthenticatedClientConfig {
  /**
   * HTTP client instance
   */
  httpClient: HttpClient;

  /**
   * Authenticator instance
   */
  authenticator: Authenticator;

  /**
   * Authentication client type ('eoa' or 'base')
   */
  client: 'eoa' | 'base';

  /**
   * Optional logger for debugging
   */
  logger?: ILogger;

  /**
   * Maximum retry attempts for auth errors (default: 1)
   */
  maxRetries?: number;
}

/**
 * Optional helper class that automatically re-authenticates on token expiration.
 *
 * @remarks
 * This is an optional convenience wrapper. Users can choose to handle
 * authentication retry manually or use this helper for automatic retry logic.
 *
 * @example
 * ```typescript
 * // Create authenticated client with auto-retry
 * const authClient = new AuthenticatedClient({
 *   httpClient,
 *   authenticator,
 *   client: 'eoa'
 * });
 *
 * // Use withRetry for automatic re-authentication
 * const portfolioFetcher = new PortfolioFetcher(httpClient);
 * const positions = await authClient.withRetry(() =>
 *   portfolioFetcher.getPositions()
 * );
 * ```
 *
 * @public
 */
export class AuthenticatedClient {
  private httpClient: HttpClient;
  private authenticator: Authenticator;
  private client: 'eoa' | 'base';
  private logger: ILogger;
  private maxRetries: number;

  /**
   * Creates a new authenticated client with auto-retry capability.
   *
   * @param config - Configuration for authenticated client
   */
  constructor(config: AuthenticatedClientConfig) {
    this.httpClient = config.httpClient;
    this.authenticator = config.authenticator;
    this.client = config.client;
    this.logger = config.logger || new NoOpLogger();
    this.maxRetries = config.maxRetries ?? 1;
  }

  /**
   * Executes a function with automatic retry on authentication errors.
   *
   * @param fn - Function to execute with auth retry
   * @returns Promise resolving to the function result
   * @throws Error if max retries exceeded or non-auth error occurs
   *
   * @example
   * ```typescript
   * // Automatic retry on 401/403
   * const positions = await authClient.withRetry(() =>
   *   portfolioFetcher.getPositions()
   * );
   *
   * // Works with any async operation
   * const order = await authClient.withRetry(() =>
   *   orderClient.createOrder({ ... })
   * );
   * ```
   */
  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempts = 0;

    while (attempts <= this.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        // Check if it's an auth error and we have retries left
        if (error instanceof APIError && error.isAuthError() && attempts < this.maxRetries) {
          this.logger.info('Authentication expired, re-authenticating...', {
            attempt: attempts + 1,
            maxRetries: this.maxRetries,
          });

          // Re-authenticate
          await this.reauthenticate();

          // Increment attempts and retry
          attempts++;
          continue;
        }

        // Not an auth error or no retries left - throw
        throw error;
      }
    }

    // Should never reach here, but TypeScript needs this
    throw new Error('Unexpected error: exceeded max retries');
  }

  /**
   * Re-authenticates with the API.
   *
   * @internal
   */
  private async reauthenticate(): Promise<void> {
    this.logger.debug('Re-authenticating with API');

    await this.authenticator.authenticate({
      client: this.client,
    });

    this.logger.info('Re-authentication successful');
  }
}
