/**
 * Partner-account creation types.
 * @public
 */

/**
 * Partner-owned profile creation payload.
 * `displayName` is the public profile name for the created partner account.
 * If omitted, the backend defaults it to the created or verified account address.
 * The backend currently enforces a maximum length of 44 characters.
 * @public
 */
export interface CreatePartnerAccountInput {
  displayName?: string;
  createServerWallet?: boolean;
}

/**
 * EOA verification headers for partner-account creation.
 * @public
 */
export interface CreatePartnerAccountEOAHeaders {
  account: string;
  signingMessage: string;
  signature: string;
}

/**
 * Partner-account creation response.
 * @public
 */
export interface PartnerAccountResponse {
  profileId: number;
  account: string;
}

/**
 * Allowance target type constants.
 * @public
 */
export const PartnerAccountAllowanceTypeUsdcAllowance = 'USDC_ALLOWANCE';
export const PartnerAccountAllowanceTypeCtfApproval = 'CTF_APPROVAL';

/**
 * Allowance target trade direction constants.
 * @public
 */
export const PartnerAccountAllowanceRequiredForBuy = 'BUY';
export const PartnerAccountAllowanceRequiredForSell = 'SELL';

/**
 * Allowance target status constants.
 * @public
 */
export const PartnerAccountAllowanceStatusConfirmed = 'confirmed';
export const PartnerAccountAllowanceStatusMissing = 'missing';
export const PartnerAccountAllowanceStatusSubmitted = 'submitted';
export const PartnerAccountAllowanceStatusFailed = 'failed';

/**
 * Common allowance recovery error code constants.
 * @public
 */
export const PartnerAccountAllowanceErrorPrivySponsorshipUnavailable =
  'PRIVY_SPONSORSHIP_UNAVAILABLE';
export const PartnerAccountAllowanceErrorPrivySubmissionFailed = 'PRIVY_SUBMISSION_FAILED';
export const PartnerAccountAllowanceErrorRpcReadFailed = 'RPC_READ_FAILED';
export const PartnerAccountAllowanceErrorRequestBudgetExceeded = 'REQUEST_BUDGET_EXCEEDED';

/**
 * Allowance target type returned by the partner allowance recovery endpoints.
 *
 * @remarks
 * The string extension keeps the SDK forward-compatible if the API adds target types.
 * @public
 */
export type PartnerAccountAllowanceType =
  | typeof PartnerAccountAllowanceTypeUsdcAllowance
  | typeof PartnerAccountAllowanceTypeCtfApproval
  | (string & {});

/**
 * Trading action that requires this allowance target.
 * @public
 */
export type PartnerAccountAllowanceRequiredFor =
  | typeof PartnerAccountAllowanceRequiredForBuy
  | typeof PartnerAccountAllowanceRequiredForSell
  | (string & {});

/**
 * Allowance recovery target status.
 * @public
 */
export type PartnerAccountAllowanceStatus =
  | typeof PartnerAccountAllowanceStatusConfirmed
  | typeof PartnerAccountAllowanceStatusMissing
  | typeof PartnerAccountAllowanceStatusSubmitted
  | typeof PartnerAccountAllowanceStatusFailed
  | (string & {});

/**
 * Allowance recovery error code.
 * @public
 */
export type PartnerAccountAllowanceErrorCode =
  | typeof PartnerAccountAllowanceErrorPrivySponsorshipUnavailable
  | typeof PartnerAccountAllowanceErrorPrivySubmissionFailed
  | typeof PartnerAccountAllowanceErrorRpcReadFailed
  | typeof PartnerAccountAllowanceErrorRequestBudgetExceeded
  | (string & {});

/**
 * Aggregate allowance readiness counts.
 * @public
 */
export interface PartnerAccountAllowanceSummary {
  total: number;
  confirmed: number;
  missing: number;
  submitted: number;
  failed: number;
}

/**
 * Individual allowance or approval target returned by the recovery endpoints.
 * @public
 */
export interface PartnerAccountAllowanceTarget {
  type: PartnerAccountAllowanceType;
  tokenAddress: string;
  spenderOrOperator: string;
  label: string;
  requiredFor: PartnerAccountAllowanceRequiredFor;
  confirmed: boolean;
  status: PartnerAccountAllowanceStatus;
  transactionId?: string;
  txHash?: string;
  userOperationHash?: string;
  retryable: boolean;
  errorCode?: PartnerAccountAllowanceErrorCode;
  errorMessage?: string;
}

/**
 * Partner server-wallet allowance recovery response.
 * @public
 */
export interface PartnerAccountAllowanceResponse {
  profileId: number;
  partnerProfileId: number;
  chainId: number;
  walletAddress: string;
  ready: boolean;
  summary: PartnerAccountAllowanceSummary;
  targets: PartnerAccountAllowanceTarget[];
}
