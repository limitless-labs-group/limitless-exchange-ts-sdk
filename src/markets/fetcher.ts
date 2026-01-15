/**
 * Market data fetcher for Limitless Exchange.
 * @module markets/fetcher
 */

import { HttpClient } from '../api/http';
import type {
  Market,
  MarketsResponse,
  OrderBook,
  MarketPrice,
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
  async getActiveMarkets(params?: ActiveMarketsParams): Promise<ActiveMarketsResponse> {
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
      const response = await this.httpClient.get<ActiveMarketsResponse>(endpoint);

      this.logger.info('Active markets fetched successfully', {
        count: response.data.length,
        total: response.totalMarketsCount,
        sortBy: params?.sortBy,
        page: params?.page,
      });

      return response;
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
   * const market = await fetcher.getMarket('bitcoin-price-2024');
   * console.log(`Market: ${market.title}`);
   *
   * // Venue is now cached for order signing
   * await orderClient.createOrder({
   *   marketSlug: 'bitcoin-price-2024',
   *   ...
   * });
   * ```
   */
  async getMarket(slug: string): Promise<Market> {
    this.logger.debug('Fetching market', { slug });

    try {
      const market = await this.httpClient.get<Market>(`/markets/${slug}`);

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
      return market;
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
  async getOrderBook(slug: string): Promise<OrderBook> {
    this.logger.debug('Fetching orderbook', { slug });

    try {
      const orderbook = await this.httpClient.get<OrderBook>(
        `/markets/${slug}/orderbook`
      );

      this.logger.info('Orderbook fetched successfully', {
        slug,
        bids: orderbook.bids.length,
        asks: orderbook.asks.length,
        tokenId: orderbook.tokenId,
      });
      return orderbook;
    } catch (error) {
      this.logger.error('Failed to fetch orderbook', error as Error, { slug });
      throw error;
    }
  }

  /**
   * Gets the current price for a token.
   *
   * @param tokenId - Token ID
   * @returns Promise resolving to price information
   * @throws Error if API request fails
   *
   * @example
   * ```typescript
   * const price = await fetcher.getPrice('123456');
   * console.log(`Current price: ${price.price}`);
   * ```
   */
  async getPrice(tokenId: string): Promise<MarketPrice> {
    this.logger.debug('Fetching price', { tokenId });

    try {
      const price = await this.httpClient.get<MarketPrice>(`/prices/${tokenId}`);

      this.logger.info('Price fetched successfully', {
        tokenId,
        price: price.price,
      });
      return price;
    } catch (error) {
      this.logger.error('Failed to fetch price', error as Error, { tokenId });
      throw error;
    }
  }
}
