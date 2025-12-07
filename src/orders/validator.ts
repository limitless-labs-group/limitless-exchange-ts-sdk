/**
 * Order validation utilities.
 * @module orders/validator
 */

import { ethers } from 'ethers';
import type {
  OrderArgs,
  UnsignedOrder,
  SignedOrder,
  FOKOrderArgs,
  GTCOrderArgs,
} from '../types/orders';

/**
 * Validation error class.
 * @public
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Type guard to check if order arguments are for FOK order.
 */
function isFOKOrder(args: OrderArgs): args is FOKOrderArgs {
  return 'amount' in args;
}

/**
 * Validates order arguments before building.
 *
 * @param args - Order arguments to validate (FOK or GTC)
 * @throws ValidationError if validation fails
 *
 * @public
 *
 * @example
 * ```typescript
 * try {
 *   validateOrderArgs(orderArgs);
 * } catch (error) {
 *   console.error('Validation failed:', error.message);
 * }
 * ```
 */
export function validateOrderArgs(args: OrderArgs): void {
  // Validate tokenId
  if (!args.tokenId) {
    throw new ValidationError('TokenId is required');
  }

  if (args.tokenId === '0') {
    throw new ValidationError('TokenId cannot be zero');
  }

  // Validate tokenId format (should be numeric string)
  if (!/^\d+$/.test(args.tokenId)) {
    throw new ValidationError(`Invalid tokenId format: ${args.tokenId}`);
  }

  // Validate taker address if provided
  if (args.taker && !ethers.isAddress(args.taker)) {
    throw new ValidationError(`Invalid taker address: ${args.taker}`);
  }

  // Validate expiration if provided
  if (args.expiration !== undefined) {
    if (!/^\d+$/.test(args.expiration)) {
      throw new ValidationError(`Invalid expiration format: ${args.expiration}`);
    }
  }

  // Validate nonce if provided
  if (args.nonce !== undefined) {
    if (!Number.isInteger(args.nonce) || args.nonce < 0) {
      throw new ValidationError(`Invalid nonce: ${args.nonce}`);
    }
  }

  // Type-specific validation
  if (isFOKOrder(args)) {
    // FOK order validation
    if (typeof args.makerAmount !== 'number' || isNaN(args.makerAmount)) {
      throw new ValidationError('Amount must be a valid number');
    }

    if (args.makerAmount <= 0) {
      throw new ValidationError(`Amount must be positive, got: ${args.makerAmount}`);
    }

    // Validate max 2 decimal places
    // Convert to string and check decimal places
    const amountStr = args.makerAmount.toString();
    const decimalIndex = amountStr.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPlaces = amountStr.length - decimalIndex - 1;
      if (decimalPlaces > 2) {
        throw new ValidationError(
          `Amount must have max 2 decimal places, got: ${args.makerAmount} (${decimalPlaces} decimals)`
        );
      }
    }
  } else {
    // GTC order validation
    if (typeof args.price !== 'number' || isNaN(args.price)) {
      throw new ValidationError('Price must be a valid number');
    }

    if (args.price < 0 || args.price > 1) {
      throw new ValidationError(`Price must be between 0 and 1, got: ${args.price}`);
    }

    if (typeof args.size !== 'number' || isNaN(args.size)) {
      throw new ValidationError('Size must be a valid number');
    }

    if (args.size <= 0) {
      throw new ValidationError(`Size must be positive, got: ${args.size}`);
    }
  }
}

/**
 * Validates an unsigned order.
 *
 * @param order - Unsigned order to validate
 * @throws ValidationError if validation fails
 *
 * @public
 *
 * @example
 * ```typescript
 * validateUnsignedOrder(unsignedOrder);
 * ```
 */
export function validateUnsignedOrder(order: UnsignedOrder): void {
  // Validate addresses
  if (!ethers.isAddress(order.maker)) {
    throw new ValidationError(`Invalid maker address: ${order.maker}`);
  }

  if (!ethers.isAddress(order.signer)) {
    throw new ValidationError(`Invalid signer address: ${order.signer}`);
  }

  if (!ethers.isAddress(order.taker)) {
    throw new ValidationError(`Invalid taker address: ${order.taker}`);
  }

  // Validate amounts
  if (!order.makerAmount || order.makerAmount === 0) {
    throw new ValidationError('MakerAmount must be greater than zero');
  }

  if (!order.takerAmount || order.takerAmount === 0) {
    throw new ValidationError('TakerAmount must be greater than zero');
  }

  // Validate amounts are positive numbers
  if (typeof order.makerAmount !== 'number' || order.makerAmount <= 0) {
    throw new ValidationError(`Invalid makerAmount: ${order.makerAmount}`);
  }

  if (typeof order.takerAmount !== 'number' || order.takerAmount <= 0) {
    throw new ValidationError(`Invalid takerAmount: ${order.takerAmount}`);
  }

  if (!/^\d+$/.test(order.tokenId)) {
    throw new ValidationError(`Invalid tokenId format: ${order.tokenId}`);
  }

  if (!/^\d+$/.test(order.expiration)) {
    throw new ValidationError(`Invalid expiration format: ${order.expiration}`);
  }

  // Validate salt
  if (!Number.isInteger(order.salt) || order.salt <= 0) {
    throw new ValidationError(`Invalid salt: ${order.salt}`);
  }

  // Validate nonce
  if (!Number.isInteger(order.nonce) || order.nonce < 0) {
    throw new ValidationError(`Invalid nonce: ${order.nonce}`);
  }

  // Validate feeRateBps
  if (!Number.isInteger(order.feeRateBps) || order.feeRateBps < 0) {
    throw new ValidationError(`Invalid feeRateBps: ${order.feeRateBps}`);
  }

  // Validate side (0 or 1)
  if (order.side !== 0 && order.side !== 1) {
    throw new ValidationError(`Invalid side: ${order.side}. Must be 0 (BUY) or 1 (SELL)`);
  }

  // Validate signatureType
  if (!Number.isInteger(order.signatureType) || order.signatureType < 0) {
    throw new ValidationError(`Invalid signatureType: ${order.signatureType}`);
  }

  // Validate price if present (for GTC orders)
  if (order.price !== undefined) {
    if (typeof order.price !== 'number' || isNaN(order.price)) {
      throw new ValidationError('Price must be a valid number');
    }

    if (order.price < 0 || order.price > 1) {
      throw new ValidationError(`Price must be between 0 and 1, got: ${order.price}`);
    }
  }
}

/**
 * Validates a signed order.
 *
 * @param order - Signed order to validate
 * @throws ValidationError if validation fails
 *
 * @public
 *
 * @example
 * ```typescript
 * validateSignedOrder(signedOrder);
 * ```
 */
export function validateSignedOrder(order: SignedOrder): void {
  // Validate unsigned order fields first
  validateUnsignedOrder(order);

  // Validate signature
  if (!order.signature) {
    throw new ValidationError('Signature is required');
  }

  if (!order.signature.startsWith('0x')) {
    throw new ValidationError('Signature must start with 0x');
  }

  // Signature should be 132 characters (0x + 130 hex chars for 65 bytes)
  if (order.signature.length !== 132) {
    throw new ValidationError(
      `Invalid signature length: ${order.signature.length}. Expected 132 characters.`
    );
  }

  // Validate hex format
  if (!/^0x[0-9a-fA-F]{130}$/.test(order.signature)) {
    throw new ValidationError('Signature must be valid hex string');
  }
}
