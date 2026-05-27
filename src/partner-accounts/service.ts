import { HttpClient } from '../api/http';
import type {
  CreatePartnerAccountEOAHeaders,
  CreatePartnerAccountInput,
  ListPartnerAccountsParams,
  ListPartnerAccountsResponse,
  PartnerAccountAllowanceResponse,
  PartnerAccountResponse,
  PartnerWithdrawalAddressInput,
  PartnerWithdrawalAddressResponse,
} from '../types/partner-accounts';
import type { ILogger } from '../types/logger';
import { NoOpLogger } from '../types/logger';

const PARTNER_ACCOUNT_ALLOWANCE_HMAC_ONLY_ERROR =
  'Partner account allowance recovery requires HMAC-scoped API token auth; legacy API keys are not supported.';
const PARTNER_ACCOUNT_LIST_HMAC_ONLY_ERROR =
  'Partner account listing requires HMAC-scoped API token auth; legacy API keys are not supported.';
const PARTNER_ACCOUNTS_MAX_LIMIT = 25;

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
   * Lists partner-owned accounts or recovers a specific partner-owned account by address.
   *
   * @remarks
   * This endpoint is intended for partner recovery flows. For example, if account creation
   * succeeded but the partner failed to persist the returned `profileId`, call
   * `listAccounts({ account })` to recover the minimal account metadata.
   */
  async listAccounts(params: ListPartnerAccountsParams = {}): Promise<ListPartnerAccountsResponse> {
    this.requireHmacAuth('listPartnerAccounts', PARTNER_ACCOUNT_LIST_HMAC_ONLY_ERROR);
    const path = this.partnerAccountsPath(params);

    this.logger.debug('Listing partner accounts', params);

    return this.httpClient.get<ListPartnerAccountsResponse>(path);
  }

  /**
   * Checks delegated-trading allowance readiness from live chain state for a partner-created
   * server-wallet profile.
   */
  async checkAllowances(profileId: number): Promise<PartnerAccountAllowanceResponse> {
    this.requireHmacAuth(
      'checkPartnerAccountAllowances',
      PARTNER_ACCOUNT_ALLOWANCE_HMAC_ONLY_ERROR
    );
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
    this.requireHmacAuth(
      'retryPartnerAccountAllowances',
      PARTNER_ACCOUNT_ALLOWANCE_HMAC_ONLY_ERROR
    );
    const path = this.partnerAccountAllowancesPath(profileId);

    this.logger.debug('Retrying partner-account allowances', { profileId });

    return this.httpClient.post<PartnerAccountAllowanceResponse>(`${path}/retry`, {});
  }

  /**
   * Adds an active partner withdrawal destination allowlist entry using a Privy identity token.
   * API-token auth is not used for this endpoint.
   */
  async addWithdrawalAddress(
    identityToken: string,
    input: PartnerWithdrawalAddressInput
  ): Promise<PartnerWithdrawalAddressResponse> {
    if (!identityToken) {
      throw new Error('identity token is required for addWithdrawalAddress');
    }
    if (!input?.address) {
      throw new Error('address is required for addWithdrawalAddress');
    }

    this.logger.debug('Adding partner withdrawal address', { address: input.address });

    return this.httpClient.postWithIdentity<PartnerWithdrawalAddressResponse>(
      '/portfolio/withdrawal-addresses',
      identityToken,
      input
    );
  }

  /**
   * Removes a partner withdrawal destination allowlist entry using a Privy identity token.
   * API-token auth is not used for this endpoint.
   */
  async deleteWithdrawalAddress(identityToken: string, address: string): Promise<void> {
    if (!identityToken) {
      throw new Error('identity token is required for deleteWithdrawalAddress');
    }
    if (!address) {
      throw new Error('address is required for deleteWithdrawalAddress');
    }

    this.logger.debug('Deleting partner withdrawal address', { address });

    await this.httpClient.deleteWithIdentity<void>(
      `/portfolio/withdrawal-addresses/${encodeURIComponent(address)}`,
      identityToken
    );
  }

  private requireHmacAuth(operation: string, errorMessage: string): void {
    this.httpClient.requireAuth(operation);

    if (!this.httpClient.getHMACCredentials()) {
      throw new Error(errorMessage);
    }
  }

  private partnerAccountsPath(params: ListPartnerAccountsParams): string {
    const search = new URLSearchParams();

    if (params.account !== undefined) {
      const account = params.account.trim();
      if (!account) {
        throw new Error('account must be a non-empty string');
      }
      search.set('account', account);
    }

    if (params.limit !== undefined) {
      search.set(
        'limit',
        this.formatPositiveInteger(params.limit, 'limit', PARTNER_ACCOUNTS_MAX_LIMIT)
      );
    }

    if (params.page !== undefined) {
      search.set('page', this.formatPositiveInteger(params.page, 'page'));
    }

    const query = search.toString();
    return query ? `/profiles/partner-accounts?${query}` : '/profiles/partner-accounts';
  }

  private partnerAccountAllowancesPath(profileId: number): string {
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new Error('profileId must be a positive integer');
    }

    return `/profiles/partner-accounts/${profileId}/allowances`;
  }

  private formatPositiveInteger(value: number, name: string, max?: number): string {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }

    return String(max === undefined ? value : Math.min(value, max));
  }
}
