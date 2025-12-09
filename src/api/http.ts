import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';
import { DEFAULT_API_URL } from '../utils/constants';
import { APIError } from './errors';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Configuration options for the HTTP client.
 * @public
 */
export interface HttpClientConfig {
  /**
   * Base URL for API requests
   * @defaultValue 'https://api.limitless.exchange'
   */
  baseURL?: string;

  /**
   * Request timeout in milliseconds
   * @defaultValue 30000
   */
  timeout?: number;

  /**
   * Session cookie for authenticated requests
   */
  sessionCookie?: string;

  /**
   * Optional logger for debugging
   * @defaultValue NoOpLogger (no logging)
   */
  logger?: ILogger;

  /**
   * Enable HTTP connection pooling with keepAlive
   * @defaultValue true
   * @remarks
   * When enabled, HTTP connections are reused across requests, reducing latency by 30-50%.
   * Recommended for production environments with high request volume.
   */
  keepAlive?: boolean;

  /**
   * Maximum number of sockets to allow per host
   * @defaultValue 50
   * @remarks
   * Controls the connection pool size. Higher values allow more concurrent requests
   * but consume more system resources.
   */
  maxSockets?: number;

  /**
   * Maximum number of free sockets to keep open per host
   * @defaultValue 10
   * @remarks
   * Determines how many idle connections to maintain in the pool.
   * Keeping connections open reduces latency for subsequent requests.
   */
  maxFreeSockets?: number;

  /**
   * Socket timeout in milliseconds
   * @defaultValue 60000
   * @remarks
   * Time to wait before closing an idle socket connection.
   */
  socketTimeout?: number;

  /**
   * Additional headers to include in all requests
   * @remarks
   * These headers will be merged with default headers and sent with every request.
   * Can be overridden by per-request headers.
   *
   * @example
   * ```typescript
   * const client = new HttpClient({
   *   additionalHeaders: {
   *     'X-Custom-Header': 'value',
   *     'X-API-Version': 'v1'
   *   }
   * });
   * ```
   */
  additionalHeaders?: Record<string, string>;
}

/**
 * HTTP client wrapper for Limitless Exchange API.
 *
 * @remarks
 * This class provides a centralized HTTP client with cookie management,
 * error handling, and request/response interceptors.
 *
 * @public
 */
export class HttpClient {
  private client: AxiosInstance;
  private sessionCookie?: string;
  private logger: ILogger;

  /**
   * Creates a new HTTP client instance.
   *
   * @param config - Configuration options for the HTTP client
   */
  constructor(config: HttpClientConfig = {}) {
    this.sessionCookie = config.sessionCookie;
    this.logger = config.logger || new NoOpLogger();

    // Connection pooling configuration (enabled by default)
    const keepAlive = config.keepAlive !== false; // Default: true
    const maxSockets = config.maxSockets || 50;
    const maxFreeSockets = config.maxFreeSockets || 10;
    const socketTimeout = config.socketTimeout || 60000;

    // Create HTTP agent with connection pooling
    const httpAgent = new http.Agent({
      keepAlive,
      maxSockets,
      maxFreeSockets,
      timeout: socketTimeout,
    });

    // Create HTTPS agent with connection pooling
    const httpsAgent = new https.Agent({
      keepAlive,
      maxSockets,
      maxFreeSockets,
      timeout: socketTimeout,
    });

    this.client = axios.create({
      baseURL: config.baseURL || DEFAULT_API_URL,
      timeout: config.timeout || 30000,
      httpAgent,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config.additionalHeaders,
      },
    });

    this.logger.debug('HTTP client initialized', {
      baseURL: config.baseURL || DEFAULT_API_URL,
      keepAlive,
      maxSockets,
      maxFreeSockets,
    });

    this.setupInterceptors();
  }

  /**
   * Sets up request and response interceptors.
   * @internal
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (this.sessionCookie) {
          config.headers['Cookie'] = `limitless_session=${this.sessionCookie}`;
        }

        // Log outgoing request - concise format
        const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
        const method = config.method?.toUpperCase() || 'GET';

        this.logger.debug(`→ ${method} ${fullUrl}`, {
          headers: config.headers,
          body: config.data,
        });

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        // Log successful response - concise format
        const method = response.config.method?.toUpperCase() || 'GET';
        const url = response.config.url || '';

        this.logger.debug(`✓ ${response.status} ${method} ${url}`, {
          data: response.data,
        });
        return response;
      },
      (error) => {
        if (error.response) {
          // Handle error response data
          const status = error.response.status;
          const data = error.response.data;
          const url = error.config?.url;
          const method = error.config?.method?.toUpperCase();
          let message = error.message;

          if (data) {
            // Log error response - concise format
            this.logger.debug(`✗ ${status} ${method} ${url}`, {
              error: data,
            });

            // If data is an object, try to extract message or stringify
            if (typeof data === 'object') {
              // Check if message is an array (validation errors)
              if (Array.isArray(data.message)) {
                const messages = data.message
                  .map((err: any) => {
                    // Include all error details, not just field and message
                    const details = Object.entries(err)
                      .filter(([_key, val]) => val !== '' && val !== null && val !== undefined)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(', ');
                    return details || JSON.stringify(err);
                  })
                  .filter((msg: string) => msg.trim() !== '')
                  .join(' | ');
                message = messages || data.error || JSON.stringify(data);
              } else {
                // Try multiple common error field names
                message =
                  data.message ||
                  data.error ||
                  data.msg ||
                  (data.errors && JSON.stringify(data.errors)) ||
                  JSON.stringify(data);
              }
            } else {
              message = String(data);
            }
          }

          // Throw APIError with original data preserved
          throw new APIError(message, status, data, url, method);
        } else if (error.request) {
          throw new Error('No response received from API');
        } else {
          throw new Error(`Request failed: ${error.message}`);
        }
      }
    );
  }

  /**
   * Sets the session cookie for authenticated requests.
   *
   * @param cookie - Session cookie value
   */
  setSessionCookie(cookie: string): void {
    this.sessionCookie = cookie;
  }

  /**
   * Clears the session cookie.
   */
  clearSessionCookie(): void {
    this.sessionCookie = undefined;
  }

  /**
   * Performs a GET request.
   *
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise resolving to the response data
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Performs a POST request.
   *
   * @param url - Request URL
   * @param data - Request body data
   * @param config - Additional request configuration
   * @returns Promise resolving to the response data
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Performs a POST request and returns the full response object.
   * Useful when you need access to response headers (e.g., for cookie extraction).
   *
   * @param url - Request URL
   * @param data - Request body data
   * @param config - Additional request configuration
   * @returns Promise resolving to the full AxiosResponse object
   * @internal
   */
  async postWithResponse<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return await this.client.post(url, data, config);
  }

  /**
   * Performs a DELETE request.
   *
   * @remarks
   * DELETE requests typically don't have a body, so we remove the Content-Type header
   * to avoid "Body cannot be empty" errors from the API.
   *
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise resolving to the response data
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Remove Content-Type header for DELETE requests (no body expected)
    const deleteConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': undefined,
      },
    };

    const response: AxiosResponse<T> = await this.client.delete(url, deleteConfig);
    return response.data;
  }

  /**
   * Extracts cookies from response headers.
   *
   * @param response - Axios response object
   * @returns Object containing parsed cookies
   * @internal
   */
  extractCookies(response: AxiosResponse): Record<string, string> {
    const setCookie = response.headers['set-cookie'];
    if (!setCookie) return {};

    const cookies: Record<string, string> = {};
    const cookieStrings = Array.isArray(setCookie) ? setCookie : [setCookie];

    for (const cookieString of cookieStrings) {
      const parts = cookieString.split(';')[0].split('=');
      if (parts.length === 2) {
        cookies[parts[0].trim()] = parts[1].trim();
      }
    }

    return cookies;
  }
}
