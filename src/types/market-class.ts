/**
 * Market class with fluent API methods.
 * @module types/market-class
 */

import type { HttpClient } from '../api/http';
import type {
  CollateralToken,
  MarketCreator,
  MarketMetadata,
  MarketSettings,
  MarketTokens,
  TradePrices,
  PriceOracleMetadata,
  Venue,
  MarketOutcome,
} from './markets';
import { toFiniteInteger, toFiniteNumber } from '../utils/number-flex';

/**
 * Market class with fluent API support.
 *
 * @remarks
 * This class represents a market with methods for fetching related data.
 * Instances are created by MarketFetcher and have http_client attached.
 *
 * @public
 */
export class Market {
  // Common fields (both single and group)
  id!: number;
  slug!: string;
  title!: string;
  proxyTitle!: string | null;
  description?: string;
  collateralToken!: CollateralToken;
  expirationDate!: string;
  expirationTimestamp!: number;
  expired?: boolean;
  createdAt!: string;
  updatedAt!: string;
  categories!: string[];
  status!: string;
  creator!: MarketCreator;
  tags!: string[];
  tradeType!: string;
  marketType!: string;
  priorityIndex!: number;
  metadata!: MarketMetadata;
  volume?: string;
  volumeFormatted?: string;
  automationType?: 'manual' | 'lumy' | 'sports';
  imageUrl?: string | null;
  trends?: Record<string, unknown>;
  openInterest?: string;
  openInterestFormatted?: string;
  liquidity?: string;
  liquidityFormatted?: string;
  positionIds?: string[];

  // CLOB single market fields
  conditionId?: string;
  negRiskRequestId?: string | null;
  tokens?: MarketTokens;
  prices?: number[];
  tradePrices?: TradePrices;
  isRewardable?: boolean;
  settings?: MarketSettings;
  venue?: Venue;
  logo?: string | null;
  priceOracleMetadata?: PriceOracleMetadata;
  orderInGroup?: number;
  winningOutcomeIndex?: number | null;

  // NegRisk group market fields
  outcomeTokens?: string[];
  ogImageURI?: string;
  negRiskMarketId?: string;
  markets?: Market[];
  dailyReward?: string;

  // Legacy/deprecated fields
  address?: string | null;
  type?: string;
  outcomes?: MarketOutcome[];
  resolutionDate?: string;

  // Private http client for fluent API
  private httpClient?: HttpClient;

  /**
   * Creates a Market instance.
   *
   * @param data - Market data from API
   * @param httpClient - HTTP client for making requests
   */
  constructor(data: any, httpClient?: HttpClient) {
    // Copy all properties from data
    Object.assign(this, data);

    this.normalizeNumberLikeFields();

    // Store http client for fluent API
    this.httpClient = httpClient;

    // Handle nested Market[] for group markets
    if (data.markets && Array.isArray(data.markets)) {
      this.markets = data.markets.map((m: any) => new Market(m, httpClient));
    }
  }

  private normalizeNumberLikeFields(): void {
    this.id = toFiniteInteger(this.id) ?? this.id;
    this.expirationTimestamp = toFiniteInteger(this.expirationTimestamp) ?? this.expirationTimestamp;
    this.priorityIndex = toFiniteInteger(this.priorityIndex) ?? this.priorityIndex;

    if (this.orderInGroup !== undefined && this.orderInGroup !== null) {
      this.orderInGroup = toFiniteInteger(this.orderInGroup) ?? this.orderInGroup;
    }
    if (this.winningOutcomeIndex !== undefined && this.winningOutcomeIndex !== null) {
      this.winningOutcomeIndex = toFiniteInteger(this.winningOutcomeIndex) ?? this.winningOutcomeIndex;
    }

    if (this.collateralToken) {
      this.collateralToken.decimals =
        toFiniteInteger(this.collateralToken.decimals) ?? this.collateralToken.decimals;
    }

    if (this.settings) {
      this.settings.maxSpread = toFiniteNumber(this.settings.maxSpread) ?? this.settings.maxSpread;
      if (this.settings.rebateRate !== undefined && this.settings.rebateRate !== null) {
        this.settings.rebateRate = toFiniteNumber(this.settings.rebateRate) ?? this.settings.rebateRate;
      }
    }

    if (Array.isArray(this.prices)) {
      this.prices = this.prices.map((price) => toFiniteNumber(price) ?? price);
    }

    if (this.tradePrices) {
      this.tradePrices.buy.market = this.tradePrices.buy.market.map(
        (price) => toFiniteNumber(price) ?? price
      ) as [number, number];
      this.tradePrices.buy.limit = this.tradePrices.buy.limit.map(
        (price) => toFiniteNumber(price) ?? price
      ) as [number, number];
      this.tradePrices.sell.market = this.tradePrices.sell.market.map(
        (price) => toFiniteNumber(price) ?? price
      ) as [number, number];
      this.tradePrices.sell.limit = this.tradePrices.sell.limit.map(
        (price) => toFiniteNumber(price) ?? price
      ) as [number, number];
    }
  }

  /**
   * Get user's orders for this market.
   *
   * @remarks
   * Fetches all orders placed by the authenticated user for this specific market.
   * Uses the http_client from the MarketFetcher that created this Market instance.
   *
   * @returns Promise resolving to array of user orders
   * @throws Error if market wasn't fetched via MarketFetcher
   *
   * @example
   * ```typescript
   * // Clean fluent API
   * const market = await marketFetcher.getMarket("bitcoin-2024");
   * const orders = await market.getUserOrders();
   * console.log(`You have ${orders.length} orders in ${market.title}`);
   * ```
   */
  async getUserOrders(): Promise<any[]> {
    if (!this.httpClient) {
      throw new Error(
        'This Market instance has no httpClient attached. ' +
        'Make sure to fetch the market via MarketFetcher.getMarket() to use this method.'
      );
    }

    const response = await this.httpClient.get<any>(`/markets/${this.slug}/user-orders`);

    // Handle both array response and object with orders property
    const orders = Array.isArray(response) ? response : response.orders || [];

    return orders;
  }
}
