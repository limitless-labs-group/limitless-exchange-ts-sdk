/**
 * Types for partner AMM trading (allowances, buy, sell).
 * @module types/amm
 */

/**
 * Allowance side for an AMM market approval.
 *
 * @remarks
 * `BUY` is a collateral ERC-20 approval for the market FPMM; `SELL` is the
 * Conditional Tokens operator approval. The value is case-sensitive on the wire.
 *
 * @public
 */
export type AmmAllowanceSide = 'BUY' | 'SELL';

/** @public */
export const AmmAllowanceSideBuy: AmmAllowanceSide = 'BUY';
/** @public */
export const AmmAllowanceSideSell: AmmAllowanceSide = 'SELL';

/**
 * Live allowance state returned by check/approve.
 *
 * @remarks
 * `missing` means no sufficient approval exists; `submitted` means an approval
 * transaction was submitted but is not yet confirmed; `confirmed` means the
 * approval is on-chain. Forward-compatible with server-added values.
 *
 * @public
 */
export type AmmAllowanceStatus = 'confirmed' | 'missing' | 'submitted' | (string & {});

/**
 * Trade submission status. Currently always `SUBMITTED` (uppercase).
 *
 * @public
 */
export type AmmTradeStatus = 'SUBMITTED' | (string & {});

/**
 * FPMM outcome index: `0 = YES`, `1 = NO`.
 *
 * @public
 */
export type AmmOutcomeIndex = 0 | 1;

/** @public */
export const AmmOutcomeYes: AmmOutcomeIndex = 0;
/** @public */
export const AmmOutcomeNo: AmmOutcomeIndex = 1;

/**
 * Optional transaction identifiers attached to submitted trades and approvals.
 *
 * @remarks
 * Each field is independent and optional; sponsored user operations often have
 * no immediate `txHash`.
 *
 * @public
 */
export interface AmmTransactionIdentifiers {
  transactionId?: string;
  userOperationHash?: string;
  txHash?: string;
}

/**
 * Request parameters for an allowance check or approve.
 *
 * @public
 */
export interface AmmAllowanceParams {
  /** Market slug or checksummed FPMM address. */
  market: string;
  /** Approval side, `BUY` or `SELL`. */
  side: AmmAllowanceSide;
  /** Owned server-wallet sub-account profile ID. Omit for a direct profile. */
  onBehalfOf?: number;
}

/**
 * Allowance check/approve response.
 *
 * @public
 */
export interface AmmAllowanceResponse extends AmmTransactionIdentifiers {
  status: AmmAllowanceStatus;
  confirmed: boolean;
  market: string;
  marketAddress: string;
  side: AmmAllowanceSide;
  walletAddress: string;
  tokenAddress: string;
  spenderOrOperator: string;
  /** Current ERC-20 allowance in collateral base units. Present for `BUY` checks only. */
  currentAllowance?: string;
}

/**
 * Request parameters for an AMM buy (spend an exact collateral amount).
 *
 * @public
 */
export interface AmmBuyParams {
  /** Market slug or checksummed FPMM address. */
  market: string;
  /** FPMM outcome index: `0 = YES`, `1 = NO`. */
  outcomeIndex: AmmOutcomeIndex;
  /** Collateral base units to spend. Positive integer string, no decimals. */
  collateralAmount: string;
  /** Slippage tolerance in basis points, `0..1000`. Defaults to `100` server-side. */
  slippageBps?: number;
  /** Required idempotency key (≤128 chars) for safe timeout retries. */
  idempotencyKey: string;
  /** Owned server-wallet sub-account profile ID. Omit for a direct profile. */
  onBehalfOf?: number;
}

/**
 * Request parameters for an AMM sell (receive an exact collateral return).
 *
 * @public
 */
export interface AmmSellParams {
  /** Market slug or checksummed FPMM address. */
  market: string;
  /** FPMM outcome index: `0 = YES`, `1 = NO`. */
  outcomeIndex: AmmOutcomeIndex;
  /** Collateral base units to receive. Positive integer string, no decimals. */
  collateralReturnAmount: string;
  /** Slippage tolerance in basis points, `0..1000`. Defaults to `100` server-side. */
  slippageBps?: number;
  /** Required idempotency key (≤128 chars) for safe timeout retries. */
  idempotencyKey: string;
  /** Owned server-wallet sub-account profile ID. Omit for a direct profile. */
  onBehalfOf?: number;
}

/**
 * AMM buy response.
 *
 * @public
 */
export interface AmmBuyResponse extends AmmTransactionIdentifiers {
  status: AmmTradeStatus;
  market: string;
  outcomeIndex: number;
  collateralAmount: string;
  expectedShares: string;
  minShares: string;
}

/**
 * AMM sell response.
 *
 * @public
 */
export interface AmmSellResponse extends AmmTransactionIdentifiers {
  status: AmmTradeStatus;
  market: string;
  outcomeIndex: number;
  collateralReturnAmount: string;
  expectedShares: string;
  maxShares: string;
}

/**
 * Options controlling the {@link AmmService.ensureAllowance} poll loop.
 *
 * @public
 */
export interface AmmEnsureAllowanceOptions {
  /** Privy identity token; when set, identity auth is used instead of HMAC. */
  identityToken?: string;
  /** Poll interval in milliseconds while waiting for confirmation. Default `2000`. */
  intervalMs?: number;
  /** Maximum number of check polls before giving up. Default `30`. */
  maxAttempts?: number;
  /** Optional abort signal to cancel the poll loop. */
  signal?: AbortSignal;
}
