/**
 * WebSocket types for real-time data streaming.
 * @module types/websocket
 */

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
   * Session cookie for authentication
   */
  sessionCookie?: string;

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
  | 'prices';

/**
 * Orderbook update event.
 * @public
 */
export interface OrderbookUpdate {
  marketSlug: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
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
 * Price update event.
 * @public
 */
export interface PriceUpdate {
  marketSlug: string;
  price: number;
  timestamp: number;
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
   * Orderbook updates
   */
  orderbook: (data: OrderbookUpdate) => void;

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
   * Price updates
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
   */
  marketSlug?: string;

  /**
   * Market address to subscribe to (for AMM markets)
   */
  marketAddress?: string;

  /**
   * Additional filters
   */
  filters?: Record<string, any>;
}
