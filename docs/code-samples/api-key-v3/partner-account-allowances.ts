import {
  APIError,
  PartnerAccountAllowanceStatusFailed,
  PartnerAccountAllowanceStatusMissing,
  PartnerAccountAllowanceStatusSubmitted,
  RateLimitError,
  type PartnerAccountAllowanceResponse,
  type PartnerAccountAllowanceTarget,
} from '../../../src';
import { createHmacClient, envFlag, optionalPositiveInt, requireEnv } from './common';

function partnerAccountProfileId(): number {
  const explicitProfileId = optionalPositiveInt('LIMITLESS_PARTNER_ACCOUNT_PROFILE_ID', 0);
  if (explicitProfileId > 0) {
    return explicitProfileId;
  }

  const onBehalfOf = optionalPositiveInt('LIMITLESS_ON_BEHALF_OF', 0);
  if (onBehalfOf > 0) {
    return onBehalfOf;
  }

  throw new Error('LIMITLESS_PARTNER_ACCOUNT_PROFILE_ID is required');
}

function hasRetryableMissingOrFailedTarget(targets: PartnerAccountAllowanceTarget[]): boolean {
  return targets.some(
    (target) =>
      target.retryable &&
      (target.status === PartnerAccountAllowanceStatusMissing ||
        target.status === PartnerAccountAllowanceStatusFailed)
  );
}

function submittedTargets(targets: PartnerAccountAllowanceTarget[]): number {
  return targets.filter((target) => target.status === PartnerAccountAllowanceStatusSubmitted)
    .length;
}

function retryAfterSeconds(data: unknown): string {
  if (
    data &&
    typeof data === 'object' &&
    'retryAfterSeconds' in data &&
    typeof data.retryAfterSeconds === 'number'
  ) {
    return data.retryAfterSeconds.toString();
  }

  return '(not provided)';
}

function handleRetryError(error: unknown): never {
  if (error instanceof RateLimitError) {
    console.error(`Retry is rate limited. retryAfterSeconds=${retryAfterSeconds(error.data)}`);
  } else if (error instanceof APIError && error.status === 409) {
    console.error(
      'Another allowance retry is already running. Wait briefly and poll the GET endpoint again.'
    );
  }

  throw error;
}

function printAllowanceResponse(response: PartnerAccountAllowanceResponse): void {
  console.log(
    `profileId=${response.profileId} partnerProfileId=${response.partnerProfileId} chainId=${response.chainId} wallet=${response.walletAddress} ready=${response.ready}`
  );
  console.log(
    `summary: total=${response.summary.total} confirmed=${response.summary.confirmed} missing=${response.summary.missing} submitted=${response.summary.submitted} failed=${response.summary.failed}`
  );

  response.targets.forEach((target, index) => {
    const details = [
      `target[${index}]: type=${target.type}`,
      `label=${target.label}`,
      `requiredFor=${target.requiredFor}`,
      `status=${target.status}`,
      `confirmed=${target.confirmed}`,
      `retryable=${target.retryable}`,
      `spenderOrOperator=${target.spenderOrOperator}`,
      target.transactionId ? `transactionId=${target.transactionId}` : '',
      target.txHash ? `txHash=${target.txHash}` : '',
      target.userOperationHash ? `userOperationHash=${target.userOperationHash}` : '',
      target.errorCode ? `errorCode=${target.errorCode}` : '',
      target.errorMessage ? `errorMessage=${JSON.stringify(target.errorMessage)}` : '',
    ].filter(Boolean);

    console.log(details.join(' '));
  });
}

async function main() {
  const profileId = partnerAccountProfileId();
  const skipRetry = envFlag('LIMITLESS_SKIP_ALLOWANCE_RETRY', false);
  const client = createHmacClient({
    tokenId: requireEnv('LIMITLESS_API_TOKEN_ID'),
    secret: requireEnv('LIMITLESS_API_TOKEN_SECRET'),
  });

  console.log(`GET /profiles/partner-accounts/${profileId}/allowances`);
  const allowances = await client.partnerAccounts.checkAllowances(profileId);
  printAllowanceResponse(allowances);

  if (allowances.ready) {
    console.log('Allowance targets are ready.');
    return;
  }
  if (!hasRetryableMissingOrFailedTarget(allowances.targets)) {
    console.log('No retryable missing or failed targets were returned.');
    return;
  }
  if (skipRetry) {
    console.log('Skipping retry because LIMITLESS_SKIP_ALLOWANCE_RETRY is enabled.');
    return;
  }

  console.log(`POST /profiles/partner-accounts/${profileId}/allowances/retry`);
  let retried: PartnerAccountAllowanceResponse;
  try {
    retried = await client.partnerAccounts.retryAllowances(profileId);
  } catch (error) {
    handleRetryError(error);
  }

  printAllowanceResponse(retried);

  if (submittedTargets(retried.targets) > 0) {
    console.log(
      'Retry submitted sponsored allowance work. Poll the GET endpoint again after a short delay.'
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
