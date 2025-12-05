/**
 * Order builder for constructing unsigned order payloads.
 * @module orders/builder
 */

import { ethers } from 'ethers';
import {
  OrderArgs,
  UnsignedOrder,
  Side,
  MarketType,
  SignatureType,
} from '../types/orders';

/**
 * Zero address constant for any-taker orders.
 */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Default price tick size (0.001 = 3 decimal places).
 * This is the minimum price increment allowed by the exchange.
 */
const DEFAULT_PRICE_TICK = 0.001;

/**
 * Order builder for constructing unsigned order payloads.
 *
 * @remarks
 * This class handles the construction of unsigned orders matching the
 * Limitless Exchange API format. It generates unique salts, calculates
 * maker/taker amounts with proper tick alignment, and validates inputs.
 *
 * **Tick Alignment Requirements**:
 * - Prices must align to tick size (default: 0.001 = 3 decimals)
 * - Size must produce takerAmount divisible by sharesStep (priceScale / tickInt = 1000 for 0.001 tick)
 * - SDK validates inputs and throws clear errors rather than auto-rounding
 * - This ensures `price * contracts` yields whole number collateral
 *
 * **Validation Strategy**:
 * - FAILS FAST: Invalid inputs throw errors with helpful suggestions
 * - NO AUTO-ROUNDING: Users maintain full control over order amounts
 * - TRANSPARENCY: Error messages show valid alternatives
 * - Example: size=22.123896 → Error: "Try 22.123 (rounded down) or 22.124 (rounded up) instead"
 *
 * @public
 */
export class OrderBuilder {
  private makerAddress: string;
  private feeRateBps: number;
  private priceTick: number;

  /**
   * Creates a new order builder instance.
   *
   * @param makerAddress - Ethereum address of the order maker
   * @param feeRateBps - Fee rate in basis points (e.g., 100 = 1%)
   * @param priceTick - Price tick size (default: 0.001 for 3 decimals)
   *
   * @example
   * ```typescript
   * const builder = new OrderBuilder(
   *   '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
   *   100, // 1% fee
   *   0.001 // 3 decimal price precision
   * );
   * ```
   */
  constructor(makerAddress: string, feeRateBps: number, priceTick: number = DEFAULT_PRICE_TICK) {
    this.makerAddress = makerAddress;
    this.feeRateBps = feeRateBps;
    this.priceTick = priceTick;
  }

  /**
   * Builds an unsigned order payload.
   *
   * @param args - Order arguments (FOK or GTC)
   * @returns Unsigned order ready for signing
   *
   * @throws Error if validation fails or tick alignment fails
   *
   * @example
   * ```typescript
   * // FOK order (amount-based)
   * const fokOrder = builder.buildOrder({
   *   tokenId: '123456',
   *   amount: 1000000,  // 1 USDC
   *   side: Side.BUY,
   *   marketType: MarketType.CLOB
   * });
   *
   * // GTC order (price + size)
   * const gtcOrder = builder.buildOrder({
   *   tokenId: '123456',
   *   price: 0.38,
   *   size: 22.123,  // Will be rounded to tick-aligned: 22.123 shares
   *   side: Side.BUY,
   *   marketType: MarketType.CLOB
   * });
   * ```
   */
  buildOrder(args: OrderArgs): UnsignedOrder {
    // Validate inputs
    this.validateOrderArgs(args);

    // Calculate amounts based on order type
    const { makerAmount, takerAmount, price } = this.isFOKOrder(args)
      ? this.calculateFOKAmounts(args.amount, args.side)
      : this.calculateGTCAmountsTickAligned(args.price, args.size, args.side);

    // Build unsigned order
    const order: UnsignedOrder = {
      salt: this.generateSalt(),
      maker: this.makerAddress,
      signer: this.makerAddress,
      taker: args.taker || ZERO_ADDRESS,
      tokenId: args.tokenId,
      makerAmount: makerAmount,
      takerAmount: takerAmount,
      expiration: args.expiration || '0',
      nonce: args.nonce || 0,
      feeRateBps: this.feeRateBps,
      side: args.side,
      signatureType: SignatureType.EOA,
    };

    // Add price for GTC orders (required by API)
    if (price !== undefined) {
      order.price = price;
    }

    return order;
  }

  /**
   * Type guard to check if order arguments are for FOK order.
   *
   * @param args - Order arguments
   * @returns True if FOK order arguments
   *
   * @internal
   */
  private isFOKOrder(args: OrderArgs): args is import('../types/orders').FOKOrderArgs {
    return 'amount' in args;
  }

  /**
   * Generates a unique salt using timestamp + nano-offset pattern.
   *
   * @remarks
   * This follows the reference implementation pattern:
   * salt = timestamp * 1000 + nanoOffset + 24h
   *
   * This ensures uniqueness even when creating orders rapidly.
   *
   * @returns Unique salt value
   *
   * @internal
   */
  private generateSalt(): number {
    // Use millisecond timestamp
    const timestamp = Date.now();

    // Use performance.now() for sub-millisecond precision
    const nanoOffset = Math.floor(performance.now() * 1000) % 1000000;

    // Add 24 hours in milliseconds to ensure future timestamp
    const oneDayMs = 1000 * 60 * 60 * 24;

    return timestamp * 1000 + nanoOffset + oneDayMs;
  }

  /**
   * Parses decimal string to scaled BigInt.
   *
   * @param value - Decimal string (e.g., "0.38")
   * @param scale - Scale factor (e.g., 1_000_000n for 6 decimals)
   * @returns Scaled BigInt value
   *
   * @internal
   */
  private parseDecToInt(value: string, scale: bigint): bigint {
    const s = value.trim();
    const [intPart, fracPart = ''] = s.split('.');
    const decimals = scale.toString().length - 1;
    const frac = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
    const sign = intPart.startsWith('-') ? -1n : 1n;
    const intPartAbs = intPart.replace('-', '');
    return sign * (BigInt(intPartAbs || '0') * scale + BigInt(frac || '0'));
  }

  /**
   * Ceiling division for BigInt.
   *
   * @param numerator - Numerator
   * @param denominator - Denominator
   * @returns Ceiling of numerator / denominator
   *
   * @internal
   */
  private divCeil(numerator: bigint, denominator: bigint): bigint {
    if (denominator === 0n) {
      throw new Error('Division by zero');
    }
    return (numerator + denominator - 1n) / denominator;
  }

  /**
   * Calculates maker and taker amounts for GTC orders with tick alignment validation.
   *
   * @remarks
   * Validates and calculates amounts to ensure:
   * 1. Price aligns to tick size (e.g., 0.001 for 3 decimals)
   * 2. Size produces takerAmount divisible by sharesStep
   * 3. No auto-rounding - fails fast if values are invalid
   * 4. Transparent error messages guide users to valid values
   *
   * **Algorithm**:
   * - sharesStep = priceScale / tickInt (e.g., 1000 for 0.001 tick)
   * - Validates shares are divisible by sharesStep
   * - Calculates collateral from shares × price (ceil for BUY, floor for SELL)
   * - Assigns maker/taker based on side:
   *   - BUY: maker = collateral, taker = shares
   *   - SELL: maker = shares, taker = collateral
   * - Throws clear error if size is not tick-aligned
   *
   * @param price - Price per share (0.0 to 1.0, max 3 decimals)
   * @param size - Number of shares (must be tick-aligned)
   * @param side - Order side (BUY or SELL)
   * @returns Object with validated makerAmount, takerAmount, and price
   *
   * @throws Error if price or size not tick-aligned
   *
   * @internal
   */
  private calculateGTCAmountsTickAligned(
    price: number,
    size: number,
    side: Side
  ): { makerAmount: number; takerAmount: number; price: number } {
    const sharesScale = 1_000_000n;
    const collateralScale = 1_000_000n;
    const priceScale = 1_000_000n;

    // Parse inputs to BigInt with proper scaling
    const shares = this.parseDecToInt(size.toString(), sharesScale);
    const priceInt = this.parseDecToInt(price.toString(), priceScale);
    const tickInt = this.parseDecToInt(this.priceTick.toString(), priceScale);

    // Validate tick and price
    if (tickInt <= 0n) {
      throw new Error(`Invalid priceTick: ${this.priceTick}`);
    }
    if (priceInt <= 0n) {
      throw new Error(`Invalid price: ${price}`);
    }

    // Validate price is tick-aligned
    if (priceInt % tickInt !== 0n) {
      throw new Error(
        `Price ${price} is not tick-aligned. Must be multiple of ${this.priceTick} (e.g., 0.380, 0.381, etc.)`
      );
    }

    // Calculate shares step (shares must be divisible by this)
    // For priceTick=0.001: sharesStep = 1_000_000 / 1_000 = 1_000
    const sharesStep = priceScale / tickInt;

    // Validate size produces tick-aligned shares (NO AUTO-ROUNDING)
    if (shares % sharesStep !== 0n) {
      // Calculate valid size that would work
      const validSizeDown = Number((shares / sharesStep) * sharesStep) / 1e6;
      const validSizeUp = Number(this.divCeil(shares, sharesStep) * sharesStep) / 1e6;

      throw new Error(
        `Invalid size: ${size}. Size must produce contracts divisible by ${sharesStep} (sharesStep). ` +
        `Try ${validSizeDown} (rounded down) or ${validSizeUp} (rounded up) instead.`
      );
    }

    // Calculate collateral: (shares * price * collateralScale) / (sharesScale * priceScale)
    const numerator = shares * priceInt * collateralScale;
    const denominator = sharesScale * priceScale;

    const collateral = side === Side.BUY
      ? this.divCeil(numerator, denominator)  // BUY: Round UP (maker pays more)
      : numerator / denominator;               // SELL: Round DOWN (maker receives less)

    // Assign maker/taker amounts based on side
    let makerAmount: bigint;
    let takerAmount: bigint;

    if (side === Side.BUY) {
      // BUY: maker provides collateral, taker provides shares
      makerAmount = collateral;
      takerAmount = shares;
    } else {
      // SELL: maker provides shares, taker provides collateral
      makerAmount = shares;
      takerAmount = collateral;
    }

    return {
      makerAmount: Number(makerAmount),
      takerAmount: Number(takerAmount),
      price,
    };
  }

  /**
   * Calculates maker and taker amounts for FOK (market) orders.
   *
   * @remarks
   * FOK orders use amount-based calculation:
   * - makerAmount = USDC amount (in collateral units, 6 decimals)
   * - takerAmount = always 1 (constant for FOK orders)
   *
   * The amount is provided in human-readable USDC (e.g., 1.5 for 1.5 USDC)
   * and converted to collateral units (6 decimals). Supports up to 6 decimal
   * places for precise amount control.
   *
   * @param usdcAmount - Amount in human-readable USDC (e.g., 1.5, 1.216667)
   * @param side - Order side (BUY or SELL)
   * @returns Object with makerAmount, takerAmount (always 1), and undefined price
   *
   * @internal
   */
  private calculateFOKAmounts(
    usdcAmount: number,
    side: Side
  ): { makerAmount: number; takerAmount: number; price: undefined } {
    // Convert USDC to collateral units (6 decimals)
    // Example: 1.5 USDC → 1500000 collateral units
    // Example: 1.216667 USDC → 1216667 collateral units
    const USDC_DECIMALS = 6;

    // Validate amount has max 6 decimal places (USDC precision limit)
    const amountStr = usdcAmount.toString();
    const decimalIndex = amountStr.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPlaces = amountStr.length - decimalIndex - 1;
      if (decimalPlaces > USDC_DECIMALS) {
        throw new Error(
          `Invalid amount: ${usdcAmount}. Amount can have max ${USDC_DECIMALS} decimal places (USDC precision). ` +
          `Try ${usdcAmount.toFixed(USDC_DECIMALS)} instead.`
        );
      }
    }

    // Convert to string with sufficient precision to preserve all decimals
    const amountFormatted = usdcAmount.toFixed(USDC_DECIMALS);
    const amountScaled = ethers.parseUnits(amountFormatted, USDC_DECIMALS);
    const collateralAmount = Number(amountScaled);

    // FOK orders: makerAmount = collateral, takerAmount = always 1
    return {
      makerAmount: collateralAmount,
      takerAmount: 1,
      price: undefined,
    };
  }

  /**
   * Validates order arguments.
   *
   * @param args - Order arguments to validate
   * @throws Error if validation fails
   *
   * @internal
   */
  private validateOrderArgs(args: OrderArgs): void {
    // Validate tokenId
    if (!args.tokenId || args.tokenId === '0') {
      throw new Error('Invalid tokenId: tokenId is required.');
    }

    // Validate taker address format if provided
    if (args.taker && !ethers.isAddress(args.taker)) {
      throw new Error(`Invalid taker address: ${args.taker}`);
    }

    // Type-specific validation
    if (this.isFOKOrder(args)) {
      // FOK order validation
      if (args.amount <= 0) {
        throw new Error(`Invalid amount: ${args.amount}. Amount must be positive.`);
      }
    } else {
      // GTC order validation
      if (args.price < 0 || args.price > 1) {
        throw new Error(`Invalid price: ${args.price}. Price must be between 0 and 1.`);
      }

      if (args.size <= 0) {
        throw new Error(`Invalid size: ${args.size}. Size must be positive.`);
      }

      // Validate price has max 3 decimals (tick alignment check)
      const priceStr = args.price.toString();
      const decimalIndex = priceStr.indexOf('.');
      if (decimalIndex !== -1) {
        const decimalPlaces = priceStr.length - decimalIndex - 1;
        if (decimalPlaces > 3) {
          throw new Error(
            `Invalid price: ${args.price}. Price must have max 3 decimal places (e.g., 0.380, 0.001).`
          );
        }
      }
    }
  }
}
