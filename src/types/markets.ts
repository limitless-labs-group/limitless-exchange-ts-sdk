/**
 * Market-related types for Limitless Exchange.
 * @module types/markets
 */

/**
 * Orderbook entry (bid or ask).
 * @public
 */
export interface OrderbookEntry {
  /**
   * Price per share
   */
  price: number;

  /**
   * Size in shares (scaled by 1e6)
   */
  size: number;

  /**
   * Order side (BUY or SELL)
   */
  side: string;
}

/**
 * Complete orderbook for a market.
 * @public
 */
export interface OrderBook {
  /**
   * Bid orders (buy orders)
   */
  bids: OrderbookEntry[];

  /**
   * Ask orders (sell orders)
   */
  asks: OrderbookEntry[];

  /**
   * Token ID for the orderbook (YES token)
   */
  tokenId: string;

  /**
   * Minimum order size
   */
  minSize: string;

  /**
   * Last trade price
   */
  lastTradePrice?: number;
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
