import { AxiosResponse } from 'axios';
import { HttpClient } from '../api/http';
import { MessageSigner } from './signer';
import type { AuthResult, LoginOptions, UserProfile } from '../types/auth';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Authenticator for Limitless Exchange API.
 *
 * @remarks
 * This class handles the complete authentication flow:
 * 1. Get signing message from API
 * 2. Sign message with wallet
 * 3. Login and obtain session cookie
 * 4. Verify authentication status
 *
 * @public
 */
export class Authenticator {
  private httpClient: HttpClient;
  private signer: MessageSigner;
  private logger: ILogger;

  /**
   * Creates a new authenticator instance.
   *
   * @param httpClient - HTTP client for API requests
   * @param signer - Message signer for wallet operations
   * @param logger - Optional logger for debugging and monitoring (default: no logging)
   *
   * @example
   * ```typescript
   * // Without logging (default)
   * const authenticator = new Authenticator(httpClient, signer);
   *
   * // With logging
   * import { ConsoleLogger } from '@limitless/exchange-ts-sdk';
   * const logger = new ConsoleLogger('debug');
   * const authenticator = new Authenticator(httpClient, signer, logger);
   * ```
   */
  constructor(httpClient: HttpClient, signer: MessageSigner, logger?: ILogger) {
    this.httpClient = httpClient;
    this.signer = signer;
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Gets a signing message from the API.
   *
   * @returns Promise resolving to signing message string
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const message = await authenticator.getSigningMessage();
   * console.log(message);
   * ```
   */
  async getSigningMessage(): Promise<string> {
    this.logger.debug('Requesting signing message from API');
    const message = await this.httpClient.get<string>('/auth/signing-message');
    this.logger.debug('Received signing message', { length: message.length });
    return message;
  }

  /**
   * Authenticates with the API and obtains session cookie.
   *
   * @param options - Login options including client type and smart wallet
   * @returns Promise resolving to authentication result
   * @throws Error if authentication fails or smart wallet is required but not provided
   *
   * @example
   * ```typescript
   * // EOA authentication
   * const result = await authenticator.authenticate({ client: 'eoa' });
   *
   * // ETHERSPOT with smart wallet
   * const result = await authenticator.authenticate({
   *   client: 'etherspot',
   *   smartWallet: '0x...'
   * });
   * ```
   */
  async authenticate(options: LoginOptions = {}): Promise<AuthResult> {
    const client = options.client || 'eoa';

    this.logger.info('Starting authentication', {
      client,
      hasSmartWallet: !!options.smartWallet,
    });

    if (client === 'etherspot' && !options.smartWallet) {
      this.logger.error('Smart wallet address required for ETHERSPOT client');
      throw new Error('Smart wallet address is required for ETHERSPOT client');
    }

    try {
      const signingMessage = await this.getSigningMessage();

      this.logger.debug('Creating signature headers');
      const headers = await this.signer.createAuthHeaders(signingMessage);

      this.logger.debug('Sending authentication request', { client });
      const response = await this.httpClient.postWithResponse<UserProfile>(
        '/auth/login',
        { client, smartWallet: options.smartWallet },
        {
          headers: headers as any,
          validateStatus: (status) => status < 500,
        }
      );

      this.logger.debug('Extracting session cookie from response');
      const cookies = this.httpClient.extractCookies(response);

      const sessionCookie = cookies['limitless_session'];
      if (!sessionCookie) {
        this.logger.error('Session cookie not found in response headers');
        throw new Error('Failed to obtain session cookie from response');
      }

      this.httpClient.setSessionCookie(sessionCookie);

      this.logger.info('Authentication successful', {
        account: response.data.account,
        client: response.data.client,
      });

      return {
        sessionCookie,
        profile: response.data,
      };
    } catch (error) {
      this.logger.error('Authentication failed', error as Error, {
        client,
      });
      throw error;
    }
  }

  /**
   * Verifies the current authentication status.
   *
   * @param sessionCookie - Session cookie to verify
   * @returns Promise resolving to user's Ethereum address
   * @throws Error if session is invalid
   *
   * @example
   * ```typescript
   * const address = await authenticator.verifyAuth(sessionCookie);
   * console.log(`Authenticated as: ${address}`);
   * ```
   */
  async verifyAuth(sessionCookie: string): Promise<string> {
    this.logger.debug('Verifying authentication session');
    const originalCookie = this.httpClient['sessionCookie'];
    this.httpClient.setSessionCookie(sessionCookie);

    try {
      const address = await this.httpClient.get<string>('/auth/verify-auth');
      this.logger.info('Session verified', { address });
      return address;
    } catch (error) {
      this.logger.error('Session verification failed', error as Error);
      throw error;
    } finally {
      if (originalCookie) {
        this.httpClient.setSessionCookie(originalCookie);
      } else {
        this.httpClient.clearSessionCookie();
      }
    }
  }

  /**
   * Logs out and clears the session.
   *
   * @param sessionCookie - Session cookie to invalidate
   * @throws Error if logout request fails
   *
   * @example
   * ```typescript
   * await authenticator.logout(sessionCookie);
   * console.log('Logged out successfully');
   * ```
   */
  async logout(sessionCookie: string): Promise<void> {
    this.logger.debug('Logging out session');
    const originalCookie = this.httpClient['sessionCookie'];
    this.httpClient.setSessionCookie(sessionCookie);

    try {
      await this.httpClient.post('/auth/logout', {});
      this.logger.info('Logout successful');
    } catch (error) {
      this.logger.error('Logout failed', error as Error);
      throw error;
    } finally {
      if (originalCookie) {
        this.httpClient.setSessionCookie(originalCookie);
      } else {
        this.httpClient.clearSessionCookie();
      }
    }
  }
}
