/**
 * WebSocket client for real-time data streaming.
 * @module websocket/client
 */

import { io, Socket } from 'socket.io-client';
import { DEFAULT_WS_URL } from '../utils/constants';
import {
  WebSocketState,
  type WebSocketConfig,
  type WebSocketEvents,
  type SubscriptionChannel,
  type SubscriptionOptions,
  type OrderbookUpdate,
  type TradeEvent,
  type OrderUpdate,
  type FillEvent,
  type MarketUpdate,
  type PriceUpdate,
} from '../types/websocket';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * WebSocket client for real-time data streaming from Limitless Exchange.
 *
 * @remarks
 * This client uses Socket.IO to connect to the WebSocket server and provides
 * typed event subscriptions for orderbook, trades, orders, and market data.
 *
 * @example
 * ```typescript
 * // Create client
 * const wsClient = new WebSocketClient({
 *   sessionCookie: 'your-session-cookie',
 *   autoReconnect: true,
 * });
 *
 * // Subscribe to orderbook updates
 * wsClient.on('orderbook', (data) => {
 *   console.log('Orderbook update:', data);
 * });
 *
 * // Connect and subscribe
 * await wsClient.connect();
 * await wsClient.subscribe('orderbook', { marketSlug: 'market-123' });
 * ```
 *
 * @public
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private config: Required<WebSocketConfig>;
  private logger: ILogger;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private reconnectAttempts = 0;
  private subscriptions: Map<string, SubscriptionOptions> = new Map();
  private pendingListeners: Array<{ event: string; handler: any }> = [];

  /**
   * Creates a new WebSocket client.
   *
   * @param config - WebSocket configuration
   * @param logger - Optional logger for debugging
   */
  constructor(config: WebSocketConfig = {}, logger?: ILogger) {
    this.config = {
      url: config.url || DEFAULT_WS_URL,
      sessionCookie: config.sessionCookie || '',
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || Infinity,
      timeout: config.timeout || 10000,
    };
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Gets current connection state.
   *
   * @returns Current WebSocket state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Checks if client is connected.
   *
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED && this.socket?.connected === true;
  }

  /**
   * Sets the session cookie for authentication.
   *
   * @param sessionCookie - Session cookie value
   */
  setSessionCookie(sessionCookie: string): void {
    this.config.sessionCookie = sessionCookie;

    // If already connected, reconnect with new auth
    if (this.socket?.connected) {
      this.logger.info('Session cookie updated, reconnecting...');
      this.disconnect();
      this.connect();
    }
  }

  /**
   * Connects to the WebSocket server.
   *
   * @returns Promise that resolves when connected
   * @throws Error if connection fails
   *
   * @example
   * ```typescript
   * await wsClient.connect();
   * console.log('Connected!');
   * ```
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      this.logger.info('Already connected');
      return;
    }

    this.logger.info('Connecting to WebSocket', { url: this.config.url });
    this.state = WebSocketState.CONNECTING;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      // Create Socket.IO connection to /markets namespace
      // Authentication via cookie header (required by WsJwtAuthGuard)
      const wsUrl = this.config.url.endsWith('/markets')
        ? this.config.url
        : `${this.config.url}/markets`;

      this.socket = io(wsUrl, {
        transports: ['websocket'], // Use WebSocket transport only
        extraHeaders: {
          cookie: `limitless_session=${this.config.sessionCookie}`
        },
        reconnection: this.config.autoReconnect,
        reconnectionDelay: this.config.reconnectDelay,
        reconnectionAttempts: this.config.maxReconnectAttempts,
        timeout: this.config.timeout,
      });

      // Attach any pending listeners that were added before connect()
      this.attachPendingListeners();

      // Setup event handlers
      this.setupEventHandlers();

      // Handle connection
      this.socket.once('connect', () => {
        clearTimeout(timeout);
        this.state = WebSocketState.CONNECTED;
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connected');

        // Re-subscribe to all previous subscriptions
        this.resubscribeAll();

        resolve();
      });

      // Handle connection error
      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        this.state = WebSocketState.ERROR;
        this.logger.error('WebSocket connection error', error);
        reject(error);
      });
    });
  }

  /**
   * Disconnects from the WebSocket server.
   *
   * @example
   * ```typescript
   * wsClient.disconnect();
   * ```
   */
  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.logger.info('Disconnecting from WebSocket');
    this.socket.disconnect();
    this.socket = null;
    this.state = WebSocketState.DISCONNECTED;
    this.subscriptions.clear();
  }

  /**
   * Subscribes to a channel.
   *
   * @param channel - Channel to subscribe to
   * @param options - Subscription options
   * @returns Promise that resolves when subscribed
   * @throws Error if not connected
   *
   * @example
   * ```typescript
   * // Subscribe to orderbook for a specific market
   * await wsClient.subscribe('orderbook', { marketSlug: 'market-123' });
   *
   * // Subscribe to all trades
   * await wsClient.subscribe('trades');
   *
   * // Subscribe to your orders
   * await wsClient.subscribe('orders');
   * ```
   */
  async subscribe(channel: SubscriptionChannel, options: SubscriptionOptions = {}): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected. Call connect() first.');
    }

    const subscriptionKey = this.getSubscriptionKey(channel, options);
    this.subscriptions.set(subscriptionKey, options);

    this.logger.info('Subscribing to channel', { channel, options });

    // Pass channel and options as-is to the server - no transformation
    return new Promise((resolve, reject) => {
      this.socket!.emit(channel, options, (response: any) => {
        if (response?.error) {
          this.logger.error('Subscription failed', response.error);
          this.subscriptions.delete(subscriptionKey);
          reject(new Error(response.error));
        } else {
          this.logger.info('Subscribed successfully', { channel, options });
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribes from a channel.
   *
   * @param channel - Channel to unsubscribe from
   * @param options - Subscription options (must match subscribe call)
   * @returns Promise that resolves when unsubscribed
   *
   * @example
   * ```typescript
   * await wsClient.unsubscribe('orderbook', { marketSlug: 'market-123' });
   * ```
   */
  async unsubscribe(channel: SubscriptionChannel, options: SubscriptionOptions = {}): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionKey = this.getSubscriptionKey(channel, options);
    this.subscriptions.delete(subscriptionKey);

    this.logger.info('Unsubscribing from channel', { channel, options });

    // Pass raw unsubscribe event with channel and options
    return new Promise((resolve, reject) => {
      this.socket!.emit('unsubscribe', { channel, ...options }, (response: any) => {
        if (response?.error) {
          this.logger.error('Unsubscribe failed', response.error);
          reject(new Error(response.error));
        } else {
          this.logger.info('Unsubscribed successfully', { channel, options });
          resolve();
        }
      });
    });
  }

  /**
   * Registers an event listener.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns This client for chaining
   *
   * @example
   * ```typescript
   * wsClient
   *   .on('orderbook', (data) => console.log('Orderbook:', data))
   *   .on('trade', (data) => console.log('Trade:', data))
   *   .on('error', (error) => console.error('Error:', error));
   * ```
   */
  on<K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): this {
    if (!this.socket) {
      // Store listener to be attached when socket is created
      this.pendingListeners.push({ event: event as string, handler });
      return this;
    }

    // Pass raw event names, no transformation
    this.socket.on(event as string, handler as any);
    return this;
  }

  /**
   * Registers a one-time event listener.
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns This client for chaining
   */
  once<K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): this {
    if (!this.socket) {
      throw new Error('WebSocket not initialized. Call connect() first.');
    }

    // Pass raw event names, no transformation
    this.socket.once(event as string, handler as any);
    return this;
  }

  /**
   * Removes an event listener.
   *
   * @param event - Event name
   * @param handler - Event handler to remove
   * @returns This client for chaining
   */
  off<K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): this {
    if (!this.socket) {
      return this;
    }

    // Pass raw event names, no transformation
    this.socket.off(event as string, handler as any);
    return this;
  }

  /**
   * Attach any pending event listeners that were added before connect().
   * @internal
   */
  private attachPendingListeners(): void {
    if (!this.socket || this.pendingListeners.length === 0) {
      return;
    }

    for (const { event, handler } of this.pendingListeners) {
      // Pass event names as-is, no transformation
      this.socket.on(event, handler);
    }

    // Clear pending listeners
    this.pendingListeners = [];
  }

  /**
   * Setup internal event handlers for connection management.
   * @internal
   */
  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Connection events
    this.socket.on('connect', () => {
      this.state = WebSocketState.CONNECTED;
      this.reconnectAttempts = 0;
      this.logger.info('WebSocket connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.state = WebSocketState.DISCONNECTED;
      this.logger.info('WebSocket disconnected', { reason });
    });

    this.socket.on('error', (error) => {
      this.state = WebSocketState.ERROR;
      this.logger.error('WebSocket error', error);
    });

    // Reconnection events
    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.state = WebSocketState.RECONNECTING;
      this.reconnectAttempts = attempt;
      this.logger.info('Reconnecting...', { attempt });
    });

    this.socket.io.on('reconnect', (attempt) => {
      this.state = WebSocketState.CONNECTED;
      this.logger.info('Reconnected', { attempts: attempt });
      this.resubscribeAll();
    });

    this.socket.io.on('reconnect_error', (error) => {
      this.logger.error('Reconnection error', error);
    });

    this.socket.io.on('reconnect_failed', () => {
      this.state = WebSocketState.ERROR;
      this.logger.error('Reconnection failed');
    });
  }

  /**
   * Re-subscribes to all previous subscriptions after reconnection.
   * @internal
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) {
      return;
    }

    this.logger.info('Re-subscribing to channels', {
      count: this.subscriptions.size,
    });

    for (const [key, options] of this.subscriptions.entries()) {
      const channel = this.getChannelFromKey(key);
      try {
        await this.subscribe(channel, options);
      } catch (error) {
        this.logger.error('Failed to re-subscribe', error as Error, { channel, options });
      }
    }
  }

  /**
   * Creates a unique subscription key.
   * @internal
   */
  private getSubscriptionKey(channel: SubscriptionChannel, options: SubscriptionOptions): string {
    return `${channel}:${options.marketSlug || 'global'}`;
  }

  /**
   * Extracts channel from subscription key.
   * @internal
   */
  private getChannelFromKey(key: string): SubscriptionChannel {
    return key.split(':')[0] as SubscriptionChannel;
  }
}
