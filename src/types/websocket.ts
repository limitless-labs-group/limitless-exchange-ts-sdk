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
   * Not required for public market-price subscriptions.
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
  | 'subscribe_market_prices'
  | 'subscribe_positions'
  | 'subscribe_transactions'
  | 'subscribe_order_events'
  | 'subscribe_live_sports'
  | 'subscribe_live_esports'
  | 'subscribe_market_lifecycle'
  | 'unsubscribe_market_lifecycle';

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
 * Single AMM price entry in `newPriceData.updatedPrices`.
 *
 * @remarks
 * This is not used by `orderbookUpdate`; CLOB orderbook updates use `OrderbookData`.
 *
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
 * Oracle price update event.
 * @public
 */
export interface OraclePriceData {
  /** Market contract address when available */
  marketAddress: string | null;
  /** Market slug identifier */
  marketSlug: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Oracle price value */
  value: number;
}

/**
 * OME order lifecycle event.
 * @public
 */
export interface OmeOrderEvent {
  clientOrderId?: string;
  eventId: number;
  marketId: string;
  orderId: string;
  price: string;
  remainingSize: string;
  side: string;
  source: 'OME';
  timestamp: string;
  token: string;
  type: 'PLACEMENT' | 'UPDATE' | 'CANCELLATION';
  userId: number;
}

/**
 * Maker match included in settlement order events.
 * @public
 */
export interface SettlementMakerMatch {
  account: string;
  matchedSize: string;
  orderId: string;
  price: string;
}

/**
 * Settlement order lifecycle event.
 * @public
 */
export interface SettlementOrderEvent {
  amountCollateral?: string;
  amountContracts?: string;
  clientOrderId?: string;
  configuredFeeRateBps?: number;
  effectiveFeeBps?: number;
  eventId: string;
  feeAmountCollateral?: string;
  feeAmountContracts?: string;
  makerMatches?: SettlementMakerMatch[];
  marketSlug?: string;
  orderId?: string;
  price?: string;
  side?: string;
  source: 'SETTLEMENT';
  takerAccount?: string;
  takerOrderId?: string;
  timestamp: Date | number | string;
  tokenId?: string;
  tradeEventId?: string;
  txHash?: string;
  type: 'MINED' | 'FAILED';
}

/**
 * Order lifecycle event emitted by subscribe_order_events.
 * @public
 */
export type OrderEvent = OmeOrderEvent | SettlementOrderEvent;

/**
 * Live sports match data.
 * @public
 */
export interface LiveSportsMatchData {
  awayScore: number | null;
  elapsedMinutes: number | null;
  extraMinutes: number | null;
  fixtureId: number;
  homeScore: number | null;
  isFinished: boolean;
  statusShort: string;
}

/**
 * Live sports snapshot keyed by market/group identifier.
 * @public
 */
export type LiveSportsUpdate = Record<string, LiveSportsMatchData>;

/**
 * Live esports match data.
 * @public
 */
export interface LiveEsportsMatchData {
  gameScores?: Array<{ away: number; home: number }>;
  isFinished: boolean;
  matchId: number;
  matchScore: { away: number; home: number };
  status: string;
}

/**
 * Live esports snapshot keyed by market/group identifier.
 * @public
 */
export type LiveEsportsUpdate = Record<string, LiveEsportsMatchData>;

/**
 * WebSocket system message.
 * @public
 */
export type SystemEvent = string | { message: string; [key: string]: unknown };

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
   * Oracle price updates - API event name: oraclePriceData
   */
  oraclePriceData: (data: OraclePriceData) => void;

  /**
   * Order lifecycle events - API event name: orderEvent
   */
  orderEvent: (data: OrderEvent) => void;

  /**
   * Market-created lifecycle events.
   */
  marketCreated: (data: MarketCreatedEvent) => void;

  /**
   * Market-resolved lifecycle events.
   */
  marketResolved: (data: MarketResolvedEvent) => void;

  /**
   * Live sports updates.
   */
  live_sports_update: (data: LiveSportsUpdate) => void;

  /**
   * Live esports updates.
   */
  live_esports_update: (data: LiveEsportsUpdate) => void;

  /**
   * WebSocket system messages.
   */
  system: (data: SystemEvent) => void;

  /**
   * Position updates
   */
  positions: (data: any) => void;

  /**
   * Transaction events (blockchain confirmations)
   */
  tx: (data: TransactionEvent) => void;
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
