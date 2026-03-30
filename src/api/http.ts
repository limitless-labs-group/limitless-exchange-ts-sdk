import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosResponseHeaders,
  InternalAxiosRequestConfig,
  RawAxiosResponseHeaders,
} from 'axios';
import http from 'http';
import https from 'https';
import { DEFAULT_API_URL } from '../utils/constants';
import { APIError, RateLimitError, AuthenticationError, ValidationError } from './errors';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';
import type { HMACCredentials } from '../types/api-tokens';
import { computeHMACSignature } from './hmac';

const SDK_ID = 'lmts-sdk-ts';

function resolveSdkVersion(): string {
  if (typeof __LMTS_SDK_VERSION__ !== 'undefined' && __LMTS_SDK_VERSION__) {
    return __LMTS_SDK_VERSION__;
  }

  return '0.0.0';
}

function resolveRuntimeToken(): string {
  if (typeof process !== 'undefined' && process.versions?.node) {
    return `node/${process.versions.node}`;
  }

  return 'runtime/unknown';
}

function buildSdkTrackingHeaders(): Record<string, string> {
  const sdkVersion = resolveSdkVersion();
  const headers: Record<string, string> = {
    'x-sdk-version': `${SDK_ID}/${sdkVersion}`,
  };

  if (typeof process !== 'undefined' && process.versions?.node) {
    headers['user-agent'] = `${SDK_ID}/${sdkVersion} (${resolveRuntimeToken()})`;
  }

  return headers;
}

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
   * API key for authenticated requests
   * @remarks
   * If not provided, will attempt to load from LIMITLESS_API_KEY environment variable.
   * Required for authenticated endpoints (portfolio, orders, etc.)
   */
  apiKey?: string;

  /**
   * HMAC credentials for scoped API-token authentication.
   *
   * @remarks
   * When configured alongside `apiKey`, this client uses HMAC headers for authenticated requests.
   */
  hmacCredentials?: HMACCredentials;

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
 * Raw HTTP response with status and headers.
 *
 * @remarks
 * Useful for endpoints where response metadata matters (for example redirect handling).
 *
 * @public
 */
export interface HttpRawResponse<T = any> {
  /**
   * HTTP status code.
   */
  status: number;

  /**
   * Response headers.
   */
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders;

  /**
   * Response body.
   */
  data: T;
}

/**
 * HTTP client wrapper for Limitless Exchange API.
 *
 * @remarks
 * This class provides a centralized HTTP client with API key authentication,
 * error handling, and request/response interceptors.
 *
 * @public
 */
export class HttpClient {
  private client: AxiosInstance;
  private apiKey?: string;
  private hmacCredentials?: HMACCredentials;
  private logger: ILogger;

  /**
   * Creates a new HTTP client instance.
   *
   * @param config - Configuration options for the HTTP client
   */
  constructor(config: HttpClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.LIMITLESS_API_KEY;
    this.hmacCredentials = config.hmacCredentials
      ? {
          tokenId: config.hmacCredentials.tokenId,
          secret: config.hmacCredentials.secret,
        }
      : undefined;
    this.logger = config.logger || new NoOpLogger();

    if (!this.apiKey && !this.hmacCredentials) {
      this.logger.warn(
        'Authentication not set. Authenticated endpoints will fail. ' +
        'Set LIMITLESS_API_KEY environment variable, pass apiKey, or configure hmacCredentials.'
      );
    }

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
        ...buildSdkTrackingHeaders(),
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
      (rawConfig: InternalAxiosRequestConfig & { identityToken?: string }) => {
        const config = rawConfig as InternalAxiosRequestConfig & { identityToken?: string; headers: any };
        const headers = (config.headers ||= {});
        const identityToken = config.identityToken;

        delete (headers as any)['X-API-Key'];
        delete (headers as any)['lmts-api-key'];
        delete (headers as any)['lmts-timestamp'];
        delete (headers as any)['lmts-signature'];
        delete (headers as any).identity;

        if (identityToken) {
          (headers as any).identity = `Bearer ${identityToken}`;
        } else if (this.hmacCredentials) {
          const requestPath = this.getRequestPath(config);
          const requestBody = this.getRequestBodyForSignature(config.data);
          const timestamp = new Date().toISOString();
          const signature = computeHMACSignature(
            this.hmacCredentials.secret,
            timestamp,
            config.method || 'GET',
            requestPath,
            requestBody,
          );

          (headers as any)['lmts-api-key'] = this.hmacCredentials.tokenId;
          (headers as any)['lmts-timestamp'] = timestamp;
          (headers as any)['lmts-signature'] = signature;
        } else if (this.apiKey) {
          (headers as any)['X-API-Key'] = this.apiKey;
        }

        // Log outgoing request - concise format
        const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
        const method = config.method?.toUpperCase() || 'GET';

        const logHeaders = this.maskSensitiveHeaders(headers as Record<string, unknown>);

        this.logger.debug(`→ ${method} ${fullUrl}`, {
          headers: logHeaders,
          body: config.data,
        });

        return rawConfig;
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

          // Throw appropriate error type based on status code
          if (status === 429) {
            throw new RateLimitError(message, status, data, url, method);
          } else if (status === 401 || status === 403) {
            throw new AuthenticationError(message, status, data, url, method);
          } else if (status === 400) {
            throw new ValidationError(message, status, data, url, method);
          } else {
            throw new APIError(message, status, data, url, method);
          }
        } else if (error.request) {
          throw new Error('No response received from API');
        } else {
          throw new Error(`Request failed: ${error.message}`);
        }
      }
    );
  }

  /**
   * Extracts a human-readable error message from API response payload.
   * @internal
   */
  private extractErrorMessage(data: any, fallback: string): string {
    if (!data) {
      return fallback;
    }

    if (typeof data === 'object') {
      if (Array.isArray(data.message)) {
        const messages = data.message
          .map((err: any) => {
            const details = Object.entries(err || {})
              .filter(([_key, val]) => val !== '' && val !== null && val !== undefined)
              .map(([key, val]) => `${key}: ${val}`)
              .join(', ');
            return details || JSON.stringify(err);
          })
          .filter((msg: string) => msg.trim() !== '')
          .join(' | ');

        return messages || data.error || JSON.stringify(data);
      }

      return data.message || data.error || data.msg || (data.errors && JSON.stringify(data.errors)) || JSON.stringify(data);
    }

    return String(data);
  }

  /**
   * Creates a typed API error class from status code.
   * @internal
   */
  private createTypedApiError(status: number, message: string, data: any, url?: string, method?: string): APIError {
    if (status === 429) {
      return new RateLimitError(message, status, data, url, method);
    }

    if (status === 401 || status === 403) {
      return new AuthenticationError(message, status, data, url, method);
    }

    if (status === 400) {
      return new ValidationError(message, status, data, url, method);
    }

    return new APIError(message, status, data, url, method);
  }

  /**
   * Sets the API key for authenticated requests.
   *
   * @param apiKey - API key value
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Returns the configured API key, if any.
   */
  getApiKey(): string | undefined {
    return this.apiKey;
  }

  /**
   * Clears the API key.
   */
  clearApiKey(): void {
    this.apiKey = undefined;
  }

  /**
   * Sets HMAC credentials for scoped API-token authentication.
   */
  setHMACCredentials(credentials: HMACCredentials): void {
    this.hmacCredentials = {
      tokenId: credentials.tokenId,
      secret: credentials.secret,
    };
  }

  /**
   * Clears HMAC credentials.
   */
  clearHMACCredentials(): void {
    this.hmacCredentials = undefined;
  }

  /**
   * Returns a copy of the configured HMAC credentials, if any.
   */
  getHMACCredentials(): HMACCredentials | undefined {
    if (!this.hmacCredentials) {
      return undefined;
    }

    return {
      tokenId: this.hmacCredentials.tokenId,
      secret: this.hmacCredentials.secret,
    };
  }

  /**
   * Returns the logger attached to this HTTP client.
   */
  getLogger(): ILogger {
    return this.logger;
  }

  /**
   * Returns true when cookie/header-based auth is configured on the underlying client.
   * This is primarily used for custom authenticated flows that don't use API keys or HMAC.
   */
  private hasConfiguredHeaderAuth(): boolean {
    const defaultHeaders = this.client.defaults.headers as
      | (Record<string, unknown> & { common?: Record<string, unknown> })
      | undefined;

    const candidates = [defaultHeaders?.common, defaultHeaders];

    for (const headers of candidates) {
      if (!headers) {
        continue;
      }

      const authValues = [
        headers.Cookie,
        headers.cookie,
        headers.Authorization,
        headers.authorization,
        headers.identity,
      ];

      if (authValues.some((value) => typeof value === 'string' && value.trim() !== '')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Ensures the client has some authenticated transport configured.
   */
  requireAuth(operation: string): void {
    if (this.apiKey || this.hmacCredentials || this.hasConfiguredHeaderAuth()) {
      return;
    }

    throw new Error(
      `Authentication is required for ${operation}; pass apiKey, hmacCredentials, cookie/auth headers, or set LIMITLESS_API_KEY.`,
    );
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
   * Performs a GET request with identity-token authentication.
   */
  async getWithIdentity<T = any>(url: string, identityToken: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, {
      ...config,
      identityToken,
    } as AxiosRequestConfig & { identityToken: string });
    return response.data;
  }

  /**
   * Performs a GET request and returns raw response metadata.
   *
   * @remarks
   * Use this when callers need access to status code or headers (e.g. redirect `Location`).
   *
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise resolving to status, headers, and response data
   */
  async getRaw<T = any>(url: string, config?: AxiosRequestConfig): Promise<HttpRawResponse<T>> {
    const response: AxiosResponse<T> = await this.client.get(url, config);

    // Guard against callers allowing 4xx/5xx through custom validateStatus.
    // getRaw should preserve normal typed API error behavior for error responses.
    if (response.status >= 400) {
      const message = this.extractErrorMessage(response.data, `Request failed with status ${response.status}`);
      throw this.createTypedApiError(response.status, message, response.data, url, 'GET');
    }

    return {
      status: response.status,
      headers: response.headers,
      data: response.data,
    };
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
   * Performs a POST request with identity-token authentication.
   */
  async postWithIdentity<T = any>(
    url: string,
    identityToken: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, {
      ...config,
      identityToken,
    } as AxiosRequestConfig & { identityToken: string });
    return response.data;
  }

  /**
   * Performs a POST request with additional per-request headers.
   */
  async postWithHeaders<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, {
      ...config,
      headers: {
        ...(config?.headers || {}),
        ...(headers || {}),
      },
    });
    return response.data;
  }

  /**
   * Performs a PATCH request.
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
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

  private getRequestPath(config: AxiosRequestConfig): string {
    const resolved = new URL(config.url || '', config.baseURL || this.client.defaults.baseURL || DEFAULT_API_URL);
    return `${resolved.pathname}${resolved.search}`;
  }

  private getRequestBodyForSignature(data: unknown): string {
    if (data === undefined || data === null || data === '') {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    return JSON.stringify(data);
  }

  private maskSensitiveHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...headers };
    for (const key of ['X-API-Key', 'lmts-api-key', 'lmts-timestamp', 'lmts-signature', 'identity']) {
      if (masked[key] !== undefined) {
        masked[key] = key === 'identity' ? 'Bearer ***' : '***';
      }
    }
    return masked;
  }
}
