/**
 * Market-related types for Limitless Exchange.
 * @module types/markets
 */

/**
 * Orderbook entry (bid or ask).
 * Matches API response format exactly.
 *
 * Note: Side is implicit based on array position:
 * - Items in 'bids' array are BUY orders
 * - Items in 'asks' array are SELL orders
 *
 * @public
 */
export interface OrderbookEntry {
  /**
   * Price per share (0-1 range)
   */
  price: number;

  /**
   * Size in shares
   */
  size: number;
}

/**
 * Complete orderbook for a market.
 * Matches API response format exactly (1:1 parity).
 *
 * @public
 */
export interface OrderBook {
  /**
   * Bid orders (buy orders) sorted by price descending
   */
  bids: OrderbookEntry[];

  /**
   * Ask orders (sell orders) sorted by price ascending
   */
  asks: OrderbookEntry[];

  /**
   * Token ID for the orderbook (YES token)
   */
  tokenId: string;

  /**
   * Adjusted midpoint price between best bid and ask
   */
  adjustedMidpoint: number;

  /**
   * Maximum allowed spread for the market
   */
  maxSpread: number;

  /**
   * Minimum order size allowed
   */
  minSize: number;

  /**
   * Last trade price for the market
   */
  lastTradePrice: number;
}

/**
 * Market price information.
 * @public
 */
export interface MarketPrice {
  /**
   * Token ID
   */
  tokenId: string;

  /**
   * Current price
   */
  price: number;

  /**
   * Last update timestamp
   */
  updatedAt?: string;
}

/**
 * Market outcome information.
 * @public
 */
export interface MarketOutcome {
  /**
   * Outcome ID
   */
  id: number;

  /**
   * Outcome title
   */
  title: string;

  /**
   * Token ID for this outcome
   */
  tokenId: string;

  /**
   * Current price
   */
  price?: number;
}

/**
 * Complete market information.
 * @public
 */
export interface Market {
  /**
   * Market database ID
   */
  id: number;

  /**
   * Market contract address
   */
  address: string | null;

  /**
   * Market title
   */
  title: string;

  /**
   * Market proxy title
   */
  proxyTitle: string | null;

  /**
   * Market description
   */
  description: string;

  /**
   * Market slug identifier
   */
  slug: string;

  /**
   * Market type (CLOB or AMM)
   */
  type?: string;

  /**
   * Market outcomes
   */
  outcomes?: MarketOutcome[];

  /**
   * Creation timestamp
   */
  createdAt: string;

  /**
   * Last update timestamp
   */
  updatedAt: string;

  /**
   * Market status
   */
  status?: string;

  /**
   * Resolution timestamp
   */
  resolutionDate?: string;
}

/**
 * Markets list response.
 * @public
 */
export interface MarketsResponse {
  /**
   * Array of markets
   */
  markets: Market[];

  /**
   * Total count
   */
  total?: number;

  /**
   * Pagination offset
   */
  offset?: number;

  /**
   * Pagination limit
   */
  limit?: number;
}

/**
 * Sort options for active markets.
 * @public
 */
export type ActiveMarketsSortBy = 'lp_rewards' | 'ending_soon' | 'newest' | 'high_value';

/**
 * Query parameters for active markets endpoint.
 * @public
 */
export interface ActiveMarketsParams {
  /**
   * Maximum number of markets to return (max 25)
   * @defaultValue 25
   */
  limit?: number;

  /**
   * Page number for pagination (starts at 1)
   * @defaultValue 1
   */
  page?: number;

  /**
   * Sort order for markets
   */
  sortBy?: ActiveMarketsSortBy;
}

/**
 * Active markets response from API.
 * @public
 */
export interface ActiveMarketsResponse {
  /**
   * Array of active markets
   */
  data: Market[];

  /**
   * Total count of active markets
   */
  totalMarketsCount: number;
}
