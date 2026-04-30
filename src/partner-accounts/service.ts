import { HttpClient } from '../api/http';
import type {
  CreatePartnerAccountEOAHeaders,
  CreatePartnerAccountInput,
  PartnerAccountAllowanceResponse,
  PartnerAccountResponse,
} from '../types/partner-accounts';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const PARTNER_ACCOUNT_ALLOWANCE_HMAC_ONLY_ERROR =
  'Partner account allowance recovery requires HMAC-scoped API token auth; legacy API keys are not supported.';

/**
 * Partner-owned profile creation API.
 * @public
 */
export class PartnerAccountService {
  private static readonly DISPLAY_NAME_MAX_LENGTH = 44;
  private readonly httpClient: HttpClient;
  private readonly logger: ILogger;

  constructor(httpClient: HttpClient, logger?: ILogger) {
    this.httpClient = httpClient;
    this.logger = logger || new NoOpLogger();
  }

  async createAccount(
    input: CreatePartnerAccountInput,
    eoaHeaders?: CreatePartnerAccountEOAHeaders
  ): Promise<PartnerAccountResponse> {
    this.httpClient.requireAuth('createPartnerAccount');

    const serverWalletMode = input.createServerWallet === true;
    if (!serverWalletMode && !eoaHeaders) {
      throw new Error('EOA headers are required when createServerWallet is not true');
    }
    if (
      input.displayName &&
      input.displayName.length > PartnerAccountService.DISPLAY_NAME_MAX_LENGTH
    ) {
      throw new Error(
        `displayName must be at most ${PartnerAccountService.DISPLAY_NAME_MAX_LENGTH} characters`
      );
    }

    this.logger.debug('Creating partner account', {
      displayName: input.displayName,
      createServerWallet: input.createServerWallet,
    });

    const payload = {
      displayName: input.displayName,
      createServerWallet: input.createServerWallet,
    };

    return this.httpClient.postWithHeaders<PartnerAccountResponse>(
      '/profiles/partner-accounts',
      payload,
      eoaHeaders
        ? {
            'x-account': eoaHeaders.account,
            'x-signing-message': eoaHeaders.signingMessage,
            'x-signature': eoaHeaders.signature,
          }
        : undefined
    );
  }

  /**
   * Checks delegated-trading allowance readiness from live chain state for a partner-created
   * server-wallet profile.
   */
  async checkAllowances(profileId: number): Promise<PartnerAccountAllowanceResponse> {
    this.requireAllowanceHmacAuth('checkPartnerAccountAllowances');
    const path = this.partnerAccountAllowancesPath(profileId);

    this.logger.debug('Checking partner-account allowances', { profileId });

    return this.httpClient.get<PartnerAccountAllowanceResponse>(path);
  }

  /**
   * Re-checks live chain state and retries delegated-trading allowances that are still missing for
   * a partner-created server-wallet profile.
   *
   * Submitted targets in the response mean this retry request submitted a sponsored transaction or
   * user operation; call `checkAllowances` again after a short delay to observe confirmed chain
   * state.
   */
  async retryAllowances(profileId: number): Promise<PartnerAccountAllowanceResponse> {
    this.requireAllowanceHmacAuth('retryPartnerAccountAllowances');
    const path = this.partnerAccountAllowancesPath(profileId);

    this.logger.debug('Retrying partner-account allowances', { profileId });

    return this.httpClient.post<PartnerAccountAllowanceResponse>(`${path}/retry`, {});
  }

  private requireAllowanceHmacAuth(operation: string): void {
    this.httpClient.requireAuth(operation);

    if (!this.httpClient.getHMACCredentials()) {
      throw new Error(PARTNER_ACCOUNT_ALLOWANCE_HMAC_ONLY_ERROR);
    }
  }

  private partnerAccountAllowancesPath(profileId: number): string {
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new Error('profileId must be a positive integer');
    }

    return `/profiles/partner-accounts/${profileId}/allowances`;
  }
}
