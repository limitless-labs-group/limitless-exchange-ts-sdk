/**
 * EIP-712 order signer for Limitless Exchange.
 * @module orders/signer
 */

import { ethers } from 'ethers';
import type { UnsignedOrder, OrderSigningConfig } from '../types/orders';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

/**
 * EIP-712 typed data field definition.
 */
interface TypedDataField {
  name: string;
  type: string;
}

/**
 * EIP-712 order signer.
 *
 * @remarks
 * This class handles EIP-712 signing for Limitless Exchange orders.
 * It creates signatures that match the API's verification requirements.
 *
 * Domain: "Limitless CTF Exchange"
 * Version: "1"
 *
 * @public
 */
export class OrderSigner {
  private wallet: ethers.Wallet;
  private logger: ILogger;

  /**
   * Creates a new order signer instance.
   *
   * @param wallet - Ethers wallet for signing
   * @param logger - Optional logger for debugging (default: no logging)
   *
   * @example
   * ```typescript
   * import { ethers } from 'ethers';
   * import { OrderSigner } from '@limitless-exchange/sdk';
   *
   * const wallet = new ethers.Wallet(privateKey);
   * const signer = new OrderSigner(wallet);
   * ```
   */
  constructor(wallet: ethers.Wallet, logger?: ILogger) {
    this.wallet = wallet;
    this.logger = logger || new NoOpLogger();
  }

  /**
   * Signs an order with EIP-712.
   *
   * @param order - Unsigned order to sign
   * @param config - Signing configuration (chainId, contract address, market type)
   * @returns Promise resolving to EIP-712 signature
   *
   * @throws Error if wallet address doesn't match order signer
   * @throws Error if signing fails
   *
   * @example
   * ```typescript
   * const signature = await signer.signOrder(unsignedOrder, {
   *   chainId: 8453,
   *   contractAddress: '0x...'
   * });
   * ```
   */
  async signOrder(order: UnsignedOrder, config: OrderSigningConfig): Promise<string> {
    this.logger.debug('Signing order with EIP-712', {
      tokenId: order.tokenId,
      side: order.side,
      verifyingContract: config.contractAddress,
    });

    // Verify wallet address matches signer
    const walletAddress = await this.wallet.getAddress();
    if (walletAddress.toLowerCase() !== order.signer.toLowerCase()) {
      const error = `Wallet address mismatch! Signing with: ${walletAddress}, but order signer is: ${order.signer}`;
      this.logger.error(error);
      throw new Error(error);
    }

    // Get EIP-712 domain
    const domain = this.getDomain(config);
    this.logger.debug('EIP-712 Domain', domain);

    // Get EIP-712 types
    const types = this.getTypes();

    // Prepare order value for signing (exclude price field)
    const orderValue = {
      salt: order.salt,
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      side: order.side,
      signatureType: order.signatureType,
    };

    this.logger.debug('EIP-712 Order Value', orderValue);
    this.logger.debug('Full signing payload', {
      domain,
      types: this.getTypes(),
      value: orderValue,
    });
    try {
      // Sign with EIP-712
      const signature = await this.wallet.signTypedData(domain, types, orderValue);
      this.logger.info('Successfully generated EIP-712 signature', {
        signature: signature.slice(0, 10) + '...',
      });
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign order', error as Error);
      throw error;
    }
  }

  /**
   * Gets the EIP-712 domain for signing.
   *
   * @param config - Signing configuration
   * @returns EIP-712 domain object
   *
   * @internal
   */
  private getDomain(config: OrderSigningConfig): {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  } {
    return {
      name: 'Limitless CTF Exchange',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.contractAddress,
    };
  }

  /**
   * Gets the EIP-712 type definitions.
   *
   * @remarks
   * This matches the order structure expected by the Limitless Exchange
   * smart contracts.
   *
   * @returns EIP-712 types definition
   *
   * @internal
   */
  private getTypes(): Record<string, TypedDataField[]> {
    return {
      Order: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'expiration', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'signatureType', type: 'uint8' },
      ],
    };
  }
}
