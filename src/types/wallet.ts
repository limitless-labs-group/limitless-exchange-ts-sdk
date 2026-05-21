/**
 * Wallet-like signing interface for SDK consumers.
 *
 * @module types/wallet
 *
 * @remarks
 * This interface decouples the SDK's public API from a concrete ethers
 * version or bundle (ESM vs CJS). ethers v6 ships dual ESM/CJS builds
 * whose `Wallet` types are not nominally equal due to private-field
 * brands, which makes any cross-resolution use of `ethers.Wallet` in a
 * library's public API a source of confusing type errors for consumers
 * (`Type 'Wallet' is not assignable to type 'Wallet'. Property '#private'
 * refers to a different member`).
 *
 * The SDK only needs three things from a wallet:
 *   - `address` (synchronous accessor)
 *   - `getAddress()` (async accessor — required for parity with ethers' v6 API)
 *   - `signTypedData(domain, types, value)` for EIP-712 signing
 *
 * Any object that structurally satisfies this interface — an `ethers.Wallet`
 * (either bundle), a custom signer, an HSM-backed wrapper, etc. — can be
 * passed wherever the SDK expects a wallet.
 */

/**
 * EIP-712 typed-data domain object.
 *
 * @remarks
 * Subset of fields used by Limitless. Same shape as ethers' `TypedDataDomain`,
 * declared here to avoid pulling in the ethers type and reintroducing the
 * dual-package nominal-type problem this interface exists to solve.
 *
 * @public
 */
export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number | bigint | string;
  verifyingContract?: string;
  salt?: string;
}

/**
 * EIP-712 typed-data field definition.
 *
 * @public
 */
export interface TypedDataField {
  name: string;
  type: string;
}

/**
 * Structural signing interface the SDK consumes.
 *
 * @remarks
 * `ethers.Wallet` is the canonical implementation and remains a fully
 * supported input — it satisfies this interface structurally. Custom
 * signers (e.g. wrappers around HSM, KMS, viem accounts, or thin remote
 * RPCs) can also be passed as long as they implement these three
 * members.
 *
 * @example
 * ```typescript
 * import { ethers } from 'ethers';
 * import type { EthersLikeWallet } from '@limitless-exchange/sdk';
 *
 * // 1. Direct ethers usage — works out of the box.
 * const wallet: EthersLikeWallet = new ethers.Wallet(privateKey);
 *
 * // 2. A custom signer that satisfies the interface.
 * const remoteSigner: EthersLikeWallet = {
 *   address: '0x...',
 *   getAddress: async () => '0x...',
 *   signTypedData: async (domain, types, value) => callRemoteHSM(domain, types, value),
 * };
 * ```
 *
 * @public
 */
export interface EthersLikeWallet {
  /** Address property — synchronous accessor used by the SDK for logging and pre-flight checks. */
  readonly address: string;
  /** Async accessor used by the SDK's order signer to verify the signer address before signing. */
  getAddress(): Promise<string>;
  /** EIP-712 typed-data signing. Must produce a `0x`-prefixed 65-byte hex signature. */
  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, ReadonlyArray<TypedDataField>>,
    value: Record<string, unknown>,
  ): Promise<string>;
}
