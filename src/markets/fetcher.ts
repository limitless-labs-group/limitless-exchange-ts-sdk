/**
 * Market data fetcher for Limitless Exchange.
 * @module markets/fetcher
 */

import { HttpClient, type HttpRawResponse } from '../api/http';
import {
  SdkResponse,
  type ResponseOptions,
  type WithRawResponseOptions,
  type WithoutRawResponseOptions,
} from '../api/response';
import { Market } from '../types/market-class';
import type {
  Market as MarketData,
  MarketsResponse,
  OrderBook,
  ActiveMarketsParams,
  ActiveMarketsResponse,
  Venue,
} from '../types/markets';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * Market data fetcher for retrieving market information and orderbooks.
 *
 * @remarks
 * This class provides methods to fetch market data, orderbooks, and prices
 * from the Limitless Exchange API.
 *
 * Venue caching: When fetching market data, venue information is automatically
 * cached for efficient order signing. This eliminates redundant API calls when
 * creating orders for the same market.
 *
 * @public
 */
export class MarketFetcher {
  private httpClient: HttpClient;
  private logger: ILogger;
  private venueCache: Map<string, Venue>;

  /**
   * Creates a new market fetcher instance.
   *
   * @param httpClient - HTTP client for API requests
   * @param logger - Optional logger for debugging (default: no logging)
   *
   * @example
   * ```typescript
   * const fetcher = new MarketFetcher(httpClient);
   * ```
   */
  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
    this.venueCache = new Map();
  }

  /**
   * Gets active markets with query parameters and pagination support.
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Promise resolving to active markets response
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * // Get 8 markets sorted by LP rewards
   * const response = await fetcher.getActiveMarkets({
   *   limit: 8,
   *   sortBy: 'lp_rewards'
   * });
   * console.log(`Found ${response.data.length} of ${response.totalMarketsCount} markets`);
   *
   * // Get page 2
   * const page2 = await fetcher.getActiveMarkets({
   *   limit: 8,
   *   page: 2,
   *   sortBy: 'ending_soon'
   * });
   * ```
   */
  async getActiveMarkets(
    params: ActiveMarketsParams | undefined,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<ActiveMarketsResponse>>;
  async getActiveMarkets(
    params?: ActiveMarketsParams,
    options?: WithoutRawResponseOptions
  ): Promise<ActiveMarketsResponse>;
  async getActiveMarkets(
    params: ActiveMarketsParams | undefined,
    options: ResponseOptions
  ): Promise<ActiveMarketsResponse | SdkResponse<ActiveMarketsResponse>>;
  async getActiveMarkets(
    params?: ActiveMarketsParams,
    options: ResponseOptions = {}
  ): Promise<ActiveMarketsResponse | SdkResponse<ActiveMarketsResponse>> {
    const queryParams = new URLSearchParams();

    if (params?.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }

    if (params?.page !== undefined) {
      queryParams.append('page', params.page.toString());
    }

    if (params?.sortBy) {
      queryParams.append('sortBy', params.sortBy);
    }

    const queryString = queryParams.toString();
    const endpoint = `/markets/active${queryString ? `?${queryString}` : ''}`;

    this.logger.debug('Fetching active markets', { params });

    try {
      let rawResponse: HttpRawResponse<ActiveMarketsResponse> | undefined;
      const response = options.withRawResponse
        ? (rawResponse = await this.httpClient.get<ActiveMarketsResponse>(endpoint, {
            withRawResponse: true,
          })).data
        : await this.httpClient.get<ActiveMarketsResponse>(endpoint);

      // Convert market data to Market instances with httpClient attached
      const markets = response.data.map(
        (marketData: any) => new Market(marketData, this.httpClient)
      );

      const result = {
        data: markets,
        totalMarketsCount: response.totalMarketsCount,
      };

      this.logger.info('Active markets fetched successfully', {
        count: markets.length,
        total: response.totalMarketsCount,
        sortBy: params?.sortBy,
        page: params?.page,
      });

      return rawResponse ? new SdkResponse(result, rawResponse) : result;
    } catch (error) {
      this.logger.error('Failed to fetch active markets', error as Error, { params });
      throw error;
    }
  }

  /**
   * Gets a single market by slug.
   *
   * @remarks
   * Automatically caches venue information for efficient order signing.
   * Always call this method before creating orders to ensure venue data
   * is available and avoid additional API requests.
   *
   * @param slug - Market slug identifier
   * @returns Promise resolving to market details
   * @throws Error if API request fails or market not found
   *
   * @example
   * ```typescript
   * // Get market
   * const market = await fetcher.getMarket('bitcoin-price-2024');
   * console.log(`Market: ${market.title}`);
   *
   * // Fluent API - get user orders for this market (clean!)
   * const orders = await market.getUserOrders();
   * console.log(`You have ${orders.length} orders`);
   *
   * // Venue is now cached for order signing
   * await orderClient.createOrder({
   *   marketSlug: 'bitcoin-price-2024',
   *   ...
   * });
   * ```
   */
  async getMarket(
    slug: string,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<Market, MarketData>>;
  async getMarket(slug: string, options?: WithoutRawResponseOptions): Promise<Market>;
  async getMarket(
    slug: string,
    options: ResponseOptions
  ): Promise<Market | SdkResponse<Market, MarketData>>;
  async getMarket(
    slug: string,
    options: ResponseOptions = {}
  ): Promise<Market | SdkResponse<Market, MarketData>> {
    this.logger.debug('Fetching market', { slug });

    try {
      const endpoint = `/markets/${slug}`;
      let rawResponse: HttpRawResponse<MarketData> | undefined;
      const response = options.withRawResponse
        ? (rawResponse = await this.httpClient.get<MarketData>(endpoint, { withRawResponse: true }))
            .data
        : await this.httpClient.get<MarketData>(endpoint);

      // Create Market instance with httpClient attached for fluent API
      const market = new Market(response, this.httpClient);

      if (market.venue) {
        this.venueCache.set(slug, market.venue);
        this.logger.debug('Venue cached for order signing', {
          slug,
          exchange: market.venue.exchange,
          adapter: market.venue.adapter,
          cacheSize: this.venueCache.size,
        });
      } else {
        this.logger.warn('Market has no venue data', { slug });
      }

      this.logger.info('Market fetched successfully', {
        slug,
        title: market.title,
      });
      return rawResponse ? new SdkResponse(market, rawResponse) : market;
    } catch (error) {
      this.logger.error('Failed to fetch market', error as Error, { slug });
      throw error;
    }
  }

  /**
   * Gets cached venue information for a market.
   *
   * @remarks
   * Returns venue data previously cached by getMarket() call.
   * Used internally by OrderClient for efficient order signing.
   *
   * @param slug - Market slug identifier
   * @returns Cached venue information, or undefined if not in cache
   *
   * @example
   * ```typescript
   * const venue = fetcher.getVenue('bitcoin-price-2024');
   * if (venue) {
   *   console.log(`Exchange: ${venue.exchange}`);
   * }
   * ```
   */
  getVenue(slug: string): Venue | undefined {
    const venue = this.venueCache.get(slug);

    if (venue) {
      this.logger.debug('Venue cache hit', {
        slug,
        exchange: venue.exchange,
      });
    } else {
      this.logger.debug('Venue cache miss', { slug });
    }

    return venue;
  }

  /**
   * Gets the orderbook for a CLOB market.
   *
   * @param slug - Market slug identifier
   * @returns Promise resolving to orderbook data
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const orderbook = await fetcher.getOrderBook('bitcoin-price-2024');
   * console.log(`Bids: ${orderbook.bids.length}, Asks: ${orderbook.asks.length}`);
   * ```
   */
  async getOrderBook(
    slug: string,
    options: WithRawResponseOptions
  ): Promise<SdkResponse<OrderBook>>;
  async getOrderBook(slug: string, options?: WithoutRawResponseOptions): Promise<OrderBook>;
  async getOrderBook(
    slug: string,
    options: ResponseOptions
  ): Promise<OrderBook | SdkResponse<OrderBook>>;
  async getOrderBook(
    slug: string,
    options: ResponseOptions = {}
  ): Promise<OrderBook | SdkResponse<OrderBook>> {
    this.logger.debug('Fetching orderbook', { slug });

    try {
      const endpoint = `/markets/${slug}/orderbook`;
      let rawResponse: HttpRawResponse<OrderBook> | undefined;
      const orderbook = options.withRawResponse
        ? (rawResponse = await this.httpClient.get<OrderBook>(endpoint, { withRawResponse: true }))
            .data
        : await this.httpClient.get<OrderBook>(endpoint);

      this.logger.info('Orderbook fetched successfully', {
        slug,
        bids: orderbook.bids.length,
        asks: orderbook.asks.length,
        tokenId: orderbook.tokenId,
      });
      return rawResponse ? new SdkResponse(orderbook, rawResponse) : orderbook;
    } catch (error) {
      this.logger.error('Failed to fetch orderbook', error as Error, { slug });
      throw error;
    }
  }
}
