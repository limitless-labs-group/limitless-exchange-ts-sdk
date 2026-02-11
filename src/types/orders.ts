/**
 * Order-related types for Limitless Exchange.
 * @module types/orders
 */

/**
 * Order side enum.
 * @public
 */
export enum Side {
  BUY = 0,
  SELL = 1,
}

/**
 * Order type enum.
 * @public
 */
export enum OrderType {
  /** Fill-or-Kill: Execute immediately or cancel */
  FOK = 'FOK',
  /** Good-Til-Cancelled: Remain on orderbook until filled or cancelled */
  GTC = 'GTC',
}

/**
 * Signature type enum.
 * @public
 */
export enum SignatureType {
  /** Externally Owned Account */
  EOA = 0,
  /** Polymarket Proxy */
  POLY_PROXY = 1,
  /** Polymarket Gnosis Safe */
  POLY_GNOSIS_SAFE = 2,
}

/**
 * Base arguments shared by all order types.
 * @public
 */
export interface BaseOrderArgs {
  /**
   * Token ID for the outcome
   */
  tokenId: string;

  /**
   * Order side (BUY or SELL)
   */
  side: Side;

  /**
   * Expiration timestamp (0 for no expiration)
   * @defaultValue '0'
   */
  expiration?: string;

  /**
   * Nonce for order replay protection
   * @defaultValue 0
   */
  nonce?: number;

  /**
   * Taker address (ZERO_ADDRESS for any taker)
   * @defaultValue '0x0000000000000000000000000000000000000000'
   */
  taker?: string;
}

/**
 * Arguments for FOK (Fill-or-Kill) market orders.
 *
 * @remarks
 * FOK orders are market orders that execute immediately at the best available price.
 * Specify the maker amount (human-readable, max 6 decimals).
 *
 * For BUY orders: Amount in USDC to spend (e.g., 50.0 = spend $50 USDC)
 * For SELL orders: Number of shares to sell (e.g., 18.64 = sell 18.64 shares)
 *
 * @example
 * ```typescript
 * // BUY: Spend 50 USDC
 * {
 *   tokenId: '123...',
 *   makerAmount: 50,      // Spend $50 USDC
 *   side: Side.BUY
 * }
 *
 * // SELL: Sell 18.64 shares
 * {
 *   tokenId: '123...',
 *   makerAmount: 18.64,   // Sell 18.64 shares
 *   side: Side.SELL
 * }
 * ```
 *
 * @public
 */
export interface FOKOrderArgs extends BaseOrderArgs {
  /**
   * Maker amount (human-readable, max 6 decimals)
   *
   * For BUY orders: Amount of USDC to spend
   * For SELL orders: Number of shares to sell
   *
   * @example
   * // BUY examples
   * 50 = Spend $50 USDC
   * 1.5 = Spend $1.50 USDC
   * 0.75 = Spend $0.75 USDC
   *
   * // SELL examples
   * 18.64 = Sell 18.64 shares
   * 44.111 = Sell 44.111 shares
   */
  makerAmount: number;
}

/**
 * Arguments for GTC (Good-Til-Cancelled) limit orders.
 *
 * @remarks
 * GTC orders are limit orders that remain on the orderbook until filled or cancelled.
 * You specify the price and number of shares.
 *
 * @example
 * ```typescript
 * // BUY: Buy 10 shares at 0.65 price
 * {
 *   tokenId: '123...',
 *   price: 0.65,
 *   size: 10,
 *   side: Side.BUY
 * }
 *
 * // SELL: Sell 5 shares at 0.75 price
 * {
 *   tokenId: '123...',
 *   price: 0.75,
 *   size: 5,
 *   side: Side.SELL
 * }
 * ```
 *
 * @public
 */
export interface GTCOrderArgs extends BaseOrderArgs {
  /**
   * Price per share (0.0 to 1.0)
   */
  price: number;

  /**
   * Number of shares to trade
   */
  size: number;
}

/**
 * Union type for all order arguments.
 * @public
 */
export type OrderArgs = FOKOrderArgs | GTCOrderArgs;

/**
 * Unsigned order payload.
 * @public
 */
export interface UnsignedOrder {
  /**
   * Unique salt for order identification
   */
  salt: number;

  /**
   * Maker address (order creator)
   */
  maker: string;

  /**
   * Signer address (must match maker for EOA)
   */
  signer: string;

  /**
   * Taker address (ZERO_ADDRESS for any taker)
   */
  taker: string;

  /**
   * Token ID for the outcome
   */
  tokenId: string;

  /**
   * Maker amount in USDC units (6 decimals)
   */
  makerAmount: number;

  /**
   * Taker amount in USDC units (6 decimals)
   */
  takerAmount: number;

  /**
   * Expiration timestamp (0 for no expiration)
   */
  expiration: string;

  /**
   * Nonce for replay protection
   */
  nonce: number;

  /**
   * Fee rate in basis points
   */
  feeRateBps: number;

  /**
   * Order side (BUY or SELL)
   */
  side: Side;

  /**
   * Signature type (EOA, POLY_PROXY, etc.)
   */
  signatureType: SignatureType;

  /**
   * Price per share (required for GTC orders)
   */
  price?: number;
}

/**
 * Signed order payload.
 * @public
 */
export interface SignedOrder extends UnsignedOrder {
  /**
   * EIP-712 signature
   */
  signature: string;
}

/**
 * Complete order payload for API submission.
 * @public
 */
export interface NewOrderPayload {
  /**
   * Signed order details
   */
  order: SignedOrder;

  /**
   * Order type (FOK or GTC)
   */
  orderType: OrderType;

  /**
   * Market slug identifier
   */
  marketSlug: string;

  /**
   * Owner ID from user profile
   */
  ownerId: number;
}

/**
 * Clean order data returned from API.
 *
 * @remarks
 * This is a minimal, user-friendly representation of an order
 * that excludes unnecessary API metadata.
 *
 * @public
 */
export interface CreatedOrder {
  /**
   * Order database ID
   */
  id: string;

  /**
   * Creation timestamp (ISO 8601)
   */
  createdAt: string;

  /**
   * Maker amount (USDC units with 6 decimals)
   */
  makerAmount: number;

  /**
   * Taker amount (USDC units with 6 decimals)
   */
  takerAmount: number;

  /**
   * Expiration timestamp (null for no expiration)
   */
  expiration: string | null;

  /**
   * Signature type (0 = EOA, 1 = Polymarket Proxy, 2 = Gnosis Safe)
   */
  signatureType: number;

  /**
   * Unique salt for order identification
   */
  salt: number;

  /**
   * Maker address
   */
  maker: string;

  /**
   * Signer address
   */
  signer: string;

  /**
   * Taker address (zero address for any taker)
   */
  taker: string;

  /**
   * Token ID for the outcome
   */
  tokenId: string;

  /**
   * Order side (0 = BUY, 1 = SELL)
   */
  side: Side;

  /**
   * Fee rate in basis points
   */
  feeRateBps: number;

  /**
   * Nonce for replay protection
   */
  nonce: number;

  /**
   * EIP-712 signature
   */
  signature: string;

  /**
   * Order type (GTC or FOK)
   */
  orderType: string;

  /**
   * Price per share (0.0 to 1.0) - only for GTC orders
   */
  price: number | null;

  /**
   * Market database ID
   */
  marketId: number;
}

/**
 * Match information for filled orders.
 *
 * @remarks
 * When a FOK order is filled or a GTC order is partially matched,
 * this provides minimal information about the match.
 *
 * @public
 */
export interface OrderMatch {
  /**
   * Match database ID
   */
  id: string;

  /**
   * Creation timestamp (ISO 8601)
   */
  createdAt: string;

  /**
   * Matched size (USDC units with 6 decimals)
   */
  matchedSize: string;

  /**
   * Matched order ID
   */
  orderId: string;
}

/**
 * Clean order creation response.
 *
 * @remarks
 * This is what users receive after successfully creating an order.
 * For GTC orders, makerMatches will be undefined or empty.
 * For FOK orders, makerMatches contains the fills.
 *
 * @public
 */
export interface OrderResponse {
  /**
   * Created order data
   */
  order: CreatedOrder;

  /**
   * Matches if order was filled (FOK) or partially matched (GTC)
   */
  makerMatches?: OrderMatch[];
}

/**
 * Order signing configuration.
 * @public
 */
export interface OrderSigningConfig {
  /**
   * Blockchain chain ID
   */
  chainId: number;

  /**
   * Contract address for verification (from venue.exchange)
   */
  contractAddress: string;
}
