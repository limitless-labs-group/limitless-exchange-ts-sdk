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
 * @public
 */
export interface WithdrawServerWalletParams {
  amount: string;
  onBehalfOf: number;
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
