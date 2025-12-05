/**
 * API error types for Limitless Exchange SDK.
 * @module api/errors
 */

/**
 * Custom error class for API errors that preserves the original response data.
 *
 * @remarks
 * This error class allows users to access the raw API response for custom error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await orderClient.createOrder(...);
 * } catch (error) {
 *   if (error instanceof APIError) {
 *     console.log('Status:', error.status);
 *     console.log('Raw response:', error.data);
 *     console.log('Message:', error.message);
 *   }
 * }
 * ```
 *
 * @public
 */
export class APIError extends Error {
  /**
   * HTTP status code (e.g., 400, 404, 500)
   */
  public readonly status: number;

  /**
   * Raw API response data (original JSON from API)
   */
  public readonly data: any;

  /**
   * Request URL that failed
   */
  public readonly url?: string;

  /**
   * Request method (GET, POST, etc.)
   */
  public readonly method?: string;

  /**
   * Creates a new API error.
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code
   * @param data - Raw API response data
   * @param url - Request URL
   * @param method - Request method
   */
  constructor(
    message: string,
    status: number,
    data: any,
    url?: string,
    method?: string
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    this.url = url;
    this.method = method;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Checks if this error is an authentication/authorization error.
   *
   * @returns True if the error is due to expired or invalid authentication
   *
   * @example
   * ```typescript
   * try {
   *   await portfolioFetcher.getPositions();
   * } catch (error) {
   *   if (error instanceof APIError && error.isAuthError()) {
   *     // Re-authenticate and retry
   *     await authenticator.authenticate({ client: 'eoa' });
   *     await portfolioFetcher.getPositions();
   *   }
   * }
   * ```
   */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}
