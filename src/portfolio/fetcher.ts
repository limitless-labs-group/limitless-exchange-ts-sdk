/**
 * Portfolio data fetcher for Limitless Exchange.
 * @module portfolio/fetcher
 */

import { HttpClient } from '../api/http';
import type {
  PortfolioPositionsResponse,
  CLOBPosition,
  AMMPosition,
  Position,
  PortfolioSummary,
  HistoryResponse,
} from '../types/portfolio';
import type { UserProfile } from '../types/auth';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Portfolio data fetcher for retrieving user positions and portfolio information.
 *
 * @remarks
 * This class provides methods to fetch user positions and calculate portfolio statistics
 * from the Limitless Exchange API. Requires an authenticated HttpClient.
 *
 * @public
 */
export class PortfolioFetcher {
  private httpClient: HttpClient;
  private logger: ILogger;

  /**
   * Creates a new portfolio fetcher instance.
   *
   * @param httpClient - Authenticated HTTP client for API requests
   * @param logger - Optional logger for debugging (default: no logging)
   *
   * @example
   * ```typescript
   * // Create authenticated client
   * const httpClient = new HttpClient({ baseURL: API_URL });
   * await authenticator.authenticate({ client: 'eoa' });
   *
   * // Create portfolio fetcher
   * const portfolioFetcher = new PortfolioFetcher(httpClient);
   * ```
   */
  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Gets user profile for a wallet address.
   *
   * @remarks
   * Returns user profile data including user ID and fee rate.
   * Used internally by OrderClient to fetch user data.
   * If no address is provided, the SDK calls `/profiles/me` and the API resolves
   * the profile from the authenticated request.
   *
   * @param address - Optional wallet address to fetch profile for
   * @returns Promise resolving to user profile data
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * // Uses the authenticated account
   * const profile = await client.portfolio.getProfile();
   *
   * // Or pass the address explicitly
   * const profile = await portfolioFetcher.getProfile('0x1234...');
   * console.log(`User ID: ${profile.id}`);
   * console.log(`Account: ${profile.account}`);
   * console.log(`Fee Rate: ${profile.rank?.feeRateBps}`);
   * ```
   */
  async getProfile(address?: string): Promise<UserProfile> {
    const profileAddress = address?.trim();
    const endpoint = profileAddress
      ? `/profiles/${encodeURIComponent(profileAddress)}`
      : '/profiles/me';

    this.logger.debug('Fetching user profile', { address: profileAddress });

    try {
      const response = await this.httpClient.get<UserProfile>(endpoint);

      this.logger.info('User profile fetched successfully', { address: profileAddress });

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch user profile', error as Error, {
        address: profileAddress,
      });
      throw error;
    }
  }

  /**
   * Gets raw portfolio positions response from API.
   *
   * @returns Promise resolving to portfolio positions response with CLOB and AMM positions
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * const response = await portfolioFetcher.getPositions();
   * console.log(`CLOB positions: ${response.clob.length}`);
   * console.log(`AMM positions: ${response.amm.length}`);
   * console.log(`Total points: ${response.accumulativePoints}`);
   * ```
   */
  async getPositions(): Promise<PortfolioPositionsResponse> {
    this.logger.debug('Fetching user positions');

    try {
      const response =
        await this.httpClient.get<PortfolioPositionsResponse>('/portfolio/positions');

      this.logger.info('Positions fetched successfully', {
        clobCount: response.clob?.length || 0,
        ammCount: response.amm?.length || 0,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch positions', error as Error);
      throw error;
    }
  }

  /**
   * Gets CLOB positions only.
   *
   * @returns Promise resolving to array of CLOB positions
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const clobPositions = await portfolioFetcher.getCLOBPositions();
   * clobPositions.forEach(pos => {
   *   console.log(`${pos.market.title}: YES ${pos.positions.yes.unrealizedPnl} P&L`);
   * });
   * ```
   */
  async getCLOBPositions(): Promise<CLOBPosition[]> {
    const response = await this.getPositions();
    return response.clob || [];
  }

  /**
   * Gets AMM positions only.
   *
   * @returns Promise resolving to array of AMM positions
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const ammPositions = await portfolioFetcher.getAMMPositions();
   * ammPositions.forEach(pos => {
   *   console.log(`${pos.market.title}: ${pos.unrealizedPnl} P&L`);
   * });
   * ```
   */
  async getAMMPositions(): Promise<AMMPosition[]> {
    const response = await this.getPositions();
    return response.amm || [];
  }

  /**
   * Gets cursor-paginated history of user actions.
   *
   * Includes AMM trades, CLOB trades, NegRisk trades & conversions.
   *
   * @param cursor - Opaque cursor for pagination. Omit it or pass an empty string for the first page.
   * @param limit - Number of items per page
   * @returns Promise resolving to cursor-paginated history response
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * // Get first page
   * const response = await portfolioFetcher.getUserHistory();
   * console.log(`Found ${response.data.length} entries`);
   *
   * // Process history entries
   * for (const entry of response.data) {
   *   console.log(`Strategy: ${entry.strategy}`);
   *   console.log(`Market: ${entry.market?.slug}`);
   * }
   *
   * // Get next page using cursor
   * if (response.nextCursor) {
   *   const page2 = await portfolioFetcher.getUserHistory(response.nextCursor, 20);
   * }
   * ```
   */
  async getUserHistory(cursor?: string, limit: number = 20): Promise<HistoryResponse> {
    this.logger.debug('Fetching user history', { cursor, limit });

    try {
      // Always send cursor=, using an empty value on the first page.
      const params = new URLSearchParams({
        cursor: cursor ?? '',
        limit: limit.toString(),
      });

      const response = await this.httpClient.get<HistoryResponse>(
        `/portfolio/history?${params.toString()}`
      );

      this.logger.info('User history fetched successfully');

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch user history', error as Error, { cursor, limit });
      throw error;
    }
  }
}
