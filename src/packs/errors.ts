import { APIError } from '../api/errors';

export type PackErrorKind =
  | 'OTHER'
  | 'ALLOWANCE_REQUIRED'
  | 'NOT_SUBMITTED'
  | 'PRICE_DRIFTED'
  | 'INTENT_EXPIRED'
  | 'WALLET_BUSY'
  | 'RATE_LIMITED'
  | 'SUBMISSION_UNKNOWN'
  | 'TRANSACTION_REVERTED';

/** Recovery metadata only; classification never retries or changes a purchase key. */
export interface PackErrorDetails {
  kind: PackErrorKind;
  code?: string;
  message?: string;
  submissionState?: string;
  parlayId?: string;
  recovery?: string;
  tokenAddress?: string;
  spender?: string;
  requiredAllowance?: string;
}

export function classifyPackError(error: unknown): PackErrorDetails {
  if (!(error instanceof APIError)) return { kind: 'OTHER' };
  const data = error.data && typeof error.data === 'object' ? error.data : {};
  const string = (key: string): string | undefined =>
    typeof data[key] === 'string' ? data[key] : undefined;
  const details: PackErrorDetails = {
    kind: 'OTHER',
    code: string('code'),
    message: error.message,
    submissionState: string('submissionState'),
    parlayId: string('parlayId'),
    recovery: string('recovery'),
    tokenAddress: string('tokenAddress'),
    spender: string('spender'),
    requiredAllowance: string('requiredAllowance'),
  };
  if (error.status === 409 && details.code === 'PACK_SUBMISSION_UNKNOWN')
    details.kind = 'SUBMISSION_UNKNOWN';
  else if (
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429 &&
    details.submissionState === 'NOT_SUBMITTED'
  )
    details.kind = 'NOT_SUBMITTED';
  else if (error.status === 409 && details.code === 'PACK_ALLOWANCE_REQUIRED')
    details.kind = 'ALLOWANCE_REQUIRED';
  else if (error.status === 409 && details.code === 'PRICE_DRIFTED') details.kind = 'PRICE_DRIFTED';
  else if (error.status === 401 && error.message === 'Intent expired — please retry')
    details.kind = 'INTENT_EXPIRED';
  else if (
    error.status === 409 &&
    error.message ===
      'Another Pack operation is in progress for this wallet; retry the same request'
  )
    details.kind = 'WALLET_BUSY';
  else if (error.status === 429) details.kind = 'RATE_LIMITED';
  else if (error.status === 409 && details.code === 'PACK_TRANSACTION_REVERTED')
    details.kind = 'TRANSACTION_REVERTED';
  return details;
}
