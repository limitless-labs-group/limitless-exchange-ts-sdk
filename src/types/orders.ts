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
  /** Fill-And-Kill: Limit-like order that fills what it can and kills the remainder */
  FAK = 'FAK',
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

  /**
   * When true, rejects the order if it would immediately match.
   * Supported only for GTC orders.
   * @defaultValue false
   */
  postOnly?: boolean;
}

/**
 * Arguments for FAK (Fill-And-Kill) limit orders.
 *
 * @remarks
 * FAK orders use the same price/size construction as GTC, but the unmatched
 * remainder is killed instead of resting on the orderbook. PostOnly is not
 * supported for FAK and is rejected by the API.
 *
 * @example
 * ```typescript
 * // BUY: Fill up to 10 shares at 0.55 price, kill remainder
 * {
 *   tokenId: '123...',
 *   price: 0.55,
 *   size: 10,
 *   side: Side.BUY
 * }
 * ```
 *
 * @public
 */
export interface FAKOrderArgs extends BaseOrderArgs {
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
export type OrderArgs = FOKOrderArgs | GTCOrderArgs | FAKOrderArgs;

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

  /**
   * When true, rejects the order if it would immediately match.
   * Supported only for GTC orders.
   */
  postOnly?: boolean;
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
   * Creation timestamp (ISO 8601), or null when the API omits the match timestamp
   */
  createdAt: string | null;

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
   *
   * @remarks
   * May be returned as a string when value exceeds JavaScript safe integer range.
   */
  salt: number | string;

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
   * Creation timestamp (ISO 8601), or null when the API omits the match timestamp
   */
  createdAt: string | null;

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
 * Raw integer-string totals for an order execution.
 *
 * @remarks
 * Every field is a decimal string holding a raw integer value (no scaling
 * applied). `contracts*` are share/contract amounts; `usd*` are USDC amounts.
 * Gross is the pre-fee total, fee is the fee taken, net is the post-fee total.
 *
 * @public
 */
export interface ExecutionTotalsRaw {
  /**
   * Fee taken in contracts, as a raw integer string
   */
  contractsFee: string;

  /**
   * Pre-fee contracts total, as a raw integer string
   */
  contractsGross: string;

  /**
   * Post-fee contracts total, as a raw integer string
   */
  contractsNet: string;

  /**
   * Fee taken in USDC, as a raw integer string
   */
  usdFee: string;

  /**
   * Pre-fee USDC total, as a raw integer string
   */
  usdGross: string;

  /**
   * Post-fee USDC total, as a raw integer string
   */
  usdNet: string;
}

/**
 * Execution outcome summary returned with the create-order response.
 *
 * @remarks
 * Carries the settlement/fee summary and the taker-delay outcome for the
 * submitted order. Always returned by the server; modeled optional on the
 * SDK response for back-compat safety.
 *
 * @public
 */
export interface Execution {
  /**
   * Echo of the caller-supplied client order id, when one was provided
   */
  clientOrderId?: string;

  /**
   * Effective fee actually applied, in integer basis points
   */
  effectiveFeeBps: number;

  /**
   * ISO-8601 timestamp at which the order is released to the matching engine.
   *
   * @remarks
   * Present only when `settlementStatus === 'DELAYED'` — this is the
   * taker-delay field. It is the moment the per-market taker delay expires
   * and the held order is forwarded to the matching engine.
   */
  eligibleAt?: string;

  /**
   * Fee rate ceiling for the order, in integer basis points
   */
  feeRateBps: number;

  /**
   * Whether the order matched against any resting liquidity
   */
  matched: boolean;

  reason?: string;

  stpMakerCancels?: string[];

  /**
   * Settlement state of the order.
   *
   * @remarks
   * Kept as a plain string (not a closed union) for forward compatibility:
   * the server adds new values over time, so a closed union would break on
   * unknown values. Known values at time of writing:
   * `'UNMATCHED' | 'MATCHED' | 'MINED' | 'CONFIRMED' | 'RETRYING' | 'FAILED' | 'DELAYED'`.
   * `'DELAYED'` means the taker order was accepted but is held by a
   * per-market taker delay before being released to the matching engine
   * (see `eligibleAt`).
   */
  settlementStatus: string;

  /**
   * Raw integer-string totals for the execution
   */
  totalsRaw: ExecutionTotalsRaw;

  /**
   * Trade event id associated with the execution, when one exists
   */
  tradeEventId?: string;

  /**
   * Settlement transaction hash, or null when not yet mined
   */
  txHash?: string | null;
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
   * Execution outcome summary (settlement status, fees, raw totals, and the
   * taker-delay `eligibleAt` for delayed markets).
   *
   * @remarks
   * Always returned by the server; optional here for back-compat safety.
   */
  execution?: Execution;

  /**
   * Matches if order was filled (FOK) or partially matched (GTC)
   */
  makerMatches?: OrderMatch[];

  /**
   * Created order data
   */
  order: CreatedOrder;
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

export enum CancelReplaceMode {
  ALLOW_FAILURE = 'ALLOW_FAILURE',
  STOP_ON_FAILURE = 'STOP_ON_FAILURE',
}

export type StpPolicy = 'cancel_maker' | 'cancel_taker' | 'cancel_both';

export type CancelReplaceTarget =
  | { orderId: string; clientOrderId?: never }
  | { clientOrderId: string; orderId?: never };

export interface CancelReplaceOrderSubmission extends Omit<SignedOrder, 'signatureType'> {
  signatureType: SignatureType | 3;
}

export interface CancelReplaceReplacementRequest {
  order: CancelReplaceOrderSubmission;
  orderType: OrderType;
  marketSlug: string;
  ownerId: number;
  postOnly?: boolean;
  clientOrderId?: string;
  timestamp?: number;
  recvWindow?: number;
  stpPolicy?: StpPolicy;
  onBehalfOf?: never;
}

export interface CancelReplaceRequest {
  cancel: CancelReplaceTarget;
  replacement: CancelReplaceReplacementRequest;
  mode: CancelReplaceMode;
  onBehalfOf?: number;
}

export interface CancelReplaceBatchRequest {
  operations: CancelReplaceRequest[];
}

export interface CancelReplaceError {
  code: string;
  message: string;
}

export type CancelReplaceCancelResult =
  | { status: 'SUCCESS'; orderId: string; clientOrderId?: string; error?: never }
  | {
      status: 'FAILURE' | 'UNKNOWN';
      error: CancelReplaceError;
      orderId?: never;
      clientOrderId?: never;
    };

export type CancelReplaceReplacementResult =
  | { status: 'SUCCESS'; data: OrderResponse & { execution: Execution }; error?: never }
  | { status: 'FAILURE' | 'UNKNOWN'; error: CancelReplaceError; data?: never }
  | { status: 'NOT_ATTEMPTED'; data?: never; error?: never };

export interface CancelReplaceResponse {
  cancel: CancelReplaceCancelResult;
  replacement: CancelReplaceReplacementResult;
}

export type CancelReplaceBatchResult = CancelReplaceResponse & { index: number };

export interface CancelReplaceBatchResponse {
  results: CancelReplaceBatchResult[];
}

export type CancelReplaceReplacementParams = OrderArgs & {
  orderType: OrderType;
  marketSlug: string;
  clientOrderId?: string;
  timestamp?: number;
  recvWindow?: number;
  stpPolicy?: StpPolicy;
  onBehalfOf?: never;
};

export interface CancelReplaceParams {
  cancel: CancelReplaceTarget;
  replacement: CancelReplaceReplacementParams;
  mode: CancelReplaceMode;
  onBehalfOf?: never;
}

export interface CancelReplaceBatchParams {
  operations: CancelReplaceParams[];
}
