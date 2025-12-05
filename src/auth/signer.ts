import { ethers } from 'ethers';
import type { SignatureHeaders } from '../types/auth';

/**
 * Message signer for authentication.
 *
 * @remarks
 * This class handles signing messages with an Ethereum wallet and
 * creating authentication headers required by the Limitless Exchange API.
 *
 * @public
 */
export class MessageSigner {
  private wallet: ethers.Wallet;

  /**
   * Creates a new message signer instance.
   *
   * @param wallet - Ethers wallet instance for signing
   */
  constructor(wallet: ethers.Wallet) {
    this.wallet = wallet;
  }

  /**
   * Creates authentication headers for API requests.
   *
   * @param signingMessage - Message to sign from the API
   * @returns Promise resolving to signature headers
   *
   * @example
   * ```typescript
   * const signer = new MessageSigner(wallet);
   * const headers = await signer.createAuthHeaders(message);
   * ```
   */
  async createAuthHeaders(signingMessage: string): Promise<SignatureHeaders> {
    const hexMessage = this.stringToHex(signingMessage);
    const signature = await this.wallet.signMessage(signingMessage);
    const address = this.wallet.address;

    const recoveredAddress = ethers.verifyMessage(signingMessage, signature);
    if (address.toLowerCase() !== recoveredAddress.toLowerCase()) {
      throw new Error('Signature verification failed: address mismatch');
    }

    return {
      'x-account': address,
      'x-signing-message': hexMessage,
      'x-signature': signature,
    };
  }

  /**
   * Signs EIP-712 typed data.
   *
   * @param domain - EIP-712 domain
   * @param types - EIP-712 types
   * @param value - Value to sign
   * @returns Promise resolving to signature string
   *
   * @example
   * ```typescript
   * const signature = await signer.signTypedData(domain, types, order);
   * ```
   */
  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    return await this.wallet.signTypedData(domain, types, value);
  }

  /**
   * Gets the wallet address.
   *
   * @returns Ethereum address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Converts a string to hex format.
   *
   * @param text - String to convert
   * @returns Hex string with 0x prefix
   * @internal
   */
  private stringToHex(text: string): string {
    return ethers.hexlify(ethers.toUtf8Bytes(text));
  }
}
