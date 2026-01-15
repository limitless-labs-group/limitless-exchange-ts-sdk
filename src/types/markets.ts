/**
 * Market-related types for Limitless Exchange.
 * @module types/markets
 */

/**
 * Collateral token information.
 * @public
 */
export interface CollateralToken {
  /**
   * Token contract address
   */
  address: string;

  /**
   * Token decimals
   */
  decimals: number;

  /**
   * Token symbol (e.g., "USDC")
   */
  symbol: string;
}

/**
 * Market creator information.
 * @public
 */
export interface MarketCreator {
  /**
   * Creator name
   */
  name: string;

  /**
   * Creator image URL
   */
  imageURI?: string;

  /**
   * Creator link URL
   */
  link?: string;
}

/**
 * Market metadata.
 * @public
 */
export interface MarketMetadata {
  /**
   * Fee enabled flag
   */
  fee: boolean;

  /**
   * Banner flag
   */
  isBannered?: boolean;

  /**
   * Polymarket arbitrage flag
   */
  isPolyArbitrage?: boolean;

  /**
   * Market making flag
   */
  shouldMarketMake?: boolean;

  /**
   * Opening price for oracle markets
   */
  openPrice?: string;
}

/**
 * Market settings for CLOB markets.
 * @public
 */
export interface MarketSettings {
  /**
   * Minimum order size
   */
  minSize: string;

  /**
   * Maximum spread allowed
   */
  maxSpread: number;

  /**
   * Daily reward amount
   */
  dailyReward: string;

  /**
   * Rewards epoch duration
   */
  rewardsEpoch: string;

  /**
   * Constant parameter
   */
  c: string;
}

/**
 * Trade prices for different order types.
 * @public
 */
export interface TradePrices {
  /**
   * Buy prices (market and limit) for yes/no tokens
   */
  buy: {
    market: [number, number];
    limit: [number, number];
  };

  /**
   * Sell prices (market and limit) for yes/no tokens
   */
  sell: {
    market: [number, number];
    limit: [number, number];
  };
}

/**
 * Price oracle metadata for oracle-based markets.
 * @public
 */
export interface PriceOracleMetadata {
  /**
   * Asset ticker symbol
   */
  ticker: string;

  /**
   * Asset type (e.g., "CRYPTO")
   */
  assetType: string;

  /**
   * Pyth Network price feed address
   */
  pythAddress: string;

  /**
   * Price feed symbol
   */
  symbol: string;

  /**
   * Asset name
   */
  name: string;

  /**
   * Logo URL
   */
  logo: string;
}

/**
 * Orderbook entry (bid or ask).
 * Matches API response format exactly (1:1 parity).
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

  /**
   * Order side ("BUY" or "SELL")
   */
  side: string;
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
  maxSpread: string;

  /**
   * Minimum order size allowed
   */
  minSize: string;

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
 * Venue information for CLOB markets.
 *
 * @remarks
 * Contains contract addresses required for trading:
 * - exchange: Used as verifyingContract for EIP-712 order signing
 * - adapter: Required for NegRisk/Grouped market SELL approvals
 *
 * @public
 */
export interface Venue {
  /**
   * Exchange contract address.
   *
   * @remarks
   * This address is used as the verifyingContract in EIP-712 order signing.
   * All BUY orders require USDC approval to this address.
   * Simple CLOB SELL orders require CT approval to this address.
   */
  exchange: string;

  /**
   * Adapter contract address.
   *
   * @remarks
   * Required for NegRisk/Grouped markets only.
   * SELL orders on NegRisk markets require CT approval to both exchange AND adapter.
   */
  adapter: string;
}

/**
 * Market token IDs for CLOB markets.
 * @public
 */
export interface MarketTokens {
  yes: string;
  no: string;
}

/**
 * Complete market information (1:1 with API response).
 * Handles both CLOB single markets and NegRisk group markets.
 *
 * @public
 */
export interface Market {
  // Common fields (both single and group)
  /**
   * Market database ID
   */
  id: number;

  /**
   * Market slug identifier
   */
  slug: string;

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
  description?: string;

  /**
   * Collateral token information
   */
  collateralToken: CollateralToken;

  /**
   * Human-readable expiration date
   */
  expirationDate: string;

  /**
   * Expiration timestamp in milliseconds
   */
  expirationTimestamp: number;

  /**
   * Whether market is expired
   */
  expired?: boolean;

  /**
   * Creation timestamp
   */
  createdAt: string;

  /**
   * Last update timestamp
   */
  updatedAt: string;

  /**
   * Market categories
   */
  categories: string[];

  /**
   * Market status
   */
  status: string;

  /**
   * Creator information
   */
  creator: MarketCreator;

  /**
   * Market tags
   */
  tags: string[];

  /**
   * Trade type (clob or amm)
   */
  tradeType: string;

  /**
   * Market type (single or group)
   */
  marketType: string;

  /**
   * Priority index for sorting
   */
  priorityIndex: number;

  /**
   * Market metadata
   */
  metadata: MarketMetadata;

  /**
   * Trading volume
   */
  volume?: string;

  /**
   * Formatted trading volume
   */
  volumeFormatted?: string;

  // CLOB single market fields
  /**
   * Condition ID (CLOB only)
   */
  conditionId?: string;

  /**
   * NegRisk request ID (CLOB only)
   */
  negRiskRequestId?: string | null;

  /**
   * Token IDs for yes/no outcomes (CLOB only)
   * @example
   * {
   *   yes: "27687694610130623013351012526567944730242898906227824547270172934678693687246",
   *   no: "9288900480010863316984252765488448624297561656655547117581633191173128271467"
   * }
   */
  tokens?: MarketTokens;

  /**
   * Current prices [yes, no] (CLOB only)
   */
  prices?: number[];

  /**
   * Trade prices for buy/sell market/limit orders (CLOB only)
   */
  tradePrices?: TradePrices;

  /**
   * Whether market is rewardable (CLOB only)
   */
  isRewardable?: boolean;

  /**
   * Market settings (CLOB only)
   */
  settings?: MarketSettings;

  /**
   * Venue information for CLOB markets.
   *
   * @remarks
   * Contains exchange and adapter contract addresses for order signing and approvals.
   * The exchange address is used as verifyingContract in EIP-712 signatures.
   *
   * Performance tip: Call getMarket() before createOrder() to cache venue data
   * and avoid additional API requests during order creation.
   */
  venue?: Venue;

  /**
   * Market logo URL
   */
  logo?: string | null;

  /**
   * Price oracle metadata (oracle markets only)
   */
  priceOracleMetadata?: PriceOracleMetadata;

  /**
   * Order within group (group markets only)
   */
  orderInGroup?: number;

  /**
   * Winning outcome index
   */
  winningOutcomeIndex?: number | null;

  // NegRisk group market fields
  /**
   * Outcome token names (group only)
   */
  outcomeTokens?: string[];

  /**
   * OG image URI (group only)
   */
  ogImageURI?: string;

  /**
   * NegRisk market ID (group only)
   */
  negRiskMarketId?: string;

  /**
   * Child markets in group (group only)
   */
  markets?: Market[];

  /**
   * Daily reward for group (group only)
   */
  dailyReward?: string;

  // Legacy/deprecated fields (kept for backwards compatibility)
  /**
   * Market contract address
   * @deprecated Use conditionId instead
   */
  address?: string | null;

  /**
   * Market type (CLOB or AMM)
   * @deprecated Use tradeType instead
   */
  type?: string;

  /**
   * Market outcomes
   * @deprecated Use tokens for CLOB markets
   */
  outcomes?: MarketOutcome[];

  /**
   * Resolution timestamp
   * @deprecated Use expirationTimestamp instead
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
export type ActiveMarketsSortBy = 'lp_rewards' | 'ending_soon' | 'newest' | 'high_value' | 'liquidity';

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
