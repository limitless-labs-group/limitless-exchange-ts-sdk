/**
 * Order client for managing orders on Limitless Exchange.
 * @module orders/client
 */

import type { HttpClient } from '../api/http';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';
import type {
  NewOrderPayload,
  OrderResponse,
  OrderArgs,
  UnsignedOrder,
  OrderSigningConfig,
} from '../types/orders';
import { OrderType, MarketType } from '../types/orders';
import { OrderBuilder } from './builder';
import { OrderSigner } from './signer';
import type { ethers } from 'ethers';
import type { UserData } from '../types/auth';
import { getContractAddress } from '../utils/constants';

/**
 * Configuration for the order client.
 *
 * @remarks
 * The order client supports two configuration modes:
 * 1. Simple mode: Provide userData and marketType (auto-configures signing)
 * 2. Advanced mode: Provide userData and custom signingConfig
 *
 * @public
 */
export interface OrderClientConfig {
  /**
   * HTTP client for API requests
   */
  httpClient: HttpClient;

  /**
   * Wallet for signing orders
   */
  wallet: ethers.Wallet;

  /**
   * User data containing userId and feeRateBps
   *
   * @example
   * ```typescript
   * {
   *   userId: 123,      // From auth result
   *   feeRateBps: 300   // User's fee rate (3%)
   * }
   * ```
   */
  userData: UserData;

  /**
   * Market type for auto-configuration (optional if signingConfig provided)
   *
   * @remarks
   * When provided without signingConfig, automatically loads contract address
   * from environment variables or SDK defaults.
   *
   * @defaultValue MarketType.CLOB
   */
  marketType?: MarketType;

  /**
   * Custom signing configuration (optional)
   *
   * @remarks
   * If not provided, SDK will auto-configure based on marketType.
   * Useful for custom deployments or testing.
   */
  signingConfig?: OrderSigningConfig;

  /**
   * Optional logger
   */
  logger?: ILogger;
}

/**
 * Order client for creating and managing orders.
 *
 * @remarks
 * This class provides high-level methods for order operations,
 * abstracting away HTTP details and order signing complexity.
 *
 * @example
 * ```typescript
 * const orderClient = new OrderClient({
 *   httpClient,
 *   wallet,
 *   ownerId: 123,
 *   feeRateBps: 100,
 *   signingConfig: {
 *     chainId: 8453,
 *     contractAddress: '0x...',
 *     marketType: MarketType.CLOB
 *   }
 * });
 *
 * const order = await orderClient.createOrder({
 *   tokenId: '123...',
 *   price: 0.65,
 *   size: 100,
 *   side: Side.BUY,
 *   orderType: OrderType.GTC,
 *   marketSlug: 'market-slug'
 * });
 * ```
 *
 * @public
 */
export class OrderClient {
  private httpClient: HttpClient;
  private orderBuilder: OrderBuilder;
  private orderSigner: OrderSigner;
  private ownerId: number;
  private signingConfig: OrderSigningConfig;
  private logger: ILogger;

  /**
   * Creates a new order client instance.
   *
   * @param config - Order client configuration
   *
   * @throws Error if neither marketType nor signingConfig is provided
   */
  constructor(config: OrderClientConfig) {
    this.httpClient = config.httpClient;
    this.logger = config.logger || new NoOpLogger();

    // Extract user data
    this.ownerId = config.userData.userId;
    const feeRateBps = config.userData.feeRateBps;

    // Initialize order builder with default price tick (0.001 = 3 decimals)
    this.orderBuilder = new OrderBuilder(config.wallet.address, feeRateBps, 0.001);

    // Initialize order signer
    this.orderSigner = new OrderSigner(config.wallet, this.logger);

    // Configure signing: use provided config or auto-configure from marketType
    if (config.signingConfig) {
      // Use custom signing configuration
      this.signingConfig = config.signingConfig;
    } else if (config.marketType) {
      // Auto-configure from market type
      const chainId = parseInt(process.env.CHAIN_ID || '8453'); // Base mainnet default

      // Check for market-type specific env var first, then fall back to SDK defaults
      const contractAddress = config.marketType === MarketType.NEGRISK
        ? (process.env.NEGRISK_CONTRACT_ADDRESS || getContractAddress('NEGRISK', chainId))
        : (process.env.CLOB_CONTRACT_ADDRESS || getContractAddress('CLOB', chainId));

      this.signingConfig = {
        chainId,
        contractAddress,
        marketType: config.marketType,
      };

      this.logger.info('Auto-configured signing', {
        chainId,
        contractAddress,
        marketType: config.marketType,
      });
    } else {
      // Default to CLOB if neither provided
      const chainId = parseInt(process.env.CHAIN_ID || '8453');
      const contractAddress = process.env.CLOB_CONTRACT_ADDRESS ||
        getContractAddress('CLOB', chainId);

      this.signingConfig = {
        chainId,
        contractAddress,
        marketType: MarketType.CLOB,
      };

      this.logger.debug('Using default CLOB configuration', {
        chainId,
        contractAddress,
      });
    }
  }

  /**
   * Creates and submits a new order.
   *
   * @remarks
   * This method handles the complete order creation flow:
   * 1. Build unsigned order
   * 2. Sign with EIP-712
   * 3. Submit to API
   *
   * @param params - Order parameters
   * @returns Promise resolving to order response
   *
   * @throws Error if order creation fails
   *
   * @example
   * ```typescript
   * const order = await orderClient.createOrder({
   *   tokenId: '123456',
   *   price: 0.65,
   *   size: 100,
   *   side: Side.BUY,
   *   orderType: OrderType.GTC,
   *   marketSlug: 'market-slug'
   * });
   *
   * console.log(`Order created: ${order.order.id}`);
   * ```
   */
  async createOrder(
    params: OrderArgs & {
      orderType: OrderType;
      marketSlug: string;
    }
  ): Promise<OrderResponse> {
    this.logger.info('Creating order', {
      side: params.side,
      orderType: params.orderType,
      marketSlug: params.marketSlug,
    });

    // Step 1: Build unsigned order
    const unsignedOrder = this.orderBuilder.buildOrder(params);

    this.logger.debug('Built unsigned order', {
      salt: unsignedOrder.salt,
      makerAmount: unsignedOrder.makerAmount,
      takerAmount: unsignedOrder.takerAmount,
    });

    // Step 2: Sign order with EIP-712
    const signature = await this.orderSigner.signOrder(
      unsignedOrder,
      this.signingConfig
    );

    // Step 3: Prepare payload for API
    const payload: NewOrderPayload = {
      order: {
        ...unsignedOrder,
        signature,
      },
      orderType: params.orderType,
      marketSlug: params.marketSlug,
      ownerId: this.ownerId,
    };

    // Step 4: Submit to API
    this.logger.debug('Submitting order to API');
    console.log('[OrderClient] Full API request payload:', JSON.stringify(payload, null, 2));
    const apiResponse = await this.httpClient.post<any>(
      '/orders',
      payload
    );

    this.logger.info('Order created successfully', {
      orderId: apiResponse.order.id,
    });

    // Step 5: Transform API response to clean DTO
    return this.transformOrderResponse(apiResponse);
  }

  /**
   * Transforms raw API response to clean OrderResponse DTO.
   *
   * @param apiResponse - Raw API response with nested objects
   * @returns Clean OrderResponse with only essential fields
   *
   * @internal
   */
  private transformOrderResponse(apiResponse: any): OrderResponse {
    const cleanOrder: OrderResponse = {
      order: {
        id: apiResponse.order.id,
        createdAt: apiResponse.order.createdAt,
        makerAmount: apiResponse.order.makerAmount,
        takerAmount: apiResponse.order.takerAmount,
        expiration: apiResponse.order.expiration,
        signatureType: apiResponse.order.signatureType,
        salt: apiResponse.order.salt,
        maker: apiResponse.order.maker,
        signer: apiResponse.order.signer,
        taker: apiResponse.order.taker,
        tokenId: apiResponse.order.tokenId,
        side: apiResponse.order.side,
        feeRateBps: apiResponse.order.feeRateBps,
        nonce: apiResponse.order.nonce,
        signature: apiResponse.order.signature,
        orderType: apiResponse.order.orderType,
        price: apiResponse.order.price,
        marketId: apiResponse.order.marketId,
      },
    };

    // Add maker matches if present (FOK or partial GTC fills)
    if (apiResponse.makerMatches && apiResponse.makerMatches.length > 0) {
      cleanOrder.makerMatches = apiResponse.makerMatches.map((match: any) => ({
        id: match.id,
        createdAt: match.createdAt,
        matchedSize: match.matchedSize,
        orderId: match.orderId,
      }));
    }

    return cleanOrder;
  }

  /**
   * Cancels an existing order by ID.
   *
   * @param orderId - Order ID to cancel
   * @returns Promise resolving to cancellation message
   *
   * @throws Error if cancellation fails
   *
   * @example
   * ```typescript
   * const result = await orderClient.cancel('order-id-123');
   * console.log(result.message); // "Order canceled successfully"
   * ```
   */
  async cancel(orderId: string): Promise<{ message: string }> {
    this.logger.info('Cancelling order', { orderId });

    const response = await this.httpClient.delete<{ message: string }>(
      `/orders/${orderId}`
    );

    this.logger.info('Order cancellation response', {
      orderId,
      message: response.message
    });

    return response;
  }

  /**
   * Cancels all orders for a specific market.
   *
   * @param marketSlug - Market slug to cancel all orders for
   * @returns Promise resolving to cancellation message
   *
   * @throws Error if cancellation fails
   *
   * @example
   * ```typescript
   * const result = await orderClient.cancelAll('market-slug-123');
   * console.log(result.message); // "Orders canceled successfully"
   * ```
   */
  async cancelAll(marketSlug: string): Promise<{ message: string }> {
    this.logger.info('Cancelling all orders for market', { marketSlug });

    const response = await this.httpClient.delete<{ message: string }>(
      `/orders/all/${marketSlug}`
    );

    this.logger.info('All orders cancellation response', {
      marketSlug,
      message: response.message
    });

    return response;
  }

  /**
   * @deprecated Use `cancel()` instead
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.cancel(orderId);
  }

  /**
   * Gets an order by ID.
   *
   * @param orderId - Order ID to fetch
   * @returns Promise resolving to order details
   *
   * @throws Error if order not found
   *
   * @example
   * ```typescript
   * const order = await orderClient.getOrder('order-id-123');
   * console.log(order.order.side);
   * ```
   */
  async getOrder(orderId: string): Promise<OrderResponse> {
    this.logger.debug('Fetching order', { orderId });

    const response = await this.httpClient.get<OrderResponse>(
      `/orders/${orderId}`
    );

    return response;
  }

  /**
   * Builds an unsigned order without submitting.
   *
   * @remarks
   * Useful for advanced use cases where you need the unsigned order
   * before signing and submission.
   *
   * @param params - Order parameters
   * @returns Unsigned order
   *
   * @example
   * ```typescript
   * const unsignedOrder = orderClient.buildUnsignedOrder({
   *   tokenId: '123456',
   *   price: 0.65,
   *   size: 100,
   *   side: Side.BUY
   * });
   * ```
   */
  buildUnsignedOrder(params: OrderArgs): UnsignedOrder {
    return this.orderBuilder.buildOrder(params);
  }

  /**
   * Signs an unsigned order without submitting.
   *
   * @remarks
   * Useful for advanced use cases where you need to inspect
   * the signature before submission.
   *
   * @param order - Unsigned order to sign
   * @returns Promise resolving to signature
   *
   * @example
   * ```typescript
   * const signature = await orderClient.signOrder(unsignedOrder);
   * ```
   */
  async signOrder(order: UnsignedOrder): Promise<string> {
    return await this.orderSigner.signOrder(order, this.signingConfig);
  }
}
