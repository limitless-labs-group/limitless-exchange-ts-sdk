/** Pack requests use integer micro-USDC strings; positions may return decimal strings in the same units. */
export interface PackLeg {
  id?: string;
  legIndex?: number;
  priceAtCreation?: string;
  resolutionStatus?: string;
  resolvedAt?: string | null;
  marketSlug?: string;
  marketId?: number;
  conditionId?: string;
  marketType?: string;
  outcome: string;
  price?: number | null;
  bookPrice?: number | null;
  livePrice?: number | null;
}
export interface Pack {
  id: string;
  name: string;
  status: string;
  eligible: boolean;
  parlayType: string;
  legs: PackLeg[];
}
export interface PackQuoteParams {
  packId: string;
  stakeAmount: string;
}
export interface PackQuote {
  eligible: boolean;
  parlayType?: string;
  rawMultiplier?: number;
  multiplier?: number;
  potentialPayout?: string;
  collateralRequired?: string;
  vigPercent?: number;
  legs?: PackLeg[];
  ineligibleReasons?: string[] | null;
}
/** Persist this entire body before buy; replay it unchanged even after the deadline. */
export interface PackBuyParams extends PackQuoteParams {
  onBehalfOf: number;
  minPayoutAmount: string;
  deadline: string;
  idempotencyKey: string;
}
export interface PackPosition {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'WON' | 'LOST' | 'FAILED' | 'VAULT_REVERTED';
  stakeAmount: string;
  collateralDeposited: string;
  multiplierOffered: string;
  vigPercent: string;
  txHash: string | null;
  claimTxHash: string | null;
  wallet: string;
  createdAt: string;
  legs: PackLeg[];
  sourcePack: { id: string; name: string } | null;
  payoutAmount: string | null;
}
export interface PackBuyResponse {
  status: 'COMPLETED' | 'PENDING' | 'RECOVERING' | 'FAILED';
  position: PackPosition;
}
export interface PackPositions {
  data: PackPosition[];
  total: number;
  limit: number;
  offset: number;
}
export interface PackClaimResponse {
  parlayId: string;
  status: 'APPROVAL_PENDING' | 'CLAIM_PENDING' | 'CLAIMED';
  txHash?: string;
  transactionId?: string;
  userOperationHash?: string;
}
export interface PackPollOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
  intervalMs?: number;
}
