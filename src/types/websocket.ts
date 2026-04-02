/**
 * WebSocket types for real-time data streaming.
 * @module types/websocket
 */

import type { OrderbookEntry } from './markets';
import type { HMACCredentials } from './api-tokens';

// Re-export OrderbookEntry for convenience
export type { OrderbookEntry };

/**
 * WebSocket connection configuration.
 * @public
 */
export interface WebSocketConfig {
  /**
   * WebSocket URL (default: wss://ws.limitless.exchange)
   */
  url?: string;

  /**
   * API key for authentication
   *
   * @remarks
   * **Required** for authenticated subscriptions (positions, transactions).
   * Not required for public subscriptions (market prices, orderbook).
   *
   * You can generate an API key at https://limitless.exchange
   * and the LIMITLESS_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * HMAC credentials for authenticated subscriptions.
   *
   * @remarks
   * When configured alongside `apiKey`, this client uses HMAC headers for authenticated subscriptions.
   */
  hmacCredentials?: HMACCredentials;

  /**
   * Auto-reconnect on connection loss (default: true)
   */
  autoReconnect?: boolean;

  /**
   * Reconnection delay in ms (default: 1000)
   */
  reconnectDelay?: number;

  /**
   * Maximum reconnection attempts (default: Infinity)
   */
  maxReconnectAttempts?: number;

  /**
   * Connection timeout in ms (default: 10000)
   */
  timeout?: number;
}

/**
 * WebSocket connection state.
 * @public
 */
export enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Subscription channels for WebSocket events.
 * @public
 */
export type SubscriptionChannel =
  | 'orderbook'
  | 'trades'
  | 'orders'
  | 'fills'
  | 'markets'
  | 'prices'
  | 'subscribe_market_prices'
  | 'subscribe_positions'
  | 'subscribe_transactions';

/**
 * Orderbook data structure (nested object in OrderbookUpdate).
 * @public
 */
export interface OrderbookData {
  /** List of bid orders sorted by price descending */
  bids: OrderbookEntry[];
  /** List of ask orders sorted by price ascending */
  asks: OrderbookEntry[];
  /** Token ID for the orderbook */
  tokenId: string;
  /** Adjusted midpoint price */
  adjustedMidpoint: number;
  /** Maximum spread allowed */
  maxSpread: number;
  /** Minimum order size */
  minSize: number;
}

/**
 * Orderbook update event - matches API format exactly.
 * @public
 */
export interface OrderbookUpdate {
  /** Market slug identifier (camelCase to match API) */
  marketSlug: string;
  /** Nested orderbook data object */
  orderbook: OrderbookData;
  /** Timestamp as Date or number after serialization */
  timestamp: Date | number | string;
}

/**
 * Trade event.
 * @public
 */
export interface TradeEvent {
  marketSlug: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
  tradeId: string;
}

/**
 * Order update event.
 * @public
 */
export interface OrderUpdate {
  orderId: string;
  marketSlug: string;
  side: 'BUY' | 'SELL';
  price?: number;
  size: number;
  filled: number;
  status: 'OPEN' | 'FILLED' | 'CANCELLED' | 'PARTIALLY_FILLED';
  timestamp: number;
}

/**
 * Order fill event.
 * @public
 */
export interface FillEvent {
  orderId: string;
  marketSlug: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
  fillId: string;
}

/**
 * Market update event.
 * @public
 */
export interface MarketUpdate {
  marketSlug: string;
  lastPrice?: number;
  volume24h?: number;
  priceChange24h?: number;
  timestamp: number;
}

/**
 * Price update event (deprecated - use NewPriceData for AMM prices).
 *
 * Note: This type does not match the actual API response.
 * Use NewPriceData for the correct AMM price update format.
 *
 * @public
 * @deprecated
 */
export interface PriceUpdate {
  marketSlug: string;
  price: number;
  timestamp: number;
}

/**
 * Single AMM price entry in updatedPrices array.
 * @public
 */
export interface AmmPriceEntry {
  /** Market ID */
  marketId: number;
  /** Market contract address */
  marketAddress: string;
  /** YES token price (0-1 range) */
  yesPrice: number;
  /** NO token price (0-1 range) */
  noPrice: number;
}

/**
 * AMM price update event (newPriceData) - matches API format exactly.
 * @public
 */
export interface NewPriceData {
  /** Market contract address (camelCase to match API) */
  marketAddress: string;
  /** Array of price updates for this market */
  updatedPrices: AmmPriceEntry[];
  /** Blockchain block number */
  blockNumber: number;
  /** Timestamp as Date or number after serialization */
  timestamp: Date | number | string;
}

/**
 * Transaction event (blockchain transaction status).
 * @public
 */
export interface TransactionEvent {
  /** User ID (optional) */
  userId?: number;
  /** Transaction hash (optional) */
  txHash?: string;
  /** Transaction status */
  status: 'CONFIRMED' | 'FAILED';
  /** Transaction source */
  source: string;
  /** Transaction timestamp */
  timestamp: Date | string;
  /** Market address (optional) */
  marketAddress?: string;
  /** Market slug identifier (optional) */
  marketSlug?: string;
  /** Token ID (optional) */
  tokenId?: string;
  /** Condition ID (optional) */
  conditionId?: string;
  /** Amount of contracts (optional, in string format) */
  amountContracts?: string;
  /** Amount of collateral (optional, in string format) */
  amountCollateral?: string;
  /** Price (optional, in string format) */
  price?: string;
  /** Trade side (optional) */
  side?: 'BUY' | 'SELL';
}

/**
 * Market-created websocket event payload.
 *
 * @public
 */
export interface MarketCreatedEvent {
  /** Market slug identifier */
  slug: string;
  /** Human-readable market title */
  title: string;
  /** Market venue type */
  type: 'AMM' | 'CLOB';
  /** Group market slug when this market belongs to a group */
  groupSlug?: string;
  /** Category identifiers when provided by the backend */
  categoryIds?: number[];
  /** Market creation timestamp */
  createdAt: Date | number | string;
}

/**
 * Market-resolved websocket event payload.
 *
 * @public
 */
export interface MarketResolvedEvent {
  /** Market slug identifier */
  slug: string;
  /** Market venue type */
  type: 'AMM' | 'CLOB';
  /** Winning outcome label */
  winningOutcome: 'YES' | 'NO';
  /** Winning outcome index */
  winningIndex: 0 | 1;
  /** Resolution timestamp */
  resolutionDate: Date | number | string;
}

/**
 * WebSocket event types.
 * @public
 */
export interface WebSocketEvents {
  /**
   * Connection established
   */
  connect: () => void;

  /**
   * Connection lost
   */
  disconnect: (reason: string) => void;

  /**
   * Connection error
   */
  error: (error: Error) => void;

  /**
   * Reconnection attempt
   */
  reconnecting: (attempt: number) => void;

  /**
   * Orderbook updates (CLOB markets) - API event name: orderbookUpdate
   */
  orderbookUpdate: (data: OrderbookUpdate) => void;

  /**
   * AMM price updates - API event name: newPriceData
   */
  newPriceData: (data: NewPriceData) => void;

  /**
   * Trade events
   */
  trade: (data: TradeEvent) => void;

  /**
   * Order updates
   */
  order: (data: OrderUpdate) => void;

  /**
   * Order fill events
   */
  fill: (data: FillEvent) => void;

  /**
   * Market updates
   */
  market: (data: MarketUpdate) => void;

  /**
   * Market-created lifecycle events.
   */
  marketCreated: (data: MarketCreatedEvent) => void;

  /**
   * Market-resolved lifecycle events.
   */
  marketResolved: (data: MarketResolvedEvent) => void;

  /**
   * Position updates
   */
  positions: (data: any) => void;

  /**
   * Transaction events (blockchain confirmations)
   */
  tx: (data: TransactionEvent) => void;

  /**
   * Price updates (deprecated - use newPriceData)
   * @deprecated
   */
  price: (data: PriceUpdate) => void;
}

/**
 * Subscription options.
 * @public
 */
export interface SubscriptionOptions {
  /**
   * Market slug to subscribe to (required for market-specific channels)
   * @deprecated Use marketSlugs (array) instead - server expects array format
   */
  marketSlug?: string;

  /**
   * Market slugs to subscribe to (array format - required by server)
   */
  marketSlugs?: string[];

  /**
   * Market address to subscribe to (for AMM markets)
   * @deprecated Use marketAddresses (array) instead - server expects array format
   */
  marketAddress?: string;

  /**
   * Market addresses to subscribe to (array format - required by server)
   */
  marketAddresses?: string[];

  /**
   * Additional filters
   */
  filters?: Record<string, any>;
}
