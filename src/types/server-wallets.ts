/**
 * Server-managed wallet operation types for delegated-signing partner flows.
 * @public
 */

/**
 * Redeem request parameters for a server-managed wallet.
 * @public
 */
export interface RedeemServerWalletParams {
  conditionId: string;
  onBehalfOf: number;
}

/**
 * Withdraw request parameters for a server-managed wallet.
 * Amount must be provided in the token's smallest unit.
 *
 * @remarks
 * `destination` is optional. When omitted, the API defaults to the authenticated
 * partner's smart wallet when present, otherwise the authenticated partner account.
 * Explicit destinations must be the authenticated partner account, authenticated
 * partner smart wallet, or an active withdrawal address allowlisted on the
 * authenticated partner profile.
 *
 * Set `onBehalfOf` to withdraw from a partner child profile's server wallet.
 * Omit `onBehalfOf` only for authenticated caller wallet withdrawals to an
 * explicit `destination`.
 *
 * @public
 */
export interface WithdrawServerWalletParams {
  amount: string;
  onBehalfOf?: number;
  token?: string;
  destination?: string;
}

/**
 * Common transaction metadata returned by server-wallet actions.
 * @public
 */
export interface ServerWalletTransactionEnvelope {
  hash: string;
  userOperationHash: string;
  transactionId: string;
  walletAddress: string;
}

/**
 * Response from POST /portfolio/redeem.
 * @public
 */
export interface RedeemServerWalletResponse extends ServerWalletTransactionEnvelope {
  conditionId: string;
  marketId: number;
}

/**
 * Response from POST /portfolio/withdraw.
 * @public
 */
export interface WithdrawServerWalletResponse extends ServerWalletTransactionEnvelope {
  token: string;
  destination: string;
  amount: string;
}
