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
   * Gets user profile for a specific wallet address.
   *
   * @remarks
   * Returns user profile data including user ID and fee rate.
   * Used internally by OrderClient to fetch user data.
   *
   * @param address - Wallet address to fetch profile for
   * @returns Promise resolving to user profile data
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * const profile = await portfolioFetcher.getProfile('0x1234...');
   * console.log(`User ID: ${profile.id}`);
   * console.log(`Account: ${profile.account}`);
   * console.log(`Fee Rate: ${profile.rank?.feeRateBps}`);
   * ```
   */
  async getProfile(address: string): Promise<any> {
    this.logger.debug('Fetching user profile', { address });

    try {
      const response = await this.httpClient.get<any>(`/profiles/${address}`);

      this.logger.info('User profile fetched successfully', { address });

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch user profile', error as Error, { address });
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
   * Gets paginated history of user actions.
   *
   *  Includes AMM trades, CLOB trades, Negrisk trades & conversions.
   *
   * @param page - Page number (starts at 1)
   * @param limit - Number of items per page
   * @returns Promise resolving to paginated history response
   * @throws Error if API request fails or user is not authenticated
   *
   * @example
   * ```typescript
   * // Get first page
   * const response = await portfolioFetcher.getUserHistory(1, 20);
   * console.log(`Found ${response.data.length} of ${response.totalCount} entries`);
   *
   * // Process history entries
   * for (const entry of response.data) {
   *   console.log(`Type: ${entry.type}`);
   *   console.log(`Market: ${entry.marketSlug}`);
   * }
   *
   * // Get next page
   * const page2 = await portfolioFetcher.getUserHistory(2, 20);
   * ```
   */
  async getUserHistory(page: number = 1, limit: number = 10): Promise<HistoryResponse> {
    this.logger.debug('Fetching user history', { page, limit });

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await this.httpClient.get<HistoryResponse>(
        `/portfolio/history?${params.toString()}`
      );

      this.logger.info('User history fetched successfully');

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch user history', error as Error, { page, limit });
      throw error;
    }
  }
}
