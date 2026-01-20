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
 * **Public Subscriptions** (no authentication required):
 * - Market prices (AMM)
 * - Orderbook updates (CLOB)
 *
 * **Authenticated Subscriptions** (require API key):
 * - User positions
 * - User transactions
 *
 * @example
 * ```typescript
 * // Public subscription (no API key needed)
 * const wsClient = new WebSocketClient({
 *   autoReconnect: true,
 * });
 *
 * await wsClient.connect();
 * await wsClient.subscribe('subscribe_market_prices', {
 *   marketSlugs: ['market-123']
 * });
 *
 * // Authenticated subscription (API key required)
 * const wsClientAuth = new WebSocketClient({
 *   apiKey: process.env.LIMITLESS_API_KEY,
 *   autoReconnect: true,
 * });
 *
 * await wsClientAuth.connect();
 * await wsClientAuth.subscribe('subscribe_positions', {
 *   marketSlugs: ['market-123']
 * });
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
      apiKey: config.apiKey || process.env.LIMITLESS_API_KEY || '',
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
   * Sets the API key for authentication.
   *
   * @param apiKey - API key value
   *
   * @remarks
   * API key is required for authenticated subscriptions (positions, transactions).
   * If already connected, this will trigger a reconnection with the new API key.
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;

    // If already connected, reconnect with new auth
    if (this.socket?.connected) {
      this.logger.info('API key updated, reconnecting...');
      // Schedule async reconnection without blocking
      this.reconnectWithNewAuth();
    }
  }

  /**
   * Reconnects with new authentication credentials.
   * @internal
   */
  private async reconnectWithNewAuth(): Promise<void> {
    await this.disconnect();
    await this.connect();
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
    // Fix: Prevent race condition by checking CONNECTING state
    if (this.socket?.connected || this.state === WebSocketState.CONNECTING) {
      this.logger.info('Already connected or connecting');
      return;
    }

    this.logger.info('Connecting to WebSocket', { url: this.config.url });
    this.state = WebSocketState.CONNECTING;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      // Create Socket.IO connection to /markets namespace
      // API key is sent via X-API-Key header for authenticated subscriptions
      const wsUrl = this.config.url;

      const socketOptions: any = {
        transports: ['websocket'], // Use WebSocket transport only
        reconnection: this.config.autoReconnect,
        reconnectionDelay: this.config.reconnectDelay,
        reconnectionDelayMax: Math.min(this.config.reconnectDelay * 32, 60000), // Max 60s
        reconnectionAttempts:
          this.config.maxReconnectAttempts === Infinity ? 0 : this.config.maxReconnectAttempts, // 0 = infinite
        randomizationFactor: 0.2, // Add jitter to prevent thundering herd
        timeout: this.config.timeout,
      };

      // Add API key to headers if provided
      // Required for authenticated subscriptions (positions, transactions)
      if (this.config.apiKey) {
        socketOptions.extraHeaders = {
          'X-API-Key': this.config.apiKey,
        };
      }

      // Connect to base URL with /markets namespace
      this.socket = io(wsUrl + '/markets', socketOptions);

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
   * @returns Promise that resolves when disconnected
   *
   * @example
   * ```typescript
   * await wsClient.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
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
   * @returns Promise that resolves immediately (kept async for API compatibility)
   * @throws Error if not connected
   *
   * @example
   * ```typescript
   * // Subscribe to orderbook for a specific market
   * await wsClient.subscribe('orderbook', { marketSlugs: ['market-123'] });
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

    // Check if API key is required for authenticated channels
    const authenticatedChannels: SubscriptionChannel[] = [
      'subscribe_positions',
      'subscribe_transactions',
    ];
    if (authenticatedChannels.includes(channel) && !this.config.apiKey) {
      throw new Error(
        `API key is required for '${channel}' subscription. ` +
          'Please provide an API key in the constructor or set LIMITLESS_API_KEY environment variable. ' +
          'You can generate an API key at https://limitless.exchange'
      );
    }

    const subscriptionKey = this.getSubscriptionKey(channel, options);
    this.subscriptions.set(subscriptionKey, options);

    this.logger.info('Subscribing to channel', { channel, options });

    // Pass channel and options as-is to the server - no transformation
    // Note: Server returns Promise<void>, so no acknowledgment callback is used
    // This is fire-and-forget to avoid timeout issues when server doesn't send ACK
    this.socket!.emit(channel, options);
    this.logger.info('Subscription request sent', { channel, options });
  }

  /**
   * Unsubscribes from a channel.
   *
   * @param channel - Channel to unsubscribe from
   * @param options - Subscription options (must match subscribe call)
   * @returns Promise that resolves when unsubscribed
   * @throws Error if not connected or unsubscribe fails
   *
   * @example
   * ```typescript
   * await wsClient.unsubscribe('orderbook', { marketSlugs: ['market-123'] });
   * ```
   */
  async unsubscribe(
    channel: SubscriptionChannel,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionKey = this.getSubscriptionKey(channel, options);
    this.subscriptions.delete(subscriptionKey);

    this.logger.info('Unsubscribing from channel', { channel, options });

    try {
      // Emit unsubscribe event with acknowledgment (waits for server response)
      const unsubscribeData = { channel, ...options };
      const response = await this.socket!.timeout(5000).emitWithAck('unsubscribe', unsubscribeData);

      // Check for errors in response
      if (response && typeof response === 'object' && 'error' in response) {
        const errorMsg = (response as any).error;
        this.logger.error('Unsubscribe failed', new Error(errorMsg), { error: errorMsg });
        throw new Error(`Unsubscribe failed: ${errorMsg}`);
      }

      this.logger.info('Unsubscribed successfully', { channel, options });
    } catch (error) {
      this.logger.error('Unsubscribe error', error as Error, { channel });
      throw error;
    }
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
  on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): this {
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
  once<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): this {
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
   * @param handler - Event handler to remove (if undefined, removes all handlers for event)
   * @returns This client for chaining
   *
   * @example
   * ```typescript
   * // Remove specific handler
   * wsClient.off('orderbookUpdate', myHandler);
   *
   * // Remove all handlers for event
   * wsClient.off('orderbookUpdate');
   * ```
   */
  off<K extends keyof WebSocketEvents>(event: K, handler?: WebSocketEvents[K]): this {
    if (!this.socket) {
      return this;
    }

    if (handler === undefined) {
      // Remove all handlers for event
      this.socket.removeAllListeners(event as string);
    } else {
      // Remove specific handler
      this.socket.off(event as string, handler as any);
    }

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
